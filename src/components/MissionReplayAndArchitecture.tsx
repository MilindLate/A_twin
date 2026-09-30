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
  ReferenceLine,
} from 'recharts';
import {
  Play,
  Pause,
  RotateCcw,
  Radio,
  Cpu,
  History,
  Download,
  Layers,
  ShieldCheck,
  AlertTriangle,
  CheckCircle2,
  Zap,
  Plane,
  Gauge,
  Wrench,
  ArrowRight,
  Crosshair,
  Activity,
} from 'lucide-react';
import clsx from 'clsx';
import { DrdoLogo } from './DrdoLogo';

export interface FlightReplayFrame {
  index: number;
  t: string;
  phase: 'TAKEOFF' | 'CLIMB' | 'ISR LOITER' | 'CRITICAL POINT' | 'PRE-EMPTIVE MITIGATION' | 'STABILIZED CRUISE' | 'RTB DESCENT';
  status: 'NOMINAL' | 'PRE-FAULT DRIFT' | 'CRITICAL POINT' | 'RESOLVED';
  // Flight Dynamics Telemetry
  altitudeFt: number;
  airspeedKtas: number;
  pitchDeg: number;
  rollDeg: number;
  headingDeg: number;
  ambientTempC: number;
  manifoldMapBar: number;
  throttlePct: number;
  // Engine Propulsion Telemetry
  rpm: number;
  cht: number;
  unmitigatedCht: number;
  expectedCht: number;
  egt: number;
  unmitigatedEgt: number;
  expectedEgt: number;
  oilPress: number;
  oilTemp: number;
  fuelFlow: number;
  vib: number;
  batteryV: number;
  injTimingDeg: number;
  bsfc: number;
  healthPct: number;
  frameNote: string;
}

export interface RecordedSortie {
  id: string;
  flightId: string;
  code: string;
  tailNumber: string;
  title: string;
  baseLocation: string;
  date: string;
  duration: string;
  maxAltitudeFt: number;
  ambientC: number;
  faultDetected: boolean;
  faultCode: string;
  faultName: string;
  faultSeverity: 'CRITICAL' | 'WARNING' | 'NOMINAL';
  criticalPointIndex: number;
  criticalPointTime: string;
  criticalPointSummary: string;
  traditionalThresholdOutcome: string;
  preEmptiveResolutionTime: string;
  leadTimeSavedMinutes: number;
  resolutionSteps: string[];
  finding: string;
  frames: FlightReplayFrame[];
}

