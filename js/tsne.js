let container, camera, scene, renderer, labelRenderer, control, stats, axesHelper;
// let textureLoader = new THREE.DDSLoader();
let textureLoader = new THREE.TextureLoader();
let composer, outlinePass, effectFXAA, glowing;
let raycaster = new THREE.Raycaster(), isClick = false;

const amount = 20;
const tan15 = Math.tan(Math.PI / 12);
const uvPerFace = [0, 0, 1, tan15, tan15, 1];

const ModalView = {
    DEFAULT: 0,
    UNFOLD: 1,
    TRANSLUCENT: 2
};

let modalRenderer, modalTextRender, modalScene, modalCamera, modalControl, mouseSprite, clock;
let meshOfModal = null, state = ModalView.DEFAULT, docPoints, triangles, tweenInfo;

let params = {
    rotate: false,
    axesHelper: false,
    overlay: overlayOn,
    hull: true,
    term: false,
    topics: false,
    night: false,
    keyword: "(terms in console)"
};

let hulls = new THREE.Group(), topicHull = new THREE.Group(), labels = new THREE.Group();
let topicGroupsForPlain = [];
let topicGroupsForImage = [];
let topicSize = [];
let rgbColors = ["7, 153, 146", "96, 163, 188", "12, 36, 97", "246, 185, 59", "120, 224, 143",
    "229, 142, 38", "183, 21, 64", "229, 80, 57", "10, 61, 98", "74, 105, 189"];
// let hexColors = [0xF79F1F, 0xA3CB38, 0x1289A7, 0xD980FA, 0xB53471, 0xEA2027, 0x006266, 0x1B1464, 0x5758BB, 0x6F1E51];
let docInfo = [];
let termHullsImage = {};
let termHulls = {};
let infoForDetailView = new Array(10);
// let topicHulls = new Array(10);
let loading = 0;

// let minFace = 100, minFaceTerm = "";

init();
animate();

