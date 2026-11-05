import { useDebouncedValue } from "@tanstack/react-pacer";
import { InputGroup, InputGroupAddon, InputGroupInput } from "@workspace/ui/components/input-group";
import { Spinner } from "@workspace/ui/components/spinner";
import { FileText, Hash, Search } from "lucide-react";
import { useCallback, useEffect, useState, type ChangeEvent, type ReactElement, type SubmitEvent } from "react";

import { useSearchIndex } from "@/hooks/use-search-index";
import { highlightTerms } from "@/lib/highlight";
import { queryTerms, searchIndex } from "@/lib/search";

import { HrefLink } from "./href-link";
import { SEARCH_DEBOUNCE_MS } from "./search-provider";

/** Results on the full search page. */
export const PAGE_RESULT_LIMIT = 50;

export interface SearchPageProps {
	/** The search in the URL (`?q=`), so a search can be linked to and bookmarked. */
	readonly query: string;
	/** Writes the search back to the URL. */
	readonly onQueryChange: (query: string) => void;
}

function keepOnPage(event: SubmitEvent<HTMLFormElement>): void {
	event.preventDefault();
}

/** `/search?q=…`: every match, linkable. The box is debounced (Pacer) before the URL changes. */
export function SearchPage({ query, onQueryChange }: SearchPageProps): ReactElement {
	const [text, setText] = useState(query);
	const onChange = useCallback((event: ChangeEvent<HTMLInputElement>): void => {
		setText(event.target.value);
	}, []);
	const [debounced] = useDebouncedValue(text, { wait: SEARCH_DEBOUNCE_MS });
	const index = useSearchIndex(true);
	const terms = queryTerms(query);
	const hits = index.data === undefined ? [] : searchIndex(index.data, query, PAGE_RESULT_LIMIT);

	useEffect((): void => {
		if (debounced !== query) {
			onQueryChange(debounced);
		}
	}, [debounced, query, onQueryChange]);

	return (
		<main id="main-content" className="mx-auto max-w-3xl px-4 pt-10 pb-20 md:px-6">
			<h1 className="text-3xl font-semibold tracking-tight">Search</h1>
			<form role="search" className="mt-6" onSubmit={keepOnPage}>
				<label htmlFor="docs-search" className="sr-only">
					Search the docs
				</label>
				<InputGroup className="h-11">
					<InputGroupAddon>
						<Search aria-hidden="true" />
					</InputGroupAddon>
					<InputGroupInput id="docs-search" type="search" autoComplete="off" value={text} onChange={onChange} placeholder="Search guides, headings and posts" />
				</InputGroup>
			</form>
			<div aria-live="polite" className="mt-6">
				{index.isPending ? (
					<p role="status" className="flex items-center gap-2 text-sm text-muted-foreground">
						<Spinner />
						Loading the search index…
					</p>
				) : null}
				{index.isError ? <p className="text-sm text-destructive">Search is unavailable: the index did not load. Reload the page to try again.</p> : null}
				{index.isSuccess && terms.length === 0 ? <p className="text-sm text-muted-foreground">Type to search every guide, heading and blog post.</p> : null}
				{index.isSuccess && terms.length > 0 ? (
					<p className="text-sm text-muted-foreground">
						{hits.length === 0
							? `Nothing matches “${query}”. Try fewer or shorter words.`
							: `${String(hits.length)}${hits.length === PAGE_RESULT_LIMIT ? "+" : ""} results for “${query}”`}
					</p>
				) : null}
			</div>
			<ol className="mt-4 grid gap-1">
				{hits.map(({ entry, excerpt }) => (
					<li key={entry.href}>
						<HrefLink
							href={entry.href}
							className="grid grid-cols-[1.25rem_minmax(0,1fr)] gap-x-3 rounded-lg px-3 py-3 transition-colors hover:bg-(--docs-hover) focus-visible:ring-2 focus-visible:ring-ring focus-visible:outline-none [&_mark]:rounded-sm [&_mark]:bg-(--docs-mark) [&_mark]:text-inherit">
							{entry.kind === "page" ? (
								<FileText aria-hidden="true" className="mt-0.5 size-4 text-muted-foreground" />
							) : (
								<Hash aria-hidden="true" className="mt-0.5 size-4 text-muted-foreground" />
							)}
							<span className="font-medium">{highlightTerms(entry.title, terms)}</span>
							<span className="col-start-2 text-xs text-muted-foreground">{entry.context}</span>
							{excerpt.length > 0 ? <span className="col-start-2 mt-1 text-sm text-(--docs-text-secondary)">{highlightTerms(excerpt, terms)}</span> : null}
						</HrefLink>
					</li>
				))}
			</ol>
		</main>
	);
}
