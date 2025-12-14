import React, { useRef, useEffect, useState, useMemo } from 'react';
import { X } from 'lucide-react';
import './CompareView.css';

interface CompareViewProps {
    documents: any[];
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
                {documents.map((doc, index) => (
                    <div key={index} className="compare-pane">
                        <div className="pane-header">
                            <span className="pane-title">
                                {getDocumentId(doc)}
                            </span>
                            <span className="pane-index">#{index + 1}</span>
                        </div>
                        <div
                            ref={(el) => (containerRefs.current[index] = el)}
                            className="pane-content"
                            onScroll={() => handleScroll(index)}
                        >
                            {renderLines(index)}
                        </div>
                    </div>
                ))}
            </div>
        </div>
    );
};
