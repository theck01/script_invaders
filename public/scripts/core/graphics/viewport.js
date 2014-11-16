define(['underscore', 'core/graphics/layeredcanvas', 'core/controller/eventhub',
        'core/util/frame'],
  function (_, LayeredCanvas, EventHub, Frame) {

    // Viewport is a moveable window into the game world, drawing only sprites
    // within the viewports bounds to the encapsulated canvas
    //
    // Argument object with fields:
    //   dimensions: object with 'width' and 'height' fields
    //   origin: object with 'x' and 'y' fields
    //   canvasID: the canvas that the viewport is attached to
    //   backgroundColor: CSS color string
    //   availableSpace: The space available to the canvas.
    var Viewport = function (opts) {
      Frame.call(this, opts.dimensions, opts.origin);
      this.canvas = new LayeredCanvas(
        opts.dimensions, opts.canvasID, opts.backgroundColor,
        opts.availableSpace);
    };
    Viewport.prototype = Object.create(Frame.prototype);
    Viewport.prototype.constructor = Viewport;


    // render paints the full scene onto the pixel canvas or any part of the
    // scene visible within the viewport onto the canvas
    // 
    // Arguments:
    //   element: Optional, any instance that supplies a pixels and layer 
    //            method. If supplied renders that element to the viewport.
    //            If not supplied renders entire viewport
    Viewport.prototype.render = function (element) {
      if (!element) {
        EventHub.trigger('viewport.render', { viewport: this });
        this.canvas.paint();
        return;
      }

      var origin = this.getOrigin();
      var pixels = element.pixels();
      _.each(pixels, function (p) {
        this.canvas.setPixel(p.x - origin.x, p.y - origin.y,
                             p.color, element.layer());
      }, this);
    };


    // renderBackground paints an element onto the viewport without any offset
    // 
    // Arguments:
    //   background: any object that has a paintOn method
    Viewport.prototype.renderBackground = function (background) {
      var pixels = background.pixels();
      _.each(pixels, function (p) {
        this.canvas.setPixel(p.x, p.y, p.color, background.layer());
      }, this);
    };


    // setAvailableSpace updates the area within which the viewport can render.
    Viewport.prototype.setAvailableSpace = function(width, height) {
      this.canvas.setAvailableSpace(width, height);
    };

    return Viewport;
  }
);
