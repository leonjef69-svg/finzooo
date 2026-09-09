$ErrorActionPreference = "Stop"
$secretDir = Join-Path $env:USERPROFILE ".fino-secrets"
$credentialFile = Join-Path $secretDir "firebase-admin.json"

if (!(Test-Path -LiteralPath $credentialFile)) { throw "Falta la clave privada de Firebase." }
Write-Host "Inicio privado del bot de Fino" -ForegroundColor Green
Write-Host "Pega el TOKEN NUEVO de BotFather. No se mostrara mientras escribes."
$secureToken = Read-Host "Token" -AsSecureString
if ($secureToken.Length -lt 20) {
  throw "El token parece incompleto. Ejecuta este archivo otra vez."
}
$pointer = [Runtime.InteropServices.Marshal]::SecureStringToBSTR($secureToken)
try {
  $env:TELEGRAM_BOT_TOKEN = [Runtime.InteropServices.Marshal]::PtrToStringBSTR($pointer)
  $env:GOOGLE_APPLICATION_CREDENTIALS = $credentialFile
  Set-Location -LiteralPath $PSScriptRoot
  Write-Host "`nIniciando el bot. Deja esta ventana abierta..." -ForegroundColor Green
  npm run serve:telegram
} finally {
  [Runtime.InteropServices.Marshal]::ZeroFreeBSTR($pointer)
  Remove-Item Env:TELEGRAM_BOT_TOKEN -ErrorAction SilentlyContinue
}
