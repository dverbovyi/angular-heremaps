(function e(t,n,r){function s(o,u){if(!n[o]){if(!t[o]){var a=typeof require=="function"&&require;if(!u&&a)return a(o,!0);if(i)return i(o,!0);var f=new Error("Cannot find module '"+o+"'");throw f.code="MODULE_NOT_FOUND",f}var l=n[o]={exports:{}};t[o][0].call(l.exports,function(e){var n=t[o][1][e];return s(n?n:e)},l,l.exports,e,t,n,r)}return n[o].exports}var i=typeof require=="function"&&require;for(var o=0;o<r.length;o++)s(r[o]);return s})({1:[function(require,module,exports){
/**
 * Created by Dmytro on 4/11/2016.
 */
module.exports = function (
    $timeout,
    $window,
    $rootScope,
    $filter,
    HereMapsConfig,
    APIService,
    HereMapUtilsService,
    MarkersService,
    RoutesService,
    CONSTS,
    EventsModule,
    UIModule) {
    return {
        restrict: 'EA',
        template: "<div ng-style=\"{'width': mapWidth, 'height': mapHeight}\"></div>",
        replace: true,
        scope: {
            opts: '&options',
            places: '&',
            onMapReady: "&mapReady",
            events: '&'
        },
        controller: function ($scope, $element, $attrs) {
            var CONTROL_NAMES = CONSTS.CONTROLS.NAMES,
                places = $scope.places(),
                opts = $scope.opts(),
                listeners = $scope.events();

            var options = angular.extend({}, CONSTS.DEFAULT_MAP_OPTIONS, opts),
                position = HereMapUtilsService.isValidCoords(options.coords) ? options.coords : CONSTS.DEFAULT_MAP_OPTIONS.coords;

            var heremaps = {id: HereMapUtilsService.generateId()},
                mapReady = $scope.onMapReady(),
                _onResizeMap = null;

            $timeout(function () {
                return _setMapSize();
            }).then(function () {
                APIService.loadApi().then(_apiReady);
            });

            options.resize && addOnResizeListener();

            $scope.$on('$destroy', function () {
                $window.removeEventListener('resize', _onResizeMap);
            });

            function addOnResizeListener() {
                _onResizeMap = HereMapUtilsService.throttle(_resizeHandler, CONSTS.UPDATE_MAP_RESIZE_TIMEOUT);
                $window.addEventListener('resize', _onResizeMap);
            }

            function _apiReady() {
                _setupMapPlatform();
                _setupMap();
            }

            function _setupMapPlatform() {
                if (!HereMapsConfig.app_id || !HereMapsConfig.app_code)
                    throw new Error('app_id or app_code were missed. Please specify their in HereMapsConfig');

                heremaps.platform = new H.service.Platform(HereMapsConfig);
                heremaps.layers = heremaps.platform.createDefaultLayers();
            }

            function _getLocation(enableHighAccuracy, maximumAge) {
                var _enableHighAccuracy = !!enableHighAccuracy,
                    _maximumAge = maximumAge || 0;

                return APIService.getPosition({
                    enableHighAccuracy: _enableHighAccuracy,
                    maximumAge: _maximumAge
                });
            }

            function _locationFailure() {
                console.error('Can not get a geo position');
            }

            function _setupMap() {
                _initMap(function () {
                    APIService.loadModules($attrs.$attr, {
                        "controls": _uiModuleReady,
                        "events": _eventsModuleReady
                    });
                });
            }

            function _initMap(cb) {
                var map = heremaps.map = new H.Map($element[0], heremaps.layers.normal.map, {
                    zoom: HereMapUtilsService.isValidCoords(position) ? options.zoom : options.maxZoom,
                    center: new H.geo.Point(position.latitude, position.longitude)
                });
                
                MarkersService.addMarkersToMap(map, places);

                mapReady && mapReady(MapProxy());

                cb && cb();
            }

            function _uiModuleReady() {
                UIModule.start({
                    platform: heremaps,
                    alignment: $attrs.controls
                });
            }

            function _eventsModuleReady() {
                EventsModule.start({
                    platform: heremaps,
                    listeners: listeners,
                    options: options,
                    injector: _moduleInjector
                });
            }

            function _moduleInjector() {
                return function (id) {
                    return heremaps[id];
                }
            }

            function _resizeHandler() {
                _setMapSize();

                heremaps.map.getViewPort().resize();
            }

            function _setMapSize() {
                var height = $element[0].parentNode.offsetHeight || options.height,
                    width = $element[0].parentNode.offsetWidth || options.width;

                $scope.mapHeight = height + 'px';
                $scope.mapWidth = width + 'px';

                HereMapUtilsService.runScopeDigestIfNeed($scope);
            }

            //TODO: move to separate file
            function MapProxy() {
                return {
                    getPlatform: function () {
                        return heremaps;
                    },
                    calculateRoute: function (driveType, direction) {
                        return RoutesService.calculateRoute(heremaps, {
                            driveType: driveType,
                            direction: direction
                        });
                    },
                    addRouteToMap: function (routeData, clean) {
                        RoutesService.addRouteToMap(heremaps.map, routeData, clean);
                    },
                    setZoom: function (zoom, step) {
                        HereMapUtilsService.zoom(heremaps.map, zoom || 10, step);
                    },
                    setCenter: function (coords) {
                        if (!coords) {
                            return console.error('coords are not specified!');
                        }

                        heremaps.map.setCenter(coords);
                    },
                    cleanRoutes: function(){
                        RoutesService.cleanRoutes(heremaps.map);
                    },

                    /**
                     * @param {Boolean} enableHighAccuracy
                     * @param {Number} maximumAge - the maximum age in milliseconds of a possible cached position that is acceptable to return. If set to 0, it means that the device cannot use a cached position and must attempt to retrieve the real current position
                     * @return {Promise}
                     */
                    getUserLocation: function (enableHighAccuracy, maximumAge) {
                        return _getLocation.apply(null, arguments).then(function(position){
                            var coords = position.coords;
                            
                            MarkersService.addUserMarker(heremaps.map, {
                                pos: {
                                    lat: coords.latitude,
                                    lng: coords.longitude
                                }
                            });
                            
                            return coords;
                        })
                    },
                    
                    geocodePosition: function (coords, options) {
                        return APIService.geocodePosition(heremaps.platform, {
                            coords: coords,
                            radius: options && options.radius,
                            lang: options && options.lang
                        });
                    },
                    updateMarkers: function (places) {
                        MarkersService.updateMarkers(heremaps.map, places);
                    }
                }
            }

        }
    }
};

},{}],2:[function(require,module,exports){
require('./providers/markers');
require('./providers/map-modules');
require('./providers/routes');

var directive = require('./heremaps.directive'),
    configProvider = require('./providers/mapconfig.provider'),
    apiService = require('./providers/api.service'),
    utilsService = require('./providers/maputils.service'),
    consts = require('./providers/consts');

var heremaps = angular.module('heremaps', [
    'markers-module',
    'routes-module',
    'map-modules'
]);

heremaps
    .provider('HereMapsConfig', configProvider)
    .service('APIService', ['$q', '$http', 'HereMapsConfig', 'HereMapUtilsService', 'CONSTS', apiService])
    .service('HereMapUtilsService', utilsService)
    .constant('CONSTS', consts);

heremaps.directive('heremaps', directive);

module.exports = heremaps;
},{"./heremaps.directive":1,"./providers/api.service":3,"./providers/consts":4,"./providers/map-modules":7,"./providers/mapconfig.provider":9,"./providers/maputils.service":10,"./providers/markers":13,"./providers/routes":17}],3:[function(require,module,exports){
module.exports = function ($q, $http, HereMapsConfig, HereMapUtilsService, CONSTS) {
    var version = HereMapsConfig.apiVersion,
        protocol = HereMapsConfig.useHTTPS ? 'https' : 'http';

    var API_VERSION = {
        V: parseInt(version),
        SUB: version
    };

    var CONFIG = {
        BASE: "://js.api.here.com/v",
        CORE: "mapsjs-core.js",
        SERVICE: "mapsjs-service.js",
        UI: {
            src: "mapsjs-ui.js",
            href: "mapsjs-ui.css"
        },
        EVENTS: "mapsjs-mapevents.js"
    };

    var API_DEFERSQueue = {};

    API_DEFERSQueue[CONFIG.CORE] = [];
    API_DEFERSQueue[CONFIG.SERVICE] = [];
    API_DEFERSQueue[CONFIG.UI.src] = [];
    API_DEFERSQueue[CONFIG.PANO] = [];
    API_DEFERSQueue[CONFIG.EVENTS] = [];

    var head = document.getElementsByTagName('head')[0];

    return {
        loadApi: loadApi,
        loadModules: loadModules,
        getPosition: getPosition,
        geocodePosition: geocodePosition
    };

    //#region PUBLIC
    function loadApi() {
        return _getLoader(CONFIG.CORE)
            .then(function () {
                return _getLoader(CONFIG.SERVICE);
            });
    }

    function loadModules(attrs, handlers) {
        for (var key in handlers) {
            if (!handlers.hasOwnProperty(key) || !attrs[key])
                continue;

            var loader = _getLoaderByAttr(key);

            loader()
                .then(handlers[key]);
        }
    }

    function getPosition(options) {
        var deferred = $q.defer();

        if (options && _isValidCoords(options.coords)) {
            deferred.resolve({ coords: options.coords });
        } else {
            navigator.geolocation.getCurrentPosition(function (response) {
                deferred.resolve(response);
            }, function (error) {
                deferred.reject(error);
            }, options);
        }

        return deferred.promise;
    }

    function geocodePosition(platform, params) {
        if (!params.coords)
            return console.error('Missed required coords');

        var geocoder = platform.getGeocodingService(),
            deferred = $q.defer(),
            _params = {
                prox: [params.coords.lat, params.coords.lng, params.radius || 250].join(','),
                mode: 'retrieveAddresses',
                maxresults: '1',
                gen: '8',
                language: params.lang || 'en-gb'
            };

        geocoder.reverseGeocode(_params, function (response) {
            deferred.resolve(response)
        }, function (error) {
            deferred.reject(error)
        });
        
        return deferred.promise;
    }

    //#endregion PUBLIC

    function _getLoaderByAttr(attr) {
        var loader;

        switch (attr) {
            case CONSTS.MODULES.UI:
                loader = _loadUIModule;
                break;
            case CONSTS.MODULES.EVENTS:
                loader = _loadEventsModule;
                break;
            default:
                throw new Error('Unknown module', attr);
        }

        return loader;
    }

    function _loadUIModule() {
        if (!_isLoaded(CONFIG.UI)) {
            var link = HereMapUtilsService.createLinkTag({
                rel: 'stylesheet',
                type: 'text/css',
                href: _getURL(CONFIG.UI.href)
            });

            link && head.appendChild(link);
        }

        return _getLoader(CONFIG.UI.src);
    }

    function _loadEventsModule() {
        return _getLoader(CONFIG.EVENTS);
    }

    /**
     * @param {String} sourceName
     * return {String} e.g http://js.api.here.com/v{VER}/{SUBVERSION}/{SOURCE}
     */
    function _getURL(sourceName) {
        return [
            protocol,
            CONFIG.BASE,
            API_VERSION.V,
            "/",
            API_VERSION.SUB,
            "/",
            sourceName
        ].join("");
    }

    function _getLoader(sourceName) {
        var defer = $q.defer(), src, script;

        if (_isLoaded(sourceName)) {
            defer.resolve();
        } else {
            src = _getURL(sourceName),
                script = HereMapUtilsService.createScriptTag({ src: src });

            script && head.appendChild(script);

            API_DEFERSQueue[sourceName].push(defer);

            script.onload = _onLoad.bind(null, sourceName);
            script.onerror = _onError.bind(null, sourceName);
        }

        return defer.promise;
    }

    function _isLoaded(sourceName) {
        var checker = null;

        switch (sourceName) {
            case CONFIG.CORE:
                checker = _isCoreLoaded;
                break;
            case CONFIG.SERVICE:
                checker = _isServiceLoaded;
                break;
            case CONFIG.UI:
                checker = _isUILoaded;
                break;
            case CONFIG.EVENTS:
                checker = _isEventsLoaded;
                break;
            default:
                checker = function () { return false };
        }

        return checker();
    }

    function _isCoreLoaded() {
        return !!window.H;
    }

    function _isServiceLoaded() {
        return !!(window.H && window.H.service);
    }

    function _isUILoaded() {
        return !!(window.H && window.H.ui);
    }

    function _isEventsLoaded() {
        return !!(window.H && window.H.mapevents);
    }

    function _onLoad(sourceName) {
        var deferQueue = API_DEFERSQueue[sourceName];
        for (var i = 0, l = deferQueue.length; i < l; ++i) {
            var defer = deferQueue[i];
            defer.resolve();
        }

        API_DEFERSQueue[sourceName] = [];
    }

    function _onError(sourceName) {
        var deferQueue = API_DEFERSQueue[sourceName];
        for (var i = 0, l = deferQueue.length; i < l; ++i) {
            var defer = deferQueue[i];
            defer.reject();
        }

        API_DEFERSQueue[sourceName] = [];
    }

    function _isValidCoords(coords) {
        var lng = coords && coords.longitude,
            lat = coords && coords.latitude;

        return (typeof lng === 'number' || typeof lng === 'string') &&
            (typeof lat === 'number' || typeof lat === 'string');
    }
};
},{}],4:[function(require,module,exports){
module.exports = {
    UPDATE_MAP_RESIZE_TIMEOUT: 500,
    ANIMATION_ZOOM_STEP: .05,
    MODULES: {
        UI: 'controls',
        EVENTS: 'events',
        PANO: 'pano'
    },
    DEFAULT_MAP_OPTIONS: {
        height: 480,
        width: 640,
        zoom: 12,
        maxZoom: 2,
        resize: false,
        draggable: false,
        coords: {
            longitude: 0,
            latitude: 0
        }
    },
    MARKER_TYPES: {
        DOM: "DOM",
        SVG: "SVG"
    },
    CONTROLS: {
        NAMES: {
            SCALE: 'scalebar',
            SETTINGS: 'mapsettings',
            ZOOM: 'zoom',
            USER: 'userposition'
        },
        POSITIONS: [
            'top-right',
            'top-center',
            'top-left',
            'left-top',
            'left-middle',
            'left-bottom',
            'right-top',
            'right-middle',
            'right-bottom',
            'bottom-right',
            'bottom-center',
            'bottom-left'
        ]
    },
    INFOBUBBLE: {
        STATE: {
            OPEN: 'open',
            CLOSED: 'closed'
        },
        DISPLAY_EVENT: {
            pointermove: 'onHover',
            tap: 'onClick'
        }
    },
    USER_EVENTS: {
        tap: 'click',
        pointermove: 'mousemove',
        pointerleave: 'mouseleave',
        pointerenter: 'mouseenter',
        drag: 'drag',
        dragstart: 'dragstart',
        dragend: 'dragend'
    }
}
},{}],5:[function(require,module,exports){
module.exports = function(HereMapUtilsService, MarkersService, CONSTS, InfoBubbleFactory) {
    function Events(platform, Injector, listeners) {
        this.map = platform.map;
        this.listeners = listeners;
        this.inject = new Injector();
        this.events = platform.events = new H.mapevents.MapEvents(this.map);
        this.behavior = platform.behavior = new H.mapevents.Behavior(this.events);
        this.bubble = InfoBubbleFactory.create();

        this.setupEventListeners();
    }

    var proto = Events.prototype;

    proto.setupEventListeners = setupEventListeners;
    proto.setupOptions = setupOptions;
    proto.triggerUserListener = triggerUserListener;
    proto.infoBubbleHandler = infoBubbleHandler;  

    return {
        start: function(args) {
            if (!(args.platform.map instanceof H.Map))
                return console.error('Missed required map instance');

            var events = new Events(args.platform, args.injector, args.listeners);

            args.options && events.setupOptions(args.options);
        }
    }

    function setupEventListeners() {
        var self = this;

        HereMapUtilsService.addEventListener(this.map, 'tap', this.infoBubbleHandler.bind(this));

        HereMapUtilsService.addEventListener(this.map, 'pointermove', this.infoBubbleHandler.bind(this));

        HereMapUtilsService.addEventListener(this.map, 'dragstart', function(e) {
            if (MarkersService.isMarkerInstance(e.target)) {
                self.behavior.disable();
            }

            self.triggerUserListener(CONSTS.USER_EVENTS[e.type], e);
        });

        HereMapUtilsService.addEventListener(this.map, 'drag', function(e) {
            var pointer = e.currentPointer,
                target = e.target;

            if (MarkersService.isMarkerInstance(target)) {
                target.setPosition(self.map.screenToGeo(pointer.viewportX, pointer.viewportY));
            }

            self.triggerUserListener(CONSTS.USER_EVENTS[e.type], e);
        });

        HereMapUtilsService.addEventListener(this.map, 'dragend', function(e) {
            if (MarkersService.isMarkerInstance(e.target)) {
                self.behavior.enable();
            }

            self.triggerUserListener(CONSTS.USER_EVENTS[e.type], e);
        });
    }

    function setupOptions(options) {
        if (!options)
            return;

        this.map.draggable = !!options.draggable;
    }

    function triggerUserListener(eventName, e) {
        if (!this.listeners)
            return;

        var callback = this.listeners[eventName];

        callback && callback(e);
    }
    
    function infoBubbleHandler(e){
        var ui = this.inject('ui');
        
        if(ui)
            this.bubble.toggle(e, ui);
            
        this.triggerUserListener(CONSTS.USER_EVENTS[e.type], e);      
    }

};
},{}],6:[function(require,module,exports){
module.exports = function(MarkersService, HereMapUtilsService, CONSTS) {
    function InfoBubble() {}

    var proto = InfoBubble.prototype;
        
    proto.create = create;
    proto.update = update;
    proto.toggle = toggle;
    proto.show = show;
    proto.close = close;

    return {
        create: function(){
            return new InfoBubble();
        }
    }

    function toggle(e, ui) {
        if (MarkersService.isMarkerInstance(e.target))
            this.show(e, ui);
        else
            this.close(e, ui);
    }

    function update(bubble, data) {
        bubble.display = data.display;

        bubble.setPosition(data.position);
        bubble.setContent(data.markup);

        bubble.setState(CONSTS.INFOBUBBLE.STATE.OPEN);
    }

    function create(source) {
        var bubble = new H.ui.InfoBubble(source.position, {
            content: source.markup
        });

        bubble.display = source.display;
        bubble.addClass(CONSTS.INFOBUBBLE.STATE.OPEN)

        HereMapUtilsService.addEventListener(bubble, 'statechange', function(e) {
            var state = this.getState(),
                el = this.getElement();
            if (state === CONSTS.INFOBUBBLE.STATE.CLOSED) {
                el.classList.remove(CONSTS.INFOBUBBLE.STATE.OPEN);
            } else
                this.addClass(state)
        });

        return bubble;
    }

    function show(e, ui, data) {
        var target = e.target,
            data = target.getData(),
            el = null;

        if (!data || !data.display || !data.markup || data.display !== CONSTS.INFOBUBBLE.DISPLAY_EVENT[e.type])
            return;

        var source = {
            position: target.getPosition(),
            markup: data.markup,
            display: data.display
        };

        if (!ui.bubble) {
            ui.bubble = this.create(source);
            ui.addBubble(ui.bubble);

            return;
        }

        this.update(ui.bubble, source);
    }

    function close(e, ui) {
        if (!ui.bubble || ui.bubble.display !== CONSTS.INFOBUBBLE.DISPLAY_EVENT[e.type]) {
            return;
        }

        ui.bubble.setState(CONSTS.INFOBUBBLE.STATE.CLOSED);
    }
}
},{}],7:[function(require,module,exports){
var eventsModule = require('./events/events.js'),
    infoBubble = require('./events/infobubble.js');
    
var uiModule = require('./ui/ui.js');

angular.module('events-module', [])
    .factory('EventsModule', eventsModule)
    .factory('InfoBubbleFactory', infoBubble);
    
angular.module('ui-module', [])
    .factory('UIModule', uiModule)

var app = angular.module('map-modules', [
	'events-module',
    'ui-module'
]);

module.exports = app;
},{"./events/events.js":5,"./events/infobubble.js":6,"./ui/ui.js":8}],8:[function(require,module,exports){
module.exports = function(APIService, MarkersService, HereMapUtilsService, CONSTS) {
    function UI(platform, alignment) {
        this.map = platform.map;
        this.layers = platform.layers;
        this.alignment = alignment;
        this.ui = platform.ui = H.ui.UI.createDefault(this.map, this.layers);

        this.setupControls();
    }

    UI.isValidAlignment = isValidAlignment;

    var proto = UI.prototype;

    proto.setupControls = setupControls;
    proto.createUserControl = createUserControl;
    proto.setControlsAlignment = setControlsAlignment;

    return {
        start: function(args) {
            if (!(args.platform.map instanceof H.Map) && !(args.platform.layers))
                return console.error('Missed ui module dependencies');

            var ui = new UI(args.platform, args.alignment);
        }
    }

    function setupControls() {
        var NAMES = CONSTS.CONTROLS.NAMES,
            userControl = this.createUserControl();

        this.ui.getControl(NAMES.SETTINGS).setIncidentsLayer(false);
        this.ui.addControl(NAMES.USER, userControl);
        this.setControlsAlignment(NAMES);
    }

    function createUserControl() {
        var self = this,
            userControl = new H.ui.Control(),
            markup = '<svg class="H_icon" fill="#fff" xmlns="http://www.w3.org/2000/svg" width="16" height="16" viewBox="0 0 16 16"><path class="middle_location_stroke" d="M8 12c-2.206 0-4-1.795-4-4 0-2.206 1.794-4 4-4s4 1.794 4 4c0 2.205-1.794 4-4 4M8 1.25a6.75 6.75 0 1 0 0 13.5 6.75 6.75 0 0 0 0-13.5"></path><path class="inner_location_stroke" d="M8 5a3 3 0 1 1 .001 6A3 3 0 0 1 8 5m0-1C5.794 4 4 5.794 4 8c0 2.205 1.794 4 4 4s4-1.795 4-4c0-2.206-1.794-4-4-4"></path><path class="outer_location_stroke" d="M8 1.25a6.75 6.75 0 1 1 0 13.5 6.75 6.75 0 0 1 0-13.5M8 0C3.59 0 0 3.59 0 8c0 4.411 3.59 8 8 8s8-3.589 8-8c0-4.41-3.59-8-8-8"></path></svg>';

        var userControlButton = new H.ui.base.Button({
            label: markup,
            onStateChange: function(evt) {
                if (userControlButton.getState() === H.ui.base.Button.State.DOWN)
                    return;

                APIService.getPosition().then(function(response) {
                    var position = {
                        lng: response.coords.longitude,
                        lat: response.coords.latitude
                    };
                    
                    self.map.setCenter(position);
                    
                    HereMapUtilsService.zoom(self.map, 17, .08);

                    if (self.userMarker) {
                        self.userMarker.setPosition(position);
                        return;
                    }
                    
                    self.userMarker = MarkersService.addUserMarker(self.map, {
                        pos: position
                    });
                });
            }
        });

        userControl.addChild(userControlButton);

        return userControl;
    }

    function setControlsAlignment(NAMES) {
        if (!UI.isValidAlignment(this.alignment))
            return;

        for (var id in NAMES) {
            var control = this.ui.getControl(NAMES[id]);

            if (!NAMES.hasOwnProperty(id) || !control)
                continue;

            control.setAlignment(this.alignment);
        }
    }

    function isValidAlignment(alignment) {
        return !!(CONSTS.CONTROLS.POSITIONS.indexOf(alignment) + 1);
    }

};
},{}],9:[function(require,module,exports){
module.exports = function() {
    var options = {};
    var DEFAULT_API_VERSION = "3.0";

    this.$get = function(){
        return {
            app_id: options.app_id,
            app_code: options.app_code,
            apiVersion: options.apiVersion || DEFAULT_API_VERSION,
            useHTTPS: options.useHTTPS
        }
    };

    this.setOptions = function(opts){
        options = opts;
    };
};
},{}],10:[function(require,module,exports){
module.exports = function ($rootScope, $timeout, CONSTS) {
    return {
        throttle: throttle,
        createScriptTag: createScriptTag,
        createLinkTag: createLinkTag,
        runScopeDigestIfNeed: runScopeDigestIfNeed,
        isValidCoords: isValidCoords,
        addEventListener: addEventListener,
        zoom: zoom,
        generateId: generateId
    };

    //#region PUBLIC
    function throttle(fn, period) {
        var timeout = null;

        return function () {
            if ($timeout)
                $timeout.cancel(timeout);

            timeout = $timeout(fn, period);
        }
    }

    function addEventListener(obj, eventName, listener, useCapture) {
        var _useCapture = !!useCapture;

        obj.addEventListener(eventName, listener, _useCapture);
    }

    function runScopeDigestIfNeed(scope, cb) {
        if (scope.$root && scope.$root.$$phase !== '$apply' && scope.$root.$$phase !== '$digest') {
            scope.$digest(cb || angular.noop);
            return true;
        }
        return false;
    }

    function createScriptTag(attrs) {
        var script = document.getElementById(attrs.src);

        if (script)
            return false;

        script = document.createElement('script');
        script.type = 'text/javascript';
        script.id = attrs.src;
        _setAttrs(script, attrs);

        return script;
    }

    function createLinkTag(attrs) {
        var link = document.getElementById(attrs.href);

        if (link)
            return false;

        link = document.createElement('link');
        link.id = attrs.href;
        _setAttrs(link, attrs);

        return link;
    }

    function isValidCoords(coords) {
        return coords &&
            (typeof coords.latitude === 'string' || typeof coords.latitude === 'number') &&
            (typeof coords.longitude === 'string' || typeof coords.longitude === 'number')
    }

    function zoom(map, value, step) {
        var currentZoom = map.getZoom(),
            _step = step || CONSTS.ANIMATION_ZOOM_STEP,
            factor = currentZoom >= value ? -1 : 1,
            increment = step * factor;

        return (function zoom() {
            if (!step || Math.floor(currentZoom) === Math.floor(value)) {
                map.setZoom(value);
                return;
            }

            currentZoom += increment;
            map.setZoom(currentZoom);

            requestAnimationFrame(zoom);
        })();
    }

    function generateId() {
        var mask = 'xxxxxxxx-xxxx-4xxx-yxxx-xxxxxxxxxxxx',
            regexp = /[xy]/g,
            d = new Date().getTime(),
            uuid = mask.replace(regexp, function (c) {
                var r = (d + Math.random() * 16) % 16 | 0;
                d = Math.floor(d / 16);
            return (c == 'x' ? r : (r & 0x3 | 0x8)).toString(16);
        });
        
        return uuid;
    }

    //#endregion PUBLIC 

    function _setAttrs(el, attrs) {
        if (!el || !attrs)
            throw new Error('Missed attributes');

        for (var key in attrs) {
            if (!attrs.hasOwnProperty(key))
                continue;

            el[key] = attrs[key];
        }
    }
};
},{}],11:[function(require,module,exports){
module.exports = function(MarkerInterface){
    function DefaultMarker(place){
        this.place = place;
        this.setCoords();
    }

    var proto = DefaultMarker.prototype = new MarkerInterface();
    proto.constructor = DefaultMarker;

    proto.create = create;

    return DefaultMarker;
    
    function create(){
        var marker = new H.map.Marker(this.coords);
        
        this.addInfoBubble(marker);
        
        return marker;
    }
}
},{}],12:[function(require,module,exports){
module.exports = function(MarkerInterface){
    function DOMMarker(place){
        this.place = place;
        this.setCoords();
    }

    var proto = DOMMarker.prototype = new MarkerInterface();
    proto.constructor = DOMMarker;

    proto.create = create;
    proto.getIcon = getIcon;
    proto.setupEvents = setupEvents;

    return DOMMarker;
    
    function create(){
        var marker = new H.map.DomMarker(this.coords, {
            icon: this.getIcon()
        });
        
        this.addInfoBubble(marker);
        
        return marker;
    }
    
    function getIcon(){
        var icon = this.place.markup;
         if(!icon)
            throw new Error('markup missed');

        return new H.map.DomIcon(icon);
    }
    
    function setupEvents(el, events, remove){
        var method = remove ? 'removeEventListener' : 'addEventListener';

        for(var key in events) {
            if(!events.hasOwnProperty(key))
                continue;

            el[method].call(null, key, events[key]);
        }
    }
}
},{}],13:[function(require,module,exports){
var markerInterface = require('./marker.js'),
	defaultMarker = require('./default.marker.js'),
	domMarker = require('./dom.marker.js'),
	svgMarker = require('./svg.marker.js'),
    markersService = require('./markers.service.js');

angular.module('marker-interface', []).factory('MarkerInterface', markerInterface);
angular.module('default-marker', []).factory('DefaultMarker', defaultMarker);
angular.module('dom-marker', []).factory('DOMMarker', domMarker);
angular.module('svg-marker', []).factory('SVGMarker', svgMarker);

angular.module('markers-service', []).service('MarkersService', markersService);

var app = angular.module('markers-module', [
	'marker-interface',
    'default-marker',
    'dom-marker',
    'markers-service',
    'svg-marker'
]);

module.exports = app;
},{"./default.marker.js":11,"./dom.marker.js":12,"./marker.js":14,"./markers.service.js":15,"./svg.marker.js":16}],14:[function(require,module,exports){
module.exports = function(){
    function MarkerInterface(){
        throw new Error('Abstract class! The Instance should be created');
    }
    
    var proto = MarkerInterface.prototype;
    
    proto.create = create;
    proto.setCoords = setCoords;
    proto.addInfoBubble = addInfoBubble;
    
    function Marker(){}
    
    Marker.prototype = proto;
    
    return Marker;
    
    function create(){
        throw new Error('create:: not implemented'); 
    }
    
    function setCoords(){
         this.coords = {
            lat: this.place.pos.lat,
            lng: this.place.pos.lng
        }
    }
    
    function addInfoBubble(marker){
        if(!this.place.popup)
            return;
            
        marker.setData(this.place.popup)
    }
}
},{}],15:[function(require,module,exports){
module.exports = function(DefaultMarker, DOMMarker, SVGMarker, CONSTS) {

    var MARKER_TYPES = CONSTS.MARKER_TYPES;

    return {
        addMarkersToMap: addMarkersToMap,
        addUserMarker: addUserMarker,
        updateMarkers: updateMarkers,
        isMarkerInstance: isMarkerInstance
    }

    function isMarkerInstance(target) {
        return target instanceof H.map.Marker || target instanceof H.map.DomMarker;
    }

    function addUserMarker(map, place) {
        if(map.userMarker)
            return map.userMarker;
        
        place.markup = '<svg width="35px" height="35px" viewBox="0 0 90 90" version="1.1" xmlns="http://www.w3.org/2000/svg" xmlns:xlink="http://www.w3.org/1999/xlink">' +
            '<defs><circle id="path-1" cx="302" cy="802" r="15"></circle>' +
            '<mask id="mask-2" maskContentUnits="userSpaceOnUse" maskUnits="objectBoundingBox" x="-30" y="-30" width="90" height="90">' +
            '<rect x="257" y="757" width="90" height="90" fill="white"></rect><use xlink:href="#path-1" fill="black"></use>' +
            '</mask></defs><g id="Page-1" stroke="none" stroke-width="1" fill="none" fill-rule="evenodd">' +
            '<g id="Service-Options---directions---map" transform="translate(-257.000000, -757.000000)"><g id="Oval-15">' +
            '<use fill="#FFFFFF" fill-rule="evenodd" xlink:href="#path-1"></use>' +
            '<use stroke-opacity="0.29613904" stroke="#3F34A0" mask="url(#mask-2)" stroke-width="60" xlink:href="#path-1"></use>' +
            '<use stroke="#3F34A0" stroke-width="5" xlink:href="#path-1"></use></g></g></g></svg>';

        map.userMarker = new SVGMarker(place).create();

        map.addObject(map.userMarker);

        return map.userMarker;
    }

    function addMarkersToMap(map, places) {
        if (!places || !places.length)
            return false;

        if (!(map instanceof H.Map))
            throw new Error('Unsupported map instance');

        if (!map.markersGroup)
            map.markersGroup = new H.map.Group();

        places.forEach(function(place, i) {
            var creator = _getMarkerCreator(place),
                marker = place.draggable ? _draggableMarkerMixin(creator.create()) : creator.create();

            map.markersGroup.addObject(marker);
        });

        map.addObject(map.markersGroup);
        
        map.setViewBounds(map.markersGroup.getBounds());
    }

    function updateMarkers(map, places) {
        if (map.markersGroup) {
            map.markersGroup.removeAll();
            map.removeObject(map.markersGroup);
            map.markersGroup = null;
        }

        addMarkersToMap.apply(null, arguments);
    }

    function _getMarkerCreator(place) {
        var ConcreteMarker,
            type = place.type ? place.type.toUpperCase() : null;

        switch (type) {
            case MARKER_TYPES.DOM:
                ConcreteMarker = DOMMarker;
                break;
            case MARKER_TYPES.SVG:
                ConcreteMarker = SVGMarker;
                break;
            default:
                ConcreteMarker = DefaultMarker;
        }

        return new ConcreteMarker(place);
    }

    function _draggableMarkerMixin(marker) {
        marker.draggable = true;

        return marker;
    }

};
},{}],16:[function(require,module,exports){
module.exports = function(MarkerInterface){
    function SVGMarker(place){
        this.place = place;
        this.setCoords();
    }
    
    var proto = SVGMarker.prototype = new MarkerInterface();
    proto.constructor = SVGMarker;
    
    proto.create = create;
    proto.getIcon = getIcon;
    
    return SVGMarker;
    
    function create(){
        var marker = new H.map.Marker(this.coords, {
            icon: this.getIcon(),
        });
        
        this.addInfoBubble(marker);
        
        return marker;
    }
    
    function getIcon(){
        var icon = this.place.markup;
         if(!icon)
            throw new Error('markup missed');

        return new H.map.Icon(icon);
    }
}
},{}],17:[function(require,module,exports){
var routesService = require('./routes.service.js');

angular.module('routes-service', []).service('RoutesService', routesService);

var app = angular.module('routes-module', [
    'routes-service'
]);

module.exports = app;
},{"./routes.service.js":18}],18:[function(require,module,exports){
module.exports = function ($q) {
    return {
        calculateRoute: calculateRoute,
        addRouteToMap: addRouteToMap,
        cleanRoutes: cleanRoutes
    }

    function calculateRoute(heremaps, config) {
        var platform = heremaps.platform,
            map = heremaps.map,
            router = platform.getRoutingService(),
            dir = config.direction;

        var mode = '{{MODE}};{{VECHILE}}'
            .replace(/{{MODE}}/, dir.mode)
            .replace(/{{VECHILE}}/, config.driveType);

        var routeRequestParams = {
            mode: mode,
            representation: dir.representation || 'display',
            waypoint0: [dir.from.lat, dir.from.lng].join(','),
            waypoint1: [dir.to.lat, dir.to.lng].join(','),
            language: dir.language || 'en-gb'
        };

        _setAttributes(routeRequestParams, dir.attrs);

        var deferred = $q.defer();

        router.calculateRoute(routeRequestParams, function (result) {
            deferred.resolve(result);
        }, function (error) {
            deferred.reject(error);
        });

        return deferred.promise;
    }
    
    function cleanRoutes(map){
        var group = map.routesGroup;
         
        if(!group)
            return;
            
        group.removeAll();
        map.removeObject(group);
        map.routesGroup = null;
    }
    
    function addRouteToMap(map, routeData, clean) {
        if(clean)
           cleanRoutes(map);
           
        var route = routeData.route;
        
        if (!map || !route || !route.shape)
            return;

        var strip = new H.geo.Strip(), polyline = null;

        route.shape.forEach(function (point) {
            var parts = point.split(',');
            strip.pushLatLngAlt(parts[0], parts[1]);
        });
        
        var style = routeData.style;

        polyline = new H.map.Polyline(strip, {
            style: {
                lineWidth: style.lineWidth || 4,
                strokeColor: style. color || 'rgba(0, 128, 255, 0.7)'
            }
        });
        
        var group = map.routesGroup;
         
        if(!group) {
            group = map.routesGroup = new H.map.Group();
            map.addObject(group);
        }
        
        group.addObject(polyline);
        
        map.setViewBounds(polyline.getBounds(), true);
    }

    //#region PRIVATE

    function _setAttributes(params, attrs) {
        var _key = 'attributes';
        for (var key in attrs) {
            if (!attrs.hasOwnProperty(key))
                continue;

            params[key + _key] = attrs[key];
        }
    }

    function _onRouteSuccess(result) {
        console.log(result)
    }

    function _onRouteFailure(error) {
        console.log('Calculate route failure', error);
    }

    /**
     * Creates a series of H.map.Marker points from the route and adds them to the map.
     * @param {Object} route  A route as received from the H.service.RoutingService
     */
    function addManueversToMap(map, route) {
        var svgMarkup = '<svg width="18" height="18" ' +
            'xmlns="http://www.w3.org/2000/svg">' +
            '<circle cx="8" cy="8" r="8" ' +
            'fill="#1b468d" stroke="white" stroke-width="1"  />' +
            '</svg>',
            dotIcon = new H.map.Icon(svgMarkup, { anchor: { x: 8, y: 8 } }),
            group = new H.map.Group(),
            i,
            j;

        // Add a marker for each maneuver
        for (i = 0; i < route.leg.length; i += 1) {
            for (j = 0; j < route.leg[i].maneuver.length; j += 1) {
                // Get the next maneuver.
                maneuver = route.leg[i].maneuver[j];
                // Add a marker to the maneuvers group
                var marker = new H.map.Marker({
                    lat: maneuver.position.latitude,
                    lng: maneuver.position.longitude
                },
                    { icon: dotIcon }
                );

                marker.instruction = maneuver.instruction;
                group.addObject(marker);
            }
        }

        group.addEventListener('tap', function (evt) {
            map.setCenter(evt.target.getPosition());
            openBubble(evt.target.getPosition(), evt.target.instruction);
        }, false);

        // Add the maneuvers group to the map
        map.addObject(group);
    }


    /**
     * Creates a series of H.map.Marker points from the route and adds them to the map.
     * @param {Object} route  A route as received from the H.service.RoutingService
     */
    function addWaypointsToPanel(waypoints) {
        var nodeH3 = document.createElement('h3'),
            waypointLabels = [],
            i;

        for (i = 0; i < waypoints.length; i += 1) {
            waypointLabels.push(waypoints[i].label)
        }

        nodeH3.textContent = waypointLabels.join(' - ');

        routeInstructionsContainer.innerHTML = '';
        routeInstructionsContainer.appendChild(nodeH3);
    }

    /**
     * Creates a series of H.map.Marker points from the route and adds them to the map.
     * @param {Object} route  A route as received from the H.service.RoutingService
     */
    function addSummaryToPanel(summary) {
        var summaryDiv = document.createElement('div'),
            content = '';

        content += '<b>Total distance</b>: ' + summary.distance + 'm. <br/>';
        content += '<b>Travel Time</b>: ' + summary.travelTime.toMMSS() + ' (in current traffic)';


        summaryDiv.style.fontSize = 'small';
        summaryDiv.style.marginLeft = '5%';
        summaryDiv.style.marginRight = '5%';
        summaryDiv.innerHTML = content;
        routeInstructionsContainer.appendChild(summaryDiv);
    }

    /**
     * Creates a series of H.map.Marker points from the route and adds them to the map.
     * @param {Object} route  A route as received from the H.service.RoutingService
     */
    function addManueversToPanel(route) {
        var nodeOL = document.createElement('ol'), i, j;

        nodeOL.style.fontSize = 'small';
        nodeOL.style.marginLeft = '5%';
        nodeOL.style.marginRight = '5%';
        nodeOL.className = 'directions';

        // Add a marker for each maneuver
        for (i = 0; i < route.leg.length; i += 1) {
            for (j = 0; j < route.leg[i].maneuver.length; j += 1) {
                // Get the next maneuver.
                maneuver = route.leg[i].maneuver[j];

                var li = document.createElement('li'),
                    spanArrow = document.createElement('span'),
                    spanInstruction = document.createElement('span');

                spanArrow.className = 'arrow ' + maneuver.action;
                spanInstruction.innerHTML = maneuver.instruction;
                li.appendChild(spanArrow);
                li.appendChild(spanInstruction);

                nodeOL.appendChild(li);
            }
        }

        routeInstructionsContainer.appendChild(nodeOL);
    }

};
},{}]},{},[2])
//# sourceMappingURL=data:application/json;charset=utf-8;base64,eyJ2ZXJzaW9uIjozLCJzb3VyY2VzIjpbIm5vZGVfbW9kdWxlcy9icm93c2VyLXBhY2svX3ByZWx1ZGUuanMiLCJzcmMvaGVyZW1hcHMuZGlyZWN0aXZlLmpzIiwic3JjL2luZGV4LmpzIiwic3JjL3Byb3ZpZGVycy9hcGkuc2VydmljZS5qcyIsInNyYy9wcm92aWRlcnMvY29uc3RzLmpzIiwic3JjL3Byb3ZpZGVycy9tYXAtbW9kdWxlcy9ldmVudHMvZXZlbnRzLmpzIiwic3JjL3Byb3ZpZGVycy9tYXAtbW9kdWxlcy9ldmVudHMvaW5mb2J1YmJsZS5qcyIsInNyYy9wcm92aWRlcnMvbWFwLW1vZHVsZXMvaW5kZXguanMiLCJzcmMvcHJvdmlkZXJzL21hcC1tb2R1bGVzL3VpL3VpLmpzIiwic3JjL3Byb3ZpZGVycy9tYXBjb25maWcucHJvdmlkZXIuanMiLCJzcmMvcHJvdmlkZXJzL21hcHV0aWxzLnNlcnZpY2UuanMiLCJzcmMvcHJvdmlkZXJzL21hcmtlcnMvZGVmYXVsdC5tYXJrZXIuanMiLCJzcmMvcHJvdmlkZXJzL21hcmtlcnMvZG9tLm1hcmtlci5qcyIsInNyYy9wcm92aWRlcnMvbWFya2Vycy9pbmRleC5qcyIsInNyYy9wcm92aWRlcnMvbWFya2Vycy9tYXJrZXIuanMiLCJzcmMvcHJvdmlkZXJzL21hcmtlcnMvbWFya2Vycy5zZXJ2aWNlLmpzIiwic3JjL3Byb3ZpZGVycy9tYXJrZXJzL3N2Zy5tYXJrZXIuanMiLCJzcmMvcHJvdmlkZXJzL3JvdXRlcy9pbmRleC5qcyIsInNyYy9wcm92aWRlcnMvcm91dGVzL3JvdXRlcy5zZXJ2aWNlLmpzIl0sIm5hbWVzIjpbXSwibWFwcGluZ3MiOiJBQUFBO0FDQUE7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTs7QUNoTkE7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7O0FDeEJBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7O0FDM09BO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTs7QUNqRUE7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7O0FDMUZBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBOztBQ3BGQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7O0FDakJBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTs7QUM1RkE7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTs7QUNoQkE7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBOztBQ3BIQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7O0FDcEJBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7O0FDM0NBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBOztBQ3JCQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBOztBQ2xDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7O0FDNUZBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7O0FDL0JBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTs7QUNSQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0EiLCJmaWxlIjoiZ2VuZXJhdGVkLmpzIiwic291cmNlUm9vdCI6IiIsInNvdXJjZXNDb250ZW50IjpbIihmdW5jdGlvbiBlKHQsbixyKXtmdW5jdGlvbiBzKG8sdSl7aWYoIW5bb10pe2lmKCF0W29dKXt2YXIgYT10eXBlb2YgcmVxdWlyZT09XCJmdW5jdGlvblwiJiZyZXF1aXJlO2lmKCF1JiZhKXJldHVybiBhKG8sITApO2lmKGkpcmV0dXJuIGkobywhMCk7dmFyIGY9bmV3IEVycm9yKFwiQ2Fubm90IGZpbmQgbW9kdWxlICdcIitvK1wiJ1wiKTt0aHJvdyBmLmNvZGU9XCJNT0RVTEVfTk9UX0ZPVU5EXCIsZn12YXIgbD1uW29dPXtleHBvcnRzOnt9fTt0W29dWzBdLmNhbGwobC5leHBvcnRzLGZ1bmN0aW9uKGUpe3ZhciBuPXRbb11bMV1bZV07cmV0dXJuIHMobj9uOmUpfSxsLGwuZXhwb3J0cyxlLHQsbixyKX1yZXR1cm4gbltvXS5leHBvcnRzfXZhciBpPXR5cGVvZiByZXF1aXJlPT1cImZ1bmN0aW9uXCImJnJlcXVpcmU7Zm9yKHZhciBvPTA7bzxyLmxlbmd0aDtvKyspcyhyW29dKTtyZXR1cm4gc30pIiwiLyoqXHJcbiAqIENyZWF0ZWQgYnkgRG15dHJvIG9uIDQvMTEvMjAxNi5cclxuICovXHJcbm1vZHVsZS5leHBvcnRzID0gZnVuY3Rpb24gKFxyXG4gICAgJHRpbWVvdXQsXHJcbiAgICAkd2luZG93LFxyXG4gICAgJHJvb3RTY29wZSxcclxuICAgICRmaWx0ZXIsXHJcbiAgICBIZXJlTWFwc0NvbmZpZyxcclxuICAgIEFQSVNlcnZpY2UsXHJcbiAgICBIZXJlTWFwVXRpbHNTZXJ2aWNlLFxyXG4gICAgTWFya2Vyc1NlcnZpY2UsXHJcbiAgICBSb3V0ZXNTZXJ2aWNlLFxyXG4gICAgQ09OU1RTLFxyXG4gICAgRXZlbnRzTW9kdWxlLFxyXG4gICAgVUlNb2R1bGUpIHtcclxuICAgIHJldHVybiB7XHJcbiAgICAgICAgcmVzdHJpY3Q6ICdFQScsXHJcbiAgICAgICAgdGVtcGxhdGU6IFwiPGRpdiBuZy1zdHlsZT1cXFwieyd3aWR0aCc6IG1hcFdpZHRoLCAnaGVpZ2h0JzogbWFwSGVpZ2h0fVxcXCI+PC9kaXY+XCIsXHJcbiAgICAgICAgcmVwbGFjZTogdHJ1ZSxcclxuICAgICAgICBzY29wZToge1xyXG4gICAgICAgICAgICBvcHRzOiAnJm9wdGlvbnMnLFxyXG4gICAgICAgICAgICBwbGFjZXM6ICcmJyxcclxuICAgICAgICAgICAgb25NYXBSZWFkeTogXCImbWFwUmVhZHlcIixcclxuICAgICAgICAgICAgZXZlbnRzOiAnJidcclxuICAgICAgICB9LFxyXG4gICAgICAgIGNvbnRyb2xsZXI6IGZ1bmN0aW9uICgkc2NvcGUsICRlbGVtZW50LCAkYXR0cnMpIHtcclxuICAgICAgICAgICAgdmFyIENPTlRST0xfTkFNRVMgPSBDT05TVFMuQ09OVFJPTFMuTkFNRVMsXHJcbiAgICAgICAgICAgICAgICBwbGFjZXMgPSAkc2NvcGUucGxhY2VzKCksXHJcbiAgICAgICAgICAgICAgICBvcHRzID0gJHNjb3BlLm9wdHMoKSxcclxuICAgICAgICAgICAgICAgIGxpc3RlbmVycyA9ICRzY29wZS5ldmVudHMoKTtcclxuXHJcbiAgICAgICAgICAgIHZhciBvcHRpb25zID0gYW5ndWxhci5leHRlbmQoe30sIENPTlNUUy5ERUZBVUxUX01BUF9PUFRJT05TLCBvcHRzKSxcclxuICAgICAgICAgICAgICAgIHBvc2l0aW9uID0gSGVyZU1hcFV0aWxzU2VydmljZS5pc1ZhbGlkQ29vcmRzKG9wdGlvbnMuY29vcmRzKSA/IG9wdGlvbnMuY29vcmRzIDogQ09OU1RTLkRFRkFVTFRfTUFQX09QVElPTlMuY29vcmRzO1xyXG5cclxuICAgICAgICAgICAgdmFyIGhlcmVtYXBzID0ge2lkOiBIZXJlTWFwVXRpbHNTZXJ2aWNlLmdlbmVyYXRlSWQoKX0sXHJcbiAgICAgICAgICAgICAgICBtYXBSZWFkeSA9ICRzY29wZS5vbk1hcFJlYWR5KCksXHJcbiAgICAgICAgICAgICAgICBfb25SZXNpemVNYXAgPSBudWxsO1xyXG5cclxuICAgICAgICAgICAgJHRpbWVvdXQoZnVuY3Rpb24gKCkge1xyXG4gICAgICAgICAgICAgICAgcmV0dXJuIF9zZXRNYXBTaXplKCk7XHJcbiAgICAgICAgICAgIH0pLnRoZW4oZnVuY3Rpb24gKCkge1xyXG4gICAgICAgICAgICAgICAgQVBJU2VydmljZS5sb2FkQXBpKCkudGhlbihfYXBpUmVhZHkpO1xyXG4gICAgICAgICAgICB9KTtcclxuXHJcbiAgICAgICAgICAgIG9wdGlvbnMucmVzaXplICYmIGFkZE9uUmVzaXplTGlzdGVuZXIoKTtcclxuXHJcbiAgICAgICAgICAgICRzY29wZS4kb24oJyRkZXN0cm95JywgZnVuY3Rpb24gKCkge1xyXG4gICAgICAgICAgICAgICAgJHdpbmRvdy5yZW1vdmVFdmVudExpc3RlbmVyKCdyZXNpemUnLCBfb25SZXNpemVNYXApO1xyXG4gICAgICAgICAgICB9KTtcclxuXHJcbiAgICAgICAgICAgIGZ1bmN0aW9uIGFkZE9uUmVzaXplTGlzdGVuZXIoKSB7XHJcbiAgICAgICAgICAgICAgICBfb25SZXNpemVNYXAgPSBIZXJlTWFwVXRpbHNTZXJ2aWNlLnRocm90dGxlKF9yZXNpemVIYW5kbGVyLCBDT05TVFMuVVBEQVRFX01BUF9SRVNJWkVfVElNRU9VVCk7XHJcbiAgICAgICAgICAgICAgICAkd2luZG93LmFkZEV2ZW50TGlzdGVuZXIoJ3Jlc2l6ZScsIF9vblJlc2l6ZU1hcCk7XHJcbiAgICAgICAgICAgIH1cclxuXHJcbiAgICAgICAgICAgIGZ1bmN0aW9uIF9hcGlSZWFkeSgpIHtcclxuICAgICAgICAgICAgICAgIF9zZXR1cE1hcFBsYXRmb3JtKCk7XHJcbiAgICAgICAgICAgICAgICBfc2V0dXBNYXAoKTtcclxuICAgICAgICAgICAgfVxyXG5cclxuICAgICAgICAgICAgZnVuY3Rpb24gX3NldHVwTWFwUGxhdGZvcm0oKSB7XHJcbiAgICAgICAgICAgICAgICBpZiAoIUhlcmVNYXBzQ29uZmlnLmFwcF9pZCB8fCAhSGVyZU1hcHNDb25maWcuYXBwX2NvZGUpXHJcbiAgICAgICAgICAgICAgICAgICAgdGhyb3cgbmV3IEVycm9yKCdhcHBfaWQgb3IgYXBwX2NvZGUgd2VyZSBtaXNzZWQuIFBsZWFzZSBzcGVjaWZ5IHRoZWlyIGluIEhlcmVNYXBzQ29uZmlnJyk7XHJcblxyXG4gICAgICAgICAgICAgICAgaGVyZW1hcHMucGxhdGZvcm0gPSBuZXcgSC5zZXJ2aWNlLlBsYXRmb3JtKEhlcmVNYXBzQ29uZmlnKTtcclxuICAgICAgICAgICAgICAgIGhlcmVtYXBzLmxheWVycyA9IGhlcmVtYXBzLnBsYXRmb3JtLmNyZWF0ZURlZmF1bHRMYXllcnMoKTtcclxuICAgICAgICAgICAgfVxyXG5cclxuICAgICAgICAgICAgZnVuY3Rpb24gX2dldExvY2F0aW9uKGVuYWJsZUhpZ2hBY2N1cmFjeSwgbWF4aW11bUFnZSkge1xyXG4gICAgICAgICAgICAgICAgdmFyIF9lbmFibGVIaWdoQWNjdXJhY3kgPSAhIWVuYWJsZUhpZ2hBY2N1cmFjeSxcclxuICAgICAgICAgICAgICAgICAgICBfbWF4aW11bUFnZSA9IG1heGltdW1BZ2UgfHwgMDtcclxuXHJcbiAgICAgICAgICAgICAgICByZXR1cm4gQVBJU2VydmljZS5nZXRQb3NpdGlvbih7XHJcbiAgICAgICAgICAgICAgICAgICAgZW5hYmxlSGlnaEFjY3VyYWN5OiBfZW5hYmxlSGlnaEFjY3VyYWN5LFxyXG4gICAgICAgICAgICAgICAgICAgIG1heGltdW1BZ2U6IF9tYXhpbXVtQWdlXHJcbiAgICAgICAgICAgICAgICB9KTtcclxuICAgICAgICAgICAgfVxyXG5cclxuICAgICAgICAgICAgZnVuY3Rpb24gX2xvY2F0aW9uRmFpbHVyZSgpIHtcclxuICAgICAgICAgICAgICAgIGNvbnNvbGUuZXJyb3IoJ0NhbiBub3QgZ2V0IGEgZ2VvIHBvc2l0aW9uJyk7XHJcbiAgICAgICAgICAgIH1cclxuXHJcbiAgICAgICAgICAgIGZ1bmN0aW9uIF9zZXR1cE1hcCgpIHtcclxuICAgICAgICAgICAgICAgIF9pbml0TWFwKGZ1bmN0aW9uICgpIHtcclxuICAgICAgICAgICAgICAgICAgICBBUElTZXJ2aWNlLmxvYWRNb2R1bGVzKCRhdHRycy4kYXR0ciwge1xyXG4gICAgICAgICAgICAgICAgICAgICAgICBcImNvbnRyb2xzXCI6IF91aU1vZHVsZVJlYWR5LFxyXG4gICAgICAgICAgICAgICAgICAgICAgICBcImV2ZW50c1wiOiBfZXZlbnRzTW9kdWxlUmVhZHlcclxuICAgICAgICAgICAgICAgICAgICB9KTtcclxuICAgICAgICAgICAgICAgIH0pO1xyXG4gICAgICAgICAgICB9XHJcblxyXG4gICAgICAgICAgICBmdW5jdGlvbiBfaW5pdE1hcChjYikge1xyXG4gICAgICAgICAgICAgICAgdmFyIG1hcCA9IGhlcmVtYXBzLm1hcCA9IG5ldyBILk1hcCgkZWxlbWVudFswXSwgaGVyZW1hcHMubGF5ZXJzLm5vcm1hbC5tYXAsIHtcclxuICAgICAgICAgICAgICAgICAgICB6b29tOiBIZXJlTWFwVXRpbHNTZXJ2aWNlLmlzVmFsaWRDb29yZHMocG9zaXRpb24pID8gb3B0aW9ucy56b29tIDogb3B0aW9ucy5tYXhab29tLFxyXG4gICAgICAgICAgICAgICAgICAgIGNlbnRlcjogbmV3IEguZ2VvLlBvaW50KHBvc2l0aW9uLmxhdGl0dWRlLCBwb3NpdGlvbi5sb25naXR1ZGUpXHJcbiAgICAgICAgICAgICAgICB9KTtcclxuICAgICAgICAgICAgICAgIFxyXG4gICAgICAgICAgICAgICAgTWFya2Vyc1NlcnZpY2UuYWRkTWFya2Vyc1RvTWFwKG1hcCwgcGxhY2VzKTtcclxuXHJcbiAgICAgICAgICAgICAgICBtYXBSZWFkeSAmJiBtYXBSZWFkeShNYXBQcm94eSgpKTtcclxuXHJcbiAgICAgICAgICAgICAgICBjYiAmJiBjYigpO1xyXG4gICAgICAgICAgICB9XHJcblxyXG4gICAgICAgICAgICBmdW5jdGlvbiBfdWlNb2R1bGVSZWFkeSgpIHtcclxuICAgICAgICAgICAgICAgIFVJTW9kdWxlLnN0YXJ0KHtcclxuICAgICAgICAgICAgICAgICAgICBwbGF0Zm9ybTogaGVyZW1hcHMsXHJcbiAgICAgICAgICAgICAgICAgICAgYWxpZ25tZW50OiAkYXR0cnMuY29udHJvbHNcclxuICAgICAgICAgICAgICAgIH0pO1xyXG4gICAgICAgICAgICB9XHJcblxyXG4gICAgICAgICAgICBmdW5jdGlvbiBfZXZlbnRzTW9kdWxlUmVhZHkoKSB7XHJcbiAgICAgICAgICAgICAgICBFdmVudHNNb2R1bGUuc3RhcnQoe1xyXG4gICAgICAgICAgICAgICAgICAgIHBsYXRmb3JtOiBoZXJlbWFwcyxcclxuICAgICAgICAgICAgICAgICAgICBsaXN0ZW5lcnM6IGxpc3RlbmVycyxcclxuICAgICAgICAgICAgICAgICAgICBvcHRpb25zOiBvcHRpb25zLFxyXG4gICAgICAgICAgICAgICAgICAgIGluamVjdG9yOiBfbW9kdWxlSW5qZWN0b3JcclxuICAgICAgICAgICAgICAgIH0pO1xyXG4gICAgICAgICAgICB9XHJcblxyXG4gICAgICAgICAgICBmdW5jdGlvbiBfbW9kdWxlSW5qZWN0b3IoKSB7XHJcbiAgICAgICAgICAgICAgICByZXR1cm4gZnVuY3Rpb24gKGlkKSB7XHJcbiAgICAgICAgICAgICAgICAgICAgcmV0dXJuIGhlcmVtYXBzW2lkXTtcclxuICAgICAgICAgICAgICAgIH1cclxuICAgICAgICAgICAgfVxyXG5cclxuICAgICAgICAgICAgZnVuY3Rpb24gX3Jlc2l6ZUhhbmRsZXIoKSB7XHJcbiAgICAgICAgICAgICAgICBfc2V0TWFwU2l6ZSgpO1xyXG5cclxuICAgICAgICAgICAgICAgIGhlcmVtYXBzLm1hcC5nZXRWaWV3UG9ydCgpLnJlc2l6ZSgpO1xyXG4gICAgICAgICAgICB9XHJcblxyXG4gICAgICAgICAgICBmdW5jdGlvbiBfc2V0TWFwU2l6ZSgpIHtcclxuICAgICAgICAgICAgICAgIHZhciBoZWlnaHQgPSAkZWxlbWVudFswXS5wYXJlbnROb2RlLm9mZnNldEhlaWdodCB8fCBvcHRpb25zLmhlaWdodCxcclxuICAgICAgICAgICAgICAgICAgICB3aWR0aCA9ICRlbGVtZW50WzBdLnBhcmVudE5vZGUub2Zmc2V0V2lkdGggfHwgb3B0aW9ucy53aWR0aDtcclxuXHJcbiAgICAgICAgICAgICAgICAkc2NvcGUubWFwSGVpZ2h0ID0gaGVpZ2h0ICsgJ3B4JztcclxuICAgICAgICAgICAgICAgICRzY29wZS5tYXBXaWR0aCA9IHdpZHRoICsgJ3B4JztcclxuXHJcbiAgICAgICAgICAgICAgICBIZXJlTWFwVXRpbHNTZXJ2aWNlLnJ1blNjb3BlRGlnZXN0SWZOZWVkKCRzY29wZSk7XHJcbiAgICAgICAgICAgIH1cclxuXHJcbiAgICAgICAgICAgIC8vVE9ETzogbW92ZSB0byBzZXBhcmF0ZSBmaWxlXHJcbiAgICAgICAgICAgIGZ1bmN0aW9uIE1hcFByb3h5KCkge1xyXG4gICAgICAgICAgICAgICAgcmV0dXJuIHtcclxuICAgICAgICAgICAgICAgICAgICBnZXRQbGF0Zm9ybTogZnVuY3Rpb24gKCkge1xyXG4gICAgICAgICAgICAgICAgICAgICAgICByZXR1cm4gaGVyZW1hcHM7XHJcbiAgICAgICAgICAgICAgICAgICAgfSxcclxuICAgICAgICAgICAgICAgICAgICBjYWxjdWxhdGVSb3V0ZTogZnVuY3Rpb24gKGRyaXZlVHlwZSwgZGlyZWN0aW9uKSB7XHJcbiAgICAgICAgICAgICAgICAgICAgICAgIHJldHVybiBSb3V0ZXNTZXJ2aWNlLmNhbGN1bGF0ZVJvdXRlKGhlcmVtYXBzLCB7XHJcbiAgICAgICAgICAgICAgICAgICAgICAgICAgICBkcml2ZVR5cGU6IGRyaXZlVHlwZSxcclxuICAgICAgICAgICAgICAgICAgICAgICAgICAgIGRpcmVjdGlvbjogZGlyZWN0aW9uXHJcbiAgICAgICAgICAgICAgICAgICAgICAgIH0pO1xyXG4gICAgICAgICAgICAgICAgICAgIH0sXHJcbiAgICAgICAgICAgICAgICAgICAgYWRkUm91dGVUb01hcDogZnVuY3Rpb24gKHJvdXRlRGF0YSwgY2xlYW4pIHtcclxuICAgICAgICAgICAgICAgICAgICAgICAgUm91dGVzU2VydmljZS5hZGRSb3V0ZVRvTWFwKGhlcmVtYXBzLm1hcCwgcm91dGVEYXRhLCBjbGVhbik7XHJcbiAgICAgICAgICAgICAgICAgICAgfSxcclxuICAgICAgICAgICAgICAgICAgICBzZXRab29tOiBmdW5jdGlvbiAoem9vbSwgc3RlcCkge1xyXG4gICAgICAgICAgICAgICAgICAgICAgICBIZXJlTWFwVXRpbHNTZXJ2aWNlLnpvb20oaGVyZW1hcHMubWFwLCB6b29tIHx8IDEwLCBzdGVwKTtcclxuICAgICAgICAgICAgICAgICAgICB9LFxyXG4gICAgICAgICAgICAgICAgICAgIHNldENlbnRlcjogZnVuY3Rpb24gKGNvb3Jkcykge1xyXG4gICAgICAgICAgICAgICAgICAgICAgICBpZiAoIWNvb3Jkcykge1xyXG4gICAgICAgICAgICAgICAgICAgICAgICAgICAgcmV0dXJuIGNvbnNvbGUuZXJyb3IoJ2Nvb3JkcyBhcmUgbm90IHNwZWNpZmllZCEnKTtcclxuICAgICAgICAgICAgICAgICAgICAgICAgfVxyXG5cclxuICAgICAgICAgICAgICAgICAgICAgICAgaGVyZW1hcHMubWFwLnNldENlbnRlcihjb29yZHMpO1xyXG4gICAgICAgICAgICAgICAgICAgIH0sXHJcbiAgICAgICAgICAgICAgICAgICAgY2xlYW5Sb3V0ZXM6IGZ1bmN0aW9uKCl7XHJcbiAgICAgICAgICAgICAgICAgICAgICAgIFJvdXRlc1NlcnZpY2UuY2xlYW5Sb3V0ZXMoaGVyZW1hcHMubWFwKTtcclxuICAgICAgICAgICAgICAgICAgICB9LFxyXG5cclxuICAgICAgICAgICAgICAgICAgICAvKipcclxuICAgICAgICAgICAgICAgICAgICAgKiBAcGFyYW0ge0Jvb2xlYW59IGVuYWJsZUhpZ2hBY2N1cmFjeVxyXG4gICAgICAgICAgICAgICAgICAgICAqIEBwYXJhbSB7TnVtYmVyfSBtYXhpbXVtQWdlIC0gdGhlIG1heGltdW0gYWdlIGluIG1pbGxpc2Vjb25kcyBvZiBhIHBvc3NpYmxlIGNhY2hlZCBwb3NpdGlvbiB0aGF0IGlzIGFjY2VwdGFibGUgdG8gcmV0dXJuLiBJZiBzZXQgdG8gMCwgaXQgbWVhbnMgdGhhdCB0aGUgZGV2aWNlIGNhbm5vdCB1c2UgYSBjYWNoZWQgcG9zaXRpb24gYW5kIG11c3QgYXR0ZW1wdCB0byByZXRyaWV2ZSB0aGUgcmVhbCBjdXJyZW50IHBvc2l0aW9uXHJcbiAgICAgICAgICAgICAgICAgICAgICogQHJldHVybiB7UHJvbWlzZX1cclxuICAgICAgICAgICAgICAgICAgICAgKi9cclxuICAgICAgICAgICAgICAgICAgICBnZXRVc2VyTG9jYXRpb246IGZ1bmN0aW9uIChlbmFibGVIaWdoQWNjdXJhY3ksIG1heGltdW1BZ2UpIHtcclxuICAgICAgICAgICAgICAgICAgICAgICAgcmV0dXJuIF9nZXRMb2NhdGlvbi5hcHBseShudWxsLCBhcmd1bWVudHMpLnRoZW4oZnVuY3Rpb24ocG9zaXRpb24pe1xyXG4gICAgICAgICAgICAgICAgICAgICAgICAgICAgdmFyIGNvb3JkcyA9IHBvc2l0aW9uLmNvb3JkcztcclxuICAgICAgICAgICAgICAgICAgICAgICAgICAgIFxyXG4gICAgICAgICAgICAgICAgICAgICAgICAgICAgTWFya2Vyc1NlcnZpY2UuYWRkVXNlck1hcmtlcihoZXJlbWFwcy5tYXAsIHtcclxuICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICBwb3M6IHtcclxuICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgbGF0OiBjb29yZHMubGF0aXR1ZGUsXHJcbiAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgIGxuZzogY29vcmRzLmxvbmdpdHVkZVxyXG4gICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgIH1cclxuICAgICAgICAgICAgICAgICAgICAgICAgICAgIH0pO1xyXG4gICAgICAgICAgICAgICAgICAgICAgICAgICAgXHJcbiAgICAgICAgICAgICAgICAgICAgICAgICAgICByZXR1cm4gY29vcmRzO1xyXG4gICAgICAgICAgICAgICAgICAgICAgICB9KVxyXG4gICAgICAgICAgICAgICAgICAgIH0sXHJcbiAgICAgICAgICAgICAgICAgICAgXHJcbiAgICAgICAgICAgICAgICAgICAgZ2VvY29kZVBvc2l0aW9uOiBmdW5jdGlvbiAoY29vcmRzLCBvcHRpb25zKSB7XHJcbiAgICAgICAgICAgICAgICAgICAgICAgIHJldHVybiBBUElTZXJ2aWNlLmdlb2NvZGVQb3NpdGlvbihoZXJlbWFwcy5wbGF0Zm9ybSwge1xyXG4gICAgICAgICAgICAgICAgICAgICAgICAgICAgY29vcmRzOiBjb29yZHMsXHJcbiAgICAgICAgICAgICAgICAgICAgICAgICAgICByYWRpdXM6IG9wdGlvbnMgJiYgb3B0aW9ucy5yYWRpdXMsXHJcbiAgICAgICAgICAgICAgICAgICAgICAgICAgICBsYW5nOiBvcHRpb25zICYmIG9wdGlvbnMubGFuZ1xyXG4gICAgICAgICAgICAgICAgICAgICAgICB9KTtcclxuICAgICAgICAgICAgICAgICAgICB9LFxyXG4gICAgICAgICAgICAgICAgICAgIHVwZGF0ZU1hcmtlcnM6IGZ1bmN0aW9uIChwbGFjZXMpIHtcclxuICAgICAgICAgICAgICAgICAgICAgICAgTWFya2Vyc1NlcnZpY2UudXBkYXRlTWFya2VycyhoZXJlbWFwcy5tYXAsIHBsYWNlcyk7XHJcbiAgICAgICAgICAgICAgICAgICAgfVxyXG4gICAgICAgICAgICAgICAgfVxyXG4gICAgICAgICAgICB9XHJcblxyXG4gICAgICAgIH1cclxuICAgIH1cclxufTtcclxuIiwicmVxdWlyZSgnLi9wcm92aWRlcnMvbWFya2VycycpO1xyXG5yZXF1aXJlKCcuL3Byb3ZpZGVycy9tYXAtbW9kdWxlcycpO1xyXG5yZXF1aXJlKCcuL3Byb3ZpZGVycy9yb3V0ZXMnKTtcclxuXHJcbnZhciBkaXJlY3RpdmUgPSByZXF1aXJlKCcuL2hlcmVtYXBzLmRpcmVjdGl2ZScpLFxyXG4gICAgY29uZmlnUHJvdmlkZXIgPSByZXF1aXJlKCcuL3Byb3ZpZGVycy9tYXBjb25maWcucHJvdmlkZXInKSxcclxuICAgIGFwaVNlcnZpY2UgPSByZXF1aXJlKCcuL3Byb3ZpZGVycy9hcGkuc2VydmljZScpLFxyXG4gICAgdXRpbHNTZXJ2aWNlID0gcmVxdWlyZSgnLi9wcm92aWRlcnMvbWFwdXRpbHMuc2VydmljZScpLFxyXG4gICAgY29uc3RzID0gcmVxdWlyZSgnLi9wcm92aWRlcnMvY29uc3RzJyk7XHJcblxyXG52YXIgaGVyZW1hcHMgPSBhbmd1bGFyLm1vZHVsZSgnaGVyZW1hcHMnLCBbXHJcbiAgICAnbWFya2Vycy1tb2R1bGUnLFxyXG4gICAgJ3JvdXRlcy1tb2R1bGUnLFxyXG4gICAgJ21hcC1tb2R1bGVzJ1xyXG5dKTtcclxuXHJcbmhlcmVtYXBzXHJcbiAgICAucHJvdmlkZXIoJ0hlcmVNYXBzQ29uZmlnJywgY29uZmlnUHJvdmlkZXIpXHJcbiAgICAuc2VydmljZSgnQVBJU2VydmljZScsIFsnJHEnLCAnJGh0dHAnLCAnSGVyZU1hcHNDb25maWcnLCAnSGVyZU1hcFV0aWxzU2VydmljZScsICdDT05TVFMnLCBhcGlTZXJ2aWNlXSlcclxuICAgIC5zZXJ2aWNlKCdIZXJlTWFwVXRpbHNTZXJ2aWNlJywgdXRpbHNTZXJ2aWNlKVxyXG4gICAgLmNvbnN0YW50KCdDT05TVFMnLCBjb25zdHMpO1xyXG5cclxuaGVyZW1hcHMuZGlyZWN0aXZlKCdoZXJlbWFwcycsIGRpcmVjdGl2ZSk7XHJcblxyXG5tb2R1bGUuZXhwb3J0cyA9IGhlcmVtYXBzOyIsIm1vZHVsZS5leHBvcnRzID0gZnVuY3Rpb24gKCRxLCAkaHR0cCwgSGVyZU1hcHNDb25maWcsIEhlcmVNYXBVdGlsc1NlcnZpY2UsIENPTlNUUykge1xyXG4gICAgdmFyIHZlcnNpb24gPSBIZXJlTWFwc0NvbmZpZy5hcGlWZXJzaW9uLFxyXG4gICAgICAgIHByb3RvY29sID0gSGVyZU1hcHNDb25maWcudXNlSFRUUFMgPyAnaHR0cHMnIDogJ2h0dHAnO1xyXG5cclxuICAgIHZhciBBUElfVkVSU0lPTiA9IHtcclxuICAgICAgICBWOiBwYXJzZUludCh2ZXJzaW9uKSxcclxuICAgICAgICBTVUI6IHZlcnNpb25cclxuICAgIH07XHJcblxyXG4gICAgdmFyIENPTkZJRyA9IHtcclxuICAgICAgICBCQVNFOiBcIjovL2pzLmFwaS5oZXJlLmNvbS92XCIsXHJcbiAgICAgICAgQ09SRTogXCJtYXBzanMtY29yZS5qc1wiLFxyXG4gICAgICAgIFNFUlZJQ0U6IFwibWFwc2pzLXNlcnZpY2UuanNcIixcclxuICAgICAgICBVSToge1xyXG4gICAgICAgICAgICBzcmM6IFwibWFwc2pzLXVpLmpzXCIsXHJcbiAgICAgICAgICAgIGhyZWY6IFwibWFwc2pzLXVpLmNzc1wiXHJcbiAgICAgICAgfSxcclxuICAgICAgICBFVkVOVFM6IFwibWFwc2pzLW1hcGV2ZW50cy5qc1wiXHJcbiAgICB9O1xyXG5cclxuICAgIHZhciBBUElfREVGRVJTUXVldWUgPSB7fTtcclxuXHJcbiAgICBBUElfREVGRVJTUXVldWVbQ09ORklHLkNPUkVdID0gW107XHJcbiAgICBBUElfREVGRVJTUXVldWVbQ09ORklHLlNFUlZJQ0VdID0gW107XHJcbiAgICBBUElfREVGRVJTUXVldWVbQ09ORklHLlVJLnNyY10gPSBbXTtcclxuICAgIEFQSV9ERUZFUlNRdWV1ZVtDT05GSUcuUEFOT10gPSBbXTtcclxuICAgIEFQSV9ERUZFUlNRdWV1ZVtDT05GSUcuRVZFTlRTXSA9IFtdO1xyXG5cclxuICAgIHZhciBoZWFkID0gZG9jdW1lbnQuZ2V0RWxlbWVudHNCeVRhZ05hbWUoJ2hlYWQnKVswXTtcclxuXHJcbiAgICByZXR1cm4ge1xyXG4gICAgICAgIGxvYWRBcGk6IGxvYWRBcGksXHJcbiAgICAgICAgbG9hZE1vZHVsZXM6IGxvYWRNb2R1bGVzLFxyXG4gICAgICAgIGdldFBvc2l0aW9uOiBnZXRQb3NpdGlvbixcclxuICAgICAgICBnZW9jb2RlUG9zaXRpb246IGdlb2NvZGVQb3NpdGlvblxyXG4gICAgfTtcclxuXHJcbiAgICAvLyNyZWdpb24gUFVCTElDXHJcbiAgICBmdW5jdGlvbiBsb2FkQXBpKCkge1xyXG4gICAgICAgIHJldHVybiBfZ2V0TG9hZGVyKENPTkZJRy5DT1JFKVxyXG4gICAgICAgICAgICAudGhlbihmdW5jdGlvbiAoKSB7XHJcbiAgICAgICAgICAgICAgICByZXR1cm4gX2dldExvYWRlcihDT05GSUcuU0VSVklDRSk7XHJcbiAgICAgICAgICAgIH0pO1xyXG4gICAgfVxyXG5cclxuICAgIGZ1bmN0aW9uIGxvYWRNb2R1bGVzKGF0dHJzLCBoYW5kbGVycykge1xyXG4gICAgICAgIGZvciAodmFyIGtleSBpbiBoYW5kbGVycykge1xyXG4gICAgICAgICAgICBpZiAoIWhhbmRsZXJzLmhhc093blByb3BlcnR5KGtleSkgfHwgIWF0dHJzW2tleV0pXHJcbiAgICAgICAgICAgICAgICBjb250aW51ZTtcclxuXHJcbiAgICAgICAgICAgIHZhciBsb2FkZXIgPSBfZ2V0TG9hZGVyQnlBdHRyKGtleSk7XHJcblxyXG4gICAgICAgICAgICBsb2FkZXIoKVxyXG4gICAgICAgICAgICAgICAgLnRoZW4oaGFuZGxlcnNba2V5XSk7XHJcbiAgICAgICAgfVxyXG4gICAgfVxyXG5cclxuICAgIGZ1bmN0aW9uIGdldFBvc2l0aW9uKG9wdGlvbnMpIHtcclxuICAgICAgICB2YXIgZGVmZXJyZWQgPSAkcS5kZWZlcigpO1xyXG5cclxuICAgICAgICBpZiAob3B0aW9ucyAmJiBfaXNWYWxpZENvb3JkcyhvcHRpb25zLmNvb3JkcykpIHtcclxuICAgICAgICAgICAgZGVmZXJyZWQucmVzb2x2ZSh7IGNvb3Jkczogb3B0aW9ucy5jb29yZHMgfSk7XHJcbiAgICAgICAgfSBlbHNlIHtcclxuICAgICAgICAgICAgbmF2aWdhdG9yLmdlb2xvY2F0aW9uLmdldEN1cnJlbnRQb3NpdGlvbihmdW5jdGlvbiAocmVzcG9uc2UpIHtcclxuICAgICAgICAgICAgICAgIGRlZmVycmVkLnJlc29sdmUocmVzcG9uc2UpO1xyXG4gICAgICAgICAgICB9LCBmdW5jdGlvbiAoZXJyb3IpIHtcclxuICAgICAgICAgICAgICAgIGRlZmVycmVkLnJlamVjdChlcnJvcik7XHJcbiAgICAgICAgICAgIH0sIG9wdGlvbnMpO1xyXG4gICAgICAgIH1cclxuXHJcbiAgICAgICAgcmV0dXJuIGRlZmVycmVkLnByb21pc2U7XHJcbiAgICB9XHJcblxyXG4gICAgZnVuY3Rpb24gZ2VvY29kZVBvc2l0aW9uKHBsYXRmb3JtLCBwYXJhbXMpIHtcclxuICAgICAgICBpZiAoIXBhcmFtcy5jb29yZHMpXHJcbiAgICAgICAgICAgIHJldHVybiBjb25zb2xlLmVycm9yKCdNaXNzZWQgcmVxdWlyZWQgY29vcmRzJyk7XHJcblxyXG4gICAgICAgIHZhciBnZW9jb2RlciA9IHBsYXRmb3JtLmdldEdlb2NvZGluZ1NlcnZpY2UoKSxcclxuICAgICAgICAgICAgZGVmZXJyZWQgPSAkcS5kZWZlcigpLFxyXG4gICAgICAgICAgICBfcGFyYW1zID0ge1xyXG4gICAgICAgICAgICAgICAgcHJveDogW3BhcmFtcy5jb29yZHMubGF0LCBwYXJhbXMuY29vcmRzLmxuZywgcGFyYW1zLnJhZGl1cyB8fCAyNTBdLmpvaW4oJywnKSxcclxuICAgICAgICAgICAgICAgIG1vZGU6ICdyZXRyaWV2ZUFkZHJlc3NlcycsXHJcbiAgICAgICAgICAgICAgICBtYXhyZXN1bHRzOiAnMScsXHJcbiAgICAgICAgICAgICAgICBnZW46ICc4JyxcclxuICAgICAgICAgICAgICAgIGxhbmd1YWdlOiBwYXJhbXMubGFuZyB8fCAnZW4tZ2InXHJcbiAgICAgICAgICAgIH07XHJcblxyXG4gICAgICAgIGdlb2NvZGVyLnJldmVyc2VHZW9jb2RlKF9wYXJhbXMsIGZ1bmN0aW9uIChyZXNwb25zZSkge1xyXG4gICAgICAgICAgICBkZWZlcnJlZC5yZXNvbHZlKHJlc3BvbnNlKVxyXG4gICAgICAgIH0sIGZ1bmN0aW9uIChlcnJvcikge1xyXG4gICAgICAgICAgICBkZWZlcnJlZC5yZWplY3QoZXJyb3IpXHJcbiAgICAgICAgfSk7XHJcbiAgICAgICAgXHJcbiAgICAgICAgcmV0dXJuIGRlZmVycmVkLnByb21pc2U7XHJcbiAgICB9XHJcblxyXG4gICAgLy8jZW5kcmVnaW9uIFBVQkxJQ1xyXG5cclxuICAgIGZ1bmN0aW9uIF9nZXRMb2FkZXJCeUF0dHIoYXR0cikge1xyXG4gICAgICAgIHZhciBsb2FkZXI7XHJcblxyXG4gICAgICAgIHN3aXRjaCAoYXR0cikge1xyXG4gICAgICAgICAgICBjYXNlIENPTlNUUy5NT0RVTEVTLlVJOlxyXG4gICAgICAgICAgICAgICAgbG9hZGVyID0gX2xvYWRVSU1vZHVsZTtcclxuICAgICAgICAgICAgICAgIGJyZWFrO1xyXG4gICAgICAgICAgICBjYXNlIENPTlNUUy5NT0RVTEVTLkVWRU5UUzpcclxuICAgICAgICAgICAgICAgIGxvYWRlciA9IF9sb2FkRXZlbnRzTW9kdWxlO1xyXG4gICAgICAgICAgICAgICAgYnJlYWs7XHJcbiAgICAgICAgICAgIGRlZmF1bHQ6XHJcbiAgICAgICAgICAgICAgICB0aHJvdyBuZXcgRXJyb3IoJ1Vua25vd24gbW9kdWxlJywgYXR0cik7XHJcbiAgICAgICAgfVxyXG5cclxuICAgICAgICByZXR1cm4gbG9hZGVyO1xyXG4gICAgfVxyXG5cclxuICAgIGZ1bmN0aW9uIF9sb2FkVUlNb2R1bGUoKSB7XHJcbiAgICAgICAgaWYgKCFfaXNMb2FkZWQoQ09ORklHLlVJKSkge1xyXG4gICAgICAgICAgICB2YXIgbGluayA9IEhlcmVNYXBVdGlsc1NlcnZpY2UuY3JlYXRlTGlua1RhZyh7XHJcbiAgICAgICAgICAgICAgICByZWw6ICdzdHlsZXNoZWV0JyxcclxuICAgICAgICAgICAgICAgIHR5cGU6ICd0ZXh0L2NzcycsXHJcbiAgICAgICAgICAgICAgICBocmVmOiBfZ2V0VVJMKENPTkZJRy5VSS5ocmVmKVxyXG4gICAgICAgICAgICB9KTtcclxuXHJcbiAgICAgICAgICAgIGxpbmsgJiYgaGVhZC5hcHBlbmRDaGlsZChsaW5rKTtcclxuICAgICAgICB9XHJcblxyXG4gICAgICAgIHJldHVybiBfZ2V0TG9hZGVyKENPTkZJRy5VSS5zcmMpO1xyXG4gICAgfVxyXG5cclxuICAgIGZ1bmN0aW9uIF9sb2FkRXZlbnRzTW9kdWxlKCkge1xyXG4gICAgICAgIHJldHVybiBfZ2V0TG9hZGVyKENPTkZJRy5FVkVOVFMpO1xyXG4gICAgfVxyXG5cclxuICAgIC8qKlxyXG4gICAgICogQHBhcmFtIHtTdHJpbmd9IHNvdXJjZU5hbWVcclxuICAgICAqIHJldHVybiB7U3RyaW5nfSBlLmcgaHR0cDovL2pzLmFwaS5oZXJlLmNvbS92e1ZFUn0ve1NVQlZFUlNJT059L3tTT1VSQ0V9XHJcbiAgICAgKi9cclxuICAgIGZ1bmN0aW9uIF9nZXRVUkwoc291cmNlTmFtZSkge1xyXG4gICAgICAgIHJldHVybiBbXHJcbiAgICAgICAgICAgIHByb3RvY29sLFxyXG4gICAgICAgICAgICBDT05GSUcuQkFTRSxcclxuICAgICAgICAgICAgQVBJX1ZFUlNJT04uVixcclxuICAgICAgICAgICAgXCIvXCIsXHJcbiAgICAgICAgICAgIEFQSV9WRVJTSU9OLlNVQixcclxuICAgICAgICAgICAgXCIvXCIsXHJcbiAgICAgICAgICAgIHNvdXJjZU5hbWVcclxuICAgICAgICBdLmpvaW4oXCJcIik7XHJcbiAgICB9XHJcblxyXG4gICAgZnVuY3Rpb24gX2dldExvYWRlcihzb3VyY2VOYW1lKSB7XHJcbiAgICAgICAgdmFyIGRlZmVyID0gJHEuZGVmZXIoKSwgc3JjLCBzY3JpcHQ7XHJcblxyXG4gICAgICAgIGlmIChfaXNMb2FkZWQoc291cmNlTmFtZSkpIHtcclxuICAgICAgICAgICAgZGVmZXIucmVzb2x2ZSgpO1xyXG4gICAgICAgIH0gZWxzZSB7XHJcbiAgICAgICAgICAgIHNyYyA9IF9nZXRVUkwoc291cmNlTmFtZSksXHJcbiAgICAgICAgICAgICAgICBzY3JpcHQgPSBIZXJlTWFwVXRpbHNTZXJ2aWNlLmNyZWF0ZVNjcmlwdFRhZyh7IHNyYzogc3JjIH0pO1xyXG5cclxuICAgICAgICAgICAgc2NyaXB0ICYmIGhlYWQuYXBwZW5kQ2hpbGQoc2NyaXB0KTtcclxuXHJcbiAgICAgICAgICAgIEFQSV9ERUZFUlNRdWV1ZVtzb3VyY2VOYW1lXS5wdXNoKGRlZmVyKTtcclxuXHJcbiAgICAgICAgICAgIHNjcmlwdC5vbmxvYWQgPSBfb25Mb2FkLmJpbmQobnVsbCwgc291cmNlTmFtZSk7XHJcbiAgICAgICAgICAgIHNjcmlwdC5vbmVycm9yID0gX29uRXJyb3IuYmluZChudWxsLCBzb3VyY2VOYW1lKTtcclxuICAgICAgICB9XHJcblxyXG4gICAgICAgIHJldHVybiBkZWZlci5wcm9taXNlO1xyXG4gICAgfVxyXG5cclxuICAgIGZ1bmN0aW9uIF9pc0xvYWRlZChzb3VyY2VOYW1lKSB7XHJcbiAgICAgICAgdmFyIGNoZWNrZXIgPSBudWxsO1xyXG5cclxuICAgICAgICBzd2l0Y2ggKHNvdXJjZU5hbWUpIHtcclxuICAgICAgICAgICAgY2FzZSBDT05GSUcuQ09SRTpcclxuICAgICAgICAgICAgICAgIGNoZWNrZXIgPSBfaXNDb3JlTG9hZGVkO1xyXG4gICAgICAgICAgICAgICAgYnJlYWs7XHJcbiAgICAgICAgICAgIGNhc2UgQ09ORklHLlNFUlZJQ0U6XHJcbiAgICAgICAgICAgICAgICBjaGVja2VyID0gX2lzU2VydmljZUxvYWRlZDtcclxuICAgICAgICAgICAgICAgIGJyZWFrO1xyXG4gICAgICAgICAgICBjYXNlIENPTkZJRy5VSTpcclxuICAgICAgICAgICAgICAgIGNoZWNrZXIgPSBfaXNVSUxvYWRlZDtcclxuICAgICAgICAgICAgICAgIGJyZWFrO1xyXG4gICAgICAgICAgICBjYXNlIENPTkZJRy5FVkVOVFM6XHJcbiAgICAgICAgICAgICAgICBjaGVja2VyID0gX2lzRXZlbnRzTG9hZGVkO1xyXG4gICAgICAgICAgICAgICAgYnJlYWs7XHJcbiAgICAgICAgICAgIGRlZmF1bHQ6XHJcbiAgICAgICAgICAgICAgICBjaGVja2VyID0gZnVuY3Rpb24gKCkgeyByZXR1cm4gZmFsc2UgfTtcclxuICAgICAgICB9XHJcblxyXG4gICAgICAgIHJldHVybiBjaGVja2VyKCk7XHJcbiAgICB9XHJcblxyXG4gICAgZnVuY3Rpb24gX2lzQ29yZUxvYWRlZCgpIHtcclxuICAgICAgICByZXR1cm4gISF3aW5kb3cuSDtcclxuICAgIH1cclxuXHJcbiAgICBmdW5jdGlvbiBfaXNTZXJ2aWNlTG9hZGVkKCkge1xyXG4gICAgICAgIHJldHVybiAhISh3aW5kb3cuSCAmJiB3aW5kb3cuSC5zZXJ2aWNlKTtcclxuICAgIH1cclxuXHJcbiAgICBmdW5jdGlvbiBfaXNVSUxvYWRlZCgpIHtcclxuICAgICAgICByZXR1cm4gISEod2luZG93LkggJiYgd2luZG93LkgudWkpO1xyXG4gICAgfVxyXG5cclxuICAgIGZ1bmN0aW9uIF9pc0V2ZW50c0xvYWRlZCgpIHtcclxuICAgICAgICByZXR1cm4gISEod2luZG93LkggJiYgd2luZG93LkgubWFwZXZlbnRzKTtcclxuICAgIH1cclxuXHJcbiAgICBmdW5jdGlvbiBfb25Mb2FkKHNvdXJjZU5hbWUpIHtcclxuICAgICAgICB2YXIgZGVmZXJRdWV1ZSA9IEFQSV9ERUZFUlNRdWV1ZVtzb3VyY2VOYW1lXTtcclxuICAgICAgICBmb3IgKHZhciBpID0gMCwgbCA9IGRlZmVyUXVldWUubGVuZ3RoOyBpIDwgbDsgKytpKSB7XHJcbiAgICAgICAgICAgIHZhciBkZWZlciA9IGRlZmVyUXVldWVbaV07XHJcbiAgICAgICAgICAgIGRlZmVyLnJlc29sdmUoKTtcclxuICAgICAgICB9XHJcblxyXG4gICAgICAgIEFQSV9ERUZFUlNRdWV1ZVtzb3VyY2VOYW1lXSA9IFtdO1xyXG4gICAgfVxyXG5cclxuICAgIGZ1bmN0aW9uIF9vbkVycm9yKHNvdXJjZU5hbWUpIHtcclxuICAgICAgICB2YXIgZGVmZXJRdWV1ZSA9IEFQSV9ERUZFUlNRdWV1ZVtzb3VyY2VOYW1lXTtcclxuICAgICAgICBmb3IgKHZhciBpID0gMCwgbCA9IGRlZmVyUXVldWUubGVuZ3RoOyBpIDwgbDsgKytpKSB7XHJcbiAgICAgICAgICAgIHZhciBkZWZlciA9IGRlZmVyUXVldWVbaV07XHJcbiAgICAgICAgICAgIGRlZmVyLnJlamVjdCgpO1xyXG4gICAgICAgIH1cclxuXHJcbiAgICAgICAgQVBJX0RFRkVSU1F1ZXVlW3NvdXJjZU5hbWVdID0gW107XHJcbiAgICB9XHJcblxyXG4gICAgZnVuY3Rpb24gX2lzVmFsaWRDb29yZHMoY29vcmRzKSB7XHJcbiAgICAgICAgdmFyIGxuZyA9IGNvb3JkcyAmJiBjb29yZHMubG9uZ2l0dWRlLFxyXG4gICAgICAgICAgICBsYXQgPSBjb29yZHMgJiYgY29vcmRzLmxhdGl0dWRlO1xyXG5cclxuICAgICAgICByZXR1cm4gKHR5cGVvZiBsbmcgPT09ICdudW1iZXInIHx8IHR5cGVvZiBsbmcgPT09ICdzdHJpbmcnKSAmJlxyXG4gICAgICAgICAgICAodHlwZW9mIGxhdCA9PT0gJ251bWJlcicgfHwgdHlwZW9mIGxhdCA9PT0gJ3N0cmluZycpO1xyXG4gICAgfVxyXG59OyIsIm1vZHVsZS5leHBvcnRzID0ge1xyXG4gICAgVVBEQVRFX01BUF9SRVNJWkVfVElNRU9VVDogNTAwLFxyXG4gICAgQU5JTUFUSU9OX1pPT01fU1RFUDogLjA1LFxyXG4gICAgTU9EVUxFUzoge1xyXG4gICAgICAgIFVJOiAnY29udHJvbHMnLFxyXG4gICAgICAgIEVWRU5UUzogJ2V2ZW50cycsXHJcbiAgICAgICAgUEFOTzogJ3Bhbm8nXHJcbiAgICB9LFxyXG4gICAgREVGQVVMVF9NQVBfT1BUSU9OUzoge1xyXG4gICAgICAgIGhlaWdodDogNDgwLFxyXG4gICAgICAgIHdpZHRoOiA2NDAsXHJcbiAgICAgICAgem9vbTogMTIsXHJcbiAgICAgICAgbWF4Wm9vbTogMixcclxuICAgICAgICByZXNpemU6IGZhbHNlLFxyXG4gICAgICAgIGRyYWdnYWJsZTogZmFsc2UsXHJcbiAgICAgICAgY29vcmRzOiB7XHJcbiAgICAgICAgICAgIGxvbmdpdHVkZTogMCxcclxuICAgICAgICAgICAgbGF0aXR1ZGU6IDBcclxuICAgICAgICB9XHJcbiAgICB9LFxyXG4gICAgTUFSS0VSX1RZUEVTOiB7XHJcbiAgICAgICAgRE9NOiBcIkRPTVwiLFxyXG4gICAgICAgIFNWRzogXCJTVkdcIlxyXG4gICAgfSxcclxuICAgIENPTlRST0xTOiB7XHJcbiAgICAgICAgTkFNRVM6IHtcclxuICAgICAgICAgICAgU0NBTEU6ICdzY2FsZWJhcicsXHJcbiAgICAgICAgICAgIFNFVFRJTkdTOiAnbWFwc2V0dGluZ3MnLFxyXG4gICAgICAgICAgICBaT09NOiAnem9vbScsXHJcbiAgICAgICAgICAgIFVTRVI6ICd1c2VycG9zaXRpb24nXHJcbiAgICAgICAgfSxcclxuICAgICAgICBQT1NJVElPTlM6IFtcclxuICAgICAgICAgICAgJ3RvcC1yaWdodCcsXHJcbiAgICAgICAgICAgICd0b3AtY2VudGVyJyxcclxuICAgICAgICAgICAgJ3RvcC1sZWZ0JyxcclxuICAgICAgICAgICAgJ2xlZnQtdG9wJyxcclxuICAgICAgICAgICAgJ2xlZnQtbWlkZGxlJyxcclxuICAgICAgICAgICAgJ2xlZnQtYm90dG9tJyxcclxuICAgICAgICAgICAgJ3JpZ2h0LXRvcCcsXHJcbiAgICAgICAgICAgICdyaWdodC1taWRkbGUnLFxyXG4gICAgICAgICAgICAncmlnaHQtYm90dG9tJyxcclxuICAgICAgICAgICAgJ2JvdHRvbS1yaWdodCcsXHJcbiAgICAgICAgICAgICdib3R0b20tY2VudGVyJyxcclxuICAgICAgICAgICAgJ2JvdHRvbS1sZWZ0J1xyXG4gICAgICAgIF1cclxuICAgIH0sXHJcbiAgICBJTkZPQlVCQkxFOiB7XHJcbiAgICAgICAgU1RBVEU6IHtcclxuICAgICAgICAgICAgT1BFTjogJ29wZW4nLFxyXG4gICAgICAgICAgICBDTE9TRUQ6ICdjbG9zZWQnXHJcbiAgICAgICAgfSxcclxuICAgICAgICBESVNQTEFZX0VWRU5UOiB7XHJcbiAgICAgICAgICAgIHBvaW50ZXJtb3ZlOiAnb25Ib3ZlcicsXHJcbiAgICAgICAgICAgIHRhcDogJ29uQ2xpY2snXHJcbiAgICAgICAgfVxyXG4gICAgfSxcclxuICAgIFVTRVJfRVZFTlRTOiB7XHJcbiAgICAgICAgdGFwOiAnY2xpY2snLFxyXG4gICAgICAgIHBvaW50ZXJtb3ZlOiAnbW91c2Vtb3ZlJyxcclxuICAgICAgICBwb2ludGVybGVhdmU6ICdtb3VzZWxlYXZlJyxcclxuICAgICAgICBwb2ludGVyZW50ZXI6ICdtb3VzZWVudGVyJyxcclxuICAgICAgICBkcmFnOiAnZHJhZycsXHJcbiAgICAgICAgZHJhZ3N0YXJ0OiAnZHJhZ3N0YXJ0JyxcclxuICAgICAgICBkcmFnZW5kOiAnZHJhZ2VuZCdcclxuICAgIH1cclxufSIsIm1vZHVsZS5leHBvcnRzID0gZnVuY3Rpb24oSGVyZU1hcFV0aWxzU2VydmljZSwgTWFya2Vyc1NlcnZpY2UsIENPTlNUUywgSW5mb0J1YmJsZUZhY3RvcnkpIHtcclxuICAgIGZ1bmN0aW9uIEV2ZW50cyhwbGF0Zm9ybSwgSW5qZWN0b3IsIGxpc3RlbmVycykge1xyXG4gICAgICAgIHRoaXMubWFwID0gcGxhdGZvcm0ubWFwO1xyXG4gICAgICAgIHRoaXMubGlzdGVuZXJzID0gbGlzdGVuZXJzO1xyXG4gICAgICAgIHRoaXMuaW5qZWN0ID0gbmV3IEluamVjdG9yKCk7XHJcbiAgICAgICAgdGhpcy5ldmVudHMgPSBwbGF0Zm9ybS5ldmVudHMgPSBuZXcgSC5tYXBldmVudHMuTWFwRXZlbnRzKHRoaXMubWFwKTtcclxuICAgICAgICB0aGlzLmJlaGF2aW9yID0gcGxhdGZvcm0uYmVoYXZpb3IgPSBuZXcgSC5tYXBldmVudHMuQmVoYXZpb3IodGhpcy5ldmVudHMpO1xyXG4gICAgICAgIHRoaXMuYnViYmxlID0gSW5mb0J1YmJsZUZhY3RvcnkuY3JlYXRlKCk7XHJcblxyXG4gICAgICAgIHRoaXMuc2V0dXBFdmVudExpc3RlbmVycygpO1xyXG4gICAgfVxyXG5cclxuICAgIHZhciBwcm90byA9IEV2ZW50cy5wcm90b3R5cGU7XHJcblxyXG4gICAgcHJvdG8uc2V0dXBFdmVudExpc3RlbmVycyA9IHNldHVwRXZlbnRMaXN0ZW5lcnM7XHJcbiAgICBwcm90by5zZXR1cE9wdGlvbnMgPSBzZXR1cE9wdGlvbnM7XHJcbiAgICBwcm90by50cmlnZ2VyVXNlckxpc3RlbmVyID0gdHJpZ2dlclVzZXJMaXN0ZW5lcjtcclxuICAgIHByb3RvLmluZm9CdWJibGVIYW5kbGVyID0gaW5mb0J1YmJsZUhhbmRsZXI7ICBcclxuXHJcbiAgICByZXR1cm4ge1xyXG4gICAgICAgIHN0YXJ0OiBmdW5jdGlvbihhcmdzKSB7XHJcbiAgICAgICAgICAgIGlmICghKGFyZ3MucGxhdGZvcm0ubWFwIGluc3RhbmNlb2YgSC5NYXApKVxyXG4gICAgICAgICAgICAgICAgcmV0dXJuIGNvbnNvbGUuZXJyb3IoJ01pc3NlZCByZXF1aXJlZCBtYXAgaW5zdGFuY2UnKTtcclxuXHJcbiAgICAgICAgICAgIHZhciBldmVudHMgPSBuZXcgRXZlbnRzKGFyZ3MucGxhdGZvcm0sIGFyZ3MuaW5qZWN0b3IsIGFyZ3MubGlzdGVuZXJzKTtcclxuXHJcbiAgICAgICAgICAgIGFyZ3Mub3B0aW9ucyAmJiBldmVudHMuc2V0dXBPcHRpb25zKGFyZ3Mub3B0aW9ucyk7XHJcbiAgICAgICAgfVxyXG4gICAgfVxyXG5cclxuICAgIGZ1bmN0aW9uIHNldHVwRXZlbnRMaXN0ZW5lcnMoKSB7XHJcbiAgICAgICAgdmFyIHNlbGYgPSB0aGlzO1xyXG5cclxuICAgICAgICBIZXJlTWFwVXRpbHNTZXJ2aWNlLmFkZEV2ZW50TGlzdGVuZXIodGhpcy5tYXAsICd0YXAnLCB0aGlzLmluZm9CdWJibGVIYW5kbGVyLmJpbmQodGhpcykpO1xyXG5cclxuICAgICAgICBIZXJlTWFwVXRpbHNTZXJ2aWNlLmFkZEV2ZW50TGlzdGVuZXIodGhpcy5tYXAsICdwb2ludGVybW92ZScsIHRoaXMuaW5mb0J1YmJsZUhhbmRsZXIuYmluZCh0aGlzKSk7XHJcblxyXG4gICAgICAgIEhlcmVNYXBVdGlsc1NlcnZpY2UuYWRkRXZlbnRMaXN0ZW5lcih0aGlzLm1hcCwgJ2RyYWdzdGFydCcsIGZ1bmN0aW9uKGUpIHtcclxuICAgICAgICAgICAgaWYgKE1hcmtlcnNTZXJ2aWNlLmlzTWFya2VySW5zdGFuY2UoZS50YXJnZXQpKSB7XHJcbiAgICAgICAgICAgICAgICBzZWxmLmJlaGF2aW9yLmRpc2FibGUoKTtcclxuICAgICAgICAgICAgfVxyXG5cclxuICAgICAgICAgICAgc2VsZi50cmlnZ2VyVXNlckxpc3RlbmVyKENPTlNUUy5VU0VSX0VWRU5UU1tlLnR5cGVdLCBlKTtcclxuICAgICAgICB9KTtcclxuXHJcbiAgICAgICAgSGVyZU1hcFV0aWxzU2VydmljZS5hZGRFdmVudExpc3RlbmVyKHRoaXMubWFwLCAnZHJhZycsIGZ1bmN0aW9uKGUpIHtcclxuICAgICAgICAgICAgdmFyIHBvaW50ZXIgPSBlLmN1cnJlbnRQb2ludGVyLFxyXG4gICAgICAgICAgICAgICAgdGFyZ2V0ID0gZS50YXJnZXQ7XHJcblxyXG4gICAgICAgICAgICBpZiAoTWFya2Vyc1NlcnZpY2UuaXNNYXJrZXJJbnN0YW5jZSh0YXJnZXQpKSB7XHJcbiAgICAgICAgICAgICAgICB0YXJnZXQuc2V0UG9zaXRpb24oc2VsZi5tYXAuc2NyZWVuVG9HZW8ocG9pbnRlci52aWV3cG9ydFgsIHBvaW50ZXIudmlld3BvcnRZKSk7XHJcbiAgICAgICAgICAgIH1cclxuXHJcbiAgICAgICAgICAgIHNlbGYudHJpZ2dlclVzZXJMaXN0ZW5lcihDT05TVFMuVVNFUl9FVkVOVFNbZS50eXBlXSwgZSk7XHJcbiAgICAgICAgfSk7XHJcblxyXG4gICAgICAgIEhlcmVNYXBVdGlsc1NlcnZpY2UuYWRkRXZlbnRMaXN0ZW5lcih0aGlzLm1hcCwgJ2RyYWdlbmQnLCBmdW5jdGlvbihlKSB7XHJcbiAgICAgICAgICAgIGlmIChNYXJrZXJzU2VydmljZS5pc01hcmtlckluc3RhbmNlKGUudGFyZ2V0KSkge1xyXG4gICAgICAgICAgICAgICAgc2VsZi5iZWhhdmlvci5lbmFibGUoKTtcclxuICAgICAgICAgICAgfVxyXG5cclxuICAgICAgICAgICAgc2VsZi50cmlnZ2VyVXNlckxpc3RlbmVyKENPTlNUUy5VU0VSX0VWRU5UU1tlLnR5cGVdLCBlKTtcclxuICAgICAgICB9KTtcclxuICAgIH1cclxuXHJcbiAgICBmdW5jdGlvbiBzZXR1cE9wdGlvbnMob3B0aW9ucykge1xyXG4gICAgICAgIGlmICghb3B0aW9ucylcclxuICAgICAgICAgICAgcmV0dXJuO1xyXG5cclxuICAgICAgICB0aGlzLm1hcC5kcmFnZ2FibGUgPSAhIW9wdGlvbnMuZHJhZ2dhYmxlO1xyXG4gICAgfVxyXG5cclxuICAgIGZ1bmN0aW9uIHRyaWdnZXJVc2VyTGlzdGVuZXIoZXZlbnROYW1lLCBlKSB7XHJcbiAgICAgICAgaWYgKCF0aGlzLmxpc3RlbmVycylcclxuICAgICAgICAgICAgcmV0dXJuO1xyXG5cclxuICAgICAgICB2YXIgY2FsbGJhY2sgPSB0aGlzLmxpc3RlbmVyc1tldmVudE5hbWVdO1xyXG5cclxuICAgICAgICBjYWxsYmFjayAmJiBjYWxsYmFjayhlKTtcclxuICAgIH1cclxuICAgIFxyXG4gICAgZnVuY3Rpb24gaW5mb0J1YmJsZUhhbmRsZXIoZSl7XHJcbiAgICAgICAgdmFyIHVpID0gdGhpcy5pbmplY3QoJ3VpJyk7XHJcbiAgICAgICAgXHJcbiAgICAgICAgaWYodWkpXHJcbiAgICAgICAgICAgIHRoaXMuYnViYmxlLnRvZ2dsZShlLCB1aSk7XHJcbiAgICAgICAgICAgIFxyXG4gICAgICAgIHRoaXMudHJpZ2dlclVzZXJMaXN0ZW5lcihDT05TVFMuVVNFUl9FVkVOVFNbZS50eXBlXSwgZSk7ICAgICAgXHJcbiAgICB9XHJcblxyXG59OyIsIm1vZHVsZS5leHBvcnRzID0gZnVuY3Rpb24oTWFya2Vyc1NlcnZpY2UsIEhlcmVNYXBVdGlsc1NlcnZpY2UsIENPTlNUUykge1xyXG4gICAgZnVuY3Rpb24gSW5mb0J1YmJsZSgpIHt9XHJcblxyXG4gICAgdmFyIHByb3RvID0gSW5mb0J1YmJsZS5wcm90b3R5cGU7XHJcbiAgICAgICAgXHJcbiAgICBwcm90by5jcmVhdGUgPSBjcmVhdGU7XHJcbiAgICBwcm90by51cGRhdGUgPSB1cGRhdGU7XHJcbiAgICBwcm90by50b2dnbGUgPSB0b2dnbGU7XHJcbiAgICBwcm90by5zaG93ID0gc2hvdztcclxuICAgIHByb3RvLmNsb3NlID0gY2xvc2U7XHJcblxyXG4gICAgcmV0dXJuIHtcclxuICAgICAgICBjcmVhdGU6IGZ1bmN0aW9uKCl7XHJcbiAgICAgICAgICAgIHJldHVybiBuZXcgSW5mb0J1YmJsZSgpO1xyXG4gICAgICAgIH1cclxuICAgIH1cclxuXHJcbiAgICBmdW5jdGlvbiB0b2dnbGUoZSwgdWkpIHtcclxuICAgICAgICBpZiAoTWFya2Vyc1NlcnZpY2UuaXNNYXJrZXJJbnN0YW5jZShlLnRhcmdldCkpXHJcbiAgICAgICAgICAgIHRoaXMuc2hvdyhlLCB1aSk7XHJcbiAgICAgICAgZWxzZVxyXG4gICAgICAgICAgICB0aGlzLmNsb3NlKGUsIHVpKTtcclxuICAgIH1cclxuXHJcbiAgICBmdW5jdGlvbiB1cGRhdGUoYnViYmxlLCBkYXRhKSB7XHJcbiAgICAgICAgYnViYmxlLmRpc3BsYXkgPSBkYXRhLmRpc3BsYXk7XHJcblxyXG4gICAgICAgIGJ1YmJsZS5zZXRQb3NpdGlvbihkYXRhLnBvc2l0aW9uKTtcclxuICAgICAgICBidWJibGUuc2V0Q29udGVudChkYXRhLm1hcmt1cCk7XHJcblxyXG4gICAgICAgIGJ1YmJsZS5zZXRTdGF0ZShDT05TVFMuSU5GT0JVQkJMRS5TVEFURS5PUEVOKTtcclxuICAgIH1cclxuXHJcbiAgICBmdW5jdGlvbiBjcmVhdGUoc291cmNlKSB7XHJcbiAgICAgICAgdmFyIGJ1YmJsZSA9IG5ldyBILnVpLkluZm9CdWJibGUoc291cmNlLnBvc2l0aW9uLCB7XHJcbiAgICAgICAgICAgIGNvbnRlbnQ6IHNvdXJjZS5tYXJrdXBcclxuICAgICAgICB9KTtcclxuXHJcbiAgICAgICAgYnViYmxlLmRpc3BsYXkgPSBzb3VyY2UuZGlzcGxheTtcclxuICAgICAgICBidWJibGUuYWRkQ2xhc3MoQ09OU1RTLklORk9CVUJCTEUuU1RBVEUuT1BFTilcclxuXHJcbiAgICAgICAgSGVyZU1hcFV0aWxzU2VydmljZS5hZGRFdmVudExpc3RlbmVyKGJ1YmJsZSwgJ3N0YXRlY2hhbmdlJywgZnVuY3Rpb24oZSkge1xyXG4gICAgICAgICAgICB2YXIgc3RhdGUgPSB0aGlzLmdldFN0YXRlKCksXHJcbiAgICAgICAgICAgICAgICBlbCA9IHRoaXMuZ2V0RWxlbWVudCgpO1xyXG4gICAgICAgICAgICBpZiAoc3RhdGUgPT09IENPTlNUUy5JTkZPQlVCQkxFLlNUQVRFLkNMT1NFRCkge1xyXG4gICAgICAgICAgICAgICAgZWwuY2xhc3NMaXN0LnJlbW92ZShDT05TVFMuSU5GT0JVQkJMRS5TVEFURS5PUEVOKTtcclxuICAgICAgICAgICAgfSBlbHNlXHJcbiAgICAgICAgICAgICAgICB0aGlzLmFkZENsYXNzKHN0YXRlKVxyXG4gICAgICAgIH0pO1xyXG5cclxuICAgICAgICByZXR1cm4gYnViYmxlO1xyXG4gICAgfVxyXG5cclxuICAgIGZ1bmN0aW9uIHNob3coZSwgdWksIGRhdGEpIHtcclxuICAgICAgICB2YXIgdGFyZ2V0ID0gZS50YXJnZXQsXHJcbiAgICAgICAgICAgIGRhdGEgPSB0YXJnZXQuZ2V0RGF0YSgpLFxyXG4gICAgICAgICAgICBlbCA9IG51bGw7XHJcblxyXG4gICAgICAgIGlmICghZGF0YSB8fCAhZGF0YS5kaXNwbGF5IHx8ICFkYXRhLm1hcmt1cCB8fCBkYXRhLmRpc3BsYXkgIT09IENPTlNUUy5JTkZPQlVCQkxFLkRJU1BMQVlfRVZFTlRbZS50eXBlXSlcclxuICAgICAgICAgICAgcmV0dXJuO1xyXG5cclxuICAgICAgICB2YXIgc291cmNlID0ge1xyXG4gICAgICAgICAgICBwb3NpdGlvbjogdGFyZ2V0LmdldFBvc2l0aW9uKCksXHJcbiAgICAgICAgICAgIG1hcmt1cDogZGF0YS5tYXJrdXAsXHJcbiAgICAgICAgICAgIGRpc3BsYXk6IGRhdGEuZGlzcGxheVxyXG4gICAgICAgIH07XHJcblxyXG4gICAgICAgIGlmICghdWkuYnViYmxlKSB7XHJcbiAgICAgICAgICAgIHVpLmJ1YmJsZSA9IHRoaXMuY3JlYXRlKHNvdXJjZSk7XHJcbiAgICAgICAgICAgIHVpLmFkZEJ1YmJsZSh1aS5idWJibGUpO1xyXG5cclxuICAgICAgICAgICAgcmV0dXJuO1xyXG4gICAgICAgIH1cclxuXHJcbiAgICAgICAgdGhpcy51cGRhdGUodWkuYnViYmxlLCBzb3VyY2UpO1xyXG4gICAgfVxyXG5cclxuICAgIGZ1bmN0aW9uIGNsb3NlKGUsIHVpKSB7XHJcbiAgICAgICAgaWYgKCF1aS5idWJibGUgfHwgdWkuYnViYmxlLmRpc3BsYXkgIT09IENPTlNUUy5JTkZPQlVCQkxFLkRJU1BMQVlfRVZFTlRbZS50eXBlXSkge1xyXG4gICAgICAgICAgICByZXR1cm47XHJcbiAgICAgICAgfVxyXG5cclxuICAgICAgICB1aS5idWJibGUuc2V0U3RhdGUoQ09OU1RTLklORk9CVUJCTEUuU1RBVEUuQ0xPU0VEKTtcclxuICAgIH1cclxufSIsInZhciBldmVudHNNb2R1bGUgPSByZXF1aXJlKCcuL2V2ZW50cy9ldmVudHMuanMnKSxcclxuICAgIGluZm9CdWJibGUgPSByZXF1aXJlKCcuL2V2ZW50cy9pbmZvYnViYmxlLmpzJyk7XHJcbiAgICBcclxudmFyIHVpTW9kdWxlID0gcmVxdWlyZSgnLi91aS91aS5qcycpO1xyXG5cclxuYW5ndWxhci5tb2R1bGUoJ2V2ZW50cy1tb2R1bGUnLCBbXSlcclxuICAgIC5mYWN0b3J5KCdFdmVudHNNb2R1bGUnLCBldmVudHNNb2R1bGUpXHJcbiAgICAuZmFjdG9yeSgnSW5mb0J1YmJsZUZhY3RvcnknLCBpbmZvQnViYmxlKTtcclxuICAgIFxyXG5hbmd1bGFyLm1vZHVsZSgndWktbW9kdWxlJywgW10pXHJcbiAgICAuZmFjdG9yeSgnVUlNb2R1bGUnLCB1aU1vZHVsZSlcclxuXHJcbnZhciBhcHAgPSBhbmd1bGFyLm1vZHVsZSgnbWFwLW1vZHVsZXMnLCBbXHJcblx0J2V2ZW50cy1tb2R1bGUnLFxyXG4gICAgJ3VpLW1vZHVsZSdcclxuXSk7XHJcblxyXG5tb2R1bGUuZXhwb3J0cyA9IGFwcDsiLCJtb2R1bGUuZXhwb3J0cyA9IGZ1bmN0aW9uKEFQSVNlcnZpY2UsIE1hcmtlcnNTZXJ2aWNlLCBIZXJlTWFwVXRpbHNTZXJ2aWNlLCBDT05TVFMpIHtcclxuICAgIGZ1bmN0aW9uIFVJKHBsYXRmb3JtLCBhbGlnbm1lbnQpIHtcclxuICAgICAgICB0aGlzLm1hcCA9IHBsYXRmb3JtLm1hcDtcclxuICAgICAgICB0aGlzLmxheWVycyA9IHBsYXRmb3JtLmxheWVycztcclxuICAgICAgICB0aGlzLmFsaWdubWVudCA9IGFsaWdubWVudDtcclxuICAgICAgICB0aGlzLnVpID0gcGxhdGZvcm0udWkgPSBILnVpLlVJLmNyZWF0ZURlZmF1bHQodGhpcy5tYXAsIHRoaXMubGF5ZXJzKTtcclxuXHJcbiAgICAgICAgdGhpcy5zZXR1cENvbnRyb2xzKCk7XHJcbiAgICB9XHJcblxyXG4gICAgVUkuaXNWYWxpZEFsaWdubWVudCA9IGlzVmFsaWRBbGlnbm1lbnQ7XHJcblxyXG4gICAgdmFyIHByb3RvID0gVUkucHJvdG90eXBlO1xyXG5cclxuICAgIHByb3RvLnNldHVwQ29udHJvbHMgPSBzZXR1cENvbnRyb2xzO1xyXG4gICAgcHJvdG8uY3JlYXRlVXNlckNvbnRyb2wgPSBjcmVhdGVVc2VyQ29udHJvbDtcclxuICAgIHByb3RvLnNldENvbnRyb2xzQWxpZ25tZW50ID0gc2V0Q29udHJvbHNBbGlnbm1lbnQ7XHJcblxyXG4gICAgcmV0dXJuIHtcclxuICAgICAgICBzdGFydDogZnVuY3Rpb24oYXJncykge1xyXG4gICAgICAgICAgICBpZiAoIShhcmdzLnBsYXRmb3JtLm1hcCBpbnN0YW5jZW9mIEguTWFwKSAmJiAhKGFyZ3MucGxhdGZvcm0ubGF5ZXJzKSlcclxuICAgICAgICAgICAgICAgIHJldHVybiBjb25zb2xlLmVycm9yKCdNaXNzZWQgdWkgbW9kdWxlIGRlcGVuZGVuY2llcycpO1xyXG5cclxuICAgICAgICAgICAgdmFyIHVpID0gbmV3IFVJKGFyZ3MucGxhdGZvcm0sIGFyZ3MuYWxpZ25tZW50KTtcclxuICAgICAgICB9XHJcbiAgICB9XHJcblxyXG4gICAgZnVuY3Rpb24gc2V0dXBDb250cm9scygpIHtcclxuICAgICAgICB2YXIgTkFNRVMgPSBDT05TVFMuQ09OVFJPTFMuTkFNRVMsXHJcbiAgICAgICAgICAgIHVzZXJDb250cm9sID0gdGhpcy5jcmVhdGVVc2VyQ29udHJvbCgpO1xyXG5cclxuICAgICAgICB0aGlzLnVpLmdldENvbnRyb2woTkFNRVMuU0VUVElOR1MpLnNldEluY2lkZW50c0xheWVyKGZhbHNlKTtcclxuICAgICAgICB0aGlzLnVpLmFkZENvbnRyb2woTkFNRVMuVVNFUiwgdXNlckNvbnRyb2wpO1xyXG4gICAgICAgIHRoaXMuc2V0Q29udHJvbHNBbGlnbm1lbnQoTkFNRVMpO1xyXG4gICAgfVxyXG5cclxuICAgIGZ1bmN0aW9uIGNyZWF0ZVVzZXJDb250cm9sKCkge1xyXG4gICAgICAgIHZhciBzZWxmID0gdGhpcyxcclxuICAgICAgICAgICAgdXNlckNvbnRyb2wgPSBuZXcgSC51aS5Db250cm9sKCksXHJcbiAgICAgICAgICAgIG1hcmt1cCA9ICc8c3ZnIGNsYXNzPVwiSF9pY29uXCIgZmlsbD1cIiNmZmZcIiB4bWxucz1cImh0dHA6Ly93d3cudzMub3JnLzIwMDAvc3ZnXCIgd2lkdGg9XCIxNlwiIGhlaWdodD1cIjE2XCIgdmlld0JveD1cIjAgMCAxNiAxNlwiPjxwYXRoIGNsYXNzPVwibWlkZGxlX2xvY2F0aW9uX3N0cm9rZVwiIGQ9XCJNOCAxMmMtMi4yMDYgMC00LTEuNzk1LTQtNCAwLTIuMjA2IDEuNzk0LTQgNC00czQgMS43OTQgNCA0YzAgMi4yMDUtMS43OTQgNC00IDRNOCAxLjI1YTYuNzUgNi43NSAwIDEgMCAwIDEzLjUgNi43NSA2Ljc1IDAgMCAwIDAtMTMuNVwiPjwvcGF0aD48cGF0aCBjbGFzcz1cImlubmVyX2xvY2F0aW9uX3N0cm9rZVwiIGQ9XCJNOCA1YTMgMyAwIDEgMSAuMDAxIDZBMyAzIDAgMCAxIDggNW0wLTFDNS43OTQgNCA0IDUuNzk0IDQgOGMwIDIuMjA1IDEuNzk0IDQgNCA0czQtMS43OTUgNC00YzAtMi4yMDYtMS43OTQtNC00LTRcIj48L3BhdGg+PHBhdGggY2xhc3M9XCJvdXRlcl9sb2NhdGlvbl9zdHJva2VcIiBkPVwiTTggMS4yNWE2Ljc1IDYuNzUgMCAxIDEgMCAxMy41IDYuNzUgNi43NSAwIDAgMSAwLTEzLjVNOCAwQzMuNTkgMCAwIDMuNTkgMCA4YzAgNC40MTEgMy41OSA4IDggOHM4LTMuNTg5IDgtOGMwLTQuNDEtMy41OS04LTgtOFwiPjwvcGF0aD48L3N2Zz4nO1xyXG5cclxuICAgICAgICB2YXIgdXNlckNvbnRyb2xCdXR0b24gPSBuZXcgSC51aS5iYXNlLkJ1dHRvbih7XHJcbiAgICAgICAgICAgIGxhYmVsOiBtYXJrdXAsXHJcbiAgICAgICAgICAgIG9uU3RhdGVDaGFuZ2U6IGZ1bmN0aW9uKGV2dCkge1xyXG4gICAgICAgICAgICAgICAgaWYgKHVzZXJDb250cm9sQnV0dG9uLmdldFN0YXRlKCkgPT09IEgudWkuYmFzZS5CdXR0b24uU3RhdGUuRE9XTilcclxuICAgICAgICAgICAgICAgICAgICByZXR1cm47XHJcblxyXG4gICAgICAgICAgICAgICAgQVBJU2VydmljZS5nZXRQb3NpdGlvbigpLnRoZW4oZnVuY3Rpb24ocmVzcG9uc2UpIHtcclxuICAgICAgICAgICAgICAgICAgICB2YXIgcG9zaXRpb24gPSB7XHJcbiAgICAgICAgICAgICAgICAgICAgICAgIGxuZzogcmVzcG9uc2UuY29vcmRzLmxvbmdpdHVkZSxcclxuICAgICAgICAgICAgICAgICAgICAgICAgbGF0OiByZXNwb25zZS5jb29yZHMubGF0aXR1ZGVcclxuICAgICAgICAgICAgICAgICAgICB9O1xyXG4gICAgICAgICAgICAgICAgICAgIFxyXG4gICAgICAgICAgICAgICAgICAgIHNlbGYubWFwLnNldENlbnRlcihwb3NpdGlvbik7XHJcbiAgICAgICAgICAgICAgICAgICAgXHJcbiAgICAgICAgICAgICAgICAgICAgSGVyZU1hcFV0aWxzU2VydmljZS56b29tKHNlbGYubWFwLCAxNywgLjA4KTtcclxuXHJcbiAgICAgICAgICAgICAgICAgICAgaWYgKHNlbGYudXNlck1hcmtlcikge1xyXG4gICAgICAgICAgICAgICAgICAgICAgICBzZWxmLnVzZXJNYXJrZXIuc2V0UG9zaXRpb24ocG9zaXRpb24pO1xyXG4gICAgICAgICAgICAgICAgICAgICAgICByZXR1cm47XHJcbiAgICAgICAgICAgICAgICAgICAgfVxyXG4gICAgICAgICAgICAgICAgICAgIFxyXG4gICAgICAgICAgICAgICAgICAgIHNlbGYudXNlck1hcmtlciA9IE1hcmtlcnNTZXJ2aWNlLmFkZFVzZXJNYXJrZXIoc2VsZi5tYXAsIHtcclxuICAgICAgICAgICAgICAgICAgICAgICAgcG9zOiBwb3NpdGlvblxyXG4gICAgICAgICAgICAgICAgICAgIH0pO1xyXG4gICAgICAgICAgICAgICAgfSk7XHJcbiAgICAgICAgICAgIH1cclxuICAgICAgICB9KTtcclxuXHJcbiAgICAgICAgdXNlckNvbnRyb2wuYWRkQ2hpbGQodXNlckNvbnRyb2xCdXR0b24pO1xyXG5cclxuICAgICAgICByZXR1cm4gdXNlckNvbnRyb2w7XHJcbiAgICB9XHJcblxyXG4gICAgZnVuY3Rpb24gc2V0Q29udHJvbHNBbGlnbm1lbnQoTkFNRVMpIHtcclxuICAgICAgICBpZiAoIVVJLmlzVmFsaWRBbGlnbm1lbnQodGhpcy5hbGlnbm1lbnQpKVxyXG4gICAgICAgICAgICByZXR1cm47XHJcblxyXG4gICAgICAgIGZvciAodmFyIGlkIGluIE5BTUVTKSB7XHJcbiAgICAgICAgICAgIHZhciBjb250cm9sID0gdGhpcy51aS5nZXRDb250cm9sKE5BTUVTW2lkXSk7XHJcblxyXG4gICAgICAgICAgICBpZiAoIU5BTUVTLmhhc093blByb3BlcnR5KGlkKSB8fCAhY29udHJvbClcclxuICAgICAgICAgICAgICAgIGNvbnRpbnVlO1xyXG5cclxuICAgICAgICAgICAgY29udHJvbC5zZXRBbGlnbm1lbnQodGhpcy5hbGlnbm1lbnQpO1xyXG4gICAgICAgIH1cclxuICAgIH1cclxuXHJcbiAgICBmdW5jdGlvbiBpc1ZhbGlkQWxpZ25tZW50KGFsaWdubWVudCkge1xyXG4gICAgICAgIHJldHVybiAhIShDT05TVFMuQ09OVFJPTFMuUE9TSVRJT05TLmluZGV4T2YoYWxpZ25tZW50KSArIDEpO1xyXG4gICAgfVxyXG5cclxufTsiLCJtb2R1bGUuZXhwb3J0cyA9IGZ1bmN0aW9uKCkge1xyXG4gICAgdmFyIG9wdGlvbnMgPSB7fTtcclxuICAgIHZhciBERUZBVUxUX0FQSV9WRVJTSU9OID0gXCIzLjBcIjtcclxuXHJcbiAgICB0aGlzLiRnZXQgPSBmdW5jdGlvbigpe1xyXG4gICAgICAgIHJldHVybiB7XHJcbiAgICAgICAgICAgIGFwcF9pZDogb3B0aW9ucy5hcHBfaWQsXHJcbiAgICAgICAgICAgIGFwcF9jb2RlOiBvcHRpb25zLmFwcF9jb2RlLFxyXG4gICAgICAgICAgICBhcGlWZXJzaW9uOiBvcHRpb25zLmFwaVZlcnNpb24gfHwgREVGQVVMVF9BUElfVkVSU0lPTixcclxuICAgICAgICAgICAgdXNlSFRUUFM6IG9wdGlvbnMudXNlSFRUUFNcclxuICAgICAgICB9XHJcbiAgICB9O1xyXG5cclxuICAgIHRoaXMuc2V0T3B0aW9ucyA9IGZ1bmN0aW9uKG9wdHMpe1xyXG4gICAgICAgIG9wdGlvbnMgPSBvcHRzO1xyXG4gICAgfTtcclxufTsiLCJtb2R1bGUuZXhwb3J0cyA9IGZ1bmN0aW9uICgkcm9vdFNjb3BlLCAkdGltZW91dCwgQ09OU1RTKSB7XHJcbiAgICByZXR1cm4ge1xyXG4gICAgICAgIHRocm90dGxlOiB0aHJvdHRsZSxcclxuICAgICAgICBjcmVhdGVTY3JpcHRUYWc6IGNyZWF0ZVNjcmlwdFRhZyxcclxuICAgICAgICBjcmVhdGVMaW5rVGFnOiBjcmVhdGVMaW5rVGFnLFxyXG4gICAgICAgIHJ1blNjb3BlRGlnZXN0SWZOZWVkOiBydW5TY29wZURpZ2VzdElmTmVlZCxcclxuICAgICAgICBpc1ZhbGlkQ29vcmRzOiBpc1ZhbGlkQ29vcmRzLFxyXG4gICAgICAgIGFkZEV2ZW50TGlzdGVuZXI6IGFkZEV2ZW50TGlzdGVuZXIsXHJcbiAgICAgICAgem9vbTogem9vbSxcclxuICAgICAgICBnZW5lcmF0ZUlkOiBnZW5lcmF0ZUlkXHJcbiAgICB9O1xyXG5cclxuICAgIC8vI3JlZ2lvbiBQVUJMSUNcclxuICAgIGZ1bmN0aW9uIHRocm90dGxlKGZuLCBwZXJpb2QpIHtcclxuICAgICAgICB2YXIgdGltZW91dCA9IG51bGw7XHJcblxyXG4gICAgICAgIHJldHVybiBmdW5jdGlvbiAoKSB7XHJcbiAgICAgICAgICAgIGlmICgkdGltZW91dClcclxuICAgICAgICAgICAgICAgICR0aW1lb3V0LmNhbmNlbCh0aW1lb3V0KTtcclxuXHJcbiAgICAgICAgICAgIHRpbWVvdXQgPSAkdGltZW91dChmbiwgcGVyaW9kKTtcclxuICAgICAgICB9XHJcbiAgICB9XHJcblxyXG4gICAgZnVuY3Rpb24gYWRkRXZlbnRMaXN0ZW5lcihvYmosIGV2ZW50TmFtZSwgbGlzdGVuZXIsIHVzZUNhcHR1cmUpIHtcclxuICAgICAgICB2YXIgX3VzZUNhcHR1cmUgPSAhIXVzZUNhcHR1cmU7XHJcblxyXG4gICAgICAgIG9iai5hZGRFdmVudExpc3RlbmVyKGV2ZW50TmFtZSwgbGlzdGVuZXIsIF91c2VDYXB0dXJlKTtcclxuICAgIH1cclxuXHJcbiAgICBmdW5jdGlvbiBydW5TY29wZURpZ2VzdElmTmVlZChzY29wZSwgY2IpIHtcclxuICAgICAgICBpZiAoc2NvcGUuJHJvb3QgJiYgc2NvcGUuJHJvb3QuJCRwaGFzZSAhPT0gJyRhcHBseScgJiYgc2NvcGUuJHJvb3QuJCRwaGFzZSAhPT0gJyRkaWdlc3QnKSB7XHJcbiAgICAgICAgICAgIHNjb3BlLiRkaWdlc3QoY2IgfHwgYW5ndWxhci5ub29wKTtcclxuICAgICAgICAgICAgcmV0dXJuIHRydWU7XHJcbiAgICAgICAgfVxyXG4gICAgICAgIHJldHVybiBmYWxzZTtcclxuICAgIH1cclxuXHJcbiAgICBmdW5jdGlvbiBjcmVhdGVTY3JpcHRUYWcoYXR0cnMpIHtcclxuICAgICAgICB2YXIgc2NyaXB0ID0gZG9jdW1lbnQuZ2V0RWxlbWVudEJ5SWQoYXR0cnMuc3JjKTtcclxuXHJcbiAgICAgICAgaWYgKHNjcmlwdClcclxuICAgICAgICAgICAgcmV0dXJuIGZhbHNlO1xyXG5cclxuICAgICAgICBzY3JpcHQgPSBkb2N1bWVudC5jcmVhdGVFbGVtZW50KCdzY3JpcHQnKTtcclxuICAgICAgICBzY3JpcHQudHlwZSA9ICd0ZXh0L2phdmFzY3JpcHQnO1xyXG4gICAgICAgIHNjcmlwdC5pZCA9IGF0dHJzLnNyYztcclxuICAgICAgICBfc2V0QXR0cnMoc2NyaXB0LCBhdHRycyk7XHJcblxyXG4gICAgICAgIHJldHVybiBzY3JpcHQ7XHJcbiAgICB9XHJcblxyXG4gICAgZnVuY3Rpb24gY3JlYXRlTGlua1RhZyhhdHRycykge1xyXG4gICAgICAgIHZhciBsaW5rID0gZG9jdW1lbnQuZ2V0RWxlbWVudEJ5SWQoYXR0cnMuaHJlZik7XHJcblxyXG4gICAgICAgIGlmIChsaW5rKVxyXG4gICAgICAgICAgICByZXR1cm4gZmFsc2U7XHJcblxyXG4gICAgICAgIGxpbmsgPSBkb2N1bWVudC5jcmVhdGVFbGVtZW50KCdsaW5rJyk7XHJcbiAgICAgICAgbGluay5pZCA9IGF0dHJzLmhyZWY7XHJcbiAgICAgICAgX3NldEF0dHJzKGxpbmssIGF0dHJzKTtcclxuXHJcbiAgICAgICAgcmV0dXJuIGxpbms7XHJcbiAgICB9XHJcblxyXG4gICAgZnVuY3Rpb24gaXNWYWxpZENvb3Jkcyhjb29yZHMpIHtcclxuICAgICAgICByZXR1cm4gY29vcmRzICYmXHJcbiAgICAgICAgICAgICh0eXBlb2YgY29vcmRzLmxhdGl0dWRlID09PSAnc3RyaW5nJyB8fCB0eXBlb2YgY29vcmRzLmxhdGl0dWRlID09PSAnbnVtYmVyJykgJiZcclxuICAgICAgICAgICAgKHR5cGVvZiBjb29yZHMubG9uZ2l0dWRlID09PSAnc3RyaW5nJyB8fCB0eXBlb2YgY29vcmRzLmxvbmdpdHVkZSA9PT0gJ251bWJlcicpXHJcbiAgICB9XHJcblxyXG4gICAgZnVuY3Rpb24gem9vbShtYXAsIHZhbHVlLCBzdGVwKSB7XHJcbiAgICAgICAgdmFyIGN1cnJlbnRab29tID0gbWFwLmdldFpvb20oKSxcclxuICAgICAgICAgICAgX3N0ZXAgPSBzdGVwIHx8IENPTlNUUy5BTklNQVRJT05fWk9PTV9TVEVQLFxyXG4gICAgICAgICAgICBmYWN0b3IgPSBjdXJyZW50Wm9vbSA+PSB2YWx1ZSA/IC0xIDogMSxcclxuICAgICAgICAgICAgaW5jcmVtZW50ID0gc3RlcCAqIGZhY3RvcjtcclxuXHJcbiAgICAgICAgcmV0dXJuIChmdW5jdGlvbiB6b29tKCkge1xyXG4gICAgICAgICAgICBpZiAoIXN0ZXAgfHwgTWF0aC5mbG9vcihjdXJyZW50Wm9vbSkgPT09IE1hdGguZmxvb3IodmFsdWUpKSB7XHJcbiAgICAgICAgICAgICAgICBtYXAuc2V0Wm9vbSh2YWx1ZSk7XHJcbiAgICAgICAgICAgICAgICByZXR1cm47XHJcbiAgICAgICAgICAgIH1cclxuXHJcbiAgICAgICAgICAgIGN1cnJlbnRab29tICs9IGluY3JlbWVudDtcclxuICAgICAgICAgICAgbWFwLnNldFpvb20oY3VycmVudFpvb20pO1xyXG5cclxuICAgICAgICAgICAgcmVxdWVzdEFuaW1hdGlvbkZyYW1lKHpvb20pO1xyXG4gICAgICAgIH0pKCk7XHJcbiAgICB9XHJcblxyXG4gICAgZnVuY3Rpb24gZ2VuZXJhdGVJZCgpIHtcclxuICAgICAgICB2YXIgbWFzayA9ICd4eHh4eHh4eC14eHh4LTR4eHgteXh4eC14eHh4eHh4eHh4eHgnLFxyXG4gICAgICAgICAgICByZWdleHAgPSAvW3h5XS9nLFxyXG4gICAgICAgICAgICBkID0gbmV3IERhdGUoKS5nZXRUaW1lKCksXHJcbiAgICAgICAgICAgIHV1aWQgPSBtYXNrLnJlcGxhY2UocmVnZXhwLCBmdW5jdGlvbiAoYykge1xyXG4gICAgICAgICAgICAgICAgdmFyIHIgPSAoZCArIE1hdGgucmFuZG9tKCkgKiAxNikgJSAxNiB8IDA7XHJcbiAgICAgICAgICAgICAgICBkID0gTWF0aC5mbG9vcihkIC8gMTYpO1xyXG4gICAgICAgICAgICByZXR1cm4gKGMgPT0gJ3gnID8gciA6IChyICYgMHgzIHwgMHg4KSkudG9TdHJpbmcoMTYpO1xyXG4gICAgICAgIH0pO1xyXG4gICAgICAgIFxyXG4gICAgICAgIHJldHVybiB1dWlkO1xyXG4gICAgfVxyXG5cclxuICAgIC8vI2VuZHJlZ2lvbiBQVUJMSUMgXHJcblxyXG4gICAgZnVuY3Rpb24gX3NldEF0dHJzKGVsLCBhdHRycykge1xyXG4gICAgICAgIGlmICghZWwgfHwgIWF0dHJzKVxyXG4gICAgICAgICAgICB0aHJvdyBuZXcgRXJyb3IoJ01pc3NlZCBhdHRyaWJ1dGVzJyk7XHJcblxyXG4gICAgICAgIGZvciAodmFyIGtleSBpbiBhdHRycykge1xyXG4gICAgICAgICAgICBpZiAoIWF0dHJzLmhhc093blByb3BlcnR5KGtleSkpXHJcbiAgICAgICAgICAgICAgICBjb250aW51ZTtcclxuXHJcbiAgICAgICAgICAgIGVsW2tleV0gPSBhdHRyc1trZXldO1xyXG4gICAgICAgIH1cclxuICAgIH1cclxufTsiLCJtb2R1bGUuZXhwb3J0cyA9IGZ1bmN0aW9uKE1hcmtlckludGVyZmFjZSl7XHJcbiAgICBmdW5jdGlvbiBEZWZhdWx0TWFya2VyKHBsYWNlKXtcclxuICAgICAgICB0aGlzLnBsYWNlID0gcGxhY2U7XHJcbiAgICAgICAgdGhpcy5zZXRDb29yZHMoKTtcclxuICAgIH1cclxuXHJcbiAgICB2YXIgcHJvdG8gPSBEZWZhdWx0TWFya2VyLnByb3RvdHlwZSA9IG5ldyBNYXJrZXJJbnRlcmZhY2UoKTtcclxuICAgIHByb3RvLmNvbnN0cnVjdG9yID0gRGVmYXVsdE1hcmtlcjtcclxuXHJcbiAgICBwcm90by5jcmVhdGUgPSBjcmVhdGU7XHJcblxyXG4gICAgcmV0dXJuIERlZmF1bHRNYXJrZXI7XHJcbiAgICBcclxuICAgIGZ1bmN0aW9uIGNyZWF0ZSgpe1xyXG4gICAgICAgIHZhciBtYXJrZXIgPSBuZXcgSC5tYXAuTWFya2VyKHRoaXMuY29vcmRzKTtcclxuICAgICAgICBcclxuICAgICAgICB0aGlzLmFkZEluZm9CdWJibGUobWFya2VyKTtcclxuICAgICAgICBcclxuICAgICAgICByZXR1cm4gbWFya2VyO1xyXG4gICAgfVxyXG59IiwibW9kdWxlLmV4cG9ydHMgPSBmdW5jdGlvbihNYXJrZXJJbnRlcmZhY2Upe1xyXG4gICAgZnVuY3Rpb24gRE9NTWFya2VyKHBsYWNlKXtcclxuICAgICAgICB0aGlzLnBsYWNlID0gcGxhY2U7XHJcbiAgICAgICAgdGhpcy5zZXRDb29yZHMoKTtcclxuICAgIH1cclxuXHJcbiAgICB2YXIgcHJvdG8gPSBET01NYXJrZXIucHJvdG90eXBlID0gbmV3IE1hcmtlckludGVyZmFjZSgpO1xyXG4gICAgcHJvdG8uY29uc3RydWN0b3IgPSBET01NYXJrZXI7XHJcblxyXG4gICAgcHJvdG8uY3JlYXRlID0gY3JlYXRlO1xyXG4gICAgcHJvdG8uZ2V0SWNvbiA9IGdldEljb247XHJcbiAgICBwcm90by5zZXR1cEV2ZW50cyA9IHNldHVwRXZlbnRzO1xyXG5cclxuICAgIHJldHVybiBET01NYXJrZXI7XHJcbiAgICBcclxuICAgIGZ1bmN0aW9uIGNyZWF0ZSgpe1xyXG4gICAgICAgIHZhciBtYXJrZXIgPSBuZXcgSC5tYXAuRG9tTWFya2VyKHRoaXMuY29vcmRzLCB7XHJcbiAgICAgICAgICAgIGljb246IHRoaXMuZ2V0SWNvbigpXHJcbiAgICAgICAgfSk7XHJcbiAgICAgICAgXHJcbiAgICAgICAgdGhpcy5hZGRJbmZvQnViYmxlKG1hcmtlcik7XHJcbiAgICAgICAgXHJcbiAgICAgICAgcmV0dXJuIG1hcmtlcjtcclxuICAgIH1cclxuICAgIFxyXG4gICAgZnVuY3Rpb24gZ2V0SWNvbigpe1xyXG4gICAgICAgIHZhciBpY29uID0gdGhpcy5wbGFjZS5tYXJrdXA7XHJcbiAgICAgICAgIGlmKCFpY29uKVxyXG4gICAgICAgICAgICB0aHJvdyBuZXcgRXJyb3IoJ21hcmt1cCBtaXNzZWQnKTtcclxuXHJcbiAgICAgICAgcmV0dXJuIG5ldyBILm1hcC5Eb21JY29uKGljb24pO1xyXG4gICAgfVxyXG4gICAgXHJcbiAgICBmdW5jdGlvbiBzZXR1cEV2ZW50cyhlbCwgZXZlbnRzLCByZW1vdmUpe1xyXG4gICAgICAgIHZhciBtZXRob2QgPSByZW1vdmUgPyAncmVtb3ZlRXZlbnRMaXN0ZW5lcicgOiAnYWRkRXZlbnRMaXN0ZW5lcic7XHJcblxyXG4gICAgICAgIGZvcih2YXIga2V5IGluIGV2ZW50cykge1xyXG4gICAgICAgICAgICBpZighZXZlbnRzLmhhc093blByb3BlcnR5KGtleSkpXHJcbiAgICAgICAgICAgICAgICBjb250aW51ZTtcclxuXHJcbiAgICAgICAgICAgIGVsW21ldGhvZF0uY2FsbChudWxsLCBrZXksIGV2ZW50c1trZXldKTtcclxuICAgICAgICB9XHJcbiAgICB9XHJcbn0iLCJ2YXIgbWFya2VySW50ZXJmYWNlID0gcmVxdWlyZSgnLi9tYXJrZXIuanMnKSxcclxuXHRkZWZhdWx0TWFya2VyID0gcmVxdWlyZSgnLi9kZWZhdWx0Lm1hcmtlci5qcycpLFxyXG5cdGRvbU1hcmtlciA9IHJlcXVpcmUoJy4vZG9tLm1hcmtlci5qcycpLFxyXG5cdHN2Z01hcmtlciA9IHJlcXVpcmUoJy4vc3ZnLm1hcmtlci5qcycpLFxyXG4gICAgbWFya2Vyc1NlcnZpY2UgPSByZXF1aXJlKCcuL21hcmtlcnMuc2VydmljZS5qcycpO1xyXG5cclxuYW5ndWxhci5tb2R1bGUoJ21hcmtlci1pbnRlcmZhY2UnLCBbXSkuZmFjdG9yeSgnTWFya2VySW50ZXJmYWNlJywgbWFya2VySW50ZXJmYWNlKTtcclxuYW5ndWxhci5tb2R1bGUoJ2RlZmF1bHQtbWFya2VyJywgW10pLmZhY3RvcnkoJ0RlZmF1bHRNYXJrZXInLCBkZWZhdWx0TWFya2VyKTtcclxuYW5ndWxhci5tb2R1bGUoJ2RvbS1tYXJrZXInLCBbXSkuZmFjdG9yeSgnRE9NTWFya2VyJywgZG9tTWFya2VyKTtcclxuYW5ndWxhci5tb2R1bGUoJ3N2Zy1tYXJrZXInLCBbXSkuZmFjdG9yeSgnU1ZHTWFya2VyJywgc3ZnTWFya2VyKTtcclxuXHJcbmFuZ3VsYXIubW9kdWxlKCdtYXJrZXJzLXNlcnZpY2UnLCBbXSkuc2VydmljZSgnTWFya2Vyc1NlcnZpY2UnLCBtYXJrZXJzU2VydmljZSk7XHJcblxyXG52YXIgYXBwID0gYW5ndWxhci5tb2R1bGUoJ21hcmtlcnMtbW9kdWxlJywgW1xyXG5cdCdtYXJrZXItaW50ZXJmYWNlJyxcclxuICAgICdkZWZhdWx0LW1hcmtlcicsXHJcbiAgICAnZG9tLW1hcmtlcicsXHJcbiAgICAnbWFya2Vycy1zZXJ2aWNlJyxcclxuICAgICdzdmctbWFya2VyJ1xyXG5dKTtcclxuXHJcbm1vZHVsZS5leHBvcnRzID0gYXBwOyIsIm1vZHVsZS5leHBvcnRzID0gZnVuY3Rpb24oKXtcclxuICAgIGZ1bmN0aW9uIE1hcmtlckludGVyZmFjZSgpe1xyXG4gICAgICAgIHRocm93IG5ldyBFcnJvcignQWJzdHJhY3QgY2xhc3MhIFRoZSBJbnN0YW5jZSBzaG91bGQgYmUgY3JlYXRlZCcpO1xyXG4gICAgfVxyXG4gICAgXHJcbiAgICB2YXIgcHJvdG8gPSBNYXJrZXJJbnRlcmZhY2UucHJvdG90eXBlO1xyXG4gICAgXHJcbiAgICBwcm90by5jcmVhdGUgPSBjcmVhdGU7XHJcbiAgICBwcm90by5zZXRDb29yZHMgPSBzZXRDb29yZHM7XHJcbiAgICBwcm90by5hZGRJbmZvQnViYmxlID0gYWRkSW5mb0J1YmJsZTtcclxuICAgIFxyXG4gICAgZnVuY3Rpb24gTWFya2VyKCl7fVxyXG4gICAgXHJcbiAgICBNYXJrZXIucHJvdG90eXBlID0gcHJvdG87XHJcbiAgICBcclxuICAgIHJldHVybiBNYXJrZXI7XHJcbiAgICBcclxuICAgIGZ1bmN0aW9uIGNyZWF0ZSgpe1xyXG4gICAgICAgIHRocm93IG5ldyBFcnJvcignY3JlYXRlOjogbm90IGltcGxlbWVudGVkJyk7IFxyXG4gICAgfVxyXG4gICAgXHJcbiAgICBmdW5jdGlvbiBzZXRDb29yZHMoKXtcclxuICAgICAgICAgdGhpcy5jb29yZHMgPSB7XHJcbiAgICAgICAgICAgIGxhdDogdGhpcy5wbGFjZS5wb3MubGF0LFxyXG4gICAgICAgICAgICBsbmc6IHRoaXMucGxhY2UucG9zLmxuZ1xyXG4gICAgICAgIH1cclxuICAgIH1cclxuICAgIFxyXG4gICAgZnVuY3Rpb24gYWRkSW5mb0J1YmJsZShtYXJrZXIpe1xyXG4gICAgICAgIGlmKCF0aGlzLnBsYWNlLnBvcHVwKVxyXG4gICAgICAgICAgICByZXR1cm47XHJcbiAgICAgICAgICAgIFxyXG4gICAgICAgIG1hcmtlci5zZXREYXRhKHRoaXMucGxhY2UucG9wdXApXHJcbiAgICB9XHJcbn0iLCJtb2R1bGUuZXhwb3J0cyA9IGZ1bmN0aW9uKERlZmF1bHRNYXJrZXIsIERPTU1hcmtlciwgU1ZHTWFya2VyLCBDT05TVFMpIHtcclxuXHJcbiAgICB2YXIgTUFSS0VSX1RZUEVTID0gQ09OU1RTLk1BUktFUl9UWVBFUztcclxuXHJcbiAgICByZXR1cm4ge1xyXG4gICAgICAgIGFkZE1hcmtlcnNUb01hcDogYWRkTWFya2Vyc1RvTWFwLFxyXG4gICAgICAgIGFkZFVzZXJNYXJrZXI6IGFkZFVzZXJNYXJrZXIsXHJcbiAgICAgICAgdXBkYXRlTWFya2VyczogdXBkYXRlTWFya2VycyxcclxuICAgICAgICBpc01hcmtlckluc3RhbmNlOiBpc01hcmtlckluc3RhbmNlXHJcbiAgICB9XHJcblxyXG4gICAgZnVuY3Rpb24gaXNNYXJrZXJJbnN0YW5jZSh0YXJnZXQpIHtcclxuICAgICAgICByZXR1cm4gdGFyZ2V0IGluc3RhbmNlb2YgSC5tYXAuTWFya2VyIHx8IHRhcmdldCBpbnN0YW5jZW9mIEgubWFwLkRvbU1hcmtlcjtcclxuICAgIH1cclxuXHJcbiAgICBmdW5jdGlvbiBhZGRVc2VyTWFya2VyKG1hcCwgcGxhY2UpIHtcclxuICAgICAgICBpZihtYXAudXNlck1hcmtlcilcclxuICAgICAgICAgICAgcmV0dXJuIG1hcC51c2VyTWFya2VyO1xyXG4gICAgICAgIFxyXG4gICAgICAgIHBsYWNlLm1hcmt1cCA9ICc8c3ZnIHdpZHRoPVwiMzVweFwiIGhlaWdodD1cIjM1cHhcIiB2aWV3Qm94PVwiMCAwIDkwIDkwXCIgdmVyc2lvbj1cIjEuMVwiIHhtbG5zPVwiaHR0cDovL3d3dy53My5vcmcvMjAwMC9zdmdcIiB4bWxuczp4bGluaz1cImh0dHA6Ly93d3cudzMub3JnLzE5OTkveGxpbmtcIj4nICtcclxuICAgICAgICAgICAgJzxkZWZzPjxjaXJjbGUgaWQ9XCJwYXRoLTFcIiBjeD1cIjMwMlwiIGN5PVwiODAyXCIgcj1cIjE1XCI+PC9jaXJjbGU+JyArXHJcbiAgICAgICAgICAgICc8bWFzayBpZD1cIm1hc2stMlwiIG1hc2tDb250ZW50VW5pdHM9XCJ1c2VyU3BhY2VPblVzZVwiIG1hc2tVbml0cz1cIm9iamVjdEJvdW5kaW5nQm94XCIgeD1cIi0zMFwiIHk9XCItMzBcIiB3aWR0aD1cIjkwXCIgaGVpZ2h0PVwiOTBcIj4nICtcclxuICAgICAgICAgICAgJzxyZWN0IHg9XCIyNTdcIiB5PVwiNzU3XCIgd2lkdGg9XCI5MFwiIGhlaWdodD1cIjkwXCIgZmlsbD1cIndoaXRlXCI+PC9yZWN0Pjx1c2UgeGxpbms6aHJlZj1cIiNwYXRoLTFcIiBmaWxsPVwiYmxhY2tcIj48L3VzZT4nICtcclxuICAgICAgICAgICAgJzwvbWFzaz48L2RlZnM+PGcgaWQ9XCJQYWdlLTFcIiBzdHJva2U9XCJub25lXCIgc3Ryb2tlLXdpZHRoPVwiMVwiIGZpbGw9XCJub25lXCIgZmlsbC1ydWxlPVwiZXZlbm9kZFwiPicgK1xyXG4gICAgICAgICAgICAnPGcgaWQ9XCJTZXJ2aWNlLU9wdGlvbnMtLS1kaXJlY3Rpb25zLS0tbWFwXCIgdHJhbnNmb3JtPVwidHJhbnNsYXRlKC0yNTcuMDAwMDAwLCAtNzU3LjAwMDAwMClcIj48ZyBpZD1cIk92YWwtMTVcIj4nICtcclxuICAgICAgICAgICAgJzx1c2UgZmlsbD1cIiNGRkZGRkZcIiBmaWxsLXJ1bGU9XCJldmVub2RkXCIgeGxpbms6aHJlZj1cIiNwYXRoLTFcIj48L3VzZT4nICtcclxuICAgICAgICAgICAgJzx1c2Ugc3Ryb2tlLW9wYWNpdHk9XCIwLjI5NjEzOTA0XCIgc3Ryb2tlPVwiIzNGMzRBMFwiIG1hc2s9XCJ1cmwoI21hc2stMilcIiBzdHJva2Utd2lkdGg9XCI2MFwiIHhsaW5rOmhyZWY9XCIjcGF0aC0xXCI+PC91c2U+JyArXHJcbiAgICAgICAgICAgICc8dXNlIHN0cm9rZT1cIiMzRjM0QTBcIiBzdHJva2Utd2lkdGg9XCI1XCIgeGxpbms6aHJlZj1cIiNwYXRoLTFcIj48L3VzZT48L2c+PC9nPjwvZz48L3N2Zz4nO1xyXG5cclxuICAgICAgICBtYXAudXNlck1hcmtlciA9IG5ldyBTVkdNYXJrZXIocGxhY2UpLmNyZWF0ZSgpO1xyXG5cclxuICAgICAgICBtYXAuYWRkT2JqZWN0KG1hcC51c2VyTWFya2VyKTtcclxuXHJcbiAgICAgICAgcmV0dXJuIG1hcC51c2VyTWFya2VyO1xyXG4gICAgfVxyXG5cclxuICAgIGZ1bmN0aW9uIGFkZE1hcmtlcnNUb01hcChtYXAsIHBsYWNlcykge1xyXG4gICAgICAgIGlmICghcGxhY2VzIHx8ICFwbGFjZXMubGVuZ3RoKVxyXG4gICAgICAgICAgICByZXR1cm4gZmFsc2U7XHJcblxyXG4gICAgICAgIGlmICghKG1hcCBpbnN0YW5jZW9mIEguTWFwKSlcclxuICAgICAgICAgICAgdGhyb3cgbmV3IEVycm9yKCdVbnN1cHBvcnRlZCBtYXAgaW5zdGFuY2UnKTtcclxuXHJcbiAgICAgICAgaWYgKCFtYXAubWFya2Vyc0dyb3VwKVxyXG4gICAgICAgICAgICBtYXAubWFya2Vyc0dyb3VwID0gbmV3IEgubWFwLkdyb3VwKCk7XHJcblxyXG4gICAgICAgIHBsYWNlcy5mb3JFYWNoKGZ1bmN0aW9uKHBsYWNlLCBpKSB7XHJcbiAgICAgICAgICAgIHZhciBjcmVhdG9yID0gX2dldE1hcmtlckNyZWF0b3IocGxhY2UpLFxyXG4gICAgICAgICAgICAgICAgbWFya2VyID0gcGxhY2UuZHJhZ2dhYmxlID8gX2RyYWdnYWJsZU1hcmtlck1peGluKGNyZWF0b3IuY3JlYXRlKCkpIDogY3JlYXRvci5jcmVhdGUoKTtcclxuXHJcbiAgICAgICAgICAgIG1hcC5tYXJrZXJzR3JvdXAuYWRkT2JqZWN0KG1hcmtlcik7XHJcbiAgICAgICAgfSk7XHJcblxyXG4gICAgICAgIG1hcC5hZGRPYmplY3QobWFwLm1hcmtlcnNHcm91cCk7XHJcbiAgICAgICAgXHJcbiAgICAgICAgbWFwLnNldFZpZXdCb3VuZHMobWFwLm1hcmtlcnNHcm91cC5nZXRCb3VuZHMoKSk7XHJcbiAgICB9XHJcblxyXG4gICAgZnVuY3Rpb24gdXBkYXRlTWFya2VycyhtYXAsIHBsYWNlcykge1xyXG4gICAgICAgIGlmIChtYXAubWFya2Vyc0dyb3VwKSB7XHJcbiAgICAgICAgICAgIG1hcC5tYXJrZXJzR3JvdXAucmVtb3ZlQWxsKCk7XHJcbiAgICAgICAgICAgIG1hcC5yZW1vdmVPYmplY3QobWFwLm1hcmtlcnNHcm91cCk7XHJcbiAgICAgICAgICAgIG1hcC5tYXJrZXJzR3JvdXAgPSBudWxsO1xyXG4gICAgICAgIH1cclxuXHJcbiAgICAgICAgYWRkTWFya2Vyc1RvTWFwLmFwcGx5KG51bGwsIGFyZ3VtZW50cyk7XHJcbiAgICB9XHJcblxyXG4gICAgZnVuY3Rpb24gX2dldE1hcmtlckNyZWF0b3IocGxhY2UpIHtcclxuICAgICAgICB2YXIgQ29uY3JldGVNYXJrZXIsXHJcbiAgICAgICAgICAgIHR5cGUgPSBwbGFjZS50eXBlID8gcGxhY2UudHlwZS50b1VwcGVyQ2FzZSgpIDogbnVsbDtcclxuXHJcbiAgICAgICAgc3dpdGNoICh0eXBlKSB7XHJcbiAgICAgICAgICAgIGNhc2UgTUFSS0VSX1RZUEVTLkRPTTpcclxuICAgICAgICAgICAgICAgIENvbmNyZXRlTWFya2VyID0gRE9NTWFya2VyO1xyXG4gICAgICAgICAgICAgICAgYnJlYWs7XHJcbiAgICAgICAgICAgIGNhc2UgTUFSS0VSX1RZUEVTLlNWRzpcclxuICAgICAgICAgICAgICAgIENvbmNyZXRlTWFya2VyID0gU1ZHTWFya2VyO1xyXG4gICAgICAgICAgICAgICAgYnJlYWs7XHJcbiAgICAgICAgICAgIGRlZmF1bHQ6XHJcbiAgICAgICAgICAgICAgICBDb25jcmV0ZU1hcmtlciA9IERlZmF1bHRNYXJrZXI7XHJcbiAgICAgICAgfVxyXG5cclxuICAgICAgICByZXR1cm4gbmV3IENvbmNyZXRlTWFya2VyKHBsYWNlKTtcclxuICAgIH1cclxuXHJcbiAgICBmdW5jdGlvbiBfZHJhZ2dhYmxlTWFya2VyTWl4aW4obWFya2VyKSB7XHJcbiAgICAgICAgbWFya2VyLmRyYWdnYWJsZSA9IHRydWU7XHJcblxyXG4gICAgICAgIHJldHVybiBtYXJrZXI7XHJcbiAgICB9XHJcblxyXG59OyIsIm1vZHVsZS5leHBvcnRzID0gZnVuY3Rpb24oTWFya2VySW50ZXJmYWNlKXtcclxuICAgIGZ1bmN0aW9uIFNWR01hcmtlcihwbGFjZSl7XHJcbiAgICAgICAgdGhpcy5wbGFjZSA9IHBsYWNlO1xyXG4gICAgICAgIHRoaXMuc2V0Q29vcmRzKCk7XHJcbiAgICB9XHJcbiAgICBcclxuICAgIHZhciBwcm90byA9IFNWR01hcmtlci5wcm90b3R5cGUgPSBuZXcgTWFya2VySW50ZXJmYWNlKCk7XHJcbiAgICBwcm90by5jb25zdHJ1Y3RvciA9IFNWR01hcmtlcjtcclxuICAgIFxyXG4gICAgcHJvdG8uY3JlYXRlID0gY3JlYXRlO1xyXG4gICAgcHJvdG8uZ2V0SWNvbiA9IGdldEljb247XHJcbiAgICBcclxuICAgIHJldHVybiBTVkdNYXJrZXI7XHJcbiAgICBcclxuICAgIGZ1bmN0aW9uIGNyZWF0ZSgpe1xyXG4gICAgICAgIHZhciBtYXJrZXIgPSBuZXcgSC5tYXAuTWFya2VyKHRoaXMuY29vcmRzLCB7XHJcbiAgICAgICAgICAgIGljb246IHRoaXMuZ2V0SWNvbigpLFxyXG4gICAgICAgIH0pO1xyXG4gICAgICAgIFxyXG4gICAgICAgIHRoaXMuYWRkSW5mb0J1YmJsZShtYXJrZXIpO1xyXG4gICAgICAgIFxyXG4gICAgICAgIHJldHVybiBtYXJrZXI7XHJcbiAgICB9XHJcbiAgICBcclxuICAgIGZ1bmN0aW9uIGdldEljb24oKXtcclxuICAgICAgICB2YXIgaWNvbiA9IHRoaXMucGxhY2UubWFya3VwO1xyXG4gICAgICAgICBpZighaWNvbilcclxuICAgICAgICAgICAgdGhyb3cgbmV3IEVycm9yKCdtYXJrdXAgbWlzc2VkJyk7XHJcblxyXG4gICAgICAgIHJldHVybiBuZXcgSC5tYXAuSWNvbihpY29uKTtcclxuICAgIH1cclxufSIsInZhciByb3V0ZXNTZXJ2aWNlID0gcmVxdWlyZSgnLi9yb3V0ZXMuc2VydmljZS5qcycpO1xyXG5cclxuYW5ndWxhci5tb2R1bGUoJ3JvdXRlcy1zZXJ2aWNlJywgW10pLnNlcnZpY2UoJ1JvdXRlc1NlcnZpY2UnLCByb3V0ZXNTZXJ2aWNlKTtcclxuXHJcbnZhciBhcHAgPSBhbmd1bGFyLm1vZHVsZSgncm91dGVzLW1vZHVsZScsIFtcclxuICAgICdyb3V0ZXMtc2VydmljZSdcclxuXSk7XHJcblxyXG5tb2R1bGUuZXhwb3J0cyA9IGFwcDsiLCJtb2R1bGUuZXhwb3J0cyA9IGZ1bmN0aW9uICgkcSkge1xyXG4gICAgcmV0dXJuIHtcclxuICAgICAgICBjYWxjdWxhdGVSb3V0ZTogY2FsY3VsYXRlUm91dGUsXHJcbiAgICAgICAgYWRkUm91dGVUb01hcDogYWRkUm91dGVUb01hcCxcclxuICAgICAgICBjbGVhblJvdXRlczogY2xlYW5Sb3V0ZXNcclxuICAgIH1cclxuXHJcbiAgICBmdW5jdGlvbiBjYWxjdWxhdGVSb3V0ZShoZXJlbWFwcywgY29uZmlnKSB7XHJcbiAgICAgICAgdmFyIHBsYXRmb3JtID0gaGVyZW1hcHMucGxhdGZvcm0sXHJcbiAgICAgICAgICAgIG1hcCA9IGhlcmVtYXBzLm1hcCxcclxuICAgICAgICAgICAgcm91dGVyID0gcGxhdGZvcm0uZ2V0Um91dGluZ1NlcnZpY2UoKSxcclxuICAgICAgICAgICAgZGlyID0gY29uZmlnLmRpcmVjdGlvbjtcclxuXHJcbiAgICAgICAgdmFyIG1vZGUgPSAne3tNT0RFfX07e3tWRUNISUxFfX0nXHJcbiAgICAgICAgICAgIC5yZXBsYWNlKC97e01PREV9fS8sIGRpci5tb2RlKVxyXG4gICAgICAgICAgICAucmVwbGFjZSgve3tWRUNISUxFfX0vLCBjb25maWcuZHJpdmVUeXBlKTtcclxuXHJcbiAgICAgICAgdmFyIHJvdXRlUmVxdWVzdFBhcmFtcyA9IHtcclxuICAgICAgICAgICAgbW9kZTogbW9kZSxcclxuICAgICAgICAgICAgcmVwcmVzZW50YXRpb246IGRpci5yZXByZXNlbnRhdGlvbiB8fCAnZGlzcGxheScsXHJcbiAgICAgICAgICAgIHdheXBvaW50MDogW2Rpci5mcm9tLmxhdCwgZGlyLmZyb20ubG5nXS5qb2luKCcsJyksXHJcbiAgICAgICAgICAgIHdheXBvaW50MTogW2Rpci50by5sYXQsIGRpci50by5sbmddLmpvaW4oJywnKSxcclxuICAgICAgICAgICAgbGFuZ3VhZ2U6IGRpci5sYW5ndWFnZSB8fCAnZW4tZ2InXHJcbiAgICAgICAgfTtcclxuXHJcbiAgICAgICAgX3NldEF0dHJpYnV0ZXMocm91dGVSZXF1ZXN0UGFyYW1zLCBkaXIuYXR0cnMpO1xyXG5cclxuICAgICAgICB2YXIgZGVmZXJyZWQgPSAkcS5kZWZlcigpO1xyXG5cclxuICAgICAgICByb3V0ZXIuY2FsY3VsYXRlUm91dGUocm91dGVSZXF1ZXN0UGFyYW1zLCBmdW5jdGlvbiAocmVzdWx0KSB7XHJcbiAgICAgICAgICAgIGRlZmVycmVkLnJlc29sdmUocmVzdWx0KTtcclxuICAgICAgICB9LCBmdW5jdGlvbiAoZXJyb3IpIHtcclxuICAgICAgICAgICAgZGVmZXJyZWQucmVqZWN0KGVycm9yKTtcclxuICAgICAgICB9KTtcclxuXHJcbiAgICAgICAgcmV0dXJuIGRlZmVycmVkLnByb21pc2U7XHJcbiAgICB9XHJcbiAgICBcclxuICAgIGZ1bmN0aW9uIGNsZWFuUm91dGVzKG1hcCl7XHJcbiAgICAgICAgdmFyIGdyb3VwID0gbWFwLnJvdXRlc0dyb3VwO1xyXG4gICAgICAgICBcclxuICAgICAgICBpZighZ3JvdXApXHJcbiAgICAgICAgICAgIHJldHVybjtcclxuICAgICAgICAgICAgXHJcbiAgICAgICAgZ3JvdXAucmVtb3ZlQWxsKCk7XHJcbiAgICAgICAgbWFwLnJlbW92ZU9iamVjdChncm91cCk7XHJcbiAgICAgICAgbWFwLnJvdXRlc0dyb3VwID0gbnVsbDtcclxuICAgIH1cclxuICAgIFxyXG4gICAgZnVuY3Rpb24gYWRkUm91dGVUb01hcChtYXAsIHJvdXRlRGF0YSwgY2xlYW4pIHtcclxuICAgICAgICBpZihjbGVhbilcclxuICAgICAgICAgICBjbGVhblJvdXRlcyhtYXApO1xyXG4gICAgICAgICAgIFxyXG4gICAgICAgIHZhciByb3V0ZSA9IHJvdXRlRGF0YS5yb3V0ZTtcclxuICAgICAgICBcclxuICAgICAgICBpZiAoIW1hcCB8fCAhcm91dGUgfHwgIXJvdXRlLnNoYXBlKVxyXG4gICAgICAgICAgICByZXR1cm47XHJcblxyXG4gICAgICAgIHZhciBzdHJpcCA9IG5ldyBILmdlby5TdHJpcCgpLCBwb2x5bGluZSA9IG51bGw7XHJcblxyXG4gICAgICAgIHJvdXRlLnNoYXBlLmZvckVhY2goZnVuY3Rpb24gKHBvaW50KSB7XHJcbiAgICAgICAgICAgIHZhciBwYXJ0cyA9IHBvaW50LnNwbGl0KCcsJyk7XHJcbiAgICAgICAgICAgIHN0cmlwLnB1c2hMYXRMbmdBbHQocGFydHNbMF0sIHBhcnRzWzFdKTtcclxuICAgICAgICB9KTtcclxuICAgICAgICBcclxuICAgICAgICB2YXIgc3R5bGUgPSByb3V0ZURhdGEuc3R5bGU7XHJcblxyXG4gICAgICAgIHBvbHlsaW5lID0gbmV3IEgubWFwLlBvbHlsaW5lKHN0cmlwLCB7XHJcbiAgICAgICAgICAgIHN0eWxlOiB7XHJcbiAgICAgICAgICAgICAgICBsaW5lV2lkdGg6IHN0eWxlLmxpbmVXaWR0aCB8fCA0LFxyXG4gICAgICAgICAgICAgICAgc3Ryb2tlQ29sb3I6IHN0eWxlLiBjb2xvciB8fCAncmdiYSgwLCAxMjgsIDI1NSwgMC43KSdcclxuICAgICAgICAgICAgfVxyXG4gICAgICAgIH0pO1xyXG4gICAgICAgIFxyXG4gICAgICAgIHZhciBncm91cCA9IG1hcC5yb3V0ZXNHcm91cDtcclxuICAgICAgICAgXHJcbiAgICAgICAgaWYoIWdyb3VwKSB7XHJcbiAgICAgICAgICAgIGdyb3VwID0gbWFwLnJvdXRlc0dyb3VwID0gbmV3IEgubWFwLkdyb3VwKCk7XHJcbiAgICAgICAgICAgIG1hcC5hZGRPYmplY3QoZ3JvdXApO1xyXG4gICAgICAgIH1cclxuICAgICAgICBcclxuICAgICAgICBncm91cC5hZGRPYmplY3QocG9seWxpbmUpO1xyXG4gICAgICAgIFxyXG4gICAgICAgIG1hcC5zZXRWaWV3Qm91bmRzKHBvbHlsaW5lLmdldEJvdW5kcygpLCB0cnVlKTtcclxuICAgIH1cclxuXHJcbiAgICAvLyNyZWdpb24gUFJJVkFURVxyXG5cclxuICAgIGZ1bmN0aW9uIF9zZXRBdHRyaWJ1dGVzKHBhcmFtcywgYXR0cnMpIHtcclxuICAgICAgICB2YXIgX2tleSA9ICdhdHRyaWJ1dGVzJztcclxuICAgICAgICBmb3IgKHZhciBrZXkgaW4gYXR0cnMpIHtcclxuICAgICAgICAgICAgaWYgKCFhdHRycy5oYXNPd25Qcm9wZXJ0eShrZXkpKVxyXG4gICAgICAgICAgICAgICAgY29udGludWU7XHJcblxyXG4gICAgICAgICAgICBwYXJhbXNba2V5ICsgX2tleV0gPSBhdHRyc1trZXldO1xyXG4gICAgICAgIH1cclxuICAgIH1cclxuXHJcbiAgICBmdW5jdGlvbiBfb25Sb3V0ZVN1Y2Nlc3MocmVzdWx0KSB7XHJcbiAgICAgICAgY29uc29sZS5sb2cocmVzdWx0KVxyXG4gICAgfVxyXG5cclxuICAgIGZ1bmN0aW9uIF9vblJvdXRlRmFpbHVyZShlcnJvcikge1xyXG4gICAgICAgIGNvbnNvbGUubG9nKCdDYWxjdWxhdGUgcm91dGUgZmFpbHVyZScsIGVycm9yKTtcclxuICAgIH1cclxuXHJcbiAgICAvKipcclxuICAgICAqIENyZWF0ZXMgYSBzZXJpZXMgb2YgSC5tYXAuTWFya2VyIHBvaW50cyBmcm9tIHRoZSByb3V0ZSBhbmQgYWRkcyB0aGVtIHRvIHRoZSBtYXAuXHJcbiAgICAgKiBAcGFyYW0ge09iamVjdH0gcm91dGUgIEEgcm91dGUgYXMgcmVjZWl2ZWQgZnJvbSB0aGUgSC5zZXJ2aWNlLlJvdXRpbmdTZXJ2aWNlXHJcbiAgICAgKi9cclxuICAgIGZ1bmN0aW9uIGFkZE1hbnVldmVyc1RvTWFwKG1hcCwgcm91dGUpIHtcclxuICAgICAgICB2YXIgc3ZnTWFya3VwID0gJzxzdmcgd2lkdGg9XCIxOFwiIGhlaWdodD1cIjE4XCIgJyArXHJcbiAgICAgICAgICAgICd4bWxucz1cImh0dHA6Ly93d3cudzMub3JnLzIwMDAvc3ZnXCI+JyArXHJcbiAgICAgICAgICAgICc8Y2lyY2xlIGN4PVwiOFwiIGN5PVwiOFwiIHI9XCI4XCIgJyArXHJcbiAgICAgICAgICAgICdmaWxsPVwiIzFiNDY4ZFwiIHN0cm9rZT1cIndoaXRlXCIgc3Ryb2tlLXdpZHRoPVwiMVwiICAvPicgK1xyXG4gICAgICAgICAgICAnPC9zdmc+JyxcclxuICAgICAgICAgICAgZG90SWNvbiA9IG5ldyBILm1hcC5JY29uKHN2Z01hcmt1cCwgeyBhbmNob3I6IHsgeDogOCwgeTogOCB9IH0pLFxyXG4gICAgICAgICAgICBncm91cCA9IG5ldyBILm1hcC5Hcm91cCgpLFxyXG4gICAgICAgICAgICBpLFxyXG4gICAgICAgICAgICBqO1xyXG5cclxuICAgICAgICAvLyBBZGQgYSBtYXJrZXIgZm9yIGVhY2ggbWFuZXV2ZXJcclxuICAgICAgICBmb3IgKGkgPSAwOyBpIDwgcm91dGUubGVnLmxlbmd0aDsgaSArPSAxKSB7XHJcbiAgICAgICAgICAgIGZvciAoaiA9IDA7IGogPCByb3V0ZS5sZWdbaV0ubWFuZXV2ZXIubGVuZ3RoOyBqICs9IDEpIHtcclxuICAgICAgICAgICAgICAgIC8vIEdldCB0aGUgbmV4dCBtYW5ldXZlci5cclxuICAgICAgICAgICAgICAgIG1hbmV1dmVyID0gcm91dGUubGVnW2ldLm1hbmV1dmVyW2pdO1xyXG4gICAgICAgICAgICAgICAgLy8gQWRkIGEgbWFya2VyIHRvIHRoZSBtYW5ldXZlcnMgZ3JvdXBcclxuICAgICAgICAgICAgICAgIHZhciBtYXJrZXIgPSBuZXcgSC5tYXAuTWFya2VyKHtcclxuICAgICAgICAgICAgICAgICAgICBsYXQ6IG1hbmV1dmVyLnBvc2l0aW9uLmxhdGl0dWRlLFxyXG4gICAgICAgICAgICAgICAgICAgIGxuZzogbWFuZXV2ZXIucG9zaXRpb24ubG9uZ2l0dWRlXHJcbiAgICAgICAgICAgICAgICB9LFxyXG4gICAgICAgICAgICAgICAgICAgIHsgaWNvbjogZG90SWNvbiB9XHJcbiAgICAgICAgICAgICAgICApO1xyXG5cclxuICAgICAgICAgICAgICAgIG1hcmtlci5pbnN0cnVjdGlvbiA9IG1hbmV1dmVyLmluc3RydWN0aW9uO1xyXG4gICAgICAgICAgICAgICAgZ3JvdXAuYWRkT2JqZWN0KG1hcmtlcik7XHJcbiAgICAgICAgICAgIH1cclxuICAgICAgICB9XHJcblxyXG4gICAgICAgIGdyb3VwLmFkZEV2ZW50TGlzdGVuZXIoJ3RhcCcsIGZ1bmN0aW9uIChldnQpIHtcclxuICAgICAgICAgICAgbWFwLnNldENlbnRlcihldnQudGFyZ2V0LmdldFBvc2l0aW9uKCkpO1xyXG4gICAgICAgICAgICBvcGVuQnViYmxlKGV2dC50YXJnZXQuZ2V0UG9zaXRpb24oKSwgZXZ0LnRhcmdldC5pbnN0cnVjdGlvbik7XHJcbiAgICAgICAgfSwgZmFsc2UpO1xyXG5cclxuICAgICAgICAvLyBBZGQgdGhlIG1hbmV1dmVycyBncm91cCB0byB0aGUgbWFwXHJcbiAgICAgICAgbWFwLmFkZE9iamVjdChncm91cCk7XHJcbiAgICB9XHJcblxyXG5cclxuICAgIC8qKlxyXG4gICAgICogQ3JlYXRlcyBhIHNlcmllcyBvZiBILm1hcC5NYXJrZXIgcG9pbnRzIGZyb20gdGhlIHJvdXRlIGFuZCBhZGRzIHRoZW0gdG8gdGhlIG1hcC5cclxuICAgICAqIEBwYXJhbSB7T2JqZWN0fSByb3V0ZSAgQSByb3V0ZSBhcyByZWNlaXZlZCBmcm9tIHRoZSBILnNlcnZpY2UuUm91dGluZ1NlcnZpY2VcclxuICAgICAqL1xyXG4gICAgZnVuY3Rpb24gYWRkV2F5cG9pbnRzVG9QYW5lbCh3YXlwb2ludHMpIHtcclxuICAgICAgICB2YXIgbm9kZUgzID0gZG9jdW1lbnQuY3JlYXRlRWxlbWVudCgnaDMnKSxcclxuICAgICAgICAgICAgd2F5cG9pbnRMYWJlbHMgPSBbXSxcclxuICAgICAgICAgICAgaTtcclxuXHJcbiAgICAgICAgZm9yIChpID0gMDsgaSA8IHdheXBvaW50cy5sZW5ndGg7IGkgKz0gMSkge1xyXG4gICAgICAgICAgICB3YXlwb2ludExhYmVscy5wdXNoKHdheXBvaW50c1tpXS5sYWJlbClcclxuICAgICAgICB9XHJcblxyXG4gICAgICAgIG5vZGVIMy50ZXh0Q29udGVudCA9IHdheXBvaW50TGFiZWxzLmpvaW4oJyAtICcpO1xyXG5cclxuICAgICAgICByb3V0ZUluc3RydWN0aW9uc0NvbnRhaW5lci5pbm5lckhUTUwgPSAnJztcclxuICAgICAgICByb3V0ZUluc3RydWN0aW9uc0NvbnRhaW5lci5hcHBlbmRDaGlsZChub2RlSDMpO1xyXG4gICAgfVxyXG5cclxuICAgIC8qKlxyXG4gICAgICogQ3JlYXRlcyBhIHNlcmllcyBvZiBILm1hcC5NYXJrZXIgcG9pbnRzIGZyb20gdGhlIHJvdXRlIGFuZCBhZGRzIHRoZW0gdG8gdGhlIG1hcC5cclxuICAgICAqIEBwYXJhbSB7T2JqZWN0fSByb3V0ZSAgQSByb3V0ZSBhcyByZWNlaXZlZCBmcm9tIHRoZSBILnNlcnZpY2UuUm91dGluZ1NlcnZpY2VcclxuICAgICAqL1xyXG4gICAgZnVuY3Rpb24gYWRkU3VtbWFyeVRvUGFuZWwoc3VtbWFyeSkge1xyXG4gICAgICAgIHZhciBzdW1tYXJ5RGl2ID0gZG9jdW1lbnQuY3JlYXRlRWxlbWVudCgnZGl2JyksXHJcbiAgICAgICAgICAgIGNvbnRlbnQgPSAnJztcclxuXHJcbiAgICAgICAgY29udGVudCArPSAnPGI+VG90YWwgZGlzdGFuY2U8L2I+OiAnICsgc3VtbWFyeS5kaXN0YW5jZSArICdtLiA8YnIvPic7XHJcbiAgICAgICAgY29udGVudCArPSAnPGI+VHJhdmVsIFRpbWU8L2I+OiAnICsgc3VtbWFyeS50cmF2ZWxUaW1lLnRvTU1TUygpICsgJyAoaW4gY3VycmVudCB0cmFmZmljKSc7XHJcblxyXG5cclxuICAgICAgICBzdW1tYXJ5RGl2LnN0eWxlLmZvbnRTaXplID0gJ3NtYWxsJztcclxuICAgICAgICBzdW1tYXJ5RGl2LnN0eWxlLm1hcmdpbkxlZnQgPSAnNSUnO1xyXG4gICAgICAgIHN1bW1hcnlEaXYuc3R5bGUubWFyZ2luUmlnaHQgPSAnNSUnO1xyXG4gICAgICAgIHN1bW1hcnlEaXYuaW5uZXJIVE1MID0gY29udGVudDtcclxuICAgICAgICByb3V0ZUluc3RydWN0aW9uc0NvbnRhaW5lci5hcHBlbmRDaGlsZChzdW1tYXJ5RGl2KTtcclxuICAgIH1cclxuXHJcbiAgICAvKipcclxuICAgICAqIENyZWF0ZXMgYSBzZXJpZXMgb2YgSC5tYXAuTWFya2VyIHBvaW50cyBmcm9tIHRoZSByb3V0ZSBhbmQgYWRkcyB0aGVtIHRvIHRoZSBtYXAuXHJcbiAgICAgKiBAcGFyYW0ge09iamVjdH0gcm91dGUgIEEgcm91dGUgYXMgcmVjZWl2ZWQgZnJvbSB0aGUgSC5zZXJ2aWNlLlJvdXRpbmdTZXJ2aWNlXHJcbiAgICAgKi9cclxuICAgIGZ1bmN0aW9uIGFkZE1hbnVldmVyc1RvUGFuZWwocm91dGUpIHtcclxuICAgICAgICB2YXIgbm9kZU9MID0gZG9jdW1lbnQuY3JlYXRlRWxlbWVudCgnb2wnKSwgaSwgajtcclxuXHJcbiAgICAgICAgbm9kZU9MLnN0eWxlLmZvbnRTaXplID0gJ3NtYWxsJztcclxuICAgICAgICBub2RlT0wuc3R5bGUubWFyZ2luTGVmdCA9ICc1JSc7XHJcbiAgICAgICAgbm9kZU9MLnN0eWxlLm1hcmdpblJpZ2h0ID0gJzUlJztcclxuICAgICAgICBub2RlT0wuY2xhc3NOYW1lID0gJ2RpcmVjdGlvbnMnO1xyXG5cclxuICAgICAgICAvLyBBZGQgYSBtYXJrZXIgZm9yIGVhY2ggbWFuZXV2ZXJcclxuICAgICAgICBmb3IgKGkgPSAwOyBpIDwgcm91dGUubGVnLmxlbmd0aDsgaSArPSAxKSB7XHJcbiAgICAgICAgICAgIGZvciAoaiA9IDA7IGogPCByb3V0ZS5sZWdbaV0ubWFuZXV2ZXIubGVuZ3RoOyBqICs9IDEpIHtcclxuICAgICAgICAgICAgICAgIC8vIEdldCB0aGUgbmV4dCBtYW5ldXZlci5cclxuICAgICAgICAgICAgICAgIG1hbmV1dmVyID0gcm91dGUubGVnW2ldLm1hbmV1dmVyW2pdO1xyXG5cclxuICAgICAgICAgICAgICAgIHZhciBsaSA9IGRvY3VtZW50LmNyZWF0ZUVsZW1lbnQoJ2xpJyksXHJcbiAgICAgICAgICAgICAgICAgICAgc3BhbkFycm93ID0gZG9jdW1lbnQuY3JlYXRlRWxlbWVudCgnc3BhbicpLFxyXG4gICAgICAgICAgICAgICAgICAgIHNwYW5JbnN0cnVjdGlvbiA9IGRvY3VtZW50LmNyZWF0ZUVsZW1lbnQoJ3NwYW4nKTtcclxuXHJcbiAgICAgICAgICAgICAgICBzcGFuQXJyb3cuY2xhc3NOYW1lID0gJ2Fycm93ICcgKyBtYW5ldXZlci5hY3Rpb247XHJcbiAgICAgICAgICAgICAgICBzcGFuSW5zdHJ1Y3Rpb24uaW5uZXJIVE1MID0gbWFuZXV2ZXIuaW5zdHJ1Y3Rpb247XHJcbiAgICAgICAgICAgICAgICBsaS5hcHBlbmRDaGlsZChzcGFuQXJyb3cpO1xyXG4gICAgICAgICAgICAgICAgbGkuYXBwZW5kQ2hpbGQoc3Bhbkluc3RydWN0aW9uKTtcclxuXHJcbiAgICAgICAgICAgICAgICBub2RlT0wuYXBwZW5kQ2hpbGQobGkpO1xyXG4gICAgICAgICAgICB9XHJcbiAgICAgICAgfVxyXG5cclxuICAgICAgICByb3V0ZUluc3RydWN0aW9uc0NvbnRhaW5lci5hcHBlbmRDaGlsZChub2RlT0wpO1xyXG4gICAgfVxyXG5cclxufTsiXX0=
