$hash = (Get-FileHash "scratch/all_apk_images/res_Zt.png").Hash
Write-Host "Target hash:" $hash
Get-ChildItem -Path "web_portal" -Recurse -File | ForEach-Object {
    try {
        if ((Get-FileHash $_.FullName).Hash -eq $hash) {
            Write-Host "FOUND in web_portal:" $_.FullName
        }
    } catch {}
}
Get-ChildItem -Path "assets" -Recurse -File | ForEach-Object {
    try {
        if ((Get-FileHash $_.FullName).Hash -eq $hash) {
            Write-Host "FOUND in assets:" $_.FullName
        }
    } catch {}
}
Get-ChildItem -Path "node_modules" -Recurse -File -Include *.png | ForEach-Object {
    try {
        if ((Get-FileHash $_.FullName).Hash -eq $hash) {
            Write-Host "FOUND in node_modules:" $_.FullName
        }
    } catch {}
}
