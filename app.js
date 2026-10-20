    // =========================================================================
    // STATE & ORIGINAL ZOOOP ZOMBIE-LOVE-STORY TEMPLATE CONFIGURATION
    // =========================================================================
    // =========================================================================
    // RUNTIME UI TEXT (dynamic strings injected by JS)
    // =========================================================================
    var UI_TEXT = {
      en: {
        workTitleDemo: 'Ruined city · Zombie couple reunion (official example)',
        worldCity: 'Ruined city',
        rolePartner: 'Partner (@Image1)',
        roleSurvivor: 'Survivor (@Image2)',
        createdJustNow: 'Just now · 13s 9:16 native audio',
        createdGenerated: 'Just generated · 13s 9:16 native audio',
        sampleDog: 'Golden Retriever Lucky',
        sampleDogSlot: 'Golden Retriever Lucky (@Image1)',
        sampleOwner: 'Owner Alex',
        sampleOwnerSlot: 'Owner Alex (@Image2)',
        samplePartner: 'Partner Lin Xia',
        samplePartnerSlot: 'Partner Lin Xia (@Image1)',
        sampleSurvivor: 'Survivor Chen Mo',
        sampleSurvivorSlot: 'Survivor Chen Mo (@Image2)',
        playClip: '▶ Play the 13s clip',
        downloadPack: 'Download config',
        muted: 'Muted',
        audioScore: 'Heartbeat + piano score',
        roleInfected: 'Infected partner',
        roleSurvivorYou: 'Survivor (you)',
        playerSubtitle: ' · 13s 4-shot preview',
        uploadedPhoto1: 'Photo 1 uploaded (infected @Image1)',
        uploadedPhoto2: 'Photo 2 uploaded (survivor @Image2)',
        shot1Pill: 'Shot 1 (0–2s) · Emerging from the fog',
        shot1Caption: 'In cold grey fog, the infected @Image1 shuffles forward, the face gradually coming into focus — still unmistakably the person you know.',
        shot2Pill: 'Shot 2 (2–6s) · Aiming through tears, then lowering',
        shot2Caption: 'Survivor @Image2 aims at their loved one with trembling hands, tears falling, cannot pull the trigger, and slowly lets the gun drop.',
        shot3Pill: 'Shot 3 (6–10s) · Full sprint with open arms',
        shot3Caption: 'Wide side view: @Image1 sprints down the whole street with arms wide, the survivor closes their eyes and opens their arms for the impact…',
        shot4Pill: 'Shot 4 (10–13s) · Sunny embrace & laughter 🎹',
        shot4Caption: 'At impact, the same camera cuts seamlessly back to the golden sunny day before the outbreak! The momentum tumbles you both to the ground, laughing in an embrace.',
        copyFailed: 'Copy failed, please select and copy manually',
        copiedJson: '✅ JSON request config copied!',
        cssDownloaded: '✅ style.css downloaded',
        jsonDownloaded: '📦 Storyboard config JSON downloaded'
      },
      zh: {
        workTitleDemo: '废墟城市 · 僵尸情侣重逢 (官方示例)',
        worldCity: '废墟城市',
        rolePartner: '伴侣 (@Image1)',
        roleSurvivor: '幸存者 (@Image2)',
        createdJustNow: '刚刚 · 13s 9:16 原生音轨',
        createdGenerated: '刚刚生成 · 13s 9:16 原生音轨',
        sampleDog: '金毛犬 Lucky',
        sampleDogSlot: '金毛犬 Lucky (@Image1)',
        sampleOwner: '主人 Alex',
        sampleOwnerSlot: '主人 Alex (@Image2)',
        samplePartner: '伴侣 林夏',
        samplePartnerSlot: '伴侣林夏 (@Image1)',
        sampleSurvivor: '幸存者 陈默',
        sampleSurvivorSlot: '幸存者陈默 (@Image2)',
        playClip: '▶ 播放 13 秒成片',
        downloadPack: '下载参数包',
        muted: '已静音',
        audioScore: '心跳+钢琴配乐',
        roleInfected: '被感染伴侣',
        roleSurvivorYou: '幸存者 (你)',
        playerSubtitle: ' · 13秒四镜头预览',
        uploadedPhoto1: '已上传第 1 张照片（被感染者 @Image1）',
        uploadedPhoto2: '已上传第 2 张照片（幸存者 @Image2）',
        shot1Pill: 'Shot 1 (0–2s) · 浓雾逼近特写',
        shot1Caption: '灰冷浓雾中，被感染的 @Image1 蹒跚走出，面容逐渐清晰——依然是你一眼认得出的那个人。',
        shot2Pill: 'Shot 2 (2–6s) · 含泪举枪弃枪',
        shot2Caption: '幸存者 @Image2 双手颤抖举枪对准爱人，眼泪滑落却无法扣下扳机，慢慢放下枪任其掉落。',
        shot3Pill: 'Shot 3 (6–10s) · 十米飞奔冲刺',
        shot3Caption: '侧面全景：@Image1 张开双臂猛烈冲过十米长街，幸存者闭上双眼，张开双臂迎接撞击……',
        shot4Pill: 'Shot 4 (10–13s) · 晴天相拥大笑 🎹',
        shot4Caption: '撞击瞬间同机位无缝切回爆发前的金色晴天！冲势将两人一起扑倒在地，在暖阳下相拥大笑。',
        copyFailed: '复制失败，请手动全选复制',
        copiedJson: '✅ 已复制 JSON 请求参数配置！',
        cssDownloaded: '✅ 已下载独立样式表 style.css',
        jsonDownloaded: '📦 已下载当前场景的分镜配置 JSON 文件'
      }
    };

    function t(key) {
      var lang = (typeof appState !== 'undefined' && appState && appState.lang)
        ? appState.lang
        : ((document.documentElement.lang || 'en').indexOf('zh') === 0 ? 'zh' : 'en');
      var dict = UI_TEXT[lang] || UI_TEXT.en;
      return dict[key] !== undefined ? dict[key] : (UI_TEXT.en[key] || key);
    }

    var ASSET_BASE = location.pathname.indexOf('/zh/') === -1 ? 'assets/' : '../assets/';

    var appState = {
      lang: (document.documentElement.lang || 'en').indexOf('zh') === 0 ? 'zh' : 'en',
      theme: 'dark',
      credits: 800,
      world: 'city', // 'city' | 'snow' | 'highway'
      resolution: '720p', // '480p' | '720p' | '1080p'
      apiEndpoint: '/api/ai/templates',
      allFaqsOpen: false,
      slot1: {
        loaded: false,
        name: '',
        src: ''
      },
      slot2: {
        loaded: false,
        name: '',
        src: ''
      },
      player: {
        isOpen: false,
        isPlaying: false,
        isMuted: false,
        currentTime: 0,
        timerId: null,
        audioCtx: null,
        lastBeatTime: -1,
        pianoPlayed: false
      },
      works: [
        {
          id: 'demo-work-1',
          title: t('workTitleDemo'),
          worldKey: 'city',
          worldLabel: t('worldCity'),
          resolution: '720p',
          creditsCost: 645,
          role1: t('rolePartner'),
          role2: t('roleSurvivor'),
          coverSrc: ASSET_BASE + 'scene-ruined-city.jpg',
          createdAt: t('createdJustNow')
        }
      ]
    };

    var WORLD_MAP = {
      city: {
        value: 'an abandoned city street',
        zh: '废墟城市',
        en: 'Ruined city',
        cover: ASSET_BASE + 'scene-ruined-city.jpg'
      },
      snow: {
        value: 'a snowy, abandoned mountain town',
        zh: '雪中小镇',
        en: 'Snowy town',
        cover: ASSET_BASE + 'scene-snow-town.jpg'
      },
      highway: {
        value: 'an empty highway lined with abandoned cars',
        zh: '空荡公路',
        en: 'Empty highway',
        cover: ASSET_BASE + 'scene-highway.jpg'
      }
    };

    var TIER_PRICES = {
      '480p': 310,
      '720p': 645,
      '1080p': 2000
    };

    // Exchange rate: 1 credit = $0.0025  ->  400 credits = $1
    var CREDIT_USD = 0.0025;

    function creditsToUsd(credits) {
      return '$' + (credits * CREDIT_USD).toFixed(2);
    }

    var BASE_PROMPT_TEMPLATE =
      "A 13-second, four-shot cinematic short film about a viral outbreak. @Image1 is the loved one who has been infected; @Image2 is the survivor.\n\n" +
      "HOW @Image1 LOOKS NOW: exactly the same person as in @Image1 - the same face shape, eyes, nose, mouth, hairstyle, facial hair and glasses if any, the same age, and the same clothes as in @Image1, now dusty and frayed. The infection only drains their colour, like careful film makeup on an intact face: ash-grey pale skin, faint dark veins at the temples and neck, milky white eyes, dry pale lips, messy dusty hair. Their skin stays smooth and whole and their face stays fully human, so anyone who knows them recognizes them at a glance. If @Image1 is a pet, it is the same animal with the same breed, size, fur colour, markings and collar, its coat dusty and greyed and its eyes milky white. The survivor from @Image2 is never infected: their eyes, skin and face stay completely normal in every shot.\n\n" +
      "Shot 1 (0-2s): dusk in {setting}, cold grey fog. Close-up on the infected @Image1 slowly shuffling out of the fog toward the camera, its face filling the frame and coming into focus: it is unmistakably @Image1.\n\n" +
      "Shot 2 (2-6s): close on the survivor from @Image2 aiming a handgun with both trembling hands at the infected figure. Tears run down the survivor's face, their jaw shakes, they cannot pull the trigger. They slowly lower the gun and let it drop to the ground.\n\n" +
      "Shot 3 (6-10s): a wide, fixed side-on shot with both of them in frame, about ten metres apart. The infected @Image1 flings its arms wide open and sprints at the survivor, fast and ferocious, snarling, covering the whole distance (a pet races toward them instead). The survivor stays where they are, eyes closed, and opens their arms.\n\n" +
      "Shot 4 (10-13s): at the exact moment of impact, a seamless cut on the same camera angle to the same place on a warm, sunny day before the outbreak. The momentum carries straight on: @Image1, healthy and looking exactly like their photo, tackles the survivor and they both tumble onto the ground, then lie there wrapped in a hug, laughing, in golden light (a pet knocks them over and they roll around together).\n\n" +
      "Audio: a low tense drone and a heartbeat in shots 1 to 3, switching at the cut to a soft, warm piano melody; no dialogue. Photorealistic, film grain, cinematic lighting. The gun is never fired. No blood, no gore, no wounds, no kissing, no text, no logos.";

    var FAQS_DATA = {
      zh: [
        { q: "僵尸情侣视频怎么做？", a: "第一张传伴侣的照片，第二张传你自己，选好场景就能生成。伴侣被感染后从浓雾里走来，你放下枪，TA 朝你冲过来，画面切到晴天，同样的冲势变成抱在一起大笑。一条大约四到五分钟。" },
        { q: "两张照片的顺序重要吗？", a: "重要，顺序决定谁是谁。第 1 张是被感染的人，第 2 张是举枪的幸存者，通常就是你。传反了，被感染的就是你。" },
        { q: "可以用我家的猫或狗吗？", a: "可以，作为第 1 张上传。你的宠物会带着蒙尘的毛、浑浊的眼睛从雾里走出来，朝你冲过来，到了晴天那一幕把你扑倒撒娇。宠物的效果比人稍微不稳定一些，请用能看清整只动物的清晰照片。" },
        { q: "会很血腥吗？", a: "不会。枪从头到尾没有开火，幸存者把它放下、扔在地上。没有血，也没有撕咬。被感染的样子只是皮肤发灰、有暗色血管、眼睛泛白，脸还是认得出来的那张脸，结尾是温暖的大笑拥抱。这是催泪短片，不是恐怖片。" },
        { q: "视频多长、什么比例？", a: "13 秒，竖版 9:16，带声音：紧张的心跳声在转场那一刻变成温柔的钢琴。默认 720p，也可以选 480p 或 1080p。" },
        { q: "要多少积分？", a: "480p 每次 310 积分（≈ $0.78），720p 645 积分（≈ $1.61），1080p 2,000 积分（≈ $5.00）。1 积分 = $0.0025，即 400 积分 = $1。开始生成前，生成按钮上会显示准确价格。" },
        { q: "会和照片一模一样吗？", a: "认得出是谁，但不是逐像素相同。被感染的样子会让脸更苍白、略显消瘦，推在头顶的眼镜这类小配饰也可能不见。正脸清晰的照片最能保住长相。" },
        { q: "什么是 AI 僵尸特效？", a: "九月底开始火起来的一种短视频：病毒爆发后灰蒙蒙的世界里，有人举枪对准自己最爱的人，对方已经被感染，TA 下不了手，被拉进一个拥抱，画面切回更快乐的一天。也叫僵尸爱情故事，做得最多的是情侣和养宠物的人。" },
        { q: "可以用谁的照片？", a: "只能用成年人或宠物的照片，并且对方愿意出镜。正脸清晰、脸部完整露出的照片效果最好。" }
      ],
      en: [
        { q: "How do I make the zombie couple video?", a: "Upload a photo of your partner first and one of yourself second, pick a world and generate. Your partner walks out of the fog infected, you lower the gun, they charge at you, and the clip cuts to a sunny day where the same run turns into a laughing hug. A clip takes about four to five minutes." },
        { q: "Which photo goes first?", a: "The order decides who is who. Photo 1 is the one who has been infected; photo 2 is the survivor holding the gun, usually you. Swap them and you become the infected one instead." },
        { q: "Can I use my dog or cat?", a: "Yes, as photo 1. Your pet comes out of the fog with dusty fur and clouded eyes, races toward you, and in the sunny version knocks you over for a cuddle. Use a clear photo where the whole animal is visible." },
        { q: "Is it gory?", a: "No. The gun is never fired: the survivor lowers it and lets it drop. There is no blood and no biting. The infected look is ashen, veined skin and milky eyes on a face you still recognize, and the clip ends in a warm, laughing hug." },
        { q: "How long is it, and what shape?", a: "Thirteen seconds, vertical 9:16, with sound: a tense heartbeat that turns into a soft piano at the cut. It renders at 720p by default; you can drop to 480p or go up to 1080p." },
        { q: "How many credits does it cost?", a: "310 credits (≈ $0.78) at 480p, 645 (≈ $1.61) at 720p and 2,000 (≈ $5.00) at 1080p. 1 credit = $0.0025, so 400 credits = $1. The exact price shows on the Generate button before you start." },
        { q: "Will it look exactly like them?", a: "Close enough to tell who it is, but not pixel-perfect. Clear, front-facing photos keep the likeness best." },
        { q: "What is the AI zombie trend?", a: "A short-video format that went viral at the end of September. In a grey world after an outbreak, someone raises a gun at the person they love most, cannot shoot, and gets pulled into a hug as the clip cuts to a happier day." },
        { q: "Whose photos can I use?", a: "Adults and pets only, and only people who are happy to star in it. Clear, front-facing photos with the face fully visible work best." }
      ]
    };


    // =========================================================================
    // INITIALIZATION & HELPERS
    // =========================================================================
    function showToast(message, type) {
      var container = document.getElementById('toast-container');
      if (!container) return;
      var toast = document.createElement('div');
      var bgClass = type === 'error' ? 'bg-rose-600' : 'bg-zinc-900 dark:bg-zinc-100 dark:text-zinc-900 text-white';
      toast.className = 'zc-toast ' + bgClass;
      toast.textContent = message;
      container.appendChild(toast);
      setTimeout(function() {
        toast.style.opacity = '0';
        setTimeout(function() {
          if (toast.parentNode) toast.parentNode.removeChild(toast);
        }, 250);
      }, 2800);
    }

    function getAssembledPrompt() {
      var worldSetting = WORLD_MAP[appState.world].value;
      return BASE_PROMPT_TEMPLATE.replace('{setting}', worldSetting);
    }

    function updatePromptAndPriceUI() {
      if (typeof window !== 'undefined' && /(?:^|&)debug=1/.test(window.location.search) ) {
        var dbg = document.getElementById('live-prompt-card');
        if (dbg) dbg.classList.remove('hidden');
      }
      var promptBox = document.getElementById('live-prompt-box');
      if (promptBox) {
        promptBox.textContent = getAssembledPrompt();
      }
      var cost = TIER_PRICES[appState.resolution];
      var genBtnText = document.getElementById('generate-btn-text');
      if (genBtnText) {
        genBtnText.textContent = appState.lang === 'zh'
          ? ('立即生成视频 · ' + cost.toLocaleString() + ' 积分（≈ ' + creditsToUsd(cost) + '）')
          : ('Generate Video · ' + cost.toLocaleString() + ' credits (≈ ' + creditsToUsd(cost) + ')');
      }
      var worldLabel = document.getElementById('selected-world-label');
      if (worldLabel) {
        worldLabel.textContent = appState.lang === 'zh' ? WORLD_MAP[appState.world].zh : WORLD_MAP[appState.world].en;
      }
      var creditEl = document.getElementById('credit-balance-display');
      if (creditEl) {
        creditEl.textContent = appState.credits.toLocaleString();
      }
      updateApiSnippetUI();
    }

    // =========================================================================
    // PHOTO SLOTS & SAMPLE PRESETS
    // =========================================================================
    function makeAvatarDataUri(label, subLabel, bgHex, accentHex) {
      var svg = '<svg xmlns="http://www.w3.org/2000/svg" width="320" height="320" viewBox="0 0 320 320">' +
        '<defs><linearGradient id="g" x1="0" y1="0" x2="1" y2="1"><stop offset="0%" stop-color="' + bgHex + '"/><stop offset="100%" stop-color="' + accentHex + '"/></linearGradient></defs>' +
        '<rect width="320" height="320" fill="url(#g)"/>' +
        '<circle cx="160" cy="118" r="54" fill="rgba(255,255,255,0.2)"/>' +
        '<path d="M70 280 C70 215 250 215 250 280 Z" fill="rgba(255,255,255,0.2)"/>' +
        '<text x="160" y="132" font-family="Inter,sans-serif" font-size="44" text-anchor="middle" fill="#fff">' + label + '</text>' +
        '<text x="160" y="255" font-family="Inter,sans-serif" font-size="20" font-weight="bold" text-anchor="middle" fill="#fff">' + subLabel + '</text>' +
        '</svg>';
      return 'data:image/svg+xml;utf8,' + encodeURIComponent(svg);
    }

    function renderSlotUI(slotNum) {
      var slot = slotNum === 1 ? appState.slot1 : appState.slot2;
      var emptyEl = document.getElementById('slot-' + slotNum + '-empty');
      var imgEl = document.getElementById('slot-' + slotNum + '-preview');
      var badgeEl = document.getElementById('slot-' + slotNum + '-badge');
      var clearBtn = document.getElementById('clear-slot-' + slotNum);

      if (slot.loaded && slot.src) {
        emptyEl.classList.add('hidden');
        imgEl.src = slot.src;
        imgEl.classList.remove('hidden');
        badgeEl.textContent = slot.name;
        badgeEl.classList.remove('hidden');
        clearBtn.classList.remove('hidden');
      } else {
        emptyEl.classList.remove('hidden');
        imgEl.src = '';
        imgEl.classList.add('hidden');
        badgeEl.classList.add('hidden');
        clearBtn.classList.add('hidden');
      }
    }

    function handleFileUpload(slotNum, inputEl) {
      if (!inputEl.files || !inputEl.files[0]) return;
      var file = inputEl.files[0];
      var reader = new FileReader();
      reader.onload = function(e) {
        var targetSlot = slotNum === 1 ? appState.slot1 : appState.slot2;
        compressImage(e.target.result, 1280, 0.82).then(function(dataUri) {
          targetSlot.loaded = true;
          targetSlot.name = file.name;
          targetSlot.src = dataUri;
          targetSlot.imageUrl = ''; // 提交时由 /api/ai/uploads 换成公网 URL
          renderSlotUI(slotNum);
          showToast(slotNum === 1 ? t('uploadedPhoto1') : t('uploadedPhoto2'));
        });
      };
      reader.readAsDataURL(file);
    }

    // 手机原图动辄 5-10MB，Vercel Serverless 请求体上限 4.5MB —— 先压到长边 1280 / JPEG 0.82
    function compressImage(dataUri, maxSide, quality) {
      return new Promise(function(resolve) {
        if (!/^data:image\//.test(dataUri)) { resolve(dataUri); return; }
        var img = new Image();
        img.onload = function() {
          try {
            var scale = Math.min(1, (maxSide || 1280) / Math.max(img.width, img.height));
            var cw = Math.max(1, Math.round(img.width * scale));
            var ch = Math.max(1, Math.round(img.height * scale));
            var canvas = document.createElement('canvas');
            canvas.width = cw;
            canvas.height = ch;
            canvas.getContext('2d').drawImage(img, 0, 0, cw, ch);
            resolve(canvas.toDataURL('image/jpeg', quality || 0.82));
          } catch (err) {
            resolve(dataUri);
          }
        };
        img.onerror = function() { resolve(dataUri); };
        img.src = dataUri;
      });
    }

    function clearPhotoSlot(slotNum) {
      var targetSlot = slotNum === 1 ? appState.slot1 : appState.slot2;
      targetSlot.loaded = false;
      targetSlot.name = '';
      targetSlot.src = '';
      targetSlot.imageUrl = '';
      var fileInput = document.getElementById('file-input-' + slotNum);
      if (fileInput) fileInput.value = '';
      renderSlotUI(slotNum);
    }

    function swapPhotoSlots() {
      var temp = {
        loaded: appState.slot1.loaded,
        name: appState.slot1.name,
        src: appState.slot1.src
      };
      appState.slot1 = {
        loaded: appState.slot2.loaded,
        name: appState.slot2.name,
        src: appState.slot2.src
      };
      appState.slot2 = temp;
      renderSlotUI(1);
      renderSlotUI(2);
      showToast(appState.lang === 'zh' ? '已互换角色顺序：第 1 张为被感染者，第 2 张为幸存者' : 'Swapped Photo 1 & Photo 2 roles');
    }

    function fillSamplePhotos(mode) {
      if (mode === 'pet') {
        appState.slot1 = {
          loaded: true,
          name: t('sampleDogSlot'),
          src: makeAvatarDataUri('🐕', t('sampleDog'), '#d97706', '#78350f')
        };
        appState.slot2 = {
          loaded: true,
          name: t('sampleOwnerSlot'),
          src: makeAvatarDataUri('🧑', t('sampleOwner'), '#059669', '#064e3b')
        };
        selectWorld('snow');
        showToast(appState.lang === 'zh' ? '已填入「萌宠雪中小镇」示例照片' : 'Loaded Pet Sample Photos');
      } else {
        appState.slot1 = {
          loaded: true,
          name: t('samplePartnerSlot'),
          src: makeAvatarDataUri('👩', t('samplePartner'), '#e11d48', '#4c0519')
        };
        appState.slot2 = {
          loaded: true,
          name: t('sampleSurvivorSlot'),
          src: makeAvatarDataUri('👨', t('sampleSurvivor'), '#2563eb', '#1e3a8a')
        };
        renderSlotUI(1);
        renderSlotUI(2);
        showToast(appState.lang === 'zh' ? '已填入「情侣重逢」示例照片' : 'Loaded Couple Sample Photos');
        return;
      }
      renderSlotUI(1);
      renderSlotUI(2);
    }

    function applyExamplePreset(index) {
      if (index === 0) {
        fillSamplePhotos('couple');
        selectWorld('city');
      } else if (index === 1) {
        fillSamplePhotos('pet');
        selectWorld('snow');
      } else {
        fillSamplePhotos('couple');
        selectWorld('highway');
      }
      showToast(appState.lang === 'zh' ? '已套用该场景与示例照片，点击左下角「立即生成」即可体验！' : 'Preset applied! Click Generate on the left panel.');
    }

    // =========================================================================
    // WORLD & RESOLUTION SELECTORS
    // =========================================================================
    function selectWorld(worldKey) {
      appState.world = worldKey;
      var keys = ['city', 'snow', 'highway'];
      for (var i = 0; i < keys.length; i++) {
        var k = keys[i];
        var btn = document.getElementById('world-btn-' + k);
        if (!btn) continue;
        if (k === worldKey) {
          btn.className = 'zc-world is-active';
        } else {
          btn.className = 'zc-world';
        }
      }
      updatePromptAndPriceUI();
    }

    function selectResolution(resKey) {
      appState.resolution = resKey;
      var keys = ['480p', '720p', '1080p'];
      for (var i = 0; i < keys.length; i++) {
        var k = keys[i];
        var btn = document.getElementById('res-btn-' + k);
        if (!btn) continue;
        if (k === resKey) {
          btn.className = 'zc-res is-active';
        } else {
          btn.className = 'zc-res';
        }
      }
      updatePromptAndPriceUI();
    }

    // =========================================================================
    // GENERATION WORKFLOW & WORKS GALLERY
    // =========================================================================
    var activeGenInterval = null;

    // 真实后端开关：Vercel 上配置好 FAL_KEY / ATLAS_KEY / INTERNAL_SECRET 后改成 true
    // （未配置密钥时保持 false，线上会以演示模式运行，不会给用户报后端错误）
    var BACKEND = {
      enabled: false,
      pollIntervalMs: 5000,
      maxWaitMs: 8 * 60 * 1000
    };

    function startZombieGeneration() {
      if (!appState.slot1.loaded || !appState.slot2.loaded) {
        fillSamplePhotos('couple');
        showToast(appState.lang === 'zh' ? '已自动为你补齐示例照片并开始生成！' : 'Auto-filled sample photos and started generation!');
      }

      var cost = TIER_PRICES[appState.resolution];
      if (appState.credits < cost) {
        openTopupModal(cost - appState.credits);
        showToast(appState.lang === 'zh' ? ('积分不足（还差 ' + (cost - appState.credits) + ' 积分），请选择一个积分包') : ('Insufficient credits, need ' + (cost - appState.credits) + ' more — pick a credit pack'), 'error');
        return;
      }

      appState.credits -= cost;
      updatePromptAndPriceUI();
      switchRightTab('works');

      var progCard = document.getElementById('generation-progress-card');
      progCard.classList.remove('hidden');

      if (activeGenInterval) clearInterval(activeGenInterval);

      if (BACKEND.enabled && appState.apiEndpoint) {
        submitRealGeneration(cost);
      } else {
        runDemoGeneration(cost);
      }
    }

    function runDemoGeneration(cost) {
      var progCard = document.getElementById('generation-progress-card');
      var progBar = document.getElementById('gen-progress-bar');
      var timerBadge = document.getElementById('gen-timer-badge');
      progCard.classList.remove('hidden');

      if (activeGenInterval) clearInterval(activeGenInterval);
      var pct = 5;

      activeGenInterval = setInterval(function() {
        pct += 4;
        if (pct > 100) pct = 100;
        progBar.style.width = pct + '%';
        timerBadge.textContent = pct + '%';

        // Highlight current shot step
        var activeStep = pct < 25 ? 1 : (pct < 55 ? 2 : (pct < 82 ? 3 : 4));
        for (var s = 1; s <= 4; s++) {
          var stepEl = document.getElementById('step-ind-' + s);
          if (!stepEl) continue;
          if (s === activeStep) {
            stepEl.className = 'zc-advice zc-advice--warn';
          } else if (s < activeStep) {
            stepEl.className = 'zc-advice zc-advice--ok';
          } else {
            stepEl.className = 'zc-advice';
          }
        }

        if (pct >= 100) {
          clearInterval(activeGenInterval);
          activeGenInterval = null;
          setTimeout(function() {
            progCard.classList.add('hidden');
            var wInfo = WORLD_MAP[appState.world];
            var newWork = {
              id: 'work-' + Date.now(),
              title: wInfo[appState.lang] + ' · ' + appState.slot1.name.split(' ')[0] + ' & ' + appState.slot2.name.split(' ')[0],
              worldKey: appState.world,
              worldLabel: wInfo[appState.lang],
              resolution: appState.resolution,
              creditsCost: cost,
              role1: appState.slot1.name,
              role2: appState.slot2.name,
              coverSrc: wInfo.cover,
              createdAt: t('createdGenerated')
            };
            appState.works.unshift(newWork);
            renderWorksGrid();
            showToast(appState.lang === 'zh' ? '🎉 13 秒僵尸重逢短片已生成完毕！' : '🎉 13s Zombie Love Story generated!');
            openPreviewModalByWork(0);
          }, 350);
        }
      }, 180);
    }

    function submitRealGeneration(cost) {
      var statusTitle = document.getElementById('gen-status-title');
      if (statusTitle) {
        statusTitle.textContent = appState.lang === 'zh' ? '正在上传照片…' : 'Uploading photos…';
      }

      ensureUploadedImages().then(function(ok) {
        if (!ok) {
          refundCredits(cost);
          hideProgressCard();
          showToast(appState.lang === 'zh' ? '照片上传失败，已退回积分' : 'Photo upload failed, credits refunded', 'error');
          return;
        }
        if (statusTitle) {
          statusTitle.textContent = appState.lang === 'zh' ? '已提交渲染任务，排队中…' : 'Job submitted, queued…';
        }
        postGenerationJob(cost);
      });
    }

    function uploadsEndpoint() {
      return String(appState.apiEndpoint).replace(/templates\/?$/, 'uploads');
    }

    function ensureUploadedImages() {
      var jobs = [];
      [1, 2].forEach(function(n) {
        var slot = n === 1 ? appState.slot1 : appState.slot2;
        // 示例图本来就是 http(s) 资源，不用上传；只有本地上传的 data URI 需要换 URL
        if (slot.src && /^data:image\//.test(slot.src) && !slot.imageUrl) {
          jobs.push(uploadSlotImage(slot));
        }
      });
      if (!jobs.length) return Promise.resolve(true);
      return Promise.all(jobs).then(function(results) {
        return results.every(Boolean);
      }).catch(function() { return false; });
    }

    function uploadSlotImage(slot) {
      return fetch(uploadsEndpoint(), {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ images: [slot.src] })
      }).then(function(res) { return res.json(); }).then(function(data) {
        if (data && data.ok && data.urls && data.urls[0]) {
          slot.imageUrl = data.urls[0];
          return true;
        }
        console.warn('upload failed:', data && data.error);
        return false;
      }).catch(function(e) {
        console.warn('upload error:', e && e.message);
        return false;
      });
    }

    function postGenerationJob(cost) {
      fetch(appState.apiEndpoint, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(buildGenerationPayload())
      }).then(function (res) {
        if (!res.ok) {
          var err = new Error('HTTP ' + res.status);
          err.httpStatus = res.status;
          throw err;
        }
        return res.json();
      }).then(function (job) {
        if (!job || !job.ok || !job.statusUrl) {
          throw new Error((job && job.error) || 'bad response from backend');
        }
        startJobPolling(job, cost);
      }).catch(function (e) {
        refundCredits(cost);
        if (e && (e.httpStatus === 404 || e.httpStatus === 405 || e.httpStatus === 501)) {
          // 后端还没部署：静默回落到演示模式
          runDemoGeneration(cost);
          return;
        }
        showToast(appState.lang === 'zh'
          ? ('提交失败，已退回积分：' + (e && e.message ? e.message : ''))
          : ('Submit failed, credits refunded: ' + (e && e.message ? e.message : '')), 'error');
        hideProgressCard();
      });
    }

    function hideProgressCard() {
      var progCard = document.getElementById('generation-progress-card');
      if (progCard) progCard.classList.add('hidden');
    }

    function startJobPolling(job, cost) {
      var started = Date.now();
      var progBar = document.getElementById('gen-progress-bar');
      var timerBadge = document.getElementById('gen-timer-badge');
      var statusTitle = document.getElementById('gen-status-title');

      function tick() {
        fetch(job.statusUrl).then(function (r) { return r.json(); }).then(function (s) {
          var elapsed = Math.round((Date.now() - started) / 1000);
          if (timerBadge) timerBadge.textContent = elapsed + 's';
          if (progBar) {
            var pct = Math.min(92, 8 + Math.round(elapsed / 90 * 84));
            progBar.style.width = pct + '%';
          }
          if (s && s.state === 'succeeded' && s.videoUrl) {
            if (progBar) progBar.style.width = '100%';
            finishRealGeneration(job, s, cost);
            return;
          }
          if (s && (s.state === 'failed') || Date.now() - started > BACKEND.maxWaitMs) {
            failRealGeneration(cost);
            return;
          }
          setTimeout(tick, BACKEND.pollIntervalMs);
        }).catch(function () {
          if (Date.now() - started > BACKEND.maxWaitMs) {
            failRealGeneration(cost);
            return;
          }
          setTimeout(tick, BACKEND.pollIntervalMs);
        });
      }

      if (statusTitle) {
        statusTitle.textContent = appState.lang === 'zh'
          ? ('渲染中 · ' + (job.model || job.provider))
          : ('Rendering · ' + (job.model || job.provider));
      }
      tick();
    }

    function finishRealGeneration(job, s, cost) {
      hideProgressCard();
      var wInfo = WORLD_MAP[appState.world];
      var newWork = {
        id: 'work-' + Date.now(),
        title: wInfo[appState.lang] + ' · ' + appState.slot1.name.split(' ')[0] + ' & ' + appState.slot2.name.split(' ')[0],
        worldKey: appState.world,
        worldLabel: wInfo[appState.lang],
        resolution: appState.resolution,
        creditsCost: cost,
        role1: appState.slot1.name,
        role2: appState.slot2.name,
        coverSrc: wInfo.cover,
        videoUrl: s.videoUrl,
        provider: job.provider,
        modelLabel: job.model,
        createdAt: t('createdGenerated')
      };
      appState.works.unshift(newWork);
      renderWorksGrid();
      showToast(appState.lang === 'zh' ? '🎉 13 秒僵尸重逢短片已生成完毕！' : '🎉 13s Zombie Love Story generated!');
      openPreviewModalByWork(0);
    }

    function failRealGeneration(cost) {
      hideProgressCard();
      refundCredits(cost);
      showToast(appState.lang === 'zh'
        ? '渲染失败，已按退款政策退回全部积分'
        : 'Render failed — full credit refund per our refund policy', 'error');
    }

    function refundCredits(amount) {
      appState.credits += amount;
      updatePromptAndPriceUI();
    }

    function renderWorksGrid() {
      var grid = document.getElementById('works-grid');
      var badge = document.getElementById('works-count-badge');
      if (badge) badge.textContent = String(appState.works.length);
      if (!grid) return;

      var html = '';
      for (var i = 0; i < appState.works.length; i++) {
        var w = appState.works[i];
        html +=
          '<div class="rounded-2xl border border-[var(--color-border)] bg-[var(--color-surface)] overflow-hidden shadow-sm flex flex-col sm:flex-row gap-3 p-3">' +
            '<button type="button" onclick="openPreviewModalByWork(' + i + ')" class="relative w-full sm:w-36 aspect-[9/16] rounded-xl overflow-hidden bg-zinc-900 shrink-0 group">' +
              '<img src="' + w.coverSrc + '" alt="' + w.title + '" class="w-full h-full object-cover group-hover:scale-105 transition-transform" />' +
              '<div class="absolute inset-0 bg-black/35 flex items-center justify-center">' +
                '<div class="w-10 h-10 rounded-full bg-rose-500 text-white flex items-center justify-center shadow-lg">' +
                  '<svg xmlns="http://www.w3.org/2000/svg" class="w-4 h-4 ml-0.5" viewBox="0 0 24 24" fill="currentColor"><polygon points="5 3 19 12 5 21 5 3"/></svg>' +
                '</div>' +
              '</div>' +
              '<span class="absolute bottom-2 right-2 px-1.5 py-0.5 rounded bg-black/75 text-white text-[10px] font-mono">00:13</span>' +
            '</button>' +
            '<div class="flex-1 flex flex-col justify-between py-1">' +
              '<div class="space-y-1.5">' +
                '<div class="flex items-center gap-1.5">' +
                  '<span class="px-2 py-0.5 rounded bg-rose-500/15 text-rose-400 text-[10px] font-bold">' + w.resolution + '</span>' +
                  '<span class="text-[11px] text-[var(--color-text-muted)]">' + w.createdAt + '</span>' +
                '</div>' +
                '<h3 class="text-sm font-bold text-[var(--color-text)]">' + w.title + '</h3>' +
                '<p class="text-xs text-[var(--color-text-muted)]">🧟 @Image1: ' + w.role1 + '</p>' +
                '<p class="text-xs text-[var(--color-text-muted)]">🔫 @Image2: ' + w.role2 + '</p>' +
              '</div>' +
              '<div class="pt-3 flex flex-wrap items-center gap-2">' +
                '<button type="button" onclick="openPreviewModalByWork(' + i + ')" class="px-3 py-1.5 rounded-lg bg-rose-500 hover:bg-rose-600 text-white text-xs font-bold transition-colors">' +
                  t('playClip') +
                '</button>' +
                '<button type="button" onclick="downloadStoryboardJson()" class="px-3 py-1.5 rounded-lg border border-[var(--color-border)] hover:bg-[var(--color-surface-hover)] text-xs font-medium transition-colors">' +
                  t('downloadPack') +
                '</button>' +
              '</div>' +
            '</div>' +
          '</div>';
      }
      grid.innerHTML = html;
    }

    // =========================================================================
    // INTERACTIVE 13-SECOND 4-SHOT CINEMA PLAYER & WEB AUDIO SYNTHESIS
    // =========================================================================
    function ensureAudioContext() {
      if (!appState.player.audioCtx) {
        var AudioContextClass = window.AudioContext || window.webkitAudioContext;
        if (AudioContextClass) {
          appState.player.audioCtx = new AudioContextClass();
        }
      }
      if (appState.player.audioCtx && appState.player.audioCtx.state === 'suspended') {
        appState.player.audioCtx.resume();
      }
    }

    function playHeartbeatSound() {
      if (appState.player.isMuted) return;
      ensureAudioContext();
      var ctx = appState.player.audioCtx;
      if (!ctx) return;

      var now = ctx.currentTime;
      // Double thump lub-dub heartbeat
      var offsets = [0, 0.22];
      for (var i = 0; i < offsets.length; i++) {
        var osc = ctx.createOscillator();
        var gain = ctx.createGain();
        osc.type = 'sine';
        var start = now + offsets[i];
        osc.frequency.setValueAtTime(i === 0 ? 65 : 52, start);
        osc.frequency.exponentialRampToValueAtTime(28, start + 0.16);
        gain.gain.setValueAtTime(0.001, start);
        gain.gain.linearRampToValueAtTime(i === 0 ? 0.28 : 0.18, start + 0.02);
        gain.gain.exponentialRampToValueAtTime(0.001, start + 0.18);
        osc.connect(gain);
        gain.connect(ctx.destination);
        osc.start(start);
        osc.stop(start + 0.19);
      }
    }

    function playWarmPianoChord() {
      if (appState.player.isMuted) return;
      ensureAudioContext();
      var ctx = appState.player.audioCtx;
      if (!ctx) return;

      var now = ctx.currentTime;
      // Warm Fmaj7 -> Cmaj7 arpeggio notes
      var notes = [261.63, 329.63, 392.00, 493.88, 523.25];
      for (var i = 0; i < notes.length; i++) {
        var osc = ctx.createOscillator();
        var gain = ctx.createGain();
        osc.type = 'triangle';
        var start = now + i * 0.18;
        osc.frequency.setValueAtTime(notes[i], start);
        gain.gain.setValueAtTime(0.001, start);
        gain.gain.linearRampToValueAtTime(0.12, start + 0.04);
        gain.gain.exponentialRampToValueAtTime(0.0008, start + 2.2);
        osc.connect(gain);
        gain.connect(ctx.destination);
        osc.start(start);
        osc.stop(start + 2.3);
      }
    }

    function openPreviewModal(exampleIndex) {
      var worldKeys = ['city', 'snow', 'highway'];
      var wKey = worldKeys[exampleIndex] || 'city';
      var wInfo = WORLD_MAP[wKey];

      document.getElementById('player-main-img').src = wInfo.cover;
      document.getElementById('player-modal-title').textContent = wInfo[appState.lang] + t('playerSubtitle');
      document.getElementById('player-role1-name').textContent = exampleIndex === 1 ? t('sampleDog') : t('roleInfected');
      document.getElementById('player-role2-name').textContent = t('roleSurvivorYou');
      document.getElementById('player-meta-badge').textContent = appState.resolution + ' · 9:16 · Seedance V2.5';

      var modal = document.getElementById('cinema-modal');
      modal.classList.remove('hidden');
      appState.player.isOpen = true;
      appState.player.currentTime = 0;
      appState.player.lastBeatTime = -1;
      appState.player.pianoPlayed = false;
      updatePlayerVisualState(0);
      startPlayerLoop();
    }

    function openPreviewModalByWork(workIndex) {
      var w = appState.works[workIndex] || appState.works[0];
      document.getElementById('player-main-img').src = w.coverSrc;
      document.getElementById('player-modal-title').textContent = w.title;
      document.getElementById('player-role1-name').textContent = w.role1;
      document.getElementById('player-role2-name').textContent = w.role2;
      document.getElementById('player-meta-badge').textContent =
        w.resolution + ' · 9:16 · ' + (w.modelLabel || (w.provider === 'atlas' ? 'Atlas Cloud' : 'fal.ai'));

      var modal = document.getElementById('cinema-modal');
      modal.classList.remove('hidden');
      appState.player.isOpen = true;
      appState.player.currentTime = 0;
      appState.player.lastBeatTime = -1;
      appState.player.pianoPlayed = false;
      var videoEl = ensureRealVideoEl();
      var hasVideo = !!(w.videoUrl && videoEl);
      if (hasVideo) {
        videoEl.src = w.videoUrl;
        videoEl.classList.remove('hidden');
        var p = videoEl.play();
        if (p && p.catch) p.catch(function () {});
      } else if (videoEl) {
        videoEl.pause();
        videoEl.removeAttribute('src');
        videoEl.classList.add('hidden');
      }
      toggleClass(document.getElementById('player-main-img'), 'hidden', hasVideo);
      toggleClass(document.getElementById('player-fog-overlay'), 'hidden', hasVideo);
      toggleClass(document.getElementById('player-warm-overlay'), 'hidden', hasVideo);
      toggleClass(document.getElementById('player-flash-overlay'), 'hidden', hasVideo);

      if (hasVideo) {
        stopPlayerLoop();
        return;
      }

      updatePlayerVisualState(0);
      startPlayerLoop();
    }

    function toggleClass(el, cls, force) {
      if (!el) return;
      if (el.classList.toggle.length > 1) {
        el.classList.toggle(cls, !!force);
      } else if (force) {
        el.classList.add(cls);
      } else {
        el.classList.remove(cls);
      }
    }

    function ensureRealVideoEl() {
      var el = document.getElementById('cinema-real-video');
      if (el) return el;
      var stage = document.getElementById('player-main-img');
      if (!stage || !stage.parentNode) return null;
      el = document.createElement('video');
      el.id = 'cinema-real-video';
      el.className = 'zc-player-video hidden';
      el.setAttribute('controls', '');
      el.setAttribute('playsinline', '');
      el.setAttribute('preload', 'metadata');
      stage.parentNode.insertBefore(el, stage);
      return el;
    }

    function closePreviewModal() {
      stopPlayerLoop();
      var v = document.getElementById('cinema-real-video');
      if (v) { v.pause(); v.classList.add('hidden'); v.removeAttribute('src'); }
      var modal = document.getElementById('cinema-modal');
      if (modal) modal.classList.add('hidden');
      appState.player.isOpen = false;
    }

    function startPlayerLoop() {
      stopPlayerLoop();
      appState.player.isPlaying = true;
      document.getElementById('player-playpause-icon').textContent = '⏸';

      appState.player.timerId = setInterval(function() {
        var t = +(appState.player.currentTime + 0.1).toFixed(1);
        if (t > 13.0) {
          t = 0;
          appState.player.lastBeatTime = -1;
          appState.player.pianoPlayed = false;
        }
        appState.player.currentTime = t;
        updatePlayerVisualState(t);
      }, 100);
    }

    function stopPlayerLoop() {
      if (appState.player.timerId) {
        clearInterval(appState.player.timerId);
        appState.player.timerId = null;
      }
      appState.player.isPlaying = false;
      var icon = document.getElementById('player-playpause-icon');
      if (icon) icon.textContent = '▶';
    }

    function togglePlayPause() {
      if (appState.player.isPlaying) {
        stopPlayerLoop();
      } else {
        startPlayerLoop();
      }
    }

    function togglePlayerAudio() {
      appState.player.isMuted = !appState.player.isMuted;
      document.getElementById('player-audio-icon').textContent = appState.player.isMuted ? '🔇' : '🔊';
      document.getElementById('player-audio-label').textContent = appState.player.isMuted ? t('muted') : t('audioScore');
    }

    function scrubPlayer(val) {
      var t = parseFloat(val) || 0;
      appState.player.currentTime = t;
      appState.player.lastBeatTime = -1;
      appState.player.pianoPlayed = false;
      updatePlayerVisualState(t);
    }

    function updatePlayerVisualState(t) {
      var scrubber = document.getElementById('player-scrubber');
      var timeLabel = document.getElementById('player-time-label');
      var shotPill = document.getElementById('player-shot-pill');
      var caption = document.getElementById('player-shot-caption');
      var fogOverlay = document.getElementById('player-fog-overlay');
      var warmOverlay = document.getElementById('player-warm-overlay');
      var flashOverlay = document.getElementById('player-flash-overlay');
      var mainImg = document.getElementById('player-main-img');

      if (scrubber) scrubber.value = t;
      if (timeLabel) timeLabel.textContent = t.toFixed(1) + ' / 13.0s';

      var shotIndex = t < 2.0 ? 1 : (t < 6.0 ? 2 : (t < 10.0 ? 3 : 4));

      // Trigger heartbeat every ~1.2s in shots 1-3, or warm piano at 10.0s
      if (appState.player.isPlaying) {
        if (t < 9.8 && (t - appState.player.lastBeatTime >= 1.2 || appState.player.lastBeatTime < 0)) {
          appState.player.lastBeatTime = t;
          playHeartbeatSound();
        } else if (t >= 10.0 && !appState.player.pianoPlayed) {
          appState.player.pianoPlayed = true;
          playWarmPianoChord();
        }
      }

      // Flash cut at 9.9-10.2s
      if (t >= 9.9 && t <= 10.2) {
        flashOverlay.style.opacity = '0.85';
      } else {
        flashOverlay.style.opacity = '0';
      }

      // Update Shot Pill, Caption & Visual Filters
      if (shotIndex === 1) {
        shotPill.textContent = t('shot1Pill');
        shotPill.className = 'zc-badge zc-badge--onmedia';
        caption.textContent = t('shot1Caption');
        fogOverlay.style.opacity = '0.65';
        warmOverlay.style.opacity = '0';
        mainImg.style.filter = 'grayscale(45%) contrast(1.08)';
      } else if (shotIndex === 2) {
        shotPill.textContent = t('shot2Pill');
        shotPill.className = 'zc-badge zc-badge--onmedia';
        caption.textContent = t('shot2Caption');
        fogOverlay.style.opacity = '0.55';
        warmOverlay.style.opacity = '0';
        mainImg.style.filter = 'grayscale(35%) contrast(1.05)';
      } else if (shotIndex === 3) {
        shotPill.textContent = t('shot3Pill');
        shotPill.className = 'zc-badge zc-badge--onmedia';
        caption.textContent = t('shot3Caption');
        fogOverlay.style.opacity = '0.4';
        warmOverlay.style.opacity = '0.15';
        mainImg.style.filter = 'grayscale(20%)';
      } else {
        shotPill.textContent = t('shot4Pill');
        shotPill.className = 'zc-badge zc-badge--onmedia zc-usecase__time--amber';
        caption.textContent = t('shot4Caption');
        fogOverlay.style.opacity = '0';
        warmOverlay.style.opacity = '0.85';
        mainImg.style.filter = 'saturate(1.25) brightness(1.06)';
      }

      for (var i = 1; i <= 4; i++) {
        var btn = document.getElementById('modal-shot-btn-' + i);
        if (!btn) continue;
        if (i === shotIndex) {
          btn.className = 'zc-advice zc-advice--warn';
        } else {
          btn.className = 'zc-advice';
        }
      }
    }

    // =========================================================================
    // TABS, FAQ ACCORDIONS, TOP-UP & API MODALS
    // =========================================================================
    function switchRightTab(tabName) {
      var panelTut = document.getElementById('panel-tutorial');
      var panelWorks = document.getElementById('panel-works');
      var btnTut = document.getElementById('tab-btn-tutorial');
      var btnWorks = document.getElementById('tab-btn-works');

      if (tabName === 'works') {
        panelTut.classList.add('hidden');
        panelWorks.classList.remove('hidden');
        btnWorks.className = 'zc-tab is-active';
        btnTut.className = 'zc-tab';
      } else {
        panelWorks.classList.add('hidden');
        panelTut.classList.remove('hidden');
        btnTut.className = 'zc-tab is-active';
        btnWorks.className = 'zc-tab';
      }
    }

    function scrollToSection(secId) {
      switchRightTab('tutorial');
      setTimeout(function() {
        var el = document.getElementById(secId);
        if (el) el.scrollIntoView({ behavior: 'smooth', block: 'start' });
      }, 60);
    }

    function renderFaqs() {
      var container = document.getElementById('faq-list-container');
      if (!container) return;
      var list = FAQS_DATA[appState.lang] || FAQS_DATA.zh;
      var html = '';
      for (var i = 0; i < list.length; i++) {
        var item = list[i];
        var openAttr = appState.allFaqsOpen ? ' open' : '';
        html +=
          '<details class="group overflow-hidden rounded-xl border border-[var(--color-border)] bg-[var(--color-surface)] open:bg-[var(--color-surface-elevated)] transition-colors"' + openAttr + '>' +
            '<summary class="cursor-pointer list-none flex items-center justify-between gap-3 hover:bg-[var(--color-surface-hover)]/50 px-4 py-3.5">' +
              '<span class="font-semibold text-sm sm:text-[15px] text-[var(--color-text)]">' + item.q + '</span>' +
              '<span class="shrink-0 text-[var(--color-text-muted)] transition-transform group-open:rotate-45 text-xl leading-none">+</span>' +
            '</summary>' +
            '<p class="text-xs sm:text-sm leading-relaxed text-[var(--color-text-muted)] px-4 pb-4">' + item.a + '</p>' +
          '</details>';
      }
      container.innerHTML = html;
    }

    function toggleAllFaqs() {
      appState.allFaqsOpen = !appState.allFaqsOpen;
      renderFaqs();
      var btn = document.getElementById('toggle-all-faqs-btn');
      if (btn) {
        btn.textContent = appState.allFaqsOpen
          ? (appState.lang === 'zh' ? '全部收起' : 'Collapse All')
          : (appState.lang === 'zh' ? '全部展开' : 'Expand All');
      }
    }

    function openTopupModal(neededCredits) {
      document.getElementById('topup-modal').classList.remove('hidden');
      highlightCreditPack(neededCredits);
    }

    // 购买单位是积分包：余额不足时高亮“够用的最小包”
    function highlightCreditPack(neededCredits) {
      var packs = [2000, 5500, 13000];
      var picked = 0;
      packs.forEach(function (amount) {
        var el = document.getElementById('pack-card-' + amount);
        if (!el) return;
        var fit = !!neededCredits && !picked && amount >= neededCredits;
        if (fit) picked = amount;
        el.classList.toggle('zc-pack--recommended', fit);
      });
      var note = document.getElementById('topup-needed-note');
      if (note && neededCredits) {
        note.textContent = appState.lang === 'zh'
          ? ('本次还差 ' + neededCredits.toLocaleString() + ' 积分，选一个积分包即可继续')
          : ('You need ' + neededCredits.toLocaleString() + ' more credits — pick a pack to continue');
        note.classList.remove('hidden');
      } else if (note) {
        note.classList.add('hidden');
      }
    }

    function closeTopupModal() {
      document.getElementById('topup-modal').classList.add('hidden');
    }

    // 真实收款：填入 Stripe Payment Link 后自动跳转；留空则是演示模式（直接加积分）
    var STRIPE_PAYMENT_LINKS = {
      // '2000': 'https://buy.stripe.com/xxxx_starter',
      // '5500': 'https://buy.stripe.com/xxxx_popular',
      // '13000': 'https://buy.stripe.com/xxxx_pro'
    };

    function purchaseCredits(amount, priceLabel) {
      var link = STRIPE_PAYMENT_LINKS[String(amount)];
      if (link) {
        closeTopupModal();
        window.open(link, '_blank', 'noopener');
        return;
      }
      appState.credits += amount;
      updatePromptAndPriceUI();
      closeTopupModal();
      showToast(appState.lang === 'zh'
        ? ('🎉 充值成功 (' + priceLabel + ')！已到账 +' + amount.toLocaleString() + ' 积分')
        : ('🎉 Top-up successful (' + priceLabel + ')! +' + amount.toLocaleString() + ' credits added'));
    }

    function slotImageUrl(slot, fallback) {
      // 真实渲染需要公网可访问的 URL；本地上传的 data: URI 需先经上传接口换取 URL
      if (slot && slot.imageUrl) return slot.imageUrl;
      if (slot && slot.src && /^(https?:)?\/\//.test(slot.src)) return slot.src;
      if (slot && slot.name && /^(https?:)?\/\//.test(slot.name)) return slot.name;
      return fallback;
    }

    function buildGenerationPayload() {
      return {
        domain: "zombie-couple.xyz",
        templateSlug: "zombie-love-story",
        interfaceId: "dea38f30-c9e1-47dd-be48-4648a7e59f99",
        model: "bytedance/seedance-v2.5-text-ref",
        params: {
          prompt: getAssembledPrompt(),
          duration: 13,
          aspect_ratio: "9:16",
          resolution: appState.resolution,
          generate_audio: true,
          setting: WORLD_MAP[appState.world].value,
          image_urls: [
            slotImageUrl(appState.slot1, "https://zombie-couple.xyz/uploads/photo1_infected.jpg"),
            slotImageUrl(appState.slot2, "https://zombie-couple.xyz/uploads/photo2_survivor.jpg")
          ]
        }
      };
    }

    function updateApiSnippetUI() {
      var codeEl = document.getElementById('api-code-preview');
      if (!codeEl) return;
      var payload = buildGenerationPayload();
      codeEl.textContent = "// POST " + appState.apiEndpoint + "\n" + JSON.stringify(payload, null, 2);
    }

    function openApiModal() {
      updateApiSnippetUI();
      document.getElementById('api-modal').classList.remove('hidden');
    }

    function closeApiModal() {
      document.getElementById('api-modal').classList.add('hidden');
    }

    function saveApiEndpoint() {
      var input = document.getElementById('custom-api-endpoint');
      if (input && input.value.trim()) {
        appState.apiEndpoint = input.value.trim();
        updateApiSnippetUI();
        showToast((appState.lang === 'zh' ? '已保存自定义 API 接口地址：' : 'Custom API endpoint saved: ') + appState.apiEndpoint);
      }
    }

    function copyTextWithFallback(text, successMsg) {
      if (navigator.clipboard && navigator.clipboard.writeText) {
        navigator.clipboard.writeText(text).then(function() {
          showToast(successMsg);
        }).catch(function() {
          fallbackCopy(text, successMsg);
        });
      } else {
        fallbackCopy(text, successMsg);
      }
    }

    function fallbackCopy(text, successMsg) {
      var ta = document.createElement('textarea');
      ta.value = text;
      ta.style.position = 'fixed';
      ta.style.opacity = '0';
      document.body.appendChild(ta);
      ta.select();
      try {
        document.execCommand('copy');
        showToast(successMsg);
      } catch (e) {
        showToast(t('copyFailed'), 'error');
      }
      document.body.removeChild(ta);
    }

    function copyCurrentPrompt() {
      copyTextWithFallback(getAssembledPrompt(), appState.lang === 'zh' ? '✅ 已复制完整四镜头英文 Prompt！' : '✅ Copied 4-shot system prompt!');
    }

    function copyApiSnippet() {
      var codeEl = document.getElementById('api-code-preview');
      if (codeEl) {
        copyTextWithFallback(codeEl.textContent, t('copiedJson'));
      }
    }

    function downloadCssFile() {
      var linkEl = document.getElementById('zombie-couple-stylesheet');
      var href = linkEl ? linkEl.getAttribute('href') : 'style.css';

      function saveText(cssContent) {
        var blob = new Blob([cssContent], { type: 'text/css;charset=utf-8' });
        var url = URL.createObjectURL(blob);
        var a = document.createElement('a');
        a.href = url;
        a.download = 'style.css';
        document.body.appendChild(a);
        a.click();
        document.body.removeChild(a);
        URL.revokeObjectURL(url);
        showToast(t('cssDownloaded'));
      }

      fetch(href).then(function (res) {
        if (!res.ok) { throw new Error('fetch css failed'); }
        return res.text();
      }).then(saveText).catch(function () {
        var a = document.createElement('a');
        a.href = href;
        a.download = 'style.css';
        document.body.appendChild(a);
        a.click();
        document.body.removeChild(a);
        showToast(t('cssDownloaded'));
      });
    }

    function downloadStoryboardJson() {
      var data = {
        site: "https://zombie-couple.xyz",
        template: "zombie-love-story",
        world: WORLD_MAP[appState.world],
        resolution: appState.resolution,
        creditsCost: TIER_PRICES[appState.resolution],
        prompt: getAssembledPrompt()
      };
      var blob = new Blob([JSON.stringify(data, null, 2)], { type: 'application/json' });
      var url = URL.createObjectURL(blob);
      var a = document.createElement('a');
      a.href = url;
      a.download = 'zombie-couple-' + appState.world + '-' + appState.resolution + '.json';
      document.body.appendChild(a);
      a.click();
      document.body.removeChild(a);
      URL.revokeObjectURL(url);
      showToast(t('jsonDownloaded'));
    }

    // =========================================================================
    // THEME SWITCHING
    // =========================================================================
    function toggleTheme() {
      var root = document.documentElement;
      if (root.classList.contains('dark')) {
        root.classList.remove('dark');
        appState.theme = 'light';
      } else {
        root.classList.add('dark');
        appState.theme = 'dark';
      }
      try {
        localStorage.setItem('zombie-couple-theme', appState.theme);
      } catch (e) {}
    }

    window.addEventListener('DOMContentLoaded', function() {
      try {
        var savedTheme = localStorage.getItem('zombie-couple-theme');
        if (savedTheme === 'light') {
          document.documentElement.classList.remove('dark');
          appState.theme = 'light';
        }
      } catch (e) {}

      renderFaqs();
      renderWorksGrid();
      updatePromptAndPriceUI();
    });
