/* TfL and National Rail Arrival Predictions */

/* Magic Mirror
 * Module: MMM-TFL-Arrivals
 * By Ricardo Gonzalez
 * MIT Licensed.
 */

const NodeHelper = require("node_helper");
const axios = require("axios");

module.exports = NodeHelper.create({
  start: function () {
    this.instances = {};
    console.log("MMM-TFL-Arrivals helper started ...");
  },

 async getTFLTimetable(url, instanceId) {
    try {
      console.log(`[TFL][${instanceId}] Fetching`, url);

      const { data } = await axios.get(url);
      this.sendSocketNotification("TFL_ARRIVALS_DATA", {
        data,
        instanceId
      });

    } catch (err) {
      console.error(`[TFL][${instanceId}]`, err.message);
      this.sendSocketNotification("TFL_ARRIVALS_DATA", {
        data: null,
        instanceId
      });
    }
  },

  async getNRTimetable(url, apiKey, instanceId) {
    try {
      console.log(`[NR][${instanceId}] Fetching`, url);

      const { data } = await axios.get(url, {
        headers: { "x-apikey": apiKey }
      });

      this.sendSocketNotification("NR_ARRIVALS_DATA", {
        data,
        instanceId
      });

    } catch (err) {
      console.error(`[NR][${instanceId}]`, err.response?.status);
      this.sendSocketNotification("NR_ARRIVALS_DATA", {
        data: null,
        instanceId
      });
    }
  },

 socketNotificationReceived(notification, payload) {
    switch (notification) {
      case "GET_TFL_ARRIVALS_DATA":
        this.getTFLTimetable(payload.url, payload.instanceId);
        break;

      case "GET_NR_ARRIVALS_DATA":
        this.getNRTimetable(
          payload.url,
          payload.apiKey,
          payload.instanceId
        );
        break;
    }
  }
});
