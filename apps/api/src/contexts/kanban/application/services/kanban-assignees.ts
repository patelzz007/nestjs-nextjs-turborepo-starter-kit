import type { ActorContext } from "../../../../platform/application/actor-context";
import { KanbanAssigneeInvalidError } from "../../domain/errors/kanban.errors";
import type { KanbanAssigneesPort } from "../ports/kanban-assignees.port";

/**
 * Refuses an assignment of anyone who may not use the board. Only the people
 * the change newly assigns are checked (`null` and repeats are skipped), so an
 * item keeps an assignee who has since lost access until someone reassigns it.
 */
export async function assertAssignable(assignees: KanbanAssigneesPort, actor: ActorContext, userIds: readonly (string | null)[]): Promise<void> {
	const wanted = [...new Set(userIds.flatMap((userId) => (userId === null ? [] : [userId])))];
	if (wanted.length === 0) {
		return;
	}
	const allowed = new Set(await assignees.assignableUserIds(actor));
	const refused = wanted.find((userId) => !allowed.has(userId));
	if (refused !== undefined) {
		throw new KanbanAssigneeInvalidError(refused);
	}
}
