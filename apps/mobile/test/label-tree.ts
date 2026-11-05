// A label pack read as a tree (src/features/language/__tests__/label-packs.test.ts): each leaf is a
// text or an interpolating function, each branch a group of named children — parsed with zod, so the
// test compares the languages' shapes without inspecting values by hand.

import { z } from "zod";

export type LabelTree =
	| { readonly kind: "text"; readonly value: string }
	| { readonly kind: "function" }
	| { readonly kind: "group"; readonly children: Readonly<Record<string, LabelTree>> };

export const LabelTreeSchema: z.ZodType<LabelTree> = z.lazy(() =>
	z.union([
		z.string().transform((value: string): LabelTree => ({ kind: "text", value })),
		z.instanceof(Function).transform((): LabelTree => ({ kind: "function" })),
		z.record(z.string(), LabelTreeSchema).transform((children: Readonly<Record<string, LabelTree>>): LabelTree => ({ kind: "group", children })),
	]),
);
