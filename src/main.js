import './style.css'
import { Virtualizer, observeElementRect, observeElementOffset, elementScroll } from '@tanstack/virtual-core'
import { get, post } from './request.js'

/* ✅ 把你 body 里的 HTML 原样塞进来 */
document.getElementById('app').innerHTML = `
<div class="wrap">
  <div id="loading-bar"></div>
  <div id="scroll">
    <div class="thead" id="thead"></div>
    <div id="inner"></div>
  </div>
</div>
<div id="toast"></div>
<div id="ctx-menu">
  <div class="ctx-item" data-action="copy">复制</div>
  <div class="ctx-item" data-action="noStock">无货</div>
  <div class="ctx-item" data-action="noStockPub">无货公海</div>
  <div class="ctx-item" data-action="batchReply">批量回复</div>
  <div class="ctx-item" data-action="assign">分配他人</div>
  <div class="ctx-sep"></div>
  <div class="ctx-item ctx-danger" data-action="delete">删除询价</div>
</div>
`

/* ============================ 常量（来自 PanelTableCanvas） ============================ */

const BillPage = "CaiGouBJ_ChaHuo";
const NO_SELECT_FIELDS = ["备注"];
let colorList = [];
const RENDER_MAP = {
  Note: "Note",
  HuiFu: "HuiFu",
  PartNo: "PartNo",
  ImpValueF: "ImpValueF",
};

/* ============================ 请求（搬自 PanelTableCanvas） ============================ */

/**
 * fetchColHeaders — 请求列配置
 * 对应原组件 fetchColHeaders({ url, BillPage, noFirst, needEdit, noSelect, editors })
 */
async function fetchColHeaders({
  url = "",
  BillPage,
  noFirst = [],
  needEdit = [],
  noSelect = [],
  editors = {},
} = {}) {
  const language = localStorage.getItem("language");

  let r;
  try {
    r = await get(`/sys_cell_page/List?MenuNo=${BillPage}&type=2`, {}, {}, "erp");
  } catch {
    return null;
  }

  if (!r?.rows?.length) return null;

  // 移除第一列
  noFirst.forEach((n) => {
    if (url?.includes(n)) {
      r.rows = r.rows.splice(1);
    }
  });

  let columns = r.rows.filter((l) => l.isselect !== "0" && l.ismust !== "-1");

  if (BillPage.includes("Stock_") && url?.includes("sys_page_")) {
    if (BillPage !== "Stock_VenQuote") {
      columns.shift();
    }
  }

  const colHeaders = columns.map((item) => {
    if (language === "zh") return item.describe;
    if (language === "en") return item.describeEN;
    return item.describeRuss;
  });

  // 更新可编辑列
  if (url === "/sys_cell_bill/List?MenuNo=VenQuote&type=1") {
    const filterColumns = columns.filter((l) => l.isedit === "1");
    needEdit = filterColumns.map((f) => f.describe);
  } else if (BillPage === "CaiGouBJ_ChaHuo") {
    const filterColumns = columns.filter((l) => l.isedit === "0");
    needEdit = filterColumns.map((f) => f.describe);
  }

  const newColumns = columns.map((item) => ({
    field: item.cellname,
    title: item.describe,
    width: Number(item.width),
    formatter: item.formatter,
    describe: item.describe,
    isMustCellName: item.isMustCellName,
    renderer: RENDER_MAP[item.cellname] || "NormalRenderer",
    readOnly: needEdit?.indexOf(item.describe) !== -1 ? false : item.isedit !== "1",
    editor: editors[item.cellname],
    disableHeaderSelect: noSelect?.indexOf(item.describe) !== -1,
    sort: false,
    showSort: true,
  }));

  // 添加复选框列
  newColumns.unshift({
    field: "isCheck",
    title: "",
    headerType: "checkbox",
    cellType: "checkbox",
    checked: false,
    disable: false,
    readOnly: true,
    width: 45,
  });

  return {
    colHeaders: [``, ...colHeaders],
    columns: newColumns,
  };
}

/**
 * fetchTableData — 请求表格数据 + 后端排序
 * 对应 ErpPanel.getData: POST /CaiGouBJ/GetList + /CaiGouBJ/GetCount
 */
async function fetchTableData({
  pagination = { current: 1, pageSize: 50 },
  sortField = null,
  sortOrder = null,
} = {}) {
  const fd = new FormData();
  fd.append("pageindex", String(pagination.current));
  fd.append("pagesize", String(pagination.pageSize));
  fd.append("sort", sortField || "id");
  fd.append("order", sortOrder || "desc");
  fd.append("Type", "ChaHuo");
  fd.append("BillPage", "CaiGouBJ");

  try {
    // 第一页时同时拉 total
    if (pagination.current === 1) {
      post("/CaiGouBJ/GetCount", fd).then((res) => {
        totalFromApi = res.total;
      });
    }

    const json = await post("/CaiGouBJ/GetList", fd);
    const nRows = (json.rows || []).map((item) => ({
      ...item,
      HuiFu: item.HuiFu === "1" ? "已回复" : "未回复",
      edit: false,
      isCheck: false,
    }));

    return {
      data: nRows,
      total: json.total || json.records || 0,
    };
  } catch {
    return { data: [], total: 0 };
  }
}

