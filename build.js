(function e(t,n,r){function s(o,u){if(!n[o]){if(!t[o]){var a=typeof require=="function"&&require;if(!u&&a)return a(o,!0);if(i)return i(o,!0);var f=new Error("Cannot find module '"+o+"'");throw f.code="MODULE_NOT_FOUND",f}var l=n[o]={exports:{}};t[o][0].call(l.exports,function(e){var n=t[o][1][e];return s(n?n:e)},l,l.exports,e,t,n,r)}return n[o].exports}var i=typeof require=="function"&&require;for(var o=0;o<r.length;o++)s(r[o]);return s})({1:[function(require,module,exports){
/**
 * Use typed arrays if we can
 */

'use strict';

Object.defineProperty(exports, '__esModule', {
  value: true
});
var FastArray = typeof Uint32Array === 'undefined' ? Array : Uint32Array;

/**
 * Bit vector
 */

function createBv(sizeInBits) {
  return new FastArray(Math.ceil(sizeInBits / 32));
}

function setBit(v, idx) {
  var r = idx % 32;
  var pos = (idx - r) / 32;

  v[pos] |= 1 << r;
}

function clearBit(v, idx) {
  var r = idx % 32;
  var pos = (idx - r) / 32;

  v[pos] &= ~(1 << r);
}

function getBit(v, idx) {
  var r = idx % 32;
  var pos = (idx - r) / 32;

  return !!(v[pos] & 1 << r);
}

/**
 * Exports
 */

exports['default'] = {
  createBv: createBv,
  setBit: setBit,
  clearBit: clearBit,
  getBit: getBit
};
module.exports = exports['default'];
},{}],2:[function(require,module,exports){
'use strict';

Object.defineProperty(exports, "__esModule", {
  value: true
});
exports.Actions = undefined;
exports.diffAttributes = diffAttributes;
exports.diffChildren = diffChildren;
exports.diffNode = diffNode;

var _utils = require('../shared/utils');

var _dift = require('dift');

var diffActions = _interopRequireWildcard(_dift);

var _unionType = require('union-type');

var _unionType2 = _interopRequireDefault(_unionType);

function _interopRequireDefault(obj) { return obj && obj.__esModule ? obj : { default: obj }; }

function _interopRequireWildcard(obj) { if (obj && obj.__esModule) { return obj; } else { var newObj = {}; if (obj != null) { for (var key in obj) { if (Object.prototype.hasOwnProperty.call(obj, key)) newObj[key] = obj[key]; } } newObj.default = obj; return newObj; } }

var Any = function Any() {
  return true;
};
var Path = function Path() {
  return String;
};

/**
 * Patch actions
 */

var Actions = exports.Actions = (0, _unionType2.default)({
  setAttribute: [String, Any, Any],
  removeAttribute: [String, Any],
  insertChild: [Any, Number, Path],
  removeChild: [Number],
  updateChild: [Number, Array],
  updateChildren: [Array],
  insertBefore: [Number],
  replaceNode: [Any, Any, Path],
  removeNode: [Any],
  sameNode: [],
  updateThunk: [Any, Any, Path]
});

/**
 * Diff two attribute objects and return an array of actions that represent
 * changes to transform the old object into the new one.
 */

function diffAttributes(previous, next) {
  var setAttribute = Actions.setAttribute;
  var removeAttribute = Actions.removeAttribute;

  var changes = [];
  var pAttrs = previous.attributes;
  var nAttrs = next.attributes;

  for (var name in nAttrs) {
    if (nAttrs[name] !== pAttrs[name]) {
      changes.push(setAttribute(name, nAttrs[name], pAttrs[name]));
    }
  }

  for (var name in pAttrs) {
    if (!(name in nAttrs)) {
      changes.push(removeAttribute(name, pAttrs[name]));
    }
  }

  return changes;
}

/**
 * Compare two arrays of virtual nodes and return an array of actions
 * to transform the left into the right. A starting path is supplied that use
 * recursively to build up unique paths for each node.
 */

function diffChildren(previous, next, path) {
  var insertChild = Actions.insertChild;
  var updateChild = Actions.updateChild;
  var removeChild = Actions.removeChild;
  var insertBefore = Actions.insertBefore;
  var updateChildren = Actions.updateChildren;
  var CREATE = diffActions.CREATE;
  var UPDATE = diffActions.UPDATE;
  var MOVE = diffActions.MOVE;
  var REMOVE = diffActions.REMOVE;

  var previousChildren = (0, _utils.groupByKey)(previous.children);
  var nextChildren = (0, _utils.groupByKey)(next.children);
  var key = function key(a) {
    return a.key;
  };
  var changes = [];

  function effect(type, prev, next, pos) {
    var nextPath = next ? (0, _utils.createPath)(path, next.key == null ? next.index : next.key) : null;
    switch (type) {
      case CREATE:
        {
          changes.push(insertChild(next.item, pos, nextPath));
          break;
        }
      case UPDATE:
        {
          var actions = diffNode(prev.item, next.item, nextPath);
          if (actions.length > 0) {
            changes.push(updateChild(prev.index, actions));
          }
          break;
        }
      case MOVE:
        {
          var actions = diffNode(prev.item, next.item, nextPath);
          actions.push(insertBefore(pos));
          changes.push(updateChild(prev.index, actions));
          break;
        }
      case REMOVE:
        {
          changes.push(removeChild(prev.index));
          break;
        }
    }
  }

  (0, diffActions.default)(previousChildren, nextChildren, effect, key);

  return updateChildren(changes);
}

/**
 * Compare two virtual nodes and return an array of changes to turn the left
 * into the right.
 */

function diffNode(prev, next, path) {
  var changes = [];
  var replaceNode = Actions.replaceNode;
  var setAttribute = Actions.setAttribute;
  var sameNode = Actions.sameNode;
  var removeNode = Actions.removeNode;
  var updateThunk = Actions.updateThunk;

  // No left node to compare it to
  // TODO: This should just return a createNode action

  if (prev === null || prev === undefined) {
    throw new Error('Left node must not be null or undefined');
  }

  // Bail out and skip updating this whole sub-tree
  if (prev === next) {
    changes.push(sameNode());
    return changes;
  }

  // Remove
  if (prev != null && next == null) {
    changes.push(removeNode(prev));
    return changes;
  }

  // Replace
  if (prev.type !== next.type) {
    changes.push(replaceNode(prev, next, path));
    return changes;
  }

  // Text
  if ((0, _utils.isText)(next)) {
    if (prev.nodeValue !== next.nodeValue) {
      changes.push(setAttribute('nodeValue', next.nodeValue, prev.nodeValue));
    }
    return changes;
  }

  // Thunk
  if ((0, _utils.isThunk)(next)) {
    if ((0, _utils.isSameThunk)(prev, next)) {
      changes.push(updateThunk(prev, next, path));
    } else {
      changes.push(replaceNode(prev, next, path));
    }
    return changes;
  }

  changes = diffAttributes(prev, next);
  changes.push(diffChildren(prev, next, path));

  return changes;
}
},{"../shared/utils":12,"dift":15,"union-type":28}],3:[function(require,module,exports){
'use strict';

Object.defineProperty(exports, "__esModule", {
  value: true
});
exports.default = createElement;

var _setAttribute = require('./setAttribute');

var _utils = require('../shared/utils');

var _svg = require('../shared/svg');

var _svg2 = _interopRequireDefault(_svg);

function _interopRequireDefault(obj) { return obj && obj.__esModule ? obj : { default: obj }; }

var cache = {};

/**
 * Create a real DOM element from a virtual element, recursively looping down.
 * When it finds custom elements it will render them, cache them, and keep going,
 * so they are treated like any other native element.
 */

function createElement(vnode, path, dispatch, context) {
  if ((0, _utils.isText)(vnode)) {
    return document.createTextNode(vnode.nodeValue || '');
  }

  if ((0, _utils.isThunk)(vnode)) {
    var props = vnode.props;
    var data = vnode.data;
    var children = vnode.children;
    var render = data.render;
    var onCreate = data.onCreate;

    var model = {
      children: children,
      props: props,
      path: path,
      dispatch: dispatch,
      context: context
    };
    var output = render(model);
    var _DOMElement = createElement(output, (0, _utils.createPath)(path, output.key || '0'), dispatch, context);
    if (onCreate) onCreate(model);
    vnode.data.vnode = output;
    vnode.data.model = model;
    return _DOMElement;
  }

  var cached = cache[vnode.type];

  if (typeof cached === 'undefined') {
    cached = cache[vnode.type] = _svg2.default.isElement(vnode.type) ? document.createElementNS(_svg2.default.namespace, vnode.type) : document.createElement(vnode.type);
  }

  var DOMElement = cached.cloneNode(false);

  for (var name in vnode.attributes) {
    (0, _setAttribute.setAttribute)(DOMElement, name, vnode.attributes[name]);
  }

  vnode.children.forEach(function (node, index) {
    if (node === null || node === undefined) {
      return;
    }
    var child = createElement(node, (0, _utils.createPath)(path, node.key || index), dispatch, context);
    DOMElement.appendChild(child);
  });

  return DOMElement;
}
},{"../shared/svg":11,"../shared/utils":12,"./setAttribute":7}],4:[function(require,module,exports){
'use strict';

Object.defineProperty(exports, "__esModule", {
  value: true
});
exports.default = createDOMRenderer;

var _createElement = require('./createElement');

var _createElement2 = _interopRequireDefault(_createElement);

var _diff = require('../diff');

var _patch = require('./patch');

var _patch2 = _interopRequireDefault(_patch);

var _uid = require('uid');

var _uid2 = _interopRequireDefault(_uid);

function _interopRequireDefault(obj) { return obj && obj.__esModule ? obj : { default: obj }; }

/**
 * Create a DOM renderer using a container element. Everything will be rendered
 * inside of that container. Returns a function that accepts new state that can
 * replace what is currently rendered.
 */

function createDOMRenderer(container, dispatch) {
  var oldVnode = null;
  var node = null;
  var path = (0, _uid2.default)();

  if (container && container.childNodes.length > 0) {
    container.innerHTML = '';
  }

  var update = function update(newVnode, context) {
    var changes = (0, _diff.diffNode)(oldVnode, newVnode, path);
    node = changes.reduce((0, _patch2.default)(dispatch, context), node);
    oldVnode = newVnode;
    return node;
  };

  var create = function create(vnode, context) {
    node = (0, _createElement2.default)(vnode, path, dispatch, context);
    if (container) container.appendChild(node);
    oldVnode = vnode;
    return node;
  };

  return function (vnode) {
    var context = arguments.length <= 1 || arguments[1] === undefined ? {} : arguments[1];

    return node !== null ? update(vnode, context) : create(vnode, context);
  };
}
},{"../diff":2,"./createElement":3,"./patch":6,"uid":27}],5:[function(require,module,exports){
'use strict';

Object.defineProperty(exports, "__esModule", {
  value: true
});

var _createRenderer = require('./createRenderer');

var _createRenderer2 = _interopRequireDefault(_createRenderer);

var _createElement = require('./createElement');

var _createElement2 = _interopRequireDefault(_createElement);

var _patch = require('./patch');

var _patch2 = _interopRequireDefault(_patch);

function _interopRequireDefault(obj) { return obj && obj.__esModule ? obj : { default: obj }; }

exports.default = {
  createRenderer: _createRenderer2.default,
  createElement: _createElement2.default,
  patch: _patch2.default
};
},{"./createElement":3,"./createRenderer":4,"./patch":6}],6:[function(require,module,exports){
'use strict';

Object.defineProperty(exports, "__esModule", {
  value: true
});
exports.default = patch;

var _setAttribute2 = require('./setAttribute');

var _utils = require('../shared/utils');

var _createElement = require('./createElement');

var _createElement2 = _interopRequireDefault(_createElement);

var _diff = require('../diff');

function _interopRequireDefault(obj) { return obj && obj.__esModule ? obj : { default: obj }; }

/**
 * Modify a DOM element given an array of actions. A context can be set
 * that will be used to render any custom elements.
 */

function patch(dispatch, context) {
  return function (DOMElement, action) {
    _diff.Actions.case({
      setAttribute: function setAttribute(name, value, previousValue) {
        (0, _setAttribute2.setAttribute)(DOMElement, name, value, previousValue);
      },
      removeAttribute: function removeAttribute(name, previousValue) {
        (0, _setAttribute2.removeAttribute)(DOMElement, name, previousValue);
      },
      insertBefore: function insertBefore(index) {
        (0, _utils.insertAtIndex)(DOMElement.parentNode, index, DOMElement);
      },
      sameNode: function sameNode() {},
      updateChildren: function updateChildren(changes) {
        // Create a clone of the children so we can reference them later
        // using their original position even if they move around
        var childNodes = Array.prototype.slice.apply(DOMElement.childNodes);

        changes.forEach(function (change) {
          _diff.Actions.case({
            insertChild: function insertChild(vnode, index, path) {
              (0, _utils.insertAtIndex)(DOMElement, index, (0, _createElement2.default)(vnode, path, dispatch, context));
            },
            removeChild: function removeChild(index) {
              DOMElement.removeChild(childNodes[index]);
            },
            updateChild: function updateChild(index, actions) {
              var update = patch(dispatch, context);
              actions.forEach(function (action) {
                return update(childNodes[index], action);
              });
            }
          }, change);
        });
      },
      updateThunk: function updateThunk(prev, next, path) {
        var props = next.props;
        var children = next.children;
        var _next$data = next.data;
        var render = _next$data.render;
        var onUpdate = _next$data.onUpdate;

        var prevNode = prev.data.vnode;
        var model = {
          children: children,
          props: props,
          path: path,
          dispatch: dispatch,
          context: context
        };
        var nextNode = render(model);
        var changes = (0, _diff.diffNode)(prevNode, nextNode, path);
        DOMElement = changes.reduce(patch(dispatch, context), DOMElement);
        if (onUpdate) onUpdate(model);
        next.data.vnode = nextNode;
        next.data.model = model;
      },
      replaceNode: function replaceNode(prev, next, path) {
        var newEl = (0, _createElement2.default)(next, path, dispatch, context);
        var parentEl = DOMElement.parentNode;
        if (parentEl) parentEl.replaceChild(newEl, DOMElement);
        DOMElement = newEl;
        removeThunks(prev);
      },
      removeNode: function removeNode(prev) {
        removeThunks(prev);
        DOMElement.parentNode.removeChild(DOMElement);
        DOMElement = null;
      }
    }, action);

    return DOMElement;
  };
}

/**
 * Recursively remove all thunks
 */

function removeThunks(vnode) {
  while ((0, _utils.isThunk)(vnode)) {
    var _vnode$data = vnode.data;
    var onRemove = _vnode$data.onRemove;
    var model = _vnode$data.model;

    if (onRemove) onRemove(model);
    vnode = vnode.data.vnode;
  }

  if (vnode.children) {
    for (var i = 0; i < vnode.children.length; i++) {
      removeThunks(vnode.children[i]);
    }
  }
}
},{"../diff":2,"../shared/utils":12,"./createElement":3,"./setAttribute":7}],7:[function(require,module,exports){
'use strict';

Object.defineProperty(exports, "__esModule", {
  value: true
});
exports.removeAttribute = removeAttribute;
exports.setAttribute = setAttribute;

var _utils = require('../shared/utils');

var _events = require('../shared/events');

var _events2 = _interopRequireDefault(_events);

var _svg = require('../shared/svg');

var _svg2 = _interopRequireDefault(_svg);

var _indexOf = require('index-of');

var _indexOf2 = _interopRequireDefault(_indexOf);

var _setify = require('setify');

var _setify2 = _interopRequireDefault(_setify);

function _interopRequireDefault(obj) { return obj && obj.__esModule ? obj : { default: obj }; }

function removeAttribute(DOMElement, name, previousValue) {
  var eventType = _events2.default[name];
  if (eventType) {
    if (typeof previousValue === 'function') {
      DOMElement.removeEventListener(eventType, previousValue);
    }
    return;
  }
  switch (name) {
    case 'checked':
    case 'disabled':
    case 'selected':
      DOMElement[name] = false;
      break;
    case 'innerHTML':
    case 'nodeValue':
      DOMElement.innerHTML = '';
      break;
    case 'value':
      DOMElement.value = '';
      break;
    default:
      DOMElement.removeAttribute(name);
      break;
  }
}

function setAttribute(DOMElement, name, value, previousValue) {
  var eventType = _events2.default[name];
  if (value === previousValue) {
    return;
  }
  if (eventType) {
    if (typeof previousValue === 'function') {
      DOMElement.removeEventListener(eventType, previousValue);
    }
    DOMElement.addEventListener(eventType, value);
    return;
  }
  if (typeof value === 'function') {
    value = value(DOMElement, name);
  }
  if (!(0, _utils.isValidAttribute)(value)) {
    removeAttribute(DOMElement, name, previousValue);
    return;
  }
  switch (name) {
    case 'checked':
    case 'disabled':
    case 'innerHTML':
    case 'nodeValue':
      DOMElement[name] = value;
      break;
    case 'selected':
      DOMElement.selected = value;
      // Fix for IE/Safari where select is not correctly selected on change
      if (DOMElement.tagName === 'OPTION') {
        var select = DOMElement.parentNode;
        select.selectedIndex = (0, _indexOf2.default)(select.options, DOMElement);
      }
      break;
    case 'value':
      (0, _setify2.default)(DOMElement, value);
      break;
    default:
      if (_svg2.default.isAttribute(name)) {
        DOMElement.setAttributeNS(_svg2.default.namespace, name, value);
      } else {
        DOMElement.setAttribute(name, value);
      }
      break;
  }
}
},{"../shared/events":10,"../shared/svg":11,"../shared/utils":12,"index-of":17,"setify":26}],8:[function(require,module,exports){
'use strict';

Object.defineProperty(exports, "__esModule", {
  value: true
});
exports.default = element;
exports.createTextElement = createTextElement;
exports.createThunkElement = createThunkElement;

function _toConsumableArray(arr) { if (Array.isArray(arr)) { for (var i = 0, arr2 = Array(arr.length); i < arr.length; i++) { arr2[i] = arr[i]; } return arr2; } else { return Array.from(arr); } }

function _typeof(obj) { return obj && typeof Symbol !== "undefined" && obj.constructor === Symbol ? "symbol" : typeof obj; }

/**
 * This function lets us create virtual nodes using a simple
 * syntax. It is compatible with JSX transforms so you can use
 * JSX to write nodes that will compile to this function.
 *
 * let node = element('div', { id: 'foo' }, [
 *   element('a', { href: 'http://google.com' },
 *     element('span', {}, 'Google'),
 *     element('b', {}, 'Link')
 *   )
 * ])
 */

function element(type, attributes) {
  for (var _len = arguments.length, children = Array(_len > 2 ? _len - 2 : 0), _key = 2; _key < _len; _key++) {
    children[_key - 2] = arguments[_key];
  }

  if (!type) throw new TypeError('element() needs a type.');

  attributes = attributes || {};
  children = (children || []).reduce(reduceChildren, []);

  var key = typeof attributes.key === 'string' || typeof attributes.key === 'number' ? attributes.key : undefined;

  delete attributes.key;

  if ((typeof type === 'undefined' ? 'undefined' : _typeof(type)) === 'object') {
    return createThunkElement(type, key, attributes, children);
  }

  return {
    attributes: attributes,
    children: children,
    type: type,
    key: key
  };
}

function reduceChildren(children, vnode) {
  if (typeof vnode === 'string' || typeof vnode === 'number') {
    children.push(createTextElement(vnode));
  } else if (Array.isArray(vnode)) {
    children = [].concat(_toConsumableArray(children), _toConsumableArray(vnode));
  } else if (typeof vnode !== 'undefined') {
    children.push(vnode);
  }
  return children;
}

function createTextElement(text) {
  return {
    type: '#text',
    nodeValue: text
  };
}

function createThunkElement(data, key, props, children) {
  return {
    type: '#thunk',
    children: children,
    props: props,
    data: data,
    key: key
  };
}
},{}],9:[function(require,module,exports){
'use strict';

Object.defineProperty(exports, "__esModule", {
  value: true
});
exports.dom = exports.string = exports.element = undefined;

var _element = require('./element');

var _element2 = _interopRequireDefault(_element);

var _string = require('./string');

var _string2 = _interopRequireDefault(_string);

var _dom = require('./dom');

var _dom2 = _interopRequireDefault(_dom);

function _interopRequireDefault(obj) { return obj && obj.__esModule ? obj : { default: obj }; }

exports.element = _element2.default;
exports.string = _string2.default;
exports.dom = _dom2.default;
},{"./dom":5,"./element":8,"./string":13}],10:[function(require,module,exports){
'use strict';

Object.defineProperty(exports, "__esModule", {
  value: true
});
/**
 * Special attributes that map to DOM events.
 */

exports.default = {
  onAbort: 'abort',
  onAnimationStart: 'animationstart',
  onAnimationIteration: 'animationiteration',
  onAnimationEnd: 'animationend',
  onBlur: 'blur',
  onCanPlay: 'canplay',
  onCanPlayThrough: 'canplaythrough',
  onChange: 'change',
  onClick: 'click',
  onContextMenu: 'contextmenu',
  onCopy: 'copy',
  onCut: 'cut',
  onDoubleClick: 'dblclick',
  onDrag: 'drag',
  onDragEnd: 'dragend',
  onDragEnter: 'dragenter',
  onDragExit: 'dragexit',
  onDragLeave: 'dragleave',
  onDragOver: 'dragover',
  onDragStart: 'dragstart',
  onDrop: 'drop',
  onDurationChange: 'durationchange',
  onEmptied: 'emptied',
  onEncrypted: 'encrypted',
  onEnded: 'ended',
  onError: 'error',
  onFocus: 'focus',
  onInput: 'input',
  onInvalid: 'invalid',
  onKeyDown: 'keydown',
  onKeyPress: 'keypress',
  onKeyUp: 'keyup',
  onLoad: 'load',
  onLoadedData: 'loadeddata',
  onLoadedMetadata: 'loadedmetadata',
  onLoadStart: 'loadstart',
  onPause: 'pause',
  onPlay: 'play',
  onPlaying: 'playing',
  onProgress: 'progress',
  onMouseDown: 'mousedown',
  onMouseEnter: 'mouseenter',
  onMouseLeave: 'mouseleave',
  onMouseMove: 'mousemove',
  onMouseOut: 'mouseout',
  onMouseOver: 'mouseover',
  onMouseUp: 'mouseup',
  onPaste: 'paste',
  onRateChange: 'ratechange',
  onReset: 'reset',
  onScroll: 'scroll',
  onSeeked: 'seeked',
  onSeeking: 'seeking',
  onSubmit: 'submit',
  onStalled: 'stalled',
  onSuspend: 'suspend',
  onTimeUpdate: 'timeupdate',
  onTransitionEnd: 'transitionend',
  onTouchCancel: 'touchcancel',
  onTouchEnd: 'touchend',
  onTouchMove: 'touchmove',
  onTouchStart: 'touchstart',
  onVolumeChange: 'volumechange',
  onWaiting: 'waiting',
  onWheel: 'wheel'
};
},{}],11:[function(require,module,exports){
'use strict';

Object.defineProperty(exports, "__esModule", {
  value: true
});

var _isSvgElement = require('is-svg-element');

var _isSvgAttribute = require('is-svg-attribute');

var _isSvgAttribute2 = _interopRequireDefault(_isSvgAttribute);

function _interopRequireDefault(obj) { return obj && obj.__esModule ? obj : { default: obj }; }

var namespace = 'http://www.w3.org/2000/svg';

exports.default = {
  isElement: _isSvgElement.isElement,
  isAttribute: _isSvgAttribute2.default,
  namespace: namespace
};
},{"is-svg-attribute":18,"is-svg-element":19}],12:[function(require,module,exports){
'use strict';

Object.defineProperty(exports, "__esModule", {
  value: true
});
exports.isValidAttribute = isValidAttribute;
/**
 * Check if an attribute shoudl be rendered into the DOM.
 */

function isValidAttribute(value) {
  if (typeof value === 'boolean') return value;
  if (typeof value === 'function') return false;
  if (value === '') return true;
  if (value === undefined) return false;
  if (value === null) return false;
  if (value === false) return false;
  return true;
}

/**
 * Group an array of virtual elements by their key, using index as a fallback.
 */

var groupByKey = exports.groupByKey = function groupByKey(children) {
  return children.reduce(function (acc, child, i) {
    if (child != null && child !== false) {
      acc.push({
        key: String(child.key || i),
        item: child,
        index: i
      });
    }
    return acc;
  }, []);
};

/**
 * Is a vnode a thunk?
 */

var isThunk = exports.isThunk = function isThunk(node) {
  return node.type === '#thunk';
};

/**
 * Is a vnode a text node?
 */

var isText = exports.isText = function isText(node) {
  return node.type === '#text';
};

/**
 * Determine if two virtual nodes are the same type
 */

var isSameThunk = exports.isSameThunk = function isSameThunk(left, right) {
  return isThunk(left) && isThunk(right) && left.data.render === right.data.render;
};

/**
 * Create a node path, eg. (23,5,2,4) => '23.5.2.4'
 */

var createPath = exports.createPath = function createPath() {
  for (var _len = arguments.length, args = Array(_len), _key = 0; _key < _len; _key++) {
    args[_key] = arguments[_key];
  }

  return args.join('.');
};

/**
 * Find a child node at a given path. Takes any tree that uses a
 * 'children' key. This will work for both virtual nodes and real
 * DOM trees.
 */

var findNodeAtPath = exports.findNodeAtPath = function findNodeAtPath(path, tree) {
  var parts = path.split('.');
  var node = undefined;
  while (parts.length) {
    var index = parts.shift();
    node = tree.children[index];
  }
  return node;
};

/**
 * Slightly nicer insertBefore
 */

var insertAtIndex = exports.insertAtIndex = function insertAtIndex(parent, index, el) {
  var target = parent.childNodes[index];
  if (target) {
    parent.insertBefore(el, target);
  } else {
    parent.appendChild(el);
  }
};

/**
 * Remove an element at an index
 */

var removeAtIndex = exports.removeAtIndex = function removeAtIndex(DOMElement, index) {
  DOMElement.removeChild(DOMElement.childNodes[index]);
};
},{}],13:[function(require,module,exports){
'use strict';

Object.defineProperty(exports, "__esModule", {
  value: true
});

var _renderString = require('./renderString');

var _renderString2 = _interopRequireDefault(_renderString);

function _interopRequireDefault(obj) { return obj && obj.__esModule ? obj : { default: obj }; }

exports.default = {
  renderString: _renderString2.default
};
},{"./renderString":14}],14:[function(require,module,exports){
'use strict';

Object.defineProperty(exports, "__esModule", {
  value: true
});
exports.default = renderString;

var _utils = require('../shared/utils');

/**
 * Turn an object of key/value pairs into a HTML attribute string. This
 * function is responsible for what attributes are allowed to be rendered and
 * should handle any other special cases specific to deku.
 */

function attributesToString(attributes) {
  var str = '';
  for (var name in attributes) {
    var value = attributes[name];
    if (name === 'innerHTML') continue;
    if ((0, _utils.isValidAttribute)(value)) str += ' ' + name + '="' + attributes[name] + '"';
  }
  return str;
}

/**
 * Render a virtual element to a string. You can pass in an option state context
 * object that will be given to all components.
 */

function renderString(element, context) {
  var path = arguments.length <= 2 || arguments[2] === undefined ? '0' : arguments[2];

  if ((0, _utils.isText)(element)) {
    return element.nodeValue;
  }

  if ((0, _utils.isThunk)(element)) {
    var props = element.props;
    var data = element.data;
    var _children = element.children;
    var render = data.render;

    var output = render({
      children: _children,
      props: props,
      path: path,
      context: context
    });
    return renderString(output, context, path);
  }

  var attributes = element.attributes;
  var type = element.type;
  var children = element.children;

  var innerHTML = attributes.innerHTML;
  var str = '<' + type + attributesToString(attributes) + '>';

  if (innerHTML) {
    str += innerHTML;
  } else {
    str += children.map(function (child, i) {
      return renderString(child, context, path + '.' + (child.key == null ? i : child.key));
    }).join('');
  }

  str += '</' + type + '>';
  return str;
}
},{"../shared/utils":12}],15:[function(require,module,exports){
'use strict';

Object.defineProperty(exports, "__esModule", {
  value: true
});
exports.REMOVE = exports.MOVE = exports.UPDATE = exports.CREATE = undefined;

var _bitVector = require('bit-vector');

/**
 * Actions
 */

var CREATE = 0; /**
                 * Imports
                 */

var UPDATE = 1;
var MOVE = 2;
var REMOVE = 3;

/**
 * dift
 */

function dift(prev, next, effect, key) {
  var pStartIdx = 0;
  var nStartIdx = 0;
  var pEndIdx = prev.length - 1;
  var nEndIdx = next.length - 1;
  var pStartItem = prev[pStartIdx];
  var nStartItem = next[nStartIdx];

  // List head is the same
  while (pStartIdx <= pEndIdx && nStartIdx <= nEndIdx && equal(pStartItem, nStartItem)) {
    effect(UPDATE, pStartItem, nStartItem, nStartIdx);
    pStartItem = prev[++pStartIdx];
    nStartItem = next[++nStartIdx];
  }

  // The above case is orders of magnitude more common than the others, so fast-path it
  if (nStartIdx > nEndIdx && pStartIdx > pEndIdx) {
    return;
  }

  var pEndItem = prev[pEndIdx];
  var nEndItem = next[nEndIdx];
  var movedFromFront = 0;

  // Reversed
  while (pStartIdx <= pEndIdx && nStartIdx <= nEndIdx && equal(pStartItem, nEndItem)) {
    effect(MOVE, pStartItem, nEndItem, pEndIdx - movedFromFront + 1);
    pStartItem = prev[++pStartIdx];
    nEndItem = next[--nEndIdx];
    ++movedFromFront;
  }

  // Reversed the other way (in case of e.g. reverse and append)
  while (pEndIdx >= pStartIdx && nStartIdx <= nEndIdx && equal(nStartItem, pEndItem)) {
    effect(MOVE, pEndItem, nStartItem, nStartIdx);
    pEndItem = prev[--pEndIdx];
    nStartItem = next[++nStartIdx];
    --movedFromFront;
  }

  // List tail is the same
  while (pEndIdx >= pStartIdx && nEndIdx >= nStartIdx && equal(pEndItem, nEndItem)) {
    effect(UPDATE, pEndItem, nEndItem, nEndIdx);
    pEndItem = prev[--pEndIdx];
    nEndItem = next[--nEndIdx];
  }

  if (pStartIdx > pEndIdx) {
    while (nStartIdx <= nEndIdx) {
      effect(CREATE, null, nStartItem, nStartIdx);
      nStartItem = next[++nStartIdx];
    }

    return;
  }

  if (nStartIdx > nEndIdx) {
    while (pStartIdx <= pEndIdx) {
      effect(REMOVE, pStartItem);
      pStartItem = prev[++pStartIdx];
    }

    return;
  }

  var created = 0;
  var pivotDest = null;
  var pivotIdx = pStartIdx - movedFromFront;
  var keepBase = pStartIdx;
  var keep = (0, _bitVector.createBv)(pEndIdx - pStartIdx);

  var prevMap = keyMap(prev, pStartIdx, pEndIdx + 1, key);

  for (; nStartIdx <= nEndIdx; nStartItem = next[++nStartIdx]) {
    var oldIdx = prevMap[key(nStartItem)];

    if (isUndefined(oldIdx)) {
      effect(CREATE, null, nStartItem, pivotIdx++);
      ++created;
    } else if (pStartIdx !== oldIdx) {
      (0, _bitVector.setBit)(keep, oldIdx - keepBase);
      effect(MOVE, prev[oldIdx], nStartItem, pivotIdx++);
    } else {
      pivotDest = nStartIdx;
    }
  }

  if (pivotDest !== null) {
    (0, _bitVector.setBit)(keep, 0);
    effect(MOVE, prev[pStartIdx], next[pivotDest], pivotDest);
  }

  // If there are no creations, then you have to
  // remove exactly max(prevLen - nextLen, 0) elements in this
  // diff. You have to remove one more for each element
  // that was created. This means once we have
  // removed that many, we can stop.
  var necessaryRemovals = prev.length - next.length + created;
  for (var removals = 0; removals < necessaryRemovals; pStartItem = prev[++pStartIdx]) {
    if (!(0, _bitVector.getBit)(keep, pStartIdx - keepBase)) {
      effect(REMOVE, pStartItem);
      ++removals;
    }
  }

  function equal(a, b) {
    return key(a) === key(b);
  }
}

function isUndefined(val) {
  return typeof val === 'undefined';
}

function keyMap(items, start, end, key) {
  var map = {};

  for (var i = start; i < end; ++i) {
    map[key(items[i])] = i;
  }

  return map;
}

/**
 * Exports
 */

exports.default = dift;
exports.CREATE = CREATE;
exports.UPDATE = UPDATE;
exports.MOVE = MOVE;
exports.REMOVE = REMOVE;
},{"bit-vector":1}],16:[function(require,module,exports){
// Copyright Joyent, Inc. and other Node contributors.
//
// Permission is hereby granted, free of charge, to any person obtaining a
// copy of this software and associated documentation files (the
// "Software"), to deal in the Software without restriction, including
// without limitation the rights to use, copy, modify, merge, publish,
// distribute, sublicense, and/or sell copies of the Software, and to permit
// persons to whom the Software is furnished to do so, subject to the
// following conditions:
//
// The above copyright notice and this permission notice shall be included
// in all copies or substantial portions of the Software.
//
// THE SOFTWARE IS PROVIDED "AS IS", WITHOUT WARRANTY OF ANY KIND, EXPRESS
// OR IMPLIED, INCLUDING BUT NOT LIMITED TO THE WARRANTIES OF
// MERCHANTABILITY, FITNESS FOR A PARTICULAR PURPOSE AND NONINFRINGEMENT. IN
// NO EVENT SHALL THE AUTHORS OR COPYRIGHT HOLDERS BE LIABLE FOR ANY CLAIM,
// DAMAGES OR OTHER LIABILITY, WHETHER IN AN ACTION OF CONTRACT, TORT OR
// OTHERWISE, ARISING FROM, OUT OF OR IN CONNECTION WITH THE SOFTWARE OR THE
// USE OR OTHER DEALINGS IN THE SOFTWARE.

function EventEmitter() {
  this._events = this._events || {};
  this._maxListeners = this._maxListeners || undefined;
}
module.exports = EventEmitter;

// Backwards-compat with node 0.10.x
EventEmitter.EventEmitter = EventEmitter;

EventEmitter.prototype._events = undefined;
EventEmitter.prototype._maxListeners = undefined;

// By default EventEmitters will print a warning if more than 10 listeners are
// added to it. This is a useful default which helps finding memory leaks.
EventEmitter.defaultMaxListeners = 10;

// Obviously not all Emitters should be limited to 10. This function allows
// that to be increased. Set to zero for unlimited.
EventEmitter.prototype.setMaxListeners = function(n) {
  if (!isNumber(n) || n < 0 || isNaN(n))
    throw TypeError('n must be a positive number');
  this._maxListeners = n;
  return this;
};

EventEmitter.prototype.emit = function(type) {
  var er, handler, len, args, i, listeners;

  if (!this._events)
    this._events = {};

  // If there is no 'error' event listener then throw.
  if (type === 'error') {
    if (!this._events.error ||
        (isObject(this._events.error) && !this._events.error.length)) {
      er = arguments[1];
      if (er instanceof Error) {
        throw er; // Unhandled 'error' event
      }
      throw TypeError('Uncaught, unspecified "error" event.');
    }
  }

  handler = this._events[type];

  if (isUndefined(handler))
    return false;

  if (isFunction(handler)) {
    switch (arguments.length) {
      // fast cases
      case 1:
        handler.call(this);
        break;
      case 2:
        handler.call(this, arguments[1]);
        break;
      case 3:
        handler.call(this, arguments[1], arguments[2]);
        break;
      // slower
      default:
        args = Array.prototype.slice.call(arguments, 1);
        handler.apply(this, args);
    }
  } else if (isObject(handler)) {
    args = Array.prototype.slice.call(arguments, 1);
    listeners = handler.slice();
    len = listeners.length;
    for (i = 0; i < len; i++)
      listeners[i].apply(this, args);
  }

  return true;
};

EventEmitter.prototype.addListener = function(type, listener) {
  var m;

  if (!isFunction(listener))
    throw TypeError('listener must be a function');

  if (!this._events)
    this._events = {};

  // To avoid recursion in the case that type === "newListener"! Before
  // adding it to the listeners, first emit "newListener".
  if (this._events.newListener)
    this.emit('newListener', type,
              isFunction(listener.listener) ?
              listener.listener : listener);

  if (!this._events[type])
    // Optimize the case of one listener. Don't need the extra array object.
    this._events[type] = listener;
  else if (isObject(this._events[type]))
    // If we've already got an array, just append.
    this._events[type].push(listener);
  else
    // Adding the second element, need to change to array.
    this._events[type] = [this._events[type], listener];

  // Check for listener leak
  if (isObject(this._events[type]) && !this._events[type].warned) {
    if (!isUndefined(this._maxListeners)) {
      m = this._maxListeners;
    } else {
      m = EventEmitter.defaultMaxListeners;
    }

    if (m && m > 0 && this._events[type].length > m) {
      this._events[type].warned = true;
      console.error('(node) warning: possible EventEmitter memory ' +
                    'leak detected. %d listeners added. ' +
                    'Use emitter.setMaxListeners() to increase limit.',
                    this._events[type].length);
      if (typeof console.trace === 'function') {
        // not supported in IE 10
        console.trace();
      }
    }
  }

  return this;
};

EventEmitter.prototype.on = EventEmitter.prototype.addListener;

EventEmitter.prototype.once = function(type, listener) {
  if (!isFunction(listener))
    throw TypeError('listener must be a function');

  var fired = false;

  function g() {
    this.removeListener(type, g);

    if (!fired) {
      fired = true;
      listener.apply(this, arguments);
    }
  }

  g.listener = listener;
  this.on(type, g);

  return this;
};

// emits a 'removeListener' event iff the listener was removed
EventEmitter.prototype.removeListener = function(type, listener) {
  var list, position, length, i;

  if (!isFunction(listener))
    throw TypeError('listener must be a function');

  if (!this._events || !this._events[type])
    return this;

  list = this._events[type];
  length = list.length;
  position = -1;

  if (list === listener ||
      (isFunction(list.listener) && list.listener === listener)) {
    delete this._events[type];
    if (this._events.removeListener)
      this.emit('removeListener', type, listener);

  } else if (isObject(list)) {
    for (i = length; i-- > 0;) {
      if (list[i] === listener ||
          (list[i].listener && list[i].listener === listener)) {
        position = i;
        break;
      }
    }

    if (position < 0)
      return this;

    if (list.length === 1) {
      list.length = 0;
      delete this._events[type];
    } else {
      list.splice(position, 1);
    }

    if (this._events.removeListener)
      this.emit('removeListener', type, listener);
  }

  return this;
};

EventEmitter.prototype.removeAllListeners = function(type) {
  var key, listeners;

  if (!this._events)
    return this;

  // not listening for removeListener, no need to emit
  if (!this._events.removeListener) {
    if (arguments.length === 0)
      this._events = {};
    else if (this._events[type])
      delete this._events[type];
    return this;
  }

  // emit removeListener for all listeners on all events
  if (arguments.length === 0) {
    for (key in this._events) {
      if (key === 'removeListener') continue;
      this.removeAllListeners(key);
    }
    this.removeAllListeners('removeListener');
    this._events = {};
    return this;
  }

  listeners = this._events[type];

  if (isFunction(listeners)) {
    this.removeListener(type, listeners);
  } else if (listeners) {
    // LIFO order
    while (listeners.length)
      this.removeListener(type, listeners[listeners.length - 1]);
  }
  delete this._events[type];

  return this;
};

EventEmitter.prototype.listeners = function(type) {
  var ret;
  if (!this._events || !this._events[type])
    ret = [];
  else if (isFunction(this._events[type]))
    ret = [this._events[type]];
  else
    ret = this._events[type].slice();
  return ret;
};

EventEmitter.prototype.listenerCount = function(type) {
  if (this._events) {
    var evlistener = this._events[type];

    if (isFunction(evlistener))
      return 1;
    else if (evlistener)
      return evlistener.length;
  }
  return 0;
};

EventEmitter.listenerCount = function(emitter, type) {
  return emitter.listenerCount(type);
};

function isFunction(arg) {
  return typeof arg === 'function';
}

function isNumber(arg) {
  return typeof arg === 'number';
}

function isObject(arg) {
  return typeof arg === 'object' && arg !== null;
}

function isUndefined(arg) {
  return arg === void 0;
}

},{}],17:[function(require,module,exports){
/*!
 * index-of <https://github.com/jonschlinkert/index-of>
 *
 * Copyright (c) 2014-2015 Jon Schlinkert.
 * Licensed under the MIT license.
 */

'use strict';

module.exports = function indexOf(arr, ele, start) {
  start = start || 0;
  var idx = -1;

  if (arr == null) return idx;
  var len = arr.length;
  var i = start < 0
    ? (len + start)
    : start;

  if (i >= arr.length) {
    return -1;
  }

  while (i < len) {
    if (arr[i] === ele) {
      return i;
    }
    i++;
  }

  return -1;
};

},{}],18:[function(require,module,exports){
/**
 * Supported SVG attributes
 */

exports.attributes = {
  'cx': true,
  'cy': true,
  'd': true,
  'dx': true,
  'dy': true,
  'fill': true,
  'fillOpacity': true,
  'fontFamily': true,
  'fontSize': true,
  'fx': true,
  'fy': true,
  'gradientTransform': true,
  'gradientUnits': true,
  'markerEnd': true,
  'markerMid': true,
  'markerStart': true,
  'offset': true,
  'opacity': true,
  'patternContentUnits': true,
  'patternUnits': true,
  'points': true,
  'preserveAspectRatio': true,
  'r': true,
  'rx': true,
  'ry': true,
  'spreadMethod': true,
  'stopColor': true,
  'stopOpacity': true,
  'stroke': true,
  'strokeDasharray': true,
  'strokeLinecap': true,
  'strokeOpacity': true,
  'strokeWidth': true,
  'textAnchor': true,
  'transform': true,
  'version': true,
  'viewBox': true,
  'x1': true,
  'x2': true,
  'x': true,
  'y1': true,
  'y2': true,
  'y': true
}

/**
 * Are element's attributes SVG?
 *
 * @param {String} attr
 */

module.exports = function (attr) {
  return attr in exports.attributes
}

},{}],19:[function(require,module,exports){
/**
 * Supported SVG elements
 *
 * @type {Array}
 */

exports.elements = {
  'animate': true,
  'circle': true,
  'defs': true,
  'ellipse': true,
  'g': true,
  'line': true,
  'linearGradient': true,
  'mask': true,
  'path': true,
  'pattern': true,
  'polygon': true,
  'polyline': true,
  'radialGradient': true,
  'rect': true,
  'stop': true,
  'svg': true,
  'text': true,
  'tspan': true
}

/**
 * Is element's namespace SVG?
 *
 * @param {String} name
 */

exports.isElement = function (name) {
  return name in exports.elements
}

},{}],20:[function(require,module,exports){
var supportedTypes = ['text', 'search', 'tel', 'url', 'password'];

module.exports = function(element){
    return !!(element.setSelectionRange && ~supportedTypes.indexOf(element.type));
};

},{}],21:[function(require,module,exports){
var _curry2 = require('./internal/_curry2');


/**
 * Wraps a function of any arity (including nullary) in a function that accepts exactly `n`
 * parameters. Unlike `nAry`, which passes only `n` arguments to the wrapped function,
 * functions produced by `arity` will pass all provided arguments to the wrapped function.
 *
 * @func
 * @memberOf R
 * @sig (Number, (* -> *)) -> (* -> *)
 * @category Function
 * @param {Number} n The desired arity of the returned function.
 * @param {Function} fn The function to wrap.
 * @return {Function} A new function wrapping `fn`. The new function is
 *         guaranteed to be of arity `n`.
 * @deprecated since v0.15.0
 * @example
 *
 *      var takesTwoArgs = function(a, b) {
 *        return [a, b];
 *      };
 *      takesTwoArgs.length; //=> 2
 *      takesTwoArgs(1, 2); //=> [1, 2]
 *
 *      var takesOneArg = R.arity(1, takesTwoArgs);
 *      takesOneArg.length; //=> 1
 *      // All arguments are passed through to the wrapped function
 *      takesOneArg(1, 2); //=> [1, 2]
 */
module.exports = _curry2(function(n, fn) {
  // jshint unused:vars
  switch (n) {
    case 0: return function() {return fn.apply(this, arguments);};
    case 1: return function(a0) {return fn.apply(this, arguments);};
    case 2: return function(a0, a1) {return fn.apply(this, arguments);};
    case 3: return function(a0, a1, a2) {return fn.apply(this, arguments);};
    case 4: return function(a0, a1, a2, a3) {return fn.apply(this, arguments);};
    case 5: return function(a0, a1, a2, a3, a4) {return fn.apply(this, arguments);};
    case 6: return function(a0, a1, a2, a3, a4, a5) {return fn.apply(this, arguments);};
    case 7: return function(a0, a1, a2, a3, a4, a5, a6) {return fn.apply(this, arguments);};
    case 8: return function(a0, a1, a2, a3, a4, a5, a6, a7) {return fn.apply(this, arguments);};
    case 9: return function(a0, a1, a2, a3, a4, a5, a6, a7, a8) {return fn.apply(this, arguments);};
    case 10: return function(a0, a1, a2, a3, a4, a5, a6, a7, a8, a9) {return fn.apply(this, arguments);};
    default: throw new Error('First argument to arity must be a non-negative integer no greater than ten');
  }
});

},{"./internal/_curry2":24}],22:[function(require,module,exports){
var _curry2 = require('./internal/_curry2');
var _curryN = require('./internal/_curryN');
var arity = require('./arity');


/**
 * Returns a curried equivalent of the provided function, with the
 * specified arity. The curried function has two unusual capabilities.
 * First, its arguments needn't be provided one at a time. If `g` is
 * `R.curryN(3, f)`, the following are equivalent:
 *
 *   - `g(1)(2)(3)`
 *   - `g(1)(2, 3)`
 *   - `g(1, 2)(3)`
 *   - `g(1, 2, 3)`
 *
 * Secondly, the special placeholder value `R.__` may be used to specify
 * "gaps", allowing partial application of any combination of arguments,
 * regardless of their positions. If `g` is as above and `_` is `R.__`,
 * the following are equivalent:
 *
 *   - `g(1, 2, 3)`
 *   - `g(_, 2, 3)(1)`
 *   - `g(_, _, 3)(1)(2)`
 *   - `g(_, _, 3)(1, 2)`
 *   - `g(_, 2)(1)(3)`
 *   - `g(_, 2)(1, 3)`
 *   - `g(_, 2)(_, 3)(1)`
 *
 * @func
 * @memberOf R
 * @category Function
 * @sig Number -> (* -> a) -> (* -> a)
 * @param {Number} length The arity for the returned function.
 * @param {Function} fn The function to curry.
 * @return {Function} A new, curried function.
 * @see R.curry
 * @example
 *
 *      var addFourNumbers = function() {
 *        return R.sum([].slice.call(arguments, 0, 4));
 *      };
 *
 *      var curriedAddFourNumbers = R.curryN(4, addFourNumbers);
 *      var f = curriedAddFourNumbers(1, 2);
 *      var g = f(3);
 *      g(4); //=> 10
 */
module.exports = _curry2(function curryN(length, fn) {
  return arity(length, _curryN(length, [], fn));
});

},{"./arity":21,"./internal/_curry2":24,"./internal/_curryN":25}],23:[function(require,module,exports){
/**
 * Optimized internal two-arity curry function.
 *
 * @private
 * @category Function
 * @param {Function} fn The function to curry.
 * @return {Function} The curried function.
 */
module.exports = function _curry1(fn) {
  return function f1(a) {
    if (arguments.length === 0) {
      return f1;
    } else if (a != null && a['@@functional/placeholder'] === true) {
      return f1;
    } else {
      return fn(a);
    }
  };
};

},{}],24:[function(require,module,exports){
var _curry1 = require('./_curry1');


/**
 * Optimized internal two-arity curry function.
 *
 * @private
 * @category Function
 * @param {Function} fn The function to curry.
 * @return {Function} The curried function.
 */
module.exports = function _curry2(fn) {
  return function f2(a, b) {
    var n = arguments.length;
    if (n === 0) {
      return f2;
    } else if (n === 1 && a != null && a['@@functional/placeholder'] === true) {
      return f2;
    } else if (n === 1) {
      return _curry1(function(b) { return fn(a, b); });
    } else if (n === 2 && a != null && a['@@functional/placeholder'] === true &&
                          b != null && b['@@functional/placeholder'] === true) {
      return f2;
    } else if (n === 2 && a != null && a['@@functional/placeholder'] === true) {
      return _curry1(function(a) { return fn(a, b); });
    } else if (n === 2 && b != null && b['@@functional/placeholder'] === true) {
      return _curry1(function(b) { return fn(a, b); });
    } else {
      return fn(a, b);
    }
  };
};

},{"./_curry1":23}],25:[function(require,module,exports){
var arity = require('../arity');


/**
 * Internal curryN function.
 *
 * @private
 * @category Function
 * @param {Number} length The arity of the curried function.
 * @return {array} An array of arguments received thus far.
 * @param {Function} fn The function to curry.
 */
module.exports = function _curryN(length, received, fn) {
  return function() {
    var combined = [];
    var argsIdx = 0;
    var left = length;
    var combinedIdx = 0;
    while (combinedIdx < received.length || argsIdx < arguments.length) {
      var result;
      if (combinedIdx < received.length &&
          (received[combinedIdx] == null ||
           received[combinedIdx]['@@functional/placeholder'] !== true ||
           argsIdx >= arguments.length)) {
        result = received[combinedIdx];
      } else {
        result = arguments[argsIdx];
        argsIdx += 1;
      }
      combined[combinedIdx] = result;
      if (result == null || result['@@functional/placeholder'] !== true) {
        left -= 1;
      }
      combinedIdx += 1;
    }
    return left <= 0 ? fn.apply(this, combined) : arity(left, _curryN(length, combined, fn));
  };
};

},{"../arity":21}],26:[function(require,module,exports){
var naturalSelection = require('natural-selection');

module.exports = function(element, value){
    var canSet = naturalSelection(element) && element === document.activeElement;

    if (canSet) {
        var start = element.selectionStart,
            end = element.selectionEnd;

        element.value = value;
        element.setSelectionRange(start, end);
    } else {
        element.value = value;
    }
};

},{"natural-selection":20}],27:[function(require,module,exports){
/**
 * Export `uid`
 */

module.exports = uid;

/**
 * Create a `uid`
 *
 * @param {String} len
 * @return {String} uid
 */

function uid(len) {
  len = len || 7;
  return Math.random().toString(35).substr(2, len);
}

},{}],28:[function(require,module,exports){
var curryN = require('ramda/src/curryN');

function isString(s) { return typeof s === 'string'; }
function isNumber(n) { return typeof n === 'number'; }
function isObject(value) {
  var type = typeof value;
  return !!value && (type == 'object' || type == 'function');
}
function isFunction(f) { return typeof f === 'function'; }
var isArray = Array.isArray || function(a) { return 'length' in a; };

var mapConstrToFn = curryN(2, function(group, constr) {
  return constr === String    ? isString
       : constr === Number    ? isNumber
       : constr === Object    ? isObject
       : constr === Array     ? isArray
       : constr === Function  ? isFunction
       : constr === undefined ? group
                              : constr;
});

function Constructor(group, name, validators) {
  validators = validators.map(mapConstrToFn(group));
  var constructor = curryN(validators.length, function() {
    var val = [], v, validator;
    for (var i = 0; i < arguments.length; ++i) {
      v = arguments[i];
      validator = validators[i];
      if ((typeof validator === 'function' && validator(v)) ||
          (v !== undefined && v !== null && v.of === validator)) {
        val[i] = arguments[i];
      } else {
        throw new TypeError('wrong value ' + v + ' passed to location ' + i + ' in ' + name);
      }
    }
    val.of = group;
    val.name = name;
    return val;
  });
  return constructor;
}

function rawCase(type, cases, action, arg) {
  if (type !== action.of) throw new TypeError('wrong type passed to case');
  var name = action.name in cases ? action.name
           : '_' in cases         ? '_'
                                  : undefined;
  if (name === undefined) {
    throw new Error('unhandled value passed to case');
  } else {
    return cases[name].apply(undefined, arg !== undefined ? action.concat([arg]) : action);
  }
}

var typeCase = curryN(3, rawCase);
var caseOn = curryN(4, rawCase);

function Type(desc) {
  var obj = {};
  for (var key in desc) {
    obj[key] = Constructor(obj, key, desc[key]);
  }
  obj.case = typeCase(obj);
  obj.caseOn = caseOn(obj);
  return obj;
}

module.exports = Type;

},{"ramda/src/curryN":22}],29:[function(require,module,exports){
'use strict';

var _deku = require('deku');

var _events = require('events');

var createRenderer = _deku.dom.createRenderer;

var emitter = new _events.EventEmitter();
var counter = 0;
// Dispatch an action when the button is clicked
var log = function log(event) {
    emitter.emit("update");
};
// Define a state-less component
var MyButton = {
    onUpdate: function onUpdate(_ref) {
        var path = _ref.path;

        console.log(counter + ' onUpdate : ' + path);
    },
    render: function render(_ref2) {
        var path = _ref2.path;
        var children = _ref2.children;

        console.log(++counter + ' render : ' + path);
        return (0, _deku.element)(
            'button',
            { onClick: log },
            children
        );
    }
};
var MyWrapper = {
    render: function render() {
        return (0, _deku.element)(
            'div',
            null,
            (0, _deku.element)(
                MyButton,
                null,
                'Hello World!'
            )
        );
    }
};
var render = createRenderer(document.body);
emitter.on("update", function () {
    render((0, _deku.element)(MyWrapper, null));
});
// init
emitter.emit("update");

},{"deku":9,"events":16}]},{},[29])
//# sourceMappingURL=data:application/json;charset=utf-8;base64,eyJ2ZXJzaW9uIjozLCJzb3VyY2VzIjpbIm5vZGVfbW9kdWxlcy9icm93c2VyLXBhY2svX3ByZWx1ZGUuanMiLCJub2RlX21vZHVsZXMvYml0LXZlY3Rvci9saWIvaW5kZXguanMiLCJub2RlX21vZHVsZXMvZGVrdS9saWIvZGlmZi9pbmRleC5qcyIsIm5vZGVfbW9kdWxlcy9kZWt1L2xpYi9kb20vY3JlYXRlRWxlbWVudC5qcyIsIm5vZGVfbW9kdWxlcy9kZWt1L2xpYi9kb20vY3JlYXRlUmVuZGVyZXIuanMiLCJub2RlX21vZHVsZXMvZGVrdS9saWIvZG9tL2luZGV4LmpzIiwibm9kZV9tb2R1bGVzL2Rla3UvbGliL2RvbS9wYXRjaC5qcyIsIm5vZGVfbW9kdWxlcy9kZWt1L2xpYi9kb20vc2V0QXR0cmlidXRlLmpzIiwibm9kZV9tb2R1bGVzL2Rla3UvbGliL2VsZW1lbnQvaW5kZXguanMiLCJub2RlX21vZHVsZXMvZGVrdS9saWIvaW5kZXguanMiLCJub2RlX21vZHVsZXMvZGVrdS9saWIvc2hhcmVkL2V2ZW50cy5qcyIsIm5vZGVfbW9kdWxlcy9kZWt1L2xpYi9zaGFyZWQvc3ZnLmpzIiwibm9kZV9tb2R1bGVzL2Rla3UvbGliL3NoYXJlZC91dGlscy5qcyIsIm5vZGVfbW9kdWxlcy9kZWt1L2xpYi9zdHJpbmcvaW5kZXguanMiLCJub2RlX21vZHVsZXMvZGVrdS9saWIvc3RyaW5nL3JlbmRlclN0cmluZy5qcyIsIm5vZGVfbW9kdWxlcy9kaWZ0L2xpYi9pbmRleC5qcyIsIm5vZGVfbW9kdWxlcy9ldmVudHMvZXZlbnRzLmpzIiwibm9kZV9tb2R1bGVzL2luZGV4LW9mL2luZGV4LmpzIiwibm9kZV9tb2R1bGVzL2lzLXN2Zy1hdHRyaWJ1dGUvaW5kZXguanMiLCJub2RlX21vZHVsZXMvaXMtc3ZnLWVsZW1lbnQvaW5kZXguanMiLCJub2RlX21vZHVsZXMvbmF0dXJhbC1zZWxlY3Rpb24vaW5kZXguanMiLCJub2RlX21vZHVsZXMvcmFtZGEvc3JjL2FyaXR5LmpzIiwibm9kZV9tb2R1bGVzL3JhbWRhL3NyYy9jdXJyeU4uanMiLCJub2RlX21vZHVsZXMvcmFtZGEvc3JjL2ludGVybmFsL19jdXJyeTEuanMiLCJub2RlX21vZHVsZXMvcmFtZGEvc3JjL2ludGVybmFsL19jdXJyeTIuanMiLCJub2RlX21vZHVsZXMvcmFtZGEvc3JjL2ludGVybmFsL19jdXJyeU4uanMiLCJub2RlX21vZHVsZXMvc2V0aWZ5L2luZGV4LmpzIiwibm9kZV9tb2R1bGVzL3VpZC9pbmRleC5qcyIsIm5vZGVfbW9kdWxlcy91bmlvbi10eXBlL3VuaW9uLXR5cGUuanMiLCJzcmMvaW5kZXguanMiXSwibmFtZXMiOltdLCJtYXBwaW5ncyI6IkFBQUE7QUNBQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7O0FDbERBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTs7QUNyTUE7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTs7QUN6RUE7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7O0FDekRBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBOztBQ3hCQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBOztBQ3RIQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBOztBQ3BHQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTs7QUM5RUE7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBOztBQ3ZCQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTs7QUMzRUE7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBOztBQ3BCQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTs7QUM1R0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBOztBQ2RBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBOztBQ3JFQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBOztBQzdKQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBOztBQzFTQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7O0FDaENBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTs7QUMzREE7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7O0FDcENBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTs7QUNMQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7O0FDL0NBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBOztBQ25EQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBOztBQ25CQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7O0FDaENBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTs7QUN0Q0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7O0FDZkE7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBOztBQ2pCQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7Ozs7Ozs7O0lDbEVPLGNBQWMsU0FGYixHQUFHLENBRUosY0FBYzs7QUFDckIsSUFBTSxPQUFPLEdBQUcsWUFGUixZQUFZLEVBRVksQ0FBQztBQUNqQyxJQUFJLE9BQU8sR0FBRyxDQUFDOztBQUFDLEFBRWhCLElBQUksR0FBRyxHQUFHLFNBQU4sR0FBRyxDQUFHLEtBQUssRUFBSTtBQUNmLFdBQU8sQ0FBQyxJQUFJLENBQUMsUUFBUSxDQUFDLENBQUM7Q0FDMUI7O0FBQUMsQUFFRixJQUFJLFFBQVEsR0FBRztBQUNYLFlBQVEsMEJBQVE7WUFBTixJQUFJLFFBQUosSUFBSTs7QUFDVixlQUFPLENBQUMsR0FBRyxDQUFJLE9BQU8sb0JBQWUsSUFBSSxDQUFHLENBQUM7S0FDaEQ7QUFDRCxVQUFNLHlCQUFrQjtZQUFoQixJQUFJLFNBQUosSUFBSTtZQUFFLFFBQVEsU0FBUixRQUFROztBQUNsQixlQUFPLENBQUMsR0FBRyxDQUFJLEVBQUUsT0FBTyxrQkFBYSxJQUFJLENBQUcsQ0FBQztBQUM3QyxlQUFPLFVBaEJGLE9BQU87O2NBZ0JHLE9BQU8sRUFBRSxHQUFHLEFBQUM7WUFBRSxRQUFRO1NBQVUsQ0FBQTtLQUNuRDtDQUNKLENBQUM7QUFDRixJQUFJLFNBQVMsR0FBRztBQUNaLFVBQU0sb0JBQUU7QUFDSixlQUFPLFVBckJGLE9BQU87OztZQXNCUixVQXRCQyxPQUFPO0FBc0JQLHdCQUFROzs7YUFBd0I7U0FDL0IsQ0FBQTtLQUNUO0NBQ0osQ0FBQztBQUNGLElBQUksTUFBTSxHQUFHLGNBQWMsQ0FBQyxRQUFRLENBQUMsSUFBSSxDQUFDLENBQUM7QUFDM0MsT0FBTyxDQUFDLEVBQUUsQ0FBQyxRQUFRLEVBQUUsWUFBSztBQUN0QixVQUFNLENBQUMsVUE1QkUsT0FBTyxFQTRCUixTQUFTLE9BQUcsQ0FBQyxDQUFDO0NBQ3pCLENBQUM7O0FBQUMsQUFFSCxPQUFPLENBQUMsSUFBSSxDQUFDLFFBQVEsQ0FBQyxDQUFDIiwiZmlsZSI6ImdlbmVyYXRlZC5qcyIsInNvdXJjZVJvb3QiOiIiLCJzb3VyY2VzQ29udGVudCI6WyIoZnVuY3Rpb24gZSh0LG4scil7ZnVuY3Rpb24gcyhvLHUpe2lmKCFuW29dKXtpZighdFtvXSl7dmFyIGE9dHlwZW9mIHJlcXVpcmU9PVwiZnVuY3Rpb25cIiYmcmVxdWlyZTtpZighdSYmYSlyZXR1cm4gYShvLCEwKTtpZihpKXJldHVybiBpKG8sITApO3ZhciBmPW5ldyBFcnJvcihcIkNhbm5vdCBmaW5kIG1vZHVsZSAnXCIrbytcIidcIik7dGhyb3cgZi5jb2RlPVwiTU9EVUxFX05PVF9GT1VORFwiLGZ9dmFyIGw9bltvXT17ZXhwb3J0czp7fX07dFtvXVswXS5jYWxsKGwuZXhwb3J0cyxmdW5jdGlvbihlKXt2YXIgbj10W29dWzFdW2VdO3JldHVybiBzKG4/bjplKX0sbCxsLmV4cG9ydHMsZSx0LG4scil9cmV0dXJuIG5bb10uZXhwb3J0c312YXIgaT10eXBlb2YgcmVxdWlyZT09XCJmdW5jdGlvblwiJiZyZXF1aXJlO2Zvcih2YXIgbz0wO288ci5sZW5ndGg7bysrKXMocltvXSk7cmV0dXJuIHN9KSIsIi8qKlxuICogVXNlIHR5cGVkIGFycmF5cyBpZiB3ZSBjYW5cbiAqL1xuXG4ndXNlIHN0cmljdCc7XG5cbk9iamVjdC5kZWZpbmVQcm9wZXJ0eShleHBvcnRzLCAnX19lc01vZHVsZScsIHtcbiAgdmFsdWU6IHRydWVcbn0pO1xudmFyIEZhc3RBcnJheSA9IHR5cGVvZiBVaW50MzJBcnJheSA9PT0gJ3VuZGVmaW5lZCcgPyBBcnJheSA6IFVpbnQzMkFycmF5O1xuXG4vKipcbiAqIEJpdCB2ZWN0b3JcbiAqL1xuXG5mdW5jdGlvbiBjcmVhdGVCdihzaXplSW5CaXRzKSB7XG4gIHJldHVybiBuZXcgRmFzdEFycmF5KE1hdGguY2VpbChzaXplSW5CaXRzIC8gMzIpKTtcbn1cblxuZnVuY3Rpb24gc2V0Qml0KHYsIGlkeCkge1xuICB2YXIgciA9IGlkeCAlIDMyO1xuICB2YXIgcG9zID0gKGlkeCAtIHIpIC8gMzI7XG5cbiAgdltwb3NdIHw9IDEgPDwgcjtcbn1cblxuZnVuY3Rpb24gY2xlYXJCaXQodiwgaWR4KSB7XG4gIHZhciByID0gaWR4ICUgMzI7XG4gIHZhciBwb3MgPSAoaWR4IC0gcikgLyAzMjtcblxuICB2W3Bvc10gJj0gfigxIDw8IHIpO1xufVxuXG5mdW5jdGlvbiBnZXRCaXQodiwgaWR4KSB7XG4gIHZhciByID0gaWR4ICUgMzI7XG4gIHZhciBwb3MgPSAoaWR4IC0gcikgLyAzMjtcblxuICByZXR1cm4gISEodltwb3NdICYgMSA8PCByKTtcbn1cblxuLyoqXG4gKiBFeHBvcnRzXG4gKi9cblxuZXhwb3J0c1snZGVmYXVsdCddID0ge1xuICBjcmVhdGVCdjogY3JlYXRlQnYsXG4gIHNldEJpdDogc2V0Qml0LFxuICBjbGVhckJpdDogY2xlYXJCaXQsXG4gIGdldEJpdDogZ2V0Qml0XG59O1xubW9kdWxlLmV4cG9ydHMgPSBleHBvcnRzWydkZWZhdWx0J107IiwiJ3VzZSBzdHJpY3QnO1xuXG5PYmplY3QuZGVmaW5lUHJvcGVydHkoZXhwb3J0cywgXCJfX2VzTW9kdWxlXCIsIHtcbiAgdmFsdWU6IHRydWVcbn0pO1xuZXhwb3J0cy5BY3Rpb25zID0gdW5kZWZpbmVkO1xuZXhwb3J0cy5kaWZmQXR0cmlidXRlcyA9IGRpZmZBdHRyaWJ1dGVzO1xuZXhwb3J0cy5kaWZmQ2hpbGRyZW4gPSBkaWZmQ2hpbGRyZW47XG5leHBvcnRzLmRpZmZOb2RlID0gZGlmZk5vZGU7XG5cbnZhciBfdXRpbHMgPSByZXF1aXJlKCcuLi9zaGFyZWQvdXRpbHMnKTtcblxudmFyIF9kaWZ0ID0gcmVxdWlyZSgnZGlmdCcpO1xuXG52YXIgZGlmZkFjdGlvbnMgPSBfaW50ZXJvcFJlcXVpcmVXaWxkY2FyZChfZGlmdCk7XG5cbnZhciBfdW5pb25UeXBlID0gcmVxdWlyZSgndW5pb24tdHlwZScpO1xuXG52YXIgX3VuaW9uVHlwZTIgPSBfaW50ZXJvcFJlcXVpcmVEZWZhdWx0KF91bmlvblR5cGUpO1xuXG5mdW5jdGlvbiBfaW50ZXJvcFJlcXVpcmVEZWZhdWx0KG9iaikgeyByZXR1cm4gb2JqICYmIG9iai5fX2VzTW9kdWxlID8gb2JqIDogeyBkZWZhdWx0OiBvYmogfTsgfVxuXG5mdW5jdGlvbiBfaW50ZXJvcFJlcXVpcmVXaWxkY2FyZChvYmopIHsgaWYgKG9iaiAmJiBvYmouX19lc01vZHVsZSkgeyByZXR1cm4gb2JqOyB9IGVsc2UgeyB2YXIgbmV3T2JqID0ge307IGlmIChvYmogIT0gbnVsbCkgeyBmb3IgKHZhciBrZXkgaW4gb2JqKSB7IGlmIChPYmplY3QucHJvdG90eXBlLmhhc093blByb3BlcnR5LmNhbGwob2JqLCBrZXkpKSBuZXdPYmpba2V5XSA9IG9ialtrZXldOyB9IH0gbmV3T2JqLmRlZmF1bHQgPSBvYmo7IHJldHVybiBuZXdPYmo7IH0gfVxuXG52YXIgQW55ID0gZnVuY3Rpb24gQW55KCkge1xuICByZXR1cm4gdHJ1ZTtcbn07XG52YXIgUGF0aCA9IGZ1bmN0aW9uIFBhdGgoKSB7XG4gIHJldHVybiBTdHJpbmc7XG59O1xuXG4vKipcbiAqIFBhdGNoIGFjdGlvbnNcbiAqL1xuXG52YXIgQWN0aW9ucyA9IGV4cG9ydHMuQWN0aW9ucyA9ICgwLCBfdW5pb25UeXBlMi5kZWZhdWx0KSh7XG4gIHNldEF0dHJpYnV0ZTogW1N0cmluZywgQW55LCBBbnldLFxuICByZW1vdmVBdHRyaWJ1dGU6IFtTdHJpbmcsIEFueV0sXG4gIGluc2VydENoaWxkOiBbQW55LCBOdW1iZXIsIFBhdGhdLFxuICByZW1vdmVDaGlsZDogW051bWJlcl0sXG4gIHVwZGF0ZUNoaWxkOiBbTnVtYmVyLCBBcnJheV0sXG4gIHVwZGF0ZUNoaWxkcmVuOiBbQXJyYXldLFxuICBpbnNlcnRCZWZvcmU6IFtOdW1iZXJdLFxuICByZXBsYWNlTm9kZTogW0FueSwgQW55LCBQYXRoXSxcbiAgcmVtb3ZlTm9kZTogW0FueV0sXG4gIHNhbWVOb2RlOiBbXSxcbiAgdXBkYXRlVGh1bms6IFtBbnksIEFueSwgUGF0aF1cbn0pO1xuXG4vKipcbiAqIERpZmYgdHdvIGF0dHJpYnV0ZSBvYmplY3RzIGFuZCByZXR1cm4gYW4gYXJyYXkgb2YgYWN0aW9ucyB0aGF0IHJlcHJlc2VudFxuICogY2hhbmdlcyB0byB0cmFuc2Zvcm0gdGhlIG9sZCBvYmplY3QgaW50byB0aGUgbmV3IG9uZS5cbiAqL1xuXG5mdW5jdGlvbiBkaWZmQXR0cmlidXRlcyhwcmV2aW91cywgbmV4dCkge1xuICB2YXIgc2V0QXR0cmlidXRlID0gQWN0aW9ucy5zZXRBdHRyaWJ1dGU7XG4gIHZhciByZW1vdmVBdHRyaWJ1dGUgPSBBY3Rpb25zLnJlbW92ZUF0dHJpYnV0ZTtcblxuICB2YXIgY2hhbmdlcyA9IFtdO1xuICB2YXIgcEF0dHJzID0gcHJldmlvdXMuYXR0cmlidXRlcztcbiAgdmFyIG5BdHRycyA9IG5leHQuYXR0cmlidXRlcztcblxuICBmb3IgKHZhciBuYW1lIGluIG5BdHRycykge1xuICAgIGlmIChuQXR0cnNbbmFtZV0gIT09IHBBdHRyc1tuYW1lXSkge1xuICAgICAgY2hhbmdlcy5wdXNoKHNldEF0dHJpYnV0ZShuYW1lLCBuQXR0cnNbbmFtZV0sIHBBdHRyc1tuYW1lXSkpO1xuICAgIH1cbiAgfVxuXG4gIGZvciAodmFyIG5hbWUgaW4gcEF0dHJzKSB7XG4gICAgaWYgKCEobmFtZSBpbiBuQXR0cnMpKSB7XG4gICAgICBjaGFuZ2VzLnB1c2gocmVtb3ZlQXR0cmlidXRlKG5hbWUsIHBBdHRyc1tuYW1lXSkpO1xuICAgIH1cbiAgfVxuXG4gIHJldHVybiBjaGFuZ2VzO1xufVxuXG4vKipcbiAqIENvbXBhcmUgdHdvIGFycmF5cyBvZiB2aXJ0dWFsIG5vZGVzIGFuZCByZXR1cm4gYW4gYXJyYXkgb2YgYWN0aW9uc1xuICogdG8gdHJhbnNmb3JtIHRoZSBsZWZ0IGludG8gdGhlIHJpZ2h0LiBBIHN0YXJ0aW5nIHBhdGggaXMgc3VwcGxpZWQgdGhhdCB1c2VcbiAqIHJlY3Vyc2l2ZWx5IHRvIGJ1aWxkIHVwIHVuaXF1ZSBwYXRocyBmb3IgZWFjaCBub2RlLlxuICovXG5cbmZ1bmN0aW9uIGRpZmZDaGlsZHJlbihwcmV2aW91cywgbmV4dCwgcGF0aCkge1xuICB2YXIgaW5zZXJ0Q2hpbGQgPSBBY3Rpb25zLmluc2VydENoaWxkO1xuICB2YXIgdXBkYXRlQ2hpbGQgPSBBY3Rpb25zLnVwZGF0ZUNoaWxkO1xuICB2YXIgcmVtb3ZlQ2hpbGQgPSBBY3Rpb25zLnJlbW92ZUNoaWxkO1xuICB2YXIgaW5zZXJ0QmVmb3JlID0gQWN0aW9ucy5pbnNlcnRCZWZvcmU7XG4gIHZhciB1cGRhdGVDaGlsZHJlbiA9IEFjdGlvbnMudXBkYXRlQ2hpbGRyZW47XG4gIHZhciBDUkVBVEUgPSBkaWZmQWN0aW9ucy5DUkVBVEU7XG4gIHZhciBVUERBVEUgPSBkaWZmQWN0aW9ucy5VUERBVEU7XG4gIHZhciBNT1ZFID0gZGlmZkFjdGlvbnMuTU9WRTtcbiAgdmFyIFJFTU9WRSA9IGRpZmZBY3Rpb25zLlJFTU9WRTtcblxuICB2YXIgcHJldmlvdXNDaGlsZHJlbiA9ICgwLCBfdXRpbHMuZ3JvdXBCeUtleSkocHJldmlvdXMuY2hpbGRyZW4pO1xuICB2YXIgbmV4dENoaWxkcmVuID0gKDAsIF91dGlscy5ncm91cEJ5S2V5KShuZXh0LmNoaWxkcmVuKTtcbiAgdmFyIGtleSA9IGZ1bmN0aW9uIGtleShhKSB7XG4gICAgcmV0dXJuIGEua2V5O1xuICB9O1xuICB2YXIgY2hhbmdlcyA9IFtdO1xuXG4gIGZ1bmN0aW9uIGVmZmVjdCh0eXBlLCBwcmV2LCBuZXh0LCBwb3MpIHtcbiAgICB2YXIgbmV4dFBhdGggPSBuZXh0ID8gKDAsIF91dGlscy5jcmVhdGVQYXRoKShwYXRoLCBuZXh0LmtleSA9PSBudWxsID8gbmV4dC5pbmRleCA6IG5leHQua2V5KSA6IG51bGw7XG4gICAgc3dpdGNoICh0eXBlKSB7XG4gICAgICBjYXNlIENSRUFURTpcbiAgICAgICAge1xuICAgICAgICAgIGNoYW5nZXMucHVzaChpbnNlcnRDaGlsZChuZXh0Lml0ZW0sIHBvcywgbmV4dFBhdGgpKTtcbiAgICAgICAgICBicmVhaztcbiAgICAgICAgfVxuICAgICAgY2FzZSBVUERBVEU6XG4gICAgICAgIHtcbiAgICAgICAgICB2YXIgYWN0aW9ucyA9IGRpZmZOb2RlKHByZXYuaXRlbSwgbmV4dC5pdGVtLCBuZXh0UGF0aCk7XG4gICAgICAgICAgaWYgKGFjdGlvbnMubGVuZ3RoID4gMCkge1xuICAgICAgICAgICAgY2hhbmdlcy5wdXNoKHVwZGF0ZUNoaWxkKHByZXYuaW5kZXgsIGFjdGlvbnMpKTtcbiAgICAgICAgICB9XG4gICAgICAgICAgYnJlYWs7XG4gICAgICAgIH1cbiAgICAgIGNhc2UgTU9WRTpcbiAgICAgICAge1xuICAgICAgICAgIHZhciBhY3Rpb25zID0gZGlmZk5vZGUocHJldi5pdGVtLCBuZXh0Lml0ZW0sIG5leHRQYXRoKTtcbiAgICAgICAgICBhY3Rpb25zLnB1c2goaW5zZXJ0QmVmb3JlKHBvcykpO1xuICAgICAgICAgIGNoYW5nZXMucHVzaCh1cGRhdGVDaGlsZChwcmV2LmluZGV4LCBhY3Rpb25zKSk7XG4gICAgICAgICAgYnJlYWs7XG4gICAgICAgIH1cbiAgICAgIGNhc2UgUkVNT1ZFOlxuICAgICAgICB7XG4gICAgICAgICAgY2hhbmdlcy5wdXNoKHJlbW92ZUNoaWxkKHByZXYuaW5kZXgpKTtcbiAgICAgICAgICBicmVhaztcbiAgICAgICAgfVxuICAgIH1cbiAgfVxuXG4gICgwLCBkaWZmQWN0aW9ucy5kZWZhdWx0KShwcmV2aW91c0NoaWxkcmVuLCBuZXh0Q2hpbGRyZW4sIGVmZmVjdCwga2V5KTtcblxuICByZXR1cm4gdXBkYXRlQ2hpbGRyZW4oY2hhbmdlcyk7XG59XG5cbi8qKlxuICogQ29tcGFyZSB0d28gdmlydHVhbCBub2RlcyBhbmQgcmV0dXJuIGFuIGFycmF5IG9mIGNoYW5nZXMgdG8gdHVybiB0aGUgbGVmdFxuICogaW50byB0aGUgcmlnaHQuXG4gKi9cblxuZnVuY3Rpb24gZGlmZk5vZGUocHJldiwgbmV4dCwgcGF0aCkge1xuICB2YXIgY2hhbmdlcyA9IFtdO1xuICB2YXIgcmVwbGFjZU5vZGUgPSBBY3Rpb25zLnJlcGxhY2VOb2RlO1xuICB2YXIgc2V0QXR0cmlidXRlID0gQWN0aW9ucy5zZXRBdHRyaWJ1dGU7XG4gIHZhciBzYW1lTm9kZSA9IEFjdGlvbnMuc2FtZU5vZGU7XG4gIHZhciByZW1vdmVOb2RlID0gQWN0aW9ucy5yZW1vdmVOb2RlO1xuICB2YXIgdXBkYXRlVGh1bmsgPSBBY3Rpb25zLnVwZGF0ZVRodW5rO1xuXG4gIC8vIE5vIGxlZnQgbm9kZSB0byBjb21wYXJlIGl0IHRvXG4gIC8vIFRPRE86IFRoaXMgc2hvdWxkIGp1c3QgcmV0dXJuIGEgY3JlYXRlTm9kZSBhY3Rpb25cblxuICBpZiAocHJldiA9PT0gbnVsbCB8fCBwcmV2ID09PSB1bmRlZmluZWQpIHtcbiAgICB0aHJvdyBuZXcgRXJyb3IoJ0xlZnQgbm9kZSBtdXN0IG5vdCBiZSBudWxsIG9yIHVuZGVmaW5lZCcpO1xuICB9XG5cbiAgLy8gQmFpbCBvdXQgYW5kIHNraXAgdXBkYXRpbmcgdGhpcyB3aG9sZSBzdWItdHJlZVxuICBpZiAocHJldiA9PT0gbmV4dCkge1xuICAgIGNoYW5nZXMucHVzaChzYW1lTm9kZSgpKTtcbiAgICByZXR1cm4gY2hhbmdlcztcbiAgfVxuXG4gIC8vIFJlbW92ZVxuICBpZiAocHJldiAhPSBudWxsICYmIG5leHQgPT0gbnVsbCkge1xuICAgIGNoYW5nZXMucHVzaChyZW1vdmVOb2RlKHByZXYpKTtcbiAgICByZXR1cm4gY2hhbmdlcztcbiAgfVxuXG4gIC8vIFJlcGxhY2VcbiAgaWYgKHByZXYudHlwZSAhPT0gbmV4dC50eXBlKSB7XG4gICAgY2hhbmdlcy5wdXNoKHJlcGxhY2VOb2RlKHByZXYsIG5leHQsIHBhdGgpKTtcbiAgICByZXR1cm4gY2hhbmdlcztcbiAgfVxuXG4gIC8vIFRleHRcbiAgaWYgKCgwLCBfdXRpbHMuaXNUZXh0KShuZXh0KSkge1xuICAgIGlmIChwcmV2Lm5vZGVWYWx1ZSAhPT0gbmV4dC5ub2RlVmFsdWUpIHtcbiAgICAgIGNoYW5nZXMucHVzaChzZXRBdHRyaWJ1dGUoJ25vZGVWYWx1ZScsIG5leHQubm9kZVZhbHVlLCBwcmV2Lm5vZGVWYWx1ZSkpO1xuICAgIH1cbiAgICByZXR1cm4gY2hhbmdlcztcbiAgfVxuXG4gIC8vIFRodW5rXG4gIGlmICgoMCwgX3V0aWxzLmlzVGh1bmspKG5leHQpKSB7XG4gICAgaWYgKCgwLCBfdXRpbHMuaXNTYW1lVGh1bmspKHByZXYsIG5leHQpKSB7XG4gICAgICBjaGFuZ2VzLnB1c2godXBkYXRlVGh1bmsocHJldiwgbmV4dCwgcGF0aCkpO1xuICAgIH0gZWxzZSB7XG4gICAgICBjaGFuZ2VzLnB1c2gocmVwbGFjZU5vZGUocHJldiwgbmV4dCwgcGF0aCkpO1xuICAgIH1cbiAgICByZXR1cm4gY2hhbmdlcztcbiAgfVxuXG4gIGNoYW5nZXMgPSBkaWZmQXR0cmlidXRlcyhwcmV2LCBuZXh0KTtcbiAgY2hhbmdlcy5wdXNoKGRpZmZDaGlsZHJlbihwcmV2LCBuZXh0LCBwYXRoKSk7XG5cbiAgcmV0dXJuIGNoYW5nZXM7XG59IiwiJ3VzZSBzdHJpY3QnO1xuXG5PYmplY3QuZGVmaW5lUHJvcGVydHkoZXhwb3J0cywgXCJfX2VzTW9kdWxlXCIsIHtcbiAgdmFsdWU6IHRydWVcbn0pO1xuZXhwb3J0cy5kZWZhdWx0ID0gY3JlYXRlRWxlbWVudDtcblxudmFyIF9zZXRBdHRyaWJ1dGUgPSByZXF1aXJlKCcuL3NldEF0dHJpYnV0ZScpO1xuXG52YXIgX3V0aWxzID0gcmVxdWlyZSgnLi4vc2hhcmVkL3V0aWxzJyk7XG5cbnZhciBfc3ZnID0gcmVxdWlyZSgnLi4vc2hhcmVkL3N2ZycpO1xuXG52YXIgX3N2ZzIgPSBfaW50ZXJvcFJlcXVpcmVEZWZhdWx0KF9zdmcpO1xuXG5mdW5jdGlvbiBfaW50ZXJvcFJlcXVpcmVEZWZhdWx0KG9iaikgeyByZXR1cm4gb2JqICYmIG9iai5fX2VzTW9kdWxlID8gb2JqIDogeyBkZWZhdWx0OiBvYmogfTsgfVxuXG52YXIgY2FjaGUgPSB7fTtcblxuLyoqXG4gKiBDcmVhdGUgYSByZWFsIERPTSBlbGVtZW50IGZyb20gYSB2aXJ0dWFsIGVsZW1lbnQsIHJlY3Vyc2l2ZWx5IGxvb3BpbmcgZG93bi5cbiAqIFdoZW4gaXQgZmluZHMgY3VzdG9tIGVsZW1lbnRzIGl0IHdpbGwgcmVuZGVyIHRoZW0sIGNhY2hlIHRoZW0sIGFuZCBrZWVwIGdvaW5nLFxuICogc28gdGhleSBhcmUgdHJlYXRlZCBsaWtlIGFueSBvdGhlciBuYXRpdmUgZWxlbWVudC5cbiAqL1xuXG5mdW5jdGlvbiBjcmVhdGVFbGVtZW50KHZub2RlLCBwYXRoLCBkaXNwYXRjaCwgY29udGV4dCkge1xuICBpZiAoKDAsIF91dGlscy5pc1RleHQpKHZub2RlKSkge1xuICAgIHJldHVybiBkb2N1bWVudC5jcmVhdGVUZXh0Tm9kZSh2bm9kZS5ub2RlVmFsdWUgfHwgJycpO1xuICB9XG5cbiAgaWYgKCgwLCBfdXRpbHMuaXNUaHVuaykodm5vZGUpKSB7XG4gICAgdmFyIHByb3BzID0gdm5vZGUucHJvcHM7XG4gICAgdmFyIGRhdGEgPSB2bm9kZS5kYXRhO1xuICAgIHZhciBjaGlsZHJlbiA9IHZub2RlLmNoaWxkcmVuO1xuICAgIHZhciByZW5kZXIgPSBkYXRhLnJlbmRlcjtcbiAgICB2YXIgb25DcmVhdGUgPSBkYXRhLm9uQ3JlYXRlO1xuXG4gICAgdmFyIG1vZGVsID0ge1xuICAgICAgY2hpbGRyZW46IGNoaWxkcmVuLFxuICAgICAgcHJvcHM6IHByb3BzLFxuICAgICAgcGF0aDogcGF0aCxcbiAgICAgIGRpc3BhdGNoOiBkaXNwYXRjaCxcbiAgICAgIGNvbnRleHQ6IGNvbnRleHRcbiAgICB9O1xuICAgIHZhciBvdXRwdXQgPSByZW5kZXIobW9kZWwpO1xuICAgIHZhciBfRE9NRWxlbWVudCA9IGNyZWF0ZUVsZW1lbnQob3V0cHV0LCAoMCwgX3V0aWxzLmNyZWF0ZVBhdGgpKHBhdGgsIG91dHB1dC5rZXkgfHwgJzAnKSwgZGlzcGF0Y2gsIGNvbnRleHQpO1xuICAgIGlmIChvbkNyZWF0ZSkgb25DcmVhdGUobW9kZWwpO1xuICAgIHZub2RlLmRhdGEudm5vZGUgPSBvdXRwdXQ7XG4gICAgdm5vZGUuZGF0YS5tb2RlbCA9IG1vZGVsO1xuICAgIHJldHVybiBfRE9NRWxlbWVudDtcbiAgfVxuXG4gIHZhciBjYWNoZWQgPSBjYWNoZVt2bm9kZS50eXBlXTtcblxuICBpZiAodHlwZW9mIGNhY2hlZCA9PT0gJ3VuZGVmaW5lZCcpIHtcbiAgICBjYWNoZWQgPSBjYWNoZVt2bm9kZS50eXBlXSA9IF9zdmcyLmRlZmF1bHQuaXNFbGVtZW50KHZub2RlLnR5cGUpID8gZG9jdW1lbnQuY3JlYXRlRWxlbWVudE5TKF9zdmcyLmRlZmF1bHQubmFtZXNwYWNlLCB2bm9kZS50eXBlKSA6IGRvY3VtZW50LmNyZWF0ZUVsZW1lbnQodm5vZGUudHlwZSk7XG4gIH1cblxuICB2YXIgRE9NRWxlbWVudCA9IGNhY2hlZC5jbG9uZU5vZGUoZmFsc2UpO1xuXG4gIGZvciAodmFyIG5hbWUgaW4gdm5vZGUuYXR0cmlidXRlcykge1xuICAgICgwLCBfc2V0QXR0cmlidXRlLnNldEF0dHJpYnV0ZSkoRE9NRWxlbWVudCwgbmFtZSwgdm5vZGUuYXR0cmlidXRlc1tuYW1lXSk7XG4gIH1cblxuICB2bm9kZS5jaGlsZHJlbi5mb3JFYWNoKGZ1bmN0aW9uIChub2RlLCBpbmRleCkge1xuICAgIGlmIChub2RlID09PSBudWxsIHx8IG5vZGUgPT09IHVuZGVmaW5lZCkge1xuICAgICAgcmV0dXJuO1xuICAgIH1cbiAgICB2YXIgY2hpbGQgPSBjcmVhdGVFbGVtZW50KG5vZGUsICgwLCBfdXRpbHMuY3JlYXRlUGF0aCkocGF0aCwgbm9kZS5rZXkgfHwgaW5kZXgpLCBkaXNwYXRjaCwgY29udGV4dCk7XG4gICAgRE9NRWxlbWVudC5hcHBlbmRDaGlsZChjaGlsZCk7XG4gIH0pO1xuXG4gIHJldHVybiBET01FbGVtZW50O1xufSIsIid1c2Ugc3RyaWN0JztcblxuT2JqZWN0LmRlZmluZVByb3BlcnR5KGV4cG9ydHMsIFwiX19lc01vZHVsZVwiLCB7XG4gIHZhbHVlOiB0cnVlXG59KTtcbmV4cG9ydHMuZGVmYXVsdCA9IGNyZWF0ZURPTVJlbmRlcmVyO1xuXG52YXIgX2NyZWF0ZUVsZW1lbnQgPSByZXF1aXJlKCcuL2NyZWF0ZUVsZW1lbnQnKTtcblxudmFyIF9jcmVhdGVFbGVtZW50MiA9IF9pbnRlcm9wUmVxdWlyZURlZmF1bHQoX2NyZWF0ZUVsZW1lbnQpO1xuXG52YXIgX2RpZmYgPSByZXF1aXJlKCcuLi9kaWZmJyk7XG5cbnZhciBfcGF0Y2ggPSByZXF1aXJlKCcuL3BhdGNoJyk7XG5cbnZhciBfcGF0Y2gyID0gX2ludGVyb3BSZXF1aXJlRGVmYXVsdChfcGF0Y2gpO1xuXG52YXIgX3VpZCA9IHJlcXVpcmUoJ3VpZCcpO1xuXG52YXIgX3VpZDIgPSBfaW50ZXJvcFJlcXVpcmVEZWZhdWx0KF91aWQpO1xuXG5mdW5jdGlvbiBfaW50ZXJvcFJlcXVpcmVEZWZhdWx0KG9iaikgeyByZXR1cm4gb2JqICYmIG9iai5fX2VzTW9kdWxlID8gb2JqIDogeyBkZWZhdWx0OiBvYmogfTsgfVxuXG4vKipcbiAqIENyZWF0ZSBhIERPTSByZW5kZXJlciB1c2luZyBhIGNvbnRhaW5lciBlbGVtZW50LiBFdmVyeXRoaW5nIHdpbGwgYmUgcmVuZGVyZWRcbiAqIGluc2lkZSBvZiB0aGF0IGNvbnRhaW5lci4gUmV0dXJucyBhIGZ1bmN0aW9uIHRoYXQgYWNjZXB0cyBuZXcgc3RhdGUgdGhhdCBjYW5cbiAqIHJlcGxhY2Ugd2hhdCBpcyBjdXJyZW50bHkgcmVuZGVyZWQuXG4gKi9cblxuZnVuY3Rpb24gY3JlYXRlRE9NUmVuZGVyZXIoY29udGFpbmVyLCBkaXNwYXRjaCkge1xuICB2YXIgb2xkVm5vZGUgPSBudWxsO1xuICB2YXIgbm9kZSA9IG51bGw7XG4gIHZhciBwYXRoID0gKDAsIF91aWQyLmRlZmF1bHQpKCk7XG5cbiAgaWYgKGNvbnRhaW5lciAmJiBjb250YWluZXIuY2hpbGROb2Rlcy5sZW5ndGggPiAwKSB7XG4gICAgY29udGFpbmVyLmlubmVySFRNTCA9ICcnO1xuICB9XG5cbiAgdmFyIHVwZGF0ZSA9IGZ1bmN0aW9uIHVwZGF0ZShuZXdWbm9kZSwgY29udGV4dCkge1xuICAgIHZhciBjaGFuZ2VzID0gKDAsIF9kaWZmLmRpZmZOb2RlKShvbGRWbm9kZSwgbmV3Vm5vZGUsIHBhdGgpO1xuICAgIG5vZGUgPSBjaGFuZ2VzLnJlZHVjZSgoMCwgX3BhdGNoMi5kZWZhdWx0KShkaXNwYXRjaCwgY29udGV4dCksIG5vZGUpO1xuICAgIG9sZFZub2RlID0gbmV3Vm5vZGU7XG4gICAgcmV0dXJuIG5vZGU7XG4gIH07XG5cbiAgdmFyIGNyZWF0ZSA9IGZ1bmN0aW9uIGNyZWF0ZSh2bm9kZSwgY29udGV4dCkge1xuICAgIG5vZGUgPSAoMCwgX2NyZWF0ZUVsZW1lbnQyLmRlZmF1bHQpKHZub2RlLCBwYXRoLCBkaXNwYXRjaCwgY29udGV4dCk7XG4gICAgaWYgKGNvbnRhaW5lcikgY29udGFpbmVyLmFwcGVuZENoaWxkKG5vZGUpO1xuICAgIG9sZFZub2RlID0gdm5vZGU7XG4gICAgcmV0dXJuIG5vZGU7XG4gIH07XG5cbiAgcmV0dXJuIGZ1bmN0aW9uICh2bm9kZSkge1xuICAgIHZhciBjb250ZXh0ID0gYXJndW1lbnRzLmxlbmd0aCA8PSAxIHx8IGFyZ3VtZW50c1sxXSA9PT0gdW5kZWZpbmVkID8ge30gOiBhcmd1bWVudHNbMV07XG5cbiAgICByZXR1cm4gbm9kZSAhPT0gbnVsbCA/IHVwZGF0ZSh2bm9kZSwgY29udGV4dCkgOiBjcmVhdGUodm5vZGUsIGNvbnRleHQpO1xuICB9O1xufSIsIid1c2Ugc3RyaWN0JztcblxuT2JqZWN0LmRlZmluZVByb3BlcnR5KGV4cG9ydHMsIFwiX19lc01vZHVsZVwiLCB7XG4gIHZhbHVlOiB0cnVlXG59KTtcblxudmFyIF9jcmVhdGVSZW5kZXJlciA9IHJlcXVpcmUoJy4vY3JlYXRlUmVuZGVyZXInKTtcblxudmFyIF9jcmVhdGVSZW5kZXJlcjIgPSBfaW50ZXJvcFJlcXVpcmVEZWZhdWx0KF9jcmVhdGVSZW5kZXJlcik7XG5cbnZhciBfY3JlYXRlRWxlbWVudCA9IHJlcXVpcmUoJy4vY3JlYXRlRWxlbWVudCcpO1xuXG52YXIgX2NyZWF0ZUVsZW1lbnQyID0gX2ludGVyb3BSZXF1aXJlRGVmYXVsdChfY3JlYXRlRWxlbWVudCk7XG5cbnZhciBfcGF0Y2ggPSByZXF1aXJlKCcuL3BhdGNoJyk7XG5cbnZhciBfcGF0Y2gyID0gX2ludGVyb3BSZXF1aXJlRGVmYXVsdChfcGF0Y2gpO1xuXG5mdW5jdGlvbiBfaW50ZXJvcFJlcXVpcmVEZWZhdWx0KG9iaikgeyByZXR1cm4gb2JqICYmIG9iai5fX2VzTW9kdWxlID8gb2JqIDogeyBkZWZhdWx0OiBvYmogfTsgfVxuXG5leHBvcnRzLmRlZmF1bHQgPSB7XG4gIGNyZWF0ZVJlbmRlcmVyOiBfY3JlYXRlUmVuZGVyZXIyLmRlZmF1bHQsXG4gIGNyZWF0ZUVsZW1lbnQ6IF9jcmVhdGVFbGVtZW50Mi5kZWZhdWx0LFxuICBwYXRjaDogX3BhdGNoMi5kZWZhdWx0XG59OyIsIid1c2Ugc3RyaWN0JztcblxuT2JqZWN0LmRlZmluZVByb3BlcnR5KGV4cG9ydHMsIFwiX19lc01vZHVsZVwiLCB7XG4gIHZhbHVlOiB0cnVlXG59KTtcbmV4cG9ydHMuZGVmYXVsdCA9IHBhdGNoO1xuXG52YXIgX3NldEF0dHJpYnV0ZTIgPSByZXF1aXJlKCcuL3NldEF0dHJpYnV0ZScpO1xuXG52YXIgX3V0aWxzID0gcmVxdWlyZSgnLi4vc2hhcmVkL3V0aWxzJyk7XG5cbnZhciBfY3JlYXRlRWxlbWVudCA9IHJlcXVpcmUoJy4vY3JlYXRlRWxlbWVudCcpO1xuXG52YXIgX2NyZWF0ZUVsZW1lbnQyID0gX2ludGVyb3BSZXF1aXJlRGVmYXVsdChfY3JlYXRlRWxlbWVudCk7XG5cbnZhciBfZGlmZiA9IHJlcXVpcmUoJy4uL2RpZmYnKTtcblxuZnVuY3Rpb24gX2ludGVyb3BSZXF1aXJlRGVmYXVsdChvYmopIHsgcmV0dXJuIG9iaiAmJiBvYmouX19lc01vZHVsZSA/IG9iaiA6IHsgZGVmYXVsdDogb2JqIH07IH1cblxuLyoqXG4gKiBNb2RpZnkgYSBET00gZWxlbWVudCBnaXZlbiBhbiBhcnJheSBvZiBhY3Rpb25zLiBBIGNvbnRleHQgY2FuIGJlIHNldFxuICogdGhhdCB3aWxsIGJlIHVzZWQgdG8gcmVuZGVyIGFueSBjdXN0b20gZWxlbWVudHMuXG4gKi9cblxuZnVuY3Rpb24gcGF0Y2goZGlzcGF0Y2gsIGNvbnRleHQpIHtcbiAgcmV0dXJuIGZ1bmN0aW9uIChET01FbGVtZW50LCBhY3Rpb24pIHtcbiAgICBfZGlmZi5BY3Rpb25zLmNhc2Uoe1xuICAgICAgc2V0QXR0cmlidXRlOiBmdW5jdGlvbiBzZXRBdHRyaWJ1dGUobmFtZSwgdmFsdWUsIHByZXZpb3VzVmFsdWUpIHtcbiAgICAgICAgKDAsIF9zZXRBdHRyaWJ1dGUyLnNldEF0dHJpYnV0ZSkoRE9NRWxlbWVudCwgbmFtZSwgdmFsdWUsIHByZXZpb3VzVmFsdWUpO1xuICAgICAgfSxcbiAgICAgIHJlbW92ZUF0dHJpYnV0ZTogZnVuY3Rpb24gcmVtb3ZlQXR0cmlidXRlKG5hbWUsIHByZXZpb3VzVmFsdWUpIHtcbiAgICAgICAgKDAsIF9zZXRBdHRyaWJ1dGUyLnJlbW92ZUF0dHJpYnV0ZSkoRE9NRWxlbWVudCwgbmFtZSwgcHJldmlvdXNWYWx1ZSk7XG4gICAgICB9LFxuICAgICAgaW5zZXJ0QmVmb3JlOiBmdW5jdGlvbiBpbnNlcnRCZWZvcmUoaW5kZXgpIHtcbiAgICAgICAgKDAsIF91dGlscy5pbnNlcnRBdEluZGV4KShET01FbGVtZW50LnBhcmVudE5vZGUsIGluZGV4LCBET01FbGVtZW50KTtcbiAgICAgIH0sXG4gICAgICBzYW1lTm9kZTogZnVuY3Rpb24gc2FtZU5vZGUoKSB7fSxcbiAgICAgIHVwZGF0ZUNoaWxkcmVuOiBmdW5jdGlvbiB1cGRhdGVDaGlsZHJlbihjaGFuZ2VzKSB7XG4gICAgICAgIC8vIENyZWF0ZSBhIGNsb25lIG9mIHRoZSBjaGlsZHJlbiBzbyB3ZSBjYW4gcmVmZXJlbmNlIHRoZW0gbGF0ZXJcbiAgICAgICAgLy8gdXNpbmcgdGhlaXIgb3JpZ2luYWwgcG9zaXRpb24gZXZlbiBpZiB0aGV5IG1vdmUgYXJvdW5kXG4gICAgICAgIHZhciBjaGlsZE5vZGVzID0gQXJyYXkucHJvdG90eXBlLnNsaWNlLmFwcGx5KERPTUVsZW1lbnQuY2hpbGROb2Rlcyk7XG5cbiAgICAgICAgY2hhbmdlcy5mb3JFYWNoKGZ1bmN0aW9uIChjaGFuZ2UpIHtcbiAgICAgICAgICBfZGlmZi5BY3Rpb25zLmNhc2Uoe1xuICAgICAgICAgICAgaW5zZXJ0Q2hpbGQ6IGZ1bmN0aW9uIGluc2VydENoaWxkKHZub2RlLCBpbmRleCwgcGF0aCkge1xuICAgICAgICAgICAgICAoMCwgX3V0aWxzLmluc2VydEF0SW5kZXgpKERPTUVsZW1lbnQsIGluZGV4LCAoMCwgX2NyZWF0ZUVsZW1lbnQyLmRlZmF1bHQpKHZub2RlLCBwYXRoLCBkaXNwYXRjaCwgY29udGV4dCkpO1xuICAgICAgICAgICAgfSxcbiAgICAgICAgICAgIHJlbW92ZUNoaWxkOiBmdW5jdGlvbiByZW1vdmVDaGlsZChpbmRleCkge1xuICAgICAgICAgICAgICBET01FbGVtZW50LnJlbW92ZUNoaWxkKGNoaWxkTm9kZXNbaW5kZXhdKTtcbiAgICAgICAgICAgIH0sXG4gICAgICAgICAgICB1cGRhdGVDaGlsZDogZnVuY3Rpb24gdXBkYXRlQ2hpbGQoaW5kZXgsIGFjdGlvbnMpIHtcbiAgICAgICAgICAgICAgdmFyIHVwZGF0ZSA9IHBhdGNoKGRpc3BhdGNoLCBjb250ZXh0KTtcbiAgICAgICAgICAgICAgYWN0aW9ucy5mb3JFYWNoKGZ1bmN0aW9uIChhY3Rpb24pIHtcbiAgICAgICAgICAgICAgICByZXR1cm4gdXBkYXRlKGNoaWxkTm9kZXNbaW5kZXhdLCBhY3Rpb24pO1xuICAgICAgICAgICAgICB9KTtcbiAgICAgICAgICAgIH1cbiAgICAgICAgICB9LCBjaGFuZ2UpO1xuICAgICAgICB9KTtcbiAgICAgIH0sXG4gICAgICB1cGRhdGVUaHVuazogZnVuY3Rpb24gdXBkYXRlVGh1bmsocHJldiwgbmV4dCwgcGF0aCkge1xuICAgICAgICB2YXIgcHJvcHMgPSBuZXh0LnByb3BzO1xuICAgICAgICB2YXIgY2hpbGRyZW4gPSBuZXh0LmNoaWxkcmVuO1xuICAgICAgICB2YXIgX25leHQkZGF0YSA9IG5leHQuZGF0YTtcbiAgICAgICAgdmFyIHJlbmRlciA9IF9uZXh0JGRhdGEucmVuZGVyO1xuICAgICAgICB2YXIgb25VcGRhdGUgPSBfbmV4dCRkYXRhLm9uVXBkYXRlO1xuXG4gICAgICAgIHZhciBwcmV2Tm9kZSA9IHByZXYuZGF0YS52bm9kZTtcbiAgICAgICAgdmFyIG1vZGVsID0ge1xuICAgICAgICAgIGNoaWxkcmVuOiBjaGlsZHJlbixcbiAgICAgICAgICBwcm9wczogcHJvcHMsXG4gICAgICAgICAgcGF0aDogcGF0aCxcbiAgICAgICAgICBkaXNwYXRjaDogZGlzcGF0Y2gsXG4gICAgICAgICAgY29udGV4dDogY29udGV4dFxuICAgICAgICB9O1xuICAgICAgICB2YXIgbmV4dE5vZGUgPSByZW5kZXIobW9kZWwpO1xuICAgICAgICB2YXIgY2hhbmdlcyA9ICgwLCBfZGlmZi5kaWZmTm9kZSkocHJldk5vZGUsIG5leHROb2RlLCBwYXRoKTtcbiAgICAgICAgRE9NRWxlbWVudCA9IGNoYW5nZXMucmVkdWNlKHBhdGNoKGRpc3BhdGNoLCBjb250ZXh0KSwgRE9NRWxlbWVudCk7XG4gICAgICAgIGlmIChvblVwZGF0ZSkgb25VcGRhdGUobW9kZWwpO1xuICAgICAgICBuZXh0LmRhdGEudm5vZGUgPSBuZXh0Tm9kZTtcbiAgICAgICAgbmV4dC5kYXRhLm1vZGVsID0gbW9kZWw7XG4gICAgICB9LFxuICAgICAgcmVwbGFjZU5vZGU6IGZ1bmN0aW9uIHJlcGxhY2VOb2RlKHByZXYsIG5leHQsIHBhdGgpIHtcbiAgICAgICAgdmFyIG5ld0VsID0gKDAsIF9jcmVhdGVFbGVtZW50Mi5kZWZhdWx0KShuZXh0LCBwYXRoLCBkaXNwYXRjaCwgY29udGV4dCk7XG4gICAgICAgIHZhciBwYXJlbnRFbCA9IERPTUVsZW1lbnQucGFyZW50Tm9kZTtcbiAgICAgICAgaWYgKHBhcmVudEVsKSBwYXJlbnRFbC5yZXBsYWNlQ2hpbGQobmV3RWwsIERPTUVsZW1lbnQpO1xuICAgICAgICBET01FbGVtZW50ID0gbmV3RWw7XG4gICAgICAgIHJlbW92ZVRodW5rcyhwcmV2KTtcbiAgICAgIH0sXG4gICAgICByZW1vdmVOb2RlOiBmdW5jdGlvbiByZW1vdmVOb2RlKHByZXYpIHtcbiAgICAgICAgcmVtb3ZlVGh1bmtzKHByZXYpO1xuICAgICAgICBET01FbGVtZW50LnBhcmVudE5vZGUucmVtb3ZlQ2hpbGQoRE9NRWxlbWVudCk7XG4gICAgICAgIERPTUVsZW1lbnQgPSBudWxsO1xuICAgICAgfVxuICAgIH0sIGFjdGlvbik7XG5cbiAgICByZXR1cm4gRE9NRWxlbWVudDtcbiAgfTtcbn1cblxuLyoqXG4gKiBSZWN1cnNpdmVseSByZW1vdmUgYWxsIHRodW5rc1xuICovXG5cbmZ1bmN0aW9uIHJlbW92ZVRodW5rcyh2bm9kZSkge1xuICB3aGlsZSAoKDAsIF91dGlscy5pc1RodW5rKSh2bm9kZSkpIHtcbiAgICB2YXIgX3Zub2RlJGRhdGEgPSB2bm9kZS5kYXRhO1xuICAgIHZhciBvblJlbW92ZSA9IF92bm9kZSRkYXRhLm9uUmVtb3ZlO1xuICAgIHZhciBtb2RlbCA9IF92bm9kZSRkYXRhLm1vZGVsO1xuXG4gICAgaWYgKG9uUmVtb3ZlKSBvblJlbW92ZShtb2RlbCk7XG4gICAgdm5vZGUgPSB2bm9kZS5kYXRhLnZub2RlO1xuICB9XG5cbiAgaWYgKHZub2RlLmNoaWxkcmVuKSB7XG4gICAgZm9yICh2YXIgaSA9IDA7IGkgPCB2bm9kZS5jaGlsZHJlbi5sZW5ndGg7IGkrKykge1xuICAgICAgcmVtb3ZlVGh1bmtzKHZub2RlLmNoaWxkcmVuW2ldKTtcbiAgICB9XG4gIH1cbn0iLCIndXNlIHN0cmljdCc7XG5cbk9iamVjdC5kZWZpbmVQcm9wZXJ0eShleHBvcnRzLCBcIl9fZXNNb2R1bGVcIiwge1xuICB2YWx1ZTogdHJ1ZVxufSk7XG5leHBvcnRzLnJlbW92ZUF0dHJpYnV0ZSA9IHJlbW92ZUF0dHJpYnV0ZTtcbmV4cG9ydHMuc2V0QXR0cmlidXRlID0gc2V0QXR0cmlidXRlO1xuXG52YXIgX3V0aWxzID0gcmVxdWlyZSgnLi4vc2hhcmVkL3V0aWxzJyk7XG5cbnZhciBfZXZlbnRzID0gcmVxdWlyZSgnLi4vc2hhcmVkL2V2ZW50cycpO1xuXG52YXIgX2V2ZW50czIgPSBfaW50ZXJvcFJlcXVpcmVEZWZhdWx0KF9ldmVudHMpO1xuXG52YXIgX3N2ZyA9IHJlcXVpcmUoJy4uL3NoYXJlZC9zdmcnKTtcblxudmFyIF9zdmcyID0gX2ludGVyb3BSZXF1aXJlRGVmYXVsdChfc3ZnKTtcblxudmFyIF9pbmRleE9mID0gcmVxdWlyZSgnaW5kZXgtb2YnKTtcblxudmFyIF9pbmRleE9mMiA9IF9pbnRlcm9wUmVxdWlyZURlZmF1bHQoX2luZGV4T2YpO1xuXG52YXIgX3NldGlmeSA9IHJlcXVpcmUoJ3NldGlmeScpO1xuXG52YXIgX3NldGlmeTIgPSBfaW50ZXJvcFJlcXVpcmVEZWZhdWx0KF9zZXRpZnkpO1xuXG5mdW5jdGlvbiBfaW50ZXJvcFJlcXVpcmVEZWZhdWx0KG9iaikgeyByZXR1cm4gb2JqICYmIG9iai5fX2VzTW9kdWxlID8gb2JqIDogeyBkZWZhdWx0OiBvYmogfTsgfVxuXG5mdW5jdGlvbiByZW1vdmVBdHRyaWJ1dGUoRE9NRWxlbWVudCwgbmFtZSwgcHJldmlvdXNWYWx1ZSkge1xuICB2YXIgZXZlbnRUeXBlID0gX2V2ZW50czIuZGVmYXVsdFtuYW1lXTtcbiAgaWYgKGV2ZW50VHlwZSkge1xuICAgIGlmICh0eXBlb2YgcHJldmlvdXNWYWx1ZSA9PT0gJ2Z1bmN0aW9uJykge1xuICAgICAgRE9NRWxlbWVudC5yZW1vdmVFdmVudExpc3RlbmVyKGV2ZW50VHlwZSwgcHJldmlvdXNWYWx1ZSk7XG4gICAgfVxuICAgIHJldHVybjtcbiAgfVxuICBzd2l0Y2ggKG5hbWUpIHtcbiAgICBjYXNlICdjaGVja2VkJzpcbiAgICBjYXNlICdkaXNhYmxlZCc6XG4gICAgY2FzZSAnc2VsZWN0ZWQnOlxuICAgICAgRE9NRWxlbWVudFtuYW1lXSA9IGZhbHNlO1xuICAgICAgYnJlYWs7XG4gICAgY2FzZSAnaW5uZXJIVE1MJzpcbiAgICBjYXNlICdub2RlVmFsdWUnOlxuICAgICAgRE9NRWxlbWVudC5pbm5lckhUTUwgPSAnJztcbiAgICAgIGJyZWFrO1xuICAgIGNhc2UgJ3ZhbHVlJzpcbiAgICAgIERPTUVsZW1lbnQudmFsdWUgPSAnJztcbiAgICAgIGJyZWFrO1xuICAgIGRlZmF1bHQ6XG4gICAgICBET01FbGVtZW50LnJlbW92ZUF0dHJpYnV0ZShuYW1lKTtcbiAgICAgIGJyZWFrO1xuICB9XG59XG5cbmZ1bmN0aW9uIHNldEF0dHJpYnV0ZShET01FbGVtZW50LCBuYW1lLCB2YWx1ZSwgcHJldmlvdXNWYWx1ZSkge1xuICB2YXIgZXZlbnRUeXBlID0gX2V2ZW50czIuZGVmYXVsdFtuYW1lXTtcbiAgaWYgKHZhbHVlID09PSBwcmV2aW91c1ZhbHVlKSB7XG4gICAgcmV0dXJuO1xuICB9XG4gIGlmIChldmVudFR5cGUpIHtcbiAgICBpZiAodHlwZW9mIHByZXZpb3VzVmFsdWUgPT09ICdmdW5jdGlvbicpIHtcbiAgICAgIERPTUVsZW1lbnQucmVtb3ZlRXZlbnRMaXN0ZW5lcihldmVudFR5cGUsIHByZXZpb3VzVmFsdWUpO1xuICAgIH1cbiAgICBET01FbGVtZW50LmFkZEV2ZW50TGlzdGVuZXIoZXZlbnRUeXBlLCB2YWx1ZSk7XG4gICAgcmV0dXJuO1xuICB9XG4gIGlmICh0eXBlb2YgdmFsdWUgPT09ICdmdW5jdGlvbicpIHtcbiAgICB2YWx1ZSA9IHZhbHVlKERPTUVsZW1lbnQsIG5hbWUpO1xuICB9XG4gIGlmICghKDAsIF91dGlscy5pc1ZhbGlkQXR0cmlidXRlKSh2YWx1ZSkpIHtcbiAgICByZW1vdmVBdHRyaWJ1dGUoRE9NRWxlbWVudCwgbmFtZSwgcHJldmlvdXNWYWx1ZSk7XG4gICAgcmV0dXJuO1xuICB9XG4gIHN3aXRjaCAobmFtZSkge1xuICAgIGNhc2UgJ2NoZWNrZWQnOlxuICAgIGNhc2UgJ2Rpc2FibGVkJzpcbiAgICBjYXNlICdpbm5lckhUTUwnOlxuICAgIGNhc2UgJ25vZGVWYWx1ZSc6XG4gICAgICBET01FbGVtZW50W25hbWVdID0gdmFsdWU7XG4gICAgICBicmVhaztcbiAgICBjYXNlICdzZWxlY3RlZCc6XG4gICAgICBET01FbGVtZW50LnNlbGVjdGVkID0gdmFsdWU7XG4gICAgICAvLyBGaXggZm9yIElFL1NhZmFyaSB3aGVyZSBzZWxlY3QgaXMgbm90IGNvcnJlY3RseSBzZWxlY3RlZCBvbiBjaGFuZ2VcbiAgICAgIGlmIChET01FbGVtZW50LnRhZ05hbWUgPT09ICdPUFRJT04nKSB7XG4gICAgICAgIHZhciBzZWxlY3QgPSBET01FbGVtZW50LnBhcmVudE5vZGU7XG4gICAgICAgIHNlbGVjdC5zZWxlY3RlZEluZGV4ID0gKDAsIF9pbmRleE9mMi5kZWZhdWx0KShzZWxlY3Qub3B0aW9ucywgRE9NRWxlbWVudCk7XG4gICAgICB9XG4gICAgICBicmVhaztcbiAgICBjYXNlICd2YWx1ZSc6XG4gICAgICAoMCwgX3NldGlmeTIuZGVmYXVsdCkoRE9NRWxlbWVudCwgdmFsdWUpO1xuICAgICAgYnJlYWs7XG4gICAgZGVmYXVsdDpcbiAgICAgIGlmIChfc3ZnMi5kZWZhdWx0LmlzQXR0cmlidXRlKG5hbWUpKSB7XG4gICAgICAgIERPTUVsZW1lbnQuc2V0QXR0cmlidXRlTlMoX3N2ZzIuZGVmYXVsdC5uYW1lc3BhY2UsIG5hbWUsIHZhbHVlKTtcbiAgICAgIH0gZWxzZSB7XG4gICAgICAgIERPTUVsZW1lbnQuc2V0QXR0cmlidXRlKG5hbWUsIHZhbHVlKTtcbiAgICAgIH1cbiAgICAgIGJyZWFrO1xuICB9XG59IiwiJ3VzZSBzdHJpY3QnO1xuXG5PYmplY3QuZGVmaW5lUHJvcGVydHkoZXhwb3J0cywgXCJfX2VzTW9kdWxlXCIsIHtcbiAgdmFsdWU6IHRydWVcbn0pO1xuZXhwb3J0cy5kZWZhdWx0ID0gZWxlbWVudDtcbmV4cG9ydHMuY3JlYXRlVGV4dEVsZW1lbnQgPSBjcmVhdGVUZXh0RWxlbWVudDtcbmV4cG9ydHMuY3JlYXRlVGh1bmtFbGVtZW50ID0gY3JlYXRlVGh1bmtFbGVtZW50O1xuXG5mdW5jdGlvbiBfdG9Db25zdW1hYmxlQXJyYXkoYXJyKSB7IGlmIChBcnJheS5pc0FycmF5KGFycikpIHsgZm9yICh2YXIgaSA9IDAsIGFycjIgPSBBcnJheShhcnIubGVuZ3RoKTsgaSA8IGFyci5sZW5ndGg7IGkrKykgeyBhcnIyW2ldID0gYXJyW2ldOyB9IHJldHVybiBhcnIyOyB9IGVsc2UgeyByZXR1cm4gQXJyYXkuZnJvbShhcnIpOyB9IH1cblxuZnVuY3Rpb24gX3R5cGVvZihvYmopIHsgcmV0dXJuIG9iaiAmJiB0eXBlb2YgU3ltYm9sICE9PSBcInVuZGVmaW5lZFwiICYmIG9iai5jb25zdHJ1Y3RvciA9PT0gU3ltYm9sID8gXCJzeW1ib2xcIiA6IHR5cGVvZiBvYmo7IH1cblxuLyoqXG4gKiBUaGlzIGZ1bmN0aW9uIGxldHMgdXMgY3JlYXRlIHZpcnR1YWwgbm9kZXMgdXNpbmcgYSBzaW1wbGVcbiAqIHN5bnRheC4gSXQgaXMgY29tcGF0aWJsZSB3aXRoIEpTWCB0cmFuc2Zvcm1zIHNvIHlvdSBjYW4gdXNlXG4gKiBKU1ggdG8gd3JpdGUgbm9kZXMgdGhhdCB3aWxsIGNvbXBpbGUgdG8gdGhpcyBmdW5jdGlvbi5cbiAqXG4gKiBsZXQgbm9kZSA9IGVsZW1lbnQoJ2RpdicsIHsgaWQ6ICdmb28nIH0sIFtcbiAqICAgZWxlbWVudCgnYScsIHsgaHJlZjogJ2h0dHA6Ly9nb29nbGUuY29tJyB9LFxuICogICAgIGVsZW1lbnQoJ3NwYW4nLCB7fSwgJ0dvb2dsZScpLFxuICogICAgIGVsZW1lbnQoJ2InLCB7fSwgJ0xpbmsnKVxuICogICApXG4gKiBdKVxuICovXG5cbmZ1bmN0aW9uIGVsZW1lbnQodHlwZSwgYXR0cmlidXRlcykge1xuICBmb3IgKHZhciBfbGVuID0gYXJndW1lbnRzLmxlbmd0aCwgY2hpbGRyZW4gPSBBcnJheShfbGVuID4gMiA/IF9sZW4gLSAyIDogMCksIF9rZXkgPSAyOyBfa2V5IDwgX2xlbjsgX2tleSsrKSB7XG4gICAgY2hpbGRyZW5bX2tleSAtIDJdID0gYXJndW1lbnRzW19rZXldO1xuICB9XG5cbiAgaWYgKCF0eXBlKSB0aHJvdyBuZXcgVHlwZUVycm9yKCdlbGVtZW50KCkgbmVlZHMgYSB0eXBlLicpO1xuXG4gIGF0dHJpYnV0ZXMgPSBhdHRyaWJ1dGVzIHx8IHt9O1xuICBjaGlsZHJlbiA9IChjaGlsZHJlbiB8fCBbXSkucmVkdWNlKHJlZHVjZUNoaWxkcmVuLCBbXSk7XG5cbiAgdmFyIGtleSA9IHR5cGVvZiBhdHRyaWJ1dGVzLmtleSA9PT0gJ3N0cmluZycgfHwgdHlwZW9mIGF0dHJpYnV0ZXMua2V5ID09PSAnbnVtYmVyJyA/IGF0dHJpYnV0ZXMua2V5IDogdW5kZWZpbmVkO1xuXG4gIGRlbGV0ZSBhdHRyaWJ1dGVzLmtleTtcblxuICBpZiAoKHR5cGVvZiB0eXBlID09PSAndW5kZWZpbmVkJyA/ICd1bmRlZmluZWQnIDogX3R5cGVvZih0eXBlKSkgPT09ICdvYmplY3QnKSB7XG4gICAgcmV0dXJuIGNyZWF0ZVRodW5rRWxlbWVudCh0eXBlLCBrZXksIGF0dHJpYnV0ZXMsIGNoaWxkcmVuKTtcbiAgfVxuXG4gIHJldHVybiB7XG4gICAgYXR0cmlidXRlczogYXR0cmlidXRlcyxcbiAgICBjaGlsZHJlbjogY2hpbGRyZW4sXG4gICAgdHlwZTogdHlwZSxcbiAgICBrZXk6IGtleVxuICB9O1xufVxuXG5mdW5jdGlvbiByZWR1Y2VDaGlsZHJlbihjaGlsZHJlbiwgdm5vZGUpIHtcbiAgaWYgKHR5cGVvZiB2bm9kZSA9PT0gJ3N0cmluZycgfHwgdHlwZW9mIHZub2RlID09PSAnbnVtYmVyJykge1xuICAgIGNoaWxkcmVuLnB1c2goY3JlYXRlVGV4dEVsZW1lbnQodm5vZGUpKTtcbiAgfSBlbHNlIGlmIChBcnJheS5pc0FycmF5KHZub2RlKSkge1xuICAgIGNoaWxkcmVuID0gW10uY29uY2F0KF90b0NvbnN1bWFibGVBcnJheShjaGlsZHJlbiksIF90b0NvbnN1bWFibGVBcnJheSh2bm9kZSkpO1xuICB9IGVsc2UgaWYgKHR5cGVvZiB2bm9kZSAhPT0gJ3VuZGVmaW5lZCcpIHtcbiAgICBjaGlsZHJlbi5wdXNoKHZub2RlKTtcbiAgfVxuICByZXR1cm4gY2hpbGRyZW47XG59XG5cbmZ1bmN0aW9uIGNyZWF0ZVRleHRFbGVtZW50KHRleHQpIHtcbiAgcmV0dXJuIHtcbiAgICB0eXBlOiAnI3RleHQnLFxuICAgIG5vZGVWYWx1ZTogdGV4dFxuICB9O1xufVxuXG5mdW5jdGlvbiBjcmVhdGVUaHVua0VsZW1lbnQoZGF0YSwga2V5LCBwcm9wcywgY2hpbGRyZW4pIHtcbiAgcmV0dXJuIHtcbiAgICB0eXBlOiAnI3RodW5rJyxcbiAgICBjaGlsZHJlbjogY2hpbGRyZW4sXG4gICAgcHJvcHM6IHByb3BzLFxuICAgIGRhdGE6IGRhdGEsXG4gICAga2V5OiBrZXlcbiAgfTtcbn0iLCIndXNlIHN0cmljdCc7XG5cbk9iamVjdC5kZWZpbmVQcm9wZXJ0eShleHBvcnRzLCBcIl9fZXNNb2R1bGVcIiwge1xuICB2YWx1ZTogdHJ1ZVxufSk7XG5leHBvcnRzLmRvbSA9IGV4cG9ydHMuc3RyaW5nID0gZXhwb3J0cy5lbGVtZW50ID0gdW5kZWZpbmVkO1xuXG52YXIgX2VsZW1lbnQgPSByZXF1aXJlKCcuL2VsZW1lbnQnKTtcblxudmFyIF9lbGVtZW50MiA9IF9pbnRlcm9wUmVxdWlyZURlZmF1bHQoX2VsZW1lbnQpO1xuXG52YXIgX3N0cmluZyA9IHJlcXVpcmUoJy4vc3RyaW5nJyk7XG5cbnZhciBfc3RyaW5nMiA9IF9pbnRlcm9wUmVxdWlyZURlZmF1bHQoX3N0cmluZyk7XG5cbnZhciBfZG9tID0gcmVxdWlyZSgnLi9kb20nKTtcblxudmFyIF9kb20yID0gX2ludGVyb3BSZXF1aXJlRGVmYXVsdChfZG9tKTtcblxuZnVuY3Rpb24gX2ludGVyb3BSZXF1aXJlRGVmYXVsdChvYmopIHsgcmV0dXJuIG9iaiAmJiBvYmouX19lc01vZHVsZSA/IG9iaiA6IHsgZGVmYXVsdDogb2JqIH07IH1cblxuZXhwb3J0cy5lbGVtZW50ID0gX2VsZW1lbnQyLmRlZmF1bHQ7XG5leHBvcnRzLnN0cmluZyA9IF9zdHJpbmcyLmRlZmF1bHQ7XG5leHBvcnRzLmRvbSA9IF9kb20yLmRlZmF1bHQ7IiwiJ3VzZSBzdHJpY3QnO1xuXG5PYmplY3QuZGVmaW5lUHJvcGVydHkoZXhwb3J0cywgXCJfX2VzTW9kdWxlXCIsIHtcbiAgdmFsdWU6IHRydWVcbn0pO1xuLyoqXG4gKiBTcGVjaWFsIGF0dHJpYnV0ZXMgdGhhdCBtYXAgdG8gRE9NIGV2ZW50cy5cbiAqL1xuXG5leHBvcnRzLmRlZmF1bHQgPSB7XG4gIG9uQWJvcnQ6ICdhYm9ydCcsXG4gIG9uQW5pbWF0aW9uU3RhcnQ6ICdhbmltYXRpb25zdGFydCcsXG4gIG9uQW5pbWF0aW9uSXRlcmF0aW9uOiAnYW5pbWF0aW9uaXRlcmF0aW9uJyxcbiAgb25BbmltYXRpb25FbmQ6ICdhbmltYXRpb25lbmQnLFxuICBvbkJsdXI6ICdibHVyJyxcbiAgb25DYW5QbGF5OiAnY2FucGxheScsXG4gIG9uQ2FuUGxheVRocm91Z2g6ICdjYW5wbGF5dGhyb3VnaCcsXG4gIG9uQ2hhbmdlOiAnY2hhbmdlJyxcbiAgb25DbGljazogJ2NsaWNrJyxcbiAgb25Db250ZXh0TWVudTogJ2NvbnRleHRtZW51JyxcbiAgb25Db3B5OiAnY29weScsXG4gIG9uQ3V0OiAnY3V0JyxcbiAgb25Eb3VibGVDbGljazogJ2RibGNsaWNrJyxcbiAgb25EcmFnOiAnZHJhZycsXG4gIG9uRHJhZ0VuZDogJ2RyYWdlbmQnLFxuICBvbkRyYWdFbnRlcjogJ2RyYWdlbnRlcicsXG4gIG9uRHJhZ0V4aXQ6ICdkcmFnZXhpdCcsXG4gIG9uRHJhZ0xlYXZlOiAnZHJhZ2xlYXZlJyxcbiAgb25EcmFnT3ZlcjogJ2RyYWdvdmVyJyxcbiAgb25EcmFnU3RhcnQ6ICdkcmFnc3RhcnQnLFxuICBvbkRyb3A6ICdkcm9wJyxcbiAgb25EdXJhdGlvbkNoYW5nZTogJ2R1cmF0aW9uY2hhbmdlJyxcbiAgb25FbXB0aWVkOiAnZW1wdGllZCcsXG4gIG9uRW5jcnlwdGVkOiAnZW5jcnlwdGVkJyxcbiAgb25FbmRlZDogJ2VuZGVkJyxcbiAgb25FcnJvcjogJ2Vycm9yJyxcbiAgb25Gb2N1czogJ2ZvY3VzJyxcbiAgb25JbnB1dDogJ2lucHV0JyxcbiAgb25JbnZhbGlkOiAnaW52YWxpZCcsXG4gIG9uS2V5RG93bjogJ2tleWRvd24nLFxuICBvbktleVByZXNzOiAna2V5cHJlc3MnLFxuICBvbktleVVwOiAna2V5dXAnLFxuICBvbkxvYWQ6ICdsb2FkJyxcbiAgb25Mb2FkZWREYXRhOiAnbG9hZGVkZGF0YScsXG4gIG9uTG9hZGVkTWV0YWRhdGE6ICdsb2FkZWRtZXRhZGF0YScsXG4gIG9uTG9hZFN0YXJ0OiAnbG9hZHN0YXJ0JyxcbiAgb25QYXVzZTogJ3BhdXNlJyxcbiAgb25QbGF5OiAncGxheScsXG4gIG9uUGxheWluZzogJ3BsYXlpbmcnLFxuICBvblByb2dyZXNzOiAncHJvZ3Jlc3MnLFxuICBvbk1vdXNlRG93bjogJ21vdXNlZG93bicsXG4gIG9uTW91c2VFbnRlcjogJ21vdXNlZW50ZXInLFxuICBvbk1vdXNlTGVhdmU6ICdtb3VzZWxlYXZlJyxcbiAgb25Nb3VzZU1vdmU6ICdtb3VzZW1vdmUnLFxuICBvbk1vdXNlT3V0OiAnbW91c2VvdXQnLFxuICBvbk1vdXNlT3ZlcjogJ21vdXNlb3ZlcicsXG4gIG9uTW91c2VVcDogJ21vdXNldXAnLFxuICBvblBhc3RlOiAncGFzdGUnLFxuICBvblJhdGVDaGFuZ2U6ICdyYXRlY2hhbmdlJyxcbiAgb25SZXNldDogJ3Jlc2V0JyxcbiAgb25TY3JvbGw6ICdzY3JvbGwnLFxuICBvblNlZWtlZDogJ3NlZWtlZCcsXG4gIG9uU2Vla2luZzogJ3NlZWtpbmcnLFxuICBvblN1Ym1pdDogJ3N1Ym1pdCcsXG4gIG9uU3RhbGxlZDogJ3N0YWxsZWQnLFxuICBvblN1c3BlbmQ6ICdzdXNwZW5kJyxcbiAgb25UaW1lVXBkYXRlOiAndGltZXVwZGF0ZScsXG4gIG9uVHJhbnNpdGlvbkVuZDogJ3RyYW5zaXRpb25lbmQnLFxuICBvblRvdWNoQ2FuY2VsOiAndG91Y2hjYW5jZWwnLFxuICBvblRvdWNoRW5kOiAndG91Y2hlbmQnLFxuICBvblRvdWNoTW92ZTogJ3RvdWNobW92ZScsXG4gIG9uVG91Y2hTdGFydDogJ3RvdWNoc3RhcnQnLFxuICBvblZvbHVtZUNoYW5nZTogJ3ZvbHVtZWNoYW5nZScsXG4gIG9uV2FpdGluZzogJ3dhaXRpbmcnLFxuICBvbldoZWVsOiAnd2hlZWwnXG59OyIsIid1c2Ugc3RyaWN0JztcblxuT2JqZWN0LmRlZmluZVByb3BlcnR5KGV4cG9ydHMsIFwiX19lc01vZHVsZVwiLCB7XG4gIHZhbHVlOiB0cnVlXG59KTtcblxudmFyIF9pc1N2Z0VsZW1lbnQgPSByZXF1aXJlKCdpcy1zdmctZWxlbWVudCcpO1xuXG52YXIgX2lzU3ZnQXR0cmlidXRlID0gcmVxdWlyZSgnaXMtc3ZnLWF0dHJpYnV0ZScpO1xuXG52YXIgX2lzU3ZnQXR0cmlidXRlMiA9IF9pbnRlcm9wUmVxdWlyZURlZmF1bHQoX2lzU3ZnQXR0cmlidXRlKTtcblxuZnVuY3Rpb24gX2ludGVyb3BSZXF1aXJlRGVmYXVsdChvYmopIHsgcmV0dXJuIG9iaiAmJiBvYmouX19lc01vZHVsZSA/IG9iaiA6IHsgZGVmYXVsdDogb2JqIH07IH1cblxudmFyIG5hbWVzcGFjZSA9ICdodHRwOi8vd3d3LnczLm9yZy8yMDAwL3N2Zyc7XG5cbmV4cG9ydHMuZGVmYXVsdCA9IHtcbiAgaXNFbGVtZW50OiBfaXNTdmdFbGVtZW50LmlzRWxlbWVudCxcbiAgaXNBdHRyaWJ1dGU6IF9pc1N2Z0F0dHJpYnV0ZTIuZGVmYXVsdCxcbiAgbmFtZXNwYWNlOiBuYW1lc3BhY2Vcbn07IiwiJ3VzZSBzdHJpY3QnO1xuXG5PYmplY3QuZGVmaW5lUHJvcGVydHkoZXhwb3J0cywgXCJfX2VzTW9kdWxlXCIsIHtcbiAgdmFsdWU6IHRydWVcbn0pO1xuZXhwb3J0cy5pc1ZhbGlkQXR0cmlidXRlID0gaXNWYWxpZEF0dHJpYnV0ZTtcbi8qKlxuICogQ2hlY2sgaWYgYW4gYXR0cmlidXRlIHNob3VkbCBiZSByZW5kZXJlZCBpbnRvIHRoZSBET00uXG4gKi9cblxuZnVuY3Rpb24gaXNWYWxpZEF0dHJpYnV0ZSh2YWx1ZSkge1xuICBpZiAodHlwZW9mIHZhbHVlID09PSAnYm9vbGVhbicpIHJldHVybiB2YWx1ZTtcbiAgaWYgKHR5cGVvZiB2YWx1ZSA9PT0gJ2Z1bmN0aW9uJykgcmV0dXJuIGZhbHNlO1xuICBpZiAodmFsdWUgPT09ICcnKSByZXR1cm4gdHJ1ZTtcbiAgaWYgKHZhbHVlID09PSB1bmRlZmluZWQpIHJldHVybiBmYWxzZTtcbiAgaWYgKHZhbHVlID09PSBudWxsKSByZXR1cm4gZmFsc2U7XG4gIGlmICh2YWx1ZSA9PT0gZmFsc2UpIHJldHVybiBmYWxzZTtcbiAgcmV0dXJuIHRydWU7XG59XG5cbi8qKlxuICogR3JvdXAgYW4gYXJyYXkgb2YgdmlydHVhbCBlbGVtZW50cyBieSB0aGVpciBrZXksIHVzaW5nIGluZGV4IGFzIGEgZmFsbGJhY2suXG4gKi9cblxudmFyIGdyb3VwQnlLZXkgPSBleHBvcnRzLmdyb3VwQnlLZXkgPSBmdW5jdGlvbiBncm91cEJ5S2V5KGNoaWxkcmVuKSB7XG4gIHJldHVybiBjaGlsZHJlbi5yZWR1Y2UoZnVuY3Rpb24gKGFjYywgY2hpbGQsIGkpIHtcbiAgICBpZiAoY2hpbGQgIT0gbnVsbCAmJiBjaGlsZCAhPT0gZmFsc2UpIHtcbiAgICAgIGFjYy5wdXNoKHtcbiAgICAgICAga2V5OiBTdHJpbmcoY2hpbGQua2V5IHx8IGkpLFxuICAgICAgICBpdGVtOiBjaGlsZCxcbiAgICAgICAgaW5kZXg6IGlcbiAgICAgIH0pO1xuICAgIH1cbiAgICByZXR1cm4gYWNjO1xuICB9LCBbXSk7XG59O1xuXG4vKipcbiAqIElzIGEgdm5vZGUgYSB0aHVuaz9cbiAqL1xuXG52YXIgaXNUaHVuayA9IGV4cG9ydHMuaXNUaHVuayA9IGZ1bmN0aW9uIGlzVGh1bmsobm9kZSkge1xuICByZXR1cm4gbm9kZS50eXBlID09PSAnI3RodW5rJztcbn07XG5cbi8qKlxuICogSXMgYSB2bm9kZSBhIHRleHQgbm9kZT9cbiAqL1xuXG52YXIgaXNUZXh0ID0gZXhwb3J0cy5pc1RleHQgPSBmdW5jdGlvbiBpc1RleHQobm9kZSkge1xuICByZXR1cm4gbm9kZS50eXBlID09PSAnI3RleHQnO1xufTtcblxuLyoqXG4gKiBEZXRlcm1pbmUgaWYgdHdvIHZpcnR1YWwgbm9kZXMgYXJlIHRoZSBzYW1lIHR5cGVcbiAqL1xuXG52YXIgaXNTYW1lVGh1bmsgPSBleHBvcnRzLmlzU2FtZVRodW5rID0gZnVuY3Rpb24gaXNTYW1lVGh1bmsobGVmdCwgcmlnaHQpIHtcbiAgcmV0dXJuIGlzVGh1bmsobGVmdCkgJiYgaXNUaHVuayhyaWdodCkgJiYgbGVmdC5kYXRhLnJlbmRlciA9PT0gcmlnaHQuZGF0YS5yZW5kZXI7XG59O1xuXG4vKipcbiAqIENyZWF0ZSBhIG5vZGUgcGF0aCwgZWcuICgyMyw1LDIsNCkgPT4gJzIzLjUuMi40J1xuICovXG5cbnZhciBjcmVhdGVQYXRoID0gZXhwb3J0cy5jcmVhdGVQYXRoID0gZnVuY3Rpb24gY3JlYXRlUGF0aCgpIHtcbiAgZm9yICh2YXIgX2xlbiA9IGFyZ3VtZW50cy5sZW5ndGgsIGFyZ3MgPSBBcnJheShfbGVuKSwgX2tleSA9IDA7IF9rZXkgPCBfbGVuOyBfa2V5KyspIHtcbiAgICBhcmdzW19rZXldID0gYXJndW1lbnRzW19rZXldO1xuICB9XG5cbiAgcmV0dXJuIGFyZ3Muam9pbignLicpO1xufTtcblxuLyoqXG4gKiBGaW5kIGEgY2hpbGQgbm9kZSBhdCBhIGdpdmVuIHBhdGguIFRha2VzIGFueSB0cmVlIHRoYXQgdXNlcyBhXG4gKiAnY2hpbGRyZW4nIGtleS4gVGhpcyB3aWxsIHdvcmsgZm9yIGJvdGggdmlydHVhbCBub2RlcyBhbmQgcmVhbFxuICogRE9NIHRyZWVzLlxuICovXG5cbnZhciBmaW5kTm9kZUF0UGF0aCA9IGV4cG9ydHMuZmluZE5vZGVBdFBhdGggPSBmdW5jdGlvbiBmaW5kTm9kZUF0UGF0aChwYXRoLCB0cmVlKSB7XG4gIHZhciBwYXJ0cyA9IHBhdGguc3BsaXQoJy4nKTtcbiAgdmFyIG5vZGUgPSB1bmRlZmluZWQ7XG4gIHdoaWxlIChwYXJ0cy5sZW5ndGgpIHtcbiAgICB2YXIgaW5kZXggPSBwYXJ0cy5zaGlmdCgpO1xuICAgIG5vZGUgPSB0cmVlLmNoaWxkcmVuW2luZGV4XTtcbiAgfVxuICByZXR1cm4gbm9kZTtcbn07XG5cbi8qKlxuICogU2xpZ2h0bHkgbmljZXIgaW5zZXJ0QmVmb3JlXG4gKi9cblxudmFyIGluc2VydEF0SW5kZXggPSBleHBvcnRzLmluc2VydEF0SW5kZXggPSBmdW5jdGlvbiBpbnNlcnRBdEluZGV4KHBhcmVudCwgaW5kZXgsIGVsKSB7XG4gIHZhciB0YXJnZXQgPSBwYXJlbnQuY2hpbGROb2Rlc1tpbmRleF07XG4gIGlmICh0YXJnZXQpIHtcbiAgICBwYXJlbnQuaW5zZXJ0QmVmb3JlKGVsLCB0YXJnZXQpO1xuICB9IGVsc2Uge1xuICAgIHBhcmVudC5hcHBlbmRDaGlsZChlbCk7XG4gIH1cbn07XG5cbi8qKlxuICogUmVtb3ZlIGFuIGVsZW1lbnQgYXQgYW4gaW5kZXhcbiAqL1xuXG52YXIgcmVtb3ZlQXRJbmRleCA9IGV4cG9ydHMucmVtb3ZlQXRJbmRleCA9IGZ1bmN0aW9uIHJlbW92ZUF0SW5kZXgoRE9NRWxlbWVudCwgaW5kZXgpIHtcbiAgRE9NRWxlbWVudC5yZW1vdmVDaGlsZChET01FbGVtZW50LmNoaWxkTm9kZXNbaW5kZXhdKTtcbn07IiwiJ3VzZSBzdHJpY3QnO1xuXG5PYmplY3QuZGVmaW5lUHJvcGVydHkoZXhwb3J0cywgXCJfX2VzTW9kdWxlXCIsIHtcbiAgdmFsdWU6IHRydWVcbn0pO1xuXG52YXIgX3JlbmRlclN0cmluZyA9IHJlcXVpcmUoJy4vcmVuZGVyU3RyaW5nJyk7XG5cbnZhciBfcmVuZGVyU3RyaW5nMiA9IF9pbnRlcm9wUmVxdWlyZURlZmF1bHQoX3JlbmRlclN0cmluZyk7XG5cbmZ1bmN0aW9uIF9pbnRlcm9wUmVxdWlyZURlZmF1bHQob2JqKSB7IHJldHVybiBvYmogJiYgb2JqLl9fZXNNb2R1bGUgPyBvYmogOiB7IGRlZmF1bHQ6IG9iaiB9OyB9XG5cbmV4cG9ydHMuZGVmYXVsdCA9IHtcbiAgcmVuZGVyU3RyaW5nOiBfcmVuZGVyU3RyaW5nMi5kZWZhdWx0XG59OyIsIid1c2Ugc3RyaWN0JztcblxuT2JqZWN0LmRlZmluZVByb3BlcnR5KGV4cG9ydHMsIFwiX19lc01vZHVsZVwiLCB7XG4gIHZhbHVlOiB0cnVlXG59KTtcbmV4cG9ydHMuZGVmYXVsdCA9IHJlbmRlclN0cmluZztcblxudmFyIF91dGlscyA9IHJlcXVpcmUoJy4uL3NoYXJlZC91dGlscycpO1xuXG4vKipcbiAqIFR1cm4gYW4gb2JqZWN0IG9mIGtleS92YWx1ZSBwYWlycyBpbnRvIGEgSFRNTCBhdHRyaWJ1dGUgc3RyaW5nLiBUaGlzXG4gKiBmdW5jdGlvbiBpcyByZXNwb25zaWJsZSBmb3Igd2hhdCBhdHRyaWJ1dGVzIGFyZSBhbGxvd2VkIHRvIGJlIHJlbmRlcmVkIGFuZFxuICogc2hvdWxkIGhhbmRsZSBhbnkgb3RoZXIgc3BlY2lhbCBjYXNlcyBzcGVjaWZpYyB0byBkZWt1LlxuICovXG5cbmZ1bmN0aW9uIGF0dHJpYnV0ZXNUb1N0cmluZyhhdHRyaWJ1dGVzKSB7XG4gIHZhciBzdHIgPSAnJztcbiAgZm9yICh2YXIgbmFtZSBpbiBhdHRyaWJ1dGVzKSB7XG4gICAgdmFyIHZhbHVlID0gYXR0cmlidXRlc1tuYW1lXTtcbiAgICBpZiAobmFtZSA9PT0gJ2lubmVySFRNTCcpIGNvbnRpbnVlO1xuICAgIGlmICgoMCwgX3V0aWxzLmlzVmFsaWRBdHRyaWJ1dGUpKHZhbHVlKSkgc3RyICs9ICcgJyArIG5hbWUgKyAnPVwiJyArIGF0dHJpYnV0ZXNbbmFtZV0gKyAnXCInO1xuICB9XG4gIHJldHVybiBzdHI7XG59XG5cbi8qKlxuICogUmVuZGVyIGEgdmlydHVhbCBlbGVtZW50IHRvIGEgc3RyaW5nLiBZb3UgY2FuIHBhc3MgaW4gYW4gb3B0aW9uIHN0YXRlIGNvbnRleHRcbiAqIG9iamVjdCB0aGF0IHdpbGwgYmUgZ2l2ZW4gdG8gYWxsIGNvbXBvbmVudHMuXG4gKi9cblxuZnVuY3Rpb24gcmVuZGVyU3RyaW5nKGVsZW1lbnQsIGNvbnRleHQpIHtcbiAgdmFyIHBhdGggPSBhcmd1bWVudHMubGVuZ3RoIDw9IDIgfHwgYXJndW1lbnRzWzJdID09PSB1bmRlZmluZWQgPyAnMCcgOiBhcmd1bWVudHNbMl07XG5cbiAgaWYgKCgwLCBfdXRpbHMuaXNUZXh0KShlbGVtZW50KSkge1xuICAgIHJldHVybiBlbGVtZW50Lm5vZGVWYWx1ZTtcbiAgfVxuXG4gIGlmICgoMCwgX3V0aWxzLmlzVGh1bmspKGVsZW1lbnQpKSB7XG4gICAgdmFyIHByb3BzID0gZWxlbWVudC5wcm9wcztcbiAgICB2YXIgZGF0YSA9IGVsZW1lbnQuZGF0YTtcbiAgICB2YXIgX2NoaWxkcmVuID0gZWxlbWVudC5jaGlsZHJlbjtcbiAgICB2YXIgcmVuZGVyID0gZGF0YS5yZW5kZXI7XG5cbiAgICB2YXIgb3V0cHV0ID0gcmVuZGVyKHtcbiAgICAgIGNoaWxkcmVuOiBfY2hpbGRyZW4sXG4gICAgICBwcm9wczogcHJvcHMsXG4gICAgICBwYXRoOiBwYXRoLFxuICAgICAgY29udGV4dDogY29udGV4dFxuICAgIH0pO1xuICAgIHJldHVybiByZW5kZXJTdHJpbmcob3V0cHV0LCBjb250ZXh0LCBwYXRoKTtcbiAgfVxuXG4gIHZhciBhdHRyaWJ1dGVzID0gZWxlbWVudC5hdHRyaWJ1dGVzO1xuICB2YXIgdHlwZSA9IGVsZW1lbnQudHlwZTtcbiAgdmFyIGNoaWxkcmVuID0gZWxlbWVudC5jaGlsZHJlbjtcblxuICB2YXIgaW5uZXJIVE1MID0gYXR0cmlidXRlcy5pbm5lckhUTUw7XG4gIHZhciBzdHIgPSAnPCcgKyB0eXBlICsgYXR0cmlidXRlc1RvU3RyaW5nKGF0dHJpYnV0ZXMpICsgJz4nO1xuXG4gIGlmIChpbm5lckhUTUwpIHtcbiAgICBzdHIgKz0gaW5uZXJIVE1MO1xuICB9IGVsc2Uge1xuICAgIHN0ciArPSBjaGlsZHJlbi5tYXAoZnVuY3Rpb24gKGNoaWxkLCBpKSB7XG4gICAgICByZXR1cm4gcmVuZGVyU3RyaW5nKGNoaWxkLCBjb250ZXh0LCBwYXRoICsgJy4nICsgKGNoaWxkLmtleSA9PSBudWxsID8gaSA6IGNoaWxkLmtleSkpO1xuICAgIH0pLmpvaW4oJycpO1xuICB9XG5cbiAgc3RyICs9ICc8LycgKyB0eXBlICsgJz4nO1xuICByZXR1cm4gc3RyO1xufSIsIid1c2Ugc3RyaWN0JztcblxuT2JqZWN0LmRlZmluZVByb3BlcnR5KGV4cG9ydHMsIFwiX19lc01vZHVsZVwiLCB7XG4gIHZhbHVlOiB0cnVlXG59KTtcbmV4cG9ydHMuUkVNT1ZFID0gZXhwb3J0cy5NT1ZFID0gZXhwb3J0cy5VUERBVEUgPSBleHBvcnRzLkNSRUFURSA9IHVuZGVmaW5lZDtcblxudmFyIF9iaXRWZWN0b3IgPSByZXF1aXJlKCdiaXQtdmVjdG9yJyk7XG5cbi8qKlxuICogQWN0aW9uc1xuICovXG5cbnZhciBDUkVBVEUgPSAwOyAvKipcbiAgICAgICAgICAgICAgICAgKiBJbXBvcnRzXG4gICAgICAgICAgICAgICAgICovXG5cbnZhciBVUERBVEUgPSAxO1xudmFyIE1PVkUgPSAyO1xudmFyIFJFTU9WRSA9IDM7XG5cbi8qKlxuICogZGlmdFxuICovXG5cbmZ1bmN0aW9uIGRpZnQocHJldiwgbmV4dCwgZWZmZWN0LCBrZXkpIHtcbiAgdmFyIHBTdGFydElkeCA9IDA7XG4gIHZhciBuU3RhcnRJZHggPSAwO1xuICB2YXIgcEVuZElkeCA9IHByZXYubGVuZ3RoIC0gMTtcbiAgdmFyIG5FbmRJZHggPSBuZXh0Lmxlbmd0aCAtIDE7XG4gIHZhciBwU3RhcnRJdGVtID0gcHJldltwU3RhcnRJZHhdO1xuICB2YXIgblN0YXJ0SXRlbSA9IG5leHRbblN0YXJ0SWR4XTtcblxuICAvLyBMaXN0IGhlYWQgaXMgdGhlIHNhbWVcbiAgd2hpbGUgKHBTdGFydElkeCA8PSBwRW5kSWR4ICYmIG5TdGFydElkeCA8PSBuRW5kSWR4ICYmIGVxdWFsKHBTdGFydEl0ZW0sIG5TdGFydEl0ZW0pKSB7XG4gICAgZWZmZWN0KFVQREFURSwgcFN0YXJ0SXRlbSwgblN0YXJ0SXRlbSwgblN0YXJ0SWR4KTtcbiAgICBwU3RhcnRJdGVtID0gcHJldlsrK3BTdGFydElkeF07XG4gICAgblN0YXJ0SXRlbSA9IG5leHRbKytuU3RhcnRJZHhdO1xuICB9XG5cbiAgLy8gVGhlIGFib3ZlIGNhc2UgaXMgb3JkZXJzIG9mIG1hZ25pdHVkZSBtb3JlIGNvbW1vbiB0aGFuIHRoZSBvdGhlcnMsIHNvIGZhc3QtcGF0aCBpdFxuICBpZiAoblN0YXJ0SWR4ID4gbkVuZElkeCAmJiBwU3RhcnRJZHggPiBwRW5kSWR4KSB7XG4gICAgcmV0dXJuO1xuICB9XG5cbiAgdmFyIHBFbmRJdGVtID0gcHJldltwRW5kSWR4XTtcbiAgdmFyIG5FbmRJdGVtID0gbmV4dFtuRW5kSWR4XTtcbiAgdmFyIG1vdmVkRnJvbUZyb250ID0gMDtcblxuICAvLyBSZXZlcnNlZFxuICB3aGlsZSAocFN0YXJ0SWR4IDw9IHBFbmRJZHggJiYgblN0YXJ0SWR4IDw9IG5FbmRJZHggJiYgZXF1YWwocFN0YXJ0SXRlbSwgbkVuZEl0ZW0pKSB7XG4gICAgZWZmZWN0KE1PVkUsIHBTdGFydEl0ZW0sIG5FbmRJdGVtLCBwRW5kSWR4IC0gbW92ZWRGcm9tRnJvbnQgKyAxKTtcbiAgICBwU3RhcnRJdGVtID0gcHJldlsrK3BTdGFydElkeF07XG4gICAgbkVuZEl0ZW0gPSBuZXh0Wy0tbkVuZElkeF07XG4gICAgKyttb3ZlZEZyb21Gcm9udDtcbiAgfVxuXG4gIC8vIFJldmVyc2VkIHRoZSBvdGhlciB3YXkgKGluIGNhc2Ugb2YgZS5nLiByZXZlcnNlIGFuZCBhcHBlbmQpXG4gIHdoaWxlIChwRW5kSWR4ID49IHBTdGFydElkeCAmJiBuU3RhcnRJZHggPD0gbkVuZElkeCAmJiBlcXVhbChuU3RhcnRJdGVtLCBwRW5kSXRlbSkpIHtcbiAgICBlZmZlY3QoTU9WRSwgcEVuZEl0ZW0sIG5TdGFydEl0ZW0sIG5TdGFydElkeCk7XG4gICAgcEVuZEl0ZW0gPSBwcmV2Wy0tcEVuZElkeF07XG4gICAgblN0YXJ0SXRlbSA9IG5leHRbKytuU3RhcnRJZHhdO1xuICAgIC0tbW92ZWRGcm9tRnJvbnQ7XG4gIH1cblxuICAvLyBMaXN0IHRhaWwgaXMgdGhlIHNhbWVcbiAgd2hpbGUgKHBFbmRJZHggPj0gcFN0YXJ0SWR4ICYmIG5FbmRJZHggPj0gblN0YXJ0SWR4ICYmIGVxdWFsKHBFbmRJdGVtLCBuRW5kSXRlbSkpIHtcbiAgICBlZmZlY3QoVVBEQVRFLCBwRW5kSXRlbSwgbkVuZEl0ZW0sIG5FbmRJZHgpO1xuICAgIHBFbmRJdGVtID0gcHJldlstLXBFbmRJZHhdO1xuICAgIG5FbmRJdGVtID0gbmV4dFstLW5FbmRJZHhdO1xuICB9XG5cbiAgaWYgKHBTdGFydElkeCA+IHBFbmRJZHgpIHtcbiAgICB3aGlsZSAoblN0YXJ0SWR4IDw9IG5FbmRJZHgpIHtcbiAgICAgIGVmZmVjdChDUkVBVEUsIG51bGwsIG5TdGFydEl0ZW0sIG5TdGFydElkeCk7XG4gICAgICBuU3RhcnRJdGVtID0gbmV4dFsrK25TdGFydElkeF07XG4gICAgfVxuXG4gICAgcmV0dXJuO1xuICB9XG5cbiAgaWYgKG5TdGFydElkeCA+IG5FbmRJZHgpIHtcbiAgICB3aGlsZSAocFN0YXJ0SWR4IDw9IHBFbmRJZHgpIHtcbiAgICAgIGVmZmVjdChSRU1PVkUsIHBTdGFydEl0ZW0pO1xuICAgICAgcFN0YXJ0SXRlbSA9IHByZXZbKytwU3RhcnRJZHhdO1xuICAgIH1cblxuICAgIHJldHVybjtcbiAgfVxuXG4gIHZhciBjcmVhdGVkID0gMDtcbiAgdmFyIHBpdm90RGVzdCA9IG51bGw7XG4gIHZhciBwaXZvdElkeCA9IHBTdGFydElkeCAtIG1vdmVkRnJvbUZyb250O1xuICB2YXIga2VlcEJhc2UgPSBwU3RhcnRJZHg7XG4gIHZhciBrZWVwID0gKDAsIF9iaXRWZWN0b3IuY3JlYXRlQnYpKHBFbmRJZHggLSBwU3RhcnRJZHgpO1xuXG4gIHZhciBwcmV2TWFwID0ga2V5TWFwKHByZXYsIHBTdGFydElkeCwgcEVuZElkeCArIDEsIGtleSk7XG5cbiAgZm9yICg7IG5TdGFydElkeCA8PSBuRW5kSWR4OyBuU3RhcnRJdGVtID0gbmV4dFsrK25TdGFydElkeF0pIHtcbiAgICB2YXIgb2xkSWR4ID0gcHJldk1hcFtrZXkoblN0YXJ0SXRlbSldO1xuXG4gICAgaWYgKGlzVW5kZWZpbmVkKG9sZElkeCkpIHtcbiAgICAgIGVmZmVjdChDUkVBVEUsIG51bGwsIG5TdGFydEl0ZW0sIHBpdm90SWR4KyspO1xuICAgICAgKytjcmVhdGVkO1xuICAgIH0gZWxzZSBpZiAocFN0YXJ0SWR4ICE9PSBvbGRJZHgpIHtcbiAgICAgICgwLCBfYml0VmVjdG9yLnNldEJpdCkoa2VlcCwgb2xkSWR4IC0ga2VlcEJhc2UpO1xuICAgICAgZWZmZWN0KE1PVkUsIHByZXZbb2xkSWR4XSwgblN0YXJ0SXRlbSwgcGl2b3RJZHgrKyk7XG4gICAgfSBlbHNlIHtcbiAgICAgIHBpdm90RGVzdCA9IG5TdGFydElkeDtcbiAgICB9XG4gIH1cblxuICBpZiAocGl2b3REZXN0ICE9PSBudWxsKSB7XG4gICAgKDAsIF9iaXRWZWN0b3Iuc2V0Qml0KShrZWVwLCAwKTtcbiAgICBlZmZlY3QoTU9WRSwgcHJldltwU3RhcnRJZHhdLCBuZXh0W3Bpdm90RGVzdF0sIHBpdm90RGVzdCk7XG4gIH1cblxuICAvLyBJZiB0aGVyZSBhcmUgbm8gY3JlYXRpb25zLCB0aGVuIHlvdSBoYXZlIHRvXG4gIC8vIHJlbW92ZSBleGFjdGx5IG1heChwcmV2TGVuIC0gbmV4dExlbiwgMCkgZWxlbWVudHMgaW4gdGhpc1xuICAvLyBkaWZmLiBZb3UgaGF2ZSB0byByZW1vdmUgb25lIG1vcmUgZm9yIGVhY2ggZWxlbWVudFxuICAvLyB0aGF0IHdhcyBjcmVhdGVkLiBUaGlzIG1lYW5zIG9uY2Ugd2UgaGF2ZVxuICAvLyByZW1vdmVkIHRoYXQgbWFueSwgd2UgY2FuIHN0b3AuXG4gIHZhciBuZWNlc3NhcnlSZW1vdmFscyA9IHByZXYubGVuZ3RoIC0gbmV4dC5sZW5ndGggKyBjcmVhdGVkO1xuICBmb3IgKHZhciByZW1vdmFscyA9IDA7IHJlbW92YWxzIDwgbmVjZXNzYXJ5UmVtb3ZhbHM7IHBTdGFydEl0ZW0gPSBwcmV2WysrcFN0YXJ0SWR4XSkge1xuICAgIGlmICghKDAsIF9iaXRWZWN0b3IuZ2V0Qml0KShrZWVwLCBwU3RhcnRJZHggLSBrZWVwQmFzZSkpIHtcbiAgICAgIGVmZmVjdChSRU1PVkUsIHBTdGFydEl0ZW0pO1xuICAgICAgKytyZW1vdmFscztcbiAgICB9XG4gIH1cblxuICBmdW5jdGlvbiBlcXVhbChhLCBiKSB7XG4gICAgcmV0dXJuIGtleShhKSA9PT0ga2V5KGIpO1xuICB9XG59XG5cbmZ1bmN0aW9uIGlzVW5kZWZpbmVkKHZhbCkge1xuICByZXR1cm4gdHlwZW9mIHZhbCA9PT0gJ3VuZGVmaW5lZCc7XG59XG5cbmZ1bmN0aW9uIGtleU1hcChpdGVtcywgc3RhcnQsIGVuZCwga2V5KSB7XG4gIHZhciBtYXAgPSB7fTtcblxuICBmb3IgKHZhciBpID0gc3RhcnQ7IGkgPCBlbmQ7ICsraSkge1xuICAgIG1hcFtrZXkoaXRlbXNbaV0pXSA9IGk7XG4gIH1cblxuICByZXR1cm4gbWFwO1xufVxuXG4vKipcbiAqIEV4cG9ydHNcbiAqL1xuXG5leHBvcnRzLmRlZmF1bHQgPSBkaWZ0O1xuZXhwb3J0cy5DUkVBVEUgPSBDUkVBVEU7XG5leHBvcnRzLlVQREFURSA9IFVQREFURTtcbmV4cG9ydHMuTU9WRSA9IE1PVkU7XG5leHBvcnRzLlJFTU9WRSA9IFJFTU9WRTsiLCIvLyBDb3B5cmlnaHQgSm95ZW50LCBJbmMuIGFuZCBvdGhlciBOb2RlIGNvbnRyaWJ1dG9ycy5cbi8vXG4vLyBQZXJtaXNzaW9uIGlzIGhlcmVieSBncmFudGVkLCBmcmVlIG9mIGNoYXJnZSwgdG8gYW55IHBlcnNvbiBvYnRhaW5pbmcgYVxuLy8gY29weSBvZiB0aGlzIHNvZnR3YXJlIGFuZCBhc3NvY2lhdGVkIGRvY3VtZW50YXRpb24gZmlsZXMgKHRoZVxuLy8gXCJTb2Z0d2FyZVwiKSwgdG8gZGVhbCBpbiB0aGUgU29mdHdhcmUgd2l0aG91dCByZXN0cmljdGlvbiwgaW5jbHVkaW5nXG4vLyB3aXRob3V0IGxpbWl0YXRpb24gdGhlIHJpZ2h0cyB0byB1c2UsIGNvcHksIG1vZGlmeSwgbWVyZ2UsIHB1Ymxpc2gsXG4vLyBkaXN0cmlidXRlLCBzdWJsaWNlbnNlLCBhbmQvb3Igc2VsbCBjb3BpZXMgb2YgdGhlIFNvZnR3YXJlLCBhbmQgdG8gcGVybWl0XG4vLyBwZXJzb25zIHRvIHdob20gdGhlIFNvZnR3YXJlIGlzIGZ1cm5pc2hlZCB0byBkbyBzbywgc3ViamVjdCB0byB0aGVcbi8vIGZvbGxvd2luZyBjb25kaXRpb25zOlxuLy9cbi8vIFRoZSBhYm92ZSBjb3B5cmlnaHQgbm90aWNlIGFuZCB0aGlzIHBlcm1pc3Npb24gbm90aWNlIHNoYWxsIGJlIGluY2x1ZGVkXG4vLyBpbiBhbGwgY29waWVzIG9yIHN1YnN0YW50aWFsIHBvcnRpb25zIG9mIHRoZSBTb2Z0d2FyZS5cbi8vXG4vLyBUSEUgU09GVFdBUkUgSVMgUFJPVklERUQgXCJBUyBJU1wiLCBXSVRIT1VUIFdBUlJBTlRZIE9GIEFOWSBLSU5ELCBFWFBSRVNTXG4vLyBPUiBJTVBMSUVELCBJTkNMVURJTkcgQlVUIE5PVCBMSU1JVEVEIFRPIFRIRSBXQVJSQU5USUVTIE9GXG4vLyBNRVJDSEFOVEFCSUxJVFksIEZJVE5FU1MgRk9SIEEgUEFSVElDVUxBUiBQVVJQT1NFIEFORCBOT05JTkZSSU5HRU1FTlQuIElOXG4vLyBOTyBFVkVOVCBTSEFMTCBUSEUgQVVUSE9SUyBPUiBDT1BZUklHSFQgSE9MREVSUyBCRSBMSUFCTEUgRk9SIEFOWSBDTEFJTSxcbi8vIERBTUFHRVMgT1IgT1RIRVIgTElBQklMSVRZLCBXSEVUSEVSIElOIEFOIEFDVElPTiBPRiBDT05UUkFDVCwgVE9SVCBPUlxuLy8gT1RIRVJXSVNFLCBBUklTSU5HIEZST00sIE9VVCBPRiBPUiBJTiBDT05ORUNUSU9OIFdJVEggVEhFIFNPRlRXQVJFIE9SIFRIRVxuLy8gVVNFIE9SIE9USEVSIERFQUxJTkdTIElOIFRIRSBTT0ZUV0FSRS5cblxuZnVuY3Rpb24gRXZlbnRFbWl0dGVyKCkge1xuICB0aGlzLl9ldmVudHMgPSB0aGlzLl9ldmVudHMgfHwge307XG4gIHRoaXMuX21heExpc3RlbmVycyA9IHRoaXMuX21heExpc3RlbmVycyB8fCB1bmRlZmluZWQ7XG59XG5tb2R1bGUuZXhwb3J0cyA9IEV2ZW50RW1pdHRlcjtcblxuLy8gQmFja3dhcmRzLWNvbXBhdCB3aXRoIG5vZGUgMC4xMC54XG5FdmVudEVtaXR0ZXIuRXZlbnRFbWl0dGVyID0gRXZlbnRFbWl0dGVyO1xuXG5FdmVudEVtaXR0ZXIucHJvdG90eXBlLl9ldmVudHMgPSB1bmRlZmluZWQ7XG5FdmVudEVtaXR0ZXIucHJvdG90eXBlLl9tYXhMaXN0ZW5lcnMgPSB1bmRlZmluZWQ7XG5cbi8vIEJ5IGRlZmF1bHQgRXZlbnRFbWl0dGVycyB3aWxsIHByaW50IGEgd2FybmluZyBpZiBtb3JlIHRoYW4gMTAgbGlzdGVuZXJzIGFyZVxuLy8gYWRkZWQgdG8gaXQuIFRoaXMgaXMgYSB1c2VmdWwgZGVmYXVsdCB3aGljaCBoZWxwcyBmaW5kaW5nIG1lbW9yeSBsZWFrcy5cbkV2ZW50RW1pdHRlci5kZWZhdWx0TWF4TGlzdGVuZXJzID0gMTA7XG5cbi8vIE9idmlvdXNseSBub3QgYWxsIEVtaXR0ZXJzIHNob3VsZCBiZSBsaW1pdGVkIHRvIDEwLiBUaGlzIGZ1bmN0aW9uIGFsbG93c1xuLy8gdGhhdCB0byBiZSBpbmNyZWFzZWQuIFNldCB0byB6ZXJvIGZvciB1bmxpbWl0ZWQuXG5FdmVudEVtaXR0ZXIucHJvdG90eXBlLnNldE1heExpc3RlbmVycyA9IGZ1bmN0aW9uKG4pIHtcbiAgaWYgKCFpc051bWJlcihuKSB8fCBuIDwgMCB8fCBpc05hTihuKSlcbiAgICB0aHJvdyBUeXBlRXJyb3IoJ24gbXVzdCBiZSBhIHBvc2l0aXZlIG51bWJlcicpO1xuICB0aGlzLl9tYXhMaXN0ZW5lcnMgPSBuO1xuICByZXR1cm4gdGhpcztcbn07XG5cbkV2ZW50RW1pdHRlci5wcm90b3R5cGUuZW1pdCA9IGZ1bmN0aW9uKHR5cGUpIHtcbiAgdmFyIGVyLCBoYW5kbGVyLCBsZW4sIGFyZ3MsIGksIGxpc3RlbmVycztcblxuICBpZiAoIXRoaXMuX2V2ZW50cylcbiAgICB0aGlzLl9ldmVudHMgPSB7fTtcblxuICAvLyBJZiB0aGVyZSBpcyBubyAnZXJyb3InIGV2ZW50IGxpc3RlbmVyIHRoZW4gdGhyb3cuXG4gIGlmICh0eXBlID09PSAnZXJyb3InKSB7XG4gICAgaWYgKCF0aGlzLl9ldmVudHMuZXJyb3IgfHxcbiAgICAgICAgKGlzT2JqZWN0KHRoaXMuX2V2ZW50cy5lcnJvcikgJiYgIXRoaXMuX2V2ZW50cy5lcnJvci5sZW5ndGgpKSB7XG4gICAgICBlciA9IGFyZ3VtZW50c1sxXTtcbiAgICAgIGlmIChlciBpbnN0YW5jZW9mIEVycm9yKSB7XG4gICAgICAgIHRocm93IGVyOyAvLyBVbmhhbmRsZWQgJ2Vycm9yJyBldmVudFxuICAgICAgfVxuICAgICAgdGhyb3cgVHlwZUVycm9yKCdVbmNhdWdodCwgdW5zcGVjaWZpZWQgXCJlcnJvclwiIGV2ZW50LicpO1xuICAgIH1cbiAgfVxuXG4gIGhhbmRsZXIgPSB0aGlzLl9ldmVudHNbdHlwZV07XG5cbiAgaWYgKGlzVW5kZWZpbmVkKGhhbmRsZXIpKVxuICAgIHJldHVybiBmYWxzZTtcblxuICBpZiAoaXNGdW5jdGlvbihoYW5kbGVyKSkge1xuICAgIHN3aXRjaCAoYXJndW1lbnRzLmxlbmd0aCkge1xuICAgICAgLy8gZmFzdCBjYXNlc1xuICAgICAgY2FzZSAxOlxuICAgICAgICBoYW5kbGVyLmNhbGwodGhpcyk7XG4gICAgICAgIGJyZWFrO1xuICAgICAgY2FzZSAyOlxuICAgICAgICBoYW5kbGVyLmNhbGwodGhpcywgYXJndW1lbnRzWzFdKTtcbiAgICAgICAgYnJlYWs7XG4gICAgICBjYXNlIDM6XG4gICAgICAgIGhhbmRsZXIuY2FsbCh0aGlzLCBhcmd1bWVudHNbMV0sIGFyZ3VtZW50c1syXSk7XG4gICAgICAgIGJyZWFrO1xuICAgICAgLy8gc2xvd2VyXG4gICAgICBkZWZhdWx0OlxuICAgICAgICBhcmdzID0gQXJyYXkucHJvdG90eXBlLnNsaWNlLmNhbGwoYXJndW1lbnRzLCAxKTtcbiAgICAgICAgaGFuZGxlci5hcHBseSh0aGlzLCBhcmdzKTtcbiAgICB9XG4gIH0gZWxzZSBpZiAoaXNPYmplY3QoaGFuZGxlcikpIHtcbiAgICBhcmdzID0gQXJyYXkucHJvdG90eXBlLnNsaWNlLmNhbGwoYXJndW1lbnRzLCAxKTtcbiAgICBsaXN0ZW5lcnMgPSBoYW5kbGVyLnNsaWNlKCk7XG4gICAgbGVuID0gbGlzdGVuZXJzLmxlbmd0aDtcbiAgICBmb3IgKGkgPSAwOyBpIDwgbGVuOyBpKyspXG4gICAgICBsaXN0ZW5lcnNbaV0uYXBwbHkodGhpcywgYXJncyk7XG4gIH1cblxuICByZXR1cm4gdHJ1ZTtcbn07XG5cbkV2ZW50RW1pdHRlci5wcm90b3R5cGUuYWRkTGlzdGVuZXIgPSBmdW5jdGlvbih0eXBlLCBsaXN0ZW5lcikge1xuICB2YXIgbTtcblxuICBpZiAoIWlzRnVuY3Rpb24obGlzdGVuZXIpKVxuICAgIHRocm93IFR5cGVFcnJvcignbGlzdGVuZXIgbXVzdCBiZSBhIGZ1bmN0aW9uJyk7XG5cbiAgaWYgKCF0aGlzLl9ldmVudHMpXG4gICAgdGhpcy5fZXZlbnRzID0ge307XG5cbiAgLy8gVG8gYXZvaWQgcmVjdXJzaW9uIGluIHRoZSBjYXNlIHRoYXQgdHlwZSA9PT0gXCJuZXdMaXN0ZW5lclwiISBCZWZvcmVcbiAgLy8gYWRkaW5nIGl0IHRvIHRoZSBsaXN0ZW5lcnMsIGZpcnN0IGVtaXQgXCJuZXdMaXN0ZW5lclwiLlxuICBpZiAodGhpcy5fZXZlbnRzLm5ld0xpc3RlbmVyKVxuICAgIHRoaXMuZW1pdCgnbmV3TGlzdGVuZXInLCB0eXBlLFxuICAgICAgICAgICAgICBpc0Z1bmN0aW9uKGxpc3RlbmVyLmxpc3RlbmVyKSA/XG4gICAgICAgICAgICAgIGxpc3RlbmVyLmxpc3RlbmVyIDogbGlzdGVuZXIpO1xuXG4gIGlmICghdGhpcy5fZXZlbnRzW3R5cGVdKVxuICAgIC8vIE9wdGltaXplIHRoZSBjYXNlIG9mIG9uZSBsaXN0ZW5lci4gRG9uJ3QgbmVlZCB0aGUgZXh0cmEgYXJyYXkgb2JqZWN0LlxuICAgIHRoaXMuX2V2ZW50c1t0eXBlXSA9IGxpc3RlbmVyO1xuICBlbHNlIGlmIChpc09iamVjdCh0aGlzLl9ldmVudHNbdHlwZV0pKVxuICAgIC8vIElmIHdlJ3ZlIGFscmVhZHkgZ290IGFuIGFycmF5LCBqdXN0IGFwcGVuZC5cbiAgICB0aGlzLl9ldmVudHNbdHlwZV0ucHVzaChsaXN0ZW5lcik7XG4gIGVsc2VcbiAgICAvLyBBZGRpbmcgdGhlIHNlY29uZCBlbGVtZW50LCBuZWVkIHRvIGNoYW5nZSB0byBhcnJheS5cbiAgICB0aGlzLl9ldmVudHNbdHlwZV0gPSBbdGhpcy5fZXZlbnRzW3R5cGVdLCBsaXN0ZW5lcl07XG5cbiAgLy8gQ2hlY2sgZm9yIGxpc3RlbmVyIGxlYWtcbiAgaWYgKGlzT2JqZWN0KHRoaXMuX2V2ZW50c1t0eXBlXSkgJiYgIXRoaXMuX2V2ZW50c1t0eXBlXS53YXJuZWQpIHtcbiAgICBpZiAoIWlzVW5kZWZpbmVkKHRoaXMuX21heExpc3RlbmVycykpIHtcbiAgICAgIG0gPSB0aGlzLl9tYXhMaXN0ZW5lcnM7XG4gICAgfSBlbHNlIHtcbiAgICAgIG0gPSBFdmVudEVtaXR0ZXIuZGVmYXVsdE1heExpc3RlbmVycztcbiAgICB9XG5cbiAgICBpZiAobSAmJiBtID4gMCAmJiB0aGlzLl9ldmVudHNbdHlwZV0ubGVuZ3RoID4gbSkge1xuICAgICAgdGhpcy5fZXZlbnRzW3R5cGVdLndhcm5lZCA9IHRydWU7XG4gICAgICBjb25zb2xlLmVycm9yKCcobm9kZSkgd2FybmluZzogcG9zc2libGUgRXZlbnRFbWl0dGVyIG1lbW9yeSAnICtcbiAgICAgICAgICAgICAgICAgICAgJ2xlYWsgZGV0ZWN0ZWQuICVkIGxpc3RlbmVycyBhZGRlZC4gJyArXG4gICAgICAgICAgICAgICAgICAgICdVc2UgZW1pdHRlci5zZXRNYXhMaXN0ZW5lcnMoKSB0byBpbmNyZWFzZSBsaW1pdC4nLFxuICAgICAgICAgICAgICAgICAgICB0aGlzLl9ldmVudHNbdHlwZV0ubGVuZ3RoKTtcbiAgICAgIGlmICh0eXBlb2YgY29uc29sZS50cmFjZSA9PT0gJ2Z1bmN0aW9uJykge1xuICAgICAgICAvLyBub3Qgc3VwcG9ydGVkIGluIElFIDEwXG4gICAgICAgIGNvbnNvbGUudHJhY2UoKTtcbiAgICAgIH1cbiAgICB9XG4gIH1cblxuICByZXR1cm4gdGhpcztcbn07XG5cbkV2ZW50RW1pdHRlci5wcm90b3R5cGUub24gPSBFdmVudEVtaXR0ZXIucHJvdG90eXBlLmFkZExpc3RlbmVyO1xuXG5FdmVudEVtaXR0ZXIucHJvdG90eXBlLm9uY2UgPSBmdW5jdGlvbih0eXBlLCBsaXN0ZW5lcikge1xuICBpZiAoIWlzRnVuY3Rpb24obGlzdGVuZXIpKVxuICAgIHRocm93IFR5cGVFcnJvcignbGlzdGVuZXIgbXVzdCBiZSBhIGZ1bmN0aW9uJyk7XG5cbiAgdmFyIGZpcmVkID0gZmFsc2U7XG5cbiAgZnVuY3Rpb24gZygpIHtcbiAgICB0aGlzLnJlbW92ZUxpc3RlbmVyKHR5cGUsIGcpO1xuXG4gICAgaWYgKCFmaXJlZCkge1xuICAgICAgZmlyZWQgPSB0cnVlO1xuICAgICAgbGlzdGVuZXIuYXBwbHkodGhpcywgYXJndW1lbnRzKTtcbiAgICB9XG4gIH1cblxuICBnLmxpc3RlbmVyID0gbGlzdGVuZXI7XG4gIHRoaXMub24odHlwZSwgZyk7XG5cbiAgcmV0dXJuIHRoaXM7XG59O1xuXG4vLyBlbWl0cyBhICdyZW1vdmVMaXN0ZW5lcicgZXZlbnQgaWZmIHRoZSBsaXN0ZW5lciB3YXMgcmVtb3ZlZFxuRXZlbnRFbWl0dGVyLnByb3RvdHlwZS5yZW1vdmVMaXN0ZW5lciA9IGZ1bmN0aW9uKHR5cGUsIGxpc3RlbmVyKSB7XG4gIHZhciBsaXN0LCBwb3NpdGlvbiwgbGVuZ3RoLCBpO1xuXG4gIGlmICghaXNGdW5jdGlvbihsaXN0ZW5lcikpXG4gICAgdGhyb3cgVHlwZUVycm9yKCdsaXN0ZW5lciBtdXN0IGJlIGEgZnVuY3Rpb24nKTtcblxuICBpZiAoIXRoaXMuX2V2ZW50cyB8fCAhdGhpcy5fZXZlbnRzW3R5cGVdKVxuICAgIHJldHVybiB0aGlzO1xuXG4gIGxpc3QgPSB0aGlzLl9ldmVudHNbdHlwZV07XG4gIGxlbmd0aCA9IGxpc3QubGVuZ3RoO1xuICBwb3NpdGlvbiA9IC0xO1xuXG4gIGlmIChsaXN0ID09PSBsaXN0ZW5lciB8fFxuICAgICAgKGlzRnVuY3Rpb24obGlzdC5saXN0ZW5lcikgJiYgbGlzdC5saXN0ZW5lciA9PT0gbGlzdGVuZXIpKSB7XG4gICAgZGVsZXRlIHRoaXMuX2V2ZW50c1t0eXBlXTtcbiAgICBpZiAodGhpcy5fZXZlbnRzLnJlbW92ZUxpc3RlbmVyKVxuICAgICAgdGhpcy5lbWl0KCdyZW1vdmVMaXN0ZW5lcicsIHR5cGUsIGxpc3RlbmVyKTtcblxuICB9IGVsc2UgaWYgKGlzT2JqZWN0KGxpc3QpKSB7XG4gICAgZm9yIChpID0gbGVuZ3RoOyBpLS0gPiAwOykge1xuICAgICAgaWYgKGxpc3RbaV0gPT09IGxpc3RlbmVyIHx8XG4gICAgICAgICAgKGxpc3RbaV0ubGlzdGVuZXIgJiYgbGlzdFtpXS5saXN0ZW5lciA9PT0gbGlzdGVuZXIpKSB7XG4gICAgICAgIHBvc2l0aW9uID0gaTtcbiAgICAgICAgYnJlYWs7XG4gICAgICB9XG4gICAgfVxuXG4gICAgaWYgKHBvc2l0aW9uIDwgMClcbiAgICAgIHJldHVybiB0aGlzO1xuXG4gICAgaWYgKGxpc3QubGVuZ3RoID09PSAxKSB7XG4gICAgICBsaXN0Lmxlbmd0aCA9IDA7XG4gICAgICBkZWxldGUgdGhpcy5fZXZlbnRzW3R5cGVdO1xuICAgIH0gZWxzZSB7XG4gICAgICBsaXN0LnNwbGljZShwb3NpdGlvbiwgMSk7XG4gICAgfVxuXG4gICAgaWYgKHRoaXMuX2V2ZW50cy5yZW1vdmVMaXN0ZW5lcilcbiAgICAgIHRoaXMuZW1pdCgncmVtb3ZlTGlzdGVuZXInLCB0eXBlLCBsaXN0ZW5lcik7XG4gIH1cblxuICByZXR1cm4gdGhpcztcbn07XG5cbkV2ZW50RW1pdHRlci5wcm90b3R5cGUucmVtb3ZlQWxsTGlzdGVuZXJzID0gZnVuY3Rpb24odHlwZSkge1xuICB2YXIga2V5LCBsaXN0ZW5lcnM7XG5cbiAgaWYgKCF0aGlzLl9ldmVudHMpXG4gICAgcmV0dXJuIHRoaXM7XG5cbiAgLy8gbm90IGxpc3RlbmluZyBmb3IgcmVtb3ZlTGlzdGVuZXIsIG5vIG5lZWQgdG8gZW1pdFxuICBpZiAoIXRoaXMuX2V2ZW50cy5yZW1vdmVMaXN0ZW5lcikge1xuICAgIGlmIChhcmd1bWVudHMubGVuZ3RoID09PSAwKVxuICAgICAgdGhpcy5fZXZlbnRzID0ge307XG4gICAgZWxzZSBpZiAodGhpcy5fZXZlbnRzW3R5cGVdKVxuICAgICAgZGVsZXRlIHRoaXMuX2V2ZW50c1t0eXBlXTtcbiAgICByZXR1cm4gdGhpcztcbiAgfVxuXG4gIC8vIGVtaXQgcmVtb3ZlTGlzdGVuZXIgZm9yIGFsbCBsaXN0ZW5lcnMgb24gYWxsIGV2ZW50c1xuICBpZiAoYXJndW1lbnRzLmxlbmd0aCA9PT0gMCkge1xuICAgIGZvciAoa2V5IGluIHRoaXMuX2V2ZW50cykge1xuICAgICAgaWYgKGtleSA9PT0gJ3JlbW92ZUxpc3RlbmVyJykgY29udGludWU7XG4gICAgICB0aGlzLnJlbW92ZUFsbExpc3RlbmVycyhrZXkpO1xuICAgIH1cbiAgICB0aGlzLnJlbW92ZUFsbExpc3RlbmVycygncmVtb3ZlTGlzdGVuZXInKTtcbiAgICB0aGlzLl9ldmVudHMgPSB7fTtcbiAgICByZXR1cm4gdGhpcztcbiAgfVxuXG4gIGxpc3RlbmVycyA9IHRoaXMuX2V2ZW50c1t0eXBlXTtcblxuICBpZiAoaXNGdW5jdGlvbihsaXN0ZW5lcnMpKSB7XG4gICAgdGhpcy5yZW1vdmVMaXN0ZW5lcih0eXBlLCBsaXN0ZW5lcnMpO1xuICB9IGVsc2UgaWYgKGxpc3RlbmVycykge1xuICAgIC8vIExJRk8gb3JkZXJcbiAgICB3aGlsZSAobGlzdGVuZXJzLmxlbmd0aClcbiAgICAgIHRoaXMucmVtb3ZlTGlzdGVuZXIodHlwZSwgbGlzdGVuZXJzW2xpc3RlbmVycy5sZW5ndGggLSAxXSk7XG4gIH1cbiAgZGVsZXRlIHRoaXMuX2V2ZW50c1t0eXBlXTtcblxuICByZXR1cm4gdGhpcztcbn07XG5cbkV2ZW50RW1pdHRlci5wcm90b3R5cGUubGlzdGVuZXJzID0gZnVuY3Rpb24odHlwZSkge1xuICB2YXIgcmV0O1xuICBpZiAoIXRoaXMuX2V2ZW50cyB8fCAhdGhpcy5fZXZlbnRzW3R5cGVdKVxuICAgIHJldCA9IFtdO1xuICBlbHNlIGlmIChpc0Z1bmN0aW9uKHRoaXMuX2V2ZW50c1t0eXBlXSkpXG4gICAgcmV0ID0gW3RoaXMuX2V2ZW50c1t0eXBlXV07XG4gIGVsc2VcbiAgICByZXQgPSB0aGlzLl9ldmVudHNbdHlwZV0uc2xpY2UoKTtcbiAgcmV0dXJuIHJldDtcbn07XG5cbkV2ZW50RW1pdHRlci5wcm90b3R5cGUubGlzdGVuZXJDb3VudCA9IGZ1bmN0aW9uKHR5cGUpIHtcbiAgaWYgKHRoaXMuX2V2ZW50cykge1xuICAgIHZhciBldmxpc3RlbmVyID0gdGhpcy5fZXZlbnRzW3R5cGVdO1xuXG4gICAgaWYgKGlzRnVuY3Rpb24oZXZsaXN0ZW5lcikpXG4gICAgICByZXR1cm4gMTtcbiAgICBlbHNlIGlmIChldmxpc3RlbmVyKVxuICAgICAgcmV0dXJuIGV2bGlzdGVuZXIubGVuZ3RoO1xuICB9XG4gIHJldHVybiAwO1xufTtcblxuRXZlbnRFbWl0dGVyLmxpc3RlbmVyQ291bnQgPSBmdW5jdGlvbihlbWl0dGVyLCB0eXBlKSB7XG4gIHJldHVybiBlbWl0dGVyLmxpc3RlbmVyQ291bnQodHlwZSk7XG59O1xuXG5mdW5jdGlvbiBpc0Z1bmN0aW9uKGFyZykge1xuICByZXR1cm4gdHlwZW9mIGFyZyA9PT0gJ2Z1bmN0aW9uJztcbn1cblxuZnVuY3Rpb24gaXNOdW1iZXIoYXJnKSB7XG4gIHJldHVybiB0eXBlb2YgYXJnID09PSAnbnVtYmVyJztcbn1cblxuZnVuY3Rpb24gaXNPYmplY3QoYXJnKSB7XG4gIHJldHVybiB0eXBlb2YgYXJnID09PSAnb2JqZWN0JyAmJiBhcmcgIT09IG51bGw7XG59XG5cbmZ1bmN0aW9uIGlzVW5kZWZpbmVkKGFyZykge1xuICByZXR1cm4gYXJnID09PSB2b2lkIDA7XG59XG4iLCIvKiFcbiAqIGluZGV4LW9mIDxodHRwczovL2dpdGh1Yi5jb20vam9uc2NobGlua2VydC9pbmRleC1vZj5cbiAqXG4gKiBDb3B5cmlnaHQgKGMpIDIwMTQtMjAxNSBKb24gU2NobGlua2VydC5cbiAqIExpY2Vuc2VkIHVuZGVyIHRoZSBNSVQgbGljZW5zZS5cbiAqL1xuXG4ndXNlIHN0cmljdCc7XG5cbm1vZHVsZS5leHBvcnRzID0gZnVuY3Rpb24gaW5kZXhPZihhcnIsIGVsZSwgc3RhcnQpIHtcbiAgc3RhcnQgPSBzdGFydCB8fCAwO1xuICB2YXIgaWR4ID0gLTE7XG5cbiAgaWYgKGFyciA9PSBudWxsKSByZXR1cm4gaWR4O1xuICB2YXIgbGVuID0gYXJyLmxlbmd0aDtcbiAgdmFyIGkgPSBzdGFydCA8IDBcbiAgICA/IChsZW4gKyBzdGFydClcbiAgICA6IHN0YXJ0O1xuXG4gIGlmIChpID49IGFyci5sZW5ndGgpIHtcbiAgICByZXR1cm4gLTE7XG4gIH1cblxuICB3aGlsZSAoaSA8IGxlbikge1xuICAgIGlmIChhcnJbaV0gPT09IGVsZSkge1xuICAgICAgcmV0dXJuIGk7XG4gICAgfVxuICAgIGkrKztcbiAgfVxuXG4gIHJldHVybiAtMTtcbn07XG4iLCIvKipcbiAqIFN1cHBvcnRlZCBTVkcgYXR0cmlidXRlc1xuICovXG5cbmV4cG9ydHMuYXR0cmlidXRlcyA9IHtcbiAgJ2N4JzogdHJ1ZSxcbiAgJ2N5JzogdHJ1ZSxcbiAgJ2QnOiB0cnVlLFxuICAnZHgnOiB0cnVlLFxuICAnZHknOiB0cnVlLFxuICAnZmlsbCc6IHRydWUsXG4gICdmaWxsT3BhY2l0eSc6IHRydWUsXG4gICdmb250RmFtaWx5JzogdHJ1ZSxcbiAgJ2ZvbnRTaXplJzogdHJ1ZSxcbiAgJ2Z4JzogdHJ1ZSxcbiAgJ2Z5JzogdHJ1ZSxcbiAgJ2dyYWRpZW50VHJhbnNmb3JtJzogdHJ1ZSxcbiAgJ2dyYWRpZW50VW5pdHMnOiB0cnVlLFxuICAnbWFya2VyRW5kJzogdHJ1ZSxcbiAgJ21hcmtlck1pZCc6IHRydWUsXG4gICdtYXJrZXJTdGFydCc6IHRydWUsXG4gICdvZmZzZXQnOiB0cnVlLFxuICAnb3BhY2l0eSc6IHRydWUsXG4gICdwYXR0ZXJuQ29udGVudFVuaXRzJzogdHJ1ZSxcbiAgJ3BhdHRlcm5Vbml0cyc6IHRydWUsXG4gICdwb2ludHMnOiB0cnVlLFxuICAncHJlc2VydmVBc3BlY3RSYXRpbyc6IHRydWUsXG4gICdyJzogdHJ1ZSxcbiAgJ3J4JzogdHJ1ZSxcbiAgJ3J5JzogdHJ1ZSxcbiAgJ3NwcmVhZE1ldGhvZCc6IHRydWUsXG4gICdzdG9wQ29sb3InOiB0cnVlLFxuICAnc3RvcE9wYWNpdHknOiB0cnVlLFxuICAnc3Ryb2tlJzogdHJ1ZSxcbiAgJ3N0cm9rZURhc2hhcnJheSc6IHRydWUsXG4gICdzdHJva2VMaW5lY2FwJzogdHJ1ZSxcbiAgJ3N0cm9rZU9wYWNpdHknOiB0cnVlLFxuICAnc3Ryb2tlV2lkdGgnOiB0cnVlLFxuICAndGV4dEFuY2hvcic6IHRydWUsXG4gICd0cmFuc2Zvcm0nOiB0cnVlLFxuICAndmVyc2lvbic6IHRydWUsXG4gICd2aWV3Qm94JzogdHJ1ZSxcbiAgJ3gxJzogdHJ1ZSxcbiAgJ3gyJzogdHJ1ZSxcbiAgJ3gnOiB0cnVlLFxuICAneTEnOiB0cnVlLFxuICAneTInOiB0cnVlLFxuICAneSc6IHRydWVcbn1cblxuLyoqXG4gKiBBcmUgZWxlbWVudCdzIGF0dHJpYnV0ZXMgU1ZHP1xuICpcbiAqIEBwYXJhbSB7U3RyaW5nfSBhdHRyXG4gKi9cblxubW9kdWxlLmV4cG9ydHMgPSBmdW5jdGlvbiAoYXR0cikge1xuICByZXR1cm4gYXR0ciBpbiBleHBvcnRzLmF0dHJpYnV0ZXNcbn1cbiIsIi8qKlxuICogU3VwcG9ydGVkIFNWRyBlbGVtZW50c1xuICpcbiAqIEB0eXBlIHtBcnJheX1cbiAqL1xuXG5leHBvcnRzLmVsZW1lbnRzID0ge1xuICAnYW5pbWF0ZSc6IHRydWUsXG4gICdjaXJjbGUnOiB0cnVlLFxuICAnZGVmcyc6IHRydWUsXG4gICdlbGxpcHNlJzogdHJ1ZSxcbiAgJ2cnOiB0cnVlLFxuICAnbGluZSc6IHRydWUsXG4gICdsaW5lYXJHcmFkaWVudCc6IHRydWUsXG4gICdtYXNrJzogdHJ1ZSxcbiAgJ3BhdGgnOiB0cnVlLFxuICAncGF0dGVybic6IHRydWUsXG4gICdwb2x5Z29uJzogdHJ1ZSxcbiAgJ3BvbHlsaW5lJzogdHJ1ZSxcbiAgJ3JhZGlhbEdyYWRpZW50JzogdHJ1ZSxcbiAgJ3JlY3QnOiB0cnVlLFxuICAnc3RvcCc6IHRydWUsXG4gICdzdmcnOiB0cnVlLFxuICAndGV4dCc6IHRydWUsXG4gICd0c3Bhbic6IHRydWVcbn1cblxuLyoqXG4gKiBJcyBlbGVtZW50J3MgbmFtZXNwYWNlIFNWRz9cbiAqXG4gKiBAcGFyYW0ge1N0cmluZ30gbmFtZVxuICovXG5cbmV4cG9ydHMuaXNFbGVtZW50ID0gZnVuY3Rpb24gKG5hbWUpIHtcbiAgcmV0dXJuIG5hbWUgaW4gZXhwb3J0cy5lbGVtZW50c1xufVxuIiwidmFyIHN1cHBvcnRlZFR5cGVzID0gWyd0ZXh0JywgJ3NlYXJjaCcsICd0ZWwnLCAndXJsJywgJ3Bhc3N3b3JkJ107XG5cbm1vZHVsZS5leHBvcnRzID0gZnVuY3Rpb24oZWxlbWVudCl7XG4gICAgcmV0dXJuICEhKGVsZW1lbnQuc2V0U2VsZWN0aW9uUmFuZ2UgJiYgfnN1cHBvcnRlZFR5cGVzLmluZGV4T2YoZWxlbWVudC50eXBlKSk7XG59O1xuIiwidmFyIF9jdXJyeTIgPSByZXF1aXJlKCcuL2ludGVybmFsL19jdXJyeTInKTtcblxuXG4vKipcbiAqIFdyYXBzIGEgZnVuY3Rpb24gb2YgYW55IGFyaXR5IChpbmNsdWRpbmcgbnVsbGFyeSkgaW4gYSBmdW5jdGlvbiB0aGF0IGFjY2VwdHMgZXhhY3RseSBgbmBcbiAqIHBhcmFtZXRlcnMuIFVubGlrZSBgbkFyeWAsIHdoaWNoIHBhc3NlcyBvbmx5IGBuYCBhcmd1bWVudHMgdG8gdGhlIHdyYXBwZWQgZnVuY3Rpb24sXG4gKiBmdW5jdGlvbnMgcHJvZHVjZWQgYnkgYGFyaXR5YCB3aWxsIHBhc3MgYWxsIHByb3ZpZGVkIGFyZ3VtZW50cyB0byB0aGUgd3JhcHBlZCBmdW5jdGlvbi5cbiAqXG4gKiBAZnVuY1xuICogQG1lbWJlck9mIFJcbiAqIEBzaWcgKE51bWJlciwgKCogLT4gKikpIC0+ICgqIC0+ICopXG4gKiBAY2F0ZWdvcnkgRnVuY3Rpb25cbiAqIEBwYXJhbSB7TnVtYmVyfSBuIFRoZSBkZXNpcmVkIGFyaXR5IG9mIHRoZSByZXR1cm5lZCBmdW5jdGlvbi5cbiAqIEBwYXJhbSB7RnVuY3Rpb259IGZuIFRoZSBmdW5jdGlvbiB0byB3cmFwLlxuICogQHJldHVybiB7RnVuY3Rpb259IEEgbmV3IGZ1bmN0aW9uIHdyYXBwaW5nIGBmbmAuIFRoZSBuZXcgZnVuY3Rpb24gaXNcbiAqICAgICAgICAgZ3VhcmFudGVlZCB0byBiZSBvZiBhcml0eSBgbmAuXG4gKiBAZGVwcmVjYXRlZCBzaW5jZSB2MC4xNS4wXG4gKiBAZXhhbXBsZVxuICpcbiAqICAgICAgdmFyIHRha2VzVHdvQXJncyA9IGZ1bmN0aW9uKGEsIGIpIHtcbiAqICAgICAgICByZXR1cm4gW2EsIGJdO1xuICogICAgICB9O1xuICogICAgICB0YWtlc1R3b0FyZ3MubGVuZ3RoOyAvLz0+IDJcbiAqICAgICAgdGFrZXNUd29BcmdzKDEsIDIpOyAvLz0+IFsxLCAyXVxuICpcbiAqICAgICAgdmFyIHRha2VzT25lQXJnID0gUi5hcml0eSgxLCB0YWtlc1R3b0FyZ3MpO1xuICogICAgICB0YWtlc09uZUFyZy5sZW5ndGg7IC8vPT4gMVxuICogICAgICAvLyBBbGwgYXJndW1lbnRzIGFyZSBwYXNzZWQgdGhyb3VnaCB0byB0aGUgd3JhcHBlZCBmdW5jdGlvblxuICogICAgICB0YWtlc09uZUFyZygxLCAyKTsgLy89PiBbMSwgMl1cbiAqL1xubW9kdWxlLmV4cG9ydHMgPSBfY3VycnkyKGZ1bmN0aW9uKG4sIGZuKSB7XG4gIC8vIGpzaGludCB1bnVzZWQ6dmFyc1xuICBzd2l0Y2ggKG4pIHtcbiAgICBjYXNlIDA6IHJldHVybiBmdW5jdGlvbigpIHtyZXR1cm4gZm4uYXBwbHkodGhpcywgYXJndW1lbnRzKTt9O1xuICAgIGNhc2UgMTogcmV0dXJuIGZ1bmN0aW9uKGEwKSB7cmV0dXJuIGZuLmFwcGx5KHRoaXMsIGFyZ3VtZW50cyk7fTtcbiAgICBjYXNlIDI6IHJldHVybiBmdW5jdGlvbihhMCwgYTEpIHtyZXR1cm4gZm4uYXBwbHkodGhpcywgYXJndW1lbnRzKTt9O1xuICAgIGNhc2UgMzogcmV0dXJuIGZ1bmN0aW9uKGEwLCBhMSwgYTIpIHtyZXR1cm4gZm4uYXBwbHkodGhpcywgYXJndW1lbnRzKTt9O1xuICAgIGNhc2UgNDogcmV0dXJuIGZ1bmN0aW9uKGEwLCBhMSwgYTIsIGEzKSB7cmV0dXJuIGZuLmFwcGx5KHRoaXMsIGFyZ3VtZW50cyk7fTtcbiAgICBjYXNlIDU6IHJldHVybiBmdW5jdGlvbihhMCwgYTEsIGEyLCBhMywgYTQpIHtyZXR1cm4gZm4uYXBwbHkodGhpcywgYXJndW1lbnRzKTt9O1xuICAgIGNhc2UgNjogcmV0dXJuIGZ1bmN0aW9uKGEwLCBhMSwgYTIsIGEzLCBhNCwgYTUpIHtyZXR1cm4gZm4uYXBwbHkodGhpcywgYXJndW1lbnRzKTt9O1xuICAgIGNhc2UgNzogcmV0dXJuIGZ1bmN0aW9uKGEwLCBhMSwgYTIsIGEzLCBhNCwgYTUsIGE2KSB7cmV0dXJuIGZuLmFwcGx5KHRoaXMsIGFyZ3VtZW50cyk7fTtcbiAgICBjYXNlIDg6IHJldHVybiBmdW5jdGlvbihhMCwgYTEsIGEyLCBhMywgYTQsIGE1LCBhNiwgYTcpIHtyZXR1cm4gZm4uYXBwbHkodGhpcywgYXJndW1lbnRzKTt9O1xuICAgIGNhc2UgOTogcmV0dXJuIGZ1bmN0aW9uKGEwLCBhMSwgYTIsIGEzLCBhNCwgYTUsIGE2LCBhNywgYTgpIHtyZXR1cm4gZm4uYXBwbHkodGhpcywgYXJndW1lbnRzKTt9O1xuICAgIGNhc2UgMTA6IHJldHVybiBmdW5jdGlvbihhMCwgYTEsIGEyLCBhMywgYTQsIGE1LCBhNiwgYTcsIGE4LCBhOSkge3JldHVybiBmbi5hcHBseSh0aGlzLCBhcmd1bWVudHMpO307XG4gICAgZGVmYXVsdDogdGhyb3cgbmV3IEVycm9yKCdGaXJzdCBhcmd1bWVudCB0byBhcml0eSBtdXN0IGJlIGEgbm9uLW5lZ2F0aXZlIGludGVnZXIgbm8gZ3JlYXRlciB0aGFuIHRlbicpO1xuICB9XG59KTtcbiIsInZhciBfY3VycnkyID0gcmVxdWlyZSgnLi9pbnRlcm5hbC9fY3VycnkyJyk7XG52YXIgX2N1cnJ5TiA9IHJlcXVpcmUoJy4vaW50ZXJuYWwvX2N1cnJ5TicpO1xudmFyIGFyaXR5ID0gcmVxdWlyZSgnLi9hcml0eScpO1xuXG5cbi8qKlxuICogUmV0dXJucyBhIGN1cnJpZWQgZXF1aXZhbGVudCBvZiB0aGUgcHJvdmlkZWQgZnVuY3Rpb24sIHdpdGggdGhlXG4gKiBzcGVjaWZpZWQgYXJpdHkuIFRoZSBjdXJyaWVkIGZ1bmN0aW9uIGhhcyB0d28gdW51c3VhbCBjYXBhYmlsaXRpZXMuXG4gKiBGaXJzdCwgaXRzIGFyZ3VtZW50cyBuZWVkbid0IGJlIHByb3ZpZGVkIG9uZSBhdCBhIHRpbWUuIElmIGBnYCBpc1xuICogYFIuY3VycnlOKDMsIGYpYCwgdGhlIGZvbGxvd2luZyBhcmUgZXF1aXZhbGVudDpcbiAqXG4gKiAgIC0gYGcoMSkoMikoMylgXG4gKiAgIC0gYGcoMSkoMiwgMylgXG4gKiAgIC0gYGcoMSwgMikoMylgXG4gKiAgIC0gYGcoMSwgMiwgMylgXG4gKlxuICogU2Vjb25kbHksIHRoZSBzcGVjaWFsIHBsYWNlaG9sZGVyIHZhbHVlIGBSLl9fYCBtYXkgYmUgdXNlZCB0byBzcGVjaWZ5XG4gKiBcImdhcHNcIiwgYWxsb3dpbmcgcGFydGlhbCBhcHBsaWNhdGlvbiBvZiBhbnkgY29tYmluYXRpb24gb2YgYXJndW1lbnRzLFxuICogcmVnYXJkbGVzcyBvZiB0aGVpciBwb3NpdGlvbnMuIElmIGBnYCBpcyBhcyBhYm92ZSBhbmQgYF9gIGlzIGBSLl9fYCxcbiAqIHRoZSBmb2xsb3dpbmcgYXJlIGVxdWl2YWxlbnQ6XG4gKlxuICogICAtIGBnKDEsIDIsIDMpYFxuICogICAtIGBnKF8sIDIsIDMpKDEpYFxuICogICAtIGBnKF8sIF8sIDMpKDEpKDIpYFxuICogICAtIGBnKF8sIF8sIDMpKDEsIDIpYFxuICogICAtIGBnKF8sIDIpKDEpKDMpYFxuICogICAtIGBnKF8sIDIpKDEsIDMpYFxuICogICAtIGBnKF8sIDIpKF8sIDMpKDEpYFxuICpcbiAqIEBmdW5jXG4gKiBAbWVtYmVyT2YgUlxuICogQGNhdGVnb3J5IEZ1bmN0aW9uXG4gKiBAc2lnIE51bWJlciAtPiAoKiAtPiBhKSAtPiAoKiAtPiBhKVxuICogQHBhcmFtIHtOdW1iZXJ9IGxlbmd0aCBUaGUgYXJpdHkgZm9yIHRoZSByZXR1cm5lZCBmdW5jdGlvbi5cbiAqIEBwYXJhbSB7RnVuY3Rpb259IGZuIFRoZSBmdW5jdGlvbiB0byBjdXJyeS5cbiAqIEByZXR1cm4ge0Z1bmN0aW9ufSBBIG5ldywgY3VycmllZCBmdW5jdGlvbi5cbiAqIEBzZWUgUi5jdXJyeVxuICogQGV4YW1wbGVcbiAqXG4gKiAgICAgIHZhciBhZGRGb3VyTnVtYmVycyA9IGZ1bmN0aW9uKCkge1xuICogICAgICAgIHJldHVybiBSLnN1bShbXS5zbGljZS5jYWxsKGFyZ3VtZW50cywgMCwgNCkpO1xuICogICAgICB9O1xuICpcbiAqICAgICAgdmFyIGN1cnJpZWRBZGRGb3VyTnVtYmVycyA9IFIuY3VycnlOKDQsIGFkZEZvdXJOdW1iZXJzKTtcbiAqICAgICAgdmFyIGYgPSBjdXJyaWVkQWRkRm91ck51bWJlcnMoMSwgMik7XG4gKiAgICAgIHZhciBnID0gZigzKTtcbiAqICAgICAgZyg0KTsgLy89PiAxMFxuICovXG5tb2R1bGUuZXhwb3J0cyA9IF9jdXJyeTIoZnVuY3Rpb24gY3VycnlOKGxlbmd0aCwgZm4pIHtcbiAgcmV0dXJuIGFyaXR5KGxlbmd0aCwgX2N1cnJ5TihsZW5ndGgsIFtdLCBmbikpO1xufSk7XG4iLCIvKipcbiAqIE9wdGltaXplZCBpbnRlcm5hbCB0d28tYXJpdHkgY3VycnkgZnVuY3Rpb24uXG4gKlxuICogQHByaXZhdGVcbiAqIEBjYXRlZ29yeSBGdW5jdGlvblxuICogQHBhcmFtIHtGdW5jdGlvbn0gZm4gVGhlIGZ1bmN0aW9uIHRvIGN1cnJ5LlxuICogQHJldHVybiB7RnVuY3Rpb259IFRoZSBjdXJyaWVkIGZ1bmN0aW9uLlxuICovXG5tb2R1bGUuZXhwb3J0cyA9IGZ1bmN0aW9uIF9jdXJyeTEoZm4pIHtcbiAgcmV0dXJuIGZ1bmN0aW9uIGYxKGEpIHtcbiAgICBpZiAoYXJndW1lbnRzLmxlbmd0aCA9PT0gMCkge1xuICAgICAgcmV0dXJuIGYxO1xuICAgIH0gZWxzZSBpZiAoYSAhPSBudWxsICYmIGFbJ0BAZnVuY3Rpb25hbC9wbGFjZWhvbGRlciddID09PSB0cnVlKSB7XG4gICAgICByZXR1cm4gZjE7XG4gICAgfSBlbHNlIHtcbiAgICAgIHJldHVybiBmbihhKTtcbiAgICB9XG4gIH07XG59O1xuIiwidmFyIF9jdXJyeTEgPSByZXF1aXJlKCcuL19jdXJyeTEnKTtcblxuXG4vKipcbiAqIE9wdGltaXplZCBpbnRlcm5hbCB0d28tYXJpdHkgY3VycnkgZnVuY3Rpb24uXG4gKlxuICogQHByaXZhdGVcbiAqIEBjYXRlZ29yeSBGdW5jdGlvblxuICogQHBhcmFtIHtGdW5jdGlvbn0gZm4gVGhlIGZ1bmN0aW9uIHRvIGN1cnJ5LlxuICogQHJldHVybiB7RnVuY3Rpb259IFRoZSBjdXJyaWVkIGZ1bmN0aW9uLlxuICovXG5tb2R1bGUuZXhwb3J0cyA9IGZ1bmN0aW9uIF9jdXJyeTIoZm4pIHtcbiAgcmV0dXJuIGZ1bmN0aW9uIGYyKGEsIGIpIHtcbiAgICB2YXIgbiA9IGFyZ3VtZW50cy5sZW5ndGg7XG4gICAgaWYgKG4gPT09IDApIHtcbiAgICAgIHJldHVybiBmMjtcbiAgICB9IGVsc2UgaWYgKG4gPT09IDEgJiYgYSAhPSBudWxsICYmIGFbJ0BAZnVuY3Rpb25hbC9wbGFjZWhvbGRlciddID09PSB0cnVlKSB7XG4gICAgICByZXR1cm4gZjI7XG4gICAgfSBlbHNlIGlmIChuID09PSAxKSB7XG4gICAgICByZXR1cm4gX2N1cnJ5MShmdW5jdGlvbihiKSB7IHJldHVybiBmbihhLCBiKTsgfSk7XG4gICAgfSBlbHNlIGlmIChuID09PSAyICYmIGEgIT0gbnVsbCAmJiBhWydAQGZ1bmN0aW9uYWwvcGxhY2Vob2xkZXInXSA9PT0gdHJ1ZSAmJlxuICAgICAgICAgICAgICAgICAgICAgICAgICBiICE9IG51bGwgJiYgYlsnQEBmdW5jdGlvbmFsL3BsYWNlaG9sZGVyJ10gPT09IHRydWUpIHtcbiAgICAgIHJldHVybiBmMjtcbiAgICB9IGVsc2UgaWYgKG4gPT09IDIgJiYgYSAhPSBudWxsICYmIGFbJ0BAZnVuY3Rpb25hbC9wbGFjZWhvbGRlciddID09PSB0cnVlKSB7XG4gICAgICByZXR1cm4gX2N1cnJ5MShmdW5jdGlvbihhKSB7IHJldHVybiBmbihhLCBiKTsgfSk7XG4gICAgfSBlbHNlIGlmIChuID09PSAyICYmIGIgIT0gbnVsbCAmJiBiWydAQGZ1bmN0aW9uYWwvcGxhY2Vob2xkZXInXSA9PT0gdHJ1ZSkge1xuICAgICAgcmV0dXJuIF9jdXJyeTEoZnVuY3Rpb24oYikgeyByZXR1cm4gZm4oYSwgYik7IH0pO1xuICAgIH0gZWxzZSB7XG4gICAgICByZXR1cm4gZm4oYSwgYik7XG4gICAgfVxuICB9O1xufTtcbiIsInZhciBhcml0eSA9IHJlcXVpcmUoJy4uL2FyaXR5Jyk7XG5cblxuLyoqXG4gKiBJbnRlcm5hbCBjdXJyeU4gZnVuY3Rpb24uXG4gKlxuICogQHByaXZhdGVcbiAqIEBjYXRlZ29yeSBGdW5jdGlvblxuICogQHBhcmFtIHtOdW1iZXJ9IGxlbmd0aCBUaGUgYXJpdHkgb2YgdGhlIGN1cnJpZWQgZnVuY3Rpb24uXG4gKiBAcmV0dXJuIHthcnJheX0gQW4gYXJyYXkgb2YgYXJndW1lbnRzIHJlY2VpdmVkIHRodXMgZmFyLlxuICogQHBhcmFtIHtGdW5jdGlvbn0gZm4gVGhlIGZ1bmN0aW9uIHRvIGN1cnJ5LlxuICovXG5tb2R1bGUuZXhwb3J0cyA9IGZ1bmN0aW9uIF9jdXJyeU4obGVuZ3RoLCByZWNlaXZlZCwgZm4pIHtcbiAgcmV0dXJuIGZ1bmN0aW9uKCkge1xuICAgIHZhciBjb21iaW5lZCA9IFtdO1xuICAgIHZhciBhcmdzSWR4ID0gMDtcbiAgICB2YXIgbGVmdCA9IGxlbmd0aDtcbiAgICB2YXIgY29tYmluZWRJZHggPSAwO1xuICAgIHdoaWxlIChjb21iaW5lZElkeCA8IHJlY2VpdmVkLmxlbmd0aCB8fCBhcmdzSWR4IDwgYXJndW1lbnRzLmxlbmd0aCkge1xuICAgICAgdmFyIHJlc3VsdDtcbiAgICAgIGlmIChjb21iaW5lZElkeCA8IHJlY2VpdmVkLmxlbmd0aCAmJlxuICAgICAgICAgIChyZWNlaXZlZFtjb21iaW5lZElkeF0gPT0gbnVsbCB8fFxuICAgICAgICAgICByZWNlaXZlZFtjb21iaW5lZElkeF1bJ0BAZnVuY3Rpb25hbC9wbGFjZWhvbGRlciddICE9PSB0cnVlIHx8XG4gICAgICAgICAgIGFyZ3NJZHggPj0gYXJndW1lbnRzLmxlbmd0aCkpIHtcbiAgICAgICAgcmVzdWx0ID0gcmVjZWl2ZWRbY29tYmluZWRJZHhdO1xuICAgICAgfSBlbHNlIHtcbiAgICAgICAgcmVzdWx0ID0gYXJndW1lbnRzW2FyZ3NJZHhdO1xuICAgICAgICBhcmdzSWR4ICs9IDE7XG4gICAgICB9XG4gICAgICBjb21iaW5lZFtjb21iaW5lZElkeF0gPSByZXN1bHQ7XG4gICAgICBpZiAocmVzdWx0ID09IG51bGwgfHwgcmVzdWx0WydAQGZ1bmN0aW9uYWwvcGxhY2Vob2xkZXInXSAhPT0gdHJ1ZSkge1xuICAgICAgICBsZWZ0IC09IDE7XG4gICAgICB9XG4gICAgICBjb21iaW5lZElkeCArPSAxO1xuICAgIH1cbiAgICByZXR1cm4gbGVmdCA8PSAwID8gZm4uYXBwbHkodGhpcywgY29tYmluZWQpIDogYXJpdHkobGVmdCwgX2N1cnJ5TihsZW5ndGgsIGNvbWJpbmVkLCBmbikpO1xuICB9O1xufTtcbiIsInZhciBuYXR1cmFsU2VsZWN0aW9uID0gcmVxdWlyZSgnbmF0dXJhbC1zZWxlY3Rpb24nKTtcblxubW9kdWxlLmV4cG9ydHMgPSBmdW5jdGlvbihlbGVtZW50LCB2YWx1ZSl7XG4gICAgdmFyIGNhblNldCA9IG5hdHVyYWxTZWxlY3Rpb24oZWxlbWVudCkgJiYgZWxlbWVudCA9PT0gZG9jdW1lbnQuYWN0aXZlRWxlbWVudDtcblxuICAgIGlmIChjYW5TZXQpIHtcbiAgICAgICAgdmFyIHN0YXJ0ID0gZWxlbWVudC5zZWxlY3Rpb25TdGFydCxcbiAgICAgICAgICAgIGVuZCA9IGVsZW1lbnQuc2VsZWN0aW9uRW5kO1xuXG4gICAgICAgIGVsZW1lbnQudmFsdWUgPSB2YWx1ZTtcbiAgICAgICAgZWxlbWVudC5zZXRTZWxlY3Rpb25SYW5nZShzdGFydCwgZW5kKTtcbiAgICB9IGVsc2Uge1xuICAgICAgICBlbGVtZW50LnZhbHVlID0gdmFsdWU7XG4gICAgfVxufTtcbiIsIi8qKlxuICogRXhwb3J0IGB1aWRgXG4gKi9cblxubW9kdWxlLmV4cG9ydHMgPSB1aWQ7XG5cbi8qKlxuICogQ3JlYXRlIGEgYHVpZGBcbiAqXG4gKiBAcGFyYW0ge1N0cmluZ30gbGVuXG4gKiBAcmV0dXJuIHtTdHJpbmd9IHVpZFxuICovXG5cbmZ1bmN0aW9uIHVpZChsZW4pIHtcbiAgbGVuID0gbGVuIHx8IDc7XG4gIHJldHVybiBNYXRoLnJhbmRvbSgpLnRvU3RyaW5nKDM1KS5zdWJzdHIoMiwgbGVuKTtcbn1cbiIsInZhciBjdXJyeU4gPSByZXF1aXJlKCdyYW1kYS9zcmMvY3VycnlOJyk7XG5cbmZ1bmN0aW9uIGlzU3RyaW5nKHMpIHsgcmV0dXJuIHR5cGVvZiBzID09PSAnc3RyaW5nJzsgfVxuZnVuY3Rpb24gaXNOdW1iZXIobikgeyByZXR1cm4gdHlwZW9mIG4gPT09ICdudW1iZXInOyB9XG5mdW5jdGlvbiBpc09iamVjdCh2YWx1ZSkge1xuICB2YXIgdHlwZSA9IHR5cGVvZiB2YWx1ZTtcbiAgcmV0dXJuICEhdmFsdWUgJiYgKHR5cGUgPT0gJ29iamVjdCcgfHwgdHlwZSA9PSAnZnVuY3Rpb24nKTtcbn1cbmZ1bmN0aW9uIGlzRnVuY3Rpb24oZikgeyByZXR1cm4gdHlwZW9mIGYgPT09ICdmdW5jdGlvbic7IH1cbnZhciBpc0FycmF5ID0gQXJyYXkuaXNBcnJheSB8fCBmdW5jdGlvbihhKSB7IHJldHVybiAnbGVuZ3RoJyBpbiBhOyB9O1xuXG52YXIgbWFwQ29uc3RyVG9GbiA9IGN1cnJ5TigyLCBmdW5jdGlvbihncm91cCwgY29uc3RyKSB7XG4gIHJldHVybiBjb25zdHIgPT09IFN0cmluZyAgICA/IGlzU3RyaW5nXG4gICAgICAgOiBjb25zdHIgPT09IE51bWJlciAgICA/IGlzTnVtYmVyXG4gICAgICAgOiBjb25zdHIgPT09IE9iamVjdCAgICA/IGlzT2JqZWN0XG4gICAgICAgOiBjb25zdHIgPT09IEFycmF5ICAgICA/IGlzQXJyYXlcbiAgICAgICA6IGNvbnN0ciA9PT0gRnVuY3Rpb24gID8gaXNGdW5jdGlvblxuICAgICAgIDogY29uc3RyID09PSB1bmRlZmluZWQgPyBncm91cFxuICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgOiBjb25zdHI7XG59KTtcblxuZnVuY3Rpb24gQ29uc3RydWN0b3IoZ3JvdXAsIG5hbWUsIHZhbGlkYXRvcnMpIHtcbiAgdmFsaWRhdG9ycyA9IHZhbGlkYXRvcnMubWFwKG1hcENvbnN0clRvRm4oZ3JvdXApKTtcbiAgdmFyIGNvbnN0cnVjdG9yID0gY3VycnlOKHZhbGlkYXRvcnMubGVuZ3RoLCBmdW5jdGlvbigpIHtcbiAgICB2YXIgdmFsID0gW10sIHYsIHZhbGlkYXRvcjtcbiAgICBmb3IgKHZhciBpID0gMDsgaSA8IGFyZ3VtZW50cy5sZW5ndGg7ICsraSkge1xuICAgICAgdiA9IGFyZ3VtZW50c1tpXTtcbiAgICAgIHZhbGlkYXRvciA9IHZhbGlkYXRvcnNbaV07XG4gICAgICBpZiAoKHR5cGVvZiB2YWxpZGF0b3IgPT09ICdmdW5jdGlvbicgJiYgdmFsaWRhdG9yKHYpKSB8fFxuICAgICAgICAgICh2ICE9PSB1bmRlZmluZWQgJiYgdiAhPT0gbnVsbCAmJiB2Lm9mID09PSB2YWxpZGF0b3IpKSB7XG4gICAgICAgIHZhbFtpXSA9IGFyZ3VtZW50c1tpXTtcbiAgICAgIH0gZWxzZSB7XG4gICAgICAgIHRocm93IG5ldyBUeXBlRXJyb3IoJ3dyb25nIHZhbHVlICcgKyB2ICsgJyBwYXNzZWQgdG8gbG9jYXRpb24gJyArIGkgKyAnIGluICcgKyBuYW1lKTtcbiAgICAgIH1cbiAgICB9XG4gICAgdmFsLm9mID0gZ3JvdXA7XG4gICAgdmFsLm5hbWUgPSBuYW1lO1xuICAgIHJldHVybiB2YWw7XG4gIH0pO1xuICByZXR1cm4gY29uc3RydWN0b3I7XG59XG5cbmZ1bmN0aW9uIHJhd0Nhc2UodHlwZSwgY2FzZXMsIGFjdGlvbiwgYXJnKSB7XG4gIGlmICh0eXBlICE9PSBhY3Rpb24ub2YpIHRocm93IG5ldyBUeXBlRXJyb3IoJ3dyb25nIHR5cGUgcGFzc2VkIHRvIGNhc2UnKTtcbiAgdmFyIG5hbWUgPSBhY3Rpb24ubmFtZSBpbiBjYXNlcyA/IGFjdGlvbi5uYW1lXG4gICAgICAgICAgIDogJ18nIGluIGNhc2VzICAgICAgICAgPyAnXydcbiAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICA6IHVuZGVmaW5lZDtcbiAgaWYgKG5hbWUgPT09IHVuZGVmaW5lZCkge1xuICAgIHRocm93IG5ldyBFcnJvcigndW5oYW5kbGVkIHZhbHVlIHBhc3NlZCB0byBjYXNlJyk7XG4gIH0gZWxzZSB7XG4gICAgcmV0dXJuIGNhc2VzW25hbWVdLmFwcGx5KHVuZGVmaW5lZCwgYXJnICE9PSB1bmRlZmluZWQgPyBhY3Rpb24uY29uY2F0KFthcmddKSA6IGFjdGlvbik7XG4gIH1cbn1cblxudmFyIHR5cGVDYXNlID0gY3VycnlOKDMsIHJhd0Nhc2UpO1xudmFyIGNhc2VPbiA9IGN1cnJ5Tig0LCByYXdDYXNlKTtcblxuZnVuY3Rpb24gVHlwZShkZXNjKSB7XG4gIHZhciBvYmogPSB7fTtcbiAgZm9yICh2YXIga2V5IGluIGRlc2MpIHtcbiAgICBvYmpba2V5XSA9IENvbnN0cnVjdG9yKG9iaiwga2V5LCBkZXNjW2tleV0pO1xuICB9XG4gIG9iai5jYXNlID0gdHlwZUNhc2Uob2JqKTtcbiAgb2JqLmNhc2VPbiA9IGNhc2VPbihvYmopO1xuICByZXR1cm4gb2JqO1xufVxuXG5tb2R1bGUuZXhwb3J0cyA9IFR5cGU7XG4iLCJpbXBvcnQge2RvbSwgZWxlbWVudH0gZnJvbSAnZGVrdSdcbmltcG9ydCB7RXZlbnRFbWl0dGVyfSBmcm9tICdldmVudHMnXG5jb25zdCB7Y3JlYXRlUmVuZGVyZXJ9ID0gZG9tO1xuY29uc3QgZW1pdHRlciA9IG5ldyBFdmVudEVtaXR0ZXI7XG5sZXQgY291bnRlciA9IDA7XG4vLyBEaXNwYXRjaCBhbiBhY3Rpb24gd2hlbiB0aGUgYnV0dG9uIGlzIGNsaWNrZWRcbmxldCBsb2cgPSBldmVudCA9PiB7XG4gICAgZW1pdHRlci5lbWl0KFwidXBkYXRlXCIpO1xufTtcbi8vIERlZmluZSBhIHN0YXRlLWxlc3MgY29tcG9uZW50XG5sZXQgTXlCdXR0b24gPSB7XG4gICAgb25VcGRhdGUoe3BhdGh9KXtcbiAgICAgICAgY29uc29sZS5sb2coYCR7Y291bnRlcn0gb25VcGRhdGUgOiAke3BhdGh9YCk7XG4gICAgfSxcbiAgICByZW5kZXIoe3BhdGgsIGNoaWxkcmVufSl7XG4gICAgICAgIGNvbnNvbGUubG9nKGAkeysrY291bnRlcn0gcmVuZGVyIDogJHtwYXRofWApO1xuICAgICAgICByZXR1cm4gPGJ1dHRvbiBvbkNsaWNrPXtsb2d9PntjaGlsZHJlbn08L2J1dHRvbj5cbiAgICB9XG59O1xubGV0IE15V3JhcHBlciA9IHtcbiAgICByZW5kZXIoKXtcbiAgICAgICAgcmV0dXJuIDxkaXY+XG4gICAgICAgICAgICA8TXlCdXR0b24+SGVsbG8gV29ybGQhPC9NeUJ1dHRvbj5cbiAgICAgICAgPC9kaXY+XG4gICAgfVxufTtcbmxldCByZW5kZXIgPSBjcmVhdGVSZW5kZXJlcihkb2N1bWVudC5ib2R5KTtcbmVtaXR0ZXIub24oXCJ1cGRhdGVcIiwgKCk9PiB7XG4gICAgcmVuZGVyKDxNeVdyYXBwZXIgLz4pO1xufSk7XG4vLyBpbml0XG5lbWl0dGVyLmVtaXQoXCJ1cGRhdGVcIik7Il19
