Add-Type -AssemblyName System.IO.Compression.FileSystem
$zip = [System.IO.Compression.ZipFile]::OpenRead("scratch/latest_v5.apk")
$arsc = $zip.Entries | Where-Object { $_.FullName -eq "resources.arsc" }
if ($arsc) {
    [System.IO.Compression.ZipFileExtensions]::ExtractToFile($arsc, "scratch/resources.arsc", $true)
    Write-Host "Extracted resources.arsc, size:" $arsc.Length
}
$zip.Dispose()
