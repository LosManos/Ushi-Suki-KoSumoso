import React from 'react';
import { useTheme } from '../context/ThemeContext';
import { HistoryItem } from '../types';
import './Sidebar.css';

interface SidebarProps {
  databases: string[];
  selectedDatabase: string | null;
  selectedContainer: string | null;
  onSelectDatabase: (dbId: string | null) => void;
  onSelectContainer: (databaseId: string, containerId: string) => void;
  containers: Record<string, string[]>; // Map dbId -> containerIds
  accountName?: string;
  onChangeConnection: () => void;
  history: HistoryItem[];
  onSelectHistory: (item: HistoryItem) => void;
  onCopyHistory: (item: HistoryItem) => void;
  onDeleteHistory: (item: HistoryItem) => void;
}

export const Sidebar: React.FC<SidebarProps> = ({
  databases,
  selectedDatabase,
  selectedContainer,
  onSelectDatabase,
  onSelectContainer,
  containers,
  accountName = 'Cosmos DB',
  onChangeConnection,
  history,
  onSelectHistory,
  onCopyHistory,
  onDeleteHistory
}) => {
  const [focusedId, setFocusedId] = React.useState<string | null>(null);
  const [historyFilter, setHistoryFilter] = React.useState<string>('');
  const sidebarRef = React.useRef<HTMLDivElement>(null);
  const historyFilterRef = React.useRef<HTMLSelectElement>(null);

  // Sync history filter with active selection
  React.useEffect(() => {
    if (selectedDatabase && selectedContainer) {
      setHistoryFilter(`${selectedDatabase}/${selectedContainer}`);
    } else {
      setHistoryFilter('');
    }
  }, [selectedDatabase, selectedContainer]);


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
      if ((e.metaKey || e.ctrlKey) && e.shiftKey && e.key.toLowerCase() === 'e') {
        e.preventDefault();
        sidebarRef.current?.focus();
      }
    };
    window.addEventListener('keydown', handleWindowKeyDown);
    return () => window.removeEventListener('keydown', handleWindowKeyDown);
  }, []);

  // Global Cmd+, listener to toggle settings
  React.useEffect(() => {
    const handleWindowKeyDown = (e: KeyboardEvent) => {
      if ((e.metaKey || e.ctrlKey) && e.key === ',') {
        e.preventDefault();
        setIsSettingsOpen(prev => !prev);
      }
    };
    window.addEventListener('keydown', handleWindowKeyDown);
    return () => window.removeEventListener('keydown', handleWindowKeyDown);
  }, []);

  const flatItems = React.useMemo(() => {
    const items: { type: 'db' | 'container' | 'history' | 'filter'; id: string; parentId?: string; data?: HistoryItem }[] = [];
    databases.forEach(db => {
      items.push({ type: 'db', id: db });
      if (selectedDatabase === db && containers[db]) {
        containers[db].forEach(c => {
          items.push({ type: 'container', id: c, parentId: db });
        });
      }
    });

    const filteredHistory = historyFilter
      ? history.filter(h => `${h.databaseId}/${h.containerId}` === historyFilter)
      : history;

    if (history.length > 0) {
      items.push({ type: 'filter', id: 'history-filter-ddl' });
    }

    if (filteredHistory.length > 0) {
      filteredHistory.forEach(h => {
        const hId = `hist-${h.timestamp}-${h.query.substring(0, 10)}`;
        items.push({ type: 'history', id: hId, data: h });
      });
    }

    return items;
  }, [databases, selectedDatabase, containers, history, historyFilter]);

  const handleKeyDown = (e: React.KeyboardEvent) => {
    if (flatItems.length === 0) return;
    const currentIndex = flatItems.findIndex(i => i.id === focusedId);
    // If nothing focused, start at 0
    const idx = currentIndex === -1 ? 0 : currentIndex;

    switch (e.key) {
      case 'ArrowDown':
      case 'j': {
        e.preventDefault();
        const next = Math.min(flatItems.length - 1, idx + 1);
        setFocusedId(flatItems[next].id);
        break;
      }
      case 'ArrowUp':
      case 'k': {
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
          } else if (item.type === 'history' && item.data) {
            onCopyHistory(item.data);
          } else if (item.type === 'filter') {
            historyFilterRef.current?.focus();
          } else {
            // Select collection (and thus load query editor)
            if (item.parentId) {
              onSelectContainer(item.parentId, item.id);
            }
          }
        }
        break;
      }
      case 'Delete':
      case 'Backspace': {
        e.preventDefault();
        const item = flatItems[idx];
        if (item && item.type === 'history' && item.data) {
          onDeleteHistory(item.data);
        }
        break;
      }
      case 'ArrowRight':
      case 'l': {
        e.preventDefault();
        const item = flatItems[idx];
        if (item && item.type === 'db' && selectedDatabase !== item.id) {
          onSelectDatabase(item.id); // Expand
        }
        break;
      }
      case 'ArrowLeft':
      case 'h': {
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

  const handleFilterKeyDown = (e: React.KeyboardEvent) => {
    if (e.key === 'Tab' && !e.shiftKey) {
      e.preventDefault();
      // Find first history item
      if (history.length > 0) {
        // If we have items, focus the list. 
        // We might want to set focusedId to the first history item if specifically needed,
        // but just focusing the sidebarRef is usually enough if it maintains state, 
        // however, let's explicitely set focus to first visible history item if possible.
        const firstHistory = flatItems.find(i => i.type === 'history');
        if (firstHistory) {
          setFocusedId(firstHistory.id);
        }
        sidebarRef.current?.focus();
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

  // Settings focus management
  const [menuView, setMenuView] = React.useState<'main' | 'theme'>('main');
  const menuItemsRef = React.useRef<(HTMLButtonElement | null)[]>([]);
  const settingsBtnRef = React.useRef<HTMLButtonElement>(null);

  // Reset menu view when closed
  React.useEffect(() => {
    if (!isSettingsOpen) {
      const timer = setTimeout(() => {
        setMenuView('main');
      }, 200); // Delay reset slightly to allow exit animation if we had one and to avoid flash
      return () => clearTimeout(timer);
    }
  }, [isSettingsOpen]);

  React.useEffect(() => {
    if (isSettingsOpen) {
      // Use explicit timeout to ensure DOM is ready and painting
      const timer = setTimeout(() => {

        if (menuView === 'main') {
          // Focus first item
          menuItemsRef.current[0]?.focus();
        } else if (menuView === 'theme') {
          // Focus currently selected theme or first item
          // Indices in theme view: 0=Back, 1=Light, 2=Dark, 3=System
          // Map theme to index
          const map: Record<string, number> = { 'light': 1, 'dark': 2, 'system': 3 };
          const idx = map[theme] || 1;
          menuItemsRef.current[idx]?.focus();
        }
      }, 50);
      return () => clearTimeout(timer);
    } else {
      // Return focus to toggle button when closed
      if (settingsBtnRef.current) {
        settingsBtnRef.current.focus();
      }
    }
  }, [isSettingsOpen, menuView]);

  const handleMenuKeyDown = (e: React.KeyboardEvent, index: number, totalItems: number) => {
    if (e.key === 'ArrowDown') {
      e.preventDefault();
      e.stopPropagation();
      const nextIndex = (index + 1) % totalItems;
      menuItemsRef.current[nextIndex]?.focus();
    } else if (e.key === 'ArrowUp') {
      e.preventDefault();
      e.stopPropagation();
      const prevIndex = (index - 1 + totalItems) % totalItems;
      menuItemsRef.current[prevIndex]?.focus();
    } else if (e.key === 'Escape') {
      e.preventDefault();
      e.stopPropagation();
      if (menuView === 'theme') {
        setMenuView('main');
      } else {
        setIsSettingsOpen(false);
      }
    }
  };

  const handleToggleKeyDown = (e: React.KeyboardEvent) => {
    if (e.key === 'ArrowDown' || e.key === 'Enter' || e.key === ' ') {
      e.preventDefault();
      setIsSettingsOpen(true);
    }
  };

  const handleThemeSelect = (newTheme: 'light' | 'dark' | 'system') => {
    setTheme(newTheme);
    setIsSettingsOpen(false);
  };



  return (
    <div className="sidebar-content">
      <div className="sidebar-header">
        <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
          <div className="settings-container" ref={settingsRef}>
            <button
              className={`settings-btn ${isSettingsOpen ? 'active' : ''}`}
              onClick={() => {
                setIsSettingsOpen(!isSettingsOpen);
                setMenuView('main');
              }}
              title="Menu"
              ref={settingsBtnRef}
              onKeyDown={handleToggleKeyDown}
            >
              ☰
            </button>
            {isSettingsOpen && (
              <div className="settings-dropdown">
                {menuView === 'main' ? (
                  <>
                    <button
                      ref={(el) => (menuItemsRef.current[0] = el)}
                      className="menu-item"
                      onClick={() => {
                        onChangeConnection();
                        setIsSettingsOpen(false);
                      }}
                      onKeyDown={(e) => handleMenuKeyDown(e, 0, 5)}
                    >
                      Account...
                    </button>

                    <div className="menu-separator"></div>

                    <button
                      ref={(el) => (menuItemsRef.current[1] = el)}
                      className="menu-item"
                      onClick={() => {
                        setMenuView('theme');
                        // Focus will be handled by useEffect when view changes
                      }}
                      onKeyDown={(e) => {
                        if (e.key === 'ArrowRight' || e.key === 'Enter') {
                          e.preventDefault();
                          setMenuView('theme');
                        } else {
                          handleMenuKeyDown(e, 1, 5);
                        }
                      }}
                      style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}
                    >
                      <span>Theme</span>
                      <span>›</span>
                    </button>

                    <div className="menu-separator"></div>

                    <button
                      ref={(el) => (menuItemsRef.current[2] = el)}
                      className="menu-item"
                      onClick={() => {
                        window.ipcRenderer.invoke('storage:showHistoryFile');
                        setIsSettingsOpen(false);
                      }}
                      onKeyDown={(e) => handleMenuKeyDown(e, 2, 5)}
                    >
                      View History File...
                    </button>

                    <button
                      ref={(el) => (menuItemsRef.current[3] = el)}
                      className="menu-item"
                      onClick={() => {
                        window.ipcRenderer.invoke('storage:showConnectionsFile');
                        setIsSettingsOpen(false);
                      }}
                      onKeyDown={(e) => handleMenuKeyDown(e, 3, 5)}
                    >
                      View Connections File...
                    </button>

                    <div className="menu-separator"></div>

                    <button
                      ref={(el) => (menuItemsRef.current[4] = el)}
                      className="menu-item"
                      onClick={() => {
                        window.ipcRenderer.send('app:quit');
                        setIsSettingsOpen(false);
                      }}
                      onKeyDown={(e) => handleMenuKeyDown(e, 4, 5)}
                    >
                      Quit Cmd-Q
                    </button>
                  </>
                ) : (
                  <>
                    <button
                      ref={(el) => (menuItemsRef.current[0] = el)}
                      className="menu-item"
                      onClick={() => setMenuView('main')}
                      onKeyDown={(e) => {
                        if (e.key === 'ArrowLeft') {
                          e.preventDefault();
                          setMenuView('main');
                        } else {
                          handleMenuKeyDown(e, 0, 4);
                        }
                      }}
                      style={{ color: 'var(--text-secondary)', fontSize: '0.85em', borderBottom: '1px solid var(--border-color)', marginBottom: '4px' }}
                    >
                      ‹ Back
                    </button>

                    <div className="theme-options">
                      <button
                        ref={(el) => (menuItemsRef.current[1] = el)}
                        className={`menu-item ${theme === 'light' ? 'active' : ''}`}
                        onClick={() => handleThemeSelect('light')}
                        onKeyDown={(e) => {
                          if (e.key === 'ArrowLeft') {
                            e.preventDefault();
                            setMenuView('main');
                          } else {
                            handleMenuKeyDown(e, 1, 4);
                          }
                        }}
                      >
                        ☀️ Light
                      </button>
                      <button
                        ref={(el) => (menuItemsRef.current[2] = el)}
                        className={`menu-item ${theme === 'dark' ? 'active' : ''}`}
                        onClick={() => handleThemeSelect('dark')}
                        onKeyDown={(e) => {
                          if (e.key === 'ArrowLeft') {
                            e.preventDefault();
                            setMenuView('main');
                          } else {
                            handleMenuKeyDown(e, 2, 4);
                          }
                        }}
                      >
                        🌙 Dark
                      </button>
                      <button
                        ref={(el) => (menuItemsRef.current[3] = el)}
                        className={`menu-item ${theme === 'system' ? 'active' : ''}`}
                        onClick={() => handleThemeSelect('system')}
                        onKeyDown={(e) => {
                          if (e.key === 'ArrowLeft') {
                            e.preventDefault();
                            setMenuView('main');
                          } else {
                            handleMenuKeyDown(e, 3, 4);
                          }
                        }}
                      >
                        💻 System
                      </button>
                    </div>
                  </>
                )}
              </div>
            )}
          </div>
          <h2 title={`${accountName}\nFocus Sidebar (Cmd+Shift+E)`}>
            {accountName}
          </h2>
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
                    onClick={() => onSelectContainer(db, container)}
                  >
                    📄 {container}
                  </div>
                ))}
              </div>
            )}
          </div>
        ))}

        {history.length > 0 && (
          <div className="history-section">
            <div className="history-header">
              <select
                ref={historyFilterRef}
                className={`history-filter-select ${focusedId === 'history-filter-ddl' ? 'focused' : ''}`}
                value={historyFilter}
                onChange={(e) => setHistoryFilter(e.target.value)}
                onKeyDown={handleFilterKeyDown}
                title="Filter history by Database/Container (Space to change)"
              >
                <option value="">History (All)</option>
                {Array.from(new Set(history.map(h => `${h.databaseId}/${h.containerId}`))).sort().map(val => (
                  <option key={val} value={val}>{val}</option>
                ))}
              </select>
            </div>
            {flatItems.filter(i => i.type === 'history').map(item => {
              const h = item.data!;
              return (
                <div
                  key={item.id}
                  className={`nav-item history-item ${focusedId === item.id ? 'focused' : ''}`}
                  onClick={() => onSelectHistory(h)}
                  title={`${h.query}\n${new Date(h.timestamp).toLocaleString()}\n(Enter to copy, Delete to remove)`}
                >
                  <div className="history-query-text">{h.query}</div>
                  <div className="history-meta">{h.databaseId}/{h.containerId}</div>
                  <div className="history-actions">
                    <button
                      className="history-action-btn"
                      onClick={(e) => {
                        e.stopPropagation();
                        onCopyHistory(h);
                      }}
                      title="Copy to Query Editor"
                    >
                      📋
                    </button>
                    <button
                      className="history-action-btn delete"
                      onClick={(e) => {
                        e.stopPropagation();
                        onDeleteHistory(h);
                      }}
                      title="Delete from History"
                    >
                      🗑️
                    </button>
                  </div>
                </div>
              );
            })}
          </div>
        )}
      </nav>
    </div>
  );
};
