"use client";

import { Avatar, AvatarFallback, AvatarImage } from "@workspace/ui/components/avatar";
import { Badge } from "@workspace/ui/components/badge";
import { Card } from "@workspace/ui/components/card";
import { DataGrid, DataGridContainer, dataGridFeatures, type DataGridFeatures, type DataGridTableLayout } from "@workspace/ui/components/data-grid/data-grid";
import { DataGridColumnHeader } from "@workspace/ui/components/data-grid/data-grid-column-header";
import { DataGridPagination } from "@workspace/ui/components/data-grid/data-grid-pagination";
import { DataGridScrollArea } from "@workspace/ui/components/data-grid/data-grid-scroll-area";
import { DataGridTable, DataGridTableRowExpand } from "@workspace/ui/components/data-grid/data-grid-table";
import { useTable, type ColumnDef, type TableOptions } from "@tanstack/react-table";
import * as React from "react";

interface IData {
	readonly id: string;
	readonly name: string;
	readonly type: "department" | "team" | "member";
	readonly status: "active" | "inactive";
	readonly role?: string;
	readonly avatar?: string;
	/** ISO 3166-1 alpha-2 country code, rendered as an emoji flag — sample data, so no flag images are fetched. */
	readonly flag?: string;
	readonly location?: string;
	readonly children?: readonly IData[];
}

