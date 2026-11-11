import { tool } from 'ai';
import { asJson } from '../../../lib/json.js';
import { z } from 'zod';
import { latencyService } from '../latency.service.js';

export const latencyTool = {
  registerCausalEvent: tool({
    description: 'Registers a new event in the Time-Agnostic Causal Graph to maintain consistency across high-latency environments.',
    inputSchema: z.object({
      sourceNode: z.string().describe('The name of the node where the event originated.'),
      causalParents: z.array(z.string()).describe('The IDs of the preceding events in the causal chain.'),
      payload: asJson(z.any().describe('The data or instruction payload of the event.')),
    }),
    execute: async (args) => {
      return await latencyService.registerCausalEvent({ ...args, timestamp: Date.now() });
    },
  }),
  resolveLogicalDivergence: tool({
    description: 'Resolves logical conflicts between divergent state streams using the Time-Agnostic Processing Architecture rules.',
    inputSchema: z.object({
      eventA: z.any().describe('The first divergent event.'),
      eventB: z.any().describe('The second divergent event.'),
    }),
    execute: async ({ eventA, eventB }) => {
      return await latencyService.resolveDivergence(eventA, eventB);
    },
  }),
};
