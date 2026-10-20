import { Request, Response, NextFunction } from 'express';
import { CourseService } from './service';
import * as Validators from './validator';
import { AppError } from '../../core/errors/AppError';

const courseService = new CourseService();

export const createCourse = async (req: Request, res: Response, next: NextFunction) => {
  try {
    const parsedData = Validators.createCourseSchema.parse(req.body);
    const { userId, tenantId } = req.user!;
    const course = await courseService.createCourse(parsedData, userId, tenantId);
    res.status(201).json({ status: 'success', data: course });
    // Notify admins about the new course (fire-and-forget)
    try {
      const { sendPushNotification } = await import('../../services/pushService');
      sendPushNotification({
        title: '📚 New Course Created',
        body: `Course "${course?.name || parsedData?.name || 'New Course'}" has been created.`,
        targetRole: 'admin',
        excludeUserId: userId,
        data: {
          targetTab: 'lms', targetSub: 'courses', screen: 'lms', subTab: 'courses',
          courseId: course?.id || '',
          dedupeId: `course_created_${course?.id || Date.now()}`
        }
      }).catch(() => {});
    } catch (_) {}
  } catch (error) { next(error); }
};

export const updateCourse = async (req: Request, res: Response, next: NextFunction) => {
  try {
    const id = req.params.id as string;
    const parsedData = Validators.updateCourseSchema.parse(req.body);
    const { userId, tenantId } = req.user!;
    const updated = await courseService.updateCourse(id, parsedData, userId, tenantId);
    res.status(200).json({ status: 'success', data: updated });
  } catch (error) { next(error); }
};

export const getCourse = async (req: Request, res: Response, next: NextFunction) => {
  try {
    const id = req.params.id as string;
    const { tenantId } = req.user!;
    const course = await courseService.getCourse(id, tenantId);
    res.status(200).json({ status: 'success', data: course });
  } catch (error) { next(error); }
};

export const listCourses = async (req: Request, res: Response, next: NextFunction) => {
  try {
    const { tenantId } = req.user!;
    const courses = await courseService.listCourses(tenantId);
    res.status(200).json({ status: 'success', data: courses });
  } catch (error) { next(error); }
};

export const deleteCourse = async (req: Request, res: Response, next: NextFunction) => {
  try {
    const id = req.params.id as string;
    const { userId, tenantId } = req.user!;
    await courseService.deleteCourse(id, userId, tenantId);
    res.status(200).json({ status: 'success', message: 'Course deleted successfully' });
  } catch (error) { next(error); }
};

export const assignStaff = async (req: Request, res: Response, next: NextFunction) => {
  try {
    const id = req.params.id as string;
    const staffData = req.body;
    const { userId, tenantId } = req.user!;
    const course = await courseService.assignStaff(id, staffData, userId, tenantId);
    res.status(200).json({ status: 'success', data: course });
  } catch (error) { next(error); }
};

export const unassignStaff = async (req: Request, res: Response, next: NextFunction) => {
  try {
    const id = req.params.id as string;
    const staffId = req.params.staffId as string;
    const { userId, tenantId } = req.user!;
    const course = await courseService.unassignStaff(id, staffId, userId, tenantId);
    res.status(200).json({ status: 'success', data: course });
  } catch (error) { next(error); }
};

export const getAssignedStaff = async (req: Request, res: Response, next: NextFunction) => {
  try {
    const id = req.params.id as string;
    const { tenantId } = req.user!;
    const course = await courseService.getCourse(id, tenantId);
    res.status(200).json({ status: 'success', data: course.assignedStaff || [] });
  } catch (error) { next(error); }
};

export const createSubject = async (req: Request, res: Response, next: NextFunction) => {
  try {
    const parsedData = Validators.createSubjectSchema.parse(req.body);
    const { userId, tenantId } = req.user!;
    const subject = await courseService.createSubject(parsedData, userId, tenantId);
    res.status(201).json({ status: 'success', data: subject });
    // Notify admins about the new subject (fire-and-forget)
    try {
      const { sendPushNotification } = await import('../../services/pushService');
      sendPushNotification({
        title: '📖 New Subject Added',
        body: `Subject "${subject?.name || parsedData?.name || 'New Subject'}" has been added.`,
        targetRole: 'admin',
        excludeUserId: userId,
        data: {
          targetTab: 'lms', targetSub: 'courses', screen: 'lms', subTab: 'courses',
          subjectId: subject?.id || '',
          dedupeId: `subject_created_${subject?.id || Date.now()}`
        }
      }).catch(() => {});
    } catch (_) {}
  } catch (error) { next(error); }
};

export const listSubjectsByCourse = async (req: Request, res: Response, next: NextFunction) => {
  try {
    const courseId = req.params.courseId as string;
    const { tenantId } = req.user!;
    const subjects = await courseService.listSubjectsByCourse(courseId, tenantId);
    res.status(200).json({ status: 'success', data: subjects });
  } catch (error) { next(error); }
};

