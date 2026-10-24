import type { ActorContext } from "../../../../platform/application/actor-context";

/**
 * Who may be assigned a board item or a subtask: every active account that
 * holds READ on KANBAN_TASK (the authorization context decides), SuperAdmins included.
 */
export interface KanbanAssigneesPort {
	assignableUserIds(actor: ActorContext): Promise<readonly string[]>;
}
