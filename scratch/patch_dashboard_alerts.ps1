
# Patch: Admin Dashboard notification cleanup fix for web_portal/App.tsx
# Operates on line ranges to safely insert cleanup calls after each action handler

$filePath = "d:\unistrix\NERMAI_IAS_ACADEMY\web_portal\App.tsx"
$lines = [System.IO.File]::ReadAllLines($filePath, [System.Text.Encoding]::UTF8)

Write-Host "Total lines: $($lines.Count)"

# ─── PATCH 1: approveProfileRequest — add alert cleanup after api.put (line ~14049) ───
# Find the line that says: await api.put(`/erp/profile-request/${id}/approve`
$patchLine1 = -1
for ($i = 14045; $i -le 14060; $i++) {
    if ($lines[$i-1] -match "api\.put.*profile-request.*approve") {
        $patchLine1 = $i
        break
    }
}
if ($patchLine1 -gt 0) {
    Write-Host "PATCH 1: Found approveProfileRequest api.put at line $patchLine1"
    # Check if cleanup already present
    $checkLine = $lines[$patchLine1]  # line after api.put
    if ($checkLine -notmatch "admin_alerts") {
        $indent = "          "
        $newLines = @(
            "$indent// Remove matching alert from Admin Dashboard",
            "${indent}const alertId = ``profile_req_`${id}``;"
            "${indent}deleteDoc(doc(db, ""admin_alerts"", alertId)).catch(() => {});"
            "${indent}setAdminAlerts(prev => prev.filter(a => a.id !== alertId));"
        )
        $result = [System.Collections.Generic.List[string]]($lines[0..($patchLine1-1)])
        $result.AddRange($newLines)
        $result.AddRange($lines[$patchLine1..($lines.Count-1)])
        $lines = $result.ToArray()
        Write-Host "PATCH 1: Applied (+$($newLines.Count) lines)"
    } else {
        Write-Host "PATCH 1: Already patched, skipping."
    }
} else {
    Write-Host "PATCH 1: Could not find target line!"
}

# Refresh line count after patch 1
Write-Host "Lines after patch 1: $($lines.Count)"

# ─── PATCH 2: rejectProfileRequest — add alert cleanup after api.put (line ~14072 + offset) ───
$patchLine2 = -1
for ($i = 14060; $i -le 14110; $i++) {
    if ($lines[$i-1] -match "api\.put.*profile-request.*reject") {
        $patchLine2 = $i
        break
    }
}
if ($patchLine2 -gt 0) {
    Write-Host "PATCH 2: Found rejectProfileRequest api.put at line $patchLine2"
    $checkLine = $lines[$patchLine2]
    if ($checkLine -notmatch "admin_alerts") {
        $indent = "          "
        $newLines = @(
            "$indent// Remove matching alert from Admin Dashboard",
            "${indent}const alertId = ``profile_req_`${id}``;"
            "${indent}deleteDoc(doc(db, ""admin_alerts"", alertId)).catch(() => {});"
            "${indent}setAdminAlerts(prev => prev.filter(a => a.id !== alertId));"
        )
        $result = [System.Collections.Generic.List[string]]($lines[0..($patchLine2-1)])
        $result.AddRange($newLines)
        $result.AddRange($lines[$patchLine2..($lines.Count-1)])
        $lines = $result.ToArray()
        Write-Host "PATCH 2: Applied (+$($newLines.Count) lines)"
    } else {
        Write-Host "PATCH 2: Already patched, skipping."
    }
} else {
    Write-Host "PATCH 2: Could not find target line!"
}

Write-Host "Lines after patch 2: $($lines.Count)"

