#!/usr/bin/env node
/**
 * 真实调用一次两家 provider，打印原始响应，用来校准路径 / 参数 / 单价。
 *
 *   node scripts/provider-selftest.js --provider fal
 *   node scripts/provider-selftest.js --provider atlas
 *   node scripts/provider-selftest.js --provider all --wait
 *
 * --wait 会一直轮询到出结果（或直接失败），并打印最终 video url。
 */
const path = require('path');
const fs = require('fs');

// 允许本地用 .env（简单解析，避免额外依赖）
const envPath = path.join(__dirname, '..', '.env');
if (fs.existsSync(envPath)) {
  fs.readFileSync(envPath, 'utf8')
    .split('\n')
    .forEach((line) => {
      const m = line.match(/^\s*([A-Z0-9_]+)\s*=\s*(.*)\s*$/);
      if (m && !process.env[m[1]]) process.env[m[1]] = m[2].trim();
    });
}

const argv = process.argv.slice(2);
const arg = (name) => {
  const i = argv.indexOf('--' + name);
  return i >= 0 ? argv[i + 1] : null;
};
const flag = (name) => argv.includes('--' + name);

const providerName = arg('provider') || 'all';
const shouldWait = flag('wait');

const INPUT = {
  prompt:
    'A 13-second four-shot zombie love story. @Image1 shuffles out of the fog, @Image2 lowers the gun, @Image1 sprints with open arms, then the same run becomes a laughing hug on a sunny day.',
  imageUrls: [
    'https://zombie-couple.xyz/assets/scene-ruined-city.jpg',
    'https://zombie-couple.xyz/assets/scene-snow-town.jpg'
  ],
  duration: 13,
  aspectRatio: '9:16',
  resolution: '720p',
  audio: true,
  modelKey: 'kling-o3-r2v'
};

(async () => {
  const names = providerName === 'all' ? ['fal', 'atlas'] : [providerName];
  for (const name of names) {
    const provider = require('../server/providers/' + (name === 'fal' ? 'fal' : 'atlascloud'));
    console.log('\n===== ' + name + ' =====');
    console.log('model:', provider.MODELS['kling-o3-r2v']);
    try {
      const ref = await provider.submit(Object.assign({ provider: name }, INPUT));
      console.log('submit ok ->', JSON.stringify(ref, null, 2).slice(0, 1200));

      if (!shouldWait) {
        console.log('(加 --wait 可轮询到出片)');
        continue;
      }

      const started = Date.now();
      for (let i = 0; i < 60; i++) {
        const st = await provider.status(ref);
        process.stdout.write('  state=' + st.state + '  t+' + Math.round((Date.now() - started) / 1000) + 's\n');
        if (st.state === 'succeeded') {
          const res = provider.result ? await provider.result(ref) : { videoUrl: st.videoUrl };
          console.log('videoUrl:', res.videoUrl || st.videoUrl);
          console.log('cost estimate:', JSON.stringify(provider.estimateCost(INPUT, res)));
          break;
        }
        if (st.state === 'failed') {
          console.log('FAILED raw:', JSON.stringify(st.raw).slice(0, 800));
          break;
        }
        await new Promise((r) => setTimeout(r, 5000));
      }
    } catch (e) {
      console.error('submit failed:', e.message);
      if (e.body) console.error('body:', e.body);
    }
  }
})();
