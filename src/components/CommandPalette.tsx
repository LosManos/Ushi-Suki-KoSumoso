import React, { useState, useEffect, useRef, useMemo } from 'react';
import { Search, Database, X, Loader2 } from 'lucide-react';
import './CommandPalette.css';

interface ContainerItem {
    databaseId: string;
    containerId: string;
}

interface CommandPaletteProps {
    isOpen: boolean;
    onClose: () => void;
    databases: string[];
    containers: Record<string, string[]>;
    onSelectContainer: (databaseId: string, containerId: string) => void;
    loadContainers: (databaseId: string) => Promise<void>;
}

/**
 * Simple fuzzy search that checks if all characters in the query
 * appear in order in the target string (case-insensitive).
 * Returns match indices if found, or null if no match.
 */
function fuzzyMatch(query: string, target: string): number[] | null {
    const lowerQuery = query.toLowerCase();
    const lowerTarget = target.toLowerCase();

    const matchIndices: number[] = [];
    let queryIndex = 0;

    for (let i = 0; i < lowerTarget.length && queryIndex < lowerQuery.length; i++) {
        if (lowerTarget[i] === lowerQuery[queryIndex]) {
            matchIndices.push(i);
            queryIndex++;
        }
    }

    // All query characters were found in order
    return queryIndex === lowerQuery.length ? matchIndices : null;
}

/**
 * Calculate a score for fuzzy match quality.
 * Lower score = better match.
 */
function fuzzyScore(query: string, target: string): number {
    const matches = fuzzyMatch(query, target);
    if (!matches) return Infinity;

    let score = 0;

    // Bonus for starting match
    if (matches[0] === 0) score -= 10;

    // Penalty for gaps between matched characters
    for (let i = 1; i < matches.length; i++) {
        score += matches[i] - matches[i - 1] - 1;
    }

    // Penalty for longer targets (prefer shorter matches)
    score += target.length * 0.1;

    return score;
}

/**
 * Highlight matching characters in the target string
 */
function highlightMatches(target: string, matchIndices: number[]): React.ReactNode {
    if (matchIndices.length === 0) return target;

    const result: React.ReactNode[] = [];
    let lastIndex = 0;

    for (const matchIndex of matchIndices) {
        // Add non-matching text before this match
        if (matchIndex > lastIndex) {
            result.push(target.slice(lastIndex, matchIndex));
        }
        // Add the matching character with highlight
        result.push(
            <span key={matchIndex} className="command-palette-match">
                {target[matchIndex]}
            </span>
        );
        lastIndex = matchIndex + 1;
    }

    // Add remaining non-matching text
    if (lastIndex < target.length) {
        result.push(target.slice(lastIndex));
    }

    return result;
}

