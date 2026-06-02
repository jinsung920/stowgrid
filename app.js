// ============================================================================
// Master catalog — central registry of product codes with default dimensions.
// ============================================================================

const Master = (() => {
  const KEY = 'cls.master.v1';

  function getAll() {
    try { return JSON.parse(localStorage.getItem(KEY) || '{}'); }
    catch (e) { return {}; }
  }
  function setAll(obj) { localStorage.setItem(KEY, JSON.stringify(obj)); }
  function lookup(code) {
    if (!code) return null;
    return getAll()[String(code).trim()] || null;
  }
  function upsert(p) {
    if (!p.code) return false;
    const all = getAll();
    all[String(p.code).trim()] = {
      code: String(p.code).trim(),
      name: p.name || '',
      L: +p.L || 0, W: +p.W || 0, H: +p.H || 0,
      weight: +p.weight || 0,
    };
    setAll(all);
    return true;
  }
  function remove(code) {
    const all = getAll();
    delete all[code];
    setAll(all);
  }
  function clear() { setAll({}); }
  function size() { return Object.keys(getAll()).length; }
  function list(query = '') {
    const all = getAll();
    const q = query.trim().toLowerCase();
    const rows = Object.values(all);
    if (!q) return rows;
    return rows.filter(r =>
      (r.code || '').toLowerCase().includes(q) ||
      (r.name || '').toLowerCase().includes(q));
  }
  function toCSV() {
    const rows = Object.values(getAll());
    const header = 'code,name,L,W,H,weight';
    const body = rows.map(r =>
      [r.code, r.name, r.L, r.W, r.H, r.weight].map(v =>
        /[,"\n]/.test(String(v)) ? `"${String(v).replace(/"/g, '""')}"` : String(v)
      ).join(',')
    ).join('\n');
    return header + '\n' + body;
  }
  function fromCSV(text) {
    const lines = text.replace(/\r/g, '').split('\n').filter(l => l.trim());
    if (lines.length === 0) return { added: 0, errors: ['빈 파일입니다.'], headers: [] };

    // Parse CSV with simple state machine to handle quoted commas
    const parseLine = (line) => {
      const out = [];
      let cur = '', inQ = false;
      for (let i = 0; i < line.length; i++) {
        const c = line[i];
        if (inQ) {
          if (c === '"' && line[i + 1] === '"') { cur += '"'; i++; }
          else if (c === '"') { inQ = false; }
          else cur += c;
        } else {
          if (c === ',') { out.push(cur.trim()); cur = ''; }
          else if (c === '"') inQ = true;
          else cur += c;
        }
      }
      out.push(cur.trim());
      return out;
    };

    // Auto-detect column mapping via Paste.findField (handles Korean + units).
    const headerCells = parseLine(lines[0]);
    const mapping = {};
    headerCells.forEach((cell, i) => {
      const field = Paste.findField(cell);
      if (field && !Object.values(mapping).includes(field)) mapping[i] = field;
    });

    const recognized = Object.values(mapping);
    const errors = [];
    if (!recognized.includes('code')) {
      errors.push(`헤더에서 "코드" 또는 "code" 열을 찾을 수 없습니다. 감지된 헤더: [${headerCells.join(', ')}]`);
      return { added: 0, errors, headers: headerCells, mapping };
    }

    // Phase 1: parse every CSV row in file order so we preserve the user's
    // intended sequence (helpful for picking lists that go through products
    // in a specific order).
    const csvRows = [];
    for (let i = 1; i < lines.length; i++) {
      const cells = parseLine(lines[i]);
      if (cells.every(c => !c)) continue;
      const row = { code: '', name: '', L: 0, W: 0, H: 0, weight: 0 };
      for (const [colIdx, field] of Object.entries(mapping)) {
        const val = cells[+colIdx];
        if (val === undefined || val === '') continue;
        if (field === 'code' || field === 'name') row[field] = String(val).trim();
        else row[field] = parseFloat(String(val).replace(/,/g, '')) || 0;
      }
      if (row.code) csvRows.push(row);
      else errors.push(`행 ${i + 1}: 코드가 비어 있어 건너뜀`);
    }

    // Phase 2: rebuild the master in CSV order. Existing master entries that
    // weren't in this CSV are appended at the end so their positions don't
    // change relative to one another (incremental imports stay predictable).
    const existing = getAll();
    const csvCodes = new Set();
    const result = {};
    for (const row of csvRows) {
      csvCodes.add(row.code);
      result[row.code] = {
        code: row.code,
        name: row.name || '',
        L: +row.L || 0, W: +row.W || 0, H: +row.H || 0,
        weight: +row.weight || 0,
      };
    }
    for (const [code, item] of Object.entries(existing)) {
      if (!csvCodes.has(code)) result[code] = item;
    }
    setAll(result);

    return { added: csvRows.length, errors, headers: headerCells, mapping };
  }
  return { getAll, setAll, lookup, upsert, remove, clear, size, list, toCSV, fromCSV };
})();

// ============================================================================
// Paste parser — convert tab-separated Excel data into product rows.
// ============================================================================

const Paste = (() => {
  const ALIASES = {
    code:   ['code', '코드', '제품코드', 'itemcode', 'sku', 'arbcode', '품번', 'partno', 'partnumber'],
    name:   ['name', '제품명', 'product', '품명', 'productname', '품목', '품목명', 'description'],
    L:      ['l', 'length', '길이', 'lmm', 'l길이'],
    W:      ['w', 'width', '너비', '폭', 'wmm', 'w너비'],
    H:      ['h', 'height', '높이', 'hmm', 'h높이'],
    weight: ['weight', '중량', '무게', 'kg', 'weightkg', 'kgcarton', 'kgct', '중량kg', '무게kg', 'weightperctn', 'kgperctn'],
    qty:    ['qty', 'quantity', '수량', '주문량', 'qtyea', 'orderqty', 'pcs', 'cartons', 'ctn'],
    loadOrder: ['순번', '적재순번', '적재순서', '순서', 'order', 'loadorder', 'loadingorder', 'priority', 'seq', 'sequence'],
    zone:   ['zone', '구역', 'area', 'region', '区域', 'vùng', 'ゾーン', '위치', 'position'],
  };

  // Valid zone values accepted on import. Anything else falls back to 'any'.
  const VALID_ZONES = new Set(['any', 'nose']);

  // Map various human-friendly inputs (Korean/English/etc) to canonical zone keys.
  const ZONE_TEXT_MAP = {
    'any': 'any', '자유': 'any', 'free': 'any', '': 'any', '-': 'any', '—': 'any',
    'nose': 'nose', '안쪽': 'nose', 'back': 'nose', 'inside': 'nose', '内侧': 'nose', 'trong': 'nose', '奥': 'nose',
  };

  function normalizeZone(raw) {
    if (raw === undefined || raw === null) return 'any';
    const s = String(raw).trim().toLowerCase().replace(/^[🟦🔝🚪🔚]\s*/, '');
    if (VALID_ZONES.has(s)) return s;
    return ZONE_TEXT_MAP[s] || 'any';
  }

  function normalizeLoadOrder(raw) {
    if (raw === undefined || raw === null) return '';
    const s = String(raw).trim().toLowerCase();
    if (!s || s === '-' || s === '—' || s === 'free' || s === 'any' || s === '자유') return '';
    const n = parseInt(s.replace(/,/g, ''), 10);
    return Number.isFinite(n) && n > 0 ? n : '';
  }

  function normalize(s) {
    return String(s || '').toLowerCase().replace(/[\s_\-\(\)\\\/\.,:;]/g, '').trim();
  }

  function parse(text) {
    return text.replace(/\r/g, '')
      .split('\n')
      .filter(line => line.length > 0)
      .map(line => line.split('\t').map(c => c.trim()));
  }

  // Match a single header cell to a known field, handling:
  //  - exact alias match (e.g., "code" → code, "코드" → code)
  //  - prefix + unit suffix (e.g., "L (mm)" → "lmm" → starts with "l" → L)
  //                          (e.g., "중량 (kg)" → "중량kg" → starts with "중량" → weight)
  function findField(cellText) {
    const n = normalize(cellText);
    if (!n) return null;
    // Exact match first
    for (const [field, aliases] of Object.entries(ALIASES)) {
      if (aliases.some(a => normalize(a) === n)) return field;
    }
    // Prefix + unit suffix match
    const UNIT = /^(mm|cm|m|kg|g|ea|pcs|개|박스|set|ct|ctn|carton|t|ton|kgs)$/i;
    for (const [field, aliases] of Object.entries(ALIASES)) {
      for (const a of aliases) {
        const na = normalize(a);
        if (!na || !n.startsWith(na)) continue;
        const rest = n.slice(na.length);
        if (rest === '' || UNIT.test(rest)) return field;
      }
    }
    return null;
  }

  function detectMapping(headerRow) {
    const map = {};
    headerRow.forEach((cell, i) => {
      const field = findField(cell);
      if (field && !Object.values(map).includes(field)) map[i] = field;
    });
    return map;
  }

  function isHeaderRow(row) {
    let matches = 0;
    for (const c of row) {
      const n = normalize(c);
      if (!n) continue;
      const matched = Object.values(ALIASES).some(arr => arr.some(a => normalize(a) === n));
      if (matched) matches++;
    }
    return matches >= 2;
  }

  function rowsToProducts(rows, options = {}) {
    if (!rows || rows.length === 0) return { products: [], warnings: ['빈 데이터'], mapping: null, hadHeader: false };

    let mapping, dataRows, hadHeader = false;
    if (isHeaderRow(rows[0])) {
      mapping = detectMapping(rows[0]);
      dataRows = rows.slice(1);
      hadHeader = true;
    } else {
      // Fixed order fallback (zone optional in 8th column, order in 9th).
      mapping = { 0: 'code', 1: 'name', 2: 'L', 3: 'W', 4: 'H', 5: 'weight', 6: 'qty', 7: 'zone', 8: 'loadOrder' };
      dataRows = rows;
    }

    const products = [];
    const warnings = [];
    const masterFilled = [];
    const newToMaster = [];

    dataRows.forEach((row, ri) => {
      if (row.every(c => !c)) return; // skip blank
      const p = { code: '', name: '', L: 0, W: 0, H: 0, weight: 0, qty: 1, loadOrder: '', zone: 'any' };
      for (const [colIdx, field] of Object.entries(mapping)) {
        const val = row[+colIdx];
        if (val === undefined || val === '') continue;
        if (field === 'code' || field === 'name') p[field] = String(val).trim();
        else if (field === 'zone') p.zone = normalizeZone(val);
        else if (field === 'loadOrder') p.loadOrder = normalizeLoadOrder(val);
        else {
          const n = parseFloat(String(val).replace(/,/g, ''));
          if (!isNaN(n)) p[field] = n;
        }
      }
      // No-header paste is ambiguous once both "순번" and "구역" are optional.
      // Accept both old order (... Qty, Zone, Order) and new UI order
      // (... Qty, Order, Zone).
      if (!hadHeader && row.length >= 8) {
        const maybeOrder = normalizeLoadOrder(row[7]);
        const maybeZone = normalizeZone(row[8]);
        if (maybeOrder || maybeZone === 'nose') {
          p.loadOrder = maybeOrder;
          p.zone = maybeZone;
        }
      }
      // Default qty to 1 if not supplied
      if (!('qty' in mapping) || !p.qty) p.qty = p.qty || 1;

      // Master lookup
      const missingDims = !p.L || !p.W || !p.H;
      if (options.useMaster && p.code && missingDims) {
        const m = Master.lookup(p.code);
        if (m) {
          if (!p.name) p.name = m.name;
          if (!p.L) p.L = m.L;
          if (!p.W) p.W = m.W;
          if (!p.H) p.H = m.H;
          if (!p.weight && m.weight) p.weight = m.weight;
          masterFilled.push(p.code);
        }
      }

      if (!p.L || !p.W || !p.H) {
        warnings.push(`행 ${ri + 1}: 치수 누락 (코드: ${p.code || '—'}, 제품: ${p.name || '—'})`);
        return;
      }

      // Auto-register
      if (options.registerMaster && p.code) {
        const existing = Master.lookup(p.code);
        if (!existing) {
          Master.upsert({ code: p.code, name: p.name, L: p.L, W: p.W, H: p.H, weight: p.weight });
          newToMaster.push(p.code);
        }
      }

      products.push(p);
    });

    return { products, warnings, mapping, hadHeader, masterFilled, newToMaster };
  }

  return { parse, rowsToProducts, detectMapping, findField, isHeaderRow, ALIASES, normalizeZone, VALID_ZONES };
})();

// ============================================================================
// Encoding helpers — handle CSV files saved in CP949/EUC-KR (Korean Windows)
// or UTF-8 transparently.
// ============================================================================

function decodeWithFallback(buffer) {
  // Try UTF-8 first; if it produces many U+FFFD replacement chars or contains
  // mojibake patterns, try Korean legacy encodings.
  const utf8 = new TextDecoder('utf-8', { fatal: false }).decode(buffer);
  const utf8Bad = (utf8.match(/�/g) || []).length;
  if (utf8Bad === 0) return utf8.replace(/^﻿/, '');
  for (const enc of ['euc-kr', 'cp949', 'windows-949']) {
    try {
      const alt = new TextDecoder(enc).decode(buffer);
      const altBad = (alt.match(/�/g) || []).length;
      if (altBad < utf8Bad) return alt.replace(/^﻿/, '');
    } catch (e) { /* encoding unsupported in this browser */ }
  }
  return utf8.replace(/^﻿/, '');
}

// ============================================================================
// Main App
// ============================================================================

const App = (() => {
  let products = [];  // each: { code, name, L, W, H, weight, qty }
  let nextId = 1;
  let masterSelection = new Set();  // codes currently checked in master modal
  const STORE_CURRENT = 'cls.current.v1';
  const STORE_PRESETS = 'cls.presets.v1';
  const STORE_COLWIDTHS = 'cls.colwidths.v1';

  // Default column widths for the product input table.
  // Keys must match `data-col` attributes on <col> elements.
  const DEFAULT_COL_WIDTHS = {
    num: '40px', code: '110px', name: '200px',
    L: '60px', W: '60px', H: '60px',
    weight: '60px', qty: '64px', loadOrder: '76px', zone: '96px',
    cbm: '76px', total: '80px',
    moveup: '32px', del: '36px',
  };

  const $ = sel => document.querySelector(sel);

  const t = (key, vars) => I18N.t(key, vars);

  function updateManualLink() {
    const link = document.getElementById('manualLink');
    if (!link) return;
    link.href = `manual.html?lang=${encodeURIComponent(I18N.getLang())}`;
  }

  function initLangSelect() {
    const sel = document.getElementById('langSelect');
    sel.innerHTML = '';
    for (const { code, label } of I18N.LANGUAGES) {
      const opt = document.createElement('option');
      opt.value = code;
      opt.textContent = label;
      if (code === I18N.getLang()) opt.selected = true;
      sel.appendChild(opt);
    }
    sel.addEventListener('change', e => I18N.setLang(e.target.value));

    // Apply current dictionary to static HTML
    I18N.applyAll();
    updateManualLink();
    // Re-render dynamic content when language changes
    I18N.onChange((lang) => {
      I18N.applyAll();
      updateManualLink();
      // Sync dropdown in case the language was changed programmatically.
      const ls = document.getElementById('langSelect');
      if (ls && ls.value !== lang) ls.value = lang;
      renderTable();
      recalc();
      refreshPresetList();
      renderLegend();
      // Re-render simulation result text if a simulation is loaded
      if (lastSimulation) showContainer(getSelectedContainerIdx());
      // Re-render master modal if open
      if (!document.getElementById('masterModal').classList.contains('hidden')) renderMaster();
      // Reset pack info if simulation has not run
      if (!lastSimulation) document.getElementById('packInfo').textContent = t('sim_init_hint');
    });
  }

  function getSelectedContainerIdx() {
    const sel = document.getElementById('containerIndex');
    return sel ? (+sel.value || 0) : 0;
  }

  // -------- Fleet helpers --------
  // The user-specified mix of containers, keyed by type. e.g. {'40HC': 2, '20GP': 1}
  const FLEET_TYPES = ['20GP', '40GP', '40HC'];
  // Largest-first ordering for packing (more volume = bigger items fit first).
  const FLEET_PACK_ORDER = ['40HC', '40GP', '20GP'];

  function getFleet() {
    const out = {};
    for (const k of FLEET_TYPES) {
      const el = document.getElementById('fleet-' + k);
      out[k] = el ? Math.max(0, parseInt(el.value, 10) || 0) : 0;
    }
    return out;
  }

  function setFleet(fleet) {
    for (const k of FLEET_TYPES) {
      const el = document.getElementById('fleet-' + k);
      if (el) el.value = (fleet && fleet[k]) || 0;
    }
  }

  function totalFleetCount(fleet) {
    return (fleet['20GP'] || 0) + (fleet['40GP'] || 0) + (fleet['40HC'] || 0);
  }

  function normalizeZoneValue(zone) {
    return zone === 'nose' ? 'nose' : 'any';
  }

  function normalizeLoadOrderValue(value) {
    const n = parseInt(value, 10);
    return Number.isFinite(n) && n > 0 ? n : '';
  }

  function normalizeProductRow(p) {
    return {
      ...p,
      zone: normalizeZoneValue(p.zone),
      loadOrder: normalizeLoadOrderValue(p.loadOrder),
    };
  }

  function enforceUniqueLoadOrders(rows) {
    const used = new Set();
    const max = rows.length;
    for (const p of rows) {
      const n = normalizeLoadOrderValue(p.loadOrder);
      if (!n || n > max || used.has(n)) {
        p.loadOrder = '';
      } else {
        p.loadOrder = n;
        used.add(n);
      }
    }
    return rows;
  }

  function normalizeProductRows(rows) {
    return enforceUniqueLoadOrders(rows.map(normalizeProductRow));
  }

  function fleetUsableCbm(fleet, eff) {
    let total = 0;
    for (const k of FLEET_TYPES) {
      const c = CONTAINERS[k];
      total += (c.L * c.W * c.H) / 1e9 * (fleet[k] || 0);
    }
    return total * eff;
  }

  // Primary container type — the largest non-empty type in the fleet.
  // Used as a default for the 3D viewer before a simulation runs.
  function primaryFleetType() {
    const fleet = getFleet();
    for (const k of FLEET_PACK_ORDER) {
      if ((fleet[k] || 0) > 0) return k;
    }
    return '40HC'; // fallback when fleet is empty
  }

  function init() {
    initLangSelect();
    // Restore last session if present, otherwise seed sample.
    const restored = loadCurrent();
    if (restored && restored.products && restored.products.length) {
      products = normalizeProductRows(restored.products).map(p => ({ ...p, id: nextId++ }));
      // Restore fleet (new format), or migrate from legacy single-container format.
      if (restored.fleet) {
        setFleet(restored.fleet);
      } else if (restored.container) {
        const f = { '20GP': 0, '40GP': 0, '40HC': 0 };
        f[restored.container] = 1;
        setFleet(f);
      }
      if (restored.efficiency) document.getElementById('efficiency').value = restored.efficiency;
    } else {
      products = normalizeProductRows(SAMPLE_PRODUCTS).map(p => ({ ...p, id: nextId++ }));
    }
    renderTable();
    recalc();
    refreshPresetList();
    loadColWidths();
    initColumnResize();

    Viewer.init(document.getElementById('viewer'));
    drawCurrentContainer();

    // Events
    $('#addProduct').addEventListener('click', () => {
      products.push({ id: nextId++, code: '', name: '신규 제품', L: 500, W: 400, H: 300, weight: 0, qty: 1, loadOrder: '', zone: 'any' });
      renderTable();
      recalc();
      autoSave();
      markSimStale('products');
    });

    $('#loadSample').addEventListener('click', () => {
      products = normalizeProductRows(SAMPLE_PRODUCTS).map(p => ({ ...p, id: nextId++ }));
      renderTable();
      recalc();
      autoSave();
      markSimStale('products');
    });

    $('#clearAll').addEventListener('click', () => {
      products = [];
      renderTable();
      recalc();
      autoSave();
      markSimStale('products');
    });

    // Fleet input handlers — any change triggers redraw + recalc + autosave.
    FLEET_TYPES.forEach(k => {
      const el = document.getElementById('fleet-' + k);
      if (!el) return;
      el.addEventListener('input', () => {
        // Visual cue: highlight non-zero rows.
        el.classList.toggle('has-value', (parseInt(el.value, 10) || 0) > 0);
        drawCurrentContainer();
        recalc();
        autoSave();
        markSimStale('fleet');
      });
      // Initial highlight state
      el.classList.toggle('has-value', (parseInt(el.value, 10) || 0) > 0);
    });

    $('#fleetAuto').addEventListener('click', () => {
      // Auto-fill: compute required 40HC count from current total CBM.
      const eff = (parseFloat($('#efficiency').value) || 85) / 100;
      let totalCbm = 0;
      for (const p of products) totalCbm += cbmPerCarton(p) * p.qty;
      const c40HC = CONTAINERS['40HC'];
      const usable40HC = (c40HC.L * c40HC.W * c40HC.H) / 1e9 * eff;
      const n = totalCbm > 0 ? Math.max(1, Math.ceil(totalCbm / usable40HC)) : 1;
      setFleet({ '20GP': 0, '40GP': 0, '40HC': n });
      FLEET_TYPES.forEach(k => {
        const el = document.getElementById('fleet-' + k);
        if (el) el.classList.toggle('has-value', (parseInt(el.value, 10) || 0) > 0);
      });
      drawCurrentContainer();
      recalc();
      autoSave();
      markSimStale('fleet');
      toast(t('toast_fleet_auto', { n }));
    });

    $('#printReport').addEventListener('click', printReport);

    $('#fleetClear').addEventListener('click', () => {
      setFleet({ '20GP': 0, '40GP': 0, '40HC': 0 });
      FLEET_TYPES.forEach(k => {
        const el = document.getElementById('fleet-' + k);
        if (el) el.classList.remove('has-value');
      });
      drawCurrentContainer();
      recalc();
      autoSave();
      markSimStale('fleet');
    });

    $('#efficiency').addEventListener('input', () => {
      recalc();
      autoSave();
      markSimStale('efficiency');
    });

    $('#packBtn').addEventListener('click', runSimulation);
    $('#viewTop').addEventListener('click', () => Viewer.setView('top'));
    $('#viewSide').addEventListener('click', () => Viewer.setView('side'));
    $('#viewIso').addEventListener('click', () => Viewer.setView('iso'));

    // Preset events
    $('#savePreset').addEventListener('click', onSavePreset);
    $('#overwritePreset').addEventListener('click', onOverwritePreset);
    $('#loadPreset').addEventListener('click', onLoadPreset);
    $('#deletePreset').addEventListener('click', onDeletePreset);
    $('#presetSelect').addEventListener('dblclick', onLoadPreset);

    // Paste & Master modal triggers
    $('#openPaste').addEventListener('click', openPasteModal);
    $('#openMaster').addEventListener('click', openMasterModal);
    document.querySelectorAll('[data-close]').forEach(b =>
      b.addEventListener('click', e => closeModal(e.currentTarget.dataset.close)));
    document.querySelectorAll('.modal').forEach(m =>
      m.addEventListener('click', e => { if (e.target === m) closeModal(m.id); }));

    // Paste area handlers
    $('#pasteArea').addEventListener('input', refreshPastePreview);
    $('#pasteArea').addEventListener('paste', () => setTimeout(refreshPastePreview, 30));
    $('#pasteUseMaster').addEventListener('change', refreshPastePreview);
    $('#pasteRegisterMaster').addEventListener('change', refreshPastePreview);
    $('#pasteAppend').addEventListener('click', () => applyPaste('append'));
    $('#pasteReplace').addEventListener('click', () => applyPaste('replace'));

    // Master modal handlers
    $('#masterAdd').addEventListener('click', () => {
      Master.upsert({ code: '신규' + (Master.size() + 1), name: '', L: 500, W: 400, H: 300, weight: 0 });
      renderMaster();
      updateMasterBadge();
    });
    $('#masterSeed').addEventListener('click', () => {
      let added = 0;
      for (const p of products) {
        if (p.code && !Master.lookup(p.code)) {
          Master.upsert(p);
          added++;
        }
      }
      renderMaster();
      updateMasterBadge();
      toast(t('toast_master_seed', { n: added }));
    });
    $('#masterSearch').addEventListener('input', renderMaster);

    // Selection-related events
    $('#masterCheckAll').addEventListener('change', e => {
      const items = Master.list($('#masterSearch').value);
      if (e.target.checked) for (const it of items) masterSelection.add(it.code);
      else for (const it of items) masterSelection.delete(it.code);
      renderMaster();
    });
    $('#masterSelectAll').addEventListener('click', () => {
      const items = Master.list($('#masterSearch').value);
      for (const it of items) masterSelection.add(it.code);
      renderMaster();
    });
    $('#masterClearSel').addEventListener('click', () => {
      masterSelection.clear();
      renderMaster();
    });
    $('#masterAddToInput').addEventListener('click', () => {
      const qty = Math.max(1, parseInt($('#masterAddQty').value) || 1);
      const all = Master.getAll();
      const added = [];
      // Iterate in master storage order (= CSV import order) and pick only
      // the codes the user has selected. This keeps the order in the product
      // table consistent with the order shown in the master modal.
      for (const code of Object.keys(all)) {
        if (!masterSelection.has(code)) continue;
        const item = all[code];
        if (!item) continue;
        products.push({
          id: nextId++,
          code: item.code, name: item.name || '',
          L: item.L, W: item.W, H: item.H,
          weight: item.weight || 0, qty,
          loadOrder: '',
          zone: 'any',
        });
        added.push(item.code);
      }
      if (added.length === 0) { toast(t('toast_master_no_sel'), true); return; }
      enforceUniqueLoadOrders(products);
      masterSelection.clear();
      renderMaster();
      renderTable();
      recalc();
      autoSave();
      markSimStale('products');
      closeModal('masterModal');
      toast(t('toast_master_add_to_input', { n: added.length, qty }));
    });

    $('#exportPresetCsv').addEventListener('click', exportCurrentCSV);

    $('#masterClear').addEventListener('click', () => {
      if (Master.size() === 0) return;
      if (!confirm(t('confirm_clear_master', { n: Master.size() }))) return;
      Master.clear();
      renderMaster();
      updateMasterBadge();
      toast(t('toast_master_clear'));
    });
    $('#masterExport').addEventListener('click', () => {
      const csv = Master.toCSV();
      const blob = new Blob(['﻿' + csv], { type: 'text/csv;charset=utf-8' });
      const url = URL.createObjectURL(blob);
      const a = document.createElement('a');
      a.href = url;
      a.download = `product_master_${new Date().toISOString().slice(0, 10)}.csv`;
      a.click();
      URL.revokeObjectURL(url);
      toast(t('toast_master_csv_export'));
    });
    $('#masterImport').addEventListener('click', () => $('#masterImportFile').click());
    $('#masterImportFile').addEventListener('change', e => {
      const f = e.target.files[0];
      if (!f) return;
      const reader = new FileReader();
      reader.onload = ev => {
        const text = decodeWithFallback(ev.target.result);
        const result = Master.fromCSV(text);
        renderMaster();
        updateMasterBadge();
        if (result.added > 0) {
          let msg = t('toast_master_csv_import_ok', { n: result.added });
          if (result.errors && result.errors.length) {
            msg += t('toast_master_csv_import_warn', { n: result.errors.length });
          }
          toast(msg);
        } else {
          const head = (result.errors && result.errors[0]) || '?';
          toast(t('toast_master_csv_import_fail', { msg: head }), true);
          console.warn('[Master.fromCSV] failed', result);
        }
        e.target.value = '';
      };
      reader.onerror = () => toast(t('toast_file_read_fail'), true);
      reader.readAsArrayBuffer(f);
    });

    // Direct paste on table (option 2)
    document.addEventListener('paste', onGlobalPaste);

    // Column width reset
    $('#resetColWidths').addEventListener('click', () => {
      localStorage.removeItem(STORE_COLWIDTHS);
      applyColWidths(DEFAULT_COL_WIDTHS);
      toast('🔧 열 너비가 기본값으로 되돌아갔습니다.');
    });

    updateMasterBadge();
  }

  // -------- Column resize for product table --------

  function applyColWidths(widths) {
    Object.entries(widths).forEach(([key, w]) => {
      const col = document.querySelector(`#productTable col[data-col="${key}"]`);
      if (col) col.style.width = w;
    });
  }

  function loadColWidths() {
    let saved = {};
    try { saved = JSON.parse(localStorage.getItem(STORE_COLWIDTHS) || '{}'); }
    catch (e) {}
    applyColWidths({ ...DEFAULT_COL_WIDTHS, ...saved });
  }

  function saveColWidths() {
    const widths = {};
    document.querySelectorAll('#productTable colgroup col').forEach(c => {
      if (c.dataset.col && c.style.width) widths[c.dataset.col] = c.style.width;
    });
    try { localStorage.setItem(STORE_COLWIDTHS, JSON.stringify(widths)); }
    catch (e) {}
  }

  function initColumnResize() {
    const ths = Array.from(document.querySelectorAll('#productTable thead th'));
    const cols = Array.from(document.querySelectorAll('#productTable colgroup col'));
    // Add resizer to every header except the trailing UI-control columns
    // (move-up and delete) — those are icon-sized and shouldn't be resizable.
    ths.slice(0, -2).forEach((th, idx) => {
      if (th.querySelector('.resizer')) return;
      const r = document.createElement('span');
      r.className = 'resizer';
      r.title = '드래그해서 열 너비 조절';
      th.appendChild(r);

      r.addEventListener('mousedown', e => {
        e.preventDefault();
        e.stopPropagation();
        const col = cols[idx];
        const startX = e.pageX;
        // Snapshot starting width as a number
        const startWidth = parseInt(getComputedStyle(col).width) || th.offsetWidth;
        r.classList.add('active');
        document.body.classList.add('resizing-active');

        const onMove = ev => {
          const w = Math.max(30, startWidth + (ev.pageX - startX));
          col.style.width = w + 'px';
        };
        const onUp = () => {
          document.removeEventListener('mousemove', onMove);
          document.removeEventListener('mouseup', onUp);
          r.classList.remove('active');
          document.body.classList.remove('resizing-active');
          saveColWidths();
        };
        document.addEventListener('mousemove', onMove);
        document.addEventListener('mouseup', onUp);
      });

      // Double-click resizer to auto-fit to default width
      r.addEventListener('dblclick', e => {
        e.preventDefault();
        const key = cols[idx].dataset.col;
        if (key && DEFAULT_COL_WIDTHS[key]) {
          cols[idx].style.width = DEFAULT_COL_WIDTHS[key];
          saveColWidths();
        }
      });
    });
  }

  // -------- Modal helpers --------
  function openModal(id) { $('#' + id).classList.remove('hidden'); }
  function closeModal(id) { $('#' + id).classList.add('hidden'); }

  function openPasteModal() {
    $('#pasteArea').value = '';
    $('#pastePreview').innerHTML = `<span style="color:#8a98a7">${escapeHtml(t('paste_preview_empty'))}</span>`;
    $('#pasteAppend').disabled = true;
    $('#pasteReplace').disabled = true;
    openModal('pasteModal');
    setTimeout(() => $('#pasteArea').focus(), 100);
  }

  function openMasterModal() {
    renderMaster();
    openModal('masterModal');
  }

  // -------- Paste pipeline --------

  let lastPasteResult = null;

  function refreshPastePreview() {
    const text = $('#pasteArea').value;
    const preview = $('#pastePreview');
    if (!text.trim()) {
      preview.innerHTML = `<span style="color:#8a98a7">${escapeHtml(t('paste_preview_empty'))}</span>`;
      $('#pasteAppend').disabled = true;
      $('#pasteReplace').disabled = true;
      lastPasteResult = null;
      return;
    }

    const rows = Paste.parse(text);
    const result = Paste.rowsToProducts(rows, {
      useMaster: $('#pasteUseMaster').checked,
      registerMaster: false,
    });
    lastPasteResult = { rows, result };

    const ok = result.products.length > 0;
    $('#pasteAppend').disabled = !ok;
    $('#pasteReplace').disabled = !ok;

    const summary = t('paste_preview_summary', { n: result.products.length })
      + (result.hadHeader ? t('paste_preview_header_yes') : t('paste_preview_header_no'));
    let html = `<div class="summary">${escapeHtml(summary)}</div>`;

    if (result.masterFilled.length) {
      const list = [...new Set(result.masterFilled)].slice(0, 6).join(', ') + (result.masterFilled.length > 6 ? '...' : '');
      html += `<div style="color:#4fc3f7; font-size:11px; margin-bottom:6px;">${escapeHtml(t('paste_preview_master_filled', {
        n: result.masterFilled.length, list,
      }))}</div>`;
    }

    for (const w of result.warnings.slice(0, 5)) html += `<div class="warning">${escapeHtml(w)}</div>`;
    if (result.warnings.length > 5) html += `<div class="warning">${escapeHtml(t('paste_preview_more_warnings', { n: result.warnings.length - 5 }))}</div>`;

    if (result.products.length > 0) {
      html += `<table><thead><tr>
        <th>${escapeHtml(t('col_code'))}</th>
        <th>${escapeHtml(t('col_name'))}</th>
        <th>${escapeHtml(t('col_l'))}</th>
        <th>${escapeHtml(t('col_w'))}</th>
        <th>${escapeHtml(t('col_h'))}</th>
        <th>${escapeHtml(t('col_weight'))}</th>
        <th>${escapeHtml(t('col_qty'))}</th>
        <th>${escapeHtml(t('col_load_order'))}</th>
        <th>${escapeHtml(t('col_zone'))}</th>
      </tr></thead><tbody>`;
      for (const p of result.products.slice(0, 10)) {
        html += `<tr>
          <td style="color:#ffc107">${escapeHtml(p.code)}</td>
          <td>${escapeHtml(p.name)}</td>
          <td>${p.L}</td><td>${p.W}</td><td>${p.H}</td>
          <td>${p.weight}</td><td><strong>${p.qty}</strong></td>
          <td>${escapeHtml(loadOrderLabel(p.loadOrder))}</td>
          <td>${escapeHtml(zoneLabel(p.zone))}</td>
        </tr>`;
      }
      html += '</tbody></table>';
      if (result.products.length > 10) html += `<div style="color:#8a98a7; font-size:11px; margin-top:4px;">… +${result.products.length - 10}</div>`;
    }
    preview.innerHTML = html;
  }

  function applyPaste(mode) {
    if (!lastPasteResult || !lastPasteResult.result.products.length) return;
    // Re-run with registerMaster if checked (real apply)
    const rows = lastPasteResult.rows;
    const final = Paste.rowsToProducts(rows, {
      useMaster: $('#pasteUseMaster').checked,
      registerMaster: $('#pasteRegisterMaster').checked,
    });

    const newOnes = final.products.map(p => ({ ...normalizeProductRow(p), id: nextId++ }));
    if (mode === 'replace') {
      products = newOnes;
    } else {
      products = products.concat(newOnes);
    }
    enforceUniqueLoadOrders(products);
    renderTable();
    recalc();
    autoSave();
    markSimStale('products');
    updateMasterBadge();
    closeModal('pasteModal');
    let msg = mode === 'replace'
      ? t('toast_paste_replaced', { n: newOnes.length })
      : t('toast_paste_appended', { n: newOnes.length });
    if (final.newToMaster.length) msg += t('toast_paste_register', { n: final.newToMaster.length });
    toast(msg);
  }

  function onGlobalPaste(e) {
    // Skip when focus is in an input/textarea/select inside the page (let normal paste happen)
    const tag = (e.target && e.target.tagName || '').toLowerCase();
    if (tag === 'input' || tag === 'textarea' || tag === 'select') return;
    // Skip if a modal is open (the modal's own textarea handles it)
    if (!$('#pasteModal').classList.contains('hidden')) return;
    if (!$('#masterModal').classList.contains('hidden')) return;
    const text = (e.clipboardData || window.clipboardData).getData('text/plain') || '';
    if (!text.includes('\t')) return;
    const rows = Paste.parse(text);
    if (rows.length === 0) return;
    e.preventDefault();
    const result = Paste.rowsToProducts(rows, { useMaster: true, registerMaster: true });
    if (result.products.length === 0) {
      toast(t('toast_paste_fail'), true);
      return;
    }
    const newOnes = result.products.map(p => ({ ...normalizeProductRow(p), id: nextId++ }));
    products = products.concat(newOnes);
    enforceUniqueLoadOrders(products);
    renderTable();
    recalc();
    autoSave();
    markSimStale('products');
    updateMasterBadge();
    let msg = t('toast_paste_direct', { n: newOnes.length });
    if (result.warnings.length) msg += t('toast_paste_direct_warn', { n: result.warnings.length });
    if (result.newToMaster.length) msg += t('toast_paste_master_inc', { n: result.newToMaster.length });
    toast(msg);
  }

  // -------- Master UI --------

  function updateMasterBadge() {
    const el = $('#masterBadge');
    if (!el) return;
    const n = Master.size();
    el.textContent = n;
    el.classList.toggle('zero', n === 0);
  }

  function renderMaster() {
    const body = $('#masterBody');
    const q = $('#masterSearch').value;
    const qNorm = q.trim().toLowerCase();
    // Preserve master storage order (= CSV import order for imported items)
    // so picking lists run in the user's intended sequence.
    const items = Master.list(q);

    body.innerHTML = '';
    items.forEach(item => {
      const checked = masterSelection.has(item.code);
      const tr = document.createElement('tr');
      if (checked) tr.classList.add('selected');
      tr.innerHTML = `
        <td class="col-check"><input type="checkbox" data-msel="${escapeHtml(item.code)}" ${checked ? 'checked' : ''}></td>
        <td class="col-mcode"><input type="text" data-code="${escapeHtml(item.code)}" data-f="code" value="${escapeHtml(item.code)}"></td>
        <td><input type="text" data-code="${escapeHtml(item.code)}" data-f="name" value="${escapeHtml(item.name || '')}"></td>
        <td><input type="number" data-code="${escapeHtml(item.code)}" data-f="L" value="${item.L}"></td>
        <td><input type="number" data-code="${escapeHtml(item.code)}" data-f="W" value="${item.W}"></td>
        <td><input type="number" data-code="${escapeHtml(item.code)}" data-f="H" value="${item.H}"></td>
        <td><input type="number" data-code="${escapeHtml(item.code)}" data-f="weight" value="${item.weight || 0}"></td>
        <td><button class="btn remove" data-mdel="${escapeHtml(item.code)}" title="삭제">✕</button></td>
      `;
      body.appendChild(tr);
    });

    // Highlight search matches in code & name inputs (visual cue, doesn't change value)
    if (qNorm) {
      body.querySelectorAll('input[data-f="code"], input[data-f="name"]').forEach(inp => {
        const v = (inp.value || '').toLowerCase();
        if (v.includes(qNorm)) inp.style.boxShadow = 'inset 0 0 0 1px #ffc107';
      });
    }

    $('#masterCount').textContent = q
      ? t('master_count_search', { total: Master.size(), n: items.length })
      : t('master_count_only', { n: Master.size() });
    $('#masterSelCount').textContent = masterSelection.size;
    $('#masterAddToInput').disabled = masterSelection.size === 0;
    // Update header checkbox
    const visibleCodes = items.map(i => i.code);
    const allChecked = visibleCodes.length > 0 && visibleCodes.every(c => masterSelection.has(c));
    const noneChecked = visibleCodes.every(c => !masterSelection.has(c));
    const headCb = $('#masterCheckAll');
    if (headCb) {
      headCb.checked = allChecked;
      headCb.indeterminate = !allChecked && !noneChecked;
    }

    // Wire input edits
    body.querySelectorAll('input[data-f]').forEach(inp => {
      inp.addEventListener('change', e => {
        const oldCode = e.target.dataset.code;
        const f = e.target.dataset.f;
        const all = Master.getAll();
        const item = { ...all[oldCode] };
        if (f === 'code') {
          const newCode = e.target.value.trim();
          if (!newCode || newCode === oldCode) { e.target.value = oldCode; return; }
          delete all[oldCode];
          item.code = newCode;
          all[newCode] = item;
          if (masterSelection.has(oldCode)) {
            masterSelection.delete(oldCode);
            masterSelection.add(newCode);
          }
        } else if (f === 'name') {
          item.name = e.target.value;
          all[oldCode] = item;
        } else {
          item[f] = parseFloat(e.target.value) || 0;
          all[oldCode] = item;
        }
        Master.setAll(all);
        renderMaster();
        updateMasterBadge();
      });
    });

    // Wire checkboxes
    body.querySelectorAll('input[data-msel]').forEach(cb => {
      cb.addEventListener('change', e => {
        const code = e.target.dataset.msel;
        if (e.target.checked) masterSelection.add(code);
        else masterSelection.delete(code);
        renderMaster();
      });
    });

    // Wire delete
    body.querySelectorAll('[data-mdel]').forEach(btn => {
      btn.addEventListener('click', e => {
        const code = e.currentTarget.dataset.mdel;
        if (!confirm(t('confirm_delete_master', { code }))) return;
        Master.remove(code);
        masterSelection.delete(code);
        renderMaster();
        updateMasterBadge();
      });
    });
  }

  // -------- CSV export for current product input table --------

  function exportCurrentCSV() {
    if (products.length === 0) {
      toast(t('toast_csv_no_data'), true);
      return;
    }
    const escape = v => /[,"\n]/.test(String(v))
      ? `"${String(v).replace(/"/g, '""')}"`
      : String(v);
    // CSV headers always use Korean+units for cross-tool compatibility (the
    // import side recognizes them via the multilingual alias matcher).
    const header = '코드,제품명,L (mm),W (mm),H (mm),중량 (kg),수량,순번,구역';
    const rows = products.map(p =>
      [p.code, p.name, p.L, p.W, p.H, p.weight, p.qty, p.loadOrder || '자유', p.zone || 'any'].map(escape).join(','));
    const csv = '﻿' + header + '\n' + rows.join('\n') + '\n';
    const blob = new Blob([csv], { type: 'text/csv;charset=utf-8' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    const presetName = $('#presetSelect').value
      || (I18N.getLang() === 'ko' ? '제품목록'
        : I18N.getLang() === 'ja' ? '製品リスト'
        : I18N.getLang() === 'zh' ? '产品列表'
        : I18N.getLang() === 'vi' ? 'DanhSachSP'
        : 'products');
    const date = new Date().toISOString().slice(0, 10);
    a.href = url;
    a.download = `${presetName}_${date}.csv`;
    document.body.appendChild(a);
    a.click();
    document.body.removeChild(a);
    URL.revokeObjectURL(url);
    toast(t('toast_csv_export_ok', { n: products.length, filename: a.download }));
  }

  function cbmPerCarton(p) {
    return (p.L * p.W * p.H) / 1e9; // mm^3 -> m^3
  }

  function renderTable() {
    enforceUniqueLoadOrders(products);
    const body = $('#productBody');
    body.innerHTML = '';
    const zoneOpts = ['any', 'nose'];
    const orderMax = products.length;
    products.forEach((p, idx) => {
      const tr = document.createElement('tr');
      const color = PALETTE[idx % PALETTE.length];
      const curZone = normalizeZoneValue(p.zone);
      const curOrder = normalizeLoadOrderValue(p.loadOrder);
      const usedByOthers = new Set(products
        .filter((_, j) => j !== idx)
        .map(x => normalizeLoadOrderValue(x.loadOrder))
        .filter(Boolean));
      const orderOptions = [''].concat(Array.from({ length: orderMax }, (_, i) => i + 1));
      const orderSelect = `<select class="col-load-order" data-id="${p.id}" data-f="loadOrder">` +
        orderOptions.map(v => {
          const disabled = v !== '' && v !== curOrder && usedByOthers.has(v) ? ' disabled' : '';
          return `<option value="${v}"${v === curOrder ? ' selected' : ''}${disabled}>${v === '' ? escapeHtml(t('load_order_free')) : v}</option>`;
        }).join('') +
        `</select>`;
      const zoneSelect = `<select class="col-zone" data-id="${p.id}" data-f="zone">` +
        zoneOpts.map(z => `<option value="${z}"${z === curZone ? ' selected' : ''}>${escapeHtml(t('zone_' + z))}</option>`).join('') +
        `</select>`;
      // Up-arrow button: moves this row one slot earlier in the list.
      // Disabled on the first row since there's nowhere to go.
      const moveUpBtn = idx === 0
        ? `<button class="btn move-up" disabled title="${escapeHtml(t('move_up_title'))}">↑</button>`
        : `<button class="btn move-up" data-moveup="${p.id}" title="${escapeHtml(t('move_up_title'))}">↑</button>`;
      tr.innerHTML = `
        <td><span class="color-dot" style="background:${color}"></span>${idx + 1}</td>
        <td><input class="col-code" data-id="${p.id}" data-f="code" type="text" value="${escapeHtml(p.code || '')}" placeholder="${escapeHtml(t('placeholder_code'))}"></td>
        <td><input data-id="${p.id}" data-f="name" type="text" value="${escapeHtml(p.name)}"></td>
        <td><input data-id="${p.id}" data-f="L" type="number" min="1" step="1" value="${p.L}"></td>
        <td><input data-id="${p.id}" data-f="W" type="number" min="1" step="1" value="${p.W}"></td>
        <td><input data-id="${p.id}" data-f="H" type="number" min="1" step="1" value="${p.H}"></td>
        <td><input data-id="${p.id}" data-f="weight" type="number" min="0" step="0.1" value="${p.weight}"></td>
        <td><input class="col-qty" data-id="${p.id}" data-f="qty" type="number" min="0" step="1" value="${p.qty}"></td>
        <td>${orderSelect}</td>
        <td>${zoneSelect}</td>
        <td class="cbm-cell">${cbmPerCarton(p).toFixed(5)}</td>
        <td class="cbm-cell">${(cbmPerCarton(p) * p.qty).toFixed(4)}</td>
        <td>${moveUpBtn}</td>
        <td><button class="btn remove" data-remove="${p.id}" title="삭제">✕</button></td>
      `;
      body.appendChild(tr);
    });

    // Wire edits
    body.querySelectorAll('input').forEach(inp => {
      inp.addEventListener('input', e => {
        const id = +e.target.dataset.id;
        const f = e.target.dataset.f;
        const p = products.find(x => x.id === id);
        if (!p) return;
        if (f === 'name' || f === 'code') p[f] = e.target.value;
        else p[f] = parseFloat(e.target.value) || 0;
        // Update only the affected CBM cells without full re-render to keep focus.
        const cbmCells = e.target.closest('tr').querySelectorAll('.cbm-cell');
        cbmCells[0].textContent = cbmPerCarton(p).toFixed(5);
        cbmCells[1].textContent = (cbmPerCarton(p) * p.qty).toFixed(4);
        recalc();
        autoSave();
        markSimStale('products');
      });
    });

    // Order/zone select edits affect packing only.
    body.querySelectorAll('select.col-load-order').forEach(sel => {
      sel.addEventListener('change', e => {
        const id = +e.target.dataset.id;
        const p = products.find(x => x.id === id);
        if (!p) return;
        const nextOrder = normalizeLoadOrderValue(e.target.value);
        const duplicate = nextOrder && products.some(x =>
          x.id !== id && normalizeLoadOrderValue(x.loadOrder) === nextOrder);
        p.loadOrder = duplicate ? '' : nextOrder;
        renderTable();
        autoSave();
        markSimStale('products');
      });
    });

    body.querySelectorAll('select.col-zone').forEach(sel => {
      sel.addEventListener('change', e => {
        const id = +e.target.dataset.id;
        const p = products.find(x => x.id === id);
        if (!p) return;
        p.zone = normalizeZoneValue(e.target.value);
        autoSave();
        markSimStale('products');
      });
    });

    body.querySelectorAll('[data-remove]').forEach(btn => {
      btn.addEventListener('click', e => {
        const id = +e.currentTarget.dataset.remove;
        products = products.filter(p => p.id !== id);
        enforceUniqueLoadOrders(products);
        renderTable();
        recalc();
        autoSave();
        markSimStale('products');
      });
    });

    // Move-up: swap this row with the one directly above it.
    body.querySelectorAll('[data-moveup]').forEach(btn => {
      btn.addEventListener('click', e => {
        const id = +e.currentTarget.dataset.moveup;
        const idx = products.findIndex(p => p.id === id);
        if (idx <= 0) return; // already at top (button is disabled in this case)
        const tmp = products[idx - 1];
        products[idx - 1] = products[idx];
        products[idx] = tmp;
        renderTable();
        recalc();
        autoSave();
        markSimStale('products');
      });
    });
  }

  // Mark the current 3D simulation as stale when settings that affect packing
  // change (efficiency or fleet). A hint banner appears so the user knows to
  // hit "Run Simulation" again to see the updated layout.
  // When a setting that affects packing (fleet / efficiency / products)
  // changes AFTER a simulation has already run, automatically re-run it so the
  // 3D view and stats stay in sync. A short debounce avoids re-packing on every
  // keystroke while the user is typing a number. Settings changed BEFORE the
  // first run do nothing here (the user will press the button when ready).
  let autoRerunTimer = null;
  let simGeneration = 0;
  function markSimStale(reason) {
    if (!lastSimulation) return; // nothing to refresh yet
    clearTimeout(autoRerunTimer);
    const delay = 350;
    autoRerunTimer = setTimeout(() => { runSimulation(); }, delay);
  }

  function recalc() {
    const eff = (parseFloat($('#efficiency').value) || 85) / 100;
    let totalQty = 0, totalCbm = 0, totalWeight = 0;
    for (const p of products) {
      totalQty += p.qty;
      totalCbm += cbmPerCarton(p) * p.qty;
      totalWeight += (p.weight || 0) * p.qty;
    }

    $('#totalQty').textContent = totalQty.toLocaleString();
    $('#totalCbm').textContent = totalCbm.toFixed(3);
    $('#totalWeight').textContent = totalWeight.toFixed(1);

    // Container summary — auto-recommendation per type (informational only).
    // Highlights the largest non-empty fleet type so the user sees their primary choice.
    const fleet = getFleet();
    const sumBody = $('#containerSummary');
    sumBody.innerHTML = '';
    const primary = primaryFleetType();

    // Per-type sequential allocation — matches packFleet's actual order
    // (largest containers first: 40HC → 40GP → 20GP). Each type takes as much
    // cargo as fits in its (usable × count), and the rest cascades to the
    // next type. This gives realistic per-row Vol Qty and fill rates that
    // mirror what the 3D simulation actually does.
    const allocCbmByType = { '20GP': 0, '40GP': 0, '40HC': 0 };
    {
      let remaining = totalCbm;
      for (const k of FLEET_PACK_ORDER) {
        const ck = CONTAINERS[k];
        const usableEach = (ck.L * ck.W * ck.H) / 1e9 * eff;
        const cap = usableEach * (fleet[k] || 0);
        const alloc = Math.min(Math.max(0, remaining), cap);
        allocCbmByType[k] = alloc;
        remaining -= alloc;
      }
    }
    const avgCbmPerCarton = totalQty > 0 ? totalCbm / totalQty : 0;

    for (const key of ['20GP', '40GP', '40HC']) {
      const c = CONTAINERS[key];
      const internalCbm = (c.L * c.W * c.H) / 1e9;
      const rowUsable = internalCbm * eff;
      const fleetCount = fleet[key] || 0;
      const rowCap = rowUsable * fleetCount;
      const rowAlloc = allocCbmByType[key] || 0;

      // Vol Qty — estimated cartons going into this container type, based on
      // the user's fleet count and sequential allocation order. When count=0
      // or no allocation, shows "—".
      let volQtyText;
      if (fleetCount === 0) {
        volQtyText = '—';
      } else if (avgCbmPerCarton > 0 && rowAlloc > 0) {
        volQtyText = Math.round(rowAlloc / avgCbmPerCarton).toLocaleString();
      } else {
        volQtyText = '0';
      }

      // Wt Qty (weight-based recommendation) — kept as-is, single-type ref.
      const wtQty = totalWeight > 0 ? Math.ceil(totalWeight / c.payload) : 0;

      // 적재율 — per-container-type fill rate (this type's alloc / capacity)
      let rateText = '—';
      let effCls = 'muted';
      if (fleetCount > 0) {
        const rate = rowCap > 0 ? rowAlloc / rowCap : 0;
        rateText = (rate * 100).toFixed(1) + '%';
        effCls = rate > 1.0 ? 'efficiency-over'
              : rate >= 0.75 ? 'efficiency-high'
              : rate >= 0.5 ? 'efficiency-mid'
              : 'efficiency-low';
      }

      const fleetCls = fleetCount === 0 ? 'recommend zero' : 'recommend';
      const highlight = key === primary && totalFleetCount(fleet) > 0 ? ' style="background:#1a2535"' : '';
      sumBody.insertAdjacentHTML('beforeend', `
        <tr${highlight}>
          <td>${c.name}</td>
          <td>${rowUsable.toFixed(2)}</td>
          <td>${volQtyText}</td>
          <td>${totalWeight > 0 ? wtQty : '-'}</td>
          <td class="${fleetCls}">${fleetCount}</td>
          <td class="${effCls}">${rateText}</td>
        </tr>
      `);
    }

    // Header stat now shows the user-specified fleet total instead of an auto recommendation.
    const fleetTotal = totalFleetCount(fleet);
    $('#neededContainers').textContent = fleetTotal;

    // Update the inline fleet summary line: 📦 N대 · 가용 CBM X m³  (or warnings).
    const usable = fleetUsableCbm(fleet, eff);
    const summaryEl = $('#fleetSummary');
    if (summaryEl) {
      summaryEl.classList.remove('warn');
      if (fleetTotal === 0) {
        summaryEl.innerHTML = t('fleet_summary_empty');
        summaryEl.classList.add('warn');
      } else if (totalCbm > 0 && usable < totalCbm) {
        summaryEl.innerHTML = t('fleet_summary_short', {
          usable: usable.toFixed(2), cbm: totalCbm.toFixed(2),
        });
        summaryEl.classList.add('warn');
      } else {
        summaryEl.innerHTML = t('fleet_summary_ok', {
          n: fleetTotal, cbm: usable.toFixed(2),
        });
      }
    }
  }

  function drawCurrentContainer() {
    // Show the largest non-empty fleet type in the 3D viewer.
    const key = primaryFleetType();
    Viewer.drawContainer(CONTAINERS[key]);
    Viewer.drawCartons([]);
  }

  // Last simulation state. Each entry in `results` now carries its own container
  // because the fleet can mix container types (40HC, 40GP, 20GP).
  //   { results: [{ container, containerKey, placed, unplaced }], totalBoxes, ms, leftover }
  let lastSimulation = null;

  function runSimulation() {
    const fleet = getFleet();
    const fleetTotal = totalFleetCount(fleet);

    const boxes = [];
    products.forEach((p, idx) => {
      const color = PALETTE[idx % PALETTE.length];
      for (let i = 0; i < p.qty; i++) {
        boxes.push({
          id: `${p.id}-${i}`,
          productIndex: idx,
          name: p.name,
          L: p.L, W: p.W, H: p.H,
          weight: p.weight || 0,
          color,
          zone: normalizeZoneValue(p.zone),
          loadOrder: normalizeLoadOrderValue(p.loadOrder),
        });
      }
    });

    if (boxes.length === 0) {
      $('#packInfo').innerHTML = `<span class="warn">${escapeHtml(t('sim_no_input'))}</span>`;
      Viewer.drawCartons([]);
      renderLegend();
      $('#containerIndex').style.display = 'none';
      return;
    }

    if (fleetTotal === 0) {
      $('#packInfo').innerHTML = `<span class="warn">${t('sim_fleet_empty')}</span>`;
      Viewer.drawCartons([]);
      renderLegend();
      $('#containerIndex').style.display = 'none';
      return;
    }

    const info = $('#packInfo');
    info.innerHTML = `<span class="ok">${escapeHtml(t('sim_packing', { n: boxes.length.toLocaleString() }))}</span>`;

    // Generation token: if a newer simulation starts (e.g. the user toggles
    // an option again before this one paints), the stale run bails out so only
    // the latest settings get drawn. Prevents a race between rapid re-runs.
    const myGen = ++simGeneration;
    setTimeout(() => {
      if (myGen !== simGeneration) return; // superseded by a newer run
      const t0 = performance.now();
      const { containers: results, leftover, efficiency } = packFleet(fleet, boxes);
      const ms = Math.round(performance.now() - t0);
      const totalBoxes = boxes.length;

      lastSimulation = { results, totalBoxes, ms, leftover, efficiency };
      buildContainerPicker();
      showContainer(0);
    }, 30);
  }

  // Pack boxes into the user-specified fleet. Largest container types are
  // filled first because they tend to absorb the most volume per unit; any
  // explicitly-requested container that ends up unused is still returned as
  // an empty entry so the user sees their full fleet in the picker.
  // The loading-efficiency setting is applied per-container as a volume cap.
  function packFleet(fleet, boxes) {
    const eff = (parseFloat($('#efficiency').value) || 85) / 100;
    const out = [];
    let remaining = boxes.slice();
    for (const key of FLEET_PACK_ORDER) {
      const count = fleet[key] || 0;
      if (count === 0) continue;
      const container = CONTAINERS[key];
      for (let i = 0; i < count; i++) {
        if (remaining.length === 0) {
          out.push({ container, containerKey: key, placed: [], unplaced: [] });
          continue;
        }
        const r = packBoxes(container, remaining, { efficiency: eff });
        out.push({ container, containerKey: key, placed: r.placed, unplaced: r.unplaced });
        remaining = r.unplaced;
      }
    }
    return { containers: out, leftover: remaining, efficiency: eff };
  }

  function buildContainerPicker() {
    const sel = $('#containerIndex');
    sel.innerHTML = '';
    // Count per type so we can label as "40HC #1 of 2"
    const perTypeIdx = {};
    lastSimulation.results.forEach((r, i) => {
      const k = r.containerKey;
      perTypeIdx[k] = (perTypeIdx[k] || 0) + 1;
      const opt = document.createElement('option');
      opt.value = i;
      // Show container type + per-type index, e.g. "40ft HC #1"
      opt.textContent = `${r.container.name} #${perTypeIdx[k]}`;
      sel.appendChild(opt);
    });
    sel.style.display = lastSimulation.results.length > 1 ? 'inline-block' : 'none';
    sel.onchange = () => showContainer(+sel.value);
  }

  function showContainer(idx) {
    const sim = lastSimulation;
    const r = sim.results[idx];
    const c = r.container; // container is now per-result, not per-simulation

    // Redraw the viewer with this container's dimensions — the fleet may mix types.
    Viewer.drawContainer(c);

    const placedCbm = r.placed.reduce((s, p) => s + (p.dx * p.dy * p.dz) / 1e9, 0);
    const placedWeight = r.placed.reduce((s, p) => s + (p.box.weight || 0), 0);
    const containerCbm = (c.L * c.W * c.H) / 1e9;
    const fillRate = containerCbm > 0 ? placedCbm / containerCbm : 0;
    // Efficiency cap stats — show what the cap was vs actually placed.
    const eff = (sim.efficiency !== undefined) ? sim.efficiency : 1;
    const usableCbm = containerCbm * eff;
    const fillRateOfUsable = usableCbm > 0 ? placedCbm / usableCbm : 0;

    const usedTotal = sim.results.reduce((s, x) => s + x.placed.length, 0);
    const overflow = sim.leftover ? sim.leftover.length : 0;

    const lines = [
      `<strong>${escapeHtml(c.name)}</strong> ` + escapeHtml(t('sim_header', {
        name: '', idx: idx + 1, total: sim.results.length, ms: sim.ms
      })).replace(/^\s*/, ''),
      escapeHtml(t('sim_placed', { n: r.placed.length.toLocaleString() }))
        .replace(/(\d[\d,]*)/, '<strong>$1</strong>'),
      escapeHtml(t('sim_volume', {
        placed: placedCbm.toFixed(3),
        total: containerCbm.toFixed(2),
        rate: (fillRate * 100).toFixed(1),
      })).replace(/([\d.]+ m³)/, '<strong>$1</strong>'),
    ];
    // When efficiency < 100%, show an extra line clarifying the cap and how
    // close to the cap we got (so the user can see the setting is actually
    // affecting the simulation).
    if (eff < 0.999) {
      lines.push(t('sim_efficiency_cap', {
        eff: (eff * 100).toFixed(0),
        usable: usableCbm.toFixed(2),
        rate: (fillRateOfUsable * 100).toFixed(1),
      }));
    }
    lines.push(
      escapeHtml(t('sim_weight', {
        placed: placedWeight.toFixed(1),
        total: c.payload.toLocaleString(),
      })));
    lines.push(
      escapeHtml(t('sim_cumulative', {
        placed: usedTotal.toLocaleString(),
        total: sim.totalBoxes.toLocaleString(),
        n: sim.results.length,
      })));
    if (overflow > 0) {
      // True overflow: user-specified fleet wasn't enough for all boxes.
      const map = {};
      for (const b of sim.leftover) map[b.name] = (map[b.name] || 0) + 1;
      const list = Object.entries(map).map(([n, q]) => `${n} × ${q}`).join(', ');
      lines.push(`<span class="err">${t('sim_overflow', { n: overflow.toLocaleString() })}</span>`);
      lines.push(`<span class="err" style="font-size:11px">↳ ${escapeHtml(list)}</span>`);
    } else {
      lines.push(`<span class="ok">${escapeHtml(t('sim_all_packed', {
        n: sim.totalBoxes.toLocaleString(), total: sim.results.length, name: c.name,
      }))}</span>`);
    }
    $('#packInfo').innerHTML = lines.join('<br>');

    Viewer.drawCartons(r.placed);
    // Pass the current container's placements so the legend shows per-
    // container box counts (placed / total) instead of just totals.
    renderLegend(r.placed);
  }

  // If `placements` is provided, the legend shows "X / total" per product
  // (X = how many cartons of that product are in the currently-viewed
  // container). Without it, it shows just the input total.
  function renderLegend(placements) {
    const wrap = $('#legend');
    wrap.innerHTML = '';
    // Tally placed cartons per productIndex when sim placements are supplied.
    const placedCount = {};
    if (placements) {
      for (const p of placements) {
        const i = p.box.productIndex;
        placedCount[i] = (placedCount[i] || 0) + 1;
      }
    }
    products.forEach((p, idx) => {
      if (p.qty === 0) return;
      const color = PALETTE[idx % PALETTE.length];
      const item = document.createElement('div');
      item.className = 'legend-item';
      let label;
      if (placements) {
        const placed = placedCount[idx] || 0;
        // Highlight items that aren't in this container with a dim style.
        const dim = placed === 0 ? ' style="opacity:0.45"' : '';
        label = `<span${dim}>${escapeHtml(p.name)} (<strong>${placed.toLocaleString()}</strong> / ${p.qty.toLocaleString()})</span>`;
      } else {
        label = `${escapeHtml(p.name)} (${p.qty.toLocaleString()})`;
      }
      item.innerHTML = `<span class="legend-color" style="background:${color}"></span>${label}`;
      wrap.appendChild(item);
    });
  }

  function escapeHtml(s) {
    return String(s).replace(/[&<>"']/g, c => ({
      '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;'
    }[c]));
  }

  // -------- Save / Load (localStorage) ----------------------------------

  function currentSnapshot() {
    return {
      version: 3,
      savedAt: new Date().toISOString(),
      fleet: getFleet(),
      efficiency: parseFloat($('#efficiency').value) || 85,
      products: products.map(({ id, ...rest }) => rest),
    };
  }

  let autoSaveTimer = null;
  function autoSave() {
    clearTimeout(autoSaveTimer);
    autoSaveTimer = setTimeout(() => {
      try { localStorage.setItem(STORE_CURRENT, JSON.stringify(currentSnapshot())); }
      catch (e) { /* quota or disabled — ignore */ }
    }, 250);
  }

  function loadCurrent() {
    try {
      const raw = localStorage.getItem(STORE_CURRENT);
      return raw ? JSON.parse(raw) : null;
    } catch (e) { return null; }
  }

  function getPresets() {
    try { return JSON.parse(localStorage.getItem(STORE_PRESETS) || '{}'); }
    catch (e) { return {}; }
  }

  function setPresets(obj) {
    localStorage.setItem(STORE_PRESETS, JSON.stringify(obj));
  }

  function refreshPresetList() {
    const sel = $('#presetSelect');
    const cur = sel.value;
    const presets = getPresets();
    sel.innerHTML = '';
    const placeholder = document.createElement('option');
    placeholder.value = '';
    placeholder.textContent = t('preset_placeholder');
    sel.appendChild(placeholder);
    const names = Object.keys(presets).sort();
    for (const name of names) {
      const opt = document.createElement('option');
      opt.value = name;
      const date = presets[name].savedAt ? presets[name].savedAt.slice(0, 10) : '';
      const count = presets[name].products?.length || 0;
      opt.textContent = `${name}  (${count}품목${date ? ', ' + date : ''})`;
      sel.appendChild(opt);
    }
    if (cur && names.includes(cur)) sel.value = cur;
  }

  function applySnapshot(snap) {
    if (!snap || !Array.isArray(snap.products)) return false;
    products = normalizeProductRows(snap.products).map(p => ({ ...p, id: nextId++ }));
    // Restore fleet (new) or migrate from legacy single-container preset.
    if (snap.fleet) {
      setFleet(snap.fleet);
    } else if (snap.container) {
      const f = { '20GP': 0, '40GP': 0, '40HC': 0 };
      f[snap.container] = 1;
      setFleet(f);
    }
    // Refresh "has-value" highlighting on the fleet inputs.
    FLEET_TYPES.forEach(k => {
      const el = document.getElementById('fleet-' + k);
      if (el) el.classList.toggle('has-value', (parseInt(el.value, 10) || 0) > 0);
    });
    if (snap.efficiency) $('#efficiency').value = snap.efficiency;
    renderTable();
    drawCurrentContainer();
    recalc();
    autoSave();
    return true;
  }

  function onSavePreset() {
    const name = (prompt(t('prompt_save_name')) || '').trim();
    if (!name) return;
    const presets = getPresets();
    if (presets[name]) {
      if (!confirm(t('confirm_overwrite_preset', { name }))) return;
    }
    presets[name] = currentSnapshot();
    setPresets(presets);
    refreshPresetList();
    $('#presetSelect').value = name;
    toast(t('toast_saved', { name }));
  }

  function onOverwritePreset() {
    const name = $('#presetSelect').value;
    if (!name) { toast(t('toast_no_preset_to_overwrite'), true); return; }
    if (!confirm(t('confirm_overwrite_current', { name }))) return;
    const presets = getPresets();
    presets[name] = currentSnapshot();
    setPresets(presets);
    refreshPresetList();
    toast(t('toast_overwritten', { name }));
  }

  function onLoadPreset() {
    const name = $('#presetSelect').value;
    if (!name) { toast(t('toast_no_preset_to_load'), true); return; }
    const presets = getPresets();
    if (!presets[name]) { toast(t('toast_preset_not_found'), true); return; }
    if (!applySnapshot(presets[name])) { toast(t('toast_preset_bad_format'), true); return; }
    toast(t('toast_loaded', { name, n: products.length }));
  }

  function onDeletePreset() {
    const name = $('#presetSelect').value;
    if (!name) { toast(t('toast_no_preset_to_delete'), true); return; }
    if (!confirm(t('confirm_delete_preset', { name }))) return;
    const presets = getPresets();
    delete presets[name];
    setPresets(presets);
    refreshPresetList();
    toast(t('toast_deleted', { name }));
  }

  // -------- Print / customer report ----------------------------------

  // Entry point — populate the hidden #reportPrint section and open the
  // browser's print dialog (which doubles as "save as PDF" on all OSes).
  function printReport() {
    if (products.length === 0) {
      toast(t('toast_print_no_products'), true);
      return;
    }
    toast(t('toast_print_preparing'));
    // Defer so the toast renders before the synchronous capture work below.
    setTimeout(() => {
      buildReport();
      // A short delay lets the browser apply the freshly-set innerHTML
      // (including embedded images) before launching the print dialog.
      setTimeout(() => window.print(), 50);
    }, 30);
  }

  // Build the entire report HTML and stuff it into #reportPrint.
  // Pulls from products[], the fleet inputs, the efficiency, and
  // lastSimulation (if a simulation has been run).
  function buildReport() {
    const section = document.getElementById('reportPrint');
    const eff = (parseFloat($('#efficiency').value) || 85) / 100;
    const fleet = getFleet();
    const fleetTotal = totalFleetCount(fleet);

    // Aggregate product totals
    let totalQty = 0, totalCbm = 0, totalWeight = 0;
    for (const p of products) {
      totalQty += p.qty;
      totalCbm += cbmPerCarton(p) * p.qty;
      totalWeight += (p.weight || 0) * p.qty;
    }

    const now = new Date();
    const dateStr = now.toISOString().slice(0, 10);
    const timeStr = now.toTimeString().slice(0, 5);

    // Capture screenshots for every container in the simulation. We cycle the
    // 3D viewer through each container, snapshot it, then restore the user's
    // selected view at the end so the on-screen state isn't disturbed.
    const screenshots = [];
    if (lastSimulation && lastSimulation.results.length > 0) {
      const restoreIdx = getSelectedContainerIdx();
      for (const r of lastSimulation.results) {
        const img = Viewer.captureContainer(r.container, r.placed);
        screenshots.push(img);
      }
      // Restore the user's selected container in the viewer.
      const restore = lastSimulation.results[restoreIdx] || lastSimulation.results[0];
      if (restore) {
        Viewer.drawContainer(restore.container);
        Viewer.drawCartons(restore.placed);
      }
    }

    const esc = escapeHtml;
    const fleetUsable = fleetUsableCbm(fleet, eff);
    const fleetCoverage = fleetUsable > 0 ? (totalCbm / fleetUsable) : 0;

    // ---------- Section 1: Summary ----------
    const fleetParts = [];
    for (const k of FLEET_PACK_ORDER) {
      const n = fleet[k] || 0;
      if (n > 0) fleetParts.push(`${CONTAINERS[k].name} × ${n}`);
    }
    const fleetDesc = fleetParts.length > 0 ? fleetParts.join(', ') : '—';

    const summaryHtml = `
      <h2>${esc(t('report_sec_summary'))}</h2>
      <table class="rp-summary-table">
        <tr><th>${esc(t('report_label_qty'))}</th><td class="num">${totalQty.toLocaleString()} cartons</td></tr>
        <tr><th>${esc(t('report_label_skus'))}</th><td class="num">${products.length}</td></tr>
        <tr><th>${esc(t('report_label_cbm'))}</th><td class="num">${totalCbm.toFixed(3)} m³</td></tr>
        <tr><th>${esc(t('report_label_weight'))}</th><td class="num">${totalWeight.toFixed(1)} kg</td></tr>
        <tr><th>${esc(t('report_label_eff'))}</th><td class="num">${(eff * 100).toFixed(0)} %</td></tr>
        <tr><th>${esc(t('report_label_fleet'))}</th><td>${esc(fleetDesc)} (${fleetTotal} ${esc(t('unit_containers'))})</td></tr>
        <tr><th>${esc(t('report_label_fleet_cbm'))}</th><td class="num">${fleetUsable.toFixed(2)} m³</td></tr>
        <tr><th>${esc(t('report_label_coverage'))}</th><td class="num">${fleetUsable > 0 ? (fleetCoverage * 100).toFixed(1) + ' %' : '—'}</td></tr>
      </table>
    `;

    // ---------- Section 2: Fleet ----------
    let fleetRows = '';
    let fleetUsableSum = 0;
    for (const k of ['20GP', '40GP', '40HC']) {
      const c = CONTAINERS[k];
      const internalCbm = (c.L * c.W * c.H) / 1e9;
      const usable = internalCbm * eff;
      const cnt = fleet[k] || 0;
      const usableTotal = usable * cnt;
      fleetUsableSum += usableTotal;
      fleetRows += `
        <tr>
          <td>${esc(c.name)}</td>
          <td class="num">${cnt}</td>
          <td class="num">${usable.toFixed(2)}</td>
          <td class="num">${cnt > 0 ? usableTotal.toFixed(2) : '—'}</td>
        </tr>`;
    }
    const fleetHtml = `
      <h2>${esc(t('report_sec_fleet'))}</h2>
      <table>
        <thead>
          <tr>
            <th>Container</th>
            <th class="num">${esc(t('report_col_count'))}</th>
            <th class="num">${esc(t('report_col_usable'))}</th>
            <th class="num">${esc(t('report_col_usable_total'))}</th>
          </tr>
        </thead>
        <tbody>${fleetRows}</tbody>
        <tfoot>
          <tr>
            <th>${esc(t('report_col_subtotal'))}</th>
            <th class="num">${fleetTotal}</th>
            <th></th>
            <th class="num">${fleetUsableSum.toFixed(2)} m³</th>
          </tr>
        </tfoot>
      </table>
    `;

    // ---------- Section 3: Product list ----------
    let prodRows = '';
    products.forEach((p, i) => {
      const cbm = cbmPerCarton(p);
      const totalCbmRow = cbm * p.qty;
      prodRows += `
        <tr>
          <td class="center">${i + 1}</td>
          <td>${esc(p.code || '')}</td>
          <td>${esc(p.name || '')}</td>
          <td class="num">${p.L} × ${p.W} × ${p.H}</td>
          <td class="num">${(p.weight || 0).toFixed(1)}</td>
          <td class="num">${p.qty.toLocaleString()}</td>
          <td class="center">${esc(loadOrderLabel(p.loadOrder))}</td>
          <td class="num">${cbm.toFixed(5)}</td>
          <td class="num">${totalCbmRow.toFixed(4)}</td>
          <td class="center">${esc(zoneLabel(p.zone))}</td>
        </tr>`;
    });
    const productsHtml = `
      <h2>${esc(t('report_sec_products'))}</h2>
      <table>
        <thead>
          <tr>
            <th class="center">${esc(t('report_col_no'))}</th>
            <th>${esc(t('col_code'))}</th>
            <th>${esc(t('col_name'))}</th>
            <th class="num">${esc(t('report_col_dim'))}</th>
            <th class="num">${esc(t('col_weight'))}</th>
            <th class="num">${esc(t('col_qty'))}</th>
            <th class="center">${esc(t('col_load_order'))}</th>
            <th class="num">${esc(t('report_col_cbm_unit'))}</th>
            <th class="num">${esc(t('report_col_total_cbm'))}</th>
            <th class="center">${esc(t('col_zone'))}</th>
          </tr>
        </thead>
        <tbody>${prodRows}</tbody>
        <tfoot>
          <tr>
            <th colspan="5" style="text-align:right">${esc(t('report_col_subtotal'))}</th>
            <th class="num">${totalQty.toLocaleString()}</th>
            <th></th>
            <th></th>
            <th class="num">${totalCbm.toFixed(3)}</th>
            <th></th>
          </tr>
        </tfoot>
      </table>
    `;

    // ---------- Section 4: Per-container loading (sim only) ----------
    let loadedHtml = '';
    let overflowHtml = '';
    if (lastSimulation && lastSimulation.results.length > 0) {
      const sim = lastSimulation;
      const perTypeIdx = {};
      const blocks = sim.results.map((r, i) => {
        const c = r.container;
        const k = r.containerKey;
        perTypeIdx[k] = (perTypeIdx[k] || 0) + 1;
        const placedCbm = r.placed.reduce((s, p) => s + (p.dx * p.dy * p.dz) / 1e9, 0);
        const placedWeight = r.placed.reduce((s, p) => s + (p.box.weight || 0), 0);
        const containerCbm = (c.L * c.W * c.H) / 1e9;
        const fillRate = containerCbm > 0 ? placedCbm / containerCbm : 0;
        const usableCbm = containerCbm * eff;
        const fillUsable = usableCbm > 0 ? placedCbm / usableCbm : 0;

        // Per-product breakdown for THIS container
        const counts = {};
        for (const p of r.placed) {
          const nm = p.box.name || '—';
          counts[nm] = (counts[nm] || 0) + 1;
        }
        const contentRows = Object.entries(counts)
          .sort((a, b) => b[1] - a[1])
          .map(([nm, q]) => `<tr><td>${esc(nm)}</td><td class="num">${q.toLocaleString()}</td></tr>`)
          .join('');

        const imgTag = screenshots[i]
          ? `<div class="rp-3d"><img src="${screenshots[i]}" alt="3D"><div class="rp-3d-caption">${esc(t('report_3d_caption'))} — ${esc(c.name)} #${perTypeIdx[k]}</div></div>`
          : '';

        return `
          <div class="rp-container">
            <h3>4.${i + 1} ${esc(c.name)} #${perTypeIdx[k]}</h3>
            <div class="rp-container-meta">
              <div><strong>${esc(t('report_container_loaded'))}:</strong> ${r.placed.length.toLocaleString()} cartons</div>
              <div><strong>${esc(t('report_container_volume'))}:</strong> ${placedCbm.toFixed(3)} / ${containerCbm.toFixed(2)} m³</div>
              <div><strong>${esc(t('report_container_fill'))}:</strong> ${(fillRate * 100).toFixed(1)} %</div>
              <div><strong>${esc(t('report_container_fill_usable'))}:</strong> ${(fillUsable * 100).toFixed(1)} %</div>
              <div><strong>${esc(t('report_container_weight'))}:</strong> ${placedWeight.toFixed(1)} / ${c.payload.toLocaleString()} kg</div>
              <div>&nbsp;</div>
            </div>
            ${imgTag}
            ${contentRows
              ? `<h4 style="font-size:10pt;margin:6px 0 3px 0;color:#444">${esc(t('report_container_content'))}</h4>
                 <table><thead><tr><th>${esc(t('col_name'))}</th><th class="num">${esc(t('col_qty'))}</th></tr></thead><tbody>${contentRows}</tbody></table>`
              : ''}
          </div>`;
      }).join('');
      loadedHtml = `<h2 class="page-break">${esc(t('report_sec_loaded'))}</h2>${blocks}`;

      // Overflow section (boxes that did not fit anywhere)
      if (sim.leftover && sim.leftover.length > 0) {
        const oCounts = {};
        for (const b of sim.leftover) {
          const nm = b.name || '—';
          oCounts[nm] = (oCounts[nm] || 0) + 1;
        }
        const oRows = Object.entries(oCounts)
          .sort((a, b) => b[1] - a[1])
          .map(([nm, q]) => `<tr><td>${esc(nm)}</td><td class="num">${q.toLocaleString()}</td></tr>`)
          .join('');
        overflowHtml = `
          <h2>${esc(t('report_sec_overflow'))}</h2>
          <p class="rp-err">${esc(t('report_overflow_intro'))}</p>
          <table><thead><tr><th>${esc(t('col_name'))}</th><th class="num">${esc(t('col_qty'))}</th></tr></thead><tbody>${oRows}</tbody></table>`;
      }
    } else {
      loadedHtml = `<h2>${esc(t('report_sec_loaded'))}</h2><p class="rp-warn">${esc(t('report_no_sim'))}</p>`;
    }

    // ---------- Assemble ----------
    section.innerHTML = `
      <div class="rp-header">
        <div class="rp-title">${esc(t('report_title'))}</div>
        ${t('report_subtitle') ? `<div class="rp-subtitle">${esc(t('report_subtitle'))}</div>` : ''}
        <div class="rp-meta">
          <span>${esc(t('report_generated'))}: ${dateStr} ${timeStr}</span>
          <span></span>
        </div>
      </div>
      ${summaryHtml}
      ${fleetHtml}
      ${productsHtml}
      ${loadedHtml}
      ${overflowHtml}
      <div class="rp-footer">${esc(t('report_footer'))}</div>
    `;
  }

  // Translate a zone key into a short user-facing label for the report.
  function zoneLabel(zone) {
    const key = 'zone_' + normalizeZoneValue(zone);
    const label = t(key);
    // Strip leading emoji to keep the print column compact
    return label.replace(/^[🟦🔝🚪🔚—]\s*/, '');
  }

  function loadOrderLabel(value) {
    const n = normalizeLoadOrderValue(value);
    return n || t('load_order_free');
  }

  // -------- Toast --------

  let toastTimer = null;
  function toast(message, isError = false) {
    const el = document.getElementById('toast');
    el.textContent = message;
    el.className = 'toast show' + (isError ? ' error' : '');
    clearTimeout(toastTimer);
    toastTimer = setTimeout(() => { el.className = 'toast' + (isError ? ' error' : ''); }, 2200);
  }

  return { init };
})();

document.addEventListener('DOMContentLoaded', App.init);
