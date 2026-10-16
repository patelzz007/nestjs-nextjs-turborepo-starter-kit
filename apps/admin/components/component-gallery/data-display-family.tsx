"use client";

import { PLATFORM_DISPLAY_REGION } from "@workspace/shared";
import { Badge } from "@workspace/ui/components/badge";
import { Button } from "@workspace/ui/components/button";
import { Card, CardAction, CardContent, CardDescription, CardFooter, CardHeader, CardTitle } from "@workspace/ui/components/card";
import { IconTile, type IconTileTone } from "@workspace/ui/components/icon-tile";
import { KpiStatCard, type KpiChange } from "@workspace/ui/components/kpi-stat-card";
import { Label } from "@workspace/ui/components/label";
import { RelativeTime } from "@workspace/ui/components/relative-time";
import { Separator } from "@workspace/ui/components/separator";
import { StatCard } from "@workspace/ui/components/stat-card";
import { Switch } from "@workspace/ui/components/switch";
import { Table, TableBody, TableCaption, TableCell, TableFooter, TableHead, TableHeader, TableRow } from "@workspace/ui/components/table";
import { Gift, MoreHorizontal, ShoppingBag, Store, Users, Wallet } from "lucide-react";
import * as React from "react";
import { z } from "zod";

import { GALLERY_ENTRIES } from "@/components/component-gallery/gallery-catalog";
import { ComponentSection, DemoRow, DemoSurface, ExampleOnlySections } from "@/components/component-gallery/gallery-section";
import { DataTableShowcase } from "@/components/showcase/data-table-showcase";

// ── Card ────────────────────────────────────────────────────────────────────

function CardDemo(): React.JSX.Element {
	return (
		<DemoSurface>
			<div className="grid gap-4 md:grid-cols-2">
				<Card>
					<CardHeader>
						<CardTitle>Store settings</CardTitle>
						<CardDescription>Default size: header, content and footer.</CardDescription>
						<CardAction>
							<Button type="button" variant="ghost" size="icon-sm" aria-label="More options">
								<MoreHorizontal />
							</Button>
						</CardAction>
					</CardHeader>
					<CardContent className="text-sm text-muted-foreground">The card groups one topic; the action sits in the header&apos;s corner.</CardContent>
					<CardFooter className="gap-2">
						<Button type="button" size="sm">
							Save
						</Button>
						<Button type="button" size="sm" variant="outline">
							Cancel
						</Button>
					</CardFooter>
				</Card>
				<Card size="sm">
					<CardHeader>
						<CardTitle>Compact card</CardTitle>
						<CardDescription>size=&quot;sm&quot; tightens the spacing.</CardDescription>
					</CardHeader>
					<CardContent className="text-sm text-muted-foreground">For dense dashboards and side panels.</CardContent>
				</Card>
			</div>
		</DemoSurface>
	);
}

// ── Stat cards ──────────────────────────────────────────────────────────────

function StatCardDemo(): React.JSX.Element {
	return (
		<DemoSurface>
			<div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
				<StatCard label="Active merchants" value="1,284" hint="+42 this week" icon={<Store />} tone="brand" />
				<StatCard label="Rewards claimed" value="18,930" hint="Across every store" icon={<Gift />} tone="green" />
				<StatCard label="Open disputes" value="7" hint="2 need a reply today" icon={<Wallet />} tone="red" />
			</div>
		</DemoSurface>
	);
}

const REVENUE_UP: KpiChange = { status: "change", direction: "up", sentiment: "positive", label: "+12.4%" };
const REFUNDS_UP: KpiChange = { status: "change", direction: "up", sentiment: "negative", label: "+3.1%" };
const USERS_FLAT: KpiChange = { status: "change", direction: "flat", sentiment: "neutral", label: "0.0%" };
const NEW_METRIC: KpiChange = { status: "noPrevious", label: "New this period" };
const KPI_COMPARISON_LABEL = "vs the previous 30 days";

