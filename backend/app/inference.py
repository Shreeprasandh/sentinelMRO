import os
import json
import asyncio
import numpy as np
import random
import sys
from fastapi import APIRouter, HTTPException, WebSocket, WebSocketDisconnect
from pydantic import BaseModel
import onnxruntime as ort
import torch

# Add models directory to system path to import TCNModel
sys.path.append(os.path.abspath(os.path.join(os.path.dirname(__file__), "..", "models")))
from train_tcn import TCNModel

router = APIRouter(prefix="/api/v1/edge", tags=["Edge Inference"])

MODEL_DIR = os.path.dirname(os.path.abspath(__file__))
ONNX_PATH = os.path.join(MODEL_DIR, "tcn_model_quantized.onnx")
SCALER_PATH = os.path.join(MODEL_DIR, "scaler_params.json")
PYTORCH_MODEL_PATH = os.path.abspath(os.path.join(MODEL_DIR, "..", "models", "tcn_model.pt"))

pytorch_model = None

def load_pytorch_model():
    global pytorch_model
    if pytorch_model is not None:
        return pytorch_model
    if os.path.exists(PYTORCH_MODEL_PATH):
        try:
            pytorch_model = TCNModel(input_size=14, output_size=1, num_channels=[32, 32, 32, 32], kernel_size=3, dropout=0.2)
            pytorch_model.load_state_dict(torch.load(PYTORCH_MODEL_PATH, map_location=torch.device('cpu')))
            pytorch_model.eval()
            print("PyTorch model loaded successfully for Explainable AI.")
        except Exception as e:
            print(f"Error loading PyTorch model for XAI: {e}")
    else:
        print(f"PyTorch model not found at {PYTORCH_MODEL_PATH}")
    return pytorch_model

class InferencePayload(BaseModel):
    sensor_matrix: list[list[float]]
    explain: bool = False

class AttributionItem(BaseModel):
    sensor: str
    percentage: float

class InferenceResponse(BaseModel):
    health_score: float
    predicted_rul: int
    anomaly_flag: bool
    is_mock: bool
    attribution: list[AttributionItem] = []

