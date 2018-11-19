if (WEBGL.isWebGLAvailable() === false) {
    document.body.appendChild(WEBGL.getWebGLErrorMessage());
}

let container, camera, scene, renderer, labelRenderer, control, loader, composer, stats;
let outlineEffect, effectFXAA;
let room, roomPivot, grid;

let raycaster = new THREE.Raycaster();
let mouse = new THREE.Vector2(), onMouseDownPosition = new THREE.Vector2();

let items = {}, itemTopics = {};
let hoveredNameLabel, keywordsShown = false;
// let topicShown = [];

let params = {
    rotate: false,
    grid: false
};

// effects

let outline = false;

// debug

let helpersShown = false;
let boundingBox = false;

init();
animate();

function init() {

    container = document.createElement('div');
    document.body.appendChild(container);

    // scene

    scene = new THREE.Scene();
    scene.background = new THREE.Color(0xf0f0f0);
    if (helpersShown) {
        scene.add(new THREE.AxesHelper(1000));
    }

    // camera

    let width = window.innerWidth;
    let height = window.innerHeight;
    camera = new THREE.PerspectiveCamera(60, width / height, 1, 10000);
    camera.position.set(180, 300, 360);
    camera.rotation.set(0.69, 0.36, 0.28);

    // renderer

    renderer = new THREE.WebGLRenderer({antialias: true});
    // renderer.setClearColor(0xf0f0f0);
    renderer.setPixelRatio(window.devicePixelRatio);
    renderer.setSize(width, height);
    document.body.appendChild(renderer.domElement);

    // outline effect

    outlineEffect = new THREE.OutlineEffect(renderer, {
        defaultThickness: 0.002,
        defaultColor: [0, 0, 0],
        defaultAlpha: 0.3,
        defaultKeepAlive: true // keeps outline material in cache even if material is removed from scene
    });

    // light

    setupLights();

    // orbit controls

    control = new THREE.OrbitControls(camera);

    // loader

    let manager = new THREE.LoadingManager();
    loader = new THREE.OBJLoader(manager);

    // css for labels

    labelRenderer = new THREE.CSS2DRenderer();
    labelRenderer.setSize(window.innerWidth, window.innerHeight);
    labelRenderer.domElement.style.position = 'absolute';
    labelRenderer.domElement.style.top = '0';
    document.body.appendChild(labelRenderer.domElement);

    // room and items

    roomPivot = new THREE.Group();
    scene.add(roomPivot);
    setupRoom();
    //loadModels();

    // grid

    grid = new THREE.GridHelper(400, 40, 0xaaaaaa, 0xaaaaaa);
    grid.position.y = -99.5;
    roomPivot.add(grid);

    // stats

    stats = new Stats();
    container.appendChild(stats.dom);

    // postprocessing

    composer = new THREE.EffectComposer(renderer);
    let renderPass = new THREE.RenderPass(scene, camera);
    composer.addPass(renderPass);

    let outlinePass = new THREE.OutlinePass(new THREE.Vector2(width, height), scene, camera);
    outlinePass.visibleEdgeColor.set('#ffffff');
    outlinePass.hiddenEdgeColor.set('#333333');
    outlinePass.edgeStrength = 5;
    outlinePass.edgeThickness = 1;
    composer.addPass(outlinePass);

    effectFXAA = new THREE.ShaderPass(THREE.FXAAShader);
    effectFXAA.uniforms['resolution'].value.set(1 / width, 1 / height);
    effectFXAA.renderToScreen = true;
    composer.addPass(effectFXAA);

    // gui

    let gui = new dat.GUI();
    gui.add(params, 'rotate');
    gui.add(params, 'grid');
    gui.open();

    // events

    window.addEventListener('resize', onWindowResize, false);
    window.addEventListener('mousemove', onMouseMove); // for desktop
    window.addEventListener('touchmove', onMouseMove); // for mobile
    document.addEventListener('mousedown', onMouseDown);
    document.addEventListener('mouseup', onMouseUp);

    // functions

    function setupLights() {

        let hemisphereLight = new THREE.HemisphereLight(0xf6f6f6, 0xcccccc, 1);
        hemisphereLight.position.set(0, 80, 0);
        scene.add(hemisphereLight);
        if (helpersShown) {
            scene.add(new THREE.HemisphereLightHelper(hemisphereLight, 10, 0x0000ff));
        }

    }

    function setupRoom() {

        let roomGeometry = new THREE.BoxGeometry(400, 200, 400);
        let lambert = new THREE.MeshLambertMaterial({
            color: 0xeeeeee,
            side: THREE.BackSide,
            needsUpdate: true
        });
        room = new THREE.Mesh(roomGeometry, lambert);
        room.name = 'room';
        roomPivot.add(room);
    }


    function toggleLabels(name) {
        let labels = document.getElementsByClassName(name);
        for (let i = 0; i < labels.length; i++) {
            labels[i].classList.toggle('hide');
        }
    }

    function onMouseMove(event) {

        if (hoveredNameLabel) {
            hoveredNameLabel.classList.toggle('hide');
            hoveredNameLabel = null;
        }

        for (let name in itemTopics) {
            if (itemTopics.hasOwnProperty(name)) {
                itemTopics[name].lookAt(camera.position);
            }
        }

        let x = (event.changedTouches) ? event.changedTouches[0].pageX : event.clientX;
        let y = (event.changedTouches) ? event.changedTouches[0].pageY : event.clientY;
        mouse.x = (x / window.innerWidth) * 2 - 1;
        mouse.y = -(y / window.innerHeight) * 2 + 1;
        let selected = getIntersection();
        if (selected !== undefined && selected !== room && selected !== grid) {
            if (selected.name.startsWith("circle-")) { // topic circle
                outlinePass.selectedObjects = [selected];
            }
            else { // item
                if (!keywordsShown) {
                    hoveredNameLabel = document.getElementsByClassName('label-name-' + selected.parent.name)[0];
                    hoveredNameLabel.classList.toggle('hide');
                    outlinePass.selectedObjects = [selected.parent];
                }
            }
        }
        else
            outlinePass.selectedObjects = [];
    }

    function onMouseDown(event) {

        onMouseDownPosition.x = event.clientX;
        onMouseDownPosition.y = event.clientY;

    }

    function onMouseUp(event) {

        onMouseDownPosition.x = event.clientX - onMouseDownPosition.x;
        onMouseDownPosition.y = event.clientY - onMouseDownPosition.y;
        if (onMouseDownPosition.length() > 5) { // avoid reacting to orbit controls
            return;
        }

        mouse.x = (event.clientX / window.innerWidth) * 2 - 1;
        mouse.y = -(event.clientY / window.innerHeight) * 2 + 1;
        let selected = getIntersection();
        if (selected !== undefined && selected !== room) {
            if (selected.name.startsWith("circle-")) {
                keywordsShown = !keywordsShown;
                let itemName = selected.parent.parent.name;
                let topicName = selected.name.split("-")[1];
                let topics = itemTopics[itemName];
                topics.children.forEach(function (topic) {
                    if (topic !== selected)
                        topic.visible = !topic.visible;
                });
                toggleLabels('label-keywords-' + topicName);
                toggleLabels('label-topic-' + itemName);
                toggleLabels('topic-' + topicName);
            }
            else {
                if (!keywordsShown) {
                    let itemName = selected.parent.name;
                    toggleLabels('label-topic-' + itemName);
                    if (itemTopics[itemName])
                        itemTopics[itemName].visible = !itemTopics[itemName].visible;
                }
            }
        }
    }

    function getIntersection() {
        raycaster.setFromCamera(mouse, camera);
        let intersects = raycaster.intersectObjects([scene], true);
        if (intersects.length > 0) {
            return intersects[0].object;
        }
    }
}