function KpiStatCardDemo(): React.JSX.Element {
	const [isLoading, setIsLoading] = React.useState<boolean>(false);

	return (
		<DemoSurface>
			<div className="flex items-center gap-2">
				<Switch id="gallery-kpi-loading" checked={isLoading} onCheckedChange={setIsLoading} />
				<Label htmlFor="gallery-kpi-loading">Loading</Label>
			</div>
			<div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
				<KpiStatCard label="Revenue" value="RM 48,210" change={REVENUE_UP} comparisonLabel={KPI_COMPARISON_LABEL} icon={ShoppingBag} iconTone="green" isLoading={isLoading} />
				<KpiStatCard label="Refunds" value="RM 1,940" change={REFUNDS_UP} comparisonLabel={KPI_COMPARISON_LABEL} icon={Wallet} iconTone="red" isLoading={isLoading} />
				<KpiStatCard label="Active users" value="9,312" change={USERS_FLAT} comparisonLabel={KPI_COMPARISON_LABEL} icon={Users} iconTone="blue" isLoading={isLoading} />
				<KpiStatCard label="Referrals" value="214" change={NEW_METRIC} icon={Gift} iconTone="violet" isLoading={isLoading} />
			</div>
		</DemoSurface>
	);
}

// ── Table ───────────────────────────────────────────────────────────────────

interface InvoiceRow {
	readonly id: string;
	readonly merchant: string;
	readonly status: string;
	readonly amount: string;
}

const INVOICES: readonly InvoiceRow[] = [
	{ id: "INV-001", merchant: "Acme Coffee", status: "Paid", amount: "RM 250.00" },
	{ id: "INV-002", merchant: "Bayview Books", status: "Pending", amount: "RM 150.00" },
	{ id: "INV-003", merchant: "Corner Bakery", status: "Overdue", amount: "RM 350.00" },
];
const INVOICES_TOTAL = "RM 750.00";
/** The row the demo shows in its selected state. */
const SELECTED_INVOICE_ID = "INV-002";

function TableDemo(): React.JSX.Element {
	return (
		<DemoSurface>
			<Table>
				<TableCaption>Recent invoices — the second row shows the selected state.</TableCaption>
				<TableHeader>
					<TableRow>
						<TableHead scope="col">Invoice</TableHead>
						<TableHead scope="col">Merchant</TableHead>
						<TableHead scope="col">Status</TableHead>
						<TableHead scope="col" className="text-end">
							Amount
						</TableHead>
					</TableRow>
				</TableHeader>
				<TableBody>
					{INVOICES.map((invoice) => (
						<TableRow key={invoice.id} data-state={invoice.id === SELECTED_INVOICE_ID ? "selected" : undefined}>
							<TableCell className="font-medium">{invoice.id}</TableCell>
							<TableCell>{invoice.merchant}</TableCell>
							<TableCell>
								<Badge variant="secondary">{invoice.status}</Badge>
							</TableCell>
							<TableCell className="text-end tabular-nums">{invoice.amount}</TableCell>
						</TableRow>
					))}
				</TableBody>
				<TableFooter>
					<TableRow>
						<TableCell colSpan={3}>Total</TableCell>
						<TableCell className="text-end tabular-nums">{INVOICES_TOTAL}</TableCell>
					</TableRow>
				</TableFooter>
			</Table>
		</DemoSurface>
	);
}

// ── Icon tile ───────────────────────────────────────────────────────────────

const IconTileToneSchema = z.enum(["brand", "neutral", "green", "blue", "yellow", "red", "orange", "teal", "violet"]);
const ICON_TILE_TONES: readonly IconTileTone[] = IconTileToneSchema.options;

const IconTileSizeSchema = z.enum(["sm", "md", "lg"]);
const ICON_TILE_SIZES: readonly z.output<typeof IconTileSizeSchema>[] = IconTileSizeSchema.options;

function IconTileDemo(): React.JSX.Element {
	return (
		<DemoSurface>
			<DemoRow label="Tones">
				{ICON_TILE_TONES.map((tone) => (
					<div key={tone} className="flex flex-col items-center gap-1">
						<IconTile tone={tone}>
							<Gift />
						</IconTile>
						<span className="text-xs text-muted-foreground">{tone}</span>
					</div>
				))}
			</DemoRow>
			<DemoRow label="Sizes">
				{ICON_TILE_SIZES.map((size) => (
					<IconTile key={size} size={size} tone="brand">
						<Store />
					</IconTile>
				))}
			</DemoRow>
		</DemoSurface>
	);
}

