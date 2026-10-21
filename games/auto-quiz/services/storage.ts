import type {Profile,Language} from '../domain/types.ts';
import {defaultProfile,hydrateProfile} from '../domain/profile.ts';
export interface ProfileRepository {load(language:Language):Profile;save(profile:Profile):boolean;reset(language:Language):Profile;status(): 'ok'|'unavailable'|'recovered'}
export const SAVE_KEY='autoquiz.profile.v1';
export class LocalProfileRepository implements ProfileRepository{
 private state:'ok'|'unavailable'|'recovered'='ok';
 load(language:Language){try{const raw=localStorage.getItem(SAVE_KEY);if(!raw)return defaultProfile(language);const parsed=JSON.parse(raw);if(parsed?.version!==1){this.state='recovered';return defaultProfile(language);}return hydrateProfile(parsed,language);}catch{this.state='recovered';return defaultProfile(language);}}
 save(profile:Profile){try{localStorage.setItem(SAVE_KEY,JSON.stringify(profile));this.state='ok';return true;}catch{this.state='unavailable';return false;}}
 reset(language:Language){const p=defaultProfile(language);this.save(p);return p;}
 status(){return this.state;}
}
