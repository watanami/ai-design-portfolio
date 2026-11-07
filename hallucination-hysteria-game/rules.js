/* Pure scoring/state rules shared by the browser and deterministic checks. */
(function (root) {
  'use strict';
  const R = {
    windows: {perfect: .070, good: .150, miss: .190},
    delta: {Perfect: 3, Good: 2, Miss: -6, Hold: 2},
    clamp: value => Math.max(0, Math.min(100, value)),
    judge(error) { const a = Math.abs(error); return a <= .070 + 1e-9 ? 'Perfect' : a <= .150 + 1e-9 ? 'Good' : null; },
    points: (result, stage=0) => result==='Miss'&&stage>=2 ? -4 : (R.delta[result]||0),
    change(clarity, result, stage=0) { return R.clamp(clarity + R.points(result,stage)); },
    ending: clarity => clarity > 50 ? 'Clear Ending' : 'Lost Ending',
    seconds: (beat, bpm) => beat * 60 / bpm,
    songTime: (contextTime, origin, latency, offsetMs) => contextTime - origin - latency - offsetMs / 1000,
    fresh(stage = 0) { return {stage, clarity: 50, combo: 0, bestCombo: 0, hits: 0, misses: 0}; },
    eventTime(songTime, stamp, performanceNow) { const d=performanceNow-stamp; return songTime-(Number.isFinite(d)&&d>=0&&d<1000?d/1000:0); },
    press(notes, lane, time, bpm) {
      return notes.filter(n => n.side === 'player' && n.lane === lane && !n.done && !n.holding && Math.abs(time - R.seconds(n.beat, bpm)) <= .150 + 1e-9)
        .sort((a,b) => Math.abs(time-R.seconds(a.beat,bpm))-Math.abs(time-R.seconds(b.beat,bpm)))[0];
    },
    expire(note, time, bpm) {
      if (note.side !== 'player' || note.done || note.holding || time <= R.seconds(note.beat,bpm) + R.windows.miss) return null;
      note.done = true; return 'Miss';
    },
    release(note, time, bpm) {
      if (!note.holding || note.done) return null;
      note.done = true; note.holding = false;
      return time + .045 >= R.seconds(note.beat + note.hold,bpm) ? 'Hold' : 'Miss';
    },

  };
  root.HHRules = R;
  if (typeof module !== 'undefined') module.exports = R;
})(typeof window === 'undefined' ? globalThis : window);
