/**
 * Patch: Fix Admin Dashboard notification cleanup in web_portal/App.tsx
 * Inserts deleteDoc(admin_alerts) after each action handler (approve/reject).
 */

const fs = require('fs');
const FILE = String.raw`d:\unistrix\NERMAI_IAS_ACADEMY\web_portal\App.tsx`;

let content = fs.readFileSync(FILE, 'utf8');
const originalLen = content.length;
const results = [];

function insertAfter(str, search, insert, occurrence = 1) {
  let count = 0, idx = 0;
  while (true) {
    const found = str.indexOf(search, idx);
    if (found === -1) return [str, false];
    count++;
    if (count === occurrence) {
      const pos = found + search.length;
      return [str.slice(0, pos) + insert + str.slice(pos), true];
    }
    idx = found + 1;
  }
}

// ─── PATCH 1: approveProfileRequest ─────────────────────────────────────────
const [c1, ok1] = insertAfter(
  content,
  'await api.put(`/erp/profile-request/${id}/approve`, { reviewedBy: user.name }, undefined, 60000);\r\n',
  '          // Remove matching alert from Admin Dashboard\r\n' +
  '          const approveProfileAlertId = `profile_req_${id}`;\r\n' +
  '          deleteDoc(doc(db, "admin_alerts", approveProfileAlertId)).catch(() => {});\r\n' +
  '          setAdminAlerts(prev => prev.filter(a => a.id !== approveProfileAlertId));\r\n'
);
content = c1;
results.push(['PATCH 1 - approveProfileRequest alert cleanup', ok1]);

// ─── PATCH 2: rejectProfileRequest ──────────────────────────────────────────
const [c2, ok2] = insertAfter(
  content,
  'await api.put(`/erp/profile-request/${id}/reject`, { reviewedBy: user.name, rejectionReason: reason });\r\n',
  '          // Remove matching alert from Admin Dashboard\r\n' +
  '          const rejectProfileAlertId = `profile_req_${id}`;\r\n' +
  '          deleteDoc(doc(db, "admin_alerts", rejectProfileAlertId)).catch(() => {});\r\n' +
  '          setAdminAlerts(prev => prev.filter(a => a.id !== rejectProfileAlertId));\r\n'
);
content = c2;
results.push(['PATCH 2 - rejectProfileRequest alert cleanup', ok2]);

// ─── PATCH 3: handleSacsBulkApprove ─────────────────────────────────────────
const [c3, ok3] = insertAfter(
  content,
  'await api.post("/access-rules/admin/requests/bulk-approve", {\r\n        requestIds: sacsSelectedIds,\r\n        grantExpiresAt: new Date(Date.now() + 48 * 60 * 60 * 1000).toISOString()\r\n      });\r\n',
  '      // Remove all matching sacs alerts from Admin Dashboard\r\n' +
  '      sacsSelectedIds.forEach(reqId => {\r\n' +
  '        const alertId = `sacs_req_${reqId}`;\r\n' +
  '        deleteDoc(doc(db, "admin_alerts", alertId)).catch(() => {});\r\n' +
  '      });\r\n' +
  '      setAdminAlerts(prev => prev.filter(a => !sacsSelectedIds.some(rid => a.id === `sacs_req_${rid}`)));\r\n'
);
content = c3;
results.push(['PATCH 3 - handleSacsBulkApprove alert cleanup', ok3]);

// ─── PATCH 4: handleSacsApprove ─────────────────────────────────────────────
const [c4, ok4] = insertAfter(
  content,
  'await api.post(`/access-rules/admin/requests/${requestId}/approve`, {\r\n        grantExpiresAt: new Date(Date.now() + 48 * 60 * 60 * 1000).toISOString()\r\n      });\r\n',
  '      // Remove matching alert from Admin Dashboard\r\n' +
  '      const sacsApproveAlertId = `sacs_req_${requestId}`;\r\n' +
  '      deleteDoc(doc(db, "admin_alerts", sacsApproveAlertId)).catch(() => {});\r\n' +
  '      setAdminAlerts(prev => prev.filter(a => a.id !== sacsApproveAlertId));\r\n'
);
content = c4;
results.push(['PATCH 4 - handleSacsApprove alert cleanup', ok4]);

// ─── PATCH 5: handleSacsReject ──────────────────────────────────────────────
const [c5, ok5] = insertAfter(
  content,
  'await api.post(`/access-rules/admin/requests/${requestId}/reject`, {\r\n        reason: "Rejected by Administrator"\r\n      });\r\n',
  '      // Remove matching alert from Admin Dashboard\r\n' +
  '      const sacsRejectAlertId = `sacs_req_${requestId}`;\r\n' +
  '      deleteDoc(doc(db, "admin_alerts", sacsRejectAlertId)).catch(() => {});\r\n' +
  '      setAdminAlerts(prev => prev.filter(a => a.id !== sacsRejectAlertId));\r\n'
);
content = c5;
results.push(['PATCH 5 - handleSacsReject alert cleanup', ok5]);

