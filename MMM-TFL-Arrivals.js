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
    updateInterval: 60 * 1 * 1000, // Every minute
    animationSpeed: 2000,
    fade: true,
    fadePoint: 0.25, // Start on 1/4th of the list.
    limit: 5,
    lateThreshold: 2,
    initialLoadDelay: 0, // start delay in milliseconds.
    color: true,
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
        "?numRows=10&timeOffset=0&timeWindow=120"
      );
    }

    if (this.config.debug) {
      Log.info("TFL URL:", this.urlTfl);
      Log.info("NR URL:", this.urlNR);
    }

    this.scheduleUpdate(this.config.initialLoadDelay);

    // Force initial fetch
    this.updateInfo();
  },

  // 🔄 Send the appropriate request based on which IDs are configured
  updateInfo: function () {

    if (this.config.naptanId) {
      this.sendSocketNotification("GET_TFL_ARRIVALS_DATA", {
        url: this.urlTfl
      });
    }

    if (this.config.crsId) {
      this.sendSocketNotification("GET_NR_ARRIVALS_DATA", {
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
    if (this.tfl.data && this.tfl.data.length > 0) return this.tfl.data[0].stopName;
    if (this.nr.data && this.nr.data.length > 0) return this.nr.data[0].stopName;
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
    if (arrival.timeToStation < 1) {
      timeCell.innerHTML = "Due";
    } else {
      timeCell.innerHTML = arrival.timeToStation + " min";
    }
    row.appendChild(timeCell);

    // Platform (optional)
    if (arrival.platform) {
      const platCell = document.createElement("td");
      platCell.innerHTML = arrival.platform;
      row.appendChild(platCell);
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
    data: services.map(service => {
      const origin = service.origin[0]?.locationName || "";
      const destination = service.destination[0]?.locationName || "";
      const std = service.std; // Scheduled Time of Departure
      const etd = service.etd; // Estimated
      const platform = service.platform || "";

      // Approximate time to station in minutes
      let timeToStation = 0;
      if (etd && etd.toLowerCase() !== "on time") {
        const now = moment();
        const dep = moment(std, "HH:mm");
        timeToStation = Math.max(0, dep.diff(now, "minutes"));
      } else {
        const dep = moment(std, "HH:mm");
        const now = moment();
        timeToStation = Math.max(0, dep.diff(now, "minutes"));
      }

      return {
      stopName: data.locationName || this.config.crsId, // Use actual station name
      routeName: origin + " → " + destination,
      direction: destination,
      expectedDeparture: etd,
      timeToStation,
      modeName: "train",
      platform,
      };
    }).sort((a, b) => a.timeToStation - b.timeToStation),
  };

  this.loaded = true;
  this.updateDom(this.config.animationSpeed);
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

    if (notification === "TFL_ARRIVALS_DATA" && payload.url === this.urlTfl) {
      this.processTfl(payload.data);
      this.scheduleUpdate();
    }

    if (notification === "NR_ARRIVALS_DATA" && payload.url === this.urlNR) {
      this.processNr(payload.data);
      this.scheduleUpdate();
    }
  }
});
