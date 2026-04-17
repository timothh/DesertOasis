import * as THREE from 'three';
import { GLTFLoader }          from 'three/addons/loaders/GLTFLoader.js';
import { PointerLockControls } from 'three/addons/controls/PointerLockControls.js';

// Controls: WASD = move, Mouse = look, Space = jump, N = day/night, F = campfire toggle

// Renderer 

const renderer = new THREE.WebGLRenderer({ antialias: true });
renderer.setSize(window.innerWidth, window.innerHeight);
renderer.setPixelRatio(Math.min(window.devicePixelRatio, 2));
renderer.shadowMap.enabled = true;
renderer.shadowMap.type    = THREE.PCFSoftShadowMap;
renderer.toneMapping       = THREE.ACESFilmicToneMapping;
renderer.toneMappingExposure = 1.1;
document.body.appendChild(renderer.domElement);

// Scene & Camera 

const scene  = new THREE.Scene();
const camera = new THREE.PerspectiveCamera(75, window.innerWidth / window.innerHeight, 0.1, 1000);
camera.position.set(0, 15, 55);

const clock = new THREE.Clock();

//  Sky dome
// We use a simple canvas gradient baked into a texture rather than a full skybox
// for the dome itself; the actual cube skybox is swapped on the scene.background.

function makeSkyTex(top, bottom) {
  const c = document.createElement('canvas');
  c.width = 2; c.height = 512;
  const ctx = c.getContext('2d');
  const g   = ctx.createLinearGradient(0, 0, 0, 512);
  g.addColorStop(0, top); g.addColorStop(1, bottom);
  ctx.fillStyle = g; ctx.fillRect(0, 0, 2, 512);
  return new THREE.CanvasTexture(c);
}
const daySkyTex    = makeSkyTex('#1565c0', '#90caf9');
const sunsetSkyTex = makeSkyTex('#0d0300', '#d84315');
const skyDome = new THREE.Mesh(
  new THREE.SphereGeometry(450, 32, 32),
  new THREE.MeshBasicMaterial({ map: daySkyTex, side: THREE.BackSide })
);
scene.add(skyDome);

scene.fog = new THREE.Fog(0xd4a84b, 100, 320);

//Textures 

const TL = new THREE.TextureLoader();
function loadTex(url, rx = 1, ry = 1) {
  const t = TL.load(url);
  t.wrapS = t.wrapT = THREE.RepeatWrapping;
  t.repeat.set(rx, ry);
  return t;
}
const sandTex   = loadTex('textures/sand.jpg',         20, 20);
const grassTex  = loadTex('textures/grass.jpg',          4,  4);
const stoneTex  = loadTex('textures/stone.jpg',          3,  3);
const woodTex   = loadTex('textures/wood.jpg',           2,  4);
const waterNTex = loadTex('textures/water_normal.jpg',   4,  4);

// Lights

const sunLight = new THREE.DirectionalLight(0xffd27a, 2.5);
sunLight.position.set(80, 120, 60);
sunLight.castShadow = true;
sunLight.shadow.mapSize.set(2048, 2048);
sunLight.shadow.camera.near = 1; sunLight.shadow.camera.far = 500;
sunLight.shadow.camera.left = -120; sunLight.shadow.camera.right = 120;
sunLight.shadow.camera.top  =  120; sunLight.shadow.camera.bottom = -120;
scene.add(sunLight);

const ambientLight = new THREE.AmbientLight(0xffe0b0, 0.7);
scene.add(ambientLight);
const hemiLight = new THREE.HemisphereLight(0x87ceeb, 0xe8c97a, 0.4);
scene.add(hemiLight);

const campfireLight = new THREE.PointLight(0xff6600, 5, 22);
campfireLight.position.set(0, 1, 22);
campfireLight.castShadow = true;
scene.add(campfireLight);

// Terrain

const ground = new THREE.Mesh(
  new THREE.PlaneGeometry(500, 500),
  new THREE.MeshStandardMaterial({ map: sandTex, roughness: 0.95 })
);
ground.rotation.x = -Math.PI / 2;
ground.receiveShadow = true;
scene.add(ground);

// Grass  patch
const grass = new THREE.Mesh(
  new THREE.PlaneGeometry(50, 50),
  new THREE.MeshStandardMaterial({ map: grassTex, roughness: 0.9 })
);
grass.rotation.x = -Math.PI / 2;
grass.position.set(0, 0.02, -5);
grass.receiveShadow = true;
scene.add(grass);


// Pond 

const pCenter = 0, PZ = -5;        // pond centre
const pRadius = 13;                 // pond radius
const pDepth = 2.8;                // Pond depth

// Slightly tapered earth walls so it looks like dug earth
const pWall = new THREE.Mesh(
  new THREE.CylinderGeometry(pRadius - 0.5, pRadius + 1.5, pDepth, 48, 1, true),
  new THREE.MeshStandardMaterial({
    map: sandTex, color: 0xb8894a,
    roughness: 1.0, side: THREE.FrontSide
  })
);
pWall.position.set(pCenter, -(pDepth / 2), PZ);
scene.add(pWall);

