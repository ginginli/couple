/**
 * 核心配方：4 镜头 prompt 模板（服务端专用）
 *
 * 这个文件永远不会被浏览器加载——Vercel 上 /server/* 已被重定向拦截，
 * 且前端不再持有模板。客户端只提交 world / resolution / 图片 URL，
 * prompt 由这里组装后直送 provider，不经过浏览器，也不出现在任何响应里。
 */

// 场景描述要够具体：只写「一条废弃街道」时，模型容易自己想象成别的街道。
// 这段文字会同时出现在 LOCATION 段和 Shot 1，把两个场景的地貌差异钉死。
const WORLD_SETTINGS = {
  city: 'an abandoned city street with rubble and rusted cars',
  highway: 'an empty highway lined with abandoned cars on cracked asphalt'
};

// 每个 shot 里复述场景用的短写法：镜头之间反复提到同一个地点，
// 后段镜头才不会漂到模型自己想象的默认场景去。用短句是为了守住 2500 字符上限。
const WORLD_SHORT_SETTINGS = {
  city: 'the ruined city street',
  highway: 'the empty highway'
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
// 实测教训（2026-10-25，job f58380bcc7264851a798f98beebad934）：不写明「参考视频里的
// 角色必须被替换」，Kling 会把任务理解成复刻参考视频，直接沿用示例片里的角色，两张
// 参考图被完全忽略 —— 所以 CHARACTERS FIRST 段落是整份 prompt 里最关键的一段，不能删。
const BASE_PROMPT_TEMPLATE =
  "A 13-second, four-shot cinematic short film about a viral outbreak. @Image1 is the infected loved one, @Image2 the survivor.\n\n" +
  "CHARACTERS FIRST: the only characters are @Image1 (infected) and @Image2 (survivor), looking exactly like their photos. @Video1 gives ONLY place, weather, light and camera work; no person or animal from @Video1 may appear - every role is recast from the two photos.\n\n" +
  "HOW @Image1 LOOKS NOW: exactly the same person - same face, hairstyle, age and clothes, now dusty and frayed. Infection only drains colour, like film makeup on an intact face: ash-grey skin, faint dark veins, milky white eyes. The face stays whole, human and recognizable. If @Image1 is a pet, keep the same breed, size, fur colour, markings and collar, coat dusty and greyed, eyes milky white. @Image2 is never infected: eyes, skin and face stay completely normal in every shot.\n\n" +
  "LOCATION AND CAMERA: {setting}. Every shot stays in that exact place and keeps the weather, light and colour of @Video1: same ground, sky, framing and slow steady movement. Never move them elsewhere.\n\n" +
  "Shot 1 (0-2s): dusk on {short}, cold grey fog. Close-up: the infected @Image1 shuffles out of the fog toward camera, face filling the frame: unmistakably @Image1.\n\n" +
  "Shot 2 (2-6s): on {short}, close on @Image2 aiming a handgun with both trembling hands at the infected figure. Tears run down their face; they cannot pull the trigger, then lower the gun and drop it.\n\n" +
  "Shot 3 (6-10s): on {short}, a wide fixed side-on shot, both in frame ten metres apart. The infected @Image1 flings its arms wide, sprints at @Image2, fast and ferocious, covering the whole distance (a pet races toward them instead). @Image2 stays put, eyes closed, arms opening.\n\n" +
  "Shot 4 (10-13s): on {short}, a seamless cut on the same angle to a warm sunny day before the outbreak. @Image1, healthy, exactly like their photo, tackles @Image2; they tumble onto the ground wrapped in a hug, laughing, in golden light (a pet knocks them over and they roll around together).\n\n" +
  "Audio: natural ambient sound of @Video1 throughout; no added music, no dialogue. Photorealistic, film grain, cinematic lighting. The gun is never fired. No blood, no gore, no wounds, no kissing, no text, no logos.";

function buildPrompt(input) {
  const raw = (input && (input.world || input.setting)) || 'city';
  // 未知场景一律回落 city：否则会把未知场景名当成描述文字直接塞进 prompt
  const setting = WORLD_SETTINGS[raw] || WORLD_SETTINGS.city;
  const short = WORLD_SHORT_SETTINGS[raw] || WORLD_SHORT_SETTINGS.city;
  // {setting} 与 {short} 都出现多次，必须全量替换：用 replace(字符串) 只会换掉第一个，
  // 后面的会以 "{short}" 原文漏进 prompt
  return BASE_PROMPT_TEMPLATE.split('{setting}').join(setting).split('{short}').join(short);
}

module.exports = {
  buildPrompt, refVideoFor, WORLD_SETTINGS, WORLD_SHORT_SETTINGS, WORLD_REF_VIDEO
};
