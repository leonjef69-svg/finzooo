@echo off
setlocal
cd /d "%~dp0"

set "JAVA_HOME=C:\Program Files\Android\Android Studio\jbr"
set "ANDROID_HOME=%LOCALAPPDATA%\Android\Sdk"
set "ANDROID_SDK_ROOT=%ANDROID_HOME%"
set "PATH=%JAVA_HOME%\bin;%PATH%"

if not exist "%JAVA_HOME%\bin\java.exe" (
  echo ERROR: No se encontro Java de Android Studio.
  pause
  exit /b 1
)
if not exist "%ANDROID_HOME%" (
  echo ERROR: No se encontro Android SDK.
  pause
  exit /b 1
)

rem Validar el archivo elegido en app.json antes de modificar Android.
node scripts\verificar-firebase-android.cjs
if errorlevel 1 (
  pause
  exit /b 1
)

rem Regenera la configuración nativa desde app.json. Sin este paso, la carpeta
rem Android podía conservar permisos o plugins de una versión anterior aunque
rem el proyecto ya estuviera corregido.
call node_modules\.bin\expo.cmd prebuild --platform android --no-install
if errorlevel 1 (
  echo ERROR: No se pudo actualizar la configuracion Android.
  pause
  exit /b 1
)

node scripts\verificar-firebase-android.cjs --copy
if errorlevel 1 exit /b 1

node -e "const fs=require('fs'),a=require('./app.json').expo,p='android/app/build.gradle';let s=fs.readFileSync(p,'utf8');s=s.replace(/versionCode\s+\d+/, 'versionCode '+a.android.versionCode).replace(/versionName\s+\x22[^\x22]+\x22/, 'versionName \x22'+a.version+'\x22');fs.writeFileSync(p,s)"
if errorlevel 1 exit /b 1
for /f "delims=" %%V in ('node -p "require('./app.json').expo.version"') do set "APP_VERSION=%%V"

> android\local.properties echo sdk.dir=%ANDROID_HOME:\=/%
del /q android\app\build\generated\assets\createReleaseUpdatesResources\app.manifest 2>nul
del /q android\app\build\intermediates\assets\release\mergeReleaseAssets\app.manifest 2>nul

cd android
call gradlew.bat bundleRelease --max-workers=3
if errorlevel 1 (
  echo.
  echo NO SE PUDO CREAR EL AAB.
  pause
  exit /b 1
)

copy /Y "app\build\outputs\bundle\release\app-release.aab" "%USERPROFILE%\Downloads\Fino-%APP_VERSION%.aab" >nul
echo.
echo LISTO: Fino-%APP_VERSION%.aab esta en Descargas.
explorer /select,"%USERPROFILE%\Downloads\Fino-%APP_VERSION%.aab"
pause
