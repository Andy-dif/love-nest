' 恋爱小窝 - Silent Server Starter
' 李安 ❤️ 韩舒薇
' This script starts the Python server with NO terminal window visible
' It runs silently in the background when Windows starts

Set WshShell = CreateObject("WScript.Shell")
Set FSO = CreateObject("Scripting.FileSystemObject")

' Get the directory where this script is located
scriptDir = FSO.GetParentFolderName(WScript.ScriptFullName)
serverScript = scriptDir & "\server.py"

' Try multiple Python paths (most reliable first)
pythonPaths = Array( _
    "C:\Users\x\AppData\Local\Programs\Python\Python312\pythonw.exe", _
    "pythonw", _
    "python" _
)

Dim started : started = False
For Each pyPath in pythonPaths
    If Not started Then
        ' Check if python exists by trying to run it
        On Error Resume Next
        WshShell.Run """" & pyPath & """ """ & serverScript & """", 0, False
        If Err.Number = 0 Then
            started = True
        End If
        On Error Goto 0
    End If
Next

If Not started Then
    ' Last resort: use cmd to start python
    WshShell.Run "cmd /c python """ & serverScript & """", 0, False
End If
