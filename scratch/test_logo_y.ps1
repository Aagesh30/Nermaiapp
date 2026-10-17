Add-Type -AssemblyName System.Drawing
$bmp = [System.Drawing.Bitmap]::FromFile("d:\unistrix\NERMAI_IAS_ACADEMY\friend\WhatsApp Image 2026-10-16 at 2.51.07 PM.jpeg")

# Find circle bounds and text bounds in WhatsApp Image
# Scan center x=589
$circleTop = 999; $circleBottom = 0
for ($y = 0; $y -lt 300; $y++) {
    $c = $bmp.GetPixel(589, $y)
    if ($c.R -gt 130 -and $c.G -lt 60) {
        if ($y -lt $circleTop) { $circleTop = $y }
        if ($y -gt $circleBottom) { $circleBottom = $y }
    }
}
Write-Host "Circle in WhatsApp Image: Top=$circleTop, Bottom=$circleBottom"

# Text "NERMAI IAS ACADEMY"
$textTop = 999; $textBottom = 0; $textLeft = 999; $textRight = 0
for ($y = 150; $y -lt 250; $y++) {
    for ($x = 200; $x -lt 1000; $x++) {
        $c = $bmp.GetPixel($x, $y)
        if ($c.R -gt 130 -and $c.G -lt 60 -and $c.B -lt 60) {
            if ($y -lt $textTop) { $textTop = $y }
            if ($y -gt $textBottom) { $textBottom = $y }
            if ($x -lt $textLeft) { $textLeft = $x }
            if ($x -gt $textRight) { $textRight = $x }
        }
    }
}
Write-Host "Text in WhatsApp Image: Left=$textLeft, Right=$textRight, Top=$textTop, Bottom=$textBottom, Gap=$($textTop - $circleBottom)"
$bmp.Dispose()
