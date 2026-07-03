import sqlite3
import hashlib
import os

DB_PATH = "../ledger.db"
print("DB Path exists:", os.path.exists(DB_PATH))

def sha256_hash(data: str) -> str:
    return hashlib.sha256(data.encode('utf-8')).hexdigest()

try:
    conn = sqlite3.connect(DB_PATH)
    conn.row_factory = sqlite3.Row
    cursor = conn.cursor()
    
    print("\n--- MRO LEDGER ROWS ---")
    cursor.execute("SELECT * FROM mro_ledger")
    rows = cursor.fetchall()
    for r in rows:
        print(f"leaf_index: {r['leaf_index']}")
        print(f"  timestamp: {r['timestamp']}")
        print(f"  component_id: {r['component_id']}")
        print(f"  action_taken: {r['action_taken']}")
        print(f"  technician_id: {r['technician_id']}")
        print(f"  health_snapshot: {r['health_snapshot']}")
        print(f"  node_hash: {r['node_hash']}")
        
        # Calculate expected hash
        msg = f"{r['timestamp']}|{r['component_id']}|{r['action_taken']}|{r['technician_id']}|{r['health_snapshot']}"
        expected = sha256_hash(msg)
        print(f"  expected_hash: {expected}")
        print(f"  MATCH: {expected == r['node_hash']}")
        
    print("\n--- MMR NODES ---")
    cursor.execute("SELECT * FROM mmr_nodes")
    for r in cursor.fetchall():
        print(dict(r))
        
    conn.close()
except Exception as e:
    print("Error:", e)
