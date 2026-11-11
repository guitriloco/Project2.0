import { tool } from 'ai';
import { asJson } from '../../../lib/json.js';
import { z } from 'zod';
import { planetarySyncService } from '../sync.service.js';

export const planetaryTool = {
  syncWithNode: tool({
    description: 'Initiates a state and governance synchronization with a specific planetary node.',
    inputSchema: z.object({
      nodeId: z.string().describe('The ID of the target planetary node (e.g., "mars-alpha").'),
      payload: asJson(z.any().describe('The data or governance state to synchronize.')),
    }),
    execute: async ({ nodeId, payload }) => {
      return await planetarySyncService.syncWithNode(nodeId, payload);
    },
  }),
  getPlanetaryStatus: tool({
    description: 'Retrieves the current status and connectivity metrics of all multi-planetary nodes.',
    inputSchema: z.object({}),
    execute: async () => {
      return planetarySyncService.getPlanetaryStatus();
    },
  }),
};
