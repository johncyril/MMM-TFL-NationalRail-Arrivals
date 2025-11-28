/* TfL and National Rail Arrival Predictions */

/* Magic Mirror
 * Module: MMM-TFL-Arrivals
 * By Ricardo Gonzalez
 * MIT Licensed.
 */

const NodeHelper = require("node_helper");

module.exports = NodeHelper.create({
  start: function () {
    console.log("MMM-TFL-Arrivals helper started ...");
  },

  getTFLTimetable: async function (url, notification) {
    const notif = notification.replace(/^GET_/, "");
    try {
      console.log("Fetching TFL:", url);

      const { data } = await axios.get(url);

      this.sendSocketNotification(notif, { data, url });

    } catch (err) {
      console.error("TFL error:", err.message);
      this.sendSocketNotification(notif, { data: null, url });
    }
  },

  getNRTimetable: async function (url, apiKey, notification) {
    const notif = notification.replace(/^GET_/, "");

    try {
      console.log("Fetching National Rail:", url);

      const { data } = await axios.get(url, {
        headers: {
          "x-apikey": apiKey
        }
      });

      this.sendSocketNotification(notif, { data, url });

    } catch (err) {
      console.error("NR error:", err.response?.status, err.response?.data);
      this.sendSocketNotification(notif, { data: null, url });
    }
  },

  socketNotificationReceived: function (notification, payload) {

    if (notification === "GET_TFL_ARRIVALS_DATA") {
      this.getTFLTimetable(payload.url, notification);
    }

    if (notification === "GET_NR_ARRIVALS_DATA") {
      this.getNRTimetable(payload.url, payload.apiKey, notification);
    }
  },
});
