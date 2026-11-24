import { useEffect, useRef, useState } from "react";
import { LoaderCircle } from "lucide-react";

const MODEL_URL = "/models/asus-rog-strix-scar-17.glb";
const SCREEN_W = 1024;
const SCREEN_H = 576;
// Draw the screen texture at 2x so the UI stays legible on the model.
const SCREEN_SCALE = 2;
const FOV = 28;
const BASE_Y = -0.22;
const BASE_X = 0.05;

const SCREEN_THEMES = {
  dark: {
    bg: "#0b080d",
    text: "#f7f1f4",
    muted: "#b9a9b2",
    dim: "rgba(255,255,255,0.34)",
    line: "rgba(255,255,255,0.08)",
    surface: "rgba(255,255,255,0.04)",
    grid: "rgba(255,255,255,0.045)",
    accent: "#ff4d94",
    onAccent: "#1a0710",
    ok: "#5eead4",
    okSoft: "rgba(94,234,212,0.1)",
    okLine: "rgba(94,234,212,0.28)",
    warn: "#fbbf24",
    glow: "rgba(255,77,148,0.26)",
  },
};

const day = (offset) => {
  const d = new Date();
  d.setHours(0, 0, 0, 0);
  d.setDate(d.getDate() + offset);
  return d;
};

const shortDate = (d) =>
  d.toLocaleDateString([], { month: "short", day: "numeric" });

const isBusy = (loan, at) =>
  !loan.cancelled &&
  !loan.returned &&
  +new Date(loan.start) <= at &&
  at <= +new Date(loan.end);

function roundRect(ctx, x, y, w, h, r) {
  ctx.beginPath();
  ctx.moveTo(x + r, y);
  ctx.arcTo(x + w, y, x + w, y + h, r);
  ctx.arcTo(x + w, y + h, x, y + h, r);
  ctx.arcTo(x, y + h, x, y, r);
  ctx.arcTo(x, y, x + w, y, r);
  ctx.closePath();
}

function label(ctx, text, x, y, color) {
  ctx.fillStyle = color;
  ctx.font = "500 12px 'JetBrains Mono', monospace";
  ctx.fillText(text, x, y);
}

