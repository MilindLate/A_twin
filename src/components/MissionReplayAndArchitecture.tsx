import React, { useEffect, useMemo, useState } from 'react';
import { EngineTelemetry, EngineHealthState, FaultAlert } from '../types';
import {
  LineChart,
  Line,
  XAxis,
  YAxis,
  CartesianGrid,
  Tooltip,
  ResponsiveContainer,
  ReferenceDot,
} from 'recharts';
import {
  Play,
  Pause,
  RotateCcw,
  Radio,
  Cpu,
  History,
  FileCheck,
  Download,
  Layers,
  ShieldCheck,
  Server,
  Wifi,
  Gauge,
} from 'lucide-react';
import clsx from 'clsx';

interface RecordedSortie {
  id: string;
  code: string;
  title: string;
  location: string;
  altitudeFt: number;
  ambientC: number;
  finding: string;
  frames: {
    t: string;
    rpm: number;
    cht: number;
    egt: number;
    oilPress: number;
    fuelFlow: number;
    vib: number;
    bsfc: number;
  }[];
}

const HISTORICAL_SORTIES: RecordedSortie[] = [
  {
    id: 'sortie-104',
    code: 'SRT-104-LADAKH',
    title: 'High-Altitude ISR Loiter (28,000 ft · Turbo Wastegate Thermal Soak)',
    location: 'Sector North-Alpha (ISA -41°C)',
    altitudeFt: 28000,
    ambientC: -41,
    finding:
      'Detected +34°C EGT residual at T+140m due to partial turbocharger wastegate sticking; recommended actuator inspection.',
    frames: Array.from({ length: 24 }, (_, i) => {
      const anomaly = i >= 12 && i <= 19 ? (i - 11) * 4.5 : 0;
      return {
        t: `T+${i * 10}m`,
        rpm: Math.round(2580 + Math.sin(i * 0.5) * 35),
        cht: Number((176 + anomaly * 0.65).toFixed(1)),
        egt: Number((764 + anomaly * 1.4).toFixed(1)),
        oilPress: Number((4.05 - anomaly * 0.015).toFixed(2)),
        fuelFlow: Number((44.2 + Math.cos(i * 0.4) * 1.1).toFixed(1)),
        vib: Number((17.5 + anomaly * 0.4).toFixed(1)),
        bsfc: Math.round(238 + anomaly * 1.2),
      };
    }),
  },
  {
    id: 'sortie-109',
    code: 'SRT-109-THAR',
    title: 'Hot-Weather Desert Reconnaissance (4,500 ft · +42°C Cooling Degradation)',
    location: 'Western Desert Range (ISA +27°C)',
    altitudeFt: 4500,
    ambientC: 42,
    finding:
      'Progressive CHT rise (+28°C) and oil viscosity pressure drop (-0.55 bar) isolated to oil cooler fin dust fouling.',
    frames: Array.from({ length: 24 }, (_, i) => {
      const soak = Math.min(28, i * 1.35);
      return {
        t: `T+${i * 10}m`,
        rpm: Math.round(2480 + Math.cos(i * 0.4) * 20),
        cht: Number((182 + soak).toFixed(1)),
        egt: Number((752 + soak * 0.5).toFixed(1)),
        oilPress: Number((3.85 - soak * 0.022).toFixed(2)),
        fuelFlow: Number((42.8 + Math.sin(i * 0.3) * 0.8).toFixed(1)),
        vib: Number((16.8 + soak * 0.25).toFixed(1)),
        bsfc: Math.round(244 + soak * 0.9),
      };
    }),
  },
  {
    id: 'sortie-112',
    code: 'SRT-112-IOR',
    title: 'Maritime Long-Endurance Patrol (2,500 ft · Cyl #3 Injector Clog)',
    location: 'Indian Ocean Littoral Sector',
    altitudeFt: 2500,
    ambientC: 22,
    finding:
      'Early lean-burn signature detected 42 minutes prior to Cylinder #3 misfire threshold via fuel residual divergence.',
    frames: Array.from({ length: 24 }, (_, i) => {
      const clog = i > 9 ? (i - 9) * 2.4 : 0;
      return {
        t: `T+${i * 10}m`,
        rpm: Math.round(2180 - (i > 15 ? 110 : 0)),
        cht: Number((154 + clog * 0.9).toFixed(1)),
        egt: Number((714 + clog * 1.8).toFixed(1)),
        oilPress: Number((4.18).toFixed(2)),
        fuelFlow: Number((35.5 - clog * 0.22).toFixed(1)),
        vib: Number((13.2 + clog * 1.4).toFixed(1)),
        bsfc: Math.round(226 + clog * 1.5),
      };
    }),
  },
];

