/**
 * Main application controller
 */

const App = (() => {
    let currentView = 'home';
    let selectedRoutine = null;
    let lastSavedSession = null;

    const $ = sel => document.querySelector(sel);
    const $$ = sel => document.querySelectorAll(sel);

    /**
     * Find a routine by id, looking first at the current user's custom routines
     * (stored on the user record) and then at the built-in ROUTINES array.
     */
    function findRoutine(routineId) {
        const user = Storage.getCurrentUser();
        if (user && Array.isArray(user.customRoutines)) {
            const found = user.customRoutines.find(r => r && r.id === routineId);
            if (found) return found;
        }
        return ROUTINES.find(r => r.id === routineId) || null;
    }

    /**
     * Returns the list of routines the current user is allowed to see/run.
     * Includes the user's custom routines plus the built-in routines whose ids
     * appear in user.routines (defaults to all built-ins for legacy users).
     */
    function getRoutinesForUser(user) {
        if (!user) return ROUTINES.slice();
        const customs = Array.isArray(user.customRoutines) ? user.customRoutines : [];
        const allowedIds = Array.isArray(user.routines) && user.routines.length > 0
            ? user.routines
            : ROUTINES.map(r => r.id);
        const customIds = new Set(customs.map(r => r.id));
        const builtins = ROUTINES.filter(r => allowedIds.includes(r.id));
        return [...builtins, ...customs.filter(r => allowedIds.includes(r.id) || !customIds.has(r.id))];
    }

    /**
     * Smoothly animate a number from current displayed value to target.
     * Locale formatting is preserved.
     */
    function animateNumber(el, target, duration = 800) {
        if (!el) return;
        const start = parseInt(String(el.textContent).replace(/[^\d-]/g, ''), 10) || 0;
        if (start === target) {
            el.textContent = target.toLocaleString('es-ES');
            return;
        }
        const t0 = performance.now();
        const diff = target - start;
        function tick(now) {
            const t = Math.min(1, (now - t0) / duration);
            // ease-out cubic
            const eased = 1 - Math.pow(1 - t, 3);
            const value = Math.round(start + diff * eased);
            el.textContent = value.toLocaleString('es-ES');
            if (t < 1) requestAnimationFrame(tick);
        }
        requestAnimationFrame(tick);
    }

    /**
     * Compute a "readiness" state based on:
     *  - days since last training (recovery)
     *  - consecutive training days (overtraining risk)
     * Returns { score 0-1, status, emoji, insight, label }
     */
    function computeReadiness(userId) {
        const sessions = Storage.getUserSessions(userId);
        if (sessions.length === 0) {
            return {
                score: 0.85,
                status: 'Empezar',
                emoji: '✨',
                insight: 'Ningún entrenamiento aún. ¡Hoy es un buen día para tu primero!',
                label: 'Tu estado'
            };
        }
        const now = new Date();
        const lastDate = new Date(sessions[0].date);
        const daysSinceLast = Math.floor((now - lastDate) / 86400000);
        // Count consecutive training days going back from today
        const sessDates = new Set(sessions.map(s => new Date(s.date).toDateString()));
        let consecutive = 0;
        const cur = new Date();
        for (let i = 0; i < 14; i++) {
            if (sessDates.has(cur.toDateString())) consecutive++;
            else if (i > 0) break;
            cur.setDate(cur.getDate() - 1);
        }

        // Same-routine recovery (group by routineId of last session)
        const lastRoutineId = sessions[0].routineId;
        const sameRoutineLast = sessions.find((s, i) => i > 0 && s.routineId === lastRoutineId);
        const daysSameMuscle = sameRoutineLast
            ? Math.floor((now - new Date(sameRoutineLast.date)) / 86400000)
            : 99;

        // Score logic
        if (daysSinceLast === 0 && consecutive >= 5) {
            return {
                score: 0.25,
                status: 'Descansa',
                emoji: '🌙',
                insight: `Llevas ${consecutive} días seguidos entrenando. Hoy puede ser un día de recuperación.`,
                label: 'Tu estado'
            };
        }
        if (consecutive >= 4) {
            return {
                score: 0.5,
                status: 'Toma con calma',
                emoji: '🍃',
                insight: `Llevas ${consecutive} sesiones seguidas. Escucha a tu cuerpo hoy.`,
                label: 'Tu estado'
            };
        }
        if (daysSinceLast === 0) {
            return {
                score: 0.7,
                status: 'Activo',
                emoji: '💪',
                insight: 'Ya entrenaste hoy. ¿Quieres añadir algo ligero o descansar?',
                label: 'Tu estado'
            };
        }
        if (daysSinceLast === 1) {
            return {
                score: 0.95,
                status: 'Listo',
                emoji: '🌿',
                insight: 'Día perfecto para entrenar. Tu cuerpo está recuperado.',
                label: 'Tu estado'
            };
        }
        if (daysSinceLast >= 7) {
            return {
                score: 1,
                status: 'Reactivar',
                emoji: '🔆',
                insight: `Hace ${daysSinceLast} días que no entrenas. Empieza suave para reactivar el ritmo.`,
                label: 'Tu estado'
            };
        }
        return {
            score: 0.9,
            status: 'Listo',
            emoji: '🌱',
            insight: `Han pasado ${daysSinceLast} días desde tu último entrenamiento. Estás bien recuperado.`,
            label: 'Tu estado'
        };
    }

    function renderReadiness(user) {
        const r = computeReadiness(user.id);
        $('#readiness-status').textContent = r.status;
        $('#readiness-insight').textContent = r.insight;
        $('#readiness-emoji').textContent = r.emoji;
        $('#readiness-label').textContent = r.label;
        // Animate the ring
        const circumference = 2 * Math.PI * 52;
        const offset = circumference * (1 - r.score);
        const fg = $('#readiness-ring-fg');
        if (fg) {
            // Reset to 0 first to trigger animation
            fg.style.strokeDashoffset = circumference;
            requestAnimationFrame(() => {
                fg.style.strokeDashoffset = offset;
            });
        }
    }

    function fmtSec(sec) {
        const m = Math.floor(sec / 60);
        const s = sec % 60;
        return `${String(m).padStart(2, '0')}:${String(s).padStart(2, '0')}`;
    }
    function fmtMs(sec) {
        const m = Math.floor(sec / 60);
        const s = sec % 60;
        return `${m}:${String(s).padStart(2, '0')}`;
    }
    function fmtDate(d) {
        const date = typeof d === 'string' ? new Date(d) : d;
        return DAY_NAMES[date.getDay()] + ', ' + date.getDate() + ' de ' + MONTH_NAMES[date.getMonth()].toLowerCase();
    }
    function fmtDateShort(d) {
        const date = typeof d === 'string' ? new Date(d) : d;
        return date.getDate() + ' ' + MONTH_NAMES[date.getMonth()].slice(0, 3).toLowerCase();
    }

    function toast(msg, type = '') {
        const el = $('#toast');
        el.textContent = msg;
        el.className = 'toast show ' + type;
        clearTimeout(toast._t);
        toast._t = setTimeout(() => { el.className = 'toast ' + type; }, 2500);
    }

    function showModal(html) {
        const m = $('#modal');
        $('#modal-content').innerHTML = '<div class="modal-handle"></div>' + html;
        m.classList.remove('hidden');
        m.querySelector('.modal-overlay').onclick = closeModal;
        // Delegated handlers for elements rendered inside the modal
        $('#modal-content').querySelectorAll('[data-action="close-modal"]').forEach(el => {
            el.addEventListener('click', closeModal);
        });
    }
    function closeModal() {
        $('#modal').classList.add('hidden');
        $('#modal-content').innerHTML = '';
    }

    // ===== INIT =====
    async function init() {
        Storage.initialize();
        bindLogin();
        bindCloudIndicator();
        registerServiceWorker();

        // Try to bring up the cloud first (non-blocking after timeout).
        // We give Firebase up to ~6s to initialize and pull. If it takes longer,
        // we proceed offline and continue syncing in the background.
        let pullPromise = null;
        try {
            const cloudReady = await Promise.race([
                Cloud.init(),
                new Promise(r => setTimeout(() => r(false), 6000))
            ]);
            if (cloudReady) {
                pullPromise = Cloud.pullAll().then(snap => {
                    if (snap && Object.keys(snap).length > 0) {
                        Storage.hydrateFromCloud(snap);
                    } else {
                        // Cloud is empty: this is the first ever boot.
                        // Push local data (default admin) so the cloud is initialized.
                        Storage.pushAllToCloud();
                    }
                });
                // Wait briefly for hydration so the user sees fresh data
                await Promise.race([
                    pullPromise,
                    new Promise(r => setTimeout(r, 4000))
                ]);
            }
        } catch (e) {
            console.warn('[App] Cloud init failed, continuing offline:', e);
        }

        const user = Storage.getCurrentUser();
        if (user) {
            $('#screen-login').classList.add('hidden');
            showApp(user);
        }
        // hide boot
        setTimeout(() => $('#boot').classList.add('fade-out'), 350);
        setTimeout(() => { const b = $('#boot'); if (b) b.remove(); }, 800);
    }

    /**
     * Register the service worker so the app is installable as PWA and
     * works offline once cached. Silently fails on unsupported browsers
     * (older iOS, http://) — the app still runs perfectly without it.
     */
    function registerServiceWorker() {
        if (!('serviceWorker' in navigator)) return;
        // Avoid registration on file:// where SW is unsupported
        if (location.protocol !== 'https:' && location.hostname !== 'localhost' && location.hostname !== '127.0.0.1') return;
        window.addEventListener('load', () => {
            navigator.serviceWorker.register('./sw.js')
                .then(reg => console.log('[SW] registered, scope:', reg.scope))
                .catch(err => console.warn('[SW] registration failed:', err));
        });
    }

    function bindCloudIndicator() {
        // Live indicator updated by the Cloud module's state events.
        Cloud.onState(state => {
            const dot = document.getElementById('cloud-dot');
            const lbl = document.getElementById('cloud-label');
            if (!dot || !lbl) return;
            dot.className = 'cloud-dot ' + (state.status || '');
            const map = {
                connecting: 'Conectando...',
                connected: 'En la nube ✓',
                unavailable: 'Sin nube',
                error: 'Sin nube'
            };
            lbl.textContent = map[state.status] || '';
        });
    }

    function bindLogin() {
        const form = $('#login-form');
        form.addEventListener('submit', async e => {
            e.preventDefault();
            const submitBtn = form.querySelector('button[type="submit"]');
            if (submitBtn) submitBtn.disabled = true;
            try {
                const username = $('#login-username').value.trim();
                const password = $('#login-password').value;
                const result = await Auth.loginAsync(username, password);
                if (!result.ok) {
                    $('#login-error').textContent = result.error;
                    return;
                }
                $('#login-error').textContent = '';
                $('#login-username').value = '';
                $('#login-password').value = '';
                $('#screen-login').classList.add('hidden');
                showApp(result.user);
            } finally {
                if (submitBtn) submitBtn.disabled = false;
            }
        });
    }

    function showApp(user) {
        $('#app').classList.remove('hidden');
        // Avatars / names
        const initial = (user.name || user.username)[0].toUpperCase();
        $('#profile-initial').textContent = initial;
        $('#menu-avatar').textContent = initial;
        $('#hero-name').textContent = user.name || user.username;
        $('#menu-name').textContent = user.name || user.username;
        $('#menu-role').textContent = user.role === 'admin' ? 'Administrador' : 'Usuario';
        $('#hero-date').textContent = fmtDate(new Date());
        $('#set-name').textContent = user.name;
        $('#set-username').textContent = user.username;
        $('#set-role').textContent = user.role === 'admin' ? 'Administrador' : 'Usuario';

        // Load user settings into toggles
        const us = Storage.getUserSettings(user.id);
        $('#setting-auto-rest').checked = !!us.autoRestTimer;
        $('#setting-sounds').checked = us.soundsEnabled !== false;

        // Show/hide admin items
        $$('.admin-only').forEach(el => {
            el.style.display = Auth.isAdmin(user) ? '' : 'none';
        });

        bindAppEvents();
        renderHome();
        showView('home');
    }

    function bindAppEvents() {
        // Bottom nav
        $$('.nav-item').forEach(btn => {
            btn.onclick = () => showView(btn.dataset.view);
        });
        // Side menu
        $('#menu-btn').onclick = () => $('#menu').classList.remove('hidden');
        $('#menu .menu-overlay').onclick = () => $('#menu').classList.add('hidden');
        $$('#menu .menu-item[data-view]').forEach(btn => {
            btn.onclick = () => {
                showView(btn.dataset.view);
                $('#menu').classList.add('hidden');
            };
        });
        $('#menu-logout').onclick = handleLogout;
        $('#logout-btn').onclick = handleLogout;
        $('#profile-btn').onclick = () => showView('settings');

        // Back buttons
        $$('[data-back]').forEach(btn => {
            btn.onclick = () => showView(btn.dataset.back);
        });

        // Workout
        $('#start-workout').onclick = startWorkout;
        $('#workout-exit').onclick = handleExitWorkout;
        $('#ex-prev').onclick = handleExPrev;
        $('#ex-next').onclick = handleExNext;
        $('#rest-skip').onclick = () => { Workout.endRest(); $('#rest-overlay').classList.add('hidden'); };
        $('#rest-minus').onclick = () => Workout.adjustRest(-15);
        $('#rest-plus').onclick = () => Workout.adjustRest(15);

        // Exercise card image: tap = expand, camera button = upload
        $('#ex-illustration').onclick = e => {
            if (e.target.closest('button')) return;
            openImageViewer();
        };
        $('#ex-image-expand-btn').onclick = e => { e.stopPropagation(); openImageViewer(); };
        $('#ex-image-upload-btn').onclick = e => { e.stopPropagation(); $('#ex-image-input').click(); };
        $('#ex-image-input').onchange = handleImageUpload;
        $('#image-viewer-close').onclick = closeImageViewer;
        $('#image-viewer').onclick = e => {
            if (e.target.id === 'image-viewer') closeImageViewer();
        };
        $('#ex-edit-btn').onclick = showEditExercise;
        $('#ex-swap-btn').onclick = showSwapExercise;
        $('#ex-edit-tips-btn').onclick = showEditTips;
        $('#ex-target').onclick = showEditTarget;
        $('#rest-card').onclick = e => {
            // ignore clicks on the action buttons
            if (e.target.closest('button')) return;
            showEditRest();
        };
        $('#rest-edit-btn').onclick = e => { e.stopPropagation(); showEditRest(); };
        $('#rest-start-btn').onclick = e => {
            e.stopPropagation();
            const ex = Workout.getCurrentExercise();
            if (ex) startRestTimer(ex.rest, 'Descanso');
        };

        // Settings toggles
        $('#setting-auto-rest').onchange = e => {
            const u = Storage.getCurrentUser();
            Storage.saveUserSettings(u.id, { autoRestTimer: e.target.checked });
            toast(e.target.checked ? 'Cronómetro automático activado' : 'Cronómetro automático desactivado');
        };
        $('#setting-sounds').onchange = e => {
            const u = Storage.getCurrentUser();
            Storage.saveUserSettings(u.id, { soundsEnabled: e.target.checked });
        };

        // Summary
        $('#summary-save').onclick = saveCurrentSession;
        $('#summary-discard').onclick = () => {
            if (confirm('¿Descartar la sesión sin guardar?')) {
                Workout.abort();
                showView('home');
            }
        };

        // Dashboard
        $('#dash-period').onchange = () => Dashboard.render(Storage.getCurrentUser().id, $('#dash-period').value);
        $('#dash-exercise').onchange = () => Dashboard.render(Storage.getCurrentUser().id, $('#dash-period').value);

        // Users (admin)
        $('#add-user-btn').onclick = showAddUser;

        // Settings
        $('#change-password-btn').onclick = showChangePassword;
        $('#export-json').onclick = handleExportJson;
        $('#export-csv').onclick = handleExportCsv;
        $('#import-json').onclick = () => $('#import-file').click();
        $('#import-file').onchange = handleImportJson;
        $('#reset-data').onclick = handleResetData;

        // Body metrics
        const openBodyBtn = $('#open-body-btn');
        if (openBodyBtn) openBodyBtn.onclick = () => showView('body');
        const addMetricBtn = $('#add-metric-btn');
        if (addMetricBtn) addMetricBtn.onclick = showAddBodyMetric;
        const measureSel = $('#body-measure-select');
        if (measureSel) measureSel.onchange = renderBodyMeasureChart;
    }

    function handleLogout() {
        if (!confirm('¿Cerrar sesión? Tus datos quedan guardados, podrás volver cuando quieras.')) return;
        Auth.logout();
        $('#app').classList.add('hidden');
        $('#screen-login').classList.remove('hidden');
        $('#menu').classList.add('hidden');
    }

    function showView(view) {
        currentView = view;
        $$('.view').forEach(v => v.classList.remove('active'));
        const el = document.getElementById('view-' + view);
        if (el) el.classList.add('active');
        $$('.nav-item').forEach(b => b.classList.toggle('active', b.dataset.view === view));

        // Show/hide bottom nav for workout/summary/preview/body
        const nav = document.querySelector('.bottom-nav');
        if (view === 'workout' || view === 'summary' || view === 'preview' || view === 'body') {
            nav.style.display = 'none';
        } else {
            nav.style.display = '';
        }

        // Hide topbar when in workout (workout has its own header)
        const appEl = $('#app');
        if (view === 'workout') appEl.classList.add('workout-mode');
        else appEl.classList.remove('workout-mode');

        const titles = {
            home: 'Inicio',
            preview: 'Rutina',
            workout: 'Entrenamiento',
            summary: 'Resumen',
            dashboard: 'Progreso',
            history: 'Historial',
            users: 'Usuarios',
            settings: 'Ajustes',
            body: 'Peso y medidas'
        };
        $('#topbar-title').textContent = titles[view] || '';

        if (view === 'home') renderHome();
        if (view === 'dashboard') Dashboard.render(Storage.getCurrentUser().id, $('#dash-period').value || 'month');
        if (view === 'history') renderHistory();
        if (view === 'users') renderUsers();
        if (view === 'body') renderBodyView();
    }

    // ===== HOME =====
    function renderHome() {
        const user = Storage.getCurrentUser();
        if (!user) return;

        // Update greeting with empathetic time-aware copy
        $('#hero-name').textContent = user.name || user.username;
        const hour = new Date().getHours();
        let greeting;
        if (hour < 6) greeting = '¿Madrugaste para entrenar?';
        else if (hour < 12) greeting = '¿Cómo te sientes <em>hoy</em>?';
        else if (hour < 18) greeting = 'Buena tarde para <em>moverte</em>';
        else if (hour < 22) greeting = '¿Una sesión antes de <em>cerrar</em> el día?';
        else greeting = 'Tarde pero <em>posible</em>';
        $('#hero-title').innerHTML = greeting;

        // Readiness ring
        renderReadiness(user);

        // Stats with count-up animation
        animateNumber($('#stat-streak'), Dashboard.calcStreak(user.id));
        animateNumber($('#stat-month'), Dashboard.calcMonthSessions(user.id));
        animateNumber($('#stat-volume'), Math.round(Dashboard.calcMonthVolume(user.id)));

        // Routines (built-in + user's custom routines from imported Excel)
        const list = $('#routines-list');
        list.innerHTML = '';
        const today = new Date().getDay();
        const visibleRoutines = getRoutinesForUser(user);

        if (visibleRoutines.length === 0) {
            list.innerHTML = '<p style="text-align:center;color:var(--text-2);padding:24px 12px;font-size:13px;background:var(--surface);border:1px solid var(--border);border-radius:14px">Aún no hay rutinas asignadas. Pídele al admin que te asigne alguna.</p>';
        }

        for (const r of visibleRoutines) {
            const isToday = r.dayNum === today;
            const card = document.createElement('div');
            card.className = 'routine-card';
            card.style.setProperty('--card-grad', r.gradient);
            const estMin = Math.round(r.exercises.reduce((acc, ex) => acc + ex.target.sets * 1.5 + (ex.rest * ex.target.sets / 60), 0));
            card.innerHTML = `
                <div class="routine-card-inner">
                    <div class="routine-icon">${routineIconSvg(r.icon)}</div>
                    <div class="routine-content">
                        <p class="routine-day">${escapeHtml(r.day)}${isToday ? ' · HOY' : ''}</p>
                        <h4 class="routine-title">${escapeHtml(r.name)}</h4>
                        <div class="routine-meta">
                            <span><strong>${r.exercises.length}</strong> ejercicios</span>
                            <span>·</span>
                            <span>~<strong>${estMin}</strong> min</span>
                        </div>
                    </div>
                    <svg class="routine-arrow" viewBox="0 0 24 24" fill="none" width="22" height="22"><path d="M9 6l6 6-6 6" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"/></svg>
                </div>
            `;
            card.onclick = () => openRoutinePreview(r);
            list.appendChild(card);
        }

        // Last session
        const lastEl = $('#last-session');
        const lastSessions = Storage.getUserSessions(user.id);
        if (lastSessions.length === 0) {
            lastEl.innerHTML = '<p style="margin:0;text-align:center;color:var(--text-2);font-size:14px">Cuando entrenes, esta tarjeta te recordará lo que hiciste.</p>';
            lastEl.classList.remove('has-data');
        } else {
            const s = lastSessions[0];
            const dt = new Date(s.date);
            lastEl.classList.add('has-data');
            lastEl.innerHTML = `
                <p class="last-session-title">${escapeHtml(s.routineName || '')} · ${escapeHtml(s.routineDay || '')}</p>
                <p style="margin:0;color:var(--text-2);font-size:13px">
                    ${dt.toLocaleDateString('es-ES', { day: 'numeric', month: 'long' })} ·
                    ${Math.round((s.durationSec || 0) / 60)} min ·
                    ${Math.round(s.totals?.volume || 0)} kg ·
                    ${s.totals?.reps || 0} reps
                </p>
            `;
        }
    }

    function routineIconSvg(type) {
        const icons = {
            chest: '<svg viewBox="0 0 24 24" fill="none"><path d="M12 4c-3 0-6 2-6 6 0 4 6 10 6 10s6-6 6-10c0-4-3-6-6-6z" stroke="currentColor" stroke-width="2" stroke-linejoin="round"/><path d="M12 10v4" stroke="currentColor" stroke-width="2" stroke-linecap="round"/></svg>',
            shoulder: '<svg viewBox="0 0 24 24" fill="none"><path d="M4 12h16M4 12c0-2 1-4 3-4M20 12c0-2-1-4-3-4M7 8c1-1 2-2 5-2s4 1 5 2" stroke="currentColor" stroke-width="2" stroke-linecap="round"/><circle cx="12" cy="16" r="3" stroke="currentColor" stroke-width="2"/></svg>',
            leg: '<svg viewBox="0 0 24 24" fill="none"><path d="M9 4v8l-3 8M15 4v8l3 8M9 12h6" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"/></svg>',
            glute: '<svg viewBox="0 0 24 24" fill="none"><path d="M5 12c0-4 3-7 7-7s7 3 7 7-3 7-7 7-7-3-7-7z" stroke="currentColor" stroke-width="2"/><path d="M12 5v14M9 9c1 1 2 1 3 1s2 0 3-1" stroke="currentColor" stroke-width="2" stroke-linecap="round"/></svg>'
        };
        return icons[type] || icons.chest;
    }

    // ===== ROUTINE PREVIEW =====
    function openRoutinePreview(routine) {
        selectedRoutine = routine;
        $('#preview-day').textContent = routine.day.toUpperCase();
        $('#preview-title').textContent = routine.name;
        $('#preview-count').textContent = routine.exercises.length;
        $('#preview-hero').style.background = routine.gradient;
        const estMin = Math.round(routine.exercises.reduce((acc, ex) => acc + ex.target.sets * 1.5 + (ex.rest * ex.target.sets / 60), 0));
        $('#preview-time').textContent = estMin;

        const list = $('#preview-list');
        list.innerHTML = '';
        for (const ex of routine.exercises) {
            const div = document.createElement('div');
            div.className = 'preview-item';
            const lastWeight = ex.lastSession?.[0]?.weight;
            div.innerHTML = `
                <div class="preview-item-num">${escapeHtml(String(ex.order))}</div>
                <div class="preview-item-content">
                    <p class="preview-item-name">${escapeHtml(ex.name)}</p>
                    <div class="preview-item-meta">
                        <span>${ex.target.sets} × ${ex.target.repMin}-${ex.target.repMax}</span>
                        ${lastWeight ? `<span>${escapeHtml(String(lastWeight))} kg</span>` : ''}
                        <span>${escapeHtml(ex.muscle)}</span>
                    </div>
                </div>
            `;
            list.appendChild(div);
        }
        showView('preview');
    }

    // ===== WORKOUT =====
    function startWorkout() {
        if (!selectedRoutine) return;
        const user = Storage.getCurrentUser();
        Workout.init(selectedRoutine, user.id);
        Workout.onTick = () => $('#workout-clock').textContent = fmtSec(Workout.getState().workoutSeconds);
        Workout.onRestTick = updateRestUi;
        Workout.onRestEnd = () => {
            $('#rest-overlay').classList.add('hidden');
            playAlarm();
        };
        renderExercise();
        showView('workout');
    }

    function fmtRest(seconds) {
        if (seconds >= 60) {
            const m = Math.floor(seconds / 60);
            const s = seconds % 60;
            return s === 0 ? `${m}:00 min` : `${m}:${String(s).padStart(2, '0')} min`;
        }
        return seconds + ' s';
    }

    function renderExercise() {
        const ex = Workout.getCurrentExercise();
        if (!ex) return;
        const state = Workout.getState();
        const totalEx = Workout.totalExercises();
        const idx = state.currentExerciseIdx;

        $('#ex-num').textContent = idx + 1;
        $('#ex-target').textContent = `${ex.target.sets} series · ${ex.target.repMin} a ${ex.target.repMax} reps`;
        // Use textContent (not innerHTML) — XSS safe
        $('#ex-name').textContent = ex.name || '';
        $('#ex-tips').textContent = ex.tips || '(sin tips, edita para añadir)';

        // Illustration: image override or SVG fallback
        // Preserve the camera/expand buttons (they live in the static HTML)
        const illu = $('#ex-illustration');
        const camBtn = $('#ex-image-upload-btn');
        const expBtn = $('#ex-image-expand-btn');
        // Remove existing media (img or svg) but keep buttons
        Array.from(illu.children).forEach(child => {
            if (child !== camBtn && child !== expBtn) child.remove();
        });
        if (ex.imageUrl) {
            const img = document.createElement('img');
            img.src = ex.imageUrl;
            img.alt = ex.name || 'Ejercicio';
            illu.insertBefore(img, camBtn);
        } else {
            const wrap = document.createElement('div');
            wrap.style.cssText = 'width:100%;height:100%;display:flex;align-items:center;justify-content:center';
            wrap.innerHTML = Illustrations.get(ex.illustration);
            illu.insertBefore(wrap, camBtn);
        }

        // Last session banner — textContent is XSS-safe
        const banner = $('#ex-last-banner');
        if (ex.lastSession && ex.lastSession.length > 0) {
            const summary = ex.lastSession.map((s, i) => `S${i+1}: ${Number(s.weight)||0}kg×${Number(s.reps)||0}`).join(' · ');
            $('#ex-last-banner-text').textContent = `Última sesión → ${summary}`;
            banner.classList.remove('hidden');
        } else {
            banner.classList.add('hidden');
        }

        $('#workout-progress-text').textContent = `${idx + 1} / ${totalEx}`;
        $('#workout-progress-fill').style.width = ((idx + 1) / totalEx * 100) + '%';
        $('#rest-card-value').textContent = fmtRest(ex.rest);

        $('#ex-prev').style.visibility = idx === 0 ? 'hidden' : 'visible';
        $('#ex-next-text').textContent = idx === totalEx - 1 ? 'Finalizar' : 'Siguiente';

        renderSets(ex);
    }

    function renderSets(ex) {
        const list = $('#sets-list');
        list.innerHTML = '';
        ex.sets.forEach((set, i) => {
            const row = document.createElement('div');
            row.className = 'set-row' + (set.completed ? ' completed' : '');
            const hint = (set.targetWeight || set.targetReps)
                ? `<div class="set-suggestion-text">Última: ${set.targetWeight || 0} kg × ${set.targetReps || 0} reps</div>` : '';
            row.innerHTML = `
                <div class="set-num">${set.idx}</div>
                <div class="set-input-group">
                    <label>kg</label>
                    <input class="set-input" type="number" inputmode="decimal" step="0.5" placeholder="${set.targetWeight}" value="${set.weight ?? ''}" data-idx="${i}" data-field="weight">
                </div>
                <div class="set-input-group">
                    <label>reps</label>
                    <input class="set-input" type="number" inputmode="numeric" placeholder="${set.targetReps}" value="${set.reps ?? ''}" data-idx="${i}" data-field="reps">
                </div>
                <button class="set-check" data-idx="${i}" aria-label="Completar serie">
                    <svg viewBox="0 0 24 24" fill="none"><path d="M5 12l5 5L20 7" stroke="currentColor" stroke-width="2.5" stroke-linecap="round" stroke-linejoin="round"/></svg>
                </button>
                ${hint ? `<div class="set-suggestion" style="grid-column:1/-1">${hint}</div>` : ''}
            `;
            list.appendChild(row);
        });
        // Bind inputs
        list.querySelectorAll('.set-input').forEach(inp => {
            inp.addEventListener('change', e => {
                const idx = parseInt(e.target.dataset.idx);
                const field = e.target.dataset.field;
                const val = e.target.value === '' ? null : parseFloat(e.target.value);
                Workout.setSetData(Workout.getState().currentExerciseIdx, idx, { [field]: val });
            });
        });
        list.querySelectorAll('.set-check').forEach(btn => {
            btn.addEventListener('click', e => {
                const idx = parseInt(e.currentTarget.dataset.idx);
                handleSetComplete(idx);
            });
        });
    }

    function handleSetComplete(setIdx) {
        const state = Workout.getState();
        const exIdx = state.currentExerciseIdx;
        const ex = state.exercises[exIdx];
        const set = ex.sets[setIdx];

        // If already completed, uncomplete it
        if (set.completed) {
            set.completed = false;
            renderSets(ex);
            return;
        }

        // Read inputs to fill values
        const list = $('#sets-list');
        const wInp = list.querySelector(`.set-input[data-idx="${setIdx}"][data-field="weight"]`);
        const rInp = list.querySelector(`.set-input[data-idx="${setIdx}"][data-field="reps"]`);
        if (wInp.value !== '') set.weight = parseFloat(wInp.value);
        else set.weight = set.targetWeight;
        if (rInp.value !== '') set.reps = parseInt(rInp.value);
        else set.reps = set.targetReps;
        set.completed = true;

        renderSets(ex);
        playBeep('soft');

        // Auto-rest only if user enabled it
        const user = Storage.getCurrentUser();
        const settings = Storage.getUserSettings(user.id);
        if (!settings.autoRestTimer) return;

        const allComplete = ex.sets.every(s => s.completed);
        if (allComplete) return;
        const nextIdx = ex.sets.findIndex(s => !s.completed);
        if (nextIdx >= 0) {
            startRestTimer(ex.rest, `Siguiente: Serie ${ex.sets[nextIdx].idx} de ${ex.name}`);
        }
    }

    function startRestTimer(seconds, label) {
        Workout.startRest(seconds, label);
        $('#rest-overlay').classList.remove('hidden');
        updateRestUi();
        $('#rest-next').textContent = label || '';
    }

    function updateRestUi() {
        const state = Workout.getState();
        if (!state) return;
        const remaining = state.restRemaining;
        const total = state.restTotal || 1;
        $('#rest-time').textContent = fmtMs(remaining);
        const circumference = 2 * Math.PI * 90;
        const offset = circumference * (1 - remaining / total);
        $('#rest-circle-fg').style.strokeDashoffset = offset;
    }

    function audioAllowed() {
        const user = Storage.getCurrentUser();
        if (!user) return true;
        const settings = Storage.getUserSettings(user.id);
        return settings.soundsEnabled !== false;
    }

    function playBeep(kind = 'tick') {
        if (!audioAllowed()) return;
        try {
            const ctx = new (window.AudioContext || window.webkitAudioContext)();
            const osc = ctx.createOscillator();
            const gain = ctx.createGain();
            osc.connect(gain); gain.connect(ctx.destination);
            osc.frequency.value = kind === 'soft' ? 660 : 880;
            gain.gain.value = 0.04;
            osc.start();
            setTimeout(() => { osc.stop(); ctx.close(); }, kind === 'soft' ? 80 : 200);
        } catch (e) {}
    }

    /**
     * Strong alarm: 3 ascending beeps + vibration if available.
     * Used when rest timer ends.
     */
    function playAlarm() {
        if (!audioAllowed()) return;
        try {
            const ctx = new (window.AudioContext || window.webkitAudioContext)();
            const tones = [
                { freq: 740, start: 0,    dur: 0.18 },
                { freq: 880, start: 0.22, dur: 0.18 },
                { freq: 1108, start: 0.44, dur: 0.30 }
            ];
            const now = ctx.currentTime;
            tones.forEach(t => {
                const osc = ctx.createOscillator();
                const gain = ctx.createGain();
                osc.type = 'sine';
                osc.frequency.value = t.freq;
                gain.gain.setValueAtTime(0, now + t.start);
                gain.gain.linearRampToValueAtTime(0.18, now + t.start + 0.02);
                gain.gain.setValueAtTime(0.18, now + t.start + t.dur - 0.02);
                gain.gain.linearRampToValueAtTime(0, now + t.start + t.dur);
                osc.connect(gain); gain.connect(ctx.destination);
                osc.start(now + t.start);
                osc.stop(now + t.start + t.dur);
            });
            setTimeout(() => ctx.close().catch(()=>{}), 1000);
        } catch (e) {}
        // Haptic feedback if available (mobile)
        try { if (navigator.vibrate) navigator.vibrate([120, 80, 120, 80, 220]); } catch (e) {}
    }

    function openImageViewer() {
        const ex = Workout.getCurrentExercise();
        if (!ex) return;
        const viewer = $('#image-viewer');
        const img = $('#image-viewer-img');
        const caption = $('#image-viewer-caption');
        // Always clean up any previous SVG wrap before re-rendering
        const oldWrap = viewer.querySelector('.lightbox-svg-wrap');
        if (oldWrap) oldWrap.remove();
        if (ex.imageUrl) {
            img.src = ex.imageUrl;
            img.style.display = 'block';
        } else {
            img.removeAttribute('src');
            img.style.display = 'none';
            const wrap = document.createElement('div');
            wrap.className = 'lightbox-svg-wrap';
            wrap.style.cssText = 'width:90%;max-width:520px;aspect-ratio:5/3;background:linear-gradient(135deg,rgba(0,255,148,0.1),rgba(0,184,255,0.1));border-radius:16px;display:flex;align-items:center;justify-content:center;padding:24px';
            // SVG content comes from our trusted Illustrations module (no user input)
            wrap.innerHTML = Illustrations.get(ex.illustration);
            const svg = wrap.querySelector('svg');
            if (svg) { svg.style.width = '100%'; svg.style.height = '100%'; svg.classList.add('lightbox-svg'); }
            viewer.insertBefore(wrap, caption);
        }
        caption.textContent = ex.name || '';
        viewer.classList.remove('hidden');
    }

    function closeImageViewer() {
        const viewer = $('#image-viewer');
        viewer.classList.add('hidden');
        const wrap = viewer.querySelector('.lightbox-svg-wrap');
        if (wrap) wrap.remove();
    }

    function handleExPrev() {
        Workout.prevExercise();
        renderExercise();
    }
    function handleExNext() {
        const state = Workout.getState();
        const ex = state.exercises[state.currentExerciseIdx];
        const someIncomplete = ex.sets.some(s => !s.completed);
        if (someIncomplete) {
            if (!confirm('Quedan series sin completar. ¿Saltar de todos modos?')) return;
        }
        const r = Workout.nextExercise();
        if (r.done) {
            // End workout
            finishWorkout();
        } else {
            renderExercise();
            $('#rest-overlay').classList.add('hidden');
            Workout.endRest();
        }
    }

    function handleExitWorkout() {
        if (!confirm('¿Pausar este entrenamiento? Lo que llevas en esta sesión no se guardará.')) return;
        Workout.abort();
        $('#rest-overlay').classList.add('hidden');
        showView('home');
    }

    function finishWorkout() {
        const finalState = Workout.finish();
        $('#rest-overlay').classList.add('hidden');
        $('#summary-routine').textContent = `${finalState.routineName} · ${finalState.routineDay}`;
        $('#summary-time').textContent = Math.round(finalState.durationSec / 60) + 'm';
        $('#summary-volume').textContent = Math.round(finalState.totals.volume);
        $('#summary-reps').textContent = finalState.totals.reps;
        $('#summary-sets').textContent = finalState.totals.sets;

        // Compare with previous session of same routine
        const userId = Storage.getCurrentUser().id;
        const previousSessions = Storage.getUserSessions(userId).filter(s => s.routineId === finalState.routineId);
        const wrap = $('#summary-progress');
        if (previousSessions.length > 0) {
            const prev = previousSessions[0];
            wrap.innerHTML = '<h4>Comparado con la última sesión</h4>';
            for (const ex of finalState.exercises) {
                const prevEx = prev.exercises.find(e => e.id === ex.id);
                if (!prevEx) continue;
                const curMax = Math.max(...ex.sets.filter(s => s.completed).map(s => (s.weight || 0) * (s.reps || 0)));
                const prevMax = Math.max(...prevEx.sets.filter(s => s.completed).map(s => (s.weight || 0) * (s.reps || 0)));
                if (!isFinite(curMax) || !isFinite(prevMax)) continue;
                const diff = curMax - prevMax;
                const sign = diff > 0 ? '+' : '';
                const cls = diff > 0 ? 'up' : (diff < 0 ? 'down' : 'same');
                const symbol = diff > 0 ? '↑' : (diff < 0 ? '↓' : '=');
                const div = document.createElement('div');
                div.className = 'progress-line';
                div.innerHTML = `<span class="name">${escapeHtml(ex.name)}</span><span class="delta ${cls}">${symbol} ${sign}${Math.round(diff)}</span>`;
                wrap.appendChild(div);
            }
        } else {
            wrap.innerHTML = '<h4>Tu primera sesión de esta rutina 🎯</h4><p style="color:var(--text-2);font-size:13px;margin:0">Las próximas sesiones se compararán con esta para que veas tu progreso.</p>';
        }

        showView('summary');
    }

    function saveCurrentSession() {
        const user = Storage.getCurrentUser();
        const payload = Workout.buildSavablePayload(user.id);
        if (!payload) return;

        // Detect PRs BEFORE persisting (so we compare against history)
        const prs = detectPRs(payload, user.id);

        Storage.saveSession(payload);
        lastSavedSession = payload;

        // Friendly micro-copy variation
        const messages = [
            '¡Bien hecho! Sesión guardada',
            'Sesión guardada ✓ buen trabajo',
            'Listo. Hoy sumaste otra sesión',
            'Bien — ya queda registrado'
        ];
        toast(messages[Math.floor(Math.random() * messages.length)], 'success');

        // Celebrate the biggest PR if any
        if (prs.length > 0) {
            const top = prs.sort((a, b) => b.weight - a.weight)[0];
            setTimeout(() => celebratePR(top), 350);
        }

        Workout.abort();
        showView('home');
    }

    /**
     * Compare the just-finished session against the user's history to find
     * exercises where they hit a new max weight. Returns array of PR objects.
     */
    function detectPRs(payload, userId) {
        const history = Storage.getUserSessions(userId);
        const prs = [];
        for (const ex of payload.exercises || []) {
            // Best weight in this session
            const sessionMax = ex.sets
                .filter(s => s.completed && s.weight > 0)
                .reduce((m, s) => Math.max(m, s.weight), 0);
            if (sessionMax === 0) continue;
            // Best weight in any prior session for the same exercise
            let priorMax = 0;
            let prevReps = 0;
            for (const past of history) {
                if (past.id === payload.id) continue;
                const pastEx = (past.exercises || []).find(e => e.id === ex.id);
                if (!pastEx) continue;
                for (const s of pastEx.sets || []) {
                    if (s.completed && s.weight > priorMax) {
                        priorMax = s.weight;
                        prevReps = s.reps;
                    }
                }
            }
            if (sessionMax > priorMax) {
                const bestSet = ex.sets
                    .filter(s => s.completed && s.weight === sessionMax)
                    .sort((a, b) => (b.reps || 0) - (a.reps || 0))[0];
                prs.push({
                    name: ex.name,
                    weight: sessionMax,
                    reps: bestSet?.reps || 0,
                    diff: priorMax > 0 ? sessionMax - priorMax : null
                });
            }
        }
        return prs;
    }

    function celebratePR(pr) {
        const overlay = $('#pr-celebration');
        if (!overlay) return;
        $('#pr-name').textContent = pr.name;
        $('#pr-value').textContent = `${pr.weight} kg × ${pr.reps}`;
        overlay.classList.remove('hidden');
        playPRSound();
        try { if (navigator.vibrate) navigator.vibrate([120, 60, 120, 60, 240]); } catch (e) {}
        setTimeout(() => overlay.classList.add('hidden'), 2400);
        setTimeout(() => overlay.onclick = null, 2400);
        overlay.onclick = () => overlay.classList.add('hidden');
    }

    function playPRSound() {
        if (!audioAllowed()) return;
        try {
            const ctx = new (window.AudioContext || window.webkitAudioContext)();
            // Major triad (C-E-G) — uplifting
            [523.25, 659.25, 783.99].forEach((freq, i) => {
                const osc = ctx.createOscillator();
                const gain = ctx.createGain();
                osc.type = 'triangle';
                osc.frequency.value = freq;
                const start = ctx.currentTime + i * 0.08;
                gain.gain.setValueAtTime(0, start);
                gain.gain.linearRampToValueAtTime(0.16, start + 0.02);
                gain.gain.exponentialRampToValueAtTime(0.001, start + 0.5);
                osc.connect(gain); gain.connect(ctx.destination);
                osc.start(start);
                osc.stop(start + 0.5);
            });
            setTimeout(() => ctx.close().catch(()=>{}), 1500);
        } catch (e) {}
    }

    // ===== HISTORY =====
    function renderHistory() {
        const user = Storage.getCurrentUser();
        const sessions = Storage.getUserSessions(user.id);
        const list = $('#history-list');
        if (sessions.length === 0) {
            const es = emptyState({
                illu: 'history',
                title: 'Tu historia empieza aquí',
                subtitle: 'Cuando completes tu primera sesión, aparecerá en este espacio.',
                btn: 'Ver rutinas',
                onBtn: () => showView('home')
            });
            list.innerHTML = es.html;
            es.bind();
            return;
        }
        list.innerHTML = '';
        for (const s of sessions) {
            const card = document.createElement('div');
            card.className = 'history-card';
            const dt = new Date(s.date);
            card.innerHTML = `
                <div class="history-card-top">
                    <h4 class="history-card-routine">${escapeHtml(s.routineName || '')}</h4>
                    <span class="history-card-date">${dt.toLocaleDateString('es-ES', { day: '2-digit', month: 'short' })}</span>
                </div>
                <div class="history-card-stats">
                    <span><strong>${Math.round((s.durationSec || 0) / 60)}</strong>m</span>
                    <span><strong>${Math.round(s.totals?.volume || 0)}</strong>kg</span>
                    <span><strong>${s.totals?.reps || 0}</strong>reps</span>
                    <span><strong>${s.totals?.sets || 0}</strong>series</span>
                </div>
            `;
            card.onclick = () => showSessionDetails(s);
            list.appendChild(card);
        }
    }

    function showSessionDetails(s) {
        // Deep-clone so we can edit without mutating Storage until "Save"
        const draft = JSON.parse(JSON.stringify(s));
        const dt = new Date(draft.date);

        const exercisesHtml = draft.exercises.map((ex, eIdx) => {
            const setsHtml = ex.sets.map((set, sIdx) => `
                <div class="hist-set-row" data-ex="${eIdx}" data-set="${sIdx}">
                    <div class="hist-set-num">${Number(set.idx) || (sIdx + 1)}</div>
                    <div class="hist-set-input">
                        <label>kg</label>
                        <input type="number" inputmode="decimal" step="0.5" data-field="weight" value="${set.weight ?? ''}" placeholder="–">
                    </div>
                    <div class="hist-set-input">
                        <label>reps</label>
                        <input type="number" inputmode="numeric" data-field="reps" value="${set.reps ?? ''}" placeholder="–">
                    </div>
                    <button type="button" class="hist-set-check ${set.completed ? 'completed' : ''}" data-field="completed" aria-label="Toggle completada">
                        <svg viewBox="0 0 24 24" fill="none"><path d="M5 12l5 5L20 7" stroke="currentColor" stroke-width="2.5" stroke-linecap="round" stroke-linejoin="round"/></svg>
                    </button>
                </div>
            `).join('');
            return `
                <div class="hist-ex">
                    <h4>${escapeHtml(ex.name || '')}</h4>
                    <div class="hist-sets">${setsHtml}</div>
                </div>
            `;
        }).join('');

        const html = `
            <h3>${escapeHtml(draft.routineName || '')}</h3>
            <p class="hist-date">${fmtDate(dt)} · ${Math.round((draft.durationSec || 0) / 60)} min</p>
            <p class="hist-help">Toca cualquier valor para editarlo. El check marca/desmarca la serie.</p>
            <div id="hist-ex-list">${exercisesHtml}</div>
            <div class="hist-actions">
                <button type="button" class="btn btn-danger" id="hist-delete-btn">Eliminar</button>
                <button type="button" class="btn btn-primary" id="hist-save-btn" style="flex:1">Guardar cambios</button>
            </div>
        `;
        showModal(html);

        // Wire input changes into the draft
        const list = document.getElementById('hist-ex-list');
        list.querySelectorAll('input').forEach(inp => {
            inp.addEventListener('input', () => {
                const row = inp.closest('.hist-set-row');
                const eIdx = parseInt(row.dataset.ex, 10);
                const sIdx = parseInt(row.dataset.set, 10);
                const field = inp.dataset.field;
                let val = inp.value === '' ? null : (field === 'reps' ? parseInt(inp.value, 10) : parseFloat(inp.value));
                if (Number.isNaN(val)) val = null;
                draft.exercises[eIdx].sets[sIdx][field] = val;
            });
        });
        list.querySelectorAll('.hist-set-check').forEach(btn => {
            btn.addEventListener('click', () => {
                const row = btn.closest('.hist-set-row');
                const eIdx = parseInt(row.dataset.ex, 10);
                const sIdx = parseInt(row.dataset.set, 10);
                const set = draft.exercises[eIdx].sets[sIdx];
                set.completed = !set.completed;
                btn.classList.toggle('completed', set.completed);
            });
        });

        document.getElementById('hist-delete-btn').onclick = () => App.deleteSession(draft.id);
        document.getElementById('hist-save-btn').onclick = () => {
            // Recalculate totals from the edited sets
            let sets = 0, reps = 0, volume = 0;
            for (const ex of draft.exercises) {
                for (const set of ex.sets) {
                    if (set.completed) {
                        sets++;
                        reps += Number(set.reps) || 0;
                        volume += (Number(set.weight) || 0) * (Number(set.reps) || 0);
                    }
                }
            }
            draft.totals = { sets, reps, volume: Math.round(volume) };
            // Persist (writes locally + pushes to Firebase)
            Storage.saveSession(draft);
            closeModal();
            renderHistory();
            toast('Sesión actualizada ✓', 'success');
        };
    }

    function deleteSession(id) {
        if (!confirm('¿Eliminar esta sesión?')) return;
        Storage.deleteSession(id);
        closeModal();
        renderHistory();
        toast('Sesión eliminada');
    }

    // ===== USERS (admin) =====
    function renderUsers() {
        const user = Storage.getCurrentUser();
        if (!Auth.isAdmin(user)) {
            showView('home');
            return;
        }
        const list = $('#users-list');
        list.innerHTML = '';
        const users = Storage.getUsers();
        for (const u of users) {
            const div = document.createElement('div');
            div.className = 'user-item';
            const initial = ((u.name || u.username)[0] || '?').toUpperCase();
            div.innerHTML = `
                <div class="user-avatar">${escapeHtml(initial)}</div>
                <div class="user-info">
                    <p class="user-name">${escapeHtml(u.name || '')}</p>
                    <p class="user-username">@${escapeHtml(u.username || '')} · ${escapeHtml(u.role || '')}</p>
                </div>
                <div class="user-actions">
                    ${u.id !== user.id ? `<button class="icon-btn" data-edit="${escapeHtml(u.id)}"><svg viewBox="0 0 24 24" fill="none"><path d="M3 17.25V21h3.75L17.81 9.94l-3.75-3.75L3 17.25zM20.71 7.04a1 1 0 000-1.41l-2.34-2.34a1 1 0 00-1.41 0l-1.83 1.83 3.75 3.75 1.83-1.83z" fill="currentColor"/></svg></button>` : ''}
                    ${u.id !== user.id ? `<button class="icon-btn" style="color:var(--danger)" data-del="${escapeHtml(u.id)}"><svg viewBox="0 0 24 24" fill="none"><path d="M3 6h18M8 6V4a2 2 0 012-2h4a2 2 0 012 2v2M19 6l-1 14a2 2 0 01-2 2H8a2 2 0 01-2-2L5 6" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"/></svg></button>` : ''}
                </div>
            `;
            list.appendChild(div);
        }
        list.querySelectorAll('[data-del]').forEach(b => {
            b.onclick = () => {
                if (!confirm('¿Eliminar este usuario y todas sus sesiones?')) return;
                Storage.deleteUser(b.dataset.del);
                renderUsers();
                toast('Usuario eliminado');
            };
        });
        list.querySelectorAll('[data-edit]').forEach(b => {
            b.onclick = () => showEditUser(b.dataset.edit);
        });
    }

    function showAddUser() {
        const checkboxes = ROUTINES.map(r => `
            <label class="check-row">
                <input type="checkbox" name="routine" value="${escapeHtml(r.id)}" checked>
                <span>${escapeHtml(r.name)} · ${escapeHtml(r.day)}</span>
            </label>
        `).join('');

        showModal(`
            <h3>Nuevo usuario</h3>
            <form id="add-user-form" style="display:flex;flex-direction:column;gap:14px">
                <div class="input-group"><label>Nombre completo</label><input type="text" id="nu-name" maxlength="60" required></div>
                <div class="input-group"><label>Usuario (login)</label><input type="text" id="nu-username" maxlength="40" required pattern="[A-Za-z0-9_.\\-]+" title="Solo letras, números, guiones y puntos"></div>
                <div class="input-group"><label>Contraseña</label><input type="password" id="nu-password" minlength="4" maxlength="80" required></div>
                <div class="input-group">
                    <label>Rol</label>
                    <div id="nu-role-mount"></div>
                </div>

                <div class="seg-tabs">
                    <button type="button" class="seg-tab active" data-mode="default">Usar rutinas predefinidas</button>
                    <button type="button" class="seg-tab" data-mode="excel">Subir Excel propio</button>
                </div>

                <div id="nu-mode-default" class="nu-pane">
                    <label class="field-label">Rutinas asignadas</label>
                    <div class="check-list">${checkboxes}</div>
                </div>

                <div id="nu-mode-excel" class="nu-pane hidden">
                    <p class="settings-help">Sube un Excel con la rutina del usuario. Cada fila es un ejercicio. Descarga la plantilla para ver el formato esperado.</p>
                    <div class="settings-actions">
                        <button type="button" class="btn btn-ghost" id="dl-template">Descargar plantilla</button>
                        <button type="button" class="btn btn-primary" id="upload-routine">Cargar Excel</button>
                    </div>
                    <input type="file" id="routine-file" accept=".xlsx,.xls,application/vnd.openxmlformats-officedocument.spreadsheetml.sheet" hidden>
                    <p id="routine-status" class="settings-status"></p>
                    <div id="routine-preview" class="routine-preview"></div>
                </div>

                <div style="display:flex;gap:10px;margin-top:6px">
                    <button type="button" class="btn btn-ghost" style="flex:1" data-action="close-modal">Cancelar</button>
                    <button type="submit" class="btn btn-primary" style="flex:1">Crear</button>
                </div>
            </form>
        `);

        // Mount custom Select for role
        const roleSel = Select.create({
            id: 'nu-role',
            options: [
                { value: 'user', label: 'Usuario', hint: 'Puede entrenar' },
                { value: 'admin', label: 'Administrador', hint: 'Gestiona usuarios' }
            ],
            value: 'user'
        });
        $('#nu-role-mount').appendChild(roleSel);

        // Tab switcher
        let parsedRoutines = [];
        let mode = 'default';
        document.querySelectorAll('.seg-tab').forEach(t => {
            t.onclick = () => {
                mode = t.dataset.mode;
                document.querySelectorAll('.seg-tab').forEach(b => b.classList.toggle('active', b === t));
                $('#nu-mode-default').classList.toggle('hidden', mode !== 'default');
                $('#nu-mode-excel').classList.toggle('hidden', mode !== 'excel');
            };
        });

        // Excel template download
        $('#dl-template').onclick = downloadRoutineTemplate;

        // Excel upload
        $('#upload-routine').onclick = () => $('#routine-file').click();
        $('#routine-file').onchange = async e => {
            const file = e.target.files?.[0];
            if (!file) return;
            const status = $('#routine-status');
            status.className = 'settings-status';
            status.textContent = 'Leyendo archivo...';
            try {
                parsedRoutines = await parseRoutineExcel(file);
                if (parsedRoutines.length === 0) throw new Error('No se encontraron ejercicios válidos');
                status.className = 'settings-status ok';
                status.textContent = `✓ ${parsedRoutines.length} rutina(s) detectada(s)`;
                renderRoutinePreview(parsedRoutines);
            } catch (err) {
                status.className = 'settings-status err';
                status.textContent = 'Error: ' + err.message;
                parsedRoutines = [];
                $('#routine-preview').innerHTML = '';
            }
            e.target.value = '';
        };

        $('#add-user-form').onsubmit = e => {
            e.preventDefault();
            const routines = mode === 'default'
                ? [...document.querySelectorAll('input[name="routine"]:checked')].map(c => c.value)
                : [];

            if (mode === 'excel' && parsedRoutines.length === 0) {
                toast('Sube un Excel válido o cambia a "Rutinas predefinidas"', 'error');
                return;
            }

            const result = Auth.createUser({
                name: $('#nu-name').value.trim(),
                username: $('#nu-username').value.trim(),
                password: $('#nu-password').value,
                role: Select.value(roleSel),
                routines
            });
            if (!result.ok) { toast(result.error, 'error'); return; }

            // Attach custom routines if any
            if (mode === 'excel' && parsedRoutines.length > 0) {
                const user = result.user;
                user.customRoutines = parsedRoutines;
                user.routines = parsedRoutines.map(r => r.id);
                Storage.upsertUser(user);
            }

            closeModal();
            renderUsers();
            toast('Usuario creado ✓', 'success');
        };
    }

    function renderRoutinePreview(routines) {
        const container = $('#routine-preview');
        if (!container) return;
        container.innerHTML = routines.map(r => `
            <div class="routine-preview-card">
                <div class="routine-preview-head">
                    <strong>${escapeHtml(r.name)}</strong>
                    <span>${escapeHtml(r.day || '')} · ${r.exercises.length} ejercicios</span>
                </div>
                <ul class="routine-preview-list">
                    ${r.exercises.slice(0, 8).map(ex => `
                        <li>${escapeHtml(ex.name)} <span>${ex.target.sets}×${ex.target.repMin}-${ex.target.repMax}${ex.lastSession?.[0]?.weight ? ' · ' + ex.lastSession[0].weight + 'kg' : ''}</span></li>
                    `).join('')}
                    ${r.exercises.length > 8 ? `<li class="more">+${r.exercises.length - 8} más...</li>` : ''}
                </ul>
            </div>
        `).join('');
    }

    function showEditUser(userId) {
        const u = Storage.getUser(userId);
        if (!u) return;
        const allRoutines = [...ROUTINES, ...(u.customRoutines || [])];
        const opts = allRoutines.map(r => `
            <label class="check-row">
                <input type="checkbox" name="routine" value="${escapeHtml(r.id)}" ${(u.routines || []).includes(r.id) ? 'checked' : ''}>
                <span>${escapeHtml(r.name)} · ${escapeHtml(r.day || '')}${r.isCustom ? ' · <em style="color:var(--primary);font-style:normal;font-size:11px">(personalizada)</em>' : ''}</span>
            </label>
        `).join('');
        showModal(`
            <h3>Editar usuario</h3>
            <form id="edit-user-form" style="display:flex;flex-direction:column;gap:14px">
                <div class="input-group"><label>Nombre</label><input type="text" id="eu-name" value="${escapeHtml(u.name || '')}" maxlength="60" required></div>
                <div class="input-group"><label>Usuario</label><input type="text" id="eu-username" value="${escapeHtml(u.username || '')}" maxlength="40" required pattern="[A-Za-z0-9_.\\-]+"></div>
                <div class="input-group"><label>Nueva contraseña (opcional)</label><input type="password" id="eu-password" placeholder="Dejar vacío para no cambiar" minlength="4" maxlength="80"></div>
                <div class="input-group">
                    <label>Rol</label>
                    <div id="eu-role-mount"></div>
                </div>
                <div>
                    <label class="field-label">Rutinas asignadas</label>
                    <div class="check-list">${opts}</div>
                </div>
                <div style="display:flex;gap:10px">
                    <button type="button" class="btn btn-ghost" style="flex:1" data-action="close-modal">Cancelar</button>
                    <button type="submit" class="btn btn-primary" style="flex:1">Guardar</button>
                </div>
            </form>
        `);

        const roleSel = Select.create({
            id: 'eu-role',
            options: [
                { value: 'user', label: 'Usuario', hint: 'Puede entrenar' },
                { value: 'admin', label: 'Administrador', hint: 'Gestiona usuarios' }
            ],
            value: u.role
        });
        $('#eu-role-mount').appendChild(roleSel);

        $('#edit-user-form').onsubmit = e => {
            e.preventDefault();
            const updates = {
                name: $('#eu-name').value.trim(),
                username: $('#eu-username').value.trim(),
                role: Select.value(roleSel),
                routines: [...document.querySelectorAll('input[name="routine"]:checked')].map(c => c.value)
            };
            const newPwd = $('#eu-password').value;
            if (newPwd) updates.password = Storage.hashPassword(newPwd);
            Auth.updateUser(userId, updates);
            closeModal();
            renderUsers();
            toast('Usuario actualizado ✓', 'success');
        };
    }

    // ===== SETTINGS =====
    function showChangePassword() {
        showModal(`
            <h3>Cambiar contraseña</h3>
            <form id="cp-form" style="display:flex;flex-direction:column;gap:14px">
                <div class="input-group"><label>Contraseña actual</label><input type="password" id="cp-old" required></div>
                <div class="input-group"><label>Nueva contraseña</label><input type="password" id="cp-new" required></div>
                <div class="input-group"><label>Repite la nueva</label><input type="password" id="cp-new2" required></div>
                <div style="display:flex;gap:10px">
                    <button type="button" class="btn btn-ghost" style="flex:1" data-action="close-modal">Cancelar</button>
                    <button type="submit" class="btn btn-primary" style="flex:1">Cambiar</button>
                </div>
            </form>
        `);
        $('#cp-form').onsubmit = e => {
            e.preventDefault();
            const u = Storage.getCurrentUser();
            const oldP = $('#cp-old').value;
            const newP = $('#cp-new').value;
            const newP2 = $('#cp-new2').value;
            if (newP !== newP2) { toast('No coinciden', 'error'); return; }
            const r = Auth.changePassword(u.id, oldP, newP);
            if (!r.ok) { toast(r.error, 'error'); return; }
            closeModal();
            toast('Contraseña actualizada ✓', 'success');
        };
    }

    function handleExportJson() {
        const data = Storage.exportAll();
        const blob = new Blob([JSON.stringify(data, null, 2)], { type: 'application/json' });
        const url = URL.createObjectURL(blob);
        const a = document.createElement('a');
        a.href = url;
        a.download = `ev-training-backup-${new Date().toISOString().slice(0,10)}.json`;
        a.click();
        URL.revokeObjectURL(url);
        toast('Backup descargado ✓', 'success');
    }

    function handleImportJson(e) {
        const file = e.target.files?.[0];
        if (!file) return;
        const reader = new FileReader();
        reader.onload = ev => {
            try {
                const data = JSON.parse(ev.target.result);
                if (!confirm('Esto sobrescribirá tus datos actuales. ¿Continuar?')) return;
                Storage.importAll(data);
                toast('Datos importados ✓', 'success');
                renderHome();
            } catch (e) {
                toast('Archivo inválido', 'error');
            }
        };
        reader.readAsText(file);
    }

    function handleExportCsv() {
        const sessions = Storage.getSessions();
        const rows = [['fecha', 'usuario_id', 'rutina', 'dia', 'ejercicio', 'serie', 'kg', 'reps', 'kg_objetivo', 'reps_objetivo', 'completada']];
        const userMap = new Map(Storage.getUsers().map(u => [u.id, u.username]));
        for (const s of sessions) {
            for (const ex of s.exercises) {
                for (const set of ex.sets) {
                    rows.push([
                        s.date, userMap.get(s.userId) || s.userId, s.routineName, s.routineDay,
                        ex.name, set.idx, set.weight ?? '', set.reps ?? '', set.targetWeight ?? '', set.targetReps ?? '',
                        set.completed ? 'sí' : 'no'
                    ]);
                }
            }
        }
        const csv = rows.map(r => r.map(v => `"${String(v).replace(/"/g, '""')}"`).join(',')).join('\n');
        const blob = new Blob(['﻿' + csv], { type: 'text/csv;charset=utf-8' });
        const url = URL.createObjectURL(blob);
        const a = document.createElement('a');
        a.href = url;
        a.download = `ev-training-${new Date().toISOString().slice(0,10)}.csv`;
        a.click();
        URL.revokeObjectURL(url);
        toast('CSV descargado ✓', 'success');
    }

    function handleResetData() {
        if (!confirm('¿Borrar TODOS tus datos (sesiones, usuarios)? Esto no se puede deshacer.')) return;
        if (!confirm('Última confirmación. ¿Estás seguro?')) return;
        localStorage.clear();
        location.reload();
    }

    // ===== EXERCISE EDITING =====

    function persistOverride(exerciseId, partial) {
        const user = Storage.getCurrentUser();
        Storage.setOverride(user.id, exerciseId, partial);
    }

    function handleImageUpload(e) {
        const file = e.target.files?.[0];
        if (!file) return;
        // 1. MIME type check (browser-reported, but combined with magic-byte check below)
        if (!file.type || !file.type.startsWith('image/')) {
            toast('Archivo no válido. Solo imágenes.', 'error');
            e.target.value = '';
            return;
        }
        // 2. Size check
        if (file.size > 4 * 1024 * 1024) {
            toast('La imagen es muy pesada (máx 4 MB)', 'error');
            e.target.value = '';
            return;
        }
        const reader = new FileReader();
        reader.onload = ev => {
            const dataUrl = ev.target.result;
            // 3. Validate the data URL is an image and only allowed types
            if (typeof dataUrl !== 'string' || !/^data:image\/(png|jpe?g|webp|gif|svg\+xml);base64,/i.test(dataUrl)) {
                toast('Formato no soportado', 'error');
                return;
            }
            // 4. SVG could contain scripts; reject SVG to be safe
            if (/^data:image\/svg\+xml/i.test(dataUrl)) {
                toast('SVG no permitido por seguridad', 'error');
                return;
            }
            const ex = Workout.getCurrentExercise();
            const idx = Workout.getState().currentExerciseIdx;
            Workout.updateExerciseRuntime(idx, { imageUrl: dataUrl });
            persistOverride(ex.id, { imageUrl: dataUrl });
            renderExercise();
            toast('Imagen guardada ✓', 'success');
        };
        reader.onerror = () => toast('No se pudo leer la imagen', 'error');
        reader.readAsDataURL(file);
        e.target.value = '';
    }

    function showEditTips() {
        const ex = Workout.getCurrentExercise();
        if (!ex) return;
        showModal(`
            <h3>Cómo ejecutarlo</h3>
            <div class="input-group">
                <label>Instrucciones técnicas del ejercicio</label>
                <textarea id="edit-tips-input" rows="6" style="background:rgba(255,255,255,0.04);border:1px solid var(--border);color:var(--text-0);padding:12px 14px;border-radius:10px;font-family:inherit;font-size:14px;line-height:1.5;resize:vertical">${escapeHtml(ex.tips || '')}</textarea>
            </div>
            <div style="display:flex;gap:10px;margin-top:14px">
                <button class="btn btn-ghost" style="flex:1" data-action="close-modal">Cancelar</button>
                <button class="btn btn-primary" style="flex:1" id="save-tips-btn">Guardar</button>
            </div>
            <button class="btn btn-ghost btn-block" id="reset-tips-btn" style="margin-top:8px">Restaurar texto original</button>
        `);
        $('#save-tips-btn').onclick = () => {
            const newTips = $('#edit-tips-input').value;
            const idx = Workout.getState().currentExerciseIdx;
            Workout.updateExerciseRuntime(idx, { tips: newTips });
            persistOverride(ex.id, { tips: newTips });
            closeModal();
            renderExercise();
            toast('Tips actualizados ✓', 'success');
        };
        $('#reset-tips-btn').onclick = () => {
            const user = Storage.getCurrentUser();
            const ov = Storage.getOverride(user.id, ex.id) || {};
            delete ov.tips;
            Storage.setOverride(user.id, ex.id, { tips: undefined });
            // Reload from base
            const routine = findRoutine(Workout.getState().routineId);
            const base = routine?.exercises.find(e => e.id === ex.id);
            const idx = Workout.getState().currentExerciseIdx;
            Workout.updateExerciseRuntime(idx, { tips: base?.tips || '' });
            closeModal();
            renderExercise();
            toast('Texto restaurado');
        };
    }

    function showEditTarget() {
        const ex = Workout.getCurrentExercise();
        if (!ex) return;
        showModal(`
            <h3>Series y repeticiones</h3>
            <div style="display:grid;grid-template-columns:1fr;gap:14px">
                <div class="input-group">
                    <label>Número de series</label>
                    <input type="number" id="edit-sets" min="1" max="20" value="${ex.target.sets}">
                </div>
                <div style="display:grid;grid-template-columns:1fr 1fr;gap:10px">
                    <div class="input-group">
                        <label>Reps mínimas</label>
                        <input type="number" id="edit-reps-min" min="1" value="${ex.target.repMin}">
                    </div>
                    <div class="input-group">
                        <label>Reps máximas</label>
                        <input type="number" id="edit-reps-max" min="1" value="${ex.target.repMax}">
                    </div>
                </div>
                <p style="color:var(--text-2);font-size:12px;margin:0">Ejemplo: 3 series de 8 a 10 reps. Esto se guardará para tus próximas sesiones de este ejercicio.</p>
            </div>
            <div style="display:flex;gap:10px;margin-top:14px">
                <button class="btn btn-ghost" style="flex:1" data-action="close-modal">Cancelar</button>
                <button class="btn btn-primary" style="flex:1" id="save-target-btn">Guardar</button>
            </div>
        `);
        $('#save-target-btn').onclick = () => {
            const sets = Math.max(1, parseInt($('#edit-sets').value) || 1);
            const repMin = Math.max(1, parseInt($('#edit-reps-min').value) || 1);
            const repMax = Math.max(repMin, parseInt($('#edit-reps-max').value) || repMin);
            const idx = Workout.getState().currentExerciseIdx;
            const target = { sets, repMin, repMax };
            Workout.updateExerciseRuntime(idx, { target });
            persistOverride(ex.id, { target });
            closeModal();
            renderExercise();
            toast('Series actualizadas ✓', 'success');
        };
    }

    function showEditRest() {
        const ex = Workout.getCurrentExercise();
        if (!ex) return;
        showModal(`
            <h3>Descanso entre series</h3>
            <div class="input-group">
                <label>Tiempo en segundos</label>
                <input type="number" id="edit-rest-input" min="10" max="600" step="5" value="${ex.rest}">
            </div>
            <div style="display:flex;gap:6px;flex-wrap:wrap;margin-top:8px">
                ${[30, 45, 60, 90, 120, 150, 180].map(s => `<button class="btn btn-ghost" data-rest="${s}" type="button" style="flex:1;min-width:60px">${s>=60?(s/60+'m'):(s+'s')}</button>`).join('')}
            </div>
            <p style="color:var(--text-2);font-size:12px;margin:14px 0 0">Este es el tiempo recomendado entre series. Si activas el cronómetro automático en Ajustes, este será el tiempo que se cuente.</p>
            <div style="display:flex;gap:10px;margin-top:14px">
                <button class="btn btn-ghost" style="flex:1" data-action="close-modal">Cancelar</button>
                <button class="btn btn-primary" style="flex:1" id="save-rest-btn">Guardar</button>
            </div>
        `);
        document.querySelectorAll('[data-rest]').forEach(b => {
            b.onclick = () => { $('#edit-rest-input').value = b.dataset.rest; };
        });
        $('#save-rest-btn').onclick = () => {
            const seconds = Math.max(10, parseInt($('#edit-rest-input').value) || 60);
            const idx = Workout.getState().currentExerciseIdx;
            Workout.updateExerciseRuntime(idx, { rest: seconds });
            persistOverride(ex.id, { rest: seconds });
            closeModal();
            renderExercise();
            toast('Descanso actualizado ✓', 'success');
        };
    }

    function showEditExercise() {
        const ex = Workout.getCurrentExercise();
        if (!ex) return;
        const user = Storage.getCurrentUser();
        const hasOverride = !!Storage.getOverride(user.id, ex.id);
        showModal(`
            <h3>Editar ejercicio</h3>
            <p style="color:var(--text-2);font-size:13px;margin:-8px 0 14px">Personaliza este ejercicio. Tus cambios se guardarán para próximas sesiones.</p>
            <div style="display:flex;flex-direction:column;gap:12px">
                <div class="input-group"><label>Nombre del ejercicio</label><input type="text" id="ee-name" value="${escapeHtml(ex.name)}"></div>
                <div style="display:grid;grid-template-columns:1fr 1fr 1fr;gap:8px">
                    <div class="input-group"><label>Series</label><input type="number" id="ee-sets" min="1" value="${ex.target.sets}"></div>
                    <div class="input-group"><label>Reps mín</label><input type="number" id="ee-rmin" min="1" value="${ex.target.repMin}"></div>
                    <div class="input-group"><label>Reps máx</label><input type="number" id="ee-rmax" min="1" value="${ex.target.repMax}"></div>
                </div>
                <div class="input-group"><label>Descanso (segundos)</label><input type="number" id="ee-rest" min="10" step="5" value="${ex.rest}"></div>
                <div class="input-group">
                    <label>Cómo ejecutarlo</label>
                    <textarea id="ee-tips" rows="4" style="background:rgba(255,255,255,0.04);border:1px solid var(--border);color:var(--text-0);padding:12px 14px;border-radius:10px;font-family:inherit;font-size:14px;line-height:1.5;resize:vertical">${escapeHtml(ex.tips || '')}</textarea>
                </div>
                <button class="btn btn-ghost" id="ee-upload-btn" type="button">📷 Subir imagen del ejercicio</button>
                <input type="file" id="ee-image-input" accept="image/*" hidden>
                <div id="ee-image-preview" style="display:${ex.imageUrl ? 'block' : 'none'};border-radius:10px;overflow:hidden;border:1px solid var(--border)">
                    <img id="ee-image-img" src="${ex.imageUrl || ''}" style="width:100%;max-height:160px;object-fit:cover;display:block">
                </div>
            </div>
            <div style="display:flex;gap:10px;margin-top:16px">
                <button class="btn btn-ghost" style="flex:1" data-action="close-modal">Cancelar</button>
                <button class="btn btn-primary" style="flex:1" id="ee-save-btn">Guardar</button>
            </div>
            ${hasOverride ? `<button class="btn btn-danger btn-block" id="ee-reset-btn" style="margin-top:10px">Restaurar valores originales</button>` : ''}
        `);

        let pendingImage = null;
        $('#ee-upload-btn').onclick = () => $('#ee-image-input').click();
        $('#ee-image-input').onchange = e => {
            const f = e.target.files?.[0];
            if (!f) return;
            if (f.size > 4 * 1024 * 1024) { toast('Máx 4MB', 'error'); return; }
            const reader = new FileReader();
            reader.onload = ev => {
                pendingImage = ev.target.result;
                $('#ee-image-img').src = pendingImage;
                $('#ee-image-preview').style.display = 'block';
            };
            reader.readAsDataURL(f);
        };

        $('#ee-save-btn').onclick = () => {
            const sets = Math.max(1, parseInt($('#ee-sets').value) || 1);
            const repMin = Math.max(1, parseInt($('#ee-rmin').value) || 1);
            const repMax = Math.max(repMin, parseInt($('#ee-rmax').value) || repMin);
            const rest = Math.max(10, parseInt($('#ee-rest').value) || 60);
            const updates = {
                name: $('#ee-name').value.trim(),
                tips: $('#ee-tips').value,
                target: { sets, repMin, repMax },
                rest
            };
            if (pendingImage) updates.imageUrl = pendingImage;
            const idx = Workout.getState().currentExerciseIdx;
            Workout.updateExerciseRuntime(idx, updates);
            persistOverride(ex.id, updates);
            closeModal();
            renderExercise();
            toast('Ejercicio actualizado ✓', 'success');
        };

        const resetBtn = $('#ee-reset-btn');
        if (resetBtn) resetBtn.onclick = () => {
            if (!confirm('¿Restaurar los valores originales de este ejercicio?')) return;
            Storage.clearOverride(user.id, ex.id);
            // Rebuild current exercise from base
            const routine = findRoutine(Workout.getState().routineId);
            const base = routine?.exercises.find(e => e.id === ex.id);
            if (!base) { closeModal(); return; }
            const idx = Workout.getState().currentExerciseIdx;
            Workout.updateExerciseRuntime(idx, {
                name: base.name,
                tips: base.tips,
                target: base.target,
                rest: base.rest,
                imageUrl: null
            });
            closeModal();
            renderExercise();
            toast('Restaurado', 'success');
        };
    }

    function showSwapExercise() {
        const ex = Workout.getCurrentExercise();
        if (!ex) return;
        const state = Workout.getState();
        // Only suggest exercises from the SAME routine (same training day)
        const routine = findRoutine(state.routineId);
        if (!routine) return;
        const candidates = routine.exercises.filter(e => e.id !== ex.id);

        // Group by muscle (same group highlighted first)
        const byMuscle = new Map();
        for (const e of candidates) {
            if (!byMuscle.has(e.muscle)) byMuscle.set(e.muscle, []);
            byMuscle.get(e.muscle).push(e);
        }

        let html = `
            <h3>Cambiar ejercicio</h3>
            <p style="color:var(--text-2);font-size:13px;margin:-8px 0 14px">Si la máquina está ocupada, escoge otro ejercicio del mismo día (${escapeHtml(routine.day)}). El cambio aplica solo a esta sesión.</p>
        `;
        const muscles = [...byMuscle.keys()].sort((a, b) => {
            if (a === ex.muscle) return -1;
            if (b === ex.muscle) return 1;
            return a.localeCompare(b);
        });
        if (muscles.length === 0) {
            html += `<p style="color:var(--text-2);font-size:14px;text-align:center;padding:20px">No hay otros ejercicios en esta rutina.</p>`;
        }
        for (const muscle of muscles) {
            const items = byMuscle.get(muscle);
            html += `<div class="swap-group"><h4>${escapeHtml(muscle)}${muscle === ex.muscle ? ' · mismo grupo muscular' : ''}</h4><div class="swap-list">`;
            for (const alt of items) {
                html += `
                    <div class="swap-item" data-swap-id="${escapeHtml(alt.id)}">
                        <div class="swap-item-info">
                            <p class="swap-item-name">${escapeHtml(alt.name)}</p>
                            <p class="swap-item-meta">${alt.target.sets} × ${alt.target.repMin}-${alt.target.repMax} reps</p>
                        </div>
                        <span class="swap-item-tag">${escapeHtml(alt.muscle)}</span>
                    </div>
                `;
            }
            html += '</div></div>';
        }
        html += `<button class="btn btn-ghost btn-block" data-action="close-modal" style="margin-top:8px">Cancelar</button>`;
        showModal(html);

        document.querySelectorAll('[data-swap-id]').forEach(item => {
            item.onclick = () => {
                const altId = item.dataset.swapId;
                const alt = routine.exercises.find(e => e.id === altId);
                if (!alt) return;
                const idx = Workout.getState().currentExerciseIdx;
                Workout.swapExercise(idx, alt);
                closeModal();
                renderExercise();
                toast(`Cambiado a ${alt.name}`, 'success');
            };
        });
    }

    // ===== BODY METRICS VIEW =====
    let bodyCharts = {};

    function renderBodyView() {
        const user = Storage.getCurrentUser();
        if (!user) return;
        const entries = Storage.getBodyMetrics(user.id);

        // Stats
        const lastWeight = entries.find(e => e.weight != null);
        const prevWeight = entries.slice(1).find(e => e.weight != null);
        $('#body-current-weight').textContent = lastWeight?.weight ?? '--';

        const wChange = $('#body-weight-change');
        if (lastWeight && prevWeight) {
            const diff = lastWeight.weight - prevWeight.weight;
            const sign = diff > 0 ? '+' : '';
            const symbol = diff > 0 ? '↑' : (diff < 0 ? '↓' : '·');
            wChange.textContent = `${symbol} ${sign}${diff.toFixed(1)} kg desde ${formatRelativeDate(prevWeight.date)}`;
            wChange.className = 'dash-stat-change ' + (diff > 0 ? '' : (diff < 0 ? 'down' : 'flat'));
        } else {
            wChange.textContent = entries.length === 0 ? 'Aún no tienes mediciones' : '';
            wChange.className = 'dash-stat-change flat';
        }

        $('#body-count').textContent = entries.length;
        if (entries.length > 1) {
            const oldest = entries[entries.length - 1];
            $('#body-count-since').textContent = `Desde ${formatRelativeDate(oldest.date)}`;
        } else {
            $('#body-count-since').textContent = '';
        }

        renderBodyWeightChart();
        renderBodyMeasureChart();
        renderBodyHistory();
    }

    function destroyBodyCharts() {
        Object.values(bodyCharts).forEach(c => c && c.destroy && c.destroy());
        bodyCharts = {};
    }

    function renderBodyWeightChart() {
        const user = Storage.getCurrentUser();
        const entries = Storage.getBodyMetrics(user.id)
            .filter(e => e.weight != null)
            .sort((a, b) => new Date(a.date) - new Date(b.date));
        const ctx = document.getElementById('chart-body-weight');
        if (!ctx) return;
        if (bodyCharts.weight) bodyCharts.weight.destroy();
        const labels = entries.map(e => fmtDateShort(e.date));
        const data = entries.map(e => e.weight);
        bodyCharts.weight = new Chart(ctx, {
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
                    pointRadius: 4,
                    fill: true,
                    tension: 0.3
                }]
            },
            options: bodyChartOpts('kg')
        });
    }

    function renderBodyMeasureChart() {
        const measure = $('#body-measure-select')?.value || 'chest';
        const user = Storage.getCurrentUser();
        const entries = Storage.getBodyMetrics(user.id)
            .filter(e => e[measure] != null)
            .sort((a, b) => new Date(a.date) - new Date(b.date));
        const ctx = document.getElementById('chart-body-measure');
        if (!ctx) return;
        if (bodyCharts.measure) bodyCharts.measure.destroy();
        const labels = entries.map(e => fmtDateShort(e.date));
        const data = entries.map(e => e[measure]);
        bodyCharts.measure = new Chart(ctx, {
            type: 'line',
            data: {
                labels,
                datasets: [{
                    data,
                    borderColor: '#00B8FF',
                    backgroundColor: 'rgba(0, 184, 255, 0.15)',
                    borderWidth: 2.5,
                    pointBackgroundColor: '#00B8FF',
                    pointRadius: 4,
                    fill: true,
                    tension: 0.3
                }]
            },
            options: bodyChartOpts('cm')
        });
    }

    function bodyChartOpts(unit) {
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
                    callbacks: { label: ctx => `${ctx.parsed.y} ${unit}` }
                }
            },
            scales: {
                x: { grid: { display: false }, ticks: { color: '#5C6480', font: { size: 11 } } },
                y: {
                    grid: { color: 'rgba(255,255,255,0.05)' },
                    ticks: { color: '#5C6480', font: { size: 11 } }
                }
            }
        };
    }

    function renderBodyHistory() {
        const user = Storage.getCurrentUser();
        const entries = Storage.getBodyMetrics(user.id);
        const list = $('#body-history-list');
        if (entries.length === 0) {
            const es = emptyState({
                illu: 'body',
                title: 'Toma tu primera medición',
                subtitle: 'Registra peso o medidas para ver cómo evoluciona tu cuerpo a lo largo del tiempo.',
                btn: 'Nueva medición',
                onBtn: showAddBodyMetric
            });
            list.innerHTML = es.html;
            es.bind();
            return;
        }
        list.innerHTML = '';
        for (const e of entries) {
            const div = document.createElement('div');
            div.className = 'body-entry';
            const dt = new Date(e.date);
            const parts = [];
            if (e.weight != null) parts.push(`<strong>${e.weight} kg</strong> peso`);
            if (e.chest != null) parts.push(`<strong>${e.chest}</strong> pecho`);
            if (e.waist != null) parts.push(`<strong>${e.waist}</strong> cintura`);
            if (e.biceps != null) parts.push(`<strong>${e.biceps}</strong> bíceps`);
            if (e.quadriceps != null) parts.push(`<strong>${e.quadriceps}</strong> cuádr.`);
            if (e.calves != null) parts.push(`<strong>${e.calves}</strong> gemelos`);
            if (e.back != null) parts.push(`<strong>${e.back}</strong> espalda`);
            div.innerHTML = `
                <div class="body-entry-date">
                    ${dt.getDate()} ${MONTH_NAMES[dt.getMonth()].slice(0,3).toLowerCase()}
                    <small>${dt.getFullYear()}</small>
                </div>
                <div class="body-entry-data">${parts.join(' · ') || '<em>(sin datos)</em>'}</div>
            `;
            div.onclick = () => showBodyEntryDetail(e);
            list.appendChild(div);
        }
    }

    function showBodyEntryDetail(entry) {
        const dt = new Date(entry.date);
        const fields = [
            ['Peso', 'weight', 'kg'],
            ['Pecho', 'chest', 'cm'],
            ['Cintura', 'waist', 'cm'],
            ['Bíceps', 'biceps', 'cm'],
            ['Cuádriceps', 'quadriceps', 'cm'],
            ['Gemelos', 'calves', 'cm'],
            ['Espalda', 'back', 'cm']
        ];
        let rows = '';
        for (const [label, key, unit] of fields) {
            const v = entry[key];
            if (v == null) continue;
            rows += `<div class="settings-row"><span>${label}</span><span><strong>${v}</strong> ${unit}</span></div>`;
        }
        const notes = entry.notes ? `<div style="margin-top:14px;padding:12px;background:rgba(255,255,255,0.04);border-radius:10px;font-size:13px;color:var(--text-1)">${escapeHtml(entry.notes)}</div>` : '';
        showModal(`
            <h3>${dt.toLocaleDateString('es-ES', { day: 'numeric', month: 'long', year: 'numeric' })}</h3>
            ${rows}
            ${notes}
            <div style="display:flex;gap:10px;margin-top:16px">
                <button class="btn btn-ghost" style="flex:1" data-action="close-modal">Cerrar</button>
                <button class="btn btn-danger" style="flex:1" id="delete-metric-btn">Eliminar</button>
            </div>
        `);
        $('#delete-metric-btn').onclick = () => {
            if (!confirm('¿Eliminar esta medición?')) return;
            const user = Storage.getCurrentUser();
            Storage.deleteBodyMetric(user.id, entry.id);
            closeModal();
            renderBodyView();
            toast('Medición eliminada');
        };
    }

    function showAddBodyMetric() {
        const today = new Date().toISOString().slice(0, 10);
        showModal(`
            <h3>Nueva medición</h3>
            <p style="color:var(--text-2);font-size:13px;margin:-8px 0 14px">Completa solo los datos que quieras registrar. Todos son opcionales excepto la fecha.</p>
            <form id="metric-form" style="display:flex;flex-direction:column;gap:12px">
                <div class="input-group"><label>Fecha</label><input type="date" id="m-date" value="${today}" required></div>
                <div class="input-group"><label>Peso (kg)</label><input type="number" id="m-weight" step="0.1" min="20" max="300" inputmode="decimal"></div>
                <div style="display:grid;grid-template-columns:1fr 1fr;gap:10px">
                    <div class="input-group"><label>Pecho (cm)</label><input type="number" id="m-chest" step="0.1" min="30" max="200" inputmode="decimal"></div>
                    <div class="input-group"><label>Cintura (cm)</label><input type="number" id="m-waist" step="0.1" min="30" max="200" inputmode="decimal"></div>
                    <div class="input-group"><label>Bíceps (cm)</label><input type="number" id="m-biceps" step="0.1" min="15" max="80" inputmode="decimal"></div>
                    <div class="input-group"><label>Cuádriceps (cm)</label><input type="number" id="m-quadriceps" step="0.1" min="20" max="120" inputmode="decimal"></div>
                    <div class="input-group"><label>Gemelos (cm)</label><input type="number" id="m-calves" step="0.1" min="15" max="80" inputmode="decimal"></div>
                    <div class="input-group"><label>Espalda (cm)</label><input type="number" id="m-back" step="0.1" min="30" max="200" inputmode="decimal"></div>
                </div>
                <div class="input-group">
                    <label>Notas (opcional)</label>
                    <textarea id="m-notes" rows="2" maxlength="500" style="background:rgba(255,255,255,0.04);border:1px solid var(--border);color:var(--text-0);padding:12px 14px;border-radius:10px;font-family:inherit;font-size:14px;line-height:1.5;resize:vertical"></textarea>
                </div>
                <div style="display:flex;gap:10px;margin-top:6px">
                    <button type="button" class="btn btn-ghost" style="flex:1" data-action="close-modal">Cancelar</button>
                    <button type="submit" class="btn btn-primary" style="flex:1">Guardar</button>
                </div>
            </form>
        `);
        $('#metric-form').onsubmit = e => {
            e.preventDefault();
            const user = Storage.getCurrentUser();
            const dateStr = $('#m-date').value;
            const date = dateStr ? new Date(dateStr + 'T12:00:00').toISOString() : new Date().toISOString();
            const entry = {
                date,
                weight: $('#m-weight').value,
                chest: $('#m-chest').value,
                waist: $('#m-waist').value,
                biceps: $('#m-biceps').value,
                quadriceps: $('#m-quadriceps').value,
                calves: $('#m-calves').value,
                back: $('#m-back').value,
                notes: $('#m-notes').value
            };
            // Require at least one numeric field
            const hasAny = ['weight','chest','waist','biceps','quadriceps','calves','back']
                .some(k => entry[k] !== '' && entry[k] != null);
            if (!hasAny) {
                toast('Ingresa al menos un valor', 'error');
                return;
            }
            Storage.addBodyMetric(user.id, entry);
            closeModal();
            renderBodyView();
            toast('Medición guardada ✓', 'success');
        };
    }

    function formatRelativeDate(iso) {
        const d = new Date(iso);
        const days = Math.round((Date.now() - d.getTime()) / 86400000);
        if (days < 1) return 'hoy';
        if (days < 2) return 'ayer';
        if (days < 7) return `hace ${days} días`;
        if (days < 30) return `hace ${Math.round(days / 7)} sem`;
        if (days < 365) return `hace ${Math.round(days / 30)} mes(es)`;
        return `hace ${Math.round(days / 365)} año(s)`;
    }

    // ===== EXCEL ROUTINE IMPORT/EXPORT =====

    const DAY_NUM_MAP = {
        'lunes': 1, 'lun': 1, 'mon': 1, 'monday': 1,
        'martes': 2, 'mar': 2, 'tue': 2, 'tuesday': 2,
        'miercoles': 3, 'miércoles': 3, 'mie': 3, 'mié': 3, 'wed': 3, 'wednesday': 3,
        'jueves': 4, 'jue': 4, 'thu': 4, 'thursday': 4,
        'viernes': 5, 'vie': 5, 'fri': 5, 'friday': 5,
        'sabado': 6, 'sábado': 6, 'sab': 6, 'sáb': 6, 'sat': 6, 'saturday': 6,
        'domingo': 0, 'dom': 0, 'sun': 0, 'sunday': 0
    };

    const ROUTINE_GRADIENTS = [
        'linear-gradient(135deg, #00FF94 0%, #00B8FF 100%)',
        'linear-gradient(135deg, #00D9A3 0%, #5B8DEF 100%)',
        'linear-gradient(135deg, #FFB454 0%, #00FF94 100%)',
        'linear-gradient(135deg, #5B8DEF 0%, #7C5CFF 100%)'
    ];

    /**
     * Lookup a value across possible column names in a row, case-insensitive.
     */
    function pickField(row, candidates) {
        const keys = Object.keys(row);
        for (const cand of candidates) {
            for (const k of keys) {
                if (k.toLowerCase().replace(/[\s_]/g, '') === cand.toLowerCase().replace(/[\s_]/g, '')) {
                    return row[k];
                }
            }
        }
        return undefined;
    }

    function parseInteger(v, fallback) {
        if (v === '' || v == null) return fallback;
        const n = parseInt(v, 10);
        return isNaN(n) ? fallback : n;
    }
    function parseFloatSafe(v, fallback) {
        if (v === '' || v == null) return fallback;
        const n = parseFloat(String(v).replace(',', '.'));
        return isNaN(n) ? fallback : n;
    }

    /**
     * Parse a routine Excel file using SheetJS.
     * Expected format (single sheet, header row + data rows):
     *   Día | Ejercicio | Series | Rep_min | Rep_max | Descanso_seg | Peso_kg | Notas
     * Each row = one exercise. Rows with same "Día" are grouped into the same routine.
     */
    async function parseRoutineExcel(file) {
        if (typeof XLSX === 'undefined') {
            throw new Error('Librería de Excel no disponible');
        }
        if (file.size > 5 * 1024 * 1024) {
            throw new Error('Archivo muy pesado (máx 5 MB)');
        }
        const buf = await file.arrayBuffer();
        let wb;
        try { wb = XLSX.read(buf, { type: 'array' }); }
        catch (e) { throw new Error('No se pudo leer el archivo'); }

        // Use first sheet by default; could iterate all if needed
        const sheetName = wb.SheetNames[0];
        if (!sheetName) throw new Error('El archivo no tiene hojas');
        const sheet = wb.Sheets[sheetName];
        const rows = XLSX.utils.sheet_to_json(sheet, { defval: '' });
        if (rows.length === 0) throw new Error('La hoja está vacía');

        // Group rows by Día
        const groups = new Map();
        for (const row of rows) {
            const day = String(pickField(row, ['Día', 'Dia', 'Day']) || '').trim();
            const name = String(pickField(row, ['Ejercicio', 'Exercise']) || '').trim();
            if (!day || !name) continue;
            // Sanitize lengths
            if (name.length > 120) continue;
            if (!groups.has(day)) groups.set(day, []);
            groups.get(day).push({
                name,
                muscle: String(pickField(row, ['Músculo', 'Musculo', 'Muscle']) || '').slice(0, 60),
                sets: parseInteger(pickField(row, ['Series', 'Sets']), 3),
                repMin: parseInteger(pickField(row, ['Rep_min', 'RepMin', 'RepsMin', 'Repeticiones min', 'Min']), 8),
                repMax: parseInteger(pickField(row, ['Rep_max', 'RepMax', 'RepsMax', 'Repeticiones max', 'Max']), 10),
                rest: parseInteger(pickField(row, ['Descanso_seg', 'Descanso', 'Rest', 'Descansos']), 90),
                weight: parseFloatSafe(pickField(row, ['Peso_kg', 'Peso', 'Weight', 'Kg']), 0),
                notes: String(pickField(row, ['Notas', 'Notes', 'Tips']) || '').slice(0, 500)
            });
        }

        if (groups.size === 0) {
            throw new Error('No se encontraron filas con Día y Ejercicio');
        }

        // Build routine objects
        const routines = [];
        let i = 0;
        for (const [dayLabel, exercises] of groups) {
            const dayKey = dayLabel.toLowerCase().normalize('NFD').replace(/[̀-ͯ]/g, '');
            const dayNum = DAY_NUM_MAP[dayKey] != null ? DAY_NUM_MAP[dayKey] : 0;
            const idSuffix = Math.random().toString(36).slice(2, 8);
            const routineId = 'cust-' + (dayKey || ('day' + i)) + '-' + idSuffix;
            const sanitizedReps = (min, max) => {
                const a = Math.max(1, Math.min(100, min || 1));
                const b = Math.max(a, Math.min(100, max || a));
                return [a, b];
            };
            routines.push({
                id: routineId,
                name: 'Rutina ' + (dayLabel.charAt(0).toUpperCase() + dayLabel.slice(1)),
                day: dayLabel,
                dayNum,
                category: 'custom',
                gradient: ROUTINE_GRADIENTS[i % ROUTINE_GRADIENTS.length],
                icon: 'chest',
                description: 'Rutina personalizada',
                isCustom: true,
                exercises: exercises.map((ex, j) => {
                    const [rmin, rmax] = sanitizedReps(ex.repMin, ex.repMax);
                    const sets = Math.max(1, Math.min(20, ex.sets || 3));
                    const rest = Math.max(10, Math.min(1800, ex.rest || 90));
                    return {
                        id: routineId + '-ex' + (j + 1),
                        order: j + 1,
                        name: ex.name,
                        muscle: ex.muscle || '',
                        target: { sets, repMin: rmin, repMax: rmax },
                        rest,
                        tips: ex.notes,
                        lastSession: ex.weight > 0
                            ? Array(sets).fill({ weight: ex.weight, reps: rmax })
                            : [],
                        illustration: 'default'
                    };
                })
            });
            i++;
        }

        // Sort by day number for consistent ordering
        routines.sort((a, b) => (a.dayNum || 99) - (b.dayNum || 99));
        return routines;
    }

    function downloadRoutineTemplate() {
        if (typeof XLSX === 'undefined') {
            toast('Librería de Excel no disponible', 'error');
            return;
        }
        const data = [
            ['Día', 'Ejercicio', 'Músculo', 'Series', 'Rep_min', 'Rep_max', 'Descanso_seg', 'Peso_kg', 'Notas'],
            ['Lunes', 'Press Pectoral en Máquina', 'Pecho', 3, 8, 10, 120, 60, 'Asiento altura 4'],
            ['Lunes', 'Remo Sentado Máquina', 'Espalda', 3, 8, 10, 120, 50, 'Lleva los codos hacia atrás'],
            ['Lunes', 'Curl Bíceps con Mancuerna', 'Bíceps', 3, 10, 12, 90, 12, ''],
            ['Martes', 'Sentadilla Smith', 'Cuádriceps', 4, 6, 8, 150, 80, 'Pies adelantados'],
            ['Martes', 'Prensa Inclinada', 'Glúteos', 3, 10, 12, 120, 100, ''],
            ['Martes', 'Gemelos de Pie', 'Gemelos', 3, 12, 15, 60, 80, ''],
            ['Jueves', 'Press Hombro Máquina', 'Hombros', 3, 6, 8, 120, 35, ''],
            ['Jueves', 'Jalón al Pecho Amplio', 'Espalda', 3, 8, 10, 120, 55, ''],
            ['Viernes', 'Hip Thrust', 'Glúteos', 3, 8, 10, 120, 60, ''],
            ['Viernes', 'Sentadilla Búlgara', 'Cuádriceps', 3, 8, 10, 120, 30, '']
        ];
        const ws = XLSX.utils.aoa_to_sheet(data);
        // Column widths
        ws['!cols'] = [
            { wch: 10 }, { wch: 32 }, { wch: 14 }, { wch: 8 }, { wch: 9 }, { wch: 9 }, { wch: 14 }, { wch: 10 }, { wch: 30 }
        ];
        const wb = XLSX.utils.book_new();
        XLSX.utils.book_append_sheet(wb, ws, 'Rutina');
        XLSX.writeFile(wb, 'plantilla_rutina_ev_training.xlsx');
        toast('Plantilla descargada ✓', 'success');
    }

    // ===== EMPTY-STATE ILLUSTRATIONS =====
    /**
     * Hand-drawn-feeling SVG illustrations for empty/loading states.
     * Stroke-based, slightly imperfect curves, paired with our palette.
     */
    const EMPTY_ILLUS = {
        firstWorkout: `
            <svg viewBox="0 0 200 200" fill="none" xmlns="http://www.w3.org/2000/svg">
                <defs>
                    <linearGradient id="es1" x1="0" y1="0" x2="200" y2="200">
                        <stop offset="0" stop-color="#5EEAB0"/>
                        <stop offset="1" stop-color="#B5A8FF"/>
                    </linearGradient>
                </defs>
                <circle cx="100" cy="100" r="70" stroke="url(#es1)" stroke-width="2.5" stroke-dasharray="3 6" opacity="0.6"/>
                <path d="M70 110 Q85 80 100 95 T130 95" stroke="url(#es1)" stroke-width="3" stroke-linecap="round" fill="none"/>
                <circle cx="70" cy="110" r="5" fill="url(#es1)"/>
                <circle cx="130" cy="95" r="5" fill="url(#es1)"/>
                <path d="M100 140 L100 155 M85 150 L115 150" stroke="url(#es1)" stroke-width="3" stroke-linecap="round" opacity="0.5"/>
                <text x="100" y="180" text-anchor="middle" font-family="Fraunces" font-size="13" fill="#9BA1B0" font-style="italic">tu primera huella</text>
            </svg>`,
        history: `
            <svg viewBox="0 0 200 200" fill="none" xmlns="http://www.w3.org/2000/svg">
                <defs>
                    <linearGradient id="es2" x1="0" y1="0" x2="200" y2="200">
                        <stop offset="0" stop-color="#5EEAB0"/>
                        <stop offset="1" stop-color="#B5A8FF"/>
                    </linearGradient>
                </defs>
                <rect x="50" y="40" width="100" height="130" rx="14" stroke="url(#es2)" stroke-width="2.5" fill="none"/>
                <path d="M65 65 L135 65 M65 90 L120 90 M65 115 L130 115 M65 140 L110 140" stroke="url(#es2)" stroke-width="2" stroke-linecap="round" opacity="0.5"/>
                <circle cx="55" cy="65" r="3" fill="url(#es2)"/>
                <circle cx="55" cy="90" r="3" fill="url(#es2)"/>
                <circle cx="55" cy="115" r="3" fill="url(#es2)" opacity="0.6"/>
            </svg>`,
        records: `
            <svg viewBox="0 0 200 200" fill="none" xmlns="http://www.w3.org/2000/svg">
                <defs>
                    <linearGradient id="es3" x1="0" y1="0" x2="200" y2="200">
                        <stop offset="0" stop-color="#FFB088"/>
                        <stop offset="1" stop-color="#5EEAB0"/>
                    </linearGradient>
                </defs>
                <path d="M75 60 L100 35 L125 60 L120 105 Q100 125 80 105 Z" stroke="url(#es3)" stroke-width="2.5" fill="none" stroke-linejoin="round"/>
                <path d="M85 75 L100 90 L115 70" stroke="url(#es3)" stroke-width="3" stroke-linecap="round" stroke-linejoin="round"/>
                <path d="M100 125 L100 145 M85 145 L115 145 M80 160 L120 160" stroke="url(#es3)" stroke-width="2.5" stroke-linecap="round" opacity="0.6"/>
                <circle cx="55" cy="75" r="3" fill="url(#es3)" opacity="0.5"/>
                <circle cx="150" cy="80" r="3" fill="url(#es3)" opacity="0.5"/>
                <circle cx="60" cy="115" r="2" fill="url(#es3)" opacity="0.4"/>
            </svg>`,
        body: `
            <svg viewBox="0 0 200 200" fill="none" xmlns="http://www.w3.org/2000/svg">
                <defs>
                    <linearGradient id="es4" x1="0" y1="0" x2="200" y2="200">
                        <stop offset="0" stop-color="#B5A8FF"/>
                        <stop offset="1" stop-color="#5EEAB0"/>
                    </linearGradient>
                </defs>
                <circle cx="100" cy="60" r="22" stroke="url(#es4)" stroke-width="2.5" fill="none"/>
                <path d="M75 95 Q75 130 100 145 Q125 130 125 95" stroke="url(#es4)" stroke-width="2.5" fill="none" stroke-linecap="round"/>
                <path d="M75 100 L60 130 M125 100 L140 130" stroke="url(#es4)" stroke-width="2.5" stroke-linecap="round"/>
                <path d="M90 145 L85 175 M110 145 L115 175" stroke="url(#es4)" stroke-width="2.5" stroke-linecap="round"/>
                <path d="M50 150 Q100 170 150 150" stroke="url(#es4)" stroke-width="1.5" stroke-dasharray="2 4" opacity="0.5"/>
            </svg>`
    };

    function emptyState({ illu = 'firstWorkout', title, subtitle, btn, onBtn }) {
        const id = 'empty-btn-' + Math.random().toString(36).slice(2, 8);
        const html = `
            <div class="empty-state">
                <div class="empty-state-illu">${EMPTY_ILLUS[illu] || EMPTY_ILLUS.firstWorkout}</div>
                <h3>${escapeHtml(title)}</h3>
                <p>${escapeHtml(subtitle)}</p>
                ${btn ? `<button class="btn btn-primary" id="${id}">${escapeHtml(btn)}</button>` : ''}
            </div>
        `;
        // Return both the HTML and a binder for the button
        return {
            html,
            bind() {
                const b = document.getElementById(id);
                if (b && onBtn) b.onclick = onBtn;
            }
        };
    }

    function escapeHtml(str) {
        if (str == null) return '';
        return String(str)
            .replace(/&/g, '&amp;')
            .replace(/</g, '&lt;')
            .replace(/>/g, '&gt;')
            .replace(/"/g, '&quot;')
            .replace(/'/g, '&#039;');
    }

    // ===== EXPOSE =====
    return { init, showView, deleteSession, closeModal };
})();

document.addEventListener('DOMContentLoaded', App.init);
