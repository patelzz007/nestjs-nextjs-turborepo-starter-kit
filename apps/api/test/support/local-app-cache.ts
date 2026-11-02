import { Logger } from "@nestjs/common";

import { TieredAppCache } from "../../src/platform/infrastructure/cache/tiered-app-cache";
import { RedisNamespace } from "../../src/platform/infrastructure/redis/redis-namespace";

/** The real cache of ADR 072 without Redis: every tier answers from this process, as on a single local API. */
export function localAppCache(now?: () => number): TieredAppCache {
	return new TieredAppCache({ namespace: new RedisNamespace("test"), client: null, cipher: null, logger: new Logger("AppCache"), ...(now === undefined ? {} : { now }) });
}
