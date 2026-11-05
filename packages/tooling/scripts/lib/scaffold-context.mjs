/**
 * The bounded-context scaffolder behind `pnpm scaffold:context <name>` (enhancement 7.5): pure functions that
 * turn a context name into the files of a compiling application slice, laid out as rules/24 (golden reference)
 * and docs/architecture/ddd-cqrs-spec.md lay a context out. Tested in __tests__/scaffold-context.test.mjs; the
 * CLI (scripts/scaffold-context.mjs) only writes what this returns.
 *
 * What it writes (all under apps/api/src/contexts/<name>/):
 *   public-api.ts                                     the context's only import surface (its module)
 *   <name>.module.ts                                  the Nest module (CQRS), the reader bound to its token
 *   application/ports/<name>.reader.ts                the read port the query needs, and its token
 *   application/queries/get-<name>-summary/…          a real query + handler (counts, says whether empty)
 *   application/queries/get-<name>-summary/__tests__  the handler's tests against a fake reader (they pass)
 *
 * What it does NOT write, and prints as next steps instead (each needs a decision a template can't make):
 * the Prisma model and migration, RLS, the Prisma reader, the shared contract, the controller with its
 * permission mapping, and registering the module in the app module.
 */

/** A context name: lower-case words joined by single hyphens, starting with a letter. */
const CONTEXT_NAME = /^[a-z][a-z0-9]*(?:-[a-z][a-z0-9]*)*$/;
/** Names that would collide with the platform's own folders or read as nothing. */
const RESERVED = new Set(["platform", "shared", "common", "core", "test", "tests", "contexts"]);

/**
 * @param {string} name
 * @returns {{ kebab: string, pascal: string, camel: string, constant: string, words: string }}
 */
export function contextNames(name) {
	if (!CONTEXT_NAME.test(name)) {
		throw new Error(`A context name is lower-case words joined by hyphens, like "loyalty-tiers" (got "${name}")`);
	}
	if (RESERVED.has(name)) {
		throw new Error(`"${name}" is reserved`);
	}
	const parts = name.split("-");
	const pascal = parts.map((part) => `${part.charAt(0).toUpperCase()}${part.slice(1)}`).join("");
	return { kebab: name, pascal, camel: `${pascal.charAt(0).toLowerCase()}${pascal.slice(1)}`, constant: parts.join("_").toUpperCase(), words: parts.join(" ") };
}

/**
 * The files of a new context, path (relative to apps/api/src/contexts/<name>) → content.
 *
 * @param {string} name
 * @returns {Map<string, string>}
 */
