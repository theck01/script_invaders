define(
    ['underscore', 'core/util/frame', 'core/util/encoder',
     'pixeleditor/model/gridmodel'],
  function(_, Frame, Encoder, GridModel){
    // GridModelBuilder provides methods for creating models in the browser and
    // exporting that model as a JSON string, using a PixelCanvas instance to
    // render a representation of the model in progress
    //
    // Constructor Arguments:
    //   model: GridModel instance
    //   pixelCanvas: PixelCanvas instance
    //   defaultElementValue: Value storing the default element for all
    //       unspecified elements within the model, containing at least 'color'
    //       field
    //   currentElementValue: Value storing the current element to begin
    //       building the model, containing at least 'color' field.
    //   converter: A converter object with toGridModelFormat and
    //       fromGridModelFormat methods
    var GridModelBuilder = function (
        model, pixelCanvas, defaultElementValue, currentElementValue,
        dimensionsValue, zoomValue, converter) {
      this._action = GridModelBuilder.CONTROLLER_ACTIONS.SET;
      this._converter = converter;
      this._currentChange = null; // always null unless mouse is down in canvas
      this._currentElementValue = currentElementValue;
      this._defaultElementValue = defaultElementValue;
      this._dimensionsValue = dimensionsValue;
      this._zoomValue = zoomValue;
      this._model = model;
      this._canvas = pixelCanvas;
      this._redoStack = [];
      this._undoStack = [];

      Frame.call(this, dimensionsValue.getValue(), { x: 0, y: 0 });

      this._dimensionsValue.addValueChangeHandler(
          this._onDimensionChange.bind(this));
      
      var gridModelBuilder = this;
      this._defaultElementValue.addValueChangeHandler(function (e) {
        gridModelBuilder._canvas.setBackgroundColor(e.color);
        gridModelBuilder.paint();
      });
    };
    GridModelBuilder.prototype = Object.create(Frame.prototype);
    GridModelBuilder.prototype.constructor = GridModelBuilder;


    // Actions that the controller can perform on the model.
    GridModelBuilder.CONTROLLER_ACTIONS = {
      CLEAR: GridModel.MODEL_ACTIONS.CLEAR,
      CLEAR_ALL: 'clear all',
      FILL: 'fill',
      GET: 'get',
      NONE: 'none',
      POSITION: 'position',
      SET: GridModel.MODEL_ACTIONS.SET,
      SHIFT: 'shift',
      ZOOM: 'zoom'
    };


    // addLoctionToCurrentChange adds the location to the current change, which
    // will affect the model based upon the current action.
    //
    // Arguments:
    //     loc: An object with 'x' and 'y' fields.
    GridModelBuilder.prototype.addLocationToCurrentChange = function (loc) {
      switch (this._action) {
        case GridModelBuilder.CONTROLLER_ACTIONS.NONE:
          this._currentChange = null;
          break;

        case GridModelBuilder.CONTROLLER_ACTIONS.GET:
          this._currentChange = null;
          var element = _.find(this._model.getElements(this), function (e) {
            return e.x === loc.x && e.y === loc.y;
          });
          element = element || this._defaultElementValue.getValue();
          this._currentElementValue.setValue(element);
          break;

        case GridModelBuilder.CONTROLLER_ACTIONS.SET:
        case GridModelBuilder.CONTROLLER_ACTIONS.CLEAR:
          var newElement = _.extend(
              _.clone(this._currentElementValue.getValue()), loc);
          if (!this._currentChange) {
            this._currentChange = {
              action: this._action,
              elements: [newElement],
              origin: _.clone(this.getOrigin())
            };
          }
          else {
            this._currentChange.elements.push(newElement);
          }
          this.paint();
          break;
      
        case GridModelBuilder.CONTROLLER_ACTIONS.FILL:
          var fillElement = _.extend(
              _.clone(this._currentElementValue.getValue()), loc);
          this._currentChange = {
            action: this._action,
            elements: [fillElement],
            origin: _.clone(this.getOrigin())
          };
          this.paint();
          break;

        case GridModelBuilder.CONTROLLER_ACTIONS.SHIFT:
          if (this._currentChange) {
            var shiftTerminator = this._currentChange.elements[1];
            var offset =
                { x: loc.x - shiftTerminator.x, y: loc.y - shiftTerminator.y };

            // If the shift termination point changed then shift the model and
            // repaint the screen.
            if (offset.x !== 0 || offset.y !== 0) {
              this._currentChange.elements[1] = _.clone(loc);
              this._model.shiftElements(offset);
              this.paint();
            }
          }
          else {
            this._currentChange = {
              action: this._action,
              elements: [ _.clone(loc), _.clone(loc) ],
              origin: _.clone(this.getOrigin())
            };
          }
          break;
      }
    };


    // clear removes all elements from the model within the GridModelBuilder
    // frame.
    GridModelBuilder.prototype.clear = function () {
      this._commitChanges([{
        action: GridModelBuilder.CONTROLLER_ACTIONS.CLEAR_ALL,
        elements: []
      }]);
      this.paint();
    };


    // _commitChanges commits the argument changes, or the current changeset
    // being constructed
    //
    // Arguments:
    //   changes: Array of changes to commit, which are objects with 'action'
    //       field (any GridModel.MODEL_ACTION) and 'elements' field. Defaults
    //       to an array containing currentChange.
    //   preserveRedoStack: Whether to preserve the redoStack on commit.
    //   opt_skipApplyingShiftChanges: Whether to skip applying SHIFT
    //       controller actions to the model, default false.
    GridModelBuilder.prototype._commitChanges = function (
        changes, preserveRedoStack, opt_skipApplyingShiftChanges) {
      var modelChanges = this._preprocessChanges(
          changes, !opt_skipApplyingShiftChanges);
      this._model.applyChanges(modelChanges);
      if (!preserveRedoStack) this._redoStack = [];
      this._undoStack.push(changes);
    };


    // commitCurrentChange commits the current change as a persistent
    // alteration to the model.
    GridModelBuilder.prototype.commitCurrentChange = function () {
      if (this._currentChange) {
        this._commitChanges(
            [this._currentChange], false /* preserveRedoStack */,
            true /* opt_skipApplyingShiftChanges */);
        this._currentChange = null;
      }
    };


    // exportModel generates a JSON string of all elements set in the model
    // with additional meta-data about minimum model size required to
    // capture all elements
    //
    // Returns a JSON string representing an object the following fields:
    //   defaultElement: defaultElement used when editing
    //   currentElement: currentElement used during edits
    //   dimensions: dimensions of the model used during editing, object with
    //               width and height fields
    //   elements: An array of objects with at least x, y, and color fields
    GridModelBuilder.prototype.exportModel = function () {
      // Use the visible dimensions of the model builder to export the model.
      // If the model builder has a zoom applied the visible dimensions and the
      // dimensions value may be out of sync.
      var model = {
        defaultElement: this._defaultElementValue.getValue(),
        currentElement: this._currentElementValue.getValue(),
        dimensions: this.getDimensions(),
        elements: this._model.getElements(this)
      };

      return JSON.stringify(this._converter.fromCommonModelFormat(model));
    };


    // _fillArea performs a fill operation on a region of elements of the same
    // value.
    //
    // Arguments:
    //   elements: The elements existing in the current state of the model.
    //   fillElement: The element to fill the open space.
    // Returns an array of elements that are added by the fill operation
    GridModelBuilder.prototype._fillArea  = function (elements, fillElement) {
      var dim = this._dimensionsValue.getValue();
      var filledElements = Object.create(null);
      var locationStack = [fillElement];

      var existingElementMap = _.reduce(elements, function (map, e) {
        map[Encoder.coordToScalar(e, dim)] = e;
        return map;
      }, Object.create(null));

      var replacedElement = existingElementMap[Encoder.coordToScalar(
          fillElement, dim)];
      replacedElement = replacedElement || { color: undefined };

      while (locationStack.length > 0) {
        var pos = locationStack.pop();
        var scalarPos = Encoder.coordToScalar(pos, dim);

        if (pos.x >= dim.width || pos.x < 0 || pos.y >= dim.height ||
            pos.y < 0) {
          continue;
        }

        var existingElement = existingElementMap[scalarPos] ||
                              { color: undefined };

        if (existingElement.color === replacedElement.color &&
            filledElements[scalarPos] === undefined) {
          var newElement = _.extend(
              _.clone(fillElement), { x: pos.x, y: pos.y });
          filledElements[scalarPos] = newElement;
          locationStack = locationStack.concat([
            { x: pos.x+1, y: pos.y }, { x: pos.x-1, y: pos.y },
            { x: pos.x, y: pos.y+1 }, { x: pos.x, y: pos.y-1 }
          ]);
        }
      }

      return _.values(filledElements);
    };


    // _getModelElements returns the model elements contained within the bounds
    // of the GridModelBuilder frame
    //
    // Returns an array containing objects with at least 'x', 'y', and 'color'
    // fields
    GridModelBuilder.prototype._getModelElements = function () {
      var changes = this._currentChange ? [this._currentChange] : [];
      changes = this._preprocessChanges(changes);
      return this._model.getElements(this, changes);
    };


    // hasRedos returns whether there are redos available.
    GridModelBuilder.prototype.hasRedos = function () {
      return this._redoStack.length > 0;
    };


    // hasUndos returns whether there are undos available.
    GridModelBuilder.prototype.hasUndos = function () {
      return this._undoStack.length > 0;
    };


    // importModel loads an model JSON string saved using exportModel 
    GridModelBuilder.prototype.importModel = function (modelJSON) {
      var modelObj = this._converter.toCommonModelFormat(JSON.parse(modelJSON));
      if (!modelObj) return;

      this._defaultElementValue.setValue(modelObj.defaultElement);
      this._currentElementValue.setValue(modelObj.currentElement);
      this._dimensionsValue.setValue(modelObj.dimensions);
      this._commitChanges([
        {
          action: GridModelBuilder.CONTROLLER_ACTIONS.CLEAR_ALL,
          elements: [],
          origin: { x: 0, y: 0 }
        },
        {
          action: GridModelBuilder.CONTROLLER_ACTIONS.SET,
          elements: modelObj.elements,
          origin: { x: 0, y: 0 }
        }
      ], false /* preserveRedoStack */);

      // Clear the underlying canvas to prevent artifacts from earlier drawing.
      this._canvas.clear(true /* opt_clearBuffer */);
      this.paint();
    };


    // Dimension change handler updates model builder dimensions when the
    // dimension value changes.
    //
    // Argument:
    //     dimensions: Object with 'width' and 'height' fields.
    GridModelBuilder.prototype._onDimensionChange = function (dimensions) {
      var offset = { x: 0, y: 0 };

      this.move(offset, 'absolute');
      this.resize(dimensions);
      this._canvas.clear(true /* opt_clearBuffer */);
      this.paint();
    };


    // paint writes all stored pixels to the PixelCanvas and calls the
    // PixelCanvas' paint method
    GridModelBuilder.prototype.paint = function () {
      var elements = this._getModelElements();
      _.each(elements, function(e) {
        this._canvas.setPixel(e.x, e.y, e.color);
      }, this);

      this._canvas.markForRedraw();
    };


    // preprocessChanges converts GridModelBuilder changes into GridModel
    // changes.
    //
    // Arguments: 
    //     changes: Array of objects with 'action' and 'elements' fields
    //     opt_processShiftChanges: Whether to process SHIFT controller actions,
    //          default false.
    GridModelBuilder.prototype._preprocessChanges = function (
          changes, opt_processShiftChanges) {
      return _.reduce(changes, function (memo, c) {
        var modelChange = _.clone(c);
        switch (modelChange.action) {
          case GridModelBuilder.CONTROLLER_ACTIONS.CLEAR:
            modelChange.action = GridModel.MODEL_ACTIONS.CLEAR;
            break;

          case GridModelBuilder.CONTROLLER_ACTIONS.CLEAR_ALL:
            modelChange.action = GridModel.MODEL_ACTIONS.CLEAR_ALL;
            break;

          case GridModelBuilder.CONTROLLER_ACTIONS.FILL:
            var elementsToThisChange = this._model.getElements(this, memo);
            modelChange.action = GridModel.MODEL_ACTIONS.SET;
            modelChange.elements= this._fillArea(
                elementsToThisChange, modelChange.elements[0]);
            break;

          case GridModelBuilder.CONTROLLER_ACTIONS.SET:
            modelChange.action = GridModel.MODEL_ACTIONS.SET;
            break;

          case GridModelBuilder.CONTROLLER_ACTIONS.SHIFT:
            if (opt_processShiftChanges) {
              var shiftOrigin = modelChange.elements[0];
              var shiftTerminator = modelChange.elements[1];
              var offset = {
                x: shiftTerminator.x - shiftOrigin.x,
                y: shiftTerminator.y - shiftOrigin.y
              };
              this._model.shiftElements(offset);
            }
            // Return the memo early, shift changes should not be applied
            // directly to the model.
            return memo;

          case GridModelBuilder.CONTROLLER_ACTIONS.ZOOM:
            this.resize(c.dimensions);
            this.move(c.offset, 'absolute');
            this._zoomValue.setValue(c.zoomed);
            // Return the memo early, zooming should not affect model.
            return memo;

          default:
            throw Error('Bad controller action, cannot process change');
        }

        memo.push(modelChange);
        return memo;
      }, [], this);
    };


    // redo reapplys a change removed by an undo command if such a change
    // exists
    GridModelBuilder.prototype.redo = function () {
      if (this._redoStack.length === 0) return;
      var changes = this._redoStack.pop();
      this._commitChanges(changes, true /* preserveRedoStack */);
      this._canvas.clear(true /* opt_clearBuffer */);
      this.paint();
    };


    // resize resizes the number of meta-pixels available for drawing
    // on the canvas element
    //
    // Arguments:
    //   dimensions: object with 'width' and 'height' fields.
    GridModelBuilder.prototype.resize = function (dimensions){
      Frame.prototype.resize.call(this, dimensions);
      this._canvas.resize(dimensions);
      this.paint();
    };


    // setAction sets the action that will be performed when a pixel is
    // clicked on
    //
    // Arguments:
    //   actionString: One of the following strings -
    //       'clear', sets the element in the model at the location added to
    //           the change to the default element.
    //       'get', sets the value of the current element to the value of the
    //           element at the last location added to the change.
    //       'set', sets the element in the model at the location added to the 
    //           change to the current element.
    //       'fill', fills the like area around the location added to the
    //           change with the current element.
    //       'none', do nothing.
    GridModelBuilder.prototype.setAction = function (actionString) {
      if (_.has(_.invert(GridModelBuilder.CONTROLLER_ACTIONS), actionString)) {
        this._action = actionString;
      }
    };


    // undo removes the most recent change and places it in the redoStack
    GridModelBuilder.prototype.undo = function () {
      if (this._undoStack.length === 0) return;
      this._redoStack.push(this._undoStack.pop());

      // The default state of the application has no zoom.
      this.resize(this._dimensionsValue.getValue());
      this.move({ x: 0, y: 0 }, 'absolute');
      this._zoomValue.setValue(false);

      this._model.applyChanges([{ action: GridModel.MODEL_ACTIONS.CLEAR_ALL }]);
      _.each(this._undoStack, function (changes) {
        changes = this._preprocessChanges(
            changes, true /* opt_processShiftChanges */);
        this._model.applyChanges(changes);
      }, this);

      this._canvas.clear(true /* opt_clearBuffer */);
      this.paint();
    };


    // zoomIn sets the model builders frame to the given dimensions and offset,
    // preserving the action in the undo stack.
    //
    // Arguments:
    //     origin: The origin that the builder should occupy.
    //     dimensions: The dimensions that the builder should occupy.
    GridModelBuilder.prototype.zoomIn = function (origin, dimensions) {
      this._commitChanges([{
        action: GridModelBuilder.CONTROLLER_ACTIONS.ZOOM,
        offset: origin,
        dimensions: dimensions,
        zoomed: true
      }], false /* preserveRedoStack */);
    };


    // zoomOut sets the model builder's frame to the full canvas dimensions and
    // no offset.
    GridModelBuilder.prototype.zoomOut = function () {
      this._commitChanges([{
        action: GridModelBuilder.CONTROLLER_ACTIONS.ZOOM,
        offset: { x: 0, y: 0 },
        dimensions: this._dimensionsValue.getValue(),
        zoomed: false
      }], false /* preserveRedoStack */);
    };


    return GridModelBuilder;
  }
);
