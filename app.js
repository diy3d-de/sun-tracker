const state = {
  location: null,
  surfaces: [],
  forecast: null,
};

const ui = {
  locationLabel: document.getElementById("locationLabel"),
  surfaceCount: document.getElementById("surfaceCount"),
  capacityLabel: document.getElementById("capacityLabel"),
  surfacesList: document.getElementById("surfacesList"),
  addSurfaceBtn: document.getElementById("addSurfaceBtn"),
  locateBtn: document.getElementById("locateBtn"),
  forecastBtn: document.getElementById("forecastBtn"),
  statusBox: document.getElementById("statusBox"),
  summaryGrid: document.getElementById("summaryGrid"),
  chart: document.getElementById("chart"),
  detailsTableWrap: document.getElementById("detailsTableWrap"),
  surfaceTemplate: document.getElementById("surfaceTemplate"),
  mapNote: document.getElementById("mapNote"),
};

const map = L.map("map", {
  zoomControl: true,
  attributionControl: true,
}).setView([51.1657, 10.4515], 6);

L.tileLayer("https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png", {
  maxZoom: 19,
  attribution: '&copy; <a href="https://www.openstreetmap.org/copyright">OpenStreetMap</a>',
  referrerPolicy: "strict-origin-when-cross-origin",
}).addTo(map);

const siteMarker = L.marker([51.1657, 10.4515], { opacity: 0 }).addTo(map);
const overlayMarker = L.marker([51.1657, 10.4515], {
  interactive: false,
  opacity: 0,
}).addTo(map);

function createDefaultSurface() {
  const index = state.surfaces.length + 1;
  return {
    id: crypto.randomUUID(),
    name: `Flaeche ${index}`,
    capacityWp: 4500,
    tiltVerticalDeg: 60,
    azimuthDeg: 180,
  };
}

function directionLabel(azimuthDeg) {
  const directions = [
    "Nord",
    "Nordost",
    "Ost",
    "Suedost",
    "Sued",
    "Suedwest",
    "West",
    "Nordwest",
  ];
  const normalized = ((azimuthDeg % 360) + 360) % 360;
  const index = Math.round(normalized / 45) % 8;
  return directions[index];
}

function formatNumber(value, digits = 0) {
  return new Intl.NumberFormat("de-DE", {
    maximumFractionDigits: digits,
    minimumFractionDigits: digits,
  }).format(value);
}

function formatDate(dateString, opts = {}) {
  return new Intl.DateTimeFormat("de-DE", {
    weekday: "short",
    day: "2-digit",
    month: "2-digit",
    ...opts,
  }).format(new Date(dateString));
}

function setStatus(message, tone = "neutral") {
  ui.statusBox.textContent = message;
  ui.statusBox.className = `status-box ${tone}`;
}

function updateHeaderStats() {
  if (state.location) {
    ui.locationLabel.textContent = `${formatNumber(state.location.lat, 4)} / ${formatNumber(state.location.lon, 4)}`;
  } else {
    ui.locationLabel.textContent = "Noch nicht gesetzt";
  }

  ui.surfaceCount.textContent = String(state.surfaces.length);
  const totalWp = state.surfaces.reduce((sum, surface) => sum + Number(surface.capacityWp || 0), 0);
  ui.capacityLabel.textContent = `${formatNumber(totalWp, 0)} Wp`;
}

function buildOverlayHtml() {
  const arrows = state.surfaces
    .map((surface, index) => {
      const colors = ["#cc6b2c", "#5d7a39", "#2f7b8d", "#8d4fb3", "#cc3f6a", "#a78919"];
      const color = colors[index % colors.length];
      const rotation = surface.azimuthDeg;
      const length = 34 + Math.min(26, surface.capacityWp / 250);
      return `
        <g transform="rotate(${rotation} 80 80)">
          <line x1="80" y1="80" x2="80" y2="${80 - length}" stroke="${color}" stroke-width="5" stroke-linecap="round" />
          <polygon points="80,${80 - length - 10} 72,${80 - length + 3} 88,${80 - length + 3}" fill="${color}" />
        </g>
      `;
    })
    .join("");

  return `
    <div class="site-overlay">
      <svg viewBox="0 0 160 160" aria-hidden="true">
        <circle class="overlay-ring" cx="80" cy="80" r="54"></circle>
        <circle class="overlay-center" cx="80" cy="80" r="10"></circle>
        ${arrows}
      </svg>
    </div>
  `;
}

