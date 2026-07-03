import json
import numpy as np
import onnxruntime as ort

ONNX_PATH = "tcn_model_quantized.onnx"
SCALER_PATH = "scaler_params.json"

session = ort.InferenceSession(ONNX_PATH, providers=["CPUExecutionProvider"])
with open(SCALER_PATH, "r") as f:
    scaler = json.load(f)

scale = np.array(scaler["scale"], dtype=np.float32)
min_val = np.array(scaler["min"], dtype=np.float32)

def predict_for_cycle(next_cycle, engine_id):
    degradationFactor = 1.6 if engine_id == "ENG-003" else 1.1 if engine_id == "ENG-002" else 0.8
    
    simulatedMatrix = []
    for index in range(30):
        cycleIdx = next_cycle - 29 + index
        
        # We calculate sensor values with realistic trends and noise based on cycleIdx
        # degradationFactor increases the speed of degradation for ENG-002 and ENG-003
        effective_cycle = cycleIdx * degradationFactor
        
        row = [
            642.0 + (effective_cycle * 0.007) + 0.1,    # s2
            1585.0 + (effective_cycle * 0.08) + 0.5,    # s3
            1400.0 + (effective_cycle * 0.15) + 0.5,    # s4
            554.0 - (effective_cycle * 0.015) + 0.05,   # s7
            2388.0 + (effective_cycle * 0.001) + 0.01,  # s8
            9050.0 + (effective_cycle * 0.25) + 1.0,    # s9
            47.3 + (effective_cycle * 0.005) + 0.02,    # s11
            522.0 - (effective_cycle * 0.012) + 0.05,   # s12
            2388.0 + (effective_cycle * 0.001) + 0.01,  # s13
            8135.0 + (effective_cycle * 0.18) + 0.5,    # s14
            8.40 + (effective_cycle * 0.0007) + 0.002,  # s15
            392.0 + (effective_cycle * 0.025) + 0.2,    # s17
            38.95 - (effective_cycle * 0.003) + 0.02,   # s20
            23.4 - (effective_cycle * 0.002) + 0.02     # s21
        ]
        simulatedMatrix.append(row)
        
    arr = np.array(simulatedMatrix, dtype=np.float32)
    scaled_arr = arr * scale + min_val
    onnx_input = np.expand_dims(scaled_arr.T, axis=0)
    
    inputs = {session.get_inputs()[0].name: onnx_input}
    outputs = session.run(None, inputs)
    predicted_rul = float(outputs[0][0][0])
    predicted_rul = max(0.0, min(125.0, predicted_rul))
    rul_int = int(round(predicted_rul))
    health_score = float(predicted_rul / 125.0)
    return rul_int, health_score

print("ENG-001 (next_cycle=31):", predict_for_cycle(31, "ENG-001"))
print("ENG-002 (next_cycle=81):", predict_for_cycle(81, "ENG-002"))
print("ENG-003 (next_cycle=141):", predict_for_cycle(141, "ENG-003"))
