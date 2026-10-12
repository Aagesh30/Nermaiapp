/**
 * Student LMS Discovery Service
 *
 * Provides batch-filtered LMS content discovery for offline/online/recorded students.
 * Implements the THREE-LAYER separation required by the LMS Permission spec:
 *
 *   Layer 1 — Batch targeting:  targetBatchIds (who the content is for)
 *   Layer 2 — Student type:     offline/online/recorded (how visibility is determined)
 *   Layer 3 — Access control:   SACS / AccessEngine (whether they can consume it)
 *
 * Visibility table:
 *   offline   → can DISCOVER all recorded classes in their batch; must request access
 *   online    → visibility gated by batch + accessLevel; SACS decides access
 *   recorded  → same as online
 *   unassigned → nothing visible
 *
 * NOTE: Live sessions are intentionally EXCLUDED from this service.
 * GET /live-sessions already branches on role === 'student' and calls
 * LiveSessionService.getStudentLiveSessions() which already performs full
 * batch filtering. No duplication needed.
 */

import { db } from '../../infrastructure/firebase';
import { STUDENT_COLLECTIONS } from './constants';
import { IStudentProfile } from './types';
import { AccessRulesService } from '../access-rules/service';

const sacsService = new AccessRulesService();

// ─── Student profile resolution ───────────────────────────────────────────────

interface StudentContext {
  role: string;
  batchIds: string[];          // resolved UUID batch IDs
  studentType: string;         // 'offline' | 'online' | 'recorded' | ''
  studentTypes: string[];      // all allowed modes
  batchModes: Record<string, string[]>; // batch name -> modes
  batchNameMap: Record<string, string>; // batch UUID -> batch name
  studentId: string | null;    // doc ID in 'students' collection
}

/**
 * Resolves the student's batch UUIDs and type.
 *
 * Priority:
 *   1. NEW-NERMAI: student_profiles.programMemberships[].{batchId, status}
 *   2. Legacy fallback: users.studentId → students.batch (name) → batches.batchName → doc ID
 *
 * The legacy path is needed because the old system stores batch as a human-readable
 * name ('43') while classes use UUID doc IDs ('2a237617-...') in targetBatchIds.
 */
