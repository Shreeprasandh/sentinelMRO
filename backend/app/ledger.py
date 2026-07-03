import os
import json
import hashlib
import sqlite3
from fastapi import APIRouter, Header, HTTPException, Depends, Response
from pydantic import BaseModel
from cryptography.hazmat.primitives.asymmetric import ed25519
from database import get_db

router = APIRouter(prefix="/api/v1/ledger", tags=["Ledger"])

from hsm import hsm_enclave

# Model definition for append payload
class MaintenanceRecord(BaseModel):
    component_id: str
    action_taken: str
    technician_id: str
    health_snapshot: float
    timestamp: str

class TamperPayload(BaseModel):
    leaf_index: int
    component_id: str
    action_taken: str
    technician_id: str
    health_snapshot: float

def verify_signature(station_id: str, signature_hex: str, message: str) -> bool:
    registry = hsm_enclave.get_public_registry()
    if station_id not in registry:
        return False
    try:
        pub_bytes = bytes.fromhex(registry[station_id]["public"])
        pub_key = ed25519.Ed25519PublicKey.from_public_bytes(pub_bytes)
        pub_key.verify(bytes.fromhex(signature_hex), message.encode('utf-8'))
        return True
    except Exception:
        return False

# MMR helpers
def sha256_hash(data: str) -> str:
    return hashlib.sha256(data.encode('utf-8')).hexdigest()

def rebuild_mmr_tree(conn):
    """
    Reads all rows in mro_ledger, rebuilds the MMR tree,
    re-populates the mmr_nodes table, and returns the root hash.
    """
    cursor = conn.cursor()
    # Fetch all records ordered by leaf_index
    cursor.execute("SELECT leaf_index, timestamp, component_id, action_taken, technician_id, health_snapshot FROM mro_ledger ORDER BY leaf_index ASC")
    rows = cursor.fetchall()
    
    # Clear current mmr_nodes table
    cursor.execute("DELETE FROM mmr_nodes")
    
    if not rows:
        return ""
        
    stack = [] # holds nodes: {'pos': pos, 'height': height, 'hash': hash}
    next_pos = 1
    
    for row in rows:
        # Construct the payload message and compute leaf hash
        msg = f"{row['timestamp']}|{row['component_id']}|{row['action_taken']}|{row['technician_id']}|{row['health_snapshot']}"
        leaf_hash = sha256_hash(msg)
        
        # Save leaf hash in the ledger table for consistency check
        cursor.execute("UPDATE mro_ledger SET node_hash = ? WHERE leaf_index = ?", (leaf_hash, row['leaf_index']))
        
        # Push leaf to MMR stack
        node = {'pos': next_pos, 'height': 0, 'hash': leaf_hash, 'is_leaf': 1}
        cursor.execute("INSERT INTO mmr_nodes (pos, hash, height, is_leaf) VALUES (?, ?, ?, ?)", 
                       (node['pos'], node['hash'], node['height'], node['is_leaf']))
        stack.append(node)
        next_pos += 1
        
        # Merge peaks of same height
        while len(stack) >= 2 and stack[-1]['height'] == stack[-2]['height']:
            right = stack.pop()
            left = stack.pop()
            
            parent_hash = sha256_hash(left['hash'] + right['hash'])
            parent_node = {'pos': next_pos, 'height': right['height'] + 1, 'hash': parent_hash, 'is_leaf': 0}
            
            cursor.execute("INSERT INTO mmr_nodes (pos, hash, height, is_leaf) VALUES (?, ?, ?, ?)", 
                           (parent_node['pos'], parent_node['hash'], parent_node['height'], parent_node['is_leaf']))
            stack.append(parent_node)
            next_pos += 1
            
    conn.commit()
    
    # Calculate root from peaks
    if not stack:
        return ""
    elif len(stack) == 1:
        return stack[0]['hash']
    else:
        # Chain peaks from right to left
        curr = stack[-1]['hash']
        for peak in reversed(stack[:-1]):
            curr = sha256_hash(peak['hash'] + curr)
        return curr

def get_root_from_stored_hashes(conn):
    """Calculates the MMR root hash in-memory from stored node_hashes without database modifications."""
    cursor = conn.cursor()
    cursor.execute("SELECT node_hash FROM mro_ledger ORDER BY leaf_index ASC")
    hashes = [r["node_hash"] for r in cursor.fetchall()]
    if not hashes:
        return ""
        
    stack = []
    next_pos = 1
    for h in hashes:
        stack.append({'pos': next_pos, 'height': 0, 'hash': h})
        next_pos += 1
        while len(stack) >= 2 and stack[-1]['height'] == stack[-2]['height']:
            right = stack.pop()
            left = stack.pop()
            parent_hash = sha256_hash(left['hash'] + right['hash'])
            stack.append({'pos': next_pos, 'height': right['height'] + 1, 'hash': parent_hash})
            next_pos += 1
            
    if not stack:
        return ""
    if len(stack) == 1:
        return stack[0]['hash']
    
    curr = stack[-1]['hash']
    for peak in reversed(stack[:-1]):
        curr = sha256_hash(peak['hash'] + curr)
    return curr