class ONNXInferenceService:
    def __init__(self):
        self.session = None
        self.scaler = None
        self.load_resources()
        
    def load_resources(self):
        if os.path.exists(ONNX_PATH) and os.path.exists(SCALER_PATH):
            try:
                self.session = ort.InferenceSession(ONNX_PATH, providers=["CPUExecutionProvider"])
                with open(SCALER_PATH, "r") as f:
                    self.scaler = json.load(f)
                print("ONNX model and scaler parameters loaded successfully.")
                load_pytorch_model()
            except Exception as e:
                print(f"Error loading model resources: {e}")
                self.session = None
                self.scaler = None
        else:
            print("ONNX model or scaler parameters not found. Inference service running in Mock/Fallback mode.")

    def preprocess_and_predict(self, matrix: list[list[float]]) -> tuple[float, int, bool, bool]:
        if self.session is None or self.scaler is None:
            self.load_resources()
            
        if self.session is None or self.scaler is None:
            mock_rul = max(10, min(125, int(125 - len(matrix) * 1.5)))
            health_score = float(mock_rul / 125.0)
            anomaly_flag = mock_rul < 30
            return health_score, mock_rul, anomaly_flag, True
            
        try:
            arr = np.array(matrix, dtype=np.float32)
            if arr.shape != (30, 14):
                raise ValueError(f"Expected shape (30, 14), got {arr.shape}")
                
            scale = np.array(self.scaler["scale"], dtype=np.float32)
            min_val = np.array(self.scaler["min"], dtype=np.float32)
            scaled_arr = arr * scale + min_val
            onnx_input = np.expand_dims(scaled_arr.T, axis=0)
            
            inputs = {self.session.get_inputs()[0].name: onnx_input}
            outputs = self.session.run(None, inputs)
            predicted_rul = float(outputs[0][0][0])
            
            predicted_rul = max(0.0, min(125.0, predicted_rul))
            rul_int = int(round(predicted_rul))
            health_score = float(predicted_rul / 125.0)
            anomaly_flag = rul_int < 30
            
            return health_score, rul_int, anomaly_flag, False
        except Exception as e:
            print(f"ONNX inference failed: {e}", file=sys.stderr)
            try:
                last_reading = matrix[-1]
                s15_val = last_reading[10]
                estimated_cycle = max(1, int(round((s15_val - 8.41) / 0.002)))
            except Exception:
                estimated_cycle = 30

            if estimated_cycle < 60:
                mock_rul = max(80, int(150 - estimated_cycle))
            elif estimated_cycle < 110:
                mock_rul = max(35, int(145 - estimated_cycle))
            else:
                mock_rul = max(5, int(162 - estimated_cycle))

            health_score = float(mock_rul / 125.0)
            anomaly_flag = mock_rul < 30
            return health_score, mock_rul, anomaly_flag, True

    def compute_attribution(self, matrix: list[list[float]]) -> list[dict]:
        model = load_pytorch_model()
        sensor_names = ["s2", "s3", "s4", "s7", "s8", "s9", "s11", "s12", "s13", "s14", "s15", "s17", "s20", "s21"]
        
        if model is None or self.scaler is None:
            return [{"sensor": name, "percentage": 100.0 / len(sensor_names)} for name in sensor_names]
            
        try:
            arr = np.array(matrix, dtype=np.float32)
            scale = np.array(self.scaler["scale"], dtype=np.float32)
            min_val = np.array(self.scaler["min"], dtype=np.float32)
            scaled_arr = arr * scale + min_val
            onnx_input = np.expand_dims(scaled_arr.T, axis=0)
            
            input_tensor = torch.tensor(onnx_input, dtype=torch.float32, requires_grad=True)
            baseline = torch.zeros_like(input_tensor)
            
            steps = 10
            grads_accum = torch.zeros_like(input_tensor)
            
            for alpha in np.linspace(0.0, 1.0, steps):
                interpolated = baseline + alpha * (input_tensor - baseline)
                interpolated = interpolated.clone().detach().requires_grad_(True)
                out = model(interpolated)
                out.backward(torch.ones_like(out))
                grads_accum += interpolated.grad.data
                
            avg_grads = grads_accum / steps
            attributions = (input_tensor - baseline) * avg_grads
            
            attribution_scores = attributions.squeeze(0).mean(dim=1).detach().numpy()
            
            wear_scores = -attribution_scores
            wear_scores = np.clip(wear_scores, a_min=0, a_max=None)
            
            total_wear = np.sum(wear_scores)
            if total_wear > 0:
                wear_percentages = (wear_scores / total_wear) * 100
            else:
                wear_percentages = [100.0 / len(sensor_names)] * len(sensor_names)
                
            attribution_list = []
            for name, pct in zip(sensor_names, wear_percentages):
                attribution_list.append({"sensor": name, "percentage": float(pct)})
                
            attribution_list.sort(key=lambda x: x["percentage"], reverse=True)
            return attribution_list
        except Exception as e:
            print(f"Error computing attributions: {e}")
            return [{"sensor": name, "percentage": 100.0 / len(sensor_names)} for name in sensor_names]

inference_service = ONNXInferenceService()

@router.post("/inference", response_model=InferenceResponse)
def get_edge_inference(payload: InferencePayload):
    if len(payload.sensor_matrix) != 30 or any(len(row) != 14 for row in payload.sensor_matrix):
        raise HTTPException(
            status_code=400, 
            detail="Payload must be a 30x14 matrix (30 cycles of 14 sensor readings)."
        )
        
    health_score, rul_int, anomaly, is_mock = inference_service.preprocess_and_predict(payload.sensor_matrix)
    attribution = inference_service.compute_attribution(payload.sensor_matrix) if payload.explain else []
    
    return {
        "health_score": health_score,
        "predicted_rul": rul_int,
        "anomaly_flag": anomaly,
        "is_mock": is_mock,
        "attribution": attribution
    }

def simulate_telemetry_matrix(engine_id: str, cycle: int) -> tuple[list[list[float]], float, float]:
    degradation = 1.6 if engine_id == "ENG-003" else 1.1 if engine_id == "ENG-002" else 0.8
    matrix = []
    for index in range(30):
        cycle_idx = cycle - 29 + index
        effective_cycle = cycle_idx * degradation
        
        row = [
            642.0 + (effective_cycle * 0.007) + random.uniform(0, 0.1),
            1585.0 + (effective_cycle * 0.08) + random.uniform(0, 0.5),
            1400.0 + (effective_cycle * 0.15) + random.uniform(0, 0.5),
            554.0 - (effective_cycle * 0.015) + random.uniform(0, 0.05),
            2388.0 + (effective_cycle * 0.001) + random.uniform(0, 0.01),
            9050.0 + (effective_cycle * 0.25) + random.uniform(0, 1.0),
            47.3 + (effective_cycle * 0.005) + random.uniform(0, 0.02),
            522.0 - (effective_cycle * 0.012) + random.uniform(0, 0.05),
            2388.0 + (effective_cycle * 0.001) + random.uniform(0, 0.01),
            8135.0 + (effective_cycle * 0.18) + random.uniform(0, 0.5),
            8.40 + (effective_cycle * 0.0007) + random.uniform(0, 0.002),
            392.0 + (effective_cycle * 0.025) + random.uniform(0, 0.2),
            38.95 - (effective_cycle * 0.003) + random.uniform(0, 0.02),
            23.4 - (effective_cycle * 0.002) + random.uniform(0, 0.02)
        ]
        matrix.append(row)
        
    s11 = 1585.0 + cycle * 0.08 * degradation + random.uniform(0, 0.5)
    s12 = 8.40 + cycle * 0.0007 * degradation + random.uniform(0, 0.002)
    return matrix, s11, s12


