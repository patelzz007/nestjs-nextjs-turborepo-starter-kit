// @vitest-environment jsdom
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { cleanup, fireEvent, render, screen, within } from "@testing-library/react";
import { CapabilitiesProvider } from "@workspace/client/lib/contexts/authorization";
import {
	KanbanActivitySchema,
	KanbanBoardSchema,
	KanbanCommentSchema,
	KanbanTaskDetailSchema,
	PERMISSION,
	type CapabilitySlug,
	type KanbanActivity,
	type KanbanBoard,
	type KanbanComment,
	type KanbanItemSummary,
	type KanbanTaskDetail,
} from "@workspace/shared";
import { ClientTestProviders } from "@workspace/client/testing/client-test-providers";
import * as React from "react";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

import { AdminBreadcrumbProvider } from "@/components/common/admin-breadcrumb";

import { KanbanBoardView } from "../kanban-board-view";
import { KanbanTaskDetailView } from "../kanban-task-detail-view";

interface MutationStub {
	readonly mutate: () => void;
	readonly mutateAsync: () => Promise<void>;
	readonly isPending: boolean;
}

const { prefetchBoard } = vi.hoisted(() => ({ prefetchBoard: vi.fn<(input: { readonly board: string }) => void>() }));

const { BOARD, DETAIL, COMMENTS, ACTIVITY } = vi.hoisted(() => {
	const owner = { id: "0199d0c0-0000-7000-8000-000000000001", name: "Carol White" };
	const tally = { done: 0, total: 0 };
	const feature = { id: "0199d0c0-0000-7000-8000-0000000000b1", key: "FEATURE-3", type: "FEATURE", title: "Staff boards", startAt: null, dueAt: null };
	const card = {
		id: "0199d0c0-0000-7000-8000-0000000000c1",
		key: "STORY-12",
		columnId: "0199d0c0-0000-7000-8000-0000000000a1",
		type: "STORY",
		title: "Ship the board",
		description: "Drag and drop",
		priority: "HIGH",
		team: "QA",
		labels: ["kanban"],
		parentId: feature.id,
		ancestors: [feature],
		startAt: null,
		dueAt: null,
		storyPoints: 5,
		progress: 30,
		owner,
		assignee: owner,
		rollup: { children: { done: 1, total: 2 }, points: { done: 5, total: 5 } },
		steps: tally,
		acceptanceCriteria: { done: 1, total: 2 },
		isBlocked: false,
		counts: { comments: 1, attachments: 0, documents: 1 },
		version: 2,
		createdAt: 1_792_000_000_000,
		updatedAt: 1_792_000_000_000,
	};
	const other = {
		...card,
		id: "0199d0c0-0000-7000-8000-0000000000c2",
		key: "STORY-13",
		title: "Write the docs",
		priority: "LOW",
		team: "DATA",
		ancestors: [],
		parentId: null,
	};
	const column = { id: card.columnId, board: "EXECUTION", title: "To Do", state: "TODO" };
	const childTask = {
		id: "0199d0c0-0000-7000-8000-0000000000c3",
		key: "TASK-4",
		type: "TASK",
		title: "Wire the API",
		priority: "MEDIUM",
		storyPoints: null,
		assignee: null,
		column,
	};
	return {
		BOARD: {
			board: "EXECUTION",
			columns: [
				{ ...column, wipLimit: 1, version: 0, tasks: [card, other] },
				{ id: "0199d0c0-0000-7000-8000-0000000000a2", board: "EXECUTION", title: "Done", state: "DONE", wipLimit: null, version: 0, tasks: [] },
			],
		},
		DETAIL: {
			...card,
			column,
			children: [childTask],
			links: [
				{
					id: "0199d0c0-0000-7000-8000-0000000000d9",
					kind: "BLOCKS",
					item: { ...childTask, id: "0199d0c0-0000-7000-8000-0000000000c4", type: "STORY", title: "Activity timeline" },
				},
			],
			stepItems: [],
			acceptanceCriterionItems: [
				{ id: "0199d0c0-0000-7000-8000-0000000000e7", title: "Cards move between columns", isDone: true },
				{ id: "0199d0c0-0000-7000-8000-0000000000e8", title: "Order survives a reload", isDone: false },
			],
			watchers: [owner],
			isWatching: true,
			attachments: [
				{
					id: "0199d0c0-0000-7000-8000-0000000000e1",
					fileId: "0199d0c0-0000-7000-8000-0000000000e2",
					commentId: null,
					kind: "DOCUMENT",
					fileName: "plan.pdf",
					mimeType: "application/pdf",
					sizeBytes: 2048,
					uploadedBy: owner,
					createdAt: 1_792_000_000_000,
				},
			],
		},
		COMMENTS: [
			{
				id: "0199d0c0-0000-7000-8000-0000000000d1",
				taskId: card.id,
				body: "Looks good",
				author: owner,
				attachments: [
					{
						id: "0199d0c0-0000-7000-8000-0000000000e5",
						fileId: "0199d0c0-0000-7000-8000-0000000000e6",
						commentId: "0199d0c0-0000-7000-8000-0000000000d1",
						kind: "ATTACHMENT",
						fileName: "sketch.png",
						mimeType: "image/png",
						sizeBytes: 1024,
						uploadedBy: owner,
						createdAt: 1_792_000_000_000,
					},
				],
				createdAt: 1_792_000_000_000,
			},
		],
		ACTIVITY: [
			{ id: "0199d0c0-0000-7000-8000-0000000000d2", taskId: card.id, kind: "MOVED", field: null, from: "To Do", to: "Review", actor: owner, createdAt: 1_792_000_000_000 },
		],
	};
});

