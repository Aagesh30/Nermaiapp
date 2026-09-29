const fs = require('fs');
const file = 'web_portal/App.tsx';
let content = fs.readFileSync(file, 'utf8');

const target = `                  const filter = testLangFilter || "en-ta";
                  const showEn = filter.includes("en");
                  const showTa = filter.includes("ta");
                  const showMl = filter.includes("ml");
                  const showTe = filter.includes("te");`;

const replacement = `                  const filter = testLangFilter || "en-ta";
                  const showEn = filter === "all" || filter.includes("en");
                  const showTa = filter === "all" || filter.includes("ta");
                  const showMl = filter === "all" || filter.includes("ml");
                  const showTe = filter === "all" || filter.includes("te");`;

const normTarget = target.replace(/\r\n/g, '\n');
const normContent = content.replace(/\r\n/g, '\n');

if (normContent.includes(normTarget)) {
    // Preserve original CRLF if present
    const usesCRLF = content.includes('\r\n');
    let updated = normContent.replace(normTarget, replacement.replace(/\r\n/g, '\n'));
    if (usesCRLF) {
        updated = updated.replace(/\n/g, '\r\n');
    }
    fs.writeFileSync(file, updated, 'utf8');
    console.log('Successfully patched web_portal/App.tsx');
} else {
    console.error('Target not found in web_portal/App.tsx');
}