// 2. Inner dark earth band near water line — gives depth
const innerBand = new THREE.Mesh(
  new THREE.CylinderGeometry(pRadius - 1.2, pRadius - 0.5, pDepth * 0.5, 48, 1, true),
  new THREE.MeshStandardMaterial({ color: 0x7a5a2a, roughness: 1.0, side: THREE.FrontSide })
);
innerBand.position.set(pCenter, -(pDepth * 0.75), PZ);
scene.add(innerBand);

// 3. Pond floor
const pFloor = new THREE.Mesh(
  new THREE.CircleGeometry(pRadius - 1, 48),
  new THREE.MeshStandardMaterial({ color: 0x2a6b5a, roughness: 1.0 })
);
pFloor.rotation.x = -Math.PI / 2;
pFloor.position.set(pCenter, -pDepth + 0.05, PZ);
scene.add(pFloor);

// 4. Stone rim at ground level — the visible edge of the pond
const rim = new THREE.Mesh(
  new THREE.TorusGeometry(pRadius + 0.6, 0.7, 6, 64),
  new THREE.MeshStandardMaterial({ map: stoneTex, color: 0xc8a46a, roughness: 0.85 })
);
rim.rotation.x = -Math.PI / 2;
rim.position.set(pCenter, 0.15, PZ);
rim.castShadow = rim.receiveShadow = true;
scene.add(rim);

// 5. Grass/sand annular ring around the rim (blends pond into ground)
const pSurround = new THREE.Mesh(
  new THREE.RingGeometry(pRadius + 0.6, pRadius + 4, 48),
  new THREE.MeshStandardMaterial({ map: grassTex, roughness: 0.9 })
);
pSurround.rotation.x = -Math.PI / 2;
pSurround.position.set(pCenter, 0.03, PZ);
scene.add(pSurround);

// Water Shader

const waterUniforms = {
  uTime:       { value: 0.0 },
  uWaterColor: { value: new THREE.Color(0x1a9e8f) },
  uNormalMap:  { value: waterNTex },
};

const waterMesh = new THREE.Mesh(
  new THREE.CircleGeometry(14, 48),  
  new THREE.ShaderMaterial({
    uniforms: waterUniforms, transparent: true, side: THREE.DoubleSide,
    vertexShader: `
      uniform float uTime; varying vec2 vUv; varying float vWave;
      void main() {
        vUv = uv; vec3 pos = position;
        float w = sin(pos.x*1.5+uTime*1.2)*0.06
                + sin(pos.y*2.0+uTime*0.9)*0.04
                + sin((pos.x+pos.y)+uTime*0.7)*0.03;
        pos.z += w; vWave = w;
        gl_Position = projectionMatrix * modelViewMatrix * vec4(pos,1.0);
      }`,
    fragmentShader: `
      uniform vec3 uWaterColor; uniform float uTime; uniform sampler2D uNormalMap;
      varying vec2 vUv; varying float vWave;
      void main() {
        vec4 n   = texture2D(uNormalMap, vUv + vec2(uTime*0.02, uTime*0.015));
        float hi = smoothstep(0.03,0.1,vWave)*0.25;
        float al = 0.72 + 0.06*sin(uTime*0.8);
        gl_FragColor = vec4(uWaterColor + vec3(hi) + n.rgb*0.03, al);
      }`,
  })
);
waterMesh.rotation.x = -Math.PI / 2;
waterMesh.position.set(pCenter, 0.3, PZ);   
scene.add(waterMesh);

// Barrel

function buildBarrel(x, z) {
  const g = new THREE.Group();
  const wMat = new THREE.MeshStandardMaterial({ map: woodTex, roughness: 0.9 });
  const mMat = new THREE.MeshStandardMaterial({ color: 0x333333, metalness: 0.8, roughness: 0.3 });

  const body = new THREE.Mesh(new THREE.CylinderGeometry(0.55, 0.55, 1.2, 14), wMat);
  g.add(body);

  [-0.38, 0, 0.38].forEach(y => {
    const ring = new THREE.Mesh(new THREE.TorusGeometry(0.57, 0.05, 6, 18), mMat);
    ring.rotation.x = Math.PI / 2;
    ring.position.y = y;
    g.add(ring);
  });

  const lid = new THREE.Mesh(new THREE.CylinderGeometry(0.55, 0.55, 0.07, 14), wMat);
  lid.position.y = 0.64; g.add(lid);

  g.position.set(x, 0.5, z);  // sits in the water
  g.rotation.z = 0.1;           // slight tilt
  g.traverse(o => { if (o.isMesh) o.castShadow = true; });
  scene.add(g);
  return g;
}

buildBarrel(15, 5);   // barrel in the water

// WELL

