// Airport configuration for flight tracking

export interface AirportConfig {
	id: string;
	name: string;
	fullName: string;
	icao: string;
	iata: string;
	latitude: number;
	longitude: number;
	radiusKm: number;
	description: string;
}

export const AIRPORTS: Record<string, AirportConfig> = {
	fukuoka: {
		id: "fukuoka",
		name: "福冈",
		fullName: "福冈机场",
		icao: "RJFF",
		iata: "FUK",
		latitude: 33.5859,
		longitude: 130.451,
		radiusKm: 100,
		description: "日本福冈国际机场",
	},
	dubai: {
		id: "dubai",
		name: "迪拜",
		fullName: "迪拜国际机场",
		icao: "OMDB",
		iata: "DXB",
		latitude: 25.2532,
		longitude: 55.3657,
		radiusKm: 100,
		description: "世界最繁忙的24小时机场",
	},
};

export const DEFAULT_AIRPORT = "fukuoka";

export type AirportId = keyof typeof AIRPORTS;
