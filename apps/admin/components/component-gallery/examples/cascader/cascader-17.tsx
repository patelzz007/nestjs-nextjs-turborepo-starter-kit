"use client";

import * as React from "react";
import {
	AppWindowIcon,
	ArchiveIcon,
	BanknoteIcon,
	BuildingIcon,
	CalendarCheckIcon,
	CalendarClockIcon,
	CalendarIcon,
	CircleDashedIcon,
	CreditCardIcon,
	GlobeIcon,
	HashIcon,
	HouseIcon,
	LayersIcon,
	ListIcon,
	MailIcon,
	MapPinIcon,
	MonitorIcon,
	PackageIcon,
	PhoneIcon,
	QrCodeIcon,
	ReceiptIcon,
	RepeatIcon,
	RotateCcwIcon,
	RouteIcon,
	ShoppingCartIcon,
	StoreIcon,
	TagIcon,
	TargetIcon,
	TimerIcon,
	TruckIcon,
	TypeIcon,
	UserCheckIcon,
	UsersIcon,
	WalletIcon,
	WifiIcon,
	XIcon,
} from "lucide-react";
import { useCallback, useState } from "react";
import { Badge } from "@workspace/ui/components/badge";
import {
	Cascader,
	CascaderContent,
	CascaderEmpty,
	CascaderList,
	CascaderPanel,
	CascaderStatus,
	CascaderTrigger,
	useCascaderSelection,
} from "@workspace/ui/components/cascader/cascader";
import { CascaderItems } from "@workspace/ui/components/cascader/cascader-item";
import { CascaderBreadcrumb, CascaderInput, CascaderNav, CascaderValue } from "@workspace/ui/components/cascader/cascader-nav";
import type { CascaderNode, CascaderNodeBase } from "@workspace/ui/components/cascader/cascader-types";

import { Button } from "@workspace/ui/components/button";

/* -------------------------------------------------------------------------- */
/*                                    Icons                                   */
/* -------------------------------------------------------------------------- */

/**
 * One glyph per THING, never one glyph per LEVEL.
 *
 * This example used to draw the same table icon on all eight tables and the
 * same column icon on every column under them, which is the shape of an icon
 * without any of the use: a marker repeated down a level tells you where you
 * are, which the breadcrumb already said, and nothing about the row it is on.
 * So a table gets the icon of its subject and a column gets the icon of its
 * TYPE - money, timestamp, identifier, geography - and the run of icons down a
 * level becomes a second, faster reading of the level's shape.
 *
 * Written out one by one because `IconPlaceholder` resolves its five names at
 * build time: a helper that took the names as arguments would hand it dynamic
 * values, and `shadcn add` would emit a component that imports nothing.
 *
 * These are decoration, not state, so none of them pins its colour. The row's
 * own `data-highlighted:**:text-accent-foreground` is meant to reach them: the
 * icon belongs to the row and should follow it. A mark that carries MEANING -
 * a check, a status dot - is the case that has to pin both levels.
 */

const usersIcon = <UsersIcon className="size-4" />;
const cartIcon = <ShoppingCartIcon className="size-4" />;
const packageIcon = <PackageIcon className="size-4" />;
const receiptIcon = <ReceiptIcon className="size-4" />;
const truckIcon = <TruckIcon className="size-4" />;
const undoIcon = <RotateCcwIcon className="size-4" />;
const repeatIcon = <RepeatIcon className="size-4" />;
const monitorIcon = <MonitorIcon className="size-4" />;
const houseIcon = <HouseIcon className="size-4" />;
const cardIcon = <CreditCardIcon className="size-4" />;

