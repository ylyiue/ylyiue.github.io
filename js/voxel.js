if (WEBGL.isWebGLAvailable() === false) {
    document.body.appendChild(WEBGL.getWebGLErrorMessage());
}

let camera, scene, renderer;
let plane, cube;
let mouse, raycaster, isShiftDown = false;
let brush;
let cubeGeo;
let objects = [];
let exclusion = [];
let controls, onMouseDownPosition, objectHovered;

const BOARD_SIZE = 400, VOXEL_SIZE = 10;

init();
render();

function init() {

    camera = new THREE.PerspectiveCamera(45, window.innerWidth / window.innerHeight, 1, 10000);
    camera.position.set(150, 340, 250);
    camera.lookAt(0, -100, 0);

    scene = new THREE.Scene();
    scene.background = new THREE.Color(0xf0f0f0);

    // orbit controls

    onMouseDownPosition = new THREE.Vector2();
    controls = new THREE.OrbitControls(camera);

    // roll-over helpers

    let brushGeo = new THREE.BoxBufferGeometry(VOXEL_SIZE, VOXEL_SIZE, VOXEL_SIZE);
    let brushMaterial = new THREE.MeshBasicMaterial({color: 0x3399aa, opacity: 0.5, transparent: true});
    brush = new THREE.Mesh(brushGeo, brushMaterial);
    brush.position.y = -100;
    scene.add(brush);
    exclusion.push(brush);

    // cubes

    cubeGeo = new THREE.BoxBufferGeometry(VOXEL_SIZE, VOXEL_SIZE, VOXEL_SIZE);

    // axis
    // let axis = new THREE.AxesHelper(199);
    // axis.position.y = -99;
    // scene.add(axis);
    // exclusion.push(axis);

    // grid
    let gridXY = new THREE.GridHelper(BOARD_SIZE, BOARD_SIZE / VOXEL_SIZE, 0xaaaaaa, 0xcccccc);
    gridXY.position.y = -100;
    scene.add(gridXY);
    exclusion.push(gridXY);
    // let gridYZ1 = new THREE.GridHelper(BOARD_SIZE / 2, BOARD_SIZE / 2 / VOXEL_SIZE, 0xcccccc, 0xcccccc);
    // gridYZ1.position.set(-200, 0, 100);
    // gridYZ1.rotation.z = Math.PI / 2;
    // scene.add(gridYZ1);
    // exclusion.push(gridYZ1);
    // let gridYZ2 = new THREE.GridHelper(BOARD_SIZE / 2, BOARD_SIZE / 2 / VOXEL_SIZE, 0xcccccc, 0xcccccc);
    // gridYZ2.position.set(-200, 0, -100);
    // gridYZ2.rotation.z = Math.PI / 2;
    // scene.add(gridYZ2);
    // exclusion.push(gridYZ2);
    // let gridXZ1 = new THREE.GridHelper(BOARD_SIZE / 2, BOARD_SIZE / 2 / VOXEL_SIZE, 0xcccccc, 0xcccccc);
    // gridXZ1.position.set(100, 0, -200);
    // gridXZ1.rotation.x = Math.PI / 2;
    // scene.add(gridXZ1);
    // exclusion.push(gridXZ1);
    // let gridXZ2 = new THREE.GridHelper(BOARD_SIZE / 2, BOARD_SIZE / 2 / VOXEL_SIZE, 0xcccccc, 0xcccccc);
    // gridXZ2.position.set(-100, 0, -200);
    // gridXZ2.rotation.x = Math.PI / 2;
    // scene.add(gridXZ2);
    // exclusion.push(gridXZ2);

    //
    raycaster = new THREE.Raycaster();
    mouse = new THREE.Vector2();
    let geometry = new THREE.PlaneBufferGeometry(BOARD_SIZE, BOARD_SIZE);
    geometry.rotateX(-Math.PI / 2);
    plane = new THREE.Mesh(geometry, new THREE.MeshBasicMaterial({visible: false}));
    plane.position.y = -100;
    scene.add(plane);
    objects.push(plane);
    exclusion.push(plane);

    // lights
    let ambientLight = new THREE.AmbientLight(0x606060);
    scene.add(ambientLight);
    let directionalLight = new THREE.DirectionalLight(0xffffff);
    directionalLight.position.set(1, 0.75, 0.5).normalize();
    scene.add(directionalLight);
    renderer = new THREE.WebGLRenderer({antialias: true});
    renderer.setPixelRatio(window.devicePixelRatio);
    renderer.setSize(window.innerWidth, window.innerHeight);
    document.body.appendChild(renderer.domElement);
    document.addEventListener('mousemove', onDocumentMouseMove, false);
    document.addEventListener('mousedown', onDocumentMouseDown, false);
    document.addEventListener('mouseup', onDocumentMouseUp, false);
    document.addEventListener('keydown', onDocumentKeyDown, false);
    document.addEventListener('keyup', onDocumentKeyUp, false);
    //
    window.addEventListener('resize', onWindowResize, false);
}

function onWindowResize() {
    camera.aspect = window.innerWidth / window.innerHeight;
    camera.updateProjectionMatrix();
    renderer.setSize(window.innerWidth, window.innerHeight);
}

function onDocumentMouseMove(event) {
    event.preventDefault();

    if (objectHovered) {
        objectHovered.material.opacity = 1;
        objectHovered.material.color = new THREE.Color(0xeeeeee);
        objectHovered = null;
    }

    mouse.set((event.clientX / window.innerWidth) * 2 - 1, -(event.clientY / window.innerHeight) * 2 + 1);
    raycaster.setFromCamera(mouse, camera);
    let intersects = raycaster.intersectObjects(objects);
    if (intersects.length > 0) {
        let intersect = (intersects[0].object !== brush) ? intersects[0] : intersects[1];
        if (intersect) {
            if (isShiftDown) {
                if (intersect.object !== plane) {
                    objectHovered = intersect.object;
                    objectHovered.material.opacity = 0.5;
                    objectHovered.material.color = new THREE.Color(0xee0000);
                }
            } else {
                brush.position.copy(intersect.point).add(intersect.face.normal);
                brush.position.divideScalar(VOXEL_SIZE).floor().multiplyScalar(VOXEL_SIZE).addScalar(VOXEL_SIZE / 2);
            }
        }
    }
    render();
}

function onDocumentMouseDown(event) {

    event.preventDefault();

    onMouseDownPosition.x = event.clientX;
    onMouseDownPosition.y = event.clientY;
}

function onDocumentMouseUp(event) {

    event.preventDefault();

    onMouseDownPosition.x = event.clientX - onMouseDownPosition.x;
    onMouseDownPosition.y = event.clientY - onMouseDownPosition.y;

    if (onMouseDownPosition.length() > 5) { // orbit controls
        return;
    }

    mouse.set((event.clientX / window.innerWidth) * 2 - 1, -(event.clientY / window.innerHeight) * 2 + 1);
    raycaster.setFromCamera(mouse, camera);
    let intersects = raycaster.intersectObjects(objects);
    if (intersects.length > 0) {
        let intersect = intersects[0];
        if (isShiftDown) { // delete cube
            if (intersect.object !== plane) {
                scene.remove(intersect.object);
                objects.splice(objects.indexOf(intersect.object), 1);
            }

        } else { // create cube
            let cubeMaterial = new THREE.MeshLambertMaterial({color: 0xeeeeee, opacity: 1, transparent: true});
            let voxel = new THREE.Mesh(cubeGeo, cubeMaterial);
            voxel.position.copy(intersect.point).add(intersect.face.normal);
            voxel.position.divideScalar(VOXEL_SIZE).floor().multiplyScalar(VOXEL_SIZE).addScalar(VOXEL_SIZE / 2);
            scene.add(voxel);
            objects.push(voxel);
        }
        render();
    }
}

function onDocumentKeyDown(event) {
    switch (event.keyCode) {
        case 16:
            isShiftDown = true;
            brush.material.opacity = 0;
            break;
    }
}

function onDocumentKeyUp(event) {
    switch (event.keyCode) {
        case 16:
            isShiftDown = false;
            brush.material.opacity = 0.5;
            break;
    }
}

function render() {
    controls.update();
    renderer.render(scene, camera);
}

function clear() {
    objects.forEach(function (element) {
        if (element !== plane) {
            scene.remove(element);
        }
    });
    for (let i = objects.length - 1; i >= 0; i--) {
        if (objects[i] !== plane)
            objects.splice(i, 1);
    }
    render();
}

function download() {
    let objName = prompt("- object name -", "new-object");
    if (!objName)
        return;
    let element = document.createElement('a');
    let exporter = new THREE.OBJExporter();
    exclusion.forEach(function (obj) {
        scene.remove(obj);
    });
    // console.log(scene);
    let result = exporter.parse(scene);
    exclusion.forEach(function (obj) {
        scene.add(obj);
    });
    element.setAttribute('href', 'data:text/plain;charset=utf-8,' + encodeURIComponent(result));
    element.setAttribute('download', objName + '.obj');
    element.style.display = 'none';
    document.body.appendChild(element);
    element.click();
    document.body.removeChild(element);
}