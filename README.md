# SentinelMRO: Decentralized Edge-AI & Immutable Audit Ledger for Aviation MRO

[![Python 3.11+](https://img.shields.io/badge/python-3.11+-blue.svg)](https://www.python.org/)
[![FastAPI](https://img.shields.io/badge/FastAPI-v0.100+-green.svg)](https://fastapi.tiangolo.com/)
[![Next.js 15](https://img.shields.io/badge/Next.js-15-black.svg)](https://nextjs.org/)
[![ONNX Runtime](https://img.shields.io/badge/ONNX-Runtime-blue.svg)](https://onnxruntime.ai/)
[![Cryptography](https://img.shields.io/badge/Security-Ed25519%20%7C%20MMR-orange.svg)](https://en.wikipedia.org/wiki/Merkle_tree)

SentinelMRO is a decentralized, privacy-preserving Edge-AI ecosystem designed for aircraft component Remaining Useful Life (RUL) prediction and cryptographically secure, tamper-evident maintenance logging. Engineered to replace legacy centralized cloud architectures, it provides local real-time edge processing, robust cross-station federated learning under non-IID conditions, and a cryptographic audit trail.

Developed for the **Tata Technologies InnoVent-27 competition (Category 3.2.3.3)**.

---

## 📐 System Architecture

```
                                  [ NASA C-MAPSS Stream ]
                                             │
                                             ▼
                        [ Edge Node: FastAPI + ONNX Runtime (INT8 TCN) ]
                                             │
             ┌───────────────────────────────┼───────────────────────────────┐
             ▼                               ▼                               ▼
    [ Real-Time Inference ]        [ Federated Learning ]          [ Security & Cryptography ]
   • RUL Regression Formula       • FedProx Optimization          • Ed25519 Payload Signing
   • Dynamic Anomaly Flag         • Local Differential Privacy    • Merkle Mountain Range Ledger
             │                               │                               │
             └───────────────────────────────┼───────────────────────────────┘
                                             ▼
                                 [ Next.js 15 UI Dashboard ]
```

### Key Subsystems
1. **Edge Inference Node (FastAPI & ONNX)**: Receives high-frequency multi-sensor telemetry, runs a quantized Temporal Convolutional Network (TCN) model locally, and returns predictions (RUL, health score, and anomalies) in under 15ms.
2. **Federated Optimization (FedProx & LDP)**: Coordinates cross-station model updates. It implements the **FedProx** optimization routine to handle non-IID station data distributions and adds **Local Differential Privacy (LDP)** (Gaussian noise) to protect gradients against model inversion attacks.
3. **Immutable Audit Ledger (Ed25519 & MMR)**: Maintenance logs are cryptographically signed at the edge using **Ed25519** keys. They are appended to a local SQLite-backed **Merkle Mountain Range (MMR)** ledger, allowing $O(\log n)$ integrity verification.
4. **Command Dashboard (Next.js 15 & React 19)**: An industrial-grade web UI providing live fleet telemetry, federated training metrics, and an interactive security console to test ecosystem integrity.

---

## 🛠️ Technical Stack

- **Backend & ML**: Python 3.11+, PyTorch (Model Development), ONNX Runtime (INT8 Dynamic Quantization), FastAPI, SQLite, NumPy, Pandas, Scikit-Learn.
- **Frontend & Dashboard**: Next.js 15 (App Router), React 19, Tailwind CSS, Lucide Icons, Recharts (Time-series Visualization), Shadcn UI.
- **Cryptography**: Ed25519 signing keys, Merkle Mountain Range (MMR) tree ledger.

---

## 📁 Repository Structure

```text
sentinelMRO/
├── backend/                  # FastAPI Backend & ML Scripts
│   ├── app/                  # FastAPI Application Code
│   │   ├── main.py           # API Router & Entrypoint
│   │   ├── ledger.py         # MMR Ledger & Database Operations
│   │   ├── federated.py      # FedProx Aggregator & LDP logic
│   │   ├── inference.py      # ONNX Model Inference Service
│   │   └── database.py       # SQLite connection setup
│   ├── models/               # PyTorch training & ONNX export scripts
│   │   ├── train_tcn.py      # PyTorch TCN model training
│   │   └── export_onnx.py    # ONNX export and INT8 quantization
│   ├── requirements.txt      # Python dependencies
│   └── tests/                # Verification tests for backend
│
├── frontend/                 # Next.js 15 Dashboard
│   ├── app/                  # App Router Pages & Layouts
│   ├── components/           # UI Elements & Recharts widgets
│   ├── package.json          # Node dependencies
│   └── tailwind.config.ts    # Tailwind styling config
│
├── data/                     # Local NASA C-MAPSS dataset (git-ignored)
├── README.md                 # Project Overview & Manual
└── .gitignore                # Target-specific ignore rules
```

---

## 🚀 Getting Started

### Prerequisites
- Python 3.11+
- Node.js 18+ (LTS)
- Git

### 1. Backend Setup & Training
```bash
# Navigate to backend directory
cd backend

# Create and activate virtual environment
python -m venv .venv
# On Windows:
.venv\Scripts\activate
# On Unix/macOS:
source .venv/bin/activate

# Install dependencies
pip install -r requirements.txt

# Run preprocessing & model training (this downloads C-MAPSS dataset automatically)
python models/train_tcn.py

# Export and quantize to ONNX
python models/export_onnx.py

# Start FastAPI server
uvicorn app.main:app --reload --port 8000
```

### 2. Frontend Setup
```bash
# Navigate to frontend directory
cd ../frontend

# Install packages
npm install

# Start Next.js development server
npm run dev
```
Open [http://localhost:3000](http://localhost:3000) to view the SentinelMRO dashboard.

---

## 🧪 Verification Protocol

- **Edge Inference**: Validated to run in < 15ms per step.
- **Federated Training**: Verification logs trace the FedProx proximal parameter ($\mu$) and LDP noise addition.
- **Ledger Verification**: The security terminal lets you query tree integrity and test the `/tamper` route to see how cryptographic seals detect database manipulations.
