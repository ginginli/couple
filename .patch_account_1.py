# -*- coding: utf-8 -*-
import io
p = '/Users/gingin/Desktop/1127/couple/couple/app.js'
s = io.open(p, encoding='utf-8').read()

# ---------- A. i18n 键 ----------
s = s.replace("        downloadVideo: 'Download video',",
              "        downloadVideo: 'Download video',\n        signInGoogle: 'Sign in with Google',\n        signOut: 'Sign out',\n        loginRequired: 'Please sign in with Google to generate',\n        billingNotConfigured: 'Top-up is not open yet - check back soon',\n        topupSuccess: 'Payment received - credits added',")
s = s.replace("        downloadVideo: '下载视频',",
              "        downloadVideo: '下载视频',\n        signInGoogle: '用 Google 登录',\n        signOut: '退出登录',\n        loginRequired: '请先登录再生成',\n        billingNotConfigured: '充值通道暂未开启，请稍后再来',\n        topupSuccess: '支付成功，积分已到账',")

# ---------- B. 账户模块 ----------
ACCOUNT = """
    // ======================= 账户体系 =======================
    // 登录用户的积分余额以服务端为准；未登录沿用本地演示余额
    var PACK_KEY_BY_CREDITS = { '2000': 'starter', '3000': 'popular', '20000': 'pro' };

    function syncAccount() {
      return fetch('/api/account/me', { credentials: 'same-origin' })
        .then(function (r) { return r.ok ? r.json() : null; })
        .then(function (data) {
          if (!data || !data.ok) return null;
          appState.user = data.user || null;
          appState.config = data.config || {};
          if (appState.user && typeof data.credits === 'number') {
            appState.credits = data.credits;
            updatePromptAndPriceUI();
          }
          renderAccountChip();
          if (appState.config && appState.config.googleClientId) loadGoogleIdentity();
          return appState.user;
        })
        .catch(function () { renderAccountChip(); return null; });
    }

    function loadGoogleIdentity() {
      if (window.google && window.google.accounts && window.google.accounts.id) {
        initGoogleIdentity();
        return;
      }
      if (document.getElementById('gis-script')) return;
      var sc = document.createElement('script');
      sc.id = 'gis-script';
      sc.src = 'https://accounts.google.com/gsi/client';
      sc.async = true;
      sc.defer = true;
      sc.onload = initGoogleIdentity;
      document.head.appendChild(sc);
    }

    function initGoogleIdentity() {
      if (!appState.config || !appState.config.googleClientId) return;
      if (!window.google || !window.google.accounts || !window.google.accounts.id) return;
      try {
        google.accounts.id.initialize({
          client_id: appState.config.googleClientId,
          callback: handleGoogleCredential,
          auto_select: false,
          cancel_on_tap_outside: true
        });
        appState.gisReady = true;
      } catch (e) { /* 忽略 */ }
    }

    function handleGoogleCredential(resp) {
      if (!resp || !resp.credential) return;
      fetch('/api/auth/google', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        credentials: 'same-origin',
        body: JSON.stringify({ idToken: resp.credential })
      }).then(function (r) { return r.json().then(function (j) { return { status: r.status, body: j }; }); })
        .then(function (res) {
          if (!res.body || !res.body.ok) {
            showToast(appState.lang === 'zh' ? '登录失败，请重试' : 'Sign-in failed, please retry', 'error');
            return;
          }
          appState.user = res.body.user;
          appState.credits = typeof res.body.credits === 'number' ? res.body.credits : appState.credits;
          updatePromptAndPriceUI();
          renderAccountChip();
          showToast(appState.lang === 'zh'
            ? ('\\u2705 已登录：' + (appState.user.email || appState.user.name))
            : ('\\u2705 Signed in as ' + (appState.user.email || appState.user.name)));
        })
        .catch(function () {
          showToast(appState.lang === 'zh' ? '登录失败，请重试' : 'Sign-in failed, please retry', 'error');
        });
    }

    function signInWithGoogle() {
      if (!appState.config || !appState.config.googleClientId) {
        showToast(t('billingNotConfigured'), 'error');
        return;
      }
      if (appState.gisReady && window.google && window.google.accounts) {
        google.accounts.id.prompt();
        return;
      }
      loadGoogleIdentity();
      setTimeout(function () {
        if (appState.gisReady && window.google && window.google.accounts) google.accounts.id.prompt();
      }, 800);
    }

    function signOut() {
      fetch('/api/auth/logout', { method: 'POST', credentials: 'same-origin' })
        .then(function () {})
        .catch(function () {})
        .then(function () {
          appState.user = null;
          renderAccountChip();
          showToast(appState.lang === 'zh' ? '已退出登录' : 'Signed out');
        });
    }

    function renderAccountChip() {
      var host = document.getElementById('account-chip');
      if (!host) return;
      if (appState.user) {
        var pic = appState.user.picture
          ? '<img src="' + appState.user.picture + '" alt="" class="w-6 h-6 rounded-full border border-[var(--color-border)]" />'
          : '<div class="w-6 h-6 rounded-full bg-rose-500/20 text-rose-400 flex items-center justify-center text-[11px] font-bold">'
            + String(appState.user.name || 'U').charAt(0).toUpperCase() + '</div>';
        host.innerHTML =
          '<div class="flex items-center gap-1.5">' + pic +
          '<span class="hidden sm:inline text-[11px] font-semibold text-[var(--color-text)] max-w-[120px] truncate">'
          + (appState.user.name || appState.user.email || '') + '</span>' +
          '<button type="button" onclick="signOut()" class="zc-chip">' + t('signOut') + '</button></div>';
      } else {
        host.innerHTML =
          '<button type="button" onclick="signInWithGoogle()" class="zc-chip zc-chip--primary">' + t('signInGoogle') + '</button>';
      }
    }

    function handleTopupReturn() {
      if (!/(?:\\?|&)topup=success(?:&|$)/.test(window.location.search)) return;
      syncAccount().then(function () {
        showToast(appState.lang === 'zh' ? ('\\uD83C\\uDF89 ' + t('topupSuccess')) : ('\\uD83C\\uDF89 ' + t('topupSuccess')));
      });
      try {
        var url = new URL(window.location.href);
        url.searchParams.delete('topup');
        window.history.replaceState({}, '', url.toString());
      } catch (e) { /* 老浏览器忽略 */ }
    }

"""
anchor = "    function purchaseCredits(amount, priceLabel) {"
assert s.count(anchor) == 1
s = s.replace(anchor, ACCOUNT + anchor)

