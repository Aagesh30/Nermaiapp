Add-Type -AssemblyName System.Drawing

$base = [System.Drawing.Bitmap]::FromFile('d:\unistrix\NERMAI_IAS_ACADEMY\scratch\login_bg_laptop_smooth.png')
$badge = [System.Drawing.Bitmap]::FromFile('d:\unistrix\NERMAI_IAS_ACADEMY\scratch\badge_transparent.png')

$out = New-Object System.Drawing.Bitmap($base.Width, $base.Height, [System.Drawing.Imaging.PixelFormat]::Format32bppArgb)
$g = [System.Drawing.Graphics]::FromImage($out)
$g.SmoothingMode = [System.Drawing.Drawing2D.SmoothingMode]::HighQuality
$g.InterpolationMode = [System.Drawing.Drawing2D.InterpolationMode]::HighQualityBicubic
$g.PixelOffsetMode = [System.Drawing.Drawing2D.PixelOffsetMode]::HighQuality

# 1. Draw base with completely clean, crisp, untouched text
$g.DrawImage($base, 0, 0, $base.Width, $base.Height)

# 2. Extract EXACT circular seal:
# In badge (1254x1254):
# Circle center is x=627, y=411, diameter=730.
$cropSize = 730
$emblem = New-Object System.Drawing.Bitmap($cropSize, $cropSize, [System.Drawing.Imaging.PixelFormat]::Format32bppArgb)
$ge = [System.Drawing.Graphics]::FromImage($emblem)
$ge.SmoothingMode = [System.Drawing.Drawing2D.SmoothingMode]::HighQuality
$ge.InterpolationMode = [System.Drawing.Drawing2D.InterpolationMode]::HighQualityBicubic

$path = New-Object System.Drawing.Drawing2D.GraphicsPath
$path.AddEllipse(0, 0, $cropSize, $cropSize)
$ge.SetClip($path)
$ge.Clear([System.Drawing.Color]::White)
$ge.DrawImage($badge, (New-Object System.Drawing.Rectangle(0, 0, $cropSize, $cropSize)), (New-Object System.Drawing.Rectangle(262, 46, $cropSize, $cropSize)), [System.Drawing.GraphicsUnit]::Pixel)
$ge.Dispose()

# 3. Position on the laptop background:
# Center X = 688
# Text starts at y = 149.
# We set destSize = 120, destY = 16 -> bottom of emblem is at y = 136.
# Clean 13px gap above "NERMAI IAS ACADEMY"!
$destSize = 120
$destX = [int](688 - ($destSize / 2)) # 628
$destY = 16

# Draw warm off-white background circle behind it to cleanly cover any edge of old logo
$bgBrush = New-Object System.Drawing.SolidBrush([System.Drawing.Color]::FromArgb(255, 253, 251, 248))
$g.FillEllipse($bgBrush, ($destX - 2), ($destY - 2), ($destSize + 4), ($destSize + 4))
$bgBrush.Dispose()

# Draw the emblem
$g.DrawImage($emblem, $destX, $destY, $destSize, $destSize)

# 4. Save directly to web_portal/assets/login_bg_laptop.png!
$dest = 'd:\unistrix\NERMAI_IAS_ACADEMY\web_portal\assets\login_bg_laptop.png'
$out.Save($dest, [System.Drawing.Imaging.ImageFormat]::Png)

# Also save crop for verification
$crop = New-Object System.Drawing.Bitmap(500, 250)
$gc = [System.Drawing.Graphics]::FromImage($crop)
$gc.DrawImage($out, 0, 0, (New-Object System.Drawing.Rectangle(438, 10, 500, 250)), [System.Drawing.GraphicsUnit]::Pixel)
$crop.Save('d:\unistrix\NERMAI_IAS_ACADEMY\scratch\crop_fixed_header.png')

$gc.Dispose()
$crop.Dispose()
$ge.Dispose()
$emblem.Dispose()
$g.Dispose()
$out.Dispose()
$badge.Dispose()
$base.Dispose()

Write-Host "SUCCESS: Perfect gap applied!"
