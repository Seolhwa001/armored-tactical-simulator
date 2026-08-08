// src/render/mapRenderer.js — 새 파일


const DEFAULT_HEX_RADIUS = 28;


export function hexToWorld(

column,

row,

hexRadius = DEFAULT_HEX_RADIUS,

) {

const horizontal =

Math.sqrt(3) * hexRadius;


return {

x:

column * horizontal +

(

row % 2 === 0

? 0

: horizontal / 2

),


y:  
  row *  
  hexRadius *  
  1.5,  



};

}


function drawHexagon(

context,

x,

y,

radius,

fill,

stroke,

lineWidth = 1,

) {

context.beginPath();


for (

let side = 0;

side < 6;

side += 1

) {

const angle =

Math.PI / 3 * side -

Math.PI / 6;


const pointX =  
  x +  
  Math.cos(angle) *  
    radius;  

const pointY =  
  y +  
  Math.sin(angle) *  
    radius;  

if (side === 0) {  
  context.moveTo(  
    pointX,  
    pointY,  
  );  
} else {  
  context.lineTo(  
    pointX,  
    pointY,  
  );  
}  



}


context.closePath();

context.fillStyle = fill;

context.fill();

context.strokeStyle = stroke;

context.lineWidth = lineWidth;

context.stroke();

}


function getVisibleWorldBounds(

width,

height,

camera,

margin,

) {

return {

minimumX:

-camera.x /

camera.zoom -

margin,


maximumX:  
  (  
    width -  
    camera.x  
  ) /  
    camera.zoom +  
  margin,  

minimumY:  
  -camera.y /  
    camera.zoom -  
  margin,  

maximumY:  
  (  
    height -  
    camera.y  
  ) /  
    camera.zoom +  
  margin,  



};

}


function isPointVisible(

point,

bounds,

) {

return (

point.x >=

bounds.minimumX &&

point.x <=

bounds.maximumX &&

point.y >=

bounds.minimumY &&

point.y <=

bounds.maximumY

);

}


function createLayer() {

const canvas =

document.createElement(

"canvas",

);


const context =

canvas.getContext("2d");


if (!context) {

throw new Error(

"오프스크린 렌더링 컨텍스트를 생성할 수 없습니다.",

);

}


return {

canvas,

context,

signature: null,

version: -1,

};

}


function resizeLayer(

layer,

width,

height,

ratio,

) {

const pixelWidth =

Math.max(

1,

Math.floor(

width * ratio,

),

);


const pixelHeight =

Math.max(

1,

Math.floor(

height * ratio,

),

);


if (

layer.canvas.width ===

pixelWidth &&

layer.canvas.height ===

pixelHeight

) {

return;

}


layer.canvas.width =

pixelWidth;


layer.canvas.height =

pixelHeight;


layer.signature = null;

}


function createCameraSignature(

width,

height,

camera,

ratio,

) {

return [

width,

height,

ratio,

camera.x.toFixed(2),

camera.y.toFixed(2),

camera.zoom.toFixed(4),

].join(":");

}


function prepareLayerContext(

layer,

ratio,

camera,

width,

height,

) {

const context =

layer.context;


context.setTransform(

1,

0,

0,

1,

0,

0,

);


context.clearRect(

0,

0,

layer.canvas.width,

layer.canvas.height,

);


context.setTransform(

ratio,

0,

0,

ratio,

0,

0,

);


context.clearRect(

0,

0,

width,

height,

);


context.translate(

camera.x,

camera.y,

);


context.scale(

camera.zoom,

camera.zoom,

);

}


