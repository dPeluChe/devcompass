import { type ReactNode } from 'react'
import { Spinner } from './Skeletons'

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
