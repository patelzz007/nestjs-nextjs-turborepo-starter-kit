import { CodeBlock, type CodeBlockLine, type CodeBlockToken } from "@workspace/ui-native/components/code-block";
import * as React from "react";

import { SHOWCASE_CODE } from "./generated/code";
import { decodeHighlightedCode, type CodeToken, type HighlightedCode } from "./showcase-code";
import { useCopyText } from "./showcase-copy";

/** Lines a code view shows before "Show all" (the web's `COLLAPSED_LINES`). */
export const COLLAPSED_LINES = 24;
/** The language every example is written in. */
const LANGUAGE = "TSX";
const EXAMPLE_EXTENSION = ".tsx";

/** A component's coloured examples, once loaded (shared by every code view of the component). */
const loadedCode = new Map<string, Promise<ReadonlyMap<string, HighlightedCode>>>();

/** A component's coloured examples, loaded the first time one of its code views opens. */
export function loadHighlightedCode(slug: string): Promise<ReadonlyMap<string, HighlightedCode>> {
	const cached = loadedCode.get(slug);
	if (cached !== undefined) {
		return cached;
	}
	const load = SHOWCASE_CODE.get(slug);
	const loading = load === undefined ? Promise.resolve(new Map<string, HighlightedCode>()) : load();
	loadedCode.set(slug, loading);
	return loading;
}

/** The generator's compact colouring as the kit's code lines. */
export function codeLinesOf(highlighted: HighlightedCode): readonly CodeBlockLine[] {
	return decodeHighlightedCode(highlighted).map((line: readonly CodeToken[]): CodeBlockLine => line.map(({ role, text }: CodeToken): CodeBlockToken => ({ text, role })));
}

/** One example's coloured lines: `undefined` until they load (the code shows uncoloured meanwhile). */
function useHighlightedLines(slug: string, file: string): readonly CodeBlockLine[] | undefined {
	const [lines, setLines] = React.useState<readonly CodeBlockLine[] | undefined>(undefined);
	React.useEffect((): (() => void) => {
		let active = true;
		loadHighlightedCode(slug)
			.then((code: ReadonlyMap<string, HighlightedCode>): void => {
				const highlighted = code.get(file);
				if (active && highlighted !== undefined) {
					setLines(codeLinesOf(highlighted));
				}
			})
			.catch((): void => {
				// The colouring could not load: the code stays readable, uncoloured.
			});
		return (): void => {
			active = false;
		};
	}, [file, slug]);
	return lines;
}

export interface FeatureCodeProps {
	/** The component the example belongs to (whose coloured code to load). */
	readonly slug: string;
	/** The example's file name, without `.tsx`. */
	readonly file: string;
	/** The example's exact source. */
	readonly source: string;
	readonly testID?: string | undefined;
}

/** The exact source of one example, coloured, numbered, copyable, folded past `COLLAPSED_LINES` lines. */
export function FeatureCode({ slug, file, source, testID }: FeatureCodeProps): React.JSX.Element {
	const code = source.replace(/\n$/u, "");
	const lines = useHighlightedLines(slug, file);
	const { copied, copy } = useCopyText(code);
	return (
		<CodeBlock
			code={code}
			lines={lines}
			language={LANGUAGE}
			caption={`${file}${EXAMPLE_EXTENSION}`}
			onCopy={copy}
			copied={copied}
			showLineNumbers
			maxLines={COLLAPSED_LINES}
			variant="card"
			size="sm"
			testID={testID}
		/>
	);
}
