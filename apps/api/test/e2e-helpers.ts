import { FastifyAdapter, type NestFastifyApplication } from "@nestjs/platform-fastify";
import fastifyCookie from "@fastify/cookie";
import { Test, type TestingModule } from "@nestjs/testing";
import { API_VERSION_PREFIX, MUTATION_INTENT_HEADER, MUTATION_INTENT_VALUE } from "@workspace/shared";

import { AppModule } from "../src/app.module";
import { HealthService } from "../src/modules/health/health.service";

export interface LoginResult {
	readonly accessToken: string;
	readonly refreshToken: string;
}

const CLIENT_ORIGIN = "http://localhost:3000";

let nextClientIpSuffix = 1;

/** Distinct synthetic IPs so auth throttler buckets do not collide across e2e logins. */
export function uniqueClientIp(): string {
	const suffix = nextClientIpSuffix;
	nextClientIpSuffix += 1;
	return `203.0.113.${String(suffix % 250 + 1)}`;
}

export function mutationHeaders(extra: Record<string, string> = {}): Record<string, string> {
	return {
		origin: CLIENT_ORIGIN,
		[MUTATION_INTENT_HEADER]: MUTATION_INTENT_VALUE,
		...extra,
	};
}

export function extractCookie(setCookieHeader: string | string[] | undefined, name: string): string | undefined {
	if (setCookieHeader === undefined) {
		return undefined;
	}
	const headers: readonly string[] = Array.isArray(setCookieHeader) ? setCookieHeader : [setCookieHeader];
	for (const header of headers) {
		const [pair] = header.split(";");
		const [cookieName, value] = pair.split("=", 2);
		if (cookieName === name && value !== undefined) {
			return value;
		}
	}
	return undefined;
}

export async function createE2eApp(): Promise<NestFastifyApplication> {
	const moduleFixture: TestingModule = await Test.createTestingModule({
		imports: [AppModule],
	}).compile();

	const app = moduleFixture.createNestApplication<NestFastifyApplication>(new FastifyAdapter(), { rawBody: true });
	await app.register(fastifyCookie);
	await app.init();
	app.get(HealthService).markReady();
	return app;
}

export async function login(
	app: NestFastifyApplication,
	email: string,
	password: string,
	clientType?: "admin" | "merchant" | "web",
): Promise<LoginResult> {
	const response = await app.inject({
		method: "POST",
		url: `${API_VERSION_PREFIX}/auth/login`,
		headers: mutationHeaders({
			"cf-connecting-ip": uniqueClientIp(),
			...(clientType === undefined ? {} : { "x-client-type": clientType }),
		}),
		payload: { email, password },
	});

	const accessToken = extractCookie(
		response.headers["set-cookie"],
		clientType === "admin" ? "adminAccessToken" : clientType === "merchant" ? "merchantAccessToken" : "accessToken",
	);
	const refreshToken = extractCookie(
		response.headers["set-cookie"],
		clientType === "admin" ? "adminRefreshToken" : clientType === "merchant" ? "merchantRefreshToken" : "refreshToken",
	);

	if (accessToken === undefined || refreshToken === undefined) {
		throw new Error(`Login failed for ${email}: status ${String(response.statusCode)} body ${response.body}`);
	}

	return { accessToken, refreshToken };
}
