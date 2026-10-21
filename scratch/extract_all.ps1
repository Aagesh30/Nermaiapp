Add-Type -AssemblyName System.IO.Compression.FileSystem
$destDir = "scratch/all_apk_images"
if (-not (Test-Path $destDir)) { New-Item -ItemType Directory -Path $destDir | Out-Null }
$zip = [System.IO.Compression.ZipFile]::OpenRead("scratch/latest_v5.apk")
foreach ($e in $zip.Entries) {
    if ($e.FullName -like "*.png" -or $e.FullName -like "*.webp") {
        $safeName = $e.FullName.Replace("/", "_")
        $destPath = Join-Path $destDir $safeName
        [System.IO.Compression.ZipFileExtensions]::ExtractToFile($e, $destPath, $true)
    }
}
$zip.Dispose()
Write-Host "Extracted all images from APK"
