import { Injectable } from "@nestjs/common";

import { RequestContextService } from "../../../../platform/infrastructure/context/request-context";
import type { RequestTenantPort, VerifiedRequestTenant } from "../../application/ports/rbac-read.port";

/** The tenant `AuthorizationGuard` verified and bound into the request context (ADR 017). */
@Injectable()
export class RequestTenantAdapter implements RequestTenantPort {
	public constructor(private readonly requestContext: RequestContextService) {}

	public current(): VerifiedRequestTenant {
		const tenant = this.requestContext.current()?.tenant;
		return {
			...(tenant?.tenantId === undefined ? {} : { tenantId: tenant.tenantId }),
			...(tenant?.storeId === undefined ? {} : { storeId: tenant.storeId }),
			...(tenant?.locationId === undefined ? {} : { locationId: tenant.locationId }),
		};
	}
}