export function MissionReplayAndArchitecture({
  telemetry,
  dtState,
  liveHistory,
}: {
  telemetry: EngineTelemetry;
  dtState: EngineHealthState & { active_alerts?: FaultAlert[] };
  liveHistory: (EngineTelemetry & { time: string })[];
}) {
  const [selectedSortieId, setSelectedSortieId] = useState<string>('sortie-104');
  const [replayIndex, setReplayIndex] = useState<number>(14);
  const [isPlayingReplay, setIsPlayingReplay] = useState<boolean>(false);
  const [freezeCanBus, setFreezeCanBus] = useState<boolean>(false);

  const activeSortie =
    HISTORICAL_SORTIES.find((s) => s.id === selectedSortieId) ||
    HISTORICAL_SORTIES[0];

  useEffect(() => {
    if (!isPlayingReplay) return;
    const timer = setInterval(() => {
      setReplayIndex((prev) => (prev + 1) % activeSortie.frames.length);
    }, 650);
    return () => clearInterval(timer);
  }, [isPlayingReplay, activeSortie.frames.length]);

  const currentReplayFrame =
    activeSortie.frames[replayIndex] || activeSortie.frames[0];

  // Generate Real-Time SocketCAN / SAE J1939 Avionics Hex Frames from Live Telemetry
  const canBusFrames = useMemo(() => {
    const toHex16 = (val: number) =>
      Math.max(0, Math.min(65535, Math.round(val)))
        .toString(16)
        .toUpperCase()
        .padStart(4, '0');
    const toHex8 = (val: number) =>
      Math.max(0, Math.min(255, Math.round(val)))
        .toString(16)
        .toUpperCase()
        .padStart(2, '0');

    const rpmHex = toHex16(telemetry.rpm * 8);
    const thrHex = toHex8(telemetry.throttle * 2.5);
    const chtHex = toHex16((telemetry.cht + 273) * 32);
    const egtHex = toHex16((telemetry.egt + 273) * 32);
    const oilPHex = toHex8(telemetry.oil_pressure * 25);
    const oilTHex = toHex8(telemetry.oil_temp + 40);
    const fuelHex = toHex16(telemetry.fuel_flow * 20);
    const vibHex = toHex8(telemetry.vibration * 2);

    return [
      {
        canId: '0x0CF00400',
        pgn: '61444 (EEC1)',
        rate: '10 ms',
        dlc: 8,
        payload: `F0 ${thrHex} 7D ${rpmHex.slice(0, 2)} ${rpmHex.slice(2, 4)} 00 15 FF`,
        decoded: `RPM: ${telemetry.rpm.toFixed(0)} · Throttle: ${telemetry.throttle.toFixed(1)}% · Timing: ${(telemetry.injection_timing_deg || 15.1).toFixed(1)}°`,
      },
      {
        canId: '0x18FEEE00',
        pgn: '65262 (ET1)',
        rate: '50 ms',
        dlc: 8,
        payload: `${chtHex.slice(0, 2)} ${chtHex.slice(2, 4)} ${oilTHex} ${egtHex.slice(0, 2)} ${egtHex.slice(2, 4)} 00 FF FF`,
        decoded: `CHT: ${telemetry.cht.toFixed(1)}°C · EGT: ${telemetry.egt.toFixed(1)}°C · Oil Temp: ${telemetry.oil_temp.toFixed(1)}°C`,
      },
      {
        canId: '0x18FEEF00',
        pgn: '65263 (EFL/P1)',
        rate: '50 ms',
        dlc: 8,
        payload: `${oilPHex} 80 ${fuelHex.slice(0, 2)} ${fuelHex.slice(2, 4)} ${vibHex} 00 1C FF`,
        decoded: `Oil Press: ${telemetry.oil_pressure.toFixed(2)} bar · Fuel: ${telemetry.fuel_flow.toFixed(1)} L/h · Vib: ${telemetry.vibration.toFixed(1)} mm/s`,
      },
      {
        canId: '0x18FD0900',
        pgn: '64777 (FADEC-DT)',
        rate: '100 ms',
        dlc: 8,
        payload: `${toHex8(dtState.overall_health)} ${toHex16(dtState.rul_estimated_hours).slice(0, 2)} ${toHex16(dtState.rul_estimated_hours).slice(2, 4)} ${toHex8((telemetry.sensor_drift_delta || 0) * 2)} 01 A5 5A`,
        decoded: `Twin Health: ${dtState.overall_health.toFixed(1)}% · RUL: ${dtState.rul_estimated_hours.toFixed(0)}h · Ch-A/B Drift: ${(telemetry.sensor_drift_delta || 0.5).toFixed(1)}°C`,
      },
    ];
  }, [
    freezeCanBus ? null : telemetry,
    freezeCanBus ? null : dtState.overall_health,
  ]);

  const handleDownloadSortieLog = () => {
    const blob = new Blob([JSON.stringify(activeSortie, null, 2)], {
      type: 'application/json',
    });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = `${activeSortie.code.toLowerCase()}_replay_log.json`;
    a.click();
    URL.revokeObjectURL(url);
  };

  return (
    <div className="space-y-4 pb-6 select-none">
      {/* =================================================================== */}
      {/* 1. POST-FLIGHT MISSION REPLAY & BLACK-BOX TIMELINE SCRUBBER         */}
      {/* =================================================================== */}
      <div className="bg-[#0B0F17] border border-slate-800 rounded-xl p-4">
        <div className="flex flex-wrap items-center justify-between gap-3 mb-3 border-b border-slate-800 pb-3">
          <div className="flex items-center gap-2.5">
            <History className="w-5 h-5 text-emerald-400" />
            <div>
              <h2 className="text-sm font-bold text-white uppercase tracking-wide">
                DRDO Section E: Post-Flight Mission Replay & Black-Box Telemetry Scrubber
              </h2>
              <p className="text-xs text-slate-400">
                Replay recorded UAV sorties across high-altitude, desert, and maritime profiles to inspect pre-fault degradation trajectories.
              </p>
            </div>
          </div>

          <div className="flex flex-wrap items-center gap-2">
            {HISTORICAL_SORTIES.map((s) => (
              <button
                key={s.id}
                onClick={() => {
                  setSelectedSortieId(s.id);
                  setReplayIndex(0);
                }}
                className={clsx(
                  'px-2.5 py-1 rounded-md text-xs font-mono border transition-colors',
                  selectedSortieId === s.id
                    ? 'bg-emerald-600 text-white border-emerald-400 font-semibold'
                    : 'bg-slate-900 text-slate-300 border-slate-700 hover:bg-slate-800'
                )}
              >
                {s.code}
              </button>
            ))}

            <button
              onClick={handleDownloadSortieLog}
              className="px-2.5 py-1 rounded-md bg-slate-900 hover:bg-slate-800 border border-slate-700 text-xs font-mono text-cyan-300 flex items-center gap-1"
            >
              <Download className="w-3.5 h-3.5" />
              Export FDR Log
            </button>
          </div>
        </div>

        {/* Replay Scrubber Controls & Selected Frame Snapshot */}
        <div className="grid grid-cols-1 lg:grid-cols-12 gap-4 items-center">
          <div className="lg:col-span-8 flex flex-col gap-2">
            <div className="flex items-center justify-between text-xs font-mono">
              <span className="text-emerald-400 font-semibold">
                {activeSortie.title}
              </span>
              <span className="text-slate-400">
                {activeSortie.location} · {activeSortie.altitudeFt.toLocaleString()} ft
              </span>
            </div>

            <div className="h-56 w-full bg-slate-950/70 rounded-lg border border-slate-800/80 p-2">
              <ResponsiveContainer width="100%" height="100%">
                <LineChart data={activeSortie.frames}>
                  <CartesianGrid strokeDasharray="3 3" stroke="#1e293b" />
                  <XAxis dataKey="t" stroke="#64748b" fontSize={11} />
                  <YAxis yAxisId="left" stroke="#f97316" fontSize={11} domain={[140, 230]} />
                  <YAxis
                    yAxisId="right"
                    orientation="right"
                    stroke="#38bdf8"
                    fontSize={11}
                    domain={[680, 840]}
                  />
                  <Tooltip
                    contentStyle={{
                      backgroundColor: '#090d16',
                      border: '1px solid #334155',
                      fontSize: '11px',
                    }}
                  />
                  <Line
                    yAxisId="left"
                    type="monotone"
                    dataKey="cht"
                    stroke="#f97316"
                    strokeWidth={2}
                    name="Replay CHT (°C)"
                  />
                  <Line
                    yAxisId="right"
                    type="monotone"
                    dataKey="egt"
                    stroke="#38bdf8"
                    strokeWidth={2}
                    name="Replay EGT (°C)"
                  />
                  <ReferenceDot
                    yAxisId="left"
                    x={currentReplayFrame.t}
                    y={currentReplayFrame.cht}
                    r={6}
                    fill="#10b981"
                    stroke="#ffffff"
                  />
                </LineChart>
              </ResponsiveContainer>
            </div>

            {/* Interactive Timeline Scrubber Bar */}
            <div className="flex items-center gap-3 bg-slate-950 px-3 py-2 rounded-lg border border-slate-800">
              <button
                onClick={() => setIsPlayingReplay((p) => !p)}
                className="px-3 py-1 rounded bg-emerald-600 hover:bg-emerald-500 text-white text-xs font-mono font-semibold flex items-center gap-1"
              >
                {isPlayingReplay ? (
                  <Pause className="w-3.5 h-3.5" />
                ) : (
                  <Play className="w-3.5 h-3.5" />
                )}
                {isPlayingReplay ? 'Pause' : 'Play Sortie'}
              </button>
              <button
                onClick={() => {
                  setIsPlayingReplay(false);
                  setReplayIndex(0);
                }}
                className="p-1.5 rounded bg-slate-900 hover:bg-slate-800 text-slate-300 border border-slate-700"
              >
                <RotateCcw className="w-3.5 h-3.5" />
              </button>
              <input
                type="range"
                min={0}
                max={activeSortie.frames.length - 1}
                value={replayIndex}
                onChange={(e) => {
                  setIsPlayingReplay(false);
                  setReplayIndex(Number(e.target.value));
                }}
                className="flex-1 accent-emerald-400 cursor-pointer"
              />
              <span className="text-xs font-mono font-bold text-emerald-400 w-16 text-right">
                {currentReplayFrame.t}
              </span>
            </div>
          </div>

          {/* Selected Replay Timestamp Telemetry & Post-Flight Finding */}
          <div className="lg:col-span-4 bg-slate-950 border border-slate-800 rounded-xl p-3.5 flex flex-col justify-between h-full">
            <div>
              <div className="flex items-center justify-between text-[10px] font-mono text-amber-400 uppercase mb-2">
                <span>BLACK-BOX FRAME SNAPSHOT</span>
                <span>TIMESTAMP: {currentReplayFrame.t}</span>
              </div>

              <div className="grid grid-cols-2 gap-2 text-xs font-mono">
                <div className="p-2 rounded bg-slate-900/90 border border-slate-800">
                  <span className="text-[10px] text-slate-400 block">ENGINE RPM</span>
                  <strong className="text-white text-sm">{currentReplayFrame.rpm} RPM</strong>
                </div>
                <div className="p-2 rounded bg-slate-900/90 border border-slate-800">
                  <span className="text-[10px] text-slate-400 block">CHT / EGT</span>
                  <strong className="text-orange-300 text-sm">
                    {currentReplayFrame.cht}° / {currentReplayFrame.egt}°C
                  </strong>
                </div>
                <div className="p-2 rounded bg-slate-900/90 border border-slate-800">
                  <span className="text-[10px] text-slate-400 block">OIL PRESSURE</span>
                  <strong className="text-emerald-400 text-sm">
                    {currentReplayFrame.oilPress} bar
                  </strong>
                </div>
                <div className="p-2 rounded bg-slate-900/90 border border-slate-800">
                  <span className="text-[10px] text-slate-400 block">BSFC EFFICIENCY</span>
                  <strong className="text-cyan-300 text-sm">
                    {currentReplayFrame.bsfc} g/kWh
                  </strong>
                </div>
              </div>
            </div>

            <div className="mt-3 p-2.5 rounded-lg bg-amber-950/25 border border-amber-500/40 text-xs">
              <div className="text-[10px] font-mono font-bold text-amber-300 uppercase mb-1">
                POST-FLIGHT AI DEBRIEF FINDING:
              </div>
              <p className="text-slate-300 leading-relaxed text-[11px]">
                {activeSortie.finding}
              </p>
            </div>
          </div>
        </div>
      </div>

      {/* =================================================================== */}
      {/* 2. SOCKETCAN / SAE J1939 FADEC BUS MONITOR & SYSTEM ARCHITECTURE    */}
      {/* =================================================================== */}
      <div className="grid grid-cols-1 lg:grid-cols-12 gap-4">
        {/* Live SocketCAN / FADEC Telemetry Frame Analyzer */}
        <div className="lg:col-span-6 bg-[#0B0F17] border border-slate-800 rounded-xl p-4">
          <div className="flex items-center justify-between mb-3">
            <div className="flex items-center gap-2">
              <Radio className="w-4 h-4 text-cyan-400" />
              <div>
                <h3 className="text-xs font-mono font-bold text-white uppercase tracking-wider">
                  SocketCAN (can0 @ 500 kbps) & Dual-FADEC Frame Bus
                </h3>
                <p className="text-[11px] text-slate-400">
                  Real-time SAE J1939 / CAN-Aerospace hexadecimal telemetry ingestion stream.
                </p>
              </div>
            </div>

            <button
              onClick={() => setFreezeCanBus((f) => !f)}
              className={clsx(
                'px-2.5 py-1 rounded text-[10px] font-mono border transition-colors',
                freezeCanBus
                  ? 'bg-amber-600/30 border-amber-400 text-amber-200'
                  : 'bg-slate-900 border-slate-700 text-slate-300'
              )}
            >
              {freezeCanBus ? 'Resume Bus' : 'Freeze Frames'}
            </button>
          </div>

          <div className="space-y-2 font-mono text-[11px]">
            {canBusFrames.map((f) => (
              <div
                key={f.canId}
                className="p-2.5 rounded-lg bg-slate-950 border border-slate-800/90 space-y-1"
              >
                <div className="flex items-center justify-between">
                  <span className="text-emerald-400 font-bold">
                    {f.canId} · PGN {f.pgn}
                  </span>
                  <span className="text-cyan-300 bg-cyan-950/60 px-2 py-0.5 rounded border border-cyan-800/60">
                    {f.payload}
                  </span>
                </div>
                <div className="flex items-center justify-between text-[10px] text-slate-400">
                  <span>{f.decoded}</span>
                  <span>Rate: {f.rate}</span>
                </div>
              </div>
            ))}
          </div>
        </div>

        {/* DRDO Indigenous 4-Tier Digital Twin Deployment Architecture */}
        <div className="lg:col-span-6 bg-[#0B0F17] border border-slate-800 rounded-xl p-4 flex flex-col justify-between">
          <div>
            <div className="flex items-center justify-between mb-3">
              <div className="flex items-center gap-2">
                <Layers className="w-4 h-4 text-emerald-400" />
                <div>
                  <h3 className="text-xs font-mono font-bold text-white uppercase tracking-wider">
                    Indigenous MALE UAV Digital Twin Architecture & Roadmap
                  </h3>
                  <p className="text-[11px] text-slate-400">
                    Modular 4-tier Edge-to-GCS-to-Fleet architecture for TAPAS-BH-201 deployment.
                  </p>
                </div>
              </div>
              <span className="px-2 py-0.5 rounded bg-emerald-500/15 text-emerald-300 text-[10px] font-mono">
                TRL-6 PROTOTYPE
              </span>
            </div>

            <div className="grid grid-cols-1 sm:grid-cols-2 gap-2.5 text-xs">
              <div className="p-3 rounded-lg bg-slate-950 border border-slate-800">
                <div className="text-[10px] font-mono text-emerald-400 font-bold uppercase">
                  1. ONBOARD UAV EDGE AI NODE
                </div>
                <p className="text-[11px] text-slate-300 mt-1">
                  Dual-lane FADEC + SocketCAN 500 kbps acquisition with lightweight Kalman sensor-drift filter & 100 Hz knock FFT onboard processor.
                </p>
              </div>

              <div className="p-3 rounded-lg bg-slate-950 border border-slate-800">
                <div className="text-[10px] font-mono text-cyan-400 font-bold uppercase">
                  2. SECURE TELEMETRY LINK
                </div>
                <p className="text-[11px] text-slate-300 mt-1">
                  AES-256 encrypted C-Band Line-of-Sight (LOS) & Ku-Band SATCOM downlink streaming 10 Hz state vectors to the Ground Control Station.
                </p>
              </div>

              <div className="p-3 rounded-lg bg-slate-950 border border-slate-800">
                <div className="text-[10px] font-mono text-amber-400 font-bold uppercase">
                  3. GCS HYBRID DIGITAL TWIN CORE
                </div>
                <p className="text-[11px] text-slate-300 mt-1">
                  Couples 0D/1D Otto-cycle thermodynamic physics baseline with residual ML anomaly detection, 2D/3D CAD kinematic twin, and RUL prognostics.
                </p>
              </div>

              <div className="p-3 rounded-lg bg-slate-950 border border-slate-800">
                <div className="text-[10px] font-mono text-purple-400 font-bold uppercase">
                  4. FLEET FEDERATED LEARNING & MRO
                </div>
                <p className="text-[11px] text-slate-300 mt-1">
                  Aggregates post-flight degradation signatures across UAV squadrons without sharing raw classified mission logs; automates LRU work orders.
                </p>
              </div>
            </div>
          </div>

          <div className="mt-3 pt-2.5 border-t border-slate-800 flex items-center justify-between text-[11px] font-mono text-slate-400">
            <span>COMPLIANCE: MIL-STD-1553B / SAE J1939 / STANAG 4586</span>
            <span className="text-emerald-400 font-semibold">100% DRDO BRIEF COVERAGE</span>
          </div>
        </div>
      </div>
    </div>
  );
}
