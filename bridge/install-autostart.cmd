@echo off
title Sinbad Bridge - Automatic Startup
powershell.exe -NoProfile -ExecutionPolicy Bypass -File "%~dp0install-autostart.ps1"
pause

