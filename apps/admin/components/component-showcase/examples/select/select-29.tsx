import type * as React from "react";
import { Avatar, AvatarFallback, AvatarImage } from "@workspace/ui/components/avatar";
import { Field } from "@workspace/ui/components/field";
import { Select, SelectContent, SelectGroup, SelectItem, SelectLabel, SelectTrigger, SelectValue } from "@workspace/ui/components/select";

interface Member {
	readonly value: string;
	readonly label: string;
	readonly initials: string;
	readonly avatar: string;
}

const members: readonly Member[] = [
	{
		value: "sarah",
		label: "Sarah Chen",
		initials: "SC",
		avatar: "https://images.unsplash.com/photo-1519699047748-de8e457a634e?w=96&h=96&dpr=2&q=80",
	},
	{
		value: "alex",
		label: "Alex Kim",
		initials: "AK",
		avatar: "https://images.unsplash.com/photo-1535713875002-d1d0cf377fde?w=96&h=96&dpr=2&q=80",
	},
	{
		value: "maria",
		label: "Maria Garcia",
		initials: "MG",
		avatar: "https://images.unsplash.com/photo-1620075225255-8c2051b6c015?w=96&h=96&dpr=2&q=80",
	},
	{
		value: "james",
		label: "James Wilson",
		initials: "JW",
		avatar: "https://images.unsplash.com/photo-1543299750-19d1d6297053?w=96&h=96&dpr=2&q=80",
	},
];

const DEFAULT_MEMBER = "sarah";

function formatMember(value: string): React.ReactNode {
	const member = members.find((item) => item.value === value);
	if (member === undefined) {
		return value;
	}
	return (
		<span className="flex items-center gap-2">
			<Avatar className="size-5">
				<AvatarImage src={member.avatar} alt={member.label} />
				<AvatarFallback className="text-[10px]">{member.initials}</AvatarFallback>
			</Avatar>
			<span>{member.label}</span>
		</span>
	);
}

export function Select29Example(): React.JSX.Element {
	return (
		<Field className="max-w-xs">
			<Select defaultValue={DEFAULT_MEMBER} items={members}>
				<SelectTrigger>
					<SelectValue formatValue={formatMember} />
				</SelectTrigger>
				<SelectContent alignItemWithTrigger={false}>
					<SelectGroup>
						<SelectLabel>Assign to</SelectLabel>
						{members.map((member) => (
							<SelectItem key={member.value} value={member.value}>
								<span className="flex items-center gap-2">
									<Avatar className="size-6">
										<AvatarImage src={member.avatar} alt={member.label} />
										<AvatarFallback className="text-xs">{member.initials}</AvatarFallback>
									</Avatar>
									<span>{member.label}</span>
								</span>
							</SelectItem>
						))}
					</SelectGroup>
				</SelectContent>
			</Select>
		</Field>
	);
}
