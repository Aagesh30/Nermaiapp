import { Router } from "express";
import { StudentController } from "./controller";
import { requireAuth, requireRole, requirePermission } from "../../../core/middleware/auth.middleware";

const router = Router();

/**
 * ==========================================
 * STUDENT ROUTES
 * Base Route: /api/erp/student
 * SECURITY: All routes require auth + admin/staff role.
 * ==========================================
 */
const adminRoles = ['super_admin', 'admin', 'staff', 'editor', 'contributor', 'teacher', 'developer'];

router.use(requireAuth);

// Self-service routes: any authenticated student can access their own profile
router.get("/profile/me", StudentController.getMe);
router.put("/profile/me", StudentController.updateMe);

// All other endpoints require full admin/staff roles
router.use(requireRole(adminRoles));

// Get all students (with search, filter, pagination, sorting)
router.get("/", requirePermission("student_management", "R"), StudentController.getAll);

// Get single student
router.get("/:id", requirePermission("student_management", "R"), StudentController.getOne);

// Create student
router.post("/", requirePermission("student_management", "C"), StudentController.create);

// Bulk Create students from Excel upload
router.post("/bulk", requirePermission("student_management", "C"), StudentController.bulkCreate);

// Update student
router.put("/:id", (req, res, next) => {
  let featureKey = "student_management";
  const bodyKeys = Object.keys(req.body || {});
  
  const idCardKeys = ["idCardGenerated", "idCardTheme", "idCardRole", "idCardExpiry"];
  const hallTicketKeys = ["hallTicketGenerated", "hallTicketExamName", "hallTicketExamDate", "hallTicketVenue", "hallTicketTime", "hallTicketInstructions"];
  const feesKeys = ["feesPaid", "totalFees", "modeOfPayment", "transactionId", "feeBlocked", "feeBlockedReason", "feeAlertActive", "feeAlertDueDate", "feeAlertSentAt", "feeAlertNote"];
  const attendanceKeys = ["attendedDays", "totalDays", "lastAttendanceDate", "lastAttendanceStatus", "attendanceLog"];
  
  const hasIdCardKeys = bodyKeys.some(k => idCardKeys.includes(k));
  const hasHallTicketKeys = bodyKeys.some(k => hallTicketKeys.includes(k));
  const hasFeesKeys = bodyKeys.some(k => feesKeys.includes(k));
  const hasAttendanceKeys = bodyKeys.some(k => attendanceKeys.includes(k));
  const hasOtherKeys = bodyKeys.some(k => !idCardKeys.includes(k) && !hallTicketKeys.includes(k) && !feesKeys.includes(k) && !attendanceKeys.includes(k) && k !== "updatedBy");

  if (!hasOtherKeys) {
    if (hasIdCardKeys && !hasHallTicketKeys && !hasFeesKeys && !hasAttendanceKeys) {
      featureKey = "id_card";
    } else if (hasHallTicketKeys && !hasIdCardKeys && !hasFeesKeys && !hasAttendanceKeys) {
      featureKey = "hall_ticket";
    } else if (hasFeesKeys && !hasIdCardKeys && !hasHallTicketKeys && !hasAttendanceKeys) {
      featureKey = "fees_management";
    } else if (hasAttendanceKeys && !hasIdCardKeys && !hasHallTicketKeys && !hasFeesKeys) {
      featureKey = "offline_attendance";
    }
  }
  
  return requirePermission(featureKey, "U")(req, res, next);
}, StudentController.update);

// Bulk update credentials for batch (super_admin only — highly privileged)
router.post("/bulk/credentials", requireRole(['super_admin']), StudentController.bulkUpdateCredentials);

// Mock Roll Number configuration & continuous generation
router.get("/mock-roll/config", requireRole(['super_admin', 'admin']), StudentController.getMockRollConfig);
router.post("/mock-roll/generate", requireRole(['super_admin', 'admin']), StudentController.generateMockRollNumbers);
router.post("/mock-roll/sync-unassigned", requireRole(['super_admin', 'admin']), StudentController.syncUnassignedMockRolls);
router.post("/mock-roll/unlock", requireRole(['super_admin', 'admin']), StudentController.unlockMockRollConfig);

// Soft delete student
router.delete("/:id", requirePermission("student_management", "D"), StudentController.delete);

export default router;
