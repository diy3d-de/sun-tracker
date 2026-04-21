"""Sensor platform for Sun Tracker."""

from __future__ import annotations

from dataclasses import dataclass
from datetime import UTC, datetime, timedelta
import math
from zoneinfo import ZoneInfo

from homeassistant.components.sensor import SensorEntity
from homeassistant.config_entries import ConfigEntry
from homeassistant.const import UnitOfLength
from homeassistant.core import HomeAssistant
from homeassistant.helpers.entity_platform import AddConfigEntryEntitiesCallback
from homeassistant.helpers.event import async_track_time_interval
from homeassistant.helpers.restore_state import RestoreEntity

from .const import DEFAULT_RADIUS_KM, NAME, SENSOR_UNIQUE_ID

UPDATE_INTERVAL_SECONDS = 300
PATH_STEP_MINUTES = 15


@dataclass(slots=True)
class SolarPosition:
    """Calculated solar position."""

    elevation: float
    azimuth: float
    zenith: float
    declination: float
    daylight: bool


async def async_setup_entry(
    hass: HomeAssistant,
    entry: ConfigEntry,
    async_add_entities: AddConfigEntryEntitiesCallback,
) -> None:
    """Set up the Sun Tracker sensor."""
    async_add_entities([SunTrackerSensor(hass, entry)])


class SunTrackerSensor(RestoreEntity, SensorEntity):
    """Representation of the current solar position."""

    _attr_has_entity_name = False
    _attr_name = NAME
    _attr_unique_id = SENSOR_UNIQUE_ID
    _attr_icon = "mdi:white-balance-sunny"
    _attr_should_poll = False

    def __init__(self, hass: HomeAssistant, entry: ConfigEntry) -> None:
        """Initialize the sensor."""
        self.hass = hass
        self.entry = entry
        self._attr_native_value = None
        self._attr_extra_state_attributes = {}
        self._unsub_timer = None

    async def async_added_to_hass(self) -> None:
        """Handle entity added to hass."""
        await super().async_added_to_hass()
        last_state = await self.async_get_last_state()
        if last_state is not None:
            self._attr_native_value = last_state.state
            self._attr_extra_state_attributes = dict(last_state.attributes)

        self._async_refresh_state()
        self._unsub_timer = async_track_time_interval(
            self.hass,
            lambda now: self._async_handle_timer(),
            timedelta_seconds(UPDATE_INTERVAL_SECONDS),
        )

    async def async_will_remove_from_hass(self) -> None:
        """Clean up listeners."""
        if self._unsub_timer is not None:
            self._unsub_timer()
            self._unsub_timer = None

    @property
    def native_unit_of_measurement(self) -> str:
        """Return the unit for the sensor state."""
        return "deg"

    @property
    def suggested_display_precision(self) -> int:
        """Round for frontend display."""
        return 1

    def _async_handle_timer(self) -> None:
        """Handle timer updates."""
        self._async_refresh_state()
        self.async_write_ha_state()

    def _async_refresh_state(self) -> None:
        """Refresh sensor state from the HA location."""
        latitude = self.hass.config.latitude
        longitude = self.hass.config.longitude
        time_zone = self.hass.config.time_zone
        now = datetime.now(UTC)
        position = calculate_solar_position(now, latitude, longitude)
        map_point = project_sun_ground_point(latitude, longitude, position.azimuth, DEFAULT_RADIUS_KM)
        day_path = build_daily_path(now, latitude, longitude, time_zone, DEFAULT_RADIUS_KM)

        self._attr_native_value = round(position.elevation, 1)
        self._attr_extra_state_attributes = {
            "azimuth": round(position.azimuth, 1),
            "elevation": round(position.elevation, 1),
            "zenith": round(position.zenith, 1),
            "declination": round(position.declination, 3),
            "daylight": position.daylight,
            "observer_latitude": latitude,
            "observer_longitude": longitude,
            "map_target_latitude": round(map_point[0], 6),
            "map_target_longitude": round(map_point[1], 6),
            "map_radius": DEFAULT_RADIUS_KM,
            "distance_unit": UnitOfLength.KILOMETERS,
            "time_zone": time_zone,
            "sunrise": day_path["sunrise"],
            "sunset": day_path["sunset"],
            "solar_noon": day_path["solar_noon"],
            "day_path": day_path["path"],
            "updated_at": now.isoformat(),
        }

    @property
    def extra_state_attributes(self) -> dict:
        """Return state attributes."""
        return self._attr_extra_state_attributes


def timedelta_seconds(seconds: int):
    """Return a timedelta without importing the full symbol list everywhere."""
    return timedelta(seconds=seconds)


