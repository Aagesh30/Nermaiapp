Add-Type -AssemblyName System.Drawing

$srcPath = "d:\unistrix\NERMAI_IAS_ACADEMY\friend\WhatsApp Image 2026-10-16 at 11.01.50 AM.jpeg"
$src = [System.Drawing.Bitmap]::FromFile($srcPath)

$w = [int]$src.Width
$h = [int]$src.Height

# Clip squircle
$path = New-Object System.Drawing.Drawing2D.GraphicsPath
$radius = [int]($w * 0.22)
$d = [int]($radius * 2)
$rw = [int]($w - 20)
$rh = [int]($h - 20)

$path.AddArc(10, 10, $d, $d, 180, 90)
$path.AddArc(($rw + 10 - $d), 10, $d, $d, 270, 90)
$path.AddArc(($rw + 10 - $d), ($rh + 10 - $d), $d, $d, 0, 90)
$path.AddArc(10, ($rh + 10 - $d), $d, $d, 90, 90)
$path.CloseFigure()

$badgeBmp = New-Object System.Drawing.Bitmap($w, $h, [System.Drawing.Imaging.PixelFormat]::Format32bppArgb)
$gBadge = [System.Drawing.Graphics]::FromImage($badgeBmp)
$gBadge.SmoothingMode = [System.Drawing.Drawing2D.SmoothingMode]::HighQuality
$gBadge.InterpolationMode = [System.Drawing.Drawing2D.InterpolationMode]::HighQualityBicubic
$gBadge.PixelOffsetMode = [System.Drawing.Drawing2D.PixelOffsetMode]::HighQuality
$gBadge.Clip = New-Object System.Drawing.Region($path)
$gBadge.DrawImage($src, 0, 0, $w, $h)
$gBadge.Dispose()

$canvasSize = 1024
$targetBadgeSize = 520
$offsetX = [int](($canvasSize - $targetBadgeSize) / 2)
$offsetY = [int](($canvasSize - $targetBadgeSize) / 2)

$adaptiveBmp = New-Object System.Drawing.Bitmap($canvasSize, $canvasSize, [System.Drawing.Imaging.PixelFormat]::Format32bppArgb)
$gAdapt = [System.Drawing.Graphics]::FromImage($adaptiveBmp)
$gAdapt.SmoothingMode = [System.Drawing.Drawing2D.SmoothingMode]::HighQuality
$gAdapt.InterpolationMode = [System.Drawing.Drawing2D.InterpolationMode]::HighQualityBicubic
$gAdapt.PixelOffsetMode = [System.Drawing.Drawing2D.PixelOffsetMode]::HighQuality

# Rich crimson gradient background
$gradBrush = New-Object System.Drawing.Drawing2D.LinearGradientBrush(
    (New-Object System.Drawing.Point(0, 0)),
    (New-Object System.Drawing.Point(1024, 1024)),
    [System.Drawing.ColorTranslator]::FromHtml("#7A0000"),
    [System.Drawing.ColorTranslator]::FromHtml("#380000")
)
$gAdapt.FillRectangle($gradBrush, 0, 0, $canvasSize, $canvasSize)

# Subtle shadow
$sRadius = [int]($targetBadgeSize * 0.22)
$sd = [int]($sRadius * 2)
$shadowPath = New-Object System.Drawing.Drawing2D.GraphicsPath
$sx = [int]($offsetX + 4)
$sy = [int]($offsetY + 8)
$sw = [int]$targetBadgeSize
$sh = [int]$targetBadgeSize
$shadowPath.AddArc($sx, $sy, $sd, $sd, 180, 90)
$shadowPath.AddArc(($sx + $sw - $sd), $sy, $sd, $sd, 270, 90)
$shadowPath.AddArc(($sx + $sw - $sd), ($sy + $sh - $sd), $sd, $sd, 0, 90)
$shadowPath.AddArc($sx, ($sy + $sh - $sd), $sd, $sd, 90, 90)
$shadowPath.CloseFigure()
$shadowBrush = New-Object System.Drawing.SolidBrush([System.Drawing.Color]::FromArgb(120, 0, 0, 0))
$gAdapt.FillPath($shadowBrush, $shadowPath)

# Draw badge
$gAdapt.DrawImage($badgeBmp, $offsetX, $offsetY, $targetBadgeSize, $targetBadgeSize)
$gAdapt.Dispose()

# Also create favicon (64x64)
$favBmp = New-Object System.Drawing.Bitmap(64, 64, [System.Drawing.Imaging.PixelFormat]::Format32bppArgb)
$gFav = [System.Drawing.Graphics]::FromImage($favBmp)
$gFav.SmoothingMode = [System.Drawing.Drawing2D.SmoothingMode]::HighQuality
$gFav.InterpolationMode = [System.Drawing.Drawing2D.InterpolationMode]::HighQualityBicubic
$gFav.PixelOffsetMode = [System.Drawing.Drawing2D.PixelOffsetMode]::HighQuality
$gFav.DrawImage($adaptiveBmp, 0, 0, 64, 64)
$gFav.Dispose()

# Destinations:
$destDirs = @(
    "d:\unistrix\NERMAI_IAS_ACADEMY\web_portal\assets",
    "d:\unistrix\NERMAI_IAS_ACADEMY\assets"
)

foreach ($dir in $destDirs) {
    if (Test-Path $dir) {
        $adaptiveBmp.Save("$dir\android-icon-foreground.png", [System.Drawing.Imaging.ImageFormat]::Png)
        $adaptiveBmp.Save("$dir\icon.png", [System.Drawing.Imaging.ImageFormat]::Png)
        $favBmp.Save("$dir\favicon.png", [System.Drawing.Imaging.ImageFormat]::Png)
        Write-Host "Updated assets in $dir"
    }
}

$src.Dispose()
$badgeBmp.Dispose()
$adaptiveBmp.Dispose()
$favBmp.Dispose()
Write-Host "All icons generated and saved successfully!"
