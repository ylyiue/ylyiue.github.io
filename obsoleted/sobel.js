if (WEBGL.isWebGLAvailable() === false) {
    document.body.appendChild(WEBGL.getWebGLErrorMessage());
}

var camera, scene, renderer, control;
var object;

var effectSobel;

var params = {
    enable: true
};

init();
animate();

function init() {

    // scene

    scene = new THREE.Scene();
    scene.background = new THREE.Color(0xffffff);
    scene.add(new THREE.AxesHelper(1000));

    // camera

    camera = new THREE.PerspectiveCamera(
        75,
        window.innerWidth / window.innerHeight,
        1,
        10000
    );
    camera.position.set(0, 200, 1000);
    camera.lookAt(scene.position);

    var light = new THREE.HemisphereLight(0xffffff, 0xdddddd, 1);
    light.position.set(0, 0, 5000);
    scene.add(light);

    // control
    control = new THREE.OrbitControls(camera);

    // manager

    function loadModel() {
        object.traverse(function (child) {
            if (child.isMesh) {
                child.material = new THREE.MeshPhongMaterial({
                    color: 0xcccccc,
                    flatShading: true
                })
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

    // postprocessing

    composer = new THREE.EffectComposer(renderer);
    var renderPass = new THREE.RenderPass(scene, camera);
    composer.addPass(renderPass);

    // color to grayscale conversion
    var effectGrayScale = new THREE.ShaderPass(THREE.LuminosityShader);
    composer.addPass(effectGrayScale);

    // Sobel operator
    effectSobel = new THREE.ShaderPass(THREE.SobelOperatorShader);
    effectSobel.renderToScreen = true;
    effectSobel.uniforms.resolution.value.x = window.innerWidth;
    effectSobel.uniforms.resolution.value.y = window.innerHeight;
    composer.addPass(effectSobel);

    //

    var gui = new dat.GUI();
    gui.add(params, 'enable');
    gui.open();

    //

    window.addEventListener('resize', onWindowResize, false);
}

function animate() {
    requestAnimationFrame(animate);

    if (params.enable === true) {
        composer.render();
    } else {
        renderer.render(scene, camera);
    }
}

function onWindowResize() {
    camera.aspect = window.innerWidth / window.innerHeight;
    camera.updateProjectionMatrix();

    renderer.setSize(window.innerWidth, window.innerHeight);
    composer.setSize(window.innerWidth, window.innerHeight);

    effectSobel.uniforms.resolution.value.x = window.innerWidth;
    effectSobel.uniforms.resolution.value.y = window.innerHeight;
}