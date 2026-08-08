@echo off
title Sinbad Bridge - Remove Automatic Startup
powershell.exe -NoProfile -ExecutionPolicy Bypass -File "%~dp0remove-autostart.ps1"
pause

