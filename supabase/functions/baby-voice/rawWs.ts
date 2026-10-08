// Supabase Edge(Deno) 에서는 npm:ws 가 사용자 헤더(Origin·User-Agent)를 보내지 못하고 내장 WebSocket 은 헤더를 못 정해서
// Edge TTS 가 403 으로 거절한다. 그래서 TLS 연결 위에 웹소켓 핸드셰이크·프레임을 직접 처리하는 아주 작은 클라이언트를 쓴다.
// edgeTts.js 의 synthesize() 가 쓰는 만큼만 (onopen/onmessage/onerror/onclose, send(text), close()) 구현한다.
export class RawWebSocket {
  binaryType = 'arraybuffer';
  onopen: (() => void) | null = null;
  onmessage: ((m: { data: string | ArrayBuffer }) => void) | null = null;
  onerror: ((e: { message: string }) => void) | null = null;
  onclose: (() => void) | null = null;
  private conn: Deno.TlsConn | null = null;
  private closed = false;
  private queue: Promise<void> = Promise.resolve();   // 보내기는 한 번에 하나씩 (프레임이 섞이지 않게)

  constructor(url: string, opts: { headers?: Record<string, string> } = {}) {
    this.run(new URL(url), opts.headers || {}).catch((e) => this.fail(e));
  }

  private fail(e: unknown) {
    if (this.closed) return;
    this.onerror?.({ message: (e as Error)?.message || String(e) });
    this.close();
  }

  private async run(u: URL, headers: Record<string, string>) {
    const conn = this.conn = await Deno.connectTls({ hostname: u.hostname, port: Number(u.port) || 443 });
    const key = btoa(String.fromCharCode(...crypto.getRandomValues(new Uint8Array(16))));
    const req = [
      `GET ${u.pathname}${u.search} HTTP/1.1`, `Host: ${u.hostname}`,
      'Upgrade: websocket', 'Connection: Upgrade', `Sec-WebSocket-Key: ${key}`, 'Sec-WebSocket-Version: 13',
      'Pragma: no-cache', 'Cache-Control: no-cache', 'Accept-Language: en-US,en;q=0.9',
      ...Object.entries(headers).map(([k, v]) => `${k}: ${v}`), '', ''
    ].join('\r\n');
    await conn.write(new TextEncoder().encode(req));

    let buf = new Uint8Array(0);
    const chunk = new Uint8Array(64 * 1024);
    const readMore = async () => {
      const n = await conn.read(chunk);
      if (n === null) return false;
      const next = new Uint8Array(buf.length + n);
      next.set(buf); next.set(chunk.subarray(0, n), buf.length);
      buf = next;
      return true;
    };

    // 핸드셰이크 응답
    let headEnd = -1;
    while (headEnd < 0) {
      if (!(await readMore())) throw new Error('closed during handshake');
      headEnd = new TextDecoder().decode(buf).indexOf('\r\n\r\n');
    }
    const head = new TextDecoder().decode(buf);
    const status = head.slice(0, head.indexOf('\r\n'));
    if (!/ 101 /.test(status)) throw new Error('handshake: ' + status);
    buf = buf.slice(new TextEncoder().encode(head.slice(0, headEnd + 4)).length);
    this.onopen?.();

    // 프레임 읽기 (서버 프레임은 마스크 없음, 조각난 메시지는 이어 붙임)
    let parts: Uint8Array[] = [], partOp = 0;
    while (!this.closed) {
      if (buf.length < 2 && !(await readMore())) break;
      if (buf.length < 2) continue;
      const fin = (buf[0] & 0x80) !== 0, op = buf[0] & 0x0f;
      let len = buf[1] & 0x7f, off = 2;
      if (len === 126) { if (buf.length < 4) { if (!(await readMore())) break; continue; } len = (buf[2] << 8) | buf[3]; off = 4; }
      else if (len === 127) { if (buf.length < 10) { if (!(await readMore())) break; continue; } len = Number(new DataView(buf.buffer, buf.byteOffset + 2, 8).getBigUint64(0)); off = 10; }
      if (buf.length < off + len) { if (!(await readMore())) break; continue; }
      const payload = buf.slice(off, off + len);
      buf = buf.slice(off + len);
      if (op === 8) break;                                  // close
      if (op === 9) { await this.sendFrame(10, payload); continue; }   // ping → pong
      if (op === 10) continue;
      if (op !== 0) partOp = op;
      parts.push(payload);
      if (!fin) continue;
      const total = parts.reduce((n, p) => n + p.length, 0);
      const msg = new Uint8Array(total);
      let o = 0; parts.forEach(p => { msg.set(p, o); o += p.length; });
      parts = [];
      this.onmessage?.({ data: partOp === 1 ? new TextDecoder().decode(msg) : msg.buffer });
    }
    this.close();
  }

  private async sendFrame(op: number, data: Uint8Array) {
    if (!this.conn || this.closed) return;
    const len = data.length;
    const head = len < 126 ? 2 : len < 65536 ? 4 : 10;
    const frame = new Uint8Array(head + 4 + len);
    frame[0] = 0x80 | op;
    if (len < 126) frame[1] = 0x80 | len;
    else if (len < 65536) { frame[1] = 0x80 | 126; frame[2] = len >> 8; frame[3] = len & 0xff; }
    else { frame[1] = 0x80 | 127; new DataView(frame.buffer).setBigUint64(2, BigInt(len)); }
    const mask = crypto.getRandomValues(new Uint8Array(4));
    frame.set(mask, head);
    for (let i = 0; i < len; i++) frame[head + 4 + i] = data[i] ^ mask[i & 3];
    await this.conn.write(frame);
  }

  send(text: string) {
    const data = new TextEncoder().encode(text);
    this.queue = this.queue.then(() => this.sendFrame(1, data)).catch((e) => this.fail(e));
  }

  close() {
    if (this.closed) return;
    this.closed = true;
    try { this.conn?.close(); } catch { /* 이미 닫힘 */ }
    this.onclose?.();
  }
}
