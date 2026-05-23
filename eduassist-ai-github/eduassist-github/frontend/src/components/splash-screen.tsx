import { useState } from "react";

interface SplashScreenProps {
  onEnter: () => void;
}

export function SplashScreen({ onEnter }: SplashScreenProps) {
  const [exiting, setExiting] = useState(false);

  const handleEnter = () => {
    setExiting(true);
    setTimeout(onEnter, 600);
  };

  return (
    <>
      <style>{`
        @keyframes floatUp {
          0%, 100% { transform: translateY(0px) rotate(var(--rot, -12deg)); }
          50%       { transform: translateY(-18px) rotate(var(--rot, -12deg)); }
        }
        @keyframes floatDown {
          0%, 100% { transform: translateY(0px) rotate(var(--rot, 8deg)); }
          50%       { transform: translateY(18px) rotate(var(--rot, 8deg)); }
        }
        @keyframes splashFadeUp {
          from { opacity: 0; transform: translateY(24px); }
          to   { opacity: 1; transform: translateY(0); }
        }
        @keyframes splashFadeIn {
          from { opacity: 0; }
          to   { opacity: 1; }
        }
        @keyframes btnGlow {
          0%, 100% { box-shadow: 0 0 28px 8px rgba(59,130,246,0.52), 0 0 64px 18px rgba(96,165,250,0.28); }
          50%       { box-shadow: 0 0 48px 16px rgba(59,130,246,0.72), 0 0 96px 30px rgba(96,165,250,0.4); }
        }
        @keyframes exitAnim {
          from { opacity: 1; }
          to   { opacity: 0; }
        }

        .splash-blob {
          position: absolute;
          border-radius: 48% 52% 58% 42% / 44% 48% 52% 56%;
          background: rgba(255,255,255,0.75);
          border: 1px solid rgba(255,255,255,0.92);
          box-shadow: 0 8px 40px rgba(147,197,253,0.2), inset 0 1px 0 rgba(255,255,255,0.85);
        }
        .blob-tl { width:340px; height:220px; top:-60px; left:-80px; --rot:-14deg; animation: floatUp 7s ease-in-out infinite; }
        .blob-tr { width:200px; height:140px; top:30px; right:-40px; --rot:10deg; animation: floatDown 8s ease-in-out infinite; }
        .blob-tr2 { width:140px; height:90px; top:180px; right:60px; --rot:-6deg; animation: floatUp 6s ease-in-out infinite 1s; }
        .blob-ml { width:120px; height:80px; top:42%; left:30px; --rot:14deg; animation: floatDown 9s ease-in-out infinite 0.5s; }
        .blob-br { width:360px; height:230px; bottom:-70px; right:-90px; --rot:16deg; animation: floatUp 8s ease-in-out infinite 0.3s; }
        .blob-bl { width:180px; height:120px; bottom:60px; left:-30px; --rot:-10deg; animation: floatDown 7s ease-in-out infinite 1.2s; }
        .blob-bc { width:100px; height:70px; bottom:140px; left:38%; --rot:4deg; animation: floatUp 10s ease-in-out infinite 0.8s; }

        .splash-root { animation: splashFadeIn 0.45s ease forwards; }
        .splash-root.exiting { animation: exitAnim 0.55s ease forwards; }

        .anim-1 { animation: splashFadeUp 0.55s ease forwards; animation-delay: 0.1s; opacity: 0; }
        .anim-2 { animation: splashFadeUp 0.55s ease forwards; animation-delay: 0.28s; opacity: 0; }
        .anim-3 { animation: splashFadeUp 0.55s ease forwards; animation-delay: 0.46s; opacity: 0; }
        .anim-4 { animation: splashFadeUp 0.55s ease forwards; animation-delay: 0.62s; opacity: 0; }
        .anim-5 { animation: splashFadeIn 0.5s ease forwards; animation-delay: 0.75s; opacity: 0; }

        .splash-btn-inner {
          animation: btnGlow 2.6s ease-in-out infinite;
          transition: transform 0.15s ease, filter 0.15s ease;
          cursor: pointer;
          display: block;
          width: 100%;
          border: none;
          outline: none;
        }
        .splash-btn-inner:hover { transform: scale(1.05); filter: brightness(1.1); }
        .splash-btn-inner:active { transform: scale(0.97); }
      `}</style>

      <div
        className={`splash-root fixed inset-0 z-50 flex flex-col${exiting ? " exiting" : ""}`}
        style={{ background: "linear-gradient(160deg,#d4e9ff 0%,#eaf4ff 30%,#f2f8ff 55%,#cce3ff 100%)" }}
      >
        {/* Blobs */}
        <div className="splash-blob blob-tl" />
        <div className="splash-blob blob-tr" />
        <div className="splash-blob blob-tr2" />
        <div className="splash-blob blob-ml" />
        <div className="splash-blob blob-br" />
        <div className="splash-blob blob-bl" />
        <div className="splash-blob blob-bc" />

        {/* Navbar */}
        <nav className="anim-1 relative z-10 flex items-center justify-between px-8 py-5">
          <div className="flex items-center gap-2">
            <div
              className="w-8 h-8 rounded-lg flex items-center justify-center"
              style={{ background: "linear-gradient(135deg,#3b82f6,#60a5fa)", boxShadow: "0 2px 10px rgba(59,130,246,0.35)" }}
            >
              <svg viewBox="0 0 24 24" fill="none" className="w-5 h-5">
                <path d="M12 3L2 8l10 5 10-5-10-5z" fill="white"/>
                <path d="M2 17l10 5 10-5" stroke="white" strokeWidth="1.8" strokeLinecap="round"/>
                <path d="M2 12l10 5 10-5" stroke="white" strokeWidth="1.8" strokeLinecap="round"/>
              </svg>
            </div>
            <span className="font-bold text-base tracking-wide" style={{ color: "#1e3a8a" }}>ALLIN</span>
          </div>
          <div className="flex items-center gap-7 text-sm font-medium" style={{ color: "#475569" }}>
            <span>Home</span>
            <span>About</span>
            <span>Services</span>
            <a href="mailto:raiboos432@gmail.com" style={{ color: "#2563eb", textDecoration: "none" }}>Contact</a>
          </div>
        </nav>

        {/* Center content */}
        <div className="relative z-10 flex-1 flex flex-col items-center justify-center text-center px-6">

          <p className="anim-2 text-sm font-medium mb-3" style={{ color: "#64748b" }}>
            Generated by Pritam
          </p>

          <h1 className="anim-3 font-bold leading-tight mb-1" style={{ fontSize: "clamp(28px,5vw,42px)", color: "#0f172a" }}>
            Powered by <span style={{ color: "#2563eb" }}>ALLIN</span>
          </h1>
          <h2 className="anim-3 font-bold mb-10" style={{ fontSize: "clamp(22px,4vw,34px)", color: "#0f172a" }}>
            Company, From Bihar
          </h2>

          {/* Button wrapper handles fade-in; inner button handles glow */}
          <div className="anim-4">
            <button
              className="splash-btn-inner relative rounded-full"
              style={{
                background: "linear-gradient(135deg,#2563eb 0%,#5eaaff 50%,#3b82f6 100%)",
                padding: "18px 56px",
                minWidth: 230,
                borderRadius: 999,
              }}
              onClick={handleEnter}
            >
              {/* shine overlay */}
              <span
                className="absolute inset-0 pointer-events-none"
                style={{
                  borderRadius: 999,
                  background: "linear-gradient(180deg,rgba(255,255,255,0.3) 0%,transparent 55%)",
                }}
              />
              <span
                className="relative z-10 font-bold text-white"
                style={{ fontSize: 15, letterSpacing: "0.16em", textTransform: "uppercase", lineHeight: 1.4 }}
              >
                GET STUDY<br />TO GO
              </span>
            </button>
          </div>
        </div>

        {/* Footer */}
        <div className="anim-5 relative z-10 flex flex-col items-center gap-3 pb-6">
          <div className="flex items-center gap-4">
            <svg viewBox="0 0 24 24" className="w-4 h-4" fill="#94a3b8"><path d="M18.244 2.25h3.308l-7.227 8.26 8.502 11.24H16.17l-4.714-6.231-5.401 6.231H2.742l7.733-8.835L1.254 2.25H8.08l4.259 5.63 5.905-5.63zm-1.161 17.52h1.833L7.084 4.126H5.117z"/></svg>
            <svg viewBox="0 0 24 24" className="w-4 h-4" fill="#94a3b8"><path d="M24 12.073c0-6.627-5.373-12-12-12s-12 5.373-12 12c0 5.99 4.388 10.954 10.125 11.854v-8.385H7.078v-3.47h3.047V9.43c0-3.007 1.792-4.669 4.533-4.669 1.312 0 2.686.235 2.686.235v2.953H15.83c-1.491 0-1.956.925-1.956 1.874v2.25h3.328l-.532 3.47h-2.796v8.385C19.612 23.027 24 18.062 24 12.073z"/></svg>
            <svg viewBox="0 0 24 24" className="w-4 h-4" fill="#94a3b8"><path d="M11.944 0A12 12 0 0 0 0 12a12 12 0 0 0 12 12 12 12 0 0 0 12-12A12 12 0 0 0 12 0a12 12 0 0 0-.056 0zm4.962 7.224c.1-.002.321.023.465.14a.506.506 0 0 1 .171.325c.016.093.036.306.02.472-.18 1.898-.962 6.502-1.36 8.627-.168.9-.499 1.201-.82 1.23-.696.065-1.225-.46-1.9-.902-1.056-.693-1.653-1.124-2.678-1.8-1.185-.78-.417-1.21.258-1.91.177-.184 3.247-2.977 3.307-3.23.007-.032.014-.15-.056-.212s-.174-.041-.249-.024c-.106.024-1.793 1.14-5.061 3.345-.48.33-.913.49-1.302.48-.428-.008-1.252-.241-1.865-.44-.752-.245-1.349-.374-1.297-.789.027-.216.325-.437.893-.663 3.498-1.524 5.83-2.529 6.998-3.014 3.332-1.386 4.025-1.627 4.476-1.635z"/></svg>
            <svg viewBox="0 0 24 24" className="w-4 h-4" fill="#94a3b8"><path d="M23.498 6.186a3.016 3.016 0 0 0-2.122-2.136C19.505 3.545 12 3.545 12 3.545s-7.505 0-9.377.505A3.017 3.017 0 0 0 .502 6.186C0 8.07 0 12 0 12s0 3.93.502 5.814a3.016 3.016 0 0 0 2.122 2.136c1.871.505 9.376.505 9.376.505s7.505 0 9.377-.505a3.015 3.015 0 0 0 2.122-2.136C24 15.93 24 12 24 12s0-3.93-.502-5.814zM9.545 15.568V8.432L15.818 12l-6.273 3.568z"/></svg>
          </div>
          <p className="text-xs" style={{ color: "#94a3b8" }}>© Copyright · All rights reserved</p>
        </div>
      </div>
    </>
  );
}
