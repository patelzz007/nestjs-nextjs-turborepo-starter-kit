import { Button } from "@workspace/ui/components/button";
import { Moon, Sun } from "lucide-react";
import type { MouseEvent, ReactElement } from "react";

import { cycleTheme } from "@/browser/theme";

/**
 * Light ⇄ dark. The current theme's icon is picked by CSS from the class on <html>, so the
 * server-rendered button matches whatever theme the bootstrap applied before hydration.
 */
function onToggle(event: MouseEvent<HTMLButtonElement>): void {
	cycleTheme(event.currentTarget);
}

export function ThemeToggle(): ReactElement {
	return (
		<Button type="button" variant="ghost" size="icon-sm" title="Theme: light or dark" aria-label="Switch theme" onClick={onToggle}>
			<Sun aria-hidden="true" className="block dark:hidden" />
			<Moon aria-hidden="true" className="hidden dark:block" />
		</Button>
	);
}
