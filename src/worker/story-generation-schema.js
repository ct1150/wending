import { SCENE_SCHEMA } from '../game/cultivation/live/schema.js';
import { INTENTS } from '../game/cultivation/live/model.js';

// Generation guidance for an already validated run/turn. Runtime validation
// remains authoritative for references, mechanics, cross-item uniqueness and
// UTF-16 text lengths (JSON Schema maxLength counts Unicode code points).
export function buildGenerationSchema(namespace,turnId) {
  const schema=structuredClone(SCENE_SCHEMA),prefix=`${namespace}:t${turnId}:`;
  const block=schema.properties.blocks.items,entity=schema.properties.entities.items;
  const choice=schema.properties.choices.items,memory=schema.properties.memoryDeltas.items;
  schema.properties.id={type:'string',enum:[prefix+'s:scene']};
  choice.properties.id={...choice.properties.id,pattern:`^${prefix}c:[A-Za-z0-9:_-]+$`};
  choice.properties.intent={};choice.properties.approach={};
  choice.oneOf=Object.entries(INTENTS).map(([intent,approaches])=>({properties:{intent:{enum:[intent]},approach:{enum:[...approaches]}}}));
  block.properties.kind={};
  block.oneOf=[
    {properties:{kind:{enum:['narration']},speaker:false}},
    {properties:{kind:{enum:['dialogue']}},required:['speaker']},
  ];
  entity.properties.kind={};
  entity.oneOf=[
    {properties:{kind:{enum:['person']}}},
    {properties:{kind:{enum:['place','faction']},status:false}},
  ];
  memory.properties.kind={};
  memory.properties.status={};
  memory.oneOf=[
    {properties:{kind:{enum:['fact','relationship','death']},referenceId:false,status:false}},
    {properties:{kind:{enum:['promise','clue']},referenceId:false,status:{enum:['open']}}},
    {properties:{kind:{enum:['promise']},status:{enum:['resolved','broken']}},required:['referenceId','status']},
    {properties:{kind:{enum:['clue']},status:{enum:['resolved']}},required:['referenceId','status']},
  ];
  for(const field of [schema.properties.title,schema.properties.location,block.properties.text,entity.properties.name,choice.properties.label,memory.properties.text]){
    field.pattern='^(?=[\\s\\S]*\\S)[^\\x00-\\x08\\x0b\\x0c\\x0e-\\x1f]*$';
    delete field.minLength; // The non-whitespace pattern already requires text.
  }
  for(const field of [block.properties.speaker,entity.properties.id,choice.properties.id,choice.properties.targetId,memory.properties.entityId,memory.properties.referenceId])delete field.minLength;
  return schema;
}
