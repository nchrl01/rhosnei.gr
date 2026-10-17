export interface CompositionEvent {beat:number;midi:number;duration:number;gain:number;kind:string}
export function composeMarketBar(seed:number,bar:number,context:Record<string,unknown>,motif?:unknown[]):{events:CompositionEvent[];harmony:unknown};
