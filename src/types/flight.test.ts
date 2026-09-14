import { describe, it, expect } from 'vitest';
import { FlightSchema } from './flight';

describe('FlightSchema', () => {
  const validFlight = {
    icao24: '780123',
    callsign: 'JAL310',
    latitude: 33.58,
    longitude: 130.45,
    altitude: 10000,
    velocity: 230,
    heading: 90,
    onGround: false,
    originCountry: 'Japan',
    lastContact: 1234567890,
    departureAirport: null,
    arrivalAirport: null,
  };

  it('accepts a well-formed flight record', () => {
    const result = FlightSchema.safeParse(validFlight);
    expect(result.success).toBe(true);
  });

  it('accepts null callsign/altitude/velocity/heading (adsb.lol 常见缺失字段)', () => {
    const result = FlightSchema.safeParse({
      ...validFlight,
      callsign: null,
      altitude: null,
      velocity: null,
      heading: null,
    });
    expect(result.success).toBe(true);
  });

  it('rejects a record missing required numeric fields', () => {
    const { latitude: _latitude, ...missingLatitude } = validFlight;
    const result = FlightSchema.safeParse(missingLatitude);
    expect(result.success).toBe(false);
  });

  it('rejects a record with wrong field types (e.g. latitude as string)', () => {
    const result = FlightSchema.safeParse({ ...validFlight, latitude: 'not-a-number' });
    expect(result.success).toBe(false);
  });

  it('rejects an empty icao24', () => {
    const result = FlightSchema.safeParse({ ...validFlight, icao24: '' });
    expect(result.success).toBe(false);
  });
});
