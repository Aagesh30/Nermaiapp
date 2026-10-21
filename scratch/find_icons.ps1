Add-Type -AssemblyName System.Drawing
$dir = "scratch/all_apk_images"
$files = Get-ChildItem -Path $dir -Include *.png,*.webp -Recurse
foreach ($f in $files) {
    try {
        $img = [System.Drawing.Image]::FromFile($f.FullName)
        $w = $img.Width
        $h = $img.Height
        $img.Dispose()
        if ($w -eq $h -and ($w -in 48, 72, 96, 108, 144, 162, 192, 216, 324, 432, 512, 1024)) {
            Write-Host "$($f.Name) : ${w}x${h}"
        }
    } catch {}
}
