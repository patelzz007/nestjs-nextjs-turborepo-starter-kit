/** What one policy says: its command (left out: every command) and its USING / WITH CHECK conditions. */
export interface PolicyClauses {
	readonly command?: "SELECT" | "INSERT" | "UPDATE" | "DELETE";
	readonly using?: string;
	readonly withCheck?: string;
}

/** The same condition for the rows a policy reads (USING) and the rows it writes (WITH CHECK). */
export function bothWays(predicate: string): PolicyClauses {
	return { using: predicate, withCheck: predicate };
}

/** The table's scoped system-operation bypass (ADR 012): only an operation whose registry scope lists the table. */
export function systemBypass(table: string): string {
	return `(SELECT app_rls_bypass_on('${table}'))`;
}

/** Thrown when a policy declaration cannot be turned into safe SQL. */
export class PolicyDeclarationError extends Error {
	public constructor(message: string) {
		super(message);
		this.name = "PolicyDeclarationError";
	}
}
