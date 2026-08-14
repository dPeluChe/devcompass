import { type ReactNode } from 'react'
import { m } from 'framer-motion'

interface SkeletonProps {
  width?: string | number
  height?: string | number
  radius?: string | number
  className?: string
}

export function Skeleton({ width = '100%', height = 20, radius = 6, className = '' }: SkeletonProps) {
  return (
    <div
      className={`skeleton ${className}`}
      style={{
        width: typeof width === 'number' ? `${width}px` : width,
        height: typeof height === 'number' ? `${height}px` : height,
        borderRadius: typeof radius === 'number' ? `${radius}px` : radius
      }}
    />
  )
}

export function CardSkeleton() {
  return (
    <div className="card-skeleton">
      <Skeleton height={18} width="60%" />
      <Skeleton height={14} width="30%" />
      <Skeleton height={48} />
      <div className="card-skeleton-footer">
        <Skeleton height={12} width={80} />
        <Skeleton height={12} width={60} />
      </div>
    </div>
  )
}

export function ListSkeleton({ count = 5 }: { count?: number }) {
  return (
    <div className="list-skeleton">
      {Array.from({ length: count }).map((_, i) => (
        <CardSkeleton key={i} />
      ))}
    </div>
  )
}

interface SpinnerProps {
  size?: number
  className?: string
}

export function Spinner({ size = 24, className = '' }: SpinnerProps) {
  return (
    <div className={`spinner ${className}`} style={{ width: size, height: size }}>
      <svg viewBox="0 0 24 24" fill="none">
        <circle cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="2" opacity="0.25" />
        <path
          d="M12 2a10 10 0 0 1 10 10"
          stroke="currentColor"
          strokeWidth="2"
          strokeLinecap="round"
        />
      </svg>
    </div>
  )
}

interface PulseProps {
  children: ReactNode
  className?: string
}

export function Pulse({ children, className = '' }: PulseProps) {
  return (
    <m.div
      animate={{ opacity: [0.5, 1, 0.5] }}
      transition={{ duration: 1.5, repeat: Infinity }}
      className={className}
    >
      {children}
    </m.div>
  )
}
