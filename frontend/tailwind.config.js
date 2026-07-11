export default {
  content: ["./index.html", "./src/**/*.{ts,tsx}"],
  theme: {
    extend: {
      colors: {
        accent: {
          50: "#effdf8",
          100: "#d7f8eb",
          200: "#b2eed9",
          300: "#78dec1",
          500: "#16a879",
          600: "#087e5d",
          700: "#07664e",
          900: "#064334"
        }
      },
      boxShadow: {
        soft: "0 12px 35px rgba(15, 23, 42, 0.06)",
        lift: "0 24px 70px rgba(5, 66, 51, 0.14)"
      }
    }
  },
  plugins: []
};
