"use client";

import { type Column, type ColumnDef, type Row, type Table } from "@tanstack/react-table";
import { Badge } from "@workspace/ui/components/badge";
import { Button } from "@workspace/ui/components/button";
import { ChartContainer, ChartTooltip, ChartTooltipContent } from "@workspace/ui/components/chart";
import { Checkbox } from "@workspace/ui/components/checkbox";
import { Drawer, DrawerClose, DrawerContent, DrawerDescription, DrawerFooter, DrawerHeader, DrawerTitle, DrawerTrigger } from "@workspace/ui/components/drawer";
import {
	DropdownMenu,
	DropdownMenuCheckboxItem,
	DropdownMenuContent,
	DropdownMenuItem,
	DropdownMenuSeparator,
	DropdownMenuTrigger,
} from "@workspace/ui/components/dropdown-menu";
import { Input } from "@workspace/ui/components/input";
import { Label } from "@workspace/ui/components/label";
import { Select, SelectContent, SelectGroup, SelectItem, SelectTrigger, SelectValue } from "@workspace/ui/components/select";
import { Separator } from "@workspace/ui/components/separator";
import { useIsMobile } from "@workspace/ui/hooks/use-mobile";
import { CircleCheckIcon, EllipsisVerticalIcon, GripVerticalIcon, LoaderIcon, TrendingUpIcon } from "lucide-react";
import * as React from "react";
import { Area, AreaChart, CartesianGrid, XAxis } from "recharts";
import { toast } from "sonner";
import { useSortable } from "@dnd-kit/sortable";

import type { DashboardFeatures } from "@/components/dashboard/dashboard-table-features";
import {
	chartConfig,
	chartData,
	DRAWER_REVIEWER_ITEMS,
	formatTick,
	REVIEWER_ITEMS,
	SECTION_TYPE_ITEMS,
	STATUS_ITEMS,
	type RowData,
} from "@/components/dashboard/data-table-constants";

function DragHandle({ id }: { id: number }): React.JSX.Element {
	const { attributes, listeners } = useSortable({ id });

	return (
		<Button {...attributes} {...listeners} variant="ghost" size="icon" className="size-7 text-muted-foreground hover:bg-transparent">
			<GripVerticalIcon className="size-3 text-muted-foreground" />
			<span className="sr-only">Drag to reorder</span>
		</Button>
	);
}

function SelectAllCheckbox({ table }: { table: Table<DashboardFeatures, RowData> }): React.JSX.Element {
	const handleCheckedChange = React.useCallback(
		(value: boolean): void => {
			table.toggleAllPageRowsSelected(value);
		},
		[table],
	);

	return (
		<div className="flex items-center justify-center">
			<Checkbox
				checked={table.getIsAllPageRowsSelected()}
				indeterminate={table.getIsSomePageRowsSelected() ? !table.getIsAllPageRowsSelected() : undefined}
				onCheckedChange={handleCheckedChange}
				aria-label="Select all"
			/>
		</div>
	);
}

function SelectRowCheckbox({ row }: { row: Row<DashboardFeatures, RowData> }): React.JSX.Element {
	const handleCheckedChange = React.useCallback(
		(value: boolean): void => {
			row.toggleSelected(value);
		},
		[row],
	);

	return (
		<div className="flex items-center justify-center">
			<Checkbox checked={row.getIsSelected()} onCheckedChange={handleCheckedChange} aria-label="Select row" />
		</div>
	);
}

interface SaveInputCellProps {
	readonly id: string;
	readonly defaultValue: string;
	readonly header: string;
	readonly label: string;
}

function SaveInputCell({ id, defaultValue, header, label }: SaveInputCellProps): React.JSX.Element {
	const handleSubmit = React.useCallback(
		(event: React.SyntheticEvent<HTMLFormElement>): void => {
			event.preventDefault();
			toast.promise(new Promise<void>((resolve) => setTimeout(resolve, 1000)), {
				loading: `Saving ${header}`,
				success: "Done",
				error: "Error",
			});
		},
		[header],
	);

	return (
		<form onSubmit={handleSubmit}>
			<Label htmlFor={id} className="sr-only">
				{label}
			</Label>
			<Input
				className="h-8 w-16 border-transparent bg-transparent text-end shadow-none hover:bg-input/30 focus-visible:border focus-visible:bg-background dark:bg-transparent dark:hover:bg-input/30 dark:focus-visible:bg-input/30"
				defaultValue={defaultValue}
				id={id}
			/>
		</form>
	);
}

