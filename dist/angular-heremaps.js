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
        
    HereMapsDirectiveCtrl.$inject = ['$scope', '$element', '$attrs'];
        
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
        controller: HereMapsDirectiveCtrl
    }
    
    function HereMapsDirectiveCtrl($scope, $element, $attrs) {
        var CONTROL_NAMES = CONSTS.CONTROLS.NAMES,
            places = $scope.places(),
            opts = $scope.opts(),
            listeners = $scope.events();

        var options = angular.extend({}, CONSTS.DEFAULT_MAP_OPTIONS, opts),
            position = HereMapUtilsService.isValidCoords(options.coords) ? options.coords : CONSTS.DEFAULT_MAP_OPTIONS.coords;

        var heremaps = { id: HereMapUtilsService.generateId() },
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

        function _resizeHandler(height, width) {
            _setMapSize.apply(null, arguments);

            heremaps.map.getViewPort().resize();
        }

        function _setMapSize(height, width) {
            var height = height || $element[0].parentNode.offsetHeight || options.height,
                width = width || $element[0].parentNode.offsetWidth || options.width;

            $scope.mapHeight = height + 'px';
            $scope.mapWidth = width + 'px';
            
            HereMapUtilsService.runScopeDigestIfNeed($scope);
        }

        function MapProxy() {
            return {
                refresh: function(){
                    var currentBounds = this.getViewBounds();
                    
                    this.setMapSizes();
                    this.setViewBounds(currentBounds);
                },
                setMapSizes: function(height, width){
                    console.log($element[0].parentNode.offsetHeight)
                    _resizeHandler.apply(null, arguments);
                },
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
                getZoom: function(){
                    return heremaps.map.getZoom();  
                },
                getCenter: function(){
                    return heremaps.map.getCenter();  
                },
                getViewBounds: function(){
                    return heremaps.map.getViewBounds();   
                },
                setViewBounds: function(boundingRect, opt_animate){
                    heremaps.map.setViewBounds(boundingRect, opt_animate);
                },
                setCenter: function (coords) {
                    if (!coords) {
                        return console.error('coords are not specified!');
                    }

                    heremaps.map.setCenter(coords);
                },
                cleanRoutes: function () {
                    RoutesService.cleanRoutes(heremaps.map);
                },

                /**
                 * @param {Boolean} enableHighAccuracy
                 * @param {Number} maximumAge - the maximum age in milliseconds of a possible cached position that is acceptable to return. If set to 0, it means that the device cannot use a cached position and must attempt to retrieve the real current position
                 * @return {Promise}
                 */
                getUserLocation: function (enableHighAccuracy, maximumAge) {
                    return _getLocation.apply(null, arguments).then(function (position) {
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
            useHTTPS: options.useHTTPS,
            useCIT: !!options.useCIT
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
            return;

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
//# sourceMappingURL=data:application/json;charset=utf-8;base64,eyJ2ZXJzaW9uIjozLCJzb3VyY2VzIjpbIm5vZGVfbW9kdWxlcy9icm93c2VyLXBhY2svX3ByZWx1ZGUuanMiLCJzcmMvaGVyZW1hcHMuZGlyZWN0aXZlLmpzIiwic3JjL2luZGV4LmpzIiwic3JjL3Byb3ZpZGVycy9hcGkuc2VydmljZS5qcyIsInNyYy9wcm92aWRlcnMvY29uc3RzLmpzIiwic3JjL3Byb3ZpZGVycy9tYXAtbW9kdWxlcy9ldmVudHMvZXZlbnRzLmpzIiwic3JjL3Byb3ZpZGVycy9tYXAtbW9kdWxlcy9ldmVudHMvaW5mb2J1YmJsZS5qcyIsInNyYy9wcm92aWRlcnMvbWFwLW1vZHVsZXMvaW5kZXguanMiLCJzcmMvcHJvdmlkZXJzL21hcC1tb2R1bGVzL3VpL3VpLmpzIiwic3JjL3Byb3ZpZGVycy9tYXBjb25maWcucHJvdmlkZXIuanMiLCJzcmMvcHJvdmlkZXJzL21hcHV0aWxzLnNlcnZpY2UuanMiLCJzcmMvcHJvdmlkZXJzL21hcmtlcnMvZGVmYXVsdC5tYXJrZXIuanMiLCJzcmMvcHJvdmlkZXJzL21hcmtlcnMvZG9tLm1hcmtlci5qcyIsInNyYy9wcm92aWRlcnMvbWFya2Vycy9pbmRleC5qcyIsInNyYy9wcm92aWRlcnMvbWFya2Vycy9tYXJrZXIuanMiLCJzcmMvcHJvdmlkZXJzL21hcmtlcnMvbWFya2Vycy5zZXJ2aWNlLmpzIiwic3JjL3Byb3ZpZGVycy9tYXJrZXJzL3N2Zy5tYXJrZXIuanMiLCJzcmMvcHJvdmlkZXJzL3JvdXRlcy9pbmRleC5qcyIsInNyYy9wcm92aWRlcnMvcm91dGVzL3JvdXRlcy5zZXJ2aWNlLmpzIl0sIm5hbWVzIjpbXSwibWFwcGluZ3MiOiJBQUFBO0FDQUE7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7O0FDMU9BO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBOztBQ3hCQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBOztBQzNPQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7O0FDakVBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBOztBQzFGQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTs7QUNwRkE7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBOztBQ2pCQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7O0FDNUZBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTs7QUNqQkE7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBOztBQ3BIQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7O0FDcEJBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7O0FDM0NBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBOztBQ3JCQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBOztBQ2xDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7O0FDNUZBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7O0FDL0JBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTs7QUNSQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0EiLCJmaWxlIjoiZ2VuZXJhdGVkLmpzIiwic291cmNlUm9vdCI6IiIsInNvdXJjZXNDb250ZW50IjpbIihmdW5jdGlvbiBlKHQsbixyKXtmdW5jdGlvbiBzKG8sdSl7aWYoIW5bb10pe2lmKCF0W29dKXt2YXIgYT10eXBlb2YgcmVxdWlyZT09XCJmdW5jdGlvblwiJiZyZXF1aXJlO2lmKCF1JiZhKXJldHVybiBhKG8sITApO2lmKGkpcmV0dXJuIGkobywhMCk7dmFyIGY9bmV3IEVycm9yKFwiQ2Fubm90IGZpbmQgbW9kdWxlICdcIitvK1wiJ1wiKTt0aHJvdyBmLmNvZGU9XCJNT0RVTEVfTk9UX0ZPVU5EXCIsZn12YXIgbD1uW29dPXtleHBvcnRzOnt9fTt0W29dWzBdLmNhbGwobC5leHBvcnRzLGZ1bmN0aW9uKGUpe3ZhciBuPXRbb11bMV1bZV07cmV0dXJuIHMobj9uOmUpfSxsLGwuZXhwb3J0cyxlLHQsbixyKX1yZXR1cm4gbltvXS5leHBvcnRzfXZhciBpPXR5cGVvZiByZXF1aXJlPT1cImZ1bmN0aW9uXCImJnJlcXVpcmU7Zm9yKHZhciBvPTA7bzxyLmxlbmd0aDtvKyspcyhyW29dKTtyZXR1cm4gc30pIiwiLyoqXHJcbiAqIENyZWF0ZWQgYnkgRG15dHJvIG9uIDQvMTEvMjAxNi5cclxuICovXHJcbm1vZHVsZS5leHBvcnRzID0gZnVuY3Rpb24gKFxyXG4gICAgJHRpbWVvdXQsXHJcbiAgICAkd2luZG93LFxyXG4gICAgJHJvb3RTY29wZSxcclxuICAgICRmaWx0ZXIsXHJcbiAgICBIZXJlTWFwc0NvbmZpZyxcclxuICAgIEFQSVNlcnZpY2UsXHJcbiAgICBIZXJlTWFwVXRpbHNTZXJ2aWNlLFxyXG4gICAgTWFya2Vyc1NlcnZpY2UsXHJcbiAgICBSb3V0ZXNTZXJ2aWNlLFxyXG4gICAgQ09OU1RTLFxyXG4gICAgRXZlbnRzTW9kdWxlLFxyXG4gICAgVUlNb2R1bGUpIHtcclxuICAgICAgICBcclxuICAgIEhlcmVNYXBzRGlyZWN0aXZlQ3RybC4kaW5qZWN0ID0gWyckc2NvcGUnLCAnJGVsZW1lbnQnLCAnJGF0dHJzJ107XHJcbiAgICAgICAgXHJcbiAgICByZXR1cm4ge1xyXG4gICAgICAgIHJlc3RyaWN0OiAnRUEnLFxyXG4gICAgICAgIHRlbXBsYXRlOiBcIjxkaXYgbmctc3R5bGU9XFxcInsnd2lkdGgnOiBtYXBXaWR0aCwgJ2hlaWdodCc6IG1hcEhlaWdodH1cXFwiPjwvZGl2PlwiLFxyXG4gICAgICAgIHJlcGxhY2U6IHRydWUsXHJcbiAgICAgICAgc2NvcGU6IHtcclxuICAgICAgICAgICAgb3B0czogJyZvcHRpb25zJyxcclxuICAgICAgICAgICAgcGxhY2VzOiAnJicsXHJcbiAgICAgICAgICAgIG9uTWFwUmVhZHk6IFwiJm1hcFJlYWR5XCIsXHJcbiAgICAgICAgICAgIGV2ZW50czogJyYnXHJcbiAgICAgICAgfSxcclxuICAgICAgICBjb250cm9sbGVyOiBIZXJlTWFwc0RpcmVjdGl2ZUN0cmxcclxuICAgIH1cclxuICAgIFxyXG4gICAgZnVuY3Rpb24gSGVyZU1hcHNEaXJlY3RpdmVDdHJsKCRzY29wZSwgJGVsZW1lbnQsICRhdHRycykge1xyXG4gICAgICAgIHZhciBDT05UUk9MX05BTUVTID0gQ09OU1RTLkNPTlRST0xTLk5BTUVTLFxyXG4gICAgICAgICAgICBwbGFjZXMgPSAkc2NvcGUucGxhY2VzKCksXHJcbiAgICAgICAgICAgIG9wdHMgPSAkc2NvcGUub3B0cygpLFxyXG4gICAgICAgICAgICBsaXN0ZW5lcnMgPSAkc2NvcGUuZXZlbnRzKCk7XHJcblxyXG4gICAgICAgIHZhciBvcHRpb25zID0gYW5ndWxhci5leHRlbmQoe30sIENPTlNUUy5ERUZBVUxUX01BUF9PUFRJT05TLCBvcHRzKSxcclxuICAgICAgICAgICAgcG9zaXRpb24gPSBIZXJlTWFwVXRpbHNTZXJ2aWNlLmlzVmFsaWRDb29yZHMob3B0aW9ucy5jb29yZHMpID8gb3B0aW9ucy5jb29yZHMgOiBDT05TVFMuREVGQVVMVF9NQVBfT1BUSU9OUy5jb29yZHM7XHJcblxyXG4gICAgICAgIHZhciBoZXJlbWFwcyA9IHsgaWQ6IEhlcmVNYXBVdGlsc1NlcnZpY2UuZ2VuZXJhdGVJZCgpIH0sXHJcbiAgICAgICAgICAgIG1hcFJlYWR5ID0gJHNjb3BlLm9uTWFwUmVhZHkoKSxcclxuICAgICAgICAgICAgX29uUmVzaXplTWFwID0gbnVsbDtcclxuXHJcbiAgICAgICAgJHRpbWVvdXQoZnVuY3Rpb24gKCkge1xyXG4gICAgICAgICAgICByZXR1cm4gX3NldE1hcFNpemUoKTtcclxuICAgICAgICB9KS50aGVuKGZ1bmN0aW9uICgpIHtcclxuICAgICAgICAgICAgQVBJU2VydmljZS5sb2FkQXBpKCkudGhlbihfYXBpUmVhZHkpO1xyXG4gICAgICAgIH0pO1xyXG5cclxuICAgICAgICBvcHRpb25zLnJlc2l6ZSAmJiBhZGRPblJlc2l6ZUxpc3RlbmVyKCk7XHJcblxyXG4gICAgICAgICRzY29wZS4kb24oJyRkZXN0cm95JywgZnVuY3Rpb24gKCkge1xyXG4gICAgICAgICAgICAkd2luZG93LnJlbW92ZUV2ZW50TGlzdGVuZXIoJ3Jlc2l6ZScsIF9vblJlc2l6ZU1hcCk7XHJcbiAgICAgICAgfSk7XHJcblxyXG4gICAgICAgIGZ1bmN0aW9uIGFkZE9uUmVzaXplTGlzdGVuZXIoKSB7XHJcbiAgICAgICAgICAgIF9vblJlc2l6ZU1hcCA9IEhlcmVNYXBVdGlsc1NlcnZpY2UudGhyb3R0bGUoX3Jlc2l6ZUhhbmRsZXIsIENPTlNUUy5VUERBVEVfTUFQX1JFU0laRV9USU1FT1VUKTtcclxuICAgICAgICAgICAgJHdpbmRvdy5hZGRFdmVudExpc3RlbmVyKCdyZXNpemUnLCBfb25SZXNpemVNYXApO1xyXG4gICAgICAgIH1cclxuXHJcbiAgICAgICAgZnVuY3Rpb24gX2FwaVJlYWR5KCkge1xyXG4gICAgICAgICAgICBfc2V0dXBNYXBQbGF0Zm9ybSgpO1xyXG4gICAgICAgICAgICBfc2V0dXBNYXAoKTtcclxuICAgICAgICB9XHJcblxyXG4gICAgICAgIGZ1bmN0aW9uIF9zZXR1cE1hcFBsYXRmb3JtKCkge1xyXG4gICAgICAgICAgICBpZiAoIUhlcmVNYXBzQ29uZmlnLmFwcF9pZCB8fCAhSGVyZU1hcHNDb25maWcuYXBwX2NvZGUpXHJcbiAgICAgICAgICAgICAgICB0aHJvdyBuZXcgRXJyb3IoJ2FwcF9pZCBvciBhcHBfY29kZSB3ZXJlIG1pc3NlZC4gUGxlYXNlIHNwZWNpZnkgdGhlaXIgaW4gSGVyZU1hcHNDb25maWcnKTtcclxuICAgICAgICAgICAgXHJcbiAgICAgICAgICAgIGhlcmVtYXBzLnBsYXRmb3JtID0gbmV3IEguc2VydmljZS5QbGF0Zm9ybShIZXJlTWFwc0NvbmZpZyk7XHJcbiAgICAgICAgICAgIGhlcmVtYXBzLmxheWVycyA9IGhlcmVtYXBzLnBsYXRmb3JtLmNyZWF0ZURlZmF1bHRMYXllcnMoKTtcclxuICAgICAgICB9XHJcblxyXG4gICAgICAgIGZ1bmN0aW9uIF9nZXRMb2NhdGlvbihlbmFibGVIaWdoQWNjdXJhY3ksIG1heGltdW1BZ2UpIHtcclxuICAgICAgICAgICAgdmFyIF9lbmFibGVIaWdoQWNjdXJhY3kgPSAhIWVuYWJsZUhpZ2hBY2N1cmFjeSxcclxuICAgICAgICAgICAgICAgIF9tYXhpbXVtQWdlID0gbWF4aW11bUFnZSB8fCAwO1xyXG5cclxuICAgICAgICAgICAgcmV0dXJuIEFQSVNlcnZpY2UuZ2V0UG9zaXRpb24oe1xyXG4gICAgICAgICAgICAgICAgZW5hYmxlSGlnaEFjY3VyYWN5OiBfZW5hYmxlSGlnaEFjY3VyYWN5LFxyXG4gICAgICAgICAgICAgICAgbWF4aW11bUFnZTogX21heGltdW1BZ2VcclxuICAgICAgICAgICAgfSk7XHJcbiAgICAgICAgfVxyXG5cclxuICAgICAgICBmdW5jdGlvbiBfbG9jYXRpb25GYWlsdXJlKCkge1xyXG4gICAgICAgICAgICBjb25zb2xlLmVycm9yKCdDYW4gbm90IGdldCBhIGdlbyBwb3NpdGlvbicpO1xyXG4gICAgICAgIH1cclxuXHJcbiAgICAgICAgZnVuY3Rpb24gX3NldHVwTWFwKCkge1xyXG4gICAgICAgICAgICBfaW5pdE1hcChmdW5jdGlvbiAoKSB7XHJcbiAgICAgICAgICAgICAgICBBUElTZXJ2aWNlLmxvYWRNb2R1bGVzKCRhdHRycy4kYXR0ciwge1xyXG4gICAgICAgICAgICAgICAgICAgIFwiY29udHJvbHNcIjogX3VpTW9kdWxlUmVhZHksXHJcbiAgICAgICAgICAgICAgICAgICAgXCJldmVudHNcIjogX2V2ZW50c01vZHVsZVJlYWR5XHJcbiAgICAgICAgICAgICAgICB9KTtcclxuICAgICAgICAgICAgfSk7XHJcbiAgICAgICAgfVxyXG5cclxuICAgICAgICBmdW5jdGlvbiBfaW5pdE1hcChjYikge1xyXG4gICAgICAgICAgICB2YXIgbWFwID0gaGVyZW1hcHMubWFwID0gbmV3IEguTWFwKCRlbGVtZW50WzBdLCBoZXJlbWFwcy5sYXllcnMubm9ybWFsLm1hcCwge1xyXG4gICAgICAgICAgICAgICAgem9vbTogSGVyZU1hcFV0aWxzU2VydmljZS5pc1ZhbGlkQ29vcmRzKHBvc2l0aW9uKSA/IG9wdGlvbnMuem9vbSA6IG9wdGlvbnMubWF4Wm9vbSxcclxuICAgICAgICAgICAgICAgIGNlbnRlcjogbmV3IEguZ2VvLlBvaW50KHBvc2l0aW9uLmxhdGl0dWRlLCBwb3NpdGlvbi5sb25naXR1ZGUpXHJcbiAgICAgICAgICAgIH0pO1xyXG5cclxuICAgICAgICAgICAgTWFya2Vyc1NlcnZpY2UuYWRkTWFya2Vyc1RvTWFwKG1hcCwgcGxhY2VzKTtcclxuXHJcbiAgICAgICAgICAgIG1hcFJlYWR5ICYmIG1hcFJlYWR5KE1hcFByb3h5KCkpO1xyXG5cclxuICAgICAgICAgICAgY2IgJiYgY2IoKTtcclxuICAgICAgICAgICAgICAgIFxyXG4gICAgICAgIH1cclxuXHJcbiAgICAgICAgZnVuY3Rpb24gX3VpTW9kdWxlUmVhZHkoKSB7XHJcbiAgICAgICAgICAgIFVJTW9kdWxlLnN0YXJ0KHtcclxuICAgICAgICAgICAgICAgIHBsYXRmb3JtOiBoZXJlbWFwcyxcclxuICAgICAgICAgICAgICAgIGFsaWdubWVudDogJGF0dHJzLmNvbnRyb2xzXHJcbiAgICAgICAgICAgIH0pO1xyXG4gICAgICAgIH1cclxuXHJcbiAgICAgICAgZnVuY3Rpb24gX2V2ZW50c01vZHVsZVJlYWR5KCkge1xyXG4gICAgICAgICAgICBFdmVudHNNb2R1bGUuc3RhcnQoe1xyXG4gICAgICAgICAgICAgICAgcGxhdGZvcm06IGhlcmVtYXBzLFxyXG4gICAgICAgICAgICAgICAgbGlzdGVuZXJzOiBsaXN0ZW5lcnMsXHJcbiAgICAgICAgICAgICAgICBvcHRpb25zOiBvcHRpb25zLFxyXG4gICAgICAgICAgICAgICAgaW5qZWN0b3I6IF9tb2R1bGVJbmplY3RvclxyXG4gICAgICAgICAgICB9KTtcclxuICAgICAgICB9XHJcblxyXG4gICAgICAgIGZ1bmN0aW9uIF9tb2R1bGVJbmplY3RvcigpIHtcclxuICAgICAgICAgICAgcmV0dXJuIGZ1bmN0aW9uIChpZCkge1xyXG4gICAgICAgICAgICAgICAgcmV0dXJuIGhlcmVtYXBzW2lkXTtcclxuICAgICAgICAgICAgfVxyXG4gICAgICAgIH1cclxuXHJcbiAgICAgICAgZnVuY3Rpb24gX3Jlc2l6ZUhhbmRsZXIoaGVpZ2h0LCB3aWR0aCkge1xyXG4gICAgICAgICAgICBfc2V0TWFwU2l6ZS5hcHBseShudWxsLCBhcmd1bWVudHMpO1xyXG5cclxuICAgICAgICAgICAgaGVyZW1hcHMubWFwLmdldFZpZXdQb3J0KCkucmVzaXplKCk7XHJcbiAgICAgICAgfVxyXG5cclxuICAgICAgICBmdW5jdGlvbiBfc2V0TWFwU2l6ZShoZWlnaHQsIHdpZHRoKSB7XHJcbiAgICAgICAgICAgIHZhciBoZWlnaHQgPSBoZWlnaHQgfHwgJGVsZW1lbnRbMF0ucGFyZW50Tm9kZS5vZmZzZXRIZWlnaHQgfHwgb3B0aW9ucy5oZWlnaHQsXHJcbiAgICAgICAgICAgICAgICB3aWR0aCA9IHdpZHRoIHx8ICRlbGVtZW50WzBdLnBhcmVudE5vZGUub2Zmc2V0V2lkdGggfHwgb3B0aW9ucy53aWR0aDtcclxuXHJcbiAgICAgICAgICAgICRzY29wZS5tYXBIZWlnaHQgPSBoZWlnaHQgKyAncHgnO1xyXG4gICAgICAgICAgICAkc2NvcGUubWFwV2lkdGggPSB3aWR0aCArICdweCc7XHJcbiAgICAgICAgICAgIFxyXG4gICAgICAgICAgICBIZXJlTWFwVXRpbHNTZXJ2aWNlLnJ1blNjb3BlRGlnZXN0SWZOZWVkKCRzY29wZSk7XHJcbiAgICAgICAgfVxyXG5cclxuICAgICAgICBmdW5jdGlvbiBNYXBQcm94eSgpIHtcclxuICAgICAgICAgICAgcmV0dXJuIHtcclxuICAgICAgICAgICAgICAgIHJlZnJlc2g6IGZ1bmN0aW9uKCl7XHJcbiAgICAgICAgICAgICAgICAgICAgdmFyIGN1cnJlbnRCb3VuZHMgPSB0aGlzLmdldFZpZXdCb3VuZHMoKTtcclxuICAgICAgICAgICAgICAgICAgICBcclxuICAgICAgICAgICAgICAgICAgICB0aGlzLnNldE1hcFNpemVzKCk7XHJcbiAgICAgICAgICAgICAgICAgICAgdGhpcy5zZXRWaWV3Qm91bmRzKGN1cnJlbnRCb3VuZHMpO1xyXG4gICAgICAgICAgICAgICAgfSxcclxuICAgICAgICAgICAgICAgIHNldE1hcFNpemVzOiBmdW5jdGlvbihoZWlnaHQsIHdpZHRoKXtcclxuICAgICAgICAgICAgICAgICAgICBjb25zb2xlLmxvZygkZWxlbWVudFswXS5wYXJlbnROb2RlLm9mZnNldEhlaWdodClcclxuICAgICAgICAgICAgICAgICAgICBfcmVzaXplSGFuZGxlci5hcHBseShudWxsLCBhcmd1bWVudHMpO1xyXG4gICAgICAgICAgICAgICAgfSxcclxuICAgICAgICAgICAgICAgIGdldFBsYXRmb3JtOiBmdW5jdGlvbiAoKSB7XHJcbiAgICAgICAgICAgICAgICAgICAgcmV0dXJuIGhlcmVtYXBzO1xyXG4gICAgICAgICAgICAgICAgfSxcclxuICAgICAgICAgICAgICAgIGNhbGN1bGF0ZVJvdXRlOiBmdW5jdGlvbiAoZHJpdmVUeXBlLCBkaXJlY3Rpb24pIHtcclxuICAgICAgICAgICAgICAgICAgICByZXR1cm4gUm91dGVzU2VydmljZS5jYWxjdWxhdGVSb3V0ZShoZXJlbWFwcywge1xyXG4gICAgICAgICAgICAgICAgICAgICAgICBkcml2ZVR5cGU6IGRyaXZlVHlwZSxcclxuICAgICAgICAgICAgICAgICAgICAgICAgZGlyZWN0aW9uOiBkaXJlY3Rpb25cclxuICAgICAgICAgICAgICAgICAgICB9KTtcclxuICAgICAgICAgICAgICAgIH0sXHJcbiAgICAgICAgICAgICAgICBhZGRSb3V0ZVRvTWFwOiBmdW5jdGlvbiAocm91dGVEYXRhLCBjbGVhbikge1xyXG4gICAgICAgICAgICAgICAgICAgIFJvdXRlc1NlcnZpY2UuYWRkUm91dGVUb01hcChoZXJlbWFwcy5tYXAsIHJvdXRlRGF0YSwgY2xlYW4pO1xyXG4gICAgICAgICAgICAgICAgfSxcclxuICAgICAgICAgICAgICAgIHNldFpvb206IGZ1bmN0aW9uICh6b29tLCBzdGVwKSB7XHJcbiAgICAgICAgICAgICAgICAgICAgSGVyZU1hcFV0aWxzU2VydmljZS56b29tKGhlcmVtYXBzLm1hcCwgem9vbSB8fCAxMCwgc3RlcCk7XHJcbiAgICAgICAgICAgICAgICB9LFxyXG4gICAgICAgICAgICAgICAgZ2V0Wm9vbTogZnVuY3Rpb24oKXtcclxuICAgICAgICAgICAgICAgICAgICByZXR1cm4gaGVyZW1hcHMubWFwLmdldFpvb20oKTsgIFxyXG4gICAgICAgICAgICAgICAgfSxcclxuICAgICAgICAgICAgICAgIGdldENlbnRlcjogZnVuY3Rpb24oKXtcclxuICAgICAgICAgICAgICAgICAgICByZXR1cm4gaGVyZW1hcHMubWFwLmdldENlbnRlcigpOyAgXHJcbiAgICAgICAgICAgICAgICB9LFxyXG4gICAgICAgICAgICAgICAgZ2V0Vmlld0JvdW5kczogZnVuY3Rpb24oKXtcclxuICAgICAgICAgICAgICAgICAgICByZXR1cm4gaGVyZW1hcHMubWFwLmdldFZpZXdCb3VuZHMoKTsgICBcclxuICAgICAgICAgICAgICAgIH0sXHJcbiAgICAgICAgICAgICAgICBzZXRWaWV3Qm91bmRzOiBmdW5jdGlvbihib3VuZGluZ1JlY3QsIG9wdF9hbmltYXRlKXtcclxuICAgICAgICAgICAgICAgICAgICBoZXJlbWFwcy5tYXAuc2V0Vmlld0JvdW5kcyhib3VuZGluZ1JlY3QsIG9wdF9hbmltYXRlKTtcclxuICAgICAgICAgICAgICAgIH0sXHJcbiAgICAgICAgICAgICAgICBzZXRDZW50ZXI6IGZ1bmN0aW9uIChjb29yZHMpIHtcclxuICAgICAgICAgICAgICAgICAgICBpZiAoIWNvb3Jkcykge1xyXG4gICAgICAgICAgICAgICAgICAgICAgICByZXR1cm4gY29uc29sZS5lcnJvcignY29vcmRzIGFyZSBub3Qgc3BlY2lmaWVkIScpO1xyXG4gICAgICAgICAgICAgICAgICAgIH1cclxuXHJcbiAgICAgICAgICAgICAgICAgICAgaGVyZW1hcHMubWFwLnNldENlbnRlcihjb29yZHMpO1xyXG4gICAgICAgICAgICAgICAgfSxcclxuICAgICAgICAgICAgICAgIGNsZWFuUm91dGVzOiBmdW5jdGlvbiAoKSB7XHJcbiAgICAgICAgICAgICAgICAgICAgUm91dGVzU2VydmljZS5jbGVhblJvdXRlcyhoZXJlbWFwcy5tYXApO1xyXG4gICAgICAgICAgICAgICAgfSxcclxuXHJcbiAgICAgICAgICAgICAgICAvKipcclxuICAgICAgICAgICAgICAgICAqIEBwYXJhbSB7Qm9vbGVhbn0gZW5hYmxlSGlnaEFjY3VyYWN5XHJcbiAgICAgICAgICAgICAgICAgKiBAcGFyYW0ge051bWJlcn0gbWF4aW11bUFnZSAtIHRoZSBtYXhpbXVtIGFnZSBpbiBtaWxsaXNlY29uZHMgb2YgYSBwb3NzaWJsZSBjYWNoZWQgcG9zaXRpb24gdGhhdCBpcyBhY2NlcHRhYmxlIHRvIHJldHVybi4gSWYgc2V0IHRvIDAsIGl0IG1lYW5zIHRoYXQgdGhlIGRldmljZSBjYW5ub3QgdXNlIGEgY2FjaGVkIHBvc2l0aW9uIGFuZCBtdXN0IGF0dGVtcHQgdG8gcmV0cmlldmUgdGhlIHJlYWwgY3VycmVudCBwb3NpdGlvblxyXG4gICAgICAgICAgICAgICAgICogQHJldHVybiB7UHJvbWlzZX1cclxuICAgICAgICAgICAgICAgICAqL1xyXG4gICAgICAgICAgICAgICAgZ2V0VXNlckxvY2F0aW9uOiBmdW5jdGlvbiAoZW5hYmxlSGlnaEFjY3VyYWN5LCBtYXhpbXVtQWdlKSB7XHJcbiAgICAgICAgICAgICAgICAgICAgcmV0dXJuIF9nZXRMb2NhdGlvbi5hcHBseShudWxsLCBhcmd1bWVudHMpLnRoZW4oZnVuY3Rpb24gKHBvc2l0aW9uKSB7XHJcbiAgICAgICAgICAgICAgICAgICAgICAgIHZhciBjb29yZHMgPSBwb3NpdGlvbi5jb29yZHM7XHJcblxyXG4gICAgICAgICAgICAgICAgICAgICAgICBNYXJrZXJzU2VydmljZS5hZGRVc2VyTWFya2VyKGhlcmVtYXBzLm1hcCwge1xyXG4gICAgICAgICAgICAgICAgICAgICAgICAgICAgcG9zOiB7XHJcbiAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgbGF0OiBjb29yZHMubGF0aXR1ZGUsXHJcbiAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgbG5nOiBjb29yZHMubG9uZ2l0dWRlXHJcbiAgICAgICAgICAgICAgICAgICAgICAgICAgICB9XHJcbiAgICAgICAgICAgICAgICAgICAgICAgIH0pO1xyXG5cclxuICAgICAgICAgICAgICAgICAgICAgICAgcmV0dXJuIGNvb3JkcztcclxuICAgICAgICAgICAgICAgICAgICB9KVxyXG4gICAgICAgICAgICAgICAgfSxcclxuICAgICAgICAgICAgICAgIGdlb2NvZGVQb3NpdGlvbjogZnVuY3Rpb24gKGNvb3Jkcywgb3B0aW9ucykge1xyXG4gICAgICAgICAgICAgICAgICAgIHJldHVybiBBUElTZXJ2aWNlLmdlb2NvZGVQb3NpdGlvbihoZXJlbWFwcy5wbGF0Zm9ybSwge1xyXG4gICAgICAgICAgICAgICAgICAgICAgICBjb29yZHM6IGNvb3JkcyxcclxuICAgICAgICAgICAgICAgICAgICAgICAgcmFkaXVzOiBvcHRpb25zICYmIG9wdGlvbnMucmFkaXVzLFxyXG4gICAgICAgICAgICAgICAgICAgICAgICBsYW5nOiBvcHRpb25zICYmIG9wdGlvbnMubGFuZ1xyXG4gICAgICAgICAgICAgICAgICAgIH0pO1xyXG4gICAgICAgICAgICAgICAgfSxcclxuICAgICAgICAgICAgICAgIHVwZGF0ZU1hcmtlcnM6IGZ1bmN0aW9uIChwbGFjZXMpIHtcclxuICAgICAgICAgICAgICAgICAgICBNYXJrZXJzU2VydmljZS51cGRhdGVNYXJrZXJzKGhlcmVtYXBzLm1hcCwgcGxhY2VzKTtcclxuICAgICAgICAgICAgICAgIH1cclxuICAgICAgICAgICAgfVxyXG4gICAgICAgIH1cclxuXHJcbiAgICB9XHJcbn07XHJcbiIsInJlcXVpcmUoJy4vcHJvdmlkZXJzL21hcmtlcnMnKTtcclxucmVxdWlyZSgnLi9wcm92aWRlcnMvbWFwLW1vZHVsZXMnKTtcclxucmVxdWlyZSgnLi9wcm92aWRlcnMvcm91dGVzJyk7XHJcblxyXG52YXIgZGlyZWN0aXZlID0gcmVxdWlyZSgnLi9oZXJlbWFwcy5kaXJlY3RpdmUnKSxcclxuICAgIGNvbmZpZ1Byb3ZpZGVyID0gcmVxdWlyZSgnLi9wcm92aWRlcnMvbWFwY29uZmlnLnByb3ZpZGVyJyksXHJcbiAgICBhcGlTZXJ2aWNlID0gcmVxdWlyZSgnLi9wcm92aWRlcnMvYXBpLnNlcnZpY2UnKSxcclxuICAgIHV0aWxzU2VydmljZSA9IHJlcXVpcmUoJy4vcHJvdmlkZXJzL21hcHV0aWxzLnNlcnZpY2UnKSxcclxuICAgIGNvbnN0cyA9IHJlcXVpcmUoJy4vcHJvdmlkZXJzL2NvbnN0cycpO1xyXG5cclxudmFyIGhlcmVtYXBzID0gYW5ndWxhci5tb2R1bGUoJ2hlcmVtYXBzJywgW1xyXG4gICAgJ21hcmtlcnMtbW9kdWxlJyxcclxuICAgICdyb3V0ZXMtbW9kdWxlJyxcclxuICAgICdtYXAtbW9kdWxlcydcclxuXSk7XHJcblxyXG5oZXJlbWFwc1xyXG4gICAgLnByb3ZpZGVyKCdIZXJlTWFwc0NvbmZpZycsIGNvbmZpZ1Byb3ZpZGVyKVxyXG4gICAgLnNlcnZpY2UoJ0FQSVNlcnZpY2UnLCBbJyRxJywgJyRodHRwJywgJ0hlcmVNYXBzQ29uZmlnJywgJ0hlcmVNYXBVdGlsc1NlcnZpY2UnLCAnQ09OU1RTJywgYXBpU2VydmljZV0pXHJcbiAgICAuc2VydmljZSgnSGVyZU1hcFV0aWxzU2VydmljZScsIHV0aWxzU2VydmljZSlcclxuICAgIC5jb25zdGFudCgnQ09OU1RTJywgY29uc3RzKTtcclxuXHJcbmhlcmVtYXBzLmRpcmVjdGl2ZSgnaGVyZW1hcHMnLCBkaXJlY3RpdmUpO1xyXG5cclxubW9kdWxlLmV4cG9ydHMgPSBoZXJlbWFwczsiLCJtb2R1bGUuZXhwb3J0cyA9IGZ1bmN0aW9uICgkcSwgJGh0dHAsIEhlcmVNYXBzQ29uZmlnLCBIZXJlTWFwVXRpbHNTZXJ2aWNlLCBDT05TVFMpIHtcclxuICAgIHZhciB2ZXJzaW9uID0gSGVyZU1hcHNDb25maWcuYXBpVmVyc2lvbixcclxuICAgICAgICBwcm90b2NvbCA9IEhlcmVNYXBzQ29uZmlnLnVzZUhUVFBTID8gJ2h0dHBzJyA6ICdodHRwJztcclxuXHJcbiAgICB2YXIgQVBJX1ZFUlNJT04gPSB7XHJcbiAgICAgICAgVjogcGFyc2VJbnQodmVyc2lvbiksXHJcbiAgICAgICAgU1VCOiB2ZXJzaW9uXHJcbiAgICB9O1xyXG5cclxuICAgIHZhciBDT05GSUcgPSB7XHJcbiAgICAgICAgQkFTRTogXCI6Ly9qcy5hcGkuaGVyZS5jb20vdlwiLFxyXG4gICAgICAgIENPUkU6IFwibWFwc2pzLWNvcmUuanNcIixcclxuICAgICAgICBTRVJWSUNFOiBcIm1hcHNqcy1zZXJ2aWNlLmpzXCIsXHJcbiAgICAgICAgVUk6IHtcclxuICAgICAgICAgICAgc3JjOiBcIm1hcHNqcy11aS5qc1wiLFxyXG4gICAgICAgICAgICBocmVmOiBcIm1hcHNqcy11aS5jc3NcIlxyXG4gICAgICAgIH0sXHJcbiAgICAgICAgRVZFTlRTOiBcIm1hcHNqcy1tYXBldmVudHMuanNcIlxyXG4gICAgfTtcclxuXHJcbiAgICB2YXIgQVBJX0RFRkVSU1F1ZXVlID0ge307XHJcblxyXG4gICAgQVBJX0RFRkVSU1F1ZXVlW0NPTkZJRy5DT1JFXSA9IFtdO1xyXG4gICAgQVBJX0RFRkVSU1F1ZXVlW0NPTkZJRy5TRVJWSUNFXSA9IFtdO1xyXG4gICAgQVBJX0RFRkVSU1F1ZXVlW0NPTkZJRy5VSS5zcmNdID0gW107XHJcbiAgICBBUElfREVGRVJTUXVldWVbQ09ORklHLlBBTk9dID0gW107XHJcbiAgICBBUElfREVGRVJTUXVldWVbQ09ORklHLkVWRU5UU10gPSBbXTtcclxuXHJcbiAgICB2YXIgaGVhZCA9IGRvY3VtZW50LmdldEVsZW1lbnRzQnlUYWdOYW1lKCdoZWFkJylbMF07XHJcblxyXG4gICAgcmV0dXJuIHtcclxuICAgICAgICBsb2FkQXBpOiBsb2FkQXBpLFxyXG4gICAgICAgIGxvYWRNb2R1bGVzOiBsb2FkTW9kdWxlcyxcclxuICAgICAgICBnZXRQb3NpdGlvbjogZ2V0UG9zaXRpb24sXHJcbiAgICAgICAgZ2VvY29kZVBvc2l0aW9uOiBnZW9jb2RlUG9zaXRpb25cclxuICAgIH07XHJcblxyXG4gICAgLy8jcmVnaW9uIFBVQkxJQ1xyXG4gICAgZnVuY3Rpb24gbG9hZEFwaSgpIHtcclxuICAgICAgICByZXR1cm4gX2dldExvYWRlcihDT05GSUcuQ09SRSlcclxuICAgICAgICAgICAgLnRoZW4oZnVuY3Rpb24gKCkge1xyXG4gICAgICAgICAgICAgICAgcmV0dXJuIF9nZXRMb2FkZXIoQ09ORklHLlNFUlZJQ0UpO1xyXG4gICAgICAgICAgICB9KTtcclxuICAgIH1cclxuXHJcbiAgICBmdW5jdGlvbiBsb2FkTW9kdWxlcyhhdHRycywgaGFuZGxlcnMpIHtcclxuICAgICAgICBmb3IgKHZhciBrZXkgaW4gaGFuZGxlcnMpIHtcclxuICAgICAgICAgICAgaWYgKCFoYW5kbGVycy5oYXNPd25Qcm9wZXJ0eShrZXkpIHx8ICFhdHRyc1trZXldKVxyXG4gICAgICAgICAgICAgICAgY29udGludWU7XHJcblxyXG4gICAgICAgICAgICB2YXIgbG9hZGVyID0gX2dldExvYWRlckJ5QXR0cihrZXkpO1xyXG5cclxuICAgICAgICAgICAgbG9hZGVyKClcclxuICAgICAgICAgICAgICAgIC50aGVuKGhhbmRsZXJzW2tleV0pO1xyXG4gICAgICAgIH1cclxuICAgIH1cclxuXHJcbiAgICBmdW5jdGlvbiBnZXRQb3NpdGlvbihvcHRpb25zKSB7XHJcbiAgICAgICAgdmFyIGRlZmVycmVkID0gJHEuZGVmZXIoKTtcclxuXHJcbiAgICAgICAgaWYgKG9wdGlvbnMgJiYgX2lzVmFsaWRDb29yZHMob3B0aW9ucy5jb29yZHMpKSB7XHJcbiAgICAgICAgICAgIGRlZmVycmVkLnJlc29sdmUoeyBjb29yZHM6IG9wdGlvbnMuY29vcmRzIH0pO1xyXG4gICAgICAgIH0gZWxzZSB7XHJcbiAgICAgICAgICAgIG5hdmlnYXRvci5nZW9sb2NhdGlvbi5nZXRDdXJyZW50UG9zaXRpb24oZnVuY3Rpb24gKHJlc3BvbnNlKSB7XHJcbiAgICAgICAgICAgICAgICBkZWZlcnJlZC5yZXNvbHZlKHJlc3BvbnNlKTtcclxuICAgICAgICAgICAgfSwgZnVuY3Rpb24gKGVycm9yKSB7XHJcbiAgICAgICAgICAgICAgICBkZWZlcnJlZC5yZWplY3QoZXJyb3IpO1xyXG4gICAgICAgICAgICB9LCBvcHRpb25zKTtcclxuICAgICAgICB9XHJcblxyXG4gICAgICAgIHJldHVybiBkZWZlcnJlZC5wcm9taXNlO1xyXG4gICAgfVxyXG5cclxuICAgIGZ1bmN0aW9uIGdlb2NvZGVQb3NpdGlvbihwbGF0Zm9ybSwgcGFyYW1zKSB7XHJcbiAgICAgICAgaWYgKCFwYXJhbXMuY29vcmRzKVxyXG4gICAgICAgICAgICByZXR1cm4gY29uc29sZS5lcnJvcignTWlzc2VkIHJlcXVpcmVkIGNvb3JkcycpO1xyXG5cclxuICAgICAgICB2YXIgZ2VvY29kZXIgPSBwbGF0Zm9ybS5nZXRHZW9jb2RpbmdTZXJ2aWNlKCksXHJcbiAgICAgICAgICAgIGRlZmVycmVkID0gJHEuZGVmZXIoKSxcclxuICAgICAgICAgICAgX3BhcmFtcyA9IHtcclxuICAgICAgICAgICAgICAgIHByb3g6IFtwYXJhbXMuY29vcmRzLmxhdCwgcGFyYW1zLmNvb3Jkcy5sbmcsIHBhcmFtcy5yYWRpdXMgfHwgMjUwXS5qb2luKCcsJyksXHJcbiAgICAgICAgICAgICAgICBtb2RlOiAncmV0cmlldmVBZGRyZXNzZXMnLFxyXG4gICAgICAgICAgICAgICAgbWF4cmVzdWx0czogJzEnLFxyXG4gICAgICAgICAgICAgICAgZ2VuOiAnOCcsXHJcbiAgICAgICAgICAgICAgICBsYW5ndWFnZTogcGFyYW1zLmxhbmcgfHwgJ2VuLWdiJ1xyXG4gICAgICAgICAgICB9O1xyXG5cclxuICAgICAgICBnZW9jb2Rlci5yZXZlcnNlR2VvY29kZShfcGFyYW1zLCBmdW5jdGlvbiAocmVzcG9uc2UpIHtcclxuICAgICAgICAgICAgZGVmZXJyZWQucmVzb2x2ZShyZXNwb25zZSlcclxuICAgICAgICB9LCBmdW5jdGlvbiAoZXJyb3IpIHtcclxuICAgICAgICAgICAgZGVmZXJyZWQucmVqZWN0KGVycm9yKVxyXG4gICAgICAgIH0pO1xyXG4gICAgICAgIFxyXG4gICAgICAgIHJldHVybiBkZWZlcnJlZC5wcm9taXNlO1xyXG4gICAgfVxyXG5cclxuICAgIC8vI2VuZHJlZ2lvbiBQVUJMSUNcclxuXHJcbiAgICBmdW5jdGlvbiBfZ2V0TG9hZGVyQnlBdHRyKGF0dHIpIHtcclxuICAgICAgICB2YXIgbG9hZGVyO1xyXG5cclxuICAgICAgICBzd2l0Y2ggKGF0dHIpIHtcclxuICAgICAgICAgICAgY2FzZSBDT05TVFMuTU9EVUxFUy5VSTpcclxuICAgICAgICAgICAgICAgIGxvYWRlciA9IF9sb2FkVUlNb2R1bGU7XHJcbiAgICAgICAgICAgICAgICBicmVhaztcclxuICAgICAgICAgICAgY2FzZSBDT05TVFMuTU9EVUxFUy5FVkVOVFM6XHJcbiAgICAgICAgICAgICAgICBsb2FkZXIgPSBfbG9hZEV2ZW50c01vZHVsZTtcclxuICAgICAgICAgICAgICAgIGJyZWFrO1xyXG4gICAgICAgICAgICBkZWZhdWx0OlxyXG4gICAgICAgICAgICAgICAgdGhyb3cgbmV3IEVycm9yKCdVbmtub3duIG1vZHVsZScsIGF0dHIpO1xyXG4gICAgICAgIH1cclxuXHJcbiAgICAgICAgcmV0dXJuIGxvYWRlcjtcclxuICAgIH1cclxuXHJcbiAgICBmdW5jdGlvbiBfbG9hZFVJTW9kdWxlKCkge1xyXG4gICAgICAgIGlmICghX2lzTG9hZGVkKENPTkZJRy5VSSkpIHtcclxuICAgICAgICAgICAgdmFyIGxpbmsgPSBIZXJlTWFwVXRpbHNTZXJ2aWNlLmNyZWF0ZUxpbmtUYWcoe1xyXG4gICAgICAgICAgICAgICAgcmVsOiAnc3R5bGVzaGVldCcsXHJcbiAgICAgICAgICAgICAgICB0eXBlOiAndGV4dC9jc3MnLFxyXG4gICAgICAgICAgICAgICAgaHJlZjogX2dldFVSTChDT05GSUcuVUkuaHJlZilcclxuICAgICAgICAgICAgfSk7XHJcblxyXG4gICAgICAgICAgICBsaW5rICYmIGhlYWQuYXBwZW5kQ2hpbGQobGluayk7XHJcbiAgICAgICAgfVxyXG5cclxuICAgICAgICByZXR1cm4gX2dldExvYWRlcihDT05GSUcuVUkuc3JjKTtcclxuICAgIH1cclxuXHJcbiAgICBmdW5jdGlvbiBfbG9hZEV2ZW50c01vZHVsZSgpIHtcclxuICAgICAgICByZXR1cm4gX2dldExvYWRlcihDT05GSUcuRVZFTlRTKTtcclxuICAgIH1cclxuXHJcbiAgICAvKipcclxuICAgICAqIEBwYXJhbSB7U3RyaW5nfSBzb3VyY2VOYW1lXHJcbiAgICAgKiByZXR1cm4ge1N0cmluZ30gZS5nIGh0dHA6Ly9qcy5hcGkuaGVyZS5jb20vdntWRVJ9L3tTVUJWRVJTSU9OfS97U09VUkNFfVxyXG4gICAgICovXHJcbiAgICBmdW5jdGlvbiBfZ2V0VVJMKHNvdXJjZU5hbWUpIHtcclxuICAgICAgICByZXR1cm4gW1xyXG4gICAgICAgICAgICBwcm90b2NvbCxcclxuICAgICAgICAgICAgQ09ORklHLkJBU0UsXHJcbiAgICAgICAgICAgIEFQSV9WRVJTSU9OLlYsXHJcbiAgICAgICAgICAgIFwiL1wiLFxyXG4gICAgICAgICAgICBBUElfVkVSU0lPTi5TVUIsXHJcbiAgICAgICAgICAgIFwiL1wiLFxyXG4gICAgICAgICAgICBzb3VyY2VOYW1lXHJcbiAgICAgICAgXS5qb2luKFwiXCIpO1xyXG4gICAgfVxyXG5cclxuICAgIGZ1bmN0aW9uIF9nZXRMb2FkZXIoc291cmNlTmFtZSkge1xyXG4gICAgICAgIHZhciBkZWZlciA9ICRxLmRlZmVyKCksIHNyYywgc2NyaXB0O1xyXG5cclxuICAgICAgICBpZiAoX2lzTG9hZGVkKHNvdXJjZU5hbWUpKSB7XHJcbiAgICAgICAgICAgIGRlZmVyLnJlc29sdmUoKTtcclxuICAgICAgICB9IGVsc2Uge1xyXG4gICAgICAgICAgICBzcmMgPSBfZ2V0VVJMKHNvdXJjZU5hbWUpLFxyXG4gICAgICAgICAgICAgICAgc2NyaXB0ID0gSGVyZU1hcFV0aWxzU2VydmljZS5jcmVhdGVTY3JpcHRUYWcoeyBzcmM6IHNyYyB9KTtcclxuXHJcbiAgICAgICAgICAgIHNjcmlwdCAmJiBoZWFkLmFwcGVuZENoaWxkKHNjcmlwdCk7XHJcblxyXG4gICAgICAgICAgICBBUElfREVGRVJTUXVldWVbc291cmNlTmFtZV0ucHVzaChkZWZlcik7XHJcblxyXG4gICAgICAgICAgICBzY3JpcHQub25sb2FkID0gX29uTG9hZC5iaW5kKG51bGwsIHNvdXJjZU5hbWUpO1xyXG4gICAgICAgICAgICBzY3JpcHQub25lcnJvciA9IF9vbkVycm9yLmJpbmQobnVsbCwgc291cmNlTmFtZSk7XHJcbiAgICAgICAgfVxyXG5cclxuICAgICAgICByZXR1cm4gZGVmZXIucHJvbWlzZTtcclxuICAgIH1cclxuXHJcbiAgICBmdW5jdGlvbiBfaXNMb2FkZWQoc291cmNlTmFtZSkge1xyXG4gICAgICAgIHZhciBjaGVja2VyID0gbnVsbDtcclxuXHJcbiAgICAgICAgc3dpdGNoIChzb3VyY2VOYW1lKSB7XHJcbiAgICAgICAgICAgIGNhc2UgQ09ORklHLkNPUkU6XHJcbiAgICAgICAgICAgICAgICBjaGVja2VyID0gX2lzQ29yZUxvYWRlZDtcclxuICAgICAgICAgICAgICAgIGJyZWFrO1xyXG4gICAgICAgICAgICBjYXNlIENPTkZJRy5TRVJWSUNFOlxyXG4gICAgICAgICAgICAgICAgY2hlY2tlciA9IF9pc1NlcnZpY2VMb2FkZWQ7XHJcbiAgICAgICAgICAgICAgICBicmVhaztcclxuICAgICAgICAgICAgY2FzZSBDT05GSUcuVUk6XHJcbiAgICAgICAgICAgICAgICBjaGVja2VyID0gX2lzVUlMb2FkZWQ7XHJcbiAgICAgICAgICAgICAgICBicmVhaztcclxuICAgICAgICAgICAgY2FzZSBDT05GSUcuRVZFTlRTOlxyXG4gICAgICAgICAgICAgICAgY2hlY2tlciA9IF9pc0V2ZW50c0xvYWRlZDtcclxuICAgICAgICAgICAgICAgIGJyZWFrO1xyXG4gICAgICAgICAgICBkZWZhdWx0OlxyXG4gICAgICAgICAgICAgICAgY2hlY2tlciA9IGZ1bmN0aW9uICgpIHsgcmV0dXJuIGZhbHNlIH07XHJcbiAgICAgICAgfVxyXG5cclxuICAgICAgICByZXR1cm4gY2hlY2tlcigpO1xyXG4gICAgfVxyXG5cclxuICAgIGZ1bmN0aW9uIF9pc0NvcmVMb2FkZWQoKSB7XHJcbiAgICAgICAgcmV0dXJuICEhd2luZG93Lkg7XHJcbiAgICB9XHJcblxyXG4gICAgZnVuY3Rpb24gX2lzU2VydmljZUxvYWRlZCgpIHtcclxuICAgICAgICByZXR1cm4gISEod2luZG93LkggJiYgd2luZG93Lkguc2VydmljZSk7XHJcbiAgICB9XHJcblxyXG4gICAgZnVuY3Rpb24gX2lzVUlMb2FkZWQoKSB7XHJcbiAgICAgICAgcmV0dXJuICEhKHdpbmRvdy5IICYmIHdpbmRvdy5ILnVpKTtcclxuICAgIH1cclxuXHJcbiAgICBmdW5jdGlvbiBfaXNFdmVudHNMb2FkZWQoKSB7XHJcbiAgICAgICAgcmV0dXJuICEhKHdpbmRvdy5IICYmIHdpbmRvdy5ILm1hcGV2ZW50cyk7XHJcbiAgICB9XHJcblxyXG4gICAgZnVuY3Rpb24gX29uTG9hZChzb3VyY2VOYW1lKSB7XHJcbiAgICAgICAgdmFyIGRlZmVyUXVldWUgPSBBUElfREVGRVJTUXVldWVbc291cmNlTmFtZV07XHJcbiAgICAgICAgZm9yICh2YXIgaSA9IDAsIGwgPSBkZWZlclF1ZXVlLmxlbmd0aDsgaSA8IGw7ICsraSkge1xyXG4gICAgICAgICAgICB2YXIgZGVmZXIgPSBkZWZlclF1ZXVlW2ldO1xyXG4gICAgICAgICAgICBkZWZlci5yZXNvbHZlKCk7XHJcbiAgICAgICAgfVxyXG5cclxuICAgICAgICBBUElfREVGRVJTUXVldWVbc291cmNlTmFtZV0gPSBbXTtcclxuICAgIH1cclxuXHJcbiAgICBmdW5jdGlvbiBfb25FcnJvcihzb3VyY2VOYW1lKSB7XHJcbiAgICAgICAgdmFyIGRlZmVyUXVldWUgPSBBUElfREVGRVJTUXVldWVbc291cmNlTmFtZV07XHJcbiAgICAgICAgZm9yICh2YXIgaSA9IDAsIGwgPSBkZWZlclF1ZXVlLmxlbmd0aDsgaSA8IGw7ICsraSkge1xyXG4gICAgICAgICAgICB2YXIgZGVmZXIgPSBkZWZlclF1ZXVlW2ldO1xyXG4gICAgICAgICAgICBkZWZlci5yZWplY3QoKTtcclxuICAgICAgICB9XHJcblxyXG4gICAgICAgIEFQSV9ERUZFUlNRdWV1ZVtzb3VyY2VOYW1lXSA9IFtdO1xyXG4gICAgfVxyXG5cclxuICAgIGZ1bmN0aW9uIF9pc1ZhbGlkQ29vcmRzKGNvb3Jkcykge1xyXG4gICAgICAgIHZhciBsbmcgPSBjb29yZHMgJiYgY29vcmRzLmxvbmdpdHVkZSxcclxuICAgICAgICAgICAgbGF0ID0gY29vcmRzICYmIGNvb3Jkcy5sYXRpdHVkZTtcclxuXHJcbiAgICAgICAgcmV0dXJuICh0eXBlb2YgbG5nID09PSAnbnVtYmVyJyB8fCB0eXBlb2YgbG5nID09PSAnc3RyaW5nJykgJiZcclxuICAgICAgICAgICAgKHR5cGVvZiBsYXQgPT09ICdudW1iZXInIHx8IHR5cGVvZiBsYXQgPT09ICdzdHJpbmcnKTtcclxuICAgIH1cclxufTsiLCJtb2R1bGUuZXhwb3J0cyA9IHtcclxuICAgIFVQREFURV9NQVBfUkVTSVpFX1RJTUVPVVQ6IDUwMCxcclxuICAgIEFOSU1BVElPTl9aT09NX1NURVA6IC4wNSxcclxuICAgIE1PRFVMRVM6IHtcclxuICAgICAgICBVSTogJ2NvbnRyb2xzJyxcclxuICAgICAgICBFVkVOVFM6ICdldmVudHMnLFxyXG4gICAgICAgIFBBTk86ICdwYW5vJ1xyXG4gICAgfSxcclxuICAgIERFRkFVTFRfTUFQX09QVElPTlM6IHtcclxuICAgICAgICBoZWlnaHQ6IDQ4MCxcclxuICAgICAgICB3aWR0aDogNjQwLFxyXG4gICAgICAgIHpvb206IDEyLFxyXG4gICAgICAgIG1heFpvb206IDIsXHJcbiAgICAgICAgcmVzaXplOiBmYWxzZSxcclxuICAgICAgICBkcmFnZ2FibGU6IGZhbHNlLFxyXG4gICAgICAgIGNvb3Jkczoge1xyXG4gICAgICAgICAgICBsb25naXR1ZGU6IDAsXHJcbiAgICAgICAgICAgIGxhdGl0dWRlOiAwXHJcbiAgICAgICAgfVxyXG4gICAgfSxcclxuICAgIE1BUktFUl9UWVBFUzoge1xyXG4gICAgICAgIERPTTogXCJET01cIixcclxuICAgICAgICBTVkc6IFwiU1ZHXCJcclxuICAgIH0sXHJcbiAgICBDT05UUk9MUzoge1xyXG4gICAgICAgIE5BTUVTOiB7XHJcbiAgICAgICAgICAgIFNDQUxFOiAnc2NhbGViYXInLFxyXG4gICAgICAgICAgICBTRVRUSU5HUzogJ21hcHNldHRpbmdzJyxcclxuICAgICAgICAgICAgWk9PTTogJ3pvb20nLFxyXG4gICAgICAgICAgICBVU0VSOiAndXNlcnBvc2l0aW9uJ1xyXG4gICAgICAgIH0sXHJcbiAgICAgICAgUE9TSVRJT05TOiBbXHJcbiAgICAgICAgICAgICd0b3AtcmlnaHQnLFxyXG4gICAgICAgICAgICAndG9wLWNlbnRlcicsXHJcbiAgICAgICAgICAgICd0b3AtbGVmdCcsXHJcbiAgICAgICAgICAgICdsZWZ0LXRvcCcsXHJcbiAgICAgICAgICAgICdsZWZ0LW1pZGRsZScsXHJcbiAgICAgICAgICAgICdsZWZ0LWJvdHRvbScsXHJcbiAgICAgICAgICAgICdyaWdodC10b3AnLFxyXG4gICAgICAgICAgICAncmlnaHQtbWlkZGxlJyxcclxuICAgICAgICAgICAgJ3JpZ2h0LWJvdHRvbScsXHJcbiAgICAgICAgICAgICdib3R0b20tcmlnaHQnLFxyXG4gICAgICAgICAgICAnYm90dG9tLWNlbnRlcicsXHJcbiAgICAgICAgICAgICdib3R0b20tbGVmdCdcclxuICAgICAgICBdXHJcbiAgICB9LFxyXG4gICAgSU5GT0JVQkJMRToge1xyXG4gICAgICAgIFNUQVRFOiB7XHJcbiAgICAgICAgICAgIE9QRU46ICdvcGVuJyxcclxuICAgICAgICAgICAgQ0xPU0VEOiAnY2xvc2VkJ1xyXG4gICAgICAgIH0sXHJcbiAgICAgICAgRElTUExBWV9FVkVOVDoge1xyXG4gICAgICAgICAgICBwb2ludGVybW92ZTogJ29uSG92ZXInLFxyXG4gICAgICAgICAgICB0YXA6ICdvbkNsaWNrJ1xyXG4gICAgICAgIH1cclxuICAgIH0sXHJcbiAgICBVU0VSX0VWRU5UUzoge1xyXG4gICAgICAgIHRhcDogJ2NsaWNrJyxcclxuICAgICAgICBwb2ludGVybW92ZTogJ21vdXNlbW92ZScsXHJcbiAgICAgICAgcG9pbnRlcmxlYXZlOiAnbW91c2VsZWF2ZScsXHJcbiAgICAgICAgcG9pbnRlcmVudGVyOiAnbW91c2VlbnRlcicsXHJcbiAgICAgICAgZHJhZzogJ2RyYWcnLFxyXG4gICAgICAgIGRyYWdzdGFydDogJ2RyYWdzdGFydCcsXHJcbiAgICAgICAgZHJhZ2VuZDogJ2RyYWdlbmQnXHJcbiAgICB9XHJcbn0iLCJtb2R1bGUuZXhwb3J0cyA9IGZ1bmN0aW9uKEhlcmVNYXBVdGlsc1NlcnZpY2UsIE1hcmtlcnNTZXJ2aWNlLCBDT05TVFMsIEluZm9CdWJibGVGYWN0b3J5KSB7XHJcbiAgICBmdW5jdGlvbiBFdmVudHMocGxhdGZvcm0sIEluamVjdG9yLCBsaXN0ZW5lcnMpIHtcclxuICAgICAgICB0aGlzLm1hcCA9IHBsYXRmb3JtLm1hcDtcclxuICAgICAgICB0aGlzLmxpc3RlbmVycyA9IGxpc3RlbmVycztcclxuICAgICAgICB0aGlzLmluamVjdCA9IG5ldyBJbmplY3RvcigpO1xyXG4gICAgICAgIHRoaXMuZXZlbnRzID0gcGxhdGZvcm0uZXZlbnRzID0gbmV3IEgubWFwZXZlbnRzLk1hcEV2ZW50cyh0aGlzLm1hcCk7XHJcbiAgICAgICAgdGhpcy5iZWhhdmlvciA9IHBsYXRmb3JtLmJlaGF2aW9yID0gbmV3IEgubWFwZXZlbnRzLkJlaGF2aW9yKHRoaXMuZXZlbnRzKTtcclxuICAgICAgICB0aGlzLmJ1YmJsZSA9IEluZm9CdWJibGVGYWN0b3J5LmNyZWF0ZSgpO1xyXG5cclxuICAgICAgICB0aGlzLnNldHVwRXZlbnRMaXN0ZW5lcnMoKTtcclxuICAgIH1cclxuXHJcbiAgICB2YXIgcHJvdG8gPSBFdmVudHMucHJvdG90eXBlO1xyXG5cclxuICAgIHByb3RvLnNldHVwRXZlbnRMaXN0ZW5lcnMgPSBzZXR1cEV2ZW50TGlzdGVuZXJzO1xyXG4gICAgcHJvdG8uc2V0dXBPcHRpb25zID0gc2V0dXBPcHRpb25zO1xyXG4gICAgcHJvdG8udHJpZ2dlclVzZXJMaXN0ZW5lciA9IHRyaWdnZXJVc2VyTGlzdGVuZXI7XHJcbiAgICBwcm90by5pbmZvQnViYmxlSGFuZGxlciA9IGluZm9CdWJibGVIYW5kbGVyOyAgXHJcblxyXG4gICAgcmV0dXJuIHtcclxuICAgICAgICBzdGFydDogZnVuY3Rpb24oYXJncykge1xyXG4gICAgICAgICAgICBpZiAoIShhcmdzLnBsYXRmb3JtLm1hcCBpbnN0YW5jZW9mIEguTWFwKSlcclxuICAgICAgICAgICAgICAgIHJldHVybiBjb25zb2xlLmVycm9yKCdNaXNzZWQgcmVxdWlyZWQgbWFwIGluc3RhbmNlJyk7XHJcblxyXG4gICAgICAgICAgICB2YXIgZXZlbnRzID0gbmV3IEV2ZW50cyhhcmdzLnBsYXRmb3JtLCBhcmdzLmluamVjdG9yLCBhcmdzLmxpc3RlbmVycyk7XHJcblxyXG4gICAgICAgICAgICBhcmdzLm9wdGlvbnMgJiYgZXZlbnRzLnNldHVwT3B0aW9ucyhhcmdzLm9wdGlvbnMpO1xyXG4gICAgICAgIH1cclxuICAgIH1cclxuXHJcbiAgICBmdW5jdGlvbiBzZXR1cEV2ZW50TGlzdGVuZXJzKCkge1xyXG4gICAgICAgIHZhciBzZWxmID0gdGhpcztcclxuXHJcbiAgICAgICAgSGVyZU1hcFV0aWxzU2VydmljZS5hZGRFdmVudExpc3RlbmVyKHRoaXMubWFwLCAndGFwJywgdGhpcy5pbmZvQnViYmxlSGFuZGxlci5iaW5kKHRoaXMpKTtcclxuXHJcbiAgICAgICAgSGVyZU1hcFV0aWxzU2VydmljZS5hZGRFdmVudExpc3RlbmVyKHRoaXMubWFwLCAncG9pbnRlcm1vdmUnLCB0aGlzLmluZm9CdWJibGVIYW5kbGVyLmJpbmQodGhpcykpO1xyXG5cclxuICAgICAgICBIZXJlTWFwVXRpbHNTZXJ2aWNlLmFkZEV2ZW50TGlzdGVuZXIodGhpcy5tYXAsICdkcmFnc3RhcnQnLCBmdW5jdGlvbihlKSB7XHJcbiAgICAgICAgICAgIGlmIChNYXJrZXJzU2VydmljZS5pc01hcmtlckluc3RhbmNlKGUudGFyZ2V0KSkge1xyXG4gICAgICAgICAgICAgICAgc2VsZi5iZWhhdmlvci5kaXNhYmxlKCk7XHJcbiAgICAgICAgICAgIH1cclxuXHJcbiAgICAgICAgICAgIHNlbGYudHJpZ2dlclVzZXJMaXN0ZW5lcihDT05TVFMuVVNFUl9FVkVOVFNbZS50eXBlXSwgZSk7XHJcbiAgICAgICAgfSk7XHJcblxyXG4gICAgICAgIEhlcmVNYXBVdGlsc1NlcnZpY2UuYWRkRXZlbnRMaXN0ZW5lcih0aGlzLm1hcCwgJ2RyYWcnLCBmdW5jdGlvbihlKSB7XHJcbiAgICAgICAgICAgIHZhciBwb2ludGVyID0gZS5jdXJyZW50UG9pbnRlcixcclxuICAgICAgICAgICAgICAgIHRhcmdldCA9IGUudGFyZ2V0O1xyXG5cclxuICAgICAgICAgICAgaWYgKE1hcmtlcnNTZXJ2aWNlLmlzTWFya2VySW5zdGFuY2UodGFyZ2V0KSkge1xyXG4gICAgICAgICAgICAgICAgdGFyZ2V0LnNldFBvc2l0aW9uKHNlbGYubWFwLnNjcmVlblRvR2VvKHBvaW50ZXIudmlld3BvcnRYLCBwb2ludGVyLnZpZXdwb3J0WSkpO1xyXG4gICAgICAgICAgICB9XHJcblxyXG4gICAgICAgICAgICBzZWxmLnRyaWdnZXJVc2VyTGlzdGVuZXIoQ09OU1RTLlVTRVJfRVZFTlRTW2UudHlwZV0sIGUpO1xyXG4gICAgICAgIH0pO1xyXG5cclxuICAgICAgICBIZXJlTWFwVXRpbHNTZXJ2aWNlLmFkZEV2ZW50TGlzdGVuZXIodGhpcy5tYXAsICdkcmFnZW5kJywgZnVuY3Rpb24oZSkge1xyXG4gICAgICAgICAgICBpZiAoTWFya2Vyc1NlcnZpY2UuaXNNYXJrZXJJbnN0YW5jZShlLnRhcmdldCkpIHtcclxuICAgICAgICAgICAgICAgIHNlbGYuYmVoYXZpb3IuZW5hYmxlKCk7XHJcbiAgICAgICAgICAgIH1cclxuXHJcbiAgICAgICAgICAgIHNlbGYudHJpZ2dlclVzZXJMaXN0ZW5lcihDT05TVFMuVVNFUl9FVkVOVFNbZS50eXBlXSwgZSk7XHJcbiAgICAgICAgfSk7XHJcbiAgICB9XHJcblxyXG4gICAgZnVuY3Rpb24gc2V0dXBPcHRpb25zKG9wdGlvbnMpIHtcclxuICAgICAgICBpZiAoIW9wdGlvbnMpXHJcbiAgICAgICAgICAgIHJldHVybjtcclxuXHJcbiAgICAgICAgdGhpcy5tYXAuZHJhZ2dhYmxlID0gISFvcHRpb25zLmRyYWdnYWJsZTtcclxuICAgIH1cclxuXHJcbiAgICBmdW5jdGlvbiB0cmlnZ2VyVXNlckxpc3RlbmVyKGV2ZW50TmFtZSwgZSkge1xyXG4gICAgICAgIGlmICghdGhpcy5saXN0ZW5lcnMpXHJcbiAgICAgICAgICAgIHJldHVybjtcclxuXHJcbiAgICAgICAgdmFyIGNhbGxiYWNrID0gdGhpcy5saXN0ZW5lcnNbZXZlbnROYW1lXTtcclxuXHJcbiAgICAgICAgY2FsbGJhY2sgJiYgY2FsbGJhY2soZSk7XHJcbiAgICB9XHJcbiAgICBcclxuICAgIGZ1bmN0aW9uIGluZm9CdWJibGVIYW5kbGVyKGUpe1xyXG4gICAgICAgIHZhciB1aSA9IHRoaXMuaW5qZWN0KCd1aScpO1xyXG4gICAgICAgIFxyXG4gICAgICAgIGlmKHVpKVxyXG4gICAgICAgICAgICB0aGlzLmJ1YmJsZS50b2dnbGUoZSwgdWkpO1xyXG4gICAgICAgICAgICBcclxuICAgICAgICB0aGlzLnRyaWdnZXJVc2VyTGlzdGVuZXIoQ09OU1RTLlVTRVJfRVZFTlRTW2UudHlwZV0sIGUpOyAgICAgIFxyXG4gICAgfVxyXG5cclxufTsiLCJtb2R1bGUuZXhwb3J0cyA9IGZ1bmN0aW9uKE1hcmtlcnNTZXJ2aWNlLCBIZXJlTWFwVXRpbHNTZXJ2aWNlLCBDT05TVFMpIHtcclxuICAgIGZ1bmN0aW9uIEluZm9CdWJibGUoKSB7fVxyXG5cclxuICAgIHZhciBwcm90byA9IEluZm9CdWJibGUucHJvdG90eXBlO1xyXG4gICAgICAgIFxyXG4gICAgcHJvdG8uY3JlYXRlID0gY3JlYXRlO1xyXG4gICAgcHJvdG8udXBkYXRlID0gdXBkYXRlO1xyXG4gICAgcHJvdG8udG9nZ2xlID0gdG9nZ2xlO1xyXG4gICAgcHJvdG8uc2hvdyA9IHNob3c7XHJcbiAgICBwcm90by5jbG9zZSA9IGNsb3NlO1xyXG5cclxuICAgIHJldHVybiB7XHJcbiAgICAgICAgY3JlYXRlOiBmdW5jdGlvbigpe1xyXG4gICAgICAgICAgICByZXR1cm4gbmV3IEluZm9CdWJibGUoKTtcclxuICAgICAgICB9XHJcbiAgICB9XHJcblxyXG4gICAgZnVuY3Rpb24gdG9nZ2xlKGUsIHVpKSB7XHJcbiAgICAgICAgaWYgKE1hcmtlcnNTZXJ2aWNlLmlzTWFya2VySW5zdGFuY2UoZS50YXJnZXQpKVxyXG4gICAgICAgICAgICB0aGlzLnNob3coZSwgdWkpO1xyXG4gICAgICAgIGVsc2VcclxuICAgICAgICAgICAgdGhpcy5jbG9zZShlLCB1aSk7XHJcbiAgICB9XHJcblxyXG4gICAgZnVuY3Rpb24gdXBkYXRlKGJ1YmJsZSwgZGF0YSkge1xyXG4gICAgICAgIGJ1YmJsZS5kaXNwbGF5ID0gZGF0YS5kaXNwbGF5O1xyXG5cclxuICAgICAgICBidWJibGUuc2V0UG9zaXRpb24oZGF0YS5wb3NpdGlvbik7XHJcbiAgICAgICAgYnViYmxlLnNldENvbnRlbnQoZGF0YS5tYXJrdXApO1xyXG5cclxuICAgICAgICBidWJibGUuc2V0U3RhdGUoQ09OU1RTLklORk9CVUJCTEUuU1RBVEUuT1BFTik7XHJcbiAgICB9XHJcblxyXG4gICAgZnVuY3Rpb24gY3JlYXRlKHNvdXJjZSkge1xyXG4gICAgICAgIHZhciBidWJibGUgPSBuZXcgSC51aS5JbmZvQnViYmxlKHNvdXJjZS5wb3NpdGlvbiwge1xyXG4gICAgICAgICAgICBjb250ZW50OiBzb3VyY2UubWFya3VwXHJcbiAgICAgICAgfSk7XHJcblxyXG4gICAgICAgIGJ1YmJsZS5kaXNwbGF5ID0gc291cmNlLmRpc3BsYXk7XHJcbiAgICAgICAgYnViYmxlLmFkZENsYXNzKENPTlNUUy5JTkZPQlVCQkxFLlNUQVRFLk9QRU4pXHJcblxyXG4gICAgICAgIEhlcmVNYXBVdGlsc1NlcnZpY2UuYWRkRXZlbnRMaXN0ZW5lcihidWJibGUsICdzdGF0ZWNoYW5nZScsIGZ1bmN0aW9uKGUpIHtcclxuICAgICAgICAgICAgdmFyIHN0YXRlID0gdGhpcy5nZXRTdGF0ZSgpLFxyXG4gICAgICAgICAgICAgICAgZWwgPSB0aGlzLmdldEVsZW1lbnQoKTtcclxuICAgICAgICAgICAgaWYgKHN0YXRlID09PSBDT05TVFMuSU5GT0JVQkJMRS5TVEFURS5DTE9TRUQpIHtcclxuICAgICAgICAgICAgICAgIGVsLmNsYXNzTGlzdC5yZW1vdmUoQ09OU1RTLklORk9CVUJCTEUuU1RBVEUuT1BFTik7XHJcbiAgICAgICAgICAgIH0gZWxzZVxyXG4gICAgICAgICAgICAgICAgdGhpcy5hZGRDbGFzcyhzdGF0ZSlcclxuICAgICAgICB9KTtcclxuXHJcbiAgICAgICAgcmV0dXJuIGJ1YmJsZTtcclxuICAgIH1cclxuXHJcbiAgICBmdW5jdGlvbiBzaG93KGUsIHVpLCBkYXRhKSB7XHJcbiAgICAgICAgdmFyIHRhcmdldCA9IGUudGFyZ2V0LFxyXG4gICAgICAgICAgICBkYXRhID0gdGFyZ2V0LmdldERhdGEoKSxcclxuICAgICAgICAgICAgZWwgPSBudWxsO1xyXG5cclxuICAgICAgICBpZiAoIWRhdGEgfHwgIWRhdGEuZGlzcGxheSB8fCAhZGF0YS5tYXJrdXAgfHwgZGF0YS5kaXNwbGF5ICE9PSBDT05TVFMuSU5GT0JVQkJMRS5ESVNQTEFZX0VWRU5UW2UudHlwZV0pXHJcbiAgICAgICAgICAgIHJldHVybjtcclxuXHJcbiAgICAgICAgdmFyIHNvdXJjZSA9IHtcclxuICAgICAgICAgICAgcG9zaXRpb246IHRhcmdldC5nZXRQb3NpdGlvbigpLFxyXG4gICAgICAgICAgICBtYXJrdXA6IGRhdGEubWFya3VwLFxyXG4gICAgICAgICAgICBkaXNwbGF5OiBkYXRhLmRpc3BsYXlcclxuICAgICAgICB9O1xyXG5cclxuICAgICAgICBpZiAoIXVpLmJ1YmJsZSkge1xyXG4gICAgICAgICAgICB1aS5idWJibGUgPSB0aGlzLmNyZWF0ZShzb3VyY2UpO1xyXG4gICAgICAgICAgICB1aS5hZGRCdWJibGUodWkuYnViYmxlKTtcclxuXHJcbiAgICAgICAgICAgIHJldHVybjtcclxuICAgICAgICB9XHJcblxyXG4gICAgICAgIHRoaXMudXBkYXRlKHVpLmJ1YmJsZSwgc291cmNlKTtcclxuICAgIH1cclxuXHJcbiAgICBmdW5jdGlvbiBjbG9zZShlLCB1aSkge1xyXG4gICAgICAgIGlmICghdWkuYnViYmxlIHx8IHVpLmJ1YmJsZS5kaXNwbGF5ICE9PSBDT05TVFMuSU5GT0JVQkJMRS5ESVNQTEFZX0VWRU5UW2UudHlwZV0pIHtcclxuICAgICAgICAgICAgcmV0dXJuO1xyXG4gICAgICAgIH1cclxuXHJcbiAgICAgICAgdWkuYnViYmxlLnNldFN0YXRlKENPTlNUUy5JTkZPQlVCQkxFLlNUQVRFLkNMT1NFRCk7XHJcbiAgICB9XHJcbn0iLCJ2YXIgZXZlbnRzTW9kdWxlID0gcmVxdWlyZSgnLi9ldmVudHMvZXZlbnRzLmpzJyksXHJcbiAgICBpbmZvQnViYmxlID0gcmVxdWlyZSgnLi9ldmVudHMvaW5mb2J1YmJsZS5qcycpO1xyXG4gICAgXHJcbnZhciB1aU1vZHVsZSA9IHJlcXVpcmUoJy4vdWkvdWkuanMnKTtcclxuXHJcbmFuZ3VsYXIubW9kdWxlKCdldmVudHMtbW9kdWxlJywgW10pXHJcbiAgICAuZmFjdG9yeSgnRXZlbnRzTW9kdWxlJywgZXZlbnRzTW9kdWxlKVxyXG4gICAgLmZhY3RvcnkoJ0luZm9CdWJibGVGYWN0b3J5JywgaW5mb0J1YmJsZSk7XHJcbiAgICBcclxuYW5ndWxhci5tb2R1bGUoJ3VpLW1vZHVsZScsIFtdKVxyXG4gICAgLmZhY3RvcnkoJ1VJTW9kdWxlJywgdWlNb2R1bGUpXHJcblxyXG52YXIgYXBwID0gYW5ndWxhci5tb2R1bGUoJ21hcC1tb2R1bGVzJywgW1xyXG5cdCdldmVudHMtbW9kdWxlJyxcclxuICAgICd1aS1tb2R1bGUnXHJcbl0pO1xyXG5cclxubW9kdWxlLmV4cG9ydHMgPSBhcHA7IiwibW9kdWxlLmV4cG9ydHMgPSBmdW5jdGlvbihBUElTZXJ2aWNlLCBNYXJrZXJzU2VydmljZSwgSGVyZU1hcFV0aWxzU2VydmljZSwgQ09OU1RTKSB7XHJcbiAgICBmdW5jdGlvbiBVSShwbGF0Zm9ybSwgYWxpZ25tZW50KSB7XHJcbiAgICAgICAgdGhpcy5tYXAgPSBwbGF0Zm9ybS5tYXA7XHJcbiAgICAgICAgdGhpcy5sYXllcnMgPSBwbGF0Zm9ybS5sYXllcnM7XHJcbiAgICAgICAgdGhpcy5hbGlnbm1lbnQgPSBhbGlnbm1lbnQ7XHJcbiAgICAgICAgdGhpcy51aSA9IHBsYXRmb3JtLnVpID0gSC51aS5VSS5jcmVhdGVEZWZhdWx0KHRoaXMubWFwLCB0aGlzLmxheWVycyk7XHJcblxyXG4gICAgICAgIHRoaXMuc2V0dXBDb250cm9scygpO1xyXG4gICAgfVxyXG5cclxuICAgIFVJLmlzVmFsaWRBbGlnbm1lbnQgPSBpc1ZhbGlkQWxpZ25tZW50O1xyXG5cclxuICAgIHZhciBwcm90byA9IFVJLnByb3RvdHlwZTtcclxuXHJcbiAgICBwcm90by5zZXR1cENvbnRyb2xzID0gc2V0dXBDb250cm9scztcclxuICAgIHByb3RvLmNyZWF0ZVVzZXJDb250cm9sID0gY3JlYXRlVXNlckNvbnRyb2w7XHJcbiAgICBwcm90by5zZXRDb250cm9sc0FsaWdubWVudCA9IHNldENvbnRyb2xzQWxpZ25tZW50O1xyXG5cclxuICAgIHJldHVybiB7XHJcbiAgICAgICAgc3RhcnQ6IGZ1bmN0aW9uKGFyZ3MpIHtcclxuICAgICAgICAgICAgaWYgKCEoYXJncy5wbGF0Zm9ybS5tYXAgaW5zdGFuY2VvZiBILk1hcCkgJiYgIShhcmdzLnBsYXRmb3JtLmxheWVycykpXHJcbiAgICAgICAgICAgICAgICByZXR1cm4gY29uc29sZS5lcnJvcignTWlzc2VkIHVpIG1vZHVsZSBkZXBlbmRlbmNpZXMnKTtcclxuXHJcbiAgICAgICAgICAgIHZhciB1aSA9IG5ldyBVSShhcmdzLnBsYXRmb3JtLCBhcmdzLmFsaWdubWVudCk7XHJcbiAgICAgICAgfVxyXG4gICAgfVxyXG5cclxuICAgIGZ1bmN0aW9uIHNldHVwQ29udHJvbHMoKSB7XHJcbiAgICAgICAgdmFyIE5BTUVTID0gQ09OU1RTLkNPTlRST0xTLk5BTUVTLFxyXG4gICAgICAgICAgICB1c2VyQ29udHJvbCA9IHRoaXMuY3JlYXRlVXNlckNvbnRyb2woKTtcclxuXHJcbiAgICAgICAgdGhpcy51aS5nZXRDb250cm9sKE5BTUVTLlNFVFRJTkdTKS5zZXRJbmNpZGVudHNMYXllcihmYWxzZSk7XHJcbiAgICAgICAgdGhpcy51aS5hZGRDb250cm9sKE5BTUVTLlVTRVIsIHVzZXJDb250cm9sKTtcclxuICAgICAgICB0aGlzLnNldENvbnRyb2xzQWxpZ25tZW50KE5BTUVTKTtcclxuICAgIH1cclxuXHJcbiAgICBmdW5jdGlvbiBjcmVhdGVVc2VyQ29udHJvbCgpIHtcclxuICAgICAgICB2YXIgc2VsZiA9IHRoaXMsXHJcbiAgICAgICAgICAgIHVzZXJDb250cm9sID0gbmV3IEgudWkuQ29udHJvbCgpLFxyXG4gICAgICAgICAgICBtYXJrdXAgPSAnPHN2ZyBjbGFzcz1cIkhfaWNvblwiIGZpbGw9XCIjZmZmXCIgeG1sbnM9XCJodHRwOi8vd3d3LnczLm9yZy8yMDAwL3N2Z1wiIHdpZHRoPVwiMTZcIiBoZWlnaHQ9XCIxNlwiIHZpZXdCb3g9XCIwIDAgMTYgMTZcIj48cGF0aCBjbGFzcz1cIm1pZGRsZV9sb2NhdGlvbl9zdHJva2VcIiBkPVwiTTggMTJjLTIuMjA2IDAtNC0xLjc5NS00LTQgMC0yLjIwNiAxLjc5NC00IDQtNHM0IDEuNzk0IDQgNGMwIDIuMjA1LTEuNzk0IDQtNCA0TTggMS4yNWE2Ljc1IDYuNzUgMCAxIDAgMCAxMy41IDYuNzUgNi43NSAwIDAgMCAwLTEzLjVcIj48L3BhdGg+PHBhdGggY2xhc3M9XCJpbm5lcl9sb2NhdGlvbl9zdHJva2VcIiBkPVwiTTggNWEzIDMgMCAxIDEgLjAwMSA2QTMgMyAwIDAgMSA4IDVtMC0xQzUuNzk0IDQgNCA1Ljc5NCA0IDhjMCAyLjIwNSAxLjc5NCA0IDQgNHM0LTEuNzk1IDQtNGMwLTIuMjA2LTEuNzk0LTQtNC00XCI+PC9wYXRoPjxwYXRoIGNsYXNzPVwib3V0ZXJfbG9jYXRpb25fc3Ryb2tlXCIgZD1cIk04IDEuMjVhNi43NSA2Ljc1IDAgMSAxIDAgMTMuNSA2Ljc1IDYuNzUgMCAwIDEgMC0xMy41TTggMEMzLjU5IDAgMCAzLjU5IDAgOGMwIDQuNDExIDMuNTkgOCA4IDhzOC0zLjU4OSA4LThjMC00LjQxLTMuNTktOC04LThcIj48L3BhdGg+PC9zdmc+JztcclxuXHJcbiAgICAgICAgdmFyIHVzZXJDb250cm9sQnV0dG9uID0gbmV3IEgudWkuYmFzZS5CdXR0b24oe1xyXG4gICAgICAgICAgICBsYWJlbDogbWFya3VwLFxyXG4gICAgICAgICAgICBvblN0YXRlQ2hhbmdlOiBmdW5jdGlvbihldnQpIHtcclxuICAgICAgICAgICAgICAgIGlmICh1c2VyQ29udHJvbEJ1dHRvbi5nZXRTdGF0ZSgpID09PSBILnVpLmJhc2UuQnV0dG9uLlN0YXRlLkRPV04pXHJcbiAgICAgICAgICAgICAgICAgICAgcmV0dXJuO1xyXG5cclxuICAgICAgICAgICAgICAgIEFQSVNlcnZpY2UuZ2V0UG9zaXRpb24oKS50aGVuKGZ1bmN0aW9uKHJlc3BvbnNlKSB7XHJcbiAgICAgICAgICAgICAgICAgICAgdmFyIHBvc2l0aW9uID0ge1xyXG4gICAgICAgICAgICAgICAgICAgICAgICBsbmc6IHJlc3BvbnNlLmNvb3Jkcy5sb25naXR1ZGUsXHJcbiAgICAgICAgICAgICAgICAgICAgICAgIGxhdDogcmVzcG9uc2UuY29vcmRzLmxhdGl0dWRlXHJcbiAgICAgICAgICAgICAgICAgICAgfTtcclxuICAgICAgICAgICAgICAgICAgICBcclxuICAgICAgICAgICAgICAgICAgICBzZWxmLm1hcC5zZXRDZW50ZXIocG9zaXRpb24pO1xyXG4gICAgICAgICAgICAgICAgICAgIFxyXG4gICAgICAgICAgICAgICAgICAgIEhlcmVNYXBVdGlsc1NlcnZpY2Uuem9vbShzZWxmLm1hcCwgMTcsIC4wOCk7XHJcblxyXG4gICAgICAgICAgICAgICAgICAgIGlmIChzZWxmLnVzZXJNYXJrZXIpIHtcclxuICAgICAgICAgICAgICAgICAgICAgICAgc2VsZi51c2VyTWFya2VyLnNldFBvc2l0aW9uKHBvc2l0aW9uKTtcclxuICAgICAgICAgICAgICAgICAgICAgICAgcmV0dXJuO1xyXG4gICAgICAgICAgICAgICAgICAgIH1cclxuICAgICAgICAgICAgICAgICAgICBcclxuICAgICAgICAgICAgICAgICAgICBzZWxmLnVzZXJNYXJrZXIgPSBNYXJrZXJzU2VydmljZS5hZGRVc2VyTWFya2VyKHNlbGYubWFwLCB7XHJcbiAgICAgICAgICAgICAgICAgICAgICAgIHBvczogcG9zaXRpb25cclxuICAgICAgICAgICAgICAgICAgICB9KTtcclxuICAgICAgICAgICAgICAgIH0pO1xyXG4gICAgICAgICAgICB9XHJcbiAgICAgICAgfSk7XHJcblxyXG4gICAgICAgIHVzZXJDb250cm9sLmFkZENoaWxkKHVzZXJDb250cm9sQnV0dG9uKTtcclxuXHJcbiAgICAgICAgcmV0dXJuIHVzZXJDb250cm9sO1xyXG4gICAgfVxyXG5cclxuICAgIGZ1bmN0aW9uIHNldENvbnRyb2xzQWxpZ25tZW50KE5BTUVTKSB7XHJcbiAgICAgICAgaWYgKCFVSS5pc1ZhbGlkQWxpZ25tZW50KHRoaXMuYWxpZ25tZW50KSlcclxuICAgICAgICAgICAgcmV0dXJuO1xyXG5cclxuICAgICAgICBmb3IgKHZhciBpZCBpbiBOQU1FUykge1xyXG4gICAgICAgICAgICB2YXIgY29udHJvbCA9IHRoaXMudWkuZ2V0Q29udHJvbChOQU1FU1tpZF0pO1xyXG5cclxuICAgICAgICAgICAgaWYgKCFOQU1FUy5oYXNPd25Qcm9wZXJ0eShpZCkgfHwgIWNvbnRyb2wpXHJcbiAgICAgICAgICAgICAgICBjb250aW51ZTtcclxuXHJcbiAgICAgICAgICAgIGNvbnRyb2wuc2V0QWxpZ25tZW50KHRoaXMuYWxpZ25tZW50KTtcclxuICAgICAgICB9XHJcbiAgICB9XHJcblxyXG4gICAgZnVuY3Rpb24gaXNWYWxpZEFsaWdubWVudChhbGlnbm1lbnQpIHtcclxuICAgICAgICByZXR1cm4gISEoQ09OU1RTLkNPTlRST0xTLlBPU0lUSU9OUy5pbmRleE9mKGFsaWdubWVudCkgKyAxKTtcclxuICAgIH1cclxuXHJcbn07IiwibW9kdWxlLmV4cG9ydHMgPSBmdW5jdGlvbigpIHtcclxuICAgIHZhciBvcHRpb25zID0ge307XHJcbiAgICB2YXIgREVGQVVMVF9BUElfVkVSU0lPTiA9IFwiMy4wXCI7XHJcblxyXG4gICAgdGhpcy4kZ2V0ID0gZnVuY3Rpb24oKXtcclxuICAgICAgICByZXR1cm4ge1xyXG4gICAgICAgICAgICBhcHBfaWQ6IG9wdGlvbnMuYXBwX2lkLFxyXG4gICAgICAgICAgICBhcHBfY29kZTogb3B0aW9ucy5hcHBfY29kZSxcclxuICAgICAgICAgICAgYXBpVmVyc2lvbjogb3B0aW9ucy5hcGlWZXJzaW9uIHx8IERFRkFVTFRfQVBJX1ZFUlNJT04sXHJcbiAgICAgICAgICAgIHVzZUhUVFBTOiBvcHRpb25zLnVzZUhUVFBTLFxyXG4gICAgICAgICAgICB1c2VDSVQ6ICEhb3B0aW9ucy51c2VDSVRcclxuICAgICAgICB9XHJcbiAgICB9O1xyXG5cclxuICAgIHRoaXMuc2V0T3B0aW9ucyA9IGZ1bmN0aW9uKG9wdHMpe1xyXG4gICAgICAgIG9wdGlvbnMgPSBvcHRzO1xyXG4gICAgfTtcclxufTsiLCJtb2R1bGUuZXhwb3J0cyA9IGZ1bmN0aW9uICgkcm9vdFNjb3BlLCAkdGltZW91dCwgQ09OU1RTKSB7XHJcbiAgICByZXR1cm4ge1xyXG4gICAgICAgIHRocm90dGxlOiB0aHJvdHRsZSxcclxuICAgICAgICBjcmVhdGVTY3JpcHRUYWc6IGNyZWF0ZVNjcmlwdFRhZyxcclxuICAgICAgICBjcmVhdGVMaW5rVGFnOiBjcmVhdGVMaW5rVGFnLFxyXG4gICAgICAgIHJ1blNjb3BlRGlnZXN0SWZOZWVkOiBydW5TY29wZURpZ2VzdElmTmVlZCxcclxuICAgICAgICBpc1ZhbGlkQ29vcmRzOiBpc1ZhbGlkQ29vcmRzLFxyXG4gICAgICAgIGFkZEV2ZW50TGlzdGVuZXI6IGFkZEV2ZW50TGlzdGVuZXIsXHJcbiAgICAgICAgem9vbTogem9vbSxcclxuICAgICAgICBnZW5lcmF0ZUlkOiBnZW5lcmF0ZUlkXHJcbiAgICB9O1xyXG5cclxuICAgIC8vI3JlZ2lvbiBQVUJMSUNcclxuICAgIGZ1bmN0aW9uIHRocm90dGxlKGZuLCBwZXJpb2QpIHtcclxuICAgICAgICB2YXIgdGltZW91dCA9IG51bGw7XHJcblxyXG4gICAgICAgIHJldHVybiBmdW5jdGlvbiAoKSB7XHJcbiAgICAgICAgICAgIGlmICgkdGltZW91dClcclxuICAgICAgICAgICAgICAgICR0aW1lb3V0LmNhbmNlbCh0aW1lb3V0KTtcclxuXHJcbiAgICAgICAgICAgIHRpbWVvdXQgPSAkdGltZW91dChmbiwgcGVyaW9kKTtcclxuICAgICAgICB9XHJcbiAgICB9XHJcblxyXG4gICAgZnVuY3Rpb24gYWRkRXZlbnRMaXN0ZW5lcihvYmosIGV2ZW50TmFtZSwgbGlzdGVuZXIsIHVzZUNhcHR1cmUpIHtcclxuICAgICAgICB2YXIgX3VzZUNhcHR1cmUgPSAhIXVzZUNhcHR1cmU7XHJcblxyXG4gICAgICAgIG9iai5hZGRFdmVudExpc3RlbmVyKGV2ZW50TmFtZSwgbGlzdGVuZXIsIF91c2VDYXB0dXJlKTtcclxuICAgIH1cclxuXHJcbiAgICBmdW5jdGlvbiBydW5TY29wZURpZ2VzdElmTmVlZChzY29wZSwgY2IpIHtcclxuICAgICAgICBpZiAoc2NvcGUuJHJvb3QgJiYgc2NvcGUuJHJvb3QuJCRwaGFzZSAhPT0gJyRhcHBseScgJiYgc2NvcGUuJHJvb3QuJCRwaGFzZSAhPT0gJyRkaWdlc3QnKSB7XHJcbiAgICAgICAgICAgIHNjb3BlLiRkaWdlc3QoY2IgfHwgYW5ndWxhci5ub29wKTtcclxuICAgICAgICAgICAgcmV0dXJuIHRydWU7XHJcbiAgICAgICAgfVxyXG4gICAgICAgIHJldHVybiBmYWxzZTtcclxuICAgIH1cclxuXHJcbiAgICBmdW5jdGlvbiBjcmVhdGVTY3JpcHRUYWcoYXR0cnMpIHtcclxuICAgICAgICB2YXIgc2NyaXB0ID0gZG9jdW1lbnQuZ2V0RWxlbWVudEJ5SWQoYXR0cnMuc3JjKTtcclxuXHJcbiAgICAgICAgaWYgKHNjcmlwdClcclxuICAgICAgICAgICAgcmV0dXJuIGZhbHNlO1xyXG5cclxuICAgICAgICBzY3JpcHQgPSBkb2N1bWVudC5jcmVhdGVFbGVtZW50KCdzY3JpcHQnKTtcclxuICAgICAgICBzY3JpcHQudHlwZSA9ICd0ZXh0L2phdmFzY3JpcHQnO1xyXG4gICAgICAgIHNjcmlwdC5pZCA9IGF0dHJzLnNyYztcclxuICAgICAgICBfc2V0QXR0cnMoc2NyaXB0LCBhdHRycyk7XHJcblxyXG4gICAgICAgIHJldHVybiBzY3JpcHQ7XHJcbiAgICB9XHJcblxyXG4gICAgZnVuY3Rpb24gY3JlYXRlTGlua1RhZyhhdHRycykge1xyXG4gICAgICAgIHZhciBsaW5rID0gZG9jdW1lbnQuZ2V0RWxlbWVudEJ5SWQoYXR0cnMuaHJlZik7XHJcblxyXG4gICAgICAgIGlmIChsaW5rKVxyXG4gICAgICAgICAgICByZXR1cm4gZmFsc2U7XHJcblxyXG4gICAgICAgIGxpbmsgPSBkb2N1bWVudC5jcmVhdGVFbGVtZW50KCdsaW5rJyk7XHJcbiAgICAgICAgbGluay5pZCA9IGF0dHJzLmhyZWY7XHJcbiAgICAgICAgX3NldEF0dHJzKGxpbmssIGF0dHJzKTtcclxuXHJcbiAgICAgICAgcmV0dXJuIGxpbms7XHJcbiAgICB9XHJcblxyXG4gICAgZnVuY3Rpb24gaXNWYWxpZENvb3Jkcyhjb29yZHMpIHtcclxuICAgICAgICByZXR1cm4gY29vcmRzICYmXHJcbiAgICAgICAgICAgICh0eXBlb2YgY29vcmRzLmxhdGl0dWRlID09PSAnc3RyaW5nJyB8fCB0eXBlb2YgY29vcmRzLmxhdGl0dWRlID09PSAnbnVtYmVyJykgJiZcclxuICAgICAgICAgICAgKHR5cGVvZiBjb29yZHMubG9uZ2l0dWRlID09PSAnc3RyaW5nJyB8fCB0eXBlb2YgY29vcmRzLmxvbmdpdHVkZSA9PT0gJ251bWJlcicpXHJcbiAgICB9XHJcblxyXG4gICAgZnVuY3Rpb24gem9vbShtYXAsIHZhbHVlLCBzdGVwKSB7XHJcbiAgICAgICAgdmFyIGN1cnJlbnRab29tID0gbWFwLmdldFpvb20oKSxcclxuICAgICAgICAgICAgX3N0ZXAgPSBzdGVwIHx8IENPTlNUUy5BTklNQVRJT05fWk9PTV9TVEVQLFxyXG4gICAgICAgICAgICBmYWN0b3IgPSBjdXJyZW50Wm9vbSA+PSB2YWx1ZSA/IC0xIDogMSxcclxuICAgICAgICAgICAgaW5jcmVtZW50ID0gc3RlcCAqIGZhY3RvcjtcclxuXHJcbiAgICAgICAgcmV0dXJuIChmdW5jdGlvbiB6b29tKCkge1xyXG4gICAgICAgICAgICBpZiAoIXN0ZXAgfHwgTWF0aC5mbG9vcihjdXJyZW50Wm9vbSkgPT09IE1hdGguZmxvb3IodmFsdWUpKSB7XHJcbiAgICAgICAgICAgICAgICBtYXAuc2V0Wm9vbSh2YWx1ZSk7XHJcbiAgICAgICAgICAgICAgICByZXR1cm47XHJcbiAgICAgICAgICAgIH1cclxuXHJcbiAgICAgICAgICAgIGN1cnJlbnRab29tICs9IGluY3JlbWVudDtcclxuICAgICAgICAgICAgbWFwLnNldFpvb20oY3VycmVudFpvb20pO1xyXG5cclxuICAgICAgICAgICAgcmVxdWVzdEFuaW1hdGlvbkZyYW1lKHpvb20pO1xyXG4gICAgICAgIH0pKCk7XHJcbiAgICB9XHJcblxyXG4gICAgZnVuY3Rpb24gZ2VuZXJhdGVJZCgpIHtcclxuICAgICAgICB2YXIgbWFzayA9ICd4eHh4eHh4eC14eHh4LTR4eHgteXh4eC14eHh4eHh4eHh4eHgnLFxyXG4gICAgICAgICAgICByZWdleHAgPSAvW3h5XS9nLFxyXG4gICAgICAgICAgICBkID0gbmV3IERhdGUoKS5nZXRUaW1lKCksXHJcbiAgICAgICAgICAgIHV1aWQgPSBtYXNrLnJlcGxhY2UocmVnZXhwLCBmdW5jdGlvbiAoYykge1xyXG4gICAgICAgICAgICAgICAgdmFyIHIgPSAoZCArIE1hdGgucmFuZG9tKCkgKiAxNikgJSAxNiB8IDA7XHJcbiAgICAgICAgICAgICAgICBkID0gTWF0aC5mbG9vcihkIC8gMTYpO1xyXG4gICAgICAgICAgICByZXR1cm4gKGMgPT0gJ3gnID8gciA6IChyICYgMHgzIHwgMHg4KSkudG9TdHJpbmcoMTYpO1xyXG4gICAgICAgIH0pO1xyXG4gICAgICAgIFxyXG4gICAgICAgIHJldHVybiB1dWlkO1xyXG4gICAgfVxyXG5cclxuICAgIC8vI2VuZHJlZ2lvbiBQVUJMSUMgXHJcblxyXG4gICAgZnVuY3Rpb24gX3NldEF0dHJzKGVsLCBhdHRycykge1xyXG4gICAgICAgIGlmICghZWwgfHwgIWF0dHJzKVxyXG4gICAgICAgICAgICB0aHJvdyBuZXcgRXJyb3IoJ01pc3NlZCBhdHRyaWJ1dGVzJyk7XHJcblxyXG4gICAgICAgIGZvciAodmFyIGtleSBpbiBhdHRycykge1xyXG4gICAgICAgICAgICBpZiAoIWF0dHJzLmhhc093blByb3BlcnR5KGtleSkpXHJcbiAgICAgICAgICAgICAgICBjb250aW51ZTtcclxuXHJcbiAgICAgICAgICAgIGVsW2tleV0gPSBhdHRyc1trZXldO1xyXG4gICAgICAgIH1cclxuICAgIH1cclxufTsiLCJtb2R1bGUuZXhwb3J0cyA9IGZ1bmN0aW9uKE1hcmtlckludGVyZmFjZSl7XHJcbiAgICBmdW5jdGlvbiBEZWZhdWx0TWFya2VyKHBsYWNlKXtcclxuICAgICAgICB0aGlzLnBsYWNlID0gcGxhY2U7XHJcbiAgICAgICAgdGhpcy5zZXRDb29yZHMoKTtcclxuICAgIH1cclxuXHJcbiAgICB2YXIgcHJvdG8gPSBEZWZhdWx0TWFya2VyLnByb3RvdHlwZSA9IG5ldyBNYXJrZXJJbnRlcmZhY2UoKTtcclxuICAgIHByb3RvLmNvbnN0cnVjdG9yID0gRGVmYXVsdE1hcmtlcjtcclxuXHJcbiAgICBwcm90by5jcmVhdGUgPSBjcmVhdGU7XHJcblxyXG4gICAgcmV0dXJuIERlZmF1bHRNYXJrZXI7XHJcbiAgICBcclxuICAgIGZ1bmN0aW9uIGNyZWF0ZSgpe1xyXG4gICAgICAgIHZhciBtYXJrZXIgPSBuZXcgSC5tYXAuTWFya2VyKHRoaXMuY29vcmRzKTtcclxuICAgICAgICBcclxuICAgICAgICB0aGlzLmFkZEluZm9CdWJibGUobWFya2VyKTtcclxuICAgICAgICBcclxuICAgICAgICByZXR1cm4gbWFya2VyO1xyXG4gICAgfVxyXG59IiwibW9kdWxlLmV4cG9ydHMgPSBmdW5jdGlvbihNYXJrZXJJbnRlcmZhY2Upe1xyXG4gICAgZnVuY3Rpb24gRE9NTWFya2VyKHBsYWNlKXtcclxuICAgICAgICB0aGlzLnBsYWNlID0gcGxhY2U7XHJcbiAgICAgICAgdGhpcy5zZXRDb29yZHMoKTtcclxuICAgIH1cclxuXHJcbiAgICB2YXIgcHJvdG8gPSBET01NYXJrZXIucHJvdG90eXBlID0gbmV3IE1hcmtlckludGVyZmFjZSgpO1xyXG4gICAgcHJvdG8uY29uc3RydWN0b3IgPSBET01NYXJrZXI7XHJcblxyXG4gICAgcHJvdG8uY3JlYXRlID0gY3JlYXRlO1xyXG4gICAgcHJvdG8uZ2V0SWNvbiA9IGdldEljb247XHJcbiAgICBwcm90by5zZXR1cEV2ZW50cyA9IHNldHVwRXZlbnRzO1xyXG5cclxuICAgIHJldHVybiBET01NYXJrZXI7XHJcbiAgICBcclxuICAgIGZ1bmN0aW9uIGNyZWF0ZSgpe1xyXG4gICAgICAgIHZhciBtYXJrZXIgPSBuZXcgSC5tYXAuRG9tTWFya2VyKHRoaXMuY29vcmRzLCB7XHJcbiAgICAgICAgICAgIGljb246IHRoaXMuZ2V0SWNvbigpXHJcbiAgICAgICAgfSk7XHJcbiAgICAgICAgXHJcbiAgICAgICAgdGhpcy5hZGRJbmZvQnViYmxlKG1hcmtlcik7XHJcbiAgICAgICAgXHJcbiAgICAgICAgcmV0dXJuIG1hcmtlcjtcclxuICAgIH1cclxuICAgIFxyXG4gICAgZnVuY3Rpb24gZ2V0SWNvbigpe1xyXG4gICAgICAgIHZhciBpY29uID0gdGhpcy5wbGFjZS5tYXJrdXA7XHJcbiAgICAgICAgIGlmKCFpY29uKVxyXG4gICAgICAgICAgICB0aHJvdyBuZXcgRXJyb3IoJ21hcmt1cCBtaXNzZWQnKTtcclxuXHJcbiAgICAgICAgcmV0dXJuIG5ldyBILm1hcC5Eb21JY29uKGljb24pO1xyXG4gICAgfVxyXG4gICAgXHJcbiAgICBmdW5jdGlvbiBzZXR1cEV2ZW50cyhlbCwgZXZlbnRzLCByZW1vdmUpe1xyXG4gICAgICAgIHZhciBtZXRob2QgPSByZW1vdmUgPyAncmVtb3ZlRXZlbnRMaXN0ZW5lcicgOiAnYWRkRXZlbnRMaXN0ZW5lcic7XHJcblxyXG4gICAgICAgIGZvcih2YXIga2V5IGluIGV2ZW50cykge1xyXG4gICAgICAgICAgICBpZighZXZlbnRzLmhhc093blByb3BlcnR5KGtleSkpXHJcbiAgICAgICAgICAgICAgICBjb250aW51ZTtcclxuXHJcbiAgICAgICAgICAgIGVsW21ldGhvZF0uY2FsbChudWxsLCBrZXksIGV2ZW50c1trZXldKTtcclxuICAgICAgICB9XHJcbiAgICB9XHJcbn0iLCJ2YXIgbWFya2VySW50ZXJmYWNlID0gcmVxdWlyZSgnLi9tYXJrZXIuanMnKSxcclxuXHRkZWZhdWx0TWFya2VyID0gcmVxdWlyZSgnLi9kZWZhdWx0Lm1hcmtlci5qcycpLFxyXG5cdGRvbU1hcmtlciA9IHJlcXVpcmUoJy4vZG9tLm1hcmtlci5qcycpLFxyXG5cdHN2Z01hcmtlciA9IHJlcXVpcmUoJy4vc3ZnLm1hcmtlci5qcycpLFxyXG4gICAgbWFya2Vyc1NlcnZpY2UgPSByZXF1aXJlKCcuL21hcmtlcnMuc2VydmljZS5qcycpO1xyXG5cclxuYW5ndWxhci5tb2R1bGUoJ21hcmtlci1pbnRlcmZhY2UnLCBbXSkuZmFjdG9yeSgnTWFya2VySW50ZXJmYWNlJywgbWFya2VySW50ZXJmYWNlKTtcclxuYW5ndWxhci5tb2R1bGUoJ2RlZmF1bHQtbWFya2VyJywgW10pLmZhY3RvcnkoJ0RlZmF1bHRNYXJrZXInLCBkZWZhdWx0TWFya2VyKTtcclxuYW5ndWxhci5tb2R1bGUoJ2RvbS1tYXJrZXInLCBbXSkuZmFjdG9yeSgnRE9NTWFya2VyJywgZG9tTWFya2VyKTtcclxuYW5ndWxhci5tb2R1bGUoJ3N2Zy1tYXJrZXInLCBbXSkuZmFjdG9yeSgnU1ZHTWFya2VyJywgc3ZnTWFya2VyKTtcclxuXHJcbmFuZ3VsYXIubW9kdWxlKCdtYXJrZXJzLXNlcnZpY2UnLCBbXSkuc2VydmljZSgnTWFya2Vyc1NlcnZpY2UnLCBtYXJrZXJzU2VydmljZSk7XHJcblxyXG52YXIgYXBwID0gYW5ndWxhci5tb2R1bGUoJ21hcmtlcnMtbW9kdWxlJywgW1xyXG5cdCdtYXJrZXItaW50ZXJmYWNlJyxcclxuICAgICdkZWZhdWx0LW1hcmtlcicsXHJcbiAgICAnZG9tLW1hcmtlcicsXHJcbiAgICAnbWFya2Vycy1zZXJ2aWNlJyxcclxuICAgICdzdmctbWFya2VyJ1xyXG5dKTtcclxuXHJcbm1vZHVsZS5leHBvcnRzID0gYXBwOyIsIm1vZHVsZS5leHBvcnRzID0gZnVuY3Rpb24oKXtcclxuICAgIGZ1bmN0aW9uIE1hcmtlckludGVyZmFjZSgpe1xyXG4gICAgICAgIHRocm93IG5ldyBFcnJvcignQWJzdHJhY3QgY2xhc3MhIFRoZSBJbnN0YW5jZSBzaG91bGQgYmUgY3JlYXRlZCcpO1xyXG4gICAgfVxyXG4gICAgXHJcbiAgICB2YXIgcHJvdG8gPSBNYXJrZXJJbnRlcmZhY2UucHJvdG90eXBlO1xyXG4gICAgXHJcbiAgICBwcm90by5jcmVhdGUgPSBjcmVhdGU7XHJcbiAgICBwcm90by5zZXRDb29yZHMgPSBzZXRDb29yZHM7XHJcbiAgICBwcm90by5hZGRJbmZvQnViYmxlID0gYWRkSW5mb0J1YmJsZTtcclxuICAgIFxyXG4gICAgZnVuY3Rpb24gTWFya2VyKCl7fVxyXG4gICAgXHJcbiAgICBNYXJrZXIucHJvdG90eXBlID0gcHJvdG87XHJcbiAgICBcclxuICAgIHJldHVybiBNYXJrZXI7XHJcbiAgICBcclxuICAgIGZ1bmN0aW9uIGNyZWF0ZSgpe1xyXG4gICAgICAgIHRocm93IG5ldyBFcnJvcignY3JlYXRlOjogbm90IGltcGxlbWVudGVkJyk7IFxyXG4gICAgfVxyXG4gICAgXHJcbiAgICBmdW5jdGlvbiBzZXRDb29yZHMoKXtcclxuICAgICAgICAgdGhpcy5jb29yZHMgPSB7XHJcbiAgICAgICAgICAgIGxhdDogdGhpcy5wbGFjZS5wb3MubGF0LFxyXG4gICAgICAgICAgICBsbmc6IHRoaXMucGxhY2UucG9zLmxuZ1xyXG4gICAgICAgIH1cclxuICAgIH1cclxuICAgIFxyXG4gICAgZnVuY3Rpb24gYWRkSW5mb0J1YmJsZShtYXJrZXIpe1xyXG4gICAgICAgIGlmKCF0aGlzLnBsYWNlLnBvcHVwKVxyXG4gICAgICAgICAgICByZXR1cm47XHJcbiAgICAgICAgICAgIFxyXG4gICAgICAgIG1hcmtlci5zZXREYXRhKHRoaXMucGxhY2UucG9wdXApXHJcbiAgICB9XHJcbn0iLCJtb2R1bGUuZXhwb3J0cyA9IGZ1bmN0aW9uKERlZmF1bHRNYXJrZXIsIERPTU1hcmtlciwgU1ZHTWFya2VyLCBDT05TVFMpIHtcclxuXHJcbiAgICB2YXIgTUFSS0VSX1RZUEVTID0gQ09OU1RTLk1BUktFUl9UWVBFUztcclxuXHJcbiAgICByZXR1cm4ge1xyXG4gICAgICAgIGFkZE1hcmtlcnNUb01hcDogYWRkTWFya2Vyc1RvTWFwLFxyXG4gICAgICAgIGFkZFVzZXJNYXJrZXI6IGFkZFVzZXJNYXJrZXIsXHJcbiAgICAgICAgdXBkYXRlTWFya2VyczogdXBkYXRlTWFya2VycyxcclxuICAgICAgICBpc01hcmtlckluc3RhbmNlOiBpc01hcmtlckluc3RhbmNlXHJcbiAgICB9XHJcblxyXG4gICAgZnVuY3Rpb24gaXNNYXJrZXJJbnN0YW5jZSh0YXJnZXQpIHtcclxuICAgICAgICByZXR1cm4gdGFyZ2V0IGluc3RhbmNlb2YgSC5tYXAuTWFya2VyIHx8IHRhcmdldCBpbnN0YW5jZW9mIEgubWFwLkRvbU1hcmtlcjtcclxuICAgIH1cclxuXHJcbiAgICBmdW5jdGlvbiBhZGRVc2VyTWFya2VyKG1hcCwgcGxhY2UpIHtcclxuICAgICAgICBpZihtYXAudXNlck1hcmtlcilcclxuICAgICAgICAgICAgcmV0dXJuIG1hcC51c2VyTWFya2VyO1xyXG4gICAgICAgIFxyXG4gICAgICAgIHBsYWNlLm1hcmt1cCA9ICc8c3ZnIHdpZHRoPVwiMzVweFwiIGhlaWdodD1cIjM1cHhcIiB2aWV3Qm94PVwiMCAwIDkwIDkwXCIgdmVyc2lvbj1cIjEuMVwiIHhtbG5zPVwiaHR0cDovL3d3dy53My5vcmcvMjAwMC9zdmdcIiB4bWxuczp4bGluaz1cImh0dHA6Ly93d3cudzMub3JnLzE5OTkveGxpbmtcIj4nICtcclxuICAgICAgICAgICAgJzxkZWZzPjxjaXJjbGUgaWQ9XCJwYXRoLTFcIiBjeD1cIjMwMlwiIGN5PVwiODAyXCIgcj1cIjE1XCI+PC9jaXJjbGU+JyArXHJcbiAgICAgICAgICAgICc8bWFzayBpZD1cIm1hc2stMlwiIG1hc2tDb250ZW50VW5pdHM9XCJ1c2VyU3BhY2VPblVzZVwiIG1hc2tVbml0cz1cIm9iamVjdEJvdW5kaW5nQm94XCIgeD1cIi0zMFwiIHk9XCItMzBcIiB3aWR0aD1cIjkwXCIgaGVpZ2h0PVwiOTBcIj4nICtcclxuICAgICAgICAgICAgJzxyZWN0IHg9XCIyNTdcIiB5PVwiNzU3XCIgd2lkdGg9XCI5MFwiIGhlaWdodD1cIjkwXCIgZmlsbD1cIndoaXRlXCI+PC9yZWN0Pjx1c2UgeGxpbms6aHJlZj1cIiNwYXRoLTFcIiBmaWxsPVwiYmxhY2tcIj48L3VzZT4nICtcclxuICAgICAgICAgICAgJzwvbWFzaz48L2RlZnM+PGcgaWQ9XCJQYWdlLTFcIiBzdHJva2U9XCJub25lXCIgc3Ryb2tlLXdpZHRoPVwiMVwiIGZpbGw9XCJub25lXCIgZmlsbC1ydWxlPVwiZXZlbm9kZFwiPicgK1xyXG4gICAgICAgICAgICAnPGcgaWQ9XCJTZXJ2aWNlLU9wdGlvbnMtLS1kaXJlY3Rpb25zLS0tbWFwXCIgdHJhbnNmb3JtPVwidHJhbnNsYXRlKC0yNTcuMDAwMDAwLCAtNzU3LjAwMDAwMClcIj48ZyBpZD1cIk92YWwtMTVcIj4nICtcclxuICAgICAgICAgICAgJzx1c2UgZmlsbD1cIiNGRkZGRkZcIiBmaWxsLXJ1bGU9XCJldmVub2RkXCIgeGxpbms6aHJlZj1cIiNwYXRoLTFcIj48L3VzZT4nICtcclxuICAgICAgICAgICAgJzx1c2Ugc3Ryb2tlLW9wYWNpdHk9XCIwLjI5NjEzOTA0XCIgc3Ryb2tlPVwiIzNGMzRBMFwiIG1hc2s9XCJ1cmwoI21hc2stMilcIiBzdHJva2Utd2lkdGg9XCI2MFwiIHhsaW5rOmhyZWY9XCIjcGF0aC0xXCI+PC91c2U+JyArXHJcbiAgICAgICAgICAgICc8dXNlIHN0cm9rZT1cIiMzRjM0QTBcIiBzdHJva2Utd2lkdGg9XCI1XCIgeGxpbms6aHJlZj1cIiNwYXRoLTFcIj48L3VzZT48L2c+PC9nPjwvZz48L3N2Zz4nO1xyXG5cclxuICAgICAgICBtYXAudXNlck1hcmtlciA9IG5ldyBTVkdNYXJrZXIocGxhY2UpLmNyZWF0ZSgpO1xyXG5cclxuICAgICAgICBtYXAuYWRkT2JqZWN0KG1hcC51c2VyTWFya2VyKTtcclxuXHJcbiAgICAgICAgcmV0dXJuIG1hcC51c2VyTWFya2VyO1xyXG4gICAgfVxyXG5cclxuICAgIGZ1bmN0aW9uIGFkZE1hcmtlcnNUb01hcChtYXAsIHBsYWNlcykge1xyXG4gICAgICAgIGlmICghcGxhY2VzIHx8ICFwbGFjZXMubGVuZ3RoKVxyXG4gICAgICAgICAgICByZXR1cm47XHJcblxyXG4gICAgICAgIGlmICghKG1hcCBpbnN0YW5jZW9mIEguTWFwKSlcclxuICAgICAgICAgICAgdGhyb3cgbmV3IEVycm9yKCdVbnN1cHBvcnRlZCBtYXAgaW5zdGFuY2UnKTtcclxuXHJcbiAgICAgICAgaWYgKCFtYXAubWFya2Vyc0dyb3VwKVxyXG4gICAgICAgICAgICBtYXAubWFya2Vyc0dyb3VwID0gbmV3IEgubWFwLkdyb3VwKCk7XHJcblxyXG4gICAgICAgIHBsYWNlcy5mb3JFYWNoKGZ1bmN0aW9uKHBsYWNlLCBpKSB7XHJcbiAgICAgICAgICAgIHZhciBjcmVhdG9yID0gX2dldE1hcmtlckNyZWF0b3IocGxhY2UpLFxyXG4gICAgICAgICAgICAgICAgbWFya2VyID0gcGxhY2UuZHJhZ2dhYmxlID8gX2RyYWdnYWJsZU1hcmtlck1peGluKGNyZWF0b3IuY3JlYXRlKCkpIDogY3JlYXRvci5jcmVhdGUoKTtcclxuXHJcbiAgICAgICAgICAgIG1hcC5tYXJrZXJzR3JvdXAuYWRkT2JqZWN0KG1hcmtlcik7XHJcbiAgICAgICAgfSk7XHJcblxyXG4gICAgICAgIG1hcC5hZGRPYmplY3QobWFwLm1hcmtlcnNHcm91cCk7XHJcbiAgICAgICAgXHJcbiAgICAgICAgbWFwLnNldFZpZXdCb3VuZHMobWFwLm1hcmtlcnNHcm91cC5nZXRCb3VuZHMoKSk7XHJcbiAgICB9XHJcblxyXG4gICAgZnVuY3Rpb24gdXBkYXRlTWFya2VycyhtYXAsIHBsYWNlcykge1xyXG4gICAgICAgIGlmIChtYXAubWFya2Vyc0dyb3VwKSB7XHJcbiAgICAgICAgICAgIG1hcC5tYXJrZXJzR3JvdXAucmVtb3ZlQWxsKCk7XHJcbiAgICAgICAgICAgIG1hcC5yZW1vdmVPYmplY3QobWFwLm1hcmtlcnNHcm91cCk7XHJcbiAgICAgICAgICAgIG1hcC5tYXJrZXJzR3JvdXAgPSBudWxsO1xyXG4gICAgICAgIH1cclxuXHJcbiAgICAgICAgYWRkTWFya2Vyc1RvTWFwLmFwcGx5KG51bGwsIGFyZ3VtZW50cyk7XHJcbiAgICB9XHJcblxyXG4gICAgZnVuY3Rpb24gX2dldE1hcmtlckNyZWF0b3IocGxhY2UpIHtcclxuICAgICAgICB2YXIgQ29uY3JldGVNYXJrZXIsXHJcbiAgICAgICAgICAgIHR5cGUgPSBwbGFjZS50eXBlID8gcGxhY2UudHlwZS50b1VwcGVyQ2FzZSgpIDogbnVsbDtcclxuXHJcbiAgICAgICAgc3dpdGNoICh0eXBlKSB7XHJcbiAgICAgICAgICAgIGNhc2UgTUFSS0VSX1RZUEVTLkRPTTpcclxuICAgICAgICAgICAgICAgIENvbmNyZXRlTWFya2VyID0gRE9NTWFya2VyO1xyXG4gICAgICAgICAgICAgICAgYnJlYWs7XHJcbiAgICAgICAgICAgIGNhc2UgTUFSS0VSX1RZUEVTLlNWRzpcclxuICAgICAgICAgICAgICAgIENvbmNyZXRlTWFya2VyID0gU1ZHTWFya2VyO1xyXG4gICAgICAgICAgICAgICAgYnJlYWs7XHJcbiAgICAgICAgICAgIGRlZmF1bHQ6XHJcbiAgICAgICAgICAgICAgICBDb25jcmV0ZU1hcmtlciA9IERlZmF1bHRNYXJrZXI7XHJcbiAgICAgICAgfVxyXG5cclxuICAgICAgICByZXR1cm4gbmV3IENvbmNyZXRlTWFya2VyKHBsYWNlKTtcclxuICAgIH1cclxuXHJcbiAgICBmdW5jdGlvbiBfZHJhZ2dhYmxlTWFya2VyTWl4aW4obWFya2VyKSB7XHJcbiAgICAgICAgbWFya2VyLmRyYWdnYWJsZSA9IHRydWU7XHJcblxyXG4gICAgICAgIHJldHVybiBtYXJrZXI7XHJcbiAgICB9XHJcblxyXG59OyIsIm1vZHVsZS5leHBvcnRzID0gZnVuY3Rpb24oTWFya2VySW50ZXJmYWNlKXtcclxuICAgIGZ1bmN0aW9uIFNWR01hcmtlcihwbGFjZSl7XHJcbiAgICAgICAgdGhpcy5wbGFjZSA9IHBsYWNlO1xyXG4gICAgICAgIHRoaXMuc2V0Q29vcmRzKCk7XHJcbiAgICB9XHJcbiAgICBcclxuICAgIHZhciBwcm90byA9IFNWR01hcmtlci5wcm90b3R5cGUgPSBuZXcgTWFya2VySW50ZXJmYWNlKCk7XHJcbiAgICBwcm90by5jb25zdHJ1Y3RvciA9IFNWR01hcmtlcjtcclxuICAgIFxyXG4gICAgcHJvdG8uY3JlYXRlID0gY3JlYXRlO1xyXG4gICAgcHJvdG8uZ2V0SWNvbiA9IGdldEljb247XHJcbiAgICBcclxuICAgIHJldHVybiBTVkdNYXJrZXI7XHJcbiAgICBcclxuICAgIGZ1bmN0aW9uIGNyZWF0ZSgpe1xyXG4gICAgICAgIHZhciBtYXJrZXIgPSBuZXcgSC5tYXAuTWFya2VyKHRoaXMuY29vcmRzLCB7XHJcbiAgICAgICAgICAgIGljb246IHRoaXMuZ2V0SWNvbigpLFxyXG4gICAgICAgIH0pO1xyXG4gICAgICAgIFxyXG4gICAgICAgIHRoaXMuYWRkSW5mb0J1YmJsZShtYXJrZXIpO1xyXG4gICAgICAgIFxyXG4gICAgICAgIHJldHVybiBtYXJrZXI7XHJcbiAgICB9XHJcbiAgICBcclxuICAgIGZ1bmN0aW9uIGdldEljb24oKXtcclxuICAgICAgICB2YXIgaWNvbiA9IHRoaXMucGxhY2UubWFya3VwO1xyXG4gICAgICAgICBpZighaWNvbilcclxuICAgICAgICAgICAgdGhyb3cgbmV3IEVycm9yKCdtYXJrdXAgbWlzc2VkJyk7XHJcblxyXG4gICAgICAgIHJldHVybiBuZXcgSC5tYXAuSWNvbihpY29uKTtcclxuICAgIH1cclxufSIsInZhciByb3V0ZXNTZXJ2aWNlID0gcmVxdWlyZSgnLi9yb3V0ZXMuc2VydmljZS5qcycpO1xyXG5cclxuYW5ndWxhci5tb2R1bGUoJ3JvdXRlcy1zZXJ2aWNlJywgW10pLnNlcnZpY2UoJ1JvdXRlc1NlcnZpY2UnLCByb3V0ZXNTZXJ2aWNlKTtcclxuXHJcbnZhciBhcHAgPSBhbmd1bGFyLm1vZHVsZSgncm91dGVzLW1vZHVsZScsIFtcclxuICAgICdyb3V0ZXMtc2VydmljZSdcclxuXSk7XHJcblxyXG5tb2R1bGUuZXhwb3J0cyA9IGFwcDsiLCJtb2R1bGUuZXhwb3J0cyA9IGZ1bmN0aW9uICgkcSkge1xyXG4gICAgcmV0dXJuIHtcclxuICAgICAgICBjYWxjdWxhdGVSb3V0ZTogY2FsY3VsYXRlUm91dGUsXHJcbiAgICAgICAgYWRkUm91dGVUb01hcDogYWRkUm91dGVUb01hcCxcclxuICAgICAgICBjbGVhblJvdXRlczogY2xlYW5Sb3V0ZXNcclxuICAgIH1cclxuXHJcbiAgICBmdW5jdGlvbiBjYWxjdWxhdGVSb3V0ZShoZXJlbWFwcywgY29uZmlnKSB7XHJcbiAgICAgICAgdmFyIHBsYXRmb3JtID0gaGVyZW1hcHMucGxhdGZvcm0sXHJcbiAgICAgICAgICAgIG1hcCA9IGhlcmVtYXBzLm1hcCxcclxuICAgICAgICAgICAgcm91dGVyID0gcGxhdGZvcm0uZ2V0Um91dGluZ1NlcnZpY2UoKSxcclxuICAgICAgICAgICAgZGlyID0gY29uZmlnLmRpcmVjdGlvbjtcclxuXHJcbiAgICAgICAgdmFyIG1vZGUgPSAne3tNT0RFfX07e3tWRUNISUxFfX0nXHJcbiAgICAgICAgICAgIC5yZXBsYWNlKC97e01PREV9fS8sIGRpci5tb2RlKVxyXG4gICAgICAgICAgICAucmVwbGFjZSgve3tWRUNISUxFfX0vLCBjb25maWcuZHJpdmVUeXBlKTtcclxuXHJcbiAgICAgICAgdmFyIHJvdXRlUmVxdWVzdFBhcmFtcyA9IHtcclxuICAgICAgICAgICAgbW9kZTogbW9kZSxcclxuICAgICAgICAgICAgcmVwcmVzZW50YXRpb246IGRpci5yZXByZXNlbnRhdGlvbiB8fCAnZGlzcGxheScsXHJcbiAgICAgICAgICAgIHdheXBvaW50MDogW2Rpci5mcm9tLmxhdCwgZGlyLmZyb20ubG5nXS5qb2luKCcsJyksXHJcbiAgICAgICAgICAgIHdheXBvaW50MTogW2Rpci50by5sYXQsIGRpci50by5sbmddLmpvaW4oJywnKSxcclxuICAgICAgICAgICAgbGFuZ3VhZ2U6IGRpci5sYW5ndWFnZSB8fCAnZW4tZ2InXHJcbiAgICAgICAgfTtcclxuXHJcbiAgICAgICAgX3NldEF0dHJpYnV0ZXMocm91dGVSZXF1ZXN0UGFyYW1zLCBkaXIuYXR0cnMpO1xyXG5cclxuICAgICAgICB2YXIgZGVmZXJyZWQgPSAkcS5kZWZlcigpO1xyXG5cclxuICAgICAgICByb3V0ZXIuY2FsY3VsYXRlUm91dGUocm91dGVSZXF1ZXN0UGFyYW1zLCBmdW5jdGlvbiAocmVzdWx0KSB7XHJcbiAgICAgICAgICAgIGRlZmVycmVkLnJlc29sdmUocmVzdWx0KTtcclxuICAgICAgICB9LCBmdW5jdGlvbiAoZXJyb3IpIHtcclxuICAgICAgICAgICAgZGVmZXJyZWQucmVqZWN0KGVycm9yKTtcclxuICAgICAgICB9KTtcclxuXHJcbiAgICAgICAgcmV0dXJuIGRlZmVycmVkLnByb21pc2U7XHJcbiAgICB9XHJcbiAgICBcclxuICAgIGZ1bmN0aW9uIGNsZWFuUm91dGVzKG1hcCl7XHJcbiAgICAgICAgdmFyIGdyb3VwID0gbWFwLnJvdXRlc0dyb3VwO1xyXG4gICAgICAgICBcclxuICAgICAgICBpZighZ3JvdXApXHJcbiAgICAgICAgICAgIHJldHVybjtcclxuICAgICAgICAgICAgXHJcbiAgICAgICAgZ3JvdXAucmVtb3ZlQWxsKCk7XHJcbiAgICAgICAgbWFwLnJlbW92ZU9iamVjdChncm91cCk7XHJcbiAgICAgICAgbWFwLnJvdXRlc0dyb3VwID0gbnVsbDtcclxuICAgIH1cclxuICAgIFxyXG4gICAgZnVuY3Rpb24gYWRkUm91dGVUb01hcChtYXAsIHJvdXRlRGF0YSwgY2xlYW4pIHtcclxuICAgICAgICBpZihjbGVhbilcclxuICAgICAgICAgICBjbGVhblJvdXRlcyhtYXApO1xyXG4gICAgICAgICAgIFxyXG4gICAgICAgIHZhciByb3V0ZSA9IHJvdXRlRGF0YS5yb3V0ZTtcclxuICAgICAgICBcclxuICAgICAgICBpZiAoIW1hcCB8fCAhcm91dGUgfHwgIXJvdXRlLnNoYXBlKVxyXG4gICAgICAgICAgICByZXR1cm47XHJcblxyXG4gICAgICAgIHZhciBzdHJpcCA9IG5ldyBILmdlby5TdHJpcCgpLCBwb2x5bGluZSA9IG51bGw7XHJcblxyXG4gICAgICAgIHJvdXRlLnNoYXBlLmZvckVhY2goZnVuY3Rpb24gKHBvaW50KSB7XHJcbiAgICAgICAgICAgIHZhciBwYXJ0cyA9IHBvaW50LnNwbGl0KCcsJyk7XHJcbiAgICAgICAgICAgIHN0cmlwLnB1c2hMYXRMbmdBbHQocGFydHNbMF0sIHBhcnRzWzFdKTtcclxuICAgICAgICB9KTtcclxuICAgICAgICBcclxuICAgICAgICB2YXIgc3R5bGUgPSByb3V0ZURhdGEuc3R5bGU7XHJcblxyXG4gICAgICAgIHBvbHlsaW5lID0gbmV3IEgubWFwLlBvbHlsaW5lKHN0cmlwLCB7XHJcbiAgICAgICAgICAgIHN0eWxlOiB7XHJcbiAgICAgICAgICAgICAgICBsaW5lV2lkdGg6IHN0eWxlLmxpbmVXaWR0aCB8fCA0LFxyXG4gICAgICAgICAgICAgICAgc3Ryb2tlQ29sb3I6IHN0eWxlLiBjb2xvciB8fCAncmdiYSgwLCAxMjgsIDI1NSwgMC43KSdcclxuICAgICAgICAgICAgfVxyXG4gICAgICAgIH0pO1xyXG4gICAgICAgIFxyXG4gICAgICAgIHZhciBncm91cCA9IG1hcC5yb3V0ZXNHcm91cDtcclxuICAgICAgICAgXHJcbiAgICAgICAgaWYoIWdyb3VwKSB7XHJcbiAgICAgICAgICAgIGdyb3VwID0gbWFwLnJvdXRlc0dyb3VwID0gbmV3IEgubWFwLkdyb3VwKCk7XHJcbiAgICAgICAgICAgIG1hcC5hZGRPYmplY3QoZ3JvdXApO1xyXG4gICAgICAgIH1cclxuICAgICAgICBcclxuICAgICAgICBncm91cC5hZGRPYmplY3QocG9seWxpbmUpO1xyXG4gICAgICAgIFxyXG4gICAgICAgIG1hcC5zZXRWaWV3Qm91bmRzKHBvbHlsaW5lLmdldEJvdW5kcygpLCB0cnVlKTtcclxuICAgIH1cclxuXHJcbiAgICAvLyNyZWdpb24gUFJJVkFURVxyXG5cclxuICAgIGZ1bmN0aW9uIF9zZXRBdHRyaWJ1dGVzKHBhcmFtcywgYXR0cnMpIHtcclxuICAgICAgICB2YXIgX2tleSA9ICdhdHRyaWJ1dGVzJztcclxuICAgICAgICBmb3IgKHZhciBrZXkgaW4gYXR0cnMpIHtcclxuICAgICAgICAgICAgaWYgKCFhdHRycy5oYXNPd25Qcm9wZXJ0eShrZXkpKVxyXG4gICAgICAgICAgICAgICAgY29udGludWU7XHJcblxyXG4gICAgICAgICAgICBwYXJhbXNba2V5ICsgX2tleV0gPSBhdHRyc1trZXldO1xyXG4gICAgICAgIH1cclxuICAgIH1cclxuXHJcbiAgICBmdW5jdGlvbiBfb25Sb3V0ZVN1Y2Nlc3MocmVzdWx0KSB7XHJcbiAgICAgICAgY29uc29sZS5sb2cocmVzdWx0KVxyXG4gICAgfVxyXG5cclxuICAgIGZ1bmN0aW9uIF9vblJvdXRlRmFpbHVyZShlcnJvcikge1xyXG4gICAgICAgIGNvbnNvbGUubG9nKCdDYWxjdWxhdGUgcm91dGUgZmFpbHVyZScsIGVycm9yKTtcclxuICAgIH1cclxuXHJcbiAgICAvKipcclxuICAgICAqIENyZWF0ZXMgYSBzZXJpZXMgb2YgSC5tYXAuTWFya2VyIHBvaW50cyBmcm9tIHRoZSByb3V0ZSBhbmQgYWRkcyB0aGVtIHRvIHRoZSBtYXAuXHJcbiAgICAgKiBAcGFyYW0ge09iamVjdH0gcm91dGUgIEEgcm91dGUgYXMgcmVjZWl2ZWQgZnJvbSB0aGUgSC5zZXJ2aWNlLlJvdXRpbmdTZXJ2aWNlXHJcbiAgICAgKi9cclxuICAgIGZ1bmN0aW9uIGFkZE1hbnVldmVyc1RvTWFwKG1hcCwgcm91dGUpIHtcclxuICAgICAgICB2YXIgc3ZnTWFya3VwID0gJzxzdmcgd2lkdGg9XCIxOFwiIGhlaWdodD1cIjE4XCIgJyArXHJcbiAgICAgICAgICAgICd4bWxucz1cImh0dHA6Ly93d3cudzMub3JnLzIwMDAvc3ZnXCI+JyArXHJcbiAgICAgICAgICAgICc8Y2lyY2xlIGN4PVwiOFwiIGN5PVwiOFwiIHI9XCI4XCIgJyArXHJcbiAgICAgICAgICAgICdmaWxsPVwiIzFiNDY4ZFwiIHN0cm9rZT1cIndoaXRlXCIgc3Ryb2tlLXdpZHRoPVwiMVwiICAvPicgK1xyXG4gICAgICAgICAgICAnPC9zdmc+JyxcclxuICAgICAgICAgICAgZG90SWNvbiA9IG5ldyBILm1hcC5JY29uKHN2Z01hcmt1cCwgeyBhbmNob3I6IHsgeDogOCwgeTogOCB9IH0pLFxyXG4gICAgICAgICAgICBncm91cCA9IG5ldyBILm1hcC5Hcm91cCgpLFxyXG4gICAgICAgICAgICBpLFxyXG4gICAgICAgICAgICBqO1xyXG5cclxuICAgICAgICAvLyBBZGQgYSBtYXJrZXIgZm9yIGVhY2ggbWFuZXV2ZXJcclxuICAgICAgICBmb3IgKGkgPSAwOyBpIDwgcm91dGUubGVnLmxlbmd0aDsgaSArPSAxKSB7XHJcbiAgICAgICAgICAgIGZvciAoaiA9IDA7IGogPCByb3V0ZS5sZWdbaV0ubWFuZXV2ZXIubGVuZ3RoOyBqICs9IDEpIHtcclxuICAgICAgICAgICAgICAgIC8vIEdldCB0aGUgbmV4dCBtYW5ldXZlci5cclxuICAgICAgICAgICAgICAgIG1hbmV1dmVyID0gcm91dGUubGVnW2ldLm1hbmV1dmVyW2pdO1xyXG4gICAgICAgICAgICAgICAgLy8gQWRkIGEgbWFya2VyIHRvIHRoZSBtYW5ldXZlcnMgZ3JvdXBcclxuICAgICAgICAgICAgICAgIHZhciBtYXJrZXIgPSBuZXcgSC5tYXAuTWFya2VyKHtcclxuICAgICAgICAgICAgICAgICAgICBsYXQ6IG1hbmV1dmVyLnBvc2l0aW9uLmxhdGl0dWRlLFxyXG4gICAgICAgICAgICAgICAgICAgIGxuZzogbWFuZXV2ZXIucG9zaXRpb24ubG9uZ2l0dWRlXHJcbiAgICAgICAgICAgICAgICB9LFxyXG4gICAgICAgICAgICAgICAgICAgIHsgaWNvbjogZG90SWNvbiB9XHJcbiAgICAgICAgICAgICAgICApO1xyXG5cclxuICAgICAgICAgICAgICAgIG1hcmtlci5pbnN0cnVjdGlvbiA9IG1hbmV1dmVyLmluc3RydWN0aW9uO1xyXG4gICAgICAgICAgICAgICAgZ3JvdXAuYWRkT2JqZWN0KG1hcmtlcik7XHJcbiAgICAgICAgICAgIH1cclxuICAgICAgICB9XHJcblxyXG4gICAgICAgIGdyb3VwLmFkZEV2ZW50TGlzdGVuZXIoJ3RhcCcsIGZ1bmN0aW9uIChldnQpIHtcclxuICAgICAgICAgICAgbWFwLnNldENlbnRlcihldnQudGFyZ2V0LmdldFBvc2l0aW9uKCkpO1xyXG4gICAgICAgICAgICBvcGVuQnViYmxlKGV2dC50YXJnZXQuZ2V0UG9zaXRpb24oKSwgZXZ0LnRhcmdldC5pbnN0cnVjdGlvbik7XHJcbiAgICAgICAgfSwgZmFsc2UpO1xyXG5cclxuICAgICAgICAvLyBBZGQgdGhlIG1hbmV1dmVycyBncm91cCB0byB0aGUgbWFwXHJcbiAgICAgICAgbWFwLmFkZE9iamVjdChncm91cCk7XHJcbiAgICB9XHJcblxyXG5cclxuICAgIC8qKlxyXG4gICAgICogQ3JlYXRlcyBhIHNlcmllcyBvZiBILm1hcC5NYXJrZXIgcG9pbnRzIGZyb20gdGhlIHJvdXRlIGFuZCBhZGRzIHRoZW0gdG8gdGhlIG1hcC5cclxuICAgICAqIEBwYXJhbSB7T2JqZWN0fSByb3V0ZSAgQSByb3V0ZSBhcyByZWNlaXZlZCBmcm9tIHRoZSBILnNlcnZpY2UuUm91dGluZ1NlcnZpY2VcclxuICAgICAqL1xyXG4gICAgZnVuY3Rpb24gYWRkV2F5cG9pbnRzVG9QYW5lbCh3YXlwb2ludHMpIHtcclxuICAgICAgICB2YXIgbm9kZUgzID0gZG9jdW1lbnQuY3JlYXRlRWxlbWVudCgnaDMnKSxcclxuICAgICAgICAgICAgd2F5cG9pbnRMYWJlbHMgPSBbXSxcclxuICAgICAgICAgICAgaTtcclxuXHJcbiAgICAgICAgZm9yIChpID0gMDsgaSA8IHdheXBvaW50cy5sZW5ndGg7IGkgKz0gMSkge1xyXG4gICAgICAgICAgICB3YXlwb2ludExhYmVscy5wdXNoKHdheXBvaW50c1tpXS5sYWJlbClcclxuICAgICAgICB9XHJcblxyXG4gICAgICAgIG5vZGVIMy50ZXh0Q29udGVudCA9IHdheXBvaW50TGFiZWxzLmpvaW4oJyAtICcpO1xyXG5cclxuICAgICAgICByb3V0ZUluc3RydWN0aW9uc0NvbnRhaW5lci5pbm5lckhUTUwgPSAnJztcclxuICAgICAgICByb3V0ZUluc3RydWN0aW9uc0NvbnRhaW5lci5hcHBlbmRDaGlsZChub2RlSDMpO1xyXG4gICAgfVxyXG5cclxuICAgIC8qKlxyXG4gICAgICogQ3JlYXRlcyBhIHNlcmllcyBvZiBILm1hcC5NYXJrZXIgcG9pbnRzIGZyb20gdGhlIHJvdXRlIGFuZCBhZGRzIHRoZW0gdG8gdGhlIG1hcC5cclxuICAgICAqIEBwYXJhbSB7T2JqZWN0fSByb3V0ZSAgQSByb3V0ZSBhcyByZWNlaXZlZCBmcm9tIHRoZSBILnNlcnZpY2UuUm91dGluZ1NlcnZpY2VcclxuICAgICAqL1xyXG4gICAgZnVuY3Rpb24gYWRkU3VtbWFyeVRvUGFuZWwoc3VtbWFyeSkge1xyXG4gICAgICAgIHZhciBzdW1tYXJ5RGl2ID0gZG9jdW1lbnQuY3JlYXRlRWxlbWVudCgnZGl2JyksXHJcbiAgICAgICAgICAgIGNvbnRlbnQgPSAnJztcclxuXHJcbiAgICAgICAgY29udGVudCArPSAnPGI+VG90YWwgZGlzdGFuY2U8L2I+OiAnICsgc3VtbWFyeS5kaXN0YW5jZSArICdtLiA8YnIvPic7XHJcbiAgICAgICAgY29udGVudCArPSAnPGI+VHJhdmVsIFRpbWU8L2I+OiAnICsgc3VtbWFyeS50cmF2ZWxUaW1lLnRvTU1TUygpICsgJyAoaW4gY3VycmVudCB0cmFmZmljKSc7XHJcblxyXG5cclxuICAgICAgICBzdW1tYXJ5RGl2LnN0eWxlLmZvbnRTaXplID0gJ3NtYWxsJztcclxuICAgICAgICBzdW1tYXJ5RGl2LnN0eWxlLm1hcmdpbkxlZnQgPSAnNSUnO1xyXG4gICAgICAgIHN1bW1hcnlEaXYuc3R5bGUubWFyZ2luUmlnaHQgPSAnNSUnO1xyXG4gICAgICAgIHN1bW1hcnlEaXYuaW5uZXJIVE1MID0gY29udGVudDtcclxuICAgICAgICByb3V0ZUluc3RydWN0aW9uc0NvbnRhaW5lci5hcHBlbmRDaGlsZChzdW1tYXJ5RGl2KTtcclxuICAgIH1cclxuXHJcbiAgICAvKipcclxuICAgICAqIENyZWF0ZXMgYSBzZXJpZXMgb2YgSC5tYXAuTWFya2VyIHBvaW50cyBmcm9tIHRoZSByb3V0ZSBhbmQgYWRkcyB0aGVtIHRvIHRoZSBtYXAuXHJcbiAgICAgKiBAcGFyYW0ge09iamVjdH0gcm91dGUgIEEgcm91dGUgYXMgcmVjZWl2ZWQgZnJvbSB0aGUgSC5zZXJ2aWNlLlJvdXRpbmdTZXJ2aWNlXHJcbiAgICAgKi9cclxuICAgIGZ1bmN0aW9uIGFkZE1hbnVldmVyc1RvUGFuZWwocm91dGUpIHtcclxuICAgICAgICB2YXIgbm9kZU9MID0gZG9jdW1lbnQuY3JlYXRlRWxlbWVudCgnb2wnKSwgaSwgajtcclxuXHJcbiAgICAgICAgbm9kZU9MLnN0eWxlLmZvbnRTaXplID0gJ3NtYWxsJztcclxuICAgICAgICBub2RlT0wuc3R5bGUubWFyZ2luTGVmdCA9ICc1JSc7XHJcbiAgICAgICAgbm9kZU9MLnN0eWxlLm1hcmdpblJpZ2h0ID0gJzUlJztcclxuICAgICAgICBub2RlT0wuY2xhc3NOYW1lID0gJ2RpcmVjdGlvbnMnO1xyXG5cclxuICAgICAgICAvLyBBZGQgYSBtYXJrZXIgZm9yIGVhY2ggbWFuZXV2ZXJcclxuICAgICAgICBmb3IgKGkgPSAwOyBpIDwgcm91dGUubGVnLmxlbmd0aDsgaSArPSAxKSB7XHJcbiAgICAgICAgICAgIGZvciAoaiA9IDA7IGogPCByb3V0ZS5sZWdbaV0ubWFuZXV2ZXIubGVuZ3RoOyBqICs9IDEpIHtcclxuICAgICAgICAgICAgICAgIC8vIEdldCB0aGUgbmV4dCBtYW5ldXZlci5cclxuICAgICAgICAgICAgICAgIG1hbmV1dmVyID0gcm91dGUubGVnW2ldLm1hbmV1dmVyW2pdO1xyXG5cclxuICAgICAgICAgICAgICAgIHZhciBsaSA9IGRvY3VtZW50LmNyZWF0ZUVsZW1lbnQoJ2xpJyksXHJcbiAgICAgICAgICAgICAgICAgICAgc3BhbkFycm93ID0gZG9jdW1lbnQuY3JlYXRlRWxlbWVudCgnc3BhbicpLFxyXG4gICAgICAgICAgICAgICAgICAgIHNwYW5JbnN0cnVjdGlvbiA9IGRvY3VtZW50LmNyZWF0ZUVsZW1lbnQoJ3NwYW4nKTtcclxuXHJcbiAgICAgICAgICAgICAgICBzcGFuQXJyb3cuY2xhc3NOYW1lID0gJ2Fycm93ICcgKyBtYW5ldXZlci5hY3Rpb247XHJcbiAgICAgICAgICAgICAgICBzcGFuSW5zdHJ1Y3Rpb24uaW5uZXJIVE1MID0gbWFuZXV2ZXIuaW5zdHJ1Y3Rpb247XHJcbiAgICAgICAgICAgICAgICBsaS5hcHBlbmRDaGlsZChzcGFuQXJyb3cpO1xyXG4gICAgICAgICAgICAgICAgbGkuYXBwZW5kQ2hpbGQoc3Bhbkluc3RydWN0aW9uKTtcclxuXHJcbiAgICAgICAgICAgICAgICBub2RlT0wuYXBwZW5kQ2hpbGQobGkpO1xyXG4gICAgICAgICAgICB9XHJcbiAgICAgICAgfVxyXG5cclxuICAgICAgICByb3V0ZUluc3RydWN0aW9uc0NvbnRhaW5lci5hcHBlbmRDaGlsZChub2RlT0wpO1xyXG4gICAgfVxyXG5cclxufTsiXX0=
