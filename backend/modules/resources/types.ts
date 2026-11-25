import { BaseAuditFields } from '../../core/types';

export type ResourceType = 'PDF' | 'PPT' | 'DOC' | 'DOCX' | 'XLS' | 'XLSX' | 'ZIP' | 'IMAGE' | 'TEXT' | 'AUDIO' | 'VIDEO_ATTACHMENT' | 'LINK' | 'HTML' | 'CURRENT_AFFAIRS' | 'QUESTION_BANK' | 'COLLECTION';
export type ResourceProvider = 'firebase_storage' | 'google_drive' | 'firebase_asset' | 'external_link';
export type ResourceStatus = 'draft' | 'review' | 'published' | 'archived';
export type ResourceVisibility = 'public' | 'private' | 'restricted' | 'batch' | 'premium' | 'selected';

export interface IResource extends BaseAuditFields {
  id?: string;
  tenantId: string;
  title: string;
  description: string;
  type: ResourceType;
  provider: ResourceProvider;
  visibility: ResourceVisibility;
  storagePath: string; // Encrypted
  checksum: string;
  version: number;
  previousVersion?: number;
  fileSize: number;
  mimeType: string;
  thumbnail?: string;
  pageCount?: number;
  tags?: string[];

  // Audio Attachment (optional narration/lecture audio linked to PDF)
  hasAudio?: boolean;
  audioUrl?: string;          // Public/Drive URL to the audio file
  audioStoragePath?: string;  // Encrypted storage path (if uploaded to Drive/Firebase)

  // Subject Label (simple top-level subject tag e.g. 'History', 'Geography')
  subject?: string;
  
  // Extended Metadata
  author?: string;
  language?: string;
  readingTimeMins?: number;
  publishedDate?: string;
  
  // Publishing Workflow & Scheduling
  status: ResourceStatus;
  publishAt?: string;
  hideAfter?: string;
  
  // Offline Policy
  offlineAvailable: boolean;
  isSecure: boolean;

  // Collections (If type === 'COLLECTION')
  collectionItemIds?: string[];
  
  // Category & Display
  categoryId?: string;
  displayOrder: number;
  displayGroup: 'pinned' | 'featured' | 'normal';
  isPinned: boolean;
  isFeatured: boolean;

  // Multiple Targets (Simple Indexed Arrays)
  courseIds?: string[];
  subjectIds?: string[];
  topicIds?: string[];
  classIds?: string[];
  batchIds?: string[];
  isGeneral: boolean;
  
  // Access Targets
  targetBatchIds?: string[];
  targetStudentIds?: string[];
  targetPrograms?: string[];
}
