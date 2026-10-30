// A partial JSON document is never a scene. Only bounded blocks[i].text values
// can be previewed; entities, choices, memory and mechanical fields stay private.
export function readStoryPreview(source) {
  if(typeof source!=='string'||source.length>65536)return '';
  let index=0,nodes=0;const texts=[];
  const space=()=>{while(/\s/.test(source[index]??'')&&index<source.length)index++;};
  function string(){
    index++;let value='';
    while(index<source.length){
      let char=source[index++];
      if(char==='"')return {value,complete:true};
      if(char==='\\'){
        if(index>=source.length)break;
        char=source[index++];
        if(char==='u'){
          const digits=source.slice(index,index+4);if(!/^[a-f0-9]{4}$/i.test(digits))break;
          value+=String.fromCharCode(parseInt(digits,16));index+=4;
        }else{
          const escapes={'"':'"','\\':'\\','/':'/','b':'\b','f':'\f','n':'\n','r':'\r','t':'\t'};
          if(!Object.hasOwn(escapes,char))break;value+=escapes[char];
        }
      }else{if(char.charCodeAt(0)<32)break;value+=char;}
    }
    if(/[\ud800-\udbff]$/.test(value))value=value.slice(0,-1);
    return {value,complete:false};
  }
  function value(path,depth=0){
    if(++nodes>12000||depth>32)return false;space();
    if(source[index]==='"'){
      const item=string();
      if(path.length===3&&path[0]==='blocks'&&Number.isInteger(path[1])&&path[1]<12&&path[2]==='text')texts.push(item.value.slice(0,2000));
      return item.complete;
    }
    if(source[index]==='{'){
      index++;space();if(source[index]==='}'){index++;return true;}
      while(index<source.length){
        space();if(source[index]!=='"')return false;
        const key=string();if(!key.complete)return false;space();if(source[index++]!==':')return false;
        if(!value([...path,key.value],depth+1))return false;
        space();if(source[index]==='}'){index++;return true;}if(source[index++]!==',')return false;
      }
      return false;
    }
    if(source[index]==='['){
      index++;space();if(source[index]===']'){index++;return true;}
      let row=0;
      while(index<source.length){
        if(!value([...path,row++],depth+1))return false;
        space();if(source[index]===']'){index++;return true;}if(source[index++]!==',')return false;
      }
      return false;
    }
    const start=index;while(index<source.length&&!/[\s,}\]]/.test(source[index]))index++;
    return index>start&&/^(?:true|false|null|-?(?:0|[1-9]\d*)(?:\.\d+)?(?:e[+-]?\d+)?)$/i.test(source.slice(start,index));
  }
  value([]);return texts.filter(Boolean).join('\n\n');
}
