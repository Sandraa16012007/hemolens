export interface LocationResult {
  formattedLocation: string;
  latitude: number;
  longitude: number;
  city?: string;
  state?: string;
  country?: string;
  isIpFallback?: boolean;
}

/**
 * Fetches location using free IP-based geolocation services.
 */
export async function fetchIpLocation(): Promise<LocationResult> {
  // Primary IP geolocation service: ipapi.co
  try {
    const res = await fetch("https://ipapi.co/json/");
    if (res.ok) {
      const data = await res.json();
      if (data && !data.error) {
        const city = data.city;
        const state = data.region || data.region_code;
        const country = data.country_name;
        const locationParts = [city, state, country].filter(Boolean);
        const formattedLocation =
          locationParts.length > 0
            ? locationParts.join(", ")
            : `${data.latitude}, ${data.longitude}`;

        return {
          formattedLocation,
          latitude: data.latitude || 0,
          longitude: data.longitude || 0,
          city,
          state,
          country,
          isIpFallback: true,
        };
      }
    }
  } catch (err) {
    console.warn("ipapi.co lookup failed, trying fallback:", err);
  }

  // Secondary IP geolocation service: ipwho.is
  try {
    const res = await fetch("https://ipwho.is/");
    if (res.ok) {
      const data = await res.json();
      if (data && data.success !== false) {
        const city = data.city;
        const state = data.region;
        const country = data.country;
        const locationParts = [city, state, country].filter(Boolean);
        const formattedLocation =
          locationParts.length > 0
            ? locationParts.join(", ")
            : `${data.latitude}, ${data.longitude}`;

        return {
          formattedLocation,
          latitude: data.latitude || 0,
          longitude: data.longitude || 0,
          city,
          state,
          country,
          isIpFallback: true,
        };
      }
    }
  } catch (err) {
    console.warn("ipwho.is lookup failed:", err);
  }

  throw new Error("IP geolocation service unavailable.");
}

/**
 * Fetches the user's current geographic position via Browser Geolocation API
 * with fast settings (enableHighAccuracy: false).
 * Automatically falls back to IP-based geolocation if browser geolocation fails or times out.
 */
export async function getCurrentLocation(): Promise<LocationResult> {
  if (typeof window === "undefined") {
    throw new Error("Location services are not available on the server.");
  }

  // If navigator.geolocation is not available, jump straight to IP fallback
  if (!navigator.geolocation) {
    return fetchIpLocation();
  }

  const options: PositionOptions = {
    enableHighAccuracy: false, // Resolve quickly via IP/WiFi triangulation
    timeout: 10000,            // 10 seconds timeout
    maximumAge: 60000,         // Cache location for up to 1 minute
  };

  return new Promise((resolve, reject) => {
    navigator.geolocation.getCurrentPosition(
      async (position) => {
        try {
          const { latitude, longitude } = position.coords;
          const res = await fetch(
            `https://nominatim.openstreetmap.org/reverse?format=json&lat=${latitude}&lon=${longitude}&zoom=10`,
            {
              headers: {
                "Accept-Language": "en",
              },
            }
          );

          if (!res.ok) {
            return resolve({
              formattedLocation: `${latitude.toFixed(4)}, ${longitude.toFixed(4)}`,
              latitude,
              longitude,
            });
          }

          const data = await res.json();
          const address = data.address || {};
          const city =
            address.city ||
            address.town ||
            address.village ||
            address.suburb ||
            address.municipality ||
            address.county;
          const state = address.state || address.region;
          const country = address.country;

          const locationParts = [city, state, country].filter(Boolean);
          const formattedLocation =
            locationParts.length > 0
              ? locationParts.join(", ")
              : data.display_name || `${latitude.toFixed(4)}, ${longitude.toFixed(4)}`;

          resolve({
            formattedLocation,
            latitude,
            longitude,
            city,
            state,
            country,
            isIpFallback: false,
          });
        } catch (error) {
          console.error("Reverse geocoding error:", error);
          // Try IP fallback if reverse geocoding failed
          try {
            const ipLoc = await fetchIpLocation();
            resolve(ipLoc);
          } catch {
            resolve({
              formattedLocation: `${position.coords.latitude.toFixed(4)}, ${position.coords.longitude.toFixed(4)}`,
              latitude: position.coords.latitude,
              longitude: position.coords.longitude,
            });
          }
        }
      },
      async (error) => {
        console.warn("Browser geolocation failed or timed out:", error.message, "Falling back to IP geolocation...");
        try {
          const ipLoc = await fetchIpLocation();
          resolve(ipLoc);
        } catch {
          let errorMessage = "Failed to detect location.";
          switch (error.code) {
            case error.PERMISSION_DENIED:
              errorMessage = "Location permission denied. Please allow location access or type location manually.";
              break;
            case error.POSITION_UNAVAILABLE:
              errorMessage = "Location information is unavailable. Please try typing your city manually.";
              break;
            case error.TIMEOUT:
              errorMessage = "Location request timed out. Please try again or enter city manually.";
              break;
          }
          reject(new Error(errorMessage));
        }
      },
      options
    );
  });
}
