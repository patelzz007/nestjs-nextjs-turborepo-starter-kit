import { redirect } from "next/navigation";

/** Redirect rule for the root path — sends unauthenticated users to login. */
export default function RootPage(): never {
	redirect("/auth/login");
}
