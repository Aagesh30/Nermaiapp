import { Router } from "express";
import { NotificationController } from "./controller";
import { requireAuth, requireRole } from "../../core/middleware/auth.middleware";

const router = Router();

const adminRoles = ['super_admin', 'admin', 'staff', 'coordinator'];

// Admin/Staff only: Send bulk notifications
router.post("/bulk", requireAuth, requireRole(adminRoles), NotificationController.createBulk);

// Admin/Staff only: Send a single notification
router.post("/", requireAuth, requireRole(adminRoles), NotificationController.create);

// Authenticated users: View their own notifications
router.get("/", requireAuth, NotificationController.getNotifications);

// Admin/Staff only: Delete a notification
router.delete("/:id", requireAuth, requireRole(adminRoles), NotificationController.delete);

// Register device push token (for APK & Web: guest, student, super_admin, etc.)
router.post("/register-token", NotificationController.registerToken);

// Authenticated: Unregister own device token on logout
router.post("/unregister-token", requireAuth, NotificationController.unregisterToken);

export default router;
