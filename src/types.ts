export type MissionProfileId =
  | 'standard_isr'
  | 'high_altitude'
  | 'hot_weather'
  | 'rapid_throttle'
  | 'maritime_patrol';

export interface EngineTelemetry {
  timestamp: number;
  engine_id: string;
  mission_profile: MissionProfileId;
  rpm: number;
  cht: number; // Cylinder Head Temperature (Celsius)
  egt: number; // Exhaust Gas Temperature (Celsius)
  oil_pressure: number; // bar
  oil_temp: number; // Celsius
  fuel_flow: number; // L/h
  vibration: number; // 0-100 scale
  throttle: number; // 0-100%
  altitude: number; // ft
  ambient_temp: number; // Celsius
  battery_voltage: number; // V
}

export interface EngineHealthState {
  timestamp: number;
  overall_health: number; // 0-100
  subsystem_health: {
    combustion: number; // 0-100
    thermal: number; // 0-100
    lubrication: number; // 0-100
    mechanical: number; // 0-100
  };
  expected_values: {
    egt: number;
    fuel_flow: number;
    cht: number;
    oil_pressure: number;
    vibration: number;
  };
  residuals: {
    egt: number;
    fuel: number;
    cht: number;
    oil_pressure: number;
    vibration: number;
  };
  degradation: number; // 0-1.0
  rul_estimated_hours: number;
}

export interface FaultAlert {
  id: string;
  timestamp: number;
  parameter: string;
  fault: string;
  severity: 'INFO' | 'ADVISORY' | 'CAUTION' | 'WARNING' | 'CRITICAL';
  confidence: number;
  probable_cause: string;
  recommended_action: string;
}

export interface MissionState {
  id: string;
  profile: string;
  duration_seconds: number;
  status: 'ACTIVE' | 'COMPLETED' | 'ABORTED';
}
