import * as crypto from "crypto";

import { Injectable } from "@nestjs/common";
import * as bcrypt from "bcrypt";

import { TypedConfigService } from "../../../config/typed-config.service";

@Injectable()
export class CryptoService {
	private readonly saltRounds: number;

	constructor(private readonly config: TypedConfigService) {
		this.saltRounds = this.config.bcryptSaltRounds;
	}

	/**
	 * Hash a value using bcrypt with the configured salt rounds.
	 */
	public async hash(data: string): Promise<string> {
		return bcrypt.hash(data, this.saltRounds);
	}

	/**
	 * Compare a plaintext value against a bcrypt hash.
	 */
	public async compare(data: string, hash: string): Promise<boolean> {
		return bcrypt.compare(data, hash);
	}

	/**
	 * Generate a cryptographically random token string (64 hex chars).
	 * Used for password reset tokens and other one-time secrets.
	 */
	public generateRandomToken(): string {
		return crypto.randomBytes(32).toString("hex");
	}
}
