import { Autocomplete, type AutocompleteItem } from "@workspace/ui-native/components/autocomplete";
import * as React from "react";

const DEVELOPERS: readonly string[] = ["Ada Lovelace", "Alan Turing", "Barbara Liskov", "Donald Knuth", "Grace Hopper", "Ken Thompson", "Linus Torvalds", "Margaret Hamilton"];
/** How long the sample lookup takes, in ms. */
const LOOKUP_MS = 400;

interface DeveloperSearch {
	readonly results: readonly AutocompleteItem[];
	readonly status: string | undefined;
}

/** A sample lookup: the matches arrive a moment after the query, as a server's would. */
function useDeveloperSearch(query: string): DeveloperSearch {
	const [results, setResults] = React.useState<readonly AutocompleteItem[]>([]);
	const [settledQuery, setSettledQuery] = React.useState<string>("");
	React.useEffect((): (() => void) => {
		const timer = setTimeout((): void => {
			const folded = query.trim().toLowerCase();
			setResults(DEVELOPERS.filter((name: string): boolean => name.toLowerCase().includes(folded)).map((name: string): AutocompleteItem => ({ value: name })));
			setSettledQuery(query);
		}, LOOKUP_MS);
		return (): void => {
			clearTimeout(timer);
		};
	}, [query]);
	if (query.trim().length === 0) {
		return { results: [], status: undefined };
	}
	return settledQuery === query ? { results, status: `${String(results.length)} results` } : { results: [], status: "Searching…" };
}

export function Autocomplete9Example(): React.JSX.Element {
	const [query, setQuery] = React.useState<string>("");
	const { results, status } = useDeveloperSearch(query);
	return (
		<Autocomplete value={query} onChange={setQuery} items={results} filter={null} status={status} showClear placeholder="Search developers…" accessibilityLabel="Developer" />
	);
}
