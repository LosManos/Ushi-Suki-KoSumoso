import { CosmosClient } from '@azure/cosmos';
import { DefaultAzureCredential } from '@azure/identity';

let client: CosmosClient | null = null;

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

    query: async (databaseId: string, containerId: string, query: string, pageSize: number | 'All' = 10) => {
        console.log('Main: Received query request. PageSize:', pageSize);
        if (!client) return { success: false, error: 'Not connected' };
        try {
            const database = client.database(databaseId);
            const container = database.container(containerId);

            let resources;
            if (pageSize === 'All') {
                const result = await container.items.query(query).fetchAll();
                resources = result.resources;
            } else {
                const result = await container.items.query(query, { maxItemCount: pageSize }).fetchNext();
                resources = result.resources;
            }

            return { success: true, data: resources };
        } catch (error: any) {
            return { success: false, error: error.message };
        }
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
    }
};
