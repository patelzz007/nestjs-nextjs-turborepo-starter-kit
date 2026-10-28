import { expect } from "vitest";
import { z } from "zod";

import { REQUIRED_PERMISSION_KEY } from "../../../../../platform/presentation/http/security/decorators/route-requirements.metadata";

/** The metadata key `@RequirePermission` writes (a list: every requirement on the route). */
export const REQUIRED_PERMISSION_METADATA_KEY: string = REQUIRED_PERMISSION_KEY;

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
