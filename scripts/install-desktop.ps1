$ErrorActionPreference = 'Stop'
$projectRoot = (Resolve-Path (Join-Path $PSScriptRoot '..')).Path
$packageRoot = Join-Path $projectRoot 'release\Chen Studio-win32-x64'
if (-not (Test-Path -LiteralPath (Join-Path $packageRoot 'Chen Studio.exe'))) {
    throw 'Desktop package is missing. Run npm run desktop:package first.'
}

$installRoot = Join-Path $env:LOCALAPPDATA 'Chen Studio'
$desktop = [Environment]::GetFolderPath('Desktop')
New-Item -ItemType Directory -Path $installRoot -Force | Out-Null
if (Get-Process -Name 'Chen Studio' -ErrorAction SilentlyContinue) {
    throw 'Close Chen Studio before installing this update.'
}
Copy-Item -Path (Join-Path $packageRoot '*') -Destination $installRoot -Recurse -Force

$shell = New-Object -ComObject WScript.Shell
$shortcutPath = Join-Path $desktop 'Chen Studio.lnk'
$shortcut = $shell.CreateShortcut($shortcutPath)
$shortcut.TargetPath = Join-Path $installRoot 'Chen Studio.exe'
$shortcut.Arguments = ''
$shortcut.WorkingDirectory = $installRoot
$shortcut.IconLocation = $shortcut.TargetPath
$shortcut.Description = 'Chen Studio - classical ER and EER diagram editor'
$shortcut.Save()
Write-Output "Installed Chen Studio at $installRoot"
Write-Output "Desktop shortcut: $shortcutPath"
