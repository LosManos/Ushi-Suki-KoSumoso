// @vitest-environment jsdom
import { describe, it, expect, vi, beforeEach } from 'vitest';
import { render, screen, fireEvent } from '@testing-library/react';
import { TranslationDialog } from './TranslationDialog';

describe('TranslationDialog', () => {
    const mockOnClose = vi.fn();
    const mockOnConfirm = vi.fn();
    
    const defaultProps = {
        onClose: mockOnClose,
        onConfirm: mockOnConfirm,
        propertyPath: 'user.type',
        value: 'admin',
        currentTranslation: ''
    };

    beforeEach(() => {
        vi.clearAllMocks();
    });

    it('renders correctly with string values', () => {
        render(<TranslationDialog {...defaultProps} />);
        
        expect(screen.getByText('Value Translation')).toBeInTheDocument();
        expect(screen.getByText('user.type')).toBeInTheDocument();
        expect(screen.getAllByText('"admin"').length).toBeGreaterThan(0);
    });

    it('renders correctly with number values', () => {
        render(<TranslationDialog {...defaultProps} value={42} />);
        
        expect(screen.getAllByText('42').length).toBeGreaterThan(0);
    });

    it('initializes input with currentTranslation', () => {
        render(<TranslationDialog {...defaultProps} currentTranslation="Administrator" />);
        
        const input = screen.getByRole('textbox') as HTMLInputElement;
        expect(input.value).toBe('Administrator');
    });

    it('calls onConfirm with the new translation on submit', () => {
        render(<TranslationDialog {...defaultProps} />);
        
        const input = screen.getByRole('textbox');
        fireEvent.change(input, { target: { value: 'Super User' } });
        
        const saveBtn = screen.getByRole('button', { name: /Save Translation/i });
        fireEvent.click(saveBtn);
        
        expect(mockOnConfirm).toHaveBeenCalledWith('Super User');
    });

    it('calls onClose when Cancel button is clicked', () => {
        render(<TranslationDialog {...defaultProps} />);
        
        const cancelBtn = screen.getByRole('button', { name: /Cancel/i });
        fireEvent.click(cancelBtn);
        
        expect(mockOnClose).toHaveBeenCalledOnce();
    });
});
