import { CosmosClient } from '@azure/cosmos';

let client: CosmosClient | null = null;

export const cosmosService = {
    connect: async (connectionString: string) => {
        try {
            client = new CosmosClient(connectionString);
            // Verify connection by listing databases
            const { resources } = await client.databases.readAll().fetchAll();
            return { success: true, databases: resources.map(d => d.id) };
        } catch (error: any) {
            console.error('Cosmos Connection Error:', error);
            return { success: false, error: error.message };
        }
    },

    query: async (databaseId: string, containerId: string, query: string) => {
        if (!client) return { success: false, error: 'Not connected' };
        try {
            const database = client.database(databaseId);
            const container = database.container(containerId);
            const { resources } = await container.items.query(query).fetchAll();
            return { success: true, data: resources };
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
