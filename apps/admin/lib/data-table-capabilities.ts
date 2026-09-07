import type { RowData } from "@tanstack/react-table";
import type { DataTableCheckboxConfig } from "@workspace/ui/lib/data-table-checkbox";
import type { DataTableBulkSelectionContext } from "@workspace/ui/lib/data-table-checkbox";
import { toPlatformCapabilitySlug, type CapabilitySlug, type PermissionResource } from "@workspace/shared";

/** Returns true when the session includes `DELETE` on the given platform resource. */
export function canDeletePlatformResource(hasCapability: (slug: CapabilitySlug) => boolean, resource: PermissionResource): boolean {
	return hasCapability(toPlatformCapabilitySlug("DELETE", resource));
}

export interface ResourceTableCheckboxOptions<TData extends RowData> {
	readonly hasCapability: (slug: CapabilitySlug) => boolean;
	readonly resource: PermissionResource;
	readonly exportFilename: string;
	readonly exportableColumns?: readonly string[];
	readonly onDeleteAll?: (selectedRows: TData[], context: DataTableBulkSelectionContext) => void | Promise<void>;
	readonly bulkActions?: DataTableCheckboxConfig<TData>["bulkActions"];
	readonly requiredCapabilityForBulkActions?: CapabilitySlug;
}

/** Checkbox + multi-format export; bulk delete only when the user has DELETE permission. */
export function buildResourceTableCheckbox<TData extends RowData>(options: ResourceTableCheckboxOptions<TData>): DataTableCheckboxConfig<TData> {
	const includeDelete = options.onDeleteAll !== undefined && canDeletePlatformResource(options.hasCapability, options.resource);
	const capabilitySlug = options.requiredCapabilityForBulkActions;
	const filteredBulkActions =
		options.bulkActions !== undefined && capabilitySlug !== undefined
			? options.bulkActions.filter(() => options.hasCapability(capabilitySlug))
			: options.bulkActions;

	return {
		export: true,
		exportFilename: options.exportFilename,
		...(options.exportableColumns !== undefined ? { exportableColumns: [...options.exportableColumns] } : {}),
		...(filteredBulkActions !== undefined && filteredBulkActions.length > 0 ? { bulkActions: filteredBulkActions } : {}),
		...(includeDelete ? { onDeleteAll: options.onDeleteAll } : {}),
	};
}

/** Export-only checkbox config for read-only audit tables (no bulk delete). */
export function buildReadOnlyTableCheckbox(exportFilename: string, exportableColumns?: readonly string[]): DataTableCheckboxConfig {
	return {
		export: true,
		exportFilename,
		...(exportableColumns !== undefined ? { exportableColumns: [...exportableColumns] } : {}),
	};
}
