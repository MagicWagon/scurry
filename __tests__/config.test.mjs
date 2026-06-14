import { describe, it, test, expect, beforeEach, afterEach, vi } from 'vitest';
import { config, readMamToken } from '../src/lib/config.js';

describe('config', () => {
  const originalEnv = process.env;

  beforeEach(() => {
    vi.resetModules(); // Clear module cache
    process.env = { ...originalEnv }; // Reset environment variables
  });

  afterEach(() => {
    process.env = originalEnv; // Restore original environment
  });

  test('should have default appPassword', () => {
    expect(config.appPassword).toBeDefined();
    expect(typeof config.appPassword).toBe('string');
  });
  
  test('should have qbUrl, qbUser, qbPass', () => {
    expect(config.qbUrl).toBeDefined();
    expect(config.qbUser).toBeDefined();
    expect(config.qbPass).toBeDefined();
  });

  test('should use default values when environment variables are not set', async () => {
    // Remove environment variables that have defaults
    delete process.env.APP_PASSWORD;
    delete process.env.APP_QB_CATEGORY;
    delete process.env.APP_QB_BOOK_CATEGORY;
    delete process.env.APP_QB_AUDIOBOOK_CATEGORY;
    delete process.env.APP_QB_USERNAME;
    delete process.env.APP_QB_PASSWORD;
    delete process.env.APP_MAM_USER_AGENT;
    delete process.env.APP_PREFER_EPUB_ONLY;
    delete process.env.APP_PREFER_M4B;
    delete process.env.APP_DEFAULT_SEARCH_CATEGORY;
    
    // Set required environment variable
    process.env.APP_QB_URL = 'http://test-qb-url';
    
    // Clear module cache and re-import
    vi.resetModules();
    const { config: freshConfig } = await import('../src/lib/config.js?t=' + Date.now());
    expect(freshConfig.appPassword).toBe('cheese');
    expect(freshConfig.qbCategory).toBe('books');
    expect(freshConfig.qbBookCategory).toBe('books');
    expect(freshConfig.qbAudiobookCategory).toBe('audiobooks');
    expect(freshConfig.qbUser).toBe('admin');
    expect(freshConfig.qbPass).toBe('adminadmin');
    expect(freshConfig.mamUA).toBe('Scurry/1.0 (+contact)');
    expect(freshConfig.qbUrl).toBe('http://test-qb-url');
    expect(freshConfig.preferEpubOnly).toBe(false);
    expect(freshConfig.preferM4b).toBe(false);
    expect(freshConfig.defaultSearchCategory).toBe('books');
  });

  test('should use environment variables when they are set', async () => {
    process.env.APP_PASSWORD = 'custom-password';
    process.env.APP_QB_URL = 'http://custom-qb-url';
    process.env.APP_QB_CATEGORY = 'custom-category';
    process.env.APP_QB_BOOK_CATEGORY = 'custom-books';
    process.env.APP_QB_AUDIOBOOK_CATEGORY = 'custom-audio';
    process.env.APP_QB_USERNAME = 'custom-user';
    process.env.APP_QB_PASSWORD = 'custom-pass';
    process.env.APP_MAM_USER_AGENT = 'Custom/1.0';
    process.env.APP_PREFER_EPUB_ONLY = 'true';
    process.env.APP_PREFER_M4B = '1';
    process.env.APP_DEFAULT_SEARCH_CATEGORY = 'both';
    
    vi.resetModules();
    const { config: freshConfig } = await import('../src/lib/config.js?t=' + Date.now());
    expect(freshConfig.appPassword).toBe('custom-password');
    expect(freshConfig.qbUrl).toBe('http://custom-qb-url');
    expect(freshConfig.qbCategory).toBe('custom-category');
    expect(freshConfig.qbBookCategory).toBe('custom-books');
    expect(freshConfig.qbAudiobookCategory).toBe('custom-audio');
    expect(freshConfig.qbUser).toBe('custom-user');
    expect(freshConfig.qbPass).toBe('custom-pass');
    expect(freshConfig.mamUA).toBe('Custom/1.0');
    expect(freshConfig.preferEpubOnly).toBe(true);
    expect(freshConfig.preferM4b).toBe(true);
    expect(freshConfig.defaultSearchCategory).toBe('both');
  });

  test('should fall back to books for invalid default search category', async () => {
    process.env.APP_QB_URL = 'http://test-qb-url';
    process.env.APP_DEFAULT_SEARCH_CATEGORY = 'invalid';

    vi.resetModules();
    const { config: freshConfig } = await import('../src/lib/config.js?t=' + Date.now());
    expect(freshConfig.defaultSearchCategory).toBe('books');
  });

  test('should throw error when required environment variable is missing', async () => {
    delete process.env.APP_QB_URL;
    
    vi.resetModules();
    await expect(async () => {
      await import('../src/lib/config.js?t=' + Date.now());
    }).rejects.toThrow('Missing env: APP_QB_URL');
  });
});

describe('readMamToken', () => {
  afterEach(() => {
    vi.restoreAllMocks();
  });

  test('should return token if file exists', () => {
    const fakeToken = 'FAKE_TOKEN';
    vi.spyOn(require('node:fs'), 'readFileSync').mockReturnValue(fakeToken);
    const token = readMamToken();
    expect(typeof token).toBe('string');
    expect(token.length).toBeGreaterThan(0);
    expect(token).toBe(fakeToken);
  });

  it('readMamToken throws if file read fails', () => {
    vi.spyOn(require('node:fs'), 'readFileSync').mockImplementation(() => { throw new Error('fail'); });
    expect(() => readMamToken()).toThrow('fail');
  });

  it('readMamToken returns empty string if file is empty', () => {
    vi.spyOn(require('node:fs'), 'readFileSync').mockReturnValue('');
    expect(readMamToken()).toBe('');
  });
});
