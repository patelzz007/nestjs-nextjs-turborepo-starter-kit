import { RuleTester } from "oxlint/plugins-dev";
import { describe, it } from "vitest";

import { NAMING_CONVENTION } from "../base.js";
import { NESTJS_NAMING_CONVENTION } from "../nestjs.js";
import namingConvention from "../plugin/naming-convention.js";

RuleTester.describe = describe;
RuleTester.it = it;

const tester = new RuleTester();

/** A TypeScript case under the shared base naming convention. */
function base(code) {
	return { code, filename: "fixture.ts", options: NAMING_CONVENTION };
}

// Messages are @typescript-eslint/naming-convention's, byte for byte (the port was diffed against it).
tester.run("naming-convention (base convention)", namingConvention, {
	valid: [
		base("export interface OrderSummary { readonly totalCents: number }"),
		base("export const MAX_ITEMS = 3;"),
		base("export const OrderSchema = z.object({});"),
		base("export function buildOrder(): void {}"),
		base("export class Repository { private readonly _cache = new Map(); public loadAll(): void {} }"),
		base('export const headers = { "Content-Type": "json", _links: [], snake_case: 1 };'),
		base("export const handlers = { OnClick(): void {}, onHover(): void {} };"),
	],
	invalid: [
		{
			...base("export interface order_summary { readonly id: string }"),
			errors: [{ message: "Interface name `order_summary` must match one of the following formats: PascalCase" }],
		},
		{ ...base("export const max_items = 3;"), errors: [{ message: "Variable name `max_items` must match one of the following formats: camelCase, PascalCase, UPPER_CASE" }] },
		{ ...base("export function build_order(): void {}"), errors: [{ message: "Function name `build_order` must match one of the following formats: camelCase, PascalCase" }] },
		{ ...base("export class Repository { private readonly cache = new Map(); }"), errors: [{ message: "Class Property name `cache` must have one leading underscore(s)." }] },
		// No leadingUnderscore option: the underscore is not trimmed, so the name fails the format.
		{
			...base("export class Repository { public _loadAll(): void {} }"),
			errors: [{ message: "Class Method name `_loadAll` must match one of the following formats: camelCase" }],
		},
		{
			...base("export const handlers = { on_click(): void {} };"),
			errors: [{ message: "Object Literal Method name `on_click` must match one of the following formats: PascalCase, camelCase" }],
		},
	],
});

tester.run("naming-convention (NestJS convention)", namingConvention, {
	valid: [
		{
			code: "export class OrdersService { public constructor(private readonly ordersRepository: OrdersRepository) {} }",
			filename: "fixture.ts",
			options: NESTJS_NAMING_CONVENTION,
		},
	],
	invalid: [
		{
			code: "export class orders_service {}",
			filename: "fixture.ts",
			options: NESTJS_NAMING_CONVENTION,
			errors: [{ message: "Class name `orders_service` must match one of the following formats: PascalCase" }],
		},
	],
});
