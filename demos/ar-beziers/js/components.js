/**
 * Hitbox System for A-Frame (Vanilla JS Port)
 * Ported from Chowa project (Svelte/TS)
 */

// ==========================================
// 1. GEOMETRY UTILITIES
// ==========================================

const GeometryUtils = {
  /**
   * Sort points clockwise around a center
   */
  sortPointsClockwise: function (points, centerX, centerY) {
    return [...points].sort((a, b) => {
      const angleA = Math.atan2(a.y - centerY, a.x - centerX);
      const angleB = Math.atan2(b.y - centerY, b.x - centerX);
      return angleA - angleB;
    });
  },

  /**
   * Simplify polygon using Douglas-Peucker algorithm
   */
  simplifyPolygon: function (points, tolerance) {
    if (points.length <= 2) return points;

    function perpendicularDistance(point, lineStart, lineEnd) {
      const dx = lineEnd.x - lineStart.x;
      const dy = lineEnd.y - lineStart.y;

      if (dx === 0 && dy === 0) {
        return Math.sqrt(Math.pow(point.x - lineStart.x, 2) + Math.pow(point.y - lineStart.y, 2));
      }

      const t = ((point.x - lineStart.x) * dx + (point.y - lineStart.y) * dy) / (dx * dx + dy * dy);

      if (t < 0) {
        return Math.sqrt(Math.pow(point.x - lineStart.x, 2) + Math.pow(point.y - lineStart.y, 2));
      }
      if (t > 1) {
        return Math.sqrt(Math.pow(point.x - lineEnd.x, 2) + Math.pow(point.y - lineEnd.y, 2));
      }

      const projX = lineStart.x + t * dx;
      const projY = lineStart.y + t * dy;

      return Math.sqrt(Math.pow(point.x - projX, 2) + Math.pow(point.y - projY, 2));
    }

    function douglasPeucker(pts, startIndex, endIndex, tol) {
      if (endIndex <= startIndex + 1) {
        return [pts[startIndex]];
      }

      let maxDistance = 0;
      let maxIndex = 0;

      for (let i = startIndex + 1; i < endIndex; i++) {
        const distance = perpendicularDistance(pts[i], pts[startIndex], pts[endIndex]);
        if (distance > maxDistance) {
          maxDistance = distance;
          maxIndex = i;
        }
      }

      let result = [];
      if (maxDistance > tol) {
        const left = douglasPeucker(pts, startIndex, maxIndex, tol);
        const right = douglasPeucker(pts, maxIndex, endIndex, tol);
        result = [...left, ...right];
      } else {
        result = [pts[startIndex], pts[endIndex]];
      }

      return result;
    }

    const result = douglasPeucker(points, 0, points.length - 1, tolerance);

    // Ensure loop closure
    const lastResult = result[result.length - 1];
    const lastPoint = points[points.length - 1];
    if (lastResult && lastPoint && (lastResult.x !== lastPoint.x || lastResult.y !== lastPoint.y)) {
      result.push(lastPoint);
    }

    return result;
  }
};

// ==========================================
// 2. HITBOX MANAGER
// ==========================================

const CONTOUR_CONFIG = {
  ALPHA_THRESHOLD: 20,
  NUM_RAYS: 64,
  STEP: 4,
  SIMPLIFY_TOLERANCE: 2
};

class HitboxManager {
  constructor() {
    this.hitboxes = [];
    this.screenPointsCache = [];
    this.tempVector3 = new THREE.Vector3();
  }

  detectContour(imageData) {
    const width = imageData.width;
    const height = imageData.height;
    const data = imageData.data;
    const outlinePoints = [];

    // Find center (approx)
    let centerX = Math.floor(width / 2);
    let centerY = Math.floor(height / 2);
    let found = false;
    const radius = Math.min(width, height) / 4;

    // Search for non-transparent pixel near center
    for (let r = 0; r < radius && !found; r++) {
      for (let angle = 0; angle < Math.PI * 2 && !found; angle += Math.PI / 8) {
        const testX = Math.floor(centerX + r * Math.cos(angle));
        const testY = Math.floor(centerY + r * Math.sin(angle));

        if (testX >= 0 && testX < width && testY >= 0 && testY < height) {
          const idx = (testY * width + testX) * 4;
          if (data[idx + 3] > CONTOUR_CONFIG.ALPHA_THRESHOLD) {
            centerX = testX;
            centerY = testY;
            found = true;
          }
        }
      }
    }

    if (!found) return this.findBoundingBox(data, width, height);

    // Raycasting for contour
    for (let i = 0; i < CONTOUR_CONFIG.NUM_RAYS; i++) {
      const angle = (i / CONTOUR_CONFIG.NUM_RAYS) * Math.PI * 2;
      const dirX = Math.cos(angle);
      const dirY = Math.sin(angle);
      let lastOpaque = false;

      for (let dist = 0; dist < Math.max(width, height); dist++) {
        const x = Math.floor(centerX + dirX * dist);
        const y = Math.floor(centerY + dirY * dist);

        if (x < 0 || x >= width || y < 0 || y >= height) break;

        const idx = (y * width + x) * 4;
        const isOpaque = data[idx + 3] > CONTOUR_CONFIG.ALPHA_THRESHOLD;

        if (lastOpaque && !isOpaque) {
          outlinePoints.push({ x, y });
          break;
        }
        lastOpaque = isOpaque;
      }
    }

    if (outlinePoints.length < 6) return this.findBoundingBox(data, width, height);

    const sortedPoints = GeometryUtils.sortPointsClockwise(outlinePoints, centerX, centerY);
    return GeometryUtils.simplifyPolygon(sortedPoints, CONTOUR_CONFIG.SIMPLIFY_TOLERANCE);
  }

  findBoundingBox(data, width, height) {
    // Simple fallback
    return [
      { x: 0, y: 0 },
      { x: width, y: 0 },
      { x: width, y: height },
      { x: 0, y: height }
    ];
  }

  convertToScreenCoordinates(el, contourPoints, imgWidth, imgHeight) {
    if (!this.tempVector3) return [];
    this.screenPointsCache = [];

    const object3D = el.object3D;

    // Find the active camera
    let camera = null;
    const scene = document.querySelector('a-scene');
    if (scene && scene.camera) {
      camera = scene.camera;
    } else {
      const cameraEl = document.querySelector('a-camera, [camera]');
      if (cameraEl) {
        camera = cameraEl.getObject3D('camera');
      }
    }

    if (!camera) {
      if (this.debug && Math.random() < 0.01) console.warn('[HitboxSystem] No active camera found!');
      return [];
    }

    // Assuming plane geometry ratio matches image ratio
    // We project 0..imgWidth to -0.5..0.5 in local space

    for (const point of contourPoints) {
      // Normalize to -0.5 to 0.5 range (A-Frame plane default center)
      const normalizedX = (point.x / imgWidth) - 0.5;
      const normalizedY = 0.5 - (point.y / imgHeight); // Flip Y for 3D

      this.tempVector3.set(normalizedX, normalizedY, 0);
      this.tempVector3.applyMatrix4(object3D.matrixWorld);
      this.tempVector3.project(camera);

      const screenX = (this.tempVector3.x + 1) * window.innerWidth / 2;
      const screenY = -(this.tempVector3.y - 1) * window.innerHeight / 2;

      this.screenPointsCache.push({ x: screenX, y: screenY });
    }

    return this.screenPointsCache;
  }
}

// ==========================================
// 3. A-FRAME SYSTEM & COMPONENT
// ==========================================

AFRAME.registerSystem('hitbox-system', {
  init: function () {
    this.manager = new HitboxManager();
    this.targets = [];

    // Setup Canvas
    this.canvas = document.createElement('canvas');
    this.canvas.id = 'hitbox-canvas';
    this.canvas.style.position = 'absolute';
    this.canvas.style.top = '0';
    this.canvas.style.left = '0';
    this.canvas.style.pointerEvents = 'none'; // Let clicks pass through to be handled by JS
    this.canvas.style.zIndex = '9999';
    document.body.appendChild(this.canvas);
    this.ctx = this.canvas.getContext('2d');

    // Handle Resize
    window.addEventListener('resize', () => this.onResize());
    this.onResize();

    // Handle Click
    window.addEventListener('click', (e) => this.onClick(e));

    // Debug Mode - false pour cacher les bords verts
    this.debug = false;
  },

  registerTarget: function (el, options = {}) {
    this.targets.push(el);
    el.hitboxOptions = options; // Stocker les options sur l'Ã©lÃ©ment

    // Si on utilise un rectangle, pas besoin de dÃ©tecter le contour des pixels
    if (options.useRectangle) {
      console.log(`[HitboxSystem] Using rectangle hitbox for ${el.id}`);
      // GÃ©nÃ©rer un contour rectangulaire simple basÃ© sur la gÃ©omÃ©trie
      this.generateRectangleContour(el);
    } else {
      // Generate contour when image loads (mode pixel-perfect original)
      el.addEventListener('materialtextureloaded', () => {
        this.generateContour(el);
      });
      // Try immediately in case already loaded
      if (el.getObject3D('mesh')?.material?.map?.image) {
        this.generateContour(el);
      }
    }
  },

  generateRectangleContour: function (el) {
    // Pour un a-image, la taille par dÃ©faut est 1x1 en espace local
    // On rÃ©cupÃ¨re width/height si dÃ©finis, sinon on prend 1
    const width = parseFloat(el.getAttribute('width')) || 1;
    const height = parseFloat(el.getAttribute('height')) || 1;

    // CrÃ©er un contour rectangulaire simple (coins du rectangle)
    el.hitboxContour = [
      { x: 0, y: 0 },
      { x: width, y: 0 },
      { x: width, y: height },
      { x: 0, y: height }
    ];
    el.hitboxImgSize = { width: width, height: height };
    el.hitboxIsRectangle = true;
    console.log(`[HitboxSystem] Rectangle hitbox generated for ${el.id}: ${width}x${height}`);
  },

  unregisterTarget: function (el) {
    const index = this.targets.indexOf(el);
    if (index > -1) this.targets.splice(index, 1);
  },

  generateContour: function (el) {
    const mesh = el.getObject3D('mesh');
    if (!mesh || !mesh.material || !mesh.material.map || !mesh.material.map.image) {
      console.warn(`[HitboxSystem] No mesh/image found for ${el.id}`);
      return;
    }

    const img = mesh.material.map.image;
    console.log(`[HitboxSystem] Generating contour for ${el.id} (Image: ${img.src})`);

    // Create temp canvas to get pixel data
    const tempCanvas = document.createElement('canvas');
    tempCanvas.width = img.width;
    tempCanvas.height = img.height;
    const tempCtx = tempCanvas.getContext('2d');

    // Ensure CORS if possible
    if (img.crossOrigin !== 'Anonymous') {
      // If the image is already loaded without CORS, we might be stuck.
      // But for local server, it should be fine if served from same origin.
    }

    try {
      tempCtx.drawImage(img, 0, 0);
      const imageData = tempCtx.getImageData(0, 0, img.width, img.height);
      const contour = this.manager.detectContour(imageData);

      if (contour.length > 0) {
        el.hitboxContour = contour;
        el.hitboxImgSize = { width: img.width, height: img.height };
        console.log(`[HitboxSystem] Success! Generated ${contour.length} points for ${el.id}`);
      } else {
        console.warn(`[HitboxSystem] No contour detected for ${el.id} (all transparent?)`);
      }
    } catch (e) {
      console.error(`[HitboxSystem] Error generating contour for ${el.id}. Possible CORS issue?`, e);
    }
  },

  onResize: function () {
    this.canvas.width = window.innerWidth;
    this.canvas.height = window.innerHeight;
  },

  onClick: function (e) {
    const x = e.clientX;
    const y = e.clientY;

    // Check all targets
    // Sort by distance to camera (simple z-sort not perfect but okay for now)
    // Actually, we should check all and find the closest one if overlapping.
    // For now, let's just check in order.

    for (const el of this.targets) {
      if (!el.object3D.visible || !el.hitboxPath) continue;

      if (this.ctx.isPointInPath(el.hitboxPath, x, y)) {
        console.log('Hitbox clicked:', el.id);

        // Visual Feedback
        if (this.debug) {
          this.ctx.save();
          this.ctx.strokeStyle = '#00FF00';
          this.ctx.lineWidth = 3;
          this.ctx.stroke(el.hitboxPath);
          this.ctx.restore();
          setTimeout(() => {
            // Clear specific feedback? Hard on canvas. Just let next tick clear it.
          }, 200);
        }

        // Emit click event on the element so other components (like dismiss-on-click) react
        el.emit('click', { clientX: x, clientY: y, detail: { intersectedEl: el } });
        return; // Stop after first hit
      }
    }
  },

  tick: function () {
    if (!this.ctx) return;
    this.ctx.clearRect(0, 0, this.canvas.width, this.canvas.height);

    let drawnCount = 0;

    this.targets.forEach(el => {
      if (!el.object3D.visible) return;

      // VÃ©rifier l'opacitÃ© minimale (pour les Ã©lÃ©ments qui apparaissent avec une animation de fade)
      const minOpacity = el.hitboxOptions?.minOpacity ?? 0.1;
      const material = el.getObject3D('mesh')?.material;
      if (material && material.opacity < minOpacity) {
        el.hitboxPath = null; // Reset le path pour Ã©viter les clics sur un Ã©lÃ©ment invisible
        return;
      }

      if (!el.hitboxContour) {
        // Pour les rectangles, on peut rÃ©gÃ©nÃ©rer le contour si manquant
        if (el.hitboxOptions?.useRectangle) {
          this.generateRectangleContour(el);
        } else {
          // Try generating again if missing (maybe image loaded late)
          if (el.getObject3D('mesh')?.material?.map?.image?.complete) {
            // Debounce or check flag to avoid spam
            if (!el.hasTriedGen) {
              el.hasTriedGen = true;
              this.generateContour(el);
            }
          }
        }
        return;
      }

      // Project contour to screen
      const screenPoints = this.manager.convertToScreenCoordinates(
        el,
        el.hitboxContour,
        el.hitboxImgSize.width,
        el.hitboxImgSize.height
      );

      if (screenPoints.length < 3) return;

      // Create Path2D
      const path = new Path2D();
      path.moveTo(screenPoints[0].x, screenPoints[0].y);
      for (let i = 1; i < screenPoints.length; i++) {
        path.lineTo(screenPoints[i].x, screenPoints[i].y);
      }
      path.closePath();

      el.hitboxPath = path;
      drawnCount++;

      // Draw Debug Outline
      if (this.debug) {
        // Couleur diffÃ©rente pour les hitbox rectangulaires
        this.ctx.strokeStyle = el.hitboxIsRectangle ? 'rgba(0, 255, 0, 0.7)' : 'rgba(255, 0, 0, 0.5)';
        this.ctx.lineWidth = 2;
        this.ctx.stroke(path);
      }
    });

    // Occasional log
    if (this.debug && Math.random() < 0.01 && drawnCount > 0) {
      console.log(`[HitboxSystem] Drawing ${drawnCount} hitboxes`);
    }
  }
});

