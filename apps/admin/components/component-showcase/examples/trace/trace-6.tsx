"use client";

import { ArrowUpRightIcon, GlobeIcon, SearchIcon } from "lucide-react";
import * as React from "react";

import { Badge } from "@workspace/ui/components/badge";
import { Trace, TraceCollapsible, TraceCollapsibleContent, TraceCollapsibleTrigger, TraceDescription, TraceIcon, TraceLine, TraceTitle } from "@workspace/ui/components/trace";
import { cn } from "@workspace/ui/lib/core/utils";

interface SearchQuery {
	readonly query: string;
	readonly results: number;
}

interface Source {
	readonly id: number;
	readonly title: string;
	readonly domain: string;
	readonly href: string;
}

const QUERIES: readonly SearchQuery[] = [
	{ query: "localStorage session token xss risk", results: 8 },
	{ query: "httponly cookie spa refresh token", results: 6 },
];

const SOURCES: readonly Source[] = [
	{
		id: 1,
		title: "Session management cheat sheet",
		domain: "owasp.org",
		href: "https://cheatsheetseries.owasp.org/cheatsheets/Session_Management_Cheat_Sheet.html",
	},
	{
		id: 2,
		title: "Window: localStorage property",
		domain: "developer.mozilla.org",
		href: "https://developer.mozilla.org/en-US/docs/Web/API/Window/localStorage",
	},
	{
		id: 3,
		title: "Set-Cookie header",
		domain: "developer.mozilla.org",
		href: "https://developer.mozilla.org/en-US/docs/Web/HTTP/Headers/Set-Cookie",
	},
	{
		id: 4,
		title: "OAuth 2.0 for browser-based apps",
		domain: "datatracker.ietf.org",
		href: "https://datatracker.ietf.org/doc/draft-ietf-oauth-browser-based-apps/",
	},
];

/** The source ids the answer cites, in reading order. */
const CITATION = { localStorageRisk: 1, localStorageApi: 2, setCookie: 3, browserApps: 4 };

/** Rendered as the citation badge's element, so it is a real button. */
const CITE_BUTTON = <button type="button" />;

// A citation opens the sources and moves focus to the row it cites.
export function Trace6Example(): React.JSX.Element {
	const [sourcesOpen, setSourcesOpen] = React.useState(false);
	const [cited, setCited] = React.useState<number | null>(null);
	const linkRefs = React.useRef(new Map<number, HTMLAnchorElement>());

	// The panel mounts its rows only once it is open, so focus waits a frame.
	const showSource = React.useCallback((id: number): void => {
		setSourcesOpen(true);
		setCited(id);
		window.requestAnimationFrame((): void => {
			linkRefs.current.get(id)?.focus();
		});
	}, []);

	const registerLink = React.useCallback((id: number, node: HTMLAnchorElement | null): void => {
		if (node === null) {
			linkRefs.current.delete(id);
			return;
		}
		linkRefs.current.set(id, node);
	}, []);

	const clearCited = React.useCallback((): void => {
		setCited(null);
	}, []);

	return (
		<div className="flex w-full max-w-md flex-col gap-4 text-sm">
			<Trace>
				<TraceCollapsible>
					<TraceCollapsibleTrigger>
						<TraceLine>
							<TraceIcon>
								<SearchIcon />
							</TraceIcon>
							<TraceTitle>Searched the web {QUERIES.length} times</TraceTitle>
						</TraceLine>
					</TraceCollapsibleTrigger>
					<TraceCollapsibleContent>
						<Trace>
							{QUERIES.map((item: SearchQuery): React.JSX.Element => (
								<TraceLine key={item.query}>
									<TraceTitle>{item.query}</TraceTitle>
									<TraceDescription>{item.results} results</TraceDescription>
								</TraceLine>
							))}
						</Trace>
					</TraceCollapsibleContent>
				</TraceCollapsible>
				<TraceCollapsible open={sourcesOpen} onOpenChange={setSourcesOpen}>
					<TraceCollapsibleTrigger>
						<TraceLine>
							<TraceIcon>
								<GlobeIcon />
							</TraceIcon>
							<TraceTitle>Read {SOURCES.length} sources</TraceTitle>
						</TraceLine>
					</TraceCollapsibleTrigger>
					<TraceCollapsibleContent>
						<Trace>
							{SOURCES.map((source: Source): React.JSX.Element => (
								<SourceLink key={source.id} source={source} isCited={cited === source.id} onRegister={registerLink} onLeave={clearCited} />
							))}
						</Trace>
					</TraceCollapsibleContent>
				</TraceCollapsible>
			</Trace>
			<p className="leading-relaxed text-pretty">
				No. Any XSS bug can read it
				<Cite id={CITATION.localStorageRisk} onSelect={showSource} />
				<Cite id={CITATION.localStorageApi} onSelect={showSource} />. Use an HttpOnly cookie
				<Cite id={CITATION.setCookie} onSelect={showSource} /> and keep access tokens in memory
				<Cite id={CITATION.browserApps} onSelect={showSource} />.
			</p>
		</div>
	);
}

interface SourceLinkProps {
	readonly source: Source;
	readonly isCited: boolean;
	readonly onRegister: (id: number, node: HTMLAnchorElement | null) => void;
	readonly onLeave: () => void;
}

function SourceLink({ source, isCited, onRegister, onLeave }: SourceLinkProps): React.JSX.Element {
	const { id } = source;
	const ref = React.useCallback(
		(node: HTMLAnchorElement | null): void => {
			onRegister(id, node);
		},
		[id, onRegister],
	);
	return (
		<a ref={ref} href={source.href} target="_blank" rel="noreferrer" onBlur={onLeave}>
			<TraceLine>
				<TraceTitle>
					{/* The cited source keeps full contrast until focus leaves it,
					    so a mouse click shows where it landed. */}
					<span className={cn(isCited && "text-foreground")}>
						{source.id}. {source.title}
					</span>
					<span className="sr-only"> (opens in a new tab)</span>
				</TraceTitle>
				<TraceDescription>{source.domain}</TraceDescription>
				<TraceIcon>
					<ArrowUpRightIcon />
				</TraceIcon>
			</TraceLine>
		</a>
	);
}

interface CiteProps {
	readonly id: number;
	readonly onSelect: (id: number) => void;
}

function Cite({ id, onSelect }: CiteProps): React.JSX.Element {
	const source = SOURCES.find((item: Source): boolean => item.id === id);
	const handleClick = React.useCallback((): void => {
		onSelect(id);
	}, [id, onSelect]);
	return (
		<Badge
			render={CITE_BUTTON}
			variant="secondary"
			radius="full"
			aria-label={`Source ${String(id)}: ${source?.title ?? ""}`}
			onClick={handleClick}
			className="ms-1 cursor-pointer align-middle">
			{id}
		</Badge>
	);
}
