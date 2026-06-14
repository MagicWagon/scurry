import { describe, it, expect, vi } from 'vitest';
import { GET } from '../app/api/search/route.js';
import { buildMamDownloadUrl, buildMamTorrentUrl } from '../src/lib/utilities.js';
import { config } from '../src/lib/config';

const mockConfig = vi.hoisted(() => ({
  qbUrl: '',
  qbUser: '',
  qbPass: '',
  qbCategory: '',
  mamTokenFile: 'secrets/mam_api_token',
  preferEpubOnly: false,
  preferM4b: false
}));

// Mock fetch and dependencies
vi.mock('../src/lib/config', () => ({
  readMamToken: vi.fn(() => 'fake-token'),
  config: mockConfig
}));

global.fetch = vi.fn(async () => ({
  ok: true,
  status: 200,
  json: async () => ({ results: [{ id: '123', dl: 'abc' }], data: [{ id: '123', dl: 'abc', title: 'Test', size: '1MB', filetype: 'epub', added: '2025-08-14', vip: 0, my_snatched: 0, author_info: '{"author":"Author"}', seeders: 10, leechers: 2, times_completed: 5 }]}),
  text: async () => "",
}));

describe('search route', () => {
  beforeEach(() => {
    config.preferEpubOnly = false;
    config.preferM4b = false;
    global.fetch.mockClear();
  });

  it('returns empty results for empty query', async () => {
    const req = { url: 'http://localhost/api/search?q=' };
    const res = await GET(req);
    const json = await res.json();
    expect(json).toEqual({ results: [] });
  });

  it('returns results for valid query', async () => {
    const req = { url: 'http://localhost/api/search?q=test' };
    const res = await GET(req);
    const json = await res.json();
    expect(json.results.length).toBeGreaterThan(0);
  });

  it('handles search results with missing/null fields', async () => {
    global.fetch.mockResolvedValueOnce({
      ok: true,
      status: 200,
      json: async () => ({ 
        data: [{ 
          // All optional fields missing or null
          id: null,
          title: null,
          size: null,
          filetype: null,
          added: null,
          vip: 0,
          free: 0,
          my_snatched: 0,
          author_info: null,
          seeders: null,
          leechers: null,
          times_completed: null,
          dl: null
        }]
      }),
      text: async () => "",
    });

    const req = { url: 'http://localhost/api/search?q=test' };
    const res = await GET(req);
    const json = await res.json();
    
    expect(json.results.length).toBe(1);
    const result = json.results[0];
    expect(result.id).toBeNull();
    expect(result.title).toBe('');
    expect(result.size).toBe('');
    expect(result.filetypes).toBe('');
    expect(result.addedDate).toBe('');
    expect(result.seeders).toBe('0');
    expect(result.leechers).toBe('0');
    expect(result.downloads).toBe('0');
  });

  it('returns narrator for audiobook results when present', async () => {
    global.fetch.mockResolvedValueOnce({
      ok: true,
      status: 200,
      json: async () => ({
        data: [{
          id: 'audio-1',
          dl: 'abc',
          title: 'Audio',
          size: '1 GB',
          filetype: 'm4b',
          added: '2025-08-14',
          vip: 0,
          free: 0,
          my_snatched: 0,
          author_info: '{"author":"Author","narrator":"Narrator"}',
          seeders: 10,
          leechers: 2,
          times_completed: 5
        }]
      }),
      text: async () => "",
    });

    const req = { url: 'http://localhost/api/search?q=test&category=audiobooks' };
    const res = await GET(req);
    const json = await res.json();

    expect(json.results[0].author).toBe('Author');
    expect(json.results[0].narrator).toBe('Narrator');
  });

  it('moves EPUB-only book results to the top without filtering', async () => {
    config.preferEpubOnly = true;
    global.fetch.mockResolvedValueOnce({
      ok: true,
      status: 200,
      json: async () => ({
        data: [
          { id: 'pdf', dl: 'pdf', title: 'PDF', size: '1 MB', filetype: 'pdf', added: '', vip: 0, free: 0, my_snatched: 0, author_info: '{"author":"A"}', seeders: 1, leechers: 0, times_completed: 1 },
          { id: 'epub', dl: 'epub', title: 'EPUB', size: '1 MB', filetype: 'epub', added: '', vip: 0, free: 0, my_snatched: 0, author_info: '{"author":"A"}', seeders: 1, leechers: 0, times_completed: 1 },
          { id: 'mixed', dl: 'mixed', title: 'Mixed', size: '1 MB', filetype: 'epub, mobi', added: '', vip: 0, free: 0, my_snatched: 0, author_info: '{"author":"A"}', seeders: 1, leechers: 0, times_completed: 1 }
        ]
      }),
      text: async () => "",
    });

    const res = await GET({ url: 'http://localhost/api/search?q=test&category=books' });
    const json = await res.json();

    expect(json.results.map(result => result.id)).toEqual(['epub', 'pdf', 'mixed']);
  });

  it('moves M4B audiobook results to the top without filtering', async () => {
    config.preferM4b = true;
    global.fetch.mockResolvedValueOnce({
      ok: true,
      status: 200,
      json: async () => ({
        data: [
          { id: 'mp3', dl: 'mp3', title: 'MP3', size: '1 GB', filetype: 'mp3', added: '', vip: 0, free: 0, my_snatched: 0, author_info: '{"author":"A"}', seeders: 1, leechers: 0, times_completed: 1 },
          { id: 'm4b', dl: 'm4b', title: 'M4B', size: '1 GB', filetype: 'm4b', added: '', vip: 0, free: 0, my_snatched: 0, author_info: '{"author":"A"}', seeders: 1, leechers: 0, times_completed: 1 },
          { id: 'mixed', dl: 'mixed', title: 'Mixed', size: '1 GB', filetype: 'mp3 / m4b', added: '', vip: 0, free: 0, my_snatched: 0, author_info: '{"author":"A"}', seeders: 1, leechers: 0, times_completed: 1 }
        ]
      }),
      text: async () => "",
    });

    const res = await GET({ url: 'http://localhost/api/search?q=test&category=audiobooks' });
    const json = await res.json();

    expect(json.results.map(result => result.id)).toEqual(['m4b', 'mixed', 'mp3']);
  });
});

describe('token expiration handling', () => {
  beforeEach(() => {
    // Reset the mock before each test
    global.fetch.mockClear();
  });

  it('returns 401 with tokenExpired flag for 403 "not signed in" response', async () => {
    global.fetch.mockResolvedValueOnce({
      ok: false,
      status: 403,
      json: async () => ({}),
      text: async () => "Error, you are not signed in <br />Other error"
    });

    const req = { url: 'http://localhost/api/search?q=test' };
    const res = await GET(req);
    const json = await res.json();

    expect(res.status).toBe(401);
    expect(json.tokenExpired).toBe(true);
    expect(json.error).toBe('Your MAM token has expired or is invalid. Please update your token using the token manager.');
    expect(json.results).toEqual([]);
  });

  it('returns 401 with tokenExpired flag for HTML response (Cloudflare scenario)', async () => {
    global.fetch.mockResolvedValueOnce({
      ok: true,
      status: 200,
      json: async () => { throw new Error('Invalid JSON'); },
      text: async () => "<!DOCTYPE html><html><head><title>Error</title></head><body>Bad gateway</body></html>"
    });

    const req = { url: 'http://localhost/api/search?q=test' };
    const res = await GET(req);
    const json = await res.json();

    expect(res.status).toBe(401);
    expect(json.tokenExpired).toBe(true);
    expect(json.error).toBe('Your MAM token has expired or is invalid. Please update your token using the token manager.');
    expect(json.results).toEqual([]);
  });

  it('returns 401 with tokenExpired flag for lowercase html response', async () => {
    global.fetch.mockResolvedValueOnce({
      ok: true,
      status: 200,
      json: async () => { throw new Error('Invalid JSON'); },
      text: async () => "<html><body>Some html content</body></html>"
    });

    const req = { url: 'http://localhost/api/search?q=test' };
    const res = await GET(req);
    const json = await res.json();

    expect(res.status).toBe(401);
    expect(json.tokenExpired).toBe(true);
    expect(json.error).toBe('Your MAM token has expired or is invalid. Please update your token using the token manager.');
    expect(json.results).toEqual([]);
  });

  it('returns 502 for 403 without "not signed in" message', async () => {
    global.fetch.mockResolvedValueOnce({
      ok: false,
      status: 403,
      json: async () => ({}),
      text: async () => "Forbidden - some other error"
    });

    const req = { url: 'http://localhost/api/search?q=test' };
    const res = await GET(req);
    const json = await res.json();

    expect(res.status).toBe(502);
    expect(json.tokenExpired).toBeUndefined();
    expect(json.error).toBe('Search failed: 403 Forbidden - some other error');
    expect(json.results).toEqual([]);
  });

  it('returns 502 for non-HTML JSON parse errors', async () => {
    global.fetch.mockResolvedValueOnce({
      ok: true,
      status: 200,
      json: async () => { throw new Error('Invalid JSON'); },
      text: async () => "Invalid JSON response"
    });

    const req = { url: 'http://localhost/api/search?q=test' };
    const res = await GET(req);
    const json = await res.json();

    expect(res.status).toBe(502);
    expect(json.tokenExpired).toBeUndefined();
    expect(json.error).toBe('Invalid JSON from endpoint');
    expect(json.results).toEqual([]);
  });

  it('handles case-insensitive "not signed in" detection', async () => {
    global.fetch.mockResolvedValueOnce({
      ok: false,
      status: 403,
      json: async () => ({}),
      text: async () => "ERROR, YOU ARE NOT SIGNED IN <BR />OTHER ERROR"
    });

    const req = { url: 'http://localhost/api/search?q=test' };
    const res = await GET(req);
    const json = await res.json();

    expect(res.status).toBe(401);
    expect(json.tokenExpired).toBe(true);
    expect(json.error).toBe('Your MAM token has expired or is invalid. Please update your token using the token manager.');
  });
});
