import { Request, Response, NextFunction } from 'express';
import { ResourceService } from './service';
import { sendPushNotification } from '../../services/pushService';

const service = new ResourceService();

export const create = async (req: Request, res: Response, next: NextFunction) => {
  try {
    const tenantId = req.user!.tenantId;
    const userId = req.user!.userId;
    
    // Normalize array fields from multipart/form-data
    const normalizedBody = { ...req.body };
    for (const key of Object.keys(normalizedBody)) {
      if (key.endsWith('[]')) {
        const newKey = key.slice(0, -2);
        normalizedBody[newKey] = Array.isArray(normalizedBody[key]) ? normalizedBody[key] : [normalizedBody[key]];
        delete normalizedBody[key];
      } else if (typeof normalizedBody[key] === 'string' && normalizedBody[key].startsWith('[') && normalizedBody[key].endsWith(']')) {
        try {
          normalizedBody[key] = JSON.parse(normalizedBody[key]);
        } catch (e) {
          // ignore parsing error if it's not actually JSON
        }
      }
    }

    const data = await service.createResource(normalizedBody, req.file, userId, tenantId);

    const targetBatchVal = Array.isArray(normalizedBody.targetBatchIds)
      ? normalizedBody.targetBatchIds[0]
      : (normalizedBody.targetBatchIds || normalizedBody.batchId || null);

    // Dispatch background push notification to target batch or all students
    sendPushNotification({
      title: "📚 New Study Material Added",
      body: `${normalizedBody.title || (data as any)?.title || 'New study resource'} is now available in your LMS library.`,
      targetRole: "student",
      targetBatch: targetBatchVal,
      data: {
        targetTab: "lms",
        targetSub: "resources",
        resourceId: (data as any)?.id || ""
      }
    }).catch(err => console.log("[Push] Resource creation push note:", err?.message));

    res.status(201).json({ success: true, data });
  } catch (error) {
    next(error);
  }
};

export const list = async (req: Request, res: Response, next: NextFunction) => {
  try {
    const filters = {
      courseId: req.query.courseId as string,
      subjectId: req.query.subjectId as string,
      topicId: req.query.topicId as string,
      classId: req.query.classId as string,
      batchId: req.query.batchId as string,
      categoryId: req.query.categoryId as string,
      search: req.query.search as string,
      tenantId: req.user!.tenantId
    };
    const userContext = req.user ? { userId: req.user.userId, role: req.user.role, tenantId: req.user.tenantId } : undefined;
    const data = await service.listResources(filters, userContext);
    res.json({ success: true, data });
  } catch (error) {
    next(error);
  }
};

export const getById = async (req: Request, res: Response, next: NextFunction) => {
  try {
    const data = await service.getResource(req.params.id as string);
    res.json({ success: true, data });
  } catch (error) {
    next(error);
  }
};

export const remove = async (req: Request, res: Response, next: NextFunction) => {
  try {
    await service.deleteResource(req.params.id as string);
    res.json({ success: true, message: 'Resource deleted' });
  } catch (error) {
    next(error);
  }
};

export const getAccess = async (req: Request, res: Response, next: NextFunction) => {
  try {
    const protocol = req.headers['x-forwarded-proto'] as string || req.protocol || 'https';
    const host = req.headers['x-forwarded-host'] as string || req.get('host');
    const data = await service.getResourceAccess(req.params.id as string, req.user!, protocol, host);
    res.json({ success: true, data });
  } catch (error) {
    next(error);
  }
};

export const streamContent = async (req: Request, res: Response, next: NextFunction) => {
  try {
    await service.streamResource(req.params.id as string, req, res);
  } catch (error) {
    next(error);
  }
};

export const streamDriveContent = async (req: Request, res: Response, next: NextFunction) => {
  try {
    let driveId = req.params.driveId || (req.query.id as string) || '';
    if (driveId.includes('/')) {
      const match = driveId.match(/[-\w]{25,}/);
      if (match) driveId = match[0];
    }
    await service.streamDriveFile(driveId, req, res);
  } catch (error) {
    next(error);
  }
};

export const update = async (req: Request, res: Response, next: NextFunction) => {
  try {
    // Normalize array fields from multipart/form-data (in case they send it as form-data instead of JSON)
    const normalizedBody = { ...req.body };
    for (const key of Object.keys(normalizedBody)) {
      if (key.endsWith('[]')) {
        const newKey = key.slice(0, -2);
        normalizedBody[newKey] = Array.isArray(normalizedBody[key]) ? normalizedBody[key] : [normalizedBody[key]];
        delete normalizedBody[key];
      } else if (typeof normalizedBody[key] === 'string' && normalizedBody[key].startsWith('[') && normalizedBody[key].endsWith(']')) {
        try {
          normalizedBody[key] = JSON.parse(normalizedBody[key]);
        } catch (e) {
          // ignore parsing error if it's not actually JSON
        }
      }
    }

    const data = await service.updateResource(req.params.id as string, normalizedBody, req.user!.userId);
    res.json({ success: true, data });
  } catch (error) {
    next(error);
  }
};

export const uploadVersion = async (req: Request, res: Response, next: NextFunction) => {
  try {
    const data = await service.uploadNewVersion(req.params.id as string, req.file, req.user!.userId, req.user!.tenantId);
    res.json({ success: true, data });
  } catch (error) {
    next(error);
  }
};

export const getCourseHierarchy = async (req: Request, res: Response, next: NextFunction) => {
  try {
    const data = await service.getCourseHierarchyResources(req.params.courseId as string, req.user!.tenantId);
    res.json({ success: true, data });
  } catch (error) {
    next(error);
  }
};
