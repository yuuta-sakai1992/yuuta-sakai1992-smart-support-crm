@echo off
title SmartSupport AI Launcher

reg add "HKCU\Console\SmartSupportAI_Server" /v QuickEdit /t REG_DWORD /d 0 /f > nul 2>&1

if not exist "venv\Scripts\activate.bat" (
    echo [Setup] Creating venv and installing packages...
    python -m venv venv
    call venv\Scripts\activate.bat
    pip install -r requirements.txt
) else (
    call venv\Scripts\activate.bat
)

start "SmartSupportAI_Server" cmd /c "venv\Scripts\activate.bat && uvicorn app.main:app --reload"
timeout /t 4 /nobreak > nul
start "" http://127.0.0.1:8000
