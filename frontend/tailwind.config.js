export default {
  content: ["./index.html", "./src/**/*.{ts,tsx}"],
  theme: {
    extend: {
      colors: {
        accent: {
          50: "#eef8f7",
          100: "#d6eeec",
          500: "#24958c",
          600: "#1d7771",
          700: "#185f5b"
        }
      },
      boxShadow: {
        soft: "0 10px 30px rgba(24, 95, 91, 0.08)"
      }
    }
  },
  plugins: []
};