/* ============================ 前端常量 & 后备数据 ============================ */

const SUPPLIERS  = ['深圳华强','北京中发','上海润芯','广州广芯','杭州芯源'];
const BRANDS     = ['TI','ADI','ST','NXP','Infineon','Microchip','ON','Vishay'];
const PACKS      = ['SOP-8','QFN-16','BGA-64','TSSOP-20','QFP-32','SOT-23','DFN-10'];
const DCS        = ['22+','23+','24+','21+','20+'];
const CURRENCIES = ['RMB','USD','EUR','HKD'];
const NEWOLDS    = ['全新','翻新','旧货'];
const HUIFUS     = ['未回复','已回复','待确认'];

function makeMockData(n = 500) {
  return Array.from({ length: n }, (_, i) => ({
    id:          String(i + 1).padStart(4, '0'),
    BillID:      `BJ${String(i + 1).padStart(6, '0')}`,
    PartNo:      `PN-${String.fromCharCode(65 + i % 26)}${String(i * 7 % 1000).padStart(3, '0')}`,
    Brand:       BRANDS[i % BRANDS.length],
    Pack:        PACKS[i % PACKS.length],
    DC:          DCS[i % DCS.length],
    Qty:         Math.floor(Math.random() * 10000) + 1,
    Supplier:    SUPPLIERS[i % SUPPLIERS.length],
    ShortName:   `供${String(i % 100).padStart(2, '0')}`,
    TargetPrice: (Math.random() * 100 + 0.5).toFixed(2),
    CurrencyID:  CURRENCIES[i % CURRENCIES.length],
    LT:          `${Math.floor(Math.random() * 8) + 1}周`,
    NewOld:      NEWOLDS[i % NEWOLDS.length],
    Note:        i % 7 === 0 ? '需确认' : '',
    HuiFu:       HUIFUS[i % HUIFUS.length],
    CreateTime:  `202${2 + i % 3}-${String(i % 12 + 1).padStart(2, '0')}-${String(i % 28 + 1).padStart(2, '0')}`,
    UserName:    `用户${String(i % 50).padStart(2, '0')}`,
  }));
}

/* ============================ 默认列（API 失败时使用） ============================ */

const DEFAULT_COLS = [
  { k: 'PartNo',      l: '物料编码', w: 140, s: 1 },
  { k: 'Brand',       l: '品牌',     w: 100, s: 1 },
  { k: 'Pack',        l: '封装',     w: 100, s: 1 },
  { k: 'DC',          l: '批次',     w: 80,  s: 1 },
  { k: 'Qty',         l: '数量',     w: 90 },
  { k: 'Supplier',    l: '供应商',   w: 130, s: 1 },
  { k: 'ShortName',   l: '简称',     w: 100, s: 1 },
  { k: 'TargetPrice', l: '目标价',   w: 100 },
  { k: 'CurrencyID',  l: '币种',     w: 80 },
  { k: 'LT',          l: '交期',     w: 80 },
  { k: 'NewOld',      l: '新旧程度', w: 100 },
  { k: 'Note',        l: '备注',     w: 150 },
  { k: 'HuiFu',       l: '回复状态', w: 90 },
  { k: 'CreateTime',  l: '创建时间', w: 110, s: 1 },
  { k: '_act',        l: '操作',     w: 80 },
];

function toUIOColumns(apiCols) {
  return apiCols
    .filter(c => c.field !== 'isCheck') // 去掉 checkbox 列（vanilla 不需要）
    .map(c => ({
      k: c.field,
      l: c.title,
      w: c.width || 100,
      s: c.showSort ? 1 : 0,
    }))
    .concat({ k: '_act', l: '操作', w: 80 });
}

/* ============================ 运行时状态 ============================ */

let COLS = DEFAULT_COLS;
let ALL = [];
let rows = [];
let totalFromApi = 0;
let sortK = '', sortD = false;
let tableParams = {
  pagination: { current: 1, pageSize: 500 },
  sortField: null,
  sortOrder: null,
};
let editingCell = null; // { rowIdx, colKey } | null
const editedRows = new Map(); // rowId -> changedFields
let selRange = null; // { r1, c1, r2, c2 } — 框选范围（col 是 COLS 索引）
let selDragging = false;
let selDragMoved = false;
let selCheckMode = false; // 从复选框列拖拽 → 多选
const selectedRows = new Set(); // row id

