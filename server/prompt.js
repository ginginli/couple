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
const ASSET_BASE = process.env.ASSET_BASE_URL || 'https://www.zombie-couple.xyz/assets';
const WORLD_REF_VIDEO = {
  city: ASSET_BASE + '/videos/scene-ruined-city.mp4',
  highway: ASSET_BASE + '/videos/scene-highway.mp4'
};

function refVideoFor(world) {
  return WORLD_REF_VIDEO[world] || WORLD_REF_VIDEO.city;
}

// Atlas 的 prompt 上限是 2500 字符（超出直接 ret:1201 失败），这里必须留余量
const BASE_PROMPT_TEMPLATE =
  "A 13-second, four-shot cinematic short film about a viral outbreak. @Image1 is the infected loved one, @Image2 the survivor.\n\n" +
  "HOW @Image1 LOOKS NOW: exactly the same person - same face shape, eyes, nose, mouth, hairstyle, facial hair, glasses if any, age and clothes, now dusty and frayed. The infection only drains colour, like careful film makeup on an intact face: ash-grey skin, faint dark veins at temples and neck, milky white eyes, dry lips, messy dusty hair. The face stays smooth, whole and fully human, so anyone who knows them recognizes it at a glance. If @Image1 is a pet, keep the same breed, size, fur colour, markings and collar, coat dusty and greyed, eyes milky white. The survivor from @Image2 is never infected: eyes, skin and face stay completely normal in every shot.\n\n" +
  "LOCATION AND CAMERA: every shot keeps the exact place, weather, light and colour of reference clip @Video1 - same streets, buildings, ground and sky. Copy its camera language: same framing, same slow steady movement. Never move them elsewhere.\n\n" +
  "Shot 1 (0-2s): dusk in {setting}, cold grey fog. Close-up on the infected @Image1 slowly shuffling out of the fog toward camera, face filling the frame and coming into focus: unmistakably @Image1.\n\n" +
  "Shot 2 (2-6s): close on the survivor aiming a handgun with both trembling hands at the infected figure. Tears run down their face, their jaw shakes, they cannot pull the trigger, then slowly lower the gun and drop it.\n\n" +
  "Shot 3 (6-10s): a wide, fixed side-on shot with both in frame about ten metres apart. The infected @Image1 flings its arms wide open and sprints at the survivor, fast and ferocious, snarling, covering the whole distance (a pet races toward them instead). The survivor stays put, eyes closed, arms opening.\n\n" +
  "Shot 4 (10-13s): on impact, a seamless cut on the same camera angle to the same place on a warm, sunny day before the outbreak. Momentum carries on: @Image1, healthy and looking exactly like their photo, tackles the survivor; they tumble onto the ground and lie there wrapped in a hug, laughing, in golden light (a pet knocks them over and they roll around together).\n\n" +
  "Audio: natural ambient sound of reference clip @Video1 throughout; no added music, no dialogue. Photorealistic, film grain, cinematic lighting. The gun is never fired. No blood, no gore, no wounds, no kissing, no text, no logos.";

function buildPrompt(input) {
  const raw = (input && (input.world || input.setting)) || 'city';
  // 未知场景一律回落 city：否则会把未知场景名当成描述文字直接塞进 prompt
  const setting = WORLD_SETTINGS[raw] || WORLD_SETTINGS.city;
  return BASE_PROMPT_TEMPLATE.replace('{setting}', setting);
}

module.exports = { buildPrompt, refVideoFor, WORLD_SETTINGS, WORLD_REF_VIDEO };
