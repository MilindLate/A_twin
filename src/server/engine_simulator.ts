import { EngineTelemetry, MissionProfileId } from "../types";

export class EngineSimulator {
  private missionProfile: MissionProfileId = "standard_isr";
  private baseRpm = 2450;
  private baseThrottle = 75; // 75%
  private altitude = 18000;
  private ambientTemp = -15; // C at 18k ft approx
  private tickCount = 0;
  
  private faults = {
    misfire: 0,
    injector_degradation: 0,
    lubrication_failure: 0,
    overheating: 0,
    sensor_drift: 0,
  };

  private state = {
    rpm: 2450,
    throttle: 75,
    altitude: 18000,
    ambientTemp: -15,
    oilTemp: 95,
    cht: 165,
    degradation: 0.0,
  };

  public setMissionProfile(profile: MissionProfileId) {
    const validProfiles: MissionProfileId[] = [
      "standard_isr",
      "high_altitude",
      "hot_weather",
      "rapid_throttle",
      "maritime_patrol",
    ];
    if (validProfiles.includes(profile)) {
      this.missionProfile = profile;
    }
  }

  public getMissionProfile(): MissionProfileId {
    return this.missionProfile;
  }

  public injectFault(type: string, severity: number) {
    if (this.faults.hasOwnProperty(type)) {
      (this.faults as any)[type] = severity;
    }
  }

  public clearFaults() {
    for (const key of Object.keys(this.faults)) {
      (this.faults as any)[key] = 0;
    }
  }

