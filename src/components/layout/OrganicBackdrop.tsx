/** Soft jewel-tone blobs + faint line texture for a fluid, non-static background. */
export default function OrganicBackdrop() {
  return (
    <div
      className="pointer-events-none fixed inset-0 z-0 overflow-hidden"
      aria-hidden
      data-motion="decorative"
    >
      <div className="absolute inset-0 bg-gradient-to-b from-surface-850 via-surface-900 to-[#070b14]" />
      <div
        className="absolute -left-[20%] -top-[15%] h-[min(55vh,420px)] w-[min(85vw,520px)] rounded-[100%] bg-teal-700/25 blur-[100px] motion-safe:animate-blob-drift"
        style={{ animationDelay: '0s' }}
      />
      <div
        className="absolute -right-[25%] top-[8%] h-[min(50vh,400px)] w-[min(80vw,480px)] rounded-[100%] bg-violet-700/22 blur-[110px] motion-safe:animate-blob-drift-slow"
        style={{ animationDelay: '-6s' }}
      />
      <div
        className="absolute bottom-[-18%] left-[5%] h-[min(45vh,380px)] w-[min(95vw,560px)] rounded-[100%] bg-emerald-900/28 blur-[95px] motion-safe:animate-blob-drift-reverse"
        style={{ animationDelay: '-3s' }}
      />
      <div className="absolute inset-0 bg-[radial-gradient(ellipse_120%_80%_at_50%_-20%,rgba(165,96,232,0.12),transparent_55%)]" />
      <svg
        className="absolute inset-0 h-full w-full opacity-[0.14]"
        xmlns="http://www.w3.org/2000/svg"
        viewBox="0 0 1200 400"
        preserveAspectRatio="none"
      >
        <defs>
          <linearGradient id="backdrop-flow" x1="0%" y1="0%" x2="100%" y2="100%">
            <stop offset="0%" stopColor="#2dd4bf" stopOpacity="0.5" />
            <stop offset="50%" stopColor="#a78bfa" stopOpacity="0.35" />
            <stop offset="100%" stopColor="#34d399" stopOpacity="0.4" />
          </linearGradient>
        </defs>
        <path
          d="M0,120 Q180,40 360,100 T720,80 T1080,130 L1080,0 L0,0 Z"
          fill="url(#backdrop-flow)"
          opacity="0.15"
        />
        <path
          d="M0,280 Q240,220 480,260 T960,240 L960,400 L0,400 Z"
          fill="none"
          stroke="url(#backdrop-flow)"
          strokeWidth="0.8"
          opacity="0.35"
        />
        <path
          d="M0,200 Q200,260 400,200 T800,220"
          fill="none"
          stroke="url(#backdrop-flow)"
          strokeWidth="0.5"
          opacity="0.25"
        />
      </svg>
      <div
        className="absolute inset-0 opacity-[0.04]"
        style={{
          backgroundImage: `radial-gradient(circle at 1px 1px, rgba(248,250,252,0.9) 1px, transparent 0)`,
          backgroundSize: '28px 28px',
        }}
      />
    </div>
  )
}
