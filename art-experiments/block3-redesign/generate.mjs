// Standalone, deterministic pixel-grid authoring + comparison renderer.
// Deliberately outside src/ and public/ so no production asset is replaced or loaded.
import fs from 'node:fs';
import path from 'node:path';
import zlib from 'node:zlib';
import { fileURLToPath } from 'node:url';

const ROOT = path.dirname(fileURLToPath(import.meta.url));
const ASSET_ROOT = path.join(ROOT, 'assets');
const PREVIEW_ROOT = path.join(ROOT, 'previews');
fs.mkdirSync(PREVIEW_ROOT, { recursive: true });

function image(w, h, color = [0, 0, 0, 0]) {
  const data = new Uint8Array(w * h * 4);
  for (let i = 0; i < w * h; i++) data.set(color, i * 4);
  return { w, h, data };
}
function pixel(im, x, y, c) {
  if (x < 0 || y < 0 || x >= im.w || y >= im.h) return;
  im.data.set(c, (y * im.w + x) * 4);
}
function rect(im, x, y, w, h, c) {
  for (let yy = y; yy < y + h; yy++) for (let xx = x; xx < x + w; xx++) pixel(im, xx, yy, c);
}
function line(im, x0, y0, x1, y1, c) {
  let dx = Math.abs(x1 - x0), sx = x0 < x1 ? 1 : -1;
  let dy = -Math.abs(y1 - y0), sy = y0 < y1 ? 1 : -1, err = dx + dy;
  while (true) { pixel(im, x0, y0, c); if (x0 === x1 && y0 === y1) break; const e = err * 2; if (e >= dy) { err += dy; x0 += sx; } if (e <= dx) { err += dx; y0 += sy; } }
}
function hash(x, y, seed) { let n = Math.imul(x + 0x632be5ab, 0x9e3779b1); n = Math.imul(n ^ (y + 0x85157af5), 0x85ebca77); return Math.imul(n ^ seed, 0x27d4eb2d) >>> 0; }
function specks(im, colors, seed, count, inset = 2) {
  for (let i = 0; i < count; i++) { const n = hash(i, seed, seed); const x = inset + n % (im.w - 2 * inset), y = inset + (n >>> 8) % (im.h - 2 * inset); rect(im, x, y, 1 + ((n >>> 16) % 3), 1 + ((n >>> 20) % 2), colors[(n >>> 24) % colors.length]); }
}
function wrapEdges(im) {
  for(let y=0;y<im.h;y++) pixel(im,im.w-1,y,Array.from(im.data.slice((y*im.w)*4,(y*im.w)*4+4)));
  for(let x=0;x<im.w;x++) pixel(im,x,im.h-1,Array.from(im.data.slice(x*4,x*4+4)));
  return im;
}
function png(im) {
  const chunks = [];
  const chunk = (type, data) => { const name = Buffer.from(type); const body = Buffer.concat([name, data]); let crc = 0xffffffff; for (const b of body) { crc ^= b; for (let k = 0; k < 8; k++) crc = (crc >>> 1) ^ ((crc & 1) ? 0xedb88320 : 0); } const out = Buffer.alloc(4); out.writeUInt32BE((crc ^ 0xffffffff) >>> 0); const len = Buffer.alloc(4); len.writeUInt32BE(data.length); chunks.push(len, body, out); };
  const ihdr = Buffer.alloc(13); ihdr.writeUInt32BE(im.w, 0); ihdr.writeUInt32BE(im.h, 4); ihdr[8] = 8; ihdr[9] = 6; chunk('IHDR', ihdr);
  const rows = Buffer.alloc((im.w * 4 + 1) * im.h); for (let y = 0; y < im.h; y++) rows.set(im.data.subarray(y * im.w * 4, (y + 1) * im.w * 4), y * (im.w * 4 + 1) + 1);
  chunk('IDAT', zlib.deflateSync(rows, { level: 9 })); chunk('IEND', Buffer.alloc(0));
  return Buffer.concat([Buffer.from([137, 80, 78, 71, 13, 10, 26, 10]), ...chunks]);
}
function readPng(file) {
  const b = fs.readFileSync(file); let off = 8, w = 0, h = 0, depth, type; const ids = [];
  while (off < b.length) { const n = b.readUInt32BE(off); const tag = b.toString('ascii', off + 4, off + 8); const d = b.subarray(off + 8, off + 8 + n); if (tag === 'IHDR') { w = d.readUInt32BE(); h = d.readUInt32BE(4); depth = d[8]; type = d[9]; } if (tag === 'IDAT') ids.push(d); off += n + 12; if (tag === 'IEND') break; }
  if (depth !== 8 || (type !== 6 && type !== 2)) throw new Error(`Unsupported PNG ${file}: ${depth}/${type}`);
  const bpp = type === 6 ? 4 : 3, stride = w * bpp, raw = zlib.inflateSync(Buffer.concat(ids)), out = Buffer.alloc(stride * h); let ri = 0;
  for (let y = 0; y < h; y++) { const filter = raw[ri++], row = y * stride; for (let x = 0; x < stride; x++) { const v = raw[ri++], a = x >= bpp ? out[row + x - bpp] : 0, up = y ? out[row + x - stride] : 0, ul = y && x >= bpp ? out[row + x - stride - bpp] : 0; let q = v; if (filter === 1) q = (v + a) & 255; else if (filter === 2) q = (v + up) & 255; else if (filter === 3) q = (v + Math.floor((a + up) / 2)) & 255; else if (filter === 4) { const p = a + up - ul, pa = Math.abs(p - a), pb = Math.abs(p - up), pc = Math.abs(p - ul); q = (v + (pa <= pb && pa <= pc ? a : pb <= pc ? up : ul)) & 255; } out[row + x] = q; } }
  const rgba = new Uint8Array(w * h * 4); for (let i = 0; i < w * h; i++) { rgba[i * 4] = out[i * bpp]; rgba[i * 4 + 1] = out[i * bpp + 1]; rgba[i * 4 + 2] = out[i * bpp + 2]; rgba[i * 4 + 3] = type === 6 ? out[i * bpp + 3] : 255; }
  return { w, h, data: rgba };
}
function save(dir, name, im) { fs.mkdirSync(dir, { recursive: true }); fs.writeFileSync(path.join(dir, name), png(im)); }

