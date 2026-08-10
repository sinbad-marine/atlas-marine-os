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
    const match = source.match(new RegExp("(\\d{1,3})(?:\\s*(?:°|derece|deg))?\\s*(\\d{1,2}(?:\\.\\d+)?)?\\s*(?:['′]|dakika|min)?\\s*(\\d{1,2}(?:\\.\\d+)?)?\\s*(?:[\\\"″]|saniye|sec)?\\s*" + direction + "(?=\\s|$|[.,;:])", "i"));
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
    const match = text.match(new RegExp("(?:" + labels + ")\\s*(?:is|=|:)?\\s*(\\d+(?:\\.\\d+)?)\\s*(?:" + unitPattern + ")?", "i"));
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
    if (!/\b(dr|dead reckoning|parakete|mevki|pozisyon)\b/.test(text)) return null;

    const lat = parseCoordinate(text, "lat");
    const lon = parseCoordinate(text, "lon");
    const speedMatch = text.match(/(\d+(?:\.\d+)?)\s*(?:knot|knots|kt|kts|deniz mili\s*(?:\/|per|saatte)|nm\s*\/\s*h)/);
    const hourMatch = text.match(/(\d+(?:\.\d+)?)\s*(?:saat|hour|hours|stunde|stunden)/);
    const minuteMatches = [...text.matchAll(/(\d+(?:\.\d+)?)\s*(?:dakika|minute|minutes|minuten|min)\b/g)];
    // Coordinate minutes normally appear before the voyage duration. Choosing
    // the final minute expression prevents "43° 15 dakika N" becoming 15 min.
    const minuteMatch = minuteMatches.at(-1) || null;
    const coursePatterns = [
      /(?:rota|course|kurs|hakiki rota)\s*(?:is|=|:)?\s*(\d{1,3}(?:\.\d+)?)\s*(?:°|derece|deg)?/,
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
    const sdt = parseSpeedDistanceTimeQuestion(question);
    if (sdt) {
      const lang = languageCode(language);
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
    const lang = languageCode(language);

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
    currentResult,
    courseToSteer,
    parseCurrentQuestion,
    parseDrQuestion,
    answer
  };
})(typeof window !== "undefined" ? window : globalThis);
