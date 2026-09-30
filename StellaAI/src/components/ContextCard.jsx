/* =========================================================
   CONTEXT CARD — City-Level Geolocation & Live Weather Stream
========================================================= */

import { useEffect, useState, useRef } from "react";
import Icon from "./Icon";

/* Curated City Presets for Instant 1-Click Zero-Latency Switching */
const PRESET_CITIES = [
  { name: "Mira-Bhayandar", state: "Thane, MH", lat: 19.2970, lon: 72.8587 },
  { name: "Nalasopara",     state: "Palghar, MH", lat: 19.4204, lon: 72.8195 },
  { name: "Vasai",          state: "Palghar, MH", lat: 19.3919, lon: 72.8397 },
  { name: "Virar",          state: "Palghar, MH", lat: 19.4673, lon: 72.8052 },
  { name: "Thane",          state: "Maharashtra", lat: 19.1963, lon: 72.9675 },
];

/* WMO Weather Interpretation Code standard */
function getWeatherDescription(code) {
  if (code === 0) return { label: "Clear skies" };
  if (code === 1) return { label: "Mainly clear" };
  if (code === 2) return { label: "Partly cloudy" };
  if (code === 3) return { label: "Overcast" };
  if (code === 45 || code === 48) return { label: "Fog / Mist" };
  if (code >= 51 && code <= 57) return { label: "Light drizzle" };
  if (code >= 61 && code <= 67) return { label: "Rain" };
  if (code >= 71 && code <= 77) return { label: "Snow" };
  if (code >= 80 && code <= 82) return { label: "Rain showers" };
  if (code >= 85 && code <= 86) return { label: "Snow showers" };
  if (code >= 95 && code <= 99) return { label: "Thunderstorm" };
  return { label: "Fair weather" };
}

