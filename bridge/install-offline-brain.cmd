@echo off
setlocal
title Install Sinbad Offline Brain
set "OLLAMA_EXE=%LOCALAPPDATA%\Programs\Ollama\ollama.exe"
echo Sinbad Offline Brain installer
echo.
if not exist "%OLLAMA_EXE%" (
  where ollama.exe >nul 2>&1
  if not errorlevel 1 set "OLLAMA_EXE=ollama.exe"
)
if not exist "%OLLAMA_EXE%" if /i not "%OLLAMA_EXE%"=="ollama.exe" (
  echo Ollama is not installed yet.
  echo Opening the official Windows download page...
  powershell.exe -NoProfile -Command "Start-Process 'https://ollama.com/download/windows'" >nul 2>&1
  if errorlevel 1 rundll32.exe url.dll,FileProtocolHandler "https://ollama.com/download/windows"
  echo.
  echo If the page still does not open, copy this address into your browser:
  echo https://ollama.com/download/windows
  echo Install Ollama, then run this file again.
  pause
  exit /b 1
)
echo Ollama found. Downloading the 9.3 GB qwen3:14b model...
echo Keep this window open. Download time depends on your connection.
"%OLLAMA_EXE%" pull qwen3:14b
if errorlevel 1 (
  echo Model download failed. Check the internet connection and free disk space.
  pause
  exit /b 1
)
echo.
echo Testing Sinbad's local brain...
"%OLLAMA_EXE%" run qwen3:14b "Turkce olarak yalnizca Sinbad offline beyni hazir yaz."
echo.
echo SUCCESS: Sinbad Offline Brain is installed.
echo Start Sinbad Bridge and open Atlas Marine OS.
pause
