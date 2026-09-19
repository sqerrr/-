export function isPresentationRelevantEvent(e) {
    return (e.type === 'SkillActivated' ||
        e.type === 'CombatShape' ||
        e.type === 'CatalystTriggered' ||
        e.type === 'DamageResolved' ||
        e.type === 'Reaction' ||
        e.type === 'EntitySpawned' ||
        e.type === 'EntityDied' ||
        e.type === 'PlayerHit' ||
        e.type === 'EliteEchoPhase' ||
        e.type === 'RareEvent' ||
        e.type === 'EliteOrder');
}
export function fallbackDeadActor(e) {
    return {
        id: e.entity,
        kind: e.kind,
        x: e.x,
        z: e.z,
        hp: 0,
        maxHp: 1,
        radius: e.elite ? 0.8 : 0.42,
        elite: e.elite,
        boss: !!e.boss,
        guardianPoi: 0,
        chassis: e.elite ? 'marshal' : undefined,
        affix: e.elite ? 'none' : undefined,
        facingX: 1,
        facingZ: 0,
        telegraph: 0,
        linkedTo: 0,
        revived: false,
        buffed: false,
        shieldAngle: 0,
        shieldState: 'guard',
        shieldStability: 100,
        echoPhase: 'none',
        regenerating: false,
        orderX: 0,
        orderZ: 0,
        orderActive: false,
        squadTask: 'none',
        adaptationStage: 0,
        eliteRarity: 'common',
        refusalIcons: [],
        refusalTitles: [],
        refusalKinds: [],
        bossPhase: 0,
        bossPattern: '',
        status: {
            marked: false,
            ignited: false,
            chilled: false,
            frozen: false,
            wounded: false,
            exposed: false,
            embedded: 0,
            toxined: false
        }
    };
}
