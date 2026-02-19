import { CosmosClient } from '@azure/cosmos';
import { DefaultAzureCredential } from '@azure/identity';

let client: CosmosClient | null = null;

// Track active query operations for cancellation support
const activeQueries = new Map<string, AbortController>();

export const cosmosService = {
    connect: async (connectionStringOrEndpoint: string) => {
        try {
            // Check if it's a full connection string or just an endpoint
            if (connectionStringOrEndpoint.includes('AccountKey=')) {
                client = new CosmosClient(connectionStringOrEndpoint);
            } else {
                // Assume it's an endpoint and use Azure Identity
                console.log('Using Azure Identity for endpoint:', connectionStringOrEndpoint);
                client = new CosmosClient({
                    endpoint: connectionStringOrEndpoint,
                    aadCredentials: new DefaultAzureCredential()
                });
            }

            // Verify connection by listing databases
            const { resources } = await client.databases.readAll().fetchAll();

            // Fetch account info
            const accountInfo = await client.getDatabaseAccount();

            // Default to 'Cosmos DB' if we can't find a good name, but id is usually the account name
            let accountName = (accountInfo?.resource as any)?.id;

            if (!accountName && accountInfo?.headers && accountInfo.headers['content-location']) {
                const contentLoc = accountInfo.headers['content-location'] as string;
                const match = contentLoc.match(/https:\/\/([\w-]+)\.documents\.azure\.com/);
                if (match && match[1]) {
                    accountName = match[1];
                }
            }

            if (!accountName) accountName = 'Cosmos DB';

            return { success: true, data: { databases: resources.map(d => d.id), accountName } };
        } catch (error: any) {
            console.error('Cosmos Connection Error:', error);
            return { success: false, error: error.message };
        }
    },

    query: async (databaseId: string, containerId: string, query: string, pageSize: number | 'All' = 10, queryId?: string) => {
        console.log(`[Cosmos] Querying ${databaseId}/${containerId}. PageSize: ${pageSize}, QueryId: ${queryId}`);
        if (!client) return { success: false, error: 'Not connected' };

        // Set up abort controller for this query
        const abortController = new AbortController();
        if (queryId) {
            activeQueries.set(queryId, abortController);
        }

        try {
            const database = client.database(databaseId);
            const container = database.container(containerId);

            let resources: any[] = [];
            let hasMoreResults = false;

            // Check if cancelled before starting
            if (abortController.signal.aborted) {
                return { success: false, error: 'Query cancelled', cancelled: true };
            }

            if (pageSize === 'All') {
                // Fetch everything for 'All'
                const result = await container.items.query(query, {
                    abortSignal: abortController.signal
                }).fetchAll();
                resources = result.resources;
                hasMoreResults = false;
            } else {
                // Iterate through pages until we have enough results or no more pages.
                // This is necessary for cross-partition queries where the target document
                // might not be in the first batch of partitions scanned.
                const queryIterator = container.items.query(query, {
                    maxItemCount: pageSize,
                    abortSignal: abortController.signal
                });

                while (resources.length < pageSize) {
                    // Check if cancelled before each fetch
                    if (abortController.signal.aborted) {
                        return { success: false, error: 'Query cancelled', cancelled: true };
                    }

                    const { resources: batch, hasMoreResults: more } = await queryIterator.fetchNext();

                    if (batch && batch.length > 0) {
                        resources.push(...batch);
                    }

                    // If no more results available, stop
                    if (!more) {
                        hasMoreResults = false;
                        break;
                    }

                    // If we've collected enough, there might be more
                    if (resources.length >= pageSize) {
                        hasMoreResults = more;
                        break;
                    }
                }

                // Trim to exactly pageSize if we got more
                if (resources.length > pageSize) {
                    hasMoreResults = true;
                    resources = resources.slice(0, pageSize);
                }
            }

            return { success: true, data: { items: resources, hasMoreResults } };
        } catch (error: any) {
            // Check if this was an abort error
            if (error.name === 'AbortError' || abortController.signal.aborted) {
                console.log('Query was cancelled');
                return { success: false, error: 'Query cancelled', cancelled: true };
            }

            console.error('Query Error:', error);
            let errorMessage = error.message;

            if (error.body) {
                try {
                    const body = JSON.parse(error.body);
                    if (body.message) {
                        errorMessage = body.message;
                    }
                } catch (e) {
                    // Body is not JSON, use it as is if it's a string
                    if (typeof error.body === 'string') {
                        errorMessage = error.body;
                    }
                }
            }
            return { success: false, error: errorMessage };
        } finally {
            // Clean up the abort controller
            if (queryId) {
                activeQueries.delete(queryId);
            }
        }
    },

    cancelQuery: (queryId: string) => {
        console.log('Main: Cancelling query:', queryId);
        const controller = activeQueries.get(queryId);
        if (controller) {
            controller.abort();
            activeQueries.delete(queryId);
            return { success: true };
        }
        return { success: false, error: 'Query not found or already completed' };
    },

    getContainers: async (databaseId: string) => {
        if (!client) return { success: false, error: 'Not connected' };
        try {
            const database = client.database(databaseId);
            const { resources } = await database.containers.readAll().fetchAll();
            return { success: true, data: resources.map(c => c.id) };
        } catch (error: any) {
            return { success: false, error: error.message };
        }
    },

    getDocument: async (databaseId: string, containerId: string, docId: string) => {
        if (!client) return { success: false, error: 'Not connected' };
        try {
            const database = client.database(databaseId);
            const container = database.container(containerId);
            const { resource } = await container.item(docId, docId).read(); // Assuming partition key is id for simplicity, or we need to ask for it
            return { success: true, data: resource };
        } catch (error: any) {
            return { success: false, error: error.message };
        }
    },

    getContainerInfo: async (databaseId: string, containerId: string) => {
        console.log('[Cosmos] getContainerInfo called:', databaseId, containerId);
        if (!client) return { success: false, error: 'Not connected' };
        try {
            const database = client.database(databaseId);
            const container = database.container(containerId);

            // Read container to get full metadata including headers with usage stats
            console.log('[Cosmos] Reading container...');
            const { resource, headers } = await container.read();
            console.log('[Cosmos] Container read complete, resource:', !!resource);
            console.log('[Cosmos] Headers:', JSON.stringify(headers, null, 2));

            if (!resource) {
                return { success: false, error: 'Container not found' };
            }

            // Parse resource usage from headers
            // Format: "documentCount=123;documentsSize=456789;..."
            let documentCount: number | undefined;
            let documentsSizeKB: number | undefined;
            let indexSizeKB: number | undefined;

            // Log all headers to see what's available
            console.log('[Cosmos] x-ms-resource-usage:', headers?.['x-ms-resource-usage']);

            const resourceUsage = headers?.['x-ms-resource-usage'];
            if (resourceUsage && typeof resourceUsage === 'string') {
                console.log('[Cosmos] Parsing resource usage:', resourceUsage);
                const usageMap: Record<string, string> = {};
                resourceUsage.split(';').forEach(part => {
                    const [key, value] = part.split('=');
                    if (key && value) {
                        usageMap[key.trim()] = value.trim();
                    }
                });
                console.log('[Cosmos] Usage map:', usageMap);

                if (usageMap['documentCount']) {
                    documentCount = parseInt(usageMap['documentCount'], 10);
                }
                if (usageMap['documentsSize']) {
                    // Convert bytes to KB
                    documentsSizeKB = Math.round(parseInt(usageMap['documentsSize'], 10) / 1024);
                }
                if (usageMap['indexesSize']) {
                    indexSizeKB = Math.round(parseInt(usageMap['indexesSize'], 10) / 1024);
                }
            }

            // Note: Document count and size stats are not available from container.read()
            // They would require Azure Monitor APIs or running queries, which we skip to keep this fast


            // Extract partition key paths
            const partitionKeyPaths = resource.partitionKey?.paths || [];
            const partitionKeyVersion = resource.partitionKey?.version;

            // Extract indexing policy
            const indexingPolicy = resource.indexingPolicy || {};
            const formattedIndexingPolicy = {
                indexingMode: indexingPolicy.indexingMode || 'consistent',
                automatic: indexingPolicy.automatic !== false,
                includedPaths: (indexingPolicy.includedPaths || []).map((p: any) => p.path),
                excludedPaths: (indexingPolicy.excludedPaths || []).map((p: any) => p.path),
                compositeIndexes: indexingPolicy.compositeIndexes?.map((composite: any[]) =>
                    composite.map((idx: any) => ({ path: idx.path, order: idx.order }))
                ),
                spatialIndexes: indexingPolicy.spatialIndexes?.map((spatial: any) => ({
                    path: spatial.path,
                    types: spatial.types
                }))
            };

            // Extract unique key paths
            const uniqueKeyPaths = resource.uniqueKeyPolicy?.uniqueKeys?.map(
                (uk: any) => uk.paths
            );

            const containerInfo = {
                id: resource.id,
                partitionKeyPaths,
                partitionKeyVersion,
                indexingPolicy: formattedIndexingPolicy,
                defaultTtl: resource.defaultTtl,
                uniqueKeyPaths,
                documentCount,
                documentsSizeKB,
                indexSizeKB,
                _ts: resource._ts,
                _etag: resource._etag
            };

            return { success: true, data: containerInfo };
        } catch (error: any) {
            console.error('GetContainerInfo Error:', error);
            return { success: false, error: error.message };
        }
    },

    getContainerKeys: async (databaseId: string, containerId: string, sampleSize: number = 100) => {
        if (!client) return { success: false, error: 'Not connected' };
        try {
            const database = client.database(databaseId);
            const container = database.container(containerId);

            // Fetch a sample of documents
            const { resources } = await container.items
                .query(`SELECT TOP ${sampleSize} * FROM c`)
                .fetchAll();

            if (!resources || resources.length === 0) {
                return { success: true, data: [] };
            }

            const paths = new Set<string>();

            const extractPaths = (obj: any, prefix: string = '') => {
                if (!obj || typeof obj !== 'object') return;

                for (const key of Object.keys(obj)) {
                    // Skip internal Cosmos DB properties starting with _
                    if (key.startsWith('_') && prefix === '') continue;

                    const currentPath = prefix ? `${prefix}.${key}` : key;
                    paths.add(currentPath);

                    if (obj[key] && typeof obj[key] === 'object' && !Array.isArray(obj[key])) {
                        extractPaths(obj[key], currentPath);
                    } else if (Array.isArray(obj[key]) && obj[key].length > 0) {
                        // For arrays, we could optionally explore elements, but let's stick to object keys for now
                        // to avoid excessive paths. If we wanted to, we could do:
                        // extractPaths(obj[key][0], `${currentPath}[]`);
                    }
                }
            };

            for (const doc of resources) {
                extractPaths(doc);
            }

            return { success: true, data: Array.from(paths).sort() };
        } catch (error: any) {
            console.error('GetContainerKeys Error:', error);
            return { success: false, error: error.message };
        }
    },

    upsertDocument: async (databaseId: string, containerId: string, document: any) => {
        if (!client) return { success: false, error: 'Not connected' };
        try {
            const database = client.database(databaseId);
            const container = database.container(containerId);
            const { resource } = await container.items.upsert(document);
            return { success: true, data: resource };
        } catch (error: any) {
            console.error('UpsertDocument Error:', error);
            return { success: false, error: error.message };
        }
    }
};
