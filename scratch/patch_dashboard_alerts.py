"""
Patch script: Fix Admin Dashboard notification cleanup in web_portal/App.tsx
Inserts admin_alerts deleteDoc calls after each action handler.
Handles CRLF line endings correctly.
"""

import re

FILE = r"d:\unistrix\NERMAI_IAS_ACADEMY\web_portal\App.tsx"

with open(FILE, "r", encoding="utf-8") as f:
    content = f.read()

original_len = len(content)
patches_applied = []

# ─── Helper ───────────────────────────────────────────────────────────────────
def insert_after(content, search_str, insert_str, occurrence=1):
    """Insert insert_str immediately after occurrence of search_str."""
    idx = -1
    count = 0
    start = 0
    while True:
        found = content.find(search_str, start)
        if found == -1:
            return content, False
        count += 1
        if count == occurrence:
            idx = found + len(search_str)
            break
        start = found + 1
    return content[:idx] + insert_str + content[idx:], True

# ─── PATCH 1: approveProfileRequest ──────────────────────────────────────────
# Insert alert cleanup right after the api.put approve call succeeds
search1 = 'await api.put(`/erp/profile-request/${id}/approve`, { reviewedBy: user.name }, undefined, 60000);\r\n'
insert1 = (
    '          // Remove matching alert from Admin Dashboard\r\n'
    '          const alertId = `profile_req_${id}`;\r\n'
    '          deleteDoc(doc(db, "admin_alerts", alertId)).catch(() => {});\r\n'
    '          setAdminAlerts(prev => prev.filter(a => a.id !== alertId));\r\n'
)
content, ok = insert_after(content, search1, insert1)
patches_applied.append(("PATCH 1 - approveProfileRequest", ok))

# ─── PATCH 2: rejectProfileRequest ───────────────────────────────────────────
search2 = 'await api.put(`/erp/profile-request/${id}/reject`, { reviewedBy: user.name, rejectionReason: reason });\r\n'
insert2 = (
    '          // Remove matching alert from Admin Dashboard\r\n'
    '          const alertId2 = `profile_req_${id}`;\r\n'
    '          deleteDoc(doc(db, "admin_alerts", alertId2)).catch(() => {});\r\n'
    '          setAdminAlerts(prev => prev.filter(a => a.id !== alertId2));\r\n'
)
content, ok = insert_after(content, search2, insert2)
patches_applied.append(("PATCH 2 - rejectProfileRequest", ok))

# ─── PATCH 3: handleSacsBulkApprove ──────────────────────────────────────────
search3 = (
    'await api.post("/access-rules/admin/requests/bulk-approve", {\r\n'
    '        requestIds: sacsSelectedIds,\r\n'
    '        grantExpiresAt: new Date(Date.now() + 48 * 60 * 60 * 1000).toISOString()\r\n'
    '      });\r\n'
)
insert3 = (
    '      // Remove all matching sacs alerts from Admin Dashboard\r\n'
    '      sacsSelectedIds.forEach(reqId => {\r\n'
    '        const alertId = `sacs_req_${reqId}`;\r\n'
    '        deleteDoc(doc(db, "admin_alerts", alertId)).catch(() => {});\r\n'
    '      });\r\n'
    '      setAdminAlerts(prev => prev.filter(a => !sacsSelectedIds.some(rid => a.id === `sacs_req_${rid}`)));\r\n'
)
content, ok = insert_after(content, search3, insert3)
patches_applied.append(("PATCH 3 - handleSacsBulkApprove", ok))

# ─── PATCH 4: handleSacsApprove ──────────────────────────────────────────────
search4 = (
    'await api.post(`/access-rules/admin/requests/${requestId}/approve`, {\r\n'
    '        grantExpiresAt: new Date(Date.now() + 48 * 60 * 60 * 1000).toISOString()\r\n'
    '      });\r\n'
)
insert4 = (
    '      // Remove matching alert from Admin Dashboard\r\n'
    '      const sacsApproveAlertId = `sacs_req_${requestId}`;\r\n'
    '      deleteDoc(doc(db, "admin_alerts", sacsApproveAlertId)).catch(() => {});\r\n'
    '      setAdminAlerts(prev => prev.filter(a => a.id !== sacsApproveAlertId));\r\n'
)
content, ok = insert_after(content, search4, insert4)
patches_applied.append(("PATCH 4 - handleSacsApprove", ok))

# ─── PATCH 5: handleSacsReject ───────────────────────────────────────────────
search5 = (
    'await api.post(`/access-rules/admin/requests/${requestId}/reject`, {\r\n'
    '        reason: "Rejected by Administrator"\r\n'
    '      });\r\n'
)
insert5 = (
    '      // Remove matching alert from Admin Dashboard\r\n'
    '      const sacsRejectAlertId = `sacs_req_${requestId}`;\r\n'
    '      deleteDoc(doc(db, "admin_alerts", sacsRejectAlertId)).catch(() => {});\r\n'
    '      setAdminAlerts(prev => prev.filter(a => a.id !== sacsRejectAlertId));\r\n'
)
content, ok = insert_after(content, search5, insert5)
patches_applied.append(("PATCH 5 - handleSacsReject", ok))

