/** @type {import('tailwindcss').Config} */
module.exports = {
  content: [
    "./src/**/*.{html,scss,ts}",
  ],
  theme: {
    extend: {},
  },
  darkMode: ["selector", '[class~="dark"]'],
plugins: [require("tailwind-scrollbar")({ nocompatible: true })],
}
