
import React, { useState, useEffect, useRef } from 'react';
import { X, Check } from 'lucide-react';
import './FollowLinkDialog.css'; // Reusing modal styles if possible, or create new one

interface TranslationDialogProps {
    onClose: () => void;
    onConfirm: (translation: string) => void;
    propertyPath: string;
    value: any;
    currentTranslation?: string;
}

export const TranslationDialog: React.FC<TranslationDialogProps> = ({
    onClose,
    onConfirm,
    propertyPath,
    value,
    currentTranslation = ''
}) => {
    const [translation, setTranslation] = useState(currentTranslation);
    const dialogRef = useRef<HTMLDivElement>(null);
    const inputRef = useRef<HTMLInputElement>(null);

    const valueDisplay = typeof value === 'string' ? `"${value}"` : String(value);

    useEffect(() => {
        const previouslyFocusedElement = document.activeElement as HTMLElement;
        const timer = setTimeout(() => {
            inputRef.current?.focus();
            inputRef.current?.select();
        }, 100);

        const handleKeyDown = (e: KeyboardEvent) => {
            if (e.key === 'Escape') {
                onClose();
            }
        };

        window.addEventListener('keydown', handleKeyDown);
        return () => {
            clearTimeout(timer);
            window.removeEventListener('keydown', handleKeyDown);
            if (previouslyFocusedElement && typeof previouslyFocusedElement.focus === 'function') {
                previouslyFocusedElement.focus();
            }
        };
    }, [onClose]);

    const handleConfirm = (e: React.FormEvent) => {
        e.preventDefault();
        onConfirm(translation);
    };

    return (
        <div className="modal-overlay">
            <div className="follow-link-dialog" ref={dialogRef} style={{ maxWidth: '400px' }}>
                <div className="dialog-header">
                    <h3>Value Translation</h3>
                    <button className="close-btn" onClick={onClose} title="Close (Esc)"><X size={18} /></button>
                </div>
                <form onSubmit={handleConfirm}>
                    <div className="dialog-body">
                        <p className="description">
                            Define a display label for: <br />
                            <code>{propertyPath}</code> = <code>{valueDisplay}</code>
                        </p>

                        <div className="form-group">
                            <label>Display Label</label>
                            <input
                                ref={inputRef}
                                type="text"
                                value={translation}
                                onChange={(e) => setTranslation(e.target.value)}
                                placeholder="e.g. user, active, high, etc."
                            />
                            <span className="help-text">
                                The value will be displayed as: <code>{valueDisplay} <span style={{ color: 'var(--text-secondary)' }}>({translation || 'label'})</span></code>
                            </span>
                        </div>
                    </div>
                    <div className="dialog-footer">
                        <button type="button" className="secondary-btn" onClick={onClose}>Cancel</button>
                        <button type="submit" className="primary-btn">
                            <Check size={16} />
                            Save Translation
                        </button>
                    </div>
                </form>
            </div>
        </div>
    );
};
