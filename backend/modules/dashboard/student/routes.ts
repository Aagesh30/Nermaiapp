import { Router } from "express";
import { StudentDashboardController } from "./controller";
import { requireAuth } from "../../../core/middleware/auth.middleware";

const router = Router();

/**
 * ==========================================
 * STUDENT DASHBOARD ROUTES
 * Base Route: /api/dashboard/student
 * SECURITY: Auth required for all endpoints.
 * Students can only view their own records;
 * staff/admin roles can view any student's records.
 * ==========================================
 */

router.use(requireAuth);

const requireOwnerOrStaff = (req: any, res: any, next: any) => {
  const targetStudentId = req.params.studentId;
  if (!targetStudentId || targetStudentId === 'overview' || targetStudentId === 'marks' || targetStudentId === 'fees') {
    return next();
  }
  const user = req.user;
  if (!user) {
    return res.status(401).json({ success: false, message: 'Unauthorized' });
  }
  const staffRoles = ['admin', 'super_admin', 'superadmin', 'coordinator', 'staff'];
  if (staffRoles.includes(user.role)) {
    return next();
  }
  if (user.studentId === targetStudentId || user.userId === targetStudentId) {
    return next();
  }
  return res.status(403).json({ success: false, message: 'Forbidden: Access to another student\'s records is denied' });
};

router.get("/overview", StudentDashboardController.getOverview);
router.get("/marks", StudentDashboardController.getMarks);
router.get("/fees", StudentDashboardController.getFeeHistory);

router.get("/:studentId/overview", requireOwnerOrStaff, StudentDashboardController.getOverview);
router.get("/:studentId/marks", requireOwnerOrStaff, StudentDashboardController.getMarks);
router.get("/:studentId/fees", requireOwnerOrStaff, StudentDashboardController.getFeeHistory);

export default router;