function onFileSelect(event) {
    let files = event.target.files;
    for (let i = 0, f; f = files[i]; i++) {
        if (!f.name.toLowerCase().match('\.obj')) {
            alert(".obj files only");
            continue;
        }
        let reader = new FileReader();
        reader.onload = (function (file) {
            return function (e) {
                let name = file.name.toLowerCase().split('\.obj')[0];
                let item = loader.parse(e.target.result);
                initItem(name, item);
            };
        })(f);
        reader.readAsText(f, 'ISO-8859-1');
    }
}

function initItem(name, item) {
    item.traverse(function (child) {
        if (child.isMesh) {
            let lambert = new THREE.MeshLambertMaterial({
                color: 0xffffff,
                side: THREE.DoubleSide,
            });
            child.material = lambert;
        }
    });
    item.name = name;
    items[name] = item;
    roomPivot.add(item);
    loadLabels(name);
}

function loadLabels(name) {

    let nameLabelDiv = document.createElement('div');
    nameLabelDiv.className = 'label-name hide label-name-' + name;
    nameLabelDiv.textContent = name.toUpperCase();
    let nameLabel = new THREE.CSS2DObject(nameLabelDiv);
    let center = new THREE.Box3().setFromObject(items[name]).getCenter(new THREE.Vector3());
    nameLabel.position.set(center.x, center.y, center.z);
    items[name].add(nameLabel);

    if (name !== 'music')
        return;

    let csv_file = '../data/topics/' + name + '.csv';
    Papa.parse(csv_file, {
        dynamicTyping: true,
        skipEmptyLines: true,
        download: true,
        complete: function (results) {
            let topics = new THREE.Group();
            for (let i = 0; i < results.data.length; i++) {
                // hover name label
                let textDiv = document.createElement('div');
                textDiv.className = 'label-topic label-topic-' + name + ' topic-' + results.data[i][1] + ' hide';
                textDiv.textContent = results.data[i][1];
                let text = new THREE.CSS2DObject(textDiv);
                //
                let size = 10 + (results.data[i][0] - 0.08) / 0.3 * 10;
                let geometry = new THREE.CircleGeometry(size, 32);
                let material = new THREE.MeshBasicMaterial({
                    color: 0x000000,
                    opacity: 0.7,
                    transparent: true,
                    depthTest: false
                });
                let circle = new THREE.Mesh(geometry, material);
                circle.name = "circle-" + results.data[i][1];
                let r = 80, theta = Math.PI * 2 / results.data.length * i;
                circle.position.x = r * Math.cos(theta);
                circle.position.y = r * Math.sin(theta);
                for (let j = 1; j < 20; j += 2) {
                    let textDiv = document.createElement('div');
                    textDiv.className = 'label-keywords label-keywords-' + results.data[i][1] + ' hide';
                    textDiv.textContent = results.data[i][j];
                    let keyword = new THREE.CSS2DObject(textDiv);
                    r = 80;
                    theta = Math.PI * 2 / 10 * (j + 1) / 2;
                    keyword.position.x = r * Math.cos(theta);
                    keyword.position.y = r * Math.sin(theta);
                    circle.add(keyword);
                }
                circle.add(text);
                topics.add(circle);
                // console.log(circle);
            }
            topics.position.set(center.x, center.y, center.z);
            topics.visible = false;
            itemTopics[name] = topics;
            items[name].add(topics);
        }
    });
}