vi.mock("next/navigation", () => ({
	useRouter: (): { readonly push: () => void; readonly replace: () => void } => ({ push: () => undefined, replace: () => undefined }),
	usePathname: (): string => window.location.pathname,
}));

vi.mock("@workspace/client/lib/contexts/identity", () => {
	const mutation: MutationStub = { mutate: () => undefined, mutateAsync: () => Promise.resolve(), isPending: false };
	const mutationHook = { useMutation: (): MutationStub => mutation, useIdempotentMutation: (): MutationStub => mutation };
	const board = KanbanBoardSchema.parse(BOARD);
	const detail = KanbanTaskDetailSchema.parse(DETAIL);
	const comments = COMMENTS.map((comment) => KanbanCommentSchema.parse(comment));
	const activity = ACTIVITY.map((entry) => KanbanActivitySchema.parse(entry));
	const meta = { correlationId: "test", timestamp: 1_792_000_000_000, page: 1, limit: 20, total: 1, totalPages: 1, hasNext: false, hasPrevious: false, nextCursor: null };
	const page = <T,>(
		data: readonly T[],
	): { readonly data: { readonly data: readonly T[]; readonly meta: typeof meta }; readonly isError: boolean; readonly isLoading: boolean; readonly isFetching: boolean } => ({
		data: { data, meta },
		isError: false,
		isLoading: false,
		isFetching: false,
	});
	const api = {
		kanban: {
			board: {
				useQuery: (): { readonly data: { readonly data: KanbanBoard }; readonly isError: boolean; readonly refetch: () => void } => ({
					data: { data: board },
					isError: false,
					refetch: () => undefined,
				}),
				usePrefetch: (): typeof prefetchBoard => prefetchBoard,
			},
			task: { useQuery: (): { readonly data: { readonly data: KanbanTaskDetail }; readonly isError: boolean } => ({ data: { data: detail }, isError: false }) },
			comments: { useQuery: (): ReturnType<typeof page<KanbanComment>> => page(comments) },
			activity: { useQuery: (): ReturnType<typeof page<KanbanActivity>> => page(activity) },
			people: {
				useQuery: (): { readonly data: { readonly data: { readonly people: readonly (typeof DETAIL.owner)[] } } } => ({ data: { data: { people: [DETAIL.owner] } } }),
			},
			items: { useQuery: (): ReturnType<typeof page<KanbanItemSummary>> => page<KanbanItemSummary>([]) },
			search: {
				useQuery: (): { readonly data: { readonly data: { readonly results: readonly [] } }; readonly isFetching: boolean } => ({
					data: { data: { results: [] } },
					isFetching: false,
				}),
			},
			moveToParent: mutationHook,
			attachmentDownload: { fetchOrThrow: (): Promise<void> => Promise.resolve() },
			moveTask: mutationHook,
			moveColumn: mutationHook,
			updateColumn: mutationHook,
			createTask: mutationHook,
			importTasks: mutationHook,
			deleteTask: mutationHook,
			removeAttachment: mutationHook,
			addComment: mutationHook,
			attachFile: mutationHook,
			addLink: mutationHook,
			removeLink: mutationHook,
			setChecklistItem: mutationHook,
			watch: mutationHook,
			unwatch: mutationHook,
		},
	};
	const auth = {
		preferences: {
			useQuery: (): { readonly data: { readonly data: { readonly preferences: readonly [] } } } => ({ data: { data: { preferences: [] } } }),
		},
		setPreference: mutationHook,
		resetPreference: mutationHook,
	};
	return {
		useAuth: (): { readonly api: typeof api & { readonly auth: typeof auth }; readonly user: { readonly id: string; readonly fullName: string } } => ({
			api: { ...api, auth },
			user: { id: "0199d0c0-0000-7000-8000-000000000001", fullName: "Carol White" },
		}),
	};
});

