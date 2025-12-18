
// Template storage service - persists templates per container

export interface ContainerTemplate {
    containerId: string;  // "databaseId/containerId"
    template: string;
    lastUpdated: number;
}

export const templateService = {
    saveTemplate: async (containerId: string, template: string): Promise<{ success: boolean; error?: string }> => {
        return window.ipcRenderer.invoke('storage:saveTemplate', containerId, template);
    },

    getTemplates: async (): Promise<{ success: boolean; data?: Record<string, string>; error?: string }> => {
        return window.ipcRenderer.invoke('storage:getTemplates');
    },

    deleteTemplate: async (containerId: string): Promise<{ success: boolean; error?: string }> => {
        return window.ipcRenderer.invoke('storage:deleteTemplate', containerId);
    }
};
