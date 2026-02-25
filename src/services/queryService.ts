
// Query storage service - persists last query per container

export const queryService = {
    saveQuery: async (storageKey: string, query: string): Promise<{ success: boolean; error?: string }> => {
        return window.ipcRenderer.invoke('storage:saveQuery', storageKey, query);
    },

    getQueries: async (): Promise<{ success: boolean; data?: Record<string, string>; error?: string }> => {
        return window.ipcRenderer.invoke('storage:getQueries');
    },

    deleteQuery: async (storageKey: string): Promise<{ success: boolean; error?: string }> => {
        return window.ipcRenderer.invoke('storage:deleteQuery', storageKey);
    }
};