function updateMapOverlay() {
  if (!state.location) {
    siteMarker.setOpacity(0);
    overlayMarker.setOpacity(0);
    return;
  }

  siteMarker.setLatLng([state.location.lat, state.location.lon]).setOpacity(1);
  overlayMarker.setLatLng([state.location.lat, state.location.lon]);

  if (state.surfaces.length === 0) {
    overlayMarker.setOpacity(0);
    return;
  }

  overlayMarker.setIcon(
    L.divIcon({
      className: "",
      html: buildOverlayHtml(),
      iconSize: [160, 160],
      iconAnchor: [80, 80],
    }),
  );
  overlayMarker.setOpacity(1);
}

function updateSurface(surfaceId, changes, options = {}) {
  const surface = state.surfaces.find((item) => item.id === surfaceId);
  if (!surface) return;
  Object.assign(surface, changes);
  if (options.rerender) {
    renderSurfaces();
  }
  if (options.updateHeader !== false) {
    updateHeaderStats();
  }
  if (options.updateOverlay !== false) {
    updateMapOverlay();
  }
}

function removeSurface(surfaceId) {
  state.surfaces = state.surfaces.filter((surface) => surface.id !== surfaceId);
  renderSurfaces();
  updateHeaderStats();
  updateMapOverlay();
}

function refreshSurfaceCard(card, surface) {
  const title = card.querySelector(".surface-title");
  const nameInput = card.querySelector('[data-field="name"]');
  const capacityInput = card.querySelector('[data-field="capacityWp"]');
  const tiltInput = card.querySelector('[data-field="tiltVerticalDeg"]');
  const azimuthRange = card.querySelector('[data-field="azimuthDeg"]');
  const azimuthNumber = card.querySelector('[data-field="azimuthDegNumber"]');
  const needle = card.querySelector(".compass-needle");
  const directionName = card.querySelector(".direction-name");
  const index = state.surfaces.findIndex((item) => item.id === surface.id);

  title.textContent = `Solarflaeche ${index + 1}`;
  if (nameInput.value !== surface.name) nameInput.value = surface.name;
  if (capacityInput.value !== String(surface.capacityWp)) capacityInput.value = surface.capacityWp;
  if (tiltInput.value !== String(surface.tiltVerticalDeg)) tiltInput.value = surface.tiltVerticalDeg;
  if (azimuthRange.value !== String(surface.azimuthDeg)) azimuthRange.value = surface.azimuthDeg;
  if (azimuthNumber.value !== String(surface.azimuthDeg)) azimuthNumber.value = surface.azimuthDeg;
  directionName.textContent = `${directionLabel(surface.azimuthDeg)} (${surface.azimuthDeg} Grad)`;
  needle.style.transform = `rotate(${surface.azimuthDeg}deg)`;
}

function renderSurfaces() {
  ui.surfacesList.innerHTML = "";

  state.surfaces.forEach((surface, index) => {
    const fragment = ui.surfaceTemplate.content.cloneNode(true);
    const card = fragment.querySelector(".surface-card");
    const removeBtn = fragment.querySelector(".remove-surface");
    const nameInput = fragment.querySelector('[data-field="name"]');
    const capacityInput = fragment.querySelector('[data-field="capacityWp"]');
    const tiltInput = fragment.querySelector('[data-field="tiltVerticalDeg"]');
    const azimuthRange = fragment.querySelector('[data-field="azimuthDeg"]');
    const azimuthNumber = fragment.querySelector('[data-field="azimuthDegNumber"]');
    refreshSurfaceCard(card, surface);

    const numberHandler = (field, parser, max = Infinity, min = -Infinity) => (event) => {
      const value = parser(event.target.value);
      if (Number.isNaN(value)) return;
      updateSurface(surface.id, {
        [field]: Math.max(min, Math.min(max, value)),
      });
      refreshSurfaceCard(card, surface);
    };

    nameInput.addEventListener("input", (event) => {
      updateSurface(surface.id, { name: event.target.value || `Flaeche ${index + 1}` }, { updateOverlay: false });
    });
    capacityInput.addEventListener("input", numberHandler("capacityWp", Number, 1000000, 1));
    tiltInput.addEventListener("input", numberHandler("tiltVerticalDeg", Number, 90, 0));

    azimuthRange.addEventListener("input", (event) => {
      updateSurface(surface.id, { azimuthDeg: Number(event.target.value) });
      refreshSurfaceCard(card, surface);
    });

    azimuthNumber.addEventListener("input", (event) => {
      const value = Number(event.target.value);
      if (Number.isNaN(value)) return;
      let normalized = value % 360;
      if (normalized < 0) normalized += 360;
      updateSurface(surface.id, { azimuthDeg: normalized });
      refreshSurfaceCard(card, surface);
    });

    removeBtn.addEventListener("click", () => removeSurface(surface.id));
    card.dataset.surfaceId = surface.id;
    ui.surfacesList.appendChild(fragment);
  });
}

function addSurface(surface = createDefaultSurface()) {
  state.surfaces.push(surface);
  renderSurfaces();
  updateHeaderStats();
  updateMapOverlay();
}

function setLocation(lat, lon) {
  state.location = {
    lat: Number(lat.toFixed(6)),
    lon: Number(lon.toFixed(6)),
  };
  updateHeaderStats();
  updateMapOverlay();
}

function degToRad(deg) {
  return (deg * Math.PI) / 180;
}

function radToDeg(rad) {
  return (rad * 180) / Math.PI;
}

function dayOfYear(date) {
  const start = new Date(Date.UTC(date.getUTCFullYear(), 0, 0));
  const diff = date - start;
  return Math.floor(diff / 86400000);
}

function solarPosition(date, lat, lon) {
  const dateUtc = new Date(date);
  const day = dayOfYear(dateUtc);
  const hour = dateUtc.getUTCHours() + dateUtc.getUTCMinutes() / 60 + dateUtc.getUTCSeconds() / 3600;
  const gamma = (2 * Math.PI / 365) * (day - 1 + (hour - 12) / 24);

  const declination =
    0.006918
    - 0.399912 * Math.cos(gamma)
    + 0.070257 * Math.sin(gamma)
    - 0.006758 * Math.cos(2 * gamma)
    + 0.000907 * Math.sin(2 * gamma)
    - 0.002697 * Math.cos(3 * gamma)
    + 0.00148 * Math.sin(3 * gamma);

  const eqTime =
    229.18
    * (
      0.000075
      + 0.001868 * Math.cos(gamma)
      - 0.032077 * Math.sin(gamma)
      - 0.014615 * Math.cos(2 * gamma)
      - 0.040849 * Math.sin(2 * gamma)
    );

  const minutes = dateUtc.getUTCHours() * 60 + dateUtc.getUTCMinutes() + dateUtc.getUTCSeconds() / 60;
  const trueSolarTime = (minutes + eqTime + 4 * lon + 1440) % 1440;
  let hourAngleDeg = trueSolarTime / 4 - 180;
  if (hourAngleDeg < -180) {
    hourAngleDeg += 360;
  }

  const latRad = degToRad(lat);
  const hourAngleRad = degToRad(hourAngleDeg);
  const cosZenith =
    Math.sin(latRad) * Math.sin(declination)
    + Math.cos(latRad) * Math.cos(declination) * Math.cos(hourAngleRad);
  const zenith = Math.acos(Math.min(1, Math.max(-1, cosZenith)));
  const elevation = 90 - radToDeg(zenith);

  const azimuthRad = Math.atan2(
    Math.sin(hourAngleRad),
    Math.cos(hourAngleRad) * Math.sin(latRad) - Math.tan(declination) * Math.cos(latRad),
  );
  const azimuth = (radToDeg(azimuthRad) + 180 + 360) % 360;

  return {
    declination,
    zenithDeg: radToDeg(zenith),
    elevationDeg: elevation,
    azimuthDeg: azimuth,
  };
}

function incidenceCosine(sunAzimuthDeg, sunZenithDeg, surfaceAzimuthDeg, tiltFromHorizontalDeg) {
  const sunZenithRad = degToRad(sunZenithDeg);
  const sunAzimuthRad = degToRad(sunAzimuthDeg);
  const surfaceAzimuthRad = degToRad(surfaceAzimuthDeg);
  const tiltRad = degToRad(tiltFromHorizontalDeg);

  return (
    Math.cos(sunZenithRad) * Math.cos(tiltRad)
    + Math.sin(sunZenithRad) * Math.sin(tiltRad) * Math.cos(sunAzimuthRad - surfaceAzimuthRad)
  );
}