function ReviewerCell({ row }: { row: Row<DashboardFeatures, RowData> }): React.JSX.Element {
	const isAssigned = row.original.reviewer !== "Assign reviewer";

	if (isAssigned) {
		return <>{row.original.reviewer}</>;
	}

	return (
		<>
			<Label htmlFor={`${String(row.original.id)}-reviewer`} className="sr-only">
				Reviewer
			</Label>
			<Select items={REVIEWER_ITEMS}>
				<SelectTrigger className="w-38 **:data-[slot=select-value]:block **:data-[slot=select-value]:truncate" size="sm" id={`${String(row.original.id)}-reviewer`}>
					<SelectValue placeholder="Assign reviewer" />
				</SelectTrigger>
				<SelectContent align="end">
					<SelectGroup>
						<SelectItem value="Eddie Lake">Eddie Lake</SelectItem>
						<SelectItem value="Jamik Tashpulatov">Jamik Tashpulatov</SelectItem>
					</SelectGroup>
				</SelectContent>
			</Select>
		</>
	);
}

export function ColumnVisibilityCheckbox({ column }: { column: Column<DashboardFeatures, RowData> }): React.JSX.Element {
	const handleCheckedChange = React.useCallback(
		(value: boolean): void => {
			column.toggleVisibility(value);
		},
		[column],
	);

	return (
		<DropdownMenuCheckboxItem className="capitalize" checked={column.getIsVisible()} onCheckedChange={handleCheckedChange}>
			{column.id}
		</DropdownMenuCheckboxItem>
	);
}

function TableCellViewer({ item }: { item: RowData }): React.JSX.Element {
	const isMobile = useIsMobile();

	return (
		<Drawer swipeDirection={isMobile ? "down" : "right"}>
			<DrawerTrigger render={<Button variant="link" className="w-fit px-0 text-start text-foreground" />}>{item.header}</DrawerTrigger>
			<DrawerContent>
				<DrawerHeader className="gap-1">
					<DrawerTitle>{item.header}</DrawerTitle>
					<DrawerDescription>Showing total visitors for the last 6 months</DrawerDescription>
				</DrawerHeader>
				<div className="flex flex-col gap-4 overflow-y-auto px-4 text-sm">
					{!isMobile ? (
						<>
							<ChartContainer config={chartConfig}>
								<AreaChart accessibilityLayer data={chartData} margin={{ left: 0, right: 10 }}>
									<CartesianGrid vertical={false} />
									<XAxis dataKey="month" tickLine={false} axisLine={false} tickMargin={8} tickFormatter={formatTick} hide />
									<ChartTooltip cursor={false} content={<ChartTooltipContent indicator="dot" />} />
									<Area dataKey="mobile" type="natural" fill="var(--color-mobile)" fillOpacity={0.6} stroke="var(--color-mobile)" stackId="a" />
									<Area dataKey="desktop" type="natural" fill="var(--color-desktop)" fillOpacity={0.4} stroke="var(--color-desktop)" stackId="a" />
								</AreaChart>
							</ChartContainer>
							<Separator />
							<div className="grid gap-2">
								<div className="flex gap-2 leading-none font-medium">
									Trending up by 5.2% this month <TrendingUpIcon className="size-4" />
								</div>
								<div className="text-muted-foreground">
									Showing total visitors for the last 6 months. This is just some random text to test the layout. It spans multiple lines and should wrap around.
								</div>
							</div>
							<Separator />
						</>
					) : null}
					<form className="flex flex-col gap-4">
						<div className="flex flex-col gap-3">
							<Label htmlFor="header">Header</Label>
							<Input id="header" defaultValue={item.header} />
						</div>
						<div className="grid grid-cols-2 gap-4">
							<div className="flex flex-col gap-3">
								<Label htmlFor="type">Type</Label>
								<Select defaultValue={item.type} items={SECTION_TYPE_ITEMS}>
									<SelectTrigger id="type" className="w-full">
										<SelectValue placeholder="Select a type" />
									</SelectTrigger>
									<SelectContent>
										<SelectGroup>
											{SECTION_TYPE_ITEMS.map((option) => (
												<SelectItem key={option.value} value={option.value}>
													{option.label}
												</SelectItem>
											))}
										</SelectGroup>
									</SelectContent>
								</Select>
							</div>
							<div className="flex flex-col gap-3">
								<Label htmlFor="status">Status</Label>
								<Select defaultValue={item.status} items={STATUS_ITEMS}>
									<SelectTrigger id="status" className="w-full">
										<SelectValue placeholder="Select a status" />
									</SelectTrigger>
									<SelectContent>
										<SelectGroup>
											{STATUS_ITEMS.map((option) => (
												<SelectItem key={option.value} value={option.value}>
													{option.label}
												</SelectItem>
											))}
										</SelectGroup>
									</SelectContent>
								</Select>
							</div>
						</div>
						<div className="grid grid-cols-2 gap-4">
							<div className="flex flex-col gap-3">
								<Label htmlFor="target">Target</Label>
								<Input id="target" defaultValue={item.target} />
							</div>
							<div className="flex flex-col gap-3">
								<Label htmlFor="limit">Limit</Label>
								<Input id="limit" defaultValue={item.limit} />
							</div>
						</div>
						<div className="flex flex-col gap-3">
							<Label htmlFor="reviewer">Reviewer</Label>
							<Select defaultValue={item.reviewer} items={DRAWER_REVIEWER_ITEMS}>
								<SelectTrigger id="reviewer" className="w-full">
									<SelectValue placeholder="Select a reviewer" />
								</SelectTrigger>
								<SelectContent>
									<SelectGroup>
										{DRAWER_REVIEWER_ITEMS.map((option) => (
											<SelectItem key={option.value} value={option.value}>
												{option.label}
											</SelectItem>
										))}
									</SelectGroup>
								</SelectContent>
							</Select>
						</div>
					</form>
				</div>
				<DrawerFooter>
					<Button>Submit</Button>
					<DrawerClose render={<Button variant="outline" />}>Done</DrawerClose>
				</DrawerFooter>
			</DrawerContent>
		</Drawer>
	);
}

