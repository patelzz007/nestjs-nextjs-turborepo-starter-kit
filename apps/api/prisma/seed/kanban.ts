// ============================================
// prisma/seed/kanban.ts — the platform staff's two linked kanban boards (development scenario)
// ============================================
// A PLANNING board (epics and features, in planning stages) and an EXECUTION
// board (stories, their tasks and the tasks' subtasks, in work states), joined
// by each item's parent, written the way the API writes them: positions
// contiguous from 0 per board (columns) and per column (items), every item
// keyed from its level's counter in creation order (`STORY-7`), story points on
// stories only, dates on everything above a task, attachments as READY
// `KANBAN_TASK_ATTACHMENT` files of their uploader (stored through the
// configured storage provider; a PDF counts as a document, an image as an
// attachment). Every item has its reporter as a watcher and a history; subtasks
// carry nested steps, features and stories acceptance criteria; a few items are
// linked, and three staff members keep board preferences. The board's remove
// actions leave their marks: one deleted item, one removed attachment, step,
// link, watch and preference.
// Idempotent: every row is upserted on a deterministic id; a re-run converges.

import type {
	KanbanActivityField,
	KanbanActivityKind,
	KanbanAttachmentKind,
	KanbanBoardKind,
	KanbanChecklistKind,
	KanbanItemType,
	KanbanLinkKind,
	KanbanPlanningStage,
	KanbanTaskPriority,
	KanbanTeam,
	KanbanWorkState,
	Prisma,
} from "@prisma/client";
import { DAY_MS, kanbanItemKey, type UserPreferenceKey, type UserPreferenceValue } from "@workspace/shared";

import { prisma } from "./client";
import { deterministicUuid } from "./deterministic-uuid";
import { PDF_BYTES, PNG_BYTES } from "./files";
import { requireRow } from "./require-row";
import { createSeedFileWriter, type SeedFileWriter, type SeedObject, type StoredSeedObject } from "./stored-file-seed-writer";

const NAMESPACE = "kanban-seed";
const MS_PER_HOUR = 60 * 60 * 1000;
/** How far apart an item's comments were written. */
const COMMENT_SPACING_HOURS = 5;
/** How many days before the seed run every item was created (its first history entry). */
const CREATED_DAYS_AGO = 21;

const ADMIN = "admin@example.com";
const MANAGER = "manager@example.com";
const SUPERADMIN = "superadmin@example.com";
const ALICE = "alice.johnson@example.com";
const CAROL = "carol.white@example.com";
const EVE = "eve.davis@example.com";
const FRANK = "frank.miller@example.com";

/** The seeded staff who report, work on, comment on and attach to the board's items. */
const STAFF_EMAILS: readonly string[] = [ADMIN, MANAGER, SUPERADMIN, ALICE, CAROL, EVE, FRANK];

interface PlanningColumnSeed {
	readonly key: string;
	readonly title: string;
	readonly stage: KanbanPlanningStage;
}

interface ExecutionColumnSeed {
	readonly key: string;
	readonly title: string;
	readonly state: KanbanWorkState;
	readonly wipLimit: number | null;
}

/** The planning board's stages, left to right (planning has no WIP limit). */
const PLANNING_COLUMNS: readonly PlanningColumnSeed[] = [
	{ key: "ideas", title: "Backlog", stage: "BACKLOG" },
	{ key: "plan-refining", title: "Refining", stage: "REFINING" },
	{ key: "plan-ready", title: "Ready", stage: "READY" },
	{ key: "plan-in-progress", title: "Planned", stage: "PLANNED" },
	{ key: "plan-done", title: "Delivered", stage: "DELIVERED" },
];

/** The execution board's work states, left to right; the WIP limits count stories and tasks. */
const EXECUTION_COLUMNS: readonly ExecutionColumnSeed[] = [
	{ key: "planned", title: "To Do", state: "TODO", wipLimit: null },
	{ key: "building", title: "In Progress", state: "IN_PROGRESS", wipLimit: 4 },
	{ key: "qa", title: "Review", state: "REVIEW", wipLimit: 3 },
	{ key: "shipped", title: "Done", state: "DONE", wipLimit: null },
];

interface ItemSeed {
	readonly key: string;
	readonly column: string;
	readonly type: KanbanItemType;
	readonly parent: string | null;
	readonly title: string;
	readonly description: string;
	readonly priority: KanbanTaskPriority;
	readonly team: KanbanTeam;
	readonly labels: readonly string[];
	/** Days from the seed run (negative: already past); `null` for none — always `null` on a task. */
	readonly startInDays: number | null;
	readonly dueInDays: number | null;
	readonly storyPoints: number | null;
	readonly progress: number;
	readonly owner: string;
	readonly assignee: string | null;
	readonly comments: number;
	/** Image attachments, then PDF documents. */
	readonly images: number;
	readonly documents: number;
}

