import { getApiConfig } from "../../../config/api-config";
import { TypedConfigService } from "../../../config/typed-config.service";
import { PrismaService } from "../../../prisma/prisma.service";
import { createPasswordReader, type BootstrapStreams, type PasswordReader } from "./password-reader";
import type { PasswordSource } from "./superadmin-bootstrap.args";
import { SuperAdminBootstrapCommand } from "./superadmin-bootstrap.command";
import { createSuperAdminBootstrapService } from "./superadmin-bootstrap.composition";
import type { BootstrapOutcome, BootstrapRequest } from "./superadmin-bootstrap.service";

/**
 * Operational entry point: connects with the API's own configuration (`DATABASE_URL`, hashing cost, …),
 * runs the command, and always closes the connection. Returns the exit code.
 */
export async function runSuperAdminBootstrap(argv: readonly string[], streams: BootstrapStreams, log: (line: string) => void): Promise<number> {
	let prisma: PrismaService | undefined;
	const command = new SuperAdminBootstrapCommand({
		createPasswordReader: (source: PasswordSource): PasswordReader => createPasswordReader(source, streams),
		bootstrap: async (request: BootstrapRequest): Promise<BootstrapOutcome> => {
			const config = new TypedConfigService(getApiConfig());
			prisma = new PrismaService(config);
			return createSuperAdminBootstrapService(config, prisma).bootstrap(request);
		},
		loginUrl: (): string => new TypedConfigService(getApiConfig()).adminAppUrl,
		log,
	});
	try {
		return await command.execute(argv);
	} finally {
		await prisma?.$disconnect();
	}
}
