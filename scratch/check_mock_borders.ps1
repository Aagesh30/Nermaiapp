Add-Type -AssemblyName System.Drawing

$src = [System.Drawing.Bitmap]::FromFile("d:\unistrix\NERMAI_IAS_ACADEMY\friend\WhatsApp Image 2026-10-16 at 2.51.07 PM.jpeg")

Write-Host "Top-Left (0,0):" $src.GetPixel(0, 0).ToString()
Write-Host "Top-Mid (589,0):" $src.GetPixel(589, 0).ToString()
Write-Host "Top-Right (1177,0):" $src.GetPixel(1177, 0).ToString()
Write-Host "Mid-Left (0, 667):" $src.GetPixel(0, 667).ToString()
Write-Host "Mid-Right (1177, 667):" $src.GetPixel(1177, 667).ToString()
Write-Host "Bottom-Mid (589, 1334):" $src.GetPixel(589, 1334).ToString()

$src.Dispose()