# ─── PATCH 6: resolveEnquiry ─────────────────────────────────────────────────
search6 = 'await api.patch(`/crm/inquiry/${id}`, { status: "resolved" });\r\n'
insert6 = (
    '      // Remove matching crm_inquiry alerts from Admin Dashboard\r\n'
    '      const resolveAlerts = adminAlerts.filter((a: any) => a.type === "crm_inquiry" && (a.sourceDocId === id || (a.id || "").includes(id)));\r\n'
    '      resolveAlerts.forEach((a: any) => { deleteDoc(doc(db, "admin_alerts", a.id)).catch(() => {}); });\r\n'
    '      if (resolveAlerts.length > 0) setAdminAlerts((prev: any[]) => prev.filter((a: any) => !(a.type === "crm_inquiry" && (a.sourceDocId === id || (a.id || "").includes(id)))));\r\n'
)
content, ok = insert_after(content, search6, insert6)
patches_applied.append(("PATCH 6 - resolveEnquiry", ok))

# ─── PATCH 7: deleteEnquiry ──────────────────────────────────────────────────
search7 = 'await api.delete(`/crm/inquiry/${id}`);\r\n'
insert7 = (
    '      // Remove matching crm_inquiry alerts from Admin Dashboard\r\n'
    '      const deleteAlerts = adminAlerts.filter((a: any) => a.type === "crm_inquiry" && (a.sourceDocId === id || (a.id || "").includes(id)));\r\n'
    '      deleteAlerts.forEach((a: any) => { deleteDoc(doc(db, "admin_alerts", a.id)).catch(() => {}); });\r\n'
    '      if (deleteAlerts.length > 0) setAdminAlerts((prev: any[]) => prev.filter((a: any) => !(a.type === "crm_inquiry" && (a.sourceDocId === id || (a.id || "").includes(id)))));\r\n'
)
content, ok = insert_after(content, search7, insert7)
patches_applied.append(("PATCH 7 - deleteEnquiry", ok))

# ─── PATCH 8 & 9: Offline Test Portal approve/reject ─────────────────────────
# The approve button in the Test Portal (test requests list) has a setDoc call with "approved"
# followed by the existing setOfflineTestRequests call. We insert the alert cleanup
# right after the inner try/catch block that wraps setDoc.

# Pattern: after the } catch (_) { } that wraps the setDoc offlineTestPermissionRequests approved call
# We search for the specific block: approved context
search8 = (
    'await setDoc(doc(db, "offlineTestPermissionRequests", req.id), { ...req, status: "approved", updatedAt: new Date().toISOString() }, { merge: true });\r\n'
    '                                                        } catch (_) { }\r\n'
)
insert8 = (
    '                                                        // Remove matching alert from Admin Dashboard\r\n'
    '                                                        const approveAlertId = `offline_test_${req.id}`;\r\n'
    '                                                        deleteDoc(doc(db, "admin_alerts", approveAlertId)).catch(() => {});\r\n'
    '                                                        setAdminAlerts((prev: any[]) => prev.filter((a: any) => a.id !== approveAlertId));\r\n'
)
content, ok = insert_after(content, search8, insert8)
patches_applied.append(("PATCH 8 - Offline Test Approve (Test Portal)", ok))

# PATCH 9: reject version
search9 = (
    'await setDoc(doc(db, "offlineTestPermissionRequests", req.id), { ...req, status: "rejected", updatedAt: new Date().toISOString() }, { merge: true });\r\n'
    '                                                        } catch (_) { }\r\n'
)
insert9 = (
    '                                                        // Remove matching alert from Admin Dashboard\r\n'
    '                                                        const rejectAlertId = `offline_test_${req.id}`;\r\n'
    '                                                        deleteDoc(doc(db, "admin_alerts", rejectAlertId)).catch(() => {});\r\n'
    '                                                        setAdminAlerts((prev: any[]) => prev.filter((a: any) => a.id !== rejectAlertId));\r\n'
)
content, ok = insert_after(content, search9, insert9)
patches_applied.append(("PATCH 9 - Offline Test Reject (Test Portal)", ok))

# ─── Summary ──────────────────────────────────────────────────────────────────
print("\n=== PATCH RESULTS ===")
all_ok = True
for name, applied in patches_applied:
    status = "✅ APPLIED" if applied else "❌ NOT FOUND"
    if not applied:
        all_ok = False
    print(f"  {status}: {name}")

new_len = len(content)
print(f"\nOriginal size: {original_len} bytes")
print(f"Patched size:  {new_len} bytes")
print(f"Delta:         +{new_len - original_len} bytes")

if all_ok:
    with open(FILE, "w", encoding="utf-8") as f:
        f.write(content)
    print("\n✅ SUCCESS: All patches applied and file saved.")
else:
    print("\n⚠️  Some patches were NOT found. File NOT saved to avoid partial writes.")
    print("   Manually check patterns above.")