/* ============================ 过滤 & 排序 ============================ */

function applyFilter() {
  rows = ALL;
}

let sortVersion = 0;

async function sortAndFetch() {
  tableParams.sortField = sortK || null;
  tableParams.sortOrder = sortK ? (sortD ? 'desc' : 'asc') : null;
  tableParams.pagination.current = 1;

  // 乐观更新：立即刷新表头箭头，不等待 API
  renderHead();

  const version = ++sortVersion;
  document.getElementById('loading-bar').classList.add('on');

  const { data } = await fetchTableData({
    pagination: tableParams.pagination,
    sortField: tableParams.sortField,
    sortOrder: tableParams.sortOrder,
  });

  // 忽略过期请求（快速点击时）
  if (version !== sortVersion) return;

  document.getElementById('loading-bar').classList.remove('on');

  if (data.length) {
    ALL = data;
  }

  // 只重渲染行，跳过表头（列没变）
  applyFilter();
  virt.options.count = rows.length;
  virt._willUpdate();
  renderRows();
  updateSelOverlay();
}

/* ============================ 渲染 ============================ */

function renderHead() {
  document.getElementById('thead').innerHTML = COLS.map((c, i) => {
    if (c.k === '_sel') {
      const allSel = rows.length > 0 && rows.every(r => selectedRows.has(r.id));
      return `<div class="th" style="width:${c.w}px"><input type="checkbox" class="sel-all" data-all="${allSel ? '1' : '0'}"><div class="rh" data-ci="${i}"></div></div>`;
    }
    const cls = c.k === sortK ? (sortD ? 'desc' : 'asc') : '';
    const arr = c.s ? (c.k === sortK ? (sortD ? ' ▼' : ' ▲') : '') : '';
    return `<div class="th ${cls}" style="width:${c.w}px"
      ${c.s ? `data-s="${c.k}"` : ''}>${c.l}${arr}<div class="rh" data-ci="${i}"></div></div>`;
  }).join('');

  // 处理全选复选框的半选状态
  const cb = document.querySelector('.sel-all');
  if (cb) {
    const someSel = rows.some(r => selectedRows.has(r.id));
    const allSel = rows.length > 0 && rows.every(r => selectedRows.has(r.id));
    cb.checked = allSel;
    cb.indeterminate = someSel && !allSel;
  }
}

function cell(k, r, rowIdx) {
  const v = r[k] ?? '';
  if (k === '_idx') return `<span class="dim">${rowIdx + 1}</span>`;
  if (k === '_sel') return `<input type="checkbox" class="sel-row" data-id="${r.id}" ${selectedRows.has(r.id) ? 'checked' : ''}>`;
  if (k === 'id') return `<span class="dim">#${r.id}</span>`;
  if (k === '_act') return `<button class="ed" data-id="${r.id}">编辑</button>`;

  // edit mode
  if (editingCell && editingCell.rowIdx === rowIdx && editingCell.colKey === k) {
    return `<input class="ci" value="${escapeHtml(String(v))}" data-col="${k}" data-row="${rowIdx}" />`;
  }

  if (k === 'PartNo') {
    const dimmed = r.isChaHuo !== '1' ? ' pn-dim' : '';
    return `<span class="pn${dimmed}">${r.PartNo}</span>`;
  }
  if (k === 'Qty') return `<span>${Number(r.Qty).toLocaleString()}</span>`;
  if (k === 'TargetPrice') return `<span>${r.CurrencyID === 'USD' ? '$' : '¥'}${r.TargetPrice}</span>`;
  if (k === 'CurrencyID') return `<span>${r.CurrencyID}</span>`;
  if (k === 'ImpValueF') {
    const m = colorList.find(item => item.Name === v);
    const bg = m ? m.Color : 'transparent';
    const c = m ? '#fff' : 'var(--dim)';
    return `<span class="iv-badge" style="background:${bg};color:${c}">${v}</span>`;
  }
  if (k === 'NewOld') return `<span>${r.NewOld}</span>`;
  if (k === 'Note') return `<button class="note-btn${v ? ' has-note' : ''}" data-id="${r.id}">备注</button>`;
  if (k === 'HuiFu') {
    const c = r.HuiFu === '已回复' ? '#4a90d9' : r.HuiFu === '待确认' ? '#f0c060' : 'var(--dim)';
    return `<span style="color:${c}">${r.HuiFu}</span>`;
  }
  return `<span>${escapeHtml(String(v))}</span>`;
}

function escapeHtml(s) {
  const d = document.createElement('div');
  d.textContent = s;
  return d.innerHTML;
}

/* ============================ 虚拟滚动 ============================ */

const scrollEl = document.getElementById('scroll');
const innerEl  = document.getElementById('inner');
const ROW_H = 36;

