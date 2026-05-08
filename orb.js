import * as THREE from 'three';
import { OrbitControls } from 'three/addons/controls/OrbitControls.js';

// --- Shaders ---

const vertexShader = `
    varying vec2 vUv;
    varying vec3 vPosition;
    varying vec3 vNormal;
    uniform float uTime;
    uniform float uState; // 0: idle, 1: listen, 2: speak
    uniform float uAudioData;

    // Simplex 3D Noise 
    // by Ian McEwan, Ashima Arts
    vec4 permute(vec4 x){return mod(((x*34.0)+1.0)*x, 289.0);}
    vec4 taylorInvSqrt(vec4 r){return 1.79284291400159 - 0.85373472095314 * r;}

    float snoise(vec3 v){ 
        const vec2  C = vec2(1.0/6.0, 1.0/3.0) ;
        const vec4  D = vec4(0.0, 0.5, 1.0, 2.0);

        // First corner
        vec3 i  = floor(v + dot(v, C.yyy) );
        vec3 x0 = v - i + dot(i, C.xxx) ;

        // Other corners
        vec3 g = step(x0.yzx, x0.xyz);
        vec3 l = 1.0 - g;
        vec3 i1 = min( g.xyz, l.zxy );
        vec3 i2 = max( g.xyz, l.zxy );

        //  x0 = x0 - 0.0 + 0.0 * C 
        vec3 x1 = x0 - i1 + 1.0 * C.xxx;
        vec3 x2 = x0 - i2 + 2.0 * C.xxx;
        vec3 x3 = x0 - 1.0 + 3.0 * C.xxx;

        // Permutations
        i = mod(i, 289.0 ); 
        vec4 p = permute( permute( permute( 
                    i.z + vec4(0.0, i1.z, i2.z, 1.0 ))
                  + i.y + vec4(0.0, i1.y, i2.y, 1.0 )) 
                  + i.x + vec4(0.0, i1.x, i2.x, 1.0 ));

        // Gradients
        // ( N*N points uniformly over a square, mapped onto an octahedron.)
        float n_ = 1.0/7.0; // N=7
        vec3  ns = n_ * D.wyz - D.xzx;

        vec4 j = p - 49.0 * floor(p * ns.z *ns.z);  //  mod(p,N*N)

        vec4 x_ = floor(j * ns.z);
        vec4 y_ = floor(j - 7.0 * x_ );    // mod(j,N)

        vec4 x = x_ *ns.x + ns.yyyy;
        vec4 y = y_ *ns.x + ns.yyyy;
        vec4 h = 1.0 - abs(x) - abs(y);

        vec4 b0 = vec4( x.xy, y.xy );
        vec4 b1 = vec4( x.zw, y.zw );

        vec4 s0 = floor(b0)*2.0 + 1.0;
        vec4 s1 = floor(b1)*2.0 + 1.0;
        vec4 sh = -step(h, vec4(0.0));

        vec4 a0 = b0.xzyw + s0.xzyw*sh.xxyy ;
        vec4 a1 = b1.xzyw + s1.xzyw*sh.zzww ;

        vec3 p0 = vec3(a0.xy,h.x);
        vec3 p1 = vec3(a0.zw,h.y);
        vec3 p2 = vec3(a1.xy,h.z);
        vec3 p3 = vec3(a1.zw,h.w);

        //Normalise gradients
        vec4 norm = taylorInvSqrt(vec4(dot(p0,p0), dot(p1,p1), dot(p2, p2), dot(p3,p3)));
        p0 *= norm.x;
        p1 *= norm.y;
        p2 *= norm.z;
        p3 *= norm.w;

        // Mix final noise value
        vec4 m = max(0.6 - vec4(dot(x0,x0), dot(x1,x1), dot(x2,x2), dot(x3,x3)), 0.0);
        m = m * m;
        return 42.0 * dot( m*m, vec4( dot(p0,x0), dot(p1,x1), 
                                      dot(p2,x2), dot(p3,x3) ) );
    }

    void main() {
        vUv = uv;
        vNormal = normalize(normalMatrix * normal);
        
        float noiseFreq = 1.5;
        float noiseAmp = 0.2;
        vec3 noisePos = vec3(position.x * noiseFreq + uTime, position.y * noiseFreq + uTime, position.z * noiseFreq);
        
        float distortion = snoise(noisePos) * noiseAmp;
        
        // Modify distortion based on state
        if (uState == 1.0) { // Listen
            distortion += snoise(noisePos * 2.0) * 0.3 * uAudioData;
        } else if (uState == 2.0) { // Speak
            distortion += sin(position.y * 10.0 + uTime * 5.0) * 0.1 * uAudioData;
        }

        vec3 newPosition = position + normal * distortion;
        vPosition = newPosition;

        gl_Position = projectionMatrix * modelViewMatrix * vec4(newPosition, 1.0);
    }
`;

