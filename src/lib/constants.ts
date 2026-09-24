/**
 * Nad touto výškou bereme místo jako exponované: v českých horách zhruba hranice
 * lesa, odkud se před bouřkou ani větrem nemáš kam schovat.
 */
export const EXPOSED_ABOVE_M = 1200

/** Sníh se hlásí v centimetrech, srážky v milimetrech vody. Open-Meteo drží poměr 1 : 0,7. */
export const SNOW_CM_PER_MM = 0.7

/**
 * Nárazy na hřebeni jako násobek větru ve volné atmosféře. Naměřeno na Sněžce
 * (IMGW, leden—srpen 2026): medián poměru náraz / průměrný vítr je 1,5.
 * S touhle spodní hranicí model zachytí 76 % hodin s nárazy nad 75 km/h
 * místo 64 %.
 */
export const RIDGE_GUST_FACTOR = 1.5
