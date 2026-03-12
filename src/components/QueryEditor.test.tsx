// @vitest-environment jsdom
import { describe, it, expect, vi, beforeEach } from 'vitest';
import { render, screen, fireEvent } from '@testing-library/react';
import { QueryEditor } from './QueryEditor';

vi.mock('react-simple-code-editor', () => ({
    default: ({ value, onValueChange, placeholder }: any) => (
        <textarea
            data-testid="mock-editor"
            value={value}
            onChange={(e) => onValueChange(e.target.value)}
            placeholder={placeholder}
        />
    )
}));

vi.mock('prismjs', () => ({
    default: {
        highlight: vi.fn((code) => code),
        languages: { 
            sql: {},
            insertBefore: vi.fn()
        }
    }
}));
vi.mock('prismjs/components/prism-sql', () => ({}));

describe('QueryEditor', () => {
    const defaultProps = {
        tabs: [
            { id: 'tab1', databaseId: 'db1', containerId: 'Users', query: 'SELECT * FROM c', isDiscovering: false, schemaKeys: ['id', 'name'], results: [], isQuerying: false, pageSize: 15 },
            { id: 'tab2', databaseId: 'db1', containerId: 'Settings', query: 'SELECT * FROM c WHERE c.id = "1"', isDiscovering: false, results: [], isQuerying: false, pageSize: 15 }
        ],
        activeTabId: 'tab1',
        onTabSelect: vi.fn(),
        onTabClose: vi.fn(),
        onRunQuery: vi.fn(),
        onGetDocument: vi.fn(),
        onQueryChange: vi.fn(),
        onDiscoverSchema: vi.fn(),
        cursorPositionRef: { current: 0 }
    };

    const renderWithContext = (ui: React.ReactElement) => {
        return render(ui);
    };

    beforeEach(() => {
        vi.clearAllMocks();
    });

    it('renders tabs correctly', () => {
        renderWithContext(<QueryEditor {...defaultProps} />);
        
        expect(screen.getByText('Users')).toBeInTheDocument();
        expect(screen.getByText('Settings')).toBeInTheDocument();
    });

    it('displays the query for the active tab', () => {
        renderWithContext(<QueryEditor {...defaultProps} />);
        
        const editor = screen.getByTestId('mock-editor');
        expect(editor).toHaveValue('SELECT * FROM c');
    });

    it('calls onTabSelect when a tab is clicked', () => {
        renderWithContext(<QueryEditor {...defaultProps} />);
        
        const settingsTab = screen.getByText('Settings');
        fireEvent.click(settingsTab);
        
        expect(defaultProps.onTabSelect).toHaveBeenCalledWith('tab2');
    });

    it('calls onTabClose when close button is clicked', () => {
        renderWithContext(<QueryEditor {...defaultProps} />);
        
        const closeBtns = screen.getAllByTitle('Close Tab');
        fireEvent.click(closeBtns[0]);
        
        expect(defaultProps.onTabClose).toHaveBeenCalledWith('tab1');
    });

    it('calls onQueryChange when editor content changes', () => {
        renderWithContext(<QueryEditor {...defaultProps} />);
        
        const editor = screen.getByTestId('mock-editor');
        fireEvent.change(editor, { target: { value: 'SELECT TOP 1 * FROM c' } });
        
        expect(defaultProps.onQueryChange).toHaveBeenCalledWith('SELECT TOP 1 * FROM c');
    });

    it('calls onGetDocument when quick lookup is used', () => {
        renderWithContext(<QueryEditor {...defaultProps} />);
        
        const idInput = screen.getByPlaceholderText('Quick ID Lookup...');
        fireEvent.change(idInput, { target: { value: 'user-123' } });
        
        const getBtn = screen.getByRole('button', { name: 'Get' });
        fireEvent.click(getBtn);
        
        expect(defaultProps.onGetDocument).toHaveBeenCalledWith('user-123');
    });
});
