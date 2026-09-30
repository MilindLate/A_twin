import React, { useEffect, useMemo, useRef, useState } from 'react';
import { Canvas, ThreeEvent, useFrame, useThree } from '@react-three/fiber';
import { OrbitControls, Html, Line } from '@react-three/drei';
import * as THREE from 'three';
import { EngineTelemetry, EngineHealthState, FaultAlert } from '../types';
import {
  Download,
  Pause,
  Play,
  RotateCcw,
  Volume2,
  VolumeX,
  Crosshair,
  Compass,
  Navigation,
  Eye,
  Sliders,
  Maximize2,
  Minimize2,
  MousePointer,
  Target,
  Layers
} from 'lucide-react';
import clsx from 'clsx';
import { DrdoLogo } from './DrdoLogo';

type CameraMode = 1 | 2 | 3 | 4 | 5 | 6 | 7;
type FlightMode = 'waypoints' | 'orbit' | 'cockpit' | 'manual';
export type MissionPhase =
  | 'TAKEOFF'
  | 'CLIMB'
  | 'SURVEY'
  | 'APPROACH'
  | 'LANDING'
  | 'LANDED';

interface SurveyTarget {
  id: string;
  code: string;
  name: string;
  type: 'RADAR' | 'DEPOT' | 'COMMS' | 'CUSTOM';
  position: [number, number, number];
  gridRef: string;
}

// ============================================================================
// DETERMINISTIC TOPOGRAPHIC HEIGHT FUNCTION (FLAT AIRBASE VALLEY + RIDGES)
// ============================================================================
function getTerrainHeight(x: number, z: number): number {
  // Keep the central Runway 09/27, taxiway, and tarmac apron completely flat (y = 0)
  const rx = Math.max(0, Math.abs(x) - 155);
  const rz = Math.max(0, Math.abs(z) - 42);
  const distFromAirbase = Math.sqrt(rx * rx + rz * rz);

  if (distFromAirbase < 8) return 0;

  // Smooth blend factor from flat airbase perimeter to surrounding hills
  const blend = Math.min(1, Math.pow((distFromAirbase - 8) / 85, 1.6));

  // Layered multi-frequency topographic waves for natural ridges and valleys
  const primaryRidge =
    Math.sin(x * 0.014) * Math.cos(z * 0.014) * 22 +
    Math.sin(x * 0.007 + 1.2) * Math.sin(z * 0.008 - 0.6) * 32;
  const secondaryDetail =
    Math.cos(x * 0.031 - z * 0.027) * 6.5 +
    Math.sin(x * 0.055 + z * 0.048) * 2.8;

  // Gently raise distant perimeter into a surrounding mountain basin
  const radialDist = Math.sqrt(x * x + z * z);
  const basinRise = Math.max(0, (radialDist - 210) * 0.09);

  const rawHeight = primaryRidge + secondaryDetail + basinRise + 6;
  return Math.max(0, rawHeight * blend);
}

const INITIAL_SURVEY_TARGETS: SurveyTarget[] = [
  {
    id: 'tgt-alpha',
    code: 'TGT-ALPHA',
    name: 'North Ridge Radar Site',
    type: 'RADAR',
    position: [-75, getTerrainHeight(-75, -105), -105],
    gridRef: '34°12\'N 77°34\'E',
  },
  {
    id: 'tgt-bravo',
    code: 'TGT-BRAVO',
    name: 'East Valley Fuel Depot',
    type: 'DEPOT',
    position: [95, getTerrainHeight(95, -78), -78],
    gridRef: '34°14\'N 77°39\'E',
  },
  {
    id: 'tgt-charlie',
    code: 'TGT-CHARLIE',
    name: 'South Comms Outpost',
    type: 'COMMS',
    position: [25, getTerrainHeight(25, 95), 95],
    gridRef: '34°09\'N 77°36\'E',
  },
];

interface PhysicalFault {
  id: string;
  label: string;
  backendFault: string;
  severity: number;
  chtDelta: number;
  egtDelta: number;
  oilTempDelta: number;
  mapDelta: number;
  rpmDelta: number;
  oilPressDelta: number;
  vibDelta: number;
  lambdaDelta: number;
  busVoltDelta: number;
}

const PHYSICAL_FAULTS: PhysicalFault[] = [
  {
    id: 'wastegate',
    label: 'Wastegate',
    backendFault: 'overheating',
    severity: 0.7,
    chtDelta: 28,
    egtDelta: 65,
    oilTempDelta: 14,
    mapDelta: -8.5,
    rpmDelta: -210,
    oilPressDelta: -12,
    vibDelta: 0.018,
    lambdaDelta: 0.06,
    busVoltDelta: -0.1,
  },
  {
    id: 'oil_starve',
    label: 'Oil Starve',
    backendFault: 'lubrication_failure',
    severity: 0.85,
    chtDelta: 34,
    egtDelta: 18,
    oilTempDelta: 38,
    mapDelta: -1.2,
    rpmDelta: -180,
    oilPressDelta: -165,
    vibDelta: 0.042,
    lambdaDelta: 0.01,
    busVoltDelta: -0.2,
  },
  {
    id: 'lean_burn',
    label: 'Lean Burn',
    backendFault: 'injector_degradation',
    severity: 0.75,
    chtDelta: 42,
    egtDelta: 92,
    oilTempDelta: 19,
    mapDelta: -2.0,
    rpmDelta: -140,
    oilPressDelta: -15,
    vibDelta: 0.022,
    lambdaDelta: 0.145,
    busVoltDelta: 0,
  },
  {
    id: 'ring_wear',
    label: 'Ring Wear',
    backendFault: 'misfire',
    severity: 0.65,
    chtDelta: 15,
    egtDelta: -45,
    oilTempDelta: 22,
    mapDelta: -5.4,
    rpmDelta: -320,
    oilPressDelta: -48,
    vibDelta: 0.055,
    lambdaDelta: -0.08,
    busVoltDelta: -0.3,
  },
  {
    id: 'pre_ignition',
    label: 'Pre-Ignition',
    backendFault: 'misfire',
    severity: 0.9,
    chtDelta: 54,
    egtDelta: -60,
    oilTempDelta: 25,
    mapDelta: -4.8,
    rpmDelta: -410,
    oilPressDelta: -25,
    vibDelta: 0.078,
    lambdaDelta: -0.05,
    busVoltDelta: -0.4,
  },
  {
    id: 'bearing_wear',
    label: 'Bearing Wear',
    backendFault: 'lubrication_failure',
    severity: 0.7,
    chtDelta: 22,
    egtDelta: 10,
    oilTempDelta: 31,
    mapDelta: -1.0,
    rpmDelta: -190,
    oilPressDelta: -95,
    vibDelta: 0.068,
    lambdaDelta: 0.0,
    busVoltDelta: -0.15,
  },
  {
    id: 'bus_brownout',
    label: 'Bus Brownout',
    backendFault: 'injector_degradation',
    severity: 0.5,
    chtDelta: -8,
    egtDelta: -35,
    oilTempDelta: -4,
    mapDelta: -3.2,
    rpmDelta: -260,
    oilPressDelta: -10,
    vibDelta: 0.025,
    lambdaDelta: -0.04,
    busVoltDelta: -4.85,
  },
  {
    id: 'coolant_loss',
    label: 'Coolant Loss',
    backendFault: 'overheating',
    severity: 0.95,
    chtDelta: 68,
    egtDelta: 48,
    oilTempDelta: 35,
    mapDelta: -2.5,
    rpmDelta: -150,
    oilPressDelta: -38,
    vibDelta: 0.031,
    lambdaDelta: 0.03,
    busVoltDelta: -0.1,
  },
];

