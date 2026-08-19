import * as THREE from 'three';

// Generates a mathematically perfect classic soccer ball (Truncated Icosahedron) texture
// using a spherical Voronoi diagram based on Icosahedron vertices and face centers.
export function createSoccerTextures() {
  const size = 1024;
  
  const mapCanvas = document.createElement('canvas');
  mapCanvas.width = size;
  mapCanvas.height = size;
  const ctx = mapCanvas.getContext('2d')!;
  
  const bumpCanvas = document.createElement('canvas');
  bumpCanvas.width = size;
  bumpCanvas.height = size;
  const btx = bumpCanvas.getContext('2d')!;
  
  const imgData = ctx.createImageData(size, size);
  const bumpData = btx.createImageData(size, size);

  // 1. Generate the 12 vertices of an Icosahedron
  const t = (1.0 + Math.sqrt(5.0)) / 2.0;
  const icosahedronVertices = [
    new THREE.Vector3(-1,  t,  0).normalize(),
    new THREE.Vector3( 1,  t,  0).normalize(),
    new THREE.Vector3(-1, -t,  0).normalize(),
    new THREE.Vector3( 1, -t,  0).normalize(),
    new THREE.Vector3( 0, -1,  t).normalize(),
    new THREE.Vector3( 0,  1,  t).normalize(),
    new THREE.Vector3( 0, -1, -t).normalize(),
    new THREE.Vector3( 0,  1, -t).normalize(),
    new THREE.Vector3( t,  0, -1).normalize(),
    new THREE.Vector3( t,  0,  1).normalize(),
    new THREE.Vector3(-t,  0, -1).normalize(),
    new THREE.Vector3(-t,  0,  1).normalize(),
  ];

  // 2. Generate the 20 face centers
  // An icosahedron has 20 triangular faces. We can just generate them by iterating through
  // all triplets of vertices and checking if their distance is exactly the edge length.
  // Edge length for our normalized vertices is approx 1.05146.
  const faceCenters: THREE.Vector3[] = [];
  // Not all are adjacent, but 0 and 1 are 2.0 apart... wait.
  // Actually, vertices 0 is adjacent to 1, 5, 7, 10, 11.
  // Let's use standard Three.js IcosahedronGeometry to get the face centers!
  const icoGeo = new THREE.IcosahedronGeometry(1, 0);
  const pos = icoGeo.attributes.position;
  for (let i = 0; i < pos.count; i += 3) {
    const vA = new THREE.Vector3(pos.getX(i), pos.getY(i), pos.getZ(i));
    const vB = new THREE.Vector3(pos.getX(i+1), pos.getY(i+1), pos.getZ(i+1));
    const vC = new THREE.Vector3(pos.getX(i+2), pos.getY(i+2), pos.getZ(i+2));
    const center = vA.add(vB).add(vC).divideScalar(3).normalize();
    faceCenters.push(center);
  }

  // Pentagons = icosahedron vertices. Hexagons = icosahedron face centers.
  const pentagons = icosahedronVertices;
  const hexagons = faceCenters;
  const allPoints = [...pentagons, ...hexagons];

  // 3. Evaluate every pixel
  // To avoid heavy math for 1M pixels, we can do some optimization, but modern JS handles 1M loops easily.
  for (let y = 0; y < size; y++) {
    const v = y / size;
    const lat = Math.PI * (0.5 - v); // from PI/2 to -PI/2
    const cosLat = Math.cos(lat);
    const sinLat = Math.sin(lat);

    for (let x = 0; x < size; x++) {
      const u = x / size;
      const lon = 2 * Math.PI * (u - 0.5); // from -PI to PI
      
      const px = cosLat * Math.cos(lon);
      const py = sinLat;
      const pz = cosLat * Math.sin(lon);
      
      let closestIdx = -1;
      
      // Calculate distances using dot product (acos gives precise spherical distance but dot product is faster)
      // distance is inversely proportional to dot product. Higher dot product = closer.
      let maxDot1 = -Infinity;
      let maxDot2 = -Infinity;
      
      for (let i = 0; i < allPoints.length; i++) {
        const pt = allPoints[i];
        const dot = px * pt.x + py * pt.y + pz * pt.z;
        if (dot > maxDot1) {
          maxDot2 = maxDot1;
          maxDot1 = dot;
          closestIdx = i;
        } else if (dot > maxDot2) {
          maxDot2 = dot;
        }
      }

      const isPentagon = closestIdx < pentagons.length;
      
      // Calculate seam: if maxDot1 and maxDot2 are very close, we are near a boundary
      const seamThreshold = 0.005; // Adjust for seam thickness
      const diff = maxDot1 - maxDot2;
      const isSeam = diff < seamThreshold;

      // Base color
      let r = 250, g = 250, b = 250; // Hexagon (White)
      if (isPentagon) {
        r = 20; g = 20; b = 25; // Pentagon (Black/Dark Slate)
      }
      
      // Add leather noise
      const noise = (Math.random() - 0.5) * 15;
      r += noise; g += noise; b += noise;
      
      // Bump map logic
      let bumpVal = isPentagon ? 200 : 255;
      
      if (isSeam) {
        // Deep groove
        r = 10; g = 10; b = 10;
        bumpVal = 0; // Extremely deep
      } else {
        // Add dimples to the bump map (not the color map)
        const dimpleFreq = 400; // High frequency
        const dimple = Math.sin(u * dimpleFreq) * Math.cos(v * dimpleFreq * 0.5) * 20;
        bumpVal = Math.max(0, Math.min(255, bumpVal - Math.abs(dimple)));
      }

      const pixelIdx = (y * size + x) * 4;
      imgData.data[pixelIdx] = r;
      imgData.data[pixelIdx+1] = g;
      imgData.data[pixelIdx+2] = b;
      imgData.data[pixelIdx+3] = 255;
      
      bumpData.data[pixelIdx] = bumpVal;
      bumpData.data[pixelIdx+1] = bumpVal;
      bumpData.data[pixelIdx+2] = bumpVal;
      bumpData.data[pixelIdx+3] = 255;
    }
  }

  ctx.putImageData(imgData, 0, 0);
  btx.putImageData(bumpData, 0, 0);

  // Soften the bump map
  btx.filter = 'blur(1px)';
  btx.drawImage(bumpCanvas, 0, 0);

  const map = new THREE.CanvasTexture(mapCanvas);
  const bumpMap = new THREE.CanvasTexture(bumpCanvas);
  
  map.wrapS = THREE.RepeatWrapping;
  map.wrapT = THREE.RepeatWrapping;
  bumpMap.wrapS = THREE.RepeatWrapping;
  bumpMap.wrapT = THREE.RepeatWrapping;
  
  return { map, bumpMap };
}

