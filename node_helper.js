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

  getTFLTimetable: async function (url, notification, instanceId) {
    const notif = notification.replace(/^GET_/, "");
    try {
      console.log("Fetching TFL:", url);

      const { data } = await axios.get(url);

      this.sendSocketNotification(notif, { data, url, instanceId });

    } catch (err) {
      console.error("TFL error:", err.message);
      this.sendSocketNotification(notif, { data: null, url, instanceId });
    }
  },

  getNRTimetable: async function (url, apiKey, notification, instanceId) {
    const notif = notification.replace(/^GET_/, "");

    try {
      console.log("Fetching National Rail:", url);

      const { data } = await axios.get(url, {
        headers: {
          "x-apikey": apiKey
        }
      });

      this.sendSocketNotification(notif, { data, url, instanceId });

    } catch (err) {
      console.error("NR error:", err.response?.status, err.response?.data);
      this.sendSocketNotification(notif, { data: null, url, instanceId });
    }
  },

  socketNotificationReceived: function (notification, payload) {

     switch (notification) {
      case "INIT":
      this.instances[payload.instanceId] = payload; // store per-instance config
      break;

    case "GET_TFL_ARRIVALS_DATA":
      this.getTFLTimetable(payload.url, notification, payload.instanceId);
      break;

    case "GET_NR_ARRIVALS_DATA":
      this.getNRTimetable(payload.url, payload.apiKey, notification, payload.instanceId);
     }
    },
});
