import { listSearchParam } from "@workspace/client/lib/url-state/list-url-state";
import { defineUrlState, optionalBooleanUrlParam, optionalUrlParam, urlParamWithDefault } from "@workspace/client/lib/url-state/url-state";
import {
	KanbanGroupBySchema,
	KanbanItemTypeSchema,
	KanbanTaskPrioritySchema,
	KanbanTeamSchema,
	type KanbanBoardKind,
	type KanbanGroupBy,
	type KanbanItemType,
} from "@workspace/shared";
import { z } from "zod";

/** Which of the two linked boards the page shows, as the URL spells it. */
export const KanbanBoardParamSchema = z.enum(["execution", "planning"]);
export type KanbanBoardParam = z.output<typeof KanbanBoardParamSchema>;

/** The URL's board → the API's board. */
export const KANBAN_BOARD_OF_PARAM: Readonly<Record<KanbanBoardParam, KanbanBoardKind>> = { execution: "EXECUTION", planning: "PLANNING" };

/** How the items are shown: as columns, as a grouped list, as one table, or — across both boards — as an expandable tree. */
export const KanbanViewSchema = z.enum(["board", "hierarchy", "list", "table"]);
export type KanbanView = z.output<typeof KanbanViewSchema>;

/** Whether the board is split into swimlanes, and by which level: epic, feature or story (the shared preference values). */
export const KanbanLanesSchema = KanbanGroupBySchema;
export type KanbanLanes = KanbanGroupBy;

/** The level each swimlane choice groups by (`none`: no lanes). */
export const KANBAN_LANE_TYPE_OF_PARAM: Readonly<Record<KanbanLanes, KanbanItemType | null>> = { none: null, epic: "EPIC", feature: "FEATURE", story: "STORY" };

/**
 * How items are ordered within a column. `manual` is the board's own order (the
 * only one a card can be dragged in); the others are read-only views of it.
 */
export const KanbanSortSchema = z.enum(["manual", "due", "priority"]);
export type KanbanSort = z.output<typeof KanbanSortSchema>;

/** Whether the execution board's rollup strip (its active features' progress) is open. */
export const KanbanRollupSchema = z.enum(["open", "closed"]);
export type KanbanRollupState = z.output<typeof KanbanRollupSchema>;

/**
 * `/components/kanban-board` state: the board, the view, the swimlanes, a
 * search, one priority, team, type and feature filter, the order, whether
 * subtasks show as cards and whether the rollup strip is open. `lanes` and
 * `subtasks` are left out of the URL until someone picks one here: then the
 * person's saved preference applies, and after it the board's default
 * (`kanban-board-preferences.ts`).
 */
export const KANBAN_BOARD_URL_STATE = defineUrlState({
	board: urlParamWithDefault(KanbanBoardParamSchema, "execution"),
	view: urlParamWithDefault(KanbanViewSchema, "board"),
	lanes: optionalUrlParam(KanbanLanesSchema),
	search: listSearchParam(),
	priority: optionalUrlParam(KanbanTaskPrioritySchema),
	team: optionalUrlParam(KanbanTeamSchema),
	type: optionalUrlParam(KanbanItemTypeSchema),
	/** The feature the board is narrowed to (a rollup row's click). */
	feature: optionalUrlParam(z.uuid()),
	sort: urlParamWithDefault(KanbanSortSchema, "manual"),
	subtasks: optionalBooleanUrlParam(),
	rollup: urlParamWithDefault(KanbanRollupSchema, "open"),
});

export type KanbanBoardUrlState = typeof KANBAN_BOARD_URL_STATE.defaults;
