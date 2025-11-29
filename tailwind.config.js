/** @type {import('tailwindcss').Config} */
module.exports = {
  content: [
    "./app/**/*.{ts,tsx}",
    "./theme/**/*.{ts,tsx}",
    "./ui/**/*.{ts,tsx}",
    "./store/**/*.{ts,tsx}",
    "./features/**/*.{ts,tsx}",
    "./lib/**/*.{ts,tsx}",
    "./src/**/*.{ts,tsx}",
  ],
  presets: [require("nativewind/preset")],
  theme: {
    extend: {
      fontFamily: {
        geist: ["Geist"],
        "geist-medium": ["Geist-Medium"],
        "geist-semibold": ["Geist-SemiBold"],
        "geist-bold": ["Geist-Bold"],
        "geist-black": ["Geist-Black"],
        "geist-light": ["Geist-Light"],
        "geist-thin": ["Geist-Thin"],
        "geist-extralight": ["Geist-ExtraLight"],
        "geist-extrabold": ["Geist-ExtraBold"],
        sans: ["System"],
      },
      colors: {
        // LIGHT THEME (default)
        base: "#F4F4F5", // off‑white app background
        elev: "#EEEEEF", // slightly darker section bg (optional)
        surface: "#FFFFFF", // cards
        border: "#E5E7EB", // card borders / dividers

        // text
        primary: "#0B0B0B", // main text (near black)
        secondary: "#525252", // subtext
        muted: "#8A8A8A",

        // brand (your maroon)
        brand: "#9A1B32",
        brandAccent: "#B0283D",

        // states
        success: "#16A34A",
        warning: "#F59E0B",
        danger: "#DC2626",
        info: "#2563EB",
      },
      borderRadius: {
        xs: "6px",
        sm: "10px",
        md: "14px",
        lg: "20px",
        xl: "28px",
      },
    },
  },
  plugins: [],
}
