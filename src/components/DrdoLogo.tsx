import React from 'react';
import clsx from 'clsx';

export function DrdoLogo({
  size = 'md',
  showText = true,
  className,
}: {
  size?: 'sm' | 'md' | 'lg';
  showText?: boolean;
  className?: string;
}) {
  const dims =
    size === 'sm'
      ? 'w-7 h-7'
      : size === 'lg'
      ? 'w-11 h-11'
      : 'w-9 h-9';

  return (
    <div className={clsx('inline-flex items-center gap-2.5 select-none', className)}>
      {/* Official-Style DRDO / ADE Defence Emblem Crest SVG */}
      <div
        className={clsx(
          'relative rounded-full flex items-center justify-center shrink-0 shadow-[0_0_12px_rgba(14,165,233,0.25)]',
          dims
        )}
      >
        <svg
          viewBox="0 0 100 100"
          className="w-full h-full"
          aria-label="DRDO Defence Research and Development Organisation Emblem"
        >
          <defs>
            <radialGradient id="drdoNavyGrad" cx="50%" cy="45%" r="55%">
              <stop offset="0%" stopColor="#1e3a8a" />
              <stop offset="70%" stopColor="#0f172a" />
              <stop offset="100%" stopColor="#020617" />
            </radialGradient>
            <linearGradient id="drdoGoldGrad" x1="0%" y1="0%" x2="100%" y2="100%">
              <stop offset="0%" stopColor="#fde047" />
              <stop offset="50%" stopColor="#f59e0b" />
              <stop offset="100%" stopColor="#b45309" />
            </linearGradient>
          </defs>

          {/* Outer Gold Gear/Crest Ring */}
          <circle
            cx="50"
            cy="50"
            r="47"
            fill="url(#drdoNavyGrad)"
            stroke="url(#drdoGoldGrad)"
            strokeWidth="3.5"
          />

          {/* 16 Precision Engineering Gear Notches */}
          {Array.from({ length: 16 }).map((_, i) => {
            const angle = i * 22.5;
            return (
              <rect
                key={i}
                x="48"
                y="3.5"
                width="4"
                height="4.5"
                rx="1"
                fill="url(#drdoGoldGrad)"
                transform={`rotate(${angle} 50 50)`}
              />
            );
          })}

          {/* Inner Tricolour Accent Arcs (Saffron, White, India Green) */}
          <path
            d="M 16 38 A 36 36 0 0 1 84 38"
            fill="none"
            stroke="#f97316"
            strokeWidth="2.2"
            strokeLinecap="round"
          />
          <circle
            cx="50"
            cy="50"
            r="34"
            fill="none"
            stroke="#e2e8f0"
            strokeWidth="1.1"
            strokeDasharray="3 2"
          />
          <path
            d="M 18 64 A 35 35 0 0 0 82 64"
            fill="none"
            stroke="#10b981"
            strokeWidth="2.2"
            strokeLinecap="round"
          />

          {/* Ashoka / Defence Apex Pillar & Wings */}
          <polygon
            points="50,18 55,34 45,34"
            fill="url(#drdoGoldGrad)"
          />
          {/* Aerospace Delta Wing / UAV Vector */}
          <path
            d="M 22 48 L 50 35 L 78 48 L 66 51 L 50 43 L 34 51 Z"
            fill="url(#drdoGoldGrad)"
          />
          {/* Atomic / Propulsion Science Orbit Rings */}
          <ellipse
            cx="50"
            cy="52"
            rx="18"
            ry="7"
            fill="none"
            stroke="#38bdf8"
            strokeWidth="1.8"
            transform="rotate(-28 50 52)"
          />
          <ellipse
            cx="50"
            cy="52"
            rx="18"
            ry="7"
            fill="none"
            stroke="#38bdf8"
            strokeWidth="1.8"
            transform="rotate(28 50 52)"
          />
          <circle cx="50" cy="52" r="4.2" fill="url(#drdoGoldGrad)" />

          {/* Bottom Motto Scroll Banner */}
          <path
            d="M 22 75 Q 50 83 78 75 L 75 83 Q 50 91 25 83 Z"
            fill="url(#drdoGoldGrad)"
          />
          <text
            x="50"
            y="82"
            textAnchor="middle"
            fill="#020617"
            fontSize="6.5"
            fontWeight="900"
            fontFamily="monospace"
          >
            DRDO · ADE
          </text>
        </svg>
      </div>

      {showText && (
        <div className="flex flex-col leading-tight">
          <div className="flex items-center gap-1.5">
            <span className="text-xs font-mono font-extrabold tracking-wider text-amber-400">
              DRDO
            </span>
            <span className="text-[10px] font-mono text-slate-400">•</span>
            <span className="text-[11px] font-bold tracking-tight text-white">
              ADE BENGALURU
            </span>
          </div>
          <span className="text-[9px] font-mono text-cyan-300/90 tracking-wide">
            बलस्य मूलं विज्ञानम् · MALE UAV DT
          </span>
        </div>
      )}
    </div>
  );
}