const textIcon = <TypeIcon className="size-4" />;
const mailIcon = <MailIcon className="size-4" />;
const phoneIcon = <PhoneIcon className="size-4" />;
const moneyIcon = <BanknoteIcon className="size-4" />;
const hashIcon = <HashIcon className="size-4" />;
const codeIcon = <QrCodeIcon className="size-4" />;
const routeIcon = <RouteIcon className="size-4" />;
const statusIcon = <CircleDashedIcon className="size-4" />;
const calendarIcon = <CalendarIcon className="size-4" />;
const calendarDueIcon = <CalendarClockIcon className="size-4" />;
const calendarDoneIcon = <CalendarCheckIcon className="size-4" />;
const timerIcon = <TimerIcon className="size-4" />;
const pinIcon = <MapPinIcon className="size-4" />;
const globeIcon = <GlobeIcon className="size-4" />;
const buildingIcon = <BuildingIcon className="size-4" />;
const targetIcon = <TargetIcon className="size-4" />;
const tagIcon = <TagIcon className="size-4" />;
const storeIcon = <StoreIcon className="size-4" />;
const listIcon = <ListIcon className="size-4" />;
const walletIcon = <WalletIcon className="size-4" />;
const archiveIcon = <ArchiveIcon className="size-4" />;
const layersIcon = <LayersIcon className="size-4" />;
const approvedIcon = <UserCheckIcon className="size-4" />;
const browserIcon = <AppWindowIcon className="size-4" />;
const wifiIcon = <WifiIcon className="size-4" />;

/* -------------------------------------------------------------------------- */
/*                                    Data                                    */
/* -------------------------------------------------------------------------- */

/**
 * Eight tables, each with six or more columns, and two of them with a nested
 * group inside.
 *
 * The child levels used to hold two or three columns, which made every drill a
 * dead end: you pressed a table, saw less than fits on one screen of the panel
 * and pressed Back. A level worth entering has to be worth SEARCHING, which is
 * the whole reason the panel carries an input, so no branch here bottoms out
 * under six. `Customers / Address` and `Orders / Payment` go one level deeper
 * again, because a three-level path is what makes the breadcrumb, the Back
 * affordance and the deep-search result path do any work at all.
 *
 * Several tables carry a "Name", a "Status" and a "Created at" of their own.
 * The duplicate labels are the point: a bare chip saying "Status" four times is
 * worthless, so the chip label below is built from the node's PATH.
 */
