// This file configures PostCSS, the tool that processes our CSS.
// PostCSS is like a pipeline: it takes in CSS, runs it through plugins,
// and outputs the final CSS used in the app.

module.exports = {
  plugins: {
    // Tailwind CSS plugin:
    // Expands our @tailwind directives in index.css into full CSS.
    tailwindcss: {},

    // Autoprefixer plugin:
    // Automatically adds vendor prefixes (like -webkit-, -moz-) 
    // so our CSS works across different browsers.
    autoprefixer: {},
  },
};
// Note: This file is essential for processing Tailwind CSS and ensuring