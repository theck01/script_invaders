define(["jquery", "underscore", "core/graphics/color", "core/util/frame"],
  function ($, _, Color, Frame) {
    // PixelCanvas object abstracts the HTML canvas object and exposes an API to
    // draw meta-pixels on the canvas. Clears the canvas on creation
    //
    // Constructor Arguments:
    //   dimensions: object with 'width' and 'height' fields
    //   canvasID: css selector style id of the canvas on the page
    //   backgroundColor: default color of pixels not drawn to, "#RRGGBB" string
    //                    Optional, default is undefined (transparent)
    var PixelCanvas = function (dimensions, canvasID, backgroundColor) {
      Frame.call(this, dimensions, { x: 0, y: 0 });

      this.canvasID = canvasID;
      if (backgroundColor) {
        this.backgroundColor = Color.sanitize(backgroundColor);
      }
      else this.backgroundColor = undefined;
      this._htmlCanvas = $(canvasID)[0];
      
      var context = this._htmlCanvas.getContext("2d");

      this._cachedCanvasDim = { width: this._htmlCanvas.width,
                                height: this._htmlCanvas.height };
      this._cachedImageData = context.createImageData(
          this._htmlCanvas.width, this._htmlCanvas.height);
      this._cachedScreenParams = null;
      this.resize(dimensions);
    };
    PixelCanvas.prototype = Object.create(Frame.prototype);
    PixelCanvas.prototype.constructor = PixelCanvas;


    // clear the canvas
    PixelCanvas.prototype.clear = function () {
      var dim = this.getDimensions();
      var context = this._htmlCanvas.getContext("2d");
      this._cachedImageData = context.createImageData(
          this._cachedCanvasDim.width, this._cachedCanvasDim.height);
      this.pastBuffer = PixelCanvas._makePixelGrid(dim.width, dim.height,
                                                   undefined);
    };


    // clearPixelGrid clears a 2D color array to contain only the given color
    // color
    //
    // Arguments:
    //   grid: existing pixel grid
    //   color: default color of pixels not drawn to, "#RRGGBB" string. If
    //          undefined the pixels not drawn to are transparent
    PixelCanvas._clearPixelGrid  = function (grid, color) {
      var ary = [];

      for(var i=0; i<grid.length; i++){
        for(var j=0; j<grid[i].length; j++){
          grid[i][j] = color;
        }
      }
      
      return ary;
    };


    // diffFrames returns the change between the current pixel grid and the
    // previous pixel grid, for efficent drawing
    //
    // Arguments:
    //   present: current pixel grid
    //   past: previous pixel grid. Optional, if unspecified then present is
    //         compared to a completely empty grid
    //
    // Returns:
    //   A map of color strings (or "transparent") to x,y pairs, indicating
    //   pixel values that have changed between past and present
    PixelCanvas._diffFrames = function (present, past) {
      var i,j;
      var color;
      var diff = Object.create(null);

      for (i=0; i<present.length; i++) {
        for (j=0; j < present[i].length; j++) {
          if (!past || present[i][j] !== past[i][j]) {
            color = present[i][j] || "transparent";
            diff[color] = diff[color] || [];
            diff[color].push({ x: i, y: j, color: color });
          }
        }
      }
      return diff;
    };


    // getCanvasID returns the css style element id of the encapsulated HTML5
    // canvas object
    //
    // Returns:
    //   A css style element id
    PixelCanvas.prototype.getCanvasID = function () {
      return this.canvasID;
    };

      
    // getPixel returns the color of the meta-pixel at location x,y
    //
    // Arguments:
    //   x: x position of the pixel in the grid from left most (0) to right
    //      most (+ width)
    //   y: y position of the pixel in the grid from top most (0) to bottom
    //      most (+ height)
    //
    // Returns:
    //   A color hexadecimal string in the format "#RRGGBB"
    PixelCanvas.prototype.getPixel = function (x, y) {
      var dim = this.getDimensions();
      if(x > dim.width || x < 0 || y > dim.height || y < 0)
        return "#000000";
      return this.pixelBuffer[x][y];
    };


    // makePixelGrid creates a 2D array with given dimensions containin an RGB
    // string at each location in the array
    //
    // Arguments:
    //   width: width of the pixel canvas in meta-pixels
    //   height: height of the pixel canvas in meta-pixels
    //   color: default color of pixels not drawn to, "#RRGGBB" string. If
    //          undefined the pixels not drawn to are transparent
    PixelCanvas._makePixelGrid  = function (width, height, color) {
      var ary = [];

      for(var i=0; i<width; i++){
        ary[i] = [];
        for(var j=0; j<height; j++){
          ary[i][j] = color;
        }
      }
      
      return ary;
    };


    // paint draws the pixel buffer to the HTML canvas and resets the buffer
    // to contain all white pixels
    PixelCanvas.prototype.paint = function () {
      var context = this._htmlCanvas.getContext("2d");

      // if the canvas has been resized, clear it as everthing must be redrawn
      if (this._htmlCanvas.width !== this._cachedCanvasDim.width ||
          this._htmlCanvas.height !== this._cachedCanvasDim.height) {
        this._cachedCanvasDim = { width: this._htmlCanvas.width,
                                  height: this._htmlCanvas.height };
        this.clear();
        this._cachedScreenParams = null;
      }

      var diff = PixelCanvas._diffFrames(this.pixelBuffer, this.pastBuffer);
      var sparams = this.screenParams();

      var pairs = _.pairs(diff);
      var colorObj = { red: 255, green: 255, blue: 255 };
      var pixels = [];
      for(var i=0; i < pairs.length; i++) {
        colorObj = Color.toObject(pairs[i][0], true /* opt_skipSanitation */);
        pixels = pairs[i][1];
        for (var j=0; j < pixels.length; j++) {
          this._paintPixel(pixels[j], colorObj, sparams);
        }
      }

      context.putImageData(this._cachedImageData, 0, 0);

      // reset grid to background color
      var tmp = this.pastBuffer;
      this.pastBuffer = this.pixelBuffer;
      this.pixelBuffer = tmp;
      PixelCanvas._clearPixelGrid(this.pixelBuffer, this.backgroundColor);
    };


    // _paintPixel an individual metapixel in the ImageData object given screen
    // and canvas information.
    //
    // Arguments:
    //   pixel: Object with 'x', 'y', and color fields, the metapixel (x, y)
    //          coordinate and color information.
    //   colorObj: Object with 'red', 'green', and 'blue' fields. Color to paint
    //             the pixel.
    //   opt_screenParams: Optional screen parameters retrieved in a previous
    //                     call PixelCanvas#screenParams. If unspecified new
    //                     parameters are calculated.
    PixelCanvas.prototype._paintPixel = function (pixel, colorObj,
                                                  opt_screenParams) {
      var sparams = opt_screenParams || this.screenParams();
      
      var bounds = {
        xmin: pixel.x * sparams.pixelSize + sparams.xoffset,
        xmax: (pixel.x + 1) * sparams.pixelSize + sparams.xoffset,
        ymin: pixel.y * sparams.pixelSize + sparams.yoffset,
        ymax: (pixel.y + 1) * sparams.pixelSize + sparams.yoffset
      };

      var imgIndex = null;
      var imgData = this._cachedImageData;
      var width = imgData.width;
      for (var x = bounds.xmin; x < bounds.xmax; x++) {
        for (var y = bounds.ymin; y < bounds.ymax; y++) {
          imgIndex  = (y * width + x) * 4;

          if (pixel.color === undefined) {
            imgData.data[imgIndex + 3] = 0;
          }
          else {
            imgData.data[imgIndex] = colorObj.red;
            imgData.data[imgIndex + 1] = colorObj.green;
            imgData.data[imgIndex + 2] = colorObj.blue;
            imgData.data[imgIndex + 3] = 255;
          }
        }
      }
    };


    // resize the pixel canvas to have given width and height in macro pixels
    //
    // Arguments:
    //   dimensions: object with 'width' and 'height' fields
    PixelCanvas.prototype.resize = function (dimensions) {
      Frame.prototype.resize.call(this, dimensions);

      var dim = this.getDimensions();
      this.pastBuffer = PixelCanvas._makePixelGrid(dim.width, dim.height,
                                                   undefined);
      this.pixelBuffer = PixelCanvas._makePixelGrid(dim.width, dim.height,
                                                    this.backgroundColor);
      this._cachedImageData = this._htmlCanvas.getContext("2d").getImageData(
          0, 0, this._htmlCanvas.width, this._htmlCanvas.height);
      this._cachedScreenParams = null;
    };


    // screenParams measures current canvas dimensions and returns an object 
    // with the fields:
    //
    // Return fields:
    //   pixelSize: meta-pixel width and height in screen pixels
    //   xoffset: x offset in screen pixels of the left most pixels from the
    //            left edge of the canvas
    //   yoffset: yoffset in screen pixels of the top most pixels from the
    //            top most edge of the canvas
    PixelCanvas.prototype.screenParams = function () {
      if (this._cachedScreenParams) return this._cachedScreenParams;

      var dim = this.getDimensions();
      var height = this._htmlCanvas.height;
      var width = this._htmlCanvas.width;

      var xfactor = Math.floor(width/dim.width);
      var yfactor = Math.floor(height/dim.height);

      this._cachedScreenParams = Object.create(null);

      // meta-pixel dimensions determined by the smallest screen pixel to 
      // meta-pixel ratio, so that all pixels will fit on screen
      this._cachedScreenParams.pixelSize = xfactor < yfactor ?
        xfactor : yfactor;

      // compute offsets using computed pixelSize and number of pixels in each
      // dimension so that the canvas is centered
      this._cachedScreenParams.xoffset = Math.floor(
          (width - this._cachedScreenParams.pixelSize*dim.width)/2);
      this._cachedScreenParams.yoffset = Math.floor(
          (height - this._cachedScreenParams.pixelSize*dim.height)/2);

      return this._cachedScreenParams;
    };


    // setBackgroundColor sets the background color of the canvas
    PixelCanvas.prototype.setBackgroundColor = function (backgroundColor) {
      this.backgroundColor = Color.sanitize(backgroundColor);
      this.resize(this.getDimensions());
    };


    // setPixel colors in the meta-pixel at location (x,y) with given color 
    // within the meta-pixel buffer
    //
    // Arguments:
    //   x: x position of the pixel in the grid from left most (0) to right
    //      most (+ width)
    //   y: y position of the pixel in the grid from top most (0) to bottom
    //      most (+ height)
    //   color: A hexadecimal string in the format "#RRGGBB"
    PixelCanvas.prototype.setPixel = function (x, y, color) {
      var dim = this.getDimensions();
      if (x >= dim.width || x < 0 || y >= dim.height || y < 0) return;
      this.pixelBuffer[x][y] = Color.sanitize(color);
    };

    return PixelCanvas;
  }
);