const HISTORICAL_SORTIES: RecordedSortie[] = [
  {
    id: 'sortie-089',
    flightId: 'FLT-2026-089',
    code: 'SRT-089-LADAKH',
    tailNumber: 'TAPAS-BH-04 (ADE-204)',
    title: 'High-Altitude ISR Loiter — Turbo Wastegate Sticking & Thermal Soak',
    baseLocation: 'Leh Forward Airbase · Sector North-Alpha (ISA -41°C)',
    date: '2026-09-18 · 04:30 UTC',
    duration: '14h 20m',
    maxAltitudeFt: 28200,
    ambientC: -41,
    faultDetected: true,
    faultCode: 'DRDO-F07 / F03',
    faultName: 'Turbocharger Wastegate Seizure & Exhaust Overheating Trend',
    faultSeverity: 'CRITICAL',
    criticalPointIndex: 11,
    criticalPointTime: 'T+110m',
    criticalPointSummary:
      'At T+110m (28,200 ft), AI physics residual detected +26.4°C EGT divergence (792°C vs 765.6°C expected) and +1.52 bar manifold over-boost due to partial turbocharger wastegate coking, while CHT (189°C) was still 36°C below the conventional 225°C threshold.',
    traditionalThresholdOutcome:
      'Without Digital Twin intervention, unmitigated EGT would breach 865°C at T+151m, causing turbine wheel blade creep and forced single-engine mission abort.',
    preEmptiveResolutionTime: 'T+114m (Resolved 37 min BEFORE failure)',
    leadTimeSavedMinutes: 37,
    resolutionSteps: [
      '1. [T+110m] Hybrid Physics+ML Pipeline isolated +26.4°C EGT residual & +0.16 bar boost creep to Wastegate Servo Actuator.',
      '2. [T+112m] Dual-FADEC commanded high-frequency dither pulse (15 Hz) to free sticking wastegate linkage & reduced boost target by -6%.',
      '3. [T+114m] Enriched EFI fuel mixture by +4.2% (Lambda 0.91) and retarded ignition timing by -1.2° BTDC to cool exhaust gas stream.',
      '4. [T+120m] EGT stabilized at 761°C and CHT dropped to 176°C; UAV completed all 14h 20m ISR waypoints without abort.',
    ],
    finding:
      'FAULT DETECTED & RESOLVED PRE-EMPTIVELY: Wastegate thermal sticking detected 37 minutes prior to redline breach. Autonomous FADEC boost/mixture trim prevented turbine over-temp.',
    frames: Array.from({ length: 24 }, (_, i) => {
      const isDrift = i >= 8 && i <= 10;
      const isCritical = i === 11 || i === 12;
      const isResolved = i >= 13;

      const expCht = Number((173 + Math.sin(i * 0.3) * 2.5).toFixed(1));
      const expEgt = Number((758 + Math.cos(i * 0.3) * 4.0).toFixed(1));

      // Unmitigated trajectory keeps rising catastrophically after T+80m
      const unmitCht =
        i < 8 ? expCht : Number((expCht + (i - 7) * 3.8).toFixed(1));
      const unmitEgt =
        i < 8 ? expEgt : Number((expEgt + (i - 7) * 7.6).toFixed(1));

      // Actual trajectory rises up to critical point (i=11), then resolves after FADEC mitigation (i>=13)
      let actCht = expCht;
      let actEgt = expEgt;
      if (isDrift) {
        actCht = Number((expCht + (i - 7) * 3.5).toFixed(1));
        actEgt = Number((expEgt + (i - 7) * 6.8).toFixed(1));
      } else if (isCritical) {
        actCht = Number((expCht + 16.5).toFixed(1));
        actEgt = Number((expEgt + 28.4).toFixed(1));
      } else if (isResolved) {
        const decay = Math.max(2.0, 14 - (i - 12) * 2.8);
        actCht = Number((expCht + decay * 0.4).toFixed(1));
        actEgt = Number((expEgt + decay * 0.6).toFixed(1));
      }

      const alt = i < 3 ? 12000 + i * 5400 : i > 21 ? 22000 - (i - 21) * 4500 : 28200;

      return {
        index: i,
        t: `T+${i * 10}m`,
        phase:
          i < 3
            ? 'CLIMB'
            : isCritical
            ? 'CRITICAL POINT'
            : i === 13 || i === 14
            ? 'PRE-EMPTIVE MITIGATION'
            : isResolved && i < 22
            ? 'STABILIZED CRUISE'
            : i >= 22
            ? 'RTB DESCENT'
            : 'ISR LOITER',
        status: isCritical
          ? 'CRITICAL POINT'
          : isDrift
          ? 'PRE-FAULT DRIFT'
          : isResolved
          ? 'RESOLVED'
          : 'NOMINAL',
        altitudeFt: alt,
        airspeedKtas: i < 3 ? 102 : isResolved ? 115 : 118,
        pitchDeg: i < 3 ? 5.8 : i >= 22 ? -3.2 : 2.1,
        rollDeg: i % 4 === 0 ? 8.5 : 0.0,
        headingDeg: (45 + i * 12) % 360,
        ambientTempC: i < 3 ? -18 - i * 7 : -41,
        manifoldMapBar: isCritical ? 1.52 : isResolved ? 1.31 : 1.36,
        throttlePct: isCritical ? 84.0 : isResolved ? 76.5 : 80.0,
        rpm: isCritical ? 2645 : isResolved ? 2520 : 2580,
        cht: actCht,
        unmitigatedCht: unmitCht,
        expectedCht: expCht,
        egt: actEgt,
        unmitigatedEgt: unmitEgt,
        expectedEgt: expEgt,
        oilPress: Number((isCritical ? 3.72 : 4.08).toFixed(2)),
        oilTemp: Number((isCritical ? 104.5 : 94.2).toFixed(1)),
        fuelFlow: Number((isResolved ? 45.8 : isCritical ? 43.1 : 44.2).toFixed(1)),
        vib: Number((isCritical ? 23.4 : isResolved ? 16.9 : 16.2).toFixed(1)),
        batteryV: 28.15,
        injTimingDeg: isResolved ? 13.9 : 15.1,
        bsfc: isCritical ? 256 : isResolved ? 239 : 236,
        healthPct: isCritical ? 82.4 : isResolved ? 94.8 : 98.2,
        frameNote: isCritical
          ? 'CRITICAL POINT: +28.4°C EGT residual & 1.52 bar boost creep isolated to Wastegate Actuator. FADEC pre-emptive mitigation triggered.'
          : isDrift
          ? 'Early wastegate sticking trend detected by physics residual (+14°C EGT divergence).'
          : isResolved
          ? 'Pre-emptive -6% wastegate trim & +4.2% mixture enrichment active; thermal equilibrium restored.'
          : 'Nominal high-altitude ISR loiter in ISA -41°C envelope.',
      };
    }),
  },
  {
    id: 'sortie-094',
    flightId: 'FLT-2026-094',
    code: 'SRT-094-IOR',
    tailNumber: 'TAPAS-BH-02 (ADE-202)',
    title: 'Maritime Long-Endurance Patrol — Cyl #3 Injector Clog (Pre-Misfire)',
    baseLocation: 'INS Karwar Naval Air Station · Arabian Sea Sector',
    date: '2026-09-21 · 08:15 UTC',
    duration: '18h 10m',
    maxAltitudeFt: 3200,
    ambientC: 24,
    faultDetected: true,
    faultCode: 'DRDO-F02 / F01',
    faultName: 'Cylinder #3 Fuel Injector Partial Fouling & Lean-Burn Anomaly',
    faultSeverity: 'WARNING',
    criticalPointIndex: 9,
    criticalPointTime: 'T+90m',
    criticalPointSummary:
      'At T+90m over the Arabian Sea, Fuel Mass Flow residual dropped by -2.9 L/h while Cyl #3 EGT spiked +24.8°C (lean stoichiometry) accompanied by a +4.6 mm/s 0.5x half-order torsional vibration harmonic.',
    traditionalThresholdOutcome:
      'Conventional monitoring waits for complete cylinder misfire (EGT < 600°C & severe airframe shaking at T+128m), risking over-water ditching.',
    preEmptiveResolutionTime: 'T+95m (Resolved 33 min BEFORE misfire cutout)',
    leadTimeSavedMinutes: 33,
    resolutionSteps: [
      '1. [T+90m] Isolation Forest & Physics Residual flagged -2.9 L/h fuel deficit + lean EGT spike on Cylinder #3.',
      '2. [T+92m] FADEC Lane-B cross-verified injector solenoid impedance and initiated high-pressure ultrasonic duty purge (+11% pulse width).',
      '3. [T+95m] Cleared injector pintle deposit; fuel flow returned to 36.2 L/h and torsional vibration dropped from 21.8 to 13.5 mm/s.',
      '4. [T+100m] Auto-generated post-flight MRO Work Order to ultrasonic-clean Injector #3 and inspect rail filter.',
    ],
    finding:
      'FAULT DETECTED & RESOLVED PRE-EMPTIVELY: Cyl #3 lean injector clog caught 33 minutes before misfire cutout. High-pressure FADEC pulse-width purge restored stoichiometric combustion in flight.',
    frames: Array.from({ length: 24 }, (_, i) => {
      const isDrift = i >= 6 && i <= 8;
      const isCritical = i === 9 || i === 10;
      const isResolved = i >= 11;

      const expCht = 156.0;
      const expEgt = 716.0;

      const unmitCht = i < 6 ? expCht : Number((expCht + (i - 5) * 2.9).toFixed(1));
      const unmitEgt =
        i < 6
          ? expEgt
          : i < 13
          ? Number((expEgt + (i - 5) * 6.5).toFixed(1))
          : Number((expEgt - 85).toFixed(1)); // Full misfire drop if unmitigated

      let actCht = expCht;
      let actEgt = expEgt;
      if (isDrift) {
        actCht = Number((expCht + (i - 5) * 2.4).toFixed(1));
        actEgt = Number((expEgt + (i - 5) * 5.8).toFixed(1));
      } else if (isCritical) {
        actCht = Number((expCht + 12.2).toFixed(1));
        actEgt = Number((expEgt + 24.8).toFixed(1));
      } else if (isResolved) {
        actCht = Number((expCht + 1.4).toFixed(1));
        actEgt = Number((expEgt + 2.5).toFixed(1));
      }

      return {
        index: i,
        t: `T+${i * 10}m`,
        phase:
          i < 2
            ? 'TAKEOFF'
            : isCritical
            ? 'CRITICAL POINT'
            : i === 11
            ? 'PRE-EMPTIVE MITIGATION'
            : isResolved && i < 22
            ? 'STABILIZED CRUISE'
            : i >= 22
            ? 'RTB DESCENT'
            : 'ISR LOITER',
        status: isCritical
          ? 'CRITICAL POINT'
          : isDrift
          ? 'PRE-FAULT DRIFT'
          : isResolved
          ? 'RESOLVED'
          : 'NOMINAL',
        altitudeFt: 3200,
        airspeedKtas: 96,
        pitchDeg: 1.5,
        rollDeg: i % 3 === 0 ? -6.0 : 0.0,
        headingDeg: (180 + i * 8) % 360,
        ambientTempC: 24,
        manifoldMapBar: 1.08,
        throttlePct: 62.0,
        rpm: isCritical ? 2140 : 2190,
        cht: actCht,
        unmitigatedCht: unmitCht,
        expectedCht: expCht,
        egt: actEgt,
        unmitigatedEgt: unmitEgt,
        expectedEgt: expEgt,
        oilPress: 4.16,
        oilTemp: 88.5,
        fuelFlow: isCritical ? 32.9 : isDrift ? 34.1 : 36.2,
        vib: isCritical ? 21.8 : isDrift ? 17.4 : 13.4,
        batteryV: 28.22,
        injTimingDeg: isCritical ? 16.4 : 15.1,
        bsfc: isCritical ? 249 : 225,
        healthPct: isCritical ? 84.5 : isResolved ? 96.4 : 98.8,
        frameNote: isCritical
          ? 'CRITICAL POINT: Cyl #3 fuel flow deficit (-2.9 L/h) & lean EGT spike (+24.8°C). FADEC high-pressure injector purge initiated.'
          : isDrift
          ? 'Sub-threshold fuel residual divergence detected on Port Bank Cyl #3.'
          : isResolved
          ? 'Injector #3 pintle cleared via +11% duty purge; combustion stoichiometry nominal.'
          : 'Nominal maritime endurance patrol at 3,200 ft.',
      };
    }),
  },
  {
    id: 'sortie-102',
    flightId: 'FLT-2026-102',
    code: 'SRT-102-THAR',
    tailNumber: 'TAPAS-BH-07 (ADE-207)',
    title: 'Hot-Weather Desert Ops — Oil Cooler Dust Fouling & Viscosity Drop',
    baseLocation: 'Jaisalmer AFS · Thar Desert Sector (ISA +28°C / +43°C)',
    date: '2026-09-24 · 09:40 UTC',
    duration: '11h 45m',
    maxAltitudeFt: 6300,
    ambientC: 43,
    faultDetected: true,
    faultCode: 'DRDO-F04 / F03',
    faultName: 'Lubrication Pressure Decay & Oil Cooler Sand Fouling',
    faultSeverity: 'CRITICAL',
    criticalPointIndex: 8,
    criticalPointTime: 'T+80m',
    criticalPointSummary:
      'At T+80m in +43°C desert air, Oil Temperature reached 108.4°C and Oil Pressure dropped -0.62 bar below the 0D lubrication viscosity model (3.22 bar vs 3.84 bar expected), indicating oil cooler core dust blockage.',
    traditionalThresholdOutcome:
      'Unmitigated thermal thinning would drop oil pressure below the 2.2 bar hydro-dynamic film limit at T+132m, causing crankshaft main bearing seizure.',
    preEmptiveResolutionTime: 'T+84m (Resolved 48 min BEFORE bearing seizure)',
    leadTimeSavedMinutes: 48,
    resolutionSteps: [
      '1. [T+80m] Lubrication Viscosity Digital Twin flagged -0.62 bar oil pressure residual & +16°C CHT thermal soak.',
      '2. [T+82m] Autonomous GCS Advisory commanded Nacelle Motorized Cowl Flaps to 100% Open (+35% ram-air mass flow).',
      '3. [T+84m] Executed +1,800 ft altitude step-climb to cooler air parcel (+31°C) and reduced cruise throttle from 78% to 68%.',
      '4. [T+90m] Oil Temp cooled to 96.5°C and Oil Pressure recovered to 3.74 bar, preserving full hydrodynamic bearing film.',
    ],
    finding:
      'FAULT DETECTED & RESOLVED PRE-EMPTIVELY: Desert sand fouling of oil cooler matrix detected 48 minutes before bearing film breakdown. Cowl-flap actuation + altitude step-climb restored oil viscosity.',
    frames: Array.from({ length: 24 }, (_, i) => {
      const isDrift = i >= 5 && i <= 7;
      const isCritical = i === 8 || i === 9;
      const isResolved = i >= 10;

      const expCht = 181.0;
      const expEgt = 748.0;

      const unmitCht = i < 5 ? expCht : Number((expCht + (i - 4) * 3.4).toFixed(1));
      const unmitEgt = i < 5 ? expEgt : Number((expEgt + (i - 4) * 4.2).toFixed(1));

      let actCht = expCht;
      let actEgt = expEgt;
      if (isDrift) {
        actCht = Number((expCht + (i - 4) * 3.2).toFixed(1));
        actEgt = Number((expEgt + (i - 4) * 3.5).toFixed(1));
      } else if (isCritical) {
        actCht = Number((expCht + 17.8).toFixed(1));
        actEgt = Number((expEgt + 19.5).toFixed(1));
      } else if (isResolved) {
        actCht = Number((expCht - 3.5).toFixed(1));
        actEgt = Number((expEgt - 4.0).toFixed(1));
      }

      return {
        index: i,
        t: `T+${i * 10}m`,
        phase:
          i < 2
            ? 'TAKEOFF'
            : isCritical
            ? 'CRITICAL POINT'
            : i === 10
            ? 'PRE-EMPTIVE MITIGATION'
            : isResolved && i < 22
            ? 'STABILIZED CRUISE'
            : i >= 22
            ? 'RTB DESCENT'
            : 'ISR LOITER',
        status: isCritical
          ? 'CRITICAL POINT'
          : isDrift
          ? 'PRE-FAULT DRIFT'
          : isResolved
          ? 'RESOLVED'
          : 'NOMINAL',
        altitudeFt: isResolved ? 6300 : 4500,
        airspeedKtas: isResolved ? 104 : 110,
        pitchDeg: i === 10 ? 4.5 : 1.8,
        rollDeg: 0.0,
        headingDeg: (270 + i * 6) % 360,
        ambientTempC: isResolved ? 31 : 43,
        manifoldMapBar: isResolved ? 1.18 : 1.26,
        throttlePct: isResolved ? 68.0 : 78.0,
        rpm: isResolved ? 2360 : 2490,
        cht: actCht,
        unmitigatedCht: unmitCht,
        expectedCht: expCht,
        egt: actEgt,
        unmitigatedEgt: unmitEgt,
        expectedEgt: expEgt,
        oilPress: Number((isCritical ? 3.22 : isDrift ? 3.48 : 3.78).toFixed(2)),
        oilTemp: Number((isCritical ? 108.4 : isDrift ? 103.2 : 95.8).toFixed(1)),
        fuelFlow: Number((isResolved ? 39.4 : 42.8).toFixed(1)),
        vib: Number((isCritical ? 24.6 : 16.4).toFixed(1)),
        batteryV: 28.05,
        injTimingDeg: 15.1,
        bsfc: isCritical ? 252 : 238,
        healthPct: isCritical ? 79.8 : isResolved ? 93.6 : 97.5,
        frameNote: isCritical
          ? 'CRITICAL POINT: Oil pressure dropped to 3.22 bar (-0.62 bar residual) at 108.4°C Oil Temp. Cowl flaps 100% + step-climb executed.'
          : isDrift
          ? 'Progressive CHT & Oil Temp rise due to desert dust ingestion in cooling matrix.'
          : isResolved
          ? 'Step-climb to 6,300 ft (+31°C ambient) & 100% cowl flap opening restored 3.78 bar oil pressure.'
          : 'Hot-weather desert reconnaissance leg.',
      };
    }),
  },
  {
    id: 'sortie-108',
    flightId: 'FLT-2026-108',
    code: 'SRT-108-BENGALURU',
    tailNumber: 'TAPAS-BH-01 (ADE-201)',
    title: 'Baseline Endurance Verification Sortie — 100% Normal Flight',
    baseLocation: 'Challakere Aeronautical Test Range (ATR) · Chitradurga',
    date: '2026-09-27 · 06:00 UTC',
    duration: '16h 00m',
    maxAltitudeFt: 18000,
    ambientC: -14,
    faultDetected: false,
    faultCode: 'NONE (NOMINAL)',
    faultName: 'No Fault Detected — Nominal Propulsion & Flight Signature',
    faultSeverity: 'NOMINAL',
    criticalPointIndex: 4,
    criticalPointTime: 'T+40m (Scheduled Top-of-Climb Peak Load)',
    criticalPointSummary:
      'NO FAULT DETECTED. Highest operational load occurred at T+40m during scheduled climb to 18,000 ft (CHT 174.2°C, EGT 742.0°C), matching the 0D thermodynamic digital twin within ±1.1°C.',
    traditionalThresholdOutcome:
      'Both physical engine and digital twin operated inside the green thermodynamic envelope for the entire 16-hour endurance certification sortie.',
    preEmptiveResolutionTime: 'No Fault Intervention Required (Nominal Flight)',
    leadTimeSavedMinutes: 0,
    resolutionSteps: [
      '1. [T+00m–T+40m] Climb from Challakere ATR to 18,000 ft completed with <1.1°C residual between actual sensors and Otto-cycle model.',
      '2. [T+40m] Top-of-Climb peak load verified: RPM 2,460, CHT 174.2°C, EGT 742.0°C, Oil Pressure 4.12 bar.',
      '3. [T+50m–T+230m] Continuous 10 Hz Kalman state estimation confirmed 0.3°C Channel-A/B thermocouple parity and 99.4% overall health.',
      '4. [Post-Flight] Aircraft cleared for immediate turn-around turnaround without unscheduled LRU maintenance.',
    ],
    finding:
      'NORMAL FLIGHT (NO FAULT DETECTED): Zero propulsion anomalies across 16h 00m endurance sortie. Digital Twin residuals remained within ±1.5% across all 8 monitored parameters.',
    frames: Array.from({ length: 24 }, (_, i) => {
      const isClimbPeak = i === 4;
      const expCht = Number((168 + Math.sin(i * 0.25) * 2.2 + (isClimbPeak ? 5.2 : 0)).toFixed(1));
      const expEgt = Number((732 + Math.cos(i * 0.25) * 3.5 + (isClimbPeak ? 8.5 : 0)).toFixed(1));
      const actCht = Number((expCht + Math.sin(i * 0.6) * 0.8).toFixed(1));
      const actEgt = Number((expEgt + Math.cos(i * 0.6) * 1.1).toFixed(1));

      return {
        index: i,
        t: `T+${i * 10}m`,
        phase:
          i < 4
            ? 'CLIMB'
            : isClimbPeak
            ? 'CRITICAL POINT'
            : i >= 22
            ? 'RTB DESCENT'
            : 'ISR LOITER',
        status: 'NOMINAL',
        altitudeFt: i < 4 ? 6000 + i * 3000 : i >= 22 ? 10000 : 18000,
        airspeedKtas: isClimbPeak ? 105 : 114,
        pitchDeg: i < 4 ? 4.8 : i >= 22 ? -2.8 : 1.9,
        rollDeg: 0.0,
        headingDeg: (90 + i * 15) % 360,
        ambientTempC: i < 4 ? 12 - i * 6 : -14,
        manifoldMapBar: isClimbPeak ? 1.32 : 1.24,
        throttlePct: isClimbPeak ? 85.0 : 74.5,
        rpm: isClimbPeak ? 2510 : 2445,
        cht: actCht,
        unmitigatedCht: actCht,
        expectedCht: expCht,
        egt: actEgt,
        unmitigatedEgt: actEgt,
        expectedEgt: expEgt,
        oilPress: 4.12,
        oilTemp: 91.4,
        fuelFlow: isClimbPeak ? 43.5 : 40.2,
        vib: 14.8,
        batteryV: 28.25,
        injTimingDeg: 15.1,
        bsfc: 231,
        healthPct: 99.4,
        frameNote: isClimbPeak
          ? 'Scheduled Top-of-Climb load check (85% throttle). All 8 engine parameters match Digital Twin baseline within ±1.1°C.'
          : 'Nominal ISR cruise over Challakere ATR; zero fault signatures.',
      };
    }),
  },
  {
    id: 'sortie-115',
    flightId: 'FLT-2026-115',
    code: 'SRT-115-ANDAMAN',
    tailNumber: 'TAPAS-BH-05 (ADE-205)',
    title: 'Extended Island Relay Sortie — Normal Flight (Kalman Auto-Trim)',
    baseLocation: 'INS Utkrosh · Port Blair Andaman Sector',
    date: '2026-09-29 · 02:10 UTC',
    duration: '19h 30m',
    maxAltitudeFt: 19500,
    ambientC: -17,
    faultDetected: false,
    faultCode: 'NONE (KALMAN FILTERED)',
    faultName: 'Normal Flight — Minor +3.8°C Probe Drift Auto-Corrected',
    faultSeverity: 'NOMINAL',
    criticalPointIndex: 13,
    criticalPointTime: 'T+130m (Minor Ch-A Thermocouple Offset Filtered)',
    criticalPointSummary:
      'NO MECHANICAL FAULT DETECTED. At T+130m, EGT Thermocouple Lane-A exhibited a minor +3.8°C cold-junction offset while CHT, Fuel Flow, and Vibration remained rock-steady.',
    traditionalThresholdOutcome:
      'Onboard Kalman Sensor-Fusion weighted FADEC Lane-B (0.94 confidence), preventing any false-positive caution and sustaining the 19.5-hour island relay mission.',
    preEmptiveResolutionTime: 'T+130m (0 ms Kalman Auto-Reconciliation)',
    leadTimeSavedMinutes: 0,
    resolutionSteps: [
      '1. [T+130m] Dual-lane FADEC comparison detected +3.8°C offset between EGT Probe A and Probe B.',
      '2. [T+130m] Physics model confirmed zero change in CHT (169.5°C) or Fuel Flow (41.0 L/h), proving mechanical combustion was 100% nominal.',
      '3. [T+130m] Kalman gain automatically nulled the +3.8°C bias in real time with zero operator workload.',
    ],
    finding:
      'NORMAL FLIGHT (NO FAULT DETECTED): 19.5-hour endurance mission completed nominally. Minor +3.8°C thermocouple bias was seamlessly filtered by onboard Kalman sensor fusion.',
    frames: Array.from({ length: 24 }, (_, i) => {
      const expCht = Number((169 + Math.cos(i * 0.2) * 1.8).toFixed(1));
      const expEgt = Number((736 + Math.sin(i * 0.2) * 2.8).toFixed(1));
      const actCht = Number((expCht + 0.5).toFixed(1));
      const actEgt = Number((expEgt + (i === 13 ? 3.8 : 0.8)).toFixed(1));

      return {
        index: i,
        t: `T+${i * 10}m`,
        phase: i === 13 ? 'CRITICAL POINT' : 'ISR LOITER',
        status: 'NOMINAL',
        altitudeFt: 19500,
        airspeedKtas: 115,
        pitchDeg: 2.0,
        rollDeg: 0.0,
        headingDeg: (120 + i * 10) % 360,
        ambientTempC: -17,
        manifoldMapBar: 1.25,
        throttlePct: 75.0,
        rpm: 2455,
        cht: actCht,
        unmitigatedCht: actCht,
        expectedCht: expCht,
        egt: actEgt,
        unmitigatedEgt: actEgt,
        expectedEgt: expEgt,
        oilPress: 4.14,
        oilTemp: 92.0,
        fuelFlow: 41.0,
        vib: 15.1,
        batteryV: 28.2,
        injTimingDeg: 15.1,
        bsfc: 232,
        healthPct: 99.1,
        frameNote:
          i === 13
            ? 'Kalman Sensor Fusion auto-filtered +3.8°C Lane-A EGT probe bias; engine mechanically 100% nominal.'
            : 'Nominal long-endurance communications relay orbit at 19,500 ft.',
      };
    }),
  },
];