# ─── PATCH 3: handleSacsBulkApprove — add alert cleanup before Alert.alert ───
$patchLine3 = -1
for ($i = 11770; $i -le 11800; $i++) {
    if ($lines[$i-1] -match 'Alert\.alert\(\"Success\",.*Approved.*requests successfully') {
        $patchLine3 = $i
        break
    }
}
if ($patchLine3 -gt 0) {
    Write-Host "PATCH 3: Found handleSacsBulkApprove Alert.alert at line $patchLine3"
    $checkLine = $lines[$patchLine3-2]
    if ($checkLine -notmatch "admin_alerts") {
        $indent = "      "
        $newLines = @(
            "$indent// Remove all matching sacs alerts from Admin Dashboard",
            "${indent}sacsSelectedIds.forEach(reqId => {",
            "${indent}  const alertId = ``sacs_req_`${reqId}``;"
            "${indent}  deleteDoc(doc(db, ""admin_alerts"", alertId)).catch(() => {});"
            "${indent}});"
            "${indent}setAdminAlerts(prev => prev.filter(a => !sacsSelectedIds.some(rid => a.id === ``sacs_req_`${rid}``)));"
        )
        $result = [System.Collections.Generic.List[string]]($lines[0..($patchLine3-2)])
        $result.AddRange($newLines)
        $result.AddRange($lines[($patchLine3-1)..($lines.Count-1)])
        $lines = $result.ToArray()
        Write-Host "PATCH 3: Applied (+$($newLines.Count) lines)"
    } else {
        Write-Host "PATCH 3: Already patched, skipping."
    }
} else {
    Write-Host "PATCH 3: Could not find target line!"
}

Write-Host "Lines after patch 3: $($lines.Count)"

# ─── PATCH 4: handleSacsApprove — add alert cleanup after api.post ───
$patchLine4 = -1
for ($i = 11785; $i -le 11830; $i++) {
    if ($lines[$i-1] -match 'Alert\.alert\(\"Success\", \"Request approved successfully') {
        $patchLine4 = $i
        break
    }
}
if ($patchLine4 -gt 0) {
    Write-Host "PATCH 4: Found handleSacsApprove Alert.alert at line $patchLine4"
    $checkLine = $lines[$patchLine4-2]
    if ($checkLine -notmatch "admin_alerts") {
        $indent = "      "
        $newLines = @(
            "$indent// Remove matching alert from Admin Dashboard",
            "${indent}const alertId = ``sacs_req_`${requestId}``;"
            "${indent}deleteDoc(doc(db, ""admin_alerts"", alertId)).catch(() => {});"
            "${indent}setAdminAlerts(prev => prev.filter(a => a.id !== alertId));"
        )
        $result = [System.Collections.Generic.List[string]]($lines[0..($patchLine4-2)])
        $result.AddRange($newLines)
        $result.AddRange($lines[($patchLine4-1)..($lines.Count-1)])
        $lines = $result.ToArray()
        Write-Host "PATCH 4: Applied (+$($newLines.Count) lines)"
    } else {
        Write-Host "PATCH 4: Already patched, skipping."
    }
} else {
    Write-Host "PATCH 4: Could not find target line!"
}

Write-Host "Lines after patch 4: $($lines.Count)"

# ─── PATCH 5: handleSacsReject — add alert cleanup after api.post ───
$patchLine5 = -1
for ($i = 11800; $i -le 11850; $i++) {
    if ($lines[$i-1] -match 'Alert\.alert\(\"Success\", \"Request rejected successfully') {
        $patchLine5 = $i
        break
    }
}
if ($patchLine5 -gt 0) {
    Write-Host "PATCH 5: Found handleSacsReject Alert.alert at line $patchLine5"
    $checkLine = $lines[$patchLine5-2]
    if ($checkLine -notmatch "admin_alerts") {
        $indent = "      "
        $newLines = @(
            "$indent// Remove matching alert from Admin Dashboard",
            "${indent}const alertId = ``sacs_req_`${requestId}``;"
            "${indent}deleteDoc(doc(db, ""admin_alerts"", alertId)).catch(() => {});"
            "${indent}setAdminAlerts(prev => prev.filter(a => a.id !== alertId));"
        )
        $result = [System.Collections.Generic.List[string]]($lines[0..($patchLine5-2)])
        $result.AddRange($newLines)
        $result.AddRange($lines[($patchLine5-1)..($lines.Count-1)])
        $lines = $result.ToArray()
        Write-Host "PATCH 5: Applied (+$($newLines.Count) lines)"
    } else {
        Write-Host "PATCH 5: Already patched, skipping."
    }
} else {
    Write-Host "PATCH 5: Could not find target line!"
}