/* 框选覆盖层 */
const selOverlay = document.createElement('div');
selOverlay.id = 'sel-overlay';
innerEl.appendChild(selOverlay);

/* 右键菜单 */
const ctxMenu = document.getElementById('ctx-menu');
let ctxMenuRowIdx = -1;

const virt = new Virtualizer({
  count: rows.length,
  estimateSize: () => ROW_H,
  overscan: 10,
  getScrollElement: () => scrollEl,
  observeElementRect,
  observeElementOffset,
  scrollToFn: elementScroll,
  onChange() {
    cancelAnimationFrame(virt._raf);
    virt._raf = requestAnimationFrame(() => renderRows());
  },
});


function renderRows() {
  let selStart, selEnd;
  if (editingCell) {
    const oldInp = innerEl.querySelector('.ci');
    if (oldInp && document.activeElement === oldInp) {
      selStart = oldInp.selectionStart;
      selEnd = oldInp.selectionEnd;
    }
  }

  const items = virt.getVirtualItems();
  innerEl.style.height = virt.getTotalSize() + 'px';
  innerEl.innerHTML = items.map(({ index, start, size }) => {
    const r = rows[index];
    if (!r) return '';
    const inEditRow = editingCell && editingCell.rowIdx === index;
    const cells = COLS.map(c => {
      const editable = c.k !== '_act' && c.k !== 'id' && c.k !== '_idx' && c.k !== '_sel' && c.k !== 'Note';
      const editing = inEditRow && editingCell.colKey === c.k;
      const cls = editing ? ' cell-editing' : inEditRow && editable ? ' cell-edit' : '';
      return `<div class="cell${cls}" style="width:${c.w}px" data-col="${c.k}" data-row="${index}">${cell(c.k, r, index)}</div>`;
    }).join('');
    const rowCls = ['row', index % 2 ? 'odd' : 'even', inEditRow ? 'row-editing' : ''].filter(Boolean).join(' ');
    return `<div class="${rowCls}" style="top:${start}px;height:${size}px">${cells}</div>`;
  }).join('');

  // innerHTML 会清掉 overlay，重新挂回并更新位置
  innerEl.appendChild(selOverlay);
  updateSelOverlay();

  if (editingCell) {
    const inp = innerEl.querySelector('.ci');
    if (inp) {
      inp.focus();
      if (selStart !== undefined) {
        inp.setSelectionRange(selStart, selEnd);
      } else {
        inp.select();
      }
    }
  }
}

function colLeft(colIdx) {
  let x = 0;
  for (let i = 0; i < colIdx; i++) x += COLS[i].w;
  return x;
}

function updateSelOverlay() {
  if (!selRange) {
    selOverlay.style.display = 'none';
    return;
  }
  const r1 = Math.min(selRange.r1, selRange.r2);
  const r2 = Math.max(selRange.r1, selRange.r2);
  const c1 = Math.min(selRange.c1, selRange.c2);
  const c2 = Math.max(selRange.c1, selRange.c2);

  selOverlay.style.display = 'block';
  selOverlay.style.top = (r1 * ROW_H) + 'px';
  selOverlay.style.left = colLeft(c1) + 'px';
  selOverlay.style.width = (colLeft(c2 + 1) - colLeft(c1)) + 'px';
  selOverlay.style.height = ((r2 - r1 + 1) * ROW_H) + 'px';
}

function refresh() {
  applyFilter();
  virt.options.count = rows.length;
  virt._willUpdate();
  renderHead();
  renderRows();
  updateSelOverlay();
  const totalW = COLS.reduce((s, c) => s + c.w, 0);
  innerEl.style.minWidth = totalW + 'px';
  document.getElementById('thead').style.width = totalW + 'px';
}

/* ============================ 框选事件 ============================ */

innerEl.addEventListener('mousedown', e => {
  if (e.button !== 0) return; // 只处理左键，右键留给 contextmenu
  const cell = e.target.closest('.cell');
  if (!cell) {
    selRange = null; selCheckMode = false;
    updateSelOverlay();
    return;
  }
  const colKey = cell.dataset.col;
  const rowIdx = parseInt(cell.dataset.row);
  if (!colKey || isNaN(rowIdx)) return;
  const colIdx = COLS.findIndex(c => c.k === colKey);
  if (colIdx < 0) return;
  selRange = { r1: rowIdx, c1: colIdx, r2: rowIdx, c2: colIdx };
  selDragging = true;
  selDragMoved = false;
  selCheckMode = colKey === '_sel';
  updateSelOverlay();
});

function updateCheckRange() {
  const r1 = Math.min(selRange.r1, selRange.r2);
  const r2 = Math.max(selRange.r1, selRange.r2);
  for (let i = r1; i <= r2; i++) {
    const r = rows[i];
    if (r) selectedRows.add(r.id);
  }
  // 直接更新可见的 checkbox DOM
  innerEl.querySelectorAll('.sel-row').forEach(cb => {
    cb.checked = selectedRows.has(cb.dataset.id);
  });
}