function drawScreen(canvas, data) {
  const ctx = canvas.getContext("2d");
  const { tab, laptops, loans, now, previewLaptop, pickup, ret, theme } = data;
  const c = SCREEN_THEMES[theme] || SCREEN_THEMES.dark;
  const w = SCREEN_W;
  const h = SCREEN_H;

  ctx.setTransform(SCREEN_SCALE, 0, 0, SCREEN_SCALE, 0, 0);
  ctx.clearRect(0, 0, w, h);
  ctx.fillStyle = c.bg;
  ctx.fillRect(0, 0, w, h);

  const glow = ctx.createRadialGradient(w * 0.78, -40, 0, w * 0.78, -40, w * 0.8);
  glow.addColorStop(0, c.glow);
  glow.addColorStop(1, "rgba(0,0,0,0)");
  ctx.fillStyle = glow;
  ctx.fillRect(0, 0, w, h);

  ctx.strokeStyle = c.grid;
  ctx.lineWidth = 1;
  for (let x = 0; x < w; x += 48) {
    ctx.beginPath();
    ctx.moveTo(x, 0);
    ctx.lineTo(x, h);
    ctx.stroke();
  }
  for (let y = 0; y < h; y += 48) {
    ctx.beginPath();
    ctx.moveTo(0, y);
    ctx.lineTo(w, y);
    ctx.stroke();
  }

  const pad = 54;
  const free = laptops.filter(
    (lp) => !lp.maintenance && !loans.some((l) => l.laptopId === lp.id && isBusy(l, now))
  ).length;

  // Brand bar
  ctx.fillStyle = c.accent;
  ctx.font = "700 20px 'Space Grotesk', sans-serif";
  ctx.fillText("CSD", pad, 62);
  ctx.fillStyle = c.dim;
  ctx.font = "500 10px 'JetBrains Mono', monospace";
  ctx.fillText("LAPTOP BORROWING", pad + 46, 61);

  ctx.fillStyle = c.dim;
  ctx.font = "500 11px 'JetBrains Mono', monospace";
  ctx.textAlign = "right";
  ctx.fillText("STUDENT PORTAL", w - pad, 61);
  ctx.textAlign = "left";

  if (tab === 0) {
    ctx.fillStyle = c.accent;
    ctx.font = "500 12px 'JetBrains Mono', monospace";
    ctx.fillText("LIVE FLEET", pad, 128);

    ctx.fillStyle = c.text;
    ctx.font = "600 34px 'Space Grotesk', sans-serif";
    ctx.fillText("Availability", pad, 170);

    // live pill
    const pillW = 118;
    const pillX = w - pad - pillW;
    roundRect(ctx, pillX, 138, pillW, 38, 19);
    ctx.fillStyle = c.okSoft;
    ctx.fill();
    ctx.strokeStyle = c.okLine;
    ctx.stroke();
    ctx.fillStyle = c.ok;
    ctx.beginPath();
    ctx.arc(pillX + 22, 157, 4, 0, Math.PI * 2);
    ctx.fill();
    ctx.font = "600 15px 'Space Grotesk', sans-serif";
    ctx.fillText(`${free} free`, pillX + 36, 162);

    const rows = laptops.slice(0, 4);
    let y = 210;
    if (rows.length === 0) {
      ctx.fillStyle = c.muted;
      ctx.font = "500 16px 'Space Grotesk', sans-serif";
      ctx.fillText("Loading the fleet…", pad, y + 26);
    }
    rows.forEach((lp) => {
      const busy = loans.some((l) => l.laptopId === lp.id && isBusy(l, now));
      const state = lp.maintenance ? "Repair" : busy ? "Booked" : "Free";
      const color = lp.maintenance || busy ? c.warn : c.ok;
      roundRect(ctx, pad, y, w - pad * 2, 54, 12);
      ctx.fillStyle = c.surface;
      ctx.fill();
      ctx.strokeStyle = c.line;
      ctx.stroke();

      ctx.fillStyle = c.accent;
      ctx.font = "500 12px 'JetBrains Mono', monospace";
      ctx.fillText(lp.tag, pad + 18, y + 23);
      ctx.fillStyle = c.text;
      ctx.font = "500 16px 'Space Grotesk', sans-serif";
      ctx.fillText(lp.model, pad + 18, y + 42);

      const chipW = 84;
      const chipX = w - pad - chipW - 14;
      roundRect(ctx, chipX, y + 13, chipW, 28, 14);
      ctx.fillStyle = `${color}1a`;
      ctx.fill();
      ctx.fillStyle = color;
      ctx.font = "600 12px 'Space Grotesk', sans-serif";
      ctx.textAlign = "center";
      ctx.fillText(state, chipX + chipW / 2, y + 32);
      ctx.textAlign = "left";
      y += 64;
    });

    ctx.fillStyle = c.dim;
    ctx.font = "500 11px 'JetBrains Mono', monospace";
    ctx.fillText("Synced with CSD records", pad, h - 42);
    ctx.textAlign = "right";
    ctx.fillText(`${free}/${laptops.length || "—"} ready`, w - pad, h - 42);
    ctx.textAlign = "left";
    return;
  }

  if (tab === 1) {
    ctx.fillStyle = c.accent;
    ctx.font = "500 12px 'JetBrains Mono', monospace";
    ctx.fillText("NEW RESERVATION", pad, 128);

    ctx.fillStyle = c.text;
    ctx.font = "600 34px 'Space Grotesk', sans-serif";
    ctx.fillText("Reserve a machine", pad, 170);

    ctx.fillStyle = c.dim;
    ctx.font = "500 11px 'JetBrains Mono', monospace";
    ctx.textAlign = "right";
    ctx.fillText("1 / 3", w - pad, 164);
    ctx.textAlign = "left";

    const fields = [
      ["LAPTOP", `${previewLaptop.tag} · ${previewLaptop.model}`],
      ["PICK UP", shortDate(pickup)],
      ["RETURN", shortDate(ret)],
      ["PURPOSE", "Thesis build"],
    ];
    let y = 214;
    fields.forEach(([k, v], i) => {
      const half = i > 0 && i < 3;
      const x = half && i === 2 ? w / 2 + 10 : pad;
      const fw = half ? w / 2 - pad - 10 : w - pad * 2;
      roundRect(ctx, x, y, fw, 66, 12);
      ctx.fillStyle = c.surface;
      ctx.fill();
      ctx.strokeStyle = c.line;
      ctx.stroke();
      label(ctx, k, x + 18, y + 24, c.muted);
      ctx.fillStyle = c.text;
      ctx.font = "500 16px 'Space Grotesk', sans-serif";
      ctx.fillText(v, x + 18, y + 48);
      if (!half || i === 2) y += 80;
    });

    roundRect(ctx, pad, h - 104, w - pad * 2, 50, 12);
    ctx.fillStyle = c.accent;
    ctx.fill();
    ctx.fillStyle = c.onAccent;
    ctx.font = "600 16px 'Space Grotesk', sans-serif";
    ctx.textAlign = "center";
    ctx.fillText("Confirm reservation  →", w / 2, h - 73);
    ctx.textAlign = "left";
    return;
  }

  const cx = w / 2;
  ctx.beginPath();
  ctx.arc(cx, 160, 34, 0, Math.PI * 2);
  ctx.fillStyle = c.okSoft;
  ctx.fill();
  ctx.strokeStyle = c.okLine;
  ctx.stroke();
  ctx.strokeStyle = c.ok;
  ctx.lineWidth = 3;
  ctx.lineCap = "round";
  ctx.beginPath();
  ctx.moveTo(cx - 14, 160);
  ctx.lineTo(cx - 3, 171);
  ctx.lineTo(cx + 15, 149);
  ctx.stroke();

  ctx.fillStyle = c.accent;
  ctx.font = "500 12px 'JetBrains Mono', monospace";
  ctx.textAlign = "center";
  ctx.fillText("RESERVATION CONFIRMED", cx, 232);

  ctx.fillStyle = c.text;
  ctx.font = "600 38px 'Space Grotesk', sans-serif";
  ctx.fillText("Ready for pick-up", cx, 278);

  ctx.fillStyle = c.muted;
  ctx.font = "400 15px 'Space Grotesk', sans-serif";
  ctx.fillText("CSD Office · 9:00 AM – 4:00 PM", cx, 312);

  roundRect(ctx, cx - 130, 344, 260, 62, 12);
  ctx.fillStyle = c.surface;
  ctx.fill();
  ctx.strokeStyle = c.line;
  ctx.stroke();
  ctx.fillStyle = c.accent;
  ctx.font = "600 24px 'JetBrains Mono', monospace";
  ctx.fillText(previewLaptop.tag, cx, 383);

  ctx.fillStyle = c.dim;
  ctx.font = "500 11px 'JetBrains Mono', monospace";
  ctx.fillText(`Return by ${shortDate(ret)}  ·  Bring your student ID`, cx, h - 48);
  ctx.textAlign = "left";
}

