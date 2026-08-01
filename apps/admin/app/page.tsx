import { redirect } from "next/navigation";

/** Redirect rule for the admin root path — sends to admin login. */
export default function AdminRootPage(): never {
	redirect("/auth/login");
}
