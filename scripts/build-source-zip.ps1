#Requires -Version 5.1
param(
  [Parameter(Mandatory = $true)]
  [string]$Root,
  [Parameter(Mandatory = $true)]
  [string]$OutZip
)

$ErrorActionPreference = 'Stop'
$Root = (Resolve-Path -LiteralPath $Root).Path
$OutZip = $ExecutionContext.SessionState.Path.GetUnresolvedProviderPathFromPSPath($OutZip)

if (Test-Path -LiteralPath $OutZip) {
  Remove-Item -LiteralPath $OutZip -Force
}

$stage = Join-Path $env:TEMP ('tcm-src-stage-' + [guid]::NewGuid().ToString('n'))
New-Item -ItemType Directory -Path $stage | Out-Null

try {
  $roboArgs = @(
    $Root, $stage, '/E',
    '/XD', '.git',
    '/XD', 'node_modules',
    '/XD', 'student-info-system\.tools',
    '/XD', 'client\node_modules',
    '/XD', 'server\node_modules',
    '/XD', 'client\dist',
    '/XD', 'server\uploads',
    '/XD', 'tools\gen-docx\node_modules',
    '/XD', 'client\.lighthouse',
    '/XD', 'client\.lh-profile',
    '/XD', 'student-info-system\target',
    '/NFL', '/NDL', '/NJH', '/NJS', '/nc', '/ns', '/np'
  )
  $p = Start-Process -FilePath 'robocopy.exe' -ArgumentList $roboArgs -Wait -PassThru -NoNewWindow
  if ($p.ExitCode -ge 8) {
    throw ("robocopy failed: exit " + $p.ExitCode)
  }

  $pruneRel = @(
    'client\node_modules',
    'server\node_modules',
    'tools\gen-docx\node_modules',
    'student-info-system\.tools',
    'student-info-system\target',
    'client\dist',
    'server\uploads',
    'client\.lighthouse',
    'client\.lh-profile'
  )
  foreach ($rel in $pruneRel) {
    $pth = Join-Path $stage $rel
    if (Test-Path -LiteralPath $pth) {
      Remove-Item -LiteralPath $pth -Recurse -Force -ErrorAction SilentlyContinue
    }
  }
  Get-ChildItem -LiteralPath $stage -Recurse -Directory -Force -Filter 'node_modules' -ErrorAction SilentlyContinue |
    ForEach-Object { Remove-Item -LiteralPath $_.FullName -Recurse -Force -ErrorAction SilentlyContinue }

  Get-ChildItem -LiteralPath $stage -Recurse -File -Filter '~$*' -ErrorAction SilentlyContinue | Remove-Item -Force -ErrorAction SilentlyContinue

  $fc = (Get-ChildItem -LiteralPath $stage -Recurse -File | Measure-Object).Count
  if ($fc -lt 1) {
    throw 'staging folder has no files'
  }

  $items = Get-ChildItem -LiteralPath $stage -Force
  if ($items.Count -lt 1) {
    throw 'staging folder has no top-level items'
  }

  Compress-Archive -Path ($items | ForEach-Object { $_.FullName }) -DestinationPath $OutZip -CompressionLevel Optimal -Force

  Write-Host ('OK: ' + $OutZip + ' (' + $fc + ' files)')
}
finally {
  if (Test-Path -LiteralPath $stage) {
    Remove-Item -LiteralPath $stage -Recurse -Force -ErrorAction SilentlyContinue
  }
}