async function resolveStudentContext(userId: string): Promise<StudentContext> {
  const result: StudentContext = {
    role: '',
    batchIds: [],
    studentType: '',
    studentTypes: [],
    batchModes: {},
    batchNameMap: {},
    studentId: null
  };

  // Resolve legacy users -> students path to get the rich student details
  const userDoc = await db.collection('users').doc(userId).get();
  let studentData: any = null;
  if (userDoc.exists) {
    const userData = userDoc.data();
    result.role = userData?.role || '';
    if (userData?.studentId) {
      result.studentId = userData.studentId;
      const sDoc = await db.collection('students').doc(userData.studentId).get();
      if (sDoc.exists) {
        studentData = sDoc.data();
      }
    }
  }

  // Fallback: If studentData not found via users doc, try direct students collection lookup by userId or doc ID
  if (!studentData) {
    const directSDoc = await db.collection('students').doc(userId).get();
    if (directSDoc.exists) {
      studentData = directSDoc.data();
      result.studentId = directSDoc.id;
      if (!result.role) result.role = 'student';
    } else {
      const byUserIdSnap = await db.collection('students').where('userId', '==', userId).limit(1).get();
      if (!byUserIdSnap.empty) {
        const sDoc = byUserIdSnap.docs[0];
        studentData = sDoc.data();
        result.studentId = sDoc.id;
        if (!result.role) result.role = 'student';
      }
    }
  }

  if (studentData) {
    result.studentType = studentData.type || 'offline';
    result.batchModes = studentData.batchModes || {};
    
    // Resolve multiple batches
    const studentBatches: string[] = studentData.batches || (studentData.batch ? [studentData.batch] : []);
    for (const bName of studentBatches) {
      if (bName) {
        const bStr = String(bName).trim();
        if (!result.batchIds.includes(bStr)) {
          result.batchIds.push(bStr);
        }
        // 1. Try matching by batchName
        let batchSnap = await db.collection('batches')
          .where('batchName', '==', bStr)
          .where('isDeleted', '==', false)
          .limit(1)
          .get();

        if (batchSnap.empty) {
          batchSnap = await db.collection('batches')
            .where('name', '==', bStr)
            .where('isDeleted', '==', false)
            .limit(1)
            .get();
        }

        if (!batchSnap.empty) {
          const bDoc = batchSnap.docs[0];
          const bId = bDoc.id;
          const resolvedName = bDoc.data()?.batchName || bDoc.data()?.name || bStr;
          if (!result.batchIds.includes(bId)) {
            result.batchIds.push(bId);
          }
          if (!result.batchIds.includes(resolvedName)) {
            result.batchIds.push(resolvedName);
          }
          result.batchNameMap[bId] = resolvedName;
        } else {
          // 2. Try fetching by doc ID directly
          try {
            const bDoc = await db.collection('batches').doc(bStr).get();
            if (bDoc.exists && !bDoc.data()?.isDeleted) {
              const resolvedName = bDoc.data()?.batchName || bDoc.data()?.name;
              if (resolvedName && !result.batchIds.includes(resolvedName)) {
                result.batchIds.push(resolvedName);
              }
              result.batchNameMap[bDoc.id] = resolvedName || bStr;
            }
          } catch (_) { }
        }
      }
    }

    // Resolve all modes/types
    let allTypes: string[] = [];
    Object.values(result.batchModes).forEach((modes: any) => {
      if (Array.isArray(modes)) {
        allTypes.push(...modes);
      }
    });
    if (studentData.type) allTypes.push(studentData.type);
    result.studentTypes = Array.from(new Set(allTypes)).filter(Boolean);
  }

  // Fallback to profile path if no batches resolved
  if (result.batchIds.length === 0) {
    const profileDoc = await db.collection(STUDENT_COLLECTIONS.PROFILES).doc(userId).get();
    if (profileDoc.exists) {
      const profile = profileDoc.data() as IStudentProfile;
      (profile.programMemberships || []).forEach((m) => {
        if (m.status === 'active' && m.batchId) {
          result.batchIds.push(m.batchId);
          result.batchNameMap[m.batchId] = m.batchId; // fallback to ID as name
        }
      });
      result.studentType = profile.status === 'active' ? 'online' : 'offline';
      result.studentTypes = [result.studentType];
    }
  }

  return result;
}

// ─── Visibility logic ─────────────────────────────────────────────────────────

/**
 * Determines if a class/resource is VISIBLE to a student (Layer 1 + Layer 2).
 * Visibility ≠ access permission — SACS (Layer 3) handles that separately.
 *
 * Offline students:
 *   Visible ONLY if they are in one of the target batches (or content has no batch restriction).
 *   They must request access through SACS to consume the content.
 *
 * Online/Recorded students:
 *   Visibility is additionally gated by accessLevel sentinels.
 */
