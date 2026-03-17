import { describe, it, expect, vi, beforeEach } from 'vitest';
import { cosmosService } from './cosmos';
import { CosmosClient } from '@azure/cosmos';

// Mock the @azure/cosmos SDK
vi.mock('@azure/cosmos', () => {
    const mockQueryIterator = {
        fetchAll: vi.fn(),
        fetchNext: vi.fn()
    };

    const mockItem = {
        read: vi.fn(),
        delete: vi.fn()
    };

    const mockItems = {
        query: vi.fn(() => mockQueryIterator),
        upsert: vi.fn()
    };

    const mockContainer = {
        items: mockItems,
        item: vi.fn(() => mockItem),
        read: vi.fn()
    };

    const mockDatabase = {
        container: vi.fn(() => mockContainer),
        containers: {
            readAll: vi.fn(() => mockQueryIterator)
        }
    };

    const mockClientInstance = {
        database: vi.fn(() => mockDatabase),
        databases: {
            readAll: vi.fn(() => mockQueryIterator)
        },
        getDatabaseAccount: vi.fn()
    };

    return {
        CosmosClient: vi.fn().mockImplementation(function() {
            return mockClientInstance;
        }),
        __mockQueryIterator: mockQueryIterator,
        __mockItem: mockItem,
        __mockItems: mockItems,
        __mockContainer: mockContainer,
        __mockDatabase: mockDatabase,
        __mockClientInstance: mockClientInstance
    };
});

// We need to import the mocked instances to assert on them
import * as cosmosMock from '@azure/cosmos';

