import { Router } from "express";
import { AdminDashboardController } from "./controller";
import { requireAuth, requireRole } from "../../../core/middleware/auth.middleware";

const router = Router();

/**
 * ==========================================
 * ADMIN DASHBOARD ROUTES
 * Base Route: /api/dashboard/admin
 * SECURITY: Auth + admin/staff role required.
 * ==========================================
 */

router.use(requireAuth);
router.use(requireRole(['super_admin', 'admin', 'staff', 'coordinator']));

router.get("/overview", AdminDashboardController.getOverview);
router.get("/quick-stats", AdminDashboardController.getQuickStats);

export default router;
