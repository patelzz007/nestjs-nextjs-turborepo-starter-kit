"use client";

import { Avatar, AvatarFallback, AvatarGroup } from "@workspace/ui/components/avatar";
import { Button } from "@workspace/ui/components/button";
import { Combobox, ComboboxContent, ComboboxEmpty, ComboboxInput, ComboboxItem, ComboboxList, ComboboxSeparator, ComboboxTrigger } from "@workspace/ui/components/combobox";
import { Field } from "@workspace/ui/components/field";
import { Item, ItemContent, ItemMedia, ItemTitle } from "@workspace/ui/components/item";
import { cn } from "@workspace/ui/lib/core/utils";
import { UsersIcon } from "lucide-react";
import type * as React from "react";
import { useCallback, useState } from "react";

interface TeamMember {
	readonly id: string;
	readonly value: string;
	readonly label: string;
	readonly initials: string;
	readonly isCurrentUser?: boolean;
}

interface EmptyMembersOption {
	readonly id: "no-members";
	readonly value: "none";
	readonly label: string;
	readonly searchText: string;
}

type MemberSelectionItem = EmptyMembersOption | TeamMember;

const NO_MEMBERS_OPTION: EmptyMembersOption = {
	id: "no-members",
	value: "none",
	label: "No members",
	searchText: "No members clear members remove members empty",
};

// Sample people — avatars show initials, so no profile photos are fetched.
const TEAM_MEMBERS: readonly TeamMember[] = [
	{ id: "member-1", value: "alex-morgan", label: "Alex Morgan", initials: "AM", isCurrentUser: true },
	{ id: "member-2", value: "emma-carter", label: "Emma Carter", initials: "EC" },
	{ id: "member-3", value: "ryan-mitchell", label: "Ryan Mitchell", initials: "RM" },
	{ id: "member-4", value: "olivia-bennett", label: "Olivia Bennett", initials: "OB" },
	{ id: "member-5", value: "ethan-brooks", label: "Ethan Brooks", initials: "EB" },
	{ id: "member-6", value: "sophia-reed", label: "Sophia Reed", initials: "SR" },
	{ id: "member-7", value: "lucas-hayes", label: "Lucas Hayes", initials: "LH" },
	{ id: "member-8", value: "ava-sinclair", label: "Ava Sinclair", initials: "AS" },
	{ id: "member-9", value: "mia-parker", label: "Mia Parker", initials: "MP" },
	{ id: "member-10", value: "noah-foster", label: "Noah Foster", initials: "NF" },
	{ id: "member-11", value: "grace-collins", label: "Grace Collins", initials: "GC" },
	{ id: "member-12", value: "jack-turner", label: "Jack Turner", initials: "JT" },
];

const MEMBER_SELECTION_OPTIONS: readonly MemberSelectionItem[] = [NO_MEMBERS_OPTION, ...TEAM_MEMBERS];

/** How many members are selected when the example first renders. */
const INITIAL_MEMBER_COUNT = 5;
/** How many avatars the trigger stacks before summarising the rest as a count. */
const MAX_TRIGGER_AVATARS = 4;

const TRIGGER_BUTTON = <Button type="button" variant="outline" className="w-full justify-between font-normal" />;

function isNoMembersOption(item: MemberSelectionItem): item is EmptyMembersOption {
	return item.id === NO_MEMBERS_OPTION.id;
}

function isTeamMember(item: MemberSelectionItem): item is TeamMember {
	return !isNoMembersOption(item);
}

function isMemberSelectionItemEqual(item: MemberSelectionItem, value: MemberSelectionItem): boolean {
	return item.id === value.id;
}

function memberSearchText(item: MemberSelectionItem): string {
	return isNoMembersOption(item) ? item.searchText : item.label;
}

function memberCountLabel(count: number): string {
	return `${String(count)} ${count === 1 ? "member" : "members"}`;
}

