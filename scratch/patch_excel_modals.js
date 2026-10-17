const fs = require('fs');

function patchFile(filePath, isSyllabus) {
  let content = fs.readFileSync(filePath, 'utf8');
  const isCRLF = content.includes('\r\n');
  if (isCRLF) content = content.replace(/\r\n/g, '\n');

  // 1. Replace import
  const oldImport = `import * as FileSystem from 'expo-file-system';`;
  const newImport = `import * as FileSystem from 'expo-file-system';
import * as FileSystemLegacy from 'expo-file-system/legacy';`;

  if (!content.includes(oldImport)) {
    console.log(`Already patched import or not found in ${filePath}`);
  } else {
    content = content.replace(oldImport, newImport);
  }

  // 2. Replace file reading
  let oldBlock = '';
  let newBlock = '';

  if (isSyllabus) {
    oldBlock = `      } else {
        // Native APK (Android/iOS): Read as Base64 string via FileSystem
        const base64 = await FileSystem.readAsStringAsync(asset.uri, {
          encoding: FileSystem.EncodingType.Base64,
        });
        workbook = XLSX.read(base64, { type: 'base64' });
      }`;

    newBlock = `      } else {
        // Native APK (Android/iOS): Read via legacy FileSystem or modern File
        let base64 = '';
        try {
          if (FileSystemLegacy && typeof FileSystemLegacy.readAsStringAsync === 'function') {
            base64 = await FileSystemLegacy.readAsStringAsync(asset.uri, {
              encoding: FileSystemLegacy.EncodingType.Base64,
            });
          } else {
            throw new Error('legacy readAsStringAsync unavailable');
          }
        } catch (legacyErr) {
          try {
            const fsFile = new (FileSystem as any).File(asset.uri);
            if (typeof fsFile.base64 === 'function') {
              base64 = await fsFile.base64();
            } else {
              throw new Error('File.base64 unavailable');
            }
          } catch {
            base64 = await FileSystem.readAsStringAsync(asset.uri, {
              encoding: (FileSystem as any).EncodingType?.Base64 || 'base64',
            });
          }
        }
        workbook = XLSX.read(base64, { type: 'base64' });
      }`;
  } else {
    oldBlock = `      } else {
        const base64 = await FileSystem.readAsStringAsync(asset.uri, {
          encoding: FileSystem.EncodingType.Base64,
        });
        parsed = parseStudentUploadFromBase64(base64, pickedName, batches);
      }`;

    newBlock = `      } else {
        let base64 = '';
        try {
          if (FileSystemLegacy && typeof FileSystemLegacy.readAsStringAsync === 'function') {
            base64 = await FileSystemLegacy.readAsStringAsync(asset.uri, {
              encoding: FileSystemLegacy.EncodingType.Base64,
            });
          } else {
            throw new Error('legacy readAsStringAsync unavailable');
          }
        } catch (legacyErr) {
          try {
            const fsFile = new (FileSystem as any).File(asset.uri);
            if (typeof fsFile.base64 === 'function') {
              base64 = await fsFile.base64();
            } else {
              throw new Error('File.base64 unavailable');
            }
          } catch {
            base64 = await FileSystem.readAsStringAsync(asset.uri, {
              encoding: (FileSystem as any).EncodingType?.Base64 || 'base64',
            });
          }
        }
        parsed = parseStudentUploadFromBase64(base64, pickedName, batches);
      }`;
  }

  if (!content.includes(oldBlock)) {
    console.error(`Could not find old reading block in ${filePath}`);
    process.exit(1);
  }

  content = content.replace(oldBlock, newBlock);

  if (isCRLF) content = content.replace(/\n/g, '\r\n');
  fs.writeFileSync(filePath, content, 'utf8');
  console.log(`Successfully patched ${filePath}`);
}

patchFile('web_portal/lms/components/MobileBulkStudentUploadModal.tsx', false);
patchFile('web_portal/lms/admin/MobileExcelSyllabusModal.tsx', true);
