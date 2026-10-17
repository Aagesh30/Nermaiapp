Add-Type -AssemblyName System.Drawing
$badge = [System.Drawing.Bitmap]::FromFile('d:\unistrix\NERMAI_IAS_ACADEMY\scratch\badge_transparent.png')

# Scan along x=627 from y=46 downwards to find the bottom of the circular ring
# Inside the circle, there is the pen nib and laurels. Below the circle is the red background of the rounded square, and then the white letters "NERMAI"
for ($y = 400; $y -le 1000; $y += 5) {
    $c = $badge.GetPixel(627, $y)
    Write-Host "y=$y : A=$($c.A), R=$($c.R), G=$($c.G), B=$($c.B)"
}
$badge.Dispose()
