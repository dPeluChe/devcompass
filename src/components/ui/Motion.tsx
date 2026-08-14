import { type ReactNode } from 'react'
import { m, AnimatePresence } from 'framer-motion'

interface FadeInProps {
  children: ReactNode
  delay?: number
  className?: string
}

export function FadeIn({ children, delay = 0, className = '' }: FadeInProps) {
  return (
    <m.div
      initial={{ opacity: 0, y: 12 }}
      animate={{ opacity: 1, y: 0 }}
      transition={{ duration: 0.35, delay, ease: [0.25, 0.1, 0.25, 1] }}
      className={className}
    >
      {children}
    </m.div>
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
    <m.div
      initial={{ opacity: 0, ...dirs[direction] }}
      animate={{ opacity: 1, x: 0, y: 0 }}
      transition={{ duration: 0.25, ease: 'easeOut' }}
      className={className}
    >
      {children}
    </m.div>
  )
}

interface StaggerProps {
  children: ReactNode
  stagger?: number
  className?: string
}

export function Stagger({ children, stagger = 0.05, className = '' }: StaggerProps) {
  return (
    <m.div
      initial="initial"
      animate="animate"
      variants={{
        animate: { transition: { staggerChildren: stagger } }
      }}
      className={className}
    >
      {children}
    </m.div>
  )
}

export function StaggerItem({ children, className = '' }: { children: ReactNode; className?: string }) {
  return (
    <m.div
      variants={{ initial: { opacity: 0, y: 8 }, animate: { opacity: 1, y: 0 } }}
      className={className}
    >
      {children}
    </m.div>
  )
}

interface PageTransitionProps {
  children: ReactNode
  key?: string
}

export function PageTransition({ children, key: k }: PageTransitionProps) {
  return (
    <AnimatePresence mode="wait">
      <m.div
        key={k}
        initial={{ opacity: 0, x: 8 }}
        animate={{ opacity: 1, x: 0 }}
        exit={{ opacity: 0, x: -8 }}
        transition={{ duration: 0.2 }}
      >
        {children}
      </m.div>
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
      <m.div
        key={active}
        initial={{ opacity: 0 }}
        animate={{ opacity: 1 }}
        exit={{ opacity: 0 }}
        transition={{ duration: 0.15 }}
      >
        {children[active]}
      </m.div>
    </AnimatePresence>
  )
}
