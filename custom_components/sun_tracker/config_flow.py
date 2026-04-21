"""Config flow for Sun Tracker."""

from __future__ import annotations

from homeassistant import config_entries
from homeassistant.core import callback

from .const import DOMAIN


class SunTrackerConfigFlow(config_entries.ConfigFlow, domain=DOMAIN):
    """Handle a config flow for Sun Tracker."""

    VERSION = 1

    async def async_step_user(self, user_input=None):
        """Create the single Sun Tracker entry."""
        if self._async_current_entries():
            return self.async_abort(reason="single_instance_allowed")

        return self.async_create_entry(title="Sun Tracker", data={})

    @staticmethod
    @callback
    def async_get_options_flow(config_entry):
        """Return the options flow."""
        return SunTrackerOptionsFlowHandler()


class SunTrackerOptionsFlowHandler(config_entries.OptionsFlow):
    """No-op options flow."""

    async def async_step_init(self, user_input=None):
        """Finish immediately because the integration uses HA core location."""
        return self.async_create_entry(title="", data={})
