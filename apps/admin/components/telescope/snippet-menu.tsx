"use client";

// ============================================
// components/telescope/snippet-menu.tsx
// Feature 16 — cURL/SDK export. A small dropdown that copies the request as a
// cURL / fetch / axios snippet. The snippet text is built by the parent via
// lib/telescope.buildRequestSnippet (data stays in the smart component).
// ============================================

import { Braces, Check, ChevronDown, Copy } from "lucide-react";
import { useCallback, useEffect, useRef, useState } from "react";

import { snippetFormatLabel, type RequestSnippetFormat } from "@/lib/telescope";

export const SNIPPET_FORMATS: readonly RequestSnippetFormat[] = ["curl", "fetch", "axios"];

export interface SnippetMenuProps {
	readonly onCopy: (format: RequestSnippetFormat) => Promise<void>;
}

export function SnippetMenu({ onCopy }: SnippetMenuProps): React.JSX.Element {
	const [open, setOpen] = useState<boolean>(false);
	const [copied, setCopied] = useState<RequestSnippetFormat | null>(null);
	const menuRef = useRef<HTMLDivElement | null>(null);

	useEffect((): (() => void) => {
		const onClickOutside = (event: MouseEvent): void => {
			if (menuRef.current !== null && event.target instanceof Node && !menuRef.current.contains(event.target)) {
				setOpen(false);
			}
		};
		document.addEventListener("mousedown", onClickOutside);
		return (): void => {
			document.removeEventListener("mousedown", onClickOutside);
		};
	}, []);

	const handleCopy = useCallback(
		async (format: RequestSnippetFormat): Promise<void> => {
			await onCopy(format);
			setCopied(format);
			setOpen(false);
			window.setTimeout((): void => {
				setCopied(null);
			}, 1500);
		},
		[onCopy],
	);

	return (
		<div ref={menuRef} className="relative">
			<button
				type="button"
				onClick={(): void => {
					setOpen((current: boolean): boolean => !current);
				}}
				className="inline-flex h-7 items-center gap-1.5 rounded-md border px-2.5 text-xs font-medium text-foreground transition-colors hover:bg-accent"
				title="Copy as cURL / fetch / axios">
				<Braces className="size-3" />
				Copy snippet
				<ChevronDown className="size-3 text-muted-foreground" />
			</button>

			{open ? (
				<div className="absolute right-0 z-20 mt-1 w-40 overflow-hidden rounded-md border bg-popover p-1 shadow-md">
					{SNIPPET_FORMATS.map((format) => (
						<button
							key={format}
							type="button"
							onClick={(): void => {
								void handleCopy(format);
							}}
							className="flex w-full items-center gap-2 rounded px-2 py-1.5 text-xs text-popover-foreground transition-colors hover:bg-accent">
							{copied === format ? <Check className="size-3 text-emerald-500" /> : <Copy className="size-3 text-muted-foreground" />}
							{snippetFormatLabel(format)}
						</button>
					))}
				</div>
			) : null}
		</div>
	);
}