// ============================================================================
// INTERACTIVE 3D TAPAS-BH-201 MALE UAV MODEL (CLICKABLE SUBSYSTEMS)
// ============================================================================
function TapasUAVModel({
  uavRef,
  portThrottle,
  stbdThrottle,
  gearDown,
  portHeat,
  stbdHeat,
  paused,
  isSurveying,
  touchdownSmoke,
  selectedEngine,
  show3dLabels,
  onSelectEngine,
  onOpenEngineLab,
  onToggleFlir,
  onToggleGear,
}: {
  uavRef: React.RefObject<THREE.Group | null>;
  portThrottle: number;
  stbdThrottle: number;
  gearDown: boolean;
  portHeat: number;
  stbdHeat: number;
  paused: boolean;
  isSurveying: boolean;
  touchdownSmoke: boolean;
  selectedEngine: 'port' | 'stbd';
  show3dLabels: boolean;
  onSelectEngine: (eng: 'port' | 'stbd') => void;
  onOpenEngineLab?: () => void;
  onToggleFlir: () => void;
  onToggleGear: () => void;
}) {
  const portPropRef = useRef<THREE.Group>(null);
  const stbdPropRef = useRef<THREE.Group>(null);
  const noseGearRef = useRef<THREE.Group>(null);
  const mainGearRef = useRef<THREE.Group>(null);
  const scanConeRef = useRef<THREE.Mesh>(null);
  const [hoveredPart, setHoveredPart] = useState<string | null>(null);

  useEffect(() => {
    document.body.style.cursor = hoveredPart ? 'pointer' : 'auto';
    return () => {
      document.body.style.cursor = 'auto';
    };
  }, [hoveredPart]);

  useFrame((state, delta) => {
    if (!paused) {
      if (portPropRef.current) {
        portPropRef.current.rotation.z += delta * (12 + (portThrottle / 100) * 32);
      }
      if (stbdPropRef.current) {
        stbdPropRef.current.rotation.z -= delta * (12 + (stbdThrottle / 100) * 32);
      }
    }

    const targetGearScale = gearDown ? 1 : 0.04;
    if (noseGearRef.current && mainGearRef.current) {
      noseGearRef.current.scale.y = THREE.MathUtils.lerp(
        noseGearRef.current.scale.y,
        targetGearScale,
        delta * 5
      );
      mainGearRef.current.scale.y = THREE.MathUtils.lerp(
        mainGearRef.current.scale.y,
        targetGearScale,
        delta * 5
      );
    }

    if (scanConeRef.current && isSurveying) {
      scanConeRef.current.rotation.y = state.clock.elapsedTime * 1.8;
    }
  });

  const portNacelleColor = useMemo(() => {
    const c = new THREE.Color('#f1f5f9');
    if (portHeat > 0.3)
      c.lerp(new THREE.Color('#ef4444'), Math.min(1, (portHeat - 0.3) * 1.4));
    return c;
  }, [portHeat]);

  const stbdNacelleColor = useMemo(() => {
    const c = new THREE.Color('#f1f5f9');
    if (stbdHeat > 0.3)
      c.lerp(new THREE.Color('#ef4444'), Math.min(1, (stbdHeat - 0.3) * 1.4));
    return c;
  }, [stbdHeat]);

  return (
    <group ref={uavRef} position={[-110, 1.45, 0]}>
      {/* Main Fuselage */}
      <mesh castShadow receiveShadow rotation={[Math.PI / 2, 0, 0]}>
        <capsuleGeometry args={[0.72, 7.2, 16, 24]} />
        <meshStandardMaterial color="#f8fafc" roughness={0.28} metalness={0.18} />
      </mesh>

      {/* SATCOM Nose Radome */}
      <mesh position={[0, 0.48, 1.8]} rotation={[Math.PI / 2, 0, 0]} castShadow>
        <capsuleGeometry args={[0.52, 2.2, 12, 16]} />
        <meshStandardMaterial color="#ffffff" roughness={0.22} metalness={0.12} />
      </mesh>

      {/* Interactive Under-Chin EO/IR FLIR Sensor Turret Gimbal */}
      <group
        position={[0, -0.82, 2.4]}
        onClick={(e) => {
          e.stopPropagation();
          onToggleFlir();
        }}
        onPointerOver={(e) => {
          e.stopPropagation();
          setHoveredPart('FLIR EO/IR TURRET');
        }}
        onPointerOut={() => setHoveredPart(null)}
      >
        <mesh castShadow>
          <cylinderGeometry args={[0.28, 0.32, 0.35, 16]} />
          <meshStandardMaterial color="#334155" roughness={0.4} metalness={0.6} />
        </mesh>
        <mesh position={[0, -0.22, 0]} castShadow>
          <sphereGeometry args={[0.32, 16, 16]} />
          <meshStandardMaterial
            color={hoveredPart === 'FLIR EO/IR TURRET' ? '#10b981' : '#1e293b'}
            roughness={0.2}
            metalness={0.8}
          />
        </mesh>
        <mesh position={[0, -0.26, 0.24]}>
          <sphereGeometry args={[0.11, 12, 12]} />
          <meshStandardMaterial
            color="#10b981"
            emissive="#10b981"
            emissiveIntensity={isSurveying ? 1.6 : 0.6}
          />
        </mesh>

        {isSurveying && (
          <mesh ref={scanConeRef} position={[0, -19, 0]}>
            <coneGeometry args={[12, 38, 24, 1, true]} />
            <meshBasicMaterial
              color="#10b981"
              transparent
              opacity={0.14}
              side={THREE.DoubleSide}
            />
          </mesh>
        )}
      </group>

      {/* Main High-Aspect Wing */}
      <mesh position={[0, 0.35, 0.2]} castShadow receiveShadow>
        <boxGeometry args={[21.5, 0.16, 1.35]} />
        <meshStandardMaterial color="#f8fafc" roughness={0.3} metalness={0.15} />
      </mesh>

      {/* Orange Wingtips & Winglets */}
      <mesh position={[-11.0, 0.35, 0.2]} castShadow>
        <boxGeometry args={[0.9, 0.17, 1.1]} />
        <meshStandardMaterial color="#f97316" roughness={0.4} />
      </mesh>
      <mesh position={[-11.4, 0.78, 0.1]} rotation={[0, 0, -0.28]} castShadow>
        <boxGeometry args={[0.14, 0.95, 0.85]} />
        <meshStandardMaterial color="#f97316" roughness={0.4} />
      </mesh>
      <mesh position={[11.0, 0.35, 0.2]} castShadow>
        <boxGeometry args={[0.9, 0.17, 1.1]} />
        <meshStandardMaterial color="#f97316" roughness={0.4} />
      </mesh>
      <mesh position={[11.4, 0.78, 0.1]} rotation={[0, 0, 0.28]} castShadow>
        <boxGeometry args={[0.14, 0.95, 0.85]} />
        <meshStandardMaterial color="#f97316" roughness={0.4} />
      </mesh>

      {/* ========================================================= */}
      {/* CLICKABLE PORT ENGINE NACELLE (LEFT WING)                 */}
      {/* ========================================================= */}
      <group
        position={[-3.6, 0.25, 0.65]}
        onClick={(e) => {
          e.stopPropagation();
          onSelectEngine('port');
        }}
        onDoubleClick={(e) => {
          e.stopPropagation();
          onSelectEngine('port');
          onOpenEngineLab?.();
        }}
        onPointerOver={(e) => {
          e.stopPropagation();
          setHoveredPart('PORT ROTAX 914');
        }}
        onPointerOut={() => setHoveredPart(null)}
      >
        <mesh rotation={[Math.PI / 2, 0, 0]} castShadow>
          <cylinderGeometry args={[0.46, 0.38, 2.2, 16]} />
          <meshStandardMaterial
            color={portNacelleColor}
            emissive={
              selectedEngine === 'port' || hoveredPart === 'PORT ROTAX 914'
                ? '#0ea5e9'
                : '#000000'
            }
            emissiveIntensity={selectedEngine === 'port' ? 0.25 : 0}
            roughness={0.35}
            metalness={0.25}
          />
        </mesh>
        <mesh position={[0, 0, 1.25]} rotation={[Math.PI / 2, 0, 0]}>
          <coneGeometry args={[0.32, 0.45, 16]} />
          <meshStandardMaterial color="#f97316" roughness={0.3} />
        </mesh>
        <mesh position={[0, 0, 1.32]}>
          <circleGeometry args={[1.35, 24]} />
          <meshBasicMaterial
            color="#cbd5e1"
            transparent
            opacity={portThrottle > 35 ? 0.24 : 0.08}
            side={THREE.DoubleSide}
          />
        </mesh>
        <group ref={portPropRef} position={[0, 0, 1.33]}>
          {[0, 120, 240].map((deg) => (
            <mesh key={deg} rotation={[0, 0, (deg * Math.PI) / 180]}>
              <boxGeometry args={[0.14, 2.6, 0.04]} />
              <meshStandardMaterial color="#1e293b" metalness={0.5} roughness={0.4} />
            </mesh>
          ))}
        </group>

        {show3dLabels && (
          <Html position={[0, 1.35, 0]} center distanceFactor={28}>
            <div className="flex items-center gap-1">
              <button
                onClick={() => onSelectEngine('port')}
                className={clsx(
                  'px-2 py-0.5 rounded text-[10px] font-mono whitespace-nowrap border transition-all shadow-lg',
                  selectedEngine === 'port'
                    ? 'bg-cyan-950/90 border-cyan-400 text-cyan-200 font-semibold'
                    : 'bg-slate-950/80 border-slate-700 text-slate-300 hover:border-cyan-400'
                )}
              >
                PORT ENG · {portThrottle}%
              </button>
              {onOpenEngineLab && (
                <button
                  onClick={(e) => {
                    e.stopPropagation();
                    onSelectEngine('port');
                    onOpenEngineLab();
                  }}
                  className="px-1.5 py-0.5 rounded text-[9px] font-mono bg-emerald-600 hover:bg-emerald-500 text-white font-bold shadow-lg whitespace-nowrap"
                  title="Open 3D Engine CAD Lab"
                >
                  3D CAD ↗
                </button>
              )}
            </div>
          </Html>
        )}
      </group>

      {/* ========================================================= */}
      {/* CLICKABLE STARBOARD ENGINE NACELLE (RIGHT WING)           */}
      {/* ========================================================= */}
      <group
        position={[3.6, 0.25, 0.65]}
        onClick={(e) => {
          e.stopPropagation();
          onSelectEngine('stbd');
        }}
        onDoubleClick={(e) => {
          e.stopPropagation();
          onSelectEngine('stbd');
          onOpenEngineLab?.();
        }}
        onPointerOver={(e) => {
          e.stopPropagation();
          setHoveredPart('STBD ROTAX 914');
        }}
        onPointerOut={() => setHoveredPart(null)}
      >
        <mesh rotation={[Math.PI / 2, 0, 0]} castShadow>
          <cylinderGeometry args={[0.46, 0.38, 2.2, 16]} />
          <meshStandardMaterial
            color={stbdNacelleColor}
            emissive={
              selectedEngine === 'stbd' || hoveredPart === 'STBD ROTAX 914'
                ? '#0ea5e9'
                : '#000000'
            }
            emissiveIntensity={selectedEngine === 'stbd' ? 0.25 : 0}
            roughness={0.35}
            metalness={0.25}
          />
        </mesh>
        <mesh position={[0, 0, 1.25]} rotation={[Math.PI / 2, 0, 0]}>
          <coneGeometry args={[0.32, 0.45, 16]} />
          <meshStandardMaterial color="#f97316" roughness={0.3} />
        </mesh>
        <mesh position={[0, 0, 1.32]}>
          <circleGeometry args={[1.35, 24]} />
          <meshBasicMaterial
            color="#cbd5e1"
            transparent
            opacity={stbdThrottle > 35 ? 0.24 : 0.08}
            side={THREE.DoubleSide}
          />
        </mesh>
        <group ref={stbdPropRef} position={[0, 0, 1.33]}>
          {[0, 120, 240].map((deg) => (
            <mesh key={deg} rotation={[0, 0, (deg * Math.PI) / 180]}>
              <boxGeometry args={[0.14, 2.6, 0.04]} />
              <meshStandardMaterial color="#1e293b" metalness={0.5} roughness={0.4} />
            </mesh>
          ))}
        </group>

        {show3dLabels && (
          <Html position={[0, 1.35, 0]} center distanceFactor={28}>
            <div className="flex items-center gap-1">
              <button
                onClick={() => onSelectEngine('stbd')}
                className={clsx(
                  'px-2 py-0.5 rounded text-[10px] font-mono whitespace-nowrap border transition-all shadow-lg',
                  selectedEngine === 'stbd'
                    ? 'bg-cyan-950/90 border-cyan-400 text-cyan-200 font-semibold'
                    : 'bg-slate-950/80 border-slate-700 text-slate-300 hover:border-cyan-400'
                )}
              >
                STBD ENG · {stbdThrottle}%
              </button>
              {onOpenEngineLab && (
                <button
                  onClick={(e) => {
                    e.stopPropagation();
                    onSelectEngine('stbd');
                    onOpenEngineLab();
                  }}
                  className="px-1.5 py-0.5 rounded text-[9px] font-mono bg-emerald-600 hover:bg-emerald-500 text-white font-bold shadow-lg whitespace-nowrap"
                  title="Open 3D Engine CAD Lab"
                >
                  3D CAD ↗
                </button>
              )}
            </div>
          </Html>
        )}
      </group>

      {/* T-TAIL EMPENNAGE & NAVIGATION STROBES */}
      <group position={[0, 0.2, -3.7]}>
        <mesh position={[0, 1.25, 0]} rotation={[0.22, 0, 0]} castShadow>
          <boxGeometry args={[0.16, 2.5, 1.1]} />
          <meshStandardMaterial color="#f8fafc" roughness={0.3} />
        </mesh>
        <mesh position={[0, 2.45, -0.25]} castShadow>
          <boxGeometry args={[0.18, 0.35, 1.05]} />
          <meshStandardMaterial color="#f97316" roughness={0.4} />
        </mesh>
        <mesh position={[0, 2.55, -0.3]} castShadow>
          <boxGeometry args={[5.8, 0.12, 0.85]} />
          <meshStandardMaterial color="#f8fafc" roughness={0.3} />
        </mesh>
        <mesh position={[-2.95, 2.55, -0.3]}>
          <boxGeometry args={[0.45, 0.13, 0.85]} />
          <meshStandardMaterial color="#f97316" />
        </mesh>
        <mesh position={[2.95, 2.55, -0.3]}>
          <boxGeometry args={[0.45, 0.13, 0.85]} />
          <meshStandardMaterial color="#f97316" />
        </mesh>
        {/* Tail White Strobe Beacon */}
        <mesh position={[0, 2.68, -0.75]}>
          <sphereGeometry args={[0.1, 10, 10]} />
          <meshBasicMaterial color="#ffffff" />
        </mesh>
      </group>

      {/* WINGTIP NAVIGATION LIGHTS (PORT RED / STARBOARD GREEN) & DORSAL BEACON */}
      <mesh position={[-11.55, 0.95, 0.1]}>
        <sphereGeometry args={[0.12, 10, 10]} />
        <meshBasicMaterial color="#ef4444" />
      </mesh>
      <mesh position={[11.55, 0.95, 0.1]}>
        <sphereGeometry args={[0.12, 10, 10]} />
        <meshBasicMaterial color="#10b981" />
      </mesh>
      <mesh position={[0, 0.82, -0.8]}>
        <sphereGeometry args={[0.11, 10, 10]} />
        <meshBasicMaterial color="#ef4444" />
      </mesh>
      {/* Dorsal C-Band Line-of-Sight Telemetry Blade Antenna */}
      <mesh position={[0, 0.92, -1.6]} rotation={[-0.25, 0, 0]}>
        <boxGeometry args={[0.05, 0.48, 0.28]} />
        <meshStandardMaterial color="#f97316" roughness={0.3} />
      </mesh>

      {/* CLICKABLE RETRACTABLE LANDING GEAR */}
      <group
        ref={noseGearRef}
        position={[0, -0.65, 2.9]}
        onClick={(e) => {
          e.stopPropagation();
          onToggleGear();
        }}
      >
        <mesh position={[0, -0.55, 0]}>
          <cylinderGeometry args={[0.06, 0.06, 1.1, 8]} />
          <meshStandardMaterial color="#475569" metalness={0.8} />
        </mesh>
        <mesh position={[0, -1.1, 0]} rotation={[0, 0, Math.PI / 2]}>
          <cylinderGeometry args={[0.24, 0.24, 0.16, 16]} />
          <meshStandardMaterial color="#0f172a" roughness={0.9} />
        </mesh>
      </group>

      <group
        ref={mainGearRef}
        position={[0, -0.55, -0.2]}
        onClick={(e) => {
          e.stopPropagation();
          onToggleGear();
        }}
      >
        <mesh position={[-1.35, -0.6, 0]} rotation={[0, 0, 0.35]}>
          <cylinderGeometry args={[0.07, 0.07, 1.35, 8]} />
          <meshStandardMaterial color="#475569" metalness={0.8} />
        </mesh>
        <mesh position={[-1.6, -1.15, 0]} rotation={[0, 0, Math.PI / 2]}>
          <cylinderGeometry args={[0.3, 0.3, 0.2, 16]} />
          <meshStandardMaterial color="#0f172a" roughness={0.9} />
        </mesh>
        <mesh position={[1.35, -0.6, 0]} rotation={[0, 0, -0.35]}>
          <cylinderGeometry args={[0.07, 0.07, 1.35, 8]} />
          <meshStandardMaterial color="#475569" metalness={0.8} />
        </mesh>
        <mesh position={[1.6, -1.15, 0]} rotation={[0, 0, Math.PI / 2]}>
          <cylinderGeometry args={[0.3, 0.3, 0.2, 16]} />
          <meshStandardMaterial color="#0f172a" roughness={0.9} />
        </mesh>

        {touchdownSmoke && (
          <group position={[0, -1.2, -1.2]}>
            <mesh position={[-1.6, 0, 0]}>
              <sphereGeometry args={[0.85, 12, 12]} />
              <meshBasicMaterial color="#e2e8f0" transparent opacity={0.55} />
            </mesh>
            <mesh position={[1.6, 0, 0]}>
              <sphereGeometry args={[0.85, 12, 12]} />
              <meshBasicMaterial color="#e2e8f0" transparent opacity={0.55} />
            </mesh>
          </group>
        )}
      </group>
    </group>
  );
}

