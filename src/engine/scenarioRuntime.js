// src/engine/scenarioRuntime.js — 전체 교체


import {

createScenario,

getDefaultScenario,

} from "./scenario.js";


import {

DETECTION_STAGES,

} from "./detection.js";


import {

UNIT_ACTIONS,

} from "./actions.js";


import {

createFireControl,

} from "./fireControl.js";


import {

createTurretControl,

} from "./turretControl.js";


function createRuntimeAction() {

return {

type: UNIT_ACTIONS.IDLE,

targetHex: null,

targetUnitId: null,

direction: null,

startedTurn: 1,

persistent: true,

};

}


function createRuntimeSensors(

unitData,

isTank,

) {

if (isTank) {

return {

surroundingRecon:

unitData.surroundingRecon ??

75,


  directionalObservation:  
    unitData  
      .directionalObservation ??  
    55,  
};  



}


const observation =

unitData.observation ??

50;


return {

surroundingRecon:

observation,


directionalObservation:  
  observation,  



};

}


function createRuntimeProtection(

isTank,

) {

if (isTank) {

return {

explosionResistance: 25,

opticsCondition: "정상",

};

}


return {

explosionResistance: 5,

opticsCondition: null,

};

}


function createRuntimeUnit(

unitData,

) {

const friendly =

unitData.side ===

"friendly";


const isTank =

unitData.type ===

"tank";


const hullDirection =

unitData.hullDirection ??

0;


const turretDirection =

unitData.turretDirection ??

hullDirection;


const baseConcealment =

unitData.concealment ??

0;


return {

...unitData,


condition: "정상",  
command: "대기",  
destroyed: false,  

destination: null,  
plannedPath: [],  
movementHistory: [],  

hullDirection,  
turretDirection,  
direction: hullDirection,  

detectionStage:  
  friendly  
    ? DETECTION_STAGES.IDENTIFIED  
    : DETECTION_STAGES.HIDDEN,  

visible: friendly,  
detected: friendly,  
identified: friendly,  

lastKnownPosition: null,  

detectionConfidence:  
  friendly  
    ? 100  
    : 0,  

baseConcealment,  
concealment:  
  baseConcealment,  

temporaryExposure: 0,  
exposedUntilTurn: null,  

hatchState:  
  isTank  
    ? "open"  
    : null,  

sensors:  
  createRuntimeSensors(  
    unitData,  
    isTank,  
  ),  

action:  
  createRuntimeAction(),  

fireControl:  
  isTank  
    ? createFireControl()  
    : null,  

turretControl:  
  isTank  
    ? createTurretControl(  
        unitData,  
      )  
    : null,  

protection:  
  createRuntimeProtection(  
    isTank,  
  ),  



};

}


function createRuntimeEvent(

eventData,

) {

return {

...eventData,


active: false,  
completed: false,  
triggeredTurn: null,  



};

}


function getScenarioSource(

scenarioId,

) {

if (scenarioId) {

return createScenario(

scenarioId,

);

}


return getDefaultScenario();

}


export function loadScenario(

scenarioId = null,

) {

const source =

getScenarioSource(

scenarioId,

);


return {

id: source.id,

name: source.name,

description:

source.description,


objectives: [  
  ...source.objectives,  
],  

units: [  
  ...source.playerUnits,  
  ...source.enemyUnits,  
].map(  
  createRuntimeUnit,  
),  

events: (  
  source.events ??  
  []  
).map(  
  createRuntimeEvent,  
),  

victoryConditions:  
  structuredClone(  
    source  
      .victoryConditions ??  
      [],  
  ),  

failureConditions:  
  structuredClone(  
    source  
      .failureConditions ??  
      [],  
  ),  

status: "running",  

turn: 1,  
startedTurn: 1,  
completedTurn: null,  



};

}


export function restartScenario(

runtimeScenario,

) {

return loadScenario(

runtimeScenario.id,

);

}


export function getPlayerUnit(

runtimeScenario,

) {

return runtimeScenario.units.find(

(unit) =>

unit.side ===

"friendly" &&

unit.role ===

"player",

);

}


export function getFriendlyUnits(

runtimeScenario,

) {

return runtimeScenario.units.filter(

(unit) =>

unit.side ===

"friendly",

);

}


export function getEnemyUnits(

runtimeScenario,

) {

return runtimeScenario.units.filter(

(unit) =>

unit.side ===

"enemy",

);

}


export function getUnitById(

runtimeScenario,

unitId,

) {

return runtimeScenario.units.find(

(unit) =>

unit.id ===

unitId,

);

}


