/* Inline SVG charts. No charting library, no build step.

   Both charts are single-series, so there is no legend: the title names the
   series. Colours come from CSS custom properties, which is what lets dark mode
   be a chosen palette rather than an inverted one — the values in app.css were
   validated against both surfaces for lightness, chroma, colour-vision
   separation and contrast.

   Nothing is hover-only. Hover gives a native tooltip on every mark, but the
   numbers a reader needs are also drawn: the first and last point on a line, and
   every bar's value and status. On a phone there is no hover at all. */

const esc = (s) => String(s ?? '').replace(/[&<>"']/g, (c) => ({
  '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;',
}[c]));

const EMPTY = (title, w, hgt) => `<figure class="chart-fig">
  <figcaption>${esc(title)}</figcaption>
  <svg class="chart" viewBox="0 0 ${w} ${hgt}" role="img" aria-label="${esc(title)}: nothing logged yet">
    <text x="${w / 2}" y="${hgt / 2}" class="ax" text-anchor="middle">Nothing logged yet</text>
  </svg>
</figure>`;

/* A line chart of one measure over time. x values are only used for ordering and
   tooltips; points are evenly spaced, because a weigh-in every nine days and one
   every six should not squash the chart. */
export function line(points, { title = '', width = 320, height = 150, unit = '' } = {}) {
  if (!points || points.length === 0) return EMPTY(title, width, height);

  const pad = { top: 14, right: 46, bottom: 22, left: 10 };
  const plotW = width - pad.left - pad.right;
  const plotH = height - pad.top - pad.bottom;

  const ys = points.map((p) => Number(p.y));
  const lo = Math.min(...ys);
  const hi = Math.max(...ys);
  // A flat series would divide by zero, so give it a band and sit it in the middle.
  const span = hi - lo || Math.max(1, Math.abs(hi) * 0.1);
  const base = hi === lo ? lo - span / 2 : lo;

  const xAt = (i) => (points.length === 1
    ? pad.left + plotW / 2
    : pad.left + (i * plotW) / (points.length - 1));
  const yAt = (v) => pad.top + plotH - ((v - base) / span) * plotH;

  const coords = points.map((p, i) => [xAt(i), yAt(Number(p.y))]);
  const round = (n) => Math.round(n * 10) / 10;

  const grid = [0, 0.5, 1].map((f) => {
    const y = pad.top + plotH * f;
    return `<line class="grid" x1="${pad.left}" y1="${round(y)}" x2="${pad.left + plotW}" y2="${round(y)}"/>`;
  }).join('');

  const path = points.length > 1
    ? `<polyline class="series" fill="none" stroke-width="2" stroke-linecap="round"
        stroke-linejoin="round" points="${coords.map(([x, y]) => `${round(x)},${round(y)}`).join(' ')}"/>`
    : '';

  const marks = points.map((p, i) => {
    const [x, y] = coords[i];
    return `<circle class="dot" cx="${round(x)}" cy="${round(y)}" r="4.5">
      <title>${esc(p.x)}: ${esc(p.label ?? `${p.y}${unit ? ` ${unit}` : ''}`)}</title>
    </circle>`;
  }).join('');

  /* End labels sit on the side the line is not heading, so a rising series does
     not run its first label through the path. */
  const labelFor = (i, anchor, neighbour) => {
    const p = points[i];
    const [x, y] = coords[i];
    const rising = neighbour !== undefined && Number(points[neighbour].y) > Number(p.y);
    const dy = rising ? 16 : -9;
    const clamped = Math.min(Math.max(y + dy, 11), height - pad.bottom - 7);
    return `<text class="pt-label" x="${round(x)}" y="${round(clamped)}" text-anchor="${anchor}">${
      esc(p.label ?? `${p.y}${unit ? ` ${unit}` : ''}`)}</text>`;
  };
  const last = points.length - 1;
  const labels = points.length === 1
    ? labelFor(0, 'middle')
    : labelFor(0, 'start', 1) + labelFor(last, 'end', last - 1);

  const axis = `<text class="ax" x="${pad.left}" y="${height - 6}">${esc(points[0].x)}</text>
    ${points.length > 1 ? `<text class="ax" x="${pad.left + plotW}" y="${height - 6}" text-anchor="end">${esc(points.at(-1).x)}</text>` : ''}`;

  return `<figure class="chart-fig">
    <figcaption>${esc(title)}</figcaption>
    <svg class="chart" viewBox="0 0 ${width} ${height}" role="img"
         aria-label="${esc(title)}: ${points.length} points from ${esc(points[0].y)} to ${esc(points.at(-1).y)}">
      ${grid}${path}${marks}${labels}${axis}
    </svg>
  </figure>`;
}

/* Horizontal bars against a per-row target. The target is a tick rather than a
   second bar, because two bars per row would read as two series. Status is in
   the text as well as the colour. */
export function bars(rows, { title = '', width = 320, rowHeight = 30 } = {}) {
  if (!rows || rows.length === 0) return EMPTY(title, width, 90);

  const pad = { top: 8, left: 74, right: 58 };
  const plotW = width - pad.left - pad.right;
  const height = pad.top + rows.length * rowHeight + 6;
  const scale = Math.max(...rows.map((r) => Math.max(Number(r.value) || 0, Number(r.target) || 0)), 1);
  const round = (n) => Math.round(n * 10) / 10;

  const body = rows.map((r, i) => {
    const value = Number(r.value) || 0;
    const target = Number(r.target) || 0;
    const short = value < target;
    // 2px gap below each bar so adjacent fills never touch.
    const y = pad.top + i * rowHeight;
    const barH = rowHeight - 12;
    const w = Math.max(value > 0 ? 4 : 0, (value / scale) * plotW);
    const tickX = pad.left + (target / scale) * plotW;
    const status = short ? `short ${round(target - value)}` : 'met';

    return `<g class="bar-row">
      <title>${esc(r.label)}: ${round(value)} of ${round(target)} — ${status}</title>
      <text class="ax" x="0" y="${round(y + barH / 2 + 4)}">${esc(r.label)}</text>
      <rect class="bar-track" x="${pad.left}" y="${round(y)}" width="${plotW}" height="${barH}" rx="4"/>
      <rect class="bar-fill${short ? ' short' : ''}" x="${pad.left}" y="${round(y)}"
            width="${round(Math.min(w, plotW))}" height="${barH}" rx="4"/>
      <line class="target-tick" x1="${round(tickX)}" y1="${round(y - 2)}"
            x2="${round(tickX)}" y2="${round(y + barH + 2)}"/>
      <text class="bar-value" x="${pad.left + plotW + 6}" y="${round(y + barH / 2 + 4)}">${round(value)}</text>
      <text class="bar-status${short ? ' short' : ''}" x="${pad.left + plotW + 6}" y="${round(y + barH / 2 + 14)}">${esc(status)}</text>
    </g>`;
  }).join('');

  return `<figure class="chart-fig">
    <figcaption>${esc(title)}</figcaption>
    <svg class="chart" viewBox="0 0 ${width} ${height}" role="img"
         aria-label="${esc(title)}: ${rows.length} muscles against their weekly minimum">
      ${body}
    </svg>
  </figure>`;
}