const PALETTES = {
  industrial_decay: { floor: ['#465057','#4c565d','#414b52','#59636a','#5e5a54','#394249'], wall: ['#303e49','#394853','#46545e','#25333c','#6a5748','#86705a'], rust:'#8b5b45', trim:'#5f6870', yellow:'#a38d56', grime:'#30383f', detail:'#6e8490', prop:'#4d5860' },
  abandoned_residential: { floor: ['#625d50','#6a6456','#575548','#746d5e','#817866','#514f45'], wall: ['#625f53','#6e6a5c','#777163','#4b5148','#898170','#55594d'], rust:'#79614c', trim:'#57574c', yellow:'#95835c', grime:'#494b43', detail:'#8b8069', prop:'#5e5849' },
  refined_candidate: { floor: ['#50565a','#595b58','#464e53','#66625a','#715e51','#3b4247'], wall: ['#37434b','#424e55','#515b60','#2b373d','#77604d','#767466'], rust:'#8a614d', trim:'#60686b', yellow:'#98875b', grime:'#383d40', detail:'#7b8990', prop:'#554e47' },
};
const FONT = { A:'010101101111101101',B:'110101110101110',C:'011100100100011',D:'110101101101110',E:'111100110100111',F:'111100110100100',G:'011100101101011',H:'101101111101101',I:'111010010010111',J:'001001001101010',K:'101101110101101',L:'100100100100111',M:'101111111101101',N:'101111111111101',O:'010101101101010',P:'110101110100100',Q:'010101101111011',R:'110101110101101',S:'011100010001110',T:'111010010010010',U:'101101101101111',V:'101101101101010',W:'101101111111101',X:'101101010101101',Y:'101101010010010',Z:'111001010100111','0':'111101101101111','1':'010110010010111','2':'110001010100111','3':'110001010001110','4':'101101111001001','5':'111100110001110','6':'011100110101010','7':'111001010010010','8':'010101010101010','9':'010101011001110','-':'000000111000000','/':'001001010100100',' ':'000000000000000'};
function drawText(im, value, x, y, color=[211,214,213,255], scale=1) {
  for(const ch of value) { const bits=FONT[ch]||FONT[' ']; for(let i=0;i<bits.length;i++) if(bits[i]==='1') rect(im,x+(i%3)*scale,y+Math.floor(i/3)*scale,scale,scale,color); x+=4*scale; }
}
const HEX = h => [parseInt(h.slice(1,3),16), parseInt(h.slice(3,5),16), parseInt(h.slice(5,7),16), 255];
function opaqueFloor(p, variant = 0, seed = 9) {
  const im = image(32,32,HEX(p.floor[variant % p.floor.length]));
  // Quiet 32px floor slabs: one shared left/top hairline makes adjacent edges continuous.
  rect(im,0,0,32,1,HEX('#32383b')); rect(im,0,0,1,32,HEX('#32383b'));
  rect(im,2,2,28,1,HEX(p.floor[(variant+1)%p.floor.length]));
  if (variant === 1) { rect(im,5,7,9,4,HEX(p.floor[3])); rect(im,20,18,8,3,HEX(p.floor[2])); }
  if (variant === 2) { rect(im,4,19,10,2,HEX(p.floor[4])); rect(im,21,5,5,6,HEX(p.floor[2])); }
  specks(im, [HEX(p.floor[1]), HEX(p.floor[3]), HEX(p.grime)], seed, 10, 3);
  return wrapEdges(im);
}
function damagedFloor(p, seed = 19) {
  const im = opaqueFloor(p, 2, seed); const dark = HEX(p.grime), rust = HEX(p.rust);
  rect(im,5,5,1,1,dark); line(im,7,7,12,12,dark); line(im,12,12,10,18,dark); line(im,12,12,18,15,dark); line(im,18,15,22,13,dark);
  rect(im,7,8,1,1,rust); rect(im,13,14,1,1,rust); rect(im,18,15,2,1,HEX(p.floor[0]));
  rect(im,23,22,4,2,HEX(p.floor[4])); return im;
}
function wall(p, variant = 0, seed = 31) {
  const im = image(32,32,HEX(p.wall[variant % p.wall.length]));
  rect(im,0,0,32,2,HEX('#1d252a')); rect(im,0,2,32,1,HEX(p.trim));
  // panel divisions align to the tile boundary; secondary tile changes panel face only.
  rect(im,0,30,32,2,HEX('#20282d')); rect(im,0,27,32,1,HEX(p.trim));
  rect(im,0,0,1,32,HEX('#20282d')); rect(im,31,0,1,32,HEX('#20282d'));
  rect(im,4,6,24,1,HEX(p.wall[(variant+1)%p.wall.length]));
  if (variant === 1) { rect(im,7,9,18,13,HEX(p.wall[2])); rect(im,8,10,16,1,HEX(p.trim)); rect(im,8,20,16,1,HEX('#283239')); }
  specks(im, [HEX(p.wall[2]), HEX(p.wall[3]), HEX(p.grime)], seed, 8, 4); return wrapEdges(im);
}
function damagedWall(p) {
  const im = wall(p,1,41), plaster = HEX(p.wall[4]), dark = HEX(p.grime), rust = HEX(p.rust);
  rect(im,5,8,9,1,plaster); rect(im,5,9,7,1,plaster); rect(im,5,10,6,4,plaster); rect(im,6,14,4,2,plaster); rect(im,10,15,3,1,plaster);
  rect(im,6,9,1,1,rust); rect(im,11,14,1,1,rust); rect(im,5,16,5,1,dark); rect(im,5,17,3,1,dark);
  rect(im,21,7,5,3,HEX(p.wall[0])); rect(im,22,10,2,2,HEX(p.trim)); return im;
}
function transition(p) {
  const im=image(32,32,HEX(p.floor[0])); rect(im,0,0,32,1,HEX('#30363a')); rect(im,0,0,1,32,HEX('#30363a'));
  rect(im,0,0,32,7,HEX(p.wall[0])); rect(im,0,7,32,2,HEX(p.trim)); rect(im,0,9,32,1,HEX('#252d32'));
  rect(im,2,11,28,1,HEX(p.floor[1])); rect(im,2,11,1,17,HEX(p.floor[1])); return im;
}
function threshold(p) {
  const im=image(32,32); rect(im,0,4,32,24,[30,35,38,0]);
  rect(im,0,5,32,1,HEX(p.grime)); rect(im,0,7,32,2,HEX(p.trim)); rect(im,1,9,30,1,HEX(p.rust)); rect(im,0,23,32,2,HEX(p.trim)); rect(im,0,26,32,1,HEX(p.grime));
  if (p === PALETTES.industrial_decay) { for (let x=3;x<30;x+=7) rect(im,x,9,3,2,HEX(p.yellow)); }
  if (p === PALETTES.abandoned_residential) { rect(im,3,12,26,1,HEX(p.floor[2])); rect(im,4,21,24,1,HEX(p.floor[2])); }
  if (p === PALETTES.refined_candidate) { rect(im,2,9,7,1,HEX(p.yellow)); rect(im,23,23,7,1,HEX(p.rust)); }
  return im;
}
function detail(p, kind) {
  const im=image(32,32); const dark=HEX(p.grime), trim=HEX(p.trim), bright=HEX(p.detail);
  if (kind===1) { rect(im,6,6,20,20,dark); rect(im,7,7,18,18,trim); rect(im,9,9,14,12,HEX(p.wall[0])); rect(im,9,22,14,2,dark); rect(im,12,13,8,1,bright); rect(im,12,16,8,1,HEX(p.wall[2])); pixel(im,23,8,HEX(p.rust)); }
  else { rect(im,5,7,22,17,dark); rect(im,6,8,20,13,trim); rect(im,8,10,16,8,HEX(p.wall[0])); for(let x=9;x<23;x+=3) rect(im,x,11,1,6,bright); rect(im,6,22,20,2,dark); }
  return im;
}
function prop(p, style) {
  const im=image(32,48); const dark=HEX('#20262a'), base=HEX(p.prop), light=HEX(p.detail), rust=HEX(p.rust);
  rect(im,5,7,22,37,dark); rect(im,6,6,20,36,base); rect(im,7,8,18,1,light); rect(im,8,10,16,10,HEX(p.wall[1])); rect(im,8,22,16,18,HEX(p.wall[0]));
  rect(im,9,21,14,1,dark); rect(im,9,29,14,1,dark); rect(im,15,23,2,4,light); rect(im,10,42,4,3,dark); rect(im,19,42,4,3,dark);
  if (style==='industrial_decay') { rect(im,7,6,2,2,rust); rect(im,23,6,2,2,rust); rect(im,11,12,10,2,HEX(p.yellow)); rect(im,9,32,2,5,rust); }
  if (style==='abandoned_residential') { rect(im,11,12,10,4,HEX(p.floor[3])); rect(im,12,13,8,1,light); rect(im,9,32,14,2,HEX(p.floor[3])); }
  if (style==='refined_candidate') { rect(im,7,6,2,2,rust); rect(im,23,6,2,2,rust); rect(im,11,12,10,2,HEX(p.floor[3])); rect(im,9,32,3,4,rust); }
  return im;
}
function authorSet(name, p) {
  const dir=path.join(ASSET_ROOT,name); const entries=[['floor_primary.png',opaqueFloor(p,0,0x23)],['floor_secondary.png',opaqueFloor(p,1,0x42)],['floor_damaged.png',damagedFloor(p)],['wall_primary.png',wall(p,0,0x31)],['wall_damaged.png',damagedWall(p)],['wall_floor_transition.png',transition(p)],['door_threshold.png',threshold(p)],['environmental_detail_01.png',detail(p,1)],['environmental_detail_02.png',detail(p,2)],['decorative_prop.png',prop(p,name)]];
  for(const [file,im] of entries.slice(0,5)) for(let n=0;n<32;n++) { const l=(n*im.w)*4,r=(n*im.w+im.w-1)*4,t=n*4,b=((im.h-1)*im.w+n)*4; for(let c=0;c<4;c++) if(im.data[l+c]!==im.data[r+c]||im.data[t+c]!==im.data[b+c]) throw new Error(`Non-wrapping edge: ${name}/${file}`); }
  for (const [n,im] of entries) save(dir,n,im);
}
const refinedOnly = process.argv.includes('--refined-only');
if (!refinedOnly) {
  authorSet('industrial_decay', PALETTES.industrial_decay);
  authorSet('abandoned_residential', PALETTES.abandoned_residential);
  authorSet('refined_candidate', PALETTES.refined_candidate);
}

