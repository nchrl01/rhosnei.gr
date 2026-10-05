// Preset IDs and seed mapping stay fixed so a coin keeps its instrument.
export const EARTHBOUND_PRESETS=[0,1,2,3,4,5,6,7,8,9,10,11,12,13,14,15,16,18,23,24,25,27,28,29,30,31,34,35,36,37,38,130,139,140,145,146,147,156,169,171,178];
const families={
 strings:{attack:.025,decay:.16,sustain:.58,release:.16,noteMax:1.8,phraseMax:.7,gate:.9,low:48,high:88,cutoff:5600,room:.2},
 bass:{attack:.008,decay:.12,sustain:.35,release:.08,noteMax:1,phraseMax:.4,gate:.85,low:36,high:69,cutoff:2800,room:.08},
 piano:{attack:.006,decay:.22,sustain:.38,release:.14,noteMax:3.2,phraseMax:.6,gate:1,low:45,high:93,cutoff:7200,room:.25},
 keys:{attack:.006,decay:.16,sustain:.24,release:.09,noteMax:1.6,phraseMax:.5,gate:1,low:48,high:88,cutoff:6500,room:.20},
 mallet:{attack:.004,decay:.12,sustain:.16,release:.09,noteMax:1.1,phraseMax:.65,gate:1.18,low:48,high:93,cutoff:6800,room:.22},
 organ:{attack:.008,decay:.05,sustain:.72,release:.045,noteMax:.75,phraseMax:.36,gate:.78,low:48,high:88,cutoff:4800,room:.10},
 lead:{attack:.007,decay:.09,sustain:.40,release:.06,noteMax:.85,phraseMax:.4,gate:.88,low:48,high:88,cutoff:4400,room:.12},
 pluck:{attack:.004,decay:.15,sustain:.18,release:.12,noteMax:1.5,phraseMax:.65,gate:1.12,low:45,high:88,cutoff:6500,room:.20},
 brass:{attack:.018,decay:.09,sustain:.54,release:.08,noteMax:.9,phraseMax:.5,gate:.96,low:48,high:84,cutoff:4600,room:.12},
 flute:{attack:.018,decay:.08,sustain:.62,release:.10,noteMax:1.1,phraseMax:.55,gate:1.1,low:60,high:93,cutoff:6200,room:.20},
 sine:{attack:.009,decay:.12,sustain:.25,release:.09,noteMax:1,phraseMax:.5,gate:1,low:48,high:88,cutoff:6500,room:.16},
};
const familyByPreset={0:'piano',9:'organ',10:'organ',11:'organ',12:'organ',15:'lead',16:'organ',23:'strings',24:'strings',25:'strings',28:'brass',31:'flute',35:'sine',36:'lead',37:'lead',38:'bass',130:'flute',139:'lead',140:'organ',145:'sine',146:'sine',147:'strings',156:'lead',169:'organ',171:'brass',178:'organ',1:'piano',2:'keys',3:'keys',4:'mallet',5:'mallet',6:'mallet',7:'organ',8:'organ',13:'lead',14:'lead',18:'pluck',27:'brass',29:'brass',30:'flute',34:'sine'};
export function earthboundPreset(seed){
 let hash=seed>>>0;hash=Math.imul(hash^(hash>>>16),0x45d9f3b)>>>0;hash=(hash^(hash>>>16))>>>0;
 return EARTHBOUND_PRESETS[hash%EARTHBOUND_PRESETS.length];
}
export function instrumentProfile(preset){
 const family=familyByPreset[preset]||'piano';return {...families[family],family};
}
export function instrumentPitch(midi,profile){
 let pitch=Math.round(midi);
 while(pitch>profile.high)pitch-=12;
 while(pitch<profile.low)pitch+=12;
 return pitch;
}