// ============================================================================
// INTERACTIVE 3D AIRBASE, TOPOGRAPHIC TERRAIN & SURVEY TARGETS
// ============================================================================
function InteractiveAirbaseAndTerrain({
  flirMode,
  surveyTargets,
  activeTargetId,
  onSelectTarget,
  onTerrainWaypointClick,
  showFlightPath,
  show3dLabels,
  missionPhase,
}: {
  flirMode: boolean;
  surveyTargets: SurveyTarget[];
  activeTargetId: string;
  onSelectTarget: (id: string) => void;
  onTerrainWaypointClick: (point: THREE.Vector3) => void;
  showFlightPath: boolean;
  show3dLabels: boolean;
  missionPhase: MissionPhase;
}) {
  const radarDishRef = useRef<THREE.Group>(null);
  const gcsSatcomRef = useRef<THREE.Group>(null);
  const atcBeaconRef = useRef<THREE.Group>(null);
  const windsockRef = useRef<THREE.Group>(null);
  const targetRingRef = useRef<THREE.Mesh>(null);

  useFrame((state, delta) => {
    if (radarDishRef.current) {
      radarDishRef.current.rotation.y += delta * 1.6;
    }
    if (gcsSatcomRef.current) {
      gcsSatcomRef.current.rotation.y = Math.sin(state.clock.elapsedTime * 0.5) * 0.6;
    }
    if (atcBeaconRef.current) {
      atcBeaconRef.current.rotation.y += delta * 3.5;
    }
    if (windsockRef.current) {
      windsockRef.current.rotation.y =
        0.25 + Math.sin(state.clock.elapsedTime * 2.2) * 0.08;
    }
    if (targetRingRef.current) {
      const s = 1 + Math.sin(state.clock.elapsedTime * 4) * 0.1;
      targetRingRef.current.scale.set(s, s, 1);
    }
  });

  // Procedural continuous topographic heightmap geometry with elevation vertex colors
  const terrainGeometry = useMemo(() => {
    const geo = new THREE.PlaneGeometry(1500, 1500, 150, 150);
    geo.rotateX(-Math.PI / 2);

    const posAttr = geo.attributes.position;
    const colors = new Float32Array(posAttr.count * 3);
    const color = new THREE.Color();

    for (let i = 0; i < posAttr.count; i++) {
      const x = posAttr.getX(i);
      const z = posAttr.getZ(i);
      const y = getTerrainHeight(x, z);
      posAttr.setY(i, y);

      if (flirMode) {
        // Thermal IR false-color terrain palette
        if (y < 1.5) {
          color.set('#0f2917');
        } else if (y < 18) {
          color.set('#163b21').lerp(new THREE.Color('#215430'), (y - 1.5) / 16.5);
        } else if (y < 42) {
          color.set('#215430').lerp(new THREE.Color('#397d4d'), (y - 18) / 24);
        } else {
          color.set('#52a369');
        }
      } else {
        // Natural daylight topographic biome colors (Airfield meadow -> Foothills -> Rocky ridges -> Alpine peaks)
        const microVar = (Math.sin(x * 0.08) * Math.cos(z * 0.08)) * 0.03;
        if (y < 1.0) {
          color.set('#3f7d2a').offsetHSL(0, 0, microVar);
        } else if (y < 15) {
          color
            .set('#3f7d2a')
            .lerp(new THREE.Color('#4f8a33'), (y - 1.0) / 14)
            .offsetHSL(0, 0, microVar);
        } else if (y < 32) {
          color
            .set('#4f8a33')
            .lerp(new THREE.Color('#696d58'), (y - 15) / 17)
            .offsetHSL(0, 0, microVar);
        } else if (y < 52) {
          color
            .set('#696d58')
            .lerp(new THREE.Color('#84827a'), (y - 32) / 20);
        } else {
          color
            .set('#84827a')
            .lerp(new THREE.Color('#e2e8f0'), Math.min(1, (y - 52) / 22));
        }
      }

      colors[i * 3] = color.r;
      colors[i * 3 + 1] = color.g;
      colors[i * 3 + 2] = color.b;
    }

    geo.setAttribute('color', new THREE.BufferAttribute(colors, 3));
    geo.computeVertexNormals();
    return geo;
  }, [flirMode]);

  // Grounded forest trees placed strictly on natural terrain height outside the airbase & targets
  const trees = useMemo(() => {
    const arr: { x: number; y: number; z: number; scale: number; shade: string }[] = [];
    for (let i = 0; i < 240; i++) {
      const angle = (i * 137.508 * Math.PI) / 180;
      const dist = 52 + ((i * 37) % 360);
      const x = Math.cos(angle) * dist;
      const z = Math.sin(angle) * dist;

      // Keep clear of the airbase apron/runway corridor
      if (Math.abs(x) < 178 && Math.abs(z) < 52) continue;

      // Keep clear of survey target pads
      const nearTarget = INITIAL_SURVEY_TARGETS.some(
        (t) => Math.hypot(x - t.position[0], z - t.position[2]) < 20
      );
      if (nearTarget) continue;

      const y = getTerrainHeight(x, z);
      // Avoid placing trees on high rocky snow peaks
      if (y > 34) continue;

      arr.push({
        x,
        y,
        z,
        scale: 0.85 + ((i * 17) % 12) * 0.11,
        shade: i % 2 === 0 ? '#2b591c' : '#346922',
      });
    }
    return arr;
  }, []);

  // High-altitude cumulus clouds well above the flight envelope
  const clouds = useMemo(
    () => [
      { x: -160, y: 118, z: -180, s: 1.6 },
      { x: 185, y: 126, z: -150, s: 1.8 },
      { x: 75, y: 114, z: 195, s: 1.5 },
      { x: -195, y: 122, z: 145, s: 1.7 },
      { x: 240, y: 130, z: 45, s: 1.4 },
      { x: -40, y: 128, z: -260, s: 1.9 },
    ],
    []
  );

  return (
    <group>
      {/* Continuous Vertex-Colored Topographic Terrain (Double-Click to Set Custom Waypoint) */}
      <mesh
        geometry={terrainGeometry}
        receiveShadow
        onDoubleClick={(e: ThreeEvent<MouseEvent>) => {
          e.stopPropagation();
          onTerrainWaypointClick(e.point);
        }}
      >
        <meshStandardMaterial
          vertexColors
          roughness={0.92}
          metalness={0.02}
        />
      </mesh>

      {/* =================================================================== */}
      {/* RUNWAY 09/27, PARALLEL TAXIWAY & FORWARD OPERATING AIRBASE COMPLEX  */}
      {/* =================================================================== */}
      <group position={[0, 0.08, 0]}>
        {/* Graded Airfield Perimeter Pad */}
        <mesh rotation={[-Math.PI / 2, 0, 0]} position={[0, 0, -10]} receiveShadow>
          <planeGeometry args={[320, 72]} />
          <meshStandardMaterial
            color={flirMode ? '#183822' : '#356824'}
            roughness={0.95}
          />
        </mesh>

        {/* Main Runway 09/27 Graded Shoulder */}
        <mesh rotation={[-Math.PI / 2, 0, 0]} position={[0, 0.03, 0]} receiveShadow>
          <planeGeometry args={[296, 25]} />
          <meshStandardMaterial
            color={flirMode ? '#33523d' : '#334155'}
            roughness={0.88}
          />
        </mesh>

        {/* Main Runway 09/27 Asphalt Surface */}
        <mesh rotation={[-Math.PI / 2, 0, 0]} position={[0, 0.07, 0]} receiveShadow>
          <planeGeometry args={[282, 18]} />
          <meshStandardMaterial
            color={flirMode ? '#4d755a' : '#1e293b'}
            roughness={0.78}
          />
        </mesh>

        {/* Runway Centerline Dashed Markings */}
        {Array.from({ length: 19 }).map((_, i) => (
          <mesh
            key={i}
            rotation={[-Math.PI / 2, 0, 0]}
            position={[-117 + i * 13, 0.11, 0]}
          >
            <planeGeometry args={[7.2, 0.42]} />
            <meshBasicMaterial color={flirMode ? '#bbf7d0' : '#f8fafc'} />
          </mesh>
        ))}

        {/* Runway Threshold Piano Keys (West RWY 09 & East RWY 27) */}
        {[-6, -4, -2, 0, 2, 4, 6].map((zOff, i) => (
          <React.Fragment key={i}>
            <mesh rotation={[-Math.PI / 2, 0, 0]} position={[-131, 0.11, zOff]}>
              <planeGeometry args={[7, 0.85]} />
              <meshBasicMaterial color="#f8fafc" />
            </mesh>
            <mesh rotation={[-Math.PI / 2, 0, 0]} position={[131, 0.11, zOff]}>
              <planeGeometry args={[7, 0.85]} />
              <meshBasicMaterial color="#f8fafc" />
            </mesh>
          </React.Fragment>
        ))}

        {/* Touchdown Aiming Point Blocks */}
        {[-5.2, 5.2].map((zOff, idx) => (
          <React.Fragment key={idx}>
            <mesh rotation={[-Math.PI / 2, 0, 0]} position={[-98, 0.11, zOff]}>
              <planeGeometry args={[14, 2.1]} />
              <meshBasicMaterial color="#e2e8f0" />
            </mesh>
            <mesh rotation={[-Math.PI / 2, 0, 0]} position={[98, 0.11, zOff]}>
              <planeGeometry args={[14, 2.1]} />
              <meshBasicMaterial color="#e2e8f0" />
            </mesh>
          </React.Fragment>
        ))}

        {/* Runway Edge Lights + Threshold Green/Red Bars + PAPI Approach Slope Indicators */}
        {Array.from({ length: 16 }).map((_, i) => (
          <React.Fragment key={i}>
            <mesh position={[-135 + i * 18, 0.28, -9.4]}>
              <sphereGeometry args={[0.22, 8, 8]} />
              <meshBasicMaterial color="#fde047" />
            </mesh>
            <mesh position={[-135 + i * 18, 0.28, 9.4]}>
              <sphereGeometry args={[0.22, 8, 8]} />
              <meshBasicMaterial color="#fde047" />
            </mesh>
          </React.Fragment>
        ))}

        {/* PAPI (Precision Approach Path Indicator) 4-Light Array (2 White, 2 Red) */}
        {[-14.5, -13.2, -11.9, -10.6].map((zPos, i) => (
          <mesh key={i} position={[-105, 0.35, zPos]}>
            <boxGeometry args={[0.6, 0.35, 0.6]} />
            <meshBasicMaterial color={i < 2 ? '#ffffff' : '#ef4444'} />
          </mesh>
        ))}

        {/* Parallel Taxiway Alpha & High-Speed Turnoffs */}
        <mesh rotation={[-Math.PI / 2, 0, 0]} position={[0, 0.05, -19]} receiveShadow>
          <planeGeometry args={[240, 7.5]} />
          <meshStandardMaterial
            color={flirMode ? '#3b5e46' : '#334155'}
            roughness={0.85}
          />
        </mesh>
        <mesh rotation={[-Math.PI / 2, 0, 0]} position={[0, 0.08, -19]}>
          <planeGeometry args={[234, 0.25]} />
          <meshBasicMaterial color="#facc15" />
        </mesh>

        {/* 3 Taxiway Turnoffs connecting Runway to Parallel Taxiway */}
        {[-85, 0, 85].map((tx, idx) => (
          <mesh
            key={idx}
            rotation={[-Math.PI / 2, 0, 0.35]}
            position={[tx, 0.055, -10]}
            receiveShadow
          >
            <planeGeometry args={[7, 15]} />
            <meshStandardMaterial color="#334155" roughness={0.85} />
          </mesh>
        ))}

        {/* Main Tarmac Apron */}
        <mesh
          rotation={[-Math.PI / 2, 0, 0]}
          position={[-38, 0.05, -31]}
          receiveShadow
        >
          <planeGeometry args={[118, 20]} />
          <meshStandardMaterial
            color={flirMode ? '#3a5944' : '#334155'}
            roughness={0.85}
          />
        </mesh>

        {/* Hangar 1 & Hangar 2 (Arched Roof Military UAV Maintenance Bays) */}
        {[-72, -44].map((hx, idx) => (
          <group key={idx} position={[hx, 0, -33]}>
            <mesh position={[0, 3.0, 0]} castShadow receiveShadow>
              <boxGeometry args={[18, 6.0, 13]} />
              <meshStandardMaterial color="#cbd5e1" roughness={0.45} metalness={0.25} />
            </mesh>
            {/* Arched Roof Vault */}
            <mesh
              position={[0, 6.0, 0]}
              rotation={[Math.PI / 2, 0, 0]}
              scale={[1, 0.35, 1]}
              castShadow
            >
              <cylinderGeometry args={[9, 9, 13.2, 16]} />
              <meshStandardMaterial color="#64748b" roughness={0.5} metalness={0.4} />
            </mesh>
            {/* Open Hangar Door Bay */}
            <mesh position={[0, 2.4, 6.55]}>
              <planeGeometry args={[13.5, 4.8]} />
              <meshBasicMaterial color="#0f172a" />
            </mesh>
          </group>
        ))}

        {/* DRDO / ADE Mobile Ground Control Station (GCS) Shelter & Telemetry Dish */}
        <group position={[-18, 0, -32]}>
          <mesh position={[0, 1.8, 0]} castShadow receiveShadow>
            <boxGeometry args={[8.5, 3.6, 4.2]} />
            <meshStandardMaterial color="#475569" roughness={0.5} metalness={0.3} />
          </mesh>
          <group ref={gcsSatcomRef} position={[2.2, 4.5, 0]}>
            <mesh rotation={[0.4, 0, 0]} castShadow>
              <cylinderGeometry args={[1.6, 0.3, 0.6, 16]} />
              <meshStandardMaterial color="#f8fafc" metalness={0.4} roughness={0.3} />
            </mesh>
          </group>
        </group>

        {/* Air Traffic Control (ATC) Tower */}
        <group position={[4, 0, -31]}>
          <mesh position={[0, 6.5, 0]} castShadow receiveShadow>
            <boxGeometry args={[4.6, 13, 4.6]} />
            <meshStandardMaterial color="#e2e8f0" roughness={0.4} />
          </mesh>
          {/* Tower Observation Cab */}
          <mesh position={[0, 14.2, 0]} castShadow>
            <cylinderGeometry args={[3.8, 2.9, 2.8, 8]} />
            <meshStandardMaterial color="#0ea5e9" metalness={0.75} roughness={0.15} />
          </mesh>
          {/* Tower Roof Cap */}
          <mesh position={[0, 15.8, 0]} castShadow>
            <cylinderGeometry args={[4.1, 4.1, 0.4, 8]} />
            <meshStandardMaterial color="#334155" />
          </mesh>
          {/* Rotating Aerodrome Beacon */}
          <group ref={atcBeaconRef} position={[0, 16.6, 0]}>
            <mesh>
              <sphereGeometry args={[0.45, 12, 12]} />
              <meshBasicMaterial color="#10b981" />
            </mesh>
          </group>
        </group>

        {/* Animated Airfield Windsock near Runway 09 Threshold */}
        <group position={[-96, 0, -14]}>
          <mesh position={[0, 2.5, 0]}>
            <cylinderGeometry args={[0.08, 0.08, 5, 8]} />
            <meshStandardMaterial color="#cbd5e1" />
          </mesh>
          <group ref={windsockRef} position={[0, 4.8, 0]}>
            <mesh position={[1.1, 0, 0]} rotation={[0, 0, Math.PI / 2]}>
              <coneGeometry args={[0.45, 2.2, 12, 1, true]} />
              <meshStandardMaterial color="#f97316" side={THREE.DoubleSide} />
            </mesh>
          </group>
        </group>
      </group>

      {/* =================================================================== */}
      {/* INTERACTIVE 3D GROUND SURVEY TARGETS (SEATED FLUSH ON TERRAIN)      */}
      {/* =================================================================== */}
      {surveyTargets.map((tgt) => {
        const isSelected = tgt.id === activeTargetId;
        const groundY = getTerrainHeight(tgt.position[0], tgt.position[2]);
        return (
          <group
            key={tgt.id}
            position={[tgt.position[0], groundY, tgt.position[2]]}
            onClick={(e) => {
              e.stopPropagation();
              onSelectTarget(tgt.id);
            }}
          >
            {/* Graded Concrete Foundation Pad */}
            <mesh rotation={[-Math.PI / 2, 0, 0]} position={[0, 0.15, 0]} receiveShadow>
              <cylinderGeometry args={[11, 12.5, 0.4, 24]} />
              <meshStandardMaterial
                color={isSelected ? '#064e3b' : '#334155'}
                roughness={0.85}
              />
            </mesh>

            {/* Pulsing Target Lock Ring */}
            <mesh
              ref={isSelected ? targetRingRef : undefined}
              rotation={[-Math.PI / 2, 0, 0]}
              position={[0, 0.38, 0]}
            >
              <ringGeometry args={[10.2, 11.8, 32]} />
              <meshBasicMaterial
                color={isSelected ? '#10b981' : '#f59e0b'}
                side={THREE.DoubleSide}
              />
            </mesh>

            {/* Vertical Laser Designation Beam */}
            <mesh position={[0, 14, 0]}>
              <cylinderGeometry args={[0.16, 0.16, 28, 8]} />
              <meshBasicMaterial
                color={isSelected ? '#10b981' : '#f59e0b'}
                transparent
                opacity={isSelected ? 0.4 : 0.18}
              />
            </mesh>

            {/* Floating Interactive 3D Target Tag in Viewport */}
            {show3dLabels && (
              <Html position={[0, 15, 0]} center distanceFactor={65}>
                <button
                  onClick={(e) => {
                    e.stopPropagation();
                    onSelectTarget(tgt.id);
                  }}
                  className={clsx(
                    'px-2.5 py-1 rounded text-[10px] font-mono whitespace-nowrap border transition-all shadow-lg flex items-center gap-1.5',
                    isSelected
                      ? 'bg-emerald-950/95 border-emerald-400 text-emerald-200 font-bold scale-105'
                      : 'bg-slate-950/85 border-amber-500/60 text-amber-300 hover:border-emerald-400'
                  )}
                >
                  <span
                    className={clsx(
                      'w-2 h-2 rounded-full',
                      isSelected ? 'bg-emerald-400 animate-ping' : 'bg-amber-400'
                    )}
                  />
                  <span>
                    {tgt.code}: {tgt.name}
                  </span>
                </button>
              </Html>
            )}

            {tgt.type === 'RADAR' && (
              <group position={[0, 0.35, 0]}>
                <mesh position={[0, 1.6, 0]} castShadow>
                  <cylinderGeometry args={[3.5, 4.2, 3.2, 12]} />
                  <meshStandardMaterial color="#475569" roughness={0.6} />
                </mesh>
                <group ref={radarDishRef} position={[0, 4.2, 0]}>
                  <mesh rotation={[0.45, 0, 0]} castShadow>
                    <cylinderGeometry args={[3.4, 0.8, 1.2, 16]} />
                    <meshStandardMaterial
                      color={flirMode ? '#bbf7d0' : '#f8fafc'}
                      metalness={0.5}
                      roughness={0.3}
                    />
                  </mesh>
                </group>
              </group>
            )}

            {tgt.type === 'DEPOT' && (
              <group position={[0, 0.35, 0]}>
                <mesh position={[-3.4, 2.1, -2]} castShadow>
                  <cylinderGeometry args={[2.6, 2.6, 4.2, 16]} />
                  <meshStandardMaterial color="#e2e8f0" metalness={0.4} roughness={0.4} />
                </mesh>
                <mesh position={[3.4, 2.1, -2]} castShadow>
                  <cylinderGeometry args={[2.6, 2.6, 4.2, 16]} />
                  <meshStandardMaterial color="#e2e8f0" metalness={0.4} roughness={0.4} />
                </mesh>
                <mesh position={[0, 1.8, 3.2]} castShadow>
                  <boxGeometry args={[7.5, 3.5, 3.8]} />
                  <meshStandardMaterial color="#94a3b8" roughness={0.6} />
                </mesh>
              </group>
            )}

            {tgt.type === 'COMMS' && (
              <group position={[0, 0.35, 0]}>
                <mesh position={[0, 6.0, 0]} castShadow>
                  <coneGeometry args={[1.8, 12, 6]} />
                  <meshStandardMaterial color="#cbd5e1" metalness={0.7} roughness={0.3} />
                </mesh>
                <mesh position={[0, 12.2, 0]}>
                  <sphereGeometry args={[1.1, 12, 12]} />
                  <meshBasicMaterial color="#ef4444" />
                </mesh>
                <mesh position={[4.2, 1.4, 0]} castShadow>
                  <boxGeometry args={[4.5, 2.8, 3.5]} />
                  <meshStandardMaterial color="#334155" />
                </mesh>
              </group>
            )}

            {tgt.type === 'CUSTOM' && (
              <mesh position={[0, 2.6, 0]}>
                <octahedronGeometry args={[2.2, 0]} />
                <meshStandardMaterial
                  color="#22d3ee"
                  emissive="#06b6d4"
                  emissiveIntensity={0.8}
                  wireframe
                />
              </mesh>
            )}
          </group>
        );
      })}

      {/* 3D SKY WAYPOINT GATES & ORBIT RING */}
      {showFlightPath && (
        <group>
          {[-95, -50, 0, 50, 95].map((xPos, idx) => {
            const gateY =
              missionPhase === 'TAKEOFF'
                ? Math.max(2, (xPos + 95) * 0.16 + 2)
                : missionPhase === 'APPROACH' || missionPhase === 'LANDING'
                ? Math.max(2, (95 - xPos) * 0.16 + 2)
                : 42;
            return (
              <mesh
                key={idx}
                position={[xPos, gateY, 0]}
                rotation={[0, Math.PI / 2, 0]}
              >
                <ringGeometry args={[3.8, 4.3, 4]} />
                <meshBasicMaterial
                  color={
                    missionPhase === 'APPROACH' || missionPhase === 'LANDING'
                      ? '#38bdf8'
                      : '#10b981'
                  }
                  transparent
                  opacity={0.45}
                  side={THREE.DoubleSide}
                />
              </mesh>
            );
          })}
        </group>
      )}

      {/* Grounded Conifer Trees */}
      {trees.map((t, i) => (
        <group key={i} position={[t.x, t.y, t.z]} scale={t.scale}>
          {/* Trunk */}
          <mesh position={[0, 0.7, 0]} castShadow>
            <cylinderGeometry args={[0.22, 0.32, 1.4, 6]} />
            <meshStandardMaterial color={flirMode ? '#142e1b' : '#5c4033'} roughness={0.9} />
          </mesh>
          {/* Lower Foliage Cone */}
          <mesh position={[0, 2.3, 0]} castShadow>
            <coneGeometry args={[1.45, 3.4, 7]} />
            <meshStandardMaterial
              color={flirMode ? '#22542d' : t.shade}
              roughness={0.85}
            />
          </mesh>
          {/* Upper Foliage Cone */}
          <mesh position={[0, 3.8, 0]} castShadow>
            <coneGeometry args={[1.05, 2.6, 7]} />
            <meshStandardMaterial
              color={flirMode ? '#276134' : t.shade}
              roughness={0.85}
            />
          </mesh>
        </group>
      ))}

      {/* High-Altitude Volumetric Cumulus Clouds */}
      {!flirMode &&
        clouds.map((c, idx) => (
          <group key={idx} position={[c.x, c.y, c.z]} scale={c.s}>
            <mesh position={[0, 0, 0]}>
              <sphereGeometry args={[9, 16, 16]} />
              <meshStandardMaterial color="#f8fafc" roughness={0.9} />
            </mesh>
            <mesh position={[7, -1.5, 2]}>
              <sphereGeometry args={[7, 16, 16]} />
              <meshStandardMaterial color="#f1f5f9" roughness={0.9} />
            </mesh>
            <mesh position={[-7.5, -2, -1]}>
              <sphereGeometry args={[6.5, 16, 16]} />
              <meshStandardMaterial color="#e2e8f0" roughness={0.9} />
            </mesh>
            <mesh position={[2, 4, -3]}>
              <sphereGeometry args={[6.8, 16, 16]} />
              <meshStandardMaterial color="#ffffff" roughness={0.9} />
            </mesh>
          </group>
        ))}
    </group>
  );
}

