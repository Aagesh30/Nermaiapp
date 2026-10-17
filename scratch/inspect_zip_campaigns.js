const fs = require('fs');
const path = require('path');
const { execSync } = require('child_process');

const scratchDir = path.join(__dirname, 'zip_inspect');
if (!fs.existsSync(scratchDir)) {
    fs.mkdirSync(scratchDir, { recursive: true });
}

const psCommand = `powershell -Command "Add-Type -AssemblyName System.IO.Compression.FileSystem; $zip = [System.IO.Compression.ZipFile]::OpenRead('D:\\unistrix\\NERMAI_IAS_ACADEMY (2).zip'); foreach ($entry in $zip.Entries) { if ($entry.FullName -like '*crm/campaigns*' -or $entry.FullName -eq 'web_portal/App.tsx' -or $entry.FullName -eq 'App.tsx' -or $entry.FullName -like '*services/google_drive*') { $dest = [System.IO.Path]::Combine('D:\\unistrix\\NERMAI_IAS_ACADEMY\\scratch\\zip_inspect', $entry.FullName); [System.IO.Directory]::CreateDirectory([System.IO.Path]::GetDirectoryName($dest)); [System.IO.Compression.ZipFileExtensions]::ExtractToFile($entry, $dest, $true); Write-Host Extracted: $entry.FullName } }"`;

try {
    const out = execSync(psCommand, { encoding: 'utf8' });
    console.log(out);
} catch (e) {
    console.error(e.message);
}
