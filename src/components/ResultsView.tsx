import React from 'react';
import ReactJson from 'react-json-view';
import { useTheme } from '../context/ThemeContext';
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
  const { resolvedTheme } = useTheme();

  React.useEffect(() => {
    if (results) {
      setContent(JSON.stringify(results, null, 2));
    }
  }, [results]);

  React.useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      // Cmd/Ctrl + 3 to focus results view
      if ((e.metaKey || e.ctrlKey) && !e.shiftKey && e.key.toLowerCase() === 'r') {
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
    };

    window.addEventListener('keydown', handleKeyDown);
    return () => window.removeEventListener('keydown', handleKeyDown);
  }, [viewMode]);

  const darkTheme = {
    base00: "transparent", // background
    base01: "#383830",
    base02: "#49483e",
    base03: "#75715e",
    base04: "#a59f85",
    base05: "#f8f8f2", // text
    base06: "#f5f4f1",
    base07: "#f9f8f5",
    base08: "#f92672",
    base09: "#fd971f",
    base0A: "#f4bf75",
    base0B: "#a6e22e", // string
    base0C: "#a1efe4",
    base0D: "#66d9ef", // key
    base0E: "#ae81ff",
    base0F: "#cc6633"
  };

  const lightTheme = {
    base00: "transparent", // background
    base01: "#f5f5f5",
    base02: "#e0e0e0",
    base03: "#c0c0c0",
    base04: "#a0a0a0",
    base05: "#333333", // text
    base06: "#202020",
    base07: "#101010",
    base08: "#d73a49", // keyword?
    base09: "#e36209",
    base0A: "#6f42c1", // key? mixed up locally but ok
    base0B: "#22863a", // string
    base0C: "#005cc5",
    base0D: "#005cc5", // key
    base0E: "#6f42c1",
    base0F: "#24292e"
  };

  return (
    <div className="results-view-container">
      <div className="results-header">
        <h3 title="Focus Results View (Cmd+R)">Results</h3>
        <div className="header-controls">
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
                theme={resolvedTheme === 'dark' ? darkTheme : lightTheme}
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

