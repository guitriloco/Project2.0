import crypto from 'node:crypto';
import { workspaceEventBus, type DomainEvent } from './events.js';
import {
  isCircuitBreakerTripped,
  recordFailureAndEvaluateAutoTrip,
} from './policyEngine.js';

export interface WebhookSubscription {
  id: string;
  workspaceId: string;
  targetUrl: string;
  events: string[];
  secret: string;
  active: boolean;
  createdAt: string;
  lastDeliveryAt?: string;
  lastDeliveryStatus?: number;
  lastDeliveryError?: string;
}

export interface WebhookDeliveryAttempt {
  attemptNumber: number;
  timestamp: string;
  statusCode?: number;
  errorMessage?: string;
  durationMs: number;
}

export interface WebhookQueuedDelivery {
  id: string;
  subscriptionId: string;
  workspaceId: string;
  targetUrl: string;
  event: DomainEvent;
  idempotencyKey: string;
  status: 'PENDING' | 'RETRYING' | 'DELIVERED' | 'DEAD_LETTER';
  attempts: WebhookDeliveryAttempt[];
  maxAttempts: number; // default: 5
  nextRetryAt: string | null;
  createdAt: string;
  completedAt?: string;
}

// In-memory subscription store with tenant isolation
const subscriptionsStore = new Map<string, WebhookSubscription>();

// In-memory delivery queue store with tenant isolation
const deliveryQueueStore = new Map<string, WebhookQueuedDelivery>();

export function signWebhookPayload(payload: string, secret: string): string {
  return crypto.createHmac('sha256', secret).update(payload, 'utf8').digest('hex');
}

export function computeIdempotencyKey(subscriptionId: string, eventId: string): string {
  return crypto.createHash('sha256').update(`${subscriptionId}:${eventId}`).digest('hex');
}

export function calculateBackoffDelay(
  attempt: number,
  baseIntervalMs = 1000,
  maxIntervalMs = 300000,
  jitterRatio = 0.2
): number {
  // Formula: min(baseInterval * 2^(attempt - 1), maxInterval)
  const exponential = Math.min(baseIntervalMs * Math.pow(2, Math.max(0, attempt - 1)), maxIntervalMs);
  // Jitter ±20%
  const jitter = exponential * jitterRatio * (Math.random() * 2 - 1);
  return Math.max(50, Math.round(exponential + jitter));
}

export function registerWebhook(input: {
  workspaceId: string;
  targetUrl: string;
  events: string[];
  secret?: string;
}): WebhookSubscription {
  const subscription: WebhookSubscription = {
    id: `whk-${crypto.randomUUID()}`,
    workspaceId: input.workspaceId,
    targetUrl: input.targetUrl,
    events: input.events.length > 0 ? input.events : ['task:created', 'decision:logged'],
    secret: input.secret || crypto.randomBytes(24).toString('hex'),
    active: true,
    createdAt: new Date().toISOString(),
  };

  subscriptionsStore.set(subscription.id, subscription);
  return subscription;
}

export function listWebhooks(workspaceId: string): WebhookSubscription[] {
  return Array.from(subscriptionsStore.values())
    .filter((s) => s.workspaceId === workspaceId)
    .sort((a, b) => new Date(b.createdAt).getTime() - new Date(a.createdAt).getTime());
}

export function getWebhook(id: string, workspaceId: string): WebhookSubscription | null {
  const sub = subscriptionsStore.get(id);
  if (!sub || sub.workspaceId !== workspaceId) return null;
  return sub;
}

export function deleteWebhook(id: string, workspaceId: string): boolean {
  const sub = getWebhook(id, workspaceId);
  if (!sub) return false;
  return subscriptionsStore.delete(id);
}

