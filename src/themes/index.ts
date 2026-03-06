// ─── Theme System ───────────────────────────────────────────────────────────
// Add new themes by:
//  1. Creating src/themes/<name>.ts that exports a ThemeDefinition
//  2. Adding it to the `themes` map below
// ─────────────────────────────────────────────────────────────────────────────

import { ushiTheme } from './ushi';
import { legoTheme } from './lego';
import { barbieTheme } from './barbie';
import { battleshipTheme } from './battleship';

// ── Primitive types ───────────────────────────────────────────────────────────

export type ThemeName = 'ushi' | 'lego' | 'barbie' | 'battleship';
export type ThemeMode = 'light' | 'dark' | 'system';
export type ResolvedMode = 'light' | 'dark';

// ── Token shape ───────────────────────────────────────────────────────────────
// These map 1-to-1 with the CSS custom properties consumed by the app.

export interface ThemeTokens {
    bgPrimary: string;
    bgSecondary: string;
    bgTertiary: string;
    textPrimary: string;
    textSecondary: string;
    borderColor: string;
    inputBg: string;
    inputBorder: string;
    buttonHoverBg: string;
    accentColor: string;
    accentHover: string;
    scrollbarTrack: string;
    scrollbarThumb: string;
    scrollbarThumbHover: string;
    // Syntax highlighting
    shComment: string;
    shString: string;
    shKeyword: string;
    shNumber: string;
    shFunction: string;
}

// ── Per-theme definition ──────────────────────────────────────────────────────

export interface ThemeDefinition {
    /** Display name shown in the UI */
    name: string;
    /** Emoji used as a visual swatch/icon in the picker */
    emoji: string;
    dark: ThemeTokens;
    light: ThemeTokens;
}

// ── Registry ──────────────────────────────────────────────────────────────────

export const themes: Record<ThemeName, ThemeDefinition> = {
    ushi: ushiTheme,
    lego: legoTheme,
    barbie: barbieTheme,
    battleship: battleshipTheme,
};

// Ordered list for the picker UI
export const themeOrder: ThemeName[] = ['ushi', 'lego', 'barbie', 'battleship'];

// ── Helper: inject theme tokens as CSS custom properties ──────────────────────

export function applyThemeToDocument(
    schemeName: ThemeName,
    resolvedMode: ResolvedMode
): void {
    const tokens = themes[schemeName][resolvedMode];
    const root = document.documentElement;

    root.style.setProperty('--bg-primary', tokens.bgPrimary);
    root.style.setProperty('--bg-secondary', tokens.bgSecondary);
    root.style.setProperty('--bg-tertiary', tokens.bgTertiary);
    root.style.setProperty('--text-primary', tokens.textPrimary);
    root.style.setProperty('--text-secondary', tokens.textSecondary);
    root.style.setProperty('--border-color', tokens.borderColor);
    root.style.setProperty('--input-bg', tokens.inputBg);
    root.style.setProperty('--input-border', tokens.inputBorder);
    root.style.setProperty('--button-hover-bg', tokens.buttonHoverBg);
    root.style.setProperty('--accent-color', tokens.accentColor);
    root.style.setProperty('--accent-hover', tokens.accentHover);
    root.style.setProperty('--scrollbar-track', tokens.scrollbarTrack);
    root.style.setProperty('--scrollbar-thumb', tokens.scrollbarThumb);
    root.style.setProperty('--scrollbar-thumb-hover', tokens.scrollbarThumbHover);
    root.style.setProperty('--sh-comment', tokens.shComment);
    root.style.setProperty('--sh-string', tokens.shString);
    root.style.setProperty('--sh-keyword', tokens.shKeyword);
    root.style.setProperty('--sh-number', tokens.shNumber);
    root.style.setProperty('--sh-function', tokens.shFunction);

    // Keep data attributes up to date for any CSS that targets them
    root.setAttribute('data-theme-scheme', schemeName);
    root.setAttribute('data-theme-mode', resolvedMode);

    // Keep the old .light / .dark classes so existing CSS selectors still work
    root.classList.remove('light', 'dark');
    root.classList.add(resolvedMode);
}
