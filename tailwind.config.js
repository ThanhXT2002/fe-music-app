/** @type {import('tailwindcss').Config} */
module.exports = {
  content: [
    "./src/**/*.{html,scss,ts}",
  ],
  theme: {
    extend: {},
  },
  // Dark mode is always enabled, no need for selector
  plugins: [require("tailwind-scrollbar")({ nocompatible: true })],
}
