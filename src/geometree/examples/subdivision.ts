import * as THREE from "three/webgpu";
import Renderer from "../../core/renderer.ts";
import GeometryOutput from "../nodes/output.ts";
import PlanePrimitive from "../nodes/primitives/plane.ts";
import GeometrySubdivider from "../nodes/functional/subdivider.ts";
import { abs, dFdx, dFdy, distance, float, floor, Fn, min, mix, mx_noise_float, normalLocal, positionLocal, pow, rotate, smoothstep, step, uniform, uv, vec3, wgslFn } from "three/tsl";
import { mx_perlin_noise_float, mx_perlin_noise_vec3 } from "three/src/nodes/materialx/lib/mx_noise.js";

export default class SubdivisionRendererExample extends Renderer {

  // time uniform
  uniformTime = uniform(float(5))
  private material!: THREE.MeshBasicNodeMaterial;

  override async onStart() {
    
  }

  createTerrain() {
    // add a plane to test the Renderer
    //const geometry = new THREE.PlaneGeometry(1, 1);

    let planeGeom = new PlanePrimitive().get_geometry();
    planeGeom = await new GeometrySubdivider().get_geometry(this.renderer, planeGeom, 9);
    const geometry = new GeometryOutput().get_geometry(planeGeom);

    // add directional light
    const light = new THREE.DirectionalLight(0xffffff, 2);
    //light.position.set(2, 2, 2)
    light.lookAt(0, 0, 0);
    light.castShadow = true;

    this.scene.add(light);

    const material = new THREE.MeshBasicNodeMaterial({
      color: 0x00ff00,
      side: THREE.DoubleSide,
      //wireframe: true,
      dithering: true,
    });

    this.material = material;

    const position = positionLocal.xyz;
    const samplePosition = position.add(vec3(this.uniformTime, 0, 0));
    const frequency = 8;
    const warp = 0.2
    const edgeThreshold = float(0.02);
    const uvCoord = uv();
    const edgeDist = min(
      min(uvCoord.x, float(1.0).sub(uvCoord.x)),
      min(uvCoord.y, float(1.0).sub(uvCoord.y))
    );

    let dissolve = step(edgeThreshold, edgeDist);


    const steps = warp * 30;

    const noiseInput = samplePosition.mul(frequency);
    const elevation = mx_noise_float(noiseInput);

    const steppedElevation = floor(elevation.mul(steps)).div(steps).mul(warp).mul(dissolve);

    let intensity = float(1).sub((positionLocal.z.mul(7).add(0.5)));


    //const edge = pow(abs(dFdx(intensity)).add(abs(dFdy(intensity))), 0.5);
    const edge = pow(abs(dFdy(intensity)), 0.5);
    material.colorNode = uv().mul(intensity).sub(smoothstep(0.02, 0.5, edge))    //material.opacityNode = 
    //material.positionNode = vec3(position.x, steppedElevation, position.z);
    material.positionNode = vec3(position.x, position.y, steppedElevation);

    material.onBeforeCompile = (shader) => {
    };

    this.camera.position.set(2, 2, 2);
    this.camera.lookAt(0, 0, 0);

    const plane = new THREE.Mesh(new THREE.PlaneGeometry(2, 2, 750, 750), material);

    plane.rotateX(Math.PI / 2);


    plane.position.set(0, 0, 0);

    this.createSidePlanes();
    this.scene.add(plane);
  }

  createSidePlanes() {
    const group = new THREE.Group();
    const size = 1;
    const material = new THREE.MeshStandardNodeMaterial({ side: THREE.DoubleSide });
    const intensity = positionLocal.y;
    material.colorNode = uv().mul(intensity);

    // Front (+Z)
    const front = new THREE.Mesh(new THREE.PlaneGeometry(size, size), material);
    front.position.z = size / 2;
    group.add(front);

    // Back (-Z)
    const back = new THREE.Mesh(new THREE.PlaneGeometry(size, size), material);
    back.position.z = -size / 2;
    back.rotateY(Math.PI); // flip it
    group.add(back);

    // Right (+X)
    const right = new THREE.Mesh(new THREE.PlaneGeometry(size, size), material);
    right.position.x = size / 2;
    right.rotateY(-Math.PI / 2);
    group.add(right);

    // Left (-X)
    const left = new THREE.Mesh(new THREE.PlaneGeometry(size, size), material);
    left.position.x = -size / 2;
    left.rotateY(Math.PI / 2);
    group.add(left);

    group.scale.set(2, 0.5, 2);
    group.position.set(0, -0.25, 0);
    this.scene.add(group);
  }

  override onUpdate() {


    this.uniformTime.value += 0.01;
    //this.material.needsUpdate = true;
    this.renderer.render(this.scene, this.camera);
  }

}
