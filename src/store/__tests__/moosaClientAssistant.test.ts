/**
 * Tests for the MOOSA Client Assistant workflow (Sprint B foundation).
 * Every case uses a realistic client message; assertions check that
 * extraction echoes the client's own words and that nothing (price,
 * deadline, quantity) is invented.
 */
import {
  analyzeClientMessage,
  draftClientReply,
  qualityCheckDraft,
  runClientWorkflow,
  explainBriefInRomanUrdu,
} from '../moosaClientAssistant';

describe('analyzeClientMessage', () => {
  it('extracts a full captions brief from a detailed message', () => {
    const b = analyzeClientMessage(
      'Hi, I need 30 Instagram captions for my clothing store. Please deliver within 3 days. My budget is $40.',
    );
    expect(b.service).toBe('captions');
    expect(b.platform).toBe('Instagram');
    expect(b.quantity).toBe(30);
    expect(b.deadlineText).toContain('3 days');
    expect(b.budgetText).toContain('40');
    // Quantity and deadline were given: must NOT be asked again.
    expect(b.missingInfo.join(' ')).not.toMatch(/how many/i);
    expect(b.missingInfo.join(' ')).not.toMatch(/by when/i);
  });

  it('vague Shopify message asks for the store link and scope', () => {
    const b = analyzeClientMessage('Hello, can you help with my Shopify store?');
    expect(b.service).toBe('shopify');
    expect(b.missingInfo.join(' ')).toMatch(/link/i);
  });

  it('SEO audit message extracts the URL', () => {
    const b = analyzeClientMessage(
      'Please do an SEO audit for my website https://example-store.com and tell me the problems.',
    );
    expect(b.service).toBe('seo-audit');
    expect(b.url).toBe('https://example-store.com');
    expect(b.missingInfo.join(' ')).not.toMatch(/link/i);
  });

  it('unknown request falls back to general and asks what is needed', () => {
    const b = analyzeClientMessage('Hi there, I saw your profile and I have some work.');
    expect(b.service).toBe('general');
    expect(b.missingInfo.length).toBeGreaterThan(0);
  });
});

describe('draftClientReply + qualityCheckDraft', () => {
  it('reply echoes stated facts and invents no price', () => {
    const brief = analyzeClientMessage(
      'Hi, I need 30 Instagram captions for my clothing store. Please deliver within 3 days. My budget is $40.',
    );
    const draft = draftClientReply(brief);
    expect(draft).toContain('30');
    expect(draft).toContain('$40');
    expect(draft).toMatch(/Best regards/);
    const qc = qualityCheckDraft(draft, brief);
    expect(qc.warnings).toEqual([]);
  });

  it('reply to a budget-less message contains no price at all', () => {
    const brief = analyzeClientMessage('I need 10 product descriptions for my shop.');
    expect(brief.service).toBe('product-descriptions');
    const draft = draftClientReply(brief);
    expect(draft).not.toMatch(/\$|₹/);
    const qc = qualityCheckDraft(draft, brief);
    expect(qc.warnings).toEqual([]);
  });

  it('QC flags an invented price in a hand-edited draft', () => {
    const brief = analyzeClientMessage('I need 5 captions please.');
    const badDraft =
      'Hello,\n\nThank you for your message. I can do this for $999 only.\n\nBest regards,\nTajamul';
    const qc = qualityCheckDraft(badDraft, brief);
    expect(qc.warnings.join(' ')).toMatch(/never stated/);
  });

  it('QC flags income-promise wording', () => {
    const brief = analyzeClientMessage('I need captions.');
    const badDraft =
      'Hello,\n\nThank you. With my captions you get guaranteed income fast.\n\nBest regards,\nTajamul';
    const qc = qualityCheckDraft(badDraft, brief);
    expect(qc.warnings.join(' ')).toMatch(/income-promise/i);
  });
});

describe('runClientWorkflow', () => {
  it('produces brief + draft + 4-phase plan + clean QC for a complete message', () => {
    const r = runClientWorkflow(
      'Hi, I need 30 Instagram captions for my clothing store. Please deliver within 3 days. My budget is $40.',
    );
    expect(r.brief.service).toBe('captions');
    expect(r.replyDraft.length).toBeGreaterThan(100);
    expect(r.plan.phases).toHaveLength(4);
    expect(r.plan.phases[3].name).toMatch(/Deliver/);
    expect(r.quality.warnings).toEqual([]);
  });
});

describe('explainBriefInRomanUrdu', () => {
  it('explains a full brief using only client-stated facts', () => {
    const b = analyzeClientMessage(
      'Hi, I need 30 Instagram captions for my clothing store. Please deliver within 3 days. My budget is $40.',
    );
    const urdu = explainBriefInRomanUrdu(b);
    expect(urdu).toContain('captions');
    expect(urdu).toContain('30');
    expect(urdu).toContain('$40');
    expect(urdu).toMatch(/nahi bhejta/);
  });

  it('says clearly when deadline and budget were not stated', () => {
    const b = analyzeClientMessage('I need some captions for my page.');
    const urdu = explainBriefInRomanUrdu(b);
    expect(urdu).toMatch(/koi deadline nahi/);
    expect(urdu).toMatch(/koi budget nahi/);
  });
});
