
// Link storage service - persists "Follow Link" mappings
// Maps source (db/container/path) to target (db/container/property)

export interface LinkMapping {
    targetDb: string;
    targetContainer: string;
    targetPropertyName: string;
}

export const linkService = {
    saveLink: async (sourceKey: string, mapping: LinkMapping): Promise<{ success: boolean; error?: string }> => {
        return window.ipcRenderer.invoke('storage:saveLink', sourceKey, mapping);
    },

    getLinks: async (): Promise<{ success: boolean; data?: Record<string, LinkMapping>; error?: string }> => {
        return window.ipcRenderer.invoke('storage:getLinks');
    }
};
