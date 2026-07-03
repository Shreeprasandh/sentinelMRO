import os
import sqlite3

DB_PATH = os.path.abspath(os.path.join(os.path.dirname(__file__), "..", "ledger.db"))

def get_db():
    conn = sqlite3.connect(DB_PATH)
    conn.row_factory = sqlite3.Row
    return conn

def init_db():
    conn = get_db()
    cursor = conn.cursor()
    
    # Create the mro_ledger table as specified in the blueprint
    cursor.execute("""
    CREATE TABLE IF NOT EXISTS mro_ledger (
        leaf_index INTEGER PRIMARY KEY,
        timestamp TEXT NOT NULL,
        component_id TEXT NOT NULL,
        action_taken TEXT NOT NULL,
        technician_id TEXT NOT NULL,
        health_snapshot REAL NOT NULL,
        node_hash TEXT NOT NULL
    );
    """)
    
    # Create the mmr_nodes table to store the internal nodes of the Merkle Mountain Range
    cursor.execute("""
    CREATE TABLE IF NOT EXISTS mmr_nodes (
        pos INTEGER PRIMARY KEY,
        hash TEXT NOT NULL,
        height INTEGER NOT NULL,
        is_leaf INTEGER NOT NULL
    );
    """)
    
    conn.commit()
    conn.close()
    print(f"Database initialized at: {DB_PATH}")

if __name__ == "__main__":
    init_db()
