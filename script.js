"use strict";


// ============================================================
// BASIC SETUP
// ============================================================

function Car(make, model) {
  this.make = make;
  this.model = model;
}

const hondaCivic = new Car("Honda", "Civic");

console.log(`make: ${hondaCivic.make}`);


const canvas = document.querySelector("#myCanvas");
const ctx = canvas.getContext("2d");

const inputForm = document.querySelector("#inputForm");
const status = document.querySelector("#status");
const iframe = document.querySelector("#streetview");


// ============================================================
// FORM
// ============================================================

inputForm.innerHTML = `
  <input
    type="number"
    id="Ncoordinate"
    name="Ncoordinate"
    step="any"
    placeholder="Latitude"
    value="48.8583701"
    required
  >

  <label for="Ncoordinate">
    Latitude
  </label>

  <input
    type="number"
    id="Ecoordinate"
    name="Ecoordinate"
    step="any"
    placeholder="Longitude"
    value="2.2919064"
    required
  >

  <label for="Ecoordinate">
    Longitude
  </label>

  <button type="submit">
    Submit
  </button>
`;


inputForm.addEventListener("submit", async (event) => {

  event.preventDefault();

  const lat = Number(
    document.querySelector("#Ncoordinate").value
  );

  const lng = Number(
    document.querySelector("#Ecoordinate").value
  );


  if (!Number.isFinite(lat) || !Number.isFinite(lng)) {
    status.textContent = "Invalid coordinates.";
    return;
  }

  if (lat < -90 || lat > 90) {
    status.textContent = "Latitude must be between -90 and 90.";
    return;
  }

  if (lng < -180 || lng > 180) {
    status.textContent = "Longitude must be between -180 and 180.";
    return;
  }


  try {

    status.textContent = "Finding Street View...";

    const pano = await findPanorama(lat, lng);

    console.log("Panorama:", pano);

    status.textContent =
      `Panorama found: ${pano.id}`;

    createStreetViewViewer(pano);

  } catch (error) {

    console.error(error);

    status.textContent =
      "Could not find Street View: " + error.message;
  }
});


// ============================================================
// GOOGLE STREET VIEW PANORAMA LOOKUP
// ============================================================
//
// This uses JSONP rather than fetch().
//
// That's important because the Google endpoint doesn't provide
// the CORS header required for a normal browser fetch.
//
// This technique is based on the same SingleImageSearch
// endpoint used by WorldGuessr.
// ============================================================

