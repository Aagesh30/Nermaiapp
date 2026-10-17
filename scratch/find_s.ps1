Add-Type -AssemblyName System.Drawing
$base = [System.Drawing.Bitmap]::FromFile('d:\unistrix\NERMAI_IAS_ACADEMY\scratch\login_bg_laptop_smooth.png')

# Find letter 'S' in "IAS"
# Around x=690 to 730, y=135 to 165
$sTop = 999; $sBottom = 0; $sLeft = 999; $sRight = 0
for ($y = 135; $y -le 165; $y++) {
    for ($x = 700; $x -le 725; $x++) {
        $c = $base.GetPixel($x, $y)
        if ($c.R -gt 130 -and $c.G -lt 60) {
            if ($y -lt $sTop) { $sTop = $y }
            if ($y -gt $sBottom) { $sBottom = $y }
            if ($x -lt $sLeft) { $sLeft = $x }
            if ($x -gt $sRight) { $right = $x }
        }
    }
}
Write-Host "In base image: 'S' bounds: Top=$sTop, Bottom=$sBottom, Left=$sLeft, Right=$right"
$base.Dispose()
