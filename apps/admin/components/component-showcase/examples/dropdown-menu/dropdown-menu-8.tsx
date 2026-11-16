"use client";

import * as React from "react";
import { FileIcon, FolderOpenIcon, MailIcon, PaletteIcon, TrashIcon } from "lucide-react";
import { useCallback, useState } from "react";

import { Button } from "@workspace/ui/components/button";
import {
	DropdownMenu,
	DropdownMenuCheckboxItem,
	DropdownMenuContent,
	DropdownMenuGroup,
	DropdownMenuItem,
	DropdownMenuLabel,
	DropdownMenuPortal,
	DropdownMenuRadioGroup,
	DropdownMenuRadioItem,
	DropdownMenuSeparator,
	DropdownMenuShortcut,
	DropdownMenuSub,
	DropdownMenuSubContent,
	DropdownMenuSubTrigger,
	DropdownMenuTrigger,
} from "@workspace/ui/components/dropdown-menu";

export function DropdownMenu8Example(): React.JSX.Element {
	const [notifications, setNotifications] = useState({
		email: true,
		sms: false,
		push: true,
	});
	const [theme, setTheme] = useState("light");

	const handleEmailChange = useCallback((checked: boolean): void => {
		setNotifications((prev) => ({ ...prev, email: checked }));
	}, []);

	return (
		<div className="flex items-center justify-center">
			<DropdownMenu>
				<DropdownMenuTrigger render={<Button variant="outline" className="w-fit" />}>Complex Menu</DropdownMenuTrigger>
				<DropdownMenuContent className="w-56">
					<DropdownMenuGroup>
						<DropdownMenuLabel>File</DropdownMenuLabel>
						<DropdownMenuItem>
							<FileIcon />
							New File
							<DropdownMenuShortcut>⌘N</DropdownMenuShortcut>
						</DropdownMenuItem>
						<DropdownMenuSub>
							<DropdownMenuSubTrigger>
								<FolderOpenIcon />
								Open Recent
							</DropdownMenuSubTrigger>
							<DropdownMenuPortal>
								<DropdownMenuSubContent>
									<DropdownMenuItem>Project Alpha</DropdownMenuItem>
									<DropdownMenuItem>Project Beta</DropdownMenuItem>
									<DropdownMenuSeparator />
									<DropdownMenuItem>Browse…</DropdownMenuItem>
								</DropdownMenuSubContent>
							</DropdownMenuPortal>
						</DropdownMenuSub>
					</DropdownMenuGroup>
					<DropdownMenuSeparator />
					<DropdownMenuGroup>
						<DropdownMenuLabel>Appearance</DropdownMenuLabel>
						<DropdownMenuSub>
							<DropdownMenuSubTrigger>
								<PaletteIcon />
								Theme
							</DropdownMenuSubTrigger>
							<DropdownMenuPortal>
								<DropdownMenuSubContent>
									<DropdownMenuRadioGroup value={theme} onValueChange={setTheme}>
										<DropdownMenuRadioItem value="light">Light</DropdownMenuRadioItem>
										<DropdownMenuRadioItem value="dark">Dark</DropdownMenuRadioItem>
										<DropdownMenuRadioItem value="system">System</DropdownMenuRadioItem>
									</DropdownMenuRadioGroup>
								</DropdownMenuSubContent>
							</DropdownMenuPortal>
						</DropdownMenuSub>
						<DropdownMenuCheckboxItem checked={notifications.email} onCheckedChange={handleEmailChange}>
							<MailIcon />
							Email Notifications
						</DropdownMenuCheckboxItem>
					</DropdownMenuGroup>
					<DropdownMenuSeparator />
					<DropdownMenuItem variant="destructive">
						<TrashIcon />
						Delete
						<DropdownMenuShortcut>⌘⌫</DropdownMenuShortcut>
					</DropdownMenuItem>
				</DropdownMenuContent>
			</DropdownMenu>
		</div>
	);
}