function buildWell(x, z) {
  const g    = new THREE.Group();
  const sMat = new THREE.MeshStandardMaterial({ map: stoneTex, color: 0xd4b896, roughness: 0.9 });
  const wMat = new THREE.MeshStandardMaterial({ map: woodTex, roughness: 0.85 });
  const rMat = new THREE.MeshStandardMaterial({ color: 0x333333, metalness: 0.6 });

  // Stone base 
  const base = new THREE.Mesh(new THREE.CylinderGeometry(1.4, 1.6, 1.2, 16), sMat);
  base.position.y = 0.6; base.castShadow = true; g.add(base);

  // Stone wall ring on top
  const wall = new THREE.Mesh(new THREE.CylinderGeometry(1.4, 1.4, 0.4, 16, 1, true), sMat);
  wall.position.y = 1.4; g.add(wall);

  // Top rim
  const topRim = new THREE.Mesh(new THREE.TorusGeometry(1.4, 0.12, 6, 24), sMat);
  topRim.rotation.x = Math.PI / 2;
  topRim.position.y = 1.6; g.add(topRim);

  // Two wooden posts
  [-1, 1].forEach(side => {
    const post = new THREE.Mesh(new THREE.CylinderGeometry(0.12, 0.12, 2.2, 8), wMat);
    post.position.set(side * 1.3, 2.3, 0);
    post.castShadow = true; g.add(post);
  });

  // Horizontal crossbeam
  const hBeam = new THREE.Mesh(new THREE.CylinderGeometry(0.1, 0.1, 3.0, 8), wMat);
  hBeam.rotation.z = Math.PI / 2;
  hBeam.position.y = 3.4; g.add(hBeam);

  // Rope hanging down
  const rope = new THREE.Mesh(new THREE.CylinderGeometry(0.04, 0.04, 1.5, 6), rMat);
  rope.position.set(0, 2.65, 0); g.add(rope);

  // Small bucket on rope
  const bucket = new THREE.Mesh(new THREE.CylinderGeometry(0.2, 0.16, 0.3, 8), sMat);
  bucket.position.set(0, 1.75, 0); g.add(bucket);

  // Roof 
  const lRoof = new THREE.Mesh(new THREE.BoxGeometry(0.1, 2.0, 3.2), wMat);
  lRoof.position.set(-0.7, 4.2, 0); lRoof.rotation.z = 0.55; g.add(lRoof);
  const rRoof = new THREE.Mesh(new THREE.BoxGeometry(0.1, 2.0, 3.2), wMat);
  rRoof.position.set( 0.7, 4.2, 0); rRoof.rotation.z = -0.55; g.add(rRoof);

  g.traverse(o => { if (o.isMesh) { o.castShadow = true; o.receiveShadow = true; } });
  g.position.set(x, 0, z);
  scene.add(g);
  return g;
}

buildWell(18, 5);   // well placed near the oasis

// Mountains

const mMat = new THREE.MeshStandardMaterial({ color: 0xb8835a, roughness: 0.95 });
function addMountain(x, z, h, w) {
  const m = new THREE.Mesh(new THREE.ConeGeometry(w, h, 5 + Math.floor(Math.random()*3)), mMat);
  m.position.set(x, h/2-1, z);
  m.rotation.y = Math.random()*Math.PI;
  m.castShadow = m.receiveShadow = true;
  scene.add(m);
}
[[-130,-90,50,38],[-80,-100,42,32],[-35,-110,55,44],[25,-105,45,35],
 [75,-95,50,38],[130,-85,44,33],[-140,15,38,30],[140,5,42,32],
 [-120,65,33,27],[120,60,38,30],[-70,-120,58,45],[70,-115,48,37]
].forEach(([x,z,h,w]) => addMountain(x,z,h,w));

// City Walls and Towers

const wallMat = new THREE.MeshStandardMaterial({ color: 0xe8d5a0, roughness: 0.9 });
const CW = 80, CD = 90;

function wallSeg(x, z, w, d, h = 6) {
  const wall = new THREE.Mesh(new THREE.BoxGeometry(w, h, d), wallMat);
  wall.position.set(x, h/2, z);
  wall.castShadow = wall.receiveShadow = true;
  scene.add(wall);
  const n = Math.floor(w / 3.5);
  for (let i = 0; i < n; i++) {
    const mb = new THREE.Mesh(new THREE.BoxGeometry(1.4, 1.8, d+0.3), wallMat);
    mb.position.set(x - w/2 + 1.8 + i*3.5, h+0.9, z);
    scene.add(mb);
  }
}

wallSeg(-46, CD, 68, 3.5); 
wallSeg(46, CD, 68, 3.5);
wallSeg(0, -CD, CW*2, 2.5);
wallSeg(-CW, 0, 2.5, CD*2);
wallSeg( CW, 0, 2.5, CD*2);

function gPost(x, z) {
  const p = new THREE.Mesh(new THREE.CylinderGeometry(2.5, 3, 10, 8), wallMat);
  p.position.set(x, 5, z); p.castShadow = true; scene.add(p);
  const top = new THREE.Mesh(new THREE.ConeGeometry(3, 3.5, 8),
    new THREE.MeshStandardMaterial({ color: 0xc8a870 }));
  top.position.set(x, 11.75, z); scene.add(top);
}
gPost(-12, CD); gPost(12, CD);

