Add-Type -AssemblyName System.Drawing

$srcPath = "d:\unistrix\NERMAI_IAS_ACADEMY\friend\WhatsApp Image 2026-10-16 at 11.01.50 AM.jpeg"
$src = [System.Drawing.Bitmap]::FromFile($srcPath)

Write-Host "Source Width: $($src.Width), Height: $($src.Height)"

# Sample background color around edges of the red badge (e.g. at 200, 200)
$edgeRed = $src.GetPixel(200, 200)
Write-Host "Badge edge color: R=$($edgeRed.R), G=$($edgeRed.G), B=$($edgeRed.B)"

# Let's inspect bottom center color
$bottomRed = $src.GetPixel([int]($src.Width / 2), [int]($src.Height - 30))
Write-Host "Badge bottom color: R=$($bottomRed.R), G=$($bottomRed.G), B=$($bottomRed.B)"

$src.Dispose()