function isVisibleToStudent(
  rawTargetBatchIds: string[],
  accessLevel: string,
  rawStudentBatchIds: string[],
  studentType: string,
  userRole?: string
): boolean {
  const normAccess = String(accessLevel || '').trim().toLowerCase();
  const cleanTargets = (rawTargetBatchIds || []).map(id => String(id).trim().toLowerCase()).filter(Boolean);
  const cleanStudentBatches = (rawStudentBatchIds || []).map(id => String(id).trim().toLowerCase()).filter(Boolean);
  const isEnrolled = cleanStudentBatches.length > 0;
  const isGuestUser = userRole === 'guest' || (!isEnrolled && userRole !== 'student');

  // Guest Only: Only visible if user is a guest user (unenrolled guest)
  if (normAccess === 'guest') {
    return isGuestUser;
  }

  // Unenrolled guest cannot see protected content unless public/free
  const isPublicOrFree = normAccess === 'public' || normAccess === 'free' || normAccess === 'all' || cleanTargets.includes('all') || cleanTargets.includes('all_free');
  if (isGuestUser && !isPublicOrFree) {
    return false;
  }

  // Enrolled student should not see guest-only teaser content
  if (isEnrolled && normAccess === 'guest') {
    return false;
  }

  // Specific batch targeting check:
  // If accessLevel is 'batch' OR there are specific target batches defined (excluding universal sentinels)
  const actualSpecificBatches = cleanTargets.filter(t => t !== 'all' && t !== 'all_paid' && t !== 'all_free');
  const hasSpecificBatchRestrictions = actualSpecificBatches.length > 0;

  if (normAccess === 'batch' || hasSpecificBatchRestrictions) {
    if (!isEnrolled) return false;
    if (actualSpecificBatches.length === 0) return false;

    // Student MUST belong to one of the targeted batches
    const matchesBatch = cleanStudentBatches.some((bId) => actualSpecificBatches.includes(bId));
    if (!matchesBatch) return false;
    return true;
  }

  // Enroll Only (premium / paid): Visible to any enrolled student
  if (normAccess === 'premium' || normAccess === 'paid') {
    return isEnrolled;
  }

  // Public / Free / All: Visible to all users
  if (isPublicOrFree) {
    return true;
  }

  if (cleanTargets.includes('all_paid')) {
    return isEnrolled;
  }

  // Default: Visible if enrolled
  return isEnrolled;
}

// ─── Public API ───────────────────────────────────────────────────────────────

/**
 * Returns batch-filtered recorded classes with SACS access decisions.
 *
 * For offline students, ALL recorded classes from their batch are returned
 * (visibility = true), but access.allowed may be false → UI shows "Request Access".
 * For online/recorded students, normal batch + accessLevel gating applies.
 */
export async function getMyLmsClasses(userId: string, rawTenantId: string): Promise<any[]> {
  const tenantId = !rawTenantId || rawTenantId === 'nermaiiasacademy-519c8' || rawTenantId === 'default' ? 'default_tenant' : rawTenantId;
  const ctx = await resolveStudentContext(userId);

  // ── Pre-fetch courses for cross-course enrollment gate ───────────────────────
  // Prevents UDC students from seeing LDC content (and vice versa) when class-level
  // targetBatchIds are absent or too broad (e.g. empty = "all").
  const coursesSnap = await db.collection('courses').get();
  const courseTargetBatches = new Map<string, string[]>();
  for (const cdoc of coursesSnap.docs) {
    const cdata = cdoc.data() as any;
    courseTargetBatches.set(cdoc.id, cdata.targetBatchIds || []);
  }

  // Query only recorded classes from Firestore
  const classesSnap = await db.collection('classes')
    .where('classType', 'in', ['recorded', 'youtube_recorded'])
    .where('isDeleted', '==', false)
    .get();

  const visible: any[] = [];
  for (const doc of classesSnap.docs) {
    const cls = { id: doc.id, ...doc.data() } as any;

    // Skip classes belonging to a different tenant
    if (cls.tenantId && cls.tenantId !== tenantId) continue;

    // ── Course-level enrollment gate (Bug fix: cross-course contamination) ──────
    // A student must belong to a batch that is targeted by the CLASS'S COURSE.
    // This stops UDC students from seeing LDC recorded classes and vice versa,
    // even when individual class targetBatchIds are missing or set to "all".
    if (cls.courseId) {
      const courseBatches = courseTargetBatches.get(cls.courseId) || [];
      if (
        courseBatches.length > 0 &&
        !courseBatches.includes('all') &&
        !ctx.batchIds.some(bId => courseBatches.includes(bId))
      ) {
        continue; // Student's batch is not enrolled in this course
      }
    }

    const targetBatchIds: string[] = cls.targetBatchIds || [];
    const accessLevel: string = cls.accessLevel || '';

    // Layer 1 + 2: Visibility check
    if (!isVisibleToStudent(targetBatchIds, accessLevel, ctx.batchIds, ctx.studentType, ctx.role)) continue;

    // Layer 3: SACS access decision (additive — does NOT affect visibility)
    let access = { allowed: false, pendingRequest: false };
    try {
      const lockStatus = await sacsService.getLockStatus(userId, cls.id, 'class', tenantId);

      // ── Recorded-content mode gate ────────────────────────────────────────────
      // This is the PRIMARY access gate for recorded content. SACS (Layer 3) is
      // used for hard administrative controls (hidden, scheduled unlock) and
      // temporary grants, but the student-type check here is authoritative.
      //
      // FIX (Bug 2): The old code only ever set isAllowed=false (deny path).
      // Recorded students were never explicitly granted, so they depended on SACS
      // returning true — which it couldn't due to the batch capability bug (Bug 1).
      // Now we explicitly branch:
      //   - hasRecordedStudentType=true  → allow, UNLESS a hard SACS block applies
      //   - hasRecordedStudentType=false → deny, UNLESS a temporary grant exists
      const hasRecordedStudentType = ctx.studentTypes.includes('recorded');
      let isAllowed: boolean;

      if (hasRecordedStudentType) {
        // Recorded students are auto-granted playback.
        // Only hard SACS locks (hidden by admin / scheduled unlock) can override this.
        const isHardBlocked =
          lockStatus.decision.lockReason === 'hidden_by_admin' ||
          lockStatus.decision.lockReason === 'scheduled_unlock';
        isAllowed = !isHardBlocked;
      } else {
        // Non-recorded students (offline / online / combinations without 'recorded'):
        // deny by default. A temporary admin grant is the ONLY exception.
        isAllowed = !!lockStatus.decision.hasTemporaryGrant;
      }

      access = {
        allowed: isAllowed,
        pendingRequest: !!lockStatus.pendingRequest,
      };
    } catch (e) {
      // SACS failure: treat as denied so UI shows "Request Access" rather than crashing
      access = { allowed: false, pendingRequest: false };
    }

    // Emit class + additive access object
    // encryptedVideoId is intentionally kept encrypted; raw URLs are never sent to client
    visible.push({ ...cls, access, studentType: ctx.studentType });
  }

  return visible;
}

