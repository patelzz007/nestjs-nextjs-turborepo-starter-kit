import type { KanbanLinkKind } from "@workspace/shared";

import { KanbanLinkInvalidError } from "../errors/kanban.errors";

/** How a link is stored: one way round, `BLOCKS` reading "source blocks target". */
export type KanbanStoredLinkKind = "BLOCKS" | "RELATES_TO";

export interface KanbanStoredLink {
	readonly sourceTaskId: string;
	readonly targetTaskId: string;
	readonly kind: KanbanStoredLinkKind;
}

/**
 * The stored form of a link `taskId` asks for: "blocked by X" is stored as
 * "X blocks this". An item never links to itself.
 */
export function toStoredLink(taskId: string, targetTaskId: string, kind: KanbanLinkKind): KanbanStoredLink {
	if (targetTaskId === taskId) {
		throw new KanbanLinkInvalidError(targetTaskId);
	}
	switch (kind) {
		case "BLOCKS":
			return { sourceTaskId: taskId, targetTaskId, kind: "BLOCKS" };
		case "BLOCKED_BY":
			return { sourceTaskId: targetTaskId, targetTaskId: taskId, kind: "BLOCKS" };
		case "RELATES_TO":
			return { sourceTaskId: taskId, targetTaskId, kind: "RELATES_TO" };
	}
}

/** A stored link as `viewerTaskId` (one of its two ends) sees it, and the item at the other end. */
export function linkAsSeenBy(viewerTaskId: string, link: KanbanStoredLink): { readonly kind: KanbanLinkKind; readonly otherTaskId: string } {
	const isSource = link.sourceTaskId === viewerTaskId;
	const otherTaskId = isSource ? link.targetTaskId : link.sourceTaskId;
	if (link.kind === "RELATES_TO") {
		return { kind: "RELATES_TO", otherTaskId };
	}
	return { kind: isSource ? "BLOCKS" : "BLOCKED_BY", otherTaskId };
}