// ============================================================================
// INTERACTIVE FLIGHT DIRECTOR WITH FULL MOUSE ORBIT/ZOOM & CAMERA TRACKING
// ============================================================================
function MissionFlightDirector({
  uavRef,
  orbitControlsRef,
  missionPhase,
  autoSequence,
  activeTarget,
  cameraMode,
  flightMode,
  paused,
  manualPitch,
  manualRoll,
  manualYaw,
  onPhaseChange,
  onGearCommand,
  onThrottleCommand,
  onTouchdownSmoke,
  onUpdateFlightKinematics,
}: {
  uavRef: React.RefObject<THREE.Group | null>;
  orbitControlsRef: React.RefObject<any>;
  missionPhase: MissionPhase;
  autoSequence: boolean;
  activeTarget: SurveyTarget;
  cameraMode: CameraMode;
  flightMode: FlightMode;
  paused: boolean;
  manualPitch: number;
  manualRoll: number;
  manualYaw: number;
  onPhaseChange: (nextPhase: MissionPhase) => void;
  onGearCommand: (down: boolean) => void;
  onThrottleCommand: (throttlePct: number) => void;
  onTouchdownSmoke: (active: boolean) => void;
  onUpdateFlightKinematics: (
    hdg: number,
    altFt: number,
    aglM: number,
    airspeedKt: number,
    vsFpm: number,
    pitch: number,
    roll: number,
    surveyProgressPct: number
  ) => void;
}) {
  const { camera } = useThree();
  const phaseTimerRef = useRef<number>(0);
  const prevPhaseRef = useRef<MissionPhase>(missionPhase);
  const prevCamModeRef = useRef<number>(cameraMode);
  const surveyProgressRef = useRef<number>(0);
  const lastReportRef = useRef<number>(0);
  const prevUavPosRef = useRef<THREE.Vector3>(new THREE.Vector3(-110, 1.45, 0));

  if (prevPhaseRef.current !== missionPhase) {
    phaseTimerRef.current = 0;
    if (missionPhase === 'TAKEOFF') {
      onGearCommand(true);
      onThrottleCommand(98);
      onTouchdownSmoke(false);
    } else if (missionPhase === 'CLIMB') {
      onGearCommand(false);
      onThrottleCommand(92);
      onTouchdownSmoke(false);
    } else if (missionPhase === 'SURVEY') {
      onGearCommand(false);
      onThrottleCommand(75);
      onTouchdownSmoke(false);
    } else if (missionPhase === 'APPROACH') {
      onGearCommand(true);
      onThrottleCommand(44);
      onTouchdownSmoke(false);
    } else if (missionPhase === 'LANDING') {
      onGearCommand(true);
      onThrottleCommand(25);
    } else if (missionPhase === 'LANDED') {
      onGearCommand(true);
      onThrottleCommand(20);
      onTouchdownSmoke(false);
    }
    prevPhaseRef.current = missionPhase;
  }

  useFrame((state, delta) => {
    if (!uavRef.current) return;
    if (!paused) {
      phaseTimerRef.current += delta;
    }

    const t = phaseTimerRef.current;
    let x = uavRef.current.position.x;
    let y = uavRef.current.position.y;
    let z = uavRef.current.position.z;
    let yaw = uavRef.current.rotation.y;
    let pitch = 0;
    let roll = 0;
    let airspeedKt = 85;
    let vsFpm = 0;

    // MANUAL FLIGHT JOYSTICK OVERRIDE MODE
    if (flightMode === 'manual') {
      const speed = 22;
      yaw += (-manualRoll * 0.65 + manualYaw * 0.8) * delta;
      pitch = -manualPitch * 0.35;
      roll = -manualRoll * 0.55;
      const forwardVec = new THREE.Vector3(
        Math.sin(yaw),
        -pitch * 0.8,
        Math.cos(yaw)
      ).normalize();
      if (!paused) {
        x += forwardVec.x * speed * delta;
        const minSafeY = getTerrainHeight(x, z) + 1.45;
        y = Math.max(minSafeY, Math.min(110, y + forwardVec.y * speed * delta));
        z += forwardVec.z * speed * delta;
      }
      airspeedKt = 88;
      vsFpm = Math.round(forwardVec.y * 1200);
    }
    // PHASE 1: TAKEOFF ROLL & ROTATION
    else if (missionPhase === 'TAKEOFF') {
      const progress = Math.min(1, t / 11);
      const accelCurve = progress * progress;
      x = -115 + accelCurve * 210;
      z = 0;
      airspeedKt = Math.round(12 + progress * 82);

      if (progress < 0.52) {
        y = 1.45;
        pitch = 0;
        vsFpm = 0;
      } else {
        const liftProg = (progress - 0.52) / 0.48;
        y = 1.45 + Math.pow(liftProg, 1.6) * 18;
        pitch = -0.16;
        vsFpm = Math.round(liftProg * 1150);
        if (liftProg > 0.45) {
          onGearCommand(false);
        }
      }
      yaw = Math.PI / 2;
      roll = 0;

      if (progress >= 1 && !paused) {
        onPhaseChange('CLIMB');
      }
    }
    // PHASE 2: CLIMB OUTBOUND TO ISR ALTITUDE
    else if (missionPhase === 'CLIMB') {
      const progress = Math.min(1, t / 9);
      const angle = progress * Math.PI * 0.85;
      x = 95 * Math.cos(angle) + activeTarget.position[0] * progress * 0.4;
      z = -75 * Math.sin(angle) + activeTarget.position[2] * progress * 0.4;
      y = 19.5 + progress * 22.5;
      yaw = Math.PI / 2 + angle + 0.4;
      pitch = -0.12 * (1 - progress * 0.5);
      roll = -0.28 * Math.sin(progress * Math.PI);
      airspeedKt = 88;
      vsFpm = Math.round(950 * (1 - progress * 0.6));

      if (progress >= 1 && !paused) {
        onPhaseChange('SURVEY');
      }
    }
    // PHASE 3: ISR TARGET LOITER & SURVEY ORBIT
    else if (missionPhase === 'SURVEY') {
      const orbitSpeed = 0.36;
      const orbitRadius = 38;
      const theta = t * orbitSpeed;
      const targetX = activeTarget.position[0] + Math.cos(theta) * orbitRadius;
      const targetZ = activeTarget.position[2] + Math.sin(theta) * orbitRadius;
      const terrainFloor = getTerrainHeight(targetX, targetZ);
      const targetY =
        Math.max(44, terrainFloor + 28) + Math.sin(t * 1.2) * 1.2 + manualPitch * 8;

      x = THREE.MathUtils.lerp(x, targetX, Math.min(1, delta * 2.5));
      z = THREE.MathUtils.lerp(z, targetZ, Math.min(1, delta * 2.5));
      y = THREE.MathUtils.lerp(y, targetY, Math.min(1, delta * 2.5));

      const vx = -Math.sin(theta) * orbitRadius;
      const vz = Math.cos(theta) * orbitRadius;
      yaw = Math.atan2(vx, vz) + manualYaw * 0.35;
      roll = -0.26 + manualRoll * 0.35;
      pitch = -manualPitch * 0.22;
      airspeedKt = 84;
      vsFpm = Math.round(Math.cos(t * 1.2) * 80);

      if (!paused) {
        surveyProgressRef.current = Math.min(
          100,
          surveyProgressRef.current + delta * 6.5
        );
      }

      if (autoSequence && t > 18 && !paused) {
        onPhaseChange('APPROACH');
      }
    }
    // PHASE 4: FINAL APPROACH GLIDESLOPE
    else if (missionPhase === 'APPROACH') {
      const progress = Math.min(1, t / 10);
      const targetX = -165 + progress * 80;
      const targetZ = 0;
      const targetY = 34 * (1 - progress) + 2.0 * progress;

      x = THREE.MathUtils.lerp(x, targetX, Math.min(1, delta * 4));
      z = THREE.MathUtils.lerp(z, targetZ, Math.min(1, delta * 3.5));
      y = THREE.MathUtils.lerp(y, targetY, Math.min(1, delta * 4));

      yaw = Math.PI / 2;
      pitch = progress > 0.8 ? -0.08 : 0.06;
      roll = Math.sin(t * 3) * 0.03;
      airspeedKt = Math.round(82 - progress * 14);
      vsFpm = -580;

      if (progress >= 1 && !paused) {
        onPhaseChange('LANDING');
      }
    }
    // PHASE 5: TOUCHDOWN & ROLLOUT
    else if (missionPhase === 'LANDING') {
      const progress = Math.min(1, t / 8);
      const decel = 1 - Math.pow(1 - progress, 2);
      x = -85 + decel * 120;
      z = 0;
      y = 1.45;
      yaw = Math.PI / 2;
      pitch = progress < 0.25 ? -0.07 * (1 - progress * 4) : 0;
      roll = 0;
      airspeedKt = Math.max(0, Math.round(68 * (1 - progress)));
      vsFpm = 0;

      onTouchdownSmoke(progress < 0.28);

      if (progress >= 1 && !paused) {
        onTouchdownSmoke(false);
        onPhaseChange(autoSequence ? 'TAKEOFF' : 'LANDED');
      }
    }
    // PHASE 6: LANDED HOLD
    else if (missionPhase === 'LANDED') {
      y = 1.45;
      z = 0;
      yaw = Math.PI / 2;
      pitch = 0;
      roll = 0;
      airspeedKt = 0;
      vsFpm = 0;
    }

    const newUavPos = new THREE.Vector3(x, y, z);
    const deltaMove = newUavPos.clone().sub(prevUavPosRef.current);
    prevUavPosRef.current.copy(newUavPos);

    uavRef.current.position.copy(newUavPos);
    uavRef.current.rotation.order = 'YXZ';
    uavRef.current.rotation.y = yaw;
    uavRef.current.rotation.x = pitch;
    uavRef.current.rotation.z = roll;

    if (state.clock.elapsedTime - lastReportRef.current > 0.08) {
      const hdgDeg = (((yaw * 180) / Math.PI + 360) % 360);
      const aglMeters = Math.max(0, Math.round((y - 1.45) * 7.6));
      const mslFt = Math.round(5120 + aglMeters * 3.28084);
      onUpdateFlightKinematics(
        hdgDeg,
        mslFt,
        aglMeters,
        airspeedKt,
        vsFpm,
        (-pitch * 180) / Math.PI,
        (roll * 180) / Math.PI,
        surveyProgressRef.current
      );
      lastReportRef.current = state.clock.elapsedTime;
    }

    // =====================================================================
    // INTERACTIVE CAMERA & ORBIT CONTROLS SYNCHRONIZATION
    // =====================================================================
    const forward = new THREE.Vector3(0, 0, 1).applyEuler(uavRef.current.rotation);
    const right = new THREE.Vector3(1, 0, 0).applyEuler(uavRef.current.rotation);
    const up = new THREE.Vector3(0, 1, 0);

    // If camera mode was just switched, snap camera to the new preset relative to UAV
    if (prevCamModeRef.current !== cameraMode) {
      prevCamModeRef.current = cameraMode;
      if (cameraMode === 1) {
        camera.position.copy(
          newUavPos
            .clone()
            .add(forward.clone().multiplyScalar(-17))
            .add(up.clone().multiplyScalar(5.5))
        );
      } else if (cameraMode === 2) {
        camera.position.copy(
          newUavPos
            .clone()
            .add(forward.clone().multiplyScalar(15))
            .add(up.clone().multiplyScalar(2.5))
        );
      } else if (cameraMode === 3) {
        camera.position.copy(
          newUavPos
            .clone()
            .add(right.clone().multiplyScalar(-11))
            .add(up.clone().multiplyScalar(1.8))
        );
      } else if (cameraMode === 4) {
        camera.position.copy(newUavPos.clone().add(new THREE.Vector3(16, 8, 16)));
      } else if (cameraMode === 5) {
        camera.position.set(-20, 14, -22);
      }
    }

    // Special lock modes (Cockpit or FLIR Gimbal)
    if (flightMode === 'cockpit') {
      const camPos = newUavPos
        .clone()
        .add(forward.clone().multiplyScalar(2.6))
        .add(up.clone().multiplyScalar(0.85));
      camera.position.lerp(camPos, 0.35);
      camera.lookAt(newUavPos.clone().add(forward.clone().multiplyScalar(35)));
      return;
    }

    if (cameraMode === 6) {
      const flirPos = newUavPos.clone().add(new THREE.Vector3(0, -1.2, 0));
      camera.position.copy(flirPos);
      camera.lookAt(
        new THREE.Vector3(
          activeTarget.position[0],
          activeTarget.position[1],
          activeTarget.position[2]
        )
      );
      return;
    }

    // For all standard 3D views (1: Chase, 2: Nose, 3: Wing, 4: 360°, 5: Tower),
    // move camera along with the UAV translation AND let OrbitControls handle interactive mouse drag/zoom!
    if (orbitControlsRef.current) {
      if (cameraMode !== 5) {
        camera.position.add(deltaMove);
      }
      orbitControlsRef.current.target.copy(newUavPos);
      orbitControlsRef.current.update();
    }
  });

  return null;
}

