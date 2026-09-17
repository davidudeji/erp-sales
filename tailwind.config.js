/** @type {import('tailwindcss').Config} */
module.exports = {
  content: ["./src/**/*.{html,ts,scss}"],
  theme: {
    extend: {
      fontFamily: {
        sans: ['Inter', '-apple-system', 'BlinkMacSystemFont', 'Segoe UI', 'Roboto', 'sans-serif'],
        display: ['Plus Jakarta Sans', 'Inter', 'sans-serif'],
        mono: ['JetBrains Mono', 'ui-monospace', 'SFMono-Regular', 'Menlo', 'monospace'],
      },
      borderRadius: {
        'sm': '6px',
        'md': '8px',
        'lg': '12px',
        'xl': '16px',
      },
      boxShadow: {
        'subtle': '0 1px 2px 0 rgba(15, 23, 42, 0.05)',
        'card': '0 1px 3px 0 rgba(15, 23, 42, 0.06), 0 1px 2px -1px rgba(15, 23, 42, 0.04)',
        'dropdown': '0 4px 6px -1px rgba(15, 23, 42, 0.08), 0 2px 4px -2px rgba(15, 23, 42, 0.04)',
        'modal': '0 20px 25px -5px rgba(15, 23, 42, 0.1), 0 8px 10px -6px rgba(15, 23, 42, 0.05)',
      },
      colors: {
        // ── Clean Lab / Precision Enterprise Core Tokens ──
        canvas: '#F8FAFC',
        surface: '#FFFFFF',
        surfaceMuted: '#F1F5F9',
        surfaceHover: '#F8FAFC',

        primaryText: '#0F172A',
        secondaryText: '#475569',
        mutedText: '#64748B',
        tertiaryText: '#94A3B8',

        // Brand Accent: Electric Cobalt 600
        brandAccent: '#2563EB',
        brandAccentHover: '#1D4ED8',
        brandAccentActive: '#1E40AF',
        brandAccentLight: '#EFF6FF',
        brandAccentBorder: '#BFDBFE',

        // Architectural Borders
        appBorder: '#E2E8F0',
        appBorderLight: '#F1F5F9',
        appBorderStrong: '#CBD5E1',

        // Semantics
        appSuccess: '#059669',
        appSuccessBg: '#ECFDF5',
        appSuccessBorder: '#A7F3D0',
        appWarning: '#D97706',
        appWarningBg: '#FFFBEB',
        appWarningBorder: '#FDE68A',
        appDanger: '#DC2626',
        appDangerBg: '#FEF2F2',
        appDangerBorder: '#FECACA',
        appInfo: '#0284C7',
        appInfoBg: '#F0F9FF',
        appInfoBorder: '#BAE6FD',

        // ── Preserved Existing Palette (Backward Compatibility) ──
        customBlue: '#2E6276',
        customGreen: '#2EB270',
        customBlueHover: '#4291b1',
        customGreenHover: '#47e797',
        
        customMintGreen: '#D6FFFE',
        customAntiFlashWhite: '#EEEEEE',
        customLightBlue: '#B6D6E2',
        customRed: '#FF0000',
        
        // Badge colors
        badgeGrey: 'rgb(182, 182, 182)',
        badgeRed: 'rgb(233, 55, 55)',
        badgeLightBlue: 'rgb(101, 199, 231)',
        badgeGreen: 'rgb(112, 231, 101)',
        badgeYellow: 'rgb(231, 222, 101)',
        badgePurple: 'rgb(158, 138, 231)',
        badgePink: 'rgb(192, 118, 174)',

        // Icon colors
        iconEdit: '#2EB270',
        iconDelete: '#FF0000',
        iconView: 'rgb(101, 199, 231)',

        // Additional colors
        skyBlue: '#f8feff',
        skyBlue2: '#e3eef0',
        grayLight: '#f0f0f0',
        grayDark: '#e2e2e2',
        textGray: '#495057',
      },
    },
  },
  plugins: [],
}

