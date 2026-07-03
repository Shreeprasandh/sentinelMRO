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
  Terminal,
  Settings,
  Lock,
  FileText,
  Network
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
  action_taken: string;
  technician_id: string;
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

// Pre-seeded local engine simulators with deterministic formulas to avoid SSR hydration mismatches
const INITIAL_ENGINES: Record<string, EngineData> = {
  "ENG-001": {
    id: "ENG-001",
    name: "Aero-Engine Alpha (HPC)",
    status: "Nominal",
    health: 0.96,
    rul: 120,
    cycle: 30,
    history: Array.from({ length: 30 }, (_, i) => {
      const c = i + 1;
      return {
        cycle: c,
        rul: 125,
        sensor_11: 1585.0 + c * 0.08 * 0.8 + ((i * 3) % 5) * 0.2,
        sensor_12: 8.40 + c * 0.0007 * 0.8 + ((i * 7) % 6) * 0.0005,
      };
    })
  },
  "ENG-002": {
    id: "ENG-002",
    name: "Aero-Engine Bravo (HPC)",
    status: "Warning",
    health: 0.52,
    rul: 65,
    cycle: 80,
    history: Array.from({ length: 30 }, (_, i) => {
      const c = i + 51;
      return {
        cycle: c,
        rul: 125 - (c - 50) * 1.2,
        sensor_11: 1585.0 + c * 0.08 * 1.1 + ((i * 4) % 6) * 0.2,
        sensor_12: 8.40 + c * 0.0007 * 1.1 + ((i * 8) % 5) * 0.0005,
      };
    })
  },
  "ENG-003": {
    id: "ENG-003",
    name: "Aero-Engine Charlie (HPC)",
    status: "Critical",
    health: 0.18,
    rul: 22,
    cycle: 140,
    history: Array.from({ length: 30 }, (_, i) => {
      const c = i + 111;
      return {
        cycle: c,
        rul: 60 - (c - 110) * 1.4,
        sensor_11: 1585.0 + c * 0.08 * 1.6 + ((i * 5) % 7) * 0.2,
        sensor_12: 8.40 + c * 0.0007 * 1.6 + ((i * 9) % 6) * 0.0005,
      };
    })
  }
};

