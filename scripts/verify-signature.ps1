param(
    [Parameter(Mandatory)][string]$Path,
    [Parameter(Mandatory)][string]$Thumbprint
)
$ErrorActionPreference = 'Stop'
if ($Thumbprint -notmatch '^[0-9a-fA-F]{40}$') { throw 'Expected a SHA-1 signing certificate thumbprint' }
$signature = Get-AuthenticodeSignature -LiteralPath $Path
if ($signature.Status -ne 'Valid') { throw "Invalid Authenticode signature: $($signature.Status)" }
if ($signature.SignerCertificate.Thumbprint -ne $Thumbprint) { throw 'Unexpected signing certificate' }
if (!$signature.TimeStamperCertificate) { throw 'Missing trusted signing timestamp' }
Write-Output "Verified signed artifact: $Path"
