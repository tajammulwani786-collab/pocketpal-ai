/**
 * Verification tests for ChatGPT's moosaTaskAdvisor (Patch 01),
 * written by Muse from the test cases in the patch README.
 */
import {adviseMoosaTask} from '../moosaTaskAdvisor';

describe('adviseMoosaTask — ChatGPT Patch 01 cases', () => {
  it("'Mujhe English sikhao' => learning/fast", () => {
    const a = adviseMoosaTask('Mujhe English sikhao');
    expect(a.kind).toBe('learning');
    expect(a.preferredTier).toBe('fast');
    expect(a.needsOwnerApprovalForAction).toBe(false);
  });

  it("'Shopify client SEO audit' => business/balanced, internet hint true", () => {
    const a = adviseMoosaTask('Shopify client SEO audit');
    expect(a.kind).toBe('business');
    expect(a.preferredTier).toBe('balanced');
    expect(a.requiresInternetForLiveData).toBe(true);
  });

  it("'BTC latest price' => trading/balanced, internet hint true", () => {
    const a = adviseMoosaTask('BTC latest price');
    expect(a.kind).toBe('trading');
    expect(a.preferredTier).toBe('balanced');
    expect(a.requiresInternetForLiveData).toBe(true);
  });

  it("'Screenshot scan karo' => vision/vision", () => {
    const a = adviseMoosaTask('Screenshot scan karo');
    expect(a.kind).toBe('vision');
    expect(a.preferredTier).toBe('vision');
  });

  it("'Buy BTC' => trading/balanced, approval hint true", () => {
    const a = adviseMoosaTask('Buy BTC');
    expect(a.kind).toBe('trading');
    expect(a.preferredTier).toBe('balanced');
    expect(a.needsOwnerApprovalForAction).toBe(true);
  });

  it('plain chat falls back to general/fast with no hints', () => {
    const a = adviseMoosaTask('Assalam o Alaikum, kya haal hai?');
    expect(a.kind).toBe('general');
    expect(a.preferredTier).toBe('fast');
    expect(a.requiresInternetForLiveData).toBe(false);
    expect(a.needsOwnerApprovalForAction).toBe(false);
  });
});
