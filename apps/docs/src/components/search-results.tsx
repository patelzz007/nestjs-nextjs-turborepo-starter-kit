import { CommandItem } from "@workspace/ui/components/command";
import { FileText, Hash } from "lucide-react";
import type { ReactElement } from "react";

import { highlightTerms } from "@/lib/highlight";
import type { SearchHit } from "@/lib/search";

export interface SearchResultProps {
	readonly hit: SearchHit;
	readonly terms: readonly string[];
	readonly onSelect: (href: string) => void;
}

/** One search result: a page or a heading, its context, and the excerpt around the match. */
export function SearchResult({ hit, terms, onSelect }: SearchResultProps): ReactElement {
	const { entry, excerpt } = hit;
	const Icon = entry.kind === "page" ? FileText : Hash;
	return (
		<CommandItem value={entry.href} onSelect={onSelect} className="items-start gap-3 py-2.5">
			<Icon aria-hidden="true" className="mt-0.5 size-4 shrink-0 text-muted-foreground" />
			<span className="grid min-w-0 gap-0.5">
				<span className="truncate font-medium text-foreground [&_mark]:rounded-sm [&_mark]:bg-(--docs-mark) [&_mark]:text-inherit">{highlightTerms(entry.title, terms)}</span>
				<span className="truncate text-xs text-muted-foreground">{entry.context}</span>
				{excerpt.length > 0 ? (
					<span className="line-clamp-2 text-xs text-(--docs-text-secondary) [&_mark]:rounded-sm [&_mark]:bg-(--docs-mark) [&_mark]:text-inherit">
						{highlightTerms(excerpt, terms)}
					</span>
				) : null}
			</span>
		</CommandItem>
	);
}
