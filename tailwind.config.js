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
    extend: {
      /**
       * EL MODO OSCURO, EN NEGRO (19/08/2026)
       *
       * Antes era el azul pizarra de Tailwind (slate-900 y slate-800) y el no lo queria:
       * *"no me gusta como se ve actualmente el modo oscuro"*. Se le enseñaron cuatro
       * paletas dibujadas y eligio esta.
       *
       * Su celular es OLED: un pixel negro de verdad se APAGA, asi que se ve mas nitido y
       * gasta menos bateria. Y el problema real de la anterior se va con esto — el fondo y
       * las tarjetas casi no se distinguian, porque slate-900 y slate-800 estan a un paso.
       *
       * **Van con nombre propio y NO se toca la escala slate.** Cambiar slate-900 habria
       * movido tambien el texto del modo claro, que usa ese mismo tono: dos modos distintos
       * colgando del mismo numero es como se rompe uno arreglando el otro.
       */
      colors: {
        noche: {
          DEFAULT: "#000000",
          // Las tarjetas. Lo justo para despegarse del negro sin dejar de ser oscuro.
          2: "#161616",
          // Lo que va encima de una tarjeta: un campo, un boton apagado.
          3: "#242424",
          // Las lineas. Mas claras que las tarjetas o no se ven.
          borde: "#2e2e2e",
        },
      },
    },
  },
  plugins: [],
};
