Add-Type -AssemblyName System.Drawing

# 1. 512x512 App Icon
$iconSrcPath = "d:\unistrix\NERMAI_IAS_ACADEMY\web_portal\assets\icon.png"
$iconDestPath = "d:\unistrix\NERMAI_IAS_ACADEMY\playstore_icon_512x512.png"

$srcImg = [System.Drawing.Image]::FromFile($iconSrcPath)
$iconBmp = New-Object System.Drawing.Bitmap(512, 512)
$iconG = [System.Drawing.Graphics]::FromImage($iconBmp)
$iconG.InterpolationMode = [System.Drawing.Drawing2D.InterpolationMode]::HighQualityBicubic
$iconG.SmoothingMode = [System.Drawing.Drawing2D.SmoothingMode]::HighQuality
$iconG.PixelOffsetMode = [System.Drawing.Drawing2D.PixelOffsetMode]::HighQuality
$iconG.DrawImage($srcImg, 0, 0, 512, 512)
$iconBmp.Save($iconDestPath, [System.Drawing.Imaging.ImageFormat]::Png)
$iconG.Dispose()
$iconBmp.Dispose()
$srcImg.Dispose()
Write-Host "Created 512x512 icon at: $iconDestPath"

# 2. 1024x500 Feature Graphic
$fgDestPath = "d:\unistrix\NERMAI_IAS_ACADEMY\playstore_feature_graphic_1024x500.png"
$fgBmp = New-Object System.Drawing.Bitmap(1024, 500)
$fgG = [System.Drawing.Graphics]::FromImage($fgBmp)
$fgG.InterpolationMode = [System.Drawing.Drawing2D.InterpolationMode]::HighQualityBicubic
$fgG.SmoothingMode = [System.Drawing.Drawing2D.SmoothingMode]::HighQuality
$fgG.PixelOffsetMode = [System.Drawing.Drawing2D.PixelOffsetMode]::HighQuality

# Background gradient: Maroon #7b0000 to #4a0000
$bgBrush = New-Object System.Drawing.Drawing2D.LinearGradientBrush(
    (New-Object System.Drawing.Point(0, 0)),
    (New-Object System.Drawing.Point(1024, 500)),
    [System.Drawing.ColorTranslator]::FromHtml("#800000"),
    [System.Drawing.ColorTranslator]::FromHtml("#400000")
)
$fgG.FillRectangle($bgBrush, 0, 0, 1024, 500)

# Draw Logo centered at top/middle
$logoSrcPath = "d:\unistrix\NERMAI_IAS_ACADEMY\web_portal\assets\logo.png"
if (Test-Path $logoSrcPath) {
    $logoImg = [System.Drawing.Image]::FromFile($logoSrcPath)
    # Size 240x250 centered horizontally at y=50
    $logoW = 220
    $logoH = 230
    $logoX = [int]((1024 - $logoW) / 2)
    $logoY = 40
    $fgG.DrawImage($logoImg, $logoX, $logoY, $logoW, $logoH)
    $logoImg.Dispose()
}

# Add Title text: NERMAI IAS ACADEMY
$titleFont = New-Object System.Drawing.Font("Arial", 28, [System.Drawing.FontStyle]::Bold)
$titleBrush = New-Object System.Drawing.SolidBrush([System.Drawing.ColorTranslator]::FromHtml("#FFD700")) # Gold
$stringFormat = New-Object System.Drawing.StringFormat
$stringFormat.Alignment = [System.Drawing.StringAlignment]::Center
$fgG.DrawString("NERMAI IAS ACADEMY", $titleFont, $titleBrush, 512, 300, $stringFormat)

# Add Subtitle text: Public Learning & Examination Portal
$subFont = New-Object System.Drawing.Font("Arial", 16, [System.Drawing.FontStyle]::Regular)
$subBrush = New-Object System.Drawing.SolidBrush([System.Drawing.Color]::White)
$fgG.DrawString("Public Learning & Examination Portal", $subFont, $subBrush, 512, 360, $stringFormat)

# Add Tagline: UPSC | TNPSC | Civil Services Coaching
$tagFont = New-Object System.Drawing.Font("Arial", 13, [System.Drawing.FontStyle]::Italic)
$tagBrush = New-Object System.Drawing.SolidBrush([System.Drawing.ColorTranslator]::FromHtml("#FFCDD2"))
$fgG.DrawString("UPSC  *  TNPSC  *  CIVIL SERVICES COACHING", $tagFont, $tagBrush, 512, 410, $stringFormat)

$fgBmp.Save($fgDestPath, [System.Drawing.Imaging.ImageFormat]::Png)
$fgG.Dispose()
$fgBmp.Dispose()
Write-Host "Created 1024x500 Feature Graphic at: $fgDestPath"