AFRAME.registerComponent('hitbox-target', {
  schema: {
    useRectangle: { type: 'boolean', default: false }, // Utiliser un rectangle simple au lieu du contour pixel-perfect
    minOpacity: { type: 'number', default: 0.1 } // OpacitÃ© minimale pour que la hitbox soit active
  },
  init: function () {
    this.system = this.el.sceneEl.systems['hitbox-system'];
    this.system.registerTarget(this.el, this.data);
  },
  remove: function () {
    this.system.unregisterTarget(this.el);
  }
});
// Custom A-Frame Components

// Fonction utilitaire pour dÃ©sactiver une hitbox
function disableHitbox(element) {
  if (element && element.hasAttribute('hitbox-target')) {
    element.removeAttribute('hitbox-target');
    element.classList.remove('clickable');
    console.log('ðŸš« Hitbox dÃ©sactivÃ©e:', element.id || 'element');
  }
}

// Fonction pour dÃ©sactiver toutes les hitbox d'un conteneur
function disableAllHitboxes(container) {
  if (!container) return;
  const hitboxElements = container.querySelectorAll('[hitbox-target]');
  hitboxElements.forEach(el => disableHitbox(el));
}
// Abstract Shape Component: Generates a procedural 3D shape
AFRAME.registerComponent('abstract-shape', {
  init: function () {
    const el = this.el;

    // Create a stretched triangle (Cone with 3 radial segments)
    const triangle = document.createElement('a-cone');
    triangle.setAttribute('radius-bottom', 1);
    triangle.setAttribute('radius-top', 0);
    triangle.setAttribute('height', 2);
    triangle.setAttribute('segments-radial', 3); // Makes it a triangular pyramid/tetrahedron look
    triangle.setAttribute('color', '#FF6B00');
    triangle.setAttribute('material', 'opacity: 0.6; metalness: 0.2; roughness: 0.8; wireframe: true'); // Wireframe or solid? Let's go solid with opacity

    // Stretch it
    triangle.setAttribute('scale', '1 3 0.2'); // Stretched vertically and flattened

    // Animation
    triangle.setAttribute('animation', {
      property: 'rotation',
      to: '360 360 0',
      loop: true,
      dur: 15000,
      easing: 'linear'
    });

    el.appendChild(triangle);
  }
});

// Rocket Sequence Component: Handles the intro animation
AFRAME.registerComponent('rocket-sequence', {
  init: function () {
    this.rocket = document.querySelector('#rocket-entity');
    this.mainContent = document.querySelector('#main-content');
    this.smokeGroup = document.querySelector('#smoke-group');

    this.isHovering = false;
    this.isCentering = false;
    this.isLaunching = false;
    this.hasLaunched = false; // Nouveau: empÃªche de relancer
    this.startTime = 0;

    // Initial state
    if (this.mainContent) this.mainContent.setAttribute('visible', false);
    if (this.rocket) this.rocket.setAttribute('visible', false);
    if (this.smokeGroup) this.smokeGroup.setAttribute('visible', false);

    const target = document.querySelector('[mindar-image-target]');

    target.addEventListener('targetFound', () => {
      // Si dÃ©jÃ  lancÃ©, ne rien faire - juste s'assurer que le contenu est visible
      if (this.hasLaunched) {
        console.log('ðŸš€ DÃ©jÃ  lancÃ©, on garde le contenu visible');
        return;
      }

      if (!this.rocket) return;

      // 1. Show Rocket & Smoke
      this.rocket.setAttribute('visible', true);
      if (this.smokeGroup) this.smokeGroup.setAttribute('visible', true);

      // 2. Start "Hover" (Dynamic Flight)
      this.isHovering = true;
      this.isCentering = false;
      this.isLaunching = false;
      this.startTime = Date.now();

      // 3. Move to Center after 4 seconds
      setTimeout(() => {
        if (this.hasLaunched) return; // Protection supplÃ©mentaire

        this.isHovering = false;
        this.isCentering = true;

        // Animate to center manually or via A-Frame animation
        this.rocket.setAttribute('animation__center', {
          property: 'position',
          to: '0 0 0.1',
          dur: 500,
          easing: 'easeInOutQuad'
        });
        this.rocket.setAttribute('animation__rotate_center', {
          property: 'rotation',
          to: '0 0 0',
          dur: 500,
          easing: 'easeInOutQuad'
        });

        // 4. Launch after centering (4.5s)
        setTimeout(() => {
          if (this.hasLaunched) return; // Protection supplÃ©mentaire

          this.isCentering = false;
          this.isLaunching = true;
          this.hasLaunched = true; // Marquer comme lancÃ©!
          this.rocket.emit('launch'); // Trigger the A-Frame animation for Y-axis launch

          // Hide smoke shortly after launch
          setTimeout(() => {
            if (this.smokeGroup) this.smokeGroup.setAttribute('visible', false);
          }, 1000);

          // 5. Reveal Main Content as rocket leaves
          setTimeout(() => {
            if (this.mainContent) {
              this.mainContent.setAttribute('visible', true);
              this.mainContent.emit('startReveal');

              // Propagate event to all children to trigger their animations
              const children = this.mainContent.querySelectorAll('*');
              children.forEach(child => child.emit('startReveal'));
            }
          }, 300);

        }, 500); // Wait for centering animation

      }, 4000); // 4 seconds duration
    });

    target.addEventListener('targetLost', () => {
      this.isHovering = false;
      this.isCentering = false;
      this.isLaunching = false;

      if (this.rocket) {
        this.rocket.setAttribute('visible', false);
        this.rocket.removeAttribute('animation__center');
        this.rocket.removeAttribute('animation__rotate_center');
        this.rocket.setAttribute('position', '0 0 0.1'); // Reset position
        this.rocket.setAttribute('rotation', '0 0 0'); // Reset rotation
      }
      if (this.mainContent) this.mainContent.setAttribute('visible', false);
      if (this.smokeGroup) this.smokeGroup.setAttribute('visible', false);
    });
  },

  tick: function (time, timeDelta) {
    if (this.isHovering && this.rocket && !this.isCentering) {
      // Dynamic Flight Path (Faster)

      const t = time * 0.003; // Faster speed

      // Lissajous-like curve
      const x = Math.sin(t) * 0.4;
      const y = Math.sin(t * 1.3) * 0.3;
      const z = 0.1 + Math.cos(t * 0.9) * 0.15;

      this.rocket.setAttribute('position', `${x} ${y} ${z}`);

      // Banking (Rotation)
      const dx = Math.cos(t);
      const dy = Math.cos(t * 1.3) * 1.3;

      const bankZ = -dx * 25; // Stronger banking
      const bankX = -dy * 10;

      this.rocket.setAttribute('rotation', `${bankX} 0 ${bankZ}`);
    }
  }
});

// Text Animation Component: Animate text on target found
AFRAME.registerComponent('animate-on-target', {
  init: function () {
    const el = this.el;
    el.setAttribute('visible', false);

    const target = document.querySelector('[mindar-image-target]');

    target.addEventListener('targetFound', () => {
      el.setAttribute('visible', true);
      el.emit('startAnimation');
    });

    target.addEventListener('targetLost', () => {
      el.setAttribute('visible', false);
    });
  }
});

// Interactive Icon Component: Handle clicks to reveal stats
AFRAME.registerComponent('interactive-icon', {
  init: function () {
    const el = this.el;
    const statText = document.querySelector('#stat-text');

    // Pulse animation on hover/click
    el.addEventListener('click', (evt) => {
      console.log('Icon clicked (via ' + (evt.target.tagName) + ')!', evt);
      // Trigger pulse
      el.emit('pulse');
      // Trigger rotation
      el.emit('rotate');

      // Toggle stat text visibility
      const isVisible = statText.getAttribute('visible');
      statText.setAttribute('visible', !isVisible);

      if (!isVisible) {
        statText.emit('showStat');
      }
    });

    // Add cursor feedback (optional if we had a cursor, but good for logic)
    el.addEventListener('mouseenter', () => {
      el.setAttribute('scale', '0.65 0.65 0.65');
    });

    el.addEventListener('mouseleave', () => {
      el.setAttribute('scale', '0.6 0.6 0.6');
    });
  }
});

// Generic Click Feedback Component: Simple pulse animation on click
AFRAME.registerComponent('click-feedback', {
  init: function () {
    const el = this.el;

    el.addEventListener('click', () => {
      // Avoid conflict if the element has its own click handler doing scale animations (like the icon)
      if (el.hasAttribute('interactive-icon')) {
        return;
      }

      // Get current scale to return to
      const currentScale = el.getAttribute('scale') || { x: 1, y: 1, z: 1 };
      const targetScale = {
        x: currentScale.x * 1.2,
        y: currentScale.y * 1.2,
        z: currentScale.z * 1.2
      };

      // Manually animate
      el.setAttribute('animation__click', {
        property: 'scale',
        to: `${targetScale.x} ${targetScale.y} ${targetScale.z}`,
        dur: 150,
        easing: 'easeOutQuad',
        dir: 'alternate',
        loop: 2
      });
    });

    // Hover effect
    el.addEventListener('mouseenter', () => {
      el.emit('hover-start');
    });
  }
});

