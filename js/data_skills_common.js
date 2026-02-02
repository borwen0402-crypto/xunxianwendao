(function() {
    if (typeof GameData === 'undefined' || !GameData) return;
    if (!GameData.skillConfig || typeof GameData.skillConfig !== 'object') GameData.skillConfig = {};
    GameData.skillConfig['通用'] = [];
})();
