"use client";

import {
	AlertDialog,
	AlertDialogAction,
	AlertDialogCancel,
	AlertDialogContent,
	AlertDialogDescription,
	AlertDialogFooter,
	AlertDialogHeader,
	AlertDialogTitle,
} from "@workspace/ui/components/alert-dialog";
import { Avatar, AvatarFallback, AvatarImage } from "@workspace/ui/components/avatar";
import { Badge } from "@workspace/ui/components/badge";
import { Button } from "@workspace/ui/components/button";
import { Calendar } from "@workspace/ui/components/calendar";
import { Card, CardAction, CardFooter, CardHeader, CardTitle } from "@workspace/ui/components/card";
import {
	Combobox,
	ComboboxChip,
	ComboboxChips,
	ComboboxChipsInput,
	ComboboxCollection,
	ComboboxContent,
	ComboboxEmpty,
	ComboboxInput,
	ComboboxItem,
	ComboboxList,
	useComboboxAnchor,
} from "@workspace/ui/components/combobox";
import {
	ContextMenu,
	ContextMenuContent,
	ContextMenuGroup,
	ContextMenuItem,
	ContextMenuLabel,
	ContextMenuSeparator,
	ContextMenuTrigger,
} from "@workspace/ui/components/context-menu";
import {
	DataGrid,
	DataGridContainer,
	dataGridFeatures,
	type DataGridCellEditRequest,
	type DataGridCellSelectionBound,
	type DataGridCellSelectionSnapshot,
	type DataGridCellsChangeDetails,
	type DataGridCellStatus,
	type DataGridCopyDetails,
	type DataGridFeatures,
	type DataGridRowStatus,
	type DataGridTableClassNames,
	type DataGridTableLayout,
} from "@workspace/ui/components/data-grid/data-grid";
import {
	DataGridCellSelection,
	buildDataGridClearDetails,
	getDataGridActiveRegionGrid,
	serializeDataGridClipboardText,
	type DataGridCellSelectionApi,
} from "@workspace/ui/components/data-grid/data-grid-cell-selection";
import { DataGridColumnHeader } from "@workspace/ui/components/data-grid/data-grid-column-header";
import { DataGridPagination } from "@workspace/ui/components/data-grid/data-grid-pagination";
import { DataGridScrollArea } from "@workspace/ui/components/data-grid/data-grid-scroll-area";
import { DataGridTable } from "@workspace/ui/components/data-grid/data-grid-table";
import { Popover, PopoverContent, PopoverTrigger } from "@workspace/ui/components/popover";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue, type SelectOption } from "@workspace/ui/components/select";
import { toastMessage } from "@workspace/ui/components/toast";
import { useCopyToClipboard } from "@workspace/ui/hooks/use-copy-to-clipboard";
import { useTable, type CellData, type ColumnDef, type PaginationState } from "@tanstack/react-table";
import { format } from "date-fns";
import { XIcon } from "lucide-react";
import * as React from "react";
import { z } from "zod";

type ProductStatus = "active" | "archived";

interface IProduct {
	readonly id: string;
	readonly sku: string;
	readonly name: string;
	/** Assigned member ids. */
	readonly team: readonly string[];
	/** ISO day (`yyyy-MM-dd`), or `""` when no restock is planned. */
	readonly restock: string;
	readonly stock: number;
	readonly price: number;
	readonly status: ProductStatus;
}

interface IMember {
	readonly id: string;
	readonly name: string;
	readonly email: string;
	readonly avatar: string;
	readonly initials: string;
}

const MEMBERS: readonly IMember[] = [
	{ id: "1", name: "Alex Johnson", email: "alex@example.com", avatar: "https://images.unsplash.com/photo-1535713875002-d1d0cf377fde?w=96&h=96&dpr=2&q=80", initials: "AJ" },
	{ id: "2", name: "Sarah Chen", email: "sarah@example.com", avatar: "https://images.unsplash.com/photo-1519699047748-de8e457a634e?w=96&h=96&dpr=2&q=80", initials: "SC" },
	{
		id: "3",
		name: "Michael Rodriguez",
		email: "michael@example.com",
		avatar: "https://images.unsplash.com/photo-1584308972272-9e4e7685e80f?w=96&h=96&dpr=2&q=80",
		initials: "MR",
	},
	{ id: "4", name: "Emma Wilson", email: "emma@example.com", avatar: "https://images.unsplash.com/photo-1485893086445-ed75865251e0?w=96&h=96&dpr=2&q=80", initials: "EW" },
	{ id: "5", name: "David Kim", email: "david@example.com", avatar: "https://images.unsplash.com/photo-1607990281513-2c110a25bd8c?w=96&h=96&dpr=2&q=80", initials: "DK" },
	{ id: "6", name: "Aron Thompson", email: "aron@example.com", avatar: "https://images.unsplash.com/photo-1527980965255-d3b416303d12?w=96&h=96&dpr=2&q=80", initials: "AT" },
	{ id: "7", name: "James Brown", email: "james@example.com", avatar: "https://images.unsplash.com/photo-1543299750-19d1d6297053?w=96&h=96&dpr=2&q=80", initials: "JB" },
	{ id: "8", name: "Maria Garcia", email: "maria@example.com", avatar: "https://images.unsplash.com/photo-1620075225255-8c2051b6c015?w=96&h=96&dpr=2&q=80", initials: "MG" },
	{ id: "9", name: "Nick Johnson", email: "nick@example.com", avatar: "https://images.unsplash.com/photo-1485206412256-701ccc5b93ca?w=96&h=96&dpr=2&q=80", initials: "NJ" },
	{ id: "10", name: "Liam Thompson", email: "liam@example.com", avatar: "https://images.unsplash.com/photo-1542595913-85d69b0edbaf?w=96&h=96&dpr=2&q=80", initials: "LT" },
];