function cornerTower(x, z) {
  const t = new THREE.Mesh(new THREE.CylinderGeometry(3.5, 4, 9, 8), wallMat);
  t.position.set(x, 4.5, z); t.castShadow = true; scene.add(t);
  const top = new THREE.Mesh(new THREE.ConeGeometry(4, 4, 8),
    new THREE.MeshStandardMaterial({ color: 0xc8a870 }));
  top.position.set(x, 11, z); scene.add(top);
}
cornerTower(-CW, CD); cornerTower(CW, CD);
cornerTower(-CW,-CD); cornerTower(CW,-CD);

// PALACE — back of compound

function buildPalace(x, z) {
  const g       = new THREE.Group();
  const palMat  = new THREE.MeshStandardMaterial({ color: 0xf0d898, roughness: 0.8 });
  const domeMat = new THREE.MeshStandardMaterial({ color: 0xe040fb, roughness: 0.5, metalness: 0.2 });
  const bandMat = new THREE.MeshStandardMaterial({ color: 0x3a5f8a, roughness: 0.6 });
  const goldMat = new THREE.MeshStandardMaterial({ color: 0xffd700, metalness: 0.7, roughness: 0.3 });

  const base = new THREE.Mesh(new THREE.BoxGeometry(26, 1.5, 20), palMat);
  base.position.set(0, 0.75, 0); g.add(base);
  const body = new THREE.Mesh(new THREE.BoxGeometry(22, 12, 16), palMat);
  body.position.set(0, 7.5, 0); g.add(body);
  const f2 = new THREE.Mesh(new THREE.BoxGeometry(14, 6, 12), palMat);
  f2.position.set(0, 16, 0); g.add(f2);

  [1,4,7,10].forEach(y => {
    const b = new THREE.Mesh(new THREE.BoxGeometry(22.3, 0.7, 16.3), bandMat);
    b.position.set(0, y, 0); g.add(b);
  });
  [13.5,16.5].forEach(y => {
    const b = new THREE.Mesh(new THREE.BoxGeometry(14.3, 0.5, 12.3), bandMat);
    b.position.set(0, y, 0); g.add(b);
  });

  const dome = new THREE.Mesh(
    new THREE.SphereGeometry(5, 18, 18, 0, Math.PI*2, 0, Math.PI/2), domeMat);
  dome.position.set(0, 19, 0); g.add(dome);
  const spire = new THREE.Mesh(new THREE.ConeGeometry(0.35, 4, 6), goldMat);
  spire.position.set(0, 24.5, 0); g.add(spire);

  [[-9,-6],[9,-6],[-9,6],[9,6]].forEach(([mx,mz]) => {
    const mn = new THREE.Mesh(new THREE.CylinderGeometry(1.2, 1.4, 16, 8), palMat);
    mn.position.set(mx, 8, mz); g.add(mn);
    const b1 = new THREE.Mesh(new THREE.CylinderGeometry(1.3,1.3,0.6,8), bandMat);
    b1.position.set(mx,11,mz); g.add(b1);
    const b2 = new THREE.Mesh(new THREE.CylinderGeometry(1.3,1.3,0.6,8), bandMat);
    b2.position.set(mx,14,mz); g.add(b2);
    const sd = new THREE.Mesh(
      new THREE.SphereGeometry(1.4,10,10,0,Math.PI*2,0,Math.PI/2), domeMat);
    sd.position.set(mx,16,mz); g.add(sd);
    const ss = new THREE.Mesh(new THREE.ConeGeometry(0.2,2,6), goldMat);
    ss.position.set(mx,17.5,mz); g.add(ss);
  });

  const arch = new THREE.Mesh(new THREE.BoxGeometry(4,6,0.6),
    new THREE.MeshStandardMaterial({ color: 0x8b1a1a }));
  arch.position.set(0,3.5,8.3); g.add(arch);
  [0,1,2,3].forEach(i => {
    const st = new THREE.Mesh(new THREE.BoxGeometry(7-i,0.5,1.2), palMat);
    st.position.set(0, i*0.5, 9.2+(3-i)*0.6); g.add(st);
  });

  g.traverse(o => { if (o.isMesh) { o.castShadow=true; o.receiveShadow=true; } });
  g.position.set(x, 0, z);
  scene.add(g);
}
buildPalace(0, -CD + 20);

