import { PublicUrlResolver, type PublicUrlResolve } from "../../src/config/public-url.resolver";
import { createTestTypedConfig } from "./test-api-env";

/** The resolver of the test configuration (its `http.publicUrl`): stored paths join it, absolute URLs pass through. */
export function createTestPublicUrls(): PublicUrlResolver {
	return new PublicUrlResolver(createTestTypedConfig());
}

/** {@link createTestPublicUrls}'s `resolve`, for the pure mappers. */
export const TEST_RESOLVE_PUBLIC_URL: PublicUrlResolve = createTestPublicUrls().resolve;
