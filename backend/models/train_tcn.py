import os
import json
import numpy as np
import pandas as pd
import torch
import torch.nn as nn
import torch.optim as optim
from torch.utils.data import TensorDataset, DataLoader
from torch.nn.utils import weight_norm
from download_data import download_dataset

# Configuration
WINDOW_SIZE = 30
MAX_RUL = 125
EPOCHS = 15
BATCH_SIZE = 64
LEARNING_RATE = 0.001
DEVICE = torch.device("cuda" if torch.cuda.is_available() else "cpu")

# Sensor columns mapping
# C-MAPSS has 26 columns: 1: unit, 2: cycle, 3-5: settings, 6-26: sensors 1-21
COLUMNS = ["unit", "cycle", "setting1", "setting2", "setting3"] + [f"s{i}" for i in range(1, 22)]

# Low variance sensors to drop
DROP_SENSORS = ["s1", "s5", "s6", "s10", "s16", "s18", "s19"]
KEEP_SENSORS = [f"s{i}" for i in range(1, 22) if f"s{i}" not in DROP_SENSORS] # 14 sensors

# Ensure data is downloaded
download_dataset()

# Locate directories
DATA_DIR = os.path.abspath(os.path.join(os.path.dirname(__file__), "..", "..", "data"))
TRAIN_PATH = os.path.join(DATA_DIR, "train_FD001.txt")
TEST_PATH = os.path.join(DATA_DIR, "test_FD001.txt")
RUL_PATH = os.path.join(DATA_DIR, "RUL_FD001.txt")

def load_data():
    print("Loading datasets...")
    train_df = pd.read_csv(TRAIN_PATH, sep=r"\s+", header=None, names=COLUMNS)
    test_df = pd.read_csv(TEST_PATH, sep=r"\s+", header=None, names=COLUMNS)
    rul_df = pd.read_csv(RUL_PATH, sep=r"\s+", header=None, names=["RUL"])
    rul_df.index = rul_df.index + 1 # 1-based indexing for units
    return train_df, test_df, rul_df

def compute_train_rul(df):
    # For training, RUL is cycles_left = max_cycle - current_cycle
    max_cycles = df.groupby("unit")["cycle"].max().reset_index()
    max_cycles.columns = ["unit", "max_cycle"]
    df = df.merge(max_cycles, on="unit")
    df["RUL"] = df["max_cycle"] - df["cycle"]
    # Piecewise linear RUL (constrain early stage to MAX_RUL)
    df["RUL"] = df["RUL"].clip(upper=MAX_RUL)
    df = df.drop(columns=["max_cycle"])
    return df

class MinMaxScalerCustom:
    def __init__(self):
        self.min_ = None
        self.scale_ = None
        self.data_min = None
        self.data_max = None

    def fit(self, df, columns):
        self.data_min = df[columns].min().values
        self.data_max = df[columns].max().values
        # Avoid division by zero
        range_val = self.data_max - self.data_min
        range_val[range_val == 0] = 1.0
        self.scale_ = 1.0 / range_val
        self.min_ = -self.data_min * self.scale_

    def transform(self, df, columns):
        df_copy = df.copy()
        for i, col in enumerate(columns):
            df_copy[col] = df_copy[col] * self.scale_[i] + self.min_[i]
        return df_copy

    def to_json(self, path):
        params = {
            "data_min": self.data_min.tolist(),
            "data_max": self.data_max.tolist(),
            "scale": self.scale_.tolist(),
            "min": self.min_.tolist()
        }
        with open(path, "w") as f:
            json.dump(params, f, indent=4)

def prepare_sliding_windows(df, scaler, sensor_cols, is_train=True, test_rul_df=None):
    X, y = [], []
    units = df["unit"].unique()
    
    scaled_df = scaler.transform(df, sensor_cols)
    
    for unit in units:
        unit_df = scaled_df[scaled_df["unit"] == unit]
        data = unit_df[sensor_cols].values
        
        if is_train:
            rul_vals = unit_df["RUL"].values
            n_samples = len(unit_df)
            if n_samples >= WINDOW_SIZE:
                for i in range(n_samples - WINDOW_SIZE + 1):
                    X.append(data[i : i + WINDOW_SIZE])
                    y.append(rul_vals[i + WINDOW_SIZE - 1])
        else:
            # For testing, we extract the LAST window for each engine to predict its final RUL
            n_samples = len(unit_df)
            if n_samples >= WINDOW_SIZE:
                X.append(data[-WINDOW_SIZE:])
                y.append(test_rul_df.loc[unit, "RUL"])
            else:
                # Pad with first row if engine has fewer than WINDOW_SIZE cycles
                padding = np.repeat(data[0:1], WINDOW_SIZE - n_samples, axis=0)
                padded_data = np.vstack([padding, data])
                X.append(padded_data)
                y.append(test_rul_df.loc[unit, "RUL"])
                
    return np.array(X, dtype=np.float32), np.array(y, dtype=np.float32)

# TCN Subcomponents
class Chomp1d(nn.Module):
    def __init__(self, chomp_size):
        super(Chomp1d, self).__init__()
        self.chomp_size = chomp_size

    def forward(self, x):
        return x[:, :, :-self.chomp_size].contiguous()

