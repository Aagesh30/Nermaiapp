Add-Type -AssemblyName System.Drawing

$exact = [System.Drawing.Bitmap]::FromFile("d:\unistrix\NERMAI_IAS_ACADEMY\scratch\header_exact.png")

$canvasW = 1800
$canvasH = $exact.Height # 380
$wideBmp = New-Object System.Drawing.Bitmap($canvasW, $canvasH, [System.Drawing.Imaging.PixelFormat]::Format32bppArgb)
$g = [System.Drawing.Graphics]::FromImage($wideBmp)
$g.SmoothingMode = [System.Drawing.Drawing2D.SmoothingMode]::HighQuality
$g.InterpolationMode = [System.Drawing.Drawing2D.InterpolationMode]::HighQualityBicubic
$g.PixelOffsetMode = [System.Drawing.Drawing2D.PixelOffsetMode]::HighQuality

# 1. Fill entire top with pure white
$g.Clear([System.Drawing.Color]::White)

# 2. Draw left and right wave extensions
# Left red wave extension: from x=0 to x=311 (center offset)
$centerOffset = [int](($canvasW - $exact.Width) / 2) # 311

# Left wave path
$pLeft = New-Object System.Drawing.Drawing2D.GraphicsPath
$pLeft.StartFigure()
$pLeft.AddLine(0, 240, $centerOffset, 275)
$pLeft.AddLine($centerOffset, $canvasH, 0, $canvasH)
$pLeft.CloseFigure()
$bLeft = New-Object System.Drawing.Drawing2D.LinearGradientBrush(
    (New-Object System.Drawing.Point(0, 240)),
    (New-Object System.Drawing.Point(0, $canvasH)),
    [System.Drawing.ColorTranslator]::FromHtml("#880000"),
    [System.Drawing.ColorTranslator]::FromHtml("#550000")
)
$g.FillPath($bLeft, $pLeft)

# Right wave path
$pRight = New-Object System.Drawing.Drawing2D.GraphicsPath
$pRight.StartFigure()
$pRight.AddLine(($centerOffset + $exact.Width), 195, $canvasW, 160)
$pRight.AddLine($canvasW, $canvasH, ($centerOffset + $exact.Width), $canvasH)
$pRight.CloseFigure()
$bRight = New-Object System.Drawing.Drawing2D.LinearGradientBrush(
    (New-Object System.Drawing.Point(0, 160)),
    (New-Object System.Drawing.Point(0, $canvasH)),
    [System.Drawing.ColorTranslator]::FromHtml("#880000"),
    [System.Drawing.ColorTranslator]::FromHtml("#550000")
)
$g.FillPath($bRight, $pRight)

# 3. Draw the exact header in the center
$g.DrawImage($exact, $centerOffset, 0, $exact.Width, $exact.Height)

$wideBmp.Save("d:\unistrix\NERMAI_IAS_ACADEMY\scratch\header_widescreen.png", [System.Drawing.Imaging.ImageFormat]::Png)

$g.Dispose()
$wideBmp.Dispose()
$exact.Dispose()

Write-Host "Widescreen header created successfully!"