/** Top to bottom within each column; a parent always comes before its children. */
const ITEMS: readonly ItemSeed[] = [
	// ── Planning board: epics ──
	{
		key: "multi-tenancy",
		column: "plan-in-progress",
		type: "EPIC",
		parent: null,
		title: "Multi-tenant platform",
		description: "Everything a merchant tenant needs to run safely side by side with the others: isolation, exports, uploads and observability.",
		priority: "HIGH",
		team: "PLATFORM",
		labels: ["q4", "foundations"],
		startInDays: -40,
		dueInDays: 50,
		storyPoints: null,
		progress: 55,
		owner: ADMIN,
		assignee: ADMIN,
		comments: 6,
		images: 0,
		documents: 3,
	},
	{
		key: "staff-kanban",
		column: "plan-in-progress",
		type: "EPIC",
		parent: null,
		title: "Staff productivity",
		description: "Tools the platform team uses every day: the kanban boards, the audit timeline and GitHub in the admin panel.",
		priority: "MEDIUM",
		team: "PRODUCT",
		labels: ["q4", "internal-tools"],
		startInDays: -30,
		dueInDays: 35,
		storyPoints: null,
		progress: 60,
		owner: MANAGER,
		assignee: MANAGER,
		comments: 11,
		images: 2,
		documents: 2,
	},
	{
		key: "guardduty-scanning",
		column: "plan-ready",
		type: "EPIC",
		parent: null,
		title: "Security hardening",
		description: "Close the gaps the last review found: malware scanning, session revocation and referral fraud.",
		priority: "HIGH",
		team: "SECURITY",
		labels: ["security", "q4"],
		startInDays: -5,
		dueInDays: 60,
		storyPoints: null,
		progress: 20,
		owner: SUPERADMIN,
		assignee: SUPERADMIN,
		comments: 9,
		images: 2,
		documents: 1,
	},
	{
		key: "epic-merchant-growth",
		column: "ideas",
		type: "EPIC",
		parent: null,
		title: "Merchant growth",
		description: "Help a new merchant get to their first published reward faster, and keep claim holders coming back.",
		priority: "MEDIUM",
		team: "PRODUCT",
		labels: ["growth"],
		startInDays: 30,
		dueInDays: 120,
		storyPoints: null,
		progress: 0,
		owner: MANAGER,
		assignee: null,
		comments: 2,
		images: 0,
		documents: 0,
	},
	// ── Planning board: features ──
	{
		key: "onboarding-checklist",
		column: "ideas",
		type: "FEATURE",
		parent: "epic-merchant-growth",
		title: "Merchant onboarding checklist",
		description: "Guide a new merchant from the invite to their first published reward with a progress checklist.",
		priority: "MEDIUM",
		team: "PRODUCT",
		labels: ["onboarding"],
		startInDays: 30,
		dueInDays: 60,
		storyPoints: null,
		progress: 0,
		owner: MANAGER,
		assignee: ALICE,
		comments: 5,
		images: 1,
		documents: 0,
	},
	{
		key: "chart-palette-review",
		column: "ideas",
		type: "FEATURE",
		parent: "staff-kanban",
		title: "Accessible charts",
		description: "Check every categorical chart colour against both themes for AA contrast.",
		priority: "LOW",
		team: "DESIGN",
		labels: ["accessibility"],
		startInDays: 20,
		dueInDays: 45,
		storyPoints: null,
		progress: 0,
		owner: EVE,
		assignee: EVE,
		comments: 2,
		images: 0,
		documents: 0,
	},
	{
		key: "expiry-reminders",
		column: "plan-refining",
		type: "FEATURE",
		parent: "epic-merchant-growth",
		title: "Reward expiry reminders",
		description: "Email claim holders three days before a reward they hold expires, through the outbox.",
		priority: "MEDIUM",
		team: "BACKEND",
		labels: ["email", "retention"],
		startInDays: 14,
		dueInDays: 40,
		storyPoints: null,
		progress: 5,
		owner: CAROL,
		assignee: CAROL,
		comments: 3,
		images: 0,
		documents: 1,
	},
	{
		key: "multipart-uploads",
		column: "plan-refining",
		type: "FEATURE",
		parent: "multi-tenancy",
		title: "Multipart uploads for large files",
		description: "Chunked S3 multipart uploads so only failed parts retry, lifting the 10 MB single-request cap.",
		priority: "HIGH",
		team: "PLATFORM",
		labels: ["storage", "tech-debt"],
		startInDays: 7,
		dueInDays: 30,
		storyPoints: null,
		progress: 10,
		owner: ADMIN,
		assignee: FRANK,
		comments: 3,
		images: 0,
		documents: 1,
	},
	{
		key: "tenant-data-export",
		column: "plan-ready",
		type: "FEATURE",
		parent: "multi-tenancy",
		title: "Tenant data export",
		description: "Let a merchant owner download every record of their tenant as one archive.",
		priority: "HIGH",
		team: "BACKEND",
		labels: ["gdpr"],
		startInDays: 2,
		dueInDays: 28,
		storyPoints: null,
		progress: 15,
		owner: FRANK,
		assignee: FRANK,
		comments: 6,
		images: 1,
		documents: 1,
	},
	{
		key: "feature-pos-observability",
		column: "plan-ready",
		type: "FEATURE",
		parent: "multi-tenancy",
		title: "POS observability",
		description: "Show merchants and staff how their paired terminals are doing, store by store.",
		priority: "MEDIUM",
		team: "PLATFORM",
		labels: ["pos"],
		startInDays: 5,
		dueInDays: 32,
		storyPoints: null,
		progress: 0,
		owner: MANAGER,
		assignee: MANAGER,
		comments: 1,
		images: 0,
		documents: 0,
	},
	{
		key: "board-activity-feed",
		column: "plan-in-progress",
		type: "FEATURE",
		parent: "staff-kanban",
		title: "Kanban boards for staff",
		description: "Two linked boards — planning and execution — with the epic-to-task hierarchy, story points, WIP limits and an activity timeline.",
		priority: "HIGH",
		team: "PRODUCT",
		labels: ["kanban"],
		startInDays: -14,
		dueInDays: 14,
		storyPoints: null,
		progress: 60,
		owner: ADMIN,
		assignee: ADMIN,
		comments: 4,
		images: 1,
		documents: 0,
	},
	{
		key: "session-revocation",
		column: "plan-in-progress",
		type: "FEATURE",
		parent: "guardduty-scanning",
		title: "Session hardening",
		description: "A revoked session loses access within one sweep on every API instance.",
		priority: "HIGH",
		team: "SECURITY",
		labels: ["security", "auth"],
		startInDays: -7,
		dueInDays: 21,
		storyPoints: null,
		progress: 45,
		owner: SUPERADMIN,
		assignee: CAROL,
		comments: 7,
		images: 1,
		documents: 2,
	},
	{
		key: "feature-fraud",
		column: "plan-in-progress",
		type: "FEATURE",
		parent: "guardduty-scanning",
		title: "Referral fraud detection",
		description: "Spot referral rings early and hold their rewards for review.",
		priority: "HIGH",
		team: "SECURITY",
		labels: ["fraud"],
		startInDays: -3,
		dueInDays: 30,
		storyPoints: null,
		progress: 25,
		owner: CAROL,
		assignee: CAROL,
		comments: 2,
		images: 0,
		documents: 0,
	},
	{
		key: "feature-reward-media",
		column: "plan-in-progress",
		type: "FEATURE",
		parent: "epic-merchant-growth",
		title: "Reward media",
		description: "Merchants upload, crop and preview the images their rewards show.",
		priority: "MEDIUM",
		team: "DESIGN",
		labels: ["media"],
		startInDays: -10,
		dueInDays: 12,
		storyPoints: null,
		progress: 70,
		owner: EVE,
		assignee: EVE,
		comments: 3,
		images: 2,
		documents: 0,
	},
	{
		key: "unified-audit",
		column: "plan-done",
		type: "FEATURE",
		parent: "staff-kanban",
		title: "Unified audit timeline",
		description: "Requests and row changes in one grouped timeline on the audit log page.",
		priority: "MEDIUM",
		team: "DATA",
		labels: ["audit"],
		startInDays: -45,
		dueInDays: -12,
		storyPoints: null,
		progress: 100,
		owner: MANAGER,
		assignee: ALICE,
		comments: 4,
		images: 2,
		documents: 0,
	},
	{
		key: "feature-github",
		column: "plan-done",
		type: "FEATURE",
		parent: "staff-kanban",
		title: "GitHub in the admin panel",
		description: "Link a GitHub account and work on pull requests without leaving the admin panel.",
		priority: "MEDIUM",
		team: "PLATFORM",
		labels: ["integrations"],
		startInDays: -40,
		dueInDays: -10,
		storyPoints: null,
		progress: 100,
		owner: CAROL,
		assignee: CAROL,
		comments: 1,
		images: 0,
		documents: 0,
	},
	// ── Execution board: stories ──
	{
		key: "terminal-health",
		column: "planned",
		type: "STORY",
		parent: "feature-pos-observability",
		title: "POS terminal health page",
		description: "List paired terminals with their last-seen time and failed validations per store.",
		priority: "MEDIUM",
		team: "PLATFORM",
		labels: ["pos", "ui"],
		startInDays: 5,
		dueInDays: 15,
		storyPoints: 5,
		progress: 0,
		owner: MANAGER,
		assignee: FRANK,
		comments: 5,
		images: 0,
		documents: 2,
	},
	{
		key: "story-export-archive",
		column: "planned",
		type: "STORY",
		parent: "tenant-data-export",
		title: "Download the tenant archive",
		description: "A merchant owner requests an export and gets a signed link to one archive when it is ready.",
		priority: "HIGH",
		team: "BACKEND",
		labels: ["gdpr", "jobs"],
		startInDays: 3,
		dueInDays: 20,
		storyPoints: 8,
		progress: 0,
		owner: FRANK,
		assignee: FRANK,
		comments: 2,
		images: 0,
		documents: 1,
	},
	{
		key: "story-wip-limits",
		column: "planned",
		type: "STORY",
		parent: "board-activity-feed",
		title: "WIP limits per column",
		description: "A column warns when it holds more items than its limit; managers set the limit from the column menu.",
		priority: "LOW",
		team: "PRODUCT",
		labels: ["kanban"],
		startInDays: 2,
		dueInDays: 9,
		storyPoints: 2,
		progress: 0,
		owner: ADMIN,
		assignee: null,
		comments: 1,
		images: 0,
		documents: 0,
	},
	{
		key: "story-board-hierarchy",
		column: "building",
		type: "STORY",
		parent: "board-activity-feed",
		title: "Epics, features and stories on two boards",
		description: "Plan epics and features on one board and run stories and tasks on another, linked by their parents.",
		priority: "HIGH",
		team: "PRODUCT",
		labels: ["kanban", "ui"],
		startInDays: -6,
		dueInDays: 6,
		storyPoints: 8,
		progress: 55,
		owner: ADMIN,
		assignee: ADMIN,
		comments: 6,
		images: 1,
		documents: 1,
	},
	{
		key: "referral-fraud-signals",
		column: "building",
		type: "STORY",
		parent: "feature-fraud",
		title: "Flag referral chains sharing a device",
		description: "Flag referral chains that share a device or payment fingerprint for manual review.",
		priority: "HIGH",
		team: "SECURITY",
		labels: ["fraud"],
		startInDays: -2,
		dueInDays: 12,
		storyPoints: 8,
		progress: 45,
		owner: CAROL,
		assignee: CAROL,
		comments: 8,
		images: 1,
		documents: 1,
	},
	{
		key: "offline-claim-states",
		column: "building",
		type: "STORY",
		parent: null,
		title: "Mobile offline claim states",
		description: "Design the offline, retrying and synced states of the mobile claim flow. Not planned under a feature yet.",
		priority: "MEDIUM",
		team: "DESIGN",
		labels: ["mobile"],
		startInDays: -4,
		dueInDays: 10,
		storyPoints: 3,
		progress: 30,
		owner: EVE,
		assignee: EVE,
		comments: 6,
		images: 0,
		documents: 2,
	},
	{
		key: "image-cropper-qa",
		column: "qa",
		type: "STORY",
		parent: "feature-reward-media",
		title: "Crop reward images to 16:9",
		description: "Verify the 16:9 crop, the blurred backdrop and the 4K cap across browsers before release.",
		priority: "HIGH",
		team: "QA",
		labels: ["media", "qa"],
		startInDays: -9,
		dueInDays: 3,
		storyPoints: 5,
		progress: 75,
		owner: FRANK,
		assignee: FRANK,
		comments: 10,
		images: 3,
		documents: 0,
	},
	{
		key: "story-revoke-sweep",
		column: "qa",
		type: "STORY",
		parent: "session-revocation",
		title: "Revoked sessions lose access within one sweep",
		description: "Confirm a revoked session loses access within one sweep on every API instance.",
		priority: "MEDIUM",
		team: "SECURITY",
		labels: ["auth"],
		startInDays: -8,
		dueInDays: 4,
		storyPoints: 5,
		progress: 60,
		owner: SUPERADMIN,
		assignee: CAROL,
		comments: 7,
		images: 1,
		documents: 2,
	},
	{
		key: "story-activity-timeline",
		column: "qa",
		type: "STORY",
		parent: "board-activity-feed",
		title: "Activity timeline on the item page",
		description: "Show who created, moved, edited, linked or commented on an item, newest first.",
		priority: "MEDIUM",
		team: "DATA",
		labels: ["kanban", "audit"],
		startInDays: -5,
		dueInDays: 5,
		storyPoints: 3,
		progress: 80,
		owner: ALICE,
		assignee: ALICE,
		comments: 4,
		images: 1,
		documents: 0,
	},
	{
		key: "audit-log-filters",
		column: "shipped",
		type: "STORY",
		parent: "unified-audit",
		title: "Filter the audit timeline by actor and outcome",
		description: "Filter the unified audit timeline by actor, entity and outcome, kept in the URL.",
		priority: "MEDIUM",
		team: "DATA",
		labels: ["audit", "ui"],
		startInDays: -30,
		dueInDays: -14,
		storyPoints: 5,
		progress: 100,
		owner: ALICE,
		assignee: ALICE,
		comments: 4,
		images: 2,
		documents: 0,
	},
	{
		key: "github-pull-requests",
		column: "shipped",
		type: "STORY",
		parent: "feature-github",
		title: "Review pull requests from the admin panel",
		description: "Review, comment on and merge pull requests from the admin panel with a linked token.",
		priority: "MEDIUM",
		team: "PLATFORM",
		labels: ["integrations"],
		startInDays: -25,
		dueInDays: -10,
		storyPoints: 8,
		progress: 100,
		owner: CAROL,
		assignee: CAROL,
		comments: 5,
		images: 0,
		documents: 2,
	},
	// ── Execution board: tasks (they follow their story's dates and carry no points) ──
	{
		key: "task-rollup-read",
		column: "planned",
		type: "TASK",
		parent: "story-board-hierarchy",
		title: "Story point rollups in the read model",
		description: "Sum each story's points up to its feature and epic, done points from done columns.",
		priority: "MEDIUM",
		team: "BACKEND",
		labels: ["kanban"],
		startInDays: null,
		dueInDays: null,
		storyPoints: null,
		progress: 0,
		owner: ADMIN,
		assignee: FRANK,
		comments: 0,
		images: 0,
		documents: 0,
	},
	{
		key: "task-export-worker",
		column: "planned",
		type: "TASK",
		parent: "story-export-archive",
		title: "Archive worker in the job queue",
		description: "Build the archive in a BullMQ job and store it as a private file.",
		priority: "HIGH",
		team: "BACKEND",
		labels: ["jobs"],
		startInDays: null,
		dueInDays: null,
		storyPoints: null,
		progress: 0,
		owner: FRANK,
		assignee: null,
		comments: 1,
		images: 0,
		documents: 0,
	},
	{
		key: "task-planning-board-ui",
		column: "building",
		type: "TASK",
		parent: "story-board-hierarchy",
		title: "Board switcher and swimlanes",
		description: "Switch between the planning and execution boards and group the cards by their epic or feature.",
		priority: "HIGH",
		team: "DESIGN",
		labels: ["kanban", "ui"],
		startInDays: null,
		dueInDays: null,
		storyPoints: null,
		progress: 40,
		owner: ADMIN,
		assignee: EVE,
		comments: 2,
		images: 1,
		documents: 0,
	},
	{
		key: "task-sweep-test",
		column: "building",
		type: "TASK",
		parent: "story-revoke-sweep",
		title: "Load test the revocation sweep",
		description: "Run the sweep against three API instances under load and record the worst-case delay.",
		priority: "MEDIUM",
		team: "QA",
		labels: ["auth", "qa"],
		startInDays: null,
		dueInDays: null,
		storyPoints: null,
		progress: 50,
		owner: SUPERADMIN,
		assignee: FRANK,
		comments: 1,
		images: 0,
		documents: 1,
	},
	{
		key: "task-schema-hierarchy",
		column: "shipped",
		type: "TASK",
		parent: "story-board-hierarchy",
		title: "Add parent and type to the item schema",
		description: "Item type, parent, story points, dates and labels in the schema, with the migration generated.",
		priority: "HIGH",
		team: "BACKEND",
		labels: ["kanban", "database"],
		startInDays: null,
		dueInDays: null,
		storyPoints: null,
		progress: 100,
		owner: ADMIN,
		assignee: ADMIN,
		comments: 2,
		images: 0,
		documents: 0,
	},
];