export function enqueueWebhookDelivery(
  sub: WebhookSubscription,
  event: DomainEvent,
  options?: { maxAttempts?: number; immediate?: boolean }
): WebhookQueuedDelivery {
  const idempotencyKey = computeIdempotencyKey(sub.id, event.id);

  // Check if identical delivery already exists
  const existing = Array.from(deliveryQueueStore.values()).find(
    (d) => d.subscriptionId === sub.id && d.idempotencyKey === idempotencyKey
  );
  if (existing && (existing.status === 'DELIVERED' || existing.status === 'RETRYING' || existing.status === 'PENDING')) {
    return existing;
  }

  const deliveryId = `del-${crypto.randomUUID()}`;
  const delivery: WebhookQueuedDelivery = {
    id: deliveryId,
    subscriptionId: sub.id,
    workspaceId: sub.workspaceId,
    targetUrl: sub.targetUrl,
    event,
    idempotencyKey,
    status: 'PENDING',
    attempts: [],
    maxAttempts: options?.maxAttempts ?? 5,
    nextRetryAt: new Date().toISOString(),
    createdAt: new Date().toISOString(),
  };

  deliveryQueueStore.set(delivery.id, delivery);

  // Prune completed deliveries older than 24 hours
  pruneCompletedDeliveries();

  if (options?.immediate !== false) {
    queueMicrotask(() => {
      processDelivery(delivery).catch(() => {});
    });
  }

  return delivery;
}

export async function processDelivery(
  delivery: WebhookQueuedDelivery
): Promise<{ ok: boolean; status?: number; error?: string }> {
  // Check if Outbound Webhook Kill-switch or Global Freeze is tripped
  const breakerCheck = isCircuitBreakerTripped(delivery.workspaceId, 'OUTBOUND_WEBHOOK_KILL');
  if (breakerCheck.tripped) {
    delivery.status = 'RETRYING';
    delivery.nextRetryAt = new Date(Date.now() + 60000).toISOString();
    return { ok: false, status: 503, error: breakerCheck.reason };
  }

  const sub = subscriptionsStore.get(delivery.subscriptionId);
  const secret = sub?.secret || 'fallback-secret';
  const attemptNumber = delivery.attempts.length + 1;
  const payload = JSON.stringify(delivery.event);
  const signature = signWebhookPayload(payload, secret);
  const attemptStart = Date.now();
  const timestamp = new Date().toISOString();

  const controller = new AbortController();
  const timeout = setTimeout(() => controller.abort(), 5000);

  let statusCode: number | undefined;
  let errorMessage: string | undefined;
  let isSuccess = false;

  try {
    const res = await fetch(delivery.targetUrl, {
      method: 'POST',
      headers: {
        'content-type': 'application/json',
        'user-agent': 'Xerebro-Webhook-Worker/2.0',
        'x-project2-signature': `sha256=${signature}`,
        'x-project2-event': delivery.event.type,
        'x-project2-delivery-id': delivery.id,
        'x-project2-idempotency-key': delivery.idempotencyKey,
        'x-project2-attempt': String(attemptNumber),
        'x-project2-timestamp': timestamp,
      },
      body: payload,
      signal: controller.signal,
    });

    clearTimeout(timeout);
    statusCode = res.status;
    isSuccess = res.ok;
    if (!isSuccess) {
      errorMessage = `HTTP status ${res.status}`;
    }
  } catch (err: any) {
    clearTimeout(timeout);
    statusCode = 0;
    isSuccess = false;
    errorMessage = err?.name === 'AbortError' ? 'Delivery timed out after 5000ms' : err?.message || 'Network error';
  }

  const durationMs = Date.now() - attemptStart;
  const attemptRecord: WebhookDeliveryAttempt = {
    attemptNumber,
    timestamp,
    statusCode,
    errorMessage: isSuccess ? undefined : errorMessage,
    durationMs,
  };
  delivery.attempts.push(attemptRecord);

  if (sub) {
    sub.lastDeliveryAt = timestamp;
    sub.lastDeliveryStatus = statusCode;
    sub.lastDeliveryError = isSuccess ? undefined : errorMessage;
  }

  if (isSuccess) {
    delivery.status = 'DELIVERED';
    delivery.completedAt = new Date().toISOString();
    delivery.nextRetryAt = null;
    return { ok: true, status: statusCode };
  }

  // Handle failure & retry scheduling
  if (delivery.attempts.length >= delivery.maxAttempts) {
    delivery.status = 'DEAD_LETTER';
    delivery.nextRetryAt = null;
    delivery.completedAt = new Date().toISOString();
  } else {
    delivery.status = 'RETRYING';
    const delay = calculateBackoffDelay(delivery.attempts.length);
    delivery.nextRetryAt = new Date(Date.now() + delay).toISOString();
  }

  // Evaluate auto-trip for outbound webhook kill-switch
  recordFailureAndEvaluateAutoTrip(
    delivery.workspaceId,
    'OUTBOUND_WEBHOOK_KILL',
    errorMessage || 'Webhook delivery failed'
  );

  return { ok: false, status: statusCode, error: errorMessage };
}

