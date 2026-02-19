
import React, { useState, useEffect } from 'react';
import { X, Save, AlertCircle } from 'lucide-react';
import Editor from 'react-simple-code-editor';
import Prism from 'prismjs';
import 'prismjs/components/prism-json';
import './ModalDialog.css';
import './ResultsView.css';

interface EditDocumentDialogProps {
    onClose: () => void;
    onSave: (document: any) => Promise<void>;
    document: any;
}

export const EditDocumentDialog: React.FC<EditDocumentDialogProps> = ({
    onClose,
    onSave,
    document: initialDocument
}) => {
    const [json, setJson] = useState(JSON.stringify(initialDocument, null, 2));
    const [error, setError] = useState<string | null>(null);
    const [isSaving, setIsSaving] = useState(false);

    const saveHandlerRef = React.useRef<() => void>();

    // Update the ref on every render to ensure it always captures the latest state
    saveHandlerRef.current = () => {
        if (!isSaving) {
            handleSave();
        }
    };

    useEffect(() => {
        const previouslyFocusedElement = document.activeElement as HTMLElement;

        // Focus the editor when dialog opens
        const focusTimer = setTimeout(() => {
            const textarea = document.querySelector('.json-editor') as HTMLTextAreaElement;
            if (textarea) {
                textarea.focus();
            }
        }, 50);

        const handleKeyDown = (e: KeyboardEvent) => {
            if (e.key === 'Escape' && !isSaving) {
                onClose();
            }
            // Cmd+S or Ctrl+S to save
            if ((e.metaKey || e.ctrlKey) && e.code === 'KeyS') {
                e.preventDefault();
                e.stopPropagation();
                saveHandlerRef.current?.();
            }
            // Alt shortcuts (Mac-safe using e.code)
            if (e.altKey && !e.metaKey && !e.ctrlKey) {
                if (e.code === 'KeyS') {
                    e.preventDefault();
                    e.stopPropagation();
                    saveHandlerRef.current?.();
                } else if (e.code === 'KeyC') {
                    e.preventDefault();
                    e.stopPropagation();
                    onClose();
                }
            }
        };

        const handleIpcSave = () => {
            console.log('[Dialog] menu:save received');
            if (saveHandlerRef.current) {
                saveHandlerRef.current();
            }
        };

        window.addEventListener('keydown', handleKeyDown, { capture: true });
        window.ipcRenderer.on('menu:save', handleIpcSave);

        return () => {
            clearTimeout(focusTimer);
            window.removeEventListener('keydown', handleKeyDown, { capture: true });
            window.ipcRenderer.off('menu:save', handleIpcSave);
            if (previouslyFocusedElement && typeof previouslyFocusedElement.focus === 'function') {
                previouslyFocusedElement.focus();
            }
        };
    }, [onClose]); // isSaving removed from deps to prevent listener thrashing; we use ref inside the listener.

    const handleSave = async () => {
        try {
            const parsed = JSON.parse(json);
            setIsSaving(true);
            setError(null);
            await onSave(parsed);
            onClose();
        } catch (err: any) {
            setError(err.message);
            setIsSaving(false);
        }
    };

    return (
        <div className="modal-overlay">
            <div className="modal-dialog edit-document-dialog" style={{ maxWidth: '800px', width: '90vw', height: '80vh', display: 'flex', flexDirection: 'column' }}>
                <div className="dialog-header">
                    <h3>Edit Document</h3>
                    <button className="close-btn" onClick={onClose} disabled={isSaving} title="Close (Esc)">
                        <X size={18} />
                    </button>
                </div>
                <div className="dialog-body" style={{ flex: 1, overflow: 'hidden', padding: 0, display: 'flex', flexDirection: 'column' }}>
                    {error && (
                        <div className="error-banner" style={{ margin: '8px', padding: '8px', borderRadius: '4px', backgroundColor: 'rgba(255, 77, 77, 0.1)', color: '#ff4d4d', display: 'flex', alignItems: 'center', gap: '8px', border: '1px solid rgba(255, 77, 77, 0.2)' }}>
                            <AlertCircle size={16} />
                            <span>{error}</span>
                        </div>
                    )}
                    <div className="text-view-content-wrapper" style={{ flex: 1, overflow: 'auto', backgroundColor: 'var(--bg-editor)' }}>
                        <Editor
                            value={json}
                            onValueChange={setJson}
                            highlight={(code) => Prism.highlight(code, Prism.languages.json, 'json')}
                            padding={16}
                            className="json-editor-container"
                            textareaClassName="json-editor"
                            spellCheck={false}
                            style={{
                                fontFamily: 'var(--font-mono)',
                                fontSize: 14,
                                minHeight: '100%',
                            }}
                        />
                    </div>
                </div>
                <div className="dialog-footer">
                    <button
                        type="button"
                        className="secondary-btn"
                        onClick={onClose}
                        disabled={isSaving}
                        title="Cancel and close (Alt+C, Esc)"
                    >
                        <span className="shortcut-label"><u>C</u>ancel</span>
                    </button>
                    <button
                        type="button"
                        className="primary-btn"
                        onClick={handleSave}
                        disabled={isSaving}
                        title="Save changes to document (Alt+S, Cmd+S)"
                    >
                        <Save size={16} />
                        <span className="shortcut-label">
                            {isSaving ? 'Saving...' : <><u>S</u>ave Document</>}
                        </span>
                    </button>
                </div>
            </div>
        </div>
    );
};
