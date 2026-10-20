import type { Prisma } from "@prisma/client";

import { getApiConfig } from "../../config/api-config";
import { PublicUrlResolver } from "../../config/public-url.resolver";
import { TypedConfigService } from "../../config/typed-config.service";
import { systemActor } from "../../platform/application/actor-context";
import { InTransactionEventRegistry } from "../../platform/application/events/in-transaction-event-registry";
import { IntegrationEventMapperRegistry } from "../../platform/application/events/integration-event-mapper";
import type { DomainEvent } from "../../platform/domain/domain-event";
import { AuditLogRepository } from "../../platform/infrastructure/audit/audit-log.repository";
import { AuditTrailService } from "../../platform/infrastructure/audit/audit-trail.service";
import { RequestContextService } from "../../platform/infrastructure/context/request-context";
import { PlatformOutboxService } from "../../platform/infrastructure/outbox/platform-outbox.service";
import { SystemClock } from "../../platform/infrastructure/system-clock";
import type { AfterCommitPublisher } from "../../platform/infrastructure/unit-of-work/after-commit-publisher";
import { PrismaUnitOfWork } from "../../platform/infrastructure/unit-of-work/prisma-unit-of-work";
import { TransactionalEventDispatcher } from "../../platform/infrastructure/unit-of-work/transactional-event-dispatcher";
import { PrismaService } from "../../prisma/prisma.service";
import { TenantTransactionService } from "../../prisma/tenant-transaction.service";
import type { NotificationsTransactionalPorts } from "../notifications/public-api";
import { BootstrapSuperAdminCommand, type BootstrapSuperAdminInput } from "./application/commands/bootstrap-super-admin/bootstrap-super-admin.command";
import { BootstrapSuperAdminHandler } from "./application/commands/bootstrap-super-admin/bootstrap-super-admin.handler";
import type { BootstrapOutcome } from "./application/commands/bootstrap-super-admin/bootstrap-super-admin.types";
import { SUPERADMIN_BOOTSTRAP_OPERATION } from "./application/ports/identity.tokens";
import { NodeOperatorIdentity } from "./infrastructure/adapters/operator-identity.adapter";
import { UuidIdGenerator } from "./infrastructure/adapters/uuid-id-generator";
import { IdentityIntegrationEventsMapper } from "./infrastructure/outbox/identity-integration-events.mapper";
import { IdentityScopeFactory } from "./infrastructure/persistence/identity-scope.factory";
import { CryptoService } from "./infrastructure/security/crypto.service";
import { createPasswordReader, type BootstrapStreams, type PasswordReader } from "./presentation/cli/password-reader";
import type { PasswordSource } from "./presentation/cli/superadmin-bootstrap.args";
import { SuperAdminBootstrapCommand } from "./presentation/cli/superadmin-bootstrap.cli-command";

/** Why the bootstrap transaction exists: written as the system actor's reason. */
const SUPERADMIN_BOOTSTRAP_REASON = "Create the first SuperAdmin from the command line";

/** The one-time bootstrap, as the command line drives it. */
export interface SuperAdminBootstrap {
	bootstrap(input: BootstrapSuperAdminInput): Promise<BootstrapOutcome>;
}

/** The bootstrap sends no email (the operator proved control of the server; the account is verified at creation). */
export class BootstrapSendsNoEmailError extends Error {
	public constructor() {
		super("The SuperAdmin bootstrap never sends email");
		this.name = "BootstrapSendsNoEmailError";
	}
}

/** Refuses to build email machinery: the bootstrap transaction never requests an email. */
class NoBootstrapEmails {
	public create(): NotificationsTransactionalPorts {
		throw new BootstrapSendsNoEmailError();
	}
}

/** A command-line process has no in-process subscribers; what must be durable is in the outbox already. */
class NoAfterCommitSubscribers implements AfterCommitPublisher {
	public publish(_event: DomainEvent): Promise<void> {
		return Promise.resolve();
	}
}

/**
 * Wires `BootstrapSuperAdminHandler` from the application's OWN collaborators (the same hasher and
 * cost as signup, the same repositories, role assignment and audit rows, the same unit of work) by
 * hand: the command runs under tsx without Nest decorator metadata or a container, and needs no Redis,
 * queue or HTTP server (plan §7.6).
 */
export function createSuperAdminBootstrap(config: TypedConfigService, prisma: PrismaService): SuperAdminBootstrap {
	const requestContext = new RequestContextService();
	const transactions = new TenantTransactionService(prisma, requestContext);
	const mappers = new IntegrationEventMapperRegistry();
	mappers.register(new IdentityIntegrationEventsMapper());
	const dispatcher = new TransactionalEventDispatcher<Prisma.TransactionClient>(
		new InTransactionEventRegistry<Prisma.TransactionClient>(),
		mappers,
		new PlatformOutboxService(transactions, requestContext),
	);
	const scopes = new IdentityScopeFactory({
		notifications: new NoBootstrapEmails(),
		auditTrail: new AuditTrailService(new AuditLogRepository(transactions), requestContext),
		config,
		resolvePublicUrl: new PublicUrlResolver(config).resolve,
	});
	const clock = new SystemClock();
	const handler = new BootstrapSuperAdminHandler(
		new PrismaUnitOfWork(transactions, scopes, dispatcher, new NoAfterCommitSubscribers()),
		new CryptoService(config),
		new UuidIdGenerator(),
		new NodeOperatorIdentity(),
		clock,
	);
	return {
		bootstrap: (input: BootstrapSuperAdminInput): Promise<BootstrapOutcome> =>
			handler.execute(new BootstrapSuperAdminCommand(systemActor(SUPERADMIN_BOOTSTRAP_OPERATION, "cli", null, SUPERADMIN_BOOTSTRAP_REASON, null), input)),
	};
}

/**
 * Operational entry point: connects with the API's own configuration (`DATABASE_URL`, hashing cost,
 * …), runs the command, and always closes the connection. Returns the exit code.
 */
export async function runSuperAdminBootstrap(argv: readonly string[], streams: BootstrapStreams, log: (line: string) => void): Promise<number> {
	let prisma: PrismaService | undefined;
	const command = new SuperAdminBootstrapCommand({
		createPasswordReader: (source: PasswordSource): PasswordReader => createPasswordReader(source, streams),
		bootstrap: async (input: BootstrapSuperAdminInput): Promise<BootstrapOutcome> => {
			const config = new TypedConfigService(getApiConfig());
			prisma = new PrismaService(config);
			return createSuperAdminBootstrap(config, prisma).bootstrap(input);
		},
		loginUrl: (): string => new TypedConfigService(getApiConfig()).clientApps.adminUrl,
		log,
	});
	try {
		return await command.execute(argv);
	} finally {
		await prisma?.$disconnect();
	}
}
