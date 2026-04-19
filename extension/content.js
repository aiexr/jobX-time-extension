(() => {
  const DATE_RE = /(Sunday|Monday|Tuesday|Wednesday|Thursday|Friday|Saturday),\s+(January|February|March|April|May|June|July|August|September|October|November|December)\s+(\d{1,2}),\s+(\d{4})/;
  const DURATION_RE = /(?:(\d+)\s*hrs?)?\s*(?:(\d+)\s*mins?)?/i;

  const MONTHS = {
    January: 0, February: 1, March: 2, April: 3, May: 4, June: 5,
    July: 6, August: 7, September: 8, October: 9, November: 10, December: 11,
  };

  function parseDate(text) {
    const m = text.match(DATE_RE);
    if (!m) return null;
    const [, , monthName, day, year] = m;
    return new Date(Number(year), MONTHS[monthName], Number(day));
  }

  function parseDuration(text) {
    // Look for patterns like "1 hr 33 mins", "45 mins", "2 hrs"
    const m = text.match(/(\d+)\s*hrs?(?:\s+(\d+)\s*mins?)?|(\d+)\s*mins?/i);
    if (!m) return 0;
    if (m[1]) {
      const hrs = Number(m[1]);
      const mins = m[2] ? Number(m[2]) : 0;
      return hrs + mins / 60;
    }
    if (m[3]) {
      return Number(m[3]) / 60;
    }
    return 0;
  }

  function isEntryRow(text) {
    // Real entries have an "Edit" and "Delete" action and a time range
    return /\bEdit\b/.test(text) && /\bDelete\b/.test(text) &&
           /(AM|PM)\s*\d{1,2}:\d{2}\s*(AM|PM)/i.test(text.replace(/\s+/g, ' '));
  }

  function extractEntries() {
    const entries = [];
    const rows = document.querySelectorAll('tr');
    rows.forEach((row) => {
      const text = row.innerText || row.textContent || '';
      if (!isEntryRow(text)) return;
      const date = parseDate(text);
      if (!date) return;
      // The duration appears just before "Edit Delete"
      const beforeActions = text.split(/Edit\s+Delete/i)[0];
      // Look at the tail of beforeActions — duration is last token before actions
      const tail = beforeActions.slice(-40);
      const hours = parseDuration(tail);
      if (hours <= 0) return;
      entries.push({
        dateKey: toKey(date),
        hours,
      });
    });
    return entries;
  }

  function toKey(date) {
    const y = date.getFullYear();
    const m = String(date.getMonth() + 1).padStart(2, '0');
    const d = String(date.getDate()).padStart(2, '0');
    return `${y}-${m}-${d}`;
  }

  function aggregate(entries) {
    const byDay = {};
    for (const e of entries) {
      byDay[e.dateKey] = (byDay[e.dateKey] || 0) + e.hours;
    }
    return byDay;
  }

  function buildTwoWeekWindow(byDay) {
    const keys = Object.keys(byDay).sort();
    if (keys.length === 0) return { days: [], startKey: null };
    const [y, m, d] = keys[0].split('-').map(Number);
    const first = new Date(y, m - 1, d);
    // Roll back to the most recent Sunday (getDay: Sun=0)
    const start = new Date(first);
    start.setDate(start.getDate() - start.getDay());
    const days = [];
    for (let i = 0; i < 14; i++) {
      const cur = new Date(start);
      cur.setDate(start.getDate() + i);
      const key = toKey(cur);
      days.push({
        key,
        date: cur.toISOString().slice(0, 10),
        weekday: cur.toLocaleDateString(undefined, { weekday: 'short' }),
        label: cur.toLocaleDateString(undefined, { month: 'short', day: 'numeric' }),
        hours: Math.round((byDay[key] || 0) * 100) / 100,
      });
    }
    return { days, startKey: toKey(start) };
  }

  function getTsId() {
    const params = new URLSearchParams(window.location.search);
    for (const [key, value] of params) {
      if (key.toLowerCase() === 'tsid') return value;
    }
    return null;
  }

  function getJobTitle() {
    const labels = document.querySelectorAll('label');
    for (const label of labels) {
      if (label.textContent.trim() === 'Hire Title') {
        const parent = label.parentElement;
        if (parent) {
          const span = parent.querySelector('span');
          if (span) return span.textContent.trim();
        }
      }
    }
    return 'Unknown Job';
  }

  function getPayPeriod() {
    const h3 = document.querySelector('#pp-tab h3');
    return h3 ? h3.textContent.trim() : '';
  }

  async function saveTimesheet(tsId, jobTitle, payPeriod, entries, byDay) {
    if (!tsId) return;
    const result = await chrome.storage.local.get('timesheets');
    const timesheets = result.timesheets || {};
    timesheets[tsId] = {
      tsId,
      jobTitle,
      payPeriod,
      lastUpdated: new Date().toISOString(),
      entries,
      byDay,
    };
    await chrome.storage.local.set({ timesheets });
  }

  chrome.runtime.onMessage.addListener((msg, _sender, sendResponse) => {
    if (msg && msg.type === 'GET_TIMESHEET_DATA') {
      try {
        const entries = extractEntries();
        const byDay = aggregate(entries);
        const win = buildTwoWeekWindow(byDay);
        const tsId = getTsId();
        const jobTitle = getJobTitle();
        const payPeriod = getPayPeriod();
        const response = { ok: true, entries, byDay, window: win, tsId, jobTitle, payPeriod };
        saveTimesheet(tsId, jobTitle, payPeriod, entries, byDay)
          .finally(() => sendResponse(response));
      } catch (err) {
        sendResponse({ ok: false, error: String(err && err.message || err) });
      }
      return true;
    }
  });
})();
