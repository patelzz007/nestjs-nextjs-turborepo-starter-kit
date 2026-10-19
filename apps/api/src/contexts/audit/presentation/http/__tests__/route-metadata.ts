import { expect } from "vitest";
import { z } from "zod";

import { RequirePermission } from "../../../../../platform/presentation/http/security/decorators/require-permission.decorator";

/**
 * The metadata key `@RequirePermission` writes, read off the decorator itself (a Nest
 * `CustomDecorator` carries its `KEY`) so these specs import no other context's internals.
 */
export const REQUIRED_PERMISSION_METADATA_KEY: string = z.string().parse(RequirePermission("READ", "AUDIT_LOG").KEY);

const MetadataKeysSchema = z.array(z.union([z.string(), z.symbol()]));

/**
 * Asserts `actual` carries exactly the metadata a reference target decorated with the expected
 * decorators carries (guards, messages, …) — every key the reference has, with an equal value.
 */
export function expectOwnMetadataLike(actual: object, reference: object): void {
	const keys = MetadataKeysSchema.parse(Reflect.getOwnMetadataKeys(reference));
	expect(keys.length).toBeGreaterThan(0);
	for (const key of keys) {
		expect(Reflect.getOwnMetadata(key, actual), String(key)).toEqual(Reflect.getOwnMetadata(key, reference));
	}
}
