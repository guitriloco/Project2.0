import type { FastifyPluginAsync } from 'fastify';
import { withWorkspaceContext } from '../../lib/workspace.js';
import { requireWorkspaceViewer } from '../../lib/rbac.js';

export interface SandboxModuleDescriptor {
  id: string;
  name: string;
  phase: number;
  category: 'COGNITIVE' | 'GALACTIC' | 'METAPHYSICAL' | 'QUANTUM' | 'GOVERNANCE';
  status: 'SANDBOX_ISOLATED';
  description: string;
}

export const CONCEPTUAL_SANDBOX_MODULES: SandboxModuleDescriptor[] = [
  {
    id: 'consciousness',
    name: 'Consciousness Kernel',
    phase: 1,
    category: 'COGNITIVE',
    status: 'SANDBOX_ISOLATED',
    description: 'Protótipo conceitual para introspecção neural e auto-alinhamento reflexivo.',
  },
  {
    id: 'galactic',
    name: 'Galactic Network Layer',
    phase: 48,
    category: 'GALACTIC',
    status: 'SANDBOX_ISOLATED',
    description: 'Camada experimental de roteamento distribuído multi-dimensional.',
  },
  {
    id: 'quantum-speed',
    name: 'Quantum Speed Pipeline',
    phase: 133,
    category: 'QUANTUM',
    status: 'SANDBOX_ISOLATED',
    description: 'Simulador assíncrono de transmissão de pacotes de sinal sub-atômicos.',
  },
  {
    id: 'metaphysical-logic',
    name: 'Metaphysical Logic Engine',
    phase: 165,
    category: 'METAPHYSICAL',
    status: 'SANDBOX_ISOLATED',
    description: 'Framework conceitual de raciocínio não-binário e matriz de axiomas.',
  },
  {
    id: 'omega',
    name: 'Omega State Convergence',
    phase: 200,
    category: 'GOVERNANCE',
    status: 'SANDBOX_ISOLATED',
    description: 'Mecanismo de convergência de invariantes éticos de longo prazo.',
  },
];

const sandboxRoutes: FastifyPluginAsync = async (fastify) => {
  // GET /api/sandbox/modules: Catalog of isolated conceptual prototypes
  fastify.get(
    '/modules',
    {
      preHandler: [withWorkspaceContext, requireWorkspaceViewer],
    },
    async (request) => {
      return {
        environment: 'ENTERPRISE_SANDBOX',
        activeWorkspace: request.workspace!.id,
        isolationStatus: 'STRICTLY_ISOLATED',
        totalModules: CONCEPTUAL_SANDBOX_MODULES.length,
        modules: CONCEPTUAL_SANDBOX_MODULES,
      };
    }
  );

  // POST /api/sandbox/simulate/:moduleId: Run an isolated dry-run simulation
  fastify.post(
    '/simulate/:moduleId',
    {
      preHandler: [withWorkspaceContext, requireWorkspaceViewer],
    },
    async (request, reply) => {
      const params = request.params as { moduleId: string };
      const mod = CONCEPTUAL_SANDBOX_MODULES.find((m) => m.id === params.moduleId);

      if (!mod) {
        return reply.code(404).send({
          error: `Módulo experimental '${params.moduleId}' não localizado no catálogo sandbox.`,
        });
      }

      return reply.send({
        simulatedAt: new Date().toISOString(),
        module: mod,
        result: {
          simulatedConvergence: 0.994,
          entropyDelta: -0.012,
          safetyInvariantsHold: true,
          executionMode: 'DRY_RUN_SANDBOX',
        },
      });
    }
  );
};

export default sandboxRoutes;
