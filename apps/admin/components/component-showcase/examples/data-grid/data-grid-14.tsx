"use client";

import { Avatar, AvatarFallback, AvatarImage } from "@workspace/ui/components/avatar";
import { DataGrid, DataGridContainer, dataGridFeatures, type DataGridFeatures, type DataGridTableLayout } from "@workspace/ui/components/data-grid/data-grid";
import { DataGridPagination } from "@workspace/ui/components/data-grid/data-grid-pagination";
import { DataGridScrollArea } from "@workspace/ui/components/data-grid/data-grid-scroll-area";
import { DataGridTableDndRowHandle, DataGridTableDndRows, type DataGridTableDndRowsProps } from "@workspace/ui/components/data-grid/data-grid-table-dnd-rows";
import { useTable, type ColumnDef } from "@tanstack/react-table";
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
		status: "active",
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
];

const TABLE_LAYOUT: DataGridTableLayout = { rowsDraggable: true };

type RowDragEndHandler = DataGridTableDndRowsProps["handleDragEnd"];
type RowModifier = NonNullable<DataGridTableDndRowsProps["modifiers"]>[number];

// Let the carried row follow the pointer sideways as well as up and down.
// The default restriction pins it to the column it came from, which puts the
// clone directly on top of the rows you are trying to read; drifting it a
// little to the side lifts it clear of them, so the drop indicator underneath
// stays visible and the seam you are aiming at is much easier to judge. The
// primitive still rails the vertical axis, so the row cannot leave the grid.
const followPointer: RowModifier = ({ transform }) => transform;
const FOLLOW_POINTER: readonly RowModifier[] = [followPointer];

function getMemberId(member: Member): string {
	return member.id;
}

function initialsOf(name: string): string {
	return name
		.split(" ")
		.map((part: string): string => part.charAt(0))
		.join("");
}

/** Moves the row `activeId` to where `overId` sits; an unknown id leaves the rows unchanged. */
function moveMember(members: readonly Member[], activeId: string, overId: string): Member[] {
	const from = members.findIndex((member: Member): boolean => member.id === activeId);
	const to = members.findIndex((member: Member): boolean => member.id === overId);
	const moved = members.find((member: Member): boolean => member.id === activeId);
	if (moved === undefined || from === -1 || to === -1) {
		return [...members];
	}
	const next = members.filter((member: Member): boolean => member.id !== activeId);
	next.splice(to, 0, moved);
	return next;
}

function DragHandleCell(): React.JSX.Element {
	return <DataGridTableDndRowHandle />;
}

const COLUMNS: ColumnDef<DataGridFeatures, Member>[] = [
	{
		id: "drag",
		cell: DragHandleCell,
		size: 30,
	},
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
		size: 170,
		enableSorting: true,
		enableHiding: false,
	},
	{
		accessorKey: "email",
		id: "email",
		header: "Email",
		cell: ({ row }): React.JSX.Element => (
			<a href={`mailto:${row.original.email}`} className="truncate hover:text-primary hover:underline">
				{row.original.email}
			</a>
		),
		size: 150,
	},
	{
		accessorKey: "location",
		id: "location",
		header: "Location",
		cell: ({ row }): React.JSX.Element => (
			<div className="flex items-center gap-1.5">
				<span role="img" aria-label={row.original.location} className="text-sm leading-none">
					{row.original.flag}
				</span>
				<div className="font-medium text-foreground">{row.original.location}</div>
			</div>
		),
		size: 170,
		meta: {
			cellClassName: "text-start",
		},
	},
];

export function DataGrid14Example(): React.JSX.Element {
	const [data, setData] = React.useState<Member[]>(MEMBERS);

	const dataIds = React.useMemo((): string[] => data.map(getMemberId), [data]);

	const handleDragEnd = React.useCallback<RowDragEndHandler>(({ active, over }): void => {
		if (over === null || active.id === over.id) {
			return;
		}
		setData((members: Member[]): Member[] => moveMember(members, String(active.id), String(over.id)));
	}, []);

	const table = useTable({
		features: dataGridFeatures,
		// Every row is rendered: manualPagination says the data already is the
		// page, so the shared bundle's pagination row model leaves it unsliced
		// while the pagination APIs stay available.
		manualPagination: true,
		columns: COLUMNS,
		data,
		getRowId: getMemberId,
	});

	return (
		<DataGrid table={table} recordCount={data.length} tableLayout={TABLE_LAYOUT}>
			<div className="w-full space-y-2.5">
				<DataGridContainer>
					<DataGridScrollArea>
						<DataGridTableDndRows handleDragEnd={handleDragEnd} dataIds={dataIds} modifiers={FOLLOW_POINTER} />
					</DataGridScrollArea>
				</DataGridContainer>
				<DataGridPagination />
			</div>
		</DataGrid>
	);
}
