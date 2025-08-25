/**
 * Tailwind CSS Configuration File
 * 
 * This file controls how Tailwind scans your project for class names
 * and lets you customize the design system (colors, fonts, spacing, etc.).
 */

/** @type {import('tailwindcss').Config} */
module.exports = {
  // "content" tells Tailwind where to look for class names.
  // It scans all JS/JSX/TS/TSX files inside the "src" folder.
  // Without this, unused classes might be removed in production.
  content: [
    "./src/**/*.{js,jsx,ts,tsx}",
  ],

  theme: {
    // "extend" allows you to add custom styles while keeping
    // Tailwind's default theme intact.
    extend: {
      // Example: 
      // colors: {
      //   brand: "#1D4ED8",  // custom brand color
      // },
      // fontFamily: {
      //   sans: ["Inter", "sans-serif"], // custom font
      // },
    },
  },

  // Plugins extend Tailwind with extra utilities.
  // For example: typography, forms, line-clamp, etc.
  plugins: [],
};
