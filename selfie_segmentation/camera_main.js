import "https://cdn.jsdelivr.net/npm/@mediapipe/camera_utils@0.3/camera_utils.js";
import "https://cdn.jsdelivr.net/npm/@mediapipe/selfie_segmentation/selfie_segmentation.js";
import * as THREE from "https://cdn.jsdelivr.net/npm/three@0.126.1/build/three.module.js";
import { EffectComposer } from 'https://cdn.jsdelivr.net/npm/three@0.126.1/examples/jsm/postprocessing/EffectComposer.js';
import { SSAOPass } from 'https://cdn.jsdelivr.net/npm/three@0.126.1/examples/jsm/postprocessing/SSAOPass.js';
import Stats from "https://cdn.jsdelivr.net/npm/three@0.126.1/examples/jsm/libs/stats.module.js";
import { OBJLoader } from "https://cdn.jsdelivr.net/npm/three@0.126.1/examples/jsm/loaders/OBJLoader.js";
import { FBXLoader } from "https://cdn.jsdelivr.net/npm/three@0.126.1/examples/jsm/loaders/FBXLoader.js";
import { GUI } from "https://cdn.jsdelivr.net/npm/three@0.126.1/examples/jsm/libs/dat.gui.module.js";

//////////////////////////////////////////////////
// Create Video & DeviceCamera
async function updateFrames() {
	await selfieSegmentation.send({image: video});
	const timer = performance.now();
	effectObject.group.rotation.x = timer * 0.0002;
	effectObject.group.rotation.y = timer * 0.0001;

	effectObject.composer.render();

	renderer.render(maskObj.scene, maskObj.camera);
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
async function createMaskObject() {
	var loader = new THREE.FileLoader();
	const defVertShader = await loader.loadAsync('./shader/def.vert')
	const defFragShader = await loader.loadAsync('./shader/def.frag')
	const maskFragShader = await loader.loadAsync('./shader/mask.frag')

	const maskCanvasElement = document.createElement("canvas");
	maskCanvasElement.width = width;
	maskCanvasElement.height = height;
	const maskCanvasCtx = maskCanvasElement.getContext("bitmaprenderer");

	const imgCanvasElement = document.createElement("canvas");
	imgCanvasElement.width = width;
	imgCanvasElement.height = height;
	const imgCanvasCtx = imgCanvasElement.getContext("bitmaprenderer");

	const scene = new THREE.Scene();
	const camera = new THREE.OrthographicCamera( width / - 2, width / 2, height / 2, height / - 2, 1, 1000 );
	camera.position.set(0, 0, 1);

	const light = new THREE.AmbientLight(0xFFFFFF, 1.0);

	const maskTexture = new THREE.CanvasTexture( maskCanvasElement )
	maskTexture.premultiplyAlpha = true;
	const imgTexture = new THREE.CanvasTexture( imgCanvasElement )

	const uniforms = {
		maskTex: { value: maskTexture },
		imgTex: { value: imgTexture },
	};

	const material = new THREE.ShaderMaterial({
		uniforms: uniforms,
		vertexShader: defVertShader,
		fragmentShader: maskFragShader,
		depthWrite: true,
		transparent: true,
		side:THREE.FrontSide
	});

	const sprite = new THREE.Sprite(material);
	sprite.scale.set(width, height, 1)
	scene.add(sprite);

	return {
		scene: scene, 
		camera: camera, 
		uniforms: uniforms,
		maskCanvasCtx: maskCanvasCtx,
		maskTexture: maskTexture,
		imgCanvasCtx: imgCanvasCtx,
		imgTexture: imgTexture
	}
}
//////////////////////////////////////////////////

//////////////////////////////////////////////////
// Create Mask
async function createEffectObject() {
	const scene = new THREE.Scene();

	const camera = new THREE.PerspectiveCamera( 65, width / height, 100, 700 );
	camera.position.z = 500;

	const light001 = new THREE.DirectionalLight();
	const light002 = new THREE.HemisphereLight();
	scene.add( light001 );
	scene.add( light002 );

	const group = new THREE.Group();
	const geometry = new THREE.BoxGeometry( 10, 10, 10 );

	for ( let i = 0; i < 100; i ++ ) {

		const material = new THREE.MeshLambertMaterial( {
			color: Math.random() * 0xffffff,
			depthWrite: true,
			transparent: true,
		} );
		
		const mesh = new THREE.Mesh( geometry, material );

		mesh.position.x = Math.random() * 400 - 200;
		mesh.position.y = Math.random() * 400 - 200;
		mesh.position.z = Math.random() * 400 - 200;
		mesh.rotation.x = Math.random();
		mesh.rotation.y = Math.random();
		mesh.rotation.z = Math.random();

		mesh.scale.setScalar( Math.random() * 10 + 2 );
		group.add( mesh );

	}

	scene.add(group);

	const composer = new EffectComposer(renderer);
	const ssaoPass = new SSAOPass( scene, camera, width, height );
	ssaoPass.kernelRadius = 16;
	ssaoPass.clearColor = new THREE.Color( 0, 0, 0 );

	composer.addPass(ssaoPass);
	composer.clearAlpha = 0

	return {
		scene: scene, 
		camera: camera, 
		group: group,
		composer: composer
	}
}
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

const renderer = await createRender();

const maskObj = await createMaskObject();
const effectObject = await createEffectObject();
effectObject.scene.background = maskObj.imgTexture;
//////////////////////////////////////////////////

//////////////////////////////////////////////////
// Create FaceMesh
function createSelfieSegmentation() {
	const selfieSegmentation = new SelfieSegmentation({locateFile: (file) => {
		console.log(file);
		return `https://cdn.jsdelivr.net/npm/@mediapipe/selfie_segmentation/${file}`;
	}});
	selfieSegmentation.setOptions({
		modelSelection: 0,
	});
	return selfieSegmentation
}

async function onResults(results) {
	maskObj.maskCanvasCtx.transferFromImageBitmap(results.segmentationMask);
	maskObj.maskTexture.needsUpdate = true
	maskObj.imgCanvasCtx.transferFromImageBitmap(results.image);
	maskObj.imgTexture.needsUpdate = true

	maskObj.uniforms.maskTex.value = maskObj.maskTexture;
	maskObj.uniforms.imgTex.value = maskObj.imgTexture;
}

const selfieSegmentation = createSelfieSegmentation();
await selfieSegmentation.initialize();
selfieSegmentation.onResults(onResults);
//////////////////////////////////////////////////

//////////////////////////////////////////////////
// Start
const stats = new Stats();
document.getElementsByTagName("body")[0].appendChild( stats.dom );

deviceCamera.start();
//////////////////////////////////////////////////