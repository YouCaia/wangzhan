/** @type {import('tailwindcss').Config} */
module.exports = {
  content: [
    "./index.html",
    "./works.html",
    "./skills.html",
    "./info.html",
    "./contact.html",
    "./js/*.js",
    "./*.js",
    "./*.css"
  ],
  theme: {
    extend: {
      colors: {
        bg:        '#0a0a0a',
        'bg-soft': '#141414',
        gold:      '#d4a857',
        'gold-light': '#f0d089',
        'gold-dim': '#a8823a',
      },
      fontFamily: {
        sans: ['Inter', '-apple-system', '"PingFang SC"', '"Microsoft YaHei"', 'sans-serif'],
        serif: ['"Playfair Display"', 'Georgia', 'serif'],
      },
    }
  }
};