function estimateSurfaceHourWh(surface, hourData, lat, lon) {
  const time = new Date(hourData.time);
  const sun = solarPosition(time, lat, lon);
  if (sun.elevationDeg <= 0) return 0;

  const ghi = Math.max(0, hourData.shortwave_radiation ?? 0);
  const dni = Math.max(0, hourData.direct_normal_irradiance ?? 0);
  const dhi = Math.max(0, hourData.diffuse_radiation ?? 0);

  const tiltFromHorizontalDeg = 90 - surface.tiltVerticalDeg;
  const cosInc = Math.max(
    0,
    incidenceCosine(sun.azimuthDeg, sun.zenithDeg, surface.azimuthDeg, tiltFromHorizontalDeg),
  );

  const tiltRad = degToRad(tiltFromHorizontalDeg);
  const beam = dni * cosInc;
  const diffuse = dhi * ((1 + Math.cos(tiltRad)) / 2);
  const reflected = ghi * 0.2 * ((1 - Math.cos(tiltRad)) / 2);
  const planeIrradiance = Math.max(0, beam + diffuse + reflected);

  const ambientTemp = hourData.temperature_2m ?? 20;
  const cellTemp = ambientTemp + (planeIrradiance / 800) * 20;
  const tempFactor = Math.max(0.82, 1 - 0.004 * (cellTemp - 25));
  const powerW = surface.capacityWp * (planeIrradiance / 1000) * 0.86 * tempFactor;

  return Math.max(0, powerW);
}

function normalizeForecastData(payload) {
  const hourly = payload.hourly;
  const hours = hourly.time.map((time, index) => ({
    time,
    shortwave_radiation: hourly.shortwave_radiation?.[index],
    direct_normal_irradiance: hourly.direct_normal_irradiance?.[index],
    diffuse_radiation: hourly.diffuse_radiation?.[index],
    temperature_2m: hourly.temperature_2m?.[index],
    cloud_cover: hourly.cloud_cover?.[index],
  }));

  const dailyMap = new Map();

  hours.forEach((hourData) => {
    const dayKey = hourData.time.slice(0, 10);
    if (!dailyMap.has(dayKey)) {
      dailyMap.set(dayKey, {
        date: dayKey,
        totalWh: 0,
        avgCloudCover: 0,
        surfaceWh: {},
        hourCount: 0,
      });
    }

    const dayEntry = dailyMap.get(dayKey);
    dayEntry.avgCloudCover += hourData.cloud_cover ?? 0;
    dayEntry.hourCount += 1;

    state.surfaces.forEach((surface) => {
      const wh = estimateSurfaceHourWh(surface, hourData, state.location.lat, state.location.lon);
      dayEntry.totalWh += wh;
      dayEntry.surfaceWh[surface.id] = (dayEntry.surfaceWh[surface.id] ?? 0) + wh;
    });
  });

  return [...dailyMap.values()]
    .slice(0, 7)
    .map((day) => ({
      ...day,
      avgCloudCover: day.hourCount ? day.avgCloudCover / day.hourCount : 0,
    }));
}

async function fetchForecast() {
  const params = new URLSearchParams({
    latitude: String(state.location.lat),
    longitude: String(state.location.lon),
    timezone: "auto",
    forecast_days: "7",
    hourly: [
      "temperature_2m",
      "cloud_cover",
      "shortwave_radiation",
      "direct_normal_irradiance",
      "diffuse_radiation",
    ].join(","),
  });

  const response = await fetch(`https://api.open-meteo.com/v1/forecast?${params.toString()}`);
  if (!response.ok) {
    throw new Error(`Forecast API Fehler: ${response.status}`);
  }

  return response.json();
}

function renderSummary(days) {
  const bestDay = [...days].sort((a, b) => b.totalWh - a.totalWh)[0];
  const today = days[0];
  const totalWeek = days.reduce((sum, day) => sum + day.totalWh, 0);

  ui.summaryGrid.innerHTML = `
    <article class="summary-card">
      <h3>Heute</h3>
      <p>${formatNumber(today?.totalWh ?? 0, 0)} Wh erwartet</p>
    </article>
    <article class="summary-card">
      <h3>Staerkster Tag</h3>
      <p>${bestDay ? `${formatDate(bestDay.date)} mit ${formatNumber(bestDay.totalWh, 0)} Wh` : "-"}</p>
    </article>
    <article class="summary-card">
      <h3>7-Tage-Summe</h3>
      <p>${formatNumber(totalWeek, 0)} Wh gesamt</p>
    </article>
    <article class="summary-card">
      <h3>Installierte Leistung</h3>
      <p>${formatNumber(state.surfaces.reduce((sum, surface) => sum + surface.capacityWp, 0), 0)} Wp</p>
    </article>
  `;
}

function renderChart(days) {
  const peak = Math.max(...days.map((day) => day.totalWh), 1);
  ui.chart.innerHTML = days
    .map((day) => {
      const height = Math.max(12, (day.totalWh / peak) * 100);
      return `
        <article class="bar-card">
          <div class="bar-value">${formatNumber(day.totalWh, 0)} Wh</div>
          <div class="bar-stack">
            <div class="bar-fill" style="height:${height}%"></div>
          </div>
          <div class="bar-label">${formatDate(day.date)}</div>
        </article>
      `;
    })
    .join("");
}

