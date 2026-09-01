import { AuthFlowEventSchema, type AuthFlowEvent } from "@workspace/shared";

import { AuthEventsService } from "../services/auth-events.service";

/**
 * Extracts the userId from the method's arguments or return value.
 * Return `null` for anonymous flows (e.g., forgot-password where user may not exist).
 */
type UserIdExtractor = (...args: unknown[]) => string | null | undefined;

interface TrackAuthFlowOptions {
	/** The auth flow name (e.g., "signup", "login", "forgot-password"). */
	readonly flow: string;
	/**
	 * Optional: extract the client type from the method arguments.
	 * Defaults to `null` (not a client-type-specific flow).
	 */
	readonly clientType?: UserIdExtractor;
	/**
	 * Optional: extract the userId from the method arguments.
	 * If not provided, the decorator tries `result.id` or `result.userId` on success.
	 */
	readonly userId?: UserIdExtractor;
}

/**
 * Declarative decorator that wraps a method and automatically emits an
 * `AuthFlowEvent` on both success and failure, with accurate timing.
 *
 * Replaces the manual `flowStartedAt` + `emitFlow()` boilerplate that was
 * repeated in every auth method.
 *
 * @example
 *   @TrackAuthFlow({ flow: "signup" })
 *   public async signup(dto: SignupInput): Promise<SignupResponse> {
 *       // ... no emitFlow calls needed
 *   }
 *
 * @example
 *   @TrackAuthFlow({
 *       flow: "login",
 *       clientType: (_dto, clientType) => clientType ?? null,
 *   })
 *   public async login(dto: LoginInput, clientType?: string): Promise<LoginServiceResponse> {
 *       // ...
 *   }
 */
export function TrackAuthFlow(options: TrackAuthFlowOptions): MethodDecorator {
	const { flow, clientType: clientTypeExtractor, userId: userIdExtractor } = options;

	return function (_target: unknown, propertyKey: string | symbol, descriptor: PropertyDescriptor): PropertyDescriptor {
		const originalMethod = descriptor.value as (...args: unknown[]) => Promise<unknown>;

		descriptor.value = async function (this: { readonly authEvents?: AuthEventsService }, ...args: unknown[]): Promise<unknown> {
			const flowStartedAt: number = performance.now();
			const getAuthEvents = (): AuthEventsService | undefined => this.authEvents;

			const emitEvent = (status: "succeeded" | "failed", error: string | null, userId: string | null): void => {
				const authEvents = getAuthEvents();
				if (authEvents === undefined) {
					return;
				}

				const resolvedClientType = clientTypeExtractor !== undefined ? (clientTypeExtractor(...args) ?? null) : null;

				authEvents.emitFlow(
					AuthFlowEventSchema.parse({
						flow,
						userId,
						clientType: resolvedClientType,
						status,
						error,
						durationMs: Math.round(performance.now() - flowStartedAt),
					}),
				);
			};

			try {
				const result: unknown = await originalMethod.apply(this, args);

				// Extract userId: explicit extractor → result.id → result.userId → null
				let userId: string | null = null;
				if (userIdExtractor !== undefined) {
					userId = userIdExtractor(...args) ?? null;
				} else if (result !== null && result !== undefined && typeof result === "object") {
					const obj = result as Record<string, unknown>;
					if (typeof obj.id === "string") {
						userId = obj.id;
					} else if (typeof obj.userId === "string") {
						userId = obj.userId;
					} else if ("user" in obj && obj.user !== null && typeof obj.user === "object") {
						const user = obj.user as Record<string, unknown>;
						if (typeof user.id === "string") {
							userId = user.id;
						}
					}
				}

				emitEvent("succeeded", null, userId);
				return result;
			} catch (error: unknown) {
				const errorCode = extractErrorCode(error);
				// For failed flows, try to get userId from args
				let userId: string | null = null;
				if (userIdExtractor !== undefined) {
					userId = userIdExtractor(...args) ?? null;
				} else if (error !== null && error !== undefined && typeof error === "object") {
					const errObj = error as Record<string, unknown>;
					if (typeof errObj.userId === "string") {
						userId = errObj.userId;
					}
				}

				emitEvent("failed", errorCode, userId);
				throw error;
			}
		};

		return descriptor;
	};
}

function extractErrorCode(error: unknown): string {
	if (error !== null && error !== undefined && typeof error === "object") {
		const obj = error as Record<string, unknown>;
		if (typeof obj.error === "string") {
			return obj.error;
		}
		if (typeof obj.message === "string") {
			return obj.message;
		}
	}
	return "UNKNOWN_ERROR";
}
