require.config({
  baseUrl: "/scripts",
  paths: {
    bootstrap: "/bootstrap/dist/js/bootstrap.min",
    jquery: "/jquery/jquery.min",
    underscore: "/underscore-amd/underscore-min"
  }
});

require(["jquery", "core/graphics/spritearchive", "core/graphics/viewport",
         "core/interface/keypoll", "core/util/frameclock",
         "core/controller/eventhub", "core/util/follower",
         "core/world/actionbox", "submersion/actors/submersible",
         "submersion/actors/fishschool", "submersion/actors/creatures/turtle",
         "submersion/actors/creatures/octopus", "submersion/util/layer",
         "submersion/util/planktonbox"],
  function($, SpriteArchive, Viewport, KeyPoll, FrameClock, EventHub,
           Follower, ActionBox, Submersible, FishSchool, Turtle, Octopus,
           Layer, PlanktonBox) {

    var VIEWPORT_DIMENSIONS = { width: 400, height: 237 };
    var ACTIONBOX_DIMENSIONS = { width: 800, height: 475 };
    var $canvas;
    var Game = Object.create(null);
    var planktonBox;
    var sub;
    var tigerSchoolRight;
    var surgeonSchoolLeft;
    var octopus;


    function sizeCanvas () {
      if ($canvas[0].width !== $(window).width() ||
          $canvas[0].height !== $(window).height()){
        $canvas[0].width = $(window).width();
        $canvas[0].height = $(window).height();
        Game.viewport.setAvailableSpace(
            $canvas[0].width, $canvas[0].height);
      }
    }


    function mainLoop () {
      Game.clock.tick();
      EventHub.trigger("world.step");
      Game.actionbox.collisions();
      Game.viewport.render();
      requestAnimationFrame(mainLoop);
    }


    $(function () {
      $canvas = $("#game-canvas");
      Game.keys = new KeyPoll();
      Game.actionbox = new ActionBox({
        dimensions: ACTIONBOX_DIMENSIONS,
        origin: { x: 0, y: 0 }
      });
      Game.viewport = new Viewport({
        dimensions: VIEWPORT_DIMENSIONS,
        origin: { x: 0, y: 0 },
        canvasID: "#game-canvas",
        backgroundColor: "#224477",
        availableSpace: { width: 1, height: 1 }
      });
      Game.clock = new FrameClock();

      planktonBox = new PlanktonBox({
        dimensions: VIEWPORT_DIMENSIONS,
        origin: { x: 0, y: 0 }
      });

      $.ajax({
        async: false,
        type: "GET",
        url: "/sprite/all",
        dataType: "json",
        success: function (data) {
          SpriteArchive.load(data);

          sub = new Submersible({
            center: {
              x: Math.floor(VIEWPORT_DIMENSIONS.width * 0.5),
              y: Math.floor(VIEWPORT_DIMENSIONS.height * 0.5)
            },
            frameClock: Game.clock,
            keypoll: Game.keys
          });

          tigerSchoolRight = new FishSchool({
            sprite: SpriteArchive.get("tiger-fish-right"),
            center: {
              x: Math.floor(VIEWPORT_DIMENSIONS.width * 0.75),
              y: Math.floor(VIEWPORT_DIMENSIONS.height * 0.66)
            },
            layer: Layer.frontFocus,
            count: 30,
            density: 1,
            frameClock: Game.clock,
            velocity: { x: 1.5, y: 0.1 }
          });

          surgeonSchoolLeft = new FishSchool({
            sprite: SpriteArchive.get("surgeon-fish-left"),
            center: {
              x: Math.floor(VIEWPORT_DIMENSIONS.width * 0.75),
              y: Math.floor(VIEWPORT_DIMENSIONS.height * 0.33)
            },
            layer: Layer.frontFocus,
            count: 20,
            density: 1.5,
            frameClock: Game.clock,
            velocity: { x: -1.5, y: -1 }
          });

          octopus = new Octopus({
            center: {
              x: Math.floor(VIEWPORT_DIMENSIONS.width * 0.5),
              y: Math.floor(VIEWPORT_DIMENSIONS.height * 1.25)
            },
            layer: Layer.rearFocus,
            frameClock: Game.clock,
            velocity: { x: 0, y: -0.5 }
          });

          new Follower(sub, [{ frame: Game.viewport, followRadius: 25 },
                             { frame: Game.actionbox, followRadius: 0 },
                             { frame: planktonBox, followRadius: 25 }]);

          requestAnimationFrame(mainLoop);
        }
      });

      sizeCanvas();
 
      $(window).resize(function() {
        sizeCanvas();
      });
    });
  }
);