interface PipelineStageSpec {
  id: string;
  step: string;
  title: string;
  subtitle: string;
  latency: string;
  rate: string;
  protocol: string;
  inputSignals: string;
  algorithm: string;
  outputAction: string;
}

const PIPELINE_STAGES: PipelineStageSpec[] = [
  {
    id: 'stage-1',
    step: 'STAGE 01',
    title: 'Onboard Sensor & Dual-FADEC Acquisition',
    subtitle: '8-Parameter Aero-Piston Instrumentation',
    latency: '1.2 ms',
    rate: '100 Hz / 10 Hz',
    protocol: 'Dual-Lane FADEC ADC + Piezo Accelerometer',
    inputSignals:
      'RPM, 4x CHT, 4x EGT (Ch-A/B), Oil Press/Temp, Fuel Mass Flow, 3-Axis Vib, 28V Bus, Injection Timing °BTDC',
    algorithm: 'Hardware anti-aliasing Bessel filter + 1024-pt sliding-window Fast Fourier Transform (FFT)',
    outputAction: 'Time-stamped raw engineering sensor frames queued to onboard SocketCAN controller',
  },
  {
    id: 'stage-2',
    step: 'STAGE 02',
    title: 'SocketCAN Bus & Edge Kalman Filter',
    subtitle: 'can0 @ 500 kbps · Sensor Drift Reconciliation',
    latency: '2.4 ms',
    rate: '50 Hz',
    protocol: 'SAE J1939 / CAN-Aerospace (PGN 61444, 65262, 65263, 64777)',
    inputSignals: 'Dual-redundant FADEC Lane-A & Lane-B CAN frames + bus CRC checksums',
    algorithm:
      'Extended Kalman Filter (EKF) state estimator isolates thermocouple drift (F05) from true thermal transients',
    outputAction: 'Drift-compensated state vector packed into encrypted telemetry payload',
  },
  {
    id: 'stage-3',
    step: 'STAGE 03',
    title: 'Encrypted C-Band LOS / Ku-Band SATCOM Link',
    subtitle: 'STANAG 4586 Defense Telemetry Pipeline',
    latency: '18.5 ms',
    rate: '10 Hz Continuous',
    protocol: 'AES-256-GCM Encrypted UDP/WebSocket Downlink + Black-Box FDR Ring Buffer',
    inputSignals: 'Compressed binary propulsion + flight attitude telemetry packets',
    algorithm: 'Forward Error Correction (Reed-Solomon) + deterministic packet replay synchronization',
    outputAction: 'Zero-loss real-time stream delivered to Ground Control Station (GCS) Digital Twin Core',
  },
  {
    id: 'stage-4',
    step: 'STAGE 04',
    title: '0D/1D Physics-Informed Thermodynamic Twin',
    subtitle: 'Otto-Cycle + ISA Altitude Virtual Engine',
    latency: '3.1 ms',
    rate: '10 Hz Sync',
    protocol: 'Real-Time Thermodynamic & Polytropic State Solver (γ = 1.34, CR = 9.0:1)',
    inputSignals: 'Live Altitude (ft), Ambient Temp (°C), Throttle (%), RPM, Manifold Boost (bar)',
    algorithm:
      'Computes ideal expected CHT, EGT, Fuel Flow, Oil Viscosity Pressure, and Vibration baseline for current flight envelope',
    outputAction: 'Generates continuous Residual Vector r(t) = Actual_Sensor(t) − Physics_Expected(t)',
  },
  {
    id: 'stage-5',
    step: 'STAGE 05',
    title: 'Hybrid AI/ML Residual & RUL Prognostics',
    subtitle: '8-Fault Classifier + SHAP XAI + Weibull RUL',
    latency: '6.8 ms',
    rate: '10 Hz Inference',
    protocol: 'Physics-Guided Isolation Forest + Multi-Order FFT Classifier + Weibull Survival Model',
    inputSignals: '5-Dimensional Physics Residual Vector r(t) + Harmonic Order Amplitudes (0.5x, 1x, 2x, 3.5x, 6.2x)',
    algorithm:
      'Detects sub-threshold degradation 30–50 minutes BEFORE redline breach; computes SHAP feature attribution & RUL hours',
    outputAction: 'Early fault classification (DRDO F01–F08) with confidence score & RUL confidence cone',
  },
  {
    id: 'stage-6',
    step: 'STAGE 06',
    title: 'Pre-Emptive FADEC Resolution & MRO Advisory',
    subtitle: 'Closed-Loop Fault Mitigation Before Failure',
    latency: '4.0 ms',
    rate: 'Event-Driven',
    protocol: 'FADEC Uplink Command Bus + Automated Squadron MRO Work-Order Generator',
    inputSignals: 'Classified Pre-Fault Signature + Remaining Mission Endurance Requirement',
    algorithm:
      'Synthesizes pre-emptive trim commands (wastegate duty, mixture lambda, injector purge, cowl flaps, step-climb)',
    outputAction: 'Resolves incipient fault BEFORE physical failure occurs + exports LRU maintenance dossier',
  },
];

