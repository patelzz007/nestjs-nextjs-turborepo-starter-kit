import { useRouter } from "@tanstack/react-router";
import { useCallback, type AnchorHTMLAttributes, type MouseEvent, type ReactElement } from "react";

export interface HrefLinkProps extends Omit<AnchorHTMLAttributes<HTMLAnchorElement>, "href"> {
	/** A site path, optionally with `#section` (`/docs/database#seed-data`). */
	readonly href: string;
}

/** Whether a click should stay with the browser (new tab, new window, download, another button). */
export function isModifiedClick(event: Pick<MouseEvent, "button" | "metaKey" | "ctrlKey" | "shiftKey" | "altKey" | "defaultPrevented">): boolean {
	return event.defaultPrevented || event.button !== 0 || event.metaKey || event.ctrlKey || event.shiftKey || event.altKey;
}

/**
 * A link to a site path computed at run time (search results, previous / next), where the typed router
 * `Link` cannot name the route. A real `<a href>` — new tab and copy-link work — whose plain clicks the
 * router handles, so navigation stays client-side.
 */
export function HrefLink({ href, onClick, children, ...props }: HrefLinkProps): ReactElement {
	const router = useRouter();
	const navigate = useCallback(
		(event: MouseEvent<HTMLAnchorElement>): void => {
			onClick?.(event);
			if (isModifiedClick(event)) {
				return;
			}
			event.preventDefault();
			void router.navigate({ href });
		},
		[href, onClick, router],
	);
	return (
		<a {...props} href={href} onClick={navigate}>
			{children}
		</a>
	);
}