// ── Relative time ───────────────────────────────────────────────────────────

const MINUTE_MS = 60_000;
const HOUR_MS = 60 * MINUTE_MS;
const DAY_MS = 24 * HOUR_MS;

interface RelativeExample {
	readonly label: string;
	/** Offset from now; negative is in the past. */
	readonly offsetMs: number;
}

const RELATIVE_EXAMPLES: readonly RelativeExample[] = [
	{ label: "Five minutes ago", offsetMs: -5 * MINUTE_MS },
	{ label: "Three hours ago", offsetMs: -3 * HOUR_MS },
	{ label: "Two days ago", offsetMs: -2 * DAY_MS },
	{ label: "In one hour", offsetMs: HOUR_MS },
];

interface RelativeTimeDemoProps {
	readonly nowEpochMs: number;
}

function RelativeTimeDemo({ nowEpochMs }: RelativeTimeDemoProps): React.JSX.Element {
	return (
		<DemoSurface>
			<dl className="grid max-w-md grid-cols-[auto_1fr] gap-x-6 gap-y-2 text-sm">
				{RELATIVE_EXAMPLES.map((example) => (
					<React.Fragment key={example.label}>
						<dt className="text-muted-foreground">{example.label}</dt>
						<dd>
							<RelativeTime epochMs={nowEpochMs + example.offsetMs} region={PLATFORM_DISPLAY_REGION} />
						</dd>
					</React.Fragment>
				))}
			</dl>
		</DemoSurface>
	);
}

// ── Separator ───────────────────────────────────────────────────────────────

function SeparatorDemo(): React.JSX.Element {
	return (
		<DemoSurface>
			<div className="max-w-md">
				<p className="text-sm font-medium">UI kit</p>
				<p className="text-sm text-muted-foreground">Low-level primitives for every web app.</p>
				<Separator className="my-4" />
				<div className="flex h-5 items-center gap-4 text-sm">
					<span>Docs</span>
					<Separator orientation="vertical" />
					<span>Source</span>
					<Separator orientation="vertical" />
					<span>Changelog</span>
				</div>
			</div>
		</DemoSurface>
	);
}

/** Data display: surfaces, metrics and tables. Smart: owns every demo's state. */
export function DataDisplayFamily(): React.JSX.Element {
	// Read once per mount: the relative times only need to be right for the visit (RelativeTime keeps itself current).
	const nowEpochMs = React.useMemo(() => new Date().getTime(), []);

	return (
		<>
			<ComponentSection entry={GALLERY_ENTRIES.card} height="h-72">
				<CardDemo />
			</ComponentSection>
			<ComponentSection entry={GALLERY_ENTRIES.statCard} height="h-40">
				<StatCardDemo />
			</ComponentSection>
			<ComponentSection entry={GALLERY_ENTRIES.kpiStatCard} height="h-56">
				<KpiStatCardDemo />
			</ComponentSection>
			<ComponentSection entry={GALLERY_ENTRIES.table} height="h-72">
				<TableDemo />
			</ComponentSection>
			<ComponentSection entry={GALLERY_ENTRIES.dataTable} height="h-[400px]">
				<DataTableShowcase />
			</ComponentSection>
			<ComponentSection entry={GALLERY_ENTRIES.iconTile} height="h-40">
				<IconTileDemo />
			</ComponentSection>
			<ComponentSection entry={GALLERY_ENTRIES.relativeTime} height="h-40">
				<RelativeTimeDemo nowEpochMs={nowEpochMs} />
			</ComponentSection>
			<ComponentSection entry={GALLERY_ENTRIES.separator} height="h-40">
				<SeparatorDemo />
			</ComponentSection>
			<ExampleOnlySections familyId="family-data-display" />
		</>
	);
}
