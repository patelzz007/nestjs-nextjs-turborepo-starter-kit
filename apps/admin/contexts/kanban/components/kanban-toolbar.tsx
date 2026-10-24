"use client";

import { KanbanItemTypeSchema, KanbanTaskPrioritySchema, KanbanTeamSchema, type KanbanItemType, type KanbanTaskPriority, type KanbanTeam } from "@workspace/shared";
import { Badge } from "@workspace/ui/components/badge";
import { Button } from "@workspace/ui/components/button";
import { ButtonGroup, ButtonGroupSeparator } from "@workspace/ui/components/button-group";
import {
	DropdownMenu,
	DropdownMenuCheckboxItem,
	DropdownMenuContent,
	DropdownMenuGroup,
	DropdownMenuItem,
	DropdownMenuLabel,
	DropdownMenuRadioGroup,
	DropdownMenuRadioItem,
	DropdownMenuSeparator,
	DropdownMenuSub,
	DropdownMenuSubContent,
	DropdownMenuSubTrigger,
	DropdownMenuTrigger,
} from "@workspace/ui/components/dropdown-menu";
import { InputGroup, InputGroupAddon, InputGroupInput } from "@workspace/ui/components/input-group";
import { Tabs, TabsList, TabsTrigger } from "@workspace/ui/components/tabs";
import {
	ArrowUpDown,
	ChevronDown,
	Kanban as KanbanIcon,
	LayoutTemplate,
	List,
	ListTree,
	Map as RoadmapIcon,
	Plus,
	RotateCcw,
	Rows3,
	Search,
	SlidersHorizontal,
	SquareKanban,
	Table2,
	Upload,
} from "lucide-react";
import * as React from "react";
import { z } from "zod";

import { KANBAN_BOARD_DISPLAY, KANBAN_PRIORITY_DISPLAY, KANBAN_TEAM_DISPLAY, KANBAN_TYPE_DISPLAY } from "../lib/kanban-display";
import type { KanbanChoiceSource } from "../lib/kanban-board-preferences";
import type { KanbanTaskTemplate } from "../lib/kanban-task-form";
import {
	KANBAN_BOARD_OF_PARAM,
	KANBAN_LANE_TYPE_OF_PARAM,
	KanbanBoardParamSchema,
	KanbanLanesSchema,
	KanbanSortSchema,
	KanbanViewSchema,
	type KanbanBoardParam,
	type KanbanLanes,
	type KanbanSort,
	type KanbanView,
} from "../url-state/kanban-board";

/** The radio value that clears a filter. */
const ALL = "ALL";

const PriorityChoiceSchema = z.union([z.literal(ALL), KanbanTaskPrioritySchema]);
const TeamChoiceSchema = z.union([z.literal(ALL), KanbanTeamSchema]);
const TypeChoiceSchema = z.union([z.literal(ALL), KanbanItemTypeSchema]);

const SORT_LABELS: Readonly<Record<KanbanSort, string>> = { manual: "Board order", due: "Due date", priority: "Priority" };

export interface KanbanToolbarProps {
	readonly board: KanbanBoardParam;
	readonly onBoardChange: (board: KanbanBoardParam) => void;
	readonly view: KanbanView;
	readonly onViewChange: (view: KanbanView) => void;
	readonly lanes: KanbanLanes;
	/** The levels this board's swimlanes can group by, coarsest first. */
	readonly laneTypes: readonly KanbanItemType[];
	readonly onLanesChange: (lanes: KanbanLanes) => void;
	/** Why the grouping is what it is: the board's default, the person's choice, or narrowed to one feature (then grouped by story). */
	readonly lanesSource: KanbanChoiceSource;
	/** Whether subtask cards show (the execution board only; `undefined` hides the choice). */
	readonly showSubtasks?: boolean | undefined;
	readonly onShowSubtasksChange?: ((show: boolean) => void) | undefined;
	/** "Reset to default": forget the grouping and "Show subtasks" choices. */
	readonly onResetGrouping: () => void;
	/** The search box's in-progress text (committed to the URL after a pause). */
	readonly search: string;
	readonly onSearchChange: (search: string) => void;
	readonly priority: KanbanTaskPriority | undefined;
	readonly onPriorityChange: (priority: KanbanTaskPriority | undefined) => void;
	readonly team: KanbanTeam | undefined;
	readonly onTeamChange: (team: KanbanTeam | undefined) => void;
	readonly type: KanbanItemType | undefined;
	/** The levels this board holds (the type filter's choices). */
	readonly types: readonly KanbanItemType[];
	readonly onTypeChange: (type: KanbanItemType | undefined) => void;
	readonly sort: KanbanSort;
	readonly onSortChange: (sort: KanbanSort) => void;
	readonly canCreateTasks: boolean;
	/** The primary button's text ("Add story"). */
	readonly addLabel: string;
	readonly templates: readonly KanbanTaskTemplate[];
	readonly onAddTask: () => void;
	readonly onAddFromTemplate: (templateKey: string) => void;
	readonly onImportCsv: () => void;
}

