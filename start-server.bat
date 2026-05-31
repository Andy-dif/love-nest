@echo off
chcp 65001 >nul 2>&1
cd /d "%~dp0"
echo Starting Love Nest server...
start "" /B pythonw server.py
if errorlevel 1 (
    echo pythonw failed, trying python...
    start "" /B python server.py
)
echo Server started! Visit http://localhost:8888
