"use client";

import { Avatar, AvatarFallback, AvatarImage } from "@workspace/ui/components/avatar";
import { Badge } from "@workspace/ui/components/badge";
import { DataGrid, DataGridContainer, dataGridFeatures, type DataGridFeatures, type DataGridTableLayout } from "@workspace/ui/components/data-grid/data-grid";
import { DataGridPagination } from "@workspace/ui/components/data-grid/data-grid-pagination";
import { DataGridScrollArea } from "@workspace/ui/components/data-grid/data-grid-scroll-area";
import { DataGridTableDnd, type DataGridTableDndProps } from "@workspace/ui/components/data-grid/data-grid-table-dnd";
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
		email: "alex@apple.com",
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
		email: "sarah@openai.com",
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
		email: "michael@meta.com",
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
		email: "emma@tesla.com",
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
		status: "inactive",
		flag: "🇩🇪",
		email: "david@sap.com",
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
		email: "aron@keenthemes.com",
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
		email: "james@bbva.es",
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
		status: "inactive",
		flag: "🇯🇵",
		email: "maria@sony.jp",
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
		email: "nick@lvmh.fr",
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
		email: "liam@eni.it",
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
		status: "active",
		flag: "🇧🇷",
		email: "alex@vale.br",
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
		email: "sarah@tata.in",
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
const TABLE_LAYOUT: DataGridTableLayout = { columnsDraggable: true };
/** The columns' ids in their initial order: the drag handles reorder this list. */
const INITIAL_COLUMN_ORDER: ColumnOrderState = ["name", "email", "status"];

type ColumnDragEndHandler = DataGridTableDndProps["handleDragEnd"];

function getMemberId(member: Member): string {
	return member.id;
}

function initialsOf(name: string): string {
	return name
		.split(" ")
		.map((part: string): string => part.charAt(0))
		.join("");
}

/** Moves `activeId` to where `overId` sits; an unknown id leaves the order unchanged. */
function moveColumn(order: ColumnOrderState, activeId: string, overId: string): ColumnOrderState {
	const from = order.indexOf(activeId);
	const to = order.indexOf(overId);
	if (from === -1 || to === -1) {
		return order;
	}
	const next = order.filter((id: string): boolean => id !== activeId);
	next.splice(to, 0, activeId);
	return next;
}

const COLUMNS: ColumnDef<DataGridFeatures, Member>[] = [
	{
		accessorKey: "name",
		id: "name",
		header: "Name",
		cell: ({ row }): React.JSX.Element => (
			<div className="flex items-center gap-2">
				<Avatar className="size-6">
					<AvatarImage src={row.original.avatar} alt={row.original.name} />
					<AvatarFallback>{initialsOf(row.original.name)}</AvatarFallback>
				</Avatar>
				<span className="font-medium text-foreground">{row.original.name}</span>
			</div>
		),
		size: 175,
		enableSorting: true,
		enableHiding: false,
	},
	{
		accessorKey: "email",
		id: "email",
		header: "Email",
		cell: ({ row }): React.JSX.Element => (
			<a href={`mailto:${row.original.email}`} className="hover:text-primary hover:underline">
				{row.original.email}
			</a>
		),
		size: 140,
	},
	{
		accessorKey: "status",
		id: "status",
		header: "Status",
		cell: ({ row }): React.JSX.Element =>
			row.original.status === "active" ? <Badge variant="success-light">Approved</Badge> : <Badge variant="warning-light">Pending</Badge>,
		size: 100,
	},
];

export function DataGrid13Example(): React.JSX.Element {
	const [pagination, setPagination] = React.useState<PaginationState>(INITIAL_PAGINATION);
	const [sorting, setSorting] = React.useState<SortingState>(INITIAL_SORTING);
	const [columnOrder, setColumnOrder] = React.useState<ColumnOrderState>(INITIAL_COLUMN_ORDER);

	const handleDragEnd = React.useCallback<ColumnDragEndHandler>(({ active, over }): void => {
		if (over === null || active.id === over.id) {
			return;
		}
		setColumnOrder((order: ColumnOrderState): ColumnOrderState => moveColumn(order, String(active.id), String(over.id)));
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
		onColumnOrderChange: setColumnOrder,
		onPaginationChange: setPagination,
		onSortingChange: setSorting,
	});

	return (
		<DataGrid table={table} recordCount={MEMBERS.length} tableLayout={TABLE_LAYOUT}>
			<div className="w-full space-y-2.5">
				<DataGridContainer>
					<DataGridScrollArea>
						<DataGridTableDnd handleDragEnd={handleDragEnd} />
					</DataGridScrollArea>
				</DataGridContainer>
				<DataGridPagination />
			</div>
		</DataGrid>
	);
}