# Endpoints
@router.get("/keys")
def get_station_keys():
    """Returns the simulated public key registry from the HSM Enclave."""
    return hsm_enclave.get_public_registry()

@router.get("/history")
def get_ledger_history(response: Response, db = Depends(get_db)):
    """Returns all rows in the ledger and the current MMR root."""
    response.headers["Cache-Control"] = "no-cache, no-store, must-revalidate"
    response.headers["Pragma"] = "no-cache"
    response.headers["Expires"] = "0"
    cursor = db.cursor()
    cursor.execute("SELECT leaf_index, timestamp, component_id, action_taken, technician_id, health_snapshot, node_hash FROM mro_ledger ORDER BY leaf_index ASC")
    records = [dict(row) for row in cursor.fetchall()]
    
    # Compute current root hash
    cursor.execute("SELECT pos, hash, height, is_leaf FROM mmr_nodes ORDER BY pos ASC")
    nodes = [dict(row) for row in cursor.fetchall()]
    
    # Use dry-run calculation to avoid auto-healing database tampering
    root_hash = get_root_from_stored_hashes(db)
    
    return {
        "records": records,
        "nodes": nodes,
        "root_hash": root_hash
    }

@router.post("/append")
def append_ledger_record(
    record: MaintenanceRecord,
    x_station_id: str = Header(...),
    x_signature: str = Header(...),
    db = Depends(get_db)
):
    # Verify signature
    msg = f"{record.timestamp}|{record.component_id}|{record.action_taken}|{record.technician_id}|{record.health_snapshot}"
    if not verify_signature(x_station_id, x_signature, msg):
        raise HTTPException(status_code=401, detail="Cryptographic payload signature validation failed.")
        
    cursor = db.cursor()
    
    # Insert new record (node_hash will be updated by rebuild_mmr_tree)
    cursor.execute("""
    INSERT INTO mro_ledger (timestamp, component_id, action_taken, technician_id, health_snapshot, node_hash)
    VALUES (?, ?, ?, ?, ?, '')
    """, (record.timestamp, record.component_id, record.action_taken, record.technician_id, record.health_snapshot))
    db.commit()
    
    # Prune ledger: Keep only the most recent 15 records to save space and keep DAG clean
    cursor.execute("""
    DELETE FROM mro_ledger WHERE leaf_index NOT IN (
        SELECT leaf_index FROM mro_ledger ORDER BY leaf_index DESC LIMIT 15
    )
    """)
    db.commit()
    
    # Get the assigned leaf_index
    leaf_index = cursor.lastrowid
    
    # Rebuild MMR and calculate new root hash
    root_hash = rebuild_mmr_tree(db)
    
    # Fetch the node hash of the newly inserted leaf
    cursor.execute("SELECT node_hash FROM mro_ledger WHERE leaf_index = ?", (leaf_index,))
    node_hash = cursor.fetchone()["node_hash"]
    
    db.close()
    
    return {
        "status": "success",
        "leaf_index": leaf_index,
        "node_hash": node_hash,
        "root_hash": root_hash
    }

@router.get("/verify")
def verify_ledger(response: Response, db = Depends(get_db)):
    """
    Verifies ecosystem integrity by comparing the saved node_hashes in mro_ledger
    with the computed hashes based on raw column data, and rebuilding the MMR.
    """
    response.headers["Cache-Control"] = "no-cache, no-store, must-revalidate"
    response.headers["Pragma"] = "no-cache"
    response.headers["Expires"] = "0"
    cursor = db.cursor()
    cursor.execute("SELECT leaf_index, timestamp, component_id, action_taken, technician_id, health_snapshot, node_hash FROM mro_ledger ORDER BY leaf_index ASC")
    rows = cursor.fetchall()
    
    if not rows:
        return {
            "verified": True,
            "message": "Ledger is empty.",
            "computed_root": "",
            "stored_root": ""
        }
        
    # Rebuild tree from current database state
    stack = []
    next_pos = 1
    tampered_indices = []
    
    for row in rows:
        # Recompute hash from raw columns
        msg = f"{row['timestamp']}|{row['component_id']}|{row['action_taken']}|{row['technician_id']}|{row['health_snapshot']}"
        expected_hash = sha256_hash(msg)
        
        # Verify if it matches the stored leaf hash
        if expected_hash != row['node_hash']:
            tampered_indices.append(row['leaf_index'])
            
        node = {'pos': next_pos, 'height': 0, 'hash': expected_hash}
        stack.append(node)
        next_pos += 1
        
        while len(stack) >= 2 and stack[-1]['height'] == stack[-2]['height']:
            right = stack.pop()
            left = stack.pop()
            parent_hash = sha256_hash(left['hash'] + right['hash'])
            parent_node = {'pos': next_pos, 'height': right['height'] + 1, 'hash': parent_hash}
            stack.append(parent_node)
            next_pos += 1
            
    # Compute root hash
    if len(stack) == 1:
        computed_root = stack[0]['hash']
    else:
        curr = stack[-1]['hash']
        for peak in reversed(stack[:-1]):
            curr = sha256_hash(peak['hash'] + curr)
        computed_root = curr
        
    # Now let's see what is currently stored in mmr_nodes
    # We rebuild the stored root directly from the stored mmr_nodes tree
    # Fetch stored peaks. In mmr_nodes, the peaks of size N can be computed.
    # To keep it simple, we can run rebuild_mmr_tree on a separate dry connection to see the "legit" root,
    # or just read the max pos hash.
    # Since rebuild_mmr_tree writes to the database, we can check if there are any differences.
    # If tampered_indices is not empty, it's definitely tampered!
    verified = (len(tampered_indices) == 0)
    
    # We can also compare computed_root with the stored MMR root.
    # To find the stored root: we fetch the peaks of the stored mmr_nodes.
    # If the user tampered the data via the /tamper endpoint, the columns are modified but the mmr_nodes hashes and the node_hash remain the old ones.
    # So expected_hash (computed_root) won't match the database's stored_root!
    # Let's get the stored root hash.
    # We can get the stored peaks by simulating the MMR on the stored node_hashes
    cursor.execute("SELECT node_hash FROM mro_ledger ORDER BY leaf_index ASC")
    stored_leaf_hashes = [r["node_hash"] for r in cursor.fetchall()]
    
    stored_stack = []
    s_next_pos = 1
    for lh in stored_leaf_hashes:
        stored_stack.append({'pos': s_next_pos, 'height': 0, 'hash': lh})
        s_next_pos += 1
        while len(stored_stack) >= 2 and stored_stack[-1]['height'] == stored_stack[-2]['height']:
            s_right = stored_stack.pop()
            s_left = stored_stack.pop()
            s_parent_hash = sha256_hash(s_left['hash'] + s_right['hash'])
            stored_stack.append({'pos': s_next_pos, 'height': s_right['height'] + 1, 'hash': s_parent_hash})
            s_next_pos += 1
            
    if not stored_stack:
        stored_root = ""
    elif len(stored_stack) == 1:
        stored_root = stored_stack[0]['hash']
    else:
        s_curr = stored_stack[-1]['hash']
        for s_peak in reversed(stored_stack[:-1]):
            s_curr = sha256_hash(s_peak['hash'] + s_curr)
        stored_root = s_curr
        
    if computed_root != stored_root:
        verified = False
        
    return {
        "verified": verified,
        "tampered_indices": tampered_indices,
        "computed_root": computed_root,
        "stored_root": stored_root,
        "message": "Ecosystem integrity validated." if verified else "Cryptographic integrity violation detected! Database has been tampered."
    }

@router.post("/tamper")
def tamper_ledger(payload: TamperPayload, db = Depends(get_db)):
    """
    Backdoor utility route.
    Directly updates raw table values of a row without recalculating its node_hash or MMR tree.
    """
    cursor = db.cursor()
    cursor.execute("SELECT leaf_index FROM mro_ledger WHERE leaf_index = ?", (payload.leaf_index,))
    row = cursor.fetchone()
    if not row:
        raise HTTPException(status_code=404, detail="Leaf index not found.")
        
    # Update raw table values without updating node_hash or mmr_nodes
    cursor.execute("""
    UPDATE mro_ledger
    SET component_id = ?, action_taken = ?, technician_id = ?, health_snapshot = ?
    WHERE leaf_index = ?
    """, (payload.component_id, payload.action_taken, payload.technician_id, payload.health_snapshot, payload.leaf_index))
    
    db.commit()
    db.close()
    
    return {
        "status": "tampered",
        "leaf_index": payload.leaf_index,
        "message": "Row values updated. MMR nodes left unchanged to simulate malicious injection."
    }

class SignPayload(BaseModel):
    station_id: str
    message: str

@router.post("/sign")
def sign_payload(payload: SignPayload):
    """
    Signs a message using the secure HSM Enclave simulator.
    """
    try:
        signature = hsm_enclave.secure_sign(payload.station_id, payload.message)
        return {"signature": signature}
    except ValueError as e:
        raise HTTPException(status_code=400, detail=str(e))
    except PermissionError as e:
        raise HTTPException(status_code=403, detail=str(e))
    except Exception as e:
        raise HTTPException(status_code=500, detail=f"Error signing payload: {e}")

