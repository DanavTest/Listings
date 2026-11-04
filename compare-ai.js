/* =====================================================================
   compare-ai.js — Dreamzland Chennai  (Step 4)
   Adds the "AI review" panel to the results. The review is requested only
   when the visitor presses the button (saves your Gemini quota) and is
   sent to /api/analyze. Everything returned is escaped before display.
   Load order: ... compare-results.js -> compare-ai.js
   ===================================================================== */
(function () {
  'use strict';
  var host = document.getElementById('aiHost');
  if (!host) return;

  var current = null, busy = false;

  function put(html) { host.className = html ? 'card' : ''; host.innerHTML = html; }

  function esc(s) {
    return String(s == null ? '' : s).replace(/[&<>"']/g, function (c) {
      return { '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c];
    });
  }
  function nameOf(id) {
    var r = current && current.results.filter(function (x) { return x.id === id; })[0];
    return r ? r.name : 'Project ' + id;
  }
  function list(items) {
    return items && items.length ? '<ul class="ai-list">' + items.map(function (i) { return '<li>' + esc(i) + '</li>'; }).join('') + '</ul>' : '';
  }
  function box(title, icon, items) {
    return items && items.length ? '<div class="ai-box"><h4><i class="fas ' + icon + '"></i> ' + title + '</h4>' + list(items) + '</div>' : '';
  }

  function start() {
    put('<div class="ai-panel"><span class="ai-tag"><i class="fas fa-robot"></i> AI review</span>' +
      '<h2>Get a written AI review of these projects</h2>' +
      '<p class="auto-note">An AI reads the numbers above and writes a short review: advice for each type of buyer, things to negotiate, questions to ask the builder and what to verify before paying. It uses only what you entered.</p>' +
      '<button type="button" class="analyze-btn" id="aiGo"><i class="fas fa-magic"></i> Get AI review</button></div>');
    document.getElementById('aiGo').addEventListener('click', ask);
  }

  function loading() {
    put('<div class="ai-panel"><span class="ai-tag"><i class="fas fa-robot"></i> AI review</span>' +
      '<div class="ai-loading"><div class="spinner"></div><span>Reading your numbers. This takes 5 to 15 seconds.</span></div></div>');
  }

  function failed(msg) {
    put('<div class="ai-panel"><span class="ai-tag"><i class="fas fa-robot"></i> AI review</span>' +
      '<div class="ai-error">' + esc(msg) + '</div><button type="button" class="ai-retry btn-small" id="aiRetry">Try again</button></div>');
    document.getElementById('aiRetry').addEventListener('click', ask);
  }

  function show(a) {
    var best = a.bestPick
      ? '<div class="ai-pick"><div class="exec-label">Overall pick</div><strong>' + esc(nameOf(a.bestPick.id)) + '</strong><p>' + esc(a.bestPick.reason) + '</p></div>' : '';
    var profiles = (a.byProfile || []).map(function (p) {
      return '<div class="ai-pick invest"><div class="exec-label">' + esc(p.profile) + '</div><strong>' + esc(nameOf(p.id)) + '</strong><p>' + esc(p.reason) + '</p></div>';
    }).join('');
    var props = (a.properties || []).map(function (p) {
      return '<div class="ai-prop"><h4>' + esc(nameOf(p.id)) + '</h4><p class="verdict">' + esc(p.verdict) + '</p>' +
        '<div class="ai-lists">' + box('Strengths', 'fa-thumbs-up', p.strengths) + box('Concerns', 'fa-exclamation-circle', p.concerns) + '</div></div>';
    }).join('');

    put('<div class="ai-panel"><span class="ai-tag"><i class="fas fa-robot"></i> AI review</span>' +
      (a.headline ? '<p class="ai-headline">' + esc(a.headline) + '</p>' : '') +
      '<div class="ai-picks">' + best + profiles + '</div>' +
      '<div class="ai-props">' + props + '</div>' +
      '<div class="ai-lists">' + box('Negotiation tips', 'fa-handshake', a.negotiationTips) + box('Ask the builder', 'fa-question-circle', a.questionsForBuilder) + '</div>' +
      '<div class="ai-lists">' + box('Verify before you pay', 'fa-clipboard-check', a.verifyBeforePaying) + box('Missing information', 'fa-info-circle', a.missingData) + '</div>' +
      '<div class="ai-foot">' + esc(a.caveat || 'AI-written from the numbers you entered. It can make mistakes and is not legal or financial advice.') + '</div>' +
      '<button type="button" class="ai-retry btn-small" id="aiRetry">Refresh review</button></div>');
    document.getElementById('aiRetry').addEventListener('click', ask);
  }

  function ask() {
    if (busy || !current) return;
    busy = true; loading();
    var ctrl = typeof AbortController !== 'undefined' ? new AbortController() : null;
    var timer = setTimeout(function () { if (ctrl) ctrl.abort(); }, 45000);
    fetch('/api/analyze', {
      method: 'POST', headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ properties: current.results }), signal: ctrl ? ctrl.signal : undefined
    }).then(function (r) {
      return r.json().catch(function () { return {}; }).then(function (d) { return { ok: r.ok, d: d }; });
    }).then(function (x) {
      if (x.ok && x.d.analysis) show(x.d.analysis);
      else failed(x.d.error || 'Sorry, the AI review is not available right now. The calculated results above are still valid.');
    }).catch(function () {
      failed('The AI review could not be reached. Check your connection and try again. The calculated results above are still valid.');
    }).then(function () { clearTimeout(timer); busy = false; });
  }

  document.addEventListener('compare:results', function (ev) {
    current = ev.detail && ev.detail.results && ev.detail.results.length ? ev.detail : null;
    if (current) start(); else put('');
  });
})();