  // Generate noisy telemetry using basic physics assumptions + mission profiles + faults
  public tick(): EngineTelemetry {
    this.tickCount++;
    const tSec = this.tickCount * 0.1;

    // Add some random noise
    const noise = (scale: number) => (Math.random() - 0.5) * scale;

    // 1. Determine target environmental & operating point from active Mission Profile
    let targetThrottle = 75;
    let targetRpm = 2450;
    let targetAltitude = 18000;
    let targetAmbient = -15;
    let profileEgtOffset = 0;
    let profileChtOffset = 0;
    let profileOilTempOffset = 0;
    let profileOilPressOffset = 0;
    let profileVibOffset = 0;

    switch (this.missionProfile) {
      case "high_altitude":
        // 28,000 ft ISR ceiling: thin air reduces cooling mass flow, higher turbocharger work & EGT
        targetThrottle = 88;
        targetRpm = 2620;
        targetAltitude = 28000;
        targetAmbient = -41;
        profileEgtOffset = 32; // Higher exhaust temp from turbo backpressure & high power
        profileChtOffset = 14; // Reduced air density lowers convective cooling efficiency
        profileOilTempOffset = 8;
        profileVibOffset = 3;
        break;

      case "hot_weather":
        // Desert operations at 4,500 ft, +42°C ambient: severe thermal load on CHT & Oil
        targetThrottle = 78;
        targetRpm = 2490;
        targetAltitude = 4500;
        targetAmbient = 42;
        profileEgtOffset = 18;
        profileChtOffset = 26; // High ambient temp directly elevates CHT equilibrium
        profileOilTempOffset = 20; // Oil cooler saturation in hot air
        profileOilPressOffset = -0.45; // Lower oil viscosity at elevated oil temperature
        profileVibOffset = 2;
        break;

      case "rapid_throttle": {
        // Aggressive transient throttle sweeps (combat evasive / step-climb maneuvers)
        const wave = Math.sin(tSec * 1.4) + 0.35 * Math.cos(tSec * 3.1);
        targetThrottle = Math.max(45, Math.min(99, 74 + wave * 22));
        targetRpm = 2450 + (targetThrottle - 75) * 16;
        targetAltitude = 15500 + Math.sin(tSec * 0.3) * 1200;
        targetAmbient = -10;
        // Transient enrichment/lean spikes & mechanical torque vibration
        profileEgtOffset = (targetThrottle - 75) * 1.35;
        profileChtOffset = 10 + Math.max(0, (targetThrottle - 75) * 0.4);
        profileOilTempOffset = 7;
        profileVibOffset = 9 + Math.abs(Math.cos(tSec * 1.4)) * 7;
        break;
      }

      case "maritime_patrol":
        // Low-altitude dense air endurance loiter (2,500 ft, +20°C)
        targetThrottle = 60;
        targetRpm = 2160;
        targetAltitude = 2500;
        targetAmbient = 20;
        profileEgtOffset = -22;
        profileChtOffset = -14; // Dense sea-level air cools cylinder fins effectively
        profileOilTempOffset = -8;
        profileOilPressOffset = 0.15;
        profileVibOffset = -3;
        break;

      case "standard_isr":
      default:
        targetThrottle = 75;
        targetRpm = 2450;
        targetAltitude = 18000;
        targetAmbient = -15;
        break;
    }

    // Smoothly transition physical state variables toward profile targets
    const rpmAlpha = this.missionProfile === "rapid_throttle" ? 0.25 : 0.08;
    this.state.throttle += (targetThrottle - this.state.throttle) * rpmAlpha;
    this.state.rpm += (targetRpm - this.state.rpm) * rpmAlpha;
    this.state.altitude += (targetAltitude - this.state.altitude) * 0.05;
    this.state.ambientTemp += (targetAmbient - this.state.ambientTemp) * 0.05;

    // Impact of faults on RPM
    let rpmDrop = 0;
    if (this.faults.misfire > 0) rpmDrop += 300 * this.faults.misfire;
    if (this.faults.injector_degradation > 0) rpmDrop += 100 * this.faults.injector_degradation;

    const rpm = this.state.rpm - rpmDrop + noise(18);
    
    // Fuel flow (approx 42 L/h at 2450 RPM cruise, scaled by RPM & throttle load)
    let fuelFlow = 42.0 * (rpm / 2450) * (0.85 + 0.15 * (this.state.throttle / 75));
    if (this.faults.injector_degradation > 0) {
      fuelFlow -= 5.0 * this.faults.injector_degradation;
    }
    fuelFlow += noise(0.45);

    // EGT (approx 735 C baseline + mission profile offset)
    let egt = 735 + profileEgtOffset + noise(4.5);
    if (this.faults.misfire > 0) egt -= 80 * this.faults.misfire;
    if (this.faults.injector_degradation > 0) egt += 50 * this.faults.injector_degradation;
    if (this.faults.sensor_drift > 0) egt += 100 * this.faults.sensor_drift;

    // CHT (approx 165 C baseline + mission thermal offset)
    let targetCht = 165 + profileChtOffset + (egt - (735 + profileEgtOffset)) * 0.12; 
    if (this.faults.overheating > 0) targetCht += 40 * this.faults.overheating;
    this.state.cht += (targetCht - this.state.cht) * 0.03; // Thermal inertia
    const cht = this.state.cht + noise(0.8);

    // Oil Pressure (approx 4.2 bar scaled by RPM + viscosity offset)
    let oilPressure = 4.2 * (rpm / 2450) + profileOilPressOffset + noise(0.08);
    if (this.faults.lubrication_failure > 0) {
      oilPressure -= 1.5 * this.faults.lubrication_failure;
    }

    // Oil Temperature (approx 95 C + mission thermal offset)
    let targetOilTemp = 95 + profileOilTempOffset + (this.state.cht - 165) * 0.2;
    if (this.faults.lubrication_failure > 0) targetOilTemp += 30 * this.faults.lubrication_failure;
    this.state.oilTemp += (targetOilTemp - this.state.oilTemp) * 0.02;
    const oilTemp = this.state.oilTemp + noise(0.4);

    // Vibration (normal 15 + mission profile offset)
    let vibration = Math.max(5, 15 + profileVibOffset + noise(4));
    if (this.faults.misfire > 0) vibration += 50 * this.faults.misfire;
    if (this.faults.lubrication_failure > 0) vibration += 30 * this.faults.lubrication_failure;

    // Battery Voltage (alternator output varies slightly with RPM)
    const batteryVoltage = 28.2 + (rpm - 2450) * 0.0004 + noise(0.08);

    return {
      timestamp: Date.now(),
      engine_id: "ENG-UAV-001",
      mission_profile: this.missionProfile,
      rpm,
      cht,
      egt,
      oil_pressure: oilPressure,
      oil_temp: oilTemp,
      fuel_flow: fuelFlow,
      vibration,
      throttle: this.state.throttle,
      altitude: Math.round(this.state.altitude),
      ambient_temp: Number(this.state.ambientTemp.toFixed(1)),
      battery_voltage: batteryVoltage
    };
  }
}