Write-Host "Lines after patch 5: $($lines.Count)"

# ─── PATCH 6: resolveEnquiry — add alert cleanup after api.patch ───
$patchLine6 = -1
for ($i = 12730; $i -le 12780; $i++) {
    if ($lines[$i-1] -match "api\.patch.*crm/inquiry.*status.*resolved") {
        $patchLine6 = $i
        break
    }
}
if ($patchLine6 -gt 0) {
    Write-Host "PATCH 6: Found resolveEnquiry api.patch at line $patchLine6"
    $checkLine = $lines[$patchLine6]
    if ($checkLine -notmatch "admin_alerts") {
        $indent = "      "
        $newLines = @(
            "$indent// Remove matching crm_inquiry alerts from Admin Dashboard",
            "${indent}const matchingInqAlerts = adminAlerts.filter((a: any) => a.type === ""crm_inquiry"" && (a.sourceDocId === id || (a.id || """")?.includes(id)));"
            "${indent}matchingInqAlerts.forEach((a: any) => { deleteDoc(doc(db, ""admin_alerts"", a.id)).catch(() => {}); });"
            "${indent}if (matchingInqAlerts.length > 0) setAdminAlerts((prev: any[]) => prev.filter((a: any) => !(a.type === ""crm_inquiry"" && (a.sourceDocId === id || (a.id || """")?.includes(id)))));"
        )
        $result = [System.Collections.Generic.List[string]]($lines[0..($patchLine6-1)])
        $result.AddRange($newLines)
        $result.AddRange($lines[$patchLine6..($lines.Count-1)])
        $lines = $result.ToArray()
        Write-Host "PATCH 6: Applied (+$($newLines.Count) lines)"
    } else {
        Write-Host "PATCH 6: Already patched, skipping."
    }
} else {
    Write-Host "PATCH 6: Could not find target line!"
}

Write-Host "Lines after patch 6: $($lines.Count)"

# ─── PATCH 7: deleteEnquiry — add alert cleanup after api.delete ───
$patchLine7 = -1
for ($i = 12760; $i -le 12820; $i++) {
    if ($lines[$i-1] -match "api\.delete.*crm/inquiry") {
        $patchLine7 = $i
        break
    }
}
if ($patchLine7 -gt 0) {
    Write-Host "PATCH 7: Found deleteEnquiry api.delete at line $patchLine7"
    $checkLine = $lines[$patchLine7]
    if ($checkLine -notmatch "admin_alerts") {
        $indent = "      "
        $newLines = @(
            "$indent// Remove matching crm_inquiry alerts from Admin Dashboard",
            "${indent}const matchingDelAlerts = adminAlerts.filter((a: any) => a.type === ""crm_inquiry"" && (a.sourceDocId === id || (a.id || """")?.includes(id)));"
            "${indent}matchingDelAlerts.forEach((a: any) => { deleteDoc(doc(db, ""admin_alerts"", a.id)).catch(() => {}); });"
            "${indent}if (matchingDelAlerts.length > 0) setAdminAlerts((prev: any[]) => prev.filter((a: any) => !(a.type === ""crm_inquiry"" && (a.sourceDocId === id || (a.id || """")?.includes(id)))));"
        )
        $result = [System.Collections.Generic.List[string]]($lines[0..($patchLine7-1)])
        $result.AddRange($newLines)
        $result.AddRange($lines[$patchLine7..($lines.Count-1)])
        $lines = $result.ToArray()
        Write-Host "PATCH 7: Applied (+$($newLines.Count) lines)"
    } else {
        Write-Host "PATCH 7: Already patched, skipping."
    }
} else {
    Write-Host "PATCH 7: Could not find target line!"
}

Write-Host "Lines after patch 7: $($lines.Count)"