// ... keeping Basketball and Tennis unchanged
export function createBasketballTextures() {
  const size = 1024;
  const mapCanvas = document.createElement('canvas');
  mapCanvas.width = size; mapCanvas.height = size;
  const ctx = mapCanvas.getContext('2d')!;
  
  const bumpCanvas = document.createElement('canvas');
  bumpCanvas.width = size; bumpCanvas.height = size;
  const btx = bumpCanvas.getContext('2d')!;
  
  ctx.fillStyle = '#c2410c'; ctx.fillRect(0, 0, size, size);
  btx.fillStyle = '#ffffff'; btx.fillRect(0, 0, size, size);
  
  const imgData = ctx.getImageData(0, 0, size, size);
  const bumpData = btx.getImageData(0, 0, size, size);
  
  for (let i = 0; i < imgData.data.length; i += 4) {
    const noise = (Math.random() - 0.5) * 40;
    imgData.data[i] = Math.max(0, Math.min(255, imgData.data[i] + noise));
    imgData.data[i+1] = Math.max(0, Math.min(255, imgData.data[i+1] + noise));
    imgData.data[i+2] = Math.max(0, Math.min(255, imgData.data[i+2] + noise));
    
    const bumpVal = 200 + (Math.random() * 55);
    bumpData.data[i] = bumpVal; bumpData.data[i+1] = bumpVal; bumpData.data[i+2] = bumpVal;
  }
  ctx.putImageData(imgData, 0, 0);
  btx.putImageData(bumpData, 0, 0);
  
  const drawLines = (context: CanvasRenderingContext2D, color: string, width: number) => {
    context.lineWidth = width; context.strokeStyle = color; context.lineCap = 'round';
    context.beginPath(); context.moveTo(0, size/2); context.lineTo(size, size/2); context.stroke();
    context.beginPath(); context.moveTo(size/2, 0); context.lineTo(size/2, size); context.stroke();
    context.beginPath(); context.arc(0, size/2, size * 0.35, -Math.PI/2, Math.PI/2); context.stroke();
    context.beginPath(); context.arc(size, size/2, size * 0.35, Math.PI/2, Math.PI*1.5); context.stroke();
  };

  drawLines(ctx, '#1c1917', 12); drawLines(btx, '#000000', 16);
  btx.filter = 'blur(2px)'; btx.drawImage(bumpCanvas, 0, 0);

  const map = new THREE.CanvasTexture(mapCanvas);
  const bumpMap = new THREE.CanvasTexture(bumpCanvas);
  map.wrapS = THREE.RepeatWrapping; map.wrapT = THREE.RepeatWrapping;
  bumpMap.wrapS = THREE.RepeatWrapping; bumpMap.wrapT = THREE.RepeatWrapping;
  return { map, bumpMap };
}

