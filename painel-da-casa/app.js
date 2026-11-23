/* Painel da Casa — JS puro, sem dependências (compatível com Chrome/WebView antigos) */
(function () {
  'use strict';

  // ---------- utilidades ----------
  var $ = function (s) { return document.querySelector(s); };
  var DIAS = ['Dom', 'Seg', 'Ter', 'Qua', 'Qui', 'Sex', 'Sáb'];
  var DIAS_LONGO = ['domingo', 'segunda', 'terça', 'quarta', 'quinta', 'sexta', 'sábado'];
  var MESES = ['janeiro', 'fevereiro', 'março', 'abril', 'maio', 'junho', 'julho', 'agosto', 'setembro', 'outubro', 'novembro', 'dezembro'];
  function pad(n) { return (n < 10 ? '0' : '') + n; }
  function ymd(d) { return d.getFullYear() + '-' + pad(d.getMonth() + 1) + '-' + pad(d.getDate()); }
  function hm(d) { return pad(d.getHours()) + ':' + pad(d.getMinutes()); }
  function ic(n) { return '<svg><use xlink:href="#i-' + n + '" href="#i-' + n + '"/></svg>'; }
  function uid() { return Date.now().toString(36) + Math.random().toString(36).slice(2, 6); }
  function esc(s) { return String(s == null ? '' : s).replace(/[&<>"']/g, function (c) { return { '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c]; }); }
  function norm(s) { return String(s || '').toLowerCase().normalize ? String(s).toLowerCase().normalize('NFD').replace(/[̀-ͯ]/g, '') : String(s).toLowerCase(); }
  function longDate(d) { var w = d.getDay(); var t = DIAS_LONGO[w]; t = t.charAt(0).toUpperCase() + t.slice(1); return t + (w > 0 && w < 6 ? '-feira' : '') + ', ' + d.getDate() + ' de ' + MESES[d.getMonth()]; }
  function addDays(d, n) { var x = new Date(d); x.setDate(x.getDate() + n); return x; }

  // ---------- estado ----------
  var KEY = 'painel.v1';
  var today = new Date();
  function seed() {
    var t = ymd(today), tm = ymd(addDays(today, 1)), d2 = ymd(addDays(today, 2));
    return {
      routine: [
        { id: uid(), title: 'Tomar café e remédios', time: '07:00', days: [0, 1, 2, 3, 4, 5, 6] },
        { id: uid(), title: 'Levar as crianças na escola', time: '07:30', days: [1, 2, 3, 4, 5] },
        { id: uid(), title: 'Academia', time: '12:00', days: [1, 3, 5] },
        { id: uid(), title: 'Regar as plantas', time: '18:00', days: [1, 4] },
        { id: uid(), title: 'Separar o lixo reciclável', time: '20:00', days: [2] },
        { id: uid(), title: 'Ler 20 minutos', time: '22:00', days: [0, 1, 2, 3, 4, 5, 6] }
      ],
      done: {},
      events: [
        { id: uid(), title: 'Dentista', date: t, time: '15:30', who: 'Ele' },
        { id: uid(), title: 'Jantar com os pais', date: tm, time: '19:30', who: 'Casal' },
        { id: uid(), title: 'Reunião da escola', date: d2, time: '08:00', who: 'Ela' }
      ],
      lists: {
        'Compras': [
          { id: uid(), text: 'Leite', done: false },
          { id: uid(), text: 'Pão integral', done: false },
          { id: uid(), text: 'Café', done: true },
          { id: uid(), text: 'Bananas', done: false }
        ],
        'Lembretes': [
          { id: uid(), text: 'Pagar conta de luz até dia 28', done: false },
          { id: uid(), text: 'Ligar para o encanador', done: false }
        ]
      },
      activeList: 'Compras',
      settings: { standbyMin: 3, slideSec: 12, feedUrl: '', voiceRate: 1 },
      gcal: { events: [], at: 0 },
      recipes: seedRecipes()
    };
  }
  var S;
  try { S = JSON.parse(localStorage.getItem(KEY)); } catch (e) { S = null; }
  if (!S || !S.routine) S = seed();
  if (!S.gcal) S.gcal = { events: [], at: 0 };
  function save() { try { localStorage.setItem(KEY, JSON.stringify(S)); } catch (e) {} }

  // ---------- relógio ----------
  function greeting(h) { return h < 12 ? 'Bom dia!' : h < 18 ? 'Boa tarde!' : 'Boa noite!'; }
  var lastDay = ymd(today);
  function tick() {
    var d = new Date();
    $('#time').textContent = hm(d);
    $('#sbTime').textContent = hm(d);
    var ld = longDate(d);
    $('#date').textContent = ld;
    $('#sbDate').textContent = ld;
    var pend = todayRoutine().filter(function (r) { return !isDone(r); }).length;
    $('#greet').textContent = greeting(d.getHours()) + (pend ? ' Faltam ' + pend + ' tarefa' + (pend > 1 ? 's' : '') + ' hoje.' : ' Tudo feito por hoje.');
    if (ymd(d) !== lastDay) { lastDay = ymd(d); today = d; renderAll(); }
    if (d.getSeconds() === 0) renderRoutine();
  }

  // ---------- rotina ----------
  function todayRoutine() {
    var dow = new Date().getDay(), t = ymd(new Date());
    return S.routine.filter(function (r) { return r.date ? r.date === t : r.days.indexOf(dow) >= 0; })
      .sort(function (a, b) { return (a.time || '99').localeCompare(b.time || '99'); });
  }
  function isDone(r) { var l = S.done[ymd(new Date())] || []; return l.indexOf(r.id) >= 0; }
  function toggleDone(id) {
    var k = ymd(new Date()); var l = S.done[k] || (S.done[k] = []);
    var i = l.indexOf(id); if (i >= 0) l.splice(i, 1); else l.push(id);
    // limpa histórico com mais de 30 dias
    var lim = ymd(addDays(new Date(), -30));
    Object.keys(S.done).forEach(function (d) { if (d < lim) delete S.done[d]; });
    save(); renderRoutine(); tick();
  }
  function renderRoutine() {
    var items = todayRoutine(), now = hm(new Date()), doneN = 0, nowSet = false;
    var html = items.map(function (r, i) {
      var d = isDone(r); if (d) doneN++;
      var next = items[i + 1];
      var isNow = !d && !nowSet && r.time && r.time <= now && (!next || !next.time || next.time > now);
      if (isNow) nowSet = true;
      return '<li class="' + (d ? 'done ' : '') + (isNow ? 'now' : '') + '" data-id="' + r.id + '">' +
        '<button class="check" data-act="toggle">' + (d ? ic('check') : '') + '</button>' +
        '<span class="label">' + esc(r.title) + (isNow ? '<span class="badge">agora</span>' : '') + '</span>' +
        (r.time ? '<span class="meta">' + ic('clock') + esc(r.time) + '</span>' : '') +
        '<button class="del" data-act="edit" title="Editar">' + ic('edit') + '</button></li>';
    }).join('');
    $('#routineList').innerHTML = html || '<li class="empty">Nenhuma tarefa para hoje.</li>';
    var left = items.length - doneN;
    $('#routineSub').textContent = items.length ? (left ? left + ' para fazer · ' + doneN + ' concluída' + (doneN === 1 ? '' : 's') : 'Tudo concluído por hoje') : '';
    $('#tileRoutine').textContent = doneN + ' de ' + items.length;
    $('#tileRoutineSub').textContent = left ? 'tarefas feitas' : 'dia completo!';
    $('#routineBar').style.width = (items.length ? doneN / items.length * 100 : 0) + '%';
  }
  $('#routineList').addEventListener('click', function (e) {
    var b = e.target.closest('button'); if (!b) return;
    var id = b.closest('li').getAttribute('data-id');
    if (b.getAttribute('data-act') === 'toggle') toggleDone(id);
    else openRoutineForm(S.routine.filter(function (r) { return r.id === id; })[0]);
  });

  // ---------- agenda ----------
  function allEvents(fromDate, days) {
    var from = ymd(fromDate), to = ymd(addDays(fromDate, days));
    var local = S.events.map(function (e) { return { id: e.id, title: e.title, date: e.date, time: e.time, who: e.who, src: 'local' }; });
    var g = (S.gcal.events || []).map(function (e) {
      var s = new Date(e.start);
      return { title: e.title, date: e.allDay ? e.start.slice(0, 10) : ymd(s), time: e.allDay ? '' : hm(s), who: e.calendar, color: e.color, src: 'google' };
    });
    return local.concat(g).filter(function (e) { return e.date >= from && e.date < to; })
      .sort(function (a, b) { return (a.date + (a.time || '00:00')).localeCompare(b.date + (b.time || '00:00')); });
  }
  function dayLabel(dstr) {
    var t = ymd(new Date());
    if (dstr === t) return 'Hoje';
    if (dstr === ymd(addDays(new Date(), 1))) return 'Amanhã';
    var p = dstr.split('-'), d = new Date(+p[0], +p[1] - 1, +p[2]);
    return DIAS_LONGO[d.getDay()] + ', ' + d.getDate() + '/' + pad(d.getMonth() + 1);
  }
  function renderAgenda() {
    var evs = allEvents(new Date(), 7);
    $('#agendaList').innerHTML = evs.length ? evs.map(function (e) {
      var p = e.date.split('-'), dl = dayLabel(e.date);
      return '<div class="event"' + (e.id ? ' data-id="' + e.id + '"' : '') + '>' +
        '<div class="dot"' + (e.color ? ' style="background:' + esc(e.color) + '33"' : '') + '>' + (+p[2]) + '</div>' +
        '<div class="n">' + esc(e.title) + '<div class="src">' + ic('clock') + (e.time || 'dia todo') + (e.who ? ' · ' + esc(e.who) : '') + '</div></div>' +
        '<span class="when">' + (dl.indexOf(',') > 0 ? dl.split(',')[0].slice(0, 3) : dl) + '</span>' +
        (e.src === 'local' ? '<button class="del" data-act="del-ev" title="Apagar">' + ic('x') + '</button>' : '') + '</div>';
    }).join('') : '<div class="empty">Nada marcado para os próximos dias.</div>';
    var nx = evs.filter(function (e) { return e.date > ymd(new Date()) || !e.time || e.time >= hm(new Date()); })[0];
    $('#tileNext').textContent = nx ? nx.title : 'Agenda livre';
    $('#tileNextSub').textContent = nx ? dayLabel(nx.date).split(',')[0] + (nx.time ? ', ' + nx.time : '') : 'nada nos próximos 7 dias';
    var st = $('#syncState');
    if (S.settings.feedUrl) {
      st.textContent = S.gcal.at ? 'Google ✓ ' + hm(new Date(S.gcal.at)) : 'Google…';
      st.className = 'chip' + (S.gcal.err ? '' : ' ok');
      if (S.gcal.err) st.textContent = 'Google offline';
    } else { st.textContent = 'local'; st.className = 'chip'; }
  }
  $('#agendaList').addEventListener('click', function (e) {
    var b = e.target.closest('[data-act="del-ev"]'); if (!b) return;
    var id = b.closest('.event').getAttribute('data-id');
    if (confirmInline(b)) { S.events = S.events.filter(function (x) { return x.id !== id; }); save(); renderAgenda(); }
  });
  // confirmação sem diálogo do navegador: 1º toque arma, 2º toque apaga
  function confirmInline(b) {
    if (b.getAttribute('data-armed')) return true;
    var orig = b.innerHTML; b.setAttribute('data-armed', '1'); b.textContent = 'apagar?'; b.style.opacity = 1; b.style.color = '#ef6f6c';
    setTimeout(function () { b.removeAttribute('data-armed'); b.innerHTML = orig; b.style.opacity = ''; b.style.color = ''; }, 3000);
    return false;
  }

  // ---------- Google Agenda (via Apps Script) ----------
  function syncGoogle() {
    var url = S.settings.feedUrl; if (!url) return;
    var u = url + (url.indexOf('?') >= 0 ? '&' : '?') + 'days=30&t=' + Date.now();
    fetch(u).then(function (r) { return r.json(); }).then(function (data) {
      S.gcal = { events: data.events || [], at: Date.now() }; save(); renderAgenda(); renderStandbySide();
    }).catch(function () { S.gcal.err = true; renderAgenda(); });
  }

  // ---------- listas ----------
  function renderLists() {
    var names = Object.keys(S.lists);
    if (names.indexOf(S.activeList) < 0) S.activeList = names[0];
    $('#listTabs').innerHTML = names.map(function (n) {
      var c = S.lists[n].filter(function (i) { return !i.done; }).length;
      return '<button class="tab' + (n === S.activeList ? ' active' : '') + '" data-list="' + esc(n) + '">' + esc(n) + (c ? ' · ' + c : '') + '</button>';
    }).join('') + '<button class="tab" data-list="__new">+</button>';
    var items = (S.lists[S.activeList] || []).slice().sort(function (a, b) { return a.done - b.done; });
    $('#listItems').innerHTML = items.map(function (i) {
      return '<li class="' + (i.done ? 'done' : '') + '" data-id="' + i.id + '"><button class="check" data-act="toggle">' + (i.done ? ic('check') : '') + '</button>' +
        '<span class="label">' + esc(i.text) + '</span><button class="del" data-act="del">' + ic('x') + '</button></li>';
    }).join('') || '<li class="empty">Lista vazia.</li>';
  }
  function addToList(name, text) {
    if (!S.lists[name]) S.lists[name] = [];
    S.lists[name].unshift({ id: uid(), text: text, done: false }); save(); renderLists();
  }
  $('#listTabs').addEventListener('click', function (e) {
    var b = e.target.closest('.tab'); if (!b) return;
    var n = b.getAttribute('data-list');
    if (n === '__new') return openNewList();
    S.activeList = n; save(); renderLists();
  });
  $('#listItems').addEventListener('click', function (e) {
    var b = e.target.closest('button'); if (!b) return;
    var id = b.closest('li').getAttribute('data-id'), arr = S.lists[S.activeList];
    if (b.getAttribute('data-act') === 'toggle') arr.forEach(function (i) { if (i.id === id) i.done = !i.done; });
    else S.lists[S.activeList] = arr.filter(function (i) { return i.id !== id; });
    save(); renderLists();
  });
  $('#quickAdd').addEventListener('submit', function (e) {
    e.preventDefault(); var v = $('#quickInput').value.trim(); if (!v) return;
    addToList(S.activeList, v); $('#quickInput').value = '';
  });

  // ---------- modal / formulários ----------
  function openModal(title, html, onReady, wide) {
    $('#modalTitle').textContent = title; $('#modalBody').innerHTML = html;
    $('.modal-box').classList.toggle('wide', !!wide); $('.modal-box').scrollTop = 0;
    $('#modal').classList.remove('hidden'); if (onReady) onReady($('#modalBody'));
  }
  function closeModal() { $('#modal').classList.add('hidden'); }
  $('#modalClose').addEventListener('click', closeModal);
  $('#modal').addEventListener('click', function (e) { if (e.target.id === 'modal') closeModal(); });

  function daysPicker(sel) {
    return '<div class="days">' + DIAS.map(function (d, i) {
      var on = sel.indexOf(i) >= 0;
      return '<label class="' + (on ? 'on' : '') + '"><input type="checkbox" value="' + i + '"' + (on ? ' checked' : '') + '>' + d + '</label>';
    }).join('') + '</div>';
  }
  function wireDays(root) {
    Array.prototype.forEach.call(root.querySelectorAll('.days label'), function (l) {
      l.addEventListener('click', function (ev) { ev.preventDefault(); var c = l.querySelector('input'); c.checked = !c.checked; l.classList.toggle('on', c.checked); });
    });
  }
  function openRoutineForm(r) {
    var isNew = !r; r = r || { title: '', time: '', days: [new Date().getDay()] };
    openModal(isNew ? 'Nova tarefa da rotina' : 'Editar tarefa',
      '<div class="field"><label>Tarefa</label><input id="fTitle" value="' + esc(r.title) + '" placeholder="Ex.: Tomar remédio"></div>' +
      '<div class="field"><label>Horário (opcional)</label><input id="fTime" type="time" value="' + esc(r.time) + '"></div>' +
      '<div class="field"><label>Repetir nos dias</label>' + daysPicker(r.days || []) + '</div>' +
      '<div class="row"><button class="btn" id="fSave">Salvar</button>' + (isNew ? '' : '<button class="btn danger" id="fDel">Excluir</button>') + '</div>',
      function (root) {
        wireDays(root); $('#fTitle').focus();
        $('#fSave').onclick = function () {
          var t = $('#fTitle').value.trim(); if (!t) return;
          var days = Array.prototype.map.call(root.querySelectorAll('.days input:checked'), function (c) { return +c.value; });
          if (isNew) S.routine.push({ id: uid(), title: t, time: $('#fTime').value, days: days });
          else { r.title = t; r.time = $('#fTime').value; r.days = days; delete r.date; }
          save(); renderRoutine(); tick(); closeModal();
        };
        if (!isNew) $('#fDel').onclick = function () { S.routine = S.routine.filter(function (x) { return x.id !== r.id; }); save(); renderRoutine(); closeModal(); };
      });
  }
  function openEventForm() {
    openModal('Novo compromisso',
      '<div class="field"><label>O quê</label><input id="eTitle" placeholder="Ex.: Consulta médica"></div>' +
      '<div class="row"><div class="field" style="flex:1"><label>Data</label><input id="eDate" type="date" value="' + ymd(new Date()) + '"></div>' +
      '<div class="field" style="flex:1"><label>Hora</label><input id="eTime" type="time"></div></div>' +
      '<div class="field"><label>De quem</label><input id="eWho" placeholder="Ex.: Ela, Ele, Casal"></div>' +
      '<button class="btn" id="eSave">Salvar</button>',
      function () {
        $('#eTitle').focus();
        $('#eSave').onclick = function () {
          var t = $('#eTitle').value.trim(); if (!t) return;
          S.events.push({ id: uid(), title: t, date: $('#eDate').value, time: $('#eTime').value, who: $('#eWho').value.trim() });
          save(); renderAgenda(); renderStandbySide(); closeModal();
        };
      });
  }
  function openNewList() {
    openModal('Nova lista', '<div class="field"><label>Nome</label><input id="lName" placeholder="Ex.: Farmácia"></div><button class="btn" id="lSave">Criar</button>',
      function () {
        $('#lName').focus();
        $('#lSave').onclick = function () { var n = $('#lName').value.trim(); if (!n) return; if (!S.lists[n]) S.lists[n] = []; S.activeList = n; save(); renderLists(); closeModal(); };
      });
  }
  document.addEventListener('click', function (e) {
    var b = e.target.closest('[data-add]'); if (!b) return;
    var k = b.getAttribute('data-add'); if (k === 'routine') openRoutineForm(); else openEventForm();
  });

  function openSettings() {
    openModal('Configurações',
      '<div class="row"><div class="field" style="flex:1"><label>Standby após (min sem toque)</label><input id="sMin" type="number" min="0" value="' + S.settings.standbyMin + '"></div>' +
      '<div class="field" style="flex:1"><label>Troca de foto (seg)</label><input id="sSec" type="number" min="4" value="' + S.settings.slideSec + '"></div></div>' +
      '<p class="hint">0 = nunca entrar sozinho em standby.</p><hr>' +
      '<div class="field"><label>Fotos do standby</label><input id="sPhotos" type="file" accept="image/*" multiple></div>' +
      '<div class="thumbs" id="sThumbs"></div>' +
      '<div class="row"><button class="btn ghost" id="sClearPh">Remover todas as fotos</button></div>' +
      '<p class="hint">As fotos ficam salvas só neste aparelho.</p><hr>' +
      '<div class="field"><label>Google Agenda — URL do Apps Script</label><input id="sFeed" placeholder="https://script.google.com/macros/s/…/exec" value="' + esc(S.settings.feedUrl) + '"></div>' +
      '<p class="hint">Veja o arquivo LEIAME.md para gerar essa URL em 5 minutos. Os compromissos que vocês criarem no celular aparecem aqui.</p><hr>' +
      '<div class="row"><button class="btn" id="sSave">Salvar</button><button class="btn ghost" id="sExport">Exportar backup</button><button class="btn ghost" id="sReset">Restaurar exemplo</button></div>',
      function () {
        refreshThumbs();
        $('#sPhotos').onchange = function (e) { addPhotos(e.target.files).then(refreshThumbs); };
        $('#sClearPh').onclick = function () { clearPhotos().then(refreshThumbs); };
        $('#sSave').onclick = function () {
          S.settings.standbyMin = Math.max(0, +$('#sMin').value || 0);
          S.settings.slideSec = Math.max(4, +$('#sSec').value || 12);
          S.settings.feedUrl = $('#sFeed').value.trim();
          save(); closeModal(); syncGoogle(); renderAgenda(); resetIdle();
        };
        $('#sExport').onclick = function () {
          var a = document.createElement('a');
          a.href = URL.createObjectURL(new Blob([JSON.stringify(S, null, 2)], { type: 'application/json' }));
          a.download = 'painel-backup-' + ymd(new Date()) + '.json'; a.click();
        };
        $('#sReset').onclick = function (ev) { if (confirmInline(ev.target)) { S = seed(); save(); renderAll(); closeModal(); } };
      });
  }
  $('#settingsBtn').addEventListener('click', openSettings);

  // ---------- fotos (IndexedDB) ----------
  var db = null, photoUrls = [];
  function openDB() {
    return new Promise(function (res) {
      if (!window.indexedDB) return res(null);
      var rq = indexedDB.open('painel-fotos', 1);
      rq.onupgradeneeded = function () { rq.result.createObjectStore('fotos', { keyPath: 'id' }); };
      rq.onsuccess = function () { db = rq.result; res(db); };
      rq.onerror = function () { res(null); };
    });
  }
  function loadPhotos() {
    return new Promise(function (res) {
      photoUrls.forEach(function (u) { URL.revokeObjectURL(u); }); photoUrls = [];
      if (!db) return res([]);
      var rq = db.transaction('fotos').objectStore('fotos').getAll();
      rq.onsuccess = function () { photoUrls = rq.result.map(function (p) { return URL.createObjectURL(p.blob); }); res(photoUrls); };
      rq.onerror = function () { res([]); };
    });
  }
  // reduz fotos grandes para poupar memória do tablet
  function shrink(file) {
    return new Promise(function (res) {
      var img = new Image(), url = URL.createObjectURL(file);
      img.onload = function () {
        var max = 1920, w = img.width, h = img.height, k = Math.min(1, max / Math.max(w, h));
        var c = document.createElement('canvas'); c.width = Math.round(w * k); c.height = Math.round(h * k);
        c.getContext('2d').drawImage(img, 0, 0, c.width, c.height); URL.revokeObjectURL(url);
        c.toBlob(function (b) { res(b || file); }, 'image/jpeg', 0.85);
      };
      img.onerror = function () { res(file); };
      img.src = url;
    });
  }
  function addPhotos(files) {
    var arr = Array.prototype.slice.call(files || []);
    return arr.reduce(function (p, f) {
      return p.then(function () { return shrink(f); }).then(function (b) {
        return new Promise(function (res) { var tx = db.transaction('fotos', 'readwrite'); tx.objectStore('fotos').put({ id: uid(), blob: b }); tx.oncomplete = res; tx.onerror = res; });
      });
    }, Promise.resolve()).then(loadPhotos);
  }
  function clearPhotos() {
    return new Promise(function (res) { if (!db) return res(); var tx = db.transaction('fotos', 'readwrite'); tx.objectStore('fotos').clear(); tx.oncomplete = res; }).then(loadPhotos);
  }
  function refreshThumbs() {
    var el = $('#sThumbs'); if (!el) return;
    el.innerHTML = photoUrls.length ? photoUrls.map(function (u) { return '<div style="background-image:url(' + u + ')"></div>'; }).join('') : '<span class="hint">Sem fotos — o standby usará fundos coloridos.</span>';
  }
  var FALLBACK = [
    'radial-gradient(ellipse at 85% 15%,#f5c9ab 0%,rgba(245,201,171,0) 55%),radial-gradient(ellipse at 10% 90%,#bcd6c9 0%,rgba(188,214,201,0) 60%)',
    'radial-gradient(ellipse at 15% 20%,#efc2b6 0%,rgba(239,194,182,0) 55%),radial-gradient(ellipse at 90% 85%,#f3d7ae 0%,rgba(243,215,174,0) 60%)',
    'radial-gradient(ellipse at 75% 75%,#b9d3da 0%,rgba(185,211,218,0) 58%),radial-gradient(ellipse at 20% 15%,#ecdcc4 0%,rgba(236,220,196,0) 55%)'
  ];

  // ---------- standby ----------
  var slideTimer = null, slideIdx = 0, slideFlip = false, inStandby = false;
  function bgFor(i) {
    if (photoUrls.length) return 'url(' + photoUrls[i % photoUrls.length] + ')';
    return FALLBACK[i % FALLBACK.length];
  }
  function nextSlide() {
    $('.sb-overlay').classList.toggle('photo', photoUrls.length > 0);
    var a = $('#slideA'), b = $('#slideB'), show = slideFlip ? a : b, hide = slideFlip ? b : a;
    slideFlip = !slideFlip;
    show.style.backgroundImage = bgFor(slideIdx++);
    show.classList.remove('kb'); void show.offsetWidth; show.classList.add('kb', 'show');
    hide.classList.remove('show');
  }
  function renderStandbySide() {
    var d = new Date(), y = d.getFullYear(), m = d.getMonth();
    var first = new Date(y, m, 1), start = addDays(first, -first.getDay());
    var evDays = {}; allEvents(start, 42).forEach(function (e) { evDays[e.date] = 1; });
    var h = '<h4>' + MESES[m] + ' ' + y + '</h4><table><tr>' + DIAS.map(function (x) { return '<th>' + x[0] + '</th>'; }).join('') + '</tr>';
    for (var w = 0; w < 6; w++) {
      h += '<tr>';
      for (var i = 0; i < 7; i++) {
        var c = addDays(start, w * 7 + i), k = ymd(c);
        h += '<td class="' + (c.getMonth() !== m ? 'other ' : '') + (k === ymd(d) ? 'today ' : '') + (evDays[k] ? 'has' : '') + '"><span>' + c.getDate() + '</span></td>';
      }
      h += '</tr>';
    }
    $('#sbCal').innerHTML = h + '</table>';
    var nx = allEvents(d, 7).filter(function (e) { return e.date > ymd(d) || !e.time || e.time >= hm(d); }).slice(0, 4);
    $('#sbNext').innerHTML = '<h4>Próximos</h4>' + (nx.length ? nx.map(function (e) {
      return '<div class="e"><span class="t">' + (e.date === ymd(d) ? (e.time || 'hoje') : dayLabel(e.date).split(',')[0]) + '</span><span>' + esc(e.title) + '</span></div>';
    }).join('') : '<div class="empty">Agenda livre 😌</div>');
  }
  function enterStandby() {
    if (inStandby) return; inStandby = true; closeModal();
    renderStandbySide(); $('#standby').classList.remove('hidden');
    nextSlide(); clearInterval(slideTimer); slideTimer = setInterval(nextSlide, S.settings.slideSec * 1000);
    requestWakeLock();
  }
  function exitStandby() {
    if (!inStandby) return; inStandby = false;
    $('#standby').classList.add('hidden'); clearInterval(slideTimer); resetIdle();
  }
  $('#standby').addEventListener('click', exitStandby);
  $('#standbyBtn').addEventListener('click', enterStandby);

  var idleTimer = null;
  function resetIdle() {
    clearTimeout(idleTimer);
    if (S.settings.standbyMin > 0) idleTimer = setTimeout(enterStandby, S.settings.standbyMin * 60000);
  }
  ['pointerdown', 'touchstart', 'keydown', 'mousemove'].forEach(function (ev) {
    document.addEventListener(ev, function () { if (!inStandby) resetIdle(); }, { passive: true });
  });

  // manter tela ligada (quando suportado)
  var wakeLock = null;
  function requestWakeLock() {
    if (!('wakeLock' in navigator) || wakeLock) return;
    navigator.wakeLock.request('screen').then(function (l) { wakeLock = l; l.addEventListener('release', function () { wakeLock = null; }); }).catch(function () {});
  }
  document.addEventListener('visibilitychange', function () { if (document.visibilityState === 'visible') requestWakeLock(); });

  // ---------- voz ----------
  var SR = window.SpeechRecognition || window.webkitSpeechRecognition, rec = null, listening = false;
  var toastT = null;
  function toast(msg, ms) {
    var t = $('#voiceToast'); t.textContent = msg; t.classList.remove('hidden');
    clearTimeout(toastT); toastT = setTimeout(function () { t.classList.add('hidden'); }, ms || 4000);
  }
  function say(text) {
    toast(text, 6000);
    if (!window.speechSynthesis) return;
    var u = new SpeechSynthesisUtterance(text); u.lang = 'pt-BR'; u.rate = S.settings.voiceRate || 1;
    var v = speechSynthesis.getVoices().filter(function (x) { return /pt(-|_)BR/i.test(x.lang); })[0]; if (v) u.voice = v;
    speechSynthesis.cancel(); speechSynthesis.speak(u);
  }
  function findList(spoken) {
    var n = norm(spoken).trim(), names = Object.keys(S.lists);
    for (var i = 0; i < names.length; i++) if (norm(names[i]) === n || norm(names[i]).indexOf(n) === 0 || n.indexOf(norm(names[i])) >= 0) return names[i];
    if (/compra|mercado|supermercado/.test(n)) return names.filter(function (x) { return /compra/i.test(x); })[0] || 'Compras';
    if (/lembr/.test(n)) return 'Lembretes';
    return spoken.charAt(0).toUpperCase() + spoken.slice(1);
  }
  function handleCommand(raw) {
    var t = norm(raw).replace(/[.!?]/g, '').trim(), m;
    toast('🗣️ "' + raw + '"', 2500);
    if (extrasCommand(t)) return;
    // "adicionar leite e ovos na lista de compras"
    if ((m = t.match(/^(?:adiciona(?:r)?|adicione|coloca(?:r)?|coloque|inclui(?:r)?|bota(?:r)?)\s+(.+?)\s+(?:na|a|à|nas|em)\s+(?:lista\s+(?:de\s+|do\s+|da\s+)?)?(.+)$/))) {
      var listName = findList(m[2]);
      if (/^tarefas?$|^rotina$/.test(m[2])) { addOneOffTask(m[1]); return say('Tarefa ' + m[1] + ' adicionada para hoje.'); }
      var items = m[1].split(/\s*,\s*|\s+e\s+/).filter(Boolean);
      items.forEach(function (i) { addToList(listName, i.charAt(0).toUpperCase() + i.slice(1)); });
      S.activeList = listName; save(); renderLists();
      return say((items.length > 1 ? items.slice(0, -1).join(', ') + ' e ' + items[items.length - 1] + ' adicionados' : items[0] + ' adicionado') + ' em ' + listName + '.');
    }
    if ((m = t.match(/^(?:nova tarefa|adicionar tarefa|criar tarefa|lembrar de)\s+(.+)$/))) { addOneOffTask(m[1]); return say('Tarefa ' + m[1] + ' adicionada para hoje.'); }
    if ((m = t.match(/^(?:conclui(?:r)?|concluido|marcar|marca|terminei|feito|fiz)\s+(?:a\s+tarefa\s+|como feito\s+)?(.+)$/))) {
      var target = norm(m[1]), r = todayRoutine().filter(function (x) { return norm(x.title).indexOf(target) >= 0 || target.indexOf(norm(x.title)) >= 0; })[0];
      if (!r) r = todayRoutine().filter(function (x) { return target.split(' ').some(function (w) { return w.length > 3 && norm(x.title).indexOf(w) >= 0; }); })[0];
      if (r) { if (!isDone(r)) toggleDone(r.id); return say('Pronto, ' + r.title + ' marcada como feita.'); }
      return say('Não encontrei essa tarefa na rotina de hoje.');
    }
    if (/(o que|quais|tenho).*(tarefa|rotina|fazer)/.test(t) || /^(tarefas|rotina)( de hoje)?$/.test(t)) {
      var p = todayRoutine().filter(function (x) { return !isDone(x); });
      return say(p.length ? 'Faltam ' + p.length + ': ' + p.map(function (x) { return (x.time ? x.time + ', ' : '') + x.title; }).join('; ') + '.' : 'Você já fez todas as tarefas de hoje!');
    }
    if (/agenda|compromisso|reuniao|marcado/.test(t)) {
      var amanha = /amanha/.test(t), d = amanha ? addDays(new Date(), 1) : new Date();
      var ev = allEvents(d, 1);
      return say(ev.length ? (amanha ? 'Amanhã' : 'Hoje') + ' você tem: ' + ev.map(function (e) { return (e.time ? e.time + ', ' : '') + e.title; }).join('; ') + '.' : 'Nada na agenda ' + (amanha ? 'amanhã' : 'hoje') + '.');
    }
    if ((m = t.match(/(?:o que tem|ler|leia|mostra(?:r)?|abrir|abre)\s+(?:na\s+)?(?:a\s+)?lista\s+(?:de\s+)?(.+)/))) {
      var ln = findList(m[1]); S.activeList = ln; save(); renderLists();
      var it = (S.lists[ln] || []).filter(function (x) { return !x.done; }).map(function (x) { return x.text; });
      return say(it.length ? 'Na lista ' + ln + ': ' + it.join(', ') + '.' : 'A lista ' + ln + ' está vazia.');
    }
    if (/limpa(r)?.*(lista|comprados|marcados)/.test(t)) {
      S.lists[S.activeList] = S.lists[S.activeList].filter(function (x) { return !x.done; }); save(); renderLists();
      return say('Itens marcados removidos de ' + S.activeList + '.');
    }
    if (/standby|descansa|fotos|protetor/.test(t)) { say('Modo standby.'); return setTimeout(enterStandby, 900); }
    if (/que horas|horas sao/.test(t)) return say('São ' + hm(new Date()) + '.');
    if (/que dia|data de hoje/.test(t)) return say('Hoje é ' + longDate(new Date()) + '.');
    say('Não entendi. Tente: "adicionar leite na lista de compras", "quais são minhas tarefas" ou "o que tenho na agenda".');
  }
  function addOneOffTask(title) {
    S.routine.push({ id: uid(), title: title.charAt(0).toUpperCase() + title.slice(1), time: '', days: [], date: ymd(new Date()) });
    save(); renderRoutine(); tick();
  }
  function startListening() {
    if (!SR) return say('Este navegador não tem reconhecimento de voz. Use o Google Chrome.');
    if (location.protocol !== 'https:' && location.hostname !== 'localhost' && location.hostname !== '127.0.0.1') toast('A voz precisa de HTTPS ou localhost.', 5000);
    if (listening) { rec.stop(); return; }
    rec = new SR(); rec.lang = 'pt-BR'; rec.interimResults = true; rec.maxAlternatives = 1;
    rec.onstart = function () { listening = true; $('#micBtn').classList.add('listening'); toast('Ouvindo…', 8000); };
    rec.onresult = function (e) {
      var r = e.results[e.results.length - 1];
      if (r.isFinal) handleCommand(r[0].transcript); else toast('🗣️ ' + r[0].transcript + '…', 8000);
    };
    rec.onerror = function (e) { toast(e.error === 'not-allowed' ? 'Permita o uso do microfone.' : e.error === 'no-speech' ? 'Não ouvi nada.' : 'Erro de voz: ' + e.error); };
    rec.onend = function () { listening = false; $('#micBtn').classList.remove('listening'); };
    try { rec.start(); } catch (err) { toast('Não foi possível iniciar o microfone.'); }
  }
  $('#micBtn').addEventListener('click', startListening);
  if (window.speechSynthesis) speechSynthesis.onvoiceschanged = function () {};
  window.painelComando = handleCommand; // para testes no console

  // ---------- mais funções: timer, cronômetro, pesquisa, receitas ----------
  if (!S.recipes) S.recipes = seedRecipes();
  function seedRecipes() {
    return [
      { id: uid(), title: 'Bolo de cenoura', time: 40, serves: '10 fatias', tag: 'Doce',
        ingredients: ['3 cenouras médias', '3 ovos', '1 xícara de óleo', '2 xícaras de açúcar', '2 xícaras de farinha de trigo', '1 colher (sopa) de fermento'],
        steps: 'Bata no liquidificador a cenoura, os ovos e o óleo.\nMisture com o açúcar e a farinha, e por último o fermento.\nAsse em forno médio (180 °C) por cerca de 40 minutos.' },
      { id: uid(), title: 'Arroz soltinho', time: 20, serves: '4 pessoas', tag: 'Básico',
        ingredients: ['2 xícaras de arroz', '4 xícaras de água quente', '1 dente de alho', '1 colher (sopa) de óleo', 'Sal a gosto'],
        steps: 'Refogue o alho no óleo e junte o arroz.\nAcrescente a água quente e o sal.\nCozinhe em fogo baixo com a panela semitampada até secar (cerca de 20 minutos).' }
    ];
  }
  function fmtClock(ms, withTenths) {
    ms = Math.max(0, ms); var s = Math.floor(ms / 1000), h = Math.floor(s / 3600), m = Math.floor(s / 60) % 60, ss = s % 60;
    return (h ? h + ':' + pad(m) : pad(m)) + ':' + pad(ss) + (withTenths ? ',' + Math.floor(ms % 1000 / 100) : '');
  }

  // estado dos relógios (fica na memória enquanto o painel está aberto)
  var T = { end: 0, total: 0, paused: 0, label: '', ringing: false };
  var W = { start: 0, acc: 0, running: false, laps: [] };
  var audioCtx = null, ringTimer = null;
  function unlockAudio() {
    var AC = window.AudioContext || window.webkitAudioContext; if (!AC) return;
    if (!audioCtx) audioCtx = new AC();
    if (audioCtx.state === 'suspended' && audioCtx.resume) audioCtx.resume();
  }
  function beep() {
    if (!audioCtx) return;
    [0, 0.25, 0.5].forEach(function (d) {
      var o = audioCtx.createOscillator(), g = audioCtx.createGain(), t0 = audioCtx.currentTime + d;
      o.frequency.value = 880; o.connect(g); g.connect(audioCtx.destination);
      g.gain.setValueAtTime(0.0001, t0); g.gain.exponentialRampToValueAtTime(0.4, t0 + 0.02); g.gain.exponentialRampToValueAtTime(0.0001, t0 + 0.2);
      o.start(t0); o.stop(t0 + 0.22);
    });
  }
  function startTimer(min, label) {
    unlockAudio(); stopRing();
    T.total = Math.round(min * 60000); T.end = Date.now() + T.total; T.paused = 0; T.label = label || '';
    updatePill();
  }
  function stopRing() { T.ringing = false; clearInterval(ringTimer); updatePill(); }
  function timerLeft() { return T.paused ? T.paused : (T.end ? T.end - Date.now() : 0); }
  function clockTick() {
    if (T.end && !T.paused && !T.ringing && Date.now() >= T.end) {
      T.end = 0; T.ringing = true; beep(); ringTimer = setInterval(beep, 1500);
      setTimeout(stopRing, 60000);
      say((T.label ? T.label + ': ' : '') + 'o tempo acabou!');
      if (inStandby) exitStandby();
    }
    updatePill();
    var el = document.getElementById('tmDisplay');
    if (el) {
      el.textContent = T.ringing ? '00:00' : fmtClock(timerLeft() + (T.end && !T.paused ? 999 : 0));
      var b = document.getElementById('tmBar'); if (b) b.style.width = (T.total && (T.end || T.paused) ? (1 - timerLeft() / T.total) * 100 : 0) + '%';
    }
    var sw = document.getElementById('swDisplay');
    if (sw) sw.textContent = fmtClock(W.acc + (W.running ? Date.now() - W.start : 0), true);
  }
  setInterval(clockTick, 200);
  function updatePill() {
    var p = $('#timerPill'), on = T.ringing || T.end || T.paused || W.running;
    p.classList.toggle('hidden', !on); p.classList.toggle('ringing', T.ringing);
    if (!on) return;
    var txt = T.ringing ? 'Tempo esgotado! Toque para parar' :
      (T.end || T.paused) ? (T.label ? T.label + ' · ' : '') + fmtClock(timerLeft() + (T.paused ? 0 : 999)) + (T.paused ? ' (pausado)' : '') :
      'Cronômetro · ' + fmtClock(W.acc + Date.now() - W.start);
    $('#timerPillText').textContent = txt;
  }
  $('#timerPill').addEventListener('click', function () { if (T.ringing) stopRing(); else openTimer(); });

  function openTimer(tab) {
    tab = tab || (W.running && !T.end ? 'sw' : 'tm');
    openModal('Cronômetro e timer',
      '<div class="seg"><button data-tab="tm" class="' + (tab === 'tm' ? 'on' : '') + '">Timer</button><button data-tab="sw" class="' + (tab === 'sw' ? 'on' : '') + '">Cronômetro</button></div>' +
      '<div id="tmPane" class="' + (tab === 'tm' ? '' : 'hidden') + '">' +
        '<div class="big-clock" id="tmDisplay">00:00</div><div class="ring big"><div id="tmBar"></div></div>' +
        '<div class="presets">' + [1, 3, 5, 10, 15, 20, 30, 45, 60].map(function (m) { return '<button data-min="' + m + '">' + m + ' min</button>'; }).join('') + '</div>' +
        '<div class="row center"><input id="tmCustom" type="number" min="1" placeholder="min" class="mini-input"><button class="btn ghost" id="tmGo">Iniciar</button>' +
        '<button class="btn ghost" id="tmPause">Pausar</button><button class="btn danger" id="tmStop">Zerar</button></div>' +
      '</div>' +
      '<div id="swPane" class="' + (tab === 'sw' ? '' : 'hidden') + '">' +
        '<div class="big-clock" id="swDisplay">00:00,0</div>' +
        '<div class="row center"><button class="btn" id="swStart"></button><button class="btn ghost" id="swLap">Volta</button><button class="btn danger" id="swReset">Zerar</button></div>' +
        '<ol class="laps" id="swLaps"></ol>' +
      '</div>', function (root) {
        function swBtn() { $('#swStart').textContent = W.running ? 'Pausar' : (W.acc ? 'Continuar' : 'Iniciar'); }
        function laps() { $('#swLaps').innerHTML = W.laps.map(function (l, i) { return '<li><span>Volta ' + (i + 1) + '</span><span>' + fmtClock(l, true) + '</span></li>'; }).reverse().join(''); }
        function pauseLbl() { $('#tmPause').textContent = T.paused ? 'Continuar' : 'Pausar'; }
        swBtn(); laps(); pauseLbl(); clockTick();
        Array.prototype.forEach.call(root.querySelectorAll('.seg button'), function (b) {
          b.onclick = function () {
            var t = b.getAttribute('data-tab');
            root.querySelectorAll('.seg button')[0].classList.toggle('on', t === 'tm'); root.querySelectorAll('.seg button')[1].classList.toggle('on', t === 'sw');
            $('#tmPane').classList.toggle('hidden', t !== 'tm'); $('#swPane').classList.toggle('hidden', t !== 'sw');
          };
        });
        root.querySelector('.presets').onclick = function (e) { var b = e.target.closest('[data-min]'); if (b) { startTimer(+b.getAttribute('data-min')); pauseLbl(); } };
        $('#tmGo').onclick = function () { var v = +$('#tmCustom').value; if (v > 0) { startTimer(v); pauseLbl(); } };
        $('#tmPause').onclick = function () {
          if (T.paused) { T.end = Date.now() + T.paused; T.paused = 0; } else if (T.end) { T.paused = T.end - Date.now(); T.end = 0; }
          pauseLbl(); updatePill();
        };
        $('#tmStop').onclick = function () { T.end = 0; T.paused = 0; T.total = 0; stopRing(); pauseLbl(); clockTick(); };
        $('#swStart').onclick = function () {
          if (W.running) { W.acc += Date.now() - W.start; W.running = false; } else { W.start = Date.now(); W.running = true; }
          swBtn(); updatePill();
        };
        $('#swLap').onclick = function () { if (!W.running) return; W.laps.push(W.acc + Date.now() - W.start); laps(); };
        $('#swReset').onclick = function () { W = { start: 0, acc: 0, running: false, laps: [] }; swBtn(); laps(); clockTick(); updatePill(); };
      }, true);
  }

  // pesquisa web: abre em nova aba (sites não podem ser embutidos no painel)
  function webSearch(q) {
    if (!q) return;
    window.open('https://www.google.com/search?q=' + encodeURIComponent(q), '_blank');
  }
  function openSearch() {
    openModal('Pesquisar na web',
      '<form id="wsForm" class="quick big"><input id="wsInput" placeholder="O que você quer pesquisar?" autocomplete="off"><button type="submit" class="round dark" aria-label="Pesquisar">' + ic('search') + '</button></form>' +
      '<p class="hint">Abre o resultado em uma nova aba. Dica: diga "pesquisar previsão do tempo" no microfone.</p>' +
      '<div class="presets left">' + ['Previsão do tempo', 'Notícias de hoje', 'Cotação do dólar', 'Farmácia aberta perto de mim', 'Receita de pão caseiro'].map(function (s) { return '<button data-q="' + esc(s) + '">' + esc(s) + '</button>'; }).join('') + '</div>',
      function (root) {
        $('#wsInput').focus();
        $('#wsForm').onsubmit = function (e) { e.preventDefault(); webSearch($('#wsInput').value.trim()); };
        root.querySelector('.presets').onclick = function (e) { var b = e.target.closest('[data-q]'); if (b) webSearch(b.getAttribute('data-q')); };
      }, true);
  }

  // receitas
  function openRecipes(filter) {
    filter = filter || '';
    openModal('Receitas',
      '<div class="row"><form id="rcSearch" class="quick" style="flex:1;margin:0"><input id="rcQ" placeholder="Buscar receita ou ingrediente…" value="' + esc(filter) + '" autocomplete="off"></form>' +
      '<button class="btn" id="rcNew">+ Nova receita</button></div>' +
      '<div class="rc-grid" id="rcGrid"></div>', function () {
        function draw() {
          var q = norm($('#rcQ').value.trim());
          var list = S.recipes.filter(function (r) { return !q || norm(r.title + ' ' + (r.tag || '') + ' ' + r.ingredients.join(' ')).indexOf(q) >= 0; })
            .sort(function (a, b) { return a.title.localeCompare(b.title); });
          $('#rcGrid').innerHTML = list.length ? list.map(function (r, i) {
            return '<button class="rc-card c' + (i % 3) + '" data-id="' + r.id + '"><span class="rc-tag">' + esc(r.tag || 'Receita') + '</span>' +
              '<span class="rc-title">' + esc(r.title) + '</span><span class="rc-meta">' + ic('clock') + (r.time ? r.time + ' min' : '—') + (r.serves ? ' · ' + esc(r.serves) : '') + '</span></button>';
          }).join('') : '<p class="empty">Nenhuma receita encontrada.</p>';
        }
        draw();
        $('#rcQ').oninput = draw; $('#rcSearch').onsubmit = function (e) { e.preventDefault(); };
        $('#rcNew').onclick = function () { openRecipeForm(); };
        $('#rcGrid').onclick = function (e) { var c = e.target.closest('[data-id]'); if (c) openRecipe(c.getAttribute('data-id')); };
      }, true);
  }
  function findRecipe(id) { return S.recipes.filter(function (r) { return r.id === id; })[0]; }
  function openRecipe(id) {
    var r = findRecipe(id); if (!r) return;
    openModal(r.title,
      '<div class="rc-head"><span class="chip">' + esc(r.tag || 'Receita') + '</span>' + (r.time ? '<span class="chip">' + r.time + ' min</span>' : '') + (r.serves ? '<span class="chip">' + esc(r.serves) + '</span>' : '') + '</div>' +
      '<div class="rc-body"><div><h4>Ingredientes</h4><ul class="rc-ing">' + r.ingredients.map(function (i) { return '<li>' + esc(i) + '</li>'; }).join('') + '</ul></div>' +
      '<div><h4>Modo de preparo</h4><ol class="rc-steps">' + r.steps.split(/\n+/).filter(Boolean).map(function (s) { return '<li>' + esc(s) + '</li>'; }).join('') + '</ol></div></div>' +
      '<div class="row">' + (r.time ? '<button class="btn" id="rcTimer">' + ic('clock') + ' Timer de ' + r.time + ' min</button>' : '') +
      '<button class="btn ghost" id="rcShop">' + ic('cart') + ' Ingredientes nas compras</button>' +
      '<button class="btn ghost" id="rcEdit">Editar</button><button class="btn ghost" id="rcBack">Voltar</button></div>', function () {
        if (r.time) $('#rcTimer').onclick = function () { startTimer(r.time, r.title); closeModal(); toast('Timer de ' + r.time + ' min iniciado para ' + r.title + '.'); };
        $('#rcShop').onclick = function () {
          r.ingredients.forEach(function (i) { addToList('Compras', i); });
          S.activeList = 'Compras'; save(); renderLists(); toast(r.ingredients.length + ' ingredientes adicionados em Compras.');
        };
        $('#rcEdit').onclick = function () { openRecipeForm(r); };
        $('#rcBack').onclick = function () { openRecipes(); };
      }, true);
  }
  function openRecipeForm(r) {
    var isNew = !r; r = r || { title: '', time: '', serves: '', tag: '', ingredients: [], steps: '' };
    openModal(isNew ? 'Nova receita' : 'Editar receita',
      '<div class="field"><label>Nome</label><input id="rfTitle" value="' + esc(r.title) + '" placeholder="Ex.: Lasanha da vó"></div>' +
      '<div class="row"><div class="field" style="flex:1"><label>Tempo (min)</label><input id="rfTime" type="number" min="0" value="' + esc(r.time) + '"></div>' +
      '<div class="field" style="flex:1"><label>Rende</label><input id="rfServes" value="' + esc(r.serves) + '" placeholder="Ex.: 6 porções"></div>' +
      '<div class="field" style="flex:1"><label>Categoria</label><input id="rfTag" value="' + esc(r.tag) + '" placeholder="Ex.: Doce, Almoço"></div></div>' +
      '<div class="field"><label>Ingredientes (um por linha)</label><textarea id="rfIng" rows="6">' + esc(r.ingredients.join('\n')) + '</textarea></div>' +
      '<div class="field"><label>Modo de preparo (um passo por linha)</label><textarea id="rfSteps" rows="6">' + esc(r.steps) + '</textarea></div>' +
      '<div class="row"><button class="btn" id="rfSave">Salvar</button>' + (isNew ? '' : '<button class="btn danger" id="rfDel">Excluir</button>') + '<button class="btn ghost" id="rfCancel">Cancelar</button></div>',
      function () {
        $('#rfTitle').focus();
        $('#rfSave').onclick = function () {
          var t = $('#rfTitle').value.trim(); if (!t) return;
          var data = { title: t, time: +$('#rfTime').value || 0, serves: $('#rfServes').value.trim(), tag: $('#rfTag').value.trim(),
            ingredients: $('#rfIng').value.split('\n').map(function (x) { return x.trim(); }).filter(Boolean), steps: $('#rfSteps').value.trim() };
          if (isNew) { data.id = uid(); S.recipes.push(data); } else { for (var k in data) r[k] = data[k]; }
          save(); openRecipe(isNew ? data.id : r.id);
        };
        if (!isNew) $('#rfDel').onclick = function (ev) { if (confirmInline(ev.target)) { S.recipes = S.recipes.filter(function (x) { return x.id !== r.id; }); save(); openRecipes(); } };
        $('#rfCancel').onclick = function () { isNew ? openRecipes() : openRecipe(r.id); };
      }, true);
  }

  // menu "mais"
  function openMore() {
    var items = [
      { k: 'timer', t: 'Cronômetro', s: 'Timer e cronômetro', i: 'clock', c: 'c0' },
      { k: 'search', t: 'Pesquisa', s: 'Buscar na web', i: 'search', c: 'c1' },
      { k: 'recipes', t: 'Receitas', s: S.recipes.length + ' salvas', i: 'book', c: 'c2' }
    ];
    openModal('Mais funções', '<div class="more-grid">' + items.map(function (x) {
      return '<button class="more-tile ' + x.c + '" data-k="' + x.k + '"><span class="more-ic">' + ic(x.i) + '</span><span class="more-t">' + x.t + '</span><span class="more-s">' + x.s + '</span></button>';
    }).join('') + '</div>', function (root) {
      root.querySelector('.more-grid').onclick = function (e) {
        var b = e.target.closest('[data-k]'); if (!b) return; var k = b.getAttribute('data-k');
        if (k === 'timer') openTimer(); else if (k === 'search') openSearch(); else openRecipes();
      };
    }, true);
  }
  $('#moreBtn').addEventListener('click', openMore);

  // comandos de voz extras
  var NUM = { um: 1, uma: 1, dois: 2, duas: 2, tres: 3, quatro: 4, cinco: 5, seis: 6, sete: 7, oito: 8, nove: 9, dez: 10, quinze: 15, vinte: 20, trinta: 30, quarenta: 40, cinquenta: 50, sessenta: 60, meia: 0.5 };
  function toNum(w) { return isNaN(+w) ? NUM[w] : +w; }
  function extrasCommand(t) {
    var m;
    if ((m = t.match(/(?:timer|temporizador|alarme|cronometro|contar)\s+(?:de\s+|para\s+|por\s+)?(\d+|[a-z]+)\s+(minutos?|segundos?|horas?)/)) && toNum(m[1])) {
      var n = toNum(m[1]), min = /seg/.test(m[2]) ? n / 60 : /hora/.test(m[2]) ? n * 60 : n;
      startTimer(min); say('Timer de ' + m[1] + ' ' + m[2] + ' iniciado.'); return true;
    }
    if (/(parar|cancelar|desligar|zerar).*(timer|alarme|temporizador)/.test(t) || (T.ringing && /^(parar|para|ok|chega)$/.test(t))) {
      T.end = 0; T.paused = 0; stopRing(); say('Timer cancelado.'); return true;
    }
    if (/quanto tempo falta/.test(t)) { say(T.end ? 'Faltam ' + fmtClock(timerLeft() + 999) + '.' : 'Nenhum timer ligado.'); return true; }
    if (/^(iniciar|abrir|ligar)?\s*cronometro$/.test(t)) { W = { start: Date.now(), acc: 0, running: true, laps: [] }; openTimer('sw'); say('Cronômetro iniciado.'); return true; }
    if ((m = t.match(/^(?:pesquisa(?:r)?|pesquise|procura(?:r)?|procure|buscar|busque|google)\s+(?:por\s+|sobre\s+)?(.+)$/))) { say('Pesquisando ' + m[1] + '.'); webSearch(m[1]); return true; }
    if ((m = t.match(/(?:receita|receitas)(?:\s+(?:de|do|da))?\s*(.*)$/)) && !/adicion|coloc/.test(t)) {
      var q = m[1].trim(), hit = q && S.recipes.filter(function (r) { return norm(r.title).indexOf(q) >= 0; })[0];
      if (hit) { openRecipe(hit.id); say('Abrindo ' + hit.title + '.'); } else { openRecipes(q); say(q ? 'Não achei "' + q + '". Veja as receitas salvas.' : 'Suas receitas.'); }
      return true;
    }
    return false;
  }

  // ---------- início ----------
  function renderAll() { renderRoutine(); renderAgenda(); renderLists(); }
  // closest() para WebViews antigos
  if (!Element.prototype.closest) Element.prototype.closest = function (s) { var el = this; while (el && el.nodeType === 1) { if ((el.matches || el.webkitMatchesSelector).call(el, s)) return el; el = el.parentElement; } return null; };

  renderAll(); tick(); setInterval(tick, 1000);
  openDB().then(loadPhotos);
  syncGoogle(); setInterval(syncGoogle, 10 * 60000);
  resetIdle();
  if (/[?&]standby/.test(location.search)) enterStandby();
  if ('serviceWorker' in navigator && location.protocol !== 'file:') navigator.serviceWorker.register('sw.js').catch(function () {});
})();
