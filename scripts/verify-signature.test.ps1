$ErrorActionPreference = 'Stop'
$thumbprint = 'A' * 40
function Get-AuthenticodeSignature {
    param($LiteralPath)
    return $global:VeloTestSignature
}
$global:VeloTestSignature = [pscustomobject]@{
    Status = 'Valid'
    SignerCertificate = [pscustomobject]@{ Thumbprint = $thumbprint }
    TimeStamperCertificate = [pscustomobject]@{ Subject = 'Test timestamp' }
}
$verifier = Join-Path $PSScriptRoot 'verify-signature.ps1'
& $verifier -Path test.exe -Thumbprint $thumbprint
foreach ($failure in @('NotSigned', 'WrongSigner', 'NoTimestamp', 'InvalidThumbprint')) {
    $global:VeloTestSignature.Status = if ($failure -eq 'NotSigned') { 'NotSigned' } else { 'Valid' }
    $global:VeloTestSignature.SignerCertificate.Thumbprint = if ($failure -eq 'WrongSigner') { 'B' * 40 } else { $thumbprint }
    $global:VeloTestSignature.TimeStamperCertificate = if ($failure -eq 'NoTimestamp') { $null } else { [pscustomobject]@{ Subject = 'Test timestamp' } }
    $expected = if ($failure -eq 'InvalidThumbprint') { '' } else { $thumbprint }
    $rejected = $false
    try { & $verifier -Path test.exe -Thumbprint $expected } catch { $rejected = $true }
    if (!$rejected) { throw "Verifier accepted $failure" }
}
Write-Output 'Signature verification checks passed: valid, unsigned, wrong signer, missing timestamp, invalid pin'
