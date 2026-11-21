"use client";

import type * as React from "react";

import { Avatar, AvatarFallback } from "@workspace/ui/components/avatar";
import { Badge } from "@workspace/ui/components/badge";
import {
	DataTable,
	type DataTableColumns,
	type DataTableFilter,
	type DataTableFilterOption,
	type DataTablePaging,
	type DataTableSearch,
} from "@workspace/ui/components/data-table";

/** One person in the directory. */
interface Employee {
	readonly id: string;
	readonly name: string;
	readonly email: string;
	readonly title: string;
	readonly department: string;
	readonly location: string;
	readonly status: "active" | "on-leave" | "offboarding";
}

export const EMPLOYEES: readonly Employee[] = [
	{ id: "e-1", name: "Aisha Rahman", email: "aisha@example.com", title: "Engineering manager", department: "Engineering", location: "Kuala Lumpur", status: "active" },
	{ id: "e-2", name: "Ben Ortega", email: "ben@example.com", title: "Account executive", department: "Sales", location: "Singapore", status: "active" },
	{ id: "e-3", name: "Chen Wei", email: "chen@example.com", title: "Product designer", department: "Design", location: "Penang", status: "on-leave" },
	{ id: "e-4", name: "Divya Nair", email: "divya@example.com", title: "Backend engineer", department: "Engineering", location: "Kuala Lumpur", status: "active" },
	{ id: "e-5", name: "Elena Petrova", email: "elena@example.com", title: "Support lead", department: "Support", location: "Singapore", status: "offboarding" },
	{ id: "e-6", name: "Farid Hassan", email: "farid@example.com", title: "Sales engineer", department: "Sales", location: "Penang", status: "active" },
	{ id: "e-7", name: "Grace Lim", email: "grace@example.com", title: "Frontend engineer", department: "Engineering", location: "Singapore", status: "active" },
	{ id: "e-8", name: "Hiro Tanaka", email: "hiro@example.com", title: "Support agent", department: "Support", location: "Kuala Lumpur", status: "on-leave" },
];

/** How many words of a name give its initials. */
const INITIALS_WORDS = 2;

/** A person's initials for the avatar: first letter of the first two words. */
export function initialsOf(name: string): string {
	return name
		.split(" ")
		.filter(Boolean)
		.slice(0, INITIALS_WORDS)
		.map((word) => word.charAt(0).toUpperCase())
		.join("");
}

const STATUS_BADGE: Readonly<Record<Employee["status"], { readonly label: string; readonly variant: "success-light" | "warning-light" | "destructive-light" }>> = {
	active: { label: "Active", variant: "success-light" },
	"on-leave": { label: "On leave", variant: "warning-light" },
	offboarding: { label: "Offboarding", variant: "destructive-light" },
};

/** One filter option per distinct value, in alphabetical order. */
export function optionsFrom(values: readonly string[]): DataTableFilterOption[] {
	return [...new Set(values)].sort().map((value): DataTableFilterOption => ({ value, label: value }));
}

/** What the person column holds: the name and the email, so it sorts and exports as one value. */
export function personText(employee: Employee): string {
	return `${employee.name} ${employee.email}`;
}

const FILTERS: readonly DataTableFilter[] = [
	{ kind: "multi-select", column: "department", label: "Department", options: optionsFrom(EMPLOYEES.map((employee) => employee.department)) },
	{ kind: "multi-select", column: "location", label: "Location", options: optionsFrom(EMPLOYEES.map((employee) => employee.location)) },
];

/** The name and the email share the "Person" column; the search reads each from the row. */
const SEARCH: DataTableSearch<Employee> = { keys: ["name", "email", "title"] };
const PAGING: DataTablePaging = { pageSize: 5 };

function getEmployeeId(employee: Employee): string {
	return employee.id;
}

const COLUMNS: DataTableColumns<Employee> = [
	{
		id: "person",
		header: "Person",
		size: 260,
		// A stacked cell: name over email, beside the avatar. The value holds both, so it sorts and exports as one.
		accessorFn: personText,
		cell: ({ row }): React.JSX.Element => (
			<div className="flex items-center gap-3">
				<Avatar size="sm">
					<AvatarFallback>{initialsOf(row.original.name)}</AvatarFallback>
				</Avatar>
				<div className="flex min-w-0 flex-col">
					<span className="truncate font-medium">{row.original.name}</span>
					<span className="truncate text-xs text-muted-foreground">{row.original.email}</span>
				</div>
			</div>
		),
	},
	{ accessorKey: "title", header: "Role", size: 200 },
	{ accessorKey: "department", header: "Department", size: 140 },
	{ accessorKey: "location", header: "Location", size: 140 },
	{
		accessorKey: "status",
		header: "Status",
		size: 130,
		cell: ({ row }): React.JSX.Element => {
			const badge = STATUS_BADGE[row.original.status];
			return <Badge variant={badge.variant}>{badge.label}</Badge>;
		},
	},
];

/**
 * Recipe: a CRM people directory. Stacked cells put a name over its email and a role over its department; the
 * multi-select filters show live counts that follow the other filter and the search.
 */
export function DataTableRecipeCrmEmployees(): React.JSX.Element {
	return <DataTable data={EMPLOYEES} columns={COLUMNS} getRowId={getEmployeeId} search={SEARCH} filters={FILTERS} paging={PAGING} />;
}
