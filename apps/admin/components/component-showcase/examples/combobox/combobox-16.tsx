"use client";

import { Avatar, AvatarFallback } from "@workspace/ui/components/avatar";
import { Button } from "@workspace/ui/components/button";
import { Combobox, ComboboxCollection, ComboboxContent, ComboboxEmpty, ComboboxInput, ComboboxItem, ComboboxList, ComboboxTrigger } from "@workspace/ui/components/combobox";
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

const TRIGGER_BUTTON = <Button variant="outline" className="w-full justify-between font-normal" />;

export function Combobox16Example(): React.JSX.Element {
	const [member, setMember] = useState<Member | null>(ALEX);

	return (
		<Field className="max-w-xs">
			<Combobox items={MEMBERS} value={member} onValueChange={setMember} itemToStringValue={memberName}>
				<ComboboxTrigger render={TRIGGER_BUTTON}>
					{member === null ? (
						<span className="text-muted-foreground">Select a member</span>
					) : (
						<span className="flex items-center gap-2">
							<Avatar className="size-5">
								<AvatarFallback className="text-[9px]">{member.initials}</AvatarFallback>
							</Avatar>
							<span>{member.name}</span>
						</span>
					)}
				</ComboboxTrigger>
				<ComboboxContent className="max-w-(--anchor-width) min-w-(--anchor-width)">
					<ComboboxInput showTrigger={false} placeholder="Search members..." />
					<ComboboxEmpty text="No members found." />
					<ComboboxList>
						<ComboboxCollection>{renderMemberItem}</ComboboxCollection>
					</ComboboxList>
				</ComboboxContent>
			</Combobox>
		</Field>
	);
}