export default function Dashboard() {
  const [mounted, setMounted] = useState(false);
  const [isLoggedIn, setIsLoggedIn] = useState(false);
  const [loginTechId, setLoginTechId] = useState("TECH-948");
  const [loginPin, setLoginPin] = useState("7700");
  const [loginError, setLoginError] = useState("");
  const [engines, setEngines] = useState<Record<string, EngineData>>(INITIAL_ENGINES);
  const [selectedEngineId, setSelectedEngineId] = useState<string>("ENG-001");
  const [activeTab, setActiveTab] = useState<"fleet" | "federated" | "ledger">("fleet");
  
  // Backend statuses
  const [backendOnline, setBackendOnline] = useState(false);
  const [isInferring, setIsInferring] = useState(false);
  const [isFederating, setIsFederating] = useState(false);
  const [isVerifying, setIsVerifying] = useState(false);
  
  // WebSocket streaming states
  const [isStreaming, setIsStreaming] = useState(false);
  const [streamingRate, setStreamingRate] = useState(1000);

  const handleRateChange = (newRate: number) => {
    setStreamingRate(newRate);
  };

  useEffect(() => {
    let ws: WebSocket | null = null;
    if (isStreaming) {
      const wsUrl = `${BACKEND_URL.replace(/^http/, "ws")}/api/v1/edge/ws/telemetry`;
      ws = new WebSocket(wsUrl);
      
      ws.onopen = () => {
        console.log("WebSocket telemetry connection established.");
        ws?.send(JSON.stringify({ command: "set_rate", rate: streamingRate }));
      };
      
      ws.onmessage = (event) => {
        try {
          const data = JSON.parse(event.data);
          if (data.type === "telemetry" && data.engines) {
            setEngines(prev => {
              const nextEngines = { ...prev };
              Object.keys(data.engines).forEach(id => {
                const update = data.engines[id];
                const engine = prev[id];
                
                const newHistory = [...engine.history];
                if (newHistory.length >= 50) newHistory.shift();
                newHistory.push({
                  cycle: update.cycle,
                  rul: update.predicted_rul,
                  sensor_11: update.sensor_11,
                  sensor_12: update.sensor_12
                });
                
                nextEngines[id] = {
                  ...engine,
                  cycle: update.cycle,
                  rul: update.predicted_rul,
                  health: update.health_score,
                  status: update.predicted_rul < 30 ? "Critical" : update.predicted_rul < 70 ? "Warning" : "Nominal",
                  history: newHistory,
                  attribution: update.attribution
                };
                
                if (update.anomaly_flag && update.cycle !== engine.cycle) {
                  triggerAutoLedgerAppend(id, update.health_score, update.predicted_rul);
                }
              });
              return nextEngines;
            });
          }
        } catch (err) {
          console.error("Error parsing WebSocket message:", err);
        }
      };
      
      ws.onclose = () => {
        console.log("WebSocket telemetry connection closed.");
        setIsStreaming(false);
      };
      
      ws.onerror = (e) => {
        console.error("WebSocket telemetry error:", e);
      };
    }
    
    return () => {
      if (ws) {
        ws.close();
      }
    };
  }, [isStreaming, streamingRate]);
  
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

  const handleLogin = (e: React.FormEvent) => {
    e.preventDefault();
    if (loginTechId.trim() === "") {
      setLoginError("Technician ID is required.");
      return;
    }
    if (loginPin === "7700") {
      setIsLoggedIn(true);
      setLoginError("");
    } else {
      setLoginError("Invalid Security Clearance PIN.");
    }
  };

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
      const res = await fetch(`${BACKEND_URL}/api/v1/ledger/history?t=${Date.now()}`, { cache: 'no-store' });
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
      const res = await fetch(`${BACKEND_URL}/api/v1/federated/history?t=${Date.now()}`, { cache: 'no-store' });
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
      const res = await fetch(`${BACKEND_URL}/api/v1/ledger/verify?t=${Date.now()}`, { cache: 'no-store' });
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
          action_taken: "MALICIOUS INTRUSION DATA",
          technician_id: "INTRUDER-99",
          health_snapshot: 0.0
        })
      });
      
      if (res.ok) {
        alert(`Malicious update successfully injected into SQLite for Leaf #${targetIdx}! The node hashes and Merkle structure remain unchanged. Click 'Run Integrity Validation' to verify.`);
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
    
    const message = `${timestamp}|${formEngine}|${formAction}|${formTech}|${healthNum}`;
    
    try {
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
        setFormSuccessMessage(`Record committed at Leaf Index #${data.leaf_index}. Root Hash updated.`);
        fetchLedgerHistory();

        // --- CLOSED LOOP SIMULATION: UPDATE ENGINE STATE IN UI ---
        setEngines(prev => {
          const target = prev[formEngine];
          if (!target) return prev;
          
          let newCycle = target.cycle;
          let newHealth = target.health;
          let newRul = target.rul;
          let newStatus: "Nominal" | "Warning" | "Critical" = target.status;
          
          if (formAction === "Compressor Overhaul") {
            newCycle = 1;
            newHealth = healthNum;
            newRul = 125;
            newStatus = "Nominal";
          } else if (formAction === "Blade Replacement") {
            newCycle = 30;
            newHealth = healthNum;
            newRul = 115;
            newStatus = "Nominal";
          } else if (formAction === "Oil Lubrication Refill") {
            newCycle = Math.max(1, target.cycle - 25);
            newHealth = Math.min(0.95, target.health + 0.25);
            newRul = Math.min(125, target.rul + 30);
            newStatus = newRul < 30 ? "Critical" : newRul < 70 ? "Warning" : "Nominal";
          } else if (formAction === "Sensor Calibration") {
            newCycle = target.cycle;
            newHealth = Math.min(0.96, target.health + 0.05);
            newRul = Math.min(125, target.rul + 5);
            newStatus = newRul < 30 ? "Critical" : newRul < 70 ? "Warning" : "Nominal";
          }
          
          // Re-generate history starting from the new cycle baseline
          const degradationFactor = formEngine === "ENG-003" ? 1.6 : formEngine === "ENG-002" ? 1.1 : 0.8;
          const length = 30;
          const historyStartCycle = Math.max(1, newCycle - length + 1);
          
          const newHistory = Array.from({ length }, (_, idx) => {
            const c = historyStartCycle + idx;
            return {
              cycle: c,
              rul: Math.min(125, newRul - (length - 1 - idx) * (1.2 * degradationFactor)),
              sensor_11: 1585.0 + c * 0.08 * degradationFactor + ((idx * 3) % 5) * 0.2,
              sensor_12: 8.40 + c * 0.0007 * degradationFactor + ((idx * 7) % 6) * 0.0005,
            };
          });
          
          return {
            ...prev,
            [formEngine]: {
              ...target,
              cycle: newCycle,
              health: newHealth,
              rul: newRul,
              status: newStatus,
              history: newHistory
            }
          };
        });
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
    
    const degradationFactor = engineId === "ENG-003" ? 1.6 : engineId === "ENG-002" ? 1.1 : 0.8;
    const nextSensor11 = 1585.0 + nextCycle * 0.08 * degradationFactor + Math.random() * 0.5;
    const nextSensor12 = 8.40 + nextCycle * 0.0007 * degradationFactor + Math.random() * 0.002;
    
    // Aligned with actual C-MAPSS ranges (s2, s3, s4, s7, s8, s9, s11, s12, s13, s14, s15, s17, s20, s21)
    const simulatedMatrix = Array.from({ length: 30 }, (_, index) => {
      const cycleIdx = nextCycle - 29 + index;
      const effective_cycle = cycleIdx * degradationFactor;
      
      return [
        642.0 + (effective_cycle * 0.007) + Math.random() * 0.1,    // s2
        1585.0 + (effective_cycle * 0.08) + Math.random() * 0.5,    // s3
        1400.0 + (effective_cycle * 0.15) + Math.random() * 0.5,    // s4
        554.0 - (effective_cycle * 0.015) + Math.random() * 0.05,   // s7
        2388.0 + (effective_cycle * 0.001) + Math.random() * 0.01,  // s8
        9050.0 + (effective_cycle * 0.25) + Math.random() * 1.0,    // s9
        47.3 + (effective_cycle * 0.005) + Math.random() * 0.02,    // s11
        522.0 - (effective_cycle * 0.012) + Math.random() * 0.05,   // s12
        2388.0 + (effective_cycle * 0.001) + Math.random() * 0.01,  // s13
        8135.0 + (effective_cycle * 0.18) + Math.random() * 0.5,    // s14
        8.40 + (effective_cycle * 0.0007) + Math.random() * 0.002,  // s15
        392.0 + (effective_cycle * 0.025) + Math.random() * 0.2,    // s17
        38.95 - (effective_cycle * 0.003) + Math.random() * 0.02,   // s20
        23.4 - (effective_cycle * 0.002) + Math.random() * 0.02     // s21
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
        
        const newHistory = [...engine.history];
        if (newHistory.length >= 50) newHistory.shift();
        newHistory.push({
          cycle: nextCycle,
          rul: result.predicted_rul,
          sensor_11: nextSensor11,
          sensor_12: nextSensor12
        });

        const updatedEngine: EngineData = {
          ...engine,
          cycle: nextCycle,
          rul: result.predicted_rul,
          health: result.health_score,
          status: result.predicted_rul < 30 ? "Critical" : result.predicted_rul < 70 ? "Warning" : "Nominal",
          history: newHistory,
          attribution: result.attribution
        } as any;

        setEngines(prev => ({
          ...prev,
          [engineId]: updatedEngine
        }));

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
    const action = `Auto Inspection Flag (RUL: ${rul})`;
    const tech = "SYSTEM-DIAGNOSTIC";
    const station = "STATION_002";
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

  // Colors mapping for minimalist UI
  const getStatusColor = (status: string) => {
    if (status === "Nominal") return "text-emerald-500 font-mono";
    if (status === "Warning") return "text-amber-500 font-mono";
    return "text-red-500 font-mono animate-pulse";
  };

  const getHealthBarColor = (health: number) => {
    if (health >= 0.75) return "bg-emerald-500";
    if (health >= 0.35) return "bg-amber-500";
    return "bg-red-500 animate-pulse";
  };

  if (!isLoggedIn) {
    return (
      <div className="flex-1 flex items-center justify-center min-h-[85vh] p-4 bg-zinc-950">
        <div className="w-full max-w-sm p-8 bg-zinc-900/10 border border-zinc-900 rounded-lg shadow-2xl backdrop-blur-md space-y-8">
          
          {/* Typographical Branding */}
          <div className="space-y-1">
            <span className="text-[10px] font-mono text-zinc-500 uppercase tracking-[0.3em] block">
              AERO-PROPULSION SYSTEMS
            </span>
            <h1 className="text-xl font-bold tracking-wider text-zinc-100 uppercase font-sans">
              SENTINEL<span className="text-zinc-500 font-light">MRO</span>
            </h1>
            <p className="text-[11px] text-zinc-400 font-sans">
              Maintenance, Repair & Overhaul Gateway
            </p>
          </div>

          <form onSubmit={handleLogin} className="space-y-5">
            {loginError && (
              <div className="p-3 bg-red-950/20 border border-red-500/20 rounded-md text-[11px] text-red-400 text-center font-mono">
                {loginError}
              </div>
            )}
            
            <div className="space-y-1.5">
              <label className="text-[10px] font-mono text-zinc-500 uppercase tracking-widest block">
                Technician ID
              </label>
              <input
                type="text"
                value={loginTechId}
                onChange={(e) => setLoginTechId(e.target.value)}
                placeholder="TECH-000"
                className="w-full bg-zinc-950 border border-zinc-850 px-4 py-2.5 text-zinc-200 focus:border-zinc-700 outline-none text-xs font-mono transition-colors rounded-md"
              />
            </div>

            <div className="space-y-1.5">
              <label className="text-[10px] font-mono text-zinc-500 uppercase tracking-widest block">
                Security clearance PIN
              </label>
              <input
                type="password"
                value={loginPin}
                onChange={(e) => setLoginPin(e.target.value)}
                placeholder="••••"
                className="w-full bg-zinc-950 border border-zinc-850 px-4 py-2.5 text-zinc-200 focus:border-zinc-700 outline-none text-xs font-mono tracking-widest text-center transition-colors rounded-md"
              />
            </div>

            <button
              type="submit"
              className="w-full py-2.5 bg-zinc-100 hover:bg-white text-zinc-950 text-xs font-mono font-bold uppercase tracking-widest transition-all active:scale-[0.98] cursor-pointer rounded-md"
            >
              Access Gateway
            </button>
          </form>

          {/* Minimal security indicators */}
          <div className="text-[9px] font-mono text-zinc-500 flex justify-between items-center border-t border-zinc-900/80 pt-5">
            <span>CLEARANCE: LEVEL-2 (PIN: 7700)</span>
            <span>SECURE GATEWAY</span>
          </div>
        </div>
      </div>
    );
  }

  return (
    <div className="flex-1 flex flex-col max-w-7xl mx-auto w-full p-4 md:p-6 space-y-6 bg-zinc-950 text-zinc-100 select-none">
      <style dangerouslySetInnerHTML={{__html: `
        html, body, :root {
          -ms-overflow-style: none !important;
          scrollbar-width: none !important;
        }
        html::-webkit-scrollbar, body::-webkit-scrollbar {
          display: none !important;
        }
        .no-scrollbar::-webkit-scrollbar {
          display: none !important;
        }
        .no-scrollbar {
          -ms-overflow-style: none !important;
          scrollbar-width: none !important;
        }
      `}} />
      
      {/* 1. Header with System Badges */}
      <header className="flex flex-col md:flex-row md:items-center justify-between border-b border-zinc-900 pb-5 gap-4">
        <div className="space-y-1">
          <div className="flex items-center space-x-2">
            <span className="text-[9px] font-mono text-zinc-500 uppercase tracking-[0.25em] block">
              Prognostics & Registry Control
            </span>
          </div>
          <h1 className="text-2xl font-bold tracking-wider text-zinc-100 uppercase">
            SENTINEL<span className="text-zinc-500 font-light">MRO</span>
          </h1>
        </div>

        <div className="flex flex-wrap items-center gap-3 text-[10px] font-mono text-zinc-400">
          <div className={`flex items-center space-x-1.5 border border-zinc-900 px-3 py-1 bg-zinc-900/10 rounded-md`}>
            <span className={`h-1.5 w-1.5 rounded-full ${backendOnline ? "bg-emerald-500 animate-pulse" : "bg-red-500 animate-ping"}`} />
            <span className="uppercase">Gateway: {backendOnline ? "Online" : "Offline"}</span>
          </div>

          <div className="flex items-center space-x-1.5 border border-zinc-900 px-3 py-1 bg-zinc-900/10 rounded-md">
            <Layers className="h-3 w-3 text-zinc-500" />
            <span>LEDGER ENTRIES: {ledgerHistory.length}</span>
          </div>

          <div className="flex items-center space-x-1.5 border border-zinc-900 px-3 py-1 bg-zinc-900/10 rounded-md">
            <User className="h-3 w-3 text-zinc-500" />
            <span className="uppercase">{loginTechId}</span>
          </div>

          <button 
            onClick={() => setIsLoggedIn(false)}
            className="border border-zinc-800 hover:border-zinc-650 hover:bg-zinc-900/20 px-3 py-1 rounded-md text-zinc-350 transition-all cursor-pointer"
          >
            LOG OUT
          </button>
        </div>
      </header>

      {/* Navigation tabs */}
      <div className="flex border-b border-zinc-900 text-xs font-mono">
        <button 
          onClick={() => setActiveTab("fleet")}
          className={`px-5 py-3 border-b-2 transition-all cursor-pointer uppercase tracking-wider ${
            activeTab === "fleet" 
              ? "border-zinc-300 text-zinc-200 bg-zinc-900/10 font-bold" 
              : "border-transparent text-zinc-500 hover:text-zinc-300"
          }`}
        >
          01 / Fleet Telemetry
        </button>
        <button 
          onClick={() => setActiveTab("federated")}
          className={`px-5 py-3 border-b-2 transition-all cursor-pointer uppercase tracking-wider ${
            activeTab === "federated" 
              ? "border-zinc-300 text-zinc-200 bg-zinc-900/10 font-bold" 
              : "border-transparent text-zinc-500 hover:text-zinc-300"
          }`}
        >
          02 / Fleet Calibration
        </button>
        <button 
          onClick={() => setActiveTab("ledger")}
          className={`px-5 py-3 border-b-2 transition-all cursor-pointer uppercase tracking-wider ${
            activeTab === "ledger" 
              ? "border-zinc-300 text-zinc-200 bg-zinc-900/10 font-bold" 
              : "border-transparent text-zinc-500 hover:text-zinc-300"
          }`}
        >
          03 / Ledger Registry
        </button>
      </div>

      {/* Main dashboard body tabs content */}
      <main className="space-y-6">
        
        {/* TAB 1: FLEET CONTROL & DEEP-DIVE TELEMETRY */}
        {activeTab === "fleet" && (
          <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
            
            {/* Left: Active Components List */}
            <div className="space-y-4 lg:col-span-1">
              <div className="flex items-center space-x-2">
                <Settings className="h-3.5 w-3.5 text-zinc-550" />
                <h2 className="text-xs font-mono uppercase tracking-widest text-zinc-400">Active Engine Registry</h2>
              </div>
              
              <div className="space-y-3">
                {Object.values(engines).map((eng) => (
                  <div
                    key={eng.id}
                    onClick={() => setSelectedEngineId(eng.id)}
                    className={`p-4 rounded-lg border cursor-pointer transition-all ${
                      selectedEngineId === eng.id 
                        ? "bg-zinc-900/20 border-zinc-700 shadow-lg scale-[1.01]" 
                        : "bg-zinc-900/5 border-zinc-900 hover:border-zinc-800"
                    }`}
                  >
                    <div className="flex items-center justify-between text-xs font-mono">
                      <h3 className="font-bold text-zinc-200">{eng.id}</h3>
                      <span className={`text-[10px] uppercase font-bold ${getStatusColor(eng.status)}`}>
                        {eng.status}
                      </span>
                    </div>
                    <p className="text-[11px] text-zinc-450 mt-1 font-sans">{eng.name}</p>
                    
                    <div className="mt-4 space-y-1.5">
                      <div className="flex justify-between text-[10px] font-mono">
                        <span className="text-zinc-500">HEALTH INDEX</span>
                        <span className="text-zinc-300">{(eng.health * 100).toFixed(0)}%</span>
                      </div>
                      <div className="h-1 w-full bg-zinc-900/40 rounded-full overflow-hidden">
                        <div 
                          className={`h-full transition-all duration-500 ${getHealthBarColor(eng.health)}`}
                          style={{ width: `${eng.health * 100}%` }}
                        />
                      </div>
                    </div>

                    <div className="mt-4 flex items-center justify-between border-t border-zinc-900/80 pt-3 text-[10px] font-mono text-zinc-550">
                      <span>CYCLES: <strong className="text-zinc-350">{eng.cycle}</strong></span>
                      <span>RUL: <strong className="text-zinc-350">{eng.rul} CYC</strong></span>
                    </div>
                  </div>
                ))}
              </div>
            </div>

            {/* Right: Deep Dive Analytics and Live Streaming */}
            <div className="lg:col-span-2 space-y-6 font-sans">
              <div className="bg-zinc-900/10 border border-zinc-900 rounded-xl p-5 md:p-6 space-y-5">
                
                <div className="flex flex-col md:flex-row md:items-center justify-between gap-4">
                  <div className="space-y-1">
                    <span className="text-[10px] font-mono text-zinc-500 uppercase tracking-widest">
                      Live Telemetry & Predictor Plot
                    </span>
                    <h2 className="text-lg font-bold text-zinc-200 uppercase">
                      Prognostics Analysis: {activeEngine.id}
                    </h2>
                  </div>
                  
                  <div className="flex flex-wrap items-center gap-3">
                    {/* WebSocket Streaming Controls */}
                    <div className="flex items-center space-x-2 bg-zinc-950 border border-zinc-900 px-3 py-1.5 rounded-md text-[11px] font-mono">
                      <span className="text-zinc-500 uppercase">WS STREAM:</span>
                      <button
                        type="button"
                        onClick={() => setIsStreaming(prev => !prev)}
                        disabled={!backendOnline}
                        className={`px-2 py-0.5 rounded text-[10px] font-bold uppercase transition-all duration-300 cursor-pointer ${
                          isStreaming 
                            ? "bg-red-500/20 text-red-400 border border-red-500/30" 
                            : "bg-emerald-500/20 text-emerald-400 border border-emerald-500/30"
                        }`}
                      >
                        {isStreaming ? "PAUSE" : "START"}
                      </button>
                      
                      {isStreaming && <span className="h-1.5 w-1.5 rounded-full bg-emerald-500 animate-ping"></span>}
                      
                      <select
                        value={streamingRate}
                        onChange={(e) => handleRateChange(Number(e.target.value))}
                        disabled={!backendOnline}
                        className="bg-zinc-900 border border-zinc-800 px-1 py-0.5 rounded text-zinc-300 outline-none text-[10px] cursor-pointer"
                      >
                        <option value={1000}>1.0s</option>
                        <option value={500}>0.5s</option>
                        <option value={200}>0.2s</option>
                      </select>
                    </div>

                    <button
                      onClick={() => streamNextCycle(activeEngine.id)}
                      disabled={isInferring || isStreaming || !backendOnline}
                      className="flex items-center space-x-2 bg-zinc-100 hover:bg-white disabled:opacity-50 text-zinc-950 font-mono font-bold py-2 px-4 rounded-md text-xs tracking-wider transition-all active:scale-95 cursor-pointer"
                    >
                      <RefreshCw className={`h-3 w-3 ${isInferring ? "animate-spin" : ""}`} />
                      <span>{isInferring ? "EVALUATING MODEL..." : "SIMULATE FLIGHT CYCLE"}</span>
                    </button>
                  </div>
                </div>

                {/* Status Banners */}
                {activeEngine.rul < 30 && (
                  <div className="flex items-center space-x-3 bg-red-950/20 border border-red-900/20 text-red-400 p-3.5 rounded-lg text-xs font-mono">
                    <AlertTriangle className="h-4 w-4 shrink-0 text-red-500" />
                    <div>
                      <strong>WARNING: CRITICAL LIFETIME LIMIT REACHED.</strong> Remaining Useful Life (RUL) has dropped below safe threshold (30 cycles). Immediate overhaul required.
                    </div>
                  </div>
                )}

                {/* Recharts Container */}
                <div className="h-72 w-full mt-4 bg-zinc-950/30 p-2 border border-zinc-900/60 rounded-xl">
                  {mounted && (
                    <ResponsiveContainer width="100%" height="100%">
                      <LineChart data={activeEngine.history}>
                        <CartesianGrid strokeDasharray="3 3" stroke="#18181b" />
                        <XAxis dataKey="cycle" stroke="#52525b" fontSize={10} fontFamily="monospace" label={{ value: 'Flight Cycles', position: 'insideBottomRight', offset: -5, fill: '#52525b', fontSize: 10 }} />
                        <YAxis yAxisId="left" stroke="#a1a1aa" fontSize={10} fontFamily="monospace" label={{ value: 'Remaining Cycles', angle: -90, position: 'insideLeft', fill: '#a1a1aa', fontSize: 10 }} />
                        <YAxis yAxisId="right" orientation="right" stroke="#71717a" fontSize={10} fontFamily="monospace" label={{ value: 'Telemetry Voltages', angle: 90, position: 'insideRight', fill: '#71717a', fontSize: 10 }} />
                        <Tooltip contentStyle={{ backgroundColor: "#09090b", borderColor: "#18181b", color: "#f4f4f5", fontFamily: "monospace", fontSize: 10 }} />
                        <Legend wrapperStyle={{ fontSize: 10, fontFamily: "monospace" }} />
                        
                        <ReferenceLine yAxisId="left" y={30} stroke="#ef4444" strokeDasharray="4 4" label={{ value: 'Limit: 30', fill: '#ef4444', fontSize: 9, position: 'insideTopLeft' }} />
                        
                        <Line yAxisId="left" type="monotone" dataKey="rul" name="Predicted RUL" stroke="#f4f4f5" strokeWidth={2} dot={{ r: 2 }} activeDot={{ r: 4 }} />
                        <Line yAxisId="right" type="monotone" dataKey="sensor_11" name="Sensor LPC Temp" stroke="#71717a" strokeWidth={1} dot={false} />
                        <Line yAxisId="right" type="monotone" dataKey="sensor_12" name="Sensor Bypass Ratio" stroke="#3f3f46" strokeWidth={1} strokeDasharray="3 3" dot={false} />
                      </LineChart>
                    </ResponsiveContainer>
                  )}
                </div>

                {/* Telemetry metrics panel */}
                <div className="grid grid-cols-2 md:grid-cols-4 gap-4 mt-4 text-xs bg-zinc-950/40 p-4 border border-zinc-900 rounded-lg font-mono">
                  <div className="space-y-1">
                    <span className="text-zinc-500 uppercase block text-[9px] tracking-widest">Active Cycle</span>
                    <strong className="text-zinc-200 text-base">{activeEngine.cycle}</strong>
                  </div>
                  <div className="space-y-1">
                    <span className="text-zinc-500 uppercase block text-[9px] tracking-widest">Estimated RUL</span>
                    <strong className="text-zinc-200 text-base">{activeEngine.rul} Cycles</strong>
                  </div>
                  <div className="space-y-1">
                    <span className="text-zinc-500 uppercase block text-[9px] tracking-widest">Sensor Bypass Ratio</span>
                    <strong className="text-zinc-300 text-base">
                      {activeEngine.history[activeEngine.history.length - 1].sensor_12.toFixed(3)}
                    </strong>
                  </div>
                  <div className="space-y-1">
                    <span className="text-zinc-500 uppercase block text-[9px] tracking-widest">Sensor LPC Temp</span>
                    <strong className="text-zinc-300 text-base">
                      {activeEngine.history[activeEngine.history.length - 1].sensor_11.toFixed(1)} K
                    </strong>
                  </div>
                </div>

              </div>

              {/* Explainable AI Diagnostics panel */}
              <div className="bg-zinc-900/10 border border-zinc-900 rounded-xl p-5 md:p-6 space-y-4">
                <h3 className="text-xs font-mono uppercase tracking-widest text-zinc-400 flex items-center space-x-2">
                  <Cpu className="h-4 w-4 text-zinc-500" />
                  <span>Explainable AI (XAI) Diagnostics: Sensor Attribution</span>
                </h3>
                <p className="text-[11px] text-zinc-450 leading-relaxed font-sans">
                  Computed using <strong>Integrated Gradients</strong> on the edge TCN network. This panel identifies which sensors are the primary wear-contributors driving down the engine's Remaining Useful Life (RUL).
                </p>

                {activeEngine.attribution && activeEngine.attribution.length > 0 ? (
                  <div className="space-y-4 pt-2">
                    <div className="grid grid-cols-1 md:grid-cols-2 gap-4 text-xs font-mono">
                      {/* Top 7 sensors */}
                      <div className="space-y-3">
                        {activeEngine.attribution.slice(0, 7).map((item: any, idx: number) => {
                          const isTop = idx < 3;
                          const barColor = isTop ? "bg-red-500" : "bg-zinc-600";
                          const textColor = isTop ? "text-red-400 font-bold" : "text-zinc-450";
                          return (
                            <div key={item.sensor} className="space-y-1">
                              <div className="flex justify-between text-[11px]">
                                <span className={textColor}>
                                  {item.sensor.toUpperCase()} ({
                                    item.sensor === "s11" ? "HPT coolant bleed" :
                                    item.sensor === "s12" ? "LPT coolant bleed" :
                                    item.sensor === "s15" ? "Bypass ratio" :
                                    item.sensor === "s4" ? "LPT outlet temp" :
                                    item.sensor === "s3" ? "HPC outlet temp" :
                                    item.sensor === "s2" ? "LPC outlet temp" :
                                    item.sensor === "s7" ? "Bypass ratio" :
                                    item.sensor === "s8" ? "Fan speed" :
                                    item.sensor === "s9" ? "Core speed" :
                                    item.sensor === "s13" ? "Bleed enthalpy" :
                                    item.sensor === "s14" ? "Demand factor" :
                                    item.sensor === "s17" ? "Pressure ratio" :
                                    item.sensor === "s20" ? "HPT speed" :
                                    item.sensor === "s21" ? "LPT speed" : "Sensor"
                                  })
                                </span>
                                <span className={textColor}>{item.percentage.toFixed(1)}%</span>
                              </div>
                              <div className="w-full bg-zinc-950 h-2 rounded-full overflow-hidden border border-zinc-900">
                                <div 
                                  className={`h-full rounded-full transition-all duration-500 ${barColor}`} 
                                  style={{ width: `${item.percentage}%` }}
                                ></div>
                              </div>
                            </div>
                          );
                        })}
                      </div>
                      {/* Remaining 7 sensors */}
                      <div className="space-y-3">
                        {activeEngine.attribution.slice(7).map((item: any) => {
                          return (
                            <div key={item.sensor} className="space-y-1">
                              <div className="flex justify-between text-[11px]">
                                <span className="text-zinc-500">
                                  {item.sensor.toUpperCase()} ({
                                    item.sensor === "s11" ? "HPT coolant bleed" :
                                    item.sensor === "s12" ? "LPT coolant bleed" :
                                    item.sensor === "s15" ? "Bypass ratio" :
                                    item.sensor === "s4" ? "LPT outlet temp" :
                                    item.sensor === "s3" ? "HPC outlet temp" :
                                    item.sensor === "s2" ? "LPC outlet temp" :
                                    item.sensor === "s7" ? "Bypass ratio" :
                                    item.sensor === "s8" ? "Fan speed" :
                                    item.sensor === "s9" ? "Core speed" :
                                    item.sensor === "s13" ? "Bleed enthalpy" :
                                    item.sensor === "s14" ? "Demand factor" :
                                    item.sensor === "s17" ? "Pressure ratio" :
                                    item.sensor === "s20" ? "HPT speed" :
                                    item.sensor === "s21" ? "LPT speed" : "Sensor"
                                  })
                                </span>
                                <span className="text-zinc-400">{item.percentage.toFixed(1)}%</span>
                              </div>
                              <div className="w-full bg-zinc-950 h-2 rounded-full overflow-hidden border border-zinc-900">
                                <div 
                                  className="h-full rounded-full bg-zinc-700/60 transition-all duration-500" 
                                  style={{ width: `${item.percentage}%` }}
                                ></div>
                              </div>
                            </div>
                          );
                        })}
                      </div>
                    </div>
                    
                    {/* Synthesis Diagnosis */}
                    <div className="p-3.5 bg-zinc-950 border border-zinc-900 rounded-lg text-[11px] font-mono text-zinc-450 flex items-start space-x-2">
                      <Terminal className="h-4 w-4 text-zinc-500 shrink-0 mt-0.5" />
                      <div>
                        <strong>DIAGNOSTIC REPORT:</strong> Primary wear detected in {" "}
                        <span className="text-red-400 font-bold">
                          {activeEngine.attribution[0].sensor.toUpperCase()} ({
                            activeEngine.attribution[0].sensor === "s11" ? "HPT coolant bleed" :
                            activeEngine.attribution[0].sensor === "s12" ? "LPT coolant bleed" :
                            activeEngine.attribution[0].sensor === "s15" ? "Bypass ratio" :
                            activeEngine.attribution[0].sensor === "s4" ? "LPT outlet temp" :
                            activeEngine.attribution[0].sensor === "s3" ? "HPC outlet temp" :
                            activeEngine.attribution[0].sensor === "s2" ? "LPC outlet temp" :
                            activeEngine.attribution[0].sensor === "s7" ? "Bypass ratio" :
                            activeEngine.attribution[0].sensor === "s8" ? "Fan speed" :
                            activeEngine.attribution[0].sensor === "s9" ? "Core speed" :
                            activeEngine.attribution[0].sensor === "s13" ? "Bleed enthalpy" :
                            activeEngine.attribution[0].sensor === "s14" ? "Demand factor" :
                            activeEngine.attribution[0].sensor === "s17" ? "Pressure ratio" :
                            activeEngine.attribution[0].sensor === "s20" ? "HPT speed" :
                            activeEngine.attribution[0].sensor === "s21" ? "LPT speed" : "Sensor"
                          })
                        </span>{" "}
                        (attribution score: {activeEngine.attribution[0].percentage.toFixed(1)}%). We recommend inspecting the component's internal thermodynamic seals and cooling channels.
                      </div>
                    </div>
                  </div>
                ) : (
                  <div className="bg-zinc-950/20 border border-zinc-900 border-dashed rounded-lg p-8 text-center text-xs font-mono text-zinc-550">
                    NO XAI DIAGNOSTICS LOADED. RUN A FLIGHT CYCLE SIMULATION OR ENABLE LIVE WEBSOCKET STREAMING TO TRIGGER ATTRIBUTION MAPS.
                  </div>
                )}
              </div>

            </div>

          </div>
        )}

        {/* TAB 2: FEDERATED CALIBRATION CONSOLE */}
        {activeTab === "federated" && (
          <div className="bg-zinc-900/10 border border-zinc-900 rounded-xl p-5 md:p-6 space-y-6">
            
            <div className="flex flex-col md:flex-row md:items-center justify-between gap-4 border-b border-zinc-900 pb-5">
              <div className="space-y-1">
                <span className="text-[10px] font-mono text-zinc-500 uppercase tracking-widest">
                  Secure Parameters Compilation
                </span>
                <h2 className="text-xl font-bold text-zinc-100 uppercase flex items-center space-x-2">
                  <span>Distributed Fleet Prognostics Calibrator</span>
                </h2>
              </div>

              <button
                onClick={runFederatedRound}
                disabled={isFederating || !backendOnline}
                className="flex items-center space-x-2 bg-zinc-100 hover:bg-white disabled:opacity-50 text-zinc-950 font-mono font-bold py-2 px-4 rounded-md text-xs tracking-wider transition-all active:scale-95 cursor-pointer"
              >
                <Play className={`h-3 w-3 ${isFederating ? "animate-spin" : ""}`} />
                <span>{isFederating ? "SYNCHRONIZING..." : "SYNCHRONIZE FLEET MODELS"}</span>
              </button>
            </div>

            <div className="grid grid-cols-1 lg:grid-cols-3 gap-6 font-sans">
              
              {/* Hangar groups info */}
              <div className="lg:col-span-1 space-y-4">
                <h3 className="font-mono text-xs uppercase tracking-widest text-zinc-400 border-b border-zinc-900 pb-2">Hangar Station Nodes</h3>
                
                <div className="space-y-4 text-xs">
                  <div className="p-3 bg-zinc-950/20 border border-zinc-900 rounded-md">
                    <strong className="text-zinc-300 font-mono text-[11px] block">Hangar Group A (Nominal Operations)</strong>
                    <p className="text-zinc-500 mt-1 font-sans leading-relaxed text-[11px]">Telemetry logs capturing standard operating cycles (Cycles ≤ 60).</p>
                  </div>
                  
                  <div className="p-3 bg-zinc-950/20 border border-zinc-900 rounded-md">
                    <strong className="text-zinc-300 font-mono text-[11px] block">Hangar Group B (Stress Diagnostics)</strong>
                    <p className="text-zinc-500 mt-1 font-sans leading-relaxed text-[11px]">Telemetry logs detailing advanced wear fatigue and engine cycles near limit thresholds.</p>
                  </div>

                  <div className="p-3 bg-zinc-950/20 border border-zinc-900 rounded-md">
                    <strong className="text-zinc-300 font-mono text-[11px] block">Hangar Group C (Mixed Operations)</strong>
                    <p className="text-zinc-500 mt-1 font-sans leading-relaxed text-[11px]">Telemetry logs representing standard balanced fleet configurations.</p>
                  </div>
                  
                  <div className="p-3 bg-zinc-950/40 border border-zinc-900 rounded-md space-y-2">
                    <strong className="text-zinc-400 flex items-center font-mono text-[10px] uppercase tracking-wider"><Terminal className="h-3 w-3 text-zinc-500 mr-2" /> Calibration settings</strong>
                    <div className="text-[10px] font-mono text-zinc-500 space-y-1">
                      <div>AGGREGATION: FedProx (mu=0.01)</div>
                      <div>PRIVACY: Laplace Local DP (sigma=0.001)</div>
                    </div>
                  </div>
                </div>
              </div>

              {/* Training Convergence Plot */}
              <div className="lg:col-span-2 space-y-4">
                <h3 className="font-mono text-xs uppercase tracking-widest text-zinc-400">Parameter Convergence History</h3>
                
                <div className="h-72 w-full bg-zinc-950/30 p-2 border border-zinc-900 rounded-xl">
                  {mounted && federatedHistory.length > 0 ? (
                    <ResponsiveContainer width="100%" height="100%">
                      <LineChart data={federatedHistory}>
                        <CartesianGrid strokeDasharray="3 3" stroke="#18181b" />
                        <XAxis dataKey="round" stroke="#52525b" fontSize={10} fontFamily="monospace" label={{ value: 'Synchronization Rounds', position: 'insideBottomRight', offset: -5, fill: '#52525b', fontSize: 10 }} />
                        <YAxis stroke="#52525b" fontSize={10} fontFamily="monospace" label={{ value: 'Mean Squared Error', angle: -90, position: 'insideLeft', fill: '#52525b', fontSize: 10 }} />
                        <Tooltip contentStyle={{ backgroundColor: "#09090b", borderColor: "#18181b", color: "#f4f4f5", fontFamily: "monospace", fontSize: 10 }} />
                        <Legend wrapperStyle={{ fontSize: 10, fontFamily: "monospace" }} />
                        <Line type="monotone" dataKey="station_1_loss" name="Group A Loss" stroke="#52525b" strokeWidth={1} dot={false} />
                        <Line type="monotone" dataKey="station_2_loss" name="Group B Loss" stroke="#71717a" strokeWidth={1} dot={false} />
                        <Line type="monotone" dataKey="station_3_loss" name="Group C Loss" stroke="#a1a1aa" strokeWidth={1.5} dot={false} />
                        <Line type="monotone" dataKey="global_loss" name="Consolidated Fleet Loss" stroke="#f4f4f5" strokeWidth={2.5} dot={{ r: 3 }} />
                      </LineChart>
                    </ResponsiveContainer>
                  ) : (
                    <div className="h-full w-full flex items-center justify-center font-mono text-zinc-550 text-xs">
                      No synchronization logs found. Trigger model synchronization to compute global convergence metrics.
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
              <div className="bg-zinc-900/10 border border-zinc-900 rounded-xl p-5 md:p-6 space-y-4">
                <h3 className="text-xs font-mono uppercase tracking-widest text-zinc-400 flex items-center space-x-2">
                  <Shield className="h-4 w-4 text-zinc-500" />
                  <span>Ledger Verification Console</span>
                </h3>
                <p className="text-[11px] text-zinc-450 leading-relaxed font-sans">
                  Validates the structural integrity of the append-only maintenance ledger. Rebuilds the Merkle Mountain Range (MMR) directly from current records and compares the computed root against the stored seal.
                </p>

                <div className="flex space-x-3 pt-2">
                  <button
                    onClick={verifyLedgerIntegrity}
                    disabled={isVerifying || !backendOnline}
                    className="flex-1 flex items-center justify-center space-x-2 bg-zinc-800 hover:bg-zinc-750 disabled:opacity-50 text-zinc-200 border border-zinc-700 font-mono font-bold py-2.5 px-4 rounded-md text-xs transition-all cursor-pointer"
                  >
                    <CheckCircle className="h-3.5 w-3.5 text-zinc-400" />
                    <span>RUN INTEGRITY VALIDATION</span>
                  </button>

                  <button
                    onClick={simulateTampering}
                    disabled={!backendOnline}
                    className="flex-1 flex items-center justify-center space-x-2 bg-red-950/10 hover:bg-red-950/20 border border-red-900/25 text-red-400 font-mono font-bold py-2.5 px-4 rounded-md text-xs transition-all cursor-pointer"
                  >
                    <AlertTriangle className="h-3.5 w-3.5 text-red-500" />
                    <span>SIMULATE DATA TAMPER</span>
                  </button>
                </div>

                {/* Verification result display */}
                {verificationResult.verified !== null && (
                  <div className={`p-4 rounded-md border space-y-3 font-mono text-xs ${
                    verificationResult.verified 
                      ? "bg-emerald-500/5 border-emerald-500/20 text-emerald-400" 
                      : "bg-red-500/5 border-red-500/20 text-red-400"
                  }`}>
                    <div className="flex items-center space-x-2 font-bold uppercase tracking-wider text-[11px]">
                      {verificationResult.verified ? (
                        <>
                          <CheckCircle className="h-4 w-4 text-emerald-500" />
                          <span>Verification Secure: Root Integrity Intact</span>
                        </>
                      ) : (
                        <>
                          <AlertTriangle className="h-4 w-4 text-red-500" />
                          <span>Verification Failure: Hash Mismatch Detected</span>
                        </>
                      )}
                    </div>
                    <p className="text-[11px] text-zinc-350">{verificationResult.message}</p>
                    
                    <div className="text-[10px] border-t border-zinc-900/80 pt-2.5 space-y-1.5 text-zinc-500">
                      <div className="truncate">COMPUTED ROOT: {verificationResult.computed_root || "N/A"}</div>
                      <div className="truncate">DATABASE ROOT: {verificationResult.stored_root || "N/A"}</div>
                    </div>
                  </div>
                )}

                <div className="text-[10px] font-mono border border-zinc-900 bg-zinc-950/40 p-4 rounded-md flex justify-between">
                  <span className="text-zinc-500">MMR ROOT SEAL:</span>
                  <span className="text-zinc-350 select-all truncate max-w-xs">{rootHash || "EMPTY REGISTER"}</span>
                </div>

              </div>

              {/* Add maintenance log */}
              <div className="bg-zinc-900/10 border border-zinc-900 rounded-xl p-5 md:p-6 space-y-4">
                <h3 className="text-xs font-mono uppercase tracking-widest text-zinc-400 flex items-center space-x-2">
                  <Database className="h-4 w-4 text-zinc-500" />
                  <span>Create Certified Maintenance Entry</span>
                </h3>
                
                <form onSubmit={handleManualAppend} className="grid grid-cols-1 sm:grid-cols-2 gap-4 text-[11px] font-mono">
                  <div className="space-y-1.5">
                    <label className="text-zinc-500 uppercase block text-[10px]">Component ID</label>
                    <select
                      value={formEngine}
                      onChange={(e) => setFormEngine(e.target.value)}
                      className="w-full bg-zinc-900 border border-zinc-800 p-2 rounded-md text-zinc-200 focus:border-zinc-700 outline-none cursor-pointer"
                    >
                      <option value="ENG-001" className="bg-zinc-900 text-zinc-200">ENG-001 (Alpha)</option>
                      <option value="ENG-002" className="bg-zinc-900 text-zinc-200">ENG-002 (Bravo)</option>
                      <option value="ENG-003" className="bg-zinc-900 text-zinc-200">ENG-003 (Charlie)</option>
                    </select>
                  </div>

                  <div className="space-y-1.5">
                    <label className="text-zinc-500 uppercase block text-[10px]">Hangar Station</label>
                    <select
                      value={formStation}
                      onChange={(e) => setFormStation(e.target.value)}
                      className="w-full bg-zinc-900 border border-zinc-800 p-2 rounded-md text-zinc-200 focus:border-zinc-700 outline-none cursor-pointer"
                    >
                      <option value="STATION_001" className="bg-zinc-900 text-zinc-200">STATION_001 (Group A)</option>
                      <option value="STATION_002" className="bg-zinc-900 text-zinc-200">STATION_002 (Group B)</option>
                      <option value="STATION_003" className="bg-zinc-900 text-zinc-200">STATION_003 (Group C)</option>
                    </select>
                  </div>

                  <div className="space-y-1.5">
                    <label className="text-zinc-500 uppercase block text-[10px]">Log Action</label>
                    <select
                      value={formAction}
                      onChange={(e) => setFormAction(e.target.value)}
                      className="w-full bg-zinc-900 border border-zinc-800 p-2 rounded-md text-zinc-200 focus:border-zinc-700 outline-none cursor-pointer"
                    >
                      <option value="Sensor Calibration" className="bg-zinc-900 text-zinc-200">Sensor Calibration</option>
                      <option value="Blade Replacement" className="bg-zinc-900 text-zinc-200">Blade Replacement</option>
                      <option value="Oil Lubrication Refill" className="bg-zinc-900 text-zinc-200">Oil Lubrication Refill</option>
                      <option value="Compressor Overhaul" className="bg-zinc-900 text-zinc-200">Compressor Overhaul</option>
                    </select>
                  </div>

                  <div className="space-y-1.5">
                    <label className="text-zinc-500 uppercase block text-[10px]">Technician ID</label>
                    <input
                      type="text"
                      value={formTech}
                      onChange={(e) => setFormTech(e.target.value)}
                      className="w-full bg-zinc-900 border border-zinc-800 p-2 rounded-md text-zinc-200 focus:border-zinc-700 outline-none"
                    />
                  </div>

                  <div className="space-y-1.5">
                    <label className="text-zinc-500 uppercase block text-[10px]">Health Snapshot</label>
                    <input
                      type="number"
                      step="0.01"
                      value={formHealth}
                      onChange={(e) => setFormHealth(e.target.value)}
                      className="w-full bg-zinc-900 border border-zinc-800 p-2 rounded-md text-zinc-200 focus:border-zinc-700 outline-none"
                    />
                  </div>

                  <div className="col-span-1 sm:col-span-2 pt-2">
                    <button
                      type="submit"
                      disabled={!backendOnline}
                      className="w-full flex items-center justify-center space-x-2 bg-zinc-100 hover:bg-white disabled:opacity-50 text-zinc-950 font-mono font-bold py-2.5 px-4 rounded-md transition-all active:scale-[0.99] cursor-pointer"
                    >
                      <Layers className="h-3.5 w-3.5" />
                      <span>SIGN & COMMIT LOG ENTRY</span>
                    </button>
                  </div>
                </form>

                {formSuccessMessage && (
                  <div className="p-3 bg-zinc-950 border border-zinc-900 text-zinc-400 rounded-md text-[10px] font-mono">
                    {formSuccessMessage}
                  </div>
                )}

              </div>

            </div>

            {/* MMR Tree Visualization Card */}
            <div className="bg-zinc-900/10 border border-zinc-900 rounded-xl p-5 md:p-6 space-y-4">
              <div className="flex justify-between items-center">
                <h3 className="text-xs font-mono uppercase tracking-widest text-zinc-400 flex items-center space-x-2">
                  <Network className="h-4 w-4 text-zinc-500" />
                  <span>Ledger Cryptographic DAG (Merkle Mountain Range)</span>
                </h3>
                <div className="flex space-x-4 text-[10px] font-mono">
                  <div className="flex items-center space-x-1.5">
                    <span className="h-2 w-2 rounded-full bg-emerald-500"></span>
                    <span className="text-zinc-400">Secure Node</span>
                  </div>
                  <div className="flex items-center space-x-1.5">
                    <span className="h-2 w-2 rounded-full bg-red-500 animate-pulse"></span>
                    <span className="text-zinc-400">Tampered Path</span>
                  </div>
                  <div className="flex items-center space-x-1.5">
                    <span className="h-2.5 w-2.5 border border-dashed border-zinc-500"></span>
                    <span className="text-zinc-400">Peak Chaining</span>
                  </div>
                </div>
              </div>
              <p className="text-[11px] text-zinc-450 leading-relaxed font-sans">
                Below is the dynamic reconstruction of the Merkle Mountain Range (MMR) ledger tree. Leaf nodes represent physical MRO log entries. If the SQLite database is tampered with, the integrity check will identify the mutated leaves and trace the compromised validation path in red up to the root seal.
              </p>

              <div className="bg-zinc-950/40 border border-zinc-900 rounded-lg p-4 flex items-center justify-center min-h-[300px] overflow-x-auto">
                {nodes.length === 0 ? (
                  <div className="text-zinc-550 font-mono text-xs text-center py-12">
                    <Database className="h-8 w-8 mx-auto mb-2 text-zinc-700 animate-bounce" />
                    <span>NO AUDIT NODES IN LEDGER. COMMIT LOGS TO BUILD CRYPTOGRAPHIC DAG.</span>
                  </div>
                ) : (() => {
                  const { nodes: mmrNodes, links: mmrLinks } = (() => {
                    if (!nodes || nodes.length === 0) return { nodes: [], links: [] };
                    
                    const nodesMap: any = {};
                    nodes.forEach((n: any) => {
                      nodesMap[n.pos] = {
                        ...n,
                        children: [] as number[],
                        parent: null as number | null,
                        x: 0,
                        y: 0
                      };
                    });
                    
                    const stack: any[] = [];
                    const sortedNodes = [...nodes].sort((a: any, b: any) => a.pos - b.pos);
                    
                    sortedNodes.forEach((node: any) => {
                      const nodeObj = nodesMap[node.pos];
                      if (nodeObj.is_leaf) {
                        stack.push(nodeObj);
                      } else {
                        if (stack.length >= 2) {
                          const right = stack.pop();
                          const left = stack.pop();
                          nodeObj.children = [left.pos, right.pos];
                          left.parent = nodeObj.pos;
                          right.parent = nodeObj.pos;
                        }
                        stack.push(nodeObj);
                      }
                    });
                    
                    const peaks = [...stack];
                    const leaves = Object.values(nodesMap).filter((n: any) => n.is_leaf).sort((a: any, b: any) => a.pos - b.pos);
                    const width = 800;
                    const height = 280;
                    const paddingX = 50;
                    const paddingY = 40;
                    
                    const leafSpacing = leaves.length > 1 ? (width - paddingX * 2) / (leaves.length - 1) : 0;
                    leaves.forEach((leaf: any, idx: number) => {
                      leaf.x = paddingX + idx * leafSpacing;
                      leaf.y = height - paddingY;
                    });
                    
                    const internalNodes = Object.values(nodesMap).filter((n: any) => !n.is_leaf).sort((a: any, b: any) => a.height - b.height);
                    internalNodes.forEach((node: any) => {
                      if (node.children && node.children.length === 2) {
                        const left = nodesMap[node.children[0]];
                        const right = nodesMap[node.children[1]];
                        node.x = (left.x + right.x) / 2;
                        node.y = height - paddingY - node.height * 55;
                      }
                    });
                    
                    const tamperedPos = new Set<string | number>();
                    const leafIdxToPos: Record<number, number> = {};
                    leaves.forEach((leaf: any, idx: number) => {
                      const leafIdx = idx + 1;
                      leaf.leaf_index = leafIdx;
                      leafIdxToPos[leafIdx] = leaf.pos;
                    });
                    
                    if (verificationResult.verified === false && verificationResult.tampered_indices) {
                      verificationResult.tampered_indices.forEach((idx: number) => {
                        const pos = leafIdxToPos[idx];
                        if (pos) {
                          tamperedPos.add(pos);
                        }
                      });
                      
                      const sortedByHeight = Object.values(nodesMap).sort((a: any, b: any) => a.height - b.height);
                      sortedByHeight.forEach((node: any) => {
                        if (node.children && node.children.some((cPos: number) => tamperedPos.has(cPos))) {
                          tamperedPos.add(node.pos);
                        }
                      });
                      
                      if (peaks.some((p: any) => tamperedPos.has(p.pos))) {
                        tamperedPos.add("ROOT");
                      }
                    }
                    
                    const links: any[] = [];
                    Object.values(nodesMap).forEach((node: any) => {
                      if (node.children) {
                        node.children.forEach((cPos: number) => {
                          const child = nodesMap[cPos];
                          const isTamperedLink = tamperedPos.has(node.pos) && tamperedPos.has(child.pos);
                          links.push({
                            id: `link-${node.pos}-${child.pos}`,
                            source: { x: node.x, y: node.y },
                            target: { x: child.x, y: child.y },
                            isTampered: isTamperedLink
                          });
                        });
                      }
                    });
                    
                    let rootNodeObj = null;
                    if (peaks.length > 1) {
                      rootNodeObj = {
                        pos: "ROOT",
                        hash: rootHash,
                        is_root: true,
                        x: width / 2,
                        y: paddingY,
                        height: Math.max(...peaks.map((p: any) => p.height)) + 1
                      };
                      
                      peaks.forEach((peak: any) => {
                        const isTamperedLink = tamperedPos.has("ROOT") && tamperedPos.has(peak.pos);
                        links.push({
                          id: `link-ROOT-${peak.pos}`,
                          source: { x: rootNodeObj.x, y: rootNodeObj.y },
                          target: { x: peak.x, y: peak.y },
                          isPeakLink: true,
                          isTampered: isTamperedLink
                        });
                      });
                    } else if (peaks.length === 1) {
                      peaks[0].is_root = true;
                    }
                    
                    const finalNodes = Object.values(nodesMap);
                    if (rootNodeObj) {
                      finalNodes.push(rootNodeObj);
                    }
                    
                    return {
                      nodes: finalNodes.map((n: any) => ({
                        ...n,
                        isTampered: tamperedPos.has(n.pos)
                      })),
                      links
                    };
                  })();
                  
                  return (
                    <svg viewBox="0 0 800 280" className="w-full max-w-[800px] h-auto select-none overflow-visible">
                      {mmrLinks.map((link: any) => (
                        <line
                          key={link.id}
                          x1={link.source.x}
                          y1={link.source.y}
                          x2={link.target.x}
                          y2={link.target.y}
                          className={`transition-all duration-500 ${
                            link.isTampered
                              ? "stroke-red-500/80 stroke-[2px]"
                              : link.isPeakLink
                              ? "stroke-zinc-600/50 stroke-[1.5px]"
                              : "stroke-zinc-700/60 stroke-[1.5px]"
                          }`}
                          strokeDasharray={link.isPeakLink ? "4 4" : undefined}
                        />
                      ))}
                      
                      {mmrNodes.map((node: any) => {
                        const radius = node.pos === "ROOT" ? 12 : node.is_leaf ? 8 : 10;
                        const fillClass = node.isTampered
                          ? "fill-red-950/80 stroke-red-500"
                          : node.pos === "ROOT"
                          ? "fill-cyan-950 stroke-cyan-400"
                          : node.is_leaf
                          ? "fill-emerald-950/80 stroke-emerald-500"
                          : "fill-zinc-900 stroke-zinc-500";
                        
                        return (
                          <g key={node.pos} className="group cursor-pointer">
                            <circle
                              cx={node.x}
                              cy={node.y}
                              r={radius}
                              className={`transition-all duration-500 stroke-[2px] ${fillClass} hover:stroke-[3px]`}
                            />
                            {node.isTampered && (
                              <circle
                                cx={node.x}
                                cy={node.y}
                                r={radius + 4}
                                className="fill-none stroke-red-500/35 stroke-[1px] animate-ping"
                              />
                            )}
                            
                            <text
                              x={node.x}
                              y={node.y + (node.is_leaf ? 18 : -16)}
                              textAnchor="middle"
                              className={`text-[9px] font-mono font-bold ${
                                node.isTampered ? "fill-red-400" : "fill-zinc-400"
                              }`}
                            >
                              {node.pos === "ROOT" ? "MMR ROOT" : node.is_leaf ? `Leaf #${node.leaf_index}` : `Pos ${node.pos}`}
                            </text>
                            
                            <title>
                              {`Node Position: ${node.pos}\nHeight: ${node.height}\nHash: ${node.hash || 'N/A'}\nStatus: ${node.isTampered ? 'COMPROMISED' : 'SECURE'}`}
                            </title>
                          </g>
                        );
                      })}
                    </svg>
                  );
                })()}
              </div>
            </div>

            {/* Audit log table */}
            <div className="bg-zinc-900/10 border border-zinc-900 rounded-xl p-5 md:p-6 space-y-4 col-span-1 md:col-span-2">
              <h3 className="text-xs font-mono uppercase tracking-widest text-zinc-400 flex items-center space-x-2">
                <Database className="h-4 w-4 text-zinc-500" />
                <span>Immutable Maintenance Registry Logs</span>
              </h3>
              
              <div className="overflow-x-auto no-scrollbar">
                <table className="w-full border-collapse text-[11px] text-left font-mono">
                  <thead>
                    <tr className="border-b border-zinc-900 text-zinc-550 font-semibold uppercase text-[10px] tracking-wider">
                      <th className="pb-3 pr-4">Leaf ID</th>
                      <th className="pb-3 px-4">Timestamp</th>
                      <th className="pb-3 px-4">Component</th>
                      <th className="pb-3 px-4">Action Taken</th>
                      <th className="pb-3 px-4">Technician</th>
                      <th className="pb-3 px-4">Health</th>
                      <th className="pb-3 pl-4">Cryptographic Hash</th>
                    </tr>
                  </thead>
                  <tbody>
                    {ledgerHistory.length > 0 ? (
                      ledgerHistory.map((row) => (
                        <tr key={row.leaf_index} className="border-b border-zinc-900/60 hover:bg-zinc-900/5 text-zinc-350">
                          <td className="py-3.5 pr-4 font-bold text-zinc-300">#{String(row.leaf_index).padStart(3, '0')}</td>
                          <td className="py-3.5 px-4 text-zinc-500 text-[10px]">
                            {mounted ? new Date(row.timestamp).toLocaleTimeString() : ""}<br/>
                            {mounted ? new Date(row.timestamp).toLocaleDateString() : ""}
                          </td>
                          <td className="py-3.5 px-4 font-bold text-zinc-300">{row.component_id}</td>
                          <td className="py-3.5 px-4">{row.action_taken}</td>
                          <td className="py-3.5 px-4 text-zinc-450">{row.technician_id}</td>
                          <td className="py-3.5 px-4 font-semibold text-zinc-300">{(row.health_snapshot * 100).toFixed(0)}%</td>
                          <td className="py-3.5 pl-4 text-zinc-500 text-[9.5px] select-all font-mono" title={row.node_hash}>
                            {row.node_hash ? `${row.node_hash.substring(0, 10)}...${row.node_hash.substring(row.node_hash.length - 10)}` : "N/A"}
                          </td>
                        </tr>
                      ))
                    ) : (
                      <tr>
                        <td colSpan={7} className="py-8 text-center text-zinc-550 font-mono">
                          NO ENTRIES COMMITTED. SIMULATE TELEMETRY DIAGNOSTICS TO TRIGGER SYSTEM LOGS.
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
