define(['underscore', 'core/util/subscriber'], function (_, Subscriber) {

  var DRIFT_FREQUENCY = 2;
  var STAR_DENSITY = 0.0004577;
  var STAR_COLOR = '#FFFFCC';


  // Starfield scenery is a background with slowly shifting, randomly generated
  // stars
  //
  // Arguments:
  //   dimensions: object with 'width' and 'height' fields, area stars can
  //               occupy
  //   driftVelocity: object with 'x' and 'y', shift distance per update 
  //   layer: layer on which to draw star fields in a *Canvas
  //   frameClock: FrameClock instance to register recurring drift event
  var Starfield = function (dimensions, driftVelocity, layer, frameClock) {
    // setup as a Subscriber
    Subscriber.call(this);

    // initialize starfield
    this.lyr = layer;

    this.stars = [];
    for (var i=0; i<dimensions.width; i++) {
      for (var j=0; j<dimensions.height; j++) {
        if (Math.random() < STAR_DENSITY) this.stars.push({ x: i, y: j });
      }
    }

    var field = this;

    // set up recurring event to initiate starfield drift
    frameClock.recurring(function () {

      // shift stars
      field.stars = _.reduce(field.stars, function (memo, s) {
        var drifted = { x: s.x + driftVelocity.x, y: s.y + driftVelocity.y };
        if (drifted.x >= 0 && drifted.x  < dimensions.width && drifted.y >= 0 &&
            drifted.y < dimensions.height) {
          memo.push(drifted);
        }

        return memo;
      }, [], field);


      // determine portion of the screen that needs new stars
      var replaceBounds = Object.create(null);
      if (driftVelocity.x > 0) {
        replaceBounds.xmin = 0;
        replaceBounds.xmax = Math.ceil(driftVelocity.x) - 1;
        replaceBounds.startx = replaceBounds.xmax + 1;
        replaceBounds.endx = dimensions.width - 1;
      }
      else {
        replaceBounds.xmin = dimensions.width + Math.ceil(driftVelocity.x);
        replaceBounds.xmax = dimensions.width - 1;
        replaceBounds.startx = 0;
        replaceBounds.endx = replaceBounds.xmin - 1;
      }

      if (driftVelocity.y > 0) {
        replaceBounds.ymin = 0;
        replaceBounds.ymax = driftVelocity.y - 1;
      }
      else {
        replaceBounds.ymin = dimensions.height + driftVelocity.y;
        replaceBounds.ymax = dimensions.height - 1;
      }

      // add any new stars to the screen
      for (var i=replaceBounds.xmin; i<=replaceBounds.xmax; i++) {
        for (var j=0; j<dimensions.height; j++) {
          if (Math.random() < STAR_DENSITY) field.stars.push({ x: i, y: j });
        }
      }

      for (var i=replaceBounds.startx; i<=replaceBounds.endx; i++) {
        for (var j=replaceBounds.ymin; j<=replaceBounds.ymax; j++) {
          if (Math.random() < STAR_DENSITY) field.stars.push({ x: i, y: j });
        }
      }
    }, DRIFT_FREQUENCY);

    var starfield = this;
    this.register('viewport.render', function (params) {
      params.viewport.renderBackground(starfield);
    });
  };
  Starfield.prototype = Object.create(Subscriber.prototype);
  Starfield.prototype.constructor = Starfield;


  // layer returns the layer on which to paint the star field
  Starfield.prototype.layer = function () {
    return this.lyr;
  };


  // pixels returns the pixels for the stars in the starfield
  //
  // Returns an array of objects with 'x' 'y' and 'color'
  Starfield.prototype.pixels = function () {
    return _.map(this.stars, function (s) {
      return { x: Math.floor(s.x), y: Math.floor(s.y), color: STAR_COLOR };
    });
  };


  return Starfield;
});
