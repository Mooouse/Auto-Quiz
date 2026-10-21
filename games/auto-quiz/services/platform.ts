import type {GameHost} from '@gp/core';
/** Portal boundary. The first release is web/local-only; game_platform owns any future SDK implementation. */
export interface PlatformBridge {playing(on:boolean):void;screen(name:string):void;onPause(fn:()=>void):void;reveal():void}
export class GamePlatformBridge implements PlatformBridge{
 constructor(private host:GameHost){}
 playing(on:boolean){this.host.gameplay(on);}
 screen(name:string){this.host.screen(name);}
 onPause(fn:()=>void){this.host.onPause(()=>fn());}
 reveal(){this.host.twist('silhouette-reveal');}
}
