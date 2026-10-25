/** The `workspace` oxlint JS plugin: the repo's custom rules. */
declare const plugin: {
	readonly meta: { readonly name: string };
	readonly rules: Readonly<Record<string, object>>;
};
export default plugin;