function findPanorama(lat, lng) {

  return new Promise((resolve, reject) => {

    const callbackName =
      "__streetview_callback_" +
      Date.now() +
      "_" +
      Math.floor(Math.random() * 100000);


    const script = document.createElement("script");

    let finished = false;


    function cleanup() {

      if (script.parentNode) {
        script.parentNode.removeChild(script);
      }

      try {
        delete window[callbackName];
      } catch {
        window[callbackName] = undefined;
      }
    }


    const timeout = setTimeout(() => {

      if (finished) {
        return;
      }

      finished = true;

      cleanup();

      reject(
        new Error("Street View lookup timed out.")
      );

    }, 15000);


    window[callbackName] = function(data) {

      if (finished) {
        return;
      }

      finished = true;

      clearTimeout(timeout);

      cleanup();


      try {

        console.log("Google panorama response:", data);


        /*
         * The SingleImageSearch response used by Google Maps
         * contains the panorama ID at:
         *
         * data[1][1][1]
         *
         * This is also the path used by older working
         * browser implementations of this endpoint.
         */

        const panoId =
          data?.[1]?.[1]?.[1];


        if (
          typeof panoId !== "string" ||
          panoId.length === 0
        ) {
          reject(
            new Error(
              "Google returned no Street View panorama."
            )
          );

          return;
        }


        /*
         * Try to get the actual panorama coordinates.
         *
         * Google returns these elsewhere in the response.
         * If unavailable, fall back to the requested point.
         */

        let panoLat = lat;
        let panoLng = lng;


        try {

          const position =
            data?.[1]?.[5]?.[0]?.[1];

          if (
            Array.isArray(position) &&
            typeof position[0] === "number" &&
            typeof position[1] === "number"
          ) {
            panoLat = position[0];
            panoLng = position[1];
          }

        } catch {
          // Use requested coordinates.
        }


        /*
         * Heading of the panorama.
         */

        let heading = 0;

        try {

          const h =
            data?.[1]?.[5]?.[0]?.[1]?.[2]?.[0];

          if (typeof h === "number") {
            heading = h;
          }

        } catch {
          heading = 0;
        }


        resolve({
          id: panoId,
          lat: panoLat,
          lng: panoLng,
          heading
        });

      } catch (error) {

        reject(error);
      }
    };


    /*
     * JSONP request.
     *
     * The callback parameter is what makes this work from
     * browser JavaScript without CORS/fetch.
     */

    const url =
      "https://maps.googleapis.com/maps/api/js/GeoPhotoService.SingleImageSearch" +
      "?pb=!1m5!1sapiv3!5sUS" +
      "!11m2!1m1!1b0" +
      "!2m4!1m2!3d" +
      encodeURIComponent(lat) +
      "!4d" +
      encodeURIComponent(lng) +
      "!2d50" +
      "!3m10" +
      "!2m2!1sen!2sUS" +
      "!9m1!1e2" +
      "!11m4!1m3!1e2!2b1!3e2" +
      "!4m10!1e1!1e2!1e3!1e4!1e8!1e6" +
      "!5m1!1e2" +
      "!6m1!1e2" +
      "&callback=" +
      encodeURIComponent(callbackName);


    console.log("Street View lookup:");
    console.log(url);


    script.src = url;

    script.onerror = () => {

      if (finished) {
        return;
      }

      finished = true;

      clearTimeout(timeout);

      cleanup();

      reject(
        new Error("Google Street View request failed.")
      );
    };


    document.head.appendChild(script);

  });
}

async function showStreetView(lat, lng) {
  try {
    status.textContent = "Finding Street View...";

    console.log("Looking for Street View...");
    console.log("Latitude:", lat);
    console.log("Longitude:", lng);

    const pano = await findPanorama(lat, lng);

    console.log("Panorama found:", pano);

    status.textContent =
      `Panorama found: ${pano.id}`;

    createStreetViewViewer(pano);

  } catch (error) {
    console.error("Street View error:", error);

    status.textContent =
      "Could not load Street View: " + error.message;
  }
}

// ============================================================
// CREATE THE VIEWER
// ============================================================
//
// Instead of putting google.com/maps inside the iframe,
// we put OUR OWN viewer inside it.
//
// The viewer downloads Google's panorama tiles directly.
// ============================================================

function createStreetViewViewer(pano) {

  const html = createViewerHTML(pano);

  iframe.srcdoc = html;
}


// ============================================================
// VIEWER HTML
// ============================================================

