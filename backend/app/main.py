import os
from fastapi import FastAPI
from fastapi.middleware.cors import CORSMiddleware
from contextlib import asynccontextmanager

from database import init_db
import ledger
import federated
import inference

@asynccontextmanager
async def lifespan(app: FastAPI):
    # Initialize SQLite schema
    init_db()
    # Try pre-initializing federated datasets if available
    import asyncio
    try:
        federated.federated_simulator.initialize()
        # Pre-connect local P2P stations during server start
        for st in ["STATION_001", "STATION_002", "STATION_003"]:
            asyncio.create_task(federated.station_client_loop(st))
    except Exception as e:
        print(f"Federated simulator pre-initialization postponed: {e}")
    yield

app = FastAPI(
    title="SentinelMRO API Gateway",
    description="Decentralized Edge-AI aircraft component health prediction & cryptographic ledger backend.",
    version="1.0.0",
    lifespan=lifespan
)

app.add_middleware(
    CORSMiddleware,
    allow_origins=[
        "http://localhost:3000",
        "http://127.0.0.1:3000",
        "http://localhost:3001",
        "http://127.0.0.1:3001",
        "http://localhost:3002",
        "http://127.0.0.1:3002",
        "http://localhost:5173",
        "http://127.0.0.1:5173",
    ],
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)

# Include API Routers
app.include_router(inference.router)
app.include_router(federated.router)
app.include_router(ledger.router)

@app.get("/")
def read_root():
    return {
        "status": "online",
        "service": "SentinelMRO API Gateway",
        "version": "1.0.0",
        "docs_url": "/docs"
    }

if __name__ == "__main__":
    import uvicorn
    uvicorn.run("main:app", host="0.0.0.0", port=8000, reload=True)
