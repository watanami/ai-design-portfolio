# Week 2 game brief

Source: the current proposal webpage and Micah's Week 2 decisions, which override older documents. Player: a first-time rhythm player as the headphone-wearing Walker. Goal: get home through three battles; Stage 3 clarity above50 earns Clear, otherwise Lost.

Interaction: match visible solid arrows with arrows/WASD/touch; ignore hollow dashed ghosts. Music supports timing, never hides required direction. Opening: Start unlocks audio, a91BPM pulse and one note at a time teach alignment; four successful presses start Stage1. Street introduces one-bar call/response and four decoys. Stranger introduces direction changes, one-to-two-beat holds and six decoys. Room combines skills in two-bar phrases with no decoys.

Clear: morning, headphones off, Faded Dream, “I made it home.” Lost: warped room, muffled Reflection, “Was any of it real?”, then blurred street. Both lead to credits and then Ready. Visual direction: original proposal shapes,16:9, caller left/player right, clarity eye below, scenery alone distorts.

Required first demo: fixed charts, licensed excerpts, scoring, holds, ghosts, pause/blur pause, same-stage failure restart, manual transitions, endings, touch controls and project text. Optional/deferred: chart recorder, saved scores, detailed character animation, recorded whispers/footsteps, alternate difficulty.

## Open choices resolved

- Presses110–150ms from a note consume it as a miss; beyond150ms a press is empty. Misses occur once.
- Positive audio offset delays displayed/judged notes relative to music. Use exact60/BPM, not rounded beat lengths. Supplied excerpt endpoints remain unchanged.
- Stage2's10.58s is elapsed excerpt time. First16beats show the entrance, then a caller bar; first player response is beat20 (13.19s).
- Stage3 drop is beat16,116.8978s into the file. Sparse one-bar intro; thereafter two-bar calls/responses.
- Opening retries without penalty. Each stage starts at50. Stage ends at excerpt boundary after final judgments and two-second fade; never auto-advance.
- Failure shows warp/Restart, then retries the same stage after1.2 audio-clock seconds. Hidden tab pauses this transition.
- Ending Play Again/Start Again opens credits; credits Play Again resets to Ready. Clear also accepts any arrow.
- Optional player name defaults to Micah, local only. Settings carry across runs; gameplay/name reset. No storage.
- Lost continues the current recording briefly beyond the excerpt, then fades to street. Clear releases it and loads Faded Dream. One decoded recording retained at a time.
- Pause suspends audio clock. Active tails get300ms to re-grip on Resume. Reduced motion removes warp movement; no strobes.
- Approximate downbeats and device latency require human listening; mathematical no-drift checks do not prove perceptual alignment.