let autoScrollRaf = null;
const SCROLL_ZONE = 50; // 边缘触发区高度
const SCROLL_MAX = 12;  // 最大滚动速度

function autoScrollTick(e) {
  const rect = scrollEl.getBoundingClientRect();
  const topDist = e.clientY - rect.top;
  const botDist = rect.bottom - e.clientY;
  let dir = 0, speed = 0;
  if (topDist < SCROLL_ZONE && topDist > 0) {
    dir = -1;
    speed = Math.round((1 - topDist / SCROLL_ZONE) * SCROLL_MAX);
  } else if (botDist < SCROLL_ZONE && botDist > 0) {
    dir = 1;
    speed = Math.round((1 - botDist / SCROLL_ZONE) * SCROLL_MAX);
  }
  if (dir === 0) return false;
  scrollEl.scrollTop += dir * speed;
  // 滚动中更新框选
  const el = document.elementFromPoint(e.clientX, e.clientY);
  const cell = el?.closest?.('.cell');
  if (cell) {
    const colKey = cell.dataset.col;
    const rowIdx = parseInt(cell.dataset.row);
    if (colKey && !isNaN(rowIdx)) {
      const colIdx = COLS.findIndex(c => c.k === colKey);
      if (colIdx >= 0 && (selRange.r2 !== rowIdx || selRange.c2 !== colIdx)) {
        selRange.r2 = rowIdx;
        selRange.c2 = colIdx;
        selDragMoved = true;
        updateSelOverlay();
        if (selCheckMode) updateCheckRange();
      }
    }
  }
  return true;
}

document.addEventListener('mousemove', e => {
  if (!selDragging) return;
  e.preventDefault();
  if (autoScrollTick(e)) {
    if (!autoScrollRaf) {
      autoScrollRaf = requestAnimationFrame(function loop() {
        if (!selDragging || !autoScrollTick(e)) { stopAutoScroll(); return; }
        autoScrollRaf = requestAnimationFrame(loop);
      });
    }
  } else {
    stopAutoScroll();
  }
  const el = document.elementFromPoint(e.clientX, e.clientY);
  const cell = el?.closest?.('.cell');
  if (!cell) return;
  const colKey = cell.dataset.col;
  const rowIdx = parseInt(cell.dataset.row);
  if (!colKey || isNaN(rowIdx)) return;
  const colIdx = COLS.findIndex(c => c.k === colKey);
  if (colIdx < 0) return;
  if (selRange.r2 !== rowIdx || selRange.c2 !== colIdx) {
    selRange.r2 = rowIdx;
    selRange.c2 = colIdx;
    selDragMoved = true;
    updateSelOverlay();
    if (selCheckMode) updateCheckRange();
  }
});

function stopAutoScroll() {
  if (autoScrollRaf) { cancelAnimationFrame(autoScrollRaf); autoScrollRaf = null; }
}

document.addEventListener('mouseup', () => {
  if (!selDragging) return;
  selDragging = false;
  stopAutoScroll();
  if (selCheckMode) {
    selCheckMode = false;
    renderHead();
    renderRows();
  }
});

// 点击表格外 → 清除框选
document.addEventListener('mousedown', e => {
  if (!e.target.closest('#scroll') && !e.target.closest('#inner') && !e.target.closest('#ctx-menu')) {
    selRange = null; selCheckMode = false;
    updateSelOverlay();
  }
});

/* ============================ 事件 ============================ */

document.getElementById('thead').addEventListener('click', e => {
  // 全选复选框
  if (e.target.classList.contains('sel-all')) {
    if (e.target.checked) {
      rows.forEach(r => selectedRows.add(r.id));
    } else {
      rows.forEach(r => selectedRows.delete(r.id));
    }
    renderRows();
    return;
  }

  const k = e.target.closest('[data-s]')?.dataset.s;
  if (!k) return;

  // 三段循环：normal → asc → desc → normal
  if (sortK !== k) { sortK = k; sortD = false; }
  else if (!sortD) { sortD = true; }
  else { sortK = ''; sortD = false; }

  sortAndFetch();
});

/* ============================ 列宽拖拽 ============================ */

let resizing = null; // { ci, startX, startW }

document.getElementById('thead').addEventListener('mousedown', e => {
  if (!e.target.classList.contains('rh')) return;
  e.preventDefault();
  const ci = parseInt(e.target.dataset.ci);
  resizing = { ci, startX: e.clientX, startW: COLS[ci].w };
});