const DEMO_DATA: readonly IData[] = [
	{
		id: "eng",
		name: "Engineering",
		type: "department",
		status: "active",
		children: [
			{
				id: "eng-platform",
				name: "Platform",
				type: "team",
				status: "active",
				children: [
					{
						id: "eng-platform-1",
						name: "Alex Johnson",
						type: "member",
						status: "active",
						role: "Staff Engineer",
						avatar: "https://images.unsplash.com/photo-1535713875002-d1d0cf377fde?w=96&h=96&dpr=2&q=80",
						flag: "us",
						location: "United States",
					},
					{
						id: "eng-platform-2",
						name: "Sarah Chen",
						type: "member",
						status: "active",
						role: "Senior Engineer",
						avatar: "https://images.unsplash.com/photo-1519699047748-de8e457a634e?w=96&h=96&dpr=2&q=80",
						flag: "gb",
						location: "United Kingdom",
					},
					{
						id: "eng-platform-3",
						name: "Michael Rodriguez",
						type: "member",
						status: "inactive",
						role: "Frontend Engineer",
						avatar: "https://images.unsplash.com/photo-1584308972272-9e4e7685e80f?w=96&h=96&dpr=2&q=80",
						flag: "ca",
						location: "Canada",
					},
				],
			},
			{
				id: "eng-mobile",
				name: "Mobile",
				type: "team",
				status: "active",
				children: [
					{
						id: "eng-mobile-1",
						name: "Emma Wilson",
						type: "member",
						status: "active",
						role: "iOS Engineer",
						avatar: "https://images.unsplash.com/photo-1485893086445-ed75865251e0?w=96&h=96&dpr=2&q=80",
						flag: "au",
						location: "Australia",
					},
					{
						id: "eng-mobile-2",
						name: "David Kim",
						type: "member",
						status: "active",
						role: "Android Engineer",
						avatar: "https://images.unsplash.com/photo-1607990281513-2c110a25bd8c?w=96&h=96&dpr=2&q=80",
						flag: "de",
						location: "Germany",
					},
				],
			},
		],
	},
	{
		id: "design",
		name: "Design",
		type: "department",
		status: "active",
		children: [
			{
				id: "design-product",
				name: "Product Design",
				type: "team",
				status: "active",
				children: [
					{
						id: "design-product-1",
						name: "Aron Thompson",
						type: "member",
						status: "active",
						role: "Design Lead",
						avatar: "https://images.unsplash.com/photo-1527980965255-d3b416303d12?w=96&h=96&dpr=2&q=80",
						flag: "my",
						location: "Malaysia",
					},
					{
						id: "design-product-2",
						name: "Maria Garcia",
						type: "member",
						status: "active",
						role: "Product Designer",
						avatar: "https://images.unsplash.com/photo-1620075225255-8c2051b6c015?w=96&h=96&dpr=2&q=80",
						flag: "jp",
						location: "Japan",
					},
					{
						id: "design-product-3",
						name: "James Brown",
						type: "member",
						status: "inactive",
						role: "UX Researcher",
						avatar: "https://images.unsplash.com/photo-1543299750-19d1d6297053?w=96&h=96&dpr=2&q=80",
						flag: "es",
						location: "Spain",
					},
				],
			},
			{
				id: "design-brand",
				name: "Brand",
				type: "team",
				status: "active",
				children: [
					{
						id: "design-brand-1",
						name: "Nick Johnson",
						type: "member",
						status: "active",
						role: "Brand Designer",
						avatar: "https://images.unsplash.com/photo-1485206412256-701ccc5b93ca?w=96&h=96&dpr=2&q=80",
						flag: "fr",
						location: "France",
					},
					{
						id: "design-brand-2",
						name: "Liam Thompson",
						type: "member",
						status: "inactive",
						role: "Motion Designer",
						avatar: "https://images.unsplash.com/photo-1542595913-85d69b0edbaf?w=96&h=96&dpr=2&q=80",
						flag: "it",
						location: "Italy",
					},
				],
			},
		],
	},
	{
		id: "marketing",
		name: "Marketing",
		type: "department",
		status: "active",
		children: [
			{
				id: "marketing-growth",
				name: "Growth",
				type: "team",
				status: "active",
				children: [
					{
						id: "marketing-growth-1",
						name: "Olivia Martin",
						type: "member",
						status: "active",
						role: "Growth Lead",
						avatar: "https://images.unsplash.com/photo-1519699047748-de8e457a634e?w=96&h=96&dpr=2&q=80",
						flag: "us",
						location: "United States",
					},
					{
						id: "marketing-growth-2",
						name: "Ethan Clark",
						type: "member",
						status: "active",
						role: "Performance Marketer",
						avatar: "https://images.unsplash.com/photo-1535713875002-d1d0cf377fde?w=96&h=96&dpr=2&q=80",
						flag: "ca",
						location: "Canada",
					},
				],
			},
			{
				id: "marketing-content",
				name: "Content",
				type: "team",
				status: "active",
				children: [
					{
						id: "marketing-content-1",
						name: "Sofia Rossi",
						type: "member",
						status: "active",
						role: "Content Lead",
						avatar: "https://images.unsplash.com/photo-1485893086445-ed75865251e0?w=96&h=96&dpr=2&q=80",
						flag: "it",
						location: "Italy",
					},
					{
						id: "marketing-content-2",
						name: "Lucas Meyer",
						type: "member",
						status: "inactive",
						role: "Copywriter",
						avatar: "https://images.unsplash.com/photo-1584308972272-9e4e7685e80f?w=96&h=96&dpr=2&q=80",
						flag: "de",
						location: "Germany",
					},
				],
			},
		],
	},
	{
		id: "operations",
		name: "Operations",
		type: "department",
		status: "active",
		children: [
			{
				id: "operations-finance",
				name: "Finance",
				type: "team",
				status: "active",
				children: [
					{
						id: "operations-finance-1",
						name: "Grace Lee",
						type: "member",
						status: "active",
						role: "Finance Lead",
						avatar: "https://images.unsplash.com/photo-1620075225255-8c2051b6c015?w=96&h=96&dpr=2&q=80",
						flag: "kr",
						location: "South Korea",
					},
					{
						id: "operations-finance-2",
						name: "Daniel Novak",
						type: "member",
						status: "active",
						role: "Accountant",
						avatar: "https://images.unsplash.com/photo-1607990281513-2c110a25bd8c?w=96&h=96&dpr=2&q=80",
						flag: "cz",
						location: "Czechia",
					},
				],
			},
			{
				id: "operations-people",
				name: "People",
				type: "team",
				status: "active",
				children: [
					{
						id: "operations-people-1",
						name: "Chloe Dubois",
						type: "member",
						status: "active",
						role: "People Lead",
						avatar: "https://images.unsplash.com/photo-1519699047748-de8e457a634e?w=96&h=96&dpr=2&q=80",
						flag: "fr",
						location: "France",
					},
					{
						id: "operations-people-2",
						name: "Ryan Walsh",
						type: "member",
						status: "active",
						role: "Recruiter",
						avatar: "https://images.unsplash.com/photo-1527980965255-d3b416303d12?w=96&h=96&dpr=2&q=80",
						flag: "ie",
						location: "Ireland",
					},
				],
			},
		],
	},
	{
		id: "sales",
		name: "Sales",
		type: "department",
		status: "active",
		children: [
			{
				id: "sales-accounts",
				name: "Accounts",
				type: "team",
				status: "active",
				children: [
					{
						id: "sales-accounts-1",
						name: "Mia Park",
						type: "member",
						status: "active",
						role: "Account Executive",
						avatar: "https://images.unsplash.com/photo-1485893086445-ed75865251e0?w=96&h=96&dpr=2&q=80",
						flag: "kr",
						location: "South Korea",
					},
					{
						id: "sales-accounts-2",
						name: "Noah Fischer",
						type: "member",
						status: "inactive",
						role: "Account Manager",
						avatar: "https://images.unsplash.com/photo-1543299750-19d1d6297053?w=96&h=96&dpr=2&q=80",
						flag: "at",
						location: "Austria",
					},
				],
			},
		],
	},
];

