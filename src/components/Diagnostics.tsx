import React from 'react';
import { EngineTelemetry, EngineHealthState } from '../types';
import { BarChart, Bar, XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer, ReferenceLine, Cell } from 'recharts';

export function Diagnostics({ telemetry, dtState }: { telemetry: EngineTelemetry | null, dtState: EngineHealthState | null }) {
  if (!telemetry || !dtState) return null;

  // Formatting residuals for a bar chart
  const residualData = [
    { name: 'Fuel Flow', expected: dtState.expected_values.fuel_flow, actual: telemetry.fuel_flow, residual: dtState.residuals.fuel },
    { name: 'EGT', expected: dtState.expected_values.egt, actual: telemetry.egt, residual: dtState.residuals.egt },
    { name: 'CHT', expected: dtState.expected_values.cht, actual: telemetry.cht, residual: dtState.residuals.cht },
    { name: 'Oil Press', expected: dtState.expected_values.oil_pressure, actual: telemetry.oil_pressure, residual: dtState.residuals.oil_pressure },
    { name: 'Vibration', expected: dtState.expected_values.vibration, actual: telemetry.vibration, residual: dtState.residuals.vibration },
  ];

  return (
    <div className="grid grid-cols-1 lg:grid-cols-2 gap-4 h-full">
      {/* Residuals Chart */}
      <div className="bg-slate-900 border border-slate-800 rounded-lg p-5 flex flex-col">
        <h3 className="text-xs font-medium text-slate-500 uppercase tracking-widest mb-2">Physics Model Residuals</h3>
        <p className="text-xs text-slate-400 mb-6">Deviation between measured telemetry and physics-based expectations.</p>
        
        <div className="flex-1 w-full min-h-[300px]">
          <ResponsiveContainer width="100%" height="100%">
            <BarChart layout="vertical" data={residualData} margin={{ top: 5, right: 30, left: 20, bottom: 5 }}>
              <CartesianGrid strokeDasharray="3 3" stroke="#1e293b" horizontal={true} vertical={false} />
              <XAxis type="number" stroke="#475569" fontSize={11} domain={[-50, 50]} />
              <YAxis dataKey="name" type="category" stroke="#94a3b8" fontSize={11} width={80} />
              <Tooltip 
                contentStyle={{ backgroundColor: '#0f172a', border: '1px solid #1e293b', fontSize: '12px' }}
                itemStyle={{ color: '#f8fafc' }}
                formatter={(value: number) => value.toFixed(2)}
              />
              <ReferenceLine x={0} stroke="#475569" />
              <Bar dataKey="residual" radius={[0, 4, 4, 0]}>
                {residualData.map((entry, index) => (
                  <Cell key={`cell-${index}`} fill={entry.residual > 0 ? '#f43f5e' : '#3b82f6'} />
                ))}
              </Bar>
            </BarChart>
          </ResponsiveContainer>
        </div>
      </div>

      {/* Diagnostics Explanation */}
      <div className="bg-slate-900 border border-slate-800 rounded-lg p-5 flex flex-col">
        <h3 className="text-xs font-medium text-slate-500 uppercase tracking-widest mb-4">AI Diagnostic Engine</h3>
        
        <div className="flex flex-col gap-4">
          <div className="p-4 bg-slate-950 rounded border border-slate-800">
            <h4 className="text-slate-300 text-sm font-medium mb-2">State Estimation Vector</h4>
            <div className="grid grid-cols-2 gap-2 text-xs font-mono text-slate-400">
               <div>Actual EGT: <span className="text-slate-200">{telemetry.egt.toFixed(1)}</span></div>
               <div>Pred EGT: <span className="text-slate-200">{dtState.expected_values.egt.toFixed(1)}</span></div>
               
               <div>Actual Fuel: <span className="text-slate-200">{telemetry.fuel_flow.toFixed(1)}</span></div>
               <div>Pred Fuel: <span className="text-slate-200">{dtState.expected_values.fuel_flow.toFixed(1)}</span></div>
            </div>
          </div>
          
          <div className="flex-1 overflow-y-auto">
             <h4 className="text-slate-300 text-sm font-medium mb-3">Diagnostic Logic Matrix</h4>
             <ul className="text-xs text-slate-400 space-y-3">
                <li className="flex gap-2">
                   <div className="w-2 h-2 mt-1 rounded-full bg-orange-500 shrink-0"></div>
                   <span><strong>Injector Degradation:</strong> Triggers when actual fuel flow drops below expectation (negative residual) while EGT rises (positive residual due to lean burn).</span>
                </li>
                <li className="flex gap-2">
                   <div className="w-2 h-2 mt-1 rounded-full bg-rose-500 shrink-0"></div>
                   <span><strong>Misfire:</strong> Triggers when EGT drops sharply below expectation (unburnt fuel) accompanied by a rise in vibration residuals.</span>
                </li>
                <li className="flex gap-2">
                   <div className="w-2 h-2 mt-1 rounded-full bg-amber-500 shrink-0"></div>
                   <span><strong>Overheating:</strong> Triggers when CHT deviates positively from thermal equilibrium expectation combined with high EGT.</span>
                </li>
             </ul>
          </div>
        </div>
      </div>
    </div>
  );
}
