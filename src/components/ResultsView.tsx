import React from 'react';
import './ResultsView.css';

interface ResultsViewProps {
  results: any[];
  loading: boolean;
}

export const ResultsView: React.FC<ResultsViewProps> = ({ results, loading }) => {
  return (
    <div className="results-view-container">
      <div className="results-header">
        <h3>Results</h3>
        <div className="results-meta">{loading ? 'Running...' : `${results.length} documents found`}</div>
      </div>
      <div className="results-content">
        {loading ? (
          <div className="empty-state">Loading...</div>
        ) : results.length > 0 ? (
          <pre className="json-output">{JSON.stringify(results, null, 2)}</pre>
        ) : (
          <div className="empty-state">
            Run a query to see results
          </div>
        )}
      </div>
    </div>
  );
};

