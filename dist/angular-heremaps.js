(function e(t,n,r){function s(o,u){if(!n[o]){if(!t[o]){var a=typeof require=="function"&&require;if(!u&&a)return a(o,!0);if(i)return i(o,!0);var f=new Error("Cannot find module '"+o+"'");throw f.code="MODULE_NOT_FOUND",f}var l=n[o]={exports:{}};t[o][0].call(l.exports,function(e){var n=t[o][1][e];return s(n?n:e)},l,l.exports,e,t,n,r)}return n[o].exports}var i=typeof require=="function"&&require;for(var o=0;o<r.length;o++)s(r[o]);return s})({1:[function(require,module,exports){
module.exports = HereMapsDirective;

HereMapsDirective.$inject = [
    '$timeout',
    '$window',
    '$rootScope',
    '$filter',
    'HereMapsConfig',
    'HereMapsAPIService',
    'HereMapsUtilsService',
    'HereMapsMarkerService',
    'HereMapsRoutesService',
    'HereMapsCONSTS',
    'HereMapsEventsFactory',
    'HereMapsUiFactory'
];
function HereMapsDirective(
    $timeout,
    $window,
    $rootScope,
    $filter,
    HereMapsConfig,
    HereMapsAPIService,
    HereMapsUtilsService,
    HereMapsMarkerService,
    HereMapsRoutesService,
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
                    _resizeHandler.apply(null, arguments);
                },
                getPlatform: function () {
                    return heremaps;
                },
                calculateRoute: function (driveType, direction) {
                    return HereMapsRoutesService.calculateRoute(heremaps, {
                        driveType: driveType,
                        direction: direction
                    });
                },
                addRouteToMap: function (routeData, clean) {
                    HereMapsRoutesService.addRouteToMap(heremaps.map, routeData, clean);
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
                    HereMapsRoutesService.cleanRoutes(heremaps.map);
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
    .service('HereMapsAPIService', require('./providers/api.service'))
    .constant('HereMapsCONSTS', require('./providers/consts'))
    .directive('heremaps', require('./heremaps.directive'));

},{"./heremaps.directive":1,"./providers/api.service":3,"./providers/consts":4,"./providers/map-modules":7,"./providers/mapconfig.provider":9,"./providers/maputils.service":10,"./providers/markers":13,"./providers/routes":17}],3:[function(require,module,exports){
module.exports = HereMapsAPIService;

HereMapsAPIService.$inject = [
    '$q',
    '$http',
    'HereMapsConfig',
    'HereMapsUtilsService',
    'HereMapsCONSTS'
];
function HereMapsAPIService($q, $http, HereMapsConfig, HereMapsUtilsService, HereMapsCONSTS) {
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
        geocodePosition: geocodePosition,
        geocodeAddress: geocodeAddress
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

    function geocodeAddress(platform, params) {
        if (!params)
            return console.error('Missed required parameters');

        var geocoder = platform.getGeocodingService(),
            deferred = $q.defer(),
            _params = { gen: 8 };

        for (var key in params) { _params[key] = params[key]; }

        geocoder.geocode(_params, function (response) {
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
module.exports = HereMapsEventsFactory;

HereMapsEventsFactory.$inject = [
    'HereMapsUtilsService',
    'HereMapsMarkerService',
    'HereMapsCONSTS',
    'HereMapsInfoBubbleFactory'
];
function HereMapsEventsFactory(HereMapsUtilsService, HereMapsMarkerService, HereMapsCONSTS, HereMapsInfoBubbleFactory) {
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
module.exports = HereMapsInfoBubbleFactory;

HereMapsInfoBubbleFactory.$inject = [
    'HereMapsMarkerService',
    'HereMapsUtilsService',
    'HereMapsCONSTS'
];
function HereMapsInfoBubbleFactory(HereMapsMarkerService, HereMapsUtilsService, HereMapsCONSTS) {
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
module.exports = HereMapsUiFactory;

HereMapsUiFactory.$inject = [
    'HereMapsAPIService',
    'HereMapsMarkerService',
    'HereMapsUtilsService',
    'HereMapsCONSTS'
];
function HereMapsUiFactory(HereMapsAPIService, HereMapsMarkerService, HereMapsUtilsService, HereMapsCONSTS) {
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

module.exports = HereMapsUtilsService;

HereMapsUtilsService.$inject = [
    '$rootScope', 
    '$timeout', 
    'HereMapsCONSTS'
];
function HereMapsUtilsService($rootScope, $timeout, HereMapsCONSTS) {
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
module.exports = HereMapsDefaultMarker;

HereMapsDefaultMarker.$inject = ['HereMapsMarkerInterface'];
function HereMapsDefaultMarker(HereMapsMarkerInterface){
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
module.exports = HereMapsDOMMarker;

HereMapsDOMMarker.$inject = ['HereMapsMarkerInterface'];
function HereMapsDOMMarker(HereMapsMarkerInterface){
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
module.exports = angular.module('heremaps-markers-module', [])
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
module.exports = HereMapsMarkerService;

HereMapsMarkerService.$inject = [
    'HereMapsDefaultMarker',
    'HereMapsDOMMarker',
    'HereMapsSVGMarker',
    'HereMapsCONSTS'
];
function HereMapsMarkerService(HereMapsDefaultMarker, HereMapsDOMMarker, HereMapsSVGMarker, HereMapsCONSTS) {
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
module.exports = HereMapsSVGMarker;

HereMapsSVGMarker.$inject = ['HereMapsMarkerInterface'];
function HereMapsSVGMarker(HereMapsMarkerInterface){
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
                    .service('HereMapsRoutesService', require('./routes.service.js'));  
},{"./routes.service.js":18}],18:[function(require,module,exports){
module.exports = HereMapsRoutesService;

HereMapsRoutesService.$inject = ['$q'];
function HereMapsRoutesService($q) {
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
            .replace(/{{MODE}}/, dir.mode || 'fastest')
            .replace(/{{VECHILE}}/, config.driveType);

        var routeRequestParams = {
            mode: mode,
            representation: dir.representation || 'display',
            language: dir.language || 'en-gb'
        };

        waypoints.forEach(function (waypoint, i) {
            routeRequestParams["waypoint" + i] = [waypoint.lat, waypoint.lng].join(',');
        });

        _setAttributes(routeRequestParams, dir.attrs);

        var deferred = $q.defer();

        router.calculateRoute(routeRequestParams, function (result) {
            deferred.resolve(result);
        }, function (error) {
            deferred.reject(error);
        });

        return deferred.promise;
    }

    function cleanRoutes(map) {
        var group = map.routesGroup;

        if (!group)
            return;

        group.removeAll();
        map.removeObject(group);
        map.routesGroup = null;
    }

    function addRouteToMap(map, routeData, clean) {
        if (clean)
            cleanRoutes(map);

        var route = routeData.route;

        if (!map || !route || !route.shape)
            return;

        var strip = new H.geo.Strip(), polyline = null;

        route.shape.forEach(function (point) {
            var parts = point.split(',');
            strip.pushLatLngAlt(parts[0], parts[1]);
        });

        var style = routeData.style || {};

        polyline = new H.map.Polyline(strip, {
            style: {
                lineWidth: style.lineWidth || 4,
                strokeColor: style.color || 'rgba(0, 128, 255, 0.7)'
            }
        });

        var group = map.routesGroup;

        if (!group) {
            group = map.routesGroup = new H.map.Group();
            map.addObject(group);
        }

        group.addObject(polyline);

        if(routeData.zoomToBounds) {
            map.setViewBounds(polyline.getBounds(), true);
        }
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
            group = new H.map.Group(), i, j;

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
//# sourceMappingURL=data:application/json;charset=utf-8;base64,eyJ2ZXJzaW9uIjozLCJzb3VyY2VzIjpbIm5vZGVfbW9kdWxlcy9icm93c2VyLXBhY2svX3ByZWx1ZGUuanMiLCJzcmMvaGVyZW1hcHMuZGlyZWN0aXZlLmpzIiwic3JjL2luZGV4LmpzIiwic3JjL3Byb3ZpZGVycy9hcGkuc2VydmljZS5qcyIsInNyYy9wcm92aWRlcnMvY29uc3RzLmpzIiwic3JjL3Byb3ZpZGVycy9tYXAtbW9kdWxlcy9ldmVudHMvZXZlbnRzLmpzIiwic3JjL3Byb3ZpZGVycy9tYXAtbW9kdWxlcy9ldmVudHMvaW5mb2J1YmJsZS5qcyIsInNyYy9wcm92aWRlcnMvbWFwLW1vZHVsZXMvaW5kZXguanMiLCJzcmMvcHJvdmlkZXJzL21hcC1tb2R1bGVzL3VpL3VpLmpzIiwic3JjL3Byb3ZpZGVycy9tYXBjb25maWcucHJvdmlkZXIuanMiLCJzcmMvcHJvdmlkZXJzL21hcHV0aWxzLnNlcnZpY2UuanMiLCJzcmMvcHJvdmlkZXJzL21hcmtlcnMvZGVmYXVsdC5tYXJrZXIuanMiLCJzcmMvcHJvdmlkZXJzL21hcmtlcnMvZG9tLm1hcmtlci5qcyIsInNyYy9wcm92aWRlcnMvbWFya2Vycy9pbmRleC5qcyIsInNyYy9wcm92aWRlcnMvbWFya2Vycy9tYXJrZXIuanMiLCJzcmMvcHJvdmlkZXJzL21hcmtlcnMvbWFya2Vycy5zZXJ2aWNlLmpzIiwic3JjL3Byb3ZpZGVycy9tYXJrZXJzL3N2Zy5tYXJrZXIuanMiLCJzcmMvcHJvdmlkZXJzL3JvdXRlcy9pbmRleC5qcyIsInNyYy9wcm92aWRlcnMvcm91dGVzL3JvdXRlcy5zZXJ2aWNlLmpzIl0sIm5hbWVzIjpbXSwibWFwcGluZ3MiOiJBQUFBO0FDQUE7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTs7QUN2UEE7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBOztBQ2RBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7O0FDelFBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTs7QUNqRUE7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBOztBQ2xHQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBOztBQzNGQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBOztBQ1ZBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7O0FDcEdBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTs7QUNqQkE7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTs7QUM1SEE7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBOztBQ3ZCQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBOztBQzlDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7O0FDTEE7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTs7QUNsQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBOztBQ3JHQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBOztBQ2xDQTtBQUNBOztBQ0RBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0EiLCJmaWxlIjoiZ2VuZXJhdGVkLmpzIiwic291cmNlUm9vdCI6IiIsInNvdXJjZXNDb250ZW50IjpbIihmdW5jdGlvbiBlKHQsbixyKXtmdW5jdGlvbiBzKG8sdSl7aWYoIW5bb10pe2lmKCF0W29dKXt2YXIgYT10eXBlb2YgcmVxdWlyZT09XCJmdW5jdGlvblwiJiZyZXF1aXJlO2lmKCF1JiZhKXJldHVybiBhKG8sITApO2lmKGkpcmV0dXJuIGkobywhMCk7dmFyIGY9bmV3IEVycm9yKFwiQ2Fubm90IGZpbmQgbW9kdWxlICdcIitvK1wiJ1wiKTt0aHJvdyBmLmNvZGU9XCJNT0RVTEVfTk9UX0ZPVU5EXCIsZn12YXIgbD1uW29dPXtleHBvcnRzOnt9fTt0W29dWzBdLmNhbGwobC5leHBvcnRzLGZ1bmN0aW9uKGUpe3ZhciBuPXRbb11bMV1bZV07cmV0dXJuIHMobj9uOmUpfSxsLGwuZXhwb3J0cyxlLHQsbixyKX1yZXR1cm4gbltvXS5leHBvcnRzfXZhciBpPXR5cGVvZiByZXF1aXJlPT1cImZ1bmN0aW9uXCImJnJlcXVpcmU7Zm9yKHZhciBvPTA7bzxyLmxlbmd0aDtvKyspcyhyW29dKTtyZXR1cm4gc30pIiwibW9kdWxlLmV4cG9ydHMgPSBIZXJlTWFwc0RpcmVjdGl2ZTtcblxuSGVyZU1hcHNEaXJlY3RpdmUuJGluamVjdCA9IFtcbiAgICAnJHRpbWVvdXQnLFxuICAgICckd2luZG93JyxcbiAgICAnJHJvb3RTY29wZScsXG4gICAgJyRmaWx0ZXInLFxuICAgICdIZXJlTWFwc0NvbmZpZycsXG4gICAgJ0hlcmVNYXBzQVBJU2VydmljZScsXG4gICAgJ0hlcmVNYXBzVXRpbHNTZXJ2aWNlJyxcbiAgICAnSGVyZU1hcHNNYXJrZXJTZXJ2aWNlJyxcbiAgICAnSGVyZU1hcHNSb3V0ZXNTZXJ2aWNlJyxcbiAgICAnSGVyZU1hcHNDT05TVFMnLFxuICAgICdIZXJlTWFwc0V2ZW50c0ZhY3RvcnknLFxuICAgICdIZXJlTWFwc1VpRmFjdG9yeSdcbl07XG5mdW5jdGlvbiBIZXJlTWFwc0RpcmVjdGl2ZShcbiAgICAkdGltZW91dCxcbiAgICAkd2luZG93LFxuICAgICRyb290U2NvcGUsXG4gICAgJGZpbHRlcixcbiAgICBIZXJlTWFwc0NvbmZpZyxcbiAgICBIZXJlTWFwc0FQSVNlcnZpY2UsXG4gICAgSGVyZU1hcHNVdGlsc1NlcnZpY2UsXG4gICAgSGVyZU1hcHNNYXJrZXJTZXJ2aWNlLFxuICAgIEhlcmVNYXBzUm91dGVzU2VydmljZSxcbiAgICBIZXJlTWFwc0NPTlNUUyxcbiAgICBIZXJlTWFwc0V2ZW50c0ZhY3RvcnksXG4gICAgSGVyZU1hcHNVaUZhY3RvcnkpIHtcbiAgICAgICAgXG4gICAgSGVyZU1hcHNEaXJlY3RpdmVDdHJsLiRpbmplY3QgPSBbJyRzY29wZScsICckZWxlbWVudCcsICckYXR0cnMnXTtcbiAgICAgICAgXG4gICAgcmV0dXJuIHtcbiAgICAgICAgcmVzdHJpY3Q6ICdFQScsXG4gICAgICAgIHRlbXBsYXRlOiBcIjxkaXYgbmctc3R5bGU9XFxcInsnd2lkdGgnOiBtYXBXaWR0aCwgJ2hlaWdodCc6IG1hcEhlaWdodH1cXFwiPjwvZGl2PlwiLFxuICAgICAgICByZXBsYWNlOiB0cnVlLFxuICAgICAgICBzY29wZToge1xuICAgICAgICAgICAgb3B0czogJyZvcHRpb25zJyxcbiAgICAgICAgICAgIHBsYWNlczogJyYnLFxuICAgICAgICAgICAgb25NYXBSZWFkeTogXCImbWFwUmVhZHlcIixcbiAgICAgICAgICAgIGV2ZW50czogJyYnXG4gICAgICAgIH0sXG4gICAgICAgIGNvbnRyb2xsZXI6IEhlcmVNYXBzRGlyZWN0aXZlQ3RybFxuICAgIH1cbiAgICBcbiAgICBmdW5jdGlvbiBIZXJlTWFwc0RpcmVjdGl2ZUN0cmwoJHNjb3BlLCAkZWxlbWVudCwgJGF0dHJzKSB7XG4gICAgICAgIHZhciBDT05UUk9MX05BTUVTID0gSGVyZU1hcHNDT05TVFMuQ09OVFJPTFMuTkFNRVMsXG4gICAgICAgICAgICBwbGFjZXMgPSAkc2NvcGUucGxhY2VzKCksXG4gICAgICAgICAgICBvcHRzID0gJHNjb3BlLm9wdHMoKSxcbiAgICAgICAgICAgIGxpc3RlbmVycyA9ICRzY29wZS5ldmVudHMoKTtcblxuICAgICAgICB2YXIgb3B0aW9ucyA9IGFuZ3VsYXIuZXh0ZW5kKHt9LCBIZXJlTWFwc0NPTlNUUy5ERUZBVUxUX01BUF9PUFRJT05TLCBvcHRzKSxcbiAgICAgICAgICAgIHBvc2l0aW9uID0gSGVyZU1hcHNVdGlsc1NlcnZpY2UuaXNWYWxpZENvb3JkcyhvcHRpb25zLmNvb3JkcykgPyBcbiAgICAgICAgICAgICAgICAgICAgICAgIG9wdGlvbnMuY29vcmRzIDogSGVyZU1hcHNDT05TVFMuREVGQVVMVF9NQVBfT1BUSU9OUy5jb29yZHM7XG5cbiAgICAgICAgdmFyIGhlcmVtYXBzID0geyBpZDogSGVyZU1hcHNVdGlsc1NlcnZpY2UuZ2VuZXJhdGVJZCgpIH0sXG4gICAgICAgICAgICBtYXBSZWFkeSA9ICRzY29wZS5vbk1hcFJlYWR5KCksXG4gICAgICAgICAgICBfb25SZXNpemVNYXAgPSBudWxsO1xuXG4gICAgICAgICR0aW1lb3V0KGZ1bmN0aW9uICgpIHtcbiAgICAgICAgICAgIHJldHVybiBfc2V0TWFwU2l6ZSgpO1xuICAgICAgICB9KS50aGVuKGZ1bmN0aW9uICgpIHtcbiAgICAgICAgICAgIEhlcmVNYXBzQVBJU2VydmljZS5sb2FkQXBpKCkudGhlbihfYXBpUmVhZHkpO1xuICAgICAgICB9KTtcblxuICAgICAgICBvcHRpb25zLnJlc2l6ZSAmJiBhZGRPblJlc2l6ZUxpc3RlbmVyKCk7XG5cbiAgICAgICAgJHNjb3BlLiRvbignJGRlc3Ryb3knLCBmdW5jdGlvbiAoKSB7XG4gICAgICAgICAgICAkd2luZG93LnJlbW92ZUV2ZW50TGlzdGVuZXIoJ3Jlc2l6ZScsIF9vblJlc2l6ZU1hcCk7XG4gICAgICAgIH0pO1xuXG4gICAgICAgIGZ1bmN0aW9uIGFkZE9uUmVzaXplTGlzdGVuZXIoKSB7XG4gICAgICAgICAgICBfb25SZXNpemVNYXAgPSBIZXJlTWFwc1V0aWxzU2VydmljZS50aHJvdHRsZShfcmVzaXplSGFuZGxlciwgSGVyZU1hcHNDT05TVFMuVVBEQVRFX01BUF9SRVNJWkVfVElNRU9VVCk7XG4gICAgICAgICAgICAkd2luZG93LmFkZEV2ZW50TGlzdGVuZXIoJ3Jlc2l6ZScsIF9vblJlc2l6ZU1hcCk7XG4gICAgICAgIH1cblxuICAgICAgICBmdW5jdGlvbiBfYXBpUmVhZHkoKSB7XG4gICAgICAgICAgICBfc2V0dXBNYXBQbGF0Zm9ybSgpO1xuICAgICAgICAgICAgX3NldHVwTWFwKCk7XG4gICAgICAgIH1cblxuICAgICAgICBmdW5jdGlvbiBfc2V0dXBNYXBQbGF0Zm9ybSgpIHtcbiAgICAgICAgICAgIGlmICghSGVyZU1hcHNDb25maWcuYXBwX2lkIHx8ICFIZXJlTWFwc0NvbmZpZy5hcHBfY29kZSlcbiAgICAgICAgICAgICAgICB0aHJvdyBuZXcgRXJyb3IoJ2FwcF9pZCBvciBhcHBfY29kZSB3ZXJlIG1pc3NlZC4gUGxlYXNlIHNwZWNpZnkgdGhlaXIgaW4gSGVyZU1hcHNDb25maWcnKTtcbiAgICAgICAgICAgIFxuICAgICAgICAgICAgaGVyZW1hcHMucGxhdGZvcm0gPSBuZXcgSC5zZXJ2aWNlLlBsYXRmb3JtKEhlcmVNYXBzQ29uZmlnKTtcbiAgICAgICAgICAgIGhlcmVtYXBzLmxheWVycyA9IGhlcmVtYXBzLnBsYXRmb3JtLmNyZWF0ZURlZmF1bHRMYXllcnMoKTtcbiAgICAgICAgfVxuXG4gICAgICAgIGZ1bmN0aW9uIF9nZXRMb2NhdGlvbihlbmFibGVIaWdoQWNjdXJhY3ksIG1heGltdW1BZ2UpIHtcbiAgICAgICAgICAgIHZhciBfZW5hYmxlSGlnaEFjY3VyYWN5ID0gISFlbmFibGVIaWdoQWNjdXJhY3ksXG4gICAgICAgICAgICAgICAgX21heGltdW1BZ2UgPSBtYXhpbXVtQWdlIHx8IDA7XG5cbiAgICAgICAgICAgIHJldHVybiBIZXJlTWFwc0FQSVNlcnZpY2UuZ2V0UG9zaXRpb24oe1xuICAgICAgICAgICAgICAgIGVuYWJsZUhpZ2hBY2N1cmFjeTogX2VuYWJsZUhpZ2hBY2N1cmFjeSxcbiAgICAgICAgICAgICAgICBtYXhpbXVtQWdlOiBfbWF4aW11bUFnZVxuICAgICAgICAgICAgfSk7XG4gICAgICAgIH1cblxuICAgICAgICBmdW5jdGlvbiBfbG9jYXRpb25GYWlsdXJlKCkge1xuICAgICAgICAgICAgY29uc29sZS5lcnJvcignQ2FuIG5vdCBnZXQgYSBnZW8gcG9zaXRpb24nKTtcbiAgICAgICAgfVxuXG4gICAgICAgIGZ1bmN0aW9uIF9zZXR1cE1hcCgpIHtcbiAgICAgICAgICAgIF9pbml0TWFwKGZ1bmN0aW9uICgpIHtcbiAgICAgICAgICAgICAgICBIZXJlTWFwc0FQSVNlcnZpY2UubG9hZE1vZHVsZXMoJGF0dHJzLiRhdHRyLCB7XG4gICAgICAgICAgICAgICAgICAgIFwiY29udHJvbHNcIjogX3VpTW9kdWxlUmVhZHksXG4gICAgICAgICAgICAgICAgICAgIFwiZXZlbnRzXCI6IF9ldmVudHNNb2R1bGVSZWFkeVxuICAgICAgICAgICAgICAgIH0pO1xuICAgICAgICAgICAgfSk7XG4gICAgICAgIH1cblxuICAgICAgICBmdW5jdGlvbiBfaW5pdE1hcChjYikge1xuICAgICAgICAgICAgdmFyIG1hcCA9IGhlcmVtYXBzLm1hcCA9IG5ldyBILk1hcCgkZWxlbWVudFswXSwgaGVyZW1hcHMubGF5ZXJzLm5vcm1hbC5tYXAsIHtcbiAgICAgICAgICAgICAgICB6b29tOiBIZXJlTWFwc1V0aWxzU2VydmljZS5pc1ZhbGlkQ29vcmRzKHBvc2l0aW9uKSA/IG9wdGlvbnMuem9vbSA6IG9wdGlvbnMubWF4Wm9vbSxcbiAgICAgICAgICAgICAgICBjZW50ZXI6IG5ldyBILmdlby5Qb2ludChwb3NpdGlvbi5sYXRpdHVkZSwgcG9zaXRpb24ubG9uZ2l0dWRlKVxuICAgICAgICAgICAgfSk7XG5cbiAgICAgICAgICAgIEhlcmVNYXBzTWFya2VyU2VydmljZS5hZGRNYXJrZXJzVG9NYXAobWFwLCBwbGFjZXMsIHRydWUpO1xuXG4gICAgICAgICAgICBtYXBSZWFkeSAmJiBtYXBSZWFkeShNYXBQcm94eSgpKTtcblxuICAgICAgICAgICAgY2IgJiYgY2IoKTtcbiAgICAgICAgICAgICAgICBcbiAgICAgICAgfVxuXG4gICAgICAgIGZ1bmN0aW9uIF91aU1vZHVsZVJlYWR5KCkge1xuICAgICAgICAgICAgSGVyZU1hcHNVaUZhY3Rvcnkuc3RhcnQoe1xuICAgICAgICAgICAgICAgIHBsYXRmb3JtOiBoZXJlbWFwcyxcbiAgICAgICAgICAgICAgICBhbGlnbm1lbnQ6ICRhdHRycy5jb250cm9sc1xuICAgICAgICAgICAgfSk7XG4gICAgICAgIH1cblxuICAgICAgICBmdW5jdGlvbiBfZXZlbnRzTW9kdWxlUmVhZHkoKSB7XG4gICAgICAgICAgICBIZXJlTWFwc0V2ZW50c0ZhY3Rvcnkuc3RhcnQoe1xuICAgICAgICAgICAgICAgIHBsYXRmb3JtOiBoZXJlbWFwcyxcbiAgICAgICAgICAgICAgICBsaXN0ZW5lcnM6IGxpc3RlbmVycyxcbiAgICAgICAgICAgICAgICBvcHRpb25zOiBvcHRpb25zLFxuICAgICAgICAgICAgICAgIGluamVjdG9yOiBfbW9kdWxlSW5qZWN0b3JcbiAgICAgICAgICAgIH0pO1xuICAgICAgICB9XG5cbiAgICAgICAgZnVuY3Rpb24gX21vZHVsZUluamVjdG9yKCkge1xuICAgICAgICAgICAgcmV0dXJuIGZ1bmN0aW9uIChpZCkge1xuICAgICAgICAgICAgICAgIHJldHVybiBoZXJlbWFwc1tpZF07XG4gICAgICAgICAgICB9XG4gICAgICAgIH1cblxuICAgICAgICBmdW5jdGlvbiBfcmVzaXplSGFuZGxlcihoZWlnaHQsIHdpZHRoKSB7XG4gICAgICAgICAgICBfc2V0TWFwU2l6ZS5hcHBseShudWxsLCBhcmd1bWVudHMpO1xuXG4gICAgICAgICAgICBoZXJlbWFwcy5tYXAuZ2V0Vmlld1BvcnQoKS5yZXNpemUoKTtcbiAgICAgICAgfVxuXG4gICAgICAgIGZ1bmN0aW9uIF9zZXRNYXBTaXplKGhlaWdodCwgd2lkdGgpIHtcbiAgICAgICAgICAgIHZhciBoZWlnaHQgPSBoZWlnaHQgfHwgJGVsZW1lbnRbMF0ucGFyZW50Tm9kZS5vZmZzZXRIZWlnaHQgfHwgb3B0aW9ucy5oZWlnaHQsXG4gICAgICAgICAgICAgICAgd2lkdGggPSB3aWR0aCB8fCAkZWxlbWVudFswXS5wYXJlbnROb2RlLm9mZnNldFdpZHRoIHx8IG9wdGlvbnMud2lkdGg7XG5cbiAgICAgICAgICAgICRzY29wZS5tYXBIZWlnaHQgPSBoZWlnaHQgKyAncHgnO1xuICAgICAgICAgICAgJHNjb3BlLm1hcFdpZHRoID0gd2lkdGggKyAncHgnO1xuICAgICAgICAgICAgXG4gICAgICAgICAgICBIZXJlTWFwc1V0aWxzU2VydmljZS5ydW5TY29wZURpZ2VzdElmTmVlZCgkc2NvcGUpO1xuICAgICAgICB9XG5cbiAgICAgICAgZnVuY3Rpb24gTWFwUHJveHkoKSB7XG4gICAgICAgICAgICByZXR1cm4ge1xuICAgICAgICAgICAgICAgIHJlZnJlc2g6IGZ1bmN0aW9uKCl7XG4gICAgICAgICAgICAgICAgICAgIHZhciBjdXJyZW50Qm91bmRzID0gdGhpcy5nZXRWaWV3Qm91bmRzKCk7XG4gICAgICAgICAgICAgICAgICAgIFxuICAgICAgICAgICAgICAgICAgICB0aGlzLnNldE1hcFNpemVzKCk7XG4gICAgICAgICAgICAgICAgICAgIHRoaXMuc2V0Vmlld0JvdW5kcyhjdXJyZW50Qm91bmRzKTtcbiAgICAgICAgICAgICAgICB9LFxuICAgICAgICAgICAgICAgIHNldE1hcFNpemVzOiBmdW5jdGlvbihoZWlnaHQsIHdpZHRoKXtcbiAgICAgICAgICAgICAgICAgICAgX3Jlc2l6ZUhhbmRsZXIuYXBwbHkobnVsbCwgYXJndW1lbnRzKTtcbiAgICAgICAgICAgICAgICB9LFxuICAgICAgICAgICAgICAgIGdldFBsYXRmb3JtOiBmdW5jdGlvbiAoKSB7XG4gICAgICAgICAgICAgICAgICAgIHJldHVybiBoZXJlbWFwcztcbiAgICAgICAgICAgICAgICB9LFxuICAgICAgICAgICAgICAgIGNhbGN1bGF0ZVJvdXRlOiBmdW5jdGlvbiAoZHJpdmVUeXBlLCBkaXJlY3Rpb24pIHtcbiAgICAgICAgICAgICAgICAgICAgcmV0dXJuIEhlcmVNYXBzUm91dGVzU2VydmljZS5jYWxjdWxhdGVSb3V0ZShoZXJlbWFwcywge1xuICAgICAgICAgICAgICAgICAgICAgICAgZHJpdmVUeXBlOiBkcml2ZVR5cGUsXG4gICAgICAgICAgICAgICAgICAgICAgICBkaXJlY3Rpb246IGRpcmVjdGlvblxuICAgICAgICAgICAgICAgICAgICB9KTtcbiAgICAgICAgICAgICAgICB9LFxuICAgICAgICAgICAgICAgIGFkZFJvdXRlVG9NYXA6IGZ1bmN0aW9uIChyb3V0ZURhdGEsIGNsZWFuKSB7XG4gICAgICAgICAgICAgICAgICAgIEhlcmVNYXBzUm91dGVzU2VydmljZS5hZGRSb3V0ZVRvTWFwKGhlcmVtYXBzLm1hcCwgcm91dGVEYXRhLCBjbGVhbik7XG4gICAgICAgICAgICAgICAgfSxcbiAgICAgICAgICAgICAgICBzZXRab29tOiBmdW5jdGlvbiAoem9vbSwgc3RlcCkge1xuICAgICAgICAgICAgICAgICAgICBIZXJlTWFwc1V0aWxzU2VydmljZS56b29tKGhlcmVtYXBzLm1hcCwgem9vbSB8fCAxMCwgc3RlcCk7XG4gICAgICAgICAgICAgICAgfSxcbiAgICAgICAgICAgICAgICBnZXRab29tOiBmdW5jdGlvbigpe1xuICAgICAgICAgICAgICAgICAgICByZXR1cm4gaGVyZW1hcHMubWFwLmdldFpvb20oKTsgIFxuICAgICAgICAgICAgICAgIH0sXG4gICAgICAgICAgICAgICAgZ2V0Q2VudGVyOiBmdW5jdGlvbigpe1xuICAgICAgICAgICAgICAgICAgICByZXR1cm4gaGVyZW1hcHMubWFwLmdldENlbnRlcigpOyAgXG4gICAgICAgICAgICAgICAgfSxcbiAgICAgICAgICAgICAgICBnZXRWaWV3Qm91bmRzOiBmdW5jdGlvbigpe1xuICAgICAgICAgICAgICAgICAgICByZXR1cm4gaGVyZW1hcHMubWFwLmdldFZpZXdCb3VuZHMoKTsgICBcbiAgICAgICAgICAgICAgICB9LFxuICAgICAgICAgICAgICAgIHNldFZpZXdCb3VuZHM6IGZ1bmN0aW9uKGJvdW5kaW5nUmVjdCwgb3B0X2FuaW1hdGUpe1xuICAgICAgICAgICAgICAgICAgICBoZXJlbWFwcy5tYXAuc2V0Vmlld0JvdW5kcyhib3VuZGluZ1JlY3QsIG9wdF9hbmltYXRlKTtcbiAgICAgICAgICAgICAgICB9LFxuICAgICAgICAgICAgICAgIHNldENlbnRlcjogZnVuY3Rpb24gKGNvb3Jkcykge1xuICAgICAgICAgICAgICAgICAgICBpZiAoIWNvb3Jkcykge1xuICAgICAgICAgICAgICAgICAgICAgICAgcmV0dXJuIGNvbnNvbGUuZXJyb3IoJ2Nvb3JkcyBhcmUgbm90IHNwZWNpZmllZCEnKTtcbiAgICAgICAgICAgICAgICAgICAgfVxuXG4gICAgICAgICAgICAgICAgICAgIGhlcmVtYXBzLm1hcC5zZXRDZW50ZXIoY29vcmRzKTtcbiAgICAgICAgICAgICAgICB9LFxuICAgICAgICAgICAgICAgIGNsZWFuUm91dGVzOiBmdW5jdGlvbiAoKSB7XG4gICAgICAgICAgICAgICAgICAgIEhlcmVNYXBzUm91dGVzU2VydmljZS5jbGVhblJvdXRlcyhoZXJlbWFwcy5tYXApO1xuICAgICAgICAgICAgICAgIH0sXG5cbiAgICAgICAgICAgICAgICAvKipcbiAgICAgICAgICAgICAgICAgKiBAcGFyYW0ge0Jvb2xlYW59IGVuYWJsZUhpZ2hBY2N1cmFjeVxuICAgICAgICAgICAgICAgICAqIEBwYXJhbSB7TnVtYmVyfSBtYXhpbXVtQWdlIC0gdGhlIG1heGltdW0gYWdlIGluIG1pbGxpc2Vjb25kcyBvZiBhIHBvc3NpYmxlIGNhY2hlZCBwb3NpdGlvbiB0aGF0IGlzIGFjY2VwdGFibGUgdG8gcmV0dXJuLiBJZiBzZXQgdG8gMCwgaXQgbWVhbnMgdGhhdCB0aGUgZGV2aWNlIGNhbm5vdCB1c2UgYSBjYWNoZWQgcG9zaXRpb24gYW5kIG11c3QgYXR0ZW1wdCB0byByZXRyaWV2ZSB0aGUgcmVhbCBjdXJyZW50IHBvc2l0aW9uXG4gICAgICAgICAgICAgICAgICogQHJldHVybiB7UHJvbWlzZX1cbiAgICAgICAgICAgICAgICAgKi9cbiAgICAgICAgICAgICAgICBnZXRVc2VyTG9jYXRpb246IGZ1bmN0aW9uIChlbmFibGVIaWdoQWNjdXJhY3ksIG1heGltdW1BZ2UpIHtcbiAgICAgICAgICAgICAgICAgICAgcmV0dXJuIF9nZXRMb2NhdGlvbi5hcHBseShudWxsLCBhcmd1bWVudHMpLnRoZW4oZnVuY3Rpb24gKHBvc2l0aW9uKSB7XG4gICAgICAgICAgICAgICAgICAgICAgICB2YXIgY29vcmRzID0gcG9zaXRpb24uY29vcmRzO1xuXG4gICAgICAgICAgICAgICAgICAgICAgICBIZXJlTWFwc01hcmtlclNlcnZpY2UuYWRkVXNlck1hcmtlcihoZXJlbWFwcy5tYXAsIHtcbiAgICAgICAgICAgICAgICAgICAgICAgICAgICBwb3M6IHtcbiAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgbGF0OiBjb29yZHMubGF0aXR1ZGUsXG4gICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgIGxuZzogY29vcmRzLmxvbmdpdHVkZVxuICAgICAgICAgICAgICAgICAgICAgICAgICAgIH1cbiAgICAgICAgICAgICAgICAgICAgICAgIH0pO1xuXG4gICAgICAgICAgICAgICAgICAgICAgICByZXR1cm4gY29vcmRzO1xuICAgICAgICAgICAgICAgICAgICB9KVxuICAgICAgICAgICAgICAgIH0sXG4gICAgICAgICAgICAgICAgZ2VvY29kZVBvc2l0aW9uOiBmdW5jdGlvbiAoY29vcmRzLCBvcHRpb25zKSB7XG4gICAgICAgICAgICAgICAgICAgIHJldHVybiBIZXJlTWFwc0FQSVNlcnZpY2UuZ2VvY29kZVBvc2l0aW9uKGhlcmVtYXBzLnBsYXRmb3JtLCB7XG4gICAgICAgICAgICAgICAgICAgICAgICBjb29yZHM6IGNvb3JkcyxcbiAgICAgICAgICAgICAgICAgICAgICAgIHJhZGl1czogb3B0aW9ucyAmJiBvcHRpb25zLnJhZGl1cyxcbiAgICAgICAgICAgICAgICAgICAgICAgIGxhbmc6IG9wdGlvbnMgJiYgb3B0aW9ucy5sYW5nXG4gICAgICAgICAgICAgICAgICAgIH0pO1xuICAgICAgICAgICAgICAgIH0sXG4gICAgICAgICAgICAgICAgdXBkYXRlTWFya2VyczogZnVuY3Rpb24gKHBsYWNlcywgcmVmcmVzaFZpZXdib3VuZHMpIHtcbiAgICAgICAgICAgICAgICAgICAgSGVyZU1hcHNNYXJrZXJTZXJ2aWNlLnVwZGF0ZU1hcmtlcnMoaGVyZW1hcHMubWFwLCBwbGFjZXMsIHJlZnJlc2hWaWV3Ym91bmRzKTtcbiAgICAgICAgICAgICAgICB9XG4gICAgICAgICAgICB9XG4gICAgICAgIH1cblxuICAgIH1cbn07XG4iLCJyZXF1aXJlKCcuL3Byb3ZpZGVycy9tYXJrZXJzJyk7XG5yZXF1aXJlKCcuL3Byb3ZpZGVycy9tYXAtbW9kdWxlcycpO1xucmVxdWlyZSgnLi9wcm92aWRlcnMvcm91dGVzJyk7XG5cbm1vZHVsZS5leHBvcnRzID0gYW5ndWxhci5tb2R1bGUoJ2hlcmVtYXBzJywgW1xuICAgICdoZXJlbWFwcy1tYXJrZXJzLW1vZHVsZScsXG4gICAgJ2hlcmVtYXBzLXJvdXRlcy1tb2R1bGUnLFxuICAgICdoZXJlbWFwcy1tYXAtbW9kdWxlcydcbl0pXG4gICAgLnByb3ZpZGVyKCdIZXJlTWFwc0NvbmZpZycsIHJlcXVpcmUoJy4vcHJvdmlkZXJzL21hcGNvbmZpZy5wcm92aWRlcicpKVxuICAgIC5zZXJ2aWNlKCdIZXJlTWFwc1V0aWxzU2VydmljZScsIHJlcXVpcmUoJy4vcHJvdmlkZXJzL21hcHV0aWxzLnNlcnZpY2UnKSlcbiAgICAuc2VydmljZSgnSGVyZU1hcHNBUElTZXJ2aWNlJywgcmVxdWlyZSgnLi9wcm92aWRlcnMvYXBpLnNlcnZpY2UnKSlcbiAgICAuY29uc3RhbnQoJ0hlcmVNYXBzQ09OU1RTJywgcmVxdWlyZSgnLi9wcm92aWRlcnMvY29uc3RzJykpXG4gICAgLmRpcmVjdGl2ZSgnaGVyZW1hcHMnLCByZXF1aXJlKCcuL2hlcmVtYXBzLmRpcmVjdGl2ZScpKTtcbiIsIm1vZHVsZS5leHBvcnRzID0gSGVyZU1hcHNBUElTZXJ2aWNlO1xuXG5IZXJlTWFwc0FQSVNlcnZpY2UuJGluamVjdCA9IFtcbiAgICAnJHEnLFxuICAgICckaHR0cCcsXG4gICAgJ0hlcmVNYXBzQ29uZmlnJyxcbiAgICAnSGVyZU1hcHNVdGlsc1NlcnZpY2UnLFxuICAgICdIZXJlTWFwc0NPTlNUUydcbl07XG5mdW5jdGlvbiBIZXJlTWFwc0FQSVNlcnZpY2UoJHEsICRodHRwLCBIZXJlTWFwc0NvbmZpZywgSGVyZU1hcHNVdGlsc1NlcnZpY2UsIEhlcmVNYXBzQ09OU1RTKSB7XG4gICAgdmFyIHZlcnNpb24gPSBIZXJlTWFwc0NvbmZpZy5hcGlWZXJzaW9uLFxuICAgICAgICBwcm90b2NvbCA9IEhlcmVNYXBzQ29uZmlnLnVzZUhUVFBTID8gJ2h0dHBzJyA6ICdodHRwJztcblxuICAgIHZhciBBUElfVkVSU0lPTiA9IHtcbiAgICAgICAgVjogcGFyc2VJbnQodmVyc2lvbiksXG4gICAgICAgIFNVQjogdmVyc2lvblxuICAgIH07XG5cbiAgICB2YXIgQ09ORklHID0ge1xuICAgICAgICBCQVNFOiBcIjovL2pzLmFwaS5oZXJlLmNvbS92XCIsXG4gICAgICAgIENPUkU6IFwibWFwc2pzLWNvcmUuanNcIixcbiAgICAgICAgU0VSVklDRTogXCJtYXBzanMtc2VydmljZS5qc1wiLFxuICAgICAgICBVSToge1xuICAgICAgICAgICAgc3JjOiBcIm1hcHNqcy11aS5qc1wiLFxuICAgICAgICAgICAgaHJlZjogXCJtYXBzanMtdWkuY3NzXCJcbiAgICAgICAgfSxcbiAgICAgICAgRVZFTlRTOiBcIm1hcHNqcy1tYXBldmVudHMuanNcIlxuICAgIH07XG5cbiAgICB2YXIgQVBJX0RFRkVSU1F1ZXVlID0ge307XG5cbiAgICBBUElfREVGRVJTUXVldWVbQ09ORklHLkNPUkVdID0gW107XG4gICAgQVBJX0RFRkVSU1F1ZXVlW0NPTkZJRy5TRVJWSUNFXSA9IFtdO1xuICAgIEFQSV9ERUZFUlNRdWV1ZVtDT05GSUcuVUkuc3JjXSA9IFtdO1xuICAgIEFQSV9ERUZFUlNRdWV1ZVtDT05GSUcuUEFOT10gPSBbXTtcbiAgICBBUElfREVGRVJTUXVldWVbQ09ORklHLkVWRU5UU10gPSBbXTtcblxuICAgIHZhciBoZWFkID0gZG9jdW1lbnQuZ2V0RWxlbWVudHNCeVRhZ05hbWUoJ2hlYWQnKVswXTtcblxuICAgIHJldHVybiB7XG4gICAgICAgIGxvYWRBcGk6IGxvYWRBcGksXG4gICAgICAgIGxvYWRNb2R1bGVzOiBsb2FkTW9kdWxlcyxcbiAgICAgICAgZ2V0UG9zaXRpb246IGdldFBvc2l0aW9uLFxuICAgICAgICBnZW9jb2RlUG9zaXRpb246IGdlb2NvZGVQb3NpdGlvbixcbiAgICAgICAgZ2VvY29kZUFkZHJlc3M6IGdlb2NvZGVBZGRyZXNzXG4gICAgfTtcblxuICAgIC8vI3JlZ2lvbiBQVUJMSUNcbiAgICBmdW5jdGlvbiBsb2FkQXBpKCkge1xuICAgICAgICByZXR1cm4gX2dldExvYWRlcihDT05GSUcuQ09SRSlcbiAgICAgICAgICAgIC50aGVuKGZ1bmN0aW9uICgpIHtcbiAgICAgICAgICAgICAgICByZXR1cm4gX2dldExvYWRlcihDT05GSUcuU0VSVklDRSk7XG4gICAgICAgICAgICB9KTtcbiAgICB9XG5cbiAgICBmdW5jdGlvbiBsb2FkTW9kdWxlcyhhdHRycywgaGFuZGxlcnMpIHtcbiAgICAgICAgZm9yICh2YXIga2V5IGluIGhhbmRsZXJzKSB7XG4gICAgICAgICAgICBpZiAoIWhhbmRsZXJzLmhhc093blByb3BlcnR5KGtleSkgfHwgIWF0dHJzW2tleV0pXG4gICAgICAgICAgICAgICAgY29udGludWU7XG5cbiAgICAgICAgICAgIHZhciBsb2FkZXIgPSBfZ2V0TG9hZGVyQnlBdHRyKGtleSk7XG5cbiAgICAgICAgICAgIGxvYWRlcigpXG4gICAgICAgICAgICAgICAgLnRoZW4oaGFuZGxlcnNba2V5XSk7XG4gICAgICAgIH1cbiAgICB9XG5cbiAgICBmdW5jdGlvbiBnZXRQb3NpdGlvbihvcHRpb25zKSB7XG4gICAgICAgIHZhciBkZWZlcnJlZCA9ICRxLmRlZmVyKCk7XG5cbiAgICAgICAgaWYgKG9wdGlvbnMgJiYgX2lzVmFsaWRDb29yZHMob3B0aW9ucy5jb29yZHMpKSB7XG4gICAgICAgICAgICBkZWZlcnJlZC5yZXNvbHZlKHsgY29vcmRzOiBvcHRpb25zLmNvb3JkcyB9KTtcbiAgICAgICAgfSBlbHNlIHtcbiAgICAgICAgICAgIG5hdmlnYXRvci5nZW9sb2NhdGlvbi5nZXRDdXJyZW50UG9zaXRpb24oZnVuY3Rpb24gKHJlc3BvbnNlKSB7XG4gICAgICAgICAgICAgICAgZGVmZXJyZWQucmVzb2x2ZShyZXNwb25zZSk7XG4gICAgICAgICAgICB9LCBmdW5jdGlvbiAoZXJyb3IpIHtcbiAgICAgICAgICAgICAgICBkZWZlcnJlZC5yZWplY3QoZXJyb3IpO1xuICAgICAgICAgICAgfSwgb3B0aW9ucyk7XG4gICAgICAgIH1cblxuICAgICAgICByZXR1cm4gZGVmZXJyZWQucHJvbWlzZTtcbiAgICB9XG5cbiAgICBmdW5jdGlvbiBnZW9jb2RlUG9zaXRpb24ocGxhdGZvcm0sIHBhcmFtcykge1xuICAgICAgICBpZiAoIXBhcmFtcy5jb29yZHMpXG4gICAgICAgICAgICByZXR1cm4gY29uc29sZS5lcnJvcignTWlzc2VkIHJlcXVpcmVkIGNvb3JkcycpO1xuXG4gICAgICAgIHZhciBnZW9jb2RlciA9IHBsYXRmb3JtLmdldEdlb2NvZGluZ1NlcnZpY2UoKSxcbiAgICAgICAgICAgIGRlZmVycmVkID0gJHEuZGVmZXIoKSxcbiAgICAgICAgICAgIF9wYXJhbXMgPSB7XG4gICAgICAgICAgICAgICAgcHJveDogW3BhcmFtcy5jb29yZHMubGF0LCBwYXJhbXMuY29vcmRzLmxuZywgcGFyYW1zLnJhZGl1cyB8fCAyNTBdLmpvaW4oJywnKSxcbiAgICAgICAgICAgICAgICBtb2RlOiAncmV0cmlldmVBZGRyZXNzZXMnLFxuICAgICAgICAgICAgICAgIG1heHJlc3VsdHM6ICcxJyxcbiAgICAgICAgICAgICAgICBnZW46ICc4JyxcbiAgICAgICAgICAgICAgICBsYW5ndWFnZTogcGFyYW1zLmxhbmcgfHwgJ2VuLWdiJ1xuICAgICAgICAgICAgfTtcblxuICAgICAgICBnZW9jb2Rlci5yZXZlcnNlR2VvY29kZShfcGFyYW1zLCBmdW5jdGlvbiAocmVzcG9uc2UpIHtcbiAgICAgICAgICAgIGRlZmVycmVkLnJlc29sdmUocmVzcG9uc2UpXG4gICAgICAgIH0sIGZ1bmN0aW9uIChlcnJvcikge1xuICAgICAgICAgICAgZGVmZXJyZWQucmVqZWN0KGVycm9yKVxuICAgICAgICB9KTtcbiAgICAgICAgXG4gICAgICAgIHJldHVybiBkZWZlcnJlZC5wcm9taXNlO1xuICAgIH1cblxuICAgIGZ1bmN0aW9uIGdlb2NvZGVBZGRyZXNzKHBsYXRmb3JtLCBwYXJhbXMpIHtcbiAgICAgICAgaWYgKCFwYXJhbXMpXG4gICAgICAgICAgICByZXR1cm4gY29uc29sZS5lcnJvcignTWlzc2VkIHJlcXVpcmVkIHBhcmFtZXRlcnMnKTtcblxuICAgICAgICB2YXIgZ2VvY29kZXIgPSBwbGF0Zm9ybS5nZXRHZW9jb2RpbmdTZXJ2aWNlKCksXG4gICAgICAgICAgICBkZWZlcnJlZCA9ICRxLmRlZmVyKCksXG4gICAgICAgICAgICBfcGFyYW1zID0geyBnZW46IDggfTtcblxuICAgICAgICBmb3IgKHZhciBrZXkgaW4gcGFyYW1zKSB7IF9wYXJhbXNba2V5XSA9IHBhcmFtc1trZXldOyB9XG5cbiAgICAgICAgZ2VvY29kZXIuZ2VvY29kZShfcGFyYW1zLCBmdW5jdGlvbiAocmVzcG9uc2UpIHtcbiAgICAgICAgICAgIGRlZmVycmVkLnJlc29sdmUocmVzcG9uc2UpXG4gICAgICAgIH0sIGZ1bmN0aW9uIChlcnJvcikge1xuICAgICAgICAgICAgZGVmZXJyZWQucmVqZWN0KGVycm9yKVxuICAgICAgICB9KTtcblxuICAgICAgICByZXR1cm4gZGVmZXJyZWQucHJvbWlzZTtcbiAgICB9XG5cbiAgICAvLyNlbmRyZWdpb24gUFVCTElDXG5cbiAgICBmdW5jdGlvbiBfZ2V0TG9hZGVyQnlBdHRyKGF0dHIpIHtcbiAgICAgICAgdmFyIGxvYWRlcjtcblxuICAgICAgICBzd2l0Y2ggKGF0dHIpIHtcbiAgICAgICAgICAgIGNhc2UgSGVyZU1hcHNDT05TVFMuTU9EVUxFUy5VSTpcbiAgICAgICAgICAgICAgICBsb2FkZXIgPSBfbG9hZFVJTW9kdWxlO1xuICAgICAgICAgICAgICAgIGJyZWFrO1xuICAgICAgICAgICAgY2FzZSBIZXJlTWFwc0NPTlNUUy5NT0RVTEVTLkVWRU5UUzpcbiAgICAgICAgICAgICAgICBsb2FkZXIgPSBfbG9hZEV2ZW50c01vZHVsZTtcbiAgICAgICAgICAgICAgICBicmVhaztcbiAgICAgICAgICAgIGRlZmF1bHQ6XG4gICAgICAgICAgICAgICAgdGhyb3cgbmV3IEVycm9yKCdVbmtub3duIG1vZHVsZScsIGF0dHIpO1xuICAgICAgICB9XG5cbiAgICAgICAgcmV0dXJuIGxvYWRlcjtcbiAgICB9XG5cbiAgICBmdW5jdGlvbiBfbG9hZFVJTW9kdWxlKCkge1xuICAgICAgICBpZiAoIV9pc0xvYWRlZChDT05GSUcuVUkuc3JjKSkge1xuICAgICAgICAgICAgdmFyIGxpbmsgPSBIZXJlTWFwc1V0aWxzU2VydmljZS5jcmVhdGVMaW5rVGFnKHtcbiAgICAgICAgICAgICAgICByZWw6ICdzdHlsZXNoZWV0JyxcbiAgICAgICAgICAgICAgICB0eXBlOiAndGV4dC9jc3MnLFxuICAgICAgICAgICAgICAgIGhyZWY6IF9nZXRVUkwoQ09ORklHLlVJLmhyZWYpXG4gICAgICAgICAgICB9KTtcblxuICAgICAgICAgICAgbGluayAmJiBoZWFkLmFwcGVuZENoaWxkKGxpbmspO1xuICAgICAgICB9XG5cbiAgICAgICAgcmV0dXJuIF9nZXRMb2FkZXIoQ09ORklHLlVJLnNyYyk7XG4gICAgfVxuXG4gICAgZnVuY3Rpb24gX2xvYWRFdmVudHNNb2R1bGUoKSB7XG4gICAgICAgIHJldHVybiBfZ2V0TG9hZGVyKENPTkZJRy5FVkVOVFMpO1xuICAgIH1cblxuICAgIC8qKlxuICAgICAqIEBwYXJhbSB7U3RyaW5nfSBzb3VyY2VOYW1lXG4gICAgICogcmV0dXJuIHtTdHJpbmd9IGUuZyBodHRwOi8vanMuYXBpLmhlcmUuY29tL3Z7VkVSfS97U1VCVkVSU0lPTn0ve1NPVVJDRX1cbiAgICAgKi9cbiAgICBmdW5jdGlvbiBfZ2V0VVJMKHNvdXJjZU5hbWUpIHtcbiAgICAgICAgcmV0dXJuIFtcbiAgICAgICAgICAgIHByb3RvY29sLFxuICAgICAgICAgICAgQ09ORklHLkJBU0UsXG4gICAgICAgICAgICBBUElfVkVSU0lPTi5WLFxuICAgICAgICAgICAgXCIvXCIsXG4gICAgICAgICAgICBBUElfVkVSU0lPTi5TVUIsXG4gICAgICAgICAgICBcIi9cIixcbiAgICAgICAgICAgIHNvdXJjZU5hbWVcbiAgICAgICAgXS5qb2luKFwiXCIpO1xuICAgIH1cblxuICAgIGZ1bmN0aW9uIF9nZXRMb2FkZXIoc291cmNlTmFtZSkge1xuICAgICAgICB2YXIgZGVmZXIgPSAkcS5kZWZlcigpLCBzcmMsIHNjcmlwdDtcblxuICAgICAgICBpZiAoX2lzTG9hZGVkKHNvdXJjZU5hbWUpKSB7XG4gICAgICAgICAgICBkZWZlci5yZXNvbHZlKCk7XG4gICAgICAgIH0gZWxzZSB7XG4gICAgICAgICAgICBzcmMgPSBfZ2V0VVJMKHNvdXJjZU5hbWUpLFxuICAgICAgICAgICAgICAgIHNjcmlwdCA9IEhlcmVNYXBzVXRpbHNTZXJ2aWNlLmNyZWF0ZVNjcmlwdFRhZyh7IHNyYzogc3JjIH0pO1xuXG4gICAgICAgICAgICBzY3JpcHQgJiYgaGVhZC5hcHBlbmRDaGlsZChzY3JpcHQpO1xuXG4gICAgICAgICAgICBBUElfREVGRVJTUXVldWVbc291cmNlTmFtZV0ucHVzaChkZWZlcik7XG5cbiAgICAgICAgICAgIHNjcmlwdC5vbmxvYWQgPSBfb25Mb2FkLmJpbmQobnVsbCwgc291cmNlTmFtZSk7XG4gICAgICAgICAgICBzY3JpcHQub25lcnJvciA9IF9vbkVycm9yLmJpbmQobnVsbCwgc291cmNlTmFtZSk7XG4gICAgICAgIH1cblxuICAgICAgICByZXR1cm4gZGVmZXIucHJvbWlzZTtcbiAgICB9XG5cbiAgICBmdW5jdGlvbiBfaXNMb2FkZWQoc291cmNlTmFtZSkge1xuICAgICAgICB2YXIgY2hlY2tlciA9IG51bGw7XG5cbiAgICAgICAgc3dpdGNoIChzb3VyY2VOYW1lKSB7XG4gICAgICAgICAgICBjYXNlIENPTkZJRy5DT1JFOlxuICAgICAgICAgICAgICAgIGNoZWNrZXIgPSBfaXNDb3JlTG9hZGVkO1xuICAgICAgICAgICAgICAgIGJyZWFrO1xuICAgICAgICAgICAgY2FzZSBDT05GSUcuU0VSVklDRTpcbiAgICAgICAgICAgICAgICBjaGVja2VyID0gX2lzU2VydmljZUxvYWRlZDtcbiAgICAgICAgICAgICAgICBicmVhaztcbiAgICAgICAgICAgIGNhc2UgQ09ORklHLlVJLnNyYzpcbiAgICAgICAgICAgICAgICBjaGVja2VyID0gX2lzVUlMb2FkZWQ7XG4gICAgICAgICAgICAgICAgYnJlYWs7XG4gICAgICAgICAgICBjYXNlIENPTkZJRy5FVkVOVFM6XG4gICAgICAgICAgICAgICAgY2hlY2tlciA9IF9pc0V2ZW50c0xvYWRlZDtcbiAgICAgICAgICAgICAgICBicmVhaztcbiAgICAgICAgICAgIGRlZmF1bHQ6XG4gICAgICAgICAgICAgICAgY2hlY2tlciA9IGZ1bmN0aW9uICgpIHsgcmV0dXJuIGZhbHNlIH07XG4gICAgICAgIH1cblxuICAgICAgICByZXR1cm4gY2hlY2tlcigpO1xuICAgIH1cblxuICAgIGZ1bmN0aW9uIF9pc0NvcmVMb2FkZWQoKSB7XG4gICAgICAgIHJldHVybiAhIXdpbmRvdy5IO1xuICAgIH1cblxuICAgIGZ1bmN0aW9uIF9pc1NlcnZpY2VMb2FkZWQoKSB7XG4gICAgICAgIHJldHVybiAhISh3aW5kb3cuSCAmJiB3aW5kb3cuSC5zZXJ2aWNlKTtcbiAgICB9XG5cbiAgICBmdW5jdGlvbiBfaXNVSUxvYWRlZCgpIHtcbiAgICAgICAgcmV0dXJuICEhKHdpbmRvdy5IICYmIHdpbmRvdy5ILnVpKTtcbiAgICB9XG5cbiAgICBmdW5jdGlvbiBfaXNFdmVudHNMb2FkZWQoKSB7XG4gICAgICAgIHJldHVybiAhISh3aW5kb3cuSCAmJiB3aW5kb3cuSC5tYXBldmVudHMpO1xuICAgIH1cblxuICAgIGZ1bmN0aW9uIF9vbkxvYWQoc291cmNlTmFtZSkge1xuICAgICAgICB2YXIgZGVmZXJRdWV1ZSA9IEFQSV9ERUZFUlNRdWV1ZVtzb3VyY2VOYW1lXTtcbiAgICAgICAgZm9yICh2YXIgaSA9IDAsIGwgPSBkZWZlclF1ZXVlLmxlbmd0aDsgaSA8IGw7ICsraSkge1xuICAgICAgICAgICAgdmFyIGRlZmVyID0gZGVmZXJRdWV1ZVtpXTtcbiAgICAgICAgICAgIGRlZmVyLnJlc29sdmUoKTtcbiAgICAgICAgfVxuXG4gICAgICAgIEFQSV9ERUZFUlNRdWV1ZVtzb3VyY2VOYW1lXSA9IFtdO1xuICAgIH1cblxuICAgIGZ1bmN0aW9uIF9vbkVycm9yKHNvdXJjZU5hbWUpIHtcbiAgICAgICAgdmFyIGRlZmVyUXVldWUgPSBBUElfREVGRVJTUXVldWVbc291cmNlTmFtZV07XG4gICAgICAgIGZvciAodmFyIGkgPSAwLCBsID0gZGVmZXJRdWV1ZS5sZW5ndGg7IGkgPCBsOyArK2kpIHtcbiAgICAgICAgICAgIHZhciBkZWZlciA9IGRlZmVyUXVldWVbaV07XG4gICAgICAgICAgICBkZWZlci5yZWplY3QoKTtcbiAgICAgICAgfVxuXG4gICAgICAgIEFQSV9ERUZFUlNRdWV1ZVtzb3VyY2VOYW1lXSA9IFtdO1xuICAgIH1cblxuICAgIGZ1bmN0aW9uIF9pc1ZhbGlkQ29vcmRzKGNvb3Jkcykge1xuICAgICAgICB2YXIgbG5nID0gY29vcmRzICYmIGNvb3Jkcy5sb25naXR1ZGUsXG4gICAgICAgICAgICBsYXQgPSBjb29yZHMgJiYgY29vcmRzLmxhdGl0dWRlO1xuXG4gICAgICAgIHJldHVybiAodHlwZW9mIGxuZyA9PT0gJ251bWJlcicgfHwgdHlwZW9mIGxuZyA9PT0gJ3N0cmluZycpICYmXG4gICAgICAgICAgICAodHlwZW9mIGxhdCA9PT0gJ251bWJlcicgfHwgdHlwZW9mIGxhdCA9PT0gJ3N0cmluZycpO1xuICAgIH1cbn07XG4iLCJtb2R1bGUuZXhwb3J0cyA9IHtcbiAgICBVUERBVEVfTUFQX1JFU0laRV9USU1FT1VUOiA1MDAsXG4gICAgQU5JTUFUSU9OX1pPT01fU1RFUDogLjA1LFxuICAgIE1PRFVMRVM6IHtcbiAgICAgICAgVUk6ICdjb250cm9scycsXG4gICAgICAgIEVWRU5UUzogJ2V2ZW50cycsXG4gICAgICAgIFBBTk86ICdwYW5vJ1xuICAgIH0sXG4gICAgREVGQVVMVF9NQVBfT1BUSU9OUzoge1xuICAgICAgICBoZWlnaHQ6IDQ4MCxcbiAgICAgICAgd2lkdGg6IDY0MCxcbiAgICAgICAgem9vbTogMTIsXG4gICAgICAgIG1heFpvb206IDIsXG4gICAgICAgIHJlc2l6ZTogZmFsc2UsXG4gICAgICAgIGRyYWdnYWJsZTogZmFsc2UsXG4gICAgICAgIGNvb3Jkczoge1xuICAgICAgICAgICAgbG9uZ2l0dWRlOiAwLFxuICAgICAgICAgICAgbGF0aXR1ZGU6IDBcbiAgICAgICAgfVxuICAgIH0sXG4gICAgTUFSS0VSX1RZUEVTOiB7XG4gICAgICAgIERPTTogXCJET01cIixcbiAgICAgICAgU1ZHOiBcIlNWR1wiXG4gICAgfSxcbiAgICBDT05UUk9MUzoge1xuICAgICAgICBOQU1FUzoge1xuICAgICAgICAgICAgU0NBTEU6ICdzY2FsZWJhcicsXG4gICAgICAgICAgICBTRVRUSU5HUzogJ21hcHNldHRpbmdzJyxcbiAgICAgICAgICAgIFpPT006ICd6b29tJyxcbiAgICAgICAgICAgIFVTRVI6ICd1c2VycG9zaXRpb24nXG4gICAgICAgIH0sXG4gICAgICAgIFBPU0lUSU9OUzogW1xuICAgICAgICAgICAgJ3RvcC1yaWdodCcsXG4gICAgICAgICAgICAndG9wLWNlbnRlcicsXG4gICAgICAgICAgICAndG9wLWxlZnQnLFxuICAgICAgICAgICAgJ2xlZnQtdG9wJyxcbiAgICAgICAgICAgICdsZWZ0LW1pZGRsZScsXG4gICAgICAgICAgICAnbGVmdC1ib3R0b20nLFxuICAgICAgICAgICAgJ3JpZ2h0LXRvcCcsXG4gICAgICAgICAgICAncmlnaHQtbWlkZGxlJyxcbiAgICAgICAgICAgICdyaWdodC1ib3R0b20nLFxuICAgICAgICAgICAgJ2JvdHRvbS1yaWdodCcsXG4gICAgICAgICAgICAnYm90dG9tLWNlbnRlcicsXG4gICAgICAgICAgICAnYm90dG9tLWxlZnQnXG4gICAgICAgIF1cbiAgICB9LFxuICAgIElORk9CVUJCTEU6IHtcbiAgICAgICAgU1RBVEU6IHtcbiAgICAgICAgICAgIE9QRU46ICdvcGVuJyxcbiAgICAgICAgICAgIENMT1NFRDogJ2Nsb3NlZCdcbiAgICAgICAgfSxcbiAgICAgICAgRElTUExBWV9FVkVOVDoge1xuICAgICAgICAgICAgcG9pbnRlcm1vdmU6ICdvbkhvdmVyJyxcbiAgICAgICAgICAgIHRhcDogJ29uQ2xpY2snXG4gICAgICAgIH1cbiAgICB9LFxuICAgIFVTRVJfRVZFTlRTOiB7XG4gICAgICAgIHRhcDogJ2NsaWNrJyxcbiAgICAgICAgcG9pbnRlcm1vdmU6ICdtb3VzZW1vdmUnLFxuICAgICAgICBwb2ludGVybGVhdmU6ICdtb3VzZWxlYXZlJyxcbiAgICAgICAgcG9pbnRlcmVudGVyOiAnbW91c2VlbnRlcicsXG4gICAgICAgIGRyYWc6ICdkcmFnJyxcbiAgICAgICAgZHJhZ3N0YXJ0OiAnZHJhZ3N0YXJ0JyxcbiAgICAgICAgZHJhZ2VuZDogJ2RyYWdlbmQnXG4gICAgfVxufSIsIm1vZHVsZS5leHBvcnRzID0gSGVyZU1hcHNFdmVudHNGYWN0b3J5O1xuXG5IZXJlTWFwc0V2ZW50c0ZhY3RvcnkuJGluamVjdCA9IFtcbiAgICAnSGVyZU1hcHNVdGlsc1NlcnZpY2UnLFxuICAgICdIZXJlTWFwc01hcmtlclNlcnZpY2UnLFxuICAgICdIZXJlTWFwc0NPTlNUUycsXG4gICAgJ0hlcmVNYXBzSW5mb0J1YmJsZUZhY3RvcnknXG5dO1xuZnVuY3Rpb24gSGVyZU1hcHNFdmVudHNGYWN0b3J5KEhlcmVNYXBzVXRpbHNTZXJ2aWNlLCBIZXJlTWFwc01hcmtlclNlcnZpY2UsIEhlcmVNYXBzQ09OU1RTLCBIZXJlTWFwc0luZm9CdWJibGVGYWN0b3J5KSB7XG4gICAgZnVuY3Rpb24gRXZlbnRzKHBsYXRmb3JtLCBJbmplY3RvciwgbGlzdGVuZXJzKSB7XG4gICAgICAgIHRoaXMubWFwID0gcGxhdGZvcm0ubWFwO1xuICAgICAgICB0aGlzLmxpc3RlbmVycyA9IGxpc3RlbmVycztcbiAgICAgICAgdGhpcy5pbmplY3QgPSBuZXcgSW5qZWN0b3IoKTtcbiAgICAgICAgdGhpcy5ldmVudHMgPSBwbGF0Zm9ybS5ldmVudHMgPSBuZXcgSC5tYXBldmVudHMuTWFwRXZlbnRzKHRoaXMubWFwKTtcbiAgICAgICAgdGhpcy5iZWhhdmlvciA9IHBsYXRmb3JtLmJlaGF2aW9yID0gbmV3IEgubWFwZXZlbnRzLkJlaGF2aW9yKHRoaXMuZXZlbnRzKTtcbiAgICAgICAgdGhpcy5idWJibGUgPSBIZXJlTWFwc0luZm9CdWJibGVGYWN0b3J5LmNyZWF0ZSgpO1xuXG4gICAgICAgIHRoaXMuc2V0dXBFdmVudExpc3RlbmVycygpO1xuICAgIH1cblxuICAgIHZhciBwcm90byA9IEV2ZW50cy5wcm90b3R5cGU7XG5cbiAgICBwcm90by5zZXR1cEV2ZW50TGlzdGVuZXJzID0gc2V0dXBFdmVudExpc3RlbmVycztcbiAgICBwcm90by5zZXR1cE9wdGlvbnMgPSBzZXR1cE9wdGlvbnM7XG4gICAgcHJvdG8udHJpZ2dlclVzZXJMaXN0ZW5lciA9IHRyaWdnZXJVc2VyTGlzdGVuZXI7XG4gICAgcHJvdG8uaW5mb0J1YmJsZUhhbmRsZXIgPSBpbmZvQnViYmxlSGFuZGxlcjsgIFxuXG4gICAgcmV0dXJuIHtcbiAgICAgICAgc3RhcnQ6IGZ1bmN0aW9uKGFyZ3MpIHtcbiAgICAgICAgICAgIGlmICghKGFyZ3MucGxhdGZvcm0ubWFwIGluc3RhbmNlb2YgSC5NYXApKVxuICAgICAgICAgICAgICAgIHJldHVybiBjb25zb2xlLmVycm9yKCdNaXNzZWQgcmVxdWlyZWQgbWFwIGluc3RhbmNlJyk7XG5cbiAgICAgICAgICAgIHZhciBldmVudHMgPSBuZXcgRXZlbnRzKGFyZ3MucGxhdGZvcm0sIGFyZ3MuaW5qZWN0b3IsIGFyZ3MubGlzdGVuZXJzKTtcblxuICAgICAgICAgICAgYXJncy5vcHRpb25zICYmIGV2ZW50cy5zZXR1cE9wdGlvbnMoYXJncy5vcHRpb25zKTtcbiAgICAgICAgfVxuICAgIH1cblxuICAgIGZ1bmN0aW9uIHNldHVwRXZlbnRMaXN0ZW5lcnMoKSB7XG4gICAgICAgIHZhciBzZWxmID0gdGhpcztcblxuICAgICAgICBIZXJlTWFwc1V0aWxzU2VydmljZS5hZGRFdmVudExpc3RlbmVyKHRoaXMubWFwLCAndGFwJywgdGhpcy5pbmZvQnViYmxlSGFuZGxlci5iaW5kKHRoaXMpKTtcblxuICAgICAgICBIZXJlTWFwc1V0aWxzU2VydmljZS5hZGRFdmVudExpc3RlbmVyKHRoaXMubWFwLCAncG9pbnRlcm1vdmUnLCB0aGlzLmluZm9CdWJibGVIYW5kbGVyLmJpbmQodGhpcykpO1xuXG4gICAgICAgIEhlcmVNYXBzVXRpbHNTZXJ2aWNlLmFkZEV2ZW50TGlzdGVuZXIodGhpcy5tYXAsICdkcmFnc3RhcnQnLCBmdW5jdGlvbihlKSB7XG4gICAgICAgICAgICBpZiAoSGVyZU1hcHNNYXJrZXJTZXJ2aWNlLmlzTWFya2VySW5zdGFuY2UoZS50YXJnZXQpKSB7XG4gICAgICAgICAgICAgICAgc2VsZi5iZWhhdmlvci5kaXNhYmxlKCk7XG4gICAgICAgICAgICB9XG5cbiAgICAgICAgICAgIHNlbGYudHJpZ2dlclVzZXJMaXN0ZW5lcihIZXJlTWFwc0NPTlNUUy5VU0VSX0VWRU5UU1tlLnR5cGVdLCBlKTtcbiAgICAgICAgfSk7XG5cbiAgICAgICAgSGVyZU1hcHNVdGlsc1NlcnZpY2UuYWRkRXZlbnRMaXN0ZW5lcih0aGlzLm1hcCwgJ2RyYWcnLCBmdW5jdGlvbihlKSB7XG4gICAgICAgICAgICB2YXIgcG9pbnRlciA9IGUuY3VycmVudFBvaW50ZXIsXG4gICAgICAgICAgICAgICAgdGFyZ2V0ID0gZS50YXJnZXQ7XG5cbiAgICAgICAgICAgIGlmIChIZXJlTWFwc01hcmtlclNlcnZpY2UuaXNNYXJrZXJJbnN0YW5jZSh0YXJnZXQpKSB7XG4gICAgICAgICAgICAgICAgdGFyZ2V0LnNldFBvc2l0aW9uKHNlbGYubWFwLnNjcmVlblRvR2VvKHBvaW50ZXIudmlld3BvcnRYLCBwb2ludGVyLnZpZXdwb3J0WSkpO1xuICAgICAgICAgICAgfVxuXG4gICAgICAgICAgICBzZWxmLnRyaWdnZXJVc2VyTGlzdGVuZXIoSGVyZU1hcHNDT05TVFMuVVNFUl9FVkVOVFNbZS50eXBlXSwgZSk7XG4gICAgICAgIH0pO1xuXG4gICAgICAgIEhlcmVNYXBzVXRpbHNTZXJ2aWNlLmFkZEV2ZW50TGlzdGVuZXIodGhpcy5tYXAsICdkcmFnZW5kJywgZnVuY3Rpb24oZSkge1xuICAgICAgICAgICAgaWYgKEhlcmVNYXBzTWFya2VyU2VydmljZS5pc01hcmtlckluc3RhbmNlKGUudGFyZ2V0KSkge1xuICAgICAgICAgICAgICAgIHNlbGYuYmVoYXZpb3IuZW5hYmxlKCk7XG4gICAgICAgICAgICB9XG5cbiAgICAgICAgICAgIHNlbGYudHJpZ2dlclVzZXJMaXN0ZW5lcihIZXJlTWFwc0NPTlNUUy5VU0VSX0VWRU5UU1tlLnR5cGVdLCBlKTtcbiAgICAgICAgfSk7XG4gICAgfVxuXG4gICAgZnVuY3Rpb24gc2V0dXBPcHRpb25zKG9wdGlvbnMpIHtcbiAgICAgICAgaWYgKCFvcHRpb25zKVxuICAgICAgICAgICAgcmV0dXJuO1xuXG4gICAgICAgIHRoaXMubWFwLmRyYWdnYWJsZSA9ICEhb3B0aW9ucy5kcmFnZ2FibGU7XG4gICAgfVxuXG4gICAgZnVuY3Rpb24gdHJpZ2dlclVzZXJMaXN0ZW5lcihldmVudE5hbWUsIGUpIHtcbiAgICAgICAgaWYgKCF0aGlzLmxpc3RlbmVycylcbiAgICAgICAgICAgIHJldHVybjtcblxuICAgICAgICB2YXIgY2FsbGJhY2sgPSB0aGlzLmxpc3RlbmVyc1tldmVudE5hbWVdO1xuXG4gICAgICAgIGNhbGxiYWNrICYmIGNhbGxiYWNrKGUpO1xuICAgIH1cbiAgICBcbiAgICBmdW5jdGlvbiBpbmZvQnViYmxlSGFuZGxlcihlKXtcbiAgICAgICAgdmFyIHVpID0gdGhpcy5pbmplY3QoJ3VpJyk7XG4gICAgICAgIFxuICAgICAgICBpZih1aSlcbiAgICAgICAgICAgIHRoaXMuYnViYmxlLnRvZ2dsZShlLCB1aSk7XG4gICAgICAgICAgICBcbiAgICAgICAgdGhpcy50cmlnZ2VyVXNlckxpc3RlbmVyKEhlcmVNYXBzQ09OU1RTLlVTRVJfRVZFTlRTW2UudHlwZV0sIGUpOyAgICAgIFxuICAgIH1cblxufTsiLCJtb2R1bGUuZXhwb3J0cyA9IEhlcmVNYXBzSW5mb0J1YmJsZUZhY3Rvcnk7XG5cbkhlcmVNYXBzSW5mb0J1YmJsZUZhY3RvcnkuJGluamVjdCA9IFtcbiAgICAnSGVyZU1hcHNNYXJrZXJTZXJ2aWNlJyxcbiAgICAnSGVyZU1hcHNVdGlsc1NlcnZpY2UnLFxuICAgICdIZXJlTWFwc0NPTlNUUydcbl07XG5mdW5jdGlvbiBIZXJlTWFwc0luZm9CdWJibGVGYWN0b3J5KEhlcmVNYXBzTWFya2VyU2VydmljZSwgSGVyZU1hcHNVdGlsc1NlcnZpY2UsIEhlcmVNYXBzQ09OU1RTKSB7XG4gICAgZnVuY3Rpb24gSW5mb0J1YmJsZSgpIHt9XG5cbiAgICB2YXIgcHJvdG8gPSBJbmZvQnViYmxlLnByb3RvdHlwZTtcbiAgICAgICAgXG4gICAgcHJvdG8uY3JlYXRlID0gY3JlYXRlO1xuICAgIHByb3RvLnVwZGF0ZSA9IHVwZGF0ZTtcbiAgICBwcm90by50b2dnbGUgPSB0b2dnbGU7XG4gICAgcHJvdG8uc2hvdyA9IHNob3c7XG4gICAgcHJvdG8uY2xvc2UgPSBjbG9zZTtcblxuICAgIHJldHVybiB7XG4gICAgICAgIGNyZWF0ZTogZnVuY3Rpb24oKXtcbiAgICAgICAgICAgIHJldHVybiBuZXcgSW5mb0J1YmJsZSgpO1xuICAgICAgICB9XG4gICAgfVxuXG4gICAgZnVuY3Rpb24gdG9nZ2xlKGUsIHVpKSB7XG4gICAgICAgIGlmIChIZXJlTWFwc01hcmtlclNlcnZpY2UuaXNNYXJrZXJJbnN0YW5jZShlLnRhcmdldCkpXG4gICAgICAgICAgICB0aGlzLnNob3coZSwgdWkpO1xuICAgICAgICBlbHNlXG4gICAgICAgICAgICB0aGlzLmNsb3NlKGUsIHVpKTtcbiAgICB9XG5cbiAgICBmdW5jdGlvbiB1cGRhdGUoYnViYmxlLCBkYXRhKSB7XG4gICAgICAgIGJ1YmJsZS5kaXNwbGF5ID0gZGF0YS5kaXNwbGF5O1xuXG4gICAgICAgIGJ1YmJsZS5zZXRQb3NpdGlvbihkYXRhLnBvc2l0aW9uKTtcbiAgICAgICAgYnViYmxlLnNldENvbnRlbnQoZGF0YS5tYXJrdXApO1xuXG4gICAgICAgIGJ1YmJsZS5zZXRTdGF0ZShIZXJlTWFwc0NPTlNUUy5JTkZPQlVCQkxFLlNUQVRFLk9QRU4pO1xuICAgIH1cblxuICAgIGZ1bmN0aW9uIGNyZWF0ZShzb3VyY2UpIHtcbiAgICAgICAgdmFyIGJ1YmJsZSA9IG5ldyBILnVpLkluZm9CdWJibGUoc291cmNlLnBvc2l0aW9uLCB7XG4gICAgICAgICAgICBjb250ZW50OiBzb3VyY2UubWFya3VwXG4gICAgICAgIH0pO1xuXG4gICAgICAgIGJ1YmJsZS5kaXNwbGF5ID0gc291cmNlLmRpc3BsYXk7XG4gICAgICAgIGJ1YmJsZS5hZGRDbGFzcyhIZXJlTWFwc0NPTlNUUy5JTkZPQlVCQkxFLlNUQVRFLk9QRU4pXG5cbiAgICAgICAgSGVyZU1hcHNVdGlsc1NlcnZpY2UuYWRkRXZlbnRMaXN0ZW5lcihidWJibGUsICdzdGF0ZWNoYW5nZScsIGZ1bmN0aW9uKGUpIHtcbiAgICAgICAgICAgIHZhciBzdGF0ZSA9IHRoaXMuZ2V0U3RhdGUoKSxcbiAgICAgICAgICAgICAgICBlbCA9IHRoaXMuZ2V0RWxlbWVudCgpO1xuICAgICAgICAgICAgaWYgKHN0YXRlID09PSBIZXJlTWFwc0NPTlNUUy5JTkZPQlVCQkxFLlNUQVRFLkNMT1NFRCkge1xuICAgICAgICAgICAgICAgIGVsLmNsYXNzTGlzdC5yZW1vdmUoSGVyZU1hcHNDT05TVFMuSU5GT0JVQkJMRS5TVEFURS5PUEVOKTtcbiAgICAgICAgICAgIH0gZWxzZVxuICAgICAgICAgICAgICAgIHRoaXMuYWRkQ2xhc3Moc3RhdGUpXG4gICAgICAgIH0pO1xuXG4gICAgICAgIHJldHVybiBidWJibGU7XG4gICAgfVxuXG4gICAgZnVuY3Rpb24gc2hvdyhlLCB1aSwgZGF0YSkge1xuICAgICAgICB2YXIgdGFyZ2V0ID0gZS50YXJnZXQsXG4gICAgICAgICAgICBkYXRhID0gdGFyZ2V0LmdldERhdGEoKSxcbiAgICAgICAgICAgIGVsID0gbnVsbDtcblxuICAgICAgICBpZiAoIWRhdGEgfHwgIWRhdGEuZGlzcGxheSB8fCAhZGF0YS5tYXJrdXAgfHwgZGF0YS5kaXNwbGF5ICE9PSBIZXJlTWFwc0NPTlNUUy5JTkZPQlVCQkxFLkRJU1BMQVlfRVZFTlRbZS50eXBlXSlcbiAgICAgICAgICAgIHJldHVybjtcblxuICAgICAgICB2YXIgc291cmNlID0ge1xuICAgICAgICAgICAgcG9zaXRpb246IHRhcmdldC5nZXRQb3NpdGlvbigpLFxuICAgICAgICAgICAgbWFya3VwOiBkYXRhLm1hcmt1cCxcbiAgICAgICAgICAgIGRpc3BsYXk6IGRhdGEuZGlzcGxheVxuICAgICAgICB9O1xuXG4gICAgICAgIGlmICghdWkuYnViYmxlKSB7XG4gICAgICAgICAgICB1aS5idWJibGUgPSB0aGlzLmNyZWF0ZShzb3VyY2UpO1xuICAgICAgICAgICAgdWkuYWRkQnViYmxlKHVpLmJ1YmJsZSk7XG5cbiAgICAgICAgICAgIHJldHVybjtcbiAgICAgICAgfVxuXG4gICAgICAgIHRoaXMudXBkYXRlKHVpLmJ1YmJsZSwgc291cmNlKTtcbiAgICB9XG5cbiAgICBmdW5jdGlvbiBjbG9zZShlLCB1aSkge1xuICAgICAgICBpZiAoIXVpLmJ1YmJsZSB8fCB1aS5idWJibGUuZGlzcGxheSAhPT0gSGVyZU1hcHNDT05TVFMuSU5GT0JVQkJMRS5ESVNQTEFZX0VWRU5UW2UudHlwZV0pIHtcbiAgICAgICAgICAgIHJldHVybjtcbiAgICAgICAgfVxuXG4gICAgICAgIHVpLmJ1YmJsZS5zZXRTdGF0ZShIZXJlTWFwc0NPTlNUUy5JTkZPQlVCQkxFLlNUQVRFLkNMT1NFRCk7XG4gICAgfVxufSIsImFuZ3VsYXIubW9kdWxlKCdoZXJlbWFwcy1ldmVudHMtbW9kdWxlJywgW10pXG4gICAgLmZhY3RvcnkoJ0hlcmVNYXBzRXZlbnRzRmFjdG9yeScsIHJlcXVpcmUoJy4vZXZlbnRzL2V2ZW50cy5qcycpKVxuICAgIC5mYWN0b3J5KCdIZXJlTWFwc0luZm9CdWJibGVGYWN0b3J5JywgcmVxdWlyZSgnLi9ldmVudHMvaW5mb2J1YmJsZS5qcycpKTtcbiAgICBcbmFuZ3VsYXIubW9kdWxlKCdoZXJlbWFwcy11aS1tb2R1bGUnLCBbXSlcbiAgICAuZmFjdG9yeSgnSGVyZU1hcHNVaUZhY3RvcnknLCByZXF1aXJlKCcuL3VpL3VpLmpzJykpXG5cbm1vZHVsZS5leHBvcnRzID0gYW5ndWxhci5tb2R1bGUoJ2hlcmVtYXBzLW1hcC1tb2R1bGVzJywgW1xuXHQnaGVyZW1hcHMtZXZlbnRzLW1vZHVsZScsXG4gICAgJ2hlcmVtYXBzLXVpLW1vZHVsZSdcbl0pOyIsIm1vZHVsZS5leHBvcnRzID0gSGVyZU1hcHNVaUZhY3Rvcnk7XG5cbkhlcmVNYXBzVWlGYWN0b3J5LiRpbmplY3QgPSBbXG4gICAgJ0hlcmVNYXBzQVBJU2VydmljZScsXG4gICAgJ0hlcmVNYXBzTWFya2VyU2VydmljZScsXG4gICAgJ0hlcmVNYXBzVXRpbHNTZXJ2aWNlJyxcbiAgICAnSGVyZU1hcHNDT05TVFMnXG5dO1xuZnVuY3Rpb24gSGVyZU1hcHNVaUZhY3RvcnkoSGVyZU1hcHNBUElTZXJ2aWNlLCBIZXJlTWFwc01hcmtlclNlcnZpY2UsIEhlcmVNYXBzVXRpbHNTZXJ2aWNlLCBIZXJlTWFwc0NPTlNUUykge1xuICAgIGZ1bmN0aW9uIFVJKHBsYXRmb3JtLCBhbGlnbm1lbnQpIHtcbiAgICAgICAgdGhpcy5tYXAgPSBwbGF0Zm9ybS5tYXA7XG4gICAgICAgIHRoaXMubGF5ZXJzID0gcGxhdGZvcm0ubGF5ZXJzO1xuICAgICAgICB0aGlzLmFsaWdubWVudCA9IGFsaWdubWVudDtcbiAgICAgICAgdGhpcy51aSA9IHBsYXRmb3JtLnVpID0gSC51aS5VSS5jcmVhdGVEZWZhdWx0KHRoaXMubWFwLCB0aGlzLmxheWVycyk7XG5cbiAgICAgICAgdGhpcy5zZXR1cENvbnRyb2xzKCk7XG4gICAgfVxuXG4gICAgVUkuaXNWYWxpZEFsaWdubWVudCA9IGlzVmFsaWRBbGlnbm1lbnQ7XG5cbiAgICB2YXIgcHJvdG8gPSBVSS5wcm90b3R5cGU7XG5cbiAgICBwcm90by5zZXR1cENvbnRyb2xzID0gc2V0dXBDb250cm9scztcbiAgICBwcm90by5jcmVhdGVVc2VyQ29udHJvbCA9IGNyZWF0ZVVzZXJDb250cm9sO1xuICAgIHByb3RvLnNldENvbnRyb2xzQWxpZ25tZW50ID0gc2V0Q29udHJvbHNBbGlnbm1lbnQ7XG5cbiAgICByZXR1cm4ge1xuICAgICAgICBzdGFydDogZnVuY3Rpb24oYXJncykge1xuICAgICAgICAgICAgaWYgKCEoYXJncy5wbGF0Zm9ybS5tYXAgaW5zdGFuY2VvZiBILk1hcCkgJiYgIShhcmdzLnBsYXRmb3JtLmxheWVycykpXG4gICAgICAgICAgICAgICAgcmV0dXJuIGNvbnNvbGUuZXJyb3IoJ01pc3NlZCB1aSBtb2R1bGUgZGVwZW5kZW5jaWVzJyk7XG5cbiAgICAgICAgICAgIHZhciB1aSA9IG5ldyBVSShhcmdzLnBsYXRmb3JtLCBhcmdzLmFsaWdubWVudCk7XG4gICAgICAgIH1cbiAgICB9XG5cbiAgICBmdW5jdGlvbiBzZXR1cENvbnRyb2xzKCkge1xuICAgICAgICB2YXIgTkFNRVMgPSBIZXJlTWFwc0NPTlNUUy5DT05UUk9MUy5OQU1FUyxcbiAgICAgICAgICAgIHVzZXJDb250cm9sID0gdGhpcy5jcmVhdGVVc2VyQ29udHJvbCgpO1xuXG4gICAgICAgIHRoaXMudWkuZ2V0Q29udHJvbChOQU1FUy5TRVRUSU5HUykuc2V0SW5jaWRlbnRzTGF5ZXIoZmFsc2UpO1xuICAgICAgICB0aGlzLnVpLmFkZENvbnRyb2woTkFNRVMuVVNFUiwgdXNlckNvbnRyb2wpO1xuICAgICAgICB0aGlzLnNldENvbnRyb2xzQWxpZ25tZW50KE5BTUVTKTtcbiAgICB9XG5cbiAgICBmdW5jdGlvbiBjcmVhdGVVc2VyQ29udHJvbCgpIHtcbiAgICAgICAgdmFyIHNlbGYgPSB0aGlzLFxuICAgICAgICAgICAgdXNlckNvbnRyb2wgPSBuZXcgSC51aS5Db250cm9sKCksXG4gICAgICAgICAgICBtYXJrdXAgPSAnPHN2ZyBjbGFzcz1cIkhfaWNvblwiIGZpbGw9XCIjZmZmXCIgeG1sbnM9XCJodHRwOi8vd3d3LnczLm9yZy8yMDAwL3N2Z1wiIHdpZHRoPVwiMTZcIiBoZWlnaHQ9XCIxNlwiIHZpZXdCb3g9XCIwIDAgMTYgMTZcIj48cGF0aCBjbGFzcz1cIm1pZGRsZV9sb2NhdGlvbl9zdHJva2VcIiBkPVwiTTggMTJjLTIuMjA2IDAtNC0xLjc5NS00LTQgMC0yLjIwNiAxLjc5NC00IDQtNHM0IDEuNzk0IDQgNGMwIDIuMjA1LTEuNzk0IDQtNCA0TTggMS4yNWE2Ljc1IDYuNzUgMCAxIDAgMCAxMy41IDYuNzUgNi43NSAwIDAgMCAwLTEzLjVcIj48L3BhdGg+PHBhdGggY2xhc3M9XCJpbm5lcl9sb2NhdGlvbl9zdHJva2VcIiBkPVwiTTggNWEzIDMgMCAxIDEgLjAwMSA2QTMgMyAwIDAgMSA4IDVtMC0xQzUuNzk0IDQgNCA1Ljc5NCA0IDhjMCAyLjIwNSAxLjc5NCA0IDQgNHM0LTEuNzk1IDQtNGMwLTIuMjA2LTEuNzk0LTQtNC00XCI+PC9wYXRoPjxwYXRoIGNsYXNzPVwib3V0ZXJfbG9jYXRpb25fc3Ryb2tlXCIgZD1cIk04IDEuMjVhNi43NSA2Ljc1IDAgMSAxIDAgMTMuNSA2Ljc1IDYuNzUgMCAwIDEgMC0xMy41TTggMEMzLjU5IDAgMCAzLjU5IDAgOGMwIDQuNDExIDMuNTkgOCA4IDhzOC0zLjU4OSA4LThjMC00LjQxLTMuNTktOC04LThcIj48L3BhdGg+PC9zdmc+JztcblxuICAgICAgICB2YXIgdXNlckNvbnRyb2xCdXR0b24gPSBuZXcgSC51aS5iYXNlLkJ1dHRvbih7XG4gICAgICAgICAgICBsYWJlbDogbWFya3VwLFxuICAgICAgICAgICAgb25TdGF0ZUNoYW5nZTogZnVuY3Rpb24oZXZ0KSB7XG4gICAgICAgICAgICAgICAgaWYgKHVzZXJDb250cm9sQnV0dG9uLmdldFN0YXRlKCkgPT09IEgudWkuYmFzZS5CdXR0b24uU3RhdGUuRE9XTilcbiAgICAgICAgICAgICAgICAgICAgcmV0dXJuO1xuXG4gICAgICAgICAgICAgICAgSGVyZU1hcHNBUElTZXJ2aWNlLmdldFBvc2l0aW9uKCkudGhlbihmdW5jdGlvbihyZXNwb25zZSkge1xuICAgICAgICAgICAgICAgICAgICB2YXIgcG9zaXRpb24gPSB7XG4gICAgICAgICAgICAgICAgICAgICAgICBsbmc6IHJlc3BvbnNlLmNvb3Jkcy5sb25naXR1ZGUsXG4gICAgICAgICAgICAgICAgICAgICAgICBsYXQ6IHJlc3BvbnNlLmNvb3Jkcy5sYXRpdHVkZVxuICAgICAgICAgICAgICAgICAgICB9O1xuICAgICAgICAgICAgICAgICAgICBcbiAgICAgICAgICAgICAgICAgICAgc2VsZi5tYXAuc2V0Q2VudGVyKHBvc2l0aW9uKTtcbiAgICAgICAgICAgICAgICAgICAgXG4gICAgICAgICAgICAgICAgICAgIEhlcmVNYXBzVXRpbHNTZXJ2aWNlLnpvb20oc2VsZi5tYXAsIDE3LCAuMDgpO1xuXG4gICAgICAgICAgICAgICAgICAgIGlmIChzZWxmLnVzZXJNYXJrZXIpIHtcbiAgICAgICAgICAgICAgICAgICAgICAgIHNlbGYudXNlck1hcmtlci5zZXRQb3NpdGlvbihwb3NpdGlvbik7XG4gICAgICAgICAgICAgICAgICAgICAgICByZXR1cm47XG4gICAgICAgICAgICAgICAgICAgIH1cbiAgICAgICAgICAgICAgICAgICAgXG4gICAgICAgICAgICAgICAgICAgIHNlbGYudXNlck1hcmtlciA9IEhlcmVNYXBzTWFya2VyU2VydmljZS5hZGRVc2VyTWFya2VyKHNlbGYubWFwLCB7XG4gICAgICAgICAgICAgICAgICAgICAgICBwb3M6IHBvc2l0aW9uXG4gICAgICAgICAgICAgICAgICAgIH0pO1xuICAgICAgICAgICAgICAgIH0pO1xuICAgICAgICAgICAgfVxuICAgICAgICB9KTtcblxuICAgICAgICB1c2VyQ29udHJvbC5hZGRDaGlsZCh1c2VyQ29udHJvbEJ1dHRvbik7XG5cbiAgICAgICAgcmV0dXJuIHVzZXJDb250cm9sO1xuICAgIH1cblxuICAgIGZ1bmN0aW9uIHNldENvbnRyb2xzQWxpZ25tZW50KE5BTUVTKSB7XG4gICAgICAgIGlmICghVUkuaXNWYWxpZEFsaWdubWVudCh0aGlzLmFsaWdubWVudCkpXG4gICAgICAgICAgICByZXR1cm47XG5cbiAgICAgICAgZm9yICh2YXIgaWQgaW4gTkFNRVMpIHtcbiAgICAgICAgICAgIHZhciBjb250cm9sID0gdGhpcy51aS5nZXRDb250cm9sKE5BTUVTW2lkXSk7XG5cbiAgICAgICAgICAgIGlmICghTkFNRVMuaGFzT3duUHJvcGVydHkoaWQpIHx8ICFjb250cm9sKVxuICAgICAgICAgICAgICAgIGNvbnRpbnVlO1xuXG4gICAgICAgICAgICBjb250cm9sLnNldEFsaWdubWVudCh0aGlzLmFsaWdubWVudCk7XG4gICAgICAgIH1cbiAgICB9XG5cbiAgICBmdW5jdGlvbiBpc1ZhbGlkQWxpZ25tZW50KGFsaWdubWVudCkge1xuICAgICAgICByZXR1cm4gISEoSGVyZU1hcHNDT05TVFMuQ09OVFJPTFMuUE9TSVRJT05TLmluZGV4T2YoYWxpZ25tZW50KSArIDEpO1xuICAgIH1cblxufTsiLCJtb2R1bGUuZXhwb3J0cyA9IGZ1bmN0aW9uKCkge1xuICAgIHZhciBvcHRpb25zID0ge307XG4gICAgdmFyIERFRkFVTFRfQVBJX1ZFUlNJT04gPSBcIjMuMFwiO1xuXG4gICAgdGhpcy4kZ2V0ID0gZnVuY3Rpb24oKXtcbiAgICAgICAgcmV0dXJuIHtcbiAgICAgICAgICAgIGFwcF9pZDogb3B0aW9ucy5hcHBfaWQsXG4gICAgICAgICAgICBhcHBfY29kZTogb3B0aW9ucy5hcHBfY29kZSxcbiAgICAgICAgICAgIGFwaVZlcnNpb246IG9wdGlvbnMuYXBpVmVyc2lvbiB8fCBERUZBVUxUX0FQSV9WRVJTSU9OLFxuICAgICAgICAgICAgdXNlSFRUUFM6IG9wdGlvbnMudXNlSFRUUFMsXG4gICAgICAgICAgICB1c2VDSVQ6ICEhb3B0aW9ucy51c2VDSVRcbiAgICAgICAgfVxuICAgIH07XG5cbiAgICB0aGlzLnNldE9wdGlvbnMgPSBmdW5jdGlvbihvcHRzKXtcbiAgICAgICAgb3B0aW9ucyA9IG9wdHM7XG4gICAgfTtcbn07IiwiXG5tb2R1bGUuZXhwb3J0cyA9IEhlcmVNYXBzVXRpbHNTZXJ2aWNlO1xuXG5IZXJlTWFwc1V0aWxzU2VydmljZS4kaW5qZWN0ID0gW1xuICAgICckcm9vdFNjb3BlJywgXG4gICAgJyR0aW1lb3V0JywgXG4gICAgJ0hlcmVNYXBzQ09OU1RTJ1xuXTtcbmZ1bmN0aW9uIEhlcmVNYXBzVXRpbHNTZXJ2aWNlKCRyb290U2NvcGUsICR0aW1lb3V0LCBIZXJlTWFwc0NPTlNUUykge1xuICAgIHJldHVybiB7XG4gICAgICAgIHRocm90dGxlOiB0aHJvdHRsZSxcbiAgICAgICAgY3JlYXRlU2NyaXB0VGFnOiBjcmVhdGVTY3JpcHRUYWcsXG4gICAgICAgIGNyZWF0ZUxpbmtUYWc6IGNyZWF0ZUxpbmtUYWcsXG4gICAgICAgIHJ1blNjb3BlRGlnZXN0SWZOZWVkOiBydW5TY29wZURpZ2VzdElmTmVlZCxcbiAgICAgICAgaXNWYWxpZENvb3JkczogaXNWYWxpZENvb3JkcyxcbiAgICAgICAgYWRkRXZlbnRMaXN0ZW5lcjogYWRkRXZlbnRMaXN0ZW5lcixcbiAgICAgICAgem9vbTogem9vbSxcbiAgICAgICAgZ2VuZXJhdGVJZDogZ2VuZXJhdGVJZFxuICAgIH07XG5cbiAgICAvLyNyZWdpb24gUFVCTElDXG4gICAgZnVuY3Rpb24gdGhyb3R0bGUoZm4sIHBlcmlvZCkge1xuICAgICAgICB2YXIgdGltZW91dCA9IG51bGw7XG5cbiAgICAgICAgcmV0dXJuIGZ1bmN0aW9uICgpIHtcbiAgICAgICAgICAgIGlmICgkdGltZW91dClcbiAgICAgICAgICAgICAgICAkdGltZW91dC5jYW5jZWwodGltZW91dCk7XG5cbiAgICAgICAgICAgIHRpbWVvdXQgPSAkdGltZW91dChmbiwgcGVyaW9kKTtcbiAgICAgICAgfVxuICAgIH1cblxuICAgIGZ1bmN0aW9uIGFkZEV2ZW50TGlzdGVuZXIob2JqLCBldmVudE5hbWUsIGxpc3RlbmVyLCB1c2VDYXB0dXJlKSB7XG4gICAgICAgIHZhciBfdXNlQ2FwdHVyZSA9ICEhdXNlQ2FwdHVyZTtcblxuICAgICAgICBvYmouYWRkRXZlbnRMaXN0ZW5lcihldmVudE5hbWUsIGxpc3RlbmVyLCBfdXNlQ2FwdHVyZSk7XG4gICAgfVxuXG4gICAgZnVuY3Rpb24gcnVuU2NvcGVEaWdlc3RJZk5lZWQoc2NvcGUsIGNiKSB7XG4gICAgICAgIGlmIChzY29wZS4kcm9vdCAmJiBzY29wZS4kcm9vdC4kJHBoYXNlICE9PSAnJGFwcGx5JyAmJiBzY29wZS4kcm9vdC4kJHBoYXNlICE9PSAnJGRpZ2VzdCcpIHtcbiAgICAgICAgICAgIHNjb3BlLiRkaWdlc3QoY2IgfHwgYW5ndWxhci5ub29wKTtcbiAgICAgICAgICAgIHJldHVybiB0cnVlO1xuICAgICAgICB9XG4gICAgICAgIHJldHVybiBmYWxzZTtcbiAgICB9XG5cbiAgICBmdW5jdGlvbiBjcmVhdGVTY3JpcHRUYWcoYXR0cnMpIHtcbiAgICAgICAgdmFyIHNjcmlwdCA9IGRvY3VtZW50LmdldEVsZW1lbnRCeUlkKGF0dHJzLnNyYyk7XG5cbiAgICAgICAgaWYgKHNjcmlwdClcbiAgICAgICAgICAgIHJldHVybiBmYWxzZTtcblxuICAgICAgICBzY3JpcHQgPSBkb2N1bWVudC5jcmVhdGVFbGVtZW50KCdzY3JpcHQnKTtcbiAgICAgICAgc2NyaXB0LnR5cGUgPSAndGV4dC9qYXZhc2NyaXB0JztcbiAgICAgICAgc2NyaXB0LmlkID0gYXR0cnMuc3JjO1xuICAgICAgICBfc2V0QXR0cnMoc2NyaXB0LCBhdHRycyk7XG5cbiAgICAgICAgcmV0dXJuIHNjcmlwdDtcbiAgICB9XG5cbiAgICBmdW5jdGlvbiBjcmVhdGVMaW5rVGFnKGF0dHJzKSB7XG4gICAgICAgIHZhciBsaW5rID0gZG9jdW1lbnQuZ2V0RWxlbWVudEJ5SWQoYXR0cnMuaHJlZik7XG5cbiAgICAgICAgaWYgKGxpbmspXG4gICAgICAgICAgICByZXR1cm4gZmFsc2U7XG5cbiAgICAgICAgbGluayA9IGRvY3VtZW50LmNyZWF0ZUVsZW1lbnQoJ2xpbmsnKTtcbiAgICAgICAgbGluay5pZCA9IGF0dHJzLmhyZWY7XG4gICAgICAgIF9zZXRBdHRycyhsaW5rLCBhdHRycyk7XG5cbiAgICAgICAgcmV0dXJuIGxpbms7XG4gICAgfVxuXG4gICAgZnVuY3Rpb24gaXNWYWxpZENvb3Jkcyhjb29yZHMpIHtcbiAgICAgICAgcmV0dXJuIGNvb3JkcyAmJlxuICAgICAgICAgICAgKHR5cGVvZiBjb29yZHMubGF0aXR1ZGUgPT09ICdzdHJpbmcnIHx8IHR5cGVvZiBjb29yZHMubGF0aXR1ZGUgPT09ICdudW1iZXInKSAmJlxuICAgICAgICAgICAgKHR5cGVvZiBjb29yZHMubG9uZ2l0dWRlID09PSAnc3RyaW5nJyB8fCB0eXBlb2YgY29vcmRzLmxvbmdpdHVkZSA9PT0gJ251bWJlcicpXG4gICAgfVxuXG4gICAgZnVuY3Rpb24gem9vbShtYXAsIHZhbHVlLCBzdGVwKSB7XG4gICAgICAgIHZhciBjdXJyZW50Wm9vbSA9IG1hcC5nZXRab29tKCksXG4gICAgICAgICAgICBfc3RlcCA9IHN0ZXAgfHwgSGVyZU1hcHNDT05TVFMuQU5JTUFUSU9OX1pPT01fU1RFUCxcbiAgICAgICAgICAgIGZhY3RvciA9IGN1cnJlbnRab29tID49IHZhbHVlID8gLTEgOiAxLFxuICAgICAgICAgICAgaW5jcmVtZW50ID0gc3RlcCAqIGZhY3RvcjtcblxuICAgICAgICByZXR1cm4gKGZ1bmN0aW9uIHpvb20oKSB7XG4gICAgICAgICAgICBpZiAoIXN0ZXAgfHwgTWF0aC5mbG9vcihjdXJyZW50Wm9vbSkgPT09IE1hdGguZmxvb3IodmFsdWUpKSB7XG4gICAgICAgICAgICAgICAgbWFwLnNldFpvb20odmFsdWUpO1xuICAgICAgICAgICAgICAgIHJldHVybjtcbiAgICAgICAgICAgIH1cblxuICAgICAgICAgICAgY3VycmVudFpvb20gKz0gaW5jcmVtZW50O1xuICAgICAgICAgICAgbWFwLnNldFpvb20oY3VycmVudFpvb20pO1xuXG4gICAgICAgICAgICByZXF1ZXN0QW5pbWF0aW9uRnJhbWUoem9vbSk7XG4gICAgICAgIH0pKCk7XG4gICAgfVxuXG4gICAgZnVuY3Rpb24gZ2VuZXJhdGVJZCgpIHtcbiAgICAgICAgdmFyIG1hc2sgPSAneHh4eHh4eHgteHh4eC00eHh4LXl4eHgteHh4eHh4eHh4eHh4JyxcbiAgICAgICAgICAgIHJlZ2V4cCA9IC9beHldL2csXG4gICAgICAgICAgICBkID0gbmV3IERhdGUoKS5nZXRUaW1lKCksXG4gICAgICAgICAgICB1dWlkID0gbWFzay5yZXBsYWNlKHJlZ2V4cCwgZnVuY3Rpb24gKGMpIHtcbiAgICAgICAgICAgICAgICB2YXIgciA9IChkICsgTWF0aC5yYW5kb20oKSAqIDE2KSAlIDE2IHwgMDtcbiAgICAgICAgICAgICAgICBkID0gTWF0aC5mbG9vcihkIC8gMTYpO1xuICAgICAgICAgICAgICAgIHJldHVybiAoYyA9PSAneCcgPyByIDogKHIgJiAweDMgfCAweDgpKS50b1N0cmluZygxNik7XG4gICAgICAgICAgICB9KTtcblxuICAgICAgICByZXR1cm4gdXVpZDtcbiAgICB9XG5cbiAgICAvLyNlbmRyZWdpb24gUFVCTElDIFxuXG4gICAgZnVuY3Rpb24gX3NldEF0dHJzKGVsLCBhdHRycykge1xuICAgICAgICBpZiAoIWVsIHx8ICFhdHRycylcbiAgICAgICAgICAgIHRocm93IG5ldyBFcnJvcignTWlzc2VkIGF0dHJpYnV0ZXMnKTtcblxuICAgICAgICBmb3IgKHZhciBrZXkgaW4gYXR0cnMpIHtcbiAgICAgICAgICAgIGlmICghYXR0cnMuaGFzT3duUHJvcGVydHkoa2V5KSlcbiAgICAgICAgICAgICAgICBjb250aW51ZTtcblxuICAgICAgICAgICAgZWxba2V5XSA9IGF0dHJzW2tleV07XG4gICAgICAgIH1cbiAgICB9XG59OyIsIm1vZHVsZS5leHBvcnRzID0gSGVyZU1hcHNEZWZhdWx0TWFya2VyO1xuXG5IZXJlTWFwc0RlZmF1bHRNYXJrZXIuJGluamVjdCA9IFsnSGVyZU1hcHNNYXJrZXJJbnRlcmZhY2UnXTtcbmZ1bmN0aW9uIEhlcmVNYXBzRGVmYXVsdE1hcmtlcihIZXJlTWFwc01hcmtlckludGVyZmFjZSl7XG4gICAgZnVuY3Rpb24gRGVmYXVsdE1hcmtlcihwbGFjZSl7XG4gICAgICAgIHRoaXMucGxhY2UgPSBwbGFjZTtcbiAgICAgICAgdGhpcy5zZXRDb29yZHMoKTtcbiAgICB9XG5cbiAgICB2YXIgcHJvdG8gPSBEZWZhdWx0TWFya2VyLnByb3RvdHlwZSA9IG5ldyBIZXJlTWFwc01hcmtlckludGVyZmFjZSgpO1xuICAgIHByb3RvLmNvbnN0cnVjdG9yID0gRGVmYXVsdE1hcmtlcjtcblxuICAgIHByb3RvLmNyZWF0ZSA9IGNyZWF0ZTtcblxuICAgIHJldHVybiBEZWZhdWx0TWFya2VyO1xuICAgIFxuICAgIGZ1bmN0aW9uIGNyZWF0ZSgpe1xuICAgICAgICB2YXIgbWFya2VyID0gbmV3IEgubWFwLk1hcmtlcih0aGlzLmNvb3Jkcyk7XG4gICAgICAgIFxuICAgICAgICB0aGlzLmFkZEluZm9CdWJibGUobWFya2VyKTtcbiAgICAgICAgXG4gICAgICAgIHJldHVybiBtYXJrZXI7XG4gICAgfVxufSIsIm1vZHVsZS5leHBvcnRzID0gSGVyZU1hcHNET01NYXJrZXI7XG5cbkhlcmVNYXBzRE9NTWFya2VyLiRpbmplY3QgPSBbJ0hlcmVNYXBzTWFya2VySW50ZXJmYWNlJ107XG5mdW5jdGlvbiBIZXJlTWFwc0RPTU1hcmtlcihIZXJlTWFwc01hcmtlckludGVyZmFjZSl7XG4gICAgZnVuY3Rpb24gRE9NTWFya2VyKHBsYWNlKXtcbiAgICAgICAgdGhpcy5wbGFjZSA9IHBsYWNlO1xuICAgICAgICB0aGlzLnNldENvb3JkcygpO1xuICAgIH1cblxuICAgIHZhciBwcm90byA9IERPTU1hcmtlci5wcm90b3R5cGUgPSBuZXcgSGVyZU1hcHNNYXJrZXJJbnRlcmZhY2UoKTtcbiAgICBwcm90by5jb25zdHJ1Y3RvciA9IERPTU1hcmtlcjtcblxuICAgIHByb3RvLmNyZWF0ZSA9IGNyZWF0ZTtcbiAgICBwcm90by5nZXRJY29uID0gZ2V0SWNvbjtcbiAgICBwcm90by5zZXR1cEV2ZW50cyA9IHNldHVwRXZlbnRzO1xuXG4gICAgcmV0dXJuIERPTU1hcmtlcjtcbiAgICBcbiAgICBmdW5jdGlvbiBjcmVhdGUoKXtcbiAgICAgICAgdmFyIG1hcmtlciA9IG5ldyBILm1hcC5Eb21NYXJrZXIodGhpcy5jb29yZHMsIHtcbiAgICAgICAgICAgIGljb246IHRoaXMuZ2V0SWNvbigpXG4gICAgICAgIH0pO1xuICAgICAgICBcbiAgICAgICAgdGhpcy5hZGRJbmZvQnViYmxlKG1hcmtlcik7XG4gICAgICAgIFxuICAgICAgICByZXR1cm4gbWFya2VyO1xuICAgIH1cbiAgICBcbiAgICBmdW5jdGlvbiBnZXRJY29uKCl7XG4gICAgICAgIHZhciBpY29uID0gdGhpcy5wbGFjZS5tYXJrdXA7XG4gICAgICAgICBpZighaWNvbilcbiAgICAgICAgICAgIHRocm93IG5ldyBFcnJvcignbWFya3VwIG1pc3NlZCcpO1xuXG4gICAgICAgIHJldHVybiBuZXcgSC5tYXAuRG9tSWNvbihpY29uKTtcbiAgICB9XG4gICAgXG4gICAgZnVuY3Rpb24gc2V0dXBFdmVudHMoZWwsIGV2ZW50cywgcmVtb3ZlKXtcbiAgICAgICAgdmFyIG1ldGhvZCA9IHJlbW92ZSA/ICdyZW1vdmVFdmVudExpc3RlbmVyJyA6ICdhZGRFdmVudExpc3RlbmVyJztcblxuICAgICAgICBmb3IodmFyIGtleSBpbiBldmVudHMpIHtcbiAgICAgICAgICAgIGlmKCFldmVudHMuaGFzT3duUHJvcGVydHkoa2V5KSlcbiAgICAgICAgICAgICAgICBjb250aW51ZTtcblxuICAgICAgICAgICAgZWxbbWV0aG9kXS5jYWxsKG51bGwsIGtleSwgZXZlbnRzW2tleV0pO1xuICAgICAgICB9XG4gICAgfVxufSIsIm1vZHVsZS5leHBvcnRzID0gYW5ndWxhci5tb2R1bGUoJ2hlcmVtYXBzLW1hcmtlcnMtbW9kdWxlJywgW10pXG4gICAgLmZhY3RvcnkoJ0hlcmVNYXBzTWFya2VySW50ZXJmYWNlJywgcmVxdWlyZSgnLi9tYXJrZXIuanMnKSlcbiAgICAuZmFjdG9yeSgnSGVyZU1hcHNEZWZhdWx0TWFya2VyJywgcmVxdWlyZSgnLi9kZWZhdWx0Lm1hcmtlci5qcycpKVxuICAgIC5mYWN0b3J5KCdIZXJlTWFwc0RPTU1hcmtlcicsIHJlcXVpcmUoJy4vZG9tLm1hcmtlci5qcycpKVxuICAgIC5mYWN0b3J5KCdIZXJlTWFwc1NWR01hcmtlcicsIHJlcXVpcmUoJy4vc3ZnLm1hcmtlci5qcycpKVxuICAgIC5zZXJ2aWNlKCdIZXJlTWFwc01hcmtlclNlcnZpY2UnLCByZXF1aXJlKCcuL21hcmtlcnMuc2VydmljZS5qcycpKTsiLCJtb2R1bGUuZXhwb3J0cyA9IGZ1bmN0aW9uKCl7XG4gICAgZnVuY3Rpb24gTWFya2VySW50ZXJmYWNlKCl7XG4gICAgICAgIHRocm93IG5ldyBFcnJvcignQWJzdHJhY3QgY2xhc3MhIFRoZSBJbnN0YW5jZSBzaG91bGQgYmUgY3JlYXRlZCcpO1xuICAgIH1cbiAgICBcbiAgICB2YXIgcHJvdG8gPSBNYXJrZXJJbnRlcmZhY2UucHJvdG90eXBlO1xuICAgIFxuICAgIHByb3RvLmNyZWF0ZSA9IGNyZWF0ZTtcbiAgICBwcm90by5zZXRDb29yZHMgPSBzZXRDb29yZHM7XG4gICAgcHJvdG8uYWRkSW5mb0J1YmJsZSA9IGFkZEluZm9CdWJibGU7XG4gICAgXG4gICAgZnVuY3Rpb24gTWFya2VyKCl7fVxuICAgIFxuICAgIE1hcmtlci5wcm90b3R5cGUgPSBwcm90bztcbiAgICBcbiAgICByZXR1cm4gTWFya2VyO1xuICAgIFxuICAgIGZ1bmN0aW9uIGNyZWF0ZSgpe1xuICAgICAgICB0aHJvdyBuZXcgRXJyb3IoJ2NyZWF0ZTo6IG5vdCBpbXBsZW1lbnRlZCcpOyBcbiAgICB9XG4gICAgXG4gICAgZnVuY3Rpb24gc2V0Q29vcmRzKCl7XG4gICAgICAgICB0aGlzLmNvb3JkcyA9IHtcbiAgICAgICAgICAgIGxhdDogdGhpcy5wbGFjZS5wb3MubGF0LFxuICAgICAgICAgICAgbG5nOiB0aGlzLnBsYWNlLnBvcy5sbmdcbiAgICAgICAgfVxuICAgIH1cbiAgICBcbiAgICBmdW5jdGlvbiBhZGRJbmZvQnViYmxlKG1hcmtlcil7XG4gICAgICAgIGlmKCF0aGlzLnBsYWNlLnBvcHVwKVxuICAgICAgICAgICAgcmV0dXJuO1xuICAgICAgICAgICAgXG4gICAgICAgIG1hcmtlci5zZXREYXRhKHRoaXMucGxhY2UucG9wdXApXG4gICAgfVxufSIsIm1vZHVsZS5leHBvcnRzID0gSGVyZU1hcHNNYXJrZXJTZXJ2aWNlO1xuXG5IZXJlTWFwc01hcmtlclNlcnZpY2UuJGluamVjdCA9IFtcbiAgICAnSGVyZU1hcHNEZWZhdWx0TWFya2VyJyxcbiAgICAnSGVyZU1hcHNET01NYXJrZXInLFxuICAgICdIZXJlTWFwc1NWR01hcmtlcicsXG4gICAgJ0hlcmVNYXBzQ09OU1RTJ1xuXTtcbmZ1bmN0aW9uIEhlcmVNYXBzTWFya2VyU2VydmljZShIZXJlTWFwc0RlZmF1bHRNYXJrZXIsIEhlcmVNYXBzRE9NTWFya2VyLCBIZXJlTWFwc1NWR01hcmtlciwgSGVyZU1hcHNDT05TVFMpIHtcbiAgICB2YXIgTUFSS0VSX1RZUEVTID0gSGVyZU1hcHNDT05TVFMuTUFSS0VSX1RZUEVTO1xuXG4gICAgcmV0dXJuIHtcbiAgICAgICAgYWRkTWFya2Vyc1RvTWFwOiBhZGRNYXJrZXJzVG9NYXAsXG4gICAgICAgIGFkZFVzZXJNYXJrZXI6IGFkZFVzZXJNYXJrZXIsXG4gICAgICAgIHVwZGF0ZU1hcmtlcnM6IHVwZGF0ZU1hcmtlcnMsXG4gICAgICAgIGlzTWFya2VySW5zdGFuY2U6IGlzTWFya2VySW5zdGFuY2VcbiAgICB9XG5cbiAgICBmdW5jdGlvbiBpc01hcmtlckluc3RhbmNlKHRhcmdldCkge1xuICAgICAgICByZXR1cm4gdGFyZ2V0IGluc3RhbmNlb2YgSC5tYXAuTWFya2VyIHx8IHRhcmdldCBpbnN0YW5jZW9mIEgubWFwLkRvbU1hcmtlcjtcbiAgICB9XG5cbiAgICBmdW5jdGlvbiBhZGRVc2VyTWFya2VyKG1hcCwgcGxhY2UpIHtcbiAgICAgICAgaWYobWFwLnVzZXJNYXJrZXIpXG4gICAgICAgICAgICByZXR1cm4gbWFwLnVzZXJNYXJrZXI7XG4gICAgICAgIFxuICAgICAgICBwbGFjZS5tYXJrdXAgPSAnPHN2ZyB3aWR0aD1cIjM1cHhcIiBoZWlnaHQ9XCIzNXB4XCIgdmlld0JveD1cIjAgMCA5MCA5MFwiIHZlcnNpb249XCIxLjFcIiB4bWxucz1cImh0dHA6Ly93d3cudzMub3JnLzIwMDAvc3ZnXCIgeG1sbnM6eGxpbms9XCJodHRwOi8vd3d3LnczLm9yZy8xOTk5L3hsaW5rXCI+JyArXG4gICAgICAgICAgICAnPGRlZnM+PGNpcmNsZSBpZD1cInBhdGgtMVwiIGN4PVwiMzAyXCIgY3k9XCI4MDJcIiByPVwiMTVcIj48L2NpcmNsZT4nICtcbiAgICAgICAgICAgICc8bWFzayBpZD1cIm1hc2stMlwiIG1hc2tDb250ZW50VW5pdHM9XCJ1c2VyU3BhY2VPblVzZVwiIG1hc2tVbml0cz1cIm9iamVjdEJvdW5kaW5nQm94XCIgeD1cIi0zMFwiIHk9XCItMzBcIiB3aWR0aD1cIjkwXCIgaGVpZ2h0PVwiOTBcIj4nICtcbiAgICAgICAgICAgICc8cmVjdCB4PVwiMjU3XCIgeT1cIjc1N1wiIHdpZHRoPVwiOTBcIiBoZWlnaHQ9XCI5MFwiIGZpbGw9XCJ3aGl0ZVwiPjwvcmVjdD48dXNlIHhsaW5rOmhyZWY9XCIjcGF0aC0xXCIgZmlsbD1cImJsYWNrXCI+PC91c2U+JyArXG4gICAgICAgICAgICAnPC9tYXNrPjwvZGVmcz48ZyBpZD1cIlBhZ2UtMVwiIHN0cm9rZT1cIm5vbmVcIiBzdHJva2Utd2lkdGg9XCIxXCIgZmlsbD1cIm5vbmVcIiBmaWxsLXJ1bGU9XCJldmVub2RkXCI+JyArXG4gICAgICAgICAgICAnPGcgaWQ9XCJTZXJ2aWNlLU9wdGlvbnMtLS1kaXJlY3Rpb25zLS0tbWFwXCIgdHJhbnNmb3JtPVwidHJhbnNsYXRlKC0yNTcuMDAwMDAwLCAtNzU3LjAwMDAwMClcIj48ZyBpZD1cIk92YWwtMTVcIj4nICtcbiAgICAgICAgICAgICc8dXNlIGZpbGw9XCIjRkZGRkZGXCIgZmlsbC1ydWxlPVwiZXZlbm9kZFwiIHhsaW5rOmhyZWY9XCIjcGF0aC0xXCI+PC91c2U+JyArXG4gICAgICAgICAgICAnPHVzZSBzdHJva2Utb3BhY2l0eT1cIjAuMjk2MTM5MDRcIiBzdHJva2U9XCIjM0YzNEEwXCIgbWFzaz1cInVybCgjbWFzay0yKVwiIHN0cm9rZS13aWR0aD1cIjYwXCIgeGxpbms6aHJlZj1cIiNwYXRoLTFcIj48L3VzZT4nICtcbiAgICAgICAgICAgICc8dXNlIHN0cm9rZT1cIiMzRjM0QTBcIiBzdHJva2Utd2lkdGg9XCI1XCIgeGxpbms6aHJlZj1cIiNwYXRoLTFcIj48L3VzZT48L2c+PC9nPjwvZz48L3N2Zz4nO1xuXG4gICAgICAgIG1hcC51c2VyTWFya2VyID0gbmV3IEhlcmVNYXBzU1ZHTWFya2VyKHBsYWNlKS5jcmVhdGUoKTtcblxuICAgICAgICBtYXAuYWRkT2JqZWN0KG1hcC51c2VyTWFya2VyKTtcblxuICAgICAgICByZXR1cm4gbWFwLnVzZXJNYXJrZXI7XG4gICAgfVxuXG4gICAgZnVuY3Rpb24gYWRkTWFya2Vyc1RvTWFwKG1hcCwgcGxhY2VzLCByZWZyZXNoVmlld2JvdW5kcykge1xuICAgICAgICBpZiAoIXBsYWNlcyB8fCAhcGxhY2VzLmxlbmd0aClcbiAgICAgICAgICAgIHJldHVybjtcblxuICAgICAgICBpZiAoIShtYXAgaW5zdGFuY2VvZiBILk1hcCkpXG4gICAgICAgICAgICB0aHJvdyBuZXcgRXJyb3IoJ1Vuc3VwcG9ydGVkIG1hcCBpbnN0YW5jZScpO1xuXG4gICAgICAgIGlmICghbWFwLm1hcmtlcnNHcm91cClcbiAgICAgICAgICAgIG1hcC5tYXJrZXJzR3JvdXAgPSBuZXcgSC5tYXAuR3JvdXAoKTtcblxuICAgICAgICBwbGFjZXMuZm9yRWFjaChmdW5jdGlvbihwbGFjZSwgaSkge1xuICAgICAgICAgICAgdmFyIGNyZWF0b3IgPSBfZ2V0TWFya2VyQ3JlYXRvcihwbGFjZSksXG4gICAgICAgICAgICAgICAgbWFya2VyID0gcGxhY2UuZHJhZ2dhYmxlID8gX2RyYWdnYWJsZU1hcmtlck1peGluKGNyZWF0b3IuY3JlYXRlKCkpIDogY3JlYXRvci5jcmVhdGUoKTtcblxuICAgICAgICAgICAgbWFwLm1hcmtlcnNHcm91cC5hZGRPYmplY3QobWFya2VyKTtcbiAgICAgICAgfSk7XG5cbiAgICAgICAgbWFwLmFkZE9iamVjdChtYXAubWFya2Vyc0dyb3VwKTtcblxuICAgICAgICBpZihyZWZyZXNoVmlld2JvdW5kcyl7XG4gICAgICAgICAgbWFwLnNldFZpZXdCb3VuZHMobWFwLm1hcmtlcnNHcm91cC5nZXRCb3VuZHMoKSk7XG4gICAgICAgIH1cbiAgICAgIH1cbiAgICBmdW5jdGlvbiB1cGRhdGVNYXJrZXJzKG1hcCwgcGxhY2VzLCByZWZyZXNoVmlld2JvdW5kcykge1xuICAgICAgICBpZiAobWFwLm1hcmtlcnNHcm91cCkge1xuICAgICAgICAgICAgbWFwLm1hcmtlcnNHcm91cC5yZW1vdmVBbGwoKTtcbiAgICAgICAgICAgIG1hcC5yZW1vdmVPYmplY3QobWFwLm1hcmtlcnNHcm91cCk7XG4gICAgICAgICAgICBtYXAubWFya2Vyc0dyb3VwID0gbnVsbDtcbiAgICAgICAgfVxuXG4gICAgICAgIGFkZE1hcmtlcnNUb01hcC5hcHBseShudWxsLCBhcmd1bWVudHMpO1xuICAgIH1cblxuICAgIGZ1bmN0aW9uIF9nZXRNYXJrZXJDcmVhdG9yKHBsYWNlKSB7XG4gICAgICAgIHZhciBDb25jcmV0ZU1hcmtlcixcbiAgICAgICAgICAgIHR5cGUgPSBwbGFjZS50eXBlID8gcGxhY2UudHlwZS50b1VwcGVyQ2FzZSgpIDogbnVsbDtcblxuICAgICAgICBzd2l0Y2ggKHR5cGUpIHtcbiAgICAgICAgICAgIGNhc2UgTUFSS0VSX1RZUEVTLkRPTTpcbiAgICAgICAgICAgICAgICBDb25jcmV0ZU1hcmtlciA9IEhlcmVNYXBzRE9NTWFya2VyO1xuICAgICAgICAgICAgICAgIGJyZWFrO1xuICAgICAgICAgICAgY2FzZSBNQVJLRVJfVFlQRVMuU1ZHOlxuICAgICAgICAgICAgICAgIENvbmNyZXRlTWFya2VyID0gSGVyZU1hcHNTVkdNYXJrZXI7XG4gICAgICAgICAgICAgICAgYnJlYWs7XG4gICAgICAgICAgICBkZWZhdWx0OlxuICAgICAgICAgICAgICAgIENvbmNyZXRlTWFya2VyID0gSGVyZU1hcHNEZWZhdWx0TWFya2VyO1xuICAgICAgICB9XG5cbiAgICAgICAgcmV0dXJuIG5ldyBDb25jcmV0ZU1hcmtlcihwbGFjZSk7XG4gICAgfVxuXG4gICAgZnVuY3Rpb24gX2RyYWdnYWJsZU1hcmtlck1peGluKG1hcmtlcikge1xuICAgICAgICBtYXJrZXIuZHJhZ2dhYmxlID0gdHJ1ZTtcblxuICAgICAgICByZXR1cm4gbWFya2VyO1xuICAgIH1cblxufTtcbiIsIm1vZHVsZS5leHBvcnRzID0gSGVyZU1hcHNTVkdNYXJrZXI7XG5cbkhlcmVNYXBzU1ZHTWFya2VyLiRpbmplY3QgPSBbJ0hlcmVNYXBzTWFya2VySW50ZXJmYWNlJ107XG5mdW5jdGlvbiBIZXJlTWFwc1NWR01hcmtlcihIZXJlTWFwc01hcmtlckludGVyZmFjZSl7XG4gICAgZnVuY3Rpb24gU1ZHTWFya2VyKHBsYWNlKXtcbiAgICAgICAgdGhpcy5wbGFjZSA9IHBsYWNlO1xuICAgICAgICB0aGlzLnNldENvb3JkcygpO1xuICAgIH1cbiAgICBcbiAgICB2YXIgcHJvdG8gPSBTVkdNYXJrZXIucHJvdG90eXBlID0gbmV3IEhlcmVNYXBzTWFya2VySW50ZXJmYWNlKCk7XG4gICAgcHJvdG8uY29uc3RydWN0b3IgPSBTVkdNYXJrZXI7XG4gICAgXG4gICAgcHJvdG8uY3JlYXRlID0gY3JlYXRlO1xuICAgIHByb3RvLmdldEljb24gPSBnZXRJY29uO1xuICAgIFxuICAgIHJldHVybiBTVkdNYXJrZXI7XG4gICAgXG4gICAgZnVuY3Rpb24gY3JlYXRlKCl7XG4gICAgICAgIHZhciBtYXJrZXIgPSBuZXcgSC5tYXAuTWFya2VyKHRoaXMuY29vcmRzLCB7XG4gICAgICAgICAgICBpY29uOiB0aGlzLmdldEljb24oKSxcbiAgICAgICAgfSk7XG4gICAgICAgIFxuICAgICAgICB0aGlzLmFkZEluZm9CdWJibGUobWFya2VyKTtcbiAgICAgICAgXG4gICAgICAgIHJldHVybiBtYXJrZXI7XG4gICAgfVxuICAgIFxuICAgIGZ1bmN0aW9uIGdldEljb24oKXtcbiAgICAgICAgdmFyIGljb24gPSB0aGlzLnBsYWNlLm1hcmt1cDtcbiAgICAgICAgIGlmKCFpY29uKVxuICAgICAgICAgICAgdGhyb3cgbmV3IEVycm9yKCdtYXJrdXAgbWlzc2VkJyk7XG5cbiAgICAgICAgcmV0dXJuIG5ldyBILm1hcC5JY29uKGljb24pO1xuICAgIH1cbn0iLCJtb2R1bGUuZXhwb3J0cyA9IGFuZ3VsYXIubW9kdWxlKCdoZXJlbWFwcy1yb3V0ZXMtbW9kdWxlJywgW10pXG4gICAgICAgICAgICAgICAgICAgIC5zZXJ2aWNlKCdIZXJlTWFwc1JvdXRlc1NlcnZpY2UnLCByZXF1aXJlKCcuL3JvdXRlcy5zZXJ2aWNlLmpzJykpOyAgIiwibW9kdWxlLmV4cG9ydHMgPSBIZXJlTWFwc1JvdXRlc1NlcnZpY2U7XG5cbkhlcmVNYXBzUm91dGVzU2VydmljZS4kaW5qZWN0ID0gWyckcSddO1xuZnVuY3Rpb24gSGVyZU1hcHNSb3V0ZXNTZXJ2aWNlKCRxKSB7XG4gICAgcmV0dXJuIHtcbiAgICAgICAgY2FsY3VsYXRlUm91dGU6IGNhbGN1bGF0ZVJvdXRlLFxuICAgICAgICBhZGRSb3V0ZVRvTWFwOiBhZGRSb3V0ZVRvTWFwLFxuICAgICAgICBjbGVhblJvdXRlczogY2xlYW5Sb3V0ZXNcbiAgICB9XG5cbiAgICBmdW5jdGlvbiBjYWxjdWxhdGVSb3V0ZShoZXJlbWFwcywgY29uZmlnKSB7XG4gICAgICAgIHZhciBwbGF0Zm9ybSA9IGhlcmVtYXBzLnBsYXRmb3JtLFxuICAgICAgICAgICAgbWFwID0gaGVyZW1hcHMubWFwLFxuICAgICAgICAgICAgcm91dGVyID0gcGxhdGZvcm0uZ2V0Um91dGluZ1NlcnZpY2UoKSxcbiAgICAgICAgICAgIGRpciA9IGNvbmZpZy5kaXJlY3Rpb24sXG4gICAgICAgICAgICB3YXlwb2ludHMgPSBkaXIud2F5cG9pbnRzO1xuXG4gICAgICAgIHZhciBtb2RlID0gJ3t7TU9ERX19O3t7VkVDSElMRX19J1xuICAgICAgICAgICAgLnJlcGxhY2UoL3t7TU9ERX19LywgZGlyLm1vZGUgfHwgJ2Zhc3Rlc3QnKVxuICAgICAgICAgICAgLnJlcGxhY2UoL3t7VkVDSElMRX19LywgY29uZmlnLmRyaXZlVHlwZSk7XG5cbiAgICAgICAgdmFyIHJvdXRlUmVxdWVzdFBhcmFtcyA9IHtcbiAgICAgICAgICAgIG1vZGU6IG1vZGUsXG4gICAgICAgICAgICByZXByZXNlbnRhdGlvbjogZGlyLnJlcHJlc2VudGF0aW9uIHx8ICdkaXNwbGF5JyxcbiAgICAgICAgICAgIGxhbmd1YWdlOiBkaXIubGFuZ3VhZ2UgfHwgJ2VuLWdiJ1xuICAgICAgICB9O1xuXG4gICAgICAgIHdheXBvaW50cy5mb3JFYWNoKGZ1bmN0aW9uICh3YXlwb2ludCwgaSkge1xuICAgICAgICAgICAgcm91dGVSZXF1ZXN0UGFyYW1zW1wid2F5cG9pbnRcIiArIGldID0gW3dheXBvaW50LmxhdCwgd2F5cG9pbnQubG5nXS5qb2luKCcsJyk7XG4gICAgICAgIH0pO1xuXG4gICAgICAgIF9zZXRBdHRyaWJ1dGVzKHJvdXRlUmVxdWVzdFBhcmFtcywgZGlyLmF0dHJzKTtcblxuICAgICAgICB2YXIgZGVmZXJyZWQgPSAkcS5kZWZlcigpO1xuXG4gICAgICAgIHJvdXRlci5jYWxjdWxhdGVSb3V0ZShyb3V0ZVJlcXVlc3RQYXJhbXMsIGZ1bmN0aW9uIChyZXN1bHQpIHtcbiAgICAgICAgICAgIGRlZmVycmVkLnJlc29sdmUocmVzdWx0KTtcbiAgICAgICAgfSwgZnVuY3Rpb24gKGVycm9yKSB7XG4gICAgICAgICAgICBkZWZlcnJlZC5yZWplY3QoZXJyb3IpO1xuICAgICAgICB9KTtcblxuICAgICAgICByZXR1cm4gZGVmZXJyZWQucHJvbWlzZTtcbiAgICB9XG5cbiAgICBmdW5jdGlvbiBjbGVhblJvdXRlcyhtYXApIHtcbiAgICAgICAgdmFyIGdyb3VwID0gbWFwLnJvdXRlc0dyb3VwO1xuXG4gICAgICAgIGlmICghZ3JvdXApXG4gICAgICAgICAgICByZXR1cm47XG5cbiAgICAgICAgZ3JvdXAucmVtb3ZlQWxsKCk7XG4gICAgICAgIG1hcC5yZW1vdmVPYmplY3QoZ3JvdXApO1xuICAgICAgICBtYXAucm91dGVzR3JvdXAgPSBudWxsO1xuICAgIH1cblxuICAgIGZ1bmN0aW9uIGFkZFJvdXRlVG9NYXAobWFwLCByb3V0ZURhdGEsIGNsZWFuKSB7XG4gICAgICAgIGlmIChjbGVhbilcbiAgICAgICAgICAgIGNsZWFuUm91dGVzKG1hcCk7XG5cbiAgICAgICAgdmFyIHJvdXRlID0gcm91dGVEYXRhLnJvdXRlO1xuXG4gICAgICAgIGlmICghbWFwIHx8ICFyb3V0ZSB8fCAhcm91dGUuc2hhcGUpXG4gICAgICAgICAgICByZXR1cm47XG5cbiAgICAgICAgdmFyIHN0cmlwID0gbmV3IEguZ2VvLlN0cmlwKCksIHBvbHlsaW5lID0gbnVsbDtcblxuICAgICAgICByb3V0ZS5zaGFwZS5mb3JFYWNoKGZ1bmN0aW9uIChwb2ludCkge1xuICAgICAgICAgICAgdmFyIHBhcnRzID0gcG9pbnQuc3BsaXQoJywnKTtcbiAgICAgICAgICAgIHN0cmlwLnB1c2hMYXRMbmdBbHQocGFydHNbMF0sIHBhcnRzWzFdKTtcbiAgICAgICAgfSk7XG5cbiAgICAgICAgdmFyIHN0eWxlID0gcm91dGVEYXRhLnN0eWxlIHx8IHt9O1xuXG4gICAgICAgIHBvbHlsaW5lID0gbmV3IEgubWFwLlBvbHlsaW5lKHN0cmlwLCB7XG4gICAgICAgICAgICBzdHlsZToge1xuICAgICAgICAgICAgICAgIGxpbmVXaWR0aDogc3R5bGUubGluZVdpZHRoIHx8IDQsXG4gICAgICAgICAgICAgICAgc3Ryb2tlQ29sb3I6IHN0eWxlLmNvbG9yIHx8ICdyZ2JhKDAsIDEyOCwgMjU1LCAwLjcpJ1xuICAgICAgICAgICAgfVxuICAgICAgICB9KTtcblxuICAgICAgICB2YXIgZ3JvdXAgPSBtYXAucm91dGVzR3JvdXA7XG5cbiAgICAgICAgaWYgKCFncm91cCkge1xuICAgICAgICAgICAgZ3JvdXAgPSBtYXAucm91dGVzR3JvdXAgPSBuZXcgSC5tYXAuR3JvdXAoKTtcbiAgICAgICAgICAgIG1hcC5hZGRPYmplY3QoZ3JvdXApO1xuICAgICAgICB9XG5cbiAgICAgICAgZ3JvdXAuYWRkT2JqZWN0KHBvbHlsaW5lKTtcblxuICAgICAgICBpZihyb3V0ZURhdGEuem9vbVRvQm91bmRzKSB7XG4gICAgICAgICAgICBtYXAuc2V0Vmlld0JvdW5kcyhwb2x5bGluZS5nZXRCb3VuZHMoKSwgdHJ1ZSk7XG4gICAgICAgIH1cbiAgICB9XG5cbiAgICAvLyNyZWdpb24gUFJJVkFURVxuXG4gICAgZnVuY3Rpb24gX3NldEF0dHJpYnV0ZXMocGFyYW1zLCBhdHRycykge1xuICAgICAgICB2YXIgX2tleSA9ICdhdHRyaWJ1dGVzJztcbiAgICAgICAgZm9yICh2YXIga2V5IGluIGF0dHJzKSB7XG4gICAgICAgICAgICBpZiAoIWF0dHJzLmhhc093blByb3BlcnR5KGtleSkpXG4gICAgICAgICAgICAgICAgY29udGludWU7XG5cbiAgICAgICAgICAgIHBhcmFtc1trZXkgKyBfa2V5XSA9IGF0dHJzW2tleV07XG4gICAgICAgIH1cbiAgICB9XG5cbiAgICAvKipcbiAgICAgKiBDcmVhdGVzIGEgc2VyaWVzIG9mIEgubWFwLk1hcmtlciBwb2ludHMgZnJvbSB0aGUgcm91dGUgYW5kIGFkZHMgdGhlbSB0byB0aGUgbWFwLlxuICAgICAqIEBwYXJhbSB7T2JqZWN0fSByb3V0ZSAgQSByb3V0ZSBhcyByZWNlaXZlZCBmcm9tIHRoZSBILnNlcnZpY2UuUm91dGluZ1NlcnZpY2VcbiAgICAgKi9cbiAgICBmdW5jdGlvbiBhZGRNYW51ZXZlcnNUb01hcChtYXAsIHJvdXRlKSB7XG4gICAgICAgIHZhciBzdmdNYXJrdXAgPSAnPHN2ZyB3aWR0aD1cIjE4XCIgaGVpZ2h0PVwiMThcIiAnICtcbiAgICAgICAgICAgICd4bWxucz1cImh0dHA6Ly93d3cudzMub3JnLzIwMDAvc3ZnXCI+JyArXG4gICAgICAgICAgICAnPGNpcmNsZSBjeD1cIjhcIiBjeT1cIjhcIiByPVwiOFwiICcgK1xuICAgICAgICAgICAgJ2ZpbGw9XCIjMWI0NjhkXCIgc3Ryb2tlPVwid2hpdGVcIiBzdHJva2Utd2lkdGg9XCIxXCIgIC8+JyArXG4gICAgICAgICAgICAnPC9zdmc+JyxcbiAgICAgICAgICAgIGRvdEljb24gPSBuZXcgSC5tYXAuSWNvbihzdmdNYXJrdXAsIHsgYW5jaG9yOiB7IHg6IDgsIHk6IDggfSB9KSxcbiAgICAgICAgICAgIGdyb3VwID0gbmV3IEgubWFwLkdyb3VwKCksIGksIGo7XG5cbiAgICAgICAgLy8gQWRkIGEgbWFya2VyIGZvciBlYWNoIG1hbmV1dmVyXG4gICAgICAgIGZvciAoaSA9IDA7IGkgPCByb3V0ZS5sZWcubGVuZ3RoOyBpICs9IDEpIHtcbiAgICAgICAgICAgIGZvciAoaiA9IDA7IGogPCByb3V0ZS5sZWdbaV0ubWFuZXV2ZXIubGVuZ3RoOyBqICs9IDEpIHtcbiAgICAgICAgICAgICAgICAvLyBHZXQgdGhlIG5leHQgbWFuZXV2ZXIuXG4gICAgICAgICAgICAgICAgbWFuZXV2ZXIgPSByb3V0ZS5sZWdbaV0ubWFuZXV2ZXJbal07XG4gICAgICAgICAgICAgICAgLy8gQWRkIGEgbWFya2VyIHRvIHRoZSBtYW5ldXZlcnMgZ3JvdXBcbiAgICAgICAgICAgICAgICB2YXIgbWFya2VyID0gbmV3IEgubWFwLk1hcmtlcih7XG4gICAgICAgICAgICAgICAgICAgIGxhdDogbWFuZXV2ZXIucG9zaXRpb24ubGF0aXR1ZGUsXG4gICAgICAgICAgICAgICAgICAgIGxuZzogbWFuZXV2ZXIucG9zaXRpb24ubG9uZ2l0dWRlXG4gICAgICAgICAgICAgICAgfSxcbiAgICAgICAgICAgICAgICAgICAgeyBpY29uOiBkb3RJY29uIH1cbiAgICAgICAgICAgICAgICApO1xuXG4gICAgICAgICAgICAgICAgbWFya2VyLmluc3RydWN0aW9uID0gbWFuZXV2ZXIuaW5zdHJ1Y3Rpb247XG4gICAgICAgICAgICAgICAgZ3JvdXAuYWRkT2JqZWN0KG1hcmtlcik7XG4gICAgICAgICAgICB9XG4gICAgICAgIH1cblxuICAgICAgICBncm91cC5hZGRFdmVudExpc3RlbmVyKCd0YXAnLCBmdW5jdGlvbiAoZXZ0KSB7XG4gICAgICAgICAgICBtYXAuc2V0Q2VudGVyKGV2dC50YXJnZXQuZ2V0UG9zaXRpb24oKSk7XG4gICAgICAgICAgICBvcGVuQnViYmxlKGV2dC50YXJnZXQuZ2V0UG9zaXRpb24oKSwgZXZ0LnRhcmdldC5pbnN0cnVjdGlvbik7XG4gICAgICAgIH0sIGZhbHNlKTtcblxuICAgICAgICAvLyBBZGQgdGhlIG1hbmV1dmVycyBncm91cCB0byB0aGUgbWFwXG4gICAgICAgIG1hcC5hZGRPYmplY3QoZ3JvdXApO1xuICAgIH1cblxuXG4gICAgLyoqXG4gICAgICogQ3JlYXRlcyBhIHNlcmllcyBvZiBILm1hcC5NYXJrZXIgcG9pbnRzIGZyb20gdGhlIHJvdXRlIGFuZCBhZGRzIHRoZW0gdG8gdGhlIG1hcC5cbiAgICAgKiBAcGFyYW0ge09iamVjdH0gcm91dGUgIEEgcm91dGUgYXMgcmVjZWl2ZWQgZnJvbSB0aGUgSC5zZXJ2aWNlLlJvdXRpbmdTZXJ2aWNlXG4gICAgICovXG4gICAgZnVuY3Rpb24gYWRkV2F5cG9pbnRzVG9QYW5lbCh3YXlwb2ludHMpIHtcbiAgICAgICAgdmFyIG5vZGVIMyA9IGRvY3VtZW50LmNyZWF0ZUVsZW1lbnQoJ2gzJyksXG4gICAgICAgICAgICB3YXlwb2ludExhYmVscyA9IFtdLFxuICAgICAgICAgICAgaTtcblxuICAgICAgICBmb3IgKGkgPSAwOyBpIDwgd2F5cG9pbnRzLmxlbmd0aDsgaSArPSAxKSB7XG4gICAgICAgICAgICB3YXlwb2ludExhYmVscy5wdXNoKHdheXBvaW50c1tpXS5sYWJlbClcbiAgICAgICAgfVxuXG4gICAgICAgIG5vZGVIMy50ZXh0Q29udGVudCA9IHdheXBvaW50TGFiZWxzLmpvaW4oJyAtICcpO1xuXG4gICAgICAgIHJvdXRlSW5zdHJ1Y3Rpb25zQ29udGFpbmVyLmlubmVySFRNTCA9ICcnO1xuICAgICAgICByb3V0ZUluc3RydWN0aW9uc0NvbnRhaW5lci5hcHBlbmRDaGlsZChub2RlSDMpO1xuICAgIH1cblxuICAgIC8qKlxuICAgICAqIENyZWF0ZXMgYSBzZXJpZXMgb2YgSC5tYXAuTWFya2VyIHBvaW50cyBmcm9tIHRoZSByb3V0ZSBhbmQgYWRkcyB0aGVtIHRvIHRoZSBtYXAuXG4gICAgICogQHBhcmFtIHtPYmplY3R9IHJvdXRlICBBIHJvdXRlIGFzIHJlY2VpdmVkIGZyb20gdGhlIEguc2VydmljZS5Sb3V0aW5nU2VydmljZVxuICAgICAqL1xuICAgIGZ1bmN0aW9uIGFkZFN1bW1hcnlUb1BhbmVsKHN1bW1hcnkpIHtcbiAgICAgICAgdmFyIHN1bW1hcnlEaXYgPSBkb2N1bWVudC5jcmVhdGVFbGVtZW50KCdkaXYnKSxcbiAgICAgICAgICAgIGNvbnRlbnQgPSAnJztcblxuICAgICAgICBjb250ZW50ICs9ICc8Yj5Ub3RhbCBkaXN0YW5jZTwvYj46ICcgKyBzdW1tYXJ5LmRpc3RhbmNlICsgJ20uIDxici8+JztcbiAgICAgICAgY29udGVudCArPSAnPGI+VHJhdmVsIFRpbWU8L2I+OiAnICsgc3VtbWFyeS50cmF2ZWxUaW1lLnRvTU1TUygpICsgJyAoaW4gY3VycmVudCB0cmFmZmljKSc7XG5cblxuICAgICAgICBzdW1tYXJ5RGl2LnN0eWxlLmZvbnRTaXplID0gJ3NtYWxsJztcbiAgICAgICAgc3VtbWFyeURpdi5zdHlsZS5tYXJnaW5MZWZ0ID0gJzUlJztcbiAgICAgICAgc3VtbWFyeURpdi5zdHlsZS5tYXJnaW5SaWdodCA9ICc1JSc7XG4gICAgICAgIHN1bW1hcnlEaXYuaW5uZXJIVE1MID0gY29udGVudDtcbiAgICAgICAgcm91dGVJbnN0cnVjdGlvbnNDb250YWluZXIuYXBwZW5kQ2hpbGQoc3VtbWFyeURpdik7XG4gICAgfVxuXG4gICAgLyoqXG4gICAgICogQ3JlYXRlcyBhIHNlcmllcyBvZiBILm1hcC5NYXJrZXIgcG9pbnRzIGZyb20gdGhlIHJvdXRlIGFuZCBhZGRzIHRoZW0gdG8gdGhlIG1hcC5cbiAgICAgKiBAcGFyYW0ge09iamVjdH0gcm91dGUgIEEgcm91dGUgYXMgcmVjZWl2ZWQgZnJvbSB0aGUgSC5zZXJ2aWNlLlJvdXRpbmdTZXJ2aWNlXG4gICAgICovXG4gICAgZnVuY3Rpb24gYWRkTWFudWV2ZXJzVG9QYW5lbChyb3V0ZSkge1xuICAgICAgICB2YXIgbm9kZU9MID0gZG9jdW1lbnQuY3JlYXRlRWxlbWVudCgnb2wnKSwgaSwgajtcblxuICAgICAgICBub2RlT0wuc3R5bGUuZm9udFNpemUgPSAnc21hbGwnO1xuICAgICAgICBub2RlT0wuc3R5bGUubWFyZ2luTGVmdCA9ICc1JSc7XG4gICAgICAgIG5vZGVPTC5zdHlsZS5tYXJnaW5SaWdodCA9ICc1JSc7XG4gICAgICAgIG5vZGVPTC5jbGFzc05hbWUgPSAnZGlyZWN0aW9ucyc7XG5cbiAgICAgICAgLy8gQWRkIGEgbWFya2VyIGZvciBlYWNoIG1hbmV1dmVyXG4gICAgICAgIGZvciAoaSA9IDA7IGkgPCByb3V0ZS5sZWcubGVuZ3RoOyBpICs9IDEpIHtcbiAgICAgICAgICAgIGZvciAoaiA9IDA7IGogPCByb3V0ZS5sZWdbaV0ubWFuZXV2ZXIubGVuZ3RoOyBqICs9IDEpIHtcbiAgICAgICAgICAgICAgICAvLyBHZXQgdGhlIG5leHQgbWFuZXV2ZXIuXG4gICAgICAgICAgICAgICAgbWFuZXV2ZXIgPSByb3V0ZS5sZWdbaV0ubWFuZXV2ZXJbal07XG5cbiAgICAgICAgICAgICAgICB2YXIgbGkgPSBkb2N1bWVudC5jcmVhdGVFbGVtZW50KCdsaScpLFxuICAgICAgICAgICAgICAgICAgICBzcGFuQXJyb3cgPSBkb2N1bWVudC5jcmVhdGVFbGVtZW50KCdzcGFuJyksXG4gICAgICAgICAgICAgICAgICAgIHNwYW5JbnN0cnVjdGlvbiA9IGRvY3VtZW50LmNyZWF0ZUVsZW1lbnQoJ3NwYW4nKTtcblxuICAgICAgICAgICAgICAgIHNwYW5BcnJvdy5jbGFzc05hbWUgPSAnYXJyb3cgJyArIG1hbmV1dmVyLmFjdGlvbjtcbiAgICAgICAgICAgICAgICBzcGFuSW5zdHJ1Y3Rpb24uaW5uZXJIVE1MID0gbWFuZXV2ZXIuaW5zdHJ1Y3Rpb247XG4gICAgICAgICAgICAgICAgbGkuYXBwZW5kQ2hpbGQoc3BhbkFycm93KTtcbiAgICAgICAgICAgICAgICBsaS5hcHBlbmRDaGlsZChzcGFuSW5zdHJ1Y3Rpb24pO1xuXG4gICAgICAgICAgICAgICAgbm9kZU9MLmFwcGVuZENoaWxkKGxpKTtcbiAgICAgICAgICAgIH1cbiAgICAgICAgfVxuXG4gICAgICAgIHJvdXRlSW5zdHJ1Y3Rpb25zQ29udGFpbmVyLmFwcGVuZENoaWxkKG5vZGVPTCk7XG4gICAgfVxuXG59O1xuIl19
