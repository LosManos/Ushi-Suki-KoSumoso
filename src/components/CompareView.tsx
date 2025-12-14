import React, { useRef, useEffect, useState, useMemo } from 'react';
import { X, Clock, ArrowUp, ArrowDown, ChevronDown } from 'lucide-react';
import * as Diff from 'diff';
import './CompareView.css';

interface CompareViewProps {
    documents: any[];
}

interface AgeInfo {
    timestamp: number | null;
    rank: number; // 1 = oldest, higher = newer
    label: 'oldest' | 'newest' | 'middle' | null;
    formattedDate: string | null;
    relativeAge: string | null;
}

interface DiffLine {
    text: string;
    isDifferent: boolean;
    lineNumber: number;
}

interface CharDiffPart {
    value: string;
    added?: boolean;
    removed?: boolean;
}

interface SemanticDiff {
    path: string;
    type: 'added' | 'removed' | 'changed' | 'unchanged';
    oldValue?: any;
    newValue?: any;
    docIndex: number;
}

type DiffMode = 'line' | 'character' | 'semantic';

const DIFF_MODES: { value: DiffMode; label: string; description: string }[] = [
    { value: 'line', label: 'Line-by-Line', description: 'Compare lines at same positions' },
    { value: 'character', label: 'Character Diff', description: 'Show exact character changes' },
    { value: 'semantic', label: 'Semantic (JSON)', description: 'Compare by JSON keys, ignoring order' },
];

/**
 * Compare lines across all documents and mark which ones differ
 */
function computeDiffLines(formattedDocs: string[]): DiffLine[][] {
    // Split each document into lines
    const allLines = formattedDocs.map(doc => doc.split('\n'));

    // Find the max number of lines across all documents
    const maxLines = Math.max(...allLines.map(lines => lines.length));

    // For each line position, check if all documents have the same content
    const result: DiffLine[][] = allLines.map(() => []);

    for (let lineIdx = 0; lineIdx < maxLines; lineIdx++) {
        // Get the line at this position from each document (or empty if doc is shorter)
        const linesAtPosition = allLines.map(lines => lines[lineIdx] || '');

        // Check if all lines at this position are identical
        const firstLine = linesAtPosition[0];
        const allSame = linesAtPosition.every(line => line === firstLine);

        // Add to result for each document
        allLines.forEach((lines, docIdx) => {
            result[docIdx].push({
                text: lines[lineIdx] || '',
                isDifferent: !allSame,
                lineNumber: lineIdx + 1
            });
        });
    }

    return result;
}

/**
 * Compute character-level diff between first document and each other document
 */
function computeCharacterDiff(formattedDocs: string[]): CharDiffPart[][][] {
    if (formattedDocs.length < 2) {
        return formattedDocs.map(doc => [[{ value: doc }]]);
    }

    const baseDoc = formattedDocs[0];
    const baseLines = baseDoc.split('\n');

    return formattedDocs.map((doc, docIndex) => {
        if (docIndex === 0) {
            // For the base document, just return plain lines
            return baseLines.map(line => [{ value: line }]);
        }

        const docLines = doc.split('\n');
        const maxLines = Math.max(baseLines.length, docLines.length);
        const result: CharDiffPart[][] = [];

        for (let i = 0; i < maxLines; i++) {
            const baseLine = baseLines[i] || '';
            const docLine = docLines[i] || '';

            if (baseLine === docLine) {
                result.push([{ value: docLine }]);
            } else {
                // Compute character diff for this line
                const diff = Diff.diffChars(baseLine, docLine);
                result.push(diff.map(part => ({
                    value: part.value,
                    added: part.added,
                    removed: part.removed
                })));
            }
        }

        return result;
    });
}

/**
 * Normalize a value for order-ignorant comparison
 * Arrays are sorted by their JSON representation to allow order-independent comparison
 */
function normalizeForComparison(value: any): any {
    if (value === null || value === undefined) {
        return value;
    }

    if (Array.isArray(value)) {
        // Sort array elements by their JSON string representation
        // This allows comparing arrays regardless of order
        const normalized = value.map(item => normalizeForComparison(item));
        return normalized.sort((a, b) =>
            JSON.stringify(a).localeCompare(JSON.stringify(b))
        );
    }

    if (typeof value === 'object') {
        // Recursively normalize object properties
        const normalized: Record<string, any> = {};
        for (const key of Object.keys(value).sort()) {
            normalized[key] = normalizeForComparison(value[key]);
        }
        return normalized;
    }

    return value;
}

