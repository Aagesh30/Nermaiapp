Add-Type -AssemblyName System.Drawing
$bmp = [System.Drawing.Bitmap]::FromFile("web_portal/assets/icon.png")
Write-Host "Size:" $bmp.Width "x" $bmp.Height
Write-Host "Corner (0,0) Alpha:" $bmp.GetPixel(0, 0).A "R:" $bmp.GetPixel(0, 0).R "G:" $bmp.GetPixel(0, 0).G "B:" $bmp.GetPixel(0, 0).B
Write-Host "Corner (5,5) Alpha:" $bmp.GetPixel(5, 5).A
Write-Host "Corner (50,50) Alpha:" $bmp.GetPixel(50, 50).A
Write-Host "Center (512,512) Alpha:" $bmp.GetPixel(512, 512).A
$bmp.Dispose()
