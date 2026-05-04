import type { Config } from "tailwindcss";

const config: Config = {
  content: [
    "./pages/**/*.{js,ts,jsx,tsx,mdx}",
    "./components/**/*.{js,ts,jsx,tsx,mdx}",
    "./app/**/*.{js,ts,jsx,tsx,mdx}",
  ],
  theme: {
    extend: {
      colors: {
        // Light, institutional, trust-coded palette.
        // Rule: <= 3 hues visible per screen. Color carries meaning.
        background: "#FAFBFC",
        surface: "#FFFFFF",
        border: "#E2E8F0",
        primary: {
          DEFAULT: "#1E40AF", // deep gov blue: authority + trust
          fg: "#FFFFFF",
        },
        accent: {
          DEFAULT: "#0F766E", // teal: calm, used sparingly
          fg: "#FFFFFF",
        },
        text: {
          DEFAULT: "#0F172A",
          muted: "#475569",
          subtle: "#64748B",
        },
        success: "#15803D",
        warn: "#B45309",
        danger: "#B91C1C",
      },
      fontFamily: {
        sans: ["var(--font-inter)", "system-ui", "sans-serif"],
      },
      fontVariantNumeric: {
        tabular: "tabular-nums",
      },
      borderRadius: {
        sm: "4px",
        DEFAULT: "8px",
        lg: "12px",
      },
      boxShadow: {
        card: "0 1px 2px rgba(15, 23, 42, 0.04), 0 1px 3px rgba(15, 23, 42, 0.06)",
      },
    },
  },
  plugins: [require("tailwindcss-animate")],
};
export default config;