export async function dispatchWebhookDelivery(
  sub: WebhookSubscription,
  event: DomainEvent
): Promise<{ ok: boolean; status?: number; error?: string }> {
  const delivery = enqueueWebhookDelivery(sub, event, { immediate: false });
  return processDelivery(delivery);
}

export async function dispatchTestPing(
  sub: WebhookSubscription
): Promise<{ ok: boolean; status?: number; error?: string }> {
  const pingEvent: DomainEvent = {
    id: `ping-${crypto.randomUUID()}`,
    type: 'audit:recorded',
    workspaceId: sub.workspaceId,
    timestamp: new Date().toISOString(),
    data: {
      type: 'PING_TEST',
      message: 'Xerebro Core Webhook Verification Ping',
      verifiedAt: new Date().toISOString(),
    },
  };

  return dispatchWebhookDelivery(sub, pingEvent);
}

// Delivery queries & DLQ methods
export function listDeliveries(workspaceId: string, status?: string): WebhookQueuedDelivery[] {
  return Array.from(deliveryQueueStore.values())
    .filter((d) => d.workspaceId === workspaceId && (!status || d.status === status))
    .sort((a, b) => new Date(b.createdAt).getTime() - new Date(a.createdAt).getTime());
}

export function listDlq(workspaceId: string): WebhookQueuedDelivery[] {
  return listDeliveries(workspaceId, 'DEAD_LETTER');
}

export function getDelivery(deliveryId: string, workspaceId: string): WebhookQueuedDelivery | null {
  const delivery = deliveryQueueStore.get(deliveryId);
  if (!delivery || delivery.workspaceId !== workspaceId) return null;
  return delivery;
}

export async function replayDlqDelivery(
  deliveryId: string,
  workspaceId: string
): Promise<WebhookQueuedDelivery | null> {
  const delivery = getDelivery(deliveryId, workspaceId);
  if (!delivery) return null;

  // Reset delivery parameters for immediate redelivery
  delivery.status = 'RETRYING';
  delivery.maxAttempts = delivery.attempts.length + 3; // Allow additional attempts
  delivery.nextRetryAt = new Date().toISOString();
  delivery.completedAt = undefined;

  await processDelivery(delivery);
  return delivery;
}

export function deleteDlqDelivery(deliveryId: string, workspaceId: string): boolean {
  const delivery = getDelivery(deliveryId, workspaceId);
  if (!delivery) return false;
  return deliveryQueueStore.delete(deliveryId);
}

function pruneCompletedDeliveries() {
  const maxAgeMs = 24 * 60 * 60 * 1000; // 24 hours
  const now = Date.now();
  for (const [id, d] of deliveryQueueStore.entries()) {
    if ((d.status === 'DELIVERED' || d.status === 'DEAD_LETTER') && d.completedAt) {
      if (now - new Date(d.completedAt).getTime() > maxAgeMs) {
        deliveryQueueStore.delete(id);
      }
    }
  }
}

// Background retry loop
let retryIntervalTimer: NodeJS.Timeout | null = null;
export function startDeliveryRetryWorker(checkIntervalMs = 2000) {
  if (retryIntervalTimer) return;
  retryIntervalTimer = setInterval(() => {
    const now = Date.now();
    for (const delivery of deliveryQueueStore.values()) {
      if (delivery.status === 'RETRYING' && delivery.nextRetryAt) {
        const retryTime = new Date(delivery.nextRetryAt).getTime();
        if (retryTime <= now) {
          processDelivery(delivery).catch(() => {});
        }
      }
    }
  }, checkIntervalMs);
  if (retryIntervalTimer.unref) retryIntervalTimer.unref();
}
startDeliveryRetryWorker();

// Global listener: automatically dispatch matching events to active webhooks via resilient queue
workspaceEventBus.subscribe('*', async (event: DomainEvent) => {
  const matchingSubs = Array.from(subscriptionsStore.values()).filter(
    (s) => s.workspaceId === event.workspaceId && s.active && s.events.includes(event.type)
  );

  for (const sub of matchingSubs) {
    enqueueWebhookDelivery(sub, event);
  }
});
