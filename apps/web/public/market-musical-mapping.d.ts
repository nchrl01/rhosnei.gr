export interface MarketMusicalMapping {
 active:boolean;
 excitation:number;
 known:{marketCap:boolean;liquidity:boolean;holders:boolean;change:boolean;activity:boolean};
 rhythm:{size:number;rate:number;regularity:number};
 harmony:{musicality:number;stability:number;gate:number};
 arpeggio:{population:number;notes:number;span:number};
 change:{direction:number;magnitude:number;signed:number};
 tempo:{activity:number;bpm:number};
}
export function marketMusicalMapping(signal?:object):MarketMusicalMapping;
