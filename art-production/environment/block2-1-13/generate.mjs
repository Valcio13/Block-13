// Hand-authored 32px pixel clusters for production environmental tiles.
// Deterministic source for the original PNG assets in public/assets.
import fs from 'node:fs';
import path from 'node:path';
import zlib from 'node:zlib';
import { fileURLToPath } from 'node:url';

const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '../../../public/assets/sprites/environment/blocks');
const rgba = hex => [parseInt(hex.slice(1, 3), 16), parseInt(hex.slice(3, 5), 16), parseInt(hex.slice(5, 7), 16), hex.length > 7 ? parseInt(hex.slice(7, 9), 16) : 255];
function image(w = 32, h = 32) { return { w, h, data: new Uint8Array(w * h * 4).fill(0), put(x, y, c) { if (x < 0 || y < 0 || x >= w || y >= h) return; this.data.set(rgba(c), (y * w + x) * 4); } }; }
function rect(im, x, y, w, h, c) { for (let yy = y; yy < y + h; yy++) for (let xx = x; xx < x + w; xx++) im.put(xx, yy, c); }
function line(im, x0, y0, x1, y1, c) { let dx = Math.abs(x1-x0), sx = x0 < x1 ? 1 : -1, dy = -Math.abs(y1-y0), sy = y0 < y1 ? 1 : -1, err = dx + dy; while (true) { im.put(x0,y0,c); if (x0 === x1 && y0 === y1) break; const e = err * 2; if (e >= dy) { err += dy; x0 += sx; } if (e <= dx) { err += dx; y0 += sy; } } }
function fill(im, c) { rect(im, 0, 0, 32, 32, c); }
function png(im) {
  const chunks = [];
  const chunk = (type, data) => { const body = Buffer.concat([Buffer.from(type), data]); let crc = 0xffffffff; for (const b of body) { crc ^= b; for (let i=0;i<8;i++) crc = (crc >>> 1) ^ ((crc & 1) ? 0xedb88320 : 0); } const len = Buffer.alloc(4); len.writeUInt32BE(data.length); const sum = Buffer.alloc(4); sum.writeUInt32BE((crc ^ 0xffffffff) >>> 0); chunks.push(len, body, sum); };
  const ihdr = Buffer.alloc(13); ihdr.writeUInt32BE(im.w,0); ihdr.writeUInt32BE(im.h,4); ihdr[8] = 8; ihdr[9] = 6; chunk('IHDR', ihdr);
  const stride = im.w * 4; const rows = Buffer.alloc((stride + 1) * im.h); for (let y=0;y<im.h;y++) rows.set(im.data.subarray(y*stride,(y+1)*stride),y*(stride+1)+1);
  chunk('IDAT', zlib.deflateSync(rows,{level:9})); chunk('IEND',Buffer.alloc(0)); return Buffer.concat([Buffer.from([137,80,78,71,13,10,26,10]),...chunks]);
}
function save(block, name, draw, width = 32, height = 32) { const im = image(width,height); draw(im); const dir = path.join(root, `block_${block}`); fs.mkdirSync(dir,{recursive:true}); fs.writeFileSync(path.join(dir,name),png(im)); }

