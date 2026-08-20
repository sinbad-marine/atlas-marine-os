(function (global) {
  "use strict";

  const R_NM = 3440.065;
  const toRad = (value) => value * Math.PI / 180;
  const toDeg = (value) => value * 180 / Math.PI;
  const normalize360 = (value) => ((value % 360) + 360) % 360;

  function normalizeText(value) {
    return String(value || "")
      .toLocaleLowerCase("tr-TR")
      .replace(/[’‘`´]/g, "'")
      .replace(/,/g, ".")
      .replace(/\s+/g, " ")
      .trim();
  }

  function parseCoordinate(text, axis) {
    const source = normalizeText(text);
    const direction = axis === "lat"
      ? "(kuzey|güney|north|south|nord|süd|sued|n|s)"
      : "(doğu|dogu|batı|bati|east|west|ost|e|w)";
    // JavaScript's word boundary is ASCII-only and misses names ending in
    // Turkish characters such as the dotless ı in "batı".
    const match = source.match(new RegExp("(\\d{1,3})(?:\\s*(?:°|derece|deg))?\\s*(\\d{1,2}(?:\\.\\d+)?)?\\s*(?:['′]|dakika|min)?\\s*(\\d{1,2}(?:\\.\\d+)?)?\\s*(?:[\\\"″]|saniye|sec)?\\s*" + direction + "(?=\\s|$|[-–—.,;:])", "i"));
    if (!match) return null;

    const degrees = Number(match[1]);
    const minutes = Number(match[2] || 0);
    const seconds = Number(match[3] || 0);
    const hemisphere = match[4];
    const limit = axis === "lat" ? 90 : 180;
    if (degrees > limit || minutes >= 60 || seconds >= 60) return null;

    const negative = /^(güney|south|süd|sued|s|batı|bati|west|w)$/i.test(hemisphere);
    const value = degrees + minutes / 60 + seconds / 3600;
    return negative ? -value : value;
  }

  function formatCoordinate(value, axis) {
    const absolute = Math.abs(Number(value));
    let degrees = Math.floor(absolute);
    let minutesFloat = (absolute - degrees) * 60;
    let minutes = Math.floor(minutesFloat);
    let seconds = Math.round((minutesFloat - minutes) * 60);
    if (seconds === 60) { seconds = 0; minutes += 1; }
    if (minutes === 60) { minutes = 0; degrees += 1; }
    const hemisphere = axis === "lat"
      ? (value >= 0 ? "N" : "S")
      : (value >= 0 ? "E" : "W");
    const width = axis === "lat" ? 2 : 3;
    return `${String(degrees).padStart(width, "0")}° ${String(minutes).padStart(2, "0")}′ ${String(seconds).padStart(2, "0")}″ ${hemisphere}`;
  }

  function distanceRun(speedKnots, hours) {
    return Number(speedKnots) * Number(hours);
  }

  function rhumbDestination(lat, lon, course, distanceNm) {
    const phi1 = toRad(Number(lat));
    const lambda1 = toRad(Number(lon));
    const theta = toRad(normalize360(Number(course)));
    const delta = Number(distanceNm) / R_NM;
    const deltaPhi = delta * Math.cos(theta);
    let phi2 = phi1 + deltaPhi;
    if (Math.abs(phi2) > Math.PI / 2) phi2 = phi2 > 0 ? Math.PI - phi2 : -Math.PI - phi2;
    const deltaPsi = Math.log(Math.tan(phi2 / 2 + Math.PI / 4) / Math.tan(phi1 / 2 + Math.PI / 4));
    const q = Math.abs(deltaPsi) > 1e-12 ? deltaPhi / deltaPsi : Math.cos(phi1);
    const deltaLambda = delta * Math.sin(theta) / q;
    const lambda2 = ((lambda1 + deltaLambda + 3 * Math.PI) % (2 * Math.PI)) - Math.PI;
    return { lat: toDeg(phi2), lon: toDeg(lambda2) };
  }

  function greatCircleInverse(lat1, lon1, lat2, lon2) {
    const phi1 = toRad(Number(lat1));
    const phi2 = toRad(Number(lat2));
    const deltaLambda = toRad(Number(lon2) - Number(lon1));
    const central = Math.acos(Math.min(1, Math.max(-1,
      Math.sin(phi1) * Math.sin(phi2) + Math.cos(phi1) * Math.cos(phi2) * Math.cos(deltaLambda)
    )));
    const y = Math.sin(deltaLambda) * Math.cos(phi2);
    const x = Math.cos(phi1) * Math.sin(phi2) - Math.sin(phi1) * Math.cos(phi2) * Math.cos(deltaLambda);
    return { distanceNm: central * R_NM, initialCourse: normalize360(toDeg(Math.atan2(y, x))) };
  }

  function greatCircleDestination(lat, lon, initialCourse, distanceNm) {
    const phi1 = toRad(Number(lat));
    const lambda1 = toRad(Number(lon));
    const theta = toRad(normalize360(Number(initialCourse)));
    const delta = Number(distanceNm) / R_NM;
    const phi2 = Math.asin(Math.sin(phi1) * Math.cos(delta) + Math.cos(phi1) * Math.sin(delta) * Math.cos(theta));
    const lambda2 = lambda1 + Math.atan2(
      Math.sin(theta) * Math.sin(delta) * Math.cos(phi1),
      Math.cos(delta) - Math.sin(phi1) * Math.sin(phi2)
    );
    return { lat: toDeg(phi2), lon: ((toDeg(lambda2) + 540) % 360) - 180 };
  }

  function rhumbInverse(lat1, lon1, lat2, lon2) {
    const phi1 = toRad(Number(lat1));
    const phi2 = toRad(Number(lat2));
    const deltaPhi = phi2 - phi1;
    let deltaLambda = toRad(Number(lon2) - Number(lon1));
    if (Math.abs(deltaLambda) > Math.PI) deltaLambda += deltaLambda > 0 ? -2 * Math.PI : 2 * Math.PI;
    const deltaPsi = Math.log(Math.tan(phi2 / 2 + Math.PI / 4) / Math.tan(phi1 / 2 + Math.PI / 4));
    const q = Math.abs(deltaPsi) > 1e-12 ? deltaPhi / deltaPsi : Math.cos(phi1);
    return {
      distanceNm: Math.hypot(deltaPhi, q * deltaLambda) * R_NM,
      course: normalize360(toDeg(Math.atan2(deltaLambda, deltaPsi)))
    };
  }

  function intermediateGreatCirclePoint(lat1, lon1, lat2, lon2, fraction) {
    const f = Number(fraction);
    if (f < 0 || f > 1) throw new RangeError("fraction must be between 0 and 1");
    const inverse = greatCircleInverse(lat1, lon1, lat2, lon2);
    return greatCircleDestination(lat1, lon1, inverse.initialCourse, inverse.distanceNm * f);
  }

  function greatCircleWaypoints(start, end, segmentCount) {
    const segments = Math.floor(Number(segmentCount));
    if (segments < 1) throw new RangeError("segment count must be at least one");
    const inverse = greatCircleInverse(start.lat, start.lon, end.lat, end.lon);
    return Array.from({ length: segments + 1 }, (_, index) => {
      const fraction = index / segments;
      const point = intermediateGreatCirclePoint(start.lat, start.lon, end.lat, end.lon, fraction);
      return { ...point, fraction, distanceFromStartNm: inverse.distanceNm * fraction };
    });
  }

  function compareOceanRoutes(start, end) {
    const greatCircle = greatCircleInverse(start.lat, start.lon, end.lat, end.lon);
    const rhumb = rhumbInverse(start.lat, start.lon, end.lat, end.lon);
    const savingNm = rhumb.distanceNm - greatCircle.distanceNm;
    return {
      greatCircleDistanceNm: greatCircle.distanceNm,
      rhumbDistanceNm: rhumb.distanceNm,
      savingNm,
      savingPercent: rhumb.distanceNm === 0 ? 0 : savingNm / rhumb.distanceNm * 100,
      greatCircleInitialCourse: greatCircle.initialCourse,
      rhumbCourse: rhumb.course
    };
  }

  function crossTrackError(startLat, startLon, endLat, endLon, vesselLat, vesselLon) {
    const route = greatCircleInverse(startLat, startLon, endLat, endLon);
    const vessel = greatCircleInverse(startLat, startLon, vesselLat, vesselLon);
    const delta13 = vessel.distanceNm / R_NM;
    const angle = toRad(vessel.initialCourse - route.initialCourse);
    const crossTrackNm = Math.asin(Math.sin(delta13) * Math.sin(angle)) * R_NM;
    const alongTrackNm = Math.acos(Math.min(1, Math.max(-1, Math.cos(delta13) / Math.cos(crossTrackNm / R_NM)))) * R_NM;
    return { crossTrackNm, alongTrackNm };
  }

  function routeLegProgress(start, end, vessel, speedOverGroundKnots) {
    const leg = greatCircleInverse(start.lat, start.lon, end.lat, end.lon);
    const track = crossTrackError(start.lat, start.lon, end.lat, end.lon, vessel.lat, vessel.lon);
    const alongTrackNm = Math.max(0, track.alongTrackNm);
    const remainingNm = Math.max(0, leg.distanceNm - alongTrackNm);
    const speed = Number(speedOverGroundKnots);
    return {
      legDistanceNm: leg.distanceNm,
      alongTrackNm,
      remainingNm,
      crossTrackNm: track.crossTrackNm,
      percentComplete: leg.distanceNm === 0 ? 100 : Math.min(100, alongTrackNm / leg.distanceNm * 100),
      hoursRemaining: speed > 0 ? remainingNm / speed : Infinity,
      passedWaypoint: track.alongTrackNm > leg.distanceNm
    };
  }

  function routeCorridorStatus(start, end, vessel, corridorHalfWidthNm) {
    const track = crossTrackError(start.lat, start.lon, end.lat, end.lon, vessel.lat, vessel.lon);
    const limit = Math.abs(Number(corridorHalfWidthNm));
    const offset = Math.abs(track.crossTrackNm);
    return {
      crossTrackNm: track.crossTrackNm,
      side: track.crossTrackNm > 0 ? "starboard" : track.crossTrackNm < 0 ? "port" : "on-track",
      withinCorridor: offset <= limit,
      exceedanceNm: Math.max(0, offset - limit)
    };
  }

  function relativeToTrueBearing(relativeBearing, vesselHeading) {
    return normalize360(Number(vesselHeading) + Number(relativeBearing));
  }

  function trueToRelativeBearing(trueBearing, vesselHeading) {
    const clockwise = normalize360(Number(trueBearing) - Number(vesselHeading));
    return { clockwise, signed: clockwise > 180 ? clockwise - 360 : clockwise };
  }

  function speedDistanceTime(values) {
    const distanceNm = values.distanceNm == null ? null : Number(values.distanceNm);
    const speedKnots = values.speedKnots == null ? null : Number(values.speedKnots);
    const hours = values.hours == null ? null : Number(values.hours);
    const supplied = [distanceNm, speedKnots, hours].filter(value => value != null && Number.isFinite(value)).length;
    if (supplied !== 2) throw new RangeError("provide exactly two of distanceNm, speedKnots, and hours");
    if ([distanceNm, speedKnots, hours].some(value => value != null && value < 0)) throw new RangeError("navigation values cannot be negative");
    if (distanceNm == null) return { distanceNm: speedKnots * hours, speedKnots, hours };
    if (speedKnots == null) {
      if (hours === 0) throw new RangeError("hours must be greater than zero");
      return { distanceNm, speedKnots: distanceNm / hours, hours };
    }
    if (speedKnots === 0) throw new RangeError("speed must be greater than zero");
    return { distanceNm, speedKnots, hours: distanceNm / speedKnots };
  }

  function compassToTrue(compassCourse, deviation, variation) {
    return normalize360(Number(compassCourse) + Number(deviation) + Number(variation));
  }

  function trueToCompass(trueCourse, deviation, variation) {
    return normalize360(Number(trueCourse) - Number(variation) - Number(deviation));
  }

  function magneticVariationAtDate(chartVariationDegrees, annualChangeMinutes, chartYear, targetDate) {
    const date = new Date(targetDate);
    if (Number.isNaN(date.getTime())) throw new RangeError("invalid target date");
    const start = Date.UTC(Number(chartYear), 0, 1);
    const years = (date.getTime() - start) / (365.2425 * 86400000);
    const variation = Number(chartVariationDegrees) + Number(annualChangeMinutes) / 60 * years;
    return { variation, years, changeDegrees: variation - Number(chartVariationDegrees) };
  }

  function geographicRange(eyeHeightMeters, objectHeightMeters) {
    const eye = Math.max(0, Number(eyeHeightMeters || 0));
    const object = Math.max(0, Number(objectHeightMeters || 0));
    const observerHorizonNm = 2.08 * Math.sqrt(eye);
    const objectHorizonNm = 2.08 * Math.sqrt(object);
    return { observerHorizonNm, objectHorizonNm, geographicRangeNm: observerHorizonNm + objectHorizonNm };
  }

  function cpaTcpa(own, target) {
    const meanLat = toRad((Number(own.lat) + Number(target.lat)) / 2);
    const relativePosition = {
      east: (Number(target.lon) - Number(own.lon)) * 60 * Math.cos(meanLat),
      north: (Number(target.lat) - Number(own.lat)) * 60
    };
    const ownVelocity = vector(own.speed, own.course);
    const targetVelocity = vector(target.speed, target.course);
    const relativeVelocity = {
      east: targetVelocity.east - ownVelocity.east,
      north: targetVelocity.north - ownVelocity.north
    };
    const velocitySquared = relativeVelocity.east ** 2 + relativeVelocity.north ** 2;
    const rawTcpaHours = velocitySquared < 1e-12 ? Infinity : -(
      relativePosition.east * relativeVelocity.east + relativePosition.north * relativeVelocity.north
    ) / velocitySquared;
    const evaluationHours = Math.max(0, rawTcpaHours);
    const closestEast = relativePosition.east + relativeVelocity.east * evaluationHours;
    const closestNorth = relativePosition.north + relativeVelocity.north * evaluationHours;
    return {
      cpaNm: Math.hypot(closestEast, closestNorth),
      tcpaHours: rawTcpaHours,
      past: rawTcpaHours < 0,
      relativeBearing: vectorToPolar(relativePosition.east, relativePosition.north).direction
    };
  }

  function passageFuel(distanceNm, speedKnots, consumptionPerHour, reservePercent) {
    const hours = speedDistanceTime({ distanceNm, speedKnots }).hours;
    const baseFuel = hours * Number(consumptionPerHour);
    return { hours, baseFuel, totalFuel: baseFuel * (1 + Number(reservePercent || 0) / 100) };
  }

  function ruleOfTwelfths(lowWater, highWater, hoursSinceLow, durationHours) {
    const duration = Number(durationHours || 6);
    const elapsed = Math.min(duration, Math.max(0, Number(hoursSinceLow)));
    const sixth = elapsed / duration * 6;
    const cumulative = [0, 1, 3, 6, 9, 11, 12];
    const index = Math.min(5, Math.floor(sixth));
    const fraction = (cumulative[index] + (cumulative[index + 1] - cumulative[index]) * (sixth - index)) / 12;
    return { height: Number(lowWater) + (Number(highWater) - Number(lowWater)) * fraction, fraction };
  }

  function underKeelClearance(chartedDepth, tideHeight, draft, squat, safetyMargin) {
    const availableDepth = Number(chartedDepth) + Number(tideHeight);
    const requiredDepth = Number(draft) + Number(squat || 0) + Number(safetyMargin || 0);
    return { availableDepth, requiredDepth, clearance: availableDepth - requiredDepth, safe: availableDepth >= requiredDepth };
  }

  function minimumTideForClearance(chartedDepth, draft, squat, safetyMargin) {
    const requiredDepth = Number(draft) + Number(squat || 0) + Number(safetyMargin || 0);
    const minimumTideHeight = requiredDepth - Number(chartedDepth);
    return { requiredDepth, minimumTideHeight, driesAtChartDatum: minimumTideHeight > 0 };
  }

  function secondaryPortTide(referenceEvent, correction) {
    const time = new Date(referenceEvent.timeIso);
    if (Number.isNaN(time.getTime())) throw new RangeError("invalid reference event time");
    const correctedTime = new Date(time.getTime() + Number(correction.timeMinutes || 0) * 60000);
    const correctedHeight = Number(referenceEvent.height) * Number(correction.heightRatio ?? 1) + Number(correction.heightAddition || 0);
    return { timeIso: correctedTime.toISOString(), height: correctedHeight };
  }

  function interpolateSpringNeapRate(springRate, neapRate, daysAfterSpring, springToNeapDays) {
    const interval = Number(springToNeapDays || 7.38);
    const elapsed = Math.min(interval, Math.max(0, Number(daysAfterSpring)));
    const fraction = (1 - Math.cos(Math.PI * elapsed / interval)) / 2;
    const rate = Number(springRate) + (Number(neapRate) - Number(springRate)) * fraction;
    return { rate, fraction, phase: elapsed === 0 ? "spring" : elapsed === interval ? "neap" : "intermediate" };
  }

  function setAndDriftFromFixes(deadReckoningPosition, observedPosition, hours) {
    const elapsed = Number(hours);
    if (elapsed <= 0) throw new RangeError("hours must be greater than zero");
    const offset = middleLatitudeSailing(
      deadReckoningPosition.lat,
      deadReckoningPosition.lon,
      observedPosition.lat,
      observedPosition.lon
    );
    return { set: offset.course, drift: offset.distanceNm / elapsed, distanceNm: offset.distanceNm, hours: elapsed };
  }

  function correctedSextantAltitude(sextantAltitude, indexErrorMinutes, eyeHeightMeters) {
    const hs = Number(sextantAltitude);
    const indexCorrectionMinutes = -Number(indexErrorMinutes || 0);
    const dipMinutes = -1.76 * Math.sqrt(Math.max(0, Number(eyeHeightMeters || 0)));
    const apparent = hs + (indexCorrectionMinutes + dipMinutes) / 60;
    const refractionMinutes = apparent <= 0 ? 0 : -0.97 / Math.tan(toRad(apparent + 7.31 / (apparent + 4.4)));
    return {
      apparentAltitude: apparent,
      correctedAltitude: apparent + refractionMinutes / 60,
      indexCorrectionMinutes,
      dipMinutes,
      refractionMinutes
    };
  }

  function meridianLatitudeCandidates(observedAltitude, declination) {
    const zenithDistance = 90 - Number(observedAltitude);
    const dec = Number(declination);
    return {
      zenithDistance,
      candidates: [dec + zenithDistance, dec - zenithDistance].filter(value => value >= -90 && value <= 90)
    };
  }

  function celestialIntercept(observedAltitude, computedAltitude, azimuth) {
    const interceptNm = (Number(observedAltitude) - Number(computedAltitude)) * 60;
    return {
      interceptNm,
      distanceNm: Math.abs(interceptNm),
      direction: interceptNm >= 0 ? "toward" : "away",
      azimuth: normalize360(Number(azimuth))
    };
  }

  function celestialFix(assumedPosition, sights) {
    if (!Array.isArray(sights) || sights.length !== 2) throw new RangeError("exactly two sights are required");
    const lines = sights.map(sight => {
      const intercept = celestialIntercept(sight.observedAltitude, sight.computedAltitude, sight.azimuth);
      const shift = vector(intercept.interceptNm, intercept.azimuth);
      return { anchor: shift, direction: vector(1, intercept.azimuth + 90), intercept };
    });
    const determinant = lines[0].direction.east * lines[1].direction.north - lines[0].direction.north * lines[1].direction.east;
    if (Math.abs(determinant) < 1e-8) throw new RangeError("sight azimuths do not provide a reliable intersection");
    const delta = {
      east: lines[1].anchor.east - lines[0].anchor.east,
      north: lines[1].anchor.north - lines[0].anchor.north
    };
    const t = (delta.east * lines[1].direction.north - delta.north * lines[1].direction.east) / determinant;
    const offset = {
      east: lines[0].anchor.east + t * lines[0].direction.east,
      north: lines[0].anchor.north + t * lines[0].direction.north
    };
    const angle = Math.abs(((Number(sights[1].azimuth) - Number(sights[0].azimuth) + 540) % 180) - 90);
    const crossingAngle = 90 - angle;
    const meanLat = toRad(Number(assumedPosition.lat));
    return {
      lat: Number(assumedPosition.lat) + offset.north / 60,
      lon: Number(assumedPosition.lon) + offset.east / (60 * Math.cos(meanLat)),
      offsetEastNm: offset.east,
      offsetNorthNm: offset.north,
      crossingAngle,
      reliable: crossingAngle >= 30,
      intercepts: lines.map(line => line.intercept)
    };
  }

  function distanceByVerticalAngle(objectHeightMeters, verticalAngleDegrees, observerHeightMeters) {
    const effectiveHeight = Number(objectHeightMeters) - Number(observerHeightMeters || 0);
    const angle = Number(verticalAngleDegrees);
    if (effectiveHeight <= 0) throw new RangeError("object height must exceed observer height");
    if (angle <= 0 || angle >= 90) throw new RangeError("vertical angle must be between 0 and 90 degrees");
    const distanceMeters = effectiveHeight / Math.tan(toRad(angle));
    return { distanceMeters, distanceNm: distanceMeters / 1852 };
  }

  function interpolateCompassDeviation(table, heading) {
    if (!Array.isArray(table) || table.length < 2) throw new RangeError("at least two deviation entries are required");
    const entries = table.map(entry => ({ heading: normalize360(Number(entry.heading)), deviation: Number(entry.deviation) }))
      .sort((a, b) => a.heading - b.heading);
    const target = normalize360(Number(heading));
    let upperIndex = entries.findIndex(entry => entry.heading >= target);
    if (upperIndex < 0) upperIndex = 0;
    const upper = entries[upperIndex];
    const lower = entries[(upperIndex - 1 + entries.length) % entries.length];
    const upperHeading = upper.heading <= lower.heading ? upper.heading + 360 : upper.heading;
    const targetHeading = target < lower.heading ? target + 360 : target;
    const fraction = (targetHeading - lower.heading) / (upperHeading - lower.heading);
    return lower.deviation + (upper.deviation - lower.deviation) * fraction;
  }

  function timeDifferenceToLongitude(seconds, direction) {
    const degrees = Math.abs(Number(seconds)) / 240;
    const sign = /^(w|west|batı|bati)$/i.test(String(direction || "")) ? -1 : 1;
    return sign * degrees;
  }

  function radarRelativeMotion(firstRange, firstBearing, secondRange, secondBearing, intervalMinutes) {
    const first = vector(Number(firstRange), Number(firstBearing));
    const second = vector(Number(secondRange), Number(secondBearing));
    const hours = Number(intervalMinutes) / 60;
    if (hours <= 0) throw new RangeError("intervalMinutes must be greater than zero");
    const relativeVelocity = { east: (second.east - first.east) / hours, north: (second.north - first.north) / hours };
    const polar = vectorToPolar(relativeVelocity.east, relativeVelocity.north);
    const velocitySquared = relativeVelocity.east ** 2 + relativeVelocity.north ** 2;
    const tcpaHours = velocitySquared < 1e-12 ? Infinity : -(second.east * relativeVelocity.east + second.north * relativeVelocity.north) / velocitySquared;
    const closestEast = second.east + relativeVelocity.east * Math.max(0, tcpaHours);
    const closestNorth = second.north + relativeVelocity.north * Math.max(0, tcpaHours);
    return { relativeCourse: polar.direction, relativeSpeed: polar.speed, cpaNm: Math.hypot(closestEast, closestNorth), tcpaHours, past: tcpaHours < 0 };
  }

  function trialManeuver(own, target, proposedCourse, proposedSpeed) {
    return cpaTcpa({ ...own, course: proposedCourse, speed: proposedSpeed }, target);
  }

  function planeSailing(deltaLatitudeNm, departureNm) {
    const north = Number(deltaLatitudeNm);
    const east = Number(departureNm);
    const polar = vectorToPolar(east, north);
    return { distanceNm: polar.speed, course: polar.direction };
  }

  function middleLatitudeSailing(lat1, lon1, lat2, lon2) {
    const deltaLatitudeNm = (Number(lat2) - Number(lat1)) * 60;
    let deltaLongitude = Number(lon2) - Number(lon1);
    if (Math.abs(deltaLongitude) > 180) deltaLongitude += deltaLongitude > 0 ? -360 : 360;
    const middleLatitude = toRad((Number(lat1) + Number(lat2)) / 2);
    const departureNm = deltaLongitude * 60 * Math.cos(middleLatitude);
    return { ...planeSailing(deltaLatitudeNm, departureNm), deltaLatitudeNm, departureNm };
  }

  function bearingFix(first, second) {
    const referenceLat = (Number(first.lat) + Number(second.lat)) / 2;
    const cosLat = Math.cos(toRad(referenceLat));
    const point = mark => ({
      east: Number(mark.lon) * 60 * cosLat,
      north: Number(mark.lat) * 60
    });
    const a = point(first);
    const b = point(second);
    // A bearing is observed from the vessel towards the mark, therefore the
    // position line extending from the mark uses the reciprocal bearing.
    const da = vector(1, Number(first.bearing) + 180);
    const db = vector(1, Number(second.bearing) + 180);
    const determinant = da.east * db.north - da.north * db.east;
    if (Math.abs(determinant) < 1e-8) throw new RangeError("bearings do not provide a reliable intersection");
    const delta = { east: b.east - a.east, north: b.north - a.north };
    const t = (delta.east * db.north - delta.north * db.east) / determinant;
    const east = a.east + t * da.east;
    const north = a.north + t * da.north;
    const crossingAngle = Math.abs(((Number(second.bearing) - Number(first.bearing) + 540) % 180) - 90);
    return {
      lat: north / 60,
      lon: east / (60 * cosLat),
      crossingAngle: 90 - crossingAngle,
      reliable: 90 - crossingAngle >= 30
    };
  }

  function runningFix(firstMark, firstBearing, secondMark, secondBearing, course, speedKnots, hours) {
    const run = vector(distanceRun(speedKnots, hours), course);
    const referenceLat = (Number(firstMark.lat) + Number(secondMark.lat)) / 2;
    const advancedFirstMark = {
      lat: Number(firstMark.lat) + run.north / 60,
      lon: Number(firstMark.lon) + run.east / (60 * Math.cos(toRad(referenceLat))),
      bearing: Number(firstBearing)
    };
    const result = bearingFix(advancedFirstMark, { ...secondMark, bearing: Number(secondBearing) });
    return { ...result, runNm: distanceRun(speedKnots, hours), advancedLopBy: run };
  }

  function estimatedPosition(start, course, speedKnots, hours, currentSet, currentDrift) {
    const ship = vector(speedKnots, course);
    const current = vector(currentDrift || 0, currentSet || 0);
    const ground = vectorToPolar(ship.east + current.east, ship.north + current.north);
    const position = rhumbDestination(start.lat, start.lon, ground.direction, ground.speed * Number(hours));
    return { ...position, courseMadeGood: ground.direction, speedMadeGood: ground.speed, distanceNm: ground.speed * Number(hours) };
  }

  function driftedDatum(start, hours, currentSet, currentDrift, leewaySet, leewayDrift) {
    const current = vector(currentDrift || 0, currentSet || 0);
    const leeway = vector(leewayDrift || 0, leewaySet || 0);
    const result = vectorToPolar(current.east + leeway.east, current.north + leeway.north);
    const distanceNm = result.speed * Number(hours);
    const position = rhumbDestination(start.lat, start.lon, result.direction, distanceNm);
    return { ...position, set: result.direction, drift: result.speed, distanceNm };
  }

  function movingTargetIntercept(ownPosition, ownSpeedKnots, target) {
    const meanLat = toRad((Number(ownPosition.lat) + Number(target.lat)) / 2);
    const relative = {
      east: (Number(target.lon) - Number(ownPosition.lon)) * 60 * Math.cos(meanLat),
      north: (Number(target.lat) - Number(ownPosition.lat)) * 60
    };
    const targetVelocity = vector(target.speed, target.course);
    const ownSpeed = Number(ownSpeedKnots);
    if (ownSpeed <= 0) throw new RangeError("own speed must be greater than zero");
    const a = targetVelocity.east ** 2 + targetVelocity.north ** 2 - ownSpeed ** 2;
    const b = 2 * (relative.east * targetVelocity.east + relative.north * targetVelocity.north);
    const c = relative.east ** 2 + relative.north ** 2;
    let roots;
    if (Math.abs(a) < 1e-12) roots = Math.abs(b) < 1e-12 ? [] : [-c / b];
    else {
      const discriminant = b ** 2 - 4 * a * c;
      if (discriminant < 0) roots = [];
      else roots = [(-b - Math.sqrt(discriminant)) / (2 * a), (-b + Math.sqrt(discriminant)) / (2 * a)];
    }
    const interceptHours = roots.filter(value => value >= 0).sort((x, y) => x - y)[0];
    if (interceptHours == null) return { possible: false };
    const interceptVector = {
      east: relative.east + targetVelocity.east * interceptHours,
      north: relative.north + targetVelocity.north * interceptHours
    };
    const polar = vectorToPolar(interceptVector.east, interceptVector.north);
    const position = rhumbDestination(ownPosition.lat, ownPosition.lon, polar.direction, polar.speed);
    return { possible: true, interceptHours, course: polar.direction, distanceNm: polar.speed, position };
  }

  function expandingSquarePattern(center, initialCourse, spacingNm, legCount) {
    const count = Math.max(0, Math.floor(Number(legCount)));
    const spacing = Number(spacingNm);
    if (spacing <= 0) throw new RangeError("spacing must be greater than zero");
    const waypoints = [{ ...center, leg: 0 }];
    let position = { lat: Number(center.lat), lon: Number(center.lon) };
    for (let leg = 1; leg <= count; leg += 1) {
      const course = normalize360(Number(initialCourse) + (leg - 1) * 90);
      const distanceNm = spacing * Math.ceil(leg / 2);
      position = rhumbDestination(position.lat, position.lon, course, distanceNm);
      waypoints.push({ ...position, leg, course, distanceNm });
    }
    return waypoints;
  }

  function searchDatumUncertainty(initialPositionErrorNm, driftSpeedErrorKnots, hours, searchObjectErrorNm) {
    const driftErrorNm = Math.abs(Number(driftSpeedErrorKnots)) * Number(hours);
    const radiusNm = Math.hypot(Number(initialPositionErrorNm), driftErrorNm, Number(searchObjectErrorNm || 0));
    return { radiusNm, driftErrorNm };
  }

  function positionUncertainty(initialErrorNm, speedErrorKnots, courseErrorDegrees, speedKnots, hours) {
    const runNm = distanceRun(speedKnots, hours);
    const alongTrackErrorNm = Math.abs(Number(speedErrorKnots)) * Number(hours);
    const crossTrackErrorNm = runNm * Math.sin(toRad(Math.abs(Number(courseErrorDegrees))));
    const radiusNm = Math.hypot(Number(initialErrorNm), alongTrackErrorNm, crossTrackErrorNm);
    return { radiusNm, alongTrackErrorNm, crossTrackErrorNm, runNm };
  }

  function traverse(legs) {
    const total = legs.reduce((sum, leg) => {
      const component = vector(Number(leg.distanceNm), Number(leg.course));
      sum.east += component.east;
      sum.north += component.north;
      sum.runNm += Number(leg.distanceNm);
      return sum;
    }, { east: 0, north: 0, runNm: 0 });
    const result = vectorToPolar(total.east, total.north);
    return { ...total, distanceMadeGoodNm: result.speed, courseMadeGood: result.direction };
  }

  function applyLeeway(desiredTrack, leewayDegrees, windSide) {
    const side = normalizeText(windSide);
    const correction = /^(starboard|sancak)$/.test(side) ? Number(leewayDegrees) : -Number(leewayDegrees);
    return normalize360(Number(desiredTrack) + correction);
  }

  function apparentWind(trueWindSpeedKnots, trueWindFrom, vesselCourse, vesselSpeedKnots) {
    const trueFlow = vector(trueWindSpeedKnots, Number(trueWindFrom) + 180);
    const vessel = vector(vesselSpeedKnots, vesselCourse);
    const apparentFlow = vectorToPolar(trueFlow.east - vessel.east, trueFlow.north - vessel.north);
    return {
      speedKnots: apparentFlow.speed,
      from: normalize360(apparentFlow.direction + 180),
      relativeFrom: normalize360(apparentFlow.direction + 180 - Number(vesselCourse))
    };
  }

  function trueWindFromApparent(apparentWindSpeedKnots, apparentWindFrom, vesselCourse, vesselSpeedKnots) {
    const apparentFlow = vector(apparentWindSpeedKnots, Number(apparentWindFrom) + 180);
    const vessel = vector(vesselSpeedKnots, vesselCourse);
    const trueFlow = vectorToPolar(apparentFlow.east + vessel.east, apparentFlow.north + vessel.north);
    return { speedKnots: trueFlow.speed, from: normalize360(trueFlow.direction + 180) };
  }

  function beaufortForce(windSpeedKnots) {
    const speed = Math.max(0, Number(windSpeedKnots));
    const upperLimits = [1, 3, 6, 10, 16, 21, 27, 33, 40, 47, 55, 63];
    const force = upperLimits.findIndex(limit => speed < limit);
    return force < 0 ? 12 : force;
  }

  function waveEncounterPeriod(wavePeriodSeconds, waveFrom, vesselCourse, vesselSpeedKnots, wavelengthMeters) {
    const period = Number(wavePeriodSeconds);
    if (period <= 0) throw new RangeError("wave period must be greater than zero");
    const wavelength = wavelengthMeters == null ? 9.80665 * period ** 2 / (2 * Math.PI) : Number(wavelengthMeters);
    if (wavelength <= 0) throw new RangeError("wavelength must be greater than zero");
    const waveToward = normalize360(Number(waveFrom) + 180);
    const relativeAngle = toRad(Number(vesselCourse) - waveToward);
    const vesselMetersPerSecond = Number(vesselSpeedKnots) * 0.514444;
    const encounterFrequencyHz = Math.abs(1 / period - vesselMetersPerSecond * Math.cos(relativeAngle) / wavelength);
    return {
      wavelengthMeters: wavelength,
      encounterFrequencyHz,
      encounterPeriodSeconds: encounterFrequencyHz < 1e-12 ? Infinity : 1 / encounterFrequencyHz
    };
  }

  function turnGeometry(speedKnots, rateOfTurnDegPerMinute, courseChangeDegrees) {
    const omega = toRad(Math.abs(Number(rateOfTurnDegPerMinute)));
    if (omega <= 0) throw new RangeError("rate of turn must be greater than zero");
    const radiusNm = (Number(speedKnots) / 60) / omega;
    const wheelOverDistanceNm = radiusNm * Math.tan(toRad(Math.abs(Number(courseChangeDegrees))) / 2);
    const turnMinutes = Math.abs(Number(courseChangeDegrees)) / Math.abs(Number(rateOfTurnDegPerMinute));
    return { radiusNm, wheelOverDistanceNm, turnMinutes };
  }

  function turnAdvanceTransfer(radiusNm, courseChangeDegrees) {
    const radius = Number(radiusNm);
    const change = toRad(Math.abs(Number(courseChangeDegrees)));
    if (radius <= 0) throw new RangeError("turn radius must be greater than zero");
    return {
      advanceNm: radius * Math.sin(change),
      transferNm: radius * (1 - Math.cos(change)),
      arcDistanceNm: radius * change
    };
  }

  function stoppingPerformance(speedKnots, decelerationMetersPerSecondSquared, reactionSeconds) {
    const speedMps = Number(speedKnots) * 0.514444;
    const deceleration = Number(decelerationMetersPerSecondSquared);
    const reaction = Number(reactionSeconds || 0);
    if (speedMps < 0 || deceleration <= 0 || reaction < 0) throw new RangeError("speed, deceleration, and reaction time must be valid");
    const reactionDistanceMeters = speedMps * reaction;
    const brakingDistanceMeters = speedMps ** 2 / (2 * deceleration);
    const brakingSeconds = speedMps / deceleration;
    return {
      stoppingSeconds: reaction + brakingSeconds,
      stoppingDistanceMeters: reactionDistanceMeters + brakingDistanceMeters,
      stoppingDistanceNm: (reactionDistanceMeters + brakingDistanceMeters) / 1852,
      reactionDistanceMeters,
      brakingDistanceMeters
    };
  }

  function anchorScope(waterDepthMeters, tideHeightMeters, bowHeightMeters, scopeRatio, vesselLengthMeters) {
    const verticalDistanceMeters = Number(waterDepthMeters) + Number(tideHeightMeters || 0) + Number(bowHeightMeters || 0);
    const ratio = Number(scopeRatio);
    if (verticalDistanceMeters <= 0 || ratio < 1) throw new RangeError("depth and scope ratio must be valid");
    const cableLengthMeters = verticalDistanceMeters * ratio;
    return {
      verticalDistanceMeters,
      cableLengthMeters,
      cableLengthShackles: cableLengthMeters / 27.5,
      swingRadiusMeters: cableLengthMeters + Number(vesselLengthMeters || 0)
    };
  }

  function anchorSwingBounds(anchorPosition, swingRadiusMeters) {
    const radiusNm = Number(swingRadiusMeters) / 1852;
    if (radiusNm < 0) throw new RangeError("swing radius cannot be negative");
    const north = rhumbDestination(anchorPosition.lat, anchorPosition.lon, 0, radiusNm);
    const east = rhumbDestination(anchorPosition.lat, anchorPosition.lon, 90, radiusNm);
    const south = rhumbDestination(anchorPosition.lat, anchorPosition.lon, 180, radiusNm);
    const west = rhumbDestination(anchorPosition.lat, anchorPosition.lon, 270, radiusNm);
    return { radiusNm, north: north.lat, east: east.lon, south: south.lat, west: west.lon };
  }

  function barrassSquat(speedKnots, blockCoefficient, confinedWater) {
    const factor = confinedWater ? 2 : 1;
    return factor * Number(blockCoefficient) * Number(speedKnots) ** 2 / 100;
  }

  function maximumSpeedForSquat(maximumSquatMeters, blockCoefficient, confinedWater) {
    const factor = confinedWater ? 2 : 1;
    const coefficient = factor * Number(blockCoefficient);
    if (Number(maximumSquatMeters) < 0 || coefficient <= 0) throw new RangeError("squat allowance and block coefficient must be valid");
    return Math.sqrt(Number(maximumSquatMeters) * 100 / coefficient);
  }

  function etaFromDeparture(departureIso, distanceNm, speedKnots, delaysHours) {
    const passageHours = speedDistanceTime({ distanceNm, speedKnots }).hours + Number(delaysHours || 0);
    const eta = new Date(new Date(departureIso).getTime() + passageHours * 3600000);
    if (Number.isNaN(eta.getTime())) throw new RangeError("invalid departure time");
    return { passageHours, etaIso: eta.toISOString() };
  }

  function requiredSpeedProfile(distanceNm, availableHours, minimumSpeed, maximumSpeed) {
    const requiredSpeed = Number(distanceNm) / Number(availableHours);
    const feasible = requiredSpeed >= Number(minimumSpeed) && requiredSpeed <= Number(maximumSpeed);
    return { requiredSpeed, feasible, belowMinimum: requiredSpeed < Number(minimumSpeed), aboveMaximum: requiredSpeed > Number(maximumSpeed) };
  }

  function rankCollisionRisks(own, targets, limits) {
    const cpaLimit = Number(limits?.cpaNm ?? 1);
    const tcpaLimit = Number(limits?.tcpaHours ?? 1);
    return targets.map(target => {
      const result = cpaTcpa(own, target);
      const future = !result.past && Number.isFinite(result.tcpaHours);
      const severity = future && result.tcpaHours <= tcpaLimit && result.cpaNm <= cpaLimit
        ? "danger"
        : future && result.tcpaHours <= tcpaLimit * 2 && result.cpaNm <= cpaLimit * 2 ? "caution" : "monitor";
      const score = future ? 1 / Math.max(0.05, result.cpaNm) * 1 / Math.max(0.05, result.tcpaHours) : 0;
      return { id: target.id, ...result, severity, score };
    }).sort((a, b) => b.score - a.score);
  }

  function routeSummary(waypoints, speedKnots, consumptionPerHour, reservePercent) {
    const legs = [];
    let totalDistanceNm = 0;
    for (let index = 1; index < waypoints.length; index += 1) {
      const from = waypoints[index - 1];
      const to = waypoints[index];
      const inverse = rhumbInverse(from.lat, from.lon, to.lat, to.lon);
      totalDistanceNm += inverse.distanceNm;
      legs.push({ from: from.name || index, to: to.name || index + 1, ...inverse });
    }
    const fuel = passageFuel(totalDistanceNm, speedKnots, consumptionPerHour, reservePercent);
    return { legs, totalDistanceNm, hours: fuel.hours, baseFuel: fuel.baseFuel, totalFuel: fuel.totalFuel };
  }

  function waypointTurnPlan(previous, waypoint, next, speedKnots, rateOfTurnDegPerMinute) {
    const inbound = rhumbInverse(previous.lat, previous.lon, waypoint.lat, waypoint.lon).course;
    const outbound = rhumbInverse(waypoint.lat, waypoint.lon, next.lat, next.lon).course;
    const signedChange = ((outbound - inbound + 540) % 360) - 180;
    const geometry = turnGeometry(speedKnots, rateOfTurnDegPerMinute, signedChange);
    return { inboundCourse: inbound, outboundCourse: outbound, courseChange: signedChange, turnDirection: signedChange >= 0 ? "starboard" : "port", ...geometry };
  }

  function wheelOverStatus(vessel, waypoint, next, speedKnots, rateOfTurnDegPerMinute, safetyMarginNm) {
    const inbound = rhumbInverse(vessel.lat, vessel.lon, waypoint.lat, waypoint.lon);
    const outbound = rhumbInverse(waypoint.lat, waypoint.lon, next.lat, next.lon).course;
    const signedChange = ((outbound - inbound.course + 540) % 360) - 180;
    const geometry = turnGeometry(speedKnots, rateOfTurnDegPerMinute, signedChange);
    const triggerDistanceNm = geometry.wheelOverDistanceNm + Number(safetyMarginNm || 0);
    return {
      distanceToWaypointNm: inbound.distanceNm,
      triggerDistanceNm,
      turnNow: inbound.distanceNm <= triggerDistanceNm,
      courseChange: signedChange,
      turnDirection: signedChange >= 0 ? "starboard" : "port",
      ...geometry
    };
  }

  function parseSpeedDistanceTimeQuestion(question) {
    const text = normalizeText(question);
    let solve = null;
    if (/(?:kaç|kac)\s*(?:saat|dakika)|\b(?:süre|sure|eta)\b/.test(text)) solve = "hours";
    else if (/(?:kaç|kac)\s*(?:knot|kt)|\b(?:gerekli|ortalama)\s*(?:hız|hiz)\b/.test(text)) solve = "speedKnots";
    else if (/(?:kaç|kac)\s*(?:deniz mili|mil|nm)|\bmesafe(?:yi)?\b/.test(text)) solve = "distanceNm";
    if (!solve) return null;

    const distanceMatch = text.match(/(\d+(?:\.\d+)?)\s*(?:deniz mil(?:i|ini)?|nm)\b/);
    const speedMatch = text.match(/(\d+(?:\.\d+)?)\s*(?:knot|knots|kt|kts|kn)\b/);
    const hourMatch = text.match(/(\d+(?:\.\d+)?)\s*(?:saat(?:te)?|hour|hours)\b/);
    const minuteMatch = text.match(/(\d+(?:\.\d+)?)\s*(?:dakika|minute|minutes|min)\b/);
    const parsed = {
      solve,
      distanceNm: distanceMatch ? Number(distanceMatch[1]) : null,
      speedKnots: speedMatch ? Number(speedMatch[1]) : null,
      hours: Number(hourMatch?.[1] || 0) + Number(minuteMatch?.[1] || 0) / 60
    };
    if (!parsed.hours) parsed.hours = null;
    parsed[solve] = null;
    return parsed;
  }

  function parseUkcQuestion(question) {
    const text = normalizeText(question);
    if (!/\b(ukc|under keel|omurga altı|omurga alti|karina altı|karina alti|minimum gelgit|gerekli gelgit)\b/.test(text)) return null;
    return {
      mode: /minimum gelgit|gerekli gelgit|minimum tide|required tide/.test(text) ? "minimumTide" : "clearance",
      chartedDepth: labelledNumber(text, "harita derinliği|harita derinligi|charted depth|derinlik", "metre|meter|meters|m"),
      tideHeight: labelledNumber(text, "gelgit yüksekliği|gelgit yuksekligi|gelgit|tide height|tide", "metre|meter|meters|m"),
      draft: labelledNumber(text, "su çekimi|su cekimi|draft", "metre|meter|meters|m"),
      squat: labelledNumber(text, "squat|çökme|cokme", "metre|meter|meters|m") ?? 0,
      safetyMargin: labelledNumber(text, "emniyet payı|emniyet payi|güvenlik payı|guvenlik payi|safety margin", "metre|meter|meters|m") ?? 0
    };
  }

  function parseFuelQuestion(question) {
    const text = normalizeText(question);
    if (!/\b(yakıt|yakit|fuel)\b/.test(text)) return null;
    const distance = text.match(/(\d+(?:\.\d+)?)\s*(?:deniz mili|nm)\b/);
    const speed = text.match(/(\d+(?:\.\d+)?)\s*(?:knot|knots|kt|kts|kn)\b/);
    const reserve = text.match(/(?:rezerv|reserve)\s*(?:yüzde|yuzde|%)?\s*(\d+(?:\.\d+)?)/);
    return {
      distanceNm: distance ? Number(distance[1]) : null,
      speedKnots: speed ? Number(speed[1]) : null,
      consumptionPerHour: labelledNumber(text, "saatlik tüketim|saatlik tuketim|tüketim|tuketim|consumption", "litre|liter|litres|liters|l(?:\\/h)?"),
      reservePercent: reserve ? Number(reserve[1]) : 0
    };
  }

  function parseBeaufortQuestion(question) {
    const text = normalizeText(question);
    if (!/\b(beaufort|bofor)\b/.test(text)) return null;
    const speed = text.match(/(\d+(?:\.\d+)?)\s*(?:knot|knots|kt|kts|kn)\b/);
    return { windSpeedKnots: speed ? Number(speed[1]) : null };
  }

  function parseCompassQuestion(question) {
    const text = normalizeText(question);
    if (!/\b(pusula|compass|hakiki rota|true course)\b/.test(text)) return null;
    const asksCompass = /(?:pusula(?: rotas\u0131| rotasi)?|compass(?: course)?)\s+(?:nedir|ne|hesapla|calculate)\b/.test(text);
    const trueMode = !asksCompass && /hakiki rota|true course|hakikiye|true'ya|trueya/.test(text);
    return {
      mode: trueMode ? "toTrue" : "toCompass",
      course: labelledNumber(text, trueMode ? "pusula rotas\u0131|pusula rotasi|compass course|rota" : "hakiki rota|true course|rota", "derece|deg|\u00b0"),
      deviation: labelledNumber(text, "deviasyon|deviation", "derece|deg|\u00b0") ?? 0,
      variation: labelledNumber(text, "varyasyon|variation", "derece|deg|\u00b0") ?? 0
    };
  }

  function parseEtaQuestion(question) {
    const text = normalizeText(question);
    if (!/\b(eta|tahmini var\u0131\u015f|tahmini varis|arrival time)\b/.test(text)) return null;
    const isoMatch = String(question).match(/\b(\d{4}-\d{2}-\d{2}[T ]\d{2}:\d{2}(?::\d{2})?(?:Z|[+-]\d{2}:?\d{2})?)\b/i);
    return {
      departureIso: isoMatch ? isoMatch[1].replace(" ", "T") : null,
      distanceNm: labelledNumber(text, "mesafe|distance", "deniz mili|nautical miles|nm"),
      speedKnots: labelledNumber(text, "h\u0131z|hiz|speed", "knot|knots|kn"),
      delaysHours: labelledNumber(text, "gecikme|bekleme|delay", "saat|hours|hour|h") ?? 0
    };
  }

  function parseCpaQuestion(question) {
    const text = normalizeText(question);
    if (!/\b(cpa|tcpa|en yak\u0131n yakla\u015fma|en yakin yaklasma)\b/.test(text)) return null;
    const parts = text.split(/\b(?:hedef|target)\b/);
    if (parts.length < 2) return { own: null, target: null };
    const vessel = section => ({
      lat: labelledNumber(section, "enlem|latitude|lat", "derece|deg|\u00b0"),
      lon: labelledNumber(section, "boylam|longitude|lon", "derece|deg|\u00b0"),
      course: labelledNumber(section, "rota|course", "derece|deg|\u00b0"),
      speed: labelledNumber(section, "h\u0131z|hiz|speed", "knot|knots|kn")
    });
    return { own: vessel(parts[0]), target: vessel(parts.slice(1).join(" ")) };
  }

  function parseSquatQuestion(question) {
    const text = normalizeText(question);
    if (!/\b(squat|\u00e7\u00f6kme|cokme)\b/.test(text)) return null;
    if (/\b(ukc|under keel|minimum gelgit|minimum tide)\b/.test(text)) return null;
    const maximumMode = /maksimum h\u0131z|maksimum hiz|azami h\u0131z|azami hiz|maximum speed/.test(text);
    return {
      mode: maximumMode ? "maximumSpeed" : "squat",
      speedKnots: labelledNumber(text, "h\u0131z|hiz|speed", "knot|knots|kn"),
      blockCoefficient: labelledNumber(text, "blok katsay\u0131s\u0131|blok katsayisi|block coefficient|cb", ""),
      maximumSquatMeters: labelledNumber(text, "izin verilen squat|squat s\u0131n\u0131r\u0131|squat siniri|maximum squat", "metre|meter|meters|m"),
      confinedWater: /dar su|s\u0131\u011f su|sig su|confined water|shallow water/.test(text)
    };
  }

  function parseAnchorQuestion(question) {
    const text = normalizeText(question);
    if (!/\b(demir|demirleme|kaloma|anchor|scope)\b/.test(text)) return null;
    return {
      waterDepthMeters: labelledNumber(text, "su derinli\u011fi|su derinligi|water depth|derinlik", "metre|meter|meters|m"),
      tideHeightMeters: labelledNumber(text, "gelgit y\u00fcksekli\u011fi|gelgit yuksekligi|gelgit|tide height", "metre|meter|meters|m") ?? 0,
      bowHeightMeters: labelledNumber(text, "ba\u015f y\u00fcksekli\u011fi|bas yuksekligi|bow height", "metre|meter|meters|m") ?? 0,
      scopeRatio: labelledNumber(text, "kaloma oran\u0131|kaloma orani|scope ratio|oran", "") ,
      vesselLengthMeters: labelledNumber(text, "gemi boyu|tekne boyu|vessel length|loa", "metre|meter|meters|m") ?? 0
    };
  }

  function parseStoppingQuestion(question) {
    const text = normalizeText(question);
    if (!/\b(durma mesafesi|duru\u015f mesafesi|durus mesafesi|stopping distance|stop distance)\b/.test(text)) return null;
    return {
      speedKnots: labelledNumber(text, "h\u0131z|hiz|speed", "knot|knots|kn"),
      deceleration: labelledNumber(text, "yava\u015flama|yavaslama|deceleration", "m\/s2|m\/s\u00b2|metre\/saniye kare"),
      reactionSeconds: labelledNumber(text, "reaksiyon|reaction", "saniye|seconds|second|sn|s") ?? 0
    };
  }

  function parseTurnQuestion(question) {
    const text = normalizeText(question);
    if (!/\b(wheel[ -]?over|d\u00f6n\u00fc\u015f yar\u0131\u00e7ap\u0131|donus yaricapi|d\u00f6n\u00fc\u015f geometrisi|donus geometrisi|rate of turn)\b/.test(text)) return null;
    return {
      speedKnots: labelledNumber(text, "h\u0131z|hiz|speed", "knot|knots|kn"),
      rateOfTurn: labelledNumber(text, "d\u00f6n\u00fc\u015f oran\u0131|donus orani|rate of turn|rot", "derece\/dakika|deg\/min|\u00b0\/min"),
      courseChange: labelledNumber(text, "rota de\u011fi\u015fimi|rota degisimi|course change|d\u00f6n\u00fc\u015f a\u00e7\u0131s\u0131|donus acisi", "derece|deg|\u00b0")
    };
  }

  function parseGeographicRangeQuestion(question) {
    const text = normalizeText(question);
    if (!/\b(co\u011frafi menzil|cografi menzil|ufuk mesafesi|g\u00f6r\u00fc\u015f mesafesi|gorus mesafesi|geographic range|horizon distance)\b/.test(text)) return null;
    return {
      eyeHeightMeters: labelledNumber(text, "g\u00f6z y\u00fcksekli\u011fi|goz yuksekligi|eye height|g\u00f6z", "metre|meter|meters|m"),
      objectHeightMeters: labelledNumber(text, "fener y\u00fcksekli\u011fi|fener yuksekligi|cisim y\u00fcksekli\u011fi|cisim yuksekligi|object height|light height", "metre|meter|meters|m")
    };
  }

  function parseVariationQuestion(question) {
    const text = normalizeText(question);
    if (!/\b(varyasyon|variation|manyetik de\u011fi\u015fim|manyetik degisim)\b/.test(text) || !/\b(y\u0131ll\u0131k|yillik|annual|g\u00fcncelle|guncelle)\b/.test(text)) return null;
    const targetYear = labelledNumber(text, "hedef y\u0131l|hedef yil|target year", "") || Number(text.match(/\b20\d{2}\b/g)?.at(-1));
    return {
      chartVariation: labelledNumber(text, "harita varyasyonu|chart variation|varyasyon", "derece|deg|\u00b0"),
      annualChangeMinutes: labelledNumber(text, "y\u0131ll\u0131k de\u011fi\u015fim|yillik degisim|annual change", "dakika|minutes|min|'"),
      chartYear: labelledNumber(text, "harita y\u0131l\u0131|harita yili|chart year", ""),
      targetYear
    };
  }

  function parseRadarRelativeQuestion(question) {
    const text = normalizeText(question);
    if (!/\b(radar nispi|radar ba\u011f\u0131l|radar bagil|relative motion)\b/.test(text)) return null;
    return {
      firstRange: labelledNumber(text, "ilk menzil|birinci menzil|first range", "deniz mili|nm"),
      firstBearing: labelledNumber(text, "ilk kerteriz|birinci kerteriz|first bearing", "derece|deg|\u00b0"),
      secondRange: labelledNumber(text, "ikinci menzil|son menzil|second range", "deniz mili|nm"),
      secondBearing: labelledNumber(text, "ikinci kerteriz|son kerteriz|second bearing", "derece|deg|\u00b0"),
      intervalMinutes: labelledNumber(text, "aral\u0131k|aralik|interval", "dakika|minutes|min")
    };
  }

  function parseTwelfthsQuestion(question) {
    const text = normalizeText(question);
    if (!/(?:12'?ler kural\u0131|12ler kurali|on ikiler kural\u0131|on ikiler kurali|rule of twelfths)/.test(text)) return null;
    return {
      lowWater: labelledNumber(text, "al\u00e7ak su|alcak su|low water|lw", "metre|meter|meters|m"),
      highWater: labelledNumber(text, "y\u00fcksek su|yuksek su|high water|hw", "metre|meter|meters|m"),
      hoursSinceLow: labelledNumber(text, "al\u00e7ak sudan sonra|alcak sudan sonra|ge\u00e7en s\u00fcre|gecen sure|hours since low", "saat|hours|hour|h"),
      durationHours: labelledNumber(text, "gelgit s\u00fcresi|gelgit suresi|duration", "saat|hours|hour|h") ?? 6
    };
  }

  function parseSecondaryPortQuestion(question) {
    const text = normalizeText(question);
    if (!/\b(tali liman|ikincil liman|secondary port)\b/.test(text)) return null;
    const isoMatch = String(question).match(/\b(\d{4}-\d{2}-\d{2}[T ]\d{2}:\d{2}(?::\d{2})?(?:Z|[+-]\d{2}:?\d{2})?)\b/i);
    return {
      referenceTimeIso: isoMatch ? isoMatch[1].replace(" ", "T") : null,
      referenceHeight: labelledNumber(text, "referans y\u00fcksekli\u011fi|referans yuksekligi|reference height|y\u00fckseklik|yukseklik", "metre|meter|meters|m"),
      timeMinutes: labelledNumber(text, "zaman d\u00fczeltmesi|zaman duzeltmesi|time correction", "dakika|minutes|min") ?? 0,
      heightRatio: labelledNumber(text, "y\u00fckseklik oran\u0131|yukseklik orani|height ratio|oran", "") ?? 1,
      heightAddition: labelledNumber(text, "y\u00fckseklik ilavesi|yukseklik ilavesi|height addition|ilave", "metre|meter|meters|m") ?? 0
    };
  }

  function parseSextantCorrectionQuestion(question) {
    const text = normalizeText(question);
    if (!/(?:sekstant|sextant).*(?:d\u00fczelt|duzelt|correction|corrected altitude)/.test(text)) return null;
    return {
      sextantAltitude: labelledNumber(text, "sekstant irtifas\u0131|sekstant irtifasi|sextant altitude|hs|irtifa", "derece|deg|\u00b0"),
      indexErrorMinutes: labelledNumber(text, "indeks hatas\u0131|indeks hatasi|index error", "dakika|minutes|min|'" ) ?? 0,
      eyeHeightMeters: labelledNumber(text, "g\u00f6z y\u00fcksekli\u011fi|goz yuksekligi|eye height", "metre|meter|meters|m") ?? 0
    };
  }

  function parseMeridianLatitudeQuestion(question) {
    const text = normalizeText(question);
    if (!/(?:meridyen|meridian).*(?:enlem|latitude)/.test(text)) return null;
    return {
      observedAltitude: labelledNumber(text, "g\u00f6zlenen irtifa|gozlenen irtifa|observed altitude|ho|irtifa", "derece|deg|\u00b0"),
      declination: labelledNumber(text, "deklinasyon|declination|dec", "derece|deg|\u00b0")
    };
  }

  function parseCelestialInterceptQuestion(question) {
    const text = normalizeText(question);
    if (!/(?:intercept|\u0131ntercept|irtifa fark\u0131|irtifa farki)/.test(text) || !/(?:azimut|azimuth)/.test(text)) return null;
    return {
      observedAltitude: labelledNumber(text, "g\u00f6zlenen irtifa|gozlenen irtifa|observed altitude|ho", "derece|deg|\u00b0"),
      computedAltitude: labelledNumber(text, "hesaplanan irtifa|computed altitude|hc", "derece|deg|\u00b0"),
      azimuth: labelledNumber(text, "azimut|azimuth|zn", "derece|deg|\u00b0")
    };
  }

  function parseVerticalAngleDistanceQuestion(question) {
    const text = normalizeText(question);
    if (!/(?:dikey a\u00e7\u0131|dikey aci|vertical angle).*(?:mesafe|distance)/.test(text)) return null;
    return {
      objectHeightMeters: labelledNumber(text, "cisim y\u00fcksekli\u011fi|cisim yuksekligi|object height|fener y\u00fcksekli\u011fi|fener yuksekligi", "metre|meter|meters|m"),
      verticalAngleDegrees: labelledNumber(text, "dikey a\u00e7\u0131|dikey aci|vertical angle|a\u00e7\u0131|aci", "derece|deg|\u00b0"),
      observerHeightMeters: labelledNumber(text, "g\u00f6z y\u00fcksekli\u011fi|goz yuksekligi|observer height|eye height", "metre|meter|meters|m") ?? 0
    };
  }

  function parseLongitudeTimeQuestion(question) {
    const text = normalizeText(question);
    if (!/(?:zaman fark\u0131|zaman farki|time difference).*(?:boylam|longitude)/.test(text) && !/(?:boylam|longitude).*(?:zaman fark\u0131|zaman farki|time difference)/.test(text)) return null;
    const direction = /(?:bat\u0131|bati|west)(?:\s|$|[.,;:])/.test(text) ? "west" : /(?:do\u011fu|dogu|east)(?:\s|$|[.,;:])/.test(text) ? "east" : null;
    return {
      seconds: labelledNumber(text, "zaman fark\u0131|zaman farki|time difference|fark", "saniye|seconds|second|sn|s"),
      direction
    };
  }

  function parseBearingConversionQuestion(question) {
    const text = normalizeText(question);
    if (!/(?:nispi kerteriz|relative bearing|hakiki kerteriz|true bearing)/.test(text)) return null;
    const toRelative = /(?:nispi kerteriz|relative bearing)\s+(?:nedir|ne|hesapla|calculate)/.test(text);
    return {
      mode: toRelative ? "toRelative" : "toTrue",
      bearing: labelledNumber(text, toRelative ? "hakiki kerteriz|true bearing|kerteriz" : "nispi kerteriz|relative bearing|kerteriz", "derece|deg|\u00b0"),
      heading: labelledNumber(text, "gemi ba\u015f\u0131|gemi basi|ba\u015f|bas|heading", "derece|deg|\u00b0")
    };
  }

  function parseOceanRouteQuestion(question) {
    const text = normalizeText(question);
    if (!/(?:b\u00fcy\u00fck daire|buyuk daire|great circle).*(?:kerte|rhumb|loxodrom)/.test(text) && !/(?:rota kar\u015f\u0131la\u015ft\u0131r|rota karsilastir|compare routes)/.test(text)) return null;
    return {
      start: {
        lat: labelledNumber(text, "ba\u015flang\u0131\u00e7 enlem|baslangic enlem|start latitude", "derece|deg|\u00b0"),
        lon: labelledNumber(text, "ba\u015flang\u0131\u00e7 boylam|baslangic boylam|start longitude", "derece|deg|\u00b0")
      },
      end: {
        lat: labelledNumber(text, "var\u0131\u015f enlem|varis enlem|biti\u015f enlem|bitis enlem|end latitude", "derece|deg|\u00b0"),
        lon: labelledNumber(text, "var\u0131\u015f boylam|varis boylam|biti\u015f boylam|bitis boylam|end longitude", "derece|deg|\u00b0")
      }
    };
  }

  function parsePlaneSailingQuestion(question) {
    const text = normalizeText(question);
    if (!/(?:d\u00fczlem seyri|duzlem seyri|plane sailing)/.test(text)) return null;
    return {
      deltaLatitudeNm: labelledNumber(text, "enlem fark\u0131|enlem farki|delta latitude|dlat", "deniz mili|nm"),
      departureNm: labelledNumber(text, "departure|do\u011fu bat\u0131 mesafesi|dogu bati mesafesi", "deniz mili|nm")
    };
  }

  function parseMiddleLatitudeQuestion(question) {
    const text = normalizeText(question);
    if (!/(?:orta enlem seyri|middle latitude sailing|mid latitude sailing)/.test(text)) return null;
    return {
      lat1: labelledNumber(text, "ba\u015flang\u0131\u00e7 enlem|baslangic enlem|start latitude", "derece|deg|\u00b0"),
      lon1: labelledNumber(text, "ba\u015flang\u0131\u00e7 boylam|baslangic boylam|start longitude", "derece|deg|\u00b0"),
      lat2: labelledNumber(text, "var\u0131\u015f enlem|varis enlem|end latitude", "derece|deg|\u00b0"),
      lon2: labelledNumber(text, "var\u0131\u015f boylam|varis boylam|end longitude", "derece|deg|\u00b0")
    };
  }

  function parseLeewayQuestion(question) {
    const text = normalizeText(question);
    if (!/(?:r\u00fczg\u00e2r sapmas\u0131|r\u00fczgar sapmas\u0131|ruzgar sapmasi|leeway)/.test(text)) return null;
    const sideMatch = text.match(/(?:r\u00fczg\u00e2r taraf\u0131|r\u00fczgar taraf\u0131|ruzgar tarafi|wind side)\s*(?:is|=|:)?\s*(sancak|iskele|starboard|port)/);
    return {
      desiredTrack: labelledNumber(text, "istenen rota|hedef rota|desired track|desired course", "derece|deg|\u00b0|t"),
      leewayDegrees: labelledNumber(text, "sapma|leeway", "derece|deg|\u00b0"),
      windSide: sideMatch ? sideMatch[1] : null
    };
  }

  function parseWindTriangleQuestion(question) {
    const text = normalizeText(question);
    const apparentMode = /(?:g\u00f6r\u00fcn\u00fcr r\u00fczg\u00e2r|gorunur ruzgar|apparent wind)/.test(text);
    const trueMode = /(?:hakiki r\u00fczg\u00e2r|hakiki ruzgar|true wind)/.test(text);
    if (!apparentMode && !trueMode) return null;
    const wantsTrue = /^(?:hakiki r\u00fczg\u00e2r|hakiki ruzgar|true wind)\s*(?:hesapla|nedir|bul|calculate)/.test(text);
    return {
      mode: wantsTrue ? "toTrue" : "toApparent",
      windSpeed: labelledNumber(text, wantsTrue ? "g\u00f6r\u00fcn\u00fcr r\u00fczg\u00e2r h\u0131z\u0131|gorunur ruzgar hizi|apparent wind speed" : "hakiki r\u00fczg\u00e2r h\u0131z\u0131|hakiki ruzgar hizi|true wind speed", "knot|knots|kt|kts|kn"),
      windFrom: labelledNumber(text, wantsTrue ? "g\u00f6r\u00fcn\u00fcr r\u00fczg\u00e2r y\u00f6n\u00fc|gorunur ruzgar yonu|apparent wind from" : "hakiki r\u00fczg\u00e2r y\u00f6n\u00fc|hakiki ruzgar yonu|true wind from", "derece|deg|\u00b0|t"),
      vesselCourse: labelledNumber(text, "gemi rotas\u0131|gemi rotasi|vessel course|ship course", "derece|deg|\u00b0|t"),
      vesselSpeed: labelledNumber(text, "gemi h\u0131z\u0131|gemi hizi|vessel speed|ship speed", "knot|knots|kt|kts|kn")
    };
  }

  function parseTraverseQuestion(question) {
    const text = normalizeText(question);
    if (!/(?:travers seyri|traverse sailing|\u00e7ok etap|cok etap)/.test(text)) return null;
    const legs = [];
    const pattern = /(?:etap|leg)\s*\d+\s*(?:rota|course)\s*(\d+(?:\.\d+)?)\s*(?:derece|deg|\u00b0|t)?\s*(?:,|;)?\s*(?:mesafe|distance)\s*(\d+(?:\.\d+)?)\s*(?:deniz mili|nm)/g;
    for (const match of text.matchAll(pattern)) legs.push({ course: Number(match[1]), distanceNm: Number(match[2]) });
    return { legs };
  }

  function vector(speed, direction) {
    const angle = toRad(normalize360(Number(direction)));
    return { east: Number(speed) * Math.sin(angle), north: Number(speed) * Math.cos(angle) };
  }

  function vectorToPolar(east, north) {
    return { speed: Math.hypot(east, north), direction: normalize360(toDeg(Math.atan2(east, north))) };
  }

  function currentResult(course, speed, set, drift) {
    const ship = vector(speed, course);
    const current = vector(drift, set);
    const result = vectorToPolar(ship.east + current.east, ship.north + current.north);
    return {
      courseMadeGood: result.direction,
      speedMadeGood: result.speed,
      set: result.direction,
      drift: result.speed
    };
  }

  function courseToSteer(desiredCourse, desiredSpeed, set, drift) {
    const ground = vector(desiredSpeed, desiredCourse);
    const current = vector(drift, set);
    const water = vectorToPolar(ground.east - current.east, ground.north - current.north);
    return {
      courseToSteer: water.direction,
      speedThroughWater: water.speed,
      course: water.direction,
      speed: water.speed
    };
  }

  function labelledNumber(text, labels, unitPattern) {
    const match = text.match(new RegExp("(?:" + labels + ")\\s*(?:is|=|:)?\\s*([+-]?\\d+(?:\\.\\d+)?)\\s*(?:" + unitPattern + ")?", "i"));
    return match ? Number(match[1]) : null;
  }

  function parseCurrentQuestion(question) {
    const text = normalizeText(question);
    if (!/(?:akıntı|akinti|current|set|drift)(?=\s|$|[.,;:])/i.test(text)) return null;

    const wantsCourseToSteer = /\b(dümen rotası|dumen rotasi|tutulacak rota|course to steer|cts)\b/.test(text);
    const course = labelledNumber(text,
      wantsCourseToSteer ? "istenen rota|hedef rota|yere göre rota|yere gore rota|desired course" : "suya göre rota|suya gore rota|tekne rotası|tekne rotasi|rota|course",
      "°|derece|deg|t"
    );
    const speed = labelledNumber(text,
      wantsCourseToSteer ? "istenen hız|istenen hiz|hedef hız|hedef hiz|yere göre hız|yere gore hiz|desired speed" : "suya göre hız|suya gore hiz|tekne hızı|tekne hizi|hız|hiz|speed",
      "knot|knots|kt|kts|kn"
    );
    const set = labelledNumber(text, "akıntı seti|akinti seti|akıntı yönü|akinti yonu|current set|set", "°|derece|deg|t");
    const drift = labelledNumber(text, "akıntı hızı|akinti hizi|current drift|drift", "knot|knots|kt|kts|kn");

    return {
      mode: wantsCourseToSteer ? "courseToSteer" : "currentResult",
      course: course == null ? null : normalize360(course),
      speed,
      set: set == null ? null : normalize360(set),
      drift
    };
  }

  function parseDrQuestion(question) {
    const text = normalizeText(question);
    if (!/\b(dr|dead reckoning|parakete|mevki(?:den|nden|inden)?|pozisyon(?:dan|undan)?)\b/.test(text)) return null;

    const lat = parseCoordinate(text, "lat");
    const lon = parseCoordinate(text, "lon");
    const speedMatch = text.match(/(\d+(?:\.\d+)?)\s*(?:knot|knots|kt|kts|deniz mili\s*(?:\/|per|saatte)|nm\s*\/\s*h)/);
    const hourMatch = text.match(/(\d+(?:\.\d+)?)\s*(?:saat|hour|hours|stunde|stunden)/);
    const minuteMatches = [...text.matchAll(/(\d+(?:\.\d+)?)\s*(?:dakika|minute|minutes|minuten|min)\b/g)];
    // Coordinate minutes must never become voyage time. When hours are
    // present, only a minute expression after the hour belongs to duration.
    // A minute-only duration must carry an explicit temporal cue.
    const minuteMatch = hourMatch
      ? minuteMatches.find(match=>match.index>hourMatch.index)
      : minuteMatches.find(match=>/(?:sonra|boyunca|süre|sure|duration)/.test(text.slice(match.index,match.index+50)));
    const coursePatterns = [
      /(?:rota|course|kurs|hakiki rota)\s*(?:is|=|:)?\s*(\d{1,3}(?:\.\d+)?)\s*(?:°|derece|deg)?/,
      /(\d{1,3}(?:\.\d+)?)\s*(?:°|derece|deg)\s*(?:rotasıyla|rotasiyla|rotayla|rotasında|rotasinda|course|kurs)/,
      /(\d{1,3}(?:\.\d+)?)\s*°\s*t\b/
    ];
    let course = null;
    for (const pattern of coursePatterns) {
      const match = text.match(pattern);
      if (match) { course = Number(match[1]); break; }
    }

    const ambiguous = course == null && /\b\d{1,3}(?:\.\d+)?\s*(?:°|derece|deg)\s*(?:doğu|dogu|batı|bati|east|west|ost)\s*(?:yönünde|yonunde|direction)?/.test(text);
    const hours = Number(hourMatch?.[1] || 0) + Number(minuteMatch?.[1] || 0) / 60;
    return {
      lat, lon,
      speed: speedMatch ? Number(speedMatch[1]) : null,
      hours: hours || null,
      course: course == null ? null : normalize360(course),
      ambiguous
    };
  }

  function languageCode(language) {
    const value = normalizeText(language);
    if (value.startsWith("de") || value.includes("almanca") || value.includes("deutsch")) return "de";
    if (value.startsWith("en") || value.includes("ingilizce") || value.includes("english")) return "en";
    return "tr";
  }

  function answer(question, language) {
    const lang = languageCode(language);
    const leewayQuestion = parseLeewayQuestion(question);
    if (leewayQuestion) {
      const missing = [];
      if (leewayQuestion.desiredTrack == null) missing.push(lang === "tr" ? "istenen rota" : "desired track");
      if (leewayQuestion.leewayDegrees == null) missing.push(lang === "tr" ? "sapma a\u00e7\u0131s\u0131" : "leeway angle");
      if (!leewayQuestion.windSide) missing.push(lang === "tr" ? "r\u00fczg\u00e2r taraf\u0131" : "wind side");
      if (missing.length) return lang === "tr" ? `R\u00fczg\u00e2r sapmas\u0131 hesab\u0131 i\u00e7in eksik bilgiler: ${missing.join(", ")}.` : `Missing leeway inputs: ${missing.join(", ")}.`;
      const result = applyLeeway(leewayQuestion.desiredTrack, leewayQuestion.leewayDegrees, leewayQuestion.windSide);
      return lang === "tr" ? `R\u00fczg\u00e2r sapmas\u0131 i\u00e7in tutulacak rota ${result.toFixed(1)}\u00b0T. R\u00fczg\u00e2r taraf\u0131 ve sapma i\u015fareti gemi davran\u0131\u015f\u0131yla do\u011frulanmal\u0131d\u0131r.` : `Course to steer for leeway: ${result.toFixed(1)}\u00b0T. Verify wind side and correction sign against vessel behaviour.`;
    }

    const windQuestion = parseWindTriangleQuestion(question);
    if (windQuestion) {
      const missing = [];
      if (windQuestion.windSpeed == null) missing.push(lang === "tr" ? "r\u00fczg\u00e2r h\u0131z\u0131" : "wind speed");
      if (windQuestion.windFrom == null) missing.push(lang === "tr" ? "r\u00fczg\u00e2r y\u00f6n\u00fc" : "wind direction");
      if (windQuestion.vesselCourse == null) missing.push(lang === "tr" ? "gemi rotas\u0131" : "vessel course");
      if (windQuestion.vesselSpeed == null) missing.push(lang === "tr" ? "gemi h\u0131z\u0131" : "vessel speed");
      if (missing.length) return lang === "tr" ? `R\u00fczg\u00e2r \u00fc\u00e7geni i\u00e7in eksik bilgiler: ${missing.join(", ")}.` : `Missing wind-triangle inputs: ${missing.join(", ")}.`;
      const result = windQuestion.mode === "toTrue"
        ? trueWindFromApparent(windQuestion.windSpeed, windQuestion.windFrom, windQuestion.vesselCourse, windQuestion.vesselSpeed)
        : apparentWind(windQuestion.windSpeed, windQuestion.windFrom, windQuestion.vesselCourse, windQuestion.vesselSpeed);
      return lang === "tr"
        ? `${windQuestion.mode === "toTrue" ? "Hakiki" : "G\u00f6r\u00fcn\u00fcr"} r\u00fczg\u00e2r ${result.speedKnots.toFixed(2)} knot, ${result.from.toFixed(1)}\u00b0T y\u00f6n\u00fcnden. Anemometre, gemi hareketi ve meteorolojik verilerle do\u011frulay\u0131n.`
        : `${windQuestion.mode === "toTrue" ? "True" : "Apparent"} wind ${result.speedKnots.toFixed(2)} kn from ${result.from.toFixed(1)}\u00b0T. Verify with the anemometer, vessel motion, and weather data.`;
    }

    const traverseQuestion = parseTraverseQuestion(question);
    if (traverseQuestion) {
      if (traverseQuestion.legs.length < 2) return lang === "tr" ? "Travers seyri i\u00e7in en az iki etap verin: her etapta rota ve mesafe bulunmal\u0131d\u0131r." : "Provide at least two traverse legs, each with course and distance.";
      const result = traverse(traverseQuestion.legs);
      return lang === "tr" ? `Toplam ko\u015fulan mesafe ${result.runNm.toFixed(2)} deniz mili; net mesafe ${result.distanceMadeGoodNm.toFixed(2)} deniz mili, net rota ${result.courseMadeGood.toFixed(1)}\u00b0T. Sonucu harita \u00fczerinde ba\u011f\u0131ms\u0131z olarak kontrol edin.` : `Total run ${result.runNm.toFixed(2)} NM; distance made good ${result.distanceMadeGoodNm.toFixed(2)} NM on ${result.courseMadeGood.toFixed(1)}\u00b0T. Check independently on the chart.`;
    }

    const oceanQuestion = parseOceanRouteQuestion(question);
    if (oceanQuestion) {
      const values = [...Object.values(oceanQuestion.start), ...Object.values(oceanQuestion.end)];
      if (values.some(value => value == null)) return lang === "tr" ? "Rota kar\u015f\u0131la\u015ft\u0131rmas\u0131 i\u00e7in ba\u015flang\u0131\u00e7 ve var\u0131\u015f enlem/boylamlar\u0131n\u0131 verin." : "Provide start and destination latitude/longitude for route comparison.";
      const result = compareOceanRoutes(oceanQuestion.start, oceanQuestion.end);
      return lang === "tr" ? `B\u00fcy\u00fck daire ${result.greatCircleDistanceNm.toFixed(2)} deniz mili, ilk rota ${result.greatCircleInitialCourse.toFixed(1)}\u00b0T; kerte hatt\u0131 ${result.rhumbDistanceNm.toFixed(2)} deniz mili, rota ${result.rhumbCourse.toFixed(1)}\u00b0T. Teorik tasarruf ${result.savingNm.toFixed(2)} deniz mili (%${result.savingPercent.toFixed(2)}). Hava, ak\u0131nt\u0131, buz, trafik ve seyir k\u0131s\u0131tlar\u0131yla rota yeniden de\u011ferlendirilmelidir.` : `Great-circle ${result.greatCircleDistanceNm.toFixed(2)} NM, initial course ${result.greatCircleInitialCourse.toFixed(1)}\u00b0T; rhumb line ${result.rhumbDistanceNm.toFixed(2)} NM, course ${result.rhumbCourse.toFixed(1)}\u00b0T. Theoretical saving ${result.savingNm.toFixed(2)} NM (${result.savingPercent.toFixed(2)}%). Reassess for weather, current, ice, traffic, and navigational constraints.`;
    }

    const planeQuestion = parsePlaneSailingQuestion(question);
    if (planeQuestion) {
      const missing = [];
      if (planeQuestion.deltaLatitudeNm == null) missing.push(lang === "tr" ? "enlem fark\u0131" : "difference of latitude");
      if (planeQuestion.departureNm == null) missing.push("departure");
      if (missing.length) return lang === "tr" ? `D\u00fczlem seyri i\u00e7in eksik bilgiler: ${missing.join(", ")}.` : `Missing plane-sailing inputs: ${missing.join(", ")}.`;
      const result = planeSailing(planeQuestion.deltaLatitudeNm, planeQuestion.departureNm);
      return lang === "tr" ? `D\u00fczlem seyri mesafesi ${result.distanceNm.toFixed(2)} deniz mili; rota ${result.course.toFixed(1)}\u00b0T. K\u0131sa mesafe yakla\u015f\u0131m\u0131d\u0131r; y\u00fcksek enlem ve uzun etaplarda uygun seyir y\u00f6ntemi kullan\u0131n.` : `Plane-sailing distance ${result.distanceNm.toFixed(2)} NM; course ${result.course.toFixed(1)}\u00b0T. This is a short-distance approximation; use an appropriate sailing method at high latitudes and over long legs.`;
    }

    const middleQuestion = parseMiddleLatitudeQuestion(question);
    if (middleQuestion) {
      const values = [middleQuestion.lat1, middleQuestion.lon1, middleQuestion.lat2, middleQuestion.lon2];
      if (values.some(value => value == null)) return lang === "tr" ? "Orta enlem seyri i\u00e7in ba\u015flang\u0131\u00e7 ve var\u0131\u015f enlem/boylamlar\u0131n\u0131 verin." : "Provide start and destination latitude/longitude for middle-latitude sailing.";
      const result = middleLatitudeSailing(middleQuestion.lat1, middleQuestion.lon1, middleQuestion.lat2, middleQuestion.lon2);
      return lang === "tr" ? `Orta enlem seyri mesafesi ${result.distanceNm.toFixed(2)} deniz mili; rota ${result.course.toFixed(1)}\u00b0T; enlem fark\u0131 ${result.deltaLatitudeNm.toFixed(2)} ve departure ${result.departureNm.toFixed(2)} deniz mili. Harita \u00fczerinde ba\u011f\u0131ms\u0131z kontrol yap\u0131n.` : `Middle-latitude distance ${result.distanceNm.toFixed(2)} NM; course ${result.course.toFixed(1)}\u00b0T; difference of latitude ${result.deltaLatitudeNm.toFixed(2)} and departure ${result.departureNm.toFixed(2)} NM. Cross-check independently on the chart.`;
    }

    const verticalQuestion = parseVerticalAngleDistanceQuestion(question);
    if (verticalQuestion) {
      const missing = [];
      if (verticalQuestion.objectHeightMeters == null) missing.push(lang === "tr" ? "cisim y\u00fcksekli\u011fi" : "object height");
      if (verticalQuestion.verticalAngleDegrees == null) missing.push(lang === "tr" ? "dikey a\u00e7\u0131" : "vertical angle");
      if (missing.length) return lang === "tr" ? `Dikey a\u00e7\u0131 mesafesi i\u00e7in eksik bilgiler: ${missing.join(", ")}.` : `Missing vertical-angle distance inputs: ${missing.join(", ")}.`;
      if (verticalQuestion.objectHeightMeters <= verticalQuestion.observerHeightMeters) return lang === "tr" ? "Cisim y\u00fcksekli\u011fi g\u00f6z y\u00fcksekli\u011finden b\u00fcy\u00fck olmal\u0131d\u0131r." : "Object height must exceed observer height.";
      const result = distanceByVerticalAngle(verticalQuestion.objectHeightMeters, verticalQuestion.verticalAngleDegrees, verticalQuestion.observerHeightMeters);
      return lang === "tr" ? `Dikey a\u00e7\u0131dan tahmini mesafe ${result.distanceNm.toFixed(3)} deniz mili (${result.distanceMeters.toFixed(1)} m). Harita cisim y\u00fcksekli\u011fi, gelgit ve ba\u011f\u0131ms\u0131z mevki hatt\u0131yla do\u011frulay\u0131n.` : `Estimated distance from vertical angle ${result.distanceNm.toFixed(3)} NM (${result.distanceMeters.toFixed(1)} m). Verify charted object height, tide, and an independent position line.`;
    }

    const longitudeQuestion = parseLongitudeTimeQuestion(question);
    if (longitudeQuestion) {
      const missing = [];
      if (longitudeQuestion.seconds == null) missing.push(lang === "tr" ? "zaman fark\u0131" : "time difference");
      if (!longitudeQuestion.direction) missing.push(lang === "tr" ? "do\u011fu/bat\u0131 y\u00f6n\u00fc" : "east/west direction");
      if (missing.length) return lang === "tr" ? `Zaman fark\u0131ndan boylam i\u00e7in eksik bilgiler: ${missing.join(", ")}.` : `Missing time-to-longitude inputs: ${missing.join(", ")}.`;
      const longitude = timeDifferenceToLongitude(longitudeQuestion.seconds, longitudeQuestion.direction);
      return lang === "tr" ? `Boylam fark\u0131 ${Math.abs(longitude).toFixed(2)}\u00b0 ${longitude < 0 ? "Bat\u0131" : "Do\u011fu"}. Kronometre hatas\u0131n\u0131 ve kullan\u0131lan zaman referans\u0131n\u0131 do\u011frulay\u0131n.` : `Longitude difference ${Math.abs(longitude).toFixed(2)}\u00b0 ${longitude < 0 ? "West" : "East"}. Verify chronometer error and the time reference used.`;
    }

    const bearingQuestion = parseBearingConversionQuestion(question);
    if (bearingQuestion) {
      const missing = [];
      if (bearingQuestion.bearing == null) missing.push(lang === "tr" ? "kerteriz" : "bearing");
      if (bearingQuestion.heading == null) missing.push(lang === "tr" ? "gemi ba\u015f\u0131" : "vessel heading");
      if (missing.length) return lang === "tr" ? `Kerteriz d\u00f6n\u00fc\u015f\u00fcm\u00fc i\u00e7in eksik bilgiler: ${missing.join(", ")}.` : `Missing bearing-conversion inputs: ${missing.join(", ")}.`;
      if (bearingQuestion.mode === "toRelative") {
        const result = trueToRelativeBearing(bearingQuestion.bearing, bearingQuestion.heading);
        return lang === "tr" ? `Nispi kerteriz saat y\u00f6n\u00fcnde ${result.clockwise.toFixed(1)}\u00b0; i\u015faretli de\u011fer ${result.signed.toFixed(1)}\u00b0 (${result.signed < 0 ? "iskele" : "sancak"}). Cayro/pusula hatalar\u0131n\u0131 ayr\u0131ca uygulay\u0131n.` : `Relative bearing ${result.clockwise.toFixed(1)}\u00b0 clockwise; signed ${result.signed.toFixed(1)}\u00b0 (${result.signed < 0 ? "port" : "starboard"}). Apply gyro/compass errors separately.`;
      }
      const result = relativeToTrueBearing(bearingQuestion.bearing, bearingQuestion.heading);
      return lang === "tr" ? `Hakiki kerteriz ${result.toFixed(1)}\u00b0T. Cayro/pusula hatalar\u0131n\u0131 ve gemi ba\u015f\u0131n\u0131n zaman\u0131n\u0131 do\u011frulay\u0131n.` : `True bearing ${result.toFixed(1)}\u00b0T. Verify gyro/compass errors and heading timestamp.`;
    }

    const sextantQuestion = parseSextantCorrectionQuestion(question);
    if (sextantQuestion) {
      if (sextantQuestion.sextantAltitude == null) return lang === "tr" ? "Sekstant d\u00fczeltmesi i\u00e7in sekstant irtifas\u0131n\u0131 derece olarak verin." : "Provide the sextant altitude in degrees.";
      const result = correctedSextantAltitude(sextantQuestion.sextantAltitude, sextantQuestion.indexErrorMinutes, sextantQuestion.eyeHeightMeters);
      return lang === "tr" ? `D\u00fczeltilmi\u015f irtifa ${result.correctedAltitude.toFixed(4)}\u00b0; indeks d\u00fczeltmesi ${result.indexCorrectionMinutes.toFixed(2)}', dip ${result.dipMinutes.toFixed(2)}', refraksiyon ${result.refractionMinutes.toFixed(2)}'. Almanak ana d\u00fczeltmeleri ve g\u00f6zlem ko\u015fullar\u0131 ayr\u0131ca uygulanmal\u0131d\u0131r.` : `Corrected altitude ${result.correctedAltitude.toFixed(4)}\u00b0; index correction ${result.indexCorrectionMinutes.toFixed(2)}', dip ${result.dipMinutes.toFixed(2)}', refraction ${result.refractionMinutes.toFixed(2)}'. Apply the remaining almanac corrections and observation conditions separately.`;
    }

    const meridianQuestion = parseMeridianLatitudeQuestion(question);
    if (meridianQuestion) {
      const missing = [];
      if (meridianQuestion.observedAltitude == null) missing.push(lang === "tr" ? "g\u00f6zlenen irtifa" : "observed altitude");
      if (meridianQuestion.declination == null) missing.push(lang === "tr" ? "deklinasyon" : "declination");
      if (missing.length) return lang === "tr" ? `Meridyen enlemi i\u00e7in eksik bilgiler: ${missing.join(", ")}.` : `Missing meridian-latitude inputs: ${missing.join(", ")}.`;
      const result = meridianLatitudeCandidates(meridianQuestion.observedAltitude, meridianQuestion.declination);
      return lang === "tr" ? `Zenit mesafesi ${result.zenithDistance.toFixed(2)}\u00b0; olas\u0131 enlemler ${result.candidates.map(value => value.toFixed(2) + "\u00b0").join(" veya ")}. Do\u011fru aday\u0131 g\u00f6k cisminin meridyen y\u00f6n\u00fc ve DR mevkiiyle se\u00e7in.` : `Zenith distance ${result.zenithDistance.toFixed(2)}\u00b0; latitude candidates ${result.candidates.map(value => value.toFixed(2) + "\u00b0").join(" or ")}. Select the correct candidate using the body's meridian bearing and DR position.`;
    }

    const interceptQuestion = parseCelestialInterceptQuestion(question);
    if (interceptQuestion) {
      const missing = [];
      if (interceptQuestion.observedAltitude == null) missing.push(lang === "tr" ? "g\u00f6zlenen irtifa" : "observed altitude");
      if (interceptQuestion.computedAltitude == null) missing.push(lang === "tr" ? "hesaplanan irtifa" : "computed altitude");
      if (interceptQuestion.azimuth == null) missing.push(lang === "tr" ? "azimut" : "azimuth");
      if (missing.length) return lang === "tr" ? `Intercept hesab\u0131 i\u00e7in eksik bilgiler: ${missing.join(", ")}.` : `Missing intercept inputs: ${missing.join(", ")}.`;
      const result = celestialIntercept(interceptQuestion.observedAltitude, interceptQuestion.computedAltitude, interceptQuestion.azimuth);
      return lang === "tr" ? `Intercept ${result.distanceNm.toFixed(2)} deniz mili, ${result.direction === "toward" ? "azimuta do\u011fru" : "azimuttan uza\u011fa"}; azimut ${result.azimuth.toFixed(1)}\u00b0. LOP'u uygun harita/prosed\u00fcrle \u00e7izin ve ba\u011f\u0131ms\u0131z g\u00f6zlemle do\u011frulay\u0131n.` : `Intercept ${result.distanceNm.toFixed(2)} NM, ${result.direction === "toward" ? "toward" : "away from"} azimuth ${result.azimuth.toFixed(1)}\u00b0. Plot the LOP using the approved procedure and verify with an independent sight.`;
    }

    const radarQuestion = parseRadarRelativeQuestion(question);
    if (radarQuestion) {
      const missing = [];
      if (radarQuestion.firstRange == null) missing.push(lang === "tr" ? "ilk menzil" : "first range");
      if (radarQuestion.firstBearing == null) missing.push(lang === "tr" ? "ilk kerteriz" : "first bearing");
      if (radarQuestion.secondRange == null) missing.push(lang === "tr" ? "ikinci menzil" : "second range");
      if (radarQuestion.secondBearing == null) missing.push(lang === "tr" ? "ikinci kerteriz" : "second bearing");
      if (radarQuestion.intervalMinutes == null) missing.push(lang === "tr" ? "zaman aral\u0131\u011f\u0131" : "time interval");
      if (missing.length) return lang === "tr" ? `Radar nispi hareket hesab\u0131 i\u00e7in eksik bilgiler: ${missing.join(", ")}.` : `Missing radar relative-motion inputs: ${missing.join(", ")}.`;
      const result = radarRelativeMotion(radarQuestion.firstRange, radarQuestion.firstBearing, radarQuestion.secondRange, radarQuestion.secondBearing, radarQuestion.intervalMinutes);
      const tcpaMinutes = Number.isFinite(result.tcpaHours) ? result.tcpaHours * 60 : Infinity;
      return lang === "tr" ? `Nispi rota ${result.relativeCourse.toFixed(1)}\u00b0; nispi h\u0131z ${result.relativeSpeed.toFixed(2)} knot; CPA ${result.cpaNm.toFixed(2)} deniz mili; TCPA ${Number.isFinite(tcpaMinutes) ? tcpaMinutes.toFixed(1) + " dakika" : "hesaplanam\u0131yor"}. ARPA izini, kerteriz kararl\u0131l\u0131\u011f\u0131n\u0131 ve COLREG de\u011ferlendirmesini do\u011frulay\u0131n.` : `Relative course ${result.relativeCourse.toFixed(1)}\u00b0; relative speed ${result.relativeSpeed.toFixed(2)} kn; CPA ${result.cpaNm.toFixed(2)} NM; TCPA ${Number.isFinite(tcpaMinutes) ? tcpaMinutes.toFixed(1) + " minutes" : "unavailable"}. Verify the ARPA track, bearing stability, and COLREG assessment.`;
    }

    const twelfthsQuestion = parseTwelfthsQuestion(question);
    if (twelfthsQuestion) {
      const missing = [];
      if (twelfthsQuestion.lowWater == null) missing.push(lang === "tr" ? "al\u00e7ak su" : "low water");
      if (twelfthsQuestion.highWater == null) missing.push(lang === "tr" ? "y\u00fcksek su" : "high water");
      if (twelfthsQuestion.hoursSinceLow == null) missing.push(lang === "tr" ? "al\u00e7ak sudan sonra ge\u00e7en s\u00fcre" : "hours since low water");
      if (missing.length) return lang === "tr" ? `12'ler kural\u0131 i\u00e7in eksik bilgiler: ${missing.join(", ")}.` : `Missing rule-of-twelfths inputs: ${missing.join(", ")}.`;
      const result = ruleOfTwelfths(twelfthsQuestion.lowWater, twelfthsQuestion.highWater, twelfthsQuestion.hoursSinceLow, twelfthsQuestion.durationHours);
      return lang === "tr" ? `12'ler kural\u0131na g\u00f6re tahmini gelgit y\u00fcksekli\u011fi ${result.height.toFixed(2)} m. Bu yaln\u0131zca yakla\u015f\u0131md\u0131r; onayl\u0131 gelgit tablosu ve yerel d\u00fczeltmeler esast\u0131r.` : `Estimated tide height by the rule of twelfths: ${result.height.toFixed(2)} m. This is an approximation; approved tide tables and local corrections prevail.`;
    }

    const secondaryPortQuestion = parseSecondaryPortQuestion(question);
    if (secondaryPortQuestion) {
      const missing = [];
      if (!secondaryPortQuestion.referenceTimeIso) missing.push(lang === "tr" ? "referans zaman\u0131" : "reference time");
      if (secondaryPortQuestion.referenceHeight == null) missing.push(lang === "tr" ? "referans y\u00fcksekli\u011fi" : "reference height");
      if (missing.length) return lang === "tr" ? `Tali liman hesab\u0131 i\u00e7in eksik bilgiler: ${missing.join(", ")}.` : `Missing secondary-port inputs: ${missing.join(", ")}.`;
      const result = secondaryPortTide({ timeIso: secondaryPortQuestion.referenceTimeIso, height: secondaryPortQuestion.referenceHeight }, { timeMinutes: secondaryPortQuestion.timeMinutes, heightRatio: secondaryPortQuestion.heightRatio, heightAddition: secondaryPortQuestion.heightAddition });
      return lang === "tr" ? `Tali liman tahmini: zaman ${result.timeIso}; y\u00fckseklik ${result.height.toFixed(2)} m. G\u00fcncel resmi tali liman farklar\u0131yla do\u011frulay\u0131n.` : `Secondary-port estimate: time ${result.timeIso}; height ${result.height.toFixed(2)} m. Verify against current official secondary-port differences.`;
    }

    const turnQuestion = parseTurnQuestion(question);
    if (turnQuestion) {
      const missing = [];
      if (turnQuestion.speedKnots == null) missing.push(lang === "tr" ? "h\u0131z" : "speed");
      if (turnQuestion.rateOfTurn == null) missing.push(lang === "tr" ? "d\u00f6n\u00fc\u015f oran\u0131" : "rate of turn");
      if (turnQuestion.courseChange == null) missing.push(lang === "tr" ? "rota de\u011fi\u015fimi" : "course change");
      if (missing.length) return lang === "tr" ? `D\u00f6n\u00fc\u015f hesab\u0131 i\u00e7in eksik bilgiler: ${missing.join(", ")}.` : `Missing turn inputs: ${missing.join(", ")}.`;
      const result = turnGeometry(turnQuestion.speedKnots, turnQuestion.rateOfTurn, turnQuestion.courseChange);
      return lang === "tr" ? `D\u00f6n\u00fc\u015f yar\u0131\u00e7ap\u0131 ${result.radiusNm.toFixed(2)} deniz mili; wheel-over mesafesi ${result.wheelOverDistanceNm.toFixed(2)} deniz mili; d\u00f6n\u00fc\u015f s\u00fcresi ${result.turnMinutes.toFixed(1)} dakika. Ger\u00e7ek manevra karakteristikleri ve k\u0131lavuzluk plan\u0131yla do\u011frulay\u0131n.` : `Turn radius ${result.radiusNm.toFixed(2)} NM; wheel-over distance ${result.wheelOverDistanceNm.toFixed(2)} NM; turn time ${result.turnMinutes.toFixed(1)} minutes. Verify with actual manoeuvring characteristics and the pilotage plan.`;
    }

    const rangeQuestion = parseGeographicRangeQuestion(question);
    if (rangeQuestion) {
      const missing = [];
      if (rangeQuestion.eyeHeightMeters == null) missing.push(lang === "tr" ? "g\u00f6z y\u00fcksekli\u011fi" : "eye height");
      if (rangeQuestion.objectHeightMeters == null) missing.push(lang === "tr" ? "cisim/fener y\u00fcksekli\u011fi" : "object/light height");
      if (missing.length) return lang === "tr" ? `Co\u011frafi menzil hesab\u0131 i\u00e7in eksik bilgiler: ${missing.join(", ")}.` : `Missing geographic-range inputs: ${missing.join(", ")}.`;
      const result = geographicRange(rangeQuestion.eyeHeightMeters, rangeQuestion.objectHeightMeters);
      return lang === "tr" ? `Co\u011frafi g\u00f6r\u00fc\u015f menzili ${result.geographicRangeNm.toFixed(2)} deniz mili (g\u00f6z ufku ${result.observerHorizonNm.toFixed(2)}, fener ufku ${result.objectHorizonNm.toFixed(2)}). Meteorolojik g\u00f6r\u00fc\u015f ve fenerin nominal menzili ayr\u0131ca kontrol edilmelidir.` : `Geographic range ${result.geographicRangeNm.toFixed(2)} NM (observer horizon ${result.observerHorizonNm.toFixed(2)}, light horizon ${result.objectHorizonNm.toFixed(2)}). Also check meteorological visibility and the light's nominal range.`;
    }

    const variationQuestion = parseVariationQuestion(question);
    if (variationQuestion) {
      const missing = [];
      if (variationQuestion.chartVariation == null) missing.push(lang === "tr" ? "harita varyasyonu" : "chart variation");
      if (variationQuestion.annualChangeMinutes == null) missing.push(lang === "tr" ? "y\u0131ll\u0131k de\u011fi\u015fim" : "annual change");
      if (variationQuestion.chartYear == null) missing.push(lang === "tr" ? "harita y\u0131l\u0131" : "chart year");
      if (!Number.isFinite(variationQuestion.targetYear)) missing.push(lang === "tr" ? "hedef y\u0131l" : "target year");
      if (missing.length) return lang === "tr" ? `Varyasyon g\u00fcncellemesi i\u00e7in eksik bilgiler: ${missing.join(", ")}.` : `Missing variation-update inputs: ${missing.join(", ")}.`;
      const result = magneticVariationAtDate(variationQuestion.chartVariation, variationQuestion.annualChangeMinutes, variationQuestion.chartYear, `${variationQuestion.targetYear}-01-01T00:00:00Z`);
      return lang === "tr" ? `G\u00fcncellenmi\u015f manyetik varyasyon: ${result.variation.toFixed(2)}\u00b0 (do\u011fu pozitif, bat\u0131 negatif). G\u00fcncel harita ve seyir yay\u0131n\u0131yla do\u011frulay\u0131n.` : `Updated magnetic variation: ${result.variation.toFixed(2)}\u00b0 (east positive, west negative). Verify against the current chart and nautical publications.`;
    }

    const squatQuestion = parseSquatQuestion(question);
    if (squatQuestion) {
      if (squatQuestion.blockCoefficient == null) return lang === "tr" ? "Squat hesab\u0131 i\u00e7in blok katsay\u0131s\u0131n\u0131 (Cb) verin." : "Provide the block coefficient (Cb) for the squat calculation.";
      if (squatQuestion.mode === "maximumSpeed") {
        if (squatQuestion.maximumSquatMeters == null) return lang === "tr" ? "Azami h\u0131z i\u00e7in izin verilen squat s\u0131n\u0131r\u0131n\u0131 metre olarak verin." : "Provide the maximum permitted squat in metres.";
        const speed = maximumSpeedForSquat(squatQuestion.maximumSquatMeters, squatQuestion.blockCoefficient, squatQuestion.confinedWater);
        return lang === "tr" ? `Hesaplanan azami h\u0131z: ${speed.toFixed(2)} knot. Bu Barrass tahminidir; ger\u00e7ek UKC, kanal ve gemi verileriyle daha d\u00fc\u015f\u00fck emniyetli h\u0131z uygulanabilir.` : `Calculated maximum speed: ${speed.toFixed(2)} kn. This is a Barrass estimate; actual UKC, channel, and vessel data may require a lower safe speed.`;
      }
      if (squatQuestion.speedKnots == null) return lang === "tr" ? "Squat hesab\u0131 i\u00e7in gemi h\u0131z\u0131n\u0131 knot olarak verin." : "Provide vessel speed in knots for the squat calculation.";
      const squat = barrassSquat(squatQuestion.speedKnots, squatQuestion.blockCoefficient, squatQuestion.confinedWater);
      return lang === "tr" ? `Tahmini squat: ${squat.toFixed(2)} m (${squatQuestion.confinedWater ? "dar/s\u0131\u011f su" : "a\u00e7\u0131k su"} modeli). UKC hesab\u0131na ekleyin ve gemiye \u00f6zel verilerle do\u011frulay\u0131n.` : `Estimated squat: ${squat.toFixed(2)} m (${squatQuestion.confinedWater ? "confined/shallow water" : "open water"} model). Include it in UKC and verify with vessel-specific data.`;
    }

    const anchorQuestion = parseAnchorQuestion(question);
    if (anchorQuestion) {
      const missing = [];
      if (anchorQuestion.waterDepthMeters == null) missing.push(lang === "tr" ? "su derinli\u011fi" : "water depth");
      if (anchorQuestion.scopeRatio == null) missing.push(lang === "tr" ? "kaloma oran\u0131" : "scope ratio");
      if (missing.length) return lang === "tr" ? `Demirleme hesab\u0131 i\u00e7in eksik bilgiler: ${missing.join(", ")}.` : `Missing anchoring inputs: ${missing.join(", ")}.`;
      const result = anchorScope(anchorQuestion.waterDepthMeters, anchorQuestion.tideHeightMeters, anchorQuestion.bowHeightMeters, anchorQuestion.scopeRatio, anchorQuestion.vesselLengthMeters);
      return lang === "tr" ? `Gerekli kaloma ${result.cableLengthMeters.toFixed(1)} m (${result.cableLengthShackles.toFixed(2)} kilit); tahmini sal\u0131n\u0131m yar\u0131\u00e7ap\u0131 ${result.swingRadiusMeters.toFixed(1)} m. R\u00fczg\u00e2r, ak\u0131nt\u0131, zemin ve yerel limitlerle do\u011frulay\u0131n.` : `Required cable ${result.cableLengthMeters.toFixed(1)} m (${result.cableLengthShackles.toFixed(2)} shackles); estimated swing radius ${result.swingRadiusMeters.toFixed(1)} m. Verify for wind, current, holding ground, and local limits.`;
    }

    const stopQuestion = parseStoppingQuestion(question);
    if (stopQuestion) {
      const missing = [];
      if (stopQuestion.speedKnots == null) missing.push(lang === "tr" ? "h\u0131z" : "speed");
      if (stopQuestion.deceleration == null) missing.push(lang === "tr" ? "yava\u015flama" : "deceleration");
      if (missing.length) return lang === "tr" ? `Durma hesab\u0131 i\u00e7in eksik bilgiler: ${missing.join(", ")}.` : `Missing stopping inputs: ${missing.join(", ")}.`;
      const result = stoppingPerformance(stopQuestion.speedKnots, stopQuestion.deceleration, stopQuestion.reactionSeconds);
      return lang === "tr" ? `Tahmini durma mesafesi ${result.stoppingDistanceMeters.toFixed(1)} m (${result.stoppingDistanceNm.toFixed(3)} deniz mili); toplam s\u00fcre ${result.stoppingSeconds.toFixed(1)} saniye. Makine tepki s\u00fcresi, y\u00fck, r\u00fczg\u00e2r ve ak\u0131nt\u0131ya g\u00f6re emniyet pay\u0131 ekleyin.` : `Estimated stopping distance ${result.stoppingDistanceMeters.toFixed(1)} m (${result.stoppingDistanceNm.toFixed(3)} NM); total time ${result.stoppingSeconds.toFixed(1)} seconds. Add margin for machinery response, loading, wind, and current.`;
    }

    const compass = parseCompassQuestion(question);
    if (compass) {
      if (compass.course == null) return lang === "tr" ? "Pusula d\u00f6n\u00fc\u015f\u00fcm\u00fc i\u00e7in rota de\u011ferini derece olarak verin." : "Provide the course in degrees for the compass conversion.";
      const result = compass.mode === "toTrue"
        ? compassToTrue(compass.course, compass.deviation, compass.variation)
        : trueToCompass(compass.course, compass.deviation, compass.variation);
      return lang === "tr"
        ? `${compass.mode === "toTrue" ? "Hakiki rota" : "Pusula rotas\u0131"}: ${result.toFixed(1)}\u00b0. Do\u011fu pozitif, bat\u0131 negatif i\u015faretle hesapland\u0131; gemi pusula kart\u0131yla do\u011frulay\u0131n.`
        : `${compass.mode === "toTrue" ? "True course" : "Compass course"}: ${result.toFixed(1)}\u00b0. East is positive and west negative; verify against the vessel's compass card.`;
    }

    const etaQuestion = parseEtaQuestion(question);
    if (etaQuestion) {
      const missing = [];
      if (!etaQuestion.departureIso) missing.push(lang === "tr" ? "kalk\u0131\u015f zaman\u0131 (ISO)" : "departure time (ISO)");
      if (etaQuestion.distanceNm == null) missing.push(lang === "tr" ? "mesafe" : "distance");
      if (etaQuestion.speedKnots == null) missing.push(lang === "tr" ? "h\u0131z" : "speed");
      if (missing.length) return lang === "tr" ? `ETA hesab\u0131 i\u00e7in eksik bilgiler: ${missing.join(", ")}.` : `Missing ETA inputs: ${missing.join(", ")}.`;
      const result = etaFromDeparture(etaQuestion.departureIso, etaQuestion.distanceNm, etaQuestion.speedKnots, etaQuestion.delaysHours);
      return lang === "tr" ? `Tahmini var\u0131\u015f (ETA): ${result.etaIso}; toplam s\u00fcre ${result.passageHours.toFixed(2)} saat.` : `Estimated arrival (ETA): ${result.etaIso}; total time ${result.passageHours.toFixed(2)} hours.`;
    }

    const cpaQuestion = parseCpaQuestion(question);
    if (cpaQuestion) {
      const values = cpaQuestion.own && cpaQuestion.target ? [...Object.values(cpaQuestion.own), ...Object.values(cpaQuestion.target)] : [];
      if (values.length !== 8 || values.some(value => value == null)) return lang === "tr" ? "CPA/TCPA i\u00e7in kendi ve hedef geminin enlem, boylam, rota ve h\u0131z\u0131n\u0131 verin." : "Provide latitude, longitude, course, and speed for own ship and target.";
      const result = cpaTcpa(cpaQuestion.own, cpaQuestion.target);
      const tcpaMinutes = Number.isFinite(result.tcpaHours) ? result.tcpaHours * 60 : Infinity;
      return lang === "tr"
        ? `CPA ${result.cpaNm.toFixed(2)} deniz mili; TCPA ${Number.isFinite(tcpaMinutes) ? tcpaMinutes.toFixed(1) + " dakika" : "hesaplanam\u0131yor"}; durum: ${result.past ? "en yak\u0131n ge\u00e7i\u015f geride" : "yakla\u015fma s\u00fcr\u00fcyor"}. ARPA/AIS ve g\u00f6rsel kerterizlerle do\u011frulay\u0131n.`
        : `CPA ${result.cpaNm.toFixed(2)} NM; TCPA ${Number.isFinite(tcpaMinutes) ? tcpaMinutes.toFixed(1) + " minutes" : "unavailable"}; ${result.past ? "closest approach has passed" : "approach is ongoing"}. Verify with ARPA/AIS and visual bearings.`;
    }

    const ukc = parseUkcQuestion(question);
    if (ukc) {
      const missing = [];
      if (ukc.chartedDepth == null) missing.push(lang === "tr" ? "harita derinliği" : "charted depth");
      if (ukc.draft == null) missing.push(lang === "tr" ? "su çekimi" : "draft");
      if (ukc.mode === "clearance" && ukc.tideHeight == null) missing.push(lang === "tr" ? "gelgit yüksekliği" : "tide height");
      if (missing.length) return lang === "tr" ? `UKC hesabı için eksik bilgiler: ${missing.join(", ")}.` : `Missing UKC inputs: ${missing.join(", ")}.`;
      if (ukc.mode === "minimumTide") {
        const result = minimumTideForClearance(ukc.chartedDepth, ukc.draft, ukc.squat, ukc.safetyMargin);
        return lang === "tr" ? `Gerekli minimum gelgit yüksekliği: ${result.minimumTideHeight.toFixed(2)} m. Onaylı gelgit tahmini ve güncel iskandille doğrulayın.` : `Required minimum tide height: ${result.minimumTideHeight.toFixed(2)} m. Verify with approved predictions and current soundings.`;
      }
      const result = underKeelClearance(ukc.chartedDepth, ukc.tideHeight, ukc.draft, ukc.squat, ukc.safetyMargin);
      return lang === "tr" ? `Omurga altı açıklığı (UKC): ${result.clearance.toFixed(2)} m; durum: ${result.safe ? "hesaplanan sınıra göre uygun" : "yetersiz"}. Kaptan kararı, güncel iskandil ve şirket limitleri esastır.` : `Under-keel clearance: ${result.clearance.toFixed(2)} m; status: ${result.safe ? "within the entered limit" : "insufficient"}. Captain's judgment, current soundings, and company limits prevail.`;
    }

    const fuelQuestion = parseFuelQuestion(question);
    if (fuelQuestion) {
      const missing = [];
      if (fuelQuestion.distanceNm == null) missing.push(lang === "tr" ? "mesafe" : "distance");
      if (fuelQuestion.speedKnots == null) missing.push(lang === "tr" ? "hız" : "speed");
      if (fuelQuestion.consumptionPerHour == null) missing.push(lang === "tr" ? "saatlik tüketim" : "hourly consumption");
      if (missing.length) return lang === "tr" ? `Yakıt hesabı için eksik bilgiler: ${missing.join(", ")}.` : `Missing fuel inputs: ${missing.join(", ")}.`;
      const result = passageFuel(fuelQuestion.distanceNm, fuelQuestion.speedKnots, fuelQuestion.consumptionPerHour, fuelQuestion.reservePercent);
      return lang === "tr" ? `Tahmini geçiş süresi ${result.hours.toFixed(2)} saat; rezerv dâhil yakıt ${result.totalFuel.toFixed(2)} litre.` : `Estimated passage time ${result.hours.toFixed(2)} hours; fuel including reserve ${result.totalFuel.toFixed(2)} litres.`;
    }

    const beaufort = parseBeaufortQuestion(question);
    if (beaufort) {
      if (beaufort.windSpeedKnots == null) return lang === "tr" ? "Beaufort hesabı için rüzgâr hızını knot olarak verin." : "Provide wind speed in knots for the Beaufort calculation.";
      const force = beaufortForce(beaufort.windSpeedKnots);
      return lang === "tr" ? `${beaufort.windSpeedKnots.toFixed(1)} knot rüzgâr Beaufort ${force} kuvvetindedir.` : `${beaufort.windSpeedKnots.toFixed(1)} kn wind is Beaufort force ${force}.`;
    }

    const sdt = parseSpeedDistanceTimeQuestion(question);
    if (sdt) {
      const supplied = [sdt.distanceNm, sdt.speedKnots, sdt.hours].filter(value => value != null).length;
      if (supplied !== 2) {
        if (lang === "en") return "Provide two of distance, speed, and time so I can calculate the third.";
        if (lang === "de") return "Bitte zwei Werte aus Distanz, Geschwindigkeit und Zeit angeben.";
        return "Mesafe, hız ve süre bilgilerinden ikisini verin; üçüncüsünü hesaplayayım.";
      }
      const result = speedDistanceTime(sdt);
      if (sdt.solve === "distanceNm") {
        if (lang === "en") return `Distance run: ${result.distanceNm.toFixed(2)} NM.`;
        if (lang === "de") return `Zurückgelegte Distanz: ${result.distanceNm.toFixed(2)} sm.`;
        return `Kat edilen mesafe: ${result.distanceNm.toFixed(2)} deniz mili.`;
      }
      if (sdt.solve === "hours") {
        if (lang === "en") return `Passage time: ${result.hours.toFixed(2)} hours.`;
        if (lang === "de") return `Fahrtdauer: ${result.hours.toFixed(2)} Stunden.`;
        return `Seyir süresi: ${result.hours.toFixed(2)} saat.`;
      }
      if (lang === "en") return `Required average speed: ${result.speedKnots.toFixed(2)} kn.`;
      if (lang === "de") return `Erforderliche Durchschnittsgeschwindigkeit: ${result.speedKnots.toFixed(2)} kn.`;
      return `Gerekli ortalama hız: ${result.speedKnots.toFixed(2)} knot.`;
    }

    const current = parseCurrentQuestion(question);
    if (current) {
      const lang = languageCode(language);
      const missing = [];
      if (current.course == null) missing.push(lang === "tr" ? "rota" : lang === "de" ? "Kurs" : "course");
      if (current.speed == null) missing.push(lang === "tr" ? "hız" : lang === "de" ? "Geschwindigkeit" : "speed");
      if (current.set == null) missing.push(lang === "tr" ? "akıntı seti" : lang === "de" ? "Stromrichtung" : "current set");
      if (current.drift == null) missing.push(lang === "tr" ? "akıntı hızı (drift)" : lang === "de" ? "Stromgeschwindigkeit" : "current drift");
      if (missing.length) {
        if (lang === "en") return `I need: ${missing.join(", ")}.`;
        if (lang === "de") return `Benötigt werden: ${missing.join(", ")}.`;
        return `Akıntı hesabı için eksik bilgiler: ${missing.join(", ")}.`;
      }

      if (current.mode === "courseToSteer") {
        const result = courseToSteer(current.course, current.speed, current.set, current.drift);
        if (lang === "en") return `Course to steer: ${result.courseToSteer.toFixed(1)}°T; required speed through water ${result.speedThroughWater.toFixed(2)} kn. Decision support only—verify against onboard instruments and approved publications.`;
        if (lang === "de") return `Zu steuernder Kurs: ${result.courseToSteer.toFixed(1)}°T; erforderliche Fahrt durchs Wasser ${result.speedThroughWater.toFixed(2)} kn. Nur Entscheidungshilfe—mit Bordinstrumenten und zugelassenen Unterlagen prüfen.`;
        return `Tutulacak rota: ${result.courseToSteer.toFixed(1)}°T; gerekli suya göre hız ${result.speedThroughWater.toFixed(2)} knot. Yalnızca karar desteğidir; gemi cihazları ve onaylı yayınlarla doğrulayın.`;
      }

      const result = currentResult(current.course, current.speed, current.set, current.drift);
      if (lang === "en") return `Result over ground: course ${result.courseMadeGood.toFixed(1)}°T; speed ${result.speedMadeGood.toFixed(2)} kn. Decision support only—verify against onboard instruments and approved publications.`;
      if (lang === "de") return `Ergebnis über Grund: Kurs ${result.courseMadeGood.toFixed(1)}°T; Geschwindigkeit ${result.speedMadeGood.toFixed(2)} kn. Nur Entscheidungshilfe—mit Bordinstrumenten und zugelassenen Unterlagen prüfen.`;
      return `Yere göre sonuç: rota ${result.courseMadeGood.toFixed(1)}°T; hız ${result.speedMadeGood.toFixed(2)} knot. Yalnızca karar desteğidir; gemi cihazları ve onaylı yayınlarla doğrulayın.`;
    }

    const parsed = parseDrQuestion(question);
    if (!parsed) return null;

    if (parsed.ambiguous) {
      if (lang === "en") return "Course is ambiguous: write it as ‘course 125°T’. East/west describes longitude, not course.";
      if (lang === "de") return "Der Kurs ist mehrdeutig: Bitte als „Kurs 125°T“ angeben. Ost/West beschreibt die Länge, nicht den Kurs.";
      return "Rota belirsiz: Lütfen ‘rota 125°T’ şeklinde yazın. Doğu/batı boylamı belirtir; rota yönü değildir.";
    }

    const missing = [];
    if (parsed.lat == null) missing.push(lang === "tr" ? "enlem" : lang === "de" ? "Breite" : "latitude");
    if (parsed.lon == null) missing.push(lang === "tr" ? "boylam" : lang === "de" ? "Länge" : "longitude");
    if (parsed.course == null) missing.push(lang === "tr" ? "rota (°T)" : lang === "de" ? "Kurs (°T)" : "course (°T)");
    if (parsed.speed == null) missing.push(lang === "tr" ? "hız (knot)" : lang === "de" ? "Geschwindigkeit (kn)" : "speed (knots)");
    if (parsed.hours == null) missing.push(lang === "tr" ? "süre" : lang === "de" ? "Zeit" : "time");
    if (missing.length) {
      if (lang === "en") return `I need: ${missing.join(", ")}.`;
      if (lang === "de") return `Benötigt werden: ${missing.join(", ")}.`;
      return `Hesap için eksik bilgiler: ${missing.join(", ")}.`;
    }

    const distance = distanceRun(parsed.speed, parsed.hours);
    const destination = rhumbDestination(parsed.lat, parsed.lon, parsed.course, distance);
    const latText = formatCoordinate(destination.lat, "lat");
    const lonText = formatCoordinate(destination.lon, "lon");
    if (lang === "en") return `Rhumb-line DR result: distance ${distance.toFixed(2)} NM; position ${latText}, ${lonText}. Decision support only—verify with approved charts and independent fixes.`;
    if (lang === "de") return `Loxodromische Koppelortung: Distanz ${distance.toFixed(2)} sm; Position ${latText}, ${lonText}. Nur Entscheidungshilfe—mit zugelassenen Karten und unabhängigen Ortsbestimmungen prüfen.`;
    return `Kerteriz hattı (rhumb line) DR sonucu: mesafe ${distance.toFixed(2)} deniz mili; mevki ${latText}, ${lonText}. Yalnızca karar desteğidir; onaylı harita ve bağımsız mevkiyle doğrulayın.`;
  }

  global.SinbadNavigation = {
    R_NM,
    parseCoordinate,
    formatCoordinate,
    distanceRun,
    rhumbDestination,
    rhumbInverse,
    greatCircleInverse,
    greatCircleDestination,
    intermediateGreatCirclePoint,
    greatCircleWaypoints,
    compareOceanRoutes,
    crossTrackError,
    routeLegProgress,
    routeCorridorStatus,
    relativeToTrueBearing,
    trueToRelativeBearing,
    speedDistanceTime,
    compassToTrue,
    trueToCompass,
    magneticVariationAtDate,
    geographicRange,
    cpaTcpa,
    passageFuel,
    ruleOfTwelfths,
    underKeelClearance,
    minimumTideForClearance,
    secondaryPortTide,
    interpolateSpringNeapRate,
    setAndDriftFromFixes,
    correctedSextantAltitude,
    meridianLatitudeCandidates,
    celestialIntercept,
    celestialFix,
    distanceByVerticalAngle,
    interpolateCompassDeviation,
    timeDifferenceToLongitude,
    radarRelativeMotion,
    trialManeuver,
    planeSailing,
    middleLatitudeSailing,
    bearingFix,
    runningFix,
    estimatedPosition,
    driftedDatum,
    movingTargetIntercept,
    expandingSquarePattern,
    searchDatumUncertainty,
    positionUncertainty,
    traverse,
    applyLeeway,
    apparentWind,
    trueWindFromApparent,
    beaufortForce,
    waveEncounterPeriod,
    turnGeometry,
    turnAdvanceTransfer,
    stoppingPerformance,
    anchorScope,
    anchorSwingBounds,
    barrassSquat,
    maximumSpeedForSquat,
    etaFromDeparture,
    requiredSpeedProfile,
    rankCollisionRisks,
    routeSummary,
    waypointTurnPlan,
    wheelOverStatus,
    parseSpeedDistanceTimeQuestion,
    parseUkcQuestion,
    parseFuelQuestion,
    parseBeaufortQuestion,
    parseCompassQuestion,
    parseEtaQuestion,
    parseCpaQuestion,
    parseSquatQuestion,
    parseAnchorQuestion,
    parseStoppingQuestion,
    parseTurnQuestion,
    parseGeographicRangeQuestion,
    parseVariationQuestion,
    parseRadarRelativeQuestion,
    parseTwelfthsQuestion,
    parseSecondaryPortQuestion,
    parseSextantCorrectionQuestion,
    parseMeridianLatitudeQuestion,
    parseCelestialInterceptQuestion,
    parseVerticalAngleDistanceQuestion,
    parseLongitudeTimeQuestion,
    parseBearingConversionQuestion,
    parseOceanRouteQuestion,
    parsePlaneSailingQuestion,
    parseMiddleLatitudeQuestion,
    parseLeewayQuestion,
    parseWindTriangleQuestion,
    parseTraverseQuestion,
    currentResult,
    courseToSteer,
    parseCurrentQuestion,
    parseDrQuestion,
    answer
  };
})(typeof window !== "undefined" ? window : globalThis);