/** An item the board's delete action soft-deleted (positions of live items are unaffected). */
const DELETED_ITEM: ItemSeed = {
	key: "legacy-csv-export",
	column: "planned",
	type: "STORY",
	parent: "tenant-data-export",
	title: "Legacy CSV export",
	description: "Superseded by the tenant archive.",
	priority: "LOW",
	team: "BACKEND",
	labels: ["gdpr"],
	startInDays: null,
	dueInDays: 30,
	storyPoints: 3,
	progress: 0,
	owner: MANAGER,
	assignee: null,
	comments: 0,
	images: 0,
	documents: 0,
};

interface StepSeed {
	readonly title: string;
	/** 0 = sub-subtask, 1 = sub-sub-subtask. */
	readonly depth: number;
	readonly isDone: boolean;
	readonly assignee: string | null;
}

interface SubtaskSeed {
	readonly key: string;
	readonly task: string;
	readonly column: string;
	readonly title: string;
	readonly assignee: string | null;
	readonly steps: readonly StepSeed[];
}

/** Each task's subtasks (cards on the execution board), with their steps — levels 5 to 7 of the hierarchy. */
const SUBTASKS: readonly SubtaskSeed[] = [
	{
		key: "sub-model-hierarchy",
		task: "task-schema-hierarchy",
		column: "shipped",
		title: "Model the hierarchy",
		assignee: ADMIN,
		steps: [
			{ title: "Item type and parent columns", depth: 0, isDone: true, assignee: null },
			{ title: "Parent must be one level up", depth: 1, isDone: true, assignee: null },
			{ title: "Checklist, link, watcher and history tables", depth: 0, isDone: true, assignee: FRANK },
		],
	},
	{ key: "sub-generate-migration", task: "task-schema-hierarchy", column: "shipped", title: "Generate the migration", assignee: ADMIN, steps: [] },
	{ key: "sub-board-switcher", task: "task-planning-board-ui", column: "shipped", title: "Board switcher in the toolbar", assignee: EVE, steps: [] },
	{
		key: "sub-swimlanes",
		task: "task-planning-board-ui",
		column: "building",
		title: "Swimlanes",
		assignee: EVE,
		steps: [
			{ title: "Group by epic on the planning board", depth: 0, isDone: true, assignee: null },
			{ title: "Group by feature on the execution board", depth: 0, isDone: false, assignee: null },
			{ title: "Tasks follow their story's feature", depth: 1, isDone: false, assignee: ALICE },
		],
	},
	{ key: "sub-wip-header", task: "task-planning-board-ui", column: "planned", title: "WIP limit in the column header", assignee: null, steps: [] },
	{ key: "sub-three-instances", task: "task-sweep-test", column: "shipped", title: "Three instances behind the load balancer", assignee: FRANK, steps: [] },
	{
		key: "sub-request-burst",
		task: "task-sweep-test",
		column: "building",
		title: "Revoke during a request burst",
		assignee: FRANK,
		steps: [{ title: "Record the worst-case delay", depth: 0, isDone: false, assignee: null }],
	},
];

