import type { PermissionAction } from "@workspace/shared";
import { Eye, List, Pencil, Plus, Settings, Shield, Trash2, type LucideIcon } from "lucide-react";

type BadgeVariant = "default" | "secondary" | "destructive" | "outline" | "ghost" | "link";

const PERMISSION_ACTION_ICONS: Record<PermissionAction, LucideIcon> = {
	CREATE: Plus,
	READ: Eye,
	UPDATE: Pencil,
	DELETE: Trash2,
	LIST: List,
	MANAGE: Settings,
};

const PERMISSION_ACTION_BADGE_VARIANTS: Record<PermissionAction, BadgeVariant> = {
	CREATE: "default",
	READ: "outline",
	UPDATE: "secondary",
	DELETE: "destructive",
	LIST: "outline",
	MANAGE: "default",
};

const PERMISSION_ACTION_ICON_CLASSES: Record<PermissionAction, string> = {
	CREATE: "text-primary",
	READ: "text-sky-600 dark:text-sky-400",
	UPDATE: "text-amber-600 dark:text-amber-400",
	DELETE: "text-destructive",
	LIST: "text-muted-foreground",
	MANAGE: "text-violet-600 dark:text-violet-400",
};

export function permissionActionIcon(action: PermissionAction): LucideIcon {
	return PERMISSION_ACTION_ICONS[action];
}

export function permissionActionBadgeVariant(action: PermissionAction): BadgeVariant {
	return PERMISSION_ACTION_BADGE_VARIANTS[action];
}

export function permissionActionIconClassName(action: PermissionAction): string {
	return PERMISSION_ACTION_ICON_CLASSES[action];
}

export function permissionActionFallbackIcon(): LucideIcon {
	return Shield;
}

const PERMISSION_ACTION_SUMMARIES: Record<PermissionAction, string> = {
	CREATE: "Grants the ability to create new records for this resource.",
	READ: "Grants read access to individual records for this resource.",
	UPDATE: "Grants the ability to modify existing records for this resource.",
	DELETE: "Grants the ability to remove records for this resource.",
	LIST: "Grants the ability to browse and list records for this resource.",
	MANAGE: "Grants full administrative control over this resource, including configuration.",
};

export function permissionActionSummary(action: PermissionAction): string {
	return PERMISSION_ACTION_SUMMARIES[action];
}
