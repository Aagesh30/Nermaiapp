import { Router } from "express";
import { AnnouncementController } from "./controller";
import { requireAuth, requireRole } from "../../core/middleware/auth.middleware";

const router = Router();

/**
 * ==========================================
 * ANNOUNCEMENT ROUTES
 * Base Route: /api/announcement
 * ==========================================
 */

const adminRoles = ['super_admin', 'superadmin', 'admin', 'coordinator', 'staff'];

// Public: Students and guests can read announcements without authentication
router.get("/", AnnouncementController.getAll);
router.get("/:id", AnnouncementController.getOne);

// Protected: Only admins/staff can create, edit, or delete announcements
router.post("/", requireAuth, requireRole(adminRoles), AnnouncementController.create);
router.put("/:id", requireAuth, requireRole(adminRoles), AnnouncementController.update);
router.delete("/:id", requireAuth, requireRole(adminRoles), AnnouncementController.delete);

export default router;
