import type { ThemeDefinition } from './index';

// ── Lego ──────────────────────────────────────────────────────────────────────
// Official LEGO brick colours:
//   Bright Red        #C91A09
//   Yellow            #F2CD37
//   Bright Blue       #0055BF
//   Dark Blue         #003580
//   Bright Green      #4B9F4A
//   Dark Bluish Gray  #596878
//   Dark Orange       #A95500
//
// Dark mode: deep navy blue base, golden yellow text, Bright Blue borders.
// Light mode: yellow sidebar, LIGHT BLUE editor area, red accents.
//   → Yellow + Blue + Red = the full Lego primary colour trio.

export const legoTheme: ThemeDefinition = {
    name: 'Lego',
    emoji: '🧱',

    dark: {
        bgPrimary: '#0A1628',   // Deep navy — night-time base plate
        bgSecondary: '#003580',   // Lego Dark Blue — sidebar/secondary
        bgTertiary: '#0D2B5E',   // Slightly lighter navy for panels
        textPrimary: '#F2CD37',   // Lego Yellow — vivid, cheerful
        textSecondary: 'rgba(242, 205, 55, 0.60)',
        borderColor: '#0055BF',   // Bright Blue borders
        inputBg: '#0A1628',
        inputBorder: '#0055BF',
        buttonHoverBg: '#00325F',
        accentColor: '#C91A09',   // Bright Red
        accentHover: '#A01508',
        scrollbarTrack: '#0A1628',
        scrollbarThumb: '#003580',
        scrollbarThumbHover: '#0055BF',
        shComment: '#596878',   // Dark Bluish Gray
        shString: '#F2CD37',   // Yellow
        shKeyword: '#C91A09',   // Bright Red
        shNumber: '#5BAAFF',   // Bright Blue (lightened for dark bg legibility)
        shFunction: '#4B9F4A',   // Bright Green
    },

    light: {
        bgPrimary: '#D6E8FF',   // Light Lego Blue — editor/content area
        bgSecondary: '#F2CD37',   // Lego Yellow — sidebar/secondary
        bgTertiary: '#EAF2FF',   // Slightly deeper blue for panels
        textPrimary: '#001A4D',   // Deep navy text — readable on light blue
        textSecondary: '#00337A',   // Medium navy
        borderColor: '#C91A09',   // Bright Red borders
        inputBg: '#FFFFFF',   // White input boxes for legibility
        inputBorder: '#0055BF',   // Bright Blue input borders
        buttonHoverBg: '#B8D8FF',   // Slightly darker blue on hover
        accentColor: '#C91A09',   // Bright Red
        accentHover: '#A01508',
        scrollbarTrack: '#C0DCFF',
        scrollbarThumb: '#0055BF',
        scrollbarThumbHover: '#003580',
        shComment: '#596878',   // Dark Bluish Gray
        shString: '#A95500',   // Dark Orange (legible on blue; yellow disappears on yellow)
        shKeyword: '#C91A09',   // Bright Red
        shNumber: '#003580',   // Dark Blue
        shFunction: '#237841',   // Dark Green
    },
};
