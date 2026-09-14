@echo off
cd /d "%~dp0"
start "" http://localhost:4470
npx --yes serve -l 4470 .
