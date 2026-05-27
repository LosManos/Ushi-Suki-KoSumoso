
// Translation storage service - persists value translations per container property

export interface TranslationMapping {
    [value: string]: string;
}

export interface ContainerTranslations {
    [propertyPath: string]: TranslationMapping;
}

export const translationService = {
    saveTranslation: async (account: string, containerPath: string, propertyPath: string, value: any, translation: string): Promise<{ success: boolean; error?: string }> => {
        return window.ipcRenderer.invoke('storage:saveTranslation', account, containerPath, propertyPath, value, translation);
    },

    savePropertyTranslations: async (account: string, containerPath: string, propertyPath: string, mappings: TranslationMapping): Promise<{ success: boolean; error?: string }> => {
        return window.ipcRenderer.invoke('storage:savePropertyTranslations', account, containerPath, propertyPath, mappings);
    },

    getTranslations: async (): Promise<{ success: boolean; data?: Record<string, ContainerTranslations>; error?: string }> => {
        return window.ipcRenderer.invoke('storage:getTranslations');
    },

    showTranslationsFile: async (): Promise<{ success: boolean; error?: string }> => {
        return window.ipcRenderer.invoke('storage:showTranslationsFile');
    }
};