function init() {

    container = document.createElement("div");
    document.body.appendChild(container);
    //
    // $.LoadingOverlaySetup({
    //     background: "rgba(0, 0, 0, 0.8)",
    //     // size: 0,
    //     image: "",
    //     progress: true,
    //     progressAutoResize: true,
    //     progressResizeFactor: 0.05,
    //     progressColor: "rgba(220, 220, 220, 0.8)",
    //     progressOrder: 1,
    //     progressSpeed: 500,
    //     progressFixedPosition: "50% top",
    // });
    //
    // $.LoadingOverlay("show");

    $.LoadingOverlay("show", {
        background: "rgba(0, 0, 0, 0.8)",
        // size: 0,
        image: "",
        progress: true,
        progressAutoResize: true,
        progressResizeFactor: 0.05,
        progressColor: "rgba(220, 220, 220, 0.8)",
        progressOrder: 1,
        progressSpeed: 500,
        progressFixedPosition: "50% top"
    });
    loading += 10;
    $.LoadingOverlay("progress", loading);

    // webGL

    // if (WEBGL.isWebGLAvailable() === false) {
    //     document.body.appendChild(WEBGL.getWebGLErrorMessage());
    // }

    // renderer

    let width = window.innerWidth;
    let height = window.innerHeight;
    // renderer = new THREE.WebGLRenderer({antialias: true});
    renderer = new THREE.WebGLRenderer();
    renderer.setPixelRatio(window.devicePixelRatio);
    renderer.setSize(width, height);
    container.appendChild(renderer.domElement);

    // scene

    scene = new THREE.Scene();
    scene.background = new THREE.Color(0xe3e3e3);
    // scene.background = new THREE.Color(0x111111);
    // scene.fog = new THREE.Fog(0x111111, 10, 50);
    scene.fog = new THREE.Fog(0xe3e3e3, 20, 50);
    axesHelper = new THREE.AxesHelper(10);
    scene.add(axesHelper);

    // camera

    camera = new THREE.PerspectiveCamera(85, width / height, 0.5, 150);
    camera.position.set(15, 10, 25);
    camera.lookAt(scene.position);

    // light (for topic hulls)

    let hemisphereLight = new THREE.HemisphereLight(0xffffff, 0xbbbbbb, 0.9);
    hemisphereLight.position.set(0, 100, 0);
    scene.add(hemisphereLight);

    // orbit controls

    control = new THREE.TrackballControls(camera, container);

    // css for labels

    labelRenderer = new THREE.CSS3DRenderer();
    labelRenderer.setSize(width, height);
    labelRenderer.domElement.style.position = "absolute";
    labelRenderer.domElement.style.top = "0";
    container.appendChild(labelRenderer.domElement);

    // load topic hulls & texts

    hulls.add(topicHull);
    loadDocInfo();
    scene.add(hulls);
    scene.add(labels);

    // modal

    initiateModal();

    // stats

    stats = new Stats();
    container.appendChild(stats.dom);

    // gui

    datGui();

    // outline

    initiateEffect();

    // events

    container.addEventListener("mousemove", onMainMouseMove);
    container.addEventListener("touchmove", onMainMouseMove);
    container.addEventListener("click", onMainClick);
    document.addEventListener("keyup", onKeyUp);
    window.addEventListener("resize", onWindowResize);


    // functions

    function onKeyUp(event) {

        // press 'P' for printing triangles
        if (event.which === 80 && $.modal.isActive() && state === ModalView.UNFOLD) {

            let w = window.open("", "");
            w.document.title = "Print & Fold";

            // set orientation to landscape (doesn't work tho)
            // let style = w.document.createElement("style");
            // style.type = "text/css";
            // style.media = "print";
            // style.appendChild(w.document.createTextNode("@page {size: landscape;}"));
            // let head = w.document.head || w.document.getElementsByTagName("head")[0];
            // head.appendChild(style);

            let img = new Image();
            // modalRenderer.render(scene, camera);
            img.src = modalRenderer.domElement.toDataURL();
            w.document.body.appendChild(img);
            w.print();
            // w.close();
        }
    }

    function onMainMouseMove(event) {

        let selected = checkIntersection(event);
        if (selected) {
            if (selected.name === "universe" || selected.name.startsWith("point")) {
                container.style.cursor = "default";
                return;
            }
            if (selected !== glowing) {
                outlinePass.edgeGlow = 0;
                outlinePass.pulsePeriod = 0;
                glowing = null;
            }
            container.style.cursor = "pointer";
            outlinePass.selectedObjects = [selected];
        } else {
            container.style.cursor = "default";
        }
    }

    function onMainClick(event) {

        // console.log(camera.position)

        let selected = checkIntersection(event);
        if (selected) {
            if (selected === glowing) {
                let hullTerm = selected.name.split("|")[0];
                let mat = termHullsImage[hullTerm].material;
                let geo = new THREE.Geometry().fromBufferGeometry(termHullsImage[hullTerm].geometry);
                addToModal(new THREE.Mesh(geo, mat), selected.name);
                // addToModal(termHullsImage[term], selected.name);
            } else {
                goToObject(selected);
            }
        }

        function addToModal(mesh, name) {

            mesh.name = "modalMesh";
            modalScene.add(mesh);
            meshOfModal = mesh;
            mesh.geometry.faceVertexUvs[0] = [];
            mesh.geometry.faces.forEach(() => {
                mesh.geometry.faceVertexUvs[0].push([
                    new THREE.Vector2(uvPerFace[0], uvPerFace[1]),
                    new THREE.Vector2(uvPerFace[2], uvPerFace[3]),
                    new THREE.Vector2(uvPerFace[4], uvPerFace[5])
                ]);
            });
            prepareTranslucentView(name.split("|"));
            prepareUnfoldView(mesh);
            toDefault();

            // --- INSIDE ---
            // mesh.scale.set(20, 20, 20);
            // modalCamera.position.set(0, 0, 0);

            modalCamera.position.set(0, 0, 7);
            modalCamera.lookAt(new THREE.Vector3(0, 0, 0));
            overlayOn();
        }

        function prepareUnfoldView(mesh) {

            triangles = new THREE.Group();
            triangles.name = "triangles";

            mesh.geometry.faces.forEach((f, i) => {
                let g = new THREE.Geometry();
                let a = mesh.geometry.vertices[f.a], b = mesh.geometry.vertices[f.b], c = mesh.geometry.vertices[f.c];
                let o = new THREE.Vector3((a.x + b.x + c.x) / 3, (a.y + b.y + c.y) / 3, (a.z + b.z + c.z) / 3);
                g.vertices = [
                    new THREE.Vector3().subVectors(a, o),
                    new THREE.Vector3().subVectors(b, o),
                    new THREE.Vector3().subVectors(c, o)
                ];
                g.faces = [new THREE.Face3(0, 1, 2)];
                g.faceVertexUvs[0] = [[
                    new THREE.Vector2(uvPerFace[0], uvPerFace[1]),
                    new THREE.Vector2(uvPerFace[2], uvPerFace[3]),
                    new THREE.Vector2(uvPerFace[4], uvPerFace[5])
                ]];
                let m = mesh.material[i].clone();
                // m.side = THREE.DoubleSide;
                let triangle = new THREE.Mesh(g, m);
                if (m.name) {
                    let artist = docInfo[m.name].category === 0 ? docInfo[m.name].artist + " - " : "";
                    triangle.name = artist + docInfo[m.name].title;
                }
                // let artist = docInfo[m.map.name].category === 0 ? docInfo[m.map.name].artist + " - " : "";
                // triangle.name = artist + docInfo[m.map.name].title;
                triangle.position.set(o.x, o.y, o.z);
                triangles.add(triangle);
            });
            modalScene.add(triangles);

            tweenInfo = new Array(triangles.children.length);
            triangles.children.forEach((tr, i) => {
                // 9 * 4
                let des = new THREE.Vector3(-20 + 5 * (i % 9), 7.5 - 5 * Math.floor(i / 9), 0);
                let a = tr.geometry.vertices[0], b = tr.geometry.vertices[1], c = tr.geometry.vertices[2];
                let bc = new THREE.Vector3().subVectors(c, b), ba = new THREE.Vector3().subVectors(a, b);
                let normal = new THREE.Vector3().crossVectors(bc, ba).normalize();
                let quaternion = new THREE.Quaternion().setFromUnitVectors(normal, new THREE.Vector3(0, 0, 1));

                let pDefault = new THREE.Vector3(), qDefault = new THREE.Quaternion();
                tweenInfo[i] = {
                    posDefault: pDefault.copy(tr.position),
                    posUnfold: new THREE.Vector3(des.x, des.y, des.z),
                    quDefault: qDefault.copy(tr.quaternion),
                    quUnfold: quaternion
                };
            });
            triangles.visible = false;

        }

        function prepareTranslucentView(info) {

            let term = info[0], t = info[1], rank = info[2];
            // let t = info[1], rank = info[2];
            let docPos = infoForDetailView[t].position[rank], docId = infoForDetailView[t].id[rank];
            $("#term").text(term);
            docPoints = new THREE.Group();
            docPoints.name = "docPoints";
            docPos.forEach((pos, i) => {
                let geometry = new THREE.SphereGeometry(0.1, 16, 16);
                let material = new THREE.MeshLambertMaterial({color: 0xffffff});
                let point = new THREE.Mesh(geometry, material);
                point.position.set(pos.x, pos.y, pos.z);
                let artist = docInfo[docId[i]].category === 0 ? docInfo[docId[i]].artist + " - " : "";
                point.name = artist + docInfo[docId[i]].title;
                docPoints.add(point);
            });
            docPoints.visible = false;
            modalScene.add(docPoints);
        }
    }

    function onModalMouseDown(event) {

        isClick = true;
    }

    function onModalMouseUp(event) {

        if (isClick) {
            switch (state) {
                case ModalView.DEFAULT:
                    toUnfold();
                    break;
                case ModalView.UNFOLD:
                    toTranslucent();
                    break;
                case ModalView.TRANSLUCENT:
                    toDefault();
                    break;
                default:
                    console.error("weird state");
            }
            // let selected = checkIntersection(event, true);
            // if (selected === meshOfModal) {
            //     if (isDefault) {
            //         toDetail();
            //     } else {
            //         toDefault();
            //     }
            // } else {
            //     $.modal.close();
            // }
        }
    }

    function toDefault() {

        state = ModalView.DEFAULT;

        $("#mouseSprite").addClass("hide");

        meshOfModal.material.forEach((mat) => {
            mat.opacity = 1;
        });
        meshOfModal.visible = true;
        docPoints.visible = false;
    }

    function toUnfold() {

        state = ModalView.UNFOLD;

        meshOfModal.visible = false;
        triangles.visible = true;

        viewTransition(true);
        // modalCamera.position.set(0, 0, 15);
        // modalCamera.lookAt(new THREE.Vector3(0, 0, 0));
    }

    function toTranslucent() {

        state = ModalView.TRANSLUCENT;

        $("#mouseSprite").addClass("hide");

        viewTransition(false);

        meshOfModal.material.forEach((mat) => {
            mat.opacity = 0.3;
        });

    }

    function viewTransition(toUnfold) {

        // transitionGroup = new TWEEN.Group();
        const duration = 1000;

        // triangles
        triangles.children.forEach((tr, i) => {

            // tranlation
            let posFrom = new THREE.Vector3();
            posFrom.copy(tr.position);
            // let posFrom = toUnfold ? tweenInfo[i].posDefault : tweenInfo[i].posUnfold;
            let posTo = toUnfold ? tweenInfo[i].posUnfold : tweenInfo[i].posDefault;

            let posTween = new TWEEN.Tween(posFrom)
                .to(posTo, duration)
                .easing(TWEEN.Easing.Linear.None)
                .onUpdate(function () {
                    tr.position.set(this.x, this.y, this.z);
                })
                .onComplete(function () {
                    tr.position.set(posTo.x, posTo.y, posTo.z);
                })
                .start();

            let qFrom = new THREE.Quaternion();
            qFrom.copy(tr.quaternion);
            let qTo = toUnfold ? tweenInfo[i].quUnfold : tweenInfo[i].quDefault;

            let qTween = new TWEEN.Tween(0)
                .to(1, duration)
                .easing(TWEEN.Easing.Linear.None)
                .onUpdate(function () {
                    THREE.Quaternion.slerp(qFrom, qTo, tr.quaternion, this);
                })
                .onComplete(function () {
                    tr.setRotationFromQuaternion(qTo);
                })
                .start();
        });

        // camera
        let camFrom = modalCamera.position.clone();
        let camTo = toUnfold ? new THREE.Vector3(0, 0, 20) : new THREE.Vector3(0, 0, 10);

        if (!toUnfold) {
            switchControl(false);
        }

        let camTween = new TWEEN.Tween(camFrom)
            .to(camTo, duration)
            .easing(TWEEN.Easing.Linear.None)
            .onUpdate(function () {
                modalCamera.position.set(this.x, this.y, this.z);
                modalCamera.lookAt(new THREE.Vector3(0, 0, 0));
            })
            .onComplete(() => {
                modalCamera.position.set(camTo.x, camTo.y, camTo.z);
                modalCamera.lookAt(new THREE.Vector3(0, 0, 0));
                if (!toUnfold && state === ModalView.TRANSLUCENT) {
                    meshOfModal.visible = true;
                    docPoints.visible = true;
                    triangles.visible = false;
                }
                if (toUnfold) {
                    switchControl(true);
                }
            }).start();

        // transitionGroup.start();
    }
    
    function switchControl(toUnfold) {

        let prevCamera = modalCamera;
        modalCamera = new THREE.PerspectiveCamera(60, width / height, 0.5, 150);
        modalCamera.position.copy( prevCamera.position );
        modalCamera.rotation.copy( prevCamera.rotation );

        if (toUnfold) {
            modalControl = new THREE.MapControls(modalCamera, $("#faces")[0]);
            // modalMapControl.enableDamping = true; // an animation loop is required when either damping or auto-rotation are enabled
            // modalMapControl.dampingFactor = 0.25;
            modalControl.screenSpacePanning = true;
            modalControl.minDistance = 3;
            modalControl.maxDistance = 30;
            modalControl.maxPolarAngle = Math.PI / 2;
        }
        else {
            modalControl = new THREE.OrbitControls(modalCamera, $("#faces")[0]);
            modalControl.minDistance = 0.5;
            modalControl.maxDistance = 30;
        }

    }

    function onModalMouseMove(event) {

        isClick = false;

        if (state === ModalView.TRANSLUCENT || state === ModalView.UNFOLD) {
            let rect = modalRenderer.domElement.getBoundingClientRect();
            let x = ((event.clientX - rect.left) / (rect.right - rect.left)) * 2 - 1;
            let y = -((event.clientY - rect.top) / (rect.bottom - rect.top)) * 2 + 1;

            let vector = new THREE.Vector3(x, y - 0.4, 0.5);
            vector.unproject(modalCamera);
            let dir = vector.sub(modalCamera.position).normalize();
            let dist = -modalCamera.position.z / dir.z;
            let pos = modalCamera.position.clone().add(dir.multiplyScalar(dist));
            mouseSprite.position.copy(pos);
            let selected = checkIntersectPoints(event, state === ModalView.UNFOLD);
            if (selected) {
                $("#mouseSprite").text(selected.name).removeClass("hide");
            } else {
                $("#mouseSprite").addClass("hide");
            }
        }
    }

    function checkIntersectPoints(event, isUnfold) {

        let mouse = new THREE.Vector2();
        let rect = modalRenderer.domElement.getBoundingClientRect();
        mouse.x = ((event.clientX - rect.left) / (rect.right - rect.left)) * 2 - 1;
        mouse.y = -((event.clientY - rect.top) / (rect.bottom - rect.top)) * 2 + 1;

        raycaster.setFromCamera(mouse, modalCamera);
        // modalScene.add(new THREE.ArrowHelper(raycaster.ray.direction, raycaster.ray.origin, 100, Math.random() * 0xffffff));
        let candidates = isUnfold ? triangles.children : docPoints.children;
        let intersects = raycaster.intersectObjects(candidates, true);
        if (intersects.length > 0) {
            return intersects[0].object;
        }
    }

    function checkIntersection(event, isModal = false) {

        let x = event.changedTouches ? event.changedTouches[0].pageX : event.clientX;
        let y = event.changedTouches ? event.changedTouches[0].pageY : event.clientY;
        let mouse = new THREE.Vector2((x / width) * 2 - 1, -(y / height) * 2 + 1);
        if (isModal) {
            let rect = modalRenderer.domElement.getBoundingClientRect();
            mouse.x = ((event.clientX - rect.left) / (rect.right - rect.left)) * 2 - 1;
            mouse.y = -((event.clientY - rect.top) / (rect.bottom - rect.top)) * 2 + 1;
        }
        let castCamera = isModal ? modalCamera : camera;
        let castScene = isModal ? [modalScene] : [scene];
        raycaster.setFromCamera(mouse, castCamera);
        let intersects = raycaster.intersectObjects(castScene, true);
        if (intersects.length > 0) {
            return intersects[0].object;
        }
    }


    function initiateModal() {

        modalRenderer = new THREE.WebGLRenderer({
            alpha: true,
            preserveDrawingBuffer: true
        });
        modalRenderer.setPixelRatio(window.devicePixelRatio);
        modalRenderer.setSize(width * 0.8, height * 0.6);
        // modalRenderer.setSize(width, height);
        modalRenderer.setClearColor(0x000000, 0);
        modalRenderer.domElement.classname = "modal-renderer";
        modalRenderer.domElement.id = "modal-renderer";
        $("#faces").append(modalRenderer.domElement)

        modalRenderer.domElement.addEventListener("mousedown", onModalMouseDown);
        modalRenderer.domElement.addEventListener("mouseup", onModalMouseUp);
        modalRenderer.domElement.addEventListener("mousemove", onModalMouseMove);

        modalScene = new THREE.Scene();

        // INSIDE VIEW


        let light = new THREE.HemisphereLight(0xffffff, 0x777777, 1);
        light.position.set(0, 50, 0);
        modalScene.add(light);

        // let directionalLight = new THREE.DirectionalLight(0xffffff, 0.5);
        // directionalLight.position.set(0, 5, 0);
        // modalScene.add(directionalLight);
        // modalControl = new THREE.FirstPersonControls(modalCamera, $("#faces")[0]);
        // modalControl.lookSpeed = 20;
        // modalControl.movementSpeed = 10;
        // modalControl.mouseDragOn = true;
        // modalControl.noFly = false;
        // modalControl.lookVertical = true;
        // clock = new THREE.Clock();

        modalCamera = new THREE.PerspectiveCamera(60, width / height, 0.5, 150);

        modalControl = new THREE.OrbitControls(modalCamera, $("#faces")[0]);
        modalControl.minDistance = 0.5;
        modalControl.maxDistance = 30;

        modalTextRender = new THREE.CSS2DRenderer();
        modalTextRender.setSize(width * 0.8, height * 0.6);
        $("#faces").append(modalTextRender.domElement);

        $("<div/>", {
            id: "mouseSprite",
            class: "doc hide",
            text: "mouse_sprite"
        }).appendTo("#faces");
        mouseSprite = new THREE.CSS2DObject($("#mouseSprite")[0]);
        // mouseSprite.scale.set(0.01, 0.01, 0.01);
        modalScene.add(mouseSprite);

        // modalScene.add(new THREE.AxesHelper(10));
    }

    function initiateEffect() {

        composer = new THREE.EffectComposer(renderer);
        let renderPass = new THREE.RenderPass(scene, camera);
        composer.addPass(renderPass);

        outlinePass = new THREE.OutlinePass(new THREE.Vector2(width, height), scene, camera);
        outlinePass.edgeStrength = 5;
        outlinePass.edgeThickness = 1;
        composer.addPass(outlinePass);

        effectFXAA = new THREE.ShaderPass(THREE.FXAAShader);
        effectFXAA.uniforms["resolution"].value.set(1 / width, 1 / height);
        effectFXAA.renderToScreen = true;
        composer.addPass(effectFXAA);
    }

    function loadDocInfo() {

        // let csv_file = "../data/doc_namelist.csv";
        let csv_file = "../data/docs.csv";
        Papa.parse(csv_file, {
            // preview: 100,
            header: true,
            delimiter: ",",
            dynamicTyping: true,
            skipEmptyLines: true,
            download: true,
            complete: function (results) {
                // console.log(results);
                results.data.forEach(function (doc) {
                    // docNames[doc.id] = doc.name;
                    docInfo[doc.id] = {
                        name: doc.name,
                        title: doc.title,
                        color: doc.color,
                        hasImage: doc.hasImg,
                        artist: doc.artist,
                        category: doc.category
                    };
                });
                loadTopics();
            }
        });
    }

    function loadTopics() {

        let csvFile = "../data/topics/topics.csv";
        Papa.parse(csvFile, {
            // preview: 2,
            header: true,
            delimiter: ",",
            dynamicTyping: true,
            skipEmptyLines: true,
            download: true,
            complete: function (results) {

                const createTopic = (topic) => {
                    let group = new THREE.Group();
                    // group.position.set(topic.x, topic.y, topic.z);
                    group.position.set(topic.x / 5, topic.y / 5, topic.z / 5);
                    let size = topic.size * 10;
                    group.scale.set(size, size, size);
                    topicSize.push(topic.size);
                    topicGroupsForPlain.push(group);

                    let group2 = new THREE.Group();
                    group2.position.set(topic.x / 5, topic.y / 5, topic.z / 5);
                    group2.scale.set(size, size, size);
                    topicGroupsForImage.push(group2);

                    hulls.add(group);
                    return loadTerms(topic.id);
                };

                const processTopics = (topics) => {
                    const promises = topics.map(createTopic);
                    return Promise.all(promises)
                        .catch((msg) => {
                            console.error(msg);
                        });
                };

                const createUniverseHull = () => {
                    return new Promise((resolve, reject) => {
                        let points = [];
                        topicGroupsForPlain.forEach((topic, index) => {
                            let pos = new THREE.Vector3();
                            topic.getWorldPosition(pos);
                            points.push(pos);
                        });
                        if (points.length >= 4) {
                            let geometry = new THREE.ConvexBufferGeometry(points);
                            let material = new THREE.MeshPhongMaterial({
                                color: 0xcccccc,
                                transparent: true,
                                opacity: 0.1,
                                side: THREE.DoubleSide
                            });
                            let mesh = new THREE.Mesh(geometry, material);
                            mesh.name = "universe";
                            topicHull.add(mesh);
                        }
                        resolve();
                    });
                };

                processTopics(results.data).then(createUniverseHull).then(() => {
                    $.LoadingOverlay("progress", 99);
                    $.LoadingOverlay("hide");
                    console.log("terms:", termHulls);
                }).catch((msg) => {
                    console.error(msg);
                });

            }
        });
    }

    function loadTerms(t) {

        let csvFile = "../data/topics/topic_" + t + "_terms.csv";
        // let termsPerTopic = Math.round(100 * topicSize[t] * 10);
        const termsPerTopic = Math.round(amount * topicSize[t] * 10);
        let termDocs = loadTermDocs(t, termsPerTopic);
        infoForDetailView[t] = termDocs;

        const parseCsv = () => {
            return new Promise((resolve, reject) => {
                Papa.parse(csvFile, {
                    preview: termsPerTopic,
                    header: true,
                    delimiter: ",",
                    dynamicTyping: true,
                    skipEmptyLines: true,
                    download: true,
                    complete: resolve,
                    error: reject
                });
            });
        };

        const assignTerms = (results) => {

            const termPromise = (term) => {
                const rank = term.idx;
                const points = termDocs.position[rank];
                if (points.length < 4) {
                    return Promise.resolve("points.length < 4");
                }
                let geometry = new THREE.ConvexBufferGeometry(points);
                let faceImageMats = [];
                let facePlainMats = [];
                const faceCount = geometry.getAttribute("position").count / 3;
                if (faceCount < 12) {
                    console.log(term.term, faceCount);
                }
                let uvArray = new Float32Array(faceCount * 3 * 2);
                geometry.clearGroups();

                let grayMaterial = new THREE.MeshPhongMaterial({
                    color: 0xcccccc,
                    transparent: true,
                    opacity: 0.2,
                    side: THREE.DoubleSide
                });

                const loadTextures = () => {

                    const loadFaceTexture = (faceIdx) => {
                        return new Promise((resolve, reject) => {
                            // FIXME: some file may not exist
                            let docId = termDocs.id[rank][faceIdx];
                            let fileName = docInfo[docId] ? docInfo[docId].name : "";
                            let path = "../data/img/" + fileName + ".jpg";
                            uvArray.set(uvPerFace, faceIdx * 6);
                            geometry.addGroup(faceIdx * 3, 3, faceIdx);

                            // if (docInfo[docId] && docInfo[docId].hasImage) {
                            //
                            // }
                            let texture = textureLoader.load(
                                path,
                                function (tex) {
                                    // tex.name = docId;
                                    tex.minFilter = THREE.LinearFilter;
                                    facePlainMats[faceIdx] = new THREE.MeshBasicMaterial({
                                        // facePlainMats[faceIdx] = new THREE.MeshLambertMaterial({
                                        color: docInfo[docId].color,
                                        transparent: true,
                                        opacity: 0.5,
                                        side: THREE.DoubleSide
                                    });
                                    // faceImageMats[faceIdx] = new THREE.MeshLambertMaterial({
                                    faceImageMats[faceIdx] = new THREE.MeshBasicMaterial({
                                        map: tex,
                                        transparent: true,
                                        opacity: 0.7,
                                        side: THREE.DoubleSide,
                                        name: docId
                                    });
                                    // faceImageMats[faceIdx].name = docId;
                                    resolve();
                                },
                                undefined,
                                function (err) {
                                    facePlainMats[faceIdx] = new THREE.MeshBasicMaterial({
                                        // facePlainMats[faceIdx] = new THREE.MeshLambertMaterial({
                                        color: 0x000000,
                                        transparent: true,
                                        opacity: 0.5,
                                        side: THREE.DoubleSide
                                    });
                                    // faceImageMats[faceIdx] = new THREE.MeshLambertMaterial({
                                    faceImageMats[faceIdx] = new THREE.MeshBasicMaterial({
                                        color: 0x000000,
                                        transparent: true,
                                        opacity: 0.7,
                                        side: THREE.DoubleSide,
                                        name: docId
                                    });
                                    // faceImageMats[faceIdx].name = docId;
                                    // console.log("err", term, faceImageMats[faceIdx], err);
                                    resolve();
                                }
                            );
                        });
                    };

                    const promises = [...Array(faceCount).keys()].map(loadFaceTexture);
                    return Promise.all(promises).then(() => {
                        return new Promise((resolve, reject) => {
                            resolve();
                        });
                    });
                };

                const createObjects = () => {

                    // mesh plain
                    let meshPlain = new THREE.Mesh(geometry, facePlainMats);
                    meshPlain.position.set(term.x, term.y, term.z);
                    meshPlain.scale.set(0.01 / topicSize[t], 0.01 / topicSize[t], 0.01 / topicSize[t]); // so the shapes are same size
                    meshPlain.name = term.term + "|" + t + "|" + rank;
                    topicGroupsForPlain[t].add(meshPlain);

                    // css label
                    let label = document.createElement("div");
                    label.className = "label";
                    label.textContent = term.term;
                    label.style.color = "rgba(" + rgbColors[t] + ", 0.8)";
                    let cssObject = new THREE.CSS3DSprite(label);
                    cssObject.scale.set(0.0005 / topicSize[t], 0.0005 / topicSize[t], 0.0005 / topicSize[t]);
                    cssObject.position.set(term.x, term.y, term.z);
                    topicGroupsForPlain[t].add(cssObject);

                    // for search
                    if (!(term.term in termHulls)) {
                        termHulls[term.term] = [];

                        let meshImage = new THREE.Mesh(geometry, faceImageMats);
                        meshImage.position.set(term.x, term.y, term.z);
                        meshImage.scale.set(0.01 / topicSize[t], 0.01 / topicSize[t], 0.01 / topicSize[t]); // so the shapes are same size
                        meshImage.name = term.term + "|" + t + "|" + rank;
                        topicGroupsForImage[t].add(meshImage);
                        termHullsImage[term.term] = meshImage;
                    }
                    termHulls[term.term].push(meshPlain);
                };

                return loadTextures().then(createObjects);
            };
            const promises = results.data.map(termPromise);
            return Promise.all(promises);
        };

        const createTopicHull = () => {

            return new Promise((resolve, reject) => {
                let pos = topicGroupsForPlain[t].position;
                let scale = topicGroupsForPlain[t].scale;

                let geo = new THREE.SphereGeometry(0.3 / scale.x, 18, 12);
                let mat = new THREE.MeshBasicMaterial({
                    // color: hexColors[t],
                    color: "rgb(" + rgbColors[t] + ")",
                    transparent: true,
                    opacity: 0.5
                });
                let sphere = new THREE.Mesh(geo, mat);
                sphere.name = "point" + t;
                sphere.position.set(pos.x, pos.y, pos.z);
                sphere.scale.set(scale.x, scale.y, scale.z);
                topicHull.add(sphere);

                let points = [];
                topicGroupsForPlain[t].children.forEach((child) => {
                    if (child.isMesh) { // only handle mesh but not css3obj
                        points.push(child.position);
                    }
                });
                if (points.length >= 4) {
                    let geometry = new THREE.ConvexBufferGeometry(points);
                    let material = new THREE.MeshLambertMaterial({
                        // color: hexColors[t],
                        color: "rgb(" + rgbColors[t] + ")",
                        transparent: true,
                        opacity: 0.2,
                        side: THREE.DoubleSide
                    });
                    let mesh = new THREE.Mesh(geometry, material);
                    // topicHulls[t] = mesh;
                    mesh.name = "topic" + t;
                    mesh.position.set(pos.x, pos.y, pos.z);
                    mesh.scale.set(scale.x, scale.y, scale.z);
                    topicHull.add(mesh);
                } else {
                    console.log("topic", t, "has less than 4 docs to form a hull");
                }
                resolve();
            });
        };

        return parseCsv().then(assignTerms).then(createTopicHull).then(() => {
            loading += 9;
            $.LoadingOverlay("progress", loading);
        }).catch((msg) => {
            console.error("error with loadTerm:", msg);
        });
    }

    function loadTermDocs(t, termsPerTopic) {

        let csvFile = "../data/topics/topic_" + t + "_doc_points.csv";
        // let pos = new Array(termsPerTopic);
        // let docId = new Array(termsPerTopic);
        // for (let i = 0; i < pos.length; i++) {
        //     pos[i] = [];
        //     docId[i] = [];
        // }
        let pos = [];
        let docId = [];
        for (let i = 0; i < termsPerTopic; i++) {
            pos.push([]);
            docId.push([]);
        }
        Papa.parse(csvFile, {
            header: true,
            delimiter: ",",
            dynamicTyping: true,
            skipEmptyLines: true,
            download: true,
            complete: function (results) {
                results.data.forEach(function (doc) {
                    let rank = doc.term_rank;
                    if (rank < termsPerTopic) {
                        pos[rank].push(new THREE.Vector3(doc.x, doc.y, doc.z));
                        docId[rank].push(doc.doc_id);
                    }
                });
            }
        });
        return {position: pos, id: docId};
    }

    function datGui() {

        let gui = new dat.GUI();
        let folderDebug = gui.addFolder("Debug");
        folderDebug.add(params, "axesHelper").onChange(function (value) {
            axesHelper.visible = value;
        });
        folderDebug.add(params, "rotate");
        folderDebug.add(params, "overlay");
        let folderView = gui.addFolder("View");
        folderView.add(params, "hull").onChange(function (value) {
            hulls.visible = value;
        });
        folderView.add(params, "term").onChange(function (value) {
            setLabelsVisibility(value);
            // TODO: Set opacity of hulls to 0.3

        });
        folderView.add(params, "topics").onChange(function (value) {
            topicHull.visible = value;
        });
        let folderNight = gui.addFolder("Date line");
        folderNight.add(params, "night").onChange(function (value) {

            let from = {r: 16, g: 16, b: 16};
            let to = {r: 227, g: 227, b: 227};

            if (value) {
                from = {r: 227, g: 227, b: 227};
                to = {r: 16, g: 16, b: 16};
            }

            let tween = new TWEEN.Tween(from)
                .to(to, 500)
                .easing(TWEEN.Easing.Quartic.In)
                .onUpdate(function () {
                        let c = new THREE.Color(this.r / 256, this.g / 256, this.b / 256);
                        scene.background = c;
                        scene.fog = new THREE.Fog(c, 30, 50);
                    }
                ).onComplete(function () {
                    let c = new THREE.Color(to.r / 256, to.g / 256, to.b / 256);
                    scene.background = c;
                    scene.fog = new THREE.Fog(c, 30, 50);
                })
                .start();
        });
        let folderSearch = gui.addFolder("Search");
        folderSearch.add(params, "keyword").onFinishChange(function (term) {
            handleSearch(term);
        });

        axesHelper.visible = false;
        topicHull.visible = false;
        setLabelsVisibility(false);
    }

    function handleSearch(term) {

        term = term.toLowerCase();
        if (!(term in termHulls)) {
            console.log(term, "not exist");
            return;
        }

        let closestHull = null;
        let minDist = Number.MAX_VALUE;
        termHulls[term].forEach(function (hull) {
            let dist = hull.position.distanceTo(camera.position);
            if (dist < minDist) {
                closestHull = hull;
                minDist = dist;
            }
        });
        // goToObject(closestHull, termHulls[term]);
        goToObject(closestHull, termHulls[term]);
    }

    function goToObject(obj, others = null) {

        if (obj.name === "universe" || obj.name.startsWith("point")) {
            return;
        }
        let from = camera.position.clone();
        let to = new THREE.Vector3();
        obj.getWorldPosition(to);
        to.add(to.clone().setLength(1));
        if (obj.name.startsWith("topic")) {
            to = obj.localToWorld(obj.geometry.boundingSphere.center);
        }

        let tween = new TWEEN.Tween(from)
            .to(to, 1000)
            .easing(TWEEN.Easing.Linear.None)
            .onUpdate(function () {
                camera.position.set(this.x, this.y, this.z);
                camera.lookAt(new THREE.Vector3(0, 0, 0));
            })
            .onComplete(function () {
                camera.lookAt(new THREE.Vector3(0, 0, 0));
                if (obj.name.startsWith("topic")) {
                    let t = parseInt(obj.name.split("topic")[1]);
                    outlinePass.selectedObjects = [topicGroupsForPlain[t]];
                    outlinePass.pulsePeriod = 2;
                    outlinePass.edgeGlow = 0.5;
                } else {
                    if (others) {
                        outlinePass.selectedObjects = others;
                    } else {
                        outlinePass.selectedObjects = [obj];
                    }
                    outlinePass.pulsePeriod = 2;
                    outlinePass.edgeGlow = 0.5;
                    glowing = obj;
                }
            })
            .start();
    }
}

