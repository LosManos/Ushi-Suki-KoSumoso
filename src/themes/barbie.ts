import type { ThemeDefinition } from './index';

// ── Barbie ────────────────────────────────────────────────────────────────────
// Inspired by Barbie's iconic palette: hot pink, magenta, bubblegum.
// Dark mode is a dreamy deep magenta, light mode is blush pink and white.

export const barbieTheme: ThemeDefinition = {
    name: 'Barbie',
    emoji: '💗',

    dark: {
        bgPrimary: '#1A0A14',   // Deep magenta-black
        bgSecondary: '#110710',   // Even deeper plum
        bgTertiary: '#2A1020',   // Raised dark panel with pink tint
        textPrimary: 'rgba(255, 230, 245, 0.92)',  // Warm pink-white
        textSecondary: 'rgba(255, 180, 220, 0.65)', // Muted rose
        borderColor: '#4A1A35',
        inputBg: '#220D1A',
        inputBorder: '#5C2040',
        buttonHoverBg: '#3D1530',
        accentColor: '#FF69B4',   // Hot pink
        accentHover: '#E91E8C',   // Deep magenta
        scrollbarTrack: '#1A0A14',
        scrollbarThumb: '#5C2040',
        scrollbarThumbHover: '#8C3060',
        // Pink / purple syntax
        shComment: '#8B4D6E',   // dusty rose
        shString: '#FFB6D9',   // light pink
        shKeyword: '#FF69B4',   // hot pink
        shNumber: '#DA70D6',   // orchid
        shFunction: '#EE82EE',   // violet
    },

    light: {
        bgPrimary: '#FFF0F5',   // Lavender blush
        bgSecondary: '#FFDDE9',   // Light pink
        bgTertiary: '#FFFFFF',
        textPrimary: '#3D001E',   // Deep rose-black
        textSecondary: '#8C3060',   // Muted magenta
        borderColor: '#F0AACB',
        inputBg: '#FFFFFF',
        inputBorder: '#F0AACB',
        buttonHoverBg: '#FFD6EA',
        accentColor: '#E91E8C',   // Barbie magenta
        accentHover: '#C2185B',
        scrollbarTrack: '#FFE4F0',
        scrollbarThumb: '#F0AACB',
        scrollbarThumbHover: '#E080A8',
        // Warm pink light syntax
        shComment: '#C085A0',
        shString: '#BF360C',   // contrast warm orange-red on light
        shKeyword: '#C2185B',   // deep pink
        shNumber: '#7B1FA2',   // purple
        shFunction: '#00796B',   // teal for contrast
    },
};
