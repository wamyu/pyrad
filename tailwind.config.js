/** @type {import('tailwindcss').Config} */
export default {
  content: [
    "./index.html",
    "./src/**/*.{js,ts,jsx,tsx}",
  ],
  theme: {
    extend: {
      colors: {
        ctp: {
          base: "#1e1e2e",
          mantle: "#181825",
          crust: "#11111b",
          surface0: "#313244",
          surface1: "#45475a",
          surface2: "#585b70",
          text: "#cdd6f4",
          subtext0: "#a6adc8",
          subtext1: "#bac2de",
          blue: "#89b4fa",
          lavender: "#b4befe",
          mauve: "#cba6f7",
          red: "#f38ba8",
          yellow: "#f9e2af",
          green: "#a6e3a1",
        }
      }
    },
  },
  plugins: [],
}
