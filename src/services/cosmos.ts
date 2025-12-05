export interface CosmosResponse<T> {
    success: boolean;
    data?: T;
    error?: string;
}

export const cosmos = {
    connect: async (connectionString: string): Promise<CosmosResponse<string[]>> => {
        return await window.ipcRenderer.invoke('cosmos:connect', connectionString);
    },

    query: async (databaseId: string, containerId: string, query: string): Promise<CosmosResponse<any[]>> => {
        return await window.ipcRenderer.invoke('cosmos:query', databaseId, containerId, query);
    },

    getDocument: async (databaseId: string, containerId: string, docId: string): Promise<CosmosResponse<any>> => {
        return await window.ipcRenderer.invoke('cosmos:getDocument', databaseId, containerId, docId);
    }
};
