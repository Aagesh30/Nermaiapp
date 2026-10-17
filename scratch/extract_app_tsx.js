const fs = require('fs');
const path = require('path');
const { execSync } = require('child_process');

const scratchDir = path.join(__dirname, 'zip_inspect');

const psCommand = `powershell -Command "Add-Type -AssemblyName System.IO.Compression.FileSystem; $zip = [System.IO.Compression.ZipFile]::OpenRead('D:\\unistrix\\NERMAI_IAS_ACADEMY (2).zip'); foreach ($entry in $zip.Entries) { if ($entry.FullName -like '*App.tsx*') { $dest = [System.IO.Path]::Combine('D:\\unistrix\\NERMAI_IAS_ACADEMY\\scratch\\zip_inspect', $entry.FullName); $dir = [System.IO.Path]::GetDirectoryName($dest); if (-not (Test-Path $dir)) { New-Item -ItemType Directory -Path $dir -Force }; [System.IO.Compression.ZipFileExtensions]::ExtractToFile($entry, $dest, $true); Write-Host Extracted: $entry.FullName } }"`;

try {
    const out = execSync(psCommand, { encoding: 'utf8' });
    console.log(out);
} catch (e) {
    console.error(e.message);
}