def calculate_solar_position(date_utc: datetime, latitude: float, longitude: float) -> SolarPosition:
    """Calculate solar position from UTC time and geographic position."""
    day = date_utc.timetuple().tm_yday
    hour = date_utc.hour + (date_utc.minute / 60) + (date_utc.second / 3600)
    gamma = (2 * math.pi / 365) * (day - 1 + (hour - 12) / 24)

    declination = (
        0.006918
        - 0.399912 * math.cos(gamma)
        + 0.070257 * math.sin(gamma)
        - 0.006758 * math.cos(2 * gamma)
        + 0.000907 * math.sin(2 * gamma)
        - 0.002697 * math.cos(3 * gamma)
        + 0.00148 * math.sin(3 * gamma)
    )

    equation_of_time = 229.18 * (
        0.000075
        + 0.001868 * math.cos(gamma)
        - 0.032077 * math.sin(gamma)
        - 0.014615 * math.cos(2 * gamma)
        - 0.040849 * math.sin(2 * gamma)
    )

    total_minutes = date_utc.hour * 60 + date_utc.minute + (date_utc.second / 60)
    true_solar_time = (total_minutes + equation_of_time + 4 * longitude + 1440) % 1440
    hour_angle = true_solar_time / 4 - 180
    if hour_angle < -180:
        hour_angle += 360

    lat_rad = math.radians(latitude)
    hour_angle_rad = math.radians(hour_angle)
    cos_zenith = (
        math.sin(lat_rad) * math.sin(declination)
        + math.cos(lat_rad) * math.cos(declination) * math.cos(hour_angle_rad)
    )
    zenith = math.degrees(math.acos(max(-1.0, min(1.0, cos_zenith))))
    elevation = 90 - zenith

    azimuth_rad = math.atan2(
        math.sin(hour_angle_rad),
        math.cos(hour_angle_rad) * math.sin(lat_rad) - math.tan(declination) * math.cos(lat_rad),
    )
    azimuth = (math.degrees(azimuth_rad) + 180 + 360) % 360

    return SolarPosition(
        elevation=elevation,
        azimuth=azimuth,
        zenith=zenith,
        declination=math.degrees(declination),
        daylight=elevation > 0,
    )


def project_sun_ground_point(
    latitude: float,
    longitude: float,
    bearing_deg: float,
    distance_km: float,
) -> tuple[float, float]:
    """Project a point from the observer along the solar bearing."""
    earth_radius_km = 6371.0
    angular_distance = distance_km / earth_radius_km
    bearing_rad = math.radians(bearing_deg)
    lat1 = math.radians(latitude)
    lon1 = math.radians(longitude)

    lat2 = math.asin(
        math.sin(lat1) * math.cos(angular_distance)
        + math.cos(lat1) * math.sin(angular_distance) * math.cos(bearing_rad)
    )
    lon2 = lon1 + math.atan2(
        math.sin(bearing_rad) * math.sin(angular_distance) * math.cos(lat1),
        math.cos(angular_distance) - math.sin(lat1) * math.sin(lat2),
    )

    return (math.degrees(lat2), ((math.degrees(lon2) + 540) % 360) - 180)


def build_daily_path(
    now_utc: datetime,
    latitude: float,
    longitude: float,
    time_zone_name: str,
    distance_km: float,
) -> dict:
    """Build the full daily solar path for the current local day."""
    local_tz = ZoneInfo(time_zone_name)
    local_now = now_utc.astimezone(local_tz)
    local_midnight = datetime.combine(local_now.date(), datetime.min.time(), tzinfo=local_tz)

    path: list[dict] = []
    sunrise: str | None = None
    sunset: str | None = None
    solar_noon: str | None = None
    highest_elevation = -90.0

    for minute in range(0, (24 * 60) + 1, PATH_STEP_MINUTES):
        local_time = local_midnight + timedelta(minutes=minute)
        utc_time = local_time.astimezone(UTC)
        position = calculate_solar_position(utc_time, latitude, longitude)
        point_lat, point_lon = project_sun_ground_point(
            latitude,
            longitude,
            position.azimuth,
            distance_km,
        )
        daylight = position.elevation > 0

        if daylight and sunrise is None:
            sunrise = local_time.isoformat()

        if not daylight and sunrise is not None and sunset is None:
            sunset = local_time.isoformat()

        if position.elevation > highest_elevation:
            highest_elevation = position.elevation
            solar_noon = local_time.isoformat()

        path.append(
            {
                "time": local_time.isoformat(),
                "daylight": daylight,
                "elevation": round(position.elevation, 2),
                "azimuth": round(position.azimuth, 2),
                "target_latitude": round(point_lat, 6),
                "target_longitude": round(point_lon, 6),
            }
        )

    return {
        "sunrise": sunrise,
        "sunset": sunset,
        "solar_noon": solar_noon,
        "path": path,
    }
