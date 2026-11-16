"use client";

import { Avatar, AvatarFallback, AvatarImage } from "@workspace/ui/components/avatar";
import { Badge } from "@workspace/ui/components/badge";
import { Button } from "@workspace/ui/components/button";
import { Card, CardAction, CardFooter, CardHeader, CardTitle } from "@workspace/ui/components/card";
import {
	DataGrid,
	DataGridContainer,
	dataGridFeatures,
	type DataGridFeatures,
	type DataGridTableClassNames,
	type DataGridTableLayout,
} from "@workspace/ui/components/data-grid/data-grid";
import { DataGridColumnHeader } from "@workspace/ui/components/data-grid/data-grid-column-header";
import { DataGridPagination } from "@workspace/ui/components/data-grid/data-grid-pagination";
import { DataGridScrollArea } from "@workspace/ui/components/data-grid/data-grid-scroll-area";
import { DataGridTable } from "@workspace/ui/components/data-grid/data-grid-table";
import { Skeleton } from "@workspace/ui/components/skeleton";
import { useTable, type ColumnDef, type ColumnOrderState, type PaginationState, type SortingState } from "@tanstack/react-table";
import * as React from "react";

interface Member {
	readonly id: string;
	readonly name: string;
	readonly availability: "online" | "away" | "busy" | "offline";
	readonly avatar: string;
	readonly status: "active" | "inactive";
	readonly flag: string; // Emoji flag
	readonly email: string;
	readonly company: string;
	readonly role: string;
	readonly joined: string;
	readonly location: string;
	readonly balance: number;
}

