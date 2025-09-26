// Open-Meteo: Free, no API key.
// Geocoding: https://geocoding-api.open-meteo.com/v1/search?name=City
// Weather:   https://api.open-meteo.com/v1/forecast?latitude=..&longitude=..&current=..&daily=..
// Humidity/pressure from "current", daily highs/lows from "daily".

const cityInput = document.getElementById("cityInput");
const searchBtn = document.getElementById("searchBtn");
const unitSwitch = document.getElementById("unitSwitch");

// UI targets
const placeNameEl = document.getElementById("placeName");
const coordsEl = document.getElementById("coords");
const currentTempEl = document.getElementById("currentTemp");
const currentIconEl = document.getElementById("currentIcon");
const currentDescEl = document.getElementById("currentDesc");
const currentWindEl = document.getElementById("currentWind");
const currentHumidityEl = document.getElementById("currentHumidity");
const currentFeelsEl = document.getElementById("currentFeels");
const currentPressureEl = document.getElementById("currentPressure");
const updatedAtEl = document.getElementById("updatedAt");
const forecastRow = document.getElementById("forecastRow");

let lastWeather = null; // cache last response to allow unit toggling

const weatherCodeMap = {
  0:  { desc: "Clear sky",             icon: "☀️", bg: "clear" },
  1:  { desc: "Mainly clear",          icon: "🌤️", bg: "sunny" },
  2:  { desc: "Partly cloudy",         icon: "⛅",  bg: "cloudy" },
  3:  { desc: "Overcast",              icon: "☁️",  bg: "cloudy" },
  45: { desc: "Fog",                   icon: "🌫️",  bg: "cloudy" },
  48: { desc: "Rime fog",              icon: "🌫️",  bg: "cloudy" },
  51: { desc: "Light drizzle",         icon: "🌦️", bg: "rain" },
  53: { desc: "Drizzle",               icon: "🌦️", bg: "rain" },
  55: { desc: "Dense drizzle",         icon: "🌧️", bg: "rain" },
  56: { desc: "Freezing drizzle (lt)", icon: "🌧️", bg: "rain" },
  57: { desc: "Freezing drizzle (hv)", icon: "🌧️", bg: "rain" },
  61: { desc: "Light rain",            icon: "🌧️", bg: "rain" },
  63: { desc: "Rain",                  icon: "🌧️", bg: "rain" },
  65: { desc: "Heavy rain",            icon: "⛈️",  bg: "storm" },
  66: { desc: "Freezing rain (lt)",    icon: "🌧️", bg: "rain" },
  67: { desc: "Freezing rain (hv)",    icon: "⛈️",  bg: "storm" },
  71: { desc: "Light snow",            icon: "🌨️", bg: "snow" },
  73: { desc: "Snow",                  icon: "🌨️", bg: "snow" },
  75: { desc: "Heavy snow",            icon: "❄️",  bg: "snow" },
  77: { desc: "Snow grains",           icon: "🌨️", bg: "snow" },
  80: { desc: "Rain showers (lt)",     icon: "🌦️", bg: "rain" },
  81: { desc: "Rain showers",          icon: "🌦️", bg: "rain" },
  82: { desc: "Rain showers (hv)",     icon: "⛈️",  bg: "storm" },
  85: { desc: "Snow showers (lt)",     icon: "🌨️", bg: "snow" },
  86: { desc: "Snow showers (hv)",     icon: "❄️",  bg: "snow" },
  95: { desc: "Thunderstorm",          icon: "⛈️",  bg: "storm" },
  96: { desc: "Thunderstorm w/ hail",  icon: "⛈️",  bg: "storm" },
  99: { desc: "Thunderstorm (severe)", icon: "⛈️",  bg: "storm" },
};

function setBodyBG(code) {
  const info = weatherCodeMap[code] || weatherCodeMap[3];
  document.body.className = info.bg;
}

function toF(c) { return (c * 9) / 5 + 32; }
function unitTemp(valC) {
  return unitSwitch.checked ? `${Math.round(toF(valC))}°F` : `${Math.round(valC)}°C`;
}
function unitWind(ms) {
  // Convert to km/h for display
  const kmh = ms * 3.6;
  return `${Math.round(kmh)} km/h`;
}
function formatDate(dStr) {
  const d = new Date(dStr);
  return d.toLocaleString(undefined, { hour: "2-digit", minute: "2-digit", day: "2-digit", month: "short" });
}
function dayName(dStr) {
  const d = new Date(dStr);
  return d.toLocaleDateString(undefined, { weekday: "short" });
}

async function geocodeCity(city) {
  const url = `https://geocoding-api.open-meteo.com/v1/search?name=${encodeURIComponent(city)}&count=1&language=en&format=json`;
  const res = await fetch(url);
  const data = await res.json();
  if (!data.results || !data.results.length) throw new Error("City not found");
  return data.results[0]; // { name, latitude, longitude, country, admin1, ... }
}