class TemporalBlock(nn.Module):
    def __init__(self, n_inputs, n_outputs, kernel_size, stride, dilation, padding, dropout=0.2):
        super(TemporalBlock, self).__init__()
        self.conv1 = weight_norm(nn.Conv1d(n_inputs, n_outputs, kernel_size,
                                           stride=stride, padding=padding, dilation=dilation))
        self.chomp1 = Chomp1d(padding)
        self.relu1 = nn.ReLU()
        self.dropout1 = nn.Dropout(dropout)

        self.conv2 = weight_norm(nn.Conv1d(n_outputs, n_outputs, kernel_size,
                                           stride=stride, padding=padding, dilation=dilation))
        self.chomp2 = Chomp1d(padding)
        self.relu2 = nn.ReLU()
        self.dropout2 = nn.Dropout(dropout)

        self.net = nn.Sequential(self.conv1, self.chomp1, self.relu1, self.dropout1,
                                 self.conv2, self.chomp2, self.relu2, self.dropout2)
        
        self.downsample = nn.Conv1d(n_inputs, n_outputs, 1) if n_inputs != n_outputs else None
        self.relu = nn.ReLU()
        self.init_weights()

    def init_weights(self):
        self.conv1.weight.data.normal_(0, 0.01)
        self.conv2.weight.data.normal_(0, 0.01)
        if self.downsample is not None:
            self.downsample.weight.data.normal_(0, 0.01)

    def forward(self, x):
        out = self.net(x)
        res = x if self.downsample is None else self.downsample(x)
        return self.relu(out + res)

class TemporalConvNet(nn.Module):
    def __init__(self, num_inputs, num_channels, kernel_size=3, dropout=0.2):
        super(TemporalConvNet, self).__init__()
        layers = []
        num_levels = len(num_channels)
        for i in range(num_levels):
            dilation_size = 2 ** i
            in_channels = num_inputs if i == 0 else num_channels[i-1]
            out_channels = num_channels[i]
            layers += [TemporalBlock(in_channels, out_channels, kernel_size, stride=1,
                                     dilation=dilation_size, padding=(kernel_size-1)*dilation_size,
                                     dropout=dropout)]
        self.network = nn.Sequential(*layers)

    def forward(self, x):
        return self.network(x)

class TCNModel(nn.Module):
    def __init__(self, input_size, output_size, num_channels, kernel_size=3, dropout=0.2):
        super(TCNModel, self).__init__()
        self.tcn = TemporalConvNet(input_size, num_channels, kernel_size=kernel_size, dropout=dropout)
        self.linear = nn.Linear(num_channels[-1], output_size)

    def forward(self, x):
        # x shape: (batch, input_size, seq_len)
        y1 = self.tcn(x)
        # Output shape: (batch, hidden_dim, seq_len) -> take last cycle
        out = self.linear(y1[:, :, -1])
        return out

def main():
    train_df, test_df, rul_df = load_data()
    
    # Preprocess train RUL
    train_df = compute_train_rul(train_df)
    
    # Fit scaler on training set
    scaler = MinMaxScalerCustom()
    scaler.fit(train_df, KEEP_SENSORS)
    
    # Save scaler parameters to backend/app/scaler_params.json
    app_dir = os.path.abspath(os.path.join(os.path.dirname(__file__), "..", "app"))
    os.makedirs(app_dir, exist_ok=True)
    scaler.to_json(os.path.join(app_dir, "scaler_params.json"))
    print("Scaler parameters saved to app/scaler_params.json")

    # Generate sliding window arrays
    X_train, y_train = prepare_sliding_windows(train_df, scaler, KEEP_SENSORS, is_train=True)
    X_test, y_test = prepare_sliding_windows(test_df, scaler, KEEP_SENSORS, is_train=False, test_rul_df=rul_df)
    
    print(f"Train shapes: X={X_train.shape}, y={y_train.shape}")
    print(f"Test shapes: X={X_test.shape}, y={y_test.shape}")
    
    # Create DataLoaders
    # PyTorch Conv1d wants: (batch, channel, length). So we need transpose (from batch, length, channel)
    X_train_torch = torch.tensor(X_train).transpose(1, 2)
    y_train_torch = torch.tensor(y_train).unsqueeze(1)
    X_test_torch = torch.tensor(X_test).transpose(1, 2)
    y_test_torch = torch.tensor(y_test).unsqueeze(1)
    
    train_loader = DataLoader(TensorDataset(X_train_torch, y_train_torch), batch_size=BATCH_SIZE, shuffle=True)
    
    # Model definition
    # 4 layers of channels, dilations: 1, 2, 4, 8
    num_channels = [32, 32, 32, 32]
    model = TCNModel(input_size=14, output_size=1, num_channels=num_channels, kernel_size=3, dropout=0.2).to(DEVICE)
    
    criterion = nn.MSELoss()
    optimizer = optim.Adam(model.parameters(), lr=LEARNING_RATE)
    
    print("Training TCN Model...")
    for epoch in range(1, EPOCHS + 1):
        model.train()
        epoch_loss = 0
        for batch_x, batch_y in train_loader:
            batch_x, batch_y = batch_x.to(DEVICE), batch_y.to(DEVICE)
            optimizer.zero_grad()
            pred = model(batch_x)
            loss = criterion(pred, batch_y)
            loss.backward()
            optimizer.step()
            epoch_loss += loss.item() * batch_x.size(0)
            
        train_mse = epoch_loss / len(X_train)
        
        # Test evaluation
        model.eval()
        with torch.no_grad():
            test_x_dev, test_y_dev = X_test_torch.to(DEVICE), y_test_torch.to(DEVICE)
            test_pred = model(test_x_dev)
            test_loss = criterion(test_pred, test_y_dev).item()
            test_rmse = np.sqrt(test_loss)
            
        print(f"Epoch {epoch:02d}/{EPOCHS:02d} | Train MSE: {train_mse:.4f} | Test MSE: {test_loss:.4f} | Test RMSE: {test_rmse:.4f}")
        
    # Save the PyTorch model
    model_save_path = os.path.join(os.path.dirname(__file__), "tcn_model.pt")
    torch.save(model.state_dict(), model_save_path)
    print(f"TCN model saved to {model_save_path}")

if __name__ == "__main__":
    main()