// Falling Caps Component: Spawns falling graduation caps on reveal
AFRAME.registerComponent('falling-caps', {
  schema: {
    count: { type: 'int', default: 20 },
    model: { type: 'string', default: '#cap-model' }
  },
  init: function () {
    this.el.addEventListener('startReveal', () => {
      this.spawnCaps();
    });
  },
  spawnCaps: function () {
    for (let i = 0; i < this.data.count; i++) {
      const el = document.createElement('a-entity');

      // Use the model
      el.setAttribute('gltf-model', this.data.model);

      // Random Position (Relative to parent)
      // X: -3 to 3, Y: 4 to 8 (start high), Z: -1 to 2
      const x = (Math.random() - 0.5) * 6;
      const y = 4 + Math.random() * 4;
      const z = (Math.random() - 0.5) * 3;
      el.setAttribute('position', `${x} ${y} ${z}`);

      // Random Rotation
      el.setAttribute('rotation', `${Math.random() * 360} ${Math.random() * 360} ${Math.random() * 360}`);

      // Scale (Adjustable, starting safe)
      el.setAttribute('scale', '0.2 0.2 0.2');

      // Animation: Fall
      const duration = 2500 + Math.random() * 2000;
      el.setAttribute('animation__fall', {
        property: 'position',
        to: `${x} -5 ${z}`,
        dur: duration,
        easing: 'easeInQuad'
      });

      // Animation: Spin
      el.setAttribute('animation__spin', {
        property: 'rotation',
        to: `${Math.random() * 720} ${Math.random() * 720} ${Math.random() * 720}`,
        dur: duration,
        easing: 'linear'
      });

      this.el.appendChild(el);

      // Cleanup
      setTimeout(() => {
        if (el.parentNode) el.parentNode.removeChild(el);
      }, duration + 100);
    }
  }
});

// Dismiss Component: Hides everything with animation on click
AFRAME.registerComponent('dismiss-on-click', {
  init: function () {
    console.log('Dismiss component initialized on:', this.el);

    // Simple visual feedback (cursor only)
    this.el.classList.add('clickable');

    this.el.addEventListener('click', (evt) => {
      console.log('Dismiss button clicked!');
      const mainContent = document.querySelector('#main-content');

      // DÃ©sactiver les hitbox de la scÃ¨ne 1
      disableAllHitboxes(mainContent);
      disableHitbox(this.el);

      if (mainContent) {
        // 1. Animate the Container (Spin + Scale Down)
        mainContent.setAttribute('animation__dismiss_scale', {
          property: 'scale',
          to: '0 0 0',
          dur: 1000,
          easing: 'easeInBack'
        });

        mainContent.setAttribute('animation__dismiss_rotate', {
          property: 'rotation',
          to: '0 360 0',
          dur: 1000,
          easing: 'easeInCubic'
        });

        // 2. Staggered Fade Out for Children
        const children = mainContent.querySelectorAll('a-image');
        children.forEach((child, index) => {
          // Stagger based on index
          const delay = index * 100;

          child.setAttribute('animation__dismiss_fade', {
            property: 'opacity',
            to: '0',
            dur: 600,
            delay: delay,
            easing: 'easeInQuad'
          });

          // Optional: Fly upwards
          const currentPos = child.getAttribute('position');
          child.setAttribute('animation__dismiss_fly', {
            property: 'position',
            to: `${currentPos.x} ${currentPos.y + 2} ${currentPos.z}`,
            dur: 800,
            delay: delay,
            easing: 'easeInQuad'
          });
        });

        // 3. Hide after animation and trigger Scene 2
        setTimeout(() => {
          mainContent.setAttribute('visible', false);
          // Reset for next time (optional)
          mainContent.removeAttribute('animation__dismiss_scale');
          mainContent.removeAttribute('animation__dismiss_rotate');

          // Trigger Scene 2
          const scene2 = document.querySelector('#scene2-content');
          if (scene2) {
            scene2.setAttribute('visible', true);
            scene2.emit('startScene2');
          }
        }, 1200);
      }
    });
  }
});

// Presentation Manager: Handles the flow (Plan -> Content -> Graph)
AFRAME.registerComponent('presentation-manager', {
  schema: {
    step: { type: 'int', default: 1 } // Start directly at step 1 (Content)
  },
  init: function () {
    this.planEntity = document.querySelector('#plan-travail');
    this.mainContent = document.querySelector('#main-content');
    this.pieChart = document.querySelector('#pie-chart-container');
    this.arrows = document.querySelectorAll('.nav-arrow');

    // Bind methods
    this.startPresentation = this.startPresentation.bind(this);
    this.nextStep = this.nextStep.bind(this);
    this.nextGraph = this.nextGraph.bind(this);
    this.prevGraph = this.prevGraph.bind(this);

    // Listeners
    if (this.planEntity) {
      this.planEntity.addEventListener('click', this.startPresentation);
    }

    // Setup Arrows
    this.el.addEventListener('next-step', this.nextStep);
    this.el.addEventListener('next-graph', this.nextGraph);
    this.el.addEventListener('prev-graph', this.prevGraph);

    this.updateVisibility();
  },
  updateVisibility: function () {
    const step = this.data.step;
    console.log('Presentation Step:', step);

    // Step 0: Idle / Plan de Travail
    if (this.planEntity) this.planEntity.setAttribute('visible', step === 0);

    // Step 1: Main Content (Title, etc.)
    if (this.mainContent) {
      if (step === 1) {
        this.mainContent.setAttribute('visible', true);
        this.mainContent.emit('startReveal');
      } else if (step !== 1) {
        // Keep visible if moving to step 2? Or hide? 
        // Based on user flow: Plan -> Title -> Stats -> Graph
        // Let's hide it for Graph (Step 3)
        if (step === 3) this.mainContent.setAttribute('visible', false);
      }
    }

    // Step 3: Pie Chart
    if (this.pieChart) {
      this.pieChart.setAttribute('visible', step === 3);
    }

    // Arrows logic removed
    /*
    this.arrows.forEach(arrow => {
      // Simple logic: show arrows if not in step 0
      arrow.setAttribute('visible', step > 0);
    });
    */
  },
  startPresentation: function () {
    this.data.step = 1;
    this.updateVisibility();
  },
  nextStep: function () {
    if (this.data.step < 3) {
      this.data.step++;
      this.updateVisibility();
    }
  },
  nextGraph: function () {
    // Dispatch to pie chart
    if (this.pieChart) this.pieChart.emit('next-dataset');
  },
  prevGraph: function () {
    // Dispatch to pie chart
    if (this.pieChart) this.pieChart.emit('prev-dataset');
  }
});

// Pie Chart Component
AFRAME.registerComponent('pie-chart', {
  schema: {
    data: { type: 'string', default: '[30, 40, 30]' }, // JSON string
    colors: { type: 'array', default: ['#FF6384', '#36A2EB', '#FFCE56'] }
  },
  init: function () {
    this.slices = [];
    this.datasetIndex = 0;
    this.datasets = [
      [30, 40, 30],
      [20, 50, 30],
      [10, 20, 70],
      [31, 26, 13, 30] // FiliÃ¨res
    ];
    this.colors = ['#FF6384', '#36A2EB', '#4BC0C0', '#E7E9ED'];

    this.el.addEventListener('next-dataset', () => {
      this.datasetIndex = (this.datasetIndex + 1) % this.datasets.length;
      this.renderChart();
    });

    this.el.addEventListener('prev-dataset', () => {
      this.datasetIndex = (this.datasetIndex - 1 + this.datasets.length) % this.datasets.length;
      this.renderChart();
    });

    this.renderChart();
  },
  renderChart: function () {
    // Clear existing
    this.el.innerHTML = '';
    this.slices = [];

    const data = this.datasets[this.datasetIndex];
    const total = data.reduce((a, b) => a + b, 0);
    let startAngle = 0;

    data.forEach((value, index) => {
      const angle = (value / total) * 360;
      const theta = (startAngle + angle / 2) * (Math.PI / 180); // Midpoint angle in radians

      // Create slice (Cylinder segment)
      // A-Frame doesn't have a perfect 'slice' primitive, using cylinder with theta-length
      const slice = document.createElement('a-cylinder');
      slice.setAttribute('radius', 0.5);
      slice.setAttribute('height', 0.1);
      slice.setAttribute('theta-start', startAngle);
      slice.setAttribute('theta-length', angle);
      slice.setAttribute('color', this.colors[index % this.colors.length]);
      slice.setAttribute('position', '0 0 0');
      slice.setAttribute('rotation', '90 0 0'); // Face camera
      slice.classList.add('clickable');

      // Interaction
      slice.addEventListener('click', () => this.onSliceClick(slice));

      this.el.appendChild(slice);
      this.slices.push(slice);

      startAngle += angle;
    });
  },
  onSliceClick: function (clickedSlice) {
    this.slices.forEach(slice => {
      if (slice === clickedSlice) {
        // Toggle Zoom
        const currentScale = slice.getAttribute('scale');
        const isZoomed = currentScale.x > 1.1;

        const target = isZoomed ? '1 1 1' : '1.2 1.2 1.2'; // Zoom 20%

        slice.setAttribute('animation', {
          property: 'scale',
          to: target,
          dur: 300,
          easing: 'easeOutQuad'
        });
      } else {
        // Reset others
        slice.setAttribute('animation', {
          property: 'scale',
          to: '1 1 1',
          dur: 300,
          easing: 'easeOutQuad'
        });
      }
    });
  }
});

// Navigation Arrow Component
AFRAME.registerComponent('nav-arrow', {
  schema: {
    action: { type: 'string' } // 'next-step', 'next-graph', 'prev-graph'
  },
  init: function () {
    this.el.classList.add('clickable');
    this.el.addEventListener('click', () => {
      // Emit event up to the presentation manager (parent or scene)
      // Assuming manager is on the parent 'mindar-image-target' entity
      const manager = this.el.closest('[presentation-manager]');
      if (manager) {
        manager.emit(this.data.action);
      }
    });

    // Hover effect
    this.el.addEventListener('mouseenter', () => {
      this.el.setAttribute('scale', '1.2 1.2 1.2');
    });
    this.el.addEventListener('mouseleave', () => {
      this.el.setAttribute('scale', '1 1 1');
    });
  }
});

