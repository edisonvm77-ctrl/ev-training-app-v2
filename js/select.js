/**
 * Custom Select component — consistent dark-theme dropdown.
 *
 * Why: native <select> opens with the OS theme (light) which clashes badly
 * with our dark UI. Touch-targets are also too small on mobile.
 *
 * Usage:
 *   const el = Select.create({
 *     id: 'role',
 *     options: [{value:'user', label:'Usuario'}, {value:'admin', label:'Administrador'}],
 *     value: 'user'
 *   });
 *   container.appendChild(el);
 *   Select.value(el)         // 'user'
 *   Select.set(el, 'admin')  // change
 *   el.addEventListener('change', e => console.log(e.detail.value));
 */

const Select = (() => {
    const openMenus = new Set();

    // Close on outside click
    document.addEventListener('click', e => {
        if (!e.target.closest('.cs')) closeAll();
    }, true);
    // Close on Escape
    document.addEventListener('keydown', e => {
        if (e.key === 'Escape') closeAll();
    });

    function closeAll() {
        for (const m of openMenus) {
            m.classList.remove('open');
            const root = m.closest('.cs');
            if (root) root.classList.remove('cs-open');
        }
        openMenus.clear();
    }

    function escapeText(s) {
        return String(s == null ? '' : s)
            .replace(/&/g, '&amp;')
            .replace(/</g, '&lt;')
            .replace(/>/g, '&gt;')
            .replace(/"/g, '&quot;');
    }

    /**
     * Create a custom select element.
     * @param {Object} cfg
     * @param {string} [cfg.id]            optional hidden input id
     * @param {Array<{value, label, hint?}>} cfg.options
     * @param {string} [cfg.value]         initial value
     * @param {string} [cfg.placeholder]
     * @param {Function} [cfg.onChange]
     * @returns {HTMLElement}
     */
    function create(cfg) {
        const root = document.createElement('div');
        root.className = 'cs';
        const initial = cfg.options.find(o => String(o.value) === String(cfg.value)) || cfg.options[0];
        if (initial) root.dataset.value = initial.value;
        const initialLabel = initial ? initial.label : (cfg.placeholder || '...');

        root.innerHTML = `
            <button type="button" class="cs-trigger" aria-haspopup="listbox" aria-expanded="false">
                <span class="cs-label">${escapeText(initialLabel)}</span>
                <svg class="cs-chev" viewBox="0 0 12 8" width="12" height="8" fill="none" aria-hidden="true">
                    <path d="M1 1l5 5 5-5" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"/>
                </svg>
            </button>
            <div class="cs-menu" role="listbox">
                ${cfg.options.map(opt => `
                    <button type="button" class="cs-option ${initial && String(opt.value) === String(initial.value) ? 'selected' : ''}" data-value="${escapeText(opt.value)}" role="option">
                        <span class="cs-option-label">${escapeText(opt.label)}</span>
                        ${opt.hint ? `<span class="cs-option-hint">${escapeText(opt.hint)}</span>` : ''}
                    </button>
                `).join('')}
            </div>
            ${cfg.id ? `<input type="hidden" id="${escapeText(cfg.id)}" value="${escapeText(initial ? initial.value : '')}">` : ''}
        `;

        const trigger = root.querySelector('.cs-trigger');
        const menu = root.querySelector('.cs-menu');
        const label = root.querySelector('.cs-label');
        const hidden = root.querySelector('input[type="hidden"]');

        trigger.addEventListener('click', e => {
            e.stopPropagation();
            const isOpen = menu.classList.contains('open');
            closeAll();
            if (!isOpen) {
                menu.classList.add('open');
                root.classList.add('cs-open');
                trigger.setAttribute('aria-expanded', 'true');
                openMenus.add(menu);
                // Focus first selected or first option for keyboard nav
                const sel = menu.querySelector('.cs-option.selected') || menu.querySelector('.cs-option');
                if (sel) sel.focus();
            } else {
                trigger.setAttribute('aria-expanded', 'false');
            }
        });

        menu.addEventListener('keydown', e => {
            const opts = [...menu.querySelectorAll('.cs-option')];
            const idx = opts.indexOf(document.activeElement);
            if (e.key === 'ArrowDown') {
                e.preventDefault();
                opts[Math.min(opts.length - 1, idx + 1)]?.focus();
            } else if (e.key === 'ArrowUp') {
                e.preventDefault();
                opts[Math.max(0, idx - 1)]?.focus();
            } else if (e.key === 'Enter' || e.key === ' ') {
                e.preventDefault();
                document.activeElement?.click();
            }
        });

        for (const opt of root.querySelectorAll('.cs-option')) {
            opt.addEventListener('click', () => {
                const newVal = opt.dataset.value;
                root.dataset.value = newVal;
                if (hidden) hidden.value = newVal;
                label.textContent = opt.querySelector('.cs-option-label')?.textContent.trim() || opt.textContent.trim();
                root.querySelectorAll('.cs-option').forEach(o => o.classList.toggle('selected', o === opt));
                menu.classList.remove('open');
                root.classList.remove('cs-open');
                trigger.setAttribute('aria-expanded', 'false');
                openMenus.delete(menu);
                trigger.focus();
                if (cfg.onChange) cfg.onChange(newVal);
                root.dispatchEvent(new CustomEvent('change', { detail: { value: newVal }, bubbles: true }));
            });
        }

        return root;
    }

    function value(root) {
        return root && root.dataset ? root.dataset.value : '';
    }

    function set(root, val) {
        const opt = root.querySelector(`.cs-option[data-value="${CSS.escape(String(val))}"]`);
        if (opt) opt.click();
    }

    /**
     * Replace an existing native <select> with a custom one (preserves id and name).
     * Returns the new wrapper element.
     */
    function replaceNative(selectEl, onChange) {
        if (!selectEl) return null;
        const opts = [...selectEl.options].map(o => ({ value: o.value, label: o.textContent }));
        const cfg = {
            id: selectEl.id,
            options: opts,
            value: selectEl.value,
            onChange
        };
        const cs = create(cfg);
        selectEl.replaceWith(cs);
        return cs;
    }

    return { create, value, set, replaceNative, closeAll };
})();
