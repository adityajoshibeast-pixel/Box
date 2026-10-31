import React, { useState } from "react";

export default function HalloweenDecorations() {
  const [spooked, setSpooked] = useState(false);

  const triggerSpook = () => {
    setSpooked(true);
    setTimeout(() => setSpooked(false), 900);
  };

  return (
    <div className="halloween-decorations" aria-hidden="true">
      {/* Eerie Glowing Full Moon */}
      <div className="halloween-moon">
        <div className="moon-crater moon-crater-1" />
        <div className="moon-crater moon-crater-2" />
        <div className="moon-crater moon-crater-3" />
        <div className="moon-glow" />
      </div>

      {/* Flying Witch silhouette across the sky */}
      <div className="halloween-witch">
        <svg viewBox="0 0 100 80" className="witch-svg" fill="currentColor">
          <line x1="8" y1="58" x2="92" y2="38" stroke="#1f1105" strokeWidth="3" strokeLinecap="round" />
          <path d="M8 58 L0 68 L14 62 L3 72 L18 60 Z" fill="#d97706" />
          <path d="M48 44 C42 42 36 48 32 54 L62 48 C58 45 54 44 48 44 Z" fill="#180b2a" />
          <path d="M52 35 C52 40 45 46 42 50 C46 51 54 48 57 43 Z" fill="#2d134d" />
          <circle cx="56" cy="30" r="5" fill="#a7f3d0" />
          <polygon points="59,31 64,32 59,34" fill="#a7f3d0" />
          <ellipse cx="56" cy="27" rx="13" ry="3" fill="#120422" transform="rotate(-12 56 27)" />
          <polygon points="48,26 62,23 60,8 55,7" fill="#1a0833" />
          <path d="M50 25 L61 23" stroke="#f59e0b" strokeWidth="2" />
          <path d="M42 40 C32 42 22 46 16 52 C24 50 34 47 42 45 Z" fill="#6d28d9" opacity="0.8" />
        </svg>
      </div>

      {/* Floating Ghost #1 - Friendly & Glowing */}
      <div className="halloween-ghost ghost-primary">
        <svg viewBox="0 0 80 100" className="ghost-svg">
          <defs>
            <radialGradient id="ghostGlow" cx="50%" cy="40%" r="60%">
              <stop offset="0%" stopColor="#ffffff" stopOpacity="0.95" />
              <stop offset="70%" stopColor="#d8b4fe" stopOpacity="0.75" />
              <stop offset="100%" stopColor="#a855f7" stopOpacity="0" />
            </radialGradient>
            <filter id="ghostAura" x="-20%" y="-20%" width="140%" height="140%">
              <feGaussianBlur in="SourceGraphic" stdDeviation="3" result="blur" />
              <feMerge>
                <feMergeNode in="blur" />
                <feMergeNode in="SourceGraphic" />
              </feMerge>
            </filter>
          </defs>
          <path
            d="M 40 10 
               C 22 10, 14 28, 14 46
               C 14 62, 10 74, 16 88
               C 22 92, 28 82, 34 88
               C 40 94, 46 84, 52 88
               C 58 92, 64 82, 70 86
               C 74 72, 66 60, 66 46
               C 66 28, 58 10, 40 10 Z"
            fill="url(#ghostGlow)"
            filter="url(#ghostAura)"
          />
          <path d="M 16 48 C 6 44, 4 52, 14 56" fill="none" stroke="#d8b4fe" strokeWidth="4" strokeLinecap="round" />
          <path d="M 64 48 C 74 44, 76 52, 66 56" fill="none" stroke="#d8b4fe" strokeWidth="4" strokeLinecap="round" />
          <ellipse cx="32" cy="36" rx="3.5" ry="5.5" fill="#2e1065" />
          <ellipse cx="48" cy="36" rx="3.5" ry="5.5" fill="#2e1065" />
          <circle cx="31" cy="34" r="1.5" fill="#ffffff" />
          <circle cx="47" cy="34" r="1.5" fill="#ffffff" />
          <ellipse cx="40" cy="48" rx="3" ry="5" fill="#2e1065" />
          <ellipse cx="27" cy="42" rx="3" ry="1.5" fill="#f472b6" opacity="0.6" />
          <ellipse cx="53" cy="42" rx="3" ry="1.5" fill="#f472b6" opacity="0.6" />
        </svg>
      </div>

      {/* Floating Ghost #2 - Playful Mini Ghost */}
      <div className="halloween-ghost ghost-secondary">
        <svg viewBox="0 0 60 80" className="ghost-svg mini-ghost">
          <path
            d="M 30 10 
               C 16 10, 10 24, 10 38
               C 10 52, 6 62, 12 72
               C 18 76, 24 68, 30 72
               C 36 76, 42 68, 48 72
               C 52 62, 50 50, 50 38
               C 50 24, 44 10, 30 10 Z"
            fill="rgba(243, 232, 255, 0.85)"
            filter="drop-shadow(0 0 10px rgba(192, 132, 252, 0.7))"
          />
          <circle cx="24" cy="30" r="2.5" fill="#3b0764" />
          <circle cx="36" cy="30" r="2.5" fill="#3b0764" />
          <path d="M 27 38 Q 30 43 33 38" stroke="#3b0764" strokeWidth="2" fill="none" strokeLinecap="round" />
        </svg>
      </div>

      {/* Animated Flying Bats */}
      <div className="halloween-bat bat-1">
        <div className="bat-body">
          <svg viewBox="0 0 64 40" className="bat-svg">
            <g fill="#180b28">
              <path
                className="bat-wing wing-left"
                d="M 32 20 C 26 8, 14 4, 2 12 C 6 20, 14 24, 18 20 C 18 26, 26 28, 32 22 Z"
              />
              <path
                className="bat-wing wing-right"
                d="M 32 20 C 38 8, 50 4, 62 12 C 58 20, 50 24, 46 20 C 46 26, 38 28, 32 22 Z"
              />
              <ellipse cx="32" cy="20" rx="4.5" ry="8" />
              <polygon points="29,14 31,8 33,14" />
              <polygon points="31,14 33,8 35,14" />
              <circle cx="30.5" cy="15" r="1" fill="#ff0055" />
              <circle cx="33.5" cy="15" r="1" fill="#ff0055" />
            </g>
          </svg>
        </div>
      </div>

      <div className="halloween-bat bat-2">
        <div className="bat-body">
          <svg viewBox="0 0 64 40" className="bat-svg">
            <g fill="#12061e">
              <path
                className="bat-wing wing-left"
                d="M 32 20 C 26 8, 14 4, 2 12 C 6 20, 14 24, 18 20 C 18 26, 26 28, 32 22 Z"
              />
              <path
                className="bat-wing wing-right"
                d="M 32 20 C 38 8, 50 4, 62 12 C 58 20, 50 24, 46 20 C 46 26, 38 28, 32 22 Z"
              />
              <ellipse cx="32" cy="20" rx="4.5" ry="8" />
              <polygon points="29,14 31,8 33,14" />
              <polygon points="31,14 33,8 35,14" />
              <circle cx="30.5" cy="15" r="0.9" fill="#ff3b00" />
              <circle cx="33.5" cy="15" r="0.9" fill="#ff3b00" />
            </g>
          </svg>
        </div>
      </div>

      <div className="halloween-bat bat-3">
        <div className="bat-body">
          <svg viewBox="0 0 64 40" className="bat-svg">
            <g fill="#1a0a2a">
              <path
                className="bat-wing wing-left"
                d="M 32 20 C 26 8, 14 4, 2 12 C 6 20, 14 24, 18 20 C 18 26, 26 28, 32 22 Z"
              />
              <path
                className="bat-wing wing-right"
                d="M 32 20 C 38 8, 50 4, 62 12 C 58 20, 50 24, 46 20 C 46 26, 38 28, 32 22 Z"
              />
              <ellipse cx="32" cy="20" rx="4" ry="7" />
              <circle cx="30.5" cy="15" r="0.8" fill="#ffaa00" />
              <circle cx="33.5" cy="15" r="0.8" fill="#ffaa00" />
            </g>
          </svg>
        </div>
      </div>

      {/* Spiderweb & Hanging Animated Spider (Top Corner) */}
      <div className="halloween-corner-web">
        <svg viewBox="0 0 160 160" className="corner-web-svg">
          <path d="M0,0 L160,0 M0,0 L145,55 M0,0 L115,115 M0,0 L55,145 M0,0 L0,160" stroke="rgba(243, 232, 255, 0.28)" strokeWidth="1.5" />
          <path d="M 40,0 Q 36,20 0,40" stroke="rgba(243, 232, 255, 0.25)" strokeWidth="1.2" fill="none" />
          <path d="M 80,0 Q 72,40 0,80" stroke="rgba(243, 232, 255, 0.25)" strokeWidth="1.2" fill="none" />
          <path d="M 120,0 Q 105,60 0,120" stroke="rgba(243, 232, 255, 0.25)" strokeWidth="1.2" fill="none" />
          <path d="M 160,0 Q 140,80 0,160" stroke="rgba(243, 232, 255, 0.25)" strokeWidth="1.2" fill="none" />
        </svg>

        <div className="hanging-spider">
          <div className="spider-thread" />
          <div className="spider-body">
            <svg viewBox="0 0 40 40" className="spider-svg">
              <g fill="#1c0f2b">
                <path d="M 14 18 C 6 12, 4 22, 2 28" stroke="#3b1d5c" strokeWidth="2" fill="none" />
                <path d="M 14 20 C 6 18, 4 26, 4 34" stroke="#3b1d5c" strokeWidth="2" fill="none" />
                <path d="M 26 18 C 34 12, 36 22, 38 28" stroke="#3b1d5c" strokeWidth="2" fill="none" />
                <path d="M 26 20 C 34 18, 36 26, 36 34" stroke="#3b1d5c" strokeWidth="2" fill="none" />
                <path d="M 15 15 C 8 8, 10 2, 6 0" stroke="#3b1d5c" strokeWidth="2" fill="none" />
                <path d="M 25 15 C 32 8, 30 2, 34 0" stroke="#3b1d5c" strokeWidth="2" fill="none" />
                <circle cx="20" cy="22" r="7" fill="#2d1348" />
                <circle cx="20" cy="14" r="4.5" fill="#4c1d95" />
                <circle cx="18.5" cy="13" r="1" fill="#ef4444" />
                <circle cx="21.5" cy="13" r="1" fill="#ef4444" />
                <circle cx="17" cy="15" r="0.7" fill="#f87171" />
                <circle cx="23" cy="15" r="0.7" fill="#f87171" />
              </g>
            </svg>
          </div>
        </div>
      </div>

      {/* Carved Glowing Jack-o'-Lantern (Interactive) */}
      <div
        className="halloween-pumpkin-container"
        onClick={triggerSpook}
        role="button"
        tabIndex={0}
        aria-label="Spooky animated pumpkin"
      >
        <div className={`halloween-pumpkin ${spooked ? "is-spooked" : ""}`}>
          <svg viewBox="0 0 100 90" className="pumpkin-svg">
            <defs>
              <radialGradient id="pumpkinGrad" cx="50%" cy="50%" r="50%">
                <stop offset="0%" stopColor="#ff8a00" />
                <stop offset="85%" stopColor="#e55300" />
                <stop offset="100%" stopColor="#9e2a00" />
              </radialGradient>
              <filter id="flickerGlow">
                <feGaussianBlur stdDeviation="2.5" result="coloredBlur" />
                <feMerge>
                  <feMergeNode in="coloredBlur" />
                  <feMergeNode in="SourceGraphic" />
                </feMerge>
              </filter>
            </defs>
            <path d="M 48 20 C 47 10, 54 4, 62 2 C 60 7, 56 12, 53 20 Z" fill="#2d6a4f" />
            <path d="M 46 16 Q 40 14 38 18" stroke="#52b788" strokeWidth="2" fill="none" />
            <ellipse cx="28" cy="52" rx="20" ry="28" fill="#d94e00" />
            <ellipse cx="72" cy="52" rx="20" ry="28" fill="#d94e00" />
            <ellipse cx="38" cy="54" rx="18" ry="30" fill="url(#pumpkinGrad)" />
            <ellipse cx="62" cy="54" rx="18" ry="30" fill="url(#pumpkinGrad)" />
            <ellipse cx="50" cy="55" rx="17" ry="31" fill="url(#pumpkinGrad)" />

            <g className="pumpkin-carved-face" filter="url(#flickerGlow)">
              <polygon points="32,42 42,42 36,32" fill="#fff3b0" />
              <polygon points="58,42 68,42 64,32" fill="#fff3b0" />
              <polygon points="46,50 54,50 50,44" fill="#ffe484" />
              <path
                d="M 28 60 
                   L 34 66 L 38 60 L 44 67 L 50 59 L 56 67 L 62 60 L 68 66 L 72 60
                   Q 50 82 28 60 Z"
                fill="#fff3b0"
              />
            </g>
          </svg>
        </div>
      </div>

      {/* Floating Spooky Embers / Fog Particles */}
      <div className="halloween-fog-layer">
        <span className="fog-particle fp-1" />
        <span className="fog-particle fp-2" />
        <span className="fog-particle fp-3" />
        <span className="fog-particle fp-4" />
        <span className="fog-particle fp-5" />
      </div>
    </div>
  );
}
