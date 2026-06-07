/* ============================================================
   RIO.DETAILS — booking flow
   A quick, low-friction on-page booking: service -> time ->
   details -> instant confirmation. Persists via RioStore and
   produces a real add-to-calendar (.ics) file.
   ============================================================ */
(function () {
  'use strict';

  var root = document.querySelector('[data-booker]');
  if (!root || !window.RioStore) return;

  var form = root.querySelector('[data-book-form]');
  var status = root.querySelector('[data-book-status]');
  var slotsWrap = root.querySelector('[data-slots]');
  var slotHint = root.querySelector('[data-slot-hint]');
  var dateInput = root.querySelector('#bk-date');

  var SLOTS = [
    { label: '8:00 AM', t24: '08:00' },
    { label: '10:00 AM', t24: '10:00' },
    { label: '12:00 PM', t24: '12:00' },
    { label: '2:00 PM', t24: '14:00' },
    { label: '4:00 PM', t24: '16:00' },
    { label: '6:00 PM', t24: '18:00' }
  ];
  var DURATIONS = { 'Signature Interior': 2, 'Full Premium Detail': 4, 'Exterior & Paint': 2 };

  var state = { service: 'Full Premium Detail', price: 'From $299', time: '', time24: '' };

  /* ---------- helpers ---------- */
  function pad(n) { return String(n).padStart(2, '0'); }
  function todayStr() {
    var d = new Date();
    return d.getFullYear() + '-' + pad(d.getMonth() + 1) + '-' + pad(d.getDate());
  }
  function tomorrowStr() {
    var d = new Date(); d.setDate(d.getDate() + 1);
    return d.getFullYear() + '-' + pad(d.getMonth() + 1) + '-' + pad(d.getDate());
  }
  function prettyDate(dateStr) {
    var parts = dateStr.split('-');
    var d = new Date(parts[0], parts[1] - 1, parts[2]);
    return d.toLocaleDateString(undefined, { weekday: 'long', month: 'long', day: 'numeric' });
  }
  function firstName(full) { return (full || '').trim().split(' ')[0] || 'there'; }

  /* ---------- service chips ---------- */
  root.querySelectorAll('[data-service]').forEach(function (chip) {
    chip.addEventListener('click', function () {
      root.querySelectorAll('[data-service]').forEach(function (c) {
        c.classList.remove('is-selected'); c.setAttribute('aria-checked', 'false');
      });
      chip.classList.add('is-selected'); chip.setAttribute('aria-checked', 'true');
      state.service = chip.querySelector('.chip__title').textContent.trim();
      state.price = chip.getAttribute('data-price') || '';
    });
  });

  /* ---------- time slots ---------- */
  function renderSlots() {
    var date = dateInput.value;
    slotsWrap.innerHTML = '';
    if (!date) { slotHint.textContent = 'Select a date first'; return; }
    slotHint.textContent = '';
    var anyOpen = false;
    SLOTS.forEach(function (slot) {
      var taken = RioStore.isSlotTaken(date, slot.label);
      var btn = document.createElement('button');
      btn.type = 'button';
      btn.className = 'chip chip--time' + (taken ? ' is-taken' : '');
      btn.setAttribute('role', 'radio');
      btn.setAttribute('aria-checked', 'false');
      btn.innerHTML = '<span class="chip__title">' + slot.label + '</span>' +
        (taken ? '<span class="chip__meta">Booked</span>' : '');
      if (taken) {
        btn.disabled = true;
      } else {
        anyOpen = true;
        btn.addEventListener('click', function () {
          slotsWrap.querySelectorAll('.chip--time').forEach(function (c) {
            c.classList.remove('is-selected'); c.setAttribute('aria-checked', 'false');
          });
          btn.classList.add('is-selected'); btn.setAttribute('aria-checked', 'true');
          state.time = slot.label; state.time24 = slot.t24;
          clearStatus();
        });
      }
      slotsWrap.appendChild(btn);
    });
    // reset selection when date changes
    state.time = ''; state.time24 = '';
    if (!anyOpen) slotHint.textContent = 'Fully booked — try another day';
  }

  dateInput.min = todayStr();
  dateInput.value = tomorrowStr();
  renderSlots();
  dateInput.addEventListener('change', renderSlots);

  /* ---------- step navigation ---------- */
  function goto(step) {
    root.querySelectorAll('.booker__step').forEach(function (s) {
      s.classList.toggle('is-active', s.getAttribute('data-step') === String(step));
    });
    root.querySelectorAll('[data-step-dot]').forEach(function (dot) {
      var n = Number(dot.getAttribute('data-step-dot'));
      dot.classList.toggle('is-active', n === step);
      dot.classList.toggle('is-done', n < step);
    });
    var card = root.getBoundingClientRect();
    if (card.top < 0) root.scrollIntoView({ behavior: 'smooth', block: 'start' });
  }

  function clearStatus() { if (status) { status.textContent = ''; status.classList.remove('is-success'); } }
  function showStatus(msg) { if (status) { status.textContent = msg; status.classList.remove('is-success'); } }

  function flagInvalid(el) {
    el.classList.add('is-invalid');
    el.addEventListener('input', function once() { el.classList.remove('is-invalid'); el.removeEventListener('input', once); });
  }

  /* Step 1 -> Step 2 */
  root.querySelector('[data-next]').addEventListener('click', function () {
    var vehicle = form.querySelector('#bk-vehicle');
    var ok = true;
    if (!vehicle.value.trim()) { flagInvalid(vehicle); ok = false; }
    if (!dateInput.value) { flagInvalid(dateInput); ok = false; }
    if (!state.time) { ok = false; slotsWrap.classList.add('shake'); setTimeout(function () { slotsWrap.classList.remove('shake'); }, 500); }
    if (!ok) { showStatus('Pick your vehicle, date, and a time to continue.'); return; }
    clearStatus();
    renderSummary();
    goto(2);
  });

  /* Step 2 -> back */
  root.querySelector('[data-back]').addEventListener('click', function () { clearStatus(); goto(1); });

  function renderSummary() {
    var el = root.querySelector('[data-summary]');
    el.innerHTML =
      '<div class="sumline"><span>Service</span><strong>' + state.service + ' · ' + state.price + '</strong></div>' +
      '<div class="sumline"><span>When</span><strong>' + prettyDate(dateInput.value) + ' at ' + state.time + '</strong></div>' +
      '<div class="sumline"><span>Vehicle</span><strong>' + form.querySelector('#bk-vehicle').value.trim() + '</strong></div>';
  }

  /* ---------- .ics calendar file ---------- */
  function buildIcs(b) {
    var start = b.date.replace(/-/g, '') + 'T' + b.time24.replace(':', '') + '00';
    var hrs = DURATIONS[b.service] || 3;
    var parts = b.date.split('-');
    var end = new Date(parts[0], parts[1] - 1, parts[2], Number(b.time24.split(':')[0]) + hrs, Number(b.time24.split(':')[1]));
    var endStr = end.getFullYear() + pad(end.getMonth() + 1) + pad(end.getDate()) + 'T' + pad(end.getHours()) + pad(end.getMinutes()) + '00';
    var lines = [
      'BEGIN:VCALENDAR', 'VERSION:2.0', 'PRODID:-//Rio.Details//Booking//EN',
      'BEGIN:VEVENT', 'UID:' + b.id + '@rio.details',
      'DTSTART:' + start, 'DTEND:' + endStr,
      'SUMMARY:Rio.Details — ' + b.service,
      'DESCRIPTION:' + b.service + ' for your ' + b.vehicle + '. Booking ' + b.id + '. We come to you.',
      'LOCATION:' + b.address.replace(/,/g, '\\,'),
      'END:VEVENT', 'END:VCALENDAR'
    ];
    return lines.join('\r\n');
  }

  /* ---------- confirm / submit ---------- */
  form.addEventListener('submit', function (e) {
    e.preventDefault();
    var fields = ['#bk-name', '#bk-phone', '#bk-email', '#bk-address'];
    var ok = true, firstBad = null;
    fields.forEach(function (sel) {
      var el = form.querySelector(sel);
      var valid = el.checkValidity() && el.value.trim().length > 0;
      if (!valid) { flagInvalid(el); ok = false; firstBad = firstBad || el; }
    });
    if (!ok) { showStatus('Please complete your details so we can confirm.'); if (firstBad) firstBad.focus(); return; }

    var booking = RioStore.add({
      service: state.service,
      price: state.price,
      vehicle: form.querySelector('#bk-vehicle').value.trim(),
      date: dateInput.value,
      time: state.time,
      time24: state.time24,
      name: form.querySelector('#bk-name').value.trim(),
      phone: form.querySelector('#bk-phone').value.trim(),
      email: form.querySelector('#bk-email').value.trim(),
      address: form.querySelector('#bk-address').value.trim()
    });

    // Confirmation UI
    var fn = firstName(booking.name);
    root.querySelector('[data-confirm-sub]').textContent =
      fn + ', your ' + booking.service + ' is locked in.';
    root.querySelector('[data-confirm-card]').innerHTML =
      '<div class="sumline"><span>When</span><strong>' + prettyDate(booking.date) + ' · ' + booking.time + '</strong></div>' +
      '<div class="sumline"><span>Vehicle</span><strong>' + booking.vehicle + '</strong></div>' +
      '<div class="sumline"><span>Where</span><strong>' + booking.address + '</strong></div>' +
      '<div class="sumline"><span>Reference</span><strong class="ref">' + booking.id + '</strong></div>';

    buildPreviews(booking, fn);

    // Real calendar download
    var ics = buildIcs(booking);
    var blob = new Blob([ics], { type: 'text/calendar' });
    root.querySelector('[data-ics]').href = URL.createObjectURL(blob);

    clearStatus();
    goto(3);
  });

  /* ---------- Simulated notifications + message previews ---------- */
  var PHONE = '(248) 555-0100';

  function buildPreviews(b, fn) {
    // Notification rows
    root.querySelector('[data-notify-email-to]').textContent = 'to ' + b.email;
    root.querySelector('[data-notify-sms-to]').textContent = 'to ' + b.phone;
    setPill('[data-notify-email-status]', 'Ready', '');
    setPill('[data-notify-sms-status]', 'Scheduled', '');

    // Email mock
    root.querySelector('[data-mail-subject]').textContent =
      "You're booked with Rio.Details — " + prettyDate(b.date);
    root.querySelector('[data-mail-body]').innerHTML =
      '<p>Hi ' + fn + ',</p>' +
      '<p>Your <strong>' + b.service + '</strong> is confirmed. We\'ll come to you and treat your vehicle like it\'s our own.</p>' +
      '<div class="mail__details">' +
        '<div><span>When</span><strong>' + prettyDate(b.date) + ' at ' + b.time + '</strong></div>' +
        '<div><span>Vehicle</span><strong>' + b.vehicle + '</strong></div>' +
        '<div><span>Where</span><strong>' + b.address + '</strong></div>' +
        '<div><span>Service</span><strong>' + b.service + ' · ' + b.price + '</strong></div>' +
        '<div><span>Reference</span><strong>' + b.id + '</strong></div>' +
      '</div>' +
      '<p>Need to make a change? Just reply to this email or call ' + PHONE + '.</p>' +
      '<p class="mail__sign">See you soon,<br><strong>Rio.Details</strong></p>';

    // SMS mock
    root.querySelector('[data-sms-body]').textContent =
      'Rio.Details: Reminder — your ' + b.service + ' is tomorrow at ' + b.time +
      '. We\'ll meet your ' + b.vehicle + ' at ' + b.address + '. Reply C to confirm or call ' +
      PHONE + ' to reschedule. Ref ' + b.id;

    // reset preview + send state for repeat bookings
    var previews = root.querySelector('[data-previews]');
    previews.hidden = true;
    var toggle = root.querySelector('[data-toggle-preview]');
    toggle.setAttribute('aria-expanded', 'false');
    toggle.textContent = 'Preview Messages';
    var send = root.querySelector('[data-send]');
    send.disabled = false;
    send.textContent = 'Send Confirmation Now';
  }

  function setPill(sel, text, cls) {
    var pill = root.querySelector(sel);
    pill.textContent = text;
    pill.className = 'notify__pill' + (cls ? ' ' + cls : '');
  }

  // Toggle preview visibility
  root.querySelector('[data-toggle-preview]').addEventListener('click', function () {
    var previews = root.querySelector('[data-previews]');
    var open = previews.hidden;
    previews.hidden = !open;
    this.setAttribute('aria-expanded', String(open));
    this.textContent = open ? 'Hide Messages' : 'Preview Messages';
    if (open) previews.scrollIntoView({ behavior: 'smooth', block: 'nearest' });
  });

  // Simulated send
  root.querySelector('[data-send]').addEventListener('click', function () {
    var btn = this;
    btn.disabled = true;
    btn.textContent = 'Sending…';
    setPill('[data-notify-email-status]', 'Sending…', 'is-sending');
    setPill('[data-notify-sms-status]', 'Scheduling…', 'is-sending');

    setTimeout(function () {
      setPill('[data-notify-email-status]', 'Delivered', 'is-done');
    }, 900);
    setTimeout(function () {
      setPill('[data-notify-sms-status]', 'Reminder set', 'is-done');
      btn.textContent = 'Confirmation Sent';
      // reveal previews so they can see what landed
      var previews = root.querySelector('[data-previews]');
      previews.hidden = false;
      var toggle = root.querySelector('[data-toggle-preview]');
      toggle.setAttribute('aria-expanded', 'true');
      toggle.textContent = 'Hide Messages';
      previews.scrollIntoView({ behavior: 'smooth', block: 'nearest' });
    }, 1500);
  });

  /* Book another */
  root.querySelector('[data-book-again]').addEventListener('click', function () {
    form.reset();
    dateInput.value = tomorrowStr();
    state.time = ''; state.time24 = '';
    renderSlots();
    goto(1);
  });
})();
