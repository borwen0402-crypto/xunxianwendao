(function() {
    if (typeof GameData === 'undefined' || !GameData) return;
    if (!GameData.skillConfig || typeof GameData.skillConfig !== 'object') GameData.skillConfig = {};
    GameData.skillConfig['天一道'] = [
        {
            id: 't_1',
            name: '英魂末路',
            realm: '入道',
            type: 'active',
            mpCost: 80,
            baseDmg: 0,
            heal: 0,
            text: '万法同流，刹那归一。',
            chant: '“万法同流，刹那归一。”',
            cost: { mp: 80, omen: 3 },
            omenDelta: 3,
            chaosDelta: 0,
            tags: ['buff', 'ultimate'],
            sourceDao: '天一道',
            category: 'core'
        }
    ];
})();
