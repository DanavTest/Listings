/* =====================================================================
   script.js — Dreamzland Chennai
   (Your personal details live in config.js — you don't need to edit here.)
   ===================================================================== */

const $ = (id) => document.getElementById(id);
const reduceMotion = window.matchMedia('(prefers-reduced-motion: reduce)').matches;
let sb = null;
try { sb = window.supabase.createClient(SUPABASE_URL, SUPABASE_ANON_KEY); } catch (e) { console.error('Supabase failed to load:', e); }

/* ---------- Helpers ---------- */
function esc(s){
  return String(s ?? '').replace(/[&<>"']/g, c => ({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[c]));
}
function safeUrl(u){ return encodeURI(String(u || '')).replace(/'/g, '%27').replace(/\(/g,'%28').replace(/\)/g,'%29'); }

/* ---------- Contact links + branding from config.js ---------- */
$('waDirectLink').href = `https://wa.me/${WHATSAPP_NUMBER}`;
$('waFloat').href = `https://wa.me/${WHATSAPP_NUMBER}`;
$('phoneLink').href = `tel:+${WHATSAPP_NUMBER}`;
$('phoneLink').textContent = PHONE_DISPLAY;
$('emailLink').href = `mailto:${OWNER_EMAIL}`;
$('emailLink').textContent = OWNER_EMAIL;

if (LOGO_URL) { const l = $('brandLogo'); l.src = LOGO_URL; l.classList.add('loaded'); }
if (AGENT_PHOTO_URL) { $('agentPhoto').src = AGENT_PHOTO_URL; }
if (typeof HERO_VIDEO_URL !== 'undefined' && HERO_VIDEO_URL) {
  const v = $('heroVideo');
  v.src = HERO_VIDEO_URL;
  v.play().catch(() => {});
  $('heroSection').classList.add('has-video');
} else if (HERO_IMAGE_URL) {
  $('heroPhoto').style.backgroundImage = `url('${safeUrl(HERO_IMAGE_URL)}')`;
  $('heroSection').classList.add('has-photo');
}

/* ---------- Mobile nav ---------- */
const navToggle = $('navToggle'), navLinks = $('navLinks');
navToggle.addEventListener('click', () => {
  const open = navLinks.classList.toggle('open');
  navToggle.classList.toggle('open', open);
  navToggle.setAttribute('aria-expanded', open);
});
navLinks.querySelectorAll('a').forEach(a => a.addEventListener('click', () => {
  navLinks.classList.remove('open'); navToggle.classList.remove('open');
}));
window.addEventListener('scroll', () => $('siteNav').classList.toggle('scrolled', window.scrollY > 10), { passive: true });

/* =====================================================================
   3D SKYLINE — illustrated Chennai-style dusk skyline, three depth layers
   ===================================================================== */
function mulberry32(a){ return function(){ a|=0; a=a+0x6D2B79F5|0; let t=Math.imul(a^a>>>15,1|a); t=t+Math.imul(t^t>>>7,61|t)^t; return((t^t>>>14)>>>0)/4294967296; }; }

const W = 1600, H = 520;

function landmarkDome(x, fill){            // heritage domed tower (Indo-Saracenic style)
  const base = `<rect x="${x}" y="${H-170}" width="150" height="170" fill="${fill}"/>`;
  const wings = `<rect x="${x-26}" y="${H-110}" width="26" height="110" fill="${fill}"/><rect x="${x+150}" y="${H-110}" width="26" height="110" fill="${fill}"/>`;
  const tower = `<rect x="${x+58}" y="${H-270}" width="34" height="100" fill="${fill}"/>`;
  const dome = `<path d="M${x+52} ${H-270} Q${x+75} ${H-318} ${x+98} ${H-270} Z" fill="${fill}"/><rect x="${x+73.5}" y="${H-346}" width="3" height="30" fill="${fill}"/>`;
  const minarets = [x+8, x+128].map(mx => `<rect x="${mx}" y="${H-214}" width="14" height="44" fill="${fill}"/><path d="M${mx-1} ${H-214} Q${mx+7} ${H-238} ${mx+15} ${H-214}Z" fill="${fill}"/>`).join('');
  return base + wings + tower + dome + minarets;
}
function landmarkLighthouse(x, fill){      // tapered lighthouse-style tower
  return `<polygon points="${x},${H} ${x+46},${H} ${x+34},${H-230} ${x+12},${H-230}" fill="${fill}"/>
          <rect x="${x+6}" y="${H-246}" width="34" height="16" fill="${fill}"/>
          <path d="M${x+12} ${H-246} Q${x+23} ${H-282} ${x+34} ${H-246}Z" fill="${fill}"/>`;
}
function landmarkTower(x, fill){           // tall tapering office tower with crown
  return `<polygon points="${x},${H} ${x+70},${H} ${x+70},${H-300} ${x+35},${H-352} ${x},${H-300}" fill="${fill}"/>
          <rect x="${x+33}" y="${H-390}" width="4" height="40" fill="${fill}"/>`;
}

function buildLayer(svg, o){
  const r = mulberry32(o.seed);
  let out = '', x = -30;
  while (x < W + 30) {
    const w = o.minW + r() * (o.maxW - o.minW);
    const h = o.minH + r() * (o.maxH - o.minH);
    const y = H - h;
    out += `<rect x="${x.toFixed(1)}" y="${y.toFixed(1)}" width="${w.toFixed(1)}" height="${h.toFixed(1)}" fill="${o.fill}"/>`;
    const roll = r();
    if (roll < 0.24) { const sh = 16 + r()*26; out += `<rect x="${(x+w*.18).toFixed(1)}" y="${(y-sh).toFixed(1)}" width="${(w*.64).toFixed(1)}" height="${sh.toFixed(1)}" fill="${o.fill}"/>`; }
    else if (roll < 0.40) { out += `<rect x="${(x+w/2-1.5).toFixed(1)}" y="${(y-46).toFixed(1)}" width="3" height="46" fill="${o.fill}"/>`; }
    if (o.lit) {
      for (let wx = x + 7; wx < x + w - 9; wx += 13) {
        for (let wy = y + 12; wy < H - 10; wy += 17) {
          if (r() < o.lit) out += `<rect class="win${r()<.22?' tw':''}" x="${wx.toFixed(1)}" y="${wy.toFixed(1)}" width="5" height="7" style="${o.tw ? '' : ''}${r()<.22?`animation-delay:${(r()*4).toFixed(1)}s;`:''}opacity:${o.winOpacity}"/>`;
        }
      }
    }
    x += w * 0.92 + r() * o.gap;
  }
  (o.landmarks || []).forEach(l => { out += l(); });
  svg.innerHTML = out;
}

buildLayer($('slFar'),  { seed: 7,  fill:'#8a4aa3', minW:36, maxW:78, minH:110, maxH:250, gap:6,  lit:0,    winOpacity:0,
  landmarks:[ () => landmarkLighthouse(1130, '#8a4aa3'), () => landmarkTower(330, '#8a4aa3') ] });
buildLayer($('slMid'),  { seed: 21, fill:'#4a2391', minW:40, maxW:92, minH:130, maxH:300, gap:4,  lit:0.10, winOpacity:0.55,
  landmarks:[ () => landmarkDome(560, '#4a2391') ] });
buildLayer($('slNear'), { seed: 63, fill:'#170b52', minW:46, maxW:110, minH:80,  maxH:230, gap:2,  lit:0.24, winOpacity:0.9 });

/* ---------- Parallax: constant ambient drift + mouse (desktop) + scroll dolly ---------- */
(function(){
  const hero = $('heroSection');
  if (reduceMotion) return;
  let mx = 0, my = 0, cx = 0, cy = 0, visible = true, t0 = performance.now();
  const touchOnly = window.matchMedia('(hover: none)').matches;

  hero.addEventListener('mousemove', e => {
    const r = hero.getBoundingClientRect();
    mx = (e.clientX - r.left) / r.width - 0.5;
    my = (e.clientY - r.top) / r.height - 0.5;
  });
  hero.addEventListener('mouseleave', () => { mx = 0; my = 0; });
  window.addEventListener('scroll', () => {
    hero.style.setProperty('--sy', Math.min(window.scrollY, 900));
  }, { passive: true });
  new IntersectionObserver(([en]) => { visible = en.isIntersecting; }).observe(hero);

  (function loop(now){
    if (visible) {
      // Always-on slow drift so the scene feels alive even when the cursor is still —
      // this is what reads as "moving through" the space rather than a static photo.
      const t = (now - t0) / 6000;
      const driftX = Math.sin(t) * (touchOnly ? 0.4 : 0.16);
      const driftY = Math.cos(t * 0.6) * (touchOnly ? 0.18 : 0.08);
      const tx = touchOnly ? driftX : driftX + mx * 0.85;
      const ty = touchOnly ? driftY : driftY + my * 0.85;
      cx += (tx - cx) * 0.06; cy += (ty - cy) * 0.06;
      hero.style.setProperty('--mx', cx.toFixed(4));
      hero.style.setProperty('--my', cy.toFixed(4));
    }
    requestAnimationFrame(loop);
  })(t0);
})();

/* =====================================================================
   3D TILT (cards) with moving glare
   ===================================================================== */
function attachTilt(el, strength = 8){
  if (reduceMotion || window.matchMedia('(hover: none)').matches) return;
  el.addEventListener('mousemove', e => {
    const r = el.getBoundingClientRect();
    const x = (e.clientX - r.left) / r.width - 0.5;
    const y = (e.clientY - r.top) / r.height - 0.5;
    el.style.transform = `rotateY(${x * strength}deg) rotateX(${-y * strength}deg)`;
    el.style.setProperty('--gx', ((x + .5) * 100).toFixed(1) + '%');
    el.style.setProperty('--gy', ((y + .5) * 100).toFixed(1) + '%');
  });
  el.addEventListener('mouseleave', () => { el.style.transform = 'rotateY(0deg) rotateX(0deg)'; });
}
document.querySelectorAll('.why-item').forEach(el => attachTilt(el, 6));

/* ---------- Scroll reveal ---------- */
const revealObserver = new IntersectionObserver((entries) => {
  entries.forEach(en => { if (en.isIntersecting) { en.target.classList.add('in'); revealObserver.unobserve(en.target); } });
}, { threshold: 0.12 });
function observeReveals(root = document){ root.querySelectorAll('.reveal:not(.in)').forEach(el => revealObserver.observe(el)); }
observeReveals();

/* ---------- Count-up ---------- */
function countUp(el, to){
  if (reduceMotion || to === 0) { el.textContent = to; return; }
  const dur = 900, start = performance.now();
  (function step(now){
    const p = Math.min((now - start) / dur, 1);
    el.textContent = Math.round(to * (1 - Math.pow(1 - p, 3)));
    if (p < 1) requestAnimationFrame(step);
  })(start);
}

/* =====================================================================
   LISTINGS from Supabase
   ===================================================================== */
function formatPrice(p){
  if (!p || !p.price_amount) return { display: 'On request', sub: '' };
  const lakh = Number(p.price_amount) / 100000;
  const display = lakh >= 100 ? `${(lakh / 100).toFixed(2)} Cr` : `${lakh.toFixed(1)} L`;
  return { display, sub: p.price_label || 'All-inclusive' };
}

window.currentListings = []; // used by the chat widget to ground its answers in real data

async function loadListings(){
  const grid = $('listingGrid');
  if (!sb) { grid.innerHTML = `<div class="state-msg">Couldn't load listings right now. Please try again shortly.</div>`; $('statCount').textContent = '—'; return; }
  const { data, error } = await sb.from('properties').select('*').eq('is_published', true).order('created_at', { ascending: false });

  if (error) {
    grid.innerHTML = `<div class="state-msg">Couldn't load listings right now. Please check config.js.</div>`;
    console.error(error);
    $('statCount').textContent = '—';
    return;
  }
  if (!data || data.length === 0) {
    grid.innerHTML = `<div class="state-msg">New listings are being added — check back soon or send an enquiry.</div>`;
    $('statCount').textContent = '0';
    return;
  }

  window.currentListings = data;
  countUp($('statCount'), data.length);

  grid.innerHTML = data.map((p, i) => {
    const price = formatPrice(p);
    const bg = p.image_url ? `style="background-image:url('${safeUrl(p.image_url)}')"` : '';
    return `
      <article class="deed reveal d${i % 3}">
        <div class="deed-media" ${bg}>
          <span class="deed-status">${esc(p.status || 'Available')}</span>
          ${p.image_url ? '' : 'Photo coming soon'}
        </div>
        <div class="deed-body">
          <span class="deed-loc">${esc(p.location)}</span>
          <h3>${esc(p.name)}</h3>
          <div class="deed-specs">
            <span>${esc(p.bhk || '—')}</span><span>${p.sqft ? esc(p.sqft) + ' sq.ft' : '—'}</span><span>${esc(p.floor || '—')}</span>
          </div>
          <div class="deed-price">
            <div class="amt">₹ ${esc(price.display)}<span>${esc(price.sub)}</span></div>
            <button type="button" class="deed-cta enquire-link" data-property="${esc(p.name)}">Enquire →</button>
          </div>
        </div>
        <div class="deed-glare"></div>
      </article>`;
  }).join('');

  const select = $('pProperty');
  select.innerHTML = data.map(p => `<option>${esc(p.name)}</option>`).join('') + `<option>Not sure yet — general enquiry</option>`;

  grid.querySelectorAll('.enquire-link').forEach(btn => {
    btn.addEventListener('click', () => {
      const prop = btn.getAttribute('data-property');
      for (const opt of select.options) if (opt.value === prop) { select.value = opt.value; break; }
      $('enquire').scrollIntoView({ behavior: 'smooth' });
    });
  });

  grid.querySelectorAll('.deed').forEach(card => attachTilt(card, 7));
  observeReveals(grid);
}
loadListings();

/* =====================================================================
   ENQUIRY — save to Supabase, then open WhatsApp / email
   ===================================================================== */
function getFormValues(){
  return {
    name: $('pName').value.trim(),
    phone: $('pPhone').value.trim(),
    email: $('pEmail').value.trim(),
    property_name: $('pProperty').value,
    message: $('pMsg').value.trim()
  };
}
async function saveEnquiry(v){
  if (!sb) return false;
  const { error } = await sb.from('enquiries').insert([v]);
  if (error) console.error('Could not save enquiry:', error);
  return !error;
}
function validate(v){
  const status = $('formStatus');
  if (!v.name || !v.phone) { status.textContent = 'Please add your name and phone number first.'; return false; }
  if (v.phone.replace(/\D/g, '').length < 8) { status.textContent = 'That phone number looks too short.'; return false; }
  return true;
}

$('sendWhatsapp').addEventListener('click', async () => {
  const v = getFormValues();
  if (!validate(v)) return;
  const status = $('formStatus');
  status.textContent = 'Saving…';
  await saveEnquiry(v);
  const lines = [`New enquiry from portfolio site`, `Name: ${v.name}`, `Phone: ${v.phone}`];
  if (v.email) lines.push(`Email: ${v.email}`);
  lines.push(`Property: ${v.property_name}`);
  if (v.message) lines.push(`Message: ${v.message}`);
  window.open(`https://wa.me/${WHATSAPP_NUMBER}?text=${encodeURIComponent(lines.join('\n'))}`, '_blank');
  status.textContent = 'Saved. Opening WhatsApp with your enquiry filled in — just hit send there.';
});

$('sendEmail').addEventListener('click', async () => {
  const v = getFormValues();
  if (!validate(v)) return;
  const status = $('formStatus');
  status.textContent = 'Saving…';
  await saveEnquiry(v);
  const lines = [`Name: ${v.name}`, `Phone: ${v.phone}`];
  if (v.email) lines.push(`Email: ${v.email}`);
  lines.push(`Property: ${v.property_name}`);
  if (v.message) lines.push(`Message: ${v.message}`);
  window.location.href = `mailto:${OWNER_EMAIL}?subject=${encodeURIComponent('Enquiry: ' + v.property_name)}&body=${encodeURIComponent(lines.join('\n'))}`;
  status.textContent = 'Saved. Opening your email app with the enquiry filled in.';
});

/* =====================================================================
   AI CHAT WIDGET
   Talks to /api/chat (a Vercel serverless function) — never calls OpenAI
   directly from the browser, so your API key stays private.
   ===================================================================== */
(function(){
  const widget = $('chatWidget');
  const toggle = $('chatToggle');
  const closeBtn = $('chatClose');
  const body = $('chatBody');
  const input = $('chatInput');
  const sendBtn = $('chatSend');
  if (!widget || !toggle) return;

  const sessionId = 'sess_' + Math.random().toString(36).slice(2) + Date.now().toString(36);
  const history = []; // [{role:'user'|'assistant', content:'...'}]

  function open(){ widget.classList.add('open'); $('chatPanel').setAttribute('aria-hidden', 'false'); input.focus(); }
  function close(){ widget.classList.remove('open'); $('chatPanel').setAttribute('aria-hidden', 'true'); }
  toggle.addEventListener('click', () => widget.classList.contains('open') ? close() : open());
  closeBtn.addEventListener('click', close);

  function addMessage(role, text){
    const div = document.createElement('div');
    div.className = `chat-msg ${role === 'user' ? 'user' : 'bot'}`;
    div.textContent = text;
    body.appendChild(div);
    body.scrollTop = body.scrollHeight;
    return div;
  }
  function addTyping(){
    const div = document.createElement('div');
    div.className = 'chat-msg bot typing';
    div.innerHTML = '<span></span><span></span><span></span>';
    body.appendChild(div);
    body.scrollTop = body.scrollHeight;
    return div;
  }

  async function logMessage(role, content){
    if (!sb) return;
    try { await sb.from('chat_messages').insert([{ session_id: sessionId, role, content }]); }
    catch (e) { console.error('Could not log chat message:', e); }
  }

  async function sendMessage(){
    const text = input.value.trim();
    if (!text) return;
    input.value = '';
    sendBtn.disabled = true;

    addMessage('user', text);
    history.push({ role: 'user', content: text });
    logMessage('user', text);

    const typingEl = addTyping();

    try {
      const res = await fetch('/api/chat', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          message: text,
          history: history.slice(0, -1),
          listings: window.currentListings || [],
          business: { brand: 'Dreamzland Chennai', agent: 'Danav', area: 'South Chennai' }
        })
      });
      let data = {};
      try { data = await res.json(); } catch (_) { /* non-JSON error page */ }
      typingEl.remove();

      if (res.ok && data.reply) {
        addMessage('bot', data.reply);
        history.push({ role: 'assistant', content: data.reply });
        logMessage('assistant', data.reply);
      } else {
        // A failed request must NOT stay in the conversation history, or every
        // later message would be sent with a dangling question and fail too.
        history.pop();
        const friendly = data.error || "Sorry, I'm having trouble replying right now — please use the enquiry form or WhatsApp below instead.";
        addMessage('bot', friendly);
        console.error('Chat request failed:', res.status, data.code || '', data.error || '');
      }
    } catch (e) {
      typingEl.remove();
      history.pop();
      addMessage('bot', "Sorry, I couldn't connect just now — please try again or use WhatsApp below.");
      console.error('Chat request failed:', e);
    } finally {
      sendBtn.disabled = false;
      input.focus();
    }
  }

  sendBtn.addEventListener('click', sendMessage);
  input.addEventListener('keydown', e => { if (e.key === 'Enter') sendMessage(); });
})();
