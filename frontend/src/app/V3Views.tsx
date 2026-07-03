"use client";

import React from "react";
import {
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
  Thermometer,
  Shield,
  Play,
  Terminal,
  Activity,
  AlertTriangle,
  Layers,
  Settings,
  Cpu,
  Database,
  CheckCircle,
  Lock
} from "lucide-react";
import {
  LineChart,
  Line,
  XAxis,
  YAxis,
  CartesianGrid,
  Tooltip,
  ResponsiveContainer
} from "recharts";

import { PlaneData, EngineData, LedgerRecord, FederatedRound, HUB_COORDINATES, getControlPoint } from "./page";

// --- HELPERS ---
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
  if (plane.status !== "Airborne") {
    return p[0];
  }
  const t = plane.progress / 100;
  
  if (p.length === 3) {
    return getBezierCoordinates(p[0], p[1], p[2], t);
  }
  return p[0];
};

const getStatusColor = (status: "Nominal" | "Warning" | "Critical") => {
  if (status === "Nominal") return "text-emerald-400";
  if (status === "Warning") return "text-amber-500 font-bold";
  return "text-red-500 font-bold animate-pulse";
};

const getHealthBarColor = (health: number) => {
  if (health >= 0.75) return "bg-emerald-500";
  if (health >= 0.35) return "bg-amber-500";
  return "bg-red-500 animate-pulse";
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

// --- VIEW 1: LOGIN SCREEN ---
interface LoginScreenProps {
  loginTechId: string;
  setLoginTechId: (v: string) => void;
  loginPin: string;
  setLoginPin: (v: string) => void;
  loginError: string;
  onSubmit: (e: React.FormEvent) => void;
}

export function LoginScreen({
  loginTechId,
  setLoginTechId,
  loginPin,
  setLoginPin,
  loginError,
  onSubmit
}: LoginScreenProps) {
  return (
    <div className="flex-1 flex items-center justify-center min-h-[85vh] p-4 bg-zinc-950 text-zinc-100 select-none">
      <div className="w-full max-w-sm p-8 bg-zinc-900/10 border border-zinc-900 rounded-lg shadow-2xl space-y-6">
        <div>
          <span className="text-[10px] font-mono text-zinc-500 tracking-[0.3em] block">SECURE CREDENTIAL CHECK</span>
          <h1 className="text-xl font-bold tracking-wider text-zinc-100 uppercase font-sans text-left">SENTINEL<span className="text-zinc-500 font-light font-sans">MRO</span></h1>
        </div>
        {loginError && (
          <div className="p-3 bg-red-950/20 border border-red-500/20 rounded text-[11px] text-red-400 font-mono text-center">
            {loginError}
          </div>
        )}
        <form onSubmit={onSubmit} className="space-y-4 text-left">
          <div className="space-y-1">
            <label className="text-[9px] font-mono text-zinc-500 uppercase">Technician ID / PubKey</label>
            <input 
              type="text" 
              value={loginTechId} 
              onChange={e => setLoginTechId(e.target.value)} 
              className="w-full bg-zinc-950 border border-zinc-800 px-3 py-2 text-zinc-200 text-xs font-mono rounded outline-none focus:border-zinc-700" 
            />
          </div>
          <div className="space-y-1">
            <label className="text-[9px] font-mono text-zinc-500 uppercase">Access Clearance PIN</label>
            <input 
              type="password" 
              value={loginPin} 
              onChange={e => setLoginPin(e.target.value)} 
              className="w-full bg-zinc-950 border border-zinc-800 px-3 py-2 text-zinc-200 text-xs font-mono rounded text-center outline-none focus:border-zinc-700" 
            />
          </div>
          <button type="submit" className="w-full py-2 bg-zinc-100 hover:bg-white text-zinc-950 text-xs font-mono font-bold uppercase rounded cursor-pointer transition-all active:scale-[0.98]">
            Authorize Node
          </button>
        </form>
        <div className="text-[9px] font-mono text-zinc-500 border-t border-zinc-900 pt-4 flex justify-between">
          <span>KEY: ed25519-pub-admin-948</span>
          <span>PIN: 7700</span>
        </div>
      </div>
    </div>
  );
}

// --- VIEW 2: HANGAR SELECTOR ---
interface HangarSelectorProps {
  selectedHangar: string | null;
  setSelectedHangar: (v: string | null) => void;
  hangarAccessKey: string;
  setHangarAccessKey: (v: string) => void;
  hangarAccessPin: string;
  setHangarAccessPin: (v: string) => void;
  hangarAccessError: string;
  setHangarAccessError: (v: string) => void;
  isHangarModalOpen: boolean;
  setIsHangarModalOpen: (v: boolean) => void;
  setViewState: (v: 'login' | 'hangar-select' | 'dashboard' | 'asset-detail' | 'sentinel-gate') => void;
}

export function HangarSelector({
  selectedHangar,
  setSelectedHangar,
  hangarAccessKey,
  setHangarAccessKey,
  hangarAccessPin,
  setHangarAccessPin,
  hangarAccessError,
  setHangarAccessError,
  isHangarModalOpen,
  setIsHangarModalOpen,
  setViewState
}: HangarSelectorProps) {
  return (
    <div className="flex-1 flex flex-col justify-center max-w-4xl mx-auto w-full p-4 space-y-6 bg-zinc-950 text-zinc-100 min-h-[80vh] select-none">
      <div className="space-y-1">
        <span className="text-[10px] font-mono text-zinc-500 uppercase tracking-widest block text-left">Global Fleet Access Gateway</span>
        <h1 className="text-xl font-bold tracking-wider text-zinc-100 uppercase font-mono text-left">SELECT HANGAR OPERATIONS NODE</h1>
      </div>
      
      <div className="grid grid-cols-1 md:grid-cols-3 gap-4 text-left">
        {[
          { id: "hangar-01", name: "Mumbai Hub Alpha", code: "STATION_001", loc: "BOM", temp: "31°C", clear: "L1-Station", hint: "mumbai-clearance" },
          { id: "hangar-02", name: "London Hub Bravo", code: "STATION_002", loc: "LHR", temp: "18°C", clear: "L1-Station", hint: "london-clearance" },
          { id: "hangar-03", name: "Seattle Hub Charlie", code: "STATION_003", loc: "SEA", temp: "15°C", clear: "L1-Station", hint: "seattle-clearance" }
        ].map(h => (
          <div 
            key={h.id} 
            onClick={() => {
              setSelectedHangar(h.id);
              setHangarAccessKey(h.code);
              setHangarAccessPin(h.hint);
              setHangarAccessError("");
              setIsHangarModalOpen(true);
            }} 
            className="p-6 bg-zinc-900/10 border border-zinc-900 hover:border-zinc-700 rounded-xl cursor-pointer transition-all space-y-4 hover:scale-[1.02]"
          >
            <div className="flex justify-between items-center">
              <span className="text-[10px] font-mono bg-zinc-900 px-2 py-0.5 rounded text-zinc-500">{h.code}</span>
              <span className="text-[10px] font-mono text-emerald-400 font-bold">{h.clear}</span>
            </div>
            <div>
              <h3 className="font-bold text-zinc-200 text-sm font-sans">{h.name}</h3>
              <p className="text-[11px] text-zinc-500 font-mono mt-1">HUB CODE: {h.loc} | {h.temp}</p>
            </div>
            <div className="text-[9px] font-mono text-zinc-600 border-t border-zinc-900/60 pt-3">
              PASS: {h.hint}
            </div>
          </div>
        ))}
      </div>

      {isHangarModalOpen && (
        <div className="fixed inset-0 bg-black/80 flex items-center justify-center p-4 z-50 backdrop-blur-sm">
          <div className="w-full max-w-sm bg-zinc-950 border border-zinc-900 p-6 rounded-xl space-y-5 text-left">
            <div>
              <h3 className="text-xs font-mono uppercase tracking-widest text-zinc-400">Node Authentication</h3>
              <p className="text-[10px] text-zinc-500 font-sans mt-0.5">Authorize access to operations terminal.</p>
            </div>
            {hangarAccessError && <div className="p-2 bg-red-950/20 border border-red-500/20 text-red-400 text-[10px] font-mono rounded text-center">{hangarAccessError}</div>}
            <div className="space-y-3 font-mono text-[11px]">
              <div>
                <label className="text-zinc-500 block text-[9px] mb-1">Station Access ID</label>
                <input type="text" value={hangarAccessKey} disabled className="w-full bg-zinc-900 border border-zinc-800 p-2 rounded text-zinc-400 cursor-not-allowed" />
              </div>
              <div>
                <label className="text-zinc-500 block text-[9px] mb-1">Hangar Passphrase</label>
                <input type="password" value={hangarAccessPin} onChange={e => setHangarAccessPin(e.target.value)} placeholder="••••••••" className="w-full bg-zinc-900 border border-zinc-800 p-2 rounded text-zinc-100 outline-none focus:border-zinc-700 font-mono tracking-widest text-center" />
              </div>
            </div>
            <div className="flex space-x-3 text-xs font-mono">
              <button onClick={() => setIsHangarModalOpen(false)} className="flex-1 py-2 border border-zinc-800 hover:border-zinc-750 text-zinc-400 rounded cursor-pointer">Cancel</button>
              <button 
                onClick={() => {
                  const verified = 
                    (selectedHangar === "hangar-01" && hangarAccessKey === "STATION_001" && hangarAccessPin === "mumbai-clearance") ||
                    (selectedHangar === "hangar-02" && hangarAccessKey === "STATION_002" && hangarAccessPin === "london-clearance") ||
                    (selectedHangar === "hangar-03" && hangarAccessKey === "STATION_003" && hangarAccessPin === "seattle-clearance");
                  
                  if (verified) {
                    setIsHangarModalOpen(false);
                    setViewState("dashboard");
                  } else {
                    setHangarAccessError("Invalid Credentials.");
                  }
                }} 
                className="flex-1 py-2 bg-zinc-100 hover:bg-white text-zinc-950 font-bold rounded cursor-pointer"
              >
                Authenticate
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}

// --- VIEW 3: HANGAR OPERATIONS CONTROL ---
interface HangarDashboardProps {
  selectedHangar: string | null;
  setSelectedHangar: (v: string | null) => void;
  setViewState: (v: 'login' | 'hangar-select' | 'dashboard' | 'asset-detail' | 'sentinel-gate') => void;
  planes: Record<string, PlaneData>;
  setSelectedPlaneId: (v: string | null) => void;
  hoveredPlaneId: string | null;
  setHoveredPlaneId: (v: string | null) => void;
  lastHoveredPlaneId: string;
  setLastHoveredPlaneId: (v: string) => void;
  engines: Record<string, EngineData>;
  isStreaming: boolean;
  backendOnline: boolean;
  runFederatedRound: () => void;
  isFederating: boolean;
  federatedHistory: FederatedRound[];
  mounted: boolean;
}

export function HangarDashboard({
  selectedHangar,
  setSelectedHangar,
  setViewState,
  planes,
  setSelectedPlaneId,
  hoveredPlaneId,
  setHoveredPlaneId,
  lastHoveredPlaneId,
  setLastHoveredPlaneId,
  engines,
  isStreaming,
  backendOnline,
  runFederatedRound,
  isFederating,
  federatedHistory,
  mounted
}: HangarDashboardProps) {
  const hangarName = 
    selectedHangar === "hangar-01" ? "Mumbai Air Command Hub (Hub BOM)" :
    selectedHangar === "hangar-02" ? "London Air Command Hub (Hub LHR)" : "Seattle Air Command Hub (Hub SEA)";
  const stationId = 
    selectedHangar === "hangar-01" ? "STATION_001" :
    selectedHangar === "hangar-02" ? "STATION_002" : "STATION_003";

  // Active HUD aircraft lookup
  const activeHudPlaneId = hoveredPlaneId || lastHoveredPlaneId || "PL-101";
  const activeHudPlane = planes[activeHudPlaneId] || planes["PL-101"];
  const primaryHudEng = engines[activeHudPlane.engines[0]];
  const hudHealthPct = primaryHudEng ? (primaryHudEng.health * 100).toFixed(0) : "100";
  const hudRul = primaryHudEng ? primaryHudEng.rul : "125";

  return (
    <div className="flex-1 flex flex-col space-y-6 bg-zinc-950 text-zinc-100 font-sans max-w-7xl mx-auto w-full p-4 md:p-6 select-none">
      {/* Header */}
      <header className="flex flex-col md:flex-row md:items-center justify-between border-b border-zinc-900 pb-5 gap-4">
        <div className="space-y-1">
          <span className="text-[9px] font-mono text-zinc-500 uppercase tracking-[0.25em] block text-left">
            Global Hangar Control Terminal
          </span>
          <h1 className="text-xl font-bold tracking-wider text-zinc-100 uppercase font-mono text-left">
            {hangarName}
          </h1>
        </div>
        <div className="flex items-center gap-3 text-[10px] font-mono">
          <div className="border border-zinc-900 px-3 py-1 bg-zinc-900/10 rounded">
            NODE CLEARANCE: <strong className="text-emerald-400">{stationId}</strong>
          </div>
          <button 
            onClick={() => {
              setViewState("hangar-select");
              setSelectedHangar(null);
            }} 
            className="border border-zinc-800 hover:border-zinc-600 px-3 py-1 rounded text-zinc-300 font-bold transition-all cursor-pointer bg-zinc-900/10"
          >
            DISCONNECT NODE
          </button>
        </div>
      </header>

      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
        {/* Left Column: Environmental Telemetry & Scrollable Catalog */}
        <div className="lg:col-span-1 space-y-6">
          
          {/* Station Environmental info */}
          <div className="bg-zinc-900/10 border border-zinc-900 rounded-xl p-5 space-y-4 text-left">
            <h3 className="text-xs font-mono uppercase tracking-widest text-zinc-400 flex items-center space-x-2">
              <Server className="h-4 w-4 text-zinc-500" />
              <span>Station Environmental Telemetry</span>
            </h3>
            <div className="grid grid-cols-3 gap-2 text-center text-xs font-mono py-2">
              <div className="p-2.5 bg-zinc-950 border border-zinc-900/60 rounded-md">
                <Thermometer className="h-4 w-4 mx-auto mb-1 text-zinc-500" />
                <span className="text-[9px] text-zinc-500 block">TEMP</span>
                <strong className="text-zinc-200">{selectedHangar === "hangar-01" ? "31°C" : selectedHangar === "hangar-02" ? "18°C" : "15°C"}</strong>
              </div>
              <div className="p-2.5 bg-zinc-950 border border-zinc-900/60 rounded-md">
                <Droplets className="h-4 w-4 mx-auto mb-1 text-zinc-500" />
                <span className="text-[9px] text-zinc-500 block">HUMID</span>
                <strong className="text-zinc-200">{selectedHangar === "hangar-01" ? "82%" : selectedHangar === "hangar-02" ? "65%" : "50%"}</strong>
              </div>
              <div className="p-2.5 bg-zinc-950 border border-zinc-900/60 rounded-md">
                <Wind className="h-4 w-4 mx-auto mb-1 text-zinc-500" />
                <span className="text-[9px] text-zinc-500 block">WIND</span>
                <strong className="text-zinc-200">12 kt</strong>
              </div>
            </div>
          </div>

          {/* Scrollable Hangar Catalog List */}
          <div className="bg-zinc-900/10 border border-zinc-900 rounded-xl p-5 space-y-4 text-left">
            <h3 className="text-xs font-mono uppercase tracking-widest text-zinc-400 flex items-center space-x-2">
              <Compass className="h-4 w-4 text-zinc-500" />
              <span>Active Hangar Catalog</span>
            </h3>
            
            {/* Scrollable container: max-h of 200px and scroll bars hidden */}
            <div className="max-h-[220px] overflow-y-auto no-scrollbar space-y-3 pr-1">
              {Object.values(planes).map(p => {
                const eng = engines[p.engines[0]];
                const isCrit = eng ? eng.health < 0.30 : false;
                
                return (
                  <div 
                    key={p.id}
                    onClick={() => {
                      setSelectedPlaneId(p.id);
                      setViewState("asset-detail");
                    }}
                    onMouseEnter={() => {
                      setHoveredPlaneId(p.id);
                      setLastHoveredPlaneId(p.id);
                    }}
                    onMouseLeave={() => setHoveredPlaneId(null)}
                    className={`p-3 bg-zinc-950 border rounded-lg cursor-pointer transition-all flex items-center justify-between ${
                      (hoveredPlaneId === p.id || lastHoveredPlaneId === p.id)
                        ? "border-emerald-500/80 shadow-[0_0_10px_rgba(16,185,129,0.15)]" 
                        : "border-zinc-900 hover:border-zinc-800"
                    }`}
                  >
                    <div className="space-y-1">
                      <div className="flex items-center space-x-2">
                        <Plane className={`h-3 w-3 ${p.status === "Airborne" ? "text-emerald-400" : isCrit ? "text-red-500 animate-pulse" : p.status === "Ready" ? "text-zinc-400" : "text-amber-500"}`} />
                        <span className="font-bold text-zinc-200">{p.id}</span>
                      </div>
                      <span className="text-[10px] text-zinc-500 block">{p.origin} ➔ {p.destination}</span>
                    </div>
                    <div className="text-right space-y-0.5">
                      <span className={`text-[10px] font-bold uppercase ${
                        isCrit ? "text-red-500 animate-pulse" : p.status === "Airborne" ? "text-emerald-400" : p.status === "Ready" ? "text-zinc-400" : "text-amber-500"
                      }`}>
                        {isCrit ? "Grounded" : p.status}
                      </span>
                      {p.status === "Airborne" && <div className="text-[9px] text-zinc-500">{(p.progress).toFixed(0)}% Route</div>}
                      {p.status === "Ready" && <div className="text-[9px] text-zinc-600">Dwell: {p.progress}s/45s</div>}
                    </div>
                  </div>
                );
              })}
            </div>
          </div>
        </div>

        {/* Right Column: High-tech Flight Radar Map & Automatic Federated weight consolidator */}
        <div className="lg:col-span-2 space-y-6">
          
          {/* Radar Map */}
          <div className="bg-zinc-900/10 border border-zinc-900 rounded-xl p-5 space-y-4">
            <div className="flex justify-between items-center">
              <h3 className="text-xs font-mono uppercase tracking-widest text-zinc-400 flex items-center space-x-2">
                <Map className="h-4 w-4 text-zinc-500" />
                <span>Real-Time Regional Flight Radar</span>
              </h3>
              {isStreaming && <span className="h-2 w-2 rounded-full bg-emerald-500 animate-ping"></span>}
            </div>

            {/* Radar Screen */}
            <div className="bg-zinc-950 border border-zinc-900/80 rounded-xl relative p-1 overflow-hidden flex flex-col justify-center shadow-inner">
              <svg viewBox="0 0 600 240" className="w-full h-auto text-zinc-800 select-none">
                {/* Grid Lines */}
                {Array.from({ length: 15 }, (_, i) => (
                  <line key={`x-${i}`} x1={i * 40} y1={0} x2={i * 40} y2={240} stroke="#13131a" strokeWidth="0.5" />
                ))}
                {Array.from({ length: 6 }, (_, i) => (
                  <line key={`y-${i}`} x1={0} y1={i * 40} x2={600} y2={i * 40} stroke="#13131a" strokeWidth="0.5" strokeDasharray="3,3" />
                ))}
                
                {/* Flight Paths Tracing (Dotted curves) */}
                {Object.values(planes).map(p => {
                  const isHovered = hoveredPlaneId === p.id || lastHoveredPlaneId === p.id;
                  const coords = p.routeCoordinates;
                  if (coords.length < 3) return null;
                  
                  return (
                    <path
                      key={`path-${p.id}`}
                      d={`M ${coords[0].x},${coords[0].y} Q ${coords[1].x},${coords[1].y} ${coords[2].x},${coords[2].y}`}
                      fill="none"
                      stroke={isHovered ? "#10b981" : "#1f1f2e"}
                      strokeWidth={isHovered ? "2.5" : "1.2"}
                      strokeDasharray={isHovered ? "0" : "4,4"}
                      className="transition-all duration-300 cursor-pointer"
                      onMouseEnter={() => {
                        setHoveredPlaneId(p.id);
                        setLastHoveredPlaneId(p.id);
                      }}
                      onMouseLeave={() => setHoveredPlaneId(null)}
                    />
                  );
                })}
                
                {/* Hub Locations & Text Shadows for maximum contrast */}
                {Object.keys(HUB_COORDINATES).map(key => {
                  const hub = HUB_COORDINATES[key];
                  const isLocal = 
                    (selectedHangar === "hangar-01" && key === "BOM") ||
                    (selectedHangar === "hangar-02" && key === "LHR") ||
                    (selectedHangar === "hangar-03" && key === "SEA");
                  
                  // If active route is hovered, check if this hub is the start or stop coordinate!
                  const currentActivePlane = planes[activeHudPlaneId];
                  const isRouteEnd = currentActivePlane ? (currentActivePlane.origin === key || currentActivePlane.destination === key) : false;

                  return (
                    <g key={key}>
                      {isLocal && <circle cx={hub.x} cy={hub.y} r="12" className="fill-emerald-500/5 stroke-emerald-500/20 animate-pulse" strokeWidth="1" />}
                      {isRouteEnd && <circle cx={hub.x} cy={hub.y} r="8" className="fill-none stroke-emerald-400/40 animate-pulse" strokeWidth="1.5" />}
                      <circle cx={hub.x} cy={hub.y} r="4.5" className={isLocal ? "fill-emerald-400" : isRouteEnd ? "fill-emerald-500/80" : "fill-zinc-600"} />
                      
                      {/* Double render text labels for white high-contrast outlines */}
                      <text x={hub.x} y={hub.y - 10} textAnchor="middle" className="font-mono text-[9px] font-bold fill-none stroke-zinc-950 stroke-[3px] select-none">{hub.name}</text>
                      <text x={hub.x} y={hub.y - 10} textAnchor="middle" className={`font-mono text-[9px] font-bold select-none ${isLocal ? "fill-emerald-400" : isRouteEnd ? "fill-emerald-300" : "fill-zinc-300"}`}>{hub.name}</text>
                    </g>
                  );
                })}

                {/* Airborne Planes Markers */}
                {Object.values(planes).map(p => {
                  if (p.status !== "Airborne") return null;
                  const coords = getPlaneCoordinates(p);
                  const isHovered = hoveredPlaneId === p.id || lastHoveredPlaneId === p.id;
                  const engineHealth = engines[p.engines[0]]?.health ?? 1.0;
                  
                  let markerColor = "fill-emerald-500 stroke-emerald-950";
                  if (engineHealth < 0.35) markerColor = "fill-red-500 stroke-red-200 animate-pulse";
                  else if (engineHealth < 0.75) markerColor = "fill-amber-500 stroke-amber-200";
                  else if (isHovered) markerColor = "fill-emerald-400 stroke-white";

                  return (
                    <g 
                      key={p.id}
                      onMouseEnter={() => {
                        setHoveredPlaneId(p.id);
                        setLastHoveredPlaneId(p.id);
                      }}
                      onMouseLeave={() => setHoveredPlaneId(null)}
                      className="cursor-pointer"
                      onClick={() => {
                        setSelectedPlaneId(p.id);
                        setViewState("asset-detail");
                      }}
                    >
                      {isHovered && <circle cx={coords.x} cy={coords.y} r="12" className="fill-emerald-500/10 stroke-emerald-500/30 animate-pulse" strokeWidth="0.8" />}
                      <circle cx={coords.x} cy={coords.y} r="5.5" className={`${markerColor} transition-colors duration-300`} strokeWidth="1" />
                      
                      {/* High contrast labels */}
                      <text x={coords.x + 8} y={coords.y + 3} className="font-mono text-[8px] font-bold fill-none stroke-zinc-950 stroke-[2.5px] select-none">{p.id}</text>
                      <text x={coords.x + 8} y={coords.y + 3} className={`font-mono text-[8px] font-bold select-none ${isHovered ? "fill-emerald-300" : "fill-zinc-200"}`}>{p.id}</text>
                    </g>
                  );
                })}
              </svg>
            </div>

            {/* Live Telemetry HUD Information Panel */}
            <div className="bg-zinc-950/80 border border-zinc-900 p-4 rounded-lg text-xs font-mono min-h-[68px] flex items-center justify-center relative">
              <div className="w-full grid grid-cols-2 md:grid-cols-4 gap-4 text-left">
                <div>
                  <span className="text-[9px] text-zinc-500 block uppercase tracking-wider">AIRCRAFT ID</span>
                  <strong className="text-zinc-200 font-mono text-[11px] block truncate">{activeHudPlane.name}</strong>
                </div>
                <div>
                  <span className="text-[9px] text-zinc-500 block uppercase tracking-wider">FLIGHT ROUTE</span>
                  <strong className="text-zinc-300 font-mono text-[11px] block">{activeHudPlane.origin} ➔ {activeHudPlane.destination} ({activeHudPlane.phase})</strong>
                </div>
                <div>
                  <span className="text-[9px] text-zinc-500 block uppercase tracking-wider">ALTITUDE & AIRSPEED</span>
                  <strong className="text-zinc-300 font-mono text-[11px] block">{activeHudPlane.altitude} ft / {activeHudPlane.speed} kt</strong>
                </div>
                <div>
                  <span className="text-[9px] text-zinc-500 block uppercase tracking-wider">PROPULSION HEALTH</span>
                  <strong className={`font-mono text-[11px] block uppercase ${primaryHudEng?.health < 0.35 ? "text-red-400 animate-pulse" : primaryHudEng?.health < 0.75 ? "text-amber-400" : "text-emerald-400"}`}>
                    {hudHealthPct}% (RUL: {hudRul} CYC)
                  </strong>
                </div>
              </div>
            </div>
          </div>

          {/* Automatic Federated Calibration aggregator card */}
          <div className="bg-zinc-900/10 border border-zinc-900 rounded-xl p-5 md:p-6 space-y-6 text-left">
            <div className="flex flex-col md:flex-row md:items-center justify-between gap-4 border-b border-zinc-900 pb-5">
              <div className="space-y-1">
                <span className="text-[10px] font-mono text-zinc-500 uppercase tracking-widest block">
                  Autonomic Parameter Synchronization (Every 60s)
                </span>
                <h4 className="text-sm font-bold text-zinc-200 uppercase flex items-center space-x-2 font-mono">
                  <Shield className="h-4 w-4 text-zinc-500" />
                  <span>Station Federated Training Consolidator</span>
                </h4>
              </div>
              <div className="flex items-center space-x-2 text-[10px] font-mono text-zinc-500">
                <span className="h-1.5 w-1.5 rounded-full bg-emerald-500 animate-ping"></span>
                <span>SYNC POOL ACTIVE</span>
              </div>
            </div>

            <div className="grid grid-cols-1 md:grid-cols-3 gap-6 font-sans text-xs">
              
              {/* Left Column: Node Training Indicator Status Grid (fills the gap) */}
              <div className="md:col-span-1 space-y-3 font-mono text-[10px]">
                <strong className="text-zinc-400 block tracking-wider uppercase">Distributed Calibration Grid</strong>
                
                <div className="space-y-2 bg-zinc-950/40 p-3 border border-zinc-900/60 rounded">
                  <div className="flex justify-between items-center">
                    <span className="text-zinc-500">MUMBAI_STN1</span>
                    <span className="text-emerald-400 font-bold">Loss: 0.015</span>
                  </div>
                  <div className="flex justify-between items-center">
                    <span className="text-zinc-500">LONDON_STN2</span>
                    <span className="text-emerald-400 font-bold">Loss: 0.032</span>
                  </div>
                  <div className="flex justify-between items-center">
                    <span className="text-zinc-500">SEATTLE_STN3</span>
                    <span className="text-emerald-400 font-bold">Loss: 0.021</span>
                  </div>
                  <div className="border-t border-zinc-900/60 pt-2 flex justify-between text-[9px] text-zinc-500">
                    <span>DP GRADIENTS:</span>
                    <span>LAPLACE ACTIVE</span>
                  </div>
                </div>
              </div>

              {/* Training Convergence Plot (displays the last 10 rounds) */}
              <div className="md:col-span-2 space-y-2">
                <span className="font-mono text-[10px] text-zinc-500 uppercase tracking-wider block text-left">Convergence log (Last 10 updates)</span>
                <div className="h-44 w-full bg-zinc-950/40 p-2 border border-zinc-900 rounded-lg">
                  {mounted && federatedHistory.length > 0 ? (
                    <ResponsiveContainer width="100%" height="100%">
                      <LineChart data={federatedHistory.slice(-10)}>
                        <CartesianGrid strokeDasharray="3 3" stroke="#18181b" />
                        <XAxis dataKey="round" stroke="#3f3f46" fontSize={8} fontFamily="monospace" />
                        <YAxis stroke="#3f3f46" fontSize={8} fontFamily="monospace" />
                        <Tooltip contentStyle={{ backgroundColor: "#09090b", borderColor: "#18181b", color: "#f4f4f5", fontFamily: "monospace", fontSize: 8 }} />
                        <Line type="monotone" dataKey="global_loss" name="Loss" stroke="#10b981" strokeWidth={1.8} dot={{ r: 3 }} />
                      </LineChart>
                    </ResponsiveContainer>
                  ) : (
                    <div className="h-full w-full flex items-center justify-center font-mono text-zinc-600 text-[10px]">
                      No calibration cycles executed. Streaming automatic weights.
                    </div>
                  )}
                </div>
              </div>
            </div>
          </div>

        </div>
      </div>
    </div>
  );
}

// --- VIEW 4: AIRCRAFT DOSSIER DETAILS ---
interface AssetDetailProps {
  selectedPlaneId: string | null;
  setSelectedPlaneId: (v: string | null) => void;
  setViewState: (v: 'login' | 'hangar-select' | 'dashboard' | 'asset-detail' | 'sentinel-gate') => void;
  planes: Record<string, PlaneData>;
  engines: Record<string, EngineData>;
  setSelectedEngineId: (v: string) => void;
  ledgerHistory: LedgerRecord[];
}

export function AssetDetail({
  selectedPlaneId,
  setSelectedPlaneId,
  setViewState,
  planes,
  engines,
  setSelectedEngineId,
  ledgerHistory
}: AssetDetailProps) {
  if (!selectedPlaneId) return null;
  const plane = planes[selectedPlaneId];
  const primaryEngineId = plane.engines[0];
  const engine = engines[primaryEngineId];
  const healthPct = engine ? (engine.health * 100).toFixed(0) : "100";
  const rulCyc = engine ? engine.rul : "125";
  const cycles = engine ? engine.cycle : "0";

  const getHealthBarColor = (health: number) => {
    if (health >= 0.75) return "bg-emerald-500";
    if (health >= 0.35) return "bg-amber-500";
    return "bg-red-500 animate-pulse";
  };

  // Live weather logs / Transponder communications (fills bottom left gap)
  const getSimulatedCommsLog = () => {
    if (plane.status === "Maintenance") {
      return [
        "MRO: Maintenance interlock engaged.",
        "SYS: Awaiting turbofan certified overhaul.",
        "SEC: Committing signed logs enabled."
      ];
    }
    if (plane.progress < 15) {
      return [
        `ATC: ${plane.id} cleared for takeoff. Wind 12kt.`,
        "SYS: HPC turbine temperature rising nominal.",
        "AP: Autopilot altitude arm set 10000ft."
      ];
    }
    if (plane.progress >= 15 && plane.progress < 85) {
      return [
        `SYS: Cruise hold active at ${plane.altitude} ft.`,
        "COM: Secure transponder ping BOM OK.",
        "FDK: Fuel depletion rate checks stable."
      ];
    }
    return [
      `ATC: Contact tower. Preparing descent to ${plane.destination}.`,
      "SYS: Landing gear pressure checks OK.",
      "SYS: LPC thrust reversers armed."
    ];
  };

  return (
    <div className="flex-1 flex flex-col space-y-6 bg-zinc-950 text-zinc-100 font-sans max-w-7xl mx-auto w-full p-4 md:p-6 select-none">
      <header className="flex items-center justify-between border-b border-zinc-900 pb-5 gap-4">
        <div className="flex items-center space-x-3">
          <button 
            onClick={() => {
              setSelectedPlaneId(null);
              setViewState("dashboard");
            }} 
            className="flex items-center space-x-2 border border-zinc-800 hover:border-zinc-700 px-3 py-1.5 rounded font-mono text-xs text-zinc-400 cursor-pointer bg-zinc-900/10"
          >
            <ArrowLeft className="h-3 w-3" />
            <span>OPERATIONS TERMINAL</span>
          </button>
          
          {/* Relocated SentinelWRO button */}
          <button 
            onClick={() => {
              setSelectedEngineId(primaryEngineId);
              setViewState("sentinel-gate");
            }} 
            className="flex items-center space-x-2 border border-emerald-500/30 text-emerald-400 hover:bg-emerald-500/10 px-3 py-1.5 rounded font-mono text-xs font-bold cursor-pointer"
          >
            <Cpu className="h-3 w-3" />
            <span>SentinelWRO</span>
          </button>
        </div>
        
        <h2 className="text-sm font-bold text-zinc-100 font-mono uppercase">
          AIRCRAFT DOSSIER: {plane.id}
        </h2>
      </header>

      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
        {/* Left Column: Live specifications (Reactive) & Comms HUD (fills the gap) */}
        <div className="lg:col-span-1 space-y-6">
          
          {/* Plane specifications (completely reactive) */}
          <div className="bg-zinc-900/10 border border-zinc-900 rounded-xl p-5 space-y-4 text-left">
            <h3 className="text-xs font-mono uppercase tracking-widest text-zinc-400">Specifications Catalog</h3>
            <div className="space-y-3 font-mono text-[11px]">
              <div className="flex justify-between border-b border-zinc-900/60 pb-2"><span className="text-zinc-500">MODEL ID:</span><span className="text-zinc-200 font-bold">{plane.model}</span></div>
              <div className="flex justify-between border-b border-zinc-900/60 pb-2"><span className="text-zinc-500">CURRENT ROUTE:</span><span className="text-zinc-200">{plane.origin} ➔ {plane.destination}</span></div>
              <div className="flex justify-between border-b border-zinc-900/60 pb-2"><span className="text-zinc-500">FLIGHT STATUS:</span><span className="text-zinc-200 uppercase font-bold">{plane.status}</span></div>
              <div className="flex justify-between border-b border-zinc-900/60 pb-2"><span className="text-zinc-500">FLIGHT PHASE:</span><span className="text-zinc-200">{plane.phase}</span></div>
              <div className="flex justify-between border-b border-zinc-900/60 pb-2"><span className="text-zinc-500">AIRSPEED:</span><span className="text-zinc-200">{plane.speed} kt</span></div>
              <div className="flex justify-between border-b border-zinc-900/60 pb-2"><span className="text-zinc-500">ALTITUDE:</span><span className="text-zinc-200">{plane.altitude} ft</span></div>
              <div className="flex justify-between border-b border-zinc-900/60 pb-2"><span className="text-zinc-500">FUEL CAPACITY:</span><span className="text-zinc-200">{plane.fuel}%</span></div>
            </div>
          </div>

          {/* Live Flight Deck Communications Log (fills the gap) */}
          <div className="bg-zinc-900/10 border border-zinc-900 rounded-xl p-5 space-y-4 text-left">
            <h3 className="text-xs font-mono uppercase tracking-widest text-zinc-400">Flight Deck Comms Log</h3>
            <div className="bg-zinc-950/80 p-3 rounded border border-zinc-900 text-[10px] font-mono text-zinc-500 space-y-1.5 min-h-[92px]">
              {getSimulatedCommsLog().map((log, idx) => (
                <div key={idx} className="flex items-center space-x-1.5">
                  <span className="h-1.5 w-1.5 rounded-full bg-emerald-500/60"></span>
                  <span className="truncate">{log}</span>
                </div>
              ))}
            </div>
          </div>
        </div>

        {/* Right Column: Engine Health summary & Audit log table */}
        <div className="lg:col-span-2 space-y-6">
          <div className="bg-zinc-900/10 border border-zinc-900 rounded-xl p-6 space-y-5 text-left">
            <h3 className="text-xs font-mono uppercase tracking-widest text-zinc-400">Turbofan Propulsion Node</h3>
            
            <div className="p-4 bg-zinc-950/60 border border-zinc-900 rounded-xl space-y-4">
              <div className="flex justify-between items-center font-mono text-xs">
                <div>
                  <h4 className="font-bold text-zinc-200">{primaryEngineId}</h4>
                  <span className="text-[10px] text-zinc-500">TCN Prognostics Diagnostics Matrix</span>
                </div>
                <span className={`text-[10px] uppercase font-bold ${engine?.status === "Nominal" ? "text-emerald-400" : engine?.status === "Warning" ? "text-amber-500" : "text-red-400 animate-pulse"}`}>
                  {engine?.status || "Nominal"}
                </span>
              </div>

              <div className="space-y-1.5 font-mono text-xs">
                <div className="flex justify-between">
                  <span className="text-zinc-500">ENGINE WEAR INDEX</span>
                  <span className="text-zinc-300">{healthPct}%</span>
                </div>
                <div className="h-1.5 w-full bg-zinc-900/40 rounded-full overflow-hidden">
                  <div className={`h-full ${getHealthBarColor(engine?.health ?? 1.0)}`} style={{ width: `${healthPct}%` }} />
                </div>
              </div>

              <div className="flex justify-between text-[11px] font-mono text-zinc-500 border-t border-zinc-900 pt-3">
                <span>ACCUMULATED CYCLES: <strong className="text-zinc-300">{cycles}</strong></span>
                <span>REMAINING USEFUL LIFE: <strong className="text-zinc-300">{rulCyc} CYC</strong></span>
              </div>
            </div>
          </div>

          {/* Maintenance Records Audit Log */}
          <div className="bg-zinc-900/10 border border-zinc-900 rounded-xl p-5 space-y-4 text-left">
            <h3 className="text-xs font-mono uppercase tracking-widest text-zinc-400">Cryptographic MRO Audit Records</h3>
            <div className="overflow-x-auto border border-zinc-900/80 rounded-lg">
              <table className="w-full text-left font-mono text-[10px] text-zinc-400 select-text">
                <thead className="bg-zinc-950 text-zinc-500 uppercase">
                  <tr>
                    <th className="py-2.5 px-3">LEAF</th>
                    <th className="py-2.5 px-3">TIMESTAMP</th>
                    <th className="py-2.5 px-3">MAINTENANCE ACTION</th>
                    <th className="py-2.5 px-3">TECH ID</th>
                    <th className="py-2.5 px-3">HEALTH</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-zinc-900 bg-zinc-950/20">
                  {ledgerHistory.filter(r => r.component_id === plane.id || plane.engines.includes(r.component_id)).length > 0 ? (
                    ledgerHistory.filter(r => r.component_id === plane.id || plane.engines.includes(r.component_id)).map(r => (
                      <tr key={r.leaf_index}>
                        <td className="py-2 px-3 text-zinc-500 font-bold">#{r.leaf_index}</td>
                        <td className="py-2 px-3 text-zinc-500">{r.timestamp.split("T")[0]}</td>
                        <td className="py-2 px-3 text-zinc-200 font-bold">{r.action_taken}</td>
                        <td className="py-2 px-3">{r.technician_id}</td>
                        <td className="py-2 px-3 text-emerald-400">{(r.health_snapshot * 100).toFixed(0)}%</td>
                      </tr>
                    ))
                  ) : (
                    <tr><td colSpan={5} className="py-6 text-center text-zinc-600">NO CRYPTOGRAPHIC LOGS ON FILE FOR COMPONENT.</td></tr>
                  )}
                </tbody>
              </table>
            </div>
          </div>

        </div>
      </div>
    </div>
  );
}

// --- VIEW 5: SENTINEL DIAGNOSTIC ENCLAVE ---
interface SentinelGatewayProps {
  selectedEngineId: string;
  setSelectedEngineId: (v: string) => void;
  viewState: string;
  setViewState: (v: 'login' | 'hangar-select' | 'dashboard' | 'asset-detail' | 'sentinel-gate') => void;
  planes: Record<string, PlaneData>;
  setSelectedPlaneId: (v: string | null) => void;
  engines: Record<string, EngineData>;
  isStreaming: boolean;
  setIsStreaming: (v: boolean | ((prev: boolean) => boolean)) => void;
  streamingRate: number;
  handleRateChange: (rate: number) => void;
  streamNextCycle: (id: string) => Promise<void>;
  isInferring: boolean;
  backendOnline: boolean;
  activeTab: 'fleet' | 'federated' | 'ledger';
  setActiveTab: (tab: 'fleet' | 'federated' | 'ledger') => void;
  hoveredSensor: string | null;
  setHoveredSensor: (s: string | null) => void;
  verifyLedgerIntegrity: () => Promise<void>;
  isVerifying: boolean;
  simulateTampering: () => Promise<void>;
  verificationResult: { verified: boolean | null; message: string; computed_root?: string; stored_root?: string; tampered_indices?: number[] };
  rootHash: string;
  formEngine: string;
  setFormEngine: (v: string) => void;
  formAction: string;
  setFormAction: (v: string) => void;
  formStation: string;
  setFormStation: (v: string) => void;
  formHealth: string;
  setFormHealth: (v: string) => void;
  formSuccessMessage: string;
  handleManualAppend: (e: React.FormEvent) => Promise<void>;
  nodes: any[];
  ledgerHistory: LedgerRecord[];
  mounted: boolean;
  lastHoveredPlaneId: string;
}

export function SentinelGateway({
  selectedEngineId,
  setSelectedEngineId,
  viewState,
  setViewState,
  planes,
  setSelectedPlaneId,
  engines,
  isStreaming,
  setIsStreaming,
  streamingRate,
  handleRateChange,
  streamNextCycle,
  isInferring,
  backendOnline,
  activeTab,
  setActiveTab,
  hoveredSensor,
  setHoveredSensor,
  verifyLedgerIntegrity,
  isVerifying,
  simulateTampering,
  verificationResult,
  rootHash,
  formEngine,
  setFormEngine,
  formAction,
  setFormAction,
  formStation,
  setFormStation,
  formHealth,
  setFormHealth,
  formSuccessMessage,
  handleManualAppend,
  nodes,
  ledgerHistory,
  mounted,
  lastHoveredPlaneId
}: SentinelGatewayProps) {
  const parentPlaneId = Object.keys(planes).find(key => planes[key].engines.includes(selectedEngineId)) || "PL-101";
  const activeEngine = engines[selectedEngineId] || engines["ENG-001"];
  const parentPlane = planes[parentPlaneId];
  
  // Ledger interlock landing check
  const isPlaneAirborne = parentPlane ? parentPlane.status === "Airborne" : false;

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
      `}} />
      
      {/* Header */}
      <header className="flex flex-col md:flex-row md:items-center justify-between border-b border-zinc-900 pb-5 gap-4">
        <div className="flex items-center space-x-4">
          <button 
            onClick={() => {
              setViewState("asset-detail");
              setSelectedPlaneId(parentPlaneId);
            }} 
            className="flex items-center space-x-2 border border-zinc-800 hover:border-zinc-700 px-3 py-1.5 rounded font-mono text-xs text-zinc-400 cursor-pointer bg-zinc-900/10"
          >
            <ArrowLeft className="h-3.5 w-3.5" />
            <span>AIRCRAFT FILE</span>
          </button>
          <div className="space-y-0.5">
            <span className="text-[9px] font-mono text-zinc-500 block">SENTINELMRO DIAGNOSTICS ENCLAVE</span>
            <h2 className="text-base font-bold text-zinc-200 font-mono uppercase">{selectedEngineId} // SECURE SHELL</h2>
          </div>
        </div>

        <div className="flex flex-wrap items-center gap-3 text-[10px] font-mono text-zinc-450">
          <div className={`flex items-center space-x-1.5 border border-zinc-900 px-3 py-1 bg-zinc-900/10 rounded-md`}>
            <span className={`h-1.5 w-1.5 rounded-full ${backendOnline ? "bg-emerald-500 animate-pulse" : "bg-red-500 animate-ping"}`} />
            <span className="uppercase font-bold">Gateway: {backendOnline ? "Online" : "Offline"}</span>
          </div>

          <div className="flex items-center space-x-1.5 border border-zinc-900 px-3 py-1 bg-zinc-900/10 rounded-md">
            <Layers className="h-3 w-3 text-zinc-500" />
            <span>MMR LEAF PEAKS: {ledgerHistory.length}</span>
          </div>
        </div>
      </header>

      {/* Tabs */}
      <div className="flex border-b border-zinc-900 text-xs font-mono">
        <button 
          onClick={() => setActiveTab("fleet")}
          className={`px-5 py-3 border-b-2 transition-all cursor-pointer uppercase tracking-wider ${
            activeTab === "fleet" 
              ? "border-zinc-300 text-zinc-200 bg-zinc-900/10 font-bold" 
              : "border-transparent text-zinc-500 hover:text-zinc-300"
          }`}
        >
          01 / Propulsion Telemetry
        </button>
        <button 
          onClick={() => setActiveTab("ledger")}
          className={`px-5 py-3 border-b-2 transition-all cursor-pointer uppercase tracking-wider ${
            activeTab === "ledger" 
              ? "border-zinc-300 text-zinc-200 bg-zinc-900/10 font-bold" 
              : "border-transparent text-zinc-500 hover:text-zinc-300"
          }`}
        >
          02 / MMR Audit Ledger
        </button>
      </div>

      {/* Tab Panels */}
      <main className="space-y-6">
        
        {/* TAB 1: Propulsion Telemetry */}
        {activeTab === "fleet" && (
          <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
            
            {/* Propulsion register list & interactive blueprint */}
            <div className="space-y-4 lg:col-span-1 text-left">
              <h2 className="text-xs font-mono uppercase tracking-widest text-zinc-400">Propulsion Register</h2>
              
              <div className="space-y-3 font-mono text-xs">
                {Object.values(engines).map((eng) => {
                  const planeId = Object.keys(planes).find(key => planes[key].engines.includes(eng.id));
                  const pl = planeId ? planes[planeId] : null;
                  
                  return (
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
                      <div className="flex justify-between items-center mt-1">
                        <p className="text-[10px] text-zinc-500 font-sans">{eng.name}</p>
                        {pl && <span className={`text-[9px] px-1.5 py-0.5 rounded font-mono ${pl.status === "Airborne" ? "bg-emerald-500/10 text-emerald-400" : "bg-zinc-900 text-zinc-500"}`}>{pl.status}</span>}
                      </div>
                      
                      <div className="mt-3.5 space-y-1.5">
                        <div className="flex justify-between text-[10px] font-mono">
                          <span className="text-zinc-500">WEAR INDEX</span>
                          <span className="text-zinc-300">{(eng.health * 100).toFixed(0)}%</span>
                        </div>
                        <div className="h-1 w-full bg-zinc-900/40 rounded-full overflow-hidden">
                          <div 
                            className={`h-full transition-all duration-550 ${getHealthBarColor(eng.health)}`}
                            style={{ width: `${eng.health * 100}%` }}
                          />
                        </div>
                      </div>

                      <div className="mt-3.5 flex items-center justify-between border-t border-zinc-900/80 pt-3 text-[10px] font-mono text-zinc-500">
                        <span>CYCLES: <strong className="text-zinc-300">{eng.cycle}</strong></span>
                        <span>RUL: <strong className="text-zinc-300">{eng.rul} CYC</strong></span>
                      </div>
                    </div>
                  );
                })}
              </div>

              {/* Jet engine sensor diagram mapping */}
              <div className="bg-zinc-900/10 border border-zinc-900 rounded-xl p-5 space-y-4">
                <div className="flex items-center justify-between">
                  <h3 className="text-xs font-mono uppercase tracking-widest text-zinc-400">Sensor Mapping Blueprint</h3>
                  {hoveredSensor && (
                    <span className="text-[9px] font-mono bg-zinc-900 border border-zinc-800 px-2 py-0.5 rounded text-zinc-400 uppercase">
                      {hoveredSensor}
                    </span>
                  )}
                </div>

                <div className="bg-zinc-950/60 border border-zinc-900/80 rounded-lg p-2 flex items-center justify-center relative">
                  <svg viewBox="0 0 400 160" className="w-full h-auto text-zinc-700 select-none">
                    <path d="M 40,40 L 120,40 L 140,55 L 290,55 L 310,40 L 350,40 L 340,80 L 350,120 L 310,120 L 290,105 L 140,105 L 120,120 L 40,120 Z" fill="none" stroke="#27272a" strokeWidth="2" />
                    <circle cx="182" cy="80" r="10" fill="#ef4444" fillOpacity="0.05" stroke="#ef4444" strokeWidth="1.5" strokeDasharray="3,2" strokeOpacity="0.3" />
                    
                    {[
                      { id: "s8", label: "s8", x: 55, y: 50 },
                      { id: "s2", label: "s2", x: 75, y: 110 },
                      { id: "s3", label: "s3", x: 110, y: 52 },
                      { id: "s9", label: "s9", x: 125, y: 108 },
                      { id: "s15", label: "s15", x: 205, y: 35 },
                      { id: "s4", label: "s4", x: 245, y: 110 },
                      { id: "s11", label: "s11", x: 270, y: 52 },
                      { id: "s12", label: "s12", x: 295, y: 110 }
                    ].map((sensor) => {
                      const isHovered = hoveredSensor === sensor.id;
                      const wearRank = activeEngine?.attribution?.findIndex(a => a.sensor === sensor.id) ?? -1;
                      const isTopWear = wearRank === 0;
                      
                      let dotColor = "fill-zinc-700 stroke-zinc-950";
                      
                      if (isTopWear) dotColor = "fill-red-500 stroke-red-100";
                      else if (isHovered) dotColor = "fill-zinc-100 stroke-white";
                      else if (wearRank !== -1 && wearRank < 3) dotColor = "fill-amber-500 stroke-amber-100";

                      return (
                        <g 
                          key={sensor.id}
                          className="cursor-pointer"
                          onMouseEnter={() => setHoveredSensor(sensor.id)}
                          onMouseLeave={() => setHoveredSensor(null)}
                        >
                          <circle cx={sensor.x} cy={sensor.y} r="5" className={`${dotColor} transition-all duration-300`} strokeWidth="1.5" />
                          <text x={sensor.x} y={sensor.y - 8} textAnchor="middle" className="font-mono text-[8px] fill-zinc-500 pointer-events-none">{sensor.label.toUpperCase()}</text>
                        </g>
                      );
                    })}
                  </svg>
                </div>

                <div className="bg-zinc-950/45 border border-zinc-900/60 p-3 rounded text-[10px] font-mono min-h-[58px] flex flex-col justify-center text-left">
                  {hoveredSensor ? (
                    <div>
                      <div className="flex justify-between font-bold text-zinc-300"><span>{hoveredSensor.toUpperCase()} - {SENSOR_METADATA[hoveredSensor]?.label}</span><span>ATTRIB: {activeEngine?.attribution?.find(a => a.sensor === hoveredSensor)?.percentage.toFixed(1) ?? "0.0"}%</span></div>
                      <p className="text-zinc-500 font-sans mt-0.5 leading-normal">{SENSOR_METADATA[hoveredSensor]?.desc}</p>
                    </div>
                  ) : activeEngine?.attribution && activeEngine.attribution.length > 0 ? (
                    <div>
                      <div className="flex justify-between text-red-400 font-bold"><span>Hotspot: {activeEngine.attribution[0].sensor.toUpperCase()}</span><span>{activeEngine.attribution[0].percentage.toFixed(1)}% Attrib</span></div>
                      <p className="text-zinc-500 font-sans mt-0.5 leading-normal">Sensor <strong>{SENSOR_METADATA[activeEngine.attribution[0].sensor]?.label}</strong> indicates highest heat stress factor.</p>
                    </div>
                  ) : (
                    <div className="text-zinc-500 text-center font-sans text-[10px]">Hover blueprint nodes to diagnose engine wear.</div>
                  )}
                </div>
              </div>
            </div>

            {/* Charts & XAI panels */}
            <div className="lg:col-span-2 space-y-6">
              
              {/* Telemetry charts */}
              <div className="bg-zinc-900/10 border border-zinc-900 rounded-xl p-5 space-y-4">
                <div className="flex flex-col md:flex-row md:items-center justify-between gap-4">
                  <div className="space-y-0.5 text-left">
                    <span className="text-[9px] font-mono text-zinc-500 block">Telemetry diagnostics console</span>
                    <h3 className="text-sm font-bold text-zinc-200 uppercase font-mono">Live Prognostics Curve Visualizer</h3>
                  </div>
                  
                  <div className="flex items-center gap-3 text-[10px] font-mono">
                    <div className="flex items-center space-x-1.5 bg-zinc-950 border border-zinc-900 px-2 py-1.5 rounded">
                      <span className="text-zinc-500 uppercase font-bold text-[9px]">REAL-TIME REFRESH ACTIVE</span>
                    </div>
                    <button onClick={() => streamNextCycle(activeEngine.id)} disabled={isInferring || !backendOnline} className="flex items-center space-x-1 bg-zinc-100 hover:bg-white text-zinc-950 font-bold py-1 px-3.5 rounded transition-all cursor-pointer">
                      <span>STEP FLIGHT CYCLE</span>
                    </button>
                  </div>
                </div>

                <div className="h-60 w-full bg-zinc-950/30 p-2 border border-zinc-900/60 rounded-xl">
                  {mounted && activeEngine?.history && (
                    <ResponsiveContainer width="100%" height="100%">
                      <LineChart data={activeEngine.history}>
                        <CartesianGrid strokeDasharray="3 3" stroke="#18181b" />
                        <XAxis dataKey="cycle" stroke="#3f3f46" fontSize={8} fontFamily="monospace" />
                        <YAxis yAxisId="left" stroke="#a1a1aa" fontSize={8} fontFamily="monospace" />
                        <YAxis yAxisId="right" orientation="right" stroke="#52525b" fontSize={8} fontFamily="monospace" />
                        <Tooltip contentStyle={{ backgroundColor: "#09090b", borderColor: "#18181b", color: "#f4f4f5", fontFamily: "monospace", fontSize: 8 }} />
                        <Line yAxisId="left" type="monotone" dataKey="rul" name="RUL" stroke="#10b981" strokeWidth={1.5} dot={{ r: 1 }} />
                        <Line yAxisId="right" type="monotone" dataKey="sensor_11" name="LPC Temp" stroke="#71717a" strokeWidth={1} dot={false} />
                      </LineChart>
                    </ResponsiveContainer>
                  )}
                </div>
              </div>

              {/* Explainable AI attribution */}
              <div className="bg-zinc-900/10 border border-zinc-900 rounded-xl p-5 space-y-4 text-left">
                <h3 className="text-xs font-mono uppercase tracking-widest text-zinc-400 flex items-center space-x-2">
                  <Cpu className="h-4 w-4 text-zinc-500" />
                  <span>Explainable AI (XAI) Diagnostics: Integrated Gradients</span>
                </h3>

                {activeEngine?.attribution && activeEngine.attribution.length > 0 ? (
                  <div className="space-y-4">
                    <div className="grid grid-cols-1 md:grid-cols-2 gap-4 text-xs font-mono">
                      <div className="space-y-2">
                        {activeEngine.attribution.slice(0, 7).map((item, idx) => {
                          const isTop = idx < 3;
                          return (
                            <div key={item.sensor} className="space-y-1">
                              <div className="flex justify-between text-[9px]">
                                <span className={isTop ? "text-red-400 font-bold" : "text-zinc-400"}>{item.sensor.toUpperCase()} ({SENSOR_METADATA[item.sensor]?.label})</span>
                                <span className={isTop ? "text-red-400 font-bold" : "text-zinc-400"}>{item.percentage.toFixed(1)}%</span>
                              </div>
                              <div className="w-full bg-zinc-950 h-1 rounded-full overflow-hidden">
                                <div className={`h-full ${isTop ? "bg-red-500" : "bg-zinc-600"}`} style={{ width: `${item.percentage}%` }}></div>
                              </div>
                            </div>
                          );
                        })}
                      </div>
                      <div className="space-y-2">
                        {activeEngine.attribution.slice(7).map((item) => (
                          <div key={item.sensor} className="space-y-1">
                            <div className="flex justify-between text-[9px]">
                              <span className="text-zinc-500">{item.sensor.toUpperCase()} ({SENSOR_METADATA[item.sensor]?.label})</span>
                              <span className="text-zinc-400">{item.percentage.toFixed(1)}%</span>
                            </div>
                            <div className="w-full bg-zinc-950 h-1 rounded-full overflow-hidden">
                              <div className="h-full bg-zinc-700" style={{ width: `${item.percentage}%` }}></div>
                            </div>
                          </div>
                        ))}
                      </div>
                    </div>
                  </div>
                ) : (
                  <div className="bg-zinc-950/20 border border-dashed border-zinc-900 rounded-lg p-6 text-center text-xs font-mono text-zinc-600">No explainable metrics compiled. Streaming real-time telemetry updates.</div>
                )}
              </div>

            </div>
          </div>
        )}

        {/* TAB 2: Cryptographic MMR Audit Ledger */}
        {activeTab === "ledger" && (
          <div className="space-y-6">
            
            <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
              {/* Validation Status panel */}
              <div className="md:col-span-1 bg-zinc-900/10 border border-zinc-900 rounded-xl p-5 space-y-4 text-left">
                <h3 className="text-xs font-mono uppercase tracking-widest text-zinc-400">Ledger Verification Console</h3>
                
                <div className="flex flex-col gap-2">
                  <button onClick={verifyLedgerIntegrity} disabled={isVerifying || !backendOnline} className="w-full py-2 bg-zinc-100 hover:bg-white text-zinc-950 font-mono text-[10px] font-bold uppercase rounded cursor-pointer transition-all">
                    {isVerifying ? "VERIFYING..." : "VALIDATE INTEGRITY"}
                  </button>
                  <button onClick={simulateTampering} disabled={!backendOnline || ledgerHistory.length === 0} className="w-full py-2 border border-red-900/30 hover:border-red-900 text-red-400 font-mono text-[9px] uppercase rounded cursor-pointer transition-all">
                    SIMULATE TAMPERING
                  </button>
                </div>

                {verificationResult.verified !== null && (
                  <div className={`p-3 rounded border text-[9px] font-mono space-y-2 ${verificationResult.verified ? "bg-emerald-500/5 border-emerald-500/20 text-emerald-400" : "bg-red-500/5 border-red-500/20 text-red-400"}`}>
                    <div className="flex items-center space-x-1.5 font-bold uppercase">
                      {verificationResult.verified ? <CheckCircle className="h-3.5 w-3.5 text-emerald-500" /> : <AlertTriangle className="h-3.5 w-3.5 text-red-500" />}
                      <span>{verificationResult.verified ? "Verified Secure" : "Failed Integrity Check"}</span>
                    </div>
                    <p className="text-zinc-400 leading-normal text-[9px]">{verificationResult.message}</p>
                  </div>
                )}
                
                <div className="text-[9px] font-mono border border-zinc-900 bg-zinc-950/40 p-2 rounded flex justify-between">
                  <span className="text-zinc-500 font-bold">ROOT SEAL:</span>
                  <span className="text-zinc-300 truncate max-w-[130px]">{rootHash || "EMPTY"}</span>
                </div>
              </div>

              {/* Maintenance Form panel (Ledger Commit Interlock Enabled) */}
              <div className="md:col-span-2 bg-zinc-900/10 border border-zinc-900 rounded-xl p-5 space-y-4">
                <h3 className="text-xs font-mono uppercase tracking-widest text-zinc-400 text-left">Append Certified Maintenance Entry</h3>
                
                {isPlaneAirborne ? (
                  /* Block Form when plane is airborne */
                  <div className="p-8 border border-red-900/30 bg-red-950/5 rounded-xl flex flex-col items-center justify-center space-y-3 text-center">
                    <Lock className="h-8 w-8 text-red-500 animate-pulse" />
                    <div>
                      <h4 className="font-mono text-xs font-bold text-red-400 uppercase">Transaction Commit Interlock Engaged</h4>
                      <p className="font-sans text-[11px] text-zinc-500 mt-1 max-w-sm">Certified ledger signing is blocked because the matching aircraft **({parentPlaneId})** is currently airborne. A landing check is required before maintenance logs can be committed.</p>
                    </div>
                  </div>
                ) : (
                  <form onSubmit={handleManualAppend} className="grid grid-cols-2 gap-4 font-mono text-[10px] text-left">
                    <div>
                      <label className="text-zinc-500 block text-[9px] mb-1">Component</label>
                      <select value={formEngine} onChange={e => setFormEngine(e.target.value)} className="w-full bg-zinc-900 border border-zinc-800 p-2 rounded text-zinc-300 outline-none">
                        <option value="ENG-001">ENG-001 (Alpha)</option>
                        <option value="ENG-002">ENG-002 (Bravo)</option>
                        <option value="ENG-003">ENG-003 (Charlie)</option>
                      </select>
                    </div>
                    <div>
                      <label className="text-zinc-500 block text-[9px] mb-1">Action</label>
                      <select value={formAction} onChange={e => setFormAction(e.target.value)} className="w-full bg-zinc-900 border border-zinc-800 p-2 rounded text-zinc-300 outline-none">
                        <option value="Sensor Calibration">Sensor Calibration</option>
                        <option value="Oil Lubrication Refill">Oil Lubrication Refill</option>
                        <option value="Blade Replacement">Blade Replacement</option>
                        <option value="Compressor Overhaul">Compressor Overhaul</option>
                      </select>
                    </div>
                    <div>
                      <label className="text-zinc-500 block text-[9px] mb-1">Station ID</label>
                      <select value={formStation} onChange={e => setFormStation(e.target.value)} className="w-full bg-zinc-900 border border-zinc-800 p-2 rounded text-zinc-300 outline-none">
                        <option value="STATION_001">STATION_001 (Mumbai)</option>
                        <option value="STATION_002">STATION_002 (London)</option>
                        <option value="STATION_003">STATION_003 (Seattle)</option>
                      </select>
                    </div>
                    <div>
                      <label className="text-zinc-500 block text-[9px] mb-1">Health Index (0.0 to 1.0)</label>
                      <input type="text" value={formHealth} onChange={e => setFormHealth(e.target.value)} className="w-full bg-zinc-900 border border-zinc-800 p-2 rounded text-zinc-300 outline-none" />
                    </div>
                    <div className="col-span-2 pt-1">
                      {formSuccessMessage && <div className="p-2 bg-emerald-950/20 border border-emerald-500/20 text-emerald-400 text-[10px] rounded text-center mb-2">{formSuccessMessage}</div>}
                      <button type="submit" className="w-full py-2 bg-zinc-100 hover:bg-white text-zinc-950 font-bold uppercase rounded transition-all cursor-pointer">Commit Ledger Transaction</button>
                    </div>
                  </form>
                )}
              </div>
            </div>

            {/* MMR Tree visualizer */}
            <div className="bg-zinc-900/10 border border-zinc-900 rounded-xl p-5 space-y-4">
              <h3 className="text-xs font-mono uppercase tracking-widest text-zinc-400 text-left">Merkle Mountain Range DAG</h3>
              
              <div className="bg-zinc-950/40 border border-zinc-900 rounded-lg p-4 flex items-center justify-center min-h-[200px] overflow-x-auto">
                {nodes.length === 0 ? (
                  <div className="text-zinc-600 font-mono text-[10px] text-center"><Database className="h-5 w-5 mx-auto mb-1 animate-bounce" />NO PEAKS IN REGISTRY.</div>
                ) : (() => {
                  const mmrNodesMap: any = {};
                  nodes.forEach(n => { mmrNodesMap[n.pos] = { ...n, children: [], parent: null, x: 0, y: 0 }; });
                  const stack: any[] = [];
                  const sortedNodes = [...nodes].sort((a, b) => a.pos - b.pos);
                  sortedNodes.forEach(node => {
                    const nodeObj = mmrNodesMap[node.pos];
                    if (nodeObj.is_leaf) {
                      stack.push(nodeObj);
                    } else if (stack.length >= 2) {
                      const right = stack.pop();
                      const left = stack.pop();
                      nodeObj.children = [left.pos, right.pos];
                      left.parent = nodeObj.pos; right.parent = nodeObj.pos;
                      stack.push(nodeObj);
                    }
                  });
                  
                  const peaks = [...stack];
                  const leaves = Object.values(mmrNodesMap).filter((n: any) => n.is_leaf).sort((a: any, b: any) => a.pos - b.pos);
                  const wVal = 600, hVal = 160, paddingX = 45, paddingY = 25;
                  const spacing = leaves.length > 1 ? (wVal - paddingX * 2) / (leaves.length - 1) : 0;
                  leaves.forEach((l: any, i: number) => { l.x = paddingX + i * spacing; l.y = hVal - paddingY; });
                  const internal = Object.values(mmrNodesMap).filter((n: any) => !n.is_leaf).sort((a: any, b: any) => a.height - b.height);
                  internal.forEach((n: any) => {
                    if (n.children && n.children.length === 2) {
                      const l = mmrNodesMap[n.children[0]]; const r = mmrNodesMap[n.children[1]];
                      n.x = (l.x + r.x) / 2; n.y = hVal - paddingY - n.height * 35;
                    }
                  });
                  
                  const tamperedPos = new Set<string | number>();
                  if (verificationResult.verified === false && verificationResult.tampered_indices) {
                    leaves.forEach((l: any, idx: number) => {
                      const rec = ledgerHistory[idx];
                      if (rec && verificationResult.tampered_indices?.includes(rec.leaf_index)) tamperedPos.add(l.pos);
                    });
                    const byHeight = Object.values(mmrNodesMap).sort((a: any, b: any) => a.height - b.height);
                    byHeight.forEach((n: any) => {
                      if (n.children && n.children.some((c: any) => tamperedPos.has(c))) tamperedPos.add(n.pos);
                    });
                  }
                  
                  const links: any[] = [];
                  Object.values(mmrNodesMap).forEach((node: any) => {
                    if (node.children) {
                      node.children.forEach((c: any) => {
                        const child = mmrNodesMap[c];
                        links.push({
                          id: `${node.pos}-${child.pos}`,
                          x1: node.x, y1: node.y, x2: child.x, y2: child.y,
                          isTampered: tamperedPos.has(node.pos) && tamperedPos.has(child.pos)
                        });
                      });
                    }
                  });
                  
                  return (
                    <svg viewBox="0 0 600 160" className="w-full h-auto text-zinc-700 select-none">
                      {links.map((link) => (
                        <line key={link.id} x1={link.x1} y1={link.y1} x2={link.x2} y2={link.y2} stroke={link.isTampered ? "#ef4444" : "#27272a"} strokeWidth={link.isTampered ? "2" : "1"} />
                      ))}
                      {Object.values(mmrNodesMap).map((n: any) => {
                        const isLeafNode = n.is_leaf === 1;
                        const isTampered = tamperedPos.has(n.pos);
                        const nodeColor = isTampered ? "fill-red-500 animate-pulse stroke-red-100" : isLeafNode ? "fill-emerald-500 stroke-emerald-950" : "fill-zinc-750 stroke-zinc-950";
                        return (
                          <g key={n.pos}>
                            <circle cx={n.x} cy={n.y} r={isLeafNode ? 5 : 4} className={nodeColor} strokeWidth="1.5" />
                            <text x={n.x} y={n.y - 8} textAnchor="middle" className="font-mono text-[7px] fill-zinc-500">#{n.pos}</text>
                          </g>
                        );
                      })}
                    </svg>
                  );
                })()}
              </div>
            </div>

            {/* Ledger Transactions table */}
            <div className="bg-zinc-900/10 border border-zinc-900 rounded-xl p-5 space-y-4">
              <h3 className="text-xs font-mono uppercase tracking-widest text-zinc-400 text-left">Audit Log Registry</h3>
              
              <div className="overflow-x-auto border border-zinc-900/80 rounded-lg">
                <table className="w-full text-left font-mono text-[10px] text-zinc-400">
                  <thead className="bg-zinc-950 text-zinc-500 uppercase">
                    <tr>
                      <th className="py-2 px-3">LEAF</th>
                      <th className="py-2 px-3">TIMESTAMP</th>
                      <th className="py-2 px-3">ASSET</th>
                      <th className="py-2 px-3">DETAILS</th>
                      <th className="py-2 px-3">TECH</th>
                      <th className="py-2 px-3">HEALTH</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-zinc-900 bg-zinc-950/20">
                    {ledgerHistory.map((row) => (
                      <tr key={row.leaf_index}>
                        <td className="py-2 px-3 font-bold text-zinc-500">#{row.leaf_index}</td>
                        <td className="py-2 px-3 text-zinc-500">{row.timestamp.split("T")[0]}</td>
                        <td className="py-2 px-3 text-zinc-300 font-bold">{row.component_id}</td>
                        <td className="py-2 px-3 text-zinc-200 font-bold">{row.action_taken}</td>
                        <td className="py-2 px-3">{row.technician_id}</td>
                        <td className="py-2 px-3 text-emerald-400">{(row.health_snapshot * 100).toFixed(0)}%</td>
                      </tr>
                    ))}
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
