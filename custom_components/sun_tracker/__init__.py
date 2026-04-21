"""Sun Tracker integration."""

from __future__ import annotations

from pathlib import Path

from homeassistant.config_entries import ConfigEntry
from homeassistant.const import Platform
from homeassistant.core import HomeAssistant

DOMAIN = "sun_tracker"
PLATFORMS: list[Platform] = [Platform.SENSOR]
CARD_URL = f"/{DOMAIN}/sun-tracker-card.js"
CARD_PATH = Path(__file__).parent / "frontend" / "sun-tracker-card.js"


async def async_setup(hass: HomeAssistant, config: dict) -> bool:
    """Set up Sun Tracker from YAML."""
    await _async_register_card_resource(hass)
    return True


async def async_setup_entry(hass: HomeAssistant, entry: ConfigEntry) -> bool:
    """Set up Sun Tracker from a config entry."""
    await hass.config_entries.async_forward_entry_setups(entry, PLATFORMS)
    return True


async def async_unload_entry(hass: HomeAssistant, entry: ConfigEntry) -> bool:
    """Unload a config entry."""
    return await hass.config_entries.async_unload_platforms(entry, PLATFORMS)


async def _async_register_card_resource(hass: HomeAssistant) -> None:
    """Register the frontend resource with compatibility for older HA versions."""
    if not hasattr(hass, "http") or hass.http is None:
        return

    try:
        from homeassistant.components.http import StaticPathConfig

        await hass.http.async_register_static_paths(
            [StaticPathConfig(CARD_URL, str(CARD_PATH), cache_headers=False)]
        )
    except (ImportError, AttributeError):
        hass.http.register_static_path(CARD_URL, str(CARD_PATH), cache_headers=False)
