@echo off
setlocal
cd /d "%~dp0.."
call "%~dp0..\node_modules\.bin\tsx.cmd" mcp\server.ts
