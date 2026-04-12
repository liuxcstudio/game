// Game settings adapted from APK for web-desktop local mode
// Original: platform:"android" -> Changed to: platform:"web-desktop"
// Removed: remoteBundles, subpackages (no server)
// Added: server:"" (local only, no CDN)

window._CCSettings = {
    platform: "web-desktop",
    groupList: [
        "UI", "default", "staticCollision", "dynamicCollision",
        "brick", "wall", "level2", "level3", "level4",
        "backGround", "securityParking", "car", "carWall",
        "normal", "lost"
    ],
    collisionMatrix: [
        [false, null, null, false, false],
        [false, false, false, true, false],
        [false, false, false, true, false, null, null, null, null, null, null, true],
        [false, true, true, true, true, true, true, false, false, null, null, null, false],
        [false, false, false, true, true, false, false, false, false],
        [false, false, false, true, false, false, null, null, null, null, null, null, null, null, true],
        [false, false, false, true, false, false, true],
        [false, false, false, false, false, false, false, false, true],
        [false, false, false, false, false, false, false, true, false],
        [false, false, false, false, false, false, false, false, false, false],
        [false, false, false, false, false, false, false, false, false, false, true],
        [false, false, true, false, false, false, false, false, false, false, false, false, true],
        [false, false, false, false, false, false, false, false, false, false, false, true, false],
        [false, false, false, false, false, false, false, false, false, false, false, false, false, true],
        [false, false, false, false, false, true, false, false, false, false, false, false, false, false, true]
    ],
    hasResourcesBundle: true,
    hasStartSceneBundle: false,
    remoteBundles: [],
    subpackages: [],
    launchScene: "db://assets/resources/view/scene/main.fire",
    orientation: "",
    server: "",
    jsList: ["InitedEngine.js"],
    debug: false
};