// Block 2: service-floor graphite and oxidized steel; the inset grate is readable
// as floor texture while preserving a quiet base-color border for seamless tiling.
save(2,'floor_service_grate.png',im=>{
  fill(im,'#41494c'); rect(im,1,1,30,30,'#454c4e'); rect(im,4,5,24,22,'#30393d'); rect(im,5,6,22,20,'#596064');
  rect(im,6,7,20,18,'#252f34'); rect(im,7,8,18,16,'#354146');
  for(let y=10;y<24;y+=3){ rect(im,8,y,16,1,'#151e23'); rect(im,8,y+1,16,1,'#5b6568'); }
  rect(im,5,6,1,20,'#788084'); rect(im,26,6,1,20,'#20292d'); rect(im,8,7,16,1,'#7b8382');
  for(const [x,y] of [[5,7],[26,7],[5,24],[26,24]]){ im.put(x,y,'#b18751'); im.put(x+1,y,'#222b30'); }
  rect(im,2,3,3,1,'#566064'); rect(im,24,28,5,1,'#373f42'); im.put(4,28,'#705b43');
});
// Wall-mounted service manifold, painted metal with paired valve lights and a
// short readable conduit; no part extends beyond this wall cell.
save(2,'wall_service_manifold.png',im=>{
  fill(im,'#354148'); rect(im,2,2,28,28,'#39464d'); rect(im,4,5,24,23,'#29363d');
  rect(im,6,6,20,19,'#657176'); rect(im,7,7,18,17,'#39474e'); rect(im,8,8,16,15,'#46555b');
  rect(im,9,9,14,2,'#718084'); rect(im,9,22,14,1,'#273238');
  rect(im,11,13,4,6,'#202d33'); rect(im,12,14,2,4,'#9b7850'); rect(im,18,13,4,6,'#1d292f');
  im.put(19,14,'#b5a06b'); im.put(20,15,'#8b5944'); im.put(19,17,'#718b83');
  for(const [x,y] of [[7,8],[24,8],[7,23],[24,23]]){ im.put(x,y,'#a57b4d'); im.put(x+1,y,'#28343a'); }
  line(im,14,25,14,29,'#202b31'); line(im,15,25,15,29,'#6a7476'); line(im,16,25,16,29,'#28353b');
});
// Transparent wall overlay: isolated leaking pipe joint with restrained water
// staining. The alpha silhouette leaves the underlying concrete visible.
save(2,'wall_pipe_leak.png',im=>{
  rect(im,6,0,5,10,'#263239'); rect(im,7,0,2,10,'#788184'); rect(im,11,3,9,4,'#27343a'); rect(im,11,4,9,2,'#7a8180');
  rect(im,17,4,4,5,'#27343a'); rect(im,18,5,2,4,'#9a7750'); rect(im,19,8,5,2,'#28363c');
  rect(im,21,9,4,1,'#607579'); rect(im,23,10,3,2,'#52656a'); rect(im,24,12,2,3,'#46585d');
  im.put(24,16,'#68777a'); im.put(25,19,'#66777a'); rect(im,4,24,3,1,'#465258'); rect(im,7,25,2,1,'#49565a');
  rect(im,9,28,2,1,'#39474b');
});
save(2,'wall_vent_cage.png',im=>{
  rect(im,3,5,26,22,'#212c32'); rect(im,4,6,24,20,'#758084'); rect(im,5,7,22,18,'#303c42');
  rect(im,7,9,18,14,'#1d292f'); rect(im,8,10,16,1,'#647176'); rect(im,8,12,16,1,'#59676c');
  rect(im,8,14,16,1,'#718084'); rect(im,8,16,16,1,'#56646a'); rect(im,8,18,16,1,'#667276');
  rect(im,8,20,16,1,'#38454b'); rect(im,4,7,1,18,'#9a7650'); rect(im,27,7,1,18,'#282f32');
  for(const y of [7,24]){ im.put(5,y,'#b2905c'); im.put(26,y,'#b2905c'); }
});
// Transparent 24×32 faulty panel prop: the cover is skewed and one cable falls
// loose, making the fixture read as damaged rather than a clean UI prop.
save(2,'breaker_panel_faulty.png',im=>{
  rect(im,3,3,18,27,'#1d282e'); rect(im,4,2,17,27,'#728087'); rect(im,5,3,15,24,'#36434a');
  rect(im,6,4,13,2,'#859093'); rect(im,6,6,13,17,'#202d33'); rect(im,7,7,11,14,'#39484e');
  rect(im,8,9,8,6,'#242f34'); rect(im,9,10,5,4,'#9a7650'); rect(im,15,9,2,7,'#272f33');
  im.put(16,10,'#bd7a62'); im.put(16,12,'#c59f68'); rect(im,8,17,8,1,'#758084'); rect(im,8,19,5,1,'#59656a');
  im.put(5,4,'#c0985d'); im.put(19,4,'#8c6550'); im.put(6,23,'#b08b58'); im.put(18,24,'#a17b51');
  line(im,11,27,11,30,'#202a2f'); line(im,12,27,13,29,'#85877d'); line(im,13,29,16,29,'#70797a');
  im.put(17,29,'#8f6249');
},24,32);
save(2,'cable_junction.png',im=>{
  rect(im,13,0,6,9,'#263238'); rect(im,14,0,2,9,'#899194'); rect(im,16,0,2,9,'#414e54');
  rect(im,10,8,12,10,'#1d282e'); rect(im,11,9,10,8,'#58656a'); rect(im,12,10,8,6,'#263239');
  rect(im,14,11,4,4,'#9d7651'); im.put(15,12,'#c0a06b'); im.put(16,13,'#ad6452');
  rect(im,3,17,11,4,'#263238'); rect(im,4,18,10,2,'#798285'); rect(im,18,17,11,4,'#263238'); rect(im,18,18,10,2,'#7e8787');
  for(const x of [5,25]){ im.put(x,17,'#a98455'); im.put(x,21,'#a98455'); }
  line(im,14,18,12,23,'#252f34'); line(im,12,23,12,29,'#758082'); line(im,17,18,20,22,'#202b30'); line(im,20,22,20,28,'#768082');
  rect(im,11,29,3,1,'#9a7250'); rect(im,19,28,3,1,'#8d664b');
});
save(2,'water_damaged_wall.png',im=>{
  rect(im,7,2,8,1,'#344449'); rect(im,5,3,13,2,'#435154'); rect(im,4,5,17,2,'#4a5657');
  rect(im,3,7,19,3,'#465252'); rect(im,5,10,16,2,'#414d4e'); rect(im,8,12,13,2,'#3a4748');
  rect(im,12,14,9,2,'#394748'); rect(im,15,16,7,3,'#354346'); rect(im,17,19,5,3,'#374448');
  rect(im,19,22,4,3,'#3a4749'); rect(im,21,25,3,3,'#3c494b');
  im.put(5,7,'#61706d'); im.put(7,9,'#586663'); im.put(12,13,'#52615e'); im.put(18,20,'#505d5c'); im.put(21,26,'#54615f');
  rect(im,8,6,3,1,'#56625e'); rect(im,13,8,4,1,'#53615e'); rect(im,18,11,2,1,'#51605e');
});

