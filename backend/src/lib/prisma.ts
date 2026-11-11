import { PrismaClient } from '@prisma/client';

let realPrisma: PrismaClient | null = null;
try {
  const dbUrl = process.env.DATABASE_URL;
  // PrismaClient requires postgresql or mysql connection in this schema, and a generated client
  if (dbUrl && (dbUrl.startsWith('postgresql://') || dbUrl.startsWith('postgres://') || dbUrl.startsWith('mysql://'))) {
    realPrisma = new PrismaClient();
  }
} catch {
  // Silent fallback to in-memory store in preview/dev environment without database
}

// In-memory fallback database
const memoryStore = new Map<string, Map<string, any>>();

function getTable(model: string) {
  let table = memoryStore.get(model);
  if (!table) {
    table = new Map<string, any>();
    memoryStore.set(model, table);
  }
  return table;
}

// Seed default preview records
const previewUser = {
  id: 'preview-user-1',
  email: 'preview.operator@xerebro.local',
  name: 'Preview Operator',
  emailVerified: true,
  credits: 100.0,
  createdAt: new Date(),
  updatedAt: new Date(),
};
getTable('user').set(previewUser.id, previewUser);

const previewWorkspace = {
  id: 'preview-workspace-1',
  name: 'Preview Workspace',
  createdAt: new Date(),
};
getTable('workspace').set(previewWorkspace.id, previewWorkspace);

const previewMember = {
  id: 'preview-member-1',
  workspaceId: previewWorkspace.id,
  userId: previewUser.id,
  role: 'OWNER',
  createdAt: new Date(),
};
getTable('workspacemember').set(`${previewWorkspace.id}_${previewUser.id}`, previewMember);
getTable('workspacemember').set(previewMember.id, previewMember);

const previewTask = {
  id: 'task-1',
  title: 'Inicializar nós quânticos do Core',
  description: 'Verificar alinhamento e telemetria de sinais operacionais.',
  status: 'in_progress',
  workspaceId: previewWorkspace.id,
  createdAt: new Date(),
  updatedAt: new Date(),
};
getTable('task').set(previewTask.id, previewTask);

