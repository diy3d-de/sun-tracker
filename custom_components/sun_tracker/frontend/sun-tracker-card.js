class SunTrackerCard extends HTMLElement {
  static getStubConfig() {
    return {
      entity: "sensor.sun_tracker",
      zoom: 8,
      radius_km: 150
    };
  }

  setConfig(config) {
    if (!config.entity) {
      throw new Error("Sun Tracker benoetigt eine Entity.");
    }

    this._config = {
      zoom: 8,
      radius_km: 150,
      ...config
    };

    if (!this._root) {
      this._root = this.attachShadow({ mode: "open" });
      this._root.innerHTML = `
        <style>
          :host {
            display: block;
          }

          ha-card {
            overflow: hidden;
            background:
              radial-gradient(circle at top left, rgba(255, 196, 86, 0.22), transparent 28%),
              radial-gradient(circle at right center, rgba(145, 198, 225, 0.2), transparent 22%),
              linear-gradient(180deg, rgba(255, 252, 245, 0.98), rgba(245, 238, 226, 0.96));
          }

          .wrap {
            padding: 16px;
            display: grid;
            gap: 16px;
          }

          .headline {
            display: flex;
            justify-content: space-between;
            gap: 16px;
            align-items: flex-start;
          }

          .headline h2,
          .headline p,
          .metric strong,
          .metric span {
            margin: 0;
          }

          .subtitle {
            color: var(--secondary-text-color);
            margin-top: 6px;
          }

          .metrics {
            display: grid;
            grid-template-columns: repeat(3, minmax(0, 1fr));
            gap: 10px;
          }

          .metric {
            border-radius: 16px;
            padding: 12px;
            background: rgba(255, 255, 255, 0.72);
            border: 1px solid rgba(0, 0, 0, 0.08);
          }

          .metric span {
            display: block;
            color: var(--secondary-text-color);
            font-size: 0.85rem;
            margin-bottom: 6px;
          }

          .map-shell {
            position: relative;
            height: 360px;
            border-radius: 18px;
            overflow: hidden;
            border: 1px solid rgba(0, 0, 0, 0.08);
            background: #d7e6ef;
          }

          .map {
            width: 100%;
            height: 100%;
          }

          .notice {
            color: var(--secondary-text-color);
          }

          @media (max-width: 700px) {
            .headline,
            .metrics {
              grid-template-columns: 1fr;
              display: grid;
            }
          }
        </style>
        <ha-card>
          <div class="wrap">
            <div class="headline">
              <div>
                <h2>Sun Tracker</h2>
                <p class="subtitle">Aktueller Sonnenstand und komplette Sonnenbahn fuer den heutigen Tag</p>
              </div>
              <div id="daylightBadge"></div>
            </div>
            <div class="metrics">
              <div class="metric"><span>Hoehe</span><strong id="elevation">-</strong></div>
              <div class="metric"><span>Azimut</span><strong id="azimuth">-</strong></div>
              <div class="metric"><span>Tag</span><strong id="dayMeta">-</strong></div>
            </div>
            <div class="map-shell">
              <div id="map" class="map"></div>
            </div>
            <div id="notice" class="notice"></div>
          </div>
        </ha-card>
      `;
    }
  }

  set hass(hass) {
    this._hass = hass;
    const entity = hass.states[this._config.entity];

    if (!entity) {
      this._root.getElementById("notice").textContent = `Entity ${this._config.entity} wurde nicht gefunden.`;
      return;
    }

    const attrs = entity.attributes;
    const elevation = attrs.elevation ?? entity.state;
    const azimuth = attrs.azimuth ?? 0;
    const lat = attrs.observer_latitude;
    const lon = attrs.observer_longitude;
    const dayPath = Array.isArray(attrs.day_path) ? attrs.day_path : [];
    const currentPoint = this._projectPoint(lat, lon, azimuth, this._config.radius_km);
    const sunrise = attrs.sunrise ? this._formatTime(attrs.sunrise) : "-";
    const sunset = attrs.sunset ? this._formatTime(attrs.sunset) : "-";

    this._root.getElementById("elevation").textContent = `${Number(elevation).toFixed(1)} deg`;
    this._root.getElementById("azimuth").textContent = `${Number(azimuth).toFixed(1)} deg`;
    this._root.getElementById("dayMeta").textContent = `${sunrise} / ${sunset}`;
    this._root.getElementById("daylightBadge").innerHTML = attrs.daylight
      ? `<ha-chip icon="mdi:white-balance-sunny">Tag</ha-chip>`
      : `<ha-chip icon="mdi:weather-night">Nacht</ha-chip>`;
    this._root.getElementById("notice").textContent =
      "Die gelbe Linie zeigt die heutige Sonnenbahn als Richtungsprojektion auf der Karte. Der helle Punkt markiert die aktuelle Sonnenrichtung.";

    this._ensureMap(lat, lon, currentPoint, dayPath, azimuth, attrs.solar_noon);
  }

  _ensureMap(lat, lon, currentPoint, dayPath, azimuth, solarNoon) {
    const mapNode = this._root.getElementById("map");
    if (!this._leafletPromise) {
      this._leafletPromise = this._loadLeaflet();
    }

    this._leafletPromise.then(() => {
      const pathCoords = dayPath
        .filter((point) => point.daylight)
        .map((point) => {
          const projected = this._projectPoint(lat, lon, point.azimuth, this._config.radius_km);
          return [projected[0], projected[1]];
        });

      const noonPoint = this._getNoonPoint(lat, lon, dayPath, solarNoon);

      if (!this._map) {
        this._map = window.L.map(mapNode, {
          zoomControl: true,
          attributionControl: true
        }).setView([lat, lon], this._config.zoom);

        window.L.tileLayer("https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png", {
          maxZoom: 19,
          attribution: '&copy; <a href="https://www.openstreetmap.org/copyright">OpenStreetMap</a>'
        }).addTo(this._map);

        this._observerMarker = window.L.circleMarker([lat, lon], {
          radius: 8,
          weight: 2,
          color: "#23412d",
          fillColor: "#fff5cc",
          fillOpacity: 0.95
        }).addTo(this._map);

        this._currentMarker = window.L.circleMarker(currentPoint, {
          radius: 7,
          weight: 2,
          color: "#c26b1f",
          fillColor: "#ffd37e",
          fillOpacity: 0.95
        }).addTo(this._map);

        this._pathLine = window.L.polyline(pathCoords, {
          color: "#d6a11c",
          weight: 4,
          opacity: 0.85,
          dashArray: "10 8"
        }).addTo(this._map);

        this._beamLine = window.L.polyline([[lat, lon], currentPoint], {
          color: "#d4811f",
          weight: 4,
          opacity: 0.8
        }).addTo(this._map);

        this._noonMarker = window.L.circleMarker(noonPoint, {
          radius: 6,
          weight: 2,
          color: "#875f10",
          fillColor: "#fff1a8",
          fillOpacity: 1
        }).addTo(this._map);
      } else {
        this._observerMarker.setLatLng([lat, lon]);
        this._currentMarker.setLatLng(currentPoint);
        this._pathLine.setLatLngs(pathCoords);
        this._beamLine.setLatLngs([[lat, lon], currentPoint]);
        this._noonMarker.setLatLng(noonPoint);
      }

      this._observerMarker.bindTooltip(`Standort<br>${lat.toFixed(4)}, ${lon.toFixed(4)}`);
      this._currentMarker.bindTooltip(`Aktuelle Sonnenrichtung ${azimuth.toFixed(1)} deg`);
      this._noonMarker.bindTooltip("Hoechster Sonnenstand heute");
    });
  }

  _getNoonPoint(lat, lon, dayPath, solarNoon) {
    if (solarNoon) {
      const match = dayPath.find((point) => point.time === solarNoon);
      if (match) {
        return this._projectPoint(lat, lon, match.azimuth, this._config.radius_km);
      }
    }

    const highestPoint = [...dayPath].sort((a, b) => (b.elevation ?? -90) - (a.elevation ?? -90))[0];
    if (!highestPoint) {
      return [lat, lon];
    }

    return this._projectPoint(lat, lon, highestPoint.azimuth, this._config.radius_km);
  }

  _projectPoint(lat, lon, bearingDeg, distanceKm) {
    const earthRadiusKm = 6371;
    const angularDistance = distanceKm / earthRadiusKm;
    const bearing = (bearingDeg * Math.PI) / 180;
    const lat1 = (lat * Math.PI) / 180;
    const lon1 = (lon * Math.PI) / 180;

    const lat2 = Math.asin(
      Math.sin(lat1) * Math.cos(angularDistance) +
      Math.cos(lat1) * Math.sin(angularDistance) * Math.cos(bearing)
    );

    const lon2 = lon1 + Math.atan2(
      Math.sin(bearing) * Math.sin(angularDistance) * Math.cos(lat1),
      Math.cos(angularDistance) - Math.sin(lat1) * Math.sin(lat2)
    );

    return [
      (lat2 * 180) / Math.PI,
      ((((lon2 * 180) / Math.PI) + 540) % 360) - 180
    ];
  }

  _formatTime(value) {
    const date = new Date(value);
    return new Intl.DateTimeFormat(undefined, {
      hour: "2-digit",
      minute: "2-digit"
    }).format(date);
  }

  _loadLeaflet() {
    if (window.L) {
      return Promise.resolve();
    }

    const leafletCss = document.createElement("link");
    leafletCss.rel = "stylesheet";
    leafletCss.href = "https://unpkg.com/leaflet@1.9.4/dist/leaflet.css";
    document.head.appendChild(leafletCss);

    return new Promise((resolve, reject) => {
      const script = document.createElement("script");
      script.src = "https://unpkg.com/leaflet@1.9.4/dist/leaflet.js";
      script.onload = () => resolve();
      script.onerror = () => reject(new Error("Leaflet konnte nicht geladen werden."));
      document.head.appendChild(script);
    });
  }

  getCardSize() {
    return 6;
  }
}

customElements.define("sun-tracker-card", SunTrackerCard);

window.customCards = window.customCards || [];
window.customCards.push({
  type: "sun-tracker-card",
  name: "Sun Tracker",
  description: "Zeigt aktuellen Sonnenstand und die Sonnenbahn des Tages auf einer Karte."
});
