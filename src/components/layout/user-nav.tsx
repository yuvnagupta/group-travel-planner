import Link from "next/link";

import { logout } from "@/app/actions/auth";
import { Button, buttonVariants } from "@/components/ui/button";
import { getCurrentUser } from "@/lib/auth";

export async function UserNav() {
  const user = await getCurrentUser();

  if (!user) {
    return (
      <nav className="flex items-center gap-1">
        <Link
          href="/login"
          className={buttonVariants({ variant: "ghost", size: "sm" })}
        >
          Log in
        </Link>
        <Link href="/signup" className={buttonVariants({ size: "sm" })}>
          Sign up
        </Link>
      </nav>
    );
  }

  return (
    <nav className="flex items-center gap-1">
      <Link
        href="/trips"
        className={buttonVariants({ variant: "ghost", size: "sm" })}
      >
        My trips
      </Link>
      <span className="hidden px-2 text-sm text-muted-foreground sm:inline">
        @{user.username}
      </span>
      <form action={logout}>
        <Button type="submit" variant="outline" size="sm">
          Log out
        </Button>
      </form>
    </nav>
  );
}