// A second, hand-clustered Block 3 pass. Run with --refined-only to preserve
// the earlier design variants and comparison-history images.
function refineCandidate() {
  const dir = path.join(ASSET_ROOT, 'refined_candidate');
  const stone = [74, 72, 70, 255], paleStone = [82, 79, 76, 255];
  const worn = [102, 93, 83, 255], deepWear = [57, 57, 57, 255];
  const plaster = [85, 79, 73, 255], underpaint = [105, 91, 77, 255];
  const damp = [63, 67, 68, 255], trim = [55, 59, 60, 255];
  const edge = [41, 46, 48, 255], patch = [93, 88, 79, 255];
  const makeFloor = variant => {
    const im = image(32, 32, stone);
    // Tile edges meet at the base value so the walk surface does not become a checker grid.
    rect(im, 0, 0, 32, 1, stone); rect(im, 0, 0, 1, 32, stone);
    // No inset rectangle: the common slab face remains seamless at map scale.
    // Large, low-contrast wear follows the slab perimeter; no peppered noise.
    if (variant >= 1) {
      rect(im, 3, 26, 5, 2, worn); rect(im, 5, 25, 4, 1, worn);
      rect(im, 24, 5, 3, 1, [79, 75, 70, 255]); rect(im, 26, 6, 2, 4, [79, 75, 70, 255]);
      rect(im, 10, 18, 4, 1, [77, 73, 70, 255]);
    }
    if (variant >= 2) {
      rect(im, 2, 22, 5, 1, deepWear); rect(im, 3, 23, 2, 1, deepWear);
      rect(im, 4, 20, 1, 2, underpaint); rect(im, 7, 24, 2, 1, underpaint);
      line(im, 6, 20, 9, 17, deepWear); line(im, 9, 17, 11, 18, deepWear);
      pixel(im, 12, 19, [95, 77, 67, 255]);
    }
    if (variant === 3) {
      // Rare edge chip and short branching fracture, kept against the slab boundary.
      rect(im, 1, 17, 2, 3, deepWear); rect(im, 2, 18, 2, 2, underpaint);
      line(im, 3, 18, 7, 21, deepWear); line(im, 7, 21, 9, 24, deepWear);
      line(im, 7, 21, 11, 20, deepWear); rect(im, 2, 22, 2, 2, worn);
    }
    return wrapEdges(im);
  };
  const makeWall = variant => {
    const im = image(32, 32, plaster);
    // Match adjacent edges in value; transition overlays define the actual wall/floor boundary.
    rect(im, 0, 0, 32, 1, plaster); rect(im, 0, 0, 1, 32, plaster);
    rect(im, 4, 4, 12, 1, [88, 82, 76, 255]); rect(im, 4, 5, 1, 5, [82, 77, 72, 255]);
    rect(im, 23, 21, 5, 1, [80, 76, 71, 255]);
    if (variant >= 1) {
      rect(im, 2, 5, 1, 5, damp); rect(im, 3, 6, 2, 4, damp); rect(im, 5, 8, 2, 3, damp);
      rect(im, 2, 10, 2, 2, [70, 71, 69, 255]); rect(im, 5, 11, 2, 2, [71, 70, 67, 255]);
      rect(im, 6, 13, 2, 1, [76, 73, 70, 255]);
    }
    if (variant === 2) {
      // Old repair paint, irregularly feathered into the wall.
      rect(im, 20, 8, 7, 1, [75, 72, 68, 255]); rect(im, 19, 9, 9, 9, patch);
      rect(im, 21, 7, 5, 1, [75, 72, 68, 255]); rect(im, 20, 18, 6, 1, [74, 71, 68, 255]);
      rect(im, 21, 10, 1, 5, [98, 92, 82, 255]); rect(im, 26, 11, 1, 4, [83, 80, 74, 255]);
      pixel(im, 27, 17, underpaint);
    }
    if (variant === 3) {
      // A rare plaster spall starts at the top joint and exposes old paint, not bright rubble.
      rect(im, 22, 2, 3, 2, deepWear); rect(im, 21, 4, 4, 3, underpaint);
      rect(im, 22, 7, 2, 2, [96, 83, 72, 255]); line(im, 22, 8, 19, 12, deepWear);
      line(im, 19, 12, 21, 15, deepWear); pixel(im, 18, 13, underpaint);
      rect(im, 24, 3, 1, 2, [66, 65, 62, 255]);
    }
    return wrapEdges(im);
  };
  const makeNotice = () => {
    const im = image(32, 32);
    const ink = [119, 108, 91, 160], paper = [119, 112, 97, 82], border = [145, 131, 107, 125];
    rect(im, 6, 8, 20, 16, paper); rect(im, 7, 8, 18, 1, border); rect(im, 7, 23, 18, 1, border);
    rect(im, 6, 9, 1, 14, border); rect(im, 25, 9, 1, 14, border);
    // Faded block number and two broken lines, deliberately illegible at a glance.
    rect(im, 10, 12, 1, 4, ink); rect(im, 11, 12, 3, 1, ink); rect(im, 11, 14, 2, 1, ink); rect(im, 11, 15, 3, 1, ink);
    rect(im, 16, 12, 7, 1, [116, 106, 92, 120]); rect(im, 16, 15, 5, 1, [116, 106, 92, 95]);
    rect(im, 10, 19, 12, 1, [116, 106, 92, 100]);
    pixel(im, 8, 10, [60, 61, 60, 150]); pixel(im, 23, 21, [71, 67, 60, 120]);
    return im;
  };
  const makeTransition = () => {
    const im = image(32, 32, stone);
    rect(im, 0, 0, 32, 7, plaster); rect(im, 0, 7, 32, 1, [68, 68, 66, 255]);
    rect(im, 0, 8, 32, 2, trim); rect(im, 0, 10, 32, 1, [65, 64, 61, 255]);
    rect(im, 1, 12, 30, 1, [79, 75, 71, 255]); rect(im, 0, 0, 1, 32, edge);
    // Small broken paint edge at one end; the long boundary remains readable and quiet.
    rect(im, 24, 7, 3, 1, underpaint); rect(im, 27, 8, 2, 1, plaster);
    rect(im, 23, 9, 2, 1, [82, 71, 61, 255]);
    return im;
  };
  const makeThreshold = () => {
    const im = image(32, 32);
    rect(im, 0, 5, 32, 1, [51, 54, 53, 180]); rect(im, 0, 7, 32, 2, [73, 72, 68, 205]);
    rect(im, 2, 9, 28, 1, [100, 84, 69, 135]); rect(im, 0, 23, 32, 2, [64, 64, 61, 190]);
    rect(im, 1, 26, 30, 1, [47, 51, 51, 175]);
    rect(im, 4, 8, 3, 1, [86, 78, 67, 165]); rect(im, 23, 23, 4, 1, [83, 72, 62, 145]);
    return im;
  };
  save(dir, 'floor_primary.png', makeFloor(0));
  save(dir, 'floor_light_wear.png', makeFloor(1));
  save(dir, 'floor_moderate_wear.png', makeFloor(2));
  save(dir, 'floor_damaged.png', makeFloor(3));
  save(dir, 'wall_primary.png', makeWall(0));
  save(dir, 'wall_stained.png', makeWall(1));
  save(dir, 'wall_patch.png', makeWall(2));
  save(dir, 'wall_damaged.png', makeWall(3));
  save(dir, 'room_notice.png', makeNotice());
  save(dir, 'wall_floor_transition.png', makeTransition());
  save(dir, 'door_threshold.png', makeThreshold());
}
if (refinedOnly) refineCandidate();

