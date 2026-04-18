#Requires -Version 5.1
$ErrorActionPreference = 'Stop'
$root = Resolve-Path (Join-Path $PSScriptRoot '..')
Set-Location $root
& node (Join-Path $root 'scripts\generate-deliverables.mjs')
