// Plain-data inspection precedes every property read at an untrusted boundary.
export function assertPlainData(value) {
  const ancestors = new Set(); let nodes = 0;
  function visit(row, depth) {
    if (++nodes > 12000 || depth > 32) throw new Error('数据结构过大。');
    if (row === null || typeof row === 'boolean' || typeof row === 'string') return;
    if (typeof row === 'number' && Number.isFinite(row)) return;
    if (typeof row !== 'object' || ancestors.has(row)) throw new Error('需要无循环的 JSON 数据。');
    const array = Array.isArray(row), proto = Object.getPrototypeOf(row);
    if (array ? proto !== Array.prototype : proto !== Object.prototype && proto !== null) throw new Error('不支持自定义原型。');
    ancestors.add(row);
    const keys = Reflect.ownKeys(row);
    for (const key of keys) {
      if (array && key === 'length') continue;
      const descriptor = Object.getOwnPropertyDescriptor(row, key);
      if (typeof key !== 'string' || !descriptor.enumerable || !Object.hasOwn(descriptor, 'value') || ['__proto__','constructor','prototype'].includes(key)) throw new Error('不支持访问器或隐藏属性。');
      if (array && (!/^(0|[1-9][0-9]*)$/.test(key) || Number(key) >= row.length)) throw new Error('数组属性无效。');
      visit(descriptor.value, depth + 1);
    }
    if (array && keys.length !== row.length + 1) throw new Error('数组不能有空位。');
    ancestors.delete(row);
  }
  visit(value, 0); return value;
}
export function canonicalStringify(value) {
  assertPlainData(value);
  const encode = row => row === null || typeof row !== 'object' ? JSON.stringify(row) : Array.isArray(row) ? '[' + row.map(encode).join(',') + ']' : '{' + Object.keys(row).sort().map(key => JSON.stringify(key) + ':' + encode(row[key])).join(',') + '}';
  return encode(value);
}
const K = [0x428a2f98,0x71374491,0xb5c0fbcf,0xe9b5dba5,0x3956c25b,0x59f111f1,0x923f82a4,0xab1c5ed5,0xd807aa98,0x12835b01,0x243185be,0x550c7dc3,0x72be5d74,0x80deb1fe,0x9bdc06a7,0xc19bf174,0xe49b69c1,0xefbe4786,0x0fc19dc6,0x240ca1cc,0x2de92c6f,0x4a7484aa,0x5cb0a9dc,0x76f988da,0x983e5152,0xa831c66d,0xb00327c8,0xbf597fc7,0xc6e00bf3,0xd5a79147,0x06ca6351,0x14292967,0x27b70a85,0x2e1b2138,0x4d2c6dfc,0x53380d13,0x650a7354,0x766a0abb,0x81c2c92e,0x92722c85,0xa2bfe8a1,0xa81a664b,0xc24b8b70,0xc76c51a3,0xd192e819,0xd6990624,0xf40e3585,0x106aa070,0x19a4c116,0x1e376c08,0x2748774c,0x34b0bcb5,0x391c0cb3,0x4ed8aa4a,0x5b9cca4f,0x682e6ff3,0x748f82ee,0x78a5636f,0x84c87814,0x8cc70208,0x90befffa,0xa4506ceb,0xbef9a3f7,0xc67178f2];
export function sha256(text) {
  if (typeof text !== 'string') throw new Error('SHA-256 输入须为文字。');
  const input = new TextEncoder().encode(text), bytes = new Uint8Array(Math.ceil((input.length + 9) / 64) * 64);
  bytes.set(input); bytes[input.length] = 128;
  const view = new DataView(bytes.buffer), bits = input.length * 8;
  view.setUint32(bytes.length - 8, Math.floor(bits / 4294967296)); view.setUint32(bytes.length - 4, bits >>> 0);
  const h = [0x6a09e667,0xbb67ae85,0x3c6ef372,0xa54ff53a,0x510e527f,0x9b05688c,0x1f83d9ab,0x5be0cd19], w = new Uint32Array(64);
  const rotate = (n,r) => (n >>> r) | (n << (32-r));
  for (let offset=0;offset<bytes.length;offset+=64) {
    for(let i=0;i<16;i++) w[i]=view.getUint32(offset+i*4);
    for(let i=16;i<64;i++) { const a=w[i-15],b=w[i-2];w[i]=w[i-16]+(rotate(a,7)^rotate(a,18)^(a>>>3))+w[i-7]+(rotate(b,17)^rotate(b,19)^(b>>>10)); }
    let [a,b,c,d,e,f,g,j]=h;
    for(let i=0;i<64;i++){const t1=(j+(rotate(e,6)^rotate(e,11)^rotate(e,25))+((e&f)^(~e&g))+K[i]+w[i])>>>0,t2=((rotate(a,2)^rotate(a,13)^rotate(a,22))+((a&b)^(a&c)^(b&c)))>>>0;j=g;g=f;f=e;e=(d+t1)>>>0;d=c;c=b;b=a;a=(t1+t2)>>>0;}
    [a,b,c,d,e,f,g,j].forEach((n,i)=>{h[i]=(h[i]+n)>>>0;});
  }
  return h.map(n=>n.toString(16).padStart(8,'0')).join('');
}
export function stateHash(value) { return sha256(canonicalStringify(value)); }
