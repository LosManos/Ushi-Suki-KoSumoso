import { CosmosResponse } from './cosmos';

export const schemaService = {
    saveSchema: async (containerId: string, keys: string[]): Promise<CosmosResponse<void>> => {
        return await window.ipcRenderer.invoke('storage:saveSchema', containerId, keys);
    },

    getSchemas: async (): Promise<CosmosResponse<Record<string, string[]>>> => {
        return await window.ipcRenderer.invoke('storage:getSchemas');
    }
};
