import os
import copy
import json
import numpy as np
import pandas as pd
import torch
import torch.nn as nn
import torch.optim as optim
from torch.utils.data import TensorDataset, DataLoader
from fastapi import APIRouter, HTTPException, WebSocket, WebSocketDisconnect
from pydantic import BaseModel
import sys
import asyncio
import websockets

sys.path.append(os.path.abspath(os.path.join(os.path.dirname(__file__), "..", "models")))
from train_tcn import TCNModel, MinMaxScalerCustom, KEEP_SENSORS, WINDOW_SIZE, MAX_RUL, COLUMNS

router = APIRouter(prefix="/api/v1/federated", tags=["Federated Learning"])

DEVICE = torch.device("cuda" if torch.cuda.is_available() else "cpu")
DATA_DIR = os.path.abspath(os.path.join(os.path.dirname(__file__), "..", "..", "data"))
TRAIN_PATH = os.path.join(DATA_DIR, "train_FD001.txt")
TEST_PATH = os.path.join(DATA_DIR, "test_FD001.txt")
RUL_PATH = os.path.join(DATA_DIR, "RUL_FD001.txt")

MU = 0.01       # FedProx proximal penalty coefficient
SIGMA = 0.001   # LDP noise standard deviation
LOCAL_EPOCHS = 1
BATCH_SIZE = 64

class FederatedMetricsResponse(BaseModel):
    round: int
    station_1_loss: float
    station_2_loss: float
    station_3_loss: float
    global_loss: float
    message: str