function blend(dst, src, dx, dy, dw=src.w, dh=src.h, opacity=1) {
  for(let y=0;y<dh;y++) for(let x=0;x<dw;x++) { const sx=Math.floor(x*src.w/dw), sy=Math.floor(y*src.h/dh), si=(sy*src.w+sx)*4, di=((dy+y)*dst.w+dx+x)*4, a=src.data[si+3]/255*opacity; if (di<0 || di+3>=dst.data.length) continue; for(let k=0;k<3;k++) dst.data[di+k]=Math.round(src.data[si+k]*a+dst.data[di+k]*(1-a)); dst.data[di+3]=255; }
}
function shade(im, cx, cy, isOn, map) {
  const source={x:3,y:5};
  const lineClear=(tx,ty)=>{ let x0=source.x,y0=source.y,x1=tx,y1=ty,dx=Math.abs(x1-x0),sx=x0<x1?1:-1,dy=-Math.abs(y1-y0),sy=y0<y1?1:-1,err=dx+dy; while(x0!==x1||y0!==y1){ const e=err*2;if(e>=dy){err+=dy;x0+=sx;}if(e<=dx){err+=dx;y0+=sy;}if(x0===x1&&y0===y1)break;if(!map[y0]?.[x0])return false;}return true;};
  const visible=new Map();
  for(let y=0;y<im.h;y++) for(let x=0;x<im.w;x++) {
    const dx=x-cx,dy=y-cy,dist=Math.hypot(dx,dy),tx=Math.floor((x-15)/45),ty=Math.floor((y-17)/45),key=`${tx},${ty}`;
    let clear=visible.get(key); if(clear===undefined){clear=tx>=0&&ty>=0&&tx<10&&ty<10&&lineClear(tx,ty);visible.set(key,clear);}
    let darkness=.86;
    if(clear&&dist<104) darkness-=.38*(1-dist/104);
    if(isOn&&clear&&dx>0&&dx<315) { const halfWidth=20+dx*.50,edge=Math.abs(dy)/halfWidth; if(edge<1) { const forward=1-dx/315; darkness-=.57*Math.min(1,(1-edge)*1.35)*(.68+.32*forward); } }
    darkness=Math.max(.045,Math.min(.9,darkness)); const i=(y*im.w+x)*4; for(let c=0;c<3;c++) im.data[i+c]=Math.round(im.data[i+c]*(1-darkness));
  }
}
const REPO=path.resolve(ROOT,'..','..');
const SRC=path.join(REPO,'public/assets/sprites/environment/shared');
const baseline={floor:readPng(path.join(SRC,'floor_base.png')),floor1:readPng(path.join(SRC,'floor_variant_01.png')),floor2:readPng(path.join(SRC,'floor_variant_02.png')),floor3:readPng(path.join(SRC,'floor_variant_03.png')),wall:readPng(path.join(SRC,'wall_base.png')),wall1:readPng(path.join(SRC,'wall_variant_01.png')),wall2:readPng(path.join(SRC,'wall_variant_02.png')),edge:readPng(path.join(SRC,'wall_edge.png')),threshold:readPng(path.join(SRC,'threshold.png')),box:readPng(path.join(SRC,'container_box.png')),prop:readPng(path.join(REPO,'public/assets/sprites/environment/shared/props/wall_vent_01.png')),detail1:readPng(path.join(REPO,'public/assets/sprites/environment/shared/props/wall_lamp_01.png')),detail2:readPng(path.join(REPO,'public/assets/sprites/environment/shared/props/wall_vent_01.png')),player:readPng(path.join(REPO,'public/assets/sprites/characters/player/player_idle_right.png'))};
function custom(name) { const d=path.join(ASSET_ROOT,name); return { floor:readPng(path.join(d,'floor_primary.png')),floor1:readPng(path.join(d,'floor_secondary.png')),floor2:readPng(path.join(d,'floor_damaged.png')),floor3:readPng(path.join(d,'floor_secondary.png')),wall:readPng(path.join(d,'wall_primary.png')),wall1:readPng(path.join(d,'wall_damaged.png')),wall2:readPng(path.join(d,'wall_primary.png')),edge:readPng(path.join(d,'wall_floor_transition.png')),threshold:readPng(path.join(d,'door_threshold.png')),box:baseline.box,prop:readPng(path.join(d,'decorative_prop.png')),detail1:readPng(path.join(d,'environmental_detail_01.png')),detail2:readPng(path.join(d,'environmental_detail_02.png')),player:baseline.player}; }
function frame(assets, title, lightOn) {
  const im=image(960,540,[10,12,15,255]); rect(im,0,0,960,30,[20,24,28,255]);
  const head=title==='current_block3'?'CURRENT BLOCK 3':title==='industrial_decay'?'INDUSTRIAL DECAY':title==='abandoned_residential'?'ABANDONED RESIDENTIAL':'REFINED CANDIDATE';
  drawText(im,head,12,10,[196,205,205,255],2);
  // Identical fixed seed/map arrangement for every treatment; 32px native tiles displayed at the current 1.4x zoom.
  const map=Array.from({length:10},()=>Array(10).fill(false));
  for(let y=1;y<=4;y++) for(let x=2;x<=7;x++) map[y][x]=true;
  for(let x=0;x<10;x++) map[5][x]=true;
  for(let y=6;y<=8;y++) for(let x=6;x<=9;x++) map[y][x]=true;
  const doors=new Set(['4,5','7,5']); const headers=['FLASHLIGHT OFF','FLASHLIGHT ON'];
  for(let panel=0;panel<2;panel++) {
    const ox=panel*480; rect(im,ox,30,480,510,[14,17,20,255]);
    drawText(im,panel===0?'LIGHT OFF':'FLASHLIGHT ON',ox+15,34,[176,190,193,255],1);
    // Scene view is fixed and centered; unobtrusive top strip is reserved for later labeling in design notes.
    for(let y=0;y<10;y++) for(let x=0;x<10;x++) {
      const sx=ox+15+x*45, sy=47+y*45; let src;
      if(map[y][x]) { const n=hash(x,y,3)%100; src=n<9?assets.floor1:n<14?assets.floor2:n<22?assets.floor3:assets.floor; }
      else { const n=hash(x,y,31)%100; src=n<13?assets.wall1:n<20?assets.wall2:assets.wall; }
      blend(im,src,sx,sy,45,45);
      if (!map[y][x] && ((x===1&&y===3)||(x===8&&y===2))) blend(im,assets.edge,sx,sy,45,45);
      if (doors.has(`${x},${y}`)) blend(im,assets.threshold,sx,sy,45,45);
    }
    // Wall fixtures, one decorative prop, and the same production searchable container in all views.
    blend(im,assets.detail1,ox+15+1*45+8,47+3*45+8,28,28);
    blend(im,assets.detail2,ox+15+8*45+8,47+4*45+8,28,28);
    blend(im,assets.prop,ox+15+2*45+3,47+1*45-3,39,58);
    blend(im,assets.box,ox+15+8*45+9,47+7*45+5,27,27);
    blend(im,assets.player,ox+15+3*45+11,47+5*45+12,28,39);
    // Shade only this panel, preserving the fixed map and object alignment.
    const panelImage=image(480,510); for(let y=0;y<510;y++) panelImage.data.set(im.data.subarray(((30+y)*960+ox)*4,((30+y)*960+ox+480)*4),y*480*4);
    shade(panelImage,15+3*45+25,47-30+5*45+30,panel===1,map);
    // The player remains legible under the lightmap, like the runtime character layer.
    blend(panelImage,assets.player,15+3*45+11,17+5*45+12,28,39);
    for(let y=0;y<510;y++) im.data.set(panelImage.data.subarray(y*480*4,(y+1)*480*4),((30+y)*960+ox)*4);
    // Panel dividers and captions use tiny hand-built glyphs only; headers keep the PNG self-explanatory.
    rect(im,ox,30,480,1,[76,82,85,255]);
    rect(im,ox,30,480,1,[76,82,85,255]);
    // Embed an understated footer bar to distinguish the two matched light conditions.
    rect(im,ox+14,522,452,1,[86,91,94,255]); drawText(im,'BLOCK 3 / CAMERA 1.4X / 32PX GRID',ox+15,526,[139,150,151,255],1);
  }
  rect(im,479,30,2,510,[34,40,44,255]);
  return im;
}
if (!refinedOnly) {
  for(const [name,assets] of [['current_block3',baseline],['industrial_decay',custom('industrial_decay')],['abandoned_residential',custom('abandoned_residential')],['refined_candidate',custom('refined_candidate')]]) save(PREVIEW_ROOT,`${name}_comparison_960x540.png`,frame(assets,name,true));
  console.log('Wrote 30 native pixel-art PNGs and four fixed-map 960x540 comparisons.');
} else {
  console.log('Revised only refined-candidate native pixel-art textures; other design variants and preview history were preserved.');
}
