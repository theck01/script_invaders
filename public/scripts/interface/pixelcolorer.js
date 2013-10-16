define(["jquery", "underscore", "graphics/pixelcanvas", "graphics/color"],
  function($, _, PixelCanvas, Color){
    
    // PixelColorer provides methods for creating pixel art in the browser and
    // exporting that art in a JSON string, using a PixelCanvas instance to draw
    // pixels on an HTML canvas
    //
    // Constructor Arguments;
    //   width: width of the pixel canvas in meta-pixels
    //   height: height of the pixel canvas in meta-pixels
    //   canvasID: css selector style id of the canvas on the page
    var PixelColorer = function (width, height, canvasID) {
      var that = this;

      this.$htmlCanvas = $(canvasID);
      this.action = "set";
      this.backgroundColor = "#FFFFFF";
      this.canvasID = canvasID;
      this.currentColor = "#000000";
      this.mouseDown = false;
      this.pCanvas = new PixelCanvas(width, height, this.backgroundColor,
                                     canvasID);
      this.pixelWidth = width;
      this.pixelHeight = height;
      this.pixels = [];
      this.mouseMoveAction = function () {};
      this.showGrid = true;


      // on mouseup or mouseleave set mouseDown to false
      this.$htmlCanvas.on("mouseup mouseleave", function () {
        that.mouseDown = false;
      });


      // set up mouse listener for down and movement events
      this.$htmlCanvas.on("mousedown mousemove", function (e) {

        if(e.type === "mousedown") that.mouseDown = true;

        // if user is not currently clicking, do nothing
        if(!that.mouseDown) return;

        var canvasOffset = that.$htmlCanvas.offset();
        var relx = e.pageX - canvasOffset.left;
        var rely = e.pageY - canvasOffset.top;

        var sparams = that.pCanvas.screenParams(that.pixelWidth,
                                                that.pixelHeight);

        var x = Math.floor((relx - sparams.xoffset)/sparams.pixelSize);
        var y = Math.floor((rely - sparams.yoffset)/sparams.pixelSize);

        var matchingPixel = _.find(that.pixels, function (p) {
          return p.x === x && p.y === y;
        });

        // if click was outside pixel region do nothing
        if(x > that.pixelWidth || x < 0 || y > that.pixelHeight || y < 0)
          return;

        if(that.action === "set"){
          if(matchingPixel){
            if(matchingPixel.color !== that.currentColor){
              matchingPixel.color = that.currentColor;
              that.paint();
            }
          }
          else{
            that.pixels.push({ x: x, y: y, color: that.currentColor });
            that.paint();
          }
        }
        else if(that.action === "get"){
          if(matchingPixel)
            that.currentColor = matchingPixel.color;
          else
            that.currentColor = _.clone(that.pCanvas.getPixel(x, y));
        }
        else if(that.action === "clear"){
          that.pixels = _.reject(that.pixels, function (p) {
            return p.x === x && p.y === y;
          });
          that.paint();
        }

        that.mouseMoveAction(e);
      });
    };


    // clearCanvas reverts all pixels on the PixelCanvas to their default
    // color
    PixelColorer.prototype.clearCanvas = function () {
      this.pixels = [];
      this.paint();
    };


    // exportPixels generates a JSON string of all meta-pixels set on the
    // canvas, with additional meta-data about minimum canvas size required to
    // display the image
    //
    // Returns:
    //   A JSON string representing an object with the fields:
    //   pixels: An array of objects with x, y, and color fields
    //   imageWidth: The minimum width of a PixelCanvas required to show the
    //               complete image
    //   imageHeight: The minimum height of a PixelCanvas required to show the
    //                complete image
    //   center: An object with x and y fields for the center of the image
    PixelColorer.prototype.exportImage = function () {
      var image = {};
      var xvalues = _.map(this.pixels, function (p) {
        return p.x;
      });
      var yvalues = _.map(this.pixels, function (p) {
        return p.y;
      });

      var xRange = _.reduce(xvalues, function(memo, x) {
        if(memo[0] > x) memo[0] = x;
        if(memo[1] < x) memo[1] = x;
        return memo;
      }, [Infinity, -Infinity]);

      var yRange = _.reduce(yvalues, function(memo, y) {
        if(memo[0] > y) memo[0] = y;
        if(memo[1] < y) memo[1] = y;
        return memo;
      }, [Infinity, -Infinity]);

      var imageWidth = xRange[1] - xRange[0] + 1;
      var imageHeight = yRange[1] - yRange[0] + 1;


      image.pixels = _.filter(this.pixels, function (p) {
        return p.x >=0 && p.x < this.pixelWidth && p.y >= 0 &&
               p.y < this.pixelHeight;
      }, this);
      image.center = { x: Math.floor(imageWidth/2) + xRange[0],
                       y: Math.floor(imageHeight/2) + yRange[0] };

      return image;
    };


    // getBackgroundColor returns the current color that will be set to pixels
    // that have not been clicked on
    //
    // Returns:
    //   A color hexadecimal string in the form "#RRGGBB"
    PixelColorer.prototype.getBackgroundColor = function () {
      return this.backgroundColor;
    };


    // getColor returns the current color that will be set to pixels when
    // clicked on
    //
    // Returns:
    //   A color hexadecimal string in the form "#RRGGBB"
    PixelColorer.prototype.getColor = function () {
      return this.currentColor;
    };


    // importImage loads a pixel array as the current image
    PixelColorer.prototype.importImage = function (pixelAry) {
      this.pixels = _.map(pixelAry, function (p) {
        return _.pick(p, ["x", "y", "color"]);
      });
      this.paint();
    };


    // paint writes all stored pixels to the PixelCanvas and calls the
    // PixelCanvas" paint method
    PixelColorer.prototype.paint = function () {
      var context = this.$htmlCanvas[0].getContext("2d");
      var i = 0;
      var sparams = this.pCanvas.screenParams(this.pixelWidth,
                                              this.pixelHeight);

      _.each(this.pixels, function(p) {
        if(p.x >= 0 && p.x < this.pixelWidth && p.y >= 0 &&
           p.y < this.pixelHeight){
          this.pCanvas.setPixel(p.x, p.y, p.color);
        }
      }, this);

      this.pCanvas.paint();

      if(!this.showGrid) return;

      // draw grid system after pixels have been painted, for visibility
      context.beginPath();

      for( ; i<=this.pixelWidth; i++){
        context.moveTo(sparams.xoffset + i*sparams.pixelSize,
                       sparams.yoffset);
        context.lineTo(sparams.xoffset + i*sparams.pixelSize,
                       sparams.yoffset + this.pixelHeight*sparams.pixelSize);
      }

      for(i=0 ; i<=this.pixelHeight; i++){
        context.moveTo(sparams.xoffset,
                       sparams.yoffset + i*sparams.pixelSize);
        context.lineTo(sparams.xoffset + this.pixelWidth*sparams.pixelSize,
                       sparams.yoffset + i*sparams.pixelSize);
      }

      context.closePath();
      context.strokeStyle = "#777777";
      context.stroke();
    };


    // click registers onclick callback for canvas to run after the body
    // PixelCanvas onclick event has run
    //
    // Arguments:
    //   callbackFunction: A function that may optionally take a jQuery click
    //                     event to do further processing with the click
    PixelColorer.prototype.mousemove = function (callbackFunction) {
      this.mouseMoveAction = callbackFunction;
    };


    // resize resizes the number of meta-pixels available for drawing
    // on the canvas element
    //
    // Arguments:
    //   width: width of the pixel canvas in meta-pixels
    //   height: height of the pixel canvas in meta-pixels
    PixelColorer.prototype.resize = function (width, height){
      this.pixelWidth = width;
      this.pixelHeight = height;
      this.pCanvas = new PixelCanvas(this.pixelWidth, this.pixelHeight,
                                     this.backgroundColor, this.canvasID);
      this.paint();
    };


    // setAction sets the action that will be performed when a pixel is
    // clicked on
    //
    // Arguments:
    //   actionString: One of the following strings -
    //                 "clear", returns the pixel to the default color of the 
    //                          canvas
    //                 "get", returns the color of the pixel clicked on
    //                 "set", sets the color of the pixel clicked on
    PixelColorer.prototype.setAction = function (actionString) {
      this.action = actionString;
    };


    // setBackgroundColor sets the background color of the pixel canvas,
    // where the default is #FFFFFF
    //
    // Arguments:
    //   color: a hexadecimal string "#RRGGBB"
    PixelColorer.prototype.setBackgroundColor = function (color) {
      this.backgroundColor = Color.sanitize(color);
      this.pCanvas = new PixelCanvas(this.pixelWidth, this.pixelHeight,
                                     this.backgroundColor, this.canvasID);
      this.paint();
    };


    // setColor sets the current color that will be drawn on pixels that are
    // clicked on
    //
    // Arguments:
    //   color: a hexadecimal string in the format "#RRGGBB"
    PixelColorer.prototype.setColor = function (color) {
      this.currentColor = Color.sanitize(color);
    };


    // toggleGrid toggles whether to display the grid of pixel boundrys or not
    PixelColorer.prototype.toggleGrid = function () {
      this.showGrid = !this.showGrid;
      this.paint();
    };

    return PixelColorer;
  }
);