class FederatedSimulationState:
    def __init__(self):
        self.current_round = 0
        self.global_model = None
        self.scaler = None
        self.station_loaders = {}
        self.test_loader = None
        self.history = []
        self.initialized = False
        
    def initialize(self):
        if self.initialized:
            return
            
        if not (os.path.exists(TRAIN_PATH) and os.path.exists(TEST_PATH) and os.path.exists(RUL_PATH)):
            print("Data files not found. Federated simulation cannot be initialized yet.")
            return

        try:
            train_df = pd.read_csv(TRAIN_PATH, sep=r"\s+", header=None, names=COLUMNS)
            test_df = pd.read_csv(TEST_PATH, sep=r"\s+", header=None, names=COLUMNS)
            rul_df = pd.read_csv(RUL_PATH, sep=r"\s+", header=None, names=["RUL"])
            rul_df.index = rul_df.index + 1
            
            max_cycles = train_df.groupby("unit")["cycle"].max().reset_index()
            max_cycles.columns = ["unit", "max_cycle"]
            train_df = train_df.merge(max_cycles, on="unit")
            train_df["RUL"] = (train_df["max_cycle"] - train_df["cycle"]).clip(upper=MAX_RUL)
            train_df = train_df.drop(columns=["max_cycle"])
            
            self.scaler = MinMaxScalerCustom()
            self.scaler.fit(train_df, KEEP_SENSORS)
            
            st1_df = train_df[train_df["cycle"] <= 60]
            st2_df = train_df[train_df["cycle"] > 100]
            st3_df = train_df[(train_df["cycle"] > 60) & (train_df["cycle"] <= 100)]
            
            self.station_loaders["STATION_001"] = self._create_loader(st1_df)
            self.station_loaders["STATION_002"] = self._create_loader(st2_df)
            self.station_loaders["STATION_003"] = self._create_loader(st3_df)
            
            X_test, y_test = self._prepare_test_windows(test_df, rul_df)
            X_test_t = torch.tensor(X_test).transpose(1, 2)
            y_test_t = torch.tensor(y_test).unsqueeze(1)
            self.test_loader = DataLoader(TensorDataset(X_test_t, y_test_t), batch_size=BATCH_SIZE, shuffle=False)
            
            num_channels = [32, 32, 32, 32]
            self.global_model = TCNModel(input_size=14, output_size=1, num_channels=num_channels, kernel_size=3, dropout=0.2).to(DEVICE)
            
            model_pt_path = os.path.abspath(os.path.join(os.path.dirname(__file__), "..", "models", "tcn_model.pt"))
            if os.path.exists(model_pt_path):
                self.global_model.load_state_dict(torch.load(model_pt_path, map_location=DEVICE))
                print("Loaded initial weights for Federated Learning from train_tcn model.")
            
            self.initialized = True
            print("Federated simulation initialized successfully.")
        except Exception as e:
            print(f"Error initializing federated simulation: {e}")
            
    def _create_loader(self, df):
        X, y = [], []
        units = df["unit"].unique()
        scaled_df = self.scaler.transform(df, KEEP_SENSORS)
        
        for unit in units:
            unit_df = scaled_df[scaled_df["unit"] == unit]
            data = unit_df[KEEP_SENSORS].values
            
            n_samples = len(unit_df)
            if n_samples >= WINDOW_SIZE:
                for i in range(n_samples - WINDOW_SIZE + 1):
                    X.append(data[i : i + WINDOW_SIZE])
                    y.append(unit_df["RUL"].values[i + WINDOW_SIZE - 1])
                    
        if not X:
            return None
            
        X_t = torch.tensor(np.array(X, dtype=np.float32)).transpose(1, 2)
        y_t = torch.tensor(np.array(y, dtype=np.float32)).unsqueeze(1)
        return DataLoader(TensorDataset(X_t, y_t), batch_size=BATCH_SIZE, shuffle=True)
        
    def _prepare_test_windows(self, df, rul_df):
        X, y = [], []
        units = df["unit"].unique()
        scaled_df = self.scaler.transform(df, KEEP_SENSORS)
        
        for unit in units:
            unit_df = scaled_df[scaled_df["unit"] == unit]
            data = unit_df[KEEP_SENSORS].values
            n_samples = len(unit_df)
            
            if n_samples >= WINDOW_SIZE:
                X.append(data[-WINDOW_SIZE:])
            else:
                padding = np.repeat(data[0:1], WINDOW_SIZE - n_samples, axis=0)
                X.append(np.vstack([padding, data]))
            y.append(rul_df.loc[unit, "RUL"])
            
        return np.array(X, dtype=np.float32), np.array(y, dtype=np.float32)

    async def run_round(self):
        self.initialize()
        if not self.initialized:
            raise HTTPException(status_code=503, detail="Federated simulation is not initialized.")
            
        self.current_round += 1
        round_id = f"round_{self.current_round}"
        print(f"\n--- Starting Federated Round {self.current_round} via WebSockets ---")
        
        # 1. Start background clients if they are offline
        expected_stations = ["STATION_001", "STATION_002", "STATION_003"]
        for st in expected_stations:
            if st not in connected_stations:
                asyncio.create_task(station_client_loop(st))
                
        # 2. Wait up to 3.0 seconds for registration handshake
        for _ in range(30):
            if all(st in connected_stations for st in expected_stations):
                break
            await asyncio.sleep(0.1)
            
        if not all(st in connected_stations for st in expected_stations):
            offline = [st for st in expected_stations if st not in connected_stations]
            raise HTTPException(status_code=503, detail=f"Distributed training failure: Station nodes {offline} are offline.")
            
        # 3. Prepare global weights
        global_weights = [p.data.cpu().numpy().tolist() for p in self.global_model.parameters()]
        
        # 4. Initialize pending round tracking
        pending_rounds[round_id] = {
            "expected": expected_stations,
            "received": {},
            "event": asyncio.Event()
        }
        
        # 5. Broadcast global weights to all station nodes
        for st in expected_stations:
            ws = connected_stations[st]
            await ws.send_json({
                "action": "train",
                "round_id": round_id,
                "weights": global_weights
            })
            
        # 6. Wait for all updates
        try:
            await asyncio.wait_for(pending_rounds[round_id]["event"].wait(), timeout=30.0)
        except asyncio.TimeoutError:
            if round_id in pending_rounds:
                del pending_rounds[round_id]
            raise HTTPException(status_code=504, detail="Federated training round timed out waiting for P2P nodes.")
            
        received = pending_rounds[round_id]["received"]
        del pending_rounds[round_id]
        
        # 7. Aggregate weights (FedProx averaging)
        station_weights = {st: [torch.tensor(w).to(DEVICE) for w in received[st][0]] for st in expected_stations}
        station_losses = {st: received[st][1] for st in expected_stations}
        
        with torch.no_grad():
            for i, param in enumerate(self.global_model.parameters()):
                param.data.zero_()
                for st in expected_stations:
                    param.data.add_(station_weights[st][i])
                param.data.div_(len(expected_stations))
                
        # 8. Evaluate updated global model
        self.global_model.eval()
        global_test_loss = 0.0
        test_samples = 0
        criterion = nn.MSELoss()
        with torch.no_grad():
            for batch_x, batch_y in self.test_loader:
                batch_x, batch_y = batch_x.to(DEVICE), batch_y.to(DEVICE)
                pred = self.global_model(batch_x)
                loss = criterion(pred, batch_y)
                global_test_loss += loss.item() * batch_x.size(0)
                test_samples += batch_x.size(0)
                
        avg_global_loss = global_test_loss / test_samples if test_samples > 0 else 0.0
        print(f"Global validation loss (MSE): {avg_global_loss:.4f}")
        
        # 9. Save updated weights to disk
        model_pt_path = os.path.abspath(os.path.join(os.path.dirname(__file__), "..", "models", "tcn_model.pt"))
        torch.save(self.global_model.state_dict(), model_pt_path)
        
        # 10. Re-quantize and export to ONNX
        try:
            sys.path.append(os.path.abspath(os.path.join(os.path.dirname(__file__), "..", "models")))
            from export_onnx import export_and_quantize
            export_and_quantize()
            print("Successfully updated quantized ONNX model with federated weights.")
        except Exception as e:
            print(f"Error exporting/quantizing updated global model: {e}")
            
        metrics = {
            "round": self.current_round,
            "station_1_loss": station_losses["STATION_001"],
            "station_2_loss": station_losses["STATION_002"],
            "station_3_loss": station_losses["STATION_003"],
            "global_loss": avg_global_loss,
            "message": f"Federated Round {self.current_round} aggregation complete. Secure WebSockets coordination established."
        }
        
        self.history.append(metrics)
        return metrics