# ---------- C. purchaseCredits：真实结账 ----------
start = s.index("    function purchaseCredits(amount, priceLabel) {")
end = s.index("    function slotImageUrl(slot, fallback) {")
new_pc = """    function purchaseCredits(amount, priceLabel) {
      var packKey = PACK_KEY_BY_CREDITS[String(amount)] || 'popular';

      if (!appState.user) {
        showToast(t('loginRequired'), 'error');
        signInWithGoogle();
        return;
      }
      if (appState.config && appState.config.billingEnabled === false) {
        showToast(t('billingNotConfigured'), 'error');
        return;
      }

      fetch('/api/billing/checkout', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        credentials: 'same-origin',
        body: JSON.stringify({ packKey: packKey })
      }).then(function (r) { return r.json().then(function (j) { return { status: r.status, body: j }; }); })
        .then(function (res) {
          if (res.status === 501 || (res.body && res.body.error === 'billing_not_configured')) {
            showToast(t('billingNotConfigured'), 'error');
            return;
          }
          if (res.body && res.body.ok && res.body.url) {
            closeTopupModal();
            window.location.href = res.body.url;
            return;
          }
          showToast((res.body && res.body.error) || 'checkout failed', 'error');
        })
        .catch(function () { showToast('checkout failed', 'error'); });
    }

"""
s = s[:start] + new_pc + s[end:]

io.open(p, 'w', encoding='utf-8').write(s)
print('app.js：账户模块 + 真实结账 已接入')