export const columns: ColumnDef<DashboardFeatures, RowData>[] = [
	{
		id: "drag",
		header: (): null => null,
		cell: ({ row }) => <DragHandle id={row.original.id} />,
	},
	{
		id: "select",
		header: ({ table }) => <SelectAllCheckbox table={table} />,
		cell: ({ row }) => <SelectRowCheckbox row={row} />,
		enableSorting: false,
		enableHiding: false,
	},
	{
		accessorKey: "header",
		header: "Header",
		cell: ({ row }) => <TableCellViewer item={row.original} />,
		enableHiding: false,
	},
	{
		accessorKey: "type",
		header: "Section Type",
		cell: ({ row }) => (
			<div className="w-32">
				<Badge variant="outline" className="px-1.5 text-muted-foreground">
					{row.original.type}
				</Badge>
			</div>
		),
	},
	{
		accessorKey: "status",
		header: "Status",
		cell: ({ row }) => (
			<Badge variant="outline" className="px-1.5 text-muted-foreground">
				{row.original.status === "Done" ? <CircleCheckIcon className="fill-green-500 dark:fill-green-400" /> : <LoaderIcon />}
				{row.original.status}
			</Badge>
		),
	},
	{
		accessorKey: "target",
		header: () => <div className="w-full text-end">Target</div>,
		cell: ({ row }) => <SaveInputCell id={`${String(row.original.id)}-target`} defaultValue={row.original.target} header={row.original.header} label="Target" />,
	},
	{
		accessorKey: "limit",
		header: () => <div className="w-full text-end">Limit</div>,
		cell: ({ row }) => <SaveInputCell id={`${String(row.original.id)}-limit`} defaultValue={row.original.limit} header={row.original.header} label="Limit" />,
	},
	{
		accessorKey: "reviewer",
		header: "Reviewer",
		cell: ({ row }) => <ReviewerCell row={row} />,
	},
	{
		id: "actions",
		cell: () => (
			<DropdownMenu>
				<DropdownMenuTrigger render={<Button variant="ghost" className="flex size-8 text-muted-foreground data-open:bg-muted" size="icon" />}>
					<EllipsisVerticalIcon />
					<span className="sr-only">Open menu</span>
				</DropdownMenuTrigger>
				<DropdownMenuContent align="end" className="w-32">
					<DropdownMenuItem>Edit</DropdownMenuItem>
					<DropdownMenuItem>Make a copy</DropdownMenuItem>
					<DropdownMenuItem>Favorite</DropdownMenuItem>
					<DropdownMenuSeparator />
					<DropdownMenuItem variant="destructive">Delete</DropdownMenuItem>
				</DropdownMenuContent>
			</DropdownMenu>
		),
	},
];
