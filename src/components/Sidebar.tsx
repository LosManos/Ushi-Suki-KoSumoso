import React from 'react';
import { useTheme } from '../context/ThemeContext';
import './Sidebar.css';

interface SidebarProps {
  databases: string[];
  selectedDatabase: string | null;
  selectedContainer: string | null;
  onSelectDatabase: (dbId: string | null) => void;
  onSelectContainer: (containerId: string) => void;
  containers: Record<string, string[]>; // Map dbId -> containerIds
  accountName?: string;
}

export const Sidebar: React.FC<SidebarProps> = ({
  databases,
  selectedDatabase,
  selectedContainer,
  onSelectDatabase,
  onSelectContainer,
  containers,
  accountName = 'Cosmos DB'
}) => {
  const [focusedId, setFocusedId] = React.useState<string | null>(null);
  const sidebarRef = React.useRef<HTMLDivElement>(null);

  // Auto-focus first item when databases load
  React.useEffect(() => {
    if (databases.length > 0 && !selectedDatabase && !focusedId) {
      setFocusedId(databases[0]);
      // Give a slight delay to ensure render is complete
      setTimeout(() => sidebarRef.current?.focus(), 50);
    }
  }, [databases, selectedDatabase, focusedId]);

  // Sync focusedId when selection changes via click
  React.useEffect(() => {
    if (selectedContainer) setFocusedId(selectedContainer);
    else if (selectedDatabase) setFocusedId(selectedDatabase);
  }, [selectedDatabase, selectedContainer]);

  // Global Cmd+1 listener to focus sidebar
  React.useEffect(() => {
    const handleWindowKeyDown = (e: KeyboardEvent) => {
      if ((e.metaKey || e.ctrlKey) && e.key === '1') {
        e.preventDefault();
        sidebarRef.current?.focus();
      }
    };
    window.addEventListener('keydown', handleWindowKeyDown);
    return () => window.removeEventListener('keydown', handleWindowKeyDown);
  }, []);

  const flatItems = React.useMemo(() => {
    const items: { type: 'db' | 'container'; id: string; parentId?: string }[] = [];
    databases.forEach(db => {
      items.push({ type: 'db', id: db });
      if (selectedDatabase === db && containers[db]) {
        containers[db].forEach(c => {
          items.push({ type: 'container', id: c, parentId: db });
        });
      }
    });
    return items;
  }, [databases, selectedDatabase, containers]);

  const handleKeyDown = (e: React.KeyboardEvent) => {
    if (flatItems.length === 0) return;
    const currentIndex = flatItems.findIndex(i => i.id === focusedId);
    // If nothing focused, start at 0
    const idx = currentIndex === -1 ? 0 : currentIndex;

    switch (e.key) {
      case 'ArrowDown': {
        e.preventDefault();
        const next = Math.min(flatItems.length - 1, idx + 1);
        setFocusedId(flatItems[next].id);
        break;
      }
      case 'ArrowUp': {
        e.preventDefault();
        const prev = Math.max(0, idx - 1);
        setFocusedId(flatItems[prev].id);
        break;
      }
      case 'Enter': {
        e.preventDefault();
        const item = flatItems[idx];
        if (item) {
          if (item.type === 'db') {
            // Toggle expansion
            if (selectedDatabase === item.id) {
              onSelectDatabase(null); // Collapse
            } else {
              onSelectDatabase(item.id); // Expand
            }
          } else {
            // Select collection (and thus load query editor)
            onSelectContainer(item.id);
          }
        }
        break;
      }
      case 'ArrowRight': {
        e.preventDefault();
        const item = flatItems[idx];
        if (item && item.type === 'db' && selectedDatabase !== item.id) {
          onSelectDatabase(item.id); // Expand
        }
        break;
      }
      case 'ArrowLeft': {
        e.preventDefault();
        const item = flatItems[idx];
        if (item) {
          if (item.type === 'container' && item.parentId) {
            // Move focus to parent DB
            setFocusedId(item.parentId);
          } else if (item.type === 'db' && selectedDatabase === item.id) {
            // Collapse DB
            onSelectDatabase(null);
          }
        }
        break;
      }
    }
  };

  const { theme, setTheme } = useTheme();
  const [isSettingsOpen, setIsSettingsOpen] = React.useState(false);
  const settingsRef = React.useRef<HTMLDivElement>(null);

  React.useEffect(() => {
    const handleClickOutside = (event: MouseEvent) => {
      if (settingsRef.current && !settingsRef.current.contains(event.target as Node)) {
        setIsSettingsOpen(false);
      }
    };

    if (isSettingsOpen) {
      document.addEventListener('mousedown', handleClickOutside);
    }
    return () => {
      document.removeEventListener('mousedown', handleClickOutside);
    };
  }, [isSettingsOpen]);

  return (
    <div className="sidebar-content">
      <div className="sidebar-header">
        <h2 title="Focus Sidebar (Cmd+1)">{accountName}</h2>
        <div className="settings-container" ref={settingsRef}>
          <button
            className={`settings-btn ${isSettingsOpen ? 'active' : ''}`}
            onClick={() => setIsSettingsOpen(!isSettingsOpen)}
            title="Settings"
          >
            ⚙️
          </button>
          {isSettingsOpen && (
            <div className="settings-dropdown">
              <div className="settings-section">
                <h4>Theme</h4>
                <div className="theme-options">
                  <button
                    className={theme === 'light' ? 'active' : ''}
                    onClick={() => setTheme('light')}
                    title="Light Mode"
                  >
                    ☀️ Light
                  </button>
                  <button
                    className={theme === 'dark' ? 'active' : ''}
                    onClick={() => setTheme('dark')}
                    title="Dark Mode"
                  >
                    🌙 Dark
                  </button>
                  <button
                    className={theme === 'system' ? 'active' : ''}
                    onClick={() => setTheme('system')}
                    title="System Theme"
                  >
                    💻 System
                  </button>
                </div>
              </div>
            </div>
          )}
        </div>
      </div>
      <nav
        className="sidebar-nav"
        tabIndex={0}
        ref={sidebarRef}
        onKeyDown={handleKeyDown}
        style={{ outline: 'none' }}
      >
        {databases.map(db => (
          <div key={db} className="db-item">
            <div
              className={`nav-item ${selectedDatabase === db ? 'active' : ''} ${focusedId === db ? 'focused' : ''}`}
              onClick={() => onSelectDatabase(db)}
            >
              {selectedDatabase === db ? '📂' : '📁'} {db}
            </div>
            {selectedDatabase === db && containers[db] && (
              <div className="container-list">
                {containers[db].map(container => (
                  <div
                    key={container}
                    className={`nav-item sub-item ${selectedContainer === container ? 'active' : ''} ${focusedId === container ? 'focused' : ''}`}
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
