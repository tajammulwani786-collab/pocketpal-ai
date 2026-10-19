/**
 * MOOSA Client Assistant (Sprint B foundation) — written by Muse.
 *
 * A pure, offline, dependency-free workflow for client messages the
 * owner pastes in manually:
 *   1. analyzeClientMessage  -> structured requirement brief
 *   2. draftClientReply      -> professional English reply draft
 *   3. buildProjectPlan      -> phased project plan
 *   4. qualityCheckDraft     -> rule checks over the draft
 *   5. runClientWorkflow     -> all of the above in one result
 *
 * HONESTY RULES (enforced by the quality check and the tests):
 * - Extraction is transparent keyword/pattern matching. It can miss
 *   things; everything extracted is echoed from the client's own
 *   words, never invented. Quantities, deadlines, budgets and URLs
 *   appear in the reply ONLY if the client actually stated them.
 * - The reply is a structured template draft for the owner to review
 *   and edit before sending. MOOSA never sends it anywhere.
 * - Nothing here calls a network, a model or a platform API.
 */

export type ClientService =
  | 'captions'
  | 'product-descriptions'
  | 'seo-audit'
  | 'shopify'
  | 'social-posts'
  | 'general';

export interface ClientRequirementBrief {
  rawMessage: string;
  service: ClientService;
  platform?: string;
  url?: string;
  quantity?: number;
  quantityUnit?: string;
  deadlineText?: string;
  budgetText?: string;
  /** Polite questions the owner should ask before starting. */
  missingInfo: string[];
  /** One-line recap built ONLY from what the client stated. */
  summary: string;
}

export interface ProjectPlan {
  title: string;
  phases: {name: string; steps: string[]}[];
}

export interface DraftQuality {
  passed: string[];
  warnings: string[];
}

export interface ClientWorkflowResult {
  brief: ClientRequirementBrief;
  replyDraft: string;
  plan: ProjectPlan;
  quality: DraftQuality;
}

const SERVICE_PATTERNS: {service: ClientService; pattern: RegExp}[] = [
  {service: 'seo-audit', pattern: /\b(seo audit|audit (my|the|our) (site|website|store)|website audit)\b/i},
  {service: 'product-descriptions', pattern: /\b(product descriptions?|descriptions? for (my )?products?)\b/i},
  {service: 'captions', pattern: /\b(captions?|hashtags?)\b/i},
  {service: 'shopify', pattern: /\b(shopify)\b/i},
  {service: 'social-posts', pattern: /\b(social media posts?|content calendar|posts? for (instagram|facebook|my page))\b/i},
];

const SERVICE_LABEL: Record<ClientService, string> = {
  captions: 'social media captions',
  'product-descriptions': 'product descriptions',
  'seo-audit': 'SEO audit',
  shopify: 'Shopify store work',
  'social-posts': 'social media posts',
  general: 'your project',
};

function extractUrl(s: string): string | undefined {
  const m = s.match(/https?:\/\/[^\s)]+/i);
  return m ? m[0] : undefined;
}

function extractPlatform(s: string): string | undefined {
  const platforms: [RegExp, string][] = [
    [/\binstagram\b/i, 'Instagram'],
    [/\bfacebook\b/i, 'Facebook'],
    [/\btiktok\b/i, 'TikTok'],
    [/\blinkedin\b/i, 'LinkedIn'],
    [/\bshopify\b/i, 'Shopify'],
    [/\bamazon\b/i, 'Amazon'],
    [/\bwordpress\b/i, 'WordPress'],
  ];
  for (const [re, label] of platforms) {
    if (re.test(s)) return label;
  }
  return undefined;
}

function extractQuantity(
  s: string,
): {quantity?: number; quantityUnit?: string} {
  const m = s.match(
    /(\d+)\s+(?:[a-z]+\s+){0,2}?(captions?|posts?|descriptions?|products?|items?|pages?|articles?|blogs?|designs?|banners?)/i,
  );
  if (m) return {quantity: parseInt(m[1], 10), quantityUnit: m[2].toLowerCase()};
  return {};
}

function extractDeadline(s: string): string | undefined {
  const patterns = [
    /\bwithin\s+(\d+\s*(?:days?|weeks?|hours?))/i,
    /\bin\s+(\d+\s*(?:days?|weeks?))\b/i,
    /\bby\s+(tomorrow|today|tonight|monday|tuesday|wednesday|thursday|friday|saturday|sunday|next week|this week)/i,
    /\bdeadline(?:\s+is)?\s*:?\s*([^\n.,;]{3,30})/i,
  ];
  for (const re of patterns) {
    const m = s.match(re);
    if (m) return m[0].trim();
  }
  return undefined;
}

function extractBudget(s: string): string | undefined {
  const m =
    s.match(/(?:\$|₹|rs\.?|inr|usd)\s?\d[\d,]*(?:\.\d+)?/i) ||
    s.match(/\d[\d,]*\s*(?:rupees|dollars|usd|inr)/i) ||
    s.match(/\bbudget(?:\s+is)?\s*:?\s*([^\n.,;]{2,20})/i);
  return m ? m[0].trim() : undefined;
}

export function analyzeClientMessage(message: string): ClientRequirementBrief {
  const raw = (message || '').trim();
  const s = raw.toLowerCase();

  let service: ClientService = 'general';
  for (const {service: svc, pattern} of SERVICE_PATTERNS) {
    if (pattern.test(s)) {
      service = svc;
      break;
    }
  }

  const platform = extractPlatform(s);
  const url = extractUrl(raw);
  const {quantity, quantityUnit} = extractQuantity(s);
  const deadlineText = extractDeadline(s);
  const budgetText = extractBudget(s);

  const missingInfo: string[] = [];
  if (service === 'general') {
    missingInfo.push('Could you please tell me exactly what service you need (for example captions, product descriptions, or an SEO audit)?');
  }
  if ((service === 'seo-audit' || service === 'shopify') && !url) {
    missingInfo.push('Could you please share your store/website link so I can review it?');
  }
  if (
    (service === 'captions' || service === 'product-descriptions' || service === 'social-posts') &&
    quantity === undefined
  ) {
    missingInfo.push('How many pieces do you need in total?');
  }
  if (
    (service === 'captions' || service === 'social-posts') &&
    !platform
  ) {
    missingInfo.push('Which platform are these for (Instagram, Facebook, TikTok)?');
  }
  if (service === 'captions' || service === 'social-posts') {
    missingInfo.push('Do you have a preferred tone — friendly, formal, or fun?');
  }
  if (!deadlineText) {
    missingInfo.push('By when do you need the work delivered?');
  }

  const bits: string[] = [`Service: ${SERVICE_LABEL[service]}`];
  if (quantity !== undefined) bits.push(`Quantity: ${quantity} ${quantityUnit ?? ''}`.trim());
  if (platform) bits.push(`Platform: ${platform}`);
  if (url) bits.push(`Link: ${url}`);
  if (deadlineText) bits.push(`Deadline (client's words): ${deadlineText}`);
  if (budgetText) bits.push(`Budget (client's words): ${budgetText}`);

  return {
    rawMessage: raw,
    service,
    platform,
    url,
    quantity,
    quantityUnit,
    deadlineText,
    budgetText,
    missingInfo,
    summary: bits.join(' | '),
  };
}

export function draftClientReply(
  brief: ClientRequirementBrief,
  ownerName: string = 'Tajamul',
): string {
  const lines: string[] = [];
  lines.push('Hello,');
  lines.push('');
  lines.push('Thank you for your message and for considering my services.');
  lines.push('');

  // Recap ONLY what the client actually stated.
  const recap: string[] = [];
  if (brief.service !== 'general') {
    recap.push(`help with ${SERVICE_LABEL[brief.service]}`);
  }
  if (brief.quantity !== undefined) {
    recap.push(`${brief.quantity} ${brief.quantityUnit ?? 'pieces'}`);
  }
  if (brief.platform && brief.service !== 'shopify') {
    recap.push(`for ${brief.platform}`);
  }
  if (brief.url) recap.push(`for ${brief.url}`);
  if (brief.deadlineText) recap.push(`(${brief.deadlineText})`);
  if (recap.length > 0) {
    lines.push(`I understand you need ${recap.join(' ')}. I can help you with this.`);
  } else {
    lines.push('I would be happy to help you with your project.');
  }
  if (brief.budgetText) {
    lines.push(`I noted the budget you mentioned (${brief.budgetText}); we can confirm the final scope together.`);
  }
  lines.push('');

  if (brief.missingInfo.length > 0) {
    lines.push('So that I can start properly, could you please confirm:');
    brief.missingInfo.forEach((q, i) => lines.push(`${i + 1}. ${q}`));
    lines.push('');
  }

  lines.push(
    'Once you confirm these details, I will share a clear work plan and start right away. I will also send you a sample first so you can check the quality before the full delivery.',
  );
  lines.push('');
  lines.push('Looking forward to your reply.');
  lines.push('');
  lines.push('Best regards,');
  lines.push(ownerName);
  return lines.join('\n');
}

export function buildProjectPlan(brief: ClientRequirementBrief): ProjectPlan {
  const label = SERVICE_LABEL[brief.service];
  const workSteps: Record<ClientService, string[]> = {
    captions: [
      'Confirm brand tone, platform and hashtags style',
      'Write the captions in batches',
      'Add relevant hashtags (maximum 5 per caption, per quality rules)',
      'Proofread spelling, grammar and tone',
    ],
    'product-descriptions': [
      'Collect product details and key benefits from the client',
      'Write descriptions with features + benefits structure',
      'Check for copied text and invented claims',
      'Proofread spelling, grammar and tone',
    ],
    'seo-audit': [
      'Review the pages the client provided or linked',
      'List confirmed problems separately from suggestions',
      'Prioritise fixes by impact (quick wins first)',
      'Prepare a clear report the owner can review before sending',
    ],
    shopify: [
      'Review the store pages the client shared',
      'Note confirmed issues (content, layout, product pages)',
      'Prepare recommended changes for owner approval',
      'Apply/prepare changes only after client confirmation',
    ],
    'social-posts': [
      'Confirm platforms, posting frequency and tone',
      'Draft the posts in batches',
      'Proofread and check platform fit',
    ],
    general: [
      'Confirm the exact scope with the client',
      'Break the work into small deliverables',
      'Complete and quality-check each deliverable',
    ],
  };

  return {
    title: `Project plan — ${label}`,
    phases: [
      {name: '1. Understand & confirm', steps: ['Review the requirement brief', 'Send the reply draft and collect missing details', 'Confirm scope and deadline with the client']},
      {name: '2. Create', steps: workSteps[brief.service]},
      {name: '3. Quality check', steps: ['Run the quality checklist (no invented facts, no copied text, no income promises)', 'Fix every problem found before delivering']},
      {name: '4. Deliver & follow up', steps: ['Prepare the final delivery message for owner approval', 'Deliver only after the owner approves', 'Note revision requests and follow up politely']},
    ],
  };
}

const INVENTED_PRICE_RE = /(?:\$|₹)\s?\d[\d,]*/;
const PROMISE_WORDS = [
  'guaranteed income',
  'guarantee earnings',
  '100% profit',
  'get rich',
  'double your money',
];

export function qualityCheckDraft(
  draft: string,
  brief: ClientRequirementBrief,
): DraftQuality {
  const passed: string[] = [];
  const warnings: string[] = [];
  const lower = draft.toLowerCase();

  if (/^(hello|hi|dear)\b/i.test(draft.trim())) passed.push('Greeting present');
  else warnings.push('No greeting at the start');

  if (brief.missingInfo.length > 0) {
    if (draft.includes('?')) passed.push('Clarifying questions included');
    else warnings.push('Missing-info questions exist but the draft asks none');
  }

  // Invented price rule: a price may appear only if the client stated one.
  const priceInDraft = draft.match(INVENTED_PRICE_RE);
  if (priceInDraft) {
    const draftDigits = priceInDraft[0].replace(/[^\d]/g, '');
    const budgetDigits = (brief.budgetText || '').replace(/[^\d]/g, '');
    if (brief.budgetText && budgetDigits && draftDigits === budgetDigits) {
      passed.push('Price mentioned matches the client-stated budget');
    } else {
      warnings.push('Draft contains a price the client never stated — remove it (no invented prices)');
    }
  } else {
    passed.push('No invented price in the draft');
  }

  const promiseHit = PROMISE_WORDS.find(w => lower.includes(w));
  if (promiseHit) warnings.push(`Income-promise wording found: "${promiseHit}" — never promise earnings`);
  else passed.push('No income promises');

  const words = draft.split(/\s+/).filter(Boolean).length;
  if (words >= 40 && words <= 260) passed.push(`Length reasonable (${words} words)`);
  else warnings.push(`Length unusual (${words} words) — aim for 40–260 words`);

  if (/best regards|kind regards|regards,/i.test(draft)) passed.push('Professional sign-off present');
  else warnings.push('No professional sign-off');

  return {passed, warnings};
}

export function runClientWorkflow(
  message: string,
  ownerName: string = 'Tajamul',
): ClientWorkflowResult {
  const brief = analyzeClientMessage(message);
  const replyDraft = draftClientReply(brief, ownerName);
  const plan = buildProjectPlan(brief);
  const quality = qualityCheckDraft(replyDraft, brief);
  return {brief, replyDraft, plan, quality};
}
