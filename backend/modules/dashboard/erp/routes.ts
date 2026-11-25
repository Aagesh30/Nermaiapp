import { Router } from "express";
import { ERPDashboardController } from "./controller";
import { requireAuth, requireRole } from "../../../core/middleware/auth.middleware";

const router = Router();

/**
 * ==========================================
 * ERP DASHBOARD ROUTES
 * Base Route: /api/dashboard/erp
 * SECURITY: Auth + admin/staff role required.
 * ==========================================
 */

router.use(requireAuth);
router.use(requireRole(['super_admin', 'admin', 'staff', 'coordinator']));

router.get("/overview", ERPDashboardController.getOverview);
router.get("/student-stats", ERPDashboardController.getStudentStats);

export default router;
