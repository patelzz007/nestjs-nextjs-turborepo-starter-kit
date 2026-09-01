"use client";

import { Button } from "@workspace/ui/components/form/button";
import { cn } from "@workspace/ui/lib/utils";
import { Check, Copy } from "lucide-react";
import * as React from "react";
import { useCallback, useState } from "react";

/**
 * ProseHeading — the h2/h3/h4 overrides: anchor-friendly ids (stamped by the
 * fumadocs remark-heading plugin) with a hover-revealed "copy link" button.
 */
export interface ProseHeadingProps extends React.HTMLAttributes<HTMLHeadingElement> {
	readonly tag: "h2" | "h3" | "h4";
	readonly id?: string;
}

export function ProseHeading({ tag: Tag, id, children, className, ...props }: ProseHeadingProps): React.JSX.Element {
	return (
		<Tag
			id={id}
			className={cn(
				"group/heading flex scroll-mt-24 items-center gap-2 font-semibold tracking-tight text-balance text-foreground",
				Tag === "h2" && "mt-10 mb-3 text-2xl",
				Tag === "h3" && "mt-8 mb-2 text-lg",
				Tag === "h4" && "mt-6 mb-2 text-base",
				className,
			)}
			{...props}>
			<span className="min-w-0">{children}</span>
			{id !== undefined && id.length > 0 ? <CopyHeadingButton id={id} /> : null}
		</Tag>
	);
}

function CopyHeadingButton({ id }: { readonly id: string }): React.JSX.Element {
	const [copied, setCopied] = useState(false);

	const handleCopy = useCallback((): void => {
		const url = `${window.location.origin}${window.location.pathname}#${id}`;
		void navigator.clipboard
			.writeText(url)
			.then((): void => {
				setCopied(true);
				setTimeout((): void => {
					setCopied(false);
				}, 2000);
			})
			.catch((): void => {
				// Clipboard API unavailable — ignore.
			});
	}, [id]);

	return (
		<Button
			type="button"
			variant="ghost"
			size="icon-xs"
			onClick={handleCopy}
			className="h-6 w-6 opacity-0 transition-all duration-200 group-hover/heading:opacity-100 hover:bg-muted focus-visible:opacity-100"
			aria-label={`Copy link to ${id}`}
			title="Copy link to this section">
			{copied ? <Check className="h-3.5 w-3.5 text-emerald-500" /> : <Copy className="h-3.5 w-3.5 text-muted-foreground/40" />}
		</Button>
	);
}
