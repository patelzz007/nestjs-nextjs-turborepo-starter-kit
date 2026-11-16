import * as React from "react";
import { TrendingDownIcon, TrendingUpIcon } from "lucide-react";
import { Badge, type BadgeVariant } from "@workspace/ui/components/badge";

import { Avatar, AvatarFallback, AvatarImage } from "@workspace/ui/components/avatar";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@workspace/ui/components/table";

interface Leader {
	readonly rank: number;
	readonly name: string;
	readonly handle: string;
	readonly avatar: string;
	readonly score: number;
	readonly change: string;
	readonly changeUp: boolean;
	readonly level: string;
	readonly levelVariant: BadgeVariant;
}

const leaders: readonly Leader[] = [
	{
		rank: 1,
		name: "Sarah Chen",
		handle: "@sarahchen",
		avatar: "https://images.unsplash.com/photo-1494790108377-be9c29b29330?w=96&h=96&dpr=2&q=80",
		score: 12840,
		change: "+320",
		changeUp: true,
		level: "Diamond",
		levelVariant: "info",
	},
	{
		rank: 2,
		name: "Marcus Johnson",
		handle: "@marcusj",
		avatar: "https://images.unsplash.com/photo-1535713875002-d1d0cf377fde?w=96&h=96&dpr=2&q=80",
		score: 11250,
		change: "+180",
		changeUp: true,
		level: "Platinum",
		levelVariant: "default",
	},
	{
		rank: 3,
		name: "Emily Park",
		handle: "@emilyp",
		avatar: "https://images.unsplash.com/photo-1438761681033-6461ffad8d80?w=96&h=96&dpr=2&q=80",
		score: 10890,
		change: "-45",
		changeUp: false,
		level: "Platinum",
		levelVariant: "default",
	},
	{
		rank: 4,
		name: "David Kim",
		handle: "@davidk",
		avatar: "https://images.unsplash.com/photo-1472099645785-5658abf4ff4e?w=96&h=96&dpr=2&q=80",
		score: 9420,
		change: "+520",
		changeUp: true,
		level: "Gold",
		levelVariant: "warning",
	},
	{
		rank: 5,
		name: "Sofia Davis",
		handle: "@sofiad",
		avatar: "https://images.unsplash.com/photo-1519699047748-de8e457a634e?w=96&h=96&dpr=2&q=80",
		score: 8750,
		change: "+90",
		changeUp: true,
		level: "Gold",
		levelVariant: "warning",
	},
];

export function Table15Example(): React.JSX.Element {
	return (
		<div className="mx-auto flex w-full max-w-2xl flex-col">
			<Table>
				<TableHeader>
					<TableRow>
						<TableHead className="w-12 text-center">#</TableHead>
						<TableHead>Player</TableHead>
						<TableHead>Level</TableHead>
						<TableHead className="text-right">Score</TableHead>
						<TableHead className="text-right">Change</TableHead>
					</TableRow>
				</TableHeader>
				<TableBody>
					{leaders.map((leader) => (
						<TableRow key={leader.rank}>
							<TableCell className="text-center text-sm font-bold">{leader.rank}</TableCell>
							<TableCell>
								<div className="flex items-center gap-3">
									<Avatar size="sm">
										<AvatarImage src={leader.avatar} alt={leader.name} />
										<AvatarFallback>
											{leader.name
												.split(" ")
												.map((part) => part.charAt(0))
												.join("")}
										</AvatarFallback>
									</Avatar>
									<div className="flex flex-col">
										<span className="text-sm font-medium">{leader.name}</span>
										<span className="text-xs text-muted-foreground">{leader.handle}</span>
									</div>
								</div>
							</TableCell>
							<TableCell>
								<Badge variant={leader.levelVariant} size="sm">
									{leader.level}
								</Badge>
							</TableCell>
							<TableCell className="text-right font-mono text-sm font-medium">{leader.score.toLocaleString()}</TableCell>
							<TableCell className="text-right">
								<span className="inline-flex items-center gap-0.5 text-sm">
									{leader.changeUp ? (
										<TrendingUpIcon aria-hidden="true" className="size-3.5 text-success" />
									) : (
										<TrendingDownIcon aria-hidden="true" className="size-3.5 text-destructive" />
									)}
									<span className={leader.changeUp ? "text-success" : "text-destructive"}>{leader.change}</span>
								</span>
							</TableCell>
						</TableRow>
					))}
				</TableBody>
			</Table>
		</div>
	);
}