// ============================================================================
// ISOLATED 3D PISTON ENGINE CORE BENCH VIEW (CAMERA MODE 7)
// ============================================================================
function IsolatedPistonEngineBench({
  telemetry,
  portHeat,
}: {
  telemetry: EngineTelemetry;
  portHeat: number;
}) {
  const group = useRef<THREE.Group>(null);
  const propRef = useRef<THREE.Mesh>(null);
  const rpm = telemetry.rpm || 2450;
  const rotationSpeed = (rpm / 60) * Math.PI * 0.1;

  const baseColor = new THREE.Color('#475569');
  const hotColor = new THREE.Color('#ef4444');
  const heatColor = baseColor.clone().lerp(hotColor, Math.min(1, portHeat));

  useFrame((state, delta) => {
    if (propRef.current) {
      propRef.current.rotation.z += rotationSpeed * delta * 20;
    }
    if (group.current) {
      const vibIntensity = (telemetry.vibration / 100) * 0.05;
      group.current.position.x = Math.sin(state.clock.elapsedTime * 50) * vibIntensity;
      group.current.position.y = Math.cos(state.clock.elapsedTime * 60) * vibIntensity;
    }
  });

  return (
    <group ref={group}>
      <mesh position={[0, 0, 0]}>
        <boxGeometry args={[1.5, 1, 2.5]} />
        <meshStandardMaterial color="#334155" metalness={0.8} roughness={0.2} />
      </mesh>
      {[
        [1.2, 0, 0.6],
        [-1.2, 0, 0.6],
        [1.2, 0, -0.6],
        [-1.2, 0, -0.6],
      ].map((pos, idx) => (
        <mesh key={idx} position={pos as [number, number, number]}>
          <cylinderGeometry args={[0.4, 0.4, 1, 16]} />
          <meshStandardMaterial color={heatColor} metalness={0.6} roughness={0.4} />
        </mesh>
      ))}
      <mesh position={[0, 0, 1.4]}>
        <cylinderGeometry args={[0.3, 0.3, 0.5, 16]} />
        <meshStandardMaterial color="#1e293b" metalness={0.9} roughness={0.1} />
      </mesh>
      <mesh ref={propRef} position={[0, 0, 1.6]}>
        <boxGeometry args={[3.5, 0.1, 0.1]} />
        <meshStandardMaterial color="#94a3b8" metalness={0.5} roughness={0.5} />
      </mesh>
    </group>
  );
}

