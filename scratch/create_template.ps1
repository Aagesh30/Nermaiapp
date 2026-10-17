Add-Type -AssemblyName System.Drawing

$src = [System.Drawing.Bitmap]::FromFile("d:\unistrix\NERMAI_IAS_ACADEMY\friend\WhatsApp Image 2026-10-16 at 2.51.07 PM.jpeg")
$bmp = New-Object System.Drawing.Bitmap($src.Width, $src.Height)
$g = [System.Drawing.Graphics]::FromImage($bmp)
$g.DrawImage($src, 0, 0, $src.Width, $src.Height)

# Fill inner card with white (from x=180 to 998, y=425 to 1245)
# This clears out the static text inside the card so our real interactive inputs go there!
$whiteBrush = New-Object System.Drawing.SolidBrush([System.Drawing.Color]::White)
$g.FillRectangle($whiteBrush, 180, 425, (998 - 180), (1240 - 425))

$bmp.Save("d:\unistrix\NERMAI_IAS_ACADEMY\scratch\template_cleared.png", [System.Drawing.Imaging.ImageFormat]::Png)

$g.Dispose()
$bmp.Dispose()
$src.Dispose()
Write-Host "Created template_cleared.png"
