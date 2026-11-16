"use client";

import { Avatar, AvatarFallback } from "@workspace/ui/components/avatar";
import { Button } from "@workspace/ui/components/button";
import {
	Combobox,
	ComboboxCollection,
	ComboboxContent,
	ComboboxEmpty,
	ComboboxGroup,
	ComboboxInput,
	ComboboxItem,
	ComboboxLabel,
	ComboboxList,
	ComboboxSeparator,
	ComboboxTrigger,
} from "@workspace/ui/components/combobox";
import { Field } from "@workspace/ui/components/field";
import { Item, ItemContent, ItemMedia, ItemTitle } from "@workspace/ui/components/item";
import { SendIcon, UserIcon } from "lucide-react";
import type * as React from "react";
import { useCallback, useState } from "react";

interface NoAssigneeOption {
	readonly type: "none";
	readonly id: "no-assignee";
	readonly value: "none";
	readonly label: string;
	readonly searchText: string;
}

interface TeamMember {
	readonly type: "member";
	readonly id: string;
	readonly value: string;
	readonly label: string;
	readonly initials: string;
	readonly isCurrentUser?: boolean;
	readonly searchText: string;
}

interface InviteOption {
	readonly type: "invite";
	readonly id: "invite-user";
	readonly value: "invite";
	readonly label: string;
	readonly searchText: string;
}

type AssigneeSelectionItem = NoAssigneeOption | TeamMember | InviteOption;

const NO_ASSIGNEE_OPTION: NoAssigneeOption = {
	type: "none",
	id: "no-assignee",
	value: "none",
	label: "No assignee",
	searchText: "No assignee unassigned clear assignee remove assignee",
};

// Sample people — avatars show initials, so no profile photos are fetched.
const TEAM_MEMBERS: readonly TeamMember[] = [
	{ type: "member", id: "member-1", value: "alex-morgan", label: "Alex Morgan", initials: "AM", isCurrentUser: true, searchText: "Alex Morgan current user owner" },
	{ type: "member", id: "member-2", value: "emma-carter", label: "Emma Carter", initials: "EC", searchText: "Emma Carter product design" },
	{ type: "member", id: "member-3", value: "ryan-mitchell", label: "Ryan Mitchell", initials: "RM", searchText: "Ryan Mitchell engineering backend" },
	{ type: "member", id: "member-4", value: "olivia-bennett", label: "Olivia Bennett", initials: "OB", searchText: "Olivia Bennett growth marketing" },
	{ type: "member", id: "member-5", value: "ethan-brooks", label: "Ethan Brooks", initials: "EB", searchText: "Ethan Brooks operations" },
];

const INVITE_OPTION: InviteOption = {
	type: "invite",
	id: "invite-user",
	value: "invite",
	label: "Invite...",
	searchText: "Invite new user teammate member collaborator",
};

const INVITE_OPTIONS: readonly InviteOption[] = [INVITE_OPTION];

const ASSIGNEE_OPTIONS: readonly AssigneeSelectionItem[] = [NO_ASSIGNEE_OPTION, ...TEAM_MEMBERS, INVITE_OPTION];

const TRIGGER_BUTTON = <Button type="button" variant="outline" className="w-full justify-between font-normal" />;

function assigneeSearchText(item: AssigneeSelectionItem): string {
	return item.searchText;
}

function isAssigneeEqual(item: AssigneeSelectionItem, value: AssigneeSelectionItem): boolean {
	return item.id === value.id;
}

function IconLabel({ icon, label }: { readonly icon: React.ReactNode; readonly label: string }): React.JSX.Element {
	return (
		<span className="flex min-w-0 items-center gap-2">
			{icon}
			<span className="truncate">{label}</span>
		</span>
	);
}

const USER_GLYPH = <UserIcon className="size-4 shrink-0 text-muted-foreground" />;
const INVITE_GLYPH = <SendIcon className="size-4 shrink-0 text-muted-foreground" />;

function MemberAvatar({ member }: { readonly member: TeamMember }): React.JSX.Element {
	return (
		<Avatar className="size-5">
			<AvatarFallback className="text-[9px]">{member.initials}</AvatarFallback>
		</Avatar>
	);
}

function AssigneeTriggerLabel({ option }: { readonly option: NoAssigneeOption | TeamMember }): React.JSX.Element {
	if (option.type === "none") {
		return <IconLabel icon={USER_GLYPH} label={option.label} />;
	}

	return (
		<span className="flex min-w-0 items-center gap-2">
			<MemberAvatar member={option} />
			<span className="truncate">{option.label}</span>
		</span>
	);
}

function AssigneeListRow({ option }: { readonly option: AssigneeSelectionItem }): React.JSX.Element {
	if (option.type === "none") {
		return <IconLabel icon={USER_GLYPH} label={option.label} />;
	}

	if (option.type === "invite") {
		return <IconLabel icon={INVITE_GLYPH} label={option.label} />;
	}

	return (
		<Item size="xs" className="p-0">
			<ItemMedia>
				<MemberAvatar member={option} />
			</ItemMedia>
			<ItemContent>
				<ItemTitle className="gap-1 whitespace-nowrap">
					<span>{option.label}</span>
					{option.isCurrentUser === true ? <span className="font-normal text-muted-foreground">(You)</span> : null}
				</ItemTitle>
			</ItemContent>
		</Item>
	);
}

function renderAssigneeItem(option: TeamMember | InviteOption): React.JSX.Element {
	return (
		<ComboboxItem key={option.id} value={option}>
			<AssigneeListRow option={option} />
		</ComboboxItem>
	);
}

export function Combobox28Example(): React.JSX.Element {
	const [assignee, setAssignee] = useState<TeamMember | null>(null);
	const selectedAssignee: NoAssigneeOption | TeamMember = assignee ?? NO_ASSIGNEE_OPTION;

	// "Invite..." is an action, not an assignee: picking it leaves the current assignee in place.
	const handleAssigneeChange = useCallback((nextAssignee: AssigneeSelectionItem | null): void => {
		if (nextAssignee === null || nextAssignee.type === "invite") {
			return;
		}

		setAssignee(nextAssignee.type === "member" ? nextAssignee : null);
	}, []);

	return (
		<Field className="max-w-xs">
			<Combobox
				items={ASSIGNEE_OPTIONS}
				value={selectedAssignee}
				onValueChange={handleAssigneeChange}
				itemToStringValue={assigneeSearchText}
				isItemEqualToValue={isAssigneeEqual}
				autoHighlight>
				<ComboboxTrigger render={TRIGGER_BUTTON}>
					<AssigneeTriggerLabel option={selectedAssignee} />
				</ComboboxTrigger>

				<ComboboxContent className="max-w-(--anchor-width) min-w-(--anchor-width)">
					<ComboboxInput showTrigger={false} placeholder="Select assignee" className="mb-1" />
					<ComboboxEmpty text="No assignees found." />
					<ComboboxList>
						<ComboboxItem value={NO_ASSIGNEE_OPTION}>
							<AssigneeListRow option={NO_ASSIGNEE_OPTION} />
						</ComboboxItem>
						<ComboboxSeparator />

						<ComboboxGroup items={TEAM_MEMBERS}>
							<ComboboxLabel>Team members</ComboboxLabel>
							<ComboboxCollection>{renderAssigneeItem}</ComboboxCollection>
						</ComboboxGroup>

						<ComboboxSeparator />

						<ComboboxGroup items={INVITE_OPTIONS}>
							<ComboboxLabel>New user</ComboboxLabel>
							<ComboboxCollection>{renderAssigneeItem}</ComboboxCollection>
						</ComboboxGroup>
					</ComboboxList>
				</ComboboxContent>
			</Combobox>
		</Field>
	);
}