document.addEventListener('mousemove', e => {
  if (!resizing) return;
  const diff = e.clientX - resizing.startX;
  const newW = Math.max(40, resizing.startW + diff);
  COLS[resizing.ci].w = newW;

  // 直接改 DOM 宽，不重渲染
  const th = document.querySelectorAll('.th')[resizing.ci];
  if (th) th.style.width = newW + 'px';

  document.querySelectorAll('.row').forEach(row => {
    const cell = row.querySelectorAll('.cell')[resizing.ci];
    if (cell) cell.style.width = newW + 'px';
  });

  const totalW = COLS.reduce((s, c) => s + c.w, 0);
  innerEl.style.minWidth = totalW + 'px';
  document.getElementById('thead').style.width = totalW + 'px';
});

document.addEventListener('mouseup', () => {
  if (!resizing) return;
  resizing = null;
  refresh();
});

/* ============================ 编辑 ============================ */

function commitEdit(input) {
  const colKey = input.dataset.col;
  const rowIdx = parseInt(input.dataset.row);
  const newValue = input.value;

  // 用 id 回找 ALL 中的行（rows 和 ALL 索引可能不同）
  const rr = rows[rowIdx];
  if (rr) {
    rr[colKey] = newValue;
    rr.edit = true;
    editedRows.set(rr.id, { ...editedRows.get(rr.id), [colKey]: newValue });

    const rAll = ALL.find(x => x.id === rr.id);
    if (rAll) {
      rAll[colKey] = newValue;
      rAll.edit = true;
    }
  }

  showToast(`已修改 ${colKey}`);
}

function cancelEdit() {
  editingCell = null;
  refresh();
}

innerEl.addEventListener('click', e => {
  // 行选择复选框
  if (e.target.classList.contains('sel-row')) {
    if (selDragMoved) return; // 拖拽多选时不触发单点 toggle
    const id = e.target.dataset.id;
    if (e.target.checked) selectedRows.add(id);
    else selectedRows.delete(id);
    renderHead();
    renderRows();
    return;
  }

  // 备注按钮
  if (e.target.classList.contains('note-btn')) {
    showNotePopover(e.target, e.target.dataset.id);
    return;
  }

  // 编辑按钮 → 进入该行第一个可编辑列的编辑模式
  const btn = e.target.closest('.ed');
  if (btn) {
    // 先提交当前编辑
    const oldInp = innerEl.querySelector('.ci');
    if (oldInp) commitEdit(oldInp);

    const rAll = ALL.find(x => x.id === btn.dataset.id);
    const rowIdx = rows.indexOf(rAll);
    const firstEditable = COLS.find(c => c.k !== '_act' && c.k !== 'id' && c.k !== '_idx' && c.k !== '_sel' && c.k !== 'Note');
    if (rowIdx >= 0 && firstEditable) {
      editingCell = { rowIdx, colKey: firstEditable.k };
      refresh();
    }
    return;
  }

  // 点击单元格 → 选择 + 进入编辑 + 勾选该行
  const cell = e.target.closest('.cell');
  if (!cell) return;
  const col = cell.dataset.col;
  const row = parseInt(cell.dataset.row);
  if (!col || isNaN(row)) return;
  if (col === '_act' || col === 'Note') return;
  // 点击 _sel 单元格空白处 → 切换该行勾选
  if (col === '_sel') {
    const r = rows[row];
    if (r) {
      if (selectedRows.has(r.id)) selectedRows.delete(r.id);
      else selectedRows.add(r.id);
      renderHead();
      renderRows();
    }
    return;
  }

  // 如果刚才拖拽了，不进入编辑
  if (selDragMoved) return;

  // 勾选该行
  const r = rows[row];
  if (r && !selectedRows.has(r.id)) {
    selectedRows.add(r.id);
  }

  // 已在编辑中 → 先提交旧值
  const oldInp = innerEl.querySelector('.ci');
  if (oldInp && editingCell) {
    commitEdit(oldInp);
  }

  editingCell = { rowIdx: row, colKey: col };
  refresh();
});

// 监听 input 的键盘事件（委托）
innerEl.addEventListener('keydown', e => {
  if (!editingCell) return;
  const inp = e.target.closest('.ci');
  if (!inp) return;

  if (e.key === 'Enter') { e.preventDefault(); commitEdit(inp); }
  if (e.key === 'Escape') { e.preventDefault(); cancelEdit(); }
});

// blur 时自动提交
innerEl.addEventListener('blur', e => {
  const inp = e.target.closest('.ci');
  if (inp && editingCell) commitEdit(inp);
}, true);

/* ============================ 右键菜单 ============================ */

