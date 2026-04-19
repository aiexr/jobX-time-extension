const chartEl = document.getElementById('chart');
const summaryEl = document.getElementById('summary');
const statusEl = document.getElementById('status');

function todayKey() {
  const d = new Date();
  const y = d.getFullYear();
  const m = String(d.getMonth() + 1).padStart(2, '0');
  const day = String(d.getDate()).padStart(2, '0');
  return `${y}-${m}-${day}`;
}

function formatHours(h) {
  if (h <= 0) return '0h';
  const whole = Math.floor(h);
  const mins = Math.round((h - whole) * 60);
  if (mins === 0) return `${whole}h`;
  if (whole === 0) return `${mins}m`;
  return `${whole}h ${mins}m`;
}

function render(data) {
  const { window, byDay } = data;
  const days = window.days;
  if (!days.length) {
    setStatus('No entries found on this page.', true);
    return;
  }
  const maxHours = Math.max(8, ...days.map((d) => d.hours));
  const total = days.reduce((s, d) => s + d.hours, 0);
  const workedDays = days.filter((d) => d.hours > 0).length;
  const today = todayKey();

  summaryEl.textContent = `${formatHours(total)} total · ${workedDays} day${workedDays === 1 ? '' : 's'} worked · avg ${formatHours(total / Math.max(workedDays, 1))}/day`;

  chartEl.innerHTML = '';
  for (let i = 0; i < days.length; i++) {
    const d = days[i];
    const totalPct = Math.max(0, Math.min(100, (d.hours / maxHours) * 100));
    const el = document.createElement('div');
    el.className = 'day' + (d.key === today ? ' today' : '');
    el.title = `${d.date}: ${formatHours(d.hours)}`;

    let segmentsHtml = '';
    if (d.segments && d.segments.length > 0) {
      for (const seg of d.segments) {
        const segPct = d.hours > 0 ? (seg.hours / d.hours) * totalPct : 0;
        segmentsHtml += `<div class="bar-seg" style="height:${segPct}%;background:${seg.color}"></div>`;
      }
    } else if (d.hours > 0) {
      segmentsHtml = `<div class="bar-seg" style="height:${totalPct}%;background:var(--bar)"></div>`;
    }

    el.innerHTML = `
      <div class="hours ${d.hours === 0 ? 'zero' : ''}">${formatHours(d.hours)}</div>
      <div class="bar-wrap">
        ${segmentsHtml}
      </div>
      <div class="weekday">${d.weekday}</div>
      <div class="label">${d.label}</div>
    `;
    chartEl.appendChild(el);

    // Insert weekly subtotal after every 7 days
    if ((i + 1) % 7 === 0) {
      const weekDays = days.slice(i - 6, i + 1);
      const weekTotal = weekDays.reduce((s, wd) => s + wd.hours, 0);
      const weekWorked = weekDays.filter(wd => wd.hours > 0).length;
      const weekEl = document.createElement('div');
      weekEl.className = 'week-total';
      weekEl.innerHTML = `<span class="week-total-hours">${formatHours(weekTotal)}</span> this week` +
        (weekWorked > 0 ? ` · ${weekWorked} day${weekWorked === 1 ? '' : 's'}` : '');
      chartEl.appendChild(weekEl);
    }
  }
}

function setStatus(msg, isError) {
  statusEl.textContent = msg;
  statusEl.classList.toggle('error', !!isError);
}

function esc(str) {
  const el = document.createElement('span');
  el.textContent = str || '';
  return el.innerHTML;
}

const JOB_COLORS = [
  '#2563eb', '#e85d04', '#7c3aed', '#059669',
  '#db2777', '#ca8a04', '#0891b2', '#dc2626',
];

