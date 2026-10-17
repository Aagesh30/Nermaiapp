Add-Type -AssemblyName System.Drawing

$src = [System.Drawing.Bitmap]::FromFile("d:\unistrix\NERMAI_IAS_ACADEMY\friend\WhatsApp Image 2026-10-16 at 2.51.07 PM.jpeg")

# Crop from y=0 to y=435 so the full curve and spacing below "Learn | Practice | Excel" are preserved!
$rect = New-Object System.Drawing.Rectangle(0, 0, $src.Width, 435)
$crop = $src.Clone($rect, $src.PixelFormat)

$crop.Save("d:\unistrix\NERMAI_IAS_ACADEMY\scratch\header_full_curve.png", [System.Drawing.Imaging.ImageFormat]::Png)
$crop.Save("d:\unistrix\NERMAI_IAS_ACADEMY\web_portal\assets\login_banner_bg.png", [System.Drawing.Imaging.ImageFormat]::Png)
$crop.Save("d:\unistrix\NERMAI_IAS_ACADEMY\assets\login_banner_bg.png", [System.Drawing.Imaging.ImageFormat]::Png)

$crop.Dispose()
$src.Dispose()
Write-Host "Created header_full_curve.png with height 435px"
