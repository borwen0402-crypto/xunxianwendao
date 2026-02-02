(function() {
    if (typeof GameData === 'undefined' || !GameData) return;
    if (!GameData.skillConfig || typeof GameData.skillConfig !== 'object') GameData.skillConfig = {};
    GameData.skillConfig['鬼道'] = [
        {
            id: 'g_1',
            name: '血衣',
            realm: '寻道',
            type: 'active',
            mpCost: 30,
            baseDmg: 0,
            heal: 0,
            text: '英魂末路，横天戾血，鬼道借法！',
            chant: '“英魂末路，横天戾血，鬼道借法！”',
            cost: { mp: 30, hpPct: 0.1 },
            omenDelta: 0,
            chaosDelta: 1,
            tags: ['buff', 'ghost', 'group'],
            sourceDao: '鬼道',
            category: 'core'
        },
        {
            id: 'g_2',
            name: '招鬼',
            realm: '寻道',
            type: 'active',
            mpCost: 40,
            baseDmg: 0,
            heal: 0,
            text: '驱灵缚邪，号令自来！',
            chant: '“驱灵缚邪，号令自来！”',
            cost: { mp: 40 },
            omenDelta: 1,
            chaosDelta: 0,
            tags: ['summon', 'ghost'],
            sourceDao: '鬼道',
            category: 'summon'
        },
        {
            id: 'g_3',
            name: '控魂',
            realm: '寻道',
            type: 'active',
            mpCost: 25,
            baseDmg: 20,
            heal: 0,
            text: '御阴镇邪，收摄鬼魅！',
            chant: '“御阴镇邪，收摄鬼魅！”',
            cost: { mp: 25 },
            omenDelta: 0,
            chaosDelta: 0,
            tags: ['control', 'spirit_slayer'],
            sourceDao: '鬼道',
            category: 'core'
        },
        {
            id: 'g_4',
            name: '吞天鬼',
            realm: '入道',
            type: 'active',
            mpCost: 80,
            baseDmg: 0,
            heal: 0,
            text: '叱咤风雷，巨口吞天！',
            chant: '“叱咤风雷，巨口吞天！”',
            cost: { mp: 80, chaos: 1 },
            omenDelta: 0,
            chaosDelta: 1,
            tags: ['summon', 'ghost', 'elite'],
            sourceDao: '鬼道',
            category: 'summon'
        }
    ];
})();
