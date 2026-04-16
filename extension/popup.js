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
  for (const d of days) {
    const pct = Math.max(0, Math.min(100, (d.hours / maxHours) * 100));
    const el = document.createElement('div');
    el.className = 'day' + (d.key === today ? ' today' : '');
    el.title = `${d.date}: ${formatHours(d.hours)}`;
    el.innerHTML = `
      <div class="hours ${d.hours === 0 ? 'zero' : ''}">${formatHours(d.hours)}</div>
      <div class="bar-wrap">
        <div class="bar ${d.hours === 0 ? 'zero' : ''}" style="height:${pct}%"></div>
      </div>
      <div class="weekday">${d.weekday}</div>
      <div class="label">${d.label}</div>
    `;
    chartEl.appendChild(el);
  }
}

function setStatus(msg, isError) {
  statusEl.textContent = msg;
  statusEl.classList.toggle('error', !!isError);
}

async function main() {
  const [tab] = await chrome.tabs.query({ active: true, currentWindow: true });
  if (!tab || !tab.url || !tab.url.includes('tsx_stumanagetimesheet.aspx')) {
    setStatus('Open a timesheet page to see hours.', true);
    return;
  }
  try {
    const resp = await chrome.tabs.sendMessage(tab.id, { type: 'GET_TIMESHEET_DATA' });
    if (!resp || !resp.ok) {
      setStatus(resp && resp.error ? `Error: ${resp.error}` : 'No response from page.', true);
      return;
    }
    render(resp);
    const entryCount = resp.entries.length;
    setStatus(`Parsed ${entryCount} entr${entryCount === 1 ? 'y' : 'ies'}.`);
  } catch (err) {
    setStatus(`Could not read page: ${err.message}. Try reloading the timesheet page.`, true);
  }
}

main();
