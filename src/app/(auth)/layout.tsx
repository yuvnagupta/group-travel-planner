import { Suspense } from "react";

import { RedirectIfSignedIn } from "@/components/auth/redirect-if-signed-in";

export default function AuthLayout({ children }: LayoutProps<"/">) {
  return (
    <div className="flex flex-1 items-center justify-center px-4 py-16">
      <Suspense fallback={null}>
        <RedirectIfSignedIn />
      </Suspense>
      <div className="w-full max-w-sm">{children}</div>
    </div>
  );
}
