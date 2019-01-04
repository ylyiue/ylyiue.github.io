let container, camera, scene, renderer, labelRenderer, control, stats, axesHelper;
// let textureLoader = new THREE.DDSLoader();
let textureLoader = new THREE.TextureLoader();
let composer, outlinePass, effectFXAA, glowing;
let raycaster = new THREE.Raycaster(), mouseDownPosition, isClick = false;

let modalRenderer, modalTextRender, modalScene, modalCamera, modalControl, mouseSprite;
let meshOfModal = null, isDefault = true, docPoints;

let params = {
    rotate: false,
    axesHelper: false,
    overlay: overlayOn,
    hull: true,
    term: false,
    topics: false,
    keyword: "(terms in console)"
};

let hulls = new THREE.Group(), topicHull = new THREE.Group(), labels = new THREE.Group();
let topicGroups = [];
let topicSize = [];
let rgbColors = ["7, 153, 146", "96, 163, 188", "12, 36, 97", "246, 185, 59", "120, 224, 143",
    "229, 142, 38", "183, 21, 64", "229, 80, 57", "10, 61, 98", "74, 105, 189"];
let hexColors = [0xF79F1F, 0xA3CB38, 0x1289A7, 0xD980FA, 0xB53471, 0xEA2027, 0x006266, 0x1B1464, 0x5758BB, 0x6F1E51];
let docNames = [];
let termHulls = {};
let infoForDetailView = new Array(10);
// let topicHulls = new Array(10);

init();
animate();

