/*
 * The files context's public surface (§6.4). Other contexts import only this file.
 *
 * - Events: `FileVerdictReached` (mechanism 1 — owners bind READY files in the
 *   verdict transaction) and `FileDeleted` (mechanism 1 to release binding rows,
 *   mechanism 2 for the physical purge). An owner that cannot bind throws
 *   `FileBindingTargetMissingError`.
 * - Registries owners register into from their module's `onModuleInit`:
 *   `FileCategoryAccessRegistry` (who may upload/complete/read/delete a
 *   category) and `FileReferenceGuardRegistry` (may this file be deleted? —
 *   bind a guard with `bindFileReferenceGuard(guard, ownerScopeFactory)`).
 * - `createFilesTransactionalPorts(db)`: `FileReferencePort.lockForBinding`,
 *   for an owner's scope factory, on the owner's own transaction client.
 * - Image read helpers for owners that serve a file's renditions in their
 *   own projections (`IMAGE_RENDITIONS_SELECT`, `toImageSources`).
 * - `StoredFileAccess`: upload, completion, lookup, signed downloads, bytes, ZIP
 *   archives and deletion of a file the calling context already authorized.
 */
export { FileDeleted, type DeletedFileObject } from "./domain/events/file-deleted.event";
export { FileVerdictReached, fileVerdictReached, type FileVerdictOutcome } from "./domain/events/file-verdict-reached.event";
export { FileBindingTargetMissingError } from "./domain/errors/files.errors";
export {
	FileCategoryAccessRegistry,
	fileForbidden,
	uploaderOnly,
	type FileAccessAction,
	type FileAccessSubject,
	type FileActor,
	type FileCategoryAccessRule,
} from "./application/ports/file-category-access.port";
export {
	FileReferenceGuardRegistry,
	bindFileReferenceGuard,
	type BoundFileReferenceGuard,
	type FileDeletionScope,
	type FileReferenceBlock,
	type FileReferenceGuard,
	type FileReferenceSubject,
} from "./application/ports/file-reference.port";
export { isOwnPersonalUpload } from "./domain/policies/file-upload.policy";
export type { BindableFile, FileBindingRequest, FileReferencePort, FilesTransactionalPorts } from "./application/ports/file-binding.port";
export { createFilesTransactionalPorts } from "./infrastructure/persistence/files-transactional-ports";
export { IMAGE_RENDITIONS_SELECT, toImageSources, type ImageRenditionRows } from "./infrastructure/persistence/image-renditions.select";
export { StoredFileAccess } from "./infrastructure/adapters/stored-file-access";
export type { StoredFileDbClient } from "./infrastructure/persistence/stored-file.mapper";

// ── The Nest module (last: the values above must be initialised before its graph loads) ──
export { FilesModule } from "./files.module";
