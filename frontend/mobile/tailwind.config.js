const { colors, fontFamily, fontSize, borderRadius } = require("./src/theme/tokens");

/** @type {import('tailwindcss').Config} */
module.exports = {
  content: ["./src/**/*.{ts,tsx}"],
  presets: [require("nativewind/preset")],
  theme: {
    extend: { colors, fontFamily, fontSize, borderRadius },
  },
};
