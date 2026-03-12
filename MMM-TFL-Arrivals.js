/* Magic Mirror Module: MMM-TFL-Arrivals
 * By Ricardo Gonzalez — Modified for National Rail support
 * MIT Licensed.
 */

Module.register("MMM-TFL-Arrivals", {

  defaults: {
    app_id: "",
    app_key: "",
    ldbws_key: "", // national rail's LDBWS API (consumer) Key, from the specification tab of the Live Departure Board subscription
    naptanId: "", // StopPoint id
    crsId: "", // CRS station Id for national rail stations
    excludedDestinationCrsIds: [], // CRS station Id for routes we want to exclude
    updateInterval: 60 * 1 * 1000, // Every minute
    animationSpeed: 2000,
    fade: true,
    fadePoint: 0.25, // Start on 1/4th of the list.
    limit: 5,
    lateThreshold: 2,
    initialLoadDelay: 0, // start delay in milliseconds.
    color: true,
    delayedColor: "orange",
    walkingTime: null, // minutes walk to stop/station; null = disabled
    debug: false,
  },

  start: function () {
    Log.log("Starting module: " + this.name);

    this.loaded = false;
    this.tfl = {};
    this.nr = {};

    // API base URLs
    this.apiBaseTFL = "https://api.tfl.gov.uk/StopPoint/";
    this.apiBaseNR = "https://api1.raildata.org.uk/1010-live-departure-board-dep/LDBWS/api/20220120/GetDepBoardWithDetails/";

    // Construct URLs
    if (this.config.naptanId) {
      this.urlTfl = encodeURI(
        this.apiBaseTFL +
        this.config.naptanId +
        "/arrivals" +
        this.getParamsTFL()
      );
    }

    if (this.config.crsId) {
      this.urlNR = encodeURI(
        this.apiBaseNR +
        this.config.crsId +
        "?numRows=20&timeOffset=0&timeWindow=120"
      );
    }

    if (this.config.debug) {
      Log.info("TFL URL:", this.urlTfl);
      Log.info("NR URL:", this.urlNR);
    }

    this.scheduleUpdate(this.config.initialLoadDelay);
  },

  // 🔄 Send the appropriate request based on which IDs are configured
  updateInfo: function () {

    if (this.config.naptanId) {
      this.sendSocketNotification("GET_TFL_ARRIVALS_DATA", {
        instanceId: this.identifier,
        url: this.urlTfl
      });
    }

    if (this.config.crsId) {
      this.sendSocketNotification("GET_NR_ARRIVALS_DATA", {
        instanceId: this.identifier,
        url: this.urlNR,
        apiKey: this.config.ldbws_key
      });
    }
  },

  // ----- UI COMPONENTS -----

  getStyles: function () {
    return ["MMM-TFL-Arrivals.css", "font-awesome.css"];
  },

  getScripts: function () {
    return ["moment.js"];
  },

  getHeader: function () {
    if (this.tfl.data && this.tfl.data.length > 0) {
      let icon;
      switch (this.tfl.data[0].modeName) {
        case "bus":  icon = '<i class="fas fa-bus"></i>'; break;
        case "tube": icon = '<i class="fas fa-subway"></i>'; break;
        default:     icon = '<i class="fas fa-train"></i>';
      }
      return `${icon} ${this.tfl.data[0].stopName} (${this.tfl.data[0].stopLetter})`;
    }
    if (this.nr.data && this.nr.data.length > 0) {
      return `<i class="fas fa-train"></i> ${this.nr.data[0].stopName} (${this.config.crsId})`;
    }
    return this.config.header;
  },

  getDom: function () {
    const wrapper = document.createElement("div");

    // config sanity checks
    if (!this.config.naptanId && !this.config.crsId) {
      wrapper.innerHTML = "Please set a naptan or crsId.";
      wrapper.className = "dimmed light small";
      return wrapper;
    }

    if (this.config.crsId && !this.config.ldbws_key) {
      wrapper.innerHTML = "National Rail API key missing.";
      wrapper.className = "dimmed light small";
      return wrapper;
    }

    if (this.config.naptanId && !this.config.app_key && !this.config.app_id) {
      wrapper.innerHTML = "TFL API key missing." ;
      wrapper.className = "dimmed light small";
      return wrapper;
    }

    if (!this.loaded) {
      wrapper.innerHTML = "Loading transport arrival predictions...";
      wrapper.className = "dimmed light small";
      return wrapper;
    }

    // ========================
    //       DISPLAY
    // ========================

    const table = document.createElement("table");
    table.className = "small";

    if (this.tfl.data) {
      this.buildTFL(table);
    }

    if (this.nr.data) {
      this.buildNR(table);
    }

    wrapper.appendChild(table);
    return wrapper;
  },

  // ---------- DISPLAY BUILDERS ----------

  buildTFL: function (table) {
    const limit = Math.min(this.config.limit, this.tfl.data.length);

    for (let i = 0; i < limit; i++) {
      const arrival = this.tfl.data[i];
      const row = document.createElement("tr");

      // Icon
      const routeCell = document.createElement("td");
      let icon = "";
      switch (arrival.modeName) {
        case "bus": icon = '<i class="fas fa-bus"></i>'; break;
        case "tube": icon = '<i class="fas fa-subway"></i>'; break;
      }
      routeCell.innerHTML = icon + " " + arrival.routeName;
      row.appendChild(routeCell);

      // Destination
      const destCell = document.createElement("td");
      destCell.innerHTML = arrival.direction;
      row.appendChild(destCell);

      // Time
      const timeCell = document.createElement("td");
      const mins = moment.duration(arrival.timeToStation, "seconds").minutes();

      if (mins < 1) {
        timeCell.innerHTML = "Due";
      } else {
        timeCell.innerHTML = mins + " min";
      }
      row.appendChild(timeCell);

      if (this.config.walkingTime !== null && this.config.walkingTime !== undefined) {
        const walkCell = document.createElement("td");
        const walkColour = this.getWalkingColour(mins);
        walkCell.innerHTML = '<i class="fas fa-walking"></i>';
        if (walkColour) walkCell.style.color = walkColour;
        row.appendChild(walkCell);
      }

      table.appendChild(row);
    }
  },

  buildNR: function (table) {
  if (!this.nr.data) return;

  const limit = Math.min(this.config.limit, this.nr.data.length);

  for (let i = 0; i < limit; i++) {
    const arrival = this.nr.data[i];
    const row = document.createElement("tr");

    // Icon + Route
    const routeCell = document.createElement("td");
    routeCell.innerHTML = '<i class="fas fa-train"></i> ' + arrival.routeName;
    row.appendChild(routeCell);

    // Destination
    const destCell = document.createElement("td");
    destCell.innerHTML = arrival.direction;
    row.appendChild(destCell);

    // Time
    const timeCell = document.createElement("td");
    if (arrival.status === "cancelled") {
      timeCell.innerHTML = "Cancelled";
      timeCell.style.color = "red";
    } else if (arrival.status === "delayed") {
      const etd = arrival.expectedDeparture;
      timeCell.innerHTML = /^\d{2}:\d{2}$/.test(etd) ? etd : "Delayed";
      timeCell.style.color = this.config.delayedColor;
    } else {
      timeCell.innerHTML = arrival.timeToStation < 1 ? "Due" : arrival.timeToStation + " min";
    }
    row.appendChild(timeCell);

    if (this.config.walkingTime !== null && this.config.walkingTime !== undefined) {
      const walkCell = document.createElement("td");
      const walkColour = arrival.status === "cancelled" ? null : this.getWalkingColour(arrival.timeToStation);
      walkCell.innerHTML = '<i class="fas fa-walking"></i>';
      if (walkColour) walkCell.style.color = walkColour;
      row.appendChild(walkCell);
    }

    table.appendChild(row);
  }
},

  // ---------- PROCESSORS ----------

  processTfl: function (data) {
    if (this.config.debug) Log.info("TFL DATA:", data);

    if (!data || !Array.isArray(data) || data.length === 0) {
      this.tfl = { data: null, message: "No data returned" };
      this.loaded = true;
      this.updateDom(this.config.animationSpeed);
      return;
    }

    this.tfl = {
      timestamp: moment().format("LLL"),
      data: data
        .map(arrival => ({
          stopName: arrival.stationName,
          stopLetter: arrival.platformName,
          routeName: arrival.lineName,
          direction: arrival.destinationName,
          expectedDeparture: arrival.expectedArrival,
          timeToStation: arrival.timeToStation,
          modeName: arrival.modeName,
        }))
        .sort((a, b) => a.timeToStation - b.timeToStation),
    };

    this.loaded = true;
    this.updateDom(this.config.animationSpeed);
  },

 processNr: function (data) {
  if (this.config.debug) Log.info("NR RAW DATA:", data);

  if (!data || !data.trainServices) {
    this.nr = { data: null, message: "No data returned" };
    this.loaded = true;
    this.updateDom(this.config.animationSpeed);
    return;
  }

  const services = data.trainServices;

  this.nr = {
    timestamp: moment().format("LLL"),
    data: services.filter(service =>
    {
      const destinationCrs = service.destination[0]?.crs || "";
      return !this.config.excludedDestinationCrsIds.includes(destinationCrs);
    }).map(service => {
      const origin = service.origin[0]?.locationName || "";
      const destination = service.destination[0]?.locationName || "";
      const std = service.std; // Scheduled Time of Departure
      const etd = service.etd; // Estimated
      const platform = service.platform || "";

      // Determine status
      let status = "ontime";
      if (etd === "Cancelled") status = "cancelled";
      else if (etd === "Delayed" || /^\d{2}:\d{2}$/.test(etd)) status = "delayed";

      // Use the estimated time if available, otherwise scheduled (always use std for cancelled)
      const depTime = (status !== "cancelled" && /^\d{2}:\d{2}$/.test(etd)) ? etd : std;
      let timeToStation = moment(depTime, "HH:mm").diff(moment(), "minutes");
      if (timeToStation < 0) {
        const wrapped = timeToStation + 24 * 60;
        // If wrapping gives a plausible result (within 4h of the query window) it's a
        // genuine midnight crossing. Otherwise the train just departed — clamp to 0.
        timeToStation = wrapped <= 240 ? wrapped : 0;
      }

      return {
        stopName: data.locationName || this.config.crsId,
        routeName: std,
        direction: destination,
        expectedDeparture: etd,
        timeToStation,
        status,
        modeName: "train",
        platform,
      };
    }).sort((a, b) => a.timeToStation - b.timeToStation),
  };

  this.loaded = true;
  this.updateDom(this.config.animationSpeed);
},

  // Returns a colour based on whether the user can walk to the stop in time.
  // Returns null if walkingTime is not configured.
  getWalkingColour: function (minsToDepart) {
    if (this.config.walkingTime === null || this.config.walkingTime === undefined) return null;
    const margin = minsToDepart - this.config.walkingTime;
    if (margin > 1) return "green";
    if (margin >= 0) return "orange";
    return "red";
  },

  // ---------- HELPERS ----------

  getParamsTFL: function () {
    return `?app_id=${this.config.app_id}&app_key=${this.config.app_key}`;
  },

  scheduleUpdate: function (delay) {
    const nextLoad = typeof delay === "number" ? delay : this.config.updateInterval;
    setTimeout(() => this.updateInfo(), nextLoad);
  },

  // ---------- RECEIVE DATA FROM HELPER ----------

  socketNotificationReceived: function (notification, payload) {
if (payload.instanceId !== this.identifier) return; // ignore others

    if (notification === "TFL_ARRIVALS_DATA") {
      this.processTfl(payload.data);
      this.scheduleUpdate();
    }

    if (notification === "NR_ARRIVALS_DATA") {
      this.processNr(payload.data);
      this.scheduleUpdate();
    }
  }
});