// Fish
function createFish() {
  const fishGroup = new THREE.Group();

  // Materials: Slightly shiny to simulate scales/wetness
  const bodyMaterial = new THREE.MeshStandardMaterial({ 
    color: 0xff7800, 
    roughness: 0.3,
    metalness: 0.1 
  });
  const finMaterial = new THREE.MeshStandardMaterial({ 
    color: 0xff5500, 
    roughness: 0.4 
  });

  // 1. Body (Squashed Sphere for a streamlined shape)
  const body = new THREE.Mesh(
    new THREE.SphereGeometry(0.5, 32, 16),
    bodyMaterial
  );
  // Scale: length = 1.2, height = 0.6, width (thickness) = 0.25
  body.scale.set(1.2, 0.6, 0.25); 
  fishGroup.add(body);

  // 2. Tail fin (Flattened Cone)
  const tail = new THREE.Mesh(
    new THREE.ConeGeometry(0.3, 0.5, 4),
    finMaterial
  );
  tail.rotation.z = -Math.PI / 2;
  tail.scale.z = 0.15; // Flatten it to look like a fin
  tail.position.x = -0.75;
  fishGroup.add(tail);

  // 3. Dorsal fin (Top)
  const dorsal = new THREE.Mesh(
    new THREE.ConeGeometry(0.15, 0.4, 4),
    finMaterial
  );
  dorsal.position.set(0, 0.3, 0);
  dorsal.rotation.z = -Math.PI / 4; // Sweep it backwards
  dorsal.scale.z = 0.15; // Flatten
  fishGroup.add(dorsal);

  // 4. Pectoral fins (Sides)
  const pectoralGeometry = new THREE.ConeGeometry(0.1, 0.25, 4);
  
  const rightFin = new THREE.Mesh(pectoralGeometry, finMaterial);
  rightFin.position.set(0.2, -0.1, 0.15);
  rightFin.rotation.set(-Math.PI / 2, 0, -Math.PI / 4);
  rightFin.scale.z = 0.15;
  fishGroup.add(rightFin);

  const leftFin = rightFin.clone(); 
  leftFin.position.z = -0.15;
  leftFin.rotation.set(Math.PI / 2, 0, -Math.PI / 4);
  fishGroup.add(leftFin);

  // 5. Eyes (Left and Right with pupils)
  const eyeGeometry = new THREE.SphereGeometry(0.06, 16, 16);
  const pupilGeometry = new THREE.SphereGeometry(0.03, 16, 16);
  
  const whiteMat = new THREE.MeshBasicMaterial({ color: 0xffffff });
  const blackMat = new THREE.MeshBasicMaterial({ color: 0x000000 });

  // Right Eye
  const rightEye = new THREE.Mesh(eyeGeometry, whiteMat);
  rightEye.position.set(0.35, 0.1, 0.11);
  const rightPupil = new THREE.Mesh(pupilGeometry, blackMat);
  rightPupil.position.set(0.38, 0.1, 0.15); 
  fishGroup.add(rightEye);
  fishGroup.add(rightPupil);

  // Left Eye
  const leftEye = new THREE.Mesh(eyeGeometry, whiteMat);
  leftEye.position.set(0.35, 0.1, -0.11);
  const leftPupil = new THREE.Mesh(pupilGeometry, blackMat);
  leftPupil.position.set(0.38, 0.1, -0.15);
  fishGroup.add(leftEye);
  fishGroup.add(leftPupil);   

  return fishGroup;
}
const fish = createFish();

fish.rotation.y = Math.PI;
scene.add(fish);

// Arab Houses 

const houseMat = new THREE.MeshStandardMaterial({ color: 0xf0d898, roughness: 0.9 });

function buildHouse(x, z, w=5, h=4, d=5) {
  const g = new THREE.Group();
  const body = new THREE.Mesh(new THREE.BoxGeometry(w,h,d), houseMat);
  body.position.y = h/2; body.castShadow = body.receiveShadow = true; g.add(body);
  const par = new THREE.Mesh(new THREE.BoxGeometry(w+0.5,0.7,d+0.5),
    new THREE.MeshStandardMaterial({ color: 0xe8c878 }));
  par.position.y = h+0.35; g.add(par);
  const door = new THREE.Mesh(new THREE.BoxGeometry(1.1,2.2,0.2),
    new THREE.MeshBasicMaterial({ color: 0x8b1a1a }));
  door.position.set(0,1.1,d/2+0.1); g.add(door);
  const win = new THREE.Mesh(new THREE.BoxGeometry(0.9,0.9,0.2),
    new THREE.MeshBasicMaterial({ color: 0x87ceeb }));
  win.position.set(1.2,2.5,d/2+0.1); g.add(win);
  g.position.set(x,0,z); scene.add(g);
}

[[-35,55],[-22,58],[22,58],[35,55],[-50,45],[50,45],[-40,35],[40,35],
 [-55,10],[55,10],[-60,-5],[60,-5],[-55,-20],[55,-20],
 [-45,-50],[45,-50],[-30,-60],[30,-60]
].forEach(([x,z]) => buildHouse(x,z, 4+Math.random()*3, 3+Math.random()*2, 4+Math.random()*3));

// WINDMILL  

