Add-Type -AssemblyName System.Drawing

$srcPath = "d:\unistrix\NERMAI_IAS_ACADEMY\friend\WhatsApp Image 2026-10-16 at 2.51.07 PM.jpeg"
$src = [System.Drawing.Bitmap]::FromFile($srcPath)

# Crop from y=0 to y=380 (just before the white card starts)
$w = $src.Width
$h = 380
$rect = New-Object System.Drawing.Rectangle(0, 0, $w, $h)
$crop = $src.Clone($rect, $src.PixelFormat)

$crop.Save("d:\unistrix\NERMAI_IAS_ACADEMY\scratch\header_exact.png", [System.Drawing.Imaging.ImageFormat]::Png)

$crop.Dispose()
$src.Dispose()
Write-Host "Exact header saved to scratch\header_exact.png"
