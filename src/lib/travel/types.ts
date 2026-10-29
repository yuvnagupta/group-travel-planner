// Normalized search results shared by the server and the search UI.

export type Place = {
  type: "airport" | "city";
  iataCode: string;
  name: string;
  cityName: string | null;
  countryCode: string | null;
  latitude: number | null;
  longitude: number | null;
};

export type FlightSlice = {
  origin: { code: string; city: string | null };
  destination: { code: string; city: string | null };
  departingAt: string;
  arrivingAt: string;
  /** ISO 8601 duration, e.g. "PT7H25M". */
  duration: string | null;
  stops: number;
  flightNumbers: string[];
};

export type FlightOption = {
  offerId: string;
  airline: { name: string; logoUrl: string | null };
  totalAmount: string;
  totalCurrency: string;
  cabinClass: string | null;
  passengers: number;
  slices: FlightSlice[];
};

export type HotelOption = {
  resultId: string;
  name: string;
  photoUrl: string | null;
  rating: number | null;
  reviewScore: number | null;
  address: string | null;
  totalAmount: string;
  totalCurrency: string;
  checkInDate: string;
  checkOutDate: string;
  guests: number;
  rooms: number;
};

/** A search result plus a server signature, so it can be suggested without trusting the browser. */
export type Signed<T> = { option: T; payload: string; signature: string };
