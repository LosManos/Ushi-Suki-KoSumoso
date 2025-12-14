import React, { useRef, useEffect, useState, useMemo } from 'react';
import { X, Clock, ArrowUp, ArrowDown } from 'lucide-react';
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
 * Count the number of different lines
 */
function countDifferences(diffLines: DiffLine[][]): number {
    if (diffLines.length === 0) return 0;
    return diffLines[0].filter(line => line.isDifferent).length;
}

export const CompareView: React.FC<CompareViewProps> = ({ documents }) => {
    const containerRefs = useRef<(HTMLDivElement | null)[]>([]);
    const [isSyncEnabled, setIsSyncEnabled] = useState(true);
    const [showDiffOnly, setShowDiffOnly] = useState(false);
    const isScrollingRef = useRef(false);
    const scrollTimeoutRef = useRef<NodeJS.Timeout | null>(null);

    // Format documents as pretty JSON
    const formattedDocs = useMemo(() =>
        documents.map(doc => JSON.stringify(doc, null, 2)),
        [documents]
    );

    // Compute diff lines
    const diffLines = useMemo(() =>
        computeDiffLines(formattedDocs),
        [formattedDocs]
    );

    // Count differences
    const diffCount = useMemo(() =>
        countDifferences(diffLines),
        [diffLines]
    );

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

    // Handle Esc key to close window
    useEffect(() => {
        const handleKeyDown = (e: KeyboardEvent) => {
            if (e.key === 'Escape') {
                window.close();
            }
        };
        window.addEventListener('keydown', handleKeyDown);
        return () => window.removeEventListener('keydown', handleKeyDown);
    }, []);

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

    // Render lines with diff highlighting
    const renderLines = (docIndex: number) => {
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

    return (
        <div className="compare-view">
            <div className="compare-header">
                <h1>Document Comparison</h1>
                <div className="compare-controls">
                    <label className="sync-toggle">
                        <input
                            type="checkbox"
                            checked={isSyncEnabled}
                            onChange={(e) => setIsSyncEnabled(e.target.checked)}
                        />
                        <span>Sync Scroll</span>
                    </label>
                    <label className="sync-toggle">
                        <input
                            type="checkbox"
                            checked={showDiffOnly}
                            onChange={(e) => setShowDiffOnly(e.target.checked)}
                        />
                        <span>Show Differences Only</span>
                    </label>
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
                                {renderLines(index)}
                            </div>
                        </div>
                    );
                })}
            </div>
        </div>
    );
};
