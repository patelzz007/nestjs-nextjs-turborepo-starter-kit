"use client";

import { Button } from "@workspace/ui/components/button";
import { DropdownMenu, DropdownMenuContent, DropdownMenuRadioGroup, DropdownMenuRadioItem, DropdownMenuTrigger } from "@workspace/ui/components/dropdown-menu";
import { useUiKitLabels, useUiKitLanguage } from "@workspace/ui/components/ui-kit-labels-provider";
import { UI_KIT_LANGUAGE_NAMES, UI_KIT_LANGUAGES, UiKitLanguageSchema } from "@workspace/ui/lib/labels/language-packs";
import { cn } from "@workspace/ui/lib/core/utils";
import { Languages } from "lucide-react";
import * as React from "react";

export interface ShellLanguageToggleProps extends Omit<React.ComponentProps<typeof Button>, "children" | "ref"> {
	/** Per-usage accessible name of the menu button; defaults to the `shellLanguageToggle` family's `toggle`. */
	readonly label?: string;
}

/**
 * Language menu for app shells (ADR 076), beside the theme menu: each shipped language, named in itself.
 * Data-agnostic: it reads the language from `UiKitLanguageProvider` and reports a choice through the
 * provider's `onLanguageChange`. Renders nothing when the app gave no way to change language.
 */
export function ShellLanguageToggle({ label, className, variant = "ghost", size = "icon", ...props }: ShellLanguageToggleProps): React.JSX.Element | null {
	const labels = useUiKitLabels("shellLanguageToggle");
	const state = useUiKitLanguage();
	const choose = state?.chooseLanguage ?? null;
	const handleValueChange = React.useCallback(
		(value: string): void => {
			const parsed = UiKitLanguageSchema.safeParse(value);
			if (parsed.success && choose !== null) {
				choose(parsed.data);
			}
		},
		[choose],
	);
	if (state === null || choose === null) {
		return null;
	}
	return (
		<DropdownMenu>
			<DropdownMenuTrigger
				render={<Button variant={variant} size={size} className={cn("rounded-full", className)} />}
				data-slot="shell-language-toggle"
				aria-label={label ?? labels.toggle}
				{...props}>
				<Languages className="size-5" aria-hidden="true" />
			</DropdownMenuTrigger>
			<DropdownMenuContent align="end" className="min-w-40">
				<DropdownMenuRadioGroup value={state.language} onValueChange={handleValueChange}>
					{UI_KIT_LANGUAGES.map((language) => (
						<DropdownMenuRadioItem key={language} value={language} highlight="soft" lang={language}>
							{UI_KIT_LANGUAGE_NAMES[language]}
						</DropdownMenuRadioItem>
					))}
				</DropdownMenuRadioGroup>
			</DropdownMenuContent>
		</DropdownMenu>
	);
}
