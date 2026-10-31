const esc = value => String(value ?? '').replace(/[&<>"']/g, char => ({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'})[char]);

export function renderSceneWorld() {
  return `<div class="title-world" aria-hidden="true"><div class="title-landscape"></div><div class="title-light"></div><canvas class="title-fog" data-title-fog></canvas><canvas class="title-particles" data-title-particles></canvas><div class="title-vignette"></div><div class="title-grain"></div></div>`;
}

export function renderSceneControls() {
  return `<div class="title-scene-controls" aria-label="场景偏好"><button type="button" class="title-scene-control" data-title-sound aria-pressed="false" aria-label="开启环境音"><svg viewBox="0 0 20 20" fill="none" aria-hidden="true"><path d="M3 8v4h3l4 3V5L6 8H3ZM13 7c2 2 2 4 0 6M15 4c4 4 4 8 0 12" stroke="currentColor" stroke-width="1.2" stroke-linecap="round" stroke-linejoin="round"/></svg><span data-sound-label>环境音·关</span></button><button type="button" class="title-scene-control" data-title-motion aria-pressed="false" aria-label="开启动态场景"><svg viewBox="0 0 20 20" fill="none" aria-hidden="true"><path d="M2 7h11c4 0 4-5 1-5M2 10h15M2 13h9c4 0 4 5 1 5" stroke="currentColor" stroke-width="1.2" stroke-linecap="round"/></svg><span data-motion-label>动态·关</span></button></div>`;
}

export function renderGameScene({version='dev'}={}) {
  return `${renderSceneWorld()}<header class="game-scene-topbar"><div class="title-wordmark"><span class="title-brand-mark" aria-hidden="true">问</span><span>百世问鼎<small>WENDING</small></span></div>${renderSceneControls()}</header><aside class="game-scene-caption" aria-hidden="true"><span class="game-scene-seal">行</span><p>一念落笔<br>山海成卷</p><span class="game-scene-rule"></span><small>百世问鼎 · v${esc(version)}</small></aside>`;
}

export function renderTitleScreen({summary=null,loading=false,error='',hasOtherSaves=false,version='dev'}={}) {
  const arrow = '<svg class="title-option-arrow" viewBox="0 0 32 16" fill="none" aria-hidden="true"><path d="M1 8h28M22 1l7 7-7 7" stroke="currentColor" stroke-width="1"/></svg>';
  const detail = loading ? '正在读取旅程…' : summary ? esc(summary.name+' · '+summary.detail) : '待一段仙缘，落笔成章';
  return `<div class="title-shell" data-motion="off">
    ${renderSceneWorld()}
    <header class="title-topbar"><div class="title-wordmark"><span class="title-brand-mark" aria-hidden="true">问</span><span>百世问鼎<small>WENDING</small></span></div>${renderSceneControls()}</header>
    <main id="main-content" class="title-content" tabindex="-1">
      <p class="title-eyebrow"><span></span>凡 人 一 念 · 山 海 千 重</p>
      <h1 class="title-name" aria-label="百世问鼎"><span class="title-name-prelude" aria-hidden="true">百世</span><span class="title-name-main" aria-hidden="true">问鼎</span><span class="title-seal" aria-hidden="true">凡人<br>问道</span></h1>
      <p class="title-prologue">纵有千世风霜，仍赴一场长生。</p>
      <nav class="title-menu" aria-label="开始游戏">
        <button class="title-option${summary?'':' is-primary'}" data-title-new ${loading?'disabled':''}><span class="title-option-index" aria-hidden="true">壹</span><span class="title-option-copy"><span class="title-option-name">踏入仙途</span><span class="title-option-note">一纸姓名，开启你的修仙人生</span></span>${arrow}</button>
        <button class="title-option${summary?' is-primary':''}" data-title-continue ${!summary||loading?'disabled':''}><span class="title-option-index" aria-hidden="true">贰</span><span class="title-option-copy"><span class="title-option-name">续写此生</span><span class="title-option-note">${detail}</span></span>${arrow}</button>
        <button class="title-option" data-view="settings"><span class="title-option-index" aria-hidden="true">叁</span><span class="title-option-copy"><span class="title-option-name">游戏设置</span><span class="title-option-note">阅读偏好 · 存档管理</span></span>${arrow}</button>
      </nav>
      ${summary||hasOtherSaves?'<button class="title-switch" data-saves>切换存档 <span aria-hidden="true">↗</span></button>':''}
      ${error?`<p class="title-error" role="status">${esc(error)}</p>`:''}
    </main>
    <aside class="title-verse" aria-hidden="true"><span>山河无尽</span><span>此念长生</span><i></i></aside>
    <div class="title-scene-caption" aria-hidden="true"><span class="title-scene-number">壹</span><div><span>云海初照</span><small>山门之外，自有天地。</small></div><i></i></div>
    <footer class="title-footer"><span class="title-footer-motto"><i></i>文字修仙 · 选择由心</span><span>v${esc(version)}</span></footer>
  </div>`;
}

export function renderGameNavigation({history=false}={}) {
  return `<nav class="journey-navigation" aria-label="游戏导航">${history?'<button data-history aria-haspopup="dialog">历史对话</button>':''}<button data-view="settings">游戏设置</button><button data-home>返回首页</button></nav>`;
}

export function renderReadingSettings(value) {
  return `<section class="settings-section" aria-labelledby="reading-title"><h3 id="reading-title">阅读偏好</h3><div class="reading-controls"><label for="reading-theme">画面主题<select id="reading-theme"><option value="cinematic" ${value.theme==='cinematic'?'selected':''}>山海墨金</option><option value="system" ${value.theme==='system'?'selected':''}>跟随系统</option><option value="light" ${value.theme==='light'?'selected':''}>宣纸浅色</option><option value="dark" ${value.theme==='dark'?'selected':''}>静夜深色</option></select></label><label for="reading-size">正文字号<select id="reading-size"><option value="standard" ${value.textSize==='standard'?'selected':''}>标准</option><option value="large" ${value.textSize==='large'?'selected':''}>较大</option></select></label></div><p class="reading-sample">山外有山，往后的路，由你落下一念。</p></section>`;
}

export function renderJourneyList({entries=[],cursor=null,loading=false,error=''}={}) {
  return `<section class="saved-journeys"><p class="birth-kicker">旧日山河，仍在等你</p><h2 id="journeys-title" tabindex="-1">选择一段旅程</h2><p class="section-intro">每段人生各自保存。切换后，从原来的地方继续。</p>${error?`<p class="notice error" role="alert">${esc(error)}</p>`:''}<div class="journey-list">${entries.map(entry=>`<button class="journey-save" ${entry.mode==='live'?`data-select-live="${esc(entry.id)}"`:`data-select-offline="${esc(entry.id)}"`} ${loading?'disabled':''}><span class="journey-save-heading"><strong>${esc(entry.name)}</strong><span class="journey-save-tag">${entry.active?'上次旅程':entry.mode==='live'?'实时旅程':'离线旅程'}</span></span><span>${esc(entry.detail)}</span>${entry.location?`<span class="journey-save-location">${esc(entry.location)}</span>`:''}</button>`).join('')}</div>${loading?'<p role="status">正在读取旅程…</p>':!entries.length&&!error?'<p>尚未留下旅程。回到首页，开启你的仙途。</p>':''}${cursor?'<button class="button" data-saves-next>查看更多旅程</button>':''}</section>`;
}