function buildWindmill(x, z) {
  const g    = new THREE.Group();
  const stMat = new THREE.MeshStandardMaterial({ color: 0xd4c4a0, roughness: 0.9 });

  const tower = new THREE.Mesh(new THREE.CylinderGeometry(1.8,2.5,12,10), stMat);
  tower.position.y = 6; tower.castShadow = true; g.add(tower);
  const cap = new THREE.Mesh(new THREE.ConeGeometry(2.2,3,10),
    new THREE.MeshStandardMaterial({ map: woodTex }));
  cap.position.y = 13.5; g.add(cap);
  const hub = new THREE.Mesh(new THREE.SphereGeometry(0.5,8,8),
    new THREE.MeshStandardMaterial({ color: 0x5c3d1e }));
  hub.position.set(0,11,2.2); g.add(hub);

  const pivot = new THREE.Group();
  pivot.position.set(0,11,2.3); pivot.name = 'bladesPivot';
  const bMat = new THREE.MeshStandardMaterial({ map: woodTex, side: THREE.DoubleSide });
  [0,90,180,270].forEach(deg => {
    const blade = new THREE.Mesh(new THREE.BoxGeometry(0.45,5,0.18), bMat);
    blade.position.y = 2.8;
    const arm = new THREE.Group();
    arm.rotation.z = THREE.MathUtils.degToRad(deg);
    arm.add(blade); pivot.add(arm);
  });
  g.add(pivot);
  g.traverse(o => { if (o.isMesh) o.castShadow = true; });
  g.position.set(x,0,z); scene.add(g);
  return g;
}
const windmill = buildWindmill(-60, -40);


// Campfire, F key toggles

let campfireOn = true;

function buildCampfire(x, z) {
  const g      = new THREE.Group();
  const logMat = new THREE.MeshStandardMaterial({ color: 0x5C3317 });
  const logGeo = new THREE.CylinderGeometry(0.09,0.12,1.4,6);
  const l1 = new THREE.Mesh(logGeo, logMat);
  l1.rotation.z=Math.PI/2; l1.rotation.y=Math.PI/6; l1.position.y=0.1; g.add(l1);
  const l2 = new THREE.Mesh(logGeo, logMat);
  l2.rotation.z=Math.PI/2; l2.rotation.y=-Math.PI/6; l2.position.y=0.1; g.add(l2);

  for (let i=0;i<10;i++) {
    const a=(i/10)*Math.PI*2;
    const s=new THREE.Mesh(new THREE.SphereGeometry(0.2,5,5),
      new THREE.MeshStandardMaterial({color:0x888888}));
    s.position.set(Math.cos(a)*0.65,0.12,Math.sin(a)*0.65); g.add(s);
  }

  const flame = new THREE.Mesh(new THREE.ConeGeometry(0.25,0.85,7),
    new THREE.MeshBasicMaterial({color:0xff5500,transparent:true,opacity:0.9}));
  flame.position.y=0.6; flame.name='flame'; g.add(flame);

  const ember = new THREE.Mesh(new THREE.CircleGeometry(0.3,10),
    new THREE.MeshBasicMaterial({color:0xff2200,transparent:true,opacity:0.8,side:THREE.DoubleSide}));
  ember.rotation.x=-Math.PI/2; ember.position.y=0.11; ember.name='ember'; g.add(ember);

  g.position.set(x,0,z);
  g.traverse(o => { if (o.isMesh) o.castShadow=true; });
  scene.add(g);
  return g;
}
const campfire = buildCampfire(0, 22);

window.addEventListener('keydown', e => {
  if (e.key.toLowerCase() !== 'f') return;
  campfireOn = !campfireOn;
  const flame = campfire.getObjectByName('flame');
  const ember = campfire.getObjectByName('ember');
  if (flame) flame.visible = campfireOn;
  if (ember) ember.visible = campfireOn;
  campfireLight.intensity = campfireOn ? 5 : 0;
});

// Palm Trees — spread through compound

function buildPalmTree(x, z, h=7) {
  const g    = new THREE.Group();
  const tMat = new THREE.MeshStandardMaterial({ map: woodTex, roughness: 0.9 });
  const fMat = new THREE.MeshStandardMaterial({ color: 0x2a7a1a, roughness: 0.8, side: THREE.DoubleSide });
  const trunk = new THREE.Mesh(new THREE.CylinderGeometry(0.2,0.38,h,8), tMat);
  trunk.position.y=h/2; trunk.rotation.z=(Math.random()-0.5)*0.15;
  trunk.castShadow=true; g.add(trunk);
  [0,55,110,165,220,275,330].forEach(deg => {
    const rad=THREE.MathUtils.degToRad(deg);
    const frond=new THREE.Mesh(new THREE.SphereGeometry(1.3,6,4), fMat);
    frond.scale.set(1,0.18,0.5);
    frond.position.set(Math.cos(rad)*1.5,h+0.2,Math.sin(rad)*1.5);
    frond.rotation.y=rad; frond.rotation.z=0.45;
    frond.castShadow=true; g.add(frond);
  });
  g.position.set(x,0,z); scene.add(g);
}