DEFAULT_ATTRIBUTION = [
    {"sensor": "s11", "percentage": 22.5},
    {"sensor": "s4", "percentage": 18.2},
    {"sensor": "s12", "percentage": 15.1},
    {"sensor": "s3", "percentage": 10.4},
    {"sensor": "s7", "percentage": 8.1},
    {"sensor": "s8", "percentage": 7.3},
    {"sensor": "s2", "percentage": 5.4},
    {"sensor": "s9", "percentage": 4.1},
    {"sensor": "s15", "percentage": 3.2},
    {"sensor": "s13", "percentage": 2.1},
    {"sensor": "s14", "percentage": 1.5},
    {"sensor": "s17", "percentage": 1.1},
    {"sensor": "s20", "percentage": 0.6},
    {"sensor": "s21", "percentage": 0.4}
]

@router.websocket("/ws/telemetry")
async def websocket_telemetry(websocket: WebSocket):
    await websocket.accept()
    
    state = {
        "paused": False,
        "rate_ms": 1000,
        "engine_cycles": {"ENG-001": 30, "ENG-002": 30, "ENG-003": 30},
        "attribution_cache": {
            "ENG-001": DEFAULT_ATTRIBUTION,
            "ENG-002": DEFAULT_ATTRIBUTION,
            "ENG-003": DEFAULT_ATTRIBUTION
        }
    }
    
    async def read_commands():
        try:
            while True:
                data = await websocket.receive_text()
                cmd = json.loads(data)
                action = cmd.get("command")
                if action == "pause":
                    state["paused"] = True
                elif action == "resume":
                    state["paused"] = False
                elif action == "set_rate":
                    state["rate_ms"] = max(100, int(cmd.get("rate", 1000)))
                elif action == "reset":
                    state["engine_cycles"] = {"ENG-001": 30, "ENG-002": 30, "ENG-003": 30}
                elif action == "set_airborne_engines":
                    state["airborne_engines"] = cmd.get("engines", [])
                elif action == "reset_engine":
                    eng_id = cmd.get("engine_id")
                    if eng_id in state["engine_cycles"]:
                        state["engine_cycles"][eng_id] = 30
        except Exception:
            pass
            
    asyncio.create_task(read_commands())
    
    try:
        while True:
            if not state["paused"]:
                updates = {}
                for engine_id in ["ENG-001", "ENG-002", "ENG-003"]:
                    # Only increment engine cycles if the engine is currently airborne
                    is_airborne = engine_id in state.get("airborne_engines", [])
                    if is_airborne:
                        state["engine_cycles"][engine_id] += 1
                        
                    cycle = state["engine_cycles"][engine_id]
                    matrix, s11, s12 = simulate_telemetry_matrix(engine_id, cycle)
                    
                    health_score, rul_int, anomaly, is_mock = inference_service.preprocess_and_predict(matrix)
                    
                    # Conserve CPU: run Integrated Gradients backpropagation once every 10 cycles, else use cached values
                    if cycle % 10 == 0:
                        attribution = inference_service.compute_attribution(matrix)
                        state["attribution_cache"][engine_id] = attribution
                    else:
                        attribution = state["attribution_cache"][engine_id]
                    
                    updates[engine_id] = {
                        "engine_id": engine_id,
                        "cycle": cycle,
                        "health_score": health_score,
                        "predicted_rul": rul_int,
                        "anomaly_flag": anomaly,
                        "is_mock": is_mock,
                        "attribution": attribution,
                        "sensor_11": s11,
                        "sensor_12": s12
                    }
                
                await websocket.send_json({
                    "type": "telemetry",
                    "engines": updates
                })
                
            await asyncio.sleep(state["rate_ms"] / 1000.0)
    except WebSocketDisconnect:
        pass
    except Exception as e:
        print(f"WebSocket telemetry error: {e}")
