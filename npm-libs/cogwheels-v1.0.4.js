/*
 * Require - module loader.
 * based on https://github.com/component/require
 * MIT
 */

(function (window) {

	'use strict';

	/**
	 * Returns module exports.
	 */
	function require(path, parent, orig) {

		var resolved = require.resolve(path);

		if (!resolved) {
			orig = orig || path;
			parent = parent || 'root';
			var err = new Error('Failed to require "' + orig + '" from "' + parent + '"');
			err.path = path;
			err.parent = parent;
			err.require = true;
			throw err;
		}

		var module = require.modules[resolved];

		// perform real require()
		if (!module._resolving && !module.exports) {   
			var mod = {};
			mod.exports = {};
			mod.client = mod.component = true;
			module._resolving = true;
			module.call(this, require.relative(resolved), mod.exports, mod); // parameters flipped from original implementation
			delete module._resolving;
			module.exports = mod.exports;
		}

		return module.exports;
	}

	/**
	 * Cache for all registered modules.
	 */
	require.modules = {};

	/**
	 * Returns real module path or null if it fails.
	 */
	require.resolve = function (path) {

		if (path.charAt(0) === '/') {
			path = path.slice(1);
		}

		// support feature main exports, with 'alias support'
		var paths = [
			path,
			path + '/main',
			path + '/init',
			path + '/index'
		];

		for(var i = 0, len = paths.length; i < len; i++) {
			if(require.modules.hasOwnProperty(paths[i])){
				return paths[i];
			}
		}
		return null;
	};

	/**
	 * Returns normalized path; removes dot notations.
	 */
	require.normalize = function (curr, path) {

		var segs = [];

		if (path.charAt(0) !== '.') {
			return path;
		}

		curr = curr.split('/');
		path = path.split('/');

		for (var i = 0, len = path.length; i < len; ++i) {
			if (path[i] === '..') {
				curr.pop();
			}
			else if (path[i] !== '.' && path[i] !== '') {
				segs.push(path[i]);
			}
		}

		return curr.concat(segs).join('/');
	};

	/**
	 * Register module by path name and CommonJS wrapper.
	 * 
	 * @param {String} path
	 * @param {Function} definition
	 * @api private
	 */
	require.register = function (path, definition) {
		require.modules[path] = definition;
	};

	/**
	 * Returns local require function for a module.
	 */
	require.relative = function (parent) {

		var root = require.normalize(parent, '..');

		function localRequire(path) {
			var resolved = localRequire.resolve(path);
			return require(resolved, parent, path);
		}

		localRequire.resolve = function (path) {
			var c = path.charAt(0);

			if (c === '/') {
				return path.slice(1);
			}

			if (c === '.') {
				return require.normalize(root, path);
			}

			return path;
		};

		localRequire.exists = function (path) {
			return require.modules.hasOwnProperty(localRequire.resolve(path));
		};

		return localRequire;
	};

	// Export
	window.require = require;

})(window);require.register('cogwheels', function(require, exports, module) {
/*global define*/

'use strict';

var bootstrap = require('boot/bootstrap');

var extensions = [];
var features = [];

exports.start = function (config) {
	config = config || {};
	bootstrap(config, extensions, features);
};

exports.addExtension = function (extension) {
	extensions.push(extension);
};

exports.getExtensions = function () {
	return extensions;
};

exports.addFeature = function (feature) {
	features.push(feature);
};

exports.getFeatures = function () {
	return features;
};

});
require.register('layout-engine', function(require, exports, module) {

var domify = require('layout-engine/domify');
var regionHandler = require('./layout-engine/region-handler');
var disabler = require('utils/object-disabler');
var layout = {
	init: function(config) {
		if (config.disabled) {
			disabler(this, ['init']);
		}
		this.config = config;
		this.root = config.root || document.body;
		this.defaultRegion = config.defaultRegion || 'main';
		this.regions = {};
		this.handlers = {};
		this.regionHandlers = {};
	},
	start: function() {
		if (this.config.regions) {
			for (var region in this.config.regions) {
				this.initRegion(region, this.config.regions[region].handler, this.config.regions[region].options);
			}
		}
	},
	findRegion: function(region) {
		return this.root.querySelector('#' + region);
	},
	registerHandler: function(name, handler) {
		this.handlers[name] = handler;
	},
	configureRegion: function(region, handlerName, handlerOptions) {
		if (!this.handlers[handlerName]) {
			throw new Error('layoutEngine: you can not set an unregister handler! (' + handlerName + ')');
		}
		this.regionHandlers[region] = {
			handler: handlerName,
			options: handlerOptions || {}
		};
		return true;
	},
	initRegion: function(region, handlerName, handlerOptions) {
		var regionEl = this.findRegion(region);
		if (!regionEl) {
			throw new Error('layoutEngine: you can not initialize a non existing region! (' + region + ')');
		}
		var handlerConstructor = null;
		if (handlerName) {
			handlerConstructor = this.handlers[handlerName];
		} else {
			handlerConstructor = regionHandler;
		}
		// throw error or fallback to regionHandler?
		if (!handlerConstructor) {
			throw new Error('layoutEngine: you can not initialize a region with a non existing handler! (' + handlerName + ')');
		}
		// use "try" because we don't know if given handler fulfill required initialization API!
		var handler = null;
		try {
			handler  = Object.create(handlerConstructor);
			handler.setup(regionEl, handlerOptions);
		} catch(e) {
			throw new Error('layoutEngine: invalid handler! (' + handlerName + ')');
		} finally {
			this.regions[region] = handler;
		}
		return handler;
	},
	destroyRegion: function(region) {
		if (!this.regions[region]) {
			return false;
		}
		
		// unrender whathever was rendered
		var handler = this.getRegionHandler(region);
		handler && handler.clearRegion && handler.clearRegion();
		
		// release memory
		this.regions[region] = null;
		delete(this.regions[region]);
		this.regionHandlers[region] = null;
		delete(this.regionHandlers[region]);
		return true;
	},
	getRegionHandler: function(region) {
		if (this.regions[region]) {
			return this.regions[region];
		} else {
			return null;
		}
	},
	render: function(template, viewModel, region, options) {
		region = region || 'main';
		var element = domify(template);
		var handler = this.regions[region];
		if (!handler) {
			var regionHandler = this.regionHandlers[region];
			if (regionHandler) {
				handler = this.initRegion(region, regionHandler.handler, regionHandler.options);
			} else {
				handler = this.initRegion(region, null, options);
			}
		}
		handler.update(element, viewModel, options);
		return {
			el: element
		};
	}
};

module.exports = layout;
});
require.register('lifecycle-manager', function(require, exports, module) {
var bus = require('message-bus');

function lowestPriority(a, b) {
	a.prio = a.prio || 1000; // could use Number.MAX_VALUE;
	b.prio = b.prio || 1000;

	if(a.prio < b.prio){
		return -1;
	} 
	if(a.prio > b.prio){
		return 1;
	}
	return 0;
}

function tryCall(fn, cfg, ctx) {
	if(fn){
		try{
			cfg ? fn.call(ctx, cfg) : fn.call(ctx);
		} catch (err){
			if(lifecycle.silentErrors) {
				bus.publish('system-error', err);
			} else {
				throw err;
			}
		}
	}
}

function iterateCollection(collection, fn) {
	if(collection){
		collection.forEach(fn);
	}
}
function partialTryCall(method, cfg) {
	return function(obj){
		tryCall(obj[method], cfg, obj);
	};
}
//	Component represents each system/extension/feature module that is going to be started up
function Component (obj) {
	this.config = obj.config || {};
	this.name = obj.name;
	this.skipStart = obj.skipStart;
}

Component.prototype.init = function() {

	this.module = require(this.name);
	lifecycle.publish('init-component', this.name);
	tryCall(this.module.init, this.config, this.module);
	this.initControllers();		
}; 

Component.prototype.dispose = function() {
	tryCall(this.module.dispose, null, this.module);
	this.disposeControllers();		
};

Component.prototype.disposeControllers = function() {
	iterateCollection(this.module.controllers, partialTryCall('dispose'));
};

Component.prototype.initControllers = function() {
	iterateCollection(this.module.controllers, partialTryCall('init', this.config));
}; 

Component.prototype.start = function(force) {

	if(!force && this.skipStart){ return; }
	lifecycle.publish('start-component', this.name);
	tryCall(this.module.start, null, this.module);
	this.startControllers();
};

Component.prototype.startControllers = function() {
	iterateCollection(this.module.controllers, partialTryCall('start'));
}; 

var lifecycle = {
	init: function(config) {
		this.components = [];
		this.silentErrors = !!config.silentErrors;
		this.setupComponents(config);
		this.listenForSystemEvents(config);
	},
	dispose: function() {
		this.subscription && this.subscription.dispose();		
	},
	setupComponents: function(config) {
		var self = this;
		var systemComponents = config.system || [];
		var extensions = config.extensions || [];
		var features = config.features || [];

		function addToComponents (comp) {
			self.components.push(new Component(comp));
		}

		systemComponents.sort(lowestPriority).forEach(addToComponents);
		extensions.sort(lowestPriority).forEach(addToComponents);
		features.sort(lowestPriority).forEach(addToComponents);
	}, 
	listenForSystemEvents: function(config) {
		var self = this;
		this.subscription = bus.subscribe('system-shutdown', function() {
			self.components.forEach(function(component) {
				component.dispose();	
			});
		});		
	},
	run: function() {
		this.publish('sequence-starting', 'Starting lifecycle-manager sequence');
		this.runInitTask();
		this.runStartTask();
		this.publish('sequence-complete', 'lifecycle-manager sequence complete');
	},
	runInitTask: function() {
		this.preInitTask();
		this.initTask();
		this.postInitTask();	
	},
	preInitTask: function() {
		this.publish('pre-init', 'lifecycle-manager pre-init phase');		
	},
	initTask: function() {
		this.publish('init', 'lifecycle-manager init phase');
		this.components.forEach(function(component) {
			component.init();	
		});
	},
	postInitTask: function() {
		this.publish('post-init', 'lifecycle-manager post-init phase');	
	},
	runStartTask: function() {
		this.preStartTask();
		this.startTask();
		this.postStartTask();	
	},
	preStartTask: function() {
		this.publish('pre-start', 'lifecycle-manager pre-start phase');
	},
	startTask: function() {
		this.publish('start', 'lifecycle-manager start phase');
		this.components.forEach(function(component) {
			component.start();
		});
	},
	postStartTask: function() {
		this.publish('post-start', 'lifecycle-manager post-start phase');
	},
	getComponent: function(name) {
		var found = this.components.filter(function(component) {
			return component.name === name;
		});
		return found[0];
	}          
};

var subscribable = require('utils/subscribable');
subscribable.mixin(lifecycle);
lifecycle.Component = Component;
module.exports = lifecycle;

});
require.register('message-bus', function(require, exports, module) {
'use strict';

var subscribable = require('utils/subscribable');

var bus = {
    channel: subscribable.mixin({}),
    subscribe: function (event, callback) {
        return this.channel && this.channel.subscribe(event, callback);
    },
    publish: function (event, data) {

        var message = {
            data: data,
            event: event
        };
        if(!this.channel) {
            return;
        }
        this.channel.publish(event, message);
    },
    subscribeOnce: function (event, callback) {

		if(!this.channel) {
			return;
		}
        var subscription = this.channel.subscribe(event, callback);
        var cb = subscription.callback;
        subscription.callback = function () {
            cb.apply(subscription, arguments);
            subscription.dispose.bind(subscription)();
        };

        return subscription;
    }
};


module.exports = bus;
});
require.register('router', function(require, exports, module) {

var route = require('router/route');
var context = require('router/context');
var disabler = require('utils/object-disabler');
var bus = require('message-bus');

var isExternal = /^http/;

var hashNav = {
	activate: function(config) {
		this.symbol = config.hashNavigationSymbol;
		this.config = config;
		this.firstTime = true;
		window.addEventListener('hashchange', this.onhashchange.bind(this), false);
	},
	deactivate: function() {
		window.removeEventListener('hashchange', this.onhashchange);	
	}, 
	onhashchange: function(e) {
		e = e || {};
		e.newURL = e.newURL || location.hash;
		var i = e.newURL.indexOf(this.symbol);
		var path = e.newURL.substring(i).replace(this.symbol, '');
		var ctx = context.create(path, this.config.base, {});
		return router.dispatch(ctx);
	}, 
	dispatch: function(ctx) {
		if(this.firstTime){
			this.firstTime = false;
			return this.onhashchange();
		}
		window.location.hash = this.symbol + ctx.path;
		return true;
	} 
};

var pushNav = {
	activate: function(config) {
		window.addEventListener('popstate', this.onpopstate, false);	
	},
	deactivate: function() {
		window.removeEventListener('popstate', this.onpopstate);	
	}, 
	onpopstate: function(e) {
		if(e.state){
			router.dispatch(e.state);
		}		
	},
	dispatch: function(ctx) {
		history.pushState(ctx, ctx.title, ctx.pathname);
		return router.dispatch(ctx);
	} 
};

var slaveNav = {
	activate: function(config) {
			
	},
	deactivate: function() {
			
	}, 
	dispatch: function(ctx) {
		return router.dispatch(ctx);
	} 
};


var router = {
	init: function(config) {
		if(config.disabled){
			disabler(this);
			return;
		}

		this.config = config || {};
		this.configure();

		this.nav = this.createNavigationObject();		
		this.routes = [];
		this.statusHandlers = {};

	},
	createNavigationObject: function() {
		var obj;
		if(this.config.slave){
			obj = slaveNav;
		} else if(this.config.pushStateEnabled) {
			obj = pushNav;
		} else {
			obj = hashNav;
		}
		
		return Object.create(obj);		
	},
	configure: function() {
		this.config.base = this.config.base || '';
		if(this.config.pushStateEnabled == null){
			this.config.pushStateEnabled = true;
		}
		this.config.hashNavigationSymbol = this.config.hashNavigationSymbol || '#';
	},
	start: function() {
		this.nav.activate(this.config);	
		bus.publish('router:started');
		var path = location.pathname + location.search + location.hash;
		if(!this.config.noInitialRouting) {
			this.navigate(path);
		}
	},
	stop: function() {
		this.nav.deactivate();			
	},
	dispose: function() {
		this.stop();
		this.routes = null;
		this.statusHandlers = null;
	},
	on: function(path, fn) {
		if(!this.routes) {
			return;
		}
		var r = route.create(path);
		for(var i = 1, j = arguments.length; i < j; i++) {
			this.routes.push(r.middleware(arguments[i]));
		}
	},
	navigate: function(path) {
		if(isExternal.test(path)) {
			this.navigateExternal(path);
			return;
		}
		bus.publish('router:navigate', { url: path });
		var ctx = context.create(path, this.config.base, {});

		return this.nav.dispatch(ctx);
	},
	dispatch: function(ctx) {
		if(this.routes == null) {
			return;
		}			

		var i = 0;
		var self = this;
		function next() {
			var fn = self.routes[i++];
			if(!fn) {
				ctx.unhandled = true;
				return;
			}
			fn(ctx, next);
		}
		next();
		
		this.checkUnhandled(ctx);
		
		return !ctx.unhandled;
	},
	checkUnhandled: function(ctx) {
		if(ctx.unhandled){
			bus.publish('router:404', ctx);
			if(this.statusHandlers[404]){
				this.statusHandlers[404](ctx);
			}
		}		
	},
	status: function(code, cb) {
		this.statusHandlers[code] = cb;		
	},
	navigateExternal: function(path) {
		bus.publish('router:navigating-external', {url: path});
        bus.publish('system-shutdown', {reason: 'navigating-external', url: path});
        window.location.assign(path);
	}
};

module.exports = router;
});
require.register('web-storage', function(require, exports, module) {
/**
 * Web storage component.
 *
 * Manages persistence storage of data through different strategies.
 * Implementation of storage strategies provided in other components.
 * Possible to register custom strategy.
 *
 * Configured with the following default strategies:
 * - memory -> In memory, data will be lost on page refresh.
 * - session -> DOM session storage
 * - local -> DOM local storage
 * - cookie -> Cookie storage
 */

'use strict';

/*
 * TODO
 * look into default strategy...
 * Error handling
 * */

var domStorage = require('web-storage/dom-storage');
var cookie = require('web-storage/cookie');

/**
 * Default Storage strategies.
 */
var strategies = {

	/**
	 * In memory storage strategy, implemented in place.
	 */
	memory: {
		retrieve: function (key) {
			return this.storage && this.storage[key];
		},
		store: function (key, value) {
			if (!this.storage) {
				this.storage = {};
			}
			this.storage[key] = value;
		},
		remove: function (key) {
			if (this.storage) {
				delete this.storage[key];
			}
		},
		clear: function () {
			this.storage = {};
		}
	},

	/**
	 * DOM session storage strategy, adapts dom storage component
	 */
	session: createStorageStrategy(domStorage.session),

	/**
	 * DOM local storage strategy, adapts dom storage component
	 */
	local: createStorageStrategy(domStorage.local),

	/**
	 * Cookie storage strategy, adapts cookie component.
	 */
	cookie: {
		retrieve: function (key) {
			return cookie.get(key);
		},
		store: function (key, value) {

			//set expiry time to one month
			var MS_PER_DAY = 24 * 60 * 60 * 1000;
			var expireDate = new Date(Date.now() + 30 * MS_PER_DAY);

			cookie.set(key, value, expireDate);
		},
		remove: function (key) {
			cookie.remove(key);
		},
		clear: function () {
			// let's not go there...
		}
	}
};


/**
 * Adapts DOM storage component as strategy
 */
function createStorageStrategy(storage) {
	return {
		store: function (key, value) {
			storage.set(key, value);
		},
		retrieve: function (key) {
			return storage.get(key);
		},
		remove: function (key) {
			storage.remove(key);
		},
		clear: function () {
			storage.clear();
		}
	};

}

/**
 * Life cycle method for initialization, will be invoked by framework.
 */
exports.init = function () {
};

/**
 * Life cycle method for tear-down, will be invoked by framework.
 */
exports.dispose = function () {
};

/**
 * Store data with provided strategy.
 * @param {String} strategy
 * @param {String} key
 * @param {Object} value
 */
exports.store = function (strategy, key, value) {
	strategies[strategy].store(key, value);
};

/**
 * Retrieve data with provided strategy
 * @param {String} strategy
 * @param {String} key
 * @return {Object} stored data
 */
exports.retrieve = function (strategy, key) {
	return strategies[strategy].retrieve(key);
};

/**
 * Remove stored data for provided strategy.
 * @param {String} strategy
 * @param {String} key
 */
exports.remove = function (strategy, key) {
	strategies[strategy].remove(key);
};

/**
 * Remove all stored data in provided strategy.
 * @param {String} strategy
 */
exports.clear = function (strategy) {
	strategies[strategy].clear();
};

/**
 * Remove all stored data across all registered strategies.
 */
exports.clearAll = function () {
	for (var strategy in strategies) {
		if (strategies.hasOwnProperty(strategy)) {
			strategies[strategy].clear();
		}
	}
};

/**
 * Register a custom storage strategy implementing the following interface:
 *
 * retrieve(key){}        // Return value associated to provided key
 * store(key,value){}    // Associate provided value to provided key
 * remove(key){}        // Remove associated value to provided key
 * clear(){}            // Remove all key value associations
 *
 * @param {String} name
 * @param {object} strategy
 */
exports.registerStrategy = function (name, strategy) {
	strategies[name] = strategy;
};

});
require.register('boot/bootstrap', function(require, exports, module) {
'use strict';

var lifecycle = require('lifecycle-manager');

module.exports = function (config, extensions, features) {

	extensions = extensions || [];
	features = features || [];
	var lifeCycleConfig = config['lifecycle-manager'] || {};
	lifeCycleConfig.system = [ {
			name: 'router',
			prio: 2,
			skipStart: true,
			config: config['router']
		}, {
			name: 'layout-engine',
			prio: 3,
			config: config['layout-engine']
		}
	];
	lifeCycleConfig.extensions = extensions.map(function (ext) {
		ext.config = config[ext.name];
		return ext;
	});
	lifeCycleConfig.features = features.map(function(feature) {
		feature.config = config[feature.name];
		return feature;
	});
	

	lifecycle.init(lifeCycleConfig);
	lifecycle.run();
	lifecycle.getComponent('router').start(true);
};

});
require.register('layout-engine/domify', function(require, exports, module) {
'use strict';

/*
 *    https://github.com/component/domify
 *    License MIT
 *    version 1.2.1
 *    The only changes made to the code, is inorder to make jshint happy.
 * */

/**
 * Expose `parse`.
 */

module.exports = parse;

/**
 * Wrap map from jquery.
 */

var map = {
  legend: [1, '<fieldset>', '</fieldset>'],
  tr: [2, '<table><tbody>', '</tbody></table>'],
  col: [2, '<table><tbody></tbody><colgroup>', '</colgroup></table>'],
  _default: [0, '', '']
};

map.td =
map.th = [3, '<table><tbody><tr>', '</tr></tbody></table>'];

map.option =
map.optgroup = [1, '<select multiple="multiple">', '</select>'];

map.thead =
map.tbody =
map.colgroup =
map.caption =
map.tfoot = [1, '<table>', '</table>'];

map.text =
map.circle =
map.ellipse =
map.line =
map.path =
map.polygon =
map.polyline =
map.rect = [1, '<svg xmlns="http://www.w3.org/2000/svg" version="1.1">','</svg>'];

/**
 * Parse `html` and return the children.
 *
 * @param {String} html
 * @return {Array}
 * @api private
 */

function parse(html) {
  if ('string' != typeof html) { throw new TypeError('String expected'); }
  var el;
  // tag name
  var m = /<([\w:]+)/.exec(html);
  if (!m) { return document.createTextNode(html); }

  html = html.replace(/^\s+|\s+$/g, ''); // Remove leading/trailing whitespace

  var tag = m[1];

  // body support
  if (tag == 'body') {
    el = document.createElement('html');
    el.innerHTML = html;
    return el.removeChild(el.lastChild);
  }

  // wrap map
  var wrap = map[tag] || map._default;
  var depth = wrap[0];
  var prefix = wrap[1];
  var suffix = wrap[2];
  el = document.createElement('div');
  el.innerHTML = prefix + html + suffix;
  while (depth--) { el = el.lastChild; }

  // one element
  if (el.firstChild == el.lastChild) {
    return el.removeChild(el.firstChild);
  }

  // several elements
  var fragment = document.createDocumentFragment();
  while (el.firstChild) {
    fragment.appendChild(el.removeChild(el.firstChild));
  }

  return fragment;
}
});
require.register('layout-engine/region-handler', function(require, exports, module) {

var regionHandler = {
	setup: function(root, options) {
		if(!root) { throw new Error('missing root'); }
		this.setRoot(root);
	},
	update: function(node, viewmodel, options) {
		var opt = options || {};
		if(node.nodeType === 11) {
			throw new Error('Document fragments are not allowed!\nIf you are trying to render a template, make sure it has only one root node!');
		}		
		if(opt.noBinding) { return; }
		this.clearRegion();
		ko.applyBindings(viewmodel, node);
		this.root.appendChild(node);

		this.previous = {model: viewmodel, view: node};
	},
	clearRegion: function() {
		if(this.previous){
			ko.removeNode(this.previous.view);
			if(this.previous.model && this.previous.model.dispose) {
				this.previous.model.dispose();
			}
            this.previous = null;
		}
	},
	setRoot: function(root) {
		this.root = root;
	}
};

module.exports = regionHandler;
});
require.register('router/context', function(require, exports, module) {
'use strict';

/*
* Based on Context from Page.js
* https://github.com/visionmedia/page.js
* License MIT
* */
var queryParser = require('./querystring');

var context = {
	/*
	 * init - initialize context
	 * @param {string} path - current path to create the context for
	 * @param {string} base - the base path used by the application
	 * @param {Object} state - object to hold state (mostly for history.pushState)
	 * */
	init: function (path, base, state) {

		this.path = path.replace(base, '') || '/';
		this.state = state || {};
		this.state.path = path;
		this.title = document.title;
		this.canonicalPath = path; // including base path
		var i = path.indexOf('?');
		this.querystring = ~i ? path.slice(i + 1) : '';
		this.pathname = ~i ? path.slice(0, i) : path;
		this.params = [];
		this.queryObject = queryParser.parse(this.querystring);
	}
};


/*
 * create - factory method for creating a new route context
 *
 * @param {string} path - current path to create the context for
 * @param {string} base - the base path used by the application
 * @param {Object} state - object to hold state (mostly for history.pushState)
 * @return {Object} context - new created and initialized context object
 * */
exports.create = function (path, base, state) {
	var ctx = Object.create(context);
	ctx.init(path, base, state);
	return ctx;
};

});
require.register('router/path-to-regexp', function(require, exports, module) {
'use strict';

/*
* https://github.com/component/path-to-regexp
* License MIT
* */

/**
 * Normalize the given path string,
 * returning a regular expression.
 *
 * An empty array should be passed,
 * which will contain the placeholder
 * key names. For example "/user/:id" will
 * then contain ["id"].
 *
 * @param  {String|RegExp|Array} path
 * @param  {Array} keys
 * @param  {Object} options
 * @return {RegExp}
 * @api private
 */

function pathtoRegexp(path, keys, options) {
	options = options || {};
	var sensitive = options.sensitive;
	var strict = options.strict;
	keys = keys || [];

	/* jshint curly: false */
	if (path instanceof RegExp) return path;
	if (path instanceof Array) path = '(' + path.join('|') + ')';

	path = path
		.concat(strict ? '' : '/?')
		.replace(/\/\(/g, '(?:/')
		.replace(/(\/)?(\.)?:(\w+)(?:(\(.*?\)))?(\?)?(\*)?/g, function (_, slash, format, key, capture, optional, star) {
			keys.push({ name: key, optional: !!optional });
			slash = slash || '';
			return '' +
				(optional ? '' : slash) +
				'(?:' +
				(optional ? slash : '') +
				(format || '') +
				(capture || (format && '([^/.]+?)' || '([^/]+?)')) +
				')' +
				(optional || '') +
				(star ? '(/*)?' : '');
		})
		.replace(/([\/.])/g, '\\$1')
		.replace(/\*/g, '(.*)');

	return new RegExp('^' + path + '$', sensitive ? '' : 'i');
}

module.exports = pathtoRegexp;

});
require.register('router/querystring', function(require, exports, module) {
'use strict';

/*
* https://github.com/component/querystring
* License MIT
*
* */
/*
 * Will parse the given querystring into an object such that:
 * ?a=1&b=2   =>  { a:1, b:2 }
 *
 * @param {String} str - querystring
 * @return {Object} queryobject
 * */
exports.parse = function (str) {

	if ('string' != typeof str) {
		return {};
	}
	str = str.trim();
	if (str === '') {
		return {};
	}

	var obj = {};
	var pairs = str.split('&');
	pairs.forEach(function (pair) {
		var parts = pair.split('=');
		/* jshint eqnull: true */
		/* this is NOT to be changed to === */
		obj[parts[0]] = null == parts[1] ? '' : decodeURIComponent(parts[1]);
	});

	return obj;
};

/*
 * will convert an object to a querystring
 *
 * it will encodeURIComponent on key/value pairs
 *
 * @param {Object} object to be turned to a querystring
 * @return {String} querystring
 * */
exports.stringify = function (obj) {

	if (!obj) {
		return '';
	}
	var pairs = [];
	var keys = Object.keys(obj);
	keys.forEach(function (key) {
		pairs.push(encodeURIComponent(key) + '=' + encodeURIComponent(obj[key]));
	});
	return pairs.join('&');
};

});
require.register('router/route', function(require, exports, module) {
'use strict';

/*
* Mostly based on
* https://github.com/component/route
* License MIT
* */

var pathToRegexp = require('./path-to-regexp');
/*
 * a route represents a url pattern and a matching callback
 * used by the router to dispatch incoming routes
 * */
var route = {
	/*
	 * initialize the route with a path pattern, have a look at path-to-regexp for further info
	 *
	 * @param {String} path this is the path pattern send to path-to-regexp
	 * @param {Function} callback
	 * */
	init: function (path, callback) {
		this.path = path;
		this.keys = [];
		this.regexp = pathToRegexp(this.path, this.keys);
		this.callback = callback;

	},
	middleware: function (fn) {
		var self = this;
		return function (ctx, next) {
			if (self.match(ctx.path, ctx.params)) {
				return fn(ctx, next);
			}
			next();
		};
	},
	match: function (path, params) {
		var qsIndex = path.indexOf('?');
		var pathname = ~qsIndex ? path.slice(0, qsIndex) : path;
		var m = this.regexp.exec(pathname);
		var keys = this.keys;
		var args = [];

		if (!m) {
			return false;
		}
		for (var i = 1, len = m.length; i < len; ++i) {
			var key = keys[i - 1];

			/* jshint laxbreak: true */
			var val = ('string' == typeof m[i]
				? decodeURIComponent(m[i])
				: m[i]);

			if (key) {
				params[key.name] = (undefined !== params[key.name]
					? params[key.name]
					: val);
			} else {
				params.push(val);
			}

			args.push(val);
		}

		params.args = args;
		return true;
	}
};
exports.create = function (path, callback) {
	var r = Object.create(route);
	r.init(path, callback);
	return r;
};


});
require.register('utils/extend', function(require, exports, module) {
'use strict';


module.exports = function (obj) {

	var args = [].slice.call(arguments, 1);

	args.forEach(function (source) {
		if (source) {
			for (var prop in source) {
				obj[prop] = source[prop];
			}
		}
	});

	return obj;
};


});
require.register('utils/object-disabler', function(require, exports, module) {

function isFunction(obj) {
    return function(prop) {
        return typeof(obj[prop]) === 'function';        
    };     
}

function skipMethods(skip) {
    return function(method) {
        return skip.indexOf(method) < 0;
    }; 
}

function disableObject(obj, skip) {
    
    var methods = [];
    skip = skip || [];

    Object.keys(obj).filter(isFunction(obj))
                    .filter(skipMethods(skip))
                    .forEach(function(method) {
                        methods.push({name: method, fn: obj[method]});
                        obj[method] = function() {
                            console.warn('Object disabled, tried calling ' + method, arguments);
                            return false;
                        };         
                    });   
    obj.restore = function() {
        methods.forEach(function(m) {
            obj[m.name] = m.fn;    
        });
        delete obj.restore;
    };      
} 

module.exports = disableObject;

});
require.register('utils/request', function(require, exports, module) {
'use strict';

/*
* https://github.com/visionmedia/superagent
* License MIT
*
* Modified from original, but method interface should be the same
* */

var uuid = require('./uuid');
var subscribable = require('./subscribable');

/*
* Root reference for iframes.
* */

var root = 'undefined' == typeof window ? this : window;

/**
 * Noop.
 */

function noop(){}

/**
 * Check if `obj` is a host object,
 * we don't want to serialize these :)
 *
 *
 * @param {Object} obj
 * @return {Boolean}
 * @api private
 */

function isHost(obj) {
    var str = {}.toString.call(obj);

    switch (str) {
        case '[object File]':
        case '[object Blob]':
        case '[object FormData]':
            return true;
        default:
            return false;
    }
}

/**
 * Determine XHR.
 */

function getXHR() {
    if(!root.XMLHttpRequest){
        throw new Error('request not supported on target device');
    }
    return new XMLHttpRequest();
}

/**
 * Removes leading and trailing whitespace, added to support IE.
 *
 * @param {String} s
 * @return {String}
 * @api private
 */

var trim = ''.trim ? function(s) { return s.trim(); } : function(s) { return s.replace(/(^\s*|\s*$)/g, ''); };

/**
 * Check if `obj` is an object.
 *
 * @param {Object} obj
 * @return {Boolean}
 * @api private
 */

function isObject(obj) {
    return obj === Object(obj);
}

/**
 * Serialize the given `obj`.
 *
 * @param {Object} obj
 * @return {String}
 * @api private
 */

function serialize(obj) {
    if (!isObject(obj)) {
        return obj;
    }
    var pairs = [];
    for (var key in obj) {
        if(obj.hasOwnProperty(key)) {
            pairs.push(encodeURIComponent(key) + '=' + encodeURIComponent(obj[key]));
        }
    }
    return pairs.join('&');
}

/**
 * Expose serialization method.
 */

request.serializeObject = serialize;

/**
 * Parse the given x-www-form-urlencoded `str`.
 *
 * @param {String} str
 * @return {Object}
 * @api private
 */

function parseString(str) {
    var obj = {};
    var pairs = str.split('&');
    var parts;
    var pair;

    for (var i = 0, len = pairs.length; i < len; ++i) {
        pair = pairs[i];
        parts = pair.split('=');
        obj[decodeURIComponent(parts[0])] = decodeURIComponent(parts[1]);
    }

    return obj;
}

/**
 * Expose parser.
 */

request.parseString = parseString;

/**
 * Default MIME type map.
 *
 *     superagent.types.xml = 'application/xml';
 *
 */

request.types = {
    html: 'text/html',
    json: 'application/json',
    urlencoded: 'application/x-www-form-urlencoded',
    'form': 'application/x-www-form-urlencoded',
    'form-data': 'application/x-www-form-urlencoded'
};

/**
 * Default serialization map.
 *
 *
 */

request.serialize = {
    'application/x-www-form-urlencoded': serialize,
    'application/json': JSON.stringify
};

/**
 * Default parsers.
 *
 */

request.parse = {
    'application/x-www-form-urlencoded': parseString,
    'application/json': JSON.parse
};

/**
 * Parse the given header `str` into
 * an object containing the mapped fields.
 *
 * @param {String} str
 * @return {Object}
 * @api private
 */

function parseHeader(str) {
    var lines = str.split(/\r?\n/);
    var fields = {};
    var index;
    var line;
    var field;
    var val;

    lines.pop(); // trailing CRLF

    for (var i = 0, len = lines.length; i < len; ++i) {
        line = lines[i];
        index = line.indexOf(':');
        field = line.slice(0, index).toLowerCase();
        val = trim(line.slice(index + 1));
        fields[field] = val;
    }

    return fields;
}

/**
 * Return the mime type for the given `str`.
 *
 * @param {String} str
 * @return {String}
 * @api private
 */

function type(str){
    return str.split(/ *; */).shift();
}

/**
 * Return header field parameters.
 *
 * @param {String} str
 * @return {Object}
 * @api private
 */

function params(str){
    return str.split(/ *; */).reduce(function(obj, str){
        var parts = str.split(/ *= */);
        var key = parts.shift();
        var val = parts.shift();

        if (key && val) {
            obj[key] = val;
        }
        return obj;
    }, {});
}

/**
 * Initialize a new `Response` with the given `xhr`.
 *
 *  - set flags (.ok, .error, etc)
 *  - parse header
 *
 * Examples:
 *
 *  Aliasing `superagent` as `request` is nice:
 *
 *      request = superagent;
 *
 *  We can use the promise-like API, or pass callbacks:
 *
 *      request.get('/').end(function(res){});
 *      request.get('/', function(res){});
 *
 *  Sending data can be chained:
 *
 *      request
 *        .post('/user')
 *        .send({ name: 'tj' })
 *        .end(function(res){});
 *
 *  Or passed to `.send()`:
 *
 *      request
 *        .post('/user')
 *        .send({ name: 'tj' }, function(res){});
 *
 *  Or passed to `.post()`:
 *
 *      request
 *        .post('/user', { name: 'tj' })
 *        .end(function(res){});
 *
 * Or further reduced to a single call for simple cases:
 *
 *      request
 *        .post('/user', { name: 'tj' }, function(res){});
 *
 * @param {Request} req
 * @param {Object} options
 * @api private
 */

function Response(req, options) {
    this.options = options || {};
    this.req = req;
    this.xhr = this.req.xhr;
    this.text = this.xhr.responseText;
    this.setStatusProperties(this.xhr.status);
    this.header = this.headers = parseHeader(this.xhr.getAllResponseHeaders());
    // getAllResponseHeaders sometimes falsely returns "" for CORS requests, but
    // getResponseHeader still works. so we get content-type even if getting
    // other headers fails.
    this.header['content-type'] = this.xhr.getResponseHeader('content-type');
    this.setHeaderProperties(this.header);
    this.body = this.parseBody(this.text);
    this.uuid = uuid();
}

/**
 * Get case-insensitive `field` value.
 *
 * @param {String} field
 * @return {String}
 * @api public
 */

Response.prototype.get = function(field){
    return this.header[field.toLowerCase()];
};

/**
 * Set header related properties:
 *
 *   - `.type` the content type without params
 *
 * A response of "Content-Type: text/plain; charset=utf-8"
 * will provide you with a `.type` of "text/plain".
 *
 * @param {Object} header
 * @api private
 */

Response.prototype.setHeaderProperties = function(header){
    // content-type
    this.header = header;
    var ct = this.header['content-type'] || '';
    this.type = type(ct);

    // params
    var obj = params(ct);
    for (var key in obj) {
        if(obj.hasOwnProperty(key)) {
            this[key] = obj[key];
        }
    }
};

/**
 * Parse the given body `str`.
 *
 * Used for auto-parsing of bodies. Parsers
 * are defined on the `superagent.parse` object.
 *
 * @param {String} str
 * @return {Mixed}
 * @api private
 */

Response.prototype.parseBody = function(str){
    var parse = request.parse[this.type];
    return parse ? parse(str) : null;
};

/**
 * Set flags such as `.ok` based on `status`.
 *
 * For example a 2xx response will give you a `.ok` of __true__
 * whereas 5xx will be __false__ and `.error` will be __true__. The
 * `.clientError` and `.serverError` are also available to be more
 * specific, and `.statusType` is the class of error ranging from 1..5
 * sometimes useful for mapping respond colors etc.
 *
 * "sugar" properties are also defined for common cases. Currently providing:
 *
 *   - .noContent
 *   - .badRequest
 *   - .unauthorized
 *   - .notAcceptable
 *   - .notFound
 *
 * @param {Number} status
 * @api private
 */

Response.prototype.setStatusProperties = function(status){
    var type = status / 100 | 0;

    // status / class
    this.status = status;
    this.statusType = type;

    // basics
    this.info = 1 == type;
    this.ok = 2 == type;
    this.clientError = 4 == type;
    this.serverError = 5 == type;
    this.error = (4 == type || 5 == type) ? this.toError() : false;

    // sugar
    this.accepted = 202 == status;
    this.noContent = 204 == status || 1223 == status;
    this.badRequest = 400 == status;
    this.unauthorized = 401 == status;
    this.notAcceptable = 406 == status;
    this.notFound = 404 == status;
    this.forbidden = 403 == status;
};

/**
 * Return an `Error` representative of this response.
 *
 * @return {Error}
 * @api public
 */

Response.prototype.toError = function(){
    var req = this.req;
    var method = req.method;
    var path = req.path;

    var msg = 'cannot ' + method + ' ' + path + ' (' + this.status + ')';
    var err = new Error(msg);
    err.status = this.status;
    err.method = method;
    err.path = path;

    return err;
};

/**
 * Expose `Response`.
 */

request.Response = Response;

/**
 * Initialize a new `Request` with the given `method` and `url`.
 *
 * @param {String} method
 * @param {String} url
 * @api public
 */

function Request(method, url) {
    this._query = this._query || [];
    this.method = method;
    this.url = url;
    this.header = {};
    this._header = {};
    this.uuid = uuid();
    subscribable.mixin(this);
    var subscription = this.subscribe('end', function (data) {

        if (data.request.uuid === this.uuid) {
            var res = new Response(this, {});
            if ('HEAD' == method) {
                res.text = null;
            }
            this.callback(null, res);
            subscription.dispose();
        }
    }.bind(this));
}


/**
 * Set timeout to `ms`.
 *
 * @param {Number} ms
 * @return {Request} for chaining
 * @api public
 */

Request.prototype.timeout = function(ms){
    this._timeout = ms;
    return this;
};

/**
 * Clear previous timeout.
 *
 * @return {Request} for chaining
 * @api public
 */

Request.prototype.clearTimeout = function(){
    this._timeout = 0;
    clearTimeout(this._timer);
    return this;
};

/**
 * Abort the request, and clear potential timeout.
 *
 * @return {Request}
 * @api public
 */

Request.prototype.abort = function(){
    if (this.aborted) {
        return;
    }
    this.aborted = true;
    this.xhr.abort();
    this.clearTimeout();
    this.publish('abort', {request: this});
    return this;
};

/**
 * Set header `field` to `val`, or multiple fields with one object.
 *
 * Examples:
 *
 *      req.get('/')
 *        .set('Accept', 'application/json')
 *        .set('X-API-Key', 'foobar')
 *        .end(callback);
 *
 *      req.get('/')
 *        .set({ Accept: 'application/json', 'X-API-Key': 'foobar' })
 *        .end(callback);
 *
 * @param {String|Object} field
 * @param {String} val
 * @return {Request} for chaining
 * @api public
 */

Request.prototype.set = function(field, val){
    if (isObject(field)) {
        for (var key in field) {
            if(field.hasOwnProperty(key)) {
                this.set(key, field[key]);
            }
        }
        return this;
    }
    this._header[field.toLowerCase()] = val;
    this.header[field] = val;
    return this;
};

/**
 * Get case-insensitive header `field` value.
 *
 * @param {String} field
 * @return {String}
 * @api private
 */

Request.prototype.getHeader = function(field){
    return this._header[field.toLowerCase()];
};

/**
 * Set Content-Type to `type`, mapping values from `request.types`.
 *
 * Examples:
 *
 *      superagent.types.xml = 'application/xml';
 *
 *      request.post('/')
 *        .type('xml')
 *        .send(xmlstring)
 *        .end(callback);
 *
 *      request.post('/')
 *        .type('application/xml')
 *        .send(xmlstring)
 *        .end(callback);
 *
 * @param {String} type
 * @return {Request} for chaining
 * @api public
 */

Request.prototype.type = function(type){
    this.set('Content-Type', request.types[type] || type);
    return this;
};

/**
 * Set Authorization field value with `user` and `pass`.
 *
 * @param {String} user
 * @param {String} pass
 * @return {Request} for chaining
 * @api public
 */

Request.prototype.auth = function(user, pass){
    var str = btoa(user + ':' + pass);
    this.set('Authorization', 'Basic ' + str);
    return this;
};

/**
 * Add query-string `val`.
 *
 * Examples:
 *
 *   request.get('/shoes')
 *     .query('size=10')
 *     .query({ color: 'blue' })
 *
 * @param {Object|String} val
 * @return {Request} for chaining
 * @api public
 */

Request.prototype.query = function(val){
    if ('string' != typeof val) {
        val = serialize(val);
    }
    if (val) {
        this._query.push(val);
    }
    return this;
};

/**
 * Send `data`, defaulting the `.type()` to "json" when
 * an object is given.
 *
 * Examples:
 *
 *       // querystring
 *       request.get('/search')
 *         .end(callback)
 *
 *       // multiple data "writes"
 *       request.get('/search')
 *         .send({ search: 'query' })
 *         .send({ range: '1..5' })
 *         .send({ order: 'desc' })
 *         .end(callback)
 *
 *       // manual json
 *       request.post('/user')
 *         .type('json')
 *         .send('{"name":"tj"})
 *         .end(callback)
 *
 *       // auto json
 *       request.post('/user')
 *         .send({ name: 'tj' })
 *         .end(callback)
 *
 *       // manual x-www-form-urlencoded
 *       request.post('/user')
 *         .type('form')
 *         .send('name=tj')
 *         .end(callback)
 *
 *       // auto x-www-form-urlencoded
 *       request.post('/user')
 *         .type('form')
 *         .send({ name: 'tj' })
 *         .end(callback)
 *
 *       // defaults to x-www-form-urlencoded
 *      request.post('/user')
 *        .send('name=tobi')
 *        .send('species=ferret')
 *        .end(callback)
 *
 * @param {String|Object} data
 * @return {Request} for chaining
 * @api public
 */

Request.prototype.send = function(data){
    var obj = isObject(data);
    var type = this.getHeader('Content-Type');

    // merge
    if (obj && isObject(this._data)) {
        for (var key in data) {
            if(data.hasOwnProperty(key)) {
                this._data[key] = data[key];
            }
        }
    } else if ('string' == typeof data) {
        if (!type) {
            this.type('form');
        }
        type = this.getHeader('Content-Type');
        if ('application/x-www-form-urlencoded' == type) {
            this._data = this._data ? this._data + '&' + data : data;
        } else {
            this._data = (this._data || '') + data;
        }
    } else {
        this._data = data;
    }

    if (!obj) {
        return this;
    }
    if (!type) {
        this.type('json');
    }
    return this;
};

/**
 * Invoke the callback with `err` and `res`
 * and handle arity check.
 *
 * @param {Error} err
 * @param {Response} res
 * @api private
 */

Request.prototype.callback = function(err, res){
    var fn = this._callback;
    if (2 == fn.length) {
        return fn(err, res);
    }
    if (err) {
        return this.publish('error', {request: this, error: err });
    }
    fn(res);
};

/**
 * Invoke callback with x-domain error.
 *
 * @api private
 */

Request.prototype.crossDomainError = function(){
    var err = new Error('Origin is not allowed by Access-Control-Allow-Origin');
    err.crossDomain = true;
    this.callback(err);
};

/**
 * Invoke callback with timeout error.
 *
 * @api private
 */

Request.prototype.timeoutError = function(){
    var timeout = this._timeout;
    var err = new Error('timeout of ' + timeout + 'ms exceeded');
    err.timeout = timeout;
    this.callback(err);
};

/**
 * Enable transmission of cookies with x-domain requests.
 *
 * Note that for this to work the origin must not be
 * using "Access-Control-Allow-Origin" with a wildcard,
 * and also must set "Access-Control-Allow-Credentials"
 * to "true".
 *
 * @api public
 */

Request.prototype.withCredentials = function(){
    this._withCredentials = true;
    return this;
};

/**
 * Initiate request, invoking callback `fn(res)`
 * with an instanceof `Response`.
 *
 * @param {Function} fn
 * @return {Request} for chaining
 * @api public
 */

Request.prototype.end = function(fn){
    var self = this;
    var xhr = this.xhr = getXHR();
    var query = this._query.join('&');
    var timeout = this._timeout;
    var data = this._data;

    // store callback
    this._callback = fn || noop;

    // CORS
    if (this._withCredentials) {
        xhr.withCredentials = true;
    }

    // state change
    xhr.onreadystatechange = function(){
        if (4 != xhr.readyState) {
            return;
        }
        if (0 === xhr.status) {
            if (self.aborted) {
                return self.timeoutError();
            }
            return self.crossDomainError();
        }
        self.publish('end', {request: self });
    };

    // progress
    if (xhr.upload) {
        xhr.upload.onprogress = function(e){
            e.percent = e.loaded / e.total * 100;
            self.publish('progress', {request: self, progress: e});
        };
    }

    // timeout
    if (timeout && !this._timer) {
        this._timer = setTimeout(function(){
            self.abort();
        }, timeout);
    }

    // querystring
    if (query) {
        query = request.serializeObject(query);
        this.url += ~this.url.indexOf('?') ? '&' + query : '?' + query;
    }

    // initiate request
    xhr.open(this.method, this.url, true);

    // body
    if ('GET' != this.method && 'HEAD' != this.method && 'string' != typeof data && !isHost(data)) {
        // serialize stuff
        var serialize = request.serialize[this.getHeader('Content-Type')];
        if (serialize) {
            data = serialize(data);
        }
    }

    // set header fields
    for (var field in this.header) {
        if(this.header.hasOwnProperty(field)){
            if (null == this.header[field]) {
                continue;
            }
            xhr.setRequestHeader(field, this.header[field]);
        }
    }

    // send stuff
    xhr.send(data);
    return this;
};

/**
 * Expose `Request`.
 */

request.Request = Request;

/**
 * Issue a request:
 *
 * Examples:
 *
 *    request('GET', '/users').end(callback)
 *    request('/users').end(callback)
 *    request('/users', callback)
 *
 * @param {String} method
 * @param {String|Function} url or callback
 * @return {Request}
 * @api public
 */

function request(method, url) {

    // callback
    if ('function' == typeof url) {
        return new Request('GET', method).end(url);
    }

    // url first
    if (1 == arguments.length) {
        return new Request('GET', method);
    }

    return new Request(method, url);
}

/**
 * GET `url` with optional callback `fn(res)`.
 *
 * @param {String} url
 * @param {Mixed|Function} data or fn
 * @param {Function} fn
 * @return {Request}
 * @api public
 */

request.get = function(url, data, fn){
    var req = request('GET', url);
    if ('function' == typeof data) {
        fn = data;
        data = null;
    }
    if (data) {
        req.query(data);
    }
    if (fn) {
        req.end(fn);
    }
    return req;
};

/**
 * GET `url` with optional callback `fn(res)`.
 *
 * @param {String} url
 * @param {Mixed|Function} data or fn
 * @param {Function} fn
 * @return {Request}
 * @api public
 */

request.head = function(url, data, fn){
    var req = request('HEAD', url);
    if ('function' == typeof data) {
        fn = data;
        data = null;
    }
    if (data) {
        req.send(data);
    }
    if (fn) {
        req.end(fn);
    }
    return req;
};

/**
 * DELETE `url` with optional callback `fn(res)`.
 *
 * @param {String} url
 * @param {Function} fn
 * @return {Request}
 * @api public
 */

request.del = function(url, fn){
    var req = request('DELETE', url);
    if (fn) {
        req.end(fn);
    }
    return req;
};

/**
 * PATCH `url` with optional `data` and callback `fn(res)`.
 *
 * @param {String} url
 * @param {Mixed} data
 * @param {Function} fn
 * @return {Request}
 * @api public
 */

request.patch = function(url, data, fn){
    var req = request('PATCH', url);
    if ('function' == typeof data) {
        fn = data;
        data = null;
    }
    if (data) {
        req.send(data);
    }
    if (fn) {
        req.end(fn);
    }
    return req;
};

/**
 * POST `url` with optional `data` and callback `fn(res)`.
 *
 * @param {String} url
 * @param {Mixed} data
 * @param {Function} fn
 * @return {Request}
 * @api public
 */

request.post = function(url, data, fn){
    var req = request('POST', url);
    if ('function' == typeof data) {
        fn = data; data = null;
    }
    if (data) {
        req.send(data);
    }
    if (fn) {
        req.end(fn);
    }
    return req;
};

/**
 * PUT `url` with optional `data` and callback `fn(res)`.
 *
 * @param {String} url
 * @param {Mixed|Function} data or fn
 * @param {Function} fn
 * @return {Request}
 * @api public
 */

request.put = function(url, data, fn){
    var req = request('PUT', url);
    if ('function' == typeof data) {
        fn = data;
        data = null;
    }
    if (data) {
        req.send(data);
    }
    if (fn) {
        req.end(fn);
    }
    return req;
};

/**
 * Expose `request`.
 */

module.exports = request;

});
require.register('utils/script-loader', function(require, exports, module) {
'use strict';

var scripts = {};

exports.scripts = scripts;

/*
* Can only load javascript at the moment, could be extended to handle styles too.
* */
exports.load = function (src, cb) {
    var head = document.head || document.getElementsByTagName('head')[0];
    var elem = document.createElement('script');
    elem.type = 'text/javascript';
    elem.src = src;
    elem.async = 1;

    function onload(e){
        elem.removeEventListener('load', onload, false);
        scripts[src] = 'loaded';
        cb(null, elem);
    }
    function onerror(e) {
        var err = new Error('Could not load elem src='+src);
        scripts[src] = 'error';
        cb(err);
    }
    elem.addEventListener('load', onload, false);

    elem.addEventListener('error', onerror);

    scripts[src] = 'loading';

    // but insert at end of head, because otherwise if it is a stylesheet, it will not ovverride values
    head.insertBefore(elem, head.lastChild);

};
});
require.register('utils/subscribable', function(require, exports, module) {
'use strict';

function subscribe(event, callback) {
    var subscription = createSubscription.call(this, event, callback);
    this.subscriptions.push(subscription);
    return subscription;
}

function createSubscription(event, callback){

    var subscription = {
        event: new RegExp(event),
        callback: callback,
        dispose: function () {
            var i = this.subscriptions.indexOf(subscription);
            if (i >= 0) {
                this.subscriptions.splice(i, 1);
            }
            subscription.isDisposed = true;
        }.bind(this)
    };
    return subscription;
}

function publish(event, data) {

    var filter = function (subscription) {
        return event.match(subscription.event);
    };

    var callSubscriber = function (subscription) {
        if(subscription.isDisposed) {
            return;
        }
        subscription.callback(data);
    };

    this.subscriptions.filter(filter).forEach(callSubscriber);
}

exports.mixin = function (obj) {

    obj.subscriptions = [];
    obj.subscribe = subscribe;
    obj.publish = publish;

    return obj;
};


});
require.register('utils/url', function(require, exports, module) {
'use strict';
/* implemented with regex from http://www.ietf.org/rfc/rfc3986.txt */
var splitRegExp = new RegExp(
	'^' +
		'(?:' +
		'([^:/?#.]+)' +                         // scheme - ignore special characters
		// used by other URL parts such as :,
		// ?, /, #, and .
		':)?' +
		'(?://' +
		'(?:([^/?#]*)@)?' +                     // userInfo
		'([\\w\\d\\-\\u0100-\\uffff.%]*)' +     // domain - restrict to letters,
		// digits, dashes, dots, percent
		// escapes, and unicode characters.
		'(?::([0-9]+))?' +                      // port
		')?' +
		'([^?#]+)?' +                           // path
		'(?:\\?([^#]*))?' +                     // query
		'(?:#(.*))?' +                          // fragment
		'$');

exports.parse = function (uri) {
	var split;
	split = uri.match(splitRegExp);
	return {
		'scheme': split[1],
		'user_info': split[2],
		'domain': split[3],
		'port': split[4],
		'path': split[5],
		'querystring': split[6],
		'fragment': split[7]
	};
};
});
require.register('utils/uuid', function(require, exports, module) {

'use strict';

var chars = '0123456789ABCDEFGHIJKLMNOPQRSTUVWXYZabcdefghijklmnopqrstuvwxyz'.split('');

/*!
 * Math.uuid.js (v1.4)
 * http://www.broofa.com
 * mailto:robert@broofa.com
 *
 * Copyright (c) 2010 Robert Kieffer
 * Dual licensed under the MIT and GPL licenses.
 */

/**
 * A more performant, but slightly bulkier, RFC4122v4 solution.
 * We boost performance by minimizing calls to random()
 *
 * @return {string}
 */
module.exports = function () {

	var uuid = new Array(36),
		rnd = 0,
		r, i;

	for (i = 0; i < 36; i++) {
		if (i === 8 || i === 13 || i === 18 || i === 23) {
			uuid[i] = '-';
		}
		else if (i === 14) {
			uuid[i] = '4';
		}
		else {
			if (rnd <= 0x02) {
				rnd = 0x2000000 + (Math.random() * 0x1000000) | 0;
			}

			r = rnd & 0xf;
			rnd = rnd >> 4;
			uuid[i] = chars[(i === 19) ? (r & 0x3) | 0x8 : r];
		}
	}

	return uuid.join('');
};

});
require.register('web-storage/cookie', function(require, exports, module) {
'use strict';

/**
 * Returns cookie value by key, or false if not found.
 */
exports.get = function (key) {

	var cookies = document.cookie.split(/;\s*/);
	var encodedKey = encodeURIComponent(key);
	var pair;

	for (var i = 0; i < cookies.length; i++) {
		pair = cookies[i].split('=');

		if (pair[0] === encodedKey) {
			return decodeURIComponent(pair[1]);
		}
	}

	return false;
};

/**
 * Set cookie value by key.
 */
exports.set = function (key, value, expireDate, secure) {

	var cookie = encodeURIComponent(key) + '=' + encodeURIComponent(value);

	if (expireDate) {
		cookie += '; expires=' + expireDate.toUTCString();
	}

	if (secure) {
		cookie += '; secure';
	}

	document.cookie = cookie;
};

/**
 * Remove cookie value by key.
 */
exports.remove = function (key) {

	var expireDate = new Date(Date.now() - 1000);

	document.cookie = encodeURIComponent(key) + '=; expires=' + expireDate.toUTCString();
};

});
require.register('web-storage/dom-storage', function(require, exports, module) {
'use strict';

var _window = window;

function serialize(data) {
	return JSON.stringify(data);
}

function deserialize(data) {
	// Note: using == instead of === since we don't care if it is null or undefined
	if (data == null) {
		return undefined;
	}
	return JSON.parse(data);
}

var api = {
	set: function (key, data) {
		this.storage.setItem(key, serialize(data));
	},
	get: function (key) {
		return deserialize(this.storage.getItem(key));
	},
	remove: function (key) {
		this.storage.removeItem(key);
	},
	clear: function () {
		this.storage.clear();
	},
	supported: function () {
		return !!this.storage;
	}
};

var session = Object.create(api);
session.storage = _window.sessionStorage;

var local = Object.create(api);
local.storage = _window.localStorage;


exports.session = session;
exports.local = local;

});window.cogwheels = require('cogwheels');