function init() {

    container = document.createElement("div");
    document.body.appendChild(container);

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
    // scene.background = new THREE.Color(0xf0f0f0);
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
    loadDocNames();
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
    window.addEventListener("resize", onWindowResize);


    // functions

    function onMainMouseMove(event) {

        let selected = checkIntersection(event);
        if (selected) {
            if (selected.name === "universe" || selected.name.startsWith("point")) {
                return;
            }
            if (selected !== glowing) {
                outlinePass.edgeGlow = 0;
                outlinePass.pulsePeriod = 0;
                glowing = null;
            }
            outlinePass.selectedObjects = [selected];
        }
    }

    function onMainClick(event) {

        let selected = checkIntersection(event);
        if (selected) {
            if (selected === glowing) {
                let geo = new THREE.Geometry().fromBufferGeometry(selected.geometry);
                addToModal(new THREE.Mesh(geo, selected.material), selected.name);
            } else {
                goToObject(selected);
            }
        }

        function addToModal(mesh, name) {

            mesh.material.forEach((mat) => {
                mat.side = THREE.DoubleSide;
                mat.opacity = 1;
            });
            mesh.scale.set(3, 3, 3);
            mesh.name = "modalMesh";
            modalScene.add(mesh);
            meshOfModal = mesh;
            modalCamera.position.set(0, 0, -20);
            modalCamera.lookAt(new THREE.Vector3(0, 0, 0));
            prepareDetailView(name.split("|"));
            overlayOn();
        }

        function prepareDetailView(info) {

            let term = info[0], t = info[1], rank = info[2];
            let docPos = infoForDetailView[t].position[rank], docId = infoForDetailView[t].id[rank];
            $("#term").text(term);
            docPoints = new THREE.Group();
            docPoints.name = "docPoints";
            docPos.forEach((pos, i) => {
                let geometry = new THREE.SphereGeometry(0.3, 16, 16);
                let material = new THREE.MeshLambertMaterial({
                    // color: 0xe3e3e3,
                    color: 0xffffff,
                    side: THREE.DoubleSide
                });
                let point = new THREE.Mesh(geometry, material);
                point.position.set(pos.x * 3, pos.y * 3, pos.z * 3);
                point.name = docNames[docId[i]];
                docPoints.add(point);
            });
            docPoints.visible = false;
            modalScene.add(docPoints);
        }
    }

    function onModalMouseDown(event) {

        isClick = true;
        // mouseDownPosition = new THREE.Vector2((event.clientX / width) * 2 - 1, -(event.clientY / height) * 2 + 1);
    }

    function onModalMouseUp(event) {

        // let mouse = new THREE.Vector2((event.clientX / width) * 2 - 1, -(event.clientY / height) * 2 + 1);
        // if (mouse.distanceTo(mouseDownPosition) > 0.1) {
        //     return; // prevent being triggered by control
        // }
        if (isClick) {
            let selected = checkIntersection(event, true);
            if (selected === meshOfModal) {
                if (isDefault) {
                    toDetail();
                } else {
                    toDefault();
                }
            } else {
                $.modal.close();
            }
        }
    }

    function onModalMouseMove(event) {

        isClick = false;

        if (isDefault) {
            return;
        }

        let rect = modalRenderer.domElement.getBoundingClientRect();
        let x = ((event.clientX - rect.left) / (rect.right - rect.left)) * 2 - 1;
        let y = -((event.clientY - rect.top) / (rect.bottom - rect.top)) * 2 + 1;
        let vector = new THREE.Vector3(x, y - 0.4, 0.5);
        vector.unproject(modalCamera);
        let dir = vector.sub(modalCamera.position).normalize();
        let dist = -modalCamera.position.z / dir.z;
        let pos = modalCamera.position.clone().add(dir.multiplyScalar(dist));
        mouseSprite.position.copy(pos);
        let selected = checkIntersectPoints(event);
        if (selected) {
            $("#mouseSprite").text(selected.name).removeClass("hide");
        } else {
            $("#mouseSprite").addClass("hide");
        }
    }

    function checkIntersectPoints(event) {

        let mouse = new THREE.Vector2();
        let rect = modalRenderer.domElement.getBoundingClientRect();
        mouse.x = ((event.clientX - rect.left) / (rect.right - rect.left)) * 2 - 1;
        mouse.y = -((event.clientY - rect.top) / (rect.bottom - rect.top)) * 2 + 1;

        raycaster.setFromCamera(mouse, modalCamera);
        // modalScene.add(new THREE.ArrowHelper(raycaster.ray.direction, raycaster.ray.origin, 100, Math.random() * 0xffffff));
        let intersects = raycaster.intersectObjects(docPoints.children, true);
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
            alpha: true
        });
        modalRenderer.setPixelRatio(window.devicePixelRatio);
        modalRenderer.setSize(width * 0.7, height * 0.6);
        modalRenderer.setClearColor(0x000000, 0);
        $("#faces").append(modalRenderer.domElement)
            .mouseup(onModalMouseUp)
            .mousedown(onModalMouseDown)
            .mousemove(onModalMouseMove);

        modalScene = new THREE.Scene();

        let light = new THREE.HemisphereLight(0xffffff, 0x777777, 1);
        light.position.set(0, 50, 0);
        modalScene.add(light);

        modalCamera = new THREE.PerspectiveCamera(85, width / height, 0.5, 150);
        modalCamera.position.z = -20;

        modalControl = new THREE.OrbitControls(modalCamera, $("#faces")[0]);
        modalControl.minDistance = 3;
        modalControl.maxDistance = 50;

        modalTextRender = new THREE.CSS2DRenderer();
        // modalTextRender = new THREE.CSS3DRenderer();
        // labelRenderer.domElement.style.position = "absolute";
        // labelRenderer.domElement.style.top = "0";
        modalTextRender.setSize(width * 0.7, height * 0.6);
        $("#faces").append(modalTextRender.domElement);

        $("<div/>", {
            id: "mouseSprite",
            class: "doc hide",
            text: "mouse_sprite"
        }).appendTo("#faces");
        mouseSprite = new THREE.CSS2DObject($("#mouseSprite")[0]);
        // mouseSprite.scale.set(0.01, 0.01, 0.01);
        modalScene.add(mouseSprite);

        // mouseSprite = makeTextSprite(" Hello! ");
        // modalScene.add(mouseSprite);
    }

