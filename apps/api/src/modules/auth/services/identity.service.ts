import { ConflictException, Injectable, NotFoundException } from "@nestjs/common";
import type { AccessTokenPayload, SignupInput, SignupResponse, SessionPermissionsResponse, UserResponse, UserPermissions } from "@workspace/shared";

import { LogService } from "../../../modules/logs/logs.service";
import { PrismaService } from "../../../prisma/prisma.service";
import { AuthorizationCheckerService } from "../../authorization/services/authorization-checker.service";
import { TrackAuthFlow } from "../decorators/track-auth-flow.decorator";
import { UserRepository } from "../repositories/user.repository";
import { AuthEventsService } from "./auth-events.service";
import { CryptoService } from "./crypto.service";
import { TokenService } from "./token.service";
import { UserResponseMapper } from "./user-response.mapper";

/**
 * Handles user identity operations: signup and profile retrieval (`/me`).
 *
 * Extracted from `AuthService` to follow single-responsibility principle.
 */
@Injectable()
export class IdentityService {
	/** Short-lived cache for `/auth/me` responses (30s TTL). */
	private readonly meCache = new Map<string, { readonly value: UserResponse; readonly expiresAt: number }>();
	/** Short-lived cache for `/auth/permissions` responses (30s TTL). */
	private readonly permissionsCache = new Map<string, { readonly value: SessionPermissionsResponse; readonly expiresAt: number }>();
	private static readonly ME_CACHE_TTL_MS = 30_000;

	constructor(
		private readonly prisma: PrismaService,
		private readonly userRepo: UserRepository,
		private readonly cryptoService: CryptoService,
		private readonly tokenService: TokenService,
		private readonly authorizationChecker: AuthorizationCheckerService,
		private readonly authEvents: AuthEventsService,
		private readonly logService: LogService,
		private readonly mapper: UserResponseMapper,
	) {}

	@TrackAuthFlow({ flow: "signup" })
	public async signup(signupDto: SignupInput): Promise<SignupResponse> {
		const { email, password, fullName } = signupDto;

		const emailTaken: boolean = await this.userRepo.existsByEmail(email);
		if (emailTaken) {
			throw new ConflictException("Email already in use");
		}

		const hashedPassword = await this.cryptoService.hash(password);
		const verificationToken = await this.tokenService.generateEmailVerificationToken(email);

		const { user: newUser, userPermissions } = await this.prisma.$transaction(async (tx) => {
			const created = await tx.user.create({
				data: { email, passwordHash: hashedPassword, fullName },
				select: {
					id: true,
					email: true,
					fullName: true,
					isActive: true,
					isSuperAdmin: true,
					createdAt: true,
					updatedAt: true,
					isDeleted: true,
					deletedAt: true,
				},
			});

			const userRole = await tx.role.findUnique({ where: { name: "User" } });
			if (userRole) {
				await tx.userRole.create({
					data: { userId: created.id, roleId: userRole.id },
				});
			}

			const permissions = await this.authorizationChecker.getUserPermissionDetails(created.id);
			return { user: created, userPermissions: permissions };
		});

		this.logService.info(`New user registered: ${newUser.email}`, {
			userId: newUser.id,
			context: "IdentityService",
			metadata: {
				email: newUser.email,
				fullName: newUser.fullName,
				roles: userPermissions.roles.map((r: { name: string }) => r.name).join(","),
				isSuperAdmin: newUser.isSuperAdmin ? "true" : "false",
			},
		});

		return {
			user: this.mapper.build(newUser, userPermissions, false),
			verificationToken,
			message: "User registered successfully",
		};
	}

	public async getMe(userId: string): Promise<UserResponse> {
		const now: number = Date.now();
		const entry = this.meCache.get(userId);
		if (entry !== undefined && entry.expiresAt > now) {
			return entry.value;
		}
		const response = await this.getUserResponse(userId);
		this.meCache.set(userId, { value: response, expiresAt: now + IdentityService.ME_CACHE_TTL_MS });
		return response;
	}

	public async getSessionPermissions(userId: string, accessPayload?: AccessTokenPayload): Promise<SessionPermissionsResponse> {
		const now: number = Date.now();
		const entry = this.permissionsCache.get(userId);
		if (entry !== undefined && entry.expiresAt > now) {
			return entry.value;
		}
		const user = await this.userRepo.findProfileById(userId);
		const userPermissions: UserPermissions = await this.authorizationChecker.getUserPermissionDetails(userId);
		const profile = this.mapper.build(user, userPermissions, user.emailVerifiedAt !== null && user.emailVerifiedAt <= Date.now());
		const response: SessionPermissionsResponse = {
			roles: userPermissions.roles,
			permissions: userPermissions.permissions,
			tokenVersion: profile.tokenVersion,
			hasAdminAccess: profile.hasAdminAccess,
			isImpersonating: accessPayload?.isImpersonating,
			originalUserId: accessPayload?.originalUserId,
		};
		this.permissionsCache.set(userId, { value: response, expiresAt: now + IdentityService.ME_CACHE_TTL_MS });
		return response;
	}

	/**
	 * Drop cached `/auth/me` and `/auth/permissions` payloads for a user.
	 *
	 * Called when roles or permissions change so clients refetch fresh data.
	 */
	public invalidateMe(userId: string): void {
		this.meCache.delete(userId);
		this.permissionsCache.delete(userId);
	}

	/**
	 * Fetch a full UserResponse by ID. Also used by `LoginService` after
	 * successful authentication to build the response.
	 */
	public async getUserResponse(userId: string): Promise<UserResponse> {
		const user = await this.userRepo.findProfileById(userId);

		const userPermissions: UserPermissions = await this.authorizationChecker.getUserPermissionDetails(userId);
		const isEmailVerified: boolean = user.emailVerifiedAt !== null && user.emailVerifiedAt <= Date.now();

		return this.mapper.build(user, userPermissions, isEmailVerified);
	}
}
