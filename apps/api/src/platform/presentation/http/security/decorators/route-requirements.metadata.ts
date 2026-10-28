import type { AuthorizationAttributes, PermissionAction, PermissionResource } from "@workspace/shared";

import type { ResourceAttributesExtractor, ResourceIdExtractor } from "./permission-target";

/** Key used by the `@RequirePermission` decorator. */
export const REQUIRED_PERMISSION_KEY = "requiredPermission";

/** Which record a permission check is about, when it is about one. */
export interface RequiredPermissionTarget {
	/**
	 * The record: a route **param name** (`"id"` → `req.params.id`) or an extractor such as
	 * `self()` / `fromParam()` (`./permission-target`). Declared but unresolvable: the guard denies.
	 */
	readonly resourceId?: string | ResourceIdExtractor;
	/** Resource attributes for policy conditions: static values or an extractor such as `attributesFromBody()`. */
	readonly attributes?: AuthorizationAttributes | ResourceAttributesExtractor;
	/** Human-readable purpose, surfaced in audits and docs. */
	readonly description?: string;
}

/** Shape of the metadata set by @RequirePermission. */
export interface RequiredPermission extends RequiredPermissionTarget {
	readonly action: PermissionAction;
	readonly resource: PermissionResource;
}
