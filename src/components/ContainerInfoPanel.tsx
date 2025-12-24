import React, { useEffect, useState } from 'react';
import { X, Database, Key, Clock, Hash, Search, RefreshCw, Play } from 'lucide-react';
import { ContainerInfo } from '../types';
import { cosmos } from '../services/cosmos';
import './ContainerInfoPanel.css';

interface ContainerInfoPanelProps {
    databaseId: string;
    containerId: string;
    isOpen: boolean;
    onClose: () => void;
    anchorRect?: DOMRect | null;
}

export const ContainerInfoPanel: React.FC<ContainerInfoPanelProps> = ({
    databaseId,
    containerId,
    isOpen,
    onClose,
    anchorRect
}) => {
    const [info, setInfo] = useState<ContainerInfo | null>(null);
    const [isLoading, setIsLoading] = useState(false);
    const [error, setError] = useState<string | null>(null);
    const [discoveredKeys, setDiscoveredKeys] = useState<string[]>([]);
    const [isDiscovering, setIsDiscovering] = useState(false);
    const [schemaSearch, setSchemaSearch] = useState('');
    const [copyFeedback, setCopyFeedback] = useState<{ text: string, x: number, y: number } | null>(null);

    useEffect(() => {
        if (isOpen && databaseId && containerId) {
            setIsLoading(true);
            setError(null);
            setInfo(null); // Reset previous info

            console.log('[ContainerInfoPanel] Fetching info for:', databaseId, containerId);

            cosmos.getContainerInfo(databaseId, containerId)
                .then(result => {
                    console.log('[ContainerInfoPanel] Result:', result);
                    setIsLoading(false);
                    if (result.success && result.data) {
                        setInfo(result.data);
                    } else {
                        setError(result.error || 'Failed to load container info');
                    }
                })
                .catch(err => {
                    console.error('[ContainerInfoPanel] Error:', err);
                    setIsLoading(false);
                    setError(err.message || 'Failed to load container info');
                });

            // Reset keys when container changes
            setDiscoveredKeys([]);
            setSchemaSearch('');
        } else if (isOpen) {
            // If open but no databaseId/containerId, show error
            setError('No container selected');
            setIsLoading(false);
        }
    }, [isOpen, databaseId, containerId]);


    useEffect(() => {
        const handleKeyDown = (e: KeyboardEvent) => {
            if (e.key === 'Escape' && isOpen) {
                onClose();
            }
            // Alt+D to Discover
            if (e.altKey && e.code === 'KeyD' && isOpen) {
                e.preventDefault();
                handleDiscoverSchema();
            }
        };
        window.addEventListener('keydown', handleKeyDown);
        return () => window.removeEventListener('keydown', handleKeyDown);
    }, [isOpen, onClose, discoveredKeys, isDiscovering, databaseId, containerId]); // Include deps for handleDiscoverSchema call

    const handleDiscoverSchema = async () => {
        if (!databaseId || !containerId || isDiscovering) return;

        setIsDiscovering(true);
        try {
            const result = await cosmos.getContainerKeys(databaseId, containerId, 10);
            if (result.success && result.data) {
                setDiscoveredKeys(result.data);
            } else {
                console.error('Failed to discover schema:', result.error);
            }
        } catch (err) {
            console.error('Error discovering schema:', err);
        } finally {
            setIsDiscovering(false);
        }
    };

    const handleCopy = (e: React.MouseEvent, text: string) => {
        navigator.clipboard.writeText(text);
        setCopyFeedback({ text: 'Copied!', x: e.clientX, y: e.clientY });
        setTimeout(() => setCopyFeedback(null), 800);
    };

    const filteredKeys = discoveredKeys.filter(k =>
        k.toLowerCase().includes(schemaSearch.toLowerCase())
    );

    if (!isOpen) return null;



    // Format TTL
    const formatTtl = (ttl?: number): string => {
        if (ttl === undefined || ttl === null) return 'Off';
        if (ttl === -1) return 'On (no default)';
        if (ttl < 60) return `${ttl} seconds`;
        if (ttl < 3600) return `${Math.floor(ttl / 60)} minutes`;
        if (ttl < 86400) return `${Math.floor(ttl / 3600)} hours`;
        return `${Math.floor(ttl / 86400)} days`;
    };

    // Calculate position based on anchor
    const panelStyle: React.CSSProperties = {};
    if (anchorRect) {
        panelStyle.top = anchorRect.top;
        panelStyle.left = anchorRect.right + 8;
    }

    return (
        <div className="container-info-overlay" onClick={onClose}>
            <div
                className="container-info-panel"
                style={panelStyle}
                onClick={e => e.stopPropagation()}
            >
                <div className="info-panel-header">
                    <div className="info-panel-title">
                        <Database size={16} />
                        <span className="info-db-name">{databaseId}</span>
                        <span className="info-separator">/</span>
                        <span className="info-container-name">{containerId}</span>
                    </div>
                    <button className="info-close-btn" onClick={onClose} title="Close (Esc)">
                        <X size={16} />
                    </button>
                </div>

                <div className="info-panel-content">
                    {isLoading && (
                        <div className="info-loading">
                            <div className="info-spinner"></div>
                            <span>Loading container info...</span>
                        </div>
                    )}

                    {error && (
                        <div className="info-error">
                            <span>⚠️ {error}</span>
                        </div>
                    )}

                    {info && !isLoading && (
                        <>

                            {/* Partition Key */}
                            <div className="info-section">
                                <h4><Key size={14} /> Partition Key</h4>
                                <div className="info-code">
                                    {info.partitionKeyPaths.length > 0
                                        ? info.partitionKeyPaths.join(', ')
                                        : '(none)'}
                                    {info.partitionKeyVersion === 2 && (
                                        <span className="info-badge">Hierarchical</span>
                                    )}
                                </div>
                            </div>

                            {/* Indexing Policy */}
                            <div className="info-section">
                                <h4><Hash size={14} /> Indexing Policy</h4>
                                <div className="info-row">
                                    <span className="info-label">Mode:</span>
                                    <span className={`info-badge ${info.indexingPolicy.indexingMode === 'consistent' ? 'badge-success' : 'badge-warning'}`}>
                                        {info.indexingPolicy.indexingMode}
                                    </span>
                                    {info.indexingPolicy.automatic && (
                                        <span className="info-badge badge-info">automatic</span>
                                    )}
                                </div>

                                {info.indexingPolicy.includedPaths.length > 0 && (
                                    <div className="info-subsection">
                                        <span className="info-sublabel">Included Paths:</span>
                                        <div className="info-path-list">
                                            {info.indexingPolicy.includedPaths.map((path, i) => (
                                                <code key={i} className="info-path">{path}</code>
                                            ))}
                                        </div>
                                    </div>
                                )}

                                {info.indexingPolicy.excludedPaths.length > 0 && (
                                    <div className="info-subsection">
                                        <span className="info-sublabel">Excluded Paths:</span>
                                        <div className="info-path-list">
                                            {info.indexingPolicy.excludedPaths.map((path, i) => (
                                                <code key={i} className="info-path info-path-excluded">{path}</code>
                                            ))}
                                        </div>
                                    </div>
                                )}

                                {info.indexingPolicy.compositeIndexes && info.indexingPolicy.compositeIndexes.length > 0 && (
                                    <div className="info-subsection">
                                        <span className="info-sublabel">Composite Indexes:</span>
                                        <div className="info-composite-list">
                                            {info.indexingPolicy.compositeIndexes.map((composite, i) => (
                                                <div key={i} className="info-composite">
                                                    {composite.map((idx, j) => (
                                                        <code key={j} className="info-path">
                                                            {idx.path} <span className="info-order">({idx.order})</span>
                                                        </code>
                                                    ))}
                                                </div>
                                            ))}
                                        </div>
                                    </div>
                                )}
                            </div>

                            {/* TTL */}
                            <div className="info-section">
                                <h4><Clock size={14} /> Time-to-Live (TTL)</h4>
                                <div className="info-row">
                                    <span className={`info-badge ${info.defaultTtl !== undefined ? 'badge-success' : 'badge-neutral'}`}>
                                        {formatTtl(info.defaultTtl)}
                                    </span>
                                </div>
                            </div>

                            {/* Unique Keys */}
                            {info.uniqueKeyPaths && info.uniqueKeyPaths.length > 0 && (
                                <div className="info-section">
                                    <h4><Key size={14} /> Unique Key Constraints</h4>
                                    <div className="info-path-list">
                                        {info.uniqueKeyPaths.map((paths, i) => (
                                            <div key={i} className="info-unique-key">
                                                {paths.map((p, j) => (
                                                    <code key={j} className="info-path">{p}</code>
                                                ))}
                                            </div>
                                        ))}
                                    </div>
                                </div>
                            )}

                            {/* Metadata */}
                            <div className="info-section info-metadata">
                                <div className="info-meta-row">
                                    <span className="info-meta-label">Last Modified:</span>
                                    <span className="info-meta-value">
                                        {info._ts ? new Date(info._ts * 1000).toISOString() : 'N/A'}
                                    </span>
                                </div>
                            </div>

                            {/* Schema Discovery */}
                            <div className="schema-discovery-section">
                                <div className="schema-header">
                                    <h4><Search size={14} /> Schema Discovery</h4>
                                    <button
                                        className="schema-discover-btn"
                                        onClick={handleDiscoverSchema}
                                        disabled={isDiscovering}
                                        title="Sample documents to find property names (Alt+D)"
                                    >
                                        {isDiscovering ? (
                                            <RefreshCw size={14} className="info-spinner" />
                                        ) : (
                                            <Play size={14} />
                                        )}
                                        {discoveredKeys.length > 0 ? 'Refresh' : 'Discover'}
                                    </button>
                                </div>

                                {discoveredKeys.length > 0 && (
                                    <>
                                        <input
                                            type="text"
                                            className="schema-search"
                                            placeholder="Search property names..."
                                            value={schemaSearch}
                                            onChange={e => setSchemaSearch(e.target.value)}
                                        />
                                        <div className="schema-results">
                                            {filteredKeys.length > 0 ? (
                                                filteredKeys.map(key => (
                                                    <div key={key} className="schema-path-item" title="Click to copy path" onClick={(e) => handleCopy(e, key)}>
                                                        {key}
                                                    </div>
                                                ))
                                            ) : (
                                                <div className="schema-empty">No properties match your search.</div>
                                            )}
                                        </div>
                                        <div className="schema-count" style={{ marginTop: '8px' }}>
                                            Showing {filteredKeys.length} of {discoveredKeys.length} unique properties (sampled 10 docs)
                                        </div>
                                    </>
                                )}

                                {discoveredKeys.length === 0 && !isDiscovering && (
                                    <div className="schema-empty">
                                        Click "Discover" to scan a sample of documents and find all unique property names.
                                    </div>
                                )}
                            </div>
                        </>
                    )}
                </div>
            </div>
            {copyFeedback && (
                <div
                    className="copy-feedback"
                    style={{ left: copyFeedback.x, top: copyFeedback.y - 20 }}
                >
                    {copyFeedback.text}
                </div>
            )}
        </div>
    );
};
