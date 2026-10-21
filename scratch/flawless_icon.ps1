Add-Type -AssemblyName System.Drawing

$srcPath = "friend\WhatsApp Image 2026-10-16 at 11.01.50 AM.jpeg"
$src = [System.Drawing.Bitmap]::FromFile($srcPath)

$w = $src.Width
$h = $src.Height

# Deep rich crimson edge color from the badge
$redEdge = [System.Drawing.Color]::FromArgb(255, 138, 2, 10)

# Replace white ONLY in the extreme outer corners (< 80px) and bottom padding (> 1220)
for ($x = 0; $x -lt $w; $x++) {
    for ($y = 0; $y -lt $h; $y++) {
        $c = $src.GetPixel($x, $y)
        if ($c.R -gt 200 -and $c.G -gt 200 -and $c.B -gt 200) {
            $distTL = [Math]::Sqrt($x*$x + $y*$y)
            $distTR = [Math]::Sqrt(($w-1-$x)*($w-1-$x) + $y*$y)
            $distBL = [Math]::Sqrt($x*$x + ($h-1-$y)*($h-1-$y))
            $distBR = [Math]::Sqrt(($w-1-$x)*($w-1-$x) + ($h-1-$y)*($h-1-$y))

            $isCorner = ($distTL -lt 95 -or $distTR -lt 95 -or $distBL -lt 95 -or $distBR -lt 95)
            $isBottomBar = ($y -gt 1220)
            $isExtremeEdge = ($x -lt 8 -or $x -gt ($w - 9) -or $y -lt 8)

            if ($isCorner -or $isBottomBar -or $isExtremeEdge) {
                $src.SetPixel($x, $y, $redEdge)
            }
        }
    }
}

# Crop the bottom white bar (height: 1220)
$cropRect = New-Object System.Drawing.Rectangle(0, 0, $w, 1220)
$cropBmp = New-Object System.Drawing.Bitmap($w, 1220, [System.Drawing.Imaging.PixelFormat]::Format32bppArgb)
$gCrop = [System.Drawing.Graphics]::FromImage($cropBmp)
$gCrop.DrawImage($src, 0, 0, $cropRect, [System.Drawing.GraphicsUnit]::Pixel)
$gCrop.Dispose()
$src.Dispose()

# Scale to 1024 x 1024
$final1024 = New-Object System.Drawing.Bitmap(1024, 1024, [System.Drawing.Imaging.PixelFormat]::Format32bppArgb)
$g1024 = [System.Drawing.Graphics]::FromImage($final1024)
$g1024.InterpolationMode = [System.Drawing.Drawing2D.InterpolationMode]::HighQualityBicubic
$g1024.SmoothingMode = [System.Drawing.Drawing2D.SmoothingMode]::HighQuality
$g1024.DrawImage($cropBmp, 0, 0, 1024, 1024)
$g1024.Dispose()
$cropBmp.Dispose()

$final1024.Save("scratch\flawless_icon_1024.png", [System.Drawing.Imaging.ImageFormat]::Png)
Write-Host "Created scratch\flawless_icon_1024.png"

# Simulate Vivo Squircle (Phone Home Screen)
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
$gVivo.DrawImage($final1024, 0, 0, 512, 512)
$gVivo.Dispose()
$vivoSim.Save("scratch\flawless_vivo_preview.png", [System.Drawing.Imaging.ImageFormat]::Png)
Write-Host "Created scratch\flawless_vivo_preview.png"

$final1024.Dispose()
$vivoSim.Dispose()