function animate() {

    requestAnimationFrame(animate);

    stats.begin();

    if (params.rotate === true) {
        roomPivot.rotation.y += 0.005;
    }
    grid.visible = params.grid;

    control.update();
    if (outline) {
        outlineEffect.render(scene, camera);
    } else {
        composer.render();
        labelRenderer.render(scene, camera);
    }

    stats.end();
}


function onWindowResize() {
    let width = window.innerWidth;
    let height = window.innerHeight;

    camera.aspect = width / height;
    camera.updateProjectionMatrix();
    renderer.setSize(width, height);
    labelRenderer.setSize(width, height);
    composer.setSize(width, height);
    effectFXAA.uniforms['resolution'].value.set(1 / width, 1 / height);
}

function clear() {
    for (let name in items) {
        if (items.hasOwnProperty(name)) {
            roomPivot.remove(items[name]);
            delete items[name];
            let labels = document.getElementsByClassName('label-topic-' + name);
            for (let i = labels.length - 1; i >= 0; i--) {
                labels[i].remove();
            }
            labels = document.getElementsByClassName('label-name-' + name);
            for (let i = labels.length - 1; i >= 0; i--) {
                labels[i].remove();
            }
        }
    }
    animate();
}

function demo() {
    loadObjModel('music');
    loadObjModel('test');
}

function loadObjModel(name) {
    loader.load(
        '../models/' + name + '.obj',
        function (item) {
            initItem(name, item);
        },
        function (xhr) {
            console.log(name + " " + (xhr.loaded / xhr.total * 100) + '% loaded');
        },
        function (error) {
            console.log('An error happened while loading ' + name);
        }
    );
}
