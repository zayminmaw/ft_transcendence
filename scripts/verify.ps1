$ErrorActionPreference = 'Stop'
Push-Location (Join-Path $PSScriptRoot '..')
try {
  & npm.cmd run verify
  if ($LASTEXITCODE -ne 0) { throw "Verification failed with exit code $LASTEXITCODE." }
} finally {
  Pop-Location
}
