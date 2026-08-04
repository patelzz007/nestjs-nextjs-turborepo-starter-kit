import * as React from "react";

/**
 * Wraps every occurrence of `query` inside `text` in a highlighted `<mark>`.
 * Used by both the sidebar search and the command palette so the matching
 * logic lives in exactly one place.
 */
export function highlightText(text: string, query: string, markClassName: string): React.ReactNode {
	const trimmedQuery = query.trim();
	if (trimmedQuery.length === 0) {
		return text;
	}

	const escapedQuery = trimmedQuery.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");
	const regex = new RegExp(`(${escapedQuery})`, "gi");
	const nodes: React.ReactNode[] = [];
	let lastIndex = 0;
	let keyCounter = 0;
	let match: RegExpExecArray | null;

	while ((match = regex.exec(text)) !== null) {
		const matchIndex = match.index;
		if (matchIndex > lastIndex) {
			nodes.push(<React.Fragment key={keyCounter}>{text.slice(lastIndex, matchIndex)}</React.Fragment>);
			keyCounter += 1;
		}
		nodes.push(
			<mark key={keyCounter} className={markClassName}>
				{match[0]}
			</mark>,
		);
		keyCounter += 1;
		lastIndex = matchIndex + match[0].length;
	}

	if (lastIndex < text.length) {
		nodes.push(<React.Fragment key={keyCounter}>{text.slice(lastIndex)}</React.Fragment>);
	}

	return nodes.length > 0 ? nodes : text;
}
