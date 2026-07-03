import os
import json
import numpy as np
import onnxruntime as ort

MODEL_DIR = os.path.dirname(os.path.abspath(__file__))
ONNX_PATH = os.path.join(MODEL_DIR, "tcn_model_quantized.onnx")
SCALER_PATH = os.path.join(MODEL_DIR, "scaler_params.json")

print("ONNX Path exists:", os.path.exists(ONNX_PATH))
print("Scaler Path exists:", os.path.exists(SCALER_PATH))

try:
    session = ort.InferenceSession(ONNX_PATH, providers=["CPUExecutionProvider"])
    print("Model inputs:")
    for inp in session.get_inputs():
        print(inp.name, inp.shape, inp.type)
    print("Model outputs:")
    for out in session.get_outputs():
        print(out.name, out.shape, out.type)
        
    # Run mock inference with zeros
    dummy_input = np.zeros((1, 14, 30), dtype=np.float32)
    inputs = {session.get_inputs()[0].name: dummy_input}
    outputs = session.run(None, inputs)
    print("Outputs shape:", outputs[0].shape)
    print("Outputs value:", outputs[0])
except Exception as e:
    print("Error:", e)
