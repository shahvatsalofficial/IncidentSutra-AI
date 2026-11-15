@echo off
node "%~dp0..\packages\cli\index.mjs" skills install --host %1 --project %2