# In-memory simulator singleton
federated_simulator = FederatedSimulationState()

# WebSocket Coordinator state registries
connected_stations = {}
pending_rounds = {}

@router.websocket("/ws/coordinator")
async def websocket_coordinator(websocket: WebSocket):
    await websocket.accept()
    station_id = None
    try:
        while True:
            data = await websocket.receive_json()
            action = data.get("action")
            
            if action == "register":
                station_id = data.get("station_id")
                connected_stations[station_id] = websocket
                print(f"P2P Coordinator: Station {station_id} registered successfully.")
                
            elif action == "update":
                r_id = data.get("round_id")
                s_id = data.get("station_id")
                weights = data.get("weights")
                loss = data.get("loss")
                
                if r_id in pending_rounds:
                    pending_rounds[r_id]["received"][s_id] = (weights, loss)
                    expected = pending_rounds[r_id]["expected"]
                    received = pending_rounds[r_id]["received"]
                    if all(st in received for st in expected):
                        pending_rounds[r_id]["event"].set()
                        
    except WebSocketDisconnect:
        if station_id in connected_stations:
            del connected_stations[station_id]
            print(f"P2P Coordinator: Station {station_id} disconnected.")
    except Exception as e:
        print(f"P2P Coordinator Exception: {e}")
        if station_id in connected_stations:
            del connected_stations[station_id]

# Simulated Client Worker Loop
async def station_client_loop(station_id: str):
    await asyncio.sleep(0.5)
    uri = "ws://127.0.0.1:8000/api/v1/federated/ws/coordinator"
    
    while True:
        try:
            async with websockets.connect(uri) as ws:
                await ws.send(json.dumps({
                    "action": "register",
                    "station_id": station_id
                }))
                
                async for message in ws:
                    data = json.loads(message)
                    action = data.get("action")
                    
                    if action == "train":
                        round_id = data.get("round_id")
                        global_weights = data.get("weights")
                        
                        # Train local model partition
                        new_weights, local_loss = train_local_station(station_id, global_weights)
                        
                        await ws.send(json.dumps({
                            "action": "update",
                            "round_id": round_id,
                            "station_id": station_id,
                            "weights": new_weights,
                            "loss": float(local_loss)
                        }))
        except Exception:
            # Reconnection delay
            await asyncio.sleep(2.0)

def train_local_station(station_id: str, global_weights_list: list) -> tuple[list, float]:
    loader = federated_simulator.station_loaders.get(station_id)
    if loader is None:
        return global_weights_list, 0.0
        
    num_channels = [32, 32, 32, 32]
    local_model = TCNModel(input_size=14, output_size=1, num_channels=num_channels, kernel_size=3, dropout=0.2).to(DEVICE)
    
    with torch.no_grad():
        for p, w in zip(local_model.parameters(), global_weights_list):
            p.copy_(torch.tensor(w).to(DEVICE))
            
    global_params = [p.data.clone() for p in local_model.parameters()]
    
    local_model.train()
    criterion = nn.MSELoss()
    optimizer = optim.Adam(local_model.parameters(), lr=0.001)
    
    epoch_loss = 0.0
    total_samples = 0
    
    for _ in range(LOCAL_EPOCHS):
        for batch_x, batch_y in loader:
            batch_x, batch_y = batch_x.to(DEVICE), batch_y.to(DEVICE)
            optimizer.zero_grad()
            pred = local_model(batch_x)
            loss = criterion(pred, batch_y)
            
            proximal_penalty = 0.0
            for param, glob_param in zip(local_model.parameters(), global_params):
                proximal_penalty += torch.sum((param - glob_param) ** 2)
                
            total_loss = loss + (MU / 2.0) * proximal_penalty
            total_loss.backward()
            optimizer.step()
            
            epoch_loss += loss.item() * batch_x.size(0)
            total_samples += batch_x.size(0)
            
    avg_loss = epoch_loss / total_samples if total_samples > 0 else 0.0
    
    with torch.no_grad():
        for param in local_model.parameters():
            noise = torch.normal(mean=0.0, std=SIGMA, size=param.size()).to(DEVICE)
            param.add_(noise)
            
    new_weights_list = [p.data.cpu().numpy().tolist() for p in local_model.parameters()]
    return new_weights_list, avg_loss

@router.get("/history")
def get_federated_history():
    return federated_simulator.history

@router.post("/aggregate", response_model=FederatedMetricsResponse)
async def perform_federation_round():
    metrics = await federated_simulator.run_round()
    return metrics
