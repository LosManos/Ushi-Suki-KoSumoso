
export interface QueryTab {
    id: string; // "databaseId/containerId"
    databaseId: string;
    containerId: string;
    query: string;
    results: any[];
    isQuerying: boolean;
    pageSize: number | 'All';
    error?: string;
}

export interface HistoryItem {
    accountName: string;
    databaseId: string;
    containerId: string;
    query: string;
    timestamp: number;
}
