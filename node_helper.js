/* TfL and National Rail Arrival Predictions */

/* Magic Mirror
 * Module: MMM-TFL-Arrivals
 * By Ricardo Gonzalez
 * MIT Licensed.
 */

const NodeHelper = require("node_helper");
const axios = require("axios");
const http = require("http");
const https = require("https");

const AXIOS_TIMEOUT_MS = 15000;

// Disable keep-alive to prevent stale connection pool errors (ECONNABORTED) after days of uptime
const httpAgent = new http.Agent({ keepAlive: false });
const httpsAgent = new https.Agent({ keepAlive: false });

module.exports = NodeHelper.create({
  start: function () {
    this.instances = {};
    console.log("MMM-TFL-Arrivals helper started ...");
  },

  async getTFLTimetable(url, instanceId) {
    if (this.instances[instanceId]?.tflInflight) {
      console.log(`[TFL][${instanceId}] Request already in flight, skipping`);
      return;
    }
    this.instances[instanceId] = { ...this.instances[instanceId], tflInflight: true };
    try {
      console.log(`[TFL][${instanceId}] Fetching`, url);

      const { data } = await axios.get(url, { timeout: AXIOS_TIMEOUT_MS, httpAgent, httpsAgent });
      this.sendSocketNotification("TFL_ARRIVALS_DATA", {
        data,
        instanceId
      });

    } catch (err) {
      const detail = err.response?.status ?? err.code ?? err.message;
      console.error(`[TFL][${instanceId}]`, detail);
      this.sendSocketNotification("TFL_ARRIVALS_DATA", {
        data: null,
        error: true,
        instanceId
      });
    } finally {
      this.instances[instanceId].tflInflight = false;
    }
  },

  async getNRTimetable(url, apiKey, instanceId) {
    if (this.instances[instanceId]?.nrInflight) {
      console.log(`[NR][${instanceId}] Request already in flight, skipping`);
      return;
    }
    this.instances[instanceId] = { ...this.instances[instanceId], nrInflight: true };
    try {
      console.log(`[NR][${instanceId}] Fetching`, url);

      const { data } = await axios.get(url, {
        headers: { "x-apikey": apiKey },
        timeout: AXIOS_TIMEOUT_MS,
        httpAgent,
        httpsAgent
      });

      this.sendSocketNotification("NR_ARRIVALS_DATA", {
        data,
        instanceId
      });

    } catch (err) {
      const detail = err.response?.status ?? err.code ?? err.message;
      console.error(`[NR][${instanceId}]`, detail);
      this.sendSocketNotification("NR_ARRIVALS_DATA", {
        data: null,
        error: true,
        instanceId
      });
    } finally {
      this.instances[instanceId].nrInflight = false;
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