const fields: readonly CascaderNode[] = [
	{
		value: "customers",
		label: "Customers",
		icon: usersIcon,
		children: [
			{ value: "customers.name", label: "Name", icon: textIcon },
			{ value: "customers.email", label: "Email", icon: mailIcon },
			{ value: "customers.phone", label: "Phone", icon: phoneIcon },
			{ value: "customers.segment", label: "Segment", icon: tagIcon },
			{
				value: "customers.lifetime_value",
				label: "Lifetime value",
				icon: moneyIcon,
			},
			{ value: "customers.signed_up", label: "Signed up", icon: calendarIcon },
			{
				value: "customers.address",
				label: "Address",
				icon: houseIcon,
				children: [
					{
						value: "customers.address.street",
						label: "Street",
						icon: textIcon,
					},
					{
						value: "customers.address.city",
						label: "City",
						icon: buildingIcon,
					},
					{
						value: "customers.address.postal_code",
						label: "Postal code",
						icon: hashIcon,
					},
					{
						value: "customers.address.region",
						label: "Region",
						icon: pinIcon,
					},
					{
						value: "customers.address.country",
						label: "Country",
						icon: globeIcon,
					},
					{
						value: "customers.address.coordinates",
						label: "Coordinates",
						icon: targetIcon,
					},
				],
			},
		],
	},
	{
		value: "orders",
		label: "Orders",
		icon: cartIcon,
		children: [
			{ value: "orders.number", label: "Order number", icon: hashIcon },
			{ value: "orders.total", label: "Total", icon: moneyIcon },
			{ value: "orders.status", label: "Status", icon: statusIcon },
			{ value: "orders.channel", label: "Channel", icon: storeIcon },
			{ value: "orders.line_items", label: "Line items", icon: listIcon },
			{ value: "orders.placed_at", label: "Placed at", icon: calendarIcon },
			{
				value: "orders.payment",
				label: "Payment",
				icon: cardIcon,
				children: [
					{
						value: "orders.payment.method",
						label: "Method",
						icon: walletIcon,
					},
					{
						value: "orders.payment.card_brand",
						label: "Card brand",
						icon: cardIcon,
					},
					{
						value: "orders.payment.last_four",
						label: "Last four",
						icon: hashIcon,
					},
					{
						value: "orders.payment.authorized_at",
						label: "Authorized at",
						icon: calendarIcon,
					},
					{
						value: "orders.payment.captured_at",
						label: "Captured at",
						icon: calendarDoneIcon,
					},
					{
						value: "orders.payment.processor_fee",
						label: "Processor fee",
						icon: moneyIcon,
					},
				],
			},
		],
	},
	{
		value: "products",
		label: "Products",
		icon: packageIcon,
		children: [
			{ value: "products.name", label: "Name", icon: textIcon },
			{ value: "products.sku", label: "SKU", icon: codeIcon },
			{ value: "products.price", label: "Price", icon: moneyIcon },
			{ value: "products.stock", label: "Stock on hand", icon: archiveIcon },
			{ value: "products.category", label: "Category", icon: tagIcon },
			{ value: "products.created_at", label: "Created at", icon: calendarIcon },
		],
	},
	{
		value: "invoices",
		label: "Invoices",
		icon: receiptIcon,
		children: [
			{ value: "invoices.number", label: "Number", icon: hashIcon },
			{ value: "invoices.amount_due", label: "Amount due", icon: moneyIcon },
			{ value: "invoices.status", label: "Status", icon: statusIcon },
			{ value: "invoices.issued_at", label: "Issued at", icon: calendarIcon },
			{ value: "invoices.due_date", label: "Due date", icon: calendarDueIcon },
			{ value: "invoices.paid_at", label: "Paid at", icon: calendarDoneIcon },
		],
	},
	{
		value: "shipments",
		label: "Shipments",
		icon: truckIcon,
		children: [
			{ value: "shipments.carrier", label: "Carrier", icon: truckIcon },
			{
				value: "shipments.tracking",
				label: "Tracking number",
				icon: routeIcon,
			},
			{ value: "shipments.destination", label: "Destination", icon: pinIcon },
			{ value: "shipments.status", label: "Status", icon: statusIcon },
			{
				value: "shipments.shipped_at",
				label: "Shipped at",
				icon: calendarIcon,
			},
			{
				value: "shipments.delivered_at",
				label: "Delivered at",
				icon: calendarDoneIcon,
			},
		],
	},
	{
		value: "refunds",
		label: "Refunds",
		icon: undoIcon,
		children: [
			{ value: "refunds.amount", label: "Amount", icon: moneyIcon },
			{ value: "refunds.reason", label: "Reason", icon: textIcon },
			{ value: "refunds.status", label: "Status", icon: statusIcon },
			{
				value: "refunds.approved_by",
				label: "Approved by",
				icon: approvedIcon,
			},
			{
				value: "refunds.requested_at",
				label: "Requested at",
				icon: calendarIcon,
			},
			{
				value: "refunds.processed_at",
				label: "Processed at",
				icon: calendarDoneIcon,
			},
		],
	},
	{
		value: "subscriptions",
		label: "Subscriptions",
		icon: repeatIcon,
		children: [
			{ value: "subscriptions.plan", label: "Plan", icon: layersIcon },
			{ value: "subscriptions.seats", label: "Seats", icon: usersIcon },
			{
				value: "subscriptions.mrr",
				label: "Monthly revenue",
				icon: moneyIcon,
			},
			{ value: "subscriptions.status", label: "Status", icon: statusIcon },
			{
				value: "subscriptions.started_at",
				label: "Started at",
				icon: calendarIcon,
			},
			{
				value: "subscriptions.renews_at",
				label: "Renews at",
				icon: calendarDueIcon,
			},
		],
	},
	{
		value: "sessions",
		label: "Sessions",
		icon: monitorIcon,
		children: [
			{ value: "sessions.device", label: "Device", icon: monitorIcon },
			{ value: "sessions.browser", label: "Browser", icon: browserIcon },
			{ value: "sessions.ip_address", label: "IP address", icon: wifiIcon },
			{ value: "sessions.location", label: "Location", icon: pinIcon },
			{ value: "sessions.started_at", label: "Started at", icon: calendarIcon },
			{ value: "sessions.duration", label: "Duration", icon: timerIcon },
		],
	},
];

/* -------------------------------------------------------------------------- */
/*                                    Chips                                   */
/* -------------------------------------------------------------------------- */

