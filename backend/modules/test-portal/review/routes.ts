import { Router, Request, Response, NextFunction } from "express";
import { ReviewController } from "./controller";
import { requireAuth, requireRole } from "../../../core/middleware/auth.middleware";

const router = Router();

/**
 * Ownership guard — students can only access their own history and analytics.
 * Admins (super_admin, admin, staff) bypass this and can view any student.
 */
const requireOwnerOrAdmin = (req: Request, res: Response, next: NextFunction) => {
  const { studentId } = req.params;
  const user = req.user!;
  const adminRoles = ['super_admin', 'admin', 'staff'];
  if (adminRoles.includes(user.role)) return next();
  // Match against both the internal studentId and the userId (Firebase UID or custom ID)
  if (user.studentId === studentId || user.userId === studentId) return next();
  return res.status(403).json({
    success: false,
    message: 'Access denied: you can only view your own records.'
  });
};

/**
 * ==========================================
 * REVIEW ROUTES
 * Base Route:
 * /api/test-portal/review
 * SECURITY: All routes require authentication.
 *           Admin-only management routes are further restricted by role.
 * ==========================================
 */

// All review routes require an authenticated user
router.use(requireAuth);

const adminRoles = ['super_admin', 'admin', 'staff'];

/**
 * Review complete attempt
 */
router.get(
    "/attempt/:attemptId",
    ReviewController.getAttemptReview
);

/**
 * Review a single question
 */
router.get(
    "/attempt/:attemptId/question/:questionId",
    ReviewController.getQuestionReview
);

/**
 * Get correct answers — controller already gates on attempt being evaluated (in results collection).
 * Auth layer ensures only signed-in users can even try.
 */
router.get(
    "/answers/:attemptId",
    ReviewController.getCorrectAnswers
);

/**
 * Get explanations
 */
router.get(
    "/explanations/:attemptId",
    ReviewController.getExplanations
);

/**
 * Topic Analysis
 */
router.get(
    "/analysis/topic/:attemptId",
    ReviewController.getTopicAnalysis
);

/**
 * Difficulty Analysis
 */
router.get(
    "/analysis/difficulty/:attemptId",
    ReviewController.getDifficultyAnalysis
);

/**
 * Student Attempt History — students see only their own history
 */
router.get(
    "/history/:studentId",
    requireOwnerOrAdmin,
    ReviewController.getAttemptHistory
);

/**
 * Leaderboard
 */
router.get(
    "/leaderboard/:testId",
    ReviewController.getLeaderboard
);

/**
 * Top Rankers
 */
router.get(
    "/top-rankers/:testId",
    ReviewController.getTopRankers
);

/**
 * Student Analytics — students see only their own analytics
 */
router.get(
    "/analytics/:studentId",
    requireOwnerOrAdmin,
    ReviewController.getStudentAnalytics
);

/**
 * Admin Results Log — all tests with per-student leaderboard
 * Supports ?keyword=&date= query params
 */
router.get(
    "/results/all-tests",
    requireRole(adminRoles),
    ReviewController.getAllTestResults
);

/**
 * Subject Section Analytics & 30% Question Diagnostics
 */
router.get(
    "/diagnostics/:testId",
    requireRole(adminRoles),
    ReviewController.getTestSubjectDiagnostics
);

/**
 * Batch Academic Analytics (Health overview, Top improvers, At-risk list, Quality checks)
 */
router.get(
    "/batch-analytics",
    requireRole(adminRoles),
    ReviewController.getBatchAcademicAnalytics
);

export default router;