var assert = require('assert');
var MockEditableCanvas = require('../graphics/mockeditablecanvas');
var requirejs = require('requirejs');
var sinon = require('sinon');
var _ = require('underscore');

requirejs.config({
  baseUrl: 'public/scripts',
  nodeRequire: require,
  paths: {
    underscore: 'bower_components/underscore-amd/underscore-min'
  }
});

var Color = requirejs('core/graphics/color');
var Value = requirejs('pixeleditor/actions/value');
var GridModelBuilder = requirejs('pixeleditor/controller/gridmodelbuilder');
var GridModel = requirejs('pixeleditor/model/gridmodel');
var IdentityConverter =
    requirejs('pixeleditor/model/converters/identityconverter');
var Encoder = requirejs('core/util/encoder');

var booleanValidator = function (newBoolean) {
  return !!newBoolean;
};
var colorObjectValidator = function (newColorObject) {
  if (newColorObject && Color.isValid(newColorObject.color)) {
    return { color: Color.sanitize(newColorObject.color) };
  }
  return null;
};
var dimensionValidator = function (newDimensions) {
  var sanitizedDimensions = _.pick(newDimensions, 'width', 'height');
  if (isNaN(sanitizedDimensions.width) ||
      isNaN(sanitizedDimensions.height)) {
    return null;
  }
  return sanitizedDimensions;
};


// Helper function makes multiple edits to given modelBuilder
function makeEdits(modelBuilder, activeColorValue) {
  activeColorValue.setValue({ color: '#000000' });
  modelBuilder.setAction(GridModelBuilder.CONTROLLER_ACTIONS.SET);
  modelBuilder.addLocationToCurrentChange({ x: 0, y: 1 });
  modelBuilder.addLocationToCurrentChange({ x: 1, y: 0 });
  modelBuilder.addLocationToCurrentChange({ x: 1, y: 1 });
  modelBuilder.commitCurrentChange();

  activeColorValue.setValue({ color: '#FF0000' });
  modelBuilder.addLocationToCurrentChange({ x: 0, y: 0 });
  modelBuilder.commitCurrentChange();

  modelBuilder.setAction(GridModelBuilder.CONTROLLER_ACTIONS.CLEAR);
  modelBuilder.addLocationToCurrentChange({ x: 1, y: 1 });
  modelBuilder.commitCurrentChange();
}


function assertElementArraysEqual(
    expectedElements, actualElements, dimensions) {
  if (expectedElements.length !== actualElements.length) {
    throw new Error('Element arrays not equivalent lengths');
  }

  expectedElements = _.sortBy(expectedElements, function (e) {
    return Encoder.coordToScalar(e, dimensions);
  });
  actualElements = _.sortBy(actualElements, function (e) {
    return Encoder.coordToScalar(e, dimensions);
  });

  var zipped = _.zip(expectedElements, actualElements);

  _.each(zipped, function (pair) {
    if (!_.isEqual(pair[0], pair[1])) {
      throw new Error(
        'Element arrays not equal:\nExpected: ' +
        JSON.stringify(expectedElements) + '\nActual:' +
        JSON.stringify(actualElements));
    }
  });
}


function assertModelForBuilderHasElements(gridModel, modelBuilder, elements) {
  var modelElements = gridModel.getElements(modelBuilder, []);
  assertElementArraysEqual(
      elements, modelElements, modelBuilder.getDimensions());
}


