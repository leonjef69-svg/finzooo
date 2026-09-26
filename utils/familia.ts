import * as Crypto from "expo-crypto";

const CARACTERES_CODIGO_FAMILIA = "ABCDEFGHJKLMNPQRSTUVWXYZ23456789";

export function crearCodigoFamilia(): string {
  // Son exactamente 32 caracteres; tomar los cinco bits bajos no introduce
  // sesgo y usa aleatoriedad criptográfica del sistema operativo.
  return Array.from(Crypto.getRandomBytes(8), byte =>
    CARACTERES_CODIGO_FAMILIA[byte & 31]
  ).join("");
}
