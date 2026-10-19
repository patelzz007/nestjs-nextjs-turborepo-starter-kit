import type { SystemOperationName } from "../../../../platform/application/system-operation-names";

export const FILES_UNIT_OF_WORK = Symbol("FILES_UNIT_OF_WORK");
export const STORED_FILE_READS = Symbol("STORED_FILE_READS");
export const FILE_OBJECT_STORAGE = Symbol("FILE_OBJECT_STORAGE");
export const FILE_PROCESSING = Symbol("FILE_PROCESSING");
export const CDN_INVALIDATION = Symbol("CDN_INVALIDATION");
export const LOCAL_STORAGE_TRANSFER = Symbol("LOCAL_STORAGE_TRANSFER");
export const PROCESSING_CALLBACK_AUTHENTICATOR = Symbol("PROCESSING_CALLBACK_AUTHENTICATOR");

/** Bypass operation a deletion runs as when an owner's binding rows are bypass-only (see FileReferenceGuard.deletionScope). */
export const FILES_DELETE_OPERATION: SystemOperationName = "files.delete";

/** The verdict transaction (transition, renditions and every owner's in-transaction reaction). */
export const FILES_SCAN_VERDICT_OPERATION: SystemOperationName = "files.scan_verdict.apply";

/** Background jobs, one operation per queue. */
export const STORAGE_SCAN_OPERATION: SystemOperationName = "queue.storage.scan";
export const STORAGE_CLEANUP_OPERATION: SystemOperationName = "queue.storage.cleanup";
export const STORAGE_DELETE_OPERATION: SystemOperationName = "queue.storage.delete";

/** `deletedBy` recorded when the sweep removes an abandoned or expired upload. */
export const STORAGE_CLEANUP_ACTOR = "system:storage-cleanup";
