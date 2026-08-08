Option Explicit

Dim shell, fso, scriptFolder, command
Set shell = CreateObject("WScript.Shell")
Set fso = CreateObject("Scripting.FileSystemObject")

scriptFolder = fso.GetParentFolderName(WScript.ScriptFullName)
command = "powershell.exe -NoProfile -ExecutionPolicy Bypass -WindowStyle Hidden -File """ & scriptFolder & "\sinbad-bridge.ps1"""
shell.Run command, 0, False