// ─── PATCH 6: resolveEnquiry ────────────────────────────────────────────────
const [c6, ok6] = insertAfter(
  content,
  'await api.patch(`/crm/inquiry/${id}`, { status: "resolved" });\r\n',
  '      // Remove matching crm_inquiry alerts from Admin Dashboard\r\n' +
  '      const resolveInqAlerts = adminAlerts.filter((a) => a.type === "crm_inquiry" && (a.sourceDocId === id || (a.id || "").includes(id)));\r\n' +
  '      resolveInqAlerts.forEach((a) => { deleteDoc(doc(db, "admin_alerts", a.id)).catch(() => {}); });\r\n' +
  '      if (resolveInqAlerts.length > 0) setAdminAlerts((prev) => prev.filter((a) => !(a.type === "crm_inquiry" && (a.sourceDocId === id || (a.id || "").includes(id)))));\r\n'
);
content = c6;
results.push(['PATCH 6 - resolveEnquiry alert cleanup', ok6]);

// ─── PATCH 7: deleteEnquiry ─────────────────────────────────────────────────
const [c7, ok7] = insertAfter(
  content,
  'await api.delete(`/crm/inquiry/${id}`);\r\n',
  '      // Remove matching crm_inquiry alerts from Admin Dashboard\r\n' +
  '      const deleteInqAlerts = adminAlerts.filter((a) => a.type === "crm_inquiry" && (a.sourceDocId === id || (a.id || "").includes(id)));\r\n' +
  '      deleteInqAlerts.forEach((a) => { deleteDoc(doc(db, "admin_alerts", a.id)).catch(() => {}); });\r\n' +
  '      if (deleteInqAlerts.length > 0) setAdminAlerts((prev) => prev.filter((a) => !(a.type === "crm_inquiry" && (a.sourceDocId === id || (a.id || "").includes(id)))));\r\n'
);
content = c7;
results.push(['PATCH 7 - deleteEnquiry alert cleanup', ok7]);

// ─── PATCH 8: Offline Test approve (Test Portal) ─────────────────────────────
const [c8, ok8] = insertAfter(
  content,
  'await setDoc(doc(db, "offlineTestPermissionRequests", req.id), { ...req, status: "approved", updatedAt: new Date().toISOString() }, { merge: true });\r\n                                                        } catch (_) { }\r\n',
  '                                                        // Remove matching alert from Admin Dashboard\r\n' +
  '                                                        const approveTestAlertId = `offline_test_${req.id}`;\r\n' +
  '                                                        deleteDoc(doc(db, "admin_alerts", approveTestAlertId)).catch(() => {});\r\n' +
  '                                                        setAdminAlerts((prev) => prev.filter((a) => a.id !== approveTestAlertId));\r\n'
);
content = c8;
results.push(['PATCH 8 - Offline Test Approve button (Test Portal)', ok8]);

// ─── PATCH 9: Offline Test reject (Test Portal) ──────────────────────────────
const [c9, ok9] = insertAfter(
  content,
  'await setDoc(doc(db, "offlineTestPermissionRequests", req.id), { ...req, status: "rejected", updatedAt: new Date().toISOString() }, { merge: true });\r\n                                                        } catch (_) { }\r\n',
  '                                                        // Remove matching alert from Admin Dashboard\r\n' +
  '                                                        const rejectTestAlertId = `offline_test_${req.id}`;\r\n' +
  '                                                        deleteDoc(doc(db, "admin_alerts", rejectTestAlertId)).catch(() => {});\r\n' +
  '                                                        setAdminAlerts((prev) => prev.filter((a) => a.id !== rejectTestAlertId));\r\n'
);
content = c9;
results.push(['PATCH 9 - Offline Test Reject button (Test Portal)', ok9]);

// ─── Summary ────────────────────────────────────────────────────────────────
console.log('\n=== PATCH RESULTS ===');
let allOk = true;
for (const [name, applied] of results) {
  const status = applied ? '✅ APPLIED' : '❌ NOT FOUND';
  if (!applied) allOk = false;
  console.log(`  ${status}: ${name}`);
}
console.log(`\nOriginal: ${originalLen} bytes`);
console.log(`Patched:  ${content.length} bytes`);
console.log(`Delta:    +${content.length - originalLen} bytes`);

if (allOk) {
  fs.writeFileSync(FILE, content, 'utf8');
  console.log('\n✅ SUCCESS: All 9 patches applied and file saved.');
} else {
  console.log('\n⚠️  Some patches not found. Searching for clues...');
  // Debug: print search for PATCH 8 pattern manually
  const p8 = 'await setDoc(doc(db, "offlineTestPermissionRequests", req.id), { ...req, status: "approved"';
  const idx = content.indexOf(p8);
  console.log(`  PATCH 8 search term found at index: ${idx}`);
  if (idx > 0) {
    console.log('  Context around it:\n', JSON.stringify(content.slice(idx, idx + 300)));
  }
  // Save anyway for review
  fs.writeFileSync(FILE + '.patched_partial', content, 'utf8');
  console.log('  Partial patch saved to .patched_partial for review.');
}
