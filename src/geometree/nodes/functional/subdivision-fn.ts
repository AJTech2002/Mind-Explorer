import { wgslFn } from "three/tsl";



export const flatSubdivide = wgslFn(`
fn compute(
  inPositions: ptr<storage, array<vec3<f32>>, read>,
  inIndices: ptr<storage, array<u32>, read>,
  inUVs: ptr<storage, array<vec2<f32>>, read>,

  outPositions: ptr<storage, array<vec3<f32>>, read_write>,
  outIndices: ptr<storage, array<u32>, read_write>,
  outUVs: ptr<storage, array<vec2<f32>>, read_write>,

  vertexCounter: ptr<storage, array<atomic<u32>>, read_write>,
  indexCounter: ptr<storage, array<atomic<u32>>, read_write>,

  triIndex: u32
) -> void {

  let i0 = inIndices[triIndex * 3u + 0u];
  let i1 = inIndices[triIndex * 3u + 1u];
  let i2 = inIndices[triIndex * 3u + 2u];

  let v0 = inPositions[i0];
  let v1 = inPositions[i1];
  let v2 = inPositions[i2];

  let uv0 = inUVs[i0];
  let uv1 = inUVs[i1];
  let uv2 = inUVs[i2];

  let m0 = (v0 + v1) * 0.5;
  let m1 = (v1 + v2) * 0.5;
  let m2 = (v2 + v0) * 0.5;

  let uv_m0 = (uv0 + uv1) * 0.5;
  let uv_m1 = (uv1 + uv2) * 0.5;
  let uv_m2 = (uv2 + uv0) * 0.5;

  let vBase = atomicAdd(&vertexCounter[0], 6u);
  let iBase = atomicAdd(&indexCounter[0], 12u);

  outPositions[vBase + 0u] = v0;
  outPositions[vBase + 1u] = v1;
  outPositions[vBase + 2u] = v2;
  outPositions[vBase + 3u] = m0;
  outPositions[vBase + 4u] = m1;
  outPositions[vBase + 5u] = m2;

  outUVs[vBase + 0u] = uv0;
  outUVs[vBase + 1u] = uv1;
  outUVs[vBase + 2u] = uv2;
  outUVs[vBase + 3u] = uv_m0;
  outUVs[vBase + 4u] = uv_m1;
  outUVs[vBase + 5u] = uv_m2;

  outIndices[iBase + 0u] = vBase + 0u;
  outIndices[iBase + 1u] = vBase + 3u;
  outIndices[iBase + 2u] = vBase + 5u;

  outIndices[iBase + 3u] = vBase + 3u;
  outIndices[iBase + 4u] = vBase + 1u;
  outIndices[iBase + 5u] = vBase + 4u;

  outIndices[iBase + 6u] = vBase + 5u;
  outIndices[iBase + 7u] = vBase + 4u;
  outIndices[iBase + 8u] = vBase + 2u;

  outIndices[iBase + 9u]  = vBase + 3u;
  outIndices[iBase + 10u] = vBase + 4u;
  outIndices[iBase + 11u] = vBase + 5u;
}
`);

export const sineWaveTest = wgslFn(`

fn compute (
  inPosition: ptr<storage, array<vec3<f32>>, read>,
  outPosition: ptr<storage, array<vec3<f32>>, read_write>,
  index: u32,
  time: f32
) -> void {

  outPosition[index] = inPosition[index] * time; 

}
`);



