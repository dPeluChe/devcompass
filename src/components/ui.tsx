import { type ReactNode } from 'react'
import { motion, AnimatePresence } from 'framer-motion'
import './ui.css'

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

interface FadeInProps {
  children: ReactNode
  delay?: number
  className?: string
}

export function FadeIn({ children, delay = 0, className = '' }: FadeInProps) {
  return (
    <motion.div
      initial={{ opacity: 0, y: 12 }}
      animate={{ opacity: 1, y: 0 }}
      transition={{ duration: 0.35, delay, ease: [0.25, 0.1, 0.25, 1] }}
      className={className}
    >
      {children}
    </motion.div>
  )
}

interface SlideInProps {
  children: ReactNode
  direction?: 'left' | 'right' | 'up' | 'down'
  className?: string
}

export function SlideIn({ children, direction = 'right', className = '' }: SlideInProps) {
  const dirs = {
    left: { x: -40, y: 0 },
    right: { x: 40, y: 0 },
    up: { x: 0, y: -40 },
    down: { x: 0, y: 40 }
  }
  return (
    <motion.div
      initial={{ opacity: 0, ...dirs[direction] }}
      animate={{ opacity: 1, x: 0, y: 0 }}
      transition={{ duration: 0.25, ease: 'easeOut' }}
      className={className}
    >
      {children}
    </motion.div>
  )
}

interface StaggerProps {
  children: ReactNode
  stagger?: number
  className?: string
}

export function Stagger({ children, stagger = 0.05, className = '' }: StaggerProps) {
  return (
    <motion.div
      initial="initial"
      animate="animate"
      variants={{
        animate: { transition: { staggerChildren: stagger } }
      }}
      className={className}
    >
      {children}
    </motion.div>
  )
}

export function StaggerItem({ children, className = '' }: { children: ReactNode; className?: string }) {
  return (
    <motion.div
      variants={{ initial: { opacity: 0, y: 8 }, animate: { opacity: 1, y: 0 } }}
      className={className}
    >
      {children}
    </motion.div>
  )
}

interface PageTransitionProps {
  children: ReactNode
  key?: string
}

export function PageTransition({ children, key: k }: PageTransitionProps) {
  return (
    <AnimatePresence mode="wait">
      <motion.div
        key={k}
        initial={{ opacity: 0, x: 8 }}
        animate={{ opacity: 1, x: 0 }}
        exit={{ opacity: 0, x: -8 }}
        transition={{ duration: 0.2 }}
      >
        {children}
      </motion.div>
    </AnimatePresence>
  )
}

interface TabTransitionProps {
  active: number
  children: ReactNode[]
}

export function TabTransition({ active, children }: TabTransitionProps) {
  return (
    <AnimatePresence mode="wait">
      <motion.div
        key={active}
        initial={{ opacity: 0 }}
        animate={{ opacity: 1 }}
        exit={{ opacity: 0 }}
        transition={{ duration: 0.15 }}
      >
        {children[active]}
      </motion.div>
    </AnimatePresence>
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
    <motion.div
      animate={{ opacity: [0.5, 1, 0.5] }}
      transition={{ duration: 1.5, repeat: Infinity }}
      className={className}
    >
      {children}
    </motion.div>
  )
}

interface AvatarProps {
  src?: string | null
  alt?: string
  size?: number
  fallback?: string
}

export function Avatar({ src, alt = '', size = 32, fallback }: AvatarProps) {
  const initials = fallback || (alt ? alt.charAt(0).toUpperCase() : '?')
  return (
    <div className="ui-avatar" style={{ width: size, height: size }}>
      {src ? (
        <img src={src} alt={alt} style={{ width: size, height: size }} />
      ) : (
        <span style={{ fontSize: size * 0.45 }}>{initials}</span>
      )}
    </div>
  )
}

interface BadgeProps {
  children: ReactNode
  variant?: 'default' | 'success' | 'warning' | 'danger' | 'info'
  className?: string
}

export function Badge({ children, variant = 'default', className = '' }: BadgeProps) {
  return <span className={`ui-badge ${variant} ${className}`}>{children}</span>
}

interface ButtonProps {
  children: ReactNode
  onClick?: () => void
  variant?: 'primary' | 'secondary' | 'ghost' | 'danger'
  size?: 'sm' | 'md' | 'lg'
  disabled?: boolean
  loading?: boolean
  className?: string
}

export function Button({
  children,
  onClick,
  variant = 'secondary',
  size = 'md',
  disabled,
  loading,
  className = ''
}: ButtonProps) {
  return (
    <button
      className={`ui-button ${variant} ${size} ${loading ? 'loading' : ''} ${className}`}
      onClick={onClick}
      disabled={disabled || loading}
    >
      {loading && <Spinner size={16} />}
      {children}
    </button>
  )
}

interface InputProps {
  value: string
  onChange: (value: string) => void
  placeholder?: string
  type?: 'text' | 'search' | 'password'
  icon?: ReactNode
  className?: string
}

export function Input({ value, onChange, placeholder, type = 'text', icon, className = '' }: InputProps) {
  return (
    <div className={`ui-input-wrapper ${className}`}>
      {icon && <span className="ui-input-icon">{icon}</span>}
      <input
        type={type}
        value={value}
        onChange={(e) => onChange(e.target.value)}
        placeholder={placeholder}
        className={`ui-input ${icon ? 'with-icon' : ''}`}
      />
    </div>
  )
}

interface FlexProps {
  children: ReactNode
  gap?: number
  align?: 'start' | 'center' | 'end' | 'stretch'
  justify?: 'start' | 'center' | 'end' | 'between'
  direction?: 'row' | 'column'
  className?: string
}

export function Flex({
  children,
  gap = 8,
  align = 'center',
  justify = 'start',
  direction = 'row',
  className = ''
}: FlexProps) {
  return (
    <div
      className={`flex ${direction} ${className}`}
      style={{
        gap,
        alignItems: align,
        justifyContent: justify === 'between' ? 'space-between' : justify
      }}
    >
      {children}
    </div>
  )
}

export function Divider({ className = '' }: { className?: string }) {
  return <div className={`ui-divider ${className}`} />
}