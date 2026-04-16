# JobX Timesheet Hours

A Chrome/Edge extension that reads your JobX timesheet and visualizes total hours per day in a 2-week bar graph. Useful for tracking how many hours you're logging across a pay period at a glance.

JobX is the student employment timesheet platform by NGWebSolutions, used by many universities under subdomains like `<school>.studentemployment.ngwebsolutions.com`.

## Features

- Sums logged hours per day from the timesheet table
- Renders a 14-day bar chart starting from the Sunday on-or-before your earliest entry
- Highlights the current day
- Shows a summary: total hours, days worked, average per worked day
- Works on any school's JobX instance

## Installation

### Option A — Load unpacked 

1. Clone or download this repo:
   ```bash
   git clone <this-repo-url>
   ```
2. Open `chrome://extensions` (or `edge://extensions`)
3. Enable **Developer mode** (top right toggle)
4. Click **Load unpacked** and select the repo folder
5. Navigate to your JobX timesheet page and click the extension icon

### Option B — From a release zip (recommended)

1. Download `jobx-timesheet-hours.zip` from the [Releases](../../releases) page
2. Unzip it to a folder you'll keep around (the extension loads from that folder on disk)
3. Follow steps 2–5 above, selecting the unzipped folder

## Usage

1. Open your JobX timesheet (URL contains `tsx_stumanagetimesheet.aspx`)
2. Click the extension icon in the toolbar
3. The popup shows a bar for each of the 14 days, with hours logged and a running total

If the popup says "No entries found", reload the timesheet page and try again.

## Building a release zip

```bash
./build.sh
```

Produces `dist/jobx-timesheet-hours.zip` containing only the files the extension needs. Attach that zip to a GitHub release.

## How it works

- `content.js` runs on timesheet pages, walks the table's `<tr>` rows, extracts the date and duration text (e.g., `1 hr 33 mins`, `45 mins`), and groups totals by day.
- `popup.js` requests the parsed data from the content script and renders the bar chart.
- No data leaves the page — everything runs locally in the browser.

## Compatibility

- Manifest V3
- Chrome, Edge, Brave, and other Chromium-based browsers
- Any JobX instance served from `*.studentemployment.ngwebsolutions.com`

## License
MIT
