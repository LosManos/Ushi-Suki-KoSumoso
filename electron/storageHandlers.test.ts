import { describe, it, expect, vi, beforeEach } from 'vitest';
import fs from 'fs';
import { saveSchema, getSchemas, saveTemplate, getTemplates, deleteTemplate, migrateToExplicitHierarchy } from './storageHandlers';

// Mock the real 'fs' module
vi.mock('fs', () => {
    return {
        default: {
            existsSync: vi.fn(),
            promises: {
                readFile: vi.fn(),
                writeFile: vi.fn()
            }
        }
    };
});

describe('storageHandlers', () => {
    const TEMP_FILE = '/fake/path/data.json';
    const TEST_KEY = 'Acc1/Db1/Cont1';

    beforeEach(() => {
        vi.clearAllMocks();
    });

    // ─── migrateToExplicitHierarchy ────────────────────────────────────────

    describe('migrateToExplicitHierarchy', () => {
        it('returns early if data already has Accounts array', () => {
            const data = { Accounts: [{ Name: 'Test' }] };
            const result = migrateToExplicitHierarchy(data);
            expect(result).toBe(data);
        });

        it('migrates flat array to explicit hierarchy', () => {
            const legacyData = [
                {
                    accountName: 'Acc1',
                    databaseId: 'Db1',
                    containerId: 'Cont1',
                    query: 'SELECT * FROM c',
                    id: '123'
                }
            ];

            const result = migrateToExplicitHierarchy(legacyData);
            expect(result.Accounts).toHaveLength(1);
            expect(result.Accounts[0].Name).toBe('Acc1');
            expect(result.Accounts[0].Databases[0].Name).toBe('Db1');
            expect(result.Accounts[0].Databases[0].Containers[0].Name).toBe('Cont1');
            expect(result.Accounts[0].Databases[0].Containers[0].Items[0].Query).toBe('SELECT * FROM c');
        });
    });

    // ─── Schemas ───────────────────────────────────────────────────────────

    describe('saveSchema', () => {
        it('creates new hierarchy if file does not exist', async () => {
            (fs.existsSync as any).mockReturnValue(false);

            await saveSchema(TEMP_FILE, TEST_KEY, ['id', 'name']);

            expect(fs.promises.writeFile).toHaveBeenCalled();
            const writeArgs = (fs.promises.writeFile as any).mock.calls[0];
            expect(writeArgs[0]).toBe(TEMP_FILE);

            const writtenData = JSON.parse(writeArgs[1]);
            expect(writtenData.Accounts[0].Name).toBe('Acc1');
            expect(writtenData.Accounts[0].Databases[0].Containers[0].Keys).toEqual(['id', 'name']);
        });

        it('updates existing container keys', async () => {
            const existingData = {
                Accounts: [{
                    Name: 'Acc1', Databases: [{
                        Name: 'Db1', Containers: [{
                            Name: 'Cont1', Keys: ['old'], LastUpdated: 'old'
                        }]
                    }]
                }]
            };

            (fs.existsSync as any).mockReturnValue(true);
            (fs.promises.readFile as any).mockResolvedValue(JSON.stringify(existingData));

            await saveSchema(TEMP_FILE, TEST_KEY, ['new1', 'new2']);

            const writeArgs = (fs.promises.writeFile as any).mock.calls[0];
            const writtenData = JSON.parse(writeArgs[1]);
            expect(writtenData.Accounts[0].Databases[0].Containers[0].Keys).toEqual(['new1', 'new2']);
        });
    });

    describe('getSchemas', () => {
        it('returns empty object if file missing', async () => {
            (fs.existsSync as any).mockReturnValue(false);
            const result = await getSchemas(TEMP_FILE);
            expect(result.success).toBe(true);
            expect(result.data).toEqual({});
        });

        it('flattens hierarchy into flat map', async () => {
            const existingData = {
                Accounts: [{
                    Name: 'Acc1', Databases: [{
                        Name: 'Db1', Containers: [{
                            Name: 'Cont1', Keys: ['k1']
                        }]
                    }]
                }]
            };
            (fs.existsSync as any).mockReturnValue(true);
            (fs.promises.readFile as any).mockResolvedValue(JSON.stringify(existingData));

            const result = await getSchemas(TEMP_FILE);
            expect(result.data['Acc1/Db1/Cont1']).toEqual(['k1']);
        });
    });

    // ─── Templates ─────────────────────────────────────────────────────────

    describe('saveTemplate', () => {
        it('saves a new template', async () => {
            (fs.existsSync as any).mockReturnValue(false);
            await saveTemplate(TEMP_FILE, TEST_KEY, 'new-template');

            const writeArgs = (fs.promises.writeFile as any).mock.calls[0];
            const writtenData = JSON.parse(writeArgs[1]);
            expect(writtenData.Accounts[0].Databases[0].Containers[0].Template).toBe('new-template');
        });

        it('deletes container and cascades upwards if saved template is empty', async () => {
            const existingData = {
                Accounts: [{
                    Name: 'Acc1', Databases: [{
                        Name: 'Db1', Containers: [{
                            Name: 'Cont1', Template: 'old'
                        }]
                    }]
                }]
            };
            (fs.existsSync as any).mockReturnValue(true);
            (fs.promises.readFile as any).mockResolvedValue(JSON.stringify(existingData));

            // Save empty string -> Triggers deletion
            await saveTemplate(TEMP_FILE, TEST_KEY, '   ');

            const writeArgs = (fs.promises.writeFile as any).mock.calls[0];
            const writtenData = JSON.parse(writeArgs[1]);

            // The array should be completely empty because the cascade delete reached the top
            expect(writtenData.Accounts).toEqual([]);
        });
    });

    describe('deleteTemplate', () => {
        it('deletes the template and cleans up empty parents', async () => {
            const existingData = {
                Accounts: [{
                    Name: 'Acc1', Databases: [{
                        Name: 'Db1', Containers: [{
                            Name: 'Cont1', Template: 'old'
                        }, {
                            Name: 'Cont2', Template: 'keep-me'
                        }]
                    }]
                }]
            };
            (fs.existsSync as any).mockReturnValue(true);
            (fs.promises.readFile as any).mockResolvedValue(JSON.stringify(existingData));

            await deleteTemplate(TEMP_FILE, 'Acc1/Db1/Cont1');

            const writeArgs = (fs.promises.writeFile as any).mock.calls[0];
            const writtenData = JSON.parse(writeArgs[1]);

            // Cont1 should be gone, but Cont2 should remain
            expect(writtenData.Accounts[0].Databases[0].Containers).toHaveLength(1);
            expect(writtenData.Accounts[0].Databases[0].Containers[0].Name).toBe('Cont2');
        });
    });
});
