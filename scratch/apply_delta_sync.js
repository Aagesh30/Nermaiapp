const fs = require('fs');
const path = require('path');

const filePath = path.resolve('d:/unistrix/NERMAI_IAS_ACADEMY/web_portal/App.tsx');
let content = fs.readFileSync(filePath, 'utf8');

const isCrlf = content.includes('\r\n');
const le = isCrlf ? '\r\n' : '\n';

const startMarker = '  const loadStudents = async (force: boolean = false) => {';
const endMarker = '  const loadBatches = async () => {';

const sIdx = content.indexOf(startMarker);
const eIdx = content.indexOf(endMarker, sIdx);

if (sIdx === -1 || eIdx === -1) {
  console.error('Markers not found! sIdx:', sIdx, 'eIdx:', eIdx);
  process.exit(1);
}

const newBlockLines = [
  '  const loadStudents = async (force: boolean = false, forceFullReload: boolean = false) => {',
  '    // Guests are not ERP students — the admin-only endpoint returns 403 for guests and crashes the UI',
  '    if (user?.role === "guest") return;',
  '    if (force) {',
  '      loadedCollectionsRef.current.delete("students");',
  '    } else if (loadedCollectionsRef.current.has("students")) {',
  '      return;',
  '    }',
  '    try {',
  '      if (user?.role === "student") {',
  '        const endpoint = "/erp/student/profile/me";',
  '        const res = await api.get(endpoint);',
  '        const rawData = res?.data !== undefined ? res.data : res;',
  '        let list = Array.isArray(rawData)',
  '          ? rawData',
  '          : Array.isArray(rawData?.students)',
  '            ? rawData.students',
  '            : Array.isArray(rawData?.data)',
  '              ? rawData.data',
  '              : (rawData && typeof rawData === "object" && rawData.id ? [rawData] : []);',
  '        setStudents(list);',
  '        localDataCache.save("erp_students", list);',
  '        loadedCollectionsRef.current.add("students");',
  '        return;',
  '      }',
  '',
  '      // ─── ADMIN / STAFF INCREMENTAL DELTA SYNC ──────────────────────────────',
  '      // 1. Immediately render cached students if state is currently empty (instant cold start)',
  '      let cached = await localDataCache.get("erp_students");',
  '      if ((!students || students.length === 0) && Array.isArray(cached) && cached.length > 0) {',
  '        setStudents(cached);',
  '      }',
  '',
  '      if (forceFullReload) {',
  '        await localDataCache.remove("erp_students_last_sync");',
  '      }',
  '',
  '      const lastSync = forceFullReload ? null : await localDataCache.get("erp_students_last_sync");',
  '      const canDeltaSync = Array.isArray(cached) && cached.length > 0 && typeof lastSync === "number" && lastSync > 0;',
  '',
  '      const endpoint = canDeltaSync',
  '        ? `/erp/student?since=${lastSync}&limit=5000`',
  '        : "/erp/student?limit=5000";',
  '',
  '      const res = await api.get(endpoint);',
  '      const rawData = res?.data !== undefined ? res.data : res;',
  '',
  '      if (rawData?.isDelta === true && canDeltaSync) {',
  '        // Delta mode: merge modified/created students and remove deleted ones',
  '        const modifiedList: any[] = Array.isArray(rawData?.students) ? rawData.students : [];',
  '        const deletedIdsList: string[] = Array.isArray(rawData?.deletedIds) ? rawData.deletedIds : [];',
  '',
  '        if (modifiedList.length > 0 || deletedIdsList.length > 0) {',
  '          const map = new Map<string, any>();',
  '          (cached || []).forEach((item: any) => {',
  '            const key = item?.id || item?._id || item?.studentId;',
  '            if (key) map.set(String(key), item);',
  '          });',
  '          deletedIdsList.forEach((delId: string) => {',
  '            if (delId) map.delete(String(delId));',
  '          });',
  '          modifiedList.forEach((item: any) => {',
  '            const key = item?.id || item?._id || item?.studentId;',
  '            if (key) map.set(String(key), item);',
  '          });',
  '          const merged = Array.from(map.values());',
  '          setStudents(merged);',
  '          await localDataCache.save("erp_students", merged);',
  '        } else {',
  '          // Zero changes in Firestore! Keep the current cached data',
  '          if (!students || students.length === 0) {',
  '            setStudents(cached);',
  '          }',
  '        }',
  '',
  '        if (rawData.serverTime) {',
  '          await localDataCache.save("erp_students_last_sync", rawData.serverTime);',
  '        }',
  '      } else {',
  '        // Full load mode: initialize or overwrite cache',
  '        let list = Array.isArray(rawData)',
  '          ? rawData',
  '          : Array.isArray(rawData?.students)',
  '            ? rawData.students',
  '            : Array.isArray(rawData?.data)',
  '              ? rawData.data',
  '              : (rawData && typeof rawData === "object" && rawData.id ? [rawData] : []);',
  '        setStudents(list);',
  '        await localDataCache.save("erp_students", list);',
  '        await localDataCache.save("erp_students_last_sync", rawData?.serverTime || Date.now());',
  '      }',
  '      loadedCollectionsRef.current.add("students");',
  '    } catch (e) {',
  '      console.log("Failed loading students:", e);',
  '      localDataCache.get("erp_students").then(c => { if (Array.isArray(c) && c.length > 0) setStudents(c); });',
  '    }',
  '  };',
  '',
  ''
];

const newBlock = newBlockLines.join(le);
content = content.substring(0, sIdx) + newBlock + content.substring(eIdx);

fs.writeFileSync(filePath, content, 'utf8');
console.log('Successfully updated App.tsx with delta sync!');
