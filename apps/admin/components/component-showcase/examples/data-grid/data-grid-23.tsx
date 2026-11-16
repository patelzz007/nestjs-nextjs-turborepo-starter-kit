"use client";

import { Avatar, AvatarFallback, AvatarImage } from "@workspace/ui/components/avatar";
import { Badge } from "@workspace/ui/components/badge";
import { Button } from "@workspace/ui/components/button";
import { Checkbox } from "@workspace/ui/components/checkbox";
import { DataGrid, dataGridFeatures, type DataGridFeatures, type DataGridTableLayout } from "@workspace/ui/components/data-grid/data-grid";
import { DataGridColumnHeader } from "@workspace/ui/components/data-grid/data-grid-column-header";
import { DataGridPagination } from "@workspace/ui/components/data-grid/data-grid-pagination";
import { DataGridScrollArea } from "@workspace/ui/components/data-grid/data-grid-scroll-area";
import { DataGridTable, DataGridTableRowSelect, DataGridTableRowSelectAll } from "@workspace/ui/components/data-grid/data-grid-table";
import { DropdownMenu, DropdownMenuContent, DropdownMenuItem, DropdownMenuSeparator, DropdownMenuTrigger } from "@workspace/ui/components/dropdown-menu";
import { Frame, FrameFooter, FrameHeader, FramePanel, FrameTitle } from "@workspace/ui/components/frame";
import { InputGroup, InputGroupAddon, InputGroupButton, InputGroupInput } from "@workspace/ui/components/input-group";
import { Label } from "@workspace/ui/components/label";
import { Popover, PopoverContent, PopoverTrigger } from "@workspace/ui/components/popover";
import { toastMessage } from "@workspace/ui/components/toast";
import { useCopyToClipboard } from "@workspace/ui/hooks/use-copy-to-clipboard";
import { useTable, type ColumnDef, type ColumnOrderState, type PaginationState, type SortingState } from "@tanstack/react-table";
import { FunnelIcon, MoreHorizontalIcon, SearchIcon, UserPlusIcon, XIcon } from "lucide-react";
import * as React from "react";

