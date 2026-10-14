import type { DataChangeActorKind, DataChangeLogSummary, DataChangeOperation } from "@workspace/shared";
import { Badge } from "@workspace/ui/components/badge";
import { Bot, KeyRound, ShieldQuestion, User, type LucideIcon } from "lucide-react";
import type * as React from "react";

import { DATA_CHANGE_ACTOR_KIND_LABELS, DATA_CHANGE_OPERATION_LABELS } from "@/lib/data-table/enum-filter-options";

/** A Badge variant — the tone palette (`packages/tokens`) plus `outline`. */
type BadgeVariant = NonNullable<React.ComponentProps<typeof Badge>["variant"]>;

/** Same colours as the HTTP methods that usually cause them: creates green, edits yellow, deletes red. */
const OPERATION_TONE: Readonly<Record<DataChangeOperation, BadgeVariant>> = {
	INSERT: "green",
	UPDATE: "yellow",
	DELETE: "red",
	TRUNCATE: "red",
};

/** An unattributed change stands out: no user, key or job owned it. */
const ACTOR_KIND_TONE: Readonly<Record<DataChangeActorKind, { readonly tone: BadgeVariant; readonly icon: LucideIcon }>> = {
	USER: { tone: "blue", icon: User },
	API_KEY: { tone: "orange", icon: KeyRound },
	SYSTEM: { tone: "violet", icon: Bot },
	UNATTRIBUTED: { tone: "red", icon: ShieldQuestion },
};

/** The kind of row change (`Insert`, `Update`, `Delete`, `Truncate`). */
export function DataChangeOperationBadge({ operation }: { readonly operation: DataChangeOperation }): React.JSX.Element {
	return (
		<Badge variant={OPERATION_TONE[operation]} className="font-mono">
			{DATA_CHANGE_OPERATION_LABELS[operation]}
		</Badge>
	);
}

/** Who the change is attributed to, with its icon. */
export function DataChangeActorKindBadge({ actorKind }: { readonly actorKind: DataChangeActorKind }): React.JSX.Element {
	const { tone, icon: Icon } = ACTOR_KIND_TONE[actorKind];
	return (
		<Badge variant={tone} className="gap-1">
			<Icon className="size-3" aria-hidden />
			{DATA_CHANGE_ACTOR_KIND_LABELS[actorKind]}
		</Badge>
	);
}

/** Who made the change: the user (name + email), the API key, the system job, or nobody the application knows. */
export function DataChangeActorCell({
	entry,
}: {
	readonly entry: Pick<DataChangeLogSummary, "actorKind" | "actor" | "apiKeyId" | "systemOperation" | "databaseRole">;
}): React.JSX.Element {
	return (
		<div className="max-w-56 min-w-0 space-y-1 text-sm">
			{entry.actor !== null ? (
				<>
					<p className="truncate font-medium">{entry.actor.fullName ?? entry.actor.id}</p>
					{entry.actor.email === null ? null : <p className="truncate text-xs text-muted-foreground">{entry.actor.email}</p>}
				</>
			) : (
				<DataChangeActorKindBadge actorKind={entry.actorKind} />
			)}
			{entry.actor === null && entry.apiKeyId !== null ? <p className="truncate font-mono text-xs text-muted-foreground">{entry.apiKeyId}</p> : null}
			{entry.systemOperation === null ? null : <p className="truncate font-mono text-xs text-muted-foreground">{entry.systemOperation}</p>}
			{entry.actorKind === "UNATTRIBUTED" ? <p className="truncate font-mono text-xs text-muted-foreground">as {entry.databaseRole}</p> : null}
		</div>
	);
}
