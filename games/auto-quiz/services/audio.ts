import type {GameHost} from '@gp/core';
import type {Settings} from '../domain/types.ts';
export type Sound='click'|'correct'|'wrong'|'achievement'|'level'|'finish';
const notes:Record<Sound,number[]>={click:[440],correct:[523,659,784],wrong:[196,147],achievement:[523,659,784,1047],level:[392,523,659,784,1047],finish:[523,659,784,659,1047]};
export class SoundPlayer{
 constructor(private host:GameHost,private settings:()=>Settings){}
 play(kind:Sound){const s=this.settings();if(!s.sound||s.volume===0)return;try{const audio=this.host.audio;if(!audio)return;const {ctx,out}=audio;const now=ctx.currentTime;notes[kind].forEach((f,i)=>{const o=ctx.createOscillator(),g=ctx.createGain();o.type='sine';o.frequency.value=f;const t=now+i*.085;g.gain.setValueAtTime(0,t);g.gain.linearRampToValueAtTime(s.volume*(kind==='click'?.045:.11),t+.012);g.gain.exponentialRampToValueAtTime(.0001,t+.16);o.connect(g);g.connect(out);o.start(t);o.stop(t+.18);o.onended=()=>{o.disconnect();g.disconnect();};});}catch{/* Audio is optional. */}}
}
