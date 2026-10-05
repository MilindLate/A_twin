import React, { useEffect, useState } from 'react';
import { EngineTelemetry, EngineHealthState, FaultAlert, MissionProfileId } from './types';
import { io } from 'socket.io-client';
import { LineChart, Line, XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer } from 'recharts';
import {
  Activity,
  AlertTriangle,
  CheckCircle,
  Settings,
  Gauge,
  Flame,
  Wind,
  Droplet,
  LayoutDashboard,
  Box,
  FileText,
  Cpu,
  Compass,
  RotateCcw,
  Wrench,
  History
} from 'lucide-react';
import clsx from 'clsx';
import { Engine3D } from './components/Engine3D';
import { EngineCore3D } from './components/EngineCore3D';
import { Engine2D } from './components/Engine2D';
import { Diagnostics } from './components/Diagnostics';
import { MissionReplayAndArchitecture } from './components/MissionReplayAndArchitecture';
import { DrdoLogo } from './components/DrdoLogo';
import { DrdoLoader } from './components/DrdoLoader';

const socket = io();

const MAX_HISTORY = 60;

const MISSION_PROFILES: {
  id: MissionProfileId;
  label: string;
  summary: string;
}[] = [
  {
    id: 'standard_isr',
    label: 'Standard ISR Cruise (18,000 ft · -15°C)',
    summary:
      'Nominal medium-altitude reconnaissance loiter at 75% steady throttle and balanced thermal equilibrium.',
  },
  {
    id: 'high_altitude',
    label: 'High Altitude Ceiling (28,000 ft · -41°C)',
    summary:
      'Reduced air density lowers convective fin cooling while high turbocharger boost raises EGT (+32°C) and RPM (2,620 rpm).',
  },
  {
    id: 'hot_weather',
    label: 'Hot Weather Desert Ops (4,500 ft · +42°C)',
    summary:
      'Extreme ISA+27 ambient heat saturates cylinder heads (+26°C CHT) and oil cooler (+20°C Oil Temp), reducing oil viscosity and pressure.',
  },
  {
    id: 'rapid_throttle',
    label: 'Rapid Throttle Transient Surge (45%–99% Load)',
    summary:
      'Cyclic throttle sweeps induce rapid RPM/fuel-flow transients, combustion EGT swings, and elevated torsional vibration.',
  },
  {
    id: 'maritime_patrol',
    label: 'Maritime Low-Alt Endurance (2,500 ft · +20°C)',
    summary:
      'Dense low-altitude airflow maximizes cylinder cooling efficiency at economy 60% throttle (2,160 rpm) and reduced fuel burn.',
  },
];

