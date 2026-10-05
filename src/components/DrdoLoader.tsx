import React, { useEffect, useState } from 'react';
import {
  CheckCircle2,
  Cpu,
  Radio,
  ShieldCheck,
  Gauge,
  Activity,
  Layers,
  ArrowRight,
} from 'lucide-react';
import clsx from 'clsx';
import { DrdoLogo } from './DrdoLogo';

interface BootStage {
  id: string;
  code: string;
  title: string;
  detail: string;
  threshold: number;
}

const BOOT_STAGES: BootStage[] = [
  {
    id: 'can_fadec',
    code: 'SYS-01',
    title: 'SocketCAN (can0 @ 500 kbps) & Dual-FADEC Handshake',
    detail: 'SAE J1939 PGN 61444 / 65262 / 65263 / 64777 frame stream locked',
    threshold: 22,
  },
  {
    id: 'sensors_kalman',
    code: 'SYS-02',
    title: '8-Parameter Sensor Suite & Extended Kalman Filter Sync',
    detail: 'RPM · CHT · EGT · Oil P/T · Fuel Flow · Vib FFT · 28V Bus · Timing °BTDC',
    threshold: 48,
  },
  {
    id: 'physics_cad',
    code: 'SYS-03',
    title: '0D/1D Otto-Cycle Thermodynamic & 3D CAD Kinematic Twin',
    detail: 'Flat-4 1-3-2-4 firing phase + ISA atmospheric compensator calibrated',
    threshold: 75,
  },
  {
    id: 'ai_rul_xai',
    code: 'SYS-04',
    title: 'Hybrid AI/ML 8-Fault Classifier, SHAP XAI & Weibull RUL Engine',
    detail: 'Pre-emptive fault mitigation & C-Band AES-256 telemetry pipeline active',
    threshold: 96,
  },
];

