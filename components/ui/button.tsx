import * as React from 'react'
import { cn } from '@/lib/utils'

type Variant = 'default' | 'outline' | 'ghost' | 'destructive'
type Size = 'default' | 'sm' | 'lg' | 'icon'

export interface ButtonProps
  extends React.ButtonHTMLAttributes<HTMLButtonElement> {
  variant?: Variant
  size?: Size
}

const variantClasses: Record<Variant, string> = {
  default:
    'bg-primary text-primary-foreground hover:bg-primary-hover',
  outline:
    'border border-input bg-background hover:bg-muted',
  ghost: 'hover:bg-muted',
  destructive:
    'bg-destructive text-destructive-foreground hover:bg-destructive/90',
}

const sizeClasses: Record<Size, string> = {
  default: 'h-10 px-4 py-2',
  sm: 'h-9 px-3',
  lg: 'h-11 px-8',
  icon: 'h-10 w-10',
}

export const Button = React.forwardRef<HTMLButtonElement, ButtonProps>(
  ({ className, variant = 'default', size = 'default', ...props }, ref) => {
    return (
      <button
        ref={ref}
        className={cn(
          'inline-flex items-center justify-center whitespace-nowrap rounded-md text-sm font-medium',
          'ring-offset-background transition-colors',
          'focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2',
          'disabled:pointer-events-none disabled:opacity-50',
          variantClasses[variant],
          sizeClasses[size],
          className
        )}
        {...props}
      />
    )
  }
)
Button.displayName = 'Button'
