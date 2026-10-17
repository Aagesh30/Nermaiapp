Add-Type -AssemblyName System.Drawing
$bmp = [System.Drawing.Bitmap]::FromFile('d:\unistrix\NERMAI_IAS_ACADEMY\scratch\login_bg_laptop_smooth.png')
$crop = New-Object System.Drawing.Bitmap(500, 250)
$g = [System.Drawing.Graphics]::FromImage($crop)
$g.DrawImage($bmp, 0, 0, (New-Object System.Drawing.Rectangle(438, 20, 500, 250)), [System.Drawing.GraphicsUnit]::Pixel)
$crop.Save('d:\unistrix\NERMAI_IAS_ACADEMY\scratch\crop_smooth_header.png')
$g.Dispose()
$crop.Dispose()
$bmp.Dispose()
Write-Host "Cropped successfully"
