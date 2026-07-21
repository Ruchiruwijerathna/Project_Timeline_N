// ─────────────────────────────────────────────────────────────
//  PRIME LAND — DATA LAYER  (data.js)
//  Handles the actual Google Sheets CSV structure:
//   Row 0 = "PROJECT DETAILS-BHOOMI" (title — skip)
//   Row 1 = main headers  (Project_ID, No of Lots, Committed Date, …)
//   Row 2 = sub-headers   (nan, nan, Letter, Agreement, Deed, …)
//   Row 3+ = data          (dates as DD/MM/YYYY)
// ─────────────────────────────────────────────────────────────

// ── CSV line parser (handles quoted commas) ───────────────────
function parseCSVLine(line) {
  const out = []; let cur = '', inQ = false;
  for (let i = 0; i < line.length; i++) {
    const c = line[i];
    if (c === '"') {
      if (inQ && line[i + 1] === '"') { cur += '"'; i++; }
      else inQ = !inQ;
    } else if (c === ',' && !inQ) { out.push(cur); cur = ''; }
    else cur += c;
  }
  out.push(cur);
  return out.map(v => v.trim());
}

// ── Date parser — handles DD/MM/YYYY and YYYY-MM-DD ──────────
function parseDate(s) {
  if (!s || s === 'nan' || s === '') return null;
  s = s.trim();
  // DD/MM/YYYY  (most common in this sheet)
  if (/^\d{1,2}\/\d{1,2}\/\d{4}$/.test(s)) {
    const p = s.split('/');
    const d = p[0].padStart(2,'0'), m = p[1].padStart(2,'0'), y = p[2];
    const dt = new Date(`${y}-${m}-${d}`);
    return isNaN(dt) ? null : `${y}-${m}-${d}`;
  }
  // M/D/YYYY  (US format seen in col 24)
  if (/^\d{1,2}\/\d{1,2}\/\d{4}$/.test(s)) {
    const p = s.split('/');
    const dt = new Date(s);
    return isNaN(dt) ? null : dt.toISOString().slice(0, 10);
  }
  // YYYY-MM-DD
  if (/^\d{4}-\d{2}-\d{2}$/.test(s)) return s;
  // fallback
  const dt = new Date(s);
  return isNaN(dt) ? null : dt.toISOString().slice(0, 10);
}

