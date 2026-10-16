"use client";

import {
	Autocomplete,
	AutocompleteCollection,
	AutocompleteContent,
	AutocompleteEmpty,
	AutocompleteGroup,
	AutocompleteGroupLabel,
	AutocompleteInput,
	AutocompleteItem,
	AutocompleteList,
} from "@workspace/ui/components/autocomplete";
import { Avatar, AvatarFallback } from "@workspace/ui/components/avatar";
import * as React from "react";

import { containsQuery, initialsOf } from "@/components/component-gallery/examples/autocomplete/autocomplete-sample-data";

type UserStatus = "Active" | "Away" | "Inactive";

interface User {
	readonly id: string;
	readonly name: string;
	readonly team: string;
	readonly position: string;
	readonly status: UserStatus;
}

interface UserGroup {
	readonly group: string;
	readonly items: readonly User[];
}

/** Within a team, active people first, then away, then inactive. */
const STATUS_RANK: Readonly<Record<UserStatus, number>> = { Active: 0, Away: 1, Inactive: 2 };

/** The order the teams are listed in. */
const TEAM_ORDER: readonly string[] = ["Management Team", "Development Team", "Design Team", "Marketing Team", "Sales Team", "Support Team"];

const USERS: readonly User[] = [
	{ id: "john-doe", name: "John Doe", team: "Development Team", position: "Senior Frontend Developer", status: "Active" },
	{ id: "jane-smith", name: "Jane Smith", team: "Development Team", position: "Full Stack Developer", status: "Active" },
	{ id: "mike-wilson", name: "Mike Wilson", team: "Development Team", position: "Backend Developer", status: "Active" },
	{ id: "sarah-johnson", name: "Sarah Johnson", team: "Development Team", position: "DevOps Engineer", status: "Away" },
	{ id: "david-brown", name: "David Brown", team: "Development Team", position: "Mobile Developer", status: "Active" },
	{ id: "lisa-garcia", name: "Lisa Garcia", team: "Development Team", position: "UI/UX Developer", status: "Active" },
	{ id: "alex-martinez", name: "Alex Martinez", team: "Design Team", position: "Lead UX Designer", status: "Active" },
	{ id: "emma-davis", name: "Emma Davis", team: "Design Team", position: "UI Designer", status: "Active" },
	{ id: "chris-taylor", name: "Chris Taylor", team: "Design Team", position: "Product Designer", status: "Active" },
	{ id: "olivia-anderson", name: "Olivia Anderson", team: "Design Team", position: "Visual Designer", status: "Inactive" },
	{ id: "james-moore", name: "James Moore", team: "Marketing Team", position: "Marketing Manager", status: "Active" },
	{ id: "sophia-white", name: "Sophia White", team: "Marketing Team", position: "Content Marketing Specialist", status: "Active" },
	{ id: "william-harris", name: "William Harris", team: "Marketing Team", position: "Digital Marketing Specialist", status: "Active" },
	{ id: "ava-martin", name: "Ava Martin", team: "Marketing Team", position: "Social Media Manager", status: "Away" },
	{ id: "ethan-thompson", name: "Ethan Thompson", team: "Sales Team", position: "Sales Director", status: "Active" },
	{ id: "mia-garcia", name: "Mia Garcia", team: "Sales Team", position: "Account Executive", status: "Active" },
	{ id: "noah-martinez", name: "Noah Martinez", team: "Sales Team", position: "Sales Representative", status: "Active" },
	{ id: "isabella-rodriguez", name: "Isabella Rodriguez", team: "Sales Team", position: "Business Development Manager", status: "Active" },
	{ id: "lucas-lee", name: "Lucas Lee", team: "Management Team", position: "CEO", status: "Active" },
	{ id: "charlotte-walker", name: "Charlotte Walker", team: "Management Team", position: "CTO", status: "Active" },
	{ id: "benjamin-hall", name: "Benjamin Hall", team: "Management Team", position: "VP of Engineering", status: "Active" },
	{ id: "amelia-allen", name: "Amelia Allen", team: "Management Team", position: "VP of Marketing", status: "Active" },
	{ id: "henry-young", name: "Henry Young", team: "Support Team", position: "Customer Success Manager", status: "Active" },
	{ id: "grace-king", name: "Grace King", team: "Support Team", position: "Technical Support Specialist", status: "Active" },
	{ id: "sebastian-wright", name: "Sebastian Wright", team: "Support Team", position: "Customer Support Representative", status: "Away" },
	{ id: "lily-lopez", name: "Lily Lopez", team: "Support Team", position: "Help Desk Technician", status: "Active" },
];

function byStatus(left: User, right: User): number {
	return STATUS_RANK[left.status] - STATUS_RANK[right.status];
}

function groupUsers(users: readonly User[]): readonly UserGroup[] {
	return TEAM_ORDER.map((team: string): UserGroup => ({ group: team, items: users.filter((user: User): boolean => user.team === team).sort(byStatus) }));
}

const GROUPED_USERS: readonly UserGroup[] = groupUsers(USERS);

/** Groups with only the people whose name, team or position contains the query; empty groups dropped. */
function filterGroups(query: string): readonly UserGroup[] {
	if (query === "") {
		return GROUPED_USERS;
	}
	return GROUPED_USERS.map((group: UserGroup): UserGroup => ({
		group: group.group,
		items: group.items.filter((user: User): boolean => containsQuery(user.name, query) || containsQuery(user.team, query) || containsQuery(user.position, query)),
	})).filter((group: UserGroup): boolean => group.items.length > 0);
}

function userName(user: User): string {
	return user.name;
}

function renderUser(user: User): React.JSX.Element {
	return (
		<AutocompleteItem key={user.id} value={user} className="flex items-center gap-2.5 rounded-lg">
			<Avatar className="size-9">
				<AvatarFallback>{initialsOf(user.name)}</AvatarFallback>
			</Avatar>
			<div className="min-w-0 flex-1">
				<div className="truncate font-medium">{user.name}</div>
				<div className="truncate text-sm text-muted-foreground">{user.position}</div>
			</div>
		</AutocompleteItem>
	);
}

function renderUserGroup(group: UserGroup): React.JSX.Element {
	return (
		<AutocompleteGroup key={group.group} items={group.items} className="py-0">
			<AutocompleteGroupLabel className="sticky top-0 z-10 me-1.5 bg-popover py-2.5 text-xs font-medium text-muted-foreground">{group.group}</AutocompleteGroupLabel>
			<AutocompleteCollection>{renderUser}</AutocompleteCollection>
		</AutocompleteGroup>
	);
}

export function Autocomplete8Example(): React.JSX.Element {
	const [value, setValue] = React.useState("");
	const [open, setOpen] = React.useState(false);
	const filteredGroups = React.useMemo((): readonly UserGroup[] => filterGroups(value), [value]);

	return (
		<div className="w-full max-w-xs">
			<Autocomplete items={filteredGroups} value={value} onValueChange={setValue} open={open} onOpenChange={setOpen} itemToStringValue={userName} filter={null}>
				<AutocompleteInput placeholder="e.g. John, Developer, Marketing" />
				{open ? (
					<AutocompleteContent className="pt-0">
						{filteredGroups.length === 0 ? (
							<AutocompleteEmpty>No matching users found.</AutocompleteEmpty>
						) : (
							<AutocompleteList className="not-empty:py-0">{renderUserGroup}</AutocompleteList>
						)}
					</AutocompleteContent>
				) : null}
			</Autocomplete>
		</div>
	);
}
