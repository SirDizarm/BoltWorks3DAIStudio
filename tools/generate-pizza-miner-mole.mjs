import { randomUUID } from "node:crypto";
import { writeFile } from "node:fs/promises";
import path from "node:path";
import { Jimp, rgbaToInt } from "jimp";

const output = path.resolve(process.argv[2] || "../pizza-miner-mole.bbmodel");
const textureOutput = output.replace(/\.bbmodel$/i, "-texture.png");
const W = 128;
const TILE = 8;
const palette = {
  fur: [91, 61, 45], furLight: [116, 78, 58], furDark: [61, 42, 33],
  pink: [191, 111, 101], pinkLight: [220, 145, 131], tooth: [236, 222, 184],
  olive: [91, 101, 48], oliveLight: [119, 126, 65], oliveDark: [57, 68, 31],
  leather: [112, 72, 38], yellow: [232, 174, 25], yellowLight: [255, 204, 49],
  gray: [83, 89, 86], steel: [145, 151, 145], black: [20, 20, 18],
  box: [188, 166, 119], crust: [213, 151, 54], cheese: [239, 190, 57],
  red: [166, 48, 34], green: [78, 113, 42], white: [250, 239, 196]
};

const image = new Jimp({ width: W, height: W, color: 0x00000000 });
const tiles = new Map();
let tileIndex = 0;
for (const [name, rgb] of Object.entries(palette)) {
  const u = (tileIndex % 16) * TILE;
  const v = Math.floor(tileIndex / 16) * TILE;
  tiles.set(name, [u, v, u + TILE, v + TILE]);
  for (let y = 0; y < TILE; y++) for (let x = 0; x < TILE; x++) {
    const grain = ((x * 5 + y * 3 + tileIndex) % 5) - 2;
    const shade = grain * 4;
    image.setPixelColor(rgbaToInt(...rgb.map(c => Math.max(0, Math.min(255, c + shade))), 255), u + x, v + y);
  }
  tileIndex++;
}
await image.write(textureOutput);
const png = await image.getBuffer("image/png");

const elements = [];
const groups = [];
const byName = new Map();
const group = (name, origin, parent = null) => {
  const value = { name, origin, rotation: [0, 0, 0], children: [], uuid: randomUUID() };
  groups.push(value); byName.set(name, value);
  if (parent) byName.get(parent).children.push(value);
  return value;
};
group("root", [0, 0, 0]);
group("body", [0, 15, 0], "root");
group("head", [0, 27, 0], "body");
group("snout", [0, 27, -4], "head");
group("left_arm", [5, 23, -1], "body");
group("right_arm", [-5, 23, -1], "body");
group("left_leg", [3, 10, 0], "root");
group("right_leg", [-3, 10, 0], "root");
group("tail_01", [0, 12, 4], "body");
group("tail_02", [0, 10, 9], "tail_01");
group("tail_03", [0, 8, 14], "tail_02");
group("backpack", [0, 21, 4], "body");
group("pizza_box", [0, 16, -9], "body");

const facesFor = material => Object.fromEntries(["north", "east", "south", "west", "up", "down"].map(face => [face, { uv: tiles.get(material), texture: 0 }]));
const cube = (name, from, to, material, parent, options = {}) => {
  const value = {
    name, box_uv: false, rescale: false, locked: false, render_order: "default",
    allow_mirror_modeling: true, from, to, autouv: 0, color: 0,
    origin: options.origin || from.map((n, i) => (n + to[i]) / 2),
    faces: facesFor(material), type: "cube", uuid: randomUUID()
  };
  if (options.rotation) value.rotation = options.rotation;
  if (options.inflate) value.inflate = options.inflate;
  elements.push(value); byName.get(parent).children.push(value.uuid);
  return value;
};

// Rounded, layered mole body and head.
cube("belly", [-5, 10, -3], [5, 24, 3], "fur", "body");
cube("belly_front", [-4, 12, -4], [4, 22, -3], "furLight", "body");
cube("shoulders", [-6, 19, -2.5], [6, 24, 2.5], "fur", "body");
cube("hips", [-5.5, 9, -2.5], [5.5, 14, 2.5], "furDark", "body");
cube("head_main", [-5, 23, -4], [5, 33, 4], "fur", "head");
cube("head_round_top", [-4, 31, -3], [4, 34, 3], "furLight", "head");
cube("left_cheek", [3.5, 24, -4.8], [5.5, 29, -2], "furLight", "head");
cube("right_cheek", [-5.5, 24, -4.8], [-3.5, 29, -2], "furLight", "head");
cube("left_eye", [3.65, 28, -4.95], [4.35, 29, -4.7], "black", "head");
cube("right_eye", [-4.35, 28, -4.95], [-3.65, 29, -4.7], "black", "head");

// Snout, nose, teeth and whiskers.
cube("muzzle", [-3.5, 24.5, -7], [3.5, 29, -3.8], "pink", "snout");
cube("nose", [-2.2, 26, -8.2], [2.2, 29, -6.8], "pinkLight", "snout");
cube("nose_tip", [-1.4, 25.2, -8.7], [1.4, 27, -8], "pink", "snout");
cube("left_tooth", [0.35, 22.6, -7], [1.35, 25.3, -5.8], "tooth", "snout");
cube("right_tooth", [-1.35, 22.6, -7], [-0.35, 25.3, -5.8], "tooth", "snout");
for (const side of [-1, 1]) for (let i = 0; i < 3; i++) {
  const x0 = side > 0 ? 2.5 : -8.5;
  cube(`whisker_${side}_${i}`, [x0, 24.7 + i * 1.2, -7.2], [x0 + 6, 25 + i * 1.2, -6.9], "pinkLight", "snout");
}

// Miner helmet and lamp.
cube("helmet_brim", [-6.5, 32.5, -4.8], [6.5, 34, 4.6], "yellow", "head");
cube("helmet_crown", [-4.8, 33.5, -3.8], [4.8, 37.2, 3.5], "yellow", "head");
cube("helmet_top", [-3.5, 36.8, -2.8], [3.5, 38, 2.8], "yellowLight", "head");
cube("lamp_frame", [-2.2, 34, -5.2], [2.2, 38, -4.5], "gray", "head");
cube("lamp_light", [-1.25, 35, -5.45], [1.25, 37.2, -5.15], "white", "head");

// Arms and hands holding the pizza box.
for (const [side, x] of [["left", 1], ["right", -1]]) {
  const parent = `${side}_arm`;
  cube(`${side}_upper_arm`, x > 0 ? [4.7, 17, -3] : [-7.7, 17, -3], x > 0 ? [7.7, 23, 1] : [-4.7, 23, 1], "furLight", parent);
  cube(`${side}_forearm`, x > 0 ? [5, 14.5, -8] : [-8, 14.5, -8], x > 0 ? [8, 18.5, -2] : [-5, 18.5, -2], "fur", parent);
  cube(`${side}_hand`, x > 0 ? [5.2, 14.2, -10] : [-8.2, 14.2, -10], x > 0 ? [8.2, 17.5, -7] : [-5.2, 17.5, -7], "pinkLight", parent);
  cube(`${side}_finger_1`, x > 0 ? [7.7, 14.2, -10.5] : [-8.5, 14.2, -10.5], x > 0 ? [8.4, 15, -8] : [-7.8, 15, -8], "pink", parent);
}

// Short legs, feet and claws.
for (const [side, x0] of [["left", 0.5], ["right", -4.5]]) {
  const parent = `${side}_leg`;
  cube(`${side}_thigh`, [x0, 4, -2.5], [x0 + 4, 11, 2.5], "fur", parent);
  cube(`${side}_foot`, [x0 - 0.4, 0, -4.2], [x0 + 4.4, 4.2, 2.8], "pink", parent);
  for (let i = 0; i < 3; i++) cube(`${side}_claw_${i}`, [x0 + 0.2 + i * 1.25, 0.2, -5], [x0 + 1 + i * 1.25, 1, -3.7], "pinkLight", parent);
}

// Backpack with flap, pockets, straps, rope and mining tool.
cube("pack_main", [-6, 13, 3], [6, 29, 9], "olive", "backpack");
cube("pack_top", [-5.5, 27, 2.5], [5.5, 31, 9], "oliveLight", "backpack");
cube("pack_flap", [-5.5, 23, 2.2], [5.5, 28, 3.4], "oliveLight", "backpack");
cube("pack_pocket", [-3.8, 13.5, 2], [3.8, 20, 3.4], "oliveDark", "backpack");
cube("left_side_pouch", [5.8, 15, 4], [9, 24, 8], "oliveDark", "backpack");
cube("right_side_pouch", [-9, 15, 4], [-5.8, 24, 8], "oliveDark", "backpack");
for (const x of [-3.8, 3.8]) cube(`strap_${x}`, [x - 0.6, 12.5, 1.7], [x + 0.6, 30, 2.5], "leather", "backpack");
for (let i = 0; i < 8; i++) {
  const angle = i * Math.PI / 4;
  const x = 6.9 + Math.cos(angle) * 2.1;
  const y = 15.7 + Math.sin(angle) * 2.1;
  cube(`rope_${i}`, [x - 0.45, y - 0.45, 8.1], [x + 0.45, y + 0.45, 9], "leather", "backpack");
}
cube("tool_handle", [-8.2, 12, 8.2], [-7.2, 29, 9], "leather", "backpack");
cube("tool_head", [-10.5, 27.5, 8], [-5, 29.2, 9.3], "steel", "backpack");

// Articulated tail.
cube("tail_segment_1", [-1.2, 9, 3], [1.2, 12.5, 10], "pink", "tail_01", { rotation: [18, 0, 0], origin: [0, 11, 4] });
cube("tail_segment_2", [-1, 7, 9], [1, 10, 15], "pinkLight", "tail_02", { rotation: [18, 0, 0], origin: [0, 9, 9] });
cube("tail_segment_3", [-0.8, 6, 14], [0.8, 8.5, 20], "pink", "tail_03", { rotation: [12, 0, 0], origin: [0, 7.5, 14] });

// Pizza box, pizza and blocky toppings.
cube("pizza_box_base", [-8, 14.5, -14], [8, 16, -3], "box", "pizza_box");
cube("pizza_box_lid", [-8, 16, -14], [8, 16.6, -3], "box", "pizza_box");
cube("pizza_cheese", [-6.5, 16.6, -12.7], [6.5, 17, -4.3], "cheese", "pizza_box");
cube("pizza_crust_front", [-7, 16.7, -13.2], [7, 17.4, -12.2], "crust", "pizza_box");
cube("pizza_crust_back", [-7, 16.7, -4.8], [7, 17.4, -3.8], "crust", "pizza_box");
cube("pizza_crust_left", [-7, 16.7, -12.2], [-6, 17.4, -4.8], "crust", "pizza_box");
cube("pizza_crust_right", [6, 16.7, -12.2], [7, 17.4, -4.8], "crust", "pizza_box");
for (const [i, x, z, mat] of [[0,-4,-10,"red"],[1,0,-10,"red"],[2,4,-10,"black"],[3,-2,-7,"black"],[4,2,-7,"red"],[5,-4,-5.5,"red"],[6,4,-5.5,"red"]]) {
  cube(`topping_${i}`, [x - 0.7, 17, z - 0.7], [x + 0.7, 17.35, z + 0.7], mat, "pizza_box");
}

const project = {
  meta: { format_version: "4.10", model_format: "modded_entity", box_uv: false },
  name: "pizza_miner_mole", model_identifier: "pizza_miner_mole",
  modded_entity_entity_class: "", modded_entity_version: "1.21.1", modded_entity_flip_y: true,
  visible_box: [2, 3, 0], resolution: { width: W, height: W }, elements,
  outliner: [byName.get("root")], textures: [{ path: path.basename(textureOutput), name: path.basename(textureOutput), folder: "", namespace: "", id: "0", particle: false, render_mode: "default", render_sides: "auto", frame_time: 1, frame_order_type: "loop", frame_order: "", frame_interpolate: false, visible: true, internal: true, saved: true, uuid: randomUUID(), source: `data:image/png;base64,${png.toString("base64")}` }],
  animations: []
};
await writeFile(output, JSON.stringify(project));
console.log(`Created ${output} with ${elements.length} cuboids and ${groups.length} rig groups.`);
console.log(`Created ${textureOutput}.`);
