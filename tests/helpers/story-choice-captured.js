// Visible prose and choices captured from the 5.2.0 live opening.
// Metadata reconstructs the wire envelope; no session or player identifiers.
export function capturedStoryWire() {
  const actor = { kind: 'person', name: '灰衣汉子', ref: '', status: null };
  return {
    blocks: [{ kind: 'narration', text: '你站在出生地的村口，晨雾未散。一名身着灰布短打的汉子正蹲在路边的石碾旁，手里摆弄着一只缺了口的陶罐。他似乎察觉到了你的目光，停下手中的活计，抬头看了你一眼，随即又低下头去，用粗糙的手指抹去陶罐口的一抹泥痕。那陶罐里似乎装着什么活物，正发出细微的窸窣声。' }],
    choices: [
      { action: 'interact:ask', target: actor, stake: 'low', purpose: '询问陶罐中装着什么，以及他为何在此处停留', anchor: 0 },
      { action: 'interact:observe', target: actor, stake: 'low', purpose: '观察陶罐的质地与周围环境，判断是否有危险', anchor: 0 },
      { action: 'interact:decline', target: actor, stake: 'low', purpose: '无视他，转身离开村口', anchor: 0 },
    ],
    title: '村口陶罐', location: '村口', memoryDeltas: [],
    story: { pattern: 'investigation', beat: 'progress', anchors: [0] },
  };
}
