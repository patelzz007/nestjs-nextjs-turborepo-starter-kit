import { Fragment, type ReactNode } from "react";

function escapeRegExp(value: string): string {
	return value.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");
}

/**
 * `text` with every query term wrapped in `<mark>` (case-insensitive), as React nodes. React escapes the
 * text, so neither the indexed text nor a term typed into the search box can ever inject markup.
 */
export function highlightTerms(text: string, terms: readonly string[]): readonly ReactNode[] {
	if (terms.length === 0) {
		return [text];
	}
	const pattern = new RegExp(`(${terms.map(escapeRegExp).join("|")})`, "gi");
	// `split` with a capture group alternates text and matches; each piece is keyed by where it starts in `text`.
	let offset = 0;
	return text.split(pattern).map((part, position) => {
		const key = `${String(offset)}:${String(part.length)}`;
		offset += part.length;
		return position % 2 === 1 ? <mark key={key}>{part}</mark> : <Fragment key={key}>{part}</Fragment>;
	});
}
