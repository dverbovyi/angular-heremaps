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
//# sourceMappingURL=data:application/json;charset=utf-8;base64,eyJ2ZXJzaW9uIjozLCJzb3VyY2VzIjpbIm5vZGVfbW9kdWxlcy9icm93c2VyLXBhY2svX3ByZWx1ZGUuanMiLCJzcmMvaGVyZW1hcHMuZGlyZWN0aXZlLmpzIiwic3JjL2luZGV4LmpzIiwic3JjL3Byb3ZpZGVycy9hcGkuc2VydmljZS5qcyIsInNyYy9wcm92aWRlcnMvY29uc3RzLmpzIiwic3JjL3Byb3ZpZGVycy9tYXAtbW9kdWxlcy9ldmVudHMvZXZlbnRzLmpzIiwic3JjL3Byb3ZpZGVycy9tYXAtbW9kdWxlcy9ldmVudHMvaW5mb2J1YmJsZS5qcyIsInNyYy9wcm92aWRlcnMvbWFwLW1vZHVsZXMvaW5kZXguanMiLCJzcmMvcHJvdmlkZXJzL21hcC1tb2R1bGVzL3VpL3VpLmpzIiwic3JjL3Byb3ZpZGVycy9tYXBjb25maWcucHJvdmlkZXIuanMiLCJzcmMvcHJvdmlkZXJzL21hcHV0aWxzLnNlcnZpY2UuanMiLCJzcmMvcHJvdmlkZXJzL21hcmtlcnMvZGVmYXVsdC5tYXJrZXIuanMiLCJzcmMvcHJvdmlkZXJzL21hcmtlcnMvZG9tLm1hcmtlci5qcyIsInNyYy9wcm92aWRlcnMvbWFya2Vycy9pbmRleC5qcyIsInNyYy9wcm92aWRlcnMvbWFya2Vycy9tYXJrZXIuanMiLCJzcmMvcHJvdmlkZXJzL21hcmtlcnMvbWFya2Vycy5zZXJ2aWNlLmpzIiwic3JjL3Byb3ZpZGVycy9tYXJrZXJzL3N2Zy5tYXJrZXIuanMiLCJzcmMvcHJvdmlkZXJzL3JvdXRlcy9pbmRleC5qcyIsInNyYy9wcm92aWRlcnMvcm91dGVzL3JvdXRlcy5zZXJ2aWNlLmpzIl0sIm5hbWVzIjpbXSwibWFwcGluZ3MiOiJBQUFBO0FDQUE7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTs7QUN2UEE7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBOztBQ2RBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTs7QUNyUEE7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBOztBQ2pFQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7O0FDbEdBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7O0FDM0ZBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7O0FDVkE7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTs7QUNwR0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBOztBQ2pCQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBOztBQzVIQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7O0FDdkJBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7O0FDOUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBOztBQ05BO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7O0FDbENBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTs7QUNyR0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTs7QUNsQ0E7QUFDQTs7QUNEQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBIiwiZmlsZSI6ImdlbmVyYXRlZC5qcyIsInNvdXJjZVJvb3QiOiIiLCJzb3VyY2VzQ29udGVudCI6WyIoZnVuY3Rpb24gZSh0LG4scil7ZnVuY3Rpb24gcyhvLHUpe2lmKCFuW29dKXtpZighdFtvXSl7dmFyIGE9dHlwZW9mIHJlcXVpcmU9PVwiZnVuY3Rpb25cIiYmcmVxdWlyZTtpZighdSYmYSlyZXR1cm4gYShvLCEwKTtpZihpKXJldHVybiBpKG8sITApO3ZhciBmPW5ldyBFcnJvcihcIkNhbm5vdCBmaW5kIG1vZHVsZSAnXCIrbytcIidcIik7dGhyb3cgZi5jb2RlPVwiTU9EVUxFX05PVF9GT1VORFwiLGZ9dmFyIGw9bltvXT17ZXhwb3J0czp7fX07dFtvXVswXS5jYWxsKGwuZXhwb3J0cyxmdW5jdGlvbihlKXt2YXIgbj10W29dWzFdW2VdO3JldHVybiBzKG4/bjplKX0sbCxsLmV4cG9ydHMsZSx0LG4scil9cmV0dXJuIG5bb10uZXhwb3J0c312YXIgaT10eXBlb2YgcmVxdWlyZT09XCJmdW5jdGlvblwiJiZyZXF1aXJlO2Zvcih2YXIgbz0wO288ci5sZW5ndGg7bysrKXMocltvXSk7cmV0dXJuIHN9KSIsIm1vZHVsZS5leHBvcnRzID0gSGVyZU1hcHNEaXJlY3RpdmU7XG5cbkhlcmVNYXBzRGlyZWN0aXZlLiRpbmplY3QgPSBbXG4gICAgJyR0aW1lb3V0JyxcbiAgICAnJHdpbmRvdycsXG4gICAgJyRyb290U2NvcGUnLFxuICAgICckZmlsdGVyJyxcbiAgICAnSGVyZU1hcHNDb25maWcnLFxuICAgICdIZXJlTWFwc0FQSVNlcnZpY2UnLFxuICAgICdIZXJlTWFwc1V0aWxzU2VydmljZScsXG4gICAgJ0hlcmVNYXBzTWFya2VyU2VydmljZScsXG4gICAgJ0hlcmVNYXBzUm91dGVzU2VydmljZScsXG4gICAgJ0hlcmVNYXBzQ09OU1RTJyxcbiAgICAnSGVyZU1hcHNFdmVudHNGYWN0b3J5JyxcbiAgICAnSGVyZU1hcHNVaUZhY3RvcnknXG5dO1xuZnVuY3Rpb24gSGVyZU1hcHNEaXJlY3RpdmUoXG4gICAgJHRpbWVvdXQsXG4gICAgJHdpbmRvdyxcbiAgICAkcm9vdFNjb3BlLFxuICAgICRmaWx0ZXIsXG4gICAgSGVyZU1hcHNDb25maWcsXG4gICAgSGVyZU1hcHNBUElTZXJ2aWNlLFxuICAgIEhlcmVNYXBzVXRpbHNTZXJ2aWNlLFxuICAgIEhlcmVNYXBzTWFya2VyU2VydmljZSxcbiAgICBIZXJlTWFwc1JvdXRlc1NlcnZpY2UsXG4gICAgSGVyZU1hcHNDT05TVFMsXG4gICAgSGVyZU1hcHNFdmVudHNGYWN0b3J5LFxuICAgIEhlcmVNYXBzVWlGYWN0b3J5KSB7XG4gICAgICAgIFxuICAgIEhlcmVNYXBzRGlyZWN0aXZlQ3RybC4kaW5qZWN0ID0gWyckc2NvcGUnLCAnJGVsZW1lbnQnLCAnJGF0dHJzJ107XG4gICAgICAgIFxuICAgIHJldHVybiB7XG4gICAgICAgIHJlc3RyaWN0OiAnRUEnLFxuICAgICAgICB0ZW1wbGF0ZTogXCI8ZGl2IG5nLXN0eWxlPVxcXCJ7J3dpZHRoJzogbWFwV2lkdGgsICdoZWlnaHQnOiBtYXBIZWlnaHR9XFxcIj48L2Rpdj5cIixcbiAgICAgICAgcmVwbGFjZTogdHJ1ZSxcbiAgICAgICAgc2NvcGU6IHtcbiAgICAgICAgICAgIG9wdHM6ICcmb3B0aW9ucycsXG4gICAgICAgICAgICBwbGFjZXM6ICcmJyxcbiAgICAgICAgICAgIG9uTWFwUmVhZHk6IFwiJm1hcFJlYWR5XCIsXG4gICAgICAgICAgICBldmVudHM6ICcmJ1xuICAgICAgICB9LFxuICAgICAgICBjb250cm9sbGVyOiBIZXJlTWFwc0RpcmVjdGl2ZUN0cmxcbiAgICB9XG4gICAgXG4gICAgZnVuY3Rpb24gSGVyZU1hcHNEaXJlY3RpdmVDdHJsKCRzY29wZSwgJGVsZW1lbnQsICRhdHRycykge1xuICAgICAgICB2YXIgQ09OVFJPTF9OQU1FUyA9IEhlcmVNYXBzQ09OU1RTLkNPTlRST0xTLk5BTUVTLFxuICAgICAgICAgICAgcGxhY2VzID0gJHNjb3BlLnBsYWNlcygpLFxuICAgICAgICAgICAgb3B0cyA9ICRzY29wZS5vcHRzKCksXG4gICAgICAgICAgICBsaXN0ZW5lcnMgPSAkc2NvcGUuZXZlbnRzKCk7XG5cbiAgICAgICAgdmFyIG9wdGlvbnMgPSBhbmd1bGFyLmV4dGVuZCh7fSwgSGVyZU1hcHNDT05TVFMuREVGQVVMVF9NQVBfT1BUSU9OUywgb3B0cyksXG4gICAgICAgICAgICBwb3NpdGlvbiA9IEhlcmVNYXBzVXRpbHNTZXJ2aWNlLmlzVmFsaWRDb29yZHMob3B0aW9ucy5jb29yZHMpID8gXG4gICAgICAgICAgICAgICAgICAgICAgICBvcHRpb25zLmNvb3JkcyA6IEhlcmVNYXBzQ09OU1RTLkRFRkFVTFRfTUFQX09QVElPTlMuY29vcmRzO1xuXG4gICAgICAgIHZhciBoZXJlbWFwcyA9IHsgaWQ6IEhlcmVNYXBzVXRpbHNTZXJ2aWNlLmdlbmVyYXRlSWQoKSB9LFxuICAgICAgICAgICAgbWFwUmVhZHkgPSAkc2NvcGUub25NYXBSZWFkeSgpLFxuICAgICAgICAgICAgX29uUmVzaXplTWFwID0gbnVsbDtcblxuICAgICAgICAkdGltZW91dChmdW5jdGlvbiAoKSB7XG4gICAgICAgICAgICByZXR1cm4gX3NldE1hcFNpemUoKTtcbiAgICAgICAgfSkudGhlbihmdW5jdGlvbiAoKSB7XG4gICAgICAgICAgICBIZXJlTWFwc0FQSVNlcnZpY2UubG9hZEFwaSgpLnRoZW4oX2FwaVJlYWR5KTtcbiAgICAgICAgfSk7XG5cbiAgICAgICAgb3B0aW9ucy5yZXNpemUgJiYgYWRkT25SZXNpemVMaXN0ZW5lcigpO1xuXG4gICAgICAgICRzY29wZS4kb24oJyRkZXN0cm95JywgZnVuY3Rpb24gKCkge1xuICAgICAgICAgICAgJHdpbmRvdy5yZW1vdmVFdmVudExpc3RlbmVyKCdyZXNpemUnLCBfb25SZXNpemVNYXApO1xuICAgICAgICB9KTtcblxuICAgICAgICBmdW5jdGlvbiBhZGRPblJlc2l6ZUxpc3RlbmVyKCkge1xuICAgICAgICAgICAgX29uUmVzaXplTWFwID0gSGVyZU1hcHNVdGlsc1NlcnZpY2UudGhyb3R0bGUoX3Jlc2l6ZUhhbmRsZXIsIEhlcmVNYXBzQ09OU1RTLlVQREFURV9NQVBfUkVTSVpFX1RJTUVPVVQpO1xuICAgICAgICAgICAgJHdpbmRvdy5hZGRFdmVudExpc3RlbmVyKCdyZXNpemUnLCBfb25SZXNpemVNYXApO1xuICAgICAgICB9XG5cbiAgICAgICAgZnVuY3Rpb24gX2FwaVJlYWR5KCkge1xuICAgICAgICAgICAgX3NldHVwTWFwUGxhdGZvcm0oKTtcbiAgICAgICAgICAgIF9zZXR1cE1hcCgpO1xuICAgICAgICB9XG5cbiAgICAgICAgZnVuY3Rpb24gX3NldHVwTWFwUGxhdGZvcm0oKSB7XG4gICAgICAgICAgICBpZiAoIUhlcmVNYXBzQ29uZmlnLmFwcF9pZCB8fCAhSGVyZU1hcHNDb25maWcuYXBwX2NvZGUpXG4gICAgICAgICAgICAgICAgdGhyb3cgbmV3IEVycm9yKCdhcHBfaWQgb3IgYXBwX2NvZGUgd2VyZSBtaXNzZWQuIFBsZWFzZSBzcGVjaWZ5IHRoZWlyIGluIEhlcmVNYXBzQ29uZmlnJyk7XG4gICAgICAgICAgICBcbiAgICAgICAgICAgIGhlcmVtYXBzLnBsYXRmb3JtID0gbmV3IEguc2VydmljZS5QbGF0Zm9ybShIZXJlTWFwc0NvbmZpZyk7XG4gICAgICAgICAgICBoZXJlbWFwcy5sYXllcnMgPSBoZXJlbWFwcy5wbGF0Zm9ybS5jcmVhdGVEZWZhdWx0TGF5ZXJzKCk7XG4gICAgICAgIH1cblxuICAgICAgICBmdW5jdGlvbiBfZ2V0TG9jYXRpb24oZW5hYmxlSGlnaEFjY3VyYWN5LCBtYXhpbXVtQWdlKSB7XG4gICAgICAgICAgICB2YXIgX2VuYWJsZUhpZ2hBY2N1cmFjeSA9ICEhZW5hYmxlSGlnaEFjY3VyYWN5LFxuICAgICAgICAgICAgICAgIF9tYXhpbXVtQWdlID0gbWF4aW11bUFnZSB8fCAwO1xuXG4gICAgICAgICAgICByZXR1cm4gSGVyZU1hcHNBUElTZXJ2aWNlLmdldFBvc2l0aW9uKHtcbiAgICAgICAgICAgICAgICBlbmFibGVIaWdoQWNjdXJhY3k6IF9lbmFibGVIaWdoQWNjdXJhY3ksXG4gICAgICAgICAgICAgICAgbWF4aW11bUFnZTogX21heGltdW1BZ2VcbiAgICAgICAgICAgIH0pO1xuICAgICAgICB9XG5cbiAgICAgICAgZnVuY3Rpb24gX2xvY2F0aW9uRmFpbHVyZSgpIHtcbiAgICAgICAgICAgIGNvbnNvbGUuZXJyb3IoJ0NhbiBub3QgZ2V0IGEgZ2VvIHBvc2l0aW9uJyk7XG4gICAgICAgIH1cblxuICAgICAgICBmdW5jdGlvbiBfc2V0dXBNYXAoKSB7XG4gICAgICAgICAgICBfaW5pdE1hcChmdW5jdGlvbiAoKSB7XG4gICAgICAgICAgICAgICAgSGVyZU1hcHNBUElTZXJ2aWNlLmxvYWRNb2R1bGVzKCRhdHRycy4kYXR0ciwge1xuICAgICAgICAgICAgICAgICAgICBcImNvbnRyb2xzXCI6IF91aU1vZHVsZVJlYWR5LFxuICAgICAgICAgICAgICAgICAgICBcImV2ZW50c1wiOiBfZXZlbnRzTW9kdWxlUmVhZHlcbiAgICAgICAgICAgICAgICB9KTtcbiAgICAgICAgICAgIH0pO1xuICAgICAgICB9XG5cbiAgICAgICAgZnVuY3Rpb24gX2luaXRNYXAoY2IpIHtcbiAgICAgICAgICAgIHZhciBtYXAgPSBoZXJlbWFwcy5tYXAgPSBuZXcgSC5NYXAoJGVsZW1lbnRbMF0sIGhlcmVtYXBzLmxheWVycy5ub3JtYWwubWFwLCB7XG4gICAgICAgICAgICAgICAgem9vbTogSGVyZU1hcHNVdGlsc1NlcnZpY2UuaXNWYWxpZENvb3Jkcyhwb3NpdGlvbikgPyBvcHRpb25zLnpvb20gOiBvcHRpb25zLm1heFpvb20sXG4gICAgICAgICAgICAgICAgY2VudGVyOiBuZXcgSC5nZW8uUG9pbnQocG9zaXRpb24ubGF0aXR1ZGUsIHBvc2l0aW9uLmxvbmdpdHVkZSlcbiAgICAgICAgICAgIH0pO1xuXG4gICAgICAgICAgICBIZXJlTWFwc01hcmtlclNlcnZpY2UuYWRkTWFya2Vyc1RvTWFwKG1hcCwgcGxhY2VzLCB0cnVlKTtcblxuICAgICAgICAgICAgbWFwUmVhZHkgJiYgbWFwUmVhZHkoTWFwUHJveHkoKSk7XG5cbiAgICAgICAgICAgIGNiICYmIGNiKCk7XG4gICAgICAgICAgICAgICAgXG4gICAgICAgIH1cblxuICAgICAgICBmdW5jdGlvbiBfdWlNb2R1bGVSZWFkeSgpIHtcbiAgICAgICAgICAgIEhlcmVNYXBzVWlGYWN0b3J5LnN0YXJ0KHtcbiAgICAgICAgICAgICAgICBwbGF0Zm9ybTogaGVyZW1hcHMsXG4gICAgICAgICAgICAgICAgYWxpZ25tZW50OiAkYXR0cnMuY29udHJvbHNcbiAgICAgICAgICAgIH0pO1xuICAgICAgICB9XG5cbiAgICAgICAgZnVuY3Rpb24gX2V2ZW50c01vZHVsZVJlYWR5KCkge1xuICAgICAgICAgICAgSGVyZU1hcHNFdmVudHNGYWN0b3J5LnN0YXJ0KHtcbiAgICAgICAgICAgICAgICBwbGF0Zm9ybTogaGVyZW1hcHMsXG4gICAgICAgICAgICAgICAgbGlzdGVuZXJzOiBsaXN0ZW5lcnMsXG4gICAgICAgICAgICAgICAgb3B0aW9uczogb3B0aW9ucyxcbiAgICAgICAgICAgICAgICBpbmplY3RvcjogX21vZHVsZUluamVjdG9yXG4gICAgICAgICAgICB9KTtcbiAgICAgICAgfVxuXG4gICAgICAgIGZ1bmN0aW9uIF9tb2R1bGVJbmplY3RvcigpIHtcbiAgICAgICAgICAgIHJldHVybiBmdW5jdGlvbiAoaWQpIHtcbiAgICAgICAgICAgICAgICByZXR1cm4gaGVyZW1hcHNbaWRdO1xuICAgICAgICAgICAgfVxuICAgICAgICB9XG5cbiAgICAgICAgZnVuY3Rpb24gX3Jlc2l6ZUhhbmRsZXIoaGVpZ2h0LCB3aWR0aCkge1xuICAgICAgICAgICAgX3NldE1hcFNpemUuYXBwbHkobnVsbCwgYXJndW1lbnRzKTtcblxuICAgICAgICAgICAgaGVyZW1hcHMubWFwLmdldFZpZXdQb3J0KCkucmVzaXplKCk7XG4gICAgICAgIH1cblxuICAgICAgICBmdW5jdGlvbiBfc2V0TWFwU2l6ZShoZWlnaHQsIHdpZHRoKSB7XG4gICAgICAgICAgICB2YXIgaGVpZ2h0ID0gaGVpZ2h0IHx8ICRlbGVtZW50WzBdLnBhcmVudE5vZGUub2Zmc2V0SGVpZ2h0IHx8IG9wdGlvbnMuaGVpZ2h0LFxuICAgICAgICAgICAgICAgIHdpZHRoID0gd2lkdGggfHwgJGVsZW1lbnRbMF0ucGFyZW50Tm9kZS5vZmZzZXRXaWR0aCB8fCBvcHRpb25zLndpZHRoO1xuXG4gICAgICAgICAgICAkc2NvcGUubWFwSGVpZ2h0ID0gaGVpZ2h0ICsgJ3B4JztcbiAgICAgICAgICAgICRzY29wZS5tYXBXaWR0aCA9IHdpZHRoICsgJ3B4JztcbiAgICAgICAgICAgIFxuICAgICAgICAgICAgSGVyZU1hcHNVdGlsc1NlcnZpY2UucnVuU2NvcGVEaWdlc3RJZk5lZWQoJHNjb3BlKTtcbiAgICAgICAgfVxuXG4gICAgICAgIGZ1bmN0aW9uIE1hcFByb3h5KCkge1xuICAgICAgICAgICAgcmV0dXJuIHtcbiAgICAgICAgICAgICAgICByZWZyZXNoOiBmdW5jdGlvbigpe1xuICAgICAgICAgICAgICAgICAgICB2YXIgY3VycmVudEJvdW5kcyA9IHRoaXMuZ2V0Vmlld0JvdW5kcygpO1xuICAgICAgICAgICAgICAgICAgICBcbiAgICAgICAgICAgICAgICAgICAgdGhpcy5zZXRNYXBTaXplcygpO1xuICAgICAgICAgICAgICAgICAgICB0aGlzLnNldFZpZXdCb3VuZHMoY3VycmVudEJvdW5kcyk7XG4gICAgICAgICAgICAgICAgfSxcbiAgICAgICAgICAgICAgICBzZXRNYXBTaXplczogZnVuY3Rpb24oaGVpZ2h0LCB3aWR0aCl7XG4gICAgICAgICAgICAgICAgICAgIF9yZXNpemVIYW5kbGVyLmFwcGx5KG51bGwsIGFyZ3VtZW50cyk7XG4gICAgICAgICAgICAgICAgfSxcbiAgICAgICAgICAgICAgICBnZXRQbGF0Zm9ybTogZnVuY3Rpb24gKCkge1xuICAgICAgICAgICAgICAgICAgICByZXR1cm4gaGVyZW1hcHM7XG4gICAgICAgICAgICAgICAgfSxcbiAgICAgICAgICAgICAgICBjYWxjdWxhdGVSb3V0ZTogZnVuY3Rpb24gKGRyaXZlVHlwZSwgZGlyZWN0aW9uKSB7XG4gICAgICAgICAgICAgICAgICAgIHJldHVybiBIZXJlTWFwc1JvdXRlc1NlcnZpY2UuY2FsY3VsYXRlUm91dGUoaGVyZW1hcHMsIHtcbiAgICAgICAgICAgICAgICAgICAgICAgIGRyaXZlVHlwZTogZHJpdmVUeXBlLFxuICAgICAgICAgICAgICAgICAgICAgICAgZGlyZWN0aW9uOiBkaXJlY3Rpb25cbiAgICAgICAgICAgICAgICAgICAgfSk7XG4gICAgICAgICAgICAgICAgfSxcbiAgICAgICAgICAgICAgICBhZGRSb3V0ZVRvTWFwOiBmdW5jdGlvbiAocm91dGVEYXRhLCBjbGVhbikge1xuICAgICAgICAgICAgICAgICAgICBIZXJlTWFwc1JvdXRlc1NlcnZpY2UuYWRkUm91dGVUb01hcChoZXJlbWFwcy5tYXAsIHJvdXRlRGF0YSwgY2xlYW4pO1xuICAgICAgICAgICAgICAgIH0sXG4gICAgICAgICAgICAgICAgc2V0Wm9vbTogZnVuY3Rpb24gKHpvb20sIHN0ZXApIHtcbiAgICAgICAgICAgICAgICAgICAgSGVyZU1hcHNVdGlsc1NlcnZpY2Uuem9vbShoZXJlbWFwcy5tYXAsIHpvb20gfHwgMTAsIHN0ZXApO1xuICAgICAgICAgICAgICAgIH0sXG4gICAgICAgICAgICAgICAgZ2V0Wm9vbTogZnVuY3Rpb24oKXtcbiAgICAgICAgICAgICAgICAgICAgcmV0dXJuIGhlcmVtYXBzLm1hcC5nZXRab29tKCk7ICBcbiAgICAgICAgICAgICAgICB9LFxuICAgICAgICAgICAgICAgIGdldENlbnRlcjogZnVuY3Rpb24oKXtcbiAgICAgICAgICAgICAgICAgICAgcmV0dXJuIGhlcmVtYXBzLm1hcC5nZXRDZW50ZXIoKTsgIFxuICAgICAgICAgICAgICAgIH0sXG4gICAgICAgICAgICAgICAgZ2V0Vmlld0JvdW5kczogZnVuY3Rpb24oKXtcbiAgICAgICAgICAgICAgICAgICAgcmV0dXJuIGhlcmVtYXBzLm1hcC5nZXRWaWV3Qm91bmRzKCk7ICAgXG4gICAgICAgICAgICAgICAgfSxcbiAgICAgICAgICAgICAgICBzZXRWaWV3Qm91bmRzOiBmdW5jdGlvbihib3VuZGluZ1JlY3QsIG9wdF9hbmltYXRlKXtcbiAgICAgICAgICAgICAgICAgICAgaGVyZW1hcHMubWFwLnNldFZpZXdCb3VuZHMoYm91bmRpbmdSZWN0LCBvcHRfYW5pbWF0ZSk7XG4gICAgICAgICAgICAgICAgfSxcbiAgICAgICAgICAgICAgICBzZXRDZW50ZXI6IGZ1bmN0aW9uIChjb29yZHMpIHtcbiAgICAgICAgICAgICAgICAgICAgaWYgKCFjb29yZHMpIHtcbiAgICAgICAgICAgICAgICAgICAgICAgIHJldHVybiBjb25zb2xlLmVycm9yKCdjb29yZHMgYXJlIG5vdCBzcGVjaWZpZWQhJyk7XG4gICAgICAgICAgICAgICAgICAgIH1cblxuICAgICAgICAgICAgICAgICAgICBoZXJlbWFwcy5tYXAuc2V0Q2VudGVyKGNvb3Jkcyk7XG4gICAgICAgICAgICAgICAgfSxcbiAgICAgICAgICAgICAgICBjbGVhblJvdXRlczogZnVuY3Rpb24gKCkge1xuICAgICAgICAgICAgICAgICAgICBIZXJlTWFwc1JvdXRlc1NlcnZpY2UuY2xlYW5Sb3V0ZXMoaGVyZW1hcHMubWFwKTtcbiAgICAgICAgICAgICAgICB9LFxuXG4gICAgICAgICAgICAgICAgLyoqXG4gICAgICAgICAgICAgICAgICogQHBhcmFtIHtCb29sZWFufSBlbmFibGVIaWdoQWNjdXJhY3lcbiAgICAgICAgICAgICAgICAgKiBAcGFyYW0ge051bWJlcn0gbWF4aW11bUFnZSAtIHRoZSBtYXhpbXVtIGFnZSBpbiBtaWxsaXNlY29uZHMgb2YgYSBwb3NzaWJsZSBjYWNoZWQgcG9zaXRpb24gdGhhdCBpcyBhY2NlcHRhYmxlIHRvIHJldHVybi4gSWYgc2V0IHRvIDAsIGl0IG1lYW5zIHRoYXQgdGhlIGRldmljZSBjYW5ub3QgdXNlIGEgY2FjaGVkIHBvc2l0aW9uIGFuZCBtdXN0IGF0dGVtcHQgdG8gcmV0cmlldmUgdGhlIHJlYWwgY3VycmVudCBwb3NpdGlvblxuICAgICAgICAgICAgICAgICAqIEByZXR1cm4ge1Byb21pc2V9XG4gICAgICAgICAgICAgICAgICovXG4gICAgICAgICAgICAgICAgZ2V0VXNlckxvY2F0aW9uOiBmdW5jdGlvbiAoZW5hYmxlSGlnaEFjY3VyYWN5LCBtYXhpbXVtQWdlKSB7XG4gICAgICAgICAgICAgICAgICAgIHJldHVybiBfZ2V0TG9jYXRpb24uYXBwbHkobnVsbCwgYXJndW1lbnRzKS50aGVuKGZ1bmN0aW9uIChwb3NpdGlvbikge1xuICAgICAgICAgICAgICAgICAgICAgICAgdmFyIGNvb3JkcyA9IHBvc2l0aW9uLmNvb3JkcztcblxuICAgICAgICAgICAgICAgICAgICAgICAgSGVyZU1hcHNNYXJrZXJTZXJ2aWNlLmFkZFVzZXJNYXJrZXIoaGVyZW1hcHMubWFwLCB7XG4gICAgICAgICAgICAgICAgICAgICAgICAgICAgcG9zOiB7XG4gICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgIGxhdDogY29vcmRzLmxhdGl0dWRlLFxuICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICBsbmc6IGNvb3Jkcy5sb25naXR1ZGVcbiAgICAgICAgICAgICAgICAgICAgICAgICAgICB9XG4gICAgICAgICAgICAgICAgICAgICAgICB9KTtcblxuICAgICAgICAgICAgICAgICAgICAgICAgcmV0dXJuIGNvb3JkcztcbiAgICAgICAgICAgICAgICAgICAgfSlcbiAgICAgICAgICAgICAgICB9LFxuICAgICAgICAgICAgICAgIGdlb2NvZGVQb3NpdGlvbjogZnVuY3Rpb24gKGNvb3Jkcywgb3B0aW9ucykge1xuICAgICAgICAgICAgICAgICAgICByZXR1cm4gSGVyZU1hcHNBUElTZXJ2aWNlLmdlb2NvZGVQb3NpdGlvbihoZXJlbWFwcy5wbGF0Zm9ybSwge1xuICAgICAgICAgICAgICAgICAgICAgICAgY29vcmRzOiBjb29yZHMsXG4gICAgICAgICAgICAgICAgICAgICAgICByYWRpdXM6IG9wdGlvbnMgJiYgb3B0aW9ucy5yYWRpdXMsXG4gICAgICAgICAgICAgICAgICAgICAgICBsYW5nOiBvcHRpb25zICYmIG9wdGlvbnMubGFuZ1xuICAgICAgICAgICAgICAgICAgICB9KTtcbiAgICAgICAgICAgICAgICB9LFxuICAgICAgICAgICAgICAgIHVwZGF0ZU1hcmtlcnM6IGZ1bmN0aW9uIChwbGFjZXMsIHJlZnJlc2hWaWV3Ym91bmRzKSB7XG4gICAgICAgICAgICAgICAgICAgIEhlcmVNYXBzTWFya2VyU2VydmljZS51cGRhdGVNYXJrZXJzKGhlcmVtYXBzLm1hcCwgcGxhY2VzLCByZWZyZXNoVmlld2JvdW5kcyk7XG4gICAgICAgICAgICAgICAgfVxuICAgICAgICAgICAgfVxuICAgICAgICB9XG5cbiAgICB9XG59O1xuIiwicmVxdWlyZSgnLi9wcm92aWRlcnMvbWFya2VycycpO1xucmVxdWlyZSgnLi9wcm92aWRlcnMvbWFwLW1vZHVsZXMnKTtcbnJlcXVpcmUoJy4vcHJvdmlkZXJzL3JvdXRlcycpO1xuXG5tb2R1bGUuZXhwb3J0cyA9IGFuZ3VsYXIubW9kdWxlKCdoZXJlbWFwcycsIFtcbiAgICAnaGVyZW1hcHMtbWFya2Vycy1tb2R1bGUnLFxuICAgICdoZXJlbWFwcy1yb3V0ZXMtbW9kdWxlJyxcbiAgICAnaGVyZW1hcHMtbWFwLW1vZHVsZXMnXG5dKVxuICAgIC5wcm92aWRlcignSGVyZU1hcHNDb25maWcnLCByZXF1aXJlKCcuL3Byb3ZpZGVycy9tYXBjb25maWcucHJvdmlkZXInKSlcbiAgICAuc2VydmljZSgnSGVyZU1hcHNVdGlsc1NlcnZpY2UnLCByZXF1aXJlKCcuL3Byb3ZpZGVycy9tYXB1dGlscy5zZXJ2aWNlJykpXG4gICAgLnNlcnZpY2UoJ0hlcmVNYXBzQVBJU2VydmljZScsIHJlcXVpcmUoJy4vcHJvdmlkZXJzL2FwaS5zZXJ2aWNlJykpXG4gICAgLmNvbnN0YW50KCdIZXJlTWFwc0NPTlNUUycsIHJlcXVpcmUoJy4vcHJvdmlkZXJzL2NvbnN0cycpKVxuICAgIC5kaXJlY3RpdmUoJ2hlcmVtYXBzJywgcmVxdWlyZSgnLi9oZXJlbWFwcy5kaXJlY3RpdmUnKSk7XG4iLCJtb2R1bGUuZXhwb3J0cyA9IEhlcmVNYXBzQVBJU2VydmljZTtcblxuSGVyZU1hcHNBUElTZXJ2aWNlLiRpbmplY3QgPSBbXG4gICAgJyRxJyxcbiAgICAnJGh0dHAnLFxuICAgICdIZXJlTWFwc0NvbmZpZycsXG4gICAgJ0hlcmVNYXBzVXRpbHNTZXJ2aWNlJyxcbiAgICAnSGVyZU1hcHNDT05TVFMnXG5dO1xuZnVuY3Rpb24gSGVyZU1hcHNBUElTZXJ2aWNlKCRxLCAkaHR0cCwgSGVyZU1hcHNDb25maWcsIEhlcmVNYXBzVXRpbHNTZXJ2aWNlLCBIZXJlTWFwc0NPTlNUUykge1xuICAgIHZhciB2ZXJzaW9uID0gSGVyZU1hcHNDb25maWcuYXBpVmVyc2lvbixcbiAgICAgICAgcHJvdG9jb2wgPSBIZXJlTWFwc0NvbmZpZy51c2VIVFRQUyA/ICdodHRwcycgOiAnaHR0cCc7XG5cbiAgICB2YXIgQVBJX1ZFUlNJT04gPSB7XG4gICAgICAgIFY6IHBhcnNlSW50KHZlcnNpb24pLFxuICAgICAgICBTVUI6IHZlcnNpb25cbiAgICB9O1xuXG4gICAgdmFyIENPTkZJRyA9IHtcbiAgICAgICAgQkFTRTogXCI6Ly9qcy5hcGkuaGVyZS5jb20vdlwiLFxuICAgICAgICBDT1JFOiBcIm1hcHNqcy1jb3JlLmpzXCIsXG4gICAgICAgIFNFUlZJQ0U6IFwibWFwc2pzLXNlcnZpY2UuanNcIixcbiAgICAgICAgVUk6IHtcbiAgICAgICAgICAgIHNyYzogXCJtYXBzanMtdWkuanNcIixcbiAgICAgICAgICAgIGhyZWY6IFwibWFwc2pzLXVpLmNzc1wiXG4gICAgICAgIH0sXG4gICAgICAgIEVWRU5UUzogXCJtYXBzanMtbWFwZXZlbnRzLmpzXCJcbiAgICB9O1xuXG4gICAgdmFyIEFQSV9ERUZFUlNRdWV1ZSA9IHt9O1xuXG4gICAgQVBJX0RFRkVSU1F1ZXVlW0NPTkZJRy5DT1JFXSA9IFtdO1xuICAgIEFQSV9ERUZFUlNRdWV1ZVtDT05GSUcuU0VSVklDRV0gPSBbXTtcbiAgICBBUElfREVGRVJTUXVldWVbQ09ORklHLlVJLnNyY10gPSBbXTtcbiAgICBBUElfREVGRVJTUXVldWVbQ09ORklHLlBBTk9dID0gW107XG4gICAgQVBJX0RFRkVSU1F1ZXVlW0NPTkZJRy5FVkVOVFNdID0gW107XG5cbiAgICB2YXIgaGVhZCA9IGRvY3VtZW50LmdldEVsZW1lbnRzQnlUYWdOYW1lKCdoZWFkJylbMF07XG5cbiAgICByZXR1cm4ge1xuICAgICAgICBsb2FkQXBpOiBsb2FkQXBpLFxuICAgICAgICBsb2FkTW9kdWxlczogbG9hZE1vZHVsZXMsXG4gICAgICAgIGdldFBvc2l0aW9uOiBnZXRQb3NpdGlvbixcbiAgICAgICAgZ2VvY29kZVBvc2l0aW9uOiBnZW9jb2RlUG9zaXRpb25cbiAgICB9O1xuXG4gICAgLy8jcmVnaW9uIFBVQkxJQ1xuICAgIGZ1bmN0aW9uIGxvYWRBcGkoKSB7XG4gICAgICAgIHJldHVybiBfZ2V0TG9hZGVyKENPTkZJRy5DT1JFKVxuICAgICAgICAgICAgLnRoZW4oZnVuY3Rpb24gKCkge1xuICAgICAgICAgICAgICAgIHJldHVybiBfZ2V0TG9hZGVyKENPTkZJRy5TRVJWSUNFKTtcbiAgICAgICAgICAgIH0pO1xuICAgIH1cblxuICAgIGZ1bmN0aW9uIGxvYWRNb2R1bGVzKGF0dHJzLCBoYW5kbGVycykge1xuICAgICAgICBmb3IgKHZhciBrZXkgaW4gaGFuZGxlcnMpIHtcbiAgICAgICAgICAgIGlmICghaGFuZGxlcnMuaGFzT3duUHJvcGVydHkoa2V5KSB8fCAhYXR0cnNba2V5XSlcbiAgICAgICAgICAgICAgICBjb250aW51ZTtcblxuICAgICAgICAgICAgdmFyIGxvYWRlciA9IF9nZXRMb2FkZXJCeUF0dHIoa2V5KTtcblxuICAgICAgICAgICAgbG9hZGVyKClcbiAgICAgICAgICAgICAgICAudGhlbihoYW5kbGVyc1trZXldKTtcbiAgICAgICAgfVxuICAgIH1cblxuICAgIGZ1bmN0aW9uIGdldFBvc2l0aW9uKG9wdGlvbnMpIHtcbiAgICAgICAgdmFyIGRlZmVycmVkID0gJHEuZGVmZXIoKTtcblxuICAgICAgICBpZiAob3B0aW9ucyAmJiBfaXNWYWxpZENvb3JkcyhvcHRpb25zLmNvb3JkcykpIHtcbiAgICAgICAgICAgIGRlZmVycmVkLnJlc29sdmUoeyBjb29yZHM6IG9wdGlvbnMuY29vcmRzIH0pO1xuICAgICAgICB9IGVsc2Uge1xuICAgICAgICAgICAgbmF2aWdhdG9yLmdlb2xvY2F0aW9uLmdldEN1cnJlbnRQb3NpdGlvbihmdW5jdGlvbiAocmVzcG9uc2UpIHtcbiAgICAgICAgICAgICAgICBkZWZlcnJlZC5yZXNvbHZlKHJlc3BvbnNlKTtcbiAgICAgICAgICAgIH0sIGZ1bmN0aW9uIChlcnJvcikge1xuICAgICAgICAgICAgICAgIGRlZmVycmVkLnJlamVjdChlcnJvcik7XG4gICAgICAgICAgICB9LCBvcHRpb25zKTtcbiAgICAgICAgfVxuXG4gICAgICAgIHJldHVybiBkZWZlcnJlZC5wcm9taXNlO1xuICAgIH1cblxuICAgIGZ1bmN0aW9uIGdlb2NvZGVQb3NpdGlvbihwbGF0Zm9ybSwgcGFyYW1zKSB7XG4gICAgICAgIGlmICghcGFyYW1zLmNvb3JkcylcbiAgICAgICAgICAgIHJldHVybiBjb25zb2xlLmVycm9yKCdNaXNzZWQgcmVxdWlyZWQgY29vcmRzJyk7XG5cbiAgICAgICAgdmFyIGdlb2NvZGVyID0gcGxhdGZvcm0uZ2V0R2VvY29kaW5nU2VydmljZSgpLFxuICAgICAgICAgICAgZGVmZXJyZWQgPSAkcS5kZWZlcigpLFxuICAgICAgICAgICAgX3BhcmFtcyA9IHtcbiAgICAgICAgICAgICAgICBwcm94OiBbcGFyYW1zLmNvb3Jkcy5sYXQsIHBhcmFtcy5jb29yZHMubG5nLCBwYXJhbXMucmFkaXVzIHx8IDI1MF0uam9pbignLCcpLFxuICAgICAgICAgICAgICAgIG1vZGU6ICdyZXRyaWV2ZUFkZHJlc3NlcycsXG4gICAgICAgICAgICAgICAgbWF4cmVzdWx0czogJzEnLFxuICAgICAgICAgICAgICAgIGdlbjogJzgnLFxuICAgICAgICAgICAgICAgIGxhbmd1YWdlOiBwYXJhbXMubGFuZyB8fCAnZW4tZ2InXG4gICAgICAgICAgICB9O1xuXG4gICAgICAgIGdlb2NvZGVyLnJldmVyc2VHZW9jb2RlKF9wYXJhbXMsIGZ1bmN0aW9uIChyZXNwb25zZSkge1xuICAgICAgICAgICAgZGVmZXJyZWQucmVzb2x2ZShyZXNwb25zZSlcbiAgICAgICAgfSwgZnVuY3Rpb24gKGVycm9yKSB7XG4gICAgICAgICAgICBkZWZlcnJlZC5yZWplY3QoZXJyb3IpXG4gICAgICAgIH0pO1xuICAgICAgICBcbiAgICAgICAgcmV0dXJuIGRlZmVycmVkLnByb21pc2U7XG4gICAgfVxuXG4gICAgLy8jZW5kcmVnaW9uIFBVQkxJQ1xuXG4gICAgZnVuY3Rpb24gX2dldExvYWRlckJ5QXR0cihhdHRyKSB7XG4gICAgICAgIHZhciBsb2FkZXI7XG5cbiAgICAgICAgc3dpdGNoIChhdHRyKSB7XG4gICAgICAgICAgICBjYXNlIEhlcmVNYXBzQ09OU1RTLk1PRFVMRVMuVUk6XG4gICAgICAgICAgICAgICAgbG9hZGVyID0gX2xvYWRVSU1vZHVsZTtcbiAgICAgICAgICAgICAgICBicmVhaztcbiAgICAgICAgICAgIGNhc2UgSGVyZU1hcHNDT05TVFMuTU9EVUxFUy5FVkVOVFM6XG4gICAgICAgICAgICAgICAgbG9hZGVyID0gX2xvYWRFdmVudHNNb2R1bGU7XG4gICAgICAgICAgICAgICAgYnJlYWs7XG4gICAgICAgICAgICBkZWZhdWx0OlxuICAgICAgICAgICAgICAgIHRocm93IG5ldyBFcnJvcignVW5rbm93biBtb2R1bGUnLCBhdHRyKTtcbiAgICAgICAgfVxuXG4gICAgICAgIHJldHVybiBsb2FkZXI7XG4gICAgfVxuXG4gICAgZnVuY3Rpb24gX2xvYWRVSU1vZHVsZSgpIHtcbiAgICAgICAgaWYgKCFfaXNMb2FkZWQoQ09ORklHLlVJLnNyYykpIHtcbiAgICAgICAgICAgIHZhciBsaW5rID0gSGVyZU1hcHNVdGlsc1NlcnZpY2UuY3JlYXRlTGlua1RhZyh7XG4gICAgICAgICAgICAgICAgcmVsOiAnc3R5bGVzaGVldCcsXG4gICAgICAgICAgICAgICAgdHlwZTogJ3RleHQvY3NzJyxcbiAgICAgICAgICAgICAgICBocmVmOiBfZ2V0VVJMKENPTkZJRy5VSS5ocmVmKVxuICAgICAgICAgICAgfSk7XG5cbiAgICAgICAgICAgIGxpbmsgJiYgaGVhZC5hcHBlbmRDaGlsZChsaW5rKTtcbiAgICAgICAgfVxuXG4gICAgICAgIHJldHVybiBfZ2V0TG9hZGVyKENPTkZJRy5VSS5zcmMpO1xuICAgIH1cblxuICAgIGZ1bmN0aW9uIF9sb2FkRXZlbnRzTW9kdWxlKCkge1xuICAgICAgICByZXR1cm4gX2dldExvYWRlcihDT05GSUcuRVZFTlRTKTtcbiAgICB9XG5cbiAgICAvKipcbiAgICAgKiBAcGFyYW0ge1N0cmluZ30gc291cmNlTmFtZVxuICAgICAqIHJldHVybiB7U3RyaW5nfSBlLmcgaHR0cDovL2pzLmFwaS5oZXJlLmNvbS92e1ZFUn0ve1NVQlZFUlNJT059L3tTT1VSQ0V9XG4gICAgICovXG4gICAgZnVuY3Rpb24gX2dldFVSTChzb3VyY2VOYW1lKSB7XG4gICAgICAgIHJldHVybiBbXG4gICAgICAgICAgICBwcm90b2NvbCxcbiAgICAgICAgICAgIENPTkZJRy5CQVNFLFxuICAgICAgICAgICAgQVBJX1ZFUlNJT04uVixcbiAgICAgICAgICAgIFwiL1wiLFxuICAgICAgICAgICAgQVBJX1ZFUlNJT04uU1VCLFxuICAgICAgICAgICAgXCIvXCIsXG4gICAgICAgICAgICBzb3VyY2VOYW1lXG4gICAgICAgIF0uam9pbihcIlwiKTtcbiAgICB9XG5cbiAgICBmdW5jdGlvbiBfZ2V0TG9hZGVyKHNvdXJjZU5hbWUpIHtcbiAgICAgICAgdmFyIGRlZmVyID0gJHEuZGVmZXIoKSwgc3JjLCBzY3JpcHQ7XG5cbiAgICAgICAgaWYgKF9pc0xvYWRlZChzb3VyY2VOYW1lKSkge1xuICAgICAgICAgICAgZGVmZXIucmVzb2x2ZSgpO1xuICAgICAgICB9IGVsc2Uge1xuICAgICAgICAgICAgc3JjID0gX2dldFVSTChzb3VyY2VOYW1lKSxcbiAgICAgICAgICAgICAgICBzY3JpcHQgPSBIZXJlTWFwc1V0aWxzU2VydmljZS5jcmVhdGVTY3JpcHRUYWcoeyBzcmM6IHNyYyB9KTtcblxuICAgICAgICAgICAgc2NyaXB0ICYmIGhlYWQuYXBwZW5kQ2hpbGQoc2NyaXB0KTtcblxuICAgICAgICAgICAgQVBJX0RFRkVSU1F1ZXVlW3NvdXJjZU5hbWVdLnB1c2goZGVmZXIpO1xuXG4gICAgICAgICAgICBzY3JpcHQub25sb2FkID0gX29uTG9hZC5iaW5kKG51bGwsIHNvdXJjZU5hbWUpO1xuICAgICAgICAgICAgc2NyaXB0Lm9uZXJyb3IgPSBfb25FcnJvci5iaW5kKG51bGwsIHNvdXJjZU5hbWUpO1xuICAgICAgICB9XG5cbiAgICAgICAgcmV0dXJuIGRlZmVyLnByb21pc2U7XG4gICAgfVxuXG4gICAgZnVuY3Rpb24gX2lzTG9hZGVkKHNvdXJjZU5hbWUpIHtcbiAgICAgICAgdmFyIGNoZWNrZXIgPSBudWxsO1xuXG4gICAgICAgIHN3aXRjaCAoc291cmNlTmFtZSkge1xuICAgICAgICAgICAgY2FzZSBDT05GSUcuQ09SRTpcbiAgICAgICAgICAgICAgICBjaGVja2VyID0gX2lzQ29yZUxvYWRlZDtcbiAgICAgICAgICAgICAgICBicmVhaztcbiAgICAgICAgICAgIGNhc2UgQ09ORklHLlNFUlZJQ0U6XG4gICAgICAgICAgICAgICAgY2hlY2tlciA9IF9pc1NlcnZpY2VMb2FkZWQ7XG4gICAgICAgICAgICAgICAgYnJlYWs7XG4gICAgICAgICAgICBjYXNlIENPTkZJRy5VSS5zcmM6XG4gICAgICAgICAgICAgICAgY2hlY2tlciA9IF9pc1VJTG9hZGVkO1xuICAgICAgICAgICAgICAgIGJyZWFrO1xuICAgICAgICAgICAgY2FzZSBDT05GSUcuRVZFTlRTOlxuICAgICAgICAgICAgICAgIGNoZWNrZXIgPSBfaXNFdmVudHNMb2FkZWQ7XG4gICAgICAgICAgICAgICAgYnJlYWs7XG4gICAgICAgICAgICBkZWZhdWx0OlxuICAgICAgICAgICAgICAgIGNoZWNrZXIgPSBmdW5jdGlvbiAoKSB7IHJldHVybiBmYWxzZSB9O1xuICAgICAgICB9XG5cbiAgICAgICAgcmV0dXJuIGNoZWNrZXIoKTtcbiAgICB9XG5cbiAgICBmdW5jdGlvbiBfaXNDb3JlTG9hZGVkKCkge1xuICAgICAgICByZXR1cm4gISF3aW5kb3cuSDtcbiAgICB9XG5cbiAgICBmdW5jdGlvbiBfaXNTZXJ2aWNlTG9hZGVkKCkge1xuICAgICAgICByZXR1cm4gISEod2luZG93LkggJiYgd2luZG93Lkguc2VydmljZSk7XG4gICAgfVxuXG4gICAgZnVuY3Rpb24gX2lzVUlMb2FkZWQoKSB7XG4gICAgICAgIHJldHVybiAhISh3aW5kb3cuSCAmJiB3aW5kb3cuSC51aSk7XG4gICAgfVxuXG4gICAgZnVuY3Rpb24gX2lzRXZlbnRzTG9hZGVkKCkge1xuICAgICAgICByZXR1cm4gISEod2luZG93LkggJiYgd2luZG93LkgubWFwZXZlbnRzKTtcbiAgICB9XG5cbiAgICBmdW5jdGlvbiBfb25Mb2FkKHNvdXJjZU5hbWUpIHtcbiAgICAgICAgdmFyIGRlZmVyUXVldWUgPSBBUElfREVGRVJTUXVldWVbc291cmNlTmFtZV07XG4gICAgICAgIGZvciAodmFyIGkgPSAwLCBsID0gZGVmZXJRdWV1ZS5sZW5ndGg7IGkgPCBsOyArK2kpIHtcbiAgICAgICAgICAgIHZhciBkZWZlciA9IGRlZmVyUXVldWVbaV07XG4gICAgICAgICAgICBkZWZlci5yZXNvbHZlKCk7XG4gICAgICAgIH1cblxuICAgICAgICBBUElfREVGRVJTUXVldWVbc291cmNlTmFtZV0gPSBbXTtcbiAgICB9XG5cbiAgICBmdW5jdGlvbiBfb25FcnJvcihzb3VyY2VOYW1lKSB7XG4gICAgICAgIHZhciBkZWZlclF1ZXVlID0gQVBJX0RFRkVSU1F1ZXVlW3NvdXJjZU5hbWVdO1xuICAgICAgICBmb3IgKHZhciBpID0gMCwgbCA9IGRlZmVyUXVldWUubGVuZ3RoOyBpIDwgbDsgKytpKSB7XG4gICAgICAgICAgICB2YXIgZGVmZXIgPSBkZWZlclF1ZXVlW2ldO1xuICAgICAgICAgICAgZGVmZXIucmVqZWN0KCk7XG4gICAgICAgIH1cblxuICAgICAgICBBUElfREVGRVJTUXVldWVbc291cmNlTmFtZV0gPSBbXTtcbiAgICB9XG5cbiAgICBmdW5jdGlvbiBfaXNWYWxpZENvb3Jkcyhjb29yZHMpIHtcbiAgICAgICAgdmFyIGxuZyA9IGNvb3JkcyAmJiBjb29yZHMubG9uZ2l0dWRlLFxuICAgICAgICAgICAgbGF0ID0gY29vcmRzICYmIGNvb3Jkcy5sYXRpdHVkZTtcblxuICAgICAgICByZXR1cm4gKHR5cGVvZiBsbmcgPT09ICdudW1iZXInIHx8IHR5cGVvZiBsbmcgPT09ICdzdHJpbmcnKSAmJlxuICAgICAgICAgICAgKHR5cGVvZiBsYXQgPT09ICdudW1iZXInIHx8IHR5cGVvZiBsYXQgPT09ICdzdHJpbmcnKTtcbiAgICB9XG59O1xuIiwibW9kdWxlLmV4cG9ydHMgPSB7XG4gICAgVVBEQVRFX01BUF9SRVNJWkVfVElNRU9VVDogNTAwLFxuICAgIEFOSU1BVElPTl9aT09NX1NURVA6IC4wNSxcbiAgICBNT0RVTEVTOiB7XG4gICAgICAgIFVJOiAnY29udHJvbHMnLFxuICAgICAgICBFVkVOVFM6ICdldmVudHMnLFxuICAgICAgICBQQU5POiAncGFubydcbiAgICB9LFxuICAgIERFRkFVTFRfTUFQX09QVElPTlM6IHtcbiAgICAgICAgaGVpZ2h0OiA0ODAsXG4gICAgICAgIHdpZHRoOiA2NDAsXG4gICAgICAgIHpvb206IDEyLFxuICAgICAgICBtYXhab29tOiAyLFxuICAgICAgICByZXNpemU6IGZhbHNlLFxuICAgICAgICBkcmFnZ2FibGU6IGZhbHNlLFxuICAgICAgICBjb29yZHM6IHtcbiAgICAgICAgICAgIGxvbmdpdHVkZTogMCxcbiAgICAgICAgICAgIGxhdGl0dWRlOiAwXG4gICAgICAgIH1cbiAgICB9LFxuICAgIE1BUktFUl9UWVBFUzoge1xuICAgICAgICBET006IFwiRE9NXCIsXG4gICAgICAgIFNWRzogXCJTVkdcIlxuICAgIH0sXG4gICAgQ09OVFJPTFM6IHtcbiAgICAgICAgTkFNRVM6IHtcbiAgICAgICAgICAgIFNDQUxFOiAnc2NhbGViYXInLFxuICAgICAgICAgICAgU0VUVElOR1M6ICdtYXBzZXR0aW5ncycsXG4gICAgICAgICAgICBaT09NOiAnem9vbScsXG4gICAgICAgICAgICBVU0VSOiAndXNlcnBvc2l0aW9uJ1xuICAgICAgICB9LFxuICAgICAgICBQT1NJVElPTlM6IFtcbiAgICAgICAgICAgICd0b3AtcmlnaHQnLFxuICAgICAgICAgICAgJ3RvcC1jZW50ZXInLFxuICAgICAgICAgICAgJ3RvcC1sZWZ0JyxcbiAgICAgICAgICAgICdsZWZ0LXRvcCcsXG4gICAgICAgICAgICAnbGVmdC1taWRkbGUnLFxuICAgICAgICAgICAgJ2xlZnQtYm90dG9tJyxcbiAgICAgICAgICAgICdyaWdodC10b3AnLFxuICAgICAgICAgICAgJ3JpZ2h0LW1pZGRsZScsXG4gICAgICAgICAgICAncmlnaHQtYm90dG9tJyxcbiAgICAgICAgICAgICdib3R0b20tcmlnaHQnLFxuICAgICAgICAgICAgJ2JvdHRvbS1jZW50ZXInLFxuICAgICAgICAgICAgJ2JvdHRvbS1sZWZ0J1xuICAgICAgICBdXG4gICAgfSxcbiAgICBJTkZPQlVCQkxFOiB7XG4gICAgICAgIFNUQVRFOiB7XG4gICAgICAgICAgICBPUEVOOiAnb3BlbicsXG4gICAgICAgICAgICBDTE9TRUQ6ICdjbG9zZWQnXG4gICAgICAgIH0sXG4gICAgICAgIERJU1BMQVlfRVZFTlQ6IHtcbiAgICAgICAgICAgIHBvaW50ZXJtb3ZlOiAnb25Ib3ZlcicsXG4gICAgICAgICAgICB0YXA6ICdvbkNsaWNrJ1xuICAgICAgICB9XG4gICAgfSxcbiAgICBVU0VSX0VWRU5UUzoge1xuICAgICAgICB0YXA6ICdjbGljaycsXG4gICAgICAgIHBvaW50ZXJtb3ZlOiAnbW91c2Vtb3ZlJyxcbiAgICAgICAgcG9pbnRlcmxlYXZlOiAnbW91c2VsZWF2ZScsXG4gICAgICAgIHBvaW50ZXJlbnRlcjogJ21vdXNlZW50ZXInLFxuICAgICAgICBkcmFnOiAnZHJhZycsXG4gICAgICAgIGRyYWdzdGFydDogJ2RyYWdzdGFydCcsXG4gICAgICAgIGRyYWdlbmQ6ICdkcmFnZW5kJ1xuICAgIH1cbn0iLCJtb2R1bGUuZXhwb3J0cyA9IEhlcmVNYXBzRXZlbnRzRmFjdG9yeTtcblxuSGVyZU1hcHNFdmVudHNGYWN0b3J5LiRpbmplY3QgPSBbXG4gICAgJ0hlcmVNYXBzVXRpbHNTZXJ2aWNlJyxcbiAgICAnSGVyZU1hcHNNYXJrZXJTZXJ2aWNlJyxcbiAgICAnSGVyZU1hcHNDT05TVFMnLFxuICAgICdIZXJlTWFwc0luZm9CdWJibGVGYWN0b3J5J1xuXTtcbmZ1bmN0aW9uIEhlcmVNYXBzRXZlbnRzRmFjdG9yeShIZXJlTWFwc1V0aWxzU2VydmljZSwgSGVyZU1hcHNNYXJrZXJTZXJ2aWNlLCBIZXJlTWFwc0NPTlNUUywgSGVyZU1hcHNJbmZvQnViYmxlRmFjdG9yeSkge1xuICAgIGZ1bmN0aW9uIEV2ZW50cyhwbGF0Zm9ybSwgSW5qZWN0b3IsIGxpc3RlbmVycykge1xuICAgICAgICB0aGlzLm1hcCA9IHBsYXRmb3JtLm1hcDtcbiAgICAgICAgdGhpcy5saXN0ZW5lcnMgPSBsaXN0ZW5lcnM7XG4gICAgICAgIHRoaXMuaW5qZWN0ID0gbmV3IEluamVjdG9yKCk7XG4gICAgICAgIHRoaXMuZXZlbnRzID0gcGxhdGZvcm0uZXZlbnRzID0gbmV3IEgubWFwZXZlbnRzLk1hcEV2ZW50cyh0aGlzLm1hcCk7XG4gICAgICAgIHRoaXMuYmVoYXZpb3IgPSBwbGF0Zm9ybS5iZWhhdmlvciA9IG5ldyBILm1hcGV2ZW50cy5CZWhhdmlvcih0aGlzLmV2ZW50cyk7XG4gICAgICAgIHRoaXMuYnViYmxlID0gSGVyZU1hcHNJbmZvQnViYmxlRmFjdG9yeS5jcmVhdGUoKTtcblxuICAgICAgICB0aGlzLnNldHVwRXZlbnRMaXN0ZW5lcnMoKTtcbiAgICB9XG5cbiAgICB2YXIgcHJvdG8gPSBFdmVudHMucHJvdG90eXBlO1xuXG4gICAgcHJvdG8uc2V0dXBFdmVudExpc3RlbmVycyA9IHNldHVwRXZlbnRMaXN0ZW5lcnM7XG4gICAgcHJvdG8uc2V0dXBPcHRpb25zID0gc2V0dXBPcHRpb25zO1xuICAgIHByb3RvLnRyaWdnZXJVc2VyTGlzdGVuZXIgPSB0cmlnZ2VyVXNlckxpc3RlbmVyO1xuICAgIHByb3RvLmluZm9CdWJibGVIYW5kbGVyID0gaW5mb0J1YmJsZUhhbmRsZXI7ICBcblxuICAgIHJldHVybiB7XG4gICAgICAgIHN0YXJ0OiBmdW5jdGlvbihhcmdzKSB7XG4gICAgICAgICAgICBpZiAoIShhcmdzLnBsYXRmb3JtLm1hcCBpbnN0YW5jZW9mIEguTWFwKSlcbiAgICAgICAgICAgICAgICByZXR1cm4gY29uc29sZS5lcnJvcignTWlzc2VkIHJlcXVpcmVkIG1hcCBpbnN0YW5jZScpO1xuXG4gICAgICAgICAgICB2YXIgZXZlbnRzID0gbmV3IEV2ZW50cyhhcmdzLnBsYXRmb3JtLCBhcmdzLmluamVjdG9yLCBhcmdzLmxpc3RlbmVycyk7XG5cbiAgICAgICAgICAgIGFyZ3Mub3B0aW9ucyAmJiBldmVudHMuc2V0dXBPcHRpb25zKGFyZ3Mub3B0aW9ucyk7XG4gICAgICAgIH1cbiAgICB9XG5cbiAgICBmdW5jdGlvbiBzZXR1cEV2ZW50TGlzdGVuZXJzKCkge1xuICAgICAgICB2YXIgc2VsZiA9IHRoaXM7XG5cbiAgICAgICAgSGVyZU1hcHNVdGlsc1NlcnZpY2UuYWRkRXZlbnRMaXN0ZW5lcih0aGlzLm1hcCwgJ3RhcCcsIHRoaXMuaW5mb0J1YmJsZUhhbmRsZXIuYmluZCh0aGlzKSk7XG5cbiAgICAgICAgSGVyZU1hcHNVdGlsc1NlcnZpY2UuYWRkRXZlbnRMaXN0ZW5lcih0aGlzLm1hcCwgJ3BvaW50ZXJtb3ZlJywgdGhpcy5pbmZvQnViYmxlSGFuZGxlci5iaW5kKHRoaXMpKTtcblxuICAgICAgICBIZXJlTWFwc1V0aWxzU2VydmljZS5hZGRFdmVudExpc3RlbmVyKHRoaXMubWFwLCAnZHJhZ3N0YXJ0JywgZnVuY3Rpb24oZSkge1xuICAgICAgICAgICAgaWYgKEhlcmVNYXBzTWFya2VyU2VydmljZS5pc01hcmtlckluc3RhbmNlKGUudGFyZ2V0KSkge1xuICAgICAgICAgICAgICAgIHNlbGYuYmVoYXZpb3IuZGlzYWJsZSgpO1xuICAgICAgICAgICAgfVxuXG4gICAgICAgICAgICBzZWxmLnRyaWdnZXJVc2VyTGlzdGVuZXIoSGVyZU1hcHNDT05TVFMuVVNFUl9FVkVOVFNbZS50eXBlXSwgZSk7XG4gICAgICAgIH0pO1xuXG4gICAgICAgIEhlcmVNYXBzVXRpbHNTZXJ2aWNlLmFkZEV2ZW50TGlzdGVuZXIodGhpcy5tYXAsICdkcmFnJywgZnVuY3Rpb24oZSkge1xuICAgICAgICAgICAgdmFyIHBvaW50ZXIgPSBlLmN1cnJlbnRQb2ludGVyLFxuICAgICAgICAgICAgICAgIHRhcmdldCA9IGUudGFyZ2V0O1xuXG4gICAgICAgICAgICBpZiAoSGVyZU1hcHNNYXJrZXJTZXJ2aWNlLmlzTWFya2VySW5zdGFuY2UodGFyZ2V0KSkge1xuICAgICAgICAgICAgICAgIHRhcmdldC5zZXRQb3NpdGlvbihzZWxmLm1hcC5zY3JlZW5Ub0dlbyhwb2ludGVyLnZpZXdwb3J0WCwgcG9pbnRlci52aWV3cG9ydFkpKTtcbiAgICAgICAgICAgIH1cblxuICAgICAgICAgICAgc2VsZi50cmlnZ2VyVXNlckxpc3RlbmVyKEhlcmVNYXBzQ09OU1RTLlVTRVJfRVZFTlRTW2UudHlwZV0sIGUpO1xuICAgICAgICB9KTtcblxuICAgICAgICBIZXJlTWFwc1V0aWxzU2VydmljZS5hZGRFdmVudExpc3RlbmVyKHRoaXMubWFwLCAnZHJhZ2VuZCcsIGZ1bmN0aW9uKGUpIHtcbiAgICAgICAgICAgIGlmIChIZXJlTWFwc01hcmtlclNlcnZpY2UuaXNNYXJrZXJJbnN0YW5jZShlLnRhcmdldCkpIHtcbiAgICAgICAgICAgICAgICBzZWxmLmJlaGF2aW9yLmVuYWJsZSgpO1xuICAgICAgICAgICAgfVxuXG4gICAgICAgICAgICBzZWxmLnRyaWdnZXJVc2VyTGlzdGVuZXIoSGVyZU1hcHNDT05TVFMuVVNFUl9FVkVOVFNbZS50eXBlXSwgZSk7XG4gICAgICAgIH0pO1xuICAgIH1cblxuICAgIGZ1bmN0aW9uIHNldHVwT3B0aW9ucyhvcHRpb25zKSB7XG4gICAgICAgIGlmICghb3B0aW9ucylcbiAgICAgICAgICAgIHJldHVybjtcblxuICAgICAgICB0aGlzLm1hcC5kcmFnZ2FibGUgPSAhIW9wdGlvbnMuZHJhZ2dhYmxlO1xuICAgIH1cblxuICAgIGZ1bmN0aW9uIHRyaWdnZXJVc2VyTGlzdGVuZXIoZXZlbnROYW1lLCBlKSB7XG4gICAgICAgIGlmICghdGhpcy5saXN0ZW5lcnMpXG4gICAgICAgICAgICByZXR1cm47XG5cbiAgICAgICAgdmFyIGNhbGxiYWNrID0gdGhpcy5saXN0ZW5lcnNbZXZlbnROYW1lXTtcblxuICAgICAgICBjYWxsYmFjayAmJiBjYWxsYmFjayhlKTtcbiAgICB9XG4gICAgXG4gICAgZnVuY3Rpb24gaW5mb0J1YmJsZUhhbmRsZXIoZSl7XG4gICAgICAgIHZhciB1aSA9IHRoaXMuaW5qZWN0KCd1aScpO1xuICAgICAgICBcbiAgICAgICAgaWYodWkpXG4gICAgICAgICAgICB0aGlzLmJ1YmJsZS50b2dnbGUoZSwgdWkpO1xuICAgICAgICAgICAgXG4gICAgICAgIHRoaXMudHJpZ2dlclVzZXJMaXN0ZW5lcihIZXJlTWFwc0NPTlNUUy5VU0VSX0VWRU5UU1tlLnR5cGVdLCBlKTsgICAgICBcbiAgICB9XG5cbn07IiwibW9kdWxlLmV4cG9ydHMgPSBIZXJlTWFwc0luZm9CdWJibGVGYWN0b3J5O1xuXG5IZXJlTWFwc0luZm9CdWJibGVGYWN0b3J5LiRpbmplY3QgPSBbXG4gICAgJ0hlcmVNYXBzTWFya2VyU2VydmljZScsXG4gICAgJ0hlcmVNYXBzVXRpbHNTZXJ2aWNlJyxcbiAgICAnSGVyZU1hcHNDT05TVFMnXG5dO1xuZnVuY3Rpb24gSGVyZU1hcHNJbmZvQnViYmxlRmFjdG9yeShIZXJlTWFwc01hcmtlclNlcnZpY2UsIEhlcmVNYXBzVXRpbHNTZXJ2aWNlLCBIZXJlTWFwc0NPTlNUUykge1xuICAgIGZ1bmN0aW9uIEluZm9CdWJibGUoKSB7fVxuXG4gICAgdmFyIHByb3RvID0gSW5mb0J1YmJsZS5wcm90b3R5cGU7XG4gICAgICAgIFxuICAgIHByb3RvLmNyZWF0ZSA9IGNyZWF0ZTtcbiAgICBwcm90by51cGRhdGUgPSB1cGRhdGU7XG4gICAgcHJvdG8udG9nZ2xlID0gdG9nZ2xlO1xuICAgIHByb3RvLnNob3cgPSBzaG93O1xuICAgIHByb3RvLmNsb3NlID0gY2xvc2U7XG5cbiAgICByZXR1cm4ge1xuICAgICAgICBjcmVhdGU6IGZ1bmN0aW9uKCl7XG4gICAgICAgICAgICByZXR1cm4gbmV3IEluZm9CdWJibGUoKTtcbiAgICAgICAgfVxuICAgIH1cblxuICAgIGZ1bmN0aW9uIHRvZ2dsZShlLCB1aSkge1xuICAgICAgICBpZiAoSGVyZU1hcHNNYXJrZXJTZXJ2aWNlLmlzTWFya2VySW5zdGFuY2UoZS50YXJnZXQpKVxuICAgICAgICAgICAgdGhpcy5zaG93KGUsIHVpKTtcbiAgICAgICAgZWxzZVxuICAgICAgICAgICAgdGhpcy5jbG9zZShlLCB1aSk7XG4gICAgfVxuXG4gICAgZnVuY3Rpb24gdXBkYXRlKGJ1YmJsZSwgZGF0YSkge1xuICAgICAgICBidWJibGUuZGlzcGxheSA9IGRhdGEuZGlzcGxheTtcblxuICAgICAgICBidWJibGUuc2V0UG9zaXRpb24oZGF0YS5wb3NpdGlvbik7XG4gICAgICAgIGJ1YmJsZS5zZXRDb250ZW50KGRhdGEubWFya3VwKTtcblxuICAgICAgICBidWJibGUuc2V0U3RhdGUoSGVyZU1hcHNDT05TVFMuSU5GT0JVQkJMRS5TVEFURS5PUEVOKTtcbiAgICB9XG5cbiAgICBmdW5jdGlvbiBjcmVhdGUoc291cmNlKSB7XG4gICAgICAgIHZhciBidWJibGUgPSBuZXcgSC51aS5JbmZvQnViYmxlKHNvdXJjZS5wb3NpdGlvbiwge1xuICAgICAgICAgICAgY29udGVudDogc291cmNlLm1hcmt1cFxuICAgICAgICB9KTtcblxuICAgICAgICBidWJibGUuZGlzcGxheSA9IHNvdXJjZS5kaXNwbGF5O1xuICAgICAgICBidWJibGUuYWRkQ2xhc3MoSGVyZU1hcHNDT05TVFMuSU5GT0JVQkJMRS5TVEFURS5PUEVOKVxuXG4gICAgICAgIEhlcmVNYXBzVXRpbHNTZXJ2aWNlLmFkZEV2ZW50TGlzdGVuZXIoYnViYmxlLCAnc3RhdGVjaGFuZ2UnLCBmdW5jdGlvbihlKSB7XG4gICAgICAgICAgICB2YXIgc3RhdGUgPSB0aGlzLmdldFN0YXRlKCksXG4gICAgICAgICAgICAgICAgZWwgPSB0aGlzLmdldEVsZW1lbnQoKTtcbiAgICAgICAgICAgIGlmIChzdGF0ZSA9PT0gSGVyZU1hcHNDT05TVFMuSU5GT0JVQkJMRS5TVEFURS5DTE9TRUQpIHtcbiAgICAgICAgICAgICAgICBlbC5jbGFzc0xpc3QucmVtb3ZlKEhlcmVNYXBzQ09OU1RTLklORk9CVUJCTEUuU1RBVEUuT1BFTik7XG4gICAgICAgICAgICB9IGVsc2VcbiAgICAgICAgICAgICAgICB0aGlzLmFkZENsYXNzKHN0YXRlKVxuICAgICAgICB9KTtcblxuICAgICAgICByZXR1cm4gYnViYmxlO1xuICAgIH1cblxuICAgIGZ1bmN0aW9uIHNob3coZSwgdWksIGRhdGEpIHtcbiAgICAgICAgdmFyIHRhcmdldCA9IGUudGFyZ2V0LFxuICAgICAgICAgICAgZGF0YSA9IHRhcmdldC5nZXREYXRhKCksXG4gICAgICAgICAgICBlbCA9IG51bGw7XG5cbiAgICAgICAgaWYgKCFkYXRhIHx8ICFkYXRhLmRpc3BsYXkgfHwgIWRhdGEubWFya3VwIHx8IGRhdGEuZGlzcGxheSAhPT0gSGVyZU1hcHNDT05TVFMuSU5GT0JVQkJMRS5ESVNQTEFZX0VWRU5UW2UudHlwZV0pXG4gICAgICAgICAgICByZXR1cm47XG5cbiAgICAgICAgdmFyIHNvdXJjZSA9IHtcbiAgICAgICAgICAgIHBvc2l0aW9uOiB0YXJnZXQuZ2V0UG9zaXRpb24oKSxcbiAgICAgICAgICAgIG1hcmt1cDogZGF0YS5tYXJrdXAsXG4gICAgICAgICAgICBkaXNwbGF5OiBkYXRhLmRpc3BsYXlcbiAgICAgICAgfTtcblxuICAgICAgICBpZiAoIXVpLmJ1YmJsZSkge1xuICAgICAgICAgICAgdWkuYnViYmxlID0gdGhpcy5jcmVhdGUoc291cmNlKTtcbiAgICAgICAgICAgIHVpLmFkZEJ1YmJsZSh1aS5idWJibGUpO1xuXG4gICAgICAgICAgICByZXR1cm47XG4gICAgICAgIH1cblxuICAgICAgICB0aGlzLnVwZGF0ZSh1aS5idWJibGUsIHNvdXJjZSk7XG4gICAgfVxuXG4gICAgZnVuY3Rpb24gY2xvc2UoZSwgdWkpIHtcbiAgICAgICAgaWYgKCF1aS5idWJibGUgfHwgdWkuYnViYmxlLmRpc3BsYXkgIT09IEhlcmVNYXBzQ09OU1RTLklORk9CVUJCTEUuRElTUExBWV9FVkVOVFtlLnR5cGVdKSB7XG4gICAgICAgICAgICByZXR1cm47XG4gICAgICAgIH1cblxuICAgICAgICB1aS5idWJibGUuc2V0U3RhdGUoSGVyZU1hcHNDT05TVFMuSU5GT0JVQkJMRS5TVEFURS5DTE9TRUQpO1xuICAgIH1cbn0iLCJhbmd1bGFyLm1vZHVsZSgnaGVyZW1hcHMtZXZlbnRzLW1vZHVsZScsIFtdKVxuICAgIC5mYWN0b3J5KCdIZXJlTWFwc0V2ZW50c0ZhY3RvcnknLCByZXF1aXJlKCcuL2V2ZW50cy9ldmVudHMuanMnKSlcbiAgICAuZmFjdG9yeSgnSGVyZU1hcHNJbmZvQnViYmxlRmFjdG9yeScsIHJlcXVpcmUoJy4vZXZlbnRzL2luZm9idWJibGUuanMnKSk7XG4gICAgXG5hbmd1bGFyLm1vZHVsZSgnaGVyZW1hcHMtdWktbW9kdWxlJywgW10pXG4gICAgLmZhY3RvcnkoJ0hlcmVNYXBzVWlGYWN0b3J5JywgcmVxdWlyZSgnLi91aS91aS5qcycpKVxuXG5tb2R1bGUuZXhwb3J0cyA9IGFuZ3VsYXIubW9kdWxlKCdoZXJlbWFwcy1tYXAtbW9kdWxlcycsIFtcblx0J2hlcmVtYXBzLWV2ZW50cy1tb2R1bGUnLFxuICAgICdoZXJlbWFwcy11aS1tb2R1bGUnXG5dKTsiLCJtb2R1bGUuZXhwb3J0cyA9IEhlcmVNYXBzVWlGYWN0b3J5O1xuXG5IZXJlTWFwc1VpRmFjdG9yeS4kaW5qZWN0ID0gW1xuICAgICdIZXJlTWFwc0FQSVNlcnZpY2UnLFxuICAgICdIZXJlTWFwc01hcmtlclNlcnZpY2UnLFxuICAgICdIZXJlTWFwc1V0aWxzU2VydmljZScsXG4gICAgJ0hlcmVNYXBzQ09OU1RTJ1xuXTtcbmZ1bmN0aW9uIEhlcmVNYXBzVWlGYWN0b3J5KEhlcmVNYXBzQVBJU2VydmljZSwgSGVyZU1hcHNNYXJrZXJTZXJ2aWNlLCBIZXJlTWFwc1V0aWxzU2VydmljZSwgSGVyZU1hcHNDT05TVFMpIHtcbiAgICBmdW5jdGlvbiBVSShwbGF0Zm9ybSwgYWxpZ25tZW50KSB7XG4gICAgICAgIHRoaXMubWFwID0gcGxhdGZvcm0ubWFwO1xuICAgICAgICB0aGlzLmxheWVycyA9IHBsYXRmb3JtLmxheWVycztcbiAgICAgICAgdGhpcy5hbGlnbm1lbnQgPSBhbGlnbm1lbnQ7XG4gICAgICAgIHRoaXMudWkgPSBwbGF0Zm9ybS51aSA9IEgudWkuVUkuY3JlYXRlRGVmYXVsdCh0aGlzLm1hcCwgdGhpcy5sYXllcnMpO1xuXG4gICAgICAgIHRoaXMuc2V0dXBDb250cm9scygpO1xuICAgIH1cblxuICAgIFVJLmlzVmFsaWRBbGlnbm1lbnQgPSBpc1ZhbGlkQWxpZ25tZW50O1xuXG4gICAgdmFyIHByb3RvID0gVUkucHJvdG90eXBlO1xuXG4gICAgcHJvdG8uc2V0dXBDb250cm9scyA9IHNldHVwQ29udHJvbHM7XG4gICAgcHJvdG8uY3JlYXRlVXNlckNvbnRyb2wgPSBjcmVhdGVVc2VyQ29udHJvbDtcbiAgICBwcm90by5zZXRDb250cm9sc0FsaWdubWVudCA9IHNldENvbnRyb2xzQWxpZ25tZW50O1xuXG4gICAgcmV0dXJuIHtcbiAgICAgICAgc3RhcnQ6IGZ1bmN0aW9uKGFyZ3MpIHtcbiAgICAgICAgICAgIGlmICghKGFyZ3MucGxhdGZvcm0ubWFwIGluc3RhbmNlb2YgSC5NYXApICYmICEoYXJncy5wbGF0Zm9ybS5sYXllcnMpKVxuICAgICAgICAgICAgICAgIHJldHVybiBjb25zb2xlLmVycm9yKCdNaXNzZWQgdWkgbW9kdWxlIGRlcGVuZGVuY2llcycpO1xuXG4gICAgICAgICAgICB2YXIgdWkgPSBuZXcgVUkoYXJncy5wbGF0Zm9ybSwgYXJncy5hbGlnbm1lbnQpO1xuICAgICAgICB9XG4gICAgfVxuXG4gICAgZnVuY3Rpb24gc2V0dXBDb250cm9scygpIHtcbiAgICAgICAgdmFyIE5BTUVTID0gSGVyZU1hcHNDT05TVFMuQ09OVFJPTFMuTkFNRVMsXG4gICAgICAgICAgICB1c2VyQ29udHJvbCA9IHRoaXMuY3JlYXRlVXNlckNvbnRyb2woKTtcblxuICAgICAgICB0aGlzLnVpLmdldENvbnRyb2woTkFNRVMuU0VUVElOR1MpLnNldEluY2lkZW50c0xheWVyKGZhbHNlKTtcbiAgICAgICAgdGhpcy51aS5hZGRDb250cm9sKE5BTUVTLlVTRVIsIHVzZXJDb250cm9sKTtcbiAgICAgICAgdGhpcy5zZXRDb250cm9sc0FsaWdubWVudChOQU1FUyk7XG4gICAgfVxuXG4gICAgZnVuY3Rpb24gY3JlYXRlVXNlckNvbnRyb2woKSB7XG4gICAgICAgIHZhciBzZWxmID0gdGhpcyxcbiAgICAgICAgICAgIHVzZXJDb250cm9sID0gbmV3IEgudWkuQ29udHJvbCgpLFxuICAgICAgICAgICAgbWFya3VwID0gJzxzdmcgY2xhc3M9XCJIX2ljb25cIiBmaWxsPVwiI2ZmZlwiIHhtbG5zPVwiaHR0cDovL3d3dy53My5vcmcvMjAwMC9zdmdcIiB3aWR0aD1cIjE2XCIgaGVpZ2h0PVwiMTZcIiB2aWV3Qm94PVwiMCAwIDE2IDE2XCI+PHBhdGggY2xhc3M9XCJtaWRkbGVfbG9jYXRpb25fc3Ryb2tlXCIgZD1cIk04IDEyYy0yLjIwNiAwLTQtMS43OTUtNC00IDAtMi4yMDYgMS43OTQtNCA0LTRzNCAxLjc5NCA0IDRjMCAyLjIwNS0xLjc5NCA0LTQgNE04IDEuMjVhNi43NSA2Ljc1IDAgMSAwIDAgMTMuNSA2Ljc1IDYuNzUgMCAwIDAgMC0xMy41XCI+PC9wYXRoPjxwYXRoIGNsYXNzPVwiaW5uZXJfbG9jYXRpb25fc3Ryb2tlXCIgZD1cIk04IDVhMyAzIDAgMSAxIC4wMDEgNkEzIDMgMCAwIDEgOCA1bTAtMUM1Ljc5NCA0IDQgNS43OTQgNCA4YzAgMi4yMDUgMS43OTQgNCA0IDRzNC0xLjc5NSA0LTRjMC0yLjIwNi0xLjc5NC00LTQtNFwiPjwvcGF0aD48cGF0aCBjbGFzcz1cIm91dGVyX2xvY2F0aW9uX3N0cm9rZVwiIGQ9XCJNOCAxLjI1YTYuNzUgNi43NSAwIDEgMSAwIDEzLjUgNi43NSA2Ljc1IDAgMCAxIDAtMTMuNU04IDBDMy41OSAwIDAgMy41OSAwIDhjMCA0LjQxMSAzLjU5IDggOCA4czgtMy41ODkgOC04YzAtNC40MS0zLjU5LTgtOC04XCI+PC9wYXRoPjwvc3ZnPic7XG5cbiAgICAgICAgdmFyIHVzZXJDb250cm9sQnV0dG9uID0gbmV3IEgudWkuYmFzZS5CdXR0b24oe1xuICAgICAgICAgICAgbGFiZWw6IG1hcmt1cCxcbiAgICAgICAgICAgIG9uU3RhdGVDaGFuZ2U6IGZ1bmN0aW9uKGV2dCkge1xuICAgICAgICAgICAgICAgIGlmICh1c2VyQ29udHJvbEJ1dHRvbi5nZXRTdGF0ZSgpID09PSBILnVpLmJhc2UuQnV0dG9uLlN0YXRlLkRPV04pXG4gICAgICAgICAgICAgICAgICAgIHJldHVybjtcblxuICAgICAgICAgICAgICAgIEhlcmVNYXBzQVBJU2VydmljZS5nZXRQb3NpdGlvbigpLnRoZW4oZnVuY3Rpb24ocmVzcG9uc2UpIHtcbiAgICAgICAgICAgICAgICAgICAgdmFyIHBvc2l0aW9uID0ge1xuICAgICAgICAgICAgICAgICAgICAgICAgbG5nOiByZXNwb25zZS5jb29yZHMubG9uZ2l0dWRlLFxuICAgICAgICAgICAgICAgICAgICAgICAgbGF0OiByZXNwb25zZS5jb29yZHMubGF0aXR1ZGVcbiAgICAgICAgICAgICAgICAgICAgfTtcbiAgICAgICAgICAgICAgICAgICAgXG4gICAgICAgICAgICAgICAgICAgIHNlbGYubWFwLnNldENlbnRlcihwb3NpdGlvbik7XG4gICAgICAgICAgICAgICAgICAgIFxuICAgICAgICAgICAgICAgICAgICBIZXJlTWFwc1V0aWxzU2VydmljZS56b29tKHNlbGYubWFwLCAxNywgLjA4KTtcblxuICAgICAgICAgICAgICAgICAgICBpZiAoc2VsZi51c2VyTWFya2VyKSB7XG4gICAgICAgICAgICAgICAgICAgICAgICBzZWxmLnVzZXJNYXJrZXIuc2V0UG9zaXRpb24ocG9zaXRpb24pO1xuICAgICAgICAgICAgICAgICAgICAgICAgcmV0dXJuO1xuICAgICAgICAgICAgICAgICAgICB9XG4gICAgICAgICAgICAgICAgICAgIFxuICAgICAgICAgICAgICAgICAgICBzZWxmLnVzZXJNYXJrZXIgPSBIZXJlTWFwc01hcmtlclNlcnZpY2UuYWRkVXNlck1hcmtlcihzZWxmLm1hcCwge1xuICAgICAgICAgICAgICAgICAgICAgICAgcG9zOiBwb3NpdGlvblxuICAgICAgICAgICAgICAgICAgICB9KTtcbiAgICAgICAgICAgICAgICB9KTtcbiAgICAgICAgICAgIH1cbiAgICAgICAgfSk7XG5cbiAgICAgICAgdXNlckNvbnRyb2wuYWRkQ2hpbGQodXNlckNvbnRyb2xCdXR0b24pO1xuXG4gICAgICAgIHJldHVybiB1c2VyQ29udHJvbDtcbiAgICB9XG5cbiAgICBmdW5jdGlvbiBzZXRDb250cm9sc0FsaWdubWVudChOQU1FUykge1xuICAgICAgICBpZiAoIVVJLmlzVmFsaWRBbGlnbm1lbnQodGhpcy5hbGlnbm1lbnQpKVxuICAgICAgICAgICAgcmV0dXJuO1xuXG4gICAgICAgIGZvciAodmFyIGlkIGluIE5BTUVTKSB7XG4gICAgICAgICAgICB2YXIgY29udHJvbCA9IHRoaXMudWkuZ2V0Q29udHJvbChOQU1FU1tpZF0pO1xuXG4gICAgICAgICAgICBpZiAoIU5BTUVTLmhhc093blByb3BlcnR5KGlkKSB8fCAhY29udHJvbClcbiAgICAgICAgICAgICAgICBjb250aW51ZTtcblxuICAgICAgICAgICAgY29udHJvbC5zZXRBbGlnbm1lbnQodGhpcy5hbGlnbm1lbnQpO1xuICAgICAgICB9XG4gICAgfVxuXG4gICAgZnVuY3Rpb24gaXNWYWxpZEFsaWdubWVudChhbGlnbm1lbnQpIHtcbiAgICAgICAgcmV0dXJuICEhKEhlcmVNYXBzQ09OU1RTLkNPTlRST0xTLlBPU0lUSU9OUy5pbmRleE9mKGFsaWdubWVudCkgKyAxKTtcbiAgICB9XG5cbn07IiwibW9kdWxlLmV4cG9ydHMgPSBmdW5jdGlvbigpIHtcbiAgICB2YXIgb3B0aW9ucyA9IHt9O1xuICAgIHZhciBERUZBVUxUX0FQSV9WRVJTSU9OID0gXCIzLjBcIjtcblxuICAgIHRoaXMuJGdldCA9IGZ1bmN0aW9uKCl7XG4gICAgICAgIHJldHVybiB7XG4gICAgICAgICAgICBhcHBfaWQ6IG9wdGlvbnMuYXBwX2lkLFxuICAgICAgICAgICAgYXBwX2NvZGU6IG9wdGlvbnMuYXBwX2NvZGUsXG4gICAgICAgICAgICBhcGlWZXJzaW9uOiBvcHRpb25zLmFwaVZlcnNpb24gfHwgREVGQVVMVF9BUElfVkVSU0lPTixcbiAgICAgICAgICAgIHVzZUhUVFBTOiBvcHRpb25zLnVzZUhUVFBTLFxuICAgICAgICAgICAgdXNlQ0lUOiAhIW9wdGlvbnMudXNlQ0lUXG4gICAgICAgIH1cbiAgICB9O1xuXG4gICAgdGhpcy5zZXRPcHRpb25zID0gZnVuY3Rpb24ob3B0cyl7XG4gICAgICAgIG9wdGlvbnMgPSBvcHRzO1xuICAgIH07XG59OyIsIlxubW9kdWxlLmV4cG9ydHMgPSBIZXJlTWFwc1V0aWxzU2VydmljZTtcblxuSGVyZU1hcHNVdGlsc1NlcnZpY2UuJGluamVjdCA9IFtcbiAgICAnJHJvb3RTY29wZScsIFxuICAgICckdGltZW91dCcsIFxuICAgICdIZXJlTWFwc0NPTlNUUydcbl07XG5mdW5jdGlvbiBIZXJlTWFwc1V0aWxzU2VydmljZSgkcm9vdFNjb3BlLCAkdGltZW91dCwgSGVyZU1hcHNDT05TVFMpIHtcbiAgICByZXR1cm4ge1xuICAgICAgICB0aHJvdHRsZTogdGhyb3R0bGUsXG4gICAgICAgIGNyZWF0ZVNjcmlwdFRhZzogY3JlYXRlU2NyaXB0VGFnLFxuICAgICAgICBjcmVhdGVMaW5rVGFnOiBjcmVhdGVMaW5rVGFnLFxuICAgICAgICBydW5TY29wZURpZ2VzdElmTmVlZDogcnVuU2NvcGVEaWdlc3RJZk5lZWQsXG4gICAgICAgIGlzVmFsaWRDb29yZHM6IGlzVmFsaWRDb29yZHMsXG4gICAgICAgIGFkZEV2ZW50TGlzdGVuZXI6IGFkZEV2ZW50TGlzdGVuZXIsXG4gICAgICAgIHpvb206IHpvb20sXG4gICAgICAgIGdlbmVyYXRlSWQ6IGdlbmVyYXRlSWRcbiAgICB9O1xuXG4gICAgLy8jcmVnaW9uIFBVQkxJQ1xuICAgIGZ1bmN0aW9uIHRocm90dGxlKGZuLCBwZXJpb2QpIHtcbiAgICAgICAgdmFyIHRpbWVvdXQgPSBudWxsO1xuXG4gICAgICAgIHJldHVybiBmdW5jdGlvbiAoKSB7XG4gICAgICAgICAgICBpZiAoJHRpbWVvdXQpXG4gICAgICAgICAgICAgICAgJHRpbWVvdXQuY2FuY2VsKHRpbWVvdXQpO1xuXG4gICAgICAgICAgICB0aW1lb3V0ID0gJHRpbWVvdXQoZm4sIHBlcmlvZCk7XG4gICAgICAgIH1cbiAgICB9XG5cbiAgICBmdW5jdGlvbiBhZGRFdmVudExpc3RlbmVyKG9iaiwgZXZlbnROYW1lLCBsaXN0ZW5lciwgdXNlQ2FwdHVyZSkge1xuICAgICAgICB2YXIgX3VzZUNhcHR1cmUgPSAhIXVzZUNhcHR1cmU7XG5cbiAgICAgICAgb2JqLmFkZEV2ZW50TGlzdGVuZXIoZXZlbnROYW1lLCBsaXN0ZW5lciwgX3VzZUNhcHR1cmUpO1xuICAgIH1cblxuICAgIGZ1bmN0aW9uIHJ1blNjb3BlRGlnZXN0SWZOZWVkKHNjb3BlLCBjYikge1xuICAgICAgICBpZiAoc2NvcGUuJHJvb3QgJiYgc2NvcGUuJHJvb3QuJCRwaGFzZSAhPT0gJyRhcHBseScgJiYgc2NvcGUuJHJvb3QuJCRwaGFzZSAhPT0gJyRkaWdlc3QnKSB7XG4gICAgICAgICAgICBzY29wZS4kZGlnZXN0KGNiIHx8IGFuZ3VsYXIubm9vcCk7XG4gICAgICAgICAgICByZXR1cm4gdHJ1ZTtcbiAgICAgICAgfVxuICAgICAgICByZXR1cm4gZmFsc2U7XG4gICAgfVxuXG4gICAgZnVuY3Rpb24gY3JlYXRlU2NyaXB0VGFnKGF0dHJzKSB7XG4gICAgICAgIHZhciBzY3JpcHQgPSBkb2N1bWVudC5nZXRFbGVtZW50QnlJZChhdHRycy5zcmMpO1xuXG4gICAgICAgIGlmIChzY3JpcHQpXG4gICAgICAgICAgICByZXR1cm4gZmFsc2U7XG5cbiAgICAgICAgc2NyaXB0ID0gZG9jdW1lbnQuY3JlYXRlRWxlbWVudCgnc2NyaXB0Jyk7XG4gICAgICAgIHNjcmlwdC50eXBlID0gJ3RleHQvamF2YXNjcmlwdCc7XG4gICAgICAgIHNjcmlwdC5pZCA9IGF0dHJzLnNyYztcbiAgICAgICAgX3NldEF0dHJzKHNjcmlwdCwgYXR0cnMpO1xuXG4gICAgICAgIHJldHVybiBzY3JpcHQ7XG4gICAgfVxuXG4gICAgZnVuY3Rpb24gY3JlYXRlTGlua1RhZyhhdHRycykge1xuICAgICAgICB2YXIgbGluayA9IGRvY3VtZW50LmdldEVsZW1lbnRCeUlkKGF0dHJzLmhyZWYpO1xuXG4gICAgICAgIGlmIChsaW5rKVxuICAgICAgICAgICAgcmV0dXJuIGZhbHNlO1xuXG4gICAgICAgIGxpbmsgPSBkb2N1bWVudC5jcmVhdGVFbGVtZW50KCdsaW5rJyk7XG4gICAgICAgIGxpbmsuaWQgPSBhdHRycy5ocmVmO1xuICAgICAgICBfc2V0QXR0cnMobGluaywgYXR0cnMpO1xuXG4gICAgICAgIHJldHVybiBsaW5rO1xuICAgIH1cblxuICAgIGZ1bmN0aW9uIGlzVmFsaWRDb29yZHMoY29vcmRzKSB7XG4gICAgICAgIHJldHVybiBjb29yZHMgJiZcbiAgICAgICAgICAgICh0eXBlb2YgY29vcmRzLmxhdGl0dWRlID09PSAnc3RyaW5nJyB8fCB0eXBlb2YgY29vcmRzLmxhdGl0dWRlID09PSAnbnVtYmVyJykgJiZcbiAgICAgICAgICAgICh0eXBlb2YgY29vcmRzLmxvbmdpdHVkZSA9PT0gJ3N0cmluZycgfHwgdHlwZW9mIGNvb3Jkcy5sb25naXR1ZGUgPT09ICdudW1iZXInKVxuICAgIH1cblxuICAgIGZ1bmN0aW9uIHpvb20obWFwLCB2YWx1ZSwgc3RlcCkge1xuICAgICAgICB2YXIgY3VycmVudFpvb20gPSBtYXAuZ2V0Wm9vbSgpLFxuICAgICAgICAgICAgX3N0ZXAgPSBzdGVwIHx8IEhlcmVNYXBzQ09OU1RTLkFOSU1BVElPTl9aT09NX1NURVAsXG4gICAgICAgICAgICBmYWN0b3IgPSBjdXJyZW50Wm9vbSA+PSB2YWx1ZSA/IC0xIDogMSxcbiAgICAgICAgICAgIGluY3JlbWVudCA9IHN0ZXAgKiBmYWN0b3I7XG5cbiAgICAgICAgcmV0dXJuIChmdW5jdGlvbiB6b29tKCkge1xuICAgICAgICAgICAgaWYgKCFzdGVwIHx8IE1hdGguZmxvb3IoY3VycmVudFpvb20pID09PSBNYXRoLmZsb29yKHZhbHVlKSkge1xuICAgICAgICAgICAgICAgIG1hcC5zZXRab29tKHZhbHVlKTtcbiAgICAgICAgICAgICAgICByZXR1cm47XG4gICAgICAgICAgICB9XG5cbiAgICAgICAgICAgIGN1cnJlbnRab29tICs9IGluY3JlbWVudDtcbiAgICAgICAgICAgIG1hcC5zZXRab29tKGN1cnJlbnRab29tKTtcblxuICAgICAgICAgICAgcmVxdWVzdEFuaW1hdGlvbkZyYW1lKHpvb20pO1xuICAgICAgICB9KSgpO1xuICAgIH1cblxuICAgIGZ1bmN0aW9uIGdlbmVyYXRlSWQoKSB7XG4gICAgICAgIHZhciBtYXNrID0gJ3h4eHh4eHh4LXh4eHgtNHh4eC15eHh4LXh4eHh4eHh4eHh4eCcsXG4gICAgICAgICAgICByZWdleHAgPSAvW3h5XS9nLFxuICAgICAgICAgICAgZCA9IG5ldyBEYXRlKCkuZ2V0VGltZSgpLFxuICAgICAgICAgICAgdXVpZCA9IG1hc2sucmVwbGFjZShyZWdleHAsIGZ1bmN0aW9uIChjKSB7XG4gICAgICAgICAgICAgICAgdmFyIHIgPSAoZCArIE1hdGgucmFuZG9tKCkgKiAxNikgJSAxNiB8IDA7XG4gICAgICAgICAgICAgICAgZCA9IE1hdGguZmxvb3IoZCAvIDE2KTtcbiAgICAgICAgICAgICAgICByZXR1cm4gKGMgPT0gJ3gnID8gciA6IChyICYgMHgzIHwgMHg4KSkudG9TdHJpbmcoMTYpO1xuICAgICAgICAgICAgfSk7XG5cbiAgICAgICAgcmV0dXJuIHV1aWQ7XG4gICAgfVxuXG4gICAgLy8jZW5kcmVnaW9uIFBVQkxJQyBcblxuICAgIGZ1bmN0aW9uIF9zZXRBdHRycyhlbCwgYXR0cnMpIHtcbiAgICAgICAgaWYgKCFlbCB8fCAhYXR0cnMpXG4gICAgICAgICAgICB0aHJvdyBuZXcgRXJyb3IoJ01pc3NlZCBhdHRyaWJ1dGVzJyk7XG5cbiAgICAgICAgZm9yICh2YXIga2V5IGluIGF0dHJzKSB7XG4gICAgICAgICAgICBpZiAoIWF0dHJzLmhhc093blByb3BlcnR5KGtleSkpXG4gICAgICAgICAgICAgICAgY29udGludWU7XG5cbiAgICAgICAgICAgIGVsW2tleV0gPSBhdHRyc1trZXldO1xuICAgICAgICB9XG4gICAgfVxufTsiLCJtb2R1bGUuZXhwb3J0cyA9IEhlcmVNYXBzRGVmYXVsdE1hcmtlcjtcblxuSGVyZU1hcHNEZWZhdWx0TWFya2VyLiRpbmplY3QgPSBbJ0hlcmVNYXBzTWFya2VySW50ZXJmYWNlJ107XG5mdW5jdGlvbiBIZXJlTWFwc0RlZmF1bHRNYXJrZXIoSGVyZU1hcHNNYXJrZXJJbnRlcmZhY2Upe1xuICAgIGZ1bmN0aW9uIERlZmF1bHRNYXJrZXIocGxhY2Upe1xuICAgICAgICB0aGlzLnBsYWNlID0gcGxhY2U7XG4gICAgICAgIHRoaXMuc2V0Q29vcmRzKCk7XG4gICAgfVxuXG4gICAgdmFyIHByb3RvID0gRGVmYXVsdE1hcmtlci5wcm90b3R5cGUgPSBuZXcgSGVyZU1hcHNNYXJrZXJJbnRlcmZhY2UoKTtcbiAgICBwcm90by5jb25zdHJ1Y3RvciA9IERlZmF1bHRNYXJrZXI7XG5cbiAgICBwcm90by5jcmVhdGUgPSBjcmVhdGU7XG5cbiAgICByZXR1cm4gRGVmYXVsdE1hcmtlcjtcbiAgICBcbiAgICBmdW5jdGlvbiBjcmVhdGUoKXtcbiAgICAgICAgdmFyIG1hcmtlciA9IG5ldyBILm1hcC5NYXJrZXIodGhpcy5jb29yZHMpO1xuICAgICAgICBcbiAgICAgICAgdGhpcy5hZGRJbmZvQnViYmxlKG1hcmtlcik7XG4gICAgICAgIFxuICAgICAgICByZXR1cm4gbWFya2VyO1xuICAgIH1cbn0iLCJtb2R1bGUuZXhwb3J0cyA9IEhlcmVNYXBzRE9NTWFya2VyO1xuXG5IZXJlTWFwc0RPTU1hcmtlci4kaW5qZWN0ID0gWydIZXJlTWFwc01hcmtlckludGVyZmFjZSddO1xuZnVuY3Rpb24gSGVyZU1hcHNET01NYXJrZXIoSGVyZU1hcHNNYXJrZXJJbnRlcmZhY2Upe1xuICAgIGZ1bmN0aW9uIERPTU1hcmtlcihwbGFjZSl7XG4gICAgICAgIHRoaXMucGxhY2UgPSBwbGFjZTtcbiAgICAgICAgdGhpcy5zZXRDb29yZHMoKTtcbiAgICB9XG5cbiAgICB2YXIgcHJvdG8gPSBET01NYXJrZXIucHJvdG90eXBlID0gbmV3IEhlcmVNYXBzTWFya2VySW50ZXJmYWNlKCk7XG4gICAgcHJvdG8uY29uc3RydWN0b3IgPSBET01NYXJrZXI7XG5cbiAgICBwcm90by5jcmVhdGUgPSBjcmVhdGU7XG4gICAgcHJvdG8uZ2V0SWNvbiA9IGdldEljb247XG4gICAgcHJvdG8uc2V0dXBFdmVudHMgPSBzZXR1cEV2ZW50cztcblxuICAgIHJldHVybiBET01NYXJrZXI7XG4gICAgXG4gICAgZnVuY3Rpb24gY3JlYXRlKCl7XG4gICAgICAgIHZhciBtYXJrZXIgPSBuZXcgSC5tYXAuRG9tTWFya2VyKHRoaXMuY29vcmRzLCB7XG4gICAgICAgICAgICBpY29uOiB0aGlzLmdldEljb24oKVxuICAgICAgICB9KTtcbiAgICAgICAgXG4gICAgICAgIHRoaXMuYWRkSW5mb0J1YmJsZShtYXJrZXIpO1xuICAgICAgICBcbiAgICAgICAgcmV0dXJuIG1hcmtlcjtcbiAgICB9XG4gICAgXG4gICAgZnVuY3Rpb24gZ2V0SWNvbigpe1xuICAgICAgICB2YXIgaWNvbiA9IHRoaXMucGxhY2UubWFya3VwO1xuICAgICAgICAgaWYoIWljb24pXG4gICAgICAgICAgICB0aHJvdyBuZXcgRXJyb3IoJ21hcmt1cCBtaXNzZWQnKTtcblxuICAgICAgICByZXR1cm4gbmV3IEgubWFwLkRvbUljb24oaWNvbik7XG4gICAgfVxuICAgIFxuICAgIGZ1bmN0aW9uIHNldHVwRXZlbnRzKGVsLCBldmVudHMsIHJlbW92ZSl7XG4gICAgICAgIHZhciBtZXRob2QgPSByZW1vdmUgPyAncmVtb3ZlRXZlbnRMaXN0ZW5lcicgOiAnYWRkRXZlbnRMaXN0ZW5lcic7XG5cbiAgICAgICAgZm9yKHZhciBrZXkgaW4gZXZlbnRzKSB7XG4gICAgICAgICAgICBpZighZXZlbnRzLmhhc093blByb3BlcnR5KGtleSkpXG4gICAgICAgICAgICAgICAgY29udGludWU7XG5cbiAgICAgICAgICAgIGVsW21ldGhvZF0uY2FsbChudWxsLCBrZXksIGV2ZW50c1trZXldKTtcbiAgICAgICAgfVxuICAgIH1cbn0iLCJtb2R1bGUuZXhwb3J0cyA9IGFuZ3VsYXJcbiAgICAubW9kdWxlKCdoZXJlbWFwcy1tYXJrZXJzLW1vZHVsZScsIFtdKVxuICAgIC5mYWN0b3J5KCdIZXJlTWFwc01hcmtlckludGVyZmFjZScsIHJlcXVpcmUoJy4vbWFya2VyLmpzJykpXG4gICAgLmZhY3RvcnkoJ0hlcmVNYXBzRGVmYXVsdE1hcmtlcicsIHJlcXVpcmUoJy4vZGVmYXVsdC5tYXJrZXIuanMnKSlcbiAgICAuZmFjdG9yeSgnSGVyZU1hcHNET01NYXJrZXInLCByZXF1aXJlKCcuL2RvbS5tYXJrZXIuanMnKSlcbiAgICAuZmFjdG9yeSgnSGVyZU1hcHNTVkdNYXJrZXInLCByZXF1aXJlKCcuL3N2Zy5tYXJrZXIuanMnKSlcbiAgICAuc2VydmljZSgnSGVyZU1hcHNNYXJrZXJTZXJ2aWNlJywgcmVxdWlyZSgnLi9tYXJrZXJzLnNlcnZpY2UuanMnKSk7IiwibW9kdWxlLmV4cG9ydHMgPSBmdW5jdGlvbigpe1xuICAgIGZ1bmN0aW9uIE1hcmtlckludGVyZmFjZSgpe1xuICAgICAgICB0aHJvdyBuZXcgRXJyb3IoJ0Fic3RyYWN0IGNsYXNzISBUaGUgSW5zdGFuY2Ugc2hvdWxkIGJlIGNyZWF0ZWQnKTtcbiAgICB9XG4gICAgXG4gICAgdmFyIHByb3RvID0gTWFya2VySW50ZXJmYWNlLnByb3RvdHlwZTtcbiAgICBcbiAgICBwcm90by5jcmVhdGUgPSBjcmVhdGU7XG4gICAgcHJvdG8uc2V0Q29vcmRzID0gc2V0Q29vcmRzO1xuICAgIHByb3RvLmFkZEluZm9CdWJibGUgPSBhZGRJbmZvQnViYmxlO1xuICAgIFxuICAgIGZ1bmN0aW9uIE1hcmtlcigpe31cbiAgICBcbiAgICBNYXJrZXIucHJvdG90eXBlID0gcHJvdG87XG4gICAgXG4gICAgcmV0dXJuIE1hcmtlcjtcbiAgICBcbiAgICBmdW5jdGlvbiBjcmVhdGUoKXtcbiAgICAgICAgdGhyb3cgbmV3IEVycm9yKCdjcmVhdGU6OiBub3QgaW1wbGVtZW50ZWQnKTsgXG4gICAgfVxuICAgIFxuICAgIGZ1bmN0aW9uIHNldENvb3Jkcygpe1xuICAgICAgICAgdGhpcy5jb29yZHMgPSB7XG4gICAgICAgICAgICBsYXQ6IHRoaXMucGxhY2UucG9zLmxhdCxcbiAgICAgICAgICAgIGxuZzogdGhpcy5wbGFjZS5wb3MubG5nXG4gICAgICAgIH1cbiAgICB9XG4gICAgXG4gICAgZnVuY3Rpb24gYWRkSW5mb0J1YmJsZShtYXJrZXIpe1xuICAgICAgICBpZighdGhpcy5wbGFjZS5wb3B1cClcbiAgICAgICAgICAgIHJldHVybjtcbiAgICAgICAgICAgIFxuICAgICAgICBtYXJrZXIuc2V0RGF0YSh0aGlzLnBsYWNlLnBvcHVwKVxuICAgIH1cbn0iLCJtb2R1bGUuZXhwb3J0cyA9IEhlcmVNYXBzTWFya2VyU2VydmljZTtcblxuSGVyZU1hcHNNYXJrZXJTZXJ2aWNlLiRpbmplY3QgPSBbXG4gICAgJ0hlcmVNYXBzRGVmYXVsdE1hcmtlcicsXG4gICAgJ0hlcmVNYXBzRE9NTWFya2VyJyxcbiAgICAnSGVyZU1hcHNTVkdNYXJrZXInLFxuICAgICdIZXJlTWFwc0NPTlNUUydcbl07XG5mdW5jdGlvbiBIZXJlTWFwc01hcmtlclNlcnZpY2UoSGVyZU1hcHNEZWZhdWx0TWFya2VyLCBIZXJlTWFwc0RPTU1hcmtlciwgSGVyZU1hcHNTVkdNYXJrZXIsIEhlcmVNYXBzQ09OU1RTKSB7XG4gICAgdmFyIE1BUktFUl9UWVBFUyA9IEhlcmVNYXBzQ09OU1RTLk1BUktFUl9UWVBFUztcblxuICAgIHJldHVybiB7XG4gICAgICAgIGFkZE1hcmtlcnNUb01hcDogYWRkTWFya2Vyc1RvTWFwLFxuICAgICAgICBhZGRVc2VyTWFya2VyOiBhZGRVc2VyTWFya2VyLFxuICAgICAgICB1cGRhdGVNYXJrZXJzOiB1cGRhdGVNYXJrZXJzLFxuICAgICAgICBpc01hcmtlckluc3RhbmNlOiBpc01hcmtlckluc3RhbmNlXG4gICAgfVxuXG4gICAgZnVuY3Rpb24gaXNNYXJrZXJJbnN0YW5jZSh0YXJnZXQpIHtcbiAgICAgICAgcmV0dXJuIHRhcmdldCBpbnN0YW5jZW9mIEgubWFwLk1hcmtlciB8fCB0YXJnZXQgaW5zdGFuY2VvZiBILm1hcC5Eb21NYXJrZXI7XG4gICAgfVxuXG4gICAgZnVuY3Rpb24gYWRkVXNlck1hcmtlcihtYXAsIHBsYWNlKSB7XG4gICAgICAgIGlmKG1hcC51c2VyTWFya2VyKVxuICAgICAgICAgICAgcmV0dXJuIG1hcC51c2VyTWFya2VyO1xuICAgICAgICBcbiAgICAgICAgcGxhY2UubWFya3VwID0gJzxzdmcgd2lkdGg9XCIzNXB4XCIgaGVpZ2h0PVwiMzVweFwiIHZpZXdCb3g9XCIwIDAgOTAgOTBcIiB2ZXJzaW9uPVwiMS4xXCIgeG1sbnM9XCJodHRwOi8vd3d3LnczLm9yZy8yMDAwL3N2Z1wiIHhtbG5zOnhsaW5rPVwiaHR0cDovL3d3dy53My5vcmcvMTk5OS94bGlua1wiPicgK1xuICAgICAgICAgICAgJzxkZWZzPjxjaXJjbGUgaWQ9XCJwYXRoLTFcIiBjeD1cIjMwMlwiIGN5PVwiODAyXCIgcj1cIjE1XCI+PC9jaXJjbGU+JyArXG4gICAgICAgICAgICAnPG1hc2sgaWQ9XCJtYXNrLTJcIiBtYXNrQ29udGVudFVuaXRzPVwidXNlclNwYWNlT25Vc2VcIiBtYXNrVW5pdHM9XCJvYmplY3RCb3VuZGluZ0JveFwiIHg9XCItMzBcIiB5PVwiLTMwXCIgd2lkdGg9XCI5MFwiIGhlaWdodD1cIjkwXCI+JyArXG4gICAgICAgICAgICAnPHJlY3QgeD1cIjI1N1wiIHk9XCI3NTdcIiB3aWR0aD1cIjkwXCIgaGVpZ2h0PVwiOTBcIiBmaWxsPVwid2hpdGVcIj48L3JlY3Q+PHVzZSB4bGluazpocmVmPVwiI3BhdGgtMVwiIGZpbGw9XCJibGFja1wiPjwvdXNlPicgK1xuICAgICAgICAgICAgJzwvbWFzaz48L2RlZnM+PGcgaWQ9XCJQYWdlLTFcIiBzdHJva2U9XCJub25lXCIgc3Ryb2tlLXdpZHRoPVwiMVwiIGZpbGw9XCJub25lXCIgZmlsbC1ydWxlPVwiZXZlbm9kZFwiPicgK1xuICAgICAgICAgICAgJzxnIGlkPVwiU2VydmljZS1PcHRpb25zLS0tZGlyZWN0aW9ucy0tLW1hcFwiIHRyYW5zZm9ybT1cInRyYW5zbGF0ZSgtMjU3LjAwMDAwMCwgLTc1Ny4wMDAwMDApXCI+PGcgaWQ9XCJPdmFsLTE1XCI+JyArXG4gICAgICAgICAgICAnPHVzZSBmaWxsPVwiI0ZGRkZGRlwiIGZpbGwtcnVsZT1cImV2ZW5vZGRcIiB4bGluazpocmVmPVwiI3BhdGgtMVwiPjwvdXNlPicgK1xuICAgICAgICAgICAgJzx1c2Ugc3Ryb2tlLW9wYWNpdHk9XCIwLjI5NjEzOTA0XCIgc3Ryb2tlPVwiIzNGMzRBMFwiIG1hc2s9XCJ1cmwoI21hc2stMilcIiBzdHJva2Utd2lkdGg9XCI2MFwiIHhsaW5rOmhyZWY9XCIjcGF0aC0xXCI+PC91c2U+JyArXG4gICAgICAgICAgICAnPHVzZSBzdHJva2U9XCIjM0YzNEEwXCIgc3Ryb2tlLXdpZHRoPVwiNVwiIHhsaW5rOmhyZWY9XCIjcGF0aC0xXCI+PC91c2U+PC9nPjwvZz48L2c+PC9zdmc+JztcblxuICAgICAgICBtYXAudXNlck1hcmtlciA9IG5ldyBIZXJlTWFwc1NWR01hcmtlcihwbGFjZSkuY3JlYXRlKCk7XG5cbiAgICAgICAgbWFwLmFkZE9iamVjdChtYXAudXNlck1hcmtlcik7XG5cbiAgICAgICAgcmV0dXJuIG1hcC51c2VyTWFya2VyO1xuICAgIH1cblxuICAgIGZ1bmN0aW9uIGFkZE1hcmtlcnNUb01hcChtYXAsIHBsYWNlcywgcmVmcmVzaFZpZXdib3VuZHMpIHtcbiAgICAgICAgaWYgKCFwbGFjZXMgfHwgIXBsYWNlcy5sZW5ndGgpXG4gICAgICAgICAgICByZXR1cm47XG5cbiAgICAgICAgaWYgKCEobWFwIGluc3RhbmNlb2YgSC5NYXApKVxuICAgICAgICAgICAgdGhyb3cgbmV3IEVycm9yKCdVbnN1cHBvcnRlZCBtYXAgaW5zdGFuY2UnKTtcblxuICAgICAgICBpZiAoIW1hcC5tYXJrZXJzR3JvdXApXG4gICAgICAgICAgICBtYXAubWFya2Vyc0dyb3VwID0gbmV3IEgubWFwLkdyb3VwKCk7XG5cbiAgICAgICAgcGxhY2VzLmZvckVhY2goZnVuY3Rpb24ocGxhY2UsIGkpIHtcbiAgICAgICAgICAgIHZhciBjcmVhdG9yID0gX2dldE1hcmtlckNyZWF0b3IocGxhY2UpLFxuICAgICAgICAgICAgICAgIG1hcmtlciA9IHBsYWNlLmRyYWdnYWJsZSA/IF9kcmFnZ2FibGVNYXJrZXJNaXhpbihjcmVhdG9yLmNyZWF0ZSgpKSA6IGNyZWF0b3IuY3JlYXRlKCk7XG5cbiAgICAgICAgICAgIG1hcC5tYXJrZXJzR3JvdXAuYWRkT2JqZWN0KG1hcmtlcik7XG4gICAgICAgIH0pO1xuXG4gICAgICAgIG1hcC5hZGRPYmplY3QobWFwLm1hcmtlcnNHcm91cCk7XG5cbiAgICAgICAgaWYocmVmcmVzaFZpZXdib3VuZHMpe1xuICAgICAgICAgIG1hcC5zZXRWaWV3Qm91bmRzKG1hcC5tYXJrZXJzR3JvdXAuZ2V0Qm91bmRzKCkpO1xuICAgICAgICB9XG4gICAgICB9XG4gICAgZnVuY3Rpb24gdXBkYXRlTWFya2VycyhtYXAsIHBsYWNlcywgcmVmcmVzaFZpZXdib3VuZHMpIHtcbiAgICAgICAgaWYgKG1hcC5tYXJrZXJzR3JvdXApIHtcbiAgICAgICAgICAgIG1hcC5tYXJrZXJzR3JvdXAucmVtb3ZlQWxsKCk7XG4gICAgICAgICAgICBtYXAucmVtb3ZlT2JqZWN0KG1hcC5tYXJrZXJzR3JvdXApO1xuICAgICAgICAgICAgbWFwLm1hcmtlcnNHcm91cCA9IG51bGw7XG4gICAgICAgIH1cblxuICAgICAgICBhZGRNYXJrZXJzVG9NYXAuYXBwbHkobnVsbCwgYXJndW1lbnRzKTtcbiAgICB9XG5cbiAgICBmdW5jdGlvbiBfZ2V0TWFya2VyQ3JlYXRvcihwbGFjZSkge1xuICAgICAgICB2YXIgQ29uY3JldGVNYXJrZXIsXG4gICAgICAgICAgICB0eXBlID0gcGxhY2UudHlwZSA/IHBsYWNlLnR5cGUudG9VcHBlckNhc2UoKSA6IG51bGw7XG5cbiAgICAgICAgc3dpdGNoICh0eXBlKSB7XG4gICAgICAgICAgICBjYXNlIE1BUktFUl9UWVBFUy5ET006XG4gICAgICAgICAgICAgICAgQ29uY3JldGVNYXJrZXIgPSBIZXJlTWFwc0RPTU1hcmtlcjtcbiAgICAgICAgICAgICAgICBicmVhaztcbiAgICAgICAgICAgIGNhc2UgTUFSS0VSX1RZUEVTLlNWRzpcbiAgICAgICAgICAgICAgICBDb25jcmV0ZU1hcmtlciA9IEhlcmVNYXBzU1ZHTWFya2VyO1xuICAgICAgICAgICAgICAgIGJyZWFrO1xuICAgICAgICAgICAgZGVmYXVsdDpcbiAgICAgICAgICAgICAgICBDb25jcmV0ZU1hcmtlciA9IEhlcmVNYXBzRGVmYXVsdE1hcmtlcjtcbiAgICAgICAgfVxuXG4gICAgICAgIHJldHVybiBuZXcgQ29uY3JldGVNYXJrZXIocGxhY2UpO1xuICAgIH1cblxuICAgIGZ1bmN0aW9uIF9kcmFnZ2FibGVNYXJrZXJNaXhpbihtYXJrZXIpIHtcbiAgICAgICAgbWFya2VyLmRyYWdnYWJsZSA9IHRydWU7XG5cbiAgICAgICAgcmV0dXJuIG1hcmtlcjtcbiAgICB9XG5cbn07XG4iLCJtb2R1bGUuZXhwb3J0cyA9IEhlcmVNYXBzU1ZHTWFya2VyO1xuXG5IZXJlTWFwc1NWR01hcmtlci4kaW5qZWN0ID0gWydIZXJlTWFwc01hcmtlckludGVyZmFjZSddO1xuZnVuY3Rpb24gSGVyZU1hcHNTVkdNYXJrZXIoSGVyZU1hcHNNYXJrZXJJbnRlcmZhY2Upe1xuICAgIGZ1bmN0aW9uIFNWR01hcmtlcihwbGFjZSl7XG4gICAgICAgIHRoaXMucGxhY2UgPSBwbGFjZTtcbiAgICAgICAgdGhpcy5zZXRDb29yZHMoKTtcbiAgICB9XG4gICAgXG4gICAgdmFyIHByb3RvID0gU1ZHTWFya2VyLnByb3RvdHlwZSA9IG5ldyBIZXJlTWFwc01hcmtlckludGVyZmFjZSgpO1xuICAgIHByb3RvLmNvbnN0cnVjdG9yID0gU1ZHTWFya2VyO1xuICAgIFxuICAgIHByb3RvLmNyZWF0ZSA9IGNyZWF0ZTtcbiAgICBwcm90by5nZXRJY29uID0gZ2V0SWNvbjtcbiAgICBcbiAgICByZXR1cm4gU1ZHTWFya2VyO1xuICAgIFxuICAgIGZ1bmN0aW9uIGNyZWF0ZSgpe1xuICAgICAgICB2YXIgbWFya2VyID0gbmV3IEgubWFwLk1hcmtlcih0aGlzLmNvb3Jkcywge1xuICAgICAgICAgICAgaWNvbjogdGhpcy5nZXRJY29uKCksXG4gICAgICAgIH0pO1xuICAgICAgICBcbiAgICAgICAgdGhpcy5hZGRJbmZvQnViYmxlKG1hcmtlcik7XG4gICAgICAgIFxuICAgICAgICByZXR1cm4gbWFya2VyO1xuICAgIH1cbiAgICBcbiAgICBmdW5jdGlvbiBnZXRJY29uKCl7XG4gICAgICAgIHZhciBpY29uID0gdGhpcy5wbGFjZS5tYXJrdXA7XG4gICAgICAgICBpZighaWNvbilcbiAgICAgICAgICAgIHRocm93IG5ldyBFcnJvcignbWFya3VwIG1pc3NlZCcpO1xuXG4gICAgICAgIHJldHVybiBuZXcgSC5tYXAuSWNvbihpY29uKTtcbiAgICB9XG59IiwibW9kdWxlLmV4cG9ydHMgPSBhbmd1bGFyLm1vZHVsZSgnaGVyZW1hcHMtcm91dGVzLW1vZHVsZScsIFtdKVxuICAgICAgICAgICAgICAgICAgICAuc2VydmljZSgnSGVyZU1hcHNSb3V0ZXNTZXJ2aWNlJywgcmVxdWlyZSgnLi9yb3V0ZXMuc2VydmljZS5qcycpKTsgICIsIm1vZHVsZS5leHBvcnRzID0gSGVyZU1hcHNSb3V0ZXNTZXJ2aWNlO1xuXG5IZXJlTWFwc1JvdXRlc1NlcnZpY2UuJGluamVjdCA9IFsnJHEnXTtcbmZ1bmN0aW9uIEhlcmVNYXBzUm91dGVzU2VydmljZSgkcSkge1xuICAgIHJldHVybiB7XG4gICAgICAgIGNhbGN1bGF0ZVJvdXRlOiBjYWxjdWxhdGVSb3V0ZSxcbiAgICAgICAgYWRkUm91dGVUb01hcDogYWRkUm91dGVUb01hcCxcbiAgICAgICAgY2xlYW5Sb3V0ZXM6IGNsZWFuUm91dGVzXG4gICAgfVxuXG4gICAgZnVuY3Rpb24gY2FsY3VsYXRlUm91dGUoaGVyZW1hcHMsIGNvbmZpZykge1xuICAgICAgICB2YXIgcGxhdGZvcm0gPSBoZXJlbWFwcy5wbGF0Zm9ybSxcbiAgICAgICAgICAgIG1hcCA9IGhlcmVtYXBzLm1hcCxcbiAgICAgICAgICAgIHJvdXRlciA9IHBsYXRmb3JtLmdldFJvdXRpbmdTZXJ2aWNlKCksXG4gICAgICAgICAgICBkaXIgPSBjb25maWcuZGlyZWN0aW9uLFxuICAgICAgICAgICAgd2F5cG9pbnRzID0gZGlyLndheXBvaW50cztcblxuICAgICAgICB2YXIgbW9kZSA9ICd7e01PREV9fTt7e1ZFQ0hJTEV9fSdcbiAgICAgICAgICAgIC5yZXBsYWNlKC97e01PREV9fS8sIGRpci5tb2RlIHx8ICdmYXN0ZXN0JylcbiAgICAgICAgICAgIC5yZXBsYWNlKC97e1ZFQ0hJTEV9fS8sIGNvbmZpZy5kcml2ZVR5cGUpO1xuXG4gICAgICAgIHZhciByb3V0ZVJlcXVlc3RQYXJhbXMgPSB7XG4gICAgICAgICAgICBtb2RlOiBtb2RlLFxuICAgICAgICAgICAgcmVwcmVzZW50YXRpb246IGRpci5yZXByZXNlbnRhdGlvbiB8fCAnZGlzcGxheScsXG4gICAgICAgICAgICBsYW5ndWFnZTogZGlyLmxhbmd1YWdlIHx8ICdlbi1nYidcbiAgICAgICAgfTtcblxuICAgICAgICB3YXlwb2ludHMuZm9yRWFjaChmdW5jdGlvbiAod2F5cG9pbnQsIGkpIHtcbiAgICAgICAgICAgIHJvdXRlUmVxdWVzdFBhcmFtc1tcIndheXBvaW50XCIgKyBpXSA9IFt3YXlwb2ludC5sYXQsIHdheXBvaW50LmxuZ10uam9pbignLCcpO1xuICAgICAgICB9KTtcblxuICAgICAgICBfc2V0QXR0cmlidXRlcyhyb3V0ZVJlcXVlc3RQYXJhbXMsIGRpci5hdHRycyk7XG5cbiAgICAgICAgdmFyIGRlZmVycmVkID0gJHEuZGVmZXIoKTtcblxuICAgICAgICByb3V0ZXIuY2FsY3VsYXRlUm91dGUocm91dGVSZXF1ZXN0UGFyYW1zLCBmdW5jdGlvbiAocmVzdWx0KSB7XG4gICAgICAgICAgICBkZWZlcnJlZC5yZXNvbHZlKHJlc3VsdCk7XG4gICAgICAgIH0sIGZ1bmN0aW9uIChlcnJvcikge1xuICAgICAgICAgICAgZGVmZXJyZWQucmVqZWN0KGVycm9yKTtcbiAgICAgICAgfSk7XG5cbiAgICAgICAgcmV0dXJuIGRlZmVycmVkLnByb21pc2U7XG4gICAgfVxuXG4gICAgZnVuY3Rpb24gY2xlYW5Sb3V0ZXMobWFwKSB7XG4gICAgICAgIHZhciBncm91cCA9IG1hcC5yb3V0ZXNHcm91cDtcblxuICAgICAgICBpZiAoIWdyb3VwKVxuICAgICAgICAgICAgcmV0dXJuO1xuXG4gICAgICAgIGdyb3VwLnJlbW92ZUFsbCgpO1xuICAgICAgICBtYXAucmVtb3ZlT2JqZWN0KGdyb3VwKTtcbiAgICAgICAgbWFwLnJvdXRlc0dyb3VwID0gbnVsbDtcbiAgICB9XG5cbiAgICBmdW5jdGlvbiBhZGRSb3V0ZVRvTWFwKG1hcCwgcm91dGVEYXRhLCBjbGVhbikge1xuICAgICAgICBpZiAoY2xlYW4pXG4gICAgICAgICAgICBjbGVhblJvdXRlcyhtYXApO1xuXG4gICAgICAgIHZhciByb3V0ZSA9IHJvdXRlRGF0YS5yb3V0ZTtcblxuICAgICAgICBpZiAoIW1hcCB8fCAhcm91dGUgfHwgIXJvdXRlLnNoYXBlKVxuICAgICAgICAgICAgcmV0dXJuO1xuXG4gICAgICAgIHZhciBzdHJpcCA9IG5ldyBILmdlby5TdHJpcCgpLCBwb2x5bGluZSA9IG51bGw7XG5cbiAgICAgICAgcm91dGUuc2hhcGUuZm9yRWFjaChmdW5jdGlvbiAocG9pbnQpIHtcbiAgICAgICAgICAgIHZhciBwYXJ0cyA9IHBvaW50LnNwbGl0KCcsJyk7XG4gICAgICAgICAgICBzdHJpcC5wdXNoTGF0TG5nQWx0KHBhcnRzWzBdLCBwYXJ0c1sxXSk7XG4gICAgICAgIH0pO1xuXG4gICAgICAgIHZhciBzdHlsZSA9IHJvdXRlRGF0YS5zdHlsZSB8fCB7fTtcblxuICAgICAgICBwb2x5bGluZSA9IG5ldyBILm1hcC5Qb2x5bGluZShzdHJpcCwge1xuICAgICAgICAgICAgc3R5bGU6IHtcbiAgICAgICAgICAgICAgICBsaW5lV2lkdGg6IHN0eWxlLmxpbmVXaWR0aCB8fCA0LFxuICAgICAgICAgICAgICAgIHN0cm9rZUNvbG9yOiBzdHlsZS5jb2xvciB8fCAncmdiYSgwLCAxMjgsIDI1NSwgMC43KSdcbiAgICAgICAgICAgIH1cbiAgICAgICAgfSk7XG5cbiAgICAgICAgdmFyIGdyb3VwID0gbWFwLnJvdXRlc0dyb3VwO1xuXG4gICAgICAgIGlmICghZ3JvdXApIHtcbiAgICAgICAgICAgIGdyb3VwID0gbWFwLnJvdXRlc0dyb3VwID0gbmV3IEgubWFwLkdyb3VwKCk7XG4gICAgICAgICAgICBtYXAuYWRkT2JqZWN0KGdyb3VwKTtcbiAgICAgICAgfVxuXG4gICAgICAgIGdyb3VwLmFkZE9iamVjdChwb2x5bGluZSk7XG5cbiAgICAgICAgaWYocm91dGVEYXRhLnpvb21Ub0JvdW5kcykge1xuICAgICAgICAgICAgbWFwLnNldFZpZXdCb3VuZHMocG9seWxpbmUuZ2V0Qm91bmRzKCksIHRydWUpO1xuICAgICAgICB9XG4gICAgfVxuXG4gICAgLy8jcmVnaW9uIFBSSVZBVEVcblxuICAgIGZ1bmN0aW9uIF9zZXRBdHRyaWJ1dGVzKHBhcmFtcywgYXR0cnMpIHtcbiAgICAgICAgdmFyIF9rZXkgPSAnYXR0cmlidXRlcyc7XG4gICAgICAgIGZvciAodmFyIGtleSBpbiBhdHRycykge1xuICAgICAgICAgICAgaWYgKCFhdHRycy5oYXNPd25Qcm9wZXJ0eShrZXkpKVxuICAgICAgICAgICAgICAgIGNvbnRpbnVlO1xuXG4gICAgICAgICAgICBwYXJhbXNba2V5ICsgX2tleV0gPSBhdHRyc1trZXldO1xuICAgICAgICB9XG4gICAgfVxuXG4gICAgLyoqXG4gICAgICogQ3JlYXRlcyBhIHNlcmllcyBvZiBILm1hcC5NYXJrZXIgcG9pbnRzIGZyb20gdGhlIHJvdXRlIGFuZCBhZGRzIHRoZW0gdG8gdGhlIG1hcC5cbiAgICAgKiBAcGFyYW0ge09iamVjdH0gcm91dGUgIEEgcm91dGUgYXMgcmVjZWl2ZWQgZnJvbSB0aGUgSC5zZXJ2aWNlLlJvdXRpbmdTZXJ2aWNlXG4gICAgICovXG4gICAgZnVuY3Rpb24gYWRkTWFudWV2ZXJzVG9NYXAobWFwLCByb3V0ZSkge1xuICAgICAgICB2YXIgc3ZnTWFya3VwID0gJzxzdmcgd2lkdGg9XCIxOFwiIGhlaWdodD1cIjE4XCIgJyArXG4gICAgICAgICAgICAneG1sbnM9XCJodHRwOi8vd3d3LnczLm9yZy8yMDAwL3N2Z1wiPicgK1xuICAgICAgICAgICAgJzxjaXJjbGUgY3g9XCI4XCIgY3k9XCI4XCIgcj1cIjhcIiAnICtcbiAgICAgICAgICAgICdmaWxsPVwiIzFiNDY4ZFwiIHN0cm9rZT1cIndoaXRlXCIgc3Ryb2tlLXdpZHRoPVwiMVwiICAvPicgK1xuICAgICAgICAgICAgJzwvc3ZnPicsXG4gICAgICAgICAgICBkb3RJY29uID0gbmV3IEgubWFwLkljb24oc3ZnTWFya3VwLCB7IGFuY2hvcjogeyB4OiA4LCB5OiA4IH0gfSksXG4gICAgICAgICAgICBncm91cCA9IG5ldyBILm1hcC5Hcm91cCgpLCBpLCBqO1xuXG4gICAgICAgIC8vIEFkZCBhIG1hcmtlciBmb3IgZWFjaCBtYW5ldXZlclxuICAgICAgICBmb3IgKGkgPSAwOyBpIDwgcm91dGUubGVnLmxlbmd0aDsgaSArPSAxKSB7XG4gICAgICAgICAgICBmb3IgKGogPSAwOyBqIDwgcm91dGUubGVnW2ldLm1hbmV1dmVyLmxlbmd0aDsgaiArPSAxKSB7XG4gICAgICAgICAgICAgICAgLy8gR2V0IHRoZSBuZXh0IG1hbmV1dmVyLlxuICAgICAgICAgICAgICAgIG1hbmV1dmVyID0gcm91dGUubGVnW2ldLm1hbmV1dmVyW2pdO1xuICAgICAgICAgICAgICAgIC8vIEFkZCBhIG1hcmtlciB0byB0aGUgbWFuZXV2ZXJzIGdyb3VwXG4gICAgICAgICAgICAgICAgdmFyIG1hcmtlciA9IG5ldyBILm1hcC5NYXJrZXIoe1xuICAgICAgICAgICAgICAgICAgICBsYXQ6IG1hbmV1dmVyLnBvc2l0aW9uLmxhdGl0dWRlLFxuICAgICAgICAgICAgICAgICAgICBsbmc6IG1hbmV1dmVyLnBvc2l0aW9uLmxvbmdpdHVkZVxuICAgICAgICAgICAgICAgIH0sXG4gICAgICAgICAgICAgICAgICAgIHsgaWNvbjogZG90SWNvbiB9XG4gICAgICAgICAgICAgICAgKTtcblxuICAgICAgICAgICAgICAgIG1hcmtlci5pbnN0cnVjdGlvbiA9IG1hbmV1dmVyLmluc3RydWN0aW9uO1xuICAgICAgICAgICAgICAgIGdyb3VwLmFkZE9iamVjdChtYXJrZXIpO1xuICAgICAgICAgICAgfVxuICAgICAgICB9XG5cbiAgICAgICAgZ3JvdXAuYWRkRXZlbnRMaXN0ZW5lcigndGFwJywgZnVuY3Rpb24gKGV2dCkge1xuICAgICAgICAgICAgbWFwLnNldENlbnRlcihldnQudGFyZ2V0LmdldFBvc2l0aW9uKCkpO1xuICAgICAgICAgICAgb3BlbkJ1YmJsZShldnQudGFyZ2V0LmdldFBvc2l0aW9uKCksIGV2dC50YXJnZXQuaW5zdHJ1Y3Rpb24pO1xuICAgICAgICB9LCBmYWxzZSk7XG5cbiAgICAgICAgLy8gQWRkIHRoZSBtYW5ldXZlcnMgZ3JvdXAgdG8gdGhlIG1hcFxuICAgICAgICBtYXAuYWRkT2JqZWN0KGdyb3VwKTtcbiAgICB9XG5cblxuICAgIC8qKlxuICAgICAqIENyZWF0ZXMgYSBzZXJpZXMgb2YgSC5tYXAuTWFya2VyIHBvaW50cyBmcm9tIHRoZSByb3V0ZSBhbmQgYWRkcyB0aGVtIHRvIHRoZSBtYXAuXG4gICAgICogQHBhcmFtIHtPYmplY3R9IHJvdXRlICBBIHJvdXRlIGFzIHJlY2VpdmVkIGZyb20gdGhlIEguc2VydmljZS5Sb3V0aW5nU2VydmljZVxuICAgICAqL1xuICAgIGZ1bmN0aW9uIGFkZFdheXBvaW50c1RvUGFuZWwod2F5cG9pbnRzKSB7XG4gICAgICAgIHZhciBub2RlSDMgPSBkb2N1bWVudC5jcmVhdGVFbGVtZW50KCdoMycpLFxuICAgICAgICAgICAgd2F5cG9pbnRMYWJlbHMgPSBbXSxcbiAgICAgICAgICAgIGk7XG5cbiAgICAgICAgZm9yIChpID0gMDsgaSA8IHdheXBvaW50cy5sZW5ndGg7IGkgKz0gMSkge1xuICAgICAgICAgICAgd2F5cG9pbnRMYWJlbHMucHVzaCh3YXlwb2ludHNbaV0ubGFiZWwpXG4gICAgICAgIH1cblxuICAgICAgICBub2RlSDMudGV4dENvbnRlbnQgPSB3YXlwb2ludExhYmVscy5qb2luKCcgLSAnKTtcblxuICAgICAgICByb3V0ZUluc3RydWN0aW9uc0NvbnRhaW5lci5pbm5lckhUTUwgPSAnJztcbiAgICAgICAgcm91dGVJbnN0cnVjdGlvbnNDb250YWluZXIuYXBwZW5kQ2hpbGQobm9kZUgzKTtcbiAgICB9XG5cbiAgICAvKipcbiAgICAgKiBDcmVhdGVzIGEgc2VyaWVzIG9mIEgubWFwLk1hcmtlciBwb2ludHMgZnJvbSB0aGUgcm91dGUgYW5kIGFkZHMgdGhlbSB0byB0aGUgbWFwLlxuICAgICAqIEBwYXJhbSB7T2JqZWN0fSByb3V0ZSAgQSByb3V0ZSBhcyByZWNlaXZlZCBmcm9tIHRoZSBILnNlcnZpY2UuUm91dGluZ1NlcnZpY2VcbiAgICAgKi9cbiAgICBmdW5jdGlvbiBhZGRTdW1tYXJ5VG9QYW5lbChzdW1tYXJ5KSB7XG4gICAgICAgIHZhciBzdW1tYXJ5RGl2ID0gZG9jdW1lbnQuY3JlYXRlRWxlbWVudCgnZGl2JyksXG4gICAgICAgICAgICBjb250ZW50ID0gJyc7XG5cbiAgICAgICAgY29udGVudCArPSAnPGI+VG90YWwgZGlzdGFuY2U8L2I+OiAnICsgc3VtbWFyeS5kaXN0YW5jZSArICdtLiA8YnIvPic7XG4gICAgICAgIGNvbnRlbnQgKz0gJzxiPlRyYXZlbCBUaW1lPC9iPjogJyArIHN1bW1hcnkudHJhdmVsVGltZS50b01NU1MoKSArICcgKGluIGN1cnJlbnQgdHJhZmZpYyknO1xuXG5cbiAgICAgICAgc3VtbWFyeURpdi5zdHlsZS5mb250U2l6ZSA9ICdzbWFsbCc7XG4gICAgICAgIHN1bW1hcnlEaXYuc3R5bGUubWFyZ2luTGVmdCA9ICc1JSc7XG4gICAgICAgIHN1bW1hcnlEaXYuc3R5bGUubWFyZ2luUmlnaHQgPSAnNSUnO1xuICAgICAgICBzdW1tYXJ5RGl2LmlubmVySFRNTCA9IGNvbnRlbnQ7XG4gICAgICAgIHJvdXRlSW5zdHJ1Y3Rpb25zQ29udGFpbmVyLmFwcGVuZENoaWxkKHN1bW1hcnlEaXYpO1xuICAgIH1cblxuICAgIC8qKlxuICAgICAqIENyZWF0ZXMgYSBzZXJpZXMgb2YgSC5tYXAuTWFya2VyIHBvaW50cyBmcm9tIHRoZSByb3V0ZSBhbmQgYWRkcyB0aGVtIHRvIHRoZSBtYXAuXG4gICAgICogQHBhcmFtIHtPYmplY3R9IHJvdXRlICBBIHJvdXRlIGFzIHJlY2VpdmVkIGZyb20gdGhlIEguc2VydmljZS5Sb3V0aW5nU2VydmljZVxuICAgICAqL1xuICAgIGZ1bmN0aW9uIGFkZE1hbnVldmVyc1RvUGFuZWwocm91dGUpIHtcbiAgICAgICAgdmFyIG5vZGVPTCA9IGRvY3VtZW50LmNyZWF0ZUVsZW1lbnQoJ29sJyksIGksIGo7XG5cbiAgICAgICAgbm9kZU9MLnN0eWxlLmZvbnRTaXplID0gJ3NtYWxsJztcbiAgICAgICAgbm9kZU9MLnN0eWxlLm1hcmdpbkxlZnQgPSAnNSUnO1xuICAgICAgICBub2RlT0wuc3R5bGUubWFyZ2luUmlnaHQgPSAnNSUnO1xuICAgICAgICBub2RlT0wuY2xhc3NOYW1lID0gJ2RpcmVjdGlvbnMnO1xuXG4gICAgICAgIC8vIEFkZCBhIG1hcmtlciBmb3IgZWFjaCBtYW5ldXZlclxuICAgICAgICBmb3IgKGkgPSAwOyBpIDwgcm91dGUubGVnLmxlbmd0aDsgaSArPSAxKSB7XG4gICAgICAgICAgICBmb3IgKGogPSAwOyBqIDwgcm91dGUubGVnW2ldLm1hbmV1dmVyLmxlbmd0aDsgaiArPSAxKSB7XG4gICAgICAgICAgICAgICAgLy8gR2V0IHRoZSBuZXh0IG1hbmV1dmVyLlxuICAgICAgICAgICAgICAgIG1hbmV1dmVyID0gcm91dGUubGVnW2ldLm1hbmV1dmVyW2pdO1xuXG4gICAgICAgICAgICAgICAgdmFyIGxpID0gZG9jdW1lbnQuY3JlYXRlRWxlbWVudCgnbGknKSxcbiAgICAgICAgICAgICAgICAgICAgc3BhbkFycm93ID0gZG9jdW1lbnQuY3JlYXRlRWxlbWVudCgnc3BhbicpLFxuICAgICAgICAgICAgICAgICAgICBzcGFuSW5zdHJ1Y3Rpb24gPSBkb2N1bWVudC5jcmVhdGVFbGVtZW50KCdzcGFuJyk7XG5cbiAgICAgICAgICAgICAgICBzcGFuQXJyb3cuY2xhc3NOYW1lID0gJ2Fycm93ICcgKyBtYW5ldXZlci5hY3Rpb247XG4gICAgICAgICAgICAgICAgc3Bhbkluc3RydWN0aW9uLmlubmVySFRNTCA9IG1hbmV1dmVyLmluc3RydWN0aW9uO1xuICAgICAgICAgICAgICAgIGxpLmFwcGVuZENoaWxkKHNwYW5BcnJvdyk7XG4gICAgICAgICAgICAgICAgbGkuYXBwZW5kQ2hpbGQoc3Bhbkluc3RydWN0aW9uKTtcblxuICAgICAgICAgICAgICAgIG5vZGVPTC5hcHBlbmRDaGlsZChsaSk7XG4gICAgICAgICAgICB9XG4gICAgICAgIH1cblxuICAgICAgICByb3V0ZUluc3RydWN0aW9uc0NvbnRhaW5lci5hcHBlbmRDaGlsZChub2RlT0wpO1xuICAgIH1cblxufTtcbiJdfQ==
