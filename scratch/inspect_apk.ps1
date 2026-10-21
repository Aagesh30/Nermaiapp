Add-Type -AssemblyName System.IO.Compression.FileSystem
$destDir = "scratch/apk_icons"
if (-not (Test-Path $destDir)) { New-Item -ItemType Directory -Path $destDir | Out-Null }
$zip = [System.IO.Compression.ZipFile]::OpenRead("scratch/latest_v5.apk")
$images = $zip.Entries | Where-Object { $_.FullName -like "res/*.png" -or $_.FullName -like "res/*.webp" } | Sort-Object -Property Length -Descending | Select-Object -First 20
foreach ($e in $images) {
    Write-Host $e.FullName $e.Length
    $safeName = $e.FullName.Replace("/", "_")
    $destPath = Join-Path $destDir $safeName
    [System.IO.Compression.ZipFileExtensions]::ExtractToFile($e, $destPath, $true)
}
$zip.Dispose()
