"use client";

import { Avatar, AvatarFallback, AvatarImage } from "@workspace/ui/components/avatar";
import { Badge } from "@workspace/ui/components/badge";
import { Card, CardAction, CardFooter, CardHeader, CardTitle } from "@workspace/ui/components/card";
import { DataGrid, DataGridContainer, dataGridFeatures, type DataGridFeatures, type DataGridTableLayout } from "@workspace/ui/components/data-grid/data-grid";
import { DataGridColumnHeader } from "@workspace/ui/components/data-grid/data-grid-column-header";
import type { DataGridLabelsOverride, DataGridPaginationInfo } from "@workspace/ui/components/data-grid/data-grid-i18n";
import { DataGridPagination } from "@workspace/ui/components/data-grid/data-grid-pagination";
import { DataGridScrollArea } from "@workspace/ui/components/data-grid/data-grid-scroll-area";
import { DataGridTable, DataGridTableRowSelect, DataGridTableRowSelectAll } from "@workspace/ui/components/data-grid/data-grid-table";
import { ToggleGroup, ToggleGroupItem } from "@workspace/ui/components/toggle-group";
import { useTable, type ColumnDef, type TableOptions } from "@tanstack/react-table";
import * as React from "react";
import { z } from "zod";

type OrderStatus = "shipped" | "processing";

interface IOrder {
	readonly id: string;
	readonly reference: string;
	readonly customer: string;
	readonly avatar: string;
	readonly initials: string;
	readonly city: string;
	readonly status: OrderStatus;
	readonly total: number;
}

const localeSchema = z.enum(["en", "de", "ja"]);

type Locale = z.infer<typeof localeSchema>;

const LOCALES: readonly Locale[] = localeSchema.options;

const ORDERS: readonly IOrder[] = [
	{
		id: "1",
		reference: "ORD-4417",
		customer: "Alex Johnson",
		avatar: "https://images.unsplash.com/photo-1535713875002-d1d0cf377fde?w=96&h=96&dpr=2&q=80",
		initials: "AJ",
		city: "Berlin",
		status: "shipped",
		total: 249.9,
	},
	{
		id: "2",
		reference: "ORD-4418",
		customer: "Sarah Chen",
		avatar: "https://images.unsplash.com/photo-1519699047748-de8e457a634e?w=96&h=96&dpr=2&q=80",
		initials: "SC",
		city: "Osaka",
		status: "processing",
		total: 89.0,
	},
	{
		id: "3",
		reference: "ORD-4421",
		customer: "Michael Rodriguez",
		avatar: "https://images.unsplash.com/photo-1584308972272-9e4e7685e80f?w=96&h=96&dpr=2&q=80",
		initials: "MR",
		city: "Madrid",
		status: "shipped",
		total: 1290.5,
	},
	{
		id: "4",
		reference: "ORD-4425",
		customer: "Emma Wilson",
		avatar: "https://images.unsplash.com/photo-1485893086445-ed75865251e0?w=96&h=96&dpr=2&q=80",
		initials: "EW",
		city: "Hamburg",
		status: "processing",
		total: 45.25,
	},
	{
		id: "5",
		reference: "ORD-4430",
		customer: "David Kim",
		avatar: "https://images.unsplash.com/photo-1607990281513-2c110a25bd8c?w=96&h=96&dpr=2&q=80",
		initials: "DK",
		city: "Seoul",
		status: "shipped",
		total: 615.0,
	},
	{
		id: "6",
		reference: "ORD-4433",
		customer: "Maria Garcia",
		avatar: "https://images.unsplash.com/photo-1620075225255-8c2051b6c015?w=96&h=96&dpr=2&q=80",
		initials: "MG",
		city: "Lisbon",
		status: "processing",
		total: 132.75,
	},
	{
		id: "7",
		reference: "ORD-4440",
		customer: "James Brown",
		avatar: "https://images.unsplash.com/photo-1543299750-19d1d6297053?w=96&h=96&dpr=2&q=80",
		initials: "JB",
		city: "Toronto",
		status: "shipped",
		total: 78.4,
	},
];

interface LocaleColumnTitles {
	readonly reference: string;
	readonly customer: string;
	readonly city: string;
	readonly status: string;
	readonly total: string;
}

