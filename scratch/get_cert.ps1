Add-Type -AssemblyName System.IO.Compression.FileSystem
$zip = [System.IO.Compression.ZipFile]::OpenRead("scratch/latest_v5.apk")
$meta = $zip.Entries | Where-Object { $_.FullName -like "META-INF/*" }
foreach ($m in $meta) {
    Write-Host $m.FullName $m.Length
    if ($m.FullName -like "*.RSA" -or $m.FullName -like "*.DSA" -or $m.FullName -like "*.EC") {
        $dest = Join-Path "scratch" (Split-Path $m.FullName -Leaf)
        [System.IO.Compression.ZipFileExtensions]::ExtractToFile($m, $dest, $true)
        Write-Host "Extracted certificate file to $dest"
    }
}
$zip.Dispose()
