interface SkeletonProps {
  className?: string
}

export default function Skeleton({ className = '' }: SkeletonProps) {
  return <div className={`animate-pulse rounded bg-surface-700/50 ${className}`} />
}

export function SkeletonCard({ rows = 3 }: { rows?: number }) {
  return (
    <div className="overflow-hidden rounded-2xl border border-white/[0.06] bg-surface-800/40 p-4 space-y-2">
      {Array.from({ length: rows }, (_, i) => (
        <Skeleton key={i} className={`h-4 ${i === 0 ? 'w-24' : i === rows - 1 ? 'w-32' : 'w-full'}`} />
      ))}
    </div>
  )
}
