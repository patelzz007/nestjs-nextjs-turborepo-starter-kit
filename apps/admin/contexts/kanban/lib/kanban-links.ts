// ============================================
// contexts/kanban/lib/kanban-links.ts - links into the two boards
// ============================================
// The board page reads its board (and filters) from the URL, so a link to "this
// feature's stories" is the execution board searched for the feature's title —
// the boards stay linked without either holding the other's items.

import type { KanbanBoardKind } from "@workspace/shared";

import { ROUTES } from "@/lib/routes";

import type { KanbanBoardParam } from "../url-state/kanban-board";

const PARAM_OF_BOARD: Readonly<Record<KanbanBoardKind, KanbanBoardParam>> = { EXECUTION: "execution", PLANNING: "planning" };

/** The board page showing `board`, optionally searched for `search`. */
export function kanbanBoardHref(board: KanbanBoardKind, search?: string): string {
	const params = new URLSearchParams({ board: PARAM_OF_BOARD[board] });
	if (search !== undefined && search.length > 0) {
		params.set("search", search);
	}
	return `${ROUTES.kanban.board}?${params.toString()}`;
}
