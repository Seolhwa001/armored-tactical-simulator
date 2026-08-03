const SCENARIOS = {
  artilleryObserver: {
    id: "artillery-observer",
    name: "적 포병 관측 상황",
    description:
      "적 관측조가 아군을 식별한 뒤 간접화력을 유도한다. 포격지역에서 생존하고 관측을 끊어야 한다.",

    objectives: [
      "포격 시작 후 차량 생존",
      "위험지역 이탈",
      "적 관측 접촉 단절",
    ],

    playerUnits: [
      {
        id: "P0",
        side: "friendly",
        type: "tank",
        role: "player",
        name: "P0 자차",
        model: "아군 전차",
        column: 0,
        row: 0,
        hullDirection: -Math.PI / 6,
        turretDirection: -Math.PI / 6,
        detectionRange: 10,
      },
    ],

    enemyUnits: [
      {
        id: "E-SCOUT-1",
        side: "enemy",
        type: "artillery-observer",
        role: "observer",
        name: "미확인 관측조",
        model: "포종심정찰대",
        column: 11,
        row: -6,

        detectionRange: 16,
        identificationRange: 12,

        concealment: 75,
        observation: 90,

        aiState: "observing",
        targetUnitId: null,
        fireMissionRequested: false,
        withdrawalDestination: {
          column: 15,
          row: -8,
        },
      },
    ],

    events: [
      {
        id: "initial-observer-contact",
        type: "observer-search",
        startTurn: 1,
      },
    ],

    victoryConditions: [
      {
        type: "survive-until-turn",
        turn: 15,
      },
      {
        type: "break-observation",
        turnsRequired: 3,
      },
    ],

    failureConditions: [
      {
        type: "player-destroyed",
      },
    ],
  },

  atgmAmbush: {
    id: "atgm-ambush",
    name: "대전차화기조 조우",
    description:
      "은폐된 대전차화기조를 탐지하고 생존성을 보장하면서 위협을 제압한다.",

    objectives: [
      "대전차화기 발사 징후 식별",
      "피격 회피 또는 피해 최소화",
      "대전차화기조 제압",
    ],

    playerUnits: [
      {
        id: "P0",
        side: "friendly",
        type: "tank",
        role: "player",
        name: "P0 자차",
        model: "아군 전차",
        column: 0,
        row: 0,
        hullDirection: -Math.PI / 6,
        turretDirection: -Math.PI / 6,
        detectionRange: 10,
      },
    ],

    enemyUnits: [
      {
        id: "E-ATGM-1",
        side: "enemy",
        type: "atgm-team",
        role: "anti-tank",
        name: "미확인 보병",
        model: "대전차화기조",
        column: 12,
        row: 3,

        detectionRange: 14,
        firingRange: 18,

        concealment: 85,
        observation: 75,

        aiState: "concealed",
        targetUnitId: null,
        missileReady: true,
      },
    ],

    victoryConditions: [
      {
        type: "enemy-neutralized",
        unitId: "E-ATGM-1",
      },
    ],

    failureConditions: [
      {
        type: "player-destroyed",
      },
    ],
  },
};

function cloneScenarioData(data) {
  return structuredClone(data);
}

export function getScenarioList() {
  return Object.values(SCENARIOS).map(
    ({ id, name, description }) => ({
      id,
      name,
      description,
    }),
  );
}

export function createScenario(scenarioId) {
  const scenario = Object.values(
    SCENARIOS,
  ).find((item) => item.id === scenarioId);

  if (!scenario) {
    throw new Error(
      `존재하지 않는 시나리오입니다: ${scenarioId}`,
    );
  }

  return cloneScenarioData(scenario);
}

export function getDefaultScenario() {
  return createScenario(
    "artillery-observer",
  );
}
