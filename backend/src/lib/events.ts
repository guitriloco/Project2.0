import { EventEmitter } from 'node:events';

export type DomainEventType =
  | 'task:created'
  | 'task:updated'
  | 'task:deleted'
  | 'decision:logged'
  | 'decision:voted'
  | 'audit:recorded'
  | 'metrics:updated';

export interface DomainEvent<T = any> {
  id: string;
  type: DomainEventType;
  workspaceId: string;
  timestamp: string;
  data: T;
}

class WorkspaceEventBus {
  private emitter = new EventEmitter();

  constructor() {
    // Generous listener ceiling for concurrent workspace connections
    this.emitter.setMaxListeners(200);
  }

  public publish<T = any>(workspaceId: string, type: DomainEventType, data: T): DomainEvent<T> {
    const event: DomainEvent<T> = {
      id: crypto.randomUUID(),
      type,
      workspaceId,
      timestamp: new Date().toISOString(),
      data,
    };
    this.emitter.emit(`workspace:${workspaceId}`, event);
    this.emitter.emit('workspace:*', event);
    return event;
  }

  public subscribe(workspaceId: string, listener: (event: DomainEvent) => void): () => void {
    const channel = workspaceId === '*' ? 'workspace:*' : `workspace:${workspaceId}`;
    this.emitter.on(channel, listener);
    return () => {
      this.emitter.off(channel, listener);
    };
  }

  public getSubscriberCount(workspaceId: string): number {
    return this.emitter.listenerCount(`workspace:${workspaceId}`);
  }
}

export const workspaceEventBus = new WorkspaceEventBus();
