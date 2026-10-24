// @vitest-environment jsdom
import { cleanup, fireEvent, render, screen, within } from "@testing-library/react";
import { UiKitTestProviders } from "@workspace/ui/testing/ui-kit-test-providers";
import * as React from "react";
import { afterEach, describe, expect, it, vi } from "vitest";

import { epochMs } from "@workspace/shared";

import { ancestor, column, FEATURE_ID, STORY_ID, task, TODO_ID } from "../../lib/__tests__/kanban-fixtures";
import { KANBAN_TASK_TEMPLATES } from "../../lib/kanban-task-form";
import { columnHeadingOf, KanbanWipBadge, type KanbanColumnHeading } from "../kanban-board-columns";
import type { KanbanStatusColumn } from "../kanban-task-badges";
import { KanbanTaskCard } from "../kanban-task-card";
import { KanbanTaskList } from "../kanban-task-list";
import { KanbanTaskTable } from "../kanban-task-table";
import { KanbanToolbar, type KanbanToolbarProps } from "../kanban-toolbar";

const CARD = task({
	id: "a",
	title: "Ship the board",
	description: "Drag and drop for the team",
	priority: "HIGH",
	team: "QA",
	progress: 40,
	labels: ["kanban", "ui", "q4"],
	storyPoints: 5,
	ancestors: [ancestor({ id: FEATURE_ID, type: "FEATURE", title: "Staff boards" })],
	owner: { id: "o-1", name: "Admin User" },
	assignee: { id: "o-2", name: "Carol White" },
	acceptanceCriteria: { done: 1, total: 3 },
	counts: { comments: 3, attachments: 0, documents: 2 },
});

const TODO: KanbanStatusColumn = { board: "EXECUTION", state: "TODO", title: "To do" };
const DOING: KanbanStatusColumn = { board: "EXECUTION", state: "IN_PROGRESS", title: "Doing" };
const DONE: KanbanStatusColumn = { board: "EXECUTION", state: "DONE", title: "Done" };
const REFINING: KanbanStatusColumn = { board: "PLANNING", stage: "REFINING", title: "Refining" };

function taskHref(taskId: string): string {
	return `/components/kanban-board/tasks/${taskId}`;
}

afterEach(() => {
	cleanup();
});

