/**
 * `no-restricted-syntax` selectors for type safety (rules/00), runtime validation
 * (rules/28) and array-index readability (rules/27). Applied to every TypeScript file.
 */

const TYPE_SAFETY_SELECTORS = [
	{
		selector: "TSAsExpression > TSTypeReference.typeAnnotation[typeName.name='const']",
		message: "`as const` is banned (rules/00-non-negotiables.md). Declare the literal type explicitly: a typed tuple, an explicit union, or `satisfies`.",
	},
	{
		selector: "TSTypeAssertion > TSTypeReference.typeAnnotation[typeName.name='const']",
		message: "`<const>` assertions are banned (rules/00-non-negotiables.md). Declare the literal type explicitly instead.",
	},
	{
		selector: "CallExpression[callee.type='MemberExpression'][callee.object.name='z'][callee.property.name=/^(any|unknown|never)$/]",
		message: "`z.any()` / `z.unknown()` / `z.never()` are banned (rules/00-non-negotiables.md). Describe the real shape with a precise schema.",
	},
	// An argumentless `z.custom<T>()` accepts EVERYTHING and only claims type T:
	// a hidden cast. Give it a real predicate, or use a real schema.
	{
		selector: "CallExpression[callee.type='MemberExpression'][callee.object.name='z'][callee.property.name='custom'][arguments.length=0]",
		message:
			"`z.custom<T>()` without a predicate is an unchecked cast (rules/00-non-negotiables.md). Pass a type-guard predicate, `z.instanceof(Class)`, or a real schema (e.g. `DataValueSchema`).",
	},
	// React-query cache keys come from the endpoint registry (`apiRouter.…scopeKey()` / `.queryKey()`),
	// never from a hand-typed array: a literal key silently stops matching when the real key changes.
	{
		selector:
			"CallExpression[callee.property.name=/^(invalidateQueries|removeQueries|refetchQueries|cancelQueries|resetQueries|setQueryData|getQueryData|getQueriesData|setQueriesData|isFetching)$/] > ObjectExpression > Property[key.name='queryKey'] > ArrayExpression",
		message: "Do not hand-type a query key. Use the endpoint registry: `apiRouter.<group>.<leaf>.scopeKey(scope)` to invalidate, `.queryKey(input)` for one entry.",
	},
	{
		selector: "CallExpression[callee.property.name=/^(setQueryData|getQueryData)$/] > ArrayExpression:first-child",
		message: "Do not hand-type a query key. Use the endpoint registry: `apiRouter.<group>.<leaf>.queryKey(input)`.",
	},
	// `unknown` type keyword. Two positions are exempt because the language
	// gives the value no other type: a `catch (error: unknown)` clause
	// parameter and the first parameter of a `.catch((error: unknown) => …)`
	// callback. Everywhere else, describe the real type (or parse with zod).
	{
		selector:
			"TSUnknownKeyword:not(CatchClause > Identifier.param > TSTypeAnnotation > TSUnknownKeyword):not(CallExpression[callee.property.name='catch'] > :function > Identifier:first-child > TSTypeAnnotation > TSUnknownKeyword)",
		message:
			"The `unknown` type is banned (rules/00-non-negotiables.md) outside a catch-clause / `.catch()` error parameter. Use the real type, or parse the value with a zod schema at the boundary.",
	},
	// `never` type keyword. Allowed only in exhaustiveness checks:
	//   - the parameter and return type of `function assertNever…(value: never): never`;
	//   - the key-exhaustiveness guard `Record<Exclude<keyof X, keyof Y>, never>`
	//     (rejects keys outside a set — the signature zod's own `.pick()` requires).
	{
		selector:
			"TSNeverKeyword:not(FunctionDeclaration[id.name=/^assertNever/] > Identifier > TSTypeAnnotation > TSNeverKeyword):not(FunctionDeclaration[id.name=/^assertNever/] > TSTypeAnnotation.returnType > TSNeverKeyword):not(TSTypeReference[typeName.name='Record'][typeArguments.params.length=2][typeArguments.params.0.typeName.name='Exclude'] > TSTypeParameterInstantiation > TSNeverKeyword:last-child)",
		message:
			"The `never` type is banned (rules/00-non-negotiables.md) outside an exhaustiveness check: `function assertNever…(value: never): never` or a `Record<Exclude<…>, never>` key guard.",
	},
];

// Runtime type checks belong to zod (rules/28). The runtime `typeof` operator is
// banned outright — type-position `typeof X` (`z.infer<typeof Schema>`) is a
// different AST node (TSTypeQuery) and stays allowed.
const RUNTIME_VALIDATION_SELECTORS = [
	{
		selector: "UnaryExpression[operator='typeof']",
		message:
			"The runtime `typeof` operator is banned (rules/28-runtime-validation.md). Parse with a zod schema, or narrow with a zod-backed guard from `@workspace/shared` (`isStringPrimitive`, `isArrayValue`, `hasGlobalValue`, …).",
	},
	{
		selector: "CallExpression[callee.object.name='Array'][callee.property.name='isArray']",
		message:
			"`Array.isArray` is banned (rules/28-runtime-validation.md). Use `z.array(...)` at the boundary, or `isArrayValue` from `@workspace/shared` for an in-process union.",
	},
	{
		selector: "MemberExpression[object.object.name='Object'][object.property.name='prototype'][property.name='toString']",
		message: "`Object.prototype.toString` tag sniffing is a hand-rolled type check (rules/28-runtime-validation.md). Use a zod schema instead.",
	},
];

// Positions in a list are named, never magic numbers (rules/27).
const ARRAY_INDEX_SELECTORS = [
	{
		selector: "MemberExpression[computed=true][property.type='Literal'][property.raw=/^[0-9]+$/]",
		message:
			"Numeric-literal index access (`items[0]`) is banned (rules/27-array-index-readability.md). Destructure (`const [first] = items`), use a named key (`items[LIST_SLOT_INDEX.first]` / a domain index map), or a named RegExp capture group (`match.groups`).",
	},
];

/** Every restricted-syntax selector, as one `no-restricted-syntax` rule entry. */
export const restrictedSyntaxRules = ["error", ...TYPE_SAFETY_SELECTORS, ...RUNTIME_VALIDATION_SELECTORS, ...ARRAY_INDEX_SELECTORS];
