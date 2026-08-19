"use client";

import { Command as CommandPrimitive } from "cmdk";
import { FileText, Search, SearchX } from "lucide-react";
import { useRouter } from "next/navigation";
import { useCallback, useEffect, useMemo, useRef } from "react";
import { useDocsSearch } from "fumadocs-core/search/client";
import { fetchClient } from "fumadocs-core/search/client/fetch";
import type { SearchItemType } from "fumadocs-ui/components/dialog/search";
import type { DefaultSearchDialogProps } from "fumadocs-ui/components/dialog/search-default";

import { Command, CommandDialog, CommandEmpty, CommandGroup, CommandItem, CommandList } from "@workspace/ui/components/overlay/command";

import { useSearchMeta } from "@/components/search-meta-context";

/**
 * Docs command palette — visual twin of the admin panel's palette (cmdk
 * primitives, rounded input row, icon tiles, kbd-hint footer). Search runs
 * through the local `/api/search` endpoint (description-rich results); the
 * per-page description map comes from context so nothing fetches during static
 * generation. Registered on the fumadocs `SearchProvider` via `SearchDialog`,
 * so the navbar ⌘K trigger and open state stay untouched.
 */
export function DocsSearchDialog({ api = "/api/search", delayMs = 500, links = [], open, onOpenChange }: DefaultSearchDialogProps): React.JSX.Element {
	const router = useRouter();
	const inputRef = useRef<HTMLInputElement | null>(null);
	const meta = useSearchMeta();

	const client = fetchClient({ api });
	const { search, setSearch, query } = useDocsSearch({ client, delayMs });

	const isSearching = search.trim().length > 0;

	/* Focus the input when opened. */
	useEffect(() => {
		if (open) {
			requestAnimationFrame(() => {
				inputRef.current?.focus();
			});
		}
	}, [open]);

	const defaultItems = useMemo((): readonly SearchItemType[] => {
		if (links.length === 0) {
			return [];
		}
		return links.map(([name, href]) => ({ type: "page", id: name, content: name, url: href }));
	}, [links]);

	const items: readonly SearchItemType[] = query.data !== "empty" && query.data !== undefined ? query.data : defaultItems;

	const handleSelect = useCallback(
		(value: string): void => {
			onOpenChange(false);
			router.push(value);
		},
		[onOpenChange, router],
	);

	const handleClearSearch = useCallback((): void => {
		setSearch("");
		inputRef.current?.focus();
	}, [setSearch]);

	return (
		<CommandDialog open={open} onOpenChange={onOpenChange} title="Search documentation" description="Find pages and headings in the docs" className="h-[65dvh] sm:max-w-2xl">
			<Command shouldFilter={false}>
				{/* Search input */}
				<div className="px-4 pt-3 pb-2">
					<div className="flex items-center gap-2 rounded-xl border border-border/60 bg-background px-3.5 py-2.5 shadow-sm transition-all focus-within:border-primary/30 focus-within:ring-2 focus-within:ring-primary/10">
						<Search className="size-4 shrink-0 text-muted-foreground/50 dark:text-muted-foreground/60" />

						<CommandPrimitive.Input
							ref={inputRef}
							placeholder="Search the docs…"
							value={search}
							onValueChange={setSearch}
							className="flex-1 bg-transparent text-sm text-foreground outline-hidden placeholder:text-muted-foreground/50 dark:placeholder:text-muted-foreground/40"
						/>

						{!isSearching ? (
							<kbd className="hidden h-5 items-center gap-0.5 rounded-md bg-accent/30 px-1.5 font-mono text-[10px] font-medium text-muted-foreground/50 sm:inline-flex dark:text-muted-foreground/60">
								⌘K
							</kbd>
						) : null}
					</div>
				</div>

				<CommandList className="max-h-none min-h-0 flex-1">
					{items.length > 0 ? (
						<CommandGroup>
							{items.map((item) => {
								if (item.type === "action") {
									return <div key={item.id}>{item.node}</div>;
								}
								const entry = meta[item.url];
								const title = typeof item.content === "string" ? item.content : item.id;
								return (
									<CommandItem
										key={item.id}
										value={item.url}
										onSelect={handleSelect}
										className="flex items-center justify-between rounded-xl px-4 py-2.5 data-selected:bg-accent/40">
										<div className="flex min-w-0 flex-1 items-center gap-3">
											<div className="flex size-8 shrink-0 items-center justify-center rounded-xl bg-accent/20 text-muted-foreground">
												<FileText className="size-4" />
											</div>
											<div className="min-w-0 flex-1">
												<div className="truncate text-sm leading-tight font-medium" dangerouslySetInnerHTML={{ __html: title }} />
												{entry !== undefined && entry.description.length > 0 ? (
													<p className="mt-0.5 line-clamp-2 text-xs text-muted-foreground/60">{entry.description}</p>
												) : null}
											</div>
										</div>
									</CommandItem>
								);
							})}
						</CommandGroup>
					) : (
						<CommandEmpty>
							<div className="flex flex-col items-center gap-4 py-10">
								<div className="flex size-14 items-center justify-center rounded-2xl bg-accent/20">
									<SearchX className="size-6 text-muted-foreground/40" />
								</div>
								<div className="max-w-60 text-center">
									<p className="text-sm font-medium text-foreground">No results found</p>
									<p className="mt-1 text-xs leading-relaxed text-muted-foreground/60">
										Try adjusting your search terms or{" "}
										<button type="button" onClick={handleClearSearch} className="text-primary underline underline-offset-2 hover:no-underline">
											clear the filter
										</button>{" "}
										to browse all pages
									</p>
								</div>
							</div>
						</CommandEmpty>
					)}
				</CommandList>

				{/* Footer — keyboard hints */}
				<div className="flex items-center justify-center gap-5 border-t border-border/40 bg-accent/2 px-4 py-2.5">
					<span className="flex items-center gap-1.5 text-[10px] text-muted-foreground/50 dark:text-muted-foreground/60">
						<kbd className="inline-flex h-4 min-w-4.5 items-center justify-center rounded-md bg-accent/30 px-1 font-mono text-[9px] font-medium text-muted-foreground/50 dark:text-muted-foreground/60">
							↑↓
						</kbd>
						<span>navigate</span>
					</span>
					<span className="flex items-center gap-1.5 text-[10px] text-muted-foreground/50 dark:text-muted-foreground/60">
						<kbd className="inline-flex h-4 min-w-4.5 items-center justify-center rounded-md bg-accent/30 px-1 font-mono text-[9px] font-medium text-muted-foreground/50 dark:text-muted-foreground/60">
							↵
						</kbd>
						<span>open</span>
					</span>
					<span className="flex items-center gap-1.5 text-[10px] text-muted-foreground/50 dark:text-muted-foreground/60">
						<kbd className="inline-flex h-4 min-w-4.5 items-center justify-center rounded-md bg-accent/30 px-1 font-mono text-[9px] font-medium text-muted-foreground/50 dark:text-muted-foreground/60">
							esc
						</kbd>
						<span>close</span>
					</span>
				</div>
			</Command>
		</CommandDialog>
	);
}
