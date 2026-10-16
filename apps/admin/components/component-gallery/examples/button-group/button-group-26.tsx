"use client";

import type * as React from "react";
import { PlusIcon, Settings2Icon } from "lucide-react";
import { useCallback, useState } from "react";

import { Avatar, AvatarFallback, AvatarImage } from "@workspace/ui/components/avatar";
import { Button } from "@workspace/ui/components/button";
import { ButtonGroup } from "@workspace/ui/components/button-group";
import { Select, SelectContent, SelectGroup, SelectItem, SelectLabel, SelectTrigger, SelectValue } from "@workspace/ui/components/select";

interface User {
	readonly id: string;
	readonly name: string;
	readonly email: string;
	readonly avatar: string;
	readonly initials: string;
}

interface UserOption {
	readonly value: string;
	readonly label: string;
	readonly avatar: string;
	readonly initials: string;
}

const users: readonly User[] = [
	{
		id: "1",
		name: "Alex Johnson",
		email: "alex@example.com",
		avatar: "https://images.unsplash.com/photo-1535713875002-d1d0cf377fde?w=96&h=96&dpr=2&q=80",
		initials: "AJ",
	},
	{
		id: "2",
		name: "Sarah Chen",
		email: "sarah@example.com",
		avatar: "https://images.unsplash.com/photo-1519699047748-de8e457a634e?w=96&h=96&dpr=2&q=80",
		initials: "SC",
	},
	{
		id: "3",
		name: "Michael Rodriguez",
		email: "michael@example.com",
		avatar: "https://images.unsplash.com/photo-1584308972272-9e4e7685e80f?w=96&h=96&dpr=2&q=80",
		initials: "MR",
	},
	{
		id: "4",
		name: "Emma Wilson",
		email: "emma@example.com",
		avatar: "https://images.unsplash.com/photo-1485893086445-ed75865251e0?w=96&h=96&dpr=2&q=80",
		initials: "EW",
	},
];

const userOptions: readonly UserOption[] = users.map((user): UserOption => ({ value: user.id, label: user.name, avatar: user.avatar, initials: user.initials }));

const DEFAULT_USER_ID = "3";

function formatUser(value: string): React.ReactNode {
	const user = userOptions.find((option) => option.value === value);
	if (user === undefined) {
		return value;
	}
	return (
		<span className="flex items-center gap-2">
			<Avatar className="size-5">
				<AvatarImage src={user.avatar} alt={user.label} />
				<AvatarFallback className="text-[10px]">{user.initials}</AvatarFallback>
			</Avatar>
			<span className="truncate">{user.label}</span>
		</span>
	);
}

export function ButtonGroup26Example(): React.JSX.Element {
	const [selectedUser, setSelectedUser] = useState<string | null>(DEFAULT_USER_ID);

	const handleValueChange = useCallback((value: string | null): void => {
		setSelectedUser(value);
	}, []);

	return (
		<ButtonGroup>
			<Select value={selectedUser} onValueChange={handleValueChange} items={userOptions}>
				<SelectTrigger className="w-40">
					<SelectValue formatValue={formatUser} />
				</SelectTrigger>
				<SelectContent alignItemWithTrigger={false} className="min-w-[200px]">
					<SelectGroup>
						<SelectLabel>Team Members</SelectLabel>
						{userOptions.map((user) => (
							<SelectItem key={user.value} value={user.value}>
								<Avatar className="size-6">
									<AvatarImage src={user.avatar} alt={user.label} />
									<AvatarFallback className="text-[10px]">{user.initials}</AvatarFallback>
								</Avatar>
								<span>{user.label}</span>
							</SelectItem>
						))}
					</SelectGroup>
				</SelectContent>
			</Select>
			<Button variant="outline" size="icon" aria-label="Add Tag">
				<PlusIcon aria-hidden="true" />
			</Button>
			<Button variant="outline" size="icon" aria-label="Settings">
				<Settings2Icon aria-hidden="true" />
			</Button>
		</ButtonGroup>
	);
}
