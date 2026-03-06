import type { ThemeDefinition } from './index';

// ── Battleship Grey ───────────────────────────────────────────────────────────
// Windows 9x / classic Windows retro palette.
// Dark mode: dark charcoal panels, classic grey accented with navy.
// Light mode: the iconic button-face grey (#C0C0C0), raised-3D borders, navy action accent.

export const battleshipTheme: ThemeDefinition = {
    name: 'Battleship',
    emoji: '🖥️',

    dark: {
        bgPrimary: '#2C2C2C',   // Dark grey desktop
        bgSecondary: '#1E1E1E',   // Deeper panel
        bgTertiary: '#383838',   // Raised widget background
        textPrimary: '#E0E0E0',   // Silver text
        textSecondary: '#A0A0A0',   // Dimmed grey text
        borderColor: '#555555',
        inputBg: '#1E1E1E',
        inputBorder: '#606060',
        buttonHoverBg: '#444444',
        accentColor: '#5472D3',   // Windows classic blue (slightly brightened for dark)
        accentHover: '#3D5BB8',
        scrollbarTrack: '#2A2A2A',
        scrollbarThumb: '#606060',
        scrollbarThumbHover: '#787878',
        // Muted, almost-monochrome syntax
        shComment: '#7A7A7A',
        shString: '#B0C4DE',   // LightSteelBlue
        shKeyword: '#6A9FB8',   // muted cyan-blue
        shNumber: '#A0A8C0',   // periwinkle
        shFunction: '#88A0A8',   // slate
    },

    light: {
        bgPrimary: '#C0C0C0',   // Classic button-face grey ✓
        bgSecondary: '#D4D0C8',   // Slightly lighter than button-face
        bgTertiary: '#FFFFFF',   // Window client area
        textPrimary: '#000000',   // Window text black
        textSecondary: '#444444',   // Dimmed foreground
        borderColor: '#808080',   // Dark half of 3D border
        inputBg: '#FFFFFF',
        inputBorder: '#808080',
        buttonHoverBg: '#B8B4AC',
        accentColor: '#000080',   // Navy blue — "highlight" colour (#0000AA variant)
        accentHover: '#000066',
        scrollbarTrack: '#C0C0C0',
        scrollbarThumb: '#A0A0A0',
        scrollbarThumbHover: '#808080',
        // Classic code editor
        shComment: '#008000',   // Green (BASIC/IDE style)
        shString: '#800000',   // Maroon
        shKeyword: '#000080',   // Navy
        shNumber: '#800080',   // Purple
        shFunction: '#008080',   // Teal
    },
};