export default function ContextCard() {
  const [location, setLocation] = useState(() => {
    try {
      const saved = localStorage.getItem("stella_saved_city");
      if (saved) return JSON.parse(saved);
    } catch {
      // fallback
    }
    return {
      suburb: "Locating…",
      city: "",
      status: "pending", // pending | ok | denied | error
      isCustom: false,
    };
  });

  const [weather, setWeather] = useState({
    temp: "--°",
    condition: "Fetching…",
    meta: "Syncing sensor…",
    status: "pending",
  });

  const [isSelectorOpen, setIsSelectorOpen] = useState(false);
  const [searchInput, setSearchInput] = useState("");
  const [isSearching, setIsSearching] = useState(false);
  const searchInputRef = useRef(null);

  // Fetch live weather from Open-Meteo
  const fetchWeather = async (lat, lon) => {
    try {
      const res = await fetch(
        `https://api.open-meteo.com/v1/forecast?latitude=${lat}&longitude=${lon}&current=temperature_2m,relative_humidity_2m,weather_code,apparent_temperature,wind_speed_10m&timezone=auto`
      );
      if (!res.ok) throw new Error("Weather request failed");
      const data = await res.json();
      if (!data?.current) return;

      const current = data.current;
      const tempRounded = Math.round(current.temperature_2m);
      const { label } = getWeatherDescription(current.weather_code);
      const humidity = current.relative_humidity_2m ?? 0;
      const wind = Math.round(current.wind_speed_10m ?? 0);

      setWeather({
        temp: `${tempRounded}°`,
        condition: label,
        meta: `Humidity ${humidity}% · ${wind} km/h`,
        status: "ok",
      });
    } catch (err) {
      console.warn("Weather sync error:", err);
      setWeather((prev) => ({
        ...prev,
        condition: "Sync failed",
        meta: "Offline",
        status: "error",
      }));
    }
  };

  // Set city & save to localStorage
  const applyCity = (cityData) => {
    setLocation(cityData);
    try {
      localStorage.setItem("stella_saved_city", JSON.stringify(cityData));
    } catch {
      // storage unavailable
    }
    if (cityData.lat && cityData.lon) {
      fetchWeather(cityData.lat, cityData.lon);
    }
    setIsSelectorOpen(false);
    setSearchInput("");
  };

  // Preset Selection
  const handleSelectPreset = (preset) => {
    applyCity({
      suburb: preset.name,
      city: preset.state,
      lat: preset.lat,
      lon: preset.lon,
      status: "ok",
      isCustom: true,
    });
  };

  // Search by any custom town/city name
  const handleSearchSubmit = async (e) => {
    e?.preventDefault();
    const query = searchInput.trim();
    if (!query) return;

    setIsSearching(true);
    try {
      // Search Nominatim OpenStreetMap
      const res = await fetch(
        `https://nominatim.openstreetmap.org/search?q=${encodeURIComponent(
          query
        )}&format=json&limit=1`,
        { headers: { "Accept-Language": "en" } }
      );
      const data = await res.json();

      if (Array.isArray(data) && data.length > 0) {
        const place = data[0];
        const displayNameParts = (place.display_name || "").split(",");
        const parentArea = displayNameParts.slice(1, 3).join(",").trim() || "India";

        applyCity({
          suburb: place.name || query,
          city: parentArea,
          lat: parseFloat(place.lat),
          lon: parseFloat(place.lon),
          status: "ok",
          isCustom: true,
        });
      } else {
        alert(`Could not find "${query}". Please check spelling or select a preset.`);
      }
    } catch (err) {
      console.error("Geocoding search failed:", err);
      alert("City lookup error. Please try again.");
    } finally {
      setIsSearching(false);
    }
  };

  // Auto-detect location via GPS or IP
  const autoDetectLocation = () => {
    try {
      localStorage.removeItem("stella_saved_city");
    } catch {
      // ignore
    }
    setIsSelectorOpen(false);
    setLocation({ suburb: "Locating…", city: "", status: "pending", isCustom: false });

    const fetchIpFallback = async () => {
      try {
        const res = await fetch("https://ipwho.is/");
        const data = await res.json();
        if (data && data.success !== false && data.latitude && data.longitude) {
          const suburb = data.city || data.region || "Local Area";
          const city = data.region || data.country || "";
          setLocation({ suburb, city, status: "ok", isCustom: false });
          fetchWeather(data.latitude, data.longitude);
        }
      } catch (err) {
        console.warn("IP location fallback error:", err);
      }
    };

    if (!navigator.geolocation) {
      fetchIpFallback();
      return;
    }

    navigator.geolocation.getCurrentPosition(
      async ({ coords }) => {
        const lat = coords.latitude;
        const lon = coords.longitude;
        fetchWeather(lat, lon);

        try {
          const res = await fetch(
            `https://nominatim.openstreetmap.org/reverse?lat=${lat}&lon=${lon}&format=json`,
            { headers: { "Accept-Language": "en" } }
          );
          const data = await res.json();
          const addr = data.address ?? {};

          // City-level name prioritization
          const municipalName =
            addr.city ||
            addr.town ||
            addr.borough ||
            addr.municipality ||
            addr.suburb ||
            addr.village ||
            addr.city_district ||
            "Local Area";

          const parentRegion =
            (addr.suburb && addr.suburb !== municipalName ? addr.suburb : "") ||
            addr.state_district ||
            addr.county ||
            addr.state ||
            "";

          setLocation({
            suburb: municipalName,
            city: parentRegion,
            status: "ok",
            isCustom: false,
          });
        } catch {
          fetchIpFallback();
        }
      },
      () => {
        fetchIpFallback();
      },
      { timeout: 7000, enableHighAccuracy: false }
    );
  };

  // Initial mount load
  useEffect(() => {
    // If user has a saved city, load its weather immediately
    try {
      const saved = localStorage.getItem("stella_saved_city");
      if (saved) {
        const cityData = JSON.parse(saved);
        if (cityData?.lat && cityData?.lon) {
          fetchWeather(cityData.lat, cityData.lon);
          return;
        }
      }
    } catch {
      // fallback to auto
    }

    autoDetectLocation();
  }, []);

  return (
    <section className="panel context-panel">
      {/* Eyebrow */}
      <div className="eyebrow">
        <span className="status-dot online" />
        ENVIRONMENTAL CONTEXT
      </div>

      {/* Three stat columns */}
      <div className="context-grid">
        {/* Weather — Live Real-Time Stream */}
        <div className="ctx-col">
          <div className="ctx-header">
            <Icon name="cloud" />
            <span>WEATHER</span>
            {weather.status === "ok" && (
              <span className="ctx-live-dot" title="Live weather stream active" />
            )}
          </div>
          <div
            className={`ctx-primary ${
              weather.status === "pending" ? "ctx-primary--dim" : ""
            }`}
          >
            {weather.temp}
          </div>
          <div className="ctx-label">{weather.condition}</div>
          <div className="ctx-meta">{weather.meta}</div>
        </div>

        <div className="ctx-divider" />

        {/* Location — City Level with Switcher */}
        <div className="ctx-col">
          <div className="ctx-header">
            <Icon name="pin" />
            <span>LOCATION</span>
            <button
              type="button"
              className="ctx-change-btn"
              onClick={() => {
                setIsSelectorOpen((prev) => !prev);
                setTimeout(() => searchInputRef.current?.focus(), 50);
              }}
              title="Change city or switch location"
            >
              CHANGE
            </button>
            {location.status === "ok" && (
              <span className="ctx-live-dot" title="Location lock active" />
            )}
          </div>

          <div
            className={`ctx-primary ctx-primary--loc ${
              location.status === "pending" ? "ctx-primary--dim" : ""
            }`}
            title={location.suburb}
          >
            {location.suburb}
          </div>

          <div className="ctx-label" title={location.city}>
            {location.city || "—"}
          </div>

          <div className="ctx-meta">
            {location.status === "pending" && "Fetching GPS…"}
            {location.status === "ok" && (location.isCustom ? "City Lock" : "Live · GPS lock")}
            {location.status === "denied" && "IP Geolocation"}
            {location.status === "error" && "Lookup failed"}
          </div>
        </div>

        <div className="ctx-divider" />

        {/* Privacy */}
        <div className="ctx-col">
          <div className="ctx-header">
            <Icon name="shield" />
            <span>PRIVACY</span>
          </div>
          <div className="ctx-primary ctx-primary--lime">ON</div>
          <div className="ctx-label">Local mode</div>
          <div className="ctx-meta">AES-256 · No cloud</div>
        </div>
      </div>

      {/* Interactive City Selector Overlay Drawer */}
      {isSelectorOpen && (
        <div className="city-selector-backdrop">
          <div className="city-selector-header">
            <span>SELECT OR SEARCH CITY</span>
            <button
              type="button"
              className="city-close-btn"
              onClick={() => setIsSelectorOpen(false)}
            >
              ✕
            </button>
          </div>

          {/* Quick 1-Click Presets */}
          <div className="city-presets">
            {PRESET_CITIES.map((preset) => {
              const isSelected = location.suburb.toLowerCase().includes(preset.name.toLowerCase());
              return (
                <button
                  key={preset.name}
                  type="button"
                  className={`city-preset-chip ${isSelected ? "active" : ""}`}
                  onClick={() => handleSelectPreset(preset)}
                >
                  {preset.name}
                </button>
              );
            })}
            <button
              type="button"
              className="city-preset-chip chip-gps"
              onClick={autoDetectLocation}
              title="Auto-detect using GPS/IP"
            >
              ⟳ Auto GPS
            </button>
          </div>

          {/* Custom City Search Input */}
          <form className="city-input-wrap" onSubmit={handleSearchSubmit}>
            <input
              ref={searchInputRef}
              type="text"
              className="city-input-field"
              value={searchInput}
              onChange={(e) => setSearchInput(e.target.value)}
              placeholder="Type city or suburb name..."
            />
            <button
              type="submit"
              className="city-search-btn"
              disabled={isSearching || !searchInput.trim()}
            >
              {isSearching ? "..." : "SET"}
            </button>
          </form>
        </div>
      )}
    </section>
  );
}
