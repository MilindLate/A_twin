# Digital Twin Design & RUL Strategy

## 1. Digital Twin Mathematical Model
The Digital Twin uses a hybrid approach:
* **Physics-based baseline**: We use simplified thermodynamic relationships.
  * *Base Fuel Flow* = `f(RPM, Throttle, Altitude)`
  * *Expected EGT* = `f(Fuel Flow, RPM, Ambient Temp)`
  * *Expected CHT* = `f(EGT, Airspeed, Ambient Temp)`
* **Residual Generation**: 
  * `Residual_EGT = Measured_EGT - Expected_EGT`
  * `Residual_Fuel = Measured_Fuel - Expected_Fuel`

## 2. Fault Taxonomy
| Fault Mode | Signature (Residuals) |
|---|---|
| **Injector Degradation** | Fuel Flow drops, EGT rises (lean run), RPM fluctuates. |
| **Misfire** | EGT drops suddenly in affected cylinder (or aggregate drops), high vibration, RPM drop. |
| **Overheating** | CHT rises beyond expected thermal equilibrium, Oil Temp follows. |
| **Lubrication Failure** | Oil Pressure drops rapidly, Oil Temp rises, Mechanical health degrades. |
| **Sensor Drift (EGT)** | EGT residual increases slowly over time, no change in Fuel Flow or CHT residuals. |

## 3. Remaining Useful Life (RUL) Strategy
* **Degradation State**: We maintain a continuous `Degradation Factor` (0.0 to 1.0).
* **Calculated via**: Accumulated thermal stress (time spent with CHT > threshold) + Accumulated mechanical stress (cycles + vibration).
* **Extrapolation**: RUL is calculated by projecting the current degradation trajectory (using an EWMA smoothing) until the threshold of 1.0 (failure) is met.

## 4. Mission Simulation
The Mission Simulator generates sequences of setpoints:
* `Takeoff`: High RPM, high throttle, low altitude.
* `Climb`: High RPM, decreasing pressure, dropping ambient temp.
* `Cruise`: Moderate RPM, stable altitude.
* `Descent / Loiter`: Variable throttle, stable/dropping altitude.
