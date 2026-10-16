"use client";

import * as React from "react";
import { MenuIcon, XIcon } from "lucide-react";
import { useCallback, useState } from "react";

import { cn } from "@workspace/ui/lib/core/utils";
import { Button } from "@workspace/ui/components/button";

export function Button43Example(): React.JSX.Element {
	const [open, setOpen] = useState(false);
	const toggleOpen = useCallback((): void => {
		setOpen((current: boolean): boolean => !current);
	}, []);

	return (
		<Button size="icon" variant="outline" aria-label={open ? "Close menu" : "Open menu"} aria-expanded={open} onClick={toggleOpen}>
			<span className="relative flex size-4 items-center justify-center">
				<MenuIcon aria-hidden="true" className={cn("absolute size-4 transition-all duration-200", open ? "scale-75 rotate-90 opacity-0" : "scale-100 rotate-0 opacity-100")} />
				<XIcon aria-hidden="true" className={cn("absolute size-4 transition-all duration-200", open ? "scale-100 rotate-0 opacity-100" : "scale-75 -rotate-90 opacity-0")} />
			</span>
		</Button>
	);
}
