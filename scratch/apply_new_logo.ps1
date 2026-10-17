Add-Type -AssemblyName System.Drawing

$base = [System.Drawing.Bitmap]::FromFile('d:\unistrix\NERMAI_IAS_ACADEMY\scratch\login_bg_laptop_smooth.png')
$logo = [System.Drawing.Bitmap]::FromFile('D:\unistrix\NERMAI_IAS_ACADEMY\web_portal\assets\logo.png')

$out = New-Object System.Drawing.Bitmap($base.Width, $base.Height, [System.Drawing.Imaging.PixelFormat]::Format32bppArgb)
$g = [System.Drawing.Graphics]::FromImage($out)
$g.SmoothingMode = [System.Drawing.Drawing2D.SmoothingMode]::HighQuality
$g.InterpolationMode = [System.Drawing.Drawing2D.InterpolationMode]::HighQualityBicubic
$g.PixelOffsetMode = [System.Drawing.Drawing2D.PixelOffsetMode]::HighQuality

# 1. Draw base with completely clean, crisp, untouched text
$g.DrawImage($base, 0, 0, $base.Width, $base.Height)

# 2. Extract EXACT circular seal from web_portal\assets\logo.png
$cropW = 690
$cropH = 688
$emblem = New-Object System.Drawing.Bitmap($cropW, $cropH, [System.Drawing.Imaging.PixelFormat]::Format32bppArgb)
$ge = [System.Drawing.Graphics]::FromImage($emblem)
$ge.SmoothingMode = [System.Drawing.Drawing2D.SmoothingMode]::HighQuality
$ge.InterpolationMode = [System.Drawing.Drawing2D.InterpolationMode]::HighQualityBicubic

# Circular clip
$path = New-Object System.Drawing.Drawing2D.GraphicsPath
$path.AddEllipse(0, 0, $cropW, $cropH)
$ge.SetClip($path)
$ge.Clear([System.Drawing.Color]::White)
$ge.DrawImage($logo, (New-Object System.Drawing.Rectangle(0, 0, $cropW, $cropH)), (New-Object System.Drawing.Rectangle(38, 56, $cropW, $cropH)), [System.Drawing.GraphicsUnit]::Pixel)
$ge.Dispose()

# 3. Position on the laptop background:
# Moving a little down:
# destY changed from 12 -> 17 (moved 5px down)
# destSize = 116
# Bottom of emblem = 17 + 116 = 133
# 'S' is at 141 -> clean 8px gap, balanced and beautiful!
$destSize = 116
$destX = [int](688 - ($destSize / 2)) # 630
$destY = 17

# Draw the emblem
$g.DrawImage($emblem, $destX, $destY, $destSize, $destSize)

# 4. Save directly to web_portal/assets/login_bg_laptop.png!
$dest = 'd:\unistrix\NERMAI_IAS_ACADEMY\web_portal\assets\login_bg_laptop.png'
$out.Save($dest, [System.Drawing.Imaging.ImageFormat]::Png)

# Also save crop for verification
$crop = New-Object System.Drawing.Bitmap(500, 250)
$gc = [System.Drawing.Graphics]::FromImage($crop)
$gc.DrawImage($out, 0, 0, (New-Object System.Drawing.Rectangle(438, 5, 500, 250)), [System.Drawing.GraphicsUnit]::Pixel)
$crop.Save('d:\unistrix\NERMAI_IAS_ACADEMY\scratch\crop_fixed_header.png')

$gc.Dispose()
$crop.Dispose()
$ge.Dispose()
$emblem.Dispose()
$g.Dispose()
$out.Dispose()
$logo.Dispose()
$base.Dispose()

Write-Host "SUCCESS: Logo moved slightly down to perfect position!"