// ============================================================================
// MAIN EXPORTED 3D TWIN COMPONENT
// ============================================================================
export function Engine3D({
  telemetry,
  dtState,
  onOpenEngineLab,
}: {
  telemetry: EngineTelemetry | null;
  dtState: (EngineHealthState & { active_alerts?: FaultAlert[] }) | null;
  onOpenEngineLab?: () => void;
}) {
  const uavRef = useRef<THREE.Group | null>(null);
  const orbitControlsRef = useRef<any>(null);

  // Mission Phase & Interactive Survey Targets
  const [missionPhase, setMissionPhase] = useState<MissionPhase>('SURVEY');
  const [autoSequence, setAutoSequence] = useState<boolean>(true);
  const [surveyTargets, setSurveyTargets] = useState<SurveyTarget[]>(
    INITIAL_SURVEY_TARGETS
  );
  const [activeTargetId, setActiveTargetId] = useState<string>('tgt-alpha');
  const [showFlightPath, setShowFlightPath] = useState<boolean>(true);
  const [show3dLabels, setShow3dLabels] = useState<boolean>(true);
  const [touchdownSmoke, setTouchdownSmoke] = useState<boolean>(false);

  // Top Control Bar states
  const [flightMode, setFlightMode] = useState<FlightMode>('waypoints');
  const [cameraMode, setCameraMode] = useState<CameraMode>(1);
  const [gearDown, setGearDown] = useState<boolean>(false);
  const [showHud, setShowHud] = useState<boolean>(true);
  const [paused, setPaused] = useState<boolean>(false);
  const [muteTx, setMuteTx] = useState<boolean>(false);

  // Dual Engine Selector & Flight Controls
  const [selectedEngine, setSelectedEngine] = useState<'port' | 'stbd'>('port');
  const [linkThrottles, setLinkThrottles] = useState<boolean>(true);
  const [portThrottle, setPortThrottle] = useState<number>(75);
  const [stbdThrottle, setStbdThrottle] = useState<number>(75);

  // Active Physical Fault Scenario
  const [activeFaultId, setActiveFaultId] = useState<string | null>(null);

  // Manual / Interactive Virtual Flight Stick Offsets (-1 to +1)
  const [manualPitch, setManualPitch] = useState<number>(0);
  const [manualRoll, setManualRoll] = useState<number>(0);
  const [manualYaw, setManualYaw] = useState<number>(0);
  const [isDraggingStick, setIsDraggingStick] = useState<boolean>(false);
  const stickPadRef = useRef<HTMLDivElement | null>(null);

  // Live Flight Attitudes reported from 3D loop
  const [flightAttitude, setFlightAttitude] = useState({
    heading: 198,
    altitudeFt: 6136,
    aglM: 308,
    airspeedKt: 85,
    vsFpm: 0,
    pitchDeg: 0,
    rollDeg: -12,
    surveyProgressPct: 45,
  });

  const activeTarget =
    surveyTargets.find((t) => t.id === activeTargetId) || surveyTargets[0];

  // Keyboard shortcuts
  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      if (
        e.target instanceof HTMLInputElement ||
        e.target instanceof HTMLSelectElement
      ) {
        return;
      }
      const key = e.key.toLowerCase();
      if (key === '7' && onOpenEngineLab) {
        onOpenEngineLab();
      } else if (key >= '1' && key <= '7') {
        setCameraMode(Number(key) as CameraMode);
      } else if (key === 'g') {
        setGearDown((g) => !g);
      } else if (key === 'h') {
        setShowHud((h) => !h);
      } else if (key === 'w') {
        setManualPitch((p) => Math.min(1.0, p + 0.2));
      } else if (key === 's') {
        setManualPitch((p) => Math.max(-1.0, p - 0.2));
      } else if (key === 'a') {
        setManualRoll((r) => Math.max(-1.0, r - 0.2));
      } else if (key === 'd') {
        setManualRoll((r) => Math.min(1.0, r + 0.2));
      } else if (key === 'q') {
        setManualYaw((y) => y - 0.2);
      } else if (key === 'e') {
        setManualYaw((y) => y + 0.2);
      }
    };
    window.addEventListener('keydown', handleKeyDown);
    return () => window.removeEventListener('keydown', handleKeyDown);
  }, []);

  // Interactive Virtual Joystick Mouse Handler
  const updateStickFromMouse = (clientX: number, clientY: number) => {
    if (!stickPadRef.current) return;
    const rect = stickPadRef.current.getBoundingClientRect();
    const nx = ((clientX - rect.left) / rect.width) * 2 - 1;
    const ny = ((clientY - rect.top) / rect.height) * 2 - 1;
    setManualRoll(Math.max(-1, Math.min(1, nx)));
    setManualPitch(Math.max(-1, Math.min(1, -ny)));
  };

  if (!telemetry || !dtState) {
    return (
      <div className="h-full w-full bg-slate-900 rounded-lg flex items-center justify-center text-slate-400">
        Loading 3D Digital Twin Environment...
      </div>
    );
  }

  const activeFaultObj =
    PHYSICAL_FAULTS.find((f) => f.id === activeFaultId) || null;

  const triggerPhysicalFault = async (fault: PhysicalFault) => {
    if (activeFaultId === fault.id) {
      setActiveFaultId(null);
      await fetch('/api/fault/clear', { method: 'POST' });
    } else {
      setActiveFaultId(fault.id);
      await fetch('/api/fault/inject', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          fault: fault.backendFault,
          severity: fault.severity,
        }),
      });
    }
  };

  const resetSimulation = async () => {
    setActiveFaultId(null);
    setMissionPhase('TAKEOFF');
    setPortThrottle(98);
    setStbdThrottle(98);
    setManualPitch(0);
    setManualRoll(0);
    setManualYaw(0);
    setPaused(false);
    await fetch('/api/fault/clear', { method: 'POST' });
  };

  // Double-click anywhere on the 3D terrain to create a custom tactical survey waypoint
  const handleTerrainWaypointClick = (point: THREE.Vector3) => {
    const groundY = getTerrainHeight(point.x, point.z);
    const customTarget: SurveyTarget = {
      id: 'tgt-custom',
      code: 'WP-CUSTOM',
      name: `Coords (${point.x.toFixed(0)}, ${point.z.toFixed(0)})`,
      type: 'CUSTOM',
      position: [point.x, groundY, point.z],
      gridRef: 'DYNAMIC WAYPOINT',
    };
    setSurveyTargets((prev) => [
      ...prev.filter((t) => t.id !== 'tgt-custom'),
      customTarget,
    ]);
    setActiveTargetId('tgt-custom');
    setMissionPhase('SURVEY');
  };

  // Compute 18-channel Rotax 914 UL/F telemetry
  const activeThrottle = selectedEngine === 'port' ? portThrottle : stbdThrottle;
  const throttleScale = activeThrottle / 75;
  const engineBias = selectedEngine === 'port' ? 1.0 : 0.985;
  const fDelta = activeFaultObj && selectedEngine === 'port' ? activeFaultObj : null;

  const chtVal =
    (telemetry.cht + 88) * (0.75 + 0.25 * throttleScale) * engineBias +
    (fDelta?.chtDelta || 0);
  const egtVal =
    (telemetry.egt + 125) * (0.85 + 0.15 * throttleScale) * engineBias +
    (fDelta?.egtDelta || 0);
  const oilTempVal =
    (telemetry.oil_temp + 24) * engineBias + (fDelta?.oilTempDelta || 0);
  const mapVal = 31.5 * throttleScale + (fDelta?.mapDelta || 0);
  const fuelFlowLh = (telemetry.fuel_flow / 210) * throttleScale;
  const fuelConsKgH = 4.25 * throttleScale * engineBias;
  const lambdaVal = 1.001 + (fDelta?.lambdaDelta || 0);
  const efficiencyPct = Math.max(18.5, 35.3 - (fDelta ? 4.8 : 0));
  const timingDeg = 15.1;
  const rotaxRpm =
    telemetry.rpm * 2.01 * (0.45 + 0.55 * throttleScale) * engineBias +
    (fDelta?.rpmDelta || 0);
  const oilPressKpa =
    telemetry.oil_pressure * 94.5 * (0.6 + 0.4 * throttleScale) +
    (fDelta?.oilPressDelta || 0);
  const oilPressPsi = oilPressKpa * 0.145038;
  const oilTan = 0.51 + dtState.degradation * 12;
  const vibX =
    0.054 * (telemetry.vibration / 15) * throttleScale + (fDelta?.vibDelta || 0);
  const vibY =
    0.047 * (telemetry.vibration / 15) * throttleScale +
    (fDelta?.vibDelta || 0) * 0.85;
  const vibZ =
    0.036 * (telemetry.vibration / 15) * throttleScale +
    (fDelta?.vibDelta || 0) * 0.7;
  const exhaustBackpressure = 43.5 * throttleScale;
  const mainBusVoltage =
    telemetry.battery_voltage + (fDelta?.busVoltDelta || 0);

  const portHeatRatio = Math.max(0, Math.min(1, (chtVal - 220) / 70));
  const stbdHeatRatio = Math.max(0, Math.min(1, (telemetry.cht - 160) / 50));

  const isFlirMode = cameraMode === 6;

  const handleExportJSON = () => {
    const payload = {
      platform: 'TAPAS-BH-201',
      mission_phase: missionPhase,
      survey_target: activeTarget.name,
      engine:
        selectedEngine === 'port'
          ? 'PORT ROTAX 914 UL/F'
          : 'STBD ROTAX 914 UL/F',
      timestamp: new Date().toISOString(),
      cht_c: Number(chtVal.toFixed(1)),
      egt_c: Number(egtVal.toFixed(1)),
      oil_temp_c: Number(oilTempVal.toFixed(1)),
      map_kpa: Number(mapVal.toFixed(1)),
      throttle_pct: activeThrottle,
      rpm: Number(rotaxRpm.toFixed(1)),
      oil_pressure_kpa: Number(oilPressKpa.toFixed(1)),
      bus_voltage_v: Number(mainBusVoltage.toFixed(2)),
      active_fault: activeFaultObj?.label || 'NOMINAL',
    };
    const blob = new Blob([JSON.stringify(payload, null, 2)], {
      type: 'application/json',
    });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = `tapas_bh201_${selectedEngine}_telemetry.json`;
    a.click();
    URL.revokeObjectURL(url);
  };

  const handleExportCSV = () => {
    const headers =
      'timestamp,phase,engine,cht_c,egt_c,oil_temp_c,map_kpa,throttle_pct,rpm,oil_press_kpa,bus_v,fault\n';
    const row = `${new Date().toISOString()},${missionPhase},${selectedEngine.toUpperCase()},${chtVal.toFixed(
      1
    )},${egtVal.toFixed(1)},${oilTempVal.toFixed(1)},${mapVal.toFixed(
      1
    )},${activeThrottle},${rotaxRpm.toFixed(1)},${oilPressKpa.toFixed(
      1
    )},${mainBusVoltage.toFixed(2)},${activeFaultObj?.label || 'NOMINAL'}\n`;
    const blob = new Blob([headers + row], { type: 'text/csv' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = `tapas_bh201_${selectedEngine}_telemetry.csv`;
    a.click();
    URL.revokeObjectURL(url);
  };

  const airspeedKmh = Math.round(flightAttitude.airspeedKt * 1.852);

  return (
    <div className="relative w-full h-full min-h-[700px] rounded-xl overflow-hidden border border-slate-800 bg-[#070b12] select-none font-sans">
      {/* =================================================================== */}
      {/* INTERACTIVE 3D WEBGL SCENE CANVAS                                   */}
      {/* =================================================================== */}
      <div
        className={clsx(
          'absolute inset-0 transition-all duration-300',
          isFlirMode && 'contrast-125 saturate-150 hue-rotate-15'
        )}
      >
        <Canvas shadows camera={{ position: [-75, 50, -85], fov: 45 }}>
          <color
            attach="background"
            args={[
              cameraMode === 7
                ? '#090d16'
                : isFlirMode
                ? '#0c2614'
                : '#7db8f7',
            ]}
          />
          {cameraMode !== 7 && (
            <fog
              attach="fog"
              args={[isFlirMode ? '#091f10' : '#a9d4fc', 240, 880]}
            />
          )}

          <ambientLight intensity={isFlirMode ? 0.9 : 0.7} />
          <directionalLight
            castShadow
            position={[80, 140, 60]}
            intensity={isFlirMode ? 0.8 : 1.4}
            shadow-mapSize={[1024, 1024]}
          />
          <hemisphereLight
            args={[
              isFlirMode ? '#4ade80' : '#bae6fd',
              isFlirMode ? '#052e16' : '#3f6212',
              0.55,
            ]}
          />

          {cameraMode === 7 ? (
            <>
              <IsolatedPistonEngineBench
                telemetry={telemetry}
                portHeat={portHeatRatio}
              />
              <OrbitControls makeDefault autoRotate autoRotateSpeed={0.8} />
            </>
          ) : (
            <>
              <TapasUAVModel
                uavRef={uavRef}
                portThrottle={portThrottle}
                stbdThrottle={stbdThrottle}
                gearDown={gearDown}
                portHeat={portHeatRatio}
                stbdHeat={stbdHeatRatio}
                paused={paused}
                isSurveying={missionPhase === 'SURVEY'}
                touchdownSmoke={touchdownSmoke}
                selectedEngine={selectedEngine}
                show3dLabels={show3dLabels}
                onSelectEngine={setSelectedEngine}
                onOpenEngineLab={onOpenEngineLab}
                onToggleFlir={() =>
                  setCameraMode((c) => (c === 6 ? 1 : 6))
                }
                onToggleGear={() => setGearDown((g) => !g)}
              />
              <InteractiveAirbaseAndTerrain
                flirMode={isFlirMode}
                surveyTargets={surveyTargets}
                activeTargetId={activeTargetId}
                onSelectTarget={(id) => {
                  setActiveTargetId(id);
                  setMissionPhase('SURVEY');
                }}
                onTerrainWaypointClick={handleTerrainWaypointClick}
                showFlightPath={showFlightPath}
                show3dLabels={show3dLabels}
                missionPhase={missionPhase}
              />
              {/* Interactive OrbitControls enabled so user can drag to rotate/zoom around the live UAV! */}
              <OrbitControls
                ref={orbitControlsRef}
                makeDefault
                enablePan={true}
                enableZoom={true}
                enableRotate={cameraMode !== 6 && flightMode !== 'cockpit'}
                minDistance={5}
                maxDistance={260}
                maxPolarAngle={Math.PI / 2 - 0.03}
              />
              <MissionFlightDirector
                uavRef={uavRef}
                orbitControlsRef={orbitControlsRef}
                missionPhase={missionPhase}
                autoSequence={autoSequence}
                activeTarget={activeTarget}
                cameraMode={cameraMode}
                flightMode={flightMode}
                paused={paused}
                manualPitch={manualPitch}
                manualRoll={manualRoll}
                manualYaw={manualYaw}
                onPhaseChange={setMissionPhase}
                onGearCommand={setGearDown}
                onThrottleCommand={(thr) => {
                  setPortThrottle(thr);
                  setStbdThrottle(thr);
                }}
                onTouchdownSmoke={setTouchdownSmoke}
                onUpdateFlightKinematics={(
                  hdg,
                  altFt,
                  aglM,
                  iasKt,
                  vsFpm,
                  pitch,
                  roll,
                  surveyPct
                ) => {
                  if (!muteTx) {
                    setFlightAttitude({
                      heading: hdg,
                      altitudeFt: altFt,
                      aglM,
                      airspeedKt: iasKt,
                      vsFpm,
                      pitchDeg: pitch,
                      rollDeg: roll,
                      surveyProgressPct: surveyPct,
                    });
                  }
                }}
              />
            </>
          )}
        </Canvas>
      </div>

      {/* =================================================================== */}
      {/* INTERACTIVE VIEWPORT INSTRUCTION & CURSOR STATUS PILL (TOP-CENTER)  */}
      {/* =================================================================== */}
      <div className="absolute top-[74px] left-1/2 -translate-x-1/2 z-10 pointer-events-none hidden lg:flex items-center gap-3 bg-slate-950/80 backdrop-blur-md border border-slate-700/70 px-3.5 py-1 rounded-md text-[10px] font-mono text-slate-300">
        <span>Drag: 360° Orbit</span>
        <span className="text-slate-600">·</span>
        <span>Scroll: Zoom</span>
        <span className="text-slate-600">·</span>
        <span>Click Nacelle/Target: Inspect & Lock</span>
        <span className="text-slate-600">·</span>
        <span>Double-Click Ground: Fly to Waypoint</span>
      </div>

      {/* =================================================================== */}
      {/* FLIR EO/IR GIMBAL TARGETING OVERLAY (CAMERA 6)                      */}
      {/* =================================================================== */}
      {isFlirMode && (
        <div className="absolute inset-0 pointer-events-none z-10 flex items-center justify-center">
          <div className="absolute top-24 left-6 text-xs font-mono text-emerald-400 tracking-widest uppercase">
            FLIR EO/IR SENSOR TURRET 360° • WHITE HOT
          </div>
          <div className="absolute top-24 left-1/2 -translate-x-1/2 text-xs font-mono text-emerald-400 tracking-wider">
            AZ: -34° · EL: -23° · TARGET:{' '}
            {missionPhase === 'SURVEY' ? activeTarget.code : 'RWY 09/27'}
          </div>

          <div className="relative flex flex-col items-center">
            <div className="w-28 h-28 border border-emerald-400/70 relative flex items-center justify-center">
              <div className="absolute inset-x-0 h-px bg-emerald-400/80" />
              <div className="absolute inset-y-0 w-px bg-emerald-400/80" />
              <div className="w-2 h-2 rounded-full bg-emerald-300 shadow-[0_0_8px_#34d399]" />
            </div>

            <div className="mt-2 w-52 h-16 relative">
              <div className="absolute top-0 left-0 w-3 h-3 border-t-2 border-l-2 border-emerald-400" />
              <div className="absolute top-0 right-0 w-3 h-3 border-t-2 border-r-2 border-emerald-400" />
              <div className="absolute bottom-0 left-0 w-3 h-3 border-b-2 border-l-2 border-emerald-400" />
              <div className="absolute bottom-0 right-0 w-3 h-3 border-b-2 border-r-2 border-emerald-400" />
            </div>
            <span className="mt-2 text-[11px] font-mono font-semibold text-emerald-400 tracking-widest uppercase">
              {missionPhase === 'SURVEY'
                ? `${activeTarget.name} [LOCKED]`
                : 'RUNWAY 09/27 [LOCKED]'}
            </span>
          </div>
        </div>
      )}

      {/* =================================================================== */}
      {/* TOP FLIGHT, CAMERA & MISSION LIFECYCLE COMMAND BAR                  */}
      {/* =================================================================== */}
      <div className="absolute top-2.5 inset-x-3 z-20 flex flex-col items-center gap-1.5 pointer-events-auto">
        {/* Row 1: Camera & View Mode Controls */}
        <div className="flex flex-wrap items-center gap-1 bg-[#090e17]/90 backdrop-blur-md px-2.5 py-1.5 rounded-lg border border-slate-700/80 text-[11px] shadow-lg">
          <DrdoLogo size="sm" showText={true} className="mr-1.5 pr-2 border-r border-slate-700/80" />
          <TopBarBtn
            active={flightMode === 'cockpit'}
            onClick={() => setFlightMode('cockpit')}
            label="Cockpit"
          />
          <TopBarBtn
            active={flightMode === 'orbit'}
            onClick={() => setFlightMode('orbit')}
            label="Scenic Orbit"
          />
          <TopBarBtn
            active={flightMode === 'waypoints'}
            onClick={() => setFlightMode('waypoints')}
            label="Waypoints"
          />
          <TopBarBtn
            active={flightMode === 'manual'}
            onClick={() => setFlightMode('manual')}
            label="Manual Stick"
          />

          <div className="h-4 w-px bg-slate-700 mx-1" />

          {(
            [
              { id: 1, label: '1: Chase' },
              { id: 2, label: '2: Nose' },
              { id: 3, label: '3: Wing' },
              { id: 4, label: '4: 360°' },
              { id: 5, label: '5: Tower' },
              { id: 6, label: '6: FLIR' },
              { id: 7, label: '7: Engine Core' },
            ] as { id: CameraMode; label: string }[]
          ).map((cam) => (
            <TopBarBtn
              key={cam.id}
              active={cameraMode === cam.id && flightMode !== 'cockpit'}
              onClick={() => {
                if (cam.id === 7 && onOpenEngineLab) {
                  onOpenEngineLab();
                  return;
                }
                if (flightMode === 'cockpit') setFlightMode('waypoints');
                setCameraMode(cam.id);
              }}
              label={cam.label}
            />
          ))}

          <div className="h-4 w-px bg-slate-700 mx-1" />

          <TopBarBtn
            active={gearDown}
            onClick={() => setGearDown((g) => !g)}
            label={`Gear: ${gearDown ? 'DOWN' : 'UP'}`}
          />
          <TopBarBtn
            active={show3dLabels}
            onClick={() => setShow3dLabels((s) => !s)}
            label="3D Callouts"
          />
          <TopBarBtn
            active={showFlightPath}
            onClick={() => setShowFlightPath((s) => !s)}
            label="Path Gates"
          />
          <TopBarBtn
            active={showHud}
            onClick={() => setShowHud((h) => !h)}
            label="HUD [H]"
          />
          <div className="px-2.5 py-1 rounded bg-emerald-600/90 text-white font-mono font-semibold text-[10px] tracking-wider flex items-center gap-1.5">
            <span className="w-1.5 h-1.5 rounded-full bg-emerald-200 animate-ping" />
            RELAY: {muteTx ? 'MUTED' : 'SYNC'}
          </div>
        </div>

        {/* Row 2: Interactive Drone Flight Sequencer + Survey Targets */}
        <div className="flex flex-wrap items-center gap-1.5 bg-[#090e17]/90 backdrop-blur-md px-3 py-1.5 rounded-lg border border-slate-700/80 text-[11px] shadow-lg">
          <span className="text-[10px] font-mono uppercase tracking-wider text-emerald-400 font-semibold mr-1">
            SORTIE PHASE:
          </span>

          {(
            [
              { id: 'TAKEOFF', label: '1. Takeoff Roll' },
              { id: 'CLIMB', label: '2. Climb Out' },
              { id: 'SURVEY', label: '3. ISR Survey' },
              { id: 'APPROACH', label: '4. Glideslope' },
              { id: 'LANDING', label: '5. Touchdown & Land' },
            ] as { id: MissionPhase; label: string }[]
          ).map((p) => (
            <button
              key={p.id}
              onClick={() => {
                setFlightMode('waypoints');
                setMissionPhase(p.id);
              }}
              className={clsx(
                'px-2.5 py-1 rounded font-mono text-[10px] font-semibold transition-colors whitespace-nowrap',
                missionPhase === p.id && flightMode !== 'manual'
                  ? 'bg-emerald-500 text-slate-950 shadow-sm'
                  : 'bg-slate-900 text-slate-300 hover:bg-slate-800 border border-slate-700'
              )}
            >
              {p.label}
            </button>
          ))}

          <label className="flex items-center gap-1.5 text-[10px] font-mono text-cyan-300 ml-1 cursor-pointer">
            <input
              type="checkbox"
              checked={autoSequence}
              onChange={(e) => setAutoSequence(e.target.checked)}
              className="accent-cyan-400 rounded"
            />
            Auto-Cycle
          </label>

          <div className="h-4 w-px bg-slate-700 mx-1" />

          <span className="text-[10px] font-mono uppercase tracking-wider text-amber-400 font-semibold">
            SURVEY LOCK:
          </span>
          {surveyTargets.map((tgt) => (
            <button
              key={tgt.id}
              onClick={() => {
                setActiveTargetId(tgt.id);
                setFlightMode('waypoints');
                setMissionPhase('SURVEY');
              }}
              className={clsx(
                'px-2 py-0.5 rounded font-mono text-[10px] transition-colors whitespace-nowrap border',
                activeTargetId === tgt.id
                  ? 'bg-amber-500/20 border-amber-400 text-amber-300 font-semibold'
                  : 'bg-slate-900 border-slate-700 text-slate-400 hover:text-slate-200'
              )}
            >
              {tgt.code}
            </button>
          ))}
        </div>
      </div>

      {/* =================================================================== */}
      {/* HUD OVERLAYS (LEFT AVIONICS + VIRTUAL STICK, RIGHT TELEMETRY, DECK) */}
      {/* =================================================================== */}
      {showHud && (
        <>
          {/* LEFT AVIONICS STACK */}
          <div className="absolute top-24 left-4 z-20 flex flex-col gap-2.5 pointer-events-auto max-w-[230px]">
            {/* Platform Identification */}
            <div className="pointer-events-none drop-shadow-[0_2px_8px_rgba(0,0,0,0.75)]">
              <p className="text-[10px] font-mono uppercase tracking-[0.18em] text-emerald-300 font-semibold">
                • DRDO / ADE · MALE UAV
              </p>
              <h2 className="text-2xl font-serif font-bold tracking-wider text-white">
                TAPAS-BH-201
              </h2>
              <p className="text-[10px] text-slate-300">
                Rustom-II Twin-Rotax Digital Twin
              </p>
            </div>

            {/* Active Target & Survey Progress Card */}
            <div className="w-[200px] bg-[#090e17]/92 backdrop-blur-md border border-slate-700/80 rounded-xl p-2.5 shadow-xl">
              <div className="flex items-center justify-between text-[10px] font-mono">
                <span className="text-slate-400">MODE:</span>
                <span className="text-emerald-400 font-bold">
                  {flightMode === 'manual' ? 'MANUAL STICK' : missionPhase}
                </span>
              </div>
              <div className="flex items-center justify-between text-[10px] font-mono mt-1">
                <span className="text-slate-400">LOCK:</span>
                <span className="text-amber-300 truncate ml-2">
                  {activeTarget.name}
                </span>
              </div>
              <div className="mt-1.5">
                <div className="flex justify-between text-[9px] font-mono text-slate-400 mb-0.5">
                  <span>EO/IR RECON SCAN</span>
                  <span className="text-cyan-400 tabular-nums">
                    {flightAttitude.surveyProgressPct.toFixed(0)}%
                  </span>
                </div>
                <div className="w-full h-1.5 bg-slate-800 rounded-full overflow-hidden">
                  <div
                    className="h-full bg-emerald-400 transition-all duration-150"
                    style={{ width: `${flightAttitude.surveyProgressPct}%` }}
                  />
                </div>
              </div>
            </div>

            {/* PRIMARY FLIGHT DISPLAY (PFD) */}
            <div className="w-[200px] bg-[#090e17]/92 backdrop-blur-md border border-slate-700/80 rounded-xl p-2.5 shadow-xl">
              <div className="text-center border-b border-slate-800 pb-1 mb-1.5 flex items-center justify-between px-1">
                <span className="text-[10px] font-mono font-semibold text-emerald-400">
                  HDG {flightAttitude.heading.toFixed(0).padStart(3, '0')}°
                </span>
                <span className="text-[9px] font-mono text-slate-400">
                  {gearDown ? 'GEAR DN' : 'GEAR UP'}
                </span>
              </div>

              <div className="grid grid-cols-3 gap-1 items-center h-24">
                <div className="flex flex-col items-center justify-center border-r border-slate-800 pr-1">
                  <span className="text-[8px] font-mono text-slate-400">
                    AIRSPEED
                  </span>
                  <span className="text-lg font-mono font-bold text-white tabular-nums mt-0.5">
                    {flightAttitude.airspeedKt}
                  </span>
                  <span className="text-[9px] font-mono text-emerald-400">
                    KT IAS
                  </span>
                  <span className="text-[8px] font-mono text-slate-500 mt-0.5 tabular-nums">
                    {airspeedKmh} km/h
                  </span>
                </div>

                <div className="relative h-full w-full bg-slate-950 rounded overflow-hidden border border-slate-800 flex items-center justify-center">
                  <div
                    className="w-20 h-20 flex flex-col items-center justify-center transition-transform duration-75"
                    style={{
                      transform: `rotate(${flightAttitude.rollDeg.toFixed(
                        1
                      )}deg) translateY(${(
                        flightAttitude.pitchDeg * 1.8
                      ).toFixed(1)}px)`,
                    }}
                  >
                    <div className="w-8 h-px bg-emerald-500/60 mb-2" />
                    <div className="w-12 h-0.5 bg-amber-400" />
                    <div className="w-8 h-px bg-emerald-500/60 mt-2" />
                  </div>
                  <div className="absolute inset-x-2 h-0.5 bg-amber-400/90 pointer-events-none" />
                </div>

                <div className="flex flex-col items-center justify-center border-l border-slate-800 pl-1">
                  <span className="text-[8px] font-mono text-slate-400">
                    ALTITUDE
                  </span>
                  <span className="text-sm font-mono font-bold text-white tabular-nums mt-0.5">
                    {flightAttitude.altitudeFt}
                  </span>
                  <span className="text-[8px] font-mono text-emerald-400">
                    FT MSL
                  </span>
                  <span className="text-[8px] font-mono text-amber-400 mt-0.5 tabular-nums">
                    AGL: {flightAttitude.aglM}m
                  </span>
                </div>
              </div>
            </div>

            {/* INTERACTIVE VIRTUAL FLIGHT STICK (DRAG TO PITCH & ROLL DRONE!) */}
            <div className="w-[200px] bg-[#090e17]/92 backdrop-blur-md border border-slate-700/80 rounded-xl p-2.5 shadow-xl">
              <div className="flex items-center justify-between text-[9px] font-mono text-slate-400 mb-1.5">
                <span className="text-cyan-400 font-semibold">
                  INTERACTIVE FLIGHT YOKE
                </span>
                <button
                  onClick={() => {
                    setManualPitch(0);
                    setManualRoll(0);
                    setManualYaw(0);
                  }}
                  className="text-slate-400 hover:text-white underline"
                >
                  Center
                </button>
              </div>

              <div
                ref={stickPadRef}
                onMouseDown={(e) => {
                  setIsDraggingStick(true);
                  updateStickFromMouse(e.clientX, e.clientY);
                }}
                onMouseMove={(e) => {
                  if (isDraggingStick) {
                    updateStickFromMouse(e.clientX, e.clientY);
                  }
                }}
                onMouseUp={() => setIsDraggingStick(false)}
                onMouseLeave={() => setIsDraggingStick(false)}
                className="relative w-full h-24 bg-slate-950 border border-slate-800 rounded-lg cursor-crosshair flex items-center justify-center overflow-hidden"
              >
                <div className="absolute inset-x-0 h-px bg-slate-800" />
                <div className="absolute inset-y-0 w-px bg-slate-800" />
                <div className="w-12 h-12 rounded-full border border-slate-800/80" />

                {/* Draggable Stick Puck */}
                <div
                  className="w-4 h-4 rounded-full bg-emerald-400 border-2 border-white shadow-[0_0_10px_#10b981] pointer-events-none"
                  style={{
                    transform: `translate(${(manualRoll * 65).toFixed(
                      1
                    )}px, ${(-manualPitch * 36).toFixed(1)}px)`,
                  }}
                />
              </div>

              <div className="flex justify-between text-[9px] font-mono text-slate-400 mt-1.5">
                <span>PITCH: {(manualPitch * 15).toFixed(1)}°</span>
                <span>BANK: {(manualRoll * 30).toFixed(1)}°</span>
              </div>
            </div>
          </div>

          {/* ================================================================= */}
          {/* RIGHT-SIDE 18-CHANNEL ROTAX 914 UL/F TELEMETRY PANEL              */}
          {/* ================================================================= */}
          <div className="absolute top-24 right-4 bottom-3 z-20 w-[330px] flex flex-col gap-2 pointer-events-auto">
            <div className="grid grid-cols-2 gap-2">
              <button
                onClick={() => setSelectedEngine('port')}
                className={clsx(
                  'py-2 px-3 rounded-lg text-xs font-mono font-semibold tracking-wider border transition-colors',
                  selectedEngine === 'port'
                    ? 'bg-emerald-600 text-white border-emerald-400 shadow-lg'
                    : 'bg-[#090e17]/90 text-slate-300 border-slate-700 hover:bg-slate-800'
                )}
              >
                PORT ENGINE (L)
              </button>
              <button
                onClick={() => setSelectedEngine('stbd')}
                className={clsx(
                  'py-2 px-3 rounded-lg text-xs font-mono font-semibold tracking-wider border transition-colors',
                  selectedEngine === 'stbd'
                    ? 'bg-emerald-600 text-white border-emerald-400 shadow-lg'
                    : 'bg-[#090e17]/90 text-slate-300 border-slate-700 hover:bg-slate-800'
                )}
              >
                STARBOARD (R)
              </button>
            </div>

            <div className="flex-1 bg-[#090e17]/92 backdrop-blur-md border border-slate-700/80 rounded-xl p-3.5 flex flex-col justify-between overflow-y-auto shadow-2xl">
              <div>
                <div className="flex items-center justify-between border-b border-slate-800 pb-2 mb-2.5">
                  <div>
                    <span className="text-xs font-mono font-bold text-white tracking-wider block">
                      {selectedEngine === 'port'
                        ? 'PORT ROTAX 914 UL/F'
                        : 'STBD ROTAX 914 UL/F'}
                    </span>
                    <span className="text-[10px] font-mono text-emerald-400">
                      18 CHANNELS · V5 MODEL
                    </span>
                  </div>
                  {onOpenEngineLab && (
                    <button
                      onClick={onOpenEngineLab}
                      className="px-2.5 py-1 rounded-md bg-emerald-600/25 hover:bg-emerald-600/40 border border-emerald-500/60 text-emerald-300 text-[10px] font-mono font-semibold transition-colors"
                    >
                      Open 3D CAD Lab ↗
                    </button>
                  )}
                </div>

                <div className="space-y-1.5 text-[11px] font-mono">
                  <TelemetryRow
                    label="Cylinder Head Temp (CHT)"
                    value={`${chtVal.toFixed(1)} °C`}
                    valueClass={
                      chtVal > 245
                        ? 'text-rose-400 font-bold'
                        : 'text-emerald-400'
                    }
                  />
                  <TelemetryRow
                    label="Exhaust Gas Temp (EGT)"
                    value={`${egtVal.toFixed(1)} °C`}
                    valueClass={
                      egtVal > 850 ? 'text-amber-400 font-bold' : 'text-slate-100'
                    }
                  />
                  <TelemetryRow
                    label="Engine Oil Temperature"
                    value={`${oilTempVal.toFixed(1)} °C`}
                    valueClass={
                      oilTempVal > 115
                        ? 'text-rose-400 font-bold'
                        : 'text-slate-100'
                    }
                  />
                  <TelemetryRow
                    label="Manifold Pressure (MAP)"
                    value={`${mapVal.toFixed(1)} kPa`}
                  />
                  <TelemetryRow
                    label="Throttle Command"
                    value={`${activeThrottle.toFixed(1)} %`}
                  />
                  <TelemetryRow
                    label="Fuel Flow Rate"
                    value={`${fuelFlowLh.toFixed(1)} L/h`}
                  />
                  <TelemetryRow
                    label="Fuel Consumption"
                    value={`${fuelConsKgH.toFixed(2)} kg/h`}
                  />
                  <TelemetryRow
                    label="Oxygen Sensor (Lambda λ)"
                    value={lambdaVal.toFixed(3)}
                  />
                  <TelemetryRow
                    label="Efficiency / Timing"
                    value={`${efficiencyPct.toFixed(1)}% (${timingDeg}° BTDC)`}
                  />
                  <TelemetryRow
                    label="Engine RPM"
                    value={`${rotaxRpm.toFixed(1)} RPM`}
                  />
                  <TelemetryRow
                    label="Oil / Fuel Pressure"
                    value={`${oilPressKpa.toFixed(1)} kPa / ${oilPressPsi.toFixed(
                      1
                    )} psi`}
                  />
                  <TelemetryRow
                    label="Oil TAN Degradation"
                    value={`${oilTan.toFixed(2)} mg KOH/g`}
                  />
                  <TelemetryRow
                    label="Vibration RMS (X)"
                    value={`${vibX.toFixed(3)} g RMS`}
                  />
                  <TelemetryRow
                    label="Vibration RMS (Y)"
                    value={`${vibY.toFixed(3)} g RMS`}
                  />
                  <TelemetryRow
                    label="Vibration RMS (Z)"
                    value={`${vibZ.toFixed(3)} g RMS`}
                  />
                  <TelemetryRow
                    label="Exhaust Backpressure"
                    value={`${exhaustBackpressure.toFixed(1)} kPa`}
                  />
                  <TelemetryRow
                    label="Main DC Bus Voltage"
                    value={`${mainBusVoltage.toFixed(2)} V`}
                    valueClass={
                      mainBusVoltage < 25
                        ? 'text-rose-400 font-bold'
                        : 'text-emerald-400'
                    }
                  />
                </div>
              </div>

              <div className="mt-3 pt-2.5 border-t border-slate-800">
                <div className="flex items-center justify-between text-[10px] font-mono text-slate-400 mb-1">
                  <span>AIRFRAME BUS POWER</span>
                  <span className="text-emerald-400">SHARED CHASSIS</span>
                </div>
                <div className="flex items-center justify-between text-xs font-mono mb-2.5">
                  <span className="text-slate-300">Main DC Bus Voltage</span>
                  <span className="text-emerald-400 font-bold tabular-nums">
                    {mainBusVoltage.toFixed(2)} V
                  </span>
                </div>

                <div className="grid grid-cols-2 gap-2">
                  <button
                    onClick={handleExportJSON}
                    className="py-1.5 px-2 bg-slate-900 hover:bg-slate-800 border border-slate-700 rounded text-[11px] font-mono text-slate-200 flex items-center justify-center gap-1.5 transition-colors"
                  >
                    <Download className="w-3 h-3 text-emerald-400" />
                    Export JSON
                  </button>
                  <button
                    onClick={handleExportCSV}
                    className="py-1.5 px-2 bg-slate-900 hover:bg-slate-800 border border-slate-700 rounded text-[11px] font-mono text-slate-200 flex items-center justify-center gap-1.5 transition-colors"
                  >
                    <Download className="w-3 h-3 text-cyan-400" />
                    Export CSV
                  </button>
                </div>
              </div>
            </div>
          </div>

          {/* ================================================================= */}
          {/* BOTTOM 4-PANEL FLIGHT & PHYSICAL FAULT CONTROL DECK               */}
          {/* ================================================================= */}
          <div className="absolute bottom-3 left-4 right-[352px] z-20 grid grid-cols-1 xl:grid-cols-12 gap-2.5 pointer-events-auto">
            {/* 1. FLIGHT CONTROLS (PORT / STBD THROTTLE) */}
            <div className="xl:col-span-3 bg-[#090e17]/92 backdrop-blur-md border border-slate-700/80 rounded-xl p-3 flex flex-col justify-between">
              <div className="flex items-center justify-between">
                <span className="text-[10px] font-mono font-semibold uppercase tracking-wider text-slate-300">
                  FLIGHT CONTROLS
                </span>
                <label className="flex items-center gap-1.5 text-[10px] font-mono text-emerald-400 cursor-pointer">
                  <input
                    type="checkbox"
                    checked={linkThrottles}
                    onChange={(e) => setLinkThrottles(e.target.checked)}
                    className="accent-emerald-500 rounded"
                  />
                  Link L/R
                </label>
              </div>

              <div className="grid grid-cols-2 gap-3 mt-2">
                <div>
                  <div className="flex justify-between text-[10px] font-mono mb-1">
                    <span className="text-slate-400">PORT:</span>
                    <span className="text-emerald-400 font-semibold tabular-nums">
                      {portThrottle}%
                    </span>
                  </div>
                  <input
                    type="range"
                    min={20}
                    max={100}
                    value={portThrottle}
                    onChange={(e) => {
                      const val = Number(e.target.value);
                      setPortThrottle(val);
                      if (linkThrottles) setStbdThrottle(val);
                    }}
                    className="w-full accent-emerald-500 cursor-pointer"
                  />
                </div>

                <div>
                  <div className="flex justify-between text-[10px] font-mono mb-1">
                    <span className="text-slate-400">STBD:</span>
                    <span className="text-emerald-400 font-semibold tabular-nums">
                      {stbdThrottle}%
                    </span>
                  </div>
                  <input
                    type="range"
                    min={20}
                    max={100}
                    value={stbdThrottle}
                    onChange={(e) => {
                      const val = Number(e.target.value);
                      setStbdThrottle(val);
                      if (linkThrottles) setPortThrottle(val);
                    }}
                    className="w-full accent-emerald-500 cursor-pointer"
                  />
                </div>
              </div>
            </div>

            {/* 2. SIMULATION & RELAY */}
            <div className="xl:col-span-3 bg-[#090e17]/92 backdrop-blur-md border border-slate-700/80 rounded-xl p-3 flex flex-col justify-between">
              <span className="text-[10px] font-mono font-semibold uppercase tracking-wider text-slate-300">
                SIMULATION & RELAY
              </span>
              <div className="grid grid-cols-3 gap-1.5 mt-2">
                <button
                  onClick={() => setPaused((p) => !p)}
                  className={clsx(
                    'py-1.5 px-2 rounded border text-[11px] font-mono flex items-center justify-center gap-1 transition-colors',
                    paused
                      ? 'bg-amber-600/30 border-amber-500 text-amber-200'
                      : 'bg-slate-900 border-slate-700 text-slate-200 hover:bg-slate-800'
                  )}
                >
                  {paused ? (
                    <Play className="w-3 h-3" />
                  ) : (
                    <Pause className="w-3 h-3" />
                  )}
                  {paused ? 'Resume' : 'Pause'}
                </button>
                <button
                  onClick={() => setMuteTx((m) => !m)}
                  className={clsx(
                    'py-1.5 px-2 rounded border text-[11px] font-mono flex items-center justify-center gap-1 transition-colors',
                    muteTx
                      ? 'bg-rose-600/30 border-rose-500 text-rose-200'
                      : 'bg-slate-900 border-slate-700 text-slate-200 hover:bg-slate-800'
                  )}
                >
                  {muteTx ? (
                    <VolumeX className="w-3 h-3" />
                  ) : (
                    <Volume2 className="w-3 h-3" />
                  )}
                  Mute Tx
                </button>
                <button
                  onClick={resetSimulation}
                  className="py-1.5 px-2 rounded border border-slate-700 bg-slate-900 hover:bg-slate-800 text-[11px] font-mono text-slate-200 flex items-center justify-center gap-1 transition-colors"
                >
                  <RotateCcw className="w-3 h-3" />
                  Reset
                </button>
              </div>
            </div>

            {/* 3. PHYSICAL FAULT SCENARIOS */}
            <div className="xl:col-span-4 bg-[#090e17]/92 backdrop-blur-md border border-slate-700/80 rounded-xl p-3 flex flex-col justify-between">
              <div className="flex items-center justify-between mb-1.5">
                <span className="text-[10px] font-mono font-semibold uppercase tracking-wider text-slate-300">
                  PHYSICAL FAULT SCENARIOS
                </span>
                <span
                  className={clsx(
                    'text-[10px] font-mono font-bold px-2 py-0.5 rounded',
                    activeFaultObj
                      ? 'bg-rose-600 text-white'
                      : 'bg-emerald-600 text-white'
                  )}
                >
                  {activeFaultObj
                    ? activeFaultObj.label.toUpperCase()
                    : 'NOMINAL'}
                </span>
              </div>

              <div className="grid grid-cols-4 gap-1.5">
                {PHYSICAL_FAULTS.map((fault) => {
                  const isActive = activeFaultId === fault.id;
                  return (
                    <button
                      key={fault.id}
                      onClick={() => triggerPhysicalFault(fault)}
                      className={clsx(
                        'py-1 px-1.5 rounded border text-[10px] font-mono truncate transition-colors',
                        isActive
                          ? 'bg-rose-600/40 border-rose-400 text-white font-semibold'
                          : 'bg-slate-900/90 border-slate-700/80 text-slate-300 hover:border-slate-500 hover:text-white'
                      )}
                    >
                      {fault.label}
                    </button>
                  );
                })}
              </div>
            </div>

            {/* 4. KEYBOARD & MOUSE CONTROLS */}
            <div className="xl:col-span-2 bg-[#090e17]/92 backdrop-blur-md border border-slate-700/80 rounded-xl p-3 flex flex-col justify-between">
              <span className="text-[10px] font-mono font-semibold uppercase tracking-wider text-slate-300">
                HOTKEYS & MOUSE
              </span>
              <div className="text-[10px] font-mono text-slate-400 space-y-1 mt-1">
                <div>
                  <span className="text-slate-200 font-semibold">W S</span> Pitch{' '}
                  <span className="text-slate-200 font-semibold">A D</span> Roll{' '}
                  <span className="text-slate-200 font-semibold">Q E</span> Yaw
                </div>
                <div>
                  <span className="text-slate-200 font-semibold">Drag</span> 360°{' '}
                  <span className="text-slate-200 font-semibold">1-6</span> Cam{' '}
                  <span className="text-slate-200 font-semibold">G</span> Gear
                </div>
              </div>
            </div>
          </div>
        </>
      )}
    </div>
  );
}

function TopBarBtn({
  active,
  onClick,
  label,
}: {
  active: boolean;
  onClick: () => void;
  label: string;
}) {
  return (
    <button
      onClick={onClick}
      className={clsx(
        'px-2.5 py-1 rounded font-medium transition-colors whitespace-nowrap',
        active
          ? 'bg-emerald-600 text-white shadow-sm'
          : 'text-slate-200 hover:bg-white/10'
      )}
    >
      {label}
    </button>
  );
}

function TelemetryRow({
  label,
  value,
  valueClass = 'text-slate-100',
}: {
  label: string;
  value: string;
  valueClass?: string;
}) {
  return (
    <div className="flex items-center justify-between py-0.5 border-b border-slate-800/60">
      <span className="text-slate-400 truncate pr-2">{label}</span>
      <span className={clsx('tabular-nums shrink-0', valueClass)}>{value}</span>
    </div>
  );
}
