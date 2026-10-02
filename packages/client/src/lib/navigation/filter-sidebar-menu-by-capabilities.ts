import type { CapabilitySlug } from "@workspace/shared";

import { createGrantedCapabilities, isCapabilityGranted, type GrantedCapabilities } from "../auth/permission-check";
import type {
	CompiledSidebarMenuData,
	CompiledSidebarMenuItem,
	SidebarAuthorization,
	SidebarMenuData,
	SidebarMenuItem,
	SidebarPermissionMode,
} from "../sidebar/sidebar-menu-schema";

/**
 * Minimum shape the filter needs from a sidebar node. Structural fields
 * (title/url/icon/disabled) pass through untouched — this keeps the filter
 * testable against both raw and compiled menu shapes.
 */
interface SidebarFilterNode {
	readonly authorization?: SidebarAuthorization | undefined;
	readonly featureFlag?: string | undefined;
	readonly children?: readonly SidebarFilterNode[] | undefined;
}

/** Optional inputs besides the capability list. */
export interface SidebarFilterOptions {
	/**
	 * Feature flags currently enabled. An item with a `featureFlag` outside
	 * this list is removed with its subtree — visibility is
	 * `permission allowed AND feature enabled`. Omitted → no flagged item shows.
	 */
	readonly enabledFeatureFlags?: readonly string[] | undefined;
}

/** The `{ permissions, mode }` part of a requirement — enough to evaluate it. */
export interface PermissionRequirement {
	readonly permissions: readonly CapabilitySlug[];
	readonly mode?: SidebarPermissionMode | undefined;
}

/** Requirement view shared by own and cascaded authorization. */
interface ResolvedRequirement extends PermissionRequirement {
	readonly mode: SidebarPermissionMode;
	readonly cascade: boolean;
}

interface FilterContext {
	readonly granted: GrantedCapabilities;
	readonly enabledFeatureFlags: ReadonlySet<string>;
}

const DEFAULT_REQUIREMENT: ResolvedRequirement = { permissions: [], mode: "any", cascade: false };

function resolveRequirement(item: SidebarFilterNode, inheritedCascade: SidebarAuthorization | null): ResolvedRequirement {
	if (item.authorization !== undefined) {
		return {
			permissions: item.authorization.permissions,
			mode: item.authorization.mode ?? "any",
			cascade: item.authorization.cascade ?? false,
		};
	}

	// A cascading ancestor applies its requirement to this node (spec §24).
	if (inheritedCascade !== null) {
		return {
			permissions: inheritedCascade.permissions,
			mode: inheritedCascade.mode ?? "any",
			cascade: true,
		};
	}

	return DEFAULT_REQUIREMENT;
}

/**
 * Evaluates a declarative `{ permissions, mode }` requirement with a
 * permission predicate (e.g. `useAuthorization().can`). An empty list is
 * satisfied. Shared by the menu filter and the route guard so both agree.
 */
export function evaluateSidebarAuthorization(authorization: PermissionRequirement, isGranted: (permission: CapabilitySlug) => boolean): boolean {
	if (authorization.permissions.length === 0) {
		return true;
	}
	if (authorization.mode === "all") {
		return authorization.permissions.every(isGranted);
	}
	return authorization.permissions.some(isGranted);
}

function isFeatureEnabled(item: SidebarFilterNode, enabledFeatureFlags: ReadonlySet<string>): boolean {
	return item.featureFlag === undefined || enabledFeatureFlags.has(item.featureFlag);
}

