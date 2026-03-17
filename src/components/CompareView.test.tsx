// @vitest-environment jsdom
import { describe, it, expect, vi, beforeEach } from 'vitest';
import { render, screen, fireEvent } from '@testing-library/react';
import { CompareView } from './CompareView';

describe('CompareView', () => {
    const defaultProps = {
        documents: [
            { id: '1', name: 'Original', nested: { a: 1 } },
            { id: '2', name: 'Updated', nested: { a: 2 } }
        ]
    };

    beforeEach(() => {
        vi.clearAllMocks();
    });

    it('renders the header and mode selector', () => {
        render(<CompareView {...defaultProps} />);
        
        expect(screen.getByText('Document Comparison')).toBeInTheDocument();
        
        const modeButton = screen.getByRole('button', { name: /Line-by-Line/i });
        expect(modeButton).toBeInTheDocument();
    });

    it('switches diff modes', () => {
        render(<CompareView {...defaultProps} />);
        
        const modeButton = screen.getByRole('button', { name: /Line-by-Line/i });
        fireEvent.click(modeButton);
        
        const semanticOption = screen.getByText('Semantic (JSON)');
        fireEvent.click(semanticOption);
        
        expect(screen.getByRole('button', { name: /Semantic \(JSON\)/i })).toBeInTheDocument();
    });

    it('toggles sync scroll and difference only checkboxes', () => {
        render(<CompareView {...defaultProps} />);
        
        const diffOnlyCheckbox = screen.getByLabelText(/Show Differences Only/i);
        expect(diffOnlyCheckbox).not.toBeChecked();
        
        fireEvent.click(diffOnlyCheckbox);
        expect(diffOnlyCheckbox).toBeChecked();
        
        const syncCheckbox = screen.getByLabelText(/Sync Scroll/i);
        expect(syncCheckbox).toBeChecked(); // Default true
        
        fireEvent.click(syncCheckbox);
        expect(syncCheckbox).not.toBeChecked();
    });

    it('renders lines for documents', () => {
        render(<CompareView {...defaultProps} />);
        
        // Both documents should be rendered in different panes
        // Note: The UI renders multiple panes via mapping 'documents'
        const docPanes = screen.getAllByText(/"Original"/i);
        expect(docPanes.length).toBeGreaterThan(0);
        
        const updatedPanes = screen.getAllByText(/"Updated"/i);
        expect(updatedPanes.length).toBeGreaterThan(0);
    });
});
