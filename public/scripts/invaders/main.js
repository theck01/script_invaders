require.config({
  baseUrl: "scripts",
  paths: {
    bootstrap: "/bootstrap/dist/js/bootstrap.min",
    jquery: "/jquery/jquery.min",
    underscore: "/underscore-amd/underscore-min"
  }
});

require(["jquery", "core/graphics/spritearchive", "core/graphics/viewport",
         "invaders/actors/player", "invaders/actors/grunt",
         "invaders/actors/energyenemy", "core/interface/keypoll",
         "core/util/frameclock", "invaders/util/game",
         "invaders/scene/starfield", "invaders/world/world"],
  function($, SpriteArchive, Viewport, Player, Grunt, EnergyEnemy,
           KeyPoll, FrameClock, Game, Starfield, World){

    var DIMENSIONS = { width: 400, height: 300 };

    var $canvas;

    function sizeCanvas() {
      if ($canvas[0].width !== $(window).width() ||
          $canvas[0].height !== $(window).height()){
        $canvas[0].width = $(window).width();
        $canvas[0].height = $(window).height();
      }
    }

    function mainLoop() {
      Game.clock.tick();
      Game.world.timestep();
      Game.world.renderTo(Game.viewport);
      Game.viewport.paint();
      requestAnimationFrame(mainLoop);
    }

    $(function () {
      $canvas = $("#game-canvas");
      Game.keys = new KeyPoll();
      Game.viewport = new Viewport(DIMENSIONS, { x: 0, y: 0 }, "#game-canvas",
                                   "#000000");
      Game.clock = new FrameClock();

      var starfield = new Starfield(DIMENSIONS, { x: 0.5, y: 1 }, 0,
                                    Game.clock);
      Game.world = new World(DIMENSIONS, starfield);

      $.ajax({
        async: false,
        type: "GET",
        url: "/sprite/all",
        dataType: "json",
        success: function (data) {
          SpriteArchive.load(data);

          new Player({
            group: "Allies",
            center: {
              x: Math.floor(DIMENSIONS.width * 0.5),
              y: Math.floor(DIMENSIONS.height * 0.75)
            },
            layer: 2,
            noncollidables: ["Allies"],
            frameClock: Game.clock,
            keypoll: Game.keys
          });

          new Grunt({
            group: "Enemies",
            center: {
              x: Math.floor(DIMENSIONS.width * 0.67),
              y: Math.floor(DIMENSIONS.height * 0.25)
            },
            layer: 3,
            noncollidables: ["Enemies"],
            bounds: {
              leftmost: Math.floor(DIMENSIONS.width/2) + 25,
              rightmost: DIMENSIONS.width - 25,
              topmost: 25, bottommost: Math.floor(DIMENSIONS.height/2)
            },
            frameClock: Game.clock
          });

          new Grunt({
            group: "Enemies",
            center: {
              x: Math.floor(DIMENSIONS.width * 0.33),
              y: Math.floor(DIMENSIONS.height * 0.25)
            },
            layer: 3,
            noncollidables: ["Enemies"],
            bounds: {
              leftmost: 25, rightmost: Math.floor(DIMENSIONS.width/2) - 25,
              topmost: 25, bottommost: Math.floor(DIMENSIONS.height/2)
            },
            frameClock: Game.clock
          });

          new EnergyEnemy({
            group: "Enemies",
            center: {
              x: Math.floor(DIMENSIONS.width * 0.5),
              y: Math.floor(DIMENSIONS.height * 0.25)
            },
            layer: 1,
            noncollidables: ["Enemies"],
            frameClock: Game.clock
          });

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
