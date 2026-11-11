/* =====================================================================
   compare.js — Dreamzland Chennai
   The page logic for compare.html: property forms, cost assumptions,
   saved progress, optional import from your Supabase listings, and the
   first results summary. The maths lives in compare-engine.js.

   Needs these loaded first:  config.js  ->  compare-engine.js  ->  compare.js
   ===================================================================== */
(function () {
  'use strict';

  var $ = function (id) { return document.getElementById(id); };
  var E = window.CompareEngine;

  var STORAGE_KEY = 'dz_compare_v1';
  var MAX_PROPS = 3;
  var LETTERS = ['A', 'B', 'C'];

  // Every piece of user text is escaped before it goes into the page
  function esc(s) {
    return String(s == null ? '' : s).replace(/[&<>"']/g, function (c) {
      return { '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c];
    });
  }
  function inr(n) { return Number.isFinite(n) && n > 0 ? '₹' + Math.round(n).toLocaleString('en-IN') : '-'; }

  /* ---------- Toast ---------- */
  var toastTimer;
  function toast(msg) {
    var el = $('toast');
    el.textContent = msg;
    el.classList.add('show');
    clearTimeout(toastTimer);
    toastTimer = setTimeout(function () { el.classList.remove('show'); }, 4200);
  }

  /* ---------- Site chrome (logo, WhatsApp, mobile menu) ---------- */
  (function chrome() {
    if (typeof LOGO_URL !== 'undefined' && LOGO_URL) {
      var l = $('brandLogo'); l.src = LOGO_URL; l.classList.add('loaded');
    }
    if (typeof WHATSAPP_NUMBER !== 'undefined') $('waFloat').href = 'https://wa.me/' + WHATSAPP_NUMBER;
    var t = $('navToggle'), nav = $('navLinks');
    t.addEventListener('click', function () {
      var open = nav.classList.toggle('open');
      t.classList.toggle('open', open);
      t.setAttribute('aria-expanded', open);
    });
  })();

  // If the engine file is missing the page cannot work: say so clearly instead of failing silently
  if (!E) {
    $('propertiesGrid').innerHTML = '<div class="auto-note">The comparison engine file (compare-engine.js) did not load. ' +
      'Make sure it is uploaded next to compare.html, then refresh.</div>';
    return;
  }

  /* ---------- State + saved progress ---------- */
  function fresh() {
    return {
      properties: [E.emptyProperty('A'), E.emptyProperty('B')],
      settings: Object.assign({}, E.DEFAULT_SETTINGS)
    };
  }
  function load() {
    try {
      var raw = localStorage.getItem(STORAGE_KEY);
      if (!raw) return null;
      var d = JSON.parse(raw);
      var props = (Array.isArray(d.properties) ? d.properties : []).slice(0, MAX_PROPS)
        .map(function (p, i) { return E.normalizeProperty(p, LETTERS[i]); });
      if (!props.length) return null;
      return { properties: props, settings: E.resolveSettings(d.settings) };
    } catch (e) { return null; }
  }
  var state = load() || fresh();

  var saveTimer;
  function save() { try { localStorage.setItem(STORAGE_KEY, JSON.stringify(state)); } catch (e) { /* private mode: fine */ } }
  function scheduleSave() { clearTimeout(saveTimer); saveTimer = setTimeout(save, 300); }
  window.addEventListener('pagehide', save);

  var listings = []; // Danav's published listings from Supabase (optional)

  /* ---------- Form building blocks ---------- */
  function fid(i, name) { return 'p' + i + '_' + name; }

  function inp(i, p, name, label, o) {
    o = o || {};
    var type = o.type || 'number';
    var attrs = type === 'number' ? ' min="0" step="any" inputmode="decimal"' : (type === 'text' ? ' maxlength="120"' : '');
    return '<div class="form-group"><label class="form-label" for="' + fid(i, name) + '">' + label +
      (o.small ? ' <small>' + o.small + '</small>' : '') + '</label>' +
      '<input id="' + fid(i, name) + '" class="form-input" type="' + type + '"' + attrs +
      ' data-i="' + i + '" data-field="' + name + '" value="' + esc(p[name]) + '" placeholder="' + esc(o.ph || '') + '"></div>';
  }

  function sel(i, p, name, label, opts) {
    var cur = typeof p[name] === 'boolean' ? String(p[name]) : p[name];
    return '<div class="form-group"><label class="form-label" for="' + fid(i, name) + '">' + label + '</label>' +
      '<select id="' + fid(i, name) + '" class="form-select" data-i="' + i + '" data-field="' + name + '">' +
      opts.map(function (o) {
        return '<option value="' + esc(o[0]) + '"' + (o[0] === cur ? ' selected' : '') + '>' + esc(o[1]) + '</option>';
      }).join('') + '</select></div>';
  }

  function checks(i, p, arr, list, negative) {
    return '<div class="checkbox-grid">' + list.map(function (f) {
      return '<label class="checkbox-item' + (negative ? ' negative' : '') + '">' +
        '<input type="checkbox" data-i="' + i + '" data-arr="' + arr + '" data-key="' + f.key + '"' +
        (p[arr].indexOf(f.key) > -1 ? ' checked' : '') + '>' +
        '<span>' + (f.icon ? '<i class="fas ' + f.icon + '"></i> ' : '') + esc(f.label) + '</span></label>';
    }).join('') + '</div>';
  }

  var CONFIGS = ['1 RK', '1 BHK', '1.5 BHK', '2 BHK', '2.5 BHK', '3 BHK', '3.5 BHK', '4 BHK', '4+ BHK'].map(function (c) { return [c, c]; });

  function cardHtml(p, i) {
    var importRow = listings.length
      ? '<div class="form-group import-row"><label class="form-label" for="imp_' + i + '">Start from one of Danav\'s listings <small>(optional)</small></label>' +
        '<select id="imp_' + i + '" class="form-select" data-import="' + i + '"><option value="">Choose a listing…</option>' +
        listings.map(function (l) {
          return '<option value="' + esc(l.id) + '">' + esc(l.name) + (l.location ? ' — ' + esc(l.location) : '') + '</option>';
        }).join('') + '</select></div>'
      : '';

    return '' +
      '<div class="prop-header">' +
        '<div class="prop-title"><div class="prop-letter ' + p.id.toLowerCase() + '">' + p.id + '</div>' +
          '<input type="text" class="prop-name-input" maxlength="80" aria-label="Project ' + p.id + ' name" data-i="' + i + '" data-field="name" value="' + esc(p.name) + '" placeholder="Project name"></div>' +
        '<button type="button" class="prop-btn danger" data-action="remove" data-i="' + i + '" title="Remove this project" aria-label="Remove project ' + p.id + '"><i class="fas fa-trash"></i></button>' +
      '</div>' +
      '<div class="prop-body">' +
        importRow +
        '<div class="section-title"><i class="fas fa-info-circle"></i> Basic information</div>' +
        inp(i, p, 'developer', 'Developer name', { type: 'text', ph: 'e.g. the builder\'s name' }) +
        '<div class="input-row">' + inp(i, p, 'location', 'Location / area', { type: 'text', ph: 'e.g. Adyar' }) +
          inp(i, p, 'city', 'City', { type: 'text', ph: 'e.g. Chennai' }) + '</div>' +
        '<div class="input-row">' + sel(i, p, 'configuration', 'Configuration', CONFIGS) +
          sel(i, p, 'constructionStatus', 'Construction status', [['under_construction', 'Under construction'], ['ready', 'Ready to move (completion certificate received)']]) + '</div>' +
        inp(i, p, 'reraNumber', 'RERA number', { type: 'text', ph: 'Registration number from the TNRERA website' }) +

        '<div class="section-title"><i class="fas fa-ruler-combined"></i> Area details</div>' +
        '<div class="input-row-3">' + inp(i, p, 'carpetArea', 'Carpet area <small>(sq ft)</small>', { ph: '850' }) +
          inp(i, p, 'saleableArea', 'Saleable area <small>(sq ft)</small>', { ph: '1200' }) +
          '<div class="form-group"><label class="form-label" for="' + fid(i, 'floorNumber') + '">Floor / total floors</label>' +
            '<div style="display:flex;gap:6px;">' +
              '<input id="' + fid(i, 'floorNumber') + '" class="form-input" type="number" min="0" inputmode="numeric" style="flex:1" data-i="' + i + '" data-field="floorNumber" value="' + esc(p.floorNumber) + '" placeholder="Floor">' +
              '<input class="form-input" type="number" min="0" inputmode="numeric" style="flex:1" aria-label="Total floors" data-i="' + i + '" data-field="totalFloors" value="' + esc(p.totalFloors) + '" placeholder="Total">' +
            '</div></div></div>' +

        '<div class="section-title"><i class="fas fa-rupee-sign"></i> Pricing details</div>' +
        '<div class="input-row-3">' + inp(i, p, 'price', 'Base price <small>(₹)</small>', { ph: '8500000' }) +
          inp(i, p, 'floorRise', 'Floor rise <small>(₹)</small>', { ph: '200000' }) +
          inp(i, p, 'parkingCost', 'Parking <small>(₹)</small>', { ph: '300000' }) + '</div>' +
        '<div class="input-row-3">' + inp(i, p, 'clubhouseCharges', 'Clubhouse <small>(₹)</small>', { ph: '150000' }) +
          inp(i, p, 'maintenanceDeposit', 'Maintenance deposit <small>(₹)</small>', { ph: '100000' }) +
          inp(i, p, 'corpus', 'Corpus fund <small>(₹)</small>', { ph: '50000' }) + '</div>' +
        '<div class="input-row">' + inp(i, p, 'legalCharges', 'Legal charges <small>(₹)</small>', { ph: '25000' }) +
          inp(i, p, 'guidelineValue', 'Guideline value <small>(₹, optional)</small>', { ph: 'From the TN guideline value' }) + '</div>' +
        '<div class="input-row">' + inp(i, p, 'stampDuty', 'Stamp duty <small>(₹, blank = estimate)</small>', { ph: 'Estimated for you' }) +
          inp(i, p, 'registration', 'Registration <small>(₹, blank = estimate)</small>', { ph: 'Estimated for you' }) + '</div>' +
        '<div class="auto-note" data-role="cost-note" data-i="' + i + '"></div>' +

        '<div class="section-title"><i class="fas fa-calendar-alt"></i> Timeline</div>' +
        inp(i, p, 'possessionDate', 'Possession date', { type: 'date' }) +

        '<div class="section-title"><i class="fas fa-hard-hat"></i> Developer details</div>' +
        '<div class="input-row">' +
          sel(i, p, 'developerTrackRecord', 'Track record', [['strong', 'Strong (on-time delivery)'], ['average', 'Average (some delays)'], ['risky', 'Risky (major delays / litigation)']]) +
          sel(i, p, 'developerType', 'Developer type', [['national', 'National brand'], ['regional', 'Regional player'], ['local', 'Local builder']]) + '</div>' +
        '<div class="input-row">' + inp(i, p, 'developerProjects', 'Completed projects', { ph: '15' }) +
          sel(i, p, 'developerLitigation', 'Any litigation?', [['false', 'No known litigation'], ['true', 'Yes, litigation exists']]) + '</div>' +

        '<div class="section-title"><i class="fas fa-map-marker-alt"></i> Location factors</div>' +
        '<div class="form-label">Positive factors <small>(tick all that apply)</small></div>' +
        '<div style="margin-bottom:16px">' + checks(i, p, 'positiveFactors', E.POSITIVE_FACTORS, false) + '</div>' +
        '<div class="form-label" style="color:var(--danger)">Negative factors <small>(tick all that apply)</small></div>' +
        checks(i, p, 'negativeFactors', E.NEGATIVE_FACTORS, true) +

        '<div class="section-title"><i class="fas fa-swimming-pool"></i> Amenities</div>' +
        checks(i, p, 'amenities', E.AMENITIES, false) +

        '<div class="section-title"><i class="fas fa-road"></i> Upcoming infrastructure</div>' +
        checks(i, p, 'infrastructure', E.INFRASTRUCTURE, false) +

        '<div class="section-title"><i class="fas fa-hand-holding-usd"></i> Rental estimate</div>' +
        inp(i, p, 'expectedRent', 'Expected monthly rent <small>(₹)</small>', { ph: '35000' }) +
      '</div>';
  }

  /* ---------- Rendering ---------- */
  var grid = $('propertiesGrid');

  function renderGrid() {
    grid.innerHTML = '';
    state.properties.forEach(function (p, i) {
      var card = document.createElement('div');
      card.className = 'property-card';
      card.innerHTML = cardHtml(p, i);
      grid.appendChild(card);
    });
    if (state.properties.length < MAX_PROPS) {
      var add = document.createElement('div');
      add.className = 'add-property-card';
      add.setAttribute('role', 'button');
      add.tabIndex = 0;
      add.dataset.action = 'add';
      add.innerHTML = '<div class="add-icon"><i class="fas fa-plus"></i></div>' +
        '<h3>Add project ' + LETTERS[state.properties.length] + '</h3><p>Compare up to 3 properties</p>';
      grid.appendChild(add);
    }
    $('propCount').textContent = state.properties.length;
    state.properties.forEach(function (_, i) { updateCostNote(i); });
  }

  var SETTING_FIELDS = [
    ['stampDutyPct', 'Stamp duty (%)'],
    ['registrationPct', 'Registration fee (%)'],
    ['gstUnderConstructionPct', 'GST, under construction (%)']
  ];
  function renderSettings() {
    $('assumptionsGrid').innerHTML = SETTING_FIELDS.map(function (f) {
      return '<div class="form-group"><label class="form-label" for="set_' + f[0] + '">' + f[1] + '</label>' +
        '<input id="set_' + f[0] + '" class="form-input" type="number" min="0" max="30" step="any" inputmode="decimal" data-setting="' + f[0] + '" value="' + esc(state.settings[f[0]]) + '"></div>';
    }).join('');
  }

  function renderAll() { renderSettings(); renderGrid(); }

  // Live "what will this really cost" line under each project's pricing fields
  function updateCostNote(i) {
    var el = grid.querySelector('[data-role="cost-note"][data-i="' + i + '"]');
    if (!el || !state.properties[i]) return;
    var p = E.normalizeProperty(state.properties[i], LETTERS[i]);
    var c = E.computeCosts(p, state.settings);
    if (!c.price) { el.textContent = 'Enter the base price to see the estimated all-in cost.'; return; }
    var f = E.formatINR;
    var other = c.maintenance + c.corpus + c.legal;
    el.innerHTML = '<strong>Estimated all-in cost: ₹' + esc(f(c.allInCost)) + '</strong><br>' +
      'GST (' + c.gstRate + '%): ₹' + esc(f(c.gst)) +
      ' · Stamp duty' + (c.stampDutyEstimated ? ' (est.)' : '') + ': ₹' + esc(f(c.stampDuty)) +
      ' · Registration' + (c.registrationEstimated ? ' (est.)' : '') + ': ₹' + esc(f(c.registration)) +
      (other > 0 ? ' · Deposits &amp; other: ₹' + esc(f(other)) : '');
  }
  function updateAllCostNotes() { state.properties.forEach(function (_, i) { updateCostNote(i); }); }

  /* ---------- Editing ---------- */
  var KNOWN_FIELDS = E.emptyProperty('A');

  function onEdit(e) {
    var t = e.target;
    if (t.dataset.import !== undefined) {
      if (e.type === 'change') importListing(+t.dataset.import, t.value);
      return;
    }
    var i = t.dataset.i === undefined ? -1 : +t.dataset.i;
    var p = state.properties[i];
    if (!p) return;

    if (t.dataset.arr) {
      if (e.type !== 'change' || !Array.isArray(p[t.dataset.arr])) return;
      var arr = p[t.dataset.arr], at = arr.indexOf(t.dataset.key);
      if (t.checked && at === -1) arr.push(t.dataset.key);
      if (!t.checked && at > -1) arr.splice(at, 1);
    } else if (t.dataset.field && t.dataset.field in KNOWN_FIELDS) {
      var f = t.dataset.field;
      p[f] = f === 'developerLitigation' ? t.value === 'true' : t.value;
    } else {
      return;
    }
    updateCostNote(i);
    scheduleSave();
  }
  grid.addEventListener('input', onEdit);
  grid.addEventListener('change', onEdit);

  function relabel() {
    state.properties.forEach(function (p, i) {
      p.id = LETTERS[i];
      if (/^Project [ABC]$/.test(p.name)) p.name = 'Project ' + p.id;
    });
  }
  function hasData(p) { return !!(p.price || p.carpetArea || p.saleableArea || p.developer || p.location); }

  function addProperty() {
    if (state.properties.length >= MAX_PROPS) return;
    state.properties.push(E.emptyProperty(LETTERS[state.properties.length]));
    renderGrid(); save();
  }
  grid.addEventListener('click', function (e) {
    var btn = e.target.closest('[data-action]');
    if (!btn) return;
    if (btn.dataset.action === 'add') { addProperty(); return; }
    if (btn.dataset.action === 'remove') {
      var i = +btn.dataset.i, p = state.properties[i];
      if (!p) return;
      if (state.properties.length <= 1) { toast('You need at least one project to compare.'); return; }
      if (hasData(p) && !window.confirm('Remove ' + p.name + '?')) return;
      state.properties.splice(i, 1);
      relabel(); renderGrid(); save();
    }
  });
  grid.addEventListener('keydown', function (e) {
    if ((e.key === 'Enter' || e.key === ' ') && e.target.dataset && e.target.dataset.action === 'add') { e.preventDefault(); addProperty(); }
  });

  // Settings (stamp duty %, etc.)
  $('assumptionsGrid').addEventListener('input', function (e) {
    var k = e.target.dataset.setting;
    if (!k || !(k in E.DEFAULT_SETTINGS)) return;
    state.settings[k] = e.target.value;
    updateAllCostNotes(); scheduleSave();
  });
  $('resetSettings').addEventListener('click', function () {
    state.settings = Object.assign({}, E.DEFAULT_SETTINGS);
    renderSettings(); updateAllCostNotes(); save();
    toast('Cost assumptions reset to the Tamil Nadu defaults.');
  });
  $('resetAll').addEventListener('click', function () {
    if (!window.confirm('Clear all projects and start again?')) return;
    state = fresh(); save(); renderAll(); showResults(null); switchTab('properties');
  });

  /* ---------- Start from one of Danav's listings (Supabase) ---------- */
  function loadListings() {
    try {
      if (!window.supabase || typeof SUPABASE_URL === 'undefined' || typeof SUPABASE_ANON_KEY === 'undefined' || /YOUR-PROJECT/.test(SUPABASE_URL)) return;
      var sb = window.supabase.createClient(SUPABASE_URL, SUPABASE_ANON_KEY);
      sb.from('properties').select('id,name,location,status,bhk,sqft,floor,price_amount')
        .eq('is_published', true).order('created_at', { ascending: false })
        .then(function (res) {
          if (res.error || !Array.isArray(res.data) || !res.data.length) return;
          listings = res.data;
          applyAddFromUrl();
          renderGrid();
        }, function (err) { console.warn('Could not load listings:', err); });
    } catch (e) { console.warn('Listings unavailable:', e); }
  }

  // Arriving from a "Compare" button on a listing card: compare.html?add=<listing id>
  function applyAddFromUrl() {
    var ids;
    try { ids = new URLSearchParams(window.location.search).getAll('add'); } catch (e) { return; }
    if (!ids.length) return;
    ids.slice(0, MAX_PROPS).forEach(function (id) {
      var l = listings.filter(function (x) { return String(x.id) === String(id); })[0];
      if (!l) return;
      if (state.properties.some(function (p) { return p.listingId === String(l.id); })) return; // already added
      var slot = -1;
      state.properties.forEach(function (p, i) { if (slot === -1 && !hasData(p)) slot = i; });
      if (slot === -1) {
        if (state.properties.length >= MAX_PROPS) return;
        state.properties.push(E.emptyProperty(LETTERS[state.properties.length]));
        slot = state.properties.length - 1;
      }
      fillFromListing(state.properties[slot], l);
    });
    try { window.history.replaceState(null, '', window.location.pathname); } catch (e) { /* ignore */ }
    save();
    toast('Added from the listings. Add the carpet area and any extra charges for a fuller comparison.');
  }

  function fillFromListing(p, l) {
    p.name = l.name || p.name;
    if (l.location) p.location = l.location;
    if (!p.city) p.city = 'Chennai';
    var bhk = /(\d(?:\.5)?)\s*BHK/i.exec(l.bhk || '');
    if (bhk) p.configuration = ['1', '1.5', '2', '2.5', '3', '3.5', '4'].indexOf(bhk[1]) > -1 ? bhk[1] + ' BHK' : '4+ BHK';
    if (Number(l.sqft) > 0) p.saleableArea = String(l.sqft);
    if (Number(l.price_amount) > 0) p.price = String(l.price_amount);
    var fl = /\d+/.exec(l.floor || '');
    if (fl) p.floorNumber = fl[0];
    if (/ready|occup|possession/i.test(l.status || '')) p.constructionStatus = 'ready';
    else if (/under|construction|launch/i.test(l.status || '')) p.constructionStatus = 'under_construction';
    p.listingId = String(l.id);
  }

  function importListing(i, id) {
    if (!id) return;
    var l = listings.filter(function (x) { return String(x.id) === String(id); })[0];
    var p = state.properties[i];
    if (!l || !p) return;
    fillFromListing(p, l);
    renderGrid(); save();
    toast('Filled in from "' + (l.name || 'the listing') + '". Add the carpet area and any extra charges for a fuller comparison.');
  }

  /* ---------- Tabs ---------- */
  function switchTab(tab) {
    var results = tab === 'results';
    $('propertiesSection').style.display = results ? 'none' : 'block';
    $('resultsSection').classList.toggle('visible', results);
    $('tabProperties').classList.toggle('active', !results);
    $('tabResults').classList.toggle('active', results);
    $('tabProperties').setAttribute('aria-selected', String(!results));
    $('tabResults').setAttribute('aria-selected', String(results));
  }
  $('tabProperties').addEventListener('click', function () { switchTab('properties'); });
  $('tabResults').addEventListener('click', function () { switchTab('results'); });

  /* ---------- Analyze + first results ---------- */
  var lastAnalysis = null;

  $('analyzeBtn').addEventListener('click', function () {
    var out = E.analyze(state.properties, state.settings);
    if (!out.results.length) {
      var first = out.skipped[0];
      toast(first ? first.name + ': please add the ' + first.missing.join(' and ') + ' first.' : 'Add a project first.');
      return;
    }
    lastAnalysis = out;
    showResults(out);
    switchTab('results');
    window.scrollTo({ top: 0, behavior: 'smooth' });
  });

  function showResults(a) {
    $('resultsEmpty').hidden = !!a;
    $('resultsBody').hidden = !a;
    if (!a) return;
    renderSkipped(a);
    renderSummary(a);
    renderChecks(a);
    document.dispatchEvent(new CustomEvent('compare:results', { detail: a })); // later steps hook in here
  }

  function renderSkipped(a) {
    $('skippedNote').innerHTML = a.skipped.map(function (s) {
      return '<div class="auto-note" style="margin-bottom:16px"><i class="fas fa-info-circle"></i> <strong>' + esc(s.name) +
        '</strong> was left out. Add its ' + esc(s.missing.join(' and ')) + ' to include it.</div>';
    }).join('');
  }

  function card(cls, label, icon, value, desc) {
    return '<div class="exec-card ' + cls + '"><div class="exec-label"><i class="fas ' + icon + '"></i> ' + label + '</div>' +
      '<div class="exec-value">' + value + '</div><div class="exec-desc">' + desc + '</div></div>';
  }

  function renderSummary(a) {
    var s = a.summary, r = a.results, html = '';

    if (s.count === 1) {
      var p = r[0];
      html += card('winner-card', 'All-in cost', 'fa-rupee-sign', esc(inr(p.allInCost)),
        esc(inr(p.pricePerSqft)) + ' per sq ft (' + p.areaBasis + ' area), including stamp duty, registration and GST.');
      html += card('enduse-card', 'Overall score', 'fa-trophy', Math.round(p.totalScore) + '/100', 'Add a second project to see how it compares.');
      html += card(p.riskLevel === 'High' ? 'risk-card' : (p.riskLevel === 'Medium' ? 'exec-card' : 'value-card'), 'Risk level', 'fa-exclamation-triangle',
        esc(p.riskLevel), esc(p.riskFactors[0] || 'No risk flags were raised from what you entered.'));
      html += card('invest-card', 'Gross rental yield', 'fa-percentage',
        p.yieldKnown ? p.grossYield.toFixed(2) + '%' : '-', p.yieldKnown ? 'Annual rent as a share of the all-in cost.' : 'Add the expected monthly rent to see the yield.');
    } else {
      var byId = function (id) { return r.filter(function (x) { return x.id === id; })[0]; };
      var close = s.overallGap !== null && s.overallGap < 3;
      html += card('winner-card', 'Best overall', 'fa-trophy', esc(s.bestOverall.name),
        'Score ' + Math.round(s.bestOverall.score) + '/100.' + (close ? ' Very close: within 3 points of the next project.' : ''));
      html += card('enduse-card', 'Best to live in', 'fa-bed', esc(s.bestEndUse.name), 'Score ' + Math.round(s.bestEndUse.score) + '/100 for living there with family.');
      html += card('invest-card', 'Best for investment', 'fa-coins', esc(s.bestInvest.name), 'Score ' + Math.round(s.bestInvest.score) + '/100 on yield, growth and price.');
      html += card('value-card', 'Best value per sq ft', 'fa-tag', esc(s.bestValue.name),
        esc(inr(s.bestValue.score)) + ' per sq ft (' + byId(s.bestValue.id).areaBasis + ' area, all-in).');
      html += s.mostRisky
        ? card('risk-card', 'Highest risk', 'fa-exclamation-triangle', esc(s.mostRisky.name), esc(s.mostRisky.riskLevel) + ' risk. ' + esc(s.mostRisky.reason))
        : card('value-card', 'Risk check', 'fa-shield-alt', 'No high-risk flags', 'Still verify RERA, approvals and title with a lawyer.');
    }
    $('execSummary').innerHTML = html;
  }

  function renderChecks(a) {
    var rows = a.results.filter(function (r) { return r.dataWarnings.length; });
    $('dataChecks').hidden = !rows.length;
    $('dataChecksBody').innerHTML = rows.map(function (r) {
      return '<div class="auto-note"><strong>' + esc(r.name) + '</strong><ul class="ai-list">' +
        r.dataWarnings.map(function (w) { return '<li>' + esc(w) + '</li>'; }).join('') + '</ul></div>';
    }).join('');
  }

  /* ---------- Go ---------- */
  renderAll();
  showResults(null);
  loadListings();
})();
