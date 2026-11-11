import * as React from 'react'
import { cn } from './utils'

type ButtonProps = React.ButtonHTMLAttributes<HTMLButtonElement> & { asChild?: boolean; variant?: 'default' | 'outline' | 'ghost' | 'link'; size?: 'default' | 'sm' | 'lg' | 'icon' }
export function Button({ className, variant = 'default', size = 'default', asChild, ...props }: ButtonProps) {
  const classes = cn('inline-flex items-center justify-center gap-2 rounded-lg font-medium transition-colors focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring disabled:pointer-events-none disabled:opacity-50', variant === 'default' && 'bg-primary text-primary-foreground hover:bg-primary/90', variant === 'outline' && 'border border-input bg-background hover:bg-muted', variant === 'ghost' && 'hover:bg-muted', variant === 'link' && 'text-primary underline-offset-4 hover:underline', size === 'sm' && 'h-8 px-3 text-xs', size === 'lg' && 'h-11 px-5', size === 'icon' && 'size-10', size === 'default' && 'h-10 px-4', className)
  if (asChild && React.isValidElement(props.children)) {
    const child = props.children as React.ReactElement<{ className?: string }>
    return React.cloneElement(child, {
      className: cn(classes, child.props.className),
    })
  }
  return <button className={classes} {...props} />
}
