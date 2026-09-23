import React from "react";
import { ShieldCheck, Info, Eye } from "lucide-react";

interface MachineReferenceProps {
  category?: string;
  machineKey?: string;
  showAll?: boolean;
}

export function MachineReferenceGuides({
  category = "Transformers",
  machineKey = "TRF-102",
  showAll = false,
}: MachineReferenceProps) {
  const references = [
    {
      category: "Transformers",
      codes: ["TRF-102", "TRF-117", "TRF-203", "TRF-305"],
      title: "Step-Down & Power Transformer (132/33 kV)",
      spec: "Oil-Immersed OFAF Cooling · Conservator Tank & HV Bushings",
      points: [
        "HV & LV Bushings (Check for hairline cracks or flashover burns)",
        "Oil Conservator Level Gauge (Nominal range: 75% – 85%)",
        "Radiator Cooling Fins & Valve Seal Integrity",
        "Buchholz Relay & Winding Temperature Sensors",
      ],
      svg: (
        <svg viewBox="0 0 360 200" width="100%" height="160" className="reference-svg">
          <defs>
            <linearGradient id="trfGrad" x1="0%" y1="0%" x2="100%" y2="100%">
              <stop offset="0%" stopColor="#1e3a5f" />
              <stop offset="100%" stopColor="#0f1f33" />
            </linearGradient>
            <linearGradient id="tankGrad" x1="0%" y1="0%" x2="0%" y2="100%">
              <stop offset="0%" stopColor="#2e4d75" />
              <stop offset="100%" stopColor="#182d49" />
            </linearGradient>
            <linearGradient id="finGrad" x1="0%" y1="0%" x2="100%" y2="0%">
              <stop offset="0%" stopColor="#0284c7" stopOpacity="0.4" />
              <stop offset="100%" stopColor="#0284c7" stopOpacity="0.1" />
            </linearGradient>
          </defs>
          <rect width="360" height="200" fill="#090f1d" rx="8" />
          {/* Main Tank */}
          <rect x="90" y="65" width="180" height="110" rx="6" fill="url(#tankGrad)" stroke="#38bdf8" strokeWidth="1.5" />
          {/* Radiator Cooling Fins Left & Right */}
          <g fill="url(#finGrad)" stroke="#38bdf8" strokeWidth="1">
            <rect x="45" y="75" width="38" height="90" rx="3" />
            <line x1="55" y1="75" x2="55" y2="165" />
            <line x1="65" y1="75" x2="65" y2="165" />
            <line x1="75" y1="75" x2="75" y2="165" />
            
            <rect x="277" y="75" width="38" height="90" rx="3" />
            <line x1="287" y1="75" x2="287" y2="165" />
            <line x1="297" y1="75" x2="297" y2="165" />
            <line x1="307" y1="75" x2="307" y2="165" />
          </g>
          {/* Conservator Tank */}
          <rect x="130" y="24" width="100" height="28" rx="14" fill="#1e3a5f" stroke="#38bdf8" strokeWidth="1.5" />
          <line x1="180" y1="52" x2="180" y2="65" stroke="#38bdf8" strokeWidth="3" />
          {/* HV Bushings Top */}
          <g fill="#0284c7" stroke="#e0f2fe" strokeWidth="1">
            <polygon points="120,65 125,35 133,35 138,65" fill="#38bdf8" />
            <polygon points="175,65 180,35 188,35 193,65" fill="#38bdf8" />
            <polygon points="230,65 235,35 243,35 248,65" fill="#38bdf8" />
            {/* Terminal Arcs */}
            <circle cx="129" cy="30" r="4" fill="#fbbf24" stroke="#d97706" />
            <circle cx="184" cy="30" r="4" fill="#fbbf24" stroke="#d97706" />
            <circle cx="239" cy="30" r="4" fill="#fbbf24" stroke="#d97706" />
          </g>
          {/* Dial / Oil Level */}
          <circle cx="180" cy="115" r="16" fill="#0f172a" stroke="#38bdf8" strokeWidth="1.5" />
          <line x1="180" y1="115" x2="189" y2="108" stroke="#10b981" strokeWidth="2" strokeLinecap="round" />
          <text x="180" y="145" fill="#94a3b8" fontSize="9" textAnchor="middle" fontFamily="'DM Mono',monospace">OIL LEVEL 82%</text>
          {/* Labels */}
          <text x="180" y="185" fill="#e2e8f0" fontSize="11" fontWeight="700" textAnchor="middle" fontFamily="'DM Sans',sans-serif">TRANSFORMER PRIMARY CORE</text>
        </svg>
      ),
    },
    {
      category: "Pumps & Motors",
      codes: ["PMP-301", "PMP-302", "MTR-105"],
      title: "Centrifugal Industrial Pump & Induction Motor",
      spec: "High-Pressure Impeller · Direct Shaft Coupling · Vibration Monitoring",
      points: [
        "Volute Casing & Mechanical Face Seal (Zero leakage)",
        "Motor Drive End (DE) & Non-Drive End (NDE) Bearings",
        "Coupling Alignment & Vibration Sensor (Limit: < 2.8 mm/s)",
        "Suction / Discharge Flange Pressure Gauge Readings",
      ],
      svg: (
        <svg viewBox="0 0 360 200" width="100%" height="160" className="reference-svg">
          <rect width="360" height="200" fill="#090f1d" rx="8" />
          {/* Motor Body */}
          <rect x="40" y="65" width="120" height="95" rx="5" fill="#1e3a5f" stroke="#0ea5e9" strokeWidth="1.5" />
          {/* Motor Fins */}
          <line x1="55" y1="65" x2="55" y2="160" stroke="#0284c7" strokeWidth="2" />
          <line x1="75" y1="65" x2="75" y2="160" stroke="#0284c7" strokeWidth="2" />
          <line x1="95" y1="65" x2="95" y2="160" stroke="#0284c7" strokeWidth="2" />
          <line x1="115" y1="65" x2="115" y2="160" stroke="#0284c7" strokeWidth="2" />
          <line x1="135" y1="65" x2="135" y2="160" stroke="#0284c7" strokeWidth="2" />
          {/* Coupling Guard */}
          <rect x="160" y="90" width="35" height="45" rx="3" fill="#334155" stroke="#f59e0b" strokeWidth="1.5" />
          <line x1="165" y1="112" x2="190" y2="112" stroke="#fbbf24" strokeWidth="3" />
          {/* Pump Casing */}
          <circle cx="245" cy="112" r="48" fill="#182d49" stroke="#0ea5e9" strokeWidth="1.5" />
          {/* Impeller Eye */}
          <circle cx="245" cy="112" r="18" fill="#0f172a" stroke="#38bdf8" strokeWidth="1.5" />
          {/* Discharge Flange Top */}
          <rect x="235" y="32" width="20" height="35" fill="#1e3a5f" stroke="#0ea5e9" strokeWidth="1.5" />
          <rect x="228" y="26" width="34" height="8" rx="2" fill="#38bdf8" />
          {/* Baseplate */}
          <rect x="25" y="160" width="310" height="15" rx="3" fill="#1e293b" stroke="#475569" />
          <text x="100" y="185" fill="#94a3b8" fontSize="10" fontFamily="'DM Mono',monospace">3-PHASE MOTOR</text>
          <text x="250" y="185" fill="#94a3b8" fontSize="10" fontFamily="'DM Mono',monospace">PUMP VOLUTE</text>
        </svg>
      ),
    },
    {
      category: "Generators & Turbines",
      codes: ["GEN-405", "GEN-502"],
      title: "Diesel Generator & Gas Turbine Set",
      spec: "Synchronous Brushless Alternator · Turbocharged Engine Block",
      points: [
        "Alternator Stator Winding & AVR Output Voltage Stability",
        "Engine Oil Pressure & Closed-Loop Coolant Level",
        "Fuel Injector Delivery Pressure & Battery Cranking Voltage",
        "Exhaust Turbocharger Temperature & Vibration Baseline",
      ],
      svg: (
        <svg viewBox="0 0 360 200" width="100%" height="160" className="reference-svg">
          <rect width="360" height="200" fill="#090f1d" rx="8" />
          {/* Engine Block */}
          <rect x="40" y="60" width="130" height="100" rx="4" fill="#1e293b" stroke="#a855f7" strokeWidth="1.5" />
          {/* Alternator Housing */}
          <rect x="175" y="50" width="140" height="110" rx="6" fill="#182d49" stroke="#38bdf8" strokeWidth="1.5" />
          {/* Exhaust Stack */}
          <rect x="75" y="20" width="18" height="40" fill="#475569" stroke="#94a3b8" strokeWidth="1" />
          <polygon points="68,20 100,20 94,10 74,10" fill="#64748b" />
          {/* Radiator Fan Guard */}
          <circle cx="280" cy="105" r="28" fill="#0f172a" stroke="#a855f7" strokeWidth="1.5" />
          <line x1="280" y1="77" x2="280" y2="133" stroke="#a855f7" strokeWidth="1.5" />
          <line x1="252" y1="105" x2="308" y2="105" stroke="#a855f7" strokeWidth="1.5" />
          {/* Control Unit */}
          <rect x="190" y="65" width="45" height="35" rx="3" fill="#0f172a" stroke="#10b981" strokeWidth="1" />
          <text x="212" y="86" fill="#10b981" fontSize="9" textAnchor="middle" fontFamily="'DM Mono',monospace">50.0 Hz</text>
          {/* Skid */}
          <rect x="25" y="160" width="310" height="15" rx="3" fill="#0f172a" stroke="#64748b" />
          <text x="180" y="186" fill="#e2e8f0" fontSize="11" fontWeight="700" textAnchor="middle" fontFamily="'DM Sans',sans-serif">STANDBY GENERATOR SET (DG-405)</text>
        </svg>
      ),
    },
    {
      category: "Switchgear & Breakers",
      codes: ["CBK-201", "SWG-501"],
      title: "Vacuum Circuit Breaker & GIS (220 kV)",
      spec: "SF6 Gas Enclosure · Motorized Spring Charge · Vacuum Interrupter",
      points: [
        "SF6 Gas Density & Temperature-Compensated Pressure Gauge",
        "Closing & Opening Timing Analyzer (< 35 ms / 25 ms)",
        "Main Contact Resistance Ductor Test (< 40 µΩ)",
        "Mechanical & Electrical Interlock Safety Verification",
      ],
      svg: (
        <svg viewBox="0 0 360 200" width="100%" height="160" className="reference-svg">
          <rect width="360" height="200" fill="#090f1d" rx="8" />
          {/* Enclosure Cubicle */}
          <rect x="70" y="25" width="220" height="145" rx="5" fill="#182d49" stroke="#10b981" strokeWidth="1.5" />
          {/* 3 Pole Vacuum Bottles */}
          <g fill="#0f172a" stroke="#38bdf8" strokeWidth="1.5">
            <rect x="100" y="45" width="32" height="70" rx="4" />
            <rect x="164" y="45" width="32" height="70" rx="4" />
            <rect x="228" y="45" width="32" height="70" rx="4" />
          </g>
          {/* SF6 Density Meter */}
          <circle cx="180" cy="142" r="14" fill="#090f1d" stroke="#10b981" strokeWidth="1.5" />
          <line x1="180" y1="142" x2="187" y2="135" stroke="#10b981" strokeWidth="2" strokeLinecap="round" />
          {/* Spring Charged Flag */}
          <rect x="105" y="132" width="22" height="15" rx="2" fill="#10b981" />
          <text x="116" y="143" fill="#ffffff" fontSize="8" fontWeight="700" textAnchor="middle">OK</text>
          <text x="180" y="185" fill="#e2e8f0" fontSize="11" fontWeight="700" textAnchor="middle" fontFamily="'DM Sans',sans-serif">VACUUM INTERRUPTER &amp; GIS POLE</text>
        </svg>
      ),
    },
    {
      category: "Renewables & Power Systems",
      codes: ["SLR-101", "BTY-202"],
      title: "Utility Solar Inverter & Substation Battery Bank",
      spec: "Multi-MPPT DC Array · VRLA Lead-Acid Cells (220V DC)",
      points: [
        "DC Array String Voltage & Anti-Islanding Relay",
        "IGBT Inverter Heatsink Temperature (< 65 °C)",
        "Individual Pilot Cell Float Voltage (2.25 V/cell)",
        "DC Earth Fault Insulation Resistance (> 1.0 MΩ)",
      ],
      svg: (
        <svg viewBox="0 0 360 200" width="100%" height="160" className="reference-svg">
          <rect width="360" height="200" fill="#090f1d" rx="8" />
          {/* Inverter Cabinet */}
          <rect x="50" y="30" width="120" height="135" rx="5" fill="#1e3a5f" stroke="#f59e0b" strokeWidth="1.5" />
          {/* Inverter LCD */}
          <rect x="70" y="45" width="80" height="40" rx="3" fill="#0f172a" stroke="#38bdf8" strokeWidth="1" />
          <text x="110" y="65" fill="#38bdf8" fontSize="11" fontWeight="700" textAnchor="middle" fontFamily="'DM Mono',monospace">245.8 kW</text>
          <text x="110" y="78" fill="#10b981" fontSize="8" textAnchor="middle" fontFamily="'DM Mono',monospace">MPPT ACTIVE</text>
          {/* Battery Rack */}
          <g fill="#182d49" stroke="#f59e0b" strokeWidth="1">
            <rect x="190" y="40" width="120" height="32" rx="3" />
            <rect x="190" y="80" width="120" height="32" rx="3" />
            <rect x="190" y="120" width="120" height="32" rx="3" />
          </g>
          {/* Battery Terminals */}
          <circle cx="210" cy="56" r="4" fill="#ef4444" />
          <circle cx="290" cy="56" r="4" fill="#0284c7" />
          <circle cx="210" cy="96" r="4" fill="#ef4444" />
          <circle cx="290" cy="96" r="4" fill="#0284c7" />
          <circle cx="210" cy="136" r="4" fill="#ef4444" />
          <circle cx="290" cy="136" r="4" fill="#0284c7" />
          <text x="180" y="185" fill="#e2e8f0" fontSize="11" fontWeight="700" textAnchor="middle" fontFamily="'DM Sans',sans-serif">SOLAR INVERTER &amp; DC BATTERY BANK</text>
        </svg>
      ),
    },
  ];

  const matched = references.find(
    r => r.category.toLowerCase() === category.toLowerCase() || r.codes.includes(machineKey)
  ) || references[0];

  const displayList = showAll ? references : [matched];

  return (
    <div className="machine-reference-wrapper">
      <div className="machine-reference-header">
        <div style={{ display: "flex", alignItems: "center", gap: 8 }}>
          <ShieldCheck size={18} color="#0284c7" />
          <div>
            <strong style={{ fontSize: 13, color: "var(--ink, #0f172a)" }}>
              Equipment Reference &amp; Inspection Visual Guides
            </strong>
            <span style={{ display: "block", fontSize: 10, color: "var(--muted, #64748b)" }}>
              Official equipment schematics &amp; critical checklist points for field verification (Offline Cached)
            </span>
          </div>
        </div>
        <span className="reference-badge">
          <Info size={12} /> Reference Aid · Not Uploaded
        </span>
      </div>

      <div className="machine-reference-grid">
        {displayList.map(ref => (
          <div className="machine-reference-card" key={ref.category}>
            <div className="reference-svg-container">{ref.svg}</div>
            <div className="reference-card-body">
              <div className="reference-card-category">{ref.category}</div>
              <h4 className="reference-card-title">{ref.title}</h4>
              <p className="reference-card-spec">{ref.spec}</p>

              <div className="reference-points-title">Critical Inspection Focus:</div>
              <ul className="reference-points-list">
                {ref.points.map((pt, idx) => (
                  <li key={idx}>
                    <span className="reference-point-dot"></span>
                    <span>{pt}</span>
                  </li>
                ))}
              </ul>
            </div>
          </div>
        ))}
      </div>
    </div>
  );
}
