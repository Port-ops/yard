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
          (r.flagged && r.flagged.length ? '<div style="color:#b42318;margin-top:6px"><b>Tags not on our list:</b><br>' + r.flagged.join('<br>') + '</div>' : ''));
      });
  }).catch(function (e) { say('<span style="color:#b42318">' + (e.message || e) + '</span>'); });
  }
})();
