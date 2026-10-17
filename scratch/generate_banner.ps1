Add-Type -AssemblyName System.Drawing

$width = 1600
$height = 480

$bmp = New-Object System.Drawing.Bitmap($width, $height, [System.Drawing.Imaging.PixelFormat]::Format32bppArgb)
$g = [System.Drawing.Graphics]::FromImage($bmp)
$g.SmoothingMode = [System.Drawing.Drawing2D.SmoothingMode]::HighQuality
$g.InterpolationMode = [System.Drawing.Drawing2D.InterpolationMode]::HighQualityBicubic
$g.PixelOffsetMode = [System.Drawing.Drawing2D.PixelOffsetMode]::HighQuality

# 1. Fill top background with soft clean white to warm off-white gradient
$topBrush = New-Object System.Drawing.Drawing2D.LinearGradientBrush(
    (New-Object System.Drawing.Point(0, 0)),
    (New-Object System.Drawing.Point(0, $height)),
    [System.Drawing.ColorTranslator]::FromHtml("#FFFFFF"),
    [System.Drawing.ColorTranslator]::FromHtml("#FFF9F8")
)
$g.FillRectangle($topBrush, 0, 0, $width, $height)

# 2. Draw subtle academic motifs: layered soft radial glows
$accentBrush1 = New-Object System.Drawing.SolidBrush([System.Drawing.Color]::FromArgb(18, 180, 0, 0))
$g.FillEllipse($accentBrush1, -80, -40, 480, 320)
$g.FillEllipse($accentBrush1, ($width - 380), -40, 500, 340)

# 3. Dynamic layered swooping wave 1 (Lighter Crimson accent #B71C1C)
$p1 = New-Object System.Drawing.Drawing2D.GraphicsPath
$p1.StartFigure()
$p1.AddBezier(0, 290, 320, 360, 680, 380, 1050, 310)
$p1.AddBezier(1050, 310, 1300, 260, 1480, 280, 1600, 250)
$p1.AddLine(1600, $height, 0, $height)
$p1.CloseFigure()
$b1 = New-Object System.Drawing.SolidBrush([System.Drawing.ColorTranslator]::FromHtml("#9E1515"))
$g.FillPath($b1, $p1)

# 4. Dynamic layered swooping wave 2 (Deep Red #7B0000)
$p2 = New-Object System.Drawing.Drawing2D.GraphicsPath
$p2.StartFigure()
$p2.AddBezier(0, 310, 350, 385, 720, 395, 1100, 330)
$p2.AddBezier(1100, 330, 1320, 290, 1490, 305, 1600, 280)
$p2.AddLine(1600, $height, 0, $height)
$p2.CloseFigure()
$b2 = New-Object System.Drawing.SolidBrush([System.Drawing.ColorTranslator]::FromHtml("#7B0000"))
$g.FillPath($b2, $p2)

# Save to assets
$dest1 = "d:\unistrix\NERMAI_IAS_ACADEMY\web_portal\assets\login_banner_bg.png"
$dest2 = "d:\unistrix\NERMAI_IAS_ACADEMY\assets\login_banner_bg.png"

$bmp.Save($dest1, [System.Drawing.Imaging.ImageFormat]::Png)
if (Test-Path "d:\unistrix\NERMAI_IAS_ACADEMY\assets") {
    $bmp.Save($dest2, [System.Drawing.Imaging.ImageFormat]::Png)
}

$g.Dispose()
$bmp.Dispose()
Write-Host "Refined login_banner_bg.png generated successfully!"