// Scene 2 Animation Component: Handles the full scene 2 animation sequence
// DÃ©clenchÃ© quand le bouton BP est cliquÃ© - affiche fond.png, puis les 4 personnages
// qui bougent de faÃ§on chaotique, s'alignent, le premier change de couleur, puis le titre apparaÃ®t
AFRAME.registerComponent('scene2-animation', {
  init: function () {
    this.fond = this.el.querySelector('#scene2-fond');
    this.fond1 = this.el.querySelector('#scene2-fond1'); // Ajout de fond1
    this.persos = this.el.querySelectorAll('.perso');
    this.titre = this.el.querySelector('#scene2-titre');
    this.bp2Group = this.el.querySelector('#bp2-group'); // BP de la scÃ¨ne 2
    this.bp2 = this.el.querySelector('#scene2-bp');

    // Ã‰tat de l'animation
    this.isAnimating = false;
    this.chaoticPhase = false;
    this.chaoticStartTime = 0;

    // Position individuelle pour chaque perso (mouvement alÃ©atoire)
    this.persoVelocities = [];

    // Bind methods
    this.startSequence = this.startSequence.bind(this);

    // Listen for trigger
    this.el.addEventListener('startScene2', this.startSequence);
  },

  startSequence: function () {
    if (this.isAnimating) return;
    this.isAnimating = true;
    console.log('ðŸŽ¬ Scene 2 animation started!');

    // RÃ©initialiser les paramÃ¨tres pour le mouvement de profondeur et sautillement
    this.persoAnimParams = [];
    this.persos.forEach((perso, index) => {
      // Chaque perso a une phase diffÃ©rente pour le sautillement et le mouvement Z
      this.persoAnimParams.push({
        phaseZ: Math.random() * Math.PI * 2,      // Phase pour le mouvement en profondeur
        phaseBounce: Math.random() * Math.PI * 2, // Phase pour le sautillement
        speedZ: 1.2 + Math.random() * 0.6,        // Vitesse du mouvement Z (plus rapide)
        speedBounce: 5 + Math.random() * 3,       // Vitesse du sautillement (plus rapide)
        amplitudeZ: 0.5 + Math.random() * 0.3,    // Amplitude mouvement profondeur (plus grand)
        amplitudeBounce: 0.15 + Math.random() * 0.08 // Amplitude sautillement (plus grand)
      });
    });

    // Phase 1: Afficher les deux fonds avec animation Ã©lastique
    if (this.fond) {
      this.fond.setAttribute('animation__reveal', {
        property: 'scale',
        from: '0 0 0',
        to: '4 2.4 1',
        dur: 1000,
        easing: 'easeOutElastic'
      });
      this.fond.setAttribute('animation__fade', {
        property: 'opacity',
        from: '0',
        to: '1',
        dur: 600,
        easing: 'easeOutQuad'
      });
    }

    // Fond1 - lÃ©gÃ¨rement plus en avant, animation avec lÃ©ger dÃ©calage
    if (this.fond1) {
      this.fond1.setAttribute('animation__reveal', {
        property: 'scale',
        from: '0 0 0',
        to: '4 2.4 1',
        dur: 1000,
        delay: 100, // LÃ©ger dÃ©calage pour effet de profondeur
        easing: 'easeOutElastic'
      });
      this.fond1.setAttribute('animation__fade', {
        property: 'opacity',
        from: '0',
        to: '1',
        dur: 600,
        delay: 100,
        easing: 'easeOutQuad'
      });
    }

    // Phase 2: Les personnages apparaissent Ã  leurs positions initiales aprÃ¨s 800ms
    setTimeout(() => {
      // Positions de base espacÃ©es horizontalement
      const basePositions = [
        { x: -0.9, y: -0.2 },
        { x: -0.3, y: -0.2 },
        { x: 0.3, y: -0.2 },
        { x: 0.9, y: -0.2 }
      ];

      this.persos.forEach((perso, index) => {
        const basePos = basePositions[index];
        // Position de dÃ©part avec Z alÃ©atoire
        const startZ = 0.2 + Math.random() * 0.3;
        perso.setAttribute('position', `${basePos.x} ${basePos.y} ${startZ}`);

        // Stocker la position de base pour l'animation
        this.persoAnimParams[index].baseX = basePos.x;
        this.persoAnimParams[index].baseY = basePos.y;

        // Apparition avec effet de pop - personnages Ã©tirÃ©s en longueur
        perso.setAttribute('animation__appear', {
          property: 'opacity',
          from: '0',
          to: '1',
          dur: 400,
          delay: index * 100,
          easing: 'easeOutQuad'
        });

        // Scale Ã©tirÃ© en hauteur (Y plus grand)
        perso.setAttribute('animation__pop', {
          property: 'scale',
          from: '0 0 0',
          to: '0.4 0.7 0.4',  // Ã‰tirÃ© en longueur (Y = 0.7)
          dur: 500,
          delay: index * 100,
          easing: 'easeOutBack'
        });
      });

      // DÃ©marrer le mouvement de profondeur + sautillement
      this.chaoticPhase = true;
      this.chaoticStartTime = Date.now();
    }, 800);

    // Phase 3: Alignement aprÃ¨s 3 secondes de chaos
    setTimeout(() => {
      this.chaoticPhase = false;
      this.alignPersos();
    }, 3800);

    // Phase 4: Le premier perso change de couleur aprÃ¨s alignement
    setTimeout(() => {
      const firstPerso = this.persos[0];
      if (firstPerso) {
        console.log('ðŸŽ¨ Premier personnage change de couleur!');

        // Animation de mise en avant (scale up) - garder l'Ã©tirement en longueur
        firstPerso.setAttribute('animation__highlight', {
          property: 'scale',
          to: '0.45 0.8 0.45',  // LÃ©gÃ¨rement plus grand mais toujours Ã©tirÃ©
          dur: 300,
          easing: 'easeOutQuad'
        });

        // Changement de couleur avec un lÃ©ger dÃ©lai pour le teint orange
        // On utilise un shader personnalisÃ© via material
        firstPerso.setAttribute('material', {
          shader: 'flat',
          color: '#FF6B00',
          opacity: 1
        });

        // Animation de pulsation pour attirer l'attention - garder l'Ã©tirement
        setTimeout(() => {
          firstPerso.setAttribute('animation__pulse', {
            property: 'scale',
            from: '0.42 0.75 0.42',
            to: '0.48 0.85 0.48',
            dur: 500,
            dir: 'alternate',
            loop: 4,
            easing: 'easeInOutSine'
          });
        }, 300);
      }
    }, 4500);

    // Phase 5: Le titre apparaÃ®t avec effet Ã©lastique (plus tÃ´t)
    setTimeout(() => {
      if (this.titre) {
        console.log('ðŸ“œ Titre Scene 2 apparaÃ®t!');
        this.titre.setAttribute('animation__titleScale', {
          property: 'scale',
          from: '0 0 0',
          to: '3 0.65 0.65',
          dur: 1200,
          easing: 'easeOutElastic'
        });
        this.titre.setAttribute('animation__titleFade', {
          property: 'opacity',
          from: '0',
          to: '1',
          dur: 800,
          easing: 'easeOutQuad'
        });
      }

      // Animation terminÃ©e pour le titre
      setTimeout(() => {
        console.log('âœ… Titre Scene 2 animation complete!');
      }, 1200);
    }, 5000); // 500ms plus tÃ´t

    // Phase 6: Le BP apparaÃ®t rapidement aprÃ¨s le titre (5000 + 800 = 5800ms)
    setTimeout(() => {
      if (this.bp2Group && this.bp2) {
        console.log('ðŸ”˜ BP Scene 2 apparaÃ®t!');

        // Animation du groupe (scale)
        this.bp2Group.setAttribute('animation__bpScale', {
          property: 'scale',
          from: '0 0 0',
          to: '1 0.4 0.4',
          dur: 1000,
          easing: 'easeOutElastic'
        });

        // Animation de l'image (opacity)
        this.bp2.setAttribute('animation__bpFade', {
          property: 'opacity',
          from: '0',
          to: '1',
          dur: 600,
          easing: 'easeOutQuad'
        });
      }

      // Animation complÃ¨tement terminÃ©e
      setTimeout(() => {
        this.isAnimating = false;
        console.log('âœ… Scene 2 animation complete!');
      }, 1000);
    }, 5800); // Beaucoup plus tÃ´t (Ã©tait 8500ms)
  },

  alignPersos: function () {
    console.log('ðŸ“ Alignement des personnages...');

    // Positions d'alignement finales en ligne horizontale (mÃªme Z)
    const positions = [
      { x: -0.9, y: -0.2, z: 0.3 },
      { x: -0.3, y: -0.2, z: 0.3 },
      { x: 0.3, y: -0.2, z: 0.3 },
      { x: 0.9, y: -0.2, z: 0.3 }
    ];

    this.persos.forEach((perso, index) => {
      const pos = positions[index];

      // Animation de dÃ©placement vers la position alignÃ©e
      perso.setAttribute('animation__align', {
        property: 'position',
        to: `${pos.x} ${pos.y} ${pos.z}`,
        dur: 700,
        easing: 'easeOutBack'
      });

      // Maintenir le scale Ã©tirÃ©
      perso.setAttribute('animation__scaleAlign', {
        property: 'scale',
        to: '0.4 0.7 0.4',
        dur: 500,
        easing: 'easeOutQuad'
      });
    });
  },

  tick: function (time, timeDelta) {
    // Mouvement de profondeur (Z) + sautillement (Y) pendant la phase d'animation
    if (this.chaoticPhase && this.persos && this.persoAnimParams && this.persoAnimParams.length > 0) {
      const t = time * 0.001; // Temps en secondes

      this.persos.forEach((perso, index) => {
        const params = this.persoAnimParams[index];
        if (!params) return;

        // Mouvement sur l'axe Z (profondeur) - oscillation douce
        const zOffset = Math.sin(t * params.speedZ + params.phaseZ) * params.amplitudeZ;
        const newZ = 0.3 + zOffset;

        // Sautillement sur l'axe Y - rebond rapide
        // Utiliser une fonction qui simule un rebond (abs de sin pour toujours aller vers le haut)
        const bounceValue = Math.abs(Math.sin(t * params.speedBounce + params.phaseBounce));
        const yOffset = bounceValue * params.amplitudeBounce;
        const newY = params.baseY + yOffset;

        // Appliquer la position (X reste fixe Ã  la base)
        perso.setAttribute('position', `${params.baseX} ${newY} ${newZ}`);

        // LÃ©ger Ã©crasement/Ã©tirement pendant le sautillement pour un effet "squash & stretch"
        const squashFactor = 1 - bounceValue * 0.15; // LÃ©ger Ã©crasement quand en l'air
        const stretchFactor = 1 + bounceValue * 0.1;  // LÃ©gÃ¨rement Ã©tirÃ© en hauteur
        perso.setAttribute('scale', `${0.4 * squashFactor} ${0.7 * stretchFactor} 0.4`);
      });
    }
  }
});

