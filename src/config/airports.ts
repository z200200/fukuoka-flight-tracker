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
	tokyo: {
		id: "tokyo",
		name: "东京",
		fullName: "东京机场（成田+羽田）",
		icao: "RJTT/RJAA",
		iata: "HND/NRT",
		latitude: 35.657,  // 两机场中心点
		longitude: 140.083,
		radiusKm: 120,  // 扩大范围覆盖两个机场
		description: "东京羽田+成田机场",
	},
	incheon: {
		id: "incheon",
		name: "首尔",
		fullName: "首尔仁川机场",
		icao: "RKSI",
		iata: "ICN",
		latitude: 37.4602,
		longitude: 126.4407,
		radiusKm: 100,
		description: "韩国最大国际机场",
	},
};

export const DEFAULT_AIRPORT = "fukuoka";

export type AirportId = keyof typeof AIRPORTS;
