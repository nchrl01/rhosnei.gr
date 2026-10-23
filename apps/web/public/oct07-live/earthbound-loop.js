// One cycle of the visual clock. Live market changes remain independent inputs.
export const EARTHBOUND_LOOP_DURATION=24;
export const TAU=2*Math.PI;
export function loopTime(time=0){const value=Number(time);return Number.isFinite(value)?((value%EARTHBOUND_LOOP_DURATION)+EARTHBOUND_LOOP_DURATION)%EARTHBOUND_LOOP_DURATION:0;}
export function loopPhase(time=0){return loopTime(time)/EARTHBOUND_LOOP_DURATION*TAU;}
export function loopTurns(rate){return Math.sign(rate)*Math.max(1,Math.round(Math.abs(rate)*EARTHBOUND_LOOP_DURATION/TAU));}
