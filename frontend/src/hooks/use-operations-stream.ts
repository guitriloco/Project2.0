'use client'

import { useEffect, useRef, useState, useCallback } from 'react'
import type { Task, Decision, AuditEvent } from '@/lib/operations-contracts'

export type StreamConnectionStatus = 'connected' | 'connecting' | 'disconnected'

export interface StreamEvent<T = any> {
  id: string
  type: string
  workspaceId: string
  timestamp: string
  data: T
}

export interface UseOperationsStreamOptions {
  workspaceId?: string
  enabled?: boolean
  onTaskCreated?: (task: Task) => void
  onTaskUpdated?: (task: Task) => void
  onTaskDeleted?: (payload: { taskId: string }) => void
  onDecisionLogged?: (decision: Decision) => void
  onDecisionVoted?: (payload: { decisionId: string; vote: any; deliberation: any; decision: Decision }) => void
  onAuditRecorded?: (audit: AuditEvent) => void
  onAnyEvent?: (event: StreamEvent) => void
}

export function useOperationsStream(options: UseOperationsStreamOptions = {}) {
  const {
    workspaceId,
    enabled = true,
    onTaskCreated,
    onTaskUpdated,
    onTaskDeleted,
    onDecisionLogged,
    onDecisionVoted,
    onAuditRecorded,
    onAnyEvent,
  } = options

  const [status, setStatus] = useState<StreamConnectionStatus>('disconnected')
  const [lastEventTime, setLastEventTime] = useState<string | null>(null)
  const eventSourceRef = useRef<EventSource | null>(null)
  const retryTimeoutRef = useRef<NodeJS.Timeout | null>(null)
  const retryCountRef = useRef(0)

  // Hold stable references to handlers to prevent recreation of EventSource on callback changes
  const handlersRef = useRef({
    onTaskCreated,
    onTaskUpdated,
    onTaskDeleted,
    onDecisionLogged,
    onDecisionVoted,
    onAuditRecorded,
    onAnyEvent,
  })

  useEffect(() => {
    handlersRef.current = {
      onTaskCreated,
      onTaskUpdated,
      onTaskDeleted,
      onDecisionLogged,
      onDecisionVoted,
      onAuditRecorded,
      onAnyEvent,
    }
  }, [
    onTaskCreated,
    onTaskUpdated,
    onTaskDeleted,
    onDecisionLogged,
    onDecisionVoted,
    onAuditRecorded,
    onAnyEvent,
  ])

  const connect = useCallback(() => {
    if (typeof window === 'undefined' || !enabled) return

    // Clean up existing instance
    if (eventSourceRef.current) {
      eventSourceRef.current.close()
      eventSourceRef.current = null
    }

    setStatus('connecting')

    const url = workspaceId
      ? `/api/operations/stream?workspaceId=${encodeURIComponent(workspaceId)}`
      : '/api/operations/stream'

    try {
      const es = new EventSource(url)
      eventSourceRef.current = es

      es.addEventListener('open', () => {
        setStatus('connected')
        retryCountRef.current = 0
      })

      es.addEventListener('connected', (e: MessageEvent) => {
        setStatus('connected')
        setLastEventTime(new Date().toISOString())
        try {
          const payload = JSON.parse(e.data)
          handlersRef.current.onAnyEvent?.({
            id: 'handshake',
            type: 'connected',
            workspaceId: payload.workspaceId,
            timestamp: payload.timestamp,
            data: payload,
          })
        } catch {
          // ignore parsing error
        }
      })

      const handleDomainEvent = (type: string, dataStr: string) => {
        try {
          const parsed = JSON.parse(dataStr) as StreamEvent
          setLastEventTime(parsed.timestamp || new Date().toISOString())
          handlersRef.current.onAnyEvent?.(parsed)

          switch (parsed.type) {
            case 'task:created':
              handlersRef.current.onTaskCreated?.(parsed.data)
              break
            case 'task:updated':
              handlersRef.current.onTaskUpdated?.(parsed.data)
              break
            case 'task:deleted':
              handlersRef.current.onTaskDeleted?.(parsed.data)
              break
            case 'decision:logged':
              handlersRef.current.onDecisionLogged?.(parsed.data)
              break
            case 'decision:voted':
              handlersRef.current.onDecisionVoted?.(parsed.data)
              break
            case 'audit:recorded':
              handlersRef.current.onAuditRecorded?.(parsed.data)
              break
          }
        } catch (err) {
          console.warn('[OperationsStream] Error parsing event payload:', err)
        }
      }

      es.addEventListener('task:created', (e: MessageEvent) => handleDomainEvent('task:created', e.data))
      es.addEventListener('task:updated', (e: MessageEvent) => handleDomainEvent('task:updated', e.data))
      es.addEventListener('task:deleted', (e: MessageEvent) => handleDomainEvent('task:deleted', e.data))
      es.addEventListener('decision:logged', (e: MessageEvent) => handleDomainEvent('decision:logged', e.data))
      es.addEventListener('decision:voted', (e: MessageEvent) => handleDomainEvent('decision:voted', e.data))
      es.addEventListener('audit:recorded', (e: MessageEvent) => handleDomainEvent('audit:recorded', e.data))

      es.onerror = () => {
        setStatus('disconnected')
        es.close()
        eventSourceRef.current = null

        // Exponential backoff retry: 1s, 2s, 4s, 8s, max 16s
        const backoffMs = Math.min(16000, 1000 * Math.pow(2, retryCountRef.current))
        retryCountRef.current += 1

        if (retryTimeoutRef.current) clearTimeout(retryTimeoutRef.current)
        retryTimeoutRef.current = setTimeout(() => {
          connect()
        }, backoffMs)
      }
    } catch {
      setStatus('disconnected')
    }
  }, [workspaceId, enabled])

  useEffect(() => {
    connect()

    return () => {
      if (retryTimeoutRef.current) clearTimeout(retryTimeoutRef.current)
      if (eventSourceRef.current) {
        eventSourceRef.current.close()
        eventSourceRef.current = null
      }
      setStatus('disconnected')
    }
  }, [connect])

  const reconnect = useCallback(() => {
    retryCountRef.current = 0
    connect()
  }, [connect])

  return {
    status,
    lastEventTime,
    reconnect,
  }
}
