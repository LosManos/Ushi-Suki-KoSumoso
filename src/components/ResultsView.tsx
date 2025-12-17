import React from 'react';
import { Copy, Save, X } from 'lucide-react';
import { JsonTreeView } from './JsonTreeView';
import { useTheme } from '../context/ThemeContext';
import './ResultsView.css';


interface ResultsViewProps {
  results: any[];
  loading: boolean;
  onRunQuery: () => void;
  onCancelQuery: () => void;
  pageSize: number | 'All';
  onPageSizeChange: (pageSize: number | 'All') => void;
  error?: string;
  onDismissError?: () => void;
  hasMoreResults?: boolean;
}

type ViewMode = 'text' | 'json';

export const ResultsView: React.FC<ResultsViewProps> = ({
  results,
  loading,
  onRunQuery,
  onCancelQuery,
  pageSize,
  onPageSizeChange,
  error,
  onDismissError,
  hasMoreResults
}) => {
  const containerRef = React.useRef<HTMLTextAreaElement>(null);
  const [content, setContent] = React.useState('');
  const [viewMode, setViewMode] = React.useState<ViewMode>('text');
  const { resolvedTheme } = useTheme();

  /* New Ref for JsonTreeView */
  const jsonViewRef = React.useRef<HTMLDivElement>(null);

  /* Ref for page size selector */
  const pageSizeSelectRef = React.useRef<HTMLSelectElement>(null);

  // Helper to get current line from textarea
  const getCurrentLineFromTextarea = (): string | null => {
    const textarea = containerRef.current;
    if (!textarea) return null;

    const cursorPos = textarea.selectionStart;
    const text = textarea.value;

    // Find line start and end
    let lineStart = cursorPos;
    while (lineStart > 0 && text[lineStart - 1] !== '\n') lineStart--;

    let lineEnd = cursorPos;
    while (lineEnd < text.length && text[lineEnd] !== '\n') lineEnd++;

    return text.substring(lineStart, lineEnd);
  };

  // Helper to parse JSON key-value from a line
  const parseJsonLine = (line: string): { key: string; value: string; both: string } | null => {
    // Match pattern: "key": value  or  "key": "value"
    const match = line.match(/^\s*"([^"]+)"\s*:\s*(.+?)\s*,?\s*$/);
    if (!match) return null;

    const key = match[1];
    let value = match[2];

    // Remove trailing comma if present
    if (value.endsWith(',')) {
      value = value.slice(0, -1).trim();
    }

    return {
      key,
      value,
      both: `"${key}": ${value}`
    };
  };

  // Copy handlers for text view
  const copyKeyFromLine = () => {
    const line = getCurrentLineFromTextarea();
    if (!line) return;
    const parsed = parseJsonLine(line);
    if (parsed) {
      navigator.clipboard.writeText(parsed.key).catch(console.error);
    }
  };

  const copyValueFromLine = () => {
    const line = getCurrentLineFromTextarea();
    if (!line) return;
    const parsed = parseJsonLine(line);
    if (parsed) {
      navigator.clipboard.writeText(parsed.value).catch(console.error);
    }
  };

  const copyBothFromLine = () => {
    const line = getCurrentLineFromTextarea();
    if (!line) return;
    const parsed = parseJsonLine(line);
    if (parsed) {
      navigator.clipboard.writeText(parsed.both).catch(console.error);
    }
  };

  const copyRawValueFromLine = () => {
    const line = getCurrentLineFromTextarea();
    if (!line) return;
    const parsed = parseJsonLine(line);
    if (parsed) {
      // Remove surrounding quotes if it's a string value
      let rawValue = parsed.value;
      if (rawValue.startsWith('"') && rawValue.endsWith('"')) {
        rawValue = rawValue.slice(1, -1);
      }
      navigator.clipboard.writeText(rawValue).catch(console.error);
    }
  };

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

      // Cmd/Ctrl + Shift + S to copy results to clipboard
      if ((e.metaKey || e.ctrlKey) && e.shiftKey && e.key.toLowerCase() === 's') {
        e.preventDefault();
        if (results.length > 0) {
          const jsonString = JSON.stringify(results, null, 2);
          navigator.clipboard.writeText(jsonString).catch(err => {
            console.error('Failed to copy to clipboard:', err);
          });
        }
      }

      // Cmd/Ctrl + S to save results to file
      if ((e.metaKey || e.ctrlKey) && !e.shiftKey && e.key.toLowerCase() === 's') {
        e.preventDefault();
        if (results.length > 0) {
          const jsonString = JSON.stringify(results, null, 2);
          (window as any).ipcRenderer.invoke('file:saveResults', jsonString).catch((err: any) => {
            console.error('Failed to save to file:', err);
          });
        }
      }

      // Cmd/Ctrl + Shift + R to focus page size selector
      if ((e.metaKey || e.ctrlKey) && e.shiftKey && e.key.toLowerCase() === 'r') {
        e.preventDefault();
        pageSizeSelectRef.current?.focus();
      }

      // Cmd/Ctrl + Alt + C to open compare view
      // Note: On Mac, Alt (Option) produces special characters in e.key (e.g. ç for c),
      // so we use e.code (e.g. KeyC) to reliably detect the physical key pressed.
      if ((e.metaKey || e.ctrlKey) && e.altKey && e.code === 'KeyC') {
        e.preventDefault();
        if (results.length >= 2 && results.length <= 5) {
          handleCompare();
        }
      }

      // Text view copy shortcuts (Alt+K/V/R/B)
      // Only work when text view is active and textarea is focused
      if (viewMode === 'text' && document.activeElement === containerRef.current) {
        // Alt+K to copy key from current line
        if (e.altKey && !e.metaKey && !e.ctrlKey && e.code === 'KeyK') {
          e.preventDefault();
          copyKeyFromLine();
        }
        // Alt+V to copy value from current line
        if (e.altKey && !e.metaKey && !e.ctrlKey && e.code === 'KeyV') {
          e.preventDefault();
          copyValueFromLine();
        }
        // Alt+R to copy raw value (no quotes) from current line
        if (e.altKey && !e.metaKey && !e.ctrlKey && e.code === 'KeyR') {
          e.preventDefault();
          copyRawValueFromLine();
        }
        // Alt+B to copy both (key: value) from current line
        if (e.altKey && !e.metaKey && !e.ctrlKey && e.code === 'KeyB') {
          e.preventDefault();
          copyBothFromLine();
        }
      }
    };

    window.addEventListener('keydown', handleKeyDown);
    return () => window.removeEventListener('keydown', handleKeyDown);
  }, [viewMode, error, onDismissError, results]);

  // Handler for copying results to clipboard
  const handleCopyToClipboard = async () => {
    if (results.length === 0) return;
    try {
      const jsonString = JSON.stringify(results, null, 2);
      await navigator.clipboard.writeText(jsonString);
    } catch (err) {
      console.error('Failed to copy to clipboard:', err);
    }
  };

  // Handler for saving results to file
  const handleSaveToFile = async () => {
    if (results.length === 0) return;
    try {
      const jsonString = JSON.stringify(results, null, 2);
      await (window as any).ipcRenderer.invoke('file:saveResults', jsonString);
    } catch (err) {
      console.error('Failed to save to file:', err);
    }
  };

  // Handler for opening compare view
  const handleCompare = async () => {
    if (results.length < 2 || results.length > 5) return;
    try {
      await (window as any).ipcRenderer.invoke('compare:open', results);
    } catch (err) {
      console.error('Failed to open compare window:', err);
    }
  };

  /* ... */

  return (
    <div className="results-view-container">
      <div className="results-header">
        <h3 title="Focus Results View (Cmd+R)">Results</h3>
        <div className="results-actions">
          <button
            className="action-btn"
            onClick={handleCopyToClipboard}
            title="Copy results to clipboard (Cmd+Shift+S)"
            disabled={results.length === 0}
          >
            <Copy size={16} />
          </button>
          <button
            className="action-btn"
            onClick={handleSaveToFile}
            title="Save results to file (Cmd+S)"
            disabled={results.length === 0}
          >
            <Save size={16} />
          </button>
        </div>
        <div className="header-controls">
          <div className="control-group">
            <button
              key="run-cancel-btn"
              className={`run-btn-small ${loading ? 'cancel' : ''}`}
              onClick={loading ? onCancelQuery : onRunQuery}
              title={loading ? "Cancel Query (Cmd+Enter)" : "Run Query (Cmd+Enter)"}
            >
              {loading ? 'Cancel' : 'Run'}
            </button>
            <div className="page-size-selector-small">
              <label htmlFor="page-size-select" title="Change page size (Cmd+Shift+R)">Rows:</label>
              <select
                ref={pageSizeSelectRef}
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
          {results.length >= 2 && results.length <= 5 && (
            <button
              className="compare-btn"
              onClick={handleCompare}
              title="Compare documents side by side (Cmd+Alt+C)"
            >
              Compare
            </button>
          )}
          <div className="results-meta">{loading ? 'Running...' : `${results.length}${hasMoreResults ? '+' : ''} documents found`}</div>
        </div>
      </div>
      <div className="results-content">
        {loading ? (
          <div className="empty-state">Loading...</div>
        ) : (
          <>
            {results.length > 0 ? (
              viewMode === 'text' ? (
                <div className="text-view-container">
                  <div className="text-view-toolbar">
                    <span className="toolbar-label">Copy from current line:</span>
                    <button className="toolbar-btn" onClick={copyKeyFromLine} title="Copy key (Alt+K)">
                      <Copy size={12} /><span>K</span>
                    </button>
                    <button className="toolbar-btn" onClick={copyValueFromLine} title="Copy value with quotes (Alt+V)">
                      <Copy size={12} /><span>V</span>
                    </button>
                    <button className="toolbar-btn" onClick={copyRawValueFromLine} title="Copy raw value without quotes (Alt+R)">
                      <Copy size={12} /><span>R</span>
                    </button>
                    <button className="toolbar-btn" onClick={copyBothFromLine} title="Copy key & value (Alt+B)">
                      <Copy size={12} /><span>B</span>
                    </button>
                  </div>
                  <textarea
                    ref={containerRef}
                    className="json-editor"
                    value={content}
                    onChange={(e) => setContent(e.target.value)}
                    spellCheck={false}
                  />
                </div>
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
                    <button className="close-btn" onClick={onDismissError}><X size={16} /></button>
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