export const listAllSubjects = async (req: Request, res: Response, next: NextFunction) => {
  try {
    const { tenantId } = req.user!;
    const subjects = await courseService.listAllSubjects(tenantId);
    res.status(200).json({ status: 'success', data: subjects });
  } catch (error) { next(error); }
};

export const updateSubject = async (req: Request, res: Response, next: NextFunction) => {
  try {
    const id = req.params.id as string;
    const parsedData = Validators.updateSubjectSchema.parse(req.body);
    const { userId, tenantId } = req.user!;
    const updated = await courseService.updateSubject(id, parsedData, userId, tenantId);
    res.status(200).json({ status: 'success', data: updated });
  } catch (error) { next(error); }
};

export const deleteSubject = async (req: Request, res: Response, next: NextFunction) => {
  try {
    const id = req.params.id as string;
    const { userId, tenantId } = req.user!;
    await courseService.deleteSubject(id, userId, tenantId);
    res.status(200).json({ status: 'success', message: 'Subject deleted successfully' });
  } catch (error) { next(error); }
};

export const createTopic = async (req: Request, res: Response, next: NextFunction) => {
  try {
    const parsedData = Validators.createTopicSchema.parse(req.body);
    const { userId, tenantId } = req.user!;
    const topic = await courseService.createTopic(parsedData, userId, tenantId);
    res.status(201).json({ status: 'success', data: topic });
    // Notify admins about the new topic (fire-and-forget)
    try {
      const { sendPushNotification } = await import('../../services/pushService');
      sendPushNotification({
        title: '🗂️ New Topic Added',
        body: `Topic "${topic?.name || parsedData?.name || 'New Topic'}" has been added.`,
        targetRole: 'admin',
        excludeUserId: userId,
        data: {
          targetTab: 'lms', targetSub: 'courses', screen: 'lms', subTab: 'courses',
          topicId: topic?.id || '',
          dedupeId: `topic_created_${topic?.id || Date.now()}`
        }
      }).catch(() => {});
    } catch (_) {}
  } catch (error) { next(error); }
};

export const listTopicsBySubject = async (req: Request, res: Response, next: NextFunction) => {
  try {
    const subjectId = req.params.subjectId as string;
    const { tenantId } = req.user!;
    const topics = await courseService.listTopicsBySubject(subjectId, tenantId);
    res.status(200).json({ status: 'success', data: topics });
  } catch (error) { next(error); }
};

export const listAllTopics = async (req: Request, res: Response, next: NextFunction) => {
  try {
    const { tenantId } = req.user!;
    const topics = await courseService.listAllTopics(tenantId);
    res.status(200).json({ status: 'success', data: topics });
  } catch (error) { next(error); }
};

export const updateTopic = async (req: Request, res: Response, next: NextFunction) => {
  try {
    const id = req.params.id as string;
    const parsedData = Validators.updateTopicSchema.parse(req.body);
    const { userId, tenantId } = req.user!;
    const updated = await courseService.updateTopic(id, parsedData, userId, tenantId);
    res.status(200).json({ status: 'success', data: updated });
  } catch (error) { next(error); }
};

export const deleteTopic = async (req: Request, res: Response, next: NextFunction) => {
  try {
    const id = req.params.id as string;
    const { userId, tenantId } = req.user!;
    await courseService.deleteTopic(id, userId, tenantId);
    res.status(200).json({ status: 'success', message: 'Topic deleted successfully' });
  } catch (error) { next(error); }
};

export const createClass = async (req: Request, res: Response, next: NextFunction) => {
  try {
    const parsedData = Validators.createClassSchema.parse(req.body);
    const { userId, tenantId } = req.user!;
    const newClass = await courseService.createClass(parsedData, userId, tenantId);
    res.status(201).json({ status: 'success', data: newClass });
  } catch (error) { next(error); }
};

export const listClassesByTopic = async (req: Request, res: Response, next: NextFunction) => {
  try {
    const topicId = req.params.topicId as string;
    const { tenantId } = req.user!;
    const classes = await courseService.listClassesByTopic(topicId, tenantId);
    res.status(200).json({ status: 'success', data: classes });
  } catch (error) { next(error); }
};

export const listAllClasses = async (req: Request, res: Response, next: NextFunction) => {
  try {
    const { tenantId, role, userId } = req.user!;
    const classes = await courseService.listAllClasses(tenantId, role, userId);
    res.status(200).json({ status: 'success', data: classes });
  } catch (error) { next(error); }
};

export const updateClass = async (req: Request, res: Response, next: NextFunction) => {
  try {
    const id = req.params.id as string;
    const parsedData = Validators.updateClassSchema.parse(req.body);
    const { userId, tenantId } = req.user!;
    const updated = await courseService.updateClass(id, parsedData, userId, tenantId);
    res.status(200).json({ status: 'success', data: updated });
  } catch (error) { next(error); }
};

