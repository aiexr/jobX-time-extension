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

function formatCurrency(v) {
  if (!Number.isFinite(v)) return '';
  return `$${v.toFixed(2)}`;
}

function normalizeJobTitle(title) {
  return String(title || '').trim().toLowerCase().replace(/\s+/g, ' ');
}

function render(data) {
  const { window, estEarnings, hasEstimatedEarnings } = data;
  const days = window.days;
  if (!days.length) {
    setStatus('No entries found on this page.', true);
    return;
  }
  const maxHours = Math.max(8, ...days.map((d) => d.hours));
  const total = days.reduce((s, d) => s + d.hours, 0);
  const workedDays = days.filter((d) => d.hours > 0).length;
  const today = todayKey();

  summaryEl.textContent = `${formatHours(total)} total · ${workedDays} day${workedDays === 1 ? '' : 's'} worked · avg ${formatHours(total / Math.max(workedDays, 1))}/day` +
    (hasEstimatedEarnings ? ` · est ${formatCurrency(estEarnings)}` : '');

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
      const weekEarnings = weekDays.reduce((sum, wd) => {
        if (!wd.segments || wd.segments.length === 0) return sum;
        return sum + wd.segments.reduce((inner, seg) => {
          if (!Number.isFinite(seg.hourlyWage)) return inner;
          return inner + (seg.hours * seg.hourlyWage);
        }, 0);
      }, 0);
      const weekEl = document.createElement('div');
      weekEl.className = 'week-total';
      weekEl.innerHTML = `<span class="week-total-hours">${formatHours(weekTotal)}</span> this week` +
        (weekWorked > 0 ? ` · ${weekWorked} day${weekWorked === 1 ? '' : 's'}` : '') +
        (hasEstimatedEarnings ? ` · est ${formatCurrency(weekEarnings)}` : '');
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

function mergeTimesheets(currentResp, timesheets, wagesByJob, currentTsId) {
  const days = currentResp.window.days.map(d => ({ ...d, segments: [] }));
  const currentWage = wagesByJob[normalizeJobTitle(currentResp.jobTitle || '')]?.hourlyWage;

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
      if (h > 0) day.segments.push({ tsId: currentTsId, hours: h, color, hourlyWage: currentWage });
      totalH += h;
    }
    jobMap[currentTsId] = {
      tsId: currentTsId,
      jobTitle: currentResp.jobTitle || 'Unknown Job',
      totalHours: totalH,
      isCurrent: true,
      color,
      hourlyWage: currentWage,
    };
  }

  // Other timesheets
  for (const tsId of jobOrder) {
    if (tsId === currentTsId) continue;
    const ts = timesheets[tsId];
    if (!ts || !ts.byDay) continue;

    const color = JOB_COLORS[colorIdx++ % JOB_COLORS.length];
    const hourlyWage = wagesByJob[normalizeJobTitle(ts.jobTitle || '')]?.hourlyWage;
    let jobTotal = 0;
    for (const day of days) {
      const h = ts.byDay[day.key] || 0;
      if (h > 0) {
        day.segments.push({ tsId, hours: h, color, hourlyWage });
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
        hourlyWage,
      };
    }
  }

  const jobSummaries = jobOrder.filter(id => jobMap[id]).map(id => jobMap[id]);
  const estEarnings = jobSummaries.reduce((sum, j) => {
    if (!Number.isFinite(j.hourlyWage)) return sum;
    return sum + (j.totalHours * j.hourlyWage);
  }, 0);
  const hasEstimatedEarnings = jobSummaries.some((j) => Number.isFinite(j.hourlyWage));

  return {
    mergedWindow: { days, startKey: currentResp.window.startKey },
    jobSummaries,
    estEarnings,
    hasEstimatedEarnings,
  };
}

function renderLegend(jobSummaries) {
  const legendEl = document.getElementById('legend');
  if (!legendEl) return;
  if (jobSummaries.length === 0) {
    legendEl.style.display = 'none';
    return;
  }
  legendEl.style.display = 'block';
  legendEl.innerHTML = jobSummaries.map(j =>
    `<span class="legend-item${j.isCurrent ? ' current' : ''}"><span class="legend-dot" style="background:${j.color}"></span>${esc(j.jobTitle)} <span class="legend-hours">${formatHours(j.totalHours)}</span>${Number.isFinite(j.hourlyWage) ? ` <span class="legend-hours">@ ${formatCurrency(j.hourlyWage)}/h</span>` : ''}</span>`
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
  const url = tab && tab.url ? tab.url.toLowerCase() : '';

  if (!tab || !tab.url) {
    setStatus('Open a timesheet or dashboard page.', true);
    await renderManagement();
    return;
  }

  if (url.includes('jobx_userdashboard.aspx')) {
    try {
      const resp = await chrome.tabs.sendMessage(tab.id, { type: 'GET_WAGE_DATA' });
      if (!resp || !resp.ok) {
        setStatus(resp && resp.error ? `Error: ${resp.error}` : 'No response from page.', true);
        return;
      }
      summaryEl.textContent = '';
      chartEl.innerHTML = '';
      const jobTitleEl = document.getElementById('job-title');
      if (jobTitleEl) {
        jobTitleEl.textContent = 'Wage Sync';
        jobTitleEl.style.display = 'block';
      }
      setStatus(`Synced wages for ${resp.count} job${resp.count === 1 ? '' : 's'}. Open a timesheet to see earnings.`, false);
      await renderManagement();
      return;
    } catch (err) {
      setStatus(`Could not read dashboard: ${err.message}. Try reloading the page.`, true);
      return;
    }
  }

  if (!url.includes('tsx_stumanagetimesheet.aspx')) {
    setStatus('Open a timesheet or dashboard page.', true);
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
    const wagesResult = await chrome.storage.local.get('wagesByJob');
    const wagesByJob = wagesResult.wagesByJob || {};
    const currentTsId = resp.tsId;
    const { mergedWindow, jobSummaries, estEarnings, hasEstimatedEarnings } = mergeTimesheets(resp, timesheets, wagesByJob, currentTsId);

    render({ window: mergedWindow, estEarnings, hasEstimatedEarnings });
    renderLegend(jobSummaries);

    const jobTitleEl = document.getElementById('job-title');
    if (jobTitleEl && resp.jobTitle && resp.jobTitle !== 'Unknown Job') {
      jobTitleEl.textContent = resp.jobTitle;
      jobTitleEl.style.display = 'block';
    }

    await renderManagement(timesheets, currentTsId);

    const entryCount = resp.entries.length;
    const jobCount = jobSummaries.length;
    setStatus(
      `Parsed ${entryCount} entr${entryCount === 1 ? 'y' : 'ies'}` +
      (jobCount > 1 ? ` \u00b7 ${jobCount} jobs combined` : '') +
      (hasEstimatedEarnings ? '' : ' · sync wages from dashboard to see earnings.') +
      '.'
    );
  } catch (err) {
    setStatus(`Could not read page: ${err.message}. Try reloading the timesheet page.`, true);
  }
}

main();
