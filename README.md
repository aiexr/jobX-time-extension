# JobX Timesheet Hours

A Chrome/Edge extension that reads your JobX timesheets and visualizes hours across a 2-week chart. It is built for quickly checking totals, comparing multiple jobs, and tracking a pay period without leaving the browser.

JobX is a student employment timesheet platform by NGWebSolutions, used by many universities.

- Sums logged hours per day from the timesheet table
- Renders a 14-day bar chart starting from the Sunday on or before your earliest entry
- Combines stored timesheets across multiple jobs into one view
- Shows per-job legend totals and weekly subtotals
- Highlights the current day
- Shows a summary with total hours, days worked, and average per worked day
- Stores timesheets locally so you can revisit and manage them from the popup
- Works on any school's JobX instance
- Runs locally in the browser

## Screenshot
![preview](preview.png)

## Installation
Chrome Web Store
https://chromewebstore.google.com/detail/jobx-timesheet-hours/bihddccjfhaddcbeokhjhmaceahjieml?pli=1

Or from releases:
1. [Download](https://github.com/aiexr/jobX-time-extension/releases) the `extension` folder from this repository
2. Extract to a folder
3. Open `chrome://extensions` (or `edge://extensions`)
4. Enable **Developer mode** (top right toggle)
5. Click **Load unpacked** and select the folder containing the extension files
6. Enable the extension

## Usage
1. Open your JobX timesheet (URL contains `tsx_stumanagetimesheet.aspx`)
2. Click the extension icon in the toolbar
3. The popup reads the current timesheet and stores it locally
4. If you have opened multiple JobX timesheets, the popup combines them into one 14-day view
5. Review totals, weekly subtotals, and the per-job legend
6. Use **Stored timesheets** in the popup to remove saved timesheets you no longer want included

## Compatible with
- Manifest V3
- Chrome, Edge, Brave, and other Chromium-based browsers
- Any JobX instance served from `*.studentemployment.ngwebsolutions.com`
