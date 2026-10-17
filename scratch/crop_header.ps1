Add-Type -AssemblyName System.Drawing

$srcPath = "d:\unistrix\NERMAI_IAS_ACADEMY\friend\WhatsApp Image 2026-10-16 at 2.51.07 PM.jpeg"
$src = [System.Drawing.Bitmap]::FromFile($srcPath)

# 1. Crop top header (y=0 to y=430)
$headerW = $src.Width
$headerH = 430
$rect = New-Object System.Drawing.Rectangle(0, 0, $headerW, $headerH)
$headerBmp = $src.Clone($rect, $src.PixelFormat)
$headerBmp.Save("d:\unistrix\NERMAI_IAS_ACADEMY\scratch\cropped_header.png", [System.Drawing.Imaging.ImageFormat]::Png)

$headerBmp.Dispose()
$src.Dispose()
Write-Host "Header cropped successfully!"