interface LocaleContent {
	readonly label: string;
	/** BCP 47 tag the money format uses. */
	readonly tag: string;
	readonly columns: LocaleColumnTitles;
	readonly status: Readonly<Record<OrderStatus, string>>;
	readonly currency: string;
	/** Fraction digits the currency shows (the yen has no minor unit). */
	readonly currencyDigits: number;
	/** The grid's own copy for this locale; untouched keys keep the provider's English pack. */
	readonly labels: DataGridLabelsOverride;
}

/** Cents-based currencies show two fraction digits. */
const CENT_DIGITS = 2;
/** The yen has no minor unit. */
const YEN_DIGITS = 0;

/**
 * One entry per locale: the grid's own copy through `labels`, plus the column
 * titles and cell text the consumer owns. The grid never translates content,
 * only its built-in chrome, so a real app pairs the two exactly like this.
 */
const LOCALE_CONTENT: Readonly<Record<Locale, LocaleContent>> = {
	en: {
		label: "EN",
		tag: "en-US",
		columns: { reference: "Order", customer: "Customer", city: "City", status: "Status", total: "Total" },
		status: { shipped: "Shipped", processing: "Processing" },
		currency: "USD",
		currencyDigits: CENT_DIGITS,
		labels: {},
	},
	de: {
		label: "DE",
		tag: "de-DE",
		columns: { reference: "Bestellung", customer: "Kunde", city: "Stadt", status: "Status", total: "Summe" },
		status: { shipped: "Versandt", processing: "In Bearbeitung" },
		currency: "EUR",
		currencyDigits: CENT_DIGITS,
		labels: {
			sortAscending: "Aufsteigend",
			sortDescending: "Absteigend",
			pinColumnStart: "Links anheften",
			pinColumnEnd: "Rechts anheften",
			moveColumnStart: "Nach links verschieben",
			moveColumnEnd: "Nach rechts verschieben",
			columnsMenu: "Spalten",
			toggleColumns: "Spalten ein- und ausblenden",
			selectAll: "Alle auswählen",
			selectRow: "Zeile auswählen",
			rowsPerPage: "Zeilen pro Seite",
			paginationInfo: ({ from, to, count }: DataGridPaginationInfo): string => `${String(from)}-${String(to)} von ${String(count)}`,
			previousPage: "Vorherige Seite",
			nextPage: "Nächste Seite",
			goToPage: (page: number): string => `Seite ${String(page)}`,
			empty: "Keine Daten vorhanden",
		},
	},
	ja: {
		label: "日本語",
		tag: "ja-JP",
		columns: { reference: "注文", customer: "顧客", city: "都市", status: "状態", total: "合計" },
		status: { shipped: "発送済み", processing: "処理中" },
		currency: "JPY",
		currencyDigits: YEN_DIGITS,
		labels: {
			sortAscending: "昇順",
			sortDescending: "降順",
			pinColumnStart: "左に固定",
			pinColumnEnd: "右に固定",
			moveColumnStart: "左へ移動",
			moveColumnEnd: "右へ移動",
			columnsMenu: "列",
			toggleColumns: "列の表示切り替え",
			selectAll: "すべて選択",
			selectRow: "行を選択",
			rowsPerPage: "1ページの行数",
			// Japanese counts the total first, the reason these labels are
			// functions rather than templates with fixed placeholders.
			paginationInfo: ({ from, to, count }: DataGridPaginationInfo): string => `${String(count)}件中 ${String(from)}-${String(to)}件`,
			previousPage: "前のページ",
			nextPage: "次のページ",
			goToPage: (page: number): string => `${String(page)}ページ目`,
			empty: "データがありません",
		},
	},
};

/** Rows per page. */
const PAGE_SIZE = 5;

const INITIAL_STATE: NonNullable<TableOptions<DataGridFeatures, IOrder>["initialState"]> = {
	pagination: { pageIndex: 0, pageSize: PAGE_SIZE },
};

const TABLE_LAYOUT: DataGridTableLayout = { columnsPinnable: true, columnsMovable: true };

function getRowId(row: IOrder): string {
	return row.id;
}