// ── Build flat column name map from two header rows ───────────
//  This maps column INDEX → our internal field name
//  so we never depend on exact header text matching.
function buildColMap(h1, h2) {
  // Position-based mapping derived from actual CSV structure:
  // [0]  Project_ID
  // [1]  Project_Name
  // [2]  Local_Authority
  // [3]  No of Lots
  // [4]  Start_year
  // [5]  Committed Date / Letter
  // [6]  (Committed Date) / Agreement
  // [7]  (Committed Date) / Deed
  // [8]  PPC Applied
  // [9]  ppc_Approve
  // [10] AG/Gra.N Applied
  // [11] AG /Gra.NApproved
  // [12] Perimiter_Plan _surveydate
  // [13] Perimiter_Plan _applied_date
  // [14] Perimiter_Plan _approvedate
  // [15] Water_Estimate_Applied
  // [16] Water_Estimate_Aprrove
  // [17] Electricity_CON_Applied
  // [18] Electricity_Con_approve
  // [19] 1%_Sales_Tax
  // [20] Bod_survey
  // [21] Development_permit_Applied
  // [22] Development_permit_Date
  // [23] Bod_approve
  // [24] COC / applied  (sub-header 'applied' under COC group — this is coc_applied)
  // [25] COC / approve  (actual COC date)
  // [26] NBRO / applied
  // [27] NBRO / approve
  // [28] Aggrarian / applied
  // [29] Aggrarian / approve
  // [30] Irrigation / applied
  // [31] Irrigation / approved
  // [32] Archaeology / applied
  // [33] Archaeology / approved
  // [34] Forest / applied
  // [35] Forest / approved
  // [36] CEA / applied
  // [37] CEA / approved
  // [38] NRMC / applied
  // [39] NRMC / approved
  // [40] Tea,rubber,Coconut / applied
  // [41] Tea,rubber,Coconut / approved
  // [42] Civil Aviation Authority / applied
  // [43] Civil Aviation Authority / approved
  // [44] Individual_lot_applied
  // [45] Individual_lot_approved
  // [46] Assement_number_Applied
  // [47] Assessment Tax Paid date
  // [48] other
  // [49] other_2
  // [50] Remarks
  // [51] Remarks_2
  return {
    0:  'project_id',
    1:  'project_name',
    2:  'local_authority',
    3:  'no_of_lots',
    4:  'start_year',
    5:  'committed_letter',
    6:  'committed_agreement',
    7:  'committed_deed',
    8:  'ppc_applied',
    9:  'ppc_approved',
    10: 'ag_applied',
    11: 'ag_approved',
    12: 'perimeter_survey',
    13: 'perimeter_applied',
    14: 'perimeter_approved',
    15: 'water_applied',
    16: 'water_approved',
    17: 'elec_applied',
    18: 'elec_approved',
    19: 'sales_tax',
    20: 'bod_survey',
    21: 'dev_permit_applied',
    22: 'dev_permit_approved',
    23: 'bod_approved',
    24: 'coc_applied',
    25: 'coc',
    26: 'nbro_applied',
    27: 'nbro_approved',
    28: 'agrarian_applied',
    29: 'agrarian_approved',
    30: 'irrigation_applied',
    31: 'irrigation_approved',
    32: 'archaeology_applied',
    33: 'archaeology_approved',
    34: 'forest_applied',
    35: 'forest_approved',
    36: 'cea_applied',
    37: 'cea_approved',
    38: 'nrmc_applied',
    39: 'nrmc_approved',
    40: 'tea_applied',
    41: 'tea_approved',
    42: 'civil_aviation_applied',
    43: 'civil_aviation_approved',
    44: 'individual_lot_applied',
    45: 'individual_lot_approved',
    46: 'assessment_applied',
    47: 'assessment_tax_paid',
    48: 'other_1',
    49: 'other_2',
    50: 'remarks',
    51: 'remarks_2',
  };
}

// Which field names are dates (parsed with parseDate)
const DATE_FIELDS = new Set([
  'start_year','committed_letter','committed_agreement','committed_deed',
  'ppc_applied','ppc_approved','ag_applied','ag_approved',
  'perimeter_survey','perimeter_applied','perimeter_approved',
  'water_applied','water_approved','elec_applied','elec_approved',
  'sales_tax','bod_survey','dev_permit_applied','dev_permit_approved',
  'bod_approved','coc_applied','coc',
  'nbro_applied','nbro_approved','agrarian_applied','agrarian_approved',
  'irrigation_applied','irrigation_approved','archaeology_applied','archaeology_approved',
  'forest_applied','forest_approved','cea_applied','cea_approved',
  'nrmc_applied','nrmc_approved','tea_applied','tea_approved',
  'civil_aviation_applied','civil_aviation_approved',
  'individual_lot_applied','individual_lot_approved',
  'assessment_applied','assessment_tax_paid'
]);

// ── Helpers ───────────────────────────────────────────────────
function daysBetween(a, b) {
  if (!a || !b) return null;
  const da = new Date(a), db = new Date(b);
  if (isNaN(da) || isNaN(db)) return null;
  const d = Math.round((db - da) / 86400000);
  return d > 0 ? d : null;
}

function classifyStage(r) {
  if (r.coc)                  return 'COC Complete';
  if (r.bod_approved)         return 'BOD Approved';
  if (r.dev_permit_approved)  return 'Dev Permit Issued';
  if (r.bod_survey)           return 'BOD Survey Done';
  if (r.perimeter_approved)   return 'Perimeter Approved';
  if (r.committed_deed)       return 'Deed Committed';
  return 'Early Stage';
}

function stallCat(days, stage) {
  if (stage === 'COC Complete') return 'ok';
  if (days > 1800) return 'critical';
  if (days > 730)  return 'warning';
  if (days > (CONFIG.STALL_DAYS || 180)) return 'watch';
  return 'ok';
}

