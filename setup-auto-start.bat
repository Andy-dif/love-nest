@echo off
chcp 65001 >nul
echo ========================================
echo   💕 恋爱小窝 - 设置开机自启动
echo   李安 ❤️ 韩舒薇
echo ========================================
echo.

set SCRIPT_DIR=%~dp0
set VBS_FILE=%SCRIPT_DIR%start-server-silent.vbs
set STARTUP_DIR=%APPDATA%\Microsoft\Windows\Start Menu\Programs\Startup
set SHORTCUT=%STARTUP_DIR%\恋爱小窝.lnk

echo [1/3] 正在创建开机启动快捷方式...
echo       目标: %VBS_FILE%
echo       位置: %SHORTCUT%

powershell -Command "$WshShell = New-Object -ComObject WScript.Shell; $Shortcut = $WshShell.CreateShortcut('%SHORTCUT%'); $Shortcut.TargetPath = '%VBS_FILE%'; $Shortcut.WorkingDirectory = '%SCRIPT_DIR%'; $Shortcut.Description = '恋爱小窝 - 李安 ❤️ 韩舒薇'; $Shortcut.Save()"

if exist "%SHORTCUT%" (
    echo       ✅ 开机启动快捷方式创建成功！
) else (
    echo       ⚠️  快捷方式创建失败，尝试备用方法...
    copy "%VBS_FILE%" "%STARTUP_DIR%" >nul 2>&1
)

echo.
echo [2/3] 正在创建桌面快捷方式...

set DESKTOP=%USERPROFILE%\Desktop
set DESKTOP_SHORTCUT=%DESKTOP%\恋爱小窝.url

(
echo [InternetShortcut]
echo URL=http://localhost:8888
echo IconFile=%SCRIPT_DIR%favicon.ico
echo IconIndex=0
) > "%DESKTOP_SHORTCUT%"

echo       ✅ 桌面快捷方式创建成功！

echo.
echo [3/3] 正在启动服务器...
start "" pythonw "%SCRIPT_DIR%server.py" 2>nul
if errorlevel 1 (
    echo       ⚠️  pythonw 不可用，使用 python 启动...
    start "" /B python "%SCRIPT_DIR%server.py"
)

echo       ✅ 服务器已启动！
echo.
echo ========================================
echo   🎉 设置完成！
echo.
echo   📍 本机访问: http://localhost:8888
echo   👦 李安入口: http://localhost:8888#li
echo   👧 舒薇入口: http://localhost:8888#han
echo.
echo   💡 每次开机服务器会自动启动
echo   💡 桌面上的"恋爱小窝"快捷方式可直接打开
echo   💡 关闭浏览器不影响服务器运行
echo ========================================
echo.
pause
