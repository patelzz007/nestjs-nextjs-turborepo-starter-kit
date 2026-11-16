// The shape of a showcase component's generated API reference
// (components/component-showcase/generated/api, written by `pnpm showcase:generate`).

export type ApiEntryKind = "component" | "hook" | "function";

/** One prop a component declares itself. */
export interface ApiProp {
	readonly name: string;
	readonly type: string;
	/** The default as source text (`"default"`, `false`), or `null` when there is none. */
	readonly defaultValue: string | null;
	readonly description: string;
	readonly required: boolean;
}

/** One export: a component with its props, or a hook / helper with its signature. */
export interface ApiEntry {
	readonly name: string;
	readonly kind: ApiEntryKind;
	/** The specifier to import it from, e.g. `@workspace/ui/components/code-block`. */
	readonly module: string;
	readonly description: string;
	readonly props: readonly ApiProp[];
	/** What else a component accepts, e.g. `Base UI button props`, `HTML attributes`. */
	readonly inherits: readonly string[];
	/** A hook's or helper's call signature; `null` for components. */
	readonly signature: string | null;
}