function renderWith(capabilities: readonly CapabilitySlug[], node: React.ReactNode): void {
	render(
		<QueryClientProvider client={new QueryClient()}>
			<AdminBreadcrumbProvider pathname={window.location.pathname}>
				<CapabilitiesProvider capabilities={capabilities}>{node}</CapabilitiesProvider>
			</AdminBreadcrumbProvider>
		</QueryClientProvider>,
		{ wrapper: ClientTestProviders },
	);
}

const BOARD_PATH = "/components/kanban-board";
const EVERYTHING: readonly CapabilitySlug[] = [
	PERMISSION.KANBAN_TASK.LIST,
	PERMISSION.KANBAN_TASK.READ,
	PERMISSION.KANBAN_TASK.CREATE,
	PERMISSION.KANBAN_TASK.UPDATE,
	PERMISSION.KANBAN_TASK.DELETE,
	PERMISSION.KANBAN_BOARD.UPDATE,
];

beforeEach(() => {
	window.history.replaceState(null, "", BOARD_PATH);
});

afterEach(() => {
	cleanup();
	prefetchBoard.mockReset();
});

describe("KanbanBoardView", () => {
	it("fetches the other board ahead when the pointer or keyboard focus reaches its tab, never the open one", () => {
		renderWith(EVERYTHING, <KanbanBoardView />);

		fireEvent.pointerEnter(screen.getByRole("tab", { name: /Planning/ }));
		fireEvent.focus(screen.getByRole("tab", { name: /Execution/ }));

		expect(prefetchBoard.mock.calls).toEqual([[{ board: "PLANNING" }]]);
	});

	it("draws each column with its count, its WIP against the limit, and its cards", () => {
		window.history.replaceState(null, "", `${BOARD_PATH}?lanes=none`);
		renderWith(EVERYTHING, <KanbanBoardView />);

		const todo = screen.getByRole("region", { name: "To Do" });
		expect(within(todo).getByText("2 items")).toBeDefined();
		expect(within(todo).getByText("2/1")).toBeDefined();
		expect(within(todo).getByRole("article", { name: /Story STORY-12 Ship the board/ })).toBeDefined();
		expect(within(todo).getByRole("link", { name: "Ship the board" }).getAttribute("href")).toBe(`${BOARD_PATH}/tasks/${DETAIL.id}`);
		expect(within(screen.getByRole("region", { name: "Done" })).getByText("0 items")).toBeDefined();
	});

	it("offers adding and rearranging only with the permissions the API asks for", () => {
		renderWith([PERMISSION.KANBAN_TASK.LIST], <KanbanBoardView />);

		expect(screen.queryByRole("button", { name: "Add story" })).toBeNull();
		expect(screen.queryByRole("button", { name: "Add task to To Do" })).toBeNull();
		expect(screen.queryByRole("button", { name: "Drag To Do column" })).toBeNull();
	});

	it("filters the cards with the URL's search, which also matches a parent's title", () => {
		window.history.replaceState(null, "", `${BOARD_PATH}?search=docs`);
		renderWith(EVERYTHING, <KanbanBoardView />);
		expect(screen.queryByText("Ship the board")).toBeNull();
		expect(screen.getByText("Write the docs")).toBeDefined();
		cleanup();

		window.history.replaceState(null, "", `${BOARD_PATH}?search=staff`);
		renderWith(EVERYTHING, <KanbanBoardView />);
		expect(screen.getByText("Ship the board")).toBeDefined();
		expect(screen.queryByText("Write the docs")).toBeNull();
	});

	it("opens what sits below a card right on the card", () => {
		renderWith(EVERYTHING, <KanbanBoardView />);

		const card = screen.getByRole("link", { name: "Ship the board" }).closest("article");
		if (card === null) {
			throw new Error("the card is missing");
		}
		const expander = within(card).getByRole("button", { name: /2 tasks/ });
		fireEvent.click(expander);

		expect(expander.getAttribute("aria-expanded")).toBe("true");
		expect(within(screen.getByRole("list", { name: "Items under Ship the board" })).getByRole("link", { name: "Wire the API" })).toBeDefined();
	});

	it("splits the board into swimlanes by feature, cards without one last", () => {
		window.history.replaceState(null, "", `${BOARD_PATH}?lanes=feature`);
		renderWith(EVERYTHING, <KanbanBoardView />);

		const lanes = screen.getAllByRole("region", { name: /^Feature: / }).map((lane) => lane.getAttribute("aria-label"));
		expect(lanes).toEqual(["Feature: Staff boards", "Feature: No feature"]);
		expect(within(screen.getByRole("region", { name: "Feature: Staff boards" })).getByText("Ship the board")).toBeDefined();
	});

	it("groups by story, each lane naming its story's status, and folds every lane at once", () => {
		window.history.replaceState(null, "", `${BOARD_PATH}?lanes=story`);
		renderWith(EVERYTHING, <KanbanBoardView />);

		const lane = screen.getByRole("region", { name: "Story: Ship the board" });
		expect(within(lane).getByText("To Do")).toBeDefined();
		fireEvent.click(screen.getByRole("button", { name: "Collapse all" }));
		expect(screen.getByRole("button", { name: "Expand Ship the board" }).getAttribute("aria-expanded")).toBe("false");
		// Only the lane bars' own links are left: the cards are folded away.
		expect(screen.getAllByRole("link", { name: "Ship the board" })).toHaveLength(1);
		expect(screen.queryByRole("article")).toBeNull();
	});

	it("shows both boards as one tree in the Hierarchy view, narrowed by the search", () => {
		window.history.replaceState(null, "", `${BOARD_PATH}?view=hierarchy`);
		renderWith(EVERYTHING, <KanbanBoardView />);

		const tree = screen.getByRole("table", { name: "Hierarchy" });
		expect(within(tree).getByRole("link", { name: "Ship the board" })).toBeDefined();
		expect(within(tree).getByRole("link", { name: "Write the docs" })).toBeDefined();
		expect(screen.getByText("2 items")).toBeDefined();
		cleanup();

		window.history.replaceState(null, "", `${BOARD_PATH}?view=hierarchy&search=docs`);
		renderWith(EVERYTHING, <KanbanBoardView />);
		expect(within(screen.getByRole("table", { name: "Hierarchy" })).queryByRole("link", { name: "Ship the board" })).toBeNull();
	});

	it("shows the table the URL asks for", () => {
		window.history.replaceState(null, "", `${BOARD_PATH}?view=table`);
		renderWith(EVERYTHING, <KanbanBoardView />);

		expect(screen.getByRole("columnheader", { name: "Assignee" })).toBeDefined();
		expect(screen.queryByRole("region", { name: "To Do" })).toBeNull();
	});

	it("groups the execution board by feature until someone chooses otherwise, with the active features above it", () => {
		renderWith(EVERYTHING, <KanbanBoardView />);

		expect(screen.getByRole("button", { name: "Group: Feature" })).toBeDefined();
		expect(screen.getByRole("region", { name: "Feature: Staff boards" })).toBeDefined();
		expect(screen.getByRole("region", { name: "Feature: No feature" })).toBeDefined();
		const strip = screen.getByRole("region", { name: "Active features" });
		expect(within(strip).getByRole("button", { name: /FEATURE-3/ })).toBeDefined();
	});

	it("opens the add dialog for the column whose + was pressed", () => {
		window.history.replaceState(null, "", `${BOARD_PATH}?lanes=none`);
		renderWith(EVERYTHING, <KanbanBoardView />);

		fireEvent.click(screen.getByRole("button", { name: "Add task to Done" }));

		const dialog = screen.getByRole("dialog");
		expect(within(dialog).getByRole("heading", { name: "Add story" })).toBeDefined();
		expect(within(dialog).getByText("Done")).toBeDefined();
	});
});

