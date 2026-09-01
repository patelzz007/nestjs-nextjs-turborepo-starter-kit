"use client";

import { cn } from "@workspace/ui/lib/utils";
import { cva, type VariantProps } from "class-variance-authority";
import * as React from "react";

const tableContainerVariants = cva("relative w-full overflow-x-auto", {
	variants: {
		variant: { default: "" },
		size: { default: "", sm: "text-xs" },
		state: { default: "", loading: "opacity-60", disabled: "opacity-50", error: "" },
	},
	defaultVariants: { variant: "default", size: "default", state: "default" },
});

const tableVariants = cva("w-full caption-bottom text-sm", {
	variants: {
		variant: { default: "" },
		size: { default: "", sm: "text-xs" },
		state: { default: "", loading: "", disabled: "", error: "" },
	},
	defaultVariants: { variant: "default", size: "default", state: "default" },
});

type TableProps = React.ComponentProps<"table"> & VariantProps<typeof tableVariants>;

const Table = React.forwardRef<HTMLTableElement, TableProps>(function Table({ className, variant, size, state, ...props }, ref): React.JSX.Element {
	return (
		<div data-slot="table-container" className={cn(tableContainerVariants({ variant, size, state }))}>
			<table ref={ref} data-slot="table" className={cn(tableVariants({ variant, size, state }), className)} {...props} />
		</div>
	);
});

const TableHeader = React.forwardRef<HTMLTableSectionElement, React.ComponentProps<"thead">>(function TableHeader({ className, ...props }, ref): React.JSX.Element {
	return <thead ref={ref} data-slot="table-header" className={cn("[&_tr]:border-b", className)} {...props} />;
});

const TableBody = React.forwardRef<HTMLTableSectionElement, React.ComponentProps<"tbody">>(function TableBody({ className, ...props }, ref): React.JSX.Element {
	return <tbody ref={ref} data-slot="table-body" className={cn("[&_tr:last-child]:border-0", className)} {...props} />;
});

const TableFooter = React.forwardRef<HTMLTableSectionElement, React.ComponentProps<"tfoot">>(function TableFooter({ className, ...props }, ref): React.JSX.Element {
	return <tfoot ref={ref} data-slot="table-footer" className={cn("border-t bg-muted/50 font-medium [&>tr]:last:border-b-0", className)} {...props} />;
});

const TableRow = React.forwardRef<HTMLTableRowElement, React.ComponentProps<"tr">>(function TableRow({ className, ...props }, ref): React.JSX.Element {
	return (
		<tr
			ref={ref}
			data-slot="table-row"
			className={cn("border-b transition-colors hover:bg-muted/50 has-aria-expanded:bg-muted/50 data-[state=selected]:bg-muted", className)}
			{...props}
		/>
	);
});

const TableHead = React.forwardRef<HTMLTableCellElement, React.ComponentProps<"th">>(function TableHead({ className, ...props }, ref): React.JSX.Element {
	return (
		<th
			ref={ref}
			data-slot="table-head"
			className={cn("h-10 px-2 text-start align-middle font-medium whitespace-nowrap text-foreground has-[[role=checkbox]]:pe-0", className)}
			{...props}
		/>
	);
});

const TableCell = React.forwardRef<HTMLTableCellElement, React.ComponentProps<"td">>(function TableCell({ className, ...props }, ref): React.JSX.Element {
	return <td ref={ref} data-slot="table-cell" className={cn("p-2 align-middle whitespace-nowrap has-[[role=checkbox]]:pe-0", className)} {...props} />;
});

const TableCaption = React.forwardRef<HTMLTableCaptionElement, React.ComponentProps<"caption">>(function TableCaption({ className, ...props }, ref): React.JSX.Element {
	return <caption ref={ref} data-slot="table-caption" className={cn("mt-4 text-sm text-muted-foreground", className)} {...props} />;
});

export { Table, TableHeader, TableBody, TableFooter, TableHead, TableRow, TableCell, TableCaption, tableVariants };
