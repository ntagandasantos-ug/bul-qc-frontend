/** @type {import('tailwindcss').Config} */
module.exports = {
  content: ["./src/**/*.{js,jsx,ts,tsx}"],
  theme: {
    extend: {
      colors: {
        // Primary purple theme
        'bul-primary':  '#6B21A8',   // deep purple
        'bul-purple':   '#7C3AED',   // vibrant purple
        'bul-purple2':  '#9333EA',   // lighter purple
        'bul-gold':     '#FFB81C',   // BUL gold accent
        'bul-blue':     '#003087',   // kept for data colours
        // Status colours
        'bul-green':    '#16A34A',
        'bul-orange':   '#EA580C',
        'bul-red':      '#DC2626',
        'bul-gray':     '#6B7280',
        // Backgrounds
        'bul-bg':       '#FAF5FF',   // very light purple tint
      },
    },
  },
  plugins: [],
};
