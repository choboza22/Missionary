(function () {
  const C = window.CONFIG, D = window.DATA;
  const KEY = 'rest.v1', OUTBOX = 'rest.outbox.v1';
  const $app = document.getElementById('app');

  // ---------- 상태 ----------
  const blank = () => ({ group: 0, name: '', leader: false, members: [], startedAt: 0, done: {}, words: [], cards: [], seq: [], order: [], silence: {}, quizPass: [], photoDone: false });
  let S = load();
  function load() { try { return Object.assign(blank(), JSON.parse(localStorage.getItem(KEY) || '{}')); } catch (e) { return blank(); } }
  function save() { try { localStorage.setItem(KEY, JSON.stringify(S)); } catch (e) {} }
  const esc = s => String(s).replace(/[&<>"']/g, c => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c]));

  // ---------- 전송(오프라인 대기열) ----------
  function outbox() { try { return JSON.parse(localStorage.getItem(OUTBOX) || '[]'); } catch (e) { return []; } }
  function setOutbox(a) { try { localStorage.setItem(OUTBOX, JSON.stringify(a)); } catch (e) {} }
  function send(type, payload) {
    const item = { id: Date.now() + '-' + Math.random().toString(36).slice(2, 7), type, group: S.group, ts: new Date().toISOString(), ...payload };
    const a = outbox(); a.push(item); setOutbox(a); flush();
  }
  let flushing = false;
  async function flush() {
    if (!C.endpoint || flushing) return;
    flushing = true;
    try {
      let a = outbox();
      for (const it of a.slice()) {
        try {
          const r = await fetch(C.endpoint, { method: 'POST', headers: { 'Content-Type': 'text/plain;charset=utf-8' }, body: JSON.stringify(it) });
          const j = await r.json();
          if (!j.ok) throw new Error(j.error || 'fail');
          a = outbox().filter(x => x.id !== it.id); setOutbox(a);
        } catch (e) { break; }
      }
    } finally { flushing = false; paintSync(); }
  }
  function pending() { return outbox().length; }
  function paintSync() {
    const el = document.getElementById('sync'); if (!el) return;
    if (!C.endpoint) { el.textContent = '저장: 이 폰에만'; return; }
    const n = pending(); el.textContent = n ? `전송 대기 ${n}건` : '전송 완료 ✓';
  }
  window.addEventListener('online', flush);
  setInterval(flush, 15000);

  // ---------- 길 안내 ----------
  const route = () => S.group ? [...D.THEO_ORDER[S.group], ...D.TAIL] : [];
  const nextStage = () => route().find(id => !S.done[id]);
  const visible = id => !!S.done[id] || id === nextStage();
  function roomOf(id) {
    const r = C.rooms && C.rooms[id];
    return r ? r.replace(/^신학관\s*/, '') : '방 번호는 스태프 안내를 따르세요';
  }
  function placeLine(id) { const s = D.STAGES[id]; return s.place + (s.place === '신학관' ? ' · ' + roomOf(id) : ''); }
  function clear(id) {
    if (S.done[id]) return;
    S.done[id] = Date.now(); save();
    send('progress', { stage: id, stageName: D.STAGES[id].name, elapsedSec: S.startedAt ? Math.round((Date.now() - S.startedAt) / 1000) : null });
  }

  // ---------- 렌더 ----------
  function shell(inner, opts = {}) {
    const back = opts.back ? `<a class="back" href="${opts.back}">← 로드맵</a>` : '<span></span>';
    const who = S.group ? `<span class="who">${S.group}조${S.name ? ' · ' + esc(S.name) : ''}</span>` : '';
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
    const g = S.group || '';
    shell(`<h2>우리 조 만들기</h2>
      <label>조 번호</label><div class="chips" id="gsel">${[1, 2, 3, 4, 5, 6].map(n => `<button class="chip ${g === n ? 'on' : ''}" data-g="${n}">${n}조</button>`).join('')}</div>
      <label>내 이름</label><input id="nm" value="${esc(S.name)}" placeholder="이름" autocomplete="off">
      <label class="row"><input type="checkbox" id="ld" ${S.leader ? 'checked' : ''}> 나는 조 리더예요 (조원 명단을 적고 진행을 이끌어요)</label>
      <div id="ldbox" style="display:${S.leader ? 'block' : 'none'}"><label>조원 이름 (쉼표나 줄바꿈으로 구분)</label>
      <textarea id="mem" rows="3" placeholder="예: 민수, 지은, 하늘">${esc(S.members.join(', '))}</textarea></div>
      <button class="btn" id="go">로드맵 보기</button>
      <p class="hint">진행 상황은 이 폰에 저장됩니다. 조 리더 폰으로 미션을 진행하고, 기도문은 각자 폰으로 적어요.</p>`);
    let sel = g;
    document.getElementById('gsel').onclick = e => { const b = e.target.closest('[data-g]'); if (!b) return; sel = +b.dataset.g; document.querySelectorAll('#gsel .chip').forEach(x => x.classList.toggle('on', x === b)); };
    document.getElementById('ld').onchange = e => { document.getElementById('ldbox').style.display = e.target.checked ? 'block' : 'none'; };
    document.getElementById('go').onclick = () => {
      if (!sel) return alert('조 번호를 골라 주세요');
      const nm = document.getElementById('nm').value.trim();
      if (!nm) return alert('이름을 적어 주세요');
      if (S.group && S.group !== sel) { const k = blank(); S = k; }
      S.group = sel; S.name = nm; S.leader = document.getElementById('ld').checked;
      S.members = S.leader ? document.getElementById('mem').value.split(/[,\n]/).map(s => s.trim()).filter(Boolean) : [];
      save(); send('join', { name: nm, leader: S.leader, members: S.members });
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
    const start = S.startedAt ? '' : `<button class="btn alt" id="start">▶ 출발! (규칙 설명이 끝나면 리더가 눌러요)</button>`;
    const members = S.leader && S.members.length ? `<p class="hint">조원: ${S.members.map(esc).join(', ')}</p>` : '';
    shell(`<h2>${S.group}조 로드맵 <span class="count">${doneN}/${r.length}</span></h2>${members}${start}
      ${nxt ? `<a class="next" href="#/stage/${nxt}"><small>다음 목적지</small><b>${D.STAGES[nxt].icon} ${esc(D.STAGES[nxt].place)}</b><span>${D.STAGES[nxt].name}</span></a>` : `<div class="next ok"><b>모든 미션 완료!</b><span>청년관에서 말씀을 완성해 주세요</span></div>`}
      <div class="steps">${steps}</div>
      <div class="links"><a href="#/map">🗺 지도</a><a href="#/verse">📜 말씀 조각 ${Object.keys(S.done).filter(k => D.FRAG[k]).length}/6</a><a href="#/scan">⌨ QR 코드 입력</a></div>`);
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
    shell(`<h2>QR 코드 직접 입력</h2><p class="hint">QR이 안 읽힐 때 QR 아래 적힌 코드(예: w1, s3)를 넣어 주세요.</p><input id="code" placeholder="코드" autocomplete="off" autocapitalize="off"><button class="btn" id="ok">확인</button>`, { back: '#/road' });
    document.getElementById('ok').onclick = () => { const v = document.getElementById('code').value.trim().toLowerCase(); if (v) location.hash = '#/qr/' + v; };
  }

  // QR 스캔 착지
  function qr(code) {
    if (!S.group) { sessionStorage.setItem('rest.pendingQr', code); return join(); }
    const w = D.WORDS[code], s = D.STORY[code];
    const need = w ? 'hundred' : s ? 'main' : null;
    if (need && !visible(need)) return shell(`<div class="qrcard"><div class="word">🔒</div><p class="story">아직 이 장소 차례가 아니에요.<br>앞 미션을 먼저 클리어해 주세요.</p></div><a class="btn" href="#/road">로드맵으로</a>`);
    if (w) {
      const isNew = !S.words.includes(code); if (isNew) { S.words.push(code); save(); }
      shell(`<div class="qrcard"><small>${isNew ? '새 단어를 찾았어요' : '이미 찾은 단어예요'}</small><div class="word">${w.t}</div>
        <p class="hint">이 단어가 말씀에 들어갈지는 조원들이 함께 정해 보세요. 진짜일 수도, 함정일 수도 있어요.</p></div>
        <a class="btn" href="#/stage/hundred">100주년 미션으로</a>`);
    } else if (s) {
      const isNew = !S.cards.includes(code); if (isNew) { S.cards.push(code); save(); }
      shell(`<div class="qrcard"><small>이야기 카드 ${s.mark}</small><p class="story">${s.t}</p><p class="hint">성경에 나온 순서는 몇 번째일까요?</p></div><a class="btn" href="#/stage/main">본당 미션으로</a>`);
    } else shell(`<p>알 수 없는 코드예요: ${esc(code)}</p><a class="btn" href="#/road">로드맵으로</a>`);
  }

  // ---------- 스테이지 ----------
  function stage(id) {
    if (!S.group) return join();
    const st = D.STAGES[id]; if (!st || !visible(id)) { location.hash = '#/road'; return road(); }
    const head = `<div class="shead"><span class="ico">${st.icon}</span><div><small>${esc(placeLine(id))}</small><h2>${st.name}</h2></div></div><p class="brief">${st.brief}</p>`;
    if (S.done[id] && id !== 'youth') return shell(head + clearedBanner(id) + nextBtn(), { back: '#/road' });
    ({ silence, secret, quiz, hundred, oyat, main: mainStage, youth }[id])(head);
  }

  function timer(min) {
    return `<div class="timer" id="tm" data-sec="${min * 60}">${min}:00</div><button class="btn ghost" id="tmbtn">타이머 시작</button>`;
  }
  function bindTimer() {
    const b = document.getElementById('tmbtn'); if (!b) return;
    let h; b.onclick = () => {
      const el = document.getElementById('tm'); let s = +el.dataset.sec; clearInterval(h);
      b.textContent = '다시 시작';
      h = setInterval(() => { s--; if (!document.body.contains(el)) return clearInterval(h); el.textContent = Math.floor(Math.max(s, 0) / 60) + ':' + String(Math.max(s, 0) % 60).padStart(2, '0'); if (s <= 0) { clearInterval(h); el.classList.add('end'); navigator.vibrate && navigator.vibrate([300, 150, 300]); } }, 1000);
    };
  }

  function silence(head) {
    const off = ((S.group - 1) * 3) % D.KEYWORDS.length;
    const list = D.KEYWORDS.map((_, i) => D.KEYWORDS[(off + i) % D.KEYWORDS.length]);
    const res = S.silence;
    const items = list.map((k, i) => `<li class="kw ${res[i] === 1 ? 'ok' : ''}"><span>${i + 1}. ${k}</span><span class="act"><button data-i="${i}" ${res[i] === 1 ? 'disabled' : ''}>성공</button></span></li>`).join('');
    const okN = Object.values(res).filter(v => v === 1).length;
    shell(head + `<ul class="rules"><li>말·글자·휴대폰 화면·손가락 숫자 금지</li><li>다 섰다고 느끼면 동시에 손 들기</li><li>리더가 줄 선 순서대로 한 명씩 값을 말해 확인</li></ul>
      ${timer(9)}<p class="who2">조 리더 확인용 · 위에서부터 차례로 (9분에 2~3개)</p><ul class="kws">${items}</ul>
      <p class="hint">맞은 키워드 <b>${okN}</b>개 · 2개 이상이면 클리어!</p>`, { back: '#/road' });
    bindTimer();
    document.querySelectorAll('.kws button').forEach(b => b.onclick = () => { S.silence[b.dataset.i] = 1; save(); if (Object.values(S.silence).filter(v => v === 1).length >= 2) { clear('silence'); stage('silence'); } else silence(head); });
  }

  function secret(head) {
    shell(head + `<ul class="rules"><li>미션지는 방에 있어요 (6장, 한 명이 뽑아요)</li><li>미션지를 모르는 사람은 한 명, 나머지는 박수·소리 크기로만 힌트</li><li>미션이 끝나면 아래 버튼을 눌러요</li></ul>${timer(9)}
      <button class="btn" id="fin">미션 성공!</button>`, { back: '#/road' });
    bindTimer(); document.getElementById('fin').onclick = () => { clear('secret'); stage('secret'); };
  }

  function quiz(head) {
    const i = S.quizPass.length;
    if (i >= D.QUIZ.length) { clear('quiz'); return stage('quiz'); }
    const q = D.QUIZ[i];
    shell(head + `<div class="q"><small>${i + 1} / ${D.QUIZ.length}</small><p>${q.q}</p>${q.a.map((a, j) => `<button class="opt" data-j="${j}">${a}</button>`).join('')}<div class="msg" id="msg"></div></div>`, { back: '#/road' });
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
        <label class="btn alt filebtn">📷 사진 찍기/선택<input type="file" id="ph" accept="image/*" capture="environment" hidden></label><img id="prev" class="prev" hidden><div class="msg" id="msg"></div>`;
    }
    shell(head + body, { back: '#/road' });
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

  function oyat(head) {
    shell(head + `<label>나를 위한 한 줄 기도</label><textarea id="p1" rows="2" maxlength="200" placeholder="예: 주님, 오늘 제 마음에 쉼을 주세요"></textarea>
      <label>옆 사람을 위한 한 줄 기도 (선택)</label><textarea id="p2" rows="2" maxlength="200" placeholder="예: 옆에 있는 친구에게도 평안을 주세요"></textarea>
      <button class="btn" id="sub">기도 보내기</button><div class="msg" id="msg"></div>
      <p class="hint">조 번호(${S.group}조)와 이름이 함께 저장됩니다. 당일 화면에는 공개하지 않아요.</p>`, { back: '#/road' });
    document.getElementById('sub').onclick = () => {
      const p1 = document.getElementById('p1').value.trim(), p2 = document.getElementById('p2').value.trim();
      if (!p1) return (document.getElementById('msg').textContent = '나를 위한 기도를 한 줄 적어 주세요.');
      send('prayer', { name: S.name, mine: p1, neighbor: p2 }); clear('oyat'); stage('oyat');
    };
  }

  function mainStage(head) {
    const cards = S.cards.slice();
    let order = S.order.filter(c => cards.includes(c));
    const pool = cards.filter(c => !order.includes(c));
    const poolH = pool.map(c => `<button class="story-chip" data-a="${c}"><span class="mk">${D.STORY[c].mark}</span>${D.STORY[c].t}</button>`).join('') || '<span class="hint">QR을 스캔해 카드를 모아 보세요 (6장).</span>';
    const ordH = order.map((c, i) => `<div class="ord"><span class="n">${i + 1}</span><span class="mk">${D.STORY[c].mark}</span><span class="tx">${D.STORY[c].t}</span><span class="mv"><button data-u="${i}">▲</button><button data-d="${i}">▼</button><button data-x="${c}">✕</button></span></div>`).join('') || '<span class="hint">카드를 눌러 순서대로 놓아요</span>';
    shell(head + `<h3>찾은 카드 (${cards.length}/6)</h3><div class="pool">${poolH}</div><h3>내가 놓은 순서</h3><div class="ordl">${ordH}</div>
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
    const rest = D.VERSE_ORDER.filter(k => !S.done[k]);
    const need = route().filter(id => id !== 'youth' && !S.done[id]);
    if (need.length) {
      return shell(head + `<div class="ok-box">아직 안 한 미션이 ${need.length}개 있어요</div><ul class="rules">${need.map(id => `<li><a href="#/stage/${id}">${D.STAGES[id].icon} ${D.STAGES[id].name}</a></li>`).join('')}</ul>
      <p class="hint">모두 마치고 오면 말씀을 완성할 수 있어요. 그래도 먼저 도착했다면 차 한 잔 하며 쉬어요 ☕</p>`, { back: '#/road' });
    }
    if (S.done.youth) {
      const sec = S.finalSec, mm = sec != null ? Math.floor(sec / 60) + '분 ' + (sec % 60) + '초' : '';
      return shell(head + `<div class="clear"><div class="big">🎉 완성!</div><div class="frag">“나는 마음이 온유하고 겸손하니 나의 멍에를 메고 내게 배우라 그리하면 너희 마음이 쉼을 얻으리니”</div><div>${esc(C.verseRef)}</div>${mm ? `<div>걸린 시간 ${mm}</div>` : ''}</div><p class="hint">이 화면을 스태프에게 보여 주세요. 차를 드시며 쉬세요 ☕</p>`, { back: '#/road' });
    }
    const pool = [...D.VERSE_ORDER].sort(() => Math.random() - .5);
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

  // ---------- 라우터 ----------
  function router() {
    const [, p, a] = (location.hash || '#/').split('/');
    try {
      if (p === 'join') join();
      else if (p === 'road') road();
      else if (p === 'map') mapPage();
      else if (p === 'verse') verse();
      else if (p === 'scan') scan();
      else if (p === 'stage') stage(a);
      else if (p === 'qr') qr(a);
      else landing();
    } catch (e) { console.error(e); shell(`<p>문제가 생겼어요.</p><a class="btn" href="#/road">로드맵으로</a>`); }
  }
  window.addEventListener('hashchange', router);
  const pq = S.group && sessionStorage.getItem('rest.pendingQr');
  if (pq) { sessionStorage.removeItem('rest.pendingQr'); location.hash = '#/qr/' + pq; }
  router(); flush();
  window.__rest = { S: () => S, reset: () => { localStorage.removeItem(KEY); S = blank(); } };
})();
