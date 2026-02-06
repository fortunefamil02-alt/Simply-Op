/**
 * GPS Validation Utilities
 *
 * Server-side GPS validation for job completion.
 * Prevents spoofing of job completion location.
 *
 * File: server/utils/gps-validation.ts
 */

/**
 * Calculate distance between two GPS coordinates using Haversine formula
 *
 * @param lat1 - Latitude of point 1 (degrees)
 * @param lon1 - Longitude of point 1 (degrees)
 * @param lat2 - Latitude of point 2 (degrees)
 * @param lon2 - Longitude of point 2 (degrees)
 * @returns Distance in meters
 */
export function calculateDistance(
  lat1: number,
  lon1: number,
  lat2: number,
  lon2: number
): number {
  const R = 6371000; // Earth's radius in meters
  const dLat = toRadians(lat2 - lat1);
  const dLon = toRadians(lon2 - lon1);

  const a =
    Math.sin(dLat / 2) * Math.sin(dLat / 2) +
    Math.cos(toRadians(lat1)) *
      Math.cos(toRadians(lat2)) *
      Math.sin(dLon / 2) *
      Math.sin(dLon / 2);

  const c = 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1 - a));
  const distance = R * c;

  return distance;
}

/**
 * Convert degrees to radians
 */
function toRadians(degrees: number): number {
  return (degrees * Math.PI) / 180;
}

/**
 * Validate GPS coordinates are within allowed radius of property
 *
 * @param propertyLat - Property latitude (degrees)
 * @param propertyLon - Property longitude (degrees)
 * @param clientLat - Client-provided latitude (degrees)
 * @param clientLon - Client-provided longitude (degrees)
 * @param radiusMeters - Allowed radius in meters (default: 50m)
 * @returns { valid: boolean, distance: number, error?: string }
 */
export function validateGPSRadius(
  propertyLat: number | string,
  propertyLon: number | string,
  clientLat: number,
  clientLon: number,
  radiusMeters: number = 50
): { valid: boolean; distance: number; error?: string } {
  // Parse property coordinates (may be stored as strings in database)
  const pLat = typeof propertyLat === "string" ? parseFloat(propertyLat) : propertyLat;
  const pLon = typeof propertyLon === "string" ? parseFloat(propertyLon) : propertyLon;

  // Validate input coordinates
  if (
    !isValidLatitude(pLat) ||
    !isValidLongitude(pLon) ||
    !isValidLatitude(clientLat) ||
    !isValidLongitude(clientLon)
  ) {
    return {
      valid: false,
      distance: -1,
      error: "Invalid GPS coordinates",
    };
  }

  // Calculate distance
  const distance = calculateDistance(pLat, pLon, clientLat, clientLon);

  // Check if within radius
  if (distance > radiusMeters) {
    return {
      valid: false,
      distance,
      error: `GPS location is ${Math.round(distance)}m away from property. Maximum allowed: ${radiusMeters}m`,
    };
  }

  return {
    valid: true,
    distance,
  };
}

/**
 * Validate latitude is within valid range
 */
function isValidLatitude(lat: number): boolean {
  return !isNaN(lat) && lat >= -90 && lat <= 90;
}

/**
 * Validate longitude is within valid range
 */
function isValidLongitude(lon: number): boolean {
  return !isNaN(lon) && lon >= -180 && lon <= 180;
}

/**
 * Validate GPS coordinates have reasonable precision
 * Prevents obviously fake coordinates (e.g., 0,0)
 *
 * @param lat - Latitude
 * @param lon - Longitude
 * @returns true if coordinates have reasonable precision
 */
export function hasReasonablePrecision(lat: number, lon: number): boolean {
  // Reject obviously fake coordinates
  if (lat === 0 && lon === 0) {
    return false;
  }

  // Reject coordinates with insufficient decimal places (less than 4 decimals = ~11m precision)
  // This prevents low-precision spoofing attempts
  const latStr = lat.toString();
  const lonStr = lon.toString();

  const latDecimals = latStr.includes(".") ? latStr.split(".")[1].length : 0;
  const lonDecimals = lonStr.includes(".") ? lonStr.split(".")[1].length : 0;

  // Require at least 4 decimal places (11m precision)
  return latDecimals >= 4 && lonDecimals >= 4;
}
