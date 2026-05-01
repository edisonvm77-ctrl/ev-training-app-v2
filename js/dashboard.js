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

    function renderFrequencyChart(sessions) {
        const ctx = document.getElementById('chart-frequency');
        if (!ctx) return;
        const counts = [0, 0, 0, 0, 0, 0, 0]; // Sun..Sat
        for (const s of sessions) {
            const d = new Date(s.date).getDay();
            counts[d]++;
        }
        const labels = ['Dom','Lun','Mar','Mié','Jue','Vie','Sáb'];

        charts.frequency = new Chart(ctx, {
            type: 'bar',
            data: {
                labels,
                datasets: [{
                    data: counts,
                    backgroundColor: ctxObj => {
                        const chart = ctxObj.chart;
                        const { ctx: c, chartArea } = chart;
                        if (!chartArea) return '#7C5CFF';
                        const grad = c.createLinearGradient(0, chartArea.top, 0, chartArea.bottom);
                        grad.addColorStop(0, '#00FF94');
                        grad.addColorStop(1, '#00B8FF');
                        return grad;
                    },
                    borderRadius: 8,
                    borderSkipped: false
                }]
            },
            options: chartOptions({ noUnit: true, integerY: true })
        });
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
            list.innerHTML = '<div style="text-align:center;color:var(--text-2);padding:20px 0;font-size:13px">Aún no hay récords. ¡Empieza a entrenar!</div>';
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
            plugins: {
                legend: { display: false },
                tooltip: {
                    backgroundColor: 'rgba(17, 22, 42, 0.95)',
                    titleColor: '#fff',
                    bodyColor: '#E5E9F2',
                    borderColor: 'rgba(255,255,255,0.1)',
                    borderWidth: 1,
                    padding: 10,
                    cornerRadius: 8,
                    callbacks: noUnit ? {} : {
                        label: ctx => `${ctx.parsed.y} ${unit}`
                    }
                }
            },
            scales: {
                x: {
                    grid: { display: false },
                    ticks: { color: '#5C6480', font: { size: 11 } }
                },
                y: {
                    beginAtZero: true,
                    grid: { color: 'rgba(255,255,255,0.05)' },
                    ticks: {
                        color: '#5C6480',
                        font: { size: 11 },
                        precision: integerY ? 0 : undefined
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
