// One display composer for tentative model output and the verified scene.
// Mechanical action/target authority remains in the decoder and rules engine.
export function formatStoryChoiceLabel({action,targetId,targetName='',purpose,stake}){
  const labels={
    'practice:steady':'凝神修行','practice:intensive':'闭关苦修','practice:breakthrough':'尝试突破'+targetName,
    'rest:recover':'歇息调养','rest:retire':'静心休养',
    'explore:cautious':'寻找'+targetName,'explore:bold':'深入探索寻找'+targetName,
    'negotiate:cooperate':'与'+targetName+'商谈','negotiate:bargain':'向'+targetName+'讨价还价','negotiate:pressure':'向'+targetName+'施压',
    'fight:guard':'谨慎迎战'+targetName,'fight:assault':'向'+targetName+'发起攻势','fight:desperate':'与'+targetName+'拼死一搏',
    'evade:withdraw':'避开'+targetName,'evade:conceal':'隐匿行踪躲开'+targetName,
    'travel:road':'沿路前往'+targetName,'travel:wilderness':'穿行荒野前往'+targetName,
    'craft:study':'研读完整功法','craft:forge':'锻制护符',
    'interact:ask':'询问'+targetName,'interact:observe':targetId==='self'?'仔细观察':'观察'+targetName,
    'interact:help':'援助'+targetName,'interact:decline':'婉拒'+targetName,'interact:leave':targetId==='self'?'结束当前互动':'结束与'+targetName+'的互动',
  };
  if(!Object.hasOwn(labels,action))return null;
  const label=labels[action];
  if(typeof purpose!=='string')return label+(stake==='high'?'（冒险）':stake==='low'?'（谨慎）':'');
  const [intent,approach]=action.split(':');
  const executable=intent==='fight'?'迎战'+targetName+'，'+({guard:'稳守',assault:'强攻',desperate:'搏命'})[approach]:intent==='evade'?'避开'+targetName+'，'+(approach==='withdraw'?'后撤':'藏身'):label;
  return executable+'：'+purpose.trim();
}
