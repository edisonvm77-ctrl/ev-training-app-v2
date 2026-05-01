/**
 * Simple line-art SVG illustrations for each exercise.
 * Stylized figures that hint at the movement without needing imagery.
 */

const Illustrations = (() => {
    const STROKE = '#00FF94';
    const STROKE_2 = '#00B8FF';

    const makeSvg = (inner) => `
        <svg viewBox="0 0 200 120" fill="none" xmlns="http://www.w3.org/2000/svg" style="width:100%;height:100%">
            <defs>
                <linearGradient id="exg" x1="0" y1="0" x2="200" y2="120">
                    <stop offset="0" stop-color="${STROKE}"/>
                    <stop offset="1" stop-color="${STROKE_2}"/>
                </linearGradient>
            </defs>
            ${inner}
        </svg>`;

    // Stylized human figure helpers
    const head = (cx, cy, r=7) => `<circle cx="${cx}" cy="${cy}" r="${r}" stroke="url(#exg)" stroke-width="2.5"/>`;

    const ILLUSTRATIONS = {
        'chest-press': makeSvg(`
            ${head(70, 28)}
            <path d="M70 36 V70 M55 70 H85" stroke="url(#exg)" stroke-width="2.5" stroke-linecap="round"/>
            <path d="M55 70 L40 95 M85 70 L100 95" stroke="url(#exg)" stroke-width="2.5" stroke-linecap="round"/>
            <path d="M70 36 L100 50 L130 36 M70 50 L100 64 L130 50" stroke="url(#exg)" stroke-width="2.5" stroke-linecap="round" stroke-linejoin="round"/>
            <rect x="125" y="32" width="20" height="6" rx="2" stroke="url(#exg)" stroke-width="2"/>
            <rect x="125" y="46" width="20" height="6" rx="2" stroke="url(#exg)" stroke-width="2"/>
            <path d="M150 35 L170 28 M150 49 L170 42" stroke="url(#exg)" stroke-width="2" stroke-linecap="round" opacity="0.5"/>
        `),
        'row': makeSvg(`
            ${head(100, 30)}
            <path d="M100 38 V72 M85 72 H115" stroke="url(#exg)" stroke-width="2.5" stroke-linecap="round"/>
            <path d="M85 72 L70 98 M115 72 L130 98" stroke="url(#exg)" stroke-width="2.5" stroke-linecap="round"/>
            <path d="M100 50 L75 48 L55 56 M100 50 L125 48 L145 56" stroke="url(#exg)" stroke-width="2.5" stroke-linecap="round" stroke-linejoin="round"/>
            <path d="M55 56 L45 60 M145 56 L155 60" stroke="url(#exg)" stroke-width="2.5" stroke-linecap="round"/>
            <path d="M30 58 H50 M150 58 H170" stroke="url(#exg)" stroke-width="3" stroke-linecap="round"/>
        `),
        'incline-press': makeSvg(`
            <path d="M30 100 L160 50" stroke="url(#exg)" stroke-width="2" stroke-linecap="round" opacity="0.4"/>
            ${head(110, 50)}
            <path d="M110 58 L90 100 M115 58 L80 95" stroke="url(#exg)" stroke-width="2.5" stroke-linecap="round"/>
            <path d="M110 58 L130 38 M115 58 L155 35" stroke="url(#exg)" stroke-width="2.5" stroke-linecap="round"/>
            <circle cx="135" cy="35" r="6" stroke="url(#exg)" stroke-width="2"/>
            <circle cx="158" cy="32" r="6" stroke="url(#exg)" stroke-width="2"/>
        `),
        'lateral-raise': makeSvg(`
            ${head(100, 30)}
            <path d="M100 38 V80 M88 80 H112" stroke="url(#exg)" stroke-width="2.5" stroke-linecap="round"/>
            <path d="M88 80 L78 105 M112 80 L122 105" stroke="url(#exg)" stroke-width="2.5" stroke-linecap="round"/>
            <path d="M100 50 L60 50 M100 50 L140 50" stroke="url(#exg)" stroke-width="2.5" stroke-linecap="round"/>
            <circle cx="50" cy="50" r="8" stroke="url(#exg)" stroke-width="2"/>
            <circle cx="150" cy="50" r="8" stroke="url(#exg)" stroke-width="2"/>
            <path d="M40 35 L40 28 M55 35 L55 28 M145 35 L145 28 M160 35 L160 28" stroke="url(#exg)" stroke-width="1.5" stroke-linecap="round" opacity="0.4"/>
        `),
        'triceps-overhead': makeSvg(`
            ${head(100, 30)}
            <path d="M100 38 V80 M88 80 H112" stroke="url(#exg)" stroke-width="2.5" stroke-linecap="round"/>
            <path d="M88 80 L78 105 M112 80 L122 105" stroke="url(#exg)" stroke-width="2.5" stroke-linecap="round"/>
            <path d="M100 45 L80 25 L60 35 L60 50" stroke="url(#exg)" stroke-width="2.5" stroke-linecap="round" stroke-linejoin="round"/>
            <path d="M55 50 H75" stroke="url(#exg)" stroke-width="3" stroke-linecap="round"/>
            <path d="M165 20 V100" stroke="url(#exg)" stroke-width="2" stroke-linecap="round" opacity="0.5"/>
            <rect x="155" y="38" width="20" height="14" rx="2" stroke="url(#exg)" stroke-width="2" opacity="0.6"/>
        `),
        'hammer-curl': makeSvg(`
            ${head(100, 28)}
            <path d="M100 36 V80 M88 80 H112" stroke="url(#exg)" stroke-width="2.5" stroke-linecap="round"/>
            <path d="M88 80 L78 105 M112 80 L122 105" stroke="url(#exg)" stroke-width="2.5" stroke-linecap="round"/>
            <path d="M100 48 L75 70 L78 90 M100 48 L125 70 L122 90" stroke="url(#exg)" stroke-width="2.5" stroke-linecap="round" stroke-linejoin="round"/>
            <rect x="65" y="86" width="22" height="10" rx="3" stroke="url(#exg)" stroke-width="2"/>
            <rect x="113" y="86" width="22" height="10" rx="3" stroke="url(#exg)" stroke-width="2"/>
        `),
        'shoulder-press': makeSvg(`
            ${head(100, 60)}
            <path d="M100 68 V100 M88 100 H112" stroke="url(#exg)" stroke-width="2.5" stroke-linecap="round"/>
            <path d="M100 80 L80 80 M100 80 L120 80" stroke="url(#exg)" stroke-width="2.5" stroke-linecap="round"/>
            <path d="M80 80 L75 50 M120 80 L125 50" stroke="url(#exg)" stroke-width="2.5" stroke-linecap="round"/>
            <rect x="60" y="42" width="32" height="10" rx="2" stroke="url(#exg)" stroke-width="2"/>
            <rect x="108" y="42" width="32" height="10" rx="2" stroke="url(#exg)" stroke-width="2"/>
            <path d="M62 30 L62 40 M138 30 L138 40" stroke="url(#exg)" stroke-width="2" stroke-linecap="round" opacity="0.5"/>
        `),
        'lat-pulldown': makeSvg(`
            <path d="M40 15 H160" stroke="url(#exg)" stroke-width="3" stroke-linecap="round"/>
            <path d="M100 15 V35" stroke="url(#exg)" stroke-width="2" opacity="0.5"/>
            <rect x="55" y="35" width="90" height="6" rx="2" stroke="url(#exg)" stroke-width="2"/>
            ${head(100, 60)}
            <path d="M100 68 V95 M88 95 H112" stroke="url(#exg)" stroke-width="2.5" stroke-linecap="round"/>
            <path d="M100 73 L70 41 M100 73 L130 41" stroke="url(#exg)" stroke-width="2.5" stroke-linecap="round"/>
        `),
        'pec-deck': makeSvg(`
            ${head(100, 35)}
            <path d="M100 43 V90 M85 90 H115" stroke="url(#exg)" stroke-width="2.5" stroke-linecap="round"/>
            <path d="M100 55 L70 50 L65 80 M100 55 L130 50 L135 80" stroke="url(#exg)" stroke-width="2.5" stroke-linecap="round" stroke-linejoin="round"/>
            <rect x="50" y="60" width="20" height="34" rx="3" stroke="url(#exg)" stroke-width="2"/>
            <rect x="130" y="60" width="20" height="34" rx="3" stroke="url(#exg)" stroke-width="2"/>
        `),
        'rear-fly': makeSvg(`
            ${head(100, 35)}
            <path d="M100 43 V85 M85 85 H115" stroke="url(#exg)" stroke-width="2.5" stroke-linecap="round"/>
            <path d="M85 85 L75 105 M115 85 L125 105" stroke="url(#exg)" stroke-width="2.5" stroke-linecap="round"/>
            <path d="M100 55 L60 70 M100 55 L140 70" stroke="url(#exg)" stroke-width="2.5" stroke-linecap="round"/>
            <path d="M60 70 L40 80 M140 70 L160 80" stroke="url(#exg)" stroke-width="2" stroke-linecap="round" stroke-dasharray="3 3"/>
            <circle cx="35" cy="82" r="5" stroke="url(#exg)" stroke-width="2"/>
            <circle cx="165" cy="82" r="5" stroke="url(#exg)" stroke-width="2"/>
        `),
        'preacher-curl': makeSvg(`
            ${head(85, 40)}
            <path d="M85 48 V85 M73 85 H97" stroke="url(#exg)" stroke-width="2.5" stroke-linecap="round"/>
            <path d="M85 58 L120 60 L155 30" stroke="url(#exg)" stroke-width="2.5" stroke-linecap="round" stroke-linejoin="round"/>
            <path d="M105 70 L160 70" stroke="url(#exg)" stroke-width="3" stroke-linecap="round" opacity="0.6"/>
            <rect x="148" y="22" width="20" height="10" rx="2" stroke="url(#exg)" stroke-width="2"/>
        `),
        'triceps-pushdown': makeSvg(`
            ${head(100, 30)}
            <path d="M100 38 V82 M88 82 H112" stroke="url(#exg)" stroke-width="2.5" stroke-linecap="round"/>
            <path d="M88 82 L78 105 M112 82 L122 105" stroke="url(#exg)" stroke-width="2.5" stroke-linecap="round"/>
            <path d="M100 48 L90 75 M100 48 L110 75" stroke="url(#exg)" stroke-width="2.5" stroke-linecap="round"/>
            <rect x="84" y="73" width="32" height="6" rx="2" stroke="url(#exg)" stroke-width="2"/>
            <path d="M100 73 V18" stroke="url(#exg)" stroke-width="2" opacity="0.6"/>
            <path d="M85 18 H115" stroke="url(#exg)" stroke-width="3" stroke-linecap="round"/>
        `),
        'squat': makeSvg(`
            <path d="M40 18 H160" stroke="url(#exg)" stroke-width="3" stroke-linecap="round"/>
            <circle cx="50" cy="18" r="10" stroke="url(#exg)" stroke-width="2"/>
            <circle cx="150" cy="18" r="10" stroke="url(#exg)" stroke-width="2"/>
            ${head(100, 38)}
            <path d="M85 50 H115" stroke="url(#exg)" stroke-width="2.5" stroke-linecap="round"/>
            <path d="M100 46 V70 L85 90 L85 105 M100 70 L115 90 L115 105" stroke="url(#exg)" stroke-width="2.5" stroke-linecap="round" stroke-linejoin="round"/>
        `),
        'leg-press': makeSvg(`
            <path d="M30 100 L170 100" stroke="url(#exg)" stroke-width="2" opacity="0.5"/>
            ${head(50, 75)}
            <path d="M55 80 L80 75 M55 82 L75 92" stroke="url(#exg)" stroke-width="2.5" stroke-linecap="round"/>
            <path d="M80 75 L120 60 L155 50 M75 92 L120 78 L155 65" stroke="url(#exg)" stroke-width="2.5" stroke-linecap="round" stroke-linejoin="round"/>
            <rect x="150" y="35" width="20" height="50" rx="3" stroke="url(#exg)" stroke-width="2.5"/>
        `),
        'leg-curl': makeSvg(`
            <path d="M40 80 H120 V60 H140" stroke="url(#exg)" stroke-width="2.5" stroke-linecap="round" stroke-linejoin="round"/>
            ${head(60, 50)}
            <path d="M65 56 V78" stroke="url(#exg)" stroke-width="2.5" stroke-linecap="round"/>
            <path d="M65 75 L130 75 L155 55" stroke="url(#exg)" stroke-width="3" stroke-linecap="round" stroke-linejoin="round"/>
            <rect x="148" y="48" width="14" height="14" rx="2" stroke="url(#exg)" stroke-width="2"/>
        `),
        'calf': makeSvg(`
            ${head(100, 18)}
            <path d="M100 26 V58 M85 50 L100 40 L115 50" stroke="url(#exg)" stroke-width="2.5" stroke-linecap="round"/>
            <path d="M95 58 L85 95 L70 100 M105 58 L115 95 L130 100" stroke="url(#exg)" stroke-width="2.5" stroke-linecap="round"/>
            <path d="M65 100 H75 M125 100 H135" stroke="url(#exg)" stroke-width="3" stroke-linecap="round"/>
            <path d="M40 105 H160" stroke="url(#exg)" stroke-width="2" opacity="0.4"/>
            <path d="M70 90 V70 M130 90 V70" stroke="url(#exg)" stroke-width="2" stroke-linecap="round" opacity="0.4"/>
        `),
        'crunch': makeSvg(`
            <path d="M30 95 H170" stroke="url(#exg)" stroke-width="2" opacity="0.4"/>
            ${head(60, 70)}
            <path d="M65 75 L100 60 L130 78" stroke="url(#exg)" stroke-width="2.5" stroke-linecap="round" stroke-linejoin="round"/>
            <path d="M130 78 L150 95 M130 78 L150 60" stroke="url(#exg)" stroke-width="2.5" stroke-linecap="round"/>
            <path d="M67 65 L75 50" stroke="url(#exg)" stroke-width="2.5" stroke-linecap="round"/>
        `),
        'back-extension': makeSvg(`
            <path d="M30 95 H170" stroke="url(#exg)" stroke-width="2" opacity="0.4"/>
            ${head(140, 50)}
            <path d="M135 56 L100 70" stroke="url(#exg)" stroke-width="2.5" stroke-linecap="round"/>
            <path d="M100 70 L65 85 L50 95" stroke="url(#exg)" stroke-width="2.5" stroke-linecap="round" stroke-linejoin="round"/>
            <path d="M85 75 L75 95" stroke="url(#exg)" stroke-width="2.5" stroke-linecap="round"/>
            <rect x="40" y="78" width="50" height="14" rx="3" stroke="url(#exg)" stroke-width="2" opacity="0.6"/>
        `),
        'hip-thrust': makeSvg(`
            <path d="M40 100 H160" stroke="url(#exg)" stroke-width="2" opacity="0.4"/>
            <rect x="20" y="55" width="40" height="20" rx="3" stroke="url(#exg)" stroke-width="2" opacity="0.6"/>
            ${head(50, 50)}
            <path d="M55 55 L100 60" stroke="url(#exg)" stroke-width="2.5" stroke-linecap="round"/>
            <path d="M100 60 L130 60 L130 95 M100 60 L100 95" stroke="url(#exg)" stroke-width="2.5" stroke-linecap="round" stroke-linejoin="round"/>
            <rect x="80" y="48" width="60" height="10" rx="2" stroke="url(#exg)" stroke-width="2.5"/>
            <circle cx="80" cy="53" r="14" stroke="url(#exg)" stroke-width="2" opacity="0.5"/>
            <circle cx="140" cy="53" r="14" stroke="url(#exg)" stroke-width="2" opacity="0.5"/>
        `),
        'bulgarian-squat': makeSvg(`
            ${head(100, 32)}
            <path d="M85 50 H115 M100 40 V70 L85 95 L80 105" stroke="url(#exg)" stroke-width="2.5" stroke-linecap="round" stroke-linejoin="round"/>
            <path d="M100 70 L130 90 L155 75" stroke="url(#exg)" stroke-width="2.5" stroke-linecap="round" stroke-linejoin="round"/>
            <path d="M150 70 H170 V85 H150 Z" stroke="url(#exg)" stroke-width="2"/>
            <path d="M30 105 H170" stroke="url(#exg)" stroke-width="2" opacity="0.4"/>
        `),
        'adductor': makeSvg(`
            ${head(100, 35)}
            <path d="M100 43 V70 M85 70 L60 100 M115 70 L140 100" stroke="url(#exg)" stroke-width="2.5" stroke-linecap="round" stroke-linejoin="round"/>
            <rect x="40" y="92" width="30" height="14" rx="3" stroke="url(#exg)" stroke-width="2"/>
            <rect x="130" y="92" width="30" height="14" rx="3" stroke="url(#exg)" stroke-width="2"/>
            <path d="M70 99 L130 99" stroke="url(#exg)" stroke-width="2" stroke-dasharray="3 3" opacity="0.5"/>
        `),
        'leg-extension': makeSvg(`
            ${head(50, 50)}
            <path d="M55 56 V80 M55 78 L120 78" stroke="url(#exg)" stroke-width="2.5" stroke-linecap="round"/>
            <path d="M120 78 L160 40" stroke="url(#exg)" stroke-width="3" stroke-linecap="round"/>
            <rect x="148" y="32" width="22" height="14" rx="3" stroke="url(#exg)" stroke-width="2"/>
            <path d="M40 95 H160" stroke="url(#exg)" stroke-width="2" opacity="0.4"/>
        `),
        'seated-calf': makeSvg(`
            ${head(50, 35)}
            <path d="M55 42 V70 M55 70 L100 70" stroke="url(#exg)" stroke-width="2.5" stroke-linecap="round"/>
            <path d="M100 70 L100 100 M85 100 L115 100" stroke="url(#exg)" stroke-width="2.5" stroke-linecap="round"/>
            <rect x="80" y="50" width="40" height="14" rx="3" stroke="url(#exg)" stroke-width="2.5"/>
            <path d="M100 50 V35" stroke="url(#exg)" stroke-width="2" opacity="0.5"/>
            <rect x="40" y="105" width="120" height="3" rx="1" fill="url(#exg)" opacity="0.4"/>
        `),
        'default': makeSvg(`
            <circle cx="100" cy="50" r="22" stroke="url(#exg)" stroke-width="2.5"/>
            <path d="M100 72 V100 M75 100 H125" stroke="url(#exg)" stroke-width="2.5" stroke-linecap="round"/>
        `)
    };

    function get(key) {
        return ILLUSTRATIONS[key] || ILLUSTRATIONS['default'];
    }

    return { get };
})();
