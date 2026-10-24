import type { SystemOperationName } from "../../../platform/application/system-operation-names";

/** Allowlisted operation the one-off board conversion runs under (`pnpm db:kanban-convert`; docs/technical/kanban.md → "Converting an older board"). */
export const KANBAN_CONVERSION_OPERATION: SystemOperationName = "kanban.board.convert";
