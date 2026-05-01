/**
 * Workout state machine: handles execution, set tracking, rest timer
 */

const Workout = (() => {
    let state = null;
    let timers = { workout: null, rest: null };

    function init(routine, userId) {
        state = {
            id: 'sess_' + Date.now().toString(36),
            routineId: routine.id,
            routineName: routine.name,
            routineDay: routine.day,
            userId,
            startedAt: new Date().toISOString(),
            endedAt: null,
            durationSec: 0,
            currentExerciseIdx: 0,
            currentSetIdx: 0,
            exercises: routine.exercises.map(ex => buildExerciseState(routine.id, ex.id, userId)),
            workoutSeconds: 0,
            restRemaining: 0,
            restTotal: 0,
            isResting: false
        };
        startWorkoutClock();
        return state;
    }

    /**
     * Build state for one exercise using effective data (overrides + last session).
     */
    function buildExerciseState(routineId, exerciseId, userId) {
        const eff = (typeof Storage !== 'undefined' && Storage.getEffectiveExercise)
            ? Storage.getEffectiveExercise(routineId, exerciseId, userId)
            : null;
        // Fallback: pull from ROUTINES or from current user's customRoutines
        const base = eff || (() => {
            let r = ROUTINES.find(r => r.id === routineId);
            if (!r && typeof Storage !== 'undefined' && Storage.getUser) {
                const u = Storage.getUser(userId);
                if (u && Array.isArray(u.customRoutines)) {
                    r = u.customRoutines.find(r => r && r.id === routineId);
                }
            }
            return r ? r.exercises.find(e => e.id === exerciseId) : null;
        })();
        if (!base) return null;
        return {
            id: base.id,
            name: base.customName || base.name,
            originalName: base.name,
            muscle: base.muscle,
            target: { ...base.target },
            rest: base.rest,
            tips: base.tips,
            illustration: base.illustration,
            imageUrl: base.imageUrl || null,
            sets: Array.from({ length: base.target.sets }, (_, i) => {
                const last = base.lastSession && base.lastSession[i];
                return {
                    idx: i + 1,
                    targetWeight: last ? last.weight : (base.lastSession?.[0]?.weight || 0),
                    targetReps: last ? last.reps : base.target.repMax,
                    weight: null,
                    reps: null,
                    completed: false
                };
            }),
            lastSession: base.lastSession || [],
            // For "swap" we keep track of the original to preserve linkage if needed
            swappedTo: null
        };
    }

    /**
     * Update the runtime state of an exercise (after editing target/tips/etc.)
     * Re-builds set rows preserving completed entries when possible.
     */
    function updateExerciseRuntime(exerciseIdx, updates) {
        if (!state) return;
        const ex = state.exercises[exerciseIdx];
        if (updates.target) {
            const newTarget = { ...ex.target, ...updates.target };
            const oldSets = ex.sets;
            const newSets = Array.from({ length: newTarget.sets }, (_, i) => {
                const existing = oldSets[i];
                if (existing) return existing;
                const last = ex.lastSession[i] || ex.lastSession[0] || {};
                return {
                    idx: i + 1,
                    targetWeight: last.weight || 0,
                    targetReps: last.reps || newTarget.repMax,
                    weight: null,
                    reps: null,
                    completed: false
                };
            });
            ex.target = newTarget;
            ex.sets = newSets;
        }
        if (updates.tips !== undefined) ex.tips = updates.tips;
        if (updates.rest !== undefined) ex.rest = updates.rest;
        if (updates.imageUrl !== undefined) ex.imageUrl = updates.imageUrl;
        if (updates.name !== undefined) ex.name = updates.name;
    }

    /**
     * Replace the entire exercise (swap to alternative).
     * Preserves the order/index but uses a different exercise definition.
     */
    function swapExercise(exerciseIdx, alt) {
        if (!state || !alt) return;
        const ex = state.exercises[exerciseIdx];
        const target = { ...ex.target };
        ex.swappedTo = alt.id;
        ex.id = alt.id;
        ex.name = alt.name;
        ex.muscle = alt.muscle;
        ex.illustration = alt.illustration || ex.illustration;
        ex.tips = alt.tips || ex.tips;
        ex.imageUrl = alt.imageUrl || null;
        ex.lastSession = alt.lastSession || [];
        // Keep target sets/reps to maintain the workout structure
        ex.target = target;
    }

    function getState() { return state; }
    function getCurrentExercise() { return state ? state.exercises[state.currentExerciseIdx] : null; }
    function getCurrentSet() {
        const ex = getCurrentExercise();
        return ex ? ex.sets[state.currentSetIdx] : null;
    }
    function totalExercises() { return state ? state.exercises.length : 0; }

    function startWorkoutClock() {
        clearInterval(timers.workout);
        timers.workout = setInterval(() => {
            if (state) {
                state.workoutSeconds++;
                Workout.onTick && Workout.onTick();
            }
        }, 1000);
    }

    function stopWorkoutClock() {
        clearInterval(timers.workout);
        timers.workout = null;
    }

    function setSetData(exerciseIdx, setIdx, data) {
        if (!state) return;
        const set = state.exercises[exerciseIdx].sets[setIdx];
        if (data.weight !== undefined) set.weight = data.weight;
        if (data.reps !== undefined) set.reps = data.reps;
        if (data.completed !== undefined) set.completed = data.completed;
    }

    function completeSet(exerciseIdx, setIdx) {
        if (!state) return;
        const set = state.exercises[exerciseIdx].sets[setIdx];
        // Use targets if user didn't enter
        if (set.weight == null) set.weight = set.targetWeight;
        if (set.reps == null) set.reps = set.targetReps;
        set.completed = true;
        return set;
    }

    function startRest(seconds, nextLabel) {
        if (!state) return;
        clearInterval(timers.rest);
        state.restTotal = seconds;
        state.restRemaining = seconds;
        state.isResting = true;
        state.restNextLabel = nextLabel || '';
        timers.rest = setInterval(() => {
            state.restRemaining--;
            Workout.onRestTick && Workout.onRestTick();
            if (state.restRemaining <= 0) {
                endRest();
                Workout.onRestEnd && Workout.onRestEnd();
            }
        }, 1000);
    }

    function adjustRest(deltaSeconds) {
        if (!state || !state.isResting) return;
        state.restRemaining = Math.max(0, state.restRemaining + deltaSeconds);
        state.restTotal = Math.max(state.restTotal, state.restRemaining);
    }

    function endRest() {
        clearInterval(timers.rest);
        if (state) {
            state.isResting = false;
            state.restRemaining = 0;
        }
    }

    function nextSet() {
        if (!state) return { done: false, ofExercise: false };
        const ex = state.exercises[state.currentExerciseIdx];
        if (state.currentSetIdx + 1 < ex.sets.length) {
            state.currentSetIdx++;
            return { done: false, ofExercise: false };
        } else {
            // Done with this exercise
            return { done: true, ofExercise: true };
        }
    }

    function nextExercise() {
        if (!state) return { done: true };
        if (state.currentExerciseIdx + 1 < state.exercises.length) {
            state.currentExerciseIdx++;
            state.currentSetIdx = 0;
            return { done: false };
        }
        return { done: true };
    }

    function prevExercise() {
        if (!state) return;
        if (state.currentExerciseIdx > 0) {
            state.currentExerciseIdx--;
            state.currentSetIdx = 0;
        }
    }

    function jumpTo(exerciseIdx, setIdx = 0) {
        if (!state) return;
        if (exerciseIdx >= 0 && exerciseIdx < state.exercises.length) {
            state.currentExerciseIdx = exerciseIdx;
            state.currentSetIdx = Math.min(setIdx, state.exercises[exerciseIdx].sets.length - 1);
        }
    }

    function finish() {
        if (!state) return null;
        stopWorkoutClock();
        endRest();
        state.endedAt = new Date().toISOString();
        state.durationSec = state.workoutSeconds;
        // Compute totals
        let totalReps = 0, totalSets = 0, totalVolume = 0;
        for (const ex of state.exercises) {
            for (const s of ex.sets) {
                if (s.completed) {
                    totalSets++;
                    totalReps += s.reps || 0;
                    totalVolume += (s.weight || 0) * (s.reps || 0);
                }
            }
        }
        state.totals = { sets: totalSets, reps: totalReps, volume: totalVolume };
        return state;
    }

    function abort() {
        stopWorkoutClock();
        endRest();
        state = null;
    }

    function buildSavablePayload(userId) {
        if (!state) return null;
        return {
            id: state.id,
            userId,
            routineId: state.routineId,
            routineName: state.routineName,
            routineDay: state.routineDay,
            date: state.endedAt || new Date().toISOString(),
            startedAt: state.startedAt,
            durationSec: state.durationSec,
            totals: state.totals,
            exercises: state.exercises.map(ex => ({
                id: ex.id,
                name: ex.name,
                muscle: ex.muscle,
                sets: ex.sets.map(s => ({
                    idx: s.idx,
                    weight: s.weight,
                    reps: s.reps,
                    completed: s.completed,
                    targetWeight: s.targetWeight,
                    targetReps: s.targetReps
                }))
            }))
        };
    }

    return {
        init, getState, getCurrentExercise, getCurrentSet, totalExercises,
        setSetData, completeSet,
        startRest, adjustRest, endRest,
        nextSet, nextExercise, prevExercise, jumpTo,
        finish, abort,
        buildSavablePayload,
        updateExerciseRuntime, swapExercise,
        // event hooks (set by app.js)
        onTick: null,
        onRestTick: null,
        onRestEnd: null
    };
})();
