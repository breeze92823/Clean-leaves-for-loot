// The tutorial's step machine, free of any game imports so it can be unit-tested (tutorial.js feeds it
// the live numbers each frame). Steps: 0 train power, 1 blow leaves till loot shows, 2 collect loot worth
// the vacuum, 3 walk to the Sell stall, 4 press Sell All, 5 close the window, 6 walk to the Vacuums
// stall, 7 buy the vacuum, `done` = finished.
//
// c = { power, powerGoal, cash, cost, worth, bagCount, bagFull, unlockedLeft, hasLoot, sellOpen,
//       vacuumsOpen, bought, done }
// Returns the step to be on now (it may go back, e.g. when the bag was sold for too little).
export function nextStep(step, c) {
  if (step >= c.done) return step
  const afford = c.cash >= c.cost
  switch (step) {
    case 0:
      return c.power >= c.powerGoal ? 1 : 0
    case 1:
      return c.hasLoot || c.bagCount > 0 ? 2 : 1
    case 2:
      if (afford) return 6 // already rich enough: skip the selling lesson
      return c.worth >= c.cost - c.cash || c.bagFull ? 3 : 2
    case 3:
      if (c.sellOpen) return 4
      if (c.bagCount === 0) return afford ? 6 : 2
      return 3
    case 4:
      if (c.unlockedLeft === 0) return c.sellOpen ? 5 : afford ? 6 : 2
      return c.sellOpen ? 4 : 3
    case 5:
      return c.sellOpen ? 5 : afford ? 6 : 2
    case 6:
      if (c.bought) return c.done
      if (c.vacuumsOpen) return 7
      return afford ? 6 : 2
    case 7:
      if (c.bought) return c.done
      return c.vacuumsOpen ? 7 : 6
    default:
      return step
  }
}
