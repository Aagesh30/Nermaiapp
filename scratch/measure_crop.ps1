Add-Type -AssemblyName System.Drawing
$crop = [System.Drawing.Bitmap]::FromFile('d:\unistrix\NERMAI_IAS_ACADEMY\scratch\crop_fixed_header.png')

# In crop (which was taken from x=438, y=15):
# Center of emblem in crop is x = 688 - 438 = 250.
# Let's find top of "NERMAI IAS ACADEMY" text around x=200 (letter M of NERMAI)
for ($y = 100; $y -le 160; $y++) {
    $c = $crop.GetPixel(150, $y) # letter N or E
    if ($c.R -gt 130 -and $c.G -lt 60) {
        Write-Host "Text in crop starts at y=$y (original image Y = $($y + 15))"
        break
    }
}
$crop.Dispose()
