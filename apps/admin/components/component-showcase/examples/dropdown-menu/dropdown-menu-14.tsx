"use client";

import * as React from "react";
import { BuildingIcon, CheckIcon, ChevronsUpDownIcon, LifeBuoyIcon, LogOutIcon, MonitorIcon, MoonIcon, PhoneIcon, SettingsIcon, SunIcon } from "lucide-react";
import { useCallback, useState } from "react";
import { Badge } from "@workspace/ui/components/badge";

import { cn } from "@workspace/ui/lib/core/utils";
import { Avatar, AvatarFallback, AvatarImage } from "@workspace/ui/components/avatar";
import { Button } from "@workspace/ui/components/button";
import {
	DropdownMenu,
	DropdownMenuContent,
	DropdownMenuGroup,
	DropdownMenuItem,
	DropdownMenuSeparator,
	DropdownMenuSub,
	DropdownMenuSubContent,
	DropdownMenuSubTrigger,
	DropdownMenuTrigger,
} from "@workspace/ui/components/dropdown-menu";
import { Tabs, TabsList, TabsTrigger } from "@workspace/ui/components/tabs";

interface StatusOption {
	readonly value: string;
	readonly label: string;
	/** The presence dot's fill. */
	readonly color: string;
}

const AVAILABLE_STATUS: StatusOption = { value: "available", label: "Available", color: "bg-success" };

const statuses: readonly StatusOption[] = [
	AVAILABLE_STATUS,
	{ value: "away", label: "Away", color: "bg-warning" },
	{ value: "busy", label: "Busy", color: "bg-destructive" },
	{ value: "offline", label: "Offline", color: "bg-muted-foreground" },
];

export function DropdownMenu14Example(): React.JSX.Element {
	const [status, setStatus] = useState(AVAILABLE_STATUS.value);
	const [theme, setTheme] = useState("light");

	const activeStatus = statuses.find((option: StatusOption): boolean => option.value === status) ?? AVAILABLE_STATUS;

	const handleStatusClick = useCallback((event: React.MouseEvent<HTMLElement>): void => {
		setStatus(event.currentTarget.dataset.status ?? AVAILABLE_STATUS.value);
	}, []);

	return (
		<div className="flex items-center justify-center">
			<DropdownMenu>
				<DropdownMenuTrigger render={<Button variant="outline" className="w-40" />}>
					<Avatar className="size-4">
						<AvatarImage src="https://github.com/shadcn.png" />
						<AvatarFallback>CN</AvatarFallback>
					</Avatar>
					<span className="text-sm font-medium">shadcn</span>

					<ChevronsUpDownIcon className="ml-auto opacity-60" aria-hidden="true" />
				</DropdownMenuTrigger>
				<DropdownMenuContent className="w-60" align="start" sideOffset={8}>
					<div className="flex items-center gap-3 px-1 pt-1.5">
						<Avatar className="size-8">
							<AvatarImage src="https://github.com/shadcn.png" />
							<AvatarFallback>CN</AvatarFallback>
						</Avatar>
						<div className="flex flex-col">
							<span className="text-sm font-medium text-foreground">shadcn</span>
							<span className="text-xs text-muted-foreground">ui@shadcn.com</span>
						</div>
					</div>
					<div className="py-2.5">
						<Tabs value={theme} onValueChange={setTheme}>
							<TabsList className="w-full">
								<TabsTrigger value="light" className="h-6 flex-1">
									<SunIcon className="size-4" aria-hidden="true" />
								</TabsTrigger>
								<TabsTrigger value="dark" className="h-6 flex-1">
									<MoonIcon className="size-4" aria-hidden="true" />
								</TabsTrigger>
								<TabsTrigger value="system" className="h-6 flex-1">
									<MonitorIcon className="size-4" aria-hidden="true" />
								</TabsTrigger>
							</TabsList>
						</Tabs>
					</div>
					<DropdownMenuGroup>
						<DropdownMenuItem closeOnClick={false} className="justify-between">
							<span className="flex items-center gap-2">
								<BuildingIcon aria-hidden="true" />
								Your Companies
							</span>
							<Badge variant="secondary" size="sm" className="ml-auto">
								12
							</Badge>
						</DropdownMenuItem>
						<DropdownMenuItem closeOnClick={false} className="justify-between">
							<span className="flex items-center gap-2">
								<PhoneIcon aria-hidden="true" />
								Your Numbers
							</span>
							<Badge variant="secondary" size="sm" className="ml-auto">
								2
							</Badge>
						</DropdownMenuItem>
					</DropdownMenuGroup>
					<DropdownMenuSub>
						<DropdownMenuSubTrigger>
							<span className="flex items-center gap-2">
								<span className={cn("mx-1.25 size-2 rounded-full", activeStatus.color)} />
								{activeStatus.label}
							</span>
						</DropdownMenuSubTrigger>
						<DropdownMenuSubContent className="w-40">
							{statuses.map((s: StatusOption): React.JSX.Element => (
								<DropdownMenuItem key={s.value} data-status={s.value} onClick={handleStatusClick} className="justify-between">
									<span className="flex items-center gap-2">
										<span className={cn("size-2 rounded-full", s.color)} />
										{s.label}
									</span>
									{status === s.value ? <CheckIcon className="size-4 text-muted-foreground" aria-hidden="true" /> : null}
								</DropdownMenuItem>
							))}
						</DropdownMenuSubContent>
					</DropdownMenuSub>
					<DropdownMenuSeparator />
					<DropdownMenuGroup>
						<DropdownMenuItem>
							<SettingsIcon aria-hidden="true" />
							Settings
						</DropdownMenuItem>
						<DropdownMenuItem>
							<LifeBuoyIcon aria-hidden="true" />
							Help Center
						</DropdownMenuItem>
					</DropdownMenuGroup>
					<DropdownMenuSeparator />
					<DropdownMenuItem variant="destructive">
						<LogOutIcon aria-hidden="true" />
						Logout
					</DropdownMenuItem>
				</DropdownMenuContent>
			</DropdownMenu>
		</div>
	);
}
