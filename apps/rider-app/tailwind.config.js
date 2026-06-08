/** @type {import('tailwindcss').Config} */
export default {
  content: ["./index.html", "./src/**/*.{ts,tsx}"],
  theme: {
    extend: {
      boxShadow: {
        phone: "0 24px 90px rgba(2, 6, 23, 0.28)"
      }
    }
  },
  plugins: []
};
