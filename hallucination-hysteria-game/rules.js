/* Pure scoring/state rules shared by the browser and deterministic checks. */
(function (root) {
  'use strict';
  const R = {
    windows: {perfect: .060, good: .110, miss: .150},
    delta: {Perfect: 3, Good: 2, Miss: -6, Ghost: -8, Hold: 2},
    clamp: value => Math.max(0, Math.min(100, value)),
    judge(error) { const a = Math.abs(error); return a <= .060 + 1e-9 ? 'Perfect' : a <= .110 + 1e-9 ? 'Good' : a <= .150 + 1e-9 ? 'Miss' : null; },
    change(clarity, result) { return R.clamp(clarity + (R.delta[result] || 0)); },
    ending: clarity => clarity > 50 ? 'Clear Ending' : 'Lost Ending',
    seconds: (beat, bpm) => beat * 60 / bpm,
    songTime: (contextTime, origin, latency, offsetMs) => contextTime - origin - latency - offsetMs / 1000,
    fresh(stage = 0) { return {stage, clarity: 50, combo: 0, hits: 0, misses: 0}; },
    press(notes, lane, time, bpm) {
      return notes.filter(n => n.side === 'player' && n.lane === lane && !n.done && !n.holding && Math.abs(time - R.seconds(n.beat, bpm)) <= .150 + 1e-9)
        .sort((a,b) => Math.abs(time-R.seconds(a.beat,bpm))-Math.abs(time-R.seconds(b.beat,bpm)))[0];
    },
    expire(note, time, bpm) {
      if (note.side !== 'player' || note.done || note.holding || time <= R.seconds(note.beat,bpm) + .150) return null;
      note.done = true; return note.ghost ? 'Pass' : 'Miss';
    },
    release(note, time, bpm) {
      if (!note.holding || note.done) return null;
      note.done = true; note.holding = false;
      return time + 1e-9 >= R.seconds(note.beat + note.hold,bpm) ? 'Hold' : 'Miss';
    },
    ghostSafe: (ghost, real) => real.every(n => n.side !== 'player' || n.ghost || n.lane !== ghost.lane || ghost.beat < n.beat - .6 || ghost.beat > n.beat + (n.hold || 0) + .6)
  };
  root.HHRules = R;
  if (typeof module !== 'undefined') module.exports = R;
})(typeof window === 'undefined' ? globalThis : window);
