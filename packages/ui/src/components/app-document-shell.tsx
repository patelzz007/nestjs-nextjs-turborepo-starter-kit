import { cn } from "@workspace/ui/lib/core/utils";
import * as React from "react";

export interface AppDocumentShellProps {
	readonly lang?: string;
	readonly htmlClassName?: string;
	readonly bodyClassName?: string;
	readonly htmlProps?: Omit<React.ComponentProps<"html">, "lang" | "className" | "children" | "suppressHydrationWarning">;
	readonly bodyProps?: Omit<React.ComponentProps<"body">, "className" | "children" | "suppressHydrationWarning">;
	readonly children: React.ReactNode;
}

/** BCP 47 tag used when the app does not pass `lang`. */
const DEFAULT_DOCUMENT_LANG = "en";

/**
 * Root `<html>` / `<body>` wrapper for Next.js app layouts. The ref reaches
 * the `<html>` element.
 *
 * Both elements use `suppressHydrationWarning` because:
 * - `next-themes` mutates the `<html>` class before hydration.
 * - Browser extensions (ColorZilla, Grammarly, password managers, etc.) inject
 *   attributes onto `<body>` that are absent from the server HTML.
 */
export const AppDocumentShell = React.forwardRef<HTMLHtmlElement, AppDocumentShellProps>(function AppDocumentShell(
	{ lang = DEFAULT_DOCUMENT_LANG, htmlClassName, bodyClassName, htmlProps, bodyProps, children },
	ref,
): React.JSX.Element {
	return (
		<html ref={ref} lang={lang} suppressHydrationWarning className={cn(htmlClassName)} {...htmlProps}>
			<body className={cn(bodyClassName)} suppressHydrationWarning {...bodyProps}>
				{children}
			</body>
		</html>
	);
});
