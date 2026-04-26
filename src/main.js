import './style.css'
import { Virtualizer, observeElementRect, observeElementOffset, elementScroll } from '@tanstack/virtual-core'
import { get, post } from './request.js'

/* ✅ 把你 body 里的 HTML 原样塞进来 */
document.getElementById('app').innerHTML = `
<div class="wrap">
  <div id="scroll">
    <div class="thead" id="thead"></div>
    <div id="inner"></div>
  </div>
</div>
<div id="toast"></div>
`

/* ============================ 常量（来自 PanelTableCanvas） ============================ */

const BillPage = "CaiGouBJ_ChaHuo";
const NO_SELECT_FIELDS = ["备注"];
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
const selectedRows = new Set(); // row id

/* ============================ 过滤 & 排序 ============================ */

function applyFilter() {
  rows = ALL;
  if (sortK) {
    rows = [...rows].sort((a, b) => {
      const c = typeof a[sortK] === 'number' ? a[sortK] - b[sortK] : String(a[sortK]).localeCompare(String(b[sortK]));
      return sortD ? -c : c;
    });
  }
}

/* ============================ 渲染 ============================ */

function renderHead() {
  document.getElementById('thead').innerHTML = COLS.map(c => {
    if (c.k === '_sel') {
      const allSel = rows.length > 0 && rows.every(r => selectedRows.has(r.id));
      return `<div class="th" style="width:${c.w}px"><input type="checkbox" class="sel-all" data-all="${allSel ? '1' : '0'}"></div>`;
    }
    const cls = c.k === sortK ? (sortD ? 'desc' : 'asc') : '';
    const arr = c.s ? (c.k === sortK ? (sortD ? ' ▼' : ' ▲') : ' ⇅') : '';
    return `<div class="th ${cls}" style="width:${c.w}px"
      ${c.s ? `data-s="${c.k}"` : ''}>${c.l}${arr}</div>`;
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

  const edited = editedRows.has(r.id) && k !== 'id' && k !== '_act' ? ' edited' : '';
  if (k === 'PartNo') return `<span class="pn${edited}">${r.PartNo}</span>`;
  if (k === 'Qty') return `<span class="num${edited}">${Number(r.Qty).toLocaleString()}</span>`;
  if (k === 'TargetPrice') return `<span class="price${edited}">${r.CurrencyID === 'USD' ? '$' : '¥'}${r.TargetPrice}</span>`;
  if (k === 'CurrencyID') return `<span class="tag tag-currency${edited}">${r.CurrencyID}</span>`;
  if (k === 'NewOld') {
    const cls = r.NewOld === '全新' ? 'new' : r.NewOld === '翻新' ? 'refurb' : 'old';
    return `<span class="tag tag-${cls}${edited}">${r.NewOld}</span>`;
  }
  if (k === 'Note') return `<button class="note-btn${v ? ' has-note' : ''}" data-id="${r.id}">备注</button>`;
  if (k === 'HuiFu') {
    const cls = r.HuiFu === '已回复' ? 'replied' : r.HuiFu === '待确认' ? 'pending' : 'noreply';
    return `<span class="dot ${cls}${edited}">${r.HuiFu}</span>`;
  }
  return `<span class="${edited ? 'edited' : ''}">${escapeHtml(String(v))}</span>`;
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

const virt = new Virtualizer({
  count: rows.length,
  estimateSize: () => ROW_H,
  overscan: 10,
  getScrollElement: () => scrollEl,
  observeElementRect,
  observeElementOffset,
  scrollToFn: elementScroll,
  onChange() { renderRows(); },
});

function renderRows() {
  // 保存编辑中的光标位置
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
    const cells = COLS.map(c => `<div class="cell" style="width:${c.w}px" data-col="${c.k}" data-row="${index}">${cell(c.k, r, index)}</div>`).join('');
    const editedCls = editedRows.has(r.id) ? ' row-edited' : '';
    return `<div class="row ${index % 2 ? 'odd' : 'even'}${editedCls}" style="top:${start}px;height:${size}px">${cells}</div>`;
  }).join('');

  // 恢复编辑状态
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

function refresh() {
  applyFilter();
  virt.options.count = rows.length;
  virt._willUpdate();
  renderHead();
  renderRows();
  const totalW = COLS.reduce((s, c) => s + c.w, 0);
  innerEl.style.minWidth = totalW + 'px';
}

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
  if (sortK !== k) { sortK = k; sortD = false; }
  else if (!sortD) { sortD = true; }
  else { sortK = ''; sortD = false; }
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
    const id = e.target.dataset.id;
    if (e.target.checked) selectedRows.add(id);
    else selectedRows.delete(id);
    renderHead();
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
    const firstEditable = COLS.find(c => c.k !== '_act' && c.k !== 'id');
    if (rowIdx >= 0 && firstEditable) {
      editingCell = { rowIdx, colKey: firstEditable.k };
      refresh();
    }
    return;
  }

  // 点击可编辑 cell → 进入编辑
  const cell = e.target.closest('.cell');
  if (!cell) return;
  const col = cell.dataset.col;
  const row = parseInt(cell.dataset.row);
  if (!col || isNaN(row)) return;
  if (col === '_act' || col === 'id' || col === '_idx' || col === '_sel' || col === 'Note') return;

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
