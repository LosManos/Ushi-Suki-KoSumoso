import React from 'react';
import './ResultsView.css';

interface ResultsViewProps {
  results: any[];
  loading: boolean;
}

export const ResultsView: React.FC<ResultsViewProps> = ({ results, loading }) => {
  const containerRef = React.useRef<HTMLTextAreaElement>(null);
  const [content, setContent] = React.useState('');

  React.useEffect(() => {
    if (results) {
      setContent(JSON.stringify(results, null, 2));
    }
  }, [results]);

  React.useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      // Cmd/Ctrl + 2 to focus results view
      if ((e.metaKey || e.ctrlKey) && e.key === '2') {
        e.preventDefault();
        containerRef.current?.focus();
      }
    };

    window.addEventListener('keydown', handleKeyDown);
    return () => window.removeEventListener('keydown', handleKeyDown);
  }, []);

  return (
    <div className="results-view-container">
      <div className="results-header">
        <h3 title="Focus Results View (Cmd+2)">Results</h3>
        <div className="results-meta">{loading ? 'Running...' : `${results.length} documents found`}</div>
      </div>
      <div className="results-content">
        {loading ? (
          <div className="empty-state">Loading...</div>
        ) : results.length > 0 ? (
          <textarea
            ref={containerRef}
            className="json-editor"
            value={content}
            onChange={(e) => setContent(e.target.value)}
            spellCheck={false}
          />
        ) : (
          <div className="empty-state">
            Run a query to see results
          </div>
        )}
      </div>
    </div>
  );
};

