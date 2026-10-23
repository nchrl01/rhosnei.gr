export interface ChipSignal {
 price:number;
 delta:number;
 activity:number;
 volume:number;
 motion:number;
 intensity:number;
 balance:number;
 balanceKnown:boolean;
 tradeRate:number;
 tradeRateKnown:boolean;
 volumeKnown:boolean;
 fresh:number;
 observed:boolean;
 observationFingerprint:number;
 fingerprint:number;
 source:string;
}
export interface ChipScoreEvent {
 beat:number;
 midi?:number;
 duration:number;
 gain:number;
 kind:string;
 drum?:string;
 channel?:number;
 chip?:number;
 seed?:number;
 expression?:Record<string,unknown>;
 parameters?:Record<string,unknown>;
}
export interface ChipScorePlan {
 events:ChipScoreEvent[];
 signal:ChipSignal;
 harmony:{root:number;index:number;notes:number[];name:string;character:string;group:string};
 development:{stage:string;motifId:string;supportGain:number;cadenceBeat:number|null;sourceBar:number};
 groove:string;
 drums:{patternId:string;density:number;deviation:number;performance?:number};
}
export function chipHash(seed:number,value:number):number;
export function marketChipSignal(context?:Record<string,unknown>):ChipSignal;
export function chipSignalActive(signal:ChipSignal):boolean;
export function composeChipBar(seed:number,bar:number,context?:Record<string,unknown>):ChipScorePlan;

export function chipPhraseArrangement(seed:number,beat:number):{rest:boolean;restInBeats:number;restStartBeat:number;restEndBeat:number;phraseGain:number;layers:Record<string,number>};
