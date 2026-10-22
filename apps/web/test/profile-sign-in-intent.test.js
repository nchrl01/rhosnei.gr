import {beforeEach,afterEach,describe,expect,it,vi} from 'vitest';
import {beginProfileSignIn,endProfileSignIn,pendingProfileSignIn} from '../public/profile-sign-in-intent.js';

let values;
beforeEach(()=>{
 values=new Map();
 vi.stubGlobal('location',new URL('https://upic-art.github.io/rhosnei.gr/?coin=example#search'));
 vi.stubGlobal('history',{state:{existing:true},replaceState:vi.fn((state,unused,url)=>{globalThis.location=new URL(url);})});
 vi.stubGlobal('sessionStorage',{getItem:key=>values.get(key)??null,setItem:(key,value)=>values.set(key,value),removeItem:key=>values.delete(key)});
});
afterEach(()=>vi.unstubAllGlobals());

describe('mobile sign-in continuation intent',()=>{
 it('adds only an expiring UI marker while preserving the current coin and hash',()=>{
  expect(pendingProfileSignIn()).toBe(false);beginProfileSignIn();
  expect(pendingProfileSignIn()).toBe(true);
  expect(location.searchParams.get('coin')).toBe('example');expect(location.hash).toBe('#search');
  expect(Number(location.searchParams.get('upic_login'))).toBeGreaterThan(Date.now()-1000);
  expect([...values.keys()]).toEqual(['upic-profile-sign-in']);
 });
 it('survives a wallet opening the URL in a separate browser without shared storage',()=>{
  beginProfileSignIn();values.clear();expect(pendingProfileSignIn()).toBe(true);
 });
 it('survives reload from session storage if the URL marker was removed',()=>{
  beginProfileSignIn();location.searchParams.delete('upic_login');expect(pendingProfileSignIn()).toBe(true);
 });
 it('clears the marker after sign-in or explicit cancellation',()=>{
  beginProfileSignIn();endProfileSignIn();expect(pendingProfileSignIn()).toBe(false);
  expect(location.search).toBe('?coin=example');expect(location.hash).toBe('#search');expect(values.size).toBe(0);
 });
 it.each(['invalid','0',String(Date.now()-11*60*1000),String(Date.now()+86400000)])('ignores stale or invalid marker %s',value=>{
  location.searchParams.set('upic_login',value);values.set('upic-profile-sign-in',value);
  expect(pendingProfileSignIn()).toBe(false);expect(location.searchParams.has('upic_login')).toBe(false);expect(values.size).toBe(0);
 });
 it('can continue from the URL when storage is unavailable',()=>{
  vi.stubGlobal('sessionStorage',{getItem(){throw Error('blocked');},setItem(){throw Error('blocked');},removeItem(){throw Error('blocked');}});
  beginProfileSignIn();expect(pendingProfileSignIn()).toBe(true);endProfileSignIn();expect(pendingProfileSignIn()).toBe(false);
 });
});
