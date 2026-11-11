import { evolutionService } from '../evolution.service.js';
import { z } from 'zod';

export const evolutionTool = {
  description: 'Analyze system state and apply infrastructure evolutions for self-healing and optimization.',
  inputSchema: z.object({
    action: z.enum(['analyze', 'apply', 'status']),
    evolutionName: z.string().optional().describe('The name of the evolution to apply (required if action is apply)'),
  }),
  execute: async ({ action, evolutionName }: { action: string, evolutionName?: string }) => {
    switch (action) {
      case 'analyze':
        return await evolutionService.analyzeSystemState();
      case 'apply':
        if (!evolutionName) return { error: 'evolutionName is required for apply action' };
        return await evolutionService.applyEvolution(evolutionName);
      case 'status':
        return await evolutionService.getSelfHealingStatus();
      default:
        return { error: 'Invalid action' };
    }
  },
};
