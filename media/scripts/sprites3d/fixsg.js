// node fixsg.js in.glb out.glb : turn KHR_materials_pbrSpecularGlossiness materials into metal/rough ones three.js can read (diffuse -> base colour)
const fs = require('fs'), b = fs.readFileSync(process.argv[2]), len = b.readUInt32LE(12), j = JSON.parse(b.slice(20, 20 + len).toString()), rest = b.slice(20 + len);
for (const m of j.materials || []) { const e = m.extensions && m.extensions.KHR_materials_pbrSpecularGlossiness; if (!e) continue;
  m.pbrMetallicRoughness = { baseColorFactor: e.diffuseFactor || [1, 1, 1, 1], metallicFactor: 0, roughnessFactor: 1 - (e.glossinessFactor ?? 0.5) * 0.5 };
  if (e.diffuseTexture) m.pbrMetallicRoughness.baseColorTexture = e.diffuseTexture; delete m.extensions.KHR_materials_pbrSpecularGlossiness; console.log('fixed', m.name, !!e.diffuseTexture); }
j.extensionsUsed = (j.extensionsUsed || []).filter(x => x !== 'KHR_materials_pbrSpecularGlossiness'); j.extensionsRequired = (j.extensionsRequired || []).filter(x => x !== 'KHR_materials_pbrSpecularGlossiness');
let js = Buffer.from(JSON.stringify(j)); const pad = (4 - js.length % 4) % 4; js = Buffer.concat([js, Buffer.alloc(pad, 0x20)]);
const head = Buffer.alloc(20); head.writeUInt32LE(0x46546C67, 0); head.writeUInt32LE(2, 4); head.writeUInt32LE(20 + js.length + rest.length, 8); head.writeUInt32LE(js.length, 12); head.writeUInt32LE(0x4E4F534A, 16);
fs.writeFileSync(process.argv[3], Buffer.concat([head, js, rest]));