// Block 1: cold dead concrete, localized shell loss, dusty aggregate and old paper.
save(1,'floor_spalled_slab.png',im=>{
  fill(im,'#4b4744'); rect(im,1,1,30,30,'#514c47'); rect(im,4,4,23,23,'#56514b');
  rect(im,3,20,8,5,'#393b3b'); rect(im,4,19,7,1,'#373a3b'); rect(im,4,21,5,3,'#756b60');
  rect(im,5,22,3,1,'#8b7966'); im.put(9,20,'#8b7862'); im.put(10,21,'#35393a');
  line(im,8,19,12,15,'#35393b'); line(im,12,15,14,17,'#35393b'); line(im,14,17,17,13,'#35393b');
  line(im,12,15,10,11,'#484644'); line(im,14,17,18,19,'#454240');
  rect(im,19,7,4,2,'#5b554e'); rect(im,21,8,2,3,'#47433f'); rect(im,24,23,3,2,'#5b554d');
  im.put(4,26,'#756c62'); im.put(6,27,'#6c655d'); im.put(11,25,'#35393b'); im.put(12,25,'#6a6258');
});
save(1,'wall_exposed_lath.png',im=>{
  fill(im,'#494b49'); rect(im,1,1,30,30,'#515250'); rect(im,4,5,24,22,'#5b5c58');
  // Irregular plaster loss, with dark backing and a few lath lines rather than a full brick grid.
  rect(im,5,8,7,1,'#373a3a'); rect(im,6,9,8,1,'#373a3a'); rect(im,5,10,2,5,'#373a3a');
  rect(im,6,10,7,4,'#756c61'); rect(im,8,14,7,3,'#70665b'); rect(im,12,15,5,1,'#363a3a');
  rect(im,7,11,1,5,'#9a8870'); rect(im,10,10,1,6,'#806f5c'); rect(im,13,13,1,3,'#9a866e');
  line(im,15,16,18,18,'#343839'); line(im,18,18,20,17,'#343839'); rect(im,20,17,4,1,'#756b60');
  rect(im,21,7,5,2,'#5d5b56'); rect(im,22,8,5,3,'#4c4e4d'); rect(im,24,9,2,2,'#777064');
  im.put(6,17,'#9b8770'); im.put(7,18,'#766b5e'); im.put(14,19,'#464746'); im.put(25,20,'#4b4d4b');
});
save(1,'floor_rubble_overlay.png',im=>{
  const chips=[['#756d61',4,23,4,2],['#8a7c68',6,22,2,1],['#393c3b',12,25,3,2],['#5e574e',13,24,2,1],['#8c7962',22,19,3,2],['#373b3b',23,18,2,1],['#62594e',26,25,2,1],['#999078',9,28,2,1]];
  for(const [c,x,y,w,h] of chips) rect(im,x,y,w,h,c);
});
save(1,'wall_torn_notice.png',im=>{
  rect(im,7,6,18,21,'#20282b'); rect(im,8,7,16,18,'#827c6e'); rect(im,9,8,14,16,'#aaa08a');
  rect(im,9,8,14,1,'#d0c3a5'); rect(im,8,9,1,13,'#9b927e'); rect(im,10,10,10,1,'#5a5650');
  rect(im,10,13,11,1,'#696158'); rect(im,10,16,8,1,'#625d55'); rect(im,10,19,10,1,'#5c5852');
  rect(im,19,20,4,4,'#665e53'); rect(im,20,22,4,4,'#857866'); rect(im,21,24,3,2,'#514d47');
  im.put(23,8,'#4a4b47'); im.put(7,6,'#a48c70'); im.put(24,7,'#56534d');
});
save(1,'abandoned_belongings.png',im=>{
  rect(im,4,16,24,10,'#24272a'); rect(im,5,14,21,12,'#63594e'); rect(im,7,12,17,14,'#766a5b');
  rect(im,9,11,12,2,'#514d48'); rect(im,12,10,6,2,'#887b68'); rect(im,8,14,14,1,'#97856b');
  rect(im,8,15,2,7,'#514d48'); rect(im,20,15,2,7,'#4f4a45'); rect(im,10,17,10,5,'#62584d');
  rect(im,11,18,7,3,'#776b5a'); rect(im,9,22,12,1,'#a28a68'); rect(im,6,25,3,2,'#24272a'); rect(im,23,25,3,2,'#24272a');
  rect(im,22,17,3,5,'#343c3d'); rect(im,23,18,2,2,'#92836a'); im.put(23,19,'#c29b62'); im.put(16,23,'#735443');
},32,32);
save(1,'failed_repair_patch.png',im=>{
  rect(im,3,8,26,15,'#282a2a'); rect(im,4,7,22,15,'#716c61'); rect(im,6,9,19,11,'#817765');
  rect(im,7,10,16,1,'#a18d70'); rect(im,6,19,17,1,'#574f48'); rect(im,8,12,2,5,'#554f49');
  rect(im,10,12,12,4,'#62594e'); rect(im,11,13,9,2,'#857765'); rect(im,22,10,4,1,'#4b4a47');
  im.put(5,8,'#9b825f'); im.put(24,9,'#9b825f'); im.put(7,20,'#a17e54'); im.put(22,19,'#a17e54');
  line(im,4,22,2,25,'#333636'); line(im,25,22,28,26,'#303536'); line(im,2,25,5,28,'#363838');
});
save(1,'departure_notice.png',im=>{
  rect(im,5,4,22,24,'#1f2528'); rect(im,7,5,19,20,'#887c69'); rect(im,8,6,17,17,'#b2a48a');
  rect(im,9,7,15,1,'#d0c1a2'); rect(im,8,8,1,13,'#9d9079'); rect(im,10,10,11,1,'#625a50');
  rect(im,10,13,12,1,'#6c6255'); rect(im,10,16,8,1,'#665e54'); rect(im,10,19,9,1,'#5c574f');
  rect(im,20,20,5,3,'#756654'); rect(im,23,22,4,4,'#5e554a'); rect(im,6,23,6,2,'#66584e');
  rect(im,12,23,7,2,'#ad8b67'); im.put(24,7,'#73634f'); im.put(7,5,'#ad906a'); im.put(22,24,'#ac795b');
});

