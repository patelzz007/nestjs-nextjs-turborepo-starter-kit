"use client";

import * as React from "react";

/**
 * ProseLink — the `a` element override. Marks external links (with a small
 * external icon + `noopener noreferrer`) and resolves cross-doc markdown links
 * (`./token-refresh.md` → `/docs/token-refresh`) so intra-doc navigation
 * survives the move from the raw markdown files.
 */
export interface ProseLinkProps extends React.AnchorHTMLAttributes<HTMLAnchorElement> {
	readonly href?: string;
}

export function ProseLink({ href, children, ...props }: ProseLinkProps): React.JSX.Element {
	const isExternal = (href?.startsWith("http") ?? false) || (href?.startsWith("mailto:") ?? false);
	const isMarkdownDoc = href?.endsWith(".md") ?? false;
	const docBasename =
		href
			?.replace(/\.md.*$/, "")
			.split("/")
			.pop() ?? "";
	const resolvedHref = isMarkdownDoc ? `/docs/${docBasename}` : href;

	return (
		<a
			href={resolvedHref}
			target={isExternal ? "_blank" : undefined}
			rel={isExternal ? "noopener noreferrer" : undefined}
			className="font-medium text-foreground underline decoration-border underline-offset-3 transition-[color,text-decoration-color] hover:text-primary hover:decoration-current"
			{...props}>
			{children}
			{isExternal ? (
				<svg
					className="-mt-0.5 ml-0.5 inline-block h-3 w-3"
					viewBox="0 0 24 24"
					fill="none"
					stroke="currentColor"
					strokeWidth="2.5"
					strokeLinecap="round"
					strokeLinejoin="round">
					<path d="M18 13v6a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2V8a2 2 0 0 1 2-2h6" />
					<polyline points="15 3 21 3 21 9" />
					<line x1="10" y1="14" x2="21" y2="3" />
				</svg>
			) : null}
		</a>
	);
}
