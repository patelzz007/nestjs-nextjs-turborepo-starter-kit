// The shape of a showcase component's generated API reference
// (features/showcase/generated/api, written by the showcase generator).

export type ApiEntryKind = "component" | "hook" | "function";

/** One prop a component declares itself. */
export interface ApiProp {
	readonly name: string;
	readonly type: string;
	/** The default as source text (`"md"`, `false`), or `null` when there is none. */
	readonly defaultValue: string | null;
	readonly description: string;
	readonly required: boolean;
}

/** One export: a component with its props, or a hook / helper with its signature. */
export interface ApiEntry {
	readonly name: string;
	readonly kind: ApiEntryKind;
	/** The specifier to import it from, e.g. `@workspace/ui-native/components/code-block`. */
	readonly module: string;
	readonly description: string;
	readonly props: readonly ApiProp[];
	/** What else a component accepts, e.g. `React Native view props`. */
	readonly inherits: readonly string[];
	/** A hook's or helper's call signature; `null` for components. */
	readonly signature: string | null;
}
