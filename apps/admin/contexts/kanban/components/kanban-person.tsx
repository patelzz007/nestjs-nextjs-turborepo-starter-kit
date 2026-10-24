import type { KanbanPerson } from "@workspace/shared";
import { Avatar, AvatarFallback, type AvatarSize } from "@workspace/ui/components/avatar";
import { UserRound } from "lucide-react";
import * as React from "react";

import { initialsOf, KANBAN_AVATAR_TONE_CLASS, toneForPerson } from "../lib/kanban-display";

export interface KanbanPersonAvatarProps {
	readonly person: KanbanPerson;
	/** The kit's avatar size: `sm` in rows and on cards, `default` beside a comment. */
	readonly size?: AvatarSize | undefined;
	/** Names the person for screen readers and on hover, where no name is written beside the avatar. */
	readonly isNamed?: boolean | undefined;
}

/** A person's avatar — the kit's `Avatar` with their initials, in the tone they keep across the board. */
export function KanbanPersonAvatar({ person, size = "sm", isNamed = false }: KanbanPersonAvatarProps): React.JSX.Element {
	return (
		<Avatar
			size={size}
			className={KANBAN_AVATAR_TONE_CLASS[toneForPerson(person.id)]}
			role={isNamed ? "img" : undefined}
			aria-label={isNamed ? person.name : undefined}
			title={isNamed ? person.name : undefined}>
			<AvatarFallback>{initialsOf(person.name)}</AvatarFallback>
		</Avatar>
	);
}

/** The avatar of nobody: an empty person, for an unassigned item. */
function UnassignedAvatar(): React.JSX.Element {
	return (
		<Avatar size="sm">
			<AvatarFallback>
				<UserRound aria-hidden className="size-3.5" />
			</AvatarFallback>
		</Avatar>
	);
}

/** Who works on the item: their avatar and name, or "Unassigned". */
export function KanbanAssignee({ person, compact = false }: { readonly person: KanbanPerson | null; readonly compact?: boolean }): React.JSX.Element {
	const name = person === null ? "Unassigned" : person.name;
	return (
		<span className="flex min-w-0 items-center gap-1.5 text-sm text-muted-foreground" title={compact ? name : undefined}>
			{person === null ? <UnassignedAvatar /> : <KanbanPersonAvatar person={person} />}
			{compact ? <span className="sr-only">{name}</span> : <span className="truncate">{name}</span>}
		</span>
	);
}
