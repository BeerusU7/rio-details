/* ============================================================
   RIO.DETAILS — booking store
   Front-end persistence via localStorage. This is the single
   seam to replace with a real backend later: swap these methods
   for API calls and nothing else needs to change.
   ============================================================ */
window.RioStore = (function () {
  'use strict';
  var KEY = 'rio_bookings_v2';
  var SEED_FLAG = 'rio_seeded_v2';

  function read() {
    try {
      var raw = localStorage.getItem(KEY);
      return raw ? JSON.parse(raw) : [];
    } catch (e) {
      return [];
    }
  }
  function write(list) {
    try { localStorage.setItem(KEY, JSON.stringify(list)); } catch (e) {}
  }

  /* ----------------------------------------------------------
     Concept-demo seed. So the Owner Dashboard always presents
     full on any device, we pre-load a believable set of bookings
     the first time the site is opened. Dates are relative to today
     so the demo never looks stale. These mirror Rio's real audience
     — pride-of-ownership drivers: Teslas, trucks, family SUVs and
     daily drivers across Metro Detroit (NOT luxury/exotic).
     Once the owner deletes them, they won't come back. ---------- */
  function dstr(offsetDays) {
    var d = new Date();
    d.setDate(d.getDate() + offsetDays);
    return d.getFullYear() + '-' +
      String(d.getMonth() + 1).padStart(2, '0') + '-' +
      String(d.getDate()).padStart(2, '0');
  }
  function seedIfNeeded() {
    try {
      if (localStorage.getItem(SEED_FLAG) === '1') return;
      if (read().length > 0) { localStorage.setItem(SEED_FLAG, '1'); return; }
    } catch (e) { return; }

    var demo = [
      { name: 'Marcus Tan', vehicle: '2024 Tesla Model Y', address: '55 Lakeview Dr, Royal Oak',
        phone: '(248) 555-0173', email: 'marcus.tan@gmail.com',
        service: 'Full Premium Detail', price: 'From $299',
        date: dstr(0), time: '10:00 AM', time24: '10:00', status: 'upcoming' },
      { name: 'Derek Whitfield', vehicle: 'Ford F-150 Lariat', address: '318 Woodward Heights, Ferndale',
        phone: '(248) 555-0148', email: 'd.whitfield@gmail.com',
        service: 'Exterior & Paint', price: 'From $149',
        date: dstr(2), time: '8:00 AM', time24: '08:00', status: 'upcoming' },
      { name: 'Priya Anand', vehicle: 'Kia Telluride', address: '142 Catalpa Dr, Berkley',
        phone: '(586) 555-0192', email: 'priya.anand@gmail.com',
        service: 'Signature Interior', price: 'From $189',
        date: dstr(4), time: '12:00 PM', time24: '12:00', status: 'upcoming' },
      { name: 'Andre Brooks', vehicle: 'Honda Accord', address: '905 E 13 Mile Rd, Warren',
        phone: '(586) 555-0117', email: 'andre.brooks@gmail.com',
        service: 'Full Premium Detail', price: 'From $299',
        date: dstr(-5), time: '2:00 PM', time24: '14:00', status: 'completed' },
      { name: 'Sofia Reyes', vehicle: 'Toyota RAV4', address: '27 Hilton Rd, Hazel Park',
        phone: '(313) 555-0164', email: 'sofia.reyes@gmail.com',
        service: 'Signature Interior', price: 'From $189',
        date: dstr(-9), time: '4:00 PM', time24: '16:00', status: 'completed' },
      { name: 'Jordan Lee', vehicle: 'Subaru Outback', address: '88 Maple Rd, Royal Oak',
        phone: '(248) 555-0136', email: 'jordan.lee@gmail.com',
        service: 'Full Premium Detail', price: 'From $299',
        date: dstr(1), time: '6:00 PM', time24: '18:00', status: 'cancelled' }
    ];
    demo.forEach(function (b, i) {
      b.id = 'RD-' + ['7QX204', '3MP118', '9KZ472', 'RPX336', '5LT091', '70DD856'][i];
      b.createdAt = new Date(Date.now() - (10 - i) * 86400000).toISOString();
    });
    write(demo);
    try { localStorage.setItem(SEED_FLAG, '1'); } catch (e) {}
  }
  seedIfNeeded();

  function genRef() {
    return 'RD-' + Math.random().toString(36).slice(2, 6).toUpperCase() +
      String(Date.now()).slice(-3);
  }

  return {
    all: function () {
      // newest appointments first by date+time
      return read().sort(function (a, b) {
        return (a.date + a.time24).localeCompare(b.date + b.time24);
      });
    },
    add: function (booking) {
      var list = read();
      booking.id = genRef();
      booking.status = 'upcoming';
      booking.createdAt = new Date().toISOString();
      list.push(booking);
      write(list);
      return booking;
    },
    update: function (id, patch) {
      var list = read();
      for (var i = 0; i < list.length; i++) {
        if (list[i].id === id) { Object.assign(list[i], patch); break; }
      }
      write(list);
    },
    remove: function (id) {
      write(read().filter(function (b) { return b.id !== id; }));
    },
    isSlotTaken: function (date, time) {
      return read().some(function (b) {
        return b.date === date && b.time === time && b.status !== 'cancelled';
      });
    }
  };
})();
