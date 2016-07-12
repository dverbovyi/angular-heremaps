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

        //TODO: move to separate file
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
//# sourceMappingURL=data:application/json;charset=utf-8;base64,eyJ2ZXJzaW9uIjozLCJzb3VyY2VzIjpbIm5vZGVfbW9kdWxlcy9icm93c2VyLXBhY2svX3ByZWx1ZGUuanMiLCJzcmMvaGVyZW1hcHMuZGlyZWN0aXZlLmpzIiwic3JjL2luZGV4LmpzIiwic3JjL3Byb3ZpZGVycy9hcGkuc2VydmljZS5qcyIsInNyYy9wcm92aWRlcnMvY29uc3RzLmpzIiwic3JjL3Byb3ZpZGVycy9tYXAtbW9kdWxlcy9ldmVudHMvZXZlbnRzLmpzIiwic3JjL3Byb3ZpZGVycy9tYXAtbW9kdWxlcy9ldmVudHMvaW5mb2J1YmJsZS5qcyIsInNyYy9wcm92aWRlcnMvbWFwLW1vZHVsZXMvaW5kZXguanMiLCJzcmMvcHJvdmlkZXJzL21hcC1tb2R1bGVzL3VpL3VpLmpzIiwic3JjL3Byb3ZpZGVycy9tYXBjb25maWcucHJvdmlkZXIuanMiLCJzcmMvcHJvdmlkZXJzL21hcHV0aWxzLnNlcnZpY2UuanMiLCJzcmMvcHJvdmlkZXJzL21hcmtlcnMvZGVmYXVsdC5tYXJrZXIuanMiLCJzcmMvcHJvdmlkZXJzL21hcmtlcnMvZG9tLm1hcmtlci5qcyIsInNyYy9wcm92aWRlcnMvbWFya2Vycy9pbmRleC5qcyIsInNyYy9wcm92aWRlcnMvbWFya2Vycy9tYXJrZXIuanMiLCJzcmMvcHJvdmlkZXJzL21hcmtlcnMvbWFya2Vycy5zZXJ2aWNlLmpzIiwic3JjL3Byb3ZpZGVycy9tYXJrZXJzL3N2Zy5tYXJrZXIuanMiLCJzcmMvcHJvdmlkZXJzL3JvdXRlcy9pbmRleC5qcyIsInNyYy9wcm92aWRlcnMvcm91dGVzL3JvdXRlcy5zZXJ2aWNlLmpzIl0sIm5hbWVzIjpbXSwibWFwcGluZ3MiOiJBQUFBO0FDQUE7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBOztBQzVPQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTs7QUN4QkE7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTs7QUMzT0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBOztBQ2pFQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTs7QUMxRkE7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7O0FDcEZBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTs7QUNqQkE7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBOztBQzVGQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7O0FDakJBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTs7QUNwSEE7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBOztBQ3BCQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBOztBQzNDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTs7QUNyQkE7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTs7QUNsQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBOztBQzVGQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBOztBQy9CQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7O0FDUkE7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBIiwiZmlsZSI6ImdlbmVyYXRlZC5qcyIsInNvdXJjZVJvb3QiOiIiLCJzb3VyY2VzQ29udGVudCI6WyIoZnVuY3Rpb24gZSh0LG4scil7ZnVuY3Rpb24gcyhvLHUpe2lmKCFuW29dKXtpZighdFtvXSl7dmFyIGE9dHlwZW9mIHJlcXVpcmU9PVwiZnVuY3Rpb25cIiYmcmVxdWlyZTtpZighdSYmYSlyZXR1cm4gYShvLCEwKTtpZihpKXJldHVybiBpKG8sITApO3ZhciBmPW5ldyBFcnJvcihcIkNhbm5vdCBmaW5kIG1vZHVsZSAnXCIrbytcIidcIik7dGhyb3cgZi5jb2RlPVwiTU9EVUxFX05PVF9GT1VORFwiLGZ9dmFyIGw9bltvXT17ZXhwb3J0czp7fX07dFtvXVswXS5jYWxsKGwuZXhwb3J0cyxmdW5jdGlvbihlKXt2YXIgbj10W29dWzFdW2VdO3JldHVybiBzKG4/bjplKX0sbCxsLmV4cG9ydHMsZSx0LG4scil9cmV0dXJuIG5bb10uZXhwb3J0c312YXIgaT10eXBlb2YgcmVxdWlyZT09XCJmdW5jdGlvblwiJiZyZXF1aXJlO2Zvcih2YXIgbz0wO288ci5sZW5ndGg7bysrKXMocltvXSk7cmV0dXJuIHN9KSIsIi8qKlxyXG4gKiBDcmVhdGVkIGJ5IERteXRybyBvbiA0LzExLzIwMTYuXHJcbiAqL1xyXG5tb2R1bGUuZXhwb3J0cyA9IGZ1bmN0aW9uIChcclxuICAgICR0aW1lb3V0LFxyXG4gICAgJHdpbmRvdyxcclxuICAgICRyb290U2NvcGUsXHJcbiAgICAkZmlsdGVyLFxyXG4gICAgSGVyZU1hcHNDb25maWcsXHJcbiAgICBBUElTZXJ2aWNlLFxyXG4gICAgSGVyZU1hcFV0aWxzU2VydmljZSxcclxuICAgIE1hcmtlcnNTZXJ2aWNlLFxyXG4gICAgUm91dGVzU2VydmljZSxcclxuICAgIENPTlNUUyxcclxuICAgIEV2ZW50c01vZHVsZSxcclxuICAgIFVJTW9kdWxlKSB7XHJcbiAgICAgICAgXHJcbiAgICBIZXJlTWFwc0RpcmVjdGl2ZUN0cmwuJGluamVjdCA9IFsnJHNjb3BlJywgJyRlbGVtZW50JywgJyRhdHRycyddO1xyXG4gICAgICAgIFxyXG4gICAgcmV0dXJuIHtcclxuICAgICAgICByZXN0cmljdDogJ0VBJyxcclxuICAgICAgICB0ZW1wbGF0ZTogXCI8ZGl2IG5nLXN0eWxlPVxcXCJ7J3dpZHRoJzogbWFwV2lkdGgsICdoZWlnaHQnOiBtYXBIZWlnaHR9XFxcIj48L2Rpdj5cIixcclxuICAgICAgICByZXBsYWNlOiB0cnVlLFxyXG4gICAgICAgIHNjb3BlOiB7XHJcbiAgICAgICAgICAgIG9wdHM6ICcmb3B0aW9ucycsXHJcbiAgICAgICAgICAgIHBsYWNlczogJyYnLFxyXG4gICAgICAgICAgICBvbk1hcFJlYWR5OiBcIiZtYXBSZWFkeVwiLFxyXG4gICAgICAgICAgICBldmVudHM6ICcmJ1xyXG4gICAgICAgIH0sXHJcbiAgICAgICAgY29udHJvbGxlcjogSGVyZU1hcHNEaXJlY3RpdmVDdHJsXHJcbiAgICB9XHJcbiAgICBcclxuICAgIGZ1bmN0aW9uIEhlcmVNYXBzRGlyZWN0aXZlQ3RybCgkc2NvcGUsICRlbGVtZW50LCAkYXR0cnMpIHtcclxuICAgICAgICB2YXIgQ09OVFJPTF9OQU1FUyA9IENPTlNUUy5DT05UUk9MUy5OQU1FUyxcclxuICAgICAgICAgICAgcGxhY2VzID0gJHNjb3BlLnBsYWNlcygpLFxyXG4gICAgICAgICAgICBvcHRzID0gJHNjb3BlLm9wdHMoKSxcclxuICAgICAgICAgICAgbGlzdGVuZXJzID0gJHNjb3BlLmV2ZW50cygpO1xyXG5cclxuICAgICAgICB2YXIgb3B0aW9ucyA9IGFuZ3VsYXIuZXh0ZW5kKHt9LCBDT05TVFMuREVGQVVMVF9NQVBfT1BUSU9OUywgb3B0cyksXHJcbiAgICAgICAgICAgIHBvc2l0aW9uID0gSGVyZU1hcFV0aWxzU2VydmljZS5pc1ZhbGlkQ29vcmRzKG9wdGlvbnMuY29vcmRzKSA/IG9wdGlvbnMuY29vcmRzIDogQ09OU1RTLkRFRkFVTFRfTUFQX09QVElPTlMuY29vcmRzO1xyXG5cclxuICAgICAgICB2YXIgaGVyZW1hcHMgPSB7IGlkOiBIZXJlTWFwVXRpbHNTZXJ2aWNlLmdlbmVyYXRlSWQoKSB9LFxyXG4gICAgICAgICAgICBtYXBSZWFkeSA9ICRzY29wZS5vbk1hcFJlYWR5KCksXHJcbiAgICAgICAgICAgIF9vblJlc2l6ZU1hcCA9IG51bGw7XHJcblxyXG4gICAgICAgICR0aW1lb3V0KGZ1bmN0aW9uICgpIHtcclxuICAgICAgICAgICAgcmV0dXJuIF9zZXRNYXBTaXplKCk7XHJcbiAgICAgICAgfSkudGhlbihmdW5jdGlvbiAoKSB7XHJcbiAgICAgICAgICAgIEFQSVNlcnZpY2UubG9hZEFwaSgpLnRoZW4oX2FwaVJlYWR5KTtcclxuICAgICAgICB9KTtcclxuXHJcbiAgICAgICAgb3B0aW9ucy5yZXNpemUgJiYgYWRkT25SZXNpemVMaXN0ZW5lcigpO1xyXG5cclxuICAgICAgICAkc2NvcGUuJG9uKCckZGVzdHJveScsIGZ1bmN0aW9uICgpIHtcclxuICAgICAgICAgICAgJHdpbmRvdy5yZW1vdmVFdmVudExpc3RlbmVyKCdyZXNpemUnLCBfb25SZXNpemVNYXApO1xyXG4gICAgICAgIH0pO1xyXG5cclxuICAgICAgICBmdW5jdGlvbiBhZGRPblJlc2l6ZUxpc3RlbmVyKCkge1xyXG4gICAgICAgICAgICBfb25SZXNpemVNYXAgPSBIZXJlTWFwVXRpbHNTZXJ2aWNlLnRocm90dGxlKF9yZXNpemVIYW5kbGVyLCBDT05TVFMuVVBEQVRFX01BUF9SRVNJWkVfVElNRU9VVCk7XHJcbiAgICAgICAgICAgICR3aW5kb3cuYWRkRXZlbnRMaXN0ZW5lcigncmVzaXplJywgX29uUmVzaXplTWFwKTtcclxuICAgICAgICB9XHJcblxyXG4gICAgICAgIGZ1bmN0aW9uIF9hcGlSZWFkeSgpIHtcclxuICAgICAgICAgICAgX3NldHVwTWFwUGxhdGZvcm0oKTtcclxuICAgICAgICAgICAgX3NldHVwTWFwKCk7XHJcbiAgICAgICAgfVxyXG5cclxuICAgICAgICBmdW5jdGlvbiBfc2V0dXBNYXBQbGF0Zm9ybSgpIHtcclxuICAgICAgICAgICAgaWYgKCFIZXJlTWFwc0NvbmZpZy5hcHBfaWQgfHwgIUhlcmVNYXBzQ29uZmlnLmFwcF9jb2RlKVxyXG4gICAgICAgICAgICAgICAgdGhyb3cgbmV3IEVycm9yKCdhcHBfaWQgb3IgYXBwX2NvZGUgd2VyZSBtaXNzZWQuIFBsZWFzZSBzcGVjaWZ5IHRoZWlyIGluIEhlcmVNYXBzQ29uZmlnJyk7XHJcbiAgICAgICAgICAgIFxyXG4gICAgICAgICAgICBoZXJlbWFwcy5wbGF0Zm9ybSA9IG5ldyBILnNlcnZpY2UuUGxhdGZvcm0oSGVyZU1hcHNDb25maWcpO1xyXG4gICAgICAgICAgICBoZXJlbWFwcy5sYXllcnMgPSBoZXJlbWFwcy5wbGF0Zm9ybS5jcmVhdGVEZWZhdWx0TGF5ZXJzKCk7XHJcbiAgICAgICAgfVxyXG5cclxuICAgICAgICBmdW5jdGlvbiBfZ2V0TG9jYXRpb24oZW5hYmxlSGlnaEFjY3VyYWN5LCBtYXhpbXVtQWdlKSB7XHJcbiAgICAgICAgICAgIHZhciBfZW5hYmxlSGlnaEFjY3VyYWN5ID0gISFlbmFibGVIaWdoQWNjdXJhY3ksXHJcbiAgICAgICAgICAgICAgICBfbWF4aW11bUFnZSA9IG1heGltdW1BZ2UgfHwgMDtcclxuXHJcbiAgICAgICAgICAgIHJldHVybiBBUElTZXJ2aWNlLmdldFBvc2l0aW9uKHtcclxuICAgICAgICAgICAgICAgIGVuYWJsZUhpZ2hBY2N1cmFjeTogX2VuYWJsZUhpZ2hBY2N1cmFjeSxcclxuICAgICAgICAgICAgICAgIG1heGltdW1BZ2U6IF9tYXhpbXVtQWdlXHJcbiAgICAgICAgICAgIH0pO1xyXG4gICAgICAgIH1cclxuXHJcbiAgICAgICAgZnVuY3Rpb24gX2xvY2F0aW9uRmFpbHVyZSgpIHtcclxuICAgICAgICAgICAgY29uc29sZS5lcnJvcignQ2FuIG5vdCBnZXQgYSBnZW8gcG9zaXRpb24nKTtcclxuICAgICAgICB9XHJcblxyXG4gICAgICAgIGZ1bmN0aW9uIF9zZXR1cE1hcCgpIHtcclxuICAgICAgICAgICAgX2luaXRNYXAoZnVuY3Rpb24gKCkge1xyXG4gICAgICAgICAgICAgICAgQVBJU2VydmljZS5sb2FkTW9kdWxlcygkYXR0cnMuJGF0dHIsIHtcclxuICAgICAgICAgICAgICAgICAgICBcImNvbnRyb2xzXCI6IF91aU1vZHVsZVJlYWR5LFxyXG4gICAgICAgICAgICAgICAgICAgIFwiZXZlbnRzXCI6IF9ldmVudHNNb2R1bGVSZWFkeVxyXG4gICAgICAgICAgICAgICAgfSk7XHJcbiAgICAgICAgICAgIH0pO1xyXG4gICAgICAgIH1cclxuXHJcbiAgICAgICAgZnVuY3Rpb24gX2luaXRNYXAoY2IpIHtcclxuICAgICAgICAgICAgdmFyIG1hcCA9IGhlcmVtYXBzLm1hcCA9IG5ldyBILk1hcCgkZWxlbWVudFswXSwgaGVyZW1hcHMubGF5ZXJzLm5vcm1hbC5tYXAsIHtcclxuICAgICAgICAgICAgICAgIHpvb206IEhlcmVNYXBVdGlsc1NlcnZpY2UuaXNWYWxpZENvb3Jkcyhwb3NpdGlvbikgPyBvcHRpb25zLnpvb20gOiBvcHRpb25zLm1heFpvb20sXHJcbiAgICAgICAgICAgICAgICBjZW50ZXI6IG5ldyBILmdlby5Qb2ludChwb3NpdGlvbi5sYXRpdHVkZSwgcG9zaXRpb24ubG9uZ2l0dWRlKVxyXG4gICAgICAgICAgICB9KTtcclxuXHJcbiAgICAgICAgICAgIE1hcmtlcnNTZXJ2aWNlLmFkZE1hcmtlcnNUb01hcChtYXAsIHBsYWNlcyk7XHJcblxyXG4gICAgICAgICAgICBtYXBSZWFkeSAmJiBtYXBSZWFkeShNYXBQcm94eSgpKTtcclxuXHJcbiAgICAgICAgICAgIGNiICYmIGNiKCk7XHJcbiAgICAgICAgICAgICAgICBcclxuICAgICAgICB9XHJcblxyXG4gICAgICAgIGZ1bmN0aW9uIF91aU1vZHVsZVJlYWR5KCkge1xyXG4gICAgICAgICAgICBVSU1vZHVsZS5zdGFydCh7XHJcbiAgICAgICAgICAgICAgICBwbGF0Zm9ybTogaGVyZW1hcHMsXHJcbiAgICAgICAgICAgICAgICBhbGlnbm1lbnQ6ICRhdHRycy5jb250cm9sc1xyXG4gICAgICAgICAgICB9KTtcclxuICAgICAgICB9XHJcblxyXG4gICAgICAgIGZ1bmN0aW9uIF9ldmVudHNNb2R1bGVSZWFkeSgpIHtcclxuICAgICAgICAgICAgRXZlbnRzTW9kdWxlLnN0YXJ0KHtcclxuICAgICAgICAgICAgICAgIHBsYXRmb3JtOiBoZXJlbWFwcyxcclxuICAgICAgICAgICAgICAgIGxpc3RlbmVyczogbGlzdGVuZXJzLFxyXG4gICAgICAgICAgICAgICAgb3B0aW9uczogb3B0aW9ucyxcclxuICAgICAgICAgICAgICAgIGluamVjdG9yOiBfbW9kdWxlSW5qZWN0b3JcclxuICAgICAgICAgICAgfSk7XHJcbiAgICAgICAgfVxyXG5cclxuICAgICAgICBmdW5jdGlvbiBfbW9kdWxlSW5qZWN0b3IoKSB7XHJcbiAgICAgICAgICAgIHJldHVybiBmdW5jdGlvbiAoaWQpIHtcclxuICAgICAgICAgICAgICAgIHJldHVybiBoZXJlbWFwc1tpZF07XHJcbiAgICAgICAgICAgIH1cclxuICAgICAgICB9XHJcblxyXG4gICAgICAgIGZ1bmN0aW9uIF9yZXNpemVIYW5kbGVyKGhlaWdodCwgd2lkdGgpIHtcclxuICAgICAgICAgICAgX3NldE1hcFNpemUuYXBwbHkobnVsbCwgYXJndW1lbnRzKTtcclxuXHJcbiAgICAgICAgICAgIGhlcmVtYXBzLm1hcC5nZXRWaWV3UG9ydCgpLnJlc2l6ZSgpO1xyXG4gICAgICAgIH1cclxuXHJcbiAgICAgICAgZnVuY3Rpb24gX3NldE1hcFNpemUoaGVpZ2h0LCB3aWR0aCkge1xyXG4gICAgICAgICAgICB2YXIgaGVpZ2h0ID0gaGVpZ2h0IHx8ICRlbGVtZW50WzBdLnBhcmVudE5vZGUub2Zmc2V0SGVpZ2h0IHx8IG9wdGlvbnMuaGVpZ2h0LFxyXG4gICAgICAgICAgICAgICAgd2lkdGggPSB3aWR0aCB8fCAkZWxlbWVudFswXS5wYXJlbnROb2RlLm9mZnNldFdpZHRoIHx8IG9wdGlvbnMud2lkdGg7XHJcblxyXG4gICAgICAgICAgICAkc2NvcGUubWFwSGVpZ2h0ID0gaGVpZ2h0ICsgJ3B4JztcclxuICAgICAgICAgICAgJHNjb3BlLm1hcFdpZHRoID0gd2lkdGggKyAncHgnO1xyXG4gICAgICAgICAgICBcclxuICAgICAgICAgICAgSGVyZU1hcFV0aWxzU2VydmljZS5ydW5TY29wZURpZ2VzdElmTmVlZCgkc2NvcGUpO1xyXG4gICAgICAgIH1cclxuXHJcbiAgICAgICAgLy9UT0RPOiBtb3ZlIHRvIHNlcGFyYXRlIGZpbGVcclxuICAgICAgICBmdW5jdGlvbiBNYXBQcm94eSgpIHtcclxuICAgICAgICAgICAgcmV0dXJuIHtcclxuICAgICAgICAgICAgICAgIHJlZnJlc2g6IGZ1bmN0aW9uKCl7XHJcbiAgICAgICAgICAgICAgICAgICAgdmFyIGN1cnJlbnRCb3VuZHMgPSB0aGlzLmdldFZpZXdCb3VuZHMoKTtcclxuICAgICAgICAgICAgICAgICAgICBcclxuICAgICAgICAgICAgICAgICAgICB0aGlzLnNldE1hcFNpemVzKCk7XHJcbiAgICAgICAgICAgICAgICAgICAgdGhpcy5zZXRWaWV3Qm91bmRzKGN1cnJlbnRCb3VuZHMpO1xyXG4gICAgICAgICAgICAgICAgfSxcclxuICAgICAgICAgICAgICAgIHNldE1hcFNpemVzOiBmdW5jdGlvbihoZWlnaHQsIHdpZHRoKXtcclxuICAgICAgICAgICAgICAgICAgICBjb25zb2xlLmxvZygkZWxlbWVudFswXS5wYXJlbnROb2RlLm9mZnNldEhlaWdodClcclxuICAgICAgICAgICAgICAgICAgICBfcmVzaXplSGFuZGxlci5hcHBseShudWxsLCBhcmd1bWVudHMpO1xyXG4gICAgICAgICAgICAgICAgfSxcclxuICAgICAgICAgICAgICAgIGdldFBsYXRmb3JtOiBmdW5jdGlvbiAoKSB7XHJcbiAgICAgICAgICAgICAgICAgICAgcmV0dXJuIGhlcmVtYXBzO1xyXG4gICAgICAgICAgICAgICAgfSxcclxuICAgICAgICAgICAgICAgIGNhbGN1bGF0ZVJvdXRlOiBmdW5jdGlvbiAoZHJpdmVUeXBlLCBkaXJlY3Rpb24pIHtcclxuICAgICAgICAgICAgICAgICAgICByZXR1cm4gUm91dGVzU2VydmljZS5jYWxjdWxhdGVSb3V0ZShoZXJlbWFwcywge1xyXG4gICAgICAgICAgICAgICAgICAgICAgICBkcml2ZVR5cGU6IGRyaXZlVHlwZSxcclxuICAgICAgICAgICAgICAgICAgICAgICAgZGlyZWN0aW9uOiBkaXJlY3Rpb25cclxuICAgICAgICAgICAgICAgICAgICB9KTtcclxuICAgICAgICAgICAgICAgIH0sXHJcbiAgICAgICAgICAgICAgICBhZGRSb3V0ZVRvTWFwOiBmdW5jdGlvbiAocm91dGVEYXRhLCBjbGVhbikge1xyXG4gICAgICAgICAgICAgICAgICAgIFJvdXRlc1NlcnZpY2UuYWRkUm91dGVUb01hcChoZXJlbWFwcy5tYXAsIHJvdXRlRGF0YSwgY2xlYW4pO1xyXG4gICAgICAgICAgICAgICAgfSxcclxuICAgICAgICAgICAgICAgIHNldFpvb206IGZ1bmN0aW9uICh6b29tLCBzdGVwKSB7XHJcbiAgICAgICAgICAgICAgICAgICAgSGVyZU1hcFV0aWxzU2VydmljZS56b29tKGhlcmVtYXBzLm1hcCwgem9vbSB8fCAxMCwgc3RlcCk7XHJcbiAgICAgICAgICAgICAgICB9LFxyXG4gICAgICAgICAgICAgICAgZ2V0Wm9vbTogZnVuY3Rpb24oKXtcclxuICAgICAgICAgICAgICAgICAgICByZXR1cm4gaGVyZW1hcHMubWFwLmdldFpvb20oKTsgIFxyXG4gICAgICAgICAgICAgICAgfSxcclxuICAgICAgICAgICAgICAgIGdldENlbnRlcjogZnVuY3Rpb24oKXtcclxuICAgICAgICAgICAgICAgICAgICByZXR1cm4gaGVyZW1hcHMubWFwLmdldENlbnRlcigpOyAgXHJcbiAgICAgICAgICAgICAgICB9LFxyXG4gICAgICAgICAgICAgICAgZ2V0Vmlld0JvdW5kczogZnVuY3Rpb24oKXtcclxuICAgICAgICAgICAgICAgICAgICByZXR1cm4gaGVyZW1hcHMubWFwLmdldFZpZXdCb3VuZHMoKTsgICBcclxuICAgICAgICAgICAgICAgIH0sXHJcbiAgICAgICAgICAgICAgICBzZXRWaWV3Qm91bmRzOiBmdW5jdGlvbihib3VuZGluZ1JlY3QsIG9wdF9hbmltYXRlKXtcclxuICAgICAgICAgICAgICAgICAgICBoZXJlbWFwcy5tYXAuc2V0Vmlld0JvdW5kcyhib3VuZGluZ1JlY3QsIG9wdF9hbmltYXRlKTtcclxuICAgICAgICAgICAgICAgIH0sXHJcbiAgICAgICAgICAgICAgICBzZXRDZW50ZXI6IGZ1bmN0aW9uIChjb29yZHMpIHtcclxuICAgICAgICAgICAgICAgICAgICBpZiAoIWNvb3Jkcykge1xyXG4gICAgICAgICAgICAgICAgICAgICAgICByZXR1cm4gY29uc29sZS5lcnJvcignY29vcmRzIGFyZSBub3Qgc3BlY2lmaWVkIScpO1xyXG4gICAgICAgICAgICAgICAgICAgIH1cclxuXHJcbiAgICAgICAgICAgICAgICAgICAgaGVyZW1hcHMubWFwLnNldENlbnRlcihjb29yZHMpO1xyXG4gICAgICAgICAgICAgICAgfSxcclxuICAgICAgICAgICAgICAgIGNsZWFuUm91dGVzOiBmdW5jdGlvbiAoKSB7XHJcbiAgICAgICAgICAgICAgICAgICAgUm91dGVzU2VydmljZS5jbGVhblJvdXRlcyhoZXJlbWFwcy5tYXApO1xyXG4gICAgICAgICAgICAgICAgfSxcclxuXHJcbiAgICAgICAgICAgICAgICAvKipcclxuICAgICAgICAgICAgICAgICAqIEBwYXJhbSB7Qm9vbGVhbn0gZW5hYmxlSGlnaEFjY3VyYWN5XHJcbiAgICAgICAgICAgICAgICAgKiBAcGFyYW0ge051bWJlcn0gbWF4aW11bUFnZSAtIHRoZSBtYXhpbXVtIGFnZSBpbiBtaWxsaXNlY29uZHMgb2YgYSBwb3NzaWJsZSBjYWNoZWQgcG9zaXRpb24gdGhhdCBpcyBhY2NlcHRhYmxlIHRvIHJldHVybi4gSWYgc2V0IHRvIDAsIGl0IG1lYW5zIHRoYXQgdGhlIGRldmljZSBjYW5ub3QgdXNlIGEgY2FjaGVkIHBvc2l0aW9uIGFuZCBtdXN0IGF0dGVtcHQgdG8gcmV0cmlldmUgdGhlIHJlYWwgY3VycmVudCBwb3NpdGlvblxyXG4gICAgICAgICAgICAgICAgICogQHJldHVybiB7UHJvbWlzZX1cclxuICAgICAgICAgICAgICAgICAqL1xyXG4gICAgICAgICAgICAgICAgZ2V0VXNlckxvY2F0aW9uOiBmdW5jdGlvbiAoZW5hYmxlSGlnaEFjY3VyYWN5LCBtYXhpbXVtQWdlKSB7XHJcbiAgICAgICAgICAgICAgICAgICAgcmV0dXJuIF9nZXRMb2NhdGlvbi5hcHBseShudWxsLCBhcmd1bWVudHMpLnRoZW4oZnVuY3Rpb24gKHBvc2l0aW9uKSB7XHJcbiAgICAgICAgICAgICAgICAgICAgICAgIHZhciBjb29yZHMgPSBwb3NpdGlvbi5jb29yZHM7XHJcblxyXG4gICAgICAgICAgICAgICAgICAgICAgICBNYXJrZXJzU2VydmljZS5hZGRVc2VyTWFya2VyKGhlcmVtYXBzLm1hcCwge1xyXG4gICAgICAgICAgICAgICAgICAgICAgICAgICAgcG9zOiB7XHJcbiAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgbGF0OiBjb29yZHMubGF0aXR1ZGUsXHJcbiAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgbG5nOiBjb29yZHMubG9uZ2l0dWRlXHJcbiAgICAgICAgICAgICAgICAgICAgICAgICAgICB9XHJcbiAgICAgICAgICAgICAgICAgICAgICAgIH0pO1xyXG5cclxuICAgICAgICAgICAgICAgICAgICAgICAgcmV0dXJuIGNvb3JkcztcclxuICAgICAgICAgICAgICAgICAgICB9KVxyXG4gICAgICAgICAgICAgICAgfSxcclxuXHJcbiAgICAgICAgICAgICAgICBnZW9jb2RlUG9zaXRpb246IGZ1bmN0aW9uIChjb29yZHMsIG9wdGlvbnMpIHtcclxuICAgICAgICAgICAgICAgICAgICByZXR1cm4gQVBJU2VydmljZS5nZW9jb2RlUG9zaXRpb24oaGVyZW1hcHMucGxhdGZvcm0sIHtcclxuICAgICAgICAgICAgICAgICAgICAgICAgY29vcmRzOiBjb29yZHMsXHJcbiAgICAgICAgICAgICAgICAgICAgICAgIHJhZGl1czogb3B0aW9ucyAmJiBvcHRpb25zLnJhZGl1cyxcclxuICAgICAgICAgICAgICAgICAgICAgICAgbGFuZzogb3B0aW9ucyAmJiBvcHRpb25zLmxhbmdcclxuICAgICAgICAgICAgICAgICAgICB9KTtcclxuICAgICAgICAgICAgICAgIH0sXHJcbiAgICAgICAgICAgICAgICB1cGRhdGVNYXJrZXJzOiBmdW5jdGlvbiAocGxhY2VzKSB7XHJcbiAgICAgICAgICAgICAgICAgICAgTWFya2Vyc1NlcnZpY2UudXBkYXRlTWFya2VycyhoZXJlbWFwcy5tYXAsIHBsYWNlcyk7XHJcbiAgICAgICAgICAgICAgICB9XHJcbiAgICAgICAgICAgIH1cclxuICAgICAgICB9XHJcblxyXG4gICAgfVxyXG59O1xyXG4iLCJyZXF1aXJlKCcuL3Byb3ZpZGVycy9tYXJrZXJzJyk7XHJcbnJlcXVpcmUoJy4vcHJvdmlkZXJzL21hcC1tb2R1bGVzJyk7XHJcbnJlcXVpcmUoJy4vcHJvdmlkZXJzL3JvdXRlcycpO1xyXG5cclxudmFyIGRpcmVjdGl2ZSA9IHJlcXVpcmUoJy4vaGVyZW1hcHMuZGlyZWN0aXZlJyksXHJcbiAgICBjb25maWdQcm92aWRlciA9IHJlcXVpcmUoJy4vcHJvdmlkZXJzL21hcGNvbmZpZy5wcm92aWRlcicpLFxyXG4gICAgYXBpU2VydmljZSA9IHJlcXVpcmUoJy4vcHJvdmlkZXJzL2FwaS5zZXJ2aWNlJyksXHJcbiAgICB1dGlsc1NlcnZpY2UgPSByZXF1aXJlKCcuL3Byb3ZpZGVycy9tYXB1dGlscy5zZXJ2aWNlJyksXHJcbiAgICBjb25zdHMgPSByZXF1aXJlKCcuL3Byb3ZpZGVycy9jb25zdHMnKTtcclxuXHJcbnZhciBoZXJlbWFwcyA9IGFuZ3VsYXIubW9kdWxlKCdoZXJlbWFwcycsIFtcclxuICAgICdtYXJrZXJzLW1vZHVsZScsXHJcbiAgICAncm91dGVzLW1vZHVsZScsXHJcbiAgICAnbWFwLW1vZHVsZXMnXHJcbl0pO1xyXG5cclxuaGVyZW1hcHNcclxuICAgIC5wcm92aWRlcignSGVyZU1hcHNDb25maWcnLCBjb25maWdQcm92aWRlcilcclxuICAgIC5zZXJ2aWNlKCdBUElTZXJ2aWNlJywgWyckcScsICckaHR0cCcsICdIZXJlTWFwc0NvbmZpZycsICdIZXJlTWFwVXRpbHNTZXJ2aWNlJywgJ0NPTlNUUycsIGFwaVNlcnZpY2VdKVxyXG4gICAgLnNlcnZpY2UoJ0hlcmVNYXBVdGlsc1NlcnZpY2UnLCB1dGlsc1NlcnZpY2UpXHJcbiAgICAuY29uc3RhbnQoJ0NPTlNUUycsIGNvbnN0cyk7XHJcblxyXG5oZXJlbWFwcy5kaXJlY3RpdmUoJ2hlcmVtYXBzJywgZGlyZWN0aXZlKTtcclxuXHJcbm1vZHVsZS5leHBvcnRzID0gaGVyZW1hcHM7IiwibW9kdWxlLmV4cG9ydHMgPSBmdW5jdGlvbiAoJHEsICRodHRwLCBIZXJlTWFwc0NvbmZpZywgSGVyZU1hcFV0aWxzU2VydmljZSwgQ09OU1RTKSB7XHJcbiAgICB2YXIgdmVyc2lvbiA9IEhlcmVNYXBzQ29uZmlnLmFwaVZlcnNpb24sXHJcbiAgICAgICAgcHJvdG9jb2wgPSBIZXJlTWFwc0NvbmZpZy51c2VIVFRQUyA/ICdodHRwcycgOiAnaHR0cCc7XHJcblxyXG4gICAgdmFyIEFQSV9WRVJTSU9OID0ge1xyXG4gICAgICAgIFY6IHBhcnNlSW50KHZlcnNpb24pLFxyXG4gICAgICAgIFNVQjogdmVyc2lvblxyXG4gICAgfTtcclxuXHJcbiAgICB2YXIgQ09ORklHID0ge1xyXG4gICAgICAgIEJBU0U6IFwiOi8vanMuYXBpLmhlcmUuY29tL3ZcIixcclxuICAgICAgICBDT1JFOiBcIm1hcHNqcy1jb3JlLmpzXCIsXHJcbiAgICAgICAgU0VSVklDRTogXCJtYXBzanMtc2VydmljZS5qc1wiLFxyXG4gICAgICAgIFVJOiB7XHJcbiAgICAgICAgICAgIHNyYzogXCJtYXBzanMtdWkuanNcIixcclxuICAgICAgICAgICAgaHJlZjogXCJtYXBzanMtdWkuY3NzXCJcclxuICAgICAgICB9LFxyXG4gICAgICAgIEVWRU5UUzogXCJtYXBzanMtbWFwZXZlbnRzLmpzXCJcclxuICAgIH07XHJcblxyXG4gICAgdmFyIEFQSV9ERUZFUlNRdWV1ZSA9IHt9O1xyXG5cclxuICAgIEFQSV9ERUZFUlNRdWV1ZVtDT05GSUcuQ09SRV0gPSBbXTtcclxuICAgIEFQSV9ERUZFUlNRdWV1ZVtDT05GSUcuU0VSVklDRV0gPSBbXTtcclxuICAgIEFQSV9ERUZFUlNRdWV1ZVtDT05GSUcuVUkuc3JjXSA9IFtdO1xyXG4gICAgQVBJX0RFRkVSU1F1ZXVlW0NPTkZJRy5QQU5PXSA9IFtdO1xyXG4gICAgQVBJX0RFRkVSU1F1ZXVlW0NPTkZJRy5FVkVOVFNdID0gW107XHJcblxyXG4gICAgdmFyIGhlYWQgPSBkb2N1bWVudC5nZXRFbGVtZW50c0J5VGFnTmFtZSgnaGVhZCcpWzBdO1xyXG5cclxuICAgIHJldHVybiB7XHJcbiAgICAgICAgbG9hZEFwaTogbG9hZEFwaSxcclxuICAgICAgICBsb2FkTW9kdWxlczogbG9hZE1vZHVsZXMsXHJcbiAgICAgICAgZ2V0UG9zaXRpb246IGdldFBvc2l0aW9uLFxyXG4gICAgICAgIGdlb2NvZGVQb3NpdGlvbjogZ2VvY29kZVBvc2l0aW9uXHJcbiAgICB9O1xyXG5cclxuICAgIC8vI3JlZ2lvbiBQVUJMSUNcclxuICAgIGZ1bmN0aW9uIGxvYWRBcGkoKSB7XHJcbiAgICAgICAgcmV0dXJuIF9nZXRMb2FkZXIoQ09ORklHLkNPUkUpXHJcbiAgICAgICAgICAgIC50aGVuKGZ1bmN0aW9uICgpIHtcclxuICAgICAgICAgICAgICAgIHJldHVybiBfZ2V0TG9hZGVyKENPTkZJRy5TRVJWSUNFKTtcclxuICAgICAgICAgICAgfSk7XHJcbiAgICB9XHJcblxyXG4gICAgZnVuY3Rpb24gbG9hZE1vZHVsZXMoYXR0cnMsIGhhbmRsZXJzKSB7XHJcbiAgICAgICAgZm9yICh2YXIga2V5IGluIGhhbmRsZXJzKSB7XHJcbiAgICAgICAgICAgIGlmICghaGFuZGxlcnMuaGFzT3duUHJvcGVydHkoa2V5KSB8fCAhYXR0cnNba2V5XSlcclxuICAgICAgICAgICAgICAgIGNvbnRpbnVlO1xyXG5cclxuICAgICAgICAgICAgdmFyIGxvYWRlciA9IF9nZXRMb2FkZXJCeUF0dHIoa2V5KTtcclxuXHJcbiAgICAgICAgICAgIGxvYWRlcigpXHJcbiAgICAgICAgICAgICAgICAudGhlbihoYW5kbGVyc1trZXldKTtcclxuICAgICAgICB9XHJcbiAgICB9XHJcblxyXG4gICAgZnVuY3Rpb24gZ2V0UG9zaXRpb24ob3B0aW9ucykge1xyXG4gICAgICAgIHZhciBkZWZlcnJlZCA9ICRxLmRlZmVyKCk7XHJcblxyXG4gICAgICAgIGlmIChvcHRpb25zICYmIF9pc1ZhbGlkQ29vcmRzKG9wdGlvbnMuY29vcmRzKSkge1xyXG4gICAgICAgICAgICBkZWZlcnJlZC5yZXNvbHZlKHsgY29vcmRzOiBvcHRpb25zLmNvb3JkcyB9KTtcclxuICAgICAgICB9IGVsc2Uge1xyXG4gICAgICAgICAgICBuYXZpZ2F0b3IuZ2VvbG9jYXRpb24uZ2V0Q3VycmVudFBvc2l0aW9uKGZ1bmN0aW9uIChyZXNwb25zZSkge1xyXG4gICAgICAgICAgICAgICAgZGVmZXJyZWQucmVzb2x2ZShyZXNwb25zZSk7XHJcbiAgICAgICAgICAgIH0sIGZ1bmN0aW9uIChlcnJvcikge1xyXG4gICAgICAgICAgICAgICAgZGVmZXJyZWQucmVqZWN0KGVycm9yKTtcclxuICAgICAgICAgICAgfSwgb3B0aW9ucyk7XHJcbiAgICAgICAgfVxyXG5cclxuICAgICAgICByZXR1cm4gZGVmZXJyZWQucHJvbWlzZTtcclxuICAgIH1cclxuXHJcbiAgICBmdW5jdGlvbiBnZW9jb2RlUG9zaXRpb24ocGxhdGZvcm0sIHBhcmFtcykge1xyXG4gICAgICAgIGlmICghcGFyYW1zLmNvb3JkcylcclxuICAgICAgICAgICAgcmV0dXJuIGNvbnNvbGUuZXJyb3IoJ01pc3NlZCByZXF1aXJlZCBjb29yZHMnKTtcclxuXHJcbiAgICAgICAgdmFyIGdlb2NvZGVyID0gcGxhdGZvcm0uZ2V0R2VvY29kaW5nU2VydmljZSgpLFxyXG4gICAgICAgICAgICBkZWZlcnJlZCA9ICRxLmRlZmVyKCksXHJcbiAgICAgICAgICAgIF9wYXJhbXMgPSB7XHJcbiAgICAgICAgICAgICAgICBwcm94OiBbcGFyYW1zLmNvb3Jkcy5sYXQsIHBhcmFtcy5jb29yZHMubG5nLCBwYXJhbXMucmFkaXVzIHx8IDI1MF0uam9pbignLCcpLFxyXG4gICAgICAgICAgICAgICAgbW9kZTogJ3JldHJpZXZlQWRkcmVzc2VzJyxcclxuICAgICAgICAgICAgICAgIG1heHJlc3VsdHM6ICcxJyxcclxuICAgICAgICAgICAgICAgIGdlbjogJzgnLFxyXG4gICAgICAgICAgICAgICAgbGFuZ3VhZ2U6IHBhcmFtcy5sYW5nIHx8ICdlbi1nYidcclxuICAgICAgICAgICAgfTtcclxuXHJcbiAgICAgICAgZ2VvY29kZXIucmV2ZXJzZUdlb2NvZGUoX3BhcmFtcywgZnVuY3Rpb24gKHJlc3BvbnNlKSB7XHJcbiAgICAgICAgICAgIGRlZmVycmVkLnJlc29sdmUocmVzcG9uc2UpXHJcbiAgICAgICAgfSwgZnVuY3Rpb24gKGVycm9yKSB7XHJcbiAgICAgICAgICAgIGRlZmVycmVkLnJlamVjdChlcnJvcilcclxuICAgICAgICB9KTtcclxuICAgICAgICBcclxuICAgICAgICByZXR1cm4gZGVmZXJyZWQucHJvbWlzZTtcclxuICAgIH1cclxuXHJcbiAgICAvLyNlbmRyZWdpb24gUFVCTElDXHJcblxyXG4gICAgZnVuY3Rpb24gX2dldExvYWRlckJ5QXR0cihhdHRyKSB7XHJcbiAgICAgICAgdmFyIGxvYWRlcjtcclxuXHJcbiAgICAgICAgc3dpdGNoIChhdHRyKSB7XHJcbiAgICAgICAgICAgIGNhc2UgQ09OU1RTLk1PRFVMRVMuVUk6XHJcbiAgICAgICAgICAgICAgICBsb2FkZXIgPSBfbG9hZFVJTW9kdWxlO1xyXG4gICAgICAgICAgICAgICAgYnJlYWs7XHJcbiAgICAgICAgICAgIGNhc2UgQ09OU1RTLk1PRFVMRVMuRVZFTlRTOlxyXG4gICAgICAgICAgICAgICAgbG9hZGVyID0gX2xvYWRFdmVudHNNb2R1bGU7XHJcbiAgICAgICAgICAgICAgICBicmVhaztcclxuICAgICAgICAgICAgZGVmYXVsdDpcclxuICAgICAgICAgICAgICAgIHRocm93IG5ldyBFcnJvcignVW5rbm93biBtb2R1bGUnLCBhdHRyKTtcclxuICAgICAgICB9XHJcblxyXG4gICAgICAgIHJldHVybiBsb2FkZXI7XHJcbiAgICB9XHJcblxyXG4gICAgZnVuY3Rpb24gX2xvYWRVSU1vZHVsZSgpIHtcclxuICAgICAgICBpZiAoIV9pc0xvYWRlZChDT05GSUcuVUkpKSB7XHJcbiAgICAgICAgICAgIHZhciBsaW5rID0gSGVyZU1hcFV0aWxzU2VydmljZS5jcmVhdGVMaW5rVGFnKHtcclxuICAgICAgICAgICAgICAgIHJlbDogJ3N0eWxlc2hlZXQnLFxyXG4gICAgICAgICAgICAgICAgdHlwZTogJ3RleHQvY3NzJyxcclxuICAgICAgICAgICAgICAgIGhyZWY6IF9nZXRVUkwoQ09ORklHLlVJLmhyZWYpXHJcbiAgICAgICAgICAgIH0pO1xyXG5cclxuICAgICAgICAgICAgbGluayAmJiBoZWFkLmFwcGVuZENoaWxkKGxpbmspO1xyXG4gICAgICAgIH1cclxuXHJcbiAgICAgICAgcmV0dXJuIF9nZXRMb2FkZXIoQ09ORklHLlVJLnNyYyk7XHJcbiAgICB9XHJcblxyXG4gICAgZnVuY3Rpb24gX2xvYWRFdmVudHNNb2R1bGUoKSB7XHJcbiAgICAgICAgcmV0dXJuIF9nZXRMb2FkZXIoQ09ORklHLkVWRU5UUyk7XHJcbiAgICB9XHJcblxyXG4gICAgLyoqXHJcbiAgICAgKiBAcGFyYW0ge1N0cmluZ30gc291cmNlTmFtZVxyXG4gICAgICogcmV0dXJuIHtTdHJpbmd9IGUuZyBodHRwOi8vanMuYXBpLmhlcmUuY29tL3Z7VkVSfS97U1VCVkVSU0lPTn0ve1NPVVJDRX1cclxuICAgICAqL1xyXG4gICAgZnVuY3Rpb24gX2dldFVSTChzb3VyY2VOYW1lKSB7XHJcbiAgICAgICAgcmV0dXJuIFtcclxuICAgICAgICAgICAgcHJvdG9jb2wsXHJcbiAgICAgICAgICAgIENPTkZJRy5CQVNFLFxyXG4gICAgICAgICAgICBBUElfVkVSU0lPTi5WLFxyXG4gICAgICAgICAgICBcIi9cIixcclxuICAgICAgICAgICAgQVBJX1ZFUlNJT04uU1VCLFxyXG4gICAgICAgICAgICBcIi9cIixcclxuICAgICAgICAgICAgc291cmNlTmFtZVxyXG4gICAgICAgIF0uam9pbihcIlwiKTtcclxuICAgIH1cclxuXHJcbiAgICBmdW5jdGlvbiBfZ2V0TG9hZGVyKHNvdXJjZU5hbWUpIHtcclxuICAgICAgICB2YXIgZGVmZXIgPSAkcS5kZWZlcigpLCBzcmMsIHNjcmlwdDtcclxuXHJcbiAgICAgICAgaWYgKF9pc0xvYWRlZChzb3VyY2VOYW1lKSkge1xyXG4gICAgICAgICAgICBkZWZlci5yZXNvbHZlKCk7XHJcbiAgICAgICAgfSBlbHNlIHtcclxuICAgICAgICAgICAgc3JjID0gX2dldFVSTChzb3VyY2VOYW1lKSxcclxuICAgICAgICAgICAgICAgIHNjcmlwdCA9IEhlcmVNYXBVdGlsc1NlcnZpY2UuY3JlYXRlU2NyaXB0VGFnKHsgc3JjOiBzcmMgfSk7XHJcblxyXG4gICAgICAgICAgICBzY3JpcHQgJiYgaGVhZC5hcHBlbmRDaGlsZChzY3JpcHQpO1xyXG5cclxuICAgICAgICAgICAgQVBJX0RFRkVSU1F1ZXVlW3NvdXJjZU5hbWVdLnB1c2goZGVmZXIpO1xyXG5cclxuICAgICAgICAgICAgc2NyaXB0Lm9ubG9hZCA9IF9vbkxvYWQuYmluZChudWxsLCBzb3VyY2VOYW1lKTtcclxuICAgICAgICAgICAgc2NyaXB0Lm9uZXJyb3IgPSBfb25FcnJvci5iaW5kKG51bGwsIHNvdXJjZU5hbWUpO1xyXG4gICAgICAgIH1cclxuXHJcbiAgICAgICAgcmV0dXJuIGRlZmVyLnByb21pc2U7XHJcbiAgICB9XHJcblxyXG4gICAgZnVuY3Rpb24gX2lzTG9hZGVkKHNvdXJjZU5hbWUpIHtcclxuICAgICAgICB2YXIgY2hlY2tlciA9IG51bGw7XHJcblxyXG4gICAgICAgIHN3aXRjaCAoc291cmNlTmFtZSkge1xyXG4gICAgICAgICAgICBjYXNlIENPTkZJRy5DT1JFOlxyXG4gICAgICAgICAgICAgICAgY2hlY2tlciA9IF9pc0NvcmVMb2FkZWQ7XHJcbiAgICAgICAgICAgICAgICBicmVhaztcclxuICAgICAgICAgICAgY2FzZSBDT05GSUcuU0VSVklDRTpcclxuICAgICAgICAgICAgICAgIGNoZWNrZXIgPSBfaXNTZXJ2aWNlTG9hZGVkO1xyXG4gICAgICAgICAgICAgICAgYnJlYWs7XHJcbiAgICAgICAgICAgIGNhc2UgQ09ORklHLlVJOlxyXG4gICAgICAgICAgICAgICAgY2hlY2tlciA9IF9pc1VJTG9hZGVkO1xyXG4gICAgICAgICAgICAgICAgYnJlYWs7XHJcbiAgICAgICAgICAgIGNhc2UgQ09ORklHLkVWRU5UUzpcclxuICAgICAgICAgICAgICAgIGNoZWNrZXIgPSBfaXNFdmVudHNMb2FkZWQ7XHJcbiAgICAgICAgICAgICAgICBicmVhaztcclxuICAgICAgICAgICAgZGVmYXVsdDpcclxuICAgICAgICAgICAgICAgIGNoZWNrZXIgPSBmdW5jdGlvbiAoKSB7IHJldHVybiBmYWxzZSB9O1xyXG4gICAgICAgIH1cclxuXHJcbiAgICAgICAgcmV0dXJuIGNoZWNrZXIoKTtcclxuICAgIH1cclxuXHJcbiAgICBmdW5jdGlvbiBfaXNDb3JlTG9hZGVkKCkge1xyXG4gICAgICAgIHJldHVybiAhIXdpbmRvdy5IO1xyXG4gICAgfVxyXG5cclxuICAgIGZ1bmN0aW9uIF9pc1NlcnZpY2VMb2FkZWQoKSB7XHJcbiAgICAgICAgcmV0dXJuICEhKHdpbmRvdy5IICYmIHdpbmRvdy5ILnNlcnZpY2UpO1xyXG4gICAgfVxyXG5cclxuICAgIGZ1bmN0aW9uIF9pc1VJTG9hZGVkKCkge1xyXG4gICAgICAgIHJldHVybiAhISh3aW5kb3cuSCAmJiB3aW5kb3cuSC51aSk7XHJcbiAgICB9XHJcblxyXG4gICAgZnVuY3Rpb24gX2lzRXZlbnRzTG9hZGVkKCkge1xyXG4gICAgICAgIHJldHVybiAhISh3aW5kb3cuSCAmJiB3aW5kb3cuSC5tYXBldmVudHMpO1xyXG4gICAgfVxyXG5cclxuICAgIGZ1bmN0aW9uIF9vbkxvYWQoc291cmNlTmFtZSkge1xyXG4gICAgICAgIHZhciBkZWZlclF1ZXVlID0gQVBJX0RFRkVSU1F1ZXVlW3NvdXJjZU5hbWVdO1xyXG4gICAgICAgIGZvciAodmFyIGkgPSAwLCBsID0gZGVmZXJRdWV1ZS5sZW5ndGg7IGkgPCBsOyArK2kpIHtcclxuICAgICAgICAgICAgdmFyIGRlZmVyID0gZGVmZXJRdWV1ZVtpXTtcclxuICAgICAgICAgICAgZGVmZXIucmVzb2x2ZSgpO1xyXG4gICAgICAgIH1cclxuXHJcbiAgICAgICAgQVBJX0RFRkVSU1F1ZXVlW3NvdXJjZU5hbWVdID0gW107XHJcbiAgICB9XHJcblxyXG4gICAgZnVuY3Rpb24gX29uRXJyb3Ioc291cmNlTmFtZSkge1xyXG4gICAgICAgIHZhciBkZWZlclF1ZXVlID0gQVBJX0RFRkVSU1F1ZXVlW3NvdXJjZU5hbWVdO1xyXG4gICAgICAgIGZvciAodmFyIGkgPSAwLCBsID0gZGVmZXJRdWV1ZS5sZW5ndGg7IGkgPCBsOyArK2kpIHtcclxuICAgICAgICAgICAgdmFyIGRlZmVyID0gZGVmZXJRdWV1ZVtpXTtcclxuICAgICAgICAgICAgZGVmZXIucmVqZWN0KCk7XHJcbiAgICAgICAgfVxyXG5cclxuICAgICAgICBBUElfREVGRVJTUXVldWVbc291cmNlTmFtZV0gPSBbXTtcclxuICAgIH1cclxuXHJcbiAgICBmdW5jdGlvbiBfaXNWYWxpZENvb3Jkcyhjb29yZHMpIHtcclxuICAgICAgICB2YXIgbG5nID0gY29vcmRzICYmIGNvb3Jkcy5sb25naXR1ZGUsXHJcbiAgICAgICAgICAgIGxhdCA9IGNvb3JkcyAmJiBjb29yZHMubGF0aXR1ZGU7XHJcblxyXG4gICAgICAgIHJldHVybiAodHlwZW9mIGxuZyA9PT0gJ251bWJlcicgfHwgdHlwZW9mIGxuZyA9PT0gJ3N0cmluZycpICYmXHJcbiAgICAgICAgICAgICh0eXBlb2YgbGF0ID09PSAnbnVtYmVyJyB8fCB0eXBlb2YgbGF0ID09PSAnc3RyaW5nJyk7XHJcbiAgICB9XHJcbn07IiwibW9kdWxlLmV4cG9ydHMgPSB7XHJcbiAgICBVUERBVEVfTUFQX1JFU0laRV9USU1FT1VUOiA1MDAsXHJcbiAgICBBTklNQVRJT05fWk9PTV9TVEVQOiAuMDUsXHJcbiAgICBNT0RVTEVTOiB7XHJcbiAgICAgICAgVUk6ICdjb250cm9scycsXHJcbiAgICAgICAgRVZFTlRTOiAnZXZlbnRzJyxcclxuICAgICAgICBQQU5POiAncGFubydcclxuICAgIH0sXHJcbiAgICBERUZBVUxUX01BUF9PUFRJT05TOiB7XHJcbiAgICAgICAgaGVpZ2h0OiA0ODAsXHJcbiAgICAgICAgd2lkdGg6IDY0MCxcclxuICAgICAgICB6b29tOiAxMixcclxuICAgICAgICBtYXhab29tOiAyLFxyXG4gICAgICAgIHJlc2l6ZTogZmFsc2UsXHJcbiAgICAgICAgZHJhZ2dhYmxlOiBmYWxzZSxcclxuICAgICAgICBjb29yZHM6IHtcclxuICAgICAgICAgICAgbG9uZ2l0dWRlOiAwLFxyXG4gICAgICAgICAgICBsYXRpdHVkZTogMFxyXG4gICAgICAgIH1cclxuICAgIH0sXHJcbiAgICBNQVJLRVJfVFlQRVM6IHtcclxuICAgICAgICBET006IFwiRE9NXCIsXHJcbiAgICAgICAgU1ZHOiBcIlNWR1wiXHJcbiAgICB9LFxyXG4gICAgQ09OVFJPTFM6IHtcclxuICAgICAgICBOQU1FUzoge1xyXG4gICAgICAgICAgICBTQ0FMRTogJ3NjYWxlYmFyJyxcclxuICAgICAgICAgICAgU0VUVElOR1M6ICdtYXBzZXR0aW5ncycsXHJcbiAgICAgICAgICAgIFpPT006ICd6b29tJyxcclxuICAgICAgICAgICAgVVNFUjogJ3VzZXJwb3NpdGlvbidcclxuICAgICAgICB9LFxyXG4gICAgICAgIFBPU0lUSU9OUzogW1xyXG4gICAgICAgICAgICAndG9wLXJpZ2h0JyxcclxuICAgICAgICAgICAgJ3RvcC1jZW50ZXInLFxyXG4gICAgICAgICAgICAndG9wLWxlZnQnLFxyXG4gICAgICAgICAgICAnbGVmdC10b3AnLFxyXG4gICAgICAgICAgICAnbGVmdC1taWRkbGUnLFxyXG4gICAgICAgICAgICAnbGVmdC1ib3R0b20nLFxyXG4gICAgICAgICAgICAncmlnaHQtdG9wJyxcclxuICAgICAgICAgICAgJ3JpZ2h0LW1pZGRsZScsXHJcbiAgICAgICAgICAgICdyaWdodC1ib3R0b20nLFxyXG4gICAgICAgICAgICAnYm90dG9tLXJpZ2h0JyxcclxuICAgICAgICAgICAgJ2JvdHRvbS1jZW50ZXInLFxyXG4gICAgICAgICAgICAnYm90dG9tLWxlZnQnXHJcbiAgICAgICAgXVxyXG4gICAgfSxcclxuICAgIElORk9CVUJCTEU6IHtcclxuICAgICAgICBTVEFURToge1xyXG4gICAgICAgICAgICBPUEVOOiAnb3BlbicsXHJcbiAgICAgICAgICAgIENMT1NFRDogJ2Nsb3NlZCdcclxuICAgICAgICB9LFxyXG4gICAgICAgIERJU1BMQVlfRVZFTlQ6IHtcclxuICAgICAgICAgICAgcG9pbnRlcm1vdmU6ICdvbkhvdmVyJyxcclxuICAgICAgICAgICAgdGFwOiAnb25DbGljaydcclxuICAgICAgICB9XHJcbiAgICB9LFxyXG4gICAgVVNFUl9FVkVOVFM6IHtcclxuICAgICAgICB0YXA6ICdjbGljaycsXHJcbiAgICAgICAgcG9pbnRlcm1vdmU6ICdtb3VzZW1vdmUnLFxyXG4gICAgICAgIHBvaW50ZXJsZWF2ZTogJ21vdXNlbGVhdmUnLFxyXG4gICAgICAgIHBvaW50ZXJlbnRlcjogJ21vdXNlZW50ZXInLFxyXG4gICAgICAgIGRyYWc6ICdkcmFnJyxcclxuICAgICAgICBkcmFnc3RhcnQ6ICdkcmFnc3RhcnQnLFxyXG4gICAgICAgIGRyYWdlbmQ6ICdkcmFnZW5kJ1xyXG4gICAgfVxyXG59IiwibW9kdWxlLmV4cG9ydHMgPSBmdW5jdGlvbihIZXJlTWFwVXRpbHNTZXJ2aWNlLCBNYXJrZXJzU2VydmljZSwgQ09OU1RTLCBJbmZvQnViYmxlRmFjdG9yeSkge1xyXG4gICAgZnVuY3Rpb24gRXZlbnRzKHBsYXRmb3JtLCBJbmplY3RvciwgbGlzdGVuZXJzKSB7XHJcbiAgICAgICAgdGhpcy5tYXAgPSBwbGF0Zm9ybS5tYXA7XHJcbiAgICAgICAgdGhpcy5saXN0ZW5lcnMgPSBsaXN0ZW5lcnM7XHJcbiAgICAgICAgdGhpcy5pbmplY3QgPSBuZXcgSW5qZWN0b3IoKTtcclxuICAgICAgICB0aGlzLmV2ZW50cyA9IHBsYXRmb3JtLmV2ZW50cyA9IG5ldyBILm1hcGV2ZW50cy5NYXBFdmVudHModGhpcy5tYXApO1xyXG4gICAgICAgIHRoaXMuYmVoYXZpb3IgPSBwbGF0Zm9ybS5iZWhhdmlvciA9IG5ldyBILm1hcGV2ZW50cy5CZWhhdmlvcih0aGlzLmV2ZW50cyk7XHJcbiAgICAgICAgdGhpcy5idWJibGUgPSBJbmZvQnViYmxlRmFjdG9yeS5jcmVhdGUoKTtcclxuXHJcbiAgICAgICAgdGhpcy5zZXR1cEV2ZW50TGlzdGVuZXJzKCk7XHJcbiAgICB9XHJcblxyXG4gICAgdmFyIHByb3RvID0gRXZlbnRzLnByb3RvdHlwZTtcclxuXHJcbiAgICBwcm90by5zZXR1cEV2ZW50TGlzdGVuZXJzID0gc2V0dXBFdmVudExpc3RlbmVycztcclxuICAgIHByb3RvLnNldHVwT3B0aW9ucyA9IHNldHVwT3B0aW9ucztcclxuICAgIHByb3RvLnRyaWdnZXJVc2VyTGlzdGVuZXIgPSB0cmlnZ2VyVXNlckxpc3RlbmVyO1xyXG4gICAgcHJvdG8uaW5mb0J1YmJsZUhhbmRsZXIgPSBpbmZvQnViYmxlSGFuZGxlcjsgIFxyXG5cclxuICAgIHJldHVybiB7XHJcbiAgICAgICAgc3RhcnQ6IGZ1bmN0aW9uKGFyZ3MpIHtcclxuICAgICAgICAgICAgaWYgKCEoYXJncy5wbGF0Zm9ybS5tYXAgaW5zdGFuY2VvZiBILk1hcCkpXHJcbiAgICAgICAgICAgICAgICByZXR1cm4gY29uc29sZS5lcnJvcignTWlzc2VkIHJlcXVpcmVkIG1hcCBpbnN0YW5jZScpO1xyXG5cclxuICAgICAgICAgICAgdmFyIGV2ZW50cyA9IG5ldyBFdmVudHMoYXJncy5wbGF0Zm9ybSwgYXJncy5pbmplY3RvciwgYXJncy5saXN0ZW5lcnMpO1xyXG5cclxuICAgICAgICAgICAgYXJncy5vcHRpb25zICYmIGV2ZW50cy5zZXR1cE9wdGlvbnMoYXJncy5vcHRpb25zKTtcclxuICAgICAgICB9XHJcbiAgICB9XHJcblxyXG4gICAgZnVuY3Rpb24gc2V0dXBFdmVudExpc3RlbmVycygpIHtcclxuICAgICAgICB2YXIgc2VsZiA9IHRoaXM7XHJcblxyXG4gICAgICAgIEhlcmVNYXBVdGlsc1NlcnZpY2UuYWRkRXZlbnRMaXN0ZW5lcih0aGlzLm1hcCwgJ3RhcCcsIHRoaXMuaW5mb0J1YmJsZUhhbmRsZXIuYmluZCh0aGlzKSk7XHJcblxyXG4gICAgICAgIEhlcmVNYXBVdGlsc1NlcnZpY2UuYWRkRXZlbnRMaXN0ZW5lcih0aGlzLm1hcCwgJ3BvaW50ZXJtb3ZlJywgdGhpcy5pbmZvQnViYmxlSGFuZGxlci5iaW5kKHRoaXMpKTtcclxuXHJcbiAgICAgICAgSGVyZU1hcFV0aWxzU2VydmljZS5hZGRFdmVudExpc3RlbmVyKHRoaXMubWFwLCAnZHJhZ3N0YXJ0JywgZnVuY3Rpb24oZSkge1xyXG4gICAgICAgICAgICBpZiAoTWFya2Vyc1NlcnZpY2UuaXNNYXJrZXJJbnN0YW5jZShlLnRhcmdldCkpIHtcclxuICAgICAgICAgICAgICAgIHNlbGYuYmVoYXZpb3IuZGlzYWJsZSgpO1xyXG4gICAgICAgICAgICB9XHJcblxyXG4gICAgICAgICAgICBzZWxmLnRyaWdnZXJVc2VyTGlzdGVuZXIoQ09OU1RTLlVTRVJfRVZFTlRTW2UudHlwZV0sIGUpO1xyXG4gICAgICAgIH0pO1xyXG5cclxuICAgICAgICBIZXJlTWFwVXRpbHNTZXJ2aWNlLmFkZEV2ZW50TGlzdGVuZXIodGhpcy5tYXAsICdkcmFnJywgZnVuY3Rpb24oZSkge1xyXG4gICAgICAgICAgICB2YXIgcG9pbnRlciA9IGUuY3VycmVudFBvaW50ZXIsXHJcbiAgICAgICAgICAgICAgICB0YXJnZXQgPSBlLnRhcmdldDtcclxuXHJcbiAgICAgICAgICAgIGlmIChNYXJrZXJzU2VydmljZS5pc01hcmtlckluc3RhbmNlKHRhcmdldCkpIHtcclxuICAgICAgICAgICAgICAgIHRhcmdldC5zZXRQb3NpdGlvbihzZWxmLm1hcC5zY3JlZW5Ub0dlbyhwb2ludGVyLnZpZXdwb3J0WCwgcG9pbnRlci52aWV3cG9ydFkpKTtcclxuICAgICAgICAgICAgfVxyXG5cclxuICAgICAgICAgICAgc2VsZi50cmlnZ2VyVXNlckxpc3RlbmVyKENPTlNUUy5VU0VSX0VWRU5UU1tlLnR5cGVdLCBlKTtcclxuICAgICAgICB9KTtcclxuXHJcbiAgICAgICAgSGVyZU1hcFV0aWxzU2VydmljZS5hZGRFdmVudExpc3RlbmVyKHRoaXMubWFwLCAnZHJhZ2VuZCcsIGZ1bmN0aW9uKGUpIHtcclxuICAgICAgICAgICAgaWYgKE1hcmtlcnNTZXJ2aWNlLmlzTWFya2VySW5zdGFuY2UoZS50YXJnZXQpKSB7XHJcbiAgICAgICAgICAgICAgICBzZWxmLmJlaGF2aW9yLmVuYWJsZSgpO1xyXG4gICAgICAgICAgICB9XHJcblxyXG4gICAgICAgICAgICBzZWxmLnRyaWdnZXJVc2VyTGlzdGVuZXIoQ09OU1RTLlVTRVJfRVZFTlRTW2UudHlwZV0sIGUpO1xyXG4gICAgICAgIH0pO1xyXG4gICAgfVxyXG5cclxuICAgIGZ1bmN0aW9uIHNldHVwT3B0aW9ucyhvcHRpb25zKSB7XHJcbiAgICAgICAgaWYgKCFvcHRpb25zKVxyXG4gICAgICAgICAgICByZXR1cm47XHJcblxyXG4gICAgICAgIHRoaXMubWFwLmRyYWdnYWJsZSA9ICEhb3B0aW9ucy5kcmFnZ2FibGU7XHJcbiAgICB9XHJcblxyXG4gICAgZnVuY3Rpb24gdHJpZ2dlclVzZXJMaXN0ZW5lcihldmVudE5hbWUsIGUpIHtcclxuICAgICAgICBpZiAoIXRoaXMubGlzdGVuZXJzKVxyXG4gICAgICAgICAgICByZXR1cm47XHJcblxyXG4gICAgICAgIHZhciBjYWxsYmFjayA9IHRoaXMubGlzdGVuZXJzW2V2ZW50TmFtZV07XHJcblxyXG4gICAgICAgIGNhbGxiYWNrICYmIGNhbGxiYWNrKGUpO1xyXG4gICAgfVxyXG4gICAgXHJcbiAgICBmdW5jdGlvbiBpbmZvQnViYmxlSGFuZGxlcihlKXtcclxuICAgICAgICB2YXIgdWkgPSB0aGlzLmluamVjdCgndWknKTtcclxuICAgICAgICBcclxuICAgICAgICBpZih1aSlcclxuICAgICAgICAgICAgdGhpcy5idWJibGUudG9nZ2xlKGUsIHVpKTtcclxuICAgICAgICAgICAgXHJcbiAgICAgICAgdGhpcy50cmlnZ2VyVXNlckxpc3RlbmVyKENPTlNUUy5VU0VSX0VWRU5UU1tlLnR5cGVdLCBlKTsgICAgICBcclxuICAgIH1cclxuXHJcbn07IiwibW9kdWxlLmV4cG9ydHMgPSBmdW5jdGlvbihNYXJrZXJzU2VydmljZSwgSGVyZU1hcFV0aWxzU2VydmljZSwgQ09OU1RTKSB7XHJcbiAgICBmdW5jdGlvbiBJbmZvQnViYmxlKCkge31cclxuXHJcbiAgICB2YXIgcHJvdG8gPSBJbmZvQnViYmxlLnByb3RvdHlwZTtcclxuICAgICAgICBcclxuICAgIHByb3RvLmNyZWF0ZSA9IGNyZWF0ZTtcclxuICAgIHByb3RvLnVwZGF0ZSA9IHVwZGF0ZTtcclxuICAgIHByb3RvLnRvZ2dsZSA9IHRvZ2dsZTtcclxuICAgIHByb3RvLnNob3cgPSBzaG93O1xyXG4gICAgcHJvdG8uY2xvc2UgPSBjbG9zZTtcclxuXHJcbiAgICByZXR1cm4ge1xyXG4gICAgICAgIGNyZWF0ZTogZnVuY3Rpb24oKXtcclxuICAgICAgICAgICAgcmV0dXJuIG5ldyBJbmZvQnViYmxlKCk7XHJcbiAgICAgICAgfVxyXG4gICAgfVxyXG5cclxuICAgIGZ1bmN0aW9uIHRvZ2dsZShlLCB1aSkge1xyXG4gICAgICAgIGlmIChNYXJrZXJzU2VydmljZS5pc01hcmtlckluc3RhbmNlKGUudGFyZ2V0KSlcclxuICAgICAgICAgICAgdGhpcy5zaG93KGUsIHVpKTtcclxuICAgICAgICBlbHNlXHJcbiAgICAgICAgICAgIHRoaXMuY2xvc2UoZSwgdWkpO1xyXG4gICAgfVxyXG5cclxuICAgIGZ1bmN0aW9uIHVwZGF0ZShidWJibGUsIGRhdGEpIHtcclxuICAgICAgICBidWJibGUuZGlzcGxheSA9IGRhdGEuZGlzcGxheTtcclxuXHJcbiAgICAgICAgYnViYmxlLnNldFBvc2l0aW9uKGRhdGEucG9zaXRpb24pO1xyXG4gICAgICAgIGJ1YmJsZS5zZXRDb250ZW50KGRhdGEubWFya3VwKTtcclxuXHJcbiAgICAgICAgYnViYmxlLnNldFN0YXRlKENPTlNUUy5JTkZPQlVCQkxFLlNUQVRFLk9QRU4pO1xyXG4gICAgfVxyXG5cclxuICAgIGZ1bmN0aW9uIGNyZWF0ZShzb3VyY2UpIHtcclxuICAgICAgICB2YXIgYnViYmxlID0gbmV3IEgudWkuSW5mb0J1YmJsZShzb3VyY2UucG9zaXRpb24sIHtcclxuICAgICAgICAgICAgY29udGVudDogc291cmNlLm1hcmt1cFxyXG4gICAgICAgIH0pO1xyXG5cclxuICAgICAgICBidWJibGUuZGlzcGxheSA9IHNvdXJjZS5kaXNwbGF5O1xyXG4gICAgICAgIGJ1YmJsZS5hZGRDbGFzcyhDT05TVFMuSU5GT0JVQkJMRS5TVEFURS5PUEVOKVxyXG5cclxuICAgICAgICBIZXJlTWFwVXRpbHNTZXJ2aWNlLmFkZEV2ZW50TGlzdGVuZXIoYnViYmxlLCAnc3RhdGVjaGFuZ2UnLCBmdW5jdGlvbihlKSB7XHJcbiAgICAgICAgICAgIHZhciBzdGF0ZSA9IHRoaXMuZ2V0U3RhdGUoKSxcclxuICAgICAgICAgICAgICAgIGVsID0gdGhpcy5nZXRFbGVtZW50KCk7XHJcbiAgICAgICAgICAgIGlmIChzdGF0ZSA9PT0gQ09OU1RTLklORk9CVUJCTEUuU1RBVEUuQ0xPU0VEKSB7XHJcbiAgICAgICAgICAgICAgICBlbC5jbGFzc0xpc3QucmVtb3ZlKENPTlNUUy5JTkZPQlVCQkxFLlNUQVRFLk9QRU4pO1xyXG4gICAgICAgICAgICB9IGVsc2VcclxuICAgICAgICAgICAgICAgIHRoaXMuYWRkQ2xhc3Moc3RhdGUpXHJcbiAgICAgICAgfSk7XHJcblxyXG4gICAgICAgIHJldHVybiBidWJibGU7XHJcbiAgICB9XHJcblxyXG4gICAgZnVuY3Rpb24gc2hvdyhlLCB1aSwgZGF0YSkge1xyXG4gICAgICAgIHZhciB0YXJnZXQgPSBlLnRhcmdldCxcclxuICAgICAgICAgICAgZGF0YSA9IHRhcmdldC5nZXREYXRhKCksXHJcbiAgICAgICAgICAgIGVsID0gbnVsbDtcclxuXHJcbiAgICAgICAgaWYgKCFkYXRhIHx8ICFkYXRhLmRpc3BsYXkgfHwgIWRhdGEubWFya3VwIHx8IGRhdGEuZGlzcGxheSAhPT0gQ09OU1RTLklORk9CVUJCTEUuRElTUExBWV9FVkVOVFtlLnR5cGVdKVxyXG4gICAgICAgICAgICByZXR1cm47XHJcblxyXG4gICAgICAgIHZhciBzb3VyY2UgPSB7XHJcbiAgICAgICAgICAgIHBvc2l0aW9uOiB0YXJnZXQuZ2V0UG9zaXRpb24oKSxcclxuICAgICAgICAgICAgbWFya3VwOiBkYXRhLm1hcmt1cCxcclxuICAgICAgICAgICAgZGlzcGxheTogZGF0YS5kaXNwbGF5XHJcbiAgICAgICAgfTtcclxuXHJcbiAgICAgICAgaWYgKCF1aS5idWJibGUpIHtcclxuICAgICAgICAgICAgdWkuYnViYmxlID0gdGhpcy5jcmVhdGUoc291cmNlKTtcclxuICAgICAgICAgICAgdWkuYWRkQnViYmxlKHVpLmJ1YmJsZSk7XHJcblxyXG4gICAgICAgICAgICByZXR1cm47XHJcbiAgICAgICAgfVxyXG5cclxuICAgICAgICB0aGlzLnVwZGF0ZSh1aS5idWJibGUsIHNvdXJjZSk7XHJcbiAgICB9XHJcblxyXG4gICAgZnVuY3Rpb24gY2xvc2UoZSwgdWkpIHtcclxuICAgICAgICBpZiAoIXVpLmJ1YmJsZSB8fCB1aS5idWJibGUuZGlzcGxheSAhPT0gQ09OU1RTLklORk9CVUJCTEUuRElTUExBWV9FVkVOVFtlLnR5cGVdKSB7XHJcbiAgICAgICAgICAgIHJldHVybjtcclxuICAgICAgICB9XHJcblxyXG4gICAgICAgIHVpLmJ1YmJsZS5zZXRTdGF0ZShDT05TVFMuSU5GT0JVQkJMRS5TVEFURS5DTE9TRUQpO1xyXG4gICAgfVxyXG59IiwidmFyIGV2ZW50c01vZHVsZSA9IHJlcXVpcmUoJy4vZXZlbnRzL2V2ZW50cy5qcycpLFxyXG4gICAgaW5mb0J1YmJsZSA9IHJlcXVpcmUoJy4vZXZlbnRzL2luZm9idWJibGUuanMnKTtcclxuICAgIFxyXG52YXIgdWlNb2R1bGUgPSByZXF1aXJlKCcuL3VpL3VpLmpzJyk7XHJcblxyXG5hbmd1bGFyLm1vZHVsZSgnZXZlbnRzLW1vZHVsZScsIFtdKVxyXG4gICAgLmZhY3RvcnkoJ0V2ZW50c01vZHVsZScsIGV2ZW50c01vZHVsZSlcclxuICAgIC5mYWN0b3J5KCdJbmZvQnViYmxlRmFjdG9yeScsIGluZm9CdWJibGUpO1xyXG4gICAgXHJcbmFuZ3VsYXIubW9kdWxlKCd1aS1tb2R1bGUnLCBbXSlcclxuICAgIC5mYWN0b3J5KCdVSU1vZHVsZScsIHVpTW9kdWxlKVxyXG5cclxudmFyIGFwcCA9IGFuZ3VsYXIubW9kdWxlKCdtYXAtbW9kdWxlcycsIFtcclxuXHQnZXZlbnRzLW1vZHVsZScsXHJcbiAgICAndWktbW9kdWxlJ1xyXG5dKTtcclxuXHJcbm1vZHVsZS5leHBvcnRzID0gYXBwOyIsIm1vZHVsZS5leHBvcnRzID0gZnVuY3Rpb24oQVBJU2VydmljZSwgTWFya2Vyc1NlcnZpY2UsIEhlcmVNYXBVdGlsc1NlcnZpY2UsIENPTlNUUykge1xyXG4gICAgZnVuY3Rpb24gVUkocGxhdGZvcm0sIGFsaWdubWVudCkge1xyXG4gICAgICAgIHRoaXMubWFwID0gcGxhdGZvcm0ubWFwO1xyXG4gICAgICAgIHRoaXMubGF5ZXJzID0gcGxhdGZvcm0ubGF5ZXJzO1xyXG4gICAgICAgIHRoaXMuYWxpZ25tZW50ID0gYWxpZ25tZW50O1xyXG4gICAgICAgIHRoaXMudWkgPSBwbGF0Zm9ybS51aSA9IEgudWkuVUkuY3JlYXRlRGVmYXVsdCh0aGlzLm1hcCwgdGhpcy5sYXllcnMpO1xyXG5cclxuICAgICAgICB0aGlzLnNldHVwQ29udHJvbHMoKTtcclxuICAgIH1cclxuXHJcbiAgICBVSS5pc1ZhbGlkQWxpZ25tZW50ID0gaXNWYWxpZEFsaWdubWVudDtcclxuXHJcbiAgICB2YXIgcHJvdG8gPSBVSS5wcm90b3R5cGU7XHJcblxyXG4gICAgcHJvdG8uc2V0dXBDb250cm9scyA9IHNldHVwQ29udHJvbHM7XHJcbiAgICBwcm90by5jcmVhdGVVc2VyQ29udHJvbCA9IGNyZWF0ZVVzZXJDb250cm9sO1xyXG4gICAgcHJvdG8uc2V0Q29udHJvbHNBbGlnbm1lbnQgPSBzZXRDb250cm9sc0FsaWdubWVudDtcclxuXHJcbiAgICByZXR1cm4ge1xyXG4gICAgICAgIHN0YXJ0OiBmdW5jdGlvbihhcmdzKSB7XHJcbiAgICAgICAgICAgIGlmICghKGFyZ3MucGxhdGZvcm0ubWFwIGluc3RhbmNlb2YgSC5NYXApICYmICEoYXJncy5wbGF0Zm9ybS5sYXllcnMpKVxyXG4gICAgICAgICAgICAgICAgcmV0dXJuIGNvbnNvbGUuZXJyb3IoJ01pc3NlZCB1aSBtb2R1bGUgZGVwZW5kZW5jaWVzJyk7XHJcblxyXG4gICAgICAgICAgICB2YXIgdWkgPSBuZXcgVUkoYXJncy5wbGF0Zm9ybSwgYXJncy5hbGlnbm1lbnQpO1xyXG4gICAgICAgIH1cclxuICAgIH1cclxuXHJcbiAgICBmdW5jdGlvbiBzZXR1cENvbnRyb2xzKCkge1xyXG4gICAgICAgIHZhciBOQU1FUyA9IENPTlNUUy5DT05UUk9MUy5OQU1FUyxcclxuICAgICAgICAgICAgdXNlckNvbnRyb2wgPSB0aGlzLmNyZWF0ZVVzZXJDb250cm9sKCk7XHJcblxyXG4gICAgICAgIHRoaXMudWkuZ2V0Q29udHJvbChOQU1FUy5TRVRUSU5HUykuc2V0SW5jaWRlbnRzTGF5ZXIoZmFsc2UpO1xyXG4gICAgICAgIHRoaXMudWkuYWRkQ29udHJvbChOQU1FUy5VU0VSLCB1c2VyQ29udHJvbCk7XHJcbiAgICAgICAgdGhpcy5zZXRDb250cm9sc0FsaWdubWVudChOQU1FUyk7XHJcbiAgICB9XHJcblxyXG4gICAgZnVuY3Rpb24gY3JlYXRlVXNlckNvbnRyb2woKSB7XHJcbiAgICAgICAgdmFyIHNlbGYgPSB0aGlzLFxyXG4gICAgICAgICAgICB1c2VyQ29udHJvbCA9IG5ldyBILnVpLkNvbnRyb2woKSxcclxuICAgICAgICAgICAgbWFya3VwID0gJzxzdmcgY2xhc3M9XCJIX2ljb25cIiBmaWxsPVwiI2ZmZlwiIHhtbG5zPVwiaHR0cDovL3d3dy53My5vcmcvMjAwMC9zdmdcIiB3aWR0aD1cIjE2XCIgaGVpZ2h0PVwiMTZcIiB2aWV3Qm94PVwiMCAwIDE2IDE2XCI+PHBhdGggY2xhc3M9XCJtaWRkbGVfbG9jYXRpb25fc3Ryb2tlXCIgZD1cIk04IDEyYy0yLjIwNiAwLTQtMS43OTUtNC00IDAtMi4yMDYgMS43OTQtNCA0LTRzNCAxLjc5NCA0IDRjMCAyLjIwNS0xLjc5NCA0LTQgNE04IDEuMjVhNi43NSA2Ljc1IDAgMSAwIDAgMTMuNSA2Ljc1IDYuNzUgMCAwIDAgMC0xMy41XCI+PC9wYXRoPjxwYXRoIGNsYXNzPVwiaW5uZXJfbG9jYXRpb25fc3Ryb2tlXCIgZD1cIk04IDVhMyAzIDAgMSAxIC4wMDEgNkEzIDMgMCAwIDEgOCA1bTAtMUM1Ljc5NCA0IDQgNS43OTQgNCA4YzAgMi4yMDUgMS43OTQgNCA0IDRzNC0xLjc5NSA0LTRjMC0yLjIwNi0xLjc5NC00LTQtNFwiPjwvcGF0aD48cGF0aCBjbGFzcz1cIm91dGVyX2xvY2F0aW9uX3N0cm9rZVwiIGQ9XCJNOCAxLjI1YTYuNzUgNi43NSAwIDEgMSAwIDEzLjUgNi43NSA2Ljc1IDAgMCAxIDAtMTMuNU04IDBDMy41OSAwIDAgMy41OSAwIDhjMCA0LjQxMSAzLjU5IDggOCA4czgtMy41ODkgOC04YzAtNC40MS0zLjU5LTgtOC04XCI+PC9wYXRoPjwvc3ZnPic7XHJcblxyXG4gICAgICAgIHZhciB1c2VyQ29udHJvbEJ1dHRvbiA9IG5ldyBILnVpLmJhc2UuQnV0dG9uKHtcclxuICAgICAgICAgICAgbGFiZWw6IG1hcmt1cCxcclxuICAgICAgICAgICAgb25TdGF0ZUNoYW5nZTogZnVuY3Rpb24oZXZ0KSB7XHJcbiAgICAgICAgICAgICAgICBpZiAodXNlckNvbnRyb2xCdXR0b24uZ2V0U3RhdGUoKSA9PT0gSC51aS5iYXNlLkJ1dHRvbi5TdGF0ZS5ET1dOKVxyXG4gICAgICAgICAgICAgICAgICAgIHJldHVybjtcclxuXHJcbiAgICAgICAgICAgICAgICBBUElTZXJ2aWNlLmdldFBvc2l0aW9uKCkudGhlbihmdW5jdGlvbihyZXNwb25zZSkge1xyXG4gICAgICAgICAgICAgICAgICAgIHZhciBwb3NpdGlvbiA9IHtcclxuICAgICAgICAgICAgICAgICAgICAgICAgbG5nOiByZXNwb25zZS5jb29yZHMubG9uZ2l0dWRlLFxyXG4gICAgICAgICAgICAgICAgICAgICAgICBsYXQ6IHJlc3BvbnNlLmNvb3Jkcy5sYXRpdHVkZVxyXG4gICAgICAgICAgICAgICAgICAgIH07XHJcbiAgICAgICAgICAgICAgICAgICAgXHJcbiAgICAgICAgICAgICAgICAgICAgc2VsZi5tYXAuc2V0Q2VudGVyKHBvc2l0aW9uKTtcclxuICAgICAgICAgICAgICAgICAgICBcclxuICAgICAgICAgICAgICAgICAgICBIZXJlTWFwVXRpbHNTZXJ2aWNlLnpvb20oc2VsZi5tYXAsIDE3LCAuMDgpO1xyXG5cclxuICAgICAgICAgICAgICAgICAgICBpZiAoc2VsZi51c2VyTWFya2VyKSB7XHJcbiAgICAgICAgICAgICAgICAgICAgICAgIHNlbGYudXNlck1hcmtlci5zZXRQb3NpdGlvbihwb3NpdGlvbik7XHJcbiAgICAgICAgICAgICAgICAgICAgICAgIHJldHVybjtcclxuICAgICAgICAgICAgICAgICAgICB9XHJcbiAgICAgICAgICAgICAgICAgICAgXHJcbiAgICAgICAgICAgICAgICAgICAgc2VsZi51c2VyTWFya2VyID0gTWFya2Vyc1NlcnZpY2UuYWRkVXNlck1hcmtlcihzZWxmLm1hcCwge1xyXG4gICAgICAgICAgICAgICAgICAgICAgICBwb3M6IHBvc2l0aW9uXHJcbiAgICAgICAgICAgICAgICAgICAgfSk7XHJcbiAgICAgICAgICAgICAgICB9KTtcclxuICAgICAgICAgICAgfVxyXG4gICAgICAgIH0pO1xyXG5cclxuICAgICAgICB1c2VyQ29udHJvbC5hZGRDaGlsZCh1c2VyQ29udHJvbEJ1dHRvbik7XHJcblxyXG4gICAgICAgIHJldHVybiB1c2VyQ29udHJvbDtcclxuICAgIH1cclxuXHJcbiAgICBmdW5jdGlvbiBzZXRDb250cm9sc0FsaWdubWVudChOQU1FUykge1xyXG4gICAgICAgIGlmICghVUkuaXNWYWxpZEFsaWdubWVudCh0aGlzLmFsaWdubWVudCkpXHJcbiAgICAgICAgICAgIHJldHVybjtcclxuXHJcbiAgICAgICAgZm9yICh2YXIgaWQgaW4gTkFNRVMpIHtcclxuICAgICAgICAgICAgdmFyIGNvbnRyb2wgPSB0aGlzLnVpLmdldENvbnRyb2woTkFNRVNbaWRdKTtcclxuXHJcbiAgICAgICAgICAgIGlmICghTkFNRVMuaGFzT3duUHJvcGVydHkoaWQpIHx8ICFjb250cm9sKVxyXG4gICAgICAgICAgICAgICAgY29udGludWU7XHJcblxyXG4gICAgICAgICAgICBjb250cm9sLnNldEFsaWdubWVudCh0aGlzLmFsaWdubWVudCk7XHJcbiAgICAgICAgfVxyXG4gICAgfVxyXG5cclxuICAgIGZ1bmN0aW9uIGlzVmFsaWRBbGlnbm1lbnQoYWxpZ25tZW50KSB7XHJcbiAgICAgICAgcmV0dXJuICEhKENPTlNUUy5DT05UUk9MUy5QT1NJVElPTlMuaW5kZXhPZihhbGlnbm1lbnQpICsgMSk7XHJcbiAgICB9XHJcblxyXG59OyIsIm1vZHVsZS5leHBvcnRzID0gZnVuY3Rpb24oKSB7XHJcbiAgICB2YXIgb3B0aW9ucyA9IHt9O1xyXG4gICAgdmFyIERFRkFVTFRfQVBJX1ZFUlNJT04gPSBcIjMuMFwiO1xyXG5cclxuICAgIHRoaXMuJGdldCA9IGZ1bmN0aW9uKCl7XHJcbiAgICAgICAgcmV0dXJuIHtcclxuICAgICAgICAgICAgYXBwX2lkOiBvcHRpb25zLmFwcF9pZCxcclxuICAgICAgICAgICAgYXBwX2NvZGU6IG9wdGlvbnMuYXBwX2NvZGUsXHJcbiAgICAgICAgICAgIGFwaVZlcnNpb246IG9wdGlvbnMuYXBpVmVyc2lvbiB8fCBERUZBVUxUX0FQSV9WRVJTSU9OLFxyXG4gICAgICAgICAgICB1c2VIVFRQUzogb3B0aW9ucy51c2VIVFRQUyxcclxuICAgICAgICAgICAgdXNlQ0lUOiAhIW9wdGlvbnMudXNlQ0lUXHJcbiAgICAgICAgfVxyXG4gICAgfTtcclxuXHJcbiAgICB0aGlzLnNldE9wdGlvbnMgPSBmdW5jdGlvbihvcHRzKXtcclxuICAgICAgICBvcHRpb25zID0gb3B0cztcclxuICAgIH07XHJcbn07IiwibW9kdWxlLmV4cG9ydHMgPSBmdW5jdGlvbiAoJHJvb3RTY29wZSwgJHRpbWVvdXQsIENPTlNUUykge1xyXG4gICAgcmV0dXJuIHtcclxuICAgICAgICB0aHJvdHRsZTogdGhyb3R0bGUsXHJcbiAgICAgICAgY3JlYXRlU2NyaXB0VGFnOiBjcmVhdGVTY3JpcHRUYWcsXHJcbiAgICAgICAgY3JlYXRlTGlua1RhZzogY3JlYXRlTGlua1RhZyxcclxuICAgICAgICBydW5TY29wZURpZ2VzdElmTmVlZDogcnVuU2NvcGVEaWdlc3RJZk5lZWQsXHJcbiAgICAgICAgaXNWYWxpZENvb3JkczogaXNWYWxpZENvb3JkcyxcclxuICAgICAgICBhZGRFdmVudExpc3RlbmVyOiBhZGRFdmVudExpc3RlbmVyLFxyXG4gICAgICAgIHpvb206IHpvb20sXHJcbiAgICAgICAgZ2VuZXJhdGVJZDogZ2VuZXJhdGVJZFxyXG4gICAgfTtcclxuXHJcbiAgICAvLyNyZWdpb24gUFVCTElDXHJcbiAgICBmdW5jdGlvbiB0aHJvdHRsZShmbiwgcGVyaW9kKSB7XHJcbiAgICAgICAgdmFyIHRpbWVvdXQgPSBudWxsO1xyXG5cclxuICAgICAgICByZXR1cm4gZnVuY3Rpb24gKCkge1xyXG4gICAgICAgICAgICBpZiAoJHRpbWVvdXQpXHJcbiAgICAgICAgICAgICAgICAkdGltZW91dC5jYW5jZWwodGltZW91dCk7XHJcblxyXG4gICAgICAgICAgICB0aW1lb3V0ID0gJHRpbWVvdXQoZm4sIHBlcmlvZCk7XHJcbiAgICAgICAgfVxyXG4gICAgfVxyXG5cclxuICAgIGZ1bmN0aW9uIGFkZEV2ZW50TGlzdGVuZXIob2JqLCBldmVudE5hbWUsIGxpc3RlbmVyLCB1c2VDYXB0dXJlKSB7XHJcbiAgICAgICAgdmFyIF91c2VDYXB0dXJlID0gISF1c2VDYXB0dXJlO1xyXG5cclxuICAgICAgICBvYmouYWRkRXZlbnRMaXN0ZW5lcihldmVudE5hbWUsIGxpc3RlbmVyLCBfdXNlQ2FwdHVyZSk7XHJcbiAgICB9XHJcblxyXG4gICAgZnVuY3Rpb24gcnVuU2NvcGVEaWdlc3RJZk5lZWQoc2NvcGUsIGNiKSB7XHJcbiAgICAgICAgaWYgKHNjb3BlLiRyb290ICYmIHNjb3BlLiRyb290LiQkcGhhc2UgIT09ICckYXBwbHknICYmIHNjb3BlLiRyb290LiQkcGhhc2UgIT09ICckZGlnZXN0Jykge1xyXG4gICAgICAgICAgICBzY29wZS4kZGlnZXN0KGNiIHx8IGFuZ3VsYXIubm9vcCk7XHJcbiAgICAgICAgICAgIHJldHVybiB0cnVlO1xyXG4gICAgICAgIH1cclxuICAgICAgICByZXR1cm4gZmFsc2U7XHJcbiAgICB9XHJcblxyXG4gICAgZnVuY3Rpb24gY3JlYXRlU2NyaXB0VGFnKGF0dHJzKSB7XHJcbiAgICAgICAgdmFyIHNjcmlwdCA9IGRvY3VtZW50LmdldEVsZW1lbnRCeUlkKGF0dHJzLnNyYyk7XHJcblxyXG4gICAgICAgIGlmIChzY3JpcHQpXHJcbiAgICAgICAgICAgIHJldHVybiBmYWxzZTtcclxuXHJcbiAgICAgICAgc2NyaXB0ID0gZG9jdW1lbnQuY3JlYXRlRWxlbWVudCgnc2NyaXB0Jyk7XHJcbiAgICAgICAgc2NyaXB0LnR5cGUgPSAndGV4dC9qYXZhc2NyaXB0JztcclxuICAgICAgICBzY3JpcHQuaWQgPSBhdHRycy5zcmM7XHJcbiAgICAgICAgX3NldEF0dHJzKHNjcmlwdCwgYXR0cnMpO1xyXG5cclxuICAgICAgICByZXR1cm4gc2NyaXB0O1xyXG4gICAgfVxyXG5cclxuICAgIGZ1bmN0aW9uIGNyZWF0ZUxpbmtUYWcoYXR0cnMpIHtcclxuICAgICAgICB2YXIgbGluayA9IGRvY3VtZW50LmdldEVsZW1lbnRCeUlkKGF0dHJzLmhyZWYpO1xyXG5cclxuICAgICAgICBpZiAobGluaylcclxuICAgICAgICAgICAgcmV0dXJuIGZhbHNlO1xyXG5cclxuICAgICAgICBsaW5rID0gZG9jdW1lbnQuY3JlYXRlRWxlbWVudCgnbGluaycpO1xyXG4gICAgICAgIGxpbmsuaWQgPSBhdHRycy5ocmVmO1xyXG4gICAgICAgIF9zZXRBdHRycyhsaW5rLCBhdHRycyk7XHJcblxyXG4gICAgICAgIHJldHVybiBsaW5rO1xyXG4gICAgfVxyXG5cclxuICAgIGZ1bmN0aW9uIGlzVmFsaWRDb29yZHMoY29vcmRzKSB7XHJcbiAgICAgICAgcmV0dXJuIGNvb3JkcyAmJlxyXG4gICAgICAgICAgICAodHlwZW9mIGNvb3Jkcy5sYXRpdHVkZSA9PT0gJ3N0cmluZycgfHwgdHlwZW9mIGNvb3Jkcy5sYXRpdHVkZSA9PT0gJ251bWJlcicpICYmXHJcbiAgICAgICAgICAgICh0eXBlb2YgY29vcmRzLmxvbmdpdHVkZSA9PT0gJ3N0cmluZycgfHwgdHlwZW9mIGNvb3Jkcy5sb25naXR1ZGUgPT09ICdudW1iZXInKVxyXG4gICAgfVxyXG5cclxuICAgIGZ1bmN0aW9uIHpvb20obWFwLCB2YWx1ZSwgc3RlcCkge1xyXG4gICAgICAgIHZhciBjdXJyZW50Wm9vbSA9IG1hcC5nZXRab29tKCksXHJcbiAgICAgICAgICAgIF9zdGVwID0gc3RlcCB8fCBDT05TVFMuQU5JTUFUSU9OX1pPT01fU1RFUCxcclxuICAgICAgICAgICAgZmFjdG9yID0gY3VycmVudFpvb20gPj0gdmFsdWUgPyAtMSA6IDEsXHJcbiAgICAgICAgICAgIGluY3JlbWVudCA9IHN0ZXAgKiBmYWN0b3I7XHJcblxyXG4gICAgICAgIHJldHVybiAoZnVuY3Rpb24gem9vbSgpIHtcclxuICAgICAgICAgICAgaWYgKCFzdGVwIHx8IE1hdGguZmxvb3IoY3VycmVudFpvb20pID09PSBNYXRoLmZsb29yKHZhbHVlKSkge1xyXG4gICAgICAgICAgICAgICAgbWFwLnNldFpvb20odmFsdWUpO1xyXG4gICAgICAgICAgICAgICAgcmV0dXJuO1xyXG4gICAgICAgICAgICB9XHJcblxyXG4gICAgICAgICAgICBjdXJyZW50Wm9vbSArPSBpbmNyZW1lbnQ7XHJcbiAgICAgICAgICAgIG1hcC5zZXRab29tKGN1cnJlbnRab29tKTtcclxuXHJcbiAgICAgICAgICAgIHJlcXVlc3RBbmltYXRpb25GcmFtZSh6b29tKTtcclxuICAgICAgICB9KSgpO1xyXG4gICAgfVxyXG5cclxuICAgIGZ1bmN0aW9uIGdlbmVyYXRlSWQoKSB7XHJcbiAgICAgICAgdmFyIG1hc2sgPSAneHh4eHh4eHgteHh4eC00eHh4LXl4eHgteHh4eHh4eHh4eHh4JyxcclxuICAgICAgICAgICAgcmVnZXhwID0gL1t4eV0vZyxcclxuICAgICAgICAgICAgZCA9IG5ldyBEYXRlKCkuZ2V0VGltZSgpLFxyXG4gICAgICAgICAgICB1dWlkID0gbWFzay5yZXBsYWNlKHJlZ2V4cCwgZnVuY3Rpb24gKGMpIHtcclxuICAgICAgICAgICAgICAgIHZhciByID0gKGQgKyBNYXRoLnJhbmRvbSgpICogMTYpICUgMTYgfCAwO1xyXG4gICAgICAgICAgICAgICAgZCA9IE1hdGguZmxvb3IoZCAvIDE2KTtcclxuICAgICAgICAgICAgcmV0dXJuIChjID09ICd4JyA/IHIgOiAociAmIDB4MyB8IDB4OCkpLnRvU3RyaW5nKDE2KTtcclxuICAgICAgICB9KTtcclxuICAgICAgICBcclxuICAgICAgICByZXR1cm4gdXVpZDtcclxuICAgIH1cclxuXHJcbiAgICAvLyNlbmRyZWdpb24gUFVCTElDIFxyXG5cclxuICAgIGZ1bmN0aW9uIF9zZXRBdHRycyhlbCwgYXR0cnMpIHtcclxuICAgICAgICBpZiAoIWVsIHx8ICFhdHRycylcclxuICAgICAgICAgICAgdGhyb3cgbmV3IEVycm9yKCdNaXNzZWQgYXR0cmlidXRlcycpO1xyXG5cclxuICAgICAgICBmb3IgKHZhciBrZXkgaW4gYXR0cnMpIHtcclxuICAgICAgICAgICAgaWYgKCFhdHRycy5oYXNPd25Qcm9wZXJ0eShrZXkpKVxyXG4gICAgICAgICAgICAgICAgY29udGludWU7XHJcblxyXG4gICAgICAgICAgICBlbFtrZXldID0gYXR0cnNba2V5XTtcclxuICAgICAgICB9XHJcbiAgICB9XHJcbn07IiwibW9kdWxlLmV4cG9ydHMgPSBmdW5jdGlvbihNYXJrZXJJbnRlcmZhY2Upe1xyXG4gICAgZnVuY3Rpb24gRGVmYXVsdE1hcmtlcihwbGFjZSl7XHJcbiAgICAgICAgdGhpcy5wbGFjZSA9IHBsYWNlO1xyXG4gICAgICAgIHRoaXMuc2V0Q29vcmRzKCk7XHJcbiAgICB9XHJcblxyXG4gICAgdmFyIHByb3RvID0gRGVmYXVsdE1hcmtlci5wcm90b3R5cGUgPSBuZXcgTWFya2VySW50ZXJmYWNlKCk7XHJcbiAgICBwcm90by5jb25zdHJ1Y3RvciA9IERlZmF1bHRNYXJrZXI7XHJcblxyXG4gICAgcHJvdG8uY3JlYXRlID0gY3JlYXRlO1xyXG5cclxuICAgIHJldHVybiBEZWZhdWx0TWFya2VyO1xyXG4gICAgXHJcbiAgICBmdW5jdGlvbiBjcmVhdGUoKXtcclxuICAgICAgICB2YXIgbWFya2VyID0gbmV3IEgubWFwLk1hcmtlcih0aGlzLmNvb3Jkcyk7XHJcbiAgICAgICAgXHJcbiAgICAgICAgdGhpcy5hZGRJbmZvQnViYmxlKG1hcmtlcik7XHJcbiAgICAgICAgXHJcbiAgICAgICAgcmV0dXJuIG1hcmtlcjtcclxuICAgIH1cclxufSIsIm1vZHVsZS5leHBvcnRzID0gZnVuY3Rpb24oTWFya2VySW50ZXJmYWNlKXtcclxuICAgIGZ1bmN0aW9uIERPTU1hcmtlcihwbGFjZSl7XHJcbiAgICAgICAgdGhpcy5wbGFjZSA9IHBsYWNlO1xyXG4gICAgICAgIHRoaXMuc2V0Q29vcmRzKCk7XHJcbiAgICB9XHJcblxyXG4gICAgdmFyIHByb3RvID0gRE9NTWFya2VyLnByb3RvdHlwZSA9IG5ldyBNYXJrZXJJbnRlcmZhY2UoKTtcclxuICAgIHByb3RvLmNvbnN0cnVjdG9yID0gRE9NTWFya2VyO1xyXG5cclxuICAgIHByb3RvLmNyZWF0ZSA9IGNyZWF0ZTtcclxuICAgIHByb3RvLmdldEljb24gPSBnZXRJY29uO1xyXG4gICAgcHJvdG8uc2V0dXBFdmVudHMgPSBzZXR1cEV2ZW50cztcclxuXHJcbiAgICByZXR1cm4gRE9NTWFya2VyO1xyXG4gICAgXHJcbiAgICBmdW5jdGlvbiBjcmVhdGUoKXtcclxuICAgICAgICB2YXIgbWFya2VyID0gbmV3IEgubWFwLkRvbU1hcmtlcih0aGlzLmNvb3Jkcywge1xyXG4gICAgICAgICAgICBpY29uOiB0aGlzLmdldEljb24oKVxyXG4gICAgICAgIH0pO1xyXG4gICAgICAgIFxyXG4gICAgICAgIHRoaXMuYWRkSW5mb0J1YmJsZShtYXJrZXIpO1xyXG4gICAgICAgIFxyXG4gICAgICAgIHJldHVybiBtYXJrZXI7XHJcbiAgICB9XHJcbiAgICBcclxuICAgIGZ1bmN0aW9uIGdldEljb24oKXtcclxuICAgICAgICB2YXIgaWNvbiA9IHRoaXMucGxhY2UubWFya3VwO1xyXG4gICAgICAgICBpZighaWNvbilcclxuICAgICAgICAgICAgdGhyb3cgbmV3IEVycm9yKCdtYXJrdXAgbWlzc2VkJyk7XHJcblxyXG4gICAgICAgIHJldHVybiBuZXcgSC5tYXAuRG9tSWNvbihpY29uKTtcclxuICAgIH1cclxuICAgIFxyXG4gICAgZnVuY3Rpb24gc2V0dXBFdmVudHMoZWwsIGV2ZW50cywgcmVtb3ZlKXtcclxuICAgICAgICB2YXIgbWV0aG9kID0gcmVtb3ZlID8gJ3JlbW92ZUV2ZW50TGlzdGVuZXInIDogJ2FkZEV2ZW50TGlzdGVuZXInO1xyXG5cclxuICAgICAgICBmb3IodmFyIGtleSBpbiBldmVudHMpIHtcclxuICAgICAgICAgICAgaWYoIWV2ZW50cy5oYXNPd25Qcm9wZXJ0eShrZXkpKVxyXG4gICAgICAgICAgICAgICAgY29udGludWU7XHJcblxyXG4gICAgICAgICAgICBlbFttZXRob2RdLmNhbGwobnVsbCwga2V5LCBldmVudHNba2V5XSk7XHJcbiAgICAgICAgfVxyXG4gICAgfVxyXG59IiwidmFyIG1hcmtlckludGVyZmFjZSA9IHJlcXVpcmUoJy4vbWFya2VyLmpzJyksXHJcblx0ZGVmYXVsdE1hcmtlciA9IHJlcXVpcmUoJy4vZGVmYXVsdC5tYXJrZXIuanMnKSxcclxuXHRkb21NYXJrZXIgPSByZXF1aXJlKCcuL2RvbS5tYXJrZXIuanMnKSxcclxuXHRzdmdNYXJrZXIgPSByZXF1aXJlKCcuL3N2Zy5tYXJrZXIuanMnKSxcclxuICAgIG1hcmtlcnNTZXJ2aWNlID0gcmVxdWlyZSgnLi9tYXJrZXJzLnNlcnZpY2UuanMnKTtcclxuXHJcbmFuZ3VsYXIubW9kdWxlKCdtYXJrZXItaW50ZXJmYWNlJywgW10pLmZhY3RvcnkoJ01hcmtlckludGVyZmFjZScsIG1hcmtlckludGVyZmFjZSk7XHJcbmFuZ3VsYXIubW9kdWxlKCdkZWZhdWx0LW1hcmtlcicsIFtdKS5mYWN0b3J5KCdEZWZhdWx0TWFya2VyJywgZGVmYXVsdE1hcmtlcik7XHJcbmFuZ3VsYXIubW9kdWxlKCdkb20tbWFya2VyJywgW10pLmZhY3RvcnkoJ0RPTU1hcmtlcicsIGRvbU1hcmtlcik7XHJcbmFuZ3VsYXIubW9kdWxlKCdzdmctbWFya2VyJywgW10pLmZhY3RvcnkoJ1NWR01hcmtlcicsIHN2Z01hcmtlcik7XHJcblxyXG5hbmd1bGFyLm1vZHVsZSgnbWFya2Vycy1zZXJ2aWNlJywgW10pLnNlcnZpY2UoJ01hcmtlcnNTZXJ2aWNlJywgbWFya2Vyc1NlcnZpY2UpO1xyXG5cclxudmFyIGFwcCA9IGFuZ3VsYXIubW9kdWxlKCdtYXJrZXJzLW1vZHVsZScsIFtcclxuXHQnbWFya2VyLWludGVyZmFjZScsXHJcbiAgICAnZGVmYXVsdC1tYXJrZXInLFxyXG4gICAgJ2RvbS1tYXJrZXInLFxyXG4gICAgJ21hcmtlcnMtc2VydmljZScsXHJcbiAgICAnc3ZnLW1hcmtlcidcclxuXSk7XHJcblxyXG5tb2R1bGUuZXhwb3J0cyA9IGFwcDsiLCJtb2R1bGUuZXhwb3J0cyA9IGZ1bmN0aW9uKCl7XHJcbiAgICBmdW5jdGlvbiBNYXJrZXJJbnRlcmZhY2UoKXtcclxuICAgICAgICB0aHJvdyBuZXcgRXJyb3IoJ0Fic3RyYWN0IGNsYXNzISBUaGUgSW5zdGFuY2Ugc2hvdWxkIGJlIGNyZWF0ZWQnKTtcclxuICAgIH1cclxuICAgIFxyXG4gICAgdmFyIHByb3RvID0gTWFya2VySW50ZXJmYWNlLnByb3RvdHlwZTtcclxuICAgIFxyXG4gICAgcHJvdG8uY3JlYXRlID0gY3JlYXRlO1xyXG4gICAgcHJvdG8uc2V0Q29vcmRzID0gc2V0Q29vcmRzO1xyXG4gICAgcHJvdG8uYWRkSW5mb0J1YmJsZSA9IGFkZEluZm9CdWJibGU7XHJcbiAgICBcclxuICAgIGZ1bmN0aW9uIE1hcmtlcigpe31cclxuICAgIFxyXG4gICAgTWFya2VyLnByb3RvdHlwZSA9IHByb3RvO1xyXG4gICAgXHJcbiAgICByZXR1cm4gTWFya2VyO1xyXG4gICAgXHJcbiAgICBmdW5jdGlvbiBjcmVhdGUoKXtcclxuICAgICAgICB0aHJvdyBuZXcgRXJyb3IoJ2NyZWF0ZTo6IG5vdCBpbXBsZW1lbnRlZCcpOyBcclxuICAgIH1cclxuICAgIFxyXG4gICAgZnVuY3Rpb24gc2V0Q29vcmRzKCl7XHJcbiAgICAgICAgIHRoaXMuY29vcmRzID0ge1xyXG4gICAgICAgICAgICBsYXQ6IHRoaXMucGxhY2UucG9zLmxhdCxcclxuICAgICAgICAgICAgbG5nOiB0aGlzLnBsYWNlLnBvcy5sbmdcclxuICAgICAgICB9XHJcbiAgICB9XHJcbiAgICBcclxuICAgIGZ1bmN0aW9uIGFkZEluZm9CdWJibGUobWFya2VyKXtcclxuICAgICAgICBpZighdGhpcy5wbGFjZS5wb3B1cClcclxuICAgICAgICAgICAgcmV0dXJuO1xyXG4gICAgICAgICAgICBcclxuICAgICAgICBtYXJrZXIuc2V0RGF0YSh0aGlzLnBsYWNlLnBvcHVwKVxyXG4gICAgfVxyXG59IiwibW9kdWxlLmV4cG9ydHMgPSBmdW5jdGlvbihEZWZhdWx0TWFya2VyLCBET01NYXJrZXIsIFNWR01hcmtlciwgQ09OU1RTKSB7XHJcblxyXG4gICAgdmFyIE1BUktFUl9UWVBFUyA9IENPTlNUUy5NQVJLRVJfVFlQRVM7XHJcblxyXG4gICAgcmV0dXJuIHtcclxuICAgICAgICBhZGRNYXJrZXJzVG9NYXA6IGFkZE1hcmtlcnNUb01hcCxcclxuICAgICAgICBhZGRVc2VyTWFya2VyOiBhZGRVc2VyTWFya2VyLFxyXG4gICAgICAgIHVwZGF0ZU1hcmtlcnM6IHVwZGF0ZU1hcmtlcnMsXHJcbiAgICAgICAgaXNNYXJrZXJJbnN0YW5jZTogaXNNYXJrZXJJbnN0YW5jZVxyXG4gICAgfVxyXG5cclxuICAgIGZ1bmN0aW9uIGlzTWFya2VySW5zdGFuY2UodGFyZ2V0KSB7XHJcbiAgICAgICAgcmV0dXJuIHRhcmdldCBpbnN0YW5jZW9mIEgubWFwLk1hcmtlciB8fCB0YXJnZXQgaW5zdGFuY2VvZiBILm1hcC5Eb21NYXJrZXI7XHJcbiAgICB9XHJcblxyXG4gICAgZnVuY3Rpb24gYWRkVXNlck1hcmtlcihtYXAsIHBsYWNlKSB7XHJcbiAgICAgICAgaWYobWFwLnVzZXJNYXJrZXIpXHJcbiAgICAgICAgICAgIHJldHVybiBtYXAudXNlck1hcmtlcjtcclxuICAgICAgICBcclxuICAgICAgICBwbGFjZS5tYXJrdXAgPSAnPHN2ZyB3aWR0aD1cIjM1cHhcIiBoZWlnaHQ9XCIzNXB4XCIgdmlld0JveD1cIjAgMCA5MCA5MFwiIHZlcnNpb249XCIxLjFcIiB4bWxucz1cImh0dHA6Ly93d3cudzMub3JnLzIwMDAvc3ZnXCIgeG1sbnM6eGxpbms9XCJodHRwOi8vd3d3LnczLm9yZy8xOTk5L3hsaW5rXCI+JyArXHJcbiAgICAgICAgICAgICc8ZGVmcz48Y2lyY2xlIGlkPVwicGF0aC0xXCIgY3g9XCIzMDJcIiBjeT1cIjgwMlwiIHI9XCIxNVwiPjwvY2lyY2xlPicgK1xyXG4gICAgICAgICAgICAnPG1hc2sgaWQ9XCJtYXNrLTJcIiBtYXNrQ29udGVudFVuaXRzPVwidXNlclNwYWNlT25Vc2VcIiBtYXNrVW5pdHM9XCJvYmplY3RCb3VuZGluZ0JveFwiIHg9XCItMzBcIiB5PVwiLTMwXCIgd2lkdGg9XCI5MFwiIGhlaWdodD1cIjkwXCI+JyArXHJcbiAgICAgICAgICAgICc8cmVjdCB4PVwiMjU3XCIgeT1cIjc1N1wiIHdpZHRoPVwiOTBcIiBoZWlnaHQ9XCI5MFwiIGZpbGw9XCJ3aGl0ZVwiPjwvcmVjdD48dXNlIHhsaW5rOmhyZWY9XCIjcGF0aC0xXCIgZmlsbD1cImJsYWNrXCI+PC91c2U+JyArXHJcbiAgICAgICAgICAgICc8L21hc2s+PC9kZWZzPjxnIGlkPVwiUGFnZS0xXCIgc3Ryb2tlPVwibm9uZVwiIHN0cm9rZS13aWR0aD1cIjFcIiBmaWxsPVwibm9uZVwiIGZpbGwtcnVsZT1cImV2ZW5vZGRcIj4nICtcclxuICAgICAgICAgICAgJzxnIGlkPVwiU2VydmljZS1PcHRpb25zLS0tZGlyZWN0aW9ucy0tLW1hcFwiIHRyYW5zZm9ybT1cInRyYW5zbGF0ZSgtMjU3LjAwMDAwMCwgLTc1Ny4wMDAwMDApXCI+PGcgaWQ9XCJPdmFsLTE1XCI+JyArXHJcbiAgICAgICAgICAgICc8dXNlIGZpbGw9XCIjRkZGRkZGXCIgZmlsbC1ydWxlPVwiZXZlbm9kZFwiIHhsaW5rOmhyZWY9XCIjcGF0aC0xXCI+PC91c2U+JyArXHJcbiAgICAgICAgICAgICc8dXNlIHN0cm9rZS1vcGFjaXR5PVwiMC4yOTYxMzkwNFwiIHN0cm9rZT1cIiMzRjM0QTBcIiBtYXNrPVwidXJsKCNtYXNrLTIpXCIgc3Ryb2tlLXdpZHRoPVwiNjBcIiB4bGluazpocmVmPVwiI3BhdGgtMVwiPjwvdXNlPicgK1xyXG4gICAgICAgICAgICAnPHVzZSBzdHJva2U9XCIjM0YzNEEwXCIgc3Ryb2tlLXdpZHRoPVwiNVwiIHhsaW5rOmhyZWY9XCIjcGF0aC0xXCI+PC91c2U+PC9nPjwvZz48L2c+PC9zdmc+JztcclxuXHJcbiAgICAgICAgbWFwLnVzZXJNYXJrZXIgPSBuZXcgU1ZHTWFya2VyKHBsYWNlKS5jcmVhdGUoKTtcclxuXHJcbiAgICAgICAgbWFwLmFkZE9iamVjdChtYXAudXNlck1hcmtlcik7XHJcblxyXG4gICAgICAgIHJldHVybiBtYXAudXNlck1hcmtlcjtcclxuICAgIH1cclxuXHJcbiAgICBmdW5jdGlvbiBhZGRNYXJrZXJzVG9NYXAobWFwLCBwbGFjZXMpIHtcclxuICAgICAgICBpZiAoIXBsYWNlcyB8fCAhcGxhY2VzLmxlbmd0aClcclxuICAgICAgICAgICAgcmV0dXJuO1xyXG5cclxuICAgICAgICBpZiAoIShtYXAgaW5zdGFuY2VvZiBILk1hcCkpXHJcbiAgICAgICAgICAgIHRocm93IG5ldyBFcnJvcignVW5zdXBwb3J0ZWQgbWFwIGluc3RhbmNlJyk7XHJcblxyXG4gICAgICAgIGlmICghbWFwLm1hcmtlcnNHcm91cClcclxuICAgICAgICAgICAgbWFwLm1hcmtlcnNHcm91cCA9IG5ldyBILm1hcC5Hcm91cCgpO1xyXG5cclxuICAgICAgICBwbGFjZXMuZm9yRWFjaChmdW5jdGlvbihwbGFjZSwgaSkge1xyXG4gICAgICAgICAgICB2YXIgY3JlYXRvciA9IF9nZXRNYXJrZXJDcmVhdG9yKHBsYWNlKSxcclxuICAgICAgICAgICAgICAgIG1hcmtlciA9IHBsYWNlLmRyYWdnYWJsZSA/IF9kcmFnZ2FibGVNYXJrZXJNaXhpbihjcmVhdG9yLmNyZWF0ZSgpKSA6IGNyZWF0b3IuY3JlYXRlKCk7XHJcblxyXG4gICAgICAgICAgICBtYXAubWFya2Vyc0dyb3VwLmFkZE9iamVjdChtYXJrZXIpO1xyXG4gICAgICAgIH0pO1xyXG5cclxuICAgICAgICBtYXAuYWRkT2JqZWN0KG1hcC5tYXJrZXJzR3JvdXApO1xyXG4gICAgICAgIFxyXG4gICAgICAgIG1hcC5zZXRWaWV3Qm91bmRzKG1hcC5tYXJrZXJzR3JvdXAuZ2V0Qm91bmRzKCkpO1xyXG4gICAgfVxyXG5cclxuICAgIGZ1bmN0aW9uIHVwZGF0ZU1hcmtlcnMobWFwLCBwbGFjZXMpIHtcclxuICAgICAgICBpZiAobWFwLm1hcmtlcnNHcm91cCkge1xyXG4gICAgICAgICAgICBtYXAubWFya2Vyc0dyb3VwLnJlbW92ZUFsbCgpO1xyXG4gICAgICAgICAgICBtYXAucmVtb3ZlT2JqZWN0KG1hcC5tYXJrZXJzR3JvdXApO1xyXG4gICAgICAgICAgICBtYXAubWFya2Vyc0dyb3VwID0gbnVsbDtcclxuICAgICAgICB9XHJcblxyXG4gICAgICAgIGFkZE1hcmtlcnNUb01hcC5hcHBseShudWxsLCBhcmd1bWVudHMpO1xyXG4gICAgfVxyXG5cclxuICAgIGZ1bmN0aW9uIF9nZXRNYXJrZXJDcmVhdG9yKHBsYWNlKSB7XHJcbiAgICAgICAgdmFyIENvbmNyZXRlTWFya2VyLFxyXG4gICAgICAgICAgICB0eXBlID0gcGxhY2UudHlwZSA/IHBsYWNlLnR5cGUudG9VcHBlckNhc2UoKSA6IG51bGw7XHJcblxyXG4gICAgICAgIHN3aXRjaCAodHlwZSkge1xyXG4gICAgICAgICAgICBjYXNlIE1BUktFUl9UWVBFUy5ET006XHJcbiAgICAgICAgICAgICAgICBDb25jcmV0ZU1hcmtlciA9IERPTU1hcmtlcjtcclxuICAgICAgICAgICAgICAgIGJyZWFrO1xyXG4gICAgICAgICAgICBjYXNlIE1BUktFUl9UWVBFUy5TVkc6XHJcbiAgICAgICAgICAgICAgICBDb25jcmV0ZU1hcmtlciA9IFNWR01hcmtlcjtcclxuICAgICAgICAgICAgICAgIGJyZWFrO1xyXG4gICAgICAgICAgICBkZWZhdWx0OlxyXG4gICAgICAgICAgICAgICAgQ29uY3JldGVNYXJrZXIgPSBEZWZhdWx0TWFya2VyO1xyXG4gICAgICAgIH1cclxuXHJcbiAgICAgICAgcmV0dXJuIG5ldyBDb25jcmV0ZU1hcmtlcihwbGFjZSk7XHJcbiAgICB9XHJcblxyXG4gICAgZnVuY3Rpb24gX2RyYWdnYWJsZU1hcmtlck1peGluKG1hcmtlcikge1xyXG4gICAgICAgIG1hcmtlci5kcmFnZ2FibGUgPSB0cnVlO1xyXG5cclxuICAgICAgICByZXR1cm4gbWFya2VyO1xyXG4gICAgfVxyXG5cclxufTsiLCJtb2R1bGUuZXhwb3J0cyA9IGZ1bmN0aW9uKE1hcmtlckludGVyZmFjZSl7XHJcbiAgICBmdW5jdGlvbiBTVkdNYXJrZXIocGxhY2Upe1xyXG4gICAgICAgIHRoaXMucGxhY2UgPSBwbGFjZTtcclxuICAgICAgICB0aGlzLnNldENvb3JkcygpO1xyXG4gICAgfVxyXG4gICAgXHJcbiAgICB2YXIgcHJvdG8gPSBTVkdNYXJrZXIucHJvdG90eXBlID0gbmV3IE1hcmtlckludGVyZmFjZSgpO1xyXG4gICAgcHJvdG8uY29uc3RydWN0b3IgPSBTVkdNYXJrZXI7XHJcbiAgICBcclxuICAgIHByb3RvLmNyZWF0ZSA9IGNyZWF0ZTtcclxuICAgIHByb3RvLmdldEljb24gPSBnZXRJY29uO1xyXG4gICAgXHJcbiAgICByZXR1cm4gU1ZHTWFya2VyO1xyXG4gICAgXHJcbiAgICBmdW5jdGlvbiBjcmVhdGUoKXtcclxuICAgICAgICB2YXIgbWFya2VyID0gbmV3IEgubWFwLk1hcmtlcih0aGlzLmNvb3Jkcywge1xyXG4gICAgICAgICAgICBpY29uOiB0aGlzLmdldEljb24oKSxcclxuICAgICAgICB9KTtcclxuICAgICAgICBcclxuICAgICAgICB0aGlzLmFkZEluZm9CdWJibGUobWFya2VyKTtcclxuICAgICAgICBcclxuICAgICAgICByZXR1cm4gbWFya2VyO1xyXG4gICAgfVxyXG4gICAgXHJcbiAgICBmdW5jdGlvbiBnZXRJY29uKCl7XHJcbiAgICAgICAgdmFyIGljb24gPSB0aGlzLnBsYWNlLm1hcmt1cDtcclxuICAgICAgICAgaWYoIWljb24pXHJcbiAgICAgICAgICAgIHRocm93IG5ldyBFcnJvcignbWFya3VwIG1pc3NlZCcpO1xyXG5cclxuICAgICAgICByZXR1cm4gbmV3IEgubWFwLkljb24oaWNvbik7XHJcbiAgICB9XHJcbn0iLCJ2YXIgcm91dGVzU2VydmljZSA9IHJlcXVpcmUoJy4vcm91dGVzLnNlcnZpY2UuanMnKTtcclxuXHJcbmFuZ3VsYXIubW9kdWxlKCdyb3V0ZXMtc2VydmljZScsIFtdKS5zZXJ2aWNlKCdSb3V0ZXNTZXJ2aWNlJywgcm91dGVzU2VydmljZSk7XHJcblxyXG52YXIgYXBwID0gYW5ndWxhci5tb2R1bGUoJ3JvdXRlcy1tb2R1bGUnLCBbXHJcbiAgICAncm91dGVzLXNlcnZpY2UnXHJcbl0pO1xyXG5cclxubW9kdWxlLmV4cG9ydHMgPSBhcHA7IiwibW9kdWxlLmV4cG9ydHMgPSBmdW5jdGlvbiAoJHEpIHtcclxuICAgIHJldHVybiB7XHJcbiAgICAgICAgY2FsY3VsYXRlUm91dGU6IGNhbGN1bGF0ZVJvdXRlLFxyXG4gICAgICAgIGFkZFJvdXRlVG9NYXA6IGFkZFJvdXRlVG9NYXAsXHJcbiAgICAgICAgY2xlYW5Sb3V0ZXM6IGNsZWFuUm91dGVzXHJcbiAgICB9XHJcblxyXG4gICAgZnVuY3Rpb24gY2FsY3VsYXRlUm91dGUoaGVyZW1hcHMsIGNvbmZpZykge1xyXG4gICAgICAgIHZhciBwbGF0Zm9ybSA9IGhlcmVtYXBzLnBsYXRmb3JtLFxyXG4gICAgICAgICAgICBtYXAgPSBoZXJlbWFwcy5tYXAsXHJcbiAgICAgICAgICAgIHJvdXRlciA9IHBsYXRmb3JtLmdldFJvdXRpbmdTZXJ2aWNlKCksXHJcbiAgICAgICAgICAgIGRpciA9IGNvbmZpZy5kaXJlY3Rpb247XHJcblxyXG4gICAgICAgIHZhciBtb2RlID0gJ3t7TU9ERX19O3t7VkVDSElMRX19J1xyXG4gICAgICAgICAgICAucmVwbGFjZSgve3tNT0RFfX0vLCBkaXIubW9kZSlcclxuICAgICAgICAgICAgLnJlcGxhY2UoL3t7VkVDSElMRX19LywgY29uZmlnLmRyaXZlVHlwZSk7XHJcblxyXG4gICAgICAgIHZhciByb3V0ZVJlcXVlc3RQYXJhbXMgPSB7XHJcbiAgICAgICAgICAgIG1vZGU6IG1vZGUsXHJcbiAgICAgICAgICAgIHJlcHJlc2VudGF0aW9uOiBkaXIucmVwcmVzZW50YXRpb24gfHwgJ2Rpc3BsYXknLFxyXG4gICAgICAgICAgICB3YXlwb2ludDA6IFtkaXIuZnJvbS5sYXQsIGRpci5mcm9tLmxuZ10uam9pbignLCcpLFxyXG4gICAgICAgICAgICB3YXlwb2ludDE6IFtkaXIudG8ubGF0LCBkaXIudG8ubG5nXS5qb2luKCcsJyksXHJcbiAgICAgICAgICAgIGxhbmd1YWdlOiBkaXIubGFuZ3VhZ2UgfHwgJ2VuLWdiJ1xyXG4gICAgICAgIH07XHJcblxyXG4gICAgICAgIF9zZXRBdHRyaWJ1dGVzKHJvdXRlUmVxdWVzdFBhcmFtcywgZGlyLmF0dHJzKTtcclxuXHJcbiAgICAgICAgdmFyIGRlZmVycmVkID0gJHEuZGVmZXIoKTtcclxuXHJcbiAgICAgICAgcm91dGVyLmNhbGN1bGF0ZVJvdXRlKHJvdXRlUmVxdWVzdFBhcmFtcywgZnVuY3Rpb24gKHJlc3VsdCkge1xyXG4gICAgICAgICAgICBkZWZlcnJlZC5yZXNvbHZlKHJlc3VsdCk7XHJcbiAgICAgICAgfSwgZnVuY3Rpb24gKGVycm9yKSB7XHJcbiAgICAgICAgICAgIGRlZmVycmVkLnJlamVjdChlcnJvcik7XHJcbiAgICAgICAgfSk7XHJcblxyXG4gICAgICAgIHJldHVybiBkZWZlcnJlZC5wcm9taXNlO1xyXG4gICAgfVxyXG4gICAgXHJcbiAgICBmdW5jdGlvbiBjbGVhblJvdXRlcyhtYXApe1xyXG4gICAgICAgIHZhciBncm91cCA9IG1hcC5yb3V0ZXNHcm91cDtcclxuICAgICAgICAgXHJcbiAgICAgICAgaWYoIWdyb3VwKVxyXG4gICAgICAgICAgICByZXR1cm47XHJcbiAgICAgICAgICAgIFxyXG4gICAgICAgIGdyb3VwLnJlbW92ZUFsbCgpO1xyXG4gICAgICAgIG1hcC5yZW1vdmVPYmplY3QoZ3JvdXApO1xyXG4gICAgICAgIG1hcC5yb3V0ZXNHcm91cCA9IG51bGw7XHJcbiAgICB9XHJcbiAgICBcclxuICAgIGZ1bmN0aW9uIGFkZFJvdXRlVG9NYXAobWFwLCByb3V0ZURhdGEsIGNsZWFuKSB7XHJcbiAgICAgICAgaWYoY2xlYW4pXHJcbiAgICAgICAgICAgY2xlYW5Sb3V0ZXMobWFwKTtcclxuICAgICAgICAgICBcclxuICAgICAgICB2YXIgcm91dGUgPSByb3V0ZURhdGEucm91dGU7XHJcbiAgICAgICAgXHJcbiAgICAgICAgaWYgKCFtYXAgfHwgIXJvdXRlIHx8ICFyb3V0ZS5zaGFwZSlcclxuICAgICAgICAgICAgcmV0dXJuO1xyXG5cclxuICAgICAgICB2YXIgc3RyaXAgPSBuZXcgSC5nZW8uU3RyaXAoKSwgcG9seWxpbmUgPSBudWxsO1xyXG5cclxuICAgICAgICByb3V0ZS5zaGFwZS5mb3JFYWNoKGZ1bmN0aW9uIChwb2ludCkge1xyXG4gICAgICAgICAgICB2YXIgcGFydHMgPSBwb2ludC5zcGxpdCgnLCcpO1xyXG4gICAgICAgICAgICBzdHJpcC5wdXNoTGF0TG5nQWx0KHBhcnRzWzBdLCBwYXJ0c1sxXSk7XHJcbiAgICAgICAgfSk7XHJcbiAgICAgICAgXHJcbiAgICAgICAgdmFyIHN0eWxlID0gcm91dGVEYXRhLnN0eWxlO1xyXG5cclxuICAgICAgICBwb2x5bGluZSA9IG5ldyBILm1hcC5Qb2x5bGluZShzdHJpcCwge1xyXG4gICAgICAgICAgICBzdHlsZToge1xyXG4gICAgICAgICAgICAgICAgbGluZVdpZHRoOiBzdHlsZS5saW5lV2lkdGggfHwgNCxcclxuICAgICAgICAgICAgICAgIHN0cm9rZUNvbG9yOiBzdHlsZS4gY29sb3IgfHwgJ3JnYmEoMCwgMTI4LCAyNTUsIDAuNyknXHJcbiAgICAgICAgICAgIH1cclxuICAgICAgICB9KTtcclxuICAgICAgICBcclxuICAgICAgICB2YXIgZ3JvdXAgPSBtYXAucm91dGVzR3JvdXA7XHJcbiAgICAgICAgIFxyXG4gICAgICAgIGlmKCFncm91cCkge1xyXG4gICAgICAgICAgICBncm91cCA9IG1hcC5yb3V0ZXNHcm91cCA9IG5ldyBILm1hcC5Hcm91cCgpO1xyXG4gICAgICAgICAgICBtYXAuYWRkT2JqZWN0KGdyb3VwKTtcclxuICAgICAgICB9XHJcbiAgICAgICAgXHJcbiAgICAgICAgZ3JvdXAuYWRkT2JqZWN0KHBvbHlsaW5lKTtcclxuICAgICAgICBcclxuICAgICAgICBtYXAuc2V0Vmlld0JvdW5kcyhwb2x5bGluZS5nZXRCb3VuZHMoKSwgdHJ1ZSk7XHJcbiAgICB9XHJcblxyXG4gICAgLy8jcmVnaW9uIFBSSVZBVEVcclxuXHJcbiAgICBmdW5jdGlvbiBfc2V0QXR0cmlidXRlcyhwYXJhbXMsIGF0dHJzKSB7XHJcbiAgICAgICAgdmFyIF9rZXkgPSAnYXR0cmlidXRlcyc7XHJcbiAgICAgICAgZm9yICh2YXIga2V5IGluIGF0dHJzKSB7XHJcbiAgICAgICAgICAgIGlmICghYXR0cnMuaGFzT3duUHJvcGVydHkoa2V5KSlcclxuICAgICAgICAgICAgICAgIGNvbnRpbnVlO1xyXG5cclxuICAgICAgICAgICAgcGFyYW1zW2tleSArIF9rZXldID0gYXR0cnNba2V5XTtcclxuICAgICAgICB9XHJcbiAgICB9XHJcblxyXG4gICAgZnVuY3Rpb24gX29uUm91dGVTdWNjZXNzKHJlc3VsdCkge1xyXG4gICAgICAgIGNvbnNvbGUubG9nKHJlc3VsdClcclxuICAgIH1cclxuXHJcbiAgICBmdW5jdGlvbiBfb25Sb3V0ZUZhaWx1cmUoZXJyb3IpIHtcclxuICAgICAgICBjb25zb2xlLmxvZygnQ2FsY3VsYXRlIHJvdXRlIGZhaWx1cmUnLCBlcnJvcik7XHJcbiAgICB9XHJcblxyXG4gICAgLyoqXHJcbiAgICAgKiBDcmVhdGVzIGEgc2VyaWVzIG9mIEgubWFwLk1hcmtlciBwb2ludHMgZnJvbSB0aGUgcm91dGUgYW5kIGFkZHMgdGhlbSB0byB0aGUgbWFwLlxyXG4gICAgICogQHBhcmFtIHtPYmplY3R9IHJvdXRlICBBIHJvdXRlIGFzIHJlY2VpdmVkIGZyb20gdGhlIEguc2VydmljZS5Sb3V0aW5nU2VydmljZVxyXG4gICAgICovXHJcbiAgICBmdW5jdGlvbiBhZGRNYW51ZXZlcnNUb01hcChtYXAsIHJvdXRlKSB7XHJcbiAgICAgICAgdmFyIHN2Z01hcmt1cCA9ICc8c3ZnIHdpZHRoPVwiMThcIiBoZWlnaHQ9XCIxOFwiICcgK1xyXG4gICAgICAgICAgICAneG1sbnM9XCJodHRwOi8vd3d3LnczLm9yZy8yMDAwL3N2Z1wiPicgK1xyXG4gICAgICAgICAgICAnPGNpcmNsZSBjeD1cIjhcIiBjeT1cIjhcIiByPVwiOFwiICcgK1xyXG4gICAgICAgICAgICAnZmlsbD1cIiMxYjQ2OGRcIiBzdHJva2U9XCJ3aGl0ZVwiIHN0cm9rZS13aWR0aD1cIjFcIiAgLz4nICtcclxuICAgICAgICAgICAgJzwvc3ZnPicsXHJcbiAgICAgICAgICAgIGRvdEljb24gPSBuZXcgSC5tYXAuSWNvbihzdmdNYXJrdXAsIHsgYW5jaG9yOiB7IHg6IDgsIHk6IDggfSB9KSxcclxuICAgICAgICAgICAgZ3JvdXAgPSBuZXcgSC5tYXAuR3JvdXAoKSxcclxuICAgICAgICAgICAgaSxcclxuICAgICAgICAgICAgajtcclxuXHJcbiAgICAgICAgLy8gQWRkIGEgbWFya2VyIGZvciBlYWNoIG1hbmV1dmVyXHJcbiAgICAgICAgZm9yIChpID0gMDsgaSA8IHJvdXRlLmxlZy5sZW5ndGg7IGkgKz0gMSkge1xyXG4gICAgICAgICAgICBmb3IgKGogPSAwOyBqIDwgcm91dGUubGVnW2ldLm1hbmV1dmVyLmxlbmd0aDsgaiArPSAxKSB7XHJcbiAgICAgICAgICAgICAgICAvLyBHZXQgdGhlIG5leHQgbWFuZXV2ZXIuXHJcbiAgICAgICAgICAgICAgICBtYW5ldXZlciA9IHJvdXRlLmxlZ1tpXS5tYW5ldXZlcltqXTtcclxuICAgICAgICAgICAgICAgIC8vIEFkZCBhIG1hcmtlciB0byB0aGUgbWFuZXV2ZXJzIGdyb3VwXHJcbiAgICAgICAgICAgICAgICB2YXIgbWFya2VyID0gbmV3IEgubWFwLk1hcmtlcih7XHJcbiAgICAgICAgICAgICAgICAgICAgbGF0OiBtYW5ldXZlci5wb3NpdGlvbi5sYXRpdHVkZSxcclxuICAgICAgICAgICAgICAgICAgICBsbmc6IG1hbmV1dmVyLnBvc2l0aW9uLmxvbmdpdHVkZVxyXG4gICAgICAgICAgICAgICAgfSxcclxuICAgICAgICAgICAgICAgICAgICB7IGljb246IGRvdEljb24gfVxyXG4gICAgICAgICAgICAgICAgKTtcclxuXHJcbiAgICAgICAgICAgICAgICBtYXJrZXIuaW5zdHJ1Y3Rpb24gPSBtYW5ldXZlci5pbnN0cnVjdGlvbjtcclxuICAgICAgICAgICAgICAgIGdyb3VwLmFkZE9iamVjdChtYXJrZXIpO1xyXG4gICAgICAgICAgICB9XHJcbiAgICAgICAgfVxyXG5cclxuICAgICAgICBncm91cC5hZGRFdmVudExpc3RlbmVyKCd0YXAnLCBmdW5jdGlvbiAoZXZ0KSB7XHJcbiAgICAgICAgICAgIG1hcC5zZXRDZW50ZXIoZXZ0LnRhcmdldC5nZXRQb3NpdGlvbigpKTtcclxuICAgICAgICAgICAgb3BlbkJ1YmJsZShldnQudGFyZ2V0LmdldFBvc2l0aW9uKCksIGV2dC50YXJnZXQuaW5zdHJ1Y3Rpb24pO1xyXG4gICAgICAgIH0sIGZhbHNlKTtcclxuXHJcbiAgICAgICAgLy8gQWRkIHRoZSBtYW5ldXZlcnMgZ3JvdXAgdG8gdGhlIG1hcFxyXG4gICAgICAgIG1hcC5hZGRPYmplY3QoZ3JvdXApO1xyXG4gICAgfVxyXG5cclxuXHJcbiAgICAvKipcclxuICAgICAqIENyZWF0ZXMgYSBzZXJpZXMgb2YgSC5tYXAuTWFya2VyIHBvaW50cyBmcm9tIHRoZSByb3V0ZSBhbmQgYWRkcyB0aGVtIHRvIHRoZSBtYXAuXHJcbiAgICAgKiBAcGFyYW0ge09iamVjdH0gcm91dGUgIEEgcm91dGUgYXMgcmVjZWl2ZWQgZnJvbSB0aGUgSC5zZXJ2aWNlLlJvdXRpbmdTZXJ2aWNlXHJcbiAgICAgKi9cclxuICAgIGZ1bmN0aW9uIGFkZFdheXBvaW50c1RvUGFuZWwod2F5cG9pbnRzKSB7XHJcbiAgICAgICAgdmFyIG5vZGVIMyA9IGRvY3VtZW50LmNyZWF0ZUVsZW1lbnQoJ2gzJyksXHJcbiAgICAgICAgICAgIHdheXBvaW50TGFiZWxzID0gW10sXHJcbiAgICAgICAgICAgIGk7XHJcblxyXG4gICAgICAgIGZvciAoaSA9IDA7IGkgPCB3YXlwb2ludHMubGVuZ3RoOyBpICs9IDEpIHtcclxuICAgICAgICAgICAgd2F5cG9pbnRMYWJlbHMucHVzaCh3YXlwb2ludHNbaV0ubGFiZWwpXHJcbiAgICAgICAgfVxyXG5cclxuICAgICAgICBub2RlSDMudGV4dENvbnRlbnQgPSB3YXlwb2ludExhYmVscy5qb2luKCcgLSAnKTtcclxuXHJcbiAgICAgICAgcm91dGVJbnN0cnVjdGlvbnNDb250YWluZXIuaW5uZXJIVE1MID0gJyc7XHJcbiAgICAgICAgcm91dGVJbnN0cnVjdGlvbnNDb250YWluZXIuYXBwZW5kQ2hpbGQobm9kZUgzKTtcclxuICAgIH1cclxuXHJcbiAgICAvKipcclxuICAgICAqIENyZWF0ZXMgYSBzZXJpZXMgb2YgSC5tYXAuTWFya2VyIHBvaW50cyBmcm9tIHRoZSByb3V0ZSBhbmQgYWRkcyB0aGVtIHRvIHRoZSBtYXAuXHJcbiAgICAgKiBAcGFyYW0ge09iamVjdH0gcm91dGUgIEEgcm91dGUgYXMgcmVjZWl2ZWQgZnJvbSB0aGUgSC5zZXJ2aWNlLlJvdXRpbmdTZXJ2aWNlXHJcbiAgICAgKi9cclxuICAgIGZ1bmN0aW9uIGFkZFN1bW1hcnlUb1BhbmVsKHN1bW1hcnkpIHtcclxuICAgICAgICB2YXIgc3VtbWFyeURpdiA9IGRvY3VtZW50LmNyZWF0ZUVsZW1lbnQoJ2RpdicpLFxyXG4gICAgICAgICAgICBjb250ZW50ID0gJyc7XHJcblxyXG4gICAgICAgIGNvbnRlbnQgKz0gJzxiPlRvdGFsIGRpc3RhbmNlPC9iPjogJyArIHN1bW1hcnkuZGlzdGFuY2UgKyAnbS4gPGJyLz4nO1xyXG4gICAgICAgIGNvbnRlbnQgKz0gJzxiPlRyYXZlbCBUaW1lPC9iPjogJyArIHN1bW1hcnkudHJhdmVsVGltZS50b01NU1MoKSArICcgKGluIGN1cnJlbnQgdHJhZmZpYyknO1xyXG5cclxuXHJcbiAgICAgICAgc3VtbWFyeURpdi5zdHlsZS5mb250U2l6ZSA9ICdzbWFsbCc7XHJcbiAgICAgICAgc3VtbWFyeURpdi5zdHlsZS5tYXJnaW5MZWZ0ID0gJzUlJztcclxuICAgICAgICBzdW1tYXJ5RGl2LnN0eWxlLm1hcmdpblJpZ2h0ID0gJzUlJztcclxuICAgICAgICBzdW1tYXJ5RGl2LmlubmVySFRNTCA9IGNvbnRlbnQ7XHJcbiAgICAgICAgcm91dGVJbnN0cnVjdGlvbnNDb250YWluZXIuYXBwZW5kQ2hpbGQoc3VtbWFyeURpdik7XHJcbiAgICB9XHJcblxyXG4gICAgLyoqXHJcbiAgICAgKiBDcmVhdGVzIGEgc2VyaWVzIG9mIEgubWFwLk1hcmtlciBwb2ludHMgZnJvbSB0aGUgcm91dGUgYW5kIGFkZHMgdGhlbSB0byB0aGUgbWFwLlxyXG4gICAgICogQHBhcmFtIHtPYmplY3R9IHJvdXRlICBBIHJvdXRlIGFzIHJlY2VpdmVkIGZyb20gdGhlIEguc2VydmljZS5Sb3V0aW5nU2VydmljZVxyXG4gICAgICovXHJcbiAgICBmdW5jdGlvbiBhZGRNYW51ZXZlcnNUb1BhbmVsKHJvdXRlKSB7XHJcbiAgICAgICAgdmFyIG5vZGVPTCA9IGRvY3VtZW50LmNyZWF0ZUVsZW1lbnQoJ29sJyksIGksIGo7XHJcblxyXG4gICAgICAgIG5vZGVPTC5zdHlsZS5mb250U2l6ZSA9ICdzbWFsbCc7XHJcbiAgICAgICAgbm9kZU9MLnN0eWxlLm1hcmdpbkxlZnQgPSAnNSUnO1xyXG4gICAgICAgIG5vZGVPTC5zdHlsZS5tYXJnaW5SaWdodCA9ICc1JSc7XHJcbiAgICAgICAgbm9kZU9MLmNsYXNzTmFtZSA9ICdkaXJlY3Rpb25zJztcclxuXHJcbiAgICAgICAgLy8gQWRkIGEgbWFya2VyIGZvciBlYWNoIG1hbmV1dmVyXHJcbiAgICAgICAgZm9yIChpID0gMDsgaSA8IHJvdXRlLmxlZy5sZW5ndGg7IGkgKz0gMSkge1xyXG4gICAgICAgICAgICBmb3IgKGogPSAwOyBqIDwgcm91dGUubGVnW2ldLm1hbmV1dmVyLmxlbmd0aDsgaiArPSAxKSB7XHJcbiAgICAgICAgICAgICAgICAvLyBHZXQgdGhlIG5leHQgbWFuZXV2ZXIuXHJcbiAgICAgICAgICAgICAgICBtYW5ldXZlciA9IHJvdXRlLmxlZ1tpXS5tYW5ldXZlcltqXTtcclxuXHJcbiAgICAgICAgICAgICAgICB2YXIgbGkgPSBkb2N1bWVudC5jcmVhdGVFbGVtZW50KCdsaScpLFxyXG4gICAgICAgICAgICAgICAgICAgIHNwYW5BcnJvdyA9IGRvY3VtZW50LmNyZWF0ZUVsZW1lbnQoJ3NwYW4nKSxcclxuICAgICAgICAgICAgICAgICAgICBzcGFuSW5zdHJ1Y3Rpb24gPSBkb2N1bWVudC5jcmVhdGVFbGVtZW50KCdzcGFuJyk7XHJcblxyXG4gICAgICAgICAgICAgICAgc3BhbkFycm93LmNsYXNzTmFtZSA9ICdhcnJvdyAnICsgbWFuZXV2ZXIuYWN0aW9uO1xyXG4gICAgICAgICAgICAgICAgc3Bhbkluc3RydWN0aW9uLmlubmVySFRNTCA9IG1hbmV1dmVyLmluc3RydWN0aW9uO1xyXG4gICAgICAgICAgICAgICAgbGkuYXBwZW5kQ2hpbGQoc3BhbkFycm93KTtcclxuICAgICAgICAgICAgICAgIGxpLmFwcGVuZENoaWxkKHNwYW5JbnN0cnVjdGlvbik7XHJcblxyXG4gICAgICAgICAgICAgICAgbm9kZU9MLmFwcGVuZENoaWxkKGxpKTtcclxuICAgICAgICAgICAgfVxyXG4gICAgICAgIH1cclxuXHJcbiAgICAgICAgcm91dGVJbnN0cnVjdGlvbnNDb250YWluZXIuYXBwZW5kQ2hpbGQobm9kZU9MKTtcclxuICAgIH1cclxuXHJcbn07Il19
