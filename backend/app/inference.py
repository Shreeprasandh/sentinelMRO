import os
import json
import numpy as np
from fastapi import APIRouter, HTTPException
from pydantic import BaseModel
import onnxruntime as ort

router = APIRouter(prefix="/api/v1/edge", tags=["Edge Inference"])

MODEL_DIR = os.path.dirname(os.path.abspath(__file__))
ONNX_PATH = os.path.join(MODEL_DIR, "tcn_model_quantized.onnx")
SCALER_PATH = os.path.join(MODEL_DIR, "scaler_params.json")

class InferencePayload(BaseModel):
    # 30 cycles of 14 sensor readings
    # Outer list: 30 time steps. Inner list: 14 sensor values.
    sensor_matrix: list[list[float]]

class InferenceResponse(BaseModel):
    health_score: float
    predicted_rul: int
    anomaly_flag: bool
    is_mock: bool

class ONNXInferenceService:
    def __init__(self):
        self.session = None
        self.scaler = None
        self.load_resources()
        
    def load_resources(self):
        if os.path.exists(ONNX_PATH) and os.path.exists(SCALER_PATH):
            try:
                # Load ONNX session
                # We use CPU execution provider
                self.session = ort.InferenceSession(ONNX_PATH, providers=["CPUExecutionProvider"])
                
                # Load scaler
                with open(SCALER_PATH, "r") as f:
                    self.scaler = json.load(f)
                print("ONNX model and scaler parameters loaded successfully.")
            except Exception as e:
                print(f"Error loading model resources: {e}")
                self.session = None
                self.scaler = None
        else:
            print("ONNX model or scaler parameters not found. Inference service running in Mock/Fallback mode.")

    def preprocess_and_predict(self, matrix: list[list[float]]) -> tuple[float, int, bool, bool]:
        # Check if resources need reloading (in case training finished while server is running)
        if self.session is None or self.scaler is None:
            self.load_resources()
            
        if self.session is None or self.scaler is None:
            # Fallback Mock logic
            # Simulate degradation based on the mean of sensor readings or just random walk
            # Let's make it look realistic: if sensors are higher or average cycles are higher, reduce RUL
            # We can use the last cycle sensor values to mock
            last_reading = matrix[-1]
            # Simple heuristic mock
            mock_rul = max(10, min(125, int(125 - len(matrix) * 1.5)))
            health_score = float(mock_rul / 125.0)
            anomaly_flag = mock_rul < 30
            return health_score, mock_rul, anomaly_flag, True
            
        try:
            # Preprocess: matrix is (30, 14)
            arr = np.array(matrix, dtype=np.float32)
            if arr.shape != (30, 14):
                raise ValueError(f"Expected shape (30, 14), got {arr.shape}")
                
            # Scale each sensor
            scale = np.array(self.scaler["scale"], dtype=np.float32)
            min_val = np.array(self.scaler["min"], dtype=np.float32)
            
            scaled_arr = arr * scale + min_val
            
            # Format for ONNX input: (batch_size=1, channels=14, seq_len=30)
            # Transpose: from (30, 14) -> (14, 30) -> add batch dimension -> (1, 14, 30)
            onnx_input = np.expand_dims(scaled_arr.T, axis=0)
            
            # Run inference
            inputs = {self.session.get_inputs()[0].name: onnx_input}
            outputs = self.session.run(None, inputs)
            predicted_rul = float(outputs[0][0][0])
            
            # Clip RUL values to realistic ranges
            predicted_rul = max(0.0, min(125.0, predicted_rul))
            rul_int = int(round(predicted_rul))
            
            # Health score from 1.0 down to 0.0
            health_score = float(predicted_rul / 125.0)
            
            # Anomaly flag (RUL < 30)
            anomaly_flag = rul_int < 30
            
            return health_score, rul_int, anomaly_flag, False
        except Exception as e:
            print(f"ONNX inference failed, using mock fallback: {e}")
            # Mock fallback
            return 0.8, 100, False, True

inference_service = ONNXInferenceService()

@router.post("/inference", response_model=InferenceResponse)
def get_edge_inference(payload: InferencePayload):
    if len(payload.sensor_matrix) != 30 or any(len(row) != 14 for row in payload.sensor_matrix):
        raise HTTPException(
            status_code=400, 
            detail="Payload must be a 30x14 matrix (30 cycles of 14 sensor readings)."
        )
        
    health_score, rul_int, anomaly, is_mock = inference_service.preprocess_and_predict(payload.sensor_matrix)
    
    return {
        "health_score": health_score,
        "predicted_rul": rul_int,
        "anomaly_flag": anomaly,
        "is_mock": is_mock
    }
