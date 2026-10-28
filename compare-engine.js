/* =====================================================================
   compare-engine.js — Dreamzland Chennai
   Pure calculation logic for the property comparison tool.
   No DOM, no network: it takes property data in and returns numbers out,
   so it can be tested on its own and reused by the page and the AI step.

   Browser:  <script src="compare-engine.js"></script>  ->  window.CompareEngine
   Node:     const E = require('./compare-engine.js');
   ===================================================================== */
(function (root, factory) {
  if (typeof module === 'object' && module.exports) module.exports = factory();
  else root.CompareEngine = factory();
}(typeof self !== 'undefined' ? self : this, function () {
  'use strict';

  /* ---------- Option lists (single source of truth for the forms + scoring) ---------- */
  const AMENITIES = [
    { key: 'gym', label: 'Gym', icon: 'fa-dumbbell' },
    { key: 'pool', label: 'Swimming Pool', icon: 'fa-swimming-pool' },
    { key: 'clubhouse', label: 'Clubhouse', icon: 'fa-warehouse' },
    { key: 'kidsPlay', label: 'Kids Play Area', icon: 'fa-child' },
    { key: 'garden', label: 'Garden/Park', icon: 'fa-tree' },
    { key: 'banquet', label: 'Banquet Hall', icon: 'fa-utensils' },
    { key: 'coworking', label: 'Coworking Space', icon: 'fa-laptop' },
    { key: 'seniorCitizen', label: 'Senior Citizen Area', icon: 'fa-users' },
    { key: 'sports', label: 'Sports Courts', icon: 'fa-basketball-ball' },
    { key: 'security', label: '24x7 Security', icon: 'fa-shield-alt' },
    { key: 'parking', label: 'Covered Parking', icon: 'fa-car' },
    { key: 'evCharging', label: 'EV Charging', icon: 'fa-bolt' },
    { key: 'jogging', label: 'Jogging Track', icon: 'fa-running' },
    { key: 'theatre', label: 'Mini Theatre', icon: 'fa-film' }
  ];

  const POSITIVE_FACTORS = [
    { key: 'metro', label: 'Near Metro Station' },
    { key: 'railway', label: 'Near Railway Station' },
    { key: 'highway', label: 'Near Highway' },
    { key: 'airport', label: 'Near Airport' },
    { key: 'business', label: 'Near Business District' },
    { key: 'school', label: 'Schools Nearby' },
    { key: 'hospital', label: 'Hospitals Nearby' },
    { key: 'mall', label: 'Malls Nearby' },
    { key: 'market', label: 'Market Nearby' },
    { key: 'park', label: 'Park/Green Area' },
    { key: 'seaview', label: 'Sea/Green View' }
  ];

  const NEGATIVE_FACTORS = [
    { key: 'crematorium', label: 'Crematorium Nearby' },
    { key: 'graveyard', label: 'Graveyard Nearby' },
    { key: 'slum', label: 'Slum Cluster Nearby' },
    { key: 'garbage', label: 'Garbage Dump Nearby' },
    { key: 'nallah', label: 'Nallah/Nullah Nearby' },
    { key: 'sewage', label: 'Sewage Treatment Plant' },
    { key: 'industrial', label: 'Industrial Pollution' },
    { key: 'htwires', label: 'High-Tension Wires' },
    { key: 'railwayTrack', label: 'Railway Track Too Close' },
    { key: 'highwayNoise', label: 'Highway Noise' },
    { key: 'waterlogging', label: 'Waterlogging Prone' },
    { key: 'narrowRoad', label: 'Very Narrow Access Road' },
    { key: 'traffic', label: 'Traffic Bottlenecks' },
    { key: 'bars', label: 'Bars/Nightclubs Nearby' },
    { key: 'illegal', label: 'Illegal Construction Nearby' },
    { key: 'poorConnectivity', label: 'Poor Last-Mile Connectivity' }
  ];

  const INFRASTRUCTURE = [
    { key: 'upcomingMetro', label: 'Upcoming Metro' },
    { key: 'newAirport', label: 'New Airport' },
    { key: 'newHighway', label: 'New Highway' },
    { key: 'businessPark', label: 'New Business Park' },
    { key: 'sez', label: 'SEZ/IT Park' },
    { key: 'socialInfra', label: 'Social Infrastructure' }
  ];

  // Which factor keys feed which score (kept here so the lists above stay readable)
  const LIVABILITY_POSITIVE = ['school', 'hospital', 'park', 'mall', 'market'];
  const LIVABILITY_NEGATIVE = ['highwayNoise', 'railwayTrack', 'industrial', 'waterlogging', 'narrowRoad', 'traffic'];
  const APPRECIATION_POSITIVE = ['metro', 'business', 'highway'];

  const ARRAY_KEYS = {
    amenities: new Set(AMENITIES.map(x => x.key)),
    positiveFactors: new Set(POSITIVE_FACTORS.map(x => x.key)),
    negativeFactors: new Set(NEGATIVE_FACTORS.map(x => x.key)),
    infrastructure: new Set(INFRASTRUCTURE.map(x => x.key))
  };

  /* ---------- Defaults ----------
     Tamil Nadu: stamp duty 7%. Registration fee is shown as 4% by the sources
     checked in Oct 2026 but one of them also says 1%, so it is an editable setting.
     GST on apartments: 5% while under construction, 0% once the completion
     certificate is received. Always confirm current rates before relying on them. */
  const DEFAULT_SETTINGS = Object.freeze({
    stampDutyPct: 7,
    registrationPct: 4,
    gstUnderConstructionPct: 5,
    gstReadyPct: 0
  });

  /* ---------- Small helpers ---------- */
  const rank = { Low: 1, Medium: 2, High: 3 };
  const clamp = (v, lo, hi) => Math.max(lo, Math.min(hi, v));

  // Any messy input ("8,500,000", "", null, -5, "abc") -> a safe number >= 0
  function num(v) {
    const n = typeof v === 'number' ? v : parseFloat(String(v == null ? '' : v).replace(/,/g, ''));
    return Number.isFinite(n) && n > 0 ? n : 0;
  }

  function resolveSettings(s) {
    const out = {};
    for (const k of Object.keys(DEFAULT_SETTINGS)) {
      const v = s && s[k] !== '' && s[k] != null ? Number(s[k]) : NaN;
      out[k] = Number.isFinite(v) ? clamp(v, 0, 30) : DEFAULT_SETTINGS[k];
    }
    return out;
  }

  function monthsFromNow(dateStr, now) {
    if (!dateStr) return null;
    const t = new Date(dateStr);
    if (Number.isNaN(t.getTime())) return null;
    const n = now || new Date();
    return (t.getFullYear() - n.getFullYear()) * 12 + (t.getMonth() - n.getMonth());
  }

  function formatINR(n) {
    n = Number(n);
    if (!Number.isFinite(n) || n <= 0) return '-';
    if (n >= 1e7) return (n / 1e7).toFixed(2) + ' Cr';
    if (n >= 1e5) return (n / 1e5).toFixed(2) + ' L';
    if (n >= 1e3) return (n / 1e3).toFixed(1) + ' K';
    return String(Math.round(n));
  }

  /* ---------- Property shape ---------- */
  function emptyProperty(id) {
    return {
      id: id, name: 'Project ' + id, developer: '', location: '', city: '', configuration: '2 BHK',
      constructionStatus: 'under_construction',          // 'under_construction' | 'ready'
      carpetArea: '', saleableArea: '', floorNumber: '', totalFloors: '',
      price: '', floorRise: '', parkingCost: '', clubhouseCharges: '',
      guidelineValue: '',                                  // optional: duty is charged on the higher of this and the agreement value
      stampDuty: '', registration: '',                     // optional manual overrides
      maintenanceDeposit: '', corpus: '', legalCharges: '',
      possessionDate: '', reraNumber: '',
      developerTrackRecord: 'average',                     // 'strong' | 'average' | 'risky'
      developerType: 'regional',                           // 'national' | 'regional' | 'local'
      developerProjects: '', developerLitigation: false,
      amenities: [], positiveFactors: [], negativeFactors: [], infrastructure: [],
      expectedRent: '',
      listingId: ''                                        // set when prefilled from a Supabase listing
    };
  }

  const ENUMS = {
    constructionStatus: ['under_construction', 'ready'],
    developerTrackRecord: ['strong', 'average', 'risky'],
    developerType: ['national', 'regional', 'local']
  };

  // Makes any input (form state, saved localStorage, a prefill) safe to score:
  // unknown keys dropped, bad enum values reset, arrays limited to known keys, text capped.
  function normalizeProperty(raw, id) {
    const base = emptyProperty(id);
    const src = raw && typeof raw === 'object' ? raw : {};
    const out = {};
    for (const k of Object.keys(base)) {
      const v = src[k];
      if (Array.isArray(base[k])) {
        out[k] = Array.isArray(v) ? Array.from(new Set(v.filter(x => ARRAY_KEYS[k].has(x)))) : [];
      } else if (typeof base[k] === 'boolean') {
        out[k] = v === true;
      } else if (v === undefined || v === null) {
        out[k] = base[k];
      } else {
        out[k] = String(v).slice(0, 200);
      }
    }
    for (const k of Object.keys(ENUMS)) if (!ENUMS[k].includes(out[k])) out[k] = base[k];
    out.id = id;
    if (!out.name.trim()) out.name = base.name;
    return out;
  }

  // Why a property cannot be scored yet (empty list = fine)
  function missingFields(p) {
    const missing = [];
    if (!num(p.price)) missing.push('base price');
    if (!num(p.carpetArea) && !num(p.saleableArea)) missing.push('carpet or saleable area');
    return missing;
  }
  function isAnalyzable(p) { return missingFields(p).length === 0; }

  /* ---------- Costs ---------- */
  function computeCosts(p, settings) {
    const s = resolveSettings(settings);
    const price = num(p.price), floorRise = num(p.floorRise);
    const parking = num(p.parkingCost), clubhouse = num(p.clubhouseCharges);
    const maintenance = num(p.maintenanceDeposit), corpus = num(p.corpus), legal = num(p.legalCharges);

    // The builder's agreement value. GST and stamp duty are charged on this whole amount,
    // not just the base price (floor rise, parking and club charges are part of the deal).
    const agreementValue = price + floorRise + parking + clubhouse;
    const dutyBase = Math.max(agreementValue, num(p.guidelineValue));

    const gstRate = p.constructionStatus === 'ready' ? s.gstReadyPct : s.gstUnderConstructionPct;
    const gst = agreementValue * gstRate / 100;

    const stampDutyManual = num(p.stampDuty), registrationManual = num(p.registration);
    const stampDuty = stampDutyManual || dutyBase * s.stampDutyPct / 100;
    const registration = registrationManual || dutyBase * s.registrationPct / 100;

    // Everything beyond price + floor rise + parking (used by the "hidden costs" checks)
    const hiddenTotal = gst + stampDuty + registration + maintenance + corpus + legal + clubhouse;
    const allInCost = price + floorRise + parking + hiddenTotal;

    return {
      price, floorRise, parking, clubhouse, maintenance, corpus, legal,
      agreementValue, dutyBase, gstRate, gst, stampDuty, registration,
      stampDutyEstimated: !stampDutyManual, registrationEstimated: !registrationManual,
      hiddenTotal, allInCost
    };
  }

  /* ---------- Scoring (weights unchanged from the original PropCompare) ---------- */
  function scoreProperty(p, costs, range, now) {
    const warnings = [];

    // Area + loading
    const carpetIn = num(p.carpetArea), saleIn = num(p.saleableArea);
    const carpet = carpetIn || saleIn;
    let loading = 0, loadingKnown = false;
    if (carpetIn && saleIn) {
      if (saleIn < carpetIn) warnings.push('Saleable area is smaller than carpet area. Please check the figures.');
      else { loading = (saleIn - carpetIn) / saleIn * 100; loadingKnown = true; }
    } else {
      warnings.push('Only one area figure was entered, so loading cannot be calculated.');
    }
    const areaBasis = carpetIn ? 'carpet' : 'saleable';
    const pricePerSqft = costs.allInCost / carpet;

    // Price (20): cheaper all-in cost scores higher, relative to the others being compared
    let priceScore = 12;
    if (range.max > range.min) {
      priceScore = Math.max(5, 20 - ((costs.allInCost - range.min) / (range.max - range.min)) * 15);
    }

    // Location (20)
    const locationScore = clamp(10 + p.positiveFactors.length * 1.5 - p.negativeFactors.length * 2.5, 0, 20);

    // Developer (15)
    const projects = parseInt(p.developerProjects, 10) || 0;
    let developerScore = 8;
    if (p.developerTrackRecord === 'strong') developerScore += 5;
    if (p.developerTrackRecord === 'risky') developerScore -= 5;
    if (p.developerType === 'national') developerScore += 2;
    if (p.developerType === 'local') developerScore -= 2;
    if (p.developerLitigation) developerScore -= 4;
    if (projects > 20) developerScore += 2;
    else if (projects > 10) developerScore += 1;
    else if (projects > 0 && projects < 3) developerScore -= 2;
    developerScore = clamp(developerScore, 0, 15);

    // RERA / approvals / timeline (15). A passed possession date only counts as a delay
    // for under-construction projects; a ready-to-move flat is supposed to be past it.
    const underConstruction = p.constructionStatus !== 'ready';
    const months = monthsFromNow(p.possessionDate, now);
    const delayed = underConstruction && months !== null && months < 0;
    let reraScore = 8;
    if (p.reraNumber.trim()) reraScore += 4;
    if (underConstruction && months !== null) {
      if (months < 0) reraScore -= 6;
      else if (months < 6) reraScore += 2;
      else if (months > 36) reraScore -= 2;
    }
    if (p.developerTrackRecord === 'risky') reraScore -= 3;
    reraScore = clamp(reraScore, 0, 15);
    if (underConstruction && months === null) warnings.push('Possession date not entered.');

    // Livability (10)
    let livabilityScore = 5 + p.amenities.length * 0.4;
    livabilityScore += p.positiveFactors.filter(f => LIVABILITY_POSITIVE.includes(f)).length * 0.5;
    livabilityScore -= p.negativeFactors.filter(f => LIVABILITY_NEGATIVE.includes(f)).length * 0.8;
    if (loadingKnown && loading > 40) livabilityScore -= 1;
    if (loadingKnown && loading < 25) livabilityScore += 1;
    livabilityScore = clamp(livabilityScore, 0, 10);

    // Rental yield (10)
    const rent = num(p.expectedRent);
    const annualRent = rent * 12;
    const grossYield = costs.allInCost > 0 ? annualRent / costs.allInCost * 100 : 0;
    const yieldKnown = rent > 0;
    let yieldScore = 0;
    if (grossYield >= 4) yieldScore = 10;
    else if (grossYield >= 3) yieldScore = 8;
    else if (grossYield >= 2.5) yieldScore = 6;
    else if (grossYield >= 2) yieldScore = 4;
    else if (grossYield >= 1.5) yieldScore = 2;
    if (!yieldKnown) warnings.push('Expected rent not entered, so rental yield is scored as 0.');
    if (grossYield > 8) warnings.push('Rent looks very high for this price. Check it is the monthly rent, not annual.');

    // Appreciation (10)
    let appreciationScore = 5 + p.infrastructure.length * 1.2;
    appreciationScore += p.positiveFactors.filter(f => APPRECIATION_POSITIVE.includes(f)).length * 0.8;
    if (p.developerType === 'national') appreciationScore += 1;
    if (p.developerTrackRecord === 'strong') appreciationScore += 1;
    appreciationScore = clamp(appreciationScore, 0, 10);

    const totalScore = priceScore + locationScore + developerScore + reraScore + livabilityScore + yieldScore + appreciationScore;

    // Weighted views. The divisors are the maximum possible weighted sums (16.5 and 14.25),
    // so a perfect property scores exactly 100.
    const endUseRaw = priceScore * 0.25 + locationScore * 0.25 + developerScore * 0.15 + reraScore * 0.15 + livabilityScore * 0.20;
    const investRaw = priceScore * 0.20 + locationScore * 0.15 + developerScore * 0.15 + yieldScore * 0.20 + appreciationScore * 0.30;
    const endUseScore = clamp(Math.round(endUseRaw / 16.5 * 100), 0, 100);
    const investScore = clamp(Math.round(investRaw / 14.25 * 100), 0, 100);

    // Risk
    let riskLevel = 'Low';
    const riskFactors = [];
    const raise = lv => { if (rank[lv] > rank[riskLevel]) riskLevel = lv; };
    if (p.developerTrackRecord === 'risky') { raise('High'); riskFactors.push('Developer has a risky track record'); }
    if (p.developerLitigation) { raise('High'); riskFactors.push('Developer has ongoing litigation'); }
    if (p.negativeFactors.length >= 3) { raise('High'); riskFactors.push('Multiple negative location factors'); }
    if (!p.reraNumber.trim()) { raise('Medium'); riskFactors.push('No RERA number provided'); }
    if (delayed) { raise('High'); riskFactors.push('Possession date has already passed'); }
    if (loadingKnown && loading > 45) riskFactors.push('Very high loading (' + loading.toFixed(1) + '%)');
    if (p.developerType === 'local' && projects > 0 && projects < 3) riskFactors.push('New local builder with few completed projects');

    return Object.assign({}, p, {
      costs: costs,
      allInCost: costs.allInCost, hiddenTotal: costs.hiddenTotal,
      carpetUsed: carpet, areaBasis: areaBasis,
      loading: loading, loadingKnown: loadingKnown, pricePerSqft: pricePerSqft,
      annualRent: annualRent, grossYield: grossYield, yieldKnown: yieldKnown,
      monthsToPossession: months, delayed: delayed,
      scores: {
        price: priceScore, location: locationScore, developer: developerScore, rera: reraScore,
        livability: livabilityScore, yield: yieldScore, appreciation: appreciationScore
      },
      totalScore: totalScore, endUseScore: endUseScore, investScore: investScore,
      riskLevel: riskLevel, riskFactors: riskFactors, dataWarnings: warnings
    });
  }

  /* ---------- Main entry ---------- */
  // properties: array of up to 3 form objects. Returns scored results, the ones that
  // could not be scored yet (and why), and a summary of the winners.
  function analyze(properties, settingsIn, now) {
    const settings = resolveSettings(settingsIn);
    const list = (Array.isArray(properties) ? properties : []).slice(0, 3);
    const ready = [], skipped = [];

    list.forEach((raw, i) => {
      const p = normalizeProperty(raw, String.fromCharCode(65 + i));
      const missing = missingFields(p);
      if (missing.length) skipped.push({ id: p.id, name: p.name, missing: missing });
      else ready.push({ p: p, costs: computeCosts(p, settings) });
    });

    let results = [];
    if (ready.length) {
      const all = ready.map(r => r.costs.allInCost);
      const range = { min: Math.min.apply(null, all), max: Math.max.apply(null, all) };
      results = ready.map(r => scoreProperty(r.p, r.costs, range, now || new Date()));
    }
    return { settings: settings, results: results, skipped: skipped, summary: summarize(results) };
  }

  function summarize(results) {
    if (!results.length) return null;
    // Ties keep the earlier property (the new one must be strictly better to replace it)
    const pick = (key, higher) => results.reduce((a, b) => ((higher ? b[key] > a[key] : b[key] < a[key]) ? b : a));
    const brief = (r, score) => ({ id: r.id, name: r.name, score: score });

    const overall = pick('totalScore', true), endUse = pick('endUseScore', true);
    const invest = pick('investScore', true), value = pick('pricePerSqft', false);

    // Only name a "most risky" project if something is actually risky
    const worstRank = Math.max.apply(null, results.map(r => rank[r.riskLevel]));
    let mostRisky = null;
    if (worstRank > 1) {
      const r = results
        .filter(x => rank[x.riskLevel] === worstRank)
        .sort((a, b) => b.riskFactors.length - a.riskFactors.length || a.totalScore - b.totalScore)[0];
      mostRisky = { id: r.id, name: r.name, riskLevel: r.riskLevel, reason: r.riskFactors[0] || '' };
    }

    const totals = results.map(r => r.totalScore).sort((a, b) => b - a);
    return {
      count: results.length,
      bestOverall: brief(overall, overall.totalScore),
      bestEndUse: brief(endUse, endUse.endUseScore),
      bestInvest: brief(invest, invest.investScore),
      bestValue: brief(value, value.pricePerSqft),
      mostRisky: mostRisky,
      overallGap: totals.length > 1 ? totals[0] - totals[1] : null   // under ~3 points = too close to call
    };
  }

  return {
    AMENITIES: AMENITIES, POSITIVE_FACTORS: POSITIVE_FACTORS,
    NEGATIVE_FACTORS: NEGATIVE_FACTORS, INFRASTRUCTURE: INFRASTRUCTURE,
    DEFAULT_SETTINGS: DEFAULT_SETTINGS,
    emptyProperty: emptyProperty, normalizeProperty: normalizeProperty,
    missingFields: missingFields, isAnalyzable: isAnalyzable,
    computeCosts: computeCosts, analyze: analyze, summarize: summarize,
    resolveSettings: resolveSettings, monthsFromNow: monthsFromNow, formatINR: formatINR
  };
}));
