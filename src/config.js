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

  /* HERITAGE CONTENT
     Only material supplied by the project may appear under "documented".
     Nothing has been supplied yet, so that list is intentionally empty.
     Entry shape: { title, text, source } */
  heritage: {
    documented: [],
    interpretation: [
      { title: 'More than entertainment', text: 'Indigenous games are not merely entertainment. They can carry knowledge, strategy, community values and cultural memory.' },
      { title: 'A reading of the design', text: 'Wall Rush asks players to think in boundaries and pathways: where a barrier closes one route, another must be found or made. This is how the game has been designed to be read, not a documented historical claim.' }
    ],
    system: [
      { title: 'Part of the Indigenous Games System', text: 'Wall Rush sits alongside Mlabalaba in the Indigenous Games System, sharing its design philosophy while carrying its own visual identity.' },
      { title: 'Created by Zondi', text: 'Wall Rush and the Indigenous Games System are created by Zondi.' },
      { title: 'Our aim', text: 'Traditional knowledge, redesigned for a new generation.' }
    ]
  }
};