interface ChecklistRowSeed {
	readonly title: string;
	readonly depth: number;
	readonly isDone: boolean;
	readonly assignee: string | null;
}

interface ChecklistSeed {
	readonly item: string;
	readonly list: KanbanChecklistKind;
	readonly rows: readonly ChecklistRowSeed[];
}

/** Acceptance criteria on features and stories, and every subtask's steps. */
const CHECKLISTS: readonly ChecklistSeed[] = [
	...SUBTASKS.filter((subtask) => subtask.steps.length > 0).map((subtask): ChecklistSeed => ({ item: subtask.key, list: "STEPS", rows: subtask.steps })),
	{
		item: "story-board-hierarchy",
		list: "ACCEPTANCE_CRITERIA",
		rows: [
			{ title: "Epics and features live on the planning board", depth: 0, isDone: true, assignee: null },
			{ title: "Stories and tasks live on the execution board", depth: 0, isDone: true, assignee: null },
			{ title: "A task cannot be created without its story", depth: 0, isDone: true, assignee: null },
			{ title: "Features and epics show their stories' points", depth: 0, isDone: false, assignee: null },
		],
	},
	{
		item: "story-revoke-sweep",
		list: "ACCEPTANCE_CRITERIA",
		rows: [
			{ title: "Access ends within one sweep interval", depth: 0, isDone: true, assignee: null },
			{ title: "Works with Redis unavailable", depth: 0, isDone: false, assignee: null },
		],
	},
	{
		item: "board-activity-feed",
		list: "ACCEPTANCE_CRITERIA",
		rows: [
			{ title: "Two boards linked by parent", depth: 0, isDone: true, assignee: null },
			{ title: "Every change appears in the item's history", depth: 0, isDone: false, assignee: null },
		],
	},
	{
		item: "terminal-health",
		list: "ACCEPTANCE_CRITERIA",
		rows: [{ title: "A terminal unseen for an hour is flagged", depth: 0, isDone: false, assignee: null }],
	},
];

