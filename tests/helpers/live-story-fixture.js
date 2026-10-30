// Native UI fixtures follow the same v7 output contract as real new lives.
// Legacy session/unit fixtures remain byte-for-byte unchanged.
export function cultivationFixtureProse(text, turnId) {
  const setting='山风从林间缓缓掠过，叶上的雨珠落进路边的细沟。远处炊烟尚未散尽，近处泥土还留着昨夜的湿气。木栏上的旧绳随风轻摆，石阶边缘长着薄薄的青苔。眼前的动静仍在继续，路旁既有可供歇脚的平石，也有能够看清周围的空处。几声鸟鸣从枝头传来，很快又隐入深林。衣角被风轻轻卷起，山路上的脚印有深有浅，尚不能仅凭这些分辨来客的去向。此时尚有余地听清来由、查看细节，或先谨慎等待。';
  let result=text+'石边留有第'+turnId+'道浅痕。';
  while(Array.from(result).length<200)result+=setting.slice(0,Math.min(setting.length,220-Array.from(result).length));
  return result;
}

export function liveStoryFixture(scene, context) {
  if(context.life?.cultivationProfile?.version!==7)return scene;
  const value=structuredClone(scene),prefix=context.namespace+':t'+context.identity.turnId+':';
  const count=value.blocks.reduce((sum,block)=>sum+Array.from(block.text).length,0);
  if(count<200)value.blocks[0].text=cultivationFixtureProse(value.blocks[0].text,context.identity.turnId);
  if(value.choices.length===2)value.choices.push({id:prefix+'c:cautious',label:'谨慎查看山路旁可用的行粮',intent:'explore',targetId:'supplies',stake:'low',approach:'cautious'});
  value.story={pattern:'journey',beat:context.director?.pacing.beatOverdue?'revelation':'progress',anchors:[0]};
  if(value.story.beat==='revelation') {
    const known=context.entities?.find(entity=>entity.kind==='place'&&entity.name===value.location);
    const place={id:known?.id??prefix+'e:path',name:value.location,kind:'place'};
    if(!value.entities.some(entity=>entity.id===place.id))value.entities.push(place);
    value.memoryDeltas.push({entityId:place.id,kind:'fact',text:value.blocks[0].text});
  }
  return value;
}