const createMemoryHandler = (modelName: string) => {
  const model = modelName.toLowerCase();
  const table = getTable(model);

  return {
    findMany: async (args?: any) => {
      let items = Array.from(table.values());
      if (args?.where) {
        items = items.filter((item) => {
          return Object.entries(args.where).every(([key, val]) => {
            if (val === undefined) return true;
            return item[key] === val;
          });
        });
      }
      if (args?.take) items = items.slice(0, args.take);
      return items;
    },
    findFirst: async (args?: any) => {
      let items = Array.from(table.values());
      if (args?.where) {
        items = items.filter((item) => {
          return Object.entries(args.where).every(([key, val]) => {
            if (val === undefined) return true;
            return item[key] === val;
          });
        });
      }
      const item = items[0] ?? null;
      if (item && args?.include?.workspace) {
        const ws = getTable('workspace').get(item.workspaceId);
        return { ...item, workspace: ws };
      }
      return item;
    },
    findUnique: async (args?: any) => {
      if (!args?.where) return null;
      if (args.where.id) {
        const item = table.get(args.where.id) ?? null;
        if (item && args?.include?.workspace) {
          const ws = getTable('workspace').get(item.workspaceId);
          return { ...item, workspace: ws };
        }
        return item;
      }
      if (args.where.workspaceId_userId) {
        const compositeKey = `${args.where.workspaceId_userId.workspaceId}_${args.where.workspaceId_userId.userId}`;
        let item = table.get(compositeKey);
        if (!item) {
          for (const cand of table.values()) {
            if (
              cand.workspaceId === args.where.workspaceId_userId.workspaceId &&
              cand.userId === args.where.workspaceId_userId.userId
            ) {
              item = cand;
              break;
            }
          }
        }
        if (item && args?.include?.workspace) {
          const ws = getTable('workspace').get(item.workspaceId);
          return { ...item, workspace: ws };
        }
        return item ?? null;
      }
      if (args.where.email) {
        for (const item of table.values()) {
          if (item.email === args.where.email) return item;
        }
      }
      for (const item of table.values()) {
        const matches = Object.entries(args.where).every(([key, val]) => item[key] === val);
        if (matches) {
          if (args?.include?.workspace) {
            const ws = getTable('workspace').get(item.workspaceId);
            return { ...item, workspace: ws };
          }
          return item;
        }
      }
      return null;
    },
    create: async (args: any) => {
      const id = args?.data?.id ?? `mem-${Date.now()}-${Math.random().toString(36).slice(2, 7)}`;
      const { members, ...dataWithoutRelations } = args?.data ?? {};
      const record = { id, createdAt: new Date(), updatedAt: new Date(), ...dataWithoutRelations };
      table.set(id, record);

      if (model === 'workspace' && members?.create) {
        const memberData = members.create;
        const memberTable = getTable('workspacemember');
        const memberId = `member-${Date.now()}-${Math.random().toString(36).slice(2, 7)}`;
        const memberRecord = {
          id: memberId,
          workspaceId: id,
          userId: memberData.userId,
          role: memberData.role || 'OWNER',
          createdAt: new Date(),
        };
        memberTable.set(`${id}_${memberData.userId}`, memberRecord);
        memberTable.set(memberId, memberRecord);
      }

      return record;
    },
    createMany: async (args: any) => {
      const list = args?.data ?? [];
      for (const item of list) {
        const id = item.id ?? `mem-${Date.now()}-${Math.random().toString(36).slice(2, 7)}`;
        table.set(id, { id, createdAt: new Date(), updatedAt: new Date(), ...item });
      }
      return { count: list.length };
    },
    update: async (args: any) => {
      const id = args?.where?.id;
      const existing = id ? table.get(id) : null;
      const updated = { ...(existing ?? {}), ...args?.data, updatedAt: new Date() };
      if (id) table.set(id, updated);
      return updated;
    },
    upsert: async (args: any) => {
      const existing = await createMemoryHandler(modelName).findFirst({ where: args?.where });
      if (existing) {
        const updated = { ...existing, ...args?.update, updatedAt: new Date() };
        table.set(existing.id, updated);
        return updated;
      }
      return createMemoryHandler(modelName).create({ data: args?.create });
    },
    delete: async (args: any) => {
      if (args?.where?.id) table.delete(args.where.id);
      return { ok: true };
    },
    deleteMany: async (args?: any) => {
      const items = await createMemoryHandler(modelName).findMany(args);
      for (const item of items) {
        table.delete(item.id);
      }
      return { count: items.length };
    },
    count: async (args?: any) => {
      const items = await createMemoryHandler(modelName).findMany(args);
      return items.length;
    },
    groupBy: async (args?: any) => {
      const items = await createMemoryHandler(modelName).findMany(args);
      const groups = new Map<string, number>();
      const byField = args?.by?.[0] ?? 'status';
      for (const item of items) {
        const key = String(item[byField] ?? 'UNKNOWN');
        groups.set(key, (groups.get(key) ?? 0) + 1);
      }
      return Array.from(groups.entries()).map(([k, count]) => ({
        [byField]: k,
        _count: { _all: count },
      }));
    },
  };
};

const modelHandlers = new Map<string, any>();

function getModelHandler(prop: string) {
  let handler = modelHandlers.get(prop);
  if (!handler) {
    handler = createMemoryHandler(prop);
    modelHandlers.set(prop, handler);
  }
  return handler;
}

export const prisma = new Proxy({} as any, {
  get: (_, prop: string) => {
    if (prop === '$disconnect' || prop === '$connect') {
      return async () => {};
    }
    const memoryHandler = getModelHandler(prop);
    if (!realPrisma) {
      return memoryHandler;
    }
    const realModel = (realPrisma as any)[prop];
    if (!realModel) return memoryHandler;

    return new Proxy(realModel, {
      get: (target, method: string) => {
        const originalMethod = target[method];
        if (typeof originalMethod !== 'function') return (memoryHandler as any)[method];
        return async (...methodArgs: any[]) => {
          try {
            return await originalMethod.apply(target, methodArgs);
          } catch (err: any) {
            console.warn(
              `[AI Studio] Real DB call failed for ${prop}.${method}, falling back to in-memory store:`,
              err?.message || err
            );
            const memMethod = (memoryHandler as any)[method];
            if (typeof memMethod === 'function') {
              return await memMethod(...methodArgs);
            }
            return null;
          }
        };
      },
    });
  },
});

export default prisma;
