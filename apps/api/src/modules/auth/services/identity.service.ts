import { ConflictException, Injectable } from "@nestjs/common";
import type { AccessTokenPayload, SignupInput, SignupResponse, SessionPermissionsResponse, UserResponse, UserPermissions } from "@workspace/shared";

import { LogService } from "../../../modules/logs/logs.service";
import { PrismaService } from "../../../prisma/prisma.service";
import { AuthorizationCheckerService } from "../../authorization/services/authorization-checker.service";
import { UserSessionCacheService } from "../cache/user-session-cache.service";
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
	public constructor(
		private readonly prisma: PrismaService,
		private readonly userRepo: UserRepository,
		private readonly cryptoService: CryptoService,
		private readonly tokenService: TokenService,
		private readonly authorizationChecker: AuthorizationCheckerService,
		private readonly authEvents: AuthEventsService,
		private readonly logService: LogService,
		private readonly mapper: UserResponseMapper,
		private readonly sessionCache: UserSessionCacheService,
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

		const profile = this.mapper.build(newUser, userPermissions, false);
		await this.warmSessionCache(newUser.id, profile);

		return {
			user: profile,
			verificationToken,
			message: "User registered successfully",
		};
	}

	public async getMe(userId: string): Promise<UserResponse> {
		const cached = await this.sessionCache.getMe(userId);
		if (cached !== null) {
			return cached;
		}
		const response = await this.getUserResponse(userId);
		await this.sessionCache.setMe(userId, response);
		return response;
	}

	public async getSessionPermissions(userId: string, accessPayload?: AccessTokenPayload): Promise<SessionPermissionsResponse> {
		const cached = await this.sessionCache.getPermissions(userId);
		const base = cached ?? (await this.buildAndCacheSessionPermissions(userId));
		return {
			roles: base.roles,
			permissions: base.permissions,
			capabilities: base.capabilities,
			tokenVersion: base.tokenVersion,
			hasAdminAccess: base.hasAdminAccess,
			isImpersonating: accessPayload?.isImpersonating,
			originalUserId: accessPayload?.originalUserId,
		};
	}

	/**
	 * Warm Redis (or in-memory) session cache after login — shared by web, admin, and merchant.
	 */
	public async warmSessionCache(userId: string, profile: UserResponse): Promise<void> {
		await this.sessionCache.setMe(userId, profile);
		const permissions = await this.buildSessionPermissions(userId);
		await this.sessionCache.setPermissions(userId, permissions);
	}

	/**
	 * Drop cached `/auth/me` and `/auth/permissions` payloads for a user.
	 *
	 * Called when roles or permissions change so clients refetch fresh data.
	 */
	public invalidateMe(userId: string): void {
		void this.sessionCache.invalidate(userId);
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

	private async buildSessionPermissions(userId: string): Promise<SessionPermissionsResponse> {
		const user = await this.userRepo.findProfileById(userId);
		const userPermissions: UserPermissions = await this.authorizationChecker.getUserPermissionDetails(userId);
		const capabilities = await this.authorizationChecker.getUserCapabilitySlugs(userId);
		const profile = this.mapper.build(user, userPermissions, user.emailVerifiedAt !== null && user.emailVerifiedAt <= Date.now());
		return {
			roles: userPermissions.roles,
			permissions: userPermissions.permissions,
			capabilities: [...capabilities],
			tokenVersion: profile.tokenVersion,
			hasAdminAccess: profile.hasAdminAccess,
		};
	}

	private async buildAndCacheSessionPermissions(userId: string): Promise<SessionPermissionsResponse> {
		const response = await this.buildSessionPermissions(userId);
		await this.sessionCache.setPermissions(userId, response);
		return response;
	}
}
