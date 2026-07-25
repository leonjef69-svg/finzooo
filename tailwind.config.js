/** @type {import('tailwindcss').Config} */
module.exports = {
  darkMode: "class",
  content: ["./app/**/*.{js,jsx,ts,tsx}", "./screens/**/*.{js,jsx,ts,tsx}", "./components/**/*.{js,jsx,ts,tsx}"],
  presets: [require("nativewind/preset")],
  // Los colores de categoría se arman dinámicamente (ej. `bg-${color}-100`),
  // y Tailwind no puede "adivinar" esos nombres solo leyendo el código.
  // Esta lista se los dice de antemano para que sí se generen.
  safelist: [
    {
      pattern:
        /(bg|text|ring|border)-(rose|amber|violet|pink|indigo|red|sky|slate|emerald|teal|fuchsia|cyan|lime|orange|green|stone|yellow|blue)-(50|100|200|500|600)/,
    },
  ],
  theme: {
    extend: {},
  },
  plugins: [],
};
