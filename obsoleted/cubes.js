var camera, scene, renderer;
var wireframe, right, left;

// custom global variables
var objects = [];
var raycaster, mouse;
var spritey, isShown = false;

var mouseX = 0, mouseY = 0;

init();
animate();

function init() {
    camera = new THREE.PerspectiveCamera(
        75,
        window.innerWidth / window.innerHeight,
        1,
        10000
    );
    camera.position.set(0, 300, 1000);
    camera.lookAt(new THREE.Vector3(0, 0, 0));

    // controls = new THREE.OrbitControls(camera);
    //controls.autoRotate = true;

    scene = new THREE.Scene();
    scene.background = new THREE.Color(0xffffff);
    scene.add(new THREE.AxesHelper(1000));

    var cube = new THREE.CubeGeometry(200, 200, 200);

    var light = new THREE.HemisphereLight(0xffffff, 0xdddddd, 1);
    light.position.set(0, 0, 5000);
    scene.add(light);

    var flatMat = new THREE.MeshPhongMaterial({
        color: 0xffffff,
        flatShading: true,
        polygonOffset: true,
        polygonOffsetFactor: 1, // positive value pushes polygon further away
        polygonOffsetUnits: 1
    });
    right = new THREE.Mesh(cube, flatMat);
    right.position.set(150, 0, 0);
    scene.add(right);
    objects.push(right);

    var edge = new THREE.EdgesGeometry(cube);
    var lineMat = new THREE.LineBasicMaterial({color: 0x0f0f0f, linewidth: 1});
    wireframe = new THREE.LineSegments(edge, lineMat);
    wireframe.position.set(150, 0, 0);
    scene.add(wireframe);

    flatMat2 = new THREE.MeshPhongMaterial({
        color: 0xcccccc,
        flatShading: true
    });
    left = new THREE.Mesh(cube, flatMat2);
    left.position.set(-150, 0, 0);
    scene.add(left);

    // projector = new THREE.Projector();
    raycaster = new THREE.Raycaster();
    mouse = new THREE.Vector2();

    document.addEventListener('mousedown', onDocumentMouseDown, false);

    renderer = new THREE.WebGLRenderer({antialias: true});
    //   renderer.setClearColor(0xffffff, 1);
    renderer.setSize(window.innerWidth, window.innerHeight);
    document.body.appendChild(renderer.domElement);

    //

    document.addEventListener('mousemove', onDocumentMouseMove, false);
    window.addEventListener('resize', onWindowResize, false);
}

function onDocumentMouseDown(event) {

    console.log("clicked");
    event.preventDefault();
    mouse.set((event.clientX / window.innerWidth) * 2 - 1, -(event.clientY / window.innerHeight) * 2 + 1);
    raycaster.setFromCamera(mouse, camera);
    var intersects = raycaster.intersectObjects(objects);
    if (intersects.length > 0) {
        var intersect = intersects[0].object;
        console.log(intersect.name);
        if (!isShown) {
            spritey = makeTextSprite(" label",
                {
                    borderThickness: 3,
                    fontsize: 100,
                    borderColor: {r: 0, g: 0, b: 0, a: 1.0},
                    backgroundColor: {r: 255, g: 255, b: 255, a: 0.8}
                });
            spritey.position.set(intersect.position.x + 130, intersect.position.y + 130, intersect.position.z + 100);
            scene.add(spritey);
            isShown = true;
        }
        else {
            scene.remove(spritey);
            spritey = undefined;
            isShown = false;
        }
    }
}

function makeTextSprite(message, parameters) {
    if (parameters === undefined) parameters = {};
    var fontface = parameters.hasOwnProperty("fontface") ?
        parameters["fontface"] : "Arial";
    var fontsize = parameters.hasOwnProperty("fontsize") ?
        parameters["fontsize"] : 18;
    var borderThickness = parameters.hasOwnProperty("borderThickness") ?
        parameters["borderThickness"] : 4;
    var borderColor = parameters.hasOwnProperty("borderColor") ?
        parameters["borderColor"] : {r: 0, g: 0, b: 0, a: 1.0};
    var backgroundColor = parameters.hasOwnProperty("backgroundColor") ?
        parameters["backgroundColor"] : {r: 255, g: 255, b: 255, a: 1.0};

    var canvas = document.createElement('canvas');
    var context = canvas.getContext('2d');
    context.font = "Bold " + fontsize + "px " + fontface;

    // get size data (height depends only on font size)
    var metrics = context.measureText(message);
    var textWidth = metrics.width;

    // background color
    context.fillStyle = "rgba(" + backgroundColor.r + "," + backgroundColor.g + ","
        + backgroundColor.b + "," + backgroundColor.a + ")";
    // border color
    context.strokeStyle = "rgba(" + borderColor.r + "," + borderColor.g + ","
        + borderColor.b + "," + borderColor.a + ")";

    context.lineWidth = borderThickness;
    roundRect(context, borderThickness / 2, borderThickness / 2, textWidth * 1.1 + borderThickness, fontsize * 1.4 + borderThickness, 6);
    // 1.4 is extra height factor for text below baseline: g,j,p,q.

    // text color
    context.fillStyle = "rgba(0, 0, 0, 1.0)";
    context.fillText(message, borderThickness, fontsize + borderThickness);

    // canvas contents will be used for a texture
    var texture = new THREE.Texture(canvas)
    texture.needsUpdate = true;

    var spriteMaterial = new THREE.SpriteMaterial(
        {map: texture});
    var sprite = new THREE.Sprite(spriteMaterial);
    sprite.scale.set(100, 50, 1.0);
    return sprite;
}

// function for drawing rounded rectangles
function roundRect(ctx, x, y, w, h, r) {
    ctx.beginPath();
    ctx.moveTo(x + r, y);
    ctx.lineTo(x + w - r, y);
    ctx.quadraticCurveTo(x + w, y, x + w, y + r);
    ctx.lineTo(x + w, y + h - r);
    ctx.quadraticCurveTo(x + w, y + h, x + w - r, y + h);
    ctx.lineTo(x + r, y + h);
    ctx.quadraticCurveTo(x, y + h, x, y + h - r);
    ctx.lineTo(x, y + r);
    ctx.quadraticCurveTo(x, y, x + r, y);
    ctx.closePath();
    ctx.fill();
    ctx.stroke();
}

function animate() {
    // note: three.js includes requestAnimationFrame shim
    requestAnimationFrame(animate);
    //controls.update();

    rotate(left);

    render();
}

function rotate(object) {
    object.rotation.x += 0.002;
    object.rotation.y += 0.005;
}

function onWindowResize() {
    camera.aspect = window.innerWidth / window.innerHeight;
    camera.updateProjectionMatrix();
    renderer.setSize(window.innerWidth, window.innerHeight);
}

function onDocumentMouseMove(event) {

    mouseX = (event.clientX - window.innerWidth / 2);
    mouseY = (event.clientY - window.innerHeight / 2) / 2;

}

function render() {
    camera.position.x += (mouseX - camera.position.x) * .05;
    camera.position.y += (-mouseY - camera.position.y) * .05;
    camera.lookAt(scene.position);

    renderer.render(scene, camera);
}