import { NextResponse, type NextRequest } from "next/server";

import { getCurrentUser } from "@/lib/auth";
import { DuffelError, suggestPlaces } from "@/lib/travel/duffel";

// Airport and city autocomplete for the search forms. Signed-in users only, so the
// Duffel token can't be used by anyone on the internet.
export async function GET(request: NextRequest) {
  if (!(await getCurrentUser())) {
    return NextResponse.json({ error: "Not signed in." }, { status: 401 });
  }

  const query = request.nextUrl.searchParams.get("q")?.trim() ?? "";
  if (query.length < 2 || query.length > 60)
    return NextResponse.json({ places: [] });

  try {
    return NextResponse.json({ places: await suggestPlaces(query) });
  } catch (error) {
    if (error instanceof DuffelError)
      return NextResponse.json({ error: error.message }, { status: 502 });
    throw error;
  }
}
