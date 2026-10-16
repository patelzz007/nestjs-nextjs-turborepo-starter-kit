"use client";

import type * as React from "react";
import { ChevronDownIcon, LayoutGridIcon, ListFilterIcon, ListIcon, PlusIcon } from "lucide-react";
import { useCallback, useState } from "react";
import { cn } from "@workspace/ui/lib/core/utils";

import { Button } from "@workspace/ui/components/button";
import { ButtonGroup } from "@workspace/ui/components/button-group";
import { DropdownMenu, DropdownMenuContent, DropdownMenuItem, DropdownMenuSeparator, DropdownMenuTrigger } from "@workspace/ui/components/dropdown-menu";

const SORT_TRIGGER = <Button variant="outline" size="icon" aria-label="Sort" />;
const ADD_TRIGGER = <Button />;

export function ButtonGroup32Example(): React.JSX.Element {
	const [view, setView] = useState<"grid" | "list">("list");

	const showGrid = useCallback((): void => {
		setView("grid");
	}, []);
	const showList = useCallback((): void => {
		setView("list");
	}, []);

	return (
		<div className="flex items-center gap-2">
			<DropdownMenu>
				<DropdownMenuTrigger render={SORT_TRIGGER}>
					<ListFilterIcon />
				</DropdownMenuTrigger>
				<DropdownMenuContent align="start" className="min-w-40">
					<DropdownMenuItem>Newest</DropdownMenuItem>
					<DropdownMenuItem>Oldest</DropdownMenuItem>
					<DropdownMenuSeparator />
					<DropdownMenuItem>Recently Updated</DropdownMenuItem>
				</DropdownMenuContent>
			</DropdownMenu>

			<ButtonGroup>
				<Button variant="outline" size="icon" className={cn(view === "grid" && "bg-muted")} aria-pressed={view === "grid"} onClick={showGrid} aria-label="Grid view">
					<LayoutGridIcon aria-hidden="true" />
				</Button>
				<Button variant="outline" size="icon" className={cn(view === "list" && "bg-muted")} aria-pressed={view === "list"} onClick={showList} aria-label="List view">
					<ListIcon aria-hidden="true" />
				</Button>
			</ButtonGroup>

			<DropdownMenu>
				<DropdownMenuTrigger render={ADD_TRIGGER}>
					Add New...
					<ChevronDownIcon aria-hidden="true" className="opacity-60" />
				</DropdownMenuTrigger>
				<DropdownMenuContent align="end" className="min-w-40">
					<DropdownMenuItem>
						<PlusIcon aria-hidden="true" />
						Project
					</DropdownMenuItem>
					<DropdownMenuItem>
						<PlusIcon aria-hidden="true" />
						Domain
					</DropdownMenuItem>
					<DropdownMenuSeparator />
					<DropdownMenuItem>
						<PlusIcon aria-hidden="true" />
						Team
					</DropdownMenuItem>
				</DropdownMenuContent>
			</DropdownMenu>
		</div>
	);
}
