import * as React from "react";

import { KanbanBoardView } from "@/contexts/kanban/components/kanban-board-view";
import { KANBAN_BOARD_OF_PARAM, KANBAN_BOARD_URL_STATE } from "@/contexts/kanban/url-state/kanban-board";
import { createAdminServerCaller } from "@/lib/admin-server-api";
import { prefetch, resolvePrefetchedData } from "@/lib/server/prefetch";

export const dynamic = "force-dynamic";

/**
 * `/components/kanban-board` — the staff's two linked boards (`GET /admin/kanban/board?board=…`,
 * LIST KANBAN_TASK; the route guard checks it). The board comes from the URL and is prefetched;
 * the view, swimlanes, search, filters and sort live in the URL too and apply in the browser
 * (a board is bounded), so one prefetch serves them all.
 */
export default async function KanbanPage({ searchParams }: { readonly searchParams: Promise<Record<string, string | string[] | undefined>> }): Promise<React.JSX.Element> {
	const urlState = KANBAN_BOARD_URL_STATE.parse(await searchParams);
	const board = KANBAN_BOARD_OF_PARAM[urlState.board];
	const server = createAdminServerCaller();
	const result = await prefetch({ page: "/components/kanban-board", resource: "kanban board" }, () => server.kanban.board.query({ board }));

	return <KanbanBoardView initialBoard={resolvePrefetchedData(result)} />;
}
