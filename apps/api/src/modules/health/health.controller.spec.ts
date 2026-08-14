import { Test, TestingModule } from "@nestjs/testing";

import { HealthController } from "./health.controller.js";
import { HealthService } from "./health.service.js";

describe("HealthController", () => {
	let controller: HealthController;

	const healthServiceMock = {
		getHello: jest.fn().mockReturnValue("Hello from the Freebuff API!"),
		healthCheck: jest.fn().mockResolvedValue({ status: "ok", db: "connected", timestamp: 1767225600000 }),
	};

	beforeEach(async () => {
		const module: TestingModule = await Test.createTestingModule({
			controllers: [HealthController],
			providers: [{ provide: HealthService, useValue: healthServiceMock }],
		}).compile();

		controller = module.get<HealthController>(HealthController);
	});

	it("should be defined", () => {
		expect(controller).toBeDefined();
	});

	it("returns the welcome message", () => {
		expect(controller.getHello()).toBe("Hello from the Freebuff API!");
	});

	it("returns the health check payload", async () => {
		await expect(controller.getHealth()).resolves.toMatchObject({ status: "ok", db: "connected" });
	});
});
