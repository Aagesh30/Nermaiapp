const fs = require('fs');
const path = require('path');

const appPath = path.join(__dirname, '..', 'web_portal', 'App.tsx');
let raw = fs.readFileSync(appPath, 'utf8');
const isCrlf = raw.includes('\r\n');
const lines = raw.split(/\r?\n/);

console.log("Total lines:", lines.length);

// 1. Locate snapshot filter block around line 10377 (1-indexed: 10376 in 0-indexed)
let snapshotStart = -1;
let snapshotEnd = -1;

for (let i = 10300; i < Math.min(10450, lines.length); i++) {
  if (lines[i].includes('// Filter out enrolled-only resources for guest users in real-time')) {
    snapshotStart = i;
  }
  if (snapshotStart !== -1 && lines[i].includes('isFirstResourceSnapshot = false;')) {
    snapshotEnd = i;
    break;
  }
}

if (snapshotStart !== -1 && snapshotEnd !== -1) {
  console.log(`Found snapshot block from line ${snapshotStart + 1} to line ${snapshotEnd + 1}`);
  const replacementLines = [
    '          // Filter resources based on role and batch targeting in real-time',
    '          if (user?.role === "guest") {',
    '            list = list.filter((r: any) => {',
    '              const vis = (r.visibility || "").toLowerCase();',
    '              if (vis === "premium" || vis === "paid" || vis === "batch" || vis === "enrolled") return false;',
    '              const aud = (r.targetAudience || r.audience || "").toLowerCase();',
    '              if (aud === "paid" || aud === "enrolled" || aud === "batch") return false;',
    '              if (Array.isArray(r.targetBatchIds) && (r.targetBatchIds.includes("all_paid") || (vis === "batch" && r.targetBatchIds.length > 0))) return false;',
    '              return vis === "public" || vis === "free" || vis === "guest" || aud === "all" || aud === "free" || aud === "guest";',
    '            });',
    '          } else if (user?.role === "student") {',
    '            const myStudent = getLoggedInStudent(user, studentsRef.current);',
    '            const studentBatches: string[] = [];',
    '            if (myStudent?.batch) studentBatches.push(String(myStudent.batch).trim().toLowerCase());',
    '            if (myStudent?.batchName) studentBatches.push(String(myStudent.batchName).trim().toLowerCase());',
    '            if (myStudent?.batchId) studentBatches.push(String(myStudent.batchId).trim().toLowerCase());',
    '            if (user?.batch) studentBatches.push(String(user.batch).trim().toLowerCase());',
    '            if (user?.batchName) studentBatches.push(String(user.batchName).trim().toLowerCase());',
    '            if (user?.batchId) studentBatches.push(String(user.batchId).trim().toLowerCase());',
    '            const arrBatches = myStudent?.batches || user?.batches;',
    '            if (Array.isArray(arrBatches)) {',
    '              arrBatches.forEach((b: any) => { if (b) studentBatches.push(String(b).trim().toLowerCase()); });',
    '            }',
    '',
    '            list = list.filter((r: any) => {',
    '              const vis = String(r.visibility || "public").trim().toLowerCase();',
    '              if (vis === "guest") return false;',
    '              if (vis === "public" || vis === "free") return true;',
    '',
    '              const rawTargets = r.targetBatchIds || [];',
    '              const targetBatchIds = (Array.isArray(rawTargets)',
    '                ? rawTargets.map((id: any) => String(id).trim().toLowerCase())',
    '                : [String(rawTargets).trim().toLowerCase()]).filter(Boolean);',
    '',
    '              const hasSpecificBatch = targetBatchIds.length > 0 && !targetBatchIds.includes("all") && !targetBatchIds.includes("all_paid") && !targetBatchIds.includes("all_free");',
    '',
    '              if (vis === "batch" || hasSpecificBatch) {',
    '                if (targetBatchIds.includes("all") || targetBatchIds.includes("all_paid")) return true;',
    '                if (targetBatchIds.length === 0) return false;',
    '                return studentBatches.some((b: string) => targetBatchIds.includes(b));',
    '              }',
    '',
    '              if (vis === "premium" || vis === "paid") {',
    '                return studentBatches.length > 0 || user?.role === "student";',
    '              }',
    '',
    '              return true;',
    '            });',
    '          }',
    '',
    '          setLmsResources(list);',
    '',
    '          if (Platform.OS === "web" && !isFirstResourceSnapshot) {',
    '            snapshot.docChanges().forEach((change) => {',
    '              if (change.type === "added") {',
    '                const data = change.doc.data() as any;',
    '                const createdMs = data.createdAt ? (data.createdAt.toDate ? data.createdAt.toDate().getTime() : new Date(data.createdAt).getTime()) : 0;',
    '                if (createdMs > 0 && createdMs < (appStartTimeRef.current - 60000)) {',
    '                  return;',
    '                }',
    '                const vis = (data.visibility || "").toLowerCase();',
    '                const aud = (data.targetAudience || data.audience || "").toLowerCase();',
    '                const isEnrolledOnly = vis === "premium" || vis === "paid" || vis === "batch" || vis === "enrolled" ||',
    '                  aud === "paid" || aud === "enrolled" || aud === "batch" ||',
    '                  (Array.isArray(data.targetBatchIds) && (data.targetBatchIds.includes("all_paid") || (vis === "batch" && data.targetBatchIds.length > 0)));',
    '                if (user?.role === "guest" && isEnrolledOnly) {',
    '                  return;',
    '                }',
    '                if (user?.role === "student") {',
    '                  const myStudent = getLoggedInStudent(user, studentsRef.current);',
    '                  const studentBatches: string[] = [];',
    '                  if (myStudent?.batch) studentBatches.push(String(myStudent.batch).trim().toLowerCase());',
    '                  if (myStudent?.batchName) studentBatches.push(String(myStudent.batchName).trim().toLowerCase());',
    '                  if (myStudent?.batchId) studentBatches.push(String(myStudent.batchId).trim().toLowerCase());',
    '                  if (user?.batch) studentBatches.push(String(user.batch).trim().toLowerCase());',
    '                  if (user?.batchName) studentBatches.push(String(user.batchName).trim().toLowerCase());',
    '                  if (user?.batchId) studentBatches.push(String(user.batchId).trim().toLowerCase());',
    '                  const arrBatches = myStudent?.batches || user?.batches;',
    '                  if (Array.isArray(arrBatches)) {',
    '                    arrBatches.forEach((b: any) => { if (b) studentBatches.push(String(b).trim().toLowerCase()); });',
    '                  }',
    '                  const rawTargets = data.targetBatchIds || [];',
    '                  const targetBatchIds = (Array.isArray(rawTargets)',
    '                    ? rawTargets.map((id: any) => String(id).trim().toLowerCase())',
    '                    : [String(rawTargets).trim().toLowerCase()]).filter(Boolean);',
    '                  const hasSpecificBatch = targetBatchIds.length > 0 && !targetBatchIds.includes("all") && !targetBatchIds.includes("all_paid") && !targetBatchIds.includes("all_free");',
    '                  if ((vis === "batch" || hasSpecificBatch) && !targetBatchIds.includes("all") && !targetBatchIds.includes("all_paid")) {',
    '                    if (targetBatchIds.length === 0 || !studentBatches.some((b: string) => targetBatchIds.includes(b))) {',
    '                      return;',
    '                    }',
    '                  }',
    '                }',
    '                const notifTitle = isAdmin ? "📚 New Resource Added" : (user?.role === "guest" ? "📚 Free Study Material Available" : "📚 New Study Material");',
    '                showPhoneNotification(notifTitle, data.title || "New study PDF uploaded", {',
    '                  targetTab: user?.role === "guest" ? "resources" : "lms",',
    '                  targetSub: "resources",',
    '                  dedupeId: `res_${change.doc.id}`',
    '                });',
    '              }',
    '            });',
    '          }'
  ];
  lines.splice(snapshotStart, snapshotEnd - snapshotStart, ...replacementLines);
} else {
  console.error("Could not find snapshot block range!");
}

