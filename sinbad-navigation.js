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

  function crossTrackError(startLat, startLon, endLat, endLon, vesselLat, vesselLon) {
    const route = greatCircleInverse(startLat, startLon, endLat, endLon);
    const vessel = greatCircleInverse(startLat, startLon, vesselLat, vesselLon);
    const delta13 = vessel.distanceNm / R_NM;
    const angle = toRad(vessel.initialCourse - route.initialCourse);
    const crossTrackNm = Math.asin(Math.sin(delta13) * Math.sin(angle)) * R_NM;
    const alongTrackNm = Math.acos(Math.min(1, Math.max(-1, Math.cos(delta13) / Math.cos(crossTrackNm / R_NM)))) * R_NM;
    return { crossTrackNm, alongTrackNm };
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
    crossTrackError,
    speedDistanceTime,
    compassToTrue,
    trueToCompass,
    cpaTcpa,
    passageFuel,
    ruleOfTwelfths,
    underKeelClearance,
    correctedSextantAltitude,
    meridianLatitudeCandidates,
    timeDifferenceToLongitude,
    radarRelativeMotion,
    trialManeuver,
    parseSpeedDistanceTimeQuestion,
    currentResult,
    courseToSteer,
    parseCurrentQuestion,
    parseDrQuestion,
    answer
  };
})(typeof window !== "undefined" ? window : globalThis);
