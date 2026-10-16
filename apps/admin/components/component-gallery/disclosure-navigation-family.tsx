"use client";

import { hotkeysCoreFeature, selectionFeature, syncDataLoaderFeature, type ItemInstance } from "@headless-tree/core";
import { useTree } from "@headless-tree/react";
import { Badge } from "@workspace/ui/components/badge";
import { Button } from "@workspace/ui/components/button";
import { Collapsible, CollapsibleContent, CollapsibleTrigger } from "@workspace/ui/components/collapsible";
import {
	Pagination,
	PaginationContent,
	PaginationEllipsis,
	PaginationItem,
	PaginationLink,
	PaginationNext,
	PaginationPrevious,
	type PaginationNavLabels,
} from "@workspace/ui/components/pagination";
import { ScrollArea, ScrollBar } from "@workspace/ui/components/scroll-area";
import { Separator } from "@workspace/ui/components/separator";
import {
	Stepper,
	StepperContent,
	StepperDescription,
	StepperIndicator,
	StepperItem,
	StepperNav,
	StepperPanel,
	StepperSeparator,
	StepperTitle,
	StepperTrigger,
	type StepIndicators,
} from "@workspace/ui/components/stepper";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@workspace/ui/components/tabs";
import { Tree, TreeItem, TreeItemLabel } from "@workspace/ui/components/tree";
import { Check, ChevronsUpDown, FileText, Folder, FolderOpen, LoaderCircle } from "lucide-react";
import * as React from "react";
import { z } from "zod";

import { GALLERY_ENTRIES } from "@/components/component-gallery/gallery-catalog";
import { ComponentSection, DemoRow, DemoSurface, DemoValue, ExampleOnlySections } from "@/components/component-gallery/gallery-section";
import { ACCORDION_FAQ_ITEMS, ACCORDION_REORDER_ITEMS, ACCORDION_STATUS_ITEMS, ACCORDION_VARIANT_ITEMS } from "@/components/showcase/accordion-demo-items";
import { AccordionShowcase } from "@/components/showcase/accordion-showcase";
import { BreadcrumbShowcase } from "@/components/showcase/breadcrumb-showcase";

// ── Collapsible ─────────────────────────────────────────────────────────────

const RELEASE_NOTES: readonly string[] = ["Faster audit log search", "Bulk merchant invites", "Dark mode for email previews"];

function CollapsibleDemo(): React.JSX.Element {
	const [isOpen, setIsOpen] = React.useState<boolean>(false);

	return (
		<DemoSurface>
			<Collapsible open={isOpen} onOpenChange={setIsOpen} className="flex max-w-md flex-col gap-2">
				<div className="flex items-center justify-between gap-4">
					<p className="text-sm font-medium">Release 2.14 — {RELEASE_NOTES.length} changes</p>
					<CollapsibleTrigger render={<Button variant="ghost" size="icon-sm" aria-label={isOpen ? "Hide the changes" : "Show the changes"} />}>
						<ChevronsUpDown />
					</CollapsibleTrigger>
				</div>
				<CollapsibleContent className="flex flex-col gap-2">
					{RELEASE_NOTES.map((note) => (
						<p key={note} className="rounded-md border px-3 py-2 text-sm">
							{note}
						</p>
					))}
				</CollapsibleContent>
			</Collapsible>
			<DemoValue label="Open">{isOpen ? "yes" : "no"}</DemoValue>
		</DemoSurface>
	);
}

// ── Tabs ────────────────────────────────────────────────────────────────────

const SettingsTabSchema = z.enum(["general", "billing", "danger"]);
type SettingsTab = z.output<typeof SettingsTabSchema>;

function TabsDemo(): React.JSX.Element {
	const [tab, setTab] = React.useState<SettingsTab>("general");

	const handleTabChange = React.useCallback((value: string): void => {
		const parsed = SettingsTabSchema.safeParse(value);
		if (parsed.success) {
			setTab(parsed.data);
		}
	}, []);

	return (
		<DemoSurface>
			<DemoRow label="Default (controlled)" className="items-start">
				<Tabs value={tab} onValueChange={handleTabChange} className="w-full max-w-md">
					<TabsList>
						<TabsTrigger value="general">General</TabsTrigger>
						<TabsTrigger value="billing">Billing</TabsTrigger>
						<TabsTrigger value="danger" disabled>
							Danger zone
						</TabsTrigger>
					</TabsList>
					<TabsContent value="general" className="pt-3 text-sm text-muted-foreground">
						The store name, address and opening hours.
					</TabsContent>
					<TabsContent value="billing" className="pt-3 text-sm text-muted-foreground">
						Invoices and the payment method on file.
					</TabsContent>
				</Tabs>
			</DemoRow>
			<DemoRow label="Line variant" className="items-start">
				<Tabs defaultValue="overview" className="w-full max-w-md">
					<TabsList variant="line">
						<TabsTrigger value="overview">Overview</TabsTrigger>
						<TabsTrigger value="activity">Activity</TabsTrigger>
						<TabsTrigger value="members">Members</TabsTrigger>
					</TabsList>
					<TabsContent value="overview" className="pt-3 text-sm text-muted-foreground">
						An underline marks the active tab.
					</TabsContent>
					<TabsContent value="activity" className="pt-3 text-sm text-muted-foreground">
						Recent changes.
					</TabsContent>
					<TabsContent value="members" className="pt-3 text-sm text-muted-foreground">
						People with access.
					</TabsContent>
				</Tabs>
			</DemoRow>
			<DemoValue label="Active tab">{tab}</DemoValue>
		</DemoSurface>
	);
}

