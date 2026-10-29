import type { Metadata } from "next";
import { Suspense } from "react";

import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";
import { requireUser } from "@/lib/auth";

import { NewTripForm } from "./new-trip-form";

export const metadata: Metadata = { title: "New trip" };

export default function NewTripPage() {
  return (
    <div className="mx-auto w-full max-w-lg px-4 py-10 sm:px-6">
      <Card>
        <CardHeader>
          <CardTitle className="text-xl">New trip</CardTitle>
          <CardDescription>
            You can invite people once the trip is created.
          </CardDescription>
        </CardHeader>
        <CardContent>
          <Suspense fallback={null}>
            <SignedInForm />
          </Suspense>
        </CardContent>
      </Card>
    </div>
  );
}

async function SignedInForm() {
  await requireUser();
  return <NewTripForm />;
}
