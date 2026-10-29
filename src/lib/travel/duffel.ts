import "server-only";

import type { FlightOption, Place } from "./types";

const BASE_URL = "https://api.duffel.com";

export class DuffelError extends Error {}

async function duffel<T>(
  path: string,
  init?: { method?: string; body?: unknown },
): Promise<T> {
  const token = process.env.DUFFEL_ACCESS_TOKEN;
  if (!token) {
    throw new DuffelError(
      "Search isn't set up yet: add DUFFEL_ACCESS_TOKEN to .env.local.",
    );
  }

  const res = await fetch(`${BASE_URL}${path}`, {
    method: init?.method ?? "GET",
    headers: {
      Authorization: `Bearer ${token}`,
      "Duffel-Version": "v2",
      Accept: "application/json",
      "Accept-Encoding": "gzip",
      ...(init?.body ? { "Content-Type": "application/json" } : {}),
    },
    body: init?.body ? JSON.stringify({ data: init.body }) : undefined,
    cache: "no-store",
  });

  // Some errors (e.g. a product not enabled on the account) come back as plain text, not JSON.
  const text = await res.text();
  let json: { data?: unknown; errors?: { message?: string }[] } | null = null;
  try {
    json = JSON.parse(text);
  } catch {}

  if (!res.ok) {
    const first = json?.errors?.[0];
    console.error(
      "Duffel request failed",
      res.status,
      path,
      json?.errors ?? text.slice(0, 200),
    );
    if (res.status === 401)
      throw new DuffelError(
        "The Duffel access token was rejected. Check DUFFEL_ACCESS_TOKEN.",
      );
    if (res.status === 403)
      throw new DuffelError(
        first?.message ?? "Your Duffel account doesn't have access to this.",
      );
    if (res.status === 429)
      throw new DuffelError(
        "Too many searches right now. Wait a moment and try again.",
      );
    throw new DuffelError(first?.message ?? "The search failed. Try again.");
  }
  if (!json)
    throw new DuffelError("Duffel sent an unexpected response. Try again.");
  return json.data as T;
}

// Raw Duffel shapes: only the fields we read.
type RawPlace = {
  type: "airport" | "city";
  iata_code: string;
  name: string;
  city_name?: string | null;
  iata_country_code?: string | null;
  latitude?: number | null;
  longitude?: number | null;
};

type RawSegment = {
  departing_at: string;
  arriving_at: string;
  marketing_carrier?: { iata_code?: string } | null;
  marketing_carrier_flight_number?: string | null;
};

type RawOffer = {
  id: string;
  total_amount: string;
  total_currency: string;
  owner: { name: string; logo_symbol_url?: string | null };
  passengers: unknown[];
  slices: {
    origin: { iata_code: string; city_name?: string | null };
    destination: { iata_code: string; city_name?: string | null };
    duration?: string | null;
    fare_brand_name?: string | null;
    segments: (RawSegment & { passengers?: { cabin_class?: string }[] })[];
  }[];
};

export async function suggestPlaces(query: string): Promise<Place[]> {
  const data = await duffel<RawPlace[]>(
    `/places/suggestions?query=${encodeURIComponent(query)}`,
  );
  return data.slice(0, 8).map((p) => ({
    type: p.type,
    iataCode: p.iata_code,
    name: p.name,
    cityName: p.city_name ?? null,
    countryCode: p.iata_country_code ?? null,
    latitude: p.latitude ?? null,
    longitude: p.longitude ?? null,
  }));
}

export type FlightSearch = {
  origin: string;
  destination: string;
  departureDate: string;
  returnDate: string | null;
  adults: number;
  cabinClass: "economy" | "premium_economy" | "business" | "first";
};

export async function searchFlights(
  search: FlightSearch,
): Promise<FlightOption[]> {
  const slices = [
    {
      origin: search.origin,
      destination: search.destination,
      departure_date: search.departureDate,
    },
  ];
  if (search.returnDate) {
    slices.push({
      origin: search.destination,
      destination: search.origin,
      departure_date: search.returnDate,
    });
  }

  const request = await duffel<{ id: string }>(
    "/air/offer_requests?return_offers=false&supplier_timeout=15000",
    {
      method: "POST",
      body: {
        slices,
        passengers: Array.from({ length: search.adults }, () => ({
          type: "adult",
        })),
        cabin_class: search.cabinClass,
        max_connections: 1,
      },
    },
  );

  const offers = await duffel<RawOffer[]>(
    `/air/offers?offer_request_id=${request.id}&sort=total_amount&limit=25`,
  );
  return offers.map(normalizeOffer);
}

function normalizeOffer(offer: RawOffer): FlightOption {
  return {
    offerId: offer.id,
    airline: {
      name: offer.owner.name,
      logoUrl: offer.owner.logo_symbol_url ?? null,
    },
    totalAmount: offer.total_amount,
    totalCurrency: offer.total_currency,
    cabinClass:
      offer.slices[0]?.segments[0]?.passengers?.[0]?.cabin_class ?? null,
    passengers: offer.passengers.length,
    slices: offer.slices.map((slice) => {
      const first = slice.segments[0];
      const last = slice.segments[slice.segments.length - 1];
      return {
        origin: {
          code: slice.origin.iata_code,
          city: slice.origin.city_name ?? null,
        },
        destination: {
          code: slice.destination.iata_code,
          city: slice.destination.city_name ?? null,
        },
        departingAt: first.departing_at,
        arrivingAt: last.arriving_at,
        duration: slice.duration ?? null,
        stops: slice.segments.length - 1,
        flightNumbers: slice.segments.map(
          (s) =>
            `${s.marketing_carrier?.iata_code ?? ""}${s.marketing_carrier_flight_number ?? ""}`,
        ),
      };
    }),
  };
}
