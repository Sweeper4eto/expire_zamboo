# Import Open Beauty / Pet / Products Facts into prod-import.db (food already imported).
# Run in PowerShell so you can watch progress.

$ErrorActionPreference = "Stop"
Set-Location $PSScriptRoot\..

$node = "c:\Program Files\cursor\resources\app\resources\helpers\node.exe"
$tsx = ".\node_modules\tsx\dist\cli.mjs"
$script = ".\scripts\import-open-food-facts.ts"

& $node $tsx $script --source rest --download --all
