# Revised state flow
Ready → Loading → Playing (Street) → Story (2 pages) → Loading → Playing (Stranger) → Story (2 pages) → Loading → Playing (Room) → Clear or Lost → Credits → Ready.

Start has no tutorial. Story Continue advances a page, then starts the next chapter. Skip to song starts it immediately. All transitions wait for user input.
Playing at zero clarity → Stage Failed → same stage after 1.2 audio-clock seconds.
Active states → Paused on P/Esc, window blur or hidden tab; Resume restores the same clock.
Loading failure → Error → Retry or title. Stale asynchronous loads cannot replace current audio.
