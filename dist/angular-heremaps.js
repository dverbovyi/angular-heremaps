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
                refresh: function () {
                    var currentBounds = this.getViewBounds();

                    this.setMapSizes();
                    this.setViewBounds(currentBounds);
                },
                setMapSizes: function (height, width) {
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
                getZoom: function () {
                    return heremaps.map.getZoom();
                },
                getCenter: function () {
                    return heremaps.map.getCenter();
                },
                getViewBounds: function () {
                    return heremaps.map.getViewBounds();
                },
                setViewBounds: function (boundingRect, opt_animate) {
                    HereMapsMarkerService.setViewBounds(heremaps.map, boundingRect, opt_animate);
                },
                getBoundsRectFromPoints: function (topLeft, bottomRight) {
                    return HereMapsUtilsService.getBoundsRectFromPoints.apply(null, arguments);
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

                        return {
                            lat: coords.latitude,
                            lng: coords.longitude
                        };
                    })
                },
                geocodePosition: function (coords, options) {
                    return HereMapsAPIService.geocodePosition(heremaps.platform, {
                        coords: coords,
                        radius: options && options.radius,
                        lang: options && options.lang
                    });
                },
                geocodeAddress: function (address) {
                    return HereMapsAPIService.geocodeAddress(heremaps.platform, {
                        searchtext: address && address.searchtext,
                        country: address && address.country,
                        city: address && address.city,
                        street: address && address.street,
                        housenumber: address && address.housenumber
                    });
                },
                geocodeAutocomplete: function (query, options) {
                    return HereMapsAPIService.geocodeAutocomplete({
                        query: query,
                        beginHighlight: options && options.beginHighlight,
                        endHighlight: options && options.endHighlight,
                        maxresults: options && options.maxresults
                    });
                },
                findLocationById: function (locationId) {
                    return HereMapsAPIService.findLocationById(locationId);
                },
                updateMarkers: function (places, refreshViewbounds) {
                    HereMapsMarkerService.updateMarkers(heremaps.map, places, refreshViewbounds);
                },
                getMapFactory: function (){
                    return HereMapsUtilsService.getMapFactory();
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
        EVENTS: "mapsjs-mapevents.js",
        AUTOCOMPLETE_URL: "://autocomplete.geocoder.cit.api.here.com/6.2/suggest.json",
        LOCATION_URL: "://geocoder.cit.api.here.com/6.2/geocode.json"
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
        geocodeAddress: geocodeAddress,
        geocodeAutocomplete: geocodeAutocomplete,
        findLocationById: findLocationById
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

        if (options && HereMapsUtilsService.isValidCoords(options.coords)) {
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

    function geocodeAutocomplete(params) {
        if (!params)
            return console.error('Missing required parameters');

        var autocompleteUrl = protocol + CONFIG.AUTOCOMPLETE_URL,
            deferred = $q.defer(),
            _params = {
                query: "",
                beginHighlight: "<mark>",
                endHighlight: "</mark>",
                maxresults: "5"
            };

        for (var key in _params) {
            if (angular.isDefined(params[key])) {
                _params[key] = params[key];
            }
        }

        _params.app_id = HereMapsConfig.app_id;
        _params.app_code = HereMapsConfig.app_code;

        $http.get(autocompleteUrl, { params: _params })
            .success(function(response) {
                deferred.resolve(response);
            })
            .error(function(error) {
                deferred.reject(error);
            });

        return deferred.promise;
    }

    /**
     * Finds location by HERE Maps Location identifier.
     */
    function findLocationById(locationId) {
        if (!locationId)
            return console.error('Missing Location Identifier');

        var locationUrl = protocol + CONFIG.LOCATION_URL,
            deferred = $q.defer(),
            _params = {
                locationid: locationId,
                gen: 9,
                app_id: HereMapsConfig.app_id,
                app_code: HereMapsConfig.app_code
            };

        $http.get(locationUrl, { params: _params })
            .success(function(response) {
                deferred.resolve(response);
            })
            .error(function(error) {
                deferred.reject(error);
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
            src = _getURL(sourceName);
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
        dragend: 'dragend',
        mapviewchange: 'mapviewchange',
        mapviewchangestart: 'mapviewchangestart',
        mapviewchangeend: 'mapviewchangeend'
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

        HereMapsUtilsService.addEventListener(this.map, 'mapviewchangestart', function(e) {
            self.triggerUserListener(HereMapsCONSTS.USER_EVENTS[e.type], e);
        });

        HereMapsUtilsService.addEventListener(this.map, 'mapviewchange', function(e) {
            self.triggerUserListener(HereMapsCONSTS.USER_EVENTS[e.type], e);
        });

        HereMapsUtilsService.addEventListener(this.map, 'mapviewchangeend', function(e) {
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
        getBoundsRectFromPoints: getBoundsRectFromPoints,
        generateId: generateId,
        getMapFactory: getMapFactory
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
        obj.addEventListener(eventName, listener, !!useCapture);
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

    function getMapFactory(){
        return H;
    }

    /**
     * @method getBoundsRectFromPoints
     * 
     * @param {Object} topLeft 
     *  @property {Number|String} lat
     *  @property {Number|String} lng
     * @param {Object} bottomRight 
     *  @property {Number|String} lat
     *  @property {Number|String} lng
     * 
     * @return {H.geo.Rect}
     */
    function getBoundsRectFromPoints(topLeft, bottomRight) {
        return H.geo.Rect.fromPoints(topLeft, bottomRight, true);
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
        isMarkerInstance: isMarkerInstance,
        setViewBounds: setViewBounds
    }

    function isMarkerInstance(target) {
        return target instanceof H.map.Marker || target instanceof H.map.DomMarker;
    }

    function addUserMarker(map, place) {
        if (map.userMarker)
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

        places.forEach(function (place, i) {
            var creator = _getMarkerCreator(place),
                marker = place.draggable ? _draggableMarkerMixin(creator.create()) : creator.create();

            map.markersGroup.addObject(marker);
        });

        map.addObject(map.markersGroup);

        if (refreshViewbounds) {
            setViewBounds(map, map.markersGroup.getBounds());
        }
    }

    function setViewBounds(map, bounds, opt_animate) {
        map.setViewBounds(bounds, !!opt_animate);
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

HereMapsRoutesService.$inject = ['$q', 'HereMapsMarkerService'];
function HereMapsRoutesService($q, HereMapsMarkerService) {
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
            HereMapsMarkerService.setViewBounds(map, polyline.getBounds(), true);
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
//# sourceMappingURL=data:application/json;charset=utf-8;base64,eyJ2ZXJzaW9uIjozLCJzb3VyY2VzIjpbIm5vZGVfbW9kdWxlcy9icm93c2VyLXBhY2svX3ByZWx1ZGUuanMiLCJzcmMvaGVyZW1hcHMuZGlyZWN0aXZlLmpzIiwic3JjL2luZGV4LmpzIiwic3JjL3Byb3ZpZGVycy9hcGkuc2VydmljZS5qcyIsInNyYy9wcm92aWRlcnMvY29uc3RzLmpzIiwic3JjL3Byb3ZpZGVycy9tYXAtbW9kdWxlcy9ldmVudHMvZXZlbnRzLmpzIiwic3JjL3Byb3ZpZGVycy9tYXAtbW9kdWxlcy9ldmVudHMvaW5mb2J1YmJsZS5qcyIsInNyYy9wcm92aWRlcnMvbWFwLW1vZHVsZXMvaW5kZXguanMiLCJzcmMvcHJvdmlkZXJzL21hcC1tb2R1bGVzL3VpL3VpLmpzIiwic3JjL3Byb3ZpZGVycy9tYXBjb25maWcucHJvdmlkZXIuanMiLCJzcmMvcHJvdmlkZXJzL21hcHV0aWxzLnNlcnZpY2UuanMiLCJzcmMvcHJvdmlkZXJzL21hcmtlcnMvZGVmYXVsdC5tYXJrZXIuanMiLCJzcmMvcHJvdmlkZXJzL21hcmtlcnMvZG9tLm1hcmtlci5qcyIsInNyYy9wcm92aWRlcnMvbWFya2Vycy9pbmRleC5qcyIsInNyYy9wcm92aWRlcnMvbWFya2Vycy9tYXJrZXIuanMiLCJzcmMvcHJvdmlkZXJzL21hcmtlcnMvbWFya2Vycy5zZXJ2aWNlLmpzIiwic3JjL3Byb3ZpZGVycy9tYXJrZXJzL3N2Zy5tYXJrZXIuanMiLCJzcmMvcHJvdmlkZXJzL3JvdXRlcy9pbmRleC5qcyIsInNyYy9wcm92aWRlcnMvcm91dGVzL3JvdXRlcy5zZXJ2aWNlLmpzIl0sIm5hbWVzIjpbXSwibWFwcGluZ3MiOiJBQUFBO0FDQUE7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBOztBQzdRQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7O0FDZEE7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7O0FDalVBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTs7QUNwRUE7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBOztBQzlHQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBOztBQzNGQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBOztBQ1ZBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7O0FDcEdBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTs7QUNqQkE7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7O0FDaEpBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTs7QUN2QkE7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTs7QUM5Q0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBOztBQ0xBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7O0FDbENBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7O0FDMUdBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7O0FDbENBO0FBQ0E7O0FDREE7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQSIsImZpbGUiOiJnZW5lcmF0ZWQuanMiLCJzb3VyY2VSb290IjoiIiwic291cmNlc0NvbnRlbnQiOlsiKGZ1bmN0aW9uIGUodCxuLHIpe2Z1bmN0aW9uIHMobyx1KXtpZighbltvXSl7aWYoIXRbb10pe3ZhciBhPXR5cGVvZiByZXF1aXJlPT1cImZ1bmN0aW9uXCImJnJlcXVpcmU7aWYoIXUmJmEpcmV0dXJuIGEobywhMCk7aWYoaSlyZXR1cm4gaShvLCEwKTt2YXIgZj1uZXcgRXJyb3IoXCJDYW5ub3QgZmluZCBtb2R1bGUgJ1wiK28rXCInXCIpO3Rocm93IGYuY29kZT1cIk1PRFVMRV9OT1RfRk9VTkRcIixmfXZhciBsPW5bb109e2V4cG9ydHM6e319O3Rbb11bMF0uY2FsbChsLmV4cG9ydHMsZnVuY3Rpb24oZSl7dmFyIG49dFtvXVsxXVtlXTtyZXR1cm4gcyhuP246ZSl9LGwsbC5leHBvcnRzLGUsdCxuLHIpfXJldHVybiBuW29dLmV4cG9ydHN9dmFyIGk9dHlwZW9mIHJlcXVpcmU9PVwiZnVuY3Rpb25cIiYmcmVxdWlyZTtmb3IodmFyIG89MDtvPHIubGVuZ3RoO28rKylzKHJbb10pO3JldHVybiBzfSkiLCJtb2R1bGUuZXhwb3J0cyA9IEhlcmVNYXBzRGlyZWN0aXZlO1xyXG5cclxuSGVyZU1hcHNEaXJlY3RpdmUuJGluamVjdCA9IFtcclxuICAgICckdGltZW91dCcsXHJcbiAgICAnJHdpbmRvdycsXHJcbiAgICAnJHJvb3RTY29wZScsXHJcbiAgICAnJGZpbHRlcicsXHJcbiAgICAnSGVyZU1hcHNDb25maWcnLFxyXG4gICAgJ0hlcmVNYXBzQVBJU2VydmljZScsXHJcbiAgICAnSGVyZU1hcHNVdGlsc1NlcnZpY2UnLFxyXG4gICAgJ0hlcmVNYXBzTWFya2VyU2VydmljZScsXHJcbiAgICAnSGVyZU1hcHNSb3V0ZXNTZXJ2aWNlJyxcclxuICAgICdIZXJlTWFwc0NPTlNUUycsXHJcbiAgICAnSGVyZU1hcHNFdmVudHNGYWN0b3J5JyxcclxuICAgICdIZXJlTWFwc1VpRmFjdG9yeSdcclxuXTtcclxuZnVuY3Rpb24gSGVyZU1hcHNEaXJlY3RpdmUoXHJcbiAgICAkdGltZW91dCxcclxuICAgICR3aW5kb3csXHJcbiAgICAkcm9vdFNjb3BlLFxyXG4gICAgJGZpbHRlcixcclxuICAgIEhlcmVNYXBzQ29uZmlnLFxyXG4gICAgSGVyZU1hcHNBUElTZXJ2aWNlLFxyXG4gICAgSGVyZU1hcHNVdGlsc1NlcnZpY2UsXHJcbiAgICBIZXJlTWFwc01hcmtlclNlcnZpY2UsXHJcbiAgICBIZXJlTWFwc1JvdXRlc1NlcnZpY2UsXHJcbiAgICBIZXJlTWFwc0NPTlNUUyxcclxuICAgIEhlcmVNYXBzRXZlbnRzRmFjdG9yeSxcclxuICAgIEhlcmVNYXBzVWlGYWN0b3J5KSB7XHJcblxyXG4gICAgSGVyZU1hcHNEaXJlY3RpdmVDdHJsLiRpbmplY3QgPSBbJyRzY29wZScsICckZWxlbWVudCcsICckYXR0cnMnXTtcclxuXHJcbiAgICByZXR1cm4ge1xyXG4gICAgICAgIHJlc3RyaWN0OiAnRUEnLFxyXG4gICAgICAgIHRlbXBsYXRlOiBcIjxkaXYgbmctc3R5bGU9XFxcInsnd2lkdGgnOiBtYXBXaWR0aCwgJ2hlaWdodCc6IG1hcEhlaWdodH1cXFwiPjwvZGl2PlwiLFxyXG4gICAgICAgIHJlcGxhY2U6IHRydWUsXHJcbiAgICAgICAgc2NvcGU6IHtcclxuICAgICAgICAgICAgb3B0czogJyZvcHRpb25zJyxcclxuICAgICAgICAgICAgcGxhY2VzOiAnJicsXHJcbiAgICAgICAgICAgIG9uTWFwUmVhZHk6IFwiJm1hcFJlYWR5XCIsXHJcbiAgICAgICAgICAgIGV2ZW50czogJyYnXHJcbiAgICAgICAgfSxcclxuICAgICAgICBjb250cm9sbGVyOiBIZXJlTWFwc0RpcmVjdGl2ZUN0cmxcclxuICAgIH1cclxuXHJcbiAgICBmdW5jdGlvbiBIZXJlTWFwc0RpcmVjdGl2ZUN0cmwoJHNjb3BlLCAkZWxlbWVudCwgJGF0dHJzKSB7XHJcbiAgICAgICAgdmFyIENPTlRST0xfTkFNRVMgPSBIZXJlTWFwc0NPTlNUUy5DT05UUk9MUy5OQU1FUyxcclxuICAgICAgICAgICAgcGxhY2VzID0gJHNjb3BlLnBsYWNlcygpLFxyXG4gICAgICAgICAgICBvcHRzID0gJHNjb3BlLm9wdHMoKSxcclxuICAgICAgICAgICAgbGlzdGVuZXJzID0gJHNjb3BlLmV2ZW50cygpO1xyXG5cclxuICAgICAgICB2YXIgb3B0aW9ucyA9IGFuZ3VsYXIuZXh0ZW5kKHt9LCBIZXJlTWFwc0NPTlNUUy5ERUZBVUxUX01BUF9PUFRJT05TLCBvcHRzKSxcclxuICAgICAgICAgICAgcG9zaXRpb24gPSBIZXJlTWFwc1V0aWxzU2VydmljZS5pc1ZhbGlkQ29vcmRzKG9wdGlvbnMuY29vcmRzKSA/XHJcbiAgICAgICAgICAgICAgICBvcHRpb25zLmNvb3JkcyA6IEhlcmVNYXBzQ09OU1RTLkRFRkFVTFRfTUFQX09QVElPTlMuY29vcmRzO1xyXG5cclxuICAgICAgICB2YXIgaGVyZW1hcHMgPSB7IGlkOiBIZXJlTWFwc1V0aWxzU2VydmljZS5nZW5lcmF0ZUlkKCkgfSxcclxuICAgICAgICAgICAgbWFwUmVhZHkgPSAkc2NvcGUub25NYXBSZWFkeSgpLFxyXG4gICAgICAgICAgICBfb25SZXNpemVNYXAgPSBudWxsO1xyXG5cclxuICAgICAgICAkdGltZW91dChmdW5jdGlvbiAoKSB7XHJcbiAgICAgICAgICAgIHJldHVybiBfc2V0TWFwU2l6ZSgpO1xyXG4gICAgICAgIH0pLnRoZW4oZnVuY3Rpb24gKCkge1xyXG4gICAgICAgICAgICBIZXJlTWFwc0FQSVNlcnZpY2UubG9hZEFwaSgpLnRoZW4oX2FwaVJlYWR5KTtcclxuICAgICAgICB9KTtcclxuXHJcbiAgICAgICAgb3B0aW9ucy5yZXNpemUgJiYgYWRkT25SZXNpemVMaXN0ZW5lcigpO1xyXG5cclxuICAgICAgICAkc2NvcGUuJG9uKCckZGVzdHJveScsIGZ1bmN0aW9uICgpIHtcclxuICAgICAgICAgICAgJHdpbmRvdy5yZW1vdmVFdmVudExpc3RlbmVyKCdyZXNpemUnLCBfb25SZXNpemVNYXApO1xyXG4gICAgICAgIH0pO1xyXG5cclxuICAgICAgICBmdW5jdGlvbiBhZGRPblJlc2l6ZUxpc3RlbmVyKCkge1xyXG4gICAgICAgICAgICBfb25SZXNpemVNYXAgPSBIZXJlTWFwc1V0aWxzU2VydmljZS50aHJvdHRsZShfcmVzaXplSGFuZGxlciwgSGVyZU1hcHNDT05TVFMuVVBEQVRFX01BUF9SRVNJWkVfVElNRU9VVCk7XHJcbiAgICAgICAgICAgICR3aW5kb3cuYWRkRXZlbnRMaXN0ZW5lcigncmVzaXplJywgX29uUmVzaXplTWFwKTtcclxuICAgICAgICB9XHJcblxyXG4gICAgICAgIGZ1bmN0aW9uIF9hcGlSZWFkeSgpIHtcclxuICAgICAgICAgICAgX3NldHVwTWFwUGxhdGZvcm0oKTtcclxuICAgICAgICAgICAgX3NldHVwTWFwKCk7XHJcbiAgICAgICAgfVxyXG5cclxuICAgICAgICBmdW5jdGlvbiBfc2V0dXBNYXBQbGF0Zm9ybSgpIHtcclxuICAgICAgICAgICAgaWYgKCFIZXJlTWFwc0NvbmZpZy5hcHBfaWQgfHwgIUhlcmVNYXBzQ29uZmlnLmFwcF9jb2RlKVxyXG4gICAgICAgICAgICAgICAgdGhyb3cgbmV3IEVycm9yKCdhcHBfaWQgb3IgYXBwX2NvZGUgd2VyZSBtaXNzZWQuIFBsZWFzZSBzcGVjaWZ5IHRoZWlyIGluIEhlcmVNYXBzQ29uZmlnJyk7XHJcblxyXG4gICAgICAgICAgICBoZXJlbWFwcy5wbGF0Zm9ybSA9IG5ldyBILnNlcnZpY2UuUGxhdGZvcm0oSGVyZU1hcHNDb25maWcpO1xyXG4gICAgICAgICAgICBoZXJlbWFwcy5sYXllcnMgPSBoZXJlbWFwcy5wbGF0Zm9ybS5jcmVhdGVEZWZhdWx0TGF5ZXJzKCk7XHJcbiAgICAgICAgfVxyXG5cclxuICAgICAgICBmdW5jdGlvbiBfZ2V0TG9jYXRpb24oZW5hYmxlSGlnaEFjY3VyYWN5LCBtYXhpbXVtQWdlKSB7XHJcbiAgICAgICAgICAgIHZhciBfZW5hYmxlSGlnaEFjY3VyYWN5ID0gISFlbmFibGVIaWdoQWNjdXJhY3ksXHJcbiAgICAgICAgICAgICAgICBfbWF4aW11bUFnZSA9IG1heGltdW1BZ2UgfHwgMDtcclxuXHJcbiAgICAgICAgICAgIHJldHVybiBIZXJlTWFwc0FQSVNlcnZpY2UuZ2V0UG9zaXRpb24oe1xyXG4gICAgICAgICAgICAgICAgZW5hYmxlSGlnaEFjY3VyYWN5OiBfZW5hYmxlSGlnaEFjY3VyYWN5LFxyXG4gICAgICAgICAgICAgICAgbWF4aW11bUFnZTogX21heGltdW1BZ2VcclxuICAgICAgICAgICAgfSk7XHJcbiAgICAgICAgfVxyXG5cclxuICAgICAgICBmdW5jdGlvbiBfbG9jYXRpb25GYWlsdXJlKCkge1xyXG4gICAgICAgICAgICBjb25zb2xlLmVycm9yKCdDYW4gbm90IGdldCBhIGdlbyBwb3NpdGlvbicpO1xyXG4gICAgICAgIH1cclxuXHJcbiAgICAgICAgZnVuY3Rpb24gX3NldHVwTWFwKCkge1xyXG4gICAgICAgICAgICBfaW5pdE1hcChmdW5jdGlvbiAoKSB7XHJcbiAgICAgICAgICAgICAgICBIZXJlTWFwc0FQSVNlcnZpY2UubG9hZE1vZHVsZXMoJGF0dHJzLiRhdHRyLCB7XHJcbiAgICAgICAgICAgICAgICAgICAgXCJjb250cm9sc1wiOiBfdWlNb2R1bGVSZWFkeSxcclxuICAgICAgICAgICAgICAgICAgICBcImV2ZW50c1wiOiBfZXZlbnRzTW9kdWxlUmVhZHlcclxuICAgICAgICAgICAgICAgIH0pO1xyXG4gICAgICAgICAgICB9KTtcclxuICAgICAgICB9XHJcblxyXG4gICAgICAgIGZ1bmN0aW9uIF9pbml0TWFwKGNiKSB7XHJcbiAgICAgICAgICAgIHZhciBtYXAgPSBoZXJlbWFwcy5tYXAgPSBuZXcgSC5NYXAoJGVsZW1lbnRbMF0sIGhlcmVtYXBzLmxheWVycy5ub3JtYWwubWFwLCB7XHJcbiAgICAgICAgICAgICAgICB6b29tOiBIZXJlTWFwc1V0aWxzU2VydmljZS5pc1ZhbGlkQ29vcmRzKHBvc2l0aW9uKSA/IG9wdGlvbnMuem9vbSA6IG9wdGlvbnMubWF4Wm9vbSxcclxuICAgICAgICAgICAgICAgIGNlbnRlcjogbmV3IEguZ2VvLlBvaW50KHBvc2l0aW9uLmxhdGl0dWRlLCBwb3NpdGlvbi5sb25naXR1ZGUpXHJcbiAgICAgICAgICAgIH0pO1xyXG5cclxuICAgICAgICAgICAgSGVyZU1hcHNNYXJrZXJTZXJ2aWNlLmFkZE1hcmtlcnNUb01hcChtYXAsIHBsYWNlcywgdHJ1ZSk7XHJcblxyXG4gICAgICAgICAgICBtYXBSZWFkeSAmJiBtYXBSZWFkeShNYXBQcm94eSgpKTtcclxuXHJcbiAgICAgICAgICAgIGNiICYmIGNiKCk7XHJcblxyXG4gICAgICAgIH1cclxuXHJcbiAgICAgICAgZnVuY3Rpb24gX3VpTW9kdWxlUmVhZHkoKSB7XHJcbiAgICAgICAgICAgIEhlcmVNYXBzVWlGYWN0b3J5LnN0YXJ0KHtcclxuICAgICAgICAgICAgICAgIHBsYXRmb3JtOiBoZXJlbWFwcyxcclxuICAgICAgICAgICAgICAgIGFsaWdubWVudDogJGF0dHJzLmNvbnRyb2xzXHJcbiAgICAgICAgICAgIH0pO1xyXG4gICAgICAgIH1cclxuXHJcbiAgICAgICAgZnVuY3Rpb24gX2V2ZW50c01vZHVsZVJlYWR5KCkge1xyXG4gICAgICAgICAgICBIZXJlTWFwc0V2ZW50c0ZhY3Rvcnkuc3RhcnQoe1xyXG4gICAgICAgICAgICAgICAgcGxhdGZvcm06IGhlcmVtYXBzLFxyXG4gICAgICAgICAgICAgICAgbGlzdGVuZXJzOiBsaXN0ZW5lcnMsXHJcbiAgICAgICAgICAgICAgICBvcHRpb25zOiBvcHRpb25zLFxyXG4gICAgICAgICAgICAgICAgaW5qZWN0b3I6IF9tb2R1bGVJbmplY3RvclxyXG4gICAgICAgICAgICB9KTtcclxuICAgICAgICB9XHJcblxyXG4gICAgICAgIGZ1bmN0aW9uIF9tb2R1bGVJbmplY3RvcigpIHtcclxuICAgICAgICAgICAgcmV0dXJuIGZ1bmN0aW9uIChpZCkge1xyXG4gICAgICAgICAgICAgICAgcmV0dXJuIGhlcmVtYXBzW2lkXTtcclxuICAgICAgICAgICAgfVxyXG4gICAgICAgIH1cclxuXHJcbiAgICAgICAgZnVuY3Rpb24gX3Jlc2l6ZUhhbmRsZXIoaGVpZ2h0LCB3aWR0aCkge1xyXG4gICAgICAgICAgICBfc2V0TWFwU2l6ZS5hcHBseShudWxsLCBhcmd1bWVudHMpO1xyXG5cclxuICAgICAgICAgICAgaGVyZW1hcHMubWFwLmdldFZpZXdQb3J0KCkucmVzaXplKCk7XHJcbiAgICAgICAgfVxyXG5cclxuICAgICAgICBmdW5jdGlvbiBfc2V0TWFwU2l6ZShoZWlnaHQsIHdpZHRoKSB7XHJcbiAgICAgICAgICAgIHZhciBoZWlnaHQgPSBoZWlnaHQgfHwgJGVsZW1lbnRbMF0ucGFyZW50Tm9kZS5vZmZzZXRIZWlnaHQgfHwgb3B0aW9ucy5oZWlnaHQsXHJcbiAgICAgICAgICAgICAgICB3aWR0aCA9IHdpZHRoIHx8ICRlbGVtZW50WzBdLnBhcmVudE5vZGUub2Zmc2V0V2lkdGggfHwgb3B0aW9ucy53aWR0aDtcclxuXHJcbiAgICAgICAgICAgICRzY29wZS5tYXBIZWlnaHQgPSBoZWlnaHQgKyAncHgnO1xyXG4gICAgICAgICAgICAkc2NvcGUubWFwV2lkdGggPSB3aWR0aCArICdweCc7XHJcblxyXG4gICAgICAgICAgICBIZXJlTWFwc1V0aWxzU2VydmljZS5ydW5TY29wZURpZ2VzdElmTmVlZCgkc2NvcGUpO1xyXG4gICAgICAgIH1cclxuXHJcbiAgICAgICAgZnVuY3Rpb24gTWFwUHJveHkoKSB7XHJcbiAgICAgICAgICAgIHJldHVybiB7XHJcbiAgICAgICAgICAgICAgICByZWZyZXNoOiBmdW5jdGlvbiAoKSB7XHJcbiAgICAgICAgICAgICAgICAgICAgdmFyIGN1cnJlbnRCb3VuZHMgPSB0aGlzLmdldFZpZXdCb3VuZHMoKTtcclxuXHJcbiAgICAgICAgICAgICAgICAgICAgdGhpcy5zZXRNYXBTaXplcygpO1xyXG4gICAgICAgICAgICAgICAgICAgIHRoaXMuc2V0Vmlld0JvdW5kcyhjdXJyZW50Qm91bmRzKTtcclxuICAgICAgICAgICAgICAgIH0sXHJcbiAgICAgICAgICAgICAgICBzZXRNYXBTaXplczogZnVuY3Rpb24gKGhlaWdodCwgd2lkdGgpIHtcclxuICAgICAgICAgICAgICAgICAgICBfcmVzaXplSGFuZGxlci5hcHBseShudWxsLCBhcmd1bWVudHMpO1xyXG4gICAgICAgICAgICAgICAgfSxcclxuICAgICAgICAgICAgICAgIGdldFBsYXRmb3JtOiBmdW5jdGlvbiAoKSB7XHJcbiAgICAgICAgICAgICAgICAgICAgcmV0dXJuIGhlcmVtYXBzO1xyXG4gICAgICAgICAgICAgICAgfSxcclxuICAgICAgICAgICAgICAgIGNhbGN1bGF0ZVJvdXRlOiBmdW5jdGlvbiAoZHJpdmVUeXBlLCBkaXJlY3Rpb24pIHtcclxuICAgICAgICAgICAgICAgICAgICByZXR1cm4gSGVyZU1hcHNSb3V0ZXNTZXJ2aWNlLmNhbGN1bGF0ZVJvdXRlKGhlcmVtYXBzLCB7XHJcbiAgICAgICAgICAgICAgICAgICAgICAgIGRyaXZlVHlwZTogZHJpdmVUeXBlLFxyXG4gICAgICAgICAgICAgICAgICAgICAgICBkaXJlY3Rpb246IGRpcmVjdGlvblxyXG4gICAgICAgICAgICAgICAgICAgIH0pO1xyXG4gICAgICAgICAgICAgICAgfSxcclxuICAgICAgICAgICAgICAgIGFkZFJvdXRlVG9NYXA6IGZ1bmN0aW9uIChyb3V0ZURhdGEsIGNsZWFuKSB7XHJcbiAgICAgICAgICAgICAgICAgICAgSGVyZU1hcHNSb3V0ZXNTZXJ2aWNlLmFkZFJvdXRlVG9NYXAoaGVyZW1hcHMubWFwLCByb3V0ZURhdGEsIGNsZWFuKTtcclxuICAgICAgICAgICAgICAgIH0sXHJcbiAgICAgICAgICAgICAgICBzZXRab29tOiBmdW5jdGlvbiAoem9vbSwgc3RlcCkge1xyXG4gICAgICAgICAgICAgICAgICAgIEhlcmVNYXBzVXRpbHNTZXJ2aWNlLnpvb20oaGVyZW1hcHMubWFwLCB6b29tIHx8IDEwLCBzdGVwKTtcclxuICAgICAgICAgICAgICAgIH0sXHJcbiAgICAgICAgICAgICAgICBnZXRab29tOiBmdW5jdGlvbiAoKSB7XHJcbiAgICAgICAgICAgICAgICAgICAgcmV0dXJuIGhlcmVtYXBzLm1hcC5nZXRab29tKCk7XHJcbiAgICAgICAgICAgICAgICB9LFxyXG4gICAgICAgICAgICAgICAgZ2V0Q2VudGVyOiBmdW5jdGlvbiAoKSB7XHJcbiAgICAgICAgICAgICAgICAgICAgcmV0dXJuIGhlcmVtYXBzLm1hcC5nZXRDZW50ZXIoKTtcclxuICAgICAgICAgICAgICAgIH0sXHJcbiAgICAgICAgICAgICAgICBnZXRWaWV3Qm91bmRzOiBmdW5jdGlvbiAoKSB7XHJcbiAgICAgICAgICAgICAgICAgICAgcmV0dXJuIGhlcmVtYXBzLm1hcC5nZXRWaWV3Qm91bmRzKCk7XHJcbiAgICAgICAgICAgICAgICB9LFxyXG4gICAgICAgICAgICAgICAgc2V0Vmlld0JvdW5kczogZnVuY3Rpb24gKGJvdW5kaW5nUmVjdCwgb3B0X2FuaW1hdGUpIHtcclxuICAgICAgICAgICAgICAgICAgICBIZXJlTWFwc01hcmtlclNlcnZpY2Uuc2V0Vmlld0JvdW5kcyhoZXJlbWFwcy5tYXAsIGJvdW5kaW5nUmVjdCwgb3B0X2FuaW1hdGUpO1xyXG4gICAgICAgICAgICAgICAgfSxcclxuICAgICAgICAgICAgICAgIGdldEJvdW5kc1JlY3RGcm9tUG9pbnRzOiBmdW5jdGlvbiAodG9wTGVmdCwgYm90dG9tUmlnaHQpIHtcclxuICAgICAgICAgICAgICAgICAgICByZXR1cm4gSGVyZU1hcHNVdGlsc1NlcnZpY2UuZ2V0Qm91bmRzUmVjdEZyb21Qb2ludHMuYXBwbHkobnVsbCwgYXJndW1lbnRzKTtcclxuICAgICAgICAgICAgICAgIH0sXHJcbiAgICAgICAgICAgICAgICBzZXRDZW50ZXI6IGZ1bmN0aW9uIChjb29yZHMpIHtcclxuICAgICAgICAgICAgICAgICAgICBpZiAoIWNvb3Jkcykge1xyXG4gICAgICAgICAgICAgICAgICAgICAgICByZXR1cm4gY29uc29sZS5lcnJvcignY29vcmRzIGFyZSBub3Qgc3BlY2lmaWVkIScpO1xyXG4gICAgICAgICAgICAgICAgICAgIH1cclxuXHJcbiAgICAgICAgICAgICAgICAgICAgaGVyZW1hcHMubWFwLnNldENlbnRlcihjb29yZHMpO1xyXG4gICAgICAgICAgICAgICAgfSxcclxuICAgICAgICAgICAgICAgIGNsZWFuUm91dGVzOiBmdW5jdGlvbiAoKSB7XHJcbiAgICAgICAgICAgICAgICAgICAgSGVyZU1hcHNSb3V0ZXNTZXJ2aWNlLmNsZWFuUm91dGVzKGhlcmVtYXBzLm1hcCk7XHJcbiAgICAgICAgICAgICAgICB9LFxyXG5cclxuICAgICAgICAgICAgICAgIC8qKlxyXG4gICAgICAgICAgICAgICAgICogQHBhcmFtIHtCb29sZWFufSBlbmFibGVIaWdoQWNjdXJhY3lcclxuICAgICAgICAgICAgICAgICAqIEBwYXJhbSB7TnVtYmVyfSBtYXhpbXVtQWdlIC0gdGhlIG1heGltdW0gYWdlIGluIG1pbGxpc2Vjb25kcyBvZiBhIHBvc3NpYmxlIGNhY2hlZCBwb3NpdGlvbiB0aGF0IGlzIGFjY2VwdGFibGUgdG8gcmV0dXJuLiBJZiBzZXQgdG8gMCwgaXQgbWVhbnMgdGhhdCB0aGUgZGV2aWNlIGNhbm5vdCB1c2UgYSBjYWNoZWQgcG9zaXRpb24gYW5kIG11c3QgYXR0ZW1wdCB0byByZXRyaWV2ZSB0aGUgcmVhbCBjdXJyZW50IHBvc2l0aW9uXHJcbiAgICAgICAgICAgICAgICAgKiBAcmV0dXJuIHtQcm9taXNlfVxyXG4gICAgICAgICAgICAgICAgICovXHJcbiAgICAgICAgICAgICAgICBnZXRVc2VyTG9jYXRpb246IGZ1bmN0aW9uIChlbmFibGVIaWdoQWNjdXJhY3ksIG1heGltdW1BZ2UpIHtcclxuICAgICAgICAgICAgICAgICAgICByZXR1cm4gX2dldExvY2F0aW9uLmFwcGx5KG51bGwsIGFyZ3VtZW50cykudGhlbihmdW5jdGlvbiAocG9zaXRpb24pIHtcclxuICAgICAgICAgICAgICAgICAgICAgICAgdmFyIGNvb3JkcyA9IHBvc2l0aW9uLmNvb3JkcztcclxuXHJcbiAgICAgICAgICAgICAgICAgICAgICAgIHJldHVybiB7XHJcbiAgICAgICAgICAgICAgICAgICAgICAgICAgICBsYXQ6IGNvb3Jkcy5sYXRpdHVkZSxcclxuICAgICAgICAgICAgICAgICAgICAgICAgICAgIGxuZzogY29vcmRzLmxvbmdpdHVkZVxyXG4gICAgICAgICAgICAgICAgICAgICAgICB9O1xyXG4gICAgICAgICAgICAgICAgICAgIH0pXHJcbiAgICAgICAgICAgICAgICB9LFxyXG4gICAgICAgICAgICAgICAgZ2VvY29kZVBvc2l0aW9uOiBmdW5jdGlvbiAoY29vcmRzLCBvcHRpb25zKSB7XHJcbiAgICAgICAgICAgICAgICAgICAgcmV0dXJuIEhlcmVNYXBzQVBJU2VydmljZS5nZW9jb2RlUG9zaXRpb24oaGVyZW1hcHMucGxhdGZvcm0sIHtcclxuICAgICAgICAgICAgICAgICAgICAgICAgY29vcmRzOiBjb29yZHMsXHJcbiAgICAgICAgICAgICAgICAgICAgICAgIHJhZGl1czogb3B0aW9ucyAmJiBvcHRpb25zLnJhZGl1cyxcclxuICAgICAgICAgICAgICAgICAgICAgICAgbGFuZzogb3B0aW9ucyAmJiBvcHRpb25zLmxhbmdcclxuICAgICAgICAgICAgICAgICAgICB9KTtcclxuICAgICAgICAgICAgICAgIH0sXHJcbiAgICAgICAgICAgICAgICBnZW9jb2RlQWRkcmVzczogZnVuY3Rpb24gKGFkZHJlc3MpIHtcclxuICAgICAgICAgICAgICAgICAgICByZXR1cm4gSGVyZU1hcHNBUElTZXJ2aWNlLmdlb2NvZGVBZGRyZXNzKGhlcmVtYXBzLnBsYXRmb3JtLCB7XHJcbiAgICAgICAgICAgICAgICAgICAgICAgIHNlYXJjaHRleHQ6IGFkZHJlc3MgJiYgYWRkcmVzcy5zZWFyY2h0ZXh0LFxyXG4gICAgICAgICAgICAgICAgICAgICAgICBjb3VudHJ5OiBhZGRyZXNzICYmIGFkZHJlc3MuY291bnRyeSxcclxuICAgICAgICAgICAgICAgICAgICAgICAgY2l0eTogYWRkcmVzcyAmJiBhZGRyZXNzLmNpdHksXHJcbiAgICAgICAgICAgICAgICAgICAgICAgIHN0cmVldDogYWRkcmVzcyAmJiBhZGRyZXNzLnN0cmVldCxcclxuICAgICAgICAgICAgICAgICAgICAgICAgaG91c2VudW1iZXI6IGFkZHJlc3MgJiYgYWRkcmVzcy5ob3VzZW51bWJlclxyXG4gICAgICAgICAgICAgICAgICAgIH0pO1xyXG4gICAgICAgICAgICAgICAgfSxcclxuICAgICAgICAgICAgICAgIGdlb2NvZGVBdXRvY29tcGxldGU6IGZ1bmN0aW9uIChxdWVyeSwgb3B0aW9ucykge1xyXG4gICAgICAgICAgICAgICAgICAgIHJldHVybiBIZXJlTWFwc0FQSVNlcnZpY2UuZ2VvY29kZUF1dG9jb21wbGV0ZSh7XHJcbiAgICAgICAgICAgICAgICAgICAgICAgIHF1ZXJ5OiBxdWVyeSxcclxuICAgICAgICAgICAgICAgICAgICAgICAgYmVnaW5IaWdobGlnaHQ6IG9wdGlvbnMgJiYgb3B0aW9ucy5iZWdpbkhpZ2hsaWdodCxcclxuICAgICAgICAgICAgICAgICAgICAgICAgZW5kSGlnaGxpZ2h0OiBvcHRpb25zICYmIG9wdGlvbnMuZW5kSGlnaGxpZ2h0LFxyXG4gICAgICAgICAgICAgICAgICAgICAgICBtYXhyZXN1bHRzOiBvcHRpb25zICYmIG9wdGlvbnMubWF4cmVzdWx0c1xyXG4gICAgICAgICAgICAgICAgICAgIH0pO1xyXG4gICAgICAgICAgICAgICAgfSxcclxuICAgICAgICAgICAgICAgIGZpbmRMb2NhdGlvbkJ5SWQ6IGZ1bmN0aW9uIChsb2NhdGlvbklkKSB7XHJcbiAgICAgICAgICAgICAgICAgICAgcmV0dXJuIEhlcmVNYXBzQVBJU2VydmljZS5maW5kTG9jYXRpb25CeUlkKGxvY2F0aW9uSWQpO1xyXG4gICAgICAgICAgICAgICAgfSxcclxuICAgICAgICAgICAgICAgIHVwZGF0ZU1hcmtlcnM6IGZ1bmN0aW9uIChwbGFjZXMsIHJlZnJlc2hWaWV3Ym91bmRzKSB7XHJcbiAgICAgICAgICAgICAgICAgICAgSGVyZU1hcHNNYXJrZXJTZXJ2aWNlLnVwZGF0ZU1hcmtlcnMoaGVyZW1hcHMubWFwLCBwbGFjZXMsIHJlZnJlc2hWaWV3Ym91bmRzKTtcclxuICAgICAgICAgICAgICAgIH0sXHJcbiAgICAgICAgICAgICAgICBnZXRNYXBGYWN0b3J5OiBmdW5jdGlvbiAoKXtcclxuICAgICAgICAgICAgICAgICAgICByZXR1cm4gSGVyZU1hcHNVdGlsc1NlcnZpY2UuZ2V0TWFwRmFjdG9yeSgpO1xyXG4gICAgICAgICAgICAgICAgfVxyXG4gICAgICAgICAgICB9XHJcbiAgICAgICAgfVxyXG5cclxuICAgIH1cclxufTtcclxuIiwicmVxdWlyZSgnLi9wcm92aWRlcnMvbWFya2VycycpO1xyXG5yZXF1aXJlKCcuL3Byb3ZpZGVycy9tYXAtbW9kdWxlcycpO1xyXG5yZXF1aXJlKCcuL3Byb3ZpZGVycy9yb3V0ZXMnKTtcclxuXHJcbm1vZHVsZS5leHBvcnRzID0gYW5ndWxhci5tb2R1bGUoJ2hlcmVtYXBzJywgW1xyXG4gICAgJ2hlcmVtYXBzLW1hcmtlcnMtbW9kdWxlJyxcclxuICAgICdoZXJlbWFwcy1yb3V0ZXMtbW9kdWxlJyxcclxuICAgICdoZXJlbWFwcy1tYXAtbW9kdWxlcydcclxuXSlcclxuICAgIC5wcm92aWRlcignSGVyZU1hcHNDb25maWcnLCByZXF1aXJlKCcuL3Byb3ZpZGVycy9tYXBjb25maWcucHJvdmlkZXInKSlcclxuICAgIC5zZXJ2aWNlKCdIZXJlTWFwc1V0aWxzU2VydmljZScsIHJlcXVpcmUoJy4vcHJvdmlkZXJzL21hcHV0aWxzLnNlcnZpY2UnKSlcclxuICAgIC5zZXJ2aWNlKCdIZXJlTWFwc0FQSVNlcnZpY2UnLCByZXF1aXJlKCcuL3Byb3ZpZGVycy9hcGkuc2VydmljZScpKVxyXG4gICAgLmNvbnN0YW50KCdIZXJlTWFwc0NPTlNUUycsIHJlcXVpcmUoJy4vcHJvdmlkZXJzL2NvbnN0cycpKVxyXG4gICAgLmRpcmVjdGl2ZSgnaGVyZW1hcHMnLCByZXF1aXJlKCcuL2hlcmVtYXBzLmRpcmVjdGl2ZScpKTtcclxuIiwibW9kdWxlLmV4cG9ydHMgPSBIZXJlTWFwc0FQSVNlcnZpY2U7XHJcblxyXG5IZXJlTWFwc0FQSVNlcnZpY2UuJGluamVjdCA9IFtcclxuICAgICckcScsXHJcbiAgICAnJGh0dHAnLFxyXG4gICAgJ0hlcmVNYXBzQ29uZmlnJyxcclxuICAgICdIZXJlTWFwc1V0aWxzU2VydmljZScsXHJcbiAgICAnSGVyZU1hcHNDT05TVFMnXHJcbl07XHJcbmZ1bmN0aW9uIEhlcmVNYXBzQVBJU2VydmljZSgkcSwgJGh0dHAsIEhlcmVNYXBzQ29uZmlnLCBIZXJlTWFwc1V0aWxzU2VydmljZSwgSGVyZU1hcHNDT05TVFMpIHtcclxuICAgIHZhciB2ZXJzaW9uID0gSGVyZU1hcHNDb25maWcuYXBpVmVyc2lvbixcclxuICAgICAgICBwcm90b2NvbCA9IEhlcmVNYXBzQ29uZmlnLnVzZUhUVFBTID8gJ2h0dHBzJyA6ICdodHRwJztcclxuXHJcbiAgICB2YXIgQVBJX1ZFUlNJT04gPSB7XHJcbiAgICAgICAgVjogcGFyc2VJbnQodmVyc2lvbiksXHJcbiAgICAgICAgU1VCOiB2ZXJzaW9uXHJcbiAgICB9O1xyXG5cclxuICAgIHZhciBDT05GSUcgPSB7XHJcbiAgICAgICAgQkFTRTogXCI6Ly9qcy5hcGkuaGVyZS5jb20vdlwiLFxyXG4gICAgICAgIENPUkU6IFwibWFwc2pzLWNvcmUuanNcIixcclxuICAgICAgICBTRVJWSUNFOiBcIm1hcHNqcy1zZXJ2aWNlLmpzXCIsXHJcbiAgICAgICAgVUk6IHtcclxuICAgICAgICAgICAgc3JjOiBcIm1hcHNqcy11aS5qc1wiLFxyXG4gICAgICAgICAgICBocmVmOiBcIm1hcHNqcy11aS5jc3NcIlxyXG4gICAgICAgIH0sXHJcbiAgICAgICAgRVZFTlRTOiBcIm1hcHNqcy1tYXBldmVudHMuanNcIixcclxuICAgICAgICBBVVRPQ09NUExFVEVfVVJMOiBcIjovL2F1dG9jb21wbGV0ZS5nZW9jb2Rlci5jaXQuYXBpLmhlcmUuY29tLzYuMi9zdWdnZXN0Lmpzb25cIixcclxuICAgICAgICBMT0NBVElPTl9VUkw6IFwiOi8vZ2VvY29kZXIuY2l0LmFwaS5oZXJlLmNvbS82LjIvZ2VvY29kZS5qc29uXCJcclxuICAgIH07XHJcblxyXG4gICAgdmFyIEFQSV9ERUZFUlNRdWV1ZSA9IHt9O1xyXG5cclxuICAgIEFQSV9ERUZFUlNRdWV1ZVtDT05GSUcuQ09SRV0gPSBbXTtcclxuICAgIEFQSV9ERUZFUlNRdWV1ZVtDT05GSUcuU0VSVklDRV0gPSBbXTtcclxuICAgIEFQSV9ERUZFUlNRdWV1ZVtDT05GSUcuVUkuc3JjXSA9IFtdO1xyXG4gICAgQVBJX0RFRkVSU1F1ZXVlW0NPTkZJRy5QQU5PXSA9IFtdO1xyXG4gICAgQVBJX0RFRkVSU1F1ZXVlW0NPTkZJRy5FVkVOVFNdID0gW107XHJcblxyXG4gICAgdmFyIGhlYWQgPSBkb2N1bWVudC5nZXRFbGVtZW50c0J5VGFnTmFtZSgnaGVhZCcpWzBdO1xyXG5cclxuICAgIHJldHVybiB7XHJcbiAgICAgICAgbG9hZEFwaTogbG9hZEFwaSxcclxuICAgICAgICBsb2FkTW9kdWxlczogbG9hZE1vZHVsZXMsXHJcbiAgICAgICAgZ2V0UG9zaXRpb246IGdldFBvc2l0aW9uLFxyXG4gICAgICAgIGdlb2NvZGVQb3NpdGlvbjogZ2VvY29kZVBvc2l0aW9uLFxyXG4gICAgICAgIGdlb2NvZGVBZGRyZXNzOiBnZW9jb2RlQWRkcmVzcyxcclxuICAgICAgICBnZW9jb2RlQXV0b2NvbXBsZXRlOiBnZW9jb2RlQXV0b2NvbXBsZXRlLFxyXG4gICAgICAgIGZpbmRMb2NhdGlvbkJ5SWQ6IGZpbmRMb2NhdGlvbkJ5SWRcclxuICAgIH07XHJcblxyXG4gICAgLy8jcmVnaW9uIFBVQkxJQ1xyXG4gICAgZnVuY3Rpb24gbG9hZEFwaSgpIHtcclxuICAgICAgICByZXR1cm4gX2dldExvYWRlcihDT05GSUcuQ09SRSlcclxuICAgICAgICAgICAgLnRoZW4oZnVuY3Rpb24gKCkge1xyXG4gICAgICAgICAgICAgICAgcmV0dXJuIF9nZXRMb2FkZXIoQ09ORklHLlNFUlZJQ0UpO1xyXG4gICAgICAgICAgICB9KTtcclxuICAgIH1cclxuXHJcbiAgICBmdW5jdGlvbiBsb2FkTW9kdWxlcyhhdHRycywgaGFuZGxlcnMpIHtcclxuICAgICAgICBmb3IgKHZhciBrZXkgaW4gaGFuZGxlcnMpIHtcclxuICAgICAgICAgICAgaWYgKCFoYW5kbGVycy5oYXNPd25Qcm9wZXJ0eShrZXkpIHx8ICFhdHRyc1trZXldKVxyXG4gICAgICAgICAgICAgICAgY29udGludWU7XHJcblxyXG4gICAgICAgICAgICB2YXIgbG9hZGVyID0gX2dldExvYWRlckJ5QXR0cihrZXkpO1xyXG5cclxuICAgICAgICAgICAgbG9hZGVyKClcclxuICAgICAgICAgICAgICAgIC50aGVuKGhhbmRsZXJzW2tleV0pO1xyXG4gICAgICAgIH1cclxuICAgIH1cclxuXHJcbiAgICBmdW5jdGlvbiBnZXRQb3NpdGlvbihvcHRpb25zKSB7XHJcbiAgICAgICAgdmFyIGRlZmVycmVkID0gJHEuZGVmZXIoKTtcclxuXHJcbiAgICAgICAgaWYgKG9wdGlvbnMgJiYgSGVyZU1hcHNVdGlsc1NlcnZpY2UuaXNWYWxpZENvb3JkcyhvcHRpb25zLmNvb3JkcykpIHtcclxuICAgICAgICAgICAgZGVmZXJyZWQucmVzb2x2ZSh7IGNvb3Jkczogb3B0aW9ucy5jb29yZHMgfSk7XHJcbiAgICAgICAgfSBlbHNlIHtcclxuICAgICAgICAgICAgbmF2aWdhdG9yLmdlb2xvY2F0aW9uLmdldEN1cnJlbnRQb3NpdGlvbihmdW5jdGlvbiAocmVzcG9uc2UpIHtcclxuICAgICAgICAgICAgICAgIGRlZmVycmVkLnJlc29sdmUocmVzcG9uc2UpO1xyXG4gICAgICAgICAgICB9LCBmdW5jdGlvbiAoZXJyb3IpIHtcclxuICAgICAgICAgICAgICAgIGRlZmVycmVkLnJlamVjdChlcnJvcik7XHJcbiAgICAgICAgICAgIH0sIG9wdGlvbnMpO1xyXG4gICAgICAgIH1cclxuXHJcbiAgICAgICAgcmV0dXJuIGRlZmVycmVkLnByb21pc2U7XHJcbiAgICB9XHJcblxyXG4gICAgZnVuY3Rpb24gZ2VvY29kZVBvc2l0aW9uKHBsYXRmb3JtLCBwYXJhbXMpIHtcclxuICAgICAgICBpZiAoIXBhcmFtcy5jb29yZHMpXHJcbiAgICAgICAgICAgIHJldHVybiBjb25zb2xlLmVycm9yKCdNaXNzZWQgcmVxdWlyZWQgY29vcmRzJyk7XHJcblxyXG4gICAgICAgIHZhciBnZW9jb2RlciA9IHBsYXRmb3JtLmdldEdlb2NvZGluZ1NlcnZpY2UoKSxcclxuICAgICAgICAgICAgZGVmZXJyZWQgPSAkcS5kZWZlcigpLFxyXG4gICAgICAgICAgICBfcGFyYW1zID0ge1xyXG4gICAgICAgICAgICAgICAgcHJveDogW3BhcmFtcy5jb29yZHMubGF0LCBwYXJhbXMuY29vcmRzLmxuZywgcGFyYW1zLnJhZGl1cyB8fCAyNTBdLmpvaW4oJywnKSxcclxuICAgICAgICAgICAgICAgIG1vZGU6ICdyZXRyaWV2ZUFkZHJlc3NlcycsXHJcbiAgICAgICAgICAgICAgICBtYXhyZXN1bHRzOiAnMScsXHJcbiAgICAgICAgICAgICAgICBnZW46ICc4JyxcclxuICAgICAgICAgICAgICAgIGxhbmd1YWdlOiBwYXJhbXMubGFuZyB8fCAnZW4tZ2InXHJcbiAgICAgICAgICAgIH07XHJcblxyXG4gICAgICAgIGdlb2NvZGVyLnJldmVyc2VHZW9jb2RlKF9wYXJhbXMsIGZ1bmN0aW9uIChyZXNwb25zZSkge1xyXG4gICAgICAgICAgICBkZWZlcnJlZC5yZXNvbHZlKHJlc3BvbnNlKVxyXG4gICAgICAgIH0sIGZ1bmN0aW9uIChlcnJvcikge1xyXG4gICAgICAgICAgICBkZWZlcnJlZC5yZWplY3QoZXJyb3IpXHJcbiAgICAgICAgfSk7XHJcbiAgICAgICAgXHJcbiAgICAgICAgcmV0dXJuIGRlZmVycmVkLnByb21pc2U7XHJcbiAgICB9XHJcblxyXG4gICAgZnVuY3Rpb24gZ2VvY29kZUFkZHJlc3MocGxhdGZvcm0sIHBhcmFtcykge1xyXG4gICAgICAgIGlmICghcGFyYW1zKVxyXG4gICAgICAgICAgICByZXR1cm4gY29uc29sZS5lcnJvcignTWlzc2VkIHJlcXVpcmVkIHBhcmFtZXRlcnMnKTtcclxuXHJcbiAgICAgICAgdmFyIGdlb2NvZGVyID0gcGxhdGZvcm0uZ2V0R2VvY29kaW5nU2VydmljZSgpLFxyXG4gICAgICAgICAgICBkZWZlcnJlZCA9ICRxLmRlZmVyKCksXHJcbiAgICAgICAgICAgIF9wYXJhbXMgPSB7IGdlbjogOCB9O1xyXG5cclxuICAgICAgICBmb3IgKHZhciBrZXkgaW4gcGFyYW1zKSB7IF9wYXJhbXNba2V5XSA9IHBhcmFtc1trZXldOyB9XHJcblxyXG4gICAgICAgIGdlb2NvZGVyLmdlb2NvZGUoX3BhcmFtcywgZnVuY3Rpb24gKHJlc3BvbnNlKSB7XHJcbiAgICAgICAgICAgIGRlZmVycmVkLnJlc29sdmUocmVzcG9uc2UpXHJcbiAgICAgICAgfSwgZnVuY3Rpb24gKGVycm9yKSB7XHJcbiAgICAgICAgICAgIGRlZmVycmVkLnJlamVjdChlcnJvcilcclxuICAgICAgICB9KTtcclxuXHJcbiAgICAgICAgcmV0dXJuIGRlZmVycmVkLnByb21pc2U7XHJcbiAgICB9XHJcblxyXG4gICAgZnVuY3Rpb24gZ2VvY29kZUF1dG9jb21wbGV0ZShwYXJhbXMpIHtcclxuICAgICAgICBpZiAoIXBhcmFtcylcclxuICAgICAgICAgICAgcmV0dXJuIGNvbnNvbGUuZXJyb3IoJ01pc3NpbmcgcmVxdWlyZWQgcGFyYW1ldGVycycpO1xyXG5cclxuICAgICAgICB2YXIgYXV0b2NvbXBsZXRlVXJsID0gcHJvdG9jb2wgKyBDT05GSUcuQVVUT0NPTVBMRVRFX1VSTCxcclxuICAgICAgICAgICAgZGVmZXJyZWQgPSAkcS5kZWZlcigpLFxyXG4gICAgICAgICAgICBfcGFyYW1zID0ge1xyXG4gICAgICAgICAgICAgICAgcXVlcnk6IFwiXCIsXHJcbiAgICAgICAgICAgICAgICBiZWdpbkhpZ2hsaWdodDogXCI8bWFyaz5cIixcclxuICAgICAgICAgICAgICAgIGVuZEhpZ2hsaWdodDogXCI8L21hcms+XCIsXHJcbiAgICAgICAgICAgICAgICBtYXhyZXN1bHRzOiBcIjVcIlxyXG4gICAgICAgICAgICB9O1xyXG5cclxuICAgICAgICBmb3IgKHZhciBrZXkgaW4gX3BhcmFtcykge1xyXG4gICAgICAgICAgICBpZiAoYW5ndWxhci5pc0RlZmluZWQocGFyYW1zW2tleV0pKSB7XHJcbiAgICAgICAgICAgICAgICBfcGFyYW1zW2tleV0gPSBwYXJhbXNba2V5XTtcclxuICAgICAgICAgICAgfVxyXG4gICAgICAgIH1cclxuXHJcbiAgICAgICAgX3BhcmFtcy5hcHBfaWQgPSBIZXJlTWFwc0NvbmZpZy5hcHBfaWQ7XHJcbiAgICAgICAgX3BhcmFtcy5hcHBfY29kZSA9IEhlcmVNYXBzQ29uZmlnLmFwcF9jb2RlO1xyXG5cclxuICAgICAgICAkaHR0cC5nZXQoYXV0b2NvbXBsZXRlVXJsLCB7IHBhcmFtczogX3BhcmFtcyB9KVxyXG4gICAgICAgICAgICAuc3VjY2VzcyhmdW5jdGlvbihyZXNwb25zZSkge1xyXG4gICAgICAgICAgICAgICAgZGVmZXJyZWQucmVzb2x2ZShyZXNwb25zZSk7XHJcbiAgICAgICAgICAgIH0pXHJcbiAgICAgICAgICAgIC5lcnJvcihmdW5jdGlvbihlcnJvcikge1xyXG4gICAgICAgICAgICAgICAgZGVmZXJyZWQucmVqZWN0KGVycm9yKTtcclxuICAgICAgICAgICAgfSk7XHJcblxyXG4gICAgICAgIHJldHVybiBkZWZlcnJlZC5wcm9taXNlO1xyXG4gICAgfVxyXG5cclxuICAgIC8qKlxyXG4gICAgICogRmluZHMgbG9jYXRpb24gYnkgSEVSRSBNYXBzIExvY2F0aW9uIGlkZW50aWZpZXIuXHJcbiAgICAgKi9cclxuICAgIGZ1bmN0aW9uIGZpbmRMb2NhdGlvbkJ5SWQobG9jYXRpb25JZCkge1xyXG4gICAgICAgIGlmICghbG9jYXRpb25JZClcclxuICAgICAgICAgICAgcmV0dXJuIGNvbnNvbGUuZXJyb3IoJ01pc3NpbmcgTG9jYXRpb24gSWRlbnRpZmllcicpO1xyXG5cclxuICAgICAgICB2YXIgbG9jYXRpb25VcmwgPSBwcm90b2NvbCArIENPTkZJRy5MT0NBVElPTl9VUkwsXHJcbiAgICAgICAgICAgIGRlZmVycmVkID0gJHEuZGVmZXIoKSxcclxuICAgICAgICAgICAgX3BhcmFtcyA9IHtcclxuICAgICAgICAgICAgICAgIGxvY2F0aW9uaWQ6IGxvY2F0aW9uSWQsXHJcbiAgICAgICAgICAgICAgICBnZW46IDksXHJcbiAgICAgICAgICAgICAgICBhcHBfaWQ6IEhlcmVNYXBzQ29uZmlnLmFwcF9pZCxcclxuICAgICAgICAgICAgICAgIGFwcF9jb2RlOiBIZXJlTWFwc0NvbmZpZy5hcHBfY29kZVxyXG4gICAgICAgICAgICB9O1xyXG5cclxuICAgICAgICAkaHR0cC5nZXQobG9jYXRpb25VcmwsIHsgcGFyYW1zOiBfcGFyYW1zIH0pXHJcbiAgICAgICAgICAgIC5zdWNjZXNzKGZ1bmN0aW9uKHJlc3BvbnNlKSB7XHJcbiAgICAgICAgICAgICAgICBkZWZlcnJlZC5yZXNvbHZlKHJlc3BvbnNlKTtcclxuICAgICAgICAgICAgfSlcclxuICAgICAgICAgICAgLmVycm9yKGZ1bmN0aW9uKGVycm9yKSB7XHJcbiAgICAgICAgICAgICAgICBkZWZlcnJlZC5yZWplY3QoZXJyb3IpO1xyXG4gICAgICAgICAgICB9KTtcclxuXHJcbiAgICAgICAgcmV0dXJuIGRlZmVycmVkLnByb21pc2U7XHJcbiAgICB9XHJcblxyXG4gICAgLy8jZW5kcmVnaW9uIFBVQkxJQ1xyXG5cclxuICAgIGZ1bmN0aW9uIF9nZXRMb2FkZXJCeUF0dHIoYXR0cikge1xyXG4gICAgICAgIHZhciBsb2FkZXI7XHJcblxyXG4gICAgICAgIHN3aXRjaCAoYXR0cikge1xyXG4gICAgICAgICAgICBjYXNlIEhlcmVNYXBzQ09OU1RTLk1PRFVMRVMuVUk6XHJcbiAgICAgICAgICAgICAgICBsb2FkZXIgPSBfbG9hZFVJTW9kdWxlO1xyXG4gICAgICAgICAgICAgICAgYnJlYWs7XHJcbiAgICAgICAgICAgIGNhc2UgSGVyZU1hcHNDT05TVFMuTU9EVUxFUy5FVkVOVFM6XHJcbiAgICAgICAgICAgICAgICBsb2FkZXIgPSBfbG9hZEV2ZW50c01vZHVsZTtcclxuICAgICAgICAgICAgICAgIGJyZWFrO1xyXG4gICAgICAgICAgICBkZWZhdWx0OlxyXG4gICAgICAgICAgICAgICAgdGhyb3cgbmV3IEVycm9yKCdVbmtub3duIG1vZHVsZScsIGF0dHIpO1xyXG4gICAgICAgIH1cclxuXHJcbiAgICAgICAgcmV0dXJuIGxvYWRlcjtcclxuICAgIH1cclxuXHJcbiAgICBmdW5jdGlvbiBfbG9hZFVJTW9kdWxlKCkge1xyXG4gICAgICAgIGlmICghX2lzTG9hZGVkKENPTkZJRy5VSS5zcmMpKSB7XHJcbiAgICAgICAgICAgIHZhciBsaW5rID0gSGVyZU1hcHNVdGlsc1NlcnZpY2UuY3JlYXRlTGlua1RhZyh7XHJcbiAgICAgICAgICAgICAgICByZWw6ICdzdHlsZXNoZWV0JyxcclxuICAgICAgICAgICAgICAgIHR5cGU6ICd0ZXh0L2NzcycsXHJcbiAgICAgICAgICAgICAgICBocmVmOiBfZ2V0VVJMKENPTkZJRy5VSS5ocmVmKVxyXG4gICAgICAgICAgICB9KTtcclxuXHJcbiAgICAgICAgICAgIGxpbmsgJiYgaGVhZC5hcHBlbmRDaGlsZChsaW5rKTtcclxuICAgICAgICB9XHJcblxyXG4gICAgICAgIHJldHVybiBfZ2V0TG9hZGVyKENPTkZJRy5VSS5zcmMpO1xyXG4gICAgfVxyXG5cclxuICAgIGZ1bmN0aW9uIF9sb2FkRXZlbnRzTW9kdWxlKCkge1xyXG4gICAgICAgIHJldHVybiBfZ2V0TG9hZGVyKENPTkZJRy5FVkVOVFMpO1xyXG4gICAgfVxyXG5cclxuICAgIC8qKlxyXG4gICAgICogQHBhcmFtIHtTdHJpbmd9IHNvdXJjZU5hbWVcclxuICAgICAqIHJldHVybiB7U3RyaW5nfSBlLmcgaHR0cDovL2pzLmFwaS5oZXJlLmNvbS92e1ZFUn0ve1NVQlZFUlNJT059L3tTT1VSQ0V9XHJcbiAgICAgKi9cclxuICAgIGZ1bmN0aW9uIF9nZXRVUkwoc291cmNlTmFtZSkge1xyXG4gICAgICAgIHJldHVybiBbXHJcbiAgICAgICAgICAgIHByb3RvY29sLFxyXG4gICAgICAgICAgICBDT05GSUcuQkFTRSxcclxuICAgICAgICAgICAgQVBJX1ZFUlNJT04uVixcclxuICAgICAgICAgICAgXCIvXCIsXHJcbiAgICAgICAgICAgIEFQSV9WRVJTSU9OLlNVQixcclxuICAgICAgICAgICAgXCIvXCIsXHJcbiAgICAgICAgICAgIHNvdXJjZU5hbWVcclxuICAgICAgICBdLmpvaW4oXCJcIik7XHJcbiAgICB9XHJcblxyXG4gICAgZnVuY3Rpb24gX2dldExvYWRlcihzb3VyY2VOYW1lKSB7XHJcbiAgICAgICAgdmFyIGRlZmVyID0gJHEuZGVmZXIoKSwgc3JjLCBzY3JpcHQ7XHJcblxyXG4gICAgICAgIGlmIChfaXNMb2FkZWQoc291cmNlTmFtZSkpIHtcclxuICAgICAgICAgICAgZGVmZXIucmVzb2x2ZSgpO1xyXG4gICAgICAgIH0gZWxzZSB7XHJcbiAgICAgICAgICAgIHNyYyA9IF9nZXRVUkwoc291cmNlTmFtZSk7XHJcbiAgICAgICAgICAgIHNjcmlwdCA9IEhlcmVNYXBzVXRpbHNTZXJ2aWNlLmNyZWF0ZVNjcmlwdFRhZyh7IHNyYzogc3JjIH0pO1xyXG5cclxuICAgICAgICAgICAgc2NyaXB0ICYmIGhlYWQuYXBwZW5kQ2hpbGQoc2NyaXB0KTtcclxuXHJcbiAgICAgICAgICAgIEFQSV9ERUZFUlNRdWV1ZVtzb3VyY2VOYW1lXS5wdXNoKGRlZmVyKTtcclxuXHJcbiAgICAgICAgICAgIHNjcmlwdC5vbmxvYWQgPSBfb25Mb2FkLmJpbmQobnVsbCwgc291cmNlTmFtZSk7XHJcbiAgICAgICAgICAgIHNjcmlwdC5vbmVycm9yID0gX29uRXJyb3IuYmluZChudWxsLCBzb3VyY2VOYW1lKTtcclxuICAgICAgICB9XHJcblxyXG4gICAgICAgIHJldHVybiBkZWZlci5wcm9taXNlO1xyXG4gICAgfVxyXG5cclxuICAgIGZ1bmN0aW9uIF9pc0xvYWRlZChzb3VyY2VOYW1lKSB7XHJcbiAgICAgICAgdmFyIGNoZWNrZXIgPSBudWxsO1xyXG5cclxuICAgICAgICBzd2l0Y2ggKHNvdXJjZU5hbWUpIHtcclxuICAgICAgICAgICAgY2FzZSBDT05GSUcuQ09SRTpcclxuICAgICAgICAgICAgICAgIGNoZWNrZXIgPSBfaXNDb3JlTG9hZGVkO1xyXG4gICAgICAgICAgICAgICAgYnJlYWs7XHJcbiAgICAgICAgICAgIGNhc2UgQ09ORklHLlNFUlZJQ0U6XHJcbiAgICAgICAgICAgICAgICBjaGVja2VyID0gX2lzU2VydmljZUxvYWRlZDtcclxuICAgICAgICAgICAgICAgIGJyZWFrO1xyXG4gICAgICAgICAgICBjYXNlIENPTkZJRy5VSS5zcmM6XHJcbiAgICAgICAgICAgICAgICBjaGVja2VyID0gX2lzVUlMb2FkZWQ7XHJcbiAgICAgICAgICAgICAgICBicmVhaztcclxuICAgICAgICAgICAgY2FzZSBDT05GSUcuRVZFTlRTOlxyXG4gICAgICAgICAgICAgICAgY2hlY2tlciA9IF9pc0V2ZW50c0xvYWRlZDtcclxuICAgICAgICAgICAgICAgIGJyZWFrO1xyXG4gICAgICAgICAgICBkZWZhdWx0OlxyXG4gICAgICAgICAgICAgICAgY2hlY2tlciA9IGZ1bmN0aW9uICgpIHsgcmV0dXJuIGZhbHNlIH07XHJcbiAgICAgICAgfVxyXG5cclxuICAgICAgICByZXR1cm4gY2hlY2tlcigpO1xyXG4gICAgfVxyXG5cclxuICAgIGZ1bmN0aW9uIF9pc0NvcmVMb2FkZWQoKSB7XHJcbiAgICAgICAgcmV0dXJuICEhd2luZG93Lkg7XHJcbiAgICB9XHJcblxyXG4gICAgZnVuY3Rpb24gX2lzU2VydmljZUxvYWRlZCgpIHtcclxuICAgICAgICByZXR1cm4gISEod2luZG93LkggJiYgd2luZG93Lkguc2VydmljZSk7XHJcbiAgICB9XHJcblxyXG4gICAgZnVuY3Rpb24gX2lzVUlMb2FkZWQoKSB7XHJcbiAgICAgICAgcmV0dXJuICEhKHdpbmRvdy5IICYmIHdpbmRvdy5ILnVpKTtcclxuICAgIH1cclxuXHJcbiAgICBmdW5jdGlvbiBfaXNFdmVudHNMb2FkZWQoKSB7XHJcbiAgICAgICAgcmV0dXJuICEhKHdpbmRvdy5IICYmIHdpbmRvdy5ILm1hcGV2ZW50cyk7XHJcbiAgICB9XHJcblxyXG4gICAgZnVuY3Rpb24gX29uTG9hZChzb3VyY2VOYW1lKSB7XHJcbiAgICAgICAgdmFyIGRlZmVyUXVldWUgPSBBUElfREVGRVJTUXVldWVbc291cmNlTmFtZV07XHJcbiAgICAgICAgZm9yICh2YXIgaSA9IDAsIGwgPSBkZWZlclF1ZXVlLmxlbmd0aDsgaSA8IGw7ICsraSkge1xyXG4gICAgICAgICAgICB2YXIgZGVmZXIgPSBkZWZlclF1ZXVlW2ldO1xyXG4gICAgICAgICAgICBkZWZlci5yZXNvbHZlKCk7XHJcbiAgICAgICAgfVxyXG5cclxuICAgICAgICBBUElfREVGRVJTUXVldWVbc291cmNlTmFtZV0gPSBbXTtcclxuICAgIH1cclxuXHJcbiAgICBmdW5jdGlvbiBfb25FcnJvcihzb3VyY2VOYW1lKSB7XHJcbiAgICAgICAgdmFyIGRlZmVyUXVldWUgPSBBUElfREVGRVJTUXVldWVbc291cmNlTmFtZV07XHJcbiAgICAgICAgZm9yICh2YXIgaSA9IDAsIGwgPSBkZWZlclF1ZXVlLmxlbmd0aDsgaSA8IGw7ICsraSkge1xyXG4gICAgICAgICAgICB2YXIgZGVmZXIgPSBkZWZlclF1ZXVlW2ldO1xyXG4gICAgICAgICAgICBkZWZlci5yZWplY3QoKTtcclxuICAgICAgICB9XHJcblxyXG4gICAgICAgIEFQSV9ERUZFUlNRdWV1ZVtzb3VyY2VOYW1lXSA9IFtdO1xyXG4gICAgfVxyXG59O1xyXG4iLCJtb2R1bGUuZXhwb3J0cyA9IHtcclxuICAgIFVQREFURV9NQVBfUkVTSVpFX1RJTUVPVVQ6IDUwMCxcclxuICAgIEFOSU1BVElPTl9aT09NX1NURVA6IC4wNSxcclxuICAgIE1PRFVMRVM6IHtcclxuICAgICAgICBVSTogJ2NvbnRyb2xzJyxcclxuICAgICAgICBFVkVOVFM6ICdldmVudHMnLFxyXG4gICAgICAgIFBBTk86ICdwYW5vJ1xyXG4gICAgfSxcclxuICAgIERFRkFVTFRfTUFQX09QVElPTlM6IHtcclxuICAgICAgICBoZWlnaHQ6IDQ4MCxcclxuICAgICAgICB3aWR0aDogNjQwLFxyXG4gICAgICAgIHpvb206IDEyLFxyXG4gICAgICAgIG1heFpvb206IDIsXHJcbiAgICAgICAgcmVzaXplOiBmYWxzZSxcclxuICAgICAgICBkcmFnZ2FibGU6IGZhbHNlLFxyXG4gICAgICAgIGNvb3Jkczoge1xyXG4gICAgICAgICAgICBsb25naXR1ZGU6IDAsXHJcbiAgICAgICAgICAgIGxhdGl0dWRlOiAwXHJcbiAgICAgICAgfVxyXG4gICAgfSxcclxuICAgIE1BUktFUl9UWVBFUzoge1xyXG4gICAgICAgIERPTTogXCJET01cIixcclxuICAgICAgICBTVkc6IFwiU1ZHXCJcclxuICAgIH0sXHJcbiAgICBDT05UUk9MUzoge1xyXG4gICAgICAgIE5BTUVTOiB7XHJcbiAgICAgICAgICAgIFNDQUxFOiAnc2NhbGViYXInLFxyXG4gICAgICAgICAgICBTRVRUSU5HUzogJ21hcHNldHRpbmdzJyxcclxuICAgICAgICAgICAgWk9PTTogJ3pvb20nLFxyXG4gICAgICAgICAgICBVU0VSOiAndXNlcnBvc2l0aW9uJ1xyXG4gICAgICAgIH0sXHJcbiAgICAgICAgUE9TSVRJT05TOiBbXHJcbiAgICAgICAgICAgICd0b3AtcmlnaHQnLFxyXG4gICAgICAgICAgICAndG9wLWNlbnRlcicsXHJcbiAgICAgICAgICAgICd0b3AtbGVmdCcsXHJcbiAgICAgICAgICAgICdsZWZ0LXRvcCcsXHJcbiAgICAgICAgICAgICdsZWZ0LW1pZGRsZScsXHJcbiAgICAgICAgICAgICdsZWZ0LWJvdHRvbScsXHJcbiAgICAgICAgICAgICdyaWdodC10b3AnLFxyXG4gICAgICAgICAgICAncmlnaHQtbWlkZGxlJyxcclxuICAgICAgICAgICAgJ3JpZ2h0LWJvdHRvbScsXHJcbiAgICAgICAgICAgICdib3R0b20tcmlnaHQnLFxyXG4gICAgICAgICAgICAnYm90dG9tLWNlbnRlcicsXHJcbiAgICAgICAgICAgICdib3R0b20tbGVmdCdcclxuICAgICAgICBdXHJcbiAgICB9LFxyXG4gICAgSU5GT0JVQkJMRToge1xyXG4gICAgICAgIFNUQVRFOiB7XHJcbiAgICAgICAgICAgIE9QRU46ICdvcGVuJyxcclxuICAgICAgICAgICAgQ0xPU0VEOiAnY2xvc2VkJ1xyXG4gICAgICAgIH0sXHJcbiAgICAgICAgRElTUExBWV9FVkVOVDoge1xyXG4gICAgICAgICAgICBwb2ludGVybW92ZTogJ29uSG92ZXInLFxyXG4gICAgICAgICAgICB0YXA6ICdvbkNsaWNrJ1xyXG4gICAgICAgIH1cclxuICAgIH0sXHJcbiAgICBVU0VSX0VWRU5UUzoge1xyXG4gICAgICAgIHRhcDogJ2NsaWNrJyxcclxuICAgICAgICBwb2ludGVybW92ZTogJ21vdXNlbW92ZScsXHJcbiAgICAgICAgcG9pbnRlcmxlYXZlOiAnbW91c2VsZWF2ZScsXHJcbiAgICAgICAgcG9pbnRlcmVudGVyOiAnbW91c2VlbnRlcicsXHJcbiAgICAgICAgZHJhZzogJ2RyYWcnLFxyXG4gICAgICAgIGRyYWdzdGFydDogJ2RyYWdzdGFydCcsXHJcbiAgICAgICAgZHJhZ2VuZDogJ2RyYWdlbmQnLFxyXG4gICAgICAgIG1hcHZpZXdjaGFuZ2U6ICdtYXB2aWV3Y2hhbmdlJyxcclxuICAgICAgICBtYXB2aWV3Y2hhbmdlc3RhcnQ6ICdtYXB2aWV3Y2hhbmdlc3RhcnQnLFxyXG4gICAgICAgIG1hcHZpZXdjaGFuZ2VlbmQ6ICdtYXB2aWV3Y2hhbmdlZW5kJ1xyXG4gICAgfVxyXG59IiwibW9kdWxlLmV4cG9ydHMgPSBIZXJlTWFwc0V2ZW50c0ZhY3Rvcnk7XHJcblxyXG5IZXJlTWFwc0V2ZW50c0ZhY3RvcnkuJGluamVjdCA9IFtcclxuICAgICdIZXJlTWFwc1V0aWxzU2VydmljZScsXHJcbiAgICAnSGVyZU1hcHNNYXJrZXJTZXJ2aWNlJyxcclxuICAgICdIZXJlTWFwc0NPTlNUUycsXHJcbiAgICAnSGVyZU1hcHNJbmZvQnViYmxlRmFjdG9yeSdcclxuXTtcclxuZnVuY3Rpb24gSGVyZU1hcHNFdmVudHNGYWN0b3J5KEhlcmVNYXBzVXRpbHNTZXJ2aWNlLCBIZXJlTWFwc01hcmtlclNlcnZpY2UsIEhlcmVNYXBzQ09OU1RTLCBIZXJlTWFwc0luZm9CdWJibGVGYWN0b3J5KSB7XHJcbiAgICBmdW5jdGlvbiBFdmVudHMocGxhdGZvcm0sIEluamVjdG9yLCBsaXN0ZW5lcnMpIHtcclxuICAgICAgICB0aGlzLm1hcCA9IHBsYXRmb3JtLm1hcDtcclxuICAgICAgICB0aGlzLmxpc3RlbmVycyA9IGxpc3RlbmVycztcclxuICAgICAgICB0aGlzLmluamVjdCA9IG5ldyBJbmplY3RvcigpO1xyXG4gICAgICAgIHRoaXMuZXZlbnRzID0gcGxhdGZvcm0uZXZlbnRzID0gbmV3IEgubWFwZXZlbnRzLk1hcEV2ZW50cyh0aGlzLm1hcCk7XHJcbiAgICAgICAgdGhpcy5iZWhhdmlvciA9IHBsYXRmb3JtLmJlaGF2aW9yID0gbmV3IEgubWFwZXZlbnRzLkJlaGF2aW9yKHRoaXMuZXZlbnRzKTtcclxuICAgICAgICB0aGlzLmJ1YmJsZSA9IEhlcmVNYXBzSW5mb0J1YmJsZUZhY3RvcnkuY3JlYXRlKCk7XHJcblxyXG4gICAgICAgIHRoaXMuc2V0dXBFdmVudExpc3RlbmVycygpO1xyXG4gICAgfVxyXG5cclxuICAgIHZhciBwcm90byA9IEV2ZW50cy5wcm90b3R5cGU7XHJcblxyXG4gICAgcHJvdG8uc2V0dXBFdmVudExpc3RlbmVycyA9IHNldHVwRXZlbnRMaXN0ZW5lcnM7XHJcbiAgICBwcm90by5zZXR1cE9wdGlvbnMgPSBzZXR1cE9wdGlvbnM7XHJcbiAgICBwcm90by50cmlnZ2VyVXNlckxpc3RlbmVyID0gdHJpZ2dlclVzZXJMaXN0ZW5lcjtcclxuICAgIHByb3RvLmluZm9CdWJibGVIYW5kbGVyID0gaW5mb0J1YmJsZUhhbmRsZXI7ICBcclxuXHJcbiAgICByZXR1cm4ge1xyXG4gICAgICAgIHN0YXJ0OiBmdW5jdGlvbihhcmdzKSB7XHJcbiAgICAgICAgICAgIGlmICghKGFyZ3MucGxhdGZvcm0ubWFwIGluc3RhbmNlb2YgSC5NYXApKVxyXG4gICAgICAgICAgICAgICAgcmV0dXJuIGNvbnNvbGUuZXJyb3IoJ01pc3NlZCByZXF1aXJlZCBtYXAgaW5zdGFuY2UnKTtcclxuXHJcbiAgICAgICAgICAgIHZhciBldmVudHMgPSBuZXcgRXZlbnRzKGFyZ3MucGxhdGZvcm0sIGFyZ3MuaW5qZWN0b3IsIGFyZ3MubGlzdGVuZXJzKTtcclxuXHJcbiAgICAgICAgICAgIGFyZ3Mub3B0aW9ucyAmJiBldmVudHMuc2V0dXBPcHRpb25zKGFyZ3Mub3B0aW9ucyk7XHJcbiAgICAgICAgfVxyXG4gICAgfVxyXG5cclxuICAgIGZ1bmN0aW9uIHNldHVwRXZlbnRMaXN0ZW5lcnMoKSB7XHJcbiAgICAgICAgdmFyIHNlbGYgPSB0aGlzO1xyXG5cclxuICAgICAgICBIZXJlTWFwc1V0aWxzU2VydmljZS5hZGRFdmVudExpc3RlbmVyKHRoaXMubWFwLCAndGFwJywgdGhpcy5pbmZvQnViYmxlSGFuZGxlci5iaW5kKHRoaXMpKTtcclxuXHJcbiAgICAgICAgSGVyZU1hcHNVdGlsc1NlcnZpY2UuYWRkRXZlbnRMaXN0ZW5lcih0aGlzLm1hcCwgJ3BvaW50ZXJtb3ZlJywgdGhpcy5pbmZvQnViYmxlSGFuZGxlci5iaW5kKHRoaXMpKTtcclxuXHJcbiAgICAgICAgSGVyZU1hcHNVdGlsc1NlcnZpY2UuYWRkRXZlbnRMaXN0ZW5lcih0aGlzLm1hcCwgJ2RyYWdzdGFydCcsIGZ1bmN0aW9uKGUpIHtcclxuICAgICAgICAgICAgaWYgKEhlcmVNYXBzTWFya2VyU2VydmljZS5pc01hcmtlckluc3RhbmNlKGUudGFyZ2V0KSkge1xyXG4gICAgICAgICAgICAgICAgc2VsZi5iZWhhdmlvci5kaXNhYmxlKCk7XHJcbiAgICAgICAgICAgIH1cclxuXHJcbiAgICAgICAgICAgIHNlbGYudHJpZ2dlclVzZXJMaXN0ZW5lcihIZXJlTWFwc0NPTlNUUy5VU0VSX0VWRU5UU1tlLnR5cGVdLCBlKTtcclxuICAgICAgICB9KTtcclxuXHJcbiAgICAgICAgSGVyZU1hcHNVdGlsc1NlcnZpY2UuYWRkRXZlbnRMaXN0ZW5lcih0aGlzLm1hcCwgJ2RyYWcnLCBmdW5jdGlvbihlKSB7XHJcbiAgICAgICAgICAgIHZhciBwb2ludGVyID0gZS5jdXJyZW50UG9pbnRlcixcclxuICAgICAgICAgICAgICAgIHRhcmdldCA9IGUudGFyZ2V0O1xyXG5cclxuICAgICAgICAgICAgaWYgKEhlcmVNYXBzTWFya2VyU2VydmljZS5pc01hcmtlckluc3RhbmNlKHRhcmdldCkpIHtcclxuICAgICAgICAgICAgICAgIHRhcmdldC5zZXRQb3NpdGlvbihzZWxmLm1hcC5zY3JlZW5Ub0dlbyhwb2ludGVyLnZpZXdwb3J0WCwgcG9pbnRlci52aWV3cG9ydFkpKTtcclxuICAgICAgICAgICAgfVxyXG5cclxuICAgICAgICAgICAgc2VsZi50cmlnZ2VyVXNlckxpc3RlbmVyKEhlcmVNYXBzQ09OU1RTLlVTRVJfRVZFTlRTW2UudHlwZV0sIGUpO1xyXG4gICAgICAgIH0pO1xyXG5cclxuICAgICAgICBIZXJlTWFwc1V0aWxzU2VydmljZS5hZGRFdmVudExpc3RlbmVyKHRoaXMubWFwLCAnZHJhZ2VuZCcsIGZ1bmN0aW9uKGUpIHtcclxuICAgICAgICAgICAgaWYgKEhlcmVNYXBzTWFya2VyU2VydmljZS5pc01hcmtlckluc3RhbmNlKGUudGFyZ2V0KSkge1xyXG4gICAgICAgICAgICAgICAgc2VsZi5iZWhhdmlvci5lbmFibGUoKTtcclxuICAgICAgICAgICAgfVxyXG5cclxuICAgICAgICAgICAgc2VsZi50cmlnZ2VyVXNlckxpc3RlbmVyKEhlcmVNYXBzQ09OU1RTLlVTRVJfRVZFTlRTW2UudHlwZV0sIGUpO1xyXG4gICAgICAgIH0pO1xyXG5cclxuICAgICAgICBIZXJlTWFwc1V0aWxzU2VydmljZS5hZGRFdmVudExpc3RlbmVyKHRoaXMubWFwLCAnbWFwdmlld2NoYW5nZXN0YXJ0JywgZnVuY3Rpb24oZSkge1xyXG4gICAgICAgICAgICBzZWxmLnRyaWdnZXJVc2VyTGlzdGVuZXIoSGVyZU1hcHNDT05TVFMuVVNFUl9FVkVOVFNbZS50eXBlXSwgZSk7XHJcbiAgICAgICAgfSk7XHJcblxyXG4gICAgICAgIEhlcmVNYXBzVXRpbHNTZXJ2aWNlLmFkZEV2ZW50TGlzdGVuZXIodGhpcy5tYXAsICdtYXB2aWV3Y2hhbmdlJywgZnVuY3Rpb24oZSkge1xyXG4gICAgICAgICAgICBzZWxmLnRyaWdnZXJVc2VyTGlzdGVuZXIoSGVyZU1hcHNDT05TVFMuVVNFUl9FVkVOVFNbZS50eXBlXSwgZSk7XHJcbiAgICAgICAgfSk7XHJcblxyXG4gICAgICAgIEhlcmVNYXBzVXRpbHNTZXJ2aWNlLmFkZEV2ZW50TGlzdGVuZXIodGhpcy5tYXAsICdtYXB2aWV3Y2hhbmdlZW5kJywgZnVuY3Rpb24oZSkge1xyXG4gICAgICAgICAgICBzZWxmLnRyaWdnZXJVc2VyTGlzdGVuZXIoSGVyZU1hcHNDT05TVFMuVVNFUl9FVkVOVFNbZS50eXBlXSwgZSk7XHJcbiAgICAgICAgfSk7XHJcbiAgICB9XHJcblxyXG4gICAgZnVuY3Rpb24gc2V0dXBPcHRpb25zKG9wdGlvbnMpIHtcclxuICAgICAgICBpZiAoIW9wdGlvbnMpXHJcbiAgICAgICAgICAgIHJldHVybjtcclxuXHJcbiAgICAgICAgdGhpcy5tYXAuZHJhZ2dhYmxlID0gISFvcHRpb25zLmRyYWdnYWJsZTtcclxuICAgIH1cclxuXHJcbiAgICBmdW5jdGlvbiB0cmlnZ2VyVXNlckxpc3RlbmVyKGV2ZW50TmFtZSwgZSkge1xyXG4gICAgICAgIGlmICghdGhpcy5saXN0ZW5lcnMpXHJcbiAgICAgICAgICAgIHJldHVybjtcclxuXHJcbiAgICAgICAgdmFyIGNhbGxiYWNrID0gdGhpcy5saXN0ZW5lcnNbZXZlbnROYW1lXTtcclxuXHJcbiAgICAgICAgY2FsbGJhY2sgJiYgY2FsbGJhY2soZSk7XHJcbiAgICB9XHJcbiAgICBcclxuICAgIGZ1bmN0aW9uIGluZm9CdWJibGVIYW5kbGVyKGUpe1xyXG4gICAgICAgIHZhciB1aSA9IHRoaXMuaW5qZWN0KCd1aScpO1xyXG4gICAgICAgIFxyXG4gICAgICAgIGlmKHVpKVxyXG4gICAgICAgICAgICB0aGlzLmJ1YmJsZS50b2dnbGUoZSwgdWkpO1xyXG4gICAgICAgICAgICBcclxuICAgICAgICB0aGlzLnRyaWdnZXJVc2VyTGlzdGVuZXIoSGVyZU1hcHNDT05TVFMuVVNFUl9FVkVOVFNbZS50eXBlXSwgZSk7ICAgICAgXHJcbiAgICB9XHJcblxyXG59OyIsIm1vZHVsZS5leHBvcnRzID0gSGVyZU1hcHNJbmZvQnViYmxlRmFjdG9yeTtcclxuXHJcbkhlcmVNYXBzSW5mb0J1YmJsZUZhY3RvcnkuJGluamVjdCA9IFtcclxuICAgICdIZXJlTWFwc01hcmtlclNlcnZpY2UnLFxyXG4gICAgJ0hlcmVNYXBzVXRpbHNTZXJ2aWNlJyxcclxuICAgICdIZXJlTWFwc0NPTlNUUydcclxuXTtcclxuZnVuY3Rpb24gSGVyZU1hcHNJbmZvQnViYmxlRmFjdG9yeShIZXJlTWFwc01hcmtlclNlcnZpY2UsIEhlcmVNYXBzVXRpbHNTZXJ2aWNlLCBIZXJlTWFwc0NPTlNUUykge1xyXG4gICAgZnVuY3Rpb24gSW5mb0J1YmJsZSgpIHt9XHJcblxyXG4gICAgdmFyIHByb3RvID0gSW5mb0J1YmJsZS5wcm90b3R5cGU7XHJcbiAgICAgICAgXHJcbiAgICBwcm90by5jcmVhdGUgPSBjcmVhdGU7XHJcbiAgICBwcm90by51cGRhdGUgPSB1cGRhdGU7XHJcbiAgICBwcm90by50b2dnbGUgPSB0b2dnbGU7XHJcbiAgICBwcm90by5zaG93ID0gc2hvdztcclxuICAgIHByb3RvLmNsb3NlID0gY2xvc2U7XHJcblxyXG4gICAgcmV0dXJuIHtcclxuICAgICAgICBjcmVhdGU6IGZ1bmN0aW9uKCl7XHJcbiAgICAgICAgICAgIHJldHVybiBuZXcgSW5mb0J1YmJsZSgpO1xyXG4gICAgICAgIH1cclxuICAgIH1cclxuXHJcbiAgICBmdW5jdGlvbiB0b2dnbGUoZSwgdWkpIHtcclxuICAgICAgICBpZiAoSGVyZU1hcHNNYXJrZXJTZXJ2aWNlLmlzTWFya2VySW5zdGFuY2UoZS50YXJnZXQpKVxyXG4gICAgICAgICAgICB0aGlzLnNob3coZSwgdWkpO1xyXG4gICAgICAgIGVsc2VcclxuICAgICAgICAgICAgdGhpcy5jbG9zZShlLCB1aSk7XHJcbiAgICB9XHJcblxyXG4gICAgZnVuY3Rpb24gdXBkYXRlKGJ1YmJsZSwgZGF0YSkge1xyXG4gICAgICAgIGJ1YmJsZS5kaXNwbGF5ID0gZGF0YS5kaXNwbGF5O1xyXG5cclxuICAgICAgICBidWJibGUuc2V0UG9zaXRpb24oZGF0YS5wb3NpdGlvbik7XHJcbiAgICAgICAgYnViYmxlLnNldENvbnRlbnQoZGF0YS5tYXJrdXApO1xyXG5cclxuICAgICAgICBidWJibGUuc2V0U3RhdGUoSGVyZU1hcHNDT05TVFMuSU5GT0JVQkJMRS5TVEFURS5PUEVOKTtcclxuICAgIH1cclxuXHJcbiAgICBmdW5jdGlvbiBjcmVhdGUoc291cmNlKSB7XHJcbiAgICAgICAgdmFyIGJ1YmJsZSA9IG5ldyBILnVpLkluZm9CdWJibGUoc291cmNlLnBvc2l0aW9uLCB7XHJcbiAgICAgICAgICAgIGNvbnRlbnQ6IHNvdXJjZS5tYXJrdXBcclxuICAgICAgICB9KTtcclxuXHJcbiAgICAgICAgYnViYmxlLmRpc3BsYXkgPSBzb3VyY2UuZGlzcGxheTtcclxuICAgICAgICBidWJibGUuYWRkQ2xhc3MoSGVyZU1hcHNDT05TVFMuSU5GT0JVQkJMRS5TVEFURS5PUEVOKVxyXG5cclxuICAgICAgICBIZXJlTWFwc1V0aWxzU2VydmljZS5hZGRFdmVudExpc3RlbmVyKGJ1YmJsZSwgJ3N0YXRlY2hhbmdlJywgZnVuY3Rpb24oZSkge1xyXG4gICAgICAgICAgICB2YXIgc3RhdGUgPSB0aGlzLmdldFN0YXRlKCksXHJcbiAgICAgICAgICAgICAgICBlbCA9IHRoaXMuZ2V0RWxlbWVudCgpO1xyXG4gICAgICAgICAgICBpZiAoc3RhdGUgPT09IEhlcmVNYXBzQ09OU1RTLklORk9CVUJCTEUuU1RBVEUuQ0xPU0VEKSB7XHJcbiAgICAgICAgICAgICAgICBlbC5jbGFzc0xpc3QucmVtb3ZlKEhlcmVNYXBzQ09OU1RTLklORk9CVUJCTEUuU1RBVEUuT1BFTik7XHJcbiAgICAgICAgICAgIH0gZWxzZVxyXG4gICAgICAgICAgICAgICAgdGhpcy5hZGRDbGFzcyhzdGF0ZSlcclxuICAgICAgICB9KTtcclxuXHJcbiAgICAgICAgcmV0dXJuIGJ1YmJsZTtcclxuICAgIH1cclxuXHJcbiAgICBmdW5jdGlvbiBzaG93KGUsIHVpLCBkYXRhKSB7XHJcbiAgICAgICAgdmFyIHRhcmdldCA9IGUudGFyZ2V0LFxyXG4gICAgICAgICAgICBkYXRhID0gdGFyZ2V0LmdldERhdGEoKSxcclxuICAgICAgICAgICAgZWwgPSBudWxsO1xyXG5cclxuICAgICAgICBpZiAoIWRhdGEgfHwgIWRhdGEuZGlzcGxheSB8fCAhZGF0YS5tYXJrdXAgfHwgZGF0YS5kaXNwbGF5ICE9PSBIZXJlTWFwc0NPTlNUUy5JTkZPQlVCQkxFLkRJU1BMQVlfRVZFTlRbZS50eXBlXSlcclxuICAgICAgICAgICAgcmV0dXJuO1xyXG5cclxuICAgICAgICB2YXIgc291cmNlID0ge1xyXG4gICAgICAgICAgICBwb3NpdGlvbjogdGFyZ2V0LmdldFBvc2l0aW9uKCksXHJcbiAgICAgICAgICAgIG1hcmt1cDogZGF0YS5tYXJrdXAsXHJcbiAgICAgICAgICAgIGRpc3BsYXk6IGRhdGEuZGlzcGxheVxyXG4gICAgICAgIH07XHJcblxyXG4gICAgICAgIGlmICghdWkuYnViYmxlKSB7XHJcbiAgICAgICAgICAgIHVpLmJ1YmJsZSA9IHRoaXMuY3JlYXRlKHNvdXJjZSk7XHJcbiAgICAgICAgICAgIHVpLmFkZEJ1YmJsZSh1aS5idWJibGUpO1xyXG5cclxuICAgICAgICAgICAgcmV0dXJuO1xyXG4gICAgICAgIH1cclxuXHJcbiAgICAgICAgdGhpcy51cGRhdGUodWkuYnViYmxlLCBzb3VyY2UpO1xyXG4gICAgfVxyXG5cclxuICAgIGZ1bmN0aW9uIGNsb3NlKGUsIHVpKSB7XHJcbiAgICAgICAgaWYgKCF1aS5idWJibGUgfHwgdWkuYnViYmxlLmRpc3BsYXkgIT09IEhlcmVNYXBzQ09OU1RTLklORk9CVUJCTEUuRElTUExBWV9FVkVOVFtlLnR5cGVdKSB7XHJcbiAgICAgICAgICAgIHJldHVybjtcclxuICAgICAgICB9XHJcblxyXG4gICAgICAgIHVpLmJ1YmJsZS5zZXRTdGF0ZShIZXJlTWFwc0NPTlNUUy5JTkZPQlVCQkxFLlNUQVRFLkNMT1NFRCk7XHJcbiAgICB9XHJcbn0iLCJhbmd1bGFyLm1vZHVsZSgnaGVyZW1hcHMtZXZlbnRzLW1vZHVsZScsIFtdKVxyXG4gICAgLmZhY3RvcnkoJ0hlcmVNYXBzRXZlbnRzRmFjdG9yeScsIHJlcXVpcmUoJy4vZXZlbnRzL2V2ZW50cy5qcycpKVxyXG4gICAgLmZhY3RvcnkoJ0hlcmVNYXBzSW5mb0J1YmJsZUZhY3RvcnknLCByZXF1aXJlKCcuL2V2ZW50cy9pbmZvYnViYmxlLmpzJykpO1xyXG4gICAgXHJcbmFuZ3VsYXIubW9kdWxlKCdoZXJlbWFwcy11aS1tb2R1bGUnLCBbXSlcclxuICAgIC5mYWN0b3J5KCdIZXJlTWFwc1VpRmFjdG9yeScsIHJlcXVpcmUoJy4vdWkvdWkuanMnKSlcclxuXHJcbm1vZHVsZS5leHBvcnRzID0gYW5ndWxhci5tb2R1bGUoJ2hlcmVtYXBzLW1hcC1tb2R1bGVzJywgW1xyXG5cdCdoZXJlbWFwcy1ldmVudHMtbW9kdWxlJyxcclxuICAgICdoZXJlbWFwcy11aS1tb2R1bGUnXHJcbl0pOyIsIm1vZHVsZS5leHBvcnRzID0gSGVyZU1hcHNVaUZhY3Rvcnk7XHJcblxyXG5IZXJlTWFwc1VpRmFjdG9yeS4kaW5qZWN0ID0gW1xyXG4gICAgJ0hlcmVNYXBzQVBJU2VydmljZScsXHJcbiAgICAnSGVyZU1hcHNNYXJrZXJTZXJ2aWNlJyxcclxuICAgICdIZXJlTWFwc1V0aWxzU2VydmljZScsXHJcbiAgICAnSGVyZU1hcHNDT05TVFMnXHJcbl07XHJcbmZ1bmN0aW9uIEhlcmVNYXBzVWlGYWN0b3J5KEhlcmVNYXBzQVBJU2VydmljZSwgSGVyZU1hcHNNYXJrZXJTZXJ2aWNlLCBIZXJlTWFwc1V0aWxzU2VydmljZSwgSGVyZU1hcHNDT05TVFMpIHtcclxuICAgIGZ1bmN0aW9uIFVJKHBsYXRmb3JtLCBhbGlnbm1lbnQpIHtcclxuICAgICAgICB0aGlzLm1hcCA9IHBsYXRmb3JtLm1hcDtcclxuICAgICAgICB0aGlzLmxheWVycyA9IHBsYXRmb3JtLmxheWVycztcclxuICAgICAgICB0aGlzLmFsaWdubWVudCA9IGFsaWdubWVudDtcclxuICAgICAgICB0aGlzLnVpID0gcGxhdGZvcm0udWkgPSBILnVpLlVJLmNyZWF0ZURlZmF1bHQodGhpcy5tYXAsIHRoaXMubGF5ZXJzKTtcclxuXHJcbiAgICAgICAgdGhpcy5zZXR1cENvbnRyb2xzKCk7XHJcbiAgICB9XHJcblxyXG4gICAgVUkuaXNWYWxpZEFsaWdubWVudCA9IGlzVmFsaWRBbGlnbm1lbnQ7XHJcblxyXG4gICAgdmFyIHByb3RvID0gVUkucHJvdG90eXBlO1xyXG5cclxuICAgIHByb3RvLnNldHVwQ29udHJvbHMgPSBzZXR1cENvbnRyb2xzO1xyXG4gICAgcHJvdG8uY3JlYXRlVXNlckNvbnRyb2wgPSBjcmVhdGVVc2VyQ29udHJvbDtcclxuICAgIHByb3RvLnNldENvbnRyb2xzQWxpZ25tZW50ID0gc2V0Q29udHJvbHNBbGlnbm1lbnQ7XHJcblxyXG4gICAgcmV0dXJuIHtcclxuICAgICAgICBzdGFydDogZnVuY3Rpb24oYXJncykge1xyXG4gICAgICAgICAgICBpZiAoIShhcmdzLnBsYXRmb3JtLm1hcCBpbnN0YW5jZW9mIEguTWFwKSAmJiAhKGFyZ3MucGxhdGZvcm0ubGF5ZXJzKSlcclxuICAgICAgICAgICAgICAgIHJldHVybiBjb25zb2xlLmVycm9yKCdNaXNzZWQgdWkgbW9kdWxlIGRlcGVuZGVuY2llcycpO1xyXG5cclxuICAgICAgICAgICAgdmFyIHVpID0gbmV3IFVJKGFyZ3MucGxhdGZvcm0sIGFyZ3MuYWxpZ25tZW50KTtcclxuICAgICAgICB9XHJcbiAgICB9XHJcblxyXG4gICAgZnVuY3Rpb24gc2V0dXBDb250cm9scygpIHtcclxuICAgICAgICB2YXIgTkFNRVMgPSBIZXJlTWFwc0NPTlNUUy5DT05UUk9MUy5OQU1FUyxcclxuICAgICAgICAgICAgdXNlckNvbnRyb2wgPSB0aGlzLmNyZWF0ZVVzZXJDb250cm9sKCk7XHJcblxyXG4gICAgICAgIHRoaXMudWkuZ2V0Q29udHJvbChOQU1FUy5TRVRUSU5HUykuc2V0SW5jaWRlbnRzTGF5ZXIoZmFsc2UpO1xyXG4gICAgICAgIHRoaXMudWkuYWRkQ29udHJvbChOQU1FUy5VU0VSLCB1c2VyQ29udHJvbCk7XHJcbiAgICAgICAgdGhpcy5zZXRDb250cm9sc0FsaWdubWVudChOQU1FUyk7XHJcbiAgICB9XHJcblxyXG4gICAgZnVuY3Rpb24gY3JlYXRlVXNlckNvbnRyb2woKSB7XHJcbiAgICAgICAgdmFyIHNlbGYgPSB0aGlzLFxyXG4gICAgICAgICAgICB1c2VyQ29udHJvbCA9IG5ldyBILnVpLkNvbnRyb2woKSxcclxuICAgICAgICAgICAgbWFya3VwID0gJzxzdmcgY2xhc3M9XCJIX2ljb25cIiBmaWxsPVwiI2ZmZlwiIHhtbG5zPVwiaHR0cDovL3d3dy53My5vcmcvMjAwMC9zdmdcIiB3aWR0aD1cIjE2XCIgaGVpZ2h0PVwiMTZcIiB2aWV3Qm94PVwiMCAwIDE2IDE2XCI+PHBhdGggY2xhc3M9XCJtaWRkbGVfbG9jYXRpb25fc3Ryb2tlXCIgZD1cIk04IDEyYy0yLjIwNiAwLTQtMS43OTUtNC00IDAtMi4yMDYgMS43OTQtNCA0LTRzNCAxLjc5NCA0IDRjMCAyLjIwNS0xLjc5NCA0LTQgNE04IDEuMjVhNi43NSA2Ljc1IDAgMSAwIDAgMTMuNSA2Ljc1IDYuNzUgMCAwIDAgMC0xMy41XCI+PC9wYXRoPjxwYXRoIGNsYXNzPVwiaW5uZXJfbG9jYXRpb25fc3Ryb2tlXCIgZD1cIk04IDVhMyAzIDAgMSAxIC4wMDEgNkEzIDMgMCAwIDEgOCA1bTAtMUM1Ljc5NCA0IDQgNS43OTQgNCA4YzAgMi4yMDUgMS43OTQgNCA0IDRzNC0xLjc5NSA0LTRjMC0yLjIwNi0xLjc5NC00LTQtNFwiPjwvcGF0aD48cGF0aCBjbGFzcz1cIm91dGVyX2xvY2F0aW9uX3N0cm9rZVwiIGQ9XCJNOCAxLjI1YTYuNzUgNi43NSAwIDEgMSAwIDEzLjUgNi43NSA2Ljc1IDAgMCAxIDAtMTMuNU04IDBDMy41OSAwIDAgMy41OSAwIDhjMCA0LjQxMSAzLjU5IDggOCA4czgtMy41ODkgOC04YzAtNC40MS0zLjU5LTgtOC04XCI+PC9wYXRoPjwvc3ZnPic7XHJcblxyXG4gICAgICAgIHZhciB1c2VyQ29udHJvbEJ1dHRvbiA9IG5ldyBILnVpLmJhc2UuQnV0dG9uKHtcclxuICAgICAgICAgICAgbGFiZWw6IG1hcmt1cCxcclxuICAgICAgICAgICAgb25TdGF0ZUNoYW5nZTogZnVuY3Rpb24oZXZ0KSB7XHJcbiAgICAgICAgICAgICAgICBpZiAodXNlckNvbnRyb2xCdXR0b24uZ2V0U3RhdGUoKSA9PT0gSC51aS5iYXNlLkJ1dHRvbi5TdGF0ZS5ET1dOKVxyXG4gICAgICAgICAgICAgICAgICAgIHJldHVybjtcclxuXHJcbiAgICAgICAgICAgICAgICBIZXJlTWFwc0FQSVNlcnZpY2UuZ2V0UG9zaXRpb24oKS50aGVuKGZ1bmN0aW9uKHJlc3BvbnNlKSB7XHJcbiAgICAgICAgICAgICAgICAgICAgdmFyIHBvc2l0aW9uID0ge1xyXG4gICAgICAgICAgICAgICAgICAgICAgICBsbmc6IHJlc3BvbnNlLmNvb3Jkcy5sb25naXR1ZGUsXHJcbiAgICAgICAgICAgICAgICAgICAgICAgIGxhdDogcmVzcG9uc2UuY29vcmRzLmxhdGl0dWRlXHJcbiAgICAgICAgICAgICAgICAgICAgfTtcclxuICAgICAgICAgICAgICAgICAgICBcclxuICAgICAgICAgICAgICAgICAgICBzZWxmLm1hcC5zZXRDZW50ZXIocG9zaXRpb24pO1xyXG4gICAgICAgICAgICAgICAgICAgIFxyXG4gICAgICAgICAgICAgICAgICAgIEhlcmVNYXBzVXRpbHNTZXJ2aWNlLnpvb20oc2VsZi5tYXAsIDE3LCAuMDgpO1xyXG5cclxuICAgICAgICAgICAgICAgICAgICBpZiAoc2VsZi51c2VyTWFya2VyKSB7XHJcbiAgICAgICAgICAgICAgICAgICAgICAgIHNlbGYudXNlck1hcmtlci5zZXRQb3NpdGlvbihwb3NpdGlvbik7XHJcbiAgICAgICAgICAgICAgICAgICAgICAgIHJldHVybjtcclxuICAgICAgICAgICAgICAgICAgICB9XHJcbiAgICAgICAgICAgICAgICAgICAgXHJcbiAgICAgICAgICAgICAgICAgICAgc2VsZi51c2VyTWFya2VyID0gSGVyZU1hcHNNYXJrZXJTZXJ2aWNlLmFkZFVzZXJNYXJrZXIoc2VsZi5tYXAsIHtcclxuICAgICAgICAgICAgICAgICAgICAgICAgcG9zOiBwb3NpdGlvblxyXG4gICAgICAgICAgICAgICAgICAgIH0pO1xyXG4gICAgICAgICAgICAgICAgfSk7XHJcbiAgICAgICAgICAgIH1cclxuICAgICAgICB9KTtcclxuXHJcbiAgICAgICAgdXNlckNvbnRyb2wuYWRkQ2hpbGQodXNlckNvbnRyb2xCdXR0b24pO1xyXG5cclxuICAgICAgICByZXR1cm4gdXNlckNvbnRyb2w7XHJcbiAgICB9XHJcblxyXG4gICAgZnVuY3Rpb24gc2V0Q29udHJvbHNBbGlnbm1lbnQoTkFNRVMpIHtcclxuICAgICAgICBpZiAoIVVJLmlzVmFsaWRBbGlnbm1lbnQodGhpcy5hbGlnbm1lbnQpKVxyXG4gICAgICAgICAgICByZXR1cm47XHJcblxyXG4gICAgICAgIGZvciAodmFyIGlkIGluIE5BTUVTKSB7XHJcbiAgICAgICAgICAgIHZhciBjb250cm9sID0gdGhpcy51aS5nZXRDb250cm9sKE5BTUVTW2lkXSk7XHJcblxyXG4gICAgICAgICAgICBpZiAoIU5BTUVTLmhhc093blByb3BlcnR5KGlkKSB8fCAhY29udHJvbClcclxuICAgICAgICAgICAgICAgIGNvbnRpbnVlO1xyXG5cclxuICAgICAgICAgICAgY29udHJvbC5zZXRBbGlnbm1lbnQodGhpcy5hbGlnbm1lbnQpO1xyXG4gICAgICAgIH1cclxuICAgIH1cclxuXHJcbiAgICBmdW5jdGlvbiBpc1ZhbGlkQWxpZ25tZW50KGFsaWdubWVudCkge1xyXG4gICAgICAgIHJldHVybiAhIShIZXJlTWFwc0NPTlNUUy5DT05UUk9MUy5QT1NJVElPTlMuaW5kZXhPZihhbGlnbm1lbnQpICsgMSk7XHJcbiAgICB9XHJcblxyXG59OyIsIm1vZHVsZS5leHBvcnRzID0gZnVuY3Rpb24oKSB7XHJcbiAgICB2YXIgb3B0aW9ucyA9IHt9O1xyXG4gICAgdmFyIERFRkFVTFRfQVBJX1ZFUlNJT04gPSBcIjMuMFwiO1xyXG5cclxuICAgIHRoaXMuJGdldCA9IGZ1bmN0aW9uKCl7XHJcbiAgICAgICAgcmV0dXJuIHtcclxuICAgICAgICAgICAgYXBwX2lkOiBvcHRpb25zLmFwcF9pZCxcclxuICAgICAgICAgICAgYXBwX2NvZGU6IG9wdGlvbnMuYXBwX2NvZGUsXHJcbiAgICAgICAgICAgIGFwaVZlcnNpb246IG9wdGlvbnMuYXBpVmVyc2lvbiB8fCBERUZBVUxUX0FQSV9WRVJTSU9OLFxyXG4gICAgICAgICAgICB1c2VIVFRQUzogb3B0aW9ucy51c2VIVFRQUyxcclxuICAgICAgICAgICAgdXNlQ0lUOiAhIW9wdGlvbnMudXNlQ0lUXHJcbiAgICAgICAgfVxyXG4gICAgfTtcclxuXHJcbiAgICB0aGlzLnNldE9wdGlvbnMgPSBmdW5jdGlvbihvcHRzKXtcclxuICAgICAgICBvcHRpb25zID0gb3B0cztcclxuICAgIH07XHJcbn07IiwiXHJcbm1vZHVsZS5leHBvcnRzID0gSGVyZU1hcHNVdGlsc1NlcnZpY2U7XHJcblxyXG5IZXJlTWFwc1V0aWxzU2VydmljZS4kaW5qZWN0ID0gW1xyXG4gICAgJyRyb290U2NvcGUnLCBcclxuICAgICckdGltZW91dCcsIFxyXG4gICAgJ0hlcmVNYXBzQ09OU1RTJ1xyXG5dO1xyXG5mdW5jdGlvbiBIZXJlTWFwc1V0aWxzU2VydmljZSgkcm9vdFNjb3BlLCAkdGltZW91dCwgSGVyZU1hcHNDT05TVFMpIHtcclxuICAgIHJldHVybiB7XHJcbiAgICAgICAgdGhyb3R0bGU6IHRocm90dGxlLFxyXG4gICAgICAgIGNyZWF0ZVNjcmlwdFRhZzogY3JlYXRlU2NyaXB0VGFnLFxyXG4gICAgICAgIGNyZWF0ZUxpbmtUYWc6IGNyZWF0ZUxpbmtUYWcsXHJcbiAgICAgICAgcnVuU2NvcGVEaWdlc3RJZk5lZWQ6IHJ1blNjb3BlRGlnZXN0SWZOZWVkLFxyXG4gICAgICAgIGlzVmFsaWRDb29yZHM6IGlzVmFsaWRDb29yZHMsXHJcbiAgICAgICAgYWRkRXZlbnRMaXN0ZW5lcjogYWRkRXZlbnRMaXN0ZW5lcixcclxuICAgICAgICB6b29tOiB6b29tLFxyXG4gICAgICAgIGdldEJvdW5kc1JlY3RGcm9tUG9pbnRzOiBnZXRCb3VuZHNSZWN0RnJvbVBvaW50cyxcclxuICAgICAgICBnZW5lcmF0ZUlkOiBnZW5lcmF0ZUlkLFxyXG4gICAgICAgIGdldE1hcEZhY3Rvcnk6IGdldE1hcEZhY3RvcnlcclxuICAgIH07XHJcblxyXG4gICAgLy8jcmVnaW9uIFBVQkxJQ1xyXG4gICAgZnVuY3Rpb24gdGhyb3R0bGUoZm4sIHBlcmlvZCkge1xyXG4gICAgICAgIHZhciB0aW1lb3V0ID0gbnVsbDtcclxuXHJcbiAgICAgICAgcmV0dXJuIGZ1bmN0aW9uICgpIHtcclxuICAgICAgICAgICAgaWYgKCR0aW1lb3V0KVxyXG4gICAgICAgICAgICAgICAgJHRpbWVvdXQuY2FuY2VsKHRpbWVvdXQpO1xyXG5cclxuICAgICAgICAgICAgdGltZW91dCA9ICR0aW1lb3V0KGZuLCBwZXJpb2QpO1xyXG4gICAgICAgIH1cclxuICAgIH1cclxuXHJcbiAgICBmdW5jdGlvbiBhZGRFdmVudExpc3RlbmVyKG9iaiwgZXZlbnROYW1lLCBsaXN0ZW5lciwgdXNlQ2FwdHVyZSkge1xyXG4gICAgICAgIG9iai5hZGRFdmVudExpc3RlbmVyKGV2ZW50TmFtZSwgbGlzdGVuZXIsICEhdXNlQ2FwdHVyZSk7XHJcbiAgICB9XHJcblxyXG4gICAgZnVuY3Rpb24gcnVuU2NvcGVEaWdlc3RJZk5lZWQoc2NvcGUsIGNiKSB7XHJcbiAgICAgICAgaWYgKHNjb3BlLiRyb290ICYmIHNjb3BlLiRyb290LiQkcGhhc2UgIT09ICckYXBwbHknICYmIHNjb3BlLiRyb290LiQkcGhhc2UgIT09ICckZGlnZXN0Jykge1xyXG4gICAgICAgICAgICBzY29wZS4kZGlnZXN0KGNiIHx8IGFuZ3VsYXIubm9vcCk7XHJcbiAgICAgICAgICAgIHJldHVybiB0cnVlO1xyXG4gICAgICAgIH1cclxuICAgICAgICByZXR1cm4gZmFsc2U7XHJcbiAgICB9XHJcblxyXG4gICAgZnVuY3Rpb24gY3JlYXRlU2NyaXB0VGFnKGF0dHJzKSB7XHJcbiAgICAgICAgdmFyIHNjcmlwdCA9IGRvY3VtZW50LmdldEVsZW1lbnRCeUlkKGF0dHJzLnNyYyk7XHJcblxyXG4gICAgICAgIGlmIChzY3JpcHQpXHJcbiAgICAgICAgICAgIHJldHVybiBmYWxzZTtcclxuXHJcbiAgICAgICAgc2NyaXB0ID0gZG9jdW1lbnQuY3JlYXRlRWxlbWVudCgnc2NyaXB0Jyk7XHJcbiAgICAgICAgc2NyaXB0LnR5cGUgPSAndGV4dC9qYXZhc2NyaXB0JztcclxuICAgICAgICBzY3JpcHQuaWQgPSBhdHRycy5zcmM7XHJcbiAgICAgICAgX3NldEF0dHJzKHNjcmlwdCwgYXR0cnMpO1xyXG5cclxuICAgICAgICByZXR1cm4gc2NyaXB0O1xyXG4gICAgfVxyXG5cclxuICAgIGZ1bmN0aW9uIGNyZWF0ZUxpbmtUYWcoYXR0cnMpIHtcclxuICAgICAgICB2YXIgbGluayA9IGRvY3VtZW50LmdldEVsZW1lbnRCeUlkKGF0dHJzLmhyZWYpO1xyXG5cclxuICAgICAgICBpZiAobGluaylcclxuICAgICAgICAgICAgcmV0dXJuIGZhbHNlO1xyXG5cclxuICAgICAgICBsaW5rID0gZG9jdW1lbnQuY3JlYXRlRWxlbWVudCgnbGluaycpO1xyXG4gICAgICAgIGxpbmsuaWQgPSBhdHRycy5ocmVmO1xyXG4gICAgICAgIF9zZXRBdHRycyhsaW5rLCBhdHRycyk7XHJcblxyXG4gICAgICAgIHJldHVybiBsaW5rO1xyXG4gICAgfVxyXG5cclxuICAgIGZ1bmN0aW9uIGlzVmFsaWRDb29yZHMoY29vcmRzKSB7XHJcbiAgICAgICAgcmV0dXJuIGNvb3JkcyAmJlxyXG4gICAgICAgICAgICAodHlwZW9mIGNvb3Jkcy5sYXRpdHVkZSA9PT0gJ3N0cmluZycgfHwgdHlwZW9mIGNvb3Jkcy5sYXRpdHVkZSA9PT0gJ251bWJlcicpICYmXHJcbiAgICAgICAgICAgICh0eXBlb2YgY29vcmRzLmxvbmdpdHVkZSA9PT0gJ3N0cmluZycgfHwgdHlwZW9mIGNvb3Jkcy5sb25naXR1ZGUgPT09ICdudW1iZXInKVxyXG4gICAgfVxyXG5cclxuICAgIGZ1bmN0aW9uIHpvb20obWFwLCB2YWx1ZSwgc3RlcCkge1xyXG4gICAgICAgIHZhciBjdXJyZW50Wm9vbSA9IG1hcC5nZXRab29tKCksXHJcbiAgICAgICAgICAgIF9zdGVwID0gc3RlcCB8fCBIZXJlTWFwc0NPTlNUUy5BTklNQVRJT05fWk9PTV9TVEVQLFxyXG4gICAgICAgICAgICBmYWN0b3IgPSBjdXJyZW50Wm9vbSA+PSB2YWx1ZSA/IC0xIDogMSxcclxuICAgICAgICAgICAgaW5jcmVtZW50ID0gc3RlcCAqIGZhY3RvcjtcclxuXHJcbiAgICAgICAgcmV0dXJuIChmdW5jdGlvbiB6b29tKCkge1xyXG4gICAgICAgICAgICBpZiAoIXN0ZXAgfHwgTWF0aC5mbG9vcihjdXJyZW50Wm9vbSkgPT09IE1hdGguZmxvb3IodmFsdWUpKSB7XHJcbiAgICAgICAgICAgICAgICBtYXAuc2V0Wm9vbSh2YWx1ZSk7XHJcbiAgICAgICAgICAgICAgICByZXR1cm47XHJcbiAgICAgICAgICAgIH1cclxuXHJcbiAgICAgICAgICAgIGN1cnJlbnRab29tICs9IGluY3JlbWVudDtcclxuICAgICAgICAgICAgbWFwLnNldFpvb20oY3VycmVudFpvb20pO1xyXG5cclxuICAgICAgICAgICAgcmVxdWVzdEFuaW1hdGlvbkZyYW1lKHpvb20pO1xyXG4gICAgICAgIH0pKCk7XHJcbiAgICB9XHJcblxyXG4gICAgZnVuY3Rpb24gZ2V0TWFwRmFjdG9yeSgpe1xyXG4gICAgICAgIHJldHVybiBIO1xyXG4gICAgfVxyXG5cclxuICAgIC8qKlxyXG4gICAgICogQG1ldGhvZCBnZXRCb3VuZHNSZWN0RnJvbVBvaW50c1xyXG4gICAgICogXHJcbiAgICAgKiBAcGFyYW0ge09iamVjdH0gdG9wTGVmdCBcclxuICAgICAqICBAcHJvcGVydHkge051bWJlcnxTdHJpbmd9IGxhdFxyXG4gICAgICogIEBwcm9wZXJ0eSB7TnVtYmVyfFN0cmluZ30gbG5nXHJcbiAgICAgKiBAcGFyYW0ge09iamVjdH0gYm90dG9tUmlnaHQgXHJcbiAgICAgKiAgQHByb3BlcnR5IHtOdW1iZXJ8U3RyaW5nfSBsYXRcclxuICAgICAqICBAcHJvcGVydHkge051bWJlcnxTdHJpbmd9IGxuZ1xyXG4gICAgICogXHJcbiAgICAgKiBAcmV0dXJuIHtILmdlby5SZWN0fVxyXG4gICAgICovXHJcbiAgICBmdW5jdGlvbiBnZXRCb3VuZHNSZWN0RnJvbVBvaW50cyh0b3BMZWZ0LCBib3R0b21SaWdodCkge1xyXG4gICAgICAgIHJldHVybiBILmdlby5SZWN0LmZyb21Qb2ludHModG9wTGVmdCwgYm90dG9tUmlnaHQsIHRydWUpO1xyXG4gICAgfVxyXG5cclxuICAgIGZ1bmN0aW9uIGdlbmVyYXRlSWQoKSB7XHJcbiAgICAgICAgdmFyIG1hc2sgPSAneHh4eHh4eHgteHh4eC00eHh4LXl4eHgteHh4eHh4eHh4eHh4JyxcclxuICAgICAgICAgICAgcmVnZXhwID0gL1t4eV0vZyxcclxuICAgICAgICAgICAgZCA9IG5ldyBEYXRlKCkuZ2V0VGltZSgpLFxyXG4gICAgICAgICAgICB1dWlkID0gbWFzay5yZXBsYWNlKHJlZ2V4cCwgZnVuY3Rpb24gKGMpIHtcclxuICAgICAgICAgICAgICAgIHZhciByID0gKGQgKyBNYXRoLnJhbmRvbSgpICogMTYpICUgMTYgfCAwO1xyXG4gICAgICAgICAgICAgICAgZCA9IE1hdGguZmxvb3IoZCAvIDE2KTtcclxuICAgICAgICAgICAgICAgIHJldHVybiAoYyA9PSAneCcgPyByIDogKHIgJiAweDMgfCAweDgpKS50b1N0cmluZygxNik7XHJcbiAgICAgICAgICAgIH0pO1xyXG5cclxuICAgICAgICByZXR1cm4gdXVpZDtcclxuICAgIH1cclxuXHJcbiAgICAvLyNlbmRyZWdpb24gUFVCTElDIFxyXG5cclxuICAgIGZ1bmN0aW9uIF9zZXRBdHRycyhlbCwgYXR0cnMpIHtcclxuICAgICAgICBpZiAoIWVsIHx8ICFhdHRycylcclxuICAgICAgICAgICAgdGhyb3cgbmV3IEVycm9yKCdNaXNzZWQgYXR0cmlidXRlcycpO1xyXG5cclxuICAgICAgICBmb3IgKHZhciBrZXkgaW4gYXR0cnMpIHtcclxuICAgICAgICAgICAgaWYgKCFhdHRycy5oYXNPd25Qcm9wZXJ0eShrZXkpKVxyXG4gICAgICAgICAgICAgICAgY29udGludWU7XHJcblxyXG4gICAgICAgICAgICBlbFtrZXldID0gYXR0cnNba2V5XTtcclxuICAgICAgICB9XHJcbiAgICB9XHJcbn07IiwibW9kdWxlLmV4cG9ydHMgPSBIZXJlTWFwc0RlZmF1bHRNYXJrZXI7XHJcblxyXG5IZXJlTWFwc0RlZmF1bHRNYXJrZXIuJGluamVjdCA9IFsnSGVyZU1hcHNNYXJrZXJJbnRlcmZhY2UnXTtcclxuZnVuY3Rpb24gSGVyZU1hcHNEZWZhdWx0TWFya2VyKEhlcmVNYXBzTWFya2VySW50ZXJmYWNlKXtcclxuICAgIGZ1bmN0aW9uIERlZmF1bHRNYXJrZXIocGxhY2Upe1xyXG4gICAgICAgIHRoaXMucGxhY2UgPSBwbGFjZTtcclxuICAgICAgICB0aGlzLnNldENvb3JkcygpO1xyXG4gICAgfVxyXG5cclxuICAgIHZhciBwcm90byA9IERlZmF1bHRNYXJrZXIucHJvdG90eXBlID0gbmV3IEhlcmVNYXBzTWFya2VySW50ZXJmYWNlKCk7XHJcbiAgICBwcm90by5jb25zdHJ1Y3RvciA9IERlZmF1bHRNYXJrZXI7XHJcblxyXG4gICAgcHJvdG8uY3JlYXRlID0gY3JlYXRlO1xyXG5cclxuICAgIHJldHVybiBEZWZhdWx0TWFya2VyO1xyXG4gICAgXHJcbiAgICBmdW5jdGlvbiBjcmVhdGUoKXtcclxuICAgICAgICB2YXIgbWFya2VyID0gbmV3IEgubWFwLk1hcmtlcih0aGlzLmNvb3Jkcyk7XHJcbiAgICAgICAgXHJcbiAgICAgICAgdGhpcy5hZGRJbmZvQnViYmxlKG1hcmtlcik7XHJcbiAgICAgICAgXHJcbiAgICAgICAgcmV0dXJuIG1hcmtlcjtcclxuICAgIH1cclxufSIsIm1vZHVsZS5leHBvcnRzID0gSGVyZU1hcHNET01NYXJrZXI7XHJcblxyXG5IZXJlTWFwc0RPTU1hcmtlci4kaW5qZWN0ID0gWydIZXJlTWFwc01hcmtlckludGVyZmFjZSddO1xyXG5mdW5jdGlvbiBIZXJlTWFwc0RPTU1hcmtlcihIZXJlTWFwc01hcmtlckludGVyZmFjZSl7XHJcbiAgICBmdW5jdGlvbiBET01NYXJrZXIocGxhY2Upe1xyXG4gICAgICAgIHRoaXMucGxhY2UgPSBwbGFjZTtcclxuICAgICAgICB0aGlzLnNldENvb3JkcygpO1xyXG4gICAgfVxyXG5cclxuICAgIHZhciBwcm90byA9IERPTU1hcmtlci5wcm90b3R5cGUgPSBuZXcgSGVyZU1hcHNNYXJrZXJJbnRlcmZhY2UoKTtcclxuICAgIHByb3RvLmNvbnN0cnVjdG9yID0gRE9NTWFya2VyO1xyXG5cclxuICAgIHByb3RvLmNyZWF0ZSA9IGNyZWF0ZTtcclxuICAgIHByb3RvLmdldEljb24gPSBnZXRJY29uO1xyXG4gICAgcHJvdG8uc2V0dXBFdmVudHMgPSBzZXR1cEV2ZW50cztcclxuXHJcbiAgICByZXR1cm4gRE9NTWFya2VyO1xyXG4gICAgXHJcbiAgICBmdW5jdGlvbiBjcmVhdGUoKXtcclxuICAgICAgICB2YXIgbWFya2VyID0gbmV3IEgubWFwLkRvbU1hcmtlcih0aGlzLmNvb3Jkcywge1xyXG4gICAgICAgICAgICBpY29uOiB0aGlzLmdldEljb24oKVxyXG4gICAgICAgIH0pO1xyXG4gICAgICAgIFxyXG4gICAgICAgIHRoaXMuYWRkSW5mb0J1YmJsZShtYXJrZXIpO1xyXG4gICAgICAgIFxyXG4gICAgICAgIHJldHVybiBtYXJrZXI7XHJcbiAgICB9XHJcbiAgICBcclxuICAgIGZ1bmN0aW9uIGdldEljb24oKXtcclxuICAgICAgICB2YXIgaWNvbiA9IHRoaXMucGxhY2UubWFya3VwO1xyXG4gICAgICAgICBpZighaWNvbilcclxuICAgICAgICAgICAgdGhyb3cgbmV3IEVycm9yKCdtYXJrdXAgbWlzc2VkJyk7XHJcblxyXG4gICAgICAgIHJldHVybiBuZXcgSC5tYXAuRG9tSWNvbihpY29uKTtcclxuICAgIH1cclxuICAgIFxyXG4gICAgZnVuY3Rpb24gc2V0dXBFdmVudHMoZWwsIGV2ZW50cywgcmVtb3ZlKXtcclxuICAgICAgICB2YXIgbWV0aG9kID0gcmVtb3ZlID8gJ3JlbW92ZUV2ZW50TGlzdGVuZXInIDogJ2FkZEV2ZW50TGlzdGVuZXInO1xyXG5cclxuICAgICAgICBmb3IodmFyIGtleSBpbiBldmVudHMpIHtcclxuICAgICAgICAgICAgaWYoIWV2ZW50cy5oYXNPd25Qcm9wZXJ0eShrZXkpKVxyXG4gICAgICAgICAgICAgICAgY29udGludWU7XHJcblxyXG4gICAgICAgICAgICBlbFttZXRob2RdLmNhbGwobnVsbCwga2V5LCBldmVudHNba2V5XSk7XHJcbiAgICAgICAgfVxyXG4gICAgfVxyXG59IiwibW9kdWxlLmV4cG9ydHMgPSBhbmd1bGFyLm1vZHVsZSgnaGVyZW1hcHMtbWFya2Vycy1tb2R1bGUnLCBbXSlcclxuICAgIC5mYWN0b3J5KCdIZXJlTWFwc01hcmtlckludGVyZmFjZScsIHJlcXVpcmUoJy4vbWFya2VyLmpzJykpXHJcbiAgICAuZmFjdG9yeSgnSGVyZU1hcHNEZWZhdWx0TWFya2VyJywgcmVxdWlyZSgnLi9kZWZhdWx0Lm1hcmtlci5qcycpKVxyXG4gICAgLmZhY3RvcnkoJ0hlcmVNYXBzRE9NTWFya2VyJywgcmVxdWlyZSgnLi9kb20ubWFya2VyLmpzJykpXHJcbiAgICAuZmFjdG9yeSgnSGVyZU1hcHNTVkdNYXJrZXInLCByZXF1aXJlKCcuL3N2Zy5tYXJrZXIuanMnKSlcclxuICAgIC5zZXJ2aWNlKCdIZXJlTWFwc01hcmtlclNlcnZpY2UnLCByZXF1aXJlKCcuL21hcmtlcnMuc2VydmljZS5qcycpKTsiLCJtb2R1bGUuZXhwb3J0cyA9IGZ1bmN0aW9uKCl7XHJcbiAgICBmdW5jdGlvbiBNYXJrZXJJbnRlcmZhY2UoKXtcclxuICAgICAgICB0aHJvdyBuZXcgRXJyb3IoJ0Fic3RyYWN0IGNsYXNzISBUaGUgSW5zdGFuY2Ugc2hvdWxkIGJlIGNyZWF0ZWQnKTtcclxuICAgIH1cclxuICAgIFxyXG4gICAgdmFyIHByb3RvID0gTWFya2VySW50ZXJmYWNlLnByb3RvdHlwZTtcclxuICAgIFxyXG4gICAgcHJvdG8uY3JlYXRlID0gY3JlYXRlO1xyXG4gICAgcHJvdG8uc2V0Q29vcmRzID0gc2V0Q29vcmRzO1xyXG4gICAgcHJvdG8uYWRkSW5mb0J1YmJsZSA9IGFkZEluZm9CdWJibGU7XHJcbiAgICBcclxuICAgIGZ1bmN0aW9uIE1hcmtlcigpe31cclxuICAgIFxyXG4gICAgTWFya2VyLnByb3RvdHlwZSA9IHByb3RvO1xyXG4gICAgXHJcbiAgICByZXR1cm4gTWFya2VyO1xyXG4gICAgXHJcbiAgICBmdW5jdGlvbiBjcmVhdGUoKXtcclxuICAgICAgICB0aHJvdyBuZXcgRXJyb3IoJ2NyZWF0ZTo6IG5vdCBpbXBsZW1lbnRlZCcpOyBcclxuICAgIH1cclxuICAgIFxyXG4gICAgZnVuY3Rpb24gc2V0Q29vcmRzKCl7XHJcbiAgICAgICAgIHRoaXMuY29vcmRzID0ge1xyXG4gICAgICAgICAgICBsYXQ6IHRoaXMucGxhY2UucG9zLmxhdCxcclxuICAgICAgICAgICAgbG5nOiB0aGlzLnBsYWNlLnBvcy5sbmdcclxuICAgICAgICB9XHJcbiAgICB9XHJcbiAgICBcclxuICAgIGZ1bmN0aW9uIGFkZEluZm9CdWJibGUobWFya2VyKXtcclxuICAgICAgICBpZighdGhpcy5wbGFjZS5wb3B1cClcclxuICAgICAgICAgICAgcmV0dXJuO1xyXG4gICAgICAgICAgICBcclxuICAgICAgICBtYXJrZXIuc2V0RGF0YSh0aGlzLnBsYWNlLnBvcHVwKVxyXG4gICAgfVxyXG59IiwibW9kdWxlLmV4cG9ydHMgPSBIZXJlTWFwc01hcmtlclNlcnZpY2U7XHJcblxyXG5IZXJlTWFwc01hcmtlclNlcnZpY2UuJGluamVjdCA9IFtcclxuICAgICdIZXJlTWFwc0RlZmF1bHRNYXJrZXInLFxyXG4gICAgJ0hlcmVNYXBzRE9NTWFya2VyJyxcclxuICAgICdIZXJlTWFwc1NWR01hcmtlcicsXHJcbiAgICAnSGVyZU1hcHNDT05TVFMnXHJcbl07XHJcbmZ1bmN0aW9uIEhlcmVNYXBzTWFya2VyU2VydmljZShIZXJlTWFwc0RlZmF1bHRNYXJrZXIsIEhlcmVNYXBzRE9NTWFya2VyLCBIZXJlTWFwc1NWR01hcmtlciwgSGVyZU1hcHNDT05TVFMpIHtcclxuICAgIHZhciBNQVJLRVJfVFlQRVMgPSBIZXJlTWFwc0NPTlNUUy5NQVJLRVJfVFlQRVM7XHJcblxyXG4gICAgcmV0dXJuIHtcclxuICAgICAgICBhZGRNYXJrZXJzVG9NYXA6IGFkZE1hcmtlcnNUb01hcCxcclxuICAgICAgICBhZGRVc2VyTWFya2VyOiBhZGRVc2VyTWFya2VyLFxyXG4gICAgICAgIHVwZGF0ZU1hcmtlcnM6IHVwZGF0ZU1hcmtlcnMsXHJcbiAgICAgICAgaXNNYXJrZXJJbnN0YW5jZTogaXNNYXJrZXJJbnN0YW5jZSxcclxuICAgICAgICBzZXRWaWV3Qm91bmRzOiBzZXRWaWV3Qm91bmRzXHJcbiAgICB9XHJcblxyXG4gICAgZnVuY3Rpb24gaXNNYXJrZXJJbnN0YW5jZSh0YXJnZXQpIHtcclxuICAgICAgICByZXR1cm4gdGFyZ2V0IGluc3RhbmNlb2YgSC5tYXAuTWFya2VyIHx8IHRhcmdldCBpbnN0YW5jZW9mIEgubWFwLkRvbU1hcmtlcjtcclxuICAgIH1cclxuXHJcbiAgICBmdW5jdGlvbiBhZGRVc2VyTWFya2VyKG1hcCwgcGxhY2UpIHtcclxuICAgICAgICBpZiAobWFwLnVzZXJNYXJrZXIpXHJcbiAgICAgICAgICAgIHJldHVybiBtYXAudXNlck1hcmtlcjtcclxuXHJcbiAgICAgICAgcGxhY2UubWFya3VwID0gJzxzdmcgd2lkdGg9XCIzNXB4XCIgaGVpZ2h0PVwiMzVweFwiIHZpZXdCb3g9XCIwIDAgOTAgOTBcIiB2ZXJzaW9uPVwiMS4xXCIgeG1sbnM9XCJodHRwOi8vd3d3LnczLm9yZy8yMDAwL3N2Z1wiIHhtbG5zOnhsaW5rPVwiaHR0cDovL3d3dy53My5vcmcvMTk5OS94bGlua1wiPicgK1xyXG4gICAgICAgICAgICAnPGRlZnM+PGNpcmNsZSBpZD1cInBhdGgtMVwiIGN4PVwiMzAyXCIgY3k9XCI4MDJcIiByPVwiMTVcIj48L2NpcmNsZT4nICtcclxuICAgICAgICAgICAgJzxtYXNrIGlkPVwibWFzay0yXCIgbWFza0NvbnRlbnRVbml0cz1cInVzZXJTcGFjZU9uVXNlXCIgbWFza1VuaXRzPVwib2JqZWN0Qm91bmRpbmdCb3hcIiB4PVwiLTMwXCIgeT1cIi0zMFwiIHdpZHRoPVwiOTBcIiBoZWlnaHQ9XCI5MFwiPicgK1xyXG4gICAgICAgICAgICAnPHJlY3QgeD1cIjI1N1wiIHk9XCI3NTdcIiB3aWR0aD1cIjkwXCIgaGVpZ2h0PVwiOTBcIiBmaWxsPVwid2hpdGVcIj48L3JlY3Q+PHVzZSB4bGluazpocmVmPVwiI3BhdGgtMVwiIGZpbGw9XCJibGFja1wiPjwvdXNlPicgK1xyXG4gICAgICAgICAgICAnPC9tYXNrPjwvZGVmcz48ZyBpZD1cIlBhZ2UtMVwiIHN0cm9rZT1cIm5vbmVcIiBzdHJva2Utd2lkdGg9XCIxXCIgZmlsbD1cIm5vbmVcIiBmaWxsLXJ1bGU9XCJldmVub2RkXCI+JyArXHJcbiAgICAgICAgICAgICc8ZyBpZD1cIlNlcnZpY2UtT3B0aW9ucy0tLWRpcmVjdGlvbnMtLS1tYXBcIiB0cmFuc2Zvcm09XCJ0cmFuc2xhdGUoLTI1Ny4wMDAwMDAsIC03NTcuMDAwMDAwKVwiPjxnIGlkPVwiT3ZhbC0xNVwiPicgK1xyXG4gICAgICAgICAgICAnPHVzZSBmaWxsPVwiI0ZGRkZGRlwiIGZpbGwtcnVsZT1cImV2ZW5vZGRcIiB4bGluazpocmVmPVwiI3BhdGgtMVwiPjwvdXNlPicgK1xyXG4gICAgICAgICAgICAnPHVzZSBzdHJva2Utb3BhY2l0eT1cIjAuMjk2MTM5MDRcIiBzdHJva2U9XCIjM0YzNEEwXCIgbWFzaz1cInVybCgjbWFzay0yKVwiIHN0cm9rZS13aWR0aD1cIjYwXCIgeGxpbms6aHJlZj1cIiNwYXRoLTFcIj48L3VzZT4nICtcclxuICAgICAgICAgICAgJzx1c2Ugc3Ryb2tlPVwiIzNGMzRBMFwiIHN0cm9rZS13aWR0aD1cIjVcIiB4bGluazpocmVmPVwiI3BhdGgtMVwiPjwvdXNlPjwvZz48L2c+PC9nPjwvc3ZnPic7XHJcblxyXG4gICAgICAgIG1hcC51c2VyTWFya2VyID0gbmV3IEhlcmVNYXBzU1ZHTWFya2VyKHBsYWNlKS5jcmVhdGUoKTtcclxuXHJcbiAgICAgICAgbWFwLmFkZE9iamVjdChtYXAudXNlck1hcmtlcik7XHJcblxyXG4gICAgICAgIHJldHVybiBtYXAudXNlck1hcmtlcjtcclxuICAgIH1cclxuXHJcbiAgICBmdW5jdGlvbiBhZGRNYXJrZXJzVG9NYXAobWFwLCBwbGFjZXMsIHJlZnJlc2hWaWV3Ym91bmRzKSB7XHJcbiAgICAgICAgaWYgKCFwbGFjZXMgfHwgIXBsYWNlcy5sZW5ndGgpXHJcbiAgICAgICAgICAgIHJldHVybjtcclxuXHJcbiAgICAgICAgaWYgKCEobWFwIGluc3RhbmNlb2YgSC5NYXApKVxyXG4gICAgICAgICAgICB0aHJvdyBuZXcgRXJyb3IoJ1Vuc3VwcG9ydGVkIG1hcCBpbnN0YW5jZScpO1xyXG5cclxuICAgICAgICBpZiAoIW1hcC5tYXJrZXJzR3JvdXApXHJcbiAgICAgICAgICAgIG1hcC5tYXJrZXJzR3JvdXAgPSBuZXcgSC5tYXAuR3JvdXAoKTtcclxuXHJcbiAgICAgICAgcGxhY2VzLmZvckVhY2goZnVuY3Rpb24gKHBsYWNlLCBpKSB7XHJcbiAgICAgICAgICAgIHZhciBjcmVhdG9yID0gX2dldE1hcmtlckNyZWF0b3IocGxhY2UpLFxyXG4gICAgICAgICAgICAgICAgbWFya2VyID0gcGxhY2UuZHJhZ2dhYmxlID8gX2RyYWdnYWJsZU1hcmtlck1peGluKGNyZWF0b3IuY3JlYXRlKCkpIDogY3JlYXRvci5jcmVhdGUoKTtcclxuXHJcbiAgICAgICAgICAgIG1hcC5tYXJrZXJzR3JvdXAuYWRkT2JqZWN0KG1hcmtlcik7XHJcbiAgICAgICAgfSk7XHJcblxyXG4gICAgICAgIG1hcC5hZGRPYmplY3QobWFwLm1hcmtlcnNHcm91cCk7XHJcblxyXG4gICAgICAgIGlmIChyZWZyZXNoVmlld2JvdW5kcykge1xyXG4gICAgICAgICAgICBzZXRWaWV3Qm91bmRzKG1hcCwgbWFwLm1hcmtlcnNHcm91cC5nZXRCb3VuZHMoKSk7XHJcbiAgICAgICAgfVxyXG4gICAgfVxyXG5cclxuICAgIGZ1bmN0aW9uIHNldFZpZXdCb3VuZHMobWFwLCBib3VuZHMsIG9wdF9hbmltYXRlKSB7XHJcbiAgICAgICAgbWFwLnNldFZpZXdCb3VuZHMoYm91bmRzLCAhIW9wdF9hbmltYXRlKTtcclxuICAgIH1cclxuXHJcbiAgICBmdW5jdGlvbiB1cGRhdGVNYXJrZXJzKG1hcCwgcGxhY2VzLCByZWZyZXNoVmlld2JvdW5kcykge1xyXG4gICAgICAgIGlmIChtYXAubWFya2Vyc0dyb3VwKSB7XHJcbiAgICAgICAgICAgIG1hcC5tYXJrZXJzR3JvdXAucmVtb3ZlQWxsKCk7XHJcbiAgICAgICAgICAgIG1hcC5yZW1vdmVPYmplY3QobWFwLm1hcmtlcnNHcm91cCk7XHJcbiAgICAgICAgICAgIG1hcC5tYXJrZXJzR3JvdXAgPSBudWxsO1xyXG4gICAgICAgIH1cclxuXHJcbiAgICAgICAgYWRkTWFya2Vyc1RvTWFwLmFwcGx5KG51bGwsIGFyZ3VtZW50cyk7XHJcbiAgICB9XHJcblxyXG4gICAgZnVuY3Rpb24gX2dldE1hcmtlckNyZWF0b3IocGxhY2UpIHtcclxuICAgICAgICB2YXIgQ29uY3JldGVNYXJrZXIsXHJcbiAgICAgICAgICAgIHR5cGUgPSBwbGFjZS50eXBlID8gcGxhY2UudHlwZS50b1VwcGVyQ2FzZSgpIDogbnVsbDtcclxuXHJcbiAgICAgICAgc3dpdGNoICh0eXBlKSB7XHJcbiAgICAgICAgICAgIGNhc2UgTUFSS0VSX1RZUEVTLkRPTTpcclxuICAgICAgICAgICAgICAgIENvbmNyZXRlTWFya2VyID0gSGVyZU1hcHNET01NYXJrZXI7XHJcbiAgICAgICAgICAgICAgICBicmVhaztcclxuICAgICAgICAgICAgY2FzZSBNQVJLRVJfVFlQRVMuU1ZHOlxyXG4gICAgICAgICAgICAgICAgQ29uY3JldGVNYXJrZXIgPSBIZXJlTWFwc1NWR01hcmtlcjtcclxuICAgICAgICAgICAgICAgIGJyZWFrO1xyXG4gICAgICAgICAgICBkZWZhdWx0OlxyXG4gICAgICAgICAgICAgICAgQ29uY3JldGVNYXJrZXIgPSBIZXJlTWFwc0RlZmF1bHRNYXJrZXI7XHJcbiAgICAgICAgfVxyXG5cclxuICAgICAgICByZXR1cm4gbmV3IENvbmNyZXRlTWFya2VyKHBsYWNlKTtcclxuICAgIH1cclxuXHJcbiAgICBmdW5jdGlvbiBfZHJhZ2dhYmxlTWFya2VyTWl4aW4obWFya2VyKSB7XHJcbiAgICAgICAgbWFya2VyLmRyYWdnYWJsZSA9IHRydWU7XHJcblxyXG4gICAgICAgIHJldHVybiBtYXJrZXI7XHJcbiAgICB9XHJcbn07XHJcbiIsIm1vZHVsZS5leHBvcnRzID0gSGVyZU1hcHNTVkdNYXJrZXI7XHJcblxyXG5IZXJlTWFwc1NWR01hcmtlci4kaW5qZWN0ID0gWydIZXJlTWFwc01hcmtlckludGVyZmFjZSddO1xyXG5mdW5jdGlvbiBIZXJlTWFwc1NWR01hcmtlcihIZXJlTWFwc01hcmtlckludGVyZmFjZSl7XHJcbiAgICBmdW5jdGlvbiBTVkdNYXJrZXIocGxhY2Upe1xyXG4gICAgICAgIHRoaXMucGxhY2UgPSBwbGFjZTtcclxuICAgICAgICB0aGlzLnNldENvb3JkcygpO1xyXG4gICAgfVxyXG4gICAgXHJcbiAgICB2YXIgcHJvdG8gPSBTVkdNYXJrZXIucHJvdG90eXBlID0gbmV3IEhlcmVNYXBzTWFya2VySW50ZXJmYWNlKCk7XHJcbiAgICBwcm90by5jb25zdHJ1Y3RvciA9IFNWR01hcmtlcjtcclxuICAgIFxyXG4gICAgcHJvdG8uY3JlYXRlID0gY3JlYXRlO1xyXG4gICAgcHJvdG8uZ2V0SWNvbiA9IGdldEljb247XHJcbiAgICBcclxuICAgIHJldHVybiBTVkdNYXJrZXI7XHJcbiAgICBcclxuICAgIGZ1bmN0aW9uIGNyZWF0ZSgpe1xyXG4gICAgICAgIHZhciBtYXJrZXIgPSBuZXcgSC5tYXAuTWFya2VyKHRoaXMuY29vcmRzLCB7XHJcbiAgICAgICAgICAgIGljb246IHRoaXMuZ2V0SWNvbigpLFxyXG4gICAgICAgIH0pO1xyXG4gICAgICAgIFxyXG4gICAgICAgIHRoaXMuYWRkSW5mb0J1YmJsZShtYXJrZXIpO1xyXG4gICAgICAgIFxyXG4gICAgICAgIHJldHVybiBtYXJrZXI7XHJcbiAgICB9XHJcbiAgICBcclxuICAgIGZ1bmN0aW9uIGdldEljb24oKXtcclxuICAgICAgICB2YXIgaWNvbiA9IHRoaXMucGxhY2UubWFya3VwO1xyXG4gICAgICAgICBpZighaWNvbilcclxuICAgICAgICAgICAgdGhyb3cgbmV3IEVycm9yKCdtYXJrdXAgbWlzc2VkJyk7XHJcblxyXG4gICAgICAgIHJldHVybiBuZXcgSC5tYXAuSWNvbihpY29uKTtcclxuICAgIH1cclxufSIsIm1vZHVsZS5leHBvcnRzID0gYW5ndWxhci5tb2R1bGUoJ2hlcmVtYXBzLXJvdXRlcy1tb2R1bGUnLCBbXSlcclxuICAgICAgICAgICAgICAgICAgICAuc2VydmljZSgnSGVyZU1hcHNSb3V0ZXNTZXJ2aWNlJywgcmVxdWlyZSgnLi9yb3V0ZXMuc2VydmljZS5qcycpKTsgICIsIm1vZHVsZS5leHBvcnRzID0gSGVyZU1hcHNSb3V0ZXNTZXJ2aWNlO1xyXG5cclxuSGVyZU1hcHNSb3V0ZXNTZXJ2aWNlLiRpbmplY3QgPSBbJyRxJywgJ0hlcmVNYXBzTWFya2VyU2VydmljZSddO1xyXG5mdW5jdGlvbiBIZXJlTWFwc1JvdXRlc1NlcnZpY2UoJHEsIEhlcmVNYXBzTWFya2VyU2VydmljZSkge1xyXG4gICAgcmV0dXJuIHtcclxuICAgICAgICBjYWxjdWxhdGVSb3V0ZTogY2FsY3VsYXRlUm91dGUsXHJcbiAgICAgICAgYWRkUm91dGVUb01hcDogYWRkUm91dGVUb01hcCxcclxuICAgICAgICBjbGVhblJvdXRlczogY2xlYW5Sb3V0ZXNcclxuICAgIH1cclxuXHJcbiAgICBmdW5jdGlvbiBjYWxjdWxhdGVSb3V0ZShoZXJlbWFwcywgY29uZmlnKSB7XHJcbiAgICAgICAgdmFyIHBsYXRmb3JtID0gaGVyZW1hcHMucGxhdGZvcm0sXHJcbiAgICAgICAgICAgIG1hcCA9IGhlcmVtYXBzLm1hcCxcclxuICAgICAgICAgICAgcm91dGVyID0gcGxhdGZvcm0uZ2V0Um91dGluZ1NlcnZpY2UoKSxcclxuICAgICAgICAgICAgZGlyID0gY29uZmlnLmRpcmVjdGlvbixcclxuICAgICAgICAgICAgd2F5cG9pbnRzID0gZGlyLndheXBvaW50cztcclxuXHJcbiAgICAgICAgdmFyIG1vZGUgPSAne3tNT0RFfX07e3tWRUNISUxFfX0nXHJcbiAgICAgICAgICAgIC5yZXBsYWNlKC97e01PREV9fS8sIGRpci5tb2RlIHx8ICdmYXN0ZXN0JylcclxuICAgICAgICAgICAgLnJlcGxhY2UoL3t7VkVDSElMRX19LywgY29uZmlnLmRyaXZlVHlwZSk7XHJcblxyXG4gICAgICAgIHZhciByb3V0ZVJlcXVlc3RQYXJhbXMgPSB7XHJcbiAgICAgICAgICAgIG1vZGU6IG1vZGUsXHJcbiAgICAgICAgICAgIHJlcHJlc2VudGF0aW9uOiBkaXIucmVwcmVzZW50YXRpb24gfHwgJ2Rpc3BsYXknLFxyXG4gICAgICAgICAgICBsYW5ndWFnZTogZGlyLmxhbmd1YWdlIHx8ICdlbi1nYidcclxuICAgICAgICB9O1xyXG5cclxuICAgICAgICB3YXlwb2ludHMuZm9yRWFjaChmdW5jdGlvbiAod2F5cG9pbnQsIGkpIHtcclxuICAgICAgICAgICAgcm91dGVSZXF1ZXN0UGFyYW1zW1wid2F5cG9pbnRcIiArIGldID0gW3dheXBvaW50LmxhdCwgd2F5cG9pbnQubG5nXS5qb2luKCcsJyk7XHJcbiAgICAgICAgfSk7XHJcblxyXG4gICAgICAgIF9zZXRBdHRyaWJ1dGVzKHJvdXRlUmVxdWVzdFBhcmFtcywgZGlyLmF0dHJzKTtcclxuXHJcbiAgICAgICAgdmFyIGRlZmVycmVkID0gJHEuZGVmZXIoKTtcclxuXHJcbiAgICAgICAgcm91dGVyLmNhbGN1bGF0ZVJvdXRlKHJvdXRlUmVxdWVzdFBhcmFtcywgZnVuY3Rpb24gKHJlc3VsdCkge1xyXG4gICAgICAgICAgICBkZWZlcnJlZC5yZXNvbHZlKHJlc3VsdCk7XHJcbiAgICAgICAgfSwgZnVuY3Rpb24gKGVycm9yKSB7XHJcbiAgICAgICAgICAgIGRlZmVycmVkLnJlamVjdChlcnJvcik7XHJcbiAgICAgICAgfSk7XHJcblxyXG4gICAgICAgIHJldHVybiBkZWZlcnJlZC5wcm9taXNlO1xyXG4gICAgfVxyXG5cclxuICAgIGZ1bmN0aW9uIGNsZWFuUm91dGVzKG1hcCkge1xyXG4gICAgICAgIHZhciBncm91cCA9IG1hcC5yb3V0ZXNHcm91cDtcclxuXHJcbiAgICAgICAgaWYgKCFncm91cClcclxuICAgICAgICAgICAgcmV0dXJuO1xyXG5cclxuICAgICAgICBncm91cC5yZW1vdmVBbGwoKTtcclxuICAgICAgICBtYXAucmVtb3ZlT2JqZWN0KGdyb3VwKTtcclxuICAgICAgICBtYXAucm91dGVzR3JvdXAgPSBudWxsO1xyXG4gICAgfVxyXG5cclxuICAgIGZ1bmN0aW9uIGFkZFJvdXRlVG9NYXAobWFwLCByb3V0ZURhdGEsIGNsZWFuKSB7XHJcbiAgICAgICAgaWYgKGNsZWFuKVxyXG4gICAgICAgICAgICBjbGVhblJvdXRlcyhtYXApO1xyXG5cclxuICAgICAgICB2YXIgcm91dGUgPSByb3V0ZURhdGEucm91dGU7XHJcblxyXG4gICAgICAgIGlmICghbWFwIHx8ICFyb3V0ZSB8fCAhcm91dGUuc2hhcGUpXHJcbiAgICAgICAgICAgIHJldHVybjtcclxuXHJcbiAgICAgICAgdmFyIHN0cmlwID0gbmV3IEguZ2VvLlN0cmlwKCksIHBvbHlsaW5lID0gbnVsbDtcclxuXHJcbiAgICAgICAgcm91dGUuc2hhcGUuZm9yRWFjaChmdW5jdGlvbiAocG9pbnQpIHtcclxuICAgICAgICAgICAgdmFyIHBhcnRzID0gcG9pbnQuc3BsaXQoJywnKTtcclxuICAgICAgICAgICAgc3RyaXAucHVzaExhdExuZ0FsdChwYXJ0c1swXSwgcGFydHNbMV0pO1xyXG4gICAgICAgIH0pO1xyXG5cclxuICAgICAgICB2YXIgc3R5bGUgPSByb3V0ZURhdGEuc3R5bGUgfHwge307XHJcblxyXG4gICAgICAgIHBvbHlsaW5lID0gbmV3IEgubWFwLlBvbHlsaW5lKHN0cmlwLCB7XHJcbiAgICAgICAgICAgIHN0eWxlOiB7XHJcbiAgICAgICAgICAgICAgICBsaW5lV2lkdGg6IHN0eWxlLmxpbmVXaWR0aCB8fCA0LFxyXG4gICAgICAgICAgICAgICAgc3Ryb2tlQ29sb3I6IHN0eWxlLmNvbG9yIHx8ICdyZ2JhKDAsIDEyOCwgMjU1LCAwLjcpJ1xyXG4gICAgICAgICAgICB9XHJcbiAgICAgICAgfSk7XHJcblxyXG4gICAgICAgIHZhciBncm91cCA9IG1hcC5yb3V0ZXNHcm91cDtcclxuXHJcbiAgICAgICAgaWYgKCFncm91cCkge1xyXG4gICAgICAgICAgICBncm91cCA9IG1hcC5yb3V0ZXNHcm91cCA9IG5ldyBILm1hcC5Hcm91cCgpO1xyXG4gICAgICAgICAgICBtYXAuYWRkT2JqZWN0KGdyb3VwKTtcclxuICAgICAgICB9XHJcblxyXG4gICAgICAgIGdyb3VwLmFkZE9iamVjdChwb2x5bGluZSk7XHJcblxyXG4gICAgICAgIGlmKHJvdXRlRGF0YS56b29tVG9Cb3VuZHMpIHtcclxuICAgICAgICAgICAgSGVyZU1hcHNNYXJrZXJTZXJ2aWNlLnNldFZpZXdCb3VuZHMobWFwLCBwb2x5bGluZS5nZXRCb3VuZHMoKSwgdHJ1ZSk7XHJcbiAgICAgICAgfVxyXG4gICAgfVxyXG5cclxuICAgIC8vI3JlZ2lvbiBQUklWQVRFXHJcblxyXG4gICAgZnVuY3Rpb24gX3NldEF0dHJpYnV0ZXMocGFyYW1zLCBhdHRycykge1xyXG4gICAgICAgIHZhciBfa2V5ID0gJ2F0dHJpYnV0ZXMnO1xyXG4gICAgICAgIGZvciAodmFyIGtleSBpbiBhdHRycykge1xyXG4gICAgICAgICAgICBpZiAoIWF0dHJzLmhhc093blByb3BlcnR5KGtleSkpXHJcbiAgICAgICAgICAgICAgICBjb250aW51ZTtcclxuXHJcbiAgICAgICAgICAgIHBhcmFtc1trZXkgKyBfa2V5XSA9IGF0dHJzW2tleV07XHJcbiAgICAgICAgfVxyXG4gICAgfVxyXG5cclxuICAgIC8qKlxyXG4gICAgICogQ3JlYXRlcyBhIHNlcmllcyBvZiBILm1hcC5NYXJrZXIgcG9pbnRzIGZyb20gdGhlIHJvdXRlIGFuZCBhZGRzIHRoZW0gdG8gdGhlIG1hcC5cclxuICAgICAqIEBwYXJhbSB7T2JqZWN0fSByb3V0ZSAgQSByb3V0ZSBhcyByZWNlaXZlZCBmcm9tIHRoZSBILnNlcnZpY2UuUm91dGluZ1NlcnZpY2VcclxuICAgICAqL1xyXG4gICAgZnVuY3Rpb24gYWRkTWFudWV2ZXJzVG9NYXAobWFwLCByb3V0ZSkge1xyXG4gICAgICAgIHZhciBzdmdNYXJrdXAgPSAnPHN2ZyB3aWR0aD1cIjE4XCIgaGVpZ2h0PVwiMThcIiAnICtcclxuICAgICAgICAgICAgJ3htbG5zPVwiaHR0cDovL3d3dy53My5vcmcvMjAwMC9zdmdcIj4nICtcclxuICAgICAgICAgICAgJzxjaXJjbGUgY3g9XCI4XCIgY3k9XCI4XCIgcj1cIjhcIiAnICtcclxuICAgICAgICAgICAgJ2ZpbGw9XCIjMWI0NjhkXCIgc3Ryb2tlPVwid2hpdGVcIiBzdHJva2Utd2lkdGg9XCIxXCIgIC8+JyArXHJcbiAgICAgICAgICAgICc8L3N2Zz4nLFxyXG4gICAgICAgICAgICBkb3RJY29uID0gbmV3IEgubWFwLkljb24oc3ZnTWFya3VwLCB7IGFuY2hvcjogeyB4OiA4LCB5OiA4IH0gfSksXHJcbiAgICAgICAgICAgIGdyb3VwID0gbmV3IEgubWFwLkdyb3VwKCksIGksIGo7XHJcblxyXG4gICAgICAgIC8vIEFkZCBhIG1hcmtlciBmb3IgZWFjaCBtYW5ldXZlclxyXG4gICAgICAgIGZvciAoaSA9IDA7IGkgPCByb3V0ZS5sZWcubGVuZ3RoOyBpICs9IDEpIHtcclxuICAgICAgICAgICAgZm9yIChqID0gMDsgaiA8IHJvdXRlLmxlZ1tpXS5tYW5ldXZlci5sZW5ndGg7IGogKz0gMSkge1xyXG4gICAgICAgICAgICAgICAgLy8gR2V0IHRoZSBuZXh0IG1hbmV1dmVyLlxyXG4gICAgICAgICAgICAgICAgbWFuZXV2ZXIgPSByb3V0ZS5sZWdbaV0ubWFuZXV2ZXJbal07XHJcbiAgICAgICAgICAgICAgICAvLyBBZGQgYSBtYXJrZXIgdG8gdGhlIG1hbmV1dmVycyBncm91cFxyXG4gICAgICAgICAgICAgICAgdmFyIG1hcmtlciA9IG5ldyBILm1hcC5NYXJrZXIoe1xyXG4gICAgICAgICAgICAgICAgICAgIGxhdDogbWFuZXV2ZXIucG9zaXRpb24ubGF0aXR1ZGUsXHJcbiAgICAgICAgICAgICAgICAgICAgbG5nOiBtYW5ldXZlci5wb3NpdGlvbi5sb25naXR1ZGVcclxuICAgICAgICAgICAgICAgIH0sXHJcbiAgICAgICAgICAgICAgICAgICAgeyBpY29uOiBkb3RJY29uIH1cclxuICAgICAgICAgICAgICAgICk7XHJcblxyXG4gICAgICAgICAgICAgICAgbWFya2VyLmluc3RydWN0aW9uID0gbWFuZXV2ZXIuaW5zdHJ1Y3Rpb247XHJcbiAgICAgICAgICAgICAgICBncm91cC5hZGRPYmplY3QobWFya2VyKTtcclxuICAgICAgICAgICAgfVxyXG4gICAgICAgIH1cclxuXHJcbiAgICAgICAgZ3JvdXAuYWRkRXZlbnRMaXN0ZW5lcigndGFwJywgZnVuY3Rpb24gKGV2dCkge1xyXG4gICAgICAgICAgICBtYXAuc2V0Q2VudGVyKGV2dC50YXJnZXQuZ2V0UG9zaXRpb24oKSk7XHJcbiAgICAgICAgICAgIG9wZW5CdWJibGUoZXZ0LnRhcmdldC5nZXRQb3NpdGlvbigpLCBldnQudGFyZ2V0Lmluc3RydWN0aW9uKTtcclxuICAgICAgICB9LCBmYWxzZSk7XHJcblxyXG4gICAgICAgIC8vIEFkZCB0aGUgbWFuZXV2ZXJzIGdyb3VwIHRvIHRoZSBtYXBcclxuICAgICAgICBtYXAuYWRkT2JqZWN0KGdyb3VwKTtcclxuICAgIH1cclxuXHJcblxyXG4gICAgLyoqXHJcbiAgICAgKiBDcmVhdGVzIGEgc2VyaWVzIG9mIEgubWFwLk1hcmtlciBwb2ludHMgZnJvbSB0aGUgcm91dGUgYW5kIGFkZHMgdGhlbSB0byB0aGUgbWFwLlxyXG4gICAgICogQHBhcmFtIHtPYmplY3R9IHJvdXRlICBBIHJvdXRlIGFzIHJlY2VpdmVkIGZyb20gdGhlIEguc2VydmljZS5Sb3V0aW5nU2VydmljZVxyXG4gICAgICovXHJcbiAgICBmdW5jdGlvbiBhZGRXYXlwb2ludHNUb1BhbmVsKHdheXBvaW50cykge1xyXG4gICAgICAgIHZhciBub2RlSDMgPSBkb2N1bWVudC5jcmVhdGVFbGVtZW50KCdoMycpLFxyXG4gICAgICAgICAgICB3YXlwb2ludExhYmVscyA9IFtdLFxyXG4gICAgICAgICAgICBpO1xyXG5cclxuICAgICAgICBmb3IgKGkgPSAwOyBpIDwgd2F5cG9pbnRzLmxlbmd0aDsgaSArPSAxKSB7XHJcbiAgICAgICAgICAgIHdheXBvaW50TGFiZWxzLnB1c2god2F5cG9pbnRzW2ldLmxhYmVsKVxyXG4gICAgICAgIH1cclxuXHJcbiAgICAgICAgbm9kZUgzLnRleHRDb250ZW50ID0gd2F5cG9pbnRMYWJlbHMuam9pbignIC0gJyk7XHJcblxyXG4gICAgICAgIHJvdXRlSW5zdHJ1Y3Rpb25zQ29udGFpbmVyLmlubmVySFRNTCA9ICcnO1xyXG4gICAgICAgIHJvdXRlSW5zdHJ1Y3Rpb25zQ29udGFpbmVyLmFwcGVuZENoaWxkKG5vZGVIMyk7XHJcbiAgICB9XHJcblxyXG4gICAgLyoqXHJcbiAgICAgKiBDcmVhdGVzIGEgc2VyaWVzIG9mIEgubWFwLk1hcmtlciBwb2ludHMgZnJvbSB0aGUgcm91dGUgYW5kIGFkZHMgdGhlbSB0byB0aGUgbWFwLlxyXG4gICAgICogQHBhcmFtIHtPYmplY3R9IHJvdXRlICBBIHJvdXRlIGFzIHJlY2VpdmVkIGZyb20gdGhlIEguc2VydmljZS5Sb3V0aW5nU2VydmljZVxyXG4gICAgICovXHJcbiAgICBmdW5jdGlvbiBhZGRTdW1tYXJ5VG9QYW5lbChzdW1tYXJ5KSB7XHJcbiAgICAgICAgdmFyIHN1bW1hcnlEaXYgPSBkb2N1bWVudC5jcmVhdGVFbGVtZW50KCdkaXYnKSxcclxuICAgICAgICAgICAgY29udGVudCA9ICcnO1xyXG5cclxuICAgICAgICBjb250ZW50ICs9ICc8Yj5Ub3RhbCBkaXN0YW5jZTwvYj46ICcgKyBzdW1tYXJ5LmRpc3RhbmNlICsgJ20uIDxici8+JztcclxuICAgICAgICBjb250ZW50ICs9ICc8Yj5UcmF2ZWwgVGltZTwvYj46ICcgKyBzdW1tYXJ5LnRyYXZlbFRpbWUudG9NTVNTKCkgKyAnIChpbiBjdXJyZW50IHRyYWZmaWMpJztcclxuXHJcblxyXG4gICAgICAgIHN1bW1hcnlEaXYuc3R5bGUuZm9udFNpemUgPSAnc21hbGwnO1xyXG4gICAgICAgIHN1bW1hcnlEaXYuc3R5bGUubWFyZ2luTGVmdCA9ICc1JSc7XHJcbiAgICAgICAgc3VtbWFyeURpdi5zdHlsZS5tYXJnaW5SaWdodCA9ICc1JSc7XHJcbiAgICAgICAgc3VtbWFyeURpdi5pbm5lckhUTUwgPSBjb250ZW50O1xyXG4gICAgICAgIHJvdXRlSW5zdHJ1Y3Rpb25zQ29udGFpbmVyLmFwcGVuZENoaWxkKHN1bW1hcnlEaXYpO1xyXG4gICAgfVxyXG5cclxuICAgIC8qKlxyXG4gICAgICogQ3JlYXRlcyBhIHNlcmllcyBvZiBILm1hcC5NYXJrZXIgcG9pbnRzIGZyb20gdGhlIHJvdXRlIGFuZCBhZGRzIHRoZW0gdG8gdGhlIG1hcC5cclxuICAgICAqIEBwYXJhbSB7T2JqZWN0fSByb3V0ZSAgQSByb3V0ZSBhcyByZWNlaXZlZCBmcm9tIHRoZSBILnNlcnZpY2UuUm91dGluZ1NlcnZpY2VcclxuICAgICAqL1xyXG4gICAgZnVuY3Rpb24gYWRkTWFudWV2ZXJzVG9QYW5lbChyb3V0ZSkge1xyXG4gICAgICAgIHZhciBub2RlT0wgPSBkb2N1bWVudC5jcmVhdGVFbGVtZW50KCdvbCcpLCBpLCBqO1xyXG5cclxuICAgICAgICBub2RlT0wuc3R5bGUuZm9udFNpemUgPSAnc21hbGwnO1xyXG4gICAgICAgIG5vZGVPTC5zdHlsZS5tYXJnaW5MZWZ0ID0gJzUlJztcclxuICAgICAgICBub2RlT0wuc3R5bGUubWFyZ2luUmlnaHQgPSAnNSUnO1xyXG4gICAgICAgIG5vZGVPTC5jbGFzc05hbWUgPSAnZGlyZWN0aW9ucyc7XHJcblxyXG4gICAgICAgIC8vIEFkZCBhIG1hcmtlciBmb3IgZWFjaCBtYW5ldXZlclxyXG4gICAgICAgIGZvciAoaSA9IDA7IGkgPCByb3V0ZS5sZWcubGVuZ3RoOyBpICs9IDEpIHtcclxuICAgICAgICAgICAgZm9yIChqID0gMDsgaiA8IHJvdXRlLmxlZ1tpXS5tYW5ldXZlci5sZW5ndGg7IGogKz0gMSkge1xyXG4gICAgICAgICAgICAgICAgLy8gR2V0IHRoZSBuZXh0IG1hbmV1dmVyLlxyXG4gICAgICAgICAgICAgICAgbWFuZXV2ZXIgPSByb3V0ZS5sZWdbaV0ubWFuZXV2ZXJbal07XHJcblxyXG4gICAgICAgICAgICAgICAgdmFyIGxpID0gZG9jdW1lbnQuY3JlYXRlRWxlbWVudCgnbGknKSxcclxuICAgICAgICAgICAgICAgICAgICBzcGFuQXJyb3cgPSBkb2N1bWVudC5jcmVhdGVFbGVtZW50KCdzcGFuJyksXHJcbiAgICAgICAgICAgICAgICAgICAgc3Bhbkluc3RydWN0aW9uID0gZG9jdW1lbnQuY3JlYXRlRWxlbWVudCgnc3BhbicpO1xyXG5cclxuICAgICAgICAgICAgICAgIHNwYW5BcnJvdy5jbGFzc05hbWUgPSAnYXJyb3cgJyArIG1hbmV1dmVyLmFjdGlvbjtcclxuICAgICAgICAgICAgICAgIHNwYW5JbnN0cnVjdGlvbi5pbm5lckhUTUwgPSBtYW5ldXZlci5pbnN0cnVjdGlvbjtcclxuICAgICAgICAgICAgICAgIGxpLmFwcGVuZENoaWxkKHNwYW5BcnJvdyk7XHJcbiAgICAgICAgICAgICAgICBsaS5hcHBlbmRDaGlsZChzcGFuSW5zdHJ1Y3Rpb24pO1xyXG5cclxuICAgICAgICAgICAgICAgIG5vZGVPTC5hcHBlbmRDaGlsZChsaSk7XHJcbiAgICAgICAgICAgIH1cclxuICAgICAgICB9XHJcblxyXG4gICAgICAgIHJvdXRlSW5zdHJ1Y3Rpb25zQ29udGFpbmVyLmFwcGVuZENoaWxkKG5vZGVPTCk7XHJcbiAgICB9XHJcblxyXG59O1xyXG4iXX0=
