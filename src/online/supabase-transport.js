/* =====================================================================
   WALL RUSH — SUPABASE TRANSPORT (optional internet play)
   Uses Supabase Realtime "Broadcast" as the relay. Each room is one
   channel named wallrush:CODE. Nothing is stored in a database.

   Inactive until src/config.js has online.supabase.url and anonKey.
   The Supabase library is only downloaded when internet play is used.
   ===================================================================== */

class SupabaseTransport {
  static available() {
    const c = WR_CONFIG.online && WR_CONFIG.online.supabase;
    return !!(c && c.url && c.anonKey);
  }

  static loadLib() {
    if (window.supabase && window.supabase.createClient) return Promise.resolve();
    return new Promise((resolve, reject) => {
      const s = document.createElement('script');
      s.src = 'https://cdn.jsdelivr.net/npm/@supabase/supabase-js@2';
      s.onload = () => (window.supabase && window.supabase.createClient ? resolve() : reject(new Error('The Supabase library loaded but is not usable.')));
      s.onerror = () => reject(new Error('Could not load the Supabase library.'));
      document.head.appendChild(s);
    });
  }

  constructor(cfg, room) { this.cfg = cfg; this.room = room; this.closed = false; }

  async open() {
    await SupabaseTransport.loadLib();
    return new Promise((resolve, reject) => {
      let settled = false;
      const fail = msg => { if (!settled) { settled = true; clearTimeout(timer); this.close(); reject(new Error(msg)); } };
      const timer = setTimeout(() => fail('The room service did not answer in time.'), 8000);
      try {
        this.client = window.supabase.createClient(this.cfg.url, this.cfg.anonKey);
        this.channel = this.client.channel('wallrush:' + this.room, { config: { broadcast: { self: false } } });
        this.channel.on('broadcast', { event: 'wr' }, msg => { if (this.onmessage) this.onmessage(msg.payload); });
        this.channel.subscribe(status => {
          if (status === 'SUBSCRIBED') {
            if (!settled) { settled = true; clearTimeout(timer); resolve(); }
          } else if (status === 'CHANNEL_ERROR' || status === 'TIMED_OUT' || status === 'CLOSED') {
            if (!settled) fail('Could not join the room service. Check the project URL and key, and that Realtime public access is enabled.');
            else if (!this.closed && this.onclose) this.onclose();
          }
        });
      } catch (e) { fail(e.message || 'Could not start the room service.'); }
    });
  }

  send(o) {
    if (this.channel && !this.closed) this.channel.send({ type: 'broadcast', event: 'wr', payload: o });
  }

  close() {
    this.closed = true;
    try { if (this.client && this.channel) this.client.removeChannel(this.channel); } catch (e) { /* ignore */ }
  }
}
