import { utf8ByteLength } from "@/utils/utf8";

function ok(condition: boolean, message: string) {
  if (!condition) throw new Error(message);
}

ok(utf8ByteLength("FINZO") === 5, "El texto ASCII debe ocupar un byte por carácter.");
ok(utf8ByteLength("á") === 2, "Una letra acentuada debe medirse en bytes UTF-8.");
ok(utf8ByteLength("💰") === 4, "Un emoji debe ocupar cuatro bytes UTF-8.");
ok(
  utf8ByteLength("Caja 👨‍👩‍👧") > "Caja 👨‍👩‍👧".length,
  "Los nombres con emojis no pueden medirse con string.length.",
);

console.log("Tamaño UTF-8: el respaldo cuenta bytes reales, incluidos acentos y emojis.");
