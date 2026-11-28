param(
    [Parameter(Mandatory = $true)][string] $Executable,
    [Parameter(Mandatory = $true)][string] $ProfileDirectory
)
$ErrorActionPreference = 'Stop'
$argument = '--user-data-dir="' + $ProfileDirectory + '"'
$browser = Start-Process -FilePath $Executable -WorkingDirectory (Split-Path $Executable) -ArgumentList $argument -PassThru
try {
    $deadline = [DateTime]::UtcNow.AddSeconds(35)
    while ([DateTime]::UtcNow -lt $deadline) {
        Start-Sleep -Milliseconds 250
        $browser.Refresh()
        if ($browser.HasExited) { throw "Vaayvu closed during startup (exit code $($browser.ExitCode))." }
        if ($browser.MainWindowHandle -ne [IntPtr]::Zero -and $browser.MainWindowTitle -match 'Vaayvu') { return }
    }
    throw 'The packaged Vaayvu browser window did not appear.'
} finally {
    $browser.Refresh()
    if (-not $browser.HasExited) {
        [void]$browser.CloseMainWindow()
        if (-not $browser.WaitForExit(4000)) {
            & taskkill.exe /PID $browser.Id /T /F | Out-Null
        }
    }
}
