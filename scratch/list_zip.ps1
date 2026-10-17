Add-Type -AssemblyName System.IO.Compression.FileSystem
$zip = [System.IO.Compression.ZipFile]::OpenRead('D:\unistrix\NERMAI_IAS_ACADEMY (2).zip')
$results = @()
foreach ($entry in $zip.Entries) {
    if ($entry.FullName -match 'daily_content|resource|enroll|lms' -and $entry.FullName -notmatch 'node_modules|android/|\.git') {
        $results += $entry.FullName
    }
}
$zip.Dispose()
$results | Out-File -FilePath "d:\unistrix\NERMAI_IAS_ACADEMY\scratch\zip_matching_files.txt" -Encoding utf8
Write-Output "Found $($results.Count) files"