// ── Pagination ──────────────────────────────────────────────────────────────

const TOTAL_PAGES = 12;
const FIRST_PAGE = 1;
/** Pages shown on each side of the current one before the ellipsis. */
const PAGE_SIBLINGS = 1;
const PAGINATION_PREVIOUS_LABELS: Pick<PaginationNavLabels, "previousAria"> = { previousAria: "Go to the previous page" };
const PAGINATION_NEXT_LABELS: Pick<PaginationNavLabels, "nextAria"> = { nextAria: "Go to the next page" };
const PAGE_HREF = "#component-pagination";

/** The page numbers around `page`, always with the first and last. */
function visiblePages(page: number): readonly number[] {
	const pages = new Set<number>([FIRST_PAGE, TOTAL_PAGES]);
	for (let candidate = page - PAGE_SIBLINGS; candidate <= page + PAGE_SIBLINGS; candidate++) {
		if (candidate >= FIRST_PAGE && candidate <= TOTAL_PAGES) {
			pages.add(candidate);
		}
	}
	return [...pages].sort((left, right) => left - right);
}

const PageNumberSchema = z.coerce.number().int().min(FIRST_PAGE).max(TOTAL_PAGES);

function PaginationDemo(): React.JSX.Element {
	const [page, setPage] = React.useState<number>(FIRST_PAGE);
	const pages = React.useMemo(() => visiblePages(page), [page]);

	// The links carry their page in `data-page`; the demo keeps the page in state instead of navigating.
	const handlePageClick = React.useCallback((event: React.MouseEvent<HTMLAnchorElement>): void => {
		event.preventDefault();
		const parsed = PageNumberSchema.safeParse(event.currentTarget.dataset.page);
		if (parsed.success) {
			setPage(parsed.data);
		}
	}, []);

	return (
		<DemoSurface>
			<Pagination>
				<PaginationContent>
					<PaginationItem>
						<PaginationPrevious href={PAGE_HREF} text="Previous" labels={PAGINATION_PREVIOUS_LABELS} data-page={Math.max(FIRST_PAGE, page - 1)} onClick={handlePageClick} />
					</PaginationItem>
					{pages.map((pageNumber, index) => {
						const previous = pages.at(index - 1);
						const hasGap = index > 0 && previous !== undefined && pageNumber - previous > 1;
						return (
							<React.Fragment key={pageNumber}>
								{hasGap ? (
									<PaginationItem>
										<PaginationEllipsis morePagesLabel="More pages" />
									</PaginationItem>
								) : null}
								<PaginationItem>
									<PaginationLink href={PAGE_HREF} isActive={pageNumber === page} data-page={pageNumber} onClick={handlePageClick}>
										{pageNumber}
									</PaginationLink>
								</PaginationItem>
							</React.Fragment>
						);
					})}
					<PaginationItem>
						<PaginationNext href={PAGE_HREF} text="Next" labels={PAGINATION_NEXT_LABELS} data-page={Math.min(TOTAL_PAGES, page + 1)} onClick={handlePageClick} />
					</PaginationItem>
				</PaginationContent>
			</Pagination>
			<DemoValue label="Page">
				{page} of {TOTAL_PAGES}
			</DemoValue>
		</DemoSurface>
	);
}

// ── Stepper ─────────────────────────────────────────────────────────────────

interface DemoStep {
	readonly step: number;
	readonly title: string;
	readonly description: string;
}

const STEPS: readonly DemoStep[] = [
	{ step: 1, title: "Account", description: "Owner details" },
	{ step: 2, title: "Business", description: "Legal entity" },
	{ step: 3, title: "Verification", description: "Documents" },
	{ step: 4, title: "Review", description: "Submit" },
];
const FIRST_STEP = 1;
const LAST_STEP = 4;

const STEP_INDICATORS: StepIndicators = {
	completed: <Check className="size-3.5" aria-hidden="true" />,
	loading: <LoaderCircle className="size-3.5 motion-safe:animate-spin" aria-hidden="true" />,
};

/** The last step spins once reached, to show the indicator's loading state (as if the submission were in flight). */
function isStepLoading(step: number, activeStep: number): boolean {
	return step === LAST_STEP && activeStep === LAST_STEP;
}

function StepperDemo(): React.JSX.Element {
	const [activeStep, setActiveStep] = React.useState<number>(2);

	const handleBack = React.useCallback((): void => {
		setActiveStep((current) => Math.max(FIRST_STEP, current - 1));
	}, []);

	const handleNext = React.useCallback((): void => {
		setActiveStep((current) => Math.min(LAST_STEP, current + 1));
	}, []);

	return (
		<DemoSurface>
			<Stepper value={activeStep} onValueChange={setActiveStep} indicators={STEP_INDICATORS} className="flex flex-col gap-6">
				<StepperNav aria-label="Onboarding steps">
					{STEPS.map((item) => (
						<StepperItem key={item.step} step={item.step} completed={item.step < activeStep} loading={isStepLoading(item.step, activeStep)}>
							<StepperTrigger className="flex items-center gap-2 text-start">
								<StepperIndicator>{item.step}</StepperIndicator>
								<div className="hidden flex-col sm:flex">
									<StepperTitle>{item.title}</StepperTitle>
									<StepperDescription className="text-xs">{item.description}</StepperDescription>
								</div>
							</StepperTrigger>
							{item.step < LAST_STEP ? <StepperSeparator className="mx-2 group-data-[state=completed]/step:bg-primary" /> : null}
						</StepperItem>
					))}
				</StepperNav>
				<StepperPanel className="text-sm">
					{STEPS.map((item) => (
						<StepperContent key={item.step} value={item.step} className="rounded-lg border border-dashed p-4 text-muted-foreground">
							Step {item.step}: {item.title} — {item.description}.
						</StepperContent>
					))}
				</StepperPanel>
			</Stepper>
			<div className="flex gap-2">
				<Button type="button" variant="outline" onClick={handleBack} disabled={activeStep === FIRST_STEP}>
					Back
				</Button>
				<Button type="button" onClick={handleNext} disabled={activeStep === LAST_STEP}>
					Next
				</Button>
			</div>
		</DemoSurface>
	);
}

// ── Tree ────────────────────────────────────────────────────────────────────

interface FileNode {
	readonly name: string;
	readonly children?: readonly string[];
}

const TREE_ROOT_ID = "root";
/** Pixels each tree level is indented by. */
const TREE_INDENT_PX = 16;

const FILE_NODES: ReadonlyMap<string, FileNode> = new Map<string, FileNode>([
	[TREE_ROOT_ID, { name: "Project", children: ["apps", "packages", "readme"] }],
	["apps", { name: "apps", children: ["admin", "web"] }],
	["admin", { name: "admin", children: ["admin-page"] }],
	["admin-page", { name: "page.tsx" }],
	["web", { name: "web", children: ["web-layout"] }],
	["web-layout", { name: "layout.tsx" }],
	["packages", { name: "packages", children: ["ui", "shared"] }],
	["ui", { name: "ui", children: ["ui-button"] }],
	["ui-button", { name: "button.tsx" }],
	["shared", { name: "shared", children: [] }],
	["readme", { name: "README.md" }],
]);

/** Stands in for an id missing from the data (never reached with this static tree). */
const MISSING_FILE_NODE: FileNode = { name: "" };
const INITIAL_EXPANDED: readonly string[] = ["apps", "admin"];
const NO_SELECTION: readonly string[] = [];

interface FileTreeRowProps {
	readonly item: ItemInstance<FileNode>;
}

function FileTreeRow({ item }: FileTreeRowProps): React.JSX.Element {
	const isFolder = item.isFolder();
	const FolderIcon = item.isExpanded() ? FolderOpen : Folder;
	const childCount = item.getItemData().children?.length ?? 0;
	return (
		<TreeItem item={item}>
			<TreeItemLabel className="gap-2">
				{isFolder ? <FolderIcon className="size-4 text-primary" aria-hidden="true" /> : <FileText className="size-4 text-muted-foreground" aria-hidden="true" />}
				<span className="min-w-0 flex-1 truncate">{item.getItemName()}</span>
				{isFolder ? (
					<Badge variant="secondary" size="sm" className="tabular-nums">
						{String(childCount)}
					</Badge>
				) : null}
			</TreeItemLabel>
		</TreeItem>
	);
}

