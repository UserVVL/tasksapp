/** @type {import('tailwindcss').Config} */
export default {
  darkMode: ["class"],
  content: [
    "./index.html",
    "./src/**/*.{js,ts,jsx,tsx}",
  ],
  theme: {
    extend: {
      fontFamily: {
        sans: ["Inter", "system-ui", "sans-serif"],
        heading: ["Inter Tight", "Inter", "system-ui", "sans-serif"],
        mono: ["Geist Mono", "SF Mono", "Menlo", "monospace"],
      },
      fontSize: {
        hero: ["48px", { lineHeight: "1.1", fontWeight: "700" }],
        h1: ["40px", { lineHeight: "1.15", fontWeight: "700" }],
        h2: ["32px", { lineHeight: "1.2", fontWeight: "700" }],
        h3: ["24px", { lineHeight: "1.3", fontWeight: "600" }],
        "section-title": ["20px", { lineHeight: "1.4", fontWeight: "600" }],
      },
      colors: {
        border: "hsl(var(--border))",
        input: "hsl(var(--input))",
        ring: "hsl(var(--ring))",
        background: "hsl(var(--background))",
        foreground: "hsl(var(--foreground))",
        success: "hsl(var(--success))",
        warning: "hsl(var(--warning))",
        primary: {
          DEFAULT: "hsl(var(--primary))",
          foreground: "hsl(var(--primary-foreground))",
        },
        secondary: {
          DEFAULT: "hsl(var(--secondary))",
          foreground: "hsl(var(--secondary-foreground))",
        },
        destructive: {
          DEFAULT: "hsl(var(--destructive))",
          foreground: "hsl(var(--destructive-foreground))",
        },
        muted: {
          DEFAULT: "hsl(var(--muted))",
          foreground: "hsl(var(--muted-foreground))",
        },
        accent: {
          DEFAULT: "hsl(var(--accent))",
          foreground: "hsl(var(--accent-foreground))",
        },
        popover: {
          DEFAULT: "hsl(var(--popover))",
          foreground: "hsl(var(--popover-foreground))",
        },
        card: {
          DEFAULT: "hsl(var(--card))",
          foreground: "hsl(var(--card-foreground))",
        },
      },
      borderRadius: {
        lg: "var(--radius)",
        md: "calc(var(--radius) - 6px)",
        sm: "calc(var(--radius) - 10px)",
        xl: "calc(var(--radius) + 4px)",
        "2xl": "calc(var(--radius) + 8px)",
      },
      boxShadow: {
        glass: "0 0 0 1px hsl(var(--border)), 0 4px 24px hsl(var(--border) / 0.3)",
        "glass-lg": "0 0 0 1px hsl(var(--border)), 0 8px 40px hsl(var(--border) / 0.4)",
        glow: "0 0 20px hsl(var(--primary) / 0.15)",
        "glow-lg": "0 0 40px hsl(var(--primary) / 0.25)",
        card: "0 0 0 1px hsl(var(--border) / 0.8), 0 2px 16px hsl(var(--border) / 0.2)",
        "card-hover": "0 0 0 1px hsl(var(--primary) / 0.2), 0 8px 32px hsl(var(--border) / 0.3)",
      },
      animation: {
        "fade-in": "fadeIn 0.2s ease-out",
        "slide-up": "slideUp 0.2s ease-out",
        "glow-pulse": "glowPulse 2s ease-in-out infinite",
      },
      keyframes: {
        fadeIn: {
          "0%": { opacity: "0" },
          "100%": { opacity: "1" },
        },
        slideUp: {
          "0%": { opacity: "0", transform: "translateY(8px)" },
          "100%": { opacity: "1", transform: "translateY(0)" },
        },
        glowPulse: {
          "0%, 100%": { boxShadow: "0 0 20px hsl(var(--primary) / 0.1)" },
          "50%": { boxShadow: "0 0 30px hsl(var(--primary) / 0.2)" },
        },
      },
      backgroundImage: {
        "primary-gradient": "linear-gradient(135deg, hsl(var(--primary)), hsl(var(--primary) / 0.8))",
      },
    },
  },
  plugins: [require("tailwindcss-animate")],
}
