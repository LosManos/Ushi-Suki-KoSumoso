// @vitest-environment jsdom
import { describe, it, expect, vi, beforeEach } from 'vitest';
import { render, screen, fireEvent } from '@testing-library/react';
import { ResultsView } from './ResultsView';
import { ThemeProvider } from '../context/ThemeContext';

vi.mock('react-simple-code-editor', () => ({
    default: ({ value, onValueChange }: any) => (
        <textarea
            data-testid="mock-editor"
            value={value}
            onChange={(e) => onValueChange(e.target.value)}
        />
    )
}));

vi.mock('prismjs', () => ({
    default: {
        highlight: vi.fn((code) => code),
        languages: { json: {} }
    }
}));
vi.mock('prismjs/components/prism-json', () => ({}));

describe('ResultsView', () => {
    const defaultProps = {
        results: [{ id: '1', name: 'Alice' }, { id: '2', name: 'Bob' }],
        loading: false,
        onRunQuery: vi.fn(),
        onCancelQuery: vi.fn(),
        pageSize: 50,
        onPageSizeChange: vi.fn(),
    };

    const renderWithContext = (ui: React.ReactElement) => {
        return render(
            <ThemeProvider>
                {ui}
            </ThemeProvider>
        );
    };

    beforeEach(() => {
        vi.clearAllMocks();
        (window as any).ipcRenderer = {
            invoke: vi.fn(),
            send: vi.fn(),
            on: vi.fn(),
            off: vi.fn()
        };
    });

    it('renders the number of results', () => {
        renderWithContext(<ResultsView {...defaultProps} />);
        expect(screen.getByText('2 documents found')).toBeInTheDocument();
    });

    it('displays text view by default and renders json', () => {
        renderWithContext(<ResultsView {...defaultProps} />);
        
        const editor = screen.getByTestId('mock-editor');
        expect(editor).toHaveValue(JSON.stringify(defaultProps.results, null, 2));
    });

    it('calls onRunQuery when Run is clicked', () => {
        renderWithContext(<ResultsView {...defaultProps} />);
        
        const runBtn = screen.getByRole('button', { name: /Run/i });
        fireEvent.click(runBtn);
        
        expect(defaultProps.onRunQuery).toHaveBeenCalled();
    });

    it('calls onCancelQuery when Cancel is clicked and loading is true', () => {
        renderWithContext(<ResultsView {...defaultProps} loading={true} />);
        
        const cancelBtn = screen.getByRole('button', { name: /Cancel/i });
        fireEvent.click(cancelBtn);
        
        expect(defaultProps.onCancelQuery).toHaveBeenCalled();
    });

    it('changes page size', () => {
        renderWithContext(<ResultsView {...defaultProps} />);
        
        const select = screen.getByLabelText(/Rows:/i);
        fireEvent.change(select, { target: { value: '10' } });
        
        expect(defaultProps.onPageSizeChange).toHaveBeenCalledWith(10);
    });

    it('switches views', () => {
        renderWithContext(<ResultsView {...defaultProps} />);
        
        const jsonBtn = screen.getByRole('button', { name: /Hierarchical/i });
        fireEvent.click(jsonBtn);
        
        // Editor shouldn't match test-id when in hierarchical view usually
        // But let's check if the button gets active class
        expect(jsonBtn).toHaveClass('active');
    });

    it('switches to Table view and renders columns and rows', () => {
        renderWithContext(<ResultsView {...defaultProps} />);
        
        const tableBtn = screen.getByRole('button', { name: /Table/i });
        fireEvent.click(tableBtn);
        
        expect(tableBtn).toHaveClass('active');
        
        // Assert table headers exist
        expect(screen.getByText('Actions')).toBeInTheDocument();
        expect(screen.getByText('id')).toBeInTheDocument();
        expect(screen.getByText('name')).toBeInTheDocument();
        
        // Assert table rows display document data
        expect(screen.getByText('Alice')).toBeInTheDocument();
        expect(screen.getByText('Bob')).toBeInTheDocument();
    });

    it('sorts columns when clicking header', () => {
        renderWithContext(<ResultsView {...defaultProps} />);
        
        const tableBtn = screen.getByRole('button', { name: /Table/i });
        fireEvent.click(tableBtn);
        
        const nameHeader = screen.getByText('name');
        
        // By default, Alice should be first, Bob second (order they appear)
        let rows = screen.getAllByRole('row');
        // Index 0 is the header row, Index 1 is Alice, Index 2 is Bob
        expect(rows[1]).toHaveTextContent('Alice');
        expect(rows[2]).toHaveTextContent('Bob');
        
        // Click name header to sort ascending (Alice then Bob)
        fireEvent.click(nameHeader);
        rows = screen.getAllByRole('row');
        expect(rows[1]).toHaveTextContent('Alice');
        expect(rows[2]).toHaveTextContent('Bob');
        
        // Click name header again to toggle to desc
        fireEvent.click(nameHeader);
        rows = screen.getAllByRole('row');
        expect(rows[1]).toHaveTextContent('Bob');
        expect(rows[2]).toHaveTextContent('Alice');
    });
});
