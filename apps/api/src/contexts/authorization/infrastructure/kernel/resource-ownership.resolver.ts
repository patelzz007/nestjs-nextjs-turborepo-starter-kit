import { Injectable } from "@nestjs/common";
import type { PermissionResource } from "@workspace/shared";

import { PrismaService } from "../../../../prisma/prisma.service";

/**
 * Result of an ownership lookup:
 * - `unsupported` — the resource type has no ownership model (OWN scope can never apply)
 * - `missing` — the resource does not exist (or is soft-deleted)
 * - `owned` — the owner's user id
 */
export type OwnershipLookup = { readonly kind: "unsupported" } | { readonly kind: "missing" } | { readonly kind: "owned"; readonly ownerUserId: string };

/**
 * Resolves the owning user of a resource from the database.
 *
 * Ownership is always read from trusted server-side state — never from
 * request-supplied attributes — so a client cannot claim ownership by sending
 * `ownerId` in a body.
 */
@Injectable()
export class ResourceOwnershipResolver {
	public constructor(private readonly prisma: PrismaService) {}

	public async resolve(resource: PermissionResource, resourceId: string): Promise<OwnershipLookup> {
		switch (resource) {
			case "USER":
			case "PROFILE": {
				const user = await this.prisma.user.findFirst({ where: { id: resourceId, isDeleted: false }, select: { id: true } });
				return user === null ? { kind: "missing" } : { kind: "owned", ownerUserId: user.id };
			}
			default:
				return { kind: "unsupported" };
		}
	}
}