const MEMBER_BY_ID: ReadonlyMap<string, IMember> = new Map(MEMBERS.map((member: IMember): [string, IMember] => [member.id, member]));

const STATUS_OPTIONS: readonly SelectOption<ProductStatus>[] = [
	{ value: "active", label: "Active" },
	{ value: "archived", label: "Archived" },
];

const DEMO_DATA: readonly IProduct[] = [
	{ id: "1", sku: "AU-1042", name: "Studio Headphones", team: ["1", "2"], restock: "2026-09-04", stock: 42, price: 189.0, status: "active" },
	{ id: "2", sku: "AU-1077", name: "Desktop Speakers", team: ["3"], restock: "2026-09-12", stock: 18, price: 129.5, status: "active" },
	{ id: "3", sku: "DS-2011", name: "27in 4K Monitor", team: ["2", "4", "5"], restock: "2026-10-01", stock: 7, price: 449.99, status: "active" },
	{ id: "4", sku: "DS-2048", name: "Portable Display", team: [], restock: "", stock: 25, price: 219.0, status: "archived" },
	{ id: "5", sku: "PE-3003", name: "Mechanical Keyboard", team: ["6"], restock: "2026-09-18", stock: 64, price: 139.0, status: "active" },
	{ id: "6", sku: "PE-3017", name: "Wireless Mouse", team: ["7", "8"], restock: "2026-09-25", stock: 120, price: 59.0, status: "active" },
	{ id: "7", sku: "PE-3050", name: "USB Microphone", team: [], restock: "", stock: 33, price: 99.0, status: "archived" },
];

/** Rows per page. */
const PAGE_SIZE = 10;
/** Prices show cents. */
const PRICE_DECIMALS = 2;
const DECIMAL_RADIX = 10;
/** New rows get a zero-padded SKU number of this many digits. */
const SKU_DIGITS = 4;
/** The month the restock calendar opens on when a row has no date yet (the sample data's restock season). */
const DEFAULT_RESTOCK_MONTH = new Date(2026, 8, 1);
const ISO_DAY_FORMAT = "yyyy-MM-dd";
const DISPLAY_DAY_FORMAT = "MMM d, yyyy";
/** Fallback popup offsets before the trigger-to-cell delta is measured, in pixels. */
const DEFAULT_POPUP_OFFSETS: PopupOffsets = { side: 9, align: -12 };
/** Selection feedback starts at a real range, not a single focused cell. */
const MIN_SELECTION_TOAST_CELLS = 2;
const SELECTION_TOAST_TIMEOUT_MS = 1500;
/** Updates within this window patch the live selection toast instead of stacking a new one (it times out after SELECTION_TOAST_TIMEOUT_MS). */
const SELECTION_TOAST_REFRESH_MS = 1400;

/** The cell the Edit gesture opens a control in, in priority order: the cell's primary control, never an incidental button inside it. */
const CELL_CONTROL_SELECTORS: readonly string[] = ['[data-slot="select-trigger"]', '[data-slot="popover-trigger"]', "input", "button"];
const FOCUSED_CELL_SELECTOR = "td[data-cell-focused]";
const INTERACTIVE_CONTROL_SELECTOR = 'button, a, input, select, textarea, [contenteditable], [role="combobox"], [role="checkbox"]';

const TABLE_LAYOUT: DataGridTableLayout = {
	dense: true,
	cellSelection: true,
	cellFillHandle: true,
	// The Excel-style solid square inside the selection corner.
	cellFillHandleVariant: "square",
	cellBorder: true,
	columnsResizable: true,
	columnsPinnable: true,
};

const TABLE_CLASS_NAMES: DataGridTableClassNames = {
	// Breathing room against the container edges now that a data column leads the row.
	edgeCell: "first:ps-4 last:pe-4 [&:has(+[data-slot=data-grid-table-fill-body-cell]:last-child)]:pe-4 [&:has(+[data-slot=data-grid-table-fill-head-cell]:last-child)]:pe-4",
	// The row the open context menu references, checkbox state untouched.
	bodyRow: "data-[context-open]:bg-muted/50 data-[context-open]:[&>td[data-pinned]]:bg-[color-mix(in_oklab,var(--muted)_50%,var(--data-grid-surface,var(--card)))]",
};

// ── Typed writes ────────────────────────────────────────────────────────────

/** One cell write: what the grid's change batches and the custom cell controls both produce. */
interface ProductCellWrite {
	readonly rowId: string;
	readonly columnId: string;
	readonly value: CellData;
}

type ProductPatcher = (row: IProduct, value: CellData) => IProduct;

/** Applies `value` only when it matches the column's shape; a mismatched write leaves the row unchanged. */
function patchWith<TValue>(schema: z.ZodType<TValue>, apply: (row: IProduct, parsed: TValue) => IProduct): ProductPatcher {
	return (row: IProduct, value: CellData): IProduct => {
		const parsed = schema.safeParse(value);
		return parsed.success ? apply(row, parsed.data) : row;
	};
}

const productStatusSchema = z.enum(["active", "archived"]);
const memberIdsSchema = z.array(z.string());

/** The writable columns and how each one lands on a row. Absent columns (the SKU) are read-only. */
const PRODUCT_PATCHERS: ReadonlyMap<string, ProductPatcher> = new Map<string, ProductPatcher>([
	["name", patchWith(z.string(), (row: IProduct, name: string): IProduct => ({ ...row, name }))],
	["team", patchWith(memberIdsSchema, (row: IProduct, team: string[]): IProduct => ({ ...row, team }))],
	["restock", patchWith(z.string(), (row: IProduct, restock: string): IProduct => ({ ...row, restock }))],
	["stock", patchWith(z.number(), (row: IProduct, stock: number): IProduct => ({ ...row, stock }))],
	["price", patchWith(z.number(), (row: IProduct, price: number): IProduct => ({ ...row, price }))],
	["status", patchWith(productStatusSchema, (row: IProduct, status: ProductStatus): IProduct => ({ ...row, status }))],
]);

