import { Injectable, Logger, type OnModuleInit } from "@nestjs/common";

import { TenancyConfigService } from "../../config/tenancy.config";
import { DefaultOrganizationRepository } from "./default-organization.repository";

/** The configured single-tenant organization does not exist (or was deleted): the API refuses to start. */
export class DefaultOrganizationMissingError extends Error {
	public constructor(organizationId: string) {
		super(
			`DEFAULT_ORGANIZATION_ID=${organizationId} does not name a live organization. Single-tenant mode (TENANCY_ENABLED off) needs the id of a real organization — run \`pnpm db:seed\` or set it to an existing organization's id.`,
		);
		this.name = "DefaultOrganizationMissingError";
	}
}

/** Request code asked for the single-tenant organization outside single-tenant mode, or before boot verified it. */
export class SingleTenantOrganizationUnavailableError extends Error {
	public constructor() {
		super("The single-tenant organization is only available in single-tenant mode, after boot verified it");
		this.name = "SingleTenantOrganizationUnavailableError";
	}
}

/**
 * THE single source of the organization a single-tenant deployment serves.
 * At boot it verifies that `DEFAULT_ORGANIZATION_ID` names a live
 * organization row and refuses to start otherwise — there is no placeholder
 * organization id anywhere. In multi-tenant mode it resolves nothing:
 * requests are scoped to their guard-verified organization only.
 */
@Injectable()
export class DefaultOrganizationService implements OnModuleInit {
	private readonly logger: Logger = new Logger(DefaultOrganizationService.name);
	private verifiedOrganizationId: string | null = null;

	public constructor(
		private readonly tenancy: TenancyConfigService,
		private readonly repository: DefaultOrganizationRepository,
	) {}

	public async onModuleInit(): Promise<void> {
		const organizationId: string | null = this.tenancy.singleTenantOrganizationId;
		if (this.tenancy.enabled || organizationId === null) {
			return;
		}
		if (!(await this.repository.isLiveOrganization(organizationId))) {
			throw new DefaultOrganizationMissingError(organizationId);
		}
		this.verifiedOrganizationId = organizationId;
		this.logger.log(`Single-tenant mode serving organization ${organizationId}`);
	}

	/** The verified single-tenant organization id. Throws outside single-tenant mode or before boot verification. */
	public singleTenantOrganizationId(): string {
		if (this.verifiedOrganizationId === null) {
			throw new SingleTenantOrganizationUnavailableError();
		}
		return this.verifiedOrganizationId;
	}
}
