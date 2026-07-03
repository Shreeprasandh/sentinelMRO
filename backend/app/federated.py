import os
import copy
import json
import numpy as np
import pandas as pd
import torch
import torch.nn as nn
import torch.optim as optim
from torch.utils.data import TensorDataset, DataLoader
from fastapi import APIRouter, HTTPException
from pydantic import BaseModel

# We import subcomponents from models.train_tcn for consistency
import sys
sys.path.append(os.path.abspath(os.path.join(os.path.dirname(__file__), "..", "models")))
from train_tcn import TCNModel, MinMaxScalerCustom, KEEP_SENSORS, WINDOW_SIZE, MAX_RUL, COLUMNS

router = APIRouter(prefix="/api/v1/federated", tags=["Federated Learning"])

# Device setup
DEVICE = torch.device("cuda" if torch.cuda.is_available() else "cpu")
DATA_DIR = os.path.abspath(os.path.join(os.path.dirname(__file__), "..", "..", "data"))
TRAIN_PATH = os.path.join(DATA_DIR, "train_FD001.txt")
TEST_PATH = os.path.join(DATA_DIR, "test_FD001.txt")
RUL_PATH = os.path.join(DATA_DIR, "RUL_FD001.txt")

# Configuration
MU = 0.01       # FedProx proximal penalty coefficient
SIGMA = 0.001   # Local Differential Privacy (LDP) noise standard deviation
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
        
        # Partitioned datasets
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
            # Load and Preprocess Data
            train_df = pd.read_csv(TRAIN_PATH, sep=r"\s+", header=None, names=COLUMNS)
            test_df = pd.read_csv(TEST_PATH, sep=r"\s+", header=None, names=COLUMNS)
            rul_df = pd.read_csv(RUL_PATH, sep=r"\s+", header=None, names=["RUL"])
            rul_df.index = rul_df.index + 1
            
            # Compute RUL for train
            max_cycles = train_df.groupby("unit")["cycle"].max().reset_index()
            max_cycles.columns = ["unit", "max_cycle"]
            train_df = train_df.merge(max_cycles, on="unit")
            train_df["RUL"] = (train_df["max_cycle"] - train_df["cycle"]).clip(upper=MAX_RUL)
            train_df = train_df.drop(columns=["max_cycle"])
            
            # Fit MinMaxScaler
            self.scaler = MinMaxScalerCustom()
            self.scaler.fit(train_df, KEEP_SENSORS)
            
            # Non-IID Data Partitioning: 3 MRO Stations
            # Station 1: Nominal (cycles 1 to 60)
            st1_df = train_df[train_df["cycle"] <= 60]
            # Station 2: High-stress (cycles > 100)
            st2_df = train_df[train_df["cycle"] > 100]
            # Station 3: Mixed (cycles 60 to 100)
            st3_df = train_df[(train_df["cycle"] > 60) & (train_df["cycle"] <= 100)]
            
            # Generate sliding window dataset for each station
            self.station_loaders["STATION_001"] = self._create_loader(st1_df, is_train=True)
            self.station_loaders["STATION_002"] = self._create_loader(st2_df, is_train=True)
            self.station_loaders["STATION_003"] = self._create_loader(st3_df, is_train=True)
            
            # Test loader
            X_test, y_test = self._prepare_test_windows(test_df, rul_df)
            X_test_t = torch.tensor(X_test).transpose(1, 2)
            y_test_t = torch.tensor(y_test).unsqueeze(1)
            self.test_loader = DataLoader(TensorDataset(X_test_t, y_test_t), batch_size=BATCH_SIZE, shuffle=False)
            
            # Initialize Global Model
            num_channels = [32, 32, 32, 32]
            self.global_model = TCNModel(input_size=14, output_size=1, num_channels=num_channels, kernel_size=3, dropout=0.2).to(DEVICE)
            
            # Try to load existing trained model if available, else initialize random weights
            model_pt_path = os.path.abspath(os.path.join(os.path.dirname(__file__), "..", "models", "tcn_model.pt"))
            if os.path.exists(model_pt_path):
                self.global_model.load_state_dict(torch.load(model_pt_path, map_location=DEVICE))
                print("Loaded initial weights for Federated Learning from train_tcn model.")
            
            self.initialized = True
            print("Federated simulation initialized successfully.")
        except Exception as e:
            print(f"Error initializing federated simulation: {e}")
            
    def _create_loader(self, df, is_train=True):
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
            # If no unit has enough samples, pad
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

    def run_round(self):
        self.initialize()
        if not self.initialized:
            raise HTTPException(status_code=503, detail="Federated simulation is not initialized. Please ensure C-MAPSS dataset is loaded and training script has run.")
            
        self.current_round += 1
        print(f"\n--- Starting Federated Round {self.current_round} ---")
        
        # Save a copy of the global model parameters for FedProx proximal regularization
        global_params = [p.data.clone() for p in self.global_model.parameters()]
        
        station_weights = {}
        station_losses = {}
        
        criterion = nn.MSELoss()
        
        # Train locally on each station
        for station_id in ["STATION_001", "STATION_002", "STATION_003"]:
            loader = self.station_loaders.get(station_id)
            if loader is None:
                station_losses[station_id] = 0.0
                continue
                
            # Clone global model for local training
            # Instantiate local model and load weights to bypass copy.deepcopy weight_norm limitations
            num_channels = [32, 32, 32, 32]
            local_model = TCNModel(input_size=14, output_size=1, num_channels=num_channels, kernel_size=3, dropout=0.2).to(DEVICE)
            local_model.load_state_dict(self.global_model.state_dict())
            local_model.train()
            
            optimizer = optim.Adam(local_model.parameters(), lr=0.001)
            
            epoch_loss = 0.0
            total_samples = 0
            
            # Local training epochs
            for _ in range(LOCAL_EPOCHS):
                for batch_x, batch_y in loader:
                    batch_x, batch_y = batch_x.to(DEVICE), batch_y.to(DEVICE)
                    optimizer.zero_grad()
                    
                    pred = local_model(batch_x)
                    
                    # Core MSE loss
                    loss = criterion(pred, batch_y)
                    
                    # FedProx Proximal Regularization Penalty
                    proximal_penalty = 0.0
                    for param, glob_param in zip(local_model.parameters(), global_params):
                        proximal_penalty += torch.sum((param - glob_param) ** 2)
                        
                    total_loss = loss + (MU / 2.0) * proximal_penalty
                    total_loss.backward()
                    optimizer.step()
                    
                    epoch_loss += loss.item() * batch_x.size(0)
                    total_samples += batch_x.size(0)
            
            avg_loss = epoch_loss / total_samples if total_samples > 0 else 0.0
            station_losses[station_id] = avg_loss
            
            # Apply Local Differential Privacy (LDP)
            # Add Gaussian noise directly to local weights
            with torch.no_grad():
                for param in local_model.parameters():
                    noise = torch.normal(mean=0.0, std=SIGMA, size=param.size()).to(DEVICE)
                    param.add_(noise)
                    
            station_weights[station_id] = [p.data.clone() for p in local_model.parameters()]
            print(f"{station_id} local loss: {avg_loss:.4f}")
            
        # FedProx Aggregation: Average local weights to update the global model
        with torch.no_grad():
            for i, param in enumerate(self.global_model.parameters()):
                param.data.zero_()
                for station_id in station_weights:
                    param.data.add_(station_weights[station_id][i])
                param.data.div_(len(station_weights))
                
        # Evaluate global model on test set
        self.global_model.eval()
        global_test_loss = 0.0
        test_samples = 0
        with torch.no_grad():
            for batch_x, batch_y in self.test_loader:
                batch_x, batch_y = batch_x.to(DEVICE), batch_y.to(DEVICE)
                pred = self.global_model(batch_x)
                loss = criterion(pred, batch_y)
                global_test_loss += loss.item() * batch_x.size(0)
                test_samples += batch_x.size(0)
                
        avg_global_loss = global_test_loss / test_samples if test_samples > 0 else 0.0
        print(f"Global validation loss (MSE): {avg_global_loss:.4f}")
        
        # Save updated global model weights to models/tcn_model.pt
        model_pt_path = os.path.abspath(os.path.join(os.path.dirname(__file__), "..", "models", "tcn_model.pt"))
        torch.save(self.global_model.state_dict(), model_pt_path)
        
        # Re-export and quantize the model dynamically!
        # This propagates federated updates directly to the edge inference endpoint
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
            "message": f"Federated Round {self.current_round} aggregation complete. FedProx regularized and LDP-perturbed weights aggregated."
        }
        
        self.history.append(metrics)
        return metrics

# In-memory simulator singleton
federated_simulator = FederatedSimulationState()

@router.get("/history")
def get_federated_history():
    """Returns the history of completed federated rounds."""
    return federated_simulator.history

@router.post("/aggregate", response_model=FederatedMetricsResponse)
def perform_federation_round():
    """Triggers one federated learning round (local training + LDP + FedProx aggregation)."""
    metrics = federated_simulator.run_round()
    return metrics
