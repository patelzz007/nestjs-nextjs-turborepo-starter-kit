"use client";

import { closestCenter, DndContext, KeyboardSensor, MouseSensor, TouchSensor, useSensor, useSensors, type DragEndEvent, type UniqueIdentifier } from "@dnd-kit/core";
import { restrictToVerticalAxis } from "@dnd-kit/modifiers";
import { arrayMove, SortableContext, useSortable, verticalListSortingStrategy } from "@dnd-kit/sortable";
import { CSS } from "@dnd-kit/utilities";
import {
	flexRender,
	getCoreRowModel,
	getFacetedRowModel,
	getFacetedUniqueValues,
	getFilteredRowModel,
	getPaginationRowModel,
	getSortedRowModel,
	useReactTable,
	type ColumnFiltersState,
	type Row,
	type RowSelectionState,
	type SortingState,
	type VisibilityState,
} from "@tanstack/react-table";
import { Button } from "@workspace/ui/components/button";
import { DropdownMenu, DropdownMenuContent, DropdownMenuTrigger } from "@workspace/ui/components/dropdown-menu";
import { Label } from "@workspace/ui/components/label";
import { Select, SelectContent, SelectGroup, SelectItem, SelectTrigger, SelectValue } from "@workspace/ui/components/select";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@workspace/ui/components/table";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@workspace/ui/components/tabs";
import { Badge } from "@workspace/ui/components/badge";
import { ChevronDownIcon, ChevronLeftIcon, ChevronRightIcon, ChevronsLeftIcon, ChevronsRightIcon, Columns3Icon, PlusIcon } from "lucide-react";
import * as React from "react";

import { ColumnVisibilityCheckbox, columns } from "@/components/dashboard/data-table-columns";
import { PAGE_SIZE_ITEMS, VIEW_ITEMS, type RowData } from "@/components/dashboard/data-table-constants";

function DraggableRow({ row }: { row: Row<RowData> }): React.JSX.Element {
	const { transform, transition, setNodeRef, isDragging } = useSortable({
		id: row.original.id,
	});

	return (
		<TableRow
			data-state={row.getIsSelected() ? "selected" : null}
			data-dragging={isDragging}
			ref={setNodeRef}
			className="relative z-0 data-[dragging=true]:z-10 data-[dragging=true]:opacity-80"
			style={{
				transform: CSS.Transform.toString(transform),
				transition,
			}}>
			{row.getVisibleCells().map((cell) => (
				<TableCell key={cell.id}>{flexRender(cell.column.columnDef.cell, cell.getContext())}</TableCell>
			))}
		</TableRow>
	);
}

function ColumnVisibilityDropdown({ table }: { table: ReturnType<typeof useReactTable<RowData>> }): React.JSX.Element {
	return (
		<DropdownMenu>
			<DropdownMenuTrigger render={<Button variant="outline" size="sm" />}>
				<Columns3Icon data-icon="inline-start" />
				Columns
				<ChevronDownIcon data-icon="inline-end" />
			</DropdownMenuTrigger>
			<DropdownMenuContent align="end" className="w-32">
				{table
					.getAllColumns()
					.filter((column) => typeof column.accessorFn !== "undefined" && column.getCanHide())
					.map((column) => (
						<ColumnVisibilityCheckbox key={column.id} column={column} />
					))}
			</DropdownMenuContent>
		</DropdownMenu>
	);
}

