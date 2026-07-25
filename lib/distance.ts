export function calculateDistanceKm(
  from?: { latitude?: number | null; longitude?: number | null },
  to?: { latitude?: number | null; longitude?: number | null }
) {
  if (!from?.latitude || !from?.longitude || !to?.latitude || !to?.longitude) return null;

  const radiusKm = 6371;
  const dLat = degreesToRadians(to.latitude - from.latitude);
  const dLon = degreesToRadians(to.longitude - from.longitude);
  const lat1 = degreesToRadians(from.latitude);
  const lat2 = degreesToRadians(to.latitude);

  const a =
    Math.sin(dLat / 2) * Math.sin(dLat / 2) +
    Math.cos(lat1) * Math.cos(lat2) * Math.sin(dLon / 2) * Math.sin(dLon / 2);
  const c = 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1 - a));

  return Number((radiusKm * c).toFixed(1));
}

function degreesToRadians(degrees: number) {
  return degrees * (Math.PI / 180);
}
