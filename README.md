# Sun Tracker fuer Home Assistant

`Sun Tracker` ist eine HACS-kompatible Custom-Integration fuer Home Assistant. Sie nutzt den in Home Assistant konfigurierten Standort, berechnet daraus den aktuellen Sonnenstand und liefert auch die komplette Sonnenbahn fuer den aktuellen Tag.

## Enthalten

- `custom_components/sun_tracker`: Backend-Integration fuer Home Assistant
- `www/sun-tracker-card.js`: Lovelace-Karte mit Tages-Sonnenbahn
- `hacs.json`: HACS-Metadaten fuer die Installation als Custom Repository

## Funktionen

- aktueller Sonnenstand mit Hoehe, Azimut und Zenit
- Sonnenaufgang, Sonnenuntergang und Solarnoon
- Tages-Sonnenbahn als Liste von Punkten fuer den gesamten Tag
- Kartenvisualisierung mit Standort, aktueller Sonnenrichtung und Tagesbahn

## Sensor

Die Integration erzeugt:

- `sensor.sun_tracker`

Wichtige Attribute:

- `azimuth`
- `elevation`
- `zenith`
- `declination`
- `daylight`
- `observer_latitude`
- `observer_longitude`
- `map_target_latitude`
- `map_target_longitude`
- `map_radius`
- `sunrise`
- `sunset`
- `solar_noon`
- `day_path`
- `updated_at`

## HACS Installation

Der Repo-Inhalt ist jetzt so vorbereitet, dass du ihn nach einem Upload zu GitHub in HACS als `Custom Repository` vom Typ `Integration` eintragen kannst und dann per Klick installieren kannst.

1. Diesen Projektordner in ein GitHub-Repository hochladen.
2. In Home Assistant `HACS -> Integrationen -> Benutzerdefinierte Repositories` oeffnen.
3. Deine GitHub-Repo-URL eintragen.
4. Repository-Typ `Integration` waehlen.
5. `Sun Tracker` in HACS installieren.
6. Home Assistant neu starten.
7. Unter `Einstellungen -> Geraete & Dienste -> Integration hinzufuegen` nach `Sun Tracker` suchen und hinzufuegen.

## Kartenansicht

Die Tagesbahn-Karte liegt in `www/sun-tracker-card.js`.

1. Datei nach `<config>/www/sun-tracker-card.js` kopieren.
2. Unter `Einstellungen -> Dashboards -> Ressourcen` `/local/sun-tracker-card.js` als `JavaScript-Modul` registrieren.
3. Karte zu einem Dashboard hinzufuegen.

```yaml
type: custom:sun-tracker-card
entity: sensor.sun_tracker
zoom: 8
radius_km: 150
```

## Wichtiger Hinweis zu One-Click

Die Integration selbst ist jetzt HACS-kompatibel vorbereitet. Ein echter Klick-Install in HACS funktioniert erst, wenn dieses Projekt in einem GitHub-Repository veroeffentlicht ist. Die Lovelace-Karte ist ebenfalls fertig, wird aber aktuell noch als separate Dashboard-Ressource eingebunden.
