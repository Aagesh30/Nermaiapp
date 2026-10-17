const fs = require('fs');
const path = require('path');

const filePath = path.join(__dirname, '..', 'web_portal', 'App.tsx');
let lines = fs.readFileSync(filePath, 'utf8').split(/\r?\n/);

console.log('Total lines:', lines.length);

for (let i = 8080; i < 8115; i++) {
    if (lines[i] && lines[i].includes('Roll No:</Text>')) {
        console.log('Found line at', i, ':', lines[i]);
        lines[i] = '                    <Text style={{ fontSize: 13, color: "#424242" }}><Text style={{ fontWeight: "bold" }}>Roll No:</Text> {(student.hallTicketIsSpecial ? (student.specialRollNo || student.mockRollNumber || student.rollNumber) : (student.rollNumber || student.loginUsername || student.specialRollNo || student.mockRollNumber)) || "—"}</Text>';
        break;
    }
}

fs.writeFileSync(filePath, lines.join('\r\n'), 'utf8');
console.log('Updated student hall ticket render successfully!');
