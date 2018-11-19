var camera, scene, renderer, control;
var object;
var wireframes = [], outlines = [];

var params = {
    wireframe: true,
    outline: false
};



init();
animate();

function init() {

    // camera

    camera = new THREE.PerspectiveCamera(
        75,
        window.innerWidth / window.innerHeight,
        1,
        10000
    );
    camera.position.set(0, 200, 1000);
    camera.lookAt(new THREE.Vector3(0, 0, 0));

    // scene

    scene = new THREE.Scene();
    scene.background = new THREE.Color(0xffffff);
    scene.add(new THREE.AxesHelper(1000));

    var light = new THREE.HemisphereLight(0xffffff, 0xdddddd, 1);
    light.position.set(0, 0, 5000);
    scene.add(light);

    // control

    control = new THREE.OrbitControls(camera);

    // manager

    function loadModel() {
        object.traverse(function (child) {
            if (child.isMesh) {
                var flatMaterial = new THREE.MeshPhongMaterial({
                    color: 0xffffff,
                    flatShading: true
                });
                child.material = flatMaterial;

                var lineMaterial = new THREE.LineBasicMaterial({color: 0x0f0f0f, linewidth: 1});
                var wf = new THREE.LineSegments(child.geometry, lineMaterial);
                wf.position.set(0, -95, -1000);
                wireframes.push(wf);

                if (params.wireframe) {
                    scene.add(wf);
                }

                var outlineMaterial = new THREE.MeshBasicMaterial({color: 0x0f0f0f, side: THREE.BackSide});
                var out = new THREE.Mesh(child.geometry, outlineMaterial);
                out.position.set(0, -95, -1000);
                out.scale.multiplyScalar(1.005);
                outlines.push(out);

                if (params.outline) {
                    scene.add(out);
                }
            }
        });
        object.position.set(0, -95, -1000);
        scene.add(object);
    }

    var manager = new THREE.LoadingManager(loadModel);
    manager.onProgress = function (item, loaded, total) {
        console.log(item, loaded, total);
    };

    // object

    function onProgress(xhr) {
        if (xhr.lengthComputable) {
            var percentComplete = xhr.loaded / xhr.total * 100;
            console.log('model ' + Math.round(percentComplete, 2) + '% downloaded');
        }
    }

    function onError() {
    }

    var loader = new THREE.OBJLoader(manager);
    loader.load('../obj/buildings.obj', function (obj) {
        object = obj;
    }, onProgress, onError);

    renderer = new THREE.WebGLRenderer({antialias: true});
    renderer.setSize(window.innerWidth, window.innerHeight);
    document.body.appendChild(renderer.domElement);

    //

    var gui = new dat.GUI();
    gui.add(params, 'wireframe');
    gui.add(params, 'outline');
    gui.open();

    //

    window.addEventListener('resize', onWindowResize, false);
}

function animate() {
    // note: three.js includes requestAnimationFrame shim
    requestAnimationFrame(animate);
    // renderer.render(scene, camera);
    if (params.outline === true) {
        outlines.forEach(function(out) {
            scene.add(out);
        });
    } else {
        outlines.forEach(function(out) {
            scene.remove(out);
        });
    }
    if (params.wireframe === true) {
        wireframes.forEach(function(wf) {
            scene.add(wf);
        });
    } else {
        wireframes.forEach(function(wf) {
            scene.remove(wf);
        });
    }
    renderer.render(scene, camera);
}

function onWindowResize() {
    camera.aspect = window.innerWidth / window.innerHeight;
    camera.updateProjectionMatrix();
    renderer.setSize(window.innerWidth, window.innerHeight);
}