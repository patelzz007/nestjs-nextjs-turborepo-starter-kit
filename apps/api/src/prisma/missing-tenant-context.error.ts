export class MissingTenantContextError extends Error {
	public constructor(message: string = "Database access requires an explicit tenant or system operation context") {
		super(message);
		this.name = "MissingTenantContextError";
	}
}
