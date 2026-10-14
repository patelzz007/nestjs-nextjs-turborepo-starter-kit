// ============================================
// common/audit/audit-data-policy.ts — what an audit record may keep of a value
// ============================================
// The ONE personal-data and size policy shared by both audit trails:
//   - the HTTP audit trail (`http-audit-entry.ts`, ADR 025) applies it to
//     request / response payloads in TypeScript;
//   - the data-change trail (ADR 051) applies it inside PostgreSQL — the
//     capture trigger is GENERATED from these constants
//     (`prisma/rls/data-change-capture.ts`), so the two can never drift.
// Dependency-free on purpose: the RLS apply script imports it.

/** Replacement for a personal-data value in an audit record. */
export const PII_MASK = "[PII]";

/** Largest serialized value (UTF-8 bytes) an audit record stores in one place; larger ones become a truncation marker. */
export const AUDIT_PAYLOAD_MAX_BYTES = 16_384;

/**
 * Personal-data field names, compared after {@link normalizeAuditFieldName}
 * (case-insensitive, separators ignored — `full_name`, `fullName` and
 * `Full-Name` all match `fullname`). The actor is identified by id; copies of
 * personal data inside an audit record are masked (rules/10 → "keep PII in
 * them redacted or tokenized from the start").
 */
export const PII_FIELD_NAMES: ReadonlySet<string> = new Set<string>([
	"email",
	"contactemail",
	"phone",
	"phonenumber",
	"contactphone",
	"mobile",
	"fullname",
	"firstname",
	"lastname",
	"address",
	"addresstext",
	"addressline1",
	"addressline2",
	"dateofbirth",
	"nric",
	"passportnumber",
	"nationalid",
]);

/**
 * The personal-data fields that hold an email address. Their masked form keeps
 * the first character and the domain, so an investigator can still tell two
 * addresses apart without reading either.
 */
export const EMAIL_FIELD_NAMES: ReadonlySet<string> = new Set<string>(["email", "contactemail"]);

/** Lower-case, letters and digits only — the form the field-name sets above are written in. */
export function normalizeAuditFieldName(name: string): string {
	return name.toLowerCase().replace(/[^a-z0-9]/g, "");
}

/** True when a field / column of this name holds personal data. */
export function isPersonalDataField(name: string): boolean {
	return PII_FIELD_NAMES.has(normalizeAuditFieldName(name));
}

/** True when a field / column of this name holds an email address (a subset of the personal-data fields). */
export function isEmailField(name: string): boolean {
	return EMAIL_FIELD_NAMES.has(normalizeAuditFieldName(name));
}
