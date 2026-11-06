# Event table

| Action/event | Condition | Response | Visible feedback | Acceptance check |
|---|---|---|---|---|
| Start | Ready | Create/resume AudioContext | Opening note | Silent before Start |
| Opening press | Within110ms | Count hit, soft tone | Lamp lights, less blur | Four hits start Stage1 |
| Hit | Within60/110ms | Perfect+3 / Good+2, cap100 | Judgment/target | 58+3+3=64 |
| Miss | >150ms late or110–150ms press | −6 once, thud, mute voice | Miss | No duplicate penalty |
| Empty press | No note within150ms | Nothing | Pad press | Score unchanged |
| Hit ghost | Within150ms | −8, sour tone | Ghost−8 | No call tone |
| Pass ghost | >150ms late | Remove | Arrow leaves | No penalty |
| Press hold | Valid head hit | Normal judgment; track tail | Lit tail | Head awarded once |
| Release hold | Before tail end | −6 once | Released early | No tail reward |
| Complete hold | Held to end | +2 once | Hold+2 | No double reward |
| Pause | P/Esc/button/blur/hidden | Suspend clock/audio | Resume | Same music/beat frozen |
| Resume | Explicit action | Resume saved state | Same note positions | Never auto-resume |
| Clarity runs out | 0 | Failed then same-stage retry | Warp/Restart | Stage3 stays Stage3 |
| Restart | R/button | Clear inputs/judgments, clarity50 | Count-in | Same stage |
| Stage complete | Excerpt ended | Stop music; wait | Start Next Stage | No auto-advance |
| Ending check | Stage3 ends | >50 Clear, else Lost | Ending | 50 Lost;51 Clear |
| Clear ending | Clear | Morning/Faded Dream | Play Again | Arrow/button opens credits |
| Lost ending | Lost | Muffled Reflection; blurred street | Start Again | Opens credits |
| Credits/restart | Play Again | Full gameplay reset | Ready/Start | No music, next Start opening |