buildPalmTree(-14, 3, 8); 
buildPalmTree(11, -10, 7);
buildPalmTree(-9, -13, 6); 
buildPalmTree(14, 8, 8);
buildPalmTree(0, 20, 9);  
buildPalmTree(-16, -10, 7);
buildPalmTree(16, -18, 8);
buildPalmTree(-25,65,7); 
buildPalmTree(25,65,7);
buildPalmTree(-45,70,6); 
buildPalmTree(45,70,6);
buildPalmTree(-8,72,8);  
buildPalmTree(8,72,8);
buildPalmTree(-48,22,7); 
buildPalmTree(48,22,7);
buildPalmTree(-50,-35,8); 
buildPalmTree(50,-35,8);
buildPalmTree(-25,-55,7); 
buildPalmTree(25,-55,7);


//  Shrubs

function buildShrub(x, z) {
  const g   = new THREE.Group();
  const mat = new THREE.MeshStandardMaterial({ color: 0x6b8c3a, roughness: 0.9 });
  [[0,0,0.6],[0.5,0.1,0.45],[-0.4,0.05,0.5],[0.1,0.2,0.5]].forEach(([cx,cy,r]) => {
    const b = new THREE.Mesh(new THREE.SphereGeometry(r,6,5), mat);
    b.position.set(cx, cy+r*0.5, 0); b.scale.set(1,0.6,1); g.add(b);
  });
  g.position.set(x,0,z); scene.add(g);
}
[-60,-45,-30,-15,0,15,30,45,60].forEach(x => {
  buildShrub(x, 78); buildShrub(x+5, 83);
});
[-65,-50,-35,-20].forEach(z => {
  buildShrub(-72, z); buildShrub(72, z);
});

// Rocks

function addRock(x, z, s=1) {
  const m = new THREE.Mesh(new THREE.IcosahedronGeometry(s,1),
    new THREE.MeshStandardMaterial({ map: stoneTex, roughness: 0.95 }));
  m.position.set(x, s*0.5, z);
  m.rotation.set(Math.random()*Math.PI, Math.random()*Math.PI, 0);
  m.castShadow = m.receiveShadow = true; scene.add(m);
}
[[-15,8,0.8],[-10,-6,0.5],[9,-11,1.1],[16,14,0.7],[28,8,1.2],
 [-24,14,0.8],[18,-20,1.0],[-33,-8,0.6],[33,22,0.9],[-20,22,0.7],
 [24,-10,0.8],[-40,50,1.0],[40,50,1.0]
].forEach(([x,z,s]) => addRock(x,z,s));

// Clouds

function addCloud(x, y, z, sc=1) {
  const g   = new THREE.Group();
  const mat = new THREE.MeshStandardMaterial({ color: 0xf5f5f5, roughness: 1 });
  [[0,0,0,3.5],[4,0.6,0,2.8],[-3.5,0.5,0,2.5],[1.5,-0.4,2,2.0],
   [-1.5,-0.3,-1.8,2.0],[6,0,0,1.8],[-6,0.2,0,1.8]
  ].forEach(([cx,cy,cz,r]) => {
    const p = new THREE.Mesh(new THREE.SphereGeometry(r*sc,7,6), mat);
    p.position.set(cx*sc, cy*sc, cz*sc); g.add(p);
  });
  g.position.set(x,y,z); scene.add(g);
}
addCloud(-80,95,-120,1.2); addCloud(30,105,-150,1.4);
addCloud(110,88,-100,1.0); addCloud(-40,100,-80,1.1);
addCloud(60,92,-130,1.3);  addCloud(0,110,-160,1.5);

// 12. Sun Sphere

const sunSphere = new THREE.Mesh(
  new THREE.SphereGeometry(4, 16, 16),
  new THREE.MeshBasicMaterial({ color: 0xffee55 })
);

sunSphere.position.set(50, 70, -20); 
scene.add(sunSphere);

sunLight.position.copy(sunSphere.position);

sunLight.intensity = 2.2;
sunLight.color.setRGB(1.0, 1.0, 1.0);
ambientLight.intensity = 0.6;


// ─────────────────────────────────────────────
// IMPORTED MODELS  [Requirement 4 — 3 models]
//   Download from poly.pizza, cite in report:
//   models/cactus.glb  — search "cactus"
//   models/barrel.glb  — search "barrel"
//   models/pot.glb     — search "pot"
// ─────────────────────────────────────────────
const gltfLoader = new GLTFLoader();
function loadModel(path, x, y, z, s, ry=0) {
  gltfLoader.load(path, gltf => {
    const m = gltf.scene;
    m.position.set(x,y,z); m.scale.setScalar(s); m.rotation.y=ry;
    m.traverse(c => { if (c.isMesh) { c.castShadow=true; c.receiveShadow=true; } });
    scene.add(m);
  }, undefined, () => console.warn('Could not load: '+path));
}

loadModel('models/cactus.glb',  85, 0,  15, 0.5);
loadModel('models/cactus.glb',  78, 0, -10, 0.4, 0.5);
loadModel('models/cactus.glb', -85, 0,  20, 0.55, 1.0);
loadModel('models/barrel.glb',   5,-0.2, -8, 0.5);  // barrel in the water
loadModel('models/pot.glb',      4, 0,   20, 0.45); // pot near campfire

// Skybox
const cubeLoader = new THREE.CubeTextureLoader();

