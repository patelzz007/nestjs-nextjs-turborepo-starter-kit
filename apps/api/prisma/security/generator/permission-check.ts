/**
 * The ROLE and GRANT allow paths (ADR 067) as a policy condition that PostgreSQL evaluates ONCE per statement.
 *
 * `app_has_permission(resource, action, "tenantId", "locationId")` takes the row's columns, so it runs for every row a
 * query touches: about 260× slower than no row security when counting 100 000 sales (`db:security-benchmark`). The
 * same answer is computed instead as the caller's permitted tenants (`app_permitted_tenants`) and stores
 * (`app_permitted_stores`), each inside an uncorrelated `(SELECT …)`, which PostgreSQL runs once (an InitPlan); each
 * row is then only compared against an array. e2e/rls/permitted-scope-equivalence.e2e-spec.ts proves both forms agree.
 *
 * `resource` and `action` must already be checked (a catalogue word); `tenant` and `store` are SQL column references.
 */
export function permitted(resource: string, action: string, tenant: string, store?: string): string {
	// `::text[]` makes `= ANY (…)` compare against the array the scalar subquery returns (without it PostgreSQL reads
	// `ANY (SELECT …)` as "any row of the subquery").
	const tenants = `(SELECT app_permitted_tenants('${resource}', '${action}'))::text[]`;
	if (store === undefined) {
		return `${tenant} = ANY (${tenants})`;
	}
	const stores = `(SELECT app_permitted_stores('${resource}', '${action}'))::text[]`;
	// A row without a store is a tenant-level record, exactly as app_has_permission(…, NULL) treats it.
	return `(CASE WHEN ${store} IS NULL THEN ${tenant} = ANY (${tenants}) ELSE (${tenant} || '|*') = ANY (${stores}) OR (${tenant} || '|' || ${store}) = ANY (${stores}) END)`;
}