# ─── PATCH 8 & 9: Offline test approve/reject buttons in Test Portal ───
# Find the approve button handler — look for the api.patch permission-requests approve in ~25050 range
# We search for the line containing the setDoc offlineTestPermissionRequests approved line and inject after
$patchLine8 = -1
$approveCount = 0
for ($i = 25040; $i -le 25100; $i++) {
    if ($lines[$i-1] -match 'setDoc.*offlineTestPermissionRequests.*status.*approved') {
        $approveCount++
        if ($approveCount -eq 1) {
            $patchLine8 = $i
            break
        }
    }
}
if ($patchLine8 -gt 0) {
    Write-Host "PATCH 8: Found offline test approve setDoc at line $patchLine8"
    # Check if cleanup already after this
    $checkRange = $lines[$patchLine8..($patchLine8+3)]
    $alreadyPatched = $checkRange | Where-Object { $_ -match "admin_alerts" }
    if (-not $alreadyPatched) {
        # Find the closing } catch (_) { } line just after this
        $insertAt = $patchLine8
        for ($j = $patchLine8; $j -le $patchLine8+5; $j++) {
            if ($lines[$j-1] -match 'catch.*_.*\{.*\}') {
                $insertAt = $j
                break
            }
        }
        $indent = "                                                        "
        $newLines = @(
            "$indent// Remove matching alert from Admin Dashboard",
            "${indent}const alertId = ``offline_test_`${req.id}``;"
            "${indent}deleteDoc(doc(db, ""admin_alerts"", alertId)).catch(() => {});"
            "${indent}setAdminAlerts((prev: any[]) => prev.filter((a: any) => a.id !== alertId));"
        )
        $result = [System.Collections.Generic.List[string]]($lines[0..($insertAt-1)])
        $result.AddRange($newLines)
        $result.AddRange($lines[$insertAt..($lines.Count-1)])
        $lines = $result.ToArray()
        Write-Host "PATCH 8: Applied (+$($newLines.Count) lines)"
    } else {
        Write-Host "PATCH 8: Already patched, skipping."
    }
} else {
    Write-Host "PATCH 8: Could not find target line!"
}

Write-Host "Lines after patch 8: $($lines.Count)"

# PATCH 9: offline test reject — find the second offlineTestPermissionRequests setDoc with rejected status
$patchLine9 = -1
$rejCount = 0
for ($i = 25070; $i -le 25130; $i++) {
    if ($lines[$i-1] -match 'setDoc.*offlineTestPermissionRequests.*status.*rejected') {
        $rejCount++
        if ($rejCount -eq 1) {
            $patchLine9 = $i
            break
        }
    }
}
if ($patchLine9 -gt 0) {
    Write-Host "PATCH 9: Found offline test reject setDoc at line $patchLine9"
    $checkRange = $lines[$patchLine9..($patchLine9+3)]
    $alreadyPatched = $checkRange | Where-Object { $_ -match "admin_alerts" }
    if (-not $alreadyPatched) {
        $insertAt = $patchLine9
        for ($j = $patchLine9; $j -le $patchLine9+5; $j++) {
            if ($lines[$j-1] -match 'catch.*_.*\{.*\}') {
                $insertAt = $j
                break
            }
        }
        $indent = "                                                        "
        $newLines = @(
            "$indent// Remove matching alert from Admin Dashboard",
            "${indent}const alertId = ``offline_test_`${req.id}``;"
            "${indent}deleteDoc(doc(db, ""admin_alerts"", alertId)).catch(() => {});"
            "${indent}setAdminAlerts((prev: any[]) => prev.filter((a: any) => a.id !== alertId));"
        )
        $result = [System.Collections.Generic.List[string]]($lines[0..($insertAt-1)])
        $result.AddRange($newLines)
        $result.AddRange($lines[$insertAt..($lines.Count-1)])
        $lines = $result.ToArray()
        Write-Host "PATCH 9: Applied (+$($newLines.Count) lines)"
    } else {
        Write-Host "PATCH 9: Already patched, skipping."
    }
} else {
    Write-Host "PATCH 9: Could not find target line!"
}

Write-Host "Lines after patch 9: $($lines.Count)"

# Write the patched file back
[System.IO.File]::WriteAllLines($filePath, $lines, [System.Text.Encoding]::UTF8)
Write-Host "SUCCESS: Patched file written to $filePath"
