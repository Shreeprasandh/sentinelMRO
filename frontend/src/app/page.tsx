"use client";

import React, { useState, useEffect } from "react";
import { 
  Activity, 
  Shield, 
  Cpu, 
  Database, 
  AlertTriangle, 
  CheckCircle, 
  Play, 
  RefreshCw, 
  Layers, 
  User, 
  Clock, 
  Terminal,
  Settings,
  TrendingDown
} from "lucide-react";
import {
  LineChart,
  Line,
  XAxis,
  YAxis,
  CartesianGrid,
  Tooltip,
  Legend,
  ResponsiveContainer,
  ReferenceLine
} from "recharts";

// Types
interface EngineData {
  id: string;
  name: string;
  status: "Nominal" | "Warning" | "Critical";
  health: number; // 0 to 1
  rul: number;
  cycle: number;
  history: {
    cycle: number;
    rul: number;
    sensor_11: number; // Core speed trend
    sensor_12: number; // Bypass ratio trend
  }[];
}

interface LedgerRecord {
  leaf_index: number;
  timestamp: string;
  component_id: string;
  action_taken: str;
  technician_id: str;
  health_snapshot: number;
  node_hash: string;
}

interface FederatedRound {
  round: number;
  station_1_loss: number;
  station_2_loss: number;
  station_3_loss: number;
  global_loss: number;
}

const BACKEND_URL = "http://localhost:8000";

// Pre-seeded local engine simulators
const INITIAL_ENGINES: Record<string, EngineData> = {
  "ENG-001": {
    id: "ENG-001",
    name: "HPC Turbofan Alpha",
    status: "Nominal",
    health: 0.96,
    rul: 120,
    cycle: 30,
    history: Array.from({ length: 30 }, (_, i) => {
      const c = i + 1;
      return {
        cycle: c,
        rul: 125,
        sensor_11: 1500 + c * 0.1 + Math.random() * 2,
        sensor_12: 8.4 + c * 0.001 + Math.random() * 0.01,
      };
    })
  },
  "ENG-002": {
    id: "ENG-002",
    name: "HPC Turbofan Bravo",
    status: "Warning",
    health: 0.52,
    rul: 65,
    cycle: 80,
    history: Array.from({ length: 30 }, (_, i) => {
      const c = i + 51;
      return {
        cycle: c,
        rul: 125 - (c - 50) * 1.2,
        sensor_11: 1508 + c * 0.25 + Math.random() * 3,
        sensor_12: 8.42 + c * 0.002 + Math.random() * 0.01,
      };
    })
  },
  "ENG-003": {
    id: "ENG-003",
    name: "HPC Turbofan Charlie",
    status: "Critical",
    health: 0.18,
    rul: 22,
    cycle: 140,
    history: Array.from({ length: 30 }, (_, i) => {
      const c = i + 111;
      return {
        cycle: c,
        rul: 60 - (c - 110) * 1.4,
        sensor_11: 1530 + c * 0.4 + Math.random() * 4,
        sensor_12: 8.52 + c * 0.003 + Math.random() * 0.02,
      };
    })
  }
};

