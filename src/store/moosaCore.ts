/** MOOSA core — contributed by ChatGPT (2026-10-19, MOOSA_Intelligence_Starter),
 * integrated by Muse without modification. Framework-agnostic orchestration
 * foundation: tool allowlist, per-task permission gate, offline refusal and
 * outcome memory. App-specific wiring lives in moosaAdapters.ts.
 */

/** MOOSA core: framework-agnostic, local-first orchestration foundation.
 * No external packages or network requests. Integrate through adapters.
 */
export type Capability = 'chat' | 'teach' | 'research' | 'website_scan' | 'fiverr_draft' | 'shopify_audit' | 'market_analysis' | 'open_app' | 'publish' | 'send_message' | 'place_trade';
export type Risk = 'read' | 'write' | 'financial';
export interface Task { id: string; instruction: string; capability: Capability; }
export interface ToolResult { ok: boolean; summary: string; evidence?: string[]; }
export interface Tool {
  capability: Capability;
  risk: Risk;
  requiresInternet: boolean;
  execute(task: Task): Promise<ToolResult>;
}
export interface PermissionGate {
  /** Must obtain fresh approval for THIS task and THIS tool; no blanket permission. */
  approve(task: Task, tool: Tool): Promise<boolean>;
}
export interface MemoryStore {
  save(entry: { taskId: string; instruction: string; outcome: ToolResult; timestamp: number }): Promise<void>;
}
export interface ExecutionContext {
  isOnline(): Promise<boolean>;
  permissionGate: PermissionGate;
  memory: MemoryStore;
}
export type ExecutionOutcome =
  | { status: 'completed'; result: ToolResult }
  | { status: 'unavailable' | 'denied' | 'failed'; reason: string };

/** Explicit allowlist; sensitive actions require per-task approval. */
const SENSITIVE = new Set<Capability>(['open_app', 'publish', 'send_message', 'place_trade']);

export class MoosaAgent {
  constructor(private readonly tools: ReadonlyArray<Tool>, private readonly ctx: ExecutionContext) {}

  async run(task: Task): Promise<ExecutionOutcome> {
    const tool = this.tools.find(t => t.capability === task.capability);
    if (!tool) return { status: 'unavailable', reason: `No installed tool for ${task.capability}. Do not claim task completed.` };
    if (tool.requiresInternet && !(await this.ctx.isOnline()))
      return { status: 'unavailable', reason: 'Internet unavailable. No live data or remote action attempted.' };
    if (tool.risk !== 'read' || SENSITIVE.has(task.capability)) {
      if (!(await this.ctx.permissionGate.approve(task, tool)))
        return { status: 'denied', reason: 'User approval not granted.' };
    }
    try {
      const result = await tool.execute(task);
      await this.ctx.memory.save({ taskId: task.id, instruction: task.instruction, outcome: result, timestamp: Date.now() });
      return result.ok ? { status: 'completed', result } : { status: 'failed', reason: result.summary };
    } catch (error) {
      return { status: 'failed', reason: error instanceof Error ? error.message : 'Tool execution error' };
    }
  }
}

export const MOOSA_SYSTEM_POLICY = `You are MOOSA, a local-first personal assistant, mentor, and authorized digital operator. Reply in accessible Roman Urdu/Hinglish or the user's chosen language. Teach digital marketing, Shopify, freelancing, coding, and trading through practical lessons, quizzes, and feedback. Prioritize zero-cost paths to legitimate earnings; never promise income or trading profit. Never claim to have scanned a page, checked live prices, sent a message, or performed an action without actual tool evidence. Offline: use local models and available device tools. Online: use explicit network-enabled tools only, never silently substitute cloud AI models. Ask approval before publishing, sending client messages, changing accounts, accessing sensitive data, making payments, or executing real trades. Do not request passwords or OTPs. For market analysis, distinguish educational analysis from financial advice, verify live data timestamps, and prefer paper trading for practice. Help the user become independent and skilled, not dependent on your answers.`;