/**
 * The chip row, rendered by the CONSUMER.
 *
 * `useCascaderSelection` hands back the resolved nodes and their ancestor
 * chains plus `remove`, which is everything a chip needs - so the chip is an
 * ordinary ReUI `Badge` with a ghost icon `Button` in it, styled by the design
 * system rather than by the primitive. `CascaderChips` remains for the case
 * where the chips ARE the trigger surface; this is the other shape, where the
 * trigger stays a button and the chips live beside it.
 *
 * There is no "Clear all" here on purpose. The row is a set of individual
 * removals, and a second, differently shaped control sitting in the same flex
 * wrap read as one more chip - one that silently threw the whole selection
 * away. `clear` is on the hook for the case where a page has a real place to
 * put it.
 */
/** One removable chip: the column's whole chain, and a press that drops it. */
function ColumnChip({
	path,
	value,
	onRemove,
}: {
	readonly path: readonly CascaderNodeBase[];
	readonly value: string;
	readonly onRemove: (value: string) => void;
}): React.JSX.Element {
	/**
	 * The WHOLE chain, not just the parent.
	 *
	 * Four tables have a "Status" and three have a "Created at", so a bare
	 * label is ambiguous - and now that two tables carry a nested group,
	 * one level of parent is ambiguous too: "Address / Country" does not
	 * say which table's address it came from. The chip is the only place
	 * the choice survives after the panel closes, so it carries the path
	 * that would let you find the column again.
	 */
	const label = path.map((ancestor) => ancestor.label).join(" / ");
	const handleRemove = useCallback((): void => {
		onRemove(value);
	}, [onRemove, value]);

	return (
		<Badge variant="secondary" className="gap-0.5">
			{label}
			<Button variant="ghost" size="icon" aria-label={`Remove ${label}`} onClick={handleRemove} className="size-3 hover:bg-transparent">
				<XIcon />
			</Button>
		</Badge>
	);
}

function ColumnChips(): React.JSX.Element {
	const { paths, isEmpty, remove } = useCascaderSelection();

	if (isEmpty) {
		return <p className="text-sm text-muted-foreground">No columns yet. Pick a table to start.</p>;
	}

	// Driven off `paths` rather than `selected`, because a path carries the
	// ancestors AND its own leaf - and `selected` drops values the index cannot
	// resolve, so the two arrays are not guaranteed to line up index for index.
	return (
		<div className="flex flex-wrap items-center gap-1.5">
			{paths.map((path) => {
				const node = path.at(-1);
				if (node === undefined) return null;
				return <ColumnChip key={node.value} path={path} value={node.value} onRemove={remove} />;
			})}
		</div>
	);
}

/**
 * Chips instead of "3 selected".
 *
 * A report builder is the case for it: you need to see what you already picked
 * and drop one of them without reopening the panel. Labels repeat across the
 * tables - four of them have a "Status" - so a chip carries its full path
 * rather than the column name on its own.
 *
 * The wrapper pins itself to the TOP of the preview surface (`self-start`,
 * plus `items-start` for the case where a host stretches it). Both the docs
 * frame and the catalog card centre their child vertically, and the chip row
 * wraps onto a new line as columns are added, so a centred demo shifts the
 * trigger every time you pick one. `pt-6` keeps the top edge deliberate rather
 * than flush.
 *
 * `max-w-md` rather than the usual field width, because the chips are the
 * second half of this example and a three-segment path is a wide chip: at
 * `max-w-sm` each one owned a line of its own and the row stopped reading as a
 * row.
 */
export function Cascader17Example(): React.JSX.Element {
	const [value, setValue] = useState<readonly string[]>([]);
	const handleValueChange = useCallback((next: readonly string[]): void => {
		setValue(next);
	}, []);

	return (
		<div className="flex w-full items-start justify-center self-start px-4 pt-6 pb-4">
			<div className="flex w-full max-w-md flex-col gap-3">
				<Cascader multiple items={fields} value={value} onValueChange={handleValueChange}>
					<CascaderTrigger aria-label="Report columns" render={<Button variant="outline" className="w-full justify-between gap-2 font-normal" />}>
						<CascaderValue placeholder="Add a column..." display="count" />
					</CascaderTrigger>

					<CascaderContent className="w-80">
						<CascaderPanel>
							<CascaderNav>
								<CascaderInput />
							</CascaderNav>
							<CascaderBreadcrumb />
							<CascaderEmpty />
							<CascaderList>
								<CascaderItems />
							</CascaderList>
							<CascaderStatus />
						</CascaderPanel>
					</CascaderContent>

					<ColumnChips />
				</Cascader>
			</div>
		</div>
	);
}