async function fetchWeather(lat, lon) {
  const params = new URLSearchParams({
    latitude: lat,
    longitude: lon,
    current:
      "temperature_2m,relative_humidity_2m,apparent_temperature,pressure_msl,wind_speed_10m,weather_code",
    daily:
      "weather_code,temperature_2m_max,temperature_2m_min",
    timezone: "auto",
  });

  const url = `https://api.open-meteo.com/v1/forecast?${params.toString()}`;
  const res = await fetch(url);
  if (!res.ok) throw new Error("Weather fetch failed");
  return res.json();
}

function renderCurrent(place, weather) {
  const current = weather.current;
  const daily = weather.daily;
  const info = weatherCodeMap[current.weather_code] || weatherCodeMap[3];

  placeNameEl.textContent = `${place.name}${place.admin1 ? ", " + place.admin1 : ""}, ${place.country}`;
  coordsEl.textContent = `${place.latitude.toFixed(3)}, ${place.longitude.toFixed(3)}`;

  currentTempEl.textContent = unitTemp(current.temperature_2m);
  currentIconEl.textContent = info.icon;
  currentDescEl.textContent = info.desc;
  currentWindEl.textContent = unitWind(current.wind_speed_10m);
  currentHumidityEl.textContent = `${current.relative_humidity_2m}%`;
  currentFeelsEl.textContent = unitTemp(current.apparent_temperature);
  currentPressureEl.textContent = `${Math.round(current.pressure_msl)} hPa`;
  updatedAtEl.textContent = formatDate(weather.current_units.time ? current.time : weather.hourly?.time?.[0] || new Date().toISOString());

  setBodyBG(current.weather_code);
}

function renderForecast(weather) {
  const d = weather.daily;
  forecastRow.innerHTML = "";
  for (let i = 0; i < d.time.length; i++) {
    const code = d.weather_code[i];
    const info = weatherCodeMap[code] || weatherCodeMap[3];
    const hi = d.temperature_2m_max[i];
    const lo = d.temperature_2m_min[i];

    const card = document.createElement("div");
    card.className = "fore-item";
    card.innerHTML = `
      <div class="day">${dayName(d.time[i])}</div>
      <div class="big">${info.icon}</div>
      <div class="small">${info.desc}</div>
      <div class="small">H: <strong>${unitTemp(hi)}</strong></div>
      <div class="small">L: <strong>${unitTemp(lo)}</strong></div>
    `;
    forecastRow.appendChild(card);
  }
}

async function searchCityAndRender(city) {
  try {
    setLoading(true);
    const place = await geocodeCity(city);
    const weather = await fetchWeather(place.latitude, place.longitude);
    lastWeather = { place, weather }; // cache
    renderCurrent(place, weather);
    renderForecast(weather);
  } catch (err) {
    alert(err.message || "Something went wrong");
  } finally {
    setLoading(false);
  }
}

function setLoading(state) {
  searchBtn.disabled = state;
  searchBtn.textContent = state ? "Loading…" : "Search";
}

searchBtn.addEventListener("click", () => {
  const c = cityInput.value.trim();
  if (!c) { cityInput.focus(); return; }
  searchCityAndRender(c);
});

cityInput.addEventListener("keydown", (e) => {
  if (e.key === "Enter") {
    e.preventDefault();
    searchBtn.click();
  }
});

unitSwitch.addEventListener("change", () => {
  // Re-render with cached data for unit conversion
  if (lastWeather) {
    renderCurrent(lastWeather.place, lastWeather.weather);
    renderForecast(lastWeather.weather);
  }
});

// Try geolocate on first load (optional, best-effort)
(async function init() {
  try {
    if (location.protocol === "https:" && "geolocation" in navigator) {
      navigator.geolocation.getCurrentPosition(async (pos) => {
        const { latitude, longitude } = pos.coords;
        // Reverse geocode to display name
        const rev = await fetch(`https://geocoding-api.open-meteo.com/v1/reverse?latitude=${latitude}&longitude=${longitude}&language=en&format=json`);
        const revData = await rev.json();
        const place = (revData?.results && revData.results[0]) || { name: "Your location", country: "", latitude, longitude };
        const weather = await fetchWeather(latitude, longitude);
        lastWeather = { place, weather };
        renderCurrent(place, weather);
        renderForecast(weather);
      }, () => {
        // Fallback city
        searchCityAndRender("Mumbai");
      }, { enableHighAccuracy: true, timeout: 8000 });
    } else {
      searchCityAndRender("Mumbai");
    }
  } catch {
    searchCityAndRender("Mumbai");
  }
})();