function animate() {

    TWEEN.update();

    requestAnimationFrame(animate);

    stats.begin();

    if (params.rotate === true) {
        hulls.rotation.y += 0.05;
    }

    composer.render();
    labelRenderer.render(scene, camera);
    modalRenderer.render(modalScene, modalCamera);
    modalTextRender.render(modalScene, modalCamera);
    control.update();
    // modalControl.update(clock.getDelta());

    stats.end();
}

function setLabelsVisibility(visible) {

    let labels = document.getElementsByClassName("label");
    for (let i = 0; i < labels.length; i++) {
        labels[i].style.visibility = visible ? "visible" : "hidden";
    }
}

function onWindowResize() {

    let width = window.innerWidth;
    let height = window.innerHeight;

    camera.aspect = width / height;
    camera.updateProjectionMatrix();
    renderer.setSize(width, height);
    labelRenderer.setSize(width, height);
    composer.setSize(width, height);

    effectFXAA.uniforms["resolution"].value.set(1 / width, 1 / height);
}

function overlayOn() {

    $("#faces").modal().on($.modal.CLOSE, function (event, modal) {
        overlayOff();
    });
}

function overlayOff() {

    $("#mouseSprite").addClass("hide");
    meshOfModal.material.forEach((mat) => {
        mat.opacity = 0.7;
    });
    modalScene.remove(modalScene.getObjectByName("modalMesh"));
    modalScene.remove(modalScene.getObjectByName("docPoints"));
    modalScene.remove(modalScene.getObjectByName("triangles"));
}

function markHullsWithTerm(obj) {

    let term = obj.textContent.toLowerCase();
    outlinePass.selectedObjects = termHulls[term];
    outlinePass.pulsePeriod = 2;
    outlinePass.edgeGlow = 0.5;

    $.modal.close();

    container.style.cursor = "default";

    let from = camera.position.clone();
    let to = new THREE.Vector3(8, 31, 25);

    let tween = new TWEEN.Tween(from)
        .to(to, 1500)
        .easing(TWEEN.Easing.Linear.None)
        .onUpdate(function () {
            camera.position.set(this.x, this.y, this.z);
            camera.lookAt(new THREE.Vector3(0, 0, 0));
        })
        .onComplete(function () {
            camera.position.set(to.x, to.y, to.z);
            camera.lookAt(new THREE.Vector3(0, 0, 0));
        })
        .start();
}