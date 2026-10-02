export function hardstyleActive(m,enabled=true){return enabled&&Number.isFinite(m.context?.latestCap)&&m.context.latestCap>=1000000&&m.fresh>0;}
