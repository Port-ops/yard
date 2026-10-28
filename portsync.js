// Port Sync — runs inside a signed-in GPA WebAccess page (webaccess.gaports.com).
// Reads today's AOLQ truck transactions + each EIRGPA ticket, then posts them to the Yard App.
// Read-only on the GPA side: it only opens the same report pages a person would click.
(function () {
  var API = window.PORTSYNC_API || 'https://script.google.com/macros/s/AKfycbwIyogZ3Pc3s7IPg8VOvwFESb2paY-Z6WmGNtAPWPtRZ0mp4qRI0gcxpA79oubtzoC2/exec';
  if (location.hostname !== 'webaccess.gaports.com') { alert('Open GPA WebAccess, sign in, then tap Port Sync again.'); return; }
  var box = document.getElementById('ps_box');
  if (!box) {
    box = document.createElement('div'); box.id = 'ps_box';
    box.style.cssText = 'position:fixed;z-index:99999;right:12px;top:12px;width:min(360px,92vw);max-height:80vh;overflow:auto;background:#fff;color:#1d2326;border:1px solid #2e2d6f;border-top:4px solid #e42430;border-radius:6px;padding:12px 14px;font:14px/1.4 system-ui,sans-serif;box-shadow:0 6px 24px rgba(0,0,0,.25)';
    document.body.appendChild(box);
  }
  function say(h) { box.innerHTML = '<b style="color:#2e2d6f">2FF Port Sync</b> <a href="#" onclick="this.parentNode.remove();return false" style="float:right;color:#5d686d">close</a><div style="margin-top:6px">' + h + '</div>'; }
  var k = '';
  try { k = localStorage.getItem('ps_k') || ''; } catch (e) {}
  if (!k) {
    say('Type your personal Yard App code (asked once on this device):<br><input id="ps_k" type="password" autocomplete="off" style="width:100%;margin:8px 0;padding:8px;font:inherit;border:1px solid #888;border-radius:4px"><button id="ps_go" style="background:#2e2d6f;color:#fff;border:0;border-radius:4px;padding:8px 14px;font:inherit;cursor:pointer">Start Port Sync</button>');
    document.getElementById('ps_go').onclick = function () {
      var v = document.getElementById('ps_k').value.trim(); if (!v) return;
      try { localStorage.setItem('ps_k', v); } catch (e) {}
      run(v);
    };
    return;
  }
  run(k);
  function run(k) {

  var MON = { JAN: '01', FEB: '02', MAR: '03', APR: '04', MAY: '05', JUN: '06', JUL: '07', AUG: '08', SEP: '09', OCT: '10', NOV: '11', DEC: '12' };
  function gpaDay(d) { return ('0' + d.getDate()).slice(-2) + '-' + Object.keys(MON)[d.getMonth()] + '-' + d.getFullYear(); }
  function isoFromEir(s) { var m = /(\d\d)-([A-Za-z]{3})-(\d{4}) (\d\d:\d\d:\d\d)/.exec(s || ''); return m ? m[3] + '-' + MON[m[2].toUpperCase()] + '-' + m[1] + ' ' + m[4] : ''; }
  function page(u, body) {
    return fetch(u, body ? { method: 'POST', body: body, credentials: 'include' } : { credentials: 'include' })
      .then(function (r) { return r.text(); })
      .then(function (t) {
        if (/name=["']?password|passWordSubmit/i.test(t) && !/TRUCKTRANSACTIONS|GateDocuments|Georgia Ports Authority, Savan/i.test(t)) throw new Error('WebAccess signed out. Sign in again, then tap Port Sync.');
        return new DOMParser().parseFromString(t, 'text/html');
      });
  }
  function gkeyOf(tr, kind) {
    var a = [].slice.call(tr.querySelectorAll('a')).map(function (x) { return x.getAttribute('href') || ''; }).filter(function (h) { return h.indexOf(kind + '&gkey=') >= 0; })[0];
    var m = a && /gkey=(\d+)/.exec(a); return m ? m[1] : '';
  }
  function eir(gkey) {
    return page('/express/displayReport.do?param=GateDocuments&gkey=' + gkey).then(function (d) {
      var h = [].slice.call(d.querySelectorAll('a')).map(function (x) { return x.getAttribute('href') || ''; }).filter(function (x) { return /class=EIRGPA/.test(x); })[0];
      var m = h && /gkey=(\d+)/.exec(h); if (!m) return null;
      return page('/express/displayReport.do?param=GateDocument&gkey=' + m[1] + '&seq=+&class=EIRGPA');
    }).then(function (d) {
      if (!d) return null;
      var L = [].slice.call(d.querySelectorAll('td')).filter(function (td) { return !td.querySelector('table'); }).map(function (td) { return td.textContent.replace(/\s+/g, ' ').trim(); });
      function val(lbl) { var i = L.indexOf(lbl); if (i < 0) return ''; var v = L[i + 1] || ''; return /^(Driver Name|Truck ID|Container|Size\/Type|Chassis|Vessel|Booking|Chs Acc|Ctr Acc|Scale Wt|Gross Wt|Temp|Seals)$/.test(v) ? '' : v; }
      var when = ''; L.some(function (x) { var t = isoFromEir(x); if (t) { when = t; return true; } return false; });
      return { chassis: val('Chassis'), tag: val('Truck ID'), driver: val('Driver Name'), seal: val('Seals'), gross: val('Gross Wt'), booking: val('Booking'), time: when };
    }).catch(function () { return null; });
  }


  // ---- Port Watch: set GPA "Notify" (Today > Notify) for containers staff added in the Yard App. Only after the employee taps Set. ----
  function api(fn, args) { return fetch(API, { method: 'POST', headers: { 'Content-Type': 'text/plain;charset=utf-8' }, body: JSON.stringify({ fn: fn, args: args || [], k: k, at: Date.now() }) }).then(function (r) { return r.json(); }).then(function (j) { if (j && j.error) throw new Error(j.error); return j && (j.data !== undefined ? j.data : j.result); }); }
  function labelOf(el) {
    var t = '';
    if (el.id) { var l = el.ownerDocument.querySelector('label[for="' + el.id + '"]'); if (l) t = l.textContent; }
    if (!t) { var td = el.closest('td'); var pv = td && td.previousElementSibling; if (pv) t = pv.textContent; }
    if (!t) { var n = el.previousSibling; while (n && !t) { t = (n.textContent || '').trim(); n = n.previousSibling; } }
    return (t || el.name || '').replace(/\s+/g, ' ').trim();
  }
  // GPA WebAccess Today > Notify (read Oct 27 2026): textarea eq_nbr, select tserv_id (AVAILABLE = "Available - Container becomes available"),
  // select address_type (EMAIL/FAX/SMS), text address, hidden form=Y reset=N param=Notify, POST displayReport.do.
  // The <form> sits inside a table, so it is parsed from the raw HTML between <FORM name="Notify"> and </FORM>.
  function notifyForm() {
    var href = '/express/secure/Notify.jsp';
    return fetch(href, { credentials: 'include' }).then(function (r) { return r.text(); }).then(function (t) {
      var a = t.search(/<FORM name="Notify"/i), b = t.indexOf('</FORM>', a);
      if (a < 0 || b < 0) throw new Error('Notify page not found. Sign in to WebAccess again.');
      var act = (/action="([^"]*)"/i.exec(t.slice(a, a + 200)) || [])[1] || 'displayReport.do';
      var d = new DOMParser().parseFromString('<table>' + t.slice(a, b) + '</table>', 'text/html'), F = { url: new URL(act, location.origin + href).pathname, hidden: {} };
      F.c = d.querySelector('[name=eq_nbr]'); F.ev = d.querySelector('select[name=tserv_id]'); F.by = d.querySelector('select[name=address_type]'); F.to = d.querySelector('[name=address]');
      if (!F.c || !F.ev || !F.to) throw new Error('GPA changed the Notify form. Set these by hand in Today > Notify.');
      [].slice.call(d.querySelectorAll('input[type=hidden]')).forEach(function (h) { F.hidden[h.name] = h.value; });
      F.opts = [].slice.call(F.ev.options).map(function (o) { return { v: o.value, t: o.textContent.trim() }; });
      F.events = F.opts.map(function (o) { return o.t; });
      return F;
    });
  }
  function submitOne(F, c, evText, email) {
    var o = F.opts.filter(function (x) { return x.t === evText; })[0]; if (!o) return Promise.resolve({ ok: false, msg: 'Event not offered by GPA.' });
    var fd = new URLSearchParams(F.hidden); fd.set('eq_nbr', c); fd.set('tserv_id', o.v); if (F.by) fd.set('address_type', 'EMAIL'); fd.set('address', email); fd.set('btnsubmit', 'Submit');
    return fetch(F.url, { method: 'POST', credentials: 'include', headers: { 'Content-Type': 'application/x-www-form-urlencoded' }, body: fd.toString() })
      .then(function (r) { return r.text(); }).then(function (t) {
        var d = new DOMParser().parseFromString(t, 'text/html');
        var err = [].slice.call(d.querySelectorAll('.error,.errors,font[color=red],.errorMessage,td.err')).map(function (x) { return x.textContent.trim(); }).filter(Boolean).join(' ');
        if (err) return { ok: false, msg: err.slice(0, 160) };
        return t.indexOf(c) >= 0 ? { ok: true } : { ok: false, msg: 'GPA did not list it under Pending. Check Today > Notify.' };
      }).catch(function (e) { return { ok: false, msg: e.message || String(e) }; });
  }
  function watchStep(k) {
    var W = document.getElementById('ps_w'); if (!W) return;
    api('watchPending').then(function (p) {
      if (!p || !p.items || !p.items.length) return;
      W.innerHTML = '<hr style="border:0;border-top:1px solid #ddd;margin:10px 0"><b style="color:#2e2d6f">Port Watch</b><div>Reading GPA Notify…</div>';
      return notifyForm().then(function (F) {
        var pre = p.event && F.events.indexOf(p.event) >= 0 ? p.event : (F.events.filter(function (x) { return /^Available/i.test(x); })[0] || '');
        W.innerHTML = '<hr style="border:0;border-top:1px solid #ddd;margin:10px 0"><b style="color:#2e2d6f">Port Watch</b>' +
          '<div style="margin:4px 0">' + p.items.length + ' container(s) to watch: <span style="font-family:monospace">' + p.items.map(function (x) { return x.c; }).join(', ') + '</span></div>' +
          '<label style="display:block;margin:6px 0 2px">GPA: Notify me when</label><select id="ps_ev" style="width:100%;padding:6px;font:inherit"><option value="">Pick the GPA event…</option>' +
          F.events.map(function (e) { return '<option' + (e === pre ? ' selected' : '') + '>' + e.replace(/</g, '&lt;') + '</option>'; }).join('') + '</select>' +
          '<div style="font-size:12px;color:#5d686d;margin:4px 0">GPA emails ' + p.email + '. The Yard App reads that inbox and flags the box.</div>' +
          '<button id="ps_wgo" style="background:#2e2d6f;color:#fff;border:0;border-radius:4px;padding:8px 14px;font:inherit;cursor:pointer;margin-top:4px">Set GPA alerts</button> <a href="#" id="ps_wno" style="color:#5d686d">Not now</a><div id="ps_wmsg" style="margin-top:6px"></div>';
        document.getElementById('ps_wno').onclick = function () { W.innerHTML = ''; return false; };
        document.getElementById('ps_wgo').onclick = function () {
          var ev = document.getElementById('ps_ev').value, M = document.getElementById('ps_wmsg'); if (!ev) { M.textContent = 'Pick the GPA event first.'; return; }
          this.disabled = true; var res = [], i = 0;
          (function next() {
            if (i >= p.items.length) {
              var ok = res.filter(function (r) { return r.ok; }).length;
              api('watchSubscribed', [{ events: F.events, event: ev, results: res }]).then(function () {
                M.innerHTML = '<span style="color:#1a7f37;font-weight:600">' + ok + ' of ' + res.length + ' set at GPA.</span>' + res.filter(function (r) { return !r.ok; }).map(function (r) { return '<br><span style="color:#b42318">' + r.c + ': ' + r.msg + '</span>'; }).join('');
              }).catch(function (e) { M.textContent = 'Set at GPA, but the Yard App did not save it: ' + (e.message || e); });
              return;
            }
            var it = p.items[i++]; M.textContent = 'Setting ' + it.c + ' (' + i + '/' + p.items.length + ')…';
            submitOne(F, it.c, ev, p.email).then(function (r) { r.id = it.id; r.c = it.c; res.push(r); setTimeout(next, 600); });
          })();
        };
      });
    }).catch(function (e) { if (/Unknown action/i.test(e.message || e)) return; W.innerHTML = '<div style="color:#b42318;margin-top:8px">Port Watch: ' + (e.message || e) + '</div>'; });
  }

  // ---- SCAC finder: for containers the Yard App asked about, read GPA Container History (read-only) and report who pulled them ----
  function eqHistory(c) {
    var fd = new URLSearchParams({ method: 'querySubmit', fldName: 'equipmentID', equipmentID: '', bookingID: '', nbr: '', equipmentClass: 'CTR', eqNbr: c, param: 'EqHistory', submitted: 'true' });
    return page('/express/displayReport.do', fd).then(function (d) {
      [].slice.call(d.querySelectorAll('script,style')).forEach(function (x) { x.remove(); });
      var s = (d.body ? d.body.textContent : '').replace(/\s+/g, ' ');
      var re = /(FULL_OUT|EMPTY_OUT)([A-Z]{2,5})\s?(\d{1,2}\/\d{1,2}\/\d{2,4} [\d:]+ [AP]M)\s?(?:SCAC:\s?([A-Z]{2,5}))?/g, m = re.exec(s);
      if (!m) return { c: c, scac: '', note: /Number:\s?[A-Z]{4}\d{7}/.test(s) ? 'No out-gate at GCT in GPA history' : 'Not found at GPA' };
      return { c: c, scac: m[4] || '', event: m[1], line: m[2], when: m[3], facility: 'GCT', note: m[4] ? '' : 'Out-gate found but no SCAC shown' };
    }).catch(function (e) { return { c: c, scac: '', note: 'Lookup failed: ' + (e.message || e) }; });
  }
  function scacStep() {
    api('scacPending').then(function (list) {
      if (!list || !list.length) return;
      var W = document.getElementById('ps_w'); var S = document.createElement('div'); S.style.marginTop = '8px'; if (W) W.after(S); else box.appendChild(S);
      var res = [], i = 0;
      (function next() {
        if (i >= list.length) { api('scacResults', [res]).then(function () { var f = res.filter(function (r) { return r.scac; }).length; S.innerHTML = '<b style="color:#2e2d6f">SCAC finder</b><br>' + f + ' of ' + res.length + ' container(s) found: ' + res.map(function (r) { return r.c + (r.scac ? ' → ' + r.scac : ' → ' + (r.note || 'not found')); }).join('<br>'); }).catch(function (e) { S.textContent = 'SCAC finder: ' + (e.message || e); }); return; }
        var c = list[i++]; S.innerHTML = '<b style="color:#2e2d6f">SCAC finder</b><br>Looking up ' + c + ' (' + i + '/' + list.length + ')…';
        eqHistory(c).then(function (r) { res.push(r); setTimeout(next, 400); });
      })();
    }).catch(function (e) { if (!/Unknown action/i.test(e.message || e)) { var x = document.createElement('div'); x.style.color = '#b42318'; x.textContent = 'SCAC finder: ' + (e.message || e); box.appendChild(x); } });
  }
  var days = Number(window.PORTSYNC_DAYS || 1), end = new Date(), start = new Date(Date.now() - (days - 1) * 86400000);
  say('Reading AOLQ gate moves ' + (days > 1 ? 'for ' + days + ' days' : 'for today') + '…');
  var fd = new URLSearchParams({ startDate: gpaDay(start), endDate: gpaDay(end), nbr: '', trkcid_Lov: 'AOLQ', trkcid: 'AOLQ', trkid: '', eqid: '', submitted: 'true', param: 'TruckTransactions' });
  page('/express/displayReport.do', fd).then(function (d) {
    var tbl = [].slice.call(d.querySelectorAll('table')).filter(function (x) { return /PIN\/TRANS/i.test(x.textContent) && x.querySelectorAll('tr').length > 2; }).pop();
    if (!tbl) throw new Error('No truck transactions found.');
    var rows = [].slice.call(tbl.querySelectorAll('tr')).filter(function (tr) { return tr.cells.length >= 12 && /^\d+$/.test(tr.cells[0].textContent.trim()); });
    var moves = rows.map(function (tr) {
      var c = [].slice.call(tr.cells).map(function (x) { return x.textContent.trim(); });
      return { pin: c[0], time: c[1], type: c[2].split(' ')[0], status: c[3], tag: c[4], line: c[7], container: c[8], booking: c[9], gkey: gkeyOf(tr, 'GateDocuments') };
    }).filter(function (m) { return m.status.indexOf('[PIN]') < 0 && m.tag !== 'UNKNOWN'; });
    say('Found ' + moves.length + ' gate moves. Reading EIR tickets… 0/' + moves.length);
    var done = 0, i = 0;
    function next() {
      if (i >= moves.length) return Promise.resolve();
      var m = moves[i++];
      return (m.gkey ? eir(m.gkey) : Promise.resolve(null)).then(function (e) {
        if (e) { ['chassis', 'driver', 'seal', 'gross'].forEach(function (f) { if (e[f]) m[f] = e[f]; }); if (e.tag) m.tag = e.tag; if (e.time) m.time = e.time; if (e.booking && !m.booking) m.booking = e.booking; }
        delete m.gkey; done++;
        say('Found ' + moves.length + ' gate moves. Reading EIR tickets… ' + done + '/' + moves.length);
        return next();
      });
    }
    return Promise.all([next(), next(), next()]).then(function () { return moves; });
  }).then(function (moves) {
    say('Sending ' + moves.length + ' moves to the Yard App…');
    return fetch(API, { method: 'POST', headers: { 'Content-Type': 'text/plain;charset=utf-8' }, body: JSON.stringify({ fn: 'portIngest', args: [moves], k: k, at: Date.now() }) })
      .then(function (r) { return r.json(); })
      .then(function (j) {
        if (j && j.error) { if (/View only|Sign in/i.test(j.error)) try { localStorage.removeItem('ps_k'); } catch (e) {} throw new Error(j.error); }
        var r = (j && (j.result || j.data || j)) || {};
        say('<span style="color:#1a7f37;font-weight:600">Done.</span> ' + moves.length + ' AOLQ moves read: ' + (r.added || 0) + ' new, ' + (r.updated || 0) + ' updated, ' + (r.skipped || 0) + ' skipped (not our trucks).' +
          (r.flagged && r.flagged.length ? '<div style="color:#b42318;margin-top:6px"><b>Tags not on our list:</b><br>' + r.flagged.join('<br>') + '</div>' : '') + '<div id="ps_w"></div>');
        watchStep(k); scacStep();
      });
  }).catch(function (e) { say('<span style="color:#b42318">' + (e.message || e) + '</span>'); });
  }
})();
