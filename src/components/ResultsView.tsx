import React from 'react';
import { JsonTreeView } from './JsonTreeView';
import { useTheme } from '../context/ThemeContext';
import './ResultsView.css';


interface ResultsViewProps {
  results: any[];
  loading: boolean;
  onRunQuery: () => void;
  pageSize: number | 'All';
  onPageSizeChange: (pageSize: number | 'All') => void;
  error?: string;
  onDismissError?: () => void;
}

type ViewMode = 'text' | 'json';

export const ResultsView: React.FC<ResultsViewProps> = ({
  results,
  loading,
  onRunQuery,
  pageSize,
  onPageSizeChange,
  error,
  onDismissError
}) => {
  const containerRef = React.useRef<HTMLTextAreaElement>(null);
  const [content, setContent] = React.useState('');
  const [viewMode, setViewMode] = React.useState<ViewMode>('text');
  const { resolvedTheme } = useTheme();

  /* New Ref for JsonTreeView */
  const jsonViewRef = React.useRef<HTMLDivElement>(null);

  React.useEffect(() => {
    if (results) {
      setContent(JSON.stringify(results, null, 2));
    }
  }, [results]);

  React.useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      // Cmd/Ctrl + 3 to focus results view (or Cmd+R/Ctrl+R depending on implementation)
      if ((e.metaKey || e.ctrlKey) && !e.shiftKey && e.key.toLowerCase() === 'r') {
        e.preventDefault();
        if (viewMode === 'text' && containerRef.current) {
          containerRef.current.focus();
          containerRef.current.setSelectionRange(0, 0);
          containerRef.current.scrollTop = 0;
        } else if (viewMode === 'json' && jsonViewRef.current) {
          jsonViewRef.current.focus();
        }
      }

      // ... existing mode switch logic ...
      // Cmd/Ctrl + T to switch to Text view
      if ((e.metaKey || e.ctrlKey) && !e.shiftKey && (e.key === 't' || e.key === 'T')) {
        e.preventDefault();
        setViewMode('text');
      }

      // Cmd/Ctrl + Shift + T to switch to Hierarchical view
      if ((e.metaKey || e.ctrlKey) && e.shiftKey && (e.key === 't' || e.key === 'T')) {
        e.preventDefault();
        setViewMode('json');
      }

      // Escape to dismiss error
      if (e.key === 'Escape' && error && onDismissError) {
        onDismissError();
      }
    };

    window.addEventListener('keydown', handleKeyDown);
    return () => window.removeEventListener('keydown', handleKeyDown);
  }, [viewMode, error, onDismissError]);

  /* ... */

  return (
    <div className="results-view-container">
      <div className="results-header">
        <h3 title="Focus Results View (Cmd+R)">Results</h3>
        <div className="header-controls">
          <div className="control-group">
            <button
              className="run-btn-small"
              onClick={onRunQuery}
              title="Run Query (Cmd+Enter)"
            >
              Run
            </button>
            <div className="page-size-selector-small">
              <label htmlFor="page-size-select" title="Change page size (Cmd+Shift+R)">Rows:</label>
              <select
                id="page-size-select"
                value={pageSize}
                onChange={(e) => {
                  const val = e.target.value;
                  onPageSizeChange(val === 'All' ? 'All' : Number(val));
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
          </div>
          <div className="view-toggle">
            <button
              className={viewMode === 'text' ? 'active' : ''}
              onClick={() => setViewMode('text')}
              title="Text View (Cmd+T)"
            >
              Text
            </button>
            <button
              className={viewMode === 'json' ? 'active' : ''}
              onClick={() => setViewMode('json')}
              title="Hierarchical View (Cmd+Shift+T)"
            >
              Hierarchical
            </button>
          </div>
          <div className="results-meta">{loading ? 'Running...' : `${results.length} documents found`}</div>
        </div>
      </div>
      <div className="results-content">
        {loading ? (
          <div className="empty-state">Loading...</div>
        ) : (
          <>
            {results.length > 0 ? (
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
                  <JsonTreeView
                    ref={jsonViewRef}
                    data={results}
                    theme={resolvedTheme === 'dark' ? 'dark' : 'light'}
                  />
                </div>
              )
            ) : (
              <div className="empty-state">
                Run a query to see results
              </div>
            )}

            {error && (
              <div className="error-overlay">
                <div className="error-dialog">
                  <div className="error-header">
                    <span>Query Error</span>
                    <button className="close-btn" onClick={onDismissError}>×</button>
                  </div>
                  <div className="error-body">
                    {error}
                  </div>
                  <div className="error-footer">
                    <button className="dismiss-btn" onClick={onDismissError}>Dismiss</button>
                  </div>
                </div>
              </div>
            )}
          </>
        )}
      </div>
    </div>
  );
};

