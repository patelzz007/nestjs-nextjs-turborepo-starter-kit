import { randomUUID } from "node:crypto";

import { ActorContextSchema, type ActorContext } from "../../../../platform/application/actor-context";

/**
 * The actor of a port call that carries none (the `AccountProvisioningPort` contract): an anonymous
 * actor. Its units of work run under the public flow's bypass operation, and the transaction still
 * stamps the request's correlation id (the transaction service reads it from the request context).
 */
export function backgroundActorOf(): ActorContext {
	return ActorContextSchema.parse({
		kind: "anonymous",
		organizationId: null,
		request: { requestId: randomUUID(), ip: null, userAgent: null, deviceLabel: null, endpoint: null },
	});
}
