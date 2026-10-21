Add-Type -AssemblyName System.Drawing
$src = [System.Drawing.Bitmap]::FromFile("friend\WhatsApp Image 2026-10-16 at 11.01.50 AM.jpeg")

# Scan diagonal from (0,0) to (627,627)
for ($i = 0; $i -lt 500; $i += 5) {
    $c = $src.GetPixel($i, $i)
    if ($c.R -gt 100 -and $c.G -lt 80 -and $c.B -lt 80) {
        Write-Host "Corner edge detected at diagonal index:" $i "Color:" $c
        break
    }
}

# Scan top edge at x=627 from y=0 downwards
for ($y = 0; $y -lt 100; $y += 2) {
    $c = $src.GetPixel(627, $y)
    if ($c.R -gt 100 -and $c.G -lt 80 -and $c.B -lt 80) {
        Write-Host "Top edge detected at y=" $y "Color:" $c
        break
    }
}

# Scan bottom edge at x=627 from y=1253 upwards
for ($y = 1253; $y -gt 1150; $y -= 2) {
    $c = $src.GetPixel(627, $y)
    if ($c.R -gt 100 -and $c.G -lt 80 -and $c.B -lt 80) {
        Write-Host "Bottom edge detected at y=" $y "Color:" $c
        break
    }
}

# Scan left edge at y=627 from x=0 rightwards
for ($x = 0; $x -lt 100; $x += 2) {
    $c = $src.GetPixel($x, 627)
    if ($c.R -gt 100 -and $c.G -lt 80 -and $c.B -lt 80) {
        Write-Host "Left edge detected at x=" $x "Color:" $c
        break
    }
}

# Scan right edge at y=627 from x=1253 leftwards
for ($x = 1253; $x -gt 1150; $x -= 2) {
    $c = $src.GetPixel($x, 627)
    if ($c.R -gt 100 -and $c.G -lt 80 -and $c.B -lt 80) {
        Write-Host "Right edge detected at x=" $x "Color:" $c
        break
    }
}

$src.Dispose()
