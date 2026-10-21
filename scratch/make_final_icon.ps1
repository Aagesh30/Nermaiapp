Add-Type -AssemblyName System.Drawing

$srcPath = "friend\WhatsApp Image 2026-10-16 at 11.01.50 AM.jpeg"
$src = [System.Drawing.Bitmap]::FromFile($srcPath)

# The red badge in source is from (0, 0) to (1253, 1220)
# Height of badge = 1220
# Width of badge = 1254
# We crop the badge region (0, 0, 1254, 1220) so the bottom white bar is gone
$cropBmp = New-Object System.Drawing.Bitmap(1254, 1220, [System.Drawing.Imaging.PixelFormat]::Format32bppArgb)
$gCrop = [System.Drawing.Graphics]::FromImage($cropBmp)
$gCrop.DrawImage($src, 0, 0, (New-Object System.Drawing.Rectangle(0, 0, 1254, 1220)), [System.Drawing.GraphicsUnit]::Pixel)
$gCrop.Dispose()
$src.Dispose()

# Now scale to 1024x1024
$icon1024 = New-Object System.Drawing.Bitmap(1024, 1024, [System.Drawing.Imaging.PixelFormat]::Format32bppArgb)
$g1024 = [System.Drawing.Graphics]::FromImage($icon1024)
$g1024.InterpolationMode = [System.Drawing.Drawing2D.InterpolationMode]::HighQualityBicubic
$g1024.DrawImage($cropBmp, 0, 0, 1024, 1024)
$g1024.Dispose()
$cropBmp.Dispose()

# Now fill the 4 white corners with the exact matching crimson color (#880006)
# Corner threshold: if pixel is within 140px of a corner and is near-white
$crimsonEdge = [System.Drawing.Color]::FromArgb(255, 136, 0, 6)

for ($x = 0; $x -lt 1024; $x++) {
    for ($y = 0; $y -lt 1024; $y++) {
        $distTopLeft = [Math]::Sqrt($x*$x + $y*$y)
        $distTopRight = [Math]::Sqrt((1023-$x)*(1023-$x) + $y*$y)
        $distBottomLeft = [Math]::Sqrt($x*$x + (1023-$y)*(1023-$y))
        $distBottomRight = [Math]::Sqrt((1023-$x)*(1023-$x) + (1023-$y)*(1023-$y))

        $minDist = [Math]::Min([Math]::Min($distTopLeft, $distTopRight), [Math]::Min($distBottomLeft, $distBottomRight))
        if ($minDist -lt 120) {
            $c = $icon1024.GetPixel($x, $y)
            # If it's near-white or light grey
            if ($c.R -gt 190 -and $c.G -gt 190 -and $c.B -gt 190) {
                $icon1024.SetPixel($x, $y, $crimsonEdge)
            }
        }
    }
}

# Save final 1024x1024 icon
$icon1024.Save("scratch\final_clean_icon_1024.png", [System.Drawing.Imaging.ImageFormat]::Png)
Write-Host "Created scratch\final_clean_icon_1024.png"

# Now simulate Vivo Home Screen icon (512x512 with Vivo squircle radius 100)
$vivoSim = New-Object System.Drawing.Bitmap(512, 512, [System.Drawing.Imaging.PixelFormat]::Format32bppArgb)
$gVivo = [System.Drawing.Graphics]::FromImage($vivoSim)
$gVivo.SmoothingMode = [System.Drawing.Drawing2D.SmoothingMode]::HighQuality
$gVivo.InterpolationMode = [System.Drawing.Drawing2D.InterpolationMode]::HighQualityBicubic

$squircle = New-Object System.Drawing.Drawing2D.GraphicsPath
$r = 105
$squircle.AddArc(0, 0, $r*2, $r*2, 180, 90)
$squircle.AddArc(512 - $r*2, 0, $r*2, $r*2, 270, 90)
$squircle.AddArc(512 - $r*2, 512 - $r*2, $r*2, $r*2, 0, 90)
$squircle.AddArc(0, 512 - $r*2, $r*2, $r*2, 90, 90)
$squircle.CloseFigure()

$gVivo.SetClip($squircle)
$gVivo.DrawImage($icon1024, 0, 0, 512, 512)
$gVivo.Dispose()
$vivoSim.Save("scratch\final_vivo_screen_preview.png", [System.Drawing.Imaging.ImageFormat]::Png)
Write-Host "Created scratch\final_vivo_screen_preview.png"

$icon1024.Dispose()
$vivoSim.Dispose()
