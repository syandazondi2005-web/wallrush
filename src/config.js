/* =====================================================================
   WALL RUSH — DEPLOYMENT CONFIGURATION
   The only file a deployer normally needs to edit.
   Everything here is public: this is a static site, so never put
   passwords, tokens or API keys in this file.
   ===================================================================== */

const WR_CONFIG = {
  /* ONLINE PLAY
     Server rooms use a plain relay: every JSON message sent to
     `${endpoint}?room=CODE` is forwarded to the other peers in that room.
     Leave empty until a backend exists; the interface then says so honestly.
     Example: 'wss://games.example.org/wallrush' */
  online: {
    endpoint: '',
    /* Internet play through Supabase Realtime (see README).
       Leave both empty to keep internet multiplayer disabled.
       url:     your project URL, e.g. 'https://abcdxyz.supabase.co'
       anonKey: the PUBLIC "anon" / "publishable" key. Never the service_role / secret key. */
    supabase: { url: 'https://hdsaevkktnvhkoinkzcg.supabase.co', anonKey: 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6Imhkc2FldmtrdG52aGtvaW5remNnIiwicm9sZSI6ImFub24iLCJpYXQiOjE3OTA5NzI4MDUsImV4cCI6MjEwNjU0ODgwNX0.mn_cqpmy6bzLTOvMwjLwkfJeAxk3cnd-m2VTklfTxDI' }
  },

  
  heritage: {
    documented: [
      { title: "Wall Rush as an arcade genre: overview",
        text: "The Wall Rush (or Rush Wall) genre represents a quintessential evolution in modern reflex-based arcade design. Defined by high-velocity gameplay, minimalist controls, and escalating spatial tension, the concept has transitioned from simple web flash games into a dominant sub-genre within hyper-casual mobile gaming and user-generated platforms like Roblox.",
        source: "Supplied by the project owner. Independent citation still needed." },
      { title: "Historical foundations (late 2000s – early 2010s)",
        text: "The mechanical roots of the genre stem from a convergence of physical game shows and early digital arcade design. The spatial puzzler era: inspired by television phenomena such as Japan's Brain Wall (known globally as Hole in the Wall), early web developers created browser-based games focused on aligning shapes or characters to pass through openings in moving barriers. The infinite runner boom: the explosion of games like Temple Run (2011) and Flappy Bird (2013) introduced the endless survival framework, proving that simple, high-speed dodge mechanics possessed immense player retention value.",
        source: "Supplied by the project owner. Independent citation still needed." },
      { title: "Hyper-casual modernization (2015 – 2020)",
        text: "As mobile gaming shifted toward hyper-casual experiences, characterized by instant accessibility and short session lengths, publishers recognized the potential of the wall-navigation loop. Minimalist aesthetics: games stripped away complex background narrative in favor of vibrant vector graphics, clean geometric shapes, and smooth physics. Streamlined control schemes: mechanics were reduced to single-tap side shifts, lane swaps, or continuous drag controls, allowing players to instantly engage with the core loop. Progression systems: developers introduced score multipliers, dynamic obstacle pattern generation, and unlockable cosmetic skins (trails, vehicles, and avatars) to drive long-term engagement.",
        source: "Supplied by the project owner. Independent citation still needed." },
      { title: "Key mechanical sub-genres",
        text: "Today, the Wall Rush framework is implemented across three primary game design patterns. Precision avoidance: navigating narrow gaps in advancing, static, or moving walls, with the appeal of high-intensity reflex testing and timing mastery. Wall-bounce traversal: alternating movement between two parallel vertical surfaces to dodge hazards, with the appeal of flow-state rhythm and rapid spatial awareness. Destructible barrier rush: gathering power-ups or momentum to smash directly through wall segments, with the appeal of high visual satisfaction and power-fantasy feedback.",
        source: "Supplied by the project owner. Independent citation still needed." },
      { title: "Modern UGC and community adaptation (2020s – present)",
        text: "In recent years, user-generated content (UGC) platforms, most notably Roblox, have revitalized the genre. Creators have integrated Wall Rush mechanics into cooperative obstacle courses (\"Obbies\") and survival minigames, where players must coordinate movements or utilize stacked physics to survive endless incoming walls. By combining high-stakes reflex gameplay with accessible mechanics, the Wall Rush genre remains a vital, enduring template in contemporary game design.",
        source: "Supplied by the project owner. Independent citation still needed." }
    ],
    interpretation: [
      { title: 'More than entertainment', text: 'Indigenous games are not merely entertainment. They can carry knowledge, strategy, community values and cultural memory.' },
      { title: 'A reading of the design', text: 'Wall Rush asks players to think in boundaries and pathways: where a barrier closes one route, another must be found or made. This is how the game has been designed to be read, not a documented historical claim.' }
    ],
           system: [
         { title: 'Our aim', text: 'Traditional knowledge, redesigned for a new generation.' }
       ]
  }
};