// Block 13: impossible but still architectural; folded planes and repeated
// alignment cues live in the same ink-violet/blue-gray language as the hub art.
save(13,'floor_echo_loop.png',im=>{
  fill(im,'#24212d'); rect(im,1,1,30,30,'#282431'); rect(im,3,4,26,23,'#2d2936');
  rect(im,5,6,21,19,'#252330');
  line(im,6,23,6,12,'#8a647b'); line(im,6,12,13,12,'#8a647b'); line(im,13,12,13,19,'#8a647b');
  line(im,13,19,20,19,'#a37487'); line(im,20,19,20,9,'#a37487'); line(im,20,9,26,9,'#a37487');
  rect(im,7,13,2,1,'#d0929a'); rect(im,14,18,2,1,'#c37d92'); rect(im,21,10,1,3,'#7b687f');
  line(im,9,24,9,27,'#4d5262'); line(im,9,27,15,27,'#4d5262'); line(im,15,27,15,22,'#4d5262');
  rect(im,3,3,4,1,'#3c3b4d'); rect(im,25,25,4,1,'#3a3547'); im.put(27,6,'#b06f86');
});
save(13,'wall_folded_plane.png',im=>{
  fill(im,'#292733'); rect(im,1,1,30,30,'#2d2b38'); rect(im,3,3,26,25,'#33313e');
  rect(im,5,5,21,21,'#282733'); rect(im,7,7,17,17,'#37323f');
  line(im,7,7,22,7,'#ab788f'); line(im,22,7,22,21,'#ab788f'); line(im,22,21,11,21,'#886a82');
  line(im,11,21,11,11,'#a7778d'); line(im,11,11,26,11,'#d0989a');
  rect(im,8,8,2,11,'#555064'); rect(im,10,19,10,2,'#51485a'); rect(im,23,12,2,8,'#211f2c');
  rect(im,5,24,4,1,'#78637d'); rect(im,26,5,1,4,'#76647c'); im.put(25,23,'#bf8798');
});
save(13,'wall_echo_symbol.png',im=>{
  line(im,7,7,23,7,'#ca8996'); line(im,23,7,23,12,'#ca8996'); line(im,23,12,19,12,'#ca8996');
  line(im,19,12,19,19,'#916a85'); line(im,19,19,25,19,'#916a85'); line(im,25,19,25,25,'#ca8996');
  line(im,25,25,10,25,'#ca8996'); line(im,10,25,10,21,'#ca8996');
  line(im,10,21,14,21,'#8f6884'); line(im,14,21,14,14,'#8f6884'); line(im,14,14,8,14,'#bd8292');
  im.put(7,7,'#e3a0a2'); im.put(25,25,'#e3a0a2'); im.put(16,8,'#6d637d');
});
save(13,'threshold_offset_echo.png',im=>{
  rect(im,3,5,2,3,'#986c86'); rect(im,4,5,12,1,'#bd8595'); rect(im,17,5,11,1,'#d99a9c');
  rect(im,27,6,2,3,'#8d6985'); rect(im,5,26,7,1,'#8d6985'); rect(im,13,26,2,1,'#d5969e');
  rect(im,16,26,11,1,'#ba7e90'); rect(im,4,24,2,2,'#986c86'); rect(im,27,24,2,2,'#916981');
  rect(im,7,8,1,1,'#48384e'); rect(im,24,22,1,2,'#48384e');
});
save(13,'wall_repeater_panel.png',im=>{
  rect(im,4,5,23,22,'#292632'); rect(im,6,7,19,18,'#78647e'); rect(im,7,8,17,16,'#34303e');
  rect(im,9,10,14,12,'#a17389'); rect(im,11,11,12,11,'#2b2935'); rect(im,12,13,8,8,'#5a4d67');
  rect(im,14,12,8,8,'#292633'); rect(im,16,14,7,7,'#b07b8e'); rect(im,17,15,5,5,'#302d3a');
  rect(im,18,16,5,4,'#66536d'); rect(im,20,17,4,5,'#272632'); rect(im,5,6,2,2,'#d5969e'); rect(im,24,24,2,2,'#d5969e');
});
save(13,'exit_echo_frame.png',im=>{
  // Center the interrupted composition in a two-tile canvas; the open center
  // keeps the existing stair/exit sprite legible when composed beneath actors.
  const target = { put: (x, y, color) => im.put(x + 16, y + 16, color) };
  // Four interrupted offset frames surround a deliberately open central 24×24
  // passage, so the real stairs and traversability remain visually unambiguous.
  line(target,5,7,22,7,'#916a85'); line(target,22,7,22,12,'#916a85'); line(target,23,12,29,12,'#ce8998');
  line(target,29,12,29,25,'#ce8998'); line(target,29,25,23,25,'#916a85'); line(target,23,26,23,32,'#ce8998');
  line(target,23,32,8,32,'#ce8998'); line(target,8,32,8,26,'#916a85');
  line(target,7,25,2,25,'#ce8998'); line(target,2,25,2,10,'#ce8998'); line(target,2,10,7,10,'#916a85'); line(target,7,9,7,7,'#ce8998');
  line(target,10,11,20,11,'#5f526f'); line(target,20,11,20,16,'#bc7f92'); line(target,20,16,24,16,'#bc7f92');
  line(target,24,16,24,22,'#5f526f'); line(target,24,22,17,22,'#bc7f92'); line(target,17,22,17,27,'#bc7f92');
  rect(target,4,8,2,1,'#d899a1'); rect(target,27,27,2,1,'#d899a1'); rect(target,12,9,2,1,'#443b58'); rect(target,25,20,1,2,'#453a55');
},64,64);

console.log('Wrote original Block 2, Block 1, and Block 13 pixel-art assets.');
