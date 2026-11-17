import { describe, expect, it } from 'vitest';
import { extractInboxKey, isInboxAddress } from '@/lib/inbox-key';

const KEY = 'AbCdEfGhIjKlMnOpQrStUvWx-_012345';

describe('extractInboxKey', () => {
  it('reads the key out of a pasted address', () => {
    expect(extractInboxKey(`https://my-budget.example/api/inbox?k=${KEY}`)).toBe(KEY);
    expect(extractInboxKey(`  https://x.test/api/inbox?k=${KEY}\n`)).toBe(KEY);
    expect(extractInboxKey(`https://x.test/api/inbox?deep=1&k=${KEY}&z=1`)).toBe(KEY);
  });

  it('takes a bare key', () => {
    expect(extractInboxKey(KEY)).toBe(KEY);
  });

  it('refuses anything that is not a key', () => {
    expect(extractInboxKey('')).toBeNull();
    expect(extractInboxKey('https://x.test/api/inbox')).toBeNull();
    expect(extractInboxKey('https://x.test/api/inbox?k=short')).toBeNull();
    expect(extractInboxKey(`https://x.test/api/inbox?k=${'a'.repeat(65)}`)).toBeNull();
    expect(extractInboxKey('스타벅스 5,000원 승인')).toBeNull();
  });
});

describe('isInboxAddress', () => {
  it('is true only for a whole address', () => {
    expect(isInboxAddress(`https://x.test/api/inbox?k=${KEY}`)).toBe(true);
    expect(isInboxAddress(KEY)).toBe(false);
    expect(isInboxAddress('https://x.test/api/inbox?k=abc')).toBe(false);
  });
});
