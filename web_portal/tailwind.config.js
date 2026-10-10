/** @type {import('tailwindcss').Config} */
module.exports = {
  content: [
    './lms/**/*.{ts,tsx}',
    './App.tsx',
  ],
  darkMode: 'class',
  theme: {
    extend: {
      fontSize: {
        xs: ['0.875rem', { lineHeight: '1.25rem' }],     // was 12px -> now 14px (+2px)
        sm: ['1rem', { lineHeight: '1.5rem' }],         // was 14px -> now 16px (+2px)
        base: ['1.125rem', { lineHeight: '1.75rem' }],  // was 16px -> now 18px (+2px)
        lg: ['1.25rem', { lineHeight: '1.75rem' }],     // was 18px -> now 20px (+2px)
        xl: ['1.375rem', { lineHeight: '1.875rem' }],   // was 20px -> now 22px (+2px)
        '2xl': ['1.625rem', { lineHeight: '2.125rem' }],// was 24px -> now 26px (+2px)
        '3xl': ['2rem', { lineHeight: '2.375rem' }],    // was 30px -> now 32px (+2px)
        '4xl': ['2.375rem', { lineHeight: '2.625rem' }],// was 36px -> now 38px (+2px)
      },
      colors: {
        // Folder 1 NERMAI IAS color system
        background: '#0B0B14',
        surface: '#1a1a2e',
        surfaceHighlight: '#252542',
        accent: '#8B0000',
        'accent-light': '#B22222',
        primary: '#6B0000',
        textPrimary: '#FFFFFF',
        textSecondary: '#9CA3AF',
        error: '#FF3333',
        success: '#22C55E',
        warning: '#F59E0B',
      },
      fontFamily: {
        sans: ['Inter', 'ui-sans-serif', 'system-ui'],
      },
    },
  },
  plugins: [],
};
