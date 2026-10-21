Add-Type -AssemblyName System.Drawing
$src = [System.Drawing.Bitmap]::FromFile("friend\WhatsApp Image 2026-10-16 at 11.01.50 AM.jpeg")
Write-Host "Width:" $src.Width "Height:" $src.Height
# Check colors at edges
Write-Host "Top-left (0,0):" $src.GetPixel(0, 0)
Write-Host "Top-left (100,100):" $src.GetPixel(100, 100)
Write-Host "Top-center ($($src.Width/2), 0):" $src.GetPixel([int]($src.Width/2), 0)
Write-Host "Top-center ($($src.Width/2), 20):" $src.GetPixel([int]($src.Width/2), 20)
Write-Host "Center ($($src.Width/2), $($src.Height/2)):" $src.GetPixel([int]($src.Width/2), [int]($src.Height/2))
Write-Host "Bottom-center ($($src.Width/2), $($src.Height - 1)):" $src.GetPixel([int]($src.Width/2), $src.Height - 1)
Write-Host "Left-center (0, $($src.Height/2)):" $src.GetPixel(0, [int]($src.Height/2))
$src.Dispose()