function renderTable(days) {
  const headerSurfaceNames = state.surfaces
    .map((surface) => `<th>${surface.name || "Flaeche"}</th>`)
    .join("");

  const body = days
    .map((day) => {
      const surfaceCells = state.surfaces
        .map((surface) => `<td>${formatNumber(day.surfaceWh[surface.id] ?? 0, 0)} Wh</td>`)
        .join("");

      return `
        <tr>
          <td>${formatDate(day.date, { weekday: "long", day: "2-digit", month: "2-digit" })}</td>
          <td>${formatNumber(day.totalWh, 0)} Wh</td>
          <td>${formatNumber(day.avgCloudCover, 0)} %</td>
          ${surfaceCells}
        </tr>
      `;
    })
    .join("");

  ui.detailsTableWrap.innerHTML = `
    <table>
      <thead>
        <tr>
          <th>Tag</th>
          <th>Gesamt</th>
          <th>Bewoelkung</th>
          ${headerSurfaceNames}
        </tr>
      </thead>
      <tbody>${body}</tbody>
    </table>
  `;
}

async function calculateForecast() {
  if (!state.location) {
    setStatus("Bitte zuerst einen Standort auf der Karte waehlen.", "error");
    return;
  }

  if (state.surfaces.length === 0) {
    setStatus("Bitte mindestens eine Solarflaeche anlegen.", "error");
    return;
  }

  const invalidSurface = state.surfaces.find(
    (surface) => !surface.capacityWp || surface.tiltVerticalDeg < 0 || surface.tiltVerticalDeg > 90,
  );
  if (invalidSurface) {
    setStatus("Bitte alle Solarflaechen mit gueltiger Leistung und Winkel konfigurieren.", "error");
    return;
  }

  ui.forecastBtn.disabled = true;
  setStatus("Wetterdaten werden geladen und die Prognose wird berechnet ...", "neutral");

  try {
    const payload = await fetchForecast();
    const days = normalizeForecastData(payload);
    state.forecast = days;
    renderSummary(days);
    renderChart(days);
    renderTable(days);
    setStatus(
      `Prognose erfolgreich aktualisiert fuer ${formatDate(days[0]?.date ?? new Date().toISOString())} bis ${formatDate(days[days.length - 1]?.date ?? new Date().toISOString())}.`,
      "success",
    );
  } catch (error) {
    console.error(error);
    setStatus("Die Wetterdaten konnten nicht geladen werden. Bitte spaeter erneut versuchen.", "error");
  } finally {
    ui.forecastBtn.disabled = false;
  }
}

function updateMapNote() {
  if (window.location.protocol === "file:") {
    ui.mapNote.textContent = "OpenStreetMap blockiert lokale file://-Aufrufe teils wegen fehlendem Referer. Bitte die App ueber http://127.0.0.1:8080 starten.";
    return;
  }

  ui.mapNote.textContent = "";
}

map.on("click", (event) => {
  setLocation(event.latlng.lat, event.latlng.lng);
  map.flyTo(event.latlng, Math.max(map.getZoom(), 11), { duration: 0.8 });
  setStatus("Standort aktualisiert. Jetzt Solarflaechen konfigurieren oder Prognose neu berechnen.", "neutral");
});

ui.locateBtn.addEventListener("click", () => {
  if (!navigator.geolocation) {
    setStatus("Geolokation wird in diesem Browser nicht unterstuetzt.", "error");
    return;
  }

  setStatus("Standort wird ueber den Browser angefragt ...", "neutral");
  navigator.geolocation.getCurrentPosition(
    (position) => {
      setLocation(position.coords.latitude, position.coords.longitude);
      map.flyTo([position.coords.latitude, position.coords.longitude], 13, { duration: 0.9 });
      setStatus("Standort aus der Geolokation uebernommen.", "success");
    },
    () => {
      setStatus("Auf den Browser-Standort konnte nicht zugegriffen werden.", "error");
    },
  );
});

ui.addSurfaceBtn.addEventListener("click", () => addSurface());
ui.forecastBtn.addEventListener("click", calculateForecast);

addSurface({
  id: crypto.randomUUID(),
  name: "Sueddach",
  capacityWp: 6400,
  tiltVerticalDeg: 60,
  azimuthDeg: 180,
});

addSurface({
  id: crypto.randomUUID(),
  name: "Westfassade",
  capacityWp: 1800,
  tiltVerticalDeg: 15,
  azimuthDeg: 270,
});

updateHeaderStats();
updateMapNote();