function TemplateItem({ template, onSelect }: { readonly template: KanbanTaskTemplate; readonly onSelect: (key: string) => void }): React.JSX.Element {
	const handleClick = React.useCallback((): void => {
		onSelect(template.key);
	}, [onSelect, template.key]);
	return <DropdownMenuItem onClick={handleClick}>{template.label}</DropdownMenuItem>;
}

/**
 * The board's toolbar: the Planning / Execution board switch, the Board /
 * Hierarchy / List / Table switch, the "Group by" swimlanes menu, the search
 * box, the filter and sort menus, and the split "Add …" button (import a CSV,
 * start from a template). The Hierarchy view spans both boards, so it hides the
 * board switch and the sort. Controlled: the page owns every value, the URL
 * holds them.
 */
export function KanbanToolbar({
	board,
	onBoardChange,
	view,
	onViewChange,
	lanes,
	laneTypes,
	onLanesChange,
	lanesSource,
	showSubtasks,
	onShowSubtasksChange,
	onResetGrouping,
	search,
	onSearchChange,
	priority,
	onPriorityChange,
	team,
	onTeamChange,
	type,
	types,
	onTypeChange,
	sort,
	onSortChange,
	canCreateTasks,
	addLabel,
	templates,
	onAddTask,
	onAddFromTemplate,
	onImportCsv,
}: KanbanToolbarProps): React.JSX.Element {
	const activeFilters = (priority === undefined ? 0 : 1) + (team === undefined ? 0 : 1) + (type === undefined ? 0 : 1);

	const handleBoardChange = React.useCallback(
		(next: string): void => {
			const parsed = KanbanBoardParamSchema.safeParse(next);
			if (parsed.success) {
				onBoardChange(parsed.data);
			}
		},
		[onBoardChange],
	);
	const handleLanesChange = React.useCallback(
		(next: string): void => {
			const parsed = KanbanLanesSchema.safeParse(next);
			if (parsed.success) {
				onLanesChange(parsed.data);
			}
		},
		[onLanesChange],
	);
	const laneChoices = KanbanLanesSchema.options.filter((option) => {
		const optionType = KANBAN_LANE_TYPE_OF_PARAM[option];
		return optionType === null || laneTypes.includes(optionType);
	});
	const laneType = KANBAN_LANE_TYPE_OF_PARAM[lanes];
	// Nothing to reset while the board shows its defaults (subtasks hidden is the default).
	const isDefaultGrouping = lanesSource === "default" && showSubtasks !== true;
	const isTree = view === "hierarchy";
	const handleTypeChange = React.useCallback(
		(next: string): void => {
			const parsed = TypeChoiceSchema.safeParse(next);
			if (parsed.success) {
				onTypeChange(parsed.data === ALL ? undefined : parsed.data);
			}
		},
		[onTypeChange],
	);

	const handleViewChange = React.useCallback(
		(next: string): void => {
			const parsed = KanbanViewSchema.safeParse(next);
			if (parsed.success) {
				onViewChange(parsed.data);
			}
		},
		[onViewChange],
	);
	const handleSearchChange = React.useCallback(
		(event: React.ChangeEvent<HTMLInputElement>): void => {
			onSearchChange(event.target.value);
		},
		[onSearchChange],
	);
	const handlePriorityChange = React.useCallback(
		(next: string): void => {
			const parsed = PriorityChoiceSchema.safeParse(next);
			if (parsed.success) {
				onPriorityChange(parsed.data === ALL ? undefined : parsed.data);
			}
		},
		[onPriorityChange],
	);
	const handleTeamChange = React.useCallback(
		(next: string): void => {
			const parsed = TeamChoiceSchema.safeParse(next);
			if (parsed.success) {
				onTeamChange(parsed.data === ALL ? undefined : parsed.data);
			}
		},
		[onTeamChange],
	);
	const handleSortChange = React.useCallback(
		(next: string): void => {
			const parsed = KanbanSortSchema.safeParse(next);
			if (parsed.success) {
				onSortChange(parsed.data);
			}
		},
		[onSortChange],
	);

	return (
		<div className="flex shrink-0 flex-col gap-3 border-b px-4 py-3 lg:px-5 2xl:flex-row 2xl:items-center 2xl:justify-between">
			<div className="flex min-w-0 flex-col gap-2 sm:flex-row sm:flex-wrap sm:items-center">
				{isTree ? null : (
					<Tabs value={board} onValueChange={handleBoardChange} className="min-w-0 shrink-0">
						<TabsList aria-label="Board" className="w-full *:data-[slot=tabs-trigger]:flex-1 sm:w-fit sm:*:data-[slot=tabs-trigger]:flex-none">
							<TabsTrigger value="planning" className="gap-2" title={KANBAN_BOARD_DISPLAY.PLANNING.description}>
								<RoadmapIcon />
								{KANBAN_BOARD_DISPLAY[KANBAN_BOARD_OF_PARAM.planning].label}
							</TabsTrigger>
							<TabsTrigger value="execution" className="gap-2" title={KANBAN_BOARD_DISPLAY.EXECUTION.description}>
								<SquareKanban />
								{KANBAN_BOARD_DISPLAY[KANBAN_BOARD_OF_PARAM.execution].label}
							</TabsTrigger>
						</TabsList>
					</Tabs>
				)}
				<Tabs value={view} onValueChange={handleViewChange} className="min-w-0 shrink-0">
					<TabsList className="w-full *:data-[slot=tabs-trigger]:flex-1 sm:w-fit sm:*:data-[slot=tabs-trigger]:flex-none">
						<TabsTrigger value="board" className="gap-2">
							<KanbanIcon />
							Board
						</TabsTrigger>
						<TabsTrigger value="hierarchy" className="gap-2" title="Both boards as one tree: epics, features, stories, tasks and subtasks">
							<ListTree />
							Hierarchy
						</TabsTrigger>
						<TabsTrigger value="list" className="gap-2">
							<List />
							List
						</TabsTrigger>
						<TabsTrigger value="table" className="gap-2">
							<Table2 />
							Table
						</TabsTrigger>
					</TabsList>
				</Tabs>
			</div>

			<div className="flex min-w-0 flex-col gap-2 sm:flex-row sm:flex-wrap sm:items-center 2xl:justify-end">
				{view === "board" ? (
					<DropdownMenu>
						<DropdownMenuTrigger render={<Button variant="outline" className="w-full sm:w-auto" />}>
							<Rows3 data-icon="inline-start" />
							{laneType === null ? "Group by" : `Group: ${KANBAN_TYPE_DISPLAY[laneType].label}`}
						</DropdownMenuTrigger>
						<DropdownMenuContent align="end" className="w-60">
							<DropdownMenuGroup>
								<DropdownMenuLabel>Swimlanes</DropdownMenuLabel>
								<DropdownMenuRadioGroup value={lanes} onValueChange={handleLanesChange}>
									{laneChoices.map((option) => {
										const optionType = KANBAN_LANE_TYPE_OF_PARAM[option];
										return (
											<DropdownMenuRadioItem key={option} value={option}>
												{optionType === null ? "None" : KANBAN_TYPE_DISPLAY[optionType].label}
											</DropdownMenuRadioItem>
										);
									})}
								</DropdownMenuRadioGroup>
								{lanesSource === "narrowed" ? <p className="px-2 pt-1 pb-1.5 text-xs text-muted-foreground">One feature is shown, so its stories are the lanes.</p> : null}
							</DropdownMenuGroup>
							{showSubtasks === undefined || onShowSubtasksChange === undefined ? null : (
								<>
									<DropdownMenuSeparator />
									<DropdownMenuCheckboxItem checked={showSubtasks} onCheckedChange={onShowSubtasksChange}>
										Show subtasks
									</DropdownMenuCheckboxItem>
								</>
							)}
							<DropdownMenuSeparator />
							<DropdownMenuItem disabled={isDefaultGrouping} onClick={onResetGrouping}>
								<RotateCcw />
								Reset to default
							</DropdownMenuItem>
						</DropdownMenuContent>
					</DropdownMenu>
				) : null}
				<InputGroup className="min-w-0 sm:w-64 2xl:w-48">
					<InputGroupInput type="search" placeholder="Search items" aria-label="Search items" value={search} onChange={handleSearchChange} />
					<InputGroupAddon>
						<Search />
					</InputGroupAddon>
				</InputGroup>

				<DropdownMenu>
					<DropdownMenuTrigger render={<Button variant="outline" className="w-full sm:w-auto" />}>
						<SlidersHorizontal data-icon="inline-start" />
						Filter
						{activeFilters > 0 ? (
							<Badge variant="secondary" size="sm" radius="full">
								{activeFilters}
							</Badge>
						) : null}
					</DropdownMenuTrigger>
					<DropdownMenuContent align="end" className="w-52">
						<DropdownMenuGroup>
							<DropdownMenuLabel>Type</DropdownMenuLabel>
							<DropdownMenuRadioGroup value={type ?? ALL} onValueChange={handleTypeChange}>
								<DropdownMenuRadioItem value={ALL}>Any type</DropdownMenuRadioItem>
								{types.map((option) => (
									<DropdownMenuRadioItem key={option} value={option}>
										{KANBAN_TYPE_DISPLAY[option].plural}
									</DropdownMenuRadioItem>
								))}
							</DropdownMenuRadioGroup>
						</DropdownMenuGroup>
						<DropdownMenuSeparator />
						<DropdownMenuGroup>
							<DropdownMenuLabel>Priority</DropdownMenuLabel>
							<DropdownMenuRadioGroup value={priority ?? ALL} onValueChange={handlePriorityChange}>
								<DropdownMenuRadioItem value={ALL}>Any priority</DropdownMenuRadioItem>
								{KanbanTaskPrioritySchema.options.map((option) => (
									<DropdownMenuRadioItem key={option} value={option}>
										{KANBAN_PRIORITY_DISPLAY[option].label}
									</DropdownMenuRadioItem>
								))}
							</DropdownMenuRadioGroup>
						</DropdownMenuGroup>
						<DropdownMenuSeparator />
						<DropdownMenuGroup>
							<DropdownMenuLabel>Team</DropdownMenuLabel>
							<DropdownMenuRadioGroup value={team ?? ALL} onValueChange={handleTeamChange}>
								<DropdownMenuRadioItem value={ALL}>Any team</DropdownMenuRadioItem>
								{KanbanTeamSchema.options.map((option) => (
									<DropdownMenuRadioItem key={option} value={option}>
										{KANBAN_TEAM_DISPLAY[option].label}
									</DropdownMenuRadioItem>
								))}
							</DropdownMenuRadioGroup>
						</DropdownMenuGroup>
					</DropdownMenuContent>
				</DropdownMenu>

				{isTree ? null : (
					<DropdownMenu>
						<DropdownMenuTrigger render={<Button variant="outline" className="w-full sm:w-auto" />}>
							<ArrowUpDown data-icon="inline-start" />
							Sort
						</DropdownMenuTrigger>
						<DropdownMenuContent align="end" className="w-48">
							<DropdownMenuGroup>
								<DropdownMenuLabel>Order cards by</DropdownMenuLabel>
								<DropdownMenuRadioGroup value={sort} onValueChange={handleSortChange}>
									{KanbanSortSchema.options.map((option) => (
										<DropdownMenuRadioItem key={option} value={option}>
											{SORT_LABELS[option]}
										</DropdownMenuRadioItem>
									))}
								</DropdownMenuRadioGroup>
							</DropdownMenuGroup>
						</DropdownMenuContent>
					</DropdownMenu>
				)}

				{canCreateTasks ? (
					<ButtonGroup className="w-full sm:w-fit">
						<Button className="flex-1 sm:flex-none" onClick={onAddTask}>
							<Plus data-icon="inline-start" />
							{addLabel}
						</Button>
						<ButtonGroupSeparator />
						<DropdownMenu>
							<DropdownMenuTrigger render={<Button aria-label="Open add menu" />}>
								<ChevronDown />
							</DropdownMenuTrigger>
							<DropdownMenuContent align="end" className="w-48">
								<DropdownMenuItem onClick={onImportCsv}>
									<Upload />
									Import CSV
								</DropdownMenuItem>
								<DropdownMenuSub>
									<DropdownMenuSubTrigger>
										<LayoutTemplate />
										Add from template
									</DropdownMenuSubTrigger>
									<DropdownMenuSubContent className="w-48">
										{templates.map((template) => (
											<TemplateItem key={template.key} template={template} onSelect={onAddFromTemplate} />
										))}
									</DropdownMenuSubContent>
								</DropdownMenuSub>
							</DropdownMenuContent>
						</DropdownMenu>
					</ButtonGroup>
				) : null}
			</div>
		</div>
	);
}
