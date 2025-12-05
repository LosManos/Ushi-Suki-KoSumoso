import React, { useState } from 'react';
import './QueryEditor.css';

interface QueryEditorProps {
    onRunQuery: (query: string) => void;
}

export const QueryEditor: React.FC<QueryEditorProps> = ({ onRunQuery }) => {
    const [query, setQuery] = useState('SELECT * FROM c');
    const [quickId, setQuickId] = useState('');

    const handleQuickLookup = () => {
        if (!quickId.trim()) return;
        const lookupQuery = `SELECT * FROM c WHERE c.id = '${quickId.trim()}'`;
        setQuery(lookupQuery);
        onRunQuery(lookupQuery);
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
                <button className="run-btn" onClick={() => onRunQuery(query)}>Run Query</button>
            </div>
        </div>
    );
};