function UsersGlyph({ className }: { readonly className?: string }): React.JSX.Element {
	return <UsersIcon className={cn("size-4 shrink-0", className)} />;
}

interface MemberAvatarProps {
	readonly member: TeamMember;
	readonly className?: string;
}

function MemberAvatar({ member, className }: MemberAvatarProps): React.JSX.Element {
	return (
		<Avatar className={className}>
			<AvatarFallback className="text-[9px] text-foreground">{member.initials}</AvatarFallback>
		</Avatar>
	);
}

function MembersTriggerSummary({ selectedMembers }: { readonly selectedMembers: readonly TeamMember[] }): React.JSX.Element {
	if (selectedMembers.length === 0) {
		return (
			<span className="flex min-w-0 items-center gap-2">
				<UsersGlyph className="text-muted-foreground" />
				<span className="truncate">Members</span>
			</span>
		);
	}

	const visibleMembers = selectedMembers.slice(0, MAX_TRIGGER_AVATARS);
	const hiddenMemberCount = selectedMembers.length - visibleMembers.length;
	const selectedLabel = selectedMembers.map((member: TeamMember): string => member.label).join(", ");
	const countLabel = hiddenMemberCount > 0 ? `+${memberCountLabel(hiddenMemberCount)}` : memberCountLabel(selectedMembers.length);

	return (
		<span className="flex min-w-0 items-center gap-2">
			<span className="sr-only">Selected members: {selectedLabel}</span>
			<AvatarGroup className="-space-x-1">
				{visibleMembers.map((member: TeamMember): React.JSX.Element => (
					<MemberAvatar key={member.id} member={member} className="size-5" />
				))}
			</AvatarGroup>
			<span className="truncate">{countLabel}</span>
		</span>
	);
}

function MemberSelectionRow({ option }: { readonly option: MemberSelectionItem }): React.JSX.Element {
	if (isNoMembersOption(option)) {
		return (
			<span className="flex min-w-0 items-center gap-2">
				<UsersGlyph className="text-muted-foreground" />
				<span className="truncate">{option.label}</span>
			</span>
		);
	}

	return (
		<Item size="xs" className="p-0">
			<ItemMedia>
				<MemberAvatar member={option} className="size-5" />
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

export function Combobox24Example(): React.JSX.Element {
	const [members, setMembers] = useState<TeamMember[]>(() => TEAM_MEMBERS.slice(0, INITIAL_MEMBER_COUNT));

	// Picking "No members" clears the selection instead of joining it.
	const handleMembersChange = useCallback((nextMembers: MemberSelectionItem[]): void => {
		setMembers(nextMembers.some(isNoMembersOption) ? [] : nextMembers.filter(isTeamMember));
	}, []);

	return (
		<Field className="max-w-xs">
			<Combobox
				multiple
				items={MEMBER_SELECTION_OPTIONS}
				value={members}
				onValueChange={handleMembersChange}
				itemToStringValue={memberSearchText}
				isItemEqualToValue={isMemberSelectionItemEqual}
				autoHighlight>
				<ComboboxTrigger render={TRIGGER_BUTTON}>
					<MembersTriggerSummary selectedMembers={members} />
				</ComboboxTrigger>

				<ComboboxContent className="max-w-(--anchor-width) min-w-(--anchor-width)">
					<ComboboxInput showTrigger={false} placeholder="Select members" className="mb-1" />
					<ComboboxEmpty text="No members found." />
					<ComboboxList>
						<ComboboxItem value={NO_MEMBERS_OPTION}>
							<MemberSelectionRow option={NO_MEMBERS_OPTION} />
						</ComboboxItem>
						<ComboboxSeparator />

						{TEAM_MEMBERS.map((member: TeamMember): React.JSX.Element => (
							<ComboboxItem key={member.id} value={member}>
								<MemberSelectionRow option={member} />
							</ComboboxItem>
						))}
					</ComboboxList>
				</ComboboxContent>
			</Combobox>
		</Field>
	);
}