export function createTennisTextures() {
  const size = 1024;
  const mapCanvas = document.createElement('canvas');
  mapCanvas.width = size; mapCanvas.height = size;
  const ctx = mapCanvas.getContext('2d')!;
  
  const bumpCanvas = document.createElement('canvas');
  bumpCanvas.width = size; bumpCanvas.height = size;
  const btx = bumpCanvas.getContext('2d')!;
  
  ctx.fillStyle = '#84cc16'; ctx.fillRect(0, 0, size, size);
  btx.fillStyle = '#ffffff'; btx.fillRect(0, 0, size, size);
  
  const imgData = ctx.getImageData(0, 0, size, size);
  const bumpData = btx.getImageData(0, 0, size, size);
  
  for (let i = 0; i < imgData.data.length; i += 4) {
    const noise = (Math.random() - 0.5) * 30;
    imgData.data[i] = Math.max(0, Math.min(255, imgData.data[i] + noise));
    imgData.data[i+1] = Math.max(0, Math.min(255, imgData.data[i+1] + noise));
    imgData.data[i+2] = Math.max(0, Math.min(255, imgData.data[i+2] + noise));
    
    const bumpVal = 180 + (Math.random() * 75);
    bumpData.data[i] = bumpVal; bumpData.data[i+1] = bumpVal; bumpData.data[i+2] = bumpVal;
  }
  ctx.putImageData(imgData, 0, 0);
  btx.putImageData(bumpData, 0, 0);
  
  const drawSeams = (context: CanvasRenderingContext2D, color: string, width: number) => {
    context.lineWidth = width; context.strokeStyle = color;
    context.beginPath(); context.arc(0, size/2, size * 0.4, -Math.PI/2, Math.PI/2); context.stroke();
    context.beginPath(); context.arc(size, size/2, size * 0.4, Math.PI/2, Math.PI*1.5); context.stroke();
  };

  drawSeams(ctx, '#f8fafc', 24); drawSeams(btx, '#000000', 30);
  btx.filter = 'blur(3px)'; btx.drawImage(bumpCanvas, 0, 0);

  const map = new THREE.CanvasTexture(mapCanvas);
  const bumpMap = new THREE.CanvasTexture(bumpCanvas);
  return { map, bumpMap };
}