export default function Dashboard() {
  const [mounted, setMounted] = useState(false);
  const [engines, setEngines] = useState<Record<string, EngineData>>(INITIAL_ENGINES);
  const [selectedEngineId, setSelectedEngineId] = useState<string>("ENG-001");
  const [activeTab, setActiveTab] = useState<"fleet" | "federated" | "ledger">("fleet");
  
  // Backend statuses
  const [backendOnline, setBackendOnline] = useState(false);
  const [isInferring, setIsInferring] = useState(false);
  const [isFederating, setIsFederating] = useState(false);
  const [isVerifying, setIsVerifying] = useState(false);
  
  // Ledger states
  const [ledgerHistory, setLedgerHistory] = useState<LedgerRecord[]>([]);
  const [rootHash, setRootHash] = useState<string>("");
  const [nodes, setNodes] = useState<any[]>([]);
  const [verificationResult, setVerificationResult] = useState<{
    verified: boolean | null;
    message: string;
    computed_root: string;
    stored_root: string;
  }>({ verified: null, message: "", computed_root: "", stored_root: "" });

  // Federated learning states
  const [federatedHistory, setFederatedHistory] = useState<FederatedRound[]>([]);

  // Manual Append Form States
  const [formEngine, setFormEngine] = useState("ENG-001");
  const [formAction, setFormAction] = useState("Sensor Calibration");
  const [formTech, setFormTech] = useState("TECH-948");
  const [formHealth, setFormHealth] = useState("0.95");
  const [formStation, setFormStation] = useState("STATION_001");
  const [formSuccessMessage, setFormSuccessMessage] = useState("");

  useEffect(() => {
    setMounted(true);
    checkBackendHealth();
    fetchLedgerHistory();
    fetchFederatedHistory();
  }, []);

  const checkBackendHealth = async () => {
    try {
      const res = await fetch(`${BACKEND_URL}/`);
      if (res.ok) {
        setBackendOnline(true);
      } else {
        setBackendOnline(false);
      }
    } catch {
      setBackendOnline(false);
    }
  };

  const fetchLedgerHistory = async () => {
    try {
      const res = await fetch(`${BACKEND_URL}/api/v1/ledger/history`);
      if (res.ok) {
        const data = await res.json();
        setLedgerHistory(data.records || []);
        setRootHash(data.root_hash || "");
        setNodes(data.nodes || []);
      }
    } catch (e) {
      console.error("Failed to load ledger history:", e);
    }
  };

  const fetchFederatedHistory = async () => {
    try {
      const res = await fetch(`${BACKEND_URL}/api/v1/federated/history`);
      if (res.ok) {
        const data = await res.json();
        setFederatedHistory(data || []);
      }
    } catch (e) {
      console.error("Failed to load federated history:", e);
    }
  };

  const runFederatedRound = async () => {
    setIsFederating(true);
    try {
      const res = await fetch(`${BACKEND_URL}/api/v1/federated/aggregate`, {
        method: "POST"
      });
      if (res.ok) {
        const data = await res.json();
        setFederatedHistory(prev => [...prev, data]);
        fetchLedgerHistory(); // Ledger might be updated if model re-quantization writes records
      } else {
        alert("Federated round failed. Ensure backend has completed train_tcn setup.");
      }
    } catch (e) {
      alert("Error contacting aggregation server: " + e);
    } finally {
      setIsFederating(false);
    }
  };

  const verifyLedgerIntegrity = async () => {
    setIsVerifying(true);
    try {
      const res = await fetch(`${BACKEND_URL}/api/v1/ledger/verify`);
      if (res.ok) {
        const data = await res.json();
        setVerificationResult({
          verified: data.verified,
          message: data.message,
          computed_root: data.computed_root,
          stored_root: data.stored_root
        });
      }
    } catch (e) {
      setVerificationResult({
        verified: false,
        message: "Network error during verification: " + e,
        computed_root: "",
        stored_root: ""
      });
    } finally {
      setIsVerifying(false);
    }
  };

  const simulateTampering = async () => {
    if (ledgerHistory.length === 0) {
      alert("Ledger is empty. Please add a record first before tampering.");
      return;
    }
    
    // Target the last leaf index
    const targetIdx = ledgerHistory[ledgerHistory.length - 1].leaf_index;
    
    try {
      const res = await fetch(`${BACKEND_URL}/api/v1/ledger/tamper`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          leaf_index: targetIdx,
          component_id: "TAMPERED-ENG",
          action_taken: "MALICIOUS DATA INJECTION",
          technician_id: "INTRUDER-99",
          health_snapshot: 0.0
        })
      });
      
      if (res.ok) {
        alert(`Malicious update successfully injected into SQLite for Leaf #${targetIdx}! The node hashes and Merkle structure remain unchanged. Click 'Verify Ecosystem Integrity' to test.`);
        fetchLedgerHistory();
      }
    } catch (e) {
      alert("Error triggering tamper route: " + e);
    }
  };

  const handleManualAppend = async (e: React.FormEvent) => {
    e.preventDefault();
    setFormSuccessMessage("");
    
    const timestamp = new Date().toISOString();
    const healthNum = parseFloat(formHealth);
    
    // 1. Construct the payload message structure matching the backend verification
    const message = `${timestamp}|${formEngine}|${formAction}|${formTech}|${healthNum}`;
    
    try {
      // 2. Fetch cryptographic signature from the backend signing helper using station private key
      const signRes = await fetch(`${BACKEND_URL}/api/v1/ledger/sign`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          station_id: formStation,
          message: message
        })
      });
      
      if (!signRes.ok) {
        throw new Error("Failed to sign payload.");
      }
      
      const { signature } = await signRes.json();
      
      // 3. Post to append route with signature in headers (simulating mTLS validation)
      const appendRes = await fetch(`${BACKEND_URL}/api/v1/ledger/append`, {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          "X-Station-ID": formStation,
          "X-Signature": signature
        },
        body: JSON.stringify({
          component_id: formEngine,
          action_taken: formAction,
          technician_id: formTech,
          health_snapshot: healthNum,
          timestamp: timestamp
        })
      });
      
      if (appendRes.ok) {
        const data = await appendRes.json();
        setFormSuccessMessage(`Record appended at Leaf Index ${data.leaf_index}. Root Hash updated!`);
        fetchLedgerHistory();
      } else {
        const err = await appendRes.json();
        alert("Verification failed: " + err.detail);
      }
    } catch (err: any) {
      alert("Error: " + err.message);
    }
  };

  const streamNextCycle = async (engineId: string) => {
    setIsInferring(true);
    const engine = engines[engineId];
    const nextCycle = engine.cycle + 1;
    
    // Simulate degradation trends
    // Core speed climbs slightly, bypass ratio increases as engine wears out
    const degradationFactor = engineId === "ENG-003" ? 1.6 : engineId === "ENG-002" ? 1.1 : 0.8;
    const nextSensor11 = 1500 + nextCycle * 0.2 * degradationFactor + Math.random() * 3;
    const nextSensor12 = 8.4 + nextCycle * 0.002 * degradationFactor + Math.random() * 0.01;
    
    // We construct a mock 30x14 matrix representing the last 30 cycles
    // To make it fully functional for backend inference:
    // We populate the 14 sensors with realistic mock variations
    const simulatedMatrix = Array.from({ length: 30 }, (_, index) => {
      const cycleIdx = nextCycle - 29 + index;
      const progress = cycleIdx / 150.0;
      
      // Generate 14 sensors
      return [
        518.67 + Math.random(), // s2
        554.25 + cycleIdx * 0.05 + Math.random(), // s3
        1398.9 + cycleIdx * 0.15 + Math.random(), // s4
        554.05 - cycleIdx * 0.08 + Math.random(), // s7
        2388.0 + Math.random() * 0.05, // s8
        9044.0 + cycleIdx * 0.2 + Math.random() * 2, // s9
        47.47 + cycleIdx * 0.01 + Math.random() * 0.05, // s11
        521.66 - cycleIdx * 0.08 + Math.random(), // s12
        2388.02 + Math.random() * 0.04, // s13
        8138.2 + cycleIdx * 0.15 + Math.random() * 2, // s14
        8.41 + cycleIdx * 0.002 + Math.random() * 0.01, // s15
        390.5 + cycleIdx * 0.1 + Math.random(), // s17
        39.06 - cycleIdx * 0.01 + Math.random() * 0.05, // s20
        23.4 - cycleIdx * 0.005 + Math.random() * 0.05 // s21
      ];
    });

    try {
      const res = await fetch(`${BACKEND_URL}/api/v1/edge/inference`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ sensor_matrix: simulatedMatrix })
      });
      
      if (res.ok) {
        const result = await res.json();
        
        // Update history
        const newHistory = [...engine.history];
        if (newHistory.length >= 50) newHistory.shift(); // keep chart focused
        newHistory.push({
          cycle: nextCycle,
          rul: result.predicted_rul,
          sensor_11: nextSensor11,
          sensor_12: nextSensor12
        });

        // Set state
        const updatedEngine: EngineData = {
          ...engine,
          cycle: nextCycle,
          rul: result.predicted_rul,
          health: result.health_score,
          status: result.predicted_rul < 30 ? "Critical" : result.predicted_rul < 70 ? "Warning" : "Nominal",
          history: newHistory
        };

        setEngines(prev => ({
          ...prev,
          [engineId]: updatedEngine
        }));

        // If an anomaly is detected, automatically append to the ledger!
        if (result.anomaly_flag) {
          triggerAutoLedgerAppend(engineId, result.health_score, result.predicted_rul);
        }
      }
    } catch (e) {
      console.error("Inference request failed:", e);
    } finally {
      setIsInferring(false);
    }
  };

  const triggerAutoLedgerAppend = async (engineId: string, health: number, rul: number) => {
    const timestamp = new Date().toISOString();
    const action = `Automated Inspection Flag (RUL: ${rul})`;
    const tech = "EDGE-AI-AGENT";
    const station = "STATION_002"; // High stress node
    const message = `${timestamp}|${engineId}|${action}|${tech}|${health}`;

    try {
      const signRes = await fetch(`${BACKEND_URL}/api/v1/ledger/sign`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ station_id: station, message: message })
      });
      
      if (signRes.ok) {
        const { signature } = await signRes.json();
        await fetch(`${BACKEND_URL}/api/v1/ledger/append`, {
          method: "POST",
          headers: {
            "Content-Type": "application/json",
            "X-Station-ID": station,
            "X-Signature": signature
          },
          body: JSON.stringify({
            component_id: engineId,
            action_taken: action,
            technician_id: tech,
            health_snapshot: health,
            timestamp: timestamp
          })
        });
        fetchLedgerHistory();
      }
    } catch (e) {
      console.error("Auto ledger append failed:", e);
    }
  };

  const activeEngine = engines[selectedEngineId];

  // Helper colors
  const getStatusColor = (status: string) => {
    if (status === "Nominal") return "text-emerald-400 bg-emerald-500/10 border-emerald-500/30";
    if (status === "Warning") return "text-amber-400 bg-amber-500/10 border-amber-500/30";
    return "text-red-400 bg-red-500/10 border-red-500/30 animate-pulse";
  };

  const getHealthBarColor = (health: number) => {
    if (health >= 0.75) return "bg-emerald-500 shadow-emerald-500/50";
    if (health >= 0.35) return "bg-amber-500 shadow-amber-500/50";
    return "bg-red-500 shadow-red-500/50 animate-pulse";
  };

  return (
    <div className="flex-1 flex flex-col max-w-7xl mx-auto w-full p-4 md:p-6 space-y-6">
      
      {/* 1. Header with System Badges */}
      <header className="flex flex-col md:flex-row md:items-center justify-between border-b border-zinc-800 pb-5 gap-4">
        <div>
          <div className="flex items-center space-x-2">
            <Cpu className="h-7 w-7 text-indigo-400 animate-spin-slow" />
            <h1 className="text-3xl font-extrabold tracking-tight bg-gradient-to-r from-zinc-50 via-zinc-100 to-indigo-300 bg-clip-text text-transparent">
              SentinelMRO Command Center
            </h1>
          </div>
          <p className="text-sm text-zinc-400 mt-1">
            Decentralized Edge-AI Diagnostics & Cryptographic Merkle Mountain Range Audit Ledger
          </p>
        </div>

        <div className="flex items-center space-x-3 text-xs">
          <div className={`flex items-center space-x-2 border rounded-full px-3 py-1 bg-zinc-900 ${
            backendOnline ? "border-emerald-500/30 text-emerald-400" : "border-red-500/30 text-red-400"
          }`}>
            <span className={`h-2 w-2 rounded-full ${backendOnline ? "bg-emerald-400" : "bg-red-400 animate-ping"}`} />
            <span>API GATEWAY: {backendOnline ? "ONLINE" : "OFFLINE"}</span>
          </div>

          <div className="flex items-center space-x-2 border border-indigo-500/30 rounded-full px-3 py-1 bg-zinc-900 text-indigo-400">
            <Layers className="h-3 w-3" />
            <span>MMR LEAVES: {ledgerHistory.length}</span>
          </div>
        </div>
      </header>

      {/* Navigation tabs */}
      <div className="flex border-b border-zinc-800">
        <button 
          onClick={() => setActiveTab("fleet")}
          className={`px-5 py-3 text-sm font-medium border-b-2 transition-all ${
            activeTab === "fleet" 
              ? "border-indigo-500 text-indigo-400 bg-indigo-500/5" 
              : "border-transparent text-zinc-400 hover:text-zinc-200"
          }`}
        >
          <Activity className="h-4 w-4 inline mr-2" />
          Fleet Control & Telemetry
        </button>
        <button 
          onClick={() => setActiveTab("federated")}
          className={`px-5 py-3 text-sm font-medium border-b-2 transition-all ${
            activeTab === "federated" 
              ? "border-indigo-500 text-indigo-400 bg-indigo-500/5" 
              : "border-transparent text-zinc-400 hover:text-zinc-200"
          }`}
        >
          <Cpu className="h-4 w-4 inline mr-2" />
          Federated Training (FedProx & LDP)
        </button>
        <button 
          onClick={() => setActiveTab("ledger")}
          className={`px-5 py-3 text-sm font-medium border-b-2 transition-all ${
            activeTab === "ledger" 
              ? "border-indigo-500 text-indigo-400 bg-indigo-500/5" 
              : "border-transparent text-zinc-400 hover:text-zinc-200"
          }`}
        >
          <Shield className="h-4 w-4 inline mr-2" />
          Cryptographic Audit Ledger (MMR)
        </button>
      </div>

      {/* Main dashboard body tabs content */}
      <main className="space-y-6">
        
        {/* TAB 1: FLEET CONTROL & DEEP-DIVE TELEMETRY */}
        {activeTab === "fleet" && (
          <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
            
            {/* Left: Active Components List */}
            <div className="space-y-4 lg:col-span-1">
              <h2 className="text-lg font-bold text-zinc-300 flex items-center space-x-2">
                <Settings className="h-4 w-4 text-indigo-400" />
                <span>Active Aircraft Components</span>
              </h2>
              
              <div className="space-y-3">
                {Object.values(engines).map((eng) => (
                  <div
                    key={eng.id}
                    onClick={() => setSelectedEngineId(eng.id)}
                    className={`p-4 rounded-xl border cursor-pointer transition-all ${
                      selectedEngineId === eng.id 
                        ? "bg-zinc-900 border-indigo-500 shadow-lg shadow-indigo-500/10 scale-[1.02]" 
                        : "bg-zinc-900/60 border-zinc-800 hover:border-zinc-700"
                    }`}
                  >
                    <div className="flex items-center justify-between">
                      <h3 className="font-bold text-zinc-100">{eng.id}</h3>
                      <span className={`text-xs px-2.5 py-0.5 rounded-full border font-semibold ${getStatusColor(eng.status)}`}>
                        {eng.status}
                      </span>
                    </div>
                    <p className="text-xs text-zinc-400 mt-1">{eng.name}</p>
                    
                    <div className="mt-4 space-y-2">
                      <div className="flex justify-between text-xs font-semibold">
                        <span className="text-zinc-400">Health Index</span>
                        <span className="text-zinc-200">{(eng.health * 100).toFixed(0)}%</span>
                      </div>
                      <div className="h-1.5 w-full bg-zinc-800 rounded-full overflow-hidden">
                        <div 
                          className={`h-full rounded-full transition-all duration-500 ${getHealthBarColor(eng.health)}`}
                          style={{ width: `${eng.health * 100}%` }}
                        />
                      </div>
                    </div>

                    <div className="mt-4 flex items-center justify-between border-t border-zinc-800/80 pt-3 text-xs text-zinc-400">
                      <span>Inference Cycle: <strong className="text-zinc-200">{eng.cycle}</strong></span>
                      <span>RUL: <strong className="text-indigo-400">{eng.rul} cycles</strong></span>
                    </div>
                  </div>
                ))}
              </div>
            </div>

            {/* Right: Deep Dive Analytics and Live Streaming */}
            <div className="lg:col-span-2 space-y-6">
              <div className="bg-zinc-900 border border-zinc-800 rounded-xl p-5 md:p-6 space-y-4">
                
                <div className="flex flex-col md:flex-row md:items-center justify-between gap-4">
                  <div>
                    <h2 className="text-xl font-extrabold text-zinc-100">
                      Telemetry Stream & RUL Regression Plot
                    </h2>
                    <p className="text-xs text-zinc-400 mt-1">
                      Monitoring real-time predictions for <strong className="text-indigo-400">{activeEngine.id}</strong> ({activeEngine.name})
                    </p>
                  </div>
                  
                  <button
                    onClick={() => streamNextCycle(activeEngine.id)}
                    disabled={isInferring || !backendOnline}
                    className="flex items-center space-x-2 bg-indigo-600 hover:bg-indigo-500 disabled:opacity-50 text-white font-bold py-2.5 px-5 rounded-lg text-sm transition-all shadow-md shadow-indigo-600/35 active:scale-95"
                  >
                    <RefreshCw className={`h-4 w-4 ${isInferring ? "animate-spin" : ""}`} />
                    <span>{isInferring ? "Evaluating Edge AI..." : "Stream Next Cycle"}</span>
                  </button>
                </div>

                {/* Status Banners */}
                {activeEngine.rul < 30 && (
                  <div className="flex items-center space-x-3 bg-red-500/10 border border-red-500/30 text-red-400 p-3 rounded-lg text-sm animate-pulse">
                    <AlertTriangle className="h-5 w-5 shrink-0" />
                    <div>
                      <strong>CRITICAL COMPONENT ANOMALY:</strong> Remaining Useful Life (RUL) has dropped below 30 operational cycles. Safe threshold breached. Maintenance recommended immediately. Anomaly flag has triggered.
                    </div>
                  </div>
                )}

                {/* Recharts Container */}
                <div className="h-72 w-full mt-4 bg-zinc-950/40 p-2 border border-zinc-800/60 rounded-xl">
                  {mounted && (
                    <ResponsiveContainer width="100%" height="100%">
                      <LineChart data={activeEngine.history}>
                        <CartesianGrid strokeDasharray="3 3" stroke="#1f2937" />
                        <XAxis dataKey="cycle" stroke="#71717a" fontSize={11} label={{ value: 'Operational Cycles', position: 'insideBottomRight', offset: -5, fill: '#71717a' }} />
                        <YAxis yAxisId="left" stroke="#818cf8" fontSize={11} label={{ value: 'RUL (Cycles)', angle: -90, position: 'insideLeft', fill: '#818cf8' }} />
                        <YAxis yAxisId="right" orientation="right" stroke="#fbbf24" fontSize={11} label={{ value: 'Sensor Signals', angle: 90, position: 'insideRight', fill: '#fbbf24' }} />
                        <Tooltip contentStyle={{ backgroundColor: "#09090b", borderColor: "#27272a", color: "#f4f4f5" }} />
                        <Legend wrapperStyle={{ fontSize: 12 }} />
                        
                        <ReferenceLine yAxisId="left" y={30} stroke="#f87171" strokeDasharray="5 5" label={{ value: 'RUL Hazard limit (30)', fill: '#f87171', fontSize: 10, position: 'insideTopLeft' }} />
                        
                        <Line yAxisId="left" type="monotone" dataKey="rul" name="Predicted RUL" stroke="#818cf8" strokeWidth={2.5} dot={{ r: 3 }} activeDot={{ r: 6 }} />
                        <Line yAxisId="right" type="monotone" dataKey="sensor_11" name="Core Speed Temp" stroke="#f59e0b" strokeWidth={1.5} dot={false} />
                        <Line yAxisId="right" type="monotone" dataKey="sensor_12" name="Bypass Ratio" stroke="#10b981" strokeWidth={1.5} dot={false} />
                      </LineChart>
                    </ResponsiveContainer>
                  )}
                </div>

                <div className="grid grid-cols-2 md:grid-cols-4 gap-4 mt-4 text-xs bg-zinc-950/50 p-4 border border-zinc-800 rounded-lg">
                  <div className="space-y-1">
                    <span className="text-zinc-500 font-semibold uppercase block">Current Cycle</span>
                    <strong className="text-zinc-200 text-lg">{activeEngine.cycle}</strong>
                  </div>
                  <div className="space-y-1">
                    <span className="text-zinc-500 font-semibold uppercase block">Predicted RUL</span>
                    <strong className="text-indigo-400 text-lg">{activeEngine.rul} Cycles</strong>
                  </div>
                  <div className="space-y-1">
                    <span className="text-zinc-500 font-semibold uppercase block">Bypass Ratio</span>
                    <strong className="text-emerald-400 text-lg">
                      {activeEngine.history[activeEngine.history.length - 1].sensor_12.toFixed(3)}
                    </strong>
                  </div>
                  <div className="space-y-1">
                    <span className="text-zinc-500 font-semibold uppercase block">Core Speed Temp</span>
                    <strong className="text-amber-400 text-lg">
                      {activeEngine.history[activeEngine.history.length - 1].sensor_11.toFixed(1)} RPM
                    </strong>
                  </div>
                </div>

              </div>
            </div>

          </div>
        )}

        {/* TAB 2: FEDERATED MONITOR ROOM */}
        {activeTab === "federated" && (
          <div className="bg-zinc-900 border border-zinc-800 rounded-xl p-5 md:p-6 space-y-6">
            
            <div className="flex flex-col md:flex-row md:items-center justify-between gap-4 border-b border-zinc-800 pb-5">
              <div>
                <h2 className="text-2xl font-extrabold text-zinc-100 flex items-center space-x-2">
                  <Layers className="h-6 w-6 text-indigo-400" />
                  <span>Heterogeneous Federated Learning Simulation</span>
                </h2>
                <p className="text-xs text-zinc-400 mt-1">
                  Federation round updates global TCN weights across non-IID stations via FedProx (Tunable μ=0.01) + Local Differential Privacy (σ=0.001)
                </p>
              </div>

              <button
                onClick={runFederatedRound}
                disabled={isFederating || !backendOnline}
                className="flex items-center space-x-2 bg-indigo-600 hover:bg-indigo-500 disabled:opacity-50 text-white font-bold py-2.5 px-5 rounded-lg text-sm transition-all shadow-md shadow-indigo-600/35 active:scale-95"
              >
                <Play className={`h-4 w-4 ${isFederating ? "animate-spin" : ""}`} />
                <span>{isFederating ? "Running FedProx Optimizers..." : "Run Federated Round"}</span>
              </button>
            </div>

            <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
              
              {/* Station Parameters description */}
              <div className="lg:col-span-1 space-y-4">
                <h3 className="font-bold text-zinc-200 border-b border-zinc-800 pb-2">Federation Topology</h3>
                
                <div className="space-y-4 text-xs">
                  <div className="p-3 bg-zinc-950/60 border border-zinc-800 rounded-lg">
                    <strong className="text-indigo-300">Station 1: Early-Stage Nodes (Nominal)</strong>
                    <p className="text-zinc-400 mt-1">Telemetry contains primarily nominal startup cycles (Cycles ≤ 60). Low structural fatigue conditions.</p>
                  </div>
                  
                  <div className="p-3 bg-zinc-950/60 border border-zinc-800 rounded-lg">
                    <strong className="text-indigo-300">Station 2: Stress-State Nodes (Rapid Degradation)</strong>
                    <p className="text-zinc-400 mt-1">Telemetry contains engines in active wear states (Cycles &gt; 100). Focus on failure thresholds.</p>
                  </div>

                  <div className="p-3 bg-zinc-950/60 border border-zinc-800 rounded-lg">
                    <strong className="text-indigo-300">Station 3: Mixed Environment Nodes</strong>
                    <p className="text-zinc-400 mt-1">Telemetry contains mixed cycles (Cycles 60 to 100). General operational profiles.</p>
                  </div>
                  
                  <div className="p-3 bg-zinc-950/40 border border-zinc-800/80 rounded-lg space-y-2">
                    <strong className="text-zinc-300 flex items-center"><Terminal className="h-3 w-3 text-indigo-400 mr-2" /> Math Directives</strong>
                    <div className="text-[10px] font-mono text-indigo-300 space-y-1">
                      <div>Loss penalty: L_local(w) + 0.005*||w - w^t||^2</div>
                      <div>Privacy: w_priv = w_local + N(0, 1e-6)</div>
                    </div>
                  </div>
                </div>
              </div>

              {/* Training Convergence Plot */}
              <div className="lg:col-span-2 space-y-4">
                <h3 className="font-bold text-zinc-200">Global Training Convergence (MSE Loss)</h3>
                
                <div className="h-72 w-full bg-zinc-950/40 p-2 border border-zinc-800 rounded-xl">
                  {mounted && federatedHistory.length > 0 ? (
                    <ResponsiveContainer width="100%" height="100%">
                      <LineChart data={federatedHistory}>
                        <CartesianGrid strokeDasharray="3 3" stroke="#1f2937" />
                        <XAxis dataKey="round" stroke="#71717a" label={{ value: 'Federated Rounds', position: 'insideBottomRight', offset: -5, fill: '#71717a' }} />
                        <YAxis stroke="#71717a" label={{ value: 'MSE Loss', angle: -90, position: 'insideLeft', fill: '#71717a' }} />
                        <Tooltip contentStyle={{ backgroundColor: "#09090b", borderColor: "#27272a" }} />
                        <Legend />
                        <Line type="monotone" dataKey="station_1_loss" name="Station 1 Loss" stroke="#3b82f6" strokeWidth={1.5} />
                        <Line type="monotone" dataKey="station_2_loss" name="Station 2 Loss" stroke="#ef4444" strokeWidth={1.5} />
                        <Line type="monotone" dataKey="station_3_loss" name="Station 3 Loss" stroke="#f59e0b" strokeWidth={1.5} />
                        <Line type="monotone" dataKey="global_loss" name="Global Valid Loss" stroke="#818cf8" strokeWidth={3} dot={{ r: 4 }} />
                      </LineChart>
                    </ResponsiveContainer>
                  ) : (
                    <div className="h-full w-full flex items-center justify-center text-zinc-500 text-sm">
                      No federated rounds recorded yet. Click 'Run Federated Round' to begin local training simulation.
                    </div>
                  )}
                </div>
              </div>

            </div>

          </div>
        )}

        {/* TAB 3: IMMUTABLE AUDIT LEDGER */}
        {activeTab === "ledger" && (
          <div className="space-y-6">
            
            {/* Security controls */}
            <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
              
              {/* MMR Verification Console */}
              <div className="bg-zinc-900 border border-zinc-800 rounded-xl p-5 md:p-6 space-y-4">
                <h3 className="text-lg font-bold text-zinc-200 flex items-center space-x-2">
                  <Shield className="h-5 w-5 text-indigo-400" />
                  <span>Cryptographic Auditing Terminal</span>
                </h3>
                <p className="text-xs text-zinc-400">
                  Verify the append-only Merkle Mountain Range (MMR) ledger. Tamper-evident architecture detects any database payload modifications instantly.
                </p>

                <div className="flex space-x-3 mt-4">
                  <button
                    onClick={verifyLedgerIntegrity}
                    disabled={isVerifying || !backendOnline}
                    className="flex-1 flex items-center justify-center space-x-2 bg-emerald-600 hover:bg-emerald-500 disabled:opacity-50 text-white font-bold py-2.5 px-4 rounded-lg text-sm transition-all shadow-md shadow-emerald-600/35"
                  >
                    <CheckCircle className="h-4 w-4" />
                    <span>Verify Ecosystem Integrity</span>
                  </button>

                  <button
                    onClick={simulateTampering}
                    disabled={!backendOnline}
                    className="flex-1 flex items-center justify-center space-x-2 bg-red-950/60 hover:bg-red-950 border border-red-500/30 text-red-400 font-bold py-2.5 px-4 rounded-lg text-sm transition-all"
                  >
                    <AlertTriangle className="h-4 w-4 animate-pulse" />
                    <span>Simulate DB Injection</span>
                  </button>
                </div>

                {/* Verification result display */}
                {verificationResult.verified !== null && (
                  <div className={`p-4 rounded-xl border space-y-2 ${
                    verificationResult.verified 
                      ? "bg-emerald-500/10 border-emerald-500/30 text-emerald-400" 
                      : "bg-red-500/10 border-red-500/30 text-red-400"
                  }`}>
                    <div className="flex items-center space-x-2 font-bold text-sm">
                      {verificationResult.verified ? (
                        <>
                          <CheckCircle className="h-5 w-5" />
                          <span>INTEGRITY SECURE: ROOT SEAL INTACT</span>
                        </>
                      ) : (
                        <>
                          <AlertTriangle className="h-5 w-5 text-red-400 animate-bounce" />
                          <span>INTEGRITY COMPROMISED: CRITICAL ERROR</span>
                        </>
                      )}
                    </div>
                    <p className="text-xs text-zinc-300">{verificationResult.message}</p>
                    
                    <div className="text-[10px] font-mono border-t border-zinc-800/80 pt-2 space-y-1 text-zinc-400">
                      <div className="truncate">COMPUTED ROOT: {verificationResult.computed_root || "N/A"}</div>
                      <div className="truncate">DATABASE ROOT: {verificationResult.stored_root || "N/A"}</div>
                    </div>
                  </div>
                )}

                <div className="text-xs space-y-1.5 border border-zinc-800 bg-zinc-950/50 p-4 rounded-lg">
                  <div className="flex justify-between">
                    <span className="text-zinc-500">MMR ROOT HASH:</span>
                    <span className="font-mono text-[10px] text-indigo-400 select-all truncate max-w-xs">{rootHash || "Empty Ledger"}</span>
                  </div>
                </div>

              </div>

              {/* Add maintenance log */}
              <div className="bg-zinc-900 border border-zinc-800 rounded-xl p-5 md:p-6 space-y-4">
                <h3 className="text-lg font-bold text-zinc-200 flex items-center space-x-2">
                  <Database className="h-5 w-5 text-indigo-400" />
                  <span>Manual Ledger Record Entry (Client-Signed Payload)</span>
                </h3>
                
                <form onSubmit={handleManualAppend} className="grid grid-cols-2 gap-4 text-xs">
                  <div className="space-y-1.5">
                    <label className="text-zinc-400 font-semibold block">Component ID</label>
                    <select
                      value={formEngine}
                      onChange={(e) => setFormEngine(e.target.value)}
                      className="w-full bg-zinc-950 border border-zinc-850 p-2 rounded-lg text-zinc-200 focus:border-indigo-500 outline-none"
                    >
                      <option value="ENG-001">ENG-001 (Alpha)</option>
                      <option value="ENG-002">ENG-002 (Bravo)</option>
                      <option value="ENG-003">ENG-003 (Charlie)</option>
                    </select>
                  </div>

                  <div className="space-y-1.5">
                    <label className="text-zinc-400 font-semibold block">Inspection Station ID</label>
                    <select
                      value={formStation}
                      onChange={(e) => setFormStation(e.target.value)}
                      className="w-full bg-zinc-950 border border-zinc-850 p-2 rounded-lg text-zinc-200 focus:border-indigo-500 outline-none"
                    >
                      <option value="STATION_001">STATION_001 (Early stage)</option>
                      <option value="STATION_002">STATION_002 (Stress node)</option>
                      <option value="STATION_003">STATION_003 (Mixed node)</option>
                    </select>
                  </div>

                  <div className="space-y-1.5">
                    <label className="text-zinc-400 font-semibold block">Action Taken</label>
                    <select
                      value={formAction}
                      onChange={(e) => setFormAction(e.target.value)}
                      className="w-full bg-zinc-950 border border-zinc-850 p-2 rounded-lg text-zinc-200 focus:border-indigo-500 outline-none"
                    >
                      <option value="Sensor Calibration">Sensor Calibration</option>
                      <option value="Blade Replacement">Blade Replacement</option>
                      <option value="Oil Lubrication Refill">Oil Lubrication Refill</option>
                      <option value="Compressor Overhaul">Compressor Overhaul</option>
                    </select>
                  </div>

                  <div className="space-y-1.5">
                    <label className="text-zinc-400 font-semibold block">Technician ID</label>
                    <input
                      type="text"
                      value={formTech}
                      onChange={(e) => setFormTech(e.target.value)}
                      className="w-full bg-zinc-950 border border-zinc-850 p-2 rounded-lg text-zinc-200 focus:border-indigo-500 outline-none"
                    />
                  </div>

                  <div className="space-y-1.5">
                    <label className="text-zinc-400 font-semibold block">Health Snapshot (0.0 - 1.0)</label>
                    <input
                      type="number"
                      step="0.01"
                      value={formHealth}
                      onChange={(e) => setFormHealth(e.target.value)}
                      className="w-full bg-zinc-950 border border-zinc-850 p-2 rounded-lg text-zinc-200 focus:border-indigo-500 outline-none"
                    />
                  </div>

                  <div className="col-span-2 pt-2">
                    <button
                      type="submit"
                      disabled={!backendOnline}
                      className="w-full flex items-center justify-center space-x-2 bg-indigo-600 hover:bg-indigo-500 disabled:opacity-50 text-white font-bold py-2.5 px-4 rounded-lg transition-all"
                    >
                      <Layers className="h-4 w-4" />
                      <span>Sign (Ed25519) & Append to MMR</span>
                    </button>
                  </div>
                </form>

                {formSuccessMessage && (
                  <div className="p-3 bg-indigo-500/10 border border-indigo-500/30 text-indigo-400 rounded-lg text-xs font-semibold">
                    {formSuccessMessage}
                  </div>
                )}

              </div>

            </div>

            {/* Audit log table */}
            <div className="bg-zinc-900 border border-zinc-800 rounded-xl p-5 md:p-6 space-y-4">
              <h3 className="text-lg font-bold text-zinc-200 flex items-center space-x-2">
                <Database className="h-5 w-5 text-indigo-400" />
                <span>Immutable Maintenance Ledger Database</span>
              </h3>
              
              <div className="overflow-x-auto">
                <table className="w-full border-collapse text-xs text-left">
                  <thead>
                    <tr className="border-b border-zinc-800 text-zinc-500 font-semibold uppercase">
                      <th className="pb-3 pr-4">Leaf Index</th>
                      <th className="pb-3 px-4">Timestamp</th>
                      <th className="pb-3 px-4">Component ID</th>
                      <th className="pb-3 px-4">Action Taken</th>
                      <th className="pb-3 px-4">Technician ID</th>
                      <th className="pb-3 px-4">Health Snapshot</th>
                      <th className="pb-3 pl-4">Node Hash</th>
                    </tr>
                  </thead>
                  <tbody>
                    {ledgerHistory.length > 0 ? (
                      ledgerHistory.map((row) => (
                        <tr key={row.leaf_index} className="border-b border-zinc-850 hover:bg-zinc-950/20 text-zinc-300">
                          <td className="py-3.5 pr-4 font-bold text-indigo-400">#{row.leaf_index}</td>
                          <td className="py-3.5 px-4 font-mono text-[10px] text-zinc-400">
                            {new Date(row.timestamp).toLocaleTimeString()}<br/>
                            {new Date(row.timestamp).toLocaleDateString()}
                          </td>
                          <td className="py-3.5 px-4 font-bold text-zinc-200">{row.component_id}</td>
                          <td className="py-3.5 px-4">{row.action_taken}</td>
                          <td className="py-3.5 px-4 text-zinc-400 flex items-center"><User className="h-3.5 w-3.5 text-zinc-500 mr-1.5" />{row.technician_id}</td>
                          <td className="py-3.5 px-4 font-mono font-semibold">{(row.health_snapshot * 100).toFixed(0)}%</td>
                          <td className="py-3.5 pl-4 font-mono text-[9px] text-indigo-500/80 select-all truncate max-w-xs">{row.node_hash}</td>
                        </tr>
                      ))
                    ) : (
                      <tr>
                        <td colSpan={7} className="py-8 text-center text-zinc-500">
                          No maintenance logs found in the ledger database. Stream engine metrics or manually submit a signed log entry.
                        </td>
                      </tr>
                    )}
                  </tbody>
                </table>
              </div>

            </div>

          </div>
        )}

      </main>

    </div>
  );
}
