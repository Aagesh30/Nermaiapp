$hash = (Get-FileHash "scratch/apk_icons/res_4z.png").Hash
Write-Host "Target hash:" $hash
Get-ChildItem -Path "web_portal" -Recurse -File -Include *.png,*.jpg,*.jpeg | ForEach-Object {
    $h = (Get-FileHash $_.FullName).Hash
    if ($h -eq $hash) {
        Write-Host "MATCH in web_portal:" $_.FullName
    }
}
Get-ChildItem -Path "assets" -Recurse -File -Include *.png,*.jpg,*.jpeg | ForEach-Object {
    $h = (Get-FileHash $_.FullName).Hash
    if ($h -eq $hash) {
        Write-Host "MATCH in root assets:" $_.FullName
    }
}