// Scene 2 BP Click Component: GÃ¨re le clic sur le BP de la scÃ¨ne 2
// DÃ©clenche la phase 3: personnages bougent, texte "ce que Ã§a fait..." avec points animÃ©s, puis info + BP
AFRAME.registerComponent('scene2-bp-click', {
  init: function () {
    this.hasClicked = false;
    this.phase3ChaoticPhase = false;

    // RÃ©fÃ©rences aux Ã©lÃ©ments
    this.persos = document.querySelectorAll('.perso');
    this.cqfImage = document.querySelector('#scene2-cqf'); // Nouvelle image
    this.infoImage = document.querySelector('#scene2-info');
    this.bp3Group = document.querySelector('#bp3-group');
    this.bp3 = document.querySelector('#scene2-bp-final');
    this.bp2Group = document.querySelector('#bp2-group');
    this.titre = document.querySelector('#scene2-titre'); // Titre de la scÃ¨ne 2

    // ParamÃ¨tres d'animation pour les persos
    this.persoAnimParams = [];

    this.el.addEventListener('click', () => {
      if (this.hasClicked) return;
      this.hasClicked = true;
      console.log('ðŸ”˜ BP Scene 2 cliquÃ©! DÃ©marrage de la phase 3...');

      // DÃ©sactiver la hitbox du bouton
      disableHitbox(this.el);

      this.startPhase3();
    });
  },

  startPhase3: function () {
    // 1. Cacher le BP cliquÃ©
    if (this.bp2Group) {
      this.bp2Group.setAttribute('animation__hideScale', {
        property: 'scale',
        to: '0 0 0',
        dur: 300,
        easing: 'easeInBack'
      });
    }

    // 2. Afficher l'image "Ce qui fait..." (cqf.png) au milieu des persos
    setTimeout(() => {
      if (this.cqfImage) {
        this.cqfImage.setAttribute('visible', true);

        // Animation d'apparition avec effet de scale
        this.cqfImage.setAttribute('animation__scaleIn', {
          property: 'scale',
          from: '0 0 0',
          to: '1.8 0.4 1',
          dur: 500, // Plus rapide
          easing: 'easeOutBack'
        });
        this.cqfImage.setAttribute('animation__fadeIn', {
          property: 'opacity',
          from: '0',
          to: '1',
          dur: 400, // Plus rapide
          easing: 'easeOutQuad'
        });

        console.log('ðŸ’¬ Image "Ce qui fait..." affichÃ©e!');
      }
    }, 100); // DÃ©lai rÃ©duit Ã  100ms

    // 3. Les persos fuient vers les cÃ´tÃ©s aprÃ¨s 0.6s (trÃ¨s rapide)
    setTimeout(() => {
      console.log('ðŸƒ Personnages fuient vers les cÃ´tÃ©s!');

      // Positions de fuite : perso 1 et 2 vont Ã  gauche, perso 3 et 4 vont Ã  droite
      const fleePositions = [
        { x: -2.0, y: -0.2, z: 0.25 }, // Perso 1 -> trÃ¨s Ã  gauche
        { x: -1.5, y: -0.2, z: 0.25 }, // Perso 2 -> Ã  gauche
        { x: 1.5, y: -0.2, z: 0.25 },  // Perso 3 -> Ã  droite
        { x: 2.0, y: -0.2, z: 0.25 }   // Perso 4 -> trÃ¨s Ã  droite
      ];

      this.persos.forEach((perso, index) => {
        const pos = fleePositions[index];
        perso.setAttribute('animation__flee', {
          property: 'position',
          to: `${pos.x} ${pos.y} ${pos.z}`,
          dur: 600, // Fuite plus rapide
          easing: 'easeInBack'
        });
        // Les faire disparaÃ®tre aussi
        perso.setAttribute('animation__fadeOut', {
          property: 'opacity',
          to: '0',
          dur: 400,
          delay: 100,
          easing: 'easeInQuad'
        });
      });
    }, 600); // DÃ©lai rÃ©duit Ã  600ms

    // 4. Faire disparaÃ®tre l'image cqf ET le titre de faÃ§on stylÃ©e aprÃ¨s 1.2s
    setTimeout(() => {
      // Disparition stylÃ©e de l'image cqf (rotation + scale + fade)
      if (this.cqfImage) {
        this.cqfImage.setAttribute('animation__spinOut', {
          property: 'rotation',
          to: '0 360 0',
          dur: 500,
          easing: 'easeInCubic'
        });
        this.cqfImage.setAttribute('animation__scaleOut', {
          property: 'scale',
          to: '0 0 0',
          dur: 400,
          easing: 'easeInBack'
        });
        this.cqfImage.setAttribute('animation__fadeOut', {
          property: 'opacity',
          to: '0',
          dur: 300,
          easing: 'easeInQuad'
        });
      }

      // Disparition stylÃ©e du titre scene 2 (zoom out + rotation)
      if (this.titre) {
        this.titre.setAttribute('animation__titleSpinOut', {
          property: 'rotation',
          to: '0 -180 0',
          dur: 500,
          easing: 'easeInCubic'
        });
        this.titre.setAttribute('animation__titleScaleOut', {
          property: 'scale',
          to: '0 0 0',
          dur: 400,
          easing: 'easeInBack'
        });
        this.titre.setAttribute('animation__titleFadeOut', {
          property: 'opacity',
          to: '0',
          dur: 300,
          easing: 'easeInQuad'
        });
      }

      console.log('âœ¨ Image et titre disparaissent de faÃ§on stylÃ©e!');

      // Cacher complÃ¨tement aprÃ¨s l'animation
      setTimeout(() => {
        if (this.cqfImage) {
          this.cqfImage.setAttribute('visible', false);
        }
      }, 500);
    }, 1200); // DÃ©lai rÃ©duit Ã  1200ms

    // 5. Afficher info.png aprÃ¨s la disparition (plus rapide)
    setTimeout(() => {
      if (this.infoImage) {
        this.infoImage.setAttribute('visible', true);
        this.infoImage.setAttribute('animation__infoScale', {
          property: 'scale',
          from: '0 0 0',
          to: '2.5 1.8 1',
          dur: 600, // TrÃ¨s rapide
          easing: 'easeOutElastic'
        });
        this.infoImage.setAttribute('animation__infoFade', {
          property: 'opacity',
          from: '0',
          to: '1',
          dur: 400,
          easing: 'easeOutQuad'
        });
        console.log('ðŸ“‹ Info image affichÃ©e!');
      }
    }, 1400); // DÃ©lai rÃ©duit Ã  1400ms

    // 6. Afficher le BP final trÃ¨s rapidement aprÃ¨s info (200ms aprÃ¨s)
    setTimeout(() => {
      if (this.bp3Group && this.bp3) {
        this.bp3Group.setAttribute('visible', true);
        this.bp3Group.setAttribute('animation__bp3Scale', {
          property: 'scale',
          from: '0 0 0',
          to: '1 0.4 0.4',
          dur: 800,
          easing: 'easeOutElastic'
        });
        this.bp3.setAttribute('animation__bp3Fade', {
          property: 'opacity',
          from: '0',
          to: '1',
          dur: 500,
          easing: 'easeOutQuad'
        });
        console.log('ðŸ”˜ BP final affichÃ©!');
      }

      console.log('âœ… Phase 3 terminÃ©e!');
    }, 1600); // DÃ©lai rÃ©duit Ã  1600ms
  },

  tick: function (time, timeDelta) {
    // Mouvement chaotique des personnages pendant la phase 3
    if (this.phase3ChaoticPhase && this.persos && this.persoAnimParams.length > 0) {
      const t = time * 0.001;

      this.persos.forEach((perso, index) => {
        const params = this.persoAnimParams[index];
        if (!params) return;

        // Mouvement chaotique sur tous les axes
        const xOffset = Math.sin(t * params.speedX + params.phaseX) * params.amplitudeX;
        const yOffset = Math.abs(Math.sin(t * params.speedY + params.phaseY)) * params.amplitudeY;
        const zOffset = Math.sin(t * params.speedZ + params.phaseZ) * params.amplitudeZ;

        const newX = params.baseX + xOffset;
        const newY = params.baseY + yOffset;
        const newZ = 0.3 + zOffset;

        perso.setAttribute('position', `${newX} ${newY} ${newZ}`);

        // Squash & stretch
        const squashFactor = 1 - yOffset * 0.5;
        const stretchFactor = 1 + yOffset * 0.3;
        perso.setAttribute('scale', `${0.4 * squashFactor} ${0.7 * stretchFactor} 0.4`);
      });
    }
  }
});

// Scene 3 Trigger: DÃ©clenche la transition vers la scÃ¨ne 3
AFRAME.registerComponent('scene3-trigger', {
  init: function () {
    this.hasClicked = false;

    this.el.addEventListener('click', () => {
      if (this.hasClicked) return;
      this.hasClicked = true;
      console.log('ðŸ”˜ BP Final cliquÃ©! Transition vers Scene 3...');

      // DÃ©sactiver les hitbox de la scÃ¨ne 2
      const scene2Content = document.querySelector('#scene2-content');
      disableAllHitboxes(scene2Content);
      disableHitbox(this.el);

      const scene3Content = document.querySelector('#scene3-content');

      // Faire disparaÃ®tre tout de la scÃ¨ne 2
      if (scene2Content) {
        // RÃ©cupÃ©rer tous les enfants visibles et les faire disparaÃ®tre
        const elementsToHide = scene2Content.querySelectorAll('a-image, a-entity');
        elementsToHide.forEach(el => {
          if (el.getAttribute('opacity') !== '0') {
            el.setAttribute('animation__fadeOutAll', {
              property: 'opacity',
              to: '0',
              dur: 500,
              easing: 'easeInQuad'
            });
          }
          if (el.getAttribute('scale')) {
            el.setAttribute('animation__scaleOutAll', {
              property: 'scale',
              to: '0 0 0',
              dur: 500,
              easing: 'easeInBack'
            });
          }
        });

        // Cacher la scÃ¨ne 2 aprÃ¨s l'animation
        setTimeout(() => {
          scene2Content.setAttribute('visible', false);

          // Afficher la scÃ¨ne 3
          if (scene3Content) {
            scene3Content.setAttribute('visible', true);
            scene3Content.emit('startScene3');
            console.log('ðŸŽ¬ Scene 3 started!');
          }
        }, 600);
      }
    });
  }
});

