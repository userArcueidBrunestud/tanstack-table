import './style.css'
import { Virtualizer, observeElementRect, observeElementOffset, elementScroll } from '@tanstack/virtual-core'
import { get, post } from './request.js'

/* ✅ 把你 body 里的 HTML 原样塞进来 */
document.getElementById('app').innerHTML = `
<h1>DATA<span>/</span>GRID</h1>
<p class="sub">@tanstack/virtual-core · vanilla js</p>

<div class="bar">
  <input id="q" type="text" placeholder="搜索物料编码 / 品牌 / 供应商…"/>
  <div class="badge">共 <b id="total">0</b> 条</div>
  <div class="badge">渲染 <b id="rendered">0</b> 行</div>
</div>

<div class="wrap">
  <div id="scroll">
    <div class="thead" id="thead"></div>
    <div id="inner"></div>
  </div>
  <div class="foot">
    <span>虚拟滚动 · 仅渲染可视行</span>
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
        document.getElementById('total').textContent = totalFromApi;
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

/* ============================ 过滤 & 排序 ============================ */

function applyFilter() {
  const q = document.getElementById('q').value.trim().toLowerCase();
  rows = q
    ? ALL.filter(r => r.PartNo.toLowerCase().includes(q) || r.Brand.toLowerCase().includes(q) || r.Supplier.toLowerCase().includes(q) || r.ShortName.toLowerCase().includes(q))
    : ALL;
  if (sortK) {
    rows = [...rows].sort((a, b) => {
      const c = typeof a[sortK] === 'number' ? a[sortK] - b[sortK] : String(a[sortK]).localeCompare(String(b[sortK]));
      return sortD ? -c : c;
    });
  }
  document.getElementById('total').textContent = totalFromApi || rows.length;
}

/* ============================ 渲染 ============================ */

function renderHead() {
  document.getElementById('thead').innerHTML = COLS.map(c => {
    const cls = c.k === sortK ? (sortD ? 'desc' : 'asc') : '';
    const arr = c.s ? (c.k === sortK ? (sortD ? ' ▼' : ' ▲') : ' ⇅') : '';
    return `<div class="th ${cls}" style="width:${c.w}px"
      ${c.s ? `data-s="${c.k}"` : ''}>${c.l}${arr}</div>`;
  }).join('');
}

function cell(k, r) {
  if (k === 'id') return `<span class="dim">#${r.id}</span>`;
  if (k === 'PartNo') return `<span class="pn">${r.PartNo}</span>`;
  if (k === 'Qty') return `<span class="num">${Number(r.Qty).toLocaleString()}</span>`;
  if (k === 'TargetPrice') return `<span class="price">${r.CurrencyID === 'USD' ? '$' : '¥'}${r.TargetPrice}</span>`;
  if (k === 'CurrencyID') return `<span class="tag tag-currency">${r.CurrencyID}</span>`;
  if (k === 'NewOld') {
    const cls = r.NewOld === '全新' ? 'new' : r.NewOld === '翻新' ? 'refurb' : 'old';
    return `<span class="tag tag-${cls}">${r.NewOld}</span>`;
  }
  if (k === 'HuiFu') {
    const cls = r.HuiFu === '已回复' ? 'replied' : r.HuiFu === '待确认' ? 'pending' : 'noreply';
    return `<span class="dot ${cls}">${r.HuiFu}</span>`;
  }
  if (k === '_act') return `<button class="ed" data-id="${r.id}">编辑</button>`;
  return String(r[k] ?? '');
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
  const items = virt.getVirtualItems();
  innerEl.style.height = virt.getTotalSize() + 'px';
  innerEl.innerHTML = items.map(({ index, start, size }) => {
    const r = rows[index];
    if (!r) return '';
    const cells = COLS.map(c => `<div class="cell" style="width:${c.w}px">${cell(c.k, r)}</div>`).join('');
    return `<div class="row ${index % 2 ? 'odd' : 'even'}" style="top:${start}px;height:${size}px">${cells}</div>`;
  }).join('');
  document.getElementById('rendered').textContent = items.length;
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

document.getElementById('q').addEventListener('input', refresh);

document.getElementById('thead').addEventListener('click', e => {
  const k = e.target.closest('[data-s]')?.dataset.s;
  if (!k) return;
  if (sortK !== k) { sortK = k; sortD = false; }
  else if (!sortD) { sortD = true; }
  else { sortK = ''; sortD = false; }
  refresh();
});

let tt;
innerEl.addEventListener('click', e => {
  const b = e.target.closest('.ed');
  if (!b) return;
  const r = ALL.find(x => x.id === b.dataset.id);
  const t = document.getElementById('toast');
  clearTimeout(tt);
  t.textContent = `✎ 编辑 ${r.PartNo} · ${r.Supplier}`;
  t.classList.add('on');
  tt = setTimeout(() => t.classList.remove('on'), 2000);
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
