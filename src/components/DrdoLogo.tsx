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
      ? 'w-8 h-8'
      : size === 'lg'
      ? 'w-12 h-12'
      : 'w-10 h-10';

  return (
    <div className={clsx('inline-flex items-center gap-2.5 select-none', className)}>
      {/* Official DRDO Emblem SVG (Exact reproduction of official crest) */}
      <div
        className={clsx(
          'relative rounded-full flex items-center justify-center shrink-0 shadow-[0_0_12px_rgba(13,71,161,0.45)]',
          dims
        )}
      >
        <svg
          viewBox="0 0 200 200"
          className="w-full h-full"
          aria-label="DRDO Official Logo"
        >
          <defs>
            {/* Outer Blue Ring Arcs for "D R D O" */}
            <path
              id="drdoTopOuterArc"
              d="M 24 100 A 76 76 0 0 1 176 100"
            />
            <path
              id="drdoBottomOuterArc"
              d="M 20 108 A 82 82 0 0 0 180 108"
            />

            {/* Middle White Ring Arcs for "DEFENCE R&D ORGANISATION" & "MINISTRY OF DEFENCE" */}
            <path
              id="drdoMidTopArc"
              d="M 42 102 A 58 58 0 0 1 158 102"
            />
            <path
              id="drdoMidBotArc"
              d="M 40 104 A 61 61 0 0 0 160 104"
            />

            {/* Inner Cream Medallion Motto Arc for "बलस्य मूलं विज्ञानम्" */}
            <path
              id="drdoInnerMottoArc"
              d="M 56 116 A 46 46 0 0 0 144 116"
            />
          </defs>

          {/* 1. OUTER ROYAL/NAVY BLUE RING */}
          <circle
            cx="100"
            cy="100"
            r="97"
            fill="#0d478a"
            stroke="#020617"
            strokeWidth="2.5"
          />

          {/* Top "D R D O" on Blue Ring */}
          <text
            fill="#ffffff"
            fontSize="23"
            fontWeight="900"
            fontFamily="Arial, Helvetica, sans-serif"
            letterSpacing="14"
          >
            <textPath
              href="#drdoTopOuterArc"
              startOffset="50%"
              textAnchor="middle"
            >
              DRDO
            </textPath>
          </text>

          {/* Bottom "D R D O" on Blue Ring */}
          <text
            fill="#ffffff"
            fontSize="23"
            fontWeight="900"
            fontFamily="Arial, Helvetica, sans-serif"
            letterSpacing="14"
          >
            <textPath
              href="#drdoBottomOuterArc"
              startOffset="50%"
              textAnchor="middle"
            >
              DRDO
            </textPath>
          </text>

          {/* Left & Right White 5-Pointed Stars on Outer Blue Ring */}
          <polygon
            points="16,97 18,103 24,103 19,107 21,113 16,109 11,113 13,107 8,103 14,103"
            fill="#ffffff"
          />
          <polygon
            points="184,97 186,103 192,103 187,107 189,113 184,109 179,113 181,107 176,103 182,103"
            fill="#ffffff"
          />

          {/* 2. MIDDLE WHITE RING WITH DOUBLE BLACK BORDERS */}
          <circle
            cx="100"
            cy="100"
            r="70"
            fill="#ffffff"
            stroke="#0f172a"
            strokeWidth="2.5"
          />
          <circle
            cx="100"
            cy="100"
            r="67"
            fill="none"
            stroke="#0f172a"
            strokeWidth="1.2"
          />

          {/* Top "DEFENCE R&D ORGANISATION" */}
          <text
            fill="#0f172a"
            fontSize="9.3"
            fontWeight="800"
            fontFamily="Arial, Helvetica, sans-serif"
            letterSpacing="0.7"
          >
            <textPath
              href="#drdoMidTopArc"
              startOffset="50%"
              textAnchor="middle"
            >
              DEFENCE R&amp;D ORGANISATION
            </textPath>
          </text>

          {/* Bottom "MINISTRY OF DEFENCE" */}
          <text
            fill="#0f172a"
            fontSize="10"
            fontWeight="800"
            fontFamily="Arial, Helvetica, sans-serif"
            letterSpacing="1.1"
          >
            <textPath
              href="#drdoMidBotArc"
              startOffset="50%"
              textAnchor="middle"
            >
              MINISTRY OF DEFENCE
            </textPath>
          </text>

          {/* Left & Right Red Stars in Middle White Ring */}
          <polygon
            points="43,111 44.5,115.5 49,115.5 45.5,118 47,122.5 43,119.8 39,122.5 40.5,118 37,115.5 41.5,115.5"
            fill="#dc2626"
          />
          <polygon
            points="157,111 158.5,115.5 163,115.5 159.5,118 161,122.5 157,119.8 153,122.5 154.5,118 151,115.5 155.5,115.5"
            fill="#dc2626"
          />

          {/* 3. INNER CREAM/YELLOW MEDALLION */}
          <circle
            cx="100"
            cy="100"
            r="51"
            fill="#fef9c3"
            stroke="#0f172a"
            strokeWidth="2.2"
          />

          {/* ASHOKA LION CAPITAL EMBLEM AT TOP OF INNER CIRCLE */}
          <g transform="translate(100, 66)">
            {/* Center & Side Lions */}
            <path
              d="M -6 -10 C -6 -14, 6 -14, 6 -10 L 7 -1 L -7 -1 Z"
              fill="#44403c"
              stroke="#1c1917"
              strokeWidth="0.8"
            />
            <circle cx="0" cy="-11.5" r="3" fill="#57534e" />
            <circle cx="-4.5" cy="-9" r="2.4" fill="#57534e" />
            <circle cx="4.5" cy="-9" r="2.4" fill="#57534e" />
            {/* Pedestal Base */}
            <rect
              x="-8"
              y="-1"
              width="16"
              height="4.5"
              rx="1"
              fill="#78716c"
              stroke="#1c1917"
              strokeWidth="0.8"
            />
            <circle cx="0" cy="1.2" r="1.6" fill="#fef9c3" />
            <text
              x="0"
              y="7.5"
              textAnchor="middle"
              fill="#1c1917"
              fontSize="3.6"
              fontWeight="bold"
            >
              सत्यमेव जयते
            </text>
          </g>

          {/* CROSSED MAROON SWORDS (Behind Wings & Gear) */}
          <g stroke="#1c1917" strokeWidth="0.8">
            {/* Sword 1: Bottom-Left to Top-Right */}
            <polygon
              points="69,124 72,127 128,74 131,70 126,72"
              fill="#991b1b"
            />
            {/* Sword 1 Hilt */}
            <path
              d="M 64 129 L 71 122 M 66 121 L 74 129"
              stroke="#991b1b"
              strokeWidth="3"
              strokeLinecap="round"
            />
            {/* Sword 2: Bottom-Right to Top-Left */}
            <polygon
              points="131,124 128,127 72,74 69,70 74,72"
              fill="#991b1b"
            />
            {/* Sword 2 Hilt */}
            <path
              d="M 136 129 L 129 122 M 134 121 L 126 129"
              stroke="#991b1b"
              strokeWidth="3"
              strokeLinecap="round"
            />
          </g>

          {/* NAVY BLUE ANCHOR (Center Vertical) */}
          <g fill="#1e3a8a" stroke="#0f172a" strokeWidth="0.9">
            {/* Anchor Ring at Top */}
            <circle cx="100" cy="80" r="3.2" fill="none" stroke="#1e3a8a" strokeWidth="2" />
            {/* Anchor Vertical Shank */}
            <rect x="98.2" y="83" width="3.6" height="42" rx="1" />
            {/* Curved Anchor Crown & Flukes at Bottom */}
            <path
              d="M 85 117 Q 100 132 115 117 L 112 114 L 116 112 L 118 118 Q 100 136 82 118 L 84 112 L 88 114 Z"
              fill="#1e3a8a"
            />
          </g>

          {/* SPREAD BLUE EAGLE WINGS (Left & Right) */}
          <g fill="#0284c7" stroke="#0f172a" strokeWidth="1">
            {/* Left Wing */}
            <path d="M 90 96 C 78 93, 66 88, 57 82 C 58 88, 62 93, 68 95 C 60 94, 58 98, 66 100 C 61 101, 63 105, 72 104 C 68 107, 74 109, 88 103 Z" />
            {/* Right Wing */}
            <path d="M 110 96 C 122 93, 134 88, 143 82 C 142 88, 138 93, 132 95 C 140 94, 142 98, 134 100 C 139 101, 137 105, 128 104 C 132 107, 126 109, 112 103 Z" />
          </g>

          {/* CENTRAL WHITE GEAR & SAFFRON/ORANGE SUN DISC */}
          <g transform="translate(100, 99)">
            {Array.from({ length: 12 }).map((_, i) => (
              <rect
                key={i}
                x="-2.2"
                y="-13.5"
                width="4.4"
                height="4"
                rx="0.8"
                fill="#ffffff"
                stroke="#0f172a"
                strokeWidth="0.9"
                transform={`rotate(${i * 30})`}
              />
            ))}
            <circle
              cx="0"
              cy="0"
              r="10.5"
              fill="#ffffff"
              stroke="#0f172a"
              strokeWidth="1.1"
            />
            <circle
              cx="0"
              cy="0"
              r="7.2"
              fill="#ea580c"
              stroke="#9a3412"
              strokeWidth="0.8"
            />
          </g>

          {/* SANSKRIT MOTTO "बलस्य मूलं विज्ञानम्" AT BOTTOM OF CREAM MEDALLION */}
          <text
            fill="#1c1917"
            fontSize="7.8"
            fontWeight="900"
            fontFamily="sans-serif"
          >
            <textPath
              href="#drdoInnerMottoArc"
              startOffset="50%"
              textAnchor="middle"
            >
              बलस्य मूलं विज्ञानम्
            </textPath>
          </text>
        </svg>
      </div>

      {showText && (
        <span className="text-sm font-extrabold tracking-widest text-white font-mono">
          DRDO
        </span>
      )}
    </div>
  );
}
