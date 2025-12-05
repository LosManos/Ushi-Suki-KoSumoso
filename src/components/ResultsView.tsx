import React from 'react';
import ReactJson from 'react-json-view';
import './ResultsView.css';

interface ResultsViewProps {
  results: any[];
  loading: boolean;
}

type ViewMode = 'text' | 'json';

export const ResultsView: React.FC<ResultsViewProps> = ({ results, loading }) => {
  const containerRef = React.useRef<HTMLTextAreaElement>(null);
  const [content, setContent] = React.useState('');
  const [viewMode, setViewMode] = React.useState<ViewMode>('text');

  React.useEffect(() => {
    if (results) {
      setContent(JSON.stringify(results, null, 2));
    }
  }, [results]);

  React.useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      // Cmd/Ctrl + 3 to focus results view
      if ((e.metaKey || e.ctrlKey) && e.key === '3') {
        e.preventDefault();
        if (viewMode === 'text' && containerRef.current) {
          containerRef.current.focus();
          containerRef.current.setSelectionRange(0, 0);
          containerRef.current.scrollTop = 0;
        } else if (viewMode === 'json') {
          // For JSON view, we can't easily "focus" a specific element, 
          // but we can scroll the container to top if we had a ref to it.
          // For now, let's just ensure the view itself is visible.
          const jsonContainer = document.querySelector('.react-json-view');
          if (jsonContainer) {
            jsonContainer.scrollIntoView({ behavior: 'smooth', block: 'start' });
          }
        }
      }
    };

    window.addEventListener('keydown', handleKeyDown);
    return () => window.removeEventListener('keydown', handleKeyDown);
  }, [viewMode]);

  return (
    <div className="results-view-container">
      <div className="results-header">
        <h3 title="Focus Results View (Cmd+3)">Results</h3>
        <div className="header-controls">
          <div className="view-toggle">
            <button
              className={viewMode === 'text' ? 'active' : ''}
              onClick={() => setViewMode('text')}
              title="Text View"
            >
              Text
            </button>
            <button
              className={viewMode === 'json' ? 'active' : ''}
              onClick={() => setViewMode('json')}
              title="JSON View"
            >
              JSON
            </button>
          </div>
          <div className="results-meta">{loading ? 'Running...' : `${results.length} documents found`}</div>
        </div>
      </div>
      <div className="results-content">
        {loading ? (
          <div className="empty-state">Loading...</div>
        ) : results.length > 0 ? (
          viewMode === 'text' ? (
            <textarea
              ref={containerRef}
              className="json-editor"
              value={content}
              onChange={(e) => setContent(e.target.value)}
              spellCheck={false}
            />
          ) : (
            <div className="json-viewer-container">
              <ReactJson
                src={results}
                theme="rjv-default"
                displayDataTypes={false}
                style={{ backgroundColor: 'transparent' }}
                collapsed={1}
                enableClipboard={true}
              />
            </div>
          )
        ) : (
          <div className="empty-state">
            Run a query to see results
          </div>
        )}
      </div>
    </div>
  );
};