const daySkybox = cubeLoader
  .setPath('textures/sky/day/')
  .load(['px.jpg','nx.jpg','py.jpg','ny.jpg','pz.jpg','nz.jpg']);

const nightSkybox = cubeLoader
  .setPath('textures/sky/night/')
  .load(['px.jpg','nx.jpg','py.jpg','ny.jpg','pz.jpg','nz.jpg']);

scene.background = daySkybox;  // start in daytime

// First Person Camera

const controls = new PointerLockControls(camera, renderer.domElement);
scene.add(controls.getObject());

const keys = {};
window.addEventListener('keydown', e => { keys[e.key.toLowerCase()] = true;  });
window.addEventListener('keyup',   e => { keys[e.key.toLowerCase()] = false; });

let velY = 0;
const GRAVITY = -0.012;
const EYE_H   =  20;
const SPEED   = 0.18;

document.getElementById('startScreen').addEventListener('click', () => controls.lock());
renderer.domElement.addEventListener('click', () => { if (!controls.isLocked) controls.lock(); });
controls.addEventListener('lock', () => {
  document.getElementById('startScreen').style.display = 'none';
  document.getElementById('crosshair').style.display   = 'block';
});
controls.addEventListener('unlock', () => {
  document.getElementById('crosshair').style.display = 'none';
});

function updateCamera() {
  if (!controls.isLocked) return;
  if (keys['w']) controls.moveForward( SPEED);
  if (keys['s']) controls.moveForward(-SPEED);
  if (keys['a']) controls.moveRight(  -SPEED);
  if (keys['d']) controls.moveRight(   SPEED);
  const pos = controls.getObject().position;
  if (keys[' '] && pos.y <= EYE_H + 0.05) velY = 0.22;
  velY += GRAVITY;
  pos.y += velY;
  if (pos.y <= EYE_H) { pos.y = EYE_H; velY = 0; }
  pos.x = THREE.MathUtils.clamp(pos.x, -90, 90);
  pos.z = THREE.MathUtils.clamp(pos.z, -100, 100);
}

// Day/Night toggle with N key

let isNight = false;
window.addEventListener('keydown', e => {
  if (e.key.toLowerCase() !== 'n') return;
  isNight = !isNight;
  if (isNight) {
    // Night mode 
    scene.background          = nightSkybox;
    scene.fog.color.setHex(0x0a0a2e);

    sunLight.intensity        = 0.2;
    sunLight.color.setHex(0x4466aa);  // cold moonlight
    ambientLight.intensity    = 0.15;
    ambientLight.color.setHex(0x1a2a4a);

    campfireLight.intensity   = 5;      // campfire pops at night

    waterUniforms.uWaterColor.value.setHex(0x001144);  // dark water
    fillLight.intensity       = 0.1;

  } else {
    // Day mode
    scene.background          = daySkybox;
    scene.fog.color.setHex(0xf5c89a);

    sunLight.intensity        = 2.0;
    sunLight.color.setHex(0xfff5cc);
    ambientLight.intensity    = 0.6;
    ambientLight.color.setHex(0xffeedd);

    campfireLight.intensity   = 3;

    waterUniforms.uWaterColor.value.setHex(0x006994);  // clear day water
    fillLight.intensity       = 0.5;
  }
  skyDome.material.needsUpdate = true;
});


window.addEventListener('resize', () => {
  camera.aspect = window.innerWidth / window.innerHeight;
  camera.updateProjectionMatrix();
  renderer.setSize(window.innerWidth, window.innerHeight);
});


// Animate

function animate() {
  requestAnimationFrame(animate);
  const t = clock.getElapsedTime();

  // Animation 1: Fish swimming
  const fishRadius = 5.0;
  const fishSpeed  = 0.5;
  fish.position.x  =  Math.cos(t * fishSpeed) * fishRadius;
  fish.position.z  =  Math.sin(t * fishSpeed) * fishRadius;
  fish.position.y  =  0.1 + Math.sin(t * 2.0) * 0.05; 
  fish.rotation.y  = -t * fishSpeed + Math.PI / 2;

  // Animation 2 — Windmill blades rotate
  const blades = windmill.getObjectByName('bladesPivot');
  if (blades) blades.rotation.z = t * 1.3;

  // Animation 3  — Campfire flicker 
  if (campfireOn) {
    const flame = campfire.getObjectByName('flame');
    if (flame) {
      flame.scale.y = 0.88 + Math.sin(t*13.0)*0.18;
      flame.scale.x = 0.88 + Math.cos(t*9.5)*0.12;
      flame.material.opacity = 0.72 + Math.sin(t*8.5)*0.18;
    }
    campfireLight.intensity = (isNight?8:5) + Math.sin(t*8.0)*0.7;
  }

   // Animation 4: Water shader
  waterUniforms.uTime.value = t;

  // Sun arc
  sunLight.position.set(
    Math.cos(t*0.025)*200,
    Math.abs(Math.sin(t*0.025))*200+30,
    -50
  );

  updateCamera();
  renderer.render(scene, camera);
}

animate();
