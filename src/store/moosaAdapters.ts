/**
 * MOOSA adapters — written by Muse to wire ChatGPT's moosaCore
 * orchestration foundation to this app's real systems. Nothing here
 * overwrites upstream code (AgentRunner, PalStore, ModelStore are
 * untouched); these are seams and implementations of the core's
 * interfaces:
 *
 * 1. AsyncStorageMemoryStore — MemoryStore on AsyncStorage (the same
 *    persistence PalStore itself uses for its seeded keys). The
 *    WatermelonDB/SQLite layer stays the app's chat database; a
 *    dedicated memory table there is a later, migration-gated step.
 * 2. createFetchOnlineChecker — dependency-free connectivity probe.
 * 3. AlertPermissionGate — real per-task user approval dialog
 *    (React Native Alert). Fails closed: deny, dismiss, or a second
 *    prompt already open all resolve to "not approved".
 * 4. talentTool — factory adapting a real TalentEngine
 *    (src/services/talents) into a moosaCore Tool. Concrete capability
 *    registrations are made only where a capability genuinely
 *    matches an engine; inside chat, engines are used through PACT +
 *    AgentRunner (see buildAgentRunOptions), exactly as upstream does.
 * 5. buildAgentRunOptions — the AgentRunner integration seam: builds
 *    AgentRunOptions with the app's real talentRegistry lookup and a
 *    Pal's PACT-declared talent names as the allowlist.
 * 6. verifyToolResult — a result only counts as verified-complete
 *    when it is ok AND carries evidence; used before any success is
 *    reported to the user.
 */
import {Alert} from 'react-native';
import AsyncStorage from '@react-native-async-storage/async-storage';

import type {
  Capability,
  MemoryStore,
  PermissionGate,
  Risk,
  Task,
  Tool,
  ToolResult,
} from './moosaCore';
import type {TalentEngine} from '../services/talents/types';
import {talentRegistry} from '../services/talents/TalentRegistry';
import {DEFAULT_MAX_TURNS} from '../services/agent/AgentRunner';
import type {AgentRunOptions} from '../services/agent/AgentRunner.types';
import type {CompletionEngine} from '../utils/completionTypes';
import type {ApiCompletionParams} from '../utils/completionTypes';

// ---------------------------------------------------------------- memory

export type MoosaMemoryEntry = Parameters<MemoryStore['save']>[0];

const MEMORY_KEY = 'Moosa.agentMemory.v1';
const MEMORY_CAP = 200;

export class AsyncStorageMemoryStore implements MemoryStore {
  async save(entry: MoosaMemoryEntry): Promise<void> {
    const all = await this.loadAll();
    all.push(entry);
    const capped = all.slice(-MEMORY_CAP);
    await AsyncStorage.setItem(MEMORY_KEY, JSON.stringify(capped));
  }

  async loadAll(): Promise<MoosaMemoryEntry[]> {
    try {
      const raw = await AsyncStorage.getItem(MEMORY_KEY);
      if (!raw) {
        return [];
      }
      const parsed = JSON.parse(raw);
      return Array.isArray(parsed) ? parsed : [];
    } catch {
      return [];
    }
  }

  async clear(): Promise<void> {
    await AsyncStorage.removeItem(MEMORY_KEY);
  }
}

// ------------------------------------------------------------- online check

/**
 * Dependency-free online probe (the app has no NetInfo dependency).
 * Probes Hugging Face, a host the app already talks to. A probe is a
 * hint, not a guarantee: callers must still handle request failures.
 */
export function createFetchOnlineChecker(
  url = 'https://huggingface.co',
  timeoutMs = 4000,
): () => Promise<boolean> {
  return async () => {
    try {
      const ctrl = new AbortController();
      const timer = setTimeout(() => ctrl.abort(), timeoutMs);
      const res = await fetch(url, {method: 'HEAD', signal: ctrl.signal});
      clearTimeout(timer);
      return res.ok || res.status < 500;
    } catch {
      return false;
    }
  };
}