function createColumns(content: LocaleContent): ColumnDef<DataGridFeatures, IOrder>[] {
	const money = new Intl.NumberFormat(content.tag, { style: "currency", currency: content.currency, maximumFractionDigits: content.currencyDigits });
	return [
		{
			id: "select",
			header: (): React.JSX.Element => <DataGridTableRowSelectAll />,
			cell: ({ row }): React.JSX.Element => <DataGridTableRowSelect row={row} />,
			size: 44,
			enableSorting: false,
			enableHiding: false,
			enableResizing: false,
		},
		{
			accessorKey: "reference",
			header: ({ column }): React.JSX.Element => <DataGridColumnHeader title={content.columns.reference} column={column} />,
			cell: ({ row }): React.JSX.Element => <span className="font-mono text-xs">{row.original.reference}</span>,
			size: 110,
		},
		{
			accessorKey: "customer",
			header: ({ column }): React.JSX.Element => <DataGridColumnHeader title={content.columns.customer} column={column} />,
			cell: ({ row }): React.JSX.Element => (
				<div className="flex items-center gap-2">
					<Avatar className="size-6">
						<AvatarImage src={row.original.avatar} alt={row.original.customer} />
						<AvatarFallback className="text-[10px]">{row.original.initials}</AvatarFallback>
					</Avatar>
					<span className="truncate font-medium text-foreground">{row.original.customer}</span>
				</div>
			),
			size: 200,
		},
		{
			accessorKey: "city",
			header: ({ column }): React.JSX.Element => <DataGridColumnHeader title={content.columns.city} column={column} />,
			cell: ({ row }): React.JSX.Element => <span className="truncate">{row.original.city}</span>,
			size: 120,
		},
		{
			accessorKey: "status",
			header: ({ column }): React.JSX.Element => <DataGridColumnHeader title={content.columns.status} column={column} />,
			cell: ({ row }): React.JSX.Element => (
				<Badge variant={row.original.status === "shipped" ? "success-light" : "warning-light"}>{content.status[row.original.status]}</Badge>
			),
			size: 140,
		},
		{
			accessorKey: "total",
			header: ({ column }): React.JSX.Element => <DataGridColumnHeader title={content.columns.total} column={column} />,
			cell: ({ row }): React.JSX.Element => <span className="block text-end tabular-nums">{money.format(row.original.total)}</span>,
			size: 130,
			meta: { headerClassName: "text-end [&>div]:justify-end" },
		},
	];
}

export function DataGrid33Example(): React.JSX.Element {
	const [locale, setLocale] = React.useState<Locale>("en");
	const content = LOCALE_CONTENT[locale];
	const columns = React.useMemo((): ColumnDef<DataGridFeatures, IOrder>[] => createColumns(content), [content]);
	const toggleValue = React.useMemo((): Locale[] => [locale], [locale]);

	const table = useTable({
		features: dataGridFeatures,
		columns,
		data: ORDERS,
		getRowId,
		initialState: INITIAL_STATE,
		enableRowSelection: true,
	});

	const handleLocaleChange = React.useCallback((values: readonly string[]): void => {
		const [first] = values;
		const next = localeSchema.safeParse(first);
		// A single toggle group can be emptied by pressing the active item; keep the current locale then.
		if (next.success) {
			setLocale(next.data);
		}
	}, []);

	return (
		// The whole point of the example: one prop swaps every built-in string,
		// and the untouched keys keep their English defaults.
		<DataGrid table={table} recordCount={ORDERS.length} labels={content.labels} tableLayout={TABLE_LAYOUT}>
			<Card className="w-full gap-3 py-3.5">
				<CardHeader className="items-center px-3.5">
					<CardTitle>Orders</CardTitle>
					<CardAction>
						<ToggleGroup variant="outline" size="sm" value={toggleValue} onValueChange={handleLocaleChange} aria-label="Grid language">
							{LOCALES.map((value: Locale): React.JSX.Element => (
								<ToggleGroupItem key={value} value={value}>
									{LOCALE_CONTENT[value].label}
								</ToggleGroupItem>
							))}
						</ToggleGroup>
					</CardAction>
				</CardHeader>
				<DataGridContainer className="border-y">
					<DataGridScrollArea>
						<DataGridTable />
					</DataGridScrollArea>
				</DataGridContainer>
				<CardFooter className="border-none bg-transparent! px-3.5 py-0">
					<DataGridPagination />
				</CardFooter>
			</Card>
		</DataGrid>
	);
}