/** A file posted with a comment, by the comment's author. */
const COMMENTED_FILE = { item: "story-board-hierarchy", commentIndex: 2, fileName: "board-swimlanes-sketch.png" };

/** A step the edit page removed (soft-deleted), as the board's checklist edit leaves it. */
const REMOVED_STEP = { item: "sub-request-burst", title: "Use the old sweep script", remover: SUPERADMIN };

/** Board preferences three staff members keep (one reset to the default, soft-deleted), as the board's Group by and Show subtasks menus write them. */
const PREFERENCES: readonly { readonly email: string; readonly key: UserPreferenceKey; readonly value: UserPreferenceValue; readonly reset: boolean }[] = [
	{ email: ADMIN, key: "board.execution.groupBy", value: "story", reset: false },
	{ email: ADMIN, key: "board.execution.showSubtasks", value: true, reset: false },
	{ email: MANAGER, key: "board.planning.groupBy", value: "epic", reset: false },
	{ email: ALICE, key: "board.execution.groupBy", value: "none", reset: true },
];

interface LinkSeed {
	readonly key: string;
	readonly source: string;
	readonly target: string;
	readonly kind: KanbanLinkKind;
	readonly removedBy: string | null;
}

const LINKS: readonly LinkSeed[] = [
	{ key: "hierarchy-blocks-timeline", source: "story-board-hierarchy", target: "story-activity-timeline", kind: "BLOCKS", removedBy: null },
	{ key: "sweep-blocks-fraud", source: "story-revoke-sweep", target: "referral-fraud-signals", kind: "BLOCKS", removedBy: null },
	{ key: "wip-relates-hierarchy", source: "story-wip-limits", target: "story-board-hierarchy", kind: "RELATES_TO", removedBy: null },
	{ key: "export-relates-terminals", source: "story-export-archive", target: "terminal-health", kind: "RELATES_TO", removedBy: MANAGER },
];

/** Watchers beyond each item's reporter (who always watches what they reported). */
const EXTRA_WATCHERS: readonly { readonly item: string; readonly email: string; readonly removed: boolean }[] = [
	{ item: "story-board-hierarchy", email: EVE, removed: false },
	{ item: "story-board-hierarchy", email: ALICE, removed: false },
	{ item: "referral-fraud-signals", email: SUPERADMIN, removed: false },
	{ item: "board-activity-feed", email: MANAGER, removed: false },
	{ item: "multi-tenancy", email: FRANK, removed: true },
];

interface ActivitySeed {
	readonly item: string;
	readonly actor: string;
	readonly kind: KanbanActivityKind;
	readonly field: KanbanActivityField | null;
	readonly from: string | null;
	readonly to: string | null;
	readonly daysAgo: number;
}

/** History beyond each item's creation, oldest first per item. */
const ACTIVITY: readonly ActivitySeed[] = [
	{ item: "story-board-hierarchy", actor: ADMIN, kind: "MOVED", field: null, from: "To Do", to: "In Progress", daysAgo: 6 },
	{ item: "story-board-hierarchy", actor: ADMIN, kind: "UPDATED", field: "STORY_POINTS", from: "5", to: "8", daysAgo: 5 },
	{ item: "story-board-hierarchy", actor: MANAGER, kind: "UPDATED", field: "ASSIGNEE", from: null, to: "Admin User", daysAgo: 5 },
	{ item: "story-board-hierarchy", actor: ADMIN, kind: "LINKED", field: null, from: "BLOCKS", to: "Activity timeline on the item page", daysAgo: 4 },
	{ item: "story-board-hierarchy", actor: ALICE, kind: "COMMENTED", field: null, from: null, to: null, daysAgo: 3 },
	{ item: "story-board-hierarchy", actor: ADMIN, kind: "CHECKED", field: "ACCEPTANCE_CRITERIA", from: null, to: "A task cannot be created without its story", daysAgo: 2 },
	{ item: "story-board-hierarchy", actor: ADMIN, kind: "UPDATED", field: "ACCEPTANCE_CRITERIA", from: "3", to: "4", daysAgo: 2 },
	{ item: "story-board-hierarchy", actor: ADMIN, kind: "ATTACHED", field: null, from: null, to: "story-board-hierarchy-notes-1.pdf", daysAgo: 1 },
	{ item: "story-revoke-sweep", actor: CAROL, kind: "MOVED", field: null, from: "In Progress", to: "Review", daysAgo: 2 },
	{ item: "story-revoke-sweep", actor: SUPERADMIN, kind: "UPDATED", field: "DUE", from: String(Date.now()), to: String(Date.now() + 4 * DAY_MS), daysAgo: 2 },
	{ item: "export-relates-terminals", actor: MANAGER, kind: "UNLINKED", field: null, from: "RELATES_TO", to: "POS terminal health page", daysAgo: 1 },
	{ item: "sub-request-burst", actor: SUPERADMIN, kind: "UPDATED", field: "STEPS", from: "2", to: "1", daysAgo: 1 },
	{ item: "sub-swimlanes", actor: EVE, kind: "CHECKED", field: "STEPS", from: null, to: "Group by epic on the planning board", daysAgo: 1 },
	{ item: "sub-request-burst", actor: FRANK, kind: "MOVED", field: null, from: "To Do", to: "In Progress", daysAgo: 1 },
	{ item: "audit-log-filters", actor: ALICE, kind: "DETACHED", field: null, from: null, to: "audit-filters-old-mockup.png", daysAgo: 3 },
	{ item: "feature-reward-media", actor: EVE, kind: "UPDATED", field: "PRIORITY", from: "LOW", to: "MEDIUM", daysAgo: 4 },
	{ item: "multi-tenancy", actor: ADMIN, kind: "UPDATED", field: "LABELS", from: "q4", to: "q4, foundations", daysAgo: 8 },
	{ item: "offline-claim-states", actor: EVE, kind: "UPDATED", field: "PARENT", from: "Reward media", to: null, daysAgo: 6 },
];

