import { EngineTelemetry, EngineHealthState, FaultAlert } from "../types";

export class DigitalTwin {
  // Simple EMA filter for residuals
  private residuals = {
    egt: 0,
    fuel: 0,
    vibration: 0,
    oil_pressure: 0,
    cht: 0
  };

  private degradation = 0;
  private missionStart = Date.now();
  private alerts: FaultAlert[] = [];

  private updateEMA(currentValue: number, newValue: number, alpha: number = 0.05) {
    return currentValue * (1 - alpha) + newValue * alpha;
  }

  public evaluate(telemetry: EngineTelemetry) {
    // 1. Physics Baseline Expectations (Accounting for RPM, Throttle & Environmental Profile)
    const expectedFuelFlow = 42.0 * (telemetry.rpm / 2450) * (0.85 + 0.15 * (telemetry.throttle / 75));
    const expectedEGT =
      735 +
      (telemetry.mission_profile === "high_altitude"
        ? 24
        : telemetry.mission_profile === "hot_weather"
        ? 12
        : telemetry.mission_profile === "maritime_patrol"
        ? -20
        : (telemetry.throttle - 75) * 1.1);
    const expectedVibration = 15 + Math.max(0, (telemetry.rpm - 2450) * 0.015);
    const expectedOilPress = 4.2 * (telemetry.rpm / 2450);
    const expectedCHT =
      165 +
      (telemetry.mission_profile === "hot_weather"
        ? 10
        : telemetry.mission_profile === "high_altitude"
        ? 8
        : telemetry.mission_profile === "maritime_patrol"
        ? -12
        : 0);

    // 2. Calculate Residuals
    const egtRes = telemetry.egt - expectedEGT;
    const fuelRes = telemetry.fuel_flow - expectedFuelFlow;
    const vibRes = telemetry.vibration - expectedVibration;
    const oilPRes = telemetry.oil_pressure - expectedOilPress;
    const chtRes = telemetry.cht - expectedCHT;

    // Smooth residuals to avoid noise spikes triggering faults
    this.residuals.egt = this.updateEMA(this.residuals.egt, egtRes);
    this.residuals.fuel = this.updateEMA(this.residuals.fuel, fuelRes);
    this.residuals.vibration = this.updateEMA(this.residuals.vibration, vibRes);
    this.residuals.oil_pressure = this.updateEMA(this.residuals.oil_pressure, oilPRes);
    this.residuals.cht = this.updateEMA(this.residuals.cht, chtRes);

    // 3. Health Estimation (0-100)
    let combustionHealth = 100 - Math.abs(this.residuals.egt) * 0.5 - Math.abs(this.residuals.fuel) * 2;
    let thermalHealth = 100 - Math.max(0, this.residuals.cht) * 2;
    let lubricationHealth = 100 - Math.max(0, -this.residuals.oil_pressure) * 20;
    let mechanicalHealth = 100 - Math.max(0, this.residuals.vibration) * 1.5;

    // Clamp healths
    const clamp = (v: number) => Math.max(0, Math.min(100, v));
    combustionHealth = clamp(combustionHealth);
    thermalHealth = clamp(thermalHealth);
    lubricationHealth = clamp(lubricationHealth);
    mechanicalHealth = clamp(mechanicalHealth);

    const overallHealth = (combustionHealth + thermalHealth + lubricationHealth + mechanicalHealth) / 4;

    // 4. Degradation & RUL
    // Slowly accumulate degradation based on thermal and mechanical stress
    if (telemetry.cht > 180) this.degradation += 0.00001; 
    if (telemetry.vibration > 30) this.degradation += 0.00002;
    
    // Baseline aging
    this.degradation += 0.000001; 

    // RUL calculation (assuming 2000 hours TBO, linearly scaling down with degradation)
    // Formula: RUL = TBO * (1 - degradation)
    const TBO = 2000; 
    const rul = Math.max(0, TBO * (1 - this.degradation));

    // 5. Fault Detection Logic (Rule-based based on AI-learned patterns)
    this.alerts = [];
    const ts = Date.now();

    if (this.residuals.fuel < -2 && this.residuals.egt > 20) {
      this.alerts.push({
        id: "FLT-INJ",
        timestamp: ts,
        parameter: "Fuel/EGT",
        fault: "Injector Degradation",
        severity: "WARNING",
        confidence: 0.85,
        probable_cause: "Partial injector clog leading to lean condition",
        recommended_action: "Inspect injector at next landing"
      });
    }

    if (this.residuals.egt < -40 && this.residuals.vibration > 15) {
      this.alerts.push({
        id: "FLT-MIS",
        timestamp: ts,
        parameter: "EGT/Vibration",
        fault: "Cylinder Misfire",
        severity: "CRITICAL",
        confidence: 0.92,
        probable_cause: "Ignition failure or complete fuel starvation in cylinder",
        recommended_action: "Check ignition harness and spark plugs immediately"
      });
    }

    if (this.residuals.oil_pressure < -0.8 && telemetry.oil_temp > 105) {
       this.alerts.push({
        id: "FLT-LUB",
        timestamp: ts,
        parameter: "Oil Pressure",
        fault: "Lubrication Failure",
        severity: "CRITICAL",
        confidence: 0.89,
        probable_cause: "Oil leak or pump degradation",
        recommended_action: "Abort mission if pressure drops below 2.0 bar"
      });
    }

    if (this.residuals.cht > 15 && this.residuals.egt > 30) {
      this.alerts.push({
        id: "FLT-OVR",
        timestamp: ts,
        parameter: "CHT",
        fault: "Overheating Trend",
        severity: "CAUTION",
        confidence: 0.78,
        probable_cause: "Prolonged high power or cooling airflow reduction",
        recommended_action: "Reduce throttle, increase airspeed if possible"
      });
    }

    const state: EngineHealthState & { active_alerts: FaultAlert[] } = {
      timestamp: ts,
      overall_health: overallHealth,
      subsystem_health: {
        combustion: combustionHealth,
        thermal: thermalHealth,
        lubrication: lubricationHealth,
        mechanical: mechanicalHealth
      },
      expected_values: {
        egt: expectedEGT,
        fuel_flow: expectedFuelFlow,
        cht: expectedCHT,
        oil_pressure: expectedOilPress,
        vibration: expectedVibration
      },
      residuals: {
        egt: this.residuals.egt,
        fuel: this.residuals.fuel,
        cht: this.residuals.cht,
        oil_pressure: this.residuals.oil_pressure,
        vibration: this.residuals.vibration
      },
      degradation: this.degradation,
      rul_estimated_hours: rul,
      active_alerts: this.alerts
    };

    return state;
  }
}
