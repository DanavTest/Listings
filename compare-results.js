/* =====================================================================
   compare-results.js — Dreamzland Chennai  (Step 3)
   Draws the full results under the summary: score bars, side-by-side
   table, rental yield, plain-language insights and red flags.
   It listens for the "compare:results" event fired by compare.js.
   Load order: compare-engine.js -> compare.js -> compare-results.js
   ===================================================================== */
(function () {
  'use strict';
  var E = window.CompareEngine;
  var host = document.getElementById('resultsMore');
  if (!E || !host) return;

  function esc(s) {
    return String(s == null ? '' : s).replace(/[&<>"']/g, function (c) {
      return { '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c];
    });
  }
  function rs(n) { return Number.isFinite(n) && n > 0 ? '₹' + Math.round(n).toLocaleString('en-IN') : '-'; }
  function cr(n) { return Number.isFinite(n) && n > 0 ? '₹' + E.formatINR(n) : '-'; }
  function dot(n, d) { return Number.isFinite(n) ? n.toFixed(d == null ? 0 : d) : '-'; }

  var SCORE_ROWS = [
    ['price', 'Price value', 20], ['location', 'Location', 20], ['developer', 'Developer', 15],
    ['rera', 'RERA & legal', 15], ['livability', 'Livability', 10], ['yield', 'Rental yield', 10],
    ['appreciation', 'Appreciation', 10]
  ];

  function level(pct) { return pct >= 80 ? 'excellent' : pct >= 60 ? 'good' : pct >= 40 ? 'average' : 'poor'; }

  /* ---------- 1. Score bars ---------- */
  function scoresHtml(results) {
    var cards = results.map(function (r) {
      var rows = SCORE_ROWS.map(function (s) {
        var v = r.scores[s[0]] || 0, pct = Math.max(0, Math.min(100, v / s[2] * 100)), lv = level(pct);
        return '<div class="score-item"><div class="score-label">' + s[1] + '</div>' +
          '<div class="score-bar-bg"><div class="score-bar-fill ' + lv + '" style="width:' + pct.toFixed(0) + '%"></div></div>' +
          '<div class="score-value ' + lv + '">' + dot(v, 1) + '/' + s[2] + '</div></div>';
      }).join('');
      return '<div class="score-card"><h3>' + esc(r.name) + ' <small>· ' + dot(r.totalScore) + '/100</small></h3>' + rows + '</div>';
    }).join('');
    return '<div class="card"><h2><i class="fas fa-chart-bar" style="color:var(--primary)"></i> How each project scored</h2>' +
      '<div class="scores-section">' + cards + '</div></div>';
  }

  /* ---------- 2. Comparison table ---------- */
  function tableHtml(results) {
    // [label, getter, display, betterIs]  betterIs: 'low' | 'high' | null
    var rows = [
      ['All-in cost', function (r) { return r.allInCost; }, function (r) { return cr(r.allInCost); }, 'low'],
      ['Agreement value', function (r) { return r.costs.agreementValue; }, function (r) { return cr(r.costs.agreementValue); }, null],
      ['GST', function (r) { return r.costs.gst; }, function (r) { return r.costs.gst ? cr(r.costs.gst) : 'Nil'; }, 'low'],
      ['Stamp duty', function (r) { return r.costs.stampDuty; }, function (r) { return cr(r.costs.stampDuty) + (r.costs.stampDutyEstimated ? ' (est.)' : ''); }, null],
      ['Registration', function (r) { return r.costs.registration; }, function (r) { return cr(r.costs.registration) + (r.costs.registrationEstimated ? ' (est.)' : ''); }, null],
      ['Taxes & charges on top of price', function (r) { return r.hiddenTotal; }, function (r) { return r.hiddenTotal ? cr(r.hiddenTotal) : 'None'; }, 'low'],
      ['Price per sq ft (all-in)', function (r) { return r.pricePerSqft; }, function (r) { return rs(r.pricePerSqft) + ' <small>(' + esc(r.areaBasis) + ')</small>'; }, 'low'],
      ['Loading', function (r) { return r.loadingKnown ? r.loading : null; }, function (r) { return r.loadingKnown ? dot(r.loading, 1) + '%' : 'Unknown'; }, 'low'],
      ['Possession', function (r) { return r.monthsToPossession; }, function (r) {
        if (r.monthsToPossession == null) return 'Not entered';
        return r.delayed ? 'Overdue' : (r.monthsToPossession <= 0 ? 'Ready' : r.monthsToPossession + ' months');
      }, null],
      ['Gross rental yield', function (r) { return r.yieldKnown ? r.grossYield : null; }, function (r) { return r.yieldKnown ? dot(r.grossYield, 2) + '%' : 'Not entered'; }, 'high'],
      ['End-use score', function (r) { return r.endUseScore; }, function (r) { return dot(r.endUseScore) + '/100'; }, 'high'],
      ['Investment score', function (r) { return r.investScore; }, function (r) { return dot(r.investScore) + '/100'; }, 'high'],
      ['Overall score', function (r) { return r.totalScore; }, function (r) { return dot(r.totalScore) + '/100'; }, 'high'],
      ['Risk level', function (r) { return null; }, function (r) { return esc(r.riskLevel); }, null]
    ];
    var head = '<tr><th></th>' + results.map(function (r) { return '<th class="prop-col">' + esc(r.name) + '</th>'; }).join('') + '</tr>';
    var body = rows.map(function (row) {
      var vals = results.map(row[1]);
      var nums = vals.filter(function (v) { return v != null && Number.isFinite(v) && v > 0; });
      var best = null, worst = null;
      if (row[3] && results.length > 1 && nums.length > 1) {
        var lo = Math.min.apply(null, nums), hi = Math.max.apply(null, nums);
        if (lo !== hi) { best = row[3] === 'low' ? lo : hi; worst = row[3] === 'low' ? hi : lo; }
      }
      return '<tr><td>' + row[0] + '</td>' + results.map(function (r, i) {
        var cls = vals[i] != null && vals[i] === best ? ' class="best-value"' : (vals[i] != null && vals[i] === worst ? ' class="worst-value"' : '');
        return '<td' + cls + '>' + row[2](r) + '</td>';
      }).join('') + '</tr>';
    }).join('');
    return '<div class="card"><h2><i class="fas fa-table" style="color:var(--primary)"></i> Side by side</h2>' +
      '<div class="comparison-table-wrap"><table class="comp-table"><thead>' + head + '</thead><tbody>' + body + '</tbody></table></div>' +
      (results.length > 1 ? '<p class="auto-note" style="margin-top:12px">Green marks the better figure and red the weaker one, where a lower or higher number is clearly better.</p>' : '') + '</div>';
  }

  /* ---------- 3. Rental yield ---------- */
  function yieldHtml(results) {
    var cards = results.map(function (r) {
      if (!r.yieldKnown) {
        return '<div class="yield-card"><h3>' + esc(r.name) + '</h3><div class="yield-percent">-</div>' +
          '<div class="yield-label">Gross yield</div><div class="yield-verdict">Add the expected monthly rent on the Properties tab to see the yield.</div></div>';
      }
      var y = r.grossYield, cls = y < 2 ? 'weak' : y < 3 ? 'normal' : y < 4 ? 'good' : 'strong';
      var verdict = y < 2 ? 'Low. The rent covers little of the cost; this is mainly a growth bet.'
        : y < 3 ? 'Typical for Chennai residential property.'
        : y < 4 ? 'Good for the city. Check that the rent is realistic for this area.'
        : 'Strong. Double-check the rent figure, as high yields are rare in Chennai.';
      return '<div class="yield-card"><h3>' + esc(r.name) + '</h3>' +
        '<div class="yield-percent ' + cls + '">' + dot(y, 2) + '%</div><div class="yield-label">Gross yield a year</div>' +
        '<div class="yield-verdict">' + verdict + '</div>' +
        '<div class="benchmark">Rent ' + rs(r.annualRent) + ' a year on ' + cr(r.allInCost) + ' all-in</div></div>';
    }).join('');
    return '<div class="card"><h2><i class="fas fa-hand-holding-usd" style="color:var(--primary)"></i> Rental yield</h2>' +
      '<div class="yield-cards">' + cards + '</div>' +
      '<p class="auto-note" style="margin-top:12px">Gross yield ignores maintenance, vacancy and tax. Chennai residential yields are usually about 2% to 3.5%.</p></div>';
  }

  /* ---------- 4. Plain-language insights ---------- */
  function insights(a) {
    var r = a.results, s = a.summary, out = [];
    function add(type, title, text) { out.push({ type: type, title: title, text: text }); }

    if (r.length > 1) {
      if (s.bestOverall.id === s.bestInvest.id && s.bestOverall.id === s.bestEndUse.id) {
        add('invest', s.bestOverall.name + ' leads on every measure', 'It wins overall, for living in and for investing. Unless something outside this tool changes your mind, it is the strongest of the ' + r.length + '.');
      } else {
        add('invest', 'Different winners for different goals', 'To live in: ' + s.bestEndUse.name + '. To invest: ' + s.bestInvest.name + '. Pick the one that matches why you are buying.');
      }
      if (s.overallGap !== null && s.overallGap < 3) {
        add('info', 'It is a close call', 'The top two are within 3 points overall, so the score alone should not decide. Visit both and compare the documents.');
      }
      var cheap = r.slice().sort(function (x, y) { return x.allInCost - y.allInCost; });
      var gap = cheap[r.length - 1].allInCost - cheap[0].allInCost;
      if (gap > 0) add('info', 'Cost difference', cheap[0].name + ' costs ' + cr(gap) + ' less all-in than ' + cheap[r.length - 1].name + '.');
    }

    r.forEach(function (p) {
      if (p.delayed) add('danger', p.name + ' is past its possession date', 'It is still marked under construction after the promised date. Ask for the RERA extension order and a written revised date before paying more.');
      if (p.loadingKnown && p.loading > 35) add('warning', p.name + ' has high loading (' + dot(p.loading, 0) + '%)', 'You pay for a lot of common area. Compare the price per carpet sq ft, not per saleable sq ft.');
      var extras = (p.costs.clubhouse || 0) + (p.costs.maintenance || 0) + (p.costs.corpus || 0) + (p.costs.legal || 0);
      if (extras > p.costs.agreementValue * 0.05) add('warning', p.name + ': deposits and extra charges are large', cr(extras) + ' in clubhouse, maintenance, corpus and legal charges on top of the price. Confirm each one in writing.');
      if (p.yieldKnown && p.grossYield < 2) add('warning', p.name + ' has a low rental yield', 'At ' + dot(p.grossYield, 2) + '% the rent barely helps with the cost. Only buy it for growth or to live in.');
      if (p.costs.stampDutyEstimated && p.costs.dutyBase > p.costs.agreementValue) add('info', p.name + ': duty is on the guideline value', 'Your guideline value is higher than the sale price, so stamp duty and registration are charged on it.');
    });

    if (!out.length) add('info', 'Nothing unusual stands out', 'The numbers you entered raise no special flags. Still verify RERA, approvals and title with a lawyer.');
    return out;
  }

  function insightsHtml(a) {
    var items = insights(a).map(function (i) {
      return '<div class="rec-item ' + i.type + '"><div class="rec-title">' + esc(i.title) + '</div><div class="rec-text">' + esc(i.text) + '</div></div>';
    }).join('');
    return '<div class="card"><h2><i class="fas fa-lightbulb" style="color:var(--primary)"></i> What this means</h2>' +
      '<p class="auto-note" style="margin-bottom:14px">These notes come from fixed rules applied to your numbers. They are not AI. The AI review is below.</p>' + items + '</div>';
  }

  /* ---------- 5. Red flags ---------- */
  function flagsHtml(results) {
    var cols = results.map(function (r) {
      var inner = r.riskFactors.length
        ? r.riskFactors.map(function (f) { return '<div class="flag-item"><i class="fas fa-flag"></i><div class="flag-text">' + esc(f) + '</div></div>'; }).join('')
        : '<div class="no-flags"><i class="fas fa-check-circle"></i> No red flags from what you entered.</div>';
      return '<div><h3>' + esc(r.name) + ' <small>· ' + esc(r.riskLevel) + ' risk</small></h3><div class="flag-grid">' + inner + '</div></div>';
    }).join('');
    return '<div class="card"><h2 class="red-title"><i class="fas fa-exclamation-triangle"></i> Red flags</h2>' + cols + '</div>';
  }

  document.addEventListener('compare:results', function (ev) {
    var a = ev.detail;
    if (!a || !a.results || !a.results.length) { host.innerHTML = ''; return; }
    host.innerHTML = scoresHtml(a.results) + tableHtml(a.results) + yieldHtml(a.results) + insightsHtml(a) + flagsHtml(a.results);
  });
})();
