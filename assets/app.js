const DATA_URL = "data/data.json";

const $ = (sel) => document.querySelector(sel);

const fmtInt = (n) =>
  n == null
    ? "—"
    : Math.round(n).toLocaleString(undefined, { maximumFractionDigits: 0 });

const fmtPct = (n, digits = 1) =>
  n == null ? "—" : `${(n * 100).toFixed(digits)}%`;

const fmtMillions = (n) =>
  n == null ? "—" : `${(n / 1_000_000).toFixed(1)}M`;

function cleanRouteName(raw) {
  if (!raw) return "";
  const s = String(raw).trim();
  // "601.0" → "Line 601"; keep named lines ("G Line", "J Line") as-is.
  const m = s.match(/^(\d+)(?:\.0+)?$/);
  return m ? `Line ${m[1]}` : s;
}

function rateClass(r) {
  if (r == null) return "";
  if (r >= 0.5) return "high";
  if (r >= 0.25) return "med";
  return "low";
}

async function main() {
  try {
    const res = await fetch(DATA_URL, { cache: "no-store" });
    if (!res.ok) throw new Error(`HTTP ${res.status}`);
    const data = await res.json();
    render(data);
  } catch (err) {
    console.error(err);
    document.getElementById("app").innerHTML = `
      <div class="error">Couldn't load data: ${String(err.message)}</div>`;
  }
}

function render(data) {
  const totals = (data.totals || []).filter(
    (t) => t.evasion_rate != null && t.mode,
  );
  const bus = (data.bus || []).filter(
    (r) =>
      r.route &&
      r.route.toLowerCase() !== "total" &&
      r.evasion_rate != null,
  );
  const rail = (data.rail || []).filter(
    (r) => r.merged_station && r.evasion_rate != null,
  );

  const byMode = Object.fromEntries(totals.map((t) => [t.mode, t]));
  const sys = byMode["Total"];
  const busTot = byMode["Bus"];
  const railTot = byMode["Rail"] || byMode["Adjusted Rail"];

  renderHero(sys);
  renderKpis({ sys, busTot, railTot });
  renderUpdated();
  renderModeChart({ busTot, railTot: byMode["Adjusted Rail"] || railTot });
  renderTopBus(bus);
  renderTopRail(rail);
  renderBusTable(bus);
  renderRailTable(rail);
  bindTabs();
  $("#about-blurb").textContent = data.intro?.blurb || "";
}

function renderUpdated() {
  $("#updated").textContent =
    "Updated " +
    new Date().toLocaleDateString(undefined, {
      year: "numeric",
      month: "short",
      day: "numeric",
    });
}

function renderHero(sys) {
  if (!sys) return;
  $("#hero-rate").textContent = fmtPct(sys.evasion_rate, 0);
  const unpaid = sys.apc_boardings - sys.paid_boardings;
  $("#hero-sub").textContent =
    `In 2025, an estimated ${fmtMillions(unpaid)} of ${fmtMillions(
      sys.apc_boardings,
    )} boardings on LA Metro went unpaid.`;
}

function renderKpis({ sys, busTot, railTot }) {
  const cards = [];
  if (busTot)
    cards.push({
      cls: "bus",
      label: "Bus evasion rate",
      value: fmtPct(busTot.evasion_rate, 1),
      sub: `${fmtMillions(busTot.apc_boardings)} boardings`,
    });
  if (railTot)
    cards.push({
      cls: "rail",
      label: "Rail evasion rate",
      value: fmtPct(railTot.evasion_rate, 1),
      sub: `${fmtMillions(railTot.apc_boardings)} boardings`,
    });
  if (sys) {
    cards.push({
      cls: "total",
      label: "Unpaid boardings",
      value: fmtMillions(sys.apc_boardings - sys.paid_boardings),
      sub: `of ${fmtMillions(sys.apc_boardings)} total`,
    });
    cards.push({
      cls: "total",
      label: "Paid boardings",
      value: fmtMillions(sys.paid_boardings),
      sub: `${fmtPct(1 - sys.evasion_rate, 0)} of total`,
    });
  }
  $("#kpis").innerHTML = cards
    .map(
      (k) => `
      <div class="kpi ${k.cls}">
        <span class="label">${esc(k.label)}</span>
        <span class="value">${esc(k.value)}</span>
        <span class="sub">${esc(k.sub)}</span>
      </div>`,
    )
    .join("");
}

function renderModeChart({ busTot, railTot }) {
  if (!busTot || !railTot) return;
  const ctx = document.getElementById("modeChart");
  new Chart(ctx, {
    type: "bar",
    data: {
      labels: ["Bus", "Rail"],
      datasets: [
        {
          label: "Paid",
          data: [busTot.paid_boardings, railTot.paid_boardings],
          backgroundColor: "rgba(34,197,94,0.75)",
          stack: "s",
        },
        {
          label: "Unpaid",
          data: [
            busTot.apc_boardings - busTot.paid_boardings,
            railTot.apc_boardings - railTot.paid_boardings,
          ],
          backgroundColor: "rgba(239,68,68,0.8)",
          stack: "s",
        },
      ],
    },
    options: {
      ...baseOpts(),
      indexAxis: "y",
      scales: {
        x: {
          stacked: true,
          ticks: {
            ...tickColor(),
            callback: (v) => `${(v / 1_000_000).toFixed(0)}M`,
          },
          grid: gridColor(),
        },
        y: {
          stacked: true,
          ticks: tickColor(),
          grid: { display: false },
        },
      },
      plugins: {
        ...baseOpts().plugins,
        tooltip: {
          callbacks: {
            label: (c) =>
              `${c.dataset.label}: ${(c.parsed.x / 1_000_000).toFixed(1)}M`,
          },
        },
      },
    },
  });
}