describe("KanbanTaskCard", () => {
	it("says what the item is first: its level's icon, its level in capitals and its key", () => {
		render(<KanbanTaskCard task={{ ...CARD, key: "STORY-142" }} column={TODO} href={taskHref(CARD.id)} />, { wrapper: UiKitTestProviders });

		const article = screen.getByRole("article", { name: /Story STORY-142 Ship the board/ });
		expect(within(article).getByRole("img", { name: "Story" })).toBeDefined();
		expect(within(article).getByText("STORY-142")).toBeDefined();
		expect(within(article).getByText("Story").className).toContain("uppercase");
	});

	it("leaves the key out until the item has one", () => {
		render(<KanbanTaskCard task={CARD} column={TODO} href={taskHref(CARD.id)} />, { wrapper: UiKitTestProviders });

		expect(screen.queryByText(/STORY-/)).toBeNull();
	});

	it("shows the title as a link, the parent, labels, level, priority, estimate and assignee", () => {
		render(<KanbanTaskCard task={CARD} column={TODO} href={taskHref(CARD.id)} />, { wrapper: UiKitTestProviders });

		expect(screen.getByRole("link", { name: "Ship the board" }).getAttribute("href")).toBe("/components/kanban-board/tasks/a");
		expect(screen.getByText("Staff boards")).toBeDefined();
		expect(screen.getByText("kanban")).toBeDefined();
		expect(screen.getByText("+1")).toBeDefined();
		expect(screen.getByRole("img", { name: "Story" })).toBeDefined();
		expect(screen.getByRole("img", { name: "High priority" })).toBeDefined();
		expect(screen.getByTitle("Story points").textContent).toContain("5");
		expect(screen.getByText("Carol White")).toBeDefined();
		expect(screen.getByTitle("Acceptance criteria met").textContent).toContain("1/3");
		expect(screen.queryByText("Drag and drop for the team")).toBeNull();
		expect(screen.queryByRole("progressbar")).toBeNull();
	});

	it("flags a blocked item, and says who is unassigned", () => {
		render(<KanbanTaskCard task={{ ...CARD, isBlocked: true, assignee: null }} column={TODO} href={taskHref(CARD.id)} />, { wrapper: UiKitTestProviders });

		expect(screen.getByRole("img", { name: "Blocked" })).toBeDefined();
		expect(screen.getByText("Unassigned")).toBeDefined();
	});

	it("shows an epic's or feature's rolled-up points, and a task's due date from its story", () => {
		const feature = task({ id: "f", type: "FEATURE", title: "Refunds", rollup: { children: { done: 1, total: 2 }, points: { done: 5, total: 13 } } });
		const story = ancestor({ id: STORY_ID, type: "STORY", startAt: epochMs(new Date(2026, 5, 2, 12).getTime()), dueAt: epochMs(new Date(2026, 5, 14, 12).getTime()) });
		const { rerender } = render(<KanbanTaskCard task={feature} column={REFINING} href={taskHref("f")} />, { wrapper: UiKitTestProviders });

		expect(screen.getByText("5/13 pts")).toBeDefined();
		expect(screen.getByRole("progressbar", { name: "Refunds story points done" })).toBeDefined();
		expect(screen.getByRole("button", { name: /2 stories/ }).getAttribute("aria-expanded")).toBe("false");

		rerender(
			<KanbanTaskCard
				task={task({ id: "t", type: "TASK", ancestors: [story], rollup: { children: { done: 1, total: 3 }, points: { done: 0, total: 0 } } })}
				column={TODO}
				href={taskHref("t")}
			/>,
		);
		expect(screen.getByTitle("Due").textContent).toContain("Jun 14");
		expect(screen.getByText("3 subtasks · 1 done")).toBeDefined();
	});

	it("turns a task's subtask badge into the board's Show subtasks switch", () => {
		const onToggleSubtasks = vi.fn();
		const parent = task({ id: "t", type: "TASK", rollup: { children: { done: 1, total: 3 }, points: { done: 0, total: 0 } } });
		render(<KanbanTaskCard task={parent} column={TODO} href={taskHref("t")} actions={{ onToggleSubtasks, subtasksShown: false }} />, { wrapper: UiKitTestProviders });

		const badge = screen.getByRole("button", { name: /3 subtasks · 1 done/ });
		expect(badge.getAttribute("aria-pressed")).toBe("false");
		fireEvent.click(badge);
		expect(onToggleSubtasks).toHaveBeenCalledTimes(1);
	});

	it("counts a subtask's steps and draws it as a lighter, dashed card", () => {
		render(<KanbanTaskCard task={task({ id: "s", type: "SUBTASK", key: "SUBTASK-3", steps: { done: 1, total: 2 } })} column={TODO} href={taskHref("s")} />, {
			wrapper: UiKitTestProviders,
		});

		expect(screen.getByTitle("Steps done").textContent).toContain("1/2");
		expect(screen.getByRole("article").className).toContain("border-dashed");
	});

	it("counts only what there is: documents and comments, never empty attachments", () => {
		render(<KanbanTaskCard task={CARD} column={TODO} href={taskHref(CARD.id)} />, { wrapper: UiKitTestProviders });

		expect(screen.getByTitle("Comments").textContent).toContain("3");
		expect(screen.getByTitle("Documents").textContent).toContain("2");
		expect(screen.queryByTitle("Attachments")).toBeNull();
	});

	it("shows its progress while in progress", () => {
		render(<KanbanTaskCard task={CARD} column={DOING} href={taskHref(CARD.id)} />, { wrapper: UiKitTestProviders });

		expect(screen.getByText("40%")).toBeDefined();
		expect(screen.getByRole("progressbar", { name: "Ship the board progress" })).toBeDefined();
	});

	it("says a planning item is delivered in a delivered column", () => {
		render(<KanbanTaskCard task={task({ id: "f", type: "FEATURE" })} column={{ board: "PLANNING", stage: "DELIVERED", title: "Shipped" }} href={taskHref("f")} />, {
			wrapper: UiKitTestProviders,
		});

		expect(screen.getByText("Delivered")).toBeDefined();
	});

	it("says an item is done instead of counting in a done column", () => {
		render(<KanbanTaskCard task={CARD} column={DONE} href={taskHref(CARD.id)} />, { wrapper: UiKitTestProviders });

		expect(screen.getByText("Done")).toBeDefined();
		expect(screen.queryByTitle("Comments")).toBeNull();
	});
});

describe("KanbanTaskList and KanbanTaskTable", () => {
	const columns: readonly KanbanColumnHeading[] = [columnHeadingOf(column(TODO_ID, "Ideas", [CARD])), columnHeadingOf(column("empty", "Shipped", [], "DONE"))];
	const tasksByColumn = { [TODO_ID]: [CARD], empty: [] };

	it("lists each column's items and says when a column is empty", () => {
		render(<KanbanTaskList columns={columns} tasksByColumn={tasksByColumn} taskHref={taskHref} />, { wrapper: UiKitTestProviders });

		expect(within(screen.getByRole("region", { name: "Ideas" })).getByRole("link", { name: "Ship the board" })).toBeDefined();
		expect(within(screen.getByRole("region", { name: "Shipped" })).getByText("No items here.")).toBeDefined();
	});

	it("tables every item with its level, parent, column and estimate, and says when nothing matches", () => {
		const { rerender } = render(<KanbanTaskTable columns={columns} tasksByColumn={tasksByColumn} taskHref={taskHref} />, { wrapper: UiKitTestProviders });
		const row = screen.getByRole("link", { name: "Ship the board" }).closest("tr");
		const text = row === null ? "" : row.textContent;
		expect(text).toContain("Ideas");
		expect(text).toContain("Staff boards");
		expect(text).toContain("5 pts");

		rerender(<KanbanTaskTable columns={columns} tasksByColumn={{}} taskHref={taskHref} />);
		expect(screen.getByText("No items match.")).toBeDefined();
	});
});

