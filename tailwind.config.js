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
        /*
         * EL MODO OSCURO, EN CARBON. Antes era negro puro (#000000) y el problema no era el
         * color: era que LA TARJETA Y EL FONDO ERAN LO MISMO. Lo unico que las separaba era un
         * borde delgado, asi que la pantalla se veia plana y las filas se confundian entre si.
         *
         * Ahora la tarjeta es un tono mas clara que el fondo y se distingue sola, sin depender
         * del borde. Es lo que hacen casi todas las apps, y es lo que eligio el (21/08/2026)
         * viendo las cuatro opciones dibujadas.
         *
         * El gris es neutro a proposito: en una app de dinero, el unico color fuerte de la
         * pantalla tiene que ser el del saldo.
         */
        noche: {
          // El fondo de la pantalla.
          DEFAULT: "#121212",
          // Las tarjetas y las filas. UN TONO MAS CLARO QUE EL FONDO: esa es toda la idea.
          2: "#1e1e1e",
          // Lo que va encima de una tarjeta: un campo, un boton apagado.
          3: "#2a2a2a",
          // Las lineas. Mas claras que las tarjetas o no se ven.
          borde: "#2f2f2f",
        },
      },
    },
  },
  plugins: [],
};
