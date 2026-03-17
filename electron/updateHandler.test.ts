import { describe, it, expect, vi, beforeEach } from 'vitest';
import { checkUpdate, getReleases } from './updateHandler';

// Mock global fetch
const globalFetch = vi.fn();
vi.stubGlobal('fetch', globalFetch);

describe('updateHandler', () => {
    beforeEach(() => {
        globalFetch.mockReset();
    });

    describe('checkUpdate', () => {
        it('returns isNewer=true when a newer version is available', async () => {
            globalFetch.mockResolvedValueOnce({
                ok: true,
                json: async () => ({
                    tag_name: 'v1.2.0',
                    html_url: 'https://github.com/...',
                    published_at: '2026-03-12T00:00:00Z'
                })
            });

            const result = await checkUpdate('1.1.5');
            expect(result.isNewer).toBe(true);
            expect(result.latestVersion).toBe('1.2.0');
            expect(result.currentVersion).toBe('1.1.5');
        });

        it('returns isNewer=false when versions are identical', async () => {
            globalFetch.mockResolvedValueOnce({
                ok: true,
                json: async () => ({
                    tag_name: 'v1.1.5',
                })
            });

            const result = await checkUpdate('1.1.5');
            expect(result.isNewer).toBe(false);
        });

        it('returns isNewer=false when current version is newer', async () => {
            globalFetch.mockResolvedValueOnce({
                ok: true,
                json: async () => ({
                    tag_name: 'v1.1.4',
                })
            });

            const result = await checkUpdate('1.1.5');
            expect(result.isNewer).toBe(false);
        });

        it('handles API errors gracefully', async () => {
            globalFetch.mockResolvedValueOnce({
                ok: false,
                status: 403
            });

            const result = await checkUpdate('1.1.5');
            expect(result.error).toBe('GitHub API returned 403');
        });

        it('handles network exceptions gracefully', async () => {
            globalFetch.mockRejectedValueOnce(new Error('Network error'));

            const result = await checkUpdate('1.1.5');
            expect(result.error).toBe('Network error');
        });
    });

    describe('getReleases', () => {
        it('maps github release data correctly', async () => {
            globalFetch.mockResolvedValueOnce({
                ok: true,
                json: async () => ([
                    {
                        tag_name: 'v1.0.0',
                        published_at: '2026-03-12T12:00:00Z',
                        body: 'Release notes',
                        html_url: 'url'
                    }
                ])
            });

            const result = await getReleases();
            expect(result).toHaveLength(1);
            expect(result[0]).toEqual({
                version: '1.0.0',
                date: '2026-03-12',
                body: 'Release notes',
                url: 'url'
            });
        });
    });
});
