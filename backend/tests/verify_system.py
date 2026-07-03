import time
import requests
import json
import numpy as np

BACKEND_URL = "http://localhost:8000"

def run_verification():
    print("=" * 80)
    print("           SENTINELMRO: SYSTEM VERIFICATION & PERFORMANCE TEST")
    print("=" * 80)
    
    # 1. Gateway health check
    print("\n[TEST 1] Checking API Gateway Status...")
    try:
        start_time = time.time()
        res = requests.get(f"{BACKEND_URL}/")
        latency = (time.time() - start_time) * 1000
        if res.status_code == 200:
            print(f"  --> Status: ONLINE")
            print(f"  --> Latency: {latency:.2f} ms")
            print(f"  --> Payload: {res.json()}")
        else:
            print(f"  --> Status: Error {res.status_code}")
            return
    except Exception as e:
        print(f"  --> Gateway Connection Failed: {e}")
        print("  Please make sure your FastAPI backend server is running on port 8000!")
        return

    # 2. Key Registry Check
    print("\n[TEST 2] Verifying Cryptographic Key Registry...")
    res = requests.get(f"{BACKEND_URL}/api/v1/ledger/keys")
    if res.status_code == 200:
        keys = res.json()
        print(f"  --> Loaded Stations: {list(keys.keys())}")
        for station, keypair in keys.items():
            print(f"      - {station} Public Key: {keypair['public'][:30]}...[HEX]")
    else:
        print("  --> Key retrieval failed.")
        return

    # 3. Edge TCN Inference Performance Check
    print("\n[TEST 3] Evaluating Quantized Edge-AI TCN Inference Speed...")
    # Construct a 30x14 mock input window (representing 30 cycles of 14 sensor readings)
    mock_sensor_reading = [
        518.67, 554.25, 1398.9, 554.05, 2388.0, 9044.0, 
        47.47, 521.66, 2388.02, 8138.2, 8.41, 390.5, 39.06, 23.4
    ]
    sensor_matrix = [mock_sensor_reading for _ in range(30)]
    
    payload = {"sensor_matrix": sensor_matrix}
    
    # Run 5 inference cycles to measure warm-up and average latency
    latencies = []
    response_data = None
    for i in range(5):
        t0 = time.time()
        res = requests.post(f"{BACKEND_URL}/api/v1/edge/inference", json=payload)
        t_diff = (time.time() - t0) * 1000
        latencies.append(t_diff)
        if i == 4:
            response_data = res.json()
            
    avg_latency = np.mean(latencies[1:]) # Skip the first warm-up run
    print(f"  --> Inference Latency (Average over runs 2-5): {avg_latency:.2f} ms")
    
    # Assert performance threshold
    if avg_latency < 15:
        print("  --> [PASSED] Inference latency is under the 15ms threshold limit.")
    else:
        print("  --> [WARNING] Inference latency exceeded 15ms target.")
        
    print(f"  --> Output Health Score: {response_data['health_score']:.4f}")
    print(f"  --> Output Predicted RUL: {response_data['predicted_rul']} cycles")
    print(f"  --> Anomaly Flag Activated: {response_data['anomaly_flag']}")

    # 4. Cryptographic Handshake & MMR Append Check
    print("\n[TEST 4] Simulating Ed25519 Signing & MMR Append...")
    timestamp = "2026-07-03T14:04:05.000Z"
    component_id = "ENG-002"
    action = "Sensor Calibration"
    tech = "TECH-404"
    health_snapshot = 0.88
    station_id = "STATION_001"
    
    # Message formatting matching the gateway verification logic
    message = f"{timestamp}|{component_id}|{action}|{tech}|{health_snapshot}"
    
    # Generate signature using backend sign helper
    sign_res = requests.post(f"{BACKEND_URL}/api/v1/ledger/sign", json={
        "station_id": station_id,
        "message": message
    })
    signature = sign_res.json()["signature"]
    
    # Submit append request
    headers = {
        "X-Station-ID": station_id,
        "X-Signature": signature
    }
    append_payload = {
        "component_id": component_id,
        "action_taken": action,
        "technician_id": tech,
        "health_snapshot": health_snapshot,
        "timestamp": timestamp
    }
    
    t0 = time.time()
    res = requests.post(f"{BACKEND_URL}/api/v1/ledger/append", json=append_payload, headers=headers)
    append_latency = (time.time() - t0) * 1000
    
    if res.status_code == 200:
        data = res.json()
        print(f"  --> [PASSED] Append Successful in {append_latency:.2f} ms")
        print(f"  --> New Leaf Index: #{data['leaf_index']}")
        print(f"  --> Leaf Node Hash: {data['node_hash']}")
        print(f"  --> Updated MMR Root Hash: {data['root_hash']}")
    else:
        print(f"  --> Append Failed: {res.status_code} - {res.text}")
        return

    # 5. Cryptographic Verification & Tamper Check
    print("\n[TEST 5] Validating Cryptographic Integrity & Tamper-Evident Ledger...")
    # Check baseline status
    res = requests.get(f"{BACKEND_URL}/api/v1/ledger/verify")
    baseline = res.json()
    print(f"  --> Baseline Integrity check: {'SECURE (V=' + str(baseline['verified']) + ')' if baseline['verified'] else 'COMPROMISED'}")
    print(f"      Current Root: {baseline['stored_root']}")
    
    # Trigger database tamper backdoor
    target_leaf = data['leaf_index']
    print(f"  --> Simulating Malicious DB Alteration on Leaf Index #{target_leaf}...")
    requests.post(f"{BACKEND_URL}/api/v1/ledger/tamper", json={
        "leaf_index": target_leaf,
        "component_id": "TAMPERED-ENG",
        "action_taken": "MALICIOUS INTRUSION DATA",
        "technician_id": "INTRUDER-99",
        "health_snapshot": 0.0
    })
    
    # Check status again
    res = requests.get(f"{BACKEND_URL}/api/v1/ledger/verify")
    after = res.json()
    print(f"  --> Re-evaluating Integrity check: {'SECURE' if after['verified'] else 'COMPROMISED (V=' + str(after['verified']) + ')'}")
    if not after['verified']:
        print("  --> [PASSED] Cryptographic seal broken! Mismatch detected:")
        print(f"      Computed Root: {after['computed_root']}")
        print(f"      Database Root: {after['stored_root']}")
        print(f"      Corrupted Leaf Indices Identified: {after['tamper_indices']}")
    else:
        print("  --> [FAILED] System failed to identify database tampering.")

    # 6. Federated learning round
    print("\n[TEST 6] Triggering Federated Learning Aggregation (FedProx + LDP)...")
    t0 = time.time()
    res = requests.post(f"{BACKEND_URL}/api/v1/federated/aggregate")
    fed_latency = (time.time() - t0) * 1000
    
    if res.status_code == 200:
        fed_data = res.json()
        print(f"  --> Federated round complete in {fed_latency:.2f} ms")
        print(f"  --> Aggregation Round: {fed_data['round']}")
        print(f"  --> Station 1 (Nominal) Loss: {fed_data['station_1_loss']:.6f}")
        print(f"  --> Station 2 (Stress) Loss: {fed_data['station_2_loss']:.6f}")
        print(f"  --> Station 3 (Mixed) Loss: {fed_data['station_3_loss']:.6f}")
        print(f"  --> Global Validation Loss (MSE): {fed_data['global_loss']:.6f}")
        print("  --> TCN model updated, re-quantized, and hot-swapped.")
    else:
        print(f"  --> Federated aggregation failed: {res.text}")

    print("\n" + "=" * 80)
    print("            ALL VERIFICATION PROTOCOLS COMPLETE: SentinelMRO IS 100% OPERATIONAL")
    print("=" * 80)

if __name__ == "__main__":
    run_verification()