/**
 * Returns batch-filtered resources with SACS access decisions.
 * Uses `targetBatchIds` and `isGeneral` from the IResource schema.
 */
export async function getMyLmsResources(userId: string, tenantId: string): Promise<any[]> {
  const ctx = await resolveStudentContext(userId);

  // Query only published resources for this tenant
  const resourcesSnap = await db.collection('resources')
    .where('tenantId', '==', tenantId)
    .where('isDeleted', '==', false)
    .where('status', '==', 'published')
    .get();

  const visible: any[] = [];
  for (const doc of resourcesSnap.docs) {
    const res = { id: doc.id, ...doc.data() } as any;

    const targetBatchIds: string[] = res.targetBatchIds || [];
    const accessLevel: string = res.visibility || '';

    // Check visibility against targetBatchIds & accessLevel
    if (!isVisibleToStudent(targetBatchIds, accessLevel, ctx.batchIds, ctx.studentType, ctx.role)) continue;
    if (res.isGeneral && ctx.batchIds.length === 0 && accessLevel !== 'public' && accessLevel !== 'guest' && accessLevel !== 'free') continue;

    // Layer 3: SACS access decision
    let access = { allowed: false, pendingRequest: false };
    if (accessLevel === 'public' || accessLevel === 'guest' || accessLevel === 'free' || targetBatchIds.includes('all_free')) {
      access = { allowed: true, pendingRequest: false };
    } else {
      try {
        const lockStatus = await sacsService.getLockStatus(userId, res.id, 'resource', tenantId);
        access = {
          allowed: lockStatus.decision.allowed,
          pendingRequest: !!lockStatus.pendingRequest,
        };
      } catch (e) {
        access = { allowed: false, pendingRequest: false };
      }
    }

    // storagePath is encrypted - do not expose it; access goes through /resources/:id/access
    const { storagePath, ...safeRes } = res;
    visible.push({ ...safeRes, access });
  }

  return visible;
}