// --------------------------------------------------------- permission gate

/** Always denies. For background execution and tests: fail closed. */
export class DenyAllPermissionGate implements PermissionGate {
  async approve(_task: Task, _tool: Tool): Promise<boolean> {
    return false;
  }
}

/**
 * Real user approval dialog. Shows the exact task and the tool that
 * wants to run it; "Allow once" is the only approving action. Deny,
 * dismissal, or an already-open prompt all fail closed.
 */
export class AlertPermissionGate implements PermissionGate {
  private open = false;

  approve(task: Task, tool: Tool): Promise<boolean> {
    if (this.open) {
      return Promise.resolve(false);
    }
    this.open = true;
    return new Promise<boolean>(resolve => {
      const done = (value: boolean) => {
        this.open = false;
        resolve(value);
      };
      Alert.alert(
        'MOOSA permission',
        `${task.instruction}\n\nTool: ${tool.capability} (risk: ${tool.risk})`,
        [
          {text: 'Deny', style: 'cancel', onPress: () => done(false)},
          {text: 'Allow once', onPress: () => done(true)},
        ],
        {cancelable: true, onDismiss: () => done(false)},
      );
    });
  }
}

// ------------------------------------------------------------ talent tools

export interface TalentToolOptions {
  capability: Capability;
  risk: Risk;
  requiresInternet: boolean;
  buildArgs: (task: Task) => Record<string, any>;
}

/** Adapt a real TalentEngine into a moosaCore Tool. */
export function talentTool(engine: TalentEngine, opts: TalentToolOptions): Tool {
  return {
    capability: opts.capability,
    risk: opts.risk,
    requiresInternet: opts.requiresInternet,
    async execute(task: Task): Promise<ToolResult> {
      const result = await engine.execute(opts.buildArgs(task));
      const ok = result.type !== 'error';
      return {
        ok,
        summary: result.summary,
        evidence: ok ? [result.summary] : [],
      };
    },
  };
}

// ------------------------------------------------------ AgentRunner seam

export interface MoosaAgentRunDeps {
  /** The llama.rn-bound completion engine (created by the chat hook). */
  engine: CompletionEngine;
  initialParams: ApiCompletionParams;
  /** Talent names the Pal declares in pact.talents — the allowlist. */
  allowedTalentNames: string[];
  messageId: string;
  maxTurns?: number;
  signal?: AbortSignal;
}

/**
 * Build the options object for the existing AgentRunner (runAgent),
 * using the app's real talentRegistry for lookups — the same seam
 * useChatSession uses. MOOSA Pals get agent tool-calling by declaring
 * talents in their PACT; nothing here replaces the runner.
 */
export function buildAgentRunOptions(deps: MoosaAgentRunDeps): AgentRunOptions {
  return {
    engine: deps.engine,
    initialParams: deps.initialParams,
    allowedTalentNames: deps.allowedTalentNames,
    talentLookup: (name: string) => talentRegistry.get(name),
    triggerMarkers: [],
    messageId: deps.messageId,
    maxTurns: deps.maxTurns ?? DEFAULT_MAX_TURNS,
    signal: deps.signal,
  };
}

// ------------------------------------------------------- result verification

/**
 * Task-execution result verification: a tool result is only
 * "verified" when it succeeded AND carries evidence. Callers must not
 * report success to the user for unverified results.
 */
export function verifyToolResult(result: ToolResult): {
  verified: boolean;
  reasons: string[];
} {
  const reasons: string[] = [];
  if (!result.ok) {
    reasons.push('tool reported failure');
  }
  if (!result.summary) {
    reasons.push('empty summary');
  }
  if (!result.evidence || result.evidence.length === 0) {
    reasons.push('no evidence attached');
  }
  return {verified: reasons.length === 0, reasons};
}