describe('GridModelBuilder', function () {
  var gridModel;
  var mockCanvas;
  var activeColorValue;
  var defaultColorValue;
  var dimensionsValue;
  var zoomValue;
  var modelBuilder;

  beforeEach(function () {
    var dimensions = { width: 3, height: 3 };
    gridModel = new GridModel();
    mockCanvas = new MockEditableCanvas(dimensions, '#FFFFFF');
    activeColorValue = new Value({ color: '#000000' }, colorObjectValidator);
    defaultColorValue = new Value({ color: '#FFFFFF' }, colorObjectValidator);
    dimensionsValue = new Value(dimensions, dimensionValidator);
    zoomValue = new Value(false, booleanValidator);
    modelBuilder = new GridModelBuilder(
      gridModel, mockCanvas, defaultColorValue, activeColorValue,
      dimensionsValue, zoomValue, IdentityConverter);
  });


  it('should clear model on GridModelBuilder#clear', function () {
    makeEdits(modelBuilder, activeColorValue);
    modelBuilder.clear();
    assertModelForBuilderHasElements(gridModel, modelBuilder, []);
  });


  describe('commitCurrentChange', function () {
    context('when a current change is present', function () {
      it('should apply the current change to the grid model', function () {
        var applyChangesSpy = sinon.spy(gridModel, 'applyChanges');
        var elements = [
          { x: 0, y: 1, color: '#000000' },
          { x: 1, y: 0, color: '#000000' },
          { x: 1, y: 1, color: '#000000' },
        ];

        activeColorValue.setValue({ color: '#000000' });
        modelBuilder.setAction(GridModelBuilder.CONTROLLER_ACTIONS.SET);
        modelBuilder.addLocationToCurrentChange({ x: 0, y: 1 });
        modelBuilder.addLocationToCurrentChange({ x: 1, y: 0 });
        modelBuilder.addLocationToCurrentChange({ x: 1, y: 1 });

        modelBuilder.commitCurrentChange();

        var expectedChange = {
          action: GridModelBuilder.CONTROLLER_ACTIONS.SET,
          elements: elements,
          origin: { x: 0, y: 0 }
        };

        assert(applyChangesSpy.calledOnce);
        assert(applyChangesSpy.calledWith([expectedChange]));
      });

      it('should do nothing when the current change does not exist',
          function () {
        var applyChangesSpy = sinon.spy(gridModel, 'applyChanges');

        modelBuilder.setAction(GridModelBuilder.CONTROLLER_ACTIONS.NONE);
        modelBuilder.addLocationToCurrentChange({ x: 0, y: 1 });

        modelBuilder.commitCurrentChange();

        assert(!applyChangesSpy.called);
      });
    });


    context('when applying different edits', function () {
      it('should add elements with "set" action', function () {
        activeColorValue.setValue({ color: '#000000' });
        modelBuilder.setAction(GridModelBuilder.CONTROLLER_ACTIONS.SET);
        modelBuilder.addLocationToCurrentChange({ x: 0, y: 1 });
        modelBuilder.commitCurrentChange();
        modelBuilder.addLocationToCurrentChange({ x: 1, y: 0 });
        modelBuilder.commitCurrentChange();
        modelBuilder.addLocationToCurrentChange({ x: 1, y: 1 });
        modelBuilder.commitCurrentChange();

        var elements = [
          { x: 1, y: 0, color: '#000000' },
          { x: 0, y: 1, color: '#000000' },
          { x: 1, y: 1, color: '#000000' },
        ];
        assertModelForBuilderHasElements(gridModel, modelBuilder, elements);
      });

      it('should remove elements with "clear" action', function () {
        activeColorValue.setValue({ color: '#000000' });
        modelBuilder.setAction(GridModelBuilder.CONTROLLER_ACTIONS.SET);
        modelBuilder.addLocationToCurrentChange({ x: 0, y: 1 });
        modelBuilder.addLocationToCurrentChange({ x: 1, y: 0 });
        modelBuilder.addLocationToCurrentChange({ x: 1, y: 1 });
        modelBuilder.commitCurrentChange();

        modelBuilder.setAction(GridModelBuilder.CONTROLLER_ACTIONS.CLEAR);
        modelBuilder.addLocationToCurrentChange({ x: 1, y: 1 });
        modelBuilder.commitCurrentChange();

        var elements = [
          { x: 0, y: 1, color: '#000000' },
          { x: 1, y: 0, color: '#000000' }
        ];
        assertModelForBuilderHasElements(gridModel, modelBuilder, elements);
      });

      it('should fill elements with "fill" action', function () {
        activeColorValue.setValue({ color: '#000000' });
        modelBuilder.setAction(GridModelBuilder.CONTROLLER_ACTIONS.SET);
        modelBuilder.addLocationToCurrentChange({ x: 0, y: 2 });
        modelBuilder.addLocationToCurrentChange({ x: 1, y: 2 });
        modelBuilder.addLocationToCurrentChange({ x: 2, y: 0 });
        modelBuilder.addLocationToCurrentChange({ x: 2, y: 1 });
        modelBuilder.commitCurrentChange();

        activeColorValue.setValue({ color: '#FF0000' });
        modelBuilder.setAction(GridModelBuilder.CONTROLLER_ACTIONS.FILL);
        modelBuilder.addLocationToCurrentChange({ x: 0, y: 0 });
        modelBuilder.commitCurrentChange();

        var elements = [
          { x: 0, y: 0, color: '#FF0000' }, { x: 0, y: 1, color: '#FF0000' },
          { x: 0, y: 2, color: '#000000' }, { x: 1, y: 0, color: '#FF0000' },
          { x: 1, y: 1, color: '#FF0000' }, { x: 1, y: 2, color: '#000000' },
          { x: 2, y: 0, color: '#000000' }, { x: 2, y: 1, color: '#000000' }
        ];
        assertModelForBuilderHasElements(gridModel, modelBuilder, elements);
      });

      it('should shift elements on "shift" action', function () {
        activeColorValue.setValue({ color: '#000000' });
        modelBuilder.setAction(GridModelBuilder.CONTROLLER_ACTIONS.SET);
        modelBuilder.addLocationToCurrentChange({ x: 0, y: 1 });
        modelBuilder.addLocationToCurrentChange({ x: 1, y: 1 });
        modelBuilder.addLocationToCurrentChange({ x: 1, y: 0 });
        modelBuilder.commitCurrentChange();

        modelBuilder.setAction(GridModelBuilder.CONTROLLER_ACTIONS.SHIFT);
        modelBuilder.addLocationToCurrentChange({ x: 0, y: 0 });
        modelBuilder.addLocationToCurrentChange({ x: 1, y: 0 });
        modelBuilder.addLocationToCurrentChange({ x: 1, y: 1 });
        modelBuilder.addLocationToCurrentChange({ x: 0, y: 1 });
        modelBuilder.commitCurrentChange();

        var elements = [
          { x: 0, y: 2, color: '#000000' },
          { x: 1, y: 2, color: '#000000' },
          { x: 1, y: 1, color: '#000000' }
        ];
        assertModelForBuilderHasElements(gridModel, modelBuilder, elements);
      });
    });
  });


  describe('exportModel', function () {
    beforeEach(function () {
      sinon.spy(IdentityConverter, 'fromCommonModelFormat');
    });

    it('should run model through converter and convert to JSON', function () {
      makeEdits(modelBuilder, activeColorValue);
      var exportedModelJSON = modelBuilder.exportModel();
      var exportedModel = JSON.parse(exportedModelJSON);

      assertModelForBuilderHasElements(
          gridModel, modelBuilder, exportedModel.elements);
      assert(_.isEqual(
          exportedModel.defaultElement, defaultColorValue.getValue()));
      assert(_.isEqual(
          exportedModel.currentElement, activeColorValue.getValue()));
      assert(_.isEqual(exportedModel.dimensions, dimensionsValue.getValue()));
      assert(IdentityConverter.fromCommonModelFormat.calledOnce);
    });

    it('should export the visible area rather than the full area covered by ' +
        'the dimensions.', function () {
      makeEdits(modelBuilder, activeColorValue);

      var offset = { x: 1, y: 2 };
      var dimensions = { width: 2, height: 1 };
      modelBuilder.zoomIn(offset, dimensions);

      var exportedModelJSON = modelBuilder.exportModel();
      var exportedModel = JSON.parse(exportedModelJSON);

      assertModelForBuilderHasElements(
          gridModel, modelBuilder, exportedModel.elements);

      assert(_.isEqual(
          exportedModel.defaultElement, defaultColorValue.getValue()));
      assert(_.isEqual(
          exportedModel.currentElement, activeColorValue.getValue()));
      assert(!_.isEqual(exportedModel.dimensions, dimensionsValue.getValue()));
      assert(_.isEqual(exportedModel.dimensions, modelBuilder.getDimensions()));

      assert(IdentityConverter.fromCommonModelFormat.calledOnce);
    });

    afterEach(function () {
      IdentityConverter.fromCommonModelFormat.restore();
    });
  });



  describe('importModel', function () {
    it('should import the model object into the builder', function () {
      var modelObj = {
        defaultElement: { color: '#777777' },
        currentElement: { color: '#AAAAAA' },
        dimensions: { width: 10, height: 10 },
        elements: [
          { x: 0, y: 0, color: '#FFFFFF' },
          { x: 5, y: 5, color: '#00FF00' },
          { x: 9, y: 9, color: '#0000FF' }
        ]
      };

      modelBuilder.importModel(JSON.stringify(modelObj));

      assertModelForBuilderHasElements(
          gridModel, modelBuilder, modelObj.elements);
      assert(_.isEqual(
          modelObj.defaultElement, defaultColorValue.getValue()));
      assert(_.isEqual(
          modelObj.currentElement, activeColorValue.getValue()));
      assert(_.isEqual(modelObj.dimensions, dimensionsValue.getValue()));
    });

    it('should gracefully handle bad fields for non-element fields in the ' +
        'model object', function () {
      var modelObj = {
        defaultElement: undefined,
        currentElement: { color: '#this is not a color' },
        dimensions: { width: null, height: 'hi!' },
        elements: [
          { x: 0, y: 0, color: '#FFFFFF' },
          { x: 1, y: 1, color: '#00FF00' },
          { x: 2, y: 2, color: '#0000FF' }
        ]
      };

      modelBuilder.importModel(JSON.stringify(modelObj));

      assertModelForBuilderHasElements(
          gridModel, modelBuilder, modelObj.elements);
      assert(_.isEqual(
          { color: '#FFFFFF' }, defaultColorValue.getValue()));
      assert(_.isEqual(
          { color: '#000000' }, activeColorValue.getValue()));
      assert(_.isEqual({ width: 3, height: 3 }, dimensionsValue.getValue()));

    });
  });


  it('should paint all elements within builder frame to the canvas',
      function () {
    makeEdits(modelBuilder, activeColorValue);
    modelBuilder.paint();

    var expectedElements = [
      { x: 0, y: 1, color: '#000000' },
      { x: 1, y: 0, color: '#000000' },
      { x: 0, y: 0, color: '#FF0000' },
    ];

    assertElementArraysEqual(
        mockCanvas.getRenderedPixels(), expectedElements,
        dimensionsValue.getValue());
  });


  describe('redo', function () {
    context('when there are no redos in the redo stack', function () {
      it('should do nothing', function () {
        assert(!modelBuilder.hasRedos());
        modelBuilder.redo();
        assertModelForBuilderHasElements(gridModel, modelBuilder, []);
      });
    });


    context('when there are redos in the redo stack', function () {
      it('should process redos on the stack in order', function () {
        makeEdits(modelBuilder, activeColorValue);
        assert(!modelBuilder.hasRedos());

        // Ensure that SHIFT change is also properly redone.
        modelBuilder.setAction(GridModelBuilder.CONTROLLER_ACTIONS.SHIFT);
        modelBuilder.addLocationToCurrentChange({ x: 0, y: 0 });
        modelBuilder.addLocationToCurrentChange({ x: 1, y: 1 });
        modelBuilder.commitCurrentChange();

        modelBuilder.undo();
        modelBuilder.undo();
        modelBuilder.undo();
        assert(modelBuilder.hasRedos());

        var expectedElements = [
          { x: 0, y: 0, color: '#FF0000' },
          { x: 0, y: 1, color: '#000000' },
          { x: 1, y: 0, color: '#000000' },
          { x: 1, y: 1, color: '#000000' }
        ];

        modelBuilder.redo();
        assertModelForBuilderHasElements(
            gridModel, modelBuilder, expectedElements);

        expectedElements.splice(3, 1);
        modelBuilder.redo();
        assertModelForBuilderHasElements(
            gridModel, modelBuilder, expectedElements);

        expectedElements = _.map(expectedElements, function (ee) {
          return { x: ee.x + 1, y: ee.y + 1, color: ee.color };
        });

        modelBuilder.redo();
        assert(!modelBuilder.hasRedos());
        assertModelForBuilderHasElements(
            gridModel, modelBuilder, expectedElements);
      });
    });
  });


  it('should update dimensions and reset builder frame origin on dimensions ' +
      'value change', function () {
    modelBuilder.move({ x: 1000, y: 1000 }, 'absolute');
    dimensionsValue.setValue({ width: 100, height: 100 });
    assert(_.isEqual(dimensionsValue.getValue(), modelBuilder.getDimensions()));
    assert(_.isEqual(dimensionsValue.getValue(), mockCanvas.getDimensions()));
    assert(_.isEqual({ x: 0, y: 0 }, modelBuilder.getOrigin()));
  });


  it('should update frame and canvas dimensions but not dimensions value on ' +
      'resize', function () {
    var dimensions = { width: 200, height: 100 };
    modelBuilder.resize(dimensions);
    assert(_.isEqual(dimensions, modelBuilder.getDimensions()));
    assert(_.isEqual(dimensions, mockCanvas.getDimensions()));
    assert(!_.isEqual(dimensions, dimensionsValue.getValue()));
  });

  
  it('should undo last committed change on undo', function () {
    assert(!modelBuilder.hasUndos());

    makeEdits(modelBuilder, activeColorValue);

    assert(modelBuilder.hasUndos());
    modelBuilder.undo();

    var expectedElements = [
      { x: 0, y: 0, color: '#FF0000' },
      { x: 0, y: 1, color: '#000000' },
      { x: 1, y: 0, color: '#000000' },
      { x: 1, y: 1, color: '#000000' }
    ];

    assertModelForBuilderHasElements(gridModel, modelBuilder, expectedElements);
  });


  describe('zoomIn', function () {
    it('should change the builders dimensions and origin but not the ' +
        'dimensions value on zoomIn', function () {
      var offset = { x: 1, y: 2 };
      var dimensions = { width: 2, height: 1 };

      modelBuilder.zoomIn(offset, dimensions);

      assert(_.isEqual(offset, modelBuilder.getOrigin()));
      assert(_.isEqual(dimensions, modelBuilder.getDimensions()));
      assert(_.isEqual(dimensions, mockCanvas.getDimensions()));
      assert(!_.isEqual(dimensions, dimensionsValue.getValue()));
    });


    it('should be reversable by "undo"', function () {
      var offset = { x: 1, y: 2 };
      var dimensions = { width: 2, height: 1 };

      modelBuilder.zoomIn(offset, dimensions);
      modelBuilder.undo();

      assert(_.isEqual({ x: 0, y: 0 }, modelBuilder.getOrigin()));
      assert(_.isEqual(
          dimensionsValue.getValue(), modelBuilder.getDimensions()));
      assert(_.isEqual(dimensionsValue.getValue(), mockCanvas.getDimensions()));
      assert(!_.isEqual(dimensions, dimensionsValue.getValue()));
    });
  });


  describe('zoomOut', function () {
    it('should reset the builders dimensions to the dimensions value and ' +
        'origin to the absolute origin on zoomOut', function () {
      var offset = { x: 1, y: 2 };
      var dimensions = { width: 2, height: 1 };

      modelBuilder.zoomIn(offset, dimensions);

      modelBuilder.zoomOut();

      assert(_.isEqual({ x: 0, y: 0 }, modelBuilder.getOrigin()));
      assert(_.isEqual(
          dimensionsValue.getValue(), modelBuilder.getDimensions()));
      assert(_.isEqual(dimensionsValue.getValue(), mockCanvas.getDimensions()));
      assert(!_.isEqual(dimensions, dimensionsValue.getValue()));
    });


    it('should be reversable by "undo"', function () {
      var offset = { x: 1, y: 2 };
      var dimensions = { width: 2, height: 1 };

      modelBuilder.zoomIn(offset, dimensions);

      modelBuilder.zoomOut();
      modelBuilder.undo();

      assert(_.isEqual(offset, modelBuilder.getOrigin()));
      assert(_.isEqual(dimensions, modelBuilder.getDimensions()));
      assert(_.isEqual(dimensions, mockCanvas.getDimensions()));
      assert(!_.isEqual(dimensions, dimensionsValue.getValue()));
    });
  });
});