/**
 * Extract all paths from a JSON object with their values
 * @param obj The object to extract paths from
 * @param prefix Current path prefix
 * @param ignoreArrayOrder If true, arrays are represented as sorted sets for comparison
 */
function extractPaths(obj: any, prefix: string = '', ignoreArrayOrder: boolean = false): Map<string, any> {
    const paths = new Map<string, any>();

    if (obj === null || obj === undefined) {
        paths.set(prefix || '(root)', obj);
        return paths;
    }

    if (typeof obj !== 'object') {
        paths.set(prefix || '(root)', obj);
        return paths;
    }

    if (Array.isArray(obj)) {
        if (ignoreArrayOrder) {
            // For order-ignorant comparison, store a normalized/sorted representation
            const normalizedArray = normalizeForComparison(obj);
            paths.set(prefix || '(root)', `[Array(${obj.length}): ${JSON.stringify(normalizedArray)}]`);
            // Still extract child paths but with normalized indices based on sorted order
            const sortedWithIndices = obj
                .map((item, originalIndex) => ({ item, originalIndex }))
                .sort((a, b) => JSON.stringify(a.item).localeCompare(JSON.stringify(b.item)));
            sortedWithIndices.forEach(({ item }, sortedIndex) => {
                const childPaths = extractPaths(item, `${prefix}[${sortedIndex}]`, ignoreArrayOrder);
                childPaths.forEach((value, key) => paths.set(key, value));
            });
        } else {
            paths.set(prefix || '(root)', `[Array(${obj.length})]`);
            obj.forEach((item, index) => {
                const childPaths = extractPaths(item, `${prefix}[${index}]`, ignoreArrayOrder);
                childPaths.forEach((value, key) => paths.set(key, value));
            });
        }
    } else {
        const keys = Object.keys(obj).sort();
        keys.forEach(key => {
            const newPrefix = prefix ? `${prefix}.${key}` : key;
            const value = obj[key];

            if (typeof value === 'object' && value !== null) {
                const childPaths = extractPaths(value, newPrefix, ignoreArrayOrder);
                childPaths.forEach((v, k) => paths.set(k, v));
            } else {
                paths.set(newPrefix, value);
            }
        });
    }

    return paths;
}

/**
 * Compute semantic diff between documents by comparing JSON paths
 * @param documents Documents to compare
 * @param ignoreArrayOrder If true, arrays are compared regardless of element order
 */
function computeSemanticDiff(documents: any[], ignoreArrayOrder: boolean = false): SemanticDiff[][] {
    if (documents.length < 2) {
        return documents.map(() => []);
    }

    const allPaths = documents.map(doc => extractPaths(doc, '', ignoreArrayOrder));
    const basePaths = allPaths[0];

    return documents.map((_, docIndex) => {
        if (docIndex === 0) {
            // For base document, show all paths as context
            const diffs: SemanticDiff[] = [];
            basePaths.forEach((value, path) => {
                diffs.push({
                    path,
                    type: 'unchanged',
                    oldValue: value,
                    docIndex: 0
                });
            });
            return diffs;
        }

        const docPaths = allPaths[docIndex];
        const diffs: SemanticDiff[] = [];
        const processedPaths = new Set<string>();

        // Find changed and removed paths
        basePaths.forEach((baseValue, path) => {
            processedPaths.add(path);
            const docValue = docPaths.get(path);

            if (!docPaths.has(path)) {
                diffs.push({
                    path,
                    type: 'removed',
                    oldValue: baseValue,
                    docIndex
                });
            } else if (JSON.stringify(baseValue) !== JSON.stringify(docValue)) {
                diffs.push({
                    path,
                    type: 'changed',
                    oldValue: baseValue,
                    newValue: docValue,
                    docIndex
                });
            } else {
                diffs.push({
                    path,
                    type: 'unchanged',
                    oldValue: baseValue,
                    docIndex
                });
            }
        });

        // Find added paths
        docPaths.forEach((value, path) => {
            if (!processedPaths.has(path)) {
                diffs.push({
                    path,
                    type: 'added',
                    newValue: value,
                    docIndex
                });
            }
        });

        // Sort by path
        diffs.sort((a, b) => a.path.localeCompare(b.path));

        return diffs;
    });
}

