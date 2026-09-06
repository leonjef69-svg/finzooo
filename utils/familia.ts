const CARACTERES_CODIGO_FAMILIA = "ABCDEFGHJKLMNPQRSTUVWXYZ23456789";

export function crearCodigoFamilia(): string {
  let value = "";
  for (let i = 0; i < 8; i += 1) {
    value += CARACTERES_CODIGO_FAMILIA[Math.floor(Math.random() * CARACTERES_CODIGO_FAMILIA.length)];
  }
  return value;
}
