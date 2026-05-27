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
        initialValue: 'admin',
        currentMappings: {}
    };

    beforeEach(() => {
        vi.clearAllMocks();
    });

    it('renders correctly and auto-populates a row for initialValue when mappings are empty', () => {
        render(<TranslationDialog {...defaultProps} />);
        
        expect(screen.getByText('Value Translation')).toBeInTheDocument();
        expect(screen.getByText('user.type')).toBeInTheDocument();
        
        // The first input (Key) should be initialized to the initialValue 'admin'
        const keyInputs = screen.getAllByPlaceholderText('e.g. admin') as HTMLInputElement[];
        expect(keyInputs.length).toBe(1);
        expect(keyInputs[0].value).toBe('admin');

        // The second input (Translation) should be empty
        const transInputs = screen.getAllByPlaceholderText('e.g. Administrator') as HTMLInputElement[];
        expect(transInputs.length).toBe(1);
        expect(transInputs[0].value).toBe('');
    });

    it('renders multiple prefilled translation rules from currentMappings', () => {
        const currentMappings = {
            'admin': 'Administrator',
            'user': 'Normal User',
            'guest': 'Guest Visitor'
        };

        render(<TranslationDialog {...defaultProps} currentMappings={currentMappings} />);
        
        const keyInputs = screen.getAllByPlaceholderText('e.g. admin') as HTMLInputElement[];
        const transInputs = screen.getAllByPlaceholderText('e.g. Administrator') as HTMLInputElement[];

        expect(keyInputs.length).toBe(3);
        expect(transInputs.length).toBe(3);

        expect(keyInputs[0].value).toBe('admin');
        expect(transInputs[0].value).toBe('Administrator');

        expect(keyInputs[1].value).toBe('user');
        expect(transInputs[1].value).toBe('Normal User');

        expect(keyInputs[2].value).toBe('guest');
        expect(transInputs[2].value).toBe('Guest Visitor');
    });

    it('allows adding a new empty translation rule', () => {
        render(<TranslationDialog {...defaultProps} />);
        
        const addBtn = screen.getByRole('button', { name: /Add Translation Rule/i });
        fireEvent.click(addBtn);

        const keyInputs = screen.getAllByPlaceholderText('e.g. admin') as HTMLInputElement[];
        const transInputs = screen.getAllByPlaceholderText('e.g. Administrator') as HTMLInputElement[];

        // Should now have 2 rows
        expect(keyInputs.length).toBe(2);
        expect(transInputs.length).toBe(2);

        // The second row should be completely empty
        expect(keyInputs[1].value).toBe('');
        expect(transInputs[1].value).toBe('');
    });

    it('allows updating keys and translations and calls onConfirm with correct map', () => {
        render(<TranslationDialog {...defaultProps} />);
        
        const keyInputs = screen.getAllByPlaceholderText('e.g. admin') as HTMLInputElement[];
        const transInputs = screen.getAllByPlaceholderText('e.g. Administrator') as HTMLInputElement[];

        // Update first row translation
        fireEvent.change(transInputs[0], { target: { value: 'Super Admin' } });

        // Add a second row and fill it
        const addBtn = screen.getByRole('button', { name: /Add Translation Rule/i });
        fireEvent.click(addBtn);

        const updatedKeyInputs = screen.getAllByPlaceholderText('e.g. admin') as HTMLInputElement[];
        const updatedTransInputs = screen.getAllByPlaceholderText('e.g. Administrator') as HTMLInputElement[];

        fireEvent.change(updatedKeyInputs[1], { target: { value: 'guest' } });
        fireEvent.change(updatedTransInputs[1], { target: { value: 'Guest User' } });

        // Submit form
        const saveBtn = screen.getByRole('button', { name: /OK/i });
        fireEvent.click(saveBtn);

        expect(mockOnConfirm).toHaveBeenCalledWith({
            'admin': 'Super Admin',
            'guest': 'Guest User'
        });
    });

    it('allows deleting a rule', () => {
        const currentMappings = {
            'admin': 'Administrator',
            'user': 'Normal User'
        };

        render(<TranslationDialog {...defaultProps} currentMappings={currentMappings} />);
        
        const deleteButtons = screen.getAllByTitle('Delete translation rule');
        expect(deleteButtons.length).toBe(2);

        // Click delete on the first row ('admin')
        fireEvent.click(deleteButtons[0]);

        const keyInputs = screen.getAllByPlaceholderText('e.g. admin') as HTMLInputElement[];
        expect(keyInputs.length).toBe(1);
        expect(keyInputs[0].value).toBe('user');
    });

    it('prevents saving and shows validation error on duplicate keys', () => {
        const currentMappings = {
            'admin': 'Administrator'
        };

        render(<TranslationDialog {...defaultProps} currentMappings={currentMappings} />);
        
        // Add a second row
        const addBtn = screen.getByRole('button', { name: /Add Translation Rule/i });
        fireEvent.click(addBtn);

        const keyInputs = screen.getAllByPlaceholderText('e.g. admin') as HTMLInputElement[];
        const transInputs = screen.getAllByPlaceholderText('e.g. Administrator') as HTMLInputElement[];

        // Set second row key to 'admin' as well
        fireEvent.change(keyInputs[1], { target: { value: 'admin' } });
        fireEvent.change(transInputs[1], { target: { value: 'Dup Admin' } });

        // Try to submit
        const saveBtn = screen.getByRole('button', { name: /OK/i });
        fireEvent.click(saveBtn);

        // onConfirm should NOT be called
        expect(mockOnConfirm).not.toHaveBeenCalled();

        // Error message should be rendered
        expect(screen.getByText(/Duplicate keys found: "admin"/i)).toBeInTheDocument();
    });

    it('calls onClose when Cancel button is clicked', () => {
        render(<TranslationDialog {...defaultProps} />);
        
        const cancelBtn = screen.getByRole('button', { name: /Cancel/i });
        fireEvent.click(cancelBtn);
        
        expect(mockOnClose).toHaveBeenCalledOnce();
    });

    it('traps keyboard focus within the dialog', () => {
        render(<TranslationDialog {...defaultProps} />);
        
        // Find focusable elements
        const closeBtn = screen.getByTitle('Close (Esc)');
        const okBtn = screen.getByRole('button', { name: /OK/i });

        // Focus the last focusable element
        okBtn.focus();
        expect(document.activeElement).toBe(okBtn);

        // Press Tab (forward tab on last element should cycle focus to first element)
        const tabEvent = new KeyboardEvent('keydown', { key: 'Tab', bubbles: true });
        window.dispatchEvent(tabEvent);
        expect(document.activeElement).toBe(closeBtn);

        // Focus the first focusable element
        closeBtn.focus();
        expect(document.activeElement).toBe(closeBtn);

        // Press Shift+Tab (backward tab on first element should cycle focus to last element)
        const shiftTabEvent = new KeyboardEvent('keydown', { key: 'Tab', shiftKey: true, bubbles: true });
        window.dispatchEvent(shiftTabEvent);
        expect(document.activeElement).toBe(okBtn);
    });
});
