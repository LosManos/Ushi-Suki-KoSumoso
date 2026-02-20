
export interface QueryTab {
    id: string; // "databaseId/containerId"
    databaseId: string;
    containerId: string;
    query: string;
    results: any[];
    isQuerying: boolean;
    pageSize: number | 'All';
    error?: string;
    hasMoreResults?: boolean;
    template?: string;
    schemaKeys?: string[];
    isDiscovering?: boolean;
}

export interface HistoryItem {
    id: string;
    accountName: string;
    databaseId: string;
    containerId: string;
    query: string;
    timestamp: number;
}

export interface HierarchicalHistory {
    Accounts: {
        Name: string;
        Databases: {
            Name: string;
            Containers: {
                Name: string;
                Items: {
                    Id: string;
                    Query: string;
                    Timestamp: number;
                }[];
            }[];
        }[];
    }[];
}

export interface HierarchicalLinks {
    Accounts: {
        Name: string;
        Databases: {
            Name: string;
            Containers: {
                Name: string;
                Links: {
                    PropertyPath: string;
                    TargetDb: string;
                    TargetContainer: string;
                    TargetPropertyName: string;
                    LastUpdated: string; // ISO 8601
                }[];
            }[];
        }[];
    }[];
}

export interface HierarchicalTranslations {
    Accounts: {
        Name: string;
        Databases: {
            Name: string;
            Containers: {
                Name: string;
                Properties: {
                    Path: string;
                    Mappings: {
                        Value: string;
                        Translation: string;
                        LastUpdated: string; // ISO 8601
                    }[];
                }[];
            }[];
        }[];
    }[];
}

export interface ContainerInfo {
    id: string;
    partitionKeyPaths: string[];
    partitionKeyVersion?: number;
    indexingPolicy: {
        indexingMode: string;
        automatic: boolean;
        includedPaths: string[];
        excludedPaths: string[];
        compositeIndexes?: Array<Array<{ path: string; order: string }>>;
        spatialIndexes?: Array<{ path: string; types: string[] }>;
    };
    defaultTtl?: number;
    uniqueKeyPaths?: string[][];
    documentCount?: number;
    documentsSizeKB?: number;
    indexSizeKB?: number;
    _ts?: number;
    _etag?: string;
}
