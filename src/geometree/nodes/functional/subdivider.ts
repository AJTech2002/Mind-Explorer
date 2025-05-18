import * as THREE from "three/webgpu";
import { StorageBufferAttribute, StorageBufferNode, WebGPURenderer } from "three/webgpu";
import { GeometryData } from "../primitives/geometryPrimitive";
import { instanceIndex, storage, uniform, wgslFn } from "three/tsl";
import { flatSubdivide, sineWaveTest } from "./subdivision-fn";

export default class GeometrySubdivider {

  private extract_vertices(data: Float32Array): Float32Array {

    // Just get the vec3 positions, and ignore the padding 
    const newFloatArray = [];
    for (let i = 0; i < data.length; i += 4) {
      newFloatArray.push(data[i]);
      newFloatArray.push(data[i + 1]);
      newFloatArray.push(data[i + 2]);
    }

    return new Float32Array(newFloatArray);
  }

  /* CPU Subdivision - Actual Example */

  public async get_geometry(renderer: THREE.WebGPURenderer, input: GeometryData, iterations: number): Promise<GeometryData> {
    let vertices = input.vertices;
    let indices = input.indices;
    let uvs = input.uvs;
    let normals = input.normals;

    for (let i = 0; i < iterations; i++) {
      let newVertices: number[] = [];
      let newIndices: number[] = [];
      let newUVs: number[] = [];
      let newNormals: number[] = [];

      const vertexMap = new Map<string, number>();

      const getVertex = (i: number) => {
        return [vertices[i * 3], vertices[i * 3 + 1], vertices[i * 3 + 2]];
      };

      const getUV = (i: number) => {
        return [uvs[i * 2], uvs[i * 2 + 1]];
      };

      const midpointIndex = (i1: number, i2: number) => {
        const key = i1 < i2 ? `${i1}_${i2}` : `${i2}_${i1}`;
        if (vertexMap.has(key)) return vertexMap.get(key)!;

        const [x1, y1, z1] = getVertex(i1);
        const [x2, y2, z2] = getVertex(i2);
        const mx = (x1 + x2) / 2;
        const my = (y1 + y2) / 2;
        const mz = (z1 + z2) / 2;

        const [u1, v1] = getUV(i1);
        const [u2, v2] = getUV(i2);
        const mu = (u1 + u2) / 2;
        const mv = (v1 + v2) / 2;

        const newIndex = newVertices.length / 3;
        newVertices.push(mx, my, mz);
        // copy normals 
        newNormals.push(normals[i1 * 3], normals[i1 * 3 + 1], normals[i1 * 3 + 2]);
        newUVs.push(mu, mv);
        vertexMap.set(key, newIndex);
        return newIndex;
      };

      // Copy original vertices and uvs
      for (let i = 0; i < vertices.length; i++) newVertices.push(vertices[i]);
      for (let i = 0; i < uvs.length; i++) newUVs.push(uvs[i]);

      for (let i = 0; i < indices.length; i += 3) {
        const i0 = indices[i];
        const i1 = indices[i + 1];
        const i2 = indices[i + 2];

        const m01 = midpointIndex(i0, i1);
        const m12 = midpointIndex(i1, i2);
        const m20 = midpointIndex(i2, i0);

        newIndices.push(
          i0, m01, m20,
          i1, m12, m01,
          i2, m20, m12,
          m01, m12, m20
        );
      }

      vertices = new Float32Array(newVertices);
      indices = new Uint32Array(newIndices);
      uvs = new Float32Array(newUVs);
      normals = new Float32Array(newNormals);
    }

    return {
      vertices: vertices,
      indices: indices,
      uvs: uvs,
      normals: normals,
    };
  }
  /* Example of GPU Compute Shader to Modify Geometry */
  public async get_gpu_geometry(renderer: THREE.WebGPURenderer, input: GeometryData, iterations: number): Promise<GeometryData> {
    const vertices = input.vertices;
    const indices = input.indices;
    const uvs = input.uvs;

    const positionBuffer = new THREE.StorageBufferAttribute(vertices, 3);
    const indexBuffer = new THREE.StorageBufferAttribute(indices, 1);
    const uvBuffer = new THREE.StorageBufferAttribute(uvs, 2);

    const triangleCount = indices.length / 3;
    const maxVerts = 6 * triangleCount;
    const maxIndices = 12 * triangleCount;

    const outPositionBuffer = new THREE.StorageBufferAttribute(new Float32Array(maxVerts * 3), 3);
    const outUVBuffer = new THREE.StorageBufferAttribute(new Float32Array(maxVerts * 2), 2);
    const outIndexBuffer = new THREE.StorageBufferAttribute(new Uint32Array(maxIndices), 1);

    const vertexCounterBuffer = new THREE.StorageBufferAttribute(new Uint32Array([0]), 1);
    const indexCounterBuffer = new THREE.StorageBufferAttribute(new Uint32Array([0]), 1);

    const computeParams = {
      inPositions: storage(positionBuffer, 'vec3', positionBuffer.count).toReadOnly(),
      inIndices: storage(indexBuffer, 'u32', indexBuffer.count).toReadOnly(),
      inUVs: storage(uvBuffer, 'vec2', uvBuffer.count).toReadOnly(),

      outPositions: storage(outPositionBuffer, 'vec3', maxVerts),
      outUVs: storage(outUVBuffer, 'vec2', maxVerts),
      outIndices: storage(outIndexBuffer, 'u32', maxIndices),

      vertexCounter: storage(vertexCounterBuffer, 'atomic<u32>', 1),
      indexCounter: storage(indexCounterBuffer, 'atomic<u32>', 1),

      triIndex: instanceIndex,
    };

    // Run the compute shader
    const computeNode = flatSubdivide(computeParams).compute(triangleCount);
    await renderer.computeAsync(computeNode);

    // Fetch results
    const finalVerts = new Float32Array(await renderer.getArrayBufferAsync(outPositionBuffer));
    const finalIndices = new Uint32Array(await renderer.getArrayBufferAsync(outIndexBuffer));
    const finalUVs = new Float32Array(await renderer.getArrayBufferAsync(outUVBuffer));

    console.log(finalVerts, finalIndices);

    return {
      vertices: finalVerts,
      indices: finalIndices,
      uvs: finalUVs,
      normals: new Float32Array(finalVerts.length), // placeholder or compute later
    };
  }

}
