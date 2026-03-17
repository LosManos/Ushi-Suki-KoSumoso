// @vitest-environment jsdom
import { describe, it, expect, vi, beforeEach } from 'vitest';
import { render, screen, fireEvent } from '@testing-library/react';
import { Sidebar } from './Sidebar';
import { ThemeProvider } from '../context/ThemeContext';

describe('Sidebar', () => {
    const defaultProps = {
        databases: ['db1', 'db2'],
        selectedDatabase: null,
        selectedContainer: null,
        onSelectDatabase: vi.fn(),
        onSelectContainer: vi.fn(),
        containers: {
            'db1': ['containerA', 'containerB'],
            'db2': ['containerC']
        },
        onChangeConnection: vi.fn(),
        onOpenCommandPalette: vi.fn(),
        history: [],
        onSelectHistory: vi.fn(),
        onCopyHistory: vi.fn(),
        onDeleteHistory: vi.fn(),
        onShowChangelog: vi.fn()
    };

    beforeEach(() => {
        vi.clearAllMocks();
        // Mock ipcRenderer for app:getVersion
        (window as any).ipcRenderer = {
            invoke: vi.fn().mockResolvedValue('0.2.1'),
            send: vi.fn(),
            on: vi.fn(),
            off: vi.fn()
        };
    });

    const renderWithContext = (ui: React.ReactElement) => {
        return render(
            <ThemeProvider>
                {ui}
            </ThemeProvider>
        );
    };

    it('renders databases and allows expansion', () => {
        renderWithContext(<Sidebar {...defaultProps} />);
        
        const db1 = screen.getByText('db1');
        const db2 = screen.getByText('db2');
        expect(db1).toBeInTheDocument();
        expect(db2).toBeInTheDocument();
        
        // Containers should not be visible before expanding
        expect(screen.queryByText('containerA')).not.toBeInTheDocument();
        
        // Click to expand db1
        fireEvent.click(db1);
        expect(defaultProps.onSelectDatabase).toHaveBeenCalledWith('db1');
    });

    it('renders containers when a database is selected', () => {
        renderWithContext(<Sidebar {...defaultProps} selectedDatabase="db1" />);
        
        const containerA = screen.getByText('containerA');
        const containerB = screen.getByText('containerB');
        expect(containerA).toBeInTheDocument();
        expect(containerB).toBeInTheDocument();
        
        // Click container
        fireEvent.click(containerA);
        expect(defaultProps.onSelectContainer).toHaveBeenCalledWith('db1', 'containerA');
    });

    it('opens settings dropdown', () => {
        renderWithContext(<Sidebar {...defaultProps} />);
        
        const settingsBtn = screen.getByTitle('Menu (Cmd+,)');
        fireEvent.click(settingsBtn);
        
        // Text nodes are split by <u> tags for shortcuts, e.g. <u>A</u>ccount
        const menuItems = screen.getAllByRole('button');
        expect(menuItems.some(btn => btn.textContent?.includes('Account'))).toBe(true);
        expect(menuItems.some(btn => btn.textContent?.includes('Theme'))).toBe(true);
        expect(menuItems.some(btn => btn.textContent?.includes('Changelog'))).toBe(true);
    });
});