// Scene 3 Animation Component
AFRAME.registerComponent('scene3-animation', {
  init: function () {
    this.fond = this.el.querySelector('#scene3-fond');
    this.titre = this.el.querySelector('#scene3-titre');
    this.img1 = this.el.querySelector('#scene3-img1');
    this.img2 = this.el.querySelector('#scene3-img2');
    this.img3 = this.el.querySelector('#scene3-img3');
    this.img4 = this.el.querySelector('#scene3-img4');
    this.bp4Group = this.el.querySelector('#bp4-group');
    this.bp4 = this.el.querySelector('#scene3-bp');
    this.volume = this.el.querySelector('#scene3-volume');

    this.isAnimating = false;

    this.startSequence = this.startSequence.bind(this);
    this.el.addEventListener('startScene3', this.startSequence);
  },

  startSequence: function () {
    if (this.isAnimating) return;
    this.isAnimating = true;
    console.log('ðŸŽ¬ Scene 3 animation started!');

    // Phase 1: Afficher le fond avec animation zoom + rotation
    if (this.fond) {
      this.fond.setAttribute('animation__reveal', {
        property: 'scale',
        from: '0 0 0',
        to: '4 2.4 1',
        dur: 1200,
        easing: 'easeOutElastic'
      });
      this.fond.setAttribute('animation__fade', {
        property: 'opacity',
        from: '0',
        to: '1',
        dur: 600,
        easing: 'easeOutQuad'
      });
      this.fond.setAttribute('animation__rotateIn', {
        property: 'rotation',
        from: '0 180 0',
        to: '0 0 0',
        dur: 1000,
        easing: 'easeOutCubic'
      });
    }

    // Phase 2: Afficher le titre Ã©tirÃ© avec slide depuis le haut
    setTimeout(() => {
      if (this.titre) {
        // Titre plus Ã©tirÃ© horizontalement
        this.titre.setAttribute('animation__titreReveal', {
          property: 'scale',
          from: '0 0 0',
          to: '3.5 0.5 0.5',
          dur: 1000,
          easing: 'easeOutElastic'
        });
        this.titre.setAttribute('animation__titreFade', {
          property: 'opacity',
          from: '0',
          to: '1',
          dur: 500,
          easing: 'easeOutQuad'
        });
        // Slide depuis le haut avec plus de perspective
        this.titre.setAttribute('animation__titreSlide', {
          property: 'position',
          from: '0 1.4 0.2',
          to: '0 0.85 0.2',
          dur: 800,
          easing: 'easeOutBack'
        });
        console.log('ðŸ“Œ Titre Scene 3 affichÃ©!');
      }

      // Volume apparaÃ®t en mÃªme temps (en bas Ã  gauche) - Ã©tirÃ© et plus gros
      if (this.volume) {
        this.volume.setAttribute('animation__volumeReveal', {
          property: 'scale',
          from: '0 0 0',
          to: '1.5 0.35 0.5',
          dur: 800,
          easing: 'easeOutBack'
        });
        this.volume.setAttribute('animation__volumeFade', {
          property: 'opacity',
          from: '0',
          to: '1',
          dur: 500,
          easing: 'easeOutQuad'
        });
        // Slide depuis le bas gauche
        this.volume.setAttribute('animation__volumeSlide', {
          property: 'position',
          from: '-1.8 -1.4 0.2',
          to: '-1.1 -1.05 0.2',
          dur: 600,
          easing: 'easeOutBack'
        });

        // Animation de pulsation continue aprÃ¨s l'apparition
        setTimeout(() => {
          this.volume.setAttribute('animation__volumePulse', {
            property: 'scale',
            from: '1.5 0.35 0.5',
            to: '1.65 0.38 0.55',
            dur: 800,
            dir: 'alternate',
            loop: true,
            easing: 'easeInOutSine'
          });
        }, 800);

        console.log('ðŸ”Š Volume affichÃ©!');
      }
    }, 400);

    // Phase 3: Images apparaissent une par une avec slide-in
    // Image 1 (haut gauche) - slide depuis la gauche
    setTimeout(() => {
      if (this.img1) {
        this.img1.setAttribute('animation__img1Reveal', {
          property: 'scale',
          from: '0 0 0',
          to: '0.9 0.7 1',
          dur: 800,
          easing: 'easeOutBack'
        });
        this.img1.setAttribute('animation__img1Fade', {
          property: 'opacity',
          from: '0',
          to: '1',
          dur: 400,
          easing: 'easeOutQuad'
        });
        this.img1.setAttribute('animation__img1Slide', {
          property: 'position',
          from: '-1.5 0.2 0.1',
          to: '-0.8 0.2 0.1',
          dur: 600,
          easing: 'easeOutCubic'
        });
        this.img1.setAttribute('animation__img1Rotate', {
          property: 'rotation',
          from: '0 -45 -10',
          to: '0 0 0',
          dur: 700,
          easing: 'easeOutQuad'
        });
        console.log('ðŸ–¼ï¸ Image 1 (haut gauche) affichÃ©e!');
      }
    }, 1500);

    // Image 2 (haut droite) - slide depuis la droite
    setTimeout(() => {
      if (this.img2) {
        this.img2.setAttribute('animation__img2Reveal', {
          property: 'scale',
          from: '0 0 0',
          to: '0.9 0.7 1',
          dur: 800,
          easing: 'easeOutBack'
        });
        this.img2.setAttribute('animation__img2Fade', {
          property: 'opacity',
          from: '0',
          to: '1',
          dur: 400,
          easing: 'easeOutQuad'
        });
        this.img2.setAttribute('animation__img2Slide', {
          property: 'position',
          from: '1.5 0.2 0.1',
          to: '0.8 0.2 0.1',
          dur: 600,
          easing: 'easeOutCubic'
        });
        this.img2.setAttribute('animation__img2Rotate', {
          property: 'rotation',
          from: '0 45 10',
          to: '0 0 0',
          dur: 700,
          easing: 'easeOutQuad'
        });
        console.log('ðŸ–¼ï¸ Image 2 (haut droite) affichÃ©e!');
      }
    }, 2000);

    // Image 3 (bas gauche) - slide depuis la gauche + bas
    setTimeout(() => {
      if (this.img3) {
        this.img3.setAttribute('animation__img3Reveal', {
          property: 'scale',
          from: '0 0 0',
          to: '0.9 0.7 1',
          dur: 800,
          easing: 'easeOutBack'
        });
        this.img3.setAttribute('animation__img3Fade', {
          property: 'opacity',
          from: '0',
          to: '1',
          dur: 400,
          easing: 'easeOutQuad'
        });
        this.img3.setAttribute('animation__img3Slide', {
          property: 'position',
          from: '-1.5 -0.85 0.1',
          to: '-0.8 -0.55 0.1',
          dur: 600,
          easing: 'easeOutCubic'
        });
        this.img3.setAttribute('animation__img3Rotate', {
          property: 'rotation',
          from: '0 -45 10',
          to: '0 0 0',
          dur: 700,
          easing: 'easeOutQuad'
        });
        console.log('ðŸ–¼ï¸ Image 3 (bas gauche) affichÃ©e!');
      }
    }, 2500);

    // Image 4 (bas droite) - slide depuis la droite + bas
    setTimeout(() => {
      if (this.img4) {
        this.img4.setAttribute('animation__img4Reveal', {
          property: 'scale',
          from: '0 0 0',
          to: '0.9 0.7 1',
          dur: 800,
          easing: 'easeOutBack'
        });
        this.img4.setAttribute('animation__img4Fade', {
          property: 'opacity',
          from: '0',
          to: '1',
          dur: 400,
          easing: 'easeOutQuad'
        });
        this.img4.setAttribute('animation__img4Slide', {
          property: 'position',
          from: '1.5 -0.85 0.1',
          to: '0.8 -0.55 0.1',
          dur: 600,
          easing: 'easeOutCubic'
        });
        this.img4.setAttribute('animation__img4Rotate', {
          property: 'rotation',
          from: '0 45 -10',
          to: '0 0 0',
          dur: 700,
          easing: 'easeOutQuad'
        });
        console.log('ðŸ–¼ï¸ Image 4 (bas droite) affichÃ©e!');
      }
    }, 3000);

    // Phase 4: Afficher le BP rapidement aprÃ¨s la derniÃ¨re image (500ms aprÃ¨s)
    setTimeout(() => {
      if (this.bp4Group && this.bp4) {
        this.bp4Group.setAttribute('visible', true);
        this.bp4Group.setAttribute('animation__bp4Scale', {
          property: 'scale',
          from: '0 0 0',
          to: '1 0.4 0.4',
          dur: 1000,
          easing: 'easeOutElastic'
        });
        this.bp4.setAttribute('animation__bp4Fade', {
          property: 'opacity',
          from: '0',
          to: '1',
          dur: 600,
          easing: 'easeOutQuad'
        });
        // Animation de pulsation
        this.bp4Group.setAttribute('animation__bp4Pulse', {
          property: 'scale',
          from: '1 0.4 0.4',
          to: '1.1 0.44 0.44',
          dur: 800,
          delay: 1000,
          dir: 'alternate',
          loop: true,
          easing: 'easeInOutSine'
        });
        console.log('ðŸ”˜ BP Scene 3 affichÃ©!');
      }

      this.isAnimating = false;
      console.log('âœ… Scene 3 animation complete!');
    }, 3500); // 3000 (derniÃ¨re image) + 500 (dÃ©lai)
  }
});

// Composant pour jouer un son et animer au clic
AFRAME.registerComponent('play-sound-on-click', {
  schema: {
    sound: { type: 'selector' }
  },

  init: function () {
    this.el.addEventListener('click', () => {
      // Jouer le son
      if (this.data.sound) {
        try {
          // Rembobiner si dÃ©jÃ  en cours
          this.data.sound.currentTime = 0;
          this.data.sound.play().catch(e => console.warn("Erreur lecture son (peut-Ãªtre bloquÃ© par le navigateur):", e));
          console.log('ðŸŽµ Son jouÃ©:', this.data.sound.id);
        } catch (e) {
          console.error("Erreur accÃ¨s son:", e);
        }
      }

      // Animation visuelle (scale up puis retour Ã  la normale)
      try {
        const scaleAttr = this.el.getAttribute('scale');

        // Copier les valeurs pour Ã©viter les problÃ¨mes de rÃ©fÃ©rence
        let baseX, baseY, baseZ;
        if (!scaleAttr || (Math.abs(scaleAttr.x) < 0.01 && Math.abs(scaleAttr.y) < 0.01)) {
          // Valeur par dÃ©faut si l'Ã©chelle est trop petite
          baseX = 0.9;
          baseY = 0.7;
          baseZ = 1;
        } else {
          baseX = scaleAttr.x;
          baseY = scaleAttr.y;
          baseZ = scaleAttr.z;
        }

        const targetX = baseX * 1.2;
        const targetY = baseY * 1.2;
        const targetZ = baseZ;

        console.log(`ðŸŽ¯ Animation clic: ${baseX},${baseY},${baseZ} -> ${targetX},${targetY},${targetZ}`);

        // Animation aller (zoom in)
        this.el.setAttribute('animation__clickScaleIn', {
          property: 'scale',
          to: `${targetX} ${targetY} ${targetZ}`,
          dur: 150,
          easing: 'easeOutQuad'
        });

        // Animation retour (zoom out) aprÃ¨s le zoom in
        setTimeout(() => {
          this.el.setAttribute('animation__clickScaleOut', {
            property: 'scale',
            to: `${baseX} ${baseY} ${baseZ}`,
            dur: 150,
            easing: 'easeInQuad'
          });
          console.log(`ðŸŽ¯ Retour Ã  la normale: ${baseX},${baseY},${baseZ}`);
        }, 160);
      } catch (e) {
        console.error("Erreur animation clic:", e);
      }
    });
  }
});



// Scene 4 Trigger: Passe à la scène 4
AFRAME.registerComponent('scene4-trigger', {
  init: function () {
    this.el.addEventListener('click', () => {
      console.log(' BP Scene 4 cliqué! Passage à la Scène 4...');
      const scene3 = document.querySelector('#scene3-content');
      const scene4 = document.querySelector('#scene4-content');

      disableAllHitboxes(scene3);
      disableHitbox(this.el);

      if (scene3) scene3.setAttribute('visible', false);
      if (scene4) {
        scene4.setAttribute('visible', true);
        scene4.emit('startScene4');
      }
    });
  }
});

// Animation principale de la scène 4 - Graphique et Fusée
AFRAME.registerComponent('scene4-animation', {
  init: function () {
    this.fond = this.el.querySelector('#scene4-fond');
    this.fond1 = this.el.querySelector('#scene4-fond1');
    this.titre = this.el.querySelector('#scene4-titre');
    this.fois = this.el.querySelector('#scene4-fois');
    this.arrow1 = this.el.querySelector('#scene4-arrow1');
    this.arrow2 = this.el.querySelector('#scene4-arrow2');
    this.counter = this.el.querySelector('#scene4-counter');
    this.label2 = this.el.querySelector('#scene4-label2');
    this.year2 = this.el.querySelector('#scene4-year2');
    this.rocket3d = this.el.querySelector('#scene4-rocket-3d');
    this.bp5Group = this.el.querySelector('#bp5-group');
    this.bp5 = this.el.querySelector('#scene4-bp');

    this.isAnimating = false;
    this.el.addEventListener('startScene4', () => this.startSequence());
  },

  startSequence: function () {
    if (this.isAnimating) return;
    this.isAnimating = true;
    console.log(' Démarrage Scène 4 - Graphique & Fusée');

    // Étape 1: Fonds et Titre
    this.animateBackgrounds();

    // Étape 2: "Fois" image
    setTimeout(() => {
      if (this.fois) {
        this.fois.setAttribute('animation__scale', { property: 'scale', from: '0 0 0', to: '1.5 0.3 0.3', dur: 800, easing: 'easeOutElastic' });
        this.fois.setAttribute('animation__fade', { property: 'opacity', from: '0', to: '1', dur: 500 });
      }
    }, 800);

    // Étape 3: Graphique (après 1.5s)
    setTimeout(() => this.animateGraph(), 1500);
  },

  animateBackgrounds: function () {
    if (this.fond) {
      this.fond.setAttribute('animation__scale', { property: 'scale', from: '0 0 0', to: '4 2.4 1', dur: 1000, easing: 'easeOutElastic' });
      this.fond.setAttribute('animation__fade', { property: 'opacity', from: '0', to: '1', dur: 600 });
    }
    if (this.fond1) {
      this.fond1.setAttribute('animation__scale', { property: 'scale', from: '0 0 0', to: '4 2.4 1', dur: 1000, delay: 100, easing: 'easeOutElastic' });
      this.fond1.setAttribute('animation__fade', { property: 'opacity', from: '0', to: '1', dur: 600, delay: 100 });
    }
    if (this.titre) {
      // Titre plus étiré horizontalement
      this.titre.setAttribute('animation__scale', { property: 'scale', from: '0 0 0', to: '4.5 0.55 0.55', dur: 1000, delay: 300, easing: 'easeOutBack' });
      this.titre.setAttribute('animation__fade', { property: 'opacity', from: '0', to: '1', dur: 600, delay: 300 });
    }
  },

  animateGraph: function () {
    // Barre 1 (2015)
    if (this.arrow1) {
      this.arrow1.setAttribute('visible', true);
      this.arrow1.setAttribute('animation__scale', { property: 'scale', from: '0 0 0', to: '1 1 1', dur: 800, easing: 'easeOutBack' });
    }

    // Barre 2 (2025) et Compteur
    setTimeout(() => {
      if (this.arrow2) {
        this.arrow2.setAttribute('visible', true);
        // Animation de croissance de la barre jaune
        const bar = this.arrow2.querySelector('#scene4-arrow2-bar');
        if (bar) {
          bar.setAttribute('height', '0.01'); // Start small
          bar.setAttribute('animation__grow', { property: 'geometry.height', from: '0.01', to: '0.8', dur: 2000, easing: 'easeInOutQuad' });
          bar.setAttribute('animation__pos', { property: 'position', from: '0 0.005 0', to: '0 0.4 0', dur: 2000, easing: 'easeInOutQuad' });
        }
        const tip = this.arrow2.querySelector('#scene4-arrow2-tip');
        if (tip) {
          tip.setAttribute('position', '0 0.01 0');
          tip.setAttribute('animation__move', { property: 'position', from: '0 0.01 0', to: '0 0.86 0', dur: 2000, easing: 'easeInOutQuad' });
        }
      }

      // Compteur
      if (this.counter) {
        this.counter.setAttribute('visible', true);
        this.animateCounter(78, 928, 2000); // Count from 78 to 928 over 2s
      }
      if (this.label2) this.label2.setAttribute('visible', true);
      if (this.year2) this.year2.setAttribute('visible', true);

      // Fusée 3D
      setTimeout(() => {
        if (this.rocket3d) {
          this.rocket3d.setAttribute('visible', true);
          this.rocket3d.setAttribute('animation__scale', { property: 'scale', from: '0 0 0', to: '0.3 0.3 0.3', dur: 1000, easing: 'easeOutElastic' });
          // Idle float
          this.rocket3d.setAttribute('animation__float', { property: 'position', dir: 'alternate', loop: true, dur: 2000, to: '1.0 0.1 0.5', easing: 'easeInOutSine' });
        }
      }, 1000);

      // Bouton Next
      setTimeout(() => {
        if (this.bp5Group) {
          this.bp5Group.setAttribute('visible', true);
          this.bp5Group.setAttribute('animation__scale', { property: 'scale', from: '0 0 0', to: '1 0.4 0.4', dur: 800, easing: 'easeOutBack' });
          if (this.bp5) this.bp5.setAttribute('animation__fade', { property: 'opacity', from: '0', to: '1', dur: 500 });
        }
        this.isAnimating = false;
      }, 3000);

    }, 800);
  },

  animateCounter: function (start, end, duration) {
    let current = start;
    const range = end - start;
    const increment = end > start ? 1 : -1;
    const stepTime = Math.abs(Math.floor(duration / range));

    // Optimisation: si le pas est trop petit (trop de updates), on augmente l'inccrément
    const minStepTime = 20;
    let actualStepTime = Math.max(stepTime, minStepTime);
    let actualIncrement = Math.ceil(range / (duration / actualStepTime));

    const timer = setInterval(() => {
      current += actualIncrement;
      if (current >= end) {
        current = end;
        clearInterval(timer);
      }
      if (this.counter) this.counter.setAttribute('value', current);
    }, actualStepTime);
  }
});

