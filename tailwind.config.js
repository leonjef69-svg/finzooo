/** @type {import('tailwindcss').Config} */
const shades = [50, 100, 200, 300, 400, 500, 600, 700, 800, 900, 950];
const dynamicColor = (name) => `rgb(var(--fino-${name}) / <alpha-value>)`;
const dynamicScale = (name) => Object.fromEntries(shades.map((shade) => [shade, dynamicColor(`${name}-${shade}`)]));

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
        // Paleta base intercambiable desde Ajustes. Las categorías propias usan sus
        // colores guardados y no dependen de estos tonos semánticos.
        white: dynamicColor("white"),
        slate: dynamicScale("slate"),
        emerald: dynamicScale("emerald"),
        rose: dynamicScale("rose"),
        /*
         * EL MODO OSCURO: fondo carbón cálido, tarjetas carbón y controles más claros. El borde mantiene
         * separación entre filas sin teñir los neutros de azul.
         *
         * Los ingresos y gastos usan verde y rojo; los demás elementos conservan neutros.
         */
        noche: {
          // El fondo de la pantalla.
          DEFAULT: "#11110f",
          // Las tarjetas y las filas. UN TONO MAS CLARO QUE EL FONDO: esa es toda la idea.
          2: "#242321",
          // Lo que va encima de una tarjeta: un campo, un boton apagado.
          3: "#302e2b",
          panel: "#211f1d",
          // Las lineas. Mas claras que las tarjetas o no se ven.
          borde: "#494641",
          navegacion: "#1a1916",
        },
      },
    },
  },
  plugins: [],
};
