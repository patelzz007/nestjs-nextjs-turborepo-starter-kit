import type { SystemOperationName } from "../../../../platform/application/system-operation-names";

/** Read the bypass-only board tables (and the names and files they point at) after the KANBAN_TASK check. */
export const KANBAN_READ_OPERATION: SystemOperationName = "kanban.board.read";

/** Write the bypass-only board tables after the KANBAN_TASK check. */
export const KANBAN_WRITE_OPERATION: SystemOperationName = "kanban.board.write";

/** The kanban unit of work (`UnitOfWork<KanbanScope>`). */
export const KANBAN_UNIT_OF_WORK = Symbol("KANBAN_UNIT_OF_WORK");

/** {@link KanbanReadPort}. */
export const KANBAN_READS = Symbol("KANBAN_READS");

/** {@link KanbanAttachmentFilesPort}. */
export const KANBAN_ATTACHMENT_FILES = Symbol("KANBAN_ATTACHMENT_FILES");

/** {@link KanbanAssigneesPort}. */
export const KANBAN_ASSIGNEES = Symbol("KANBAN_ASSIGNEES");

/** {@link KanbanIdGenerator}. */
export const KANBAN_ID_GENERATOR = Symbol("KANBAN_ID_GENERATOR");

/** Generates ids for new board rows (a fake makes them deterministic in tests). */
export interface KanbanIdGenerator {
	next(): string;
}