// Trigger pour passer à la scène 5
AFRAME.registerComponent('scene5-trigger', {
  init: function () {
    this.el.addEventListener('click', () => {
      console.log(' Passage à la Scène 5 - Podium...');
      const scene4 = document.querySelector('#scene4-content');
      const scene5 = document.querySelector('#scene5-content');

      // Désactiver les hitbox de la scène 4
      disableAllHitboxes(scene4);
      disableHitbox(this.el);


      // Animation de départ de la fusée
      const rocket = document.querySelector('#scene4-rocket-3d');
      if (rocket) {
        console.log('🚀 Fusée Scene 4 décollage !');

        // Supprimer l'animation flottante existante pour éviter les conflits
        rocket.removeAttribute('animation__float');

        // Animation de décollage vers le haut
        rocket.setAttribute('animation__launch', {
          property: 'position',
          to: '1.0 10 0.5',
          dur: 1500,
          easing: 'easeInCubic'
        });

        // Rotation pour orienter vers le haut
        rocket.setAttribute('animation__rotateLaunch', {
          property: 'rotation',
          to: '0 0 0',
          dur: 1000,
          easing: 'easeInOutQuad'
        });

        // Particules de fumée
        const particlesContainer = document.querySelector('#scene4-rocket-particles');
        if (particlesContainer) {
          particlesContainer.setAttribute('visible', true);
          // Créer plusieurs nuages de fumée
          const colors = ['#DDDDDD', '#EEEEEE', '#CCCCCC', '#AAAAAA'];
          for (let i = 0; i < 12; i++) {
            setTimeout(() => {
              const puff = document.createElement('a-sphere');
              const color = colors[Math.floor(Math.random() * colors.length)];
              puff.setAttribute('color', color);
              puff.setAttribute('radius', (0.1 + Math.random() * 0.1).toString());
              puff.setAttribute('position', `${(Math.random() - 0.5) * 0.2} 0 ${(Math.random() - 0.5) * 0.2}`);
              puff.setAttribute('opacity', '0.8');

              // Animation chute et grosse expansion
              puff.setAttribute('animation__move', {
                property: 'position',
                to: `${(Math.random() - 0.5) * 0.8} -2.5 ${(Math.random() - 0.5) * 0.8}`,
                dur: 1200 + Math.random() * 800,
                easing: 'easeInQuad'
              });
              puff.setAttribute('animation__scale', {
                property: 'scale',
                to: '3 3 3',
                dur: 1200 + Math.random() * 800,
                easing: 'linear'
              });
              puff.setAttribute('animation__fade', {
                property: 'opacity',
                to: '0',
                dur: 1200 + Math.random() * 800,
                easing: 'linear'
              });

              particlesContainer.appendChild(puff);
              // Nettoyage
              setTimeout(() => { if (puff.parentNode) puff.parentNode.removeChild(puff); }, 2500);
            }, i * 50); // Délai progressif pour effet de traînée
          }
        }
      }

      // Attendre que la fusée parte avant de changer de scène
      setTimeout(() => {
        if (scene4) scene4.setAttribute('visible', false);
        if (scene5) {
          scene5.setAttribute('visible', true);
          scene5.emit('startScene5');
        }
      }, 1200);
    });
  }
});