/** The comments an item gets, oldest first; an item with more comments than lines reuses them in order. */
const COMMENT_LINES: readonly string[] = [
	"I wrote up the open questions in the attached doc.",
	"Can we keep the first version behind the existing permission?",
	"Agreed — let's not add a new role for this.",
	"Edge case: what happens when the file is deleted while it is being attached?",
	"The row lock covers that; added a test for it.",
	"Design is ready for review.",
	"Looks good to me. Shipping it once QA signs off.",
	"Moved the due date: the storage work landed first.",
	"Checked it in both themes, contrast passes.",
	"Left a note on the migration plan.",
	"Paired on this today, the remaining work is the docs.",
];

/** The email of the `index`-th staff member, wrapping round the list. */
function staffAt(index: number): string {
	return requireRow(STAFF_EMAILS.at(index % STAFF_EMAILS.length), "kanban staff email");
}

function daysFromNow(days: number): bigint {
	return BigInt(Date.now() + days * DAY_MS);
}

function columnId(key: string): string {
	return deterministicUuid(NAMESPACE, `column-${key}`);
}

function commentId(item: string, index: number): string {
	return deterministicUuid(NAMESPACE, `comment-${item}-${String(index)}`);
}

function itemId(key: string): string {
	return deterministicUuid(NAMESPACE, `task-${key}`);
}

/** A column's title and board, from its seed key. */
function columnSeed(key: string): { readonly title: string; readonly board: KanbanBoardKind } {
	const planning = PLANNING_COLUMNS.find((column) => column.key === key);
	if (planning !== undefined) {
		return { title: planning.title, board: "PLANNING" };
	}
	return {
		title: requireRow(
			EXECUTION_COLUMNS.find((column) => column.key === key),
			`kanban column ${key}`,
		).title,
		board: "EXECUTION",
	};
}

/** A subtask as an item: it follows its story's dates, is never estimated and keeps its task's priority and team. */
function subtaskItem(subtask: SubtaskSeed): ItemSeed {
	const task = requireRow(
		ITEMS.find((item) => item.key === subtask.task),
		`kanban task ${subtask.task}`,
	);
	return {
		key: subtask.key,
		column: subtask.column,
		type: "SUBTASK",
		parent: subtask.task,
		title: subtask.title,
		description: "",
		priority: task.priority,
		team: task.team,
		labels: [],
		startInDays: null,
		dueInDays: null,
		storyPoints: null,
		progress: subtask.column === "shipped" ? 100 : 0,
		owner: task.owner,
		assignee: subtask.assignee,
		comments: 0,
		images: 0,
		documents: 0,
	};
}

/** Every live item, parents first: the planning and execution items, then each task's subtasks. */
const ALL_ITEMS: readonly ItemSeed[] = [...ITEMS, ...SUBTASKS.map(subtaskItem)];

/**
 * Each item's key, handed out per level in creation order — the order the board
 * would have numbered them (the deleted story took the next story number; a
 * soft delete never frees one).
 */
const KEYS: ReadonlyMap<string, string> = new Map(
	[...ALL_ITEMS, DELETED_ITEM].map((item, _index, all): [string, string] => [
		item.key,
		kanbanItemKey(item.type, all.filter((candidate) => candidate.type === item.type).indexOf(item) + 1),
	]),
);

function keyOf(item: ItemSeed): string {
	return requireRow(KEYS.get(item.key), `kanban key ${item.key}`);
}

/** The item a history line names (a link's history belongs to its source item). */
function historyItem(key: string): string {
	return LINKS.find((link) => link.key === key)?.source ?? key;
}

export interface KanbanSeedSummary {
	readonly columns: number;
	readonly tasks: number;
	readonly comments: number;
	readonly attachments: number;
}

type StaffId = (email: string) => string;

export async function seedKanbanBoard(): Promise<KanbanSeedSummary> {
	const { seedReadyFile, deleteFile } = createSeedFileWriter();
	const staff = await prisma.user.findMany({ where: { email: { in: [...STAFF_EMAILS] } }, select: { id: true, email: true } });
	const staffId: StaffId = (email) => requireRow(staff.find((user) => user.email === email)?.id, `kanban staff ${email}`);

	for (const [position, column] of PLANNING_COLUMNS.entries()) {
		const row = { id: columnId(column.key), title: column.title, stage: column.stage, position, version: 0 } satisfies Prisma.KanbanPlanningColumnUncheckedCreateInput;
		await prisma.kanbanPlanningColumn.upsert({ where: { id: row.id }, create: row, update: row });
	}
	for (const [position, column] of EXECUTION_COLUMNS.entries()) {
		const row = {
			id: columnId(column.key),
			title: column.title,
			state: column.state,
			wipLimit: column.wipLimit,
			position,
			version: 0,
		} satisfies Prisma.KanbanExecutionColumnUncheckedCreateInput;
		await prisma.kanbanExecutionColumn.upsert({ where: { id: row.id }, create: row, update: row });
	}

	// Parents first, so every parent row exists before its children point at it.
	for (const item of ALL_ITEMS) {
		const position = ALL_ITEMS.filter((candidate) => candidate.column === item.column).indexOf(item);
		await upsertItem(item, position, staffId, null);
		await seedComments(item, staffId);
		await seedAttachments(item, staffId(item.owner), seedReadyFile);
		await seedWatcher(item.key, staffId(item.owner), false);
	}
	for (const watcher of EXTRA_WATCHERS) {
		await seedWatcher(watcher.item, staffId(watcher.email), watcher.removed);
	}
	for (const checklist of CHECKLISTS) {
		await seedChecklist(checklist, staffId);
	}
	await seedRemovedStep(staffId);
	await seedLevelCounters();
	await seedPreferences(staffId);
	for (const link of LINKS) {
		await seedLink(link, staffId);
	}
	await seedHistory(staffId);
	// A comment posted with a file (comment 2 of the story: "Agreed — let's not add a new role for this.").
	await seedAttachmentFile(
		{
			key: COMMENTED_FILE.item,
			attachment: "comment-file",
			fileName: COMMENTED_FILE.fileName,
			kind: "ATTACHMENT",
			uploader: staffId(staffAt(COMMENTED_FILE.commentIndex)),
			daysAgo: 1,
			commentId: commentId(COMMENTED_FILE.item, COMMENTED_FILE.commentIndex),
		},
		seedReadyFile,
	);

	// ── Left by the board's own actions: a deleted item, and an attachment removed from its item ──
	await upsertItem(DELETED_ITEM, ALL_ITEMS.filter((candidate) => candidate.column === DELETED_ITEM.column).length, staffId, {
		deletedAt: daysFromNow(-2),
		deletedBy: staffId(ADMIN),
	});
	const removed = await seedAttachmentFile(
		{
			key: "audit-log-filters",
			attachment: "removed-mockup",
			fileName: "audit-filters-old-mockup.png",
			kind: "ATTACHMENT",
			uploader: staffId(ALICE),
			daysAgo: 6,
		},
		seedReadyFile,
	);
	await deleteFile(removed.fileId, removed.stored, staffId(ALICE), 3);

	const [planningColumns, executionColumns, tasks, comments, attachments] = await Promise.all([
		prisma.kanbanPlanningColumn.count({ where: { isDeleted: false } }),
		prisma.kanbanExecutionColumn.count({ where: { isDeleted: false } }),
		prisma.kanbanTask.count({ where: { isDeleted: false } }),
		prisma.kanbanTaskComment.count({ where: { isDeleted: false } }),
		prisma.kanbanTaskAttachment.count({ where: { isDeleted: false } }),
	]);
	return { columns: planningColumns + executionColumns, tasks, comments, attachments };
}

