"use client";

import { Avatar, AvatarFallback } from "@workspace/ui/components/avatar";
import {
	Combobox,
	ComboboxChip,
	ComboboxChips,
	ComboboxChipsInput,
	ComboboxCollection,
	ComboboxContent,
	ComboboxEmpty,
	ComboboxItem,
	ComboboxList,
	useComboboxAnchor,
} from "@workspace/ui/components/combobox";
import { Field } from "@workspace/ui/components/field";
import { Item, ItemContent, ItemDescription, ItemTitle } from "@workspace/ui/components/item";
import type * as React from "react";
import { useState } from "react";

interface Member {
	readonly id: string;
	readonly name: string;
	readonly email: string;
	readonly initials: string;
	readonly position: string;
}

// Sample people — avatars show initials, so no profile photos are fetched.
const ALEX: Member = { id: "1", name: "Alex Johnson", email: "alex@example.com", initials: "AJ", position: "Software Engineer" };
const SARAH: Member = { id: "2", name: "Sarah Chen", email: "sarah@example.com", initials: "SC", position: "Product Manager" };
const MICHAEL: Member = { id: "3", name: "Michael Rodriguez", email: "michael@example.com", initials: "MR", position: "UX Designer" };
const EMMA: Member = { id: "4", name: "Emma Wilson", email: "emma@example.com", initials: "EW", position: "Technical Lead" };
const DAVID: Member = { id: "5", name: "David Kim", email: "david@example.com", initials: "DK", position: "CTO" };
const ARON: Member = { id: "6", name: "Aron Thompson", email: "aron@example.com", initials: "AT", position: "Software Engineer" };
const JAMES: Member = { id: "7", name: "James Brown", email: "james@example.com", initials: "JB", position: "Product Manager" };
const MARIA: Member = { id: "8", name: "Maria Garcia", email: "maria@example.com", initials: "MG", position: "UX Designer" };
const NICK: Member = { id: "9", name: "Nick Johnson", email: "nick@example.com", initials: "NJ", position: "Technical Lead" };
const LIAM: Member = { id: "10", name: "Liam Thompson", email: "liam@example.com", initials: "LT", position: "CTO" };

const MEMBERS: readonly Member[] = [ALEX, SARAH, MICHAEL, EMMA, DAVID, ARON, JAMES, MARIA, NICK, LIAM];

function memberName(member: Member): string {
	return member.name;
}

function renderMemberItem(member: Member): React.JSX.Element {
	return (
		<ComboboxItem key={member.id} value={member}>
			<Item size="xs" className="p-0">
				<Avatar className="size-6">
					<AvatarFallback>{member.initials}</AvatarFallback>
				</Avatar>
				<ItemContent>
					<ItemTitle className="whitespace-nowrap">{member.name}</ItemTitle>
					<ItemDescription>{member.position}</ItemDescription>
				</ItemContent>
			</Item>
		</ComboboxItem>
	);
}

/** The members tagged when the example first renders. */
const INITIAL_MEMBERS: readonly Member[] = [ALEX, SARAH];

export function Combobox19Example(): React.JSX.Element {
	const anchor = useComboboxAnchor();
	const [members, setMembers] = useState<Member[]>(() => [...INITIAL_MEMBERS]);

	return (
		<Field className="max-w-xs">
			<Combobox multiple items={MEMBERS} value={members} onValueChange={setMembers} itemToStringValue={memberName}>
				<ComboboxChips ref={anchor} className="has-data-[slot=combobox-chip]:pl-1">
					{members.map((member: Member): React.JSX.Element => (
						<ComboboxChip key={member.id} removeLabel={`Remove ${member.name}`} className="gap-1.5 rounded-full">
							<Avatar className="size-4">
								<AvatarFallback className="text-[8px]">{member.initials}</AvatarFallback>
							</Avatar>
							{member.name}
						</ComboboxChip>
					))}
					<ComboboxChipsInput placeholder="Add members..." />
				</ComboboxChips>
				<ComboboxContent anchor={anchor} className="max-w-(--anchor-width) min-w-(--anchor-width)">
					<ComboboxEmpty text="No members found." />
					<ComboboxList>
						<ComboboxCollection>{renderMemberItem}</ComboboxCollection>
					</ComboboxList>
				</ComboboxContent>
			</Combobox>
		</Field>
	);
}
