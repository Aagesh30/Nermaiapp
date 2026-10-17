Add-Type -AssemblyName System.Drawing

$src = [System.Drawing.Bitmap]::FromFile("d:\unistrix\NERMAI_IAS_ACADEMY\friend\WhatsApp Image 2026-10-16 at 2.51.07 PM.jpeg")

Write-Host "Width: $($src.Width), Height: $($src.Height)"

# Find the bounding box of the white card
# In the middle vertical strip (x = 589), find where card starts (around y=370) and ends
$cx = [int]($src.Width / 2)
$topY = 0
$bottomY = 0

for ($y = 200; $y -lt 600; $y++) {
    $c = $src.GetPixel($cx, $y)
    # Check if pure white or close
    if ($c.R -gt 250 -and $c.G -gt 250 -and $c.B -gt 250) {
        $topY = $y
        break
    }
}

for ($y = $src.Height - 1; $y -gt 800; $y--) {
    $c = $src.GetPixel($cx, $y)
    if ($c.R -gt 250 -and $c.G -gt 250 -and $c.B -gt 250) {
        $bottomY = $y
        break
    }
}

# Find left and right bounds around y=600
$leftX = 0
$rightX = 0
for ($x = 50; $x -lt $src.Width / 2; $x++) {
    $c = $src.GetPixel($x, 600)
    if ($c.R -gt 250 -and $c.G -gt 250 -and $c.B -gt 250) {
        $leftX = $x
        break
    }
}
for ($x = $src.Width - 50; $x -gt $src.Width / 2; $x--) {
    $c = $src.GetPixel($x, 600)
    if ($c.R -gt 250 -and $c.G -gt 250 -and $c.B -gt 250) {
        $rightX = $x
        break
    }
}

Write-Host "Card bounds: Left=$leftX, Right=$rightX, Top=$topY, Bottom=$bottomY"
Write-Host "Card Width=$($rightX - $leftX), Height=$($bottomY - $topY)"

$src.Dispose()
