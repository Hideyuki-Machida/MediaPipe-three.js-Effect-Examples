import "https://cdn.jsdelivr.net/npm/@mediapipe/camera_utils@0.3/camera_utils.js";
import "https://cdn.jsdelivr.net/npm/@mediapipe/face_mesh/face_mesh.js";
import { VERTECS } from "./vertecs.js";
import * as THREE from "https://cdn.jsdelivr.net/npm/three@0.126.1/build/three.module.js";
import Stats from "https://cdn.jsdelivr.net/npm/three@0.126.1/examples/jsm/libs/stats.module.js";
import { OBJLoader } from "https://cdn.jsdelivr.net/npm/three@0.126.1/examples/jsm/loaders/OBJLoader.js";
import { FBXLoader } from "https://cdn.jsdelivr.net/npm/three@0.126.1/examples/jsm/loaders/FBXLoader.js";
import { GUI } from "https://cdn.jsdelivr.net/npm/three@0.126.1/examples/jsm/libs/dat.gui.module.js";

//////////////////////////////////////////////////
// Create GUI

// https://github.com/google/mediapipe/blob/master/mediapipe/modules/face_geometry/data/canonical_face_model_uv_visualization.png
// https://github.com/google/mediapipe/blob/master/mediapipe/graphs/face_effect/data/facepaint.pngblob
const masks = { 
	"mask 001": "./img/canonical_face_model_uv_visualization.png", 
	"mask 002": "./img/facepaint.pngblob", 
};

const params = {
	masks: masks[ "mask 001" ],
};

function setupMaskTexture() {
	const texture = new THREE.TextureLoader().load( params.masks );
	maskObject.children[0].material.map = texture;
}

const gui = new GUI();
const assets = gui.addFolder( "Assets" );
assets.add( params, "masks", masks ).onChange( setupMaskTexture );
assets.open();
//////////////////////////////////////////////////

//////////////////////////////////////////////////
// Create Video & DeviceCamera
async function updateFrames() {
	await faceMesh.send({image: video});
	renderer.render(scene, camera);
	stats.update();
}

const ua = navigator.userAgent;
var isSP = false
if(ua.indexOf("iPhone") > 0 || ua.indexOf("Android") > 0 && ua.indexOf("Mobile") > 0){
	isSP = true;
}

const video = document.createElement( "video" );
video.playsInline = true;

var deviceCamera
var width;
var height;
if (isSP) {
	deviceCamera = new Camera(video, {
		onFrame: updateFrames,
		width: 1280,
		height: 720
	});
	width = 720;
	height = 1280;
} else{
	deviceCamera = new Camera(video, {
		onFrame: updateFrames,
	});
	width = deviceCamera.g.width;
	height = deviceCamera.g.height;
}
//////////////////////////////////////////////////

//////////////////////////////////////////////////
// Create Mask
async function loadMaskObject(path) {
	return new Promise((resolve, reject) => {
		//const loader = new OBJLoader();
		const loader = new FBXLoader();
		loader.load( path, ( object ) => {
			resolve( object );	
		});
	});
}

//const path = "./canonical_face_model.obj";
const path = "./canonical_face_model.fbx";
const maskObject = await loadMaskObject( path ).then((res) => res);
maskObject.children[0].material.map = new THREE.TextureLoader().load( masks[ "mask 001" ] );
maskObject.children[0].material.transparent = true;
maskObject.scale.set(width, height, 1);
maskObject.rotation.x = Math.PI;
//////////////////////////////////////////////////

//////////////////////////////////////////////////
// Create WebGLRenderer
function createRender() {
	const renderer = new THREE.WebGLRenderer();
	renderer.setSize(width, height);
	renderer.setClearColor(0x000000, 0);
	renderer.autoClear = false;
	document.body.appendChild(renderer.domElement);
	return renderer
}

const renderer = createRender();

const imgCanvasElement = document.createElement("canvas");
imgCanvasElement.width = width;
imgCanvasElement.height = height;
imgCanvasElement.style.visibility ="hidden";

const imgCanvasCtx = imgCanvasElement.getContext("bitmaprenderer");
const imgTexture = new THREE.CanvasTexture( imgCanvasElement )

const scene = new THREE.Scene();
const camera = new THREE.OrthographicCamera( width / - 2, width / 2, height / 2, height / - 2, 1, 1000 );
camera.position.set(0, 0, 2);

const light = new THREE.AmbientLight(0xFFFFFF, 1.0);
scene.add(light);
scene.add(maskObject);
scene.background = imgTexture;
//////////////////////////////////////////////////

//////////////////////////////////////////////////
// Create FaceMesh
function createFaceMesh() {
	const faceMesh = new FaceMesh({locateFile: (file) => {
		console.log(file);
		return `https://cdn.jsdelivr.net/npm/@mediapipe/face_mesh/${file}`;
	}});

	faceMesh.setOptions({
		static_image_mode: false,
		selfieMode: true,
		enableFaceGeometry: false,
		maxNumFaces: 1,
		//refineLandmarks: false,
		refineLandmarks: true,
		minDetectionConfidence: 0.7,
		minTrackingConfidence: 0.7
	});
	return faceMesh
}

async function onResults(results) {
	try {
		const imageBitmap = await createImageBitmap( results.image );
		imgCanvasCtx.transferFromImageBitmap(imageBitmap);
		imgTexture.needsUpdate = true;

		const multiFaceLandmarks = results.multiFaceLandmarks;
		for (const index in multiFaceLandmarks) {
			const faceLandmark = multiFaceLandmarks[index];
			const vertices = [];
			for (const index in VERTECS) {
				const landmarksIndex = VERTECS[index];
				const newVec = faceLandmark[landmarksIndex - 1];
				vertices.push(newVec.x - 0.5, newVec.y - 0.5, newVec.z);
			}
			const verticesArray = new Float32Array(vertices)
			maskObject.children[0].geometry.attributes.position.copyArray(verticesArray);
			maskObject.children[0].geometry.attributes.position.needsUpdate = true;
		}

	} catch(e) {
		console.log( e.message );
	}
}

const faceMesh = createFaceMesh();
await faceMesh.initialize();
faceMesh.onResults(onResults);
//////////////////////////////////////////////////

//////////////////////////////////////////////////
// Init
const stats = new Stats();
document.getElementsByTagName("body")[0].appendChild( stats.dom );

deviceCamera.start();
//////////////////////////////////////////////////