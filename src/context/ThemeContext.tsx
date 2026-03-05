import React, { createContext, useContext, useEffect, useState } from 'react';
import {
    type ThemeName,
    type ThemeMode,
    type ResolvedMode,
    applyThemeToDocument,
} from '../themes/index';

// ── Context shape ─────────────────────────────────────────────────────────────

interface ThemeContextType {
    /** Which colour palette is active */
    colorScheme: ThemeName;
    /** The user-selected mode (may be 'system') */
    mode: ThemeMode;
    /** The actual resolved mode — never 'system' */
    resolvedMode: ResolvedMode;
    setColorScheme: (scheme: ThemeName) => void;
    setMode: (mode: ThemeMode) => void;

    // ── Legacy aliases so existing consumers (ResultsView etc.) keep working ──
    /** @deprecated use `mode` */
    theme: ThemeMode;
    /** @deprecated use `resolvedMode` */
    resolvedTheme: ResolvedMode;
    /** @deprecated use `setMode` */
    setTheme: (mode: ThemeMode) => void;
}

// ── Defaults ──────────────────────────────────────────────────────────────────

const DEFAULT_SCHEME: ThemeName = 'ushi';
const DEFAULT_MODE: ThemeMode = 'system';

// ── Context ───────────────────────────────────────────────────────────────────

const ThemeContext = createContext<ThemeContextType | undefined>(undefined);

// ── Provider ──────────────────────────────────────────────────────────────────

export const ThemeProvider: React.FC<{ children: React.ReactNode }> = ({ children }) => {
    const [colorScheme, setColorSchemeState] = useState<ThemeName>(() => {
        const saved = localStorage.getItem('theme-scheme');
        return (saved as ThemeName) || DEFAULT_SCHEME;
    });

    const [mode, setModeState] = useState<ThemeMode>(() => {
        // Support old key 'theme' for backwards compat
        const saved = localStorage.getItem('theme-mode') || localStorage.getItem('theme');
        return (saved as ThemeMode) || DEFAULT_MODE;
    });

    const [resolvedMode, setResolvedMode] = useState<ResolvedMode>('dark');

    // Apply theme whenever scheme or mode changes
    useEffect(() => {
        const resolve = (): ResolvedMode => {
            if (mode === 'system') {
                return window.matchMedia('(prefers-color-scheme: dark)').matches ? 'dark' : 'light';
            }
            return mode;
        };

        const apply = () => {
            const resolved = resolve();
            setResolvedMode(resolved);
            applyThemeToDocument(colorScheme, resolved);
        };

        apply();

        // React to OS-level dark/light changes when mode === 'system'
        const mq = window.matchMedia('(prefers-color-scheme: dark)');
        const onSystemChange = () => { if (mode === 'system') apply(); };
        mq.addEventListener('change', onSystemChange);
        return () => mq.removeEventListener('change', onSystemChange);
    }, [colorScheme, mode]);

    const setColorScheme = (scheme: ThemeName) => {
        setColorSchemeState(scheme);
        localStorage.setItem('theme-scheme', scheme);
    };

    const setMode = (newMode: ThemeMode) => {
        setModeState(newMode);
        localStorage.setItem('theme-mode', newMode);
        // Clean up old key if present
        localStorage.removeItem('theme');
    };

    const value: ThemeContextType = {
        colorScheme,
        mode,
        resolvedMode,
        setColorScheme,
        setMode,
        // Legacy aliases
        theme: mode,
        resolvedTheme: resolvedMode,
        setTheme: setMode,
    };

    return (
        <ThemeContext.Provider value={value}>
            {children}
        </ThemeContext.Provider>
    );
};

// ── Hook ──────────────────────────────────────────────────────────────────────

export const useTheme = () => {
    const context = useContext(ThemeContext);
    if (!context) {
        throw new Error('useTheme must be used within a ThemeProvider');
    }
    return context;
};
