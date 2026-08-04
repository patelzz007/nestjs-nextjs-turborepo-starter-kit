"use client";

import { BookOpen, Braces, Database, KeyRound, Network, Package, Rocket, ScrollText, Search, Shield, type LucideIcon } from "lucide-react";
import Link from "next/link";
import * as React from "react";

import { Card, CardContent } from "@workspace/ui/components/card";

import { DocsSearchBox } from "@/components/docs/docs-search-box";
import { highlightText } from "@/lib/highlight";
import { filterDocSummaries, formatIsoDate } from "@/lib/markdown";
import type { DocSummary } from "@/lib/docs";

/**
 * DocsIndex — the smart client half of `/docs`. The server page reads the
 * files and passes the summaries in via props (rules 9–11); this component
 * owns only the search query, filters the grid inline with the pure
 * `filterDocSummaries` helper (no page navigation, no separate search route),
 * and hands each filtered summary to the dumb `DocCard`.
 */

const DOC_ICONS: Readonly<Record<string, LucideIcon>> = {
	"getting-started": Rocket,
	architecture: Network,
	typescript: Braces,
	eslint: Shield,
	dependencies: Package,
	prisma: Database,
	"auth-roadmap": KeyRound,
	"boilerplate-roadmap": ScrollText,
	readme: BookOpen,
};

const MARK_CLASS_NAME = "rounded-sm bg-amber-200/60 px-0.5 font-semibold text-amber-800 dark:bg-amber-900/40 dark:text-amber-300";

interface DocCardProps {
	readonly doc: DocSummary;
	readonly query: string;
}

function DocCard({ doc, query }: DocCardProps): React.JSX.Element {
	const Icon = DOC_ICONS[doc.slug] ?? BookOpen;
	const hasQuery = query.trim().length > 0;

	return (
		<Link href={`/docs/${doc.slug}`} className="group focus:outline-none">
			<Card className="h-full transition-colors duration-200 group-hover:border-primary/40 group-focus-visible:ring-2 group-focus-visible:ring-primary/30">
				<CardContent className="flex h-full flex-col p-5">
					<div className="flex items-center gap-2.5">
						<span className="flex size-8 shrink-0 items-center justify-center rounded-lg bg-primary/10 text-primary">
							<Icon className="size-4" />
						</span>
						<h2 className="truncate font-medium text-foreground">{hasQuery ? highlightText(doc.title, query, MARK_CLASS_NAME) : doc.title}</h2>
					</div>
					<p className="mt-2.5 line-clamp-2 text-sm leading-relaxed text-muted-foreground">
						{hasQuery ? highlightText(doc.description, query, MARK_CLASS_NAME) : doc.description}
					</p>
					{doc.lastUpdated !== undefined ? <p className="mt-auto pt-3 text-[11px] text-muted-foreground/60">Updated {formatIsoDate(doc.lastUpdated)}</p> : null}
				</CardContent>
			</Card>
		</Link>
	);
}

export interface DocsIndexProps {
	readonly docs: readonly DocSummary[];
}

export function DocsIndex({ docs }: DocsIndexProps): React.JSX.Element {
	const [query, setQuery] = React.useState("");
	const filtered = React.useMemo(() => filterDocSummaries(docs, query), [docs, query]);
	const hasQuery = query.trim().length > 0;

	const handleQueryChange = React.useCallback((value: string): void => {
		setQuery(value);
	}, []);

	return (
		<div>
			<DocsSearchBox value={query} onChange={handleQueryChange} className="mb-6" />

			{hasQuery && filtered.length === 0 ? (
				<div className="flex flex-col items-center justify-center rounded-lg border border-dashed border-border py-16 text-center">
					<Search className="mb-3 size-7 text-muted-foreground/30" />
					<p className="text-sm font-medium text-foreground">No guides match “{query.trim()}”</p>
					<p className="mt-1 max-w-sm text-xs text-muted-foreground">Try a broader term — for example “database” instead of “DATABASE_URL”.</p>
				</div>
			) : null}

			<div className="grid gap-4 sm:grid-cols-2">
				{filtered.map((doc) => (
					<DocCard key={doc.slug} doc={doc} query={query} />
				))}
			</div>
		</div>
	);
}