export const uploadClassRecording = async (req: Request, res: Response, next: NextFunction) => {
  try {
    const id = req.params.id as string;
    const { youtubeUrl } = req.body;
    if (!youtubeUrl) throw new AppError('youtubeUrl is required', 400);
    const { userId, tenantId } = req.user!;
    const updated = await courseService.uploadClassRecording(id, youtubeUrl, userId, tenantId);
    res.status(200).json({ status: 'success', data: updated });
  } catch (error) { next(error); }
};

export const deleteClass = async (req: Request, res: Response, next: NextFunction) => {
  try {
    const id = req.params.id as string;
    const { userId, tenantId } = req.user!;
    await courseService.deleteClass(id, userId, tenantId);
    res.status(200).json({ status: 'success', message: 'Class deleted successfully' });
  } catch (error) { next(error); }
};

export const getClassPlaybackAccess = async (req: Request, res: Response, next: NextFunction) => {
  try {
    console.log("=== CONTROLLER ===");
    console.log("params =", req.params);
    const classId = req.params.id as string;
    const accessData = await courseService.getClassPlaybackAccess(classId, req.user!);
    res.status(200).json({ status: 'success', data: accessData });
  } catch (error) { next(error); }
};

// ----- SUBTOPIC -----
export const createSubtopic = async (req: Request, res: Response, next: NextFunction) => {
  try {
    const parsedData = Validators.createSubtopicSchema.parse(req.body);
    const { userId, tenantId } = req.user!;
    const subtopic = await courseService.createSubtopic(parsedData, userId, tenantId);
    res.status(201).json({ status: 'success', data: subtopic });
    // Notify admins about the new subtopic (fire-and-forget)
    try {
      const { sendPushNotification } = await import('../../services/pushService');
      sendPushNotification({
        title: '📝 New Subtopic Added',
        body: `Subtopic "${subtopic?.name || parsedData?.name || 'New Subtopic'}" has been added.`,
        targetRole: 'admin',
        excludeUserId: userId,
        data: {
          targetTab: 'lms', targetSub: 'courses', screen: 'lms', subTab: 'courses',
          subtopicId: subtopic?.id || '',
          dedupeId: `subtopic_created_${subtopic?.id || Date.now()}`
        }
      }).catch(() => {});
    } catch (_) {}
  } catch (error) { next(error); }
};

export const listSubtopicsByTopic = async (req: Request, res: Response, next: NextFunction) => {
  try {
    const topicId = req.params.topicId as string;
    const { tenantId } = req.user!;
    const subtopics = await courseService.listSubtopicsByTopic(topicId, tenantId);
    res.status(200).json({ status: 'success', data: subtopics });
  } catch (error) { next(error); }
};

export const listAllSubtopics = async (req: Request, res: Response, next: NextFunction) => {
  try {
    const { tenantId } = req.user!;
    const subtopics = await courseService.listAllSubtopics(tenantId);
    res.status(200).json({ status: 'success', data: subtopics });
  } catch (error) { next(error); }
};

export const updateSubtopic = async (req: Request, res: Response, next: NextFunction) => {
  try {
    const id = req.params.id as string;
    const parsedData = Validators.updateSubtopicSchema.parse(req.body);
    const { userId, tenantId } = req.user!;
    const updated = await courseService.updateSubtopic(id, parsedData, userId, tenantId);
    res.status(200).json({ status: 'success', data: updated });
  } catch (error) { next(error); }
};

export const deleteSubtopic = async (req: Request, res: Response, next: NextFunction) => {
  try {
    const id = req.params.id as string;
    const { userId, tenantId } = req.user!;
    await courseService.deleteSubtopic(id, userId, tenantId);
    res.status(200).json({ status: 'success', message: 'Subtopic deleted successfully' });
  } catch (error) { next(error); }
};

export const listClassesBySubtopic = async (req: Request, res: Response, next: NextFunction) => {
  try {
    const subtopicId = req.params.subtopicId as string;
    const { tenantId } = req.user!;
    const classes = await courseService.listClassesBySubtopic(subtopicId, tenantId);
    res.status(200).json({ status: 'success', data: classes });
  } catch (error) { next(error); }
};

export const syncSyllabusFromExcel = async (req: Request, res: Response, next: NextFunction) => {
  try {
    const { courseId, subjects, filePath } = req.body;
    if (!courseId) throw new AppError('courseId is required', 400);
    const { userId, tenantId } = req.user!;

    let result;
    if (Array.isArray(subjects) && subjects.length > 0) {
      result = await courseService.syncStructuredSyllabus(courseId, subjects, userId, tenantId);
    } else {
      const targetFilePath = filePath || 'D:\\unistrix\\NERMAI_IAS_ACADEMY\\Nermai_Faculty_Tracker (2).xlsx';
      result = await courseService.syncSyllabusFromExcel(courseId, targetFilePath, userId, tenantId);
    }

    res.status(200).json(result);
  } catch (error) { next(error); }
};

