Add-Type -AssemblyName System.Drawing

$srcPath = "friend\WhatsApp Image 2026-10-16 at 11.01.50 AM.jpeg"
$src = [System.Drawing.Bitmap]::FromFile($srcPath)

# 1. Clean up the source bitmap: remove all white corners and white bottom padding
# The badge center is (627, 610)
$cleanedSrc = New-Object System.Drawing.Bitmap($src.Width, $src.Height, [System.Drawing.Imaging.PixelFormat]::Format32bppArgb)
$edgeCrimson = [System.Drawing.Color]::FromArgb(255, 125, 2, 8)

for ($x = 0; $x -lt $src.Width; $x++) {
    for ($y = 0; $y -lt $src.Height; $y++) {
        $c = $src.GetPixel($x, $y)
        # If in the corner region or bottom strip, and pixel is near white
        $isCorner = ($x -lt 150 -or $x -gt 1100) -and ($y -lt 150 -or $y -gt 1100)
        $isBottom = ($y -gt 1215)
        if (($isCorner -or $isBottom) -and ($c.R -gt 180 -and $c.G -gt 180 -and $c.B -gt 180)) {
            # Fill with matching deep crimson edge color
            $cleanedSrc.SetPixel($x, $y, $edgeCrimson)
        } else {
            $cleanedSrc.SetPixel($x, $y, $c)
        }
    }
}
$src.Dispose()

# 2. Create the master 1024x1024 icon
# Entire background is 100% full-bleed crimson gradient, 0% transparency
$canvasSize = 1024
$outBmp = New-Object System.Drawing.Bitmap($canvasSize, $canvasSize, [System.Drawing.Imaging.PixelFormat]::Format32bppArgb)
$g = [System.Drawing.Graphics]::FromImage($outBmp)
$g.InterpolationMode = [System.Drawing.Drawing2D.InterpolationMode]::HighQualityBicubic
$g.SmoothingMode = [System.Drawing.Drawing2D.SmoothingMode]::HighQuality
$g.PixelOffsetMode = [System.Drawing.Drawing2D.PixelOffsetMode]::HighQuality

# Solid background fill: Rich deep crimson (#7B0000 to #4A0000)
$rect = New-Object System.Drawing.Rectangle(0, 0, $canvasSize, $canvasSize)
$path = New-Object System.Drawing.Drawing2D.GraphicsPath
$path.AddRectangle($rect)
$brush = New-Object System.Drawing.Drawing2D.PathGradientBrush($path)
$brush.CenterColor = [System.Drawing.Color]::FromArgb(255, 138, 2, 10)
$brush.SurroundColors = @([System.Drawing.Color]::FromArgb(255, 74, 0, 0))
$g.FillRectangle($brush, $rect)

# 3. Fit content strictly inside the Android Safe Zone (inner circle: 66% = diameter 676px)
# We want the text "NERMAI IAS ACADEMY" and the emblem to have comfortable padding inside the 676px circle
# Target size: 620 x 620 px centered at (512, 512)
$targetW = 620
$targetH = 620
$targetX = [int]((1024 - $targetW) / 2)
$targetY = [int]((1024 - $targetH) / 2)

# Draw cleaned source into the safe zone
$destRect = New-Object System.Drawing.Rectangle($targetX, $targetY, $targetW, $targetH)
$srcRect = New-Object System.Drawing.Rectangle(0, 0, $cleanedSrc.Width, 1220) # exclude bottom white strip
$g.DrawImage($cleanedSrc, $destRect, $srcRect, [System.Drawing.GraphicsUnit]::Pixel)

$g.Dispose()
$brush.Dispose()
$path.Dispose()
$cleanedSrc.Dispose()

# Save final clean 1024x1024 master icon
$outBmp.Save("scratch\perfect_icon_1024.png", [System.Drawing.Imaging.ImageFormat]::Png)
Write-Host "Saved scratch\perfect_icon_1024.png"

# 4. Generate verification preview: Safe Zone Grid Overlay
$gridBmp = New-Object System.Drawing.Bitmap($outBmp)
$gGrid = [System.Drawing.Graphics]::FromImage($gridBmp)
$gGrid.SmoothingMode = [System.Drawing.Drawing2D.SmoothingMode]::AntiAlias

$penGrid = New-Object System.Drawing.Pen([System.Drawing.Color]::FromArgb(120, 255, 255, 255), 1)
$penSafe = New-Object System.Drawing.Pen([System.Drawing.Color]::FromArgb(255, 0, 255, 0), 3) # Green = Safe Zone
$penMask = New-Object System.Drawing.Pen([System.Drawing.Color]::FromArgb(255, 255, 220, 0), 2) # Yellow = Outer Mask

# Draw 8x8 grid
for ($i = 128; $i -lt 1024; $i += 128) {
    $gGrid.DrawLine($penGrid, $i, 0, $i, 1024)
    $gGrid.DrawLine($penGrid, 0, $i, 1024, $i)
}
# Safe zone circle: 66% (diameter 676px)
$safeD = 676
$safeR = [int]((1024 - $safeD) / 2)
$gGrid.DrawEllipse($penSafe, $safeR, $safeR, $safeD, $safeD)
# Outer mask circle: (diameter 864px)
$maskD = 864
$maskR = [int]((1024 - $maskD) / 2)
$gGrid.DrawEllipse($penMask, $maskR, $maskR, $maskD, $maskD)

$gGrid.Dispose()
$gridBmp.Save("scratch\perfect_preview_grid.png", [System.Drawing.Imaging.ImageFormat]::Png)
Write-Host "Saved scratch\perfect_preview_grid.png"

# 5. Generate phone home screen simulation (masked as squircle on phone wallpaper)
$phoneBmp = New-Object System.Drawing.Bitmap(512, 512, [System.Drawing.Imaging.PixelFormat]::Format32bppArgb)
$gPhone = [System.Drawing.Graphics]::FromImage($phoneBmp)
$gPhone.SmoothingMode = [System.Drawing.Drawing2D.SmoothingMode]::HighQuality
$gPhone.InterpolationMode = [System.Drawing.Drawing2D.InterpolationMode]::HighQualityBicubic

$squircle = New-Object System.Drawing.Drawing2D.GraphicsPath
$r = 110 # Vivo squircle radius
$squircle.AddArc(0, 0, $r*2, $r*2, 180, 90)
$squircle.AddArc(512 - $r*2, 0, $r*2, $r*2, 270, 90)
$squircle.AddArc(512 - $r*2, 512 - $r*2, $r*2, $r*2, 0, 90)
$squircle.AddArc(0, 512 - $r*2, $r*2, $r*2, 90, 90)
$squircle.CloseFigure()

$gPhone.SetClip($squircle)
$gPhone.DrawImage($outBmp, 0, 0, 512, 512)
$gPhone.Dispose()
$phoneBmp.Save("scratch\perfect_preview_vivo.png", [System.Drawing.Imaging.ImageFormat]::Png)
Write-Host "Saved scratch\perfect_preview_vivo.png"

$outBmp.Dispose()
$gridBmp.Dispose()
$phoneBmp.Dispose()