function applyProductWrites(row: IProduct, writes: readonly ProductCellWrite[]): IProduct {
	return writes.reduce((current: IProduct, write: ProductCellWrite): IProduct => PRODUCT_PATCHERS.get(write.columnId)?.(current, write.value) ?? current, row);
}

// ── Formatting ──────────────────────────────────────────────────────────────

function parseIsoDay(value: string): Date | undefined {
	return value === "" ? undefined : new Date(`${value}T00:00:00`);
}

function memberNames(ids: readonly string[]): string {
	return ids
		.map((id: string): string => MEMBER_BY_ID.get(id)?.name ?? "")
		.filter((name: string): boolean => name !== "")
		.join(", ");
}

function countCells(grid: readonly (readonly string[])[]): number {
	return grid.reduce((total: number, line: readonly string[]): number => total + line.length, 0);
}

function pluralize(count: number, singular: string, plural: string): string {
	return `${String(count)} ${count === 1 ? singular : plural}`;
}

function getRowId(row: IProduct): string {
	return row.id;
}

function memberToName(member: IMember): string {
	return member.name;
}

function isSameMember(item: IMember, value: IMember): boolean {
	return item.id === value.id;
}

// ── Cells ───────────────────────────────────────────────────────────────────

function StatusBadge({ status }: { readonly status: ProductStatus }): React.JSX.Element {
	return <Badge variant={status === "active" ? "success-light" : "primary-light"}>{status === "active" ? "Active" : "Archived"}</Badge>;
}

function renderMemberItem(member: IMember): React.JSX.Element {
	return (
		<ComboboxItem key={member.id} value={member}>
			<Avatar className="size-5">
				<AvatarImage src={member.avatar} alt={member.name} />
				<AvatarFallback className="text-[9px]">{member.initials}</AvatarFallback>
			</Avatar>
			{member.name}
		</ComboboxItem>
	);
}

interface TeamChipProps {
	readonly member: IMember;
	readonly onRemove: (memberId: string) => void;
}

/** One assigned member: the chip keeps the combobox behaviour but hands its look to an outline Badge. */
function TeamChip({ member, onRemove }: TeamChipProps): React.JSX.Element {
	const [firstName] = member.name.split(" ");
	const handleRemove = React.useCallback(
		(event: React.MouseEvent<HTMLButtonElement>): void => {
			// The chip strip opens the popup, so the press must not bubble.
			event.stopPropagation();
			onRemove(member.id);
		},
		[member.id, onRemove],
	);
	return (
		<ComboboxChip showRemove={false} className="rounded-none! border-0! bg-transparent! p-0!">
			<Badge variant="outline">
				<Avatar className="size-3.5">
					<AvatarImage src={member.avatar} alt={member.name} />
					<AvatarFallback className="text-[8px]">{member.initials}</AvatarFallback>
				</Avatar>
				{firstName ?? member.name}
				<Button variant="ghost" size="icon" className="size-3 hover:bg-transparent" aria-label={`Remove ${member.name}`} onClick={handleRemove}>
					<XIcon />
				</Button>
			</Badge>
		</ComboboxChip>
	);
}

interface TeamCellProps {
	readonly rowId: string;
	readonly team: readonly string[];
	readonly onTeamChange: (rowId: string, team: readonly string[]) => void;
}

/**
 * Multi-member assignment, the Notion person-property idiom: an inline chips
 * input renders the value as avatar chips that fit and grow the cell, and
 * typing in it filters the member popup.
 */
function TeamCell({ rowId, team, onTeamChange }: TeamCellProps): React.JSX.Element {
	const anchor = useComboboxAnchor();
	const selected = React.useMemo(
		(): IMember[] => team.map((id: string): IMember | undefined => MEMBER_BY_ID.get(id)).filter((member: IMember | undefined): member is IMember => member !== undefined),
		[team],
	);

	const handleValueChange = React.useCallback(
		(next: IMember[]): void => {
			onTeamChange(
				rowId,
				next.map((member: IMember): string => member.id),
			);
		},
		[onTeamChange, rowId],
	);

	const handleRemove = React.useCallback(
		(memberId: string): void => {
			onTeamChange(
				rowId,
				team.filter((id: string): boolean => id !== memberId),
			);
		},
		[onTeamChange, rowId, team],
	);

	return (
		<Combobox multiple items={MEMBERS} itemToStringValue={memberToName} isItemEqualToValue={isSameMember} value={selected} onValueChange={handleValueChange}>
			{/* Free-fit in the cell: the input chrome is stripped so only the chips render.
			    The whole strip opens the combobox, so data-cell-control makes a press on it
			    two-step (the first click focuses the cell, the second activates). */}
			<ComboboxChips ref={anchor} data-cell-control="" className="min-h-6! w-full rounded-none! border-0! bg-transparent! p-0! shadow-none! ring-0! outline-hidden!">
				{selected.map((member: IMember): React.JSX.Element => (
					<TeamChip key={member.id} member={member} onRemove={handleRemove} />
				))}
				{/* Zero-footprint until focused, so removing chips never leaves a tall row behind. */}
				<ComboboxChipsInput
					placeholder={selected.length > 0 ? "" : "No assignment"}
					className={
						selected.length > 0
							? "h-6 w-0 min-w-0 flex-none border-0! bg-transparent! p-0! shadow-none! outline-hidden! focus:min-w-16 focus:flex-1"
							: "h-6 min-w-16 border-0! bg-transparent! p-0! shadow-none! outline-hidden!"
					}
				/>
			</ComboboxChips>
			<ComboboxContent anchor={anchor} align="start" sideOffset={8} className="w-56">
				<ComboboxInput placeholder="Search members" showTrigger={false} className="m-1" />
				<ComboboxEmpty text="No members found." />
				<ComboboxList>
					<ComboboxCollection>{renderMemberItem}</ComboboxCollection>
				</ComboboxList>
			</ComboboxContent>
		</Combobox>
	);
}

