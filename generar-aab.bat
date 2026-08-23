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
set "FIREBASE_CONFIG="
for /f "delims=" %%F in ('dir /b /a-d /o-d "%USERPROFILE%\Downloads\google-services*.json" 2^>nul') do if not defined FIREBASE_CONFIG set "FIREBASE_CONFIG=%USERPROFILE%\Downloads\%%F"
if not defined FIREBASE_CONFIG set "FIREBASE_CONFIG=google-services.json"

if not exist "%FIREBASE_CONFIG%" (
  echo ERROR: Falta la configuracion descargada de Firebase.
  pause
  exit /b 1
)

copy /Y "%FIREBASE_CONFIG%" "android\app\google-services.json" >nul
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
