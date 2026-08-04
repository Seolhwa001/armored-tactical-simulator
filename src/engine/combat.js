// src/engine/combat.js — 새 파일, 1~274행


const DIRECT_FIRE_AMMUNITION = new Set([

"apfsds",

"heat",

"canister",

]);


const DIRECT_HIT_UNIT_TYPES = new Set([

"artillery-observer",

"atgm-team",

]);


const AMMUNITION_DAMAGE = Object.freeze({

apfsds: {

minimum: 42,

maximum: 68,

accuracy: 0.82,

},


heat: {

minimum: 34,

maximum: 58,

accuracy: 0.76,

},


canister: {

minimum: 18,

maximum: 36,

accuracy: 0.72,

},


smoke: {

minimum: 0,

maximum: 0,

accuracy: 1,

},

});


const SMOKE_DURATION_TURNS = 3;

const SMOKE_RADIUS = 1;


function clamp(

value,

minimum,

maximum,

) {

return Math.min(

maximum,

Math.max(

minimum,

value,

),

);

}


function randomBetween(

minimum,

maximum,

) {

return (

minimum +

Math.random() *

(maximum - minimum)

);

}


function getTargetUnit(

runtimeScenario,

shooter,

) {

const targetUnitId =

shooter.fireControl

?.targetUnitId;


if (targetUnitId) {

return (

runtimeScenario.units.find(

(unit) =>

unit.id ===

targetUnitId &&

!unit.destroyed,

) ?? null

);

}


const targetHex =

shooter.fireControl

?.targetHex;


if (!targetHex) {

return null;

}


return (

runtimeScenario.units.find(

(unit) =>

unit.side !==

shooter.side &&

!unit.destroyed &&

unit.column ===

targetHex.column &&

unit.row ===

targetHex.row,

) ?? null

);

}


function calculateHitChance(

shooter,

target,

shotOptions,

) {

const ammunition =

shooter.fireControl

?.ammunition;


const ammunitionData =

AMMUNITION_DAMAGE[

ammunition

] ??

AMMUNITION_DAMAGE.heat;


const aimStability =

clamp(

shotOptions

.aimStability ??

shooter.fireControl

?.aimStability ??

1,

0,

1,

);


const movingPenalty =

clamp(

shotOptions

.movingFirePenalty ??

0,

0,

0.9,

);


const concealmentPenalty =

clamp(

(

target?.concealment ??

0

) / 250,

0,

0.35,

);


return clamp(

ammunitionData.accuracy *

aimStability -

movingPenalty -

concealmentPenalty,

0.05,

0.95,

);

}


function calculateDamage(

shooter,

target,

) {

const ammunition =

shooter.fireControl

?.ammunition;


if (

DIRECT_HIT_UNIT_TYPES.has(

target.type,

) &&

DIRECT_FIRE_AMMUNITION.has(

ammunition,

)

) {

return (

target.health?.current ??

1

);

}


const damageData =

AMMUNITION_DAMAGE[

ammunition

] ??

AMMUNITION_DAMAGE.heat;


const resistance =

clamp(

(

target.protection

?.explosionResistance ??

0

) / 100,

0,

0.75,

);


const rawDamage =

randomBetween(

damageData.minimum,

damageData.maximum,

);


return Math.max(

1,

Math.round(

rawDamage *

(1 - resistance),

),

);

}


function stopDestroyedUnit(unit) {

unit.destroyed = true;

unit.condition = "격파";

unit.command = "행동 불가";


unit.destination = null;

unit.plannedPath = [];


if (unit.action) {

unit.action.type = "idle";

unit.action.targetHex = null;

unit.action.targetUnitId = null;

unit.action.direction = null;

unit.action.crewRole = null;

}


if (unit.fireControl) {

unit.fireControl.state =

"stopped";


unit.fireControl.procedureState =  
  "stopped";  

unit.fireControl.targetHex =  
  null;  

unit.fireControl.targetUnitId =  
  null;  

unit.fireControl.loading =  
  false;  

unit.fireControl.loaded =  
  false;  

unit.fireControl.aiming =  
  false;  

unit.fireControl  
  .gunnerAutonomous =  
  false;  



}


if (unit.turretControl) {

unit.turretControl.rotating =

false;


unit.turretControl.warning =  
  "격파";  



}

}


