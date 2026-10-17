export const KEY_NAMES=['C','C♯','D','E♭','E','F','F♯','G','A♭','A','B♭','B'];
// Stable pseudo-random tonic: changes only with coin identity, never its mood.
export function seedTonic(seed){let n=Number(seed)>>>0;n=Math.imul(n^(n>>>16),0x45d9f3b)>>>0;n=Math.imul(n^(n>>>16),0x45d9f3b)>>>0;return 48+((n^(n>>>16))>>>0)%12;}
export const keyName=tonic=>KEY_NAMES[((Math.round(tonic)%12)+12)%12];
