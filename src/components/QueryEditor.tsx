import React, { useState } from 'react';
import './QueryEditor.css';

interface QueryEditorProps {
    onRunQuery: (query: string, pageSize: number | 'All') => void;
}

export const QueryEditor: React.FC<QueryEditorProps> = ({ onRunQuery }) => {
    const [query, setQuery] = useState('SELECT * FROM c');
    const [quickId, setQuickId] = useState('');
    const [pageSize, setPageSize] = useState<number | 'All'>(10);

    const handleQuickLookup = () => {
        if (!quickId.trim()) return;
        const lookupQuery = `SELECT * FROM c WHERE c.id = '${quickId.trim()}'`;
        setQuery(lookupQuery);
        onRunQuery(lookupQuery, 1); // Quick lookup implies single result usually
    };

    return (
        <div className="query-editor-container">
            <div className="editor-toolbar">
                <span className="tab active">Query 1</span>
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
                    className="code-input"
                    value={query}
                    onChange={(e) => setQuery(e.target.value)}
                    placeholder="SELECT * FROM c"
                />
            </div>
            <div className="editor-actions">
                <div className="page-size-selector">
                    <label>Results per page:</label>
                    <select
                        value={pageSize}
                        onChange={(e) => {
                            const val = e.target.value;
                            setPageSize(val === 'All' ? 'All' : Number(val));
                        }}
                    >
                        <option value={1}>1</option>
                        <option value={10}>10</option>
                        <option value={50}>50</option>
                        <option value={100}>100</option>
                        <option value={1000}>1000</option>
                        <option value="All">All</option>
                    </select>
                </div>
                <button className="run-btn" onClick={() => onRunQuery(query, pageSize)}>Run Query</button>
            </div>
        </div>
    );
};