export default function App() {
  const [telemetry, setTelemetry] = useState<EngineTelemetry | null>(null);
  const [dtState, setDtState] = useState<
    (EngineHealthState & { active_alerts: FaultAlert[] }) | null
  >(null);
  const [history, setHistory] = useState<(EngineTelemetry & { time: string })[]>(
    []
  );
  const [activeTab, setActiveTab] = useState<
    '3d' | 'engine_core' | '2d' | 'overview' | 'diagnostics' | 'replay_arch'
  >('3d');
  const [bootProgress, setBootProgress] = useState<number>(0);
  const [isBooting, setIsBooting] = useState<boolean>(true);

  useEffect(() => {
    if (!isBooting) return;
    const interval = setInterval(() => {
      setBootProgress((prev) => {
        if (prev >= 100) {
          clearInterval(interval);
          setTimeout(() => setIsBooting(false), 180);
          return 100;
        }
        return Math.min(100, prev + 4.5);
      });
    }, 80);
    return () => clearInterval(interval);
  }, [isBooting]);

  useEffect(() => {
    let lastUpdate = 0;

    socket.on('telemetry', (data: EngineTelemetry) => {
      setTelemetry(data);

      const now = Date.now();
      if (now - lastUpdate > 500) {
        setHistory((prev) => {
          const newHist = [
            ...prev,
            { ...data, time: new Date(data.timestamp).toLocaleTimeString() },
          ];
          if (newHist.length > MAX_HISTORY)
            return newHist.slice(newHist.length - MAX_HISTORY);
          return newHist;
        });
        lastUpdate = now;
      }
    });

    socket.on('dt_state', (data: any) => {
      setDtState(data);
    });

    return () => {
      socket.off('telemetry');
      socket.off('dt_state');
    };
  }, []);

  const injectFault = async (fault: string, severity: number) => {
    await fetch('/api/fault/inject', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ fault, severity }),
    });
  };

  const clearFaults = async () => {
    await fetch('/api/fault/clear', { method: 'POST' });
  };

  const selectMissionProfile = async (profile: MissionProfileId) => {
    await fetch('/api/mission/profile', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ profile }),
    });
  };

  if (!telemetry || !dtState || isBooting) {
    return (
      <DrdoLoader
        progress={
          !telemetry || !dtState
            ? Math.min(88, bootProgress)
            : bootProgress
        }
        telemetryReady={Boolean(telemetry && dtState)}
        onSkip={
          telemetry && dtState
            ? () => {
                setBootProgress(100);
                setIsBooting(false);
              }
            : undefined
        }
      />
    );
  }

  return (
    <div className="h-screen bg-[#07090E] text-slate-200 font-sans flex flex-col overflow-hidden">
      {/* PROFESSIONAL 3-ZONE TOP COMMAND HEADER */}
      <header className="flex items-center justify-between bg-[#0B0F17] px-4 py-2 border-b border-slate-800/90 shrink-0 gap-2">
        {/* Zone 1: Official DRDO Emblem & Name Only DRDO (Click to Re-Run System Sync) */}
        <button
          onClick={() => {
            setBootProgress(0);
            setIsBooting(true);
          }}
          title="Click to run DRDO Digital Twin System Initialization Check"
          className="flex items-center gap-2.5 cursor-pointer hover:opacity-90 transition-opacity"
        >
          <DrdoLogo size="md" showText={true} />
        </button>

        {/* Zone 2: Primary View Navigation */}
        <nav className="flex items-center gap-1 bg-[#07090E] p-1 rounded-lg border border-slate-800 overflow-x-auto">
          <NavTab
            active={activeTab === '3d'}
            onClick={() => setActiveTab('3d')}
            icon={<Box className="w-4 h-4" />}
            label="3D Flight & Drone Twin"
          />
          <NavTab
            active={activeTab === 'engine_core'}
            onClick={() => setActiveTab('engine_core')}
            icon={<Wrench className="w-4 h-4" />}
            label="3D Engine CAD Lab"
          />
          <NavTab
            active={activeTab === '2d'}
            onClick={() => setActiveTab('2d')}
            icon={<Cpu className="w-4 h-4" />}
            label="2D Cross-Section"
          />
          <NavTab
            active={activeTab === 'overview'}
            onClick={() => setActiveTab('overview')}
            icon={<LayoutDashboard className="w-4 h-4" />}
            label="Telemetry & Mission"
          />
          <NavTab
            active={activeTab === 'diagnostics'}
            onClick={() => setActiveTab('diagnostics')}
            icon={<FileText className="w-4 h-4" />}
            label="AI Diagnostics & RUL"
          />
          <NavTab
            active={activeTab === 'replay_arch'}
            onClick={() => setActiveTab('replay_arch')}
            icon={<History className="w-4 h-4" />}
            label="Replay, CAN & Arch"
          />
        </nav>

        {/* Zone 3: Complete 8-Fault DRDO Injection & Health Readout */}
        <div className="flex items-center gap-2">
          <div className="hidden xl:flex items-center gap-2.5 mr-1 text-xs font-mono text-slate-400">
            <span>
              HEALTH:{' '}
              <strong
                className={clsx(
                  'tabular-nums',
                  dtState.overall_health > 85
                    ? 'text-emerald-400'
                    : dtState.overall_health > 60
                    ? 'text-amber-400'
                    : 'text-rose-400'
                )}
              >
                {dtState.overall_health.toFixed(1)}%
              </strong>
            </span>
            <span className="text-slate-700">·</span>
            <span>
              RUL:{' '}
              <strong className="text-slate-200 tabular-nums">
                {dtState.rul_estimated_hours.toFixed(0)}h
              </strong>
            </span>
          </div>

          <select
            aria-label="Inject DRDO Propulsion Fault"
            defaultValue=""
            onChange={(e) => {
              if (e.target.value) {
                injectFault(e.target.value, 0.75);
                e.target.value = '';
              }
            }}
            className="bg-rose-950/50 hover:bg-rose-900/60 text-rose-200 text-xs font-mono rounded border border-rose-800/70 px-2.5 py-1 outline-none cursor-pointer"
          >
            <option value="" disabled>
              + Inject 8 DRDO Faults...
            </option>
            <option value="misfire">F01: Misfire Condition (Cyl #3)</option>
            <option value="injector_degradation">F02: Injector Clog / Lean</option>
            <option value="cooling_failure">F03: Cooling Degradation</option>
            <option value="lubrication_failure">F04: Lubrication / Oil Leak</option>
            <option value="sensor_drift">F05: EGT Sensor Drift (Kalman)</option>
            <option value="combustion_instability">F06: Combustion Knock</option>
            <option value="overheating">F07: Overheating Trend</option>
            <option value="abnormal_vibration">F08: Abnormal PSRU Vibration</option>
          </select>

          <button
            onClick={() => clearFaults()}
            className="px-2.5 py-1 text-xs font-medium bg-slate-800 hover:bg-slate-700 text-slate-200 rounded border border-slate-700 transition-colors flex items-center gap-1 whitespace-nowrap"
          >
            <RotateCcw className="w-3 h-3" />
            Nominal
          </button>
        </div>
      </header>

      {/* MAIN VIEWPORT STAGE */}
      <main className="flex-1 p-3 overflow-y-auto">
        {activeTab === '3d' && (
          <Engine3D
            telemetry={telemetry}
            dtState={dtState}
            onOpenEngineLab={() => setActiveTab('engine_core')}
          />
        )}
        {activeTab === 'engine_core' && (
          <EngineCore3D telemetry={telemetry} dtState={dtState} />
        )}
        {activeTab === '2d' && (
          <Engine2D telemetry={telemetry} dtState={dtState} />
        )}
        {activeTab === 'overview' && (
          <OverviewView
            telemetry={telemetry}
            dtState={dtState}
            history={history}
            onSelectMissionProfile={selectMissionProfile}
          />
        )}
        {activeTab === 'diagnostics' && (
          <Diagnostics telemetry={telemetry} dtState={dtState} />
        )}
        {activeTab === 'replay_arch' && (
          <MissionReplayAndArchitecture
            telemetry={telemetry}
            dtState={dtState}
            liveHistory={history}
          />
        )}
      </main>
    </div>
  );
}

function NavTab({
  active,
  onClick,
  icon,
  label,
}: {
  active: boolean;
  onClick: () => void;
  icon: React.ReactNode;
  label: string;
}) {
  return (
    <button
      onClick={onClick}
      className={clsx(
        'flex items-center gap-2 px-3 py-1.5 rounded-md text-xs font-medium transition-colors whitespace-nowrap',
        active
          ? 'bg-emerald-600 text-white shadow-sm'
          : 'text-slate-400 hover:text-slate-200 hover:bg-slate-800/60'
      )}
    >
      {icon}
      <span>{label}</span>
    </button>
  );
}

// ----------------------------------------------------------------------
// OVERVIEW VIEW COMPONENT
// ----------------------------------------------------------------------
function OverviewView({
  telemetry,
  dtState,
  history,
  onSelectMissionProfile,
}: {
  telemetry: EngineTelemetry;
  dtState: EngineHealthState & { active_alerts: FaultAlert[] };
  history: any[];
  onSelectMissionProfile: (profile: MissionProfileId) => void;
}) {
  const activeProfileObj =
    MISSION_PROFILES.find((p) => p.id === telemetry.mission_profile) ||
    MISSION_PROFILES[0];

  return (
    <div className="grid grid-cols-1 lg:grid-cols-4 gap-4 h-full">
      {/* LEFT COLUMN: Health & Alerts */}
      <div className="flex flex-col gap-4 h-full">
        <div className="bg-[#0D121C] border border-slate-800 rounded-lg p-5 flex flex-col items-center justify-center relative overflow-hidden">
          <div className="absolute top-3 left-3 text-xs font-medium text-slate-500 uppercase tracking-widest">
            Overall Health
          </div>

          <div className="mt-4 flex flex-col items-center">
            <span
              className={clsx(
                'text-6xl font-light tracking-tighter tabular-nums',
                dtState.overall_health > 85
                  ? 'text-emerald-400'
                  : dtState.overall_health > 60
                  ? 'text-amber-400'
                  : 'text-rose-500'
              )}
            >
              {dtState.overall_health.toFixed(1)}
              <span className="text-3xl text-slate-500">%</span>
            </span>

            <div className="mt-4 flex gap-8 w-full justify-between text-sm px-4">
              <div className="text-center">
                <p className="text-slate-500 text-xs">RUL (EST)</p>
                <p className="text-slate-300 font-mono tabular-nums">
                  {dtState.rul_estimated_hours.toFixed(0)} hrs
                </p>
              </div>
              <div className="text-center">
                <p className="text-slate-500 text-xs">DEGRADATION</p>
                <p className="text-slate-300 font-mono tabular-nums">
                  {(dtState.degradation * 100).toFixed(4)}%
                </p>
              </div>
            </div>
          </div>
        </div>

        <div className="bg-[#0D121C] border border-slate-800 rounded-lg p-4">
          <h3 className="text-xs font-medium text-slate-500 uppercase tracking-widest mb-4">
            Subsystem Health
          </h3>
          <div className="flex flex-col gap-4">
            <HealthBar
              label="Combustion"
              value={dtState.subsystem_health.combustion}
              icon={<Flame className="w-4 h-4" />}
            />
            <HealthBar
              label="Thermal"
              value={dtState.subsystem_health.thermal}
              icon={<Wind className="w-4 h-4" />}
            />
            <HealthBar
              label="Lubrication"
              value={dtState.subsystem_health.lubrication}
              icon={<Droplet className="w-4 h-4" />}
            />
            <HealthBar
              label="Mechanical"
              value={dtState.subsystem_health.mechanical}
              icon={<Settings className="w-4 h-4" />}
            />
          </div>
        </div>

        <div className="bg-[#0D121C] border border-slate-800 rounded-lg p-4 flex-1 min-h-[200px] overflow-y-auto">
          <h3 className="text-xs font-medium text-slate-500 uppercase tracking-widest mb-4 flex justify-between">
            Active Alerts
            <span className="text-slate-400 font-mono text-xs">
              {dtState.active_alerts.length} active
            </span>
          </h3>
          {dtState.active_alerts.length === 0 ? (
            <div className="flex flex-col items-center justify-center h-24 text-slate-500 gap-2">
              <CheckCircle className="w-6 h-6 text-emerald-500/50" />
              <p className="text-sm">No active anomalies</p>
            </div>
          ) : (
            <div className="flex flex-col gap-2">
              {dtState.active_alerts.map((alert, i) => (
                <div
                  key={i}
                  className={clsx(
                    'p-3 rounded border text-sm',
                    alert.severity === 'CRITICAL'
                      ? 'bg-rose-950/30 border-rose-900/50'
                      : alert.severity === 'WARNING'
                      ? 'bg-orange-950/30 border-orange-900/50'
                      : 'bg-amber-950/30 border-amber-900/50'
                  )}
                >
                  <div className="flex items-start gap-2">
                    <AlertTriangle
                      className={clsx(
                        'w-4 h-4 mt-0.5 shrink-0',
                        alert.severity === 'CRITICAL'
                          ? 'text-rose-500'
                          : alert.severity === 'WARNING'
                          ? 'text-orange-500'
                          : 'text-amber-500'
                      )}
                    />
                    <div>
                      <p
                        className={clsx(
                          'font-medium',
                          alert.severity === 'CRITICAL'
                            ? 'text-rose-400'
                            : alert.severity === 'WARNING'
                            ? 'text-orange-400'
                            : 'text-amber-400'
                        )}
                      >
                        {alert.fault}
                      </p>
                      <p className="text-xs text-slate-400 mt-1">
                        {alert.probable_cause}
                      </p>
                      <div className="mt-2 flex items-center justify-between text-xs">
                        <span className="text-slate-500 font-mono">
                          CONF: {(alert.confidence * 100).toFixed(0)}%
                        </span>
                      </div>
                    </div>
                  </div>
                </div>
              ))}
            </div>
          )}
        </div>
      </div>

      {/* RIGHT COLUMN: Mission Control & Telemetry */}
      <div className="lg:col-span-3 flex flex-col gap-4 overflow-y-auto pr-1">
        {/* MISSION CONTROL & ENVIRONMENTAL SCENARIO BAR */}
        <div className="bg-[#0D121C] border border-slate-800 rounded-lg p-4 flex flex-col gap-3 shrink-0">
          <div className="flex flex-wrap items-center justify-between gap-4">
            <div className="flex items-center gap-3">
              <DrdoLogo size="sm" showText={true} className="pr-2 border-r border-slate-800" />
              <div className="p-2 rounded bg-emerald-500/10 border border-emerald-500/30 text-emerald-400">
                <Compass className="w-5 h-5" />
              </div>
              <div>
                <label
                  htmlFor="mission-profile-select"
                  className="block text-xs font-medium text-slate-300 uppercase tracking-widest"
                >
                  DRDO Mission Control & Environmental Scenario
                </label>
                <p className="text-xs text-slate-400 mt-0.5">
                  {activeProfileObj.summary}
                </p>
              </div>
            </div>

            <div className="flex items-center gap-3">
              <select
                id="mission-profile-select"
                value={telemetry.mission_profile || 'standard_isr'}
                onChange={(e) =>
                  onSelectMissionProfile(e.target.value as MissionProfileId)
                }
                className="bg-slate-950 border border-slate-700 hover:border-emerald-500/60 focus:border-emerald-400 text-slate-100 text-xs font-medium rounded-md px-3 py-2 outline-none transition-colors cursor-pointer min-w-[290px]"
              >
                {MISSION_PROFILES.map((profile) => (
                  <option key={profile.id} value={profile.id}>
                    {profile.label}
                  </option>
                ))}
              </select>
            </div>
          </div>

          {/* Live Environmental & Operating Envelope Strip */}
          <div className="grid grid-cols-2 sm:grid-cols-6 gap-2.5 pt-3 border-t border-slate-800/80 text-xs font-mono">
            <div className="bg-slate-950/70 border border-slate-800/80 rounded px-3 py-2 flex items-center justify-between">
              <span className="text-slate-500">ALTITUDE</span>
              <span className="text-cyan-400 font-semibold tabular-nums">
                {telemetry.altitude.toLocaleString()} ft
              </span>
            </div>
            <div className="bg-slate-950/70 border border-slate-800/80 rounded px-3 py-2 flex items-center justify-between">
              <span className="text-slate-500">AMBIENT</span>
              <span
                className={clsx(
                  'font-semibold tabular-nums',
                  telemetry.ambient_temp > 30
                    ? 'text-rose-400'
                    : telemetry.ambient_temp < -30
                    ? 'text-sky-300'
                    : 'text-slate-200'
                )}
              >
                {telemetry.ambient_temp > 0 ? '+' : ''}
                {telemetry.ambient_temp.toFixed(1)} °C
              </span>
            </div>
            <div className="bg-slate-950/70 border border-slate-800/80 rounded px-3 py-2 flex items-center justify-between">
              <span className="text-slate-500">THROTTLE</span>
              <span className="text-amber-400 font-semibold tabular-nums">
                {telemetry.throttle.toFixed(1)} %
              </span>
            </div>
            <div className="bg-slate-950/70 border border-slate-800/80 rounded px-3 py-2 flex items-center justify-between">
              <span className="text-slate-500">INJ TIMING</span>
              <span className="text-cyan-300 font-semibold tabular-nums">
                {(telemetry.injection_timing_deg || 15.1).toFixed(1)}° BTDC
              </span>
            </div>
            <div className="bg-slate-950/70 border border-slate-800/80 rounded px-3 py-2 flex items-center justify-between">
              <span className="text-slate-500">OIL TEMP</span>
              <span
                className={clsx(
                  'font-semibold tabular-nums',
                  telemetry.oil_temp > 110 ? 'text-amber-400' : 'text-slate-200'
                )}
              >
                {telemetry.oil_temp.toFixed(1)} °C
              </span>
            </div>
            <div className="bg-slate-950/70 border border-slate-800/80 rounded px-3 py-2 flex items-center justify-between">
              <span className="text-slate-500">BUS VOLT</span>
              <span className="text-emerald-400 font-semibold tabular-nums">
                {telemetry.battery_voltage.toFixed(2)} V
              </span>
            </div>
          </div>
        </div>

        <div className="grid grid-cols-2 lg:grid-cols-5 gap-4 shrink-0">
          <MetricCard
            label="RPM"
            value={telemetry.rpm.toFixed(0)}
            unit="rpm"
            icon={<Gauge className="w-4 h-4" />}
          />
          <MetricCard
            label="EGT"
            value={telemetry.egt.toFixed(1)}
            unit="°C"
            icon={<Flame className="w-4 h-4" />}
          />
          <MetricCard
            label="CHT"
            value={telemetry.cht.toFixed(1)}
            unit="°C"
            icon={<Wind className="w-4 h-4" />}
          />
          <MetricCard
            label="Oil Press"
            value={telemetry.oil_pressure.toFixed(2)}
            unit="bar"
            icon={<Droplet className="w-4 h-4" />}
          />
          <MetricCard
            label="Fuel Flow"
            value={telemetry.fuel_flow.toFixed(1)}
            unit="L/h"
            icon={<Activity className="w-4 h-4" />}
          />
        </div>

        <div className="grid grid-cols-1 lg:grid-cols-2 gap-4">
          <ChartCard
            title="RPM & Fuel Flow"
            data={history}
            lines={[
              { dataKey: 'rpm', color: '#38bdf8', yAxisId: 'left' },
              { dataKey: 'fuel_flow', color: '#fbbf24', yAxisId: 'right' },
            ]}
          />
          <ChartCard
            title="Exhaust & Cylinder Temp"
            data={history}
            lines={[
              { dataKey: 'egt', color: '#f87171', yAxisId: 'left' },
              { dataKey: 'cht', color: '#a78bfa', yAxisId: 'right' },
            ]}
          />
          <ChartCard
            title="Oil Pressure & Temp"
            data={history}
            lines={[
              { dataKey: 'oil_pressure', color: '#34d399', yAxisId: 'left' },
              { dataKey: 'oil_temp', color: '#f472b6', yAxisId: 'right' },
            ]}
          />
          <ChartCard
            title="Vibration Signature"
            data={history}
            lines={[{ dataKey: 'vibration', color: '#c084fc', yAxisId: 'left' }]}
          />
        </div>
      </div>
    </div>
  );
}

function HealthBar({
  label,
  value,
  icon,
}: {
  label: string;
  value: number;
  icon: React.ReactNode;
}) {
  return (
    <div>
      <div className="flex items-center justify-between text-xs mb-1">
        <div className="flex items-center gap-1.5 text-slate-400">
          {icon}
          <span>{label}</span>
        </div>
        <span className="font-mono text-slate-300 tabular-nums">
          {value.toFixed(1)}%
        </span>
      </div>
      <div className="h-1.5 w-full bg-slate-800 rounded-full overflow-hidden">
        <div
          className={clsx(
            'h-full transition-all duration-500',
            value > 85
              ? 'bg-emerald-500'
              : value > 60
              ? 'bg-amber-500'
              : 'bg-rose-500'
          )}
          style={{ width: `${value}%` }}
        />
      </div>
    </div>
  );
}

function MetricCard({
  label,
  value,
  unit,
  icon,
}: {
  label: string;
  value: string;
  unit: string;
  icon: React.ReactNode;
}) {
  return (
    <div className="bg-[#0D121C] border border-slate-800 rounded-lg p-3 flex flex-col justify-between">
      <div className="flex items-center gap-1.5 text-slate-500 text-xs uppercase font-medium tracking-widest mb-2">
        {icon}
        {label}
      </div>
      <div className="flex items-baseline gap-1">
        <span className="text-2xl font-light text-slate-100 font-mono tracking-tight tabular-nums">
          {value}
        </span>
        <span className="text-xs text-slate-500 font-medium">{unit}</span>
      </div>
    </div>
  );
}

