let container, camera, scene, renderer, labelRenderer, control, stats, axesHelper;
// let textureLoader = new THREE.DDSLoader();
let textureLoader = new THREE.TextureLoader();

let params = {
    rotate: false,
    axesHelper: false,
    shape: true,
    term: true,
    keyword: "(try black)"
};

let hulls = new THREE.Group();
let labels = new THREE.Group();
let topicGroups = [];
let topicSize = [];
let rgbColors = ["7, 153, 146", "96, 163, 188", "12, 36, 97", "246, 185, 59", "120, 224, 143",
    "229, 142, 38", "183, 21, 64", "229, 80, 57", "10, 61, 98", "74, 105, 189"];
let hexColors = [0xF79F1F, 0xA3CB38, 0x1289A7, 0xD980FA, 0xB53471, 0xEA2027, 0x006266, 0x1B1464, 0x5758BB, 0x6F1E51];
let docNames = [];
let termHulls = {};

init();
animate();

function init() {

    container = document.createElement("div");
    document.body.appendChild(container);
    // container = document.getElementById('container');

    // webGL
    //
    // if (WEBGL.isWebGLAvailable() === false) {
    //     document.body.appendChild(WEBGL.getWebGLErrorMessage());
    // }


    // renderer

    let width = window.innerWidth;
    let height = window.innerHeight;
    // renderer = new THREE.WebGLRenderer({antialias: true});
    renderer = new THREE.WebGLRenderer();
    renderer.setClearColor(0xffffff);
    renderer.setPixelRatio(window.devicePixelRatio);
    renderer.setSize(width, height);
    container.appendChild(renderer.domElement);

    // scene

    scene = new THREE.Scene();
    scene.background = new THREE.Color(0xf0f0f0);
    axesHelper = new THREE.AxesHelper(10);
    scene.add(axesHelper);

    // camera

    camera = new THREE.PerspectiveCamera(85, width / height, 1, 150);
    camera.position.set(15, 10, 25);
    camera.lookAt(scene.position);

    // light

    // setupLights();

    // orbit controls

    control = new THREE.TrackballControls(camera, container);

    // css for labels

    labelRenderer = new THREE.CSS3DRenderer();
    labelRenderer.setSize(width, height);
    labelRenderer.domElement.style.position = "absolute";
    labelRenderer.domElement.style.top = "0";
    container.appendChild(labelRenderer.domElement);

    // load topic hulls & texts

    // $.when(loadDocs()).then(test());
    loadDocs();
    // loadTopics();
    scene.add(hulls);
    hulls.position.set(0, 0, 0);
    scene.add(labels);
    labels.position.set(0, 0, 0);

    // stats

    stats = new Stats();
    container.appendChild(stats.dom);

    // gui

    datGui();

    // events

    window.addEventListener("resize", onWindowResize, false);

    // functions

    // function setupLights() {
    //     let hemisphereLight = new THREE.HemisphereLight(0xffffff, 0xbbbbbb, 0.9);
    //     hemisphereLight.position.set(0, 80, 0);
    //     scene.add(hemisphereLight);
    // }

    function loadDocs() {
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
                    // let imgPath = '../data/img/' + doc['name'] + '.jpg';
                    // docImgMats[doc['id']] = new THREE.MeshBasicMaterial({map: new THREE.TextureLoader().load(imgPath)});
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
                // console.log("topic csv: ", results.data);
                // itemPivot.position.set(position.x, position.y, position.z);
                function createTopic(topic) {
                    let group = new THREE.Group();
                    // group.position.set(topic.x, topic.y, topic.z);
                    group.position.set(topic.x / 5, topic.y / 5, topic.z / 5);
                    // let size = topic['size'] * 10;
                    let size = topic.size * 10;
                    group.scale.set(size, size, size);
                    topicSize.push(topic.size);
                    topicGroups.push(group);
                    hulls.add(group);
                    loadTerms(topic.id);
                }

                results.data.forEach(function (topic) {
                    createTopic(topic);
                });
            }
        });
    }

    function loadTerms(t) {
        let csvFile = "../data/topics/topic_" + t + "_terms.csv";
        // let termsPerTopic = Math.round(100 * topicSize[t] * 10);
        let termsPerTopic = Math.round(10 * topicSize[t] * 10);
        let termDocs = loadTermDocs(t, termsPerTopic);
        let termDocsPos = termDocs[0];
        let termDocsId = termDocs[1];
        // console.log(termDocsId);
        //console.log("sz:", t, topicSize[t]);
        Papa.parse(csvFile, {
            preview: termsPerTopic,
            header: true,
            delimiter: ",",
            dynamicTyping: true,
            skipEmptyLines: true,
            download: true,
            complete: function (results) {
                results.data.forEach(function (term) {
                    let rank = term.idx;
                    if (termDocsPos[rank].length >= 4) {

                        function createHull(points, t, addToScene) {
                            let geometry = new THREE.ConvexBufferGeometry(points);
                            const faceCount = geometry.getAttribute("position").count / 3;
                            let faceMats = [];
                            let uvArray = new Float32Array(faceCount * 3 * 2);
                            const tan15 = Math.tan(Math.PI / 12);
                            const uvPerFace = [0, 0, tan15, 1, 1, tan15];
                            geometry.clearGroups();
                            for (let i = 0; i < faceCount; i++) {
                                (function (path) {
                                    uvArray.set(uvPerFace, i * 6);
                                    geometry.addGroup(i * 3, 3, i);
                                    let texture = textureLoader.load(path, function (tex) {
                                        faceMats[i] = new THREE.MeshBasicMaterial({
                                            map: tex,
                                            transparent: true,
                                            opacity: 0.7
                                        });
                                        if (i === faceCount - 1) {
                                            let uv = new THREE.BufferAttribute(uvArray, 2);
                                            geometry.addAttribute("uv", uv);
                                            addToScene(new THREE.Mesh(geometry, faceMats));
                                        }
                                    });
                                })("../data/img/" + docNames[termDocsId[rank][i]] + ".jpg");
                                // })("../data/dds/" + docNames[termDocsId[rank][i]] + ".dds");
                            }
                        }

                        function addToScene(mesh) {
                            mesh.position.set(term.x, term.y, term.z);
                            mesh.scale.set(0.01 / topicSize[t], 0.01 / topicSize[t], 0.01 / topicSize[t]); // so the shapes are same size
                            // mesh.scale.set(0.1 / topicSize[t], 0.1 / topicSize[t], 0.1 / topicSize[t]); // so the shapes are same size
                            topicGroups[t].add(mesh);
                            let label = document.createElement("div");
                            label.className = "label";
                            label.textContent = term.term;
                            label.style.color = "rgba(" + rgbColors[t] + ", 0.8)";
                            let cssObject = new THREE.CSS3DObject(label);
                            // cssObject.scale.set(0.01 / topicSize[t], 0.01 / topicSize[t], 0.01 / topicSize[t]);
                            cssObject.scale.set(0.0005 / topicSize[t], 0.0005 / topicSize[t], 0.0005 / topicSize[t]);
                            cssObject.position.set(term.x, term.y, term.z);
                            topicGroups[t].add(cssObject);
                            if (!(term.term in termHulls)) {
                                termHulls[term.term] = [];
                            }
                            termHulls[term.term].push(mesh);
                        }

                        createHull(termDocsPos[rank], t, addToScene);

                    }
                });
            }
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
        return [pos, docId];
    }

    function datGui() {

        let gui = new dat.GUI();
        let folderDebug = gui.addFolder("Debug");
        folderDebug.add(params, "axesHelper");
        folderDebug.add(params, "rotate");
        let folderView = gui.addFolder("View");
        folderView.add(params, "shape");
        folderView.add(params, "term");
        let folderSearch = gui.addFolder("Search");
        let controller = folderSearch.add(params, "keyword");
        // gui.open();

        controller.onFinishChange(function (term) {
            handleSearch(term);
        });

    }

    function handleSearch(term) {
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

        let from = camera.position.clone();
        let to = new THREE.Vector3();
        closestHull.getWorldPosition(to);
        to.add(to.clone().setLength(1.2));

        let tween = new TWEEN.Tween(from)
            .to(to, 1000)
            .easing(TWEEN.Easing.Linear.None)
            .onUpdate(function () {
                camera.position.set(this.x, this.y, this.z);
                camera.lookAt(new THREE.Vector3(0, 0, 0));
                // camera.lookAt(hullPos);
            })
            .onComplete(function () {
                camera.lookAt(new THREE.Vector3(0, 0, 0));
                // camera.lookAt(hullPos);
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

    hulls.visible = params.shape;
    axesHelper.visible = params.axesHelper;
    setLabelsVisibility(params.term);

    renderer.render(scene, camera);
    labelRenderer.render(scene, camera);
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

}
