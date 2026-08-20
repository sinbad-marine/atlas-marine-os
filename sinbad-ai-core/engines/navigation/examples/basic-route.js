"use strict";

const navigation = require("..");

const result = navigation.calculateRoutePlan({
  id: "example-route",
  name: "Example only",
  earthModel: navigation.EARTH_MODELS.WGS84,
  waypoints: [
    { id: "WP01", name: "Start", lat: 41, lon: 29 },
    { id: "WP02", name: "Finish", lat: 40, lon: 20 }
  ]
});

if (result.legs.length !== 1 || result.totalDistanceNm <= 0) {
  throw new Error("example route calculation failed");
}

console.log(JSON.stringify({
  route: result.name,
  earthModel: result.earthModel,
  totalDistanceNm: result.totalDistanceNm,
  warning: result.metadata.warnings[0]
}, null, 2));
