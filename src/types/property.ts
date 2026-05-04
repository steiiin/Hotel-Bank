export class PropertyImprovement {
  name: string;
  stars: number;
  price: number;
  cost: Array<number>;

  constructor(name: string, stars: number, price: number, cost: Array<number>) {
    this.name = name;
    this.stars = stars;
    this.price = price;
    this.cost = cost;
  }
}

export class Property {
  name: string;
  price: number;
  forclosurePrice: number;
  entrancePrice: number;
  maxEntrances: number;
  improvements: PropertyImprovement[];

  constructor(
    name: string,
    price: number,
    forclosurePrice: number,
    entrancePrice: number,
    maxEntrances: number,
    improvements: PropertyImprovement[],
  ) {
    this.name = name;
    this.price = price;
    this.forclosurePrice = forclosurePrice;
    this.entrancePrice = entrancePrice;
    this.maxEntrances = maxEntrances;
    this.improvements = improvements;
  }
}
