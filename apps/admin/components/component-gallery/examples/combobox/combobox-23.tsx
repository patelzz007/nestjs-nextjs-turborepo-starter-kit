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
	ComboboxTrigger,
} from "@workspace/ui/components/combobox";
import { Field } from "@workspace/ui/components/field";
import { Item, ItemContent, ItemMedia, ItemTitle } from "@workspace/ui/components/item";
import { UserIcon } from "lucide-react";
import type * as React from "react";
import { useState } from "react";

interface NoLeadOption {
	readonly type: "none";
	readonly value: "none";
	readonly label: "No lead";
}

interface TeamMember {
	readonly type: "member";
	readonly id: string;
	readonly value: string;
	readonly label: string;
	readonly initials: string;
	readonly isCurrentUser?: boolean;
}

type LeadOption = NoLeadOption | TeamMember;

const NO_LEAD_OPTION: NoLeadOption = {
	type: "none",
	value: "none",
	label: "No lead",
};

// Sample people — avatars show initials, so no profile photos are fetched.
const TEAM_MEMBERS: readonly TeamMember[] = [
	{ type: "member", id: "member-1", value: "shuhrat-saipov", label: "Shuhrat Saipov", initials: "SS", isCurrentUser: true },
	{ type: "member", id: "member-2", value: "nadia-karimova", label: "Nadia Karimova", initials: "NK" },
	{ type: "member", id: "member-3", value: "bekzod-rakhimov", label: "Bekzod Rakhimov", initials: "BR" },
	{ type: "member", id: "member-4", value: "lina-bauer", label: "Lina Bauer", initials: "LB" },
	{ type: "member", id: "member-5", value: "omar-haddad", label: "Omar Haddad", initials: "OH" },
	{ type: "member", id: "member-6", value: "priya-nand", label: "Priya Nand", initials: "PN" },
	{ type: "member", id: "member-7", value: "kenji-watan", label: "Kenji Watan", initials: "KW" },
	{ type: "member", id: "member-8", value: "ava-sinclair", label: "Ava Sinclair", initials: "AS" },
	{ type: "member", id: "member-9", value: "nia-okafor", label: "Nia Okafor", initials: "NO" },
	{ type: "member", id: "member-10", value: "matteo-sosa", label: "Matteo Sosa", initials: "MS" },
	{ type: "member", id: "member-11", value: "salma-rahman", label: "Salma Rahman", initials: "SR" },
	{ type: "member", id: "member-12", value: "jonas-meyer", label: "Jonas Meyer", initials: "JM" },
];

const LEAD_OPTIONS: readonly LeadOption[] = [NO_LEAD_OPTION, ...TEAM_MEMBERS];

const TRIGGER_BUTTON = <Button type="button" variant="outline" className="w-full justify-between font-normal" />;

function leadLabel(option: LeadOption): string {
	return option.label;
}

interface LeadOptionProps {
	readonly option: LeadOption;
}

function NoLeadLabel({ label }: { readonly label: string }): React.JSX.Element {
	return (
		<span className="flex min-w-0 items-center gap-2">
			<UserIcon className="size-4 shrink-0 text-muted-foreground" />
			<span className="truncate">{label}</span>
		</span>
	);
}

function LeadTriggerLabel({ option }: LeadOptionProps): React.JSX.Element {
	if (option.type === "none") {
		return <NoLeadLabel label={option.label} />;
	}

	return (
		<span className="flex min-w-0 items-center gap-2">
			<Avatar className="size-5">
				<AvatarFallback className="text-[9px]">{option.initials}</AvatarFallback>
			</Avatar>
			<span className="truncate">{option.label}</span>
		</span>
	);
}

function LeadListRow({ option }: LeadOptionProps): React.JSX.Element {
	if (option.type === "none") {
		return <NoLeadLabel label={option.label} />;
	}

	return (
		<Item size="xs" className="p-0">
			<ItemMedia>
				<Avatar className="size-5">
					<AvatarFallback className="text-[9px]">{option.initials}</AvatarFallback>
				</Avatar>
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

function renderMemberItem(member: TeamMember): React.JSX.Element {
	return (
		<ComboboxItem key={member.id} value={member}>
			<LeadListRow option={member} />
		</ComboboxItem>
	);
}

export function Combobox23Example(): React.JSX.Element {
	const [lead, setLead] = useState<LeadOption | null>(NO_LEAD_OPTION);

	return (
		<Field className="max-w-xs">
			<Combobox items={LEAD_OPTIONS} value={lead} onValueChange={setLead} itemToStringValue={leadLabel} autoHighlight>
				<ComboboxTrigger render={TRIGGER_BUTTON}>
					{lead === null ? <span className="text-muted-foreground">No lead</span> : <LeadTriggerLabel option={lead} />}
				</ComboboxTrigger>

				<ComboboxContent className="max-w-(--anchor-width) min-w-(--anchor-width)">
					<ComboboxInput showTrigger={false} placeholder="Select lead" className="mb-1" />
					<ComboboxEmpty text="No team members found." />
					<ComboboxList>
						<ComboboxItem value={NO_LEAD_OPTION}>
							<LeadListRow option={NO_LEAD_OPTION} />
						</ComboboxItem>

						<ComboboxGroup items={TEAM_MEMBERS}>
							<ComboboxLabel>Team members</ComboboxLabel>
							<ComboboxCollection>{renderMemberItem}</ComboboxCollection>
						</ComboboxGroup>
					</ComboboxList>
				</ComboboxContent>
			</Combobox>
		</Field>
	);
}
