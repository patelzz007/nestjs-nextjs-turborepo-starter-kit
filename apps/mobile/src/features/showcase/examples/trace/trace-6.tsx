import { Trace, TraceLine, TraceStep } from "@workspace/ui-native/components/trace";
import ArrowUpRightIcon from "lucide-react-native/icons/arrow-up-right";
import GlobeIcon from "lucide-react-native/icons/globe";
import SearchIcon from "lucide-react-native/icons/search";
import * as React from "react";
import { Linking, Text, View } from "react-native";

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
	{ id: 1, title: "Session management cheat sheet", domain: "owasp.org", href: "https://cheatsheetseries.owasp.org/cheatsheets/Session_Management_Cheat_Sheet.html" },
	{ id: 2, title: "Window: localStorage property", domain: "developer.mozilla.org", href: "https://developer.mozilla.org/en-US/docs/Web/API/Window/localStorage" },
	{ id: 3, title: "Set-Cookie header", domain: "developer.mozilla.org", href: "https://developer.mozilla.org/en-US/docs/Web/HTTP/Headers/Set-Cookie" },
	{ id: 4, title: "OAuth 2.0 for browser-based apps", domain: "datatracker.ietf.org", href: "https://datatracker.ietf.org/doc/draft-ietf-oauth-browser-based-apps/" },
];

/** The source ids the answer cites, in reading order. */
const CITATION = { localStorageRisk: 1, localStorageApi: 2, setCookie: 3, browserApps: 4 };

function SourceLink({ source, isCited }: { readonly source: Source; readonly isCited: boolean }): React.JSX.Element {
	const open = React.useCallback((): void => {
		Linking.openURL(source.href).catch((): void => {
			// No browser could open it: the row stays as it is.
		});
	}, [source.href]);
	// The cited source is marked until another citation is chosen, so the reader sees where it landed.
	return (
		<TraceLine
			title={`${String(source.id)}. ${source.title}`}
			description={source.domain}
			trailingIcon={ArrowUpRightIcon}
			accessibilityRole="link"
			accessibilityLabel={`${source.title}, ${source.domain}, opens in the browser`}
			onPress={open}
			className={isCited ? "bg-surface-selected rounded-md px-1" : undefined}
		/>
	);
}

/** A citation: a pill inside the answer's text that opens the sources at the one it cites. */
function Cite({ id, onSelect }: { readonly id: number; readonly onSelect: (id: number) => void }): React.JSX.Element {
	const source = SOURCES.find((item: Source): boolean => item.id === id);
	const press = React.useCallback((): void => {
		onSelect(id);
	}, [id, onSelect]);
	return (
		<Text
			accessibilityRole="button"
			accessibilityLabel={`Source ${String(id)}: ${source?.title ?? ""}`}
			onPress={press}
			className="text-caption font-sans-medium text-muted-foreground">
			{` [${String(id)}]`}
		</Text>
	);
}

// A citation opens the sources and marks the row it cites.
export function Trace6Example(): React.JSX.Element {
	const [sourcesOpen, setSourcesOpen] = React.useState(false);
	const [cited, setCited] = React.useState<number | null>(null);
	const showSource = React.useCallback((id: number): void => {
		setSourcesOpen(true);
		setCited(id);
	}, []);
	return (
		<View className="gap-4">
			<Trace>
				<TraceStep icon={SearchIcon} title={`Searched the web ${String(QUERIES.length)} times`}>
					<Trace>
						{QUERIES.map((item: SearchQuery): React.JSX.Element => (
							<TraceLine key={item.query} title={item.query} description={`${String(item.results)} results`} />
						))}
					</Trace>
				</TraceStep>
				<TraceStep icon={GlobeIcon} title={`Read ${String(SOURCES.length)} sources`} open={sourcesOpen} onOpenChange={setSourcesOpen}>
					<Trace>
						{SOURCES.map((source: Source): React.JSX.Element => (
							<SourceLink key={source.id} source={source} isCited={cited === source.id} />
						))}
					</Trace>
				</TraceStep>
			</Trace>
			<Text className="text-body font-sans text-foreground">
				No. Any XSS bug can read it
				<Cite id={CITATION.localStorageRisk} onSelect={showSource} />
				<Cite id={CITATION.localStorageApi} onSelect={showSource} />. Use an HttpOnly cookie
				<Cite id={CITATION.setCookie} onSelect={showSource} /> and keep access tokens in memory
				<Cite id={CITATION.browserApps} onSelect={showSource} />.
			</Text>
		</View>
	);
}
