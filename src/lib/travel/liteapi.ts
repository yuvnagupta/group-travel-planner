import "server-only";

import type { HotelOption } from "./types";

const BASE_URL = "https://api.liteapi.travel/v3.0";

export class LiteApiError extends Error {}

async function liteApi<T>(path: string, body: unknown): Promise<T> {
  const key = process.env.LITEAPI_API_KEY;
  if (!key) {
    throw new LiteApiError(
      "Hotel search isn't set up yet: add LITEAPI_API_KEY to .env.local.",
    );
  }

  const res = await fetch(`${BASE_URL}${path}`, {
    method: "POST",
    headers: {
      "X-API-Key": key,
      Accept: "application/json",
      "Content-Type": "application/json",
    },
    body: JSON.stringify(body),
    cache: "no-store",
  });

  const text = await res.text();
  let json: { error?: { message?: string } } | null = null;
  try {
    json = JSON.parse(text);
  } catch {}

  if (!res.ok) {
    console.error(
      "LiteAPI request failed",
      res.status,
      path,
      json?.error ?? text.slice(0, 200),
    );
    if (res.status === 401 || res.status === 403)
      throw new LiteApiError(
        "The LiteAPI key was rejected. Check LITEAPI_API_KEY.",
      );
    if (res.status === 429)
      throw new LiteApiError(
        "Too many searches right now. Wait a moment and try again.",
      );
    throw new LiteApiError(
      json?.error?.message ?? "The search failed. Try again.",
    );
  }
  if (!json)
    throw new LiteApiError("LiteAPI sent an unexpected response. Try again.");
  return json as T;
}

// Raw LiteAPI shapes: only the fields we read.
type RawPrice = { amount: number; currency: string };

type RawRates = {
  data?: {
    hotelId: string;
    roomTypes: {
      // Documented as an array but returned as an object; accept both.
      offerRetailRate: RawPrice | RawPrice[];
    }[];
  }[];
  hotels?: {
    id: string;
    name: string;
    main_photo?: string | null;
    address?: string | null;
    city_name?: string | null;
    country_code?: string | null;
    rating?: number | null;
    stars?: number | null;
  }[];
};

export type HotelSearch = {
  latitude: number | null;
  longitude: number | null;
  placeCode: string | null;
  checkInDate: string;
  checkOutDate: string;
  adults: number;
  rooms: number;
};

/** One occupancy per room, with the adults spread as evenly as possible. */
function occupancies(adults: number, rooms: number) {
  return Array.from({ length: rooms }, (_, i) => ({
    adults: Math.floor(adults / rooms) + (i < adults % rooms ? 1 : 0),
  }));
}

export async function searchHotels(
  search: HotelSearch,
): Promise<HotelOption[]> {
  const where =
    search.latitude !== null && search.longitude !== null
      ? {
          latitude: search.latitude,
          longitude: search.longitude,
          radius: 10_000,
        }
      : { iataCode: search.placeCode };

  const data = await liteApi<RawRates>("/hotels/rates", {
    ...where,
    checkin: search.checkInDate,
    checkout: search.checkOutDate,
    occupancies: occupancies(search.adults, search.rooms),
    currency: "USD",
    guestNationality: "US",
    maxRatesPerHotel: 1,
    includeHotelData: true,
    limit: 100,
    timeout: 10,
  });

  const hotels = new Map((data.hotels ?? []).map((h) => [h.id, h]));

  return (data.data ?? [])
    .flatMap((r) => {
      const hotel = hotels.get(r.hotelId);
      const offer = r.roomTypes[0];
      const price = [offer?.offerRetailRate].flat()[0];
      if (!hotel || !offer || !price) return [];
      return [
        {
          resultId: r.hotelId,
          name: hotel.name,
          photoUrl: hotel.main_photo || null,
          rating: hotel.stars ? Math.round(hotel.stars) : null,
          reviewScore: hotel.rating || null,
          address:
            [hotel.address, hotel.city_name, hotel.country_code]
              .filter(Boolean)
              .join(", ") || null,
          totalAmount: price.amount.toFixed(2),
          totalCurrency: price.currency,
          checkInDate: search.checkInDate,
          checkOutDate: search.checkOutDate,
          guests: search.adults,
          rooms: search.rooms,
        },
      ];
    })
    .sort((a, b) => Number(a.totalAmount) - Number(b.totalAmount))
    .slice(0, 30);
}
