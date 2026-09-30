# System Architecture & Requirements Specification

## 1. System Requirements Specification (SRS)
### 1.1 Functional Requirements
* **Data Ingestion**: The system shall ingest real-time telemetry from a physical or simulated aero-piston engine at a configurable rate (default 10 Hz).
* **Digital Twin Synchronization**: A virtual model of the engine shall run continuously, estimating latent states (e.g., combustion efficiency, thermal margin) using physics-informed algorithms.
* **Anomaly Detection**: The system shall compare incoming telemetry against the virtual model to generate residuals. Residuals exceeding dynamic statistical bounds will trigger anomalies.
* **Prognostics & RUL**: The system shall track long-term degradation (e.g., injector clogging, mechanical wear) and predict Remaining Useful Life (RUL) using degradation regression.
* **Dashboard**: Provide a Ground Control Station (GCS) user interface displaying real-time telemetry, Digital Twin states, active faults, and maintenance advisories.

### 1.2 Non-Functional Requirements
* **Scalability**: Architecture must support fleet-level scaling (N engines, N UAVs).
* **Modularity**: ML layers, Physics layers, and Hardware Abstraction Layers must be decoupled.
* **Performance**: Real-time state estimation must execute in < 50ms per cycle to support high-rate telemetry.
* **Resilience**: The system must fail gracefully. If ML inference fails, physics-based residual tracking must continue.

## 2. Detailed Architecture
The system employs a full-stack Node.js (TypeScript) environment, chosen for its asynchronous I/O capabilities perfect for real-time telemetry, paired with a React frontend.

* **Backend (Node.js/Express/Socket.io)**:
  * `Engine Simulator`: Generates synthetic telemetry based on physical IC engine equations. Injectable faults.
  * `Data Acquisition Layer`: Abstracts the telemetry source.
  * `Digital Twin Core`: Contains the baseline reference model and residual generator.
  * `Diagnostics Engine`: Evaluates residuals against fault signatures (e.g., High EGT + Low RPM = Misfire or Injector issue).
* **Frontend (React/Vite/Recharts)**:
  * Connects via WebSockets for low-latency telemetry visualization.
  * Displays Subsystem Health (Combustion, Thermal, Mechanical, Lubrication).

## 3. Data Flow Diagram
`[Simulated Engine] -> (10 Hz Telemetry) -> [Data Bus / WebSocket] -> [Digital Twin Evaluator] -> (Residuals) -> [ML/Diagnostic Layer] -> (Health State & Faults) -> [Frontend GCS Dashboard]`

## 4. Missing Information & Assumptions
* **Assumption**: Real engine maps (RPM vs Torque, Fuel Flow vs EGT) are proprietary. We will use generic standard standard-atmosphere and generic 4-stroke aero-piston curves for the baseline simulator.
* **Assumption**: Vibration data is complex to simulate realistically in real-time time-domain without massive data. We will simulate an aggregated "Vibration Index" (0-100) instead of raw high-frequency accelerometer data.
* **Missing**: Actual CAN bus IDs. We abstract this using JSON-over-WebSocket for the prototype.