export default function LaptopStage({ tab = 0, laptops = [], loans = [], now = Date.now(), theme = "dark", className = "" }) {
  const hostRef = useRef(null);
  const canvasRef = useRef(null);
  const textureRef = useRef(null);
  const dirtyRef = useRef(true);
  const dataRef = useRef({ tab, laptops, loans, now, theme });
  const [status, setStatus] = useState("loading");
  const [progress, setProgress] = useState(0);

  const previewLaptop =
    laptops.find(
      (lp) => !lp.maintenance && !loans.some((l) => l.laptopId === lp.id && isBusy(l, now))
    ) ||
    laptops[0] || { tag: "CSD-LT-001", model: "Lenovo ThinkPad E14" };

  const pickup = day(1);
  const ret = day(1);

  dataRef.current = { tab, laptops, loans, now, previewLaptop, pickup, ret, theme };

  useEffect(() => {
    const canvas = canvasRef.current;
    if (!canvas) return;
    drawScreen(canvas, dataRef.current);
    if (textureRef.current) {
      textureRef.current.needsUpdate = true;
      dirtyRef.current = true;
    }
    let alive = true;
    document.fonts?.ready.then(() => {
      if (!alive) return;
      drawScreen(canvas, dataRef.current);
      if (textureRef.current) {
        textureRef.current.needsUpdate = true;
        dirtyRef.current = true;
      }
    });
    return () => {
      alive = false;
    };
  }, [tab, laptops, loans, now, theme]);

  useEffect(() => {
    const host = hostRef.current;
    if (!host) return;

    // Don't download the 13 MB model on phones, small screens, or data-saver connections.
    const saveData = navigator.connection?.saveData === true;
    const tooSmall = window.matchMedia?.("(min-width: 900px)").matches === false;
    if (saveData || tooSmall) {
      setStatus("unavailable");
      return;
    }

    let disposed = false;
    let frame = 0;
    let renderer;
    let scene;
    let camera;
    let group;
    let texture;
    let originalScreenMaterial;
    let fitCamera;
    let framedSize;
    let restY = 0;
    let targetX = BASE_X;
    let targetY = BASE_Y;
    let curX = BASE_X;
    let curY = BASE_Y;
    const reduce =
      typeof window !== "undefined" &&
      window.matchMedia?.("(prefers-reduced-motion: reduce)").matches;

    const init = async () => {
      const THREE = await import("three");
      const { GLTFLoader } = await import("three/examples/jsm/loaders/GLTFLoader.js");
      const { RoomEnvironment } = await import("three/examples/jsm/environments/RoomEnvironment.js");
      if (disposed || !host) return;

      scene = new THREE.Scene();
      camera = new THREE.PerspectiveCamera(FOV, 1, 0.1, 200);
      renderer = new THREE.WebGLRenderer({
        antialias: true,
        alpha: true,
        powerPreference: "high-performance",
      });
      renderer.setPixelRatio(Math.min(window.devicePixelRatio || 1, 2));
      renderer.setClearColor(0x000000, 0);
      renderer.outputColorSpace = THREE.SRGBColorSpace;
      renderer.toneMapping = THREE.ACESFilmicToneMapping;
      renderer.toneMappingExposure = 1.08;
      renderer.domElement.className = "lp-stage-gl";
      renderer.domElement.setAttribute("aria-hidden", "true");
      host.appendChild(renderer.domElement);

      const pmrem = new THREE.PMREMGenerator(renderer);
      scene.environment = pmrem.fromScene(new RoomEnvironment(), 0.04).texture;
      scene.environmentIntensity = 0.7;
      pmrem.dispose();

      scene.add(new THREE.HemisphereLight(0xfff4fa, 0x1a1015, 1.5));

      const key = new THREE.DirectionalLight(0xffffff, 3.2);
      key.position.set(3.5, 5, 5);
      scene.add(key);

      const pink = new THREE.DirectionalLight(0xff4d94, 2.4);
      pink.position.set(-5, 2, 3);
      scene.add(pink);

      const teal = new THREE.PointLight(0x5eead4, 9, 14);
      teal.position.set(2.5, 1.5, 3.5);
      scene.add(teal);

      const rim = new THREE.PointLight(0xff4d94, 12, 16);
      rim.position.set(-3, 0.5, -3);
      scene.add(rim);

      group = new THREE.Group();
      scene.add(group);

      const gltf = await new Promise((resolve, reject) => {
        new GLTFLoader().load(
          MODEL_URL,
          resolve,
          (e) => {
            if (e.total) setProgress(Math.round((e.loaded / e.total) * 100));
          },
          reject
        );
      });
      if (disposed) return;

      const root = gltf.scene;
      root.updateMatrixWorld(true);
      const box = new THREE.Box3().setFromObject(root);
      const center = box.getCenter(new THREE.Vector3());
      root.position.sub(center);

      let screenMesh;
      root.traverse((obj) => {
        if (!obj.isMesh) return;
        obj.castShadow = false;
        obj.receiveShadow = false;
        const mats = Array.isArray(obj.material) ? obj.material : [obj.material];
        if (mats.some((m) => m?.name === "Layar") || obj.name === "Object_8") {
          screenMesh = obj;
        }
      });

      if (screenMesh) {
        originalScreenMaterial = screenMesh.material;
        texture = new THREE.CanvasTexture(canvasRef.current);
        texture.colorSpace = THREE.SRGBColorSpace;
        // The GLB's screen UVs are V-flipped relative to the canvas.
        texture.flipY = true;
        texture.anisotropy = renderer.capabilities.getMaxAnisotropy();
        texture.minFilter = THREE.LinearMipmapLinearFilter;
        texture.magFilter = THREE.LinearFilter;
        textureRef.current = texture;
        screenMesh.material = new THREE.MeshBasicMaterial({
          map: texture,
          toneMapped: false,
        });
      }

      group.add(root);
      group.rotation.set(BASE_X, BASE_Y, 0);
      group.updateMatrixWorld(true);
      // Center the rotated model so the laptop sits dead-center in the stage.
      const framedBox = new THREE.Box3().setFromObject(group);
      const framedCenter = framedBox.getCenter(new THREE.Vector3());
      framedSize = framedBox.getSize(new THREE.Vector3());
      restY = -framedCenter.y;
      group.position.set(-framedCenter.x, restY, 0);
      curX = BASE_X;
      curY = BASE_Y;

      fitCamera = () => {
        if (!camera || !host) return;
        const w = host.clientWidth;
        const h = host.clientHeight;
        if (!w || !h) return;
        camera.aspect = w / h;
        const half = Math.tan((FOV * Math.PI) / 360);
        const fitH = framedSize.y / (2 * half);
        const fitW = framedSize.x / (2 * half * camera.aspect);
        const dist = Math.max(fitH, fitW) * 1.14;
        camera.position.set(0, framedSize.y * 0.05, dist);
        camera.lookAt(0, 0, 0);
        camera.updateProjectionMatrix();
        dirtyRef.current = true;
      };

      // ResizeObserver fires before the async model load, when the renderer is
      // still undefined. Size the drawing buffer now or the canvas stays at
      // its 300x150 default and the laptop renders blurry.
      resize();
      setStatus("ready");
      dirtyRef.current = true;
    };

    const resize = () => {
      if (!renderer || !camera || !host) return;
      const w = host.clientWidth;
      const h = host.clientHeight;
      if (!w || !h) return;
      renderer.setSize(w, h, false);
      fitCamera?.();
      dirtyRef.current = true;
    };

    const onMove = (e) => {
      if (reduce) return;
      const rect = host.getBoundingClientRect();
      const x = (e.clientX - rect.left) / rect.width - 0.5;
      const y = (e.clientY - rect.top) / rect.height - 0.5;
      targetY = BASE_Y - x * 0.14;
      targetX = BASE_X + y * 0.07;
    };

    const onLeave = () => {
      targetX = BASE_X;
      targetY = BASE_Y;
    };

    const tick = (t) => {
      if (disposed) return;
      frame = requestAnimationFrame(tick);
      if (!renderer || !scene || !camera) return;
      if (!reduce) {
        curX += (targetX - curX) * 0.08;
        curY += (targetY - curY) * 0.08;
        group.rotation.x = curX;
        group.rotation.y = curY;
        group.position.y = restY + Math.sin(t * 0.0006) * 0.018;
      } else if (!dirtyRef.current) {
        return;
      }
      dirtyRef.current = false;
      renderer.render(scene, camera);
    };

    const ro = new ResizeObserver(resize);
    ro.observe(host);
    host.addEventListener("pointermove", onMove);
    host.addEventListener("pointerleave", onLeave);

    // Wait until the stage is actually near the viewport before loading three.js.
    const start = () => {
      init().catch(() => {
        if (!disposed) setStatus("error");
      });
      frame = requestAnimationFrame(tick);
    };
    let io;
    if (typeof IntersectionObserver === "undefined") {
      start();
    } else {
      io = new IntersectionObserver(
        ([entry]) => {
          if (!entry.isIntersecting) return;
          io.disconnect();
          start();
        },
        { rootMargin: "250px" }
      );
      io.observe(host);
    }

    return () => {
      disposed = true;
      io?.disconnect();
      cancelAnimationFrame(frame);
      ro.disconnect();
      host.removeEventListener("pointermove", onMove);
      host.removeEventListener("pointerleave", onLeave);
      textureRef.current = null;
      if (texture) texture.dispose();
      if (originalScreenMaterial) {
        const mats = Array.isArray(originalScreenMaterial)
          ? originalScreenMaterial
          : [originalScreenMaterial];
        mats.forEach((m) => {
          m?.map?.dispose?.();
          m?.dispose?.();
        });
      }
      if (scene) {
        scene.traverse((obj) => {
          if (obj.isMesh) {
            obj.geometry?.dispose();
            const mats = Array.isArray(obj.material) ? obj.material : [obj.material];
            mats.forEach((m) => {
              m?.map?.dispose?.();
              m?.dispose?.();
            });
          }
        });
      }
      renderer?.dispose();
      renderer?.domElement?.remove();
    };
  }, []);

  return (
    <div className={`lp-stage ${className}`.trim()} ref={hostRef}>
      <canvas
        ref={canvasRef}
        width={SCREEN_W * SCREEN_SCALE}
        height={SCREEN_H * SCREEN_SCALE}
        className="lp-stage-canvas"
      />
      {status !== "ready" && (
        <div className={`lp-stage-status ${status}`} role="status">
          {status === "loading" ? (
            <>
              <LoaderCircle size={22} className="lp-stage-spin" />
              <span>{progress ? `Loading the ROG model… ${progress}%` : "Loading the ROG model…"}</span>
            </>
          ) : (
            <span>3D preview unavailable on this device.</span>
          )}
        </div>
      )}
    </div>
  );
}
