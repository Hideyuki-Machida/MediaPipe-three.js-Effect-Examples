import "https://cdn.jsdelivr.net/npm/@mediapipe/face_mesh/face_mesh.js";
import { VERTECS } from "./vertecs.js";
import * as THREE from "https://cdn.jsdelivr.net/npm/three@0.126.1/build/three.module.js";
import Stats from "https://cdn.jsdelivr.net/npm/three@0.126.1/examples/jsm/libs/stats.module.js";
import { OBJLoader } from "https://cdn.jsdelivr.net/npm/three@0.126.1/examples/jsm/loaders/OBJLoader.js";
import { FBXLoader } from "https://cdn.jsdelivr.net/npm/three@0.126.1/examples/jsm/loaders/FBXLoader.js";
import { GUI } from "https://cdn.jsdelivr.net/npm/three@0.126.1/examples/jsm/libs/dat.gui.module.js";

//////////////////////////////////////////////////
// Create GUI

// https://www.pexels.com/
// https://www.pexels.com/video/a-young-man-with-scars-on-his-face-sitting-on-a-couch-by-the-river-10536927/
// https://www.pexels.com/video/a-man-posing-while-squatting-on-a-barstool-7763785/
const videos = { 
	"video 001": "../video/pexels-cottonbro-10536927-s.mp4", 
	"video 002": "../video/pexels-cottonbro-7763785-s.mp4", 
};

// https://github.com/google/mediapipe/blob/master/mediapipe/modules/face_geometry/data/canonical_face_model_uv_visualization.png
// https://github.com/google/mediapipe/blob/master/mediapipe/graphs/face_effect/data/facepaint.pngblob
const masks = { 
	"mask 001": "./img/canonical_face_model_uv_visualization.png", 
	"mask 002": "./img/facepaint.pngblob", 
};

const params = {
	videos: videos[ "video 001" ],
	masks: masks[ "mask 001" ],
};

async function setupVideo() {
	await loadVideo( video, params.videos );
	video.volume = 0;
	video.play();
}

function setupMaskTexture() {
	const texture = new THREE.TextureLoader().load( params.masks );
	maskObject.children[0].material.map = texture;
}

const gui = new GUI();
const assets = gui.addFolder( "Assets" );
assets.add( params, "videos", videos ).onChange( await setupVideo );
assets.add( params, "masks", masks ).onChange( setupMaskTexture );
assets.open();
//////////////////////////////////////////////////

//////////////////////////////////////////////////
// Load Video
async function loadVideo(video, path) {
	return new Promise((resolve, reject) => {
		video.src = path
		video.onloadedmetadata = function () {
			resolve();	
		};
		video.load();
	});
}

const video = document.createElement( "video" );
await loadVideo( video, videos[ "video 001" ] );
video.playsInline = true;
video.volume = 0;

const width = video.videoWidth;
const height = video.videoHeight;
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
// Create FaceMesh
function createFaceMesh() {
	const faceMesh = new FaceMesh({locateFile: (file) => {
		console.log(file);
		return `https://cdn.jsdelivr.net/npm/@mediapipe/face_mesh/${file}`;
	}});

	faceMesh.setOptions({
		static_image_mode: false,
		maxNumFaces: 1,
		refineLandmarks: false,
		//refineLandmarks: true,
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
// Rendering
function rendering() {
	renderer.render(scene, camera);
	requestAnimationFrame(rendering);
}

async function doSomethingWithTheFrame(now, metadata) {
	await faceMesh.send({ image: video });
	stats.update();
	video.requestVideoFrameCallback(doSomethingWithTheFrame);
}
//////////////////////////////////////////////////

//////////////////////////////////////////////////
// Start
const stats = new Stats();
document.getElementsByTagName("body")[0].appendChild( stats.dom );

window.addEventListener("click", function(e) {
	video.play();
});
video.play();
video.requestVideoFrameCallback(doSomethingWithTheFrame);

rendering();
//////////////////////////////////////////////////