(function () {
'use strict';
const LS = 'vehicleCompare.v1';
const $ = (s) => document.querySelector(s);
const money = (n) => isFinite(n) ? new Intl.NumberFormat('en-CA', { style: 'currency', currency: 'CAD', maximumFractionDigits: 0 }).format(n) : '-';
const money2 = (n) => '$' + (+n).toFixed(2);
const COLORS = ['#1a73e8', '#d93025', '#188038', '#e37400', '#9334e6', '#00838f', '#5f6368', '#c2185b'];

/* ---------- scenario parameters ---------- */
const DEFAULTS = {
  years: 5, kmPerYear: 20000, winterPenalty: 15, winterRangeFactor: 70, inflation: 2, timeValue: 0,
  taxPct: 13, rebateFed: 5000, rebateCap: 50000, rebateProv: 0, rebateProvCap: 0, dealerFees: 0, registration: 120,
  useLoan: 0, loanApr: 0, loanDownPct: 0, loanYears: 5, loanFee: 0, investReturn: 0,
  leaseTerm: 3, leaseApr: 6, leaseDown: 0, leaseAcqFee: 0, leaseDispFee: 0, leaseKmAllow: 20000, leaseExcessRate: 0.15, leaseResidualPct: 0,
  tradeValue: 0, tradeOwed: 0, tradeTaxCredit: 1, luxThreshold: 100000,
  parkingMonthly: 0, winterTires: 0, panelUpgrade: 0, evBatteryReserve: 0, evResaleHaircut: 0, batteryDegrade: 2.3,
  gasPrice: 1.50, gasEsc: 2, gasFixed: 0,
  shareHome: 100, shareL2: 0, shareDC: 0,
  rateHome: 0.06, rateL2: 0.27, rateDC: 0.53, elecEsc: 2,
  elecFixedMonthly: 0, evAnnualFee: 0, evFeeEsc: 0, wallCharger: 0
};
const PARAM_GROUPS = [
  ['General', [
    ['years', 'Ownership period (years)', 1, 'Resale and costs are computed to this year'],
    ['kmPerYear', 'Distance (km / year)', 1000],
    ['inflation', 'General inflation (%/yr)', 0.1, 'Applied to insurance, maintenance, tires, other'],
    ['winterPenalty', 'Energy use penalty, all-year avg (%)', 1, 'Video adds 15% to both car types'],
    ['winterRangeFactor', 'Planning winter range (% of rated)', 1],
    ['timeValue', 'Value of your time ($/hr, DC charging)', 1, '0 = ignore. Fast charging is ~97 km per 15 min']
  ]],
  ['Purchase', [
    ['taxPct', 'Sales tax (%)', 0.001],
    ['rebateFed', 'Federal EV rebate ($)', 100, '5000 in 2026, 4000 in 2027, 2000 by 2030'],
    ['rebateCap', 'Federal rebate price cap ($, before freight/tax)', 100, 'Base price + options must be at or under this, otherwise NO federal rebate'],
    ['rebateProv', 'Provincial EV rebate ($)', 100, 'Quebec 2000 this year; Ontario/BC none'],
    ['rebateProvCap', 'Provincial rebate price cap ($, 0 = none)', 100, 'Check your province program rules'],
    ['dealerFees', 'Dealer admin / PDI / other fees ($, taxable)', 50, 'Hidden extras not in freight; 0 if already in freight field'],
    ['luxThreshold', 'Federal luxury tax threshold ($)', 1000, 'Cars priced above this pay luxury tax: lesser of 20% of the excess or 10% of price'],
    ['registration', 'Registration / licence ($/yr)', 10, 'Ignored in the video; ~120 in Ontario']
  ]],
  ['Financing', [
    ['useLoan', 'How do you pay?', 1, 'Cash, loan, or lease. Lease ignores resale (car is returned) but charges payments, fees and excess-km.', [[0, 'Cash'], [1, 'Loan'], [2, 'Lease']]],
    ['loanApr', 'Loan APR (%)', 0.1, 'Promotional 0% is allowed'],
    ['loanDownPct', 'Loan down payment (%)', 1],
    ['loanYears', 'Loan term (years)', 1],
    ['loanFee', 'Loan setup fees ($)', 50],
    ['investReturn', 'Return on cash tied up (%/yr)', 0.1, 'Opportunity cost: what your cash would earn if invested. 0 = ignore'],
    ['leaseTerm', 'Lease term (years)', 1, 'If you keep longer, a new lease of the same terms is assumed'],
    ['leaseApr', 'Lease rate (APR %, = money factor x 2400)', 0.1],
    ['leaseDown', 'Lease down payment ($)', 100],
    ['leaseAcqFee', 'Lease acquisition fee ($, taxable)', 50],
    ['leaseDispFee', 'Lease disposition fee ($, end of each lease)', 50],
    ['leaseKmAllow', 'Lease km allowance (km/yr)', 1000],
    ['leaseExcessRate', 'Excess km charge ($/km)', 0.01],
    ['leaseResidualPct', 'Lease residual (% of price, 0 = auto)', 1, 'Auto uses the vehicle\'s own resale curve at lease end']
  ]],
  ['Trade-in', [
    ['tradeValue', 'Trade-in value ($)', 100, 'What the dealer gives for your current car. Set the "keep my car" vehicle price to the same value.'],
    ['tradeOwed', 'Amount still owed on it ($)', 100],
    ['tradeTaxCredit', 'Province taxes only the price difference?', 1, 'Yes in Ontario/Quebec/most provinces (tax credit on trade-in); no in BC', [[1, 'Yes'], [0, 'No']]]
  ]],
  ['Other ownership costs', [
    ['parkingMonthly', 'Parking ($/month)', 10, 'Same for every vehicle'],
    ['winterTires', 'Winter tires + seasonal swap ($/yr)', 25, 'Same for every vehicle'],
    ['panelUpgrade', 'Home electrical panel upgrade ($)', 100, 'Added to charger cost when charging at home'],
    ['batteryDegrade', 'Battery capacity loss (%/yr)', 0.1, 'Shrinks EV range over the years (video: 2.3%)'],
    ['evBatteryReserve', 'EV battery replacement reserve ($/yr)', 50, 'Optional; 0 = rely on warranty'],
    ['evResaleHaircut', 'Extra EV resale haircut (%)', 1, 'Penalty on EV resale for battery uncertainty']
  ]],
  ['Gasoline', [
    ['gasPrice', 'Price now ($/L)', 0.01],
    ['gasEsc', 'Annual price change (%)', 0.1, 'Compounded each year'],
    ['gasFixed', 'Fixed fuel-related cost ($/yr)', 10]
  ]],
  ['Electricity', [
    ['shareHome', 'Charging share: home (%)', 1, 'Shares are normalised'],
    ['shareL2', 'Charging share: public L2 (%)', 1],
    ['shareDC', 'Charging share: DC fast (%)', 1],
    ['rateHome', 'Home rate, all-in ($/kWh)', 0.005, 'Ultra-low overnight ~0.06; regular higher'],
    ['rateL2', 'Public L2 rate ($/kWh)', 0.01],
    ['rateDC', 'DC fast rate ($/kWh)', 0.01, 'Tesla Ontario busy hours 0.38-0.55'],
    ['elecEsc', 'Annual rate change (%)', 0.1],
    ['elecFixedMonthly', 'Fixed plan charge ($/month)', 1, 'Extra monthly charge caused by the EV'],
    ['evAnnualFee', 'EV road fee ($/yr)', 10, 'Alberta 200, Saskatchewan 300'],
    ['evFeeEsc', 'EV fee change (%/yr)', 0.1],
    ['wallCharger', 'Home charger install ($)', 100, '0 if using a plain outlet']
  ]]
];
const PRESETS = {
  driveway: {},
  ontarioReg: { rateHome: 0.13 },
  apartment: { shareHome: 0, shareL2: 0, shareDC: 100 },
  mixed: { shareHome: 0, shareL2: 50, shareDC: 50 },
  qc: { taxPct: 14.975, rebateProv: 2000, rateHome: 0.08 },
  ab: { taxPct: 5, rateHome: 0.25, evAnnualFee: 200 }
};
/* Full scenarios: reset every parameter to DEFAULTS first, then apply overrides */
const FULL_PRESETS = {
  fullLoan: { useLoan: 1, loanApr: 6.9, loanDownPct: 10, loanYears: 6, loanFee: 500, investReturn: 4, dealerFees: 1000, wallCharger: 1500 },
  fullLoanPromo: { useLoan: 1, loanApr: 0, loanDownPct: 0, loanYears: 5, investReturn: 4, dealerFees: 1000, wallCharger: 1500 },
  fullLease: { useLoan: 2, leaseTerm: 3, leaseApr: 6.5, leaseDown: 2000, leaseAcqFee: 700, leaseDispFee: 400, leaseKmAllow: 20000, leaseExcessRate: 0.15, years: 3, dealerFees: 1000, wallCharger: 1500 },
  fullLeaseLow: { useLoan: 2, leaseTerm: 4, leaseApr: 6.5, leaseDown: 1500, leaseAcqFee: 700, leaseDispFee: 400, leaseKmAllow: 16000, kmPerYear: 15000, leaseExcessRate: 0.15, years: 4, dealerFees: 1000, wallCharger: 1500 },
  fullTrade: { tradeValue: 8000, tradeOwed: 0, tradeTaxCredit: 1, useLoan: 0, dealerFees: 1000, wallCharger: 1500 },
  fullTradeOwing: { tradeValue: 8000, tradeOwed: 3000, tradeTaxCredit: 1, useLoan: 1, loanApr: 6.9, loanDownPct: 0, loanYears: 6, loanFee: 500, investReturn: 4, dealerFees: 1000, wallCharger: 1500 },
  fullKeep: { tradeValue: 4000, years: 5, kmPerYear: 20000 },
  fullCity: { kmPerYear: 12000, parkingMonthly: 150, winterTires: 300, shareHome: 0, shareL2: 40, shareDC: 60, inflation: 2.5, dealerFees: 1000 },
  fullHighKm: { kmPerYear: 35000, years: 5, shareHome: 70, shareL2: 0, shareDC: 30, winterTires: 300, timeValue: 25, wallCharger: 1500, panelUpgrade: 2000 },
  fullConservative: { years: 8, evBatteryReserve: 500, evResaleHaircut: 10, batteryDegrade: 3, panelUpgrade: 2000, wallCharger: 1500, winterTires: 300, dealerFees: 1000, investReturn: 4, gasEsc: 2, elecEsc: 4 },
  fullLuxury: { luxThreshold: 100000, dealerFees: 2000, winterTires: 400, wallCharger: 2000, panelUpgrade: 2500, useLoan: 1, loanApr: 6.9, loanDownPct: 20, loanYears: 5 }
};
const REGION_DEFAULTS = { taxPct: 13, rebateProv: 0, rebateProvCap: 0, rateHome: 0.06, shareHome: 100, shareL2: 0, shareDC: 0, evAnnualFee: 0 };

/* ---------- vehicle field definitions ---------- */
const VFIELDS = [
  ['make', 'Make', 'text'], ['name', 'Model / trim', 'text'], ['type', 'Type', ['EV', 'HEV', 'ICE']],
  ['msrp', 'Base price ($)', 'num'], ['options', 'Options before tax ($)', 'num'], ['freight', 'Freight & fees ($)', 'num'],
  ['effKwh100km', 'EV use (kWh/100 km)', 'num'], ['effL100km', 'Fuel use (L/100 km)', 'num'], ['rangeKm', 'Rated range (km)', 'num'],
  ['retention5', 'Value kept after 5 yrs (%)', 'pct'], ['insurance', 'Insurance ($/yr)', 'num'], ['maintenance', 'Maintenance ($/yr)', 'num'],
  ['tires', 'Tires ($/yr)', 'num'], ['otherAnnual', 'Other ($/yr, e.g. data plan, repairs)', 'num'],
  ['owned', 'I already own this car (keep it)', ['no', 'yes']],
  ['epaId', 'EPA vehicle id', 'num'], ['sourceUrl', 'Source URL', 'text', 'wide'], ['notes', 'Notes', 'text', 'wide']
];
const SOURCED = ['msrp', 'freight', 'effKwh100km', 'effL100km', 'rangeKm', 'verified', 'lastUpdated', 'epaId', 'sourceUrl'];

/* ---------- state ---------- */
let fileData = window.VEHICLE_DATA;
let state = load() || fresh();
function fresh() {
  return {
    params: Object.assign({}, DEFAULTS),
    vehicles: JSON.parse(JSON.stringify(fileData.vehicles)),
    selected: fileData.vehicles.slice(0, 2).map(v => v.id),
    ref: fileData.vehicles[1] ? fileData.vehicles[1].id : fileData.vehicles[0].id,
    fileStamp: fileData.generatedAt, detail: null
  };
}
function load() { try { const s = JSON.parse(localStorage.getItem(LS)); if (s && s.params && s.vehicles) { s.params = Object.assign({}, DEFAULTS, s.params); return s; } } catch (e) { } return null; }
function save() { try { localStorage.setItem(LS, JSON.stringify(state)); } catch (e) { } }

/* ---------- cost model ---------- */
function blendShares(p) {
  let h = +p.shareHome || 0, l = +p.shareL2 || 0, d = +p.shareDC || 0, t = h + l + d;
  if (t <= 0) { h = 100; t = 100; }
  return { h: h / t, l: l / t, d: d / t };
}
function compute(v, p) {
  const owned = v.owned === 'yes' || v.owned === true;
  const sticker = (+v.msrp || 0) + (+v.options || 0);
  const isEV = v.type === 'EV';
  const mode = owned ? 0 : (+p.useLoan || 0); // 0 cash, 1 loan, 2 lease
  const rebate = isEV && !owned ? ((sticker <= p.rebateCap ? p.rebateFed : 0) + (p.rebateProvCap <= 0 || sticker <= p.rebateProvCap ? p.rebateProv : 0)) : 0;
  const luxury = !owned && sticker > p.luxThreshold ? Math.min(0.2 * (sticker - p.luxThreshold), 0.1 * sticker) : 0;
  const priceBeforeTax = sticker + (+v.freight || 0) + p.dealerFees + luxury;
  const tradeEquity = owned ? 0 : p.tradeValue - p.tradeOwed;
  const taxable = Math.max(0, priceBeforeTax - (p.tradeTaxCredit ? p.tradeValue : 0));
  const purchasePrice = owned ? sticker : taxable * (1 + p.taxPct / 100) - rebate;
  const sh = blendShares(p);
  const charger = isEV && !owned && sh.h > 0 ? p.wallCharger + p.panelUpgrade : 0;
  const mult = 1 + p.winterPenalty / 100;
  const N = Math.max(1, Math.round(p.years));
  const ret5 = Math.min(Math.max(+v.retention5 || 0.0001, 0.0001), 1);
  const taxMult = 1 + p.taxPct / 100;

  // lease: monthly payment, cost at signing, and cost arriving in each year
  const leaseYear = new Array(N).fill(0);
  let leasePay = 0, signing = 0, leaseResid = 0, leaseFixed = 0;
  if (mode === 2) {
    const nL = Math.max(1, Math.round(p.leaseTerm * 12));
    leaseResid = sticker * (p.leaseResidualPct > 0 ? p.leaseResidualPct / 100 : Math.pow(ret5, p.leaseTerm / 5)) * (isEV ? 1 - p.evResaleHaircut / 100 : 1);
    const cap = Math.max(1, priceBeforeTax - rebate - p.leaseDown - Math.max(0, tradeEquity));
    leasePay = ((cap - leaseResid) / nL + (cap + leaseResid) * p.leaseApr / 2400) * taxMult;
    signing = p.leaseDown + p.leaseAcqFee * taxMult;
    for (let m = 0; m < N * 12; m++) {
      const y = Math.floor(m / 12), inCycle = m % nL;
      leaseYear[y] += leasePay;
      if (inCycle === 0 && m > 0) { leaseYear[y] += signing; leaseFixed += signing; }
      if (inCycle === nL - 1 || m === N * 12 - 1) {
        const months = inCycle + 1;
        const excess = Math.max(0, p.kmPerYear - p.leaseKmAllow) * months / 12 * p.leaseExcessRate;
        leaseYear[y] += p.leaseDispFee + excess; leaseFixed += p.leaseDispFee + excess;
      }
    }
  }
  const outTheDoor = mode === 2 ? signing : purchasePrice;
  const cashNeed = mode === 2 ? signing : outTheDoor - tradeEquity;

  // loan interest by year; balStart[t] = loan balance at start of year t+1
  const interest = new Array(N).fill(0), balStart = new Array(N).fill(0);
  const principal = Math.max(0, cashNeed) * (1 - p.loanDownPct / 100);
  let monthlyPay = mode === 2 ? leasePay : 0;
  if (mode === 1 && principal > 0) {
    const n = Math.round(p.loanYears * 12), r = p.loanApr / 1200;
    monthlyPay = r > 0 ? principal * r / (1 - Math.pow(1 + r, -n)) : principal / n;
    let bal = principal;
    for (let m = 0; m < N * 12; m++) {
      if (m % 12 === 0) balStart[m / 12] = bal;
      if (m < n) { const i = bal * r; interest[Math.floor(m / 12)] += i; bal -= monthlyPay - i; }
    }
    interest[0] += p.loanFee;
  }

  const rows = []; let cum = 0, fuelTotal = 0, otherTotal = 0, timeTotal = 0, intTotal = 0, oppTotal = 0, leaseTotal = 0;
  for (let t = 1; t <= N; t++) {
    let fuel, time = 0, kwh = 0, liters = 0;
    if (isEV) {
      kwh = p.kmPerYear * (+v.effKwh100km || 0) / 100 * mult;
      const rate = (sh.h * p.rateHome + sh.l * p.rateL2 + sh.d * p.rateDC) * Math.pow(1 + p.elecEsc / 100, t - 1);
      fuel = kwh * rate + 12 * p.elecFixedMonthly * Math.pow(1 + p.elecEsc / 100, t - 1) + p.evAnnualFee * Math.pow(1 + p.evFeeEsc / 100, t - 1);
      time = (p.kmPerYear * sh.d / 388) * p.timeValue;
    } else {
      liters = p.kmPerYear * (+v.effL100km || 0) / 100 * mult;
      fuel = liters * p.gasPrice * Math.pow(1 + p.gasEsc / 100, t - 1) + p.gasFixed;
    }
    const other = ((+v.insurance || 0) + (+v.maintenance || 0) + (+v.tires || 0) + (+v.otherAnnual || 0) + p.registration +
      p.parkingMonthly * 12 + p.winterTires + (isEV ? p.evBatteryReserve : 0)) * Math.pow(1 + p.inflation / 100, t - 1);
    const resale = mode === 2 ? 0 : sticker * Math.pow(ret5, t / 5) * (isEV ? 1 - p.evResaleHaircut / 100 : 1);
    const opp = Math.max(0, cashNeed + charger - balStart[t - 1]) * p.investReturn / 100;
    const lease = leaseYear[t - 1];
    const running = fuel + other + time + interest[t - 1] + opp + lease;
    cum += running;
    fuelTotal += fuel; otherTotal += other; timeTotal += time; intTotal += interest[t - 1]; oppTotal += opp; leaseTotal += lease;
    rows.push({ year: t, fuel, other, time, interest: interest[t - 1], opp, lease, resale, kwh, liters, net: cashNeed + charger + cum - resale });
  }
  const last = rows[N - 1];
  const bat = 1 - p.batteryDegrade / 100;
  return {
    outTheDoor, rebate, luxury, tradeEquity, charger, rows, fuelTotal, otherTotal, timeTotal, intTotal, oppTotal, leaseTotal, monthlyPay, resale: last.resale,
    total: last.net, perMonth: last.net / (N * 12), perKm: last.net / (N * p.kmPerYear) * 100, fuelY1: rows[0].fuel,
    winterRange: isEV ? (+v.rangeKm || 0) * p.winterRangeFactor / 100 : null,
    winterRangeEnd: isEV ? (+v.rangeKm || 0) * p.winterRangeFactor / 100 * Math.pow(bat, N) : null
  };
}
const tco = (v, p) => compute(v, p).total;
function bisect(f, lo, hi) {
  let flo = f(lo), fhi = f(hi);
  if (!isFinite(flo) || !isFinite(fhi) || flo * fhi > 0) return null;
  for (let i = 0; i < 60; i++) { const m = (lo + hi) / 2, fm = f(m); if (flo * fm <= 0) { hi = m; fhi = fm; } else { lo = m; flo = fm; } }
  return (lo + hi) / 2;
}
function payback(c, r) { for (let i = 0; i < c.rows.length; i++) if (c.rows[i].net <= r.rows[i].net) return i + 1; return null; }

/* ---------- UI: params ---------- */
function buildParams() {
  const box = $('#paramFields'); box.innerHTML = '';
  PARAM_GROUPS.forEach(([g, items]) => {
    const fs = document.createElement('fieldset'); fs.innerHTML = '<legend>' + g + '</legend>';
    items.forEach(([k, label, step, hint, opts]) => {
      const d = document.createElement('label'); d.className = 'f'; d.title = hint || '';
      d.innerHTML = '<span>' + label + '</span>' + (opts
        ? '<select data-k="' + k + '">' + opts.map(([val, txt]) => '<option value="' + val + '">' + txt + '</option>').join('') + '</select>'
        : '<input type="number" step="' + step + '" data-k="' + k + '">');
      d.querySelector('input,select').value = state.params[k];
      fs.appendChild(d);
    });
    box.appendChild(fs);
  });
  box.oninput = box.onchange = (e) => {
    const k = e.target.dataset.k; if (!k) return;
    state.params[k] = parseFloat(e.target.value) || 0; $('#preset').value = ''; save(); render();
  };
}
$('#preset').onchange = (e) => {
  if (!e.target.value) return;
  const v = e.target.value;
  state.params = FULL_PRESETS[v]
    ? Object.assign({}, DEFAULTS, FULL_PRESETS[v])
    : Object.assign({}, state.params, REGION_DEFAULTS, PRESETS[v]);
  save(); buildParams(); render();
};

/* ---------- UI: vehicles ---------- */
function buildVehicles() {
  const box = $('#vehicleList'); box.innerHTML = '';
  const q = ($('#vehFilter').value || '').toLowerCase().trim(), tf = $('#typeFilter').value;
  state.vehicles.forEach((v, idx) => {
    if (q && !(v.make + ' ' + v.name + ' ' + v.type).toLowerCase().includes(q) && !state.selected.includes(v.id)) return;
    if (tf && v.type !== tf && !state.selected.includes(v.id)) return;
    const d = document.createElement('div'); d.className = 'veh'; d.dataset.id = v.id;
    if (state.open === v.id) d.classList.add('open');
    d.innerHTML = '<div class="head"><input type="checkbox" ' + (state.selected.includes(v.id) ? 'checked' : '') + '>' +
      '<a>' + esc(v.make) + ' ' + esc(v.name) + '</a><span class="tag ' + v.type + '">' + v.type + '</span>' +
      (v.verified ? '' : '<span class="unv" title="Placeholder / not verified against the manufacturer site">unverified</span>') +
      '<span class="hint">' + money(v.msrp) + ' &middot; ' + esc(v.lastUpdated || '') + '</span>' +
      '<button class="ghost" data-act="del">Delete</button></div><div class="edit"></div>';
    const ed = d.querySelector('.edit');
    VFIELDS.forEach(([k, label, kind, cls]) => {
      const l = document.createElement('label'); if (cls) l.className = cls;
      let inp;
      if (Array.isArray(kind)) { inp = '<select data-k="' + k + '">' + kind.map(o => '<option' + (o === v[k] ? ' selected' : '') + '>' + o + '</option>').join('') + '</select>'; }
      else if (kind === 'pct') inp = '<input type="number" step="1" data-k="' + k + '" data-kind="pct" value="' + Math.round((v[k] || 0) * 1000) / 10 + '">';
      else if (kind === 'num') inp = '<input type="number" step="any" data-k="' + k + '" data-kind="num" value="' + (v[k] ?? 0) + '">';
      else inp = '<input type="text" data-k="' + k + '" value="' + esc(v[k] ?? '') + '">';
      l.innerHTML = label + inp; ed.appendChild(l);
    });
    const vl = document.createElement('label'); vl.innerHTML = 'Price verified<select data-k="verified"><option value="1"' + (v.verified ? ' selected' : '') + '>yes</option><option value="0"' + (v.verified ? '' : ' selected') + '>no</option></select>';
    ed.appendChild(vl);
    box.appendChild(d);
  });
  const sel = $('#refVeh');
  sel.innerHTML = state.vehicles.map(v => '<option value="' + v.id + '"' + (v.id === state.ref ? ' selected' : '') + '>' + esc(v.make + ' ' + v.name) + '</option>').join('');
}
function esc(s) { return String(s ?? '').replace(/[&<>"]/g, c => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;' }[c])); }
$('#vehicleList').addEventListener('click', (e) => {
  const row = e.target.closest('.veh'); if (!row) return; const id = row.dataset.id;
  if (e.target.tagName === 'A') { state.open = state.open === id ? null : id; row.classList.toggle('open'); save(); }
  if (e.target.dataset.act === 'del' && confirm('Delete this vehicle?')) {
    state.vehicles = state.vehicles.filter(v => v.id !== id); state.selected = state.selected.filter(s => s !== id);
    if (state.ref === id && state.vehicles[0]) state.ref = state.vehicles[0].id; save(); buildVehicles(); render();
  }
});
$('#vehicleList').addEventListener('input', (e) => {
  const row = e.target.closest('.veh'); if (!row) return; const v = state.vehicles.find(x => x.id === row.dataset.id);
  if (e.target.type === 'checkbox') { state.selected = e.target.checked ? [...new Set([...state.selected, v.id])] : state.selected.filter(s => s !== v.id); save(); render(); return; }
  const k = e.target.dataset.k; if (!k) return;
  if (k === 'verified') v.verified = e.target.value === '1';
  else if (e.target.dataset.kind === 'pct') v[k] = (parseFloat(e.target.value) || 0) / 100;
  else if (e.target.dataset.kind === 'num') v[k] = parseFloat(e.target.value) || 0;
  else v[k] = e.target.value;
  v.lastUpdated = new Date().toISOString().slice(0, 10);
  save(); render();
});
$('#vehicleList').addEventListener('change', (e) => { if (e.target.dataset.k === 'type' || e.target.dataset.k === 'name' || e.target.dataset.k === 'make') { buildVehicles(); } });
$('#btnAdd').onclick = () => {
  const id = 'custom-' + Date.now();
  state.vehicles.push({ id, make: 'Custom', name: 'New vehicle', type: 'ICE', msrp: 35000, freight: 2000, options: 0, effKwh100km: 0, effL100km: 8, rangeKm: 700, retention5: 0.55, insurance: 2400, maintenance: 800, tires: 300, otherAnnual: 0, epaId: 0, sourceUrl: '', notes: '', verified: false, lastUpdated: new Date().toISOString().slice(0, 10) });
  state.selected.push(id); state.open = id; save(); buildVehicles(); render();
};
$('#refVeh').onchange = (e) => { state.ref = e.target.value; save(); render(); };
$('#vehFilter').oninput = buildVehicles;
$('#typeFilter').onchange = buildVehicles;
$('#btnClear').onclick = () => { state.selected = []; save(); buildVehicles(); render(); };

/* ---------- rendering ---------- */
function render() {
  const p = state.params;
  const sel = state.vehicles.filter(v => state.selected.includes(v.id));
  const ref = state.vehicles.find(v => v.id === state.ref) || sel[0];
  const res = sel.map(v => ({ v, c: compute(v, p) }));
  const refC = ref ? compute(ref, p) : null;
  if (!res.length) { $('#results').innerHTML = '<p class="hint">Tick at least one vehicle.</p>'; $('#chart').innerHTML = $('#legend').innerHTML = $('#breakeven').innerHTML = $('#detail').innerHTML = $('#detailSel').innerHTML = ''; return; }
  const best = Math.min(...res.map(r => r.c.total));
  const N = p.years;
  const head = ['Vehicle', 'Out the door / due at signing', 'Rebate', 'Trade-in credit', 'Energy yr 1', 'Energy total', 'Other costs', 'Charger', 'Interest+fees', 'Cash opp. cost', 'Lease paid', 'Monthly pmt', 'Resale @' + N + 'y', 'Net total cost', 'Per month', '&cent;/km', 'vs reference', 'Payback', 'Winter range now &rarr; yr ' + N];
  let h = '<table><tr>' + head.map(x => '<th>' + x + '</th>').join('') + '</tr>';
  res.forEach(({ v, c }, i) => {
    const diff = refC && v !== ref ? c.total - refC.total : null;
    const pb = refC && v !== ref ? payback(c, refC) : null;
    h += '<tr class="' + (c.total === best ? 'best' : '') + '"><td><i style="color:' + COLORS[i % 8] + '">&#9632;</i> ' + esc(v.make + ' ' + v.name) + '<span class="tag ' + v.type + '">' + v.type + '</span>' + ((v.owned === 'yes' || v.owned === true) ? '<span class="tag ICE">OWNED</span>' : '') + '</td>' +
      '<td title="' + (c.luxury ? 'includes luxury tax pre-GST of ' + money(c.luxury) : '') + '">' + money(c.outTheDoor) + (c.luxury ? ' *' : '') + '</td><td>' + (c.rebate ? money(c.rebate) : '-') + '</td><td>' + (c.tradeEquity ? money(c.tradeEquity) : '-') + '</td><td>' + money(c.fuelY1) + '</td><td>' + money(c.fuelTotal + c.timeTotal) + '</td>' +
      '<td>' + money(c.otherTotal) + '</td><td>' + (c.charger ? money(c.charger) : '-') + '</td><td>' + (c.intTotal ? money(c.intTotal) : '-') + '</td><td>' + (c.oppTotal ? money(c.oppTotal) : '-') + '</td><td>' + (c.leaseTotal ? money(c.leaseTotal) : '-') + '</td><td>' + (c.monthlyPay ? money(c.monthlyPay) : '-') + '</td>' +
      '<td>' + money(c.resale) + '</td><td><b>' + money(c.total) + '</b></td><td>' + money(c.perMonth) + '</td><td>' + c.perKm.toFixed(1) + '</td>' +
      '<td class="' + (diff == null ? '' : diff < 0 ? 'good' : 'bad') + '">' + (diff == null ? 'reference' : (diff < 0 ? '' : '+') + money(diff)) + '</td>' +
      '<td>' + (v === ref ? '' : pb ? 'year ' + pb : 'not within ' + N + 'y') + '</td><td>' + (c.winterRange ? Math.round(c.winterRange) + ' &rarr; ' + Math.round(c.winterRangeEnd) + ' km' : '-') + '</td></tr>';
  });
  $('#results').innerHTML = h + '</table><p class="hint">Net total cost = cash needed up front (price + tax &minus; rebate &minus; trade-in equity, or lease signing costs) + charger + energy + insurance/maintenance/tires/registration/parking/winter tires/other + interest, lease payments and fees + opportunity cost of cash &minus; resale (none for a lease). * = includes luxury tax. Resale = sticker &times; (5-yr value kept)^(years/5). Not modelled: carbon/fuel taxes beyond the pump price you enter, early lease termination, tax on the rebate, GAP insurance. A vehicle marked OWNED costs only its depreciation plus running costs.</p>';

  // cash vs loan vs lease
  let cl = '<table><tr><th>Vehicle</th><th>Cash</th><th>Loan</th><th>Lease</th><th>Cheapest</th><th>Loan pmt/mo</th><th>Lease pmt/mo</th></tr>';
  res.forEach(({ v }) => {
    const m = [0, 1, 2].map(k => compute(v, Object.assign({}, p, { useLoan: k })));
    const names = ['Cash', 'Loan', 'Lease'], min = Math.min(...m.map(x => x.total));
    cl += '<tr><td>' + esc(v.make + ' ' + v.name) + '</td>' + m.map(x => '<td class="' + (x.total === min ? 'good' : '') + '">' + money(x.total) + '</td>').join('') + '<td>' + names[m.findIndex(x => x.total === min)] + '</td><td>' + money(m[1].monthlyPay) + '</td><td>' + money(m[2].monthlyPay) + '</td></tr>';
  });
  $('#cashloan').innerHTML = cl + '</table><p class="hint">Same vehicle and scenario, three ways to pay. Loan and lease use the Financing section; "Return on cash tied up" sets what your cash would earn if kept. Lease: you return the car (no resale), pay lease-end and excess-km fees, and a new lease starts if you keep going past the term. Rebate and trade-in equity are assumed to reduce the lease capitalised cost.</p>';

  drawChart(res);
  $('#legend').innerHTML = res.map(({ v }, i) => '<span><i style="background:' + COLORS[i % 8] + '"></i>' + esc(v.make + ' ' + v.name) + '</span>').join('');

  // break-even
  if (ref) {
    let b = '<table><tr><th>Vehicle vs ' + esc(ref.make + ' ' + ref.name) + '</th><th>Gas price where costs tie ($/L)</th><th>Distance where costs tie (km/yr)</th><th>Home rate where costs tie ($/kWh)</th></tr>';
    res.filter(r => r.v !== ref).forEach(({ v }) => {
      const gas = bisect(g => tco(v, Object.assign({}, p, { gasPrice: g })) - tco(ref, Object.assign({}, p, { gasPrice: g })), 0.1, 8);
      const km = bisect(k => tco(v, Object.assign({}, p, { kmPerYear: k })) - tco(ref, Object.assign({}, p, { kmPerYear: k })), 500, 150000);
      const rate = (v.type === 'EV') !== (ref.type === 'EV') ? bisect(r => tco(v, Object.assign({}, p, { rateHome: r, rateL2: r, rateDC: r })) - tco(ref, Object.assign({}, p, { rateHome: r, rateL2: r, rateDC: r })), 0, 3) : null;
      b += '<tr><td>' + esc(v.make + ' ' + v.name) + '</td><td>' + (gas == null ? 'no tie in range' : money2(gas)) + '</td><td>' + (km == null ? 'no tie in range' : Math.round(km).toLocaleString()) + '</td><td>' + (rate == null ? 'n/a' : money2(rate) + ' (all charging types set equal)') + '</td></tr>';
    });
    $('#breakeven').innerHTML = b + '</table><p class="hint">Each value is found with the other settings held at their current values. Above/below it the cheaper vehicle flips.</p>';
  }

  // detail
  if (!res.find(r => r.v.id === state.detail)) state.detail = res[0].v.id;
  $('#detailSel').innerHTML = '<select id="detSel">' + res.map(({ v }) => '<option value="' + v.id + '"' + (v.id === state.detail ? ' selected' : '') + '>' + esc(v.make + ' ' + v.name) + '</option>').join('') + '</select>';
  $('#detSel').onchange = (e) => { state.detail = e.target.value; render(); };
  const dc = res.find(r => r.v.id === state.detail).c;
  $('#detail').innerHTML = '<table><tr><th>Year</th><th>Energy</th><th>Other</th><th>Time</th><th>Interest</th><th>Cash opp. cost</th><th>Lease</th><th>Resale value</th><th>Cumulative net cost</th></tr>' +
    dc.rows.map(r => '<tr><td>' + r.year + '</td><td>' + money(r.fuel) + '</td><td>' + money(r.other) + '</td><td>' + (r.time ? money(r.time) : '-') + '</td><td>' + (r.interest ? money(r.interest) : '-') + '</td><td>' + (r.opp ? money(r.opp) : '-') + '</td><td>' + (r.lease ? money(r.lease) : '-') + '</td><td>' + money(r.resale) + '</td><td>' + money(r.net) + '</td></tr>').join('') + '</table>';
}

function drawChart(res) {
  const W = 820, H = 300, m = { l: 64, r: 16, t: 12, b: 28 };
  const N = res[0].c.rows.length;
  const all = res.flatMap(r => r.c.rows.map(x => x.net));
  let lo = Math.min(...all), hi = Math.max(...all); const pad = (hi - lo) * 0.08 || 1000; lo = Math.max(0, lo - pad); hi += pad;
  const x = (t) => m.l + (N === 1 ? (W - m.l - m.r) / 2 : (t - 1) / (N - 1) * (W - m.l - m.r));
  const y = (v) => m.t + (1 - (v - lo) / (hi - lo)) * (H - m.t - m.b);
  let s = '<svg viewBox="0 0 ' + W + ' ' + H + '" width="100%" role="img">';
  for (let i = 0; i <= 5; i++) { const v = lo + (hi - lo) * i / 5; s += '<line x1="' + m.l + '" x2="' + (W - m.r) + '" y1="' + y(v) + '" y2="' + y(v) + '" stroke="#e5e9ee"/><text x="' + (m.l - 6) + '" y="' + (y(v) + 4) + '" text-anchor="end">' + money(v) + '</text>'; }
  for (let t = 1; t <= N; t++) s += '<text x="' + x(t) + '" y="' + (H - 8) + '" text-anchor="middle">Yr ' + t + '</text>';
  res.forEach(({ c }, i) => {
    const pts = c.rows.map(r => x(r.year) + ',' + y(r.net)).join(' ');
    s += '<polyline fill="none" stroke="' + COLORS[i % 8] + '" stroke-width="2.5" points="' + pts + '"/>';
    c.rows.forEach(r => { s += '<circle cx="' + x(r.year) + '" cy="' + y(r.net) + '" r="3.5" fill="' + COLORS[i % 8] + '"><title>' + money(r.net) + '</title></circle>'; });
  });
  $('#chart').innerHTML = s + '</svg>';
}

/* ---------- data refresh / import / export ---------- */
function banner(msg, actionLabel, action) {
  const b = $('#banner'); b.hidden = !msg; b.innerHTML = esc(msg || '');
  if (actionLabel) { const btn = document.createElement('button'); btn.textContent = actionLabel; btn.style.marginLeft = '10px'; btn.onclick = action; b.appendChild(btn); }
}
function mergeFile(data) {
  data.vehicles.forEach(nv => {
    const ov = state.vehicles.find(v => v.id === nv.id);
    if (!ov) { state.vehicles.push(JSON.parse(JSON.stringify(nv))); return; }
    SOURCED.forEach(k => { if (nv[k] !== undefined) ov[k] = nv[k]; });
  });
  state.fileStamp = data.generatedAt; save(); buildVehicles(); render(); banner('Vehicle data updated (generated ' + data.generatedAt + ').');
}
if (state.fileStamp !== fileData.generatedAt) banner('vehicles.js has newer data (' + fileData.generatedAt + ') than your saved session.', 'Apply it', () => mergeFile(fileData));

$('#btnEpa').onclick = async () => {
  const targets = state.vehicles.filter(v => v.epaId > 0); let ok = 0, fail = 0;
  banner('Contacting fueleconomy.gov ...');
  for (const v of targets) {
    try {
      const r = await fetch('https://www.fueleconomy.gov/ws/rest/vehicle/' + v.epaId, { headers: { Accept: 'application/json' } });
      const j = await r.json(); const kwhMi = parseFloat(j.combE) || 0, mpg = parseFloat(j.comb08) || 0;
      if (v.type === 'EV' && kwhMi > 0) v.effKwh100km = +(kwhMi / 1.609344).toFixed(2);
      else if (v.type !== 'EV' && mpg > 0) v.effL100km = +(235.215 / mpg).toFixed(2);
      else throw new Error('no data');
      if (parseFloat(j.range) > 0 && v.type === 'EV') v.rangeKm = Math.round(j.range * 1.609344);
      v.lastUpdated = new Date().toISOString().slice(0, 10); ok++;
    } catch (e) { fail++; }
  }
  save(); buildVehicles(); render();
  banner('EPA efficiency refreshed: ' + ok + ' updated, ' + fail + ' failed. (Prices are not provided by EPA - use Update-Vehicles.ps1 or edit manually.)');
};
$('#btnFile').onclick = () => { $('#fileIn').dataset.mode = 'data'; $('#fileIn').click(); };
$('#btnImport').onclick = () => { $('#fileIn').dataset.mode = 'state'; $('#fileIn').click(); };
$('#fileIn').onchange = async (e) => {
  const f = e.target.files[0]; if (!f) return; const txt = await f.text(); e.target.value = '';
  try {
    const body = f.name.endsWith('.js') ? txt.slice(txt.indexOf('{', txt.indexOf('VEHICLE_DATA'))).replace(/;\s*$/, '') : txt;
    const obj = JSON.parse(body);
    if (e.target.dataset.mode === 'state') { state = Object.assign(fresh(), obj); state.params = Object.assign({}, DEFAULTS, obj.params); save(); buildParams(); buildVehicles(); render(); banner('State imported.'); }
    else mergeFile(obj);
  } catch (err) { banner('Could not read file: ' + err.message); }
};
$('#btnExport').onclick = () => {
  const a = document.createElement('a'); a.href = URL.createObjectURL(new Blob([JSON.stringify(state, null, 2)], { type: 'application/json' }));
  a.download = 'vehicle-compare-state.json'; a.click();
};
$('#btnReset').onclick = () => { if (confirm('Discard all your edits and reload defaults?')) { localStorage.removeItem(LS); state = fresh(); buildParams(); buildVehicles(); render(); banner(''); } };

buildParams(); buildVehicles(); render();
})();
