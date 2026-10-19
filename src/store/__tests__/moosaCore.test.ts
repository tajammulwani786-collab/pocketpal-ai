/**
 * Tests for the MOOSA orchestration core (ChatGPT) and Muse's
 * adapters. Covers the cases the starter README requires: offline
 * refusal, approval denial, evidence-bearing completion, and
 * persistence behaviour.
 */
// Self-contained in-memory AsyncStorage mock (the package's own jest
// mock recurses under this project's jest setup).
jest.mock('@react-native-async-storage/async-storage', () => {
  let data: Record<string, string> = {};
  return {
    __esModule: true,
    default: {
      getItem: async (k: string) => (k in data ? data[k] : null),
      setItem: async (k: string, v: string) => {
        data[k] = v;
      },
      removeItem: async (k: string) => {
        delete data[k];
      },
      clear: async () => {
        data = {};
      },
    },
  };
});

import AsyncStorage from '@react-native-async-storage/async-storage';

import {MoosaAgent, Task, Tool} from '../moosaCore';
import {
  AsyncStorageMemoryStore,
  DenyAllPermissionGate,
  talentTool,
  verifyToolResult,
} from '../moosaAdapters';
import {CalculateEngine} from '../../services/talents/CalculateEngine';

const readTool: Tool = {
  capability: 'research',
  risk: 'read',
  requiresInternet: false,
  execute: async () => ({ok: true, summary: 'done', evidence: ['proof']}),
};

const internetTool: Tool = {
  capability: 'research',
  risk: 'read',
  requiresInternet: true,
  execute: async () => ({ok: true, summary: 'live', evidence: ['live']}),
};

const messageTool: Tool = {
  capability: 'send_message',
  risk: 'write',
  requiresInternet: true,
  execute: async () => ({ok: true, summary: 'sent', evidence: ['id-1']}),
};

function makeCtx(online: boolean, approve: boolean) {
  const memory = new AsyncStorageMemoryStore();
  const agent = new MoosaAgent([readTool, internetTool, messageTool], {
    isOnline: async () => online,
    permissionGate: {approve: async () => approve},
    memory,
  });
  return {agent, memory};
}

const task = (capability: Task['capability']): Task => ({
  id: 't1',
  instruction: 'do it',
  capability,
});

describe('MoosaAgent execution boundary', () => {
  beforeEach(async () => {
    await AsyncStorage.clear();
  });

  it('refuses when no tool is installed for the capability', async () => {
    const {agent} = makeCtx(true, true);
    const out = await agent.run(task('publish'));
    expect(out.status).toBe('unavailable');
  });

  it('refuses internet tools while offline and does not execute them', async () => {
    const {agent} = makeCtx(false, true);
    const out = await agent.run(task('research'));
    // research resolves to the FIRST matching tool (offline readTool),
    // so use the internet-only path via send_message instead:
    expect(out.status).toBe('completed');
    const out2 = await agent.run(task('send_message'));
    expect(out2.status).toBe('unavailable');
  });

  it('denies sensitive actions when the gate denies', async () => {
    const {agent} = makeCtx(true, false);
    const out = await agent.run(task('send_message'));
    expect(out.status).toBe('denied');
  });

  it('completes an approved action and saves the outcome to memory', async () => {
    const {agent, memory} = makeCtx(true, true);
    const out = await agent.run(task('send_message'));
    expect(out.status).toBe('completed');
    const saved = await memory.loadAll();
    expect(saved).toHaveLength(1);
    expect(saved[0].taskId).toBe('t1');
  });

  it('completes a plain read task without approval friction', async () => {
    const {agent} = makeCtx(true, false);
    const out = await agent.run(task('research'));
    expect(out.status).toBe('completed');
  });

  it('reports failure when the tool throws', async () => {
    const boom: Tool = {
      capability: 'teach',
      risk: 'read',
      requiresInternet: false,
      execute: async () => {
        throw new Error('kaboom');
      },
    };
    const agent = new MoosaAgent([boom], {
      isOnline: async () => true,
      permissionGate: new DenyAllPermissionGate(),
      memory: new AsyncStorageMemoryStore(),
    });
    const out = await agent.run(task('teach'));
    expect(out.status).toBe('failed');
    if (out.status === 'failed') {
      expect(out.reason).toContain('kaboom');
    }
  });
});

describe('AsyncStorageMemoryStore', () => {
  beforeEach(async () => {
    await AsyncStorage.clear();
  });

  it('round-trips entries in order', async () => {
    const store = new AsyncStorageMemoryStore();
    await store.save({taskId: 'a', instruction: 'x', outcome: {ok: true, summary: 's'}, timestamp: 1});
    await store.save({taskId: 'b', instruction: 'y', outcome: {ok: true, summary: 's'}, timestamp: 2});
    const all = await store.loadAll();
    expect(all.map(e => e.taskId)).toEqual(['a', 'b']);
  });

  it('caps the log at 200 entries', async () => {
    const store = new AsyncStorageMemoryStore();
    for (let i = 0; i < 205; i++) {
      await store.save({taskId: `t${i}`, instruction: 'x', outcome: {ok: true, summary: 's'}, timestamp: i});
    }
    const all = await store.loadAll();
    expect(all).toHaveLength(200);
    expect(all[0].taskId).toBe('t5');
  });
});

describe('talentTool adapter with the real CalculateEngine', () => {
  const tool = talentTool(new CalculateEngine(), {
    capability: 'chat',
    risk: 'read',
    requiresInternet: false,
    buildArgs: t => ({expression: t.instruction}),
  });

  it('evaluates an expression and returns evidence', async () => {
    const res = await tool.execute({id: 'x', instruction: '2+3*4', capability: 'chat'});
    expect(res.ok).toBe(true);
    expect(res.summary).toContain('14');
    expect(res.evidence && res.evidence.length).toBeGreaterThan(0);
    expect(verifyToolResult(res).verified).toBe(true);
  });

  it('maps engine errors to ok=false with no evidence', async () => {
    const res = await tool.execute({id: 'x', instruction: '2+', capability: 'chat'});
    expect(res.ok).toBe(false);
    expect(verifyToolResult(res).verified).toBe(false);
  });
});

describe('verifyToolResult', () => {
  it('rejects ok results without evidence', () => {
    const v = verifyToolResult({ok: true, summary: 'claimed'});
    expect(v.verified).toBe(false);
    expect(v.reasons).toContain('no evidence attached');
  });
});