//     function makeTextSprite(message) {
//
//         let canvas = document.createElement("canvas");
//         let context = canvas.getContext("2d");
//         context.font = "10px Monaco";
//
//         // get size data (height depends only on font size)
//         let metrics = context.measureText(message);
//         let textWidth = metrics.width;
//
//         // background color
//         context.fillStyle = "rgba(0, 0, 0, 0.8)";
//
//         let borderThickness = 4;
//         context.lineWidth = borderThickness;
//         roundRect(context, borderThickness / 2, borderThickness / 2, textWidth + borderThickness, 10 * 1.4 + borderThickness, 6);
//         // 1.4 is extra height factor for text below baseline: g,j,p,q.
//
//         // text color
//         context.fillStyle = "rgba(1, 1, 1, 1.0)";
//         context.fillText(message, borderThickness, 10 + borderThickness);
//
//         // canvas contents will be used for a texture
//         let texture = new THREE.Texture(canvas)
//         texture.needsUpdate = true;
//
//         let spriteMaterial = new THREE.SpriteMaterial({map: texture, useScreenCoordinates: false});
//         let sprite = new THREE.Sprite(spriteMaterial);
//         sprite.scale.set(100, 50, 1.0);
//         return sprite;
//     }
//
// // function for drawing rounded rectangles
//     function roundRect(ctx, x, y, w, h, r) {
//         ctx.beginPath();
//         ctx.moveTo(x + r, y);
//         ctx.lineTo(x + w - r, y);
//         ctx.quadraticCurveTo(x + w, y, x + w, y + r);
//         ctx.lineTo(x + w, y + h - r);
//         ctx.quadraticCurveTo(x + w, y + h, x + w - r, y + h);
//         ctx.lineTo(x + r, y + h);
//         ctx.quadraticCurveTo(x, y + h, x, y + h - r);
//         ctx.lineTo(x, y + r);
//         ctx.quadraticCurveTo(x, y, x + r, y);
//         ctx.closePath();
//         ctx.fill();
//         ctx.stroke();
//     }


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

    function loadDocNames() {

        let csv_file = "../data/doc_namelist.csv";
        Papa.parse(csv_file, {
            // preview: 100,
            header: true,
            delimiter: ",",
            dynamicTyping: true,
            skipEmptyLines: true,
            download: true,
            complete: function (results) {
                results.data.forEach(function (doc) {
                    docNames[doc.id] = doc.name;
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
                    topicGroups.push(group);
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
                        topicGroups.forEach((topic, index) => {
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
                    console.log("terms:", Object.keys(termHulls));
                }).catch((msg) => {
                    console.error(msg);
                });

            }
        });
    }

    function loadTerms(t) {

        let csvFile = "../data/topics/topic_" + t + "_terms.csv";
        // let termsPerTopic = Math.round(100 * topicSize[t] * 10);
        // const termsPerTopic = Math.round(20 * topicSize[t] * 10);
        const termsPerTopic = Math.round(5 * topicSize[t] * 10);
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
                const faceCount = geometry.getAttribute("position").count / 3;
                let faceMats = [];
                let uvArray = new Float32Array(faceCount * 3 * 2);
                const tan15 = Math.tan(Math.PI / 12);
                const uvPerFace = [0, 0, 1, tan15, tan15, 1];
                geometry.clearGroups();

                const createHull = () => {
                    const loadTexture = (i) => {
                        return new Promise((resolve, reject) => {
                            let path = "../data/img/" + docNames[termDocs.id[rank][i]] + ".jpg";
                            uvArray.set(uvPerFace, i * 6);
                            geometry.addGroup(i * 3, 3, i);
                            let texture = textureLoader.load(
                                path,
                                function (tex) {
                                    faceMats[i] = new THREE.MeshBasicMaterial({
                                        map: tex,
                                        transparent: true,
                                        opacity: 0.7,
                                        // polygonOffset: true,
                                        // polygonOffsetFactor: 1., // positive value pushes polygon further away
                                        // polygonOffsetUnits: 4.
                                    });
                                    resolve();
                                },
                                undefined,
                                function (err) {
                                    faceMats[i] = new THREE.MeshBasicMaterial({
                                        color: 0xffffff,
                                        transparent: true,
                                        opacity: 0.2,
                                        // polygonOffset: true,
                                        // polygonOffsetFactor: 1., // positive value pushes polygon further away
                                        // polygonOffsetUnits: 4.
                                    });
                                    resolve();
                                }
                            );
                        });
                    };

                    const promises = [...Array(faceCount).keys()].map(loadTexture);
                    return Promise.all(promises).then(() => {
                        return new Promise((resolve, reject) => {
                            let uv = new THREE.BufferAttribute(uvArray, 2);
                            geometry.addAttribute("uv", uv);
                            resolve(new THREE.Mesh(geometry, faceMats));
                        });
                    });
                };

                const addToScene = (mesh) => {

                    // mesh
                    mesh.position.set(term.x, term.y, term.z);
                    mesh.scale.set(0.01 / topicSize[t], 0.01 / topicSize[t], 0.01 / topicSize[t]); // so the shapes are same size
                    // mesh.scale.set(0.1 / topicSize[t], 0.1 / topicSize[t], 0.1 / topicSize[t]); // so the shapes are same size
                    mesh.name = term.term + "|" + t + "|" + rank;
                    topicGroups[t].add(mesh);

                    // css label
                    let label = document.createElement("div");
                    label.className = "label";
                    label.textContent = term.term;
                    label.style.color = "rgba(" + rgbColors[t] + ", 0.8)";
                    let cssObject = new THREE.CSS3DObject(label);
                    // cssObject.scale.set(0.01 / topicSize[t], 0.01 / topicSize[t], 0.01 / topicSize[t]);
                    cssObject.scale.set(0.0005 / topicSize[t], 0.0005 / topicSize[t], 0.0005 / topicSize[t]);
                    cssObject.position.set(term.x, term.y, term.z);
                    topicGroups[t].add(cssObject);

                    // wireframe (work with safari)

                    // let geo = new THREE.Geometry().fromBufferGeometry(mesh.geometry);
                    // let mat = new THREE.MeshBasicMaterial({
                    //     color: 0xe3e3e3,
                    //     wireframe: true,
                    //     wireframeLinewidth: 5
                    // });
                    // let wireframe = new THREE.Mesh(geo, mat);
                    // // wireframe.position.set(term.x, term.y, term.z);
                    // // wireframe.scale.set(0.01 / topicSize[t], 0.01 / topicSize[t], 0.01 / topicSize[t]);
                    // // topicGroups[t].add(wireframe);
                    // mesh.add(wireframe);

                    if (!(term.term in termHulls)) {
                        termHulls[term.term] = [];
                    }
                    termHulls[term.term].push(mesh);
                };

                return createHull().then(addToScene);
            };
            const promises = results.data.map(termPromise);
            return Promise.all(promises);
        };

        const createTopicHull = () => {

            return new Promise((resolve, reject) => {
                let pos = topicGroups[t].position;
                let scale = topicGroups[t].scale;

                let geo = new THREE.SphereGeometry(0.3 / scale.x, 18, 12);
                let mat = new THREE.MeshBasicMaterial({
                    color: hexColors[t],
                    transparent: true,
                    opacity: 0.5
                });
                let sphere = new THREE.Mesh(geo, mat);
                sphere.name = "point" + t;
                sphere.position.set(pos.x, pos.y, pos.z);
                sphere.scale.set(scale.x, scale.y, scale.z);
                topicHull.add(sphere);

                let points = [];
                topicGroups[t].children.forEach((child) => {
                    if (child.isMesh) { // only handle mesh but not css3obj
                        points.push(child.position);
                    }
                });
                if (points.length >= 4) {
                    let geometry = new THREE.ConvexBufferGeometry(points);
                    let material = new THREE.MeshLambertMaterial({
                        color: hexColors[t],
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

        return parseCsv().then(assignTerms).then(createTopicHull)
            .catch((msg) => {
                console.error("error with loadTerm:", msg);
            });
    }

    function loadTermDocs(t, termsPerTopic) {

        let csvFile = "../data/topics/topic_" + t + "_doc_points.csv";
        let pos = new Array(termsPerTopic);
        let docId = new Array(termsPerTopic);
        for (let i = 0; i < pos.length; i++) {
            pos[i] = [];
            docId[i] = [];
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
            // TODO: Labels face to camera
        });
        folderView.add(params, "topics").onChange(function (value) {
            topicHull.visible = value;
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
        goToObject(closestHull);
    }

    function goToObject(obj) {

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
                    outlinePass.selectedObjects = [topicGroups[t]];
                    outlinePass.pulsePeriod = 2;
                    outlinePass.edgeGlow = 0.5;
                } else {
                    outlinePass.selectedObjects = [obj];
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

function toDetail() {

    meshOfModal.material.forEach((mat) => {
        mat.opacity = 0.3;
    });
    isDefault = false;
    docPoints.visible = true;
}

function toDefault(isClosing = false) {

    meshOfModal.material.forEach((mat) => {
        mat.opacity = isClosing ? 0.7 : 1;
    });
    isDefault = true;
    docPoints.visible = false;
}

function overlayOn() {

    $("#faces").modal().on($.modal.CLOSE, function (event, modal) {
        overlayOff();
    });
}

function overlayOff() {

    toDefault(true);
    modalScene.remove(modalScene.getObjectByName("modalMesh"));
    modalScene.remove(modalScene.getObjectByName("docPoints"));
}
