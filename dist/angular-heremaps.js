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
                throw new Error('app_id or app_code were missed. Please specify these settings in HereMapsConfig');

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

            if (HereMapsConfig.mapTileConfig)
                _setCustomMapStyles(map, HereMapsConfig.mapTileConfig);

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
        
        function _setCustomMapStyles(map, config) {
            // Create a MapTileService instance to request base tiles (i.e. base.map.api.here.com):
            var mapTileService = heremaps.platform.getMapTileService({ 'type': 'base' });

            // Create a tile layer which requests map tiles
            var newStyleLayer = mapTileService.createTileLayer(
                'maptile', 
                config.scheme || 'normal.day', 
                config.size || 256, 
                config.format || 'png8', 
                config.metadataQueryParams || {}
            );
            
            // Set new style layer as a base layer on the map:
            map.setBaseLayer(newStyleLayer);
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
            useCIT: !!options.useCIT,
            mapTileConfig: options.mapTileConfig
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
//# sourceMappingURL=data:application/json;charset=utf-8;base64,eyJ2ZXJzaW9uIjozLCJzb3VyY2VzIjpbIm5vZGVfbW9kdWxlcy9icm93c2VyLXBhY2svX3ByZWx1ZGUuanMiLCJzcmMvaGVyZW1hcHMuZGlyZWN0aXZlLmpzIiwic3JjL2luZGV4LmpzIiwic3JjL3Byb3ZpZGVycy9hcGkuc2VydmljZS5qcyIsInNyYy9wcm92aWRlcnMvY29uc3RzLmpzIiwic3JjL3Byb3ZpZGVycy9tYXAtbW9kdWxlcy9ldmVudHMvZXZlbnRzLmpzIiwic3JjL3Byb3ZpZGVycy9tYXAtbW9kdWxlcy9ldmVudHMvaW5mb2J1YmJsZS5qcyIsInNyYy9wcm92aWRlcnMvbWFwLW1vZHVsZXMvaW5kZXguanMiLCJzcmMvcHJvdmlkZXJzL21hcC1tb2R1bGVzL3VpL3VpLmpzIiwic3JjL3Byb3ZpZGVycy9tYXBjb25maWcucHJvdmlkZXIuanMiLCJzcmMvcHJvdmlkZXJzL21hcHV0aWxzLnNlcnZpY2UuanMiLCJzcmMvcHJvdmlkZXJzL21hcmtlcnMvZGVmYXVsdC5tYXJrZXIuanMiLCJzcmMvcHJvdmlkZXJzL21hcmtlcnMvZG9tLm1hcmtlci5qcyIsInNyYy9wcm92aWRlcnMvbWFya2Vycy9pbmRleC5qcyIsInNyYy9wcm92aWRlcnMvbWFya2Vycy9tYXJrZXIuanMiLCJzcmMvcHJvdmlkZXJzL21hcmtlcnMvbWFya2Vycy5zZXJ2aWNlLmpzIiwic3JjL3Byb3ZpZGVycy9tYXJrZXJzL3N2Zy5tYXJrZXIuanMiLCJzcmMvcHJvdmlkZXJzL3JvdXRlcy9pbmRleC5qcyIsInNyYy9wcm92aWRlcnMvcm91dGVzL3JvdXRlcy5zZXJ2aWNlLmpzIl0sIm5hbWVzIjpbXSwibWFwcGluZ3MiOiJBQUFBO0FDQUE7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTs7QUNqU0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBOztBQ2RBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBOztBQ2pVQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7O0FDcEVBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTs7QUM5R0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTs7QUMzRkE7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTs7QUNWQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBOztBQ3BHQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTs7QUNsQkE7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7O0FDaEpBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTs7QUN2QkE7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTs7QUM5Q0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBOztBQ0xBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7O0FDbENBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7O0FDMUdBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7O0FDbENBO0FBQ0E7O0FDREE7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQSIsImZpbGUiOiJnZW5lcmF0ZWQuanMiLCJzb3VyY2VSb290IjoiIiwic291cmNlc0NvbnRlbnQiOlsiKGZ1bmN0aW9uIGUodCxuLHIpe2Z1bmN0aW9uIHMobyx1KXtpZighbltvXSl7aWYoIXRbb10pe3ZhciBhPXR5cGVvZiByZXF1aXJlPT1cImZ1bmN0aW9uXCImJnJlcXVpcmU7aWYoIXUmJmEpcmV0dXJuIGEobywhMCk7aWYoaSlyZXR1cm4gaShvLCEwKTt2YXIgZj1uZXcgRXJyb3IoXCJDYW5ub3QgZmluZCBtb2R1bGUgJ1wiK28rXCInXCIpO3Rocm93IGYuY29kZT1cIk1PRFVMRV9OT1RfRk9VTkRcIixmfXZhciBsPW5bb109e2V4cG9ydHM6e319O3Rbb11bMF0uY2FsbChsLmV4cG9ydHMsZnVuY3Rpb24oZSl7dmFyIG49dFtvXVsxXVtlXTtyZXR1cm4gcyhuP246ZSl9LGwsbC5leHBvcnRzLGUsdCxuLHIpfXJldHVybiBuW29dLmV4cG9ydHN9dmFyIGk9dHlwZW9mIHJlcXVpcmU9PVwiZnVuY3Rpb25cIiYmcmVxdWlyZTtmb3IodmFyIG89MDtvPHIubGVuZ3RoO28rKylzKHJbb10pO3JldHVybiBzfSkiLCJtb2R1bGUuZXhwb3J0cyA9IEhlcmVNYXBzRGlyZWN0aXZlO1xuXG5IZXJlTWFwc0RpcmVjdGl2ZS4kaW5qZWN0ID0gW1xuICAgICckdGltZW91dCcsXG4gICAgJyR3aW5kb3cnLFxuICAgICckcm9vdFNjb3BlJyxcbiAgICAnJGZpbHRlcicsXG4gICAgJ0hlcmVNYXBzQ29uZmlnJyxcbiAgICAnSGVyZU1hcHNBUElTZXJ2aWNlJyxcbiAgICAnSGVyZU1hcHNVdGlsc1NlcnZpY2UnLFxuICAgICdIZXJlTWFwc01hcmtlclNlcnZpY2UnLFxuICAgICdIZXJlTWFwc1JvdXRlc1NlcnZpY2UnLFxuICAgICdIZXJlTWFwc0NPTlNUUycsXG4gICAgJ0hlcmVNYXBzRXZlbnRzRmFjdG9yeScsXG4gICAgJ0hlcmVNYXBzVWlGYWN0b3J5J1xuXTtcbmZ1bmN0aW9uIEhlcmVNYXBzRGlyZWN0aXZlKFxuICAgICR0aW1lb3V0LFxuICAgICR3aW5kb3csXG4gICAgJHJvb3RTY29wZSxcbiAgICAkZmlsdGVyLFxuICAgIEhlcmVNYXBzQ29uZmlnLFxuICAgIEhlcmVNYXBzQVBJU2VydmljZSxcbiAgICBIZXJlTWFwc1V0aWxzU2VydmljZSxcbiAgICBIZXJlTWFwc01hcmtlclNlcnZpY2UsXG4gICAgSGVyZU1hcHNSb3V0ZXNTZXJ2aWNlLFxuICAgIEhlcmVNYXBzQ09OU1RTLFxuICAgIEhlcmVNYXBzRXZlbnRzRmFjdG9yeSxcbiAgICBIZXJlTWFwc1VpRmFjdG9yeSkge1xuXG4gICAgSGVyZU1hcHNEaXJlY3RpdmVDdHJsLiRpbmplY3QgPSBbJyRzY29wZScsICckZWxlbWVudCcsICckYXR0cnMnXTtcblxuICAgIHJldHVybiB7XG4gICAgICAgIHJlc3RyaWN0OiAnRUEnLFxuICAgICAgICB0ZW1wbGF0ZTogXCI8ZGl2IG5nLXN0eWxlPVxcXCJ7J3dpZHRoJzogbWFwV2lkdGgsICdoZWlnaHQnOiBtYXBIZWlnaHR9XFxcIj48L2Rpdj5cIixcbiAgICAgICAgcmVwbGFjZTogdHJ1ZSxcbiAgICAgICAgc2NvcGU6IHtcbiAgICAgICAgICAgIG9wdHM6ICcmb3B0aW9ucycsXG4gICAgICAgICAgICBwbGFjZXM6ICcmJyxcbiAgICAgICAgICAgIG9uTWFwUmVhZHk6IFwiJm1hcFJlYWR5XCIsXG4gICAgICAgICAgICBldmVudHM6ICcmJ1xuICAgICAgICB9LFxuICAgICAgICBjb250cm9sbGVyOiBIZXJlTWFwc0RpcmVjdGl2ZUN0cmxcbiAgICB9XG5cbiAgICBmdW5jdGlvbiBIZXJlTWFwc0RpcmVjdGl2ZUN0cmwoJHNjb3BlLCAkZWxlbWVudCwgJGF0dHJzKSB7XG4gICAgICAgIHZhciBDT05UUk9MX05BTUVTID0gSGVyZU1hcHNDT05TVFMuQ09OVFJPTFMuTkFNRVMsXG4gICAgICAgICAgICBwbGFjZXMgPSAkc2NvcGUucGxhY2VzKCksXG4gICAgICAgICAgICBvcHRzID0gJHNjb3BlLm9wdHMoKSxcbiAgICAgICAgICAgIGxpc3RlbmVycyA9ICRzY29wZS5ldmVudHMoKTtcblxuICAgICAgICB2YXIgb3B0aW9ucyA9IGFuZ3VsYXIuZXh0ZW5kKHt9LCBIZXJlTWFwc0NPTlNUUy5ERUZBVUxUX01BUF9PUFRJT05TLCBvcHRzKSxcbiAgICAgICAgICAgIHBvc2l0aW9uID0gSGVyZU1hcHNVdGlsc1NlcnZpY2UuaXNWYWxpZENvb3JkcyhvcHRpb25zLmNvb3JkcykgP1xuICAgICAgICAgICAgICAgIG9wdGlvbnMuY29vcmRzIDogSGVyZU1hcHNDT05TVFMuREVGQVVMVF9NQVBfT1BUSU9OUy5jb29yZHM7XG5cbiAgICAgICAgdmFyIGhlcmVtYXBzID0geyBpZDogSGVyZU1hcHNVdGlsc1NlcnZpY2UuZ2VuZXJhdGVJZCgpIH0sXG4gICAgICAgICAgICBtYXBSZWFkeSA9ICRzY29wZS5vbk1hcFJlYWR5KCksXG4gICAgICAgICAgICBfb25SZXNpemVNYXAgPSBudWxsO1xuXG4gICAgICAgICR0aW1lb3V0KGZ1bmN0aW9uICgpIHtcbiAgICAgICAgICAgIHJldHVybiBfc2V0TWFwU2l6ZSgpO1xuICAgICAgICB9KS50aGVuKGZ1bmN0aW9uICgpIHtcbiAgICAgICAgICAgIEhlcmVNYXBzQVBJU2VydmljZS5sb2FkQXBpKCkudGhlbihfYXBpUmVhZHkpO1xuICAgICAgICB9KTtcblxuICAgICAgICBvcHRpb25zLnJlc2l6ZSAmJiBhZGRPblJlc2l6ZUxpc3RlbmVyKCk7XG5cbiAgICAgICAgJHNjb3BlLiRvbignJGRlc3Ryb3knLCBmdW5jdGlvbiAoKSB7XG4gICAgICAgICAgICAkd2luZG93LnJlbW92ZUV2ZW50TGlzdGVuZXIoJ3Jlc2l6ZScsIF9vblJlc2l6ZU1hcCk7XG4gICAgICAgIH0pO1xuXG4gICAgICAgIGZ1bmN0aW9uIGFkZE9uUmVzaXplTGlzdGVuZXIoKSB7XG4gICAgICAgICAgICBfb25SZXNpemVNYXAgPSBIZXJlTWFwc1V0aWxzU2VydmljZS50aHJvdHRsZShfcmVzaXplSGFuZGxlciwgSGVyZU1hcHNDT05TVFMuVVBEQVRFX01BUF9SRVNJWkVfVElNRU9VVCk7XG4gICAgICAgICAgICAkd2luZG93LmFkZEV2ZW50TGlzdGVuZXIoJ3Jlc2l6ZScsIF9vblJlc2l6ZU1hcCk7XG4gICAgICAgIH1cblxuICAgICAgICBmdW5jdGlvbiBfYXBpUmVhZHkoKSB7XG4gICAgICAgICAgICBfc2V0dXBNYXBQbGF0Zm9ybSgpO1xuICAgICAgICAgICAgX3NldHVwTWFwKCk7XG4gICAgICAgIH1cblxuICAgICAgICBmdW5jdGlvbiBfc2V0dXBNYXBQbGF0Zm9ybSgpIHtcbiAgICAgICAgICAgIGlmICghSGVyZU1hcHNDb25maWcuYXBwX2lkIHx8ICFIZXJlTWFwc0NvbmZpZy5hcHBfY29kZSlcbiAgICAgICAgICAgICAgICB0aHJvdyBuZXcgRXJyb3IoJ2FwcF9pZCBvciBhcHBfY29kZSB3ZXJlIG1pc3NlZC4gUGxlYXNlIHNwZWNpZnkgdGhlaXIgaW4gSGVyZU1hcHNDb25maWcnKTtcblxuICAgICAgICAgICAgaGVyZW1hcHMucGxhdGZvcm0gPSBuZXcgSC5zZXJ2aWNlLlBsYXRmb3JtKEhlcmVNYXBzQ29uZmlnKTtcbiAgICAgICAgICAgIGhlcmVtYXBzLmxheWVycyA9IGhlcmVtYXBzLnBsYXRmb3JtLmNyZWF0ZURlZmF1bHRMYXllcnMoKTtcbiAgICAgICAgfVxuXG4gICAgICAgIGZ1bmN0aW9uIF9nZXRMb2NhdGlvbihlbmFibGVIaWdoQWNjdXJhY3ksIG1heGltdW1BZ2UpIHtcbiAgICAgICAgICAgIHZhciBfZW5hYmxlSGlnaEFjY3VyYWN5ID0gISFlbmFibGVIaWdoQWNjdXJhY3ksXG4gICAgICAgICAgICAgICAgX21heGltdW1BZ2UgPSBtYXhpbXVtQWdlIHx8IDA7XG5cbiAgICAgICAgICAgIHJldHVybiBIZXJlTWFwc0FQSVNlcnZpY2UuZ2V0UG9zaXRpb24oe1xuICAgICAgICAgICAgICAgIGVuYWJsZUhpZ2hBY2N1cmFjeTogX2VuYWJsZUhpZ2hBY2N1cmFjeSxcbiAgICAgICAgICAgICAgICBtYXhpbXVtQWdlOiBfbWF4aW11bUFnZVxuICAgICAgICAgICAgfSk7XG4gICAgICAgIH1cblxuICAgICAgICBmdW5jdGlvbiBfbG9jYXRpb25GYWlsdXJlKCkge1xuICAgICAgICAgICAgY29uc29sZS5lcnJvcignQ2FuIG5vdCBnZXQgYSBnZW8gcG9zaXRpb24nKTtcbiAgICAgICAgfVxuXG4gICAgICAgIGZ1bmN0aW9uIF9zZXR1cE1hcCgpIHtcbiAgICAgICAgICAgIF9pbml0TWFwKGZ1bmN0aW9uICgpIHtcbiAgICAgICAgICAgICAgICBIZXJlTWFwc0FQSVNlcnZpY2UubG9hZE1vZHVsZXMoJGF0dHJzLiRhdHRyLCB7XG4gICAgICAgICAgICAgICAgICAgIFwiY29udHJvbHNcIjogX3VpTW9kdWxlUmVhZHksXG4gICAgICAgICAgICAgICAgICAgIFwiZXZlbnRzXCI6IF9ldmVudHNNb2R1bGVSZWFkeVxuICAgICAgICAgICAgICAgIH0pO1xuICAgICAgICAgICAgfSk7XG4gICAgICAgIH1cblxuICAgICAgICBmdW5jdGlvbiBfaW5pdE1hcChjYikge1xuICAgICAgICAgICAgdmFyIG1hcCA9IGhlcmVtYXBzLm1hcCA9IG5ldyBILk1hcCgkZWxlbWVudFswXSwgaGVyZW1hcHMubGF5ZXJzLm5vcm1hbC5tYXAsIHtcbiAgICAgICAgICAgICAgICB6b29tOiBIZXJlTWFwc1V0aWxzU2VydmljZS5pc1ZhbGlkQ29vcmRzKHBvc2l0aW9uKSA/IG9wdGlvbnMuem9vbSA6IG9wdGlvbnMubWF4Wm9vbSxcbiAgICAgICAgICAgICAgICBjZW50ZXI6IG5ldyBILmdlby5Qb2ludChwb3NpdGlvbi5sYXRpdHVkZSwgcG9zaXRpb24ubG9uZ2l0dWRlKVxuICAgICAgICAgICAgfSk7XG5cbiAgICAgICAgICAgIEhlcmVNYXBzTWFya2VyU2VydmljZS5hZGRNYXJrZXJzVG9NYXAobWFwLCBwbGFjZXMsIHRydWUpO1xuXG4gICAgICAgICAgICBpZiAoSGVyZU1hcHNDb25maWcubWFwVGlsZUNvbmZpZylcbiAgICAgICAgICAgICAgICBfc2V0Q3VzdG9tTWFwU3R5bGVzKG1hcCwgSGVyZU1hcHNDb25maWcubWFwVGlsZUNvbmZpZyk7XG5cbiAgICAgICAgICAgIG1hcFJlYWR5ICYmIG1hcFJlYWR5KE1hcFByb3h5KCkpO1xuXG4gICAgICAgICAgICBjYiAmJiBjYigpO1xuXG4gICAgICAgIH1cblxuICAgICAgICBmdW5jdGlvbiBfdWlNb2R1bGVSZWFkeSgpIHtcbiAgICAgICAgICAgIEhlcmVNYXBzVWlGYWN0b3J5LnN0YXJ0KHtcbiAgICAgICAgICAgICAgICBwbGF0Zm9ybTogaGVyZW1hcHMsXG4gICAgICAgICAgICAgICAgYWxpZ25tZW50OiAkYXR0cnMuY29udHJvbHNcbiAgICAgICAgICAgIH0pO1xuICAgICAgICB9XG5cbiAgICAgICAgZnVuY3Rpb24gX2V2ZW50c01vZHVsZVJlYWR5KCkge1xuICAgICAgICAgICAgSGVyZU1hcHNFdmVudHNGYWN0b3J5LnN0YXJ0KHtcbiAgICAgICAgICAgICAgICBwbGF0Zm9ybTogaGVyZW1hcHMsXG4gICAgICAgICAgICAgICAgbGlzdGVuZXJzOiBsaXN0ZW5lcnMsXG4gICAgICAgICAgICAgICAgb3B0aW9uczogb3B0aW9ucyxcbiAgICAgICAgICAgICAgICBpbmplY3RvcjogX21vZHVsZUluamVjdG9yXG4gICAgICAgICAgICB9KTtcbiAgICAgICAgfVxuXG4gICAgICAgIGZ1bmN0aW9uIF9tb2R1bGVJbmplY3RvcigpIHtcbiAgICAgICAgICAgIHJldHVybiBmdW5jdGlvbiAoaWQpIHtcbiAgICAgICAgICAgICAgICByZXR1cm4gaGVyZW1hcHNbaWRdO1xuICAgICAgICAgICAgfVxuICAgICAgICB9XG5cbiAgICAgICAgZnVuY3Rpb24gX3Jlc2l6ZUhhbmRsZXIoaGVpZ2h0LCB3aWR0aCkge1xuICAgICAgICAgICAgX3NldE1hcFNpemUuYXBwbHkobnVsbCwgYXJndW1lbnRzKTtcblxuICAgICAgICAgICAgaGVyZW1hcHMubWFwLmdldFZpZXdQb3J0KCkucmVzaXplKCk7XG4gICAgICAgIH1cblxuICAgICAgICBmdW5jdGlvbiBfc2V0TWFwU2l6ZShoZWlnaHQsIHdpZHRoKSB7XG4gICAgICAgICAgICB2YXIgaGVpZ2h0ID0gaGVpZ2h0IHx8ICRlbGVtZW50WzBdLnBhcmVudE5vZGUub2Zmc2V0SGVpZ2h0IHx8IG9wdGlvbnMuaGVpZ2h0LFxuICAgICAgICAgICAgICAgIHdpZHRoID0gd2lkdGggfHwgJGVsZW1lbnRbMF0ucGFyZW50Tm9kZS5vZmZzZXRXaWR0aCB8fCBvcHRpb25zLndpZHRoO1xuXG4gICAgICAgICAgICAkc2NvcGUubWFwSGVpZ2h0ID0gaGVpZ2h0ICsgJ3B4JztcbiAgICAgICAgICAgICRzY29wZS5tYXBXaWR0aCA9IHdpZHRoICsgJ3B4JztcblxuICAgICAgICAgICAgSGVyZU1hcHNVdGlsc1NlcnZpY2UucnVuU2NvcGVEaWdlc3RJZk5lZWQoJHNjb3BlKTtcbiAgICAgICAgfVxuICAgICAgICBcbiAgICAgICAgZnVuY3Rpb24gX3NldEN1c3RvbU1hcFN0eWxlcyhtYXAsIGNvbmZpZykge1xuICAgICAgICAgICAgLy8gQ3JlYXRlIGEgTWFwVGlsZVNlcnZpY2UgaW5zdGFuY2UgdG8gcmVxdWVzdCBiYXNlIHRpbGVzIChpLmUuIGJhc2UubWFwLmFwaS5oZXJlLmNvbSk6XG4gICAgICAgICAgICB2YXIgbWFwVGlsZVNlcnZpY2UgPSBoZXJlbWFwcy5wbGF0Zm9ybS5nZXRNYXBUaWxlU2VydmljZSh7ICd0eXBlJzogJ2Jhc2UnIH0pO1xuXG4gICAgICAgICAgICAvLyBDcmVhdGUgYSB0aWxlIGxheWVyIHdoaWNoIHJlcXVlc3RzIG1hcCB0aWxlc1xuICAgICAgICAgICAgdmFyIG5ld1N0eWxlTGF5ZXIgPSBtYXBUaWxlU2VydmljZS5jcmVhdGVUaWxlTGF5ZXIoXG4gICAgICAgICAgICAgICAgJ21hcHRpbGUnLCBcbiAgICAgICAgICAgICAgICBjb25maWcuc2NoZW1lIHx8ICdub3JtYWwuZGF5JywgXG4gICAgICAgICAgICAgICAgY29uZmlnLnNpemUgfHwgMjU2LCBcbiAgICAgICAgICAgICAgICBjb25maWcuZm9ybWF0IHx8ICdwbmc4JywgXG4gICAgICAgICAgICAgICAgY29uZmlnLm1ldGFkYXRhUXVlcnlQYXJhbXMgfHwge31cbiAgICAgICAgICAgICk7XG4gICAgICAgICAgICBcbiAgICAgICAgICAgIC8vIFNldCBuZXcgc3R5bGUgbGF5ZXIgYXMgYSBiYXNlIGxheWVyIG9uIHRoZSBtYXA6XG4gICAgICAgICAgICBtYXAuc2V0QmFzZUxheWVyKG5ld1N0eWxlTGF5ZXIpO1xuICAgICAgICB9XG5cbiAgICAgICAgZnVuY3Rpb24gTWFwUHJveHkoKSB7XG4gICAgICAgICAgICByZXR1cm4ge1xuICAgICAgICAgICAgICAgIHJlZnJlc2g6IGZ1bmN0aW9uICgpIHtcbiAgICAgICAgICAgICAgICAgICAgdmFyIGN1cnJlbnRCb3VuZHMgPSB0aGlzLmdldFZpZXdCb3VuZHMoKTtcblxuICAgICAgICAgICAgICAgICAgICB0aGlzLnNldE1hcFNpemVzKCk7XG4gICAgICAgICAgICAgICAgICAgIHRoaXMuc2V0Vmlld0JvdW5kcyhjdXJyZW50Qm91bmRzKTtcbiAgICAgICAgICAgICAgICB9LFxuICAgICAgICAgICAgICAgIHNldE1hcFNpemVzOiBmdW5jdGlvbiAoaGVpZ2h0LCB3aWR0aCkge1xuICAgICAgICAgICAgICAgICAgICBfcmVzaXplSGFuZGxlci5hcHBseShudWxsLCBhcmd1bWVudHMpO1xuICAgICAgICAgICAgICAgIH0sXG4gICAgICAgICAgICAgICAgZ2V0UGxhdGZvcm06IGZ1bmN0aW9uICgpIHtcbiAgICAgICAgICAgICAgICAgICAgcmV0dXJuIGhlcmVtYXBzO1xuICAgICAgICAgICAgICAgIH0sXG4gICAgICAgICAgICAgICAgY2FsY3VsYXRlUm91dGU6IGZ1bmN0aW9uIChkcml2ZVR5cGUsIGRpcmVjdGlvbikge1xuICAgICAgICAgICAgICAgICAgICByZXR1cm4gSGVyZU1hcHNSb3V0ZXNTZXJ2aWNlLmNhbGN1bGF0ZVJvdXRlKGhlcmVtYXBzLCB7XG4gICAgICAgICAgICAgICAgICAgICAgICBkcml2ZVR5cGU6IGRyaXZlVHlwZSxcbiAgICAgICAgICAgICAgICAgICAgICAgIGRpcmVjdGlvbjogZGlyZWN0aW9uXG4gICAgICAgICAgICAgICAgICAgIH0pO1xuICAgICAgICAgICAgICAgIH0sXG4gICAgICAgICAgICAgICAgYWRkUm91dGVUb01hcDogZnVuY3Rpb24gKHJvdXRlRGF0YSwgY2xlYW4pIHtcbiAgICAgICAgICAgICAgICAgICAgSGVyZU1hcHNSb3V0ZXNTZXJ2aWNlLmFkZFJvdXRlVG9NYXAoaGVyZW1hcHMubWFwLCByb3V0ZURhdGEsIGNsZWFuKTtcbiAgICAgICAgICAgICAgICB9LFxuICAgICAgICAgICAgICAgIHNldFpvb206IGZ1bmN0aW9uICh6b29tLCBzdGVwKSB7XG4gICAgICAgICAgICAgICAgICAgIEhlcmVNYXBzVXRpbHNTZXJ2aWNlLnpvb20oaGVyZW1hcHMubWFwLCB6b29tIHx8IDEwLCBzdGVwKTtcbiAgICAgICAgICAgICAgICB9LFxuICAgICAgICAgICAgICAgIGdldFpvb206IGZ1bmN0aW9uICgpIHtcbiAgICAgICAgICAgICAgICAgICAgcmV0dXJuIGhlcmVtYXBzLm1hcC5nZXRab29tKCk7XG4gICAgICAgICAgICAgICAgfSxcbiAgICAgICAgICAgICAgICBnZXRDZW50ZXI6IGZ1bmN0aW9uICgpIHtcbiAgICAgICAgICAgICAgICAgICAgcmV0dXJuIGhlcmVtYXBzLm1hcC5nZXRDZW50ZXIoKTtcbiAgICAgICAgICAgICAgICB9LFxuICAgICAgICAgICAgICAgIGdldFZpZXdCb3VuZHM6IGZ1bmN0aW9uICgpIHtcbiAgICAgICAgICAgICAgICAgICAgcmV0dXJuIGhlcmVtYXBzLm1hcC5nZXRWaWV3Qm91bmRzKCk7XG4gICAgICAgICAgICAgICAgfSxcbiAgICAgICAgICAgICAgICBzZXRWaWV3Qm91bmRzOiBmdW5jdGlvbiAoYm91bmRpbmdSZWN0LCBvcHRfYW5pbWF0ZSkge1xuICAgICAgICAgICAgICAgICAgICBIZXJlTWFwc01hcmtlclNlcnZpY2Uuc2V0Vmlld0JvdW5kcyhoZXJlbWFwcy5tYXAsIGJvdW5kaW5nUmVjdCwgb3B0X2FuaW1hdGUpO1xuICAgICAgICAgICAgICAgIH0sXG4gICAgICAgICAgICAgICAgZ2V0Qm91bmRzUmVjdEZyb21Qb2ludHM6IGZ1bmN0aW9uICh0b3BMZWZ0LCBib3R0b21SaWdodCkge1xuICAgICAgICAgICAgICAgICAgICByZXR1cm4gSGVyZU1hcHNVdGlsc1NlcnZpY2UuZ2V0Qm91bmRzUmVjdEZyb21Qb2ludHMuYXBwbHkobnVsbCwgYXJndW1lbnRzKTtcbiAgICAgICAgICAgICAgICB9LFxuICAgICAgICAgICAgICAgIHNldENlbnRlcjogZnVuY3Rpb24gKGNvb3Jkcykge1xuICAgICAgICAgICAgICAgICAgICBpZiAoIWNvb3Jkcykge1xuICAgICAgICAgICAgICAgICAgICAgICAgcmV0dXJuIGNvbnNvbGUuZXJyb3IoJ2Nvb3JkcyBhcmUgbm90IHNwZWNpZmllZCEnKTtcbiAgICAgICAgICAgICAgICAgICAgfVxuXG4gICAgICAgICAgICAgICAgICAgIGhlcmVtYXBzLm1hcC5zZXRDZW50ZXIoY29vcmRzKTtcbiAgICAgICAgICAgICAgICB9LFxuICAgICAgICAgICAgICAgIGNsZWFuUm91dGVzOiBmdW5jdGlvbiAoKSB7XG4gICAgICAgICAgICAgICAgICAgIEhlcmVNYXBzUm91dGVzU2VydmljZS5jbGVhblJvdXRlcyhoZXJlbWFwcy5tYXApO1xuICAgICAgICAgICAgICAgIH0sXG5cbiAgICAgICAgICAgICAgICAvKipcbiAgICAgICAgICAgICAgICAgKiBAcGFyYW0ge0Jvb2xlYW59IGVuYWJsZUhpZ2hBY2N1cmFjeVxuICAgICAgICAgICAgICAgICAqIEBwYXJhbSB7TnVtYmVyfSBtYXhpbXVtQWdlIC0gdGhlIG1heGltdW0gYWdlIGluIG1pbGxpc2Vjb25kcyBvZiBhIHBvc3NpYmxlIGNhY2hlZCBwb3NpdGlvbiB0aGF0IGlzIGFjY2VwdGFibGUgdG8gcmV0dXJuLiBJZiBzZXQgdG8gMCwgaXQgbWVhbnMgdGhhdCB0aGUgZGV2aWNlIGNhbm5vdCB1c2UgYSBjYWNoZWQgcG9zaXRpb24gYW5kIG11c3QgYXR0ZW1wdCB0byByZXRyaWV2ZSB0aGUgcmVhbCBjdXJyZW50IHBvc2l0aW9uXG4gICAgICAgICAgICAgICAgICogQHJldHVybiB7UHJvbWlzZX1cbiAgICAgICAgICAgICAgICAgKi9cbiAgICAgICAgICAgICAgICBnZXRVc2VyTG9jYXRpb246IGZ1bmN0aW9uIChlbmFibGVIaWdoQWNjdXJhY3ksIG1heGltdW1BZ2UpIHtcbiAgICAgICAgICAgICAgICAgICAgcmV0dXJuIF9nZXRMb2NhdGlvbi5hcHBseShudWxsLCBhcmd1bWVudHMpLnRoZW4oZnVuY3Rpb24gKHBvc2l0aW9uKSB7XG4gICAgICAgICAgICAgICAgICAgICAgICB2YXIgY29vcmRzID0gcG9zaXRpb24uY29vcmRzO1xuXG4gICAgICAgICAgICAgICAgICAgICAgICByZXR1cm4ge1xuICAgICAgICAgICAgICAgICAgICAgICAgICAgIGxhdDogY29vcmRzLmxhdGl0dWRlLFxuICAgICAgICAgICAgICAgICAgICAgICAgICAgIGxuZzogY29vcmRzLmxvbmdpdHVkZVxuICAgICAgICAgICAgICAgICAgICAgICAgfTtcbiAgICAgICAgICAgICAgICAgICAgfSlcbiAgICAgICAgICAgICAgICB9LFxuICAgICAgICAgICAgICAgIGdlb2NvZGVQb3NpdGlvbjogZnVuY3Rpb24gKGNvb3Jkcywgb3B0aW9ucykge1xuICAgICAgICAgICAgICAgICAgICByZXR1cm4gSGVyZU1hcHNBUElTZXJ2aWNlLmdlb2NvZGVQb3NpdGlvbihoZXJlbWFwcy5wbGF0Zm9ybSwge1xuICAgICAgICAgICAgICAgICAgICAgICAgY29vcmRzOiBjb29yZHMsXG4gICAgICAgICAgICAgICAgICAgICAgICByYWRpdXM6IG9wdGlvbnMgJiYgb3B0aW9ucy5yYWRpdXMsXG4gICAgICAgICAgICAgICAgICAgICAgICBsYW5nOiBvcHRpb25zICYmIG9wdGlvbnMubGFuZ1xuICAgICAgICAgICAgICAgICAgICB9KTtcbiAgICAgICAgICAgICAgICB9LFxuICAgICAgICAgICAgICAgIGdlb2NvZGVBZGRyZXNzOiBmdW5jdGlvbiAoYWRkcmVzcykge1xuICAgICAgICAgICAgICAgICAgICByZXR1cm4gSGVyZU1hcHNBUElTZXJ2aWNlLmdlb2NvZGVBZGRyZXNzKGhlcmVtYXBzLnBsYXRmb3JtLCB7XG4gICAgICAgICAgICAgICAgICAgICAgICBzZWFyY2h0ZXh0OiBhZGRyZXNzICYmIGFkZHJlc3Muc2VhcmNodGV4dCxcbiAgICAgICAgICAgICAgICAgICAgICAgIGNvdW50cnk6IGFkZHJlc3MgJiYgYWRkcmVzcy5jb3VudHJ5LFxuICAgICAgICAgICAgICAgICAgICAgICAgY2l0eTogYWRkcmVzcyAmJiBhZGRyZXNzLmNpdHksXG4gICAgICAgICAgICAgICAgICAgICAgICBzdHJlZXQ6IGFkZHJlc3MgJiYgYWRkcmVzcy5zdHJlZXQsXG4gICAgICAgICAgICAgICAgICAgICAgICBob3VzZW51bWJlcjogYWRkcmVzcyAmJiBhZGRyZXNzLmhvdXNlbnVtYmVyXG4gICAgICAgICAgICAgICAgICAgIH0pO1xuICAgICAgICAgICAgICAgIH0sXG4gICAgICAgICAgICAgICAgZ2VvY29kZUF1dG9jb21wbGV0ZTogZnVuY3Rpb24gKHF1ZXJ5LCBvcHRpb25zKSB7XG4gICAgICAgICAgICAgICAgICAgIHJldHVybiBIZXJlTWFwc0FQSVNlcnZpY2UuZ2VvY29kZUF1dG9jb21wbGV0ZSh7XG4gICAgICAgICAgICAgICAgICAgICAgICBxdWVyeTogcXVlcnksXG4gICAgICAgICAgICAgICAgICAgICAgICBiZWdpbkhpZ2hsaWdodDogb3B0aW9ucyAmJiBvcHRpb25zLmJlZ2luSGlnaGxpZ2h0LFxuICAgICAgICAgICAgICAgICAgICAgICAgZW5kSGlnaGxpZ2h0OiBvcHRpb25zICYmIG9wdGlvbnMuZW5kSGlnaGxpZ2h0LFxuICAgICAgICAgICAgICAgICAgICAgICAgbWF4cmVzdWx0czogb3B0aW9ucyAmJiBvcHRpb25zLm1heHJlc3VsdHNcbiAgICAgICAgICAgICAgICAgICAgfSk7XG4gICAgICAgICAgICAgICAgfSxcbiAgICAgICAgICAgICAgICBmaW5kTG9jYXRpb25CeUlkOiBmdW5jdGlvbiAobG9jYXRpb25JZCkge1xuICAgICAgICAgICAgICAgICAgICByZXR1cm4gSGVyZU1hcHNBUElTZXJ2aWNlLmZpbmRMb2NhdGlvbkJ5SWQobG9jYXRpb25JZCk7XG4gICAgICAgICAgICAgICAgfSxcbiAgICAgICAgICAgICAgICB1cGRhdGVNYXJrZXJzOiBmdW5jdGlvbiAocGxhY2VzLCByZWZyZXNoVmlld2JvdW5kcykge1xuICAgICAgICAgICAgICAgICAgICBIZXJlTWFwc01hcmtlclNlcnZpY2UudXBkYXRlTWFya2VycyhoZXJlbWFwcy5tYXAsIHBsYWNlcywgcmVmcmVzaFZpZXdib3VuZHMpO1xuICAgICAgICAgICAgICAgIH0sXG4gICAgICAgICAgICAgICAgZ2V0TWFwRmFjdG9yeTogZnVuY3Rpb24gKCl7XG4gICAgICAgICAgICAgICAgICAgIHJldHVybiBIZXJlTWFwc1V0aWxzU2VydmljZS5nZXRNYXBGYWN0b3J5KCk7XG4gICAgICAgICAgICAgICAgfVxuICAgICAgICAgICAgfVxuICAgICAgICB9XG5cbiAgICB9XG59O1xuIiwicmVxdWlyZSgnLi9wcm92aWRlcnMvbWFya2VycycpO1xucmVxdWlyZSgnLi9wcm92aWRlcnMvbWFwLW1vZHVsZXMnKTtcbnJlcXVpcmUoJy4vcHJvdmlkZXJzL3JvdXRlcycpO1xuXG5tb2R1bGUuZXhwb3J0cyA9IGFuZ3VsYXIubW9kdWxlKCdoZXJlbWFwcycsIFtcbiAgICAnaGVyZW1hcHMtbWFya2Vycy1tb2R1bGUnLFxuICAgICdoZXJlbWFwcy1yb3V0ZXMtbW9kdWxlJyxcbiAgICAnaGVyZW1hcHMtbWFwLW1vZHVsZXMnXG5dKVxuICAgIC5wcm92aWRlcignSGVyZU1hcHNDb25maWcnLCByZXF1aXJlKCcuL3Byb3ZpZGVycy9tYXBjb25maWcucHJvdmlkZXInKSlcbiAgICAuc2VydmljZSgnSGVyZU1hcHNVdGlsc1NlcnZpY2UnLCByZXF1aXJlKCcuL3Byb3ZpZGVycy9tYXB1dGlscy5zZXJ2aWNlJykpXG4gICAgLnNlcnZpY2UoJ0hlcmVNYXBzQVBJU2VydmljZScsIHJlcXVpcmUoJy4vcHJvdmlkZXJzL2FwaS5zZXJ2aWNlJykpXG4gICAgLmNvbnN0YW50KCdIZXJlTWFwc0NPTlNUUycsIHJlcXVpcmUoJy4vcHJvdmlkZXJzL2NvbnN0cycpKVxuICAgIC5kaXJlY3RpdmUoJ2hlcmVtYXBzJywgcmVxdWlyZSgnLi9oZXJlbWFwcy5kaXJlY3RpdmUnKSk7XG4iLCJtb2R1bGUuZXhwb3J0cyA9IEhlcmVNYXBzQVBJU2VydmljZTtcblxuSGVyZU1hcHNBUElTZXJ2aWNlLiRpbmplY3QgPSBbXG4gICAgJyRxJyxcbiAgICAnJGh0dHAnLFxuICAgICdIZXJlTWFwc0NvbmZpZycsXG4gICAgJ0hlcmVNYXBzVXRpbHNTZXJ2aWNlJyxcbiAgICAnSGVyZU1hcHNDT05TVFMnXG5dO1xuZnVuY3Rpb24gSGVyZU1hcHNBUElTZXJ2aWNlKCRxLCAkaHR0cCwgSGVyZU1hcHNDb25maWcsIEhlcmVNYXBzVXRpbHNTZXJ2aWNlLCBIZXJlTWFwc0NPTlNUUykge1xuICAgIHZhciB2ZXJzaW9uID0gSGVyZU1hcHNDb25maWcuYXBpVmVyc2lvbixcbiAgICAgICAgcHJvdG9jb2wgPSBIZXJlTWFwc0NvbmZpZy51c2VIVFRQUyA/ICdodHRwcycgOiAnaHR0cCc7XG5cbiAgICB2YXIgQVBJX1ZFUlNJT04gPSB7XG4gICAgICAgIFY6IHBhcnNlSW50KHZlcnNpb24pLFxuICAgICAgICBTVUI6IHZlcnNpb25cbiAgICB9O1xuXG4gICAgdmFyIENPTkZJRyA9IHtcbiAgICAgICAgQkFTRTogXCI6Ly9qcy5hcGkuaGVyZS5jb20vdlwiLFxuICAgICAgICBDT1JFOiBcIm1hcHNqcy1jb3JlLmpzXCIsXG4gICAgICAgIFNFUlZJQ0U6IFwibWFwc2pzLXNlcnZpY2UuanNcIixcbiAgICAgICAgVUk6IHtcbiAgICAgICAgICAgIHNyYzogXCJtYXBzanMtdWkuanNcIixcbiAgICAgICAgICAgIGhyZWY6IFwibWFwc2pzLXVpLmNzc1wiXG4gICAgICAgIH0sXG4gICAgICAgIEVWRU5UUzogXCJtYXBzanMtbWFwZXZlbnRzLmpzXCIsXG4gICAgICAgIEFVVE9DT01QTEVURV9VUkw6IFwiOi8vYXV0b2NvbXBsZXRlLmdlb2NvZGVyLmNpdC5hcGkuaGVyZS5jb20vNi4yL3N1Z2dlc3QuanNvblwiLFxuICAgICAgICBMT0NBVElPTl9VUkw6IFwiOi8vZ2VvY29kZXIuY2l0LmFwaS5oZXJlLmNvbS82LjIvZ2VvY29kZS5qc29uXCJcbiAgICB9O1xuXG4gICAgdmFyIEFQSV9ERUZFUlNRdWV1ZSA9IHt9O1xuXG4gICAgQVBJX0RFRkVSU1F1ZXVlW0NPTkZJRy5DT1JFXSA9IFtdO1xuICAgIEFQSV9ERUZFUlNRdWV1ZVtDT05GSUcuU0VSVklDRV0gPSBbXTtcbiAgICBBUElfREVGRVJTUXVldWVbQ09ORklHLlVJLnNyY10gPSBbXTtcbiAgICBBUElfREVGRVJTUXVldWVbQ09ORklHLlBBTk9dID0gW107XG4gICAgQVBJX0RFRkVSU1F1ZXVlW0NPTkZJRy5FVkVOVFNdID0gW107XG5cbiAgICB2YXIgaGVhZCA9IGRvY3VtZW50LmdldEVsZW1lbnRzQnlUYWdOYW1lKCdoZWFkJylbMF07XG5cbiAgICByZXR1cm4ge1xuICAgICAgICBsb2FkQXBpOiBsb2FkQXBpLFxuICAgICAgICBsb2FkTW9kdWxlczogbG9hZE1vZHVsZXMsXG4gICAgICAgIGdldFBvc2l0aW9uOiBnZXRQb3NpdGlvbixcbiAgICAgICAgZ2VvY29kZVBvc2l0aW9uOiBnZW9jb2RlUG9zaXRpb24sXG4gICAgICAgIGdlb2NvZGVBZGRyZXNzOiBnZW9jb2RlQWRkcmVzcyxcbiAgICAgICAgZ2VvY29kZUF1dG9jb21wbGV0ZTogZ2VvY29kZUF1dG9jb21wbGV0ZSxcbiAgICAgICAgZmluZExvY2F0aW9uQnlJZDogZmluZExvY2F0aW9uQnlJZFxuICAgIH07XG5cbiAgICAvLyNyZWdpb24gUFVCTElDXG4gICAgZnVuY3Rpb24gbG9hZEFwaSgpIHtcbiAgICAgICAgcmV0dXJuIF9nZXRMb2FkZXIoQ09ORklHLkNPUkUpXG4gICAgICAgICAgICAudGhlbihmdW5jdGlvbiAoKSB7XG4gICAgICAgICAgICAgICAgcmV0dXJuIF9nZXRMb2FkZXIoQ09ORklHLlNFUlZJQ0UpO1xuICAgICAgICAgICAgfSk7XG4gICAgfVxuXG4gICAgZnVuY3Rpb24gbG9hZE1vZHVsZXMoYXR0cnMsIGhhbmRsZXJzKSB7XG4gICAgICAgIGZvciAodmFyIGtleSBpbiBoYW5kbGVycykge1xuICAgICAgICAgICAgaWYgKCFoYW5kbGVycy5oYXNPd25Qcm9wZXJ0eShrZXkpIHx8ICFhdHRyc1trZXldKVxuICAgICAgICAgICAgICAgIGNvbnRpbnVlO1xuXG4gICAgICAgICAgICB2YXIgbG9hZGVyID0gX2dldExvYWRlckJ5QXR0cihrZXkpO1xuXG4gICAgICAgICAgICBsb2FkZXIoKVxuICAgICAgICAgICAgICAgIC50aGVuKGhhbmRsZXJzW2tleV0pO1xuICAgICAgICB9XG4gICAgfVxuXG4gICAgZnVuY3Rpb24gZ2V0UG9zaXRpb24ob3B0aW9ucykge1xuICAgICAgICB2YXIgZGVmZXJyZWQgPSAkcS5kZWZlcigpO1xuXG4gICAgICAgIGlmIChvcHRpb25zICYmIEhlcmVNYXBzVXRpbHNTZXJ2aWNlLmlzVmFsaWRDb29yZHMob3B0aW9ucy5jb29yZHMpKSB7XG4gICAgICAgICAgICBkZWZlcnJlZC5yZXNvbHZlKHsgY29vcmRzOiBvcHRpb25zLmNvb3JkcyB9KTtcbiAgICAgICAgfSBlbHNlIHtcbiAgICAgICAgICAgIG5hdmlnYXRvci5nZW9sb2NhdGlvbi5nZXRDdXJyZW50UG9zaXRpb24oZnVuY3Rpb24gKHJlc3BvbnNlKSB7XG4gICAgICAgICAgICAgICAgZGVmZXJyZWQucmVzb2x2ZShyZXNwb25zZSk7XG4gICAgICAgICAgICB9LCBmdW5jdGlvbiAoZXJyb3IpIHtcbiAgICAgICAgICAgICAgICBkZWZlcnJlZC5yZWplY3QoZXJyb3IpO1xuICAgICAgICAgICAgfSwgb3B0aW9ucyk7XG4gICAgICAgIH1cblxuICAgICAgICByZXR1cm4gZGVmZXJyZWQucHJvbWlzZTtcbiAgICB9XG5cbiAgICBmdW5jdGlvbiBnZW9jb2RlUG9zaXRpb24ocGxhdGZvcm0sIHBhcmFtcykge1xuICAgICAgICBpZiAoIXBhcmFtcy5jb29yZHMpXG4gICAgICAgICAgICByZXR1cm4gY29uc29sZS5lcnJvcignTWlzc2VkIHJlcXVpcmVkIGNvb3JkcycpO1xuXG4gICAgICAgIHZhciBnZW9jb2RlciA9IHBsYXRmb3JtLmdldEdlb2NvZGluZ1NlcnZpY2UoKSxcbiAgICAgICAgICAgIGRlZmVycmVkID0gJHEuZGVmZXIoKSxcbiAgICAgICAgICAgIF9wYXJhbXMgPSB7XG4gICAgICAgICAgICAgICAgcHJveDogW3BhcmFtcy5jb29yZHMubGF0LCBwYXJhbXMuY29vcmRzLmxuZywgcGFyYW1zLnJhZGl1cyB8fCAyNTBdLmpvaW4oJywnKSxcbiAgICAgICAgICAgICAgICBtb2RlOiAncmV0cmlldmVBZGRyZXNzZXMnLFxuICAgICAgICAgICAgICAgIG1heHJlc3VsdHM6ICcxJyxcbiAgICAgICAgICAgICAgICBnZW46ICc4JyxcbiAgICAgICAgICAgICAgICBsYW5ndWFnZTogcGFyYW1zLmxhbmcgfHwgJ2VuLWdiJ1xuICAgICAgICAgICAgfTtcblxuICAgICAgICBnZW9jb2Rlci5yZXZlcnNlR2VvY29kZShfcGFyYW1zLCBmdW5jdGlvbiAocmVzcG9uc2UpIHtcbiAgICAgICAgICAgIGRlZmVycmVkLnJlc29sdmUocmVzcG9uc2UpXG4gICAgICAgIH0sIGZ1bmN0aW9uIChlcnJvcikge1xuICAgICAgICAgICAgZGVmZXJyZWQucmVqZWN0KGVycm9yKVxuICAgICAgICB9KTtcbiAgICAgICAgXG4gICAgICAgIHJldHVybiBkZWZlcnJlZC5wcm9taXNlO1xuICAgIH1cblxuICAgIGZ1bmN0aW9uIGdlb2NvZGVBZGRyZXNzKHBsYXRmb3JtLCBwYXJhbXMpIHtcbiAgICAgICAgaWYgKCFwYXJhbXMpXG4gICAgICAgICAgICByZXR1cm4gY29uc29sZS5lcnJvcignTWlzc2VkIHJlcXVpcmVkIHBhcmFtZXRlcnMnKTtcblxuICAgICAgICB2YXIgZ2VvY29kZXIgPSBwbGF0Zm9ybS5nZXRHZW9jb2RpbmdTZXJ2aWNlKCksXG4gICAgICAgICAgICBkZWZlcnJlZCA9ICRxLmRlZmVyKCksXG4gICAgICAgICAgICBfcGFyYW1zID0geyBnZW46IDggfTtcblxuICAgICAgICBmb3IgKHZhciBrZXkgaW4gcGFyYW1zKSB7IF9wYXJhbXNba2V5XSA9IHBhcmFtc1trZXldOyB9XG5cbiAgICAgICAgZ2VvY29kZXIuZ2VvY29kZShfcGFyYW1zLCBmdW5jdGlvbiAocmVzcG9uc2UpIHtcbiAgICAgICAgICAgIGRlZmVycmVkLnJlc29sdmUocmVzcG9uc2UpXG4gICAgICAgIH0sIGZ1bmN0aW9uIChlcnJvcikge1xuICAgICAgICAgICAgZGVmZXJyZWQucmVqZWN0KGVycm9yKVxuICAgICAgICB9KTtcblxuICAgICAgICByZXR1cm4gZGVmZXJyZWQucHJvbWlzZTtcbiAgICB9XG5cbiAgICBmdW5jdGlvbiBnZW9jb2RlQXV0b2NvbXBsZXRlKHBhcmFtcykge1xuICAgICAgICBpZiAoIXBhcmFtcylcbiAgICAgICAgICAgIHJldHVybiBjb25zb2xlLmVycm9yKCdNaXNzaW5nIHJlcXVpcmVkIHBhcmFtZXRlcnMnKTtcblxuICAgICAgICB2YXIgYXV0b2NvbXBsZXRlVXJsID0gcHJvdG9jb2wgKyBDT05GSUcuQVVUT0NPTVBMRVRFX1VSTCxcbiAgICAgICAgICAgIGRlZmVycmVkID0gJHEuZGVmZXIoKSxcbiAgICAgICAgICAgIF9wYXJhbXMgPSB7XG4gICAgICAgICAgICAgICAgcXVlcnk6IFwiXCIsXG4gICAgICAgICAgICAgICAgYmVnaW5IaWdobGlnaHQ6IFwiPG1hcms+XCIsXG4gICAgICAgICAgICAgICAgZW5kSGlnaGxpZ2h0OiBcIjwvbWFyaz5cIixcbiAgICAgICAgICAgICAgICBtYXhyZXN1bHRzOiBcIjVcIlxuICAgICAgICAgICAgfTtcblxuICAgICAgICBmb3IgKHZhciBrZXkgaW4gX3BhcmFtcykge1xuICAgICAgICAgICAgaWYgKGFuZ3VsYXIuaXNEZWZpbmVkKHBhcmFtc1trZXldKSkge1xuICAgICAgICAgICAgICAgIF9wYXJhbXNba2V5XSA9IHBhcmFtc1trZXldO1xuICAgICAgICAgICAgfVxuICAgICAgICB9XG5cbiAgICAgICAgX3BhcmFtcy5hcHBfaWQgPSBIZXJlTWFwc0NvbmZpZy5hcHBfaWQ7XG4gICAgICAgIF9wYXJhbXMuYXBwX2NvZGUgPSBIZXJlTWFwc0NvbmZpZy5hcHBfY29kZTtcblxuICAgICAgICAkaHR0cC5nZXQoYXV0b2NvbXBsZXRlVXJsLCB7IHBhcmFtczogX3BhcmFtcyB9KVxuICAgICAgICAgICAgLnN1Y2Nlc3MoZnVuY3Rpb24ocmVzcG9uc2UpIHtcbiAgICAgICAgICAgICAgICBkZWZlcnJlZC5yZXNvbHZlKHJlc3BvbnNlKTtcbiAgICAgICAgICAgIH0pXG4gICAgICAgICAgICAuZXJyb3IoZnVuY3Rpb24oZXJyb3IpIHtcbiAgICAgICAgICAgICAgICBkZWZlcnJlZC5yZWplY3QoZXJyb3IpO1xuICAgICAgICAgICAgfSk7XG5cbiAgICAgICAgcmV0dXJuIGRlZmVycmVkLnByb21pc2U7XG4gICAgfVxuXG4gICAgLyoqXG4gICAgICogRmluZHMgbG9jYXRpb24gYnkgSEVSRSBNYXBzIExvY2F0aW9uIGlkZW50aWZpZXIuXG4gICAgICovXG4gICAgZnVuY3Rpb24gZmluZExvY2F0aW9uQnlJZChsb2NhdGlvbklkKSB7XG4gICAgICAgIGlmICghbG9jYXRpb25JZClcbiAgICAgICAgICAgIHJldHVybiBjb25zb2xlLmVycm9yKCdNaXNzaW5nIExvY2F0aW9uIElkZW50aWZpZXInKTtcblxuICAgICAgICB2YXIgbG9jYXRpb25VcmwgPSBwcm90b2NvbCArIENPTkZJRy5MT0NBVElPTl9VUkwsXG4gICAgICAgICAgICBkZWZlcnJlZCA9ICRxLmRlZmVyKCksXG4gICAgICAgICAgICBfcGFyYW1zID0ge1xuICAgICAgICAgICAgICAgIGxvY2F0aW9uaWQ6IGxvY2F0aW9uSWQsXG4gICAgICAgICAgICAgICAgZ2VuOiA5LFxuICAgICAgICAgICAgICAgIGFwcF9pZDogSGVyZU1hcHNDb25maWcuYXBwX2lkLFxuICAgICAgICAgICAgICAgIGFwcF9jb2RlOiBIZXJlTWFwc0NvbmZpZy5hcHBfY29kZVxuICAgICAgICAgICAgfTtcblxuICAgICAgICAkaHR0cC5nZXQobG9jYXRpb25VcmwsIHsgcGFyYW1zOiBfcGFyYW1zIH0pXG4gICAgICAgICAgICAuc3VjY2VzcyhmdW5jdGlvbihyZXNwb25zZSkge1xuICAgICAgICAgICAgICAgIGRlZmVycmVkLnJlc29sdmUocmVzcG9uc2UpO1xuICAgICAgICAgICAgfSlcbiAgICAgICAgICAgIC5lcnJvcihmdW5jdGlvbihlcnJvcikge1xuICAgICAgICAgICAgICAgIGRlZmVycmVkLnJlamVjdChlcnJvcik7XG4gICAgICAgICAgICB9KTtcblxuICAgICAgICByZXR1cm4gZGVmZXJyZWQucHJvbWlzZTtcbiAgICB9XG5cbiAgICAvLyNlbmRyZWdpb24gUFVCTElDXG5cbiAgICBmdW5jdGlvbiBfZ2V0TG9hZGVyQnlBdHRyKGF0dHIpIHtcbiAgICAgICAgdmFyIGxvYWRlcjtcblxuICAgICAgICBzd2l0Y2ggKGF0dHIpIHtcbiAgICAgICAgICAgIGNhc2UgSGVyZU1hcHNDT05TVFMuTU9EVUxFUy5VSTpcbiAgICAgICAgICAgICAgICBsb2FkZXIgPSBfbG9hZFVJTW9kdWxlO1xuICAgICAgICAgICAgICAgIGJyZWFrO1xuICAgICAgICAgICAgY2FzZSBIZXJlTWFwc0NPTlNUUy5NT0RVTEVTLkVWRU5UUzpcbiAgICAgICAgICAgICAgICBsb2FkZXIgPSBfbG9hZEV2ZW50c01vZHVsZTtcbiAgICAgICAgICAgICAgICBicmVhaztcbiAgICAgICAgICAgIGRlZmF1bHQ6XG4gICAgICAgICAgICAgICAgdGhyb3cgbmV3IEVycm9yKCdVbmtub3duIG1vZHVsZScsIGF0dHIpO1xuICAgICAgICB9XG5cbiAgICAgICAgcmV0dXJuIGxvYWRlcjtcbiAgICB9XG5cbiAgICBmdW5jdGlvbiBfbG9hZFVJTW9kdWxlKCkge1xuICAgICAgICBpZiAoIV9pc0xvYWRlZChDT05GSUcuVUkuc3JjKSkge1xuICAgICAgICAgICAgdmFyIGxpbmsgPSBIZXJlTWFwc1V0aWxzU2VydmljZS5jcmVhdGVMaW5rVGFnKHtcbiAgICAgICAgICAgICAgICByZWw6ICdzdHlsZXNoZWV0JyxcbiAgICAgICAgICAgICAgICB0eXBlOiAndGV4dC9jc3MnLFxuICAgICAgICAgICAgICAgIGhyZWY6IF9nZXRVUkwoQ09ORklHLlVJLmhyZWYpXG4gICAgICAgICAgICB9KTtcblxuICAgICAgICAgICAgbGluayAmJiBoZWFkLmFwcGVuZENoaWxkKGxpbmspO1xuICAgICAgICB9XG5cbiAgICAgICAgcmV0dXJuIF9nZXRMb2FkZXIoQ09ORklHLlVJLnNyYyk7XG4gICAgfVxuXG4gICAgZnVuY3Rpb24gX2xvYWRFdmVudHNNb2R1bGUoKSB7XG4gICAgICAgIHJldHVybiBfZ2V0TG9hZGVyKENPTkZJRy5FVkVOVFMpO1xuICAgIH1cblxuICAgIC8qKlxuICAgICAqIEBwYXJhbSB7U3RyaW5nfSBzb3VyY2VOYW1lXG4gICAgICogcmV0dXJuIHtTdHJpbmd9IGUuZyBodHRwOi8vanMuYXBpLmhlcmUuY29tL3Z7VkVSfS97U1VCVkVSU0lPTn0ve1NPVVJDRX1cbiAgICAgKi9cbiAgICBmdW5jdGlvbiBfZ2V0VVJMKHNvdXJjZU5hbWUpIHtcbiAgICAgICAgcmV0dXJuIFtcbiAgICAgICAgICAgIHByb3RvY29sLFxuICAgICAgICAgICAgQ09ORklHLkJBU0UsXG4gICAgICAgICAgICBBUElfVkVSU0lPTi5WLFxuICAgICAgICAgICAgXCIvXCIsXG4gICAgICAgICAgICBBUElfVkVSU0lPTi5TVUIsXG4gICAgICAgICAgICBcIi9cIixcbiAgICAgICAgICAgIHNvdXJjZU5hbWVcbiAgICAgICAgXS5qb2luKFwiXCIpO1xuICAgIH1cblxuICAgIGZ1bmN0aW9uIF9nZXRMb2FkZXIoc291cmNlTmFtZSkge1xuICAgICAgICB2YXIgZGVmZXIgPSAkcS5kZWZlcigpLCBzcmMsIHNjcmlwdDtcblxuICAgICAgICBpZiAoX2lzTG9hZGVkKHNvdXJjZU5hbWUpKSB7XG4gICAgICAgICAgICBkZWZlci5yZXNvbHZlKCk7XG4gICAgICAgIH0gZWxzZSB7XG4gICAgICAgICAgICBzcmMgPSBfZ2V0VVJMKHNvdXJjZU5hbWUpO1xuICAgICAgICAgICAgc2NyaXB0ID0gSGVyZU1hcHNVdGlsc1NlcnZpY2UuY3JlYXRlU2NyaXB0VGFnKHsgc3JjOiBzcmMgfSk7XG5cbiAgICAgICAgICAgIHNjcmlwdCAmJiBoZWFkLmFwcGVuZENoaWxkKHNjcmlwdCk7XG5cbiAgICAgICAgICAgIEFQSV9ERUZFUlNRdWV1ZVtzb3VyY2VOYW1lXS5wdXNoKGRlZmVyKTtcblxuICAgICAgICAgICAgc2NyaXB0Lm9ubG9hZCA9IF9vbkxvYWQuYmluZChudWxsLCBzb3VyY2VOYW1lKTtcbiAgICAgICAgICAgIHNjcmlwdC5vbmVycm9yID0gX29uRXJyb3IuYmluZChudWxsLCBzb3VyY2VOYW1lKTtcbiAgICAgICAgfVxuXG4gICAgICAgIHJldHVybiBkZWZlci5wcm9taXNlO1xuICAgIH1cblxuICAgIGZ1bmN0aW9uIF9pc0xvYWRlZChzb3VyY2VOYW1lKSB7XG4gICAgICAgIHZhciBjaGVja2VyID0gbnVsbDtcblxuICAgICAgICBzd2l0Y2ggKHNvdXJjZU5hbWUpIHtcbiAgICAgICAgICAgIGNhc2UgQ09ORklHLkNPUkU6XG4gICAgICAgICAgICAgICAgY2hlY2tlciA9IF9pc0NvcmVMb2FkZWQ7XG4gICAgICAgICAgICAgICAgYnJlYWs7XG4gICAgICAgICAgICBjYXNlIENPTkZJRy5TRVJWSUNFOlxuICAgICAgICAgICAgICAgIGNoZWNrZXIgPSBfaXNTZXJ2aWNlTG9hZGVkO1xuICAgICAgICAgICAgICAgIGJyZWFrO1xuICAgICAgICAgICAgY2FzZSBDT05GSUcuVUkuc3JjOlxuICAgICAgICAgICAgICAgIGNoZWNrZXIgPSBfaXNVSUxvYWRlZDtcbiAgICAgICAgICAgICAgICBicmVhaztcbiAgICAgICAgICAgIGNhc2UgQ09ORklHLkVWRU5UUzpcbiAgICAgICAgICAgICAgICBjaGVja2VyID0gX2lzRXZlbnRzTG9hZGVkO1xuICAgICAgICAgICAgICAgIGJyZWFrO1xuICAgICAgICAgICAgZGVmYXVsdDpcbiAgICAgICAgICAgICAgICBjaGVja2VyID0gZnVuY3Rpb24gKCkgeyByZXR1cm4gZmFsc2UgfTtcbiAgICAgICAgfVxuXG4gICAgICAgIHJldHVybiBjaGVja2VyKCk7XG4gICAgfVxuXG4gICAgZnVuY3Rpb24gX2lzQ29yZUxvYWRlZCgpIHtcbiAgICAgICAgcmV0dXJuICEhd2luZG93Lkg7XG4gICAgfVxuXG4gICAgZnVuY3Rpb24gX2lzU2VydmljZUxvYWRlZCgpIHtcbiAgICAgICAgcmV0dXJuICEhKHdpbmRvdy5IICYmIHdpbmRvdy5ILnNlcnZpY2UpO1xuICAgIH1cblxuICAgIGZ1bmN0aW9uIF9pc1VJTG9hZGVkKCkge1xuICAgICAgICByZXR1cm4gISEod2luZG93LkggJiYgd2luZG93LkgudWkpO1xuICAgIH1cblxuICAgIGZ1bmN0aW9uIF9pc0V2ZW50c0xvYWRlZCgpIHtcbiAgICAgICAgcmV0dXJuICEhKHdpbmRvdy5IICYmIHdpbmRvdy5ILm1hcGV2ZW50cyk7XG4gICAgfVxuXG4gICAgZnVuY3Rpb24gX29uTG9hZChzb3VyY2VOYW1lKSB7XG4gICAgICAgIHZhciBkZWZlclF1ZXVlID0gQVBJX0RFRkVSU1F1ZXVlW3NvdXJjZU5hbWVdO1xuICAgICAgICBmb3IgKHZhciBpID0gMCwgbCA9IGRlZmVyUXVldWUubGVuZ3RoOyBpIDwgbDsgKytpKSB7XG4gICAgICAgICAgICB2YXIgZGVmZXIgPSBkZWZlclF1ZXVlW2ldO1xuICAgICAgICAgICAgZGVmZXIucmVzb2x2ZSgpO1xuICAgICAgICB9XG5cbiAgICAgICAgQVBJX0RFRkVSU1F1ZXVlW3NvdXJjZU5hbWVdID0gW107XG4gICAgfVxuXG4gICAgZnVuY3Rpb24gX29uRXJyb3Ioc291cmNlTmFtZSkge1xuICAgICAgICB2YXIgZGVmZXJRdWV1ZSA9IEFQSV9ERUZFUlNRdWV1ZVtzb3VyY2VOYW1lXTtcbiAgICAgICAgZm9yICh2YXIgaSA9IDAsIGwgPSBkZWZlclF1ZXVlLmxlbmd0aDsgaSA8IGw7ICsraSkge1xuICAgICAgICAgICAgdmFyIGRlZmVyID0gZGVmZXJRdWV1ZVtpXTtcbiAgICAgICAgICAgIGRlZmVyLnJlamVjdCgpO1xuICAgICAgICB9XG5cbiAgICAgICAgQVBJX0RFRkVSU1F1ZXVlW3NvdXJjZU5hbWVdID0gW107XG4gICAgfVxufTtcbiIsIm1vZHVsZS5leHBvcnRzID0ge1xuICAgIFVQREFURV9NQVBfUkVTSVpFX1RJTUVPVVQ6IDUwMCxcbiAgICBBTklNQVRJT05fWk9PTV9TVEVQOiAuMDUsXG4gICAgTU9EVUxFUzoge1xuICAgICAgICBVSTogJ2NvbnRyb2xzJyxcbiAgICAgICAgRVZFTlRTOiAnZXZlbnRzJyxcbiAgICAgICAgUEFOTzogJ3Bhbm8nXG4gICAgfSxcbiAgICBERUZBVUxUX01BUF9PUFRJT05TOiB7XG4gICAgICAgIGhlaWdodDogNDgwLFxuICAgICAgICB3aWR0aDogNjQwLFxuICAgICAgICB6b29tOiAxMixcbiAgICAgICAgbWF4Wm9vbTogMixcbiAgICAgICAgcmVzaXplOiBmYWxzZSxcbiAgICAgICAgZHJhZ2dhYmxlOiBmYWxzZSxcbiAgICAgICAgY29vcmRzOiB7XG4gICAgICAgICAgICBsb25naXR1ZGU6IDAsXG4gICAgICAgICAgICBsYXRpdHVkZTogMFxuICAgICAgICB9XG4gICAgfSxcbiAgICBNQVJLRVJfVFlQRVM6IHtcbiAgICAgICAgRE9NOiBcIkRPTVwiLFxuICAgICAgICBTVkc6IFwiU1ZHXCJcbiAgICB9LFxuICAgIENPTlRST0xTOiB7XG4gICAgICAgIE5BTUVTOiB7XG4gICAgICAgICAgICBTQ0FMRTogJ3NjYWxlYmFyJyxcbiAgICAgICAgICAgIFNFVFRJTkdTOiAnbWFwc2V0dGluZ3MnLFxuICAgICAgICAgICAgWk9PTTogJ3pvb20nLFxuICAgICAgICAgICAgVVNFUjogJ3VzZXJwb3NpdGlvbidcbiAgICAgICAgfSxcbiAgICAgICAgUE9TSVRJT05TOiBbXG4gICAgICAgICAgICAndG9wLXJpZ2h0JyxcbiAgICAgICAgICAgICd0b3AtY2VudGVyJyxcbiAgICAgICAgICAgICd0b3AtbGVmdCcsXG4gICAgICAgICAgICAnbGVmdC10b3AnLFxuICAgICAgICAgICAgJ2xlZnQtbWlkZGxlJyxcbiAgICAgICAgICAgICdsZWZ0LWJvdHRvbScsXG4gICAgICAgICAgICAncmlnaHQtdG9wJyxcbiAgICAgICAgICAgICdyaWdodC1taWRkbGUnLFxuICAgICAgICAgICAgJ3JpZ2h0LWJvdHRvbScsXG4gICAgICAgICAgICAnYm90dG9tLXJpZ2h0JyxcbiAgICAgICAgICAgICdib3R0b20tY2VudGVyJyxcbiAgICAgICAgICAgICdib3R0b20tbGVmdCdcbiAgICAgICAgXVxuICAgIH0sXG4gICAgSU5GT0JVQkJMRToge1xuICAgICAgICBTVEFURToge1xuICAgICAgICAgICAgT1BFTjogJ29wZW4nLFxuICAgICAgICAgICAgQ0xPU0VEOiAnY2xvc2VkJ1xuICAgICAgICB9LFxuICAgICAgICBESVNQTEFZX0VWRU5UOiB7XG4gICAgICAgICAgICBwb2ludGVybW92ZTogJ29uSG92ZXInLFxuICAgICAgICAgICAgdGFwOiAnb25DbGljaydcbiAgICAgICAgfVxuICAgIH0sXG4gICAgVVNFUl9FVkVOVFM6IHtcbiAgICAgICAgdGFwOiAnY2xpY2snLFxuICAgICAgICBwb2ludGVybW92ZTogJ21vdXNlbW92ZScsXG4gICAgICAgIHBvaW50ZXJsZWF2ZTogJ21vdXNlbGVhdmUnLFxuICAgICAgICBwb2ludGVyZW50ZXI6ICdtb3VzZWVudGVyJyxcbiAgICAgICAgZHJhZzogJ2RyYWcnLFxuICAgICAgICBkcmFnc3RhcnQ6ICdkcmFnc3RhcnQnLFxuICAgICAgICBkcmFnZW5kOiAnZHJhZ2VuZCcsXG4gICAgICAgIG1hcHZpZXdjaGFuZ2U6ICdtYXB2aWV3Y2hhbmdlJyxcbiAgICAgICAgbWFwdmlld2NoYW5nZXN0YXJ0OiAnbWFwdmlld2NoYW5nZXN0YXJ0JyxcbiAgICAgICAgbWFwdmlld2NoYW5nZWVuZDogJ21hcHZpZXdjaGFuZ2VlbmQnXG4gICAgfVxufSIsIm1vZHVsZS5leHBvcnRzID0gSGVyZU1hcHNFdmVudHNGYWN0b3J5O1xuXG5IZXJlTWFwc0V2ZW50c0ZhY3RvcnkuJGluamVjdCA9IFtcbiAgICAnSGVyZU1hcHNVdGlsc1NlcnZpY2UnLFxuICAgICdIZXJlTWFwc01hcmtlclNlcnZpY2UnLFxuICAgICdIZXJlTWFwc0NPTlNUUycsXG4gICAgJ0hlcmVNYXBzSW5mb0J1YmJsZUZhY3RvcnknXG5dO1xuZnVuY3Rpb24gSGVyZU1hcHNFdmVudHNGYWN0b3J5KEhlcmVNYXBzVXRpbHNTZXJ2aWNlLCBIZXJlTWFwc01hcmtlclNlcnZpY2UsIEhlcmVNYXBzQ09OU1RTLCBIZXJlTWFwc0luZm9CdWJibGVGYWN0b3J5KSB7XG4gICAgZnVuY3Rpb24gRXZlbnRzKHBsYXRmb3JtLCBJbmplY3RvciwgbGlzdGVuZXJzKSB7XG4gICAgICAgIHRoaXMubWFwID0gcGxhdGZvcm0ubWFwO1xuICAgICAgICB0aGlzLmxpc3RlbmVycyA9IGxpc3RlbmVycztcbiAgICAgICAgdGhpcy5pbmplY3QgPSBuZXcgSW5qZWN0b3IoKTtcbiAgICAgICAgdGhpcy5ldmVudHMgPSBwbGF0Zm9ybS5ldmVudHMgPSBuZXcgSC5tYXBldmVudHMuTWFwRXZlbnRzKHRoaXMubWFwKTtcbiAgICAgICAgdGhpcy5iZWhhdmlvciA9IHBsYXRmb3JtLmJlaGF2aW9yID0gbmV3IEgubWFwZXZlbnRzLkJlaGF2aW9yKHRoaXMuZXZlbnRzKTtcbiAgICAgICAgdGhpcy5idWJibGUgPSBIZXJlTWFwc0luZm9CdWJibGVGYWN0b3J5LmNyZWF0ZSgpO1xuXG4gICAgICAgIHRoaXMuc2V0dXBFdmVudExpc3RlbmVycygpO1xuICAgIH1cblxuICAgIHZhciBwcm90byA9IEV2ZW50cy5wcm90b3R5cGU7XG5cbiAgICBwcm90by5zZXR1cEV2ZW50TGlzdGVuZXJzID0gc2V0dXBFdmVudExpc3RlbmVycztcbiAgICBwcm90by5zZXR1cE9wdGlvbnMgPSBzZXR1cE9wdGlvbnM7XG4gICAgcHJvdG8udHJpZ2dlclVzZXJMaXN0ZW5lciA9IHRyaWdnZXJVc2VyTGlzdGVuZXI7XG4gICAgcHJvdG8uaW5mb0J1YmJsZUhhbmRsZXIgPSBpbmZvQnViYmxlSGFuZGxlcjsgIFxuXG4gICAgcmV0dXJuIHtcbiAgICAgICAgc3RhcnQ6IGZ1bmN0aW9uKGFyZ3MpIHtcbiAgICAgICAgICAgIGlmICghKGFyZ3MucGxhdGZvcm0ubWFwIGluc3RhbmNlb2YgSC5NYXApKVxuICAgICAgICAgICAgICAgIHJldHVybiBjb25zb2xlLmVycm9yKCdNaXNzZWQgcmVxdWlyZWQgbWFwIGluc3RhbmNlJyk7XG5cbiAgICAgICAgICAgIHZhciBldmVudHMgPSBuZXcgRXZlbnRzKGFyZ3MucGxhdGZvcm0sIGFyZ3MuaW5qZWN0b3IsIGFyZ3MubGlzdGVuZXJzKTtcblxuICAgICAgICAgICAgYXJncy5vcHRpb25zICYmIGV2ZW50cy5zZXR1cE9wdGlvbnMoYXJncy5vcHRpb25zKTtcbiAgICAgICAgfVxuICAgIH1cblxuICAgIGZ1bmN0aW9uIHNldHVwRXZlbnRMaXN0ZW5lcnMoKSB7XG4gICAgICAgIHZhciBzZWxmID0gdGhpcztcblxuICAgICAgICBIZXJlTWFwc1V0aWxzU2VydmljZS5hZGRFdmVudExpc3RlbmVyKHRoaXMubWFwLCAndGFwJywgdGhpcy5pbmZvQnViYmxlSGFuZGxlci5iaW5kKHRoaXMpKTtcblxuICAgICAgICBIZXJlTWFwc1V0aWxzU2VydmljZS5hZGRFdmVudExpc3RlbmVyKHRoaXMubWFwLCAncG9pbnRlcm1vdmUnLCB0aGlzLmluZm9CdWJibGVIYW5kbGVyLmJpbmQodGhpcykpO1xuXG4gICAgICAgIEhlcmVNYXBzVXRpbHNTZXJ2aWNlLmFkZEV2ZW50TGlzdGVuZXIodGhpcy5tYXAsICdkcmFnc3RhcnQnLCBmdW5jdGlvbihlKSB7XG4gICAgICAgICAgICBpZiAoSGVyZU1hcHNNYXJrZXJTZXJ2aWNlLmlzTWFya2VySW5zdGFuY2UoZS50YXJnZXQpKSB7XG4gICAgICAgICAgICAgICAgc2VsZi5iZWhhdmlvci5kaXNhYmxlKCk7XG4gICAgICAgICAgICB9XG5cbiAgICAgICAgICAgIHNlbGYudHJpZ2dlclVzZXJMaXN0ZW5lcihIZXJlTWFwc0NPTlNUUy5VU0VSX0VWRU5UU1tlLnR5cGVdLCBlKTtcbiAgICAgICAgfSk7XG5cbiAgICAgICAgSGVyZU1hcHNVdGlsc1NlcnZpY2UuYWRkRXZlbnRMaXN0ZW5lcih0aGlzLm1hcCwgJ2RyYWcnLCBmdW5jdGlvbihlKSB7XG4gICAgICAgICAgICB2YXIgcG9pbnRlciA9IGUuY3VycmVudFBvaW50ZXIsXG4gICAgICAgICAgICAgICAgdGFyZ2V0ID0gZS50YXJnZXQ7XG5cbiAgICAgICAgICAgIGlmIChIZXJlTWFwc01hcmtlclNlcnZpY2UuaXNNYXJrZXJJbnN0YW5jZSh0YXJnZXQpKSB7XG4gICAgICAgICAgICAgICAgdGFyZ2V0LnNldFBvc2l0aW9uKHNlbGYubWFwLnNjcmVlblRvR2VvKHBvaW50ZXIudmlld3BvcnRYLCBwb2ludGVyLnZpZXdwb3J0WSkpO1xuICAgICAgICAgICAgfVxuXG4gICAgICAgICAgICBzZWxmLnRyaWdnZXJVc2VyTGlzdGVuZXIoSGVyZU1hcHNDT05TVFMuVVNFUl9FVkVOVFNbZS50eXBlXSwgZSk7XG4gICAgICAgIH0pO1xuXG4gICAgICAgIEhlcmVNYXBzVXRpbHNTZXJ2aWNlLmFkZEV2ZW50TGlzdGVuZXIodGhpcy5tYXAsICdkcmFnZW5kJywgZnVuY3Rpb24oZSkge1xuICAgICAgICAgICAgaWYgKEhlcmVNYXBzTWFya2VyU2VydmljZS5pc01hcmtlckluc3RhbmNlKGUudGFyZ2V0KSkge1xuICAgICAgICAgICAgICAgIHNlbGYuYmVoYXZpb3IuZW5hYmxlKCk7XG4gICAgICAgICAgICB9XG5cbiAgICAgICAgICAgIHNlbGYudHJpZ2dlclVzZXJMaXN0ZW5lcihIZXJlTWFwc0NPTlNUUy5VU0VSX0VWRU5UU1tlLnR5cGVdLCBlKTtcbiAgICAgICAgfSk7XG5cbiAgICAgICAgSGVyZU1hcHNVdGlsc1NlcnZpY2UuYWRkRXZlbnRMaXN0ZW5lcih0aGlzLm1hcCwgJ21hcHZpZXdjaGFuZ2VzdGFydCcsIGZ1bmN0aW9uKGUpIHtcbiAgICAgICAgICAgIHNlbGYudHJpZ2dlclVzZXJMaXN0ZW5lcihIZXJlTWFwc0NPTlNUUy5VU0VSX0VWRU5UU1tlLnR5cGVdLCBlKTtcbiAgICAgICAgfSk7XG5cbiAgICAgICAgSGVyZU1hcHNVdGlsc1NlcnZpY2UuYWRkRXZlbnRMaXN0ZW5lcih0aGlzLm1hcCwgJ21hcHZpZXdjaGFuZ2UnLCBmdW5jdGlvbihlKSB7XG4gICAgICAgICAgICBzZWxmLnRyaWdnZXJVc2VyTGlzdGVuZXIoSGVyZU1hcHNDT05TVFMuVVNFUl9FVkVOVFNbZS50eXBlXSwgZSk7XG4gICAgICAgIH0pO1xuXG4gICAgICAgIEhlcmVNYXBzVXRpbHNTZXJ2aWNlLmFkZEV2ZW50TGlzdGVuZXIodGhpcy5tYXAsICdtYXB2aWV3Y2hhbmdlZW5kJywgZnVuY3Rpb24oZSkge1xuICAgICAgICAgICAgc2VsZi50cmlnZ2VyVXNlckxpc3RlbmVyKEhlcmVNYXBzQ09OU1RTLlVTRVJfRVZFTlRTW2UudHlwZV0sIGUpO1xuICAgICAgICB9KTtcbiAgICB9XG5cbiAgICBmdW5jdGlvbiBzZXR1cE9wdGlvbnMob3B0aW9ucykge1xuICAgICAgICBpZiAoIW9wdGlvbnMpXG4gICAgICAgICAgICByZXR1cm47XG5cbiAgICAgICAgdGhpcy5tYXAuZHJhZ2dhYmxlID0gISFvcHRpb25zLmRyYWdnYWJsZTtcbiAgICB9XG5cbiAgICBmdW5jdGlvbiB0cmlnZ2VyVXNlckxpc3RlbmVyKGV2ZW50TmFtZSwgZSkge1xuICAgICAgICBpZiAoIXRoaXMubGlzdGVuZXJzKVxuICAgICAgICAgICAgcmV0dXJuO1xuXG4gICAgICAgIHZhciBjYWxsYmFjayA9IHRoaXMubGlzdGVuZXJzW2V2ZW50TmFtZV07XG5cbiAgICAgICAgY2FsbGJhY2sgJiYgY2FsbGJhY2soZSk7XG4gICAgfVxuICAgIFxuICAgIGZ1bmN0aW9uIGluZm9CdWJibGVIYW5kbGVyKGUpe1xuICAgICAgICB2YXIgdWkgPSB0aGlzLmluamVjdCgndWknKTtcbiAgICAgICAgXG4gICAgICAgIGlmKHVpKVxuICAgICAgICAgICAgdGhpcy5idWJibGUudG9nZ2xlKGUsIHVpKTtcbiAgICAgICAgICAgIFxuICAgICAgICB0aGlzLnRyaWdnZXJVc2VyTGlzdGVuZXIoSGVyZU1hcHNDT05TVFMuVVNFUl9FVkVOVFNbZS50eXBlXSwgZSk7ICAgICAgXG4gICAgfVxuXG59OyIsIm1vZHVsZS5leHBvcnRzID0gSGVyZU1hcHNJbmZvQnViYmxlRmFjdG9yeTtcblxuSGVyZU1hcHNJbmZvQnViYmxlRmFjdG9yeS4kaW5qZWN0ID0gW1xuICAgICdIZXJlTWFwc01hcmtlclNlcnZpY2UnLFxuICAgICdIZXJlTWFwc1V0aWxzU2VydmljZScsXG4gICAgJ0hlcmVNYXBzQ09OU1RTJ1xuXTtcbmZ1bmN0aW9uIEhlcmVNYXBzSW5mb0J1YmJsZUZhY3RvcnkoSGVyZU1hcHNNYXJrZXJTZXJ2aWNlLCBIZXJlTWFwc1V0aWxzU2VydmljZSwgSGVyZU1hcHNDT05TVFMpIHtcbiAgICBmdW5jdGlvbiBJbmZvQnViYmxlKCkge31cblxuICAgIHZhciBwcm90byA9IEluZm9CdWJibGUucHJvdG90eXBlO1xuICAgICAgICBcbiAgICBwcm90by5jcmVhdGUgPSBjcmVhdGU7XG4gICAgcHJvdG8udXBkYXRlID0gdXBkYXRlO1xuICAgIHByb3RvLnRvZ2dsZSA9IHRvZ2dsZTtcbiAgICBwcm90by5zaG93ID0gc2hvdztcbiAgICBwcm90by5jbG9zZSA9IGNsb3NlO1xuXG4gICAgcmV0dXJuIHtcbiAgICAgICAgY3JlYXRlOiBmdW5jdGlvbigpe1xuICAgICAgICAgICAgcmV0dXJuIG5ldyBJbmZvQnViYmxlKCk7XG4gICAgICAgIH1cbiAgICB9XG5cbiAgICBmdW5jdGlvbiB0b2dnbGUoZSwgdWkpIHtcbiAgICAgICAgaWYgKEhlcmVNYXBzTWFya2VyU2VydmljZS5pc01hcmtlckluc3RhbmNlKGUudGFyZ2V0KSlcbiAgICAgICAgICAgIHRoaXMuc2hvdyhlLCB1aSk7XG4gICAgICAgIGVsc2VcbiAgICAgICAgICAgIHRoaXMuY2xvc2UoZSwgdWkpO1xuICAgIH1cblxuICAgIGZ1bmN0aW9uIHVwZGF0ZShidWJibGUsIGRhdGEpIHtcbiAgICAgICAgYnViYmxlLmRpc3BsYXkgPSBkYXRhLmRpc3BsYXk7XG5cbiAgICAgICAgYnViYmxlLnNldFBvc2l0aW9uKGRhdGEucG9zaXRpb24pO1xuICAgICAgICBidWJibGUuc2V0Q29udGVudChkYXRhLm1hcmt1cCk7XG5cbiAgICAgICAgYnViYmxlLnNldFN0YXRlKEhlcmVNYXBzQ09OU1RTLklORk9CVUJCTEUuU1RBVEUuT1BFTik7XG4gICAgfVxuXG4gICAgZnVuY3Rpb24gY3JlYXRlKHNvdXJjZSkge1xuICAgICAgICB2YXIgYnViYmxlID0gbmV3IEgudWkuSW5mb0J1YmJsZShzb3VyY2UucG9zaXRpb24sIHtcbiAgICAgICAgICAgIGNvbnRlbnQ6IHNvdXJjZS5tYXJrdXBcbiAgICAgICAgfSk7XG5cbiAgICAgICAgYnViYmxlLmRpc3BsYXkgPSBzb3VyY2UuZGlzcGxheTtcbiAgICAgICAgYnViYmxlLmFkZENsYXNzKEhlcmVNYXBzQ09OU1RTLklORk9CVUJCTEUuU1RBVEUuT1BFTilcblxuICAgICAgICBIZXJlTWFwc1V0aWxzU2VydmljZS5hZGRFdmVudExpc3RlbmVyKGJ1YmJsZSwgJ3N0YXRlY2hhbmdlJywgZnVuY3Rpb24oZSkge1xuICAgICAgICAgICAgdmFyIHN0YXRlID0gdGhpcy5nZXRTdGF0ZSgpLFxuICAgICAgICAgICAgICAgIGVsID0gdGhpcy5nZXRFbGVtZW50KCk7XG4gICAgICAgICAgICBpZiAoc3RhdGUgPT09IEhlcmVNYXBzQ09OU1RTLklORk9CVUJCTEUuU1RBVEUuQ0xPU0VEKSB7XG4gICAgICAgICAgICAgICAgZWwuY2xhc3NMaXN0LnJlbW92ZShIZXJlTWFwc0NPTlNUUy5JTkZPQlVCQkxFLlNUQVRFLk9QRU4pO1xuICAgICAgICAgICAgfSBlbHNlXG4gICAgICAgICAgICAgICAgdGhpcy5hZGRDbGFzcyhzdGF0ZSlcbiAgICAgICAgfSk7XG5cbiAgICAgICAgcmV0dXJuIGJ1YmJsZTtcbiAgICB9XG5cbiAgICBmdW5jdGlvbiBzaG93KGUsIHVpLCBkYXRhKSB7XG4gICAgICAgIHZhciB0YXJnZXQgPSBlLnRhcmdldCxcbiAgICAgICAgICAgIGRhdGEgPSB0YXJnZXQuZ2V0RGF0YSgpLFxuICAgICAgICAgICAgZWwgPSBudWxsO1xuXG4gICAgICAgIGlmICghZGF0YSB8fCAhZGF0YS5kaXNwbGF5IHx8ICFkYXRhLm1hcmt1cCB8fCBkYXRhLmRpc3BsYXkgIT09IEhlcmVNYXBzQ09OU1RTLklORk9CVUJCTEUuRElTUExBWV9FVkVOVFtlLnR5cGVdKVxuICAgICAgICAgICAgcmV0dXJuO1xuXG4gICAgICAgIHZhciBzb3VyY2UgPSB7XG4gICAgICAgICAgICBwb3NpdGlvbjogdGFyZ2V0LmdldFBvc2l0aW9uKCksXG4gICAgICAgICAgICBtYXJrdXA6IGRhdGEubWFya3VwLFxuICAgICAgICAgICAgZGlzcGxheTogZGF0YS5kaXNwbGF5XG4gICAgICAgIH07XG5cbiAgICAgICAgaWYgKCF1aS5idWJibGUpIHtcbiAgICAgICAgICAgIHVpLmJ1YmJsZSA9IHRoaXMuY3JlYXRlKHNvdXJjZSk7XG4gICAgICAgICAgICB1aS5hZGRCdWJibGUodWkuYnViYmxlKTtcblxuICAgICAgICAgICAgcmV0dXJuO1xuICAgICAgICB9XG5cbiAgICAgICAgdGhpcy51cGRhdGUodWkuYnViYmxlLCBzb3VyY2UpO1xuICAgIH1cblxuICAgIGZ1bmN0aW9uIGNsb3NlKGUsIHVpKSB7XG4gICAgICAgIGlmICghdWkuYnViYmxlIHx8IHVpLmJ1YmJsZS5kaXNwbGF5ICE9PSBIZXJlTWFwc0NPTlNUUy5JTkZPQlVCQkxFLkRJU1BMQVlfRVZFTlRbZS50eXBlXSkge1xuICAgICAgICAgICAgcmV0dXJuO1xuICAgICAgICB9XG5cbiAgICAgICAgdWkuYnViYmxlLnNldFN0YXRlKEhlcmVNYXBzQ09OU1RTLklORk9CVUJCTEUuU1RBVEUuQ0xPU0VEKTtcbiAgICB9XG59IiwiYW5ndWxhci5tb2R1bGUoJ2hlcmVtYXBzLWV2ZW50cy1tb2R1bGUnLCBbXSlcbiAgICAuZmFjdG9yeSgnSGVyZU1hcHNFdmVudHNGYWN0b3J5JywgcmVxdWlyZSgnLi9ldmVudHMvZXZlbnRzLmpzJykpXG4gICAgLmZhY3RvcnkoJ0hlcmVNYXBzSW5mb0J1YmJsZUZhY3RvcnknLCByZXF1aXJlKCcuL2V2ZW50cy9pbmZvYnViYmxlLmpzJykpO1xuICAgIFxuYW5ndWxhci5tb2R1bGUoJ2hlcmVtYXBzLXVpLW1vZHVsZScsIFtdKVxuICAgIC5mYWN0b3J5KCdIZXJlTWFwc1VpRmFjdG9yeScsIHJlcXVpcmUoJy4vdWkvdWkuanMnKSlcblxubW9kdWxlLmV4cG9ydHMgPSBhbmd1bGFyLm1vZHVsZSgnaGVyZW1hcHMtbWFwLW1vZHVsZXMnLCBbXG5cdCdoZXJlbWFwcy1ldmVudHMtbW9kdWxlJyxcbiAgICAnaGVyZW1hcHMtdWktbW9kdWxlJ1xuXSk7IiwibW9kdWxlLmV4cG9ydHMgPSBIZXJlTWFwc1VpRmFjdG9yeTtcblxuSGVyZU1hcHNVaUZhY3RvcnkuJGluamVjdCA9IFtcbiAgICAnSGVyZU1hcHNBUElTZXJ2aWNlJyxcbiAgICAnSGVyZU1hcHNNYXJrZXJTZXJ2aWNlJyxcbiAgICAnSGVyZU1hcHNVdGlsc1NlcnZpY2UnLFxuICAgICdIZXJlTWFwc0NPTlNUUydcbl07XG5mdW5jdGlvbiBIZXJlTWFwc1VpRmFjdG9yeShIZXJlTWFwc0FQSVNlcnZpY2UsIEhlcmVNYXBzTWFya2VyU2VydmljZSwgSGVyZU1hcHNVdGlsc1NlcnZpY2UsIEhlcmVNYXBzQ09OU1RTKSB7XG4gICAgZnVuY3Rpb24gVUkocGxhdGZvcm0sIGFsaWdubWVudCkge1xuICAgICAgICB0aGlzLm1hcCA9IHBsYXRmb3JtLm1hcDtcbiAgICAgICAgdGhpcy5sYXllcnMgPSBwbGF0Zm9ybS5sYXllcnM7XG4gICAgICAgIHRoaXMuYWxpZ25tZW50ID0gYWxpZ25tZW50O1xuICAgICAgICB0aGlzLnVpID0gcGxhdGZvcm0udWkgPSBILnVpLlVJLmNyZWF0ZURlZmF1bHQodGhpcy5tYXAsIHRoaXMubGF5ZXJzKTtcblxuICAgICAgICB0aGlzLnNldHVwQ29udHJvbHMoKTtcbiAgICB9XG5cbiAgICBVSS5pc1ZhbGlkQWxpZ25tZW50ID0gaXNWYWxpZEFsaWdubWVudDtcblxuICAgIHZhciBwcm90byA9IFVJLnByb3RvdHlwZTtcblxuICAgIHByb3RvLnNldHVwQ29udHJvbHMgPSBzZXR1cENvbnRyb2xzO1xuICAgIHByb3RvLmNyZWF0ZVVzZXJDb250cm9sID0gY3JlYXRlVXNlckNvbnRyb2w7XG4gICAgcHJvdG8uc2V0Q29udHJvbHNBbGlnbm1lbnQgPSBzZXRDb250cm9sc0FsaWdubWVudDtcblxuICAgIHJldHVybiB7XG4gICAgICAgIHN0YXJ0OiBmdW5jdGlvbihhcmdzKSB7XG4gICAgICAgICAgICBpZiAoIShhcmdzLnBsYXRmb3JtLm1hcCBpbnN0YW5jZW9mIEguTWFwKSAmJiAhKGFyZ3MucGxhdGZvcm0ubGF5ZXJzKSlcbiAgICAgICAgICAgICAgICByZXR1cm4gY29uc29sZS5lcnJvcignTWlzc2VkIHVpIG1vZHVsZSBkZXBlbmRlbmNpZXMnKTtcblxuICAgICAgICAgICAgdmFyIHVpID0gbmV3IFVJKGFyZ3MucGxhdGZvcm0sIGFyZ3MuYWxpZ25tZW50KTtcbiAgICAgICAgfVxuICAgIH1cblxuICAgIGZ1bmN0aW9uIHNldHVwQ29udHJvbHMoKSB7XG4gICAgICAgIHZhciBOQU1FUyA9IEhlcmVNYXBzQ09OU1RTLkNPTlRST0xTLk5BTUVTLFxuICAgICAgICAgICAgdXNlckNvbnRyb2wgPSB0aGlzLmNyZWF0ZVVzZXJDb250cm9sKCk7XG5cbiAgICAgICAgdGhpcy51aS5nZXRDb250cm9sKE5BTUVTLlNFVFRJTkdTKS5zZXRJbmNpZGVudHNMYXllcihmYWxzZSk7XG4gICAgICAgIHRoaXMudWkuYWRkQ29udHJvbChOQU1FUy5VU0VSLCB1c2VyQ29udHJvbCk7XG4gICAgICAgIHRoaXMuc2V0Q29udHJvbHNBbGlnbm1lbnQoTkFNRVMpO1xuICAgIH1cblxuICAgIGZ1bmN0aW9uIGNyZWF0ZVVzZXJDb250cm9sKCkge1xuICAgICAgICB2YXIgc2VsZiA9IHRoaXMsXG4gICAgICAgICAgICB1c2VyQ29udHJvbCA9IG5ldyBILnVpLkNvbnRyb2woKSxcbiAgICAgICAgICAgIG1hcmt1cCA9ICc8c3ZnIGNsYXNzPVwiSF9pY29uXCIgZmlsbD1cIiNmZmZcIiB4bWxucz1cImh0dHA6Ly93d3cudzMub3JnLzIwMDAvc3ZnXCIgd2lkdGg9XCIxNlwiIGhlaWdodD1cIjE2XCIgdmlld0JveD1cIjAgMCAxNiAxNlwiPjxwYXRoIGNsYXNzPVwibWlkZGxlX2xvY2F0aW9uX3N0cm9rZVwiIGQ9XCJNOCAxMmMtMi4yMDYgMC00LTEuNzk1LTQtNCAwLTIuMjA2IDEuNzk0LTQgNC00czQgMS43OTQgNCA0YzAgMi4yMDUtMS43OTQgNC00IDRNOCAxLjI1YTYuNzUgNi43NSAwIDEgMCAwIDEzLjUgNi43NSA2Ljc1IDAgMCAwIDAtMTMuNVwiPjwvcGF0aD48cGF0aCBjbGFzcz1cImlubmVyX2xvY2F0aW9uX3N0cm9rZVwiIGQ9XCJNOCA1YTMgMyAwIDEgMSAuMDAxIDZBMyAzIDAgMCAxIDggNW0wLTFDNS43OTQgNCA0IDUuNzk0IDQgOGMwIDIuMjA1IDEuNzk0IDQgNCA0czQtMS43OTUgNC00YzAtMi4yMDYtMS43OTQtNC00LTRcIj48L3BhdGg+PHBhdGggY2xhc3M9XCJvdXRlcl9sb2NhdGlvbl9zdHJva2VcIiBkPVwiTTggMS4yNWE2Ljc1IDYuNzUgMCAxIDEgMCAxMy41IDYuNzUgNi43NSAwIDAgMSAwLTEzLjVNOCAwQzMuNTkgMCAwIDMuNTkgMCA4YzAgNC40MTEgMy41OSA4IDggOHM4LTMuNTg5IDgtOGMwLTQuNDEtMy41OS04LTgtOFwiPjwvcGF0aD48L3N2Zz4nO1xuXG4gICAgICAgIHZhciB1c2VyQ29udHJvbEJ1dHRvbiA9IG5ldyBILnVpLmJhc2UuQnV0dG9uKHtcbiAgICAgICAgICAgIGxhYmVsOiBtYXJrdXAsXG4gICAgICAgICAgICBvblN0YXRlQ2hhbmdlOiBmdW5jdGlvbihldnQpIHtcbiAgICAgICAgICAgICAgICBpZiAodXNlckNvbnRyb2xCdXR0b24uZ2V0U3RhdGUoKSA9PT0gSC51aS5iYXNlLkJ1dHRvbi5TdGF0ZS5ET1dOKVxuICAgICAgICAgICAgICAgICAgICByZXR1cm47XG5cbiAgICAgICAgICAgICAgICBIZXJlTWFwc0FQSVNlcnZpY2UuZ2V0UG9zaXRpb24oKS50aGVuKGZ1bmN0aW9uKHJlc3BvbnNlKSB7XG4gICAgICAgICAgICAgICAgICAgIHZhciBwb3NpdGlvbiA9IHtcbiAgICAgICAgICAgICAgICAgICAgICAgIGxuZzogcmVzcG9uc2UuY29vcmRzLmxvbmdpdHVkZSxcbiAgICAgICAgICAgICAgICAgICAgICAgIGxhdDogcmVzcG9uc2UuY29vcmRzLmxhdGl0dWRlXG4gICAgICAgICAgICAgICAgICAgIH07XG4gICAgICAgICAgICAgICAgICAgIFxuICAgICAgICAgICAgICAgICAgICBzZWxmLm1hcC5zZXRDZW50ZXIocG9zaXRpb24pO1xuICAgICAgICAgICAgICAgICAgICBcbiAgICAgICAgICAgICAgICAgICAgSGVyZU1hcHNVdGlsc1NlcnZpY2Uuem9vbShzZWxmLm1hcCwgMTcsIC4wOCk7XG5cbiAgICAgICAgICAgICAgICAgICAgaWYgKHNlbGYudXNlck1hcmtlcikge1xuICAgICAgICAgICAgICAgICAgICAgICAgc2VsZi51c2VyTWFya2VyLnNldFBvc2l0aW9uKHBvc2l0aW9uKTtcbiAgICAgICAgICAgICAgICAgICAgICAgIHJldHVybjtcbiAgICAgICAgICAgICAgICAgICAgfVxuICAgICAgICAgICAgICAgICAgICBcbiAgICAgICAgICAgICAgICAgICAgc2VsZi51c2VyTWFya2VyID0gSGVyZU1hcHNNYXJrZXJTZXJ2aWNlLmFkZFVzZXJNYXJrZXIoc2VsZi5tYXAsIHtcbiAgICAgICAgICAgICAgICAgICAgICAgIHBvczogcG9zaXRpb25cbiAgICAgICAgICAgICAgICAgICAgfSk7XG4gICAgICAgICAgICAgICAgfSk7XG4gICAgICAgICAgICB9XG4gICAgICAgIH0pO1xuXG4gICAgICAgIHVzZXJDb250cm9sLmFkZENoaWxkKHVzZXJDb250cm9sQnV0dG9uKTtcblxuICAgICAgICByZXR1cm4gdXNlckNvbnRyb2w7XG4gICAgfVxuXG4gICAgZnVuY3Rpb24gc2V0Q29udHJvbHNBbGlnbm1lbnQoTkFNRVMpIHtcbiAgICAgICAgaWYgKCFVSS5pc1ZhbGlkQWxpZ25tZW50KHRoaXMuYWxpZ25tZW50KSlcbiAgICAgICAgICAgIHJldHVybjtcblxuICAgICAgICBmb3IgKHZhciBpZCBpbiBOQU1FUykge1xuICAgICAgICAgICAgdmFyIGNvbnRyb2wgPSB0aGlzLnVpLmdldENvbnRyb2woTkFNRVNbaWRdKTtcblxuICAgICAgICAgICAgaWYgKCFOQU1FUy5oYXNPd25Qcm9wZXJ0eShpZCkgfHwgIWNvbnRyb2wpXG4gICAgICAgICAgICAgICAgY29udGludWU7XG5cbiAgICAgICAgICAgIGNvbnRyb2wuc2V0QWxpZ25tZW50KHRoaXMuYWxpZ25tZW50KTtcbiAgICAgICAgfVxuICAgIH1cblxuICAgIGZ1bmN0aW9uIGlzVmFsaWRBbGlnbm1lbnQoYWxpZ25tZW50KSB7XG4gICAgICAgIHJldHVybiAhIShIZXJlTWFwc0NPTlNUUy5DT05UUk9MUy5QT1NJVElPTlMuaW5kZXhPZihhbGlnbm1lbnQpICsgMSk7XG4gICAgfVxuXG59OyIsIm1vZHVsZS5leHBvcnRzID0gZnVuY3Rpb24oKSB7XG4gICAgdmFyIG9wdGlvbnMgPSB7fTtcbiAgICB2YXIgREVGQVVMVF9BUElfVkVSU0lPTiA9IFwiMy4wXCI7XG5cbiAgICB0aGlzLiRnZXQgPSBmdW5jdGlvbigpe1xuICAgICAgICByZXR1cm4ge1xuICAgICAgICAgICAgYXBwX2lkOiBvcHRpb25zLmFwcF9pZCxcbiAgICAgICAgICAgIGFwcF9jb2RlOiBvcHRpb25zLmFwcF9jb2RlLFxuICAgICAgICAgICAgYXBpVmVyc2lvbjogb3B0aW9ucy5hcGlWZXJzaW9uIHx8IERFRkFVTFRfQVBJX1ZFUlNJT04sXG4gICAgICAgICAgICB1c2VIVFRQUzogb3B0aW9ucy51c2VIVFRQUyxcbiAgICAgICAgICAgIHVzZUNJVDogISFvcHRpb25zLnVzZUNJVCxcbiAgICAgICAgICAgIG1hcFRpbGVDb25maWc6IG9wdGlvbnMubWFwVGlsZUNvbmZpZ1xuICAgICAgICB9XG4gICAgfTtcblxuICAgIHRoaXMuc2V0T3B0aW9ucyA9IGZ1bmN0aW9uKG9wdHMpe1xuICAgICAgICBvcHRpb25zID0gb3B0cztcbiAgICB9O1xufTsiLCJcbm1vZHVsZS5leHBvcnRzID0gSGVyZU1hcHNVdGlsc1NlcnZpY2U7XG5cbkhlcmVNYXBzVXRpbHNTZXJ2aWNlLiRpbmplY3QgPSBbXG4gICAgJyRyb290U2NvcGUnLCBcbiAgICAnJHRpbWVvdXQnLCBcbiAgICAnSGVyZU1hcHNDT05TVFMnXG5dO1xuZnVuY3Rpb24gSGVyZU1hcHNVdGlsc1NlcnZpY2UoJHJvb3RTY29wZSwgJHRpbWVvdXQsIEhlcmVNYXBzQ09OU1RTKSB7XG4gICAgcmV0dXJuIHtcbiAgICAgICAgdGhyb3R0bGU6IHRocm90dGxlLFxuICAgICAgICBjcmVhdGVTY3JpcHRUYWc6IGNyZWF0ZVNjcmlwdFRhZyxcbiAgICAgICAgY3JlYXRlTGlua1RhZzogY3JlYXRlTGlua1RhZyxcbiAgICAgICAgcnVuU2NvcGVEaWdlc3RJZk5lZWQ6IHJ1blNjb3BlRGlnZXN0SWZOZWVkLFxuICAgICAgICBpc1ZhbGlkQ29vcmRzOiBpc1ZhbGlkQ29vcmRzLFxuICAgICAgICBhZGRFdmVudExpc3RlbmVyOiBhZGRFdmVudExpc3RlbmVyLFxuICAgICAgICB6b29tOiB6b29tLFxuICAgICAgICBnZXRCb3VuZHNSZWN0RnJvbVBvaW50czogZ2V0Qm91bmRzUmVjdEZyb21Qb2ludHMsXG4gICAgICAgIGdlbmVyYXRlSWQ6IGdlbmVyYXRlSWQsXG4gICAgICAgIGdldE1hcEZhY3Rvcnk6IGdldE1hcEZhY3RvcnlcbiAgICB9O1xuXG4gICAgLy8jcmVnaW9uIFBVQkxJQ1xuICAgIGZ1bmN0aW9uIHRocm90dGxlKGZuLCBwZXJpb2QpIHtcbiAgICAgICAgdmFyIHRpbWVvdXQgPSBudWxsO1xuXG4gICAgICAgIHJldHVybiBmdW5jdGlvbiAoKSB7XG4gICAgICAgICAgICBpZiAoJHRpbWVvdXQpXG4gICAgICAgICAgICAgICAgJHRpbWVvdXQuY2FuY2VsKHRpbWVvdXQpO1xuXG4gICAgICAgICAgICB0aW1lb3V0ID0gJHRpbWVvdXQoZm4sIHBlcmlvZCk7XG4gICAgICAgIH1cbiAgICB9XG5cbiAgICBmdW5jdGlvbiBhZGRFdmVudExpc3RlbmVyKG9iaiwgZXZlbnROYW1lLCBsaXN0ZW5lciwgdXNlQ2FwdHVyZSkge1xuICAgICAgICBvYmouYWRkRXZlbnRMaXN0ZW5lcihldmVudE5hbWUsIGxpc3RlbmVyLCAhIXVzZUNhcHR1cmUpO1xuICAgIH1cblxuICAgIGZ1bmN0aW9uIHJ1blNjb3BlRGlnZXN0SWZOZWVkKHNjb3BlLCBjYikge1xuICAgICAgICBpZiAoc2NvcGUuJHJvb3QgJiYgc2NvcGUuJHJvb3QuJCRwaGFzZSAhPT0gJyRhcHBseScgJiYgc2NvcGUuJHJvb3QuJCRwaGFzZSAhPT0gJyRkaWdlc3QnKSB7XG4gICAgICAgICAgICBzY29wZS4kZGlnZXN0KGNiIHx8IGFuZ3VsYXIubm9vcCk7XG4gICAgICAgICAgICByZXR1cm4gdHJ1ZTtcbiAgICAgICAgfVxuICAgICAgICByZXR1cm4gZmFsc2U7XG4gICAgfVxuXG4gICAgZnVuY3Rpb24gY3JlYXRlU2NyaXB0VGFnKGF0dHJzKSB7XG4gICAgICAgIHZhciBzY3JpcHQgPSBkb2N1bWVudC5nZXRFbGVtZW50QnlJZChhdHRycy5zcmMpO1xuXG4gICAgICAgIGlmIChzY3JpcHQpXG4gICAgICAgICAgICByZXR1cm4gZmFsc2U7XG5cbiAgICAgICAgc2NyaXB0ID0gZG9jdW1lbnQuY3JlYXRlRWxlbWVudCgnc2NyaXB0Jyk7XG4gICAgICAgIHNjcmlwdC50eXBlID0gJ3RleHQvamF2YXNjcmlwdCc7XG4gICAgICAgIHNjcmlwdC5pZCA9IGF0dHJzLnNyYztcbiAgICAgICAgX3NldEF0dHJzKHNjcmlwdCwgYXR0cnMpO1xuXG4gICAgICAgIHJldHVybiBzY3JpcHQ7XG4gICAgfVxuXG4gICAgZnVuY3Rpb24gY3JlYXRlTGlua1RhZyhhdHRycykge1xuICAgICAgICB2YXIgbGluayA9IGRvY3VtZW50LmdldEVsZW1lbnRCeUlkKGF0dHJzLmhyZWYpO1xuXG4gICAgICAgIGlmIChsaW5rKVxuICAgICAgICAgICAgcmV0dXJuIGZhbHNlO1xuXG4gICAgICAgIGxpbmsgPSBkb2N1bWVudC5jcmVhdGVFbGVtZW50KCdsaW5rJyk7XG4gICAgICAgIGxpbmsuaWQgPSBhdHRycy5ocmVmO1xuICAgICAgICBfc2V0QXR0cnMobGluaywgYXR0cnMpO1xuXG4gICAgICAgIHJldHVybiBsaW5rO1xuICAgIH1cblxuICAgIGZ1bmN0aW9uIGlzVmFsaWRDb29yZHMoY29vcmRzKSB7XG4gICAgICAgIHJldHVybiBjb29yZHMgJiZcbiAgICAgICAgICAgICh0eXBlb2YgY29vcmRzLmxhdGl0dWRlID09PSAnc3RyaW5nJyB8fCB0eXBlb2YgY29vcmRzLmxhdGl0dWRlID09PSAnbnVtYmVyJykgJiZcbiAgICAgICAgICAgICh0eXBlb2YgY29vcmRzLmxvbmdpdHVkZSA9PT0gJ3N0cmluZycgfHwgdHlwZW9mIGNvb3Jkcy5sb25naXR1ZGUgPT09ICdudW1iZXInKVxuICAgIH1cblxuICAgIGZ1bmN0aW9uIHpvb20obWFwLCB2YWx1ZSwgc3RlcCkge1xuICAgICAgICB2YXIgY3VycmVudFpvb20gPSBtYXAuZ2V0Wm9vbSgpLFxuICAgICAgICAgICAgX3N0ZXAgPSBzdGVwIHx8IEhlcmVNYXBzQ09OU1RTLkFOSU1BVElPTl9aT09NX1NURVAsXG4gICAgICAgICAgICBmYWN0b3IgPSBjdXJyZW50Wm9vbSA+PSB2YWx1ZSA/IC0xIDogMSxcbiAgICAgICAgICAgIGluY3JlbWVudCA9IHN0ZXAgKiBmYWN0b3I7XG5cbiAgICAgICAgcmV0dXJuIChmdW5jdGlvbiB6b29tKCkge1xuICAgICAgICAgICAgaWYgKCFzdGVwIHx8IE1hdGguZmxvb3IoY3VycmVudFpvb20pID09PSBNYXRoLmZsb29yKHZhbHVlKSkge1xuICAgICAgICAgICAgICAgIG1hcC5zZXRab29tKHZhbHVlKTtcbiAgICAgICAgICAgICAgICByZXR1cm47XG4gICAgICAgICAgICB9XG5cbiAgICAgICAgICAgIGN1cnJlbnRab29tICs9IGluY3JlbWVudDtcbiAgICAgICAgICAgIG1hcC5zZXRab29tKGN1cnJlbnRab29tKTtcblxuICAgICAgICAgICAgcmVxdWVzdEFuaW1hdGlvbkZyYW1lKHpvb20pO1xuICAgICAgICB9KSgpO1xuICAgIH1cblxuICAgIGZ1bmN0aW9uIGdldE1hcEZhY3RvcnkoKXtcbiAgICAgICAgcmV0dXJuIEg7XG4gICAgfVxuXG4gICAgLyoqXG4gICAgICogQG1ldGhvZCBnZXRCb3VuZHNSZWN0RnJvbVBvaW50c1xuICAgICAqIFxuICAgICAqIEBwYXJhbSB7T2JqZWN0fSB0b3BMZWZ0IFxuICAgICAqICBAcHJvcGVydHkge051bWJlcnxTdHJpbmd9IGxhdFxuICAgICAqICBAcHJvcGVydHkge051bWJlcnxTdHJpbmd9IGxuZ1xuICAgICAqIEBwYXJhbSB7T2JqZWN0fSBib3R0b21SaWdodCBcbiAgICAgKiAgQHByb3BlcnR5IHtOdW1iZXJ8U3RyaW5nfSBsYXRcbiAgICAgKiAgQHByb3BlcnR5IHtOdW1iZXJ8U3RyaW5nfSBsbmdcbiAgICAgKiBcbiAgICAgKiBAcmV0dXJuIHtILmdlby5SZWN0fVxuICAgICAqL1xuICAgIGZ1bmN0aW9uIGdldEJvdW5kc1JlY3RGcm9tUG9pbnRzKHRvcExlZnQsIGJvdHRvbVJpZ2h0KSB7XG4gICAgICAgIHJldHVybiBILmdlby5SZWN0LmZyb21Qb2ludHModG9wTGVmdCwgYm90dG9tUmlnaHQsIHRydWUpO1xuICAgIH1cblxuICAgIGZ1bmN0aW9uIGdlbmVyYXRlSWQoKSB7XG4gICAgICAgIHZhciBtYXNrID0gJ3h4eHh4eHh4LXh4eHgtNHh4eC15eHh4LXh4eHh4eHh4eHh4eCcsXG4gICAgICAgICAgICByZWdleHAgPSAvW3h5XS9nLFxuICAgICAgICAgICAgZCA9IG5ldyBEYXRlKCkuZ2V0VGltZSgpLFxuICAgICAgICAgICAgdXVpZCA9IG1hc2sucmVwbGFjZShyZWdleHAsIGZ1bmN0aW9uIChjKSB7XG4gICAgICAgICAgICAgICAgdmFyIHIgPSAoZCArIE1hdGgucmFuZG9tKCkgKiAxNikgJSAxNiB8IDA7XG4gICAgICAgICAgICAgICAgZCA9IE1hdGguZmxvb3IoZCAvIDE2KTtcbiAgICAgICAgICAgICAgICByZXR1cm4gKGMgPT0gJ3gnID8gciA6IChyICYgMHgzIHwgMHg4KSkudG9TdHJpbmcoMTYpO1xuICAgICAgICAgICAgfSk7XG5cbiAgICAgICAgcmV0dXJuIHV1aWQ7XG4gICAgfVxuXG4gICAgLy8jZW5kcmVnaW9uIFBVQkxJQyBcblxuICAgIGZ1bmN0aW9uIF9zZXRBdHRycyhlbCwgYXR0cnMpIHtcbiAgICAgICAgaWYgKCFlbCB8fCAhYXR0cnMpXG4gICAgICAgICAgICB0aHJvdyBuZXcgRXJyb3IoJ01pc3NlZCBhdHRyaWJ1dGVzJyk7XG5cbiAgICAgICAgZm9yICh2YXIga2V5IGluIGF0dHJzKSB7XG4gICAgICAgICAgICBpZiAoIWF0dHJzLmhhc093blByb3BlcnR5KGtleSkpXG4gICAgICAgICAgICAgICAgY29udGludWU7XG5cbiAgICAgICAgICAgIGVsW2tleV0gPSBhdHRyc1trZXldO1xuICAgICAgICB9XG4gICAgfVxufTsiLCJtb2R1bGUuZXhwb3J0cyA9IEhlcmVNYXBzRGVmYXVsdE1hcmtlcjtcblxuSGVyZU1hcHNEZWZhdWx0TWFya2VyLiRpbmplY3QgPSBbJ0hlcmVNYXBzTWFya2VySW50ZXJmYWNlJ107XG5mdW5jdGlvbiBIZXJlTWFwc0RlZmF1bHRNYXJrZXIoSGVyZU1hcHNNYXJrZXJJbnRlcmZhY2Upe1xuICAgIGZ1bmN0aW9uIERlZmF1bHRNYXJrZXIocGxhY2Upe1xuICAgICAgICB0aGlzLnBsYWNlID0gcGxhY2U7XG4gICAgICAgIHRoaXMuc2V0Q29vcmRzKCk7XG4gICAgfVxuXG4gICAgdmFyIHByb3RvID0gRGVmYXVsdE1hcmtlci5wcm90b3R5cGUgPSBuZXcgSGVyZU1hcHNNYXJrZXJJbnRlcmZhY2UoKTtcbiAgICBwcm90by5jb25zdHJ1Y3RvciA9IERlZmF1bHRNYXJrZXI7XG5cbiAgICBwcm90by5jcmVhdGUgPSBjcmVhdGU7XG5cbiAgICByZXR1cm4gRGVmYXVsdE1hcmtlcjtcbiAgICBcbiAgICBmdW5jdGlvbiBjcmVhdGUoKXtcbiAgICAgICAgdmFyIG1hcmtlciA9IG5ldyBILm1hcC5NYXJrZXIodGhpcy5jb29yZHMpO1xuICAgICAgICBcbiAgICAgICAgdGhpcy5hZGRJbmZvQnViYmxlKG1hcmtlcik7XG4gICAgICAgIFxuICAgICAgICByZXR1cm4gbWFya2VyO1xuICAgIH1cbn0iLCJtb2R1bGUuZXhwb3J0cyA9IEhlcmVNYXBzRE9NTWFya2VyO1xuXG5IZXJlTWFwc0RPTU1hcmtlci4kaW5qZWN0ID0gWydIZXJlTWFwc01hcmtlckludGVyZmFjZSddO1xuZnVuY3Rpb24gSGVyZU1hcHNET01NYXJrZXIoSGVyZU1hcHNNYXJrZXJJbnRlcmZhY2Upe1xuICAgIGZ1bmN0aW9uIERPTU1hcmtlcihwbGFjZSl7XG4gICAgICAgIHRoaXMucGxhY2UgPSBwbGFjZTtcbiAgICAgICAgdGhpcy5zZXRDb29yZHMoKTtcbiAgICB9XG5cbiAgICB2YXIgcHJvdG8gPSBET01NYXJrZXIucHJvdG90eXBlID0gbmV3IEhlcmVNYXBzTWFya2VySW50ZXJmYWNlKCk7XG4gICAgcHJvdG8uY29uc3RydWN0b3IgPSBET01NYXJrZXI7XG5cbiAgICBwcm90by5jcmVhdGUgPSBjcmVhdGU7XG4gICAgcHJvdG8uZ2V0SWNvbiA9IGdldEljb247XG4gICAgcHJvdG8uc2V0dXBFdmVudHMgPSBzZXR1cEV2ZW50cztcblxuICAgIHJldHVybiBET01NYXJrZXI7XG4gICAgXG4gICAgZnVuY3Rpb24gY3JlYXRlKCl7XG4gICAgICAgIHZhciBtYXJrZXIgPSBuZXcgSC5tYXAuRG9tTWFya2VyKHRoaXMuY29vcmRzLCB7XG4gICAgICAgICAgICBpY29uOiB0aGlzLmdldEljb24oKVxuICAgICAgICB9KTtcbiAgICAgICAgXG4gICAgICAgIHRoaXMuYWRkSW5mb0J1YmJsZShtYXJrZXIpO1xuICAgICAgICBcbiAgICAgICAgcmV0dXJuIG1hcmtlcjtcbiAgICB9XG4gICAgXG4gICAgZnVuY3Rpb24gZ2V0SWNvbigpe1xuICAgICAgICB2YXIgaWNvbiA9IHRoaXMucGxhY2UubWFya3VwO1xuICAgICAgICAgaWYoIWljb24pXG4gICAgICAgICAgICB0aHJvdyBuZXcgRXJyb3IoJ21hcmt1cCBtaXNzZWQnKTtcblxuICAgICAgICByZXR1cm4gbmV3IEgubWFwLkRvbUljb24oaWNvbik7XG4gICAgfVxuICAgIFxuICAgIGZ1bmN0aW9uIHNldHVwRXZlbnRzKGVsLCBldmVudHMsIHJlbW92ZSl7XG4gICAgICAgIHZhciBtZXRob2QgPSByZW1vdmUgPyAncmVtb3ZlRXZlbnRMaXN0ZW5lcicgOiAnYWRkRXZlbnRMaXN0ZW5lcic7XG5cbiAgICAgICAgZm9yKHZhciBrZXkgaW4gZXZlbnRzKSB7XG4gICAgICAgICAgICBpZighZXZlbnRzLmhhc093blByb3BlcnR5KGtleSkpXG4gICAgICAgICAgICAgICAgY29udGludWU7XG5cbiAgICAgICAgICAgIGVsW21ldGhvZF0uY2FsbChudWxsLCBrZXksIGV2ZW50c1trZXldKTtcbiAgICAgICAgfVxuICAgIH1cbn0iLCJtb2R1bGUuZXhwb3J0cyA9IGFuZ3VsYXIubW9kdWxlKCdoZXJlbWFwcy1tYXJrZXJzLW1vZHVsZScsIFtdKVxuICAgIC5mYWN0b3J5KCdIZXJlTWFwc01hcmtlckludGVyZmFjZScsIHJlcXVpcmUoJy4vbWFya2VyLmpzJykpXG4gICAgLmZhY3RvcnkoJ0hlcmVNYXBzRGVmYXVsdE1hcmtlcicsIHJlcXVpcmUoJy4vZGVmYXVsdC5tYXJrZXIuanMnKSlcbiAgICAuZmFjdG9yeSgnSGVyZU1hcHNET01NYXJrZXInLCByZXF1aXJlKCcuL2RvbS5tYXJrZXIuanMnKSlcbiAgICAuZmFjdG9yeSgnSGVyZU1hcHNTVkdNYXJrZXInLCByZXF1aXJlKCcuL3N2Zy5tYXJrZXIuanMnKSlcbiAgICAuc2VydmljZSgnSGVyZU1hcHNNYXJrZXJTZXJ2aWNlJywgcmVxdWlyZSgnLi9tYXJrZXJzLnNlcnZpY2UuanMnKSk7IiwibW9kdWxlLmV4cG9ydHMgPSBmdW5jdGlvbigpe1xuICAgIGZ1bmN0aW9uIE1hcmtlckludGVyZmFjZSgpe1xuICAgICAgICB0aHJvdyBuZXcgRXJyb3IoJ0Fic3RyYWN0IGNsYXNzISBUaGUgSW5zdGFuY2Ugc2hvdWxkIGJlIGNyZWF0ZWQnKTtcbiAgICB9XG4gICAgXG4gICAgdmFyIHByb3RvID0gTWFya2VySW50ZXJmYWNlLnByb3RvdHlwZTtcbiAgICBcbiAgICBwcm90by5jcmVhdGUgPSBjcmVhdGU7XG4gICAgcHJvdG8uc2V0Q29vcmRzID0gc2V0Q29vcmRzO1xuICAgIHByb3RvLmFkZEluZm9CdWJibGUgPSBhZGRJbmZvQnViYmxlO1xuICAgIFxuICAgIGZ1bmN0aW9uIE1hcmtlcigpe31cbiAgICBcbiAgICBNYXJrZXIucHJvdG90eXBlID0gcHJvdG87XG4gICAgXG4gICAgcmV0dXJuIE1hcmtlcjtcbiAgICBcbiAgICBmdW5jdGlvbiBjcmVhdGUoKXtcbiAgICAgICAgdGhyb3cgbmV3IEVycm9yKCdjcmVhdGU6OiBub3QgaW1wbGVtZW50ZWQnKTsgXG4gICAgfVxuICAgIFxuICAgIGZ1bmN0aW9uIHNldENvb3Jkcygpe1xuICAgICAgICAgdGhpcy5jb29yZHMgPSB7XG4gICAgICAgICAgICBsYXQ6IHRoaXMucGxhY2UucG9zLmxhdCxcbiAgICAgICAgICAgIGxuZzogdGhpcy5wbGFjZS5wb3MubG5nXG4gICAgICAgIH1cbiAgICB9XG4gICAgXG4gICAgZnVuY3Rpb24gYWRkSW5mb0J1YmJsZShtYXJrZXIpe1xuICAgICAgICBpZighdGhpcy5wbGFjZS5wb3B1cClcbiAgICAgICAgICAgIHJldHVybjtcbiAgICAgICAgICAgIFxuICAgICAgICBtYXJrZXIuc2V0RGF0YSh0aGlzLnBsYWNlLnBvcHVwKVxuICAgIH1cbn0iLCJtb2R1bGUuZXhwb3J0cyA9IEhlcmVNYXBzTWFya2VyU2VydmljZTtcblxuSGVyZU1hcHNNYXJrZXJTZXJ2aWNlLiRpbmplY3QgPSBbXG4gICAgJ0hlcmVNYXBzRGVmYXVsdE1hcmtlcicsXG4gICAgJ0hlcmVNYXBzRE9NTWFya2VyJyxcbiAgICAnSGVyZU1hcHNTVkdNYXJrZXInLFxuICAgICdIZXJlTWFwc0NPTlNUUydcbl07XG5mdW5jdGlvbiBIZXJlTWFwc01hcmtlclNlcnZpY2UoSGVyZU1hcHNEZWZhdWx0TWFya2VyLCBIZXJlTWFwc0RPTU1hcmtlciwgSGVyZU1hcHNTVkdNYXJrZXIsIEhlcmVNYXBzQ09OU1RTKSB7XG4gICAgdmFyIE1BUktFUl9UWVBFUyA9IEhlcmVNYXBzQ09OU1RTLk1BUktFUl9UWVBFUztcblxuICAgIHJldHVybiB7XG4gICAgICAgIGFkZE1hcmtlcnNUb01hcDogYWRkTWFya2Vyc1RvTWFwLFxuICAgICAgICBhZGRVc2VyTWFya2VyOiBhZGRVc2VyTWFya2VyLFxuICAgICAgICB1cGRhdGVNYXJrZXJzOiB1cGRhdGVNYXJrZXJzLFxuICAgICAgICBpc01hcmtlckluc3RhbmNlOiBpc01hcmtlckluc3RhbmNlLFxuICAgICAgICBzZXRWaWV3Qm91bmRzOiBzZXRWaWV3Qm91bmRzXG4gICAgfVxuXG4gICAgZnVuY3Rpb24gaXNNYXJrZXJJbnN0YW5jZSh0YXJnZXQpIHtcbiAgICAgICAgcmV0dXJuIHRhcmdldCBpbnN0YW5jZW9mIEgubWFwLk1hcmtlciB8fCB0YXJnZXQgaW5zdGFuY2VvZiBILm1hcC5Eb21NYXJrZXI7XG4gICAgfVxuXG4gICAgZnVuY3Rpb24gYWRkVXNlck1hcmtlcihtYXAsIHBsYWNlKSB7XG4gICAgICAgIGlmIChtYXAudXNlck1hcmtlcilcbiAgICAgICAgICAgIHJldHVybiBtYXAudXNlck1hcmtlcjtcblxuICAgICAgICBwbGFjZS5tYXJrdXAgPSAnPHN2ZyB3aWR0aD1cIjM1cHhcIiBoZWlnaHQ9XCIzNXB4XCIgdmlld0JveD1cIjAgMCA5MCA5MFwiIHZlcnNpb249XCIxLjFcIiB4bWxucz1cImh0dHA6Ly93d3cudzMub3JnLzIwMDAvc3ZnXCIgeG1sbnM6eGxpbms9XCJodHRwOi8vd3d3LnczLm9yZy8xOTk5L3hsaW5rXCI+JyArXG4gICAgICAgICAgICAnPGRlZnM+PGNpcmNsZSBpZD1cInBhdGgtMVwiIGN4PVwiMzAyXCIgY3k9XCI4MDJcIiByPVwiMTVcIj48L2NpcmNsZT4nICtcbiAgICAgICAgICAgICc8bWFzayBpZD1cIm1hc2stMlwiIG1hc2tDb250ZW50VW5pdHM9XCJ1c2VyU3BhY2VPblVzZVwiIG1hc2tVbml0cz1cIm9iamVjdEJvdW5kaW5nQm94XCIgeD1cIi0zMFwiIHk9XCItMzBcIiB3aWR0aD1cIjkwXCIgaGVpZ2h0PVwiOTBcIj4nICtcbiAgICAgICAgICAgICc8cmVjdCB4PVwiMjU3XCIgeT1cIjc1N1wiIHdpZHRoPVwiOTBcIiBoZWlnaHQ9XCI5MFwiIGZpbGw9XCJ3aGl0ZVwiPjwvcmVjdD48dXNlIHhsaW5rOmhyZWY9XCIjcGF0aC0xXCIgZmlsbD1cImJsYWNrXCI+PC91c2U+JyArXG4gICAgICAgICAgICAnPC9tYXNrPjwvZGVmcz48ZyBpZD1cIlBhZ2UtMVwiIHN0cm9rZT1cIm5vbmVcIiBzdHJva2Utd2lkdGg9XCIxXCIgZmlsbD1cIm5vbmVcIiBmaWxsLXJ1bGU9XCJldmVub2RkXCI+JyArXG4gICAgICAgICAgICAnPGcgaWQ9XCJTZXJ2aWNlLU9wdGlvbnMtLS1kaXJlY3Rpb25zLS0tbWFwXCIgdHJhbnNmb3JtPVwidHJhbnNsYXRlKC0yNTcuMDAwMDAwLCAtNzU3LjAwMDAwMClcIj48ZyBpZD1cIk92YWwtMTVcIj4nICtcbiAgICAgICAgICAgICc8dXNlIGZpbGw9XCIjRkZGRkZGXCIgZmlsbC1ydWxlPVwiZXZlbm9kZFwiIHhsaW5rOmhyZWY9XCIjcGF0aC0xXCI+PC91c2U+JyArXG4gICAgICAgICAgICAnPHVzZSBzdHJva2Utb3BhY2l0eT1cIjAuMjk2MTM5MDRcIiBzdHJva2U9XCIjM0YzNEEwXCIgbWFzaz1cInVybCgjbWFzay0yKVwiIHN0cm9rZS13aWR0aD1cIjYwXCIgeGxpbms6aHJlZj1cIiNwYXRoLTFcIj48L3VzZT4nICtcbiAgICAgICAgICAgICc8dXNlIHN0cm9rZT1cIiMzRjM0QTBcIiBzdHJva2Utd2lkdGg9XCI1XCIgeGxpbms6aHJlZj1cIiNwYXRoLTFcIj48L3VzZT48L2c+PC9nPjwvZz48L3N2Zz4nO1xuXG4gICAgICAgIG1hcC51c2VyTWFya2VyID0gbmV3IEhlcmVNYXBzU1ZHTWFya2VyKHBsYWNlKS5jcmVhdGUoKTtcblxuICAgICAgICBtYXAuYWRkT2JqZWN0KG1hcC51c2VyTWFya2VyKTtcblxuICAgICAgICByZXR1cm4gbWFwLnVzZXJNYXJrZXI7XG4gICAgfVxuXG4gICAgZnVuY3Rpb24gYWRkTWFya2Vyc1RvTWFwKG1hcCwgcGxhY2VzLCByZWZyZXNoVmlld2JvdW5kcykge1xuICAgICAgICBpZiAoIXBsYWNlcyB8fCAhcGxhY2VzLmxlbmd0aClcbiAgICAgICAgICAgIHJldHVybjtcblxuICAgICAgICBpZiAoIShtYXAgaW5zdGFuY2VvZiBILk1hcCkpXG4gICAgICAgICAgICB0aHJvdyBuZXcgRXJyb3IoJ1Vuc3VwcG9ydGVkIG1hcCBpbnN0YW5jZScpO1xuXG4gICAgICAgIGlmICghbWFwLm1hcmtlcnNHcm91cClcbiAgICAgICAgICAgIG1hcC5tYXJrZXJzR3JvdXAgPSBuZXcgSC5tYXAuR3JvdXAoKTtcblxuICAgICAgICBwbGFjZXMuZm9yRWFjaChmdW5jdGlvbiAocGxhY2UsIGkpIHtcbiAgICAgICAgICAgIHZhciBjcmVhdG9yID0gX2dldE1hcmtlckNyZWF0b3IocGxhY2UpLFxuICAgICAgICAgICAgICAgIG1hcmtlciA9IHBsYWNlLmRyYWdnYWJsZSA/IF9kcmFnZ2FibGVNYXJrZXJNaXhpbihjcmVhdG9yLmNyZWF0ZSgpKSA6IGNyZWF0b3IuY3JlYXRlKCk7XG5cbiAgICAgICAgICAgIG1hcC5tYXJrZXJzR3JvdXAuYWRkT2JqZWN0KG1hcmtlcik7XG4gICAgICAgIH0pO1xuXG4gICAgICAgIG1hcC5hZGRPYmplY3QobWFwLm1hcmtlcnNHcm91cCk7XG5cbiAgICAgICAgaWYgKHJlZnJlc2hWaWV3Ym91bmRzKSB7XG4gICAgICAgICAgICBzZXRWaWV3Qm91bmRzKG1hcCwgbWFwLm1hcmtlcnNHcm91cC5nZXRCb3VuZHMoKSk7XG4gICAgICAgIH1cbiAgICB9XG5cbiAgICBmdW5jdGlvbiBzZXRWaWV3Qm91bmRzKG1hcCwgYm91bmRzLCBvcHRfYW5pbWF0ZSkge1xuICAgICAgICBtYXAuc2V0Vmlld0JvdW5kcyhib3VuZHMsICEhb3B0X2FuaW1hdGUpO1xuICAgIH1cblxuICAgIGZ1bmN0aW9uIHVwZGF0ZU1hcmtlcnMobWFwLCBwbGFjZXMsIHJlZnJlc2hWaWV3Ym91bmRzKSB7XG4gICAgICAgIGlmIChtYXAubWFya2Vyc0dyb3VwKSB7XG4gICAgICAgICAgICBtYXAubWFya2Vyc0dyb3VwLnJlbW92ZUFsbCgpO1xuICAgICAgICAgICAgbWFwLnJlbW92ZU9iamVjdChtYXAubWFya2Vyc0dyb3VwKTtcbiAgICAgICAgICAgIG1hcC5tYXJrZXJzR3JvdXAgPSBudWxsO1xuICAgICAgICB9XG5cbiAgICAgICAgYWRkTWFya2Vyc1RvTWFwLmFwcGx5KG51bGwsIGFyZ3VtZW50cyk7XG4gICAgfVxuXG4gICAgZnVuY3Rpb24gX2dldE1hcmtlckNyZWF0b3IocGxhY2UpIHtcbiAgICAgICAgdmFyIENvbmNyZXRlTWFya2VyLFxuICAgICAgICAgICAgdHlwZSA9IHBsYWNlLnR5cGUgPyBwbGFjZS50eXBlLnRvVXBwZXJDYXNlKCkgOiBudWxsO1xuXG4gICAgICAgIHN3aXRjaCAodHlwZSkge1xuICAgICAgICAgICAgY2FzZSBNQVJLRVJfVFlQRVMuRE9NOlxuICAgICAgICAgICAgICAgIENvbmNyZXRlTWFya2VyID0gSGVyZU1hcHNET01NYXJrZXI7XG4gICAgICAgICAgICAgICAgYnJlYWs7XG4gICAgICAgICAgICBjYXNlIE1BUktFUl9UWVBFUy5TVkc6XG4gICAgICAgICAgICAgICAgQ29uY3JldGVNYXJrZXIgPSBIZXJlTWFwc1NWR01hcmtlcjtcbiAgICAgICAgICAgICAgICBicmVhaztcbiAgICAgICAgICAgIGRlZmF1bHQ6XG4gICAgICAgICAgICAgICAgQ29uY3JldGVNYXJrZXIgPSBIZXJlTWFwc0RlZmF1bHRNYXJrZXI7XG4gICAgICAgIH1cblxuICAgICAgICByZXR1cm4gbmV3IENvbmNyZXRlTWFya2VyKHBsYWNlKTtcbiAgICB9XG5cbiAgICBmdW5jdGlvbiBfZHJhZ2dhYmxlTWFya2VyTWl4aW4obWFya2VyKSB7XG4gICAgICAgIG1hcmtlci5kcmFnZ2FibGUgPSB0cnVlO1xuXG4gICAgICAgIHJldHVybiBtYXJrZXI7XG4gICAgfVxufTtcbiIsIm1vZHVsZS5leHBvcnRzID0gSGVyZU1hcHNTVkdNYXJrZXI7XG5cbkhlcmVNYXBzU1ZHTWFya2VyLiRpbmplY3QgPSBbJ0hlcmVNYXBzTWFya2VySW50ZXJmYWNlJ107XG5mdW5jdGlvbiBIZXJlTWFwc1NWR01hcmtlcihIZXJlTWFwc01hcmtlckludGVyZmFjZSl7XG4gICAgZnVuY3Rpb24gU1ZHTWFya2VyKHBsYWNlKXtcbiAgICAgICAgdGhpcy5wbGFjZSA9IHBsYWNlO1xuICAgICAgICB0aGlzLnNldENvb3JkcygpO1xuICAgIH1cbiAgICBcbiAgICB2YXIgcHJvdG8gPSBTVkdNYXJrZXIucHJvdG90eXBlID0gbmV3IEhlcmVNYXBzTWFya2VySW50ZXJmYWNlKCk7XG4gICAgcHJvdG8uY29uc3RydWN0b3IgPSBTVkdNYXJrZXI7XG4gICAgXG4gICAgcHJvdG8uY3JlYXRlID0gY3JlYXRlO1xuICAgIHByb3RvLmdldEljb24gPSBnZXRJY29uO1xuICAgIFxuICAgIHJldHVybiBTVkdNYXJrZXI7XG4gICAgXG4gICAgZnVuY3Rpb24gY3JlYXRlKCl7XG4gICAgICAgIHZhciBtYXJrZXIgPSBuZXcgSC5tYXAuTWFya2VyKHRoaXMuY29vcmRzLCB7XG4gICAgICAgICAgICBpY29uOiB0aGlzLmdldEljb24oKSxcbiAgICAgICAgfSk7XG4gICAgICAgIFxuICAgICAgICB0aGlzLmFkZEluZm9CdWJibGUobWFya2VyKTtcbiAgICAgICAgXG4gICAgICAgIHJldHVybiBtYXJrZXI7XG4gICAgfVxuICAgIFxuICAgIGZ1bmN0aW9uIGdldEljb24oKXtcbiAgICAgICAgdmFyIGljb24gPSB0aGlzLnBsYWNlLm1hcmt1cDtcbiAgICAgICAgIGlmKCFpY29uKVxuICAgICAgICAgICAgdGhyb3cgbmV3IEVycm9yKCdtYXJrdXAgbWlzc2VkJyk7XG5cbiAgICAgICAgcmV0dXJuIG5ldyBILm1hcC5JY29uKGljb24pO1xuICAgIH1cbn0iLCJtb2R1bGUuZXhwb3J0cyA9IGFuZ3VsYXIubW9kdWxlKCdoZXJlbWFwcy1yb3V0ZXMtbW9kdWxlJywgW10pXG4gICAgICAgICAgICAgICAgICAgIC5zZXJ2aWNlKCdIZXJlTWFwc1JvdXRlc1NlcnZpY2UnLCByZXF1aXJlKCcuL3JvdXRlcy5zZXJ2aWNlLmpzJykpOyAgIiwibW9kdWxlLmV4cG9ydHMgPSBIZXJlTWFwc1JvdXRlc1NlcnZpY2U7XG5cbkhlcmVNYXBzUm91dGVzU2VydmljZS4kaW5qZWN0ID0gWyckcScsICdIZXJlTWFwc01hcmtlclNlcnZpY2UnXTtcbmZ1bmN0aW9uIEhlcmVNYXBzUm91dGVzU2VydmljZSgkcSwgSGVyZU1hcHNNYXJrZXJTZXJ2aWNlKSB7XG4gICAgcmV0dXJuIHtcbiAgICAgICAgY2FsY3VsYXRlUm91dGU6IGNhbGN1bGF0ZVJvdXRlLFxuICAgICAgICBhZGRSb3V0ZVRvTWFwOiBhZGRSb3V0ZVRvTWFwLFxuICAgICAgICBjbGVhblJvdXRlczogY2xlYW5Sb3V0ZXNcbiAgICB9XG5cbiAgICBmdW5jdGlvbiBjYWxjdWxhdGVSb3V0ZShoZXJlbWFwcywgY29uZmlnKSB7XG4gICAgICAgIHZhciBwbGF0Zm9ybSA9IGhlcmVtYXBzLnBsYXRmb3JtLFxuICAgICAgICAgICAgbWFwID0gaGVyZW1hcHMubWFwLFxuICAgICAgICAgICAgcm91dGVyID0gcGxhdGZvcm0uZ2V0Um91dGluZ1NlcnZpY2UoKSxcbiAgICAgICAgICAgIGRpciA9IGNvbmZpZy5kaXJlY3Rpb24sXG4gICAgICAgICAgICB3YXlwb2ludHMgPSBkaXIud2F5cG9pbnRzO1xuXG4gICAgICAgIHZhciBtb2RlID0gJ3t7TU9ERX19O3t7VkVDSElMRX19J1xuICAgICAgICAgICAgLnJlcGxhY2UoL3t7TU9ERX19LywgZGlyLm1vZGUgfHwgJ2Zhc3Rlc3QnKVxuICAgICAgICAgICAgLnJlcGxhY2UoL3t7VkVDSElMRX19LywgY29uZmlnLmRyaXZlVHlwZSk7XG5cbiAgICAgICAgdmFyIHJvdXRlUmVxdWVzdFBhcmFtcyA9IHtcbiAgICAgICAgICAgIG1vZGU6IG1vZGUsXG4gICAgICAgICAgICByZXByZXNlbnRhdGlvbjogZGlyLnJlcHJlc2VudGF0aW9uIHx8ICdkaXNwbGF5JyxcbiAgICAgICAgICAgIGxhbmd1YWdlOiBkaXIubGFuZ3VhZ2UgfHwgJ2VuLWdiJ1xuICAgICAgICB9O1xuXG4gICAgICAgIHdheXBvaW50cy5mb3JFYWNoKGZ1bmN0aW9uICh3YXlwb2ludCwgaSkge1xuICAgICAgICAgICAgcm91dGVSZXF1ZXN0UGFyYW1zW1wid2F5cG9pbnRcIiArIGldID0gW3dheXBvaW50LmxhdCwgd2F5cG9pbnQubG5nXS5qb2luKCcsJyk7XG4gICAgICAgIH0pO1xuXG4gICAgICAgIF9zZXRBdHRyaWJ1dGVzKHJvdXRlUmVxdWVzdFBhcmFtcywgZGlyLmF0dHJzKTtcblxuICAgICAgICB2YXIgZGVmZXJyZWQgPSAkcS5kZWZlcigpO1xuXG4gICAgICAgIHJvdXRlci5jYWxjdWxhdGVSb3V0ZShyb3V0ZVJlcXVlc3RQYXJhbXMsIGZ1bmN0aW9uIChyZXN1bHQpIHtcbiAgICAgICAgICAgIGRlZmVycmVkLnJlc29sdmUocmVzdWx0KTtcbiAgICAgICAgfSwgZnVuY3Rpb24gKGVycm9yKSB7XG4gICAgICAgICAgICBkZWZlcnJlZC5yZWplY3QoZXJyb3IpO1xuICAgICAgICB9KTtcblxuICAgICAgICByZXR1cm4gZGVmZXJyZWQucHJvbWlzZTtcbiAgICB9XG5cbiAgICBmdW5jdGlvbiBjbGVhblJvdXRlcyhtYXApIHtcbiAgICAgICAgdmFyIGdyb3VwID0gbWFwLnJvdXRlc0dyb3VwO1xuXG4gICAgICAgIGlmICghZ3JvdXApXG4gICAgICAgICAgICByZXR1cm47XG5cbiAgICAgICAgZ3JvdXAucmVtb3ZlQWxsKCk7XG4gICAgICAgIG1hcC5yZW1vdmVPYmplY3QoZ3JvdXApO1xuICAgICAgICBtYXAucm91dGVzR3JvdXAgPSBudWxsO1xuICAgIH1cblxuICAgIGZ1bmN0aW9uIGFkZFJvdXRlVG9NYXAobWFwLCByb3V0ZURhdGEsIGNsZWFuKSB7XG4gICAgICAgIGlmIChjbGVhbilcbiAgICAgICAgICAgIGNsZWFuUm91dGVzKG1hcCk7XG5cbiAgICAgICAgdmFyIHJvdXRlID0gcm91dGVEYXRhLnJvdXRlO1xuXG4gICAgICAgIGlmICghbWFwIHx8ICFyb3V0ZSB8fCAhcm91dGUuc2hhcGUpXG4gICAgICAgICAgICByZXR1cm47XG5cbiAgICAgICAgdmFyIHN0cmlwID0gbmV3IEguZ2VvLlN0cmlwKCksIHBvbHlsaW5lID0gbnVsbDtcblxuICAgICAgICByb3V0ZS5zaGFwZS5mb3JFYWNoKGZ1bmN0aW9uIChwb2ludCkge1xuICAgICAgICAgICAgdmFyIHBhcnRzID0gcG9pbnQuc3BsaXQoJywnKTtcbiAgICAgICAgICAgIHN0cmlwLnB1c2hMYXRMbmdBbHQocGFydHNbMF0sIHBhcnRzWzFdKTtcbiAgICAgICAgfSk7XG5cbiAgICAgICAgdmFyIHN0eWxlID0gcm91dGVEYXRhLnN0eWxlIHx8IHt9O1xuXG4gICAgICAgIHBvbHlsaW5lID0gbmV3IEgubWFwLlBvbHlsaW5lKHN0cmlwLCB7XG4gICAgICAgICAgICBzdHlsZToge1xuICAgICAgICAgICAgICAgIGxpbmVXaWR0aDogc3R5bGUubGluZVdpZHRoIHx8IDQsXG4gICAgICAgICAgICAgICAgc3Ryb2tlQ29sb3I6IHN0eWxlLmNvbG9yIHx8ICdyZ2JhKDAsIDEyOCwgMjU1LCAwLjcpJ1xuICAgICAgICAgICAgfVxuICAgICAgICB9KTtcblxuICAgICAgICB2YXIgZ3JvdXAgPSBtYXAucm91dGVzR3JvdXA7XG5cbiAgICAgICAgaWYgKCFncm91cCkge1xuICAgICAgICAgICAgZ3JvdXAgPSBtYXAucm91dGVzR3JvdXAgPSBuZXcgSC5tYXAuR3JvdXAoKTtcbiAgICAgICAgICAgIG1hcC5hZGRPYmplY3QoZ3JvdXApO1xuICAgICAgICB9XG5cbiAgICAgICAgZ3JvdXAuYWRkT2JqZWN0KHBvbHlsaW5lKTtcblxuICAgICAgICBpZihyb3V0ZURhdGEuem9vbVRvQm91bmRzKSB7XG4gICAgICAgICAgICBIZXJlTWFwc01hcmtlclNlcnZpY2Uuc2V0Vmlld0JvdW5kcyhtYXAsIHBvbHlsaW5lLmdldEJvdW5kcygpLCB0cnVlKTtcbiAgICAgICAgfVxuICAgIH1cblxuICAgIC8vI3JlZ2lvbiBQUklWQVRFXG5cbiAgICBmdW5jdGlvbiBfc2V0QXR0cmlidXRlcyhwYXJhbXMsIGF0dHJzKSB7XG4gICAgICAgIHZhciBfa2V5ID0gJ2F0dHJpYnV0ZXMnO1xuICAgICAgICBmb3IgKHZhciBrZXkgaW4gYXR0cnMpIHtcbiAgICAgICAgICAgIGlmICghYXR0cnMuaGFzT3duUHJvcGVydHkoa2V5KSlcbiAgICAgICAgICAgICAgICBjb250aW51ZTtcblxuICAgICAgICAgICAgcGFyYW1zW2tleSArIF9rZXldID0gYXR0cnNba2V5XTtcbiAgICAgICAgfVxuICAgIH1cblxuICAgIC8qKlxuICAgICAqIENyZWF0ZXMgYSBzZXJpZXMgb2YgSC5tYXAuTWFya2VyIHBvaW50cyBmcm9tIHRoZSByb3V0ZSBhbmQgYWRkcyB0aGVtIHRvIHRoZSBtYXAuXG4gICAgICogQHBhcmFtIHtPYmplY3R9IHJvdXRlICBBIHJvdXRlIGFzIHJlY2VpdmVkIGZyb20gdGhlIEguc2VydmljZS5Sb3V0aW5nU2VydmljZVxuICAgICAqL1xuICAgIGZ1bmN0aW9uIGFkZE1hbnVldmVyc1RvTWFwKG1hcCwgcm91dGUpIHtcbiAgICAgICAgdmFyIHN2Z01hcmt1cCA9ICc8c3ZnIHdpZHRoPVwiMThcIiBoZWlnaHQ9XCIxOFwiICcgK1xuICAgICAgICAgICAgJ3htbG5zPVwiaHR0cDovL3d3dy53My5vcmcvMjAwMC9zdmdcIj4nICtcbiAgICAgICAgICAgICc8Y2lyY2xlIGN4PVwiOFwiIGN5PVwiOFwiIHI9XCI4XCIgJyArXG4gICAgICAgICAgICAnZmlsbD1cIiMxYjQ2OGRcIiBzdHJva2U9XCJ3aGl0ZVwiIHN0cm9rZS13aWR0aD1cIjFcIiAgLz4nICtcbiAgICAgICAgICAgICc8L3N2Zz4nLFxuICAgICAgICAgICAgZG90SWNvbiA9IG5ldyBILm1hcC5JY29uKHN2Z01hcmt1cCwgeyBhbmNob3I6IHsgeDogOCwgeTogOCB9IH0pLFxuICAgICAgICAgICAgZ3JvdXAgPSBuZXcgSC5tYXAuR3JvdXAoKSwgaSwgajtcblxuICAgICAgICAvLyBBZGQgYSBtYXJrZXIgZm9yIGVhY2ggbWFuZXV2ZXJcbiAgICAgICAgZm9yIChpID0gMDsgaSA8IHJvdXRlLmxlZy5sZW5ndGg7IGkgKz0gMSkge1xuICAgICAgICAgICAgZm9yIChqID0gMDsgaiA8IHJvdXRlLmxlZ1tpXS5tYW5ldXZlci5sZW5ndGg7IGogKz0gMSkge1xuICAgICAgICAgICAgICAgIC8vIEdldCB0aGUgbmV4dCBtYW5ldXZlci5cbiAgICAgICAgICAgICAgICBtYW5ldXZlciA9IHJvdXRlLmxlZ1tpXS5tYW5ldXZlcltqXTtcbiAgICAgICAgICAgICAgICAvLyBBZGQgYSBtYXJrZXIgdG8gdGhlIG1hbmV1dmVycyBncm91cFxuICAgICAgICAgICAgICAgIHZhciBtYXJrZXIgPSBuZXcgSC5tYXAuTWFya2VyKHtcbiAgICAgICAgICAgICAgICAgICAgbGF0OiBtYW5ldXZlci5wb3NpdGlvbi5sYXRpdHVkZSxcbiAgICAgICAgICAgICAgICAgICAgbG5nOiBtYW5ldXZlci5wb3NpdGlvbi5sb25naXR1ZGVcbiAgICAgICAgICAgICAgICB9LFxuICAgICAgICAgICAgICAgICAgICB7IGljb246IGRvdEljb24gfVxuICAgICAgICAgICAgICAgICk7XG5cbiAgICAgICAgICAgICAgICBtYXJrZXIuaW5zdHJ1Y3Rpb24gPSBtYW5ldXZlci5pbnN0cnVjdGlvbjtcbiAgICAgICAgICAgICAgICBncm91cC5hZGRPYmplY3QobWFya2VyKTtcbiAgICAgICAgICAgIH1cbiAgICAgICAgfVxuXG4gICAgICAgIGdyb3VwLmFkZEV2ZW50TGlzdGVuZXIoJ3RhcCcsIGZ1bmN0aW9uIChldnQpIHtcbiAgICAgICAgICAgIG1hcC5zZXRDZW50ZXIoZXZ0LnRhcmdldC5nZXRQb3NpdGlvbigpKTtcbiAgICAgICAgICAgIG9wZW5CdWJibGUoZXZ0LnRhcmdldC5nZXRQb3NpdGlvbigpLCBldnQudGFyZ2V0Lmluc3RydWN0aW9uKTtcbiAgICAgICAgfSwgZmFsc2UpO1xuXG4gICAgICAgIC8vIEFkZCB0aGUgbWFuZXV2ZXJzIGdyb3VwIHRvIHRoZSBtYXBcbiAgICAgICAgbWFwLmFkZE9iamVjdChncm91cCk7XG4gICAgfVxuXG5cbiAgICAvKipcbiAgICAgKiBDcmVhdGVzIGEgc2VyaWVzIG9mIEgubWFwLk1hcmtlciBwb2ludHMgZnJvbSB0aGUgcm91dGUgYW5kIGFkZHMgdGhlbSB0byB0aGUgbWFwLlxuICAgICAqIEBwYXJhbSB7T2JqZWN0fSByb3V0ZSAgQSByb3V0ZSBhcyByZWNlaXZlZCBmcm9tIHRoZSBILnNlcnZpY2UuUm91dGluZ1NlcnZpY2VcbiAgICAgKi9cbiAgICBmdW5jdGlvbiBhZGRXYXlwb2ludHNUb1BhbmVsKHdheXBvaW50cykge1xuICAgICAgICB2YXIgbm9kZUgzID0gZG9jdW1lbnQuY3JlYXRlRWxlbWVudCgnaDMnKSxcbiAgICAgICAgICAgIHdheXBvaW50TGFiZWxzID0gW10sXG4gICAgICAgICAgICBpO1xuXG4gICAgICAgIGZvciAoaSA9IDA7IGkgPCB3YXlwb2ludHMubGVuZ3RoOyBpICs9IDEpIHtcbiAgICAgICAgICAgIHdheXBvaW50TGFiZWxzLnB1c2god2F5cG9pbnRzW2ldLmxhYmVsKVxuICAgICAgICB9XG5cbiAgICAgICAgbm9kZUgzLnRleHRDb250ZW50ID0gd2F5cG9pbnRMYWJlbHMuam9pbignIC0gJyk7XG5cbiAgICAgICAgcm91dGVJbnN0cnVjdGlvbnNDb250YWluZXIuaW5uZXJIVE1MID0gJyc7XG4gICAgICAgIHJvdXRlSW5zdHJ1Y3Rpb25zQ29udGFpbmVyLmFwcGVuZENoaWxkKG5vZGVIMyk7XG4gICAgfVxuXG4gICAgLyoqXG4gICAgICogQ3JlYXRlcyBhIHNlcmllcyBvZiBILm1hcC5NYXJrZXIgcG9pbnRzIGZyb20gdGhlIHJvdXRlIGFuZCBhZGRzIHRoZW0gdG8gdGhlIG1hcC5cbiAgICAgKiBAcGFyYW0ge09iamVjdH0gcm91dGUgIEEgcm91dGUgYXMgcmVjZWl2ZWQgZnJvbSB0aGUgSC5zZXJ2aWNlLlJvdXRpbmdTZXJ2aWNlXG4gICAgICovXG4gICAgZnVuY3Rpb24gYWRkU3VtbWFyeVRvUGFuZWwoc3VtbWFyeSkge1xuICAgICAgICB2YXIgc3VtbWFyeURpdiA9IGRvY3VtZW50LmNyZWF0ZUVsZW1lbnQoJ2RpdicpLFxuICAgICAgICAgICAgY29udGVudCA9ICcnO1xuXG4gICAgICAgIGNvbnRlbnQgKz0gJzxiPlRvdGFsIGRpc3RhbmNlPC9iPjogJyArIHN1bW1hcnkuZGlzdGFuY2UgKyAnbS4gPGJyLz4nO1xuICAgICAgICBjb250ZW50ICs9ICc8Yj5UcmF2ZWwgVGltZTwvYj46ICcgKyBzdW1tYXJ5LnRyYXZlbFRpbWUudG9NTVNTKCkgKyAnIChpbiBjdXJyZW50IHRyYWZmaWMpJztcblxuXG4gICAgICAgIHN1bW1hcnlEaXYuc3R5bGUuZm9udFNpemUgPSAnc21hbGwnO1xuICAgICAgICBzdW1tYXJ5RGl2LnN0eWxlLm1hcmdpbkxlZnQgPSAnNSUnO1xuICAgICAgICBzdW1tYXJ5RGl2LnN0eWxlLm1hcmdpblJpZ2h0ID0gJzUlJztcbiAgICAgICAgc3VtbWFyeURpdi5pbm5lckhUTUwgPSBjb250ZW50O1xuICAgICAgICByb3V0ZUluc3RydWN0aW9uc0NvbnRhaW5lci5hcHBlbmRDaGlsZChzdW1tYXJ5RGl2KTtcbiAgICB9XG5cbiAgICAvKipcbiAgICAgKiBDcmVhdGVzIGEgc2VyaWVzIG9mIEgubWFwLk1hcmtlciBwb2ludHMgZnJvbSB0aGUgcm91dGUgYW5kIGFkZHMgdGhlbSB0byB0aGUgbWFwLlxuICAgICAqIEBwYXJhbSB7T2JqZWN0fSByb3V0ZSAgQSByb3V0ZSBhcyByZWNlaXZlZCBmcm9tIHRoZSBILnNlcnZpY2UuUm91dGluZ1NlcnZpY2VcbiAgICAgKi9cbiAgICBmdW5jdGlvbiBhZGRNYW51ZXZlcnNUb1BhbmVsKHJvdXRlKSB7XG4gICAgICAgIHZhciBub2RlT0wgPSBkb2N1bWVudC5jcmVhdGVFbGVtZW50KCdvbCcpLCBpLCBqO1xuXG4gICAgICAgIG5vZGVPTC5zdHlsZS5mb250U2l6ZSA9ICdzbWFsbCc7XG4gICAgICAgIG5vZGVPTC5zdHlsZS5tYXJnaW5MZWZ0ID0gJzUlJztcbiAgICAgICAgbm9kZU9MLnN0eWxlLm1hcmdpblJpZ2h0ID0gJzUlJztcbiAgICAgICAgbm9kZU9MLmNsYXNzTmFtZSA9ICdkaXJlY3Rpb25zJztcblxuICAgICAgICAvLyBBZGQgYSBtYXJrZXIgZm9yIGVhY2ggbWFuZXV2ZXJcbiAgICAgICAgZm9yIChpID0gMDsgaSA8IHJvdXRlLmxlZy5sZW5ndGg7IGkgKz0gMSkge1xuICAgICAgICAgICAgZm9yIChqID0gMDsgaiA8IHJvdXRlLmxlZ1tpXS5tYW5ldXZlci5sZW5ndGg7IGogKz0gMSkge1xuICAgICAgICAgICAgICAgIC8vIEdldCB0aGUgbmV4dCBtYW5ldXZlci5cbiAgICAgICAgICAgICAgICBtYW5ldXZlciA9IHJvdXRlLmxlZ1tpXS5tYW5ldXZlcltqXTtcblxuICAgICAgICAgICAgICAgIHZhciBsaSA9IGRvY3VtZW50LmNyZWF0ZUVsZW1lbnQoJ2xpJyksXG4gICAgICAgICAgICAgICAgICAgIHNwYW5BcnJvdyA9IGRvY3VtZW50LmNyZWF0ZUVsZW1lbnQoJ3NwYW4nKSxcbiAgICAgICAgICAgICAgICAgICAgc3Bhbkluc3RydWN0aW9uID0gZG9jdW1lbnQuY3JlYXRlRWxlbWVudCgnc3BhbicpO1xuXG4gICAgICAgICAgICAgICAgc3BhbkFycm93LmNsYXNzTmFtZSA9ICdhcnJvdyAnICsgbWFuZXV2ZXIuYWN0aW9uO1xuICAgICAgICAgICAgICAgIHNwYW5JbnN0cnVjdGlvbi5pbm5lckhUTUwgPSBtYW5ldXZlci5pbnN0cnVjdGlvbjtcbiAgICAgICAgICAgICAgICBsaS5hcHBlbmRDaGlsZChzcGFuQXJyb3cpO1xuICAgICAgICAgICAgICAgIGxpLmFwcGVuZENoaWxkKHNwYW5JbnN0cnVjdGlvbik7XG5cbiAgICAgICAgICAgICAgICBub2RlT0wuYXBwZW5kQ2hpbGQobGkpO1xuICAgICAgICAgICAgfVxuICAgICAgICB9XG5cbiAgICAgICAgcm91dGVJbnN0cnVjdGlvbnNDb250YWluZXIuYXBwZW5kQ2hpbGQobm9kZU9MKTtcbiAgICB9XG5cbn07XG4iXX0=