/**
 * Count the number of different lines
 */
function countDifferences(diffLines: DiffLine[][]): number {
    if (diffLines.length === 0) return 0;
    return diffLines[0].filter(line => line.isDifferent).length;
}

/**
 * Count semantic differences
 */
function countSemanticDifferences(semanticDiffs: SemanticDiff[][]): number {
    if (semanticDiffs.length < 2) return 0;
    return semanticDiffs.slice(1).reduce((total, diffs) => {
        return total + diffs.filter(d => d.type !== 'unchanged').length;
    }, 0);
}

export const CompareView: React.FC<CompareViewProps> = ({ documents }) => {
    const containerRefs = useRef<(HTMLDivElement | null)[]>([]);
    const [isSyncEnabled, setIsSyncEnabled] = useState(true);
    const [showDiffOnly, setShowDiffOnly] = useState(false);
    const [diffMode, setDiffMode] = useState<DiffMode>('line');
    const [ignoreArrayOrder, setIgnoreArrayOrder] = useState(false);
    const [isModeDropdownOpen, setIsModeDropdownOpen] = useState(false);
    const isScrollingRef = useRef(false);
    const scrollTimeoutRef = useRef<NodeJS.Timeout | null>(null);
    const dropdownRef = useRef<HTMLDivElement>(null);

    // Format documents as pretty JSON
    const formattedDocs = useMemo(() =>
        documents.map(doc => JSON.stringify(doc, null, 2)),
        [documents]
    );

    // Compute line-by-line diff
    const diffLines = useMemo(() =>
        computeDiffLines(formattedDocs),
        [formattedDocs]
    );

    // Compute character diff
    const charDiffs = useMemo(() =>
        computeCharacterDiff(formattedDocs),
        [formattedDocs]
    );

    // Compute semantic diff
    const semanticDiffs = useMemo(() =>
        computeSemanticDiff(documents, ignoreArrayOrder),
        [documents, ignoreArrayOrder]
    );

    // Count differences based on mode
    const diffCount = useMemo(() => {
        if (diffMode === 'semantic') {
            return countSemanticDifferences(semanticDiffs);
        }
        return countDifferences(diffLines);
    }, [diffMode, diffLines, semanticDiffs]);

    // Close dropdown when clicking outside
    useEffect(() => {
        const handleClickOutside = (e: MouseEvent) => {
            if (dropdownRef.current && !dropdownRef.current.contains(e.target as Node)) {
                setIsModeDropdownOpen(false);
            }
        };
        document.addEventListener('mousedown', handleClickOutside);
        return () => document.removeEventListener('mousedown', handleClickOutside);
    }, []);

    // Synchronized scrolling handler
    const handleScroll = (sourceIndex: number) => {
        if (!isSyncEnabled || isScrollingRef.current) return;

        const sourceElement = containerRefs.current[sourceIndex];
        if (!sourceElement) return;

        // Calculate scroll percentage
        const scrollPercentage = sourceElement.scrollTop /
            (sourceElement.scrollHeight - sourceElement.clientHeight);

        isScrollingRef.current = true;

        // Apply same scroll percentage to all other panes
        containerRefs.current.forEach((ref, index) => {
            if (ref && index !== sourceIndex) {
                const targetScrollTop = scrollPercentage *
                    (ref.scrollHeight - ref.clientHeight);
                ref.scrollTop = targetScrollTop;
            }
        });

        // Reset scrolling flag after a short delay
        if (scrollTimeoutRef.current) {
            clearTimeout(scrollTimeoutRef.current);
        }
        scrollTimeoutRef.current = setTimeout(() => {
            isScrollingRef.current = false;
        }, 50);
    };

    // Cleanup timeout on unmount
    useEffect(() => {
        return () => {
            if (scrollTimeoutRef.current) {
                clearTimeout(scrollTimeoutRef.current);
            }
        };
    }, []);

    // Handle keyboard shortcuts
    useEffect(() => {
        const handleKeyDown = (e: KeyboardEvent) => {
            // Close window on Escape
            if (e.key === 'Escape') {
                window.close();
                return;
            }

            // On Mac, Alt (Option) produces special characters in e.key (e.g. µ for m),
            // so we use e.code to reliably detect the physical key pressed.
            if (e.altKey && !e.ctrlKey && !e.metaKey) {
                switch (e.code) {
                    case 'KeyM': {
                        // Alt+M: Cycle through diff modes
                        e.preventDefault();
                        setDiffMode(current => {
                            const currentIndex = DIFF_MODES.findIndex(m => m.value === current);
                            const nextIndex = (currentIndex + 1) % DIFF_MODES.length;
                            return DIFF_MODES[nextIndex].value;
                        });
                        break;
                    }
                    case 'KeyS': {
                        // Alt+S: Toggle sync scroll
                        e.preventDefault();
                        setIsSyncEnabled(current => !current);
                        break;
                    }
                    case 'KeyD': {
                        // Alt+D: Toggle show differences only
                        e.preventDefault();
                        setShowDiffOnly(current => !current);
                        break;
                    }
                    case 'KeyO': {
                        // Alt+O: Toggle order-ignorant array comparison (only in semantic mode)
                        if (diffMode === 'semantic') {
                            e.preventDefault();
                            setIgnoreArrayOrder(current => !current);
                        }
                        break;
                    }
                }
            }
        };
        window.addEventListener('keydown', handleKeyDown);
        return () => window.removeEventListener('keydown', handleKeyDown);
    }, [diffMode]);

    // Close window handler
    const handleClose = () => {
        window.close();
    };

    // Get document ID for header display
    const getDocumentId = (doc: any): string => {
        if (doc.id) return doc.id;
        if (doc._id) return doc._id;
        return `Document`;
    };

    // Format timestamp to readable date
    const formatTimestamp = (ts: number): string => {
        const date = new Date(ts * 1000);
        return date.toLocaleString(undefined, {
            year: 'numeric',
            month: 'short',
            day: 'numeric',
            hour: '2-digit',
            minute: '2-digit',
            second: '2-digit'
        });
    };

    // Calculate relative age string
    const getRelativeAge = (ts: number): string => {
        const now = Date.now();
        const diffMs = now - (ts * 1000);
        const diffSeconds = Math.floor(diffMs / 1000);
        const diffMinutes = Math.floor(diffSeconds / 60);
        const diffHours = Math.floor(diffMinutes / 60);
        const diffDays = Math.floor(diffHours / 24);

        if (diffDays > 0) return `${diffDays}d ago`;
        if (diffHours > 0) return `${diffHours}h ago`;
        if (diffMinutes > 0) return `${diffMinutes}m ago`;
        return `${diffSeconds}s ago`;
    };

    // Compute age info for all documents
    const ageInfos = useMemo((): AgeInfo[] => {
        const timestamps = documents.map(doc => {
            const ts = doc._ts;
            return typeof ts === 'number' ? ts : null;
        });

        // Get valid timestamps for ranking
        const validTimestamps = timestamps.filter((ts): ts is number => ts !== null);
        if (validTimestamps.length === 0) {
            return documents.map(() => ({
                timestamp: null,
                rank: 0,
                label: null,
                formattedDate: null,
                relativeAge: null
            }));
        }

        const minTs = Math.min(...validTimestamps);
        const maxTs = Math.max(...validTimestamps);

        return timestamps.map((ts): AgeInfo => {
            if (ts === null) {
                return {
                    timestamp: null,
                    rank: 0,
                    label: null,
                    formattedDate: null,
                    relativeAge: null
                };
            }

            // Calculate rank (1 = oldest)
            const sortedUnique = [...new Set(validTimestamps)].sort((a, b) => a - b);
            const rank = sortedUnique.indexOf(ts) + 1;

            // Determine label
            let label: 'oldest' | 'newest' | 'middle' | null = null;
            if (validTimestamps.length > 1) {
                if (ts === minTs) label = 'oldest';
                else if (ts === maxTs) label = 'newest';
                else label = 'middle';
            }

            return {
                timestamp: ts,
                rank,
                label,
                formattedDate: formatTimestamp(ts),
                relativeAge: getRelativeAge(ts)
            };
        });
    }, [documents]);

    // Render line-by-line diff (original mode)
    const renderLineDiff = (docIndex: number) => {
        const lines = diffLines[docIndex] || [];
        const linesToShow = showDiffOnly
            ? lines.filter(line => line.isDifferent)
            : lines;

        return (
            <pre className="diff-content">
                {linesToShow.map((line, idx) => (
                    <div
                        key={showDiffOnly ? `diff-${line.lineNumber}` : idx}
                        className={`diff-line ${line.isDifferent ? 'diff-highlight' : ''}`}
                    >
                        <span className="line-number">{line.lineNumber}</span>
                        <code>{line.text}</code>
                    </div>
                ))}
            </pre>
        );
    };

    // Render character-level diff
    const renderCharacterDiff = (docIndex: number) => {
        const lines = charDiffs[docIndex] || [];
        const lineNumbers = diffLines[docIndex] || [];

        // Filter to only different lines if showDiffOnly is enabled
        const indicesToShow = showDiffOnly
            ? lineNumbers.map((l, i) => l.isDifferent ? i : -1).filter(i => i >= 0)
            : lines.map((_, i) => i);

        return (
            <pre className="diff-content">
                {indicesToShow.map((lineIdx) => {
                    const parts = lines[lineIdx] || [];
                    const lineInfo = lineNumbers[lineIdx];
                    const hasDiff = parts.some(p => p.added || p.removed);

                    return (
                        <div
                            key={lineIdx}
                            className={`diff-line ${hasDiff ? 'diff-highlight' : ''}`}
                        >
                            <span className="line-number">{lineInfo?.lineNumber || lineIdx + 1}</span>
                            <code>
                                {parts.map((part, partIdx) => {
                                    if (part.removed) {
                                        return (
                                            <span key={partIdx} className="char-removed">
                                                {part.value}
                                            </span>
                                        );
                                    }
                                    if (part.added) {
                                        return (
                                            <span key={partIdx} className="char-added">
                                                {part.value}
                                            </span>
                                        );
                                    }
                                    return <span key={partIdx}>{part.value}</span>;
                                })}
                            </code>
                        </div>
                    );
                })}
            </pre>
        );
    };

    // Render semantic diff (by JSON paths)
    const renderSemanticDiff = (docIndex: number) => {
        const diffs = semanticDiffs[docIndex] || [];
        const diffsToShow = showDiffOnly
            ? diffs.filter(d => d.type !== 'unchanged')
            : diffs;

        const formatValue = (val: any): string => {
            if (val === null) return 'null';
            if (val === undefined) return 'undefined';
            if (typeof val === 'string') return `"${val}"`;
            return String(val);
        };

        return (
            <div className="semantic-content">
                {diffsToShow.length === 0 && showDiffOnly ? (
                    <div className="no-diff-message">
                        {docIndex === 0 ? 'Base document' : 'No differences from base'}
                    </div>
                ) : (
                    diffsToShow.map((diff, idx) => (
                        <div
                            key={idx}
                            className={`semantic-line semantic-${diff.type}`}
                        >
                            <span className="semantic-path">{diff.path}</span>
                            <span className="semantic-value">
                                {diff.type === 'changed' ? (
                                    <>
                                        <span className="char-removed">{formatValue(diff.oldValue)}</span>
                                        <span className="semantic-arrow">→</span>
                                        <span className="char-added">{formatValue(diff.newValue)}</span>
                                    </>
                                ) : diff.type === 'added' ? (
                                    <span className="char-added">{formatValue(diff.newValue)}</span>
                                ) : diff.type === 'removed' ? (
                                    <span className="char-removed">{formatValue(diff.oldValue)}</span>
                                ) : (
                                    <span>{formatValue(diff.oldValue)}</span>
                                )}
                            </span>
                        </div>
                    ))
                )}
            </div>
        );
    };

    // Main renderer based on selected mode
    const renderDiff = (docIndex: number) => {
        switch (diffMode) {
            case 'character':
                return renderCharacterDiff(docIndex);
            case 'semantic':
                return renderSemanticDiff(docIndex);
            case 'line':
            default:
                return renderLineDiff(docIndex);
        }
    };

    return (
        <div className="compare-view">
            <div className="compare-header">
                <h1>Document Comparison</h1>
                <div className="compare-controls">
                    {/* Diff Mode Selector */}
                    <div className="diff-mode-selector" ref={dropdownRef} title="Select comparison mode (Alt+M to cycle)">
                        <span className="diff-mode-label">Comparison <u>m</u>ode:</span>
                        <button
                            className="diff-mode-button"
                            onClick={() => setIsModeDropdownOpen(!isModeDropdownOpen)}
                        >
                            <span>{DIFF_MODES.find(m => m.value === diffMode)?.label}</span>
                            <ChevronDown size={14} className={isModeDropdownOpen ? 'rotated' : ''} />
                        </button>
                        {isModeDropdownOpen && (
                            <div className="diff-mode-dropdown">
                                {DIFF_MODES.map(mode => (
                                    <button
                                        key={mode.value}
                                        className={`diff-mode-option ${diffMode === mode.value ? 'active' : ''}`}
                                        onClick={() => {
                                            setDiffMode(mode.value);
                                            setIsModeDropdownOpen(false);
                                        }}
                                    >
                                        <span className="mode-label">{mode.label}</span>
                                        <span className="mode-description">{mode.description}</span>
                                    </button>
                                ))}
                            </div>
                        )}
                    </div>
                    <label className="sync-toggle" title="Alt+S">
                        <input
                            type="checkbox"
                            checked={isSyncEnabled}
                            onChange={(e) => setIsSyncEnabled(e.target.checked)}
                        />
                        <span>Sync Scroll</span>
                    </label>
                    <label className="sync-toggle" title="Alt+D">
                        <input
                            type="checkbox"
                            checked={showDiffOnly}
                            onChange={(e) => setShowDiffOnly(e.target.checked)}
                        />
                        <span>Show Differences Only</span>
                    </label>
                    {diffMode === 'semantic' && (
                        <label className="sync-toggle array-order-toggle" title="Alt+O">
                            <input
                                type="checkbox"
                                checked={ignoreArrayOrder}
                                onChange={(e) => setIgnoreArrayOrder(e.target.checked)}
                            />
                            <span>Ignore Array Order</span>
                        </label>
                    )}
                    <span className="diff-count">
                        {diffCount} {diffCount === 1 ? 'difference' : 'differences'}
                    </span>
                    <span className="doc-count">{documents.length} documents</span>
                    <button
                        className="close-btn"
                        onClick={handleClose}
                        title="Close (Esc)"
                    >
                        <X size={18} />
                    </button>
                </div>
            </div>
            <div className="compare-container" style={{
                gridTemplateColumns: `repeat(${documents.length}, 1fr)`
            }}>
                {documents.map((doc, index) => {
                    const ageInfo = ageInfos[index];
                    return (
                        <div key={index} className="compare-pane">
                            <div className="pane-header">
                                <div className="pane-header-left">
                                    <span className="pane-title">
                                        {getDocumentId(doc)}
                                    </span>
                                    <span className="pane-index">#{index + 1}</span>
                                </div>
                                {ageInfo.timestamp !== null && (
                                    <div className="age-indicator">
                                        {ageInfo.label === 'oldest' && (
                                            <span className="age-badge age-oldest" title="Oldest document">
                                                <ArrowDown size={12} />
                                                Oldest
                                            </span>
                                        )}
                                        {ageInfo.label === 'newest' && (
                                            <span className="age-badge age-newest" title="Newest document">
                                                <ArrowUp size={12} />
                                                Newest
                                            </span>
                                        )}
                                        {ageInfo.label === 'middle' && (
                                            <span className="age-badge age-middle" title={`Age rank: ${ageInfo.rank}`}>
                                                #{ageInfo.rank}
                                            </span>
                                        )}
                                        <span className="age-time" title={ageInfo.formattedDate || ''}>
                                            <Clock size={12} />
                                            {ageInfo.relativeAge}
                                        </span>
                                    </div>
                                )}
                            </div>
                            <div
                                ref={(el) => (containerRefs.current[index] = el)}
                                className="pane-content"
                                onScroll={() => handleScroll(index)}
                            >
                                {renderDiff(index)}
                            </div>
                        </div>
                    );
                })}
            </div>
        </div>
    );
};