// ── Main CSV processor ────────────────────────────────────────
function processCSV(csvText) {
  const lines = csvText.split(/\r?\n/).filter(l => l.trim());

  // Find the header row — the one containing 'Project_ID' (case-insensitive)
  let h1Idx = -1;
  for (let i = 0; i < Math.min(lines.length, 6); i++) {
    if (lines[i].toLowerCase().includes('project_id') ||
        lines[i].toLowerCase().includes('project_name')) {
      h1Idx = i; break;
    }
  }
  if (h1Idx < 0) throw new Error('Cannot find header row — check sheet is published correctly');

  const h1 = parseCSVLine(lines[h1Idx]);
  const h2 = h1Idx + 1 < lines.length ? parseCSVLine(lines[h1Idx + 1]) : [];
  const dataStartIdx = h1Idx + 2; // skip both header rows

  // Build position→fieldname map
  const colMap = buildColMap(h1, h2);

  // Parse all data rows
  const projects = [];
  for (let i = dataStartIdx; i < lines.length; i++) {
    const vals = parseCSVLine(lines[i]);

    // Skip blank rows
    const pid = vals[0] || '';
    const pname = vals[1] || '';
    if (!pid.trim() || pid.trim() === '' || isNaN(parseFloat(pid))) continue;
    if (!pname.trim() || pname.trim() === 'nan') continue;

    // Build row object using position map
    const r = {};
    Object.entries(colMap).forEach(([idx, field]) => {
      const raw = (vals[parseInt(idx)] || '').trim();
      if (raw === 'nan' || raw === '') {
        r[field] = null;
      } else if (DATE_FIELDS.has(field)) {
        r[field] = parseDate(raw);
      } else {
        r[field] = raw;
      }
    });

    // Derived fields
    r.stage = classifyStage(r);
    r.stage_num = CONFIG.STAGE_ORDER.indexOf(r.stage);
    r.no_of_lots_n = parseFloat(r.no_of_lots) || 0;

    // Cycle start: agreement preferred (BOD can legally precede deed in this workflow)
    r.cycle_start = r.committed_agreement || r.committed_deed || r.start_year || null;
    r.cycle_days_n = daysBetween(r.cycle_start, r.bod_approved);

    // Latest activity date across ALL date fields
    let latestMs = null;
    DATE_FIELDS.forEach(f => {
      if (r[f]) {
        const t = new Date(r[f]).getTime();
        if (!isNaN(t) && (latestMs === null || t > latestMs)) latestMs = t;
      }
    });
    const todayMs = new Date().setHours(0, 0, 0, 0);
    r.days_inactive = latestMs !== null ? Math.round((todayMs - latestMs) / 86400000) : 9999;
    r.stall_cat = stallCat(r.days_inactive, r.stage);
    r.age_days = r.cycle_start
      ? Math.round((todayMs - new Date(r.cycle_start).getTime()) / 86400000)
      : null;

    projects.push(r);
  }

  if (!projects.length) throw new Error('No data rows found — verify the Google Sheet is published as CSV and has data from row 3 onwards');

  // ── KPIs ──────────────────────────────────────────────────
  const completed  = projects.filter(p => p.stage === 'COC Complete');
  const inprog     = projects.filter(p => p.stage !== 'COC Complete');
  const totalLots  = projects.reduce((s, p) => s + p.no_of_lots_n, 0);
  const cocLots    = completed.reduce((s, p) => s + p.no_of_lots_n, 0);
  const stalled    = inprog.filter(p => p.stall_cat !== 'ok');
  const stalledLots= stalled.reduce((s, p) => s + p.no_of_lots_n, 0);
  const cycleTimes = projects.map(p => p.cycle_days_n).filter(Boolean);
  const sortedCyc  = [...cycleTimes].sort((a, b) => a - b);
  const medCyc     = sortedCyc.length ? sortedCyc[Math.floor(sortedCyc.length / 2)] : 0;

  // ── Pipeline funnel ────────────────────────────────────────
  const pipeline = CONFIG.STAGE_ORDER.map(s => ({
    stage: s,
    color: CONFIG.STAGE_COLORS[s],
    count: projects.filter(p => p.stage === s).length,
    lots:  Math.round(projects.filter(p => p.stage === s).reduce((sum, p) => sum + p.no_of_lots_n, 0))
  }));

  // ── Stage durations ────────────────────────────────────────
  const PAIRS = [
    ['ppc_applied',         'ppc_approved',        'PPC'],
    ['ag_applied',          'ag_approved',          'AG / Gra.N'],
    ['perimeter_applied',   'perimeter_approved',   'Perimeter Plan'],
    ['water_applied',       'water_approved',       'Water Estimate'],
    ['elec_applied',        'elec_approved',        'Electricity CON'],
    ['dev_permit_applied',  'dev_permit_approved',  'Dev Permit'],
    ['bod_survey',          'bod_approved',         'BOD Survey→Approve'],
  ];
  const stage_stats = {};
  PAIRS.forEach(([a, b, label]) => {
    const durs = projects.map(p => daysBetween(p[a], p[b])).filter(d => d && d > 0 && d < 2000);
    const sorted = [...durs].sort((x, y) => x - y);
    stage_stats[label] = {
      n:      durs.length,
      median: sorted.length ? sorted[Math.floor(sorted.length / 2)] : 0,
      mean:   durs.length ? Math.round(durs.reduce((s, v) => s + v, 0) / durs.length) : 0,
      max:    durs.length ? Math.max(...durs) : 0,
      low_n:  durs.length < 10
    };
  });

  // ── Yearly intake vs COC ───────────────────────────────────
  const yearly = {};
  const thisYear = new Date().getFullYear();
  for (let yr = 2018; yr <= thisYear; yr++) {
    const s = projects.filter(p => p.cycle_start && new Date(p.cycle_start).getFullYear() === yr).length;
    const c = projects.filter(p => p.coc && new Date(p.coc).getFullYear() === yr).length;
    if (s > 0 || c > 0) yearly[yr] = { started: s, coc: c };
  }

  // ── LA summary ────────────────────────────────────────────
  const laMap = {};
  projects.forEach(p => {
    const la = p.local_authority || 'Unknown';
    if (!laMap[la]) laMap[la] = { projects: 0, lots: 0, completed: 0 };
    laMap[la].projects++;
    laMap[la].lots += p.no_of_lots_n;
    if (p.stage === 'COC Complete') laMap[la].completed++;
  });
  const la_data = Object.entries(laMap)
    .map(([la, v]) => ({ local_authority: la, projects: v.projects, lots: Math.round(v.lots), completed: v.completed }))
    .sort((a, b) => b.projects - a.projects)
    .slice(0, 12);

  // ── Scatter: lot size vs cycle time ───────────────────────
  const scatter = projects
    .filter(p => p.no_of_lots_n > 0 && p.cycle_days_n && p.cycle_days_n > 0)
    .map(p => ({ x: p.no_of_lots_n, y: p.cycle_days_n, name: p.project_name, stage: p.stage }));

  // ── Age buckets ────────────────────────────────────────────
  const age_buckets = { '<1yr': 0, '1-2yr': 0, '2-3yr': 0, '3-5yr': 0, '5-8yr': 0, '8+yr': 0 };
  projects.forEach(p => {
    if (!p.age_days || p.age_days <= 0) return;
    const y = p.age_days / 365.25;
    if (y < 1)      age_buckets['<1yr']++;
    else if (y < 2) age_buckets['1-2yr']++;
    else if (y < 3) age_buckets['2-3yr']++;
    else if (y < 5) age_buckets['3-5yr']++;
    else if (y < 8) age_buckets['5-8yr']++;
    else            age_buckets['8+yr']++;
  });

  // ── Stalled list ───────────────────────────────────────────
  const stalled_list = stalled
    .sort((a, b) => b.days_inactive - a.days_inactive)
    .map(p => ({
      id:           p.project_id,
      name:         p.project_name,
      la:           p.local_authority || '—',
      stage:        p.stage,
      days_inactive:p.days_inactive,
      lots:         p.no_of_lots_n,
      stall_cat:    p.stall_cat
    }));

  // ── Outlier flags per project ─────────────────────────────
  const cycMean = cycleTimes.reduce((s, v) => s + v, 0) / (cycleTimes.length || 1);
  const cycStd  = Math.sqrt(cycleTimes.reduce((s, v) => s + (v - cycMean) ** 2, 0) / (cycleTimes.length || 1));
  projects.forEach(p => {
    p.flag = '';
    if (p.cycle_days_n && p.cycle_days_n > cycMean + (CONFIG.OUTLIER_SIGMA || 2) * cycStd) p.flag = 'long_cycle';
    else if (p.days_inactive > 730 && p.stage !== 'COC Complete') p.flag = 'stalled';
    else if (p.days_inactive > (CONFIG.STALL_DAYS || 180) && p.stage !== 'COC Complete') p.flag = 'inactive';

    p.data_needed = [];
    if (!['COC Complete', 'Early Stage'].includes(p.stage)) {
      if (!p.no_of_lots_n) p.data_needed.push('lots count');
      if (!p.committed_deed && !p.committed_agreement) p.data_needed.push('deed/agmt date');
    }
  });

  // ── Special clearances summary ────────────────────────────
  const CLEAR_DEFS = [
    { name: 'NBRO',            a: 'nbro_applied',            b: 'nbro_approved' },
    { name: 'Agrarian',        a: 'agrarian_applied',        b: 'agrarian_approved' },
    { name: 'Irrigation',      a: 'irrigation_applied',      b: 'irrigation_approved' },
    { name: 'Archaeology',     a: 'archaeology_applied',     b: 'archaeology_approved' },
    { name: 'Forest',          a: 'forest_applied',          b: 'forest_approved' },
    { name: 'CEA',             a: 'cea_applied',             b: 'cea_approved' },
    { name: 'NRMC',            a: 'nrmc_applied',            b: 'nrmc_approved' },
    { name: 'Tea/Rubber',      a: 'tea_applied',             b: 'tea_approved' },
    { name: 'Civil Aviation',  a: 'civil_aviation_applied',  b: 'civil_aviation_approved' },
    { name: 'Individual Lot',  a: 'individual_lot_applied',  b: 'individual_lot_approved' },
    { name: 'Assessment',      a: 'assessment_applied',      b: 'assessment_tax_paid' },
  ];
  const clearances = CLEAR_DEFS.map(c => ({
    name:     c.name,
    applied:  projects.filter(p => p[c.a]).length,
    approved: projects.filter(p => p[c.b]).length,
    pending:  projects.filter(p => p[c.a] && !p[c.b]).length,
  }));

  // Projects with at least one special clearance applied
  const special_projs = projects
    .filter(p => CLEAR_DEFS.slice(0, 9).some(c => p[c.a]))
    .map(p => {
      const row = { id: p.project_id, name: p.project_name };
      CLEAR_DEFS.slice(0, 9).forEach(c => {
        row[c.name] = p[c.b] ? 'approved' : p[c.a] ? 'applied' : '';
      });
      return row;
    });

  // ── BOD bottleneck median for KPI ─────────────────────────
  const bodStat = stage_stats['BOD Survey→Approve'];

  return {
    kpis: {
      total:          projects.length,
      completed:      completed.length,
      in_progress:    inprog.length,
      total_lots:     Math.round(totalLots),
      coc_lots:       Math.round(cocLots),
      pipeline_lots:  Math.round(totalLots - cocLots),
      stalled_count:  stalled.length,
      stalled_lots:   Math.round(stalledLots),
      median_cycle:   medCyc,
      bod_median:     bodStat ? bodStat.median : 0,
      bod_n:          bodStat ? bodStat.n : 0,
    },
    pipeline, stage_stats, yearly, la_data, scatter,
    age_buckets, stalled_list, projects, clearances, special_projs,
    generated: new Date().toISOString().slice(0, 10)
  };
}

// ── Fetch CSV from Google Sheets ──────────────────────────────
async function loadDashboardData() {
  const url = CONFIG.SHEET_CSV_URL;

  if (url.includes('YOUR_SHEET_ID')) {
    // Use cached data if URL not yet configured
    const cached = localStorage.getItem('pl_cache');
    if (cached) {
      try { return JSON.parse(cached); } catch(e) {}
    }
    throw new Error('CONFIG_URL_NOT_SET');
  }

  const res = await fetch(url, { cache: 'no-store' });
  if (!res.ok) throw new Error(`HTTP ${res.status} — verify sheet is published as CSV`);

  const text = await res.text();
  const data = processCSV(text);

  // Cache locally so page works if Sheets is temporarily unreachable
  try { localStorage.setItem('pl_cache', JSON.stringify(data)); } catch(e) {}
  return data;
}
