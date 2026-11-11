import { tool } from 'ai';
import { z } from 'zod';
import { greenComputingService } from '../green-computing.service.js';

export const greenComputingTool = {
  scheduleEcoTask: tool({
    description: 'Schedules heavy computational tasks on carbon-neutral infrastructure to optimize planetary energy consumption.',
    inputSchema: z.object({
      taskName: z.string().describe('The name of the computation task'),
      resourceRequirement: z.number().describe('Estimated resource requirement (1-100)'),
    }),
    execute: async ({ taskName, resourceRequirement }) => {
      return await greenComputingService.scheduleGreenTask(taskName, resourceRequirement);
    },
  }),

  listGreenNodes: tool({
    description: 'Lists all planetary computing nodes with their energy sources and carbon intensity.',
    inputSchema: z.object({}),
    execute: async () => {
      const nodes = await greenComputingService.getAvailableNodes();
      return { nodes };
    },
  }),
};
