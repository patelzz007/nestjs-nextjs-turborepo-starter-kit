/**
 * Discriminated unions from a map of variants (rules/00: unions, not flag soup).
 *
 * Write each variant once, as `name → its own fields`, and `ToDiscoUnion` produces the
 * union where every member also carries its name in the discriminant (`type` by default,
 * or the key an existing union already uses):
 *
 *   type State = ToDiscoUnion<{ loading: object; error: { message: string }; complete: { name: string } }>;
 *   // → { readonly type: "loading" } | { readonly type: "error"; message: string } | { readonly type: "complete"; name: string }
 *
 * A variant with no fields of its own is `object`.
 */

/** Flattens an intersection into one object type, so hovers and errors show the real shape. */
export type Prettify<T> = { [K in keyof T]: T[K] };

/** The union of `T`'s variants, each tagged with its name under `Tag` (`type` unless given). */
export type ToDiscoUnion<T extends Record<string, object>, Tag extends string = "type"> = {
	[K in Extract<keyof T, string>]: Prettify<Readonly<Record<Tag, K>> & T[K]>;
}[Extract<keyof T, string>];