async function upsertItem(item: ItemSeed, position: number, staffId: StaffId, deletion: { readonly deletedAt: bigint; readonly deletedBy: string } | null): Promise<void> {
	const createdAt = daysFromNow(-CREATED_DAYS_AGO);
	const board = columnSeed(item.column).board;
	const row = {
		id: itemId(item.key),
		key: keyOf(item),
		planningColumnId: board === "PLANNING" ? columnId(item.column) : null,
		executionColumnId: board === "EXECUTION" ? columnId(item.column) : null,
		type: item.type,
		parentId: item.parent === null ? null : itemId(item.parent),
		ownerId: staffId(item.owner),
		assigneeId: item.assignee === null ? null : staffId(item.assignee),
		title: item.title,
		description: item.description,
		priority: item.priority,
		team: item.team,
		labels: [...item.labels],
		startAt: item.startInDays === null ? null : daysFromNow(item.startInDays),
		dueAt: item.dueInDays === null ? null : daysFromNow(item.dueInDays),
		storyPoints: item.storyPoints,
		progress: item.progress,
		position,
		version: 0,
		createdAt,
		isDeleted: deletion !== null,
		deletedAt: deletion?.deletedAt ?? null,
		deletedBy: deletion?.deletedBy ?? null,
	} satisfies Prisma.KanbanTaskUncheckedCreateInput;
	await prisma.kanbanTask.upsert({ where: { id: row.id }, create: row, update: row });
	await upsertActivity(
		`created-${item.key}`,
		{
			item: item.key,
			actor: item.owner,
			kind: "CREATED",
			field: null,
			from: null,
			to: columnSeed(item.column).title,
			daysAgo: CREATED_DAYS_AGO,
		},
		staffId,
	);
}

async function seedComments(item: ItemSeed, staffId: StaffId): Promise<void> {
	for (let index = 0; index < item.comments; index += 1) {
		const writtenAt = BigInt(Date.now() - (item.comments - index) * COMMENT_SPACING_HOURS * MS_PER_HOUR);
		const row = {
			id: commentId(item.key, index),
			taskId: itemId(item.key),
			authorId: staffId(staffAt(index)),
			body: requireRow(COMMENT_LINES.at(index % COMMENT_LINES.length), "kanban comment line"),
			createdAt: writtenAt,
			updatedAt: writtenAt,
		} satisfies Prisma.KanbanTaskCommentUncheckedCreateInput;
		await prisma.kanbanTaskComment.upsert({ where: { id: row.id }, create: row, update: row });
	}
}

async function seedWatcher(item: string, userId: string, removed: boolean): Promise<void> {
	const row = {
		id: deterministicUuid(NAMESPACE, `watcher-${item}-${userId}`),
		taskId: itemId(item),
		userId,
		isDeleted: removed,
		deletedAt: removed ? daysFromNow(-1) : null,
		deletedBy: removed ? userId : null,
	} satisfies Prisma.KanbanTaskWatcherUncheckedCreateInput;
	await prisma.kanbanTaskWatcher.upsert({ where: { id: row.id }, create: row, update: row });
}

async function seedChecklist(checklist: ChecklistSeed, staffId: StaffId): Promise<void> {
	for (const [position, item] of checklist.rows.entries()) {
		const row = {
			id: deterministicUuid(NAMESPACE, `checklist-${checklist.item}-${checklist.list}-${String(position)}`),
			taskId: itemId(checklist.item),
			list: checklist.list,
			depth: item.depth,
			title: item.title,
			isDone: item.isDone,
			assigneeId: item.assignee === null ? null : staffId(item.assignee),
			position,
			isDeleted: false,
			deletedAt: null,
			deletedBy: null,
		} satisfies Prisma.KanbanChecklistItemUncheckedCreateInput;
		await prisma.kanbanChecklistItem.upsert({ where: { id: row.id }, create: row, update: row });
	}
}

async function seedRemovedStep(staffId: StaffId): Promise<void> {
	const row = {
		id: deterministicUuid(NAMESPACE, `checklist-${REMOVED_STEP.item}-removed`),
		taskId: itemId(REMOVED_STEP.item),
		list: "STEPS",
		depth: 0,
		title: REMOVED_STEP.title,
		isDone: false,
		assigneeId: null,
		// Its old place: the live rows were renumbered from 0 when it left.
		position: 0,
		isDeleted: true,
		deletedAt: daysFromNow(-1),
		deletedBy: staffId(REMOVED_STEP.remover),
	} satisfies Prisma.KanbanChecklistItemUncheckedCreateInput;
	await prisma.kanbanChecklistItem.upsert({ where: { id: row.id }, create: row, update: row });
}

