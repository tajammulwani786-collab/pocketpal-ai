/**
 * MOOSA task advisor: pure, offline, dependency-free recommendation logic.
 * Advisory only: does NOT load models, grant PACT talents or execute actions.
 */
import type {MoosaModelTierId} from './moosaModules';

export type MoosaTaskKind = 'learning' | 'business' | 'coding' | 'trading' | 'vision' | 'general';
export interface MoosaTaskAdvice {
  kind: MoosaTaskKind;
  preferredTier: MoosaModelTierId;
  requiresInternetForLiveData: boolean;
  needsOwnerApprovalForAction: boolean;
  explanation: string;
}

const contains = (s: string, pattern: RegExp): boolean => pattern.test(s);

/** Heuristics are transparent and fallible; never use as a security boundary. */
export function adviseMoosaTask(input: string): MoosaTaskAdvice {
  const s = input.toLowerCase().trim();
  const sensitive = contains(s, /\b(send|publish|post|delete|purchase|buy|sell|trade|order|pay|transfer|message client|client ko bhej|kharido|becho)\b/i);
  const live = contains(s, /\b(live|latest|today|current|price|market|news|website|url|scan|search|online|fiverr|shopify|forex|crypto|stock)\b/i);
  let kind: MoosaTaskKind = 'general';
  let preferredTier: MoosaModelTierId = 'fast';
  if (contains(s, /\b(screenshot|photo|image|camera|screen|tasveer)\b/i)) {
    kind = 'vision'; preferredTier = 'vision';
  } else if (contains(s, /\b(crypto|forex|trading|stock|share market|btc|candlestick)\b/i)) {
    kind = 'trading'; preferredTier = 'balanced';
  } else if (contains(s, /\b(code|coding|python|typescript|javascript|debug|programming)\b/i)) {
    kind = 'coding'; preferredTier = 'balanced';
  } else if (contains(s, /\b(fiverr|shopify|client|seo|marketing|product description|caption|business)\b/i)) {
    kind = 'business'; preferredTier = 'balanced';
  } else if (contains(s, /\b(teach|learn|lesson|samjhao|sikhao|practice|english)\b/i)) {
    kind = 'learning'; preferredTier = 'fast';
  }
  return {
    kind, preferredTier,
    requiresInternetForLiveData: live,
    needsOwnerApprovalForAction: sensitive,
    explanation: 'Advisory classification only. Confirm tool permissions and model availability before execution.',
  };
}
