import { CalendarDays, Users, Wallet } from "lucide-react";
import Link from "next/link";
import { Suspense } from "react";

import { buttonVariants } from "@/components/ui/button";
import { getCurrentUser } from "@/lib/auth";

import { TripDashboard } from "./trip-dashboard";

const features = [
  {
    icon: CalendarDays,
    title: "Shared itinerary",
    description: "Build day-by-day plans everyone can see and edit.",
  },
  {
    icon: Users,
    title: "Group decisions",
    description: "Invite your group and vote on where to go and what to do.",
  },
  {
    icon: Wallet,
    title: "Split expenses",
    description: "Track who paid for what and settle up at the end.",
  },
];

export default function Home() {
  return (
    // Reads the session to choose between the dashboard and the landing page.
    <Suspense fallback={null}>
      <HomeContent />
    </Suspense>
  );
}

async function HomeContent() {
  const user = await getCurrentUser();
  return user ? <TripDashboard user={user} /> : <Landing />;
}

function Landing() {
  return (
    <div className="mx-auto flex w-full max-w-6xl flex-1 flex-col gap-16 px-4 py-20 sm:px-6">
      <section className="flex max-w-2xl flex-col gap-4">
        <h1 className="text-4xl font-semibold tracking-tight sm:text-5xl">
          Plan trips together.
        </h1>
        <p className="text-lg text-muted-foreground">
          One place for your group&apos;s itinerary, decisions and shared costs.
        </p>
        <div className="mt-2 flex flex-wrap gap-3">
          <Link href="/signup" className={buttonVariants({ size: "lg" })}>
            Get started
          </Link>
          <Link
            href="/trips"
            className={buttonVariants({ variant: "outline", size: "lg" })}
          >
            Go to my trips
          </Link>
        </div>
      </section>

      <section className="grid gap-4 sm:grid-cols-3">
        {features.map(({ icon: Icon, title, description }) => (
          <div
            key={title}
            className="rounded-xl border bg-card p-6 text-card-foreground"
          >
            <Icon className="mb-4 size-6 text-muted-foreground" aria-hidden />
            <h2 className="font-medium">{title}</h2>
            <p className="mt-1 text-sm text-muted-foreground">{description}</p>
          </div>
        ))}
      </section>
    </div>
  );
}
