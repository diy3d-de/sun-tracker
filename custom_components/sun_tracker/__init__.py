"""Sun Tracker integration."""

from __future__ import annotations

from pathlib import Path

from homeassistant.components.http import StaticPathConfig
from homeassistant.config_entries import ConfigEntry
from homeassistant.const import Platform
from homeassistant.core import HomeAssistant

DOMAIN = "sun_tracker"
PLATFORMS: list[Platform] = [Platform.SENSOR]
CARD_URL = f"/{DOMAIN}/sun-tracker-card.js"
CARD_PATH = Path(__file__).parent / "frontend" / "sun-tracker-card.js"


async def async_setup(hass: HomeAssistant, config: dict) -> bool:
    """Set up Sun Tracker from YAML."""
    await hass.http.async_register_static_paths(
        [StaticPathConfig(CARD_URL, str(CARD_PATH), cache_headers=False)]
    )
    return True


async def async_setup_entry(hass: HomeAssistant, entry: ConfigEntry) -> bool:
    """Set up Sun Tracker from a config entry."""
    await hass.config_entries.async_forward_entry_setups(entry, PLATFORMS)
    return True


async def async_unload_entry(hass: HomeAssistant, entry: ConfigEntry) -> bool:
    """Unload a config entry."""
    return await hass.config_entries.async_unload_platforms(entry, PLATFORMS)
