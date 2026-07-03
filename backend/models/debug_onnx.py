import os
import onnx
import onnx.shape_inference

def debug_onnx():
    current_dir = os.path.dirname(os.path.abspath(__file__))
    onnx_path = os.path.join(current_dir, "tcn_model.onnx")
    
    if not os.path.exists(onnx_path):
        print(f"ONNX file not found at {onnx_path}")
        return
        
    model = onnx.load(onnx_path)
    print("Loaded ONNX model.")
    
    # Try step-by-step shape inference or print graph nodes
    for i, node in enumerate(model.graph.node):
        print(f"Node {i}: Op={node.op_type}, Inputs={node.input}, Outputs={node.output}")
        
    try:
        inferred = onnx.shape_inference.infer_shapes(model)
        print("Success! No shape inference error when running standalone in-memory shape inference.")
    except Exception as e:
        print(f"Shape inference failed: {e}")

if __name__ == "__main__":
    debug_onnx()
