
import { HistoryItem } from '../types';

export const historyService = {
    addHistoryItem: async (item: HistoryItem) => {
        return window.ipcRenderer.invoke('storage:saveHistory', item);
    },
    getHistory: async (): Promise<{ success: boolean; data: HistoryItem[]; error?: string }> => {
        return window.ipcRenderer.invoke('storage:getHistory');
    },
    deleteHistoryItem: async (item: HistoryItem): Promise<{ success: boolean; error?: string }> => {
        return window.ipcRenderer.invoke('storage:deleteHistory', item);
    }
};
