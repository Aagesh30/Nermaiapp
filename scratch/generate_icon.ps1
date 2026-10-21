Add-Type -AssemblyName System.Drawing

$srcPath = "friend\WhatsApp Image 2026-10-16 at 11.01.50 AM.jpeg"
$src = [System.Drawing.Bitmap]::FromFile($srcPath)
Write-Host "Source image size: $($src.Width)x$($src.Height)"

# Target Canvas: 1024 x 1024
$canvasSize = 1024
$outBmp = New-Object System.Drawing.Bitmap($canvasSize, $canvasSize, [System.Drawing.Imaging.PixelFormat]::Format32bppArgb)
$g = [System.Drawing.Graphics]::FromImage($outBmp)
$g.InterpolationMode = [System.Drawing.Drawing2D.InterpolationMode]::HighQualityBicubic
$g.SmoothingMode = [System.Drawing.Drawing2D.SmoothingMode]::HighQuality
$g.PixelOffsetMode = [System.Drawing.Drawing2D.PixelOffsetMode]::HighQuality

# Background: Solid rich crimson gradient filling the entire 1024x1024 square with 100% opacity
# Center color: #8A0000, Outer edges: #580000
$rect = New-Object System.Drawing.Rectangle(0, 0, $canvasSize, $canvasSize)
$path = New-Object System.Drawing.Drawing2D.GraphicsPath
$path.AddRectangle($rect)
$brush = New-Object System.Drawing.Drawing2D.PathGradientBrush($path)
$brush.CenterColor = [System.Drawing.Color]::FromArgb(255, 138, 0, 0)
$surroundColors = @([System.Drawing.Color]::FromArgb(255, 80, 0, 0))
$brush.SurroundColors = $surroundColors
$g.FillRectangle($brush, $rect)

# In the source image, the red rounded card occupies approximately pixels (50, 50) to (W-50, H-50)
# We crop the emblem and text from source and scale it to fit within the Android Safe Zone (diameter = 66% = 675px)
# Target safe diameter: 680px
$targetContentSize = 680
$targetX = [int](($canvasSize - $targetContentSize) / 2)
$targetY = [int](($canvasSize - $targetContentSize) / 2)

# Draw the source image content scaled into the safe zone
# Source inner content: from x=50, y=50, width=W-100, height=H-100
$srcCropX = [int]($src.Width * 0.05)
$srcCropY = [int]($src.Height * 0.05)
$srcCropW = [int]($src.Width * 0.90)
$srcCropH = [int]($src.Height * 0.90)
$destRect = New-Object System.Drawing.Rectangle($targetX, $targetY, $targetContentSize, $targetContentSize)
$srcRect = New-Object System.Drawing.Rectangle($srcCropX, $srcCropY, $srcCropW, $srcCropH)

$g.DrawImage($src, $destRect, $srcRect, [System.Drawing.GraphicsUnit]::Pixel)

$g.Dispose()
$brush.Dispose()
$path.Dispose()

# Save final 1024x1024 full-bleed icon
$outBmp.Save("scratch\new_icon_full_bleed.png", [System.Drawing.Imaging.ImageFormat]::Png)
Write-Host "Created scratch\new_icon_full_bleed.png"

# Now create preview 1: With the Android Safe Zone Grid Overlay
$gridBmp = New-Object System.Drawing.Bitmap($outBmp)
$gGrid = [System.Drawing.Graphics]::FromImage($gridBmp)
$gGrid.SmoothingMode = [System.Drawing.Drawing2D.SmoothingMode]::AntiAlias

# Draw Grid Lines
$penGrid = New-Object System.Drawing.Pen([System.Drawing.Color]::FromArgb(180, 255, 255, 255), 2)
$penSafe = New-Object System.Drawing.Pen([System.Drawing.Color]::FromArgb(255, 0, 255, 0), 3) # Green safe line
$penOuter = New-Object System.Drawing.Pen([System.Drawing.Color]::FromArgb(200, 255, 255, 0), 2) # Yellow mask line

# Center crosshairs
$gGrid.DrawLine($penGrid, 512, 0, 512, 1024)
$gGrid.DrawLine($penGrid, 0, 512, 1024, 512)

# Grid subdivisions (every 128px)
for ($i = 128; $i -lt 1024; $i += 128) {
    $gGrid.DrawLine($penGrid, $i, 0, $i, 1024)
    $gGrid.DrawLine($penGrid, 0, $i, 1024, $i)
}

# Android Safe Zone Circle (66% = diameter 676px, radius 338px)
$safeD = 676
$safeR = [int]((1024 - $safeD) / 2)
$gGrid.DrawEllipse($penSafe, $safeR, $safeR, $safeD, $safeD)

# Android Outer Mask Circle (diameter 864px)
$outerD = 864
$outerR = [int]((1024 - $outerD) / 2)
$gGrid.DrawEllipse($penOuter, $outerR, $outerR, $outerD, $outerD)

$gGrid.Dispose()
$gridBmp.Save("scratch\preview_with_safe_zone_grid.png", [System.Drawing.Imaging.ImageFormat]::Png)
Write-Host "Created scratch\preview_with_safe_zone_grid.png"

# Now create preview 2: Masked as Vivo Squircle on phone desktop
$vivoBmp = New-Object System.Drawing.Bitmap(512, 512, [System.Drawing.Imaging.PixelFormat]::Format32bppArgb)
$gVivo = [System.Drawing.Graphics]::FromImage($vivoBmp)
$gVivo.SmoothingMode = [System.Drawing.Drawing2D.SmoothingMode]::HighQuality
$gVivo.InterpolationMode = [System.Drawing.Drawing2D.InterpolationMode]::HighQualityBicubic

# Create a rounded squircle clip (Vivo launcher shape)
$squircle = New-Object System.Drawing.Drawing2D.GraphicsPath
$r = 100 # corner radius for 512x512
$squircle.AddArc(0, 0, $r*2, $r*2, 180, 90)
$squircle.AddArc(512 - $r*2, 0, $r*2, $r*2, 270, 90)
$squircle.AddArc(512 - $r*2, 512 - $r*2, $r*2, $r*2, 0, 90)
$squircle.AddArc(0, 512 - $r*2, $r*2, $r*2, 90, 90)
$squircle.CloseFigure()

$gVivo.SetClip($squircle)
$gVivo.DrawImage($outBmp, 0, 0, 512, 512)
$gVivo.Dispose()
$vivoBmp.Save("scratch\preview_vivo_phone_icon.png", [System.Drawing.Imaging.ImageFormat]::Png)
Write-Host "Created scratch\preview_vivo_phone_icon.png"

$src.Dispose()
$outBmp.Dispose()
$gridBmp.Dispose()
$vivoBmp.Dispose()
