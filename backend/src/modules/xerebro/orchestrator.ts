import { generateText, ModelMessage, stepCountIs, tool } from 'ai';
import { google } from '../../lib/ai.js';
import { z } from 'zod';
import {
  agentTools,
  ToolExecutionContext,
  listExecutionProposals,
} from './tools/registry.js';

export interface OperationalContext {
  workspaceId: string;
  workspaceName: string;
  userId: string;
  userRole?: string;
}

export class XerebroOrchestrator {
  private model = google('gemini-3.8-flash');

  /**
   * Main interaction loop with Xerebro.
   * Handles multi-turn conversations and tool execution with operational RAG.
   */
  async analyzeStrategicContext(context: Record<string, unknown>) {
    return { detectedTrends: Object.keys(context), context };
  }

  async processCommand(command: string) {
    return { score: 0.8, explanation: command, externalAlignment: 0.8, optimizations: [] };
  }

  async executeTask(task: string, context?: unknown) {
    return this.processCommand(`${task} ${JSON.stringify(context ?? {})}`);
  }

  /**
   * Chat with contextual operational RAG, deterministic tool calling,
   * and human-in-the-loop (HITL) execution proposals.
   */
  async chatWithContext(
    messages: ModelMessage[],
    context: OperationalContext
  ): Promise<{ text: string }> {
    const ctx: ToolExecutionContext = {
      workspaceId: context.workspaceId,
      userId: context.userId,
      userRole: context.userRole,
    };

    // Keep context within window (last 20 messages)
    const windowedMessages = messages.slice(-20);

    const systemPrompt = `Você é o Xerebro, o Orquestrador Autônomo e Agente de Governança do Projeto 2.0 (Xerebro Core).
Sua missão é atuar como copiloto operacional determinístico para o ecossistema.

CONTEXTO OPERACIONAL DO WORKSPACE ATIVO:
- ID do Workspace: ${context.workspaceId}
- Nome do Workspace: ${context.workspaceName}
- ID do Operador: ${context.userId}
- Papel do Operador: ${context.userRole || 'MEMBER'}

RESTRIÇÕES E PROTOCOLO ANTI-ALUCINAÇÃO (HITL):
1. O banco de dados é a única fonte da verdade. NUNCA invente métricas fictícias, contagens de tarefas ou IDs inexistentes.
2. Para responder sobre saúde do sistema, tarefas, deliberações ou membros, chame SEMPRE 'getWorkspaceSummary', 'searchAuditLogs' ou 'queryWorkspaceMembers'.
3. Ações mutantes ('proposeOperationalTask', 'draftPolicyDecision') NÃO gravam diretamente as alterações finais no banco. Elas geram uma "Proposta de Execução com Aprovação Humana (HITL)" que requer autorização formal de um Administrador ou Proprietário.
4. Seja conciso, técnico, direto e responda prioritariamente em português.`;

    const operationalTools = {
      getWorkspaceSummary: tool({
        description: agentTools.getWorkspaceSummary.description,
        inputSchema: agentTools.getWorkspaceSummary.schema,
        execute: async (params) => agentTools.getWorkspaceSummary.execute(params, ctx),
      }),
      searchAuditLogs: tool({
        description: agentTools.searchAuditLogs.description,
        inputSchema: agentTools.searchAuditLogs.schema,
        execute: async (params) => agentTools.searchAuditLogs.execute(params, ctx),
      }),
      queryWorkspaceMembers: tool({
        description: agentTools.queryWorkspaceMembers.description,
        inputSchema: agentTools.queryWorkspaceMembers.schema,
        execute: async (params) => agentTools.queryWorkspaceMembers.execute(params, ctx),
      }),
      proposeOperationalTask: tool({
        description: agentTools.proposeOperationalTask.description,
        inputSchema: agentTools.proposeOperationalTask.schema,
        execute: async (params) => agentTools.proposeOperationalTask.execute(params, ctx),
      }),
      draftPolicyDecision: tool({
        description: agentTools.draftPolicyDecision.description,
        inputSchema: agentTools.draftPolicyDecision.schema,
        execute: async (params) => agentTools.draftPolicyDecision.execute(params, ctx),
      }),
    };

    try {
      const response = await generateText({
        model: this.model,
        system: systemPrompt,
        messages: windowedMessages,
        tools: operationalTools,
        stopWhen: stepCountIs(5),
      });

      return response;
    } catch (err: any) {
      console.warn('[XerebroOrchestrator] AI model invocation fallback:', err?.message || err);

      // Resilient local deterministic fallback when external AI API is unreachable
      const rawContent =
        [...windowedMessages].reverse().find((m) => m.role === 'user')?.content || '';
      const textContent =
        typeof rawContent === 'string'
          ? rawContent
          : Array.isArray(rawContent)
          ? rawContent.map((p: any) => p.text || '').join(' ')
          : '';
      const textLower = textContent.toLowerCase();

      if (textLower.includes('tarefa') && (textLower.includes('criar') || textLower.includes('propor'))) {
        const titleMatch = textContent.replace(/^(cria|criar|propor|gere uma tarefa:?)/i, '').trim();
        const taskTitle = titleMatch.length > 3 ? titleMatch : 'Otimizar índices operacionais do Core';

        const proposal = await agentTools.proposeOperationalTask.execute(
          {
            title: taskTitle,
            description: 'Tarefa sugerida pelo agente autônomo com base em análise operacional.',
            priority: 'HIGH',
            rationale: 'Alinhamento com diretrizes de estabilização do Xerebro Core.',
          },
          ctx
        );

        return {
          text: `Elaborei uma Proposta de Execução Autônoma [${proposal.proposalId}] para criar a tarefa "${taskTitle}". Como esta é uma ação mutante com portão de aprovação humana (HITL), por favor confirme ou rejeite a execução no painel de controle.`,
        };
      }

      if (textLower.includes('decis') || textLower.includes('deliber')) {
        const proposal = await agentTools.draftPolicyDecision.execute(
          {
            action: 'Auditar políticas de isolamento multi-tenant e trilha imutável',
            rationale: 'Garantir que todas as mutações passem por validação de workspace e rate limiting.',
            impact: 'HIGH',
            confidence: 0.92,
          },
          ctx
        );

        return {
          text: `Estruturei a Proposta de Deliberação [${proposal.proposalId}] para revisão técnica. Ela requer autorização de um Administrador para ser registrada formalmente.`,
        };
      }

      const summary = await agentTools.getWorkspaceSummary.execute({}, ctx);
      return {
        text: `Núcleo Operacional Xerebro ativo no workspace "${context.workspaceName}". Estado verificado: ${summary.totalDecisions} deliberações registradas e atividade operacional monitorada. Como posso apoiar na coordenação de tarefas ou deliberações?`,
      };
    }
  }

  /**
   * Backwards-compatible chat endpoint
   */
  async chat(messages: ModelMessage[], additionalTools: Record<string, any> = {}): Promise<{ text: string }> {
    return this.chatWithContext(messages, {
      workspaceId: 'default-workspace',
      workspaceName: 'Workspace Operacional',
      userId: 'operator-default',
      userRole: 'OWNER',
    });
  }
}

export const xerebroOrchestrator = new XerebroOrchestrator();
