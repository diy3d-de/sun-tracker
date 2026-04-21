# Sun Tracker fuer Home Assistant

`Sun Tracker` ist eine HACS-kompatible Custom-Integration fuer Home Assistant. Sie nutzt den in Home Assistant konfigurierten Standort, berechnet daraus den aktuellen Sonnenstand und liefert auch die komplette Sonnenbahn fuer den aktuellen Tag.

[![Open your Home Assistant instance and open this repository in HACS.](https://my.home-assistant.io/badges/hacs_repository.svg)](https://my.home-assistant.io/redirect/hacs_repository/?owner=diy3d-de&repository=sun-tracker&category=integration)
[![Open your Home Assistant instance and start setting up Sun Tracker.](https://my.home-assistant.io/badges/config_flow_start.svg)](https://my.home-assistant.io/redirect/config_flow_start/?domain=sun_tracker)

## Enthalten

- `custom_components/sun_tracker`: Backend-Integration fuer Home Assistant
- `custom_components/sun_tracker/frontend/sun-tracker-card.js`: Lovelace-Karte mit Tages-Sonnenbahn
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

Der Repo-Inhalt ist jetzt so vorbereitet, dass du ihn direkt als `Custom Repository` in HACS per Klick hinzufuegen kannst.

1. Oben auf den HACS-Button klicken.
2. Das Repository in HACS bestaetigen und installieren.
3. Home Assistant neu starten.
4. Oben auf den `Add Integration`-Button klicken oder in `Einstellungen -> Geraete & Dienste` nach `Sun Tracker` suchen.

## Kartenansicht

Die Tagesbahn-Karte wird jetzt direkt von der Integration ausgeliefert. Es muss also nichts mehr manuell nach `/www` kopiert werden.

1. Unter `Einstellungen -> Dashboards -> Ressourcen` die URL `/sun_tracker/sun-tracker-card.js` als `JavaScript-Modul` registrieren.
2. Karte zu einem Dashboard hinzufuegen.

```yaml
type: custom:sun-tracker-card
entity: sensor.sun_tracker
zoom: 8
radius_km: 150
```

## Wichtiger Hinweis zu One-Click

Der One-Click-Install fuer HACS ist jetzt eingebaut ueber den My-Home-Assistant-Link oben. Fuer die Karten-Ressource braucht Home Assistant weiterhin einmalig einen Eintrag unter `Dashboards -> Ressourcen`, weil das der offizielle Frontend-Weg fuer Custom Cards ist. Die JavaScript-Datei wird aber bereits von der Integration selbst ausgeliefert, deshalb entfaellt jedes manuelle Kopieren von Dateien.
