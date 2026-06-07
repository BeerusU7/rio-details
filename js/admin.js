/* ============================================================
   RIO.DETAILS — Owner Dashboard logic
   Reads bookings from RioStore, renders, filters, and lets
   Rio mark complete / cancel.
   ============================================================ */
(function () {
  'use strict';
  if (!window.RioStore) return;

  var listEl = document.querySelector('[data-list]');
  var emptyEl = document.querySelector('[data-empty]');
  var searchEl = document.querySelector('[data-search]');
  var filters = Array.prototype.slice.call(document.querySelectorAll('.adm-filter'));

  var activeFilter = 'all';
  var query = '';

  var MONTHS = ['Jan', 'Feb', 'Mar', 'Apr', 'May', 'Jun', 'Jul', 'Aug', 'Sep', 'Oct', 'Nov', 'Dec'];

  function parsePrice(p) {
    var m = (p || '').match(/\d+/);
    return m ? Number(m[0]) : 0;
  }
  function todayStr() {
    var d = new Date();
    return d.getFullYear() + '-' + String(d.getMonth() + 1).padStart(2, '0') + '-' + String(d.getDate()).padStart(2, '0');
  }
  function esc(s) {
    return String(s == null ? '' : s).replace(/[&<>"]/g, function (c) {
      return { '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;' }[c];
    });
  }
  function fmtPhone(p) {
    var d = String(p || '').replace(/\D/g, '');
    if (d.length === 11 && d.charAt(0) === '1') d = d.slice(1);
    if (d.length === 10) return '(' + d.slice(0, 3) + ') ' + d.slice(3, 6) + '-' + d.slice(6);
    return p;
  }

  function renderStats(all) {
    var today = todayStr();
    var upcoming = all.filter(function (b) { return b.status === 'upcoming'; });
    document.querySelector('[data-stat-upcoming]').textContent = upcoming.length;
    document.querySelector('[data-stat-today]').textContent =
      all.filter(function (b) { return b.date === today && b.status !== 'cancelled'; }).length;
    document.querySelector('[data-stat-completed]').textContent =
      all.filter(function (b) { return b.status === 'completed'; }).length;
    var revenue = all.filter(function (b) { return b.status !== 'cancelled'; })
      .reduce(function (sum, b) { return sum + parsePrice(b.price); }, 0);
    document.querySelector('[data-stat-revenue]').textContent = '$' + revenue.toLocaleString();
  }

  function card(b) {
    var parts = b.date.split('-');
    var day = parts[2], mon = MONTHS[Number(parts[1]) - 1];
    var statusClass = b.status === 'completed' ? 'is-completed' : (b.status === 'cancelled' ? 'is-cancelled' : '');
    var badge = '<span class="bk-badge bk-badge--' + b.status + '">' + b.status + '</span>';

    var actions = '';
    if (b.status === 'upcoming') {
      actions =
        '<button class="bk-act bk-act--done" title="Mark completed" data-done="' + b.id + '" aria-label="Mark completed">' +
        '<svg viewBox="0 0 24 24" width="18" height="18"><path d="M5 13l4 4L19 7" fill="none" stroke="currentColor" stroke-width="2.2" stroke-linecap="round" stroke-linejoin="round"/></svg></button>' +
        '<button class="bk-act bk-act--cancel" title="Cancel" data-cancel="' + b.id + '" aria-label="Cancel booking">' +
        '<svg viewBox="0 0 24 24" width="18" height="18"><path d="M6 6l12 12M18 6L6 18" fill="none" stroke="currentColor" stroke-width="2.2" stroke-linecap="round"/></svg></button>';
    } else {
      actions =
        '<button class="bk-act bk-act--cancel" title="Delete" data-delete="' + b.id + '" aria-label="Delete booking">' +
        '<svg viewBox="0 0 24 24" width="18" height="18"><path d="M4 7h16M9 7V4h6v3M7 7l1 13h8l1-13" fill="none" stroke="currentColor" stroke-width="1.8" stroke-linecap="round" stroke-linejoin="round"/></svg></button>';
    }

    return '<article class="bk-card ' + statusClass + '">' +
      '<div class="bk-card__date"><div class="d">' + day + '</div><div class="m">' + mon + '</div></div>' +
      '<div class="bk-card__main">' +
        '<div class="bk-card__name">' + esc(b.name) + ' ' + badge + ' <span class="bk-card__ref">' + esc(b.id) + '</span></div>' +
        '<div class="bk-card__meta">' + esc(b.vehicle) + ' — ' + esc(b.address) + '</div>' +
        '<div class="bk-card__contact">' + esc(fmtPhone(b.phone)) + ' · ' + esc(b.email) + '</div>' +
      '</div>' +
      '<div class="bk-card__when"><div class="bk-card__time">' + esc(b.time) + '</div>' +
        '<div class="bk-card__svc">' + esc(b.service) + ' · ' + esc(b.price) + '</div></div>' +
      '<div class="bk-card__actions">' + actions + '</div>' +
    '</article>';
  }

  function render() {
    var all = RioStore.all();
    renderStats(all);

    var rows = all.filter(function (b) {
      if (activeFilter !== 'all' && b.status !== activeFilter) return false;
      if (!query) return true;
      var hay = (b.name + ' ' + b.vehicle + ' ' + b.id + ' ' + b.email + ' ' + b.address).toLowerCase();
      return hay.indexOf(query) !== -1;
    });

    if (all.length === 0) {
      listEl.innerHTML = '';
      emptyEl.hidden = false;
      return;
    }
    emptyEl.hidden = true;
    listEl.innerHTML = rows.length
      ? rows.map(card).join('')
      : '<p class="adm-note" style="text-align:center;border:0;margin:2rem 0;">No bookings match your search.</p>';
  }

  /* Event delegation for row actions */
  listEl.addEventListener('click', function (e) {
    var done = e.target.closest('[data-done]');
    var cancel = e.target.closest('[data-cancel]');
    var del = e.target.closest('[data-delete]');
    if (done) { RioStore.update(done.getAttribute('data-done'), { status: 'completed' }); render(); }
    else if (cancel) { RioStore.update(cancel.getAttribute('data-cancel'), { status: 'cancelled' }); render(); }
    else if (del) {
      if (confirm('Delete this booking permanently?')) { RioStore.remove(del.getAttribute('data-delete')); render(); }
    }
  });

  filters.forEach(function (f) {
    f.addEventListener('click', function () {
      filters.forEach(function (x) { x.classList.remove('is-active'); });
      f.classList.add('is-active');
      activeFilter = f.getAttribute('data-filter');
      render();
    });
  });

  searchEl.addEventListener('input', function () { query = searchEl.value.trim().toLowerCase(); render(); });

  // Re-render if a booking is made in another tab
  window.addEventListener('storage', render);

  render();
})();