interface PopupOffsets {
	readonly side: number;
	readonly align: number;
}

interface DateCellProps {
	readonly rowId: string;
	readonly value: string;
	readonly onDateChange: (rowId: string, value: string) => void;
}

/**
 * A date property on the date picker: the cell is a free-fit trigger showing
 * the formatted value, and editing opens a calendar in a popover. The open
 * state lives in the cell, so picking a date never rebuilds the columns.
 */
function DateCell({ rowId, value, onDateChange }: DateCellProps): React.JSX.Element {
	const [open, setOpen] = React.useState(false);
	// Measured at open: the popup sits on the CELL's bottom-start corner, and the
	// trigger sits inside the cell's padding, so the offsets carry that delta.
	const [offsets, setOffsets] = React.useState<PopupOffsets>(DEFAULT_POPUP_OFFSETS);
	const triggerRef = React.useRef<HTMLButtonElement | null>(null);
	const date = parseIsoDay(value);

	const handleOpenChange = React.useCallback((next: boolean): void => {
		const trigger = triggerRef.current;
		const cell = trigger?.closest("td");
		if (next && trigger !== null && cell !== null && cell !== undefined) {
			const triggerRect = trigger.getBoundingClientRect();
			const cellRect = cell.getBoundingClientRect();
			setOffsets({ side: Math.round(cellRect.bottom - triggerRect.bottom), align: Math.round(cellRect.left - triggerRect.left) });
		}
		setOpen(next);
	}, []);

	const handleSelect = React.useCallback(
		(next: Date | undefined): void => {
			onDateChange(rowId, next === undefined ? "" : format(next, ISO_DAY_FORMAT));
			setOpen(false);
		},
		[onDateChange, rowId],
	);

	return (
		<Popover open={open} onOpenChange={handleOpenChange}>
			<PopoverTrigger ref={triggerRef} className="flex min-h-6 w-full cursor-pointer items-center text-start">
				{date === undefined ? <span className="text-xs text-muted-foreground">Pick date</span> : format(date, DISPLAY_DAY_FORMAT)}
			</PopoverTrigger>
			<PopoverContent align="start" side="bottom" sideOffset={offsets.side} alignOffset={offsets.align} className="w-auto p-0">
				<Calendar mode="single" selected={date} defaultMonth={date ?? DEFAULT_RESTOCK_MONTH} onSelect={handleSelect} />
			</PopoverContent>
		</Popover>
	);
}

interface StatusCellProps {
	readonly rowId: string;
	readonly status: ProductStatus;
	readonly onStatusChange: (rowId: string, status: ProductStatus) => void;
}

function renderStatusItem(option: SelectOption<ProductStatus>): React.JSX.Element {
	return (
		<SelectItem key={option.value} value={option.value}>
			<StatusBadge status={option.value} />
		</SelectItem>
	);
}

/**
 * A consumer-level editor: an always-on select with badge-rendered value and
 * items, opened by click or by Enter through onCellEditRequest. The trigger is
 * a button, so clicking it never starts a cell range.
 */
function StatusCell({ rowId, status, onStatusChange }: StatusCellProps): React.JSX.Element {
	const handleValueChange = React.useCallback(
		(next: ProductStatus | null): void => {
			if (next !== null) {
				onStatusChange(rowId, next);
			}
		},
		[onStatusChange, rowId],
	);
	return (
		<Select items={STATUS_OPTIONS} value={status} onValueChange={handleValueChange}>
			{/* Reads as a plain value at rest: the arrow appears only on the focused cell. */}
			<SelectTrigger
				size="sm"
				className="h-6 w-full border-0 bg-transparent px-1 shadow-none [&_svg]:opacity-0 [&_svg]:transition-opacity in-data-[cell-focused]:[&_svg]:opacity-100"
				aria-label="Status">
				<SelectValue>
					<StatusBadge status={status} />
				</SelectValue>
			</SelectTrigger>
			<SelectContent alignItemWithTrigger={false} align="start" sideOffset={8}>
				{STATUS_OPTIONS.map(renderStatusItem)}
			</SelectContent>
		</Select>
	);
}

interface SelectionToastProps {
	readonly count: number;
	readonly bound: DataGridCellSelectionBound | null;
}

/**
 * Selection feedback at the consumer layer: one updating toast summarizes the
 * captured region, so a drag reads as live feedback, not a stack of stale messages.
 */
function SelectionToast({ count, bound }: SelectionToastProps): null {
	const toastIdRef = React.useRef<string | null>(null);
	const shownAtRef = React.useRef(0);
	React.useEffect((): void => {
		if (count < MIN_SELECTION_TOAST_CELLS || bound === null) {
			return;
		}
		const rows = bound.maxRowIndex - bound.minRowIndex + 1;
		const columns = bound.maxColumnIndex - bound.minColumnIndex + 1;
		const description = `Selected ${String(rows)} x ${String(columns)} (${String(count)} cells)`;
		const now = Date.now();
		// Patch the live toast while it can still be open; add a fresh one once it must have timed out.
		if (toastIdRef.current !== null && now - shownAtRef.current < SELECTION_TOAST_REFRESH_MS) {
			toastMessage.update(toastIdRef.current, { description });
		} else {
			toastIdRef.current = toastMessage.info({ description, timeout: SELECTION_TOAST_TIMEOUT_MS });
		}
		shownAtRef.current = now;
	}, [count, bound]);
	return null;
}

// ── Columns ─────────────────────────────────────────────────────────────────

