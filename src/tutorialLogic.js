// The tutorial's step machine, free of any game imports so it can be unit-tested (tutorial.js feeds it
// the live numbers each frame). Steps: 0 hold click to train a little, 1 walk to the x1.5 training pile
// and train to the goal, 2 blow leaves till loot shows, 3 collect loot worth the vacuum, 4 walk to the
// Sell stall, 5 press Sell All, 6 close the window, 7 walk to the Vacuums stall, 8 buy the vacuum,
// `done` = finished.
//
// c = { power, clickGoal, powerGoal, cash, cost, worth, bagCount, bagFull, unlockedLeft, hasLoot,
//       sellOpen, vacuumsOpen, bought, done }
// Returns the step to be on now (it may go back, e.g. when the bag was sold for too little).
export function nextStep(step, c) {
  if (step >= c.done) return step
  const afford = c.cash >= c.cost
  switch (step) {
    case 0:
      if (c.power >= c.powerGoal) return 2
      return c.power >= c.clickGoal ? 1 : 0
    case 1:
      return c.power >= c.powerGoal ? 2 : 1
    case 2:
      return c.hasLoot || c.bagCount > 0 ? 3 : 2
    case 3:
      if (afford) return 7 // already rich enough: skip the selling lesson
      return c.worth >= c.cost - c.cash || c.bagFull ? 4 : 3
    case 4:
      if (c.sellOpen) return 5
      if (c.bagCount === 0) return afford ? 7 : 3
      return 4
    case 5:
      if (c.unlockedLeft === 0) return c.sellOpen ? 6 : afford ? 7 : 3
      return c.sellOpen ? 5 : 4
    case 6:
      return c.sellOpen ? 6 : afford ? 7 : 3
    case 7:
      if (c.bought) return c.done
      if (c.vacuumsOpen) return 8
      return afford ? 7 : 3
    case 8:
      if (c.bought) return c.done
      return c.vacuumsOpen ? 8 : 7
    default:
      return step
  }
}