const MEMBERS: Member[] = [
	{
		id: "1",
		name: "Alex Johnson",
		availability: "online",
		avatar: "https://images.unsplash.com/photo-1535713875002-d1d0cf377fde?w=96&h=96&dpr=2&q=80",
		status: "active",
		flag: "🇺🇸",
		email: "alex@example.com",
		company: "Apple",
		role: "CEO",
		joined: "Jan, 2024",
		location: "United States",
		balance: 5143.03,
	},
	{
		id: "2",
		name: "Sarah Chen",
		availability: "away",
		avatar: "https://images.unsplash.com/photo-1519699047748-de8e457a634e?w=96&h=96&dpr=2&q=80",
		status: "inactive",
		flag: "🇬🇧",
		email: "sarah@example.com",
		company: "OpenAI",
		role: "CTO",
		joined: "Mar, 2023",
		location: "United Kingdom",
		balance: 4321.87,
	},
	{
		id: "3",
		name: "Michael Rodriguez",
		availability: "busy",
		avatar: "https://images.unsplash.com/photo-1584308972272-9e4e7685e80f?w=96&h=96&dpr=2&q=80",
		status: "active",
		flag: "🇨🇦",
		email: "michael@example.com",
		company: "Meta",
		role: "Designer",
		joined: "Jun, 2022",
		location: "Canada",
		balance: 7654.98,
	},
	{
		id: "4",
		name: "Emma Wilson",
		availability: "offline",
		avatar: "https://images.unsplash.com/photo-1485893086445-ed75865251e0?w=96&h=96&dpr=2&q=80",
		status: "inactive",
		flag: "🇦🇺",
		email: "emma@example.com",
		company: "Tesla",
		role: "Developer",
		joined: "Sep, 2024",
		location: "Australia",
		balance: 3456.45,
	},
	{
		id: "5",
		name: "David Kim",
		availability: "online",
		avatar: "https://images.unsplash.com/photo-1607990281513-2c110a25bd8c?w=96&h=96&dpr=2&q=80",
		status: "active",
		flag: "🇩🇪",
		email: "david@example.com",
		company: "SAP",
		role: "Lawyer",
		joined: "Nov, 2023",
		location: "Germany",
		balance: 9876.54,
	},
	{
		id: "6",
		name: "Aron Thompson",
		availability: "away",
		avatar: "https://images.unsplash.com/photo-1527980965255-d3b416303d12?w=96&h=96&dpr=2&q=80",
		status: "active",
		flag: "🇲🇾",
		email: "lisa@example.com",
		company: "Keenthemes",
		role: "Director",
		joined: "Feb, 2022",
		location: "Malaysia",
		balance: 6214.22,
	},
	{
		id: "7",
		name: "James Brown",
		availability: "busy",
		avatar: "https://images.unsplash.com/photo-1543299750-19d1d6297053?w=96&h=96&dpr=2&q=80",
		status: "inactive",
		flag: "🇪🇸",
		email: "james@example.com",
		company: "BBVA",
		role: "Product Manager",
		joined: "Aug, 2024",
		location: "Spain",
		balance: 5321.77,
	},
	{
		id: "8",
		name: "Maria Garcia",
		availability: "offline",
		avatar: "https://images.unsplash.com/photo-1620075225255-8c2051b6c015?w=96&h=96&dpr=2&q=80",
		status: "active",
		flag: "🇯🇵",
		email: "maria@example.com",
		company: "Sony",
		role: "Marketing Lead",
		joined: "Dec, 2023",
		location: "Japan",
		balance: 8452.39,
	},
	{
		id: "9",
		name: "Nick Johnson",
		availability: "online",
		avatar: "https://images.unsplash.com/photo-1485206412256-701ccc5b93ca?w=96&h=96&dpr=2&q=80",
		status: "inactive",
		flag: "🇫🇷",
		email: "nick@example.com",
		company: "LVMH",
		role: "Data Scientist",
		joined: "Apr, 2022",
		location: "France",
		balance: 7345.1,
	},
	{
		id: "10",
		name: "Liam Thompson",
		availability: "away",
		avatar: "https://images.unsplash.com/photo-1542595913-85d69b0edbaf?w=96&h=96&dpr=2&q=80",
		status: "inactive",
		flag: "🇮🇹",
		email: "liam@example.com",
		company: "ENI",
		role: "Engineer",
		joined: "Jul, 2024",
		location: "Italy",
		balance: 5214.88,
	},
	{
		id: "11",
		name: "Alex Johnson",
		availability: "busy",
		avatar: "https://images.unsplash.com/photo-1535713875002-d1d0cf377fde?w=96&h=96&dpr=2&q=80",
		status: "inactive",
		flag: "🇧🇷",
		email: "alex@example.com",
		company: "Vale",
		role: "Software Engineer",
		joined: "May, 2023",
		location: "Brazil",
		balance: 9421.5,
	},
	{
		id: "12",
		name: "Sarah Chen",
		availability: "offline",
		avatar: "https://images.unsplash.com/photo-1519699047748-de8e457a634e?w=96&h=96&dpr=2&q=80",
		status: "active",
		flag: "🇮🇳",
		email: "sarah@example.com",
		company: "Tata",
		role: "Sales Manager",
		joined: "Oct, 2024",
		location: "India",
		balance: 4521.67,
	},
];

const PAGE_SIZE = 5;
const INITIAL_PAGINATION: PaginationState = { pageIndex: 0, pageSize: PAGE_SIZE };
const INITIAL_SORTING: SortingState = [{ id: "name", desc: true }];

function getMemberId(member: Member): string {
	return member.id;
}

function initialsOf(name: string): string {
	return name
		.split(" ")
		.map((part: string): string => part.charAt(0))
		.join("");
}

const TABLE_LAYOUT: DataGridTableLayout = { columnsPinnable: true, columnsMovable: true, columnsVisibility: true };
const TABLE_CLASS_NAMES: DataGridTableClassNames = { edgeCell: "px-5" };
/** The columns' ids in their initial order: the header menus move columns within this list. */
const INITIAL_COLUMN_ORDER: ColumnOrderState = ["name", "email", "status"];