interface Member {
	readonly id: string;
	readonly name: string;
	readonly availability: "online" | "away" | "busy" | "offline";
	readonly avatar: string;
	readonly status: "Active" | "Inactive" | "Pending" | "Blocked";
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
		status: "Active",
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
		status: "Inactive",
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
		status: "Blocked",
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
		status: "Inactive",
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
		status: "Active",
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
		status: "Pending",
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
		status: "Inactive",
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
		status: "Blocked",
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
		status: "Pending",
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
		status: "Inactive",
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
		status: "Blocked",
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
		status: "Active",
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

function getMemberId(member: Member): string {
	return member.id;
}

function initialsOf(name: string): string {
	return name
		.split(" ")
		.map((part: string): string => part.charAt(0))
		.join("");
}

const TABLE_LAYOUT: DataGridTableLayout = { columnsPinnable: true, columnsResizable: false, columnsMovable: true, columnsVisibility: true };
/** The columns' ids in their initial order: the header menus move columns within this list. */
const INITIAL_COLUMN_ORDER: ColumnOrderState = ["id", "name", "location", "role", "joined", "status", "actions"];

type MemberStatus = Member["status"];

/** The status filter's options, in the order the popover lists them. */
const STATUSES: readonly MemberStatus[] = ["Active", "Inactive", "Pending", "Blocked"];

const STATUS_BADGES: Record<MemberStatus, React.JSX.Element> = {
	Active: <Badge variant="success-outline">Approved</Badge>,
	Blocked: <Badge variant="destructive-outline">Blocked</Badge>,
	Inactive: <Badge variant="info-outline">Inactive</Badge>,
	Pending: <Badge variant="warning-outline">Pending</Badge>,
};

function countStatuses(members: readonly Member[]): Record<MemberStatus, number> {
	const counts: Record<MemberStatus, number> = { Active: 0, Inactive: 0, Pending: 0, Blocked: 0 };
	for (const member of members) {
		counts[member.status] += 1;
	}
	return counts;
}

/** Every text field of a member, joined for the free-text search. */
function searchableText(member: Member): string {
	return [member.name, member.email, member.company, member.role, member.joined, member.location, member.status, String(member.balance)].join(" ").toLowerCase();
}

function matchesFilters(member: Member, query: string, statuses: readonly MemberStatus[]): boolean {
	const matchesStatus = statuses.length === 0 || statuses.includes(member.status);
	const matchesSearch = query === "" || searchableText(member).includes(query.toLowerCase());
	return matchesStatus && matchesSearch;
}

const ROW_ACTIONS_TRIGGER = (
	<Button className="size-7" size="icon" variant="ghost" aria-label="Row actions">
		<MoreHorizontalIcon aria-hidden="true" />
	</Button>
);

interface ActionsCellProps {
	readonly member: Member;
	readonly onDelete: (memberId: string) => void;
}

function ActionsCell({ member, onDelete }: ActionsCellProps): React.JSX.Element {
	const { copyToClipboard } = useCopyToClipboard();

	const handleEdit = React.useCallback((): void => {
		toastMessage.info({ title: `Editing ${member.name}`, description: "A real app opens the employee editor here." });
	}, [member.name]);

	const handleCopyId = React.useCallback((): void => {
		copyToClipboard(member.id);
		toastMessage.success({ title: "Employee ID successfully copied", description: member.id });
	}, [copyToClipboard, member.id]);

	const handleDelete = React.useCallback((): void => {
		onDelete(member.id);
	}, [member.id, onDelete]);

	return (
		<DropdownMenu>
			<DropdownMenuTrigger render={ROW_ACTIONS_TRIGGER} />
			<DropdownMenuContent side="bottom" align="start">
				<DropdownMenuItem onClick={handleEdit}>Edit</DropdownMenuItem>
				<DropdownMenuItem onClick={handleCopyId}>Copy ID</DropdownMenuItem>
				<DropdownMenuSeparator />
				<DropdownMenuItem variant="destructive" onClick={handleDelete}>
					Delete
				</DropdownMenuItem>
			</DropdownMenuContent>
		</DropdownMenu>
	);
}

interface StatusFilterOptionProps {
	readonly status: MemberStatus;
	readonly count: number;
	readonly checked: boolean;
	readonly onCheckedChange: (status: MemberStatus, checked: boolean) => void;
}

function StatusFilterOption({ status, count, checked, onCheckedChange }: StatusFilterOptionProps): React.JSX.Element {
	const id = React.useId();
	const handleCheckedChange = React.useCallback(
		(next: boolean): void => {
			onCheckedChange(status, next);
		},
		[onCheckedChange, status],
	);

	return (
		<div className="flex items-center gap-2.5">
			<Checkbox id={id} checked={checked} onCheckedChange={handleCheckedChange} />
			<Label htmlFor={id} className="flex grow items-center justify-between gap-1.5 font-normal">
				{status}
				<span className="text-muted-foreground">{count}</span>
			</Label>
		</div>
	);
}

function SelectAllHeader(): React.JSX.Element {
	return <DataGridTableRowSelectAll />;
}

function buildColumns(onDelete: (memberId: string) => void): ColumnDef<DataGridFeatures, Member>[] {
	return [
		{
			accessorKey: "id",
			id: "id",
			header: SelectAllHeader,
			cell: ({ row }): React.JSX.Element => <DataGridTableRowSelect row={row} />,
			enableSorting: false,
			size: 35,
			enableResizing: false,
		},
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
			size: 260,
			meta: {
				autoSize: true,
			},
			enableSorting: true,
			enableHiding: false,
			enableResizing: true,
		},
		{
			accessorKey: "location",
			id: "location",
			header: ({ column }): React.JSX.Element => <DataGridColumnHeader title="Location" visibility column={column} />,
			cell: ({ row }): React.JSX.Element => (
				<div className="flex items-center gap-1.5">
					<span role="img" aria-label={row.original.location} className="text-sm leading-none">
						{row.original.flag}
					</span>
					<div className="min-w-0 truncate font-medium text-foreground">{row.original.location}</div>
				</div>
			),
			size: 150,
			meta: {
				cellClassName: "text-start",
			},
			enableSorting: true,
			enableHiding: true,
			enableResizing: true,
		},
		{
			accessorKey: "role",
			id: "role",
			header: ({ column }): React.JSX.Element => <DataGridColumnHeader title="Role" visibility column={column} />,
			cell: ({ row }): React.JSX.Element => <div className="font-medium text-foreground">{row.original.role}</div>,
			size: 150,
			enableSorting: true,
			enableHiding: true,
			enableResizing: true,
		},
		{
			accessorKey: "joined",
			id: "joined",
			header: ({ column }): React.JSX.Element => <DataGridColumnHeader title="Joined" visibility column={column} />,
			cell: ({ row }): React.JSX.Element => <div className="font-medium text-foreground">{row.original.joined}</div>,
			size: 150,
			enableSorting: true,
			enableHiding: true,
			enableResizing: true,
		},
		{
			accessorKey: "status",
			id: "status",
			header: ({ column }): React.JSX.Element => <DataGridColumnHeader title="Status" visibility column={column} />,
			cell: ({ row }): React.JSX.Element => STATUS_BADGES[row.original.status],
			size: 100,
			enableSorting: true,
			enableHiding: true,
			enableResizing: true,
		},
		{
			id: "actions",
			header: "",
			cell: ({ row }): React.JSX.Element => <ActionsCell member={row.original} onDelete={onDelete} />,
			size: 60,
			enableSorting: false,
			enableHiding: false,
			enableResizing: false,
		},
	];
}