innerEl.addEventListener('contextmenu', e => {
  e.preventDefault();
  const cell = e.target.closest('.cell');
  if (!cell) { hideCtxMenu(); return; }
  const rowIdx = parseInt(cell.dataset.row);
  const colKey = cell.dataset.col;
  if (isNaN(rowIdx) || !colKey) { hideCtxMenu(); return; }
  const colIdx = COLS.findIndex(c => c.k === colKey);
  if (colIdx < 0) { hideCtxMenu(); return; }
  ctxMenuRowIdx = rowIdx;

  // Excel 逻辑：右键如果在已选框选范围内 → 保持原范围；否则 → 选中当前格
  if (selRange) {
    const r1 = Math.min(selRange.r1, selRange.r2);
    const r2 = Math.max(selRange.r1, selRange.r2);
    const c1 = Math.min(selRange.c1, selRange.c2);
    const c2 = Math.max(selRange.c1, selRange.c2);
    if (rowIdx < r1 || rowIdx > r2 || colIdx < c1 || colIdx > c2) {
      selRange = { r1: rowIdx, c1: colIdx, r2: rowIdx, c2: colIdx };
    }
  } else {
    selRange = { r1: rowIdx, c1: colIdx, r2: rowIdx, c2: colIdx };
  }
  updateSelOverlay();

  ctxMenu.style.left = Math.min(e.clientX, window.innerWidth - 150) + 'px';
  ctxMenu.style.top = Math.min(e.clientY, window.innerHeight - 220) + 'px';
  ctxMenu.classList.add('on');
});

ctxMenu.addEventListener('click', async e => {
  const item = e.target.closest('.ctx-item');
  if (!item) return;
  const action = item.dataset.action;

  if (action === 'copy') {
    // 复制不关菜单，保持用户手势上下文
    if (!selRange) return;
    const r1 = Math.min(selRange.r1, selRange.r2);
    const r2 = Math.max(selRange.r1, selRange.r2);
    const c1 = Math.min(selRange.c1, selRange.c2);
    const c2 = Math.max(selRange.c1, selRange.c2);
    const lines = [];
    for (let ri = r1; ri <= r2; ri++) {
      const rr = rows[ri];
      if (!rr) continue;
      const parts = [];
      for (let ci = c1; ci <= c2; ci++) {
        parts.push(rr[COLS[ci].k] ?? '');
      }
      lines.push(parts.join('\t'));
    }
    const text = lines.join('\n');
    const ta = document.createElement('textarea');
    ta.value = text;
    ta.style.cssText = 'position:fixed;left:-9999px;top:-9999px';
    document.body.appendChild(ta);
    ta.focus();
    ta.select();
    const ok = document.execCommand('copy');
    document.body.removeChild(ta);
    showToast(ok ? '已复制' : '复制失败');
    hideCtxMenu();
    return;
  }

  hideCtxMenu();

  const r = rows[ctxMenuRowIdx];
  const checkedIds = [...selectedRows];
  const isCurChecked = r && selectedRows.has(r.id);
  const targetIds = r ? (isCurChecked ? checkedIds : [r.id]) : checkedIds;

  switch (action) {
    case 'noStock':
    case 'noStockPub': {
      if (!targetIds.length) { showToast('请先勾选记录'); break; }
      const gongHai = action === 'noStockPub' ? '1' : '0';
      for (const id of targetIds) {
        const fd = new FormData();
        fd.append('id', id);
        fd.append('CaiGouBJDetail', id);
        fd.append('GongHai', gongHai);
        fd.append('BillPage', 'CaiGouBJ');
        await post('/CaiGouBJ/NoStock', fd);
      }
      showToast(gongHai === '0' ? '无货提醒已发送' : '已转公海');
      break;
    }
    case 'delete': {
      if (!targetIds.length) { showToast('请先勾选记录'); break; }
      if (!confirm(`确定要删除 ${targetIds.length} 条询价吗？`)) break;
      const fd = new FormData();
      fd.append('BillID', targetIds.join(','));
      await post('/CaiGouBJ/Delete', fd);
      showToast('删除成功');
      targetIds.forEach(id => selectedRows.delete(id));
      // 从数据中移除
      ALL = ALL.filter(x => !targetIds.includes(x.id));
      refresh();
      break;
    }
    default:
      showToast('功能开发中');
  }
});

function hideCtxMenu() { ctxMenu.classList.remove('on'); }

document.addEventListener('click', e => {
  if (!ctxMenu.classList.contains('on')) return;
  if (!ctxMenu.contains(e.target)) hideCtxMenu();
});

// Ctrl+S 保存
document.addEventListener('keydown', e => {
  if ((e.ctrlKey || e.metaKey) && e.key.toLowerCase() === 's') {
    e.preventDefault();
    if (editedRows.size === 0) {
      showToast('没有修改');
      return;
    }
    const payload = [];
    editedRows.forEach((fields, id) => {
      payload.push({ id, ...fields });
    });
    console.log('💾 保存数据:', JSON.stringify(payload, null, 2));
    showToast(`已保存 ${editedRows.size} 条记录（查看控制台）`);
    editedRows.clear();
    refresh();
  }
});

