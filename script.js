import * as THREE from "three/webgpu";
import { OrbitControls } from "three/addons/controls/OrbitControls.js";

// 1. Setup the Scene, Camera, and Renderer
const scene = new THREE.Scene();
const camera = new THREE.PerspectiveCamera(
  75,
  window.innerWidth / window.innerHeight,
  0.1,
  1000,
);

// Use WebGPURenderer for modern graphics
const renderer = new THREE.WebGPURenderer({ antialias: true });
await renderer.init();
renderer.setSize(window.innerWidth, window.innerHeight);
renderer.setPixelRatio(window.devicePixelRatio);
document.body.appendChild(renderer.domElement);

// Optional: Add orbit controls for better interaction
const controls = new OrbitControls(camera, renderer.domElement);
controls.enableDamping = true; // smooths camera movement
controls.dampingFactor = 0.25;

// 2. Create Geometry and Material (a simple cube)
const geometry = new THREE.BoxGeometry(1, 1, 1);
const material = new THREE.MeshBasicMaterial({ color: 0x00ff00 });
const cube = new THREE.Mesh(geometry, material);
scene.add(cube);

// 3. Position the camera
camera.position.z = 5;

// 4. Animation/Render Loop
function animate() {
  requestAnimationFrame(animate);

  // Rotate the cube for demonstration
  cube.rotation.x += 0.005;
  cube.rotation.y += 0.005;

  controls.update(); // only required if controls.enableDamping is set to true

  renderer.render(scene, camera);
}

// 5. Handle Window Resize
window.addEventListener("resize", onWindowResize, false);

function onWindowResize() {
  camera.aspect = window.innerWidth / window.innerHeight;
  camera.updateProjectionMatrix();
  renderer.setSize(window.innerWidth, window.innerHeight);
}

animate();