export function DataGrid23Example(): React.JSX.Element {
	const [members, setMembers] = React.useState<Member[]>(MEMBERS);
	const [pagination, setPagination] = React.useState<PaginationState>(INITIAL_PAGINATION);
	const [sorting, setSorting] = React.useState<SortingState>(INITIAL_SORTING);
	const [columnOrder, setColumnOrder] = React.useState<ColumnOrderState>(INITIAL_COLUMN_ORDER);
	const [searchQuery, setSearchQuery] = React.useState("");
	const [selectedStatuses, setSelectedStatuses] = React.useState<MemberStatus[]>([]);

	const filteredData = React.useMemo(
		(): Member[] => members.filter((member: Member): boolean => matchesFilters(member, searchQuery, selectedStatuses)),
		[members, searchQuery, selectedStatuses],
	);

	const statusCounts = React.useMemo((): Record<MemberStatus, number> => countStatuses(members), [members]);

	const handleStatusChange = React.useCallback((status: MemberStatus, checked: boolean): void => {
		setSelectedStatuses((previous: MemberStatus[]): MemberStatus[] =>
			checked ? [...previous, status] : previous.filter((selected: MemberStatus): boolean => selected !== status),
		);
	}, []);

	const handleSearchChange = React.useCallback((event: React.ChangeEvent<HTMLInputElement>): void => {
		setSearchQuery(event.target.value);
	}, []);

	const handleClearSearch = React.useCallback((): void => {
		setSearchQuery("");
	}, []);

	const handleDelete = React.useCallback((memberId: string): void => {
		setMembers((previous: Member[]): Member[] => previous.filter((member: Member): boolean => member.id !== memberId));
	}, []);

	const columns = React.useMemo((): ColumnDef<DataGridFeatures, Member>[] => buildColumns(handleDelete), [handleDelete]);

	const statusTrigger = React.useMemo(
		(): React.JSX.Element => (
			<Button variant="outline">
				<FunnelIcon aria-hidden="true" />
				Status
				{selectedStatuses.length > 0 ? (
					<Badge size="sm" variant="info-outline">
						{selectedStatuses.length}
					</Badge>
				) : null}
			</Button>
		),
		[selectedStatuses.length],
	);

	const table = useTable({
		features: dataGridFeatures,
		columns,
		data: filteredData,
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

	const toolbar = (
		<div className="flex items-center gap-2.5">
			<InputGroup className="w-48 bg-background">
				<InputGroupAddon align="inline-start">
					<SearchIcon aria-hidden="true" />
				</InputGroupAddon>
				<InputGroupInput placeholder="Search..." aria-label="Search employees" value={searchQuery} onChange={handleSearchChange} />
				{searchQuery.length > 0 ? (
					<InputGroupAddon align="inline-end">
						<InputGroupButton aria-label="Clear search" title="Clear" size="icon-xs" onClick={handleClearSearch}>
							<XIcon aria-hidden="true" />
						</InputGroupButton>
					</InputGroupAddon>
				) : null}
			</InputGroup>
			<Popover>
				<PopoverTrigger render={statusTrigger} />
				<PopoverContent className="w-40" align="start">
					<div className="space-y-3">
						<div className="text-xs font-medium text-muted-foreground">Filters</div>
						<div className="space-y-3">
							{STATUSES.map((status: MemberStatus): React.JSX.Element => (
								<StatusFilterOption
									key={status}
									status={status}
									count={statusCounts[status]}
									checked={selectedStatuses.includes(status)}
									onCheckedChange={handleStatusChange}
								/>
							))}
						</div>
					</div>
				</PopoverContent>
			</Popover>
		</div>
	);

	const addButton = (
		<Button>
			<UserPlusIcon aria-hidden="true" />
			Add new
		</Button>
	);

	return (
		<DataGrid table={table} recordCount={filteredData.length} tableLayout={TABLE_LAYOUT}>
			<Frame className="w-full" stacked dense>
				<FrameHeader className="flex w-full flex-row flex-wrap items-center justify-between gap-3">
					<FrameTitle>Team members</FrameTitle>
					<div className="flex items-center gap-2.5">
						{toolbar}
						{addButton}
					</div>
				</FrameHeader>
				<FramePanel className="p-0 shadow-none">
					<DataGridScrollArea>
						<DataGridTable />
					</DataGridScrollArea>
				</FramePanel>
				<FrameFooter className="py-1.5 pr-2 pl-2.5">
					<DataGridPagination />
				</FrameFooter>
			</Frame>
		</DataGrid>
	);
}
