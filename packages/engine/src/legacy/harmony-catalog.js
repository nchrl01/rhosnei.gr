// Progressions transcribed from the user's original Major / Minor reference.
// Accidentals use a chromatic major-scale reference; slash chords use tonicization.
const rows={Major:`Hopeful|I V vi IV
Yearning|I V vi V
Nostalgic|I V ii IV
Optimistic|I vi IV V
Cheerful|I IV V IV
Reflective|I IV vi V
Smooth|I vi ii V
Confident|I vi IV V
Triumphant|IV I V V
Satisfying|IV I V vi
Dramatic|I VI I V
Longing|vi V IV V
Surprising|I bVI V V
Serene|I II V/vi vi
Bittersweet|IV iv I I
Warm|IV bVII I I
Comforting|IV ii/bVII I I
Gentle|I ii7 I IV
Dreamy|I vi IV/bvi I
Contemplative|I vi IV Vsus4
Bold|I iii7 vi IV
Dynamic|bVII ii Isus4 I
Joyful|I II iii V
Lush|I I bII/bVI bVII
Sweet|IV IVsus2 I I
Romantic|Imaj7 Imaj7 ii V
Warm|ii7 V7 Imaj7 Imaj7
Longing|ii9 V13 Imaj7 Imaj7
Soulful|I7 IV7 I7 V
Complex|I7 vi7 V viadd9
Enchanting|I7 #V9 IV7 Vadd11
Hopeful|I7 vi IV7 Vsus4
Grand|Imaj7 VII7 iii V
Rich|Imaj9 VII7 iii9 Vmaj7
Ethereal|I Isus2maj7 II vii/ii
Mystical|Iadd9 vi IVadd9 Vadd9
Yearning|I9 iv11/i I9 iv11/i
Restless|I7 I7 vii°7 ii7b5
Bittersweet|I iv/i v/bvii bVIIsus2add6
Distant|Isus2(7) iv9 bVIIsus2add6 bIIImaj7
Playful|Vadd4 Vadd9 Isus4maj9 iii7`,Minor:`Melancholic|i V bVI iv
Tense|i v bVI V
Sad|i iv v iv
Dramatic|i iv bVI V
Anxious|i bVI ii° V
Emotional|i bVI iv V
Somber|iv i v v
Tragic|i bVI i V
Epic|bVI V iv V
Brooding|i v IVsus4 IV
Ominous|i iv bIII V/II
Expansive|i bVI bIII bVII
Atmospheric|i bIII v IV
Enigmatic|i v bIIIadd6 ii°
Exotic|i11 bVI°add#5 bVI7 bIII7
Listful|i11 bVIImaj9 i11 bVIImaj9
Hypnotic|i bVII bVImaj7 Vaug7
Sorrowful|i7 iv7 bVII i7
Complex|i7 vadd9 ii° bVIsus4
Poignant|i7 v bVI i7
Introspective|i7 bVI7 bIII i7
Seductive|i9 ii7 i7 IV7
Dark|i11 iv11/i i11 V7#5
Pensive|i9 V9 i11 V7
Anticipatory|i i ii° V
Wistful|i bVII/II bIIIadd9 IV
Hopeful|i bVII ii/IV Vsus4
Celestial|i Isus2 bVI bVIIsus4
Floating|i Vsus4 bVI IVsus2
Serene|i Isus2 bVI Vsus4
Regal|i bVIIsus4 bVIM7 V
Evocative|i bIII iv vii°addb6
Nostalgic|i bIII IVsus2 IV
Velvety|i bVIadd9 bIII bVII
Foreboding|i bVImaj7 V7 i7
Alluring|iadd9 bVI bIII bVIIadd9
Adventurous|i V/bvii IV/VI IV/II
Transcendent|i i/biii bVI bVIsus2/bVII
Intense|i bVII9/I bVImaj7/I Isus2(7)
Passionate|i bVII bVImaj7 Vaug7
Sophisticated|i7 bIIIM7 v9 bVIImaj7/IV
Colourful|iadd9 iv9 bVIM7#11 V7b9`};
const degree={I:0,II:2,III:4,IV:5,V:7,VI:9,VII:11};
function parse(token){
 const [body,bass]=token.split('/'),m=/^([b#]?)(VII|III|VI|IV|II|V|I|vii|iii|vi|iv|ii|v|i)(.*)$/.exec(body);
 if(!m)throw Error('Unknown reference chord: '+token);
 const [,acc,roman,s]=m,root=degree[roman.toUpperCase()]+(acc==='b'?-1:acc==='#'?1:0);
 let notes=s.includes('sus2')?[0,2,7]:s.includes('sus4')?[0,5,7]:s.includes('°')?[0,3,6]:s.includes('aug')?[0,4,8]:roman===roman.toLowerCase()?[0,3,7]:[0,4,7];
 if(/(?:maj|M)(?:7|9)/.test(s))notes.push(11);else if(/7|9|11|13/.test(s.replace(/add(?:#|b)?\d+/g,'')))notes.push(s.includes('°')?9:10);
 if(/(?:maj9|(?<!add)9|11|13)/.test(s))notes.push(14);
 if(/(?<!add)11|13/.test(s))notes.push(17);
 if(s.includes('13'))notes.push(21);
 for(const a of s.matchAll(/add([b#]?)(\d+)/g)){const n=Number(a[2]),scale=[0,2,4,5,7,9,11];notes.push(scale[(n-1)%7]+12*Math.floor((n-1)/7)+(a[1]==='b'?-1:a[1]==='#'?1:0));}
 if(s.includes('b5'))notes=notes.map(n=>n===7?6:n);
 if(s.includes('#5'))notes=notes.map(n=>n===7?8:n);
 if(s.includes('#11'))notes=notes.map(n=>n===17?18:n);
 if(s.includes('b9'))notes=notes.map(n=>n===14?13:n);
 const offset=bass?parse(bass)[0]:0;
 return [...new Set(notes.map(n=>root+n+offset))];
}
export const REFERENCE_HARMONIES=Object.fromEntries(Object.entries(rows).flatMap(([mode,text])=>text.split('\n').map((row,index)=>{const [name,sequence]=row.split('|');return [`reference-${mode.toLowerCase()}-${index+1}`,{name,mode,progression:sequence.replaceAll(' ',' · ').replaceAll('b','♭'),chords:sequence.split(' ').map(parse),exact:true}];})));
