/* =====================================================================
   WALL RUSH — ONLINE (transport-agnostic room client)
   A transport only needs send(obj) and to call onmessage(obj).
   Moves are validated by the rules engine on BOTH sides, so any dumb
   relay server is enough for the server transport.
   ===================================================================== */

class TabTransport {           // same device, two browser tabs (real, working)
  static supported() { return typeof BroadcastChannel !== 'undefined'; }
  constructor(room) { this.ch = new BroadcastChannel('wallrush:' + room); this.ch.onmessage = e => this.onmessage && this.onmessage(e.data); }
  open() { return Promise.resolve(); }
  send(o) { this.ch.postMessage(o); }
  close() { this.ch.close(); }
}

class SocketTransport {        // remote relay server (ready; needs a backend)
  constructor(endpoint, room) { this.url = `${endpoint}${endpoint.includes('?') ? '&' : '?'}room=${encodeURIComponent(room)}`; }
  open() {
    return new Promise((res, rej) => {
      try { this.ws = new WebSocket(this.url); } catch (e) { rej(e); return; }
      this.ws.onopen = () => res();
      this.ws.onerror = () => rej(new Error('Could not reach the server.'));
      this.ws.onmessage = e => { try { this.onmessage && this.onmessage(JSON.parse(e.data)); } catch (err) { /* ignore */ } };
      this.ws.onclose = () => this.onclose && this.onclose();
    });
  }
  send(o) { if (this.ws && this.ws.readyState === 1) this.ws.send(JSON.stringify(o)); }
  close() { try { this.ws.close(); } catch (e) { /* ignore */ } }
}

class RoomClient {
  constructor(transport, room, name) {
    this.t = transport; this.room = room; this.name = name;
    this.id = Math.random().toString(36).slice(2, 9);
    this.lastSeen = Date.now(); this.status = 'ok';
    this.onMessage = null; this.onStatus = null; this.onLobby = null;
    transport.onmessage = m => this.receive(m);
    transport.onclose = () => this.setStatus('bad', 'Disconnected');
  }
  send(o) { this.t.send({ ...o, room: this.room, from: this.id }); }
  receive(m) {
    if (!m || m.room !== this.room || m.from === this.id) return;
    this.lastSeen = Date.now();
    if (this.status === 'bad' && this.hb) this.setStatus('ok', 'Connected');
    if (m.t === 'ping') return;
    if (this.onLobby && this.onLobby(m)) return;
    this.onMessage && this.onMessage(m);
  }
  setStatus(state, text) { this.status = state; this.onStatus && this.onStatus({ state, text }); }
  startHeartbeat() {
    this.lastSeen = Date.now();
    this.hb = setInterval(() => {
      this.send({ t: 'ping' });
      if (Date.now() - this.lastSeen > 7000 && this.status === 'ok') this.setStatus('bad', 'Connection lost');
    }, 2000);
  }
  close() {
    clearInterval(this.hb);
    try { this.send({ t: 'leave' }); } catch (e) { /* ignore */ }
    setTimeout(() => this.t.close(), 60);
  }
}

const ROOM_CHARS = 'ABCDEFGHJKMNPQRSTUVWXYZ23456789';
const makeRoomCode = () => Array.from({ length: 5 }, () => ROOM_CHARS[Math.floor(Math.random() * ROOM_CHARS.length)]).join('');