let tt;
function showToast(msg) {
  const t = document.getElementById('toast');
  clearTimeout(tt);
  t.textContent = msg;
  t.classList.add('on');
  tt = setTimeout(() => t.classList.remove('on'), 2000);
}

/* ============================ 备注 popover ============================ */

let notePopover = null;
let noteCurrentId = null;

function createNotePopover() {
  if (notePopover) return notePopover;
  const el = document.createElement('div');
  el.className = 'note-popover';
  el.innerHTML = `
    <div class="np-list"></div>
    <div class="np-foot">
      <input class="np-input" placeholder="输入备注…" />
      <button class="np-save">保存</button>
    </div>
  `;
  el.addEventListener('click', e => {
    e.stopPropagation();
    if (e.target.classList.contains('np-save')) saveNote();
  });
  el.querySelector('.np-input').addEventListener('keydown', e => {
    if (e.key === 'Enter') saveNote();
  });
  document.body.appendChild(el);
  notePopover = el;
  return el;
}

async function loadNotes(billId) {
  const listEl = notePopover.querySelector('.np-list');
  listEl.innerHTML = '<span class="dim" style="padding:8px">加载中…</span>';
  const fd = new FormData();
  fd.append('Test', 'true');
  fd.append('BillID', billId);
  fd.append('DetaillD', '0');
  fd.append('BillPage', 'CaiGouBJ');
  try {
    const res = await post('/note/List', fd);
    if (res.note?.length) {
      listEl.innerHTML = res.note.map(item => `
        <div class="np-item">
          <div class="np-meta">${escapeHtml(item.UserName || '')} · ${escapeHtml(item.CreateTime || '')}</div>
          <div class="np-text">${escapeHtml(item.Note?.Note || '')}</div>
        </div>
      `).join('');
    } else {
      listEl.innerHTML = '<span class="dim" style="padding:8px">暂无备注</span>';
    }
  } catch {
    listEl.innerHTML = '<span class="dim" style="padding:8px">加载失败</span>';
  }
}

async function saveNote() {
  const input = notePopover.querySelector('.np-input');
  const val = input.value.trim();
  if (!val) return;
  const fd = new FormData();
  fd.append('BillID', noteCurrentId);
  fd.append('DetailID ', '0');
  fd.append('BillPage', 'CaiGouBJ');
  fd.append('Note', val);
  fd.append('noteFiles', '');
  try {
    await post('/note/Save', fd);
    input.value = '';
    loadNotes(noteCurrentId);
    // 更新行数据，让备注按钮变色
    const rAll = ALL.find(x => x.id === noteCurrentId);
    if (rAll) rAll.Note = val;
    const rRow = rows.find(x => x.id === noteCurrentId);
    if (rRow) rRow.Note = val;
    renderRows();
  } catch { /* ignore */ }
}

function showNotePopover(btn, id) {
  createNotePopover();
  noteCurrentId = id;

  const rect = btn.getBoundingClientRect();
  const left = Math.min(rect.left, window.innerWidth - 310);
  notePopover.style.left = left + 'px';
  notePopover.style.top = (rect.bottom + 6) + 'px';
  notePopover.classList.add('on');

  loadNotes(id);
}

function hideNotePopover() {
  if (notePopover) notePopover.classList.remove('on');
}

document.addEventListener('click', e => {
  if (notePopover && notePopover.classList.contains('on') && !notePopover.contains(e.target) && !e.target.closest('.note-btn')) {
    hideNotePopover();
  }
});

/* ============================ 初始化（先拉列配置，再拉数据） ============================ */

async function init() {
  // 0. 拉重要程度色表
  try {
    const fd = new FormData();
    fd.append('CodeType', '询价重要程度');
    const res = await post('/sys_code/CodeSelect', fd);
    colorList = res || [];
  } catch { /* ignore */ }

  // 1. 拉列配置（失败就用 DEFAULT_COLS）
  const result = await fetchColHeaders({
    url: "",
    BillPage,
    noFirst: [],
    needEdit: [],
    noSelect: NO_SELECT_FIELDS,
    editors: {},
  });

  if (result?.columns?.length) {
    COLS = toUIOColumns(result.columns);
  }

  // 前插序号列和选择列
  COLS = [
    { k: '_idx', l: '#', w: 50 },
    { k: '_sel', l: '', w: 40 },
    ...COLS,
  ];

  // 2. 拉数据（失败或空就用 mock）
  const { data, total } = await fetchTableData({
    pagination: tableParams.pagination,
    sortField: tableParams.sortField,
    sortOrder: tableParams.sortOrder,
  });

  if (data.length) {
    ALL = data;
    totalFromApi = total;
  } else {
    ALL = makeMockData(500);
    totalFromApi = ALL.length;
  }

  refresh();
}

init();
