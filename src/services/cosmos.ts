export interface CosmosResponse<T> {
    success: boolean;
    data?: T;
    error?: string;
}

export const cosmos = {
    connect: async (connectionString: string): Promise<CosmosResponse<{ databases: string[], accountName: string }>> => {
        return await window.ipcRenderer.invoke('cosmos:connect', connectionString);
    },

    query: async (databaseId: string, containerId: string, query: string, pageSize: number | 'All' = 10, queryId?: string): Promise<CosmosResponse<{ items: any[], hasMoreResults: boolean }>> => {
        return await window.ipcRenderer.invoke('cosmos:query', databaseId, containerId, query, pageSize, queryId);
    },

    cancelQuery: async (queryId: string): Promise<CosmosResponse<void>> => {
        return await window.ipcRenderer.invoke('cosmos:cancelQuery', queryId);
    },

    getDocument: async (databaseId: string, containerId: string, docId: string): Promise<CosmosResponse<any>> => {
        return await window.ipcRenderer.invoke('cosmos:getDocument', databaseId, containerId, docId);
    },

    getContainers: async (databaseId: string): Promise<CosmosResponse<string[]>> => {
        return await window.ipcRenderer.invoke('cosmos:getContainers', databaseId);
    },

    getContainerInfo: async (databaseId: string, containerId: string): Promise<CosmosResponse<import('../types').ContainerInfo>> => {
        return await window.ipcRenderer.invoke('cosmos:getContainerInfo', databaseId, containerId);
    },

    getContainerKeys: async (databaseId: string, containerId: string, sampleSize: number = 100): Promise<CosmosResponse<string[]>> => {
        return await window.ipcRenderer.invoke('cosmos:getContainerKeys', databaseId, containerId, sampleSize);
    },

    // Storage
    saveConnection: async (name: string, connectionString: string): Promise<CosmosResponse<void>> => {
        return await window.ipcRenderer.invoke('storage:saveConnection', name, connectionString);
    },

    getConnections: async (): Promise<CosmosResponse<Array<{ name: string, connectionString: string, lastUsed: number }>>> => {
        return await window.ipcRenderer.invoke('storage:getConnections');
    },

    deleteConnection: async (name: string): Promise<CosmosResponse<void>> => {
        return await window.ipcRenderer.invoke('storage:deleteConnection', name);
    },

    upsertDocument: async (databaseId: string, containerId: string, document: any): Promise<CosmosResponse<any>> => {
        return await window.ipcRenderer.invoke('cosmos:upsertDocument', databaseId, containerId, document);
    }
};
