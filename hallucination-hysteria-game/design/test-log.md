# Playtest log — November 7, 2026

## 04 / One improvement after testing

My friend clicked Start, and I was not sure they knew they could change the name. The countdown was too quick: they missed the first notes while working out what was happening. It took a couple of tries to learn the arrow timing.

I made the name field explicitly optional and editable, added a short instruction screen after the opening dialogue, and extended the first-stage countdown to four seconds. I also centered the arrow panels and gave them a muted contrasting fill and border. These changes aim to help a new player prepare without adding a practice round. After a follow-up test, I reported that the revised opening passed the friend test.

## 05 / One useful AI exchange

Summary of our exchange: I reported that my friend missed the opening notes and needed clearer preparation. AI offered two options: a short instruction screen with a slower countdown, or an interactive practice round. I chose the instruction screen and slower countdown because I wanted clear preparation without a practice round. This kept the story opening while giving the player time to understand the controls.


## Week 3 — November 16, 2026

Feedback supplied by Micah: instructor could not recognize successful hits; classmates struggled with missed arrows, timing, caller versus player cues, and phone labels. Micah requested a smooth load, designed labels, a meaningful clarity meter and notes contained inside their panels.

- Replaced the loading stick figure with night and fading, smaller scene files, so the first visit feels continuous.
- Added target glow, burst rings, nearby judgments and clearer hit sounds, so successful inputs register immediately.
- Added lane-specific misses, timing hints and scenery pulses, so players can understand errors without losing sight of the arrows.
- Made the warm YOU panel larger and explained the caller’s two-beat lead, so beginners know which side to follow.
- Redesigned panel labels, note clipping and the Lost / Clear meter, so the interface supports the story and stays legible on smaller screens.
- Added a three-second countdown for later stages, results cards and Skip story, so repeated attempts move at the player’s pace.

New-player observation: PENDING. No Week 3 playtest result is claimed.

Before screenshots: saving from the browser tool failed with EPERM; image throttling is unavailable. Micah can supply before images. Home screenshot and comparison pairs remain open until genuine captures can be saved.


## November 16–17: timing, layout and difficulty follow-up

Added Normal/Hard selection (Normal unchanged; Hard adds modest beat-aligned notes), explicit slightly-early/slightly-late successful feedback, centered panel subtitles, separate feedback below the playfield, an eye that opens with clarity, and immediate note clearing on failure. Cached scenery at 30 Hz while keeping arrows on each animation frame. Restricted empty mobile feedback styling to visible feedback.

Validation: 17 automated checks pass, including Hard-chart spacing, symmetric timing windows and failure clearing. Audio is mocked; physical latency is not measured. Local preview responds HTTP 200, but the in-app browser failed to connect during the final visual recheck. Current desktop/mobile appearance and perceived lag still need a human playtest. Not published.


## November 17: softer hits and caption breathing room

Micah found the successful-hit tone annoying and MATCH THESE ARROWS too tightly spaced. Replaced the high triangle hit tones with shorter, quieter sine taps and a gentle downward pitch envelope. Perfect remains subtly distinct. Added 20 canvas pixels between captions and targets while preserving the note travel distance; phone labels now occupy a separate row with more padding and line spacing. Updated the concise process note to reflect real friend-test observations, later owner feedback, current revisions and AI assistance, without claiming a new human playtest. Latest refinements remain local; final publication and public-site verification are outstanding.


## November 17: Week 3 submission review

Reworked the process note into documented feedback, three written before/after comparisons (opening, hit feedback, progression), personal design decisions and named AI assistance. Preserved the distinction between the earlier friend test, later owner review and automated checks. All 19 checks pass. No new independent human test or live deployment is claimed. The assignment allows a written comparison; the earlier custom request for screenshot pairs remains unfulfilled. The homepage links directly to the game with a secondary proposal link, but still uses original key art rather than the requested gameplay screenshot. Publication and public-site validation remain outstanding.


## November 17: feedback attribution clarified

Micah supplied four classmate comments and professor feedback. Classmates praised the story/rhythm connection, aesthetics, instructions and countdown; requested clearer player/caller separation, phone readability, stronger miss consequences and early/late guidance. The professor praised visual direction and requested more recognizable, rewarding successful-hit sound and animation. Reframed the process note and three comparison cards around these sources. These are observations about the reviewed draft, not evidence that reviewers tested every latest revision. Genuine before/after gameplay images remain requested; only recent title-form screenshots were found locally.
