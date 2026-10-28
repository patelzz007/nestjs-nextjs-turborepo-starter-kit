import type { PermissionAction } from "@workspace/shared";
import type { BadgeVariant } from "@workspace/ui/components/badge";
import { Ban, Check, Eye, List, LockOpen, Pause, Pencil, Play, Plus, RotateCcw, Send, Shield, Ticket, Trash2, X, type LucideIcon } from "lucide-react";

const PERMISSION_ACTION_ICONS: Record<PermissionAction, LucideIcon> = {
	CREATE: Plus,
	READ: Eye,
	UPDATE: Pencil,
	DELETE: Trash2,
	LIST: List,
	PUBLISH: Send,
	APPROVE: Check,
	REJECT: X,
	SUSPEND: Pause,
	BAN: Ban,
	UNBAN: RotateCcw,
	REACTIVATE: Play,
	UNLOCK: LockOpen,
	REDEEM: Ticket,
};

const PERMISSION_ACTION_BADGE_VARIANTS: Record<PermissionAction, BadgeVariant> = {
	CREATE: "default",
	READ: "outline",
	UPDATE: "secondary",
	DELETE: "destructive-light",
	LIST: "outline",
	// Lifecycle verbs (ADR 067): a step in a record's life, shown apart from CRUD.
	PUBLISH: "secondary",
	APPROVE: "secondary",
	REJECT: "destructive-light",
	SUSPEND: "destructive-light",
	BAN: "destructive-light",
	UNBAN: "secondary",
	REACTIVATE: "secondary",
	UNLOCK: "secondary",
	REDEEM: "secondary",
};

const PERMISSION_ACTION_ICON_CLASSES: Record<PermissionAction, string> = {
	CREATE: "text-primary",
	READ: "text-sky-600 dark:text-sky-400",
	UPDATE: "text-amber-600 dark:text-amber-400",
	DELETE: "text-destructive",
	LIST: "text-muted-foreground",
	PUBLISH: "text-emerald-600 dark:text-emerald-400",
	APPROVE: "text-emerald-600 dark:text-emerald-400",
	REJECT: "text-destructive",
	SUSPEND: "text-destructive",
	BAN: "text-destructive",
	UNBAN: "text-emerald-600 dark:text-emerald-400",
	REACTIVATE: "text-emerald-600 dark:text-emerald-400",
	UNLOCK: "text-emerald-600 dark:text-emerald-400",
	REDEEM: "text-primary",
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
	PUBLISH: "Grants the ability to publish records of this resource, making them live.",
	APPROVE: "Grants the ability to approve records of this resource under review.",
	REJECT: "Grants the ability to reject records of this resource under review.",
	SUSPEND: "Grants the ability to suspend records of this resource.",
	BAN: "Grants the ability to ban records of this resource.",
	UNBAN: "Grants the ability to lift a ban on records of this resource.",
	REACTIVATE: "Grants the ability to bring suspended or closed records of this resource back.",
	UNLOCK: "Grants the ability to unlock locked records of this resource.",
	REDEEM: "Grants the ability to redeem records of this resource.",
};

export function permissionActionSummary(action: PermissionAction): string {
	return PERMISSION_ACTION_SUMMARIES[action];
}
