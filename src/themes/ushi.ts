import type { ThemeDefinition } from './index';

// ── Ushi (Cow / Sunset-Red) ───────────────────────────────────────────────────
// The original KoSumosu colour palette. Inspired by the ox icon:
// dark navy backgrounds, warm cream lights, sunset-red accent.

export const ushiTheme: ThemeDefinition = {
    name: 'Ushi',
    emoji: '🐄',

    dark: {
        bgPrimary: '#121420',
        bgSecondary: '#0a0c14',
        bgTertiary: '#1b1e2e',
        textPrimary: 'rgba(255, 255, 255, 0.87)',
        textSecondary: 'rgba(255, 255, 255, 0.60)',
        borderColor: '#333333',
        inputBg: '#1a1a1a',
        inputBorder: '#333333',
        buttonHoverBg: '#333',
        accentColor: '#d84315',
        accentHover: '#bf360c',
        scrollbarTrack: '#1e1e1e',
        scrollbarThumb: '#444',
        scrollbarThumbHover: '#555',
        // Monokai-ish
        shComment: '#75715e',
        shString: '#e6db74',
        shKeyword: '#f92672',
        shNumber: '#ae81ff',
        shFunction: '#a6e22e',
    },

    light: {
        bgPrimary: '#fdfaf5',
        bgSecondary: '#f3eee3',
        bgTertiary: '#ffffff',
        textPrimary: '#121420',
        textSecondary: '#4a4d5e',
        borderColor: '#dcd7ca',
        inputBg: '#ffffff',
        inputBorder: '#dcd7ca',
        buttonHoverBg: '#ece6d8',
        accentColor: '#d84315',
        accentHover: '#bf360c',
        scrollbarTrack: '#f1f1f1',
        scrollbarThumb: '#c1c1c1',
        scrollbarThumbHover: '#a8a8a8',
        // Light-compatible
        shComment: '#708090',
        shString: '#22863a',
        shKeyword: '#d73a49',
        shNumber: '#005cc5',
        shFunction: '#6f42c1',
    },
};
