import React from 'react';
import './Sidebar.css';

interface SidebarProps {
  databases: string[];
  selectedDatabase: string | null;
  selectedContainer: string | null;
  onSelectDatabase: (dbId: string) => void;
  onSelectContainer: (containerId: string) => void;
  containers: Record<string, string[]>; // Map dbId -> containerIds
}

export const Sidebar: React.FC<SidebarProps> = ({
  databases,
  selectedDatabase,
  selectedContainer,
  onSelectDatabase,
  onSelectContainer,
  containers
}) => {
  return (
    <div className="sidebar-content">
      <div className="sidebar-header">
        <h2>Cosmos DB</h2>
      </div>
      <nav className="sidebar-nav">
        {databases.map(db => (
          <div key={db} className="db-item">
            <div
              className={`nav-item ${selectedDatabase === db ? 'active' : ''}`}
              onClick={() => onSelectDatabase(db)}
            >
              📂 {db}
            </div>
            {selectedDatabase === db && containers[db] && (
              <div className="container-list">
                {containers[db].map(container => (
                  <div
                    key={container}
                    className={`nav-item sub-item ${selectedContainer === container ? 'active' : ''}`}
                    onClick={() => onSelectContainer(container)}
                  >
                    📄 {container}
                  </div>
                ))}
              </div>
            )}
          </div>
        ))}
      </nav>
    </div>
  );
};

