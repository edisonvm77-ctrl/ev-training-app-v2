/**
 * Data extracted from "EV_Entrenamiento_ene/26.xlsx"
 * 4 routines: Torso-Lunes, Piernas A-Martes, Torso-Jueves, Piernas B-Viernes
 * Latest weights/reps reference the most recent recorded session in the file.
 */

const DEFAULT_REST_SECONDS = 120;

const ROUTINES = [
    {
        id: 'torso-lunes',
        name: 'TORSO',
        day: 'Lunes',
        dayNum: 1,
        category: 'torso',
        gradient: 'linear-gradient(135deg, #00FF94 0%, #00B8FF 100%)',
        icon: 'chest',
        description: 'Pecho, espalda, hombros y brazos',
        exercises: [
            {
                id: 'tl-1',
                order: 1,
                name: 'Press Pectoral en Máquina',
                muscle: 'Pecho',
                target: { sets: 3, repMin: 8, repMax: 10 },
                rest: 120,
                tips: 'Altura del asiento en 4. Las manijas deben quedar a la altura de los pezones. Empuja con el pecho, no con los hombros, y controla la bajada.',
                lastSession: [
                    { weight: 75, reps: 10 },
                    { weight: 75, reps: 10 },
                    { weight: 75, reps: 9 }
                ],
                illustration: 'chest-press'
            },
            {
                id: 'tl-2',
                order: 2,
                name: 'Remo Sentado Máquina (Agarre Horizontal)',
                muscle: 'Espalda',
                target: { sets: 2, repMin: 8, repMax: 10 },
                rest: 120,
                tips: 'Altura del asiento en 5. Lleva los codos hacia atrás aproximando las escápulas. Mantén el pecho elevado durante todo el movimiento.',
                lastSession: [
                    { weight: 62.5, reps: 9 },
                    { weight: 62.5, reps: 9 }
                ],
                illustration: 'row'
            },
            {
                id: 'tl-3',
                order: 3,
                name: 'Pecho Mancuernas Inclinado',
                muscle: 'Pecho superior',
                target: { sets: 2, repMin: 8, repMax: 10 },
                rest: 120,
                tips: 'Inclinación del banco a 30 grados. Baja las mancuernas controladamente hasta sentir el estiramiento del pecho. Junta arriba sin chocarlas.',
                lastSession: [
                    { weight: 28, reps: 10 },
                    { weight: 28, reps: 8 }
                ],
                illustration: 'incline-press'
            },
            {
                id: 'tl-4',
                order: 4,
                name: 'Elevaciones Laterales Mancuernas',
                muscle: 'Hombros',
                target: { sets: 2, repMin: 10, repMax: 15 },
                rest: 120,
                tips: 'Banco a 45 grados. Sube los brazos lateralmente hasta la altura de los hombros con ligera flexión de codo. Controla la bajada.',
                lastSession: [
                    { weight: 10, reps: 15 },
                    { weight: 10, reps: 14 }
                ],
                illustration: 'lateral-raise'
            },
            {
                id: 'tl-6',
                order: 5,
                name: 'Curl Martillo Máquina',
                muscle: 'Bíceps / Braquial',
                target: { sets: 2, repMin: 8, repMax: 10 },
                rest: 120,
                tips: 'Agarre neutro tipo martillo. Codos pegados al torso, sin balancear. Sube controlando la contracción.',
                lastSession: [
                    { weight: 16, reps: 11 },
                    { weight: 16, reps: 11 }
                ],
                illustration: 'hammer-curl'
            },
            {
                id: 'tl-5',
                order: 6,
                name: 'Tríceps Polea Over Head Katana (Unilateral)',
                muscle: 'Tríceps',
                target: { sets: 2, repMin: 10, repMax: 15 },
                rest: 120,
                tips: 'Altura de la polea en 15. Brazo unilateral con extensión completa. Mantén el codo cerca de la cabeza, no lo dejes abrir.',
                lastSession: [
                    { weight: 8.5, reps: 11 },
                    { weight: 8.5, reps: 10 }
                ],
                illustration: 'triceps-overhead'
            }
        ]
    },
    {
        id: 'piernas-a-martes',
        name: 'PIERNAS A',
        day: 'Martes',
        dayNum: 2,
        category: 'piernas',
        gradient: 'linear-gradient(135deg, #00D9A3 0%, #00B8FF 100%)',
        icon: 'leg',
        description: 'Cuádriceps, isquios y gemelos',
        exercises: [
            {
                id: 'pa-1',
                order: 1,
                name: 'Sentadilla Smith',
                muscle: 'Cuádriceps',
                target: { sets: 3, repMin: 6, repMax: 8 },
                rest: 120,
                tips: 'Seguro en 4. Pies adelantados para énfasis en cuádriceps. Baja por debajo de la paralela manteniendo la espalda neutra.',
                lastSession: [
                    { weight: 100, reps: 7 },
                    { weight: 100, reps: 7 },
                    { weight: 100, reps: 6 }
                ],
                illustration: 'squat'
            },
            {
                id: 'pa-2',
                order: 2,
                name: 'Prensa Unilateral',
                muscle: 'Glúteos / Cuádriceps',
                target: { sets: 2, repMin: 8, repMax: 10 },
                rest: 120,
                tips: 'Pie arriba a la altura del hombro. Punta del pie ligeramente hacia afuera. Trabaja énfasis glúteo. Bloquea la otra pierna o súbela al pecho.',
                lastSession: [
                    { weight: 90, reps: 9 },
                    { weight: 90, reps: 9 }
                ],
                illustration: 'leg-press'
            },
            {
                id: 'pa-3',
                order: 3,
                name: 'Máquina Isquios Sentado',
                muscle: 'Isquiotibiales',
                target: { sets: 2, repMin: 12, repMax: 15 },
                rest: 120,
                tips: 'Asiento en 4, 2, 2. Usa colchoneta para mejor postura. Flexiona contrayendo los isquios. Vuelve controlando la fase excéntrica.',
                lastSession: [
                    { weight: 55, reps: 12 },
                    { weight: 55, reps: 12 }
                ],
                illustration: 'leg-curl'
            },
            {
                id: 'pa-4',
                order: 4,
                name: 'Gemelos de Pie',
                muscle: 'Gemelos',
                target: { sets: 3, repMin: 10, repMax: 15 },
                rest: 60,
                tips: 'Eleva los talones lo más alto posible. Pausa breve arriba. Baja controlado sintiendo el estiramiento.',
                lastSession: [
                    { weight: 105, reps: 12 },
                    { weight: 105, reps: 11 },
                    { weight: 105, reps: 11 }
                ],
                illustration: 'calf'
            },
            {
                id: 'pa-5',
                order: 5,
                name: 'Crunch Abdominal',
                muscle: 'Abdomen',
                target: { sets: 3, repMin: 10, repMax: 15 },
                rest: 60,
                tips: 'Contracción del abdomen, no por flexión de cadera. Mantén la zona lumbar pegada al respaldo.',
                lastSession: [
                    { weight: 35, reps: 15 },
                    { weight: 35, reps: 15 },
                    { weight: 35, reps: 15 }
                ],
                illustration: 'crunch'
            }
        ]
    },
    {
        id: 'torso-jueves',
        name: 'TORSO',
        day: 'Jueves',
        dayNum: 4,
        category: 'torso',
        gradient: 'linear-gradient(135deg, #5B8DEF 0%, #7C5CFF 100%)',
        icon: 'shoulder',
        description: 'Hombros, espalda, pecho y brazos',
        exercises: [
            {
                id: 'tj-1',
                order: 1,
                name: 'Press Hombro Máquina',
                muscle: 'Hombros',
                target: { sets: 3, repMin: 6, repMax: 8 },
                rest: 120,
                tips: 'Altura en 7 con agarre horizontal. No arquees la cadera ni la espalda. Codos cerrados, no abiertos. No lleves los hombros hacia las orejas. No bloquees los brazos arriba.',
                lastSession: [
                    { weight: 40, reps: 8 },
                    { weight: 40, reps: 8 },
                    { weight: 40, reps: 7 }
                ],
                illustration: 'shoulder-press'
            },
            {
                id: 'tj-2',
                order: 2,
                name: 'Jalón al Pecho Amplio',
                muscle: 'Espalda',
                target: { sets: 2, repMin: 8, repMax: 10 },
                rest: 120,
                tips: 'Agarre prono amplio. Altura en 5. No lances los codos hacia atrás, llévalos a las costillas. Baja la barra hasta las clavículas. No arquees la espalda.',
                lastSession: [
                    { weight: 65, reps: 8 },
                    { weight: 65, reps: 8 }
                ],
                illustration: 'lat-pulldown'
            },
            {
                id: 'tj-3',
                order: 3,
                name: 'Peck Deck Máquina',
                muscle: 'Pecho',
                target: { sets: 2, repMin: 12, repMax: 15 },
                rest: 120,
                tips: 'Altura en 6. Ajusta el asiento para que las manijas queden a la altura de los hombros. No despegues las escápulas en las últimas reps. Saca el pecho durante todo el ejercicio.',
                lastSession: [
                    { weight: 60, reps: 12 },
                    { weight: 60, reps: 11 }
                ],
                illustration: 'pec-deck'
            },
            {
                id: 'tj-4',
                order: 4,
                name: 'Fly Inverso en Polea',
                muscle: 'Hombro posterior',
                target: { sets: 2, repMin: 12, repMax: 15 },
                rest: 120,
                tips: 'Altura 27 a la altura de los hombros. De pie recto, sin inclinaciones. Apertura en forma de T con agarre neutro.',
                lastSession: [
                    { weight: 7.25, reps: 13 },
                    { weight: 7.25, reps: 12 }
                ],
                illustration: 'rear-fly'
            },
            {
                id: 'tj-6',
                order: 5,
                name: 'Tríceps Jalón en Poleas (2 Manos)',
                muscle: 'Tríceps',
                target: { sets: 2, repMin: 10, repMax: 15 },
                rest: 120,
                tips: 'Altura en 27. Ancla los codos a las costillas. El movimiento debe ser solo del antebrazo. No subas tanto la polea a la barbilla. No muevas el torso, solo los antebrazos.',
                lastSession: [
                    { weight: 8.5, reps: 13 },
                    { weight: 8.5, reps: 12 }
                ],
                illustration: 'triceps-pushdown'
            },
            {
                id: 'tj-5',
                order: 6,
                name: 'Curl Sentado Banco Scott',
                muscle: 'Bíceps',
                target: { sets: 2, repMin: 10, repMax: 15 },
                rest: 120,
                tips: 'Banco Scott altura 6. Apoya bien los tríceps en el banco. Estira completo abajo y contrae arriba sin balancear.',
                lastSession: [
                    { weight: 15, reps: 12 },
                    { weight: 15, reps: 12 }
                ],
                illustration: 'preacher-curl'
            }
        ]
    },
    {
        id: 'piernas-b-viernes',
        name: 'PIERNAS B',
        day: 'Viernes',
        dayNum: 5,
        category: 'piernas',
        gradient: 'linear-gradient(135deg, #FFB454 0%, #00FF94 100%)',
        icon: 'glute',
        description: 'Glúteos, cuádriceps y abdomen',
        exercises: [
            {
                id: 'pb-1',
                order: 1,
                name: 'Hip Thrust',
                muscle: 'Glúteos',
                target: { sets: 3, repMin: 8, repMax: 10 },
                rest: 120,
                tips: 'Coloca tus pies desde la tercera línea negra contando desde abajo. Empuja desde los talones, contrae glúteos arriba. Mantén la barbilla pegada al pecho.',
                lastSession: [
                    { weight: 45, reps: 9 },
                    { weight: 45, reps: 9 },
                    { weight: 45, reps: 9 }
                ],
                illustration: 'hip-thrust'
            },
            {
                id: 'pb-2',
                order: 2,
                name: 'Sentadilla Búlgara Smith',
                muscle: 'Glúteos / Cuádriceps',
                target: { sets: 2, repMin: 8, repMax: 10 },
                rest: 120,
                tips: 'Seguro en 4. Step a un pie de la máquina. El otro step a 4 dedos del inicio de la barra. Tronco ligeramente inclinado adelante.',
                lastSession: [
                    { weight: 40, reps: 8 },
                    { weight: 40, reps: 8 }
                ],
                illustration: 'bulgarian-squat'
            },
            {
                id: 'pb-3',
                order: 3,
                name: 'Aductores en Máquina',
                muscle: 'Aductores',
                target: { sets: 2, repMin: 10, repMax: 15 },
                rest: 120,
                tips: 'Seguro en 3. Cierra las piernas controladamente, contrae al final. No rebotes en el tope de apertura.',
                lastSession: [
                    { weight: 40, reps: 11 },
                    { weight: 40, reps: 10 }
                ],
                illustration: 'adductor'
            },
            {
                id: 'pb-4',
                order: 4,
                name: 'Máquina Ext. Cuádriceps',
                muscle: 'Cuádriceps',
                target: { sets: 2, repMin: 10, repMax: 15 },
                rest: 120,
                tips: 'Asiento en 4, pies en 2, rodilla en 2. Extensión completa con contracción al final. Baja controlado.',
                lastSession: [
                    { weight: 52.5, reps: 12 },
                    { weight: 52.5, reps: 11 }
                ],
                illustration: 'leg-extension'
            },
            {
                id: 'pb-5',
                order: 5,
                name: 'Gemelos Sentado',
                muscle: 'Gemelos',
                target: { sets: 3, repMin: 12, repMax: 15 },
                rest: 60,
                tips: 'Apoya las almohadillas en la parte baja del cuádriceps. Sube y baja con rango completo. Pausa contracción arriba.',
                lastSession: [
                    { weight: 140, reps: 11 },
                    { weight: 140, reps: 11 },
                    { weight: 140, reps: 9 }
                ],
                illustration: 'seated-calf'
            },
            {
                id: 'pb-6',
                order: 6,
                name: 'Crunch Abdominal',
                muscle: 'Abdomen',
                target: { sets: 3, repMin: 10, repMax: 15 },
                rest: 60,
                tips: 'Contracción abdominal pura. No tires del cuello. Espira al subir.',
                lastSession: [
                    { weight: 35, reps: 15 },
                    { weight: 35, reps: 15 },
                    { weight: 35, reps: 14 }
                ],
                illustration: 'crunch'
            }
        ]
    }
];

const DAY_NAMES = ['Domingo', 'Lunes', 'Martes', 'Miércoles', 'Jueves', 'Viernes', 'Sábado'];
const DAY_NAMES_SHORT = ['Dom', 'Lun', 'Mar', 'Mié', 'Jue', 'Vie', 'Sáb'];
const MONTH_NAMES = [
    'Enero', 'Febrero', 'Marzo', 'Abril', 'Mayo', 'Junio',
    'Julio', 'Agosto', 'Septiembre', 'Octubre', 'Noviembre', 'Diciembre'
];

// Default admin credentials (the owner can change this later)
const DEFAULT_ADMIN = {
    id: 'admin',
    username: 'edison',
    name: 'Edison',
    password: 'ev2026',
    role: 'admin',
    routines: ROUTINES.map(r => r.id),
    createdAt: new Date().toISOString()
};