interface ProductCellHandlers {
	readonly onTeamChange: (rowId: string, team: readonly string[]) => void;
	readonly onDateChange: (rowId: string, value: string) => void;
	readonly onStatusChange: (rowId: string, status: ProductStatus) => void;
}

function createColumns({ onTeamChange, onDateChange, onStatusChange }: ProductCellHandlers): ColumnDef<DataGridFeatures, IProduct>[] {
	return [
		{
			accessorKey: "sku",
			header: "SKU",
			cell: ({ row }): string => row.original.sku,
			enableSorting: false,
			size: 90,
			// No cellEdit: copyable but read-only, so a paste over it lands in the rejected list.
			meta: { cellClassName: "text-muted-foreground font-mono text-xs" },
		},
		{
			accessorKey: "name",
			header: ({ column }): React.JSX.Element => <DataGridColumnHeader title="Product" column={column} />,
			cell: ({ row }): string => row.original.name,
			size: 180,
			meta: {
				headerTitle: "Product",
				cellClassName: "font-medium",
				// The grid's built-in flush editor; the textarea grows as long text wraps.
				cellEdit: { control: "textarea" },
			},
		},
		{
			accessorKey: "team",
			header: ({ column }): React.JSX.Element => <DataGridColumnHeader title="Team" column={column} />,
			enableSorting: false,
			cell: ({ row }): React.JSX.Element => <TeamCell rowId={row.id} team={row.original.team} onTeamChange={onTeamChange} />,
			size: 230,
			minSize: 200,
			meta: {
				headerTitle: "Team",
				autoSize: true,
				cellEdit: {
					// The clipboard carries names; parse maps them (or emails) back to ids.
					parse: (raw: string): string[] =>
						raw
							.split(",")
							.map((value: string): string => value.trim().toLowerCase())
							.map(
								(needle: string): string | undefined =>
									MEMBERS.find((member: IMember): boolean => member.name.toLowerCase() === needle || member.email.toLowerCase() === needle)?.id,
							)
							.filter((id: string | undefined): id is string => id !== undefined),
					format: (value: CellData): string => {
						const ids = memberIdsSchema.safeParse(value);
						return ids.success ? memberNames(ids.data) : "";
					},
					clearValue: [],
				},
			},
		},
		{
			accessorKey: "restock",
			header: ({ column }): React.JSX.Element => <DataGridColumnHeader title="Restock" column={column} />,
			cell: ({ row }): React.JSX.Element => <DateCell rowId={row.id} value={row.original.restock} onDateChange={onDateChange} />,
			size: 140,
			meta: {
				headerTitle: "Restock",
				cellEdit: {
					// The clipboard carries the readable date; parse accepts anything Date can read and stores the ISO day.
					parse: (raw: string): string | undefined => {
						const trimmed = raw.trim();
						if (trimmed === "") {
							return "";
						}
						const parsed = new Date(trimmed);
						return Number.isNaN(parsed.getTime()) ? undefined : format(parsed, ISO_DAY_FORMAT);
					},
					format: (value: CellData): string => {
						const iso = z.string().safeParse(value);
						const day = iso.success ? parseIsoDay(iso.data) : undefined;
						return day === undefined ? "" : format(day, DISPLAY_DAY_FORMAT);
					},
					clearValue: "",
				},
			},
		},
		{
			accessorKey: "stock",
			header: ({ column }): React.JSX.Element => <DataGridColumnHeader title="Stock" column={column} />,
			cell: ({ row }): string => String(row.original.stock),
			size: 70,
			meta: {
				headerTitle: "Stock",
				cellClassName: "text-end tabular-nums",
				headerClassName: "justify-end",
				cellEdit: {
					control: "text",
					parse: (raw: string): number | undefined => {
						const parsed = Number.parseInt(raw.replace(/[^0-9-]/g, ""), DECIMAL_RADIX);
						return Number.isNaN(parsed) ? undefined : Math.max(0, parsed);
					},
					clearValue: 0,
				},
			},
		},
		{
			accessorKey: "price",
			header: ({ column }): React.JSX.Element => <DataGridColumnHeader title="Price" column={column} />,
			cell: ({ row }): string => row.original.price.toFixed(PRICE_DECIMALS),
			size: 80,
			meta: {
				headerTitle: "Price",
				cellClassName: "text-end tabular-nums",
				headerClassName: "justify-end",
				cellEdit: {
					control: "text",
					parse: (raw: string): number | undefined => {
						const parsed = Number.parseFloat(raw.replace(/[^0-9.-]/g, ""));
						return Number.isNaN(parsed) ? undefined : parsed;
					},
					format: (value: CellData): string => {
						const price = z.number().safeParse(value);
						return price.success ? price.data.toFixed(PRICE_DECIMALS) : "";
					},
					clearValue: 0,
				},
			},
		},
		{
			accessorKey: "status",
			header: ({ column }): React.JSX.Element => <DataGridColumnHeader title="Status" column={column} />,
			cell: ({ row }): React.JSX.Element => <StatusCell rowId={row.id} status={row.original.status} onStatusChange={onStatusChange} />,
			size: 130,
			meta: {
				headerTitle: "Status",
				cellEdit: {
					// The clipboard carries the label; parse maps it back to the value.
					parse: (raw: string): ProductStatus | undefined => {
						const needle = raw.trim().toLowerCase();
						return STATUS_OPTIONS.find((option: SelectOption<ProductStatus>): boolean => option.label.toLowerCase() === needle || option.value === needle)?.value;
					},
					format: (value: CellData): string => STATUS_OPTIONS.find((option: SelectOption<ProductStatus>): boolean => option.value === value)?.label ?? "",
				},
			},
		},
	];
}

// ── Context menu retargeting ────────────────────────────────────────────────

/** Context-menu events this grid re-dispatched at its trigger; the capture handler lets them through untouched. */
const retargetedContextMenuEvents = new WeakSet<Event>();