describe('cosmosService', () => {
    const mocks = cosmosMock as any;

    beforeEach(() => {
        vi.clearAllMocks();

        // Setup successful connection returns
        mocks.__mockQueryIterator.fetchAll.mockResolvedValue({ resources: [{ id: 'db1' }, { id: 'db2' }] });
        mocks.__mockClientInstance.getDatabaseAccount.mockResolvedValue({
            resource: { id: 'TestAccount' }
        });
    });

    describe('connect', () => {
        it('uses connection string if "AccountKey=" is present', async () => {
            const result = await cosmosService.connect('AccountEndpoint=https://test.documents.azure.com:443/;AccountKey=secret;');
            expect(result.success).toBe(true);
            expect(result.data?.accountName).toBe('TestAccount');
            expect(mocks.CosmosClient).toHaveBeenCalledWith('AccountEndpoint=https://test.documents.azure.com:443/;AccountKey=secret;');
        });

        it('handles connection errors gracefully', async () => {
            mocks.__mockQueryIterator.fetchAll.mockRejectedValueOnce(new Error('Network failure'));
            const result = await cosmosService.connect('AccountEndpoint=...');
            expect(result.success).toBe(false);
            expect(result.error).toBe('Network failure');
        });
    });

    describe('query', () => {
        beforeEach(async () => {
            // Ensure we are "connected"
            await cosmosService.connect('AccountKey=123');
        });

        it('queries "All" documents', async () => {
            const mockResources = [{ id: '1' }, { id: '2' }];
            mocks.__mockQueryIterator.fetchAll.mockResolvedValueOnce({
                resources: mockResources
            });

            const result = await cosmosService.query('db', 'cont', 'SELECT * FROM c', 'All');

            expect(result.success).toBe(true);
            expect(result.data?.items).toEqual(mockResources);
            expect(result.data?.hasMoreResults).toBe(false);

            // Verify the query was passed down
            expect(mocks.__mockItems.query).toHaveBeenCalledWith('SELECT * FROM c', expect.any(Object));
        });

        it('paginates correctly using fetchNext', async () => {
            mocks.__mockQueryIterator.fetchNext
                .mockResolvedValueOnce({ resources: [1, 2], hasMoreResults: true })
                .mockResolvedValueOnce({ resources: [3], hasMoreResults: false });

            const result = await cosmosService.query('db', 'cont', 'SELECT * FROM c', 10);

            expect(result.success).toBe(true);
            expect(result.data?.items).toEqual([1, 2, 3]);
            expect(result.data?.hasMoreResults).toBe(false);
        });

        it('stops paginating when pageSize is reached', async () => {
            mocks.__mockQueryIterator.fetchNext
                .mockResolvedValueOnce({ resources: [1, 2], hasMoreResults: true })
                .mockResolvedValueOnce({ resources: [3, 4], hasMoreResults: true });

            const result = await cosmosService.query('db', 'cont', 'SELECT * FROM c', 3);

            expect(result.success).toBe(true);
            // It fetched 4 items but should slice it to exactly 3
            expect(result.data?.items).toEqual([1, 2, 3]);
            expect(result.data?.hasMoreResults).toBe(true);
        });

        it('handles query cancellation', async () => {
            // Mock a slow query that never resolves in time, but the abort signal is checked
            mocks.__mockItems.query.mockImplementationOnce((query: string, options: any) => {
                // Simulate checking the signal immediately
                if (options.abortSignal.aborted) {
                    throw { name: 'AbortError', message: 'The operation was aborted.' };
                }
                return mocks.__mockQueryIterator;
            });
            
            // Connect and start query, then cancel immediately
            const queryPromise = cosmosService.query('db', 'cont', 'SELECT * FROM c', 10, 'query-123');
            cosmosService.cancelQuery('query-123');
            
            const result = await queryPromise;

            expect(result.success).toBe(false);
            expect(result.cancelled).toBe(true);
        });

        it('extracts nested JSON error messages', async () => {
            mocks.__mockItems.query.mockImplementationOnce(() => {
                const error = new Error('Generic error') as any;
                error.body = JSON.stringify({ message: 'Syntax error near SELECT' });
                throw error;
            });

            const result = await cosmosService.query('db', 'cont', 'INVALID SQL', 10);

            expect(result.success).toBe(false);
            expect(result.error).toBe('Syntax error near SELECT');
        });
    });

    describe('getContainerInfo', () => {
        beforeEach(async () => {
            await cosmosService.connect('AccountKey=123');
        });

        it('parses x-ms-resource-usage headers correctly', async () => {
            mocks.__mockContainer.read.mockResolvedValueOnce({
                resource: {
                    id: 'MyContainer',
                    partitionKey: { paths: ['/userId'], version: 2 },
                },
                headers: {
                    'x-ms-resource-usage': 'documentCount=50;documentsSize=2048;indexesSize=1024'
                }
            });

            const result = await cosmosService.getContainerInfo('db', 'MyContainer');

            expect(result.success).toBe(true);
            expect(result.data?.documentCount).toBe(50);
            expect(result.data?.documentsSizeKB).toBe(2); // 2048 / 1024
            expect(result.data?.indexSizeKB).toBe(1); // 1024 / 1024
            expect(result.data?.partitionKeyPaths).toEqual(['/userId']);
        });

        it('handles missing headers gracefully', async () => {
            mocks.__mockContainer.read.mockResolvedValueOnce({
                resource: { id: 'NoStats' },
                headers: {}
            });

            const result = await cosmosService.getContainerInfo('db', 'NoStats');
            expect(result.success).toBe(true);
            expect(result.data?.documentCount).toBeUndefined();
        });
    });

    describe('CRUD operations', () => {
        beforeEach(async () => {
            await cosmosService.connect('AccountKey=123');
        });

        it('getDocument isolates the request correctly', async () => {
            mocks.__mockItem.read.mockResolvedValueOnce({ resource: { id: 'doc1' } });
            const result = await cosmosService.getDocument('db', 'cont', 'doc1');
            expect(result.success).toBe(true);
            expect(mocks.__mockContainer.item).toHaveBeenCalledWith('doc1', 'doc1');
            expect(mocks.__mockItem.read).toHaveBeenCalled();
        });

        it('upsertDocument calls the container items API', async () => {
            mocks.__mockItems.upsert.mockResolvedValueOnce({ resource: { id: 'new' } });
            const result = await cosmosService.upsertDocument('db', 'cont', { id: 'new' });
            expect(result.success).toBe(true);
            expect(mocks.__mockItems.upsert).toHaveBeenCalledWith({ id: 'new' });
        });

        it('deleteDocument handles partition key logic', async () => {
            mocks.__mockItem.delete.mockResolvedValueOnce({});
            const result = await cosmosService.deleteDocument('db', 'cont', 'doc1', 'pkVal');
            
            expect(result.success).toBe(true);
            expect(mocks.__mockContainer.item).toHaveBeenCalledWith('doc1', 'pkVal');
            expect(mocks.__mockItem.delete).toHaveBeenCalled();
        });
        
        it('deleteDocument falls back to docId for pk if undefined', async () => {
            mocks.__mockItem.delete.mockResolvedValueOnce({});
            await cosmosService.deleteDocument('db', 'cont', 'doc2');
            
            // If partitionKeyValue is omitted, it should default to docId
            expect(mocks.__mockContainer.item).toHaveBeenCalledWith('doc2', 'doc2');
        });
    });
});