describe("KanbanWipBadge", () => {
	it("counts stories and tasks against the limit and names the subtasks beside them", () => {
		const cards = [task({ id: "s" }), task({ id: "t", type: "TASK" }), task({ id: "u", type: "SUBTASK" }), task({ id: "v", type: "SUBTASK" })];
		render(<KanbanWipBadge column={{ ...columnHeadingOf(column(TODO_ID, "Doing", cards, "IN_PROGRESS")), wipLimit: 2 }} />, { wrapper: UiKitTestProviders });

		expect(screen.getByText(/^2\/2/).textContent).toBe("2/2 · +2 subtasks");
	});

	it("shows nothing for a column without a limit", () => {
		const { container } = render(<KanbanWipBadge column={columnHeadingOf(column(TODO_ID, "Doing", []))} />, { wrapper: UiKitTestProviders });

		expect(container.textContent).toBe("");
	});
});

describe("KanbanToolbar", () => {
	function props(overrides: Partial<KanbanToolbarProps> = {}): KanbanToolbarProps {
		return {
			board: "execution",
			onBoardChange: vi.fn(),
			view: "board",
			onViewChange: vi.fn(),
			lanes: "none",
			laneTypes: ["EPIC", "FEATURE", "STORY"],
			onLanesChange: vi.fn(),
			lanesSource: "default",
			onResetGrouping: vi.fn(),
			search: "",
			onSearchChange: vi.fn(),
			priority: undefined,
			onPriorityChange: vi.fn(),
			team: undefined,
			onTeamChange: vi.fn(),
			type: undefined,
			types: ["STORY", "TASK"],
			onTypeChange: vi.fn(),
			sort: "manual",
			onSortChange: vi.fn(),
			canCreateTasks: true,
			addLabel: "Add story",
			templates: KANBAN_TASK_TEMPLATES,
			onAddTask: vi.fn(),
			onAddFromTemplate: vi.fn(),
			onImportCsv: vi.fn(),
			...overrides,
		};
	}

	it("switches boards and views, searches and adds an item through its callbacks", () => {
		const toolbar = props();
		render(<KanbanToolbar {...toolbar} />, { wrapper: UiKitTestProviders });

		fireEvent.click(screen.getByRole("tab", { name: "Planning" }));
		fireEvent.click(screen.getByRole("tab", { name: "Hierarchy" }));
		fireEvent.change(screen.getByRole("searchbox", { name: "Search items" }), { target: { value: "ship" } });
		fireEvent.click(screen.getByRole("button", { name: "Add story" }));

		expect(toolbar.onBoardChange).toHaveBeenCalledWith("planning");
		expect(toolbar.onViewChange).toHaveBeenCalledWith("hierarchy");
		expect(toolbar.onSearchChange).toHaveBeenCalledWith("ship");
		expect(toolbar.onAddTask).toHaveBeenCalledTimes(1);
		expect(screen.getByRole("button", { name: "Group by" })).toBeDefined();
	});

	it("names the level the board is grouped by, and hides the board switch and the sort in the Hierarchy view", () => {
		const { rerender } = render(<KanbanToolbar {...props({ lanes: "story" })} />, { wrapper: UiKitTestProviders });
		expect(screen.getByRole("button", { name: "Group: Story" })).toBeDefined();

		rerender(<KanbanToolbar {...props({ view: "hierarchy" })} />);
		expect(screen.queryByRole("tab", { name: "Planning" })).toBeNull();
		expect(screen.queryByRole("button", { name: "Sort" })).toBeNull();
		expect(screen.queryByRole("button", { name: /^Group/ })).toBeNull();
	});

	it("counts the active filters and hides the add button without CREATE", () => {
		render(<KanbanToolbar {...props({ priority: "HIGH", team: "QA", type: "TASK", canCreateTasks: false })} />, { wrapper: UiKitTestProviders });

		expect(screen.getByRole("button", { name: /Filter/ }).textContent).toContain("3");
		expect(screen.queryByRole("button", { name: "Add story" })).toBeNull();
	});
});