export const CommandPalette: React.FC<CommandPaletteProps> = ({
    isOpen,
    onClose,
    databases,
    containers,
    onSelectContainer,
    loadContainers
}) => {
    const [query, setQuery] = useState('');
    const [selectedIndex, setSelectedIndex] = useState(0);
    const [isLoading, setIsLoading] = useState(false);
    const inputRef = useRef<HTMLInputElement>(null);
    const resultsRef = useRef<HTMLDivElement>(null);

    // Build flat list of all containers
    const allContainers = useMemo<ContainerItem[]>(() => {
        const items: ContainerItem[] = [];
        for (const [databaseId, containerList] of Object.entries(containers)) {
            for (const containerId of containerList) {
                items.push({ databaseId, containerId });
            }
        }
        // Sort by database then container name
        return items.sort((a, b) => {
            const dbCompare = a.databaseId.localeCompare(b.databaseId);
            if (dbCompare !== 0) return dbCompare;
            return a.containerId.localeCompare(b.containerId);
        });
    }, [containers]);

    // Filter and sort containers based on fuzzy search
    const filteredContainers = useMemo(() => {
        if (!query.trim()) {
            return allContainers.map(item => ({
                ...item,
                containerMatches: [] as number[],
                databaseMatches: [] as number[]
            }));
        }

        return allContainers
            .map(item => {
                // Try matching against container name first
                const containerMatches = fuzzyMatch(query, item.containerId);
                // Also try matching against combined "database/container"
                const fullPath = `${item.databaseId}/${item.containerId}`;
                const fullMatches = fuzzyMatch(query, fullPath);
                // And database alone
                const databaseMatches = fuzzyMatch(query, item.databaseId);

                const containerScore = containerMatches ? fuzzyScore(query, item.containerId) : Infinity;
                const fullScore = fullMatches ? fuzzyScore(query, fullPath) : Infinity;
                const databaseScore = databaseMatches ? fuzzyScore(query, item.databaseId) : Infinity;

                const bestScore = Math.min(containerScore, fullScore, databaseScore);

                return {
                    ...item,
                    containerMatches: containerMatches || [],
                    databaseMatches: databaseMatches || [],
                    score: bestScore
                };
            })
            .filter(item => item.score < Infinity)
            .sort((a, b) => a.score - b.score);
    }, [allContainers, query]);

    // Reset selection when filtered results change
    useEffect(() => {
        setSelectedIndex(0);
    }, [filteredContainers.length, query]);

    // Load all containers when opening
    useEffect(() => {
        if (isOpen) {
            setQuery('');
            setSelectedIndex(0);

            // Load containers for all databases that haven't been loaded yet
            const unloadedDatabases = databases.filter(db => !containers[db]);
            if (unloadedDatabases.length > 0) {
                setIsLoading(true);
                Promise.all(unloadedDatabases.map(db => loadContainers(db)))
                    .finally(() => setIsLoading(false));
            }

            // Small delay to ensure the modal is rendered
            setTimeout(() => inputRef.current?.focus(), 50);
        }
    }, [isOpen, databases, containers, loadContainers]);

    // Scroll selected item into view
    useEffect(() => {
        if (resultsRef.current) {
            const selectedItem = resultsRef.current.querySelector('.command-palette-item.selected');
            if (selectedItem) {
                selectedItem.scrollIntoView({ block: 'nearest' });
            }
        }
    }, [selectedIndex]);

    // Handle keyboard navigation
    const handleKeyDown = (e: React.KeyboardEvent) => {
        switch (e.key) {
            case 'ArrowDown':
                e.preventDefault();
                setSelectedIndex(prev =>
                    prev < filteredContainers.length - 1 ? prev + 1 : prev
                );
                break;
            case 'ArrowUp':
                e.preventDefault();
                setSelectedIndex(prev => prev > 0 ? prev - 1 : prev);
                break;
            case 'Enter':
                e.preventDefault();
                if (filteredContainers[selectedIndex]) {
                    const item = filteredContainers[selectedIndex];
                    onSelectContainer(item.databaseId, item.containerId);
                    onClose();
                }
                break;
            case 'Escape':
                e.preventDefault();
                onClose();
                break;
        }
    };

    // Close on overlay click
    const handleOverlayClick = (e: React.MouseEvent) => {
        if (e.target === e.currentTarget) {
            onClose();
        }
    };

    // Handle item click
    const handleItemClick = (item: ContainerItem) => {
        onSelectContainer(item.databaseId, item.containerId);
        onClose();
    };

    if (!isOpen) return null;

    return (
        <div className="command-palette-overlay" onClick={handleOverlayClick}>
            <div className="command-palette" role="dialog" aria-modal="true" aria-label="Command Palette">
                <div className="command-palette-header">
                    <div className="command-palette-search">
                        <Search size={18} className="command-palette-search-icon" />
                        <input
                            ref={inputRef}
                            type="text"
                            className="command-palette-input"
                            placeholder="Search containers..."
                            value={query}
                            onChange={e => setQuery(e.target.value)}
                            onKeyDown={handleKeyDown}
                            aria-label="Search containers"
                            autoComplete="off"
                            spellCheck={false}
                        />
                        {query && (
                            <button
                                className="command-palette-clear"
                                onClick={() => setQuery('')}
                                aria-label="Clear search"
                                style={{
                                    background: 'none',
                                    border: 'none',
                                    padding: '4px',
                                    cursor: 'pointer',
                                    color: 'var(--text-secondary)',
                                    display: 'flex'
                                }}
                            >
                                <X size={16} />
                            </button>
                        )}
                    </div>
                </div>

                <div className="command-palette-results" ref={resultsRef}>
                    {isLoading ? (
                        <div className="command-palette-empty">
                            <div className="command-palette-empty-icon command-palette-loading">
                                <Loader2 size={48} />
                            </div>
                            <div>Loading containers...</div>
                        </div>
                    ) : filteredContainers.length === 0 ? (
                        <div className="command-palette-empty">
                            <div className="command-palette-empty-icon">
                                <Database size={48} />
                            </div>
                            <div>
                                {allContainers.length === 0
                                    ? 'No containers available.'
                                    : 'No matching containers found.'
                                }
                            </div>
                        </div>
                    ) : (
                        <div className="command-palette-section">
                            <div className="command-palette-section-title">
                                Containers ({filteredContainers.length})
                            </div>
                            {filteredContainers.map((item, index) => (
                                <div
                                    key={`${item.databaseId}/${item.containerId}`}
                                    className={`command-palette-item ${index === selectedIndex ? 'selected' : ''}`}
                                    onClick={() => handleItemClick(item)}
                                    onMouseEnter={() => setSelectedIndex(index)}
                                    role="option"
                                    aria-selected={index === selectedIndex}
                                >
                                    <div className="command-palette-item-icon">
                                        <Database size={16} />
                                    </div>
                                    <div className="command-palette-item-content">
                                        <div className="command-palette-item-title">
                                            {highlightMatches(item.containerId, item.containerMatches)}
                                        </div>
                                        <div className="command-palette-item-meta">
                                            {highlightMatches(item.databaseId, item.databaseMatches)}
                                        </div>
                                    </div>
                                    {index === selectedIndex && (
                                        <div className="command-palette-item-shortcut">
                                            <kbd className="command-palette-kbd">↵</kbd>
                                        </div>
                                    )}
                                </div>
                            ))}
                        </div>
                    )}
                </div>

                <div className="command-palette-footer">
                    <div className="command-palette-footer-hint">
                        <span>
                            <kbd className="command-palette-kbd">↑</kbd>
                            <kbd className="command-palette-kbd">↓</kbd>
                            navigate
                        </span>
                        <span>
                            <kbd className="command-palette-kbd">↵</kbd>
                            select
                        </span>
                        <span>
                            <kbd className="command-palette-kbd">esc</kbd>
                            close
                        </span>
                    </div>
                </div>
            </div>
        </div>
    );
};
