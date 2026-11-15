import * as THREE from 'three';
import { ArenaMapId } from './types';

export interface ProceduralTextureSet {
  groundMap: THREE.CanvasTexture;
  groundBump: THREE.CanvasTexture;
  crateMap: THREE.CanvasTexture;
  crateBump: THREE.CanvasTexture;
  concreteMap: THREE.CanvasTexture;
  contactShadowMap: THREE.CanvasTexture;
  dispose: () => void;
}

function makeCanvas(size: number): [HTMLCanvasElement, CanvasRenderingContext2D] {
  const canvas = document.createElement('canvas');
  canvas.width = size;
  canvas.height = size;
  const ctx = canvas.getContext('2d')!;
  return [canvas, ctx];
}

function seededRand(seed: number): () => number {
  let s = seed >>> 0;
  return () => {
    s = (s * 1664525 + 1013904223) >>> 0;
    return s / 4294967296;
  };
}

export function createProceduralTextures(
  mapId: ArenaMapId,
  maxAnisotropy: number,
): ProceduralTextureSet {
  const rand = seededRand(mapId === 'farm' ? 101 : mapId === 'city' ? 202 : 303);

  // 1. Ground Albedo + Bump
  const [gCanvas, gCtx] = makeCanvas(256);
  const [gbCanvas, gbCtx] = makeCanvas(256);

  if (mapId === 'farm') {
    gCtx.fillStyle = '#538340';
    gCtx.fillRect(0, 0, 256, 256);
    gbCtx.fillStyle = '#808080';
    gbCtx.fillRect(0, 0, 256, 256);
    for (let i = 0; i < 1400; i++) {
      const x = rand() * 256;
      const y = rand() * 256;
      const w = 2 + rand() * 5;
      const h = 4 + rand() * 8;
      gCtx.fillStyle = rand() > 0.45 ? 'rgba(110, 165, 72, 0.35)' : 'rgba(54, 92, 42, 0.35)';
      gCtx.fillRect(x, y, w, h);
      gbCtx.fillStyle = rand() > 0.5 ? 'rgba(200,200,200,0.35)' : 'rgba(70,70,70,0.35)';
      gbCtx.fillRect(x, y, w, h);
    }
  } else if (mapId === 'city') {
    gCtx.fillStyle = '#434b56';
    gCtx.fillRect(0, 0, 256, 256);
    gbCtx.fillStyle = '#808080';
    gbCtx.fillRect(0, 0, 256, 256);
    // Asphalt grain + subtle grid seams
    for (let i = 0; i < 1600; i++) {
      const x = rand() * 256;
      const y = rand() * 256;
      const s = 1 + rand() * 3;
      gCtx.fillStyle = rand() > 0.5 ? 'rgba(255,255,255,0.06)' : 'rgba(15,23,42,0.18)';
      gCtx.fillRect(x, y, s, s);
      gbCtx.fillStyle = rand() > 0.5 ? 'rgba(180,180,180,0.28)' : 'rgba(90,90,90,0.28)';
      gbCtx.fillRect(x, y, s, s);
    }
    gCtx.strokeStyle = 'rgba(250, 204, 21, 0.22)';
    gCtx.lineWidth = 3;
    gCtx.strokeRect(2, 2, 252, 252);
  } else {
    gCtx.fillStyle = '#c89b62';
    gCtx.fillRect(0, 0, 256, 256);
    gbCtx.fillStyle = '#808080';
    gbCtx.fillRect(0, 0, 256, 256);
    // Wind-blown sand ripples
    for (let y = 0; y < 256; y += 8) {
      gCtx.fillStyle = y % 16 === 0 ? 'rgba(245, 208, 150, 0.2)' : 'rgba(146, 98, 50, 0.16)';
      gCtx.fillRect(0, y, 256, 4);
      gbCtx.fillStyle = y % 16 === 0 ? '#a8a8a8' : '#646464';
      gbCtx.fillRect(0, y, 256, 4);
    }
    for (let i = 0; i < 800; i++) {
      const x = rand() * 256;
      const y = rand() * 256;
      gCtx.fillStyle = 'rgba(120, 75, 35, 0.25)';
      gCtx.fillRect(x, y, 2, 2);
    }
  }

  const groundMap = new THREE.CanvasTexture(gCanvas);
  groundMap.colorSpace = THREE.SRGBColorSpace;
  groundMap.wrapS = THREE.RepeatWrapping;
  groundMap.wrapT = THREE.RepeatWrapping;
  groundMap.repeat.set(36, 36);
  groundMap.anisotropy = maxAnisotropy;

  const groundBump = new THREE.CanvasTexture(gbCanvas);
  groundBump.wrapS = THREE.RepeatWrapping;
  groundBump.wrapT = THREE.RepeatWrapping;
  groundBump.repeat.set(36, 36);
  groundBump.anisotropy = maxAnisotropy;

  // 2. Wooden Tactical Crate Texture + Bump
  const [cCanvas, cCtx] = makeCanvas(128);
  const [cbCanvas, cbCtx] = makeCanvas(128);
  cCtx.fillStyle = '#b98349';
  cCtx.fillRect(0, 0, 128, 128);
  cbCtx.fillStyle = '#888888';
  cbCtx.fillRect(0, 0, 128, 128);

  // Planks
  for (let i = 0; i < 4; i++) {
    const y = i * 32;
    cCtx.fillStyle = i % 2 === 0 ? 'rgba(255,220,175,0.12)' : 'rgba(90,50,18,0.12)';
    cCtx.fillRect(0, y, 128, 32);
    cCtx.fillStyle = '#5c3818';
    cCtx.fillRect(0, y, 128, 2);
    cbCtx.fillStyle = '#303030';
    cbCtx.fillRect(0, y, 128, 3);
  }
  // Outer frame + diagonal brace
  cCtx.strokeStyle = '#6e441e';
  cCtx.lineWidth = 14;
  cCtx.strokeRect(7, 7, 114, 114);
  cCtx.beginPath();
  cCtx.moveTo(12, 12);
  cCtx.lineTo(116, 116);
  cCtx.stroke();

  cbCtx.strokeStyle = '#d0d0d0';
  cbCtx.lineWidth = 14;
  cbCtx.strokeRect(7, 7, 114, 114);

  const crateMap = new THREE.CanvasTexture(cCanvas);
  crateMap.colorSpace = THREE.SRGBColorSpace;
  crateMap.anisotropy = maxAnisotropy;

  const crateBump = new THREE.CanvasTexture(cbCanvas);
  crateBump.anisotropy = maxAnisotropy;

  // 3. Architectural Concrete / Panel Texture
  const [conCanvas, conCtx] = makeCanvas(128);
  conCtx.fillStyle = '#cbd5e1';
  conCtx.fillRect(0, 0, 128, 128);
  for (let i = 0; i < 450; i++) {
    conCtx.fillStyle = rand() > 0.5 ? 'rgba(255,255,255,0.15)' : 'rgba(30,41,59,0.08)';
    conCtx.fillRect(rand() * 128, rand() * 128, 3, 3);
  }
  conCtx.strokeStyle = 'rgba(51,65,85,0.28)';
  conCtx.lineWidth = 3;
  conCtx.strokeRect(2, 2, 124, 60);
  conCtx.strokeRect(2, 66, 124, 60);

  const concreteMap = new THREE.CanvasTexture(conCanvas);
  concreteMap.colorSpace = THREE.SRGBColorSpace;
  concreteMap.wrapS = THREE.RepeatWrapping;
  concreteMap.wrapT = THREE.RepeatWrapping;
  concreteMap.anisotropy = maxAnisotropy;

  // 4. Radial Contact Shadow Disc
  const [sCanvas, sCtx] = makeCanvas(128);
  const grad = sCtx.createRadialGradient(64, 64, 8, 64, 64, 60);
  grad.addColorStop(0, 'rgba(10, 14, 22, 0.72)');
  grad.addColorStop(0.55, 'rgba(10, 14, 22, 0.32)');
  grad.addColorStop(1, 'rgba(10, 14, 22, 0.0)');
  sCtx.fillStyle = grad;
  sCtx.fillRect(0, 0, 128, 128);
  const contactShadowMap = new THREE.CanvasTexture(sCanvas);
  contactShadowMap.colorSpace = THREE.SRGBColorSpace;

  return {
    groundMap,
    groundBump,
    crateMap,
    crateBump,
    concreteMap,
    contactShadowMap,
    dispose: () => {
      groundMap.dispose();
      groundBump.dispose();
      crateMap.dispose();
      crateBump.dispose();
      concreteMap.dispose();
      contactShadowMap.dispose();
    },
  };
}
