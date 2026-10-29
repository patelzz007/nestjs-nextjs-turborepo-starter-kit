"use client";

import * as React from "react";
import { FileIcon, SearchIcon } from "lucide-react";
import { useCallback, useState } from "react";
import { Badge } from "@workspace/ui/components/badge";

import { Button } from "@workspace/ui/components/button";
import { Command, CommandDialog, CommandEmpty, CommandGroup, CommandInput, CommandItem, CommandList } from "@workspace/ui/components/command";
import { Kbd } from "@workspace/ui/components/kbd";

const files = [
	{ name: "page.tsx", path: "src/app/page.tsx", type: "tsx" },
	{ name: "layout.tsx", path: "src/app/layout.tsx", type: "tsx" },
	{ name: "globals.css", path: "src/styles/globals.css", type: "css" },
	{ name: "utils.ts", path: "src/lib/utils.ts", type: "ts" },
	{ name: "api.ts", path: "src/lib/api.ts", type: "ts" },
	{ name: "button.tsx", path: "src/components/ui/button.tsx", type: "tsx" },
	{ name: "package.json", path: "package.json", type: "json" },
	{ name: "README.md", path: "README.md", type: "md" },
];

export function Command5Example(): React.JSX.Element {
	const [open, setOpen] = useState(false);
	const openPalette = useCallback((): void => {
		setOpen(true);
	}, []);

	return (
		<>
			<Button onClick={openPalette} variant="outline" className="w-52">
				<SearchIcon className="size-4" />
				Search files...
				<Kbd className="ml-auto">⌘K</Kbd>
			</Button>
			<CommandDialog title="Command palette" description="Search for a command to run" open={open} onOpenChange={setOpen}>
				<Command>
					<CommandInput placeholder="Search files by name..." />
					<CommandList>
						<CommandEmpty>No files found.</CommandEmpty>
						<CommandGroup heading="Files">
							{files.map((file) => (
								<CommandItem key={file.path} value={file.path} keywords={[file.name]} className="gap-2.5">
									<FileIcon className="size-4 shrink-0" />
									<div className="flex flex-1 items-center gap-2">
										<span className="font-medium">{file.name}</span>
										<span className="truncate text-xs text-muted-foreground">{file.path}</span>
									</div>
									<div className="ml-auto" data-slot="command-shortcut">
										<Badge variant="outline" size="sm">
											{file.type}
										</Badge>
									</div>
								</CommandItem>
							))}
						</CommandGroup>
					</CommandList>
				</Command>
			</CommandDialog>
		</>
	);
}
