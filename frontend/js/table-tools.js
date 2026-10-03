/* ============================================================================
 *  Table tools  —  search + live row count for list tables
 * ============================================================================
 *  Any table marked with `data-tools` gets a toolbar injected above it
 *  containing a search box and a live row count. One script, so all 20
 *  admin/staff list pages get it without 20 copies of the markup.
 *
 *      <table data-tools data-tools-placeholder="Search inventory...">
 *
 *  Filtering is client-side and matches anywhere in the row's text, which is
 *  what these lists need (they are tens of rows, not thousands).
 *
 *  Rows are hidden with a CLASS rather than the `hidden` attribute: `hidden`
 *  is unreliable on <tr> because the UA stylesheet's `tr { display: table-row }`
 *  competes with `[hidden] { display: none }`.
 *
 *  app.js re-renders the tbody on refresh, so a MutationObserver re-applies the
 *  current filter after every re-render.
 * ========================================================================= */
(function () {
    'use strict';

    var SEARCH_ICON =
        '<span class="icon icon-sm" aria-hidden="true">' +
        '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.75" ' +
        'stroke-linecap="round" stroke-linejoin="round">' +
        '<circle cx="11" cy="11" r="7"/><path d="M20 20l-3.5-3.5"/></svg></span>';

    function enhance(table) {
        if (table.dataset.toolsReady === '1') {
            return;
        }
        table.dataset.toolsReady = '1';

        var container = table.closest('.table-container') || table;
        var anchor = container.parentNode;

        var toolbar = document.createElement('div');
        toolbar.className = 'table-toolbar';

        var placeholder = table.dataset.toolsPlaceholder || 'Search…';

        toolbar.innerHTML =
            '<div class="toolbar-search">' + SEARCH_ICON +
                '<input type="search" placeholder="' + placeholder +
                '" aria-label="' + placeholder + '">' +
            '</div>' +
            '<div class="toolbar-meta"><span class="toolbar-count"></span></div>';

        anchor.insertBefore(toolbar, container);

        var input = toolbar.querySelector('input');
        var countEl = toolbar.querySelector('.toolbar-count');

        function body() {
            return table.tBodies[0];
        }

        function dataRows() {
            var tbody = body();
            if (!tbody) {
                return [];
            }
            return Array.prototype.slice.call(tbody.rows).filter(function (row) {
                return !row.classList.contains('table-no-match-row');
            });
        }

        function apply() {
            var query = input.value.trim().toLowerCase();
            var rows = dataRows();
            var shown = 0;

            rows.forEach(function (row) {
                var match = !query || row.textContent.toLowerCase().indexOf(query) !== -1;
                row.classList.toggle('row-filtered-out', !match);
                if (match) {
                    shown++;
                }
            });

            // A "nothing matched" row, so an empty result does not look broken.
            var tbody = body();
            var existing = tbody ? tbody.querySelector('.table-no-match-row') : null;

            if (tbody && rows.length > 0 && shown === 0) {
                var columns = table.tHead && table.tHead.rows[0]
                    ? table.tHead.rows[0].cells.length
                    : 1;

                if (!existing) {
                    var tr = tbody.insertRow();
                    tr.className = 'table-no-match-row';
                    var td = tr.insertCell();
                    td.colSpan = columns;
                    td.className = 'table-no-match';
                    existing = tr;
                }

                existing.cells[0].textContent =
                    'Nothing matches \u201C' + input.value.trim() + '\u201D.';
            } else if (existing) {
                existing.remove();
            }

            countEl.innerHTML = query
                ? '<strong>' + shown + '</strong> of ' + rows.length
                : '<strong>' + rows.length + '</strong> ' +
                  (rows.length === 1 ? 'row' : 'rows');
        }

        input.addEventListener('input', apply);

        var tbody = body();

        if (tbody && window.MutationObserver) {
            new MutationObserver(apply).observe(tbody, { childList: true });
        }

        apply();
    }

    function run() {
        var tables = document.querySelectorAll('table[data-tools]');
        for (var i = 0; i < tables.length; i++) {
            enhance(tables[i]);
        }
    }

    if (document.readyState === 'loading') {
        document.addEventListener('DOMContentLoaded', run);
    } else {
        run();
    }

    // Exposed so a page can re-run it after building a table dynamically.
    window.tableTools = { refresh: run };
})();
