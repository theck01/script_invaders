define(['underscore', 'core/util/eventhub'], function (_, EventHub) {

  // distance returns the distance between two points
  //
  // Arguments:
  //   p: object with 'x' and 'y' fields
  //   q: object with 'x' and 'y' fields
  // Returns a scalar distance
  function distance (p, q) {
    return Math.sqrt(Math.pow(p.x - q.x, 2) + Math.pow(p.y - q.y, 2));
  }


  // unitize returns the unit vector pointing the the same direction as v
  //
  // Arguments:
  //   v: object with 'x' and 'y' fields
  // Returns an object with 'x' and 'y' fields
  function unitize (v) {
    var magnitude = distance(v, { x: 0, y: 0 });
    return { x: v.x/magnitude, y: v.y/magnitude };
  }


  // Follower shifts on or more instances of a Frame subtype to keep the center
  // of all frames within some minimum distance from an actor
  //
  // Arguments:
  //   actor: actor to follow
  //   frameDistances: List of objects with 'frame' and 'followRadius' fields
  var Follower = function (actor, frameDistances) {
    this.actor = actor;
    this.frameDistances = [];

    _.each(frameDistances, function (fd) {
      this.addFrame(fd.frame, fd.followRadius);
    }, this);

    var f = this;
    this.subscriptions = {
      worldStep: function () {
        if (!f.actor) return;

        _.each(f.frameDistances, function (fd) {
          var actorPos = f.actor.position();
          var center = fd.frame.center();
          var distDiff = distance(center, actorPos) - fd.followRadius;
          var unitDiff = unitize({ x: actorPos.x - center.x,
                                   y: actorPos.y - center.y });
          var offset = { x: Math.floor(distDiff * unitDiff.x),
                         y: Math.floor(distDiff * unitDiff.y) };

          if (distDiff > 0) {
            fd.frame.move(offset);
          }
        });
      },
      actorDestroy: function (params) {
        if (params.actor.id() === f.actor.id()) f.destroy();
      }
    };

    EventHub.subscribe('world.step', this.subscriptions.worldStep);
    EventHub.subscribe('actor.destroy', this.subscriptions.actorDestroy);
  };


  // addFrame adds another frame to follow the actor
  //
  // Arguments:
  //   frame: instance of a Frame subtype,
  //   followDistance: maximum float distance between frame center and actor
  Follower.prototype.addFrame = function (frame, followRadius) {
    this.frameDistances.push({ frame: frame, followRadius: followRadius });
  };


  // destroy stops all movement of frames to follow actors, disabling Follower
  // instance
  Follower.prototype.destroy = function () {
    EventHub.unsubscribe('world.step', this.subscriptions.worldStep);
    EventHub.unsubscribe('actor.destroy', this.subscriptions.actorDestroy);
  };


  // follow sets the actor that the Follower instance should follow
  //
  // Arguments:
  //   actor: any actor instance
  Follower.prototype.follow = function (actor) {
    this.actor = actor;
  };


  return Follower;
});
