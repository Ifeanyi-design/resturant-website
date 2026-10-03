/* ============================================================================
 *  Charts  —  tiny inline-SVG chart helpers
 * ============================================================================
 *  No charting library. The project has no build step and a strict
 *  minimal-dependency rule, and the two shapes needed here (a donut and a set
 *  of horizontal bars) are a few dozen lines of SVG each.
 *
 *      window.charts.donut(el, [{ label, value, tone }], { total })
 *      window.charts.bars(el,  [{ label, value, meta }], { format })
 *
 *  Colours come from CSS custom properties, so the charts follow the theme.
 * ========================================================================= */
(function () {
    'use strict';

    var NS = 'http://www.w3.org/2000/svg';

    // Token names rather than hex values, so a palette change propagates.
    var TONES = {
        pending: 'var(--color-warning)',
        preparing: 'var(--color-info)',
        ready: '#6D5BD0',
        completed: 'var(--color-success)',
        cancelled: 'var(--color-danger)',
        primary: 'var(--color-primary)'
    };

    function tone(name) {
        return TONES[name] || 'var(--color-primary)';
    }

    function el(tag, attrs) {
        var node = document.createElementNS(NS, tag);
        for (var key in attrs) {
            if (Object.prototype.hasOwnProperty.call(attrs, key)) {
                node.setAttribute(key, attrs[key]);
            }
        }
        return node;
    }

    function empty(container, message) {
        container.innerHTML = '<p class="chart-empty muted">' + message + '</p>';
    }


    /* ----------------------------------------------------------------------
     *  DONUT
     * ------------------------------------------------------------------- */

    function donut(container, segments, options) {
        if (!container) {
            return;
        }

        var data = segments.filter(function (s) { return Number(s.value) > 0; });
        var total = data.reduce(function (sum, s) { return sum + Number(s.value); }, 0);

        if (total === 0) {
            empty(container, 'Nothing to show yet.');
            return;
        }

        var size = 168;
        var stroke = 26;
        var radius = (size - stroke) / 2;
        var circumference = 2 * Math.PI * radius;

        var svg = el('svg', {
            viewBox: '0 0 ' + size + ' ' + size,
            width: size,
            height: size,
            role: 'img',
            'aria-label': (options && options.label) || 'Breakdown chart'
        });

        // Track
        svg.appendChild(el('circle', {
            cx: size / 2,
            cy: size / 2,
            r: radius,
            fill: 'none',
            stroke: 'var(--color-bg-sunk)',
            'stroke-width': stroke
        }));

        var offset = 0;

        data.forEach(function (segment) {
            var fraction = Number(segment.value) / total;
            var length = fraction * circumference;

            var arc = el('circle', {
                cx: size / 2,
                cy: size / 2,
                r: radius,
                fill: 'none',
                stroke: tone(segment.tone),
                'stroke-width': stroke,
                // A gap between segments reads as deliberate rather than sloppy.
                'stroke-dasharray': Math.max(length - 3, 1) + ' ' + (circumference - Math.max(length - 3, 1)),
                'stroke-dashoffset': -offset,
                // Start at 12 o'clock instead of 3 o'clock.
                transform: 'rotate(-90 ' + (size / 2) + ' ' + (size / 2) + ')',
                'stroke-linecap': 'butt'
            });

            var title = el('title');
            title.textContent = segment.label + ': ' + segment.value;
            arc.appendChild(title);

            svg.appendChild(arc);
            offset += length;
        });

        // Centre figure
        var value = el('text', {
            x: '50%',
            y: '50%',
            'text-anchor': 'middle',
            'dominant-baseline': 'central',
            fill: 'var(--color-ink)',
            'font-size': '30',
            'font-weight': '800',
            'letter-spacing': '-0.02em'
        });
        value.textContent = total;
        svg.appendChild(value);

        var caption = el('text', {
            x: '50%',
            y: '50%',
            dy: '24',
            'text-anchor': 'middle',
            fill: 'var(--color-ink-muted)',
            'font-size': '11',
            'font-weight': '600',
            'letter-spacing': '0.08em'
        });
        caption.textContent = (options && options.caption) || 'TOTAL';
        svg.appendChild(caption);

        var figure = document.createElement('div');
        figure.className = 'chart-donut-figure';
        figure.appendChild(svg);

        var legend = document.createElement('ul');
        legend.className = 'chart-legend';
        legend.innerHTML = segments.map(function (segment) {
            var percent = total > 0
                ? Math.round((Number(segment.value) / total) * 100)
                : 0;

            return '<li>' +
                '<span class="chart-swatch" style="background:' + tone(segment.tone) + '"></span>' +
                '<span class="chart-legend-label">' + segment.label + '</span>' +
                '<span class="chart-legend-value">' + segment.value +
                    '<small>' + percent + '%</small></span>' +
            '</li>';
        }).join('');

        container.innerHTML = '';
        container.className = (container.className + ' chart-donut').trim();
        container.appendChild(figure);
        container.appendChild(legend);
    }


    /* ----------------------------------------------------------------------
     *  HORIZONTAL BARS
     * ------------------------------------------------------------------- */

    function bars(container, rows, options) {
        if (!container) {
            return;
        }

        var data = rows.filter(function (r) { return Number(r.value) > 0; });

        if (data.length === 0) {
            empty(container, 'Nothing to show yet.');
            return;
        }

        var max = Math.max.apply(null, data.map(function (r) { return Number(r.value); }));
        var format = (options && options.format) || function (v) { return v; };

        container.innerHTML = '<ul class="chart-bars">' + data.map(function (row) {
            var width = max > 0 ? (Number(row.value) / max) * 100 : 0;

            return '<li>' +
                '<span class="chart-bar-label">' + row.label + '</span>' +
                '<span class="chart-bar-track">' +
                    '<span class="chart-bar-fill" style="width:' + width + '%"></span>' +
                '</span>' +
                '<span class="chart-bar-value">' + format(row.value) + '</span>' +
            '</li>';
        }).join('') + '</ul>';
    }


    window.charts = { donut: donut, bars: bars, tone: tone };
})();
