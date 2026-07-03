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
  Network,
  Plane,
  MapPin,
  Compass,
  ArrowLeft,
  Calendar,
  AlertCircle,
  HelpCircle,
  LogOut,
  Map,
  Server,
  Clock,
  Wind,
  Droplets,
  Thermometer
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

import { LoginScreen, HangarSelector, HangarDashboard, AssetDetail, SentinelGateway } from "./V3Views";

// Types
export interface EngineData {
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
  attribution?: { sensor: string; percentage: number }[];
}

export interface LedgerRecord {
  leaf_index: number;
  timestamp: string;
  component_id: string;
  action_taken: string;
  technician_id: string;
  health_snapshot: number;
  node_hash: string;
}

export interface FederatedRound {
  round: number;
  station_1_loss: number;
  station_2_loss: number;
  station_3_loss: number;
  global_loss: number;
}

const getBackendUrl = () => {
  if (typeof window !== "undefined") {
    const hostname = window.location.hostname;
    if (hostname === "localhost") {
      return "http://localhost:8000";
    }
  }
  return "http://127.0.0.1:8000";
};

const BACKEND_URL = getBackendUrl();

const MOCK_ATTRIBUTION_1 = [
  { sensor: "s11", percentage: 14.5 },
  { sensor: "s12", percentage: 12.2 },
  { sensor: "s15", percentage: 10.8 },
  { sensor: "s4", percentage: 9.5 },
  { sensor: "s3", percentage: 8.8 },
  { sensor: "s2", percentage: 7.5 },
  { sensor: "s7", percentage: 6.8 },
  { sensor: "s8", percentage: 6.2 },
  { sensor: "s9", percentage: 5.8 },
  { sensor: "s13", percentage: 5.5 },
  { sensor: "s14", percentage: 5.2 },
  { sensor: "s17", percentage: 4.2 },
  { sensor: "s20", percentage: 1.8 },
  { sensor: "s21", percentage: 1.2 }
];

const MOCK_ATTRIBUTION_2 = [
  { sensor: "s3", percentage: 22.1 },
  { sensor: "s11", percentage: 18.4 },
  { sensor: "s4", percentage: 12.5 },
  { sensor: "s12", percentage: 9.2 },
  { sensor: "s15", percentage: 8.8 },
  { sensor: "s2", percentage: 6.5 },
  { sensor: "s7", percentage: 5.8 },
  { sensor: "s8", percentage: 4.2 },
  { sensor: "s9", percentage: 3.8 },
  { sensor: "s13", percentage: 3.5 },
  { sensor: "s14", percentage: 2.2 },
  { sensor: "s17", percentage: 1.8 },
  { sensor: "s20", percentage: 0.8 },
  { sensor: "s21", percentage: 0.4 }
];

const MOCK_ATTRIBUTION_3 = [
  { sensor: "s12", percentage: 28.4 },
  { sensor: "s11", percentage: 24.2 },
  { sensor: "s15", percentage: 14.8 },
  { sensor: "s4", percentage: 10.5 },
  { sensor: "s3", percentage: 6.8 },
  { sensor: "s2", percentage: 4.5 },
  { sensor: "s7", percentage: 3.8 },
  { sensor: "s8", percentage: 2.2 },
  { sensor: "s9", percentage: 1.8 },
  { sensor: "s13", percentage: 1.5 },
  { sensor: "s14", percentage: 0.9 },
  { sensor: "s17", percentage: 0.4 },
  { sensor: "s20", percentage: 0.2 },
  { sensor: "s21", percentage: 0.1 }
];

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
    }),
    attribution: MOCK_ATTRIBUTION_1
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
    }),
    attribution: MOCK_ATTRIBUTION_2
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
    }),
    attribution: MOCK_ATTRIBUTION_3
  }
};

export interface PlaneData {
  id: string;
  name: string;
  model: string;
  origin: string;
  originName: string;
  destination: string;
  destinationName: string;
  status: "Airborne" | "Ready" | "Maintenance";
  phase: "Pre-Flight" | "Takeoff" | "Cruise" | "Descent" | "Landed" | "Maintenance";
  progress: number;
  speed: number;
  altitude: number;
  engines: string[];
  fuel: number;
  routeCoordinates: { x: number; y: number }[];
}

export const HUB_COORDINATES: Record<string, { x: number; y: number; name: string }> = {
  "SEA": { x: 100, y: 100, name: "Seattle (SEA)" },
  "LHR": { x: 320, y: 95, name: "London (LHR)" },
  "BOM": { x: 460, y: 160, name: "Mumbai (BOM)" }
};

export const getControlPoint = (origin: string, destination: string) => {
  const p0 = HUB_COORDINATES[origin];
  const p2 = HUB_COORDINATES[destination];
  if (!p0 || !p2) return { x: 200, y: 100 };
  const midX = (p0.x + p2.x) / 2;
  const midY = (p0.y + p2.y) / 2;
  let offset = -20;
  if ((origin === "SEA" && destination === "BOM") || (origin === "BOM" && destination === "SEA")) {
    offset = -30;
  }
  return { x: midX, y: midY + offset };
};

const INITIAL_PLANES: Record<string, PlaneData> = {
  "PL-101": {
    id: "PL-101",
    name: "Airbus A350 - Alpha 101",
    model: "A350-900 XWB",
    origin: "SEA",
    originName: "Seattle (SEA)",
    destination: "LHR",
    destinationName: "London (LHR)",
    status: "Airborne",
    phase: "Cruise",
    progress: 45,
    speed: 510,
    altitude: 35000,
    engines: ["ENG-001"],
    fuel: 62,
    routeCoordinates: [
      { x: 100, y: 100 },  // Seattle
      { x: 210, y: 75 },   // Mid Atlantic Control
      { x: 320, y: 95 }    // London
    ]
  },
  "PL-202": {
    id: "PL-202",
    name: "Boeing 787 - Beta 202",
    model: "787-9 Dreamliner",
    origin: "LHR",
    originName: "London (LHR)",
    destination: "BOM",
    destinationName: "Mumbai (BOM)",
    status: "Airborne",
    phase: "Cruise",
    progress: 20,
    speed: 495,
    altitude: 37000,
    engines: ["ENG-002"],
    fuel: 78,
    routeCoordinates: [
      { x: 320, y: 95 },   // London
      { x: 390, y: 110 },  // Middle East Control
      { x: 460, y: 160 }   // Mumbai
    ]
  },
  "PL-303": {
    id: "PL-303",
    name: "Airbus A320 - Gamma 303",
    model: "A320neo",
    origin: "BOM",
    originName: "Mumbai (BOM)",
    destination: "SEA",
    destinationName: "Seattle (SEA)",
    status: "Ready",
    phase: "Pre-Flight",
    progress: 0,
    speed: 0,
    altitude: 0,
    engines: ["ENG-003"],
    fuel: 100,
    routeCoordinates: [
      { x: 460, y: 160 },  // Mumbai
      { x: 280, y: 110 },  // North Pacific Control
      { x: 100, y: 100 }   // Seattle
    ]
  }
};

const getBezierCoordinates = (
  p0: { x: number; y: number },
  p1: { x: number; y: number },
  p2: { x: number; y: number },
  t: number
) => {
  const u = 1 - t;
  const tt = t * t;
  const uu = u * u;
  
  const x = uu * p0.x + 2 * u * t * p1.x + tt * p2.x;
  const y = uu * p0.y + 2 * u * t * p1.y + tt * p2.y;
  
  return { x, y };
};

const getPlaneCoordinates = (plane: PlaneData) => {
  const p = plane.routeCoordinates;
  const t = plane.progress / 100;
  
  if (p.length === 3) {
    return getBezierCoordinates(p[0], p[1], p[2], t);
  }
  return p[0];
};

