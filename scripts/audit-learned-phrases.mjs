#!/usr/bin/env node
// Offline integration audit of the shared composer and its final-pitch guard.
// Does not start a browser, play audio, fetch markets or train a new model.
import {readFile,writeFile,mkdir} from 'node:fs/promises';
import {createHash} from 'node:crypto';
import path from 'node:path';
import assert from 'node:assert/strict';
import {composeMarketBar} from '../apps/web/public/market-composition.js';
import {createMelodyOriginalityGuard,LEARNED_PHRASE_INFO} from '../apps/web/public/learned-market-phrase.js';
import {installOriginalityIndex,sourceMelodyMatch,MIDI_ORIGINALITY_INFO} from '../apps/web/public/midi-originality.js?v=455';
import {instrumentPitch,instrumentProfile,earthboundPreset} from '../apps/web/public/earthbound-instruments.js?v=451';

const output=process.argv[2]||'.local/vgmusic/integration-audit.json';
const binary=await readFile(new URL('../apps/web/public/midi-originality-index.bin',import.meta.url));
await installOriginalityIndex(binary);
const totals={scenarios:0,bars:0,candidateNotes:0,acceptedNotes:0,revoiced:0,withheld:0,indexedMatchesAfterGuard:0};
for(let i=0;i<96;i++){
 const seed=(Math.imul(i+1,2654435761))>>>0;
 const profile=instrumentProfile(earthboundPreset(seed));
 for(const phraseLearning of [0,.5,1]){
  const guard=createMelodyOriginalityGuard(),heard=[];
  const context={active:true,cap:10**(4+i%5),pitchLow:Math.max(60,profile.low),pitchHigh:profile.high,phraseLearning,phraseVariation:i%7,music:{activity:(i%5)/4,intensity:(i%7)/6,group:i%2?'up':'down',character:i%2?'serene':'reflective',tempo:[20,100,200][i%3]}};
  for(let bar=0;bar<64;bar++){
   const score=composeMarketBar(seed,bar,context);
   const melody=score.events.filter(e=>e.kind==='arp');
   for(let j=0;j<melody.length;j++){
    const event=melody[j];
    assert.ok(Number.isFinite(event.beat)&&event.beat>=0&&event.beat<4);
    assert.ok(Number.isFinite(event.duration)&&event.duration>0&&event.beat+event.duration<=4+1e-9);
    if(j)assert.ok(melody[j-1].beat+melody[j-1].duration<=event.beat+1e-9);
    const midi=instrumentPitch(event.midi,profile);
    const accepted=guard.accept(midi,event.allowedPitches.map(n=>instrumentPitch(n,profile)),bar*4+event.beat);
    totals.candidateNotes++;
    if(accepted!==null){assert.ok(accepted>=profile.low&&accepted<=profile.high);heard.push(accepted);totals.acceptedNotes++;}
   }
   totals.bars++;
  }
  const result=sourceMelodyMatch(heard);
  assert.equal(result.ready,true);
  if(result.match)totals.indexedMatchesAfterGuard++;
  assert.equal(result.match,false,`Unscreened source window in seed ${seed}, mix ${phraseLearning}`);
  const status=guard.snapshot();totals.revoiced+=status.revoiced;totals.withheld+=status.blocked;totals.scenarios++;
 }
}
const files=['learned-market-phrase.js','market-composition.js','trade-piano.js','midi-originality.js','midi-phrase-model.js'];
const hashes={};
for(const file of files)hashes[file]=createHash('sha256').update(await readFile(new URL('../apps/web/public/'+file,import.meta.url))).digest('hex');
const report={version:1,createdAt:new Date().toISOString(),status:'passed',method:'Offline shared composer, final instrument register fitting, and actual runtime guard across consecutive bars. Uses all-source interval index.',model:LEARNED_PHRASE_INFO,indexSha256:MIDI_ORIGINALITY_INFO.binarySha256,totals,sourceCodeSha256:hashes,limitations:['Nine-note interval matches only; not a listening or perceptual-similarity evaluation.','No browser or Web Audio scheduling exercised by this audit.','Source coverage limitations and conservative false positives are documented in the index metadata.']};
await mkdir(path.dirname(path.resolve(output)),{recursive:true});await writeFile(output,JSON.stringify(report,null,2)+'\n');
console.log(JSON.stringify({status:report.status,...totals,output},null,2));