function mergeTimesheets(currentResp, timesheets, currentTsId) {
  const days = currentResp.window.days.map(d => ({ ...d, segments: [] }));
  const windowKeys = new Set(days.map(d => d.key));

  // Collect all contributing jobs in stable order: current first, then others
  const jobOrder = [];
  if (currentTsId) jobOrder.push(currentTsId);
  for (const tsId of Object.keys(timesheets)) {
    if (tsId !== currentTsId) jobOrder.push(tsId);
  }

  const jobMap = {};
  let colorIdx = 0;

  // Current timesheet
  if (currentTsId) {
    const color = JOB_COLORS[colorIdx++ % JOB_COLORS.length];
    const currentByDay = currentResp.byDay || {};
    let totalH = 0;
    for (const day of days) {
      const h = currentByDay[day.key] || 0;
      if (h > 0) day.segments.push({ tsId: currentTsId, hours: h, color });
      totalH += h;
    }
    jobMap[currentTsId] = {
      tsId: currentTsId,
      jobTitle: currentResp.jobTitle || 'Unknown Job',
      totalHours: totalH,
      isCurrent: true,
      color,
    };
  }

  // Other timesheets
  for (const tsId of jobOrder) {
    if (tsId === currentTsId) continue;
    const ts = timesheets[tsId];
    if (!ts || !ts.byDay) continue;

    const color = JOB_COLORS[colorIdx++ % JOB_COLORS.length];
    let jobTotal = 0;
    for (const day of days) {
      const h = ts.byDay[day.key] || 0;
      if (h > 0) {
        day.segments.push({ tsId, hours: h, color });
        day.hours = Math.round((day.hours + h) * 100) / 100;
        jobTotal += h;
      }
    }

    if (jobTotal > 0) {
      jobMap[tsId] = {
        tsId,
        jobTitle: ts.jobTitle || 'Unknown Job',
        totalHours: jobTotal,
        isCurrent: false,
        color,
      };
    }
  }

  return {
    mergedWindow: { days, startKey: currentResp.window.startKey },
    jobSummaries: jobOrder.filter(id => jobMap[id]).map(id => jobMap[id]),
  };
}

function renderLegend(jobSummaries) {
  const legendEl = document.getElementById('legend');
  if (!legendEl) return;
  if (jobSummaries.length <= 1) {
    legendEl.style.display = 'none';
    return;
  }
  legendEl.style.display = '';
  legendEl.innerHTML = jobSummaries.map(j =>
    `<span class="legend-item${j.isCurrent ? ' current' : ''}"><span class="legend-dot" style="background:${j.color}"></span>${esc(j.jobTitle)} <span class="legend-hours">${formatHours(j.totalHours)}</span></span>`
  ).join('');
}

async function renderManagement(timesheets, currentTsId) {
  const mgmtEl = document.getElementById('management');
  const listEl = document.getElementById('timesheet-list');
  if (!mgmtEl || !listEl) return;

  if (!timesheets) {
    const stored = await chrome.storage.local.get('timesheets');
    timesheets = stored.timesheets || {};
  }

  const entries = Object.values(timesheets);
  if (entries.length === 0) {
    mgmtEl.style.display = 'none';
    return;
  }

  mgmtEl.style.display = '';
  listEl.innerHTML = entries.map(ts => `
    <div class="ts-item${ts.tsId === currentTsId ? ' ts-current' : ''}" data-tsid="${esc(ts.tsId)}">
      <div class="ts-info">
        <span class="ts-title">${esc(ts.jobTitle || 'Unknown Job')}</span>
        <span class="ts-period">${esc(ts.payPeriod || '')}</span>
      </div>
      ${ts.tsId === currentTsId
        ? '<span class="ts-badge">current</span>'
        : `<button class="ts-remove" data-tsid="${esc(ts.tsId)}" title="Remove">\u2715</button>`}
    </div>
  `).join('');

  listEl.querySelectorAll('.ts-remove').forEach(btn => {
    btn.addEventListener('click', async (e) => {
      e.stopPropagation();
      const tsId = btn.dataset.tsid;
      const stored = await chrome.storage.local.get('timesheets');
      const all = stored.timesheets || {};
      delete all[tsId];
      await chrome.storage.local.set({ timesheets: all });
      main();
    });
  });
}

async function main() {
  const [tab] = await chrome.tabs.query({ active: true, currentWindow: true });
  if (!tab || !tab.url || !tab.url.toLowerCase().includes('tsx_stumanagetimesheet.aspx'.toLowerCase())) {
    setStatus('Open a timesheet page to see hours.', true);
    await renderManagement();
    return;
  }
  try {
    const resp = await chrome.tabs.sendMessage(tab.id, { type: 'GET_TIMESHEET_DATA' });
    if (!resp || !resp.ok) {
      setStatus(resp && resp.error ? `Error: ${resp.error}` : 'No response from page.', true);
      return;
    }

    // Read all stored timesheets and merge
    const stored = await chrome.storage.local.get('timesheets');
    const timesheets = stored.timesheets || {};
    const currentTsId = resp.tsId;
    const { mergedWindow, jobSummaries } = mergeTimesheets(resp, timesheets, currentTsId);

    render({ window: mergedWindow });
    renderLegend(jobSummaries);
    await renderManagement(timesheets, currentTsId);

    const entryCount = resp.entries.length;
    const jobCount = jobSummaries.length;
    setStatus(
      `Parsed ${entryCount} entr${entryCount === 1 ? 'y' : 'ies'}` +
      (jobCount > 1 ? ` \u00b7 ${jobCount} jobs combined` : '') + '.'
    );
  } catch (err) {
    setStatus(`Could not read page: ${err.message}. Try reloading the timesheet page.`, true);
  }
}

main();