const fragmentShader = `
    varying vec2 vUv;
    varying vec3 vPosition;
    varying vec3 vNormal;
    uniform float uTime;
    uniform float uState;

    void main() {
        // Base colors
        vec3 colorDark = vec3(0.1, 0.0, 0.5); // Deep Purple
        vec3 colorLight = vec3(0.0, 0.8, 1.0); // Cyan/Blue
        vec3 colorAccent = vec3(1.0, 0.0, 1.0); // Magenta
        
        // Fresnel effect for glow at edges
        vec3 viewDirection = normalize(cameraPosition - vPosition);
        float fresnelTerm = dot(viewDirection, vNormal);
        fresnelTerm = clamp(1.0 - fresnelTerm, 0.0, 1.0);
        fresnelTerm = pow(fresnelTerm, 2.0);

        // Dynamic color mixing
        float mixValue = sin(vPosition.y * 2.0 + uTime) * 0.5 + 0.5;
        vec3 color = mix(colorDark, colorLight, mixValue);
        
        // Add accent color based on state
        if (uState == 1.0) { // Listen
            color = mix(color, colorAccent, fresnelTerm * 1.5);
        } else if (uState == 2.0) { // Speak - Multi-color spectrum
            vec3 colorA = vec3(1.0, 0.0, 0.5); // Pink
            vec3 colorB = vec3(0.0, 1.0, 0.5); // Green/Cyan
            vec3 colorC = vec3(1.0, 1.0, 0.0); // Yellow
            
            float colorMix = sin(vPosition.x * 2.0 + uTime * 5.0) * 0.5 + 0.5;
            vec3 speakColor = mix(colorA, colorB, colorMix);
            speakColor = mix(speakColor, colorC, sin(uTime * 3.0) * 0.5 + 0.5);
            
            color = mix(color, speakColor, fresnelTerm * 1.8);
        } else {
            color = mix(color, colorAccent, fresnelTerm);
        }

        gl_FragColor = vec4(color + fresnelTerm * 1.2, 0.95); // Higher intensity
    }
`;

const layerFragmentShader = `
    varying vec2 vUv;
    varying vec3 vPosition;
    varying vec3 vNormal;
    uniform float uTime;
    uniform float uColor; // index for color shift

    void main() {
        vec3 color1 = vec3(0.5, 0.0, 1.0); // Purple
        vec3 color2 = vec3(0.0, 1.0, 0.8); // Teal
        vec3 color3 = vec3(1.0, 0.3, 0.0); // Orange
        
        vec3 baseColor = color1;
        if(uColor > 0.5) baseColor = color2;
        if(uColor > 1.5) baseColor = color3;

        float fresnel = pow(1.0 - dot(vec3(0,0,1), vNormal), 3.0);
        float pulse = sin(uTime * 2.0 + vPosition.x) * 0.5 + 0.5;
        
        gl_FragColor = vec4(baseColor, fresnel * pulse * 0.6);
    }
`;

// --- Setup ---

const container = document.getElementById('canvas-container');
const scene = new THREE.Scene();

// Camera
const camera = new THREE.PerspectiveCamera(75, window.innerWidth / window.innerHeight, 0.1, 1000);
camera.position.z = 5;

// Renderer
const renderer = new THREE.WebGLRenderer({ antialias: true, alpha: true });
renderer.setSize(window.innerWidth, window.innerHeight);
renderer.setPixelRatio(window.devicePixelRatio);
container.appendChild(renderer.domElement);

// Controls - Disabled rotation/zoom for automatic experience
const controls = new OrbitControls(camera, renderer.domElement);
controls.enableRotate = false;
controls.enableZoom = false;
controls.enablePan = false;

// --- Objects ---

// Core Orb Material
const uniforms = {
    uTime: { value: 0 },
    uState: { value: 0 }, // 0: idle, 1: listen, 2: speak
    uAudioData: { value: 0.5 }
};

const material = new THREE.ShaderMaterial({
    vertexShader: vertexShader,
    fragmentShader: fragmentShader,
    uniforms: uniforms,
    transparent: true,
    wireframe: false // Changed to false for a smooth, organic look in all states
});