function TreeDemo(): React.JSX.Element {
	const [expandedItems, setExpandedItems] = React.useState<string[]>(() => [...INITIAL_EXPANDED]);
	const [selectedItems, setSelectedItems] = React.useState<string[]>(() => [...NO_SELECTION]);
	const [focusedItem, setFocusedItem] = React.useState<string | null>(null);

	const tree = useTree<FileNode>({
		rootItemId: TREE_ROOT_ID,
		indent: TREE_INDENT_PX,
		getItemName: (item) => item.getItemData().name,
		isItemFolder: (item) => item.getItemData().children !== undefined,
		dataLoader: {
			getItem: (itemId) => FILE_NODES.get(itemId) ?? MISSING_FILE_NODE,
			getChildren: (itemId) => [...(FILE_NODES.get(itemId)?.children ?? [])],
		},
		state: { expandedItems, selectedItems, focusedItem },
		setExpandedItems,
		setSelectedItems,
		setFocusedItem,
		features: [syncDataLoaderFeature, selectionFeature, hotkeysCoreFeature],
	});

	const selectedNames = selectedItems.map((id) => FILE_NODES.get(id)?.name ?? id);

	return (
		<DemoSurface>
			<Tree tree={tree} indent={TREE_INDENT_PX} aria-label="Project files" className="max-w-sm rounded-lg border p-2">
				{tree.getItems().map((item) => (
					<FileTreeRow key={item.getId()} item={item} />
				))}
			</Tree>
			<DemoValue label="Selected">{selectedNames.length > 0 ? selectedNames.join(", ") : "none"}</DemoValue>
		</DemoSurface>
	);
}

// ── Scroll area ─────────────────────────────────────────────────────────────

/** How many sample rows / cards the scroll demos hold — enough to overflow. */
const SCROLL_ROW_COUNT = 30;
const SCROLL_CARD_COUNT = 12;
const SCROLL_ROWS: readonly string[] = Array.from({ length: SCROLL_ROW_COUNT }, (_, index) => `v1.${String(SCROLL_ROW_COUNT - index)}.0`);
const SCROLL_CARDS: readonly string[] = Array.from({ length: SCROLL_CARD_COUNT }, (_, index) => `Card ${String(index + 1)}`);

function ScrollAreaDemo(): React.JSX.Element {
	return (
		<DemoSurface>
			<DemoRow label="Vertical and horizontal" className="items-start">
				<ScrollArea className="h-56 w-48 rounded-lg border">
					<div className="p-3">
						<p className="mb-2 text-sm font-medium">Releases</p>
						{SCROLL_ROWS.map((row) => (
							<React.Fragment key={row}>
								<p className="py-1.5 text-sm">{row}</p>
								<Separator />
							</React.Fragment>
						))}
					</div>
				</ScrollArea>
				<ScrollArea className="w-full max-w-md rounded-lg border">
					<div className="flex w-max gap-3 p-3">
						{SCROLL_CARDS.map((card) => (
							<div key={card} className="flex h-28 w-36 shrink-0 items-center justify-center rounded-md bg-muted text-sm text-muted-foreground">
								{card}
							</div>
						))}
					</div>
					<ScrollBar orientation="horizontal" />
				</ScrollArea>
			</DemoRow>
		</DemoSurface>
	);
}

/** Disclosure & navigation: revealing content and moving around. Smart: owns every demo's state. */
export function DisclosureNavigationFamily(): React.JSX.Element {
	return (
		<>
			<ComponentSection entry={GALLERY_ENTRIES.accordion} height="h-[400px]">
				<AccordionShowcase faqItems={ACCORDION_FAQ_ITEMS} statusItems={ACCORDION_STATUS_ITEMS} reorderItems={ACCORDION_REORDER_ITEMS} variantItems={ACCORDION_VARIANT_ITEMS} />
			</ComponentSection>
			<ComponentSection entry={GALLERY_ENTRIES.collapsible} height="h-40">
				<CollapsibleDemo />
			</ComponentSection>
			<ComponentSection entry={GALLERY_ENTRIES.tabs} height="h-72">
				<TabsDemo />
			</ComponentSection>
			<ComponentSection entry={GALLERY_ENTRIES.breadcrumb} height="h-40">
				<BreadcrumbShowcase />
			</ComponentSection>
			<ComponentSection entry={GALLERY_ENTRIES.pagination} height="h-24">
				<PaginationDemo />
			</ComponentSection>
			<ComponentSection entry={GALLERY_ENTRIES.stepper} height="h-56">
				<StepperDemo />
			</ComponentSection>
			<ComponentSection entry={GALLERY_ENTRIES.tree} height="h-72">
				<TreeDemo />
			</ComponentSection>
			<ComponentSection entry={GALLERY_ENTRIES.scrollArea} height="h-72">
				<ScrollAreaDemo />
			</ComponentSection>
			<ExampleOnlySections familyId="family-disclosure-navigation" />
		</>
	);
}
