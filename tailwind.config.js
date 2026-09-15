/** @type {import('tailwindcss').Config} */
module.exports = {
  content: ["./src/**/*.{html,ts,scss}"],
  theme: {
    extend: {
      colors: {
        customBlue: '#2E6276',
        customGreen: '#2EB270',
        customBlueHover: '#4291b1',
        customGreenHover: '#47e797',
        
        // Additional colors from your CSS variables
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
        grayLight: '#f0f0f0',  // Light gray for even rows
        grayDark: '#e2e2e2',   // Darker gray for odd rows
        textGray: '#495057',
      },
      // fontSize: {
      //   customsm: '.8em',
      //   custommd: '1em',
      //   customl: '1.2em',
      //   customxl: '1.3em',
      //   customxxl: '1.5em',
      // },
    },
  },
  plugins: [],
}