const SENSOR_METADATA: Record<string, { label: string; desc: string }> = {
  s2: { label: "LPC Outlet Temp", desc: "Temperature of the airflow at the exit of the Low Pressure Compressor." },
  s3: { label: "HPC Outlet Temp", desc: "High Pressure Compressor exit temperature, indicating thermal stress." },
  s4: { label: "LPT Outlet Temp", desc: "Low Pressure Turbine exit temperature, reflecting exhaust gas heat." },
  s7: { label: "Bypass Ratio", desc: "Ratio of bypass duct flow to core flow; changes affect thrust efficiency." },
  s8: { label: "Fan Speed", desc: "Rotational velocity of the intake bypass fan blades." },
  s9: { label: "Core Speed", desc: "Rotational velocity of the high-pressure spool/shaft." },
  s11: { label: "HPT Coolant Bleed", desc: "High Pressure Turbine coolant bleed flow temp; critical wear factor." },
  s12: { label: "LPT Coolant Bleed", desc: "Low Pressure Turbine coolant bleed flow temp; indicates seal wear." },
  s13: { label: "Bleed Enthalpy", desc: "Thermodynamic energy state of the bleed air system." },
  s14: { label: "Demand Factor", desc: "Engine performance demand output compared to designed limits." },
  s15: { label: "Bypass Ratio", desc: "Physical bypass ratio flow; deviations point to bypass duct drag." },
  s17: { label: "Pressure Ratio", desc: "Overall engine pressure ratio; changes reflect structural leaks." },
  s20: { label: "HPT Speed", desc: "Rotational velocity of the High Pressure Turbine." },
  s21: { label: "LPT Speed", desc: "Rotational velocity of the Low Pressure Turbine." }
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
  
  // V3 states
  const [viewState, setViewState] = useState<'login' | 'hangar-select' | 'dashboard' | 'asset-detail' | 'sentinel-gate'>('login');
  const [selectedHangar, setSelectedHangar] = useState<string | null>(null);
  const [selectedPlaneId, setSelectedPlaneId] = useState<string | null>(null);
  const [hoveredPlaneId, setHoveredPlaneId] = useState<string | null>(null);
  const [planes, setPlanes] = useState<Record<string, PlaneData>>(INITIAL_PLANES);
  
  // Hangar credentials login
  const [hangarAccessKey, setHangarAccessKey] = useState("");
  const [hangarAccessPin, setHangarAccessPin] = useState("");
  const [hangarAccessError, setHangarAccessError] = useState("");
  const [isHangarModalOpen, setIsHangarModalOpen] = useState(false);

  // Backend statuses
  const [backendOnline, setBackendOnline] = useState(false);
  const [isInferring, setIsInferring] = useState(false);
  const [isFederating, setIsFederating] = useState(false);
  const [isVerifying, setIsVerifying] = useState(false);
  
  // WebSocket streaming states
  const [isStreaming, setIsStreaming] = useState(true);
  const [lastHoveredPlaneId, setLastHoveredPlaneId] = useState<string>("PL-101");
  const [streamingRate, setStreamingRate] = useState(1000);
  const [hoveredSensor, setHoveredSensor] = useState<string | null>(null);

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

            // V3: Live coordinates and flight state update
            setPlanes(prev => {
              const nextPlanes = { ...prev };
              Object.keys(nextPlanes).forEach(id => {
                const plane = nextPlanes[id];
                const primaryEngId = plane.engines[0];
                
                // Get updated engine details from incoming WebSocket message or local state
                let engHealth = engines[primaryEngId]?.health ?? 1.0;
                if (data.engines && data.engines[primaryEngId]) {
                  engHealth = data.engines[primaryEngId].health_score;
                }
                const isEngineCritical = engHealth < 0.30;

                if (isEngineCritical) {
                  // Ground the aircraft and place it under Maintenance
                  nextPlanes[id] = {
                    ...plane,
                    status: "Maintenance",
                    phase: "Maintenance",
                    progress: 0,
                    altitude: 0,
                    speed: 0
                  };
                  return;
                }

                if (plane.status === "Airborne") {
                  let nextProgress = plane.progress + 0.5; // 200s flight duration
                  let nextPhase = plane.phase;
                  let nextAltitude = plane.altitude;
                  let nextSpeed = plane.speed;
                  let nextFuel = Math.max(5, plane.fuel - 0.08); // Slowed fuel burn matching duration

                  if (nextProgress >= 100) {
                    const currentDest = plane.destination;
                    const possibleDests = Object.keys(HUB_COORDINATES).filter(k => k !== currentDest);
                    const nextDest = possibleDests[Math.floor(Math.random() * possibleDests.length)];
                    
                    const p0 = HUB_COORDINATES[currentDest];
                    const p1 = getControlPoint(currentDest, nextDest);
                    const p2 = HUB_COORDINATES[nextDest];

                    nextPlanes[id] = {
                      ...plane,
                      status: "Ready",
                      phase: "Landed",
                      progress: 0,
                      altitude: 0,
                      speed: 0,
                      fuel: 100,
                      origin: currentDest,
                      originName: HUB_COORDINATES[currentDest].name,
                      destination: nextDest,
                      destinationName: HUB_COORDINATES[nextDest].name,
                      routeCoordinates: [p0, p1, p2]
                    };
                  } else {
                    if (nextProgress < 15) {
                      nextPhase = "Takeoff";
                      nextAltitude = Math.round(nextProgress * 2000);
                      nextSpeed = Math.round(150 + nextProgress * 20);
                    } else if (nextProgress >= 15 && nextProgress < 85) {
                      nextPhase = "Cruise";
                      nextAltitude = 35000 + (nextProgress % 3) * 500;
                      nextSpeed = 500 + (nextProgress % 2) * 10;
                    } else {
                      nextPhase = "Descent";
                      const descentPct = (100 - nextProgress) / 15;
                      nextAltitude = Math.round(descentPct * 35000);
                      nextSpeed = Math.round(150 + descentPct * 350);
                    }

                    nextPlanes[id] = {
                      ...plane,
                      progress: nextProgress,
                      phase: nextPhase,
                      altitude: nextAltitude,
                      speed: nextSpeed,
                      fuel: parseFloat(nextFuel.toFixed(2))
                    };
                  }
                } else if (plane.status === "Ready") {
                  // Parked gate cooldown/pre-flight verification
                  let nextDwell = plane.progress + 1;
                  if (nextDwell >= 45) { // 45 seconds gate cooldown
                    if (!isEngineCritical) {
                      nextPlanes[id] = {
                        ...plane,
                        status: "Airborne",
                        phase: "Takeoff",
                        progress: 0.1,
                        speed: 150,
                        altitude: 500,
                        fuel: 100
                      };
                    } else {
                      nextPlanes[id] = {
                        ...plane,
                        status: "Maintenance",
                        phase: "Maintenance",
                        progress: 0,
                        altitude: 0,
                        speed: 0
                      };
                    }
                  } else {
                    nextPlanes[id] = {
                      ...plane,
                      progress: nextDwell,
                      phase: "Pre-Flight"
                    };
                  }
                } else if (plane.status === "Maintenance") {
                  let nextMaintTime = plane.progress + 1;
                  if (nextMaintTime >= 10) { // 10 seconds auto-maintenance release
                    triggerAutoMaintenanceOverhaul(primaryEngId);
                    nextPlanes[id] = {
                      ...plane,
                      progress: 0
                    };
                  } else {
                    nextPlanes[id] = {
                      ...plane,
                      progress: nextMaintTime
                    };
                  }
                }
              });
              return nextPlanes;
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
        console.warn("WebSocket telemetry error:", e);
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
    tampered_indices?: number[];
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
      setViewState("hangar-select");
    } else {
      setLoginError("Invalid Security Clearance PIN.");
    }
  };

  useEffect(() => {
    setMounted(true);
    const init = async () => {
      const online = await checkBackendHealth();
      if (online) {
        fetchLedgerHistory();
        fetchFederatedHistory();
      }
    };
    init();
  }, []);

  // V3: Auto-trigger Federated Calibration sync weight update every 30 seconds
  useEffect(() => {
    if (!backendOnline) return;
    const interval = setInterval(() => {
      console.log("Triggering auto-federated synchronization round...");
      runFederatedRound();
    }, 30000);
    return () => clearInterval(interval);
  }, [backendOnline]);

  const checkBackendHealth = async (): Promise<boolean> => {
    try {
      const res = await fetch(`${BACKEND_URL}/`);
      if (res.ok) {
        setBackendOnline(true);
        return true;
      } else {
        setBackendOnline(false);
        return false;
      }
    } catch {
      setBackendOnline(false);
      return false;
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
      console.warn("Failed to load ledger history:", e);
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
      console.warn("Failed to load federated history:", e);
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
      console.warn("Error contacting aggregation server:", e);
      setBackendOnline(false);
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
          stored_root: data.stored_root,
          tampered_indices: data.tampered_indices
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
      console.warn("Error triggering tamper route:", e);
      setBackendOnline(false);
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
        // V3: Reset corresponding aircraft status and release maintenance interlock on overhaul
        setPlanes(prev => {
          const nextPlanes = { ...prev };
          const targetPlaneId = Object.keys(nextPlanes).find(key => nextPlanes[key].engines.includes(formEngine));
          if (targetPlaneId) {
            const plane = nextPlanes[targetPlaneId];
            nextPlanes[targetPlaneId] = {
              ...plane,
              status: "Ready",
              phase: "Pre-Flight",
              progress: 0,
              altitude: 0,
              speed: 0,
              fuel: 100
            };
          }
          return nextPlanes;
        });

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
      console.warn("Error committing ledger:", err);
      setBackendOnline(false);
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
        body: JSON.stringify({ sensor_matrix: simulatedMatrix, explain: true })
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

        // V3: Advance matching aircraft telemetry cycles dynamically
        setPlanes(prev => {
          const nextPlanes = { ...prev };
          const targetPlaneId = Object.keys(nextPlanes).find(key => nextPlanes[key].engines.includes(engineId));
          if (targetPlaneId) {
            const plane = nextPlanes[targetPlaneId];
            const isEngineCritical = result.health_score < 0.30;

            if (isEngineCritical) {
              nextPlanes[targetPlaneId] = {
                ...plane,
                status: "Maintenance",
                phase: "Maintenance",
                progress: 0,
                altitude: 0,
                speed: 0
              };
              return nextPlanes;
            }

            if (plane.status !== "Airborne") {
              plane.status = "Airborne";
            }
            let nextProgress = plane.progress + 5;
            let nextPhase = plane.phase;
            let nextAltitude = plane.altitude;
            let nextSpeed = plane.speed;
            let nextFuel = Math.max(5, plane.fuel - 1.5);

            if (nextProgress >= 100) {
              nextProgress = 0;
              nextPhase = "Landed";
              nextAltitude = 0;
              nextSpeed = 0;
              nextFuel = 100;
              plane.status = "Ready";
            } else if (nextProgress < 15) {
              nextPhase = "Takeoff";
              nextAltitude = Math.round(nextProgress * 2000);
              nextSpeed = Math.round(150 + nextProgress * 20);
            } else if (nextProgress >= 15 && nextProgress < 85) {
              nextPhase = "Cruise";
              nextAltitude = 35000 + (nextProgress % 3) * 500;
              nextSpeed = 500 + (nextProgress % 2) * 10;
            } else {
              nextPhase = "Descent";
              const descentPct = (100 - nextProgress) / 15;
              nextAltitude = Math.round(descentPct * 35000);
              nextSpeed = Math.round(150 + descentPct * 350);
            }

            nextPlanes[targetPlaneId] = {
              ...plane,
              progress: nextProgress,
              phase: nextPhase,
              altitude: nextAltitude,
              speed: nextSpeed,
              fuel: parseFloat(nextFuel.toFixed(1))
            };
          }
          return nextPlanes;
        });

        if (result.anomaly_flag) {
          triggerAutoLedgerAppend(engineId, result.health_score, result.predicted_rul);
        }
      }
    } catch (e) {
      console.warn("Inference request failed:", e);
    } finally {
      setIsInferring(false);
    }
  };

  const triggerAutoMaintenanceOverhaul = async (engineId: string) => {
    const timestamp = new Date().toISOString();
    const action = "Auto-Overhaul Maintenance Release";
    const tech = "AUTO-MRO-BOT";
    const station = "STATION_001";
    const health = 1.0;
    const message = `${timestamp}|${engineId}|${action}|${tech}|${health}`;

    try {
      const signRes = await fetch(`${BACKEND_URL}/api/v1/ledger/sign`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ station_id: station, message: message })
      });
      
      if (signRes.ok) {
        const { signature } = await signRes.json();
        const appendRes = await fetch(`${BACKEND_URL}/api/v1/ledger/append`, {
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

        if (appendRes.ok) {
          fetchLedgerHistory();
          // Update engine health state locally
          setEngines(prev => {
            const target = prev[engineId];
            if (!target) return prev;
            return {
              ...prev,
              [engineId]: {
                ...target,
                cycle: 1,
                health: 1.0,
                rul: 125,
                status: "Nominal"
              }
            };
          });
          // Release maintenance hold on plane
          setPlanes(prev => {
            const nextPlanes = { ...prev };
            const targetPlaneId = Object.keys(nextPlanes).find(key => nextPlanes[key].engines.includes(engineId));
            if (targetPlaneId) {
              const plane = nextPlanes[targetPlaneId];
              nextPlanes[targetPlaneId] = {
                ...plane,
                status: "Ready",
                phase: "Pre-Flight",
                progress: 0,
                altitude: 0,
                speed: 0,
                fuel: 100
              };
            }
            return nextPlanes;
          });
        }
      }
    } catch (e) {
      console.warn("Failed automatic maintenance overhaul:", e);
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
      console.warn("Auto ledger append failed:", e);
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

  // --- CLIENT ROUTER ---
  if (viewState === "login") {
    return (
      <LoginScreen 
        loginTechId={loginTechId}
        setLoginTechId={setLoginTechId}
        loginPin={loginPin}
        setLoginPin={setLoginPin}
        loginError={loginError}
        onSubmit={handleLogin}
      />
    );
  }

  if (viewState === "hangar-select") {
    return (
      <HangarSelector
        selectedHangar={selectedHangar}
        setSelectedHangar={setSelectedHangar}
        hangarAccessKey={hangarAccessKey}
        setHangarAccessKey={setHangarAccessKey}
        hangarAccessPin={hangarAccessPin}
        setHangarAccessPin={setHangarAccessPin}
        hangarAccessError={hangarAccessError}
        setHangarAccessError={setHangarAccessError}
        isHangarModalOpen={isHangarModalOpen}
        setIsHangarModalOpen={setIsHangarModalOpen}
        setViewState={setViewState}
      />
    );
  }

  if (viewState === "dashboard") {
    return (
      <HangarDashboard
        selectedHangar={selectedHangar}
        setSelectedHangar={setSelectedHangar}
        setViewState={setViewState}
        planes={planes}
        setSelectedPlaneId={setSelectedPlaneId}
        hoveredPlaneId={hoveredPlaneId}
        setHoveredPlaneId={setHoveredPlaneId}
        lastHoveredPlaneId={lastHoveredPlaneId}
        setLastHoveredPlaneId={setLastHoveredPlaneId}
        engines={engines}
        isStreaming={isStreaming}
        backendOnline={backendOnline}
        runFederatedRound={runFederatedRound}
        isFederating={isFederating}
        federatedHistory={federatedHistory}
        mounted={mounted}
      />
    );
  }

  if (viewState === "asset-detail") {
    return (
      <AssetDetail
        selectedPlaneId={selectedPlaneId}
        setSelectedPlaneId={setSelectedPlaneId}
        setViewState={setViewState}
        planes={planes}
        engines={engines}
        setSelectedEngineId={setSelectedEngineId}
        ledgerHistory={ledgerHistory}
      />
    );
  }

  // viewState === 'sentinel-gate'
  return (
    <SentinelGateway
      selectedEngineId={selectedEngineId}
      setSelectedEngineId={setSelectedEngineId}
      viewState={viewState}
      setViewState={setViewState}
      planes={planes}
      setSelectedPlaneId={setSelectedPlaneId}
      engines={engines}
      isStreaming={isStreaming}
      setIsStreaming={setIsStreaming}
      streamingRate={streamingRate}
      handleRateChange={handleRateChange}
      streamNextCycle={streamNextCycle}
      isInferring={isInferring}
      backendOnline={backendOnline}
      activeTab={activeTab}
      setActiveTab={setActiveTab}
      hoveredSensor={hoveredSensor}
      setHoveredSensor={setHoveredSensor}
      verifyLedgerIntegrity={verifyLedgerIntegrity}
      isVerifying={isVerifying}
      simulateTampering={simulateTampering}
      verificationResult={verificationResult}
      rootHash={rootHash}
      formEngine={formEngine}
      setFormEngine={setFormEngine}
      formAction={formAction}
      setFormAction={setFormAction}
      formStation={formStation}
      setFormStation={setFormStation}
      formHealth={formHealth}
      setFormHealth={setFormHealth}
      formSuccessMessage={formSuccessMessage}
      handleManualAppend={handleManualAppend}
      nodes={nodes}
      ledgerHistory={ledgerHistory}
      mounted={mounted}
      lastHoveredPlaneId={lastHoveredPlaneId}
    />
  );
}
