import os
import torch
import torch.nn as nn
import onnx
import onnxruntime.quantization.quant_utils as quant_utils
from onnxruntime.quantization import quantize_dynamic, QuantType
from train_tcn import TCNModel
from torch.nn.utils import remove_weight_norm

# Monkey-patch: Bypass the file-based shape inference during quantization reload
# to avoid the buggy ONNX shape mismatch exception on Windows.
quant_utils.load_model_with_shape_infer = lambda path: onnx.load(str(path))
print("Monkey-patched ONNX Quantizer shape inference loader.")

def remove_weight_norm_recursive(model):
    """
    Recursively removes weight normalization hooks from all Conv1d layers
    in the PyTorch model to make it compatible with ONNX export.
    """
    count = 0
    for name, module in model.named_modules():
        if isinstance(module, nn.Conv1d):
            try:
                remove_weight_norm(module)
                count += 1
            except ValueError:
                pass
    print(f"Removed weight normalization hooks from {count} Conv1d layers.")

def export_and_quantize():
    current_dir = os.path.dirname(os.path.abspath(__file__))
    model_path = os.path.join(current_dir, "tcn_model.pt")
    
    if not os.path.exists(model_path):
        raise FileNotFoundError(f"Trained model weights not found at {model_path}. Please run train_tcn.py first.")
        
    print("Loading PyTorch model weights...")
    num_channels = [32, 32, 32, 32]
    model = TCNModel(input_size=14, output_size=1, num_channels=num_channels, kernel_size=3, dropout=0.2)
    model.load_state_dict(torch.load(model_path, map_location=torch.device('cpu')))
    model.eval()
    
    # Clean weight normalization hooks before export
    remove_weight_norm_recursive(model)
    
    # Export path
    onnx_path = os.path.join(current_dir, "tcn_model.onnx")
    
    # Dummy input representing (batch_size=1, channels=14, seq_len=30)
    dummy_input = torch.randn(1, 14, 30, dtype=torch.float32)
    
    print(f"Exporting model to ONNX at {onnx_path}...")
    torch.onnx.export(
        model,
        dummy_input,
        onnx_path,
        input_names=["input"],
        output_names=["output"],
        opset_version=18
    )
    
    # Verify the exported ONNX model
    onnx_model = onnx.load(onnx_path)
    onnx.checker.check_model(onnx_model)
    print("ONNX model structure checked successfully.")
    
    # Quantize to INT8
    quantized_path = os.path.join(current_dir, "tcn_model_quantized.onnx")
    print(f"Applying post-training dynamic INT8 quantization -> {quantized_path}...")
    
    quantize_dynamic(
        model_input=onnx_path,
        model_output=quantized_path,
        weight_type=QuantType.QUInt8,
        extra_options={
            "DisableShapeInference": True,
            "DefaultTensorType": onnx.TensorProto.FLOAT
        }
    )
    
    # Copy quantized model to backend/app/ directory for inference endpoint
    app_dir = os.path.abspath(os.path.join(current_dir, "..", "app"))
    os.makedirs(app_dir, exist_ok=True)
    target_quantized_path = os.path.join(app_dir, "tcn_model_quantized.onnx")
    
    import shutil
    shutil.copyfile(quantized_path, target_quantized_path)
    print(f"Quantized ONNX model copied to FastAPI deployment directory: {target_quantized_path}")

if __name__ == "__main__":
    export_and_quantize()
