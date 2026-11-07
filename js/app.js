(function () {
  const C = window.CONFIG, D = window.DATA;
  const KEY = 'rest.v1', OUTBOX = 'rest.outbox.v1';
  const $app = document.getElementById('app');

  // ---------- 상태 ----------
  // G: 조 공유 상태(서버와 동기화) — 미션 완료(done.*), QR 발견(found.*), 확인 버튼(rdy.*), 멤버(m.*), 리더(leader.*) 등
  const blank = () => ({ group: 0, name: '', leader: false, master: false, members: [], startedAt: 0, done: {}, words: [], cards: [], seq: [], order: [], silence: {}, quizPass: [], photoStep: false, G: {}, gens: {}, unlock: {}, timers: {}, epochSeen: '', cfShown: false });
  let S = load();
  function load() { try { return Object.assign(blank(), JSON.parse(localStorage.getItem(KEY) || '{}')); } catch (e) { return blank(); } }
  function save() { try { localStorage.setItem(KEY, JSON.stringify(S)); } catch (e) {} }
  const esc = s => String(s).replace(/[&<>"']/g, c => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c]));
  const uid = () => Date.now().toString(36) + Math.random().toString(36).slice(2, 8);

  // ---------- 전송(오프라인 대기열) ----------
  function outbox() { try { return JSON.parse(localStorage.getItem(OUTBOX) || '[]'); } catch (e) { return []; } }
  function setOutbox(a) { try { localStorage.setItem(OUTBOX, JSON.stringify(a)); } catch (e) {} }
  function send(type, payload) {
    const item = { id: uid(), type, group: S.group, ts: new Date().toISOString(), ...payload };
    const a = outbox(); a.push(item); setOutbox(a); flush();
  }
  let flushing = false, serverOld = false;
  async function flush() {
    if (!C.endpoint || flushing) return;
    flushing = true;
    try {
      const skip = new Set();
      for (;;) {
        const it = outbox().find(x => !skip.has(x.id)); if (!it) break; // 보내는 중에 추가된 항목도 이어서 전송
        let j;
        try {
          const r = await fetch(C.endpoint, { method: 'POST', headers: { 'Content-Type': 'text/plain;charset=utf-8' }, body: JSON.stringify(it) });
          j = await r.json();
        } catch (e) { break; } // 네트워크 문제: 나중에 다시
        if (!j.ok && /unknown type/.test(String(j.error))) serverOld = true;
        else if (!j.ok) { skip.add(it.id); continue; } // 서버가 거부한 항목: 건너뛰고 다음 것 먼저
        setOutbox(outbox().filter(x => x.id !== it.id));
      }
    } finally { flushing = false; paintSync(); }
  }
  function pending() { return outbox().length; }
  function paintSync() {
    const el = document.getElementById('sync'); if (!el) return;
    if (!C.endpoint) { el.textContent = '저장: 이 폰에만'; return; }
    const n = pending(); el.textContent = serverOld ? '⚠ 서버 새 버전 배포 필요' : n ? `전송 대기 ${n}건` : '전송 완료 ✓';
  }
  window.addEventListener('online', flush);
  setInterval(flush, 15000);

  // ---------- 조 공유 상태 ----------
  const gv = k => (S.G[k] ? S.G[k].v : undefined);
  const gkeys = p => Object.keys(S.G).filter(k => k.startsWith(p) && S.G[k].v);
  const gen = st => gv('gen.' + st) || 0;
  function gset(k, v) {
    S.G[k] = { v, t: Date.now(), by: S.name }; save();
    send('gset', { key: k, value: v, name: S.name });
    derive();
  }
  const STAGE_LOCAL = { silence: () => { S.silence = {}; S.timers.silence = 0; }, secret: () => { S.timers.secret = 0; }, quiz: () => { S.quizPass = []; }, hundred: () => { S.seq = []; S.photoStep = false; }, main: () => { S.order = []; }, youth: () => { S.vseq = []; S.vpool = null; S.finalSec = null; S.cfShown = false; }, oyat: () => {} };
  function wipeLocal() {
    S.quizPass = []; S.silence = {}; S.seq = []; S.order = []; S.photoStep = false; S.vseq = []; S.vpool = null; S.finalSec = null;
    S.unlock = {}; S.timers = {}; S.cfShown = false; S.startedAt = 0; S.gens = {};
  }
  // G → 화면용 상태(S.done, S.words, S.cards) 계산. 바뀌었으면 true
  function derive() {
    const before = JSON.stringify([S.done, S.words, S.cards, S.G]);
    const ep = S.G.epoch ? S.G.epoch.v : '';
    if (ep !== S.epochSeen) { S.epochSeen = ep; if (ep) wipeLocal(); }
    S.done = {}; S.words = []; S.cards = [];
    Object.keys(S.G).forEach(k => {
      const e = S.G[k];
      if (k.startsWith('done.') && e.v) S.done[k.slice(5)] = e.t;
      if (k.startsWith('found.') && e.v) { const c = k.slice(6); if (D.WORDS[c]) S.words.push(c); else if (D.STORY[c]) S.cards.push(c); }
    });
    Object.keys(STAGE_LOCAL).forEach(st => { const g = gen(st); if (S.gens[st] !== g) { if (S.gens[st] !== undefined) STAGE_LOCAL[st](); S.gens[st] = g; } });
    // 멤버·리더 등록 (처음부터 다시 후에도 자동 복구)
    if (S.group && S.name) {
      if (!S.G['m.' + S.name]) { S.G['m.' + S.name] = { v: 1, t: Date.now() }; send('gset', { key: 'm.' + S.name, value: 1, name: S.name }); }
      if (S.leader && !S.G['leader.' + S.name]) { S.G['leader.' + S.name] = { v: 1, t: Date.now() }; send('gset', { key: 'leader.' + S.name, value: 1, name: S.name }); }
    }
    save();
    return before !== JSON.stringify([S.done, S.words, S.cards, S.G]);
  }
  let syncState = '', pulling = false;
  function syncText() {
    if (!C.endpoint) return '';
    if (serverOld || syncState === 'old') return '⚠ 서버(Apps Script) 새 버전 배포가 필요해요';
    if (syncState === 'ok') return '🔄 조 연동됨';
    if (syncState === 'err') return '⚠ 조 연동 안 됨 (인터넷 확인)';
    return '🔄 조 연동 확인 중…';
  }
  function paintSyncLine() { document.querySelectorAll('.syncline').forEach(el => { el.textContent = syncText(); }); }
  async function pullG() {
    if (!C.endpoint || !S.group || pulling) return false;
    if (outbox().some(i => i.type === 'gset' && Date.now() - new Date(i.ts) < 20000)) return false; // 내 변경이 서버에 닿기 전엔 덮어쓰지 않기
    pulling = true; let changed = false;
    try {
      const r = await fetch(C.endpoint + '?action=gstate&group=' + encodeURIComponent(S.group) + '&_=' + Date.now(), { cache: 'no-store' });
      const j = await r.json();
      if (j && j.ok && j.state) { syncState = 'ok'; const was = JSON.stringify(S.G); S.G = j.state; derive(); changed = was !== JSON.stringify(S.G); }
      else syncState = 'old';
    } catch (e) { syncState = 'err'; } finally { pulling = false; paintSyncLine(); }
    return changed;
  }
  setInterval(async () => {
    if (document.hidden || !S.group) return;
    const p = (location.hash || '#/').split('/')[1];
    if (['camera', 'join', ''].includes(p) || p === '#') return;
    const ch = await pullG();
    const ae = document.activeElement;
    if (ch && !(ae && /^(INPUT|TEXTAREA)$/.test(ae.tagName))) router();
  }, 4000);

  // ---------- 역할·길 안내 ----------
  const canLead = () => S.master || S.leader || gkeys('leader.').length === 0;
  const totalMembers = () => Math.max(1, gkeys('m.').length);
  const groupLabel = () => (S.master ? '마스터' : S.group + '조');
  const route = () => S.group ? [...D.THEO_ORDER[S.master ? 1 : S.group], ...D.TAIL] : [];
  const nextStage = () => route().find(id => !S.done[id]);
  const visible = id => S.master || !!S.done[id] || id === nextStage();
  function roomOf(id) {
    const r = C.rooms && C.rooms[id];
    return r ? r.replace(/^신학관\s*/, '') : '방 번호는 스태프 안내를 따르세요';
  }
  function placeLine(id) { const s = D.STAGES[id]; return s.place + (s.place === '신학관' ? ' · ' + roomOf(id) : ''); }
  // 미션 되돌리기: 조 전체에서 이 미션을 다시 열기
  function resetStage(id) {
    gset('done.' + id, 0);
    gset('gen.' + id, gen(id) + 1);
  }
  function lastDone() { const e = Object.entries(S.done).sort((a, b) => b[1] - a[1])[0]; return e && e[0]; }
  function clear(id) {
    if (S.done[id]) return;
    gset('done.' + id, 1);
    send('progress', { stage: id, stageName: D.STAGES[id].name, elapsedSec: S.startedAt ? Math.round((Date.now() - S.startedAt) / 1000) : null });
  }
  // 조 전체 처음부터
  function resetAll() {
    wipeLocal();
    const v = uid();
    S.G = { epoch: { v, t: Date.now() } }; S.epochSeen = v; S.done = {}; S.words = []; S.cards = [];
    setOutbox(outbox().filter(i => i.type !== 'gset' && i.type !== 'found'));
    save(); send('gset', { key: 'epoch', value: v, name: S.name });
    derive();
  }

  // ---------- 확인(ready) 버튼 + 리더 성공 버튼 ----------
  const rdyCount = R => gkeys('rdy.' + R + '.').length;
  const iAmReady = R => !!gv('rdy.' + R + '.' + S.name);
  function gateHTML(R, label, leadLabel) {
    const n = rdyCount(R), m = totalMembers(), all = n >= m;
    let h = '';
    if (label) h += iAmReady(R) ? `<div class="ok-box">✓ 확인했어요 (${n}/${m}명)</div>` : `<button class="btn" id="imready">${label}</button>`;
    else h += `<div class="ok-box">${n}/${m}명 완료</div>`;
    if (canLead()) h += `<button class="btn ${all ? 'alt' : 'ghost'}" id="lead">${all ? '✅ ' + leadLabel + ' (모두 완료!)' : leadLabel + ' — 아직 ' + (m - n) + '명 남음'}</button>`;
    else h += `<p class="hint">리더가 성공을 누르면 모두 다음 미션으로 넘어가요</p>`;
    return h;
  }
  function bindGate(R, onLead) {
    const im = document.getElementById('imready'); if (im) im.onclick = () => { gset('rdy.' + R + '.' + S.name, 1); stage(currentStageId); };
    const ld = document.getElementById('lead');
    if (ld) ld.onclick = () => {
      if (rdyCount(R) < totalMembers() && !S.master && !confirm('아직 완료 안 한 조원이 있어요. 그래도 성공 처리할까요?')) return;
      onLead();
    };
  }
  let currentStageId = '';

  // ---------- 렌더 ----------
  function shell(inner, opts = {}) {
    const back = opts.back ? `<a class="back" href="${opts.back}">← 로드맵</a>` : '<span></span>';
    const who = S.group ? `<span class="who">${groupLabel()}${S.name ? ' · ' + esc(S.name) : ''}${S.master ? ' 🔑' : canLead() && S.leader ? ' ★' : ''}</span>` : '';
    $app.innerHTML = `<header class="bar">${back}${who}</header><main>${inner}</main><footer class="foot"><span id="sync"></span></footer>`;
    paintSync(); window.scrollTo(0, 0);
  }
  const clearedBanner = id => `<div class="clear"><div class="big">미션 클리어!</div><div>말씀 조각을 얻었어요</div><div class="frag">“${D.FRAG[id]}”</div></div>`;
  const nextBtn = () => { const n = nextStage(); return n ? `<a class="btn" href="#/stage/${n}">다음 장소 안내 →</a>` : `<a class="btn" href="#/road">로드맵으로</a>`; };

  function landing() {
    if (S.group) { location.hash = '#/road'; return; }
    shell(`<section class="hero"><div class="leaf">🌿</div><h1>${esc(C.title)}</h1>
      <p class="verse">“나는 마음이 온유하고 겸손하니 나의 멍에를 메고 내게 배우라 그리하면 너희 마음이 쉼을 얻으리니”</p>
      <p class="ref">${esc(C.verseRef)}</p>
      <p class="lead">조원들과 함께 걸으며 미션을 풀고, 말씀 조각 6개를 모아 오늘의 말씀을 완성하세요. 마지막 종착지에서는 따뜻한 차가 기다립니다.</p>
      <a class="btn" href="#/join">시작하기</a></section>`);
  }

  function join() {
    let sel = S.master ? 'T' : (S.group || '');
    shell(`<h2>우리 조 만들기</h2>
      <label>조 번호</label><div class="chips" id="gsel">${[1, 2, 3, 4, 5, 6].map(n => `<button class="chip ${sel === n ? 'on' : ''}" data-g="${n}">${n}조</button>`).join('')}<button class="chip ${sel === 'T' ? 'on' : ''}" data-g="T">🔑</button></div>
      <label>내 이름</label><input id="nm" value="${esc(S.name)}" placeholder="이름" autocomplete="off">
      <label class="row"><input type="checkbox" id="ld" ${S.leader ? 'checked' : ''}> 나는 조 리더예요 (미션 성공 버튼을 눌러요)</label>
      <button class="btn" id="go">로드맵 보기</button>
      <p class="hint">조원 모두 같은 조 번호로 각자 폰에서 가입하세요. 같은 조는 진행 상황이 함께 연동돼요.</p>`);
    document.getElementById('gsel').onclick = e => {
      const b = e.target.closest('[data-g]'); if (!b) return;
      if (b.dataset.g === 'T') { const code = prompt('마스터 코드를 입력하세요'); if (code !== C.masterCode) return alert('코드가 달라요'); sel = 'T'; }
      else sel = +b.dataset.g;
      document.querySelectorAll('#gsel .chip').forEach(x => x.classList.toggle('on', x === b));
    };
    document.getElementById('go').onclick = () => {
      if (!sel) return alert('조 번호를 골라 주세요');
      const nm = document.getElementById('nm').value.trim();
      if (!nm) return alert('이름을 적어 주세요');
      if (S.group && S.group !== sel) { S = blank(); }
      S.group = sel; S.master = sel === 'T'; S.name = nm; S.leader = document.getElementById('ld').checked || S.master;
      save(); send('join', { name: nm, leader: S.leader });
      derive();
      const pq = sessionStorage.getItem('rest.pendingQr');
      if (pq) { sessionStorage.removeItem('rest.pendingQr'); location.hash = '#/qr/' + pq; } else location.hash = '#/road';
      router();
    };
  }

  function road() {
    if (!S.group) return join();
    const r = route(), nxt = nextStage();
    const doneN = r.filter(id => S.done[id]).length;
    const steps = r.map((id, i) => {
      const st = D.STAGES[id], d = !!S.done[id], cur = id === nxt;
      if (!visible(id)) return `<div class="step locked"><span class="dot">🔒</span><span class="txt"><b>???</b><small>앞 미션을 클리어하면 공개돼요</small></span></div>`;
      const t = D.TARGETS[id] ? `<span class="t">목표 ${D.TARGETS[id]}</span>` : '';
      return `<a class="step ${d ? 'done' : ''} ${cur ? 'cur' : ''}" href="#/stage/${id}"><span class="dot">${d ? '✓' : i + 1}</span><span class="txt"><b>${st.icon} ${st.name}</b><small>${esc(placeLine(id))}</small></span>${t}</a>`;
    }).join('');
    const start = S.startedAt || !canLead() ? '' : `<button class="btn alt" id="start">▶ 출발! (규칙 설명이 끝나면 리더가 눌러요)</button>`;
    const names = gkeys('m.').map(k => k.slice(2));
    const members = names.length ? `<p class="hint">우리 조 ${names.length}명: ${names.map(esc).join(', ')}</p>` : '';
    const mnote = S.master ? `<p class="hint">🔑 마스터 모드: 모든 단계가 열려 있어요. 기록은 현황판에 섞이지 않아요.</p>` : '';
    const ctrl = canLead() ? `<button id="undo" ${lastDone() ? '' : 'disabled'}>↩ 방금 클리어 취소</button><button id="rst">⟲ 처음부터 다시</button>` : '';
    shell(`<h2>${groupLabel()} 로드맵 <span class="count">${doneN}/${r.length}</span></h2>${mnote}${members}${start}
      ${nxt ? `<a class="next" href="#/stage/${nxt}"><small>다음 목적지</small><b>${D.STAGES[nxt].icon} ${esc(D.STAGES[nxt].place)}</b><span>${D.STAGES[nxt].name}</span></a>` : `<div class="next ok"><b>모든 미션 완료!</b><span>청년관에서 말씀을 완성해 주세요</span></div>`}
      <div class="steps">${steps}</div>
      <div class="links"><a href="#/map">🗺 지도</a><a href="#/verse">📜 말씀 조각 ${Object.keys(S.done).filter(k => D.FRAG[k]).length}/6</a></div>
      <div class="links sm">${ctrl}<a href="#/join">👥 조 바꾸기</a></div><p class="hint syncline">${syncText()}</p>`);
    const u = document.getElementById('undo'); if (u) u.onclick = () => { const id = lastDone(); if (id && confirm(`"${D.STAGES[id].name}" 클리어를 취소하고 조 전체가 다시 할까요?`)) { resetStage(id); road(); } };
    const rs = document.getElementById('rst'); if (rs) rs.onclick = () => { if (confirm('조 전체 진행(QR 발견 포함)을 모두 지우고 처음부터 다시 할까요?') && confirm('정말 초기화할까요?')) { resetAll(); road(); } };
    const b = document.getElementById('start'); if (b) b.onclick = () => { S.startedAt = Date.now(); save(); send('start', {}); road(); };
  }

  function mapPage() {
    const r = route(), nxt = nextStage();
    const nodes = r.map(id => {
      const st = D.STAGES[id];
      if (!visible(id)) return `<div class="node locked"><span>🔒</span><b>???</b><small>다음 장소는 비밀</small></div>`;
      return `<div class="node ${S.done[id] ? 'done' : ''} ${id === nxt ? 'cur' : ''}"><span>${st.icon}</span><b>${st.name}</b><small>${esc(st.place)}</small></div>`;
    }).join('<div class="arrow">↓</div>');
    shell(`<h2>지도</h2><img id="mapimg" class="mapimg" alt="캠퍼스 지도" src="${esc(C.mapImage)}" onerror="this.remove()">
      <p class="hint">아래는 이동 순서 개략도입니다. 리더를 따라 자유롭게 이동하되 순서는 지켜 주세요.</p><div class="flow">${nodes}</div>`, { back: '#/road' });
  }

  function verse() {
    const got = D.VERSE_ORDER.filter(k => S.done[k]);
    const cells = D.VERSE_ORDER.map(k => S.done[k] ? `<span class="piece">${D.FRAG[k]}</span>` : `<span class="piece empty">?</span>`).join(' ');
    shell(`<h2>말씀 조각 ${got.length}/6</h2><div class="verse-box">${cells}</div><p class="hint">${esc(C.verseRef)} · 미션을 클리어할 때마다 조각이 열려요. 순서는 청년관에서 맞춥니다.</p>`, { back: '#/road' });
  }

  function scan() {
    shell(`<h2>QR 코드 직접 입력</h2><p class="hint">QR이 안 읽힐 때 QR 아래 적힌 코드(예: h3, q1, r1)를 넣어 주세요.</p><input id="code" placeholder="코드" autocomplete="off" autocapitalize="off"><button class="btn" id="ok">확인</button>`, { back: '#/road' });
    document.getElementById('ok').onclick = () => { const v = document.getElementById('code').value.trim().toLowerCase(); if (v) location.hash = '#/qr/' + v; };
  }

  // 카메라 QR 스캐너
  let camStop = null;
  function stopCam() { if (camStop) { camStop(); camStop = null; } }
  function loadJsQR() {
    return window.jsQR ? Promise.resolve() : new Promise((res, rej) => { const s = document.createElement('script'); s.src = 'js/jsQR.js'; s.onload = res; s.onerror = rej; document.head.appendChild(s); });
  }
  function codeFrom(text) { const m = String(text).match(/#\/qr\/([A-Za-z0-9_-]+)/); return m ? m[1].toLowerCase() : null; }
  async function camera(back) {
    const bk = ['main', 'quiz'].includes(back) ? back : 'hundred';
    const backHref = visible(bk) ? '#/stage/' + bk : '#/road';
    shell(`<h2>QR 찍기</h2><div class="cam"><video id="v" playsinline muted></video></div><div class="msg" id="msg"></div>
      <p class="hint">QR이 화면 가운데 들어오게 비춰 주세요. 찍으면 우리 조 모두에게 공유돼요.</p>
      <a class="btn ghost" href="#/scan">코드 직접 입력</a><a class="btn ghost" href="${backHref}">← 돌아가기</a>`, { back: '#/road' });
    const msg = document.getElementById('msg'), v = document.getElementById('v');
    if (!navigator.mediaDevices || !navigator.mediaDevices.getUserMedia) { msg.textContent = '이 브라우저는 카메라를 쓸 수 없어요. 폰 기본 카메라로 QR을 찍어 주세요.'; return; }
    let stream, alive = true;
    try { stream = await navigator.mediaDevices.getUserMedia({ video: { facingMode: { ideal: 'environment' } }, audio: false }); }
    catch (e) { msg.textContent = '카메라 권한을 허용해 주세요. 안 되면 폰 기본 카메라로 QR을 찍어도 돼요.'; return; }
    camStop = () => { alive = false; stream.getTracks().forEach(t => t.stop()); };
    v.srcObject = stream; await v.play().catch(() => {});
    const det = window.BarcodeDetector ? new BarcodeDetector({ formats: ['qr_code'] }) : null;
    if (!det) { try { await loadJsQR(); } catch (e) { msg.textContent = '스캐너를 불러오지 못했어요.'; return; } }
    const cv = document.createElement('canvas'), cx = cv.getContext('2d', { willReadFrequently: true });
    const tick = async () => {
      if (!alive) return;
      if (v.videoWidth) {
        let text = null;
        try {
          if (det) { const r = await det.detect(v); if (r[0]) text = r[0].rawValue; }
          else { cv.width = v.videoWidth; cv.height = v.videoHeight; cx.drawImage(v, 0, 0); const r = jsQR(cx.getImageData(0, 0, cv.width, cv.height).data, cv.width, cv.height); if (r) text = r.data; }
        } catch (e) {}
        const c = text && codeFrom(text);
        if (c) { stopCam(); location.hash = '#/qr/' + c; return; }
        if (text) msg.textContent = '이 앱의 QR이 아니에요.';
      }
      setTimeout(tick, 250);
    };
    tick();
  }

  // QR 스캔 착지
  function qr(code) {
    if (!S.group) { sessionStorage.setItem('rest.pendingQr', code); return join(); }
    const w = D.WORDS[code], s = D.STORY[code], room = D.ROOMQR[code];
    if (room) {
      S.unlock[room] = 1; save();
      if (visible(room)) { location.hash = '#/stage/' + room; return; }
      return shell(`<div class="qrcard"><div class="word">🔒</div><p class="story">아직 이 미션 차례가 아니에요.<br>앞 미션을 먼저 마쳐 주세요.</p></div><a class="btn" href="#/road">로드맵으로</a>`);
    }
    if (w) {
      const isNew = !S.words.includes(code);
      gset('found.' + code, 1);
      shell(`<div class="qrcard"><small>${isNew ? '새 단어를 찾았어요' : '이미 찾은 단어예요'}</small><div class="word">${w.t}</div>
        <p class="hint">이 단어가 말씀에 들어갈지는 조원들이 함께 정해 보세요. 진짜일 수도, 함정일 수도 있어요.</p></div>
        <p class="hint">✓ 우리 조 모두에게 공유돼요 (약 4초)</p><a class="btn" href="#/camera/hundred">📷 다음 QR 찍기</a><a class="btn ghost" href="#/stage/hundred">100주년 미션으로</a>`);
    } else if (s) {
      const isNew = !S.cards.includes(code);
      gset('found.' + code, 1);
      shell(`<div class="qrcard"><small>이야기 카드 ${s.mark}</small><p class="story">${s.t}</p><p class="hint">성경에 나온 순서는 몇 번째일까요?</p></div><p class="hint">✓ 우리 조 모두에게 공유돼요 (약 4초)</p><a class="btn" href="#/camera/main">📷 다음 QR 찍기</a><a class="btn ghost" href="#/stage/main">본당 미션으로</a>`);
    } else shell(`<p>알 수 없는 코드예요: ${esc(code)}</p><a class="btn" href="#/road">로드맵으로</a>`);
  }

  // ---------- 스테이지 ----------
  function stage(id) {
    if (!S.group) return join();
    const st = D.STAGES[id]; if (!st || !visible(id)) { location.hash = '#/road'; return road(); }
    currentStageId = id;
    const head = `<div class="shead"><span class="ico">${st.icon}</span><div><small>${esc(placeLine(id))}</small><h2>${st.name}</h2></div></div><p class="brief">${st.brief}</p>`;
    if (S.done[id] && id !== 'youth') {
      shell(head + clearedBanner(id) + nextBtn() + (canLead() ? `<button class="btn ghost" id="redo">↩ 이 미션 조 전체 다시 하기</button>` : ''), { back: '#/road' });
      const rd = document.getElementById('redo'); if (rd) rd.onclick = () => { if (confirm('조 전체가 이 미션을 다시 할까요?')) { resetStage(id); stage(id); } };
      return;
    }
    ({ silence, secret, quiz, hundred, oyat, main: mainStage, youth }[id])(head);
    paintSyncLine();
  }

  // 타이머: 끝나는 시각을 저장해 화면이 다시 그려져도 이어서 감
  function timer(min, id) {
    const end = S.timers[id] || 0, left = end ? Math.max(0, Math.round((end - Date.now()) / 1000)) : min * 60;
    return `<div class="timer ${end && left === 0 ? 'end' : ''}" id="tm" data-id="${id}" data-sec="${min * 60}">${Math.floor(left / 60)}:${String(left % 60).padStart(2, '0')}</div><button class="btn ghost" id="tmbtn">${end ? '다시 시작' : '타이머 시작'}</button>`;
  }
  let tmH = 0;
  function bindTimer() {
    clearInterval(tmH);
    const el = document.getElementById('tm'), b = document.getElementById('tmbtn'); if (!el || !b) return;
    const id = el.dataset.id, tick = () => {
      if (!document.body.contains(el)) return clearInterval(tmH);
      const left = Math.max(0, Math.round((S.timers[id] - Date.now()) / 1000));
      el.textContent = Math.floor(left / 60) + ':' + String(left % 60).padStart(2, '0');
      if (left <= 0) { clearInterval(tmH); el.classList.add('end'); navigator.vibrate && navigator.vibrate([300, 150, 300]); }
    };
    if (S.timers[id]) { tick(); tmH = setInterval(tick, 1000); }
    b.onclick = () => { S.timers[id] = Date.now() + (+el.dataset.sec) * 1000; save(); b.textContent = '다시 시작'; el.classList.remove('end'); clearInterval(tmH); tick(); tmH = setInterval(tick, 1000); };
  }

  // 침묵 정렬: 리더가 키워드를 뽑으면 조 전체 화면에 같은 키워드가 뜸. 2번 성공하면 클리어
  function silence(head) {
    const g = gen('silence'), P = `sil.g${g}.`;
    const ok1 = !!gv(P + 'ok1'), round = ok1 ? 2 : 1;
    const k = gv(P + 'k' + round), lead = canLead();
    let body = `<ul class="rules"><li>말·글자·휴대폰 화면·손가락 숫자 금지, 눈빛과 몸짓만</li><li>다 섰다고 느끼면 동시에 손 들기</li><li>리더가 줄 선 순서대로 한 명씩 값을 말해 확인</li></ul>
      <p class="hint"><b>성공 ${ok1 ? 1 : 0} / 2</b> · ${round}번째 키워드</p>`;
    if (k === undefined) {
      body += lead ? `<button class="btn" id="draw">🎲 키워드 뽑기</button>` : `<div class="ok-box">리더가 키워드를 뽑는 중이에요…</div>`;
    } else {
      body += `<div class="kwbig">${esc(D.KEYWORDS[k])}</div>`;
      body += gateHTML(`sil${round}.${k}.g${g}`, '줄 섰어요 ✋', '성공');
      if (lead) body += `<button class="btn ghost" id="redraw">🎲 다른 키워드로 다시 뽑기</button>`;
    }
    shell(head + body, { back: '#/road' });
    bindTimer();
    const pick = () => {
      const used = [gv(P + 'k1')].filter(x => x !== undefined && round === 2), cur = gv(P + 'k' + round);
      const pool = D.KEYWORDS.map((_, i) => i).filter(i => !used.includes(i) && i !== cur);
      gset(P + 'k' + round, pool[Math.floor(Math.random() * pool.length)]); silence(head);
    };
    const d = document.getElementById('draw'); if (d) d.onclick = pick;
    const rd = document.getElementById('redraw'); if (rd) rd.onclick = pick;
    if (k !== undefined) bindGate(`sil${round}.${k}.g${g}`, () => { gset(P + 'ok' + round, 1); if (round === 2) { clear('silence'); } stage('silence'); });
  }

  function secret(head) {
    const R = `secret.g${gen('secret')}`;
    shell(head + `<ol class="rules"><li>스태프가 뽑기로 정해 준 미션을 확인해요.</li><li>조원 중 <b>한 명</b>은 미션을 모르는 사람이에요. <b>뒤돌아서거나 눈을 감고</b> 기다려요.</li><li>말·몸짓 힌트 금지! <b>박수 소리 크기</b>로만 이끌어요. (가까우면 크게, 멀면 작게)</li><li>미션이 끝나면 조원 모두 아래 버튼을 눌러요.</li></ol>
      ${timer(9, 'secret')}${gateHTML(R, '미션 끝! ✋', '성공')}`, { back: '#/road' });
    bindTimer(); bindGate(R, () => { clear('secret'); stage('secret'); });
  }

  // 조마다 문제 은행에서 3문제를 고르되, 같은 조는 같은 문제(조 번호 + 되돌리기 횟수로 고정)
  function quizPicks() {
    let seed = (S.master ? 99 : +S.group || 1) * 7919 + gen('quiz') * 104729;
    const rnd = () => (seed = (seed * 1103515245 + 12345) % 2147483648) / 2147483648;
    const idx = D.QUIZ.map((_, i) => i);
    for (let i = idx.length - 1; i > 0; i--) { const j = Math.floor(rnd() * (i + 1)); [idx[i], idx[j]] = [idx[j], idx[i]]; }
    return idx.slice(0, D.QUIZ_N).map(i => D.QUIZ[i]);
  }
  // 퀴즈: 201호 문 앞 QR을 찍어야 열림. 각자 풀고, 리더가 성공을 누르면 조 전체가 넘어감
  function quiz(head) {
    const R = `quiz.g${gen('quiz')}`;
    if (!S.unlock.quiz && !S.master) {
      shell(head + `<div class="qrcard"><div class="word">📷</div><p class="story">201호 문 앞에 붙은 QR을 찍으면 퀴즈가 열려요.</p></div>
        <a class="btn alt" href="#/camera/quiz">📷 QR 찍기</a>${canLead() ? `<button class="btn ghost" id="forceopen">QR이 안 될 때: 그냥 열기</button>` : ''}`, { back: '#/road' });
      const f = document.getElementById('forceopen'); if (f) f.onclick = () => { S.unlock.quiz = 1; save(); quiz(head); };
      return;
    }
    const picks = quizPicks(), i = S.quizPass.length;
    if (i >= picks.length) {
      if (!iAmReady(R)) gset('rdy.' + R + '.' + S.name, 1);
      shell(head + `<div class="ok-box">내 퀴즈 완료! 🎉 조원들을 기다려요</div>` + gateHTML(R, null, '성공'), { back: '#/road' });
      bindGate(R, () => { clear('quiz'); stage('quiz'); });
      return;
    }
    const q = picks[i];
    shell(head + `<div class="q"><small>${i + 1} / ${picks.length}</small><p>${q.q}</p>${q.a.map((a, j) => `<button class="opt" data-j="${j}">${a}</button>`).join('')}<div class="msg" id="msg"></div></div>`, { back: '#/road' });
    document.querySelectorAll('.opt').forEach(b => b.onclick = () => {
      if (+b.dataset.j === q.c) { S.quizPass.push(i); save(); quiz(head); }
      else { b.classList.add('wrong'); b.disabled = true; document.getElementById('msg').textContent = '아쉬워요, 조원들과 함께 다시 생각해 보세요.'; }
    });
  }

  function hundred(head) {
    const found = S.words, seq = S.seq;
    const chips = found.map(c => `<button class="chip word ${seq.includes(c) ? 'used' : ''}" data-c="${c}" ${seq.includes(c) ? 'disabled' : ''}>${D.WORDS[c].t}</button>`).join('') || '<span class="hint">아직 찾은 단어가 없어요. QR을 찾아 스캔해 보세요.</span>';
    const line = seq.map(c => `<button class="chip pick" data-r="${c}">${D.WORDS[c].t} ✕</button>`).join('') || '<span class="hint">단어를 눌러 순서대로 놓아요</span>';
    const solved = S.photoStep || false;
    let body;
    if (!solved) {
      body = `<h3>1. 찾은 단어 (${found.length}개)</h3><div class="chips">${chips}</div><h3>2. 말씀 순서 (살전 5:16~17)</h3><div class="chips line">${line}</div>
        <button class="btn" id="chk" ${seq.length < 2 ? 'disabled' : ''}>순서 확인</button><div class="msg" id="msg"></div>`;
    } else {
      body = `<div class="ok-box">말씀 완성! “항상 기뻐하라 쉬지 말고 기도하라”</div><h3>3. 다 같이 기도하는 사진</h3><p class="hint">조원이 모두 나오게, 손 모으고 한 장! 올리면 클리어예요. 업로드가 안 되면 화면을 스태프에게 보여 주세요.</p>
        <label class="btn alt filebtn">📷 사진 찍기/선택<input type="file" id="ph" accept="image/*" hidden></label><img id="prev" class="prev" hidden><div class="msg" id="msg"></div>`;
    }
    shell(head + `<a class="btn alt" href="#/camera/hundred">📷 QR 찍기</a><p class="hint">조원이 찍은 단어도 자동으로 모여요 (약 4초)</p><p class="hint syncline">${syncText()}</p>` + body, { back: '#/road' });
    document.querySelectorAll('.chip.word').forEach(b => b.onclick = () => { S.seq.push(b.dataset.c); save(); hundred(head); });
    document.querySelectorAll('.chip.pick').forEach(b => b.onclick = () => { S.seq = S.seq.filter(x => x !== b.dataset.r); save(); hundred(head); });
    const chk = document.getElementById('chk');
    if (chk) chk.onclick = () => {
      const t = S.seq.map(c => D.WORDS[c].t).join('|');
      if (t === D.WORD_ANSWER.join('|')) { S.photoStep = true; save(); hundred(head); }
      else document.getElementById('msg').textContent = '조금 달라요. 함정 단어가 섞였거나 순서가 다를 수 있어요.';
    };
    const ph = document.getElementById('ph');
    if (ph) ph.onchange = async () => {
      const f = ph.files[0]; if (!f) return;
      const msg = document.getElementById('msg'); msg.textContent = '사진 처리 중…';
      try {
        const data = await shrink(f);
        const img = document.getElementById('prev'); img.src = data; img.hidden = false;
        send('photo', { name: S.name, image: data });
        msg.textContent = C.endpoint ? '업로드 중이에요. 잠시 후 클리어됩니다.' : '저장했어요!';
        setTimeout(() => { clear('hundred'); stage('hundred'); }, 1200);
      } catch (e) { msg.textContent = '사진을 읽지 못했어요. 다시 시도해 주세요.'; }
    };
  }
  function shrink(file) {
    return new Promise((res, rej) => {
      const url = URL.createObjectURL(file), im = new Image();
      im.onload = () => { const m = 1280, k = Math.min(1, m / Math.max(im.width, im.height)); const c = document.createElement('canvas'); c.width = Math.round(im.width * k); c.height = Math.round(im.height * k); c.getContext('2d').drawImage(im, 0, 0, c.width, c.height); URL.revokeObjectURL(url); res(c.toDataURL('image/jpeg', 0.72)); };
      im.onerror = rej; im.src = url;
    });
  }

  // 오얏봉: 각자 기도문 제출 → 서로의 기도제목을 위해 함께 기도 → 리더가 성공
  function oyat(head) {
    const R = `oyat.g${gen('oyat')}`;
    if (!iAmReady(R)) {
      shell(head + `<label>나를 위한 한 줄 기도</label><textarea id="p1" rows="2" maxlength="200" placeholder="예: 주님, 오늘 제 마음에 쉼을 주세요"></textarea>
        <label>옆 사람을 위한 한 줄 기도</label><textarea id="p2" rows="2" maxlength="200" placeholder="예: 옆에 있는 친구에게도 평안을 주세요"></textarea>
        <button class="btn" id="sub">기도 보내기</button><div class="msg" id="msg"></div>
        <p class="hint">조 번호(${groupLabel()})와 이름이 함께 저장됩니다. 조원에게만 보이고 전체 공개는 하지 않아요.</p>`, { back: '#/road' });
      document.getElementById('sub').onclick = () => {
        const p1 = document.getElementById('p1').value.trim(), p2 = document.getElementById('p2').value.trim();
        if (!p1 || !p2) return (document.getElementById('msg').textContent = '나를 위한 기도와 옆 사람을 위한 기도를 모두 한 줄씩 적어 주세요.');
        send('prayer', { name: S.name, mine: p1, neighbor: p2 }); gset('pr.' + R + '.' + S.name, { m: p1, n: p2 }); gset('rdy.' + R + '.' + S.name, 1); oyat(head);
      };
      return;
    }
    const prs = gkeys('pr.' + R + '.').map(k => { const v = gv('pr.' + R + '.' + k.slice(('pr.' + R + '.').length)) || {}; return `<div class="brief"><b>${esc(k.slice(('pr.' + R + '.').length))}</b><br>${esc(v.m || '')}${v.n ? '<br><small>옆 사람: ' + esc(v.n) + '</small>' : ''}</div>`; }).join('');
    const hasPhoto = !!gv('photo.' + R);
    const photoBox = hasPhoto ? `<div class="ok-box">📷 십자가·돌비석 사진 업로드 완료!</div>`
      : `<h3>📷 오얏봉 십자가와 돌비석 앞 단체 사진</h3><p class="hint">십자가와 돌비석이 함께 나오게 조원이 모두 모여 한 장! 조원 중 한 명만 올리면 돼요.</p>
        <label class="btn alt filebtn">📷 사진 찍기/선택<input type="file" id="ph" accept="image/*" hidden></label><img id="prev" class="prev" hidden><div class="msg" id="msg"></div>`;
    shell(head + `<div class="ok-box">기도문을 보냈어요 🙏 (${rdyCount(R)}/${totalMembers()}명)</div><p class="brief">조원들의 기도제목이에요. 서로를 위해 함께 기도해 주세요. 기도를 마치면 리더가 성공을 눌러요.</p>${prs}${photoBox}` + gateHTML(R, null, '기도 마치고 다음으로'), { back: '#/road' });
    const ph = document.getElementById('ph');
    if (ph) ph.onchange = async () => {
      const f = ph.files[0]; if (!f) return;
      const msg = document.getElementById('msg'); msg.textContent = '사진 처리 중…';
      try {
        const data = await shrink(f);
        const img = document.getElementById('prev'); img.src = data; img.hidden = false;
        send('photo', { name: S.name, image: data, stage: 'oyat' });
        gset('photo.' + R, 1);
        msg.textContent = '업로드 중이에요!';
        setTimeout(() => oyat(head), 1000);
      } catch (e) { msg.textContent = '사진을 읽지 못했어요. 다시 시도해 주세요.'; }
    };
    bindGate(R, () => {
      if (!gv('photo.' + R) && !S.master && !confirm('아직 사진을 안 올렸어요. 그래도 성공 처리할까요? (스태프에게 사진 확인)')) return;
      clear('oyat'); stage('oyat');
    });
  }

  function mainStage(head) {
    const cards = S.cards.slice();
    let order = S.order.filter(c => cards.includes(c));
    const pool = cards.filter(c => !order.includes(c));
    const poolH = pool.map(c => `<button class="story-chip" data-a="${c}"><span class="mk">${D.STORY[c].mark}</span>${D.STORY[c].t}</button>`).join('') || '<span class="hint">QR을 스캔해 카드를 모아 보세요 (6장).</span>';
    const ordH = order.map((c, i) => `<div class="ord"><span class="n">${i + 1}</span><span class="mk">${D.STORY[c].mark}</span><span class="tx">${D.STORY[c].t}</span><span class="mv"><button data-u="${i}">▲</button><button data-d="${i}">▼</button><button data-x="${c}">✕</button></span></div>`).join('') || '<span class="hint">카드를 눌러 순서대로 놓아요</span>';
    shell(head + `<a class="btn alt" href="#/camera/main">📷 QR 찍기</a><p class="hint">조원이 찍은 카드도 자동으로 모여요 (약 4초)</p><p class="hint syncline">${syncText()}</p><h3>찾은 카드 (${cards.length}/6)</h3><div class="pool">${poolH}</div><h3>내가 놓은 순서</h3><div class="ordl">${ordH}</div>
      <button class="btn" id="chk" ${order.length < 6 ? 'disabled' : ''}>순서 확인</button><div class="msg" id="msg"></div>`, { back: '#/road' });
    document.querySelectorAll('[data-a]').forEach(b => b.onclick = () => { S.order = [...order, b.dataset.a]; save(); mainStage(head); });
    document.querySelectorAll('[data-x]').forEach(b => b.onclick = () => { S.order = order.filter(c => c !== b.dataset.x); save(); mainStage(head); });
    document.querySelectorAll('[data-u]').forEach(b => b.onclick = () => { const i = +b.dataset.u; if (i > 0) { [order[i - 1], order[i]] = [order[i], order[i - 1]]; S.order = order; save(); mainStage(head); } });
    document.querySelectorAll('[data-d]').forEach(b => b.onclick = () => { const i = +b.dataset.d; if (i < order.length - 1) { [order[i + 1], order[i]] = [order[i], order[i + 1]]; S.order = order; save(); mainStage(head); } });
    const chk = document.getElementById('chk');
    if (chk) chk.onclick = () => {
      const ok = order.every((c, i) => D.STORY[c].n === i + 1);
      if (ok) { clear('main'); stage('main'); } else document.getElementById('msg').textContent = '순서가 조금 달라요. 이야기의 흐름을 따라 다시 맞춰 보세요.';
    };
  }

  function youth(head) {
    const need = route().filter(id => id !== 'youth' && !S.done[id]);
    if (need.length) {
      return shell(head + `<div class="ok-box">아직 안 한 미션이 ${need.length}개 있어요</div><ul class="rules">${need.map(id => `<li><a href="#/stage/${id}">${D.STAGES[id].icon} ${D.STAGES[id].name}</a></li>`).join('')}</ul>
      <p class="hint">모두 마치고 오면 말씀을 완성할 수 있어요. 그래도 먼저 도착했다면 차 한 잔 하며 쉬어요 ☕</p>`, { back: '#/road' });
    }
    if (S.done.youth) {
      const sec = S.finalSec, mm = sec != null ? Math.floor(sec / 60) + '분 ' + (sec % 60) + '초' : '';
      shell(head + `<div class="clear"><div class="big">🎉 완성!</div><div class="frag">“나는 마음이 온유하고 겸손하니 나의 멍에를 메고 내게 배우라 그리하면 너희 마음이 쉼을 얻으리니”</div><div>${esc(C.verseRef)}</div>${mm ? `<div>걸린 시간 ${mm}</div>` : ''}</div><p class="hint">이 화면을 스태프에게 보여 주세요. 차를 드시며 쉬세요 ☕</p><button class="btn alt" id="cf">🎉 다시 축하하기</button>`, { back: '#/road' });
      document.getElementById('cf').onclick = confetti;
      if (!S.cfShown) { S.cfShown = true; save(); setTimeout(confetti, 200); }
      return;
    }
    if (!S.vpool || S.vpool.length !== 6) { S.vpool = [...D.VERSE_ORDER].sort(() => Math.random() - .5); save(); }
    const pool = S.vpool;
    const seq = S.vseq || [];
    shell(head + `<h3>말씀 조각을 순서대로 눌러요</h3><div class="chips">${pool.map(k => `<button class="chip word ${seq.includes(k) ? 'used' : ''}" data-k="${k}" ${seq.includes(k) ? 'disabled' : ''}>${D.FRAG[k]}</button>`).join('')}</div>
      <div class="verse-box">${seq.map(k => D.FRAG[k]).join(' ') || '…'}</div><button class="btn ghost" id="reset">처음부터</button><div class="msg" id="msg"></div>`, { back: '#/road' });
    document.querySelectorAll('[data-k]').forEach(b => b.onclick = () => {
      S.vseq = [...seq, b.dataset.k]; save();
      if (S.vseq.length === 6) {
        if (S.vseq.join() === D.VERSE_ORDER.join()) { S.finalSec = S.startedAt ? Math.round((Date.now() - S.startedAt) / 1000) : null; S.vseq = []; save(); clear('youth'); stage('youth'); return; }
        S.vseq = []; save(); youth(head); document.getElementById('msg').textContent = '순서가 달라요. 다시 해 봐요!'; return;
      }
      youth(head);
    });
    document.getElementById('reset').onclick = () => { S.vseq = []; save(); youth(head); };
  }

  // ---------- 컨페티 ----------
  function confetti() {
    if (window.matchMedia && matchMedia('(prefers-reduced-motion: reduce)').matches) return;
    const cv = document.createElement('canvas'); cv.style.cssText = 'position:fixed;inset:0;width:100%;height:100%;pointer-events:none;z-index:99';
    const W = cv.width = innerWidth, H = cv.height = innerHeight; document.body.appendChild(cv);
    const cx = cv.getContext('2d'), cols = ['#3f6b4f', '#d98c3f', '#f2c94c', '#e07a8f', '#5aa9e6', '#9b7ede'];
    const P = Array.from({ length: 160 }, (_, i) => ({ x: W / 2 + (Math.random() - .5) * 60, y: H * .55, vx: (Math.random() - .5) * 14, vy: -8 - Math.random() * 12, s: 6 + Math.random() * 6, r: Math.random() * 6, vr: (Math.random() - .5) * .4, c: cols[i % cols.length], d: Math.random() * 40 }));
    let t0 = performance.now();
    (function f(t) {
      const el = t - t0; cx.clearRect(0, 0, W, H);
      P.forEach(p => { p.vy += .35; p.vx *= .99; p.x += p.vx; p.y += p.vy; p.r += p.vr; cx.save(); cx.translate(p.x, p.y); cx.rotate(p.r); cx.fillStyle = p.c; cx.globalAlpha = Math.max(0, 1 - el / 5000); cx.fillRect(-p.s / 2, -p.s / 4, p.s, p.s / 2); cx.restore(); });
      if (el < 5000) requestAnimationFrame(f); else cv.remove();
    })(t0);
  }

  // ---------- 라우터 ----------
  function router() {
    stopCam();
    const [, p, a] = (location.hash || '#/').split('/');
    try {
      if (p === 'join') join();
      else if (p === 'road') road();
      else if (p === 'map') mapPage();
      else if (p === 'verse') verse();
      else if (p === 'scan') scan();
      else if (p === 'stage') stage(a);
      else if (p === 'qr') qr(a);
      else if (p === 'camera') camera(a);
      else landing();
    } catch (e) { console.error(e); shell(`<p>문제가 생겼어요.</p><a class="btn" href="#/road">로드맵으로</a>`); }
  }
  window.addEventListener('hashchange', router);
  derive();
  const pq = S.group && sessionStorage.getItem('rest.pendingQr');
  if (pq) { sessionStorage.removeItem('rest.pendingQr'); location.hash = '#/qr/' + pq; }
  router(); flush(); pullG().then(ch => { if (ch) router(); });
  window.__rest = { S: () => S, reset: () => { localStorage.removeItem(KEY); S = blank(); } };
})();
