'use client'

import type { LucideIcon } from 'lucide-react'
import { Inbox } from 'lucide-react'
import { Button } from '@/components/ui/button'

interface OperationalEmptyStateProps {
  title: string
  description: string
  actionLabel?: string
  onAction?: () => void
  icon?: LucideIcon
}

export function OperationalEmptyState({
  title,
  description,
  actionLabel,
  onAction,
  icon: Icon = Inbox,
}: OperationalEmptyStateProps) {
  return (
    <div className="flex flex-col items-center justify-center rounded-lg border border-dashed border-border/80 p-8 text-center bg-card/40">
      <div className="flex h-12 w-12 items-center justify-center rounded-full bg-muted">
        <Icon className="h-6 w-6 text-muted-foreground" />
      </div>
      <h3 className="mt-3 text-sm font-semibold tracking-tight">{title}</h3>
      <p className="mt-1 text-xs text-muted-foreground max-w-sm">{description}</p>
      {actionLabel && onAction && (
        <Button size="sm" variant="outline" className="mt-4 text-xs" onClick={onAction}>
          {actionLabel}
        </Button>
      )}
    </div>
  )
}
