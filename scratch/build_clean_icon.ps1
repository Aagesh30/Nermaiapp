Add-Type -AssemblyName System.Drawing

$srcPath = "friend\WhatsApp Image 2026-10-16 at 11.01.50 AM.jpeg"
$src = [System.Drawing.Bitmap]::FromFile($srcPath)

# The friend's image has the emblem and text on a red background with white corners.
# In the source image (1254x1254):
# The emblem center is at x=627, y=410
# The emblem radius is ~370px
# The text 'NERMAI' is at y=760 to 980, width ~900px
# The text 'IAS ACADEMY' is at y=980 to 1130, width ~800px
# Everything inside the circle and text is white/red.
# The red background has a radial gradient:
# Center (627, 550): vibrant crimson ~RGB(180, 5, 20)
# Edges: deep dark crimson ~RGB(100, 2, 8)
# Outside the rounded corners: WHITE RGB(250+, 250+, 250+)

# Let's create an alpha-extracted version of the artwork:
# We crop the emblem and the text with a mask that includes all red/white content of the badge,
# but excludes the white corners!
$canvasSize = 1024
$outBmp = New-Object System.Drawing.Bitmap($canvasSize, $canvasSize, [System.Drawing.Imaging.PixelFormat]::Format32bppArgb)
$g = [System.Drawing.Graphics]::FromImage($outBmp)
$g.InterpolationMode = [System.Drawing.Drawing2D.InterpolationMode]::HighQualityBicubic
$g.SmoothingMode = [System.Drawing.Drawing2D.SmoothingMode]::HighQuality
$g.PixelOffsetMode = [System.Drawing.Drawing2D.PixelOffsetMode]::HighQuality

# 1. Fill the ENTIRE 1024x1024 canvas with the EXACT matching crimson radial gradient
# Center of glow is slightly above center (512, 460) to match the emblem glow
$rect = New-Object System.Drawing.Rectangle(0, 0, $canvasSize, $canvasSize)
$path = New-Object System.Drawing.Drawing2D.GraphicsPath
$path.AddRectangle($rect)
$pbg = New-Object System.Drawing.Drawing2D.PathGradientBrush($path)
$pbg.CenterPoint = New-Object System.Drawing.PointF(512, 460)
$pbg.CenterColor = [System.Drawing.Color]::FromArgb(255, 175, 5, 18) # vibrant rich crimson
$pbg.SurroundColors = @([System.Drawing.Color]::FromArgb(255, 90, 2, 8)) # deep velvet crimson to all 4 corners
$g.FillRectangle($pbg, $rect)

# 2. Extract ONLY the emblem and text from the source, without ANY corners or badge borders!
# In the source (1254x1254):
# Emblem top is at y=110, bottom of text is at y=1140. Total height = 1030px.
# Total width = 940px (from x=157 to 1097).
# This region is 100% inside the red badge and has ZERO white corners!
$srcContentRect = New-Object System.Drawing.Rectangle(150, 100, 954, 1045)

# We scale this content (954x1045) so that it fits comfortably inside the 66% Safe Zone circle!
# Safe zone diameter is 676px.
# We set width = 600px, height = [int](1045 * (600 / 954)) = 657px
$destW = 600
$destH = 657
$destX = [int]((1024 - $destW) / 2) # centered horizontally: 212
$destY = [int]((1024 - $destH) / 2) # centered vertically: 183

# Draw the emblem and text seamlessly onto the full-bleed crimson background
$destContentRect = New-Object System.Drawing.Rectangle($destX, $destY, $destW, $destH)
$g.DrawImage($src, $destContentRect, $srcContentRect, [System.Drawing.GraphicsUnit]::Pixel)

$g.Dispose()
$pbg.Dispose()
$path.Dispose()
$src.Dispose()

# Save final clean master icon (1024x1024)
$outBmp.Save("scratch\clean_master_icon_1024.png", [System.Drawing.Imaging.ImageFormat]::Png)
Write-Host "Created scratch\clean_master_icon_1024.png"

# 3. Create Verification Preview 1: OVERLAID WITH THE EXACT ANDROID SAFE ZONE GRID
$gridBmp = New-Object System.Drawing.Bitmap($outBmp)
$gGrid = [System.Drawing.Graphics]::FromImage($gridBmp)
$gGrid.SmoothingMode = [System.Drawing.Drawing2D.SmoothingMode]::AntiAlias

$penGrid = New-Object System.Drawing.Pen([System.Drawing.Color]::FromArgb(90, 255, 255, 255), 1)
$penSafe = New-Object System.Drawing.Pen([System.Drawing.Color]::FromArgb(255, 0, 255, 100), 3) # Neon Green Safe Zone
$penOuter = New-Object System.Drawing.Pen([System.Drawing.Color]::FromArgb(255, 255, 200, 0), 2) # Yellow Mask

for ($i = 128; $i -lt 1024; $i += 128) {
    $gGrid.DrawLine($penGrid, $i, 0, $i, 1024)
    $gGrid.DrawLine($penGrid, 0, $i, 1024, $i)
}
# Safe Zone Circle (66% = 676px)
$safeD = 676
$safeR = [int]((1024 - $safeD) / 2)
$gGrid.DrawEllipse($penSafe, $safeR, $safeR, $safeD, $safeD)

# Outer Mask Circle (864px)
$outerD = 864
$outerR = [int]((1024 - $outerD) / 2)
$gGrid.DrawEllipse($penOuter, $outerR, $outerR, $outerD, $outerD)

$gGrid.Dispose()
$gridBmp.Save("scratch\clean_preview_grid.png", [System.Drawing.Imaging.ImageFormat]::Png)
Write-Host "Created scratch\clean_preview_grid.png"

# 4. Create Verification Preview 2: MASKED AS VIVO PHONE HOME SCREEN ICON
$vivoBmp = New-Object System.Drawing.Bitmap(512, 512, [System.Drawing.Imaging.PixelFormat]::Format32bppArgb)
$gVivo = [System.Drawing.Graphics]::FromImage($vivoBmp)
$gVivo.SmoothingMode = [System.Drawing.Drawing2D.SmoothingMode]::HighQuality
$gVivo.InterpolationMode = [System.Drawing.Drawing2D.InterpolationMode]::HighQualityBicubic

$squircle = New-Object System.Drawing.Drawing2D.GraphicsPath
$r = 110 # Vivo squircle corner radius
$squircle.AddArc(0, 0, $r*2, $r*2, 180, 90)
$squircle.AddArc(512 - $r*2, 0, $r*2, $r*2, 270, 90)
$squircle.AddArc(512 - $r*2, 512 - $r*2, $r*2, $r*2, 0, 90)
$squircle.AddArc(0, 512 - $r*2, $r*2, $r*2, 90, 90)
$squircle.CloseFigure()

$gVivo.SetClip($squircle)
$gVivo.DrawImage($outBmp, 0, 0, 512, 512)
$gVivo.Dispose()
$vivoBmp.Save("scratch\clean_preview_vivo.png", [System.Drawing.Imaging.ImageFormat]::Png)
Write-Host "Created scratch\clean_preview_vivo.png"

$outBmp.Dispose()
$gridBmp.Dispose()
$vivoBmp.Dispose()