interface ContextCell {
	readonly rowId: string;
	readonly columnId: string | null;
}

type ToastChannel = "info" | "error";

export function DataGrid31Example(): React.JSX.Element {
	// Scopes DOM lookups to THIS grid: data-cell-focused persists on a blurred
	// grid, so a document-wide query could hit another instance on the page.
	const cardRef = React.useRef<HTMLDivElement | null>(null);
	// The controller's imperative API; focusCell lands cell focus, DOM focus
	// and aria-activedescendant together on rows that are still mounting.
	const gridApiRef = React.useRef<DataGridCellSelectionApi | null>(null);
	const nextIdRef = React.useRef(DEMO_DATA.length + 1);
	const contextTriggerRef = React.useRef<HTMLDivElement | null>(null);
	// One live toast per channel: the newest replaces the previous before it stacks.
	const copyToastRef = React.useRef<string | null>(null);
	const rejectToastRef = React.useRef<string | null>(null);
	const { copyToClipboard } = useCopyToClipboard();

	const [data, setData] = React.useState<readonly IProduct[]>(DEMO_DATA);
	// Optional CRUD indications: which rows are new or edited, and which cells
	// were touched. Presentational bookkeeping rendered through getRowStatus/getCellStatus.
	const [rowMeta, setRowMeta] = React.useState<Readonly<Record<string, DataGridRowStatus>>>({});
	const [dirtyCells, setDirtyCells] = React.useState<ReadonlySet<string>>(new Set());
	// The resolved selection, straight from the grid: count, bounds and the focused cell.
	const [cellSelection, setCellSelection] = React.useState<DataGridCellSelectionSnapshot | null>(null);
	const [pagination, setPagination] = React.useState<PaginationState>({ pageIndex: 0, pageSize: PAGE_SIZE });
	const [contextCell, setContextCell] = React.useState<ContextCell | null>(null);
	const [confirmDeleteId, setConfirmDeleteId] = React.useState<string | null>(null);

	const contextRowId = contextCell?.rowId ?? null;
	const confirmDeleteRow = data.find((row: IProduct): boolean => row.id === confirmDeleteId);

	const replaceToast = React.useCallback((ref: React.RefObject<string | null>, channel: ToastChannel, description: string): void => {
		if (ref.current !== null) {
			toastMessage.dismiss(ref.current);
		}
		ref.current = channel === "info" ? toastMessage.info({ description }) : toastMessage.error({ description });
	}, []);

	// The single write path: built-in editors, paste, fill, cut, Delete and the
	// custom cell controls all land here, so state stays the only owner of the rows.
	const updateRows = React.useCallback((writes: readonly ProductCellWrite[]): void => {
		if (writes.length === 0) {
			return;
		}
		setData((previous: readonly IProduct[]): readonly IProduct[] =>
			previous.map((row: IProduct): IProduct =>
				applyProductWrites(
					row,
					writes.filter((write: ProductCellWrite): boolean => write.rowId === row.id),
				),
			),
		);
		setRowMeta((previous: Readonly<Record<string, DataGridRowStatus>>): Readonly<Record<string, DataGridRowStatus>> => {
			const next: Record<string, DataGridRowStatus> = { ...previous };
			for (const write of writes) {
				if (next[write.rowId] !== "new") {
					next[write.rowId] = "dirty";
				}
			}
			return next;
		});
		setDirtyCells((previous: ReadonlySet<string>): ReadonlySet<string> => {
			const next = new Set(previous);
			for (const write of writes) {
				next.add(`${write.rowId}:${write.columnId}`);
			}
			return next;
		});
	}, []);

	const handleTeamChange = React.useCallback(
		(rowId: string, team: readonly string[]): void => {
			updateRows([{ rowId, columnId: "team", value: team }]);
		},
		[updateRows],
	);

	const handleDateChange = React.useCallback(
		(rowId: string, value: string): void => {
			updateRows([{ rowId, columnId: "restock", value }]);
		},
		[updateRows],
	);

	const handleStatusChange = React.useCallback(
		(rowId: string, status: ProductStatus): void => {
			updateRows([{ rowId, columnId: "status", value: status }]);
		},
		[updateRows],
	);

	const handleCellsChange = React.useCallback(
		(details: DataGridCellsChangeDetails<IProduct>): void => {
			updateRows(details.changes);
			// A paste, fill or edit the parsers refused must not die silently.
			if (details.rejected.length > 0) {
				replaceToast(rejectToastRef, "error", `${pluralize(details.rejected.length, "value", "values")} could not be applied`);
			}
		},
		[replaceToast, updateRows],
	);

	const columns = React.useMemo(
		(): ColumnDef<DataGridFeatures, IProduct>[] => createColumns({ onTeamChange: handleTeamChange, onDateChange: handleDateChange, onStatusChange: handleStatusChange }),
		[handleDateChange, handleStatusChange, handleTeamChange],
	);

	const table = useTable({
		features: dataGridFeatures,
		columns,
		data,
		getRowId,
		state: { pagination },
		// Every commit replaces `data`; without this, editing on page 2 would snap back to page 1.
		autoResetPageIndex: false,
		onPaginationChange: setPagination,
	});

	// Consumer-level editing: text columns use the grid's built-in editor, so
	// only the custom-control columns arrive here. Enter focuses the focused
	// cell's own control and clicks it, the exact toggle a mouse click performs.
	const handleCellEditRequest = React.useCallback((request: DataGridCellEditRequest<IProduct>): void => {
		// Deliberate activation only (Enter, F2, double-click): a stray keystroke
		// must not click a control it cannot type into.
		if (request.initialText !== undefined) {
			return;
		}
		const card = cardRef.current;
		if (card === null) {
			return;
		}
		for (const candidate of CELL_CONTROL_SELECTORS) {
			const control = card.querySelector<HTMLElement>(`${FOCUSED_CELL_SELECTOR} ${candidate}`);
			if (control !== null) {
				control.focus();
				control.click();
				// The combobox input opens its list from the keyboard, not from a synthetic click.
				if (control instanceof HTMLInputElement) {
					control.dispatchEvent(new KeyboardEvent("keydown", { key: "ArrowDown", bubbles: true, cancelable: true }));
				}
				return;
			}
		}
	}, []);

	// Quick create: one empty row appended, landing where pagination puts it.
	// The grid jumps to that page and focusCell retries until the row mounts.
	const handleRowCreate = React.useCallback((): void => {
		const sequence = nextIdRef.current;
		nextIdRef.current += 1;
		const id = `p${String(sequence)}`;
		setData((previous: readonly IProduct[]): readonly IProduct[] => [
			...previous,
			{ id, sku: `PR-${String(sequence).padStart(SKU_DIGITS, "0")}`, name: "", team: [], restock: "", stock: 0, price: 0, status: "active" },
		]);
		setRowMeta((previous: Readonly<Record<string, DataGridRowStatus>>): Readonly<Record<string, DataGridRowStatus>> => ({ ...previous, [id]: "new" }));
		setPagination((previous: PaginationState): PaginationState => ({ ...previous, pageIndex: Math.ceil((data.length + 1) / previous.pageSize) - 1 }));
		gridApiRef.current?.focusCell(id, "name");
	}, [data.length]);

	const duplicateRow = React.useCallback(
		(rowId: string): void => {
			const index = data.findIndex((row: IProduct): boolean => row.id === rowId);
			const source = data.at(index);
			if (index < 0 || source === undefined) {
				return;
			}
			const id = `p${String(nextIdRef.current)}`;
			nextIdRef.current += 1;
			setData((previous: readonly IProduct[]): readonly IProduct[] => [
				...previous.slice(0, index + 1),
				{ ...source, id, name: `${source.name} copy` },
				...previous.slice(index + 1),
			]);
			setRowMeta((previous: Readonly<Record<string, DataGridRowStatus>>): Readonly<Record<string, DataGridRowStatus>> => ({ ...previous, [id]: "new" }));
			gridApiRef.current?.focusCell(id, "name");
		},
		[data],
	);

	const getGridViewport = React.useCallback((): HTMLElement | null => cardRef.current?.querySelector<HTMLElement>('[data-slot="data-grid-table-viewport"]') ?? null, []);

	// Copies whatever the grid would copy: the active region, which the
	// right-click just focused unless it landed inside a selection.
	const handleCopySelection = React.useCallback((): void => {
		const grid = getDataGridActiveRegionGrid(table, getGridViewport());
		if (grid === null) {
			return;
		}
		copyToClipboard(serializeDataGridClipboardText(grid));
		replaceToast(copyToastRef, "info", `Copied ${pluralize(countCells(grid), "cell", "cells")} to clipboard`);
	}, [copyToClipboard, getGridViewport, replaceToast, table]);

	const handleClearSelection = React.useCallback((): void => {
		const details = buildDataGridClearDetails(table, "clear", false, getGridViewport());
		if (details !== null) {
			handleCellsChange(details);
		}
	}, [getGridViewport, handleCellsChange, table]);

	const handleEditCell = React.useCallback((): void => {
		if (contextCell?.columnId !== null && contextCell?.columnId !== undefined) {
			gridApiRef.current?.focusCell(contextCell.rowId, contextCell.columnId, { edit: true });
		}
	}, [contextCell]);

	const handleDuplicateRow = React.useCallback((): void => {
		if (contextRowId !== null) {
			duplicateRow(contextRowId);
		}
	}, [contextRowId, duplicateRow]);

	const handleCopyRow = React.useCallback((): void => {
		const row = data.find((candidate: IProduct): boolean => candidate.id === contextRowId);
		if (row === undefined) {
			return;
		}
		copyToClipboard([row.name, memberNames(row.team), row.restock, String(row.stock), row.price.toFixed(PRICE_DECIMALS), row.status].join("\t"));
		replaceToast(copyToastRef, "info", "Row copied to clipboard");
	}, [contextRowId, copyToClipboard, data, replaceToast]);

	const handleRequestDelete = React.useCallback((): void => {
		if (contextRowId !== null) {
			setConfirmDeleteId(contextRowId);
		}
	}, [contextRowId]);

	const handleConfirmDelete = React.useCallback((): void => {
		if (confirmDeleteId !== null) {
			const remaining = data.filter((row: IProduct): boolean => row.id !== confirmDeleteId);
			setData(remaining);
			// The removed row may have been the last page's only row; clamp back.
			setPagination((previous: PaginationState): PaginationState => ({
				...previous,
				pageIndex: Math.min(previous.pageIndex, Math.max(0, Math.ceil(remaining.length / previous.pageSize) - 1)),
			}));
		}
		setConfirmDeleteId(null);
	}, [confirmDeleteId, data]);

	const handleDeleteDialogOpenChange = React.useCallback((open: boolean): void => {
		if (!open) {
			setConfirmDeleteId(null);
		}
	}, []);

	const handleCellsCopy = React.useCallback(
		({ grid, cut }: DataGridCopyDetails): void => {
			replaceToast(copyToastRef, "info", `${cut ? "Cut" : "Copied"} ${pluralize(countCells(grid), "cell", "cells")} to clipboard`);
		},
		[replaceToast],
	);

	const getRowStatus = React.useCallback((row: IProduct): DataGridRowStatus | undefined => rowMeta[row.id], [rowMeta]);

	const getCellStatus = React.useCallback(
		(row: IProduct, columnId: string): DataGridCellStatus | undefined => (dirtyCells.has(`${row.id}:${columnId}`) ? "dirty" : undefined),
		[dirtyCells],
	);

	const handleContextMenuOpenChange = React.useCallback((open: boolean): void => {
		if (open) {
			return;
		}
		cardRef.current?.querySelectorAll("[data-context-open]").forEach((rowElement: Element): void => {
			rowElement.removeAttribute("data-context-open");
		});
		setContextCell(null);
	}, []);

	// Cell and row actions behind one context menu, scoped by where the press
	// landed. The rows render inside the primitive, so one trigger wraps the
	// whole grid and this capture handler records the cell. Suppressing the
	// capture stops the menu from opening over headers and empty space.
	const handleContextMenuCapture = React.useCallback(
		(event: React.MouseEvent<HTMLDivElement>): void => {
			if (retargetedContextMenuEvents.has(event.nativeEvent)) {
				return;
			}
			const { target } = event;
			if (!(target instanceof Element)) {
				return;
			}
			const rowElement = target.closest("tr[data-row-id]");
			const rowId = rowElement?.getAttribute("data-row-id") ?? null;
			if (rowElement === null || rowId === null) {
				event.stopPropagation();
				return;
			}
			const cell = target.closest("td[data-col-id]");
			const columnId = cell?.getAttribute("data-col-id") ?? null;
			setContextCell({ rowId, columnId });
			// Anchor the menu visually to its row WITHOUT touching the checkbox row selection.
			rowElement.setAttribute("data-context-open", "");
			// The spreadsheet standard: right-click focuses the cell it landed on
			// (keeping an existing selection it sits inside). Visual focus only —
			// DOM focus stays with the menu, so its keys never fight the grid's.
			if (columnId !== null && cell?.hasAttribute("data-cell-selected") !== true) {
				table.setFocusedCell(rowId, columnId);
			}
			// A custom control can swallow the contextmenu before the trigger sees
			// it: prevent the control's defaults and retarget the press at the
			// trigger, so the menu owns the gesture on every cell.
			if (target.closest(INTERACTIVE_CONTROL_SELECTOR) !== null) {
				event.preventDefault();
				event.stopPropagation();
				const retarget = new MouseEvent("contextmenu", { bubbles: true, cancelable: true, clientX: event.clientX, clientY: event.clientY });
				retargetedContextMenuEvents.add(retarget);
				contextTriggerRef.current?.dispatchEvent(retarget);
			}
		},
		[table],
	);

	return (
		<DataGrid
			table={table}
			recordCount={data.length}
			onCellsChange={handleCellsChange}
			onCellEditRequest={handleCellEditRequest}
			onCellSelectionChange={setCellSelection}
			onCellsCopy={handleCellsCopy}
			getRowStatus={getRowStatus}
			getCellStatus={getCellStatus}
			tableLayout={TABLE_LAYOUT}
			tableClassNames={TABLE_CLASS_NAMES}>
			<Card ref={cardRef} className="w-full gap-3 py-3.5">
				<CardHeader className="items-center px-3.5">
					<CardTitle>Products</CardTitle>
					<CardAction>
						<Button size="sm" variant="outline" onClick={handleRowCreate}>
							Add row
						</Button>
					</CardAction>
				</CardHeader>
				<ContextMenu onOpenChange={handleContextMenuOpenChange}>
					<ContextMenuTrigger ref={contextTriggerRef} onContextMenuCapture={handleContextMenuCapture}>
						<DataGridContainer className="border-y">
							<DataGridScrollArea>
								<DataGridTable />
							</DataGridScrollArea>
							<DataGridCellSelection apiRef={gridApiRef} />
						</DataGridContainer>
					</ContextMenuTrigger>
					<ContextMenuContent className="w-44">
						{/* Labels must live inside a Group: the label wires itself to the surrounding group. */}
						<ContextMenuGroup>
							<ContextMenuLabel>Cell</ContextMenuLabel>
							<ContextMenuItem onClick={handleEditCell}>Edit cell</ContextMenuItem>
							<ContextMenuItem onClick={handleCopySelection}>Copy</ContextMenuItem>
							<ContextMenuItem onClick={handleClearSelection}>Clear</ContextMenuItem>
						</ContextMenuGroup>
						<ContextMenuSeparator />
						<ContextMenuGroup>
							<ContextMenuLabel>Row</ContextMenuLabel>
							<ContextMenuItem onClick={handleDuplicateRow}>Duplicate</ContextMenuItem>
							<ContextMenuItem onClick={handleCopyRow}>Copy row</ContextMenuItem>
							<ContextMenuItem className="text-destructive" onClick={handleRequestDelete}>
								Delete row
							</ContextMenuItem>
						</ContextMenuGroup>
					</ContextMenuContent>
				</ContextMenu>
				<CardFooter className="border-none bg-transparent! px-3.5 py-0">
					<DataGridPagination />
				</CardFooter>
			</Card>
			<SelectionToast count={cellSelection?.visibleCellCount ?? 0} bound={cellSelection?.activeBound ?? null} />
			<AlertDialog open={confirmDeleteId !== null} onOpenChange={handleDeleteDialogOpenChange}>
				<AlertDialogContent>
					<AlertDialogHeader>
						<AlertDialogTitle>Delete this row?</AlertDialogTitle>
						<AlertDialogDescription>
							{confirmDeleteRow === undefined || confirmDeleteRow.name === "" ? "The row is removed from the grid." : `"${confirmDeleteRow.name}" is removed from the grid.`}{" "}
							This cannot be undone.
						</AlertDialogDescription>
					</AlertDialogHeader>
					<AlertDialogFooter>
						<AlertDialogCancel>Cancel</AlertDialogCancel>
						<AlertDialogAction variant="destructive" onClick={handleConfirmDelete}>
							Delete
						</AlertDialogAction>
					</AlertDialogFooter>
				</AlertDialogContent>
			</AlertDialog>
		</DataGrid>
	);
}
