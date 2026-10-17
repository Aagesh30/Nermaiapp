Add-Type -AssemblyName System.Drawing

$logo = [System.Drawing.Bitmap]::FromFile('D:\unistrix\NERMAI_IAS_ACADEMY\web_portal\assets\logo.png')
Write-Host "Logo size: $($logo.Width) x $($logo.Height)"

# Check transparency and bounds
$top = 9999; $bottom = 0; $left = 9999; $right = 0
for ($y = 0; $y -lt $logo.Height; $y += 2) {
    for ($x = 0; $x -lt $logo.Width; $x += 2) {
        $c = $logo.GetPixel($x, $y)
        # Check non-transparent
        if ($c.A -gt 20) {
            if ($y -lt $top) { $top = $y }
            if ($y -gt $bottom) { $bottom = $y }
            if ($x -lt $left) { $left = $x }
            if ($x -gt $right) { $right = $x }
        }
    }
}
Write-Host "Bounds: Left=$left, Right=$right, Top=$top, Bottom=$bottom, W=$($right-$left), H=$($bottom-$top)"
$logo.Dispose()
