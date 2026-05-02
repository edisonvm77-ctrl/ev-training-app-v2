/**
 * Dashboard module: computes statistics and renders charts for the active user
 */

const Dashboard = (() => {
    let charts = {};

    function destroyCharts() {
        Object.values(charts).forEach(c => c && c.destroy && c.destroy());
        charts = {};
    }

    function periodToRange(period) {
        const now = new Date();
        const end = new Date(now);
        const start = new Date(now);
        switch (period) {
            case 'week': start.setDate(now.getDate() - 7); break;
            case 'month': start.setDate(now.getDate() - 30); break;
            case '3month': start.setDate(now.getDate() - 90); break;
            case 'all': start.setFullYear(2000); break;
        }
        return { start, end };
    }

    function filterSessions(userId, period) {
        const { start, end } = periodToRange(period);
        return Storage.getUserSessions(userId).filter(s => {
            const d = new Date(s.date);
            return d >= start && d <= end;
        });
    }

    function calcTotals(sessions) {
        let volume = 0, reps = 0, time = 0, sets = 0;
        for (const s of sessions) {
            if (s.totals) {
                volume += s.totals.volume || 0;
                reps += s.totals.reps || 0;
                sets += s.totals.sets || 0;
            }
            time += (s.durationSec || 0) / 60;
        }
        return { sessions: sessions.length, volume, reps, sets, time };
    }

    function calcPrevTotals(userId, period) {
        const { start, end } = periodToRange(period);
        const span = end - start;
        const prevEnd = new Date(start);
        const prevStart = new Date(start.getTime() - span);
        const sessions = Storage.getUserSessions(userId).filter(s => {
            const d = new Date(s.date);
            return d >= prevStart && d < prevEnd;
        });
        return calcTotals(sessions);
    }

    function pctChange(curr, prev) {
        if (prev === 0) {
            return curr > 0 ? { txt: 'Nuevo!', cls: '' } : { txt: '', cls: 'flat' };
        }
        const diff = ((curr - prev) / prev) * 100;
        if (Math.abs(diff) < 0.5) return { txt: 'Sin cambios', cls: 'flat' };
        const sign = diff > 0 ? '↑' : '↓';
        return {
            txt: `${sign} ${Math.abs(diff).toFixed(1)}% vs período anterior`,
            cls: diff > 0 ? '' : 'down'
        };
    }

    function render(userId, period = 'month') {
        const sessions = filterSessions(userId, period);
        const totals = calcTotals(sessions);
        const prev = calcPrevTotals(userId, period);

        document.getElementById('dash-sessions').textContent = totals.sessions;
        document.getElementById('dash-volume').textContent = Math.round(totals.volume).toLocaleString('es-ES');
        document.getElementById('dash-reps').textContent = totals.reps;
        document.getElementById('dash-time').textContent = Math.round(totals.time);

        const c1 = pctChange(totals.sessions, prev.sessions);
        const c2 = pctChange(totals.volume, prev.volume);
        const c3 = pctChange(totals.reps, prev.reps);
        const c4 = pctChange(totals.time, prev.time);
        const elc1 = document.getElementById('dash-sessions-change');
        const elc2 = document.getElementById('dash-volume-change');
        const elc3 = document.getElementById('dash-reps-change');
        const elc4 = document.getElementById('dash-time-change');
        elc1.textContent = c1.txt; elc1.className = 'dash-stat-change ' + c1.cls;
        elc2.textContent = c2.txt; elc2.className = 'dash-stat-change ' + c2.cls;
        elc3.textContent = c3.txt; elc3.className = 'dash-stat-change ' + c3.cls;
        elc4.textContent = c4.txt; elc4.className = 'dash-stat-change ' + c4.cls;

        destroyCharts();
        renderVolumeChart(sessions);
        renderFrequencyChart(sessions);
        renderExerciseSelector(userId);
        renderExerciseChart(userId, document.getElementById('dash-exercise').value);
        renderRecords(userId);
    }

    function renderVolumeChart(sessions) {
        const ctx = document.getElementById('chart-volume');
        if (!ctx) return;
        const ordered = [...sessions].sort((a,b) => new Date(a.date) - new Date(b.date));
        const labels = ordered.map(s => {
            const d = new Date(s.date);
            return d.getDate() + '/' + (d.getMonth() + 1);
        });
        const data = ordered.map(s => Math.round(s.totals?.volume || 0));

        charts.volume = new Chart(ctx, {
            type: 'line',
            data: {
                labels,
                datasets: [{
                    data,
                    borderColor: '#00FF94',
                    backgroundColor: ctxObj => {
                        const chart = ctxObj.chart;
                        const { ctx: c, chartArea } = chart;
                        if (!chartArea) return 'rgba(0,255,148,0.15)';
                        const grad = c.createLinearGradient(0, chartArea.top, 0, chartArea.bottom);
                        grad.addColorStop(0, 'rgba(0,255,148,0.35)');
                        grad.addColorStop(1, 'rgba(0,255,148,0)');
                        return grad;
                    },
                    borderWidth: 2.5,
                    pointBackgroundColor: '#00FF94',
                    pointRadius: 3,
                    fill: true,
                    tension: 0.35
                }]
            },
            options: chartOptions({ unit: 'kg' })
        });
    }

    /**
     * Calendar heatmap — last 12 weeks like GitHub.
     * Replaces the old bar chart with a more glanceable visualization.
     */
    function renderFrequencyChart(sessions) {
        // Find or convert canvas to a div container
        const canvas = document.getElementById('chart-frequency');
        if (!canvas) return;
        let container = canvas.parentElement;
        // Replace the canvas with our custom div if not yet done
        if (canvas.tagName === 'CANVAS') {
            const div = document.createElement('div');
            div.id = 'chart-frequency';
            div.className = 'heatmap-wrap';
            canvas.replaceWith(div);
            container = div.parentElement;
        }
        const grid = document.getElementById('chart-frequency');
        grid.innerHTML = '';

        // Build last 84 days (12 weeks) ending today
        const today = new Date();
        today.setHours(0, 0, 0, 0);
        const sessionsByDate = new Map();
        for (const s of sessions) {
            const d = new Date(s.date);
            d.setHours(0, 0, 0, 0);
            const key = d.getTime();
            sessionsByDate.set(key, (sessionsByDate.get(key) || 0) + 1);
        }

        // Compute volume max for intensity scaling
        const days = [];
        for (let i = 83; i >= 0; i--) {
            const d = new Date(today);
            d.setDate(today.getDate() - i);
            const key = d.getTime();
            const count = sessionsByDate.get(key) || 0;
            days.push({ date: d, count });
        }

        // Render: 12 columns (weeks) x 7 rows (days), Mon..Sun
        // Align so that the rightmost column ends with today
        const monthLabel = document.createElement('div');
        monthLabel.className = 'heatmap-months';
        const dayLabels = document.createElement('div');
        dayLabels.className = 'heatmap-days';
        ['L', 'M', 'X', 'J', 'V', 'S', 'D'].forEach(label => {
            const d = document.createElement('span');
            d.textContent = label;
            dayLabels.appendChild(d);
        });
        const cells = document.createElement('div');
        cells.className = 'heatmap-cells';

        // Reorganize: rows = weekday (0=Mon..6=Sun), cols = week
        const cellsByPos = [];
        for (let r = 0; r < 7; r++) cellsByPos.push([]);
        for (const day of days) {
            // JS getDay: 0=Sun..6=Sat. Convert to Mon=0..Sun=6
            const wd = (day.date.getDay() + 6) % 7;
            cellsByPos[wd].push(day);
        }

        // Determine max count for color intensity
        const maxCount = Math.max(1, ...days.map(d => d.count));

        for (let r = 0; r < 7; r++) {
            const row = document.createElement('div');
            row.className = 'heatmap-row';
            for (const day of cellsByPos[r]) {
                const cell = document.createElement('div');
                cell.className = 'heatmap-cell';
                if (day.count === 0) {
                    cell.classList.add('hm-empty');
                } else {
                    const level = Math.min(4, Math.ceil((day.count / maxCount) * 4));
                    cell.classList.add('hm-l' + level);
                }
                if (day.date.getTime() === today.getTime()) cell.classList.add('hm-today');
                cell.title = day.date.toLocaleDateString('es-ES', { weekday: 'short', day: 'numeric', month: 'short' }) + (day.count ? ` · ${day.count} sesión(es)` : ' · sin entrenamiento');
                row.appendChild(cell);
            }
            cells.appendChild(row);
        }

        const wrap = document.createElement('div');
        wrap.className = 'heatmap-inner';
        wrap.appendChild(dayLabels);
        wrap.appendChild(cells);
        grid.appendChild(wrap);

        const legend = document.createElement('div');
        legend.className = 'heatmap-legend';
        legend.innerHTML = `
            <span>menos</span>
            <span class="heatmap-cell hm-empty"></span>
            <span class="heatmap-cell hm-l1"></span>
            <span class="heatmap-cell hm-l2"></span>
            <span class="heatmap-cell hm-l3"></span>
            <span class="heatmap-cell hm-l4"></span>
            <span>más</span>
        `;
        grid.appendChild(legend);
    }

    function renderExerciseSelector(userId) {
        const sel = document.getElementById('dash-exercise');
        if (!sel) return;
        const sessions = Storage.getUserSessions(userId);
        const seen = new Map();
        for (const s of sessions) {
            for (const ex of s.exercises || []) {
                if (!seen.has(ex.id)) seen.set(ex.id, ex.name);
            }
        }
        // Add all default routine exercises so selection works even with no sessions
        for (const r of ROUTINES) for (const ex of r.exercises) {
            if (!seen.has(ex.id)) seen.set(ex.id, ex.name);
        }
        const current = sel.value;
        sel.innerHTML = '';
        for (const [id, name] of seen) {
            const opt = document.createElement('option');
            opt.value = id; opt.textContent = name;
            sel.appendChild(opt);
        }
        if (current && seen.has(current)) sel.value = current;
    }

    function renderExerciseChart(userId, exerciseId) {
        const ctx = document.getElementById('chart-exercise');
        if (!ctx || !exerciseId) return;
        const sessions = Storage.getUserSessions(userId);
        const points = [];
        for (const s of sessions) {
            for (const ex of s.exercises || []) {
                if (ex.id === exerciseId) {
                    let maxW = 0;
                    for (const set of ex.sets) {
                        if (set.completed && set.weight && set.weight > maxW) maxW = set.weight;
                    }
                    if (maxW > 0) points.push({ x: new Date(s.date), y: maxW });
                }
            }
        }
        points.sort((a,b) => a.x - b.x);
        const labels = points.map(p => p.x.getDate() + '/' + (p.x.getMonth() + 1));
        const data = points.map(p => p.y);

        charts.exercise = new Chart(ctx, {
            type: 'line',
            data: {
                labels,
                datasets: [{
                    data,
                    borderColor: '#00D9A3',
                    backgroundColor: 'rgba(0, 217, 163, 0.15)',
                    borderWidth: 2.5,
                    pointBackgroundColor: '#00D9A3',
                    pointRadius: 4,
                    fill: true,
                    tension: 0.3
                }]
            },
            options: chartOptions({ unit: 'kg' })
        });
    }

    function renderRecords(userId) {
        const list = document.getElementById('dash-records');
        if (!list) return;
        const sessions = Storage.getUserSessions(userId);
        const records = new Map(); // exerciseId -> { name, weight, reps, date }
        for (const s of sessions) {
            for (const ex of s.exercises || []) {
                for (const set of ex.sets) {
                    if (!set.completed || !set.weight) continue;
                    const cur = records.get(ex.id);
                    if (!cur || set.weight > cur.weight) {
                        records.set(ex.id, {
                            name: ex.name,
                            weight: set.weight,
                            reps: set.reps,
                            date: s.date
                        });
                    }
                }
            }
        }
        if (records.size === 0) {
            list.innerHTML = '<p style="text-align:center;color:var(--text-2);padding:18px 8px 6px;font-size:13px;line-height:1.5">Tus récords aparecerán aquí en cuanto completes tu primera sesión.</p>';
            return;
        }
        list.innerHTML = '';
        const sorted = [...records.values()].sort((a,b) => b.weight - a.weight).slice(0, 10);
        for (const r of sorted) {
            const div = document.createElement('div');
            div.className = 'record-item';
            div.innerHTML = `
                <div class="name">${r.name}</div>
                <div class="value">${r.weight} kg × ${r.reps}</div>
            `;
            list.appendChild(div);
        }
    }

    function chartOptions({ unit = '', noUnit = false, integerY = false } = {}) {
        return {
            responsive: true,
            maintainAspectRatio: false,
            animation: { duration: 1100, easing: 'easeOutCubic' },
            plugins: {
                legend: { display: false },
                tooltip: {
                    backgroundColor: '#1A2530',
                    titleColor: '#F2EBDA',
                    bodyColor: '#DCD4C2',
                    borderColor: 'rgba(94, 234, 176, 0.3)',
                    borderWidth: 1,
                    padding: 12,
                    cornerRadius: 14,
                    boxPadding: 6,
                    titleFont: { family: 'Fraunces', size: 14, weight: '500' },
                    bodyFont: { family: 'Inter', size: 13 },
                    displayColors: false,
                    callbacks: noUnit ? {} : {
                        label: ctx => `${ctx.parsed.y.toLocaleString('es-ES')} ${unit}`
                    }
                }
            },
            scales: {
                x: {
                    grid: { display: false },
                    border: { display: false },
                    ticks: { color: '#646B7A', font: { family: 'Inter', size: 11, weight: 500 } }
                },
                y: {
                    beginAtZero: true,
                    grid: { color: 'rgba(255, 235, 200, 0.04)', drawTicks: false },
                    border: { display: false },
                    ticks: {
                        color: '#646B7A',
                        font: { family: 'Inter', size: 11, weight: 500 },
                        precision: integerY ? 0 : undefined,
                        padding: 8,
                        maxTicksLimit: 4
                    }
                }
            }
        };
    }

    function calcStreak(userId) {
        const sessions = Storage.getUserSessions(userId);
        if (sessions.length === 0) return 0;
        // Count distinct days in current streak (back from today)
        const days = new Set(sessions.map(s => new Date(s.date).toDateString()));
        let streak = 0;
        const cur = new Date();
        cur.setHours(0,0,0,0);
        // tolerance: allow 1 day gap
        let gaps = 0;
        for (let i = 0; i < 60; i++) {
            const key = cur.toDateString();
            if (days.has(key)) {
                streak++;
                gaps = 0;
            } else {
                gaps++;
                if (gaps > 2) break;
            }
            cur.setDate(cur.getDate() - 1);
        }
        return streak;
    }

    function calcMonthSessions(userId) {
        const now = new Date();
        const month = now.getMonth();
        const year = now.getFullYear();
        return Storage.getUserSessions(userId).filter(s => {
            const d = new Date(s.date);
            return d.getMonth() === month && d.getFullYear() === year;
        }).length;
    }

    function calcMonthVolume(userId) {
        const now = new Date();
        const month = now.getMonth();
        const year = now.getFullYear();
        return Storage.getUserSessions(userId).filter(s => {
            const d = new Date(s.date);
            return d.getMonth() === month && d.getFullYear() === year;
        }).reduce((acc, s) => acc + (s.totals?.volume || 0), 0);
    }

    return { render, calcStreak, calcMonthSessions, calcMonthVolume };
})();
