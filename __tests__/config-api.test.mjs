import { describe, it, expect, vi } from 'vitest';

vi.mock('../src/lib/settings', () => ({
  readSettings: vi.fn(() => ({
    search: {
      defaultCategory: 'both',
      preferEpubOnly: true,
      preferM4b: false,
    },
  })),
}));

const { GET } = await import('../app/api/config/route.js');

describe('config compatibility API', () => {
  it('returns search defaults from the settings service', async () => {
    const response = await GET();
    expect(await response.json()).toEqual({
      defaultSearchCategory: 'both',
      preferEpubOnly: true,
      preferM4b: false,
    });
  });
});