function renderTopBus(bus) {
  const eligible = bus.filter((r) => (r.apc_boardings || 0) >= 100_000);
  const top = [...eligible]
    .sort((a, b) => b.evasion_rate - a.evasion_rate)
    .slice(0, 10);
  drawRankBar("busChart", top.map((r) => cleanRouteName(r.route)), top.map((r) => r.evasion_rate), "#4cc9f0");
}

function renderTopRail(rail) {
  const top = [...rail]
    .sort((a, b) => b.evasion_rate - a.evasion_rate)
    .slice(0, 10);
  drawRankBar(
    "railChart",
    top.map((r) => r.merged_station.replace(/ Station$/, "")),
    top.map((r) => r.evasion_rate),
    "#f72585",
  );
}

function drawRankBar(canvasId, labels, values, color) {
  const ctx = document.getElementById(canvasId);
  new Chart(ctx, {
    type: "bar",
    data: {
      labels,
      datasets: [
        {
          data: values,
          backgroundColor: color,
          borderRadius: 6,
        },
      ],
    },
    options: {
      ...baseOpts(),
      indexAxis: "y",
      plugins: {
        ...baseOpts().plugins,
        legend: { display: false },
        tooltip: {
          callbacks: { label: (c) => fmtPct(c.parsed.x, 1) },
        },
      },
      scales: {
        x: {
          min: 0,
          max: 1,
          ticks: {
            ...tickColor(),
            callback: (v) => `${Math.round(v * 100)}%`,
          },
          grid: gridColor(),
        },
        y: { ticks: tickColor(), grid: { display: false } },
      },
    },
  });
}

function renderBusTable(bus) {
  const rows = [...bus].sort((a, b) => b.evasion_rate - a.evasion_rate);
  const html = `
    <table>
      <thead>
        <tr>
          <th>Route</th>
          <th>Boardings</th>
          <th>Paid</th>
          <th>Evasion</th>
        </tr>
      </thead>
      <tbody>
        ${rows
          .map(
            (r) => `
          <tr>
            <td>${esc(cleanRouteName(r.route))}</td>
            <td>${fmtInt(r.apc_boardings)}</td>
            <td>${fmtInt(r.paid_entries)}</td>
            <td><span class="rate-cell ${rateClass(
              r.evasion_rate,
            )}">${fmtPct(r.evasion_rate)}</span></td>
          </tr>`,
          )
          .join("")}
      </tbody>
    </table>`;
  $("#table-bus").innerHTML = html;
}

function renderRailTable(rail) {
  const rows = [...rail].sort((a, b) => b.evasion_rate - a.evasion_rate);
  const html = `
    <table>
      <thead>
        <tr>
          <th>Station</th>
          <th>Boardings</th>
          <th>Paid</th>
          <th>Evasion</th>
        </tr>
      </thead>
      <tbody>
        ${rows
          .map(
            (r) => `
          <tr>
            <td>${esc(r.merged_station.replace(/ Station$/, ""))}</td>
            <td>${fmtInt(r.apc_boardings)}</td>
            <td>${fmtInt(r.paid_entries)}</td>
            <td><span class="rate-cell ${rateClass(
              r.evasion_rate,
            )}">${fmtPct(r.evasion_rate)}</span></td>
          </tr>`,
          )
          .join("")}
      </tbody>
    </table>`;
  $("#table-rail").innerHTML = html;
}

function bindTabs() {
  document.querySelectorAll(".tab").forEach((btn) => {
    btn.addEventListener("click", () => {
      document
        .querySelectorAll(".tab")
        .forEach((b) => b.classList.toggle("active", b === btn));
      const which = btn.dataset.tab;
      $("#table-bus").classList.toggle("hidden", which !== "bus");
      $("#table-rail").classList.toggle("hidden", which !== "rail");
    });
  });
}

function baseOpts() {
  return {
    responsive: true,
    maintainAspectRatio: false,
    plugins: {
      legend: { labels: { color: cssVar("--ink") } },
    },
  };
}

function tickColor() {
  return { color: cssVar("--muted"), font: { size: 11 } };
}

function gridColor() {
  return { color: "rgba(128,128,128,0.12)" };
}

function cssVar(name) {
  return getComputedStyle(document.documentElement).getPropertyValue(name).trim();
}

function esc(s) {
  return String(s ?? "").replace(
    /[&<>"']/g,
    (c) =>
      ({
        "&": "&amp;",
        "<": "&lt;",
        ">": "&gt;",
        '"': "&quot;",
        "'": "&#39;",
      })[c],
  );
}

main();