/** First regional-indicator symbol (🇦); a country code's letters offset from it spell the flag emoji. */
const REGIONAL_INDICATOR_A = 0x1f1e6;
const LOWERCASE_A_CODE = "a".charCodeAt(0);

function toFlagEmoji(countryCode: string): string {
	return countryCode.toLowerCase().replace(/[a-z]/g, (letter: string): string => String.fromCodePoint(REGIONAL_INDICATOR_A + letter.charCodeAt(0) - LOWERCASE_A_CODE));
}

function getInitials(name: string): string {
	return name
		.split(" ")
		.map((part: string): string => part.charAt(0))
		.join("");
}

function getRowId(row: IData): string {
	return row.id;
}

function getSubRows(row: IData): readonly IData[] | undefined {
	return row.children;
}

/** Top-level rows per page; expanded children stay on their parent's page. */
const PAGE_SIZE = 4;

const PAGE_SIZES: readonly number[] = [4, 8, 16];

const INITIAL_STATE: NonNullable<TableOptions<DataGridFeatures, IData>["initialState"]> = {
	pagination: { pageIndex: 0, pageSize: PAGE_SIZE },
	expanded: { eng: true, "eng-platform": true },
};

const TABLE_LAYOUT: DataGridTableLayout = { columnsResizable: true, columnsMovable: true, columnsVisibility: true };

const COLUMNS: ColumnDef<DataGridFeatures, IData>[] = [
	{
		accessorKey: "name",
		id: "name",
		header: ({ column }): React.JSX.Element => <DataGridColumnHeader title="Name" column={column} />,
		cell: ({ row }): React.JSX.Element => {
			const item = row.original;
			return (
				<div className="flex items-center gap-1">
					<DataGridTableRowExpand row={row} className="-ms-1.5 -me-1" />
					{item.type === "member" ? (
						<>
							<Avatar className="size-6 shrink-0">
								{item.avatar === undefined ? null : <AvatarImage src={item.avatar} alt={item.name} />}
								<AvatarFallback>{getInitials(item.name)}</AvatarFallback>
							</Avatar>
							<span className="font-medium text-foreground">{item.name}</span>
						</>
					) : (
						<span className="font-medium text-foreground">{item.name}</span>
					)}
				</div>
			);
		},
		minSize: 260,
		enableSorting: true,
		enableHiding: false,
		meta: { autoSize: true },
	},
	{
		accessorKey: "role",
		header: ({ column }): React.JSX.Element => <DataGridColumnHeader title="Role" column={column} />,
		cell: ({ row }): React.JSX.Element => {
			const item = row.original;
			return <div className="text-muted-foreground">{item.role ?? (item.type === "department" ? "Department" : "Team")}</div>;
		},
		size: 180,
	},
	{
		accessorKey: "location",
		header: ({ column }): React.JSX.Element => <DataGridColumnHeader title="Location" column={column} />,
		cell: ({ row }): React.JSX.Element => {
			const { location, flag } = row.original;
			if (location === undefined || flag === undefined) {
				return <span className="text-muted-foreground">-</span>;
			}
			return (
				<div className="flex items-center gap-1.5">
					<span role="img" aria-label={location}>
						{toFlagEmoji(flag)}
					</span>
					<div className="font-medium text-foreground">{location}</div>
				</div>
			);
		},
		size: 180,
	},
	{
		accessorKey: "status",
		id: "status",
		header: ({ column }): React.JSX.Element => <DataGridColumnHeader title="Status" column={column} />,
		cell: ({ row }): React.JSX.Element =>
			row.original.status === "active" ? <Badge variant="success-outline">Active</Badge> : <Badge variant="warning-outline">Inactive</Badge>,
		size: 130,
	},
];

export function DataGrid30Example(): React.JSX.Element {
	const table = useTable({
		features: dataGridFeatures,
		columns: COLUMNS,
		data: DEMO_DATA,
		getRowId,
		getSubRows,
		initialState: INITIAL_STATE,
		// Keep expanded children on the same page as their parent.
		paginateExpandedRows: false,
	});

	return (
		<DataGrid table={table} recordCount={DEMO_DATA.length} tableLayout={TABLE_LAYOUT}>
			<div className="w-full space-y-2.5">
				<Card className="overflow-hidden p-0">
					<DataGridContainer>
						<DataGridScrollArea>
							<DataGridTable />
						</DataGridScrollArea>
					</DataGridContainer>
				</Card>
				<DataGridPagination sizes={PAGE_SIZES} />
			</div>
		</DataGrid>
	);
}
