# Screens

| State | Information | Main button | Next behavior |
|---|---|---|---|
| Ready | Sound needed, keys/pads, solid/ghost rule, name | Start | Opening |
| Opening | Four hits to find beat | Pause | Freeze or finish four hits |
| Playing | Stage, clarity, judgment, progress | Pause | Freeze |
| Paused | Reason, re-grip tails | Resume | Same state/beat |
| Stage Complete | Result and narrative | Start Next Stage | Load next at50 |
| Stage Failed | Clarity ran out | Restart Stage | Same stage; auto after1.2s |
| Clear Ending | Morning, I made it home | Play Again | Credits; arrow also works |
| Lost Ending | Warped room then street, Was any of it real? | Start Again | Credits |
| Credits | Four exact credits/license | Play Again | Ready, full reset |
| Loading/error | Track status | Retry / Back to title | Retry load / Ready |

Focus moves to new main actions. Transition messages announced, not per-frame scores. Project explanation remains readable without JS; play requires JS.