// 2. Locate filteredResources in LMS Resources rendering
let filterStart = -1;
let filterEnd = -1;

for (let i = 39700; i < Math.min(39850, lines.length); i++) {
  if (lines[i].includes('const filteredResources = lmsResources.filter(r => {')) {
    filterStart = i;
  }
  if (filterStart !== -1 && lines[i].includes('return matchSearch && matchCat;')) {
    filterEnd = i + 1; // includes the closing of the filter
    break;
  }
}

if (filterStart !== -1 && filterEnd !== -1) {
  console.log(`Found filteredResources block from line ${filterStart + 1} to line ${filterEnd + 1}`);
  const replacementFilter = [
    '                          const filteredResources = lmsResources.filter(r => {',
    '                            const matchSearch = !lmsResourceSearch || (r.title || r.name || "").toLowerCase().includes(lmsResourceSearch.toLowerCase());',
    '                            const matchCat = lmsResourceCategory === "All" || (r.type || r.fileType || "").toLowerCase() === lmsResourceCategory.toLowerCase();',
    '                            if (!matchSearch || !matchCat) return false;',
    '',
    '                            if (user?.role === "student") {',
    '                              const myStudent = getLoggedInStudent(user, studentsRef.current);',
    '                              const studentBatches: string[] = [];',
    '                              if (myStudent?.batch) studentBatches.push(String(myStudent.batch).trim().toLowerCase());',
    '                              if (myStudent?.batchName) studentBatches.push(String(myStudent.batchName).trim().toLowerCase());',
    '                              if (myStudent?.batchId) studentBatches.push(String(myStudent.batchId).trim().toLowerCase());',
    '                              if (user?.batch) studentBatches.push(String(user.batch).trim().toLowerCase());',
    '                              if (user?.batchName) studentBatches.push(String(user.batchName).trim().toLowerCase());',
    '                              if (user?.batchId) studentBatches.push(String(user.batchId).trim().toLowerCase());',
    '                              const arrBatches = myStudent?.batches || user?.batches;',
    '                              if (Array.isArray(arrBatches)) {',
    '                                arrBatches.forEach((b: any) => { if (b) studentBatches.push(String(b).trim().toLowerCase()); });',
    '                              }',
    '',
    '                              const vis = String(r.visibility || "public").trim().toLowerCase();',
    '                              if (vis === "guest") return false;',
    '                              if (vis === "public" || vis === "free") return true;',
    '',
    '                              const rawTargets = r.targetBatchIds || [];',
    '                              const targetBatchIds = (Array.isArray(rawTargets)',
    '                                ? rawTargets.map((id: any) => String(id).trim().toLowerCase())',
    '                                : [String(rawTargets).trim().toLowerCase()]).filter(Boolean);',
    '',
    '                              const hasSpecificBatch = targetBatchIds.length > 0 && !targetBatchIds.includes("all") && !targetBatchIds.includes("all_paid") && !targetBatchIds.includes("all_free");',
    '',
    '                              if (vis === "batch" || hasSpecificBatch) {',
    '                                if (targetBatchIds.includes("all") || targetBatchIds.includes("all_paid")) return true;',
    '                                if (targetBatchIds.length === 0) return false;',
    '                                return studentBatches.some((b: string) => targetBatchIds.includes(b));',
    '                              }',
    '                            }',
    '                            return true;',
    '                          });'
  ];
  lines.splice(filterStart, filterEnd - filterStart + 1, ...replacementFilter);
} else {
  console.error("Could not find filteredResources range!");
}

const newline = isCrlf ? '\r\n' : '\n';
fs.writeFileSync(appPath, lines.join(newline), 'utf8');
console.log("Updated App.tsx successfully!");
