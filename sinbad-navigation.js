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
    greatCircleInverse,
    currentResult,
    courseToSteer,
    parseDrQuestion,
    answer
  };
})(typeof window !== "undefined" ? window : globalThis);