export function DataTable({ data: initialData }: { data: RowData[] }): React.JSX.Element {
	const [data, setData] = React.useState<RowData[]>(() => initialData);
	const [rowSelection, setRowSelection] = React.useState<RowSelectionState>({});
	const [columnVisibility, setColumnVisibility] = React.useState<VisibilityState>({});
	const [columnFilters, setColumnFilters] = React.useState<ColumnFiltersState>([]);
	const [sorting, setSorting] = React.useState<SortingState>([]);
	const [pagination, setPagination] = React.useState({
		pageIndex: 0,
		pageSize: 10,
	});
	const sortableId = React.useId();
	const sensors = useSensors(useSensor(MouseSensor, {}), useSensor(TouchSensor, {}), useSensor(KeyboardSensor, {}));
	const dataIds = React.useMemo<UniqueIdentifier[]>(() => data.map(({ id }) => id), [data]);

	const table = useReactTable({
		data,
		columns,
		state: {
			sorting,
			columnVisibility,
			rowSelection,
			columnFilters,
			pagination,
		},
		getRowId: (row) => row.id.toString(),
		enableRowSelection: true,
		onRowSelectionChange: setRowSelection,
		onSortingChange: setSorting,
		onColumnFiltersChange: setColumnFilters,
		onColumnVisibilityChange: setColumnVisibility,
		onPaginationChange: setPagination,
		getCoreRowModel: getCoreRowModel(),
		getFilteredRowModel: getFilteredRowModel(),
		getPaginationRowModel: getPaginationRowModel(),
		getSortedRowModel: getSortedRowModel(),
		getFacetedRowModel: getFacetedRowModel(),
		getFacetedUniqueValues: getFacetedUniqueValues(),
	});

	const handleDragEnd = React.useCallback(
		(event: DragEndEvent): void => {
			const { active, over } = event;
			if (over !== null && active.id !== over.id) {
				setData((current) => {
					const oldIndex = dataIds.indexOf(active.id);
					const newIndex = dataIds.indexOf(over.id);
					return arrayMove(current, oldIndex, newIndex);
				});
			}
		},
		[dataIds],
	);

	const handleFirstPage = React.useCallback((): void => {
		table.setPageIndex(0);
	}, [table]);

	const handlePreviousPage = React.useCallback((): void => {
		table.previousPage();
	}, [table]);

	const handleNextPage = React.useCallback((): void => {
		table.nextPage();
	}, [table]);

	const handleLastPage = React.useCallback((): void => {
		table.setPageIndex(table.getPageCount() - 1);
	}, [table]);

	const handlePageSizeChange = React.useCallback(
		(value: string | null): void => {
			if (value !== null) {
				table.setPageSize(Number(value));
			}
		},
		[table],
	);

	return (
		<Tabs defaultValue="outline" className="w-full flex-col justify-start gap-6">
			<div className="flex items-center justify-between px-4 lg:px-6">
				<Label htmlFor="view-selector" className="sr-only">
					View
				</Label>
				<Select defaultValue="outline" items={VIEW_ITEMS}>
					<SelectTrigger className="flex w-fit @4xl/main:hidden" size="sm" id="view-selector">
						<SelectValue placeholder="Select a view" />
					</SelectTrigger>
					<SelectContent>
						<SelectGroup>
							{VIEW_ITEMS.map((option) => (
								<SelectItem key={option.value} value={option.value}>
									{option.label}
								</SelectItem>
							))}
						</SelectGroup>
					</SelectContent>
				</Select>
				<TabsList className="hidden **:data-[slot=badge]:size-5 **:data-[slot=badge]:rounded-full **:data-[slot=badge]:bg-muted-foreground/30 **:data-[slot=badge]:px-1 @4xl/main:flex">
					<TabsTrigger value="outline">Outline</TabsTrigger>
					<TabsTrigger value="past-performance">
						Past Performance <Badge variant="secondary">3</Badge>
					</TabsTrigger>
					<TabsTrigger value="key-personnel">
						Key Personnel <Badge variant="secondary">2</Badge>
					</TabsTrigger>
					<TabsTrigger value="focus-documents">Focus Documents</TabsTrigger>
				</TabsList>
				<div className="flex items-center gap-2">
					<ColumnVisibilityDropdown table={table} />
					<Button variant="outline" size="sm">
						<PlusIcon />
						<span className="hidden lg:inline">Add Section</span>
					</Button>
				</div>
			</div>
			<TabsContent value="outline" className="relative flex flex-col gap-4 overflow-auto px-4 lg:px-6">
				<div className="overflow-hidden rounded-lg border">
					<DndContext collisionDetection={closestCenter} modifiers={[restrictToVerticalAxis]} onDragEnd={handleDragEnd} sensors={sensors} id={sortableId}>
						<Table>
							<TableHeader className="sticky top-0 z-10 bg-muted">
								{table.getHeaderGroups().map((headerGroup) => (
									<TableRow key={headerGroup.id}>
										{headerGroup.headers.map((header) => (
											<TableHead key={header.id} colSpan={header.colSpan}>
												{header.isPlaceholder ? null : flexRender(header.column.columnDef.header, header.getContext())}
											</TableHead>
										))}
									</TableRow>
								))}
							</TableHeader>
							<TableBody className="**:data-[slot=table-cell]:first:w-8">
								{table.getRowModel().rows.length ? (
									<SortableContext items={dataIds} strategy={verticalListSortingStrategy}>
										{table.getRowModel().rows.map((row) => (
											<DraggableRow key={row.id} row={row} />
										))}
									</SortableContext>
								) : (
									<TableRow>
										<TableCell colSpan={columns.length} className="h-24 text-center">
											No results.
										</TableCell>
									</TableRow>
								)}
							</TableBody>
						</Table>
					</DndContext>
				</div>
				<div className="flex items-center justify-between px-4">
					<div className="hidden flex-1 text-sm text-muted-foreground lg:flex">
						{table.getFilteredSelectedRowModel().rows.length} of {table.getFilteredRowModel().rows.length} row(s) selected.
					</div>
					<div className="flex w-full items-center gap-8 lg:w-fit">
						<div className="hidden items-center gap-2 lg:flex">
							<Label htmlFor="rows-per-page" className="text-sm font-medium">
								Rows per page
							</Label>
							<Select value={String(table.getState().pagination.pageSize)} onValueChange={handlePageSizeChange} items={PAGE_SIZE_ITEMS}>
								<SelectTrigger size="sm" className="w-20" id="rows-per-page">
									<SelectValue placeholder={table.getState().pagination.pageSize} />
								</SelectTrigger>
								<SelectContent side="top">
									<SelectGroup>
										{[10, 20, 30, 40, 50].map((pageSize) => (
											<SelectItem key={pageSize} value={String(pageSize)}>
												{pageSize}
											</SelectItem>
										))}
									</SelectGroup>
								</SelectContent>
							</Select>
						</div>
						<div className="flex w-fit items-center justify-center text-sm font-medium">
							Page {table.getState().pagination.pageIndex + 1} of {table.getPageCount()}
						</div>
						<div className="ms-auto flex items-center gap-2 lg:ms-0">
							<Button variant="outline" className="hidden h-8 w-8 p-0 lg:flex" onClick={handleFirstPage} disabled={!table.getCanPreviousPage()}>
								<span className="sr-only">Go to first page</span>
								<ChevronsLeftIcon />
							</Button>
							<Button variant="outline" className="size-8" size="icon" onClick={handlePreviousPage} disabled={!table.getCanPreviousPage()}>
								<span className="sr-only">Go to previous page</span>
								<ChevronLeftIcon />
							</Button>
							<Button variant="outline" className="size-8" size="icon" onClick={handleNextPage} disabled={!table.getCanNextPage()}>
								<span className="sr-only">Go to next page</span>
								<ChevronRightIcon />
							</Button>
							<Button variant="outline" className="hidden size-8 lg:flex" size="icon" onClick={handleLastPage} disabled={!table.getCanNextPage()}>
								<span className="sr-only">Go to last page</span>
								<ChevronsRightIcon />
							</Button>
						</div>
					</div>
				</div>
			</TabsContent>
			<TabsContent value="past-performance" className="flex flex-col px-4 lg:px-6">
				<div className="aspect-video w-full flex-1 rounded-lg border border-dashed" />
			</TabsContent>
			<TabsContent value="key-personnel" className="flex flex-col px-4 lg:px-6">
				<div className="aspect-video w-full flex-1 rounded-lg border border-dashed" />
			</TabsContent>
			<TabsContent value="focus-documents" className="flex flex-col px-4 lg:px-6">
				<div className="aspect-video w-full flex-1 rounded-lg border border-dashed" />
			</TabsContent>
		</Tabs>
	);
}
