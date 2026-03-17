// @vitest-environment jsdom
import { describe, it, expect, vi, beforeEach } from 'vitest';
import { render, screen, fireEvent, waitFor } from '@testing-library/react';
import { EditDocumentDialog } from './EditDocumentDialog';

// Mock PrismJS and simple-code-editor to avoid complex DOM setups and Prism CSS errors in jsdom
vi.mock('react-simple-code-editor', () => ({
    default: ({ value, onValueChange, className, textareaClassName }: any) => (
        <textarea
            className={`${className} ${textareaClassName}`}
            value={value}
            data-testid="mock-editor"
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

// Mock ipcRenderer for keyboard shortcuts simulation
const mockIpcOn = vi.fn();
const mockIpcOff = vi.fn();
(window as any).ipcRenderer = {
    on: mockIpcOn,
    off: mockIpcOff,
    invoke: vi.fn()
};

describe('EditDocumentDialog', () => {
    const mockOnClose = vi.fn();
    const mockOnSave = vi.fn();
    const mockOnDelete = vi.fn();
    
    const sampleDoc = { id: 'doc1', name: 'Test Document' };

    beforeEach(() => {
        vi.clearAllMocks();
    });

    it('renders document JSON correctly in editor', () => {
        render(<EditDocumentDialog document={sampleDoc} onClose={mockOnClose} onSave={mockOnSave} />);
        
        const editor = screen.getByTestId('mock-editor') as HTMLTextAreaElement;
        expect(editor.value).toContain('"id": "doc1"');
        expect(editor.value).toContain('"name": "Test Document"');
    });

    it('calls onSave with modified document', async () => {
        render(<EditDocumentDialog document={sampleDoc} onClose={mockOnClose} onSave={mockOnSave} />);
        
        const editor = screen.getByTestId('mock-editor');
        const updatedJson = JSON.stringify({ id: 'doc1', name: 'Updated Name', newProp: true });
        
        fireEvent.change(editor, { target: { value: updatedJson } });
        
        const saveBtn = screen.getByRole('button', { name: /Save Document/i });
        fireEvent.click(saveBtn);
        
        await waitFor(() => {
            expect(mockOnSave).toHaveBeenCalledWith({ id: 'doc1', name: 'Updated Name', newProp: true });
        });
    });

    it('shows error banner if JSON is invalid on save', async () => {
        render(<EditDocumentDialog document={sampleDoc} onClose={mockOnClose} onSave={mockOnSave} />);
        
        const editor = screen.getByTestId('mock-editor');
        fireEvent.change(editor, { target: { value: '{ invalid: json }' } });
        
        const saveBtn = screen.getByRole('button', { name: /Save Document/i });
        fireEvent.click(saveBtn);
        
        expect(mockOnSave).not.toHaveBeenCalled();
        
        await waitFor(() => {
            expect(screen.getByText(/Expected property name/)).toBeInTheDocument();
        });
    });

    it('calls onDelete if delete button clicked and confirmed', async () => {
        // Mock window.confirm to return true
        vi.spyOn(window, 'confirm').mockImplementation(() => true);
        
        render(<EditDocumentDialog document={sampleDoc} onClose={mockOnClose} onSave={mockOnSave} onDelete={mockOnDelete} />);
        
        const deleteBtn = screen.getByTitle(/Delete this document/i);
        fireEvent.click(deleteBtn);
        
        await waitFor(() => {
            expect(mockOnDelete).toHaveBeenCalledWith(sampleDoc);
        });
    });

    it('listens to menu:save IPC event', () => {
        render(<EditDocumentDialog document={sampleDoc} onClose={mockOnClose} onSave={mockOnSave} />);
        
        expect(mockIpcOn).toHaveBeenCalledWith('menu:save', expect.any(Function));
    });
});