function filterNodes<TNode extends SidebarFilterNode & { readonly children?: readonly TNode[] | undefined }>(
	items: readonly TNode[],
	context: FilterContext,
	inheritedCascade: SidebarAuthorization | null,
	clone: (item: TNode, children: readonly TNode[] | undefined) => TNode,
): readonly TNode[] {
	const isGranted = (permission: CapabilitySlug): boolean => isCapabilityGranted(context.granted, permission);
	const filtered: TNode[] = [];
	for (const item of items) {
		// A disabled feature hides the whole subtree, independent of authorization.
		if (!isFeatureEnabled(item, context.enabledFeatureFlags)) {
			continue;
		}

		const requirement = resolveRequirement(item, inheritedCascade);
		const nodeAuthorized = evaluateSidebarAuthorization(requirement, isGranted);

		// cascade: true → a denied requirement removes the whole subtree (spec §116).
		if (!nodeAuthorized && requirement.cascade) {
			continue;
		}

		const nextCascade = requirement.cascade ? (item.authorization ?? inheritedCascade) : null;
		const children = item.children !== undefined ? filterNodes(item.children, context, nextCascade, clone) : undefined;
		const hasVisibleChildren = children !== undefined && children.length > 0;

		if (!nodeAuthorized) {
			// Unauthorized parents survive only when a visible child survives
			// (spec §115); a denied leaf without children is simply hidden.
			if (!hasVisibleChildren) {
				continue;
			}
			filtered.push(clone(item, children));
			continue;
		}

		// Purely structural nodes (no own requirements) with configured children
		// must not render empty — remove them when no child survived (spec §22).
		if (requirement.permissions.length === 0 && children?.length === 0) {
			continue;
		}

		// Authorized nodes survive (spec §79): an authorized parent whose
		// children were all filtered stays accessible as a leaf.
		filtered.push(clone(item, children));
	}
	return filtered;
}

function cloneRawItem(item: SidebarMenuItem, children: readonly SidebarMenuItem[] | undefined): SidebarMenuItem {
	return {
		title: item.title,
		url: item.url,
		icon: item.icon,
		disabled: item.disabled,
		authorization: item.authorization,
		featureFlag: item.featureFlag,
		children,
	};
}

function cloneCompiledItem(item: CompiledSidebarMenuItem, children: readonly CompiledSidebarMenuItem[] | undefined): CompiledSidebarMenuItem {
	return {
		id: item.id,
		title: item.title,
		url: item.url,
		icon: item.icon,
		disabled: item.disabled,
		authorization: item.authorization,
		featureFlag: item.featureFlag,
		children,
	};
}

function createFilterContext(capabilities: readonly CapabilitySlug[], options: SidebarFilterOptions): FilterContext {
	return {
		granted: createGrantedCapabilities(capabilities),
		enabledFeatureFlags: new Set<string>(options.enabledFeatureFlags ?? []),
	};
}

/** Filters raw sidebar menu JSON by granted capability slugs and enabled feature flags. */
export function filterSidebarMenuData(menu: SidebarMenuData, capabilities: readonly CapabilitySlug[], options: SidebarFilterOptions = {}): SidebarMenuData {
	const context = createFilterContext(capabilities, options);
	const sections: SidebarMenuData["sections"] = [];
	for (const section of menu.sections) {
		const items = filterNodes(section.items, context, null, cloneRawItem);
		if (items.length === 0) {
			continue;
		}
		sections.push({
			title: section.title,
			color: section.color,
			items: [...items],
		});
	}

	return {
		header: menu.header,
		sections,
		bottomItems: [...filterNodes(menu.bottomItems, context, null, cloneRawItem)],
	};
}

/** Filters a compiled sidebar menu snapshot by capability slugs and enabled feature flags. */
export function filterCompiledSidebarMenu(
	menu: CompiledSidebarMenuData,
	capabilities: readonly CapabilitySlug[],
	options: SidebarFilterOptions = {},
): CompiledSidebarMenuData {
	const context = createFilterContext(capabilities, options);
	const sections: CompiledSidebarMenuData["sections"] = [];
	for (const section of menu.sections) {
		const items = filterNodes(section.items, context, null, cloneCompiledItem);
		if (items.length === 0) {
			continue;
		}
		sections.push({
			title: section.title,
			color: section.color,
			items: [...items],
		});
	}

	return {
		header: menu.header,
		sections,
		bottomItems: [...filterNodes(menu.bottomItems, context, null, cloneCompiledItem)],
	};
}