export function contextFiles(name) {
	const n = contextNames(name);
	const query = `Get${n.pascal}SummaryQuery`;
	const handler = `Get${n.pascal}SummaryHandler`;
	const summary = `${n.pascal}Summary`;
	const reader = `${n.pascal}Reader`;
	const token = `${n.constant}_READER`;
	const queryDir = `application/queries/get-${n.kebab}-summary`;
	const files = new Map();

	files.set(
		"public-api.ts",
		`// The ${n.words} context's public surface: its module. Other contexts depend on what this file exports, not on
// its folders (rules/01, docs/architecture/context-map.md).
export { ${n.pascal}Module } from "./${n.kebab}.module";
`,
	);

	files.set(
		`application/ports/${n.kebab}.reader.ts`,
		`import type { ActorContext } from "../../../../platform/application/actor-context";

/**
 * What the ${n.words} context reads. Implemented in infrastructure/persistence on the actor's RLS transaction
 * (rules/24 §4: soft-delete aware, no N+1); a fake implements it in the tests.
 */
export interface ${reader} {
	/** How many live records the actor may see. */
	count(actor: ActorContext): Promise<number>;
}

export const ${token} = Symbol("${token}");
`,
	);

	files.set(
		`${queryDir}/get-${n.kebab}-summary.query.ts`,
		`import { Query } from "@nestjs/cqrs";

import type { ActorContext } from "../../../../../platform/application/actor-context";
import type { ${summary} } from "./get-${n.kebab}-summary.handler";

/** The ${n.words} summary for one actor. */
export class ${query} extends Query<${summary}> {
	public constructor(public readonly actor: ActorContext) {
		super();
	}
}
`,
	);

	files.set(
		`${queryDir}/get-${n.kebab}-summary.handler.ts`,
		`import { Inject } from "@nestjs/common";
import { QueryHandler, type IQueryHandler } from "@nestjs/cqrs";

import { ${token}, type ${reader} } from "../../ports/${n.kebab}.reader";
import { ${query} } from "./get-${n.kebab}-summary.query";

/** How many ${n.words} records the actor may see, and whether there are none yet. */
export interface ${summary} {
	readonly count: number;
	readonly isEmpty: boolean;
}

@QueryHandler(${query})
export class ${handler} implements IQueryHandler<${query}, ${summary}> {
	public constructor(@Inject(${token}) private readonly reader: ${reader}) {}

	public async execute({ actor }: ${query}): Promise<${summary}> {
		const count = await this.reader.count(actor);
		return { count, isEmpty: count === 0 };
	}
}
`,
	);

	files.set(
		`${queryDir}/__tests__/get-${n.kebab}-summary.handler.spec.ts`,
		`import { describe, expect, it } from "vitest";

import type { ActorContext } from "../../../../../../platform/application/actor-context";
import type { ${reader} } from "../../../ports/${n.kebab}.reader";
import { ${handler} } from "../get-${n.kebab}-summary.handler";
import { ${query} } from "../get-${n.kebab}-summary.query";

const ACTOR: ActorContext = { kind: "anonymous", tenantId: null, request: { requestId: "req-1", ip: "198.51.100.7", userAgent: "agent", deviceLabel: null, endpoint: null } };

/** A reader that answers a fixed count and remembers who asked. */
class FixedCountReader implements ${reader} {
	public readonly askedBy: ActorContext[] = [];

	public constructor(private readonly records: number) {}

	public count(actor: ActorContext): Promise<number> {
		this.askedBy.push(actor);
		return Promise.resolve(this.records);
	}
}

describe("${handler}", () => {
	it("counts what the actor may see, asking as that actor", async () => {
		const reader = new FixedCountReader(3);
		const summary = new ${handler}(reader).execute(new ${query}(ACTOR));
		await expect(summary).resolves.toStrictEqual({ count: 3, isEmpty: false });
		expect(reader.askedBy).toStrictEqual([ACTOR]);
	});

	it("says when there is nothing yet", async () => {
		const summary = new ${handler}(new FixedCountReader(0)).execute(new ${query}(ACTOR));
		await expect(summary).resolves.toStrictEqual({ count: 0, isEmpty: true });
	});
});
`,
	);

	files.set(
		`${n.kebab}.module.ts`,
		`import { Module } from "@nestjs/common";
import { CqrsModule } from "@nestjs/cqrs";

import { ${handler} } from "./${queryDir}/get-${n.kebab}-summary.handler";

/**
 * The ${n.words} context. Next: bind \`${token}\` to its Prisma reader (infrastructure/persistence), add the
 * controller (presentation/http) and register this module in the app module; \`pnpm scaffold:context\` printed
 * the full list.
 */
@Module({
	imports: [CqrsModule],
	providers: [${handler}],
})
export class ${n.pascal}Module {}
`,
	);

	return files;
}

/**
 * What is left to do by hand, in order, each pointing at the rule that says how.
 *
 * @param {string} name
 * @returns {string[]}
 */
export function nextSteps(name) {
	const n = contextNames(name);
	return [
		`Model the data in apps/api/prisma/schema.prisma (\`/// @extends BaseModel\`), then \`pnpm --filter @workspace/api db:migrate:create\` (rules/08, rules/24 §2)`,
		`Seed every new column (prisma/seed) and add RLS policies for the new tables (prisma/rls, rules/10 and rules/31)`,
		`Implement ${n.pascal}Reader in infrastructure/persistence/prisma-${n.kebab}.reader.ts and bind ${n.constant}_READER in ${n.kebab}.module.ts (rules/24 §4)`,
		`Add the shared contract in packages/shared/src/contexts/${n.kebab}/ (schemas, routes, contract; rules/05, rules/24 §1)`,
		`Add the controller in presentation/http with explicit permissions per endpoint (rules/10, rules/24 §6)`,
		`Register ${n.pascal}Module in apps/api/src/app.module.ts and add the context to docs/architecture/context-map.md`,
	];
}
