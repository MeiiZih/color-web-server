const test=require('node:test');
const assert=require('node:assert/strict');
const {pathToFileURL}=require('node:url');
const path=require('node:path');
const source=import(pathToFileURL(path.resolve(__dirname,'../color-web/app/quiz-feedback.mjs')));
function fixture({suspended=false,reduced=false}={}) {
  let clock=0,resolveResume;const calls=[];
  class Audio {
    constructor(){calls.push('created');this.state=suspended?'suspended':'running';this.currentTime=0;this.destination={};}
    createOscillator(){return {frequency:{setValueAtTime(){},exponentialRampToValueAtTime(){}},connect(){},disconnect(){},start(){calls.push('start');},stop(){calls.push('stop');}};}
    createGain(){return {gain:{setValueAtTime(){},exponentialRampToValueAtTime(value){calls.push(value);}},connect(){},disconnect(){}};}
    resume(){return new Promise(resolve=>{resolveResume=()=>{this.state='running';resolve();};});}
    close(){calls.push('close');return Promise.resolve();}
  }
  return {host:{AudioContext:Audio,performance:{now:()=>clock},navigator:{userActivation:{isActive:true}},matchMedia:()=>({matches:reduced})},calls,tick(value){clock=value;},resume(){resolveResume();}};
}
const gesture=type=>({type,isTrusted:true});
test('no autoplay, untrusted events and inactive gestures are silent',async()=>{
  const {createQuizFeedback}=await source,f=fixture(),feedback=createQuizFeedback(f.host);
  assert.equal(f.calls.length,0);
  feedback.play('answer',{type:'change',isTrusted:false});feedback.play('answer',gesture('load'));
  f.host.navigator.userActivation.isActive=false;feedback.play('next',gesture('submit'));
  assert.equal(f.calls.length,0);
});
test('accepted gestures have same quiet tone and throttle rapid repeats',async()=>{
  const {createQuizFeedback}=await source,f=fixture(),feedback=createQuizFeedback(f.host);
  feedback.play('answer',gesture('change'));feedback.play('next',gesture('submit'));
  assert.equal(f.calls.filter(v=>v==='start').length,1);assert(f.calls.includes(.025));
  f.tick(200);feedback.play('previous',gesture('click'));
  assert.equal(f.calls.filter(v=>v==='created').length,1);assert.equal(f.calls.filter(v=>v==='start').length,2);
  feedback.dispose();assert(f.calls.includes('close'));
});
test('audio unavailability does not block visual feedback or throw',async()=>{
  const {createQuizFeedback}=await source;let motions=0;
  const feedback=createQuizFeedback({matchMedia:()=>({matches:false}),AudioContext:class{constructor(){throw Error('blocked');}}});
  assert.doesNotThrow(()=>feedback.play('answer',gesture('change'),{animate(){motions++;return {cancel(){}};}}));assert.equal(motions,1);
});
test('reduced motion suppresses animations but keeps requested audio',async()=>{
  const {createQuizFeedback}=await source,f=fixture({reduced:true}),feedback=createQuizFeedback(f.host);let motions=0;
  feedback.play('answer',gesture('change'),{animate(){motions++;}});
  assert.equal(motions,0);assert(f.calls.includes('start'));
});
test('slow resume and cancelled navigation never play a delayed tone',async()=>{
  const {createQuizFeedback}=await source;
  for(const cancel of [false,true]){const f=fixture({suspended:true}),feedback=createQuizFeedback(f.host);
    feedback.play('answer',gesture('change'));if(cancel)feedback.stop();else f.tick(500);f.resume();await Promise.resolve();
    assert.equal(f.calls.filter(v=>v==='start').length,0);
  }
});
test('motion stays local and has finite responsive durations',async()=>{
  const {createQuizFeedback}=await source,f=fixture(),feedback=createQuizFeedback(f.host),timings=[];
  const element={animate(frames,options){timings.push(options.duration);return {cancel(){}};},querySelector(){return {animate(frames,options){timings.push(options.duration);}};}};
  feedback.play('answer',gesture('change'),element);assert.deepEqual(timings,[240,260]);
});