describe("KanbanTaskDetailView", () => {
	it("shows where the item sits, its properties and how far it has got, and its checklist, children, links, files, discussion and history", () => {
		renderWith(EVERYTHING, <KanbanTaskDetailView taskId={DETAIL.id} />);

		expect(screen.getByRole("heading", { name: "Ship the board" })).toBeDefined();
		expect(within(screen.getByRole("navigation", { name: "Hierarchy" })).getByRole("link", { name: /Staff boards/ })).toBeDefined();
		expect(screen.getByText("Tasks done")).toBeDefined();
		expect(screen.getByText("Reporter")).toBeDefined();
		expect(within(screen.getByRole("group", { name: "Watchers" })).getByRole("img", { name: "Carol White" })).toBeDefined();
		expect(screen.getByText("Criteria met")).toBeDefined();
		expect(screen.getByRole("checkbox", { name: "Cards move between columns done" })).toBeDefined();
		expect(screen.getByRole("link", { name: "Wire the API" })).toBeDefined();
		expect(screen.getByRole("link", { name: "Activity timeline" })).toBeDefined();
		expect(screen.getByText("plan.pdf")).toBeDefined();
		expect(within(screen.getByRole("article", { name: "Comment by Carol White" })).getByText("Looks good")).toBeDefined();
		expect(screen.getByRole("button", { name: "Actions for the comment by Carol White" })).toBeDefined();
		expect(within(screen.getByRole("list", { name: "Files posted by Carol White" })).getByRole("button", { name: "Download sketch.png" })).toBeDefined();
		expect(screen.getByRole("button", { name: "Attach files" })).toBeDefined();
		fireEvent.click(screen.getByRole("button", { name: "History" }));
		expect(screen.getByText("moved this from To Do to Review")).toBeDefined();
		expect(screen.getByRole("link", { name: "Edit story" }).getAttribute("href")).toBe(`${BOARD_PATH}/tasks/${DETAIL.id}/edit`);
		expect(screen.getByRole("button", { name: "Delete" })).toBeDefined();
		expect(screen.getByRole("button", { name: /Unwatch/ })).toBeDefined();
		expect(screen.getByRole("button", { name: "Add task" })).toBeDefined();
	});

	it("is read-only without UPDATE, DELETE and CREATE", () => {
		renderWith([PERMISSION.KANBAN_TASK.READ, PERMISSION.KANBAN_TASK.LIST], <KanbanTaskDetailView taskId={DETAIL.id} />);

		expect(screen.queryByRole("link", { name: "Edit story" })).toBeNull();
		expect(screen.queryByRole("button", { name: "Delete" })).toBeNull();
		expect(screen.queryByRole("button", { name: "Attach file" })).toBeNull();
		expect(screen.queryByRole("button", { name: "Add task" })).toBeNull();
		expect(screen.queryByRole("button", { name: "Link" })).toBeNull();
		expect(screen.queryByRole("textbox", { name: "Comment" })).toBeNull();
		const criterion = screen.getByRole("checkbox", { name: "Cards move between columns done" });
		expect(criterion.hasAttribute("data-disabled")).toBe(true);
		expect(screen.getByRole("button", { name: "Download plan.pdf" })).toBeDefined();
	});
});