const COLUMNS: ColumnDef<DataGridFeatures, Member>[] = [
	{
		accessorKey: "name",
		id: "name",
		header: ({ column }): React.JSX.Element => <DataGridColumnHeader title="User" visibility column={column} />,
		cell: ({ row }): React.JSX.Element => (
			<div className="flex items-center gap-3">
				<Avatar className="size-8">
					<AvatarImage src={row.original.avatar} alt={row.original.name} />
					<AvatarFallback>{initialsOf(row.original.name)}</AvatarFallback>
				</Avatar>
				<div className="space-y-px">
					<div className="font-medium text-foreground">{row.original.name}</div>
					<div className="text-muted-foreground">{row.original.email}</div>
				</div>
			</div>
		),
		meta: {
			skeleton: (
				<div className="flex h-10 items-center gap-3">
					<Skeleton className="size-8 rounded-full" />
					<div className="space-y-1">
						<Skeleton className="h-5 w-24" />
						<Skeleton className="h-4 w-16" />
					</div>
				</div>
			),
		},
		size: 200,
		enableSorting: true,
		enableHiding: false,
		enableResizing: true,
	},
	{
		accessorKey: "email",
		id: "email",
		header: ({ column }): React.JSX.Element => <DataGridColumnHeader title="Email" visibility column={column} />,
		cell: ({ row }): React.JSX.Element => (
			<div className="truncate">
				<a href={`mailto:${row.original.email}`} className="hover:text-primary hover:underline">
					{row.original.email}
				</a>
			</div>
		),
		size: 150,
		meta: {
			cellClassName: "text-left",
			skeleton: <Skeleton className="h-7 w-28" />,
		},
		enableSorting: true,
		enableHiding: true,
		enableResizing: true,
	},
	{
		accessorKey: "status",
		id: "status",
		header: ({ column }): React.JSX.Element => <DataGridColumnHeader title="Status" visibility column={column} />,
		cell: ({ row }): React.JSX.Element =>
			row.original.status === "active" ? <Badge variant="success-outline">Approved</Badge> : <Badge variant="warning-outline">Pending</Badge>,
		meta: {
			skeleton: <Skeleton className="h-7 w-16" />,
		},
		size: 100,
		enableSorting: true,
		enableHiding: true,
		enableResizing: false,
	},
];

export function DataGrid21Example(): React.JSX.Element {
	const [pagination, setPagination] = React.useState<PaginationState>(INITIAL_PAGINATION);
	const [sorting, setSorting] = React.useState<SortingState>(INITIAL_SORTING);
	const [columnOrder, setColumnOrder] = React.useState<ColumnOrderState>(INITIAL_COLUMN_ORDER);
	const [isLoading, setIsLoading] = React.useState(true);

	const handleToggleLoading = React.useCallback((): void => {
		setIsLoading((loading: boolean): boolean => !loading);
	}, []);

	const table = useTable({
		features: dataGridFeatures,
		columns: COLUMNS,
		data: MEMBERS,
		getRowId: getMemberId,
		state: {
			pagination,
			sorting,
			columnOrder,
		},
		onPaginationChange: setPagination,
		onSortingChange: setSorting,
		onColumnOrderChange: setColumnOrder,
	});

	return (
		<DataGrid table={table} recordCount={MEMBERS.length} isLoading={isLoading} tableClassNames={TABLE_CLASS_NAMES} tableLayout={TABLE_LAYOUT}>
			<Card className="w-full gap-3 py-3.5">
				<CardHeader className="flex items-center justify-between px-3.5">
					<CardTitle>Employees</CardTitle>
					<CardAction>
						<Button variant="outline" size="sm" onClick={handleToggleLoading}>
							{isLoading ? "Disable Loading" : "Enable Loading"}
						</Button>
					</CardAction>
				</CardHeader>
				<div className="w-full px-3.5">
					<Card className="p-0">
						<DataGridContainer>
							<DataGridScrollArea>
								<DataGridTable />
							</DataGridScrollArea>
						</DataGridContainer>
					</Card>
				</div>
				<CardFooter className="border-none bg-transparent! px-3.5 py-0">
					<DataGridPagination />
				</CardFooter>
			</Card>
		</DataGrid>
	);
}
