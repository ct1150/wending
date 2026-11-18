import { createPlaytestDiary, duration } from './playtest-diary.js';

export function createPlaytestPanel({snapshot,screen,enter,render,openDialog,downloadText,notify,esc,version}){
  const diary=createPlaytestDiary({storage:()=>window.localStorage});
  let release=null,timer=null;

  function observe(activity=false,reason=''){
    if(!diary.active)return false;
    try{
      diary.tick(snapshot(),{activity,stop:reason||(document.hidden?'已转入后台':screen()!=='adventure'?'已离开冒险':'')});
    }catch{notify('手记无法继续保存，可核对上次保存的记录。',true);}
    if(diary.active)return false;
    clearInterval(timer);release?.();release=null;
    return true;
  }
  function stop(reason){
    if(observe(false,reason))render();
  }
  for(const type of ['pointerdown','keydown','wheel']){
    document.addEventListener(type,event=>{if(event.isTrusted&&observe(true))render();},{passive:true});
  }
  window.addEventListener?.('blur',()=>stop('窗口失去焦点'));
  window.addEventListener?.('pagehide',()=>stop('已离开页面'));
  document.addEventListener('visibilitychange',()=>{if(document.hidden)stop('已转入后台');});

  async function exclusive(action){
    if(!window.navigator?.locks)throw Error('此浏览器无法防止多页重复计时，请在支持网页锁的浏览器中打开试玩手记。');
    await window.navigator.locks.request('wending-playtest-recorder',{ifAvailable:true},async lock=>{
      if(!lock)throw Error('另一页面正在记录，请先结束那一段。');
      await action();
    });
  }
  function show(){
    const report=diary.report(),s=snapshot();
    const rows=report.segments.map(r=>`<li><strong>${esc(r.character)} · ${esc(new Date(r.started).toLocaleString())}</strong><p>${esc(r.from.title)} → ${esc(r.to.title)} · ${esc(r.stop)}</p>${r.review?`<p>已确认 ${duration(r.foregroundMs-r.review.breakMs)} · ${esc(r.review.chapter)} ${esc(r.review.comment)}</p>`:`<p>待核对 · 前台 ${duration(r.foregroundMs)}</p><button class="button" data-diary-review="${esc(r.id)}">核对本段</button>`}</li>`).join('');
    const start=s?.state?.events&&s.state.phase==='active'?'<button class="button primary" data-diary-start>进入冒险，开始本段</button>':'';
    openDialog('试玩手记',`<p>自愿记录，仅保存在此浏览器。切出窗口、离开冒险或两分钟无操作会结束本段。核对时可扣除休息时间。</p>${s?.archiveId?`<p>当前存档已确认 ${duration(report.confirmedMsByArchive[s.archiveId]??0)}</p>`:''}${rows?`<ul>${rows}</ul>`:'<p>还没有试玩记录。</p>'}`,start+(rows?'<button class="button" data-diary-export>导出手记</button>':''),{drawer:true});
  }
  function review(id){
    const r=diary.records().find(row=>row.id===id&&!row.review);
    if(!r)return show();
    const options=[...new Set(r.sections.map(section=>section.title))].map(title=>`<option>${esc(title)}</option>`).join('');
    openDialog('核对本段试玩',`<p>${esc(r.character)} · 第 ${Number(r.from.turn)} 至 ${Number(r.to.turn)} 回，前台 ${duration(r.foregroundMs)}。</p><p><label>其中休息了多少秒 <input id="diary-break" type="number" min="0" max="${Math.ceil(r.foregroundMs/1000)}" step="1" value="0"></label></p><p><label>想点评哪一幕 <select id="diary-chapter">${options}</select></label></p><p><label>试玩感受（选填）<br><textarea id="diary-note" maxlength="500" rows="3" placeholder="哪次选择有意思？哪里感觉拖沓？"></textarea></label></p>`,`<button class="button" data-diary-open>稍后再记</button><button class="button primary" data-diary-save="${esc(id)}">确认实际游玩时间</button>`);
  }
  async function click(data){
    try{
      if('diaryOpen' in data)return show();
      if('diaryStop' in data){stop('玩家结束本段');return show();}
      if('diaryReview' in data)return review(data.diaryReview);
      if('diaryExport' in data)return downloadText('百世问鼎-试玩手记.json',JSON.stringify(diary.report(),null,2));
      if('diarySave' in data){
        const seconds=document.querySelector('#diary-break').valueAsNumber;
        const chapter=document.querySelector('#diary-chapter').value,comment=document.querySelector('#diary-note').value;
        await exclusive(()=>diary.review(data.diarySave,seconds,chapter,comment));return show();
      }
      if('diaryStart' in data)await exclusive(async()=>{
        if(document.hidden||!document.querySelector('dialog[open] [data-diary-start]'))return;
        diary.start(snapshot(),version);
        const held=new Promise(resolve=>{release=resolve;});
        try{
          enter();
          timer=setInterval(()=>{if(observe())render();},5000);
          await held;
        }finally{if(diary.active)observe(false,'已结束');clearInterval(timer);}
      });
    }catch(error){notify(error.message||'无法读取本机试玩手记。',true);}
  }
  return {get active(){return diary.active;},observe,click};
}