function ChartCard({
  title,
  data,
  lines,
}: {
  title: string;
  data: any[];
  lines: { dataKey: string; color: string; yAxisId: string }[];
}) {
  return (
    <div className="bg-[#0D121C] border border-slate-800 rounded-lg p-4 flex flex-col h-64">
      <h3 className="text-xs font-medium text-slate-500 uppercase tracking-widest mb-4">
        {title}
      </h3>
      <div className="flex-1 w-full h-full min-h-0">
        <ResponsiveContainer width="100%" height="100%">
          <LineChart
            data={data}
            margin={{ top: 5, right: 0, left: 0, bottom: 0 }}
          >
            <CartesianGrid
              strokeDasharray="3 3"
              stroke="#1e293b"
              vertical={false}
            />
            <XAxis
              dataKey="time"
              stroke="#475569"
              fontSize={10}
              tickMargin={8}
            />
            <YAxis
              yAxisId="left"
              stroke="#475569"
              fontSize={10}
              domain={['auto', 'auto']}
              width={40}
            />
            {lines.some((l) => l.yAxisId === 'right') && (
              <YAxis
                yAxisId="right"
                orientation="right"
                stroke="#475569"
                fontSize={10}
                domain={['auto', 'auto']}
                width={40}
              />
            )}
            <Tooltip
              contentStyle={{
                backgroundColor: '#0f172a',
                border: '1px solid #1e293b',
                fontSize: '12px',
              }}
              itemStyle={{ color: '#f8fafc' }}
            />
            {lines.map((line, i) => (
              <Line
                key={i}
                yAxisId={line.yAxisId}
                type="monotone"
                dataKey={line.dataKey}
                stroke={line.color}
                strokeWidth={1.5}
                dot={false}
                isAnimationActive={false}
              />
            ))}
          </LineChart>
        </ResponsiveContainer>
      </div>
    </div>
  );
}