export function createMapRenderer({

canvas,

terrainTypes,

hexRadius =

DEFAULT_HEX_RADIUS,

}) {

const context =

canvas.getContext("2d");


if (!context) {

throw new Error(

"지도 렌더링 컨텍스트를 생성할 수 없습니다.",

);

}


const terrainLayer =

createLayer();


const fogLayer =

createLayer();


let terrainVersion = 0;

let fogVersion = 0;

let ratio = 1;

let width = 1;

let height = 1;


function resize() {

const rectangle =

canvas.getBoundingClientRect();


width =  
  Math.max(  
    1,  
    rectangle.width,  
  );  

height =  
  Math.max(  
    1,  
    rectangle.height,  
  );  

ratio =  
  Math.min(  
    window.devicePixelRatio ||  
      1,  
    2,  
  );  

canvas.width =  
  Math.floor(  
    width * ratio,  
  );  

canvas.height =  
  Math.floor(  
    height * ratio,  
  );  

resizeLayer(  
  terrainLayer,  
  width,  
  height,  
  ratio,  
);  

resizeLayer(  
  fogLayer,  
  width,  
  height,  
  ratio,  
);  



}


function invalidateTerrain() {

terrainVersion += 1;

}


function invalidateFog() {

fogVersion += 1;

}


function renderTerrainLayer({

terrain,

camera,

developerMode,

}) {
const signature =
  createCameraSignature(
    width,
    height,
    camera,
    ratio,
  ) +
  `:${developerMode}`;


if (  
  terrainLayer.signature ===  
    signature &&  
  terrainLayer.version ===  
    terrainVersion  
) {  
  return;  
}  

prepareLayerContext(  
  terrainLayer,  
  ratio,  
  camera,  
  width,  
  height,  
);  

const bounds =  
  getVisibleWorldBounds(  
    width,  
    height,  
    camera,  
    hexRadius * 2,  
  );  

terrain.forEach((hex) => {  
  const point =  
    hexToWorld(  
      hex.column,  
      hex.row,  
      hexRadius,  
    );  

  if (  
    !isPointVisible(  
      point,  
      bounds,  
    )  
  ) {  
    return;  
  }  

  const terrainType =  
    terrainTypes[  
      hex.type  
    ];  

  drawHexagon(  
    terrainLayer.context,  
    point.x,  
    point.y,  
    hexRadius - 1,  
    terrainType.color,  
    terrainType.stroke,  
  );  

  if (terrainType.symbol) {  
    terrainLayer.context.fillStyle =  
      "rgba(230, 239, 229, 0.58)";  

    terrainLayer.context.font =  
      "600 12px system-ui";  

    terrainLayer.context.textAlign =  
      "center";  

    terrainLayer.context.fillText(  
      terrainType.symbol,  
      point.x,  
      point.y + 4,  
    );  
  }  

  if (developerMode) {  
    terrainLayer.context.fillStyle =  
      "#e4d49c";  

    terrainLayer.context.font =  
      "9px monospace";  

    terrainLayer.context.textAlign =  
      "center";  

    terrainLayer.context.fillText(  
      `${hex.elevation}m`,  
      point.x,  
      point.y + 18,  
    );  
  }  
});  

terrainLayer.signature =  
  signature;  

terrainLayer.version =  
  terrainVersion;  



}


function renderFogLayer({

terrain,

camera,

fog,

developerMode,

drawFogLayer,

}) {

const signature =
  createCameraSignature(
    width,
    height,
    camera,
    ratio,
  ) +
  `:${developerMode}`;


if (  
  fogLayer.signature ===  
    signature &&  
  fogLayer.version ===  
    fogVersion  
) {  
  return;  
}  

prepareLayerContext(  
  fogLayer,  
  ratio,  
  camera,  
  width,  
  height,  
);  

if (!developerMode) {  
  const bounds =  
    getVisibleWorldBounds(  
      width,  
      height,  
      camera,  
      hexRadius * 2,  
    );  

  drawFogLayer({  
    context:  
      fogLayer.context,  

    terrain,  
    fog,  
    bounds,  
    hexRadius,  

    hexToWorld: (  
      column,  
      row,  
    ) =>  
      hexToWorld(  
        column,  
        row,  
        hexRadius,  
      ),  

    drawHexagon:  
      (  
        x,  
        y,  
        radiusValue,  
        fill,  
        stroke,  
        lineWidth,  
      ) =>  
        drawHexagon(  
          fogLayer.context,  
          x,  
          y,  
          radiusValue,  
          fill,  
          stroke,  
          lineWidth,  
        ),  

    isPointVisible,  
  });  
}  

fogLayer.signature =  
  signature;  

fogLayer.version =  
  fogVersion;  



}


function render({

terrain,

camera,

fog,

developerMode,

drawFogLayer,

drawDynamicLayer,

drawOverlayLayer = null,

now = performance.now(),

}) {

renderTerrainLayer({

terrain,

camera,

developerMode,

});


renderFogLayer({  
  terrain,  
  camera,  
  fog,  
  developerMode,  
  drawFogLayer,  
});  

context.setTransform(  
  1,  
  0,  
  0,  
  1,  
  0,  
  0,  
);  

context.clearRect(  
  0,  
  0,  
  canvas.width,  
  canvas.height,  
);  

context.drawImage(  
  terrainLayer.canvas,  
  0,  
  0,  
);  

context.setTransform(  
  ratio,  
  0,  
  0,  
  ratio,  
  0,  
  0,  
);  

context.save();  

context.translate(  
  camera.x,  
  camera.y,  
);  

context.scale(  
  camera.zoom,  
  camera.zoom,  
);  

const bounds =  
  getVisibleWorldBounds(  
    width,  
    height,  
    camera,  
    hexRadius * 3,  
  );  

drawDynamicLayer({  
  context,  
  bounds,  
  now,  
  hexRadius,  

  hexToWorld: (  
    column,  
    row,  
  ) =>  
    hexToWorld(  
      column,  
      row,  
      hexRadius,  
    ),  

  isPointVisible,  
  drawHexagon: (  
    x,  
    y,  
    radiusValue,  
    fill,  
    stroke,  
    lineWidth,  
  ) =>  
    drawHexagon(  
      context,  
      x,  
      y,  
      radiusValue,  
      fill,  
      stroke,  
      lineWidth,  
    ),  
});  

context.restore();  

context.setTransform(  
  1,  
  0,  
  0,  
  1,  
  0,  
  0,  
);  

context.drawImage(  
  fogLayer.canvas,  
  0,  
  0,  
);  

if (
  typeof drawOverlayLayer ===
  "function"
) {
  context.setTransform(
    ratio,
    0,
    0,
    ratio,
    0,
    0,
  );

  context.save();

  context.translate(
    camera.x,
    camera.y,
  );

  context.scale(
    camera.zoom,
    camera.zoom,
  );

  const overlayBounds =
    getVisibleWorldBounds(
      width,
      height,
      camera,
      hexRadius * 3,
    );

  drawOverlayLayer({
    context,
    bounds:
      overlayBounds,
    now,
    hexRadius,

    hexToWorld: (
      column,
      row,
    ) =>
      hexToWorld(
        column,
        row,
        hexRadius,
      ),

    isPointVisible,
  });

  context.restore();

  context.setTransform(
    1,
    0,
    0,
    1,
    0,
    0,
  );
}



}


resize();


return {

resize,

render,

invalidateTerrain,

invalidateFog,


getViewportSize() {  
  return {  
    width,  
    height,  
    ratio,  
  };  
},  



};

}