function createViewerHTML(pano) {

  const panoId = JSON.stringify(pano.id);
  const heading = Number(pano.heading) || 0;

  return `
<!doctype html>

<html>

<head>

<meta charset="utf-8">

<style>

html,
body {
  margin: 0;
  width: 100%;
  height: 100%;
  overflow: hidden;
  background: #000;
}

canvas {
  width: 100%;
  height: 100%;
  display: block;
  cursor: grab;
  touch-action: none;
}

canvas.dragging {
  cursor: grabbing;
}

#loading {
  position: absolute;
  top: 50%;
  left: 50%;
  transform: translate(-50%, -50%);
  color: white;
  font-family: Arial, sans-serif;
  background: rgba(0,0,0,.7);
  padding: 12px 18px;
  border-radius: 8px;
}

</style>

</head>

<body>

<canvas id="view"></canvas>

<div id="loading">
  Loading Street View...
</div>

<script>

"use strict";

const PANO_ID = ${panoId};

const START_HEADING = ${heading};

const canvas = document.getElementById("view");

const gl = canvas.getContext("webgl", {
  antialias: true,
  alpha: false
});

if (!gl) {

  document.getElementById("loading").textContent =
    "WebGL is not supported.";

  throw new Error("WebGL unavailable");
}


// ============================================================
// SHADERS
// ============================================================

const vertexShaderSource = \`
attribute vec2 a_position;

varying vec2 v_uv;

void main() {

  v_uv = a_position * 0.5 + 0.5;

  gl_Position = vec4(
    a_position,
    0.0,
    1.0
  );
}
\`;


const fragmentShaderSource = \`
precision highp float;

varying vec2 v_uv;

uniform sampler2D u_panorama;

uniform float u_yaw;
uniform float u_pitch;
uniform float u_fov;
uniform float u_aspect;

const float PI = 3.14159265358979323846;

void main() {

  float sx =
    (v_uv.x - 0.5) * 2.0;

  float sy =
    (v_uv.y - 0.5) * 2.0;

  float tanHalfFov =
    tan(u_fov * 0.5);

  float x =
    sx *
    tanHalfFov *
    u_aspect;

  float y =
    -sy *
    tanHalfFov;

  float z = 1.0;

  vec3 ray =
    normalize(
      vec3(x, y, z)
    );


  // Pitch

  float cp =
    cos(u_pitch);

  float sp =
    sin(u_pitch);

  float y1 =
    ray.y * cp -
    ray.z * sp;

  float z1 =
    ray.y * sp +
    ray.z * cp;

  ray.y = y1;
  ray.z = z1;


  // Yaw

  float cy =
    cos(u_yaw);

  float syaw =
    sin(u_yaw);

float x2 =
  ray.x * cy +
  ray.z * syaw;

float z2 =
  -ray.x * syaw +
  ray.z * cy;


  ray.x = x2;
  ray.z = z2;


  // Equirectangular projection

  float longitude =
    atan(
      ray.x,
      ray.z
    );

  float latitude =
    asin(
      clamp(
        ray.y,
        -1.0,
        1.0
      )
    );


float u =
  longitude /
  (2.0 * PI)
  + 0.5;

float v =
  0.5 +
  latitude /
  PI;

u = fract(u);

gl_FragColor =
  texture2D(
    u_panorama,
    vec2(u, v)
  );

}
\`;


// ============================================================
// COMPILE SHADER
// ============================================================

function compileShader(type, source) {

  const shader =
    gl.createShader(type);

  gl.shaderSource(
    shader,
    source
  );

  gl.compileShader(shader);

  if (
    !gl.getShaderParameter(
      shader,
      gl.COMPILE_STATUS
    )
  ) {

    const error =
      gl.getShaderInfoLog(shader);

    console.error(error);

    throw new Error(error);
  }

  return shader;
}


const vertexShader =
  compileShader(
    gl.VERTEX_SHADER,
    vertexShaderSource
  );


const fragmentShader =
  compileShader(
    gl.FRAGMENT_SHADER,
    fragmentShaderSource
  );


const program =
  gl.createProgram();


gl.attachShader(
  program,
  vertexShader
);

gl.attachShader(
  program,
  fragmentShader
);

gl.linkProgram(program);


if (
  !gl.getProgramParameter(
    program,
    gl.LINK_STATUS
  )
) {

  throw new Error(
    gl.getProgramInfoLog(program)
  );
}


gl.useProgram(program);


// ============================================================
// FULLSCREEN QUAD
// ============================================================

const vertices = new Float32Array([

  -1, -1,
   1, -1,
  -1,  1,

  -1,  1,
   1, -1,
   1,  1

]);


const buffer =
  gl.createBuffer();


gl.bindBuffer(
  gl.ARRAY_BUFFER,
  buffer
);


gl.bufferData(
  gl.ARRAY_BUFFER,
  vertices,
  gl.STATIC_DRAW
);


const positionLocation =
  gl.getAttribLocation(
    program,
    "a_position"
  );


gl.enableVertexAttribArray(
  positionLocation
);


gl.vertexAttribPointer(
  positionLocation,
  2,
  gl.FLOAT,
  false,
  0,
  0
);


// ============================================================
// PANORAMA
// ============================================================

const TILE_SIZE = 512;

const ZOOM = 2;

const COLS = 4;

const ROWS = 2;


const panoCanvas =
  document.createElement("canvas");

panoCanvas.width =
  TILE_SIZE * COLS;

panoCanvas.height =
  TILE_SIZE * ROWS;


const panoCtx =
  panoCanvas.getContext("2d");


let loaded = 0;

const total =
  COLS * ROWS;


// ============================================================
// LOAD TILE
// ============================================================

function loadTile(x, y) {

  return new Promise((resolve) => {

    const img =
      new Image();

    img.crossOrigin = "anonymous";


    const url =
      "https://streetviewpixels-pa.googleapis.com/v1/tile" +
      "?cb_client=maps_sv.tactile" +
      "&panoid=" +
      encodeURIComponent(PANO_ID) +
      "&x=" +
      x +
      "&y=" +
      y +
      "&zoom=" +
      ZOOM +
      "&nbt=1" +
      "&fover=2";


    img.onload = () => {

      panoCtx.drawImage(
        img,
        x * TILE_SIZE,
        y * TILE_SIZE,
        TILE_SIZE,
        TILE_SIZE
      );

      loaded++;

      document.getElementById(
        "loading"
      ).textContent =
        "Loading Street View " +
        Math.round(
          loaded / total * 100
        ) +
        "%";

      resolve();
    };


    img.onerror = () => {

      console.error(
        "Failed to load tile",
        x,
        y
      );

      resolve();
    };


    img.src = url;

  });
}


// ============================================================
// GPU TEXTURE
// ============================================================

const texture =
  gl.createTexture();


gl.bindTexture(
  gl.TEXTURE_2D,
  texture
);


gl.texParameteri(
  gl.TEXTURE_2D,
  gl.TEXTURE_WRAP_S,
  gl.REPEAT
);

gl.texParameteri(
  gl.TEXTURE_2D,
  gl.TEXTURE_WRAP_T,
  gl.CLAMP_TO_EDGE
);

gl.texParameteri(
  gl.TEXTURE_2D,
  gl.TEXTURE_MIN_FILTER,
  gl.LINEAR
);

gl.texParameteri(
  gl.TEXTURE_2D,
  gl.TEXTURE_MAG_FILTER,
  gl.LINEAR
);


const textureLocation =
  gl.getUniformLocation(
    program,
    "u_panorama"
  );


const yawLocation =
  gl.getUniformLocation(
    program,
    "u_yaw"
  );


const pitchLocation =
  gl.getUniformLocation(
    program,
    "u_pitch"
  );


const fovLocation =
  gl.getUniformLocation(
    program,
    "u_fov"
  );


const aspectLocation =
  gl.getUniformLocation(
    program,
    "u_aspect"
  );


// ============================================================
// CAMERA
// ============================================================

let yaw =
  START_HEADING *
  Math.PI / 180;


let pitch = 0;


let fov =
  75 *
  Math.PI / 180;


// ============================================================
// RESIZE
// ============================================================

function resize() {

  const dpr =
    Math.min(
      window.devicePixelRatio || 1,
      2
    );


  canvas.width =
    Math.floor(
      canvas.clientWidth * dpr
    );


  canvas.height =
    Math.floor(
      canvas.clientHeight * dpr
    );
}


window.addEventListener(
  "resize",
  resize
);


// ============================================================
// RENDER
// ============================================================

function render() {

  resize();

  gl.viewport(
    0,
    0,
    canvas.width,
    canvas.height
  );


  gl.clearColor(
    0,
    0,
    0,
    1
  );


  gl.clear(
    gl.COLOR_BUFFER_BIT
  );


  gl.useProgram(program);


  gl.activeTexture(
    gl.TEXTURE0
  );


  gl.bindTexture(
    gl.TEXTURE_2D,
    texture
  );


  gl.uniform1i(
    textureLocation,
    0
  );


  gl.uniform1f(
    yawLocation,
    yaw
  );


  gl.uniform1f(
    pitchLocation,
    pitch
  );


  gl.uniform1f(
    fovLocation,
    fov
  );


  gl.uniform1f(
    aspectLocation,
    canvas.width /
    canvas.height
  );


  gl.drawArrays(
    gl.TRIANGLES,
    0,
    6
  );


  requestAnimationFrame(
    render
  );
}


// ============================================================
// MOUSE
// ============================================================

let dragging = false;

let lastX = 0;
let lastY = 0;


canvas.addEventListener(
  "mousedown",
  (event) => {

    dragging = true;

    lastX = event.clientX;
    lastY = event.clientY;

    canvas.classList.add("dragging");
  }
);


window.addEventListener(
  "mouseup",
  () => {

    dragging = false;

    canvas.classList.remove("dragging");
  }
);


window.addEventListener(
  "mousemove",
  (event) => {

    if (!dragging) {
      return;
    }

    const dx =
      event.clientX - lastX;

    const dy =
      event.clientY - lastY;

    lastX = event.clientX;
    lastY = event.clientY;


    // Drag left  -> look right
    // Drag right -> look left

yaw -=
  dx * 0.005;

pitch +=
  dy * 0.005;


    const limit =
      Math.PI / 2 - 0.05;

    pitch =
      Math.max(
        -limit,
        Math.min(
          limit,
          pitch
        )
      );
  }
);

// ============================================================
// TOUCH
// ============================================================

let touchX = 0;
let touchY = 0;


canvas.addEventListener(
  "touchstart",
  (event) => {

    if (event.touches.length !== 1) {
      return;
    }

    touchX =
      event.touches[0].clientX;

    touchY =
      event.touches[0].clientY;
  },
  {
    passive: true
  }
);


canvas.addEventListener(
  "touchmove",
  (event) => {

    if (event.touches.length !== 1) {
      return;
    }

    const x =
      event.touches[0].clientX;

    const y =
      event.touches[0].clientY;


    const dx =
      x - touchX;

    const dy =
      y - touchY;


    touchX = x;
    touchY = y;


    // Same direction as mouse

// Touch
yaw -= dx * 0.005;
pitch += dy * 0.005;


    const limit =
      Math.PI / 2 - 0.05;

    pitch =
      Math.max(
        -limit,
        Math.min(
          limit,
          pitch
        )
      );
  },
  {
    passive: true
  }
);


// ============================================================
// ZOOM
// ============================================================

canvas.addEventListener(
  "wheel",
  (event) => {

    event.preventDefault();


    fov +=
      event.deltaY *
      0.001;


    fov =
      Math.max(
        30 * Math.PI / 180,

        Math.min(
          110 * Math.PI / 180,
          fov
        )
      );
  },
  {
    passive: false
  }
);


// ============================================================
// LOAD EVERYTHING
// ============================================================

async function start() {

  const jobs = [];


  for (
    let y = 0;
    y < ROWS;
    y++
  ) {

    for (
      let x = 0;
      x < COLS;
      x++
    ) {

      jobs.push(
        loadTile(x, y)
      );
    }
  }


  await Promise.all(jobs);


  gl.bindTexture(
    gl.TEXTURE_2D,
    texture
  );


  gl.pixelStorei(
    gl.UNPACK_FLIP_Y_WEBGL,
    false
  );


  gl.texImage2D(
    gl.TEXTURE_2D,
    0,
    gl.RGBA,
    gl.RGBA,
    gl.UNSIGNED_BYTE,
    panoCanvas
  );


  document.getElementById(
    "loading"
  ).style.display =
    "none";


  resize();

  render();
}


start();

<\/script>

</body>

</html>
`;
}




// ============================================================
// INITIAL TEST
// ============================================================
//
// Uncomment this if you want it to automatically load Paris
// when the page opens.
//
// showStreetView(48.8583701, 2.2919064);
//