export function DrdoLoader({
  progress,
  telemetryReady,
  onSkip,
}: {
  progress: number;
  telemetryReady: boolean;
  onSkip?: () => void;
}) {
  const [activeCylinder, setActiveCylinder] = useState<number>(1);

  // Cycle through Flat-4 firing order 1 -> 3 -> 2 -> 4 during boot
  useEffect(() => {
    const order = [1, 3, 2, 4];
    let idx = 0;
    const timer = setInterval(() => {
      idx = (idx + 1) % order.length;
      setActiveCylinder(order[idx]);
    }, 220);
    return () => clearInterval(timer);
  }, []);

  const currentStage =
    BOOT_STAGES.find((s) => progress < s.threshold) ||
    BOOT_STAGES[BOOT_STAGES.length - 1];

  return (
    <div className="fixed inset-0 z-50 bg-[#050811] text-slate-200 flex flex-col items-center justify-center p-4 overflow-hidden select-none">
      {/* Subtle Tactical Grid & Radial Glow Background */}
      <div
        className="absolute inset-0 opacity-20 pointer-events-none"
        style={{
          backgroundImage:
            'radial-gradient(circle at 50% 42%, rgba(14, 165, 233, 0.28), transparent 60%), linear-gradient(to right, #1e293b 1px, transparent 1px), linear-gradient(to bottom, #1e293b 1px, transparent 1px)',
          backgroundSize: '100% 100%, 40px 40px, 40px 40px',
        }}
      />

      {/* Corner HUD Framing Brackets */}
      <div className="absolute top-5 left-5 w-8 h-8 border-t-2 border-l-2 border-cyan-500/40 pointer-events-none" />
      <div className="absolute top-5 right-5 w-8 h-8 border-t-2 border-r-2 border-cyan-500/40 pointer-events-none" />
      <div className="absolute bottom-5 left-5 w-8 h-8 border-b-2 border-l-2 border-cyan-500/40 pointer-events-none" />
      <div className="absolute bottom-5 right-5 w-8 h-8 border-b-2 border-r-2 border-cyan-500/40 pointer-events-none" />

      {/* Top Classification / System Telemetry Strip */}
      <div className="relative z-10 flex items-center gap-3 px-3.5 py-1 rounded-full bg-slate-900/90 border border-slate-800 text-[10px] font-mono text-cyan-300 tracking-widest uppercase mb-6 shadow-lg">
        <span className="w-2 h-2 rounded-full bg-emerald-400 animate-ping" />
        <span>DRDO · MALE UAV PROPULSION DIGITAL TWIN GCS</span>
        <span className="text-slate-600">|</span>
        <span className="text-emerald-400">STANAG 4586 / SAE J1939</span>
      </div>

      {/* Centerpiece: Rotating Aerospace Radar Rings + Official DRDO Emblem */}
      <div className="relative z-10 flex items-center justify-center w-52 h-52 mb-6">
        {/* Outer SVG Progress & Radar Bezel */}
        <svg
          viewBox="0 0 220 220"
          className="absolute inset-0 w-full h-full -rotate-90"
        >
          {/* Outer Degree Tick Ring */}
          {Array.from({ length: 36 }).map((_, i) => {
            const angle = i * 10;
            const isMajor = i % 3 === 0;
            return (
              <line
                key={i}
                x1="110"
                y1={isMajor ? '4' : '7'}
                x2="110"
                y2="12"
                stroke={i * 2.77 <= progress ? '#38bdf8' : '#1e293b'}
                strokeWidth={isMajor ? '2' : '1'}
                transform={`rotate(${angle} 110 110)`}
              />
            );
          })}

          {/* Track Circle */}
          <circle
            cx="110"
            cy="110"
            r="90"
            fill="none"
            stroke="#0f172a"
            strokeWidth="5"
          />

          {/* Animated Progress Arc */}
          <circle
            cx="110"
            cy="110"
            r="90"
            fill="none"
            stroke="url(#loaderCyanEmerald)"
            strokeWidth="5"
            strokeLinecap="round"
            strokeDasharray={2 * Math.PI * 90}
            strokeDashoffset={2 * Math.PI * 90 * (1 - progress / 100)}
            className="transition-all duration-150 ease-out"
          />

          <defs>
            <linearGradient id="loaderCyanEmerald" x1="0%" y1="0%" x2="100%" y2="100%">
              <stop offset="0%" stopColor="#38bdf8" />
              <stop offset="100%" stopColor="#10b981" />
            </linearGradient>
          </defs>
        </svg>

        {/* Counter-Rotating Dashed Technical Ring */}
        <div className="absolute inset-5 rounded-full border border-dashed border-cyan-500/35 animate-[spin_14s_linear_infinite]" />
        <div className="absolute inset-8 rounded-full border border-emerald-500/20 animate-[spin_9s_linear_infinite_reverse]" />

        {/* Official DRDO Logo Emblem in Center */}
        <div className="relative z-10 flex flex-col items-center">
          <DrdoLogo size="xl" showText={false} />
        </div>
      </div>

      {/* Organization Name Only "DRDO" + Twin Subtitle */}
      <div className="relative z-10 text-center mb-5">
        <div className="text-2xl font-extrabold tracking-[0.28em] text-white font-mono">
          DRDO
        </div>
        <p className="text-xs font-mono text-slate-400 mt-1">
          AI-Enabled Real-Time Aero-Piston Engine Digital Twin System
        </p>
      </div>

      {/* Main Boot Console Card */}
      <div className="relative z-10 w-full max-w-2xl bg-[#0B0F17]/95 backdrop-blur-md border border-slate-800 rounded-2xl p-5 shadow-2xl space-y-4">
        {/* Progress Bar Header */}
        <div className="flex items-center justify-between text-xs font-mono">
          <div className="flex items-center gap-2 text-cyan-300">
            <Cpu className="w-4 h-4 animate-pulse" />
            <span className="truncate">{currentStage.title}</span>
          </div>
          <span className="text-sm font-bold text-emerald-400 tabular-nums">
            {Math.round(progress)}%
          </span>
        </div>

        {/* High-Precision Segmented Progress Bar */}
        <div className="h-2 w-full bg-slate-950 rounded-full overflow-hidden border border-slate-800 p-0.5">
          <div
            className="h-full rounded-full bg-gradient-to-r from-sky-500 via-cyan-400 to-emerald-400 transition-all duration-150"
            style={{ width: `${progress}%` }}
          />
        </div>

        {/* 4-Stage Subsystem Checklist */}
        <div className="grid grid-cols-1 sm:grid-cols-2 gap-2.5 pt-1">
          {BOOT_STAGES.map((stage) => {
            const completed = progress >= stage.threshold;
            const active =
              !completed &&
              progress >= (stage.threshold - 28);
            return (
              <div
                key={stage.id}
                className={clsx(
                  'p-2.5 rounded-xl border transition-all flex items-start gap-2.5',
                  completed
                    ? 'bg-emerald-950/20 border-emerald-500/40 text-slate-100'
                    : active
                    ? 'bg-cyan-950/25 border-cyan-500/40 text-slate-200'
                    : 'bg-slate-950/70 border-slate-800/80 text-slate-500'
                )}
              >
                <div className="mt-0.5 shrink-0">
                  {completed ? (
                    <CheckCircle2 className="w-4 h-4 text-emerald-400" />
                  ) : active ? (
                    <Activity className="w-4 h-4 text-cyan-400 animate-pulse" />
                  ) : (
                    <div className="w-4 h-4 rounded-full border border-slate-700" />
                  )}
                </div>
                <div className="min-w-0 flex-1">
                  <div className="flex items-center justify-between gap-1 text-[10px] font-mono">
                    <span
                      className={clsx(
                        'font-bold',
                        completed
                          ? 'text-emerald-400'
                          : active
                          ? 'text-cyan-300'
                          : 'text-slate-500'
                      )}
                    >
                      {stage.code}
                    </span>
                    <span>
                      {completed ? 'LOCKED' : active ? 'SYNCING...' : 'STANDBY'}
                    </span>
                  </div>
                  <div className="text-xs font-semibold truncate mt-0.5">
                    {stage.title}
                  </div>
                  <div className="text-[10px] text-slate-400 truncate mt-0.5 font-mono">
                    {stage.detail}
                  </div>
                </div>
              </div>
            );
          })}
        </div>

        {/* Bottom Live Firing-Order Pulse & Hardware Status Footer */}
        <div className="pt-3 border-t border-slate-800/90 flex flex-wrap items-center justify-between gap-3 text-[11px] font-mono">
          <div className="flex items-center gap-2">
            <span className="text-slate-400">FLAT-4 FIRING ORDER SYNC:</span>
            <div className="flex items-center gap-1">
              {[1, 3, 2, 4].map((cyl) => (
                <span
                  key={cyl}
                  className={clsx(
                    'px-2 py-0.5 rounded text-[10px] font-bold border transition-colors',
                    activeCylinder === cyl
                      ? 'bg-amber-500/25 border-amber-400 text-amber-300 shadow-[0_0_8px_rgba(245,158,11,0.3)]'
                      : 'bg-slate-900 border-slate-800 text-slate-500'
                  )}
                >
                  CYL #{cyl}
                </span>
              ))}
            </div>
          </div>

          <div className="flex items-center gap-3">
            <span
              className={clsx(
                'text-[10px] px-2 py-0.5 rounded border',
                telemetryReady
                  ? 'bg-emerald-500/15 border-emerald-500/40 text-emerald-300'
                  : 'bg-amber-500/15 border-amber-500/40 text-amber-300'
              )}
            >
              {telemetryReady ? 'TELEMETRY LINK: ONLINE (10 HZ)' : 'CONNECTING BUS...'}
            </span>

            {onSkip && (
              <button
                onClick={onSkip}
                className="px-2.5 py-1 rounded bg-slate-900 hover:bg-slate-800 text-cyan-300 border border-slate-700 text-[10px] flex items-center gap-1 transition-colors cursor-pointer"
              >
                <span>Enter GCS Now</span>
                <ArrowRight className="w-3 h-3" />
              </button>
            )}
          </div>
        </div>
      </div>
    </div>
  );
}
