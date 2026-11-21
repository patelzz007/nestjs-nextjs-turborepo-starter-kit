"use client";

import * as React from "react";
import { z } from "zod";

import { Checkbox } from "@workspace/ui/components/checkbox";
import { DataTable, type DataTableColumns, type DataTableLayout } from "@workspace/ui/components/data-table";

const roleSchema = z.enum(["viewer", "editor", "admin", "owner"]);
type Role = z.output<typeof roleSchema>;
const ROLES: readonly Role[] = roleSchema.options;

const ROLE_NAMES: Readonly<Record<Role, string>> = { viewer: "Viewer", editor: "Editor", admin: "Admin", owner: "Owner" };

/** One permission, and which roles hold it. */
interface PermissionRow {
	readonly id: string;
	readonly area: string;
	readonly permission: string;
	readonly granted: ReadonlySet<Role>;
}

export const PERMISSIONS: readonly PermissionRow[] = [
	{ id: "orders.read", area: "Orders", permission: "View orders", granted: new Set<Role>(["viewer", "editor", "admin", "owner"]) },
	{ id: "orders.refund", area: "Orders", permission: "Refund orders", granted: new Set<Role>(["admin", "owner"]) },
	{ id: "products.edit", area: "Products", permission: "Edit products", granted: new Set<Role>(["editor", "admin", "owner"]) },
	{ id: "users.invite", area: "Users", permission: "Invite users", granted: new Set<Role>(["admin", "owner"]) },
	{ id: "billing.manage", area: "Billing", permission: "Manage billing", granted: new Set<Role>(["owner"]) },
];

/** The rows with one role granted or withdrawn on one permission. A pure step, so it is testable. */
export function togglePermission(rows: readonly PermissionRow[], permissionId: string, role: Role, granted: boolean): PermissionRow[] {
	return rows.map((row): PermissionRow => {
		if (row.id !== permissionId) {
			return row;
		}
		const next = new Set(row.granted);
		if (granted) {
			next.add(role);
		} else {
			next.delete(role);
		}
		return { ...row, granted: next };
	});
}

/** The owner holds every permission; their column is shown but cannot be changed, so nobody locks the owner out. */
const LOCKED_ROLE: Role = "owner";

interface GrantCellProps {
	readonly row: PermissionRow;
	readonly role: Role;
	readonly onToggle: (permissionId: string, role: Role, granted: boolean) => void;
}

function GrantCell({ row, role, onToggle }: GrantCellProps): React.JSX.Element {
	const handleChange = React.useCallback(
		(checked: boolean): void => {
			onToggle(row.id, role, checked);
		},
		[onToggle, row.id, role],
	);
	return (
		<div className="flex justify-center" data-cell-interactive="">
			<Checkbox
				checked={row.granted.has(role)}
				disabled={role === LOCKED_ROLE}
				onCheckedChange={handleChange}
				aria-label={`${ROLE_NAMES[role]} can ${row.permission.toLowerCase()}`}
			/>
		</div>
	);
}

function getPermissionId(row: PermissionRow): string {
	return row.id;
}

const LAYOUT: DataTableLayout = { cellBorders: true };

/**
 * Recipe: a permissions matrix. Each row is a permission and each column a role, with a checkbox where they meet.
 * The checkboxes are controlled by the recipe; the owner column is locked on. The table itself knows nothing of roles.
 */
export function DataTableRecipePermissionsMatrix(): React.JSX.Element {
	const [rows, setRows] = React.useState<readonly PermissionRow[]>(PERMISSIONS);

	const handleToggle = React.useCallback((permissionId: string, role: Role, granted: boolean): void => {
		setRows((current) => togglePermission(current, permissionId, role, granted));
	}, []);

	const columns = React.useMemo(
		(): DataTableColumns<PermissionRow> => [
			{ accessorKey: "area", header: "Area", size: 110 },
			{ accessorKey: "permission", header: "Permission", size: 200 },
			...ROLES.map((role): DataTableColumns<PermissionRow>[number] => ({
				id: role,
				header: ROLE_NAMES[role],
				size: 100,
				enableSorting: false,
				cell: ({ row }): React.JSX.Element => <GrantCell row={row.original} role={role} onToggle={handleToggle} />,
				meta: { headerClassName: "text-center [&>div]:justify-center" },
			})),
		],
		[handleToggle],
	);

	return <DataTable data={rows} columns={columns} getRowId={getPermissionId} layout={LAYOUT} />;
}
