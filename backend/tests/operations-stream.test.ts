import { describe, it, expect, vi } from 'vitest';
import { workspaceEventBus } from '../src/lib/events.js';

describe('Real-Time Event Bus & Operations Stream Isolation', () => {
  it('delivers events strictly to the subscribed workspace channel', () => {
    const wsA = 'workspace-alpha-1';
    const wsB = 'workspace-beta-2';

    const receivedAlpha: any[] = [];
    const receivedBeta: any[] = [];

    const unsubAlpha = workspaceEventBus.subscribe(wsA, (evt) => receivedAlpha.push(evt));
    const unsubBeta = workspaceEventBus.subscribe(wsB, (evt) => receivedBeta.push(evt));

    // Publish to Alpha
    workspaceEventBus.publish(wsA, 'task:created', {
      id: 'task-a1',
      title: 'Alpha Secret Task',
    });

    expect(receivedAlpha).toHaveLength(1);
    expect(receivedAlpha[0].type).toBe('task:created');
    expect(receivedAlpha[0].workspaceId).toBe(wsA);
    expect(receivedAlpha[0].data.title).toBe('Alpha Secret Task');

    // Beta must receive ZERO events from Alpha (strict tenant isolation)
    expect(receivedBeta).toHaveLength(0);

    // Publish to Beta
    workspaceEventBus.publish(wsB, 'decision:logged', {
      id: 'dec-b1',
      action: 'Beta Strategic Pivot',
    });

    expect(receivedBeta).toHaveLength(1);
    expect(receivedBeta[0].type).toBe('decision:logged');
    expect(receivedBeta[0].workspaceId).toBe(wsB);
    expect(receivedAlpha).toHaveLength(1); // Unchanged

    unsubAlpha();
    unsubBeta();
  });

  it('cleans up listener count upon unsubscription', () => {
    const wsTest = 'workspace-cleanup-test';
    const initialCount = workspaceEventBus.getSubscriberCount(wsTest);

    const unsub1 = workspaceEventBus.subscribe(wsTest, () => {});
    const unsub2 = workspaceEventBus.subscribe(wsTest, () => {});

    expect(workspaceEventBus.getSubscriberCount(wsTest)).toBe(initialCount + 2);

    unsub1();
    expect(workspaceEventBus.getSubscriberCount(wsTest)).toBe(initialCount + 1);

    unsub2();
    expect(workspaceEventBus.getSubscriberCount(wsTest)).toBe(initialCount);
  });

  it('publishes decision:voted and task:deleted with structured domain payloads', () => {
    const wsId = 'workspace-events-test';
    let lastEvent: any = null;

    const unsub = workspaceEventBus.subscribe(wsId, (e) => {
      lastEvent = e;
    });

    // Test task deletion event
    workspaceEventBus.publish(wsId, 'task:deleted', { taskId: 'task-del-99' });
    expect(lastEvent.type).toBe('task:deleted');
    expect(lastEvent.data.taskId).toBe('task-del-99');
    expect(lastEvent.timestamp).toBeDefined();

    // Test decision vote event
    workspaceEventBus.publish(wsId, 'decision:voted', {
      decisionId: 'dec-vote-1',
      deliberation: {
        totalVotes: 3,
        supportCount: 2,
        supportPercentage: 67,
      },
    });
    expect(lastEvent.type).toBe('decision:voted');
    expect(lastEvent.data.deliberation.supportPercentage).toBe(67);

    unsub();
  });
});
