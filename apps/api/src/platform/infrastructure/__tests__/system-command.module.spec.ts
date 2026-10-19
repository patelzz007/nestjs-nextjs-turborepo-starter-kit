import { CommandBus, CqrsModule } from "@nestjs/cqrs";
import { Test, type TestingModule } from "@nestjs/testing";
import { describe, expect, it } from "vitest";

import { SystemCommandDispatcher } from "../../application/system-command-dispatcher";
import { AuditLogRepository } from "../audit/audit-log.repository";
import { RequestContextModule } from "../context/request-context.module";
import { SystemCommandModule } from "../system-command.module";

/** The repository writes through Postgres; this DI test never writes, so it gets a real no-op writer. */
class NoopAuditLogRepository {
	public append(): Promise<void> {
		return Promise.resolve();
	}
}

describe("SystemCommandModule", () => {
	it("uses the one global CommandBus from CqrsModule.forRoot(), never a second instance", async () => {
		const moduleRef: TestingModule = await Test.createTestingModule({
			imports: [CqrsModule.forRoot(), RequestContextModule, SystemCommandModule],
		})
			.overrideProvider(AuditLogRepository)
			.useValue(new NoopAuditLogRepository())
			.compile();
		try {
			expect(moduleRef.get(SystemCommandDispatcher, { strict: false })).toBeInstanceOf(SystemCommandDispatcher);
			expect(moduleRef.get(CommandBus, { strict: false, each: true })).toHaveLength(1);
		} finally {
			await moduleRef.close();
		}
	});
});