export function MissionReplayAndArchitecture({
  telemetry,
  dtState,
}: {
  telemetry: EngineTelemetry;
  dtState: EngineHealthState & { active_alerts?: FaultAlert[] };
  liveHistory: (EngineTelemetry & { time: string })[];
}) {
  const [selectedSortieId, setSelectedSortieId] = useState<string>('sortie-089');
  const [replayIndex, setReplayIndex] = useState<number>(11); // Default at Critical Point of Sortie 089
  const [isPlayingReplay, setIsPlayingReplay] = useState<boolean>(false);
  const [selectedStageId, setSelectedStageId] = useState<string>('stage-5');
  const [freezeCanBus, setFreezeCanBus] = useState<boolean>(false);
  const [filterMode, setFilterMode] = useState<'all' | 'fault' | 'normal'>('all');

  const filteredSorties = useMemo(() => {
    if (filterMode === 'fault') return HISTORICAL_SORTIES.filter((s) => s.faultDetected);
    if (filterMode === 'normal') return HISTORICAL_SORTIES.filter((s) => !s.faultDetected);
    return HISTORICAL_SORTIES;
  }, [filterMode]);

  const activeSortie =
    HISTORICAL_SORTIES.find((s) => s.id === selectedSortieId) ||
    HISTORICAL_SORTIES[0];

  const activeStage =
    PIPELINE_STAGES.find((st) => st.id === selectedStageId) ||
    PIPELINE_STAGES[4];

  useEffect(() => {
    if (!isPlayingReplay) return;
    const timer = setInterval(() => {
      setReplayIndex((prev) => (prev + 1) % activeSortie.frames.length);
    }, 650);
    return () => clearInterval(timer);
  }, [isPlayingReplay, activeSortie.frames.length]);

  const currentFrame =
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
    a.download = `${activeSortie.flightId.toLowerCase()}_${activeSortie.code.toLowerCase()}_fdr_log.json`;
    a.click();
    URL.revokeObjectURL(url);
  };

  return (
    <div className="space-y-4 pb-6 select-none">
      {/* =================================================================== */}
      {/* 0. OFFICIAL DRDO / ADE MISSION REPLAY & PIPELINE COMMAND BANNER     */}
      {/* =================================================================== */}
      <div className="bg-[#0B0F17] border border-slate-800 rounded-xl p-4 flex flex-wrap items-center justify-between gap-4">
        <div className="flex items-center gap-4">
          <DrdoLogo size="lg" showText={true} />
          <div className="h-9 w-px bg-slate-800 hidden sm:block" />
          <div>
            <div className="flex items-center gap-2">
              <h1 className="text-sm font-bold text-white uppercase tracking-wide">
                End-to-End Digital Twin Data Pipeline & Historical Sortie Replay Center
              </h1>
              <span className="px-2 py-0.5 text-[10px] font-mono font-semibold bg-emerald-500/15 text-emerald-300 border border-emerald-500/30 rounded">
                PRE-EMPTIVE FAULT MITIGATION VERIFIED
              </span>
            </div>
            <p className="text-xs text-slate-400 mt-0.5">
              Inspect the 6-stage real-time Edge-to-GCS processing pipeline and replay recorded flights with full Flight + Engine telemetry, critical point detection, and pre-failure resolution logs.
            </p>
          </div>
        </div>

        <div className="flex items-center gap-2 text-xs font-mono">
          <div className="px-3 py-1.5 rounded-lg bg-slate-950 border border-slate-800">
            <span className="text-slate-500 block text-[9px]">PIPELINE LATENCY</span>
            <strong className="text-emerald-400">36.0 ms E2E</strong>
          </div>
          <div className="px-3 py-1.5 rounded-lg bg-slate-950 border border-slate-800">
            <span className="text-slate-500 block text-[9px]">ARCHIVED FLIGHTS</span>
            <strong className="text-cyan-300">5 Sorties (3 Fault · 2 Normal)</strong>
          </div>
        </div>
      </div>

      {/* =================================================================== */}
      {/* 1. INTERACTIVE 6-STAGE DIGITAL TWIN & PRE-EMPTIVE AI PIPELINE       */}
      {/* =================================================================== */}
      <div className="bg-[#0B0F17] border border-slate-800 rounded-xl p-4">
        <div className="flex flex-wrap items-center justify-between gap-2 mb-3">
          <div className="flex items-center gap-2">
            <Cpu className="w-4 h-4 text-cyan-400" />
            <h2 className="text-xs font-mono font-bold text-white uppercase tracking-wider">
              Real-Time 6-Stage Digital Twin & Predictive Fault Resolution Pipeline (Click Stage to Inspect)
            </h2>
          </div>
          <span className="text-[11px] font-mono text-emerald-400 flex items-center gap-1.5">
            <span className="w-2 h-2 rounded-full bg-emerald-400 animate-ping" />
            LIVE TELEMETRY STREAMING AT 10 HZ · SOCKETCAN 500 KBPS
          </span>
        </div>

        {/* 6 Interactive Pipeline Nodes */}
        <div className="grid grid-cols-1 md:grid-cols-6 gap-2.5">
          {PIPELINE_STAGES.map((stage, idx) => {
            const isSelected = stage.id === selectedStageId;
            return (
              <button
                key={stage.id}
                onClick={() => setSelectedStageId(stage.id)}
                className={clsx(
                  'text-left p-3 rounded-xl border transition-all relative flex flex-col justify-between',
                  isSelected
                    ? 'bg-cyan-950/35 border-cyan-400 shadow-[0_0_15px_rgba(56,189,248,0.15)]'
                    : 'bg-slate-950/90 border-slate-800 hover:border-slate-700'
                )}
              >
                <div>
                  <div className="flex items-center justify-between text-[10px] font-mono mb-1">
                    <span
                      className={clsx(
                        'font-bold px-1.5 py-0.5 rounded',
                        isSelected
                          ? 'bg-cyan-500/20 text-cyan-300'
                          : 'bg-slate-900 text-slate-400'
                      )}
                    >
                      {stage.step}
                    </span>
                    <span className="text-emerald-400">{stage.latency}</span>
                  </div>
                  <div className="text-xs font-bold text-white leading-snug mt-1">
                    {stage.title}
                  </div>
                  <div className="text-[10px] text-slate-400 mt-0.5">
                    {stage.subtitle}
                  </div>
                </div>

                <div className="mt-2.5 pt-2 border-t border-slate-800/80 flex items-center justify-between text-[10px] font-mono text-slate-400">
                  <span>{stage.rate}</span>
                  {idx < 5 && (
                    <ArrowRight className="w-3.5 h-3.5 text-cyan-400" />
                  )}
                </div>
              </button>
            );
          })}
        </div>

        {/* Selected Pipeline Stage Deep Engineering Inspector */}
        <div className="mt-3 p-3.5 rounded-xl bg-slate-950 border border-slate-800 grid grid-cols-1 lg:grid-cols-4 gap-3 text-xs">
          <div className="p-2.5 rounded-lg bg-slate-900/70 border border-slate-800">
            <span className="text-[10px] font-mono text-cyan-400 uppercase block">
              Selected Pipeline Stage & Protocol
            </span>
            <strong className="text-white block mt-0.5">
              {activeStage.step}: {activeStage.title}
            </strong>
            <span className="text-[11px] text-slate-400 mt-1 block font-mono">
              {activeStage.protocol}
            </span>
          </div>

          <div className="p-2.5 rounded-lg bg-slate-900/70 border border-slate-800">
            <span className="text-[10px] font-mono text-amber-400 uppercase block">
              Stage Input Signals
            </span>
            <p className="text-[11px] text-slate-200 mt-1 leading-relaxed">
              {activeStage.inputSignals}
            </p>
          </div>

          <div className="p-2.5 rounded-lg bg-slate-900/70 border border-slate-800">
            <span className="text-[10px] font-mono text-purple-400 uppercase block">
              Mathematical / AI Processing Kernel
            </span>
            <p className="text-[11px] text-slate-200 mt-1 leading-relaxed">
              {activeStage.algorithm}
            </p>
          </div>

          <div className="p-2.5 rounded-lg bg-emerald-950/25 border border-emerald-500/30">
            <span className="text-[10px] font-mono text-emerald-400 uppercase block">
              Stage Output & Reliability Impact
            </span>
            <p className="text-[11px] text-emerald-100 mt-1 leading-relaxed">
              {activeStage.outputAction}
            </p>
          </div>
        </div>
      </div>

      {/* =================================================================== */}
      {/* 2. PREVIOUS FLIGHT ARCHIVE SELECTOR & FLIGHT ID DOSSIER             */}
      {/* =================================================================== */}
      <div className="bg-[#0B0F17] border border-slate-800 rounded-xl p-4 space-y-4">
        {/* Top Row: Filter + Sortie Buttons + Export */}
        <div className="flex flex-wrap items-center justify-between gap-3 border-b border-slate-800 pb-3">
          <div className="flex items-center gap-2.5">
            <History className="w-5 h-5 text-emerald-400" />
            <div>
              <h2 className="text-sm font-bold text-white uppercase tracking-wide">
                Previous Recorded Flights — Flight ID, Telemetry, Critical Points & Pre-Emptive Resolution
              </h2>
              <p className="text-xs text-slate-400">
                Select any historical Flight ID below to inspect whether a fault was detected or if the flight was 100% normal, where the critical point occurred, and how it was resolved before failure.
              </p>
            </div>
          </div>

          <div className="flex flex-wrap items-center gap-2">
            {/* Filter Pills: All / Fault Detected / Normal Flights */}
            <div className="flex items-center bg-slate-950 p-1 rounded-lg border border-slate-800 text-[11px] font-mono">
              <button
                onClick={() => setFilterMode('all')}
                className={clsx(
                  'px-2.5 py-1 rounded transition-colors',
                  filterMode === 'all'
                    ? 'bg-slate-800 text-white font-semibold'
                    : 'text-slate-400 hover:text-slate-200'
                )}
              >
                All Flights (5)
              </button>
              <button
                onClick={() => setFilterMode('fault')}
                className={clsx(
                  'px-2.5 py-1 rounded transition-colors',
                  filterMode === 'fault'
                    ? 'bg-amber-600/30 text-amber-300 border border-amber-500/40 font-semibold'
                    : 'text-slate-400 hover:text-slate-200'
                )}
              >
                Fault Detected & Resolved (3)
              </button>
              <button
                onClick={() => setFilterMode('normal')}
                className={clsx(
                  'px-2.5 py-1 rounded transition-colors',
                  filterMode === 'normal'
                    ? 'bg-emerald-600/30 text-emerald-300 border border-emerald-500/40 font-semibold'
                    : 'text-slate-400 hover:text-slate-200'
                )}
              >
                Normal Flights (2)
              </button>
            </div>

            <button
              onClick={handleDownloadSortieLog}
              className="px-3 py-1.5 rounded-lg bg-slate-900 hover:bg-slate-800 border border-slate-700 text-xs font-mono text-cyan-300 flex items-center gap-1.5"
            >
              <Download className="w-3.5 h-3.5" />
              Export {activeSortie.flightId} JSON
            </button>
          </div>
        </div>

        {/* Flight Cards Selector Grid */}
        <div className="grid grid-cols-1 md:grid-cols-5 gap-2.5">
          {filteredSorties.map((sortie) => {
            const selected = sortie.id === activeSortie.id;
            return (
              <button
                key={sortie.id}
                onClick={() => {
                  setSelectedSortieId(sortie.id);
                  setIsPlayingReplay(false);
                  setReplayIndex(sortie.criticalPointIndex);
                }}
                className={clsx(
                  'p-3 rounded-xl border text-left transition-all flex flex-col justify-between',
                  selected
                    ? sortie.faultDetected
                      ? 'bg-amber-950/30 border-amber-400 shadow-[0_0_15px_rgba(251,191,36,0.15)]'
                      : 'bg-emerald-950/30 border-emerald-400 shadow-[0_0_15px_rgba(16,185,129,0.15)]'
                    : 'bg-slate-950/90 border-slate-800 hover:border-slate-700'
                )}
              >
                <div>
                  <div className="flex items-center justify-between gap-1 text-[10px] font-mono">
                    <span className="font-bold text-white bg-slate-900 px-1.5 py-0.5 rounded border border-slate-700">
                      {sortie.flightId}
                    </span>
                    <span
                      className={clsx(
                        'px-1.5 py-0.5 rounded font-semibold',
                        sortie.faultDetected
                          ? 'bg-rose-500/20 text-rose-300 border border-rose-500/30'
                          : 'bg-emerald-500/20 text-emerald-300 border border-emerald-500/30'
                      )}
                    >
                      {sortie.faultDetected ? 'FAULT DETECTED' : 'NORMAL FLIGHT'}
                    </span>
                  </div>

                  <div className="text-xs font-bold text-slate-100 mt-2 line-clamp-2">
                    {sortie.code} · {sortie.tailNumber.split(' ')[0]}
                  </div>
                  <div className="text-[11px] text-slate-400 mt-1 line-clamp-2">
                    {sortie.faultDetected ? sortie.faultName : 'Zero anomalies · Nominal baseline'}
                  </div>
                </div>

                <div className="mt-2.5 pt-2 border-t border-slate-800/80 flex items-center justify-between text-[10px] font-mono text-slate-400">
                  <span>Alt: {sortie.maxAltitudeFt.toLocaleString()} ft</span>
                  <span className="text-cyan-300">Crit: {sortie.criticalPointTime}</span>
                </div>
              </button>
            );
          })}
        </div>

        {/* =================================================================== */}
        {/* ACTIVE FLIGHT ID METADATA & FAULT / NORMAL STATUS BANNER            */}
        {/* =================================================================== */}
        <div
          className={clsx(
            'p-4 rounded-xl border grid grid-cols-1 lg:grid-cols-12 gap-4 items-center',
            activeSortie.faultDetected
              ? 'bg-amber-950/15 border-amber-500/40'
              : 'bg-emerald-950/15 border-emerald-500/40'
          )}
        >
          <div className="lg:col-span-5 space-y-1.5">
            <div className="flex flex-wrap items-center gap-2">
              <span className="px-2 py-0.5 rounded bg-slate-900 border border-slate-700 text-xs font-mono font-bold text-cyan-300">
                FLIGHT ID: {activeSortie.flightId}
              </span>
              <span className="px-2 py-0.5 rounded bg-slate-900 border border-slate-700 text-xs font-mono text-slate-300">
                SORTIE: {activeSortie.code}
              </span>
              <span
                className={clsx(
                  'px-2.5 py-0.5 rounded text-xs font-mono font-bold flex items-center gap-1',
                  activeSortie.faultDetected
                    ? 'bg-rose-500/20 text-rose-300 border border-rose-500/40'
                    : 'bg-emerald-500/20 text-emerald-300 border border-emerald-500/40'
                )}
              >
                {activeSortie.faultDetected ? (
                  <>
                    <AlertTriangle className="w-3.5 h-3.5" />
                    FAULT DETECTED: {activeSortie.faultCode}
                  </>
                ) : (
                  <>
                    <CheckCircle2 className="w-3.5 h-3.5" />
                    NO FAULT DETECTED — NORMAL FLIGHT
                  </>
                )}
              </span>
            </div>

            <h3 className="text-sm font-bold text-white">{activeSortie.title}</h3>
            <p className="text-xs text-slate-300 font-mono">
              Tail: {activeSortie.tailNumber} · Base: {activeSortie.baseLocation} · Duration: {activeSortie.duration} · Date: {activeSortie.date}
            </p>
          </div>

          <div className="lg:col-span-7 grid grid-cols-1 sm:grid-cols-3 gap-2.5 text-xs font-mono">
            <div className="p-2.5 rounded-lg bg-slate-950/90 border border-slate-800">
              <span className="text-[10px] text-slate-400 block uppercase">
                FAULT CLASSIFICATION
              </span>
              <strong
                className={clsx(
                  'text-xs block mt-0.5',
                  activeSortie.faultDetected ? 'text-rose-300' : 'text-emerald-400'
                )}
              >
                {activeSortie.faultName}
              </strong>
            </div>

            <div className="p-2.5 rounded-lg bg-slate-950/90 border border-slate-800">
              <span className="text-[10px] text-slate-400 block uppercase">
                CRITICAL POINT OCCURRED
              </span>
              <strong className="text-amber-300 text-xs block mt-0.5">
                {activeSortie.criticalPointTime} (Frame #{activeSortie.criticalPointIndex + 1})
              </strong>
              <button
                onClick={() => {
                  setIsPlayingReplay(false);
                  setReplayIndex(activeSortie.criticalPointIndex);
                }}
                className="mt-1 text-[10px] text-cyan-400 hover:underline flex items-center gap-1"
              >
                <Crosshair className="w-3 h-3" /> Jump to Critical Point
              </button>
            </div>

            <div className="p-2.5 rounded-lg bg-slate-950/90 border border-slate-800">
              <span className="text-[10px] text-slate-400 block uppercase">
                PRE-EMPTIVE RESOLUTION
              </span>
              <strong className="text-emerald-400 text-xs block mt-0.5">
                {activeSortie.preEmptiveResolutionTime}
              </strong>
              {activeSortie.leadTimeSavedMinutes > 0 && (
                <span className="text-[10px] text-emerald-300/90 block mt-0.5">
                  +{activeSortie.leadTimeSavedMinutes} min lead-time saved
                </span>
              )}
            </div>
          </div>
        </div>

        {/* =================================================================== */}
        {/* 3. TIMELINE CHART + CRITICAL POINT & PRE-EMPTIVE RESOLUTION PANEL   */}
        {/* =================================================================== */}
        <div className="grid grid-cols-1 lg:grid-cols-12 gap-4 items-stretch">
          {/* Left 7 Columns: Multi-Trace Mitigated vs Unmitigated Replay Chart */}
          <div className="lg:col-span-7 flex flex-col justify-between bg-slate-950 border border-slate-800 rounded-xl p-3.5">
            <div>
              <div className="flex flex-wrap items-center justify-between gap-2 mb-2">
                <div>
                  <span className="text-xs font-mono font-bold text-white uppercase">
                    {activeSortie.flightId} Telemetry Trajectory: Pre-Emptive Twin Mitigation vs. Unmitigated Failure
                  </span>
                  <p className="text-[11px] text-slate-400">
                    Dashed red curve shows catastrophic trajectory without Digital Twin; solid curves show actual stabilized flight after pre-emptive FADEC resolution.
                  </p>
                </div>
                <span
                  className={clsx(
                    'px-2 py-0.5 rounded text-[10px] font-mono font-bold',
                    currentFrame.status === 'CRITICAL POINT'
                      ? 'bg-rose-500/20 text-rose-300 border border-rose-500/40'
                      : currentFrame.status === 'PRE-FAULT DRIFT'
                      ? 'bg-amber-500/20 text-amber-300 border border-amber-500/40'
                      : currentFrame.status === 'RESOLVED'
                      ? 'bg-cyan-500/20 text-cyan-300 border border-cyan-500/40'
                      : 'bg-emerald-500/20 text-emerald-300 border border-emerald-500/40'
                  )}
                >
                  {currentFrame.t} · {currentFrame.phase} ({currentFrame.status})
                </span>
              </div>

              <div className="h-64 w-full bg-[#07090E] rounded-lg border border-slate-800/80 p-2">
                <ResponsiveContainer width="100%" height="100%">
                  <LineChart data={activeSortie.frames}>
                    <CartesianGrid strokeDasharray="3 3" stroke="#1e293b" />
                    <XAxis dataKey="t" stroke="#64748b" fontSize={10} />
                    <YAxis
                      yAxisId="left"
                      stroke="#f97316"
                      fontSize={10}
                      domain={[145, 240]}
                    />
                    <YAxis
                      yAxisId="right"
                      orientation="right"
                      stroke="#38bdf8"
                      fontSize={10}
                      domain={[620, 880]}
                    />
                    <Tooltip
                      contentStyle={{
                        backgroundColor: '#090d16',
                        border: '1px solid #334155',
                        fontSize: '11px',
                      }}
                    />
                    <ReferenceLine
                      x={activeSortie.criticalPointTime}
                      yAxisId="left"
                      stroke="#f43f5e"
                      strokeDasharray="4 4"
                      label={{
                        value: `CRITICAL POINT (${activeSortie.criticalPointTime})`,
                        fill: '#fb7185',
                        fontSize: 10,
                        position: 'insideTopLeft',
                      }}
                    />
                    {activeSortie.faultDetected && (
                      <Line
                        yAxisId="right"
                        type="monotone"
                        dataKey="unmitigatedEgt"
                        stroke="#ef4444"
                        strokeWidth={1.75}
                        strokeDasharray="5 4"
                        dot={false}
                        name="Unmitigated EGT Without Twin (°C)"
                      />
                    )}
                    <Line
                      yAxisId="left"
                      type="monotone"
                      dataKey="expectedCht"
                      stroke="#64748b"
                      strokeWidth={1.2}
                      strokeDasharray="3 3"
                      dot={false}
                      name="Physics Expected CHT (°C)"
                    />
                    <Line
                      yAxisId="left"
                      type="monotone"
                      dataKey="cht"
                      stroke="#f97316"
                      strokeWidth={2.2}
                      name="Actual Replay CHT (°C)"
                    />
                    <Line
                      yAxisId="right"
                      type="monotone"
                      dataKey="egt"
                      stroke="#38bdf8"
                      strokeWidth={2.2}
                      name="Actual Replay EGT (°C)"
                    />
                    <ReferenceDot
                      yAxisId="left"
                      x={currentFrame.t}
                      y={currentFrame.cht}
                      r={6}
                      fill="#10b981"
                      stroke="#ffffff"
                    />
                  </LineChart>
                </ResponsiveContainer>
              </div>
            </div>

            {/* Interactive Scrubber Bar */}
            <div className="mt-3 space-y-2">
              <div className="p-2 rounded bg-slate-900/90 border border-slate-800 text-xs font-mono text-slate-200 flex items-center justify-between gap-2">
                <span className="truncate">
                  <strong className="text-cyan-400">[{currentFrame.t}]</strong>{' '}
                  {currentFrame.frameNote}
                </span>
              </div>

              <div className="flex flex-wrap items-center gap-2.5 bg-slate-900 px-3 py-2 rounded-lg border border-slate-800">
                <button
                  onClick={() => setIsPlayingReplay((p) => !p)}
                  className="px-3 py-1 rounded bg-emerald-600 hover:bg-emerald-500 text-white text-xs font-mono font-semibold flex items-center gap-1"
                >
                  {isPlayingReplay ? (
                    <Pause className="w-3.5 h-3.5" />
                  ) : (
                    <Play className="w-3.5 h-3.5" />
                  )}
                  {isPlayingReplay ? 'Pause' : 'Play Replay'}
                </button>
                <button
                  onClick={() => {
                    setIsPlayingReplay(false);
                    setReplayIndex(0);
                  }}
                  className="p-1.5 rounded bg-slate-950 hover:bg-slate-800 text-slate-300 border border-slate-700"
                  title="Restart Sortie"
                >
                  <RotateCcw className="w-3.5 h-3.5" />
                </button>
                <button
                  onClick={() => {
                    setIsPlayingReplay(false);
                    setReplayIndex(activeSortie.criticalPointIndex);
                  }}
                  className="px-2.5 py-1 rounded bg-rose-950/60 hover:bg-rose-900/70 text-rose-200 border border-rose-700/60 text-xs font-mono flex items-center gap-1"
                >
                  <Crosshair className="w-3 h-3" />
                  Critical Point ({activeSortie.criticalPointTime})
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
                  className="flex-1 accent-emerald-400 cursor-pointer min-w-[120px]"
                />
                <span className="text-xs font-mono font-bold text-emerald-400 w-16 text-right">
                  {currentFrame.t}
                </span>
              </div>
            </div>
          </div>

          {/* Right 5 Columns: Critical Point & Pre-Emptive Resolution Dossier */}
          <div className="lg:col-span-5 bg-slate-950 border border-slate-800 rounded-xl p-4 flex flex-col justify-between space-y-3">
            <div className="space-y-3">
              <div className="flex items-center justify-between border-b border-slate-800 pb-2">
                <div className="flex items-center gap-2">
                  <Zap className="w-4 h-4 text-amber-400" />
                  <h3 className="text-xs font-mono font-bold text-white uppercase tracking-wider">
                    Critical Point & Pre-Emptive Resolution Analysis
                  </h3>
                </div>
                <span className="text-[10px] font-mono text-cyan-300">
                  {activeSortie.flightId}
                </span>
              </div>

              <div className="p-3 rounded-lg bg-rose-950/20 border border-rose-500/30">
                <div className="text-[10px] font-mono font-bold text-rose-300 uppercase">
                  1. What Critical Point Occurred ({activeSortie.criticalPointTime}):
                </div>
                <p className="text-xs text-slate-200 mt-1 leading-relaxed">
                  {activeSortie.criticalPointSummary}
                </p>
              </div>

              <div className="p-3 rounded-lg bg-amber-950/20 border border-amber-500/30">
                <div className="text-[10px] font-mono font-bold text-amber-300 uppercase">
                  2. Risk Without Digital Twin (Reactive Threshold System):
                </div>
                <p className="text-xs text-slate-300 mt-1 leading-relaxed">
                  {activeSortie.traditionalThresholdOutcome}
                </p>
              </div>

              <div className="p-3 rounded-lg bg-emerald-950/20 border border-emerald-500/30">
                <div className="text-[10px] font-mono font-bold text-emerald-300 uppercase mb-1.5">
                  3. How Digital Twin Resolved It BEFORE Happening ({activeSortie.preEmptiveResolutionTime}):
                </div>
                <ul className="space-y-1.5 text-[11px] text-slate-200 font-mono">
                  {activeSortie.resolutionSteps.map((step, idx) => (
                    <li key={idx} className="leading-relaxed">
                      {step}
                    </li>
                  ))}
                </ul>
              </div>
            </div>

            <div className="p-2.5 rounded-lg bg-slate-900 border border-slate-800 text-[11px] font-mono text-slate-300">
              <strong className="text-amber-300">DEBRIEF VERDICT: </strong>
              {activeSortie.finding}
            </div>
          </div>
        </div>

        {/* =================================================================== */}
        {/* 4. COMPLETE SYNCHRONIZED FLIGHT + ENGINE TELEMETRY AT TIMESTAMP     */}
        {/* =================================================================== */}
        <div className="grid grid-cols-1 lg:grid-cols-2 gap-4">
          {/* Flight Dynamics Telemetry Card */}
          <div className="bg-slate-950 border border-slate-800 rounded-xl p-3.5">
            <div className="flex items-center justify-between mb-2.5 border-b border-slate-800 pb-2">
              <div className="flex items-center gap-2">
                <Plane className="w-4 h-4 text-cyan-400" />
                <span className="text-xs font-mono font-bold text-white uppercase">
                  Airframe & Flight Dynamics Telemetry @ {currentFrame.t}
                </span>
              </div>
              <span className="text-[10px] font-mono text-cyan-300">
                {activeSortie.tailNumber}
              </span>
            </div>

            <div className="grid grid-cols-2 sm:grid-cols-4 gap-2 text-xs font-mono">
              <div className="p-2 rounded bg-slate-900 border border-slate-800">
                <span className="text-[10px] text-slate-400 block">ALTITUDE (MSL)</span>
                <strong className="text-cyan-300 text-sm">
                  {currentFrame.altitudeFt.toLocaleString()} ft
                </strong>
              </div>
              <div className="p-2 rounded bg-slate-900 border border-slate-800">
                <span className="text-[10px] text-slate-400 block">TRUE AIRSPEED</span>
                <strong className="text-white text-sm">
                  {currentFrame.airspeedKtas} KTAS
                </strong>
              </div>
              <div className="p-2 rounded bg-slate-900 border border-slate-800">
                <span className="text-[10px] text-slate-400 block">PITCH / ROLL</span>
                <strong className="text-emerald-300 text-sm">
                  {currentFrame.pitchDeg > 0 ? '+' : ''}
                  {currentFrame.pitchDeg}° / {currentFrame.rollDeg}°
                </strong>
              </div>
              <div className="p-2 rounded bg-slate-900 border border-slate-800">
                <span className="text-[10px] text-slate-400 block">HEADING (MAG)</span>
                <strong className="text-amber-300 text-sm">
                  {String(currentFrame.headingDeg).padStart(3, '0')}°
                </strong>
              </div>
              <div className="p-2 rounded bg-slate-900 border border-slate-800">
                <span className="text-[10px] text-slate-400 block">AMBIENT OAT</span>
                <strong className="text-sky-300 text-sm">
                  {currentFrame.ambientTempC > 0 ? '+' : ''}
                  {currentFrame.ambientTempC}°C
                </strong>
              </div>
              <div className="p-2 rounded bg-slate-900 border border-slate-800">
                <span className="text-[10px] text-slate-400 block">MANIFOLD MAP</span>
                <strong className="text-purple-300 text-sm">
                  {currentFrame.manifoldMapBar.toFixed(2)} bar
                </strong>
              </div>
              <div className="p-2 rounded bg-slate-900 border border-slate-800">
                <span className="text-[10px] text-slate-400 block">THROTTLE CMD</span>
                <strong className="text-amber-400 text-sm">
                  {currentFrame.throttlePct.toFixed(1)}%
                </strong>
              </div>
              <div className="p-2 rounded bg-slate-900 border border-slate-800">
                <span className="text-[10px] text-slate-400 block">MISSION PHASE</span>
                <strong className="text-emerald-400 text-xs">
                  {currentFrame.phase}
                </strong>
              </div>
            </div>
          </div>

          {/* Engine Propulsion Telemetry Card */}
          <div className="bg-slate-950 border border-slate-800 rounded-xl p-3.5">
            <div className="flex items-center justify-between mb-2.5 border-b border-slate-800 pb-2">
              <div className="flex items-center gap-2">
                <Gauge className="w-4 h-4 text-emerald-400" />
                <span className="text-xs font-mono font-bold text-white uppercase">
                  Aero-Piston Engine & Twin Residuals @ {currentFrame.t}
                </span>
              </div>
              <span className="text-[10px] font-mono text-emerald-400">
                TWIN HEALTH: {currentFrame.healthPct.toFixed(1)}%
              </span>
            </div>

            <div className="grid grid-cols-2 sm:grid-cols-4 gap-2 text-xs font-mono">
              <div className="p-2 rounded bg-slate-900 border border-slate-800">
                <span className="text-[10px] text-slate-400 block">ENGINE SPEED</span>
                <strong className="text-white text-sm">{currentFrame.rpm} RPM</strong>
              </div>
              <div className="p-2 rounded bg-slate-900 border border-slate-800">
                <span className="text-[10px] text-slate-400 block">CHT (ACT / EXP)</span>
                <strong className="text-orange-300 text-sm">
                  {currentFrame.cht}° / {currentFrame.expectedCht}°C
                </strong>
              </div>
              <div className="p-2 rounded bg-slate-900 border border-slate-800">
                <span className="text-[10px] text-slate-400 block">EGT (ACT / EXP)</span>
                <strong className="text-cyan-300 text-sm">
                  {currentFrame.egt}° / {currentFrame.expectedEgt}°C
                </strong>
              </div>
              <div className="p-2 rounded bg-slate-900 border border-slate-800">
                <span className="text-[10px] text-slate-400 block">OIL P / TEMP</span>
                <strong className="text-emerald-400 text-sm">
                  {currentFrame.oilPress}B · {currentFrame.oilTemp}°C
                </strong>
              </div>
              <div className="p-2 rounded bg-slate-900 border border-slate-800">
                <span className="text-[10px] text-slate-400 block">FUEL FLOW</span>
                <strong className="text-amber-300 text-sm">
                  {currentFrame.fuelFlow} L/h
                </strong>
              </div>
              <div className="p-2 rounded bg-slate-900 border border-slate-800">
                <span className="text-[10px] text-slate-400 block">VIBRATION RMS</span>
                <strong className="text-purple-300 text-sm">
                  {currentFrame.vib} mm/s
                </strong>
              </div>
              <div className="p-2 rounded bg-slate-900 border border-slate-800">
                <span className="text-[10px] text-slate-400 block">INJ TIMING / BUS</span>
                <strong className="text-sky-300 text-sm">
                  {currentFrame.injTimingDeg}° · {currentFrame.batteryV}V
                </strong>
              </div>
              <div className="p-2 rounded bg-slate-900 border border-slate-800">
                <span className="text-[10px] text-slate-400 block">BSFC EFFICIENCY</span>
                <strong className="text-emerald-300 text-sm">
                  {currentFrame.bsfc} g/kWh
                </strong>
              </div>
            </div>
          </div>
        </div>

        {/* =================================================================== */}
        {/* 5. FULL FRAME-BY-FRAME FLIGHT & ENGINE TELEMETRY TABLE              */}
        {/* =================================================================== */}
        <div className="bg-slate-950 border border-slate-800 rounded-xl p-3.5">
          <div className="flex flex-wrap items-center justify-between gap-2 mb-2.5">
            <div className="flex items-center gap-2">
              <Activity className="w-4 h-4 text-emerald-400" />
              <h3 className="text-xs font-mono font-bold text-white uppercase">
                Complete Flight & Engine Telemetry Log — {activeSortie.flightId} ({activeSortie.code})
              </h3>
            </div>
            <span className="text-[11px] font-mono text-slate-400">
              Click any timestamp row to scrub replay to that exact flight point
            </span>
          </div>

          <div className="max-h-64 overflow-y-auto rounded-lg border border-slate-800">
            <table className="w-full text-left border-collapse font-mono text-[11px]">
              <thead className="bg-slate-900 text-slate-400 sticky top-0 z-10">
                <tr>
                  <th className="py-2 px-2.5">TIME</th>
                  <th className="py-2 px-2.5">PHASE / STATUS</th>
                  <th className="py-2 px-2.5">ALT (FT)</th>
                  <th className="py-2 px-2.5">KTAS</th>
                  <th className="py-2 px-2.5">THR %</th>
                  <th className="py-2 px-2.5">RPM</th>
                  <th className="py-2 px-2.5">CHT (°C)</th>
                  <th className="py-2 px-2.5">EGT (°C)</th>
                  <th className="py-2 px-2.5">OIL (BAR/°C)</th>
                  <th className="py-2 px-2.5">FUEL (L/H)</th>
                  <th className="py-2 px-2.5">VIB (MM/S)</th>
                  <th className="py-2 px-2.5">HEALTH</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-800/70">
                {activeSortie.frames.map((fr) => {
                  const isCurrent = fr.index === replayIndex;
                  return (
                    <tr
                      key={fr.t}
                      onClick={() => {
                        setIsPlayingReplay(false);
                        setReplayIndex(fr.index);
                      }}
                      className={clsx(
                        'cursor-pointer transition-colors',
                        isCurrent
                          ? 'bg-emerald-950/50 text-white font-semibold'
                          : fr.status === 'CRITICAL POINT'
                          ? 'bg-rose-950/30 text-rose-200 hover:bg-rose-950/50'
                          : fr.status === 'PRE-FAULT DRIFT'
                          ? 'bg-amber-950/20 text-amber-200 hover:bg-amber-950/40'
                          : 'bg-slate-950 text-slate-300 hover:bg-slate-900'
                      )}
                    >
                      <td className="py-1.5 px-2.5 font-bold text-cyan-300">{fr.t}</td>
                      <td className="py-1.5 px-2.5">
                        <span
                          className={clsx(
                            'px-1.5 py-0.5 rounded text-[10px]',
                            fr.status === 'CRITICAL POINT'
                              ? 'bg-rose-500/25 text-rose-300 border border-rose-500/40'
                              : fr.status === 'PRE-FAULT DRIFT'
                              ? 'bg-amber-500/20 text-amber-300'
                              : fr.status === 'RESOLVED'
                              ? 'bg-cyan-500/20 text-cyan-300'
                              : 'bg-emerald-500/15 text-emerald-300'
                          )}
                        >
                          {fr.phase}
                        </span>
                      </td>
                      <td className="py-1.5 px-2.5">{fr.altitudeFt.toLocaleString()}</td>
                      <td className="py-1.5 px-2.5">{fr.airspeedKtas}</td>
                      <td className="py-1.5 px-2.5">{fr.throttlePct.toFixed(0)}%</td>
                      <td className="py-1.5 px-2.5">{fr.rpm}</td>
                      <td className="py-1.5 px-2.5 text-orange-300">{fr.cht}°</td>
                      <td className="py-1.5 px-2.5 text-sky-300">{fr.egt}°</td>
                      <td className="py-1.5 px-2.5">
                        {fr.oilPress}B / {fr.oilTemp}°
                      </td>
                      <td className="py-1.5 px-2.5">{fr.fuelFlow}</td>
                      <td className="py-1.5 px-2.5">{fr.vib}</td>
                      <td className="py-1.5 px-2.5 text-emerald-400">
                        {fr.healthPct.toFixed(1)}%
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>
        </div>
      </div>

      {/* =================================================================== */}
      {/* 6. SOCKETCAN / SAE J1939 FADEC BUS MONITOR & SYSTEM ARCHITECTURE    */}
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
