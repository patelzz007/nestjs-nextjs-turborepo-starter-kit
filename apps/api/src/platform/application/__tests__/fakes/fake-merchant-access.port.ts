import type { CapabilitySlug } from "@workspace/shared";

import type { ActorContext } from "../../actor-context";
import type { MerchantAccessGrant, MerchantAccessPort, MerchantAccessRequest } from "../../ports/authorization.port";
import { AuthorizationDeniedError } from "../../../domain/errors/authorization-denied.error";

/** One capability request the fake was asked, with the actor that asked it. */
export interface RecordedMerchantAccessRequest {
	readonly actor: ActorContext;
	readonly request: MerchantAccessRequest;
}

/**
 * A real {@link MerchantAccessPort}: grants a tenant-wide scope by
 * default, or denies the capabilities it was told to deny with the same
 * {@link AuthorizationDeniedError} the adapter throws. `grantLocations` narrows
 * the returned grant to specific locations. A request naming a `locationId` is
 * narrowed to that one store, and refused when it lies outside the granted
 * stores, as the adapter does.
 */
export class FakeMerchantAccessPort implements MerchantAccessPort {
	public readonly requests: RecordedMerchantAccessRequest[] = [];
	private readonly denied: Set<CapabilitySlug> = new Set<CapabilitySlug>();
	private locationIds: readonly string[] | null = null;

	/** Refuse `capability` from now on. */
	public deny(capability: CapabilitySlug): this {
		this.denied.add(capability);
		return this;
	}

	/** Grant only these locations instead of the whole tenant. */
	public grantLocations(locationIds: readonly string[]): this {
		this.locationIds = [...locationIds];
		return this;
	}

	public assertCapability(actor: ActorContext, request: MerchantAccessRequest): Promise<MerchantAccessGrant> {
		this.requests.push({ actor, request });
		if (this.denied.has(request.capability)) {
			return Promise.reject(new AuthorizationDeniedError(request.capability, "Tenant"));
		}
		const locationId = request.locationId ?? null;
		if (locationId !== null) {
			if (this.locationIds !== null && !this.locationIds.includes(locationId)) {
				return Promise.reject(new AuthorizationDeniedError(request.capability, "Location"));
			}
			return Promise.resolve({ tenantId: request.tenantId, locationScope: "SELECTED", locationIds: [locationId] });
		}
		if (this.locationIds === null) {
			return Promise.resolve({ tenantId: request.tenantId, locationScope: "ALL_LOCATIONS", locationIds: [] });
		}
		return Promise.resolve({ tenantId: request.tenantId, locationScope: "SELECTED", locationIds: this.locationIds });
	}
}
