"use client";

import type * as React from "react";
import { ChevronDownIcon, DownloadIcon, FileJsonIcon, FileSpreadsheetIcon, FileTextIcon, LayoutGridIcon, ListFilterIcon, ListIcon } from "lucide-react";
import { useCallback, useState } from "react";

import { cn } from "@workspace/ui/lib/core/utils";
import { Button } from "@workspace/ui/components/button";
import { ButtonGroup } from "@workspace/ui/components/button-group";
import { DropdownMenu, DropdownMenuContent, DropdownMenuGroup, DropdownMenuItem, DropdownMenuTrigger } from "@workspace/ui/components/dropdown-menu";

const icons = {
	filter: <ListFilterIcon aria-hidden="true" />,
	download: <DownloadIcon aria-hidden="true" />,
	chevronDown: <ChevronDownIcon aria-hidden="true" />,
	grid: <LayoutGridIcon aria-hidden="true" />,
	list: <ListIcon aria-hidden="true" />,
	fileSpreadsheet: <FileSpreadsheetIcon aria-hidden="true" />,
	fileJson: <FileJsonIcon aria-hidden="true" />,
	filePdf: <FileTextIcon aria-hidden="true" />,
};

const MORE_EXPORTS_TRIGGER = <Button variant="outline" size="icon" className="shrink-0" aria-label="More export options" />;

export function ButtonGroup48Example(): React.JSX.Element {
	const [view, setView] = useState<"grid" | "list">("grid");

	const showGrid = useCallback((): void => {
		setView("grid");
	}, []);
	const showList = useCallback((): void => {
		setView("list");
	}, []);

	return (
		<ButtonGroup>
			<Button variant="outline">
				{icons.filter}
				Filter
			</Button>
			<Button variant="outline">
				{icons.download}
				Export CSV
			</Button>
			<DropdownMenu>
				<DropdownMenuTrigger render={MORE_EXPORTS_TRIGGER}>{icons.chevronDown}</DropdownMenuTrigger>
				<DropdownMenuContent align="end" className="w-40">
					<DropdownMenuGroup>
						<DropdownMenuItem>
							{icons.fileSpreadsheet}
							Export Excel
						</DropdownMenuItem>
						<DropdownMenuItem>
							{icons.fileJson}
							Export JSON
						</DropdownMenuItem>
						<DropdownMenuItem>
							{icons.filePdf}
							Export PDF
						</DropdownMenuItem>
					</DropdownMenuGroup>
				</DropdownMenuContent>
			</DropdownMenu>
			<Button variant="outline" size="icon" aria-label="Grid view" className={cn(view === "grid" ? "bg-muted" : "")} aria-pressed={view === "grid"} onClick={showGrid}>
				{icons.grid}
			</Button>
			<Button variant="outline" size="icon" aria-label="List view" className={cn(view === "list" ? "bg-muted" : "")} aria-pressed={view === "list"} onClick={showList}>
				{icons.list}
			</Button>
		</ButtonGroup>
	);
}
