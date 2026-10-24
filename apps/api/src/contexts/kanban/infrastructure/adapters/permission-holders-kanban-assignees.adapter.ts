import type { ActorContext } from "../../../../platform/application/actor-context";
import type { PermissionHoldersReadPort } from "../../../authorization/public-api";
import type { KanbanAssigneesPort } from "../../application/ports/kanban-assignees.port";

/** {@link KanbanAssigneesPort} over the authorization context: the holders of READ on KANBAN_TASK. */
export class PermissionHoldersKanbanAssignees implements KanbanAssigneesPort {
	public constructor(private readonly holders: PermissionHoldersReadPort) {}

	public assignableUserIds(actor: ActorContext): Promise<readonly string[]> {
		return this.holders.holdersOf(actor, "READ", "KANBAN_TASK");
	}
}