// Inner vibrant core
const innerMaterial = new THREE.ShaderMaterial({
    vertexShader: vertexShader,
    fragmentShader: layerFragmentShader,
    uniforms: {
        uTime: { value: 0 },
        uColor: { value: 2.0 },
        uState: { value: 0 },
        uAudioData: { value: 0.5 }
    },
    transparent: true,
    blending: THREE.AdditiveBlending,
    side: THREE.DoubleSide
});

// Outer Geometry
const geometry = new THREE.IcosahedronGeometry(2, 64);
const sphere = new THREE.Mesh(geometry, material);
scene.add(sphere);

// Middle Energy Layer
const midMaterial = new THREE.ShaderMaterial({
    vertexShader: vertexShader,
    fragmentShader: layerFragmentShader,
    uniforms: {
        uTime: { value: 0 },
        uColor: { value: 1.0 },
        uState: { value: 0 },
        uAudioData: { value: 0.5 }
    },
    transparent: true,
    blending: THREE.AdditiveBlending
});
const midSphere = new THREE.Mesh(new THREE.IcosahedronGeometry(1.8, 128), midMaterial);
scene.add(midSphere);

// Inner Geometry (The New Core)
const innerGeometry = new THREE.IcosahedronGeometry(1.2, 128);
const innerSphere = new THREE.Mesh(innerGeometry, innerMaterial);
scene.add(innerSphere);

// Extra shell for depth
const shellMaterial = new THREE.MeshBasicMaterial({
    color: 0x4400ff,
    wireframe: true,
    transparent: true,
    opacity: 0.1
});
const shell = new THREE.Mesh(new THREE.IcosahedronGeometry(2.1, 10), shellMaterial);
scene.add(shell);

// Lights
const ambientLight = new THREE.AmbientLight(0xffffff, 0.5);
scene.add(ambientLight);

const pointLight = new THREE.PointLight(0xff00ff, 2, 10);
pointLight.position.set(0, 0, 0);
scene.add(pointLight);


// --- Animation Loop ---

const clock = new THREE.Clock();
let targetAudioData = 0.2;

function animate() {
    requestAnimationFrame(animate);

    const elapsedTime = clock.getElapsedTime();
    uniforms.uTime.value = elapsedTime;
    midMaterial.uniforms.uTime.value = elapsedTime;
    innerMaterial.uniforms.uTime.value = elapsedTime;

    // Simulate audio data fluctuation
    if (uniforms.uState.value === 1) { // Listen
        targetAudioData = 0.5 + Math.random() * 0.5;
    } else if (uniforms.uState.value === 2) { // Speak
        targetAudioData = 0.8 + Math.sin(elapsedTime * 10) * 0.4;
    } else {
        targetAudioData = 0.1; // Idle
    }

    // Smooth audio data transition
    uniforms.uAudioData.value += (targetAudioData - uniforms.uAudioData.value) * 0.1;
    midMaterial.uniforms.uAudioData.value = uniforms.uAudioData.value;
    innerMaterial.uniforms.uAudioData.value = uniforms.uAudioData.value;

    // Rotate spheres - Slowed down for a smooth and pleasant experience
    sphere.rotation.y += 0.0015;
    sphere.rotation.z += 0.0005;

    midSphere.rotation.y -= 0.0018;
    midSphere.rotation.x += 0.001;

    innerSphere.rotation.y += 0.003;
    innerSphere.rotation.x -= 0.002;

    shell.rotation.y -= 0.0005;

    // Automatic scene rotation for cinematic feel - subtle movement
    scene.rotation.y = Math.sin(elapsedTime * 0.1) * 0.1;
    scene.rotation.x = Math.cos(elapsedTime * 0.05) * 0.05;

    controls.update();
    renderer.render(scene, camera);
}

animate();

// --- Event Listeners ---

window.addEventListener('resize', () => {
    camera.aspect = window.innerWidth / window.innerHeight;
    camera.updateProjectionMatrix();
    renderer.setSize(window.innerWidth, window.innerHeight);
});

// UI Controls mapping
document.getElementById('btn-idle').addEventListener('click', (e) => {
    setActiveButton(e.target);
    uniforms.uState.value = 0;
    material.wireframe = true;
});

document.getElementById('btn-listen').addEventListener('click', (e) => {
    setActiveButton(e.target);
    uniforms.uState.value = 1;
    material.wireframe = false;
});

document.getElementById('btn-speak').addEventListener('click', (e) => {
    setActiveButton(e.target);
    uniforms.uState.value = 2;
    material.wireframe = false;
});

function setActiveButton(btn) {
    document.querySelectorAll('.controls button').forEach(b => b.classList.remove('active'));
    btn.classList.add('active');
}
