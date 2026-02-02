import type { Config } from "tailwindcss";

export default {
  content: ["./src/**/*.{html,js,svelte,ts}"],

  theme: {
    extend: {
      colors: {
        deepest: "#0d0d0d",
        surface: "#1a1a1a",
        elevated: "#252525",
        "border-subtle": "#2e2e2e",
        "text-primary": "#e5e5e5",
        "text-secondary": "#888888",
        "text-muted": "#555555",
        accent: "#3b82f6",
        "accent-subtle": "rgba(59, 130, 246, 0.125)",
        success: "#22c55e",
        warning: "#eab308",
        danger: "#ef4444",
      },
      fontFamily: {
        sans: ["Inter", "-apple-system", "system-ui", "sans-serif"],
        mono: ["JetBrains Mono", "SF Mono", "monospace"],
      },
      fontSize: {
        xs: "11px",
        sm: "13px",
        base: "14px",
        lg: "16px",
        xl: "20px",
      },
    },
  },

  plugins: [require("@tailwindcss/typography")],
} as Config;
