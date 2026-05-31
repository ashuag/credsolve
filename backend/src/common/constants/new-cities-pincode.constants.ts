import { INDIAN_CITIES } from './city.constants';

const city = (name: string) => INDIAN_CITIES.find((c) => c.name === name)!.id;

// ── Andhra Pradesh ───────────────────────────────────────────────────────────
export const VIJAYAWADA_CITY_ID  = city('VIJAYAWADA');
export const GUNTUR_CITY_ID      = city('GUNTUR');
export const NELLORE_CITY_ID     = city('NELLORE');
export const KURNOOL_CITY_ID     = city('KURNOOL');
export const RAJAHMUNDRY_CITY_ID = city('RAJAHMUNDRY');
export const KADAPA_CITY_ID      = city('KADAPA');
export const CHITTOOR_CITY_ID    = city('CHITTOOR');
export const NARASARAOPET_CITY_ID = city('NARASARAOPET');
export const ONGOLE_CITY_ID      = city('ONGOLE');
export const SRIKAKULAM_CITY_ID  = city('SRIKAKULAM');

export const VIJAYAWADA_PINCODES  = ['520015'] as const;
export const GUNTUR_PINCODES      = ['522003', '522647'] as const;
export const NELLORE_PINCODES     = ['524001', '524003', '524004'] as const;
export const KURNOOL_PINCODES     = ['518003'] as const;
export const RAJAHMUNDRY_PINCODES = ['533101'] as const;
export const KADAPA_PINCODES      = ['516001'] as const;
export const CHITTOOR_PINCODES    = ['517408', '517425'] as const;
export const NARASARAOPET_PINCODES = ['522601'] as const;
export const ONGOLE_PINCODES      = ['523001', '523201'] as const;
export const SRIKAKULAM_PINCODES  = ['532407'] as const;

// ── Arunachal Pradesh ────────────────────────────────────────────────────────
export const ITANAGAR_CITY_ID = city('ITANAGAR');
export const PASIGHAT_CITY_ID = city('PASIGHAT');

export const ITANAGAR_NEW_PINCODES = ['791004', '791114'] as const;
export const PASIGHAT_PINCODES     = ['791701'] as const;

// ── Manipur ──────────────────────────────────────────────────────────────────
export const IMPHAL_CITY_ID        = city('IMPHAL');
export const SENAPATI_CITY_ID      = city('SENAPATI');
export const CHURACHANDPUR_CITY_ID = city('CHURACHANDPUR');

export const IMPHAL_NEW_PINCODES      = ['795011'] as const;
export const SENAPATI_PINCODES        = ['795105'] as const;
export const CHURACHANDPUR_PINCODES   = ['795121'] as const;

// ── Meghalaya ────────────────────────────────────────────────────────────────
export const SHILLONG_CITY_ID   = city('SHILLONG');
export const TURA_CITY_ID       = city('TURA');
export const NONGSTOIN_CITY_ID  = city('NONGSTOIN');
export const BAGHMARA_CITY_ID   = city('BAGHMARA');

export const SHILLONG_NEW_PINCODES = ['793126', '793161'] as const;
export const TURA_PINCODES         = ['794003', '794004'] as const;
export const NONGSTOIN_PINCODES    = ['793116'] as const;
export const BAGHMARA_PINCODES     = ['794113'] as const;

// ── Mizoram ──────────────────────────────────────────────────────────────────
export const KOLASIB_CITY_ID   = city('KOLASIB');
export const MAMIT_CITY_ID     = city('MAMIT');
export const LAWNGTLAI_CITY_ID = city('LAWNGTLAI');

export const KOLASIB_PINCODES   = ['796246'] as const;
export const MAMIT_PINCODES     = ['796291'] as const;
export const LAWNGTLAI_PINCODES = ['796470'] as const;

// ── Nagaland ─────────────────────────────────────────────────────────────────
export const PEREN_CITY_ID      = city('PEREN');
export const MOKOKCHUNG_CITY_ID = city('MOKOKCHUNG');
export const MON_CITY_ID        = city('MON');

export const PEREN_PINCODES      = ['797118'] as const;
export const MOKOKCHUNG_PINCODES = ['798607'] as const;
export const MON_PINCODES        = ['798628'] as const;

// ── Tripura ───────────────────────────────────────────────────────────────────
export const AGARTALA_CITY_ID    = city('AGARTALA');
export const BISHALGARH_CITY_ID  = city('BISHALGARH');
export const UDAIPUR_TR_CITY_ID  = INDIAN_CITIES.find((c) => c.name === 'UDAIPUR' && c.stateId === 25)!.id;
export const DHARMANAGAR_CITY_ID = city('DHARMANAGAR');

export const AGARTALA_NEW_PINCODES  = ['799011'] as const;
export const BISHALGARH_PINCODES    = ['799113'] as const;
export const UDAIPUR_TR_PINCODES    = ['799132'] as const;
export const DHARMANAGAR_PINCODES   = ['799282'] as const;

// ── Jammu and Kashmir ────────────────────────────────────────────────────────
export const JAMMU_CITY_ID     = city('JAMMU');
export const RAMBAN_CITY_ID    = city('RAMBAN');
export const UDHAMPUR_CITY_ID  = city('UDHAMPUR');
export const KISHTWAR_CITY_ID  = city('KISHTWAR');
export const KATHUA_CITY_ID    = city('KATHUA');
export const RAJOURI_CITY_ID   = city('RAJOURI');
export const SRINAGAR_CITY_ID  = city('SRINAGAR');
export const BARAMULLA_CITY_ID = city('BARAMULLA');
export const KUPWARA_CITY_ID   = city('KUPWARA');
export const BANDIPORA_CITY_ID = city('BANDIPORA');

export const JAMMU_PINCODES     = ['181008', '181134', '181208'] as const;
export const RAMBAN_PINCODES    = ['182129', '182130'] as const;
export const UDHAMPUR_PINCODES  = ['182131', '182132', '182133', '182134', '182135', '182136', '182137', '182138', '182139', '182140'] as const;
export const KISHTWAR_PINCODES  = ['182207'] as const;
export const KATHUA_PINCODES    = ['184210'] as const;
export const RAJOURI_PINCODES   = ['185133'] as const;
export const SRINAGAR_PINCODES  = ['190099'] as const;
export const BARAMULLA_PINCODES = ['193109'] as const;
export const KUPWARA_PINCODES   = ['193306'] as const;
export const BANDIPORA_PINCODES = ['193505'] as const;
