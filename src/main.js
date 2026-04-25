import {
  createTable,
  getCoreRowModel,
} from '@tanstack/table-core';
import { Virtualizer } from '@tanstack/virtual-core';
import $ from 'jquery';

/** ================= 数据 ================= */
const data = Array.from({ length: 500 }, (_, i) => ({
  id: i,
  name: `用户 ${i + 1}`,
  age: 20 + (i % 30),
  status: i % 2 === 0 ? '在线' : '离线',
}));

/** ================= 列 ================= */
const columns = [
  { accessorKey: 'name', header: '姓名', size: 120 },
  { accessorKey: 'age', header: '年龄', size: 80 },
  { accessorKey: 'status', header: '状态', size: 100 },
  {
    id: 'actions',
    header: '操作',
    size: 120,
    cell: (ctx) =>
      `<button class="edit-btn" data-id="${ctx.row.original.id}">编辑</button>`,
  },
];

/** ================= table 状态 ================= */
let tableState = {
  columnOrder:      [],
  columnPinning:    { left: [], right: [] },
  columnVisibility: {},
  columnSizing:     {},
  columnSizingInfo: {
    startOffset:        null,
    startSize:          null,
    deltaOffset:        null,
    deltaPercentage:    null,
    isResizingColumn:   false,
    columnSizingStart:  [],
  },
  columnFilters:  [],
  globalFilter:   undefined,
  sorting:        [],
  grouping:       [],
  expanded:       {},
  pagination:     { pageIndex: 0, pageSize: 10 },
  rowSelection:   {},
  rowPinning:     { top: [], bottom: [] },
};

const table = createTable({
  data,
  columns,
  enableColumnResizing: false,
  renderFallbackValue:  null,

  get state() { return tableState; },

  onStateChange(updater) {
    tableState = typeof updater === 'function'
      ? updater(tableState)
      : updater;
    renderRows();
  },

  getRowId: row => String(row.id),
  getCoreRowModel: getCoreRowModel(),
});

// ✅ 拿到完整的初始 state
tableState = table.initialState;

/** ================= DOM 骨架 ================= */
const $root = $('#table-root');

$root.html(`
  <div id="scroll" style="height:400px;overflow:auto;position:relative">
    <table border="1" style="width:100%;border-collapse:collapse">
      <thead></thead>
      <tbody></tbody>
    </table>
  </div>
`);

const $scroll = $('#scroll');
const $table = $root.find('table');
const tbodyEl = $table.find('tbody')[0];

/** ================= 表头 ================= */
function renderHeader() {
  const html = table.getHeaderGroups().map(group => `
    <tr>
      ${group.headers.map(header => {
        const def = header.column.columnDef;
        const label =
          typeof def.header === 'function'
            ? def.header(header.getContext())
            : def.header;

        return `<th style="background:#f5f5f5">${label}</th>`;
      }).join('')}
    </tr>
  `).join('');

  $table.find('thead').html(html);
}

/** ================= 虚拟滚动器（关键） ================= */
const virtualizer = new Virtualizer({
  count: data.length,
  getScrollElement: () => $scroll[0],
  estimateSize: () => 35,
  overscan: 5,

  observeElementRect: (el, cb) => {
    const ro = new ResizeObserver(() => {
      cb(el.getBoundingClientRect());
    });
    ro.observe(el);
    return () => ro.disconnect();
  },

  observeElementOffset: (el, cb) => {
    const handler = () => cb(el.scrollTop);
    el.addEventListener('scroll', handler);
    return () => el.removeEventListener('scroll', handler);
  },

  onChange: renderRows,
});

/** ================= 渲染行（绝对定位） ================= */
function renderRows() {
  const rows = table.getRowModel().rows;
  const items = virtualizer.getVirtualItems();

  const html = items.map(item => {
    const row = rows[item.index];
    if (!row) return '';

    const cells = row.getVisibleCells().map(cell => {
      const def = cell.column.columnDef;
      const content = def.cell
        ? def.cell(cell.getContext())
        : cell.getValue();

      return `<td>${content}</td>`;
    }).join('');

    return `
      <tr style="
        position:absolute;
        top:${item.start}px;
        height:${item.size}px;
        width:100%;
      ">
        ${cells}
      </tr>
    `;
  }).join('');

  $(tbodyEl).html(`
    <tr style="height:${virtualizer.getTotalSize()}px">
      <td colspan="${columns.length}" style="padding:0;border:none;position:relative">
        <table style="width:100%">${html}</table>
      </td>
    </tr>
  `);
}

/** ================= 事件委托 ================= */
$table.on('click', '.edit-btn', function () {
  const rowId = $(this).data('id');
  // 在这里挂载任意 jQuery 组件
  alert(`编辑 ID: ${rowId}`);
});

/** ================= 初始化 ================= */
renderHeader();
renderRows();