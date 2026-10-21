/**
 * 核心配方：4 镜头 prompt 模板（服务端专用）
 *
 * 这个文件永远不会被浏览器加载——Vercel 上 /server/* 已被重定向拦截，
 * 且前端不再持有模板。客户端只提交 world / resolution / 图片 URL，
 * prompt 由这里组装后直送 provider，不经过浏览器，也不出现在任何响应里。
 */

const WORLD_SETTINGS = {
  city: 'an abandoned city street',
  highway: 'an empty highway lined with abandoned cars'
};

// 场景 → 参考视频（三条示例短片，页面上的卡片标题与之一一对应）。
// 传给 Kling 的 video 字段，用来把场景/光线/运镜锁到示例短片。
const ASSET_BASE = process.env.ASSET_BASE_URL || 'https://zombie-couple.xyz/assets';
const WORLD_REF_VIDEO = {
  city: ASSET_BASE + '/videos/scene-ruined-city.mp4',
  highway: ASSET_BASE + '/videos/scene-highway.mp4'
};

function refVideoFor(world) {
  return WORLD_REF_VIDEO[world] || WORLD_REF_VIDEO.city;
}

const BASE_PROMPT_TEMPLATE =
  "A 13-second, four-shot cinematic short film about a viral outbreak. @Image1 is the loved one who has been infected; @Image2 is the survivor.\n\n" +
  "HOW @Image1 LOOKS NOW: exactly the same person as in @Image1 - the same face shape, eyes, nose, mouth, hairstyle, facial hair and glasses if any, the same age, and the same clothes as in @Image1, now dusty and frayed. The infection only drains their colour, like careful film makeup on an intact face: ash-grey pale skin, faint dark veins at the temples and neck, milky white eyes, dry pale lips, messy dusty hair. Their skin stays smooth and whole and their face stays fully human, so anyone who knows them recognizes them at a glance. If @Image1 is a pet, it is the same animal with the same breed, size, fur colour, markings and collar, its coat dusty and greyed and its eyes milky white. The survivor from @Image2 is never infected: their eyes, skin and face stay completely normal in every shot.\n\n" +
  "LOCATION AND CAMERA: every shot happens in the exact place, weather, light and colour of the reference clip @Video1 - the same streets, buildings, ground and sky. Copy the camera language of @Video1: the same kind of framing and the same slow, steady movement. Do not move the characters to any other place.\n\n" +
  "Shot 1 (0-2s): dusk in {setting}, cold grey fog. Close-up on the infected @Image1 slowly shuffling out of the fog toward the camera, its face filling the frame and coming into focus: it is unmistakably @Image1.\n\n" +
  "Shot 2 (2-6s): close on the survivor from @Image2 aiming a handgun with both trembling hands at the infected figure. Tears run down the survivor's face, their jaw shakes, they cannot pull the trigger. They slowly lower the gun and let it drop to the ground.\n\n" +
  "Shot 3 (6-10s): a wide, fixed side-on shot with both of them in frame, about ten metres apart. The infected @Image1 flings its arms wide open and sprints at the survivor, fast and ferocious, snarling, covering the whole distance (a pet races toward them instead). The survivor stays where they are, eyes closed, and opens their arms.\n\n" +
  "Shot 4 (10-13s): at the exact moment of impact, a seamless cut on the same camera angle to the same place on a warm, sunny day before the outbreak. The momentum carries straight on: @Image1, healthy and looking exactly like their photo, tackles the survivor and they both tumble onto the ground, then lie there wrapped in a hug, laughing, in golden light (a pet knocks them over and they roll around together).\n\n" +
  "Audio: the natural ambient sound of the reference clip @Video1 carries through all four shots; no added music, no dialogue. Photorealistic, film grain, cinematic lighting. The gun is never fired. No blood, no gore, no wounds, no kissing, no text, no logos.";

function buildPrompt(input) {
  const raw = (input && (input.world || input.setting)) || 'city';
  // 未知场景一律回落 city：否则会把未知场景名当成描述文字直接塞进 prompt
  const setting = WORLD_SETTINGS[raw] || WORLD_SETTINGS.city;
  return BASE_PROMPT_TEMPLATE.replace('{setting}', setting);
}

module.exports = { buildPrompt, refVideoFor, WORLD_SETTINGS, WORLD_REF_VIDEO };