function applyDamage(

target,

damage,

turn,

) {

if (

!target.health ||

damage <= 0

) {

return {

damage: 0,

destroyed: false,

};

}


target.health.current =

Math.max(

0,

target.health.current -

damage,

);


target.health.lastDamage =

damage;


target.health.lastHitTurn =

turn;


const destroyed =

target.health.current <= 0;


if (destroyed) {

stopDestroyedUnit(target);

} else {

target.condition = "피해";

}


return {

damage,

destroyed,

};

}


function createSmokeArea(

runtimeScenario,

shooter,

turn,

) {

const targetHex =

shooter.fireControl

?.targetHex;


if (!targetHex) {

return null;

}


if (

!Array.isArray(

runtimeScenario.smokeAreas,

)

) {

runtimeScenario.smokeAreas = [];

}


runtimeScenario.smokeAreas =

runtimeScenario.smokeAreas.filter(

(area) =>

area.expiresTurn >= turn,

);


const existing =

runtimeScenario.smokeAreas.find(

(area) =>

area.column ===

targetHex.column &&

area.row ===

targetHex.row,

);


if (existing) {

existing.startedTurn = turn;


existing.expiresTurn =  
  turn +  
  SMOKE_DURATION_TURNS;  

existing.sourceUnitId =  
  shooter.id;  

return existing;  



}


const smokeArea = {

id:

smoke-${shooter.id}-${turn}-${targetHex.column}-${targetHex.row},


column:  
  targetHex.column,  

row:  
  targetHex.row,  

radius: SMOKE_RADIUS,  

sourceUnitId:  
  shooter.id,  

startedTurn: turn,  

expiresTurn:  
  turn +  
  SMOKE_DURATION_TURNS,  



};


runtimeScenario.smokeAreas.push(

smokeArea,

);


return smokeArea;

}


function resolveSmokeShot(

runtimeScenario,

shooter,

turn,

) {

const smokeArea =

createSmokeArea(

runtimeScenario,

shooter,

turn,

);


if (!smokeArea) {

return {

hit: false,

damage: 0,

destroyed: false,

targetUnitId: null,

smokeCreated: false,

smokeAreaId: null,

reason:

"연막 목표가 지정되지 않았습니다.",

};

}


return {

hit: true,

damage: 0,

destroyed: false,

targetUnitId: null,


smokeCreated: true,  

smokeAreaId:  
  smokeArea.id,  

targetHex: {  
  column:  
    smokeArea.column,  

  row:  
    smokeArea.row,  
},  

reason: "연막 형성",  



};

}


export function removeExpiredSmokeAreas(

runtimeScenario,

turn,

) {

if (

!Array.isArray(

runtimeScenario.smokeAreas,

)

) {

runtimeScenario.smokeAreas = [];

return false;

}


const previousLength =

runtimeScenario.smokeAreas.length;


runtimeScenario.smokeAreas =

runtimeScenario.smokeAreas.filter(

(area) =>

area.expiresTurn >= turn,

);


return (

previousLength !==

runtimeScenario.smokeAreas.length

);

}


export function resolveShot(

runtimeScenario,

shooter,

turn,

shotOptions = {},

) {

const ammunition =

shooter.fireControl

?.ammunition;


if (ammunition === "smoke") {

return resolveSmokeShot(

runtimeScenario,

shooter,

turn,

);

}


const target =

getTargetUnit(

runtimeScenario,

shooter,

);


if (!target) {

return {

hit: false,

damage: 0,

destroyed: false,

targetUnitId: null,

smokeCreated: false,

reason:

"목표 헥스에 유효한 객체가 없습니다.",

};

}


const hitChance =

calculateHitChance(

shooter,

target,

shotOptions,

);


const hit =

Math.random() <=

hitChance;


if (!hit) {

return {

hit: false,

damage: 0,

destroyed: false,


  targetUnitId:  
    target.id,  

  hitChance,  
  smokeCreated: false,  
  reason: "빗나감",  
};  



}


const damage =

calculateDamage(

shooter,

target,

);


const result =

applyDamage(

target,

damage,

turn,

);


return {

hit: true,


damage:  
  result.damage,  

destroyed:  
  result.destroyed,  

targetUnitId:  
  target.id,  

hitChance,  
smokeCreated: false,  

remainingHealth:  
  target.health?.current ??  
  null,  

reason:  
  result.destroyed  
    ? "격파"  
    : "피해",  



};

}

