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
        const allSessions = Storage.getUserSessions(userId);
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
        renderInsights(userId, sessions, allSessions);
        renderVolumeChart(sessions);
        renderFrequencyChart(allSessions);
        renderMuscleDistribution(sessions);
        renderTopExercises(sessions);
        renderExerciseSelector(userId);
        renderExerciseChart(userId, document.getElementById('dash-exercise').value);
        render1RMs(allSessions);
        renderRecords(userId);
        renderPRTimeline(allSessions);
    }

    // ===== HELPERS for new visualizations =====
    function escapeText(s) {
        return String(s == null ? '' : s)
            .replace(/&/g, '&amp;')
            .replace(/</g, '&lt;')
            .replace(/>/g, '&gt;')
            .replace(/"/g, '&quot;');
    }

    /**
     * Compute insights for the period: best day of week, average duration,
     * sessions per week.
     */
    function calcInsights(sessions) {
        if (sessions.length === 0) return { hasData: false };
        const dayCounts = [0,0,0,0,0,0,0];
        const dayNames = ['Domingo','Lunes','Martes','Miércoles','Jueves','Viernes','Sábado'];
        let totalSec = 0;
        for (const s of sessions) {
            dayCounts[new Date(s.date).getDay()]++;
            totalSec += (s.durationSec || 0);
        }
        const maxCount = Math.max(...dayCounts);
        const bestDayIdx = dayCounts.indexOf(maxCount);
        const avgMin = Math.round(totalSec / sessions.length / 60);

        // Sessions per week across the active span
        const dates = sessions.map(s => new Date(s.date).getTime()).sort((a, b) => a - b);
        const spanMs = Math.max(86400000, dates[dates.length - 1] - dates[0]);
        const spanWeeks = Math.max(1, spanMs / (7 * 86400000));
        const sessionsPerWeek = (sessions.length / spanWeeks);

        return {
            hasData: true,
            bestDay: dayNames[bestDayIdx],
            bestDayCount: maxCount,
            avgMin,
            sessionsPerWeek
        };
    }

    function renderInsights(userId, sessions) {
        const container = document.getElementById('dash-insights');
        if (!container) return;
        const i = calcInsights(sessions);
        if (!i.hasData) {
            container.innerHTML = '<p style="grid-column:1/-1;text-align:center;color:var(--text-3);font-size:13px;padding:8px 0">Aparecerán insights cuando completes algunas sesiones más.</p>';
            return;
        }
        container.innerHTML = `
            <div class="insight-card">
                <span class="insight-icon">📅</span>
                <p class="insight-label">Mejor día</p>
                <p class="insight-value">${escapeText(i.bestDay)}</p>
                <p class="insight-meta">${i.bestDayCount} ${i.bestDayCount === 1 ? 'sesión' : 'sesiones'}</p>
            </div>
            <div class="insight-card">
                <span class="insight-icon">⏱️</span>
                <p class="insight-label">Duración media</p>
                <p class="insight-value">${i.avgMin}<small>min</small></p>
                <p class="insight-meta">por sesión</p>
            </div>
            <div class="insight-card">
                <span class="insight-icon">🔥</span>
                <p class="insight-label">Constancia</p>
                <p class="insight-value">${i.sessionsPerWeek.toFixed(1)}<small>/sem</small></p>
                <p class="insight-meta">promedio</p>
            </div>
        `;
    }

    /**
     * Group volume by muscle across sessions in the period.
     */
    function calcMuscleDistribution(sessions) {
        const dist = new Map();
        for (const s of sessions) {
            for (const ex of s.exercises || []) {
                const muscle = (ex.muscle || 'Sin clasificar').trim() || 'Sin clasificar';
                let vol = 0;
                for (const set of ex.sets || []) {
                    if (set.completed && set.weight && set.reps) {
                        vol += set.weight * set.reps;
                    }
                }
                if (vol > 0) dist.set(muscle, (dist.get(muscle) || 0) + vol);
            }
        }
        return [...dist.entries()]
            .map(([name, value]) => ({ name, value }))
            .sort((a, b) => b.value - a.value);
    }

    function renderMuscleDistribution(sessions) {
        const container = document.getElementById('muscle-distribution');
        if (!container) return;
        const data = calcMuscleDistribution(sessions);
        if (data.length === 0) {
            container.innerHTML = '<p style="text-align:center;color:var(--text-3);font-size:13px;padding:18px 0">Aún no tenemos datos suficientes para esta vista.</p>';
            return;
        }
        const total = data.reduce((acc, d) => acc + d.value, 0);
        const palette = ['#5EEAB0', '#B5A8FF', '#FFB088', '#7C5CFF', '#3DC894', '#FF8A66', '#8BF1C8', '#9BA1B0'];

        // Build SVG donut
        const cx = 70, cy = 70, r = 56, innerR = 36;
        let cumulative = 0;
        const slices = data.map((d, i) => {
            const startPct = cumulative / total;
            cumulative += d.value;
            const endPct = cumulative / total;
            const a1 = startPct * 2 * Math.PI - Math.PI / 2;
            const a2 = endPct * 2 * Math.PI - Math.PI / 2;
            const x1o = cx + r * Math.cos(a1);
            const y1o = cy + r * Math.sin(a1);
            const x2o = cx + r * Math.cos(a2);
            const y2o = cy + r * Math.sin(a2);
            const x1i = cx + innerR * Math.cos(a2);
            const y1i = cy + innerR * Math.sin(a2);
            const x2i = cx + innerR * Math.cos(a1);
            const y2i = cy + innerR * Math.sin(a1);
            const largeArc = (endPct - startPct) > 0.5 ? 1 : 0;
            // Donut wedge path
            return `<path d="M ${x1o} ${y1o} A ${r} ${r} 0 ${largeArc} 1 ${x2o} ${y2o} L ${x1i} ${y1i} A ${innerR} ${innerR} 0 ${largeArc} 0 ${x2i} ${y2i} Z" fill="${palette[i % palette.length]}"/>`;
        }).join('');

        const legend = data.map((d, i) => `
            <li>
                <span class="dot" style="background:${palette[i % palette.length]}"></span>
                <span class="name">${escapeText(d.name)}</span>
                <span class="pct">${Math.round((d.value / total) * 100)}%</span>
            </li>
        `).join('');

        container.innerHTML = `
            <div class="donut-grid">
                <div class="donut-svg">
                    <svg viewBox="0 0 140 140" xmlns="http://www.w3.org/2000/svg">
                        ${slices}
                        <text x="70" y="68" text-anchor="middle" font-family="Inter" font-size="9" font-weight="600" fill="var(--text-3)" letter-spacing="0.5">VOLUMEN</text>
                        <text x="70" y="86" text-anchor="middle" font-family="Fraunces" font-size="16" font-weight="500" fill="var(--text-0)">${formatShortKg(total)}</text>
                    </svg>
                </div>
                <ul class="donut-legend">${legend}</ul>
            </div>
        `;
    }

    function formatShortKg(v) {
        if (v >= 100000) return Math.round(v / 1000) + 'k';
        if (v >= 10000) return (v / 1000).toFixed(1) + 'k';
        return Math.round(v).toLocaleString('es-ES');
    }

    /**
     * Top exercises by total volume in the active period.
     */
    function calcTopExercises(sessions, limit = 5) {
        const map = new Map();
        for (const s of sessions) {
            for (const ex of s.exercises || []) {
                const key = ex.id || ex.name;
                let vol = 0;
                for (const set of ex.sets || []) {
                    if (set.completed && set.weight && set.reps) {
                        vol += set.weight * set.reps;
                    }
                }
                const cur = map.get(key) || { name: ex.name, volume: 0, sets: 0 };
                cur.volume += vol;
                cur.sets += (ex.sets || []).filter(s => s.completed).length;
                map.set(key, cur);
            }
        }
        return [...map.values()]
            .filter(e => e.volume > 0)
            .sort((a, b) => b.volume - a.volume)
            .slice(0, limit);
    }

    function renderTopExercises(sessions) {
        const container = document.getElementById('top-exercises');
        if (!container) return;
        const top = calcTopExercises(sessions);
        if (top.length === 0) {
            container.innerHTML = '<p style="text-align:center;color:var(--text-3);font-size:13px;padding:18px 0">Empieza a entrenar para ver tus ejercicios más cargados.</p>';
            return;
        }
        const max = top[0].volume;
        container.innerHTML = top.map((ex, i) => `
            <div class="bar-row">
                <div class="bar-label">
                    <span class="bar-rank">${i + 1}</span>
                    <span class="bar-name" title="${escapeText(ex.name)}">${escapeText(ex.name)}</span>
                </div>
                <div class="bar-track"><div class="bar-fill" style="width:${(ex.volume / max) * 100}%"></div></div>
                <div class="bar-value">${formatShortKg(ex.volume)}<small>kg</small></div>
            </div>
        `).join('');
    }

    /**
     * Estimated 1RM via Epley: 1RM = w * (1 + reps/30).
     * For each exercise, find the best (highest 1RM) completed set across all sessions.
     */
    function calc1RMs(allSessions, limit = 6) {
        const best = new Map();
        for (const s of allSessions) {
            for (const ex of s.exercises || []) {
                for (const set of ex.sets || []) {
                    if (!set.completed || !set.weight || !set.reps) continue;
                    if (set.reps > 12) continue; // formula loses accuracy beyond 12
                    const oneRm = set.weight * (1 + set.reps / 30);
                    const cur = best.get(ex.id);
                    if (!cur || oneRm > cur.oneRm) {
                        best.set(ex.id, {
                            name: ex.name,
                            oneRm,
                            weight: set.weight,
                            reps: set.reps
                        });
                    }
                }
            }
        }
        return [...best.values()]
            .sort((a, b) => b.oneRm - a.oneRm)
            .slice(0, limit);
    }

    function render1RMs(allSessions) {
        const container = document.getElementById('dash-1rm');
        if (!container) return;
        const list = calc1RMs(allSessions);
        if (list.length === 0) {
            container.innerHTML = '<p style="text-align:center;color:var(--text-3);font-size:13px;padding:14px 0">Tu 1RM estimado aparecerá cuando registres tus primeras series.</p>';
            return;
        }
        container.innerHTML = list.map(item => `
            <div class="onerm-item">
                <span class="name">${escapeText(item.name)}</span>
                <div style="text-align:right">
                    <div class="value">${item.oneRm.toFixed(1)}<small>kg</small></div>
                    <div class="source">desde ${item.weight} kg × ${item.reps}</div>
                </div>
            </div>
        `).join('');
    }

    /**
     * Build a chronological PR timeline by tracking the running max weight
     * per exercise. Each "improvement" event is recorded with date and gain.
     */
    function calcPRTimeline(allSessions, limit = 12) {
        const sortedAsc = [...allSessions].sort((a, b) => new Date(a.date) - new Date(b.date));
        const seen = new Map(); // exerciseId -> currentMax weight
        const events = [];
        for (const s of sortedAsc) {
            for (const ex of s.exercises || []) {
                let setMax = 0;
                let bestSet = null;
                for (const set of ex.sets || []) {
                    if (set.completed && set.weight > 0 && set.weight > setMax) {
                        setMax = set.weight;
                        bestSet = set;
                    }
                }
                if (setMax === 0) continue;
                const prev = seen.get(ex.id) || 0;
                if (setMax > prev) {
                    seen.set(ex.id, setMax);
                    if (prev > 0) { // skip the first time (no prior to compare)
                        events.push({
                            date: s.date,
                            name: ex.name,
                            weight: setMax,
                            reps: bestSet?.reps || 0,
                            gain: +(setMax - prev).toFixed(1)
                        });
                    }
                }
            }
        }
        return events.reverse().slice(0, limit);
    }

    function renderPRTimeline(allSessions) {
        const container = document.getElementById('pr-timeline');
        if (!container) return;
        const prs = calcPRTimeline(allSessions);
        if (prs.length === 0) {
            container.innerHTML = '<p style="text-align:center;color:var(--text-3);font-size:13px;padding:14px 0">Cuando superes un peso anterior, lo verás aquí. ¡A por el primero!</p>';
            return;
        }
        const monthShort = ['ene','feb','mar','abr','may','jun','jul','ago','sep','oct','nov','dic'];
        container.innerHTML = prs.map(pr => {
            const dt = new Date(pr.date);
            return `
                <div class="pr-item">
                    <div class="pr-item-date">${dt.getDate()}<small>${monthShort[dt.getMonth()]}</small></div>
                    <div class="pr-item-info">
                        <p class="pr-item-name">${escapeText(pr.name)}</p>
                        <p class="pr-item-meta">${pr.weight} kg × ${pr.reps} reps · <span class="gain">+${pr.gain} kg</span></p>
                    </div>
                    <span class="pr-item-icon">🏆</span>
                </div>
            `;
        }).join('');
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
