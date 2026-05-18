import { Property, PropertyImprovement } from '../types';

export type PropertyKey = typeof PROPERTY_KEYS[keyof typeof PROPERTY_KEYS];
export type PropertyRecord = Record<PropertyKey, Property>;

export const PROPERTY_KEYS = {
  boomerang: 'hotel-boomerang',
  fujiyama: 'hotel-fujiyama',
  liberty: 'hotel-liberty',
  mirasol: 'hotel-mirasol',
  montBlanc: 'hotel-montblanc',
  regency: 'hotel-regency',
  sahara: 'hotel-sahara',
  waikiki: 'hotel-waikiki',
} as const;

export const properties = {
  [PROPERTY_KEYS.boomerang]: new Property(
    'BOOMERANG BAY', 500, 250, 100, 4,
    [
      new PropertyImprovement('Hauptgebäude',   1, 1800, [ 400, 800,1200,1600,2000,2400]),
      new PropertyImprovement('Freizeitanlage', 2,  250, [ 600,1200,1800,2400,3000,3600]),
    ]
  ),
  [PROPERTY_KEYS.fujiyama]: new Property(
    'FUJIYAMA', 1000, 500, 100, 6,
    [
      new PropertyImprovement('Hauptgebäude',   1, 2200, [  50,100,150, 200, 250, 300]),
      new PropertyImprovement('Gebäude 2',      1, 1400, [  50,100,150, 200, 250, 300]),
      new PropertyImprovement('Gebäude 3',      2, 1400, [ 100,200,300, 400, 500, 600]),
      new PropertyImprovement('Freizeitanlage', 3,  500, [ 250,500,750,1000,1250,1500]),
    ]
  ),
  [PROPERTY_KEYS.liberty]: new Property(
    'LIBERTY', 3500, 1750, 250, 7,
    [
      new PropertyImprovement('Hauptgebäude',   1, 5000, [ 200, 400, 600, 800,1000,1200]),
      new PropertyImprovement('Gebäude 2',      2, 3000, [ 400, 800,1200,1600,2000,2400]),
      new PropertyImprovement('Gebäude 3',      3, 2250, [ 600,1200,1800,2400,3000,3600]),
      new PropertyImprovement('Gebäude 4',      4, 1750, [ 800,1600,2400,3200,4000,4800]),
      new PropertyImprovement('Freizeitanlage', 5, 5000, [1200,2400,3600,4800,6000,7200]),
    ]
  ),
  [PROPERTY_KEYS.mirasol]: new Property(
    'MIRASOL', 2500, 1250, 200, 10,
    [
      new PropertyImprovement('Hauptgebäude',   1, 3600, [ 150, 300, 450, 600, 750, 900]),
      new PropertyImprovement('Gebäude 2',      2, 2600, [ 300, 600, 900,1200,1500,1800]),
      new PropertyImprovement('Gebäude 3',      2, 1800, [ 300, 600, 900,1200,1500,1800]),
      new PropertyImprovement('Gebäude 4',      3, 1800, [ 450, 900,1350,1800,2250,2700]),
      new PropertyImprovement('Freizeitanlage', 4, 3000, [ 600,1200,1800,2400,3000,3600]),
    ]
  ),
  [PROPERTY_KEYS.montBlanc]: new Property(
    'MONT BLANC', 2000, 1000, 150, 4,
    [
      new PropertyImprovement('Hauptgebäude',   1, 2600, [ 100, 200, 300, 400, 500, 600 ]),
      new PropertyImprovement('Gebäude 2',      1, 1200, [ 100, 200, 300, 400, 500, 600 ]),
      new PropertyImprovement('Gebäude 3',      2, 1200, [ 250, 500, 750,1000,1250,1500 ]),
      new PropertyImprovement('Freizeitanlage', 3, 2000, [ 500,1000,1500,2000,2500,3000 ]),
    ]
  ),
  [PROPERTY_KEYS.regency]: new Property(
    'REGENCY', 3000, 1500, 250, 8,
    [
      new PropertyImprovement('Hauptgebäude',   1, 3300, [ 150, 300, 450, 600, 750, 900 ]),
      new PropertyImprovement('Gebäude 2',      2, 2200, [ 300, 600, 900,1200,1500,1800 ]),
      new PropertyImprovement('Gebäude 3',      2, 1800, [ 300, 600, 900,1200,1500,1800 ]),
      new PropertyImprovement('Gebäude 4',      2, 1800, [ 300, 600, 900,1200,1500,1800 ]),
      new PropertyImprovement('Gebäude 5',      3, 1800, [ 450, 900,1350,1800,2250,2700 ]),
      new PropertyImprovement('Freizeitanlage', 4, 4000, [ 750,1500,2250,3000,3750,4500 ]),
    ]
  ),
  [PROPERTY_KEYS.sahara]: new Property(
    'SAHARA', 1500, 750, 100, 5,
    [
      new PropertyImprovement('Hauptgebäude',   1, 2400, [ 100, 200, 300, 400, 500, 600 ]),
      new PropertyImprovement('Gebäude 2',      1, 1000, [ 100, 200, 300, 400, 500, 600 ]),
      new PropertyImprovement('Gebäude 3',      2,  500, [ 200, 400, 600, 800,1000,1200 ]),
      new PropertyImprovement('Freizeitanlage', 3, 1000, [ 300, 600, 900,1200,1500,1800 ]),
    ]
  ),
  [PROPERTY_KEYS.waikiki]: new Property(
    'WAIKIKI', 2500, 1250, 200, 5,
    [
      new PropertyImprovement('Hauptgebäude',   1, 3500, [ 200, 400, 600, 800,1000,1200 ]),
      new PropertyImprovement('Gebäude 2',      2, 2500, [ 350, 700,1050,1400,1750,2100 ]),
      new PropertyImprovement('Gebäude 3',      2, 2500, [ 500,1000,1500,2000,2500,3000 ]),
      new PropertyImprovement('Gebäude 4',      2, 1750, [ 500,1000,1500,2000,2500,3000 ]),
      new PropertyImprovement('Gebäude 5',      3, 1750, [ 650,1300,1950,2600,3250,3900 ]),
      new PropertyImprovement('Freizeitanlage', 5, 2500, [1000,2000,3000,4000,5000,6000 ]),
    ]
  ),
} satisfies PropertyRecord;

export const propertyKeys = Object.keys(properties);