// Animation principale de la scène 5 - Podium
AFRAME.registerComponent('scene5-animation', {
  init: function () {
    this.fond = this.el.querySelector('#scene5-fond');
    this.titre = this.el.querySelector('#scene5-titre');
    this.flipContainer = this.el.querySelector('#scene5-flip-container');
    // Images: 2 = podium vide, 3 = 3ème place, 4 = 2ème place, 5 = 1ère place
    this.podiumEmpty = this.el.querySelector('#scene5-card-front');   // Image 2 - Podium vide
    this.place3 = this.el.querySelector('#scene5-card-back1');        // Image 3 - 3ème place
    this.place2 = this.el.querySelector('#scene5-card-back2');        // Image 4 - 2ème place
    this.place1 = this.el.querySelector('#scene5-card-back3');        // Image 5 - 1ère place
    this.cupLeft = this.el.querySelector('#scene5-cup-left');
    this.cupRight = this.el.querySelector('#scene5-cup-right');
    this.bp6Group = this.el.querySelector('#bp6-group');

    this.isAnimating = false;
    this.el.addEventListener('startScene5', () => this.startSequence());
  },

  startSequence: function () {
    if (this.isAnimating) return;
    this.isAnimating = true;
    console.log(' Démarrage Scène 5 - Animation Podium');

    // Étape 1: Fond et titre
    this.animateBackground();

    // Étape 2: Coupes 3D (après 800ms)
    setTimeout(() => this.showCups(), 800);

    // Étape 3: Animation du podium (après 1500ms)
    setTimeout(() => this.startPodiumSequence(), 1500);
  },

  animateBackground: function () {
    if (this.fond) {
      this.fond.setAttribute('animation__scale', {
        property: 'scale', from: '0.2 0.2 0.2', to: '4 2.3 1',
        dur: 1000, easing: 'easeOutCubic'
      });
      this.fond.setAttribute('animation__fade', {
        property: 'opacity', from: '0', to: '1',
        dur: 800, easing: 'easeOutQuad'
      });
    }

    if (this.titre) {
      setTimeout(() => {
        // Titre plus petit mais plus étiré
        this.titre.setAttribute('animation__scale', {
          property: 'scale', from: '0 0 0', to: '3.5 0.55 0.55',
          dur: 800, easing: 'easeOutBack'
        });
        this.titre.setAttribute('animation__fade', {
          property: 'opacity', from: '0', to: '1',
          dur: 600, easing: 'easeOutQuad'
        });
      }, 300);
    }
  },

  showCups: function () {
    // Coupe gauche avec animations - plus basse
    if (this.cupLeft) {
      this.cupLeft.setAttribute('visible', true);
      this.cupLeft.setAttribute('animation__reveal', {
        property: 'scale', from: '0 0 0', to: '0.6 0.6 0.6',
        dur: 1000, easing: 'easeOutElastic'
      });
      this.cupLeft.setAttribute('animation__spin', {
        property: 'rotation', from: '0 0 0', to: '0 360 0',
        dur: 4000, loop: true, easing: 'linear'
      });
      this.cupLeft.setAttribute('animation__float', {
        property: 'position', from: '-1.2 -0.8 0.8', to: '-1.2 -0.5 0.8',
        dur: 2000, dir: 'alternate', loop: true, easing: 'easeInOutSine'
      });
    }

    // Coupe droite avec animations - plus basse
    if (this.cupRight) {
      this.cupRight.setAttribute('visible', true);
      setTimeout(() => {
        this.cupRight.setAttribute('animation__reveal', {
          property: 'scale', from: '0 0 0', to: '0.6 0.6 0.6',
          dur: 1000, easing: 'easeOutElastic'
        });
        this.cupRight.setAttribute('animation__spin', {
          property: 'rotation', from: '0 360 0', to: '0 0 0',
          dur: 3500, loop: true, easing: 'linear'
        });
        this.cupRight.setAttribute('animation__float', {
          property: 'position', from: '1.2 -0.5 0.8', to: '1.2 -0.8 0.8',
          dur: 2200, dir: 'alternate', loop: true, easing: 'easeInOutSine'
        });
      }, 200);
    }
  },

  startPodiumSequence: function () {
    console.log(' Séquence Podium : Vide → 3ème → 2ème → 1er');

    // Étape 1: Podium vide apparaît avec effet de zoom
    this.showPodiumEmpty();

    // Étape 2: 3ème place (après 2s)
    setTimeout(() => this.showPlace(3, this.place3), 2000);

    // Étape 3: 2ème place (après 4s)
    setTimeout(() => this.showPlace(2, this.place2), 4000);

    // Étape 4: 1ère place avec explosion (après 6s)
    setTimeout(() => this.showFirstPlace(), 6000);
  },

  showPodiumEmpty: function () {
    if (this.podiumEmpty) {
      // Apparition avec effet de zoom et rebond
      this.podiumEmpty.setAttribute('animation__scale', {
        property: 'scale', from: '0 0 0', to: '1.4 1.4 1',
        dur: 1000, easing: 'easeOutElastic'
      });
      this.podiumEmpty.setAttribute('animation__fade', {
        property: 'opacity', from: '0', to: '1',
        dur: 500, easing: 'easeOutQuad'
      });
      // Légère pulsation
      setTimeout(() => {
        this.podiumEmpty.setAttribute('animation__pulse', {
          property: 'scale', from: '1.4 1.4 1', to: '1.35 1.35 1',
          dur: 1000, dir: 'alternate', loop: true, easing: 'easeInOutSine'
        });
      }, 1000);
    }
  },

  showPlace: function (placeNum, cardEl) {
    if (!cardEl) return;

    console.log(`🥉 Révélation ${placeNum}ème place!`);

    // Cacher la carte précédente avec un slide out
    const prevCard = placeNum === 3 ? this.podiumEmpty : (placeNum === 2 ? this.place3 : this.place2);
    if (prevCard) {
      prevCard.setAttribute('animation__slideOut', {
        property: 'position',
        to: '-2 0 0.01',
        dur: 500,
        easing: 'easeInBack'
      });
      prevCard.setAttribute('animation__fadeOut', {
        property: 'opacity', to: '0',
        dur: 400, easing: 'easeInQuad'
      });
    }

    // Nouvelle carte slide in depuis la droite
    setTimeout(() => {
      cardEl.setAttribute('position', '2 0 0.01');
      cardEl.setAttribute('opacity', '1');
      cardEl.setAttribute('scale', '1.4 1.4 1');

      cardEl.setAttribute('animation__slideIn', {
        property: 'position',
        from: '2 0 0.01',
        to: '0 0 0.01',
        dur: 600,
        easing: 'easeOutBack'
      });

      // Effet de brillance/pulse
      setTimeout(() => {
        cardEl.setAttribute('animation__pulse', {
          property: 'scale', from: '1.4 1.4 1', to: '1.35 1.35 1',
          dur: 1000, dir: 'alternate', loop: true, easing: 'easeInOutSine'
        });
      }, 600);

      // Particules de confettis
      this.createConfetti(placeNum);
    }, 400);
  },

  showFirstPlace: function () {
    console.log('🥇 RÉVÉLATION 1ère PLACE!');

    // Cacher la 2ème place avec explosion
    if (this.place2) {
      this.place2.setAttribute('animation__explode', {
        property: 'scale', to: '2 2 1',
        dur: 300, easing: 'easeOutQuad'
      });
      this.place2.setAttribute('animation__fadeOut', {
        property: 'opacity', to: '0',
        dur: 300, easing: 'easeOutQuad'
      });
    }

    // Flash blanc
    setTimeout(() => {
      this.createFlash();
    }, 200);

    // 1ère place apparaît avec effet spectaculaire
    setTimeout(() => {
      if (this.place1) {
        this.place1.setAttribute('position', '0 0 0.01');
        this.place1.setAttribute('opacity', '1');

        // Zoom depuis le centre
        this.place1.setAttribute('animation__zoomIn', {
          property: 'scale', from: '0 0 0', to: '1.5 1.5 1',
          dur: 800, easing: 'easeOutElastic'
        });

        // Rotation de célébration
        this.place1.setAttribute('animation__celebrate', {
          property: 'rotation', from: '0 0 -5', to: '0 0 5',
          dur: 500, dir: 'alternate', loop: 4, easing: 'easeInOutSine'
        });

        // Puis revenir stable avec pulsation dorée
        setTimeout(() => {
          this.place1.removeAttribute('animation__celebrate');
          this.place1.setAttribute('rotation', '0 0 0');
          this.place1.setAttribute('animation__goldPulse', {
            property: 'scale', from: '1.5 1.5 1', to: '1.45 1.45 1',
            dur: 800, dir: 'alternate', loop: true, easing: 'easeInOutSine'
          });
        }, 2500);
      }
    }, 400);

    // Beaucoup de confettis!
    setTimeout(() => {
      for (let i = 0; i < 3; i++) {
        setTimeout(() => this.createConfetti(1), i * 200);
      }
    }, 500);

    // Afficher le bouton BP pour la scène 6 après 3 secondes
    setTimeout(() => {
      this.showBPButton();
    }, 3000);

    this.isAnimating = false;
  },

  showBPButton: function () {
    if (this.bp6Group) {
      this.bp6Group.setAttribute('visible', true);
      this.bp6Group.setAttribute('animation__scale', {
        property: 'scale', from: '0 0 0', to: '1 0.4 0.4',
        dur: 800, easing: 'easeOutBack'
      });
      const bpImage = this.bp6Group.querySelector('#scene5-bp');
      if (bpImage) {
        bpImage.setAttribute('animation__fade', {
          property: 'opacity', from: '0', to: '1',
          dur: 600, easing: 'easeOutQuad'
        });
      }
      console.log(' Bouton BP Scene 6 affiché!');
    }
  },

  createConfetti: function (place) {
    const colors = place === 1 ? ['#FFD700', '#FFA500', '#FFFF00'] :
      place === 2 ? ['#C0C0C0', '#A0A0A0', '#E0E0E0'] :
        ['#CD7F32', '#B87333', '#D4A574'];

    for (let i = 0; i < 8; i++) {
      const confetti = document.createElement('a-box');
      confetti.setAttribute('color', colors[Math.floor(Math.random() * colors.length)]);
      confetti.setAttribute('width', '0.03');
      confetti.setAttribute('height', '0.03');
      confetti.setAttribute('depth', '0.01');
      confetti.setAttribute('position', `${(Math.random() - 0.5) * 0.5} 0.5 0.4`);
      confetti.setAttribute('rotation', `${Math.random() * 360} ${Math.random() * 360} ${Math.random() * 360}`);

      const endX = (Math.random() - 0.5) * 1.5;
      const endY = -0.8 - Math.random() * 0.5;

      confetti.setAttribute('animation__fall', {
        property: 'position',
        to: `${endX} ${endY} 0.4`,
        dur: 1500 + Math.random() * 500,
        easing: 'easeInQuad'
      });
      confetti.setAttribute('animation__spin', {
        property: 'rotation',
        to: `${Math.random() * 720} ${Math.random() * 720} ${Math.random() * 720}`,
        dur: 1500,
        easing: 'linear'
      });
      confetti.setAttribute('animation__fadeConf', {
        property: 'opacity', from: '1', to: '0',
        dur: 1500, easing: 'easeInQuad'
      });

      this.flipContainer.appendChild(confetti);
      setTimeout(() => { if (confetti.parentNode) confetti.parentNode.removeChild(confetti); }, 2000);
    }
  },

  createFlash: function () {
    const flash = document.createElement('a-plane');
    flash.setAttribute('color', '#FFFFFF');
    flash.setAttribute('width', '5');
    flash.setAttribute('height', '5');
    flash.setAttribute('position', '0 0 0.5');
    flash.setAttribute('opacity', '0');
    flash.setAttribute('animation__flashIn', {
      property: 'opacity', from: '0', to: '0.9',
      dur: 100, easing: 'easeOutQuad'
    });
    flash.setAttribute('animation__flashOut', {
      property: 'opacity', from: '0.9', to: '0',
      dur: 400, delay: 100, easing: 'easeOutQuad'
    });

    this.flipContainer.appendChild(flash);
    setTimeout(() => { if (flash.parentNode) flash.parentNode.removeChild(flash); }, 600);
  }
});


/**
 * Scene 6 Components
 * Animation finale de la presentation
 */

// Declencheur pour passer a la scene 6
AFRAME.registerComponent('scene6-trigger', {
  init: function () {
    this.el.addEventListener('click', () => {
      console.log('[Scene6] Passage a la Scene 6 finale');
      const scene5 = document.querySelector('#scene5-content');
      const scene6 = document.querySelector('#scene6-content');

      // Desactiver les hitbox de la scene 5
      disableAllHitboxes(scene5);
      disableHitbox(this.el);

      if (scene5) scene5.setAttribute('visible', false);
      if (scene6) {
        scene6.setAttribute('visible', true);
        scene6.emit('startScene6');
      }
    });
  }
});

// Animation principale de la scene 6
AFRAME.registerComponent('scene6-animation', {
  init: function () {
    this.img1 = this.el.querySelector('#scene6-img1');
    this.img2 = this.el.querySelector('#scene6-img2');
    this.isAnimating = false;
    this.el.addEventListener('startScene6', () => this.startSequence());
  },

  startSequence: function () {
    if (this.isAnimating) return;
    this.isAnimating = true;
    console.log('[Scene6] Animation finale');

    this.animateImages();

    // Lancer les confettis apres les images
    setTimeout(() => this.celebrate(), 1500);
  },

  animateImages: function () {
    // Image 1 a gauche
    if (this.img1) {
      this.img1.setAttribute('animation__slideIn', {
        property: 'position', from: '-2.5 0 0.4', to: '-1.1 0 0.4',
        dur: 1000, easing: 'easeOutBack'
      });
      this.img1.setAttribute('animation__scaleIn', {
        property: 'scale', from: '0 0 0', to: '1.4 1.4 1',
        dur: 1000, easing: 'easeOutElastic'
      });
      this.img1.setAttribute('animation__fadeIn', {
        property: 'opacity', from: '0', to: '1', dur: 600, easing: 'easeOutQuad'
      });
    }

    // Image 2 a droite avec delai
    setTimeout(() => {
      if (this.img2) {
        this.img2.setAttribute('animation__slideIn', {
          property: 'position', from: '2.5 0 0.4', to: '1.1 0 0.4',
          dur: 1000, easing: 'easeOutBack'
        });
        this.img2.setAttribute('animation__scaleIn', {
          property: 'scale', from: '0 0 0', to: '1.4 1.4 1',
          dur: 1000, easing: 'easeOutElastic'
        });
        this.img2.setAttribute('animation__fadeIn', {
          property: 'opacity', from: '0', to: '1', dur: 600, easing: 'easeOutQuad'
        });
      }
    }, 400);
  },

  celebrate: function () {
    const scene6 = document.querySelector('#scene6-content');
    if (!scene6) return;

    // Confettis colores
    const colors = ['#FFD700', '#FF6B00', '#FF4500', '#FFC300', '#32CD32', '#1E90FF', '#FF1493', '#00CED1'];

    for (let i = 0; i < 30; i++) {
      setTimeout(() => {
        const confetti = document.createElement('a-box');
        const x = (Math.random() - 0.5) * 4;
        const startY = 2.5 + Math.random() * 1.5;
        const z = 0.6 + Math.random() * 0.2;
        const color = colors[Math.floor(Math.random() * colors.length)];
        const size = 0.02 + Math.random() * 0.04;
        const duration = 3000 + Math.random() * 2000;

        confetti.setAttribute('position', x + ' ' + startY + ' ' + z);
        confetti.setAttribute('color', color);
        confetti.setAttribute('width', size);
        confetti.setAttribute('height', size);
        confetti.setAttribute('depth', size * 0.3);
        confetti.setAttribute('rotation', (Math.random() * 360) + ' ' + (Math.random() * 360) + ' ' + (Math.random() * 360));
        confetti.setAttribute('animation__fall', {
          property: 'position',
          to: (x + (Math.random() - 0.5) * 0.8) + ' -2 ' + z,
          dur: duration,
          easing: 'easeInQuad'
        });
        confetti.setAttribute('animation__spin', {
          property: 'rotation',
          to: (Math.random() * 1080) + ' ' + (Math.random() * 1080) + ' ' + (Math.random() * 1080),
          dur: duration,
          easing: 'linear'
        });
        scene6.appendChild(confetti);

        // Supprimer apres animation
        setTimeout(() => {
          if (confetti.parentNode) confetti.parentNode.removeChild(confetti);
        }, duration + 200);
      }, i * 60);
    }

    this.isAnimating = false;
  }
});

document.addEventListener('DOMContentLoaded', () => {
  const startBtn = document.getElementById('start-btn');
  const homeScreen = document.getElementById('home-screen');
  const scanOverlay = document.getElementById('scan-overlay');
  const scene = document.querySelector('a-scene');

  startBtn.addEventListener('click', () => {
    // Hide home screen
    homeScreen.classList.add('hidden-ui');

    // Show scan instruction
    scanOverlay.classList.remove('opacity-0');
    scanOverlay.classList.add('visible-ui');
  });

  // Optional: Listen for target found to hide scan overlay
  const target = document.querySelector('[mindar-image-target]');
  target.addEventListener('targetFound', () => {
    scanOverlay.textContent = "Cible dÃ©tectÃ©e !";
    setTimeout(() => {
      scanOverlay.style.opacity = '0';
    }, 2000);
  });

  target.addEventListener('targetLost', () => {
    scanOverlay.textContent = "Scannez l'affiche...";
    scanOverlay.style.opacity = '1';
  });
});
