Add-Type -AssemblyName System.Drawing

$bmp = [System.Drawing.Bitmap]::FromFile("d:\unistrix\NERMAI_IAS_ACADEMY\scratch\header_exact.png")

# "Learn | Practice | Excel" is red text on white background in the center
# Find red text lines near bottom
$cx = [int]($bmp.Width / 2)
for ($y = 250; $y -lt $bmp.Height; $y++) {
    $c = $bmp.GetPixel($cx, $y)
    if ($c.R -gt 150 -and $c.G -lt 50 -and $c.B -lt 50) {
        Write-Host "Red text found at y=$y (R=$($c.R), G=$($c.G), B=$($c.B))"
    }
}

$bmp.Dispose()
