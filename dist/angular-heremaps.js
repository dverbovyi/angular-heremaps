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
    HereMapsAPIService,
    HereMapsUtilsService,
    HereMapsMarkerService,
    RoutesService,
    HereMapsCONSTS,
    HereMapsEventsFactory,
    HereMapsUiFactory) {
        
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
        var CONTROL_NAMES = HereMapsCONSTS.CONTROLS.NAMES,
            places = $scope.places(),
            opts = $scope.opts(),
            listeners = $scope.events();

        var options = angular.extend({}, HereMapsCONSTS.DEFAULT_MAP_OPTIONS, opts),
            position = HereMapsUtilsService.isValidCoords(options.coords) ? 
                        options.coords : HereMapsCONSTS.DEFAULT_MAP_OPTIONS.coords;

        var heremaps = { id: HereMapsUtilsService.generateId() },
            mapReady = $scope.onMapReady(),
            _onResizeMap = null;

        $timeout(function () {
            return _setMapSize();
        }).then(function () {
            HereMapsAPIService.loadApi().then(_apiReady);
        });

        options.resize && addOnResizeListener();

        $scope.$on('$destroy', function () {
            $window.removeEventListener('resize', _onResizeMap);
        });

        function addOnResizeListener() {
            _onResizeMap = HereMapsUtilsService.throttle(_resizeHandler, HereMapsCONSTS.UPDATE_MAP_RESIZE_TIMEOUT);
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

            return HereMapsAPIService.getPosition({
                enableHighAccuracy: _enableHighAccuracy,
                maximumAge: _maximumAge
            });
        }

        function _locationFailure() {
            console.error('Can not get a geo position');
        }

        function _setupMap() {
            _initMap(function () {
                HereMapsAPIService.loadModules($attrs.$attr, {
                    "controls": _uiModuleReady,
                    "events": _eventsModuleReady
                });
            });
        }

        function _initMap(cb) {
            var map = heremaps.map = new H.Map($element[0], heremaps.layers.normal.map, {
                zoom: HereMapsUtilsService.isValidCoords(position) ? options.zoom : options.maxZoom,
                center: new H.geo.Point(position.latitude, position.longitude)
            });

            HereMapsMarkerService.addMarkersToMap(map, places, true);

            mapReady && mapReady(MapProxy());

            cb && cb();
                
        }

        function _uiModuleReady() {
            HereMapsUiFactory.start({
                platform: heremaps,
                alignment: $attrs.controls
            });
        }

        function _eventsModuleReady() {
            HereMapsEventsFactory.start({
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
            
            HereMapsUtilsService.runScopeDigestIfNeed($scope);
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
                    HereMapsUtilsService.zoom(heremaps.map, zoom || 10, step);
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

                        HereMapsMarkerService.addUserMarker(heremaps.map, {
                            pos: {
                                lat: coords.latitude,
                                lng: coords.longitude
                            }
                        });

                        return coords;
                    })
                },
                geocodePosition: function (coords, options) {
                    return HereMapsAPIService.geocodePosition(heremaps.platform, {
                        coords: coords,
                        radius: options && options.radius,
                        lang: options && options.lang
                    });
                },
                updateMarkers: function (places, refreshViewbounds) {
                    HereMapsMarkerService.updateMarkers(heremaps.map, places, refreshViewbounds);
                }
            }
        }

    }
};

},{}],2:[function(require,module,exports){
require('./providers/markers');
require('./providers/map-modules');
require('./providers/routes');

module.exports = angular.module('heremaps', [
        'heremaps-markers-module',
        'heremaps-routes-module',
        'heremaps-map-modules'
    ])
    .provider('HereMapsConfig', require('./providers/mapconfig.provider'))
    .service('HereMapsUtilsService', require('./providers/maputils.service'))
    .service('HereMapsAPIService', [
        '$q', 
        '$http',
        'HereMapsConfig', 
        'HereMapsUtilsService', 
        'HereMapsCONSTS', require('./providers/api.service')])
    .constant('HereMapsCONSTS', require('./providers/consts'))
    .directive('heremaps', require('./heremaps.directive'));

},{"./heremaps.directive":1,"./providers/api.service":3,"./providers/consts":4,"./providers/map-modules":7,"./providers/mapconfig.provider":9,"./providers/maputils.service":10,"./providers/markers":13,"./providers/routes":17}],3:[function(require,module,exports){
module.exports = function ($q, $http, HereMapsConfig, HereMapsUtilsService, HereMapsCONSTS) {
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
            case HereMapsCONSTS.MODULES.UI:
                loader = _loadUIModule;
                break;
            case HereMapsCONSTS.MODULES.EVENTS:
                loader = _loadEventsModule;
                break;
            default:
                throw new Error('Unknown module', attr);
        }

        return loader;
    }

    function _loadUIModule() {
        if (!_isLoaded(CONFIG.UI.src)) {
            var link = HereMapsUtilsService.createLinkTag({
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
                script = HereMapsUtilsService.createScriptTag({ src: src });

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
            case CONFIG.UI.src:
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
module.exports = function(HereMapsUtilsService, HereMapsMarkerService, HereMapsCONSTS, HereMapsInfoBubbleFactory) {
    function Events(platform, Injector, listeners) {
        this.map = platform.map;
        this.listeners = listeners;
        this.inject = new Injector();
        this.events = platform.events = new H.mapevents.MapEvents(this.map);
        this.behavior = platform.behavior = new H.mapevents.Behavior(this.events);
        this.bubble = HereMapsInfoBubbleFactory.create();

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

        HereMapsUtilsService.addEventListener(this.map, 'tap', this.infoBubbleHandler.bind(this));

        HereMapsUtilsService.addEventListener(this.map, 'pointermove', this.infoBubbleHandler.bind(this));

        HereMapsUtilsService.addEventListener(this.map, 'dragstart', function(e) {
            if (HereMapsMarkerService.isMarkerInstance(e.target)) {
                self.behavior.disable();
            }

            self.triggerUserListener(HereMapsCONSTS.USER_EVENTS[e.type], e);
        });

        HereMapsUtilsService.addEventListener(this.map, 'drag', function(e) {
            var pointer = e.currentPointer,
                target = e.target;

            if (HereMapsMarkerService.isMarkerInstance(target)) {
                target.setPosition(self.map.screenToGeo(pointer.viewportX, pointer.viewportY));
            }

            self.triggerUserListener(HereMapsCONSTS.USER_EVENTS[e.type], e);
        });

        HereMapsUtilsService.addEventListener(this.map, 'dragend', function(e) {
            if (HereMapsMarkerService.isMarkerInstance(e.target)) {
                self.behavior.enable();
            }

            self.triggerUserListener(HereMapsCONSTS.USER_EVENTS[e.type], e);
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
            
        this.triggerUserListener(HereMapsCONSTS.USER_EVENTS[e.type], e);      
    }

};
},{}],6:[function(require,module,exports){
module.exports = function(HereMapsMarkerService, HereMapsUtilsService, HereMapsCONSTS) {
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
        if (HereMapsMarkerService.isMarkerInstance(e.target))
            this.show(e, ui);
        else
            this.close(e, ui);
    }

    function update(bubble, data) {
        bubble.display = data.display;

        bubble.setPosition(data.position);
        bubble.setContent(data.markup);

        bubble.setState(HereMapsCONSTS.INFOBUBBLE.STATE.OPEN);
    }

    function create(source) {
        var bubble = new H.ui.InfoBubble(source.position, {
            content: source.markup
        });

        bubble.display = source.display;
        bubble.addClass(HereMapsCONSTS.INFOBUBBLE.STATE.OPEN)

        HereMapsUtilsService.addEventListener(bubble, 'statechange', function(e) {
            var state = this.getState(),
                el = this.getElement();
            if (state === HereMapsCONSTS.INFOBUBBLE.STATE.CLOSED) {
                el.classList.remove(HereMapsCONSTS.INFOBUBBLE.STATE.OPEN);
            } else
                this.addClass(state)
        });

        return bubble;
    }

    function show(e, ui, data) {
        var target = e.target,
            data = target.getData(),
            el = null;

        if (!data || !data.display || !data.markup || data.display !== HereMapsCONSTS.INFOBUBBLE.DISPLAY_EVENT[e.type])
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
        if (!ui.bubble || ui.bubble.display !== HereMapsCONSTS.INFOBUBBLE.DISPLAY_EVENT[e.type]) {
            return;
        }

        ui.bubble.setState(HereMapsCONSTS.INFOBUBBLE.STATE.CLOSED);
    }
}
},{}],7:[function(require,module,exports){
angular.module('heremaps-events-module', [])
    .factory('HereMapsEventsFactory', require('./events/events.js'))
    .factory('HereMapsInfoBubbleFactory', require('./events/infobubble.js'));
    
angular.module('heremaps-ui-module', [])
    .factory('HereMapsUiFactory', require('./ui/ui.js'))

module.exports = angular.module('heremaps-map-modules', [
	'heremaps-events-module',
    'heremaps-ui-module'
]);
},{"./events/events.js":5,"./events/infobubble.js":6,"./ui/ui.js":8}],8:[function(require,module,exports){
module.exports = function(HereMapsAPIService, HereMapsMarkerService, HereMapsUtilsService, HereMapsCONSTS) {
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
        var NAMES = HereMapsCONSTS.CONTROLS.NAMES,
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

                HereMapsAPIService.getPosition().then(function(response) {
                    var position = {
                        lng: response.coords.longitude,
                        lat: response.coords.latitude
                    };
                    
                    self.map.setCenter(position);
                    
                    HereMapsUtilsService.zoom(self.map, 17, .08);

                    if (self.userMarker) {
                        self.userMarker.setPosition(position);
                        return;
                    }
                    
                    self.userMarker = HereMapsMarkerService.addUserMarker(self.map, {
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
        return !!(HereMapsCONSTS.CONTROLS.POSITIONS.indexOf(alignment) + 1);
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
module.exports = function ($rootScope, $timeout, HereMapsCONSTS) {
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
            _step = step || HereMapsCONSTS.ANIMATION_ZOOM_STEP,
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
module.exports = function(HereMapsMarkerInterface){
    function DefaultMarker(place){
        this.place = place;
        this.setCoords();
    }

    var proto = DefaultMarker.prototype = new HereMapsMarkerInterface();
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
module.exports = function(HereMapsMarkerInterface){
    function DOMMarker(place){
        this.place = place;
        this.setCoords();
    }

    var proto = DOMMarker.prototype = new HereMapsMarkerInterface();
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
module.exports = angular
    .module('heremaps-markers-module', [])
    .factory('HereMapsMarkerInterface', require('./marker.js'))
    .factory('HereMapsDefaultMarker', require('./default.marker.js'))
    .factory('HereMapsDOMMarker', require('./dom.marker.js'))
    .factory('HereMapsSVGMarker', require('./svg.marker.js'))
    .service('HereMapsMarkerService', require('./markers.service.js'));
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
module.exports = function(HereMapsDefaultMarker, HereMapsDOMMarker, HereMapsSVGMarker, HereMapsCONSTS) {

    var MARKER_TYPES = HereMapsCONSTS.MARKER_TYPES;

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

        map.userMarker = new HereMapsSVGMarker(place).create();

        map.addObject(map.userMarker);

        return map.userMarker;
    }

    function addMarkersToMap(map, places, refreshViewbounds) {
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

        if(refreshViewbounds){
          map.setViewBounds(map.markersGroup.getBounds());
        }
      }
    function updateMarkers(map, places, refreshViewbounds) {
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
                ConcreteMarker = HereMapsDOMMarker;
                break;
            case MARKER_TYPES.SVG:
                ConcreteMarker = HereMapsSVGMarker;
                break;
            default:
                ConcreteMarker = HereMapsDefaultMarker;
        }

        return new ConcreteMarker(place);
    }

    function _draggableMarkerMixin(marker) {
        marker.draggable = true;

        return marker;
    }

};

},{}],16:[function(require,module,exports){
module.exports = function(HereMapsMarkerInterface){
    function SVGMarker(place){
        this.place = place;
        this.setCoords();
    }
    
    var proto = SVGMarker.prototype = new HereMapsMarkerInterface();
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
module.exports = angular.module('heremaps-routes-module', [])
                    .service('RoutesService', require('./routes.service.js'));  
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
            dir = config.direction,
            waypoints = dir.waypoints;

        var mode = '{{MODE}};{{VECHILE}}'
            .replace(/{{MODE}}/, dir.mode)
            .replace(/{{VECHILE}}/, config.driveType);

        var routeRequestParams = {
            mode: mode,
            representation: dir.representation || 'display',
            language: dir.language || 'en-gb'
        };

        for(var no = 0; no < waypoints.length; no++){
          routeRequestParams["waypoint" + no] = [waypoints[no].lat, waypoints[no].lng].join(',');
        }

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
//# sourceMappingURL=data:application/json;charset=utf-8;base64,eyJ2ZXJzaW9uIjozLCJzb3VyY2VzIjpbIm5vZGVfbW9kdWxlcy9icm93c2VyaWZ5L25vZGVfbW9kdWxlcy9icm93c2VyLXBhY2svX3ByZWx1ZGUuanMiLCJzcmMvaGVyZW1hcHMuZGlyZWN0aXZlLmpzIiwic3JjL2luZGV4LmpzIiwic3JjL3Byb3ZpZGVycy9hcGkuc2VydmljZS5qcyIsInNyYy9wcm92aWRlcnMvY29uc3RzLmpzIiwic3JjL3Byb3ZpZGVycy9tYXAtbW9kdWxlcy9ldmVudHMvZXZlbnRzLmpzIiwic3JjL3Byb3ZpZGVycy9tYXAtbW9kdWxlcy9ldmVudHMvaW5mb2J1YmJsZS5qcyIsInNyYy9wcm92aWRlcnMvbWFwLW1vZHVsZXMvaW5kZXguanMiLCJzcmMvcHJvdmlkZXJzL21hcC1tb2R1bGVzL3VpL3VpLmpzIiwic3JjL3Byb3ZpZGVycy9tYXBjb25maWcucHJvdmlkZXIuanMiLCJzcmMvcHJvdmlkZXJzL21hcHV0aWxzLnNlcnZpY2UuanMiLCJzcmMvcHJvdmlkZXJzL21hcmtlcnMvZGVmYXVsdC5tYXJrZXIuanMiLCJzcmMvcHJvdmlkZXJzL21hcmtlcnMvZG9tLm1hcmtlci5qcyIsInNyYy9wcm92aWRlcnMvbWFya2Vycy9pbmRleC5qcyIsInNyYy9wcm92aWRlcnMvbWFya2Vycy9tYXJrZXIuanMiLCJzcmMvcHJvdmlkZXJzL21hcmtlcnMvbWFya2Vycy5zZXJ2aWNlLmpzIiwic3JjL3Byb3ZpZGVycy9tYXJrZXJzL3N2Zy5tYXJrZXIuanMiLCJzcmMvcHJvdmlkZXJzL3JvdXRlcy9pbmRleC5qcyIsInNyYy9wcm92aWRlcnMvcm91dGVzL3JvdXRlcy5zZXJ2aWNlLmpzIl0sIm5hbWVzIjpbXSwibWFwcGluZ3MiOiJBQUFBO0FDQUE7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTs7QUMzT0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTs7QUNuQkE7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBOztBQzVPQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7O0FDakVBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBOztBQzFGQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTs7QUNwRkE7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTs7QUNWQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7O0FDNUZBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTs7QUNqQkE7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBOztBQ3BIQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7O0FDcEJBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7O0FDM0NBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBOztBQ05BO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7O0FDbENBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7O0FDOUZBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7O0FDL0JBO0FBQ0E7O0FDREE7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0EiLCJmaWxlIjoiZ2VuZXJhdGVkLmpzIiwic291cmNlUm9vdCI6IiIsInNvdXJjZXNDb250ZW50IjpbIihmdW5jdGlvbiBlKHQsbixyKXtmdW5jdGlvbiBzKG8sdSl7aWYoIW5bb10pe2lmKCF0W29dKXt2YXIgYT10eXBlb2YgcmVxdWlyZT09XCJmdW5jdGlvblwiJiZyZXF1aXJlO2lmKCF1JiZhKXJldHVybiBhKG8sITApO2lmKGkpcmV0dXJuIGkobywhMCk7dmFyIGY9bmV3IEVycm9yKFwiQ2Fubm90IGZpbmQgbW9kdWxlICdcIitvK1wiJ1wiKTt0aHJvdyBmLmNvZGU9XCJNT0RVTEVfTk9UX0ZPVU5EXCIsZn12YXIgbD1uW29dPXtleHBvcnRzOnt9fTt0W29dWzBdLmNhbGwobC5leHBvcnRzLGZ1bmN0aW9uKGUpe3ZhciBuPXRbb11bMV1bZV07cmV0dXJuIHMobj9uOmUpfSxsLGwuZXhwb3J0cyxlLHQsbixyKX1yZXR1cm4gbltvXS5leHBvcnRzfXZhciBpPXR5cGVvZiByZXF1aXJlPT1cImZ1bmN0aW9uXCImJnJlcXVpcmU7Zm9yKHZhciBvPTA7bzxyLmxlbmd0aDtvKyspcyhyW29dKTtyZXR1cm4gc30pIiwiLyoqXHJcbiAqIENyZWF0ZWQgYnkgRG15dHJvIG9uIDQvMTEvMjAxNi5cclxuICovXHJcbm1vZHVsZS5leHBvcnRzID0gZnVuY3Rpb24gKFxyXG4gICAgJHRpbWVvdXQsXHJcbiAgICAkd2luZG93LFxyXG4gICAgJHJvb3RTY29wZSxcclxuICAgICRmaWx0ZXIsXHJcbiAgICBIZXJlTWFwc0NvbmZpZyxcclxuICAgIEhlcmVNYXBzQVBJU2VydmljZSxcclxuICAgIEhlcmVNYXBzVXRpbHNTZXJ2aWNlLFxyXG4gICAgSGVyZU1hcHNNYXJrZXJTZXJ2aWNlLFxyXG4gICAgUm91dGVzU2VydmljZSxcclxuICAgIEhlcmVNYXBzQ09OU1RTLFxyXG4gICAgSGVyZU1hcHNFdmVudHNGYWN0b3J5LFxyXG4gICAgSGVyZU1hcHNVaUZhY3RvcnkpIHtcclxuICAgICAgICBcclxuICAgIEhlcmVNYXBzRGlyZWN0aXZlQ3RybC4kaW5qZWN0ID0gWyckc2NvcGUnLCAnJGVsZW1lbnQnLCAnJGF0dHJzJ107XHJcbiAgICAgICAgXHJcbiAgICByZXR1cm4ge1xyXG4gICAgICAgIHJlc3RyaWN0OiAnRUEnLFxyXG4gICAgICAgIHRlbXBsYXRlOiBcIjxkaXYgbmctc3R5bGU9XFxcInsnd2lkdGgnOiBtYXBXaWR0aCwgJ2hlaWdodCc6IG1hcEhlaWdodH1cXFwiPjwvZGl2PlwiLFxyXG4gICAgICAgIHJlcGxhY2U6IHRydWUsXHJcbiAgICAgICAgc2NvcGU6IHtcclxuICAgICAgICAgICAgb3B0czogJyZvcHRpb25zJyxcclxuICAgICAgICAgICAgcGxhY2VzOiAnJicsXHJcbiAgICAgICAgICAgIG9uTWFwUmVhZHk6IFwiJm1hcFJlYWR5XCIsXHJcbiAgICAgICAgICAgIGV2ZW50czogJyYnXHJcbiAgICAgICAgfSxcclxuICAgICAgICBjb250cm9sbGVyOiBIZXJlTWFwc0RpcmVjdGl2ZUN0cmxcclxuICAgIH1cclxuICAgIFxyXG4gICAgZnVuY3Rpb24gSGVyZU1hcHNEaXJlY3RpdmVDdHJsKCRzY29wZSwgJGVsZW1lbnQsICRhdHRycykge1xyXG4gICAgICAgIHZhciBDT05UUk9MX05BTUVTID0gSGVyZU1hcHNDT05TVFMuQ09OVFJPTFMuTkFNRVMsXHJcbiAgICAgICAgICAgIHBsYWNlcyA9ICRzY29wZS5wbGFjZXMoKSxcclxuICAgICAgICAgICAgb3B0cyA9ICRzY29wZS5vcHRzKCksXHJcbiAgICAgICAgICAgIGxpc3RlbmVycyA9ICRzY29wZS5ldmVudHMoKTtcclxuXHJcbiAgICAgICAgdmFyIG9wdGlvbnMgPSBhbmd1bGFyLmV4dGVuZCh7fSwgSGVyZU1hcHNDT05TVFMuREVGQVVMVF9NQVBfT1BUSU9OUywgb3B0cyksXHJcbiAgICAgICAgICAgIHBvc2l0aW9uID0gSGVyZU1hcHNVdGlsc1NlcnZpY2UuaXNWYWxpZENvb3JkcyhvcHRpb25zLmNvb3JkcykgPyBcclxuICAgICAgICAgICAgICAgICAgICAgICAgb3B0aW9ucy5jb29yZHMgOiBIZXJlTWFwc0NPTlNUUy5ERUZBVUxUX01BUF9PUFRJT05TLmNvb3JkcztcclxuXHJcbiAgICAgICAgdmFyIGhlcmVtYXBzID0geyBpZDogSGVyZU1hcHNVdGlsc1NlcnZpY2UuZ2VuZXJhdGVJZCgpIH0sXHJcbiAgICAgICAgICAgIG1hcFJlYWR5ID0gJHNjb3BlLm9uTWFwUmVhZHkoKSxcclxuICAgICAgICAgICAgX29uUmVzaXplTWFwID0gbnVsbDtcclxuXHJcbiAgICAgICAgJHRpbWVvdXQoZnVuY3Rpb24gKCkge1xyXG4gICAgICAgICAgICByZXR1cm4gX3NldE1hcFNpemUoKTtcclxuICAgICAgICB9KS50aGVuKGZ1bmN0aW9uICgpIHtcclxuICAgICAgICAgICAgSGVyZU1hcHNBUElTZXJ2aWNlLmxvYWRBcGkoKS50aGVuKF9hcGlSZWFkeSk7XHJcbiAgICAgICAgfSk7XHJcblxyXG4gICAgICAgIG9wdGlvbnMucmVzaXplICYmIGFkZE9uUmVzaXplTGlzdGVuZXIoKTtcclxuXHJcbiAgICAgICAgJHNjb3BlLiRvbignJGRlc3Ryb3knLCBmdW5jdGlvbiAoKSB7XHJcbiAgICAgICAgICAgICR3aW5kb3cucmVtb3ZlRXZlbnRMaXN0ZW5lcigncmVzaXplJywgX29uUmVzaXplTWFwKTtcclxuICAgICAgICB9KTtcclxuXHJcbiAgICAgICAgZnVuY3Rpb24gYWRkT25SZXNpemVMaXN0ZW5lcigpIHtcclxuICAgICAgICAgICAgX29uUmVzaXplTWFwID0gSGVyZU1hcHNVdGlsc1NlcnZpY2UudGhyb3R0bGUoX3Jlc2l6ZUhhbmRsZXIsIEhlcmVNYXBzQ09OU1RTLlVQREFURV9NQVBfUkVTSVpFX1RJTUVPVVQpO1xyXG4gICAgICAgICAgICAkd2luZG93LmFkZEV2ZW50TGlzdGVuZXIoJ3Jlc2l6ZScsIF9vblJlc2l6ZU1hcCk7XHJcbiAgICAgICAgfVxyXG5cclxuICAgICAgICBmdW5jdGlvbiBfYXBpUmVhZHkoKSB7XHJcbiAgICAgICAgICAgIF9zZXR1cE1hcFBsYXRmb3JtKCk7XHJcbiAgICAgICAgICAgIF9zZXR1cE1hcCgpO1xyXG4gICAgICAgIH1cclxuXHJcbiAgICAgICAgZnVuY3Rpb24gX3NldHVwTWFwUGxhdGZvcm0oKSB7XHJcbiAgICAgICAgICAgIGlmICghSGVyZU1hcHNDb25maWcuYXBwX2lkIHx8ICFIZXJlTWFwc0NvbmZpZy5hcHBfY29kZSlcclxuICAgICAgICAgICAgICAgIHRocm93IG5ldyBFcnJvcignYXBwX2lkIG9yIGFwcF9jb2RlIHdlcmUgbWlzc2VkLiBQbGVhc2Ugc3BlY2lmeSB0aGVpciBpbiBIZXJlTWFwc0NvbmZpZycpO1xyXG4gICAgICAgICAgICBcclxuICAgICAgICAgICAgaGVyZW1hcHMucGxhdGZvcm0gPSBuZXcgSC5zZXJ2aWNlLlBsYXRmb3JtKEhlcmVNYXBzQ29uZmlnKTtcclxuICAgICAgICAgICAgaGVyZW1hcHMubGF5ZXJzID0gaGVyZW1hcHMucGxhdGZvcm0uY3JlYXRlRGVmYXVsdExheWVycygpO1xyXG4gICAgICAgIH1cclxuXHJcbiAgICAgICAgZnVuY3Rpb24gX2dldExvY2F0aW9uKGVuYWJsZUhpZ2hBY2N1cmFjeSwgbWF4aW11bUFnZSkge1xyXG4gICAgICAgICAgICB2YXIgX2VuYWJsZUhpZ2hBY2N1cmFjeSA9ICEhZW5hYmxlSGlnaEFjY3VyYWN5LFxyXG4gICAgICAgICAgICAgICAgX21heGltdW1BZ2UgPSBtYXhpbXVtQWdlIHx8IDA7XHJcblxyXG4gICAgICAgICAgICByZXR1cm4gSGVyZU1hcHNBUElTZXJ2aWNlLmdldFBvc2l0aW9uKHtcclxuICAgICAgICAgICAgICAgIGVuYWJsZUhpZ2hBY2N1cmFjeTogX2VuYWJsZUhpZ2hBY2N1cmFjeSxcclxuICAgICAgICAgICAgICAgIG1heGltdW1BZ2U6IF9tYXhpbXVtQWdlXHJcbiAgICAgICAgICAgIH0pO1xyXG4gICAgICAgIH1cclxuXHJcbiAgICAgICAgZnVuY3Rpb24gX2xvY2F0aW9uRmFpbHVyZSgpIHtcclxuICAgICAgICAgICAgY29uc29sZS5lcnJvcignQ2FuIG5vdCBnZXQgYSBnZW8gcG9zaXRpb24nKTtcclxuICAgICAgICB9XHJcblxyXG4gICAgICAgIGZ1bmN0aW9uIF9zZXR1cE1hcCgpIHtcclxuICAgICAgICAgICAgX2luaXRNYXAoZnVuY3Rpb24gKCkge1xyXG4gICAgICAgICAgICAgICAgSGVyZU1hcHNBUElTZXJ2aWNlLmxvYWRNb2R1bGVzKCRhdHRycy4kYXR0ciwge1xyXG4gICAgICAgICAgICAgICAgICAgIFwiY29udHJvbHNcIjogX3VpTW9kdWxlUmVhZHksXHJcbiAgICAgICAgICAgICAgICAgICAgXCJldmVudHNcIjogX2V2ZW50c01vZHVsZVJlYWR5XHJcbiAgICAgICAgICAgICAgICB9KTtcclxuICAgICAgICAgICAgfSk7XHJcbiAgICAgICAgfVxyXG5cclxuICAgICAgICBmdW5jdGlvbiBfaW5pdE1hcChjYikge1xyXG4gICAgICAgICAgICB2YXIgbWFwID0gaGVyZW1hcHMubWFwID0gbmV3IEguTWFwKCRlbGVtZW50WzBdLCBoZXJlbWFwcy5sYXllcnMubm9ybWFsLm1hcCwge1xyXG4gICAgICAgICAgICAgICAgem9vbTogSGVyZU1hcHNVdGlsc1NlcnZpY2UuaXNWYWxpZENvb3Jkcyhwb3NpdGlvbikgPyBvcHRpb25zLnpvb20gOiBvcHRpb25zLm1heFpvb20sXHJcbiAgICAgICAgICAgICAgICBjZW50ZXI6IG5ldyBILmdlby5Qb2ludChwb3NpdGlvbi5sYXRpdHVkZSwgcG9zaXRpb24ubG9uZ2l0dWRlKVxyXG4gICAgICAgICAgICB9KTtcclxuXHJcbiAgICAgICAgICAgIEhlcmVNYXBzTWFya2VyU2VydmljZS5hZGRNYXJrZXJzVG9NYXAobWFwLCBwbGFjZXMsIHRydWUpO1xyXG5cclxuICAgICAgICAgICAgbWFwUmVhZHkgJiYgbWFwUmVhZHkoTWFwUHJveHkoKSk7XHJcblxyXG4gICAgICAgICAgICBjYiAmJiBjYigpO1xyXG4gICAgICAgICAgICAgICAgXHJcbiAgICAgICAgfVxyXG5cclxuICAgICAgICBmdW5jdGlvbiBfdWlNb2R1bGVSZWFkeSgpIHtcclxuICAgICAgICAgICAgSGVyZU1hcHNVaUZhY3Rvcnkuc3RhcnQoe1xyXG4gICAgICAgICAgICAgICAgcGxhdGZvcm06IGhlcmVtYXBzLFxyXG4gICAgICAgICAgICAgICAgYWxpZ25tZW50OiAkYXR0cnMuY29udHJvbHNcclxuICAgICAgICAgICAgfSk7XHJcbiAgICAgICAgfVxyXG5cclxuICAgICAgICBmdW5jdGlvbiBfZXZlbnRzTW9kdWxlUmVhZHkoKSB7XHJcbiAgICAgICAgICAgIEhlcmVNYXBzRXZlbnRzRmFjdG9yeS5zdGFydCh7XHJcbiAgICAgICAgICAgICAgICBwbGF0Zm9ybTogaGVyZW1hcHMsXHJcbiAgICAgICAgICAgICAgICBsaXN0ZW5lcnM6IGxpc3RlbmVycyxcclxuICAgICAgICAgICAgICAgIG9wdGlvbnM6IG9wdGlvbnMsXHJcbiAgICAgICAgICAgICAgICBpbmplY3RvcjogX21vZHVsZUluamVjdG9yXHJcbiAgICAgICAgICAgIH0pO1xyXG4gICAgICAgIH1cclxuXHJcbiAgICAgICAgZnVuY3Rpb24gX21vZHVsZUluamVjdG9yKCkge1xyXG4gICAgICAgICAgICByZXR1cm4gZnVuY3Rpb24gKGlkKSB7XHJcbiAgICAgICAgICAgICAgICByZXR1cm4gaGVyZW1hcHNbaWRdO1xyXG4gICAgICAgICAgICB9XHJcbiAgICAgICAgfVxyXG5cclxuICAgICAgICBmdW5jdGlvbiBfcmVzaXplSGFuZGxlcihoZWlnaHQsIHdpZHRoKSB7XHJcbiAgICAgICAgICAgIF9zZXRNYXBTaXplLmFwcGx5KG51bGwsIGFyZ3VtZW50cyk7XHJcblxyXG4gICAgICAgICAgICBoZXJlbWFwcy5tYXAuZ2V0Vmlld1BvcnQoKS5yZXNpemUoKTtcclxuICAgICAgICB9XHJcblxyXG4gICAgICAgIGZ1bmN0aW9uIF9zZXRNYXBTaXplKGhlaWdodCwgd2lkdGgpIHtcclxuICAgICAgICAgICAgdmFyIGhlaWdodCA9IGhlaWdodCB8fCAkZWxlbWVudFswXS5wYXJlbnROb2RlLm9mZnNldEhlaWdodCB8fCBvcHRpb25zLmhlaWdodCxcclxuICAgICAgICAgICAgICAgIHdpZHRoID0gd2lkdGggfHwgJGVsZW1lbnRbMF0ucGFyZW50Tm9kZS5vZmZzZXRXaWR0aCB8fCBvcHRpb25zLndpZHRoO1xyXG5cclxuICAgICAgICAgICAgJHNjb3BlLm1hcEhlaWdodCA9IGhlaWdodCArICdweCc7XHJcbiAgICAgICAgICAgICRzY29wZS5tYXBXaWR0aCA9IHdpZHRoICsgJ3B4JztcclxuICAgICAgICAgICAgXHJcbiAgICAgICAgICAgIEhlcmVNYXBzVXRpbHNTZXJ2aWNlLnJ1blNjb3BlRGlnZXN0SWZOZWVkKCRzY29wZSk7XHJcbiAgICAgICAgfVxyXG5cclxuICAgICAgICBmdW5jdGlvbiBNYXBQcm94eSgpIHtcclxuICAgICAgICAgICAgcmV0dXJuIHtcclxuICAgICAgICAgICAgICAgIHJlZnJlc2g6IGZ1bmN0aW9uKCl7XHJcbiAgICAgICAgICAgICAgICAgICAgdmFyIGN1cnJlbnRCb3VuZHMgPSB0aGlzLmdldFZpZXdCb3VuZHMoKTtcclxuICAgICAgICAgICAgICAgICAgICBcclxuICAgICAgICAgICAgICAgICAgICB0aGlzLnNldE1hcFNpemVzKCk7XHJcbiAgICAgICAgICAgICAgICAgICAgdGhpcy5zZXRWaWV3Qm91bmRzKGN1cnJlbnRCb3VuZHMpO1xyXG4gICAgICAgICAgICAgICAgfSxcclxuICAgICAgICAgICAgICAgIHNldE1hcFNpemVzOiBmdW5jdGlvbihoZWlnaHQsIHdpZHRoKXtcclxuICAgICAgICAgICAgICAgICAgICBjb25zb2xlLmxvZygkZWxlbWVudFswXS5wYXJlbnROb2RlLm9mZnNldEhlaWdodClcclxuICAgICAgICAgICAgICAgICAgICBfcmVzaXplSGFuZGxlci5hcHBseShudWxsLCBhcmd1bWVudHMpO1xyXG4gICAgICAgICAgICAgICAgfSxcclxuICAgICAgICAgICAgICAgIGdldFBsYXRmb3JtOiBmdW5jdGlvbiAoKSB7XHJcbiAgICAgICAgICAgICAgICAgICAgcmV0dXJuIGhlcmVtYXBzO1xyXG4gICAgICAgICAgICAgICAgfSxcclxuICAgICAgICAgICAgICAgIGNhbGN1bGF0ZVJvdXRlOiBmdW5jdGlvbiAoZHJpdmVUeXBlLCBkaXJlY3Rpb24pIHtcclxuICAgICAgICAgICAgICAgICAgICByZXR1cm4gUm91dGVzU2VydmljZS5jYWxjdWxhdGVSb3V0ZShoZXJlbWFwcywge1xyXG4gICAgICAgICAgICAgICAgICAgICAgICBkcml2ZVR5cGU6IGRyaXZlVHlwZSxcclxuICAgICAgICAgICAgICAgICAgICAgICAgZGlyZWN0aW9uOiBkaXJlY3Rpb25cclxuICAgICAgICAgICAgICAgICAgICB9KTtcclxuICAgICAgICAgICAgICAgIH0sXHJcbiAgICAgICAgICAgICAgICBhZGRSb3V0ZVRvTWFwOiBmdW5jdGlvbiAocm91dGVEYXRhLCBjbGVhbikge1xyXG4gICAgICAgICAgICAgICAgICAgIFJvdXRlc1NlcnZpY2UuYWRkUm91dGVUb01hcChoZXJlbWFwcy5tYXAsIHJvdXRlRGF0YSwgY2xlYW4pO1xyXG4gICAgICAgICAgICAgICAgfSxcclxuICAgICAgICAgICAgICAgIHNldFpvb206IGZ1bmN0aW9uICh6b29tLCBzdGVwKSB7XHJcbiAgICAgICAgICAgICAgICAgICAgSGVyZU1hcHNVdGlsc1NlcnZpY2Uuem9vbShoZXJlbWFwcy5tYXAsIHpvb20gfHwgMTAsIHN0ZXApO1xyXG4gICAgICAgICAgICAgICAgfSxcclxuICAgICAgICAgICAgICAgIGdldFpvb206IGZ1bmN0aW9uKCl7XHJcbiAgICAgICAgICAgICAgICAgICAgcmV0dXJuIGhlcmVtYXBzLm1hcC5nZXRab29tKCk7ICBcclxuICAgICAgICAgICAgICAgIH0sXHJcbiAgICAgICAgICAgICAgICBnZXRDZW50ZXI6IGZ1bmN0aW9uKCl7XHJcbiAgICAgICAgICAgICAgICAgICAgcmV0dXJuIGhlcmVtYXBzLm1hcC5nZXRDZW50ZXIoKTsgIFxyXG4gICAgICAgICAgICAgICAgfSxcclxuICAgICAgICAgICAgICAgIGdldFZpZXdCb3VuZHM6IGZ1bmN0aW9uKCl7XHJcbiAgICAgICAgICAgICAgICAgICAgcmV0dXJuIGhlcmVtYXBzLm1hcC5nZXRWaWV3Qm91bmRzKCk7ICAgXHJcbiAgICAgICAgICAgICAgICB9LFxyXG4gICAgICAgICAgICAgICAgc2V0Vmlld0JvdW5kczogZnVuY3Rpb24oYm91bmRpbmdSZWN0LCBvcHRfYW5pbWF0ZSl7XHJcbiAgICAgICAgICAgICAgICAgICAgaGVyZW1hcHMubWFwLnNldFZpZXdCb3VuZHMoYm91bmRpbmdSZWN0LCBvcHRfYW5pbWF0ZSk7XHJcbiAgICAgICAgICAgICAgICB9LFxyXG4gICAgICAgICAgICAgICAgc2V0Q2VudGVyOiBmdW5jdGlvbiAoY29vcmRzKSB7XHJcbiAgICAgICAgICAgICAgICAgICAgaWYgKCFjb29yZHMpIHtcclxuICAgICAgICAgICAgICAgICAgICAgICAgcmV0dXJuIGNvbnNvbGUuZXJyb3IoJ2Nvb3JkcyBhcmUgbm90IHNwZWNpZmllZCEnKTtcclxuICAgICAgICAgICAgICAgICAgICB9XHJcblxyXG4gICAgICAgICAgICAgICAgICAgIGhlcmVtYXBzLm1hcC5zZXRDZW50ZXIoY29vcmRzKTtcclxuICAgICAgICAgICAgICAgIH0sXHJcbiAgICAgICAgICAgICAgICBjbGVhblJvdXRlczogZnVuY3Rpb24gKCkge1xyXG4gICAgICAgICAgICAgICAgICAgIFJvdXRlc1NlcnZpY2UuY2xlYW5Sb3V0ZXMoaGVyZW1hcHMubWFwKTtcclxuICAgICAgICAgICAgICAgIH0sXHJcblxyXG4gICAgICAgICAgICAgICAgLyoqXHJcbiAgICAgICAgICAgICAgICAgKiBAcGFyYW0ge0Jvb2xlYW59IGVuYWJsZUhpZ2hBY2N1cmFjeVxyXG4gICAgICAgICAgICAgICAgICogQHBhcmFtIHtOdW1iZXJ9IG1heGltdW1BZ2UgLSB0aGUgbWF4aW11bSBhZ2UgaW4gbWlsbGlzZWNvbmRzIG9mIGEgcG9zc2libGUgY2FjaGVkIHBvc2l0aW9uIHRoYXQgaXMgYWNjZXB0YWJsZSB0byByZXR1cm4uIElmIHNldCB0byAwLCBpdCBtZWFucyB0aGF0IHRoZSBkZXZpY2UgY2Fubm90IHVzZSBhIGNhY2hlZCBwb3NpdGlvbiBhbmQgbXVzdCBhdHRlbXB0IHRvIHJldHJpZXZlIHRoZSByZWFsIGN1cnJlbnQgcG9zaXRpb25cclxuICAgICAgICAgICAgICAgICAqIEByZXR1cm4ge1Byb21pc2V9XHJcbiAgICAgICAgICAgICAgICAgKi9cclxuICAgICAgICAgICAgICAgIGdldFVzZXJMb2NhdGlvbjogZnVuY3Rpb24gKGVuYWJsZUhpZ2hBY2N1cmFjeSwgbWF4aW11bUFnZSkge1xyXG4gICAgICAgICAgICAgICAgICAgIHJldHVybiBfZ2V0TG9jYXRpb24uYXBwbHkobnVsbCwgYXJndW1lbnRzKS50aGVuKGZ1bmN0aW9uIChwb3NpdGlvbikge1xyXG4gICAgICAgICAgICAgICAgICAgICAgICB2YXIgY29vcmRzID0gcG9zaXRpb24uY29vcmRzO1xyXG5cclxuICAgICAgICAgICAgICAgICAgICAgICAgSGVyZU1hcHNNYXJrZXJTZXJ2aWNlLmFkZFVzZXJNYXJrZXIoaGVyZW1hcHMubWFwLCB7XHJcbiAgICAgICAgICAgICAgICAgICAgICAgICAgICBwb3M6IHtcclxuICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICBsYXQ6IGNvb3Jkcy5sYXRpdHVkZSxcclxuICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICBsbmc6IGNvb3Jkcy5sb25naXR1ZGVcclxuICAgICAgICAgICAgICAgICAgICAgICAgICAgIH1cclxuICAgICAgICAgICAgICAgICAgICAgICAgfSk7XHJcblxyXG4gICAgICAgICAgICAgICAgICAgICAgICByZXR1cm4gY29vcmRzO1xyXG4gICAgICAgICAgICAgICAgICAgIH0pXHJcbiAgICAgICAgICAgICAgICB9LFxyXG4gICAgICAgICAgICAgICAgZ2VvY29kZVBvc2l0aW9uOiBmdW5jdGlvbiAoY29vcmRzLCBvcHRpb25zKSB7XHJcbiAgICAgICAgICAgICAgICAgICAgcmV0dXJuIEhlcmVNYXBzQVBJU2VydmljZS5nZW9jb2RlUG9zaXRpb24oaGVyZW1hcHMucGxhdGZvcm0sIHtcclxuICAgICAgICAgICAgICAgICAgICAgICAgY29vcmRzOiBjb29yZHMsXHJcbiAgICAgICAgICAgICAgICAgICAgICAgIHJhZGl1czogb3B0aW9ucyAmJiBvcHRpb25zLnJhZGl1cyxcclxuICAgICAgICAgICAgICAgICAgICAgICAgbGFuZzogb3B0aW9ucyAmJiBvcHRpb25zLmxhbmdcclxuICAgICAgICAgICAgICAgICAgICB9KTtcclxuICAgICAgICAgICAgICAgIH0sXHJcbiAgICAgICAgICAgICAgICB1cGRhdGVNYXJrZXJzOiBmdW5jdGlvbiAocGxhY2VzLCByZWZyZXNoVmlld2JvdW5kcykge1xyXG4gICAgICAgICAgICAgICAgICAgIEhlcmVNYXBzTWFya2VyU2VydmljZS51cGRhdGVNYXJrZXJzKGhlcmVtYXBzLm1hcCwgcGxhY2VzLCByZWZyZXNoVmlld2JvdW5kcyk7XHJcbiAgICAgICAgICAgICAgICB9XHJcbiAgICAgICAgICAgIH1cclxuICAgICAgICB9XHJcblxyXG4gICAgfVxyXG59O1xyXG4iLCJyZXF1aXJlKCcuL3Byb3ZpZGVycy9tYXJrZXJzJyk7XHJcbnJlcXVpcmUoJy4vcHJvdmlkZXJzL21hcC1tb2R1bGVzJyk7XHJcbnJlcXVpcmUoJy4vcHJvdmlkZXJzL3JvdXRlcycpO1xyXG5cclxubW9kdWxlLmV4cG9ydHMgPSBhbmd1bGFyLm1vZHVsZSgnaGVyZW1hcHMnLCBbXHJcbiAgICAgICAgJ2hlcmVtYXBzLW1hcmtlcnMtbW9kdWxlJyxcclxuICAgICAgICAnaGVyZW1hcHMtcm91dGVzLW1vZHVsZScsXHJcbiAgICAgICAgJ2hlcmVtYXBzLW1hcC1tb2R1bGVzJ1xyXG4gICAgXSlcclxuICAgIC5wcm92aWRlcignSGVyZU1hcHNDb25maWcnLCByZXF1aXJlKCcuL3Byb3ZpZGVycy9tYXBjb25maWcucHJvdmlkZXInKSlcclxuICAgIC5zZXJ2aWNlKCdIZXJlTWFwc1V0aWxzU2VydmljZScsIHJlcXVpcmUoJy4vcHJvdmlkZXJzL21hcHV0aWxzLnNlcnZpY2UnKSlcclxuICAgIC5zZXJ2aWNlKCdIZXJlTWFwc0FQSVNlcnZpY2UnLCBbXHJcbiAgICAgICAgJyRxJywgXHJcbiAgICAgICAgJyRodHRwJyxcclxuICAgICAgICAnSGVyZU1hcHNDb25maWcnLCBcclxuICAgICAgICAnSGVyZU1hcHNVdGlsc1NlcnZpY2UnLCBcclxuICAgICAgICAnSGVyZU1hcHNDT05TVFMnLCByZXF1aXJlKCcuL3Byb3ZpZGVycy9hcGkuc2VydmljZScpXSlcclxuICAgIC5jb25zdGFudCgnSGVyZU1hcHNDT05TVFMnLCByZXF1aXJlKCcuL3Byb3ZpZGVycy9jb25zdHMnKSlcclxuICAgIC5kaXJlY3RpdmUoJ2hlcmVtYXBzJywgcmVxdWlyZSgnLi9oZXJlbWFwcy5kaXJlY3RpdmUnKSk7XHJcbiIsIm1vZHVsZS5leHBvcnRzID0gZnVuY3Rpb24gKCRxLCAkaHR0cCwgSGVyZU1hcHNDb25maWcsIEhlcmVNYXBzVXRpbHNTZXJ2aWNlLCBIZXJlTWFwc0NPTlNUUykge1xyXG4gICAgdmFyIHZlcnNpb24gPSBIZXJlTWFwc0NvbmZpZy5hcGlWZXJzaW9uLFxyXG4gICAgICAgIHByb3RvY29sID0gSGVyZU1hcHNDb25maWcudXNlSFRUUFMgPyAnaHR0cHMnIDogJ2h0dHAnO1xyXG5cclxuICAgIHZhciBBUElfVkVSU0lPTiA9IHtcclxuICAgICAgICBWOiBwYXJzZUludCh2ZXJzaW9uKSxcclxuICAgICAgICBTVUI6IHZlcnNpb25cclxuICAgIH07XHJcblxyXG4gICAgdmFyIENPTkZJRyA9IHtcclxuICAgICAgICBCQVNFOiBcIjovL2pzLmFwaS5oZXJlLmNvbS92XCIsXHJcbiAgICAgICAgQ09SRTogXCJtYXBzanMtY29yZS5qc1wiLFxyXG4gICAgICAgIFNFUlZJQ0U6IFwibWFwc2pzLXNlcnZpY2UuanNcIixcclxuICAgICAgICBVSToge1xyXG4gICAgICAgICAgICBzcmM6IFwibWFwc2pzLXVpLmpzXCIsXHJcbiAgICAgICAgICAgIGhyZWY6IFwibWFwc2pzLXVpLmNzc1wiXHJcbiAgICAgICAgfSxcclxuICAgICAgICBFVkVOVFM6IFwibWFwc2pzLW1hcGV2ZW50cy5qc1wiXHJcbiAgICB9O1xyXG5cclxuICAgIHZhciBBUElfREVGRVJTUXVldWUgPSB7fTtcclxuXHJcbiAgICBBUElfREVGRVJTUXVldWVbQ09ORklHLkNPUkVdID0gW107XHJcbiAgICBBUElfREVGRVJTUXVldWVbQ09ORklHLlNFUlZJQ0VdID0gW107XHJcbiAgICBBUElfREVGRVJTUXVldWVbQ09ORklHLlVJLnNyY10gPSBbXTtcclxuICAgIEFQSV9ERUZFUlNRdWV1ZVtDT05GSUcuUEFOT10gPSBbXTtcclxuICAgIEFQSV9ERUZFUlNRdWV1ZVtDT05GSUcuRVZFTlRTXSA9IFtdO1xyXG5cclxuICAgIHZhciBoZWFkID0gZG9jdW1lbnQuZ2V0RWxlbWVudHNCeVRhZ05hbWUoJ2hlYWQnKVswXTtcclxuXHJcbiAgICByZXR1cm4ge1xyXG4gICAgICAgIGxvYWRBcGk6IGxvYWRBcGksXHJcbiAgICAgICAgbG9hZE1vZHVsZXM6IGxvYWRNb2R1bGVzLFxyXG4gICAgICAgIGdldFBvc2l0aW9uOiBnZXRQb3NpdGlvbixcclxuICAgICAgICBnZW9jb2RlUG9zaXRpb246IGdlb2NvZGVQb3NpdGlvblxyXG4gICAgfTtcclxuXHJcbiAgICAvLyNyZWdpb24gUFVCTElDXHJcbiAgICBmdW5jdGlvbiBsb2FkQXBpKCkge1xyXG4gICAgICAgIHJldHVybiBfZ2V0TG9hZGVyKENPTkZJRy5DT1JFKVxyXG4gICAgICAgICAgICAudGhlbihmdW5jdGlvbiAoKSB7XHJcbiAgICAgICAgICAgICAgICByZXR1cm4gX2dldExvYWRlcihDT05GSUcuU0VSVklDRSk7XHJcbiAgICAgICAgICAgIH0pO1xyXG4gICAgfVxyXG5cclxuICAgIGZ1bmN0aW9uIGxvYWRNb2R1bGVzKGF0dHJzLCBoYW5kbGVycykge1xyXG4gICAgICAgIGZvciAodmFyIGtleSBpbiBoYW5kbGVycykge1xyXG4gICAgICAgICAgICBpZiAoIWhhbmRsZXJzLmhhc093blByb3BlcnR5KGtleSkgfHwgIWF0dHJzW2tleV0pXHJcbiAgICAgICAgICAgICAgICBjb250aW51ZTtcclxuXHJcbiAgICAgICAgICAgIHZhciBsb2FkZXIgPSBfZ2V0TG9hZGVyQnlBdHRyKGtleSk7XHJcblxyXG4gICAgICAgICAgICBsb2FkZXIoKVxyXG4gICAgICAgICAgICAgICAgLnRoZW4oaGFuZGxlcnNba2V5XSk7XHJcbiAgICAgICAgfVxyXG4gICAgfVxyXG5cclxuICAgIGZ1bmN0aW9uIGdldFBvc2l0aW9uKG9wdGlvbnMpIHtcclxuICAgICAgICB2YXIgZGVmZXJyZWQgPSAkcS5kZWZlcigpO1xyXG5cclxuICAgICAgICBpZiAob3B0aW9ucyAmJiBfaXNWYWxpZENvb3JkcyhvcHRpb25zLmNvb3JkcykpIHtcclxuICAgICAgICAgICAgZGVmZXJyZWQucmVzb2x2ZSh7IGNvb3Jkczogb3B0aW9ucy5jb29yZHMgfSk7XHJcbiAgICAgICAgfSBlbHNlIHtcclxuICAgICAgICAgICAgbmF2aWdhdG9yLmdlb2xvY2F0aW9uLmdldEN1cnJlbnRQb3NpdGlvbihmdW5jdGlvbiAocmVzcG9uc2UpIHtcclxuICAgICAgICAgICAgICAgIGRlZmVycmVkLnJlc29sdmUocmVzcG9uc2UpO1xyXG4gICAgICAgICAgICB9LCBmdW5jdGlvbiAoZXJyb3IpIHtcclxuICAgICAgICAgICAgICAgIGRlZmVycmVkLnJlamVjdChlcnJvcik7XHJcbiAgICAgICAgICAgIH0sIG9wdGlvbnMpO1xyXG4gICAgICAgIH1cclxuXHJcbiAgICAgICAgcmV0dXJuIGRlZmVycmVkLnByb21pc2U7XHJcbiAgICB9XHJcblxyXG4gICAgZnVuY3Rpb24gZ2VvY29kZVBvc2l0aW9uKHBsYXRmb3JtLCBwYXJhbXMpIHtcclxuICAgICAgICBpZiAoIXBhcmFtcy5jb29yZHMpXHJcbiAgICAgICAgICAgIHJldHVybiBjb25zb2xlLmVycm9yKCdNaXNzZWQgcmVxdWlyZWQgY29vcmRzJyk7XHJcblxyXG4gICAgICAgIHZhciBnZW9jb2RlciA9IHBsYXRmb3JtLmdldEdlb2NvZGluZ1NlcnZpY2UoKSxcclxuICAgICAgICAgICAgZGVmZXJyZWQgPSAkcS5kZWZlcigpLFxyXG4gICAgICAgICAgICBfcGFyYW1zID0ge1xyXG4gICAgICAgICAgICAgICAgcHJveDogW3BhcmFtcy5jb29yZHMubGF0LCBwYXJhbXMuY29vcmRzLmxuZywgcGFyYW1zLnJhZGl1cyB8fCAyNTBdLmpvaW4oJywnKSxcclxuICAgICAgICAgICAgICAgIG1vZGU6ICdyZXRyaWV2ZUFkZHJlc3NlcycsXHJcbiAgICAgICAgICAgICAgICBtYXhyZXN1bHRzOiAnMScsXHJcbiAgICAgICAgICAgICAgICBnZW46ICc4JyxcclxuICAgICAgICAgICAgICAgIGxhbmd1YWdlOiBwYXJhbXMubGFuZyB8fCAnZW4tZ2InXHJcbiAgICAgICAgICAgIH07XHJcblxyXG4gICAgICAgIGdlb2NvZGVyLnJldmVyc2VHZW9jb2RlKF9wYXJhbXMsIGZ1bmN0aW9uIChyZXNwb25zZSkge1xyXG4gICAgICAgICAgICBkZWZlcnJlZC5yZXNvbHZlKHJlc3BvbnNlKVxyXG4gICAgICAgIH0sIGZ1bmN0aW9uIChlcnJvcikge1xyXG4gICAgICAgICAgICBkZWZlcnJlZC5yZWplY3QoZXJyb3IpXHJcbiAgICAgICAgfSk7XHJcbiAgICAgICAgXHJcbiAgICAgICAgcmV0dXJuIGRlZmVycmVkLnByb21pc2U7XHJcbiAgICB9XHJcblxyXG4gICAgLy8jZW5kcmVnaW9uIFBVQkxJQ1xyXG5cclxuICAgIGZ1bmN0aW9uIF9nZXRMb2FkZXJCeUF0dHIoYXR0cikge1xyXG4gICAgICAgIHZhciBsb2FkZXI7XHJcblxyXG4gICAgICAgIHN3aXRjaCAoYXR0cikge1xyXG4gICAgICAgICAgICBjYXNlIEhlcmVNYXBzQ09OU1RTLk1PRFVMRVMuVUk6XHJcbiAgICAgICAgICAgICAgICBsb2FkZXIgPSBfbG9hZFVJTW9kdWxlO1xyXG4gICAgICAgICAgICAgICAgYnJlYWs7XHJcbiAgICAgICAgICAgIGNhc2UgSGVyZU1hcHNDT05TVFMuTU9EVUxFUy5FVkVOVFM6XHJcbiAgICAgICAgICAgICAgICBsb2FkZXIgPSBfbG9hZEV2ZW50c01vZHVsZTtcclxuICAgICAgICAgICAgICAgIGJyZWFrO1xyXG4gICAgICAgICAgICBkZWZhdWx0OlxyXG4gICAgICAgICAgICAgICAgdGhyb3cgbmV3IEVycm9yKCdVbmtub3duIG1vZHVsZScsIGF0dHIpO1xyXG4gICAgICAgIH1cclxuXHJcbiAgICAgICAgcmV0dXJuIGxvYWRlcjtcclxuICAgIH1cclxuXHJcbiAgICBmdW5jdGlvbiBfbG9hZFVJTW9kdWxlKCkge1xyXG4gICAgICAgIGlmICghX2lzTG9hZGVkKENPTkZJRy5VSS5zcmMpKSB7XHJcbiAgICAgICAgICAgIHZhciBsaW5rID0gSGVyZU1hcHNVdGlsc1NlcnZpY2UuY3JlYXRlTGlua1RhZyh7XHJcbiAgICAgICAgICAgICAgICByZWw6ICdzdHlsZXNoZWV0JyxcclxuICAgICAgICAgICAgICAgIHR5cGU6ICd0ZXh0L2NzcycsXHJcbiAgICAgICAgICAgICAgICBocmVmOiBfZ2V0VVJMKENPTkZJRy5VSS5ocmVmKVxyXG4gICAgICAgICAgICB9KTtcclxuXHJcbiAgICAgICAgICAgIGxpbmsgJiYgaGVhZC5hcHBlbmRDaGlsZChsaW5rKTtcclxuICAgICAgICB9XHJcblxyXG4gICAgICAgIHJldHVybiBfZ2V0TG9hZGVyKENPTkZJRy5VSS5zcmMpO1xyXG4gICAgfVxyXG5cclxuICAgIGZ1bmN0aW9uIF9sb2FkRXZlbnRzTW9kdWxlKCkge1xyXG4gICAgICAgIHJldHVybiBfZ2V0TG9hZGVyKENPTkZJRy5FVkVOVFMpO1xyXG4gICAgfVxyXG5cclxuICAgIC8qKlxyXG4gICAgICogQHBhcmFtIHtTdHJpbmd9IHNvdXJjZU5hbWVcclxuICAgICAqIHJldHVybiB7U3RyaW5nfSBlLmcgaHR0cDovL2pzLmFwaS5oZXJlLmNvbS92e1ZFUn0ve1NVQlZFUlNJT059L3tTT1VSQ0V9XHJcbiAgICAgKi9cclxuICAgIGZ1bmN0aW9uIF9nZXRVUkwoc291cmNlTmFtZSkge1xyXG4gICAgICAgIHJldHVybiBbXHJcbiAgICAgICAgICAgIHByb3RvY29sLFxyXG4gICAgICAgICAgICBDT05GSUcuQkFTRSxcclxuICAgICAgICAgICAgQVBJX1ZFUlNJT04uVixcclxuICAgICAgICAgICAgXCIvXCIsXHJcbiAgICAgICAgICAgIEFQSV9WRVJTSU9OLlNVQixcclxuICAgICAgICAgICAgXCIvXCIsXHJcbiAgICAgICAgICAgIHNvdXJjZU5hbWVcclxuICAgICAgICBdLmpvaW4oXCJcIik7XHJcbiAgICB9XHJcblxyXG4gICAgZnVuY3Rpb24gX2dldExvYWRlcihzb3VyY2VOYW1lKSB7XHJcbiAgICAgICAgdmFyIGRlZmVyID0gJHEuZGVmZXIoKSwgc3JjLCBzY3JpcHQ7XHJcblxyXG4gICAgICAgIGlmIChfaXNMb2FkZWQoc291cmNlTmFtZSkpIHtcclxuICAgICAgICAgICAgZGVmZXIucmVzb2x2ZSgpO1xyXG4gICAgICAgIH0gZWxzZSB7XHJcbiAgICAgICAgICAgIHNyYyA9IF9nZXRVUkwoc291cmNlTmFtZSksXHJcbiAgICAgICAgICAgICAgICBzY3JpcHQgPSBIZXJlTWFwc1V0aWxzU2VydmljZS5jcmVhdGVTY3JpcHRUYWcoeyBzcmM6IHNyYyB9KTtcclxuXHJcbiAgICAgICAgICAgIHNjcmlwdCAmJiBoZWFkLmFwcGVuZENoaWxkKHNjcmlwdCk7XHJcblxyXG4gICAgICAgICAgICBBUElfREVGRVJTUXVldWVbc291cmNlTmFtZV0ucHVzaChkZWZlcik7XHJcblxyXG4gICAgICAgICAgICBzY3JpcHQub25sb2FkID0gX29uTG9hZC5iaW5kKG51bGwsIHNvdXJjZU5hbWUpO1xyXG4gICAgICAgICAgICBzY3JpcHQub25lcnJvciA9IF9vbkVycm9yLmJpbmQobnVsbCwgc291cmNlTmFtZSk7XHJcbiAgICAgICAgfVxyXG5cclxuICAgICAgICByZXR1cm4gZGVmZXIucHJvbWlzZTtcclxuICAgIH1cclxuXHJcbiAgICBmdW5jdGlvbiBfaXNMb2FkZWQoc291cmNlTmFtZSkge1xyXG4gICAgICAgIHZhciBjaGVja2VyID0gbnVsbDtcclxuXHJcbiAgICAgICAgc3dpdGNoIChzb3VyY2VOYW1lKSB7XHJcbiAgICAgICAgICAgIGNhc2UgQ09ORklHLkNPUkU6XHJcbiAgICAgICAgICAgICAgICBjaGVja2VyID0gX2lzQ29yZUxvYWRlZDtcclxuICAgICAgICAgICAgICAgIGJyZWFrO1xyXG4gICAgICAgICAgICBjYXNlIENPTkZJRy5TRVJWSUNFOlxyXG4gICAgICAgICAgICAgICAgY2hlY2tlciA9IF9pc1NlcnZpY2VMb2FkZWQ7XHJcbiAgICAgICAgICAgICAgICBicmVhaztcclxuICAgICAgICAgICAgY2FzZSBDT05GSUcuVUkuc3JjOlxyXG4gICAgICAgICAgICAgICAgY2hlY2tlciA9IF9pc1VJTG9hZGVkO1xyXG4gICAgICAgICAgICAgICAgYnJlYWs7XHJcbiAgICAgICAgICAgIGNhc2UgQ09ORklHLkVWRU5UUzpcclxuICAgICAgICAgICAgICAgIGNoZWNrZXIgPSBfaXNFdmVudHNMb2FkZWQ7XHJcbiAgICAgICAgICAgICAgICBicmVhaztcclxuICAgICAgICAgICAgZGVmYXVsdDpcclxuICAgICAgICAgICAgICAgIGNoZWNrZXIgPSBmdW5jdGlvbiAoKSB7IHJldHVybiBmYWxzZSB9O1xyXG4gICAgICAgIH1cclxuXHJcbiAgICAgICAgcmV0dXJuIGNoZWNrZXIoKTtcclxuICAgIH1cclxuXHJcbiAgICBmdW5jdGlvbiBfaXNDb3JlTG9hZGVkKCkge1xyXG4gICAgICAgIHJldHVybiAhIXdpbmRvdy5IO1xyXG4gICAgfVxyXG5cclxuICAgIGZ1bmN0aW9uIF9pc1NlcnZpY2VMb2FkZWQoKSB7XHJcbiAgICAgICAgcmV0dXJuICEhKHdpbmRvdy5IICYmIHdpbmRvdy5ILnNlcnZpY2UpO1xyXG4gICAgfVxyXG5cclxuICAgIGZ1bmN0aW9uIF9pc1VJTG9hZGVkKCkge1xyXG4gICAgICAgIHJldHVybiAhISh3aW5kb3cuSCAmJiB3aW5kb3cuSC51aSk7XHJcbiAgICB9XHJcblxyXG4gICAgZnVuY3Rpb24gX2lzRXZlbnRzTG9hZGVkKCkge1xyXG4gICAgICAgIHJldHVybiAhISh3aW5kb3cuSCAmJiB3aW5kb3cuSC5tYXBldmVudHMpO1xyXG4gICAgfVxyXG5cclxuICAgIGZ1bmN0aW9uIF9vbkxvYWQoc291cmNlTmFtZSkge1xyXG4gICAgICAgIHZhciBkZWZlclF1ZXVlID0gQVBJX0RFRkVSU1F1ZXVlW3NvdXJjZU5hbWVdO1xyXG4gICAgICAgIGZvciAodmFyIGkgPSAwLCBsID0gZGVmZXJRdWV1ZS5sZW5ndGg7IGkgPCBsOyArK2kpIHtcclxuICAgICAgICAgICAgdmFyIGRlZmVyID0gZGVmZXJRdWV1ZVtpXTtcclxuICAgICAgICAgICAgZGVmZXIucmVzb2x2ZSgpO1xyXG4gICAgICAgIH1cclxuXHJcbiAgICAgICAgQVBJX0RFRkVSU1F1ZXVlW3NvdXJjZU5hbWVdID0gW107XHJcbiAgICB9XHJcblxyXG4gICAgZnVuY3Rpb24gX29uRXJyb3Ioc291cmNlTmFtZSkge1xyXG4gICAgICAgIHZhciBkZWZlclF1ZXVlID0gQVBJX0RFRkVSU1F1ZXVlW3NvdXJjZU5hbWVdO1xyXG4gICAgICAgIGZvciAodmFyIGkgPSAwLCBsID0gZGVmZXJRdWV1ZS5sZW5ndGg7IGkgPCBsOyArK2kpIHtcclxuICAgICAgICAgICAgdmFyIGRlZmVyID0gZGVmZXJRdWV1ZVtpXTtcclxuICAgICAgICAgICAgZGVmZXIucmVqZWN0KCk7XHJcbiAgICAgICAgfVxyXG5cclxuICAgICAgICBBUElfREVGRVJTUXVldWVbc291cmNlTmFtZV0gPSBbXTtcclxuICAgIH1cclxuXHJcbiAgICBmdW5jdGlvbiBfaXNWYWxpZENvb3Jkcyhjb29yZHMpIHtcclxuICAgICAgICB2YXIgbG5nID0gY29vcmRzICYmIGNvb3Jkcy5sb25naXR1ZGUsXHJcbiAgICAgICAgICAgIGxhdCA9IGNvb3JkcyAmJiBjb29yZHMubGF0aXR1ZGU7XHJcblxyXG4gICAgICAgIHJldHVybiAodHlwZW9mIGxuZyA9PT0gJ251bWJlcicgfHwgdHlwZW9mIGxuZyA9PT0gJ3N0cmluZycpICYmXHJcbiAgICAgICAgICAgICh0eXBlb2YgbGF0ID09PSAnbnVtYmVyJyB8fCB0eXBlb2YgbGF0ID09PSAnc3RyaW5nJyk7XHJcbiAgICB9XHJcbn07XHJcbiIsIm1vZHVsZS5leHBvcnRzID0ge1xyXG4gICAgVVBEQVRFX01BUF9SRVNJWkVfVElNRU9VVDogNTAwLFxyXG4gICAgQU5JTUFUSU9OX1pPT01fU1RFUDogLjA1LFxyXG4gICAgTU9EVUxFUzoge1xyXG4gICAgICAgIFVJOiAnY29udHJvbHMnLFxyXG4gICAgICAgIEVWRU5UUzogJ2V2ZW50cycsXHJcbiAgICAgICAgUEFOTzogJ3Bhbm8nXHJcbiAgICB9LFxyXG4gICAgREVGQVVMVF9NQVBfT1BUSU9OUzoge1xyXG4gICAgICAgIGhlaWdodDogNDgwLFxyXG4gICAgICAgIHdpZHRoOiA2NDAsXHJcbiAgICAgICAgem9vbTogMTIsXHJcbiAgICAgICAgbWF4Wm9vbTogMixcclxuICAgICAgICByZXNpemU6IGZhbHNlLFxyXG4gICAgICAgIGRyYWdnYWJsZTogZmFsc2UsXHJcbiAgICAgICAgY29vcmRzOiB7XHJcbiAgICAgICAgICAgIGxvbmdpdHVkZTogMCxcclxuICAgICAgICAgICAgbGF0aXR1ZGU6IDBcclxuICAgICAgICB9XHJcbiAgICB9LFxyXG4gICAgTUFSS0VSX1RZUEVTOiB7XHJcbiAgICAgICAgRE9NOiBcIkRPTVwiLFxyXG4gICAgICAgIFNWRzogXCJTVkdcIlxyXG4gICAgfSxcclxuICAgIENPTlRST0xTOiB7XHJcbiAgICAgICAgTkFNRVM6IHtcclxuICAgICAgICAgICAgU0NBTEU6ICdzY2FsZWJhcicsXHJcbiAgICAgICAgICAgIFNFVFRJTkdTOiAnbWFwc2V0dGluZ3MnLFxyXG4gICAgICAgICAgICBaT09NOiAnem9vbScsXHJcbiAgICAgICAgICAgIFVTRVI6ICd1c2VycG9zaXRpb24nXHJcbiAgICAgICAgfSxcclxuICAgICAgICBQT1NJVElPTlM6IFtcclxuICAgICAgICAgICAgJ3RvcC1yaWdodCcsXHJcbiAgICAgICAgICAgICd0b3AtY2VudGVyJyxcclxuICAgICAgICAgICAgJ3RvcC1sZWZ0JyxcclxuICAgICAgICAgICAgJ2xlZnQtdG9wJyxcclxuICAgICAgICAgICAgJ2xlZnQtbWlkZGxlJyxcclxuICAgICAgICAgICAgJ2xlZnQtYm90dG9tJyxcclxuICAgICAgICAgICAgJ3JpZ2h0LXRvcCcsXHJcbiAgICAgICAgICAgICdyaWdodC1taWRkbGUnLFxyXG4gICAgICAgICAgICAncmlnaHQtYm90dG9tJyxcclxuICAgICAgICAgICAgJ2JvdHRvbS1yaWdodCcsXHJcbiAgICAgICAgICAgICdib3R0b20tY2VudGVyJyxcclxuICAgICAgICAgICAgJ2JvdHRvbS1sZWZ0J1xyXG4gICAgICAgIF1cclxuICAgIH0sXHJcbiAgICBJTkZPQlVCQkxFOiB7XHJcbiAgICAgICAgU1RBVEU6IHtcclxuICAgICAgICAgICAgT1BFTjogJ29wZW4nLFxyXG4gICAgICAgICAgICBDTE9TRUQ6ICdjbG9zZWQnXHJcbiAgICAgICAgfSxcclxuICAgICAgICBESVNQTEFZX0VWRU5UOiB7XHJcbiAgICAgICAgICAgIHBvaW50ZXJtb3ZlOiAnb25Ib3ZlcicsXHJcbiAgICAgICAgICAgIHRhcDogJ29uQ2xpY2snXHJcbiAgICAgICAgfVxyXG4gICAgfSxcclxuICAgIFVTRVJfRVZFTlRTOiB7XHJcbiAgICAgICAgdGFwOiAnY2xpY2snLFxyXG4gICAgICAgIHBvaW50ZXJtb3ZlOiAnbW91c2Vtb3ZlJyxcclxuICAgICAgICBwb2ludGVybGVhdmU6ICdtb3VzZWxlYXZlJyxcclxuICAgICAgICBwb2ludGVyZW50ZXI6ICdtb3VzZWVudGVyJyxcclxuICAgICAgICBkcmFnOiAnZHJhZycsXHJcbiAgICAgICAgZHJhZ3N0YXJ0OiAnZHJhZ3N0YXJ0JyxcclxuICAgICAgICBkcmFnZW5kOiAnZHJhZ2VuZCdcclxuICAgIH1cclxufSIsIm1vZHVsZS5leHBvcnRzID0gZnVuY3Rpb24oSGVyZU1hcHNVdGlsc1NlcnZpY2UsIEhlcmVNYXBzTWFya2VyU2VydmljZSwgSGVyZU1hcHNDT05TVFMsIEhlcmVNYXBzSW5mb0J1YmJsZUZhY3RvcnkpIHtcclxuICAgIGZ1bmN0aW9uIEV2ZW50cyhwbGF0Zm9ybSwgSW5qZWN0b3IsIGxpc3RlbmVycykge1xyXG4gICAgICAgIHRoaXMubWFwID0gcGxhdGZvcm0ubWFwO1xyXG4gICAgICAgIHRoaXMubGlzdGVuZXJzID0gbGlzdGVuZXJzO1xyXG4gICAgICAgIHRoaXMuaW5qZWN0ID0gbmV3IEluamVjdG9yKCk7XHJcbiAgICAgICAgdGhpcy5ldmVudHMgPSBwbGF0Zm9ybS5ldmVudHMgPSBuZXcgSC5tYXBldmVudHMuTWFwRXZlbnRzKHRoaXMubWFwKTtcclxuICAgICAgICB0aGlzLmJlaGF2aW9yID0gcGxhdGZvcm0uYmVoYXZpb3IgPSBuZXcgSC5tYXBldmVudHMuQmVoYXZpb3IodGhpcy5ldmVudHMpO1xyXG4gICAgICAgIHRoaXMuYnViYmxlID0gSGVyZU1hcHNJbmZvQnViYmxlRmFjdG9yeS5jcmVhdGUoKTtcclxuXHJcbiAgICAgICAgdGhpcy5zZXR1cEV2ZW50TGlzdGVuZXJzKCk7XHJcbiAgICB9XHJcblxyXG4gICAgdmFyIHByb3RvID0gRXZlbnRzLnByb3RvdHlwZTtcclxuXHJcbiAgICBwcm90by5zZXR1cEV2ZW50TGlzdGVuZXJzID0gc2V0dXBFdmVudExpc3RlbmVycztcclxuICAgIHByb3RvLnNldHVwT3B0aW9ucyA9IHNldHVwT3B0aW9ucztcclxuICAgIHByb3RvLnRyaWdnZXJVc2VyTGlzdGVuZXIgPSB0cmlnZ2VyVXNlckxpc3RlbmVyO1xyXG4gICAgcHJvdG8uaW5mb0J1YmJsZUhhbmRsZXIgPSBpbmZvQnViYmxlSGFuZGxlcjsgIFxyXG5cclxuICAgIHJldHVybiB7XHJcbiAgICAgICAgc3RhcnQ6IGZ1bmN0aW9uKGFyZ3MpIHtcclxuICAgICAgICAgICAgaWYgKCEoYXJncy5wbGF0Zm9ybS5tYXAgaW5zdGFuY2VvZiBILk1hcCkpXHJcbiAgICAgICAgICAgICAgICByZXR1cm4gY29uc29sZS5lcnJvcignTWlzc2VkIHJlcXVpcmVkIG1hcCBpbnN0YW5jZScpO1xyXG5cclxuICAgICAgICAgICAgdmFyIGV2ZW50cyA9IG5ldyBFdmVudHMoYXJncy5wbGF0Zm9ybSwgYXJncy5pbmplY3RvciwgYXJncy5saXN0ZW5lcnMpO1xyXG5cclxuICAgICAgICAgICAgYXJncy5vcHRpb25zICYmIGV2ZW50cy5zZXR1cE9wdGlvbnMoYXJncy5vcHRpb25zKTtcclxuICAgICAgICB9XHJcbiAgICB9XHJcblxyXG4gICAgZnVuY3Rpb24gc2V0dXBFdmVudExpc3RlbmVycygpIHtcclxuICAgICAgICB2YXIgc2VsZiA9IHRoaXM7XHJcblxyXG4gICAgICAgIEhlcmVNYXBzVXRpbHNTZXJ2aWNlLmFkZEV2ZW50TGlzdGVuZXIodGhpcy5tYXAsICd0YXAnLCB0aGlzLmluZm9CdWJibGVIYW5kbGVyLmJpbmQodGhpcykpO1xyXG5cclxuICAgICAgICBIZXJlTWFwc1V0aWxzU2VydmljZS5hZGRFdmVudExpc3RlbmVyKHRoaXMubWFwLCAncG9pbnRlcm1vdmUnLCB0aGlzLmluZm9CdWJibGVIYW5kbGVyLmJpbmQodGhpcykpO1xyXG5cclxuICAgICAgICBIZXJlTWFwc1V0aWxzU2VydmljZS5hZGRFdmVudExpc3RlbmVyKHRoaXMubWFwLCAnZHJhZ3N0YXJ0JywgZnVuY3Rpb24oZSkge1xyXG4gICAgICAgICAgICBpZiAoSGVyZU1hcHNNYXJrZXJTZXJ2aWNlLmlzTWFya2VySW5zdGFuY2UoZS50YXJnZXQpKSB7XHJcbiAgICAgICAgICAgICAgICBzZWxmLmJlaGF2aW9yLmRpc2FibGUoKTtcclxuICAgICAgICAgICAgfVxyXG5cclxuICAgICAgICAgICAgc2VsZi50cmlnZ2VyVXNlckxpc3RlbmVyKEhlcmVNYXBzQ09OU1RTLlVTRVJfRVZFTlRTW2UudHlwZV0sIGUpO1xyXG4gICAgICAgIH0pO1xyXG5cclxuICAgICAgICBIZXJlTWFwc1V0aWxzU2VydmljZS5hZGRFdmVudExpc3RlbmVyKHRoaXMubWFwLCAnZHJhZycsIGZ1bmN0aW9uKGUpIHtcclxuICAgICAgICAgICAgdmFyIHBvaW50ZXIgPSBlLmN1cnJlbnRQb2ludGVyLFxyXG4gICAgICAgICAgICAgICAgdGFyZ2V0ID0gZS50YXJnZXQ7XHJcblxyXG4gICAgICAgICAgICBpZiAoSGVyZU1hcHNNYXJrZXJTZXJ2aWNlLmlzTWFya2VySW5zdGFuY2UodGFyZ2V0KSkge1xyXG4gICAgICAgICAgICAgICAgdGFyZ2V0LnNldFBvc2l0aW9uKHNlbGYubWFwLnNjcmVlblRvR2VvKHBvaW50ZXIudmlld3BvcnRYLCBwb2ludGVyLnZpZXdwb3J0WSkpO1xyXG4gICAgICAgICAgICB9XHJcblxyXG4gICAgICAgICAgICBzZWxmLnRyaWdnZXJVc2VyTGlzdGVuZXIoSGVyZU1hcHNDT05TVFMuVVNFUl9FVkVOVFNbZS50eXBlXSwgZSk7XHJcbiAgICAgICAgfSk7XHJcblxyXG4gICAgICAgIEhlcmVNYXBzVXRpbHNTZXJ2aWNlLmFkZEV2ZW50TGlzdGVuZXIodGhpcy5tYXAsICdkcmFnZW5kJywgZnVuY3Rpb24oZSkge1xyXG4gICAgICAgICAgICBpZiAoSGVyZU1hcHNNYXJrZXJTZXJ2aWNlLmlzTWFya2VySW5zdGFuY2UoZS50YXJnZXQpKSB7XHJcbiAgICAgICAgICAgICAgICBzZWxmLmJlaGF2aW9yLmVuYWJsZSgpO1xyXG4gICAgICAgICAgICB9XHJcblxyXG4gICAgICAgICAgICBzZWxmLnRyaWdnZXJVc2VyTGlzdGVuZXIoSGVyZU1hcHNDT05TVFMuVVNFUl9FVkVOVFNbZS50eXBlXSwgZSk7XHJcbiAgICAgICAgfSk7XHJcbiAgICB9XHJcblxyXG4gICAgZnVuY3Rpb24gc2V0dXBPcHRpb25zKG9wdGlvbnMpIHtcclxuICAgICAgICBpZiAoIW9wdGlvbnMpXHJcbiAgICAgICAgICAgIHJldHVybjtcclxuXHJcbiAgICAgICAgdGhpcy5tYXAuZHJhZ2dhYmxlID0gISFvcHRpb25zLmRyYWdnYWJsZTtcclxuICAgIH1cclxuXHJcbiAgICBmdW5jdGlvbiB0cmlnZ2VyVXNlckxpc3RlbmVyKGV2ZW50TmFtZSwgZSkge1xyXG4gICAgICAgIGlmICghdGhpcy5saXN0ZW5lcnMpXHJcbiAgICAgICAgICAgIHJldHVybjtcclxuXHJcbiAgICAgICAgdmFyIGNhbGxiYWNrID0gdGhpcy5saXN0ZW5lcnNbZXZlbnROYW1lXTtcclxuXHJcbiAgICAgICAgY2FsbGJhY2sgJiYgY2FsbGJhY2soZSk7XHJcbiAgICB9XHJcbiAgICBcclxuICAgIGZ1bmN0aW9uIGluZm9CdWJibGVIYW5kbGVyKGUpe1xyXG4gICAgICAgIHZhciB1aSA9IHRoaXMuaW5qZWN0KCd1aScpO1xyXG4gICAgICAgIFxyXG4gICAgICAgIGlmKHVpKVxyXG4gICAgICAgICAgICB0aGlzLmJ1YmJsZS50b2dnbGUoZSwgdWkpO1xyXG4gICAgICAgICAgICBcclxuICAgICAgICB0aGlzLnRyaWdnZXJVc2VyTGlzdGVuZXIoSGVyZU1hcHNDT05TVFMuVVNFUl9FVkVOVFNbZS50eXBlXSwgZSk7ICAgICAgXHJcbiAgICB9XHJcblxyXG59OyIsIm1vZHVsZS5leHBvcnRzID0gZnVuY3Rpb24oSGVyZU1hcHNNYXJrZXJTZXJ2aWNlLCBIZXJlTWFwc1V0aWxzU2VydmljZSwgSGVyZU1hcHNDT05TVFMpIHtcclxuICAgIGZ1bmN0aW9uIEluZm9CdWJibGUoKSB7fVxyXG5cclxuICAgIHZhciBwcm90byA9IEluZm9CdWJibGUucHJvdG90eXBlO1xyXG4gICAgICAgIFxyXG4gICAgcHJvdG8uY3JlYXRlID0gY3JlYXRlO1xyXG4gICAgcHJvdG8udXBkYXRlID0gdXBkYXRlO1xyXG4gICAgcHJvdG8udG9nZ2xlID0gdG9nZ2xlO1xyXG4gICAgcHJvdG8uc2hvdyA9IHNob3c7XHJcbiAgICBwcm90by5jbG9zZSA9IGNsb3NlO1xyXG5cclxuICAgIHJldHVybiB7XHJcbiAgICAgICAgY3JlYXRlOiBmdW5jdGlvbigpe1xyXG4gICAgICAgICAgICByZXR1cm4gbmV3IEluZm9CdWJibGUoKTtcclxuICAgICAgICB9XHJcbiAgICB9XHJcblxyXG4gICAgZnVuY3Rpb24gdG9nZ2xlKGUsIHVpKSB7XHJcbiAgICAgICAgaWYgKEhlcmVNYXBzTWFya2VyU2VydmljZS5pc01hcmtlckluc3RhbmNlKGUudGFyZ2V0KSlcclxuICAgICAgICAgICAgdGhpcy5zaG93KGUsIHVpKTtcclxuICAgICAgICBlbHNlXHJcbiAgICAgICAgICAgIHRoaXMuY2xvc2UoZSwgdWkpO1xyXG4gICAgfVxyXG5cclxuICAgIGZ1bmN0aW9uIHVwZGF0ZShidWJibGUsIGRhdGEpIHtcclxuICAgICAgICBidWJibGUuZGlzcGxheSA9IGRhdGEuZGlzcGxheTtcclxuXHJcbiAgICAgICAgYnViYmxlLnNldFBvc2l0aW9uKGRhdGEucG9zaXRpb24pO1xyXG4gICAgICAgIGJ1YmJsZS5zZXRDb250ZW50KGRhdGEubWFya3VwKTtcclxuXHJcbiAgICAgICAgYnViYmxlLnNldFN0YXRlKEhlcmVNYXBzQ09OU1RTLklORk9CVUJCTEUuU1RBVEUuT1BFTik7XHJcbiAgICB9XHJcblxyXG4gICAgZnVuY3Rpb24gY3JlYXRlKHNvdXJjZSkge1xyXG4gICAgICAgIHZhciBidWJibGUgPSBuZXcgSC51aS5JbmZvQnViYmxlKHNvdXJjZS5wb3NpdGlvbiwge1xyXG4gICAgICAgICAgICBjb250ZW50OiBzb3VyY2UubWFya3VwXHJcbiAgICAgICAgfSk7XHJcblxyXG4gICAgICAgIGJ1YmJsZS5kaXNwbGF5ID0gc291cmNlLmRpc3BsYXk7XHJcbiAgICAgICAgYnViYmxlLmFkZENsYXNzKEhlcmVNYXBzQ09OU1RTLklORk9CVUJCTEUuU1RBVEUuT1BFTilcclxuXHJcbiAgICAgICAgSGVyZU1hcHNVdGlsc1NlcnZpY2UuYWRkRXZlbnRMaXN0ZW5lcihidWJibGUsICdzdGF0ZWNoYW5nZScsIGZ1bmN0aW9uKGUpIHtcclxuICAgICAgICAgICAgdmFyIHN0YXRlID0gdGhpcy5nZXRTdGF0ZSgpLFxyXG4gICAgICAgICAgICAgICAgZWwgPSB0aGlzLmdldEVsZW1lbnQoKTtcclxuICAgICAgICAgICAgaWYgKHN0YXRlID09PSBIZXJlTWFwc0NPTlNUUy5JTkZPQlVCQkxFLlNUQVRFLkNMT1NFRCkge1xyXG4gICAgICAgICAgICAgICAgZWwuY2xhc3NMaXN0LnJlbW92ZShIZXJlTWFwc0NPTlNUUy5JTkZPQlVCQkxFLlNUQVRFLk9QRU4pO1xyXG4gICAgICAgICAgICB9IGVsc2VcclxuICAgICAgICAgICAgICAgIHRoaXMuYWRkQ2xhc3Moc3RhdGUpXHJcbiAgICAgICAgfSk7XHJcblxyXG4gICAgICAgIHJldHVybiBidWJibGU7XHJcbiAgICB9XHJcblxyXG4gICAgZnVuY3Rpb24gc2hvdyhlLCB1aSwgZGF0YSkge1xyXG4gICAgICAgIHZhciB0YXJnZXQgPSBlLnRhcmdldCxcclxuICAgICAgICAgICAgZGF0YSA9IHRhcmdldC5nZXREYXRhKCksXHJcbiAgICAgICAgICAgIGVsID0gbnVsbDtcclxuXHJcbiAgICAgICAgaWYgKCFkYXRhIHx8ICFkYXRhLmRpc3BsYXkgfHwgIWRhdGEubWFya3VwIHx8IGRhdGEuZGlzcGxheSAhPT0gSGVyZU1hcHNDT05TVFMuSU5GT0JVQkJMRS5ESVNQTEFZX0VWRU5UW2UudHlwZV0pXHJcbiAgICAgICAgICAgIHJldHVybjtcclxuXHJcbiAgICAgICAgdmFyIHNvdXJjZSA9IHtcclxuICAgICAgICAgICAgcG9zaXRpb246IHRhcmdldC5nZXRQb3NpdGlvbigpLFxyXG4gICAgICAgICAgICBtYXJrdXA6IGRhdGEubWFya3VwLFxyXG4gICAgICAgICAgICBkaXNwbGF5OiBkYXRhLmRpc3BsYXlcclxuICAgICAgICB9O1xyXG5cclxuICAgICAgICBpZiAoIXVpLmJ1YmJsZSkge1xyXG4gICAgICAgICAgICB1aS5idWJibGUgPSB0aGlzLmNyZWF0ZShzb3VyY2UpO1xyXG4gICAgICAgICAgICB1aS5hZGRCdWJibGUodWkuYnViYmxlKTtcclxuXHJcbiAgICAgICAgICAgIHJldHVybjtcclxuICAgICAgICB9XHJcblxyXG4gICAgICAgIHRoaXMudXBkYXRlKHVpLmJ1YmJsZSwgc291cmNlKTtcclxuICAgIH1cclxuXHJcbiAgICBmdW5jdGlvbiBjbG9zZShlLCB1aSkge1xyXG4gICAgICAgIGlmICghdWkuYnViYmxlIHx8IHVpLmJ1YmJsZS5kaXNwbGF5ICE9PSBIZXJlTWFwc0NPTlNUUy5JTkZPQlVCQkxFLkRJU1BMQVlfRVZFTlRbZS50eXBlXSkge1xyXG4gICAgICAgICAgICByZXR1cm47XHJcbiAgICAgICAgfVxyXG5cclxuICAgICAgICB1aS5idWJibGUuc2V0U3RhdGUoSGVyZU1hcHNDT05TVFMuSU5GT0JVQkJMRS5TVEFURS5DTE9TRUQpO1xyXG4gICAgfVxyXG59IiwiYW5ndWxhci5tb2R1bGUoJ2hlcmVtYXBzLWV2ZW50cy1tb2R1bGUnLCBbXSlcclxuICAgIC5mYWN0b3J5KCdIZXJlTWFwc0V2ZW50c0ZhY3RvcnknLCByZXF1aXJlKCcuL2V2ZW50cy9ldmVudHMuanMnKSlcclxuICAgIC5mYWN0b3J5KCdIZXJlTWFwc0luZm9CdWJibGVGYWN0b3J5JywgcmVxdWlyZSgnLi9ldmVudHMvaW5mb2J1YmJsZS5qcycpKTtcclxuICAgIFxyXG5hbmd1bGFyLm1vZHVsZSgnaGVyZW1hcHMtdWktbW9kdWxlJywgW10pXHJcbiAgICAuZmFjdG9yeSgnSGVyZU1hcHNVaUZhY3RvcnknLCByZXF1aXJlKCcuL3VpL3VpLmpzJykpXHJcblxyXG5tb2R1bGUuZXhwb3J0cyA9IGFuZ3VsYXIubW9kdWxlKCdoZXJlbWFwcy1tYXAtbW9kdWxlcycsIFtcclxuXHQnaGVyZW1hcHMtZXZlbnRzLW1vZHVsZScsXHJcbiAgICAnaGVyZW1hcHMtdWktbW9kdWxlJ1xyXG5dKTsiLCJtb2R1bGUuZXhwb3J0cyA9IGZ1bmN0aW9uKEhlcmVNYXBzQVBJU2VydmljZSwgSGVyZU1hcHNNYXJrZXJTZXJ2aWNlLCBIZXJlTWFwc1V0aWxzU2VydmljZSwgSGVyZU1hcHNDT05TVFMpIHtcclxuICAgIGZ1bmN0aW9uIFVJKHBsYXRmb3JtLCBhbGlnbm1lbnQpIHtcclxuICAgICAgICB0aGlzLm1hcCA9IHBsYXRmb3JtLm1hcDtcclxuICAgICAgICB0aGlzLmxheWVycyA9IHBsYXRmb3JtLmxheWVycztcclxuICAgICAgICB0aGlzLmFsaWdubWVudCA9IGFsaWdubWVudDtcclxuICAgICAgICB0aGlzLnVpID0gcGxhdGZvcm0udWkgPSBILnVpLlVJLmNyZWF0ZURlZmF1bHQodGhpcy5tYXAsIHRoaXMubGF5ZXJzKTtcclxuXHJcbiAgICAgICAgdGhpcy5zZXR1cENvbnRyb2xzKCk7XHJcbiAgICB9XHJcblxyXG4gICAgVUkuaXNWYWxpZEFsaWdubWVudCA9IGlzVmFsaWRBbGlnbm1lbnQ7XHJcblxyXG4gICAgdmFyIHByb3RvID0gVUkucHJvdG90eXBlO1xyXG5cclxuICAgIHByb3RvLnNldHVwQ29udHJvbHMgPSBzZXR1cENvbnRyb2xzO1xyXG4gICAgcHJvdG8uY3JlYXRlVXNlckNvbnRyb2wgPSBjcmVhdGVVc2VyQ29udHJvbDtcclxuICAgIHByb3RvLnNldENvbnRyb2xzQWxpZ25tZW50ID0gc2V0Q29udHJvbHNBbGlnbm1lbnQ7XHJcblxyXG4gICAgcmV0dXJuIHtcclxuICAgICAgICBzdGFydDogZnVuY3Rpb24oYXJncykge1xyXG4gICAgICAgICAgICBpZiAoIShhcmdzLnBsYXRmb3JtLm1hcCBpbnN0YW5jZW9mIEguTWFwKSAmJiAhKGFyZ3MucGxhdGZvcm0ubGF5ZXJzKSlcclxuICAgICAgICAgICAgICAgIHJldHVybiBjb25zb2xlLmVycm9yKCdNaXNzZWQgdWkgbW9kdWxlIGRlcGVuZGVuY2llcycpO1xyXG5cclxuICAgICAgICAgICAgdmFyIHVpID0gbmV3IFVJKGFyZ3MucGxhdGZvcm0sIGFyZ3MuYWxpZ25tZW50KTtcclxuICAgICAgICB9XHJcbiAgICB9XHJcblxyXG4gICAgZnVuY3Rpb24gc2V0dXBDb250cm9scygpIHtcclxuICAgICAgICB2YXIgTkFNRVMgPSBIZXJlTWFwc0NPTlNUUy5DT05UUk9MUy5OQU1FUyxcclxuICAgICAgICAgICAgdXNlckNvbnRyb2wgPSB0aGlzLmNyZWF0ZVVzZXJDb250cm9sKCk7XHJcblxyXG4gICAgICAgIHRoaXMudWkuZ2V0Q29udHJvbChOQU1FUy5TRVRUSU5HUykuc2V0SW5jaWRlbnRzTGF5ZXIoZmFsc2UpO1xyXG4gICAgICAgIHRoaXMudWkuYWRkQ29udHJvbChOQU1FUy5VU0VSLCB1c2VyQ29udHJvbCk7XHJcbiAgICAgICAgdGhpcy5zZXRDb250cm9sc0FsaWdubWVudChOQU1FUyk7XHJcbiAgICB9XHJcblxyXG4gICAgZnVuY3Rpb24gY3JlYXRlVXNlckNvbnRyb2woKSB7XHJcbiAgICAgICAgdmFyIHNlbGYgPSB0aGlzLFxyXG4gICAgICAgICAgICB1c2VyQ29udHJvbCA9IG5ldyBILnVpLkNvbnRyb2woKSxcclxuICAgICAgICAgICAgbWFya3VwID0gJzxzdmcgY2xhc3M9XCJIX2ljb25cIiBmaWxsPVwiI2ZmZlwiIHhtbG5zPVwiaHR0cDovL3d3dy53My5vcmcvMjAwMC9zdmdcIiB3aWR0aD1cIjE2XCIgaGVpZ2h0PVwiMTZcIiB2aWV3Qm94PVwiMCAwIDE2IDE2XCI+PHBhdGggY2xhc3M9XCJtaWRkbGVfbG9jYXRpb25fc3Ryb2tlXCIgZD1cIk04IDEyYy0yLjIwNiAwLTQtMS43OTUtNC00IDAtMi4yMDYgMS43OTQtNCA0LTRzNCAxLjc5NCA0IDRjMCAyLjIwNS0xLjc5NCA0LTQgNE04IDEuMjVhNi43NSA2Ljc1IDAgMSAwIDAgMTMuNSA2Ljc1IDYuNzUgMCAwIDAgMC0xMy41XCI+PC9wYXRoPjxwYXRoIGNsYXNzPVwiaW5uZXJfbG9jYXRpb25fc3Ryb2tlXCIgZD1cIk04IDVhMyAzIDAgMSAxIC4wMDEgNkEzIDMgMCAwIDEgOCA1bTAtMUM1Ljc5NCA0IDQgNS43OTQgNCA4YzAgMi4yMDUgMS43OTQgNCA0IDRzNC0xLjc5NSA0LTRjMC0yLjIwNi0xLjc5NC00LTQtNFwiPjwvcGF0aD48cGF0aCBjbGFzcz1cIm91dGVyX2xvY2F0aW9uX3N0cm9rZVwiIGQ9XCJNOCAxLjI1YTYuNzUgNi43NSAwIDEgMSAwIDEzLjUgNi43NSA2Ljc1IDAgMCAxIDAtMTMuNU04IDBDMy41OSAwIDAgMy41OSAwIDhjMCA0LjQxMSAzLjU5IDggOCA4czgtMy41ODkgOC04YzAtNC40MS0zLjU5LTgtOC04XCI+PC9wYXRoPjwvc3ZnPic7XHJcblxyXG4gICAgICAgIHZhciB1c2VyQ29udHJvbEJ1dHRvbiA9IG5ldyBILnVpLmJhc2UuQnV0dG9uKHtcclxuICAgICAgICAgICAgbGFiZWw6IG1hcmt1cCxcclxuICAgICAgICAgICAgb25TdGF0ZUNoYW5nZTogZnVuY3Rpb24oZXZ0KSB7XHJcbiAgICAgICAgICAgICAgICBpZiAodXNlckNvbnRyb2xCdXR0b24uZ2V0U3RhdGUoKSA9PT0gSC51aS5iYXNlLkJ1dHRvbi5TdGF0ZS5ET1dOKVxyXG4gICAgICAgICAgICAgICAgICAgIHJldHVybjtcclxuXHJcbiAgICAgICAgICAgICAgICBIZXJlTWFwc0FQSVNlcnZpY2UuZ2V0UG9zaXRpb24oKS50aGVuKGZ1bmN0aW9uKHJlc3BvbnNlKSB7XHJcbiAgICAgICAgICAgICAgICAgICAgdmFyIHBvc2l0aW9uID0ge1xyXG4gICAgICAgICAgICAgICAgICAgICAgICBsbmc6IHJlc3BvbnNlLmNvb3Jkcy5sb25naXR1ZGUsXHJcbiAgICAgICAgICAgICAgICAgICAgICAgIGxhdDogcmVzcG9uc2UuY29vcmRzLmxhdGl0dWRlXHJcbiAgICAgICAgICAgICAgICAgICAgfTtcclxuICAgICAgICAgICAgICAgICAgICBcclxuICAgICAgICAgICAgICAgICAgICBzZWxmLm1hcC5zZXRDZW50ZXIocG9zaXRpb24pO1xyXG4gICAgICAgICAgICAgICAgICAgIFxyXG4gICAgICAgICAgICAgICAgICAgIEhlcmVNYXBzVXRpbHNTZXJ2aWNlLnpvb20oc2VsZi5tYXAsIDE3LCAuMDgpO1xyXG5cclxuICAgICAgICAgICAgICAgICAgICBpZiAoc2VsZi51c2VyTWFya2VyKSB7XHJcbiAgICAgICAgICAgICAgICAgICAgICAgIHNlbGYudXNlck1hcmtlci5zZXRQb3NpdGlvbihwb3NpdGlvbik7XHJcbiAgICAgICAgICAgICAgICAgICAgICAgIHJldHVybjtcclxuICAgICAgICAgICAgICAgICAgICB9XHJcbiAgICAgICAgICAgICAgICAgICAgXHJcbiAgICAgICAgICAgICAgICAgICAgc2VsZi51c2VyTWFya2VyID0gSGVyZU1hcHNNYXJrZXJTZXJ2aWNlLmFkZFVzZXJNYXJrZXIoc2VsZi5tYXAsIHtcclxuICAgICAgICAgICAgICAgICAgICAgICAgcG9zOiBwb3NpdGlvblxyXG4gICAgICAgICAgICAgICAgICAgIH0pO1xyXG4gICAgICAgICAgICAgICAgfSk7XHJcbiAgICAgICAgICAgIH1cclxuICAgICAgICB9KTtcclxuXHJcbiAgICAgICAgdXNlckNvbnRyb2wuYWRkQ2hpbGQodXNlckNvbnRyb2xCdXR0b24pO1xyXG5cclxuICAgICAgICByZXR1cm4gdXNlckNvbnRyb2w7XHJcbiAgICB9XHJcblxyXG4gICAgZnVuY3Rpb24gc2V0Q29udHJvbHNBbGlnbm1lbnQoTkFNRVMpIHtcclxuICAgICAgICBpZiAoIVVJLmlzVmFsaWRBbGlnbm1lbnQodGhpcy5hbGlnbm1lbnQpKVxyXG4gICAgICAgICAgICByZXR1cm47XHJcblxyXG4gICAgICAgIGZvciAodmFyIGlkIGluIE5BTUVTKSB7XHJcbiAgICAgICAgICAgIHZhciBjb250cm9sID0gdGhpcy51aS5nZXRDb250cm9sKE5BTUVTW2lkXSk7XHJcblxyXG4gICAgICAgICAgICBpZiAoIU5BTUVTLmhhc093blByb3BlcnR5KGlkKSB8fCAhY29udHJvbClcclxuICAgICAgICAgICAgICAgIGNvbnRpbnVlO1xyXG5cclxuICAgICAgICAgICAgY29udHJvbC5zZXRBbGlnbm1lbnQodGhpcy5hbGlnbm1lbnQpO1xyXG4gICAgICAgIH1cclxuICAgIH1cclxuXHJcbiAgICBmdW5jdGlvbiBpc1ZhbGlkQWxpZ25tZW50KGFsaWdubWVudCkge1xyXG4gICAgICAgIHJldHVybiAhIShIZXJlTWFwc0NPTlNUUy5DT05UUk9MUy5QT1NJVElPTlMuaW5kZXhPZihhbGlnbm1lbnQpICsgMSk7XHJcbiAgICB9XHJcblxyXG59OyIsIm1vZHVsZS5leHBvcnRzID0gZnVuY3Rpb24oKSB7XHJcbiAgICB2YXIgb3B0aW9ucyA9IHt9O1xyXG4gICAgdmFyIERFRkFVTFRfQVBJX1ZFUlNJT04gPSBcIjMuMFwiO1xyXG5cclxuICAgIHRoaXMuJGdldCA9IGZ1bmN0aW9uKCl7XHJcbiAgICAgICAgcmV0dXJuIHtcclxuICAgICAgICAgICAgYXBwX2lkOiBvcHRpb25zLmFwcF9pZCxcclxuICAgICAgICAgICAgYXBwX2NvZGU6IG9wdGlvbnMuYXBwX2NvZGUsXHJcbiAgICAgICAgICAgIGFwaVZlcnNpb246IG9wdGlvbnMuYXBpVmVyc2lvbiB8fCBERUZBVUxUX0FQSV9WRVJTSU9OLFxyXG4gICAgICAgICAgICB1c2VIVFRQUzogb3B0aW9ucy51c2VIVFRQUyxcclxuICAgICAgICAgICAgdXNlQ0lUOiAhIW9wdGlvbnMudXNlQ0lUXHJcbiAgICAgICAgfVxyXG4gICAgfTtcclxuXHJcbiAgICB0aGlzLnNldE9wdGlvbnMgPSBmdW5jdGlvbihvcHRzKXtcclxuICAgICAgICBvcHRpb25zID0gb3B0cztcclxuICAgIH07XHJcbn07IiwibW9kdWxlLmV4cG9ydHMgPSBmdW5jdGlvbiAoJHJvb3RTY29wZSwgJHRpbWVvdXQsIEhlcmVNYXBzQ09OU1RTKSB7XHJcbiAgICByZXR1cm4ge1xyXG4gICAgICAgIHRocm90dGxlOiB0aHJvdHRsZSxcclxuICAgICAgICBjcmVhdGVTY3JpcHRUYWc6IGNyZWF0ZVNjcmlwdFRhZyxcclxuICAgICAgICBjcmVhdGVMaW5rVGFnOiBjcmVhdGVMaW5rVGFnLFxyXG4gICAgICAgIHJ1blNjb3BlRGlnZXN0SWZOZWVkOiBydW5TY29wZURpZ2VzdElmTmVlZCxcclxuICAgICAgICBpc1ZhbGlkQ29vcmRzOiBpc1ZhbGlkQ29vcmRzLFxyXG4gICAgICAgIGFkZEV2ZW50TGlzdGVuZXI6IGFkZEV2ZW50TGlzdGVuZXIsXHJcbiAgICAgICAgem9vbTogem9vbSxcclxuICAgICAgICBnZW5lcmF0ZUlkOiBnZW5lcmF0ZUlkXHJcbiAgICB9O1xyXG5cclxuICAgIC8vI3JlZ2lvbiBQVUJMSUNcclxuICAgIGZ1bmN0aW9uIHRocm90dGxlKGZuLCBwZXJpb2QpIHtcclxuICAgICAgICB2YXIgdGltZW91dCA9IG51bGw7XHJcblxyXG4gICAgICAgIHJldHVybiBmdW5jdGlvbiAoKSB7XHJcbiAgICAgICAgICAgIGlmICgkdGltZW91dClcclxuICAgICAgICAgICAgICAgICR0aW1lb3V0LmNhbmNlbCh0aW1lb3V0KTtcclxuXHJcbiAgICAgICAgICAgIHRpbWVvdXQgPSAkdGltZW91dChmbiwgcGVyaW9kKTtcclxuICAgICAgICB9XHJcbiAgICB9XHJcblxyXG4gICAgZnVuY3Rpb24gYWRkRXZlbnRMaXN0ZW5lcihvYmosIGV2ZW50TmFtZSwgbGlzdGVuZXIsIHVzZUNhcHR1cmUpIHtcclxuICAgICAgICB2YXIgX3VzZUNhcHR1cmUgPSAhIXVzZUNhcHR1cmU7XHJcblxyXG4gICAgICAgIG9iai5hZGRFdmVudExpc3RlbmVyKGV2ZW50TmFtZSwgbGlzdGVuZXIsIF91c2VDYXB0dXJlKTtcclxuICAgIH1cclxuXHJcbiAgICBmdW5jdGlvbiBydW5TY29wZURpZ2VzdElmTmVlZChzY29wZSwgY2IpIHtcclxuICAgICAgICBpZiAoc2NvcGUuJHJvb3QgJiYgc2NvcGUuJHJvb3QuJCRwaGFzZSAhPT0gJyRhcHBseScgJiYgc2NvcGUuJHJvb3QuJCRwaGFzZSAhPT0gJyRkaWdlc3QnKSB7XHJcbiAgICAgICAgICAgIHNjb3BlLiRkaWdlc3QoY2IgfHwgYW5ndWxhci5ub29wKTtcclxuICAgICAgICAgICAgcmV0dXJuIHRydWU7XHJcbiAgICAgICAgfVxyXG4gICAgICAgIHJldHVybiBmYWxzZTtcclxuICAgIH1cclxuXHJcbiAgICBmdW5jdGlvbiBjcmVhdGVTY3JpcHRUYWcoYXR0cnMpIHtcclxuICAgICAgICB2YXIgc2NyaXB0ID0gZG9jdW1lbnQuZ2V0RWxlbWVudEJ5SWQoYXR0cnMuc3JjKTtcclxuXHJcbiAgICAgICAgaWYgKHNjcmlwdClcclxuICAgICAgICAgICAgcmV0dXJuIGZhbHNlO1xyXG5cclxuICAgICAgICBzY3JpcHQgPSBkb2N1bWVudC5jcmVhdGVFbGVtZW50KCdzY3JpcHQnKTtcclxuICAgICAgICBzY3JpcHQudHlwZSA9ICd0ZXh0L2phdmFzY3JpcHQnO1xyXG4gICAgICAgIHNjcmlwdC5pZCA9IGF0dHJzLnNyYztcclxuICAgICAgICBfc2V0QXR0cnMoc2NyaXB0LCBhdHRycyk7XHJcblxyXG4gICAgICAgIHJldHVybiBzY3JpcHQ7XHJcbiAgICB9XHJcblxyXG4gICAgZnVuY3Rpb24gY3JlYXRlTGlua1RhZyhhdHRycykge1xyXG4gICAgICAgIHZhciBsaW5rID0gZG9jdW1lbnQuZ2V0RWxlbWVudEJ5SWQoYXR0cnMuaHJlZik7XHJcblxyXG4gICAgICAgIGlmIChsaW5rKVxyXG4gICAgICAgICAgICByZXR1cm4gZmFsc2U7XHJcblxyXG4gICAgICAgIGxpbmsgPSBkb2N1bWVudC5jcmVhdGVFbGVtZW50KCdsaW5rJyk7XHJcbiAgICAgICAgbGluay5pZCA9IGF0dHJzLmhyZWY7XHJcbiAgICAgICAgX3NldEF0dHJzKGxpbmssIGF0dHJzKTtcclxuXHJcbiAgICAgICAgcmV0dXJuIGxpbms7XHJcbiAgICB9XHJcblxyXG4gICAgZnVuY3Rpb24gaXNWYWxpZENvb3Jkcyhjb29yZHMpIHtcclxuICAgICAgICByZXR1cm4gY29vcmRzICYmXHJcbiAgICAgICAgICAgICh0eXBlb2YgY29vcmRzLmxhdGl0dWRlID09PSAnc3RyaW5nJyB8fCB0eXBlb2YgY29vcmRzLmxhdGl0dWRlID09PSAnbnVtYmVyJykgJiZcclxuICAgICAgICAgICAgKHR5cGVvZiBjb29yZHMubG9uZ2l0dWRlID09PSAnc3RyaW5nJyB8fCB0eXBlb2YgY29vcmRzLmxvbmdpdHVkZSA9PT0gJ251bWJlcicpXHJcbiAgICB9XHJcblxyXG4gICAgZnVuY3Rpb24gem9vbShtYXAsIHZhbHVlLCBzdGVwKSB7XHJcbiAgICAgICAgdmFyIGN1cnJlbnRab29tID0gbWFwLmdldFpvb20oKSxcclxuICAgICAgICAgICAgX3N0ZXAgPSBzdGVwIHx8IEhlcmVNYXBzQ09OU1RTLkFOSU1BVElPTl9aT09NX1NURVAsXHJcbiAgICAgICAgICAgIGZhY3RvciA9IGN1cnJlbnRab29tID49IHZhbHVlID8gLTEgOiAxLFxyXG4gICAgICAgICAgICBpbmNyZW1lbnQgPSBzdGVwICogZmFjdG9yO1xyXG5cclxuICAgICAgICByZXR1cm4gKGZ1bmN0aW9uIHpvb20oKSB7XHJcbiAgICAgICAgICAgIGlmICghc3RlcCB8fCBNYXRoLmZsb29yKGN1cnJlbnRab29tKSA9PT0gTWF0aC5mbG9vcih2YWx1ZSkpIHtcclxuICAgICAgICAgICAgICAgIG1hcC5zZXRab29tKHZhbHVlKTtcclxuICAgICAgICAgICAgICAgIHJldHVybjtcclxuICAgICAgICAgICAgfVxyXG5cclxuICAgICAgICAgICAgY3VycmVudFpvb20gKz0gaW5jcmVtZW50O1xyXG4gICAgICAgICAgICBtYXAuc2V0Wm9vbShjdXJyZW50Wm9vbSk7XHJcblxyXG4gICAgICAgICAgICByZXF1ZXN0QW5pbWF0aW9uRnJhbWUoem9vbSk7XHJcbiAgICAgICAgfSkoKTtcclxuICAgIH1cclxuXHJcbiAgICBmdW5jdGlvbiBnZW5lcmF0ZUlkKCkge1xyXG4gICAgICAgIHZhciBtYXNrID0gJ3h4eHh4eHh4LXh4eHgtNHh4eC15eHh4LXh4eHh4eHh4eHh4eCcsXHJcbiAgICAgICAgICAgIHJlZ2V4cCA9IC9beHldL2csXHJcbiAgICAgICAgICAgIGQgPSBuZXcgRGF0ZSgpLmdldFRpbWUoKSxcclxuICAgICAgICAgICAgdXVpZCA9IG1hc2sucmVwbGFjZShyZWdleHAsIGZ1bmN0aW9uIChjKSB7XHJcbiAgICAgICAgICAgICAgICB2YXIgciA9IChkICsgTWF0aC5yYW5kb20oKSAqIDE2KSAlIDE2IHwgMDtcclxuICAgICAgICAgICAgICAgIGQgPSBNYXRoLmZsb29yKGQgLyAxNik7XHJcbiAgICAgICAgICAgIHJldHVybiAoYyA9PSAneCcgPyByIDogKHIgJiAweDMgfCAweDgpKS50b1N0cmluZygxNik7XHJcbiAgICAgICAgfSk7XHJcbiAgICAgICAgXHJcbiAgICAgICAgcmV0dXJuIHV1aWQ7XHJcbiAgICB9XHJcblxyXG4gICAgLy8jZW5kcmVnaW9uIFBVQkxJQyBcclxuXHJcbiAgICBmdW5jdGlvbiBfc2V0QXR0cnMoZWwsIGF0dHJzKSB7XHJcbiAgICAgICAgaWYgKCFlbCB8fCAhYXR0cnMpXHJcbiAgICAgICAgICAgIHRocm93IG5ldyBFcnJvcignTWlzc2VkIGF0dHJpYnV0ZXMnKTtcclxuXHJcbiAgICAgICAgZm9yICh2YXIga2V5IGluIGF0dHJzKSB7XHJcbiAgICAgICAgICAgIGlmICghYXR0cnMuaGFzT3duUHJvcGVydHkoa2V5KSlcclxuICAgICAgICAgICAgICAgIGNvbnRpbnVlO1xyXG5cclxuICAgICAgICAgICAgZWxba2V5XSA9IGF0dHJzW2tleV07XHJcbiAgICAgICAgfVxyXG4gICAgfVxyXG59OyIsIm1vZHVsZS5leHBvcnRzID0gZnVuY3Rpb24oSGVyZU1hcHNNYXJrZXJJbnRlcmZhY2Upe1xyXG4gICAgZnVuY3Rpb24gRGVmYXVsdE1hcmtlcihwbGFjZSl7XHJcbiAgICAgICAgdGhpcy5wbGFjZSA9IHBsYWNlO1xyXG4gICAgICAgIHRoaXMuc2V0Q29vcmRzKCk7XHJcbiAgICB9XHJcblxyXG4gICAgdmFyIHByb3RvID0gRGVmYXVsdE1hcmtlci5wcm90b3R5cGUgPSBuZXcgSGVyZU1hcHNNYXJrZXJJbnRlcmZhY2UoKTtcclxuICAgIHByb3RvLmNvbnN0cnVjdG9yID0gRGVmYXVsdE1hcmtlcjtcclxuXHJcbiAgICBwcm90by5jcmVhdGUgPSBjcmVhdGU7XHJcblxyXG4gICAgcmV0dXJuIERlZmF1bHRNYXJrZXI7XHJcbiAgICBcclxuICAgIGZ1bmN0aW9uIGNyZWF0ZSgpe1xyXG4gICAgICAgIHZhciBtYXJrZXIgPSBuZXcgSC5tYXAuTWFya2VyKHRoaXMuY29vcmRzKTtcclxuICAgICAgICBcclxuICAgICAgICB0aGlzLmFkZEluZm9CdWJibGUobWFya2VyKTtcclxuICAgICAgICBcclxuICAgICAgICByZXR1cm4gbWFya2VyO1xyXG4gICAgfVxyXG59IiwibW9kdWxlLmV4cG9ydHMgPSBmdW5jdGlvbihIZXJlTWFwc01hcmtlckludGVyZmFjZSl7XHJcbiAgICBmdW5jdGlvbiBET01NYXJrZXIocGxhY2Upe1xyXG4gICAgICAgIHRoaXMucGxhY2UgPSBwbGFjZTtcclxuICAgICAgICB0aGlzLnNldENvb3JkcygpO1xyXG4gICAgfVxyXG5cclxuICAgIHZhciBwcm90byA9IERPTU1hcmtlci5wcm90b3R5cGUgPSBuZXcgSGVyZU1hcHNNYXJrZXJJbnRlcmZhY2UoKTtcclxuICAgIHByb3RvLmNvbnN0cnVjdG9yID0gRE9NTWFya2VyO1xyXG5cclxuICAgIHByb3RvLmNyZWF0ZSA9IGNyZWF0ZTtcclxuICAgIHByb3RvLmdldEljb24gPSBnZXRJY29uO1xyXG4gICAgcHJvdG8uc2V0dXBFdmVudHMgPSBzZXR1cEV2ZW50cztcclxuXHJcbiAgICByZXR1cm4gRE9NTWFya2VyO1xyXG4gICAgXHJcbiAgICBmdW5jdGlvbiBjcmVhdGUoKXtcclxuICAgICAgICB2YXIgbWFya2VyID0gbmV3IEgubWFwLkRvbU1hcmtlcih0aGlzLmNvb3Jkcywge1xyXG4gICAgICAgICAgICBpY29uOiB0aGlzLmdldEljb24oKVxyXG4gICAgICAgIH0pO1xyXG4gICAgICAgIFxyXG4gICAgICAgIHRoaXMuYWRkSW5mb0J1YmJsZShtYXJrZXIpO1xyXG4gICAgICAgIFxyXG4gICAgICAgIHJldHVybiBtYXJrZXI7XHJcbiAgICB9XHJcbiAgICBcclxuICAgIGZ1bmN0aW9uIGdldEljb24oKXtcclxuICAgICAgICB2YXIgaWNvbiA9IHRoaXMucGxhY2UubWFya3VwO1xyXG4gICAgICAgICBpZighaWNvbilcclxuICAgICAgICAgICAgdGhyb3cgbmV3IEVycm9yKCdtYXJrdXAgbWlzc2VkJyk7XHJcblxyXG4gICAgICAgIHJldHVybiBuZXcgSC5tYXAuRG9tSWNvbihpY29uKTtcclxuICAgIH1cclxuICAgIFxyXG4gICAgZnVuY3Rpb24gc2V0dXBFdmVudHMoZWwsIGV2ZW50cywgcmVtb3ZlKXtcclxuICAgICAgICB2YXIgbWV0aG9kID0gcmVtb3ZlID8gJ3JlbW92ZUV2ZW50TGlzdGVuZXInIDogJ2FkZEV2ZW50TGlzdGVuZXInO1xyXG5cclxuICAgICAgICBmb3IodmFyIGtleSBpbiBldmVudHMpIHtcclxuICAgICAgICAgICAgaWYoIWV2ZW50cy5oYXNPd25Qcm9wZXJ0eShrZXkpKVxyXG4gICAgICAgICAgICAgICAgY29udGludWU7XHJcblxyXG4gICAgICAgICAgICBlbFttZXRob2RdLmNhbGwobnVsbCwga2V5LCBldmVudHNba2V5XSk7XHJcbiAgICAgICAgfVxyXG4gICAgfVxyXG59IiwibW9kdWxlLmV4cG9ydHMgPSBhbmd1bGFyXHJcbiAgICAubW9kdWxlKCdoZXJlbWFwcy1tYXJrZXJzLW1vZHVsZScsIFtdKVxyXG4gICAgLmZhY3RvcnkoJ0hlcmVNYXBzTWFya2VySW50ZXJmYWNlJywgcmVxdWlyZSgnLi9tYXJrZXIuanMnKSlcclxuICAgIC5mYWN0b3J5KCdIZXJlTWFwc0RlZmF1bHRNYXJrZXInLCByZXF1aXJlKCcuL2RlZmF1bHQubWFya2VyLmpzJykpXHJcbiAgICAuZmFjdG9yeSgnSGVyZU1hcHNET01NYXJrZXInLCByZXF1aXJlKCcuL2RvbS5tYXJrZXIuanMnKSlcclxuICAgIC5mYWN0b3J5KCdIZXJlTWFwc1NWR01hcmtlcicsIHJlcXVpcmUoJy4vc3ZnLm1hcmtlci5qcycpKVxyXG4gICAgLnNlcnZpY2UoJ0hlcmVNYXBzTWFya2VyU2VydmljZScsIHJlcXVpcmUoJy4vbWFya2Vycy5zZXJ2aWNlLmpzJykpOyIsIm1vZHVsZS5leHBvcnRzID0gZnVuY3Rpb24oKXtcclxuICAgIGZ1bmN0aW9uIE1hcmtlckludGVyZmFjZSgpe1xyXG4gICAgICAgIHRocm93IG5ldyBFcnJvcignQWJzdHJhY3QgY2xhc3MhIFRoZSBJbnN0YW5jZSBzaG91bGQgYmUgY3JlYXRlZCcpO1xyXG4gICAgfVxyXG4gICAgXHJcbiAgICB2YXIgcHJvdG8gPSBNYXJrZXJJbnRlcmZhY2UucHJvdG90eXBlO1xyXG4gICAgXHJcbiAgICBwcm90by5jcmVhdGUgPSBjcmVhdGU7XHJcbiAgICBwcm90by5zZXRDb29yZHMgPSBzZXRDb29yZHM7XHJcbiAgICBwcm90by5hZGRJbmZvQnViYmxlID0gYWRkSW5mb0J1YmJsZTtcclxuICAgIFxyXG4gICAgZnVuY3Rpb24gTWFya2VyKCl7fVxyXG4gICAgXHJcbiAgICBNYXJrZXIucHJvdG90eXBlID0gcHJvdG87XHJcbiAgICBcclxuICAgIHJldHVybiBNYXJrZXI7XHJcbiAgICBcclxuICAgIGZ1bmN0aW9uIGNyZWF0ZSgpe1xyXG4gICAgICAgIHRocm93IG5ldyBFcnJvcignY3JlYXRlOjogbm90IGltcGxlbWVudGVkJyk7IFxyXG4gICAgfVxyXG4gICAgXHJcbiAgICBmdW5jdGlvbiBzZXRDb29yZHMoKXtcclxuICAgICAgICAgdGhpcy5jb29yZHMgPSB7XHJcbiAgICAgICAgICAgIGxhdDogdGhpcy5wbGFjZS5wb3MubGF0LFxyXG4gICAgICAgICAgICBsbmc6IHRoaXMucGxhY2UucG9zLmxuZ1xyXG4gICAgICAgIH1cclxuICAgIH1cclxuICAgIFxyXG4gICAgZnVuY3Rpb24gYWRkSW5mb0J1YmJsZShtYXJrZXIpe1xyXG4gICAgICAgIGlmKCF0aGlzLnBsYWNlLnBvcHVwKVxyXG4gICAgICAgICAgICByZXR1cm47XHJcbiAgICAgICAgICAgIFxyXG4gICAgICAgIG1hcmtlci5zZXREYXRhKHRoaXMucGxhY2UucG9wdXApXHJcbiAgICB9XHJcbn0iLCJtb2R1bGUuZXhwb3J0cyA9IGZ1bmN0aW9uKEhlcmVNYXBzRGVmYXVsdE1hcmtlciwgSGVyZU1hcHNET01NYXJrZXIsIEhlcmVNYXBzU1ZHTWFya2VyLCBIZXJlTWFwc0NPTlNUUykge1xyXG5cclxuICAgIHZhciBNQVJLRVJfVFlQRVMgPSBIZXJlTWFwc0NPTlNUUy5NQVJLRVJfVFlQRVM7XHJcblxyXG4gICAgcmV0dXJuIHtcclxuICAgICAgICBhZGRNYXJrZXJzVG9NYXA6IGFkZE1hcmtlcnNUb01hcCxcclxuICAgICAgICBhZGRVc2VyTWFya2VyOiBhZGRVc2VyTWFya2VyLFxyXG4gICAgICAgIHVwZGF0ZU1hcmtlcnM6IHVwZGF0ZU1hcmtlcnMsXHJcbiAgICAgICAgaXNNYXJrZXJJbnN0YW5jZTogaXNNYXJrZXJJbnN0YW5jZVxyXG4gICAgfVxyXG5cclxuICAgIGZ1bmN0aW9uIGlzTWFya2VySW5zdGFuY2UodGFyZ2V0KSB7XHJcbiAgICAgICAgcmV0dXJuIHRhcmdldCBpbnN0YW5jZW9mIEgubWFwLk1hcmtlciB8fCB0YXJnZXQgaW5zdGFuY2VvZiBILm1hcC5Eb21NYXJrZXI7XHJcbiAgICB9XHJcblxyXG4gICAgZnVuY3Rpb24gYWRkVXNlck1hcmtlcihtYXAsIHBsYWNlKSB7XHJcbiAgICAgICAgaWYobWFwLnVzZXJNYXJrZXIpXHJcbiAgICAgICAgICAgIHJldHVybiBtYXAudXNlck1hcmtlcjtcclxuICAgICAgICBcclxuICAgICAgICBwbGFjZS5tYXJrdXAgPSAnPHN2ZyB3aWR0aD1cIjM1cHhcIiBoZWlnaHQ9XCIzNXB4XCIgdmlld0JveD1cIjAgMCA5MCA5MFwiIHZlcnNpb249XCIxLjFcIiB4bWxucz1cImh0dHA6Ly93d3cudzMub3JnLzIwMDAvc3ZnXCIgeG1sbnM6eGxpbms9XCJodHRwOi8vd3d3LnczLm9yZy8xOTk5L3hsaW5rXCI+JyArXHJcbiAgICAgICAgICAgICc8ZGVmcz48Y2lyY2xlIGlkPVwicGF0aC0xXCIgY3g9XCIzMDJcIiBjeT1cIjgwMlwiIHI9XCIxNVwiPjwvY2lyY2xlPicgK1xyXG4gICAgICAgICAgICAnPG1hc2sgaWQ9XCJtYXNrLTJcIiBtYXNrQ29udGVudFVuaXRzPVwidXNlclNwYWNlT25Vc2VcIiBtYXNrVW5pdHM9XCJvYmplY3RCb3VuZGluZ0JveFwiIHg9XCItMzBcIiB5PVwiLTMwXCIgd2lkdGg9XCI5MFwiIGhlaWdodD1cIjkwXCI+JyArXHJcbiAgICAgICAgICAgICc8cmVjdCB4PVwiMjU3XCIgeT1cIjc1N1wiIHdpZHRoPVwiOTBcIiBoZWlnaHQ9XCI5MFwiIGZpbGw9XCJ3aGl0ZVwiPjwvcmVjdD48dXNlIHhsaW5rOmhyZWY9XCIjcGF0aC0xXCIgZmlsbD1cImJsYWNrXCI+PC91c2U+JyArXHJcbiAgICAgICAgICAgICc8L21hc2s+PC9kZWZzPjxnIGlkPVwiUGFnZS0xXCIgc3Ryb2tlPVwibm9uZVwiIHN0cm9rZS13aWR0aD1cIjFcIiBmaWxsPVwibm9uZVwiIGZpbGwtcnVsZT1cImV2ZW5vZGRcIj4nICtcclxuICAgICAgICAgICAgJzxnIGlkPVwiU2VydmljZS1PcHRpb25zLS0tZGlyZWN0aW9ucy0tLW1hcFwiIHRyYW5zZm9ybT1cInRyYW5zbGF0ZSgtMjU3LjAwMDAwMCwgLTc1Ny4wMDAwMDApXCI+PGcgaWQ9XCJPdmFsLTE1XCI+JyArXHJcbiAgICAgICAgICAgICc8dXNlIGZpbGw9XCIjRkZGRkZGXCIgZmlsbC1ydWxlPVwiZXZlbm9kZFwiIHhsaW5rOmhyZWY9XCIjcGF0aC0xXCI+PC91c2U+JyArXHJcbiAgICAgICAgICAgICc8dXNlIHN0cm9rZS1vcGFjaXR5PVwiMC4yOTYxMzkwNFwiIHN0cm9rZT1cIiMzRjM0QTBcIiBtYXNrPVwidXJsKCNtYXNrLTIpXCIgc3Ryb2tlLXdpZHRoPVwiNjBcIiB4bGluazpocmVmPVwiI3BhdGgtMVwiPjwvdXNlPicgK1xyXG4gICAgICAgICAgICAnPHVzZSBzdHJva2U9XCIjM0YzNEEwXCIgc3Ryb2tlLXdpZHRoPVwiNVwiIHhsaW5rOmhyZWY9XCIjcGF0aC0xXCI+PC91c2U+PC9nPjwvZz48L2c+PC9zdmc+JztcclxuXHJcbiAgICAgICAgbWFwLnVzZXJNYXJrZXIgPSBuZXcgSGVyZU1hcHNTVkdNYXJrZXIocGxhY2UpLmNyZWF0ZSgpO1xyXG5cclxuICAgICAgICBtYXAuYWRkT2JqZWN0KG1hcC51c2VyTWFya2VyKTtcclxuXHJcbiAgICAgICAgcmV0dXJuIG1hcC51c2VyTWFya2VyO1xyXG4gICAgfVxyXG5cclxuICAgIGZ1bmN0aW9uIGFkZE1hcmtlcnNUb01hcChtYXAsIHBsYWNlcywgcmVmcmVzaFZpZXdib3VuZHMpIHtcclxuICAgICAgICBpZiAoIXBsYWNlcyB8fCAhcGxhY2VzLmxlbmd0aClcclxuICAgICAgICAgICAgcmV0dXJuO1xyXG5cclxuICAgICAgICBpZiAoIShtYXAgaW5zdGFuY2VvZiBILk1hcCkpXHJcbiAgICAgICAgICAgIHRocm93IG5ldyBFcnJvcignVW5zdXBwb3J0ZWQgbWFwIGluc3RhbmNlJyk7XHJcblxyXG4gICAgICAgIGlmICghbWFwLm1hcmtlcnNHcm91cClcclxuICAgICAgICAgICAgbWFwLm1hcmtlcnNHcm91cCA9IG5ldyBILm1hcC5Hcm91cCgpO1xyXG5cclxuICAgICAgICBwbGFjZXMuZm9yRWFjaChmdW5jdGlvbihwbGFjZSwgaSkge1xyXG4gICAgICAgICAgICB2YXIgY3JlYXRvciA9IF9nZXRNYXJrZXJDcmVhdG9yKHBsYWNlKSxcclxuICAgICAgICAgICAgICAgIG1hcmtlciA9IHBsYWNlLmRyYWdnYWJsZSA/IF9kcmFnZ2FibGVNYXJrZXJNaXhpbihjcmVhdG9yLmNyZWF0ZSgpKSA6IGNyZWF0b3IuY3JlYXRlKCk7XHJcblxyXG4gICAgICAgICAgICBtYXAubWFya2Vyc0dyb3VwLmFkZE9iamVjdChtYXJrZXIpO1xyXG4gICAgICAgIH0pO1xyXG5cclxuICAgICAgICBtYXAuYWRkT2JqZWN0KG1hcC5tYXJrZXJzR3JvdXApO1xyXG5cclxuICAgICAgICBpZihyZWZyZXNoVmlld2JvdW5kcyl7XHJcbiAgICAgICAgICBtYXAuc2V0Vmlld0JvdW5kcyhtYXAubWFya2Vyc0dyb3VwLmdldEJvdW5kcygpKTtcclxuICAgICAgICB9XHJcbiAgICAgIH1cclxuICAgIGZ1bmN0aW9uIHVwZGF0ZU1hcmtlcnMobWFwLCBwbGFjZXMsIHJlZnJlc2hWaWV3Ym91bmRzKSB7XHJcbiAgICAgICAgaWYgKG1hcC5tYXJrZXJzR3JvdXApIHtcclxuICAgICAgICAgICAgbWFwLm1hcmtlcnNHcm91cC5yZW1vdmVBbGwoKTtcclxuICAgICAgICAgICAgbWFwLnJlbW92ZU9iamVjdChtYXAubWFya2Vyc0dyb3VwKTtcclxuICAgICAgICAgICAgbWFwLm1hcmtlcnNHcm91cCA9IG51bGw7XHJcbiAgICAgICAgfVxyXG5cclxuICAgICAgICBhZGRNYXJrZXJzVG9NYXAuYXBwbHkobnVsbCwgYXJndW1lbnRzKTtcclxuICAgIH1cclxuXHJcbiAgICBmdW5jdGlvbiBfZ2V0TWFya2VyQ3JlYXRvcihwbGFjZSkge1xyXG4gICAgICAgIHZhciBDb25jcmV0ZU1hcmtlcixcclxuICAgICAgICAgICAgdHlwZSA9IHBsYWNlLnR5cGUgPyBwbGFjZS50eXBlLnRvVXBwZXJDYXNlKCkgOiBudWxsO1xyXG5cclxuICAgICAgICBzd2l0Y2ggKHR5cGUpIHtcclxuICAgICAgICAgICAgY2FzZSBNQVJLRVJfVFlQRVMuRE9NOlxyXG4gICAgICAgICAgICAgICAgQ29uY3JldGVNYXJrZXIgPSBIZXJlTWFwc0RPTU1hcmtlcjtcclxuICAgICAgICAgICAgICAgIGJyZWFrO1xyXG4gICAgICAgICAgICBjYXNlIE1BUktFUl9UWVBFUy5TVkc6XHJcbiAgICAgICAgICAgICAgICBDb25jcmV0ZU1hcmtlciA9IEhlcmVNYXBzU1ZHTWFya2VyO1xyXG4gICAgICAgICAgICAgICAgYnJlYWs7XHJcbiAgICAgICAgICAgIGRlZmF1bHQ6XHJcbiAgICAgICAgICAgICAgICBDb25jcmV0ZU1hcmtlciA9IEhlcmVNYXBzRGVmYXVsdE1hcmtlcjtcclxuICAgICAgICB9XHJcblxyXG4gICAgICAgIHJldHVybiBuZXcgQ29uY3JldGVNYXJrZXIocGxhY2UpO1xyXG4gICAgfVxyXG5cclxuICAgIGZ1bmN0aW9uIF9kcmFnZ2FibGVNYXJrZXJNaXhpbihtYXJrZXIpIHtcclxuICAgICAgICBtYXJrZXIuZHJhZ2dhYmxlID0gdHJ1ZTtcclxuXHJcbiAgICAgICAgcmV0dXJuIG1hcmtlcjtcclxuICAgIH1cclxuXHJcbn07XHJcbiIsIm1vZHVsZS5leHBvcnRzID0gZnVuY3Rpb24oSGVyZU1hcHNNYXJrZXJJbnRlcmZhY2Upe1xyXG4gICAgZnVuY3Rpb24gU1ZHTWFya2VyKHBsYWNlKXtcclxuICAgICAgICB0aGlzLnBsYWNlID0gcGxhY2U7XHJcbiAgICAgICAgdGhpcy5zZXRDb29yZHMoKTtcclxuICAgIH1cclxuICAgIFxyXG4gICAgdmFyIHByb3RvID0gU1ZHTWFya2VyLnByb3RvdHlwZSA9IG5ldyBIZXJlTWFwc01hcmtlckludGVyZmFjZSgpO1xyXG4gICAgcHJvdG8uY29uc3RydWN0b3IgPSBTVkdNYXJrZXI7XHJcbiAgICBcclxuICAgIHByb3RvLmNyZWF0ZSA9IGNyZWF0ZTtcclxuICAgIHByb3RvLmdldEljb24gPSBnZXRJY29uO1xyXG4gICAgXHJcbiAgICByZXR1cm4gU1ZHTWFya2VyO1xyXG4gICAgXHJcbiAgICBmdW5jdGlvbiBjcmVhdGUoKXtcclxuICAgICAgICB2YXIgbWFya2VyID0gbmV3IEgubWFwLk1hcmtlcih0aGlzLmNvb3Jkcywge1xyXG4gICAgICAgICAgICBpY29uOiB0aGlzLmdldEljb24oKSxcclxuICAgICAgICB9KTtcclxuICAgICAgICBcclxuICAgICAgICB0aGlzLmFkZEluZm9CdWJibGUobWFya2VyKTtcclxuICAgICAgICBcclxuICAgICAgICByZXR1cm4gbWFya2VyO1xyXG4gICAgfVxyXG4gICAgXHJcbiAgICBmdW5jdGlvbiBnZXRJY29uKCl7XHJcbiAgICAgICAgdmFyIGljb24gPSB0aGlzLnBsYWNlLm1hcmt1cDtcclxuICAgICAgICAgaWYoIWljb24pXHJcbiAgICAgICAgICAgIHRocm93IG5ldyBFcnJvcignbWFya3VwIG1pc3NlZCcpO1xyXG5cclxuICAgICAgICByZXR1cm4gbmV3IEgubWFwLkljb24oaWNvbik7XHJcbiAgICB9XHJcbn0iLCJtb2R1bGUuZXhwb3J0cyA9IGFuZ3VsYXIubW9kdWxlKCdoZXJlbWFwcy1yb3V0ZXMtbW9kdWxlJywgW10pXHJcbiAgICAgICAgICAgICAgICAgICAgLnNlcnZpY2UoJ1JvdXRlc1NlcnZpY2UnLCByZXF1aXJlKCcuL3JvdXRlcy5zZXJ2aWNlLmpzJykpOyAgIiwibW9kdWxlLmV4cG9ydHMgPSBmdW5jdGlvbiAoJHEpIHtcclxuICAgIHJldHVybiB7XHJcbiAgICAgICAgY2FsY3VsYXRlUm91dGU6IGNhbGN1bGF0ZVJvdXRlLFxyXG4gICAgICAgIGFkZFJvdXRlVG9NYXA6IGFkZFJvdXRlVG9NYXAsXHJcbiAgICAgICAgY2xlYW5Sb3V0ZXM6IGNsZWFuUm91dGVzXHJcbiAgICB9XHJcblxyXG4gICAgZnVuY3Rpb24gY2FsY3VsYXRlUm91dGUoaGVyZW1hcHMsIGNvbmZpZykge1xyXG4gICAgICAgIHZhciBwbGF0Zm9ybSA9IGhlcmVtYXBzLnBsYXRmb3JtLFxyXG4gICAgICAgICAgICBtYXAgPSBoZXJlbWFwcy5tYXAsXHJcbiAgICAgICAgICAgIHJvdXRlciA9IHBsYXRmb3JtLmdldFJvdXRpbmdTZXJ2aWNlKCksXHJcbiAgICAgICAgICAgIGRpciA9IGNvbmZpZy5kaXJlY3Rpb24sXHJcbiAgICAgICAgICAgIHdheXBvaW50cyA9IGRpci53YXlwb2ludHM7XHJcblxyXG4gICAgICAgIHZhciBtb2RlID0gJ3t7TU9ERX19O3t7VkVDSElMRX19J1xyXG4gICAgICAgICAgICAucmVwbGFjZSgve3tNT0RFfX0vLCBkaXIubW9kZSlcclxuICAgICAgICAgICAgLnJlcGxhY2UoL3t7VkVDSElMRX19LywgY29uZmlnLmRyaXZlVHlwZSk7XHJcblxyXG4gICAgICAgIHZhciByb3V0ZVJlcXVlc3RQYXJhbXMgPSB7XHJcbiAgICAgICAgICAgIG1vZGU6IG1vZGUsXHJcbiAgICAgICAgICAgIHJlcHJlc2VudGF0aW9uOiBkaXIucmVwcmVzZW50YXRpb24gfHwgJ2Rpc3BsYXknLFxyXG4gICAgICAgICAgICBsYW5ndWFnZTogZGlyLmxhbmd1YWdlIHx8ICdlbi1nYidcclxuICAgICAgICB9O1xyXG5cclxuICAgICAgICBmb3IodmFyIG5vID0gMDsgbm8gPCB3YXlwb2ludHMubGVuZ3RoOyBubysrKXtcclxuICAgICAgICAgIHJvdXRlUmVxdWVzdFBhcmFtc1tcIndheXBvaW50XCIgKyBub10gPSBbd2F5cG9pbnRzW25vXS5sYXQsIHdheXBvaW50c1tub10ubG5nXS5qb2luKCcsJyk7XHJcbiAgICAgICAgfVxyXG5cclxuICAgICAgICBfc2V0QXR0cmlidXRlcyhyb3V0ZVJlcXVlc3RQYXJhbXMsIGRpci5hdHRycyk7XHJcblxyXG4gICAgICAgIHZhciBkZWZlcnJlZCA9ICRxLmRlZmVyKCk7XHJcblxyXG4gICAgICAgIHJvdXRlci5jYWxjdWxhdGVSb3V0ZShyb3V0ZVJlcXVlc3RQYXJhbXMsIGZ1bmN0aW9uIChyZXN1bHQpIHtcclxuICAgICAgICAgICAgZGVmZXJyZWQucmVzb2x2ZShyZXN1bHQpO1xyXG4gICAgICAgIH0sIGZ1bmN0aW9uIChlcnJvcikge1xyXG4gICAgICAgICAgICBkZWZlcnJlZC5yZWplY3QoZXJyb3IpO1xyXG4gICAgICAgIH0pO1xyXG4gICAgXHJcbiAgICAgICAgcmV0dXJuIGRlZmVycmVkLnByb21pc2U7XHJcbiAgICB9XHJcblxyXG4gICAgZnVuY3Rpb24gY2xlYW5Sb3V0ZXMobWFwKXtcclxuICAgICAgICB2YXIgZ3JvdXAgPSBtYXAucm91dGVzR3JvdXA7XHJcbiAgICAgICAgIFxyXG4gICAgICAgIGlmKCFncm91cClcclxuICAgICAgICAgICAgcmV0dXJuO1xyXG4gICAgICAgICAgICBcclxuICAgICAgICBncm91cC5yZW1vdmVBbGwoKTtcclxuICAgICAgICBtYXAucmVtb3ZlT2JqZWN0KGdyb3VwKTtcclxuICAgICAgICBtYXAucm91dGVzR3JvdXAgPSBudWxsO1xyXG4gICAgfVxyXG4gICAgXHJcbiAgICBmdW5jdGlvbiBhZGRSb3V0ZVRvTWFwKG1hcCwgcm91dGVEYXRhLCBjbGVhbikge1xyXG4gICAgICAgIGlmKGNsZWFuKVxyXG4gICAgICAgICAgIGNsZWFuUm91dGVzKG1hcCk7XHJcbiAgICAgICAgICAgXHJcbiAgICAgICAgdmFyIHJvdXRlID0gcm91dGVEYXRhLnJvdXRlO1xyXG4gICAgICAgIFxyXG4gICAgICAgIGlmICghbWFwIHx8ICFyb3V0ZSB8fCAhcm91dGUuc2hhcGUpXHJcbiAgICAgICAgICAgIHJldHVybjtcclxuXHJcbiAgICAgICAgdmFyIHN0cmlwID0gbmV3IEguZ2VvLlN0cmlwKCksIHBvbHlsaW5lID0gbnVsbDtcclxuXHJcbiAgICAgICAgcm91dGUuc2hhcGUuZm9yRWFjaChmdW5jdGlvbiAocG9pbnQpIHtcclxuICAgICAgICAgICAgdmFyIHBhcnRzID0gcG9pbnQuc3BsaXQoJywnKTtcclxuICAgICAgICAgICAgc3RyaXAucHVzaExhdExuZ0FsdChwYXJ0c1swXSwgcGFydHNbMV0pO1xyXG4gICAgICAgIH0pO1xyXG4gICAgICAgIFxyXG4gICAgICAgIHZhciBzdHlsZSA9IHJvdXRlRGF0YS5zdHlsZTtcclxuXHJcbiAgICAgICAgcG9seWxpbmUgPSBuZXcgSC5tYXAuUG9seWxpbmUoc3RyaXAsIHtcclxuICAgICAgICAgICAgc3R5bGU6IHtcclxuICAgICAgICAgICAgICAgIGxpbmVXaWR0aDogc3R5bGUubGluZVdpZHRoIHx8IDQsXHJcbiAgICAgICAgICAgICAgICBzdHJva2VDb2xvcjogc3R5bGUuIGNvbG9yIHx8ICdyZ2JhKDAsIDEyOCwgMjU1LCAwLjcpJ1xyXG4gICAgICAgICAgICB9XHJcbiAgICAgICAgfSk7XHJcbiAgICAgICAgXHJcbiAgICAgICAgdmFyIGdyb3VwID0gbWFwLnJvdXRlc0dyb3VwO1xyXG4gICAgICAgIFxyXG4gICAgICAgIGlmKCFncm91cCkge1xyXG4gICAgICAgICAgICBncm91cCA9IG1hcC5yb3V0ZXNHcm91cCA9IG5ldyBILm1hcC5Hcm91cCgpO1xyXG4gICAgICAgICAgICBtYXAuYWRkT2JqZWN0KGdyb3VwKTtcclxuICAgICAgICB9XHJcbiAgICAgICAgXHJcbiAgICAgICAgZ3JvdXAuYWRkT2JqZWN0KHBvbHlsaW5lKTtcclxuICAgICAgICBcclxuICAgICAgICBtYXAuc2V0Vmlld0JvdW5kcyhwb2x5bGluZS5nZXRCb3VuZHMoKSwgdHJ1ZSk7XHJcbiAgICB9XHJcblxyXG4gICAgLy8jcmVnaW9uIFBSSVZBVEVcclxuXHJcbiAgICBmdW5jdGlvbiBfc2V0QXR0cmlidXRlcyhwYXJhbXMsIGF0dHJzKSB7XHJcbiAgICAgICAgdmFyIF9rZXkgPSAnYXR0cmlidXRlcyc7XHJcbiAgICAgICAgZm9yICh2YXIga2V5IGluIGF0dHJzKSB7XHJcbiAgICAgICAgICAgIGlmICghYXR0cnMuaGFzT3duUHJvcGVydHkoa2V5KSlcclxuICAgICAgICAgICAgICAgIGNvbnRpbnVlO1xyXG5cclxuICAgICAgICAgICAgcGFyYW1zW2tleSArIF9rZXldID0gYXR0cnNba2V5XTtcclxuICAgICAgICB9XHJcbiAgICB9XHJcblxyXG4gICAgZnVuY3Rpb24gX29uUm91dGVTdWNjZXNzKHJlc3VsdCkge1xyXG4gICAgICAgIGNvbnNvbGUubG9nKHJlc3VsdClcclxuICAgIH1cclxuXHJcbiAgICBmdW5jdGlvbiBfb25Sb3V0ZUZhaWx1cmUoZXJyb3IpIHtcclxuICAgICAgICBjb25zb2xlLmxvZygnQ2FsY3VsYXRlIHJvdXRlIGZhaWx1cmUnLCBlcnJvcik7XHJcbiAgICB9XHJcblxyXG4gICAgLyoqXHJcbiAgICAgKiBDcmVhdGVzIGEgc2VyaWVzIG9mIEgubWFwLk1hcmtlciBwb2ludHMgZnJvbSB0aGUgcm91dGUgYW5kIGFkZHMgdGhlbSB0byB0aGUgbWFwLlxyXG4gICAgICogQHBhcmFtIHtPYmplY3R9IHJvdXRlICBBIHJvdXRlIGFzIHJlY2VpdmVkIGZyb20gdGhlIEguc2VydmljZS5Sb3V0aW5nU2VydmljZVxyXG4gICAgICovXHJcbiAgICBmdW5jdGlvbiBhZGRNYW51ZXZlcnNUb01hcChtYXAsIHJvdXRlKSB7XHJcbiAgICAgICAgdmFyIHN2Z01hcmt1cCA9ICc8c3ZnIHdpZHRoPVwiMThcIiBoZWlnaHQ9XCIxOFwiICcgK1xyXG4gICAgICAgICAgICAneG1sbnM9XCJodHRwOi8vd3d3LnczLm9yZy8yMDAwL3N2Z1wiPicgK1xyXG4gICAgICAgICAgICAnPGNpcmNsZSBjeD1cIjhcIiBjeT1cIjhcIiByPVwiOFwiICcgK1xyXG4gICAgICAgICAgICAnZmlsbD1cIiMxYjQ2OGRcIiBzdHJva2U9XCJ3aGl0ZVwiIHN0cm9rZS13aWR0aD1cIjFcIiAgLz4nICtcclxuICAgICAgICAgICAgJzwvc3ZnPicsXHJcbiAgICAgICAgICAgIGRvdEljb24gPSBuZXcgSC5tYXAuSWNvbihzdmdNYXJrdXAsIHsgYW5jaG9yOiB7IHg6IDgsIHk6IDggfSB9KSxcclxuICAgICAgICAgICAgZ3JvdXAgPSBuZXcgSC5tYXAuR3JvdXAoKSxcclxuICAgICAgICAgICAgaSxcclxuICAgICAgICAgICAgajtcclxuXHJcbiAgICAgICAgLy8gQWRkIGEgbWFya2VyIGZvciBlYWNoIG1hbmV1dmVyXHJcbiAgICAgICAgZm9yIChpID0gMDsgaSA8IHJvdXRlLmxlZy5sZW5ndGg7IGkgKz0gMSkge1xyXG4gICAgICAgICAgICBmb3IgKGogPSAwOyBqIDwgcm91dGUubGVnW2ldLm1hbmV1dmVyLmxlbmd0aDsgaiArPSAxKSB7XHJcbiAgICAgICAgICAgICAgICAvLyBHZXQgdGhlIG5leHQgbWFuZXV2ZXIuXHJcbiAgICAgICAgICAgICAgICBtYW5ldXZlciA9IHJvdXRlLmxlZ1tpXS5tYW5ldXZlcltqXTtcclxuICAgICAgICAgICAgICAgIC8vIEFkZCBhIG1hcmtlciB0byB0aGUgbWFuZXV2ZXJzIGdyb3VwXHJcbiAgICAgICAgICAgICAgICB2YXIgbWFya2VyID0gbmV3IEgubWFwLk1hcmtlcih7XHJcbiAgICAgICAgICAgICAgICAgICAgbGF0OiBtYW5ldXZlci5wb3NpdGlvbi5sYXRpdHVkZSxcclxuICAgICAgICAgICAgICAgICAgICBsbmc6IG1hbmV1dmVyLnBvc2l0aW9uLmxvbmdpdHVkZVxyXG4gICAgICAgICAgICAgICAgfSxcclxuICAgICAgICAgICAgICAgICAgICB7IGljb246IGRvdEljb24gfVxyXG4gICAgICAgICAgICAgICAgKTtcclxuXHJcbiAgICAgICAgICAgICAgICBtYXJrZXIuaW5zdHJ1Y3Rpb24gPSBtYW5ldXZlci5pbnN0cnVjdGlvbjtcclxuICAgICAgICAgICAgICAgIGdyb3VwLmFkZE9iamVjdChtYXJrZXIpO1xyXG4gICAgICAgICAgICB9XHJcbiAgICAgICAgfVxyXG5cclxuICAgICAgICBncm91cC5hZGRFdmVudExpc3RlbmVyKCd0YXAnLCBmdW5jdGlvbiAoZXZ0KSB7XHJcbiAgICAgICAgICAgIG1hcC5zZXRDZW50ZXIoZXZ0LnRhcmdldC5nZXRQb3NpdGlvbigpKTtcclxuICAgICAgICAgICAgb3BlbkJ1YmJsZShldnQudGFyZ2V0LmdldFBvc2l0aW9uKCksIGV2dC50YXJnZXQuaW5zdHJ1Y3Rpb24pO1xyXG4gICAgICAgIH0sIGZhbHNlKTtcclxuXHJcbiAgICAgICAgLy8gQWRkIHRoZSBtYW5ldXZlcnMgZ3JvdXAgdG8gdGhlIG1hcFxyXG4gICAgICAgIG1hcC5hZGRPYmplY3QoZ3JvdXApO1xyXG4gICAgfVxyXG5cclxuXHJcbiAgICAvKipcclxuICAgICAqIENyZWF0ZXMgYSBzZXJpZXMgb2YgSC5tYXAuTWFya2VyIHBvaW50cyBmcm9tIHRoZSByb3V0ZSBhbmQgYWRkcyB0aGVtIHRvIHRoZSBtYXAuXHJcbiAgICAgKiBAcGFyYW0ge09iamVjdH0gcm91dGUgIEEgcm91dGUgYXMgcmVjZWl2ZWQgZnJvbSB0aGUgSC5zZXJ2aWNlLlJvdXRpbmdTZXJ2aWNlXHJcbiAgICAgKi9cclxuICAgIGZ1bmN0aW9uIGFkZFdheXBvaW50c1RvUGFuZWwod2F5cG9pbnRzKSB7XHJcbiAgICAgICAgdmFyIG5vZGVIMyA9IGRvY3VtZW50LmNyZWF0ZUVsZW1lbnQoJ2gzJyksXHJcbiAgICAgICAgICAgIHdheXBvaW50TGFiZWxzID0gW10sXHJcbiAgICAgICAgICAgIGk7XHJcblxyXG4gICAgICAgIGZvciAoaSA9IDA7IGkgPCB3YXlwb2ludHMubGVuZ3RoOyBpICs9IDEpIHtcclxuICAgICAgICAgICAgd2F5cG9pbnRMYWJlbHMucHVzaCh3YXlwb2ludHNbaV0ubGFiZWwpXHJcbiAgICAgICAgfVxyXG5cclxuICAgICAgICBub2RlSDMudGV4dENvbnRlbnQgPSB3YXlwb2ludExhYmVscy5qb2luKCcgLSAnKTtcclxuXHJcbiAgICAgICAgcm91dGVJbnN0cnVjdGlvbnNDb250YWluZXIuaW5uZXJIVE1MID0gJyc7XHJcbiAgICAgICAgcm91dGVJbnN0cnVjdGlvbnNDb250YWluZXIuYXBwZW5kQ2hpbGQobm9kZUgzKTtcclxuICAgIH1cclxuXHJcbiAgICAvKipcclxuICAgICAqIENyZWF0ZXMgYSBzZXJpZXMgb2YgSC5tYXAuTWFya2VyIHBvaW50cyBmcm9tIHRoZSByb3V0ZSBhbmQgYWRkcyB0aGVtIHRvIHRoZSBtYXAuXHJcbiAgICAgKiBAcGFyYW0ge09iamVjdH0gcm91dGUgIEEgcm91dGUgYXMgcmVjZWl2ZWQgZnJvbSB0aGUgSC5zZXJ2aWNlLlJvdXRpbmdTZXJ2aWNlXHJcbiAgICAgKi9cclxuICAgIGZ1bmN0aW9uIGFkZFN1bW1hcnlUb1BhbmVsKHN1bW1hcnkpIHtcclxuICAgICAgICB2YXIgc3VtbWFyeURpdiA9IGRvY3VtZW50LmNyZWF0ZUVsZW1lbnQoJ2RpdicpLFxyXG4gICAgICAgICAgICBjb250ZW50ID0gJyc7XHJcblxyXG4gICAgICAgIGNvbnRlbnQgKz0gJzxiPlRvdGFsIGRpc3RhbmNlPC9iPjogJyArIHN1bW1hcnkuZGlzdGFuY2UgKyAnbS4gPGJyLz4nO1xyXG4gICAgICAgIGNvbnRlbnQgKz0gJzxiPlRyYXZlbCBUaW1lPC9iPjogJyArIHN1bW1hcnkudHJhdmVsVGltZS50b01NU1MoKSArICcgKGluIGN1cnJlbnQgdHJhZmZpYyknO1xyXG5cclxuXHJcbiAgICAgICAgc3VtbWFyeURpdi5zdHlsZS5mb250U2l6ZSA9ICdzbWFsbCc7XHJcbiAgICAgICAgc3VtbWFyeURpdi5zdHlsZS5tYXJnaW5MZWZ0ID0gJzUlJztcclxuICAgICAgICBzdW1tYXJ5RGl2LnN0eWxlLm1hcmdpblJpZ2h0ID0gJzUlJztcclxuICAgICAgICBzdW1tYXJ5RGl2LmlubmVySFRNTCA9IGNvbnRlbnQ7XHJcbiAgICAgICAgcm91dGVJbnN0cnVjdGlvbnNDb250YWluZXIuYXBwZW5kQ2hpbGQoc3VtbWFyeURpdik7XHJcbiAgICB9XHJcblxyXG4gICAgLyoqXHJcbiAgICAgKiBDcmVhdGVzIGEgc2VyaWVzIG9mIEgubWFwLk1hcmtlciBwb2ludHMgZnJvbSB0aGUgcm91dGUgYW5kIGFkZHMgdGhlbSB0byB0aGUgbWFwLlxyXG4gICAgICogQHBhcmFtIHtPYmplY3R9IHJvdXRlICBBIHJvdXRlIGFzIHJlY2VpdmVkIGZyb20gdGhlIEguc2VydmljZS5Sb3V0aW5nU2VydmljZVxyXG4gICAgICovXHJcbiAgICBmdW5jdGlvbiBhZGRNYW51ZXZlcnNUb1BhbmVsKHJvdXRlKSB7XHJcbiAgICAgICAgdmFyIG5vZGVPTCA9IGRvY3VtZW50LmNyZWF0ZUVsZW1lbnQoJ29sJyksIGksIGo7XHJcblxyXG4gICAgICAgIG5vZGVPTC5zdHlsZS5mb250U2l6ZSA9ICdzbWFsbCc7XHJcbiAgICAgICAgbm9kZU9MLnN0eWxlLm1hcmdpbkxlZnQgPSAnNSUnO1xyXG4gICAgICAgIG5vZGVPTC5zdHlsZS5tYXJnaW5SaWdodCA9ICc1JSc7XHJcbiAgICAgICAgbm9kZU9MLmNsYXNzTmFtZSA9ICdkaXJlY3Rpb25zJztcclxuXHJcbiAgICAgICAgLy8gQWRkIGEgbWFya2VyIGZvciBlYWNoIG1hbmV1dmVyXHJcbiAgICAgICAgZm9yIChpID0gMDsgaSA8IHJvdXRlLmxlZy5sZW5ndGg7IGkgKz0gMSkge1xyXG4gICAgICAgICAgICBmb3IgKGogPSAwOyBqIDwgcm91dGUubGVnW2ldLm1hbmV1dmVyLmxlbmd0aDsgaiArPSAxKSB7XHJcbiAgICAgICAgICAgICAgICAvLyBHZXQgdGhlIG5leHQgbWFuZXV2ZXIuXHJcbiAgICAgICAgICAgICAgICBtYW5ldXZlciA9IHJvdXRlLmxlZ1tpXS5tYW5ldXZlcltqXTtcclxuXHJcbiAgICAgICAgICAgICAgICB2YXIgbGkgPSBkb2N1bWVudC5jcmVhdGVFbGVtZW50KCdsaScpLFxyXG4gICAgICAgICAgICAgICAgICAgIHNwYW5BcnJvdyA9IGRvY3VtZW50LmNyZWF0ZUVsZW1lbnQoJ3NwYW4nKSxcclxuICAgICAgICAgICAgICAgICAgICBzcGFuSW5zdHJ1Y3Rpb24gPSBkb2N1bWVudC5jcmVhdGVFbGVtZW50KCdzcGFuJyk7XHJcblxyXG4gICAgICAgICAgICAgICAgc3BhbkFycm93LmNsYXNzTmFtZSA9ICdhcnJvdyAnICsgbWFuZXV2ZXIuYWN0aW9uO1xyXG4gICAgICAgICAgICAgICAgc3Bhbkluc3RydWN0aW9uLmlubmVySFRNTCA9IG1hbmV1dmVyLmluc3RydWN0aW9uO1xyXG4gICAgICAgICAgICAgICAgbGkuYXBwZW5kQ2hpbGQoc3BhbkFycm93KTtcclxuICAgICAgICAgICAgICAgIGxpLmFwcGVuZENoaWxkKHNwYW5JbnN0cnVjdGlvbik7XHJcblxyXG4gICAgICAgICAgICAgICAgbm9kZU9MLmFwcGVuZENoaWxkKGxpKTtcclxuICAgICAgICAgICAgfVxyXG4gICAgICAgIH1cclxuXHJcbiAgICAgICAgcm91dGVJbnN0cnVjdGlvbnNDb250YWluZXIuYXBwZW5kQ2hpbGQobm9kZU9MKTtcclxuICAgIH1cclxuXHJcbn07XHJcbiJdfQ==
