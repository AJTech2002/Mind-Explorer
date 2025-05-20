import { color, screenUV } from 'three/tsl';
import * as THREE from 'three/webgpu';
import { OrbitControls } from 'three/examples/jsm/controls/OrbitControls';

export default class Renderer {

  protected canvas: HTMLCanvasElement;
  protected camera!: THREE.OrthographicCamera;
  protected scene!: THREE.Scene;
  protected renderer!: THREE.WebGPURenderer;
  protected controls!: OrbitControls;


  constructor(canvas: HTMLCanvasElement) {

    this.canvas = canvas;
    this.init();

  }

  init() {

    this.scene = new THREE.Scene();
    this.scene.background = new THREE.Color(0x000000);


    const ambientLight = new THREE.AmbientLight(0xffffff, 2.0);
    this.scene.add(ambientLight);

    const aspect = window.innerWidth / window.innerHeight;
    this.size = 3;

    this.camera = new THREE.OrthographicCamera(
      -this.size * aspect,
      this.size * aspect,
      this.size,
      -this.size,
      0.001,
      1000
    );

    window.addEventListener('resize', () => {
      this.updateCamera();
    });

    this.renderer = new THREE.WebGPURenderer({
      canvas: this.canvas,
      alpha: true,
      antialias: true,
      stencil: true,
      powerPreference: 'high-performance',
    });


    this.updateCamera();


    const controls = new OrbitControls(this.camera, this.renderer.domElement);
    //controls.enableDamping = true;
    controls.dampingFactor = .05;

    this.controls = controls;
    this.controls.enablePan = false;

    this.onStart();

    const animate = () => {
      this.onUpdate();
      requestAnimationFrame(animate);
    }

    requestAnimationFrame(animate);
  }


  private _size: number = 1;

  public get size() {
    return this._size;
  }

  public set size(value: number) {
    this._size = value;
    this.updateCamera();
  }

  updateCamera() {

    if (!(this.renderer && this.scene && this.camera)) {
      return;
    }

    const aspect = window.innerWidth / window.innerHeight;
    this.camera.left = -this.size * aspect;
    this.camera.right = this.size * aspect;
    this.camera.top = this.size;
    this.camera.bottom = -this.size;
    this.camera.updateProjectionMatrix();
    console.log(this.camera.projectionMatrix);

    this.renderer.setSize(window.innerWidth, window.innerHeight);
  }

  protected onStart() {


  }

  protected time = 0;
  protected delta = 0;
  private lastTime = 0;

  protected onUpdate(time: number = 0) {

    if (!(this.renderer && this.scene && this.camera)) {
      return;
    }

    this.time = time / 1000;
    this.delta = this.time - this.lastTime;
    this.lastTime = this.time;

    this.renderer.renderAsync(this.scene, this.camera);
    this.controls.update();

  }

}
