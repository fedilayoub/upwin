import { describe, expect, it } from 'vitest';
import { isLauncherSenderUrl } from './sender';

describe('launcher sender urls', () => {
  it('accepts any ordinary web page, which is where the launcher runs', () => {
    expect(isLauncherSenderUrl('https://www.upwork.com/nx/find-work/')).toBe(true);
    expect(isLauncherSenderUrl('https://example.com/')).toBe(true);
    expect(isLauncherSenderUrl('http://localhost:3000/dashboard')).toBe(true);
  });

  it('rejects schemes the launcher is not injected into', () => {
    expect(isLauncherSenderUrl('chrome-extension://abcdef/sidepanel.html')).toBe(
      false,
    );
    expect(isLauncherSenderUrl('javascript:alert(1)')).toBe(false);
    expect(isLauncherSenderUrl('file:///Users/someone/page.html')).toBe(false);
    expect(isLauncherSenderUrl('ftp://files.example.com/x')).toBe(false);
    expect(isLauncherSenderUrl('data:text/html,<p>hi')).toBe(false);
  });

  it('rejects malformed and missing urls', () => {
    expect(isLauncherSenderUrl('not a url')).toBe(false);
    expect(isLauncherSenderUrl('')).toBe(false);
    expect(isLauncherSenderUrl(undefined)).toBe(false);
  });
});
