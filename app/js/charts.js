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
export function line(points, { title = '', width = 500, height = 185, unit = '' } = {}) {
  if (!points || points.length === 0) return EMPTY(title, width, height);

  const pad = { top: 20, right: 54, bottom: 26, left: 38 };
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
    const val = round(base + span * (1 - f));
    return `<line class="grid" x1="${pad.left}" y1="${round(y)}" x2="${pad.left + plotW}" y2="${round(y)}"/>`
      + `<text class="ax" x="${pad.left - 6}" y="${round(y + 3)}" text-anchor="end">${val}</text>`;
  }).join('');

  const bottomY = round(pad.top + plotH);
  const area = points.length > 1
    ? `<polygon class="series-area" points="${round(coords[0][0])},${bottomY} ${coords.map(([x, y]) => `${round(x)},${round(y)}`).join(' ')} ${round(coords.at(-1)[0])},${bottomY}"/>`
    : '';

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
    const clamped = Math.min(Math.max(y + dy, 12), height - pad.bottom - 7);
    return `<text class="pt-label" x="${round(x)}" y="${round(clamped)}" text-anchor="${anchor}">${
      esc(p.label ?? `${p.y}${unit ? ` ${unit}` : ''}`)}</text>`;
  };
  const last = points.length - 1;
  const labels = points.length === 1
    ? labelFor(0, 'middle')
    : labelFor(0, 'start', 1) + labelFor(last, 'end', last - 1);

  const midIdx = points.length >= 4 ? Math.floor(points.length / 2) : -1;
  const midAxis = midIdx > 0
    ? `<text class="ax" x="${round(xAt(midIdx))}" y="${height - 6}" text-anchor="middle">${esc(points[midIdx].x)}</text>`
    : '';

  const axis = `<text class="ax" x="${pad.left}" y="${height - 6}">${esc(points[0].x)}</text>
    ${midAxis}
    ${points.length > 1 ? `<text class="ax" x="${pad.left + plotW}" y="${height - 6}" text-anchor="end">${esc(points.at(-1).x)}</text>` : ''}`;

  return `<figure class="chart-fig">
    <figcaption>${esc(title)}</figcaption>
    <svg class="chart" viewBox="0 0 ${width} ${height}" role="img"
         aria-label="${esc(title)}: ${points.length} points from ${esc(points[0].y)} to ${esc(points.at(-1).y)}">
      ${grid}${area}${path}${marks}${labels}${axis}
    </svg>
  </figure>`;
}

/* Horizontal bars against a per-row target. The target is a tick rather than a
   second bar, because two bars per row would read as two series. Status is in
   the text as well as the colour. */
export function bars(rows, { title = '', width = 500, rowHeight = 32 } = {}) {
  if (!rows || rows.length === 0) return EMPTY(title, width, 90);

  const pad = { top: 8, left: 84, right: 72 };
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
      <text class="bar-value" x="${pad.left + plotW + 8}" y="${round(y + barH / 2 + 3)}">${round(value)}</text>
      <text class="bar-status${short ? ' short' : ''}" x="${pad.left + plotW + 8}" y="${round(y + barH / 2 + 13)}">${esc(status)}</text>
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

/* Body weight over real calendar time, one dot per logged day. Unlike `line`, the
   x axis is proportional to the date, so a gap in logging looks like a gap.
   Every dot carries its own tooltip text; `hoverChart` (below) shows it in a box
   when the pointer or a finger is near that dot. points: [{ date, y }] in the
   unit being shown. */
const MS_DAY = 86_400_000;
const dayNumber = (ymd) => Math.round(Date.parse(`${ymd}T00:00:00Z`) / MS_DAY);
const dayText = (n) => new Date(n * MS_DAY).toISOString().slice(0, 10);
const shortDate = (ymd) => {
  const [y, m, d] = String(ymd).split('-').map(Number);
  return new Date(y, m - 1, d).toLocaleDateString(undefined, { month: 'short', day: 'numeric', year: 'numeric' });
};

export function weightChart(points, { title = '', unit = 'kg', width = 500, height = 210, trend = false, average = false } = {}) {
  if (!points || points.length === 0) return EMPTY(title, width, height);

  const pad = { top: 16, right: 14, bottom: 28, left: 40 };
  const plotW = width - pad.left - pad.right;
  const plotH = height - pad.top - pad.bottom;
  const round = (n) => Math.round(n * 10) / 10;

  const ys = points.map((p) => Number(p.y));
  const days = points.map((p) => dayNumber(p.date));
  const rawLo = Math.min(...ys);
  const rawHi = Math.max(...ys);
  const margin = (rawHi - rawLo || 1) * 0.15;
  const lo = rawLo - margin;
  const hi = rawHi + margin;
  const firstDay = days[0];
  const dayRange = days.at(-1) - firstDay;

  const xAt = (d) => (dayRange === 0 ? pad.left + plotW / 2 : pad.left + ((d - firstDay) / dayRange) * plotW);
  const yAt = (v) => pad.top + plotH - ((v - lo) / (hi - lo)) * plotH;
  const coords = points.map((p, i) => [xAt(days[i]), yAt(Number(p.y))]);

  const grid = [0, 0.5, 1].map((f) => {
    const y = pad.top + plotH * f;
    return `<line class="grid" x1="${pad.left}" y1="${round(y)}" x2="${pad.left + plotW}" y2="${round(y)}"/>`
      + `<text class="ax" x="${pad.left - 6}" y="${round(y + 3)}" text-anchor="end">${round(lo + (hi - lo) * (1 - f)).toFixed(1)}</text>`;
  }).join('');

  const bottomY = round(pad.top + plotH);
  const pts = coords.map(([x, y]) => `${round(x)},${round(y)}`).join(' ');
  const area = points.length > 1
    ? `<polygon class="series-area" points="${round(coords[0][0])},${bottomY} ${pts} ${round(coords.at(-1)[0])},${bottomY}"/>`
    : '';
  const path = points.length > 1
    ? `<polyline class="series" fill="none" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" points="${pts}"/>`
    : '';

  /* Least-squares line through the shown readings, by calendar day. */
  let trendLine = '';
  if (trend && points.length >= 2 && dayRange > 0) {
    const n = points.length;
    const mx = days.reduce((a, b) => a + b, 0) / n;
    const my = ys.reduce((a, b) => a + b, 0) / n;
    const sxx = days.reduce((a, d) => a + (d - mx) ** 2, 0);
    const slope = days.reduce((a, d, i) => a + (d - mx) * (ys[i] - my), 0) / sxx;
    const at = (d) => my + slope * (d - mx);
    const clampY = (v) => Math.min(Math.max(yAt(v), pad.top), pad.top + plotH);
    trendLine = `<line class="trendline" x1="${round(xAt(days[0]))}" y1="${round(clampY(at(days[0])))}" x2="${round(xAt(days.at(-1)))}" y2="${round(clampY(at(days.at(-1))))}"/>`;
  }

  /* Mean of the shown readings, labelled at its right end. */
  let avgLine = '';
  if (average) {
    const mean = ys.reduce((a, b) => a + b, 0) / ys.length;
    const y = round(yAt(mean));
    avgLine = `<line class="avgline" x1="${pad.left}" y1="${y}" x2="${pad.left + plotW}" y2="${y}"/>`
      + `<text class="avg-label" x="${pad.left + plotW}" y="${round(Math.max(y - 5, pad.top + 8))}" text-anchor="end">avg ${mean.toFixed(1)} ${esc(unit)}</text>`;
  }

  const tipFor = (p) => `${shortDate(p.date)} · ${Number(p.y).toFixed(1)} ${unit}`;
  const marks = points.map((p, i) => `<circle class="dot" data-i="${i}" cx="${round(coords[i][0])}" cy="${round(coords[i][1])}" r="4"><title>${esc(tipFor(p))}</title></circle>`).join('');

  const axisDates = [0, 0.5, 1].map((f, k) => {
    const d = Math.round(firstDay + dayRange * f);
    if (dayRange === 0 && k > 0) return '';
    const anchor = k === 0 ? 'start' : k === 2 ? 'end' : 'middle';
    const x = k === 0 ? pad.left : k === 2 ? pad.left + plotW : xAt(d);
    return `<text class="ax" x="${round(x)}" y="${height - 8}" text-anchor="${anchor}">${esc(dayText(d))}</text>`;
  }).join('');

  const data = esc(JSON.stringify(points.map((p, i) => ({ x: round(coords[i][0]), y: round(coords[i][1]), t: tipFor(p) }))));
  return `<figure class="chart-fig chart-hover" data-chart-points="${data}" data-chart-width="${width}">
    <figcaption>${esc(title)}</figcaption>
    <svg class="chart" viewBox="0 0 ${width} ${height}" role="img"
         aria-label="${esc(title)}: ${points.length} readings from ${esc(Number(points[0].y).toFixed(1))} to ${esc(Number(points.at(-1).y).toFixed(1))} ${esc(unit)}">
      ${grid}${area}${path}${avgLine}${trendLine}<line class="guide" x1="0" y1="${pad.top}" x2="0" y2="${bottomY}" hidden/>${marks}${axisDates}
    </svg>
    <div class="chart-tip" role="status" hidden></div>
  </figure>`;
}

/* Pure: which point is closest to an x position, in the chart's own units. */
export function nearestPoint(xs, x) {
  let best = -1;
  let bestGap = Infinity;
  xs.forEach((px, i) => {
    const gap = Math.abs(px - x);
    if (gap < bestGap) { best = i; bestGap = gap; }
  });
  return best;
}

/* Shows the tooltip box for the dot nearest the pointer, and hides it when the
   pointer leaves. Called with a figure.chart-hover and a clientX; null hides. */
export function hoverChart(fig, clientX) {
  const svg = fig.querySelector('svg');
  const tip = fig.querySelector('.chart-tip');
  const guide = fig.querySelector('.guide');
  const dots = fig.querySelectorAll('.dot');
  const clear = () => {
    tip.hidden = true;
    guide.setAttribute('hidden', '');
    dots.forEach((d) => d.classList.remove('on'));
  };
  if (clientX === null) { clear(); return; }

  const pts = JSON.parse(fig.dataset.chartPoints);
  const box = svg.getBoundingClientRect();
  const scale = Number(fig.dataset.chartWidth) / box.width;
  const i = nearestPoint(pts.map((p) => p.x), (clientX - box.left) * scale);
  if (i < 0) { clear(); return; }

  dots.forEach((d, k) => d.classList.toggle('on', k === i));
  guide.setAttribute('x1', pts[i].x);
  guide.setAttribute('x2', pts[i].x);
  guide.removeAttribute('hidden');
  tip.textContent = pts[i].t;
  tip.hidden = false;
  const figBox = fig.getBoundingClientRect();
  const want = box.left - figBox.left + pts[i].x / scale - tip.offsetWidth / 2;
  tip.style.left = `${Math.max(0, Math.min(want, figBox.width - tip.offsetWidth))}px`;
  tip.style.top = `${box.top - figBox.top + pts[i].y / scale - tip.offsetHeight - 12}px`;
}
