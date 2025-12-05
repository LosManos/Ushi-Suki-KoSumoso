import React, { useState } from 'react';
import './QueryEditor.css';

interface QueryEditorProps {
    onRunQuery: (query: string, pageSize: number | 'All') => void;
    selectedContainer?: string | null;
}

export const QueryEditor: React.FC<QueryEditorProps> = ({ onRunQuery, selectedContainer }) => {
    const [query, setQuery] = useState('SELECT * FROM c');
    const [quickId, setQuickId] = useState('');
    const [pageSize, setPageSize] = useState<number | 'All'>(10);

    const pageSizeSelectRef = React.useRef<HTMLSelectElement>(null);
    const textareaRef = React.useRef<HTMLTextAreaElement>(null);

    React.useEffect(() => {
        if (selectedContainer && textareaRef.current) {
            textareaRef.current.focus();
        }
    }, [selectedContainer]);

    React.useEffect(() => {
        const handleKeyDown = (e: KeyboardEvent) => {
            // Cmd/Ctrl + Enter to run query
            if ((e.metaKey || e.ctrlKey) && e.key === 'Enter') {
                e.preventDefault();
                onRunQuery(query, pageSize);
            }
            // Cmd/Ctrl + Shift + R to focus page size selector
            if ((e.metaKey || e.ctrlKey) && e.shiftKey && e.key.toLowerCase() === 'r') {
                e.preventDefault();
                pageSizeSelectRef.current?.focus();
            }
            // Cmd/Ctrl + 2 to focus query editor
            if ((e.metaKey || e.ctrlKey) && e.key === '2') {
                e.preventDefault();
                textareaRef.current?.focus();
            }
        };

        window.addEventListener('keydown', handleKeyDown);
        return () => window.removeEventListener('keydown', handleKeyDown);
    }, [query, pageSize, onRunQuery]);

    const handleQuickLookup = () => {
        if (!quickId.trim()) return;
        const lookupQuery = `SELECT * FROM c WHERE c.id = '${quickId.trim()}'`;
        setQuery(lookupQuery);
        onRunQuery(lookupQuery, 1); // Quick lookup implies single result usually
    };

    return (
        <div className="query-editor-container">
            <div className="editor-toolbar">
                <span className="tab active" title="Focus Query Editor (Cmd+2)">Query 1</span>
                <div className="quick-lookup">
                    <input
                        type="text"
                        placeholder="Quick ID Lookup..."
                        value={quickId}
                        onChange={(e) => setQuickId(e.target.value)}
                        onKeyDown={(e) => e.key === 'Enter' && handleQuickLookup()}
                    />
                    <button onClick={handleQuickLookup}>Go</button>
                </div>
            </div>
            <div className="editor-area">
                <textarea
                    ref={textareaRef}
                    className="code-input"
                    value={query}
                    onChange={(e) => setQuery(e.target.value)}
                    placeholder="SELECT * FROM c"
                />
            </div>
            <div className="editor-actions">
                <div className="page-size-selector">
                    <label title="Change page size (Cmd+Shift+R)">Results per page:</label>
                    <select
                        ref={pageSizeSelectRef}
                        value={pageSize}
                        onChange={(e) => {
                            const val = e.target.value;
                            setPageSize(val === 'All' ? 'All' : Number(val));
                        }}
                        title="Change page size (Cmd+Shift+R)"
                    >
                        <option value={1}>1</option>
                        <option value={10}>10</option>
                        <option value={50}>50</option>
                        <option value={100}>100</option>
                        <option value={1000}>1000</option>
                        <option value="All">All</option>
                    </select>
                </div>
                <button
                    className="run-btn"
                    onClick={() => onRunQuery(query, pageSize)}
                    title="Run Query (Cmd+Enter)"
                >
                    Run Query
                </button>
            </div>
        </div>
    );
};
