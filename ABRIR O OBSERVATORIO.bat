@echo off
rem Abre o observatorio no Edge (ou no Chrome) com permissao para
rem ler os arquivos desta pasta. Nao instala nada e nao altera
rem nenhuma configuracao do navegador: a permissao vale so para
rem esta janela, que usa um perfil separado criado aqui dentro.
setlocal
set "PASTA=%~dp0"
set "PERFIL=%TEMP%\perfil_observatorio_patentes"
set "EDGE=%ProgramFiles(x86)%\Microsoft\Edge\Application\msedge.exe"
if not exist "%EDGE%" set "EDGE=%ProgramFiles%\Microsoft\Edge\Application\msedge.exe"
if not exist "%EDGE%" set "EDGE=%ProgramFiles%\Google\Chrome\Application\chrome.exe"
if not exist "%EDGE%" set "EDGE=%ProgramFiles(x86)%\Google\Chrome\Application\chrome.exe"
if not exist "%EDGE%" (
  echo Nao encontrei o Microsoft Edge nem o Google Chrome.
  echo Abra um dos dois manualmente com a opcao
  echo   --allow-file-access-from-files
  pause
  exit /b 1
)
start "" "%EDGE%" --allow-file-access-from-files --user-data-dir="%PERFIL%" --new-window --no-first-run --no-default-browser-check --disable-sync --disable-background-networking --disable-component-update --disable-search-engine-choice-screen --disable-features=msEdgeIdentityFre,msImplicitSignin,EdgeFre,MsaAutoSignIn,ShowRecommendationsFRE "file:///%PASTA%painel\observatorio.html"
endlocal
