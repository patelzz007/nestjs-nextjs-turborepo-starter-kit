import { Inject, Injectable } from "@nestjs/common";
import type { Prisma } from "@prisma/client";
import type { PermissionResource } from "@workspace/shared";

import type { SystemDatabaseContext } from "../../../../prisma/tenant-context";
import { TenantTransactionService } from "../../../../prisma/tenant-transaction.service";
import { PRINCIPAL_LOOKUP_OPERATION } from "../../../../platform/application/shared-system-operations";

/**
 * Result of an ownership lookup:
 * - `unsupported` — the resource type has no ownership model (OWN scope can never apply)
 * - `missing` — the resource does not exist (or is soft-deleted)
 * - `owned` — the owner's user id
 */
export type OwnershipLookup = { readonly kind: "unsupported" } | { readonly kind: "missing" } | { readonly kind: "owned"; readonly ownerUserId: string };

interface OwnershipLookupTransactions {
	withSystemOperation<TResult>(context: SystemDatabaseContext, work: (tx: Prisma.TransactionClient) => Promise<TResult>): Promise<TResult>;
}

/**
 * Resolves the owning user of a resource from the database.
 *
 * Ownership is always read from trusted server-side state — never from
 * request-supplied attributes — so a client cannot claim ownership by sending
 * `ownerId` in a body.
 */
@Injectable()
export class ResourceOwnershipResolver {
	public constructor(@Inject(TenantTransactionService) private readonly transactions: OwnershipLookupTransactions) {}

	public async resolve(resource: PermissionResource, resourceId: string): Promise<OwnershipLookup> {
		switch (resource) {
			case "USER":
			case "PROFILE": {
				const user = await this.transactions.withSystemOperation(
					{ operation: PRINCIPAL_LOOKUP_OPERATION, reason: "Resolve whether a user resource exists for an ownership check", actorUserId: null },
					(tx) => tx.user.findFirst({ where: { id: resourceId, isDeleted: false }, select: { id: true } }),
				);
				return user === null ? { kind: "missing" } : { kind: "owned", ownerUserId: user.id };
			}
			default:
				return { kind: "unsupported" };
		}
	}
}
