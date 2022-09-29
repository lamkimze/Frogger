import "./style.css";
import { fromEvent, interval, merge } from 'rxjs';
import { map, filter, scan } from 'rxjs/operators';
import { StatsError } from "webpack";

// large reference from the Tim's aestroid code
type ViewType = 'frog' | 'car' | 'target' | 'river' | 'plank' | 'LotusLeaf' | 'tiger' | 'tree'

// 
function main() {

  type Body = Readonly<{
    id: string,
    pos: Vec,
    vel: Vec,
    width: number,
    height: number,
    createTime: number,
    viewType: ViewType,
    radius: number,
    acc: Vec
  }>

  type State = Readonly<{
    frog: Body,
    score: number,
    maxScore: number,
    time: number,
    pos: Vec,
    cars: ReadonlyArray<Body>,
    planks: ReadonlyArray<Body>,
    tiger: ReadonlyArray<Body>,
    objCount: number,
    gameOver: boolean,
    exit: ReadonlyArray<Body>,
    leaf: ReadonlyArray<Body>,
    tree: ReadonlyArray<Body>
  }>

  // constants value
  const Constants = {
    CanvasW: 600,
    CanvasH: 780,
    InitX: 300,
    InitY: 700,
    CarWidth: 40,
    CarHeight: 20,
    startCarCount: 12,
    plankWidth: 70,
    plankHeight: 30,
    LotusLeafRadius: 20,
    tigerWidth: 40,
    treeWidth: 10,
    treeHeight: 20,
    StartTime: 0,
    TargetLength: 50,
    BonusPoint: 100
  } as const

  // creating 5 targets and 2 rivers with static movement
  const target1 = {
    width: Constants.TargetLength,
    pos: new Vec(60, 50),
    fill: false
  }
  const target2 = {
    width: Constants.TargetLength,
    pos: new Vec(180, 50),
    fill: false
  }
  const target3 = {
    width: Constants.TargetLength,
    pos: new Vec(300, 50),
    fill: false
  }
  const target4 = {
    width: Constants.TargetLength,
    pos: new Vec(420, 50),
    fill: false
  }
  const target5 = {
    width: Constants.TargetLength,
    pos: new Vec(540, 50),
    fill: false
  }

  const river1 = {
    width: 120,
    upperRange: 190,
    lowerRange: 290,
  }

  const river2 = {
    width: 120,
    upperRange: 460,
    lowerRange: 610,
  }

  const svg = document.querySelector("#svgCanvas") as SVGElement & HTMLElement;
  // creating scores in HTML
  const points = document.createElementNS(svg.namespaceURI, 'text');
  Object.entries({
    id: "Score",
    x: "10",
    y: String(Constants.CanvasH - 20),
    fill: 'black',
  }).forEach(([key, val]) => points.setAttribute(key, val));
  points.innerHTML = `Score: 0`;
  points.setAttribute("font-family", "Fantasy");
  points.setAttribute("font-size", "30px");
  svg.appendChild(points);

  // creating maximum score in HTML
  const maxPoint = document.createElementNS(svg.namespaceURI, 'text');
  Object.entries({
    id: "MaxScore",
    x: String(Constants.CanvasW - 200),
    y: String(Constants.CanvasH - 20),
    fill: 'black',
  }).forEach(([key, val]) => maxPoint.setAttribute(key, val));
  maxPoint.innerHTML = `Max Score: 0`;
  maxPoint.setAttribute("font-family", "Fantasy");
  maxPoint.setAttribute("font-size", "30px");
  svg.appendChild(maxPoint);

  // creating rectangle objects
  const createRect = (viewType: ViewType) => (oid: number) => (time: number) => (width: number) => (height: number) => (pos: Vec) => (vel: Vec) => (acc: Vec) =>
    <Body>{
      createTime: time,
      pos: pos,
      vel: vel,
      width: width,
      height: height,
      id: viewType + oid,
      viewType: viewType,
      radius: 0,
      acc: acc
    }

  // creating circle objects
  const createCirc = (viewType: ViewType) => (oid: number) => (time: number) => (radius: number) => (pos: Vec) => (vel: Vec) => (acc: Vec) =>
    <Body>{
      createTime: time,
      pos: pos,
      vel: vel,
      width: 0,
      height: 0,
      id: viewType + oid,
      viewType: viewType,
      radius: radius,
      acc: acc
    }

  // check if all the targets are filled or not
  const checkFullyFill = (target1.fill == true && target2.fill == true && target3.fill == true && target4.fill == true && target5.fill == true)

  // resetting all target into false which indicates not being filled yet
  const resetTarget = () => {
    target1.fill = false;
    target2.fill = false;
    target3.fill = false;
    target4.fill = false;
    target5.fill = false;
  }

  const
    // using the width and height to check the collision between two body(frog and rectangle object)
    bodiesCollided = ([pos, a, b]: [Vec, Body, Body]) =>
      // frog at left down of obj
      pos.x < b.pos.x && pos.y > b.pos.y ?
        b.pos.sub(pos).x < a.width / 2 && pos.sub(b.pos).y < a.height / 2 + b.height :
        // frog at right down of obj
        pos.x > b.pos.x && pos.y > b.pos.y ?
          pos.sub(b.pos).x < a.width / 2 + b.width && pos.sub(b.pos).y < a.height / 2 + b.height :
          // frog at left up of obj
          pos.x < b.pos.x && pos.y < b.pos.y ?
            b.pos.sub(pos).x < a.width / 2 && b.pos.sub(pos).y < a.height / 2 :
            // frog at right up od obj
            pos.x > b.pos.x && pos.y < b.pos.y ?
              pos.sub(b.pos).x < a.width / 2 + b.width && b.pos.sub(pos).y < a.height / 2 :
              // frog above obj
              pos.x == b.pos.x && pos.y < b.pos.y ?
                b.pos.sub(pos).y < a.height / 2 :
                // frog below
                pos.x == b.pos.x && pos.y > b.pos.y ?
                  pos.sub(b.pos).y < a.height / 2 + b.height :
                  // frog at left
                  pos.y == b.pos.y && pos.x < b.pos.x ?
                    b.pos.sub(pos).x < a.width / 2 :
                    // frog at right
                    pos.y == b.pos.y && pos.x > b.pos.x ?
                      pos.sub(b.pos).x < a.width / 2 + b.width :
                      pos.x == b.pos.x && pos.y == b.pos.y


  // handle all the collision between objects
  const handleCollision = (s: State) => {

    const
      // checking the collision between frog and leaf
      circleBodyCollided = ([pos, a, b]: [Vec, Body, Body]) => pos.sub(b.pos).len() < a.radius + b.radius,
      // check if cars hit the frog
      frogCollideCars = s.cars.filter(r => bodiesCollided([s.pos, s.frog, r])).length > 0,
      // check if frog is on the plank
      frogOnPlank = s.planks.filter(r => bodiesCollided([s.pos, s.frog, r])).length > 0,
      // check if frog is on the leaf
      frogOnLeaf = s.leaf.filter(r => circleBodyCollided([s.pos, s.frog, r])).length > 0,
      // check if tiger attack frog
      frogCollideTiger = s.tiger.filter(r => bodiesCollided([s.pos, s.frog, r])).length > 0,
      // ckeck if frog is in the river and does not on the plank
      frogCOllideRiver1 = s.pos.y < river1.lowerRange && s.pos.y > river1.upperRange && !frogOnPlank && !frogOnLeaf,
      frogCOllideRiver2 = s.pos.y < river2.lowerRange && s.pos.y > river2.upperRange && !frogOnPlank && !frogOnLeaf,
      // check if frog is exactly overlap with target or not (touching is not accepted)
      frogReachTarget1 = s.pos.x - target1.pos.x == 0 && s.pos.y - target1.pos.y == 0,
      frogReachTarget2 = s.pos.x - target2.pos.x == 0 && s.pos.y - target2.pos.y == 0,
      frogReachTarget3 = s.pos.x - target3.pos.x == 0 && s.pos.y - target3.pos.y == 0,
      frogReachTarget4 = s.pos.x - target4.pos.x == 0 && s.pos.y - target4.pos.y == 0,
      frogReachTarget5 = s.pos.x - target5.pos.x == 0 && s.pos.y - target5.pos.y == 0,
      // logic if frog hitted any of the target
      frogHitTarget = frogReachTarget1 || frogReachTarget2 || frogReachTarget3 || frogReachTarget4 || frogReachTarget5,

      // filling new target and get double point
      doublePoint =
        frogReachTarget1 && target1.fill == false || frogReachTarget2 && target2.fill == false ||
        frogReachTarget3 && target3.fill == false || frogReachTarget4 && target4.fill == false ||
        frogReachTarget5 && target5.fill == false,

      // check the target and change the target fill to indicate the target had been filled
      targetfilling = frogReachTarget1 ? target1.fill = true :
        frogReachTarget2 ? target2.fill = true :
          frogReachTarget3 ? target3.fill = true :
            frogReachTarget4 ? target4.fill = true :
              frogReachTarget5 ? target5.fill = true : false,


      // reset the all the targets and award 100 points and update the max score
      bonusPoint = () => {
        resetTarget()
        return Constants.BonusPoint;
      },

      // check if the player can obtain extra point or not(had fill all targets)
      checkValidation = (target1.fill == true && target2.fill == true && target3.fill == true &&
        target4.fill == true && target5.fill == true) ? bonusPoint() : 0


    return <State>{
      ...s,
      pos: frogHitTarget ? new Vec(initialState.pos.x, initialState.pos.y) : s.pos,
      score: checkFullyFill ? initialState.score : doublePoint ? s.score + 20 : frogHitTarget ? s.score + 10 : s.score,
      gameOver: frogCollideCars || frogCOllideRiver1 || frogCOllideRiver2 || frogCollideTiger,
      maxScore: checkValidation == Constants.BonusPoint ? s.score + Constants.BonusPoint > s.maxScore ? s.score + Constants.BonusPoint : s.maxScore : s.maxScore
    }
  }

  // initially create new trees
  const newTree = (TreeArray: number[], i: number) =>
    createRect("tree")(i)
      (Constants.StartTime)(Constants.treeWidth)(Constants.treeHeight)(new Vec(TreeArray[0], TreeArray[1]))
      (Vec.Zero)(Vec.Zero)

  // position to put tree
  const treePos = [[30, 400], [150, 400], [270, 400], [390, 400], [510, 400],
                    [120, 40],[235, 40],[355, 40],[475, 40]]

  // initially put the cars on the position given
  const startTree = treePos.map((elem, i) => newTree(elem, i))

  // initially create cars
  // creating new cars
  const newCar = (CarArray: number[], i: number) =>
    createRect("car")(i)
      (Constants.StartTime)(Constants.CarWidth)(Constants.CarHeight)(new Vec(CarArray[0], CarArray[1]))
      (CarArray[1] % 100 == 50 ? new Vec(CarArray[2], 0) : new Vec(-(CarArray[2]), 0))(new Vec(CarArray[3], 0))

  // position to put the cars
  const multiRowCars = [
    [100, 650, 0.8, 0.02], [300, 650, 0.8, 0.02], [500, 650, 0.8, 0.02],
    [0, 350, 0.6, 0.04], [200, 350, 0.6, 0.04], [400, 350, 0.6, 0.04],
    [100, 100, 0.5, 0.05], [300, 100, 0.5, 0.05], [500, 100, 0.5, 0.05],
  ]
  // initially put the cars on the position given
  const startCars = multiRowCars.map((elem, i) => newCar(elem, i))

  // initially create planks
  // creating new plank
  const newPlank = (PlankArray: number[], i: number) =>
    createRect("plank")(i)
      (Constants.StartTime)(Constants.plankWidth)(Constants.plankHeight)(new Vec(PlankArray[0], PlankArray[1]))
      ((PlankArray[1] + 10) % 100 == 50 ? new Vec(PlankArray[2], 0) : new Vec(-PlankArray[2], 0))(new Vec(PlankArray[3], 0))

  // position to spawn plank
  const multiRowPlank = [[100, 590, 0.9, 0.02], [300, 590, 0.9, 0.02], [500, 590, 0.9, 0.02],
  [100, 490, 0.5, 0.03], [300, 490, 0.5, 0.03], [500, 490, 0.5, 0.03],
  [100, 190, 1, 0.04], [300, 190, 1, 0.04], [500, 190, 1, 0.04]]

  // initially put the planks on the position given
  const startPlanks = multiRowPlank.map((elem, i) => newPlank(elem, i))

  // initially create Lotus Leaf
  // the position to spawn lotus leaf initially
  const LotusLeaf = [[90, 550], [300, 550], [510, 550],
  [150, 250], [330, 250], [510, 250]]

  // creating new lotus leaf
  const newLotusLeaf = (LotusLeafArray: number[], i: number) =>
    createCirc("LotusLeaf")(i)
      (Constants.StartTime)(Constants.LotusLeafRadius)(new Vec(LotusLeafArray[0], LotusLeafArray[1]))(Vec.Zero)(Vec.Zero)

  // initially put the lotus leaf on the position given
  const startLotusLeaf = LotusLeaf.map((elem, i) => newLotusLeaf(elem, i))

  // initally create tiger
  // the position to spawn tiger initially
  const tigerfleet = [[0, 280, 0.8], [200, 280, 0.8], [400, 280, 0.8],
  [100, 125, 0.8], [300, 125, 0.8], [500, 125, 0.8]]

  // creating new tiger
  const newTiger = (TigerArray: number[], i: number) =>
    createRect("tiger")(i)
      (Constants.StartTime)(Constants.tigerWidth)(Constants.tigerWidth)(new Vec(TigerArray[0], TigerArray[1]))
      (TigerArray[1] % 100 == 50 ? new Vec(TigerArray[2], 0) : new Vec(-(TigerArray[2]), 0))(new Vec(5, 0))

  // initially put the tigers on the location given
  const startTiger = tigerfleet.map((elem, i) => newTiger(elem, i))

  // initialsate as before the game start
  const initialState: State = {
    time: 0,
    frog: createFrog(),
    cars: startCars,
    score: 0,
    pos: new Vec(Constants.InitX, Constants.InitY),
    gameOver: false,
    exit: [],
    planks: startPlanks,
    leaf: startLotusLeaf,
    tiger: startTiger,
    objCount: Constants.startCarCount,
    maxScore: 0,
    tree: startTree
  }

  // control the movement according to their velocity 
  const moveObj = (o: Body) => <Body>{
    ...o,
    pos: o.pos.sub(o.vel),
    vel: o.vel.scale(1.01),
  }

  // time flow in the game
  const gameClock = interval(10)
    .pipe(map(elapsed => new Tick(elapsed)))

  const tick = (s: State, elapsed: number) => {
    const
      //place the expired cars and plank back to its original place
      revive = (b: Body) => b.pos.x > Constants.CanvasW + 2 ?
        ({
          ...b,
          pos: new Vec(0, b.pos.y)
        }) :
        b.pos.x < -5 ?
          ({
            ...b,
            pos: new Vec(Constants.CanvasW, b.pos.y)
          }) : b,
      // turn all the tigers to opposite direction once a tiger hit the boundary
      turnback = (b: Body) => ({
        ...b,
        pos: new Vec(b.pos.x, b.pos.y),
        vel: new Vec(0, 0).sub(b.vel)
      }),
      // check for things that are outside boundary
      expired = (b: Body) => b.pos.x > Constants.CanvasW + 2 || b.pos.x < -5,
      // cars outside boundary
      expiredCars: Body[] = s.cars.filter(expired),
      // cars still inside boundary
      activeCars = s.cars.filter(not(expired)),
      // convert a bunch of expired cars into active cars
      recycleCars: Body[] = expiredCars.map(e => revive(e)),
      // planks which are out of boundaries
      expiredPlanks: Body[] = s.planks.filter(expired),
      // planks which are inside the boundaries
      activePlanks = s.planks.filter(not(expired)),
      // convert all of the expired planks into avtive planks
      recyclePlanks: Body[] = expiredPlanks.map(e => revive(e)),
      // tigers that are hitting boudaries
      expiredTiger: Body[] = s.tiger.filter(expired),
      // all of the tigers change position once a tiger hit the boundaries or else nothing changes
      wanderTiger = expiredTiger.length > 0 ? s.tiger.map(e => turnback(e)) : s.tiger

    return handleCollision({
      ...s,
      frog: moveObj(s.frog),
      cars: activeCars.concat(recycleCars).map(moveObj),
      time: elapsed,
      exit: s.exit.concat(expiredCars, expiredPlanks, expiredTiger),
      objCount: s.objCount + 1,
      planks: activePlanks.concat(recyclePlanks).map(moveObj),
      tiger: wanderTiger.map(moveObj)
    })
  }

  // creating a frog with some instances
  function createFrog(): Body {
    return {
      id: 'frog',
      viewType: 'frog',
      pos: new Vec(Constants.InitX, Constants.InitY),
      vel: Vec.Zero,
      width: 40,
      height: 30,
      createTime: 0,
      radius: 10,
      acc: Vec.Zero
    }
  }

  // classes to determine plater behaviour
  class Movement { constructor(public readonly x: number, public readonly y: number) { } }
  class Tick { constructor(public readonly elapsed: number) { } }
  class Reset { constructor() { } }

  type Event = 'keydown'
  type Key = 'ArrowLeft' | 'ArrowRight' | 'ArrowUp' | 'ArrowDown' | 'Space'

  const observeKey = <T>(eventName: Event, k: Key, result: () => T) =>
    fromEvent<KeyboardEvent>(document, eventName)
      .pipe(
        filter(({ code }) => code === k),
        filter(({ repeat }) => !repeat),
        map(result)
      )

  // keyboard event map to their action
  const
    moveLeft$ = observeKey('keydown', 'ArrowLeft', () => new Movement(-30, 0)),
    moveRight$ = observeKey('keydown', 'ArrowRight', () => new Movement(30, 0)),
    moveFront$ = observeKey('keydown', 'ArrowUp', () => new Movement(0, -50)),
    moveBack$ = observeKey('keydown', 'ArrowDown', () => new Movement(0, 50)),
    reset = observeKey('keydown', 'Space', () => new Reset())

  // check if there exist a tree
  const
    checkTreeExist = (s:State)=> (pos:Vec)=> {
      const 
      treeExist = s.tree.filter(r => bodiesCollided([pos, s.frog, r])).length > 0;
      return treeExist
    }

  // wrap frog inside the map
  const torusWrap = (s: State) => (e: Movement) => {
    const newPos = s.pos.add(new Vec(e.x, e.y));
    return newPos.x < Constants.CanvasW &&
      newPos.x > 0 &&
      newPos.y < Constants.CanvasH &&
      newPos.y > 0 &&
      !(checkTreeExist(s)(newPos))?
      newPos : s.pos
  }

  // detect the input of user
  const reduceState = (s: State, e: Movement | Tick | Reset) => {
    // check the movement action
    if (e instanceof Movement) {
      return {
        ...s,
        pos: torusWrap(s)(e)
      }
    }
    // check the reset action
    else if (e instanceof Reset) {
      if (s.gameOver) {
        const v = document.getElementById("gameover");
        if (v) svg.removeChild(v);
        const w = document.getElementById("endScore");
        if (w) svg.removeChild(w);
        resetTarget();
        return {
          ...initialState,
          gameover: false,
          exit: s.exit.concat(s.cars, s.planks, s.tiger)
        }
      } else {
        return s
      }
    }
    // tick action
    else {
      if (!s.gameOver) {
        return tick(s, e.elapsed)
      }
      else {
        return s
      }
    }
  }


  // update the game page 
  function updateView(state: State): void {
    if (!state.gameOver) {
      const svg = document.querySelector("#svgCanvas") as SVGElement & HTMLElement;

      // remove expired object
      state.exit.forEach(o => {
        const v = document.getElementById(o.id);
        if (v) svg.removeChild(v);
      })

      // fill the target of the frog reached 
      const show = (id: string, condition: boolean) => ((e: HTMLElement) =>
        condition ? e.classList.remove('hidden') :
          e.classList.add('hidden'))(document.getElementById(id)!)

      show("targetfill1", target1.fill),
        show("targetfill2", target2.fill),
        show("targetfill3", target3.fill),
        show("targetfill4", target4.fill),
        show("targetfill5", target5.fill)

      // update the score instantly
      const updatePoints = document.getElementById("Score")!;
      updatePoints.innerHTML = `Score: ${state.score}`

      // update the maximum score instantly
      const updateMaxPoint = document.getElementById("MaxScore")!;
      updateMaxPoint.innerHTML = `Max Score: ${state.maxScore}`

      // creating a car object
      const updateRectBodyView = (b: Body) => {
        function createBodyView() {
          const rect = document.createElementNS(svg.namespaceURI, 'rect')!;
          rect.setAttribute("id", b.id);
          rect.setAttribute('height', String(b.height));
          rect.setAttribute('width', String(b.width));
          b.viewType == 'tiger' ? rect.setAttribute("fill", "#ffd700") :
            b.viewType == 'car' ? rect.setAttribute("fill", "salmon") :
              rect.setAttribute("fill", "#2e0101")
          rect.classList.add(b.viewType);
          svg.appendChild(rect)
          return rect;
        }
        // set the position of rectangle object
        const rect = document.getElementById(b.id) || createBodyView();
        rect.setAttribute('x', String(b.pos.x));
        rect.setAttribute('y', String(b.pos.y));
      };

      // create circle object
      const updateCircBodyView = (b: Body) => {
        function createCircBodyView() {
          const circle = document.createElementNS(svg.namespaceURI, 'ellipse')!;
          circle.setAttribute("id", b.id);
          circle.setAttribute("rx", String(b.radius));
          circle.setAttribute("ry", String(b.radius));
          b.viewType == 'LotusLeaf' ? circle.setAttribute("fill", "#83ed83") : circle.setAttribute("fill", "#a52a2a");
          circle.classList.add(b.viewType);
          svg.appendChild(circle)
          return circle;
        }
        // set the position of circle object
        const circ = document.getElementById(b.id) || createCircBodyView();
        circ.setAttribute("cx", String(b.pos.x));
        circ.setAttribute("cy", String(b.pos.y));
      }
      state.tiger.forEach(updateRectBodyView)
      state.cars.forEach(updateRectBodyView)
      state.planks.forEach(updateRectBodyView)
      state.tree.forEach(updateRectBodyView)
      state.leaf.forEach(updateCircBodyView)

      const frog = document.getElementById("frog")!;
      svg.appendChild(frog)

      // update the frog to a new coordinate
      frog.setAttribute('transform', `translate(${state.pos.x},${state.pos.y})`)
    }
    // unable subscription and stop everything and show some text
    else {
      // subscription.unsubscribe();
      // creating text gameover and showing the final score
      const createGameOverview = () => {
        const v = document.createElementNS(svg.namespaceURI, "text")!;
        v.setAttribute('x', String(Constants.CanvasW / 8));
        v.setAttribute('y', String(Constants.CanvasH / 2 + 80));
        v.setAttribute('class', "gameover");
        v.setAttribute('id', "gameover");
        v.textContent = "Game Over !!";
        svg.appendChild(v);
        return v;
      }
      const v = document.getElementById("gameover") || createGameOverview();

      // showing the final score
      const createFinalScoreview = () => {
        const w = document.createElementNS(svg.namespaceURI, "text")!;
        w.setAttribute('x', String(Constants.CanvasW / 8));
        w.setAttribute('y', String(Constants.CanvasH / 2));
        w.setAttribute('class', "score");
        w.setAttribute('id', "endScore")
        w.textContent = "Your Max-Score: " + String(state.maxScore);
        svg.appendChild(w);
        return w;
      }
      const w = document.getElementById("endScore") || createFinalScoreview();
    }
  }

  // movement subscription
  const subscription =
    merge(gameClock, moveBack$, moveFront$, moveLeft$, moveRight$, reset)
      .pipe(
        scan(reduceState, initialState)
      ).subscribe(updateView)
}

// vector class to handle all the calculation of movement
// adapt from Tim's aestroid code (little modification)
class Vec {
  constructor(public readonly x: number = 0, public readonly y: number = 0) { }
  add = (b: Vec) => new Vec(this.x + b.x, this.y + b.y)
  sub = (b: Vec) => this.add(b.deduce(-1))
  len = () => Math.sqrt(this.x * this.x + this.y * this.y)
  scale = (s: number) => new Vec(this.x, this.y * s)
  deduce = (s: number) => new Vec(this.x * s, this.y * s)
  ortho = () => new Vec(this.y, -this.x)
  static Zero = new Vec();
}

const not = <T>(f: (x: T) => boolean) => (x: T) => !f(x)

// The following simply runs your main function on window load.  Make sure to leave it in place.
if (typeof window !== "undefined") {
  window.onload = () => {
    main();
  };
}