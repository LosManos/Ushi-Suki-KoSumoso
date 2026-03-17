// @vitest-environment jsdom
import { describe, it, expect, vi, beforeEach } from 'vitest';
import { render, screen, fireEvent } from '@testing-library/react';
import { FollowLinkDialog } from './FollowLinkDialog';

describe('FollowLinkDialog', () => {
    const mockOnClose = vi.fn();
    const mockOnConfirm = vi.fn();
    const mockOnDatabaseChange = vi.fn();

    const databases = ['DB1', 'DB2'];
    const containers = {
        'DB1': ['Users', 'Settings'],
        'DB2': ['Logs', 'Archived']
    };

    const defaultProps = {
        databases,
        containers,
        onClose: mockOnClose,
        onConfirm: mockOnConfirm,
        currentDbId: 'DB1',
        currentContainerId: 'Users',
        selectedValue: 'user-123',
        onDatabaseChange: mockOnDatabaseChange
    };

    beforeEach(() => {
        vi.clearAllMocks();
    });

    it('renders with initial values from props', () => {
        render(<FollowLinkDialog {...defaultProps} />);
        
        const stringPreviewRegex = new RegExp('user-123');
        expect(screen.getAllByText(stringPreviewRegex).length).toBeGreaterThan(0);

        const dbSelect = screen.getByRole('combobox', { name: /Database/i }) as HTMLSelectElement;
        const containerSelect = screen.getByRole('combobox', { name: /Container/i }) as HTMLSelectElement;
        const propInput = screen.getByRole('textbox', { name: /Target Property Name/i }) as HTMLInputElement;

        expect(dbSelect.value).toBe('DB1');
        expect(containerSelect.value).toBe('Users');
        expect(propInput.value).toBe('id'); // Default property name
    });

    it('uses suggested linking defaults if provided', () => {
        const suggested = { targetDb: 'DB2', targetContainer: 'Logs', targetPropertyName: '_id' };
        render(<FollowLinkDialog {...defaultProps} suggestedMapping={suggested} />);

        const dbSelect = screen.getByRole('combobox', { name: /Database/i }) as HTMLSelectElement;
        const containerSelect = screen.getByRole('combobox', { name: /Container/i }) as HTMLSelectElement;
        const propInput = screen.getByRole('textbox', { name: /Target Property Name/i }) as HTMLInputElement;

        expect(dbSelect.value).toBe('DB2');
        expect(containerSelect.value).toBe('Logs');
        expect(propInput.value).toBe('_id');
    });

    it('changes container options when DB changes', () => {
        render(<FollowLinkDialog {...defaultProps} />);

        const dbSelect = screen.getByRole('combobox', { name: /Database/i });
        
        fireEvent.change(dbSelect, { target: { value: 'DB2' } });

        expect(mockOnDatabaseChange).toHaveBeenCalledWith('DB2');
        
        const containerSelect = screen.getByRole('combobox', { name: /Container/i }) as HTMLSelectElement;
        expect(containerSelect.value).toBe('Logs'); // Auto-selected the first container of DB2
    });

    it('submits correct values when confirming', () => {
        render(<FollowLinkDialog {...defaultProps} />);

        const propInput = screen.getByRole('textbox', { name: /Target Property Name/i });
        fireEvent.change(propInput, { target: { value: 'userId' } });

        const followBtn = screen.getByRole('button', { name: /Follow Link/i });
        fireEvent.click(followBtn);

        expect(mockOnConfirm).toHaveBeenCalledWith('DB1', 'Users', 'userId');
    });
});
