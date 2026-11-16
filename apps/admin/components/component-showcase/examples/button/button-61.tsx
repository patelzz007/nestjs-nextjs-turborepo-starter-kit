"use client";

import * as React from "react";
import { MoonIcon, SunIcon } from "lucide-react";
import { useCallback, useState } from "react";

import { cn } from "@workspace/ui/lib/core/utils";
import { Button } from "@workspace/ui/components/button";

export function Button61Example(): React.JSX.Element {
	const [theme, setTheme] = useState<"light" | "dark">("light");
	const toggleTheme = useCallback((): void => {
		setTheme((current: "light" | "dark"): "light" | "dark" => (current === "light" ? "dark" : "light"));
	}, []);

	return (
		<Button variant="outline" size="icon" onClick={toggleTheme} aria-label={`Switch to ${theme === "dark" ? "light" : "dark"} mode`}>
			<SunIcon className={cn("size-4 transition-all duration-300", theme === "dark" ? "scale-0 -rotate-90 opacity-0" : "scale-100 rotate-0 opacity-100")} />
			<MoonIcon className={cn("absolute size-4 transition-all duration-300", theme === "dark" ? "scale-100 rotate-0 opacity-100" : "scale-0 rotate-90 opacity-0")} />
			<span className="sr-only">Toggle theme</span>
		</Button>
	);
}