/** Each level's counter at the last number the seeded items took, so the next item the board creates continues from there. */
async function seedLevelCounters(): Promise<void> {
	for (const level of ["EPIC", "FEATURE", "STORY", "TASK", "SUBTASK"] satisfies KanbanItemType[]) {
		const row = {
			id: deterministicUuid(NAMESPACE, `counter-${level}`),
			level,
			lastNumber: [...ALL_ITEMS, DELETED_ITEM].filter((item) => item.type === level).length,
		} satisfies Prisma.KanbanLevelCounterUncheckedCreateInput;
		const existing = await prisma.kanbanLevelCounter.findUnique({ where: { level }, select: { lastNumber: true } });
		// Never wind a counter back: a board that has handed out more numbers keeps them, so no key is handed out twice.
		if (existing === null) {
			await prisma.kanbanLevelCounter.create({ data: row });
		} else if (existing.lastNumber < row.lastNumber) {
			await prisma.kanbanLevelCounter.update({ where: { level }, data: { lastNumber: row.lastNumber } });
		}
	}
}

/**
 * The staff's board preferences. A person who already set one through the
 * board keeps theirs: the seed writes a key only where no live row of someone
 * else's making holds it (the partial unique index allows one live row per key).
 */
async function seedPreferences(staffId: StaffId): Promise<void> {
	for (const preference of PREFERENCES) {
		const userId = staffId(preference.email);
		const id = deterministicUuid(NAMESPACE, `preference-${preference.email}-${preference.key}`);
		const live = await prisma.userPreference.findFirst({ where: { userId, key: preference.key, isDeleted: false }, select: { id: true } });
		if (live !== null && live.id !== id) {
			continue;
		}
		const row = {
			id,
			userId,
			key: preference.key,
			value: preference.value,
			version: 0,
			isDeleted: preference.reset,
			deletedAt: preference.reset ? daysFromNow(-1) : null,
			deletedBy: preference.reset ? userId : null,
		} satisfies Prisma.UserPreferenceUncheckedCreateInput;
		await prisma.userPreference.upsert({ where: { id }, create: row, update: row });
	}
}

async function seedLink(link: LinkSeed, staffId: StaffId): Promise<void> {
	const row = {
		id: deterministicUuid(NAMESPACE, `link-${link.key}`),
		sourceTaskId: itemId(link.source),
		targetTaskId: itemId(link.target),
		kind: link.kind,
		isDeleted: link.removedBy !== null,
		deletedAt: link.removedBy === null ? null : daysFromNow(-1),
		deletedBy: link.removedBy === null ? null : staffId(link.removedBy),
	} satisfies Prisma.KanbanTaskLinkUncheckedCreateInput;
	await prisma.kanbanTaskLink.upsert({ where: { id: row.id }, create: row, update: row });
}

async function seedHistory(staffId: StaffId): Promise<void> {
	for (const [index, entry] of ACTIVITY.entries()) {
		await upsertActivity(`entry-${String(index)}`, { ...entry, item: historyItem(entry.item) }, staffId);
	}
}

async function upsertActivity(key: string, entry: ActivitySeed, staffId: StaffId): Promise<void> {
	const at = daysFromNow(-entry.daysAgo);
	const row = {
		id: deterministicUuid(NAMESPACE, `activity-${key}`),
		taskId: itemId(entry.item),
		actorId: staffId(entry.actor),
		kind: entry.kind,
		field: entry.field,
		fromValue: entry.from,
		toValue: entry.to,
		createdAt: at,
		updatedAt: at,
	} satisfies Prisma.KanbanTaskActivityUncheckedCreateInput;
	await prisma.kanbanTaskActivity.upsert({ where: { id: row.id }, create: row, update: row });
}

interface AttachmentSeed {
	readonly key: string;
	readonly attachment: string;
	/** The comment the file was posted with, or none when it was attached to the item directly. */
	readonly commentId?: string | undefined;
	readonly fileName: string;
	readonly kind: KanbanAttachmentKind;
	readonly uploader: string;
	readonly daysAgo: number;
}

type SeedReadyFile = SeedFileWriter["seedReadyFile"];

interface SeededAttachment {
	readonly fileId: string;
	readonly stored: StoredSeedObject;
}

/** The item's images, then its PDFs, all uploaded by its reporter. */
async function seedAttachments(item: ItemSeed, uploader: string, seedReadyFile: SeedReadyFile): Promise<void> {
	const images = Array.from({ length: item.images }, (_, index): AttachmentSeed => ({
		key: item.key,
		attachment: `image-${String(index)}`,
		fileName: `${item.key}-screenshot-${String(index + 1)}.png`,
		kind: "ATTACHMENT",
		uploader,
		daysAgo: index + 1,
	}));
	const documents = Array.from({ length: item.documents }, (_, index): AttachmentSeed => ({
		key: item.key,
		attachment: `document-${String(index)}`,
		fileName: `${item.key}-notes-${String(index + 1)}.pdf`,
		kind: "DOCUMENT",
		uploader,
		daysAgo: index + 1,
	}));
	for (const attachment of [...images, ...documents]) {
		await seedAttachmentFile(attachment, seedReadyFile);
	}
}

/** One READY item attachment file of its uploader, and its attachment row. */
async function seedAttachmentFile(attachment: AttachmentSeed, seedReadyFile: SeedReadyFile): Promise<SeededAttachment> {
	const fileId = deterministicUuid(NAMESPACE, `file-${attachment.key}-${attachment.attachment}`);
	const object: SeedObject = {
		id: fileId,
		category: "KANBAN_TASK_ATTACHMENT",
		ownerId: attachment.uploader,
		fileName: attachment.fileName,
		mimeType: attachment.kind === "DOCUMENT" ? "application/pdf" : "image/png",
		bytes: attachment.kind === "DOCUMENT" ? PDF_BYTES : PNG_BYTES,
		uploadedById: attachment.uploader,
		tenantId: null,
		uploadedDaysAgo: attachment.daysAgo,
	};
	const stored = await seedReadyFile(object);
	const attachedAt = BigInt(Date.now() - attachment.daysAgo * DAY_MS);
	const row = {
		id: deterministicUuid(NAMESPACE, `attachment-${attachment.key}-${attachment.attachment}`),
		taskId: itemId(attachment.key),
		commentId: attachment.commentId ?? null,
		fileId,
		kind: attachment.kind,
		createdAt: attachedAt,
		updatedAt: attachedAt,
		isDeleted: false,
		deletedAt: null,
		deletedBy: null,
	} satisfies Prisma.KanbanTaskAttachmentUncheckedCreateInput;
	await prisma.kanbanTaskAttachment.upsert({ where: { id: row.id }, create: row, update: row });
	return { fileId, stored };
}
