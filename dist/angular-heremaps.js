(function(){function r(e,n,t){function o(i,f){if(!n[i]){if(!e[i]){var c="function"==typeof require&&require;if(!f&&c)return c(i,!0);if(u)return u(i,!0);var a=new Error("Cannot find module '"+i+"'");throw a.code="MODULE_NOT_FOUND",a}var p=n[i]={exports:{}};e[i][0].call(p.exports,function(r){var n=e[i][1][r];return o(n||r)},p,p.exports,r,e,n,t)}return n[i].exports}for(var u="function"==typeof require&&require,i=0;i<t.length;i++)o(t[i]);return o}return r})()({1:[function(require,module,exports){
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
//# sourceMappingURL=data:application/json;charset=utf-8;base64,eyJ2ZXJzaW9uIjozLCJzb3VyY2VzIjpbIm5vZGVfbW9kdWxlcy9icm93c2VyLXBhY2svX3ByZWx1ZGUuanMiLCJzcmMvaGVyZW1hcHMuZGlyZWN0aXZlLmpzIiwic3JjL2luZGV4LmpzIiwic3JjL3Byb3ZpZGVycy9hcGkuc2VydmljZS5qcyIsInNyYy9wcm92aWRlcnMvY29uc3RzLmpzIiwic3JjL3Byb3ZpZGVycy9tYXAtbW9kdWxlcy9ldmVudHMvZXZlbnRzLmpzIiwic3JjL3Byb3ZpZGVycy9tYXAtbW9kdWxlcy9ldmVudHMvaW5mb2J1YmJsZS5qcyIsInNyYy9wcm92aWRlcnMvbWFwLW1vZHVsZXMvaW5kZXguanMiLCJzcmMvcHJvdmlkZXJzL21hcC1tb2R1bGVzL3VpL3VpLmpzIiwic3JjL3Byb3ZpZGVycy9tYXBjb25maWcucHJvdmlkZXIuanMiLCJzcmMvcHJvdmlkZXJzL21hcHV0aWxzLnNlcnZpY2UuanMiLCJzcmMvcHJvdmlkZXJzL21hcmtlcnMvZGVmYXVsdC5tYXJrZXIuanMiLCJzcmMvcHJvdmlkZXJzL21hcmtlcnMvZG9tLm1hcmtlci5qcyIsInNyYy9wcm92aWRlcnMvbWFya2Vycy9pbmRleC5qcyIsInNyYy9wcm92aWRlcnMvbWFya2Vycy9tYXJrZXIuanMiLCJzcmMvcHJvdmlkZXJzL21hcmtlcnMvbWFya2Vycy5zZXJ2aWNlLmpzIiwic3JjL3Byb3ZpZGVycy9tYXJrZXJzL3N2Zy5tYXJrZXIuanMiLCJzcmMvcHJvdmlkZXJzL3JvdXRlcy9pbmRleC5qcyIsInNyYy9wcm92aWRlcnMvcm91dGVzL3JvdXRlcy5zZXJ2aWNlLmpzIl0sIm5hbWVzIjpbXSwibWFwcGluZ3MiOiJBQUFBO0FDQUE7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTs7QUNqU0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBOztBQ2RBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBOztBQ2pVQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7O0FDcEVBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTs7QUM5R0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTs7QUMzRkE7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTs7QUNWQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBOztBQ3BHQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTs7QUNsQkE7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7O0FDaEpBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTs7QUN2QkE7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTs7QUM5Q0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBOztBQ0xBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7O0FDbENBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7O0FDMUdBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7O0FDbENBO0FBQ0E7O0FDREE7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQSIsImZpbGUiOiJnZW5lcmF0ZWQuanMiLCJzb3VyY2VSb290IjoiIiwic291cmNlc0NvbnRlbnQiOlsiKGZ1bmN0aW9uKCl7ZnVuY3Rpb24gcihlLG4sdCl7ZnVuY3Rpb24gbyhpLGYpe2lmKCFuW2ldKXtpZighZVtpXSl7dmFyIGM9XCJmdW5jdGlvblwiPT10eXBlb2YgcmVxdWlyZSYmcmVxdWlyZTtpZighZiYmYylyZXR1cm4gYyhpLCEwKTtpZih1KXJldHVybiB1KGksITApO3ZhciBhPW5ldyBFcnJvcihcIkNhbm5vdCBmaW5kIG1vZHVsZSAnXCIraStcIidcIik7dGhyb3cgYS5jb2RlPVwiTU9EVUxFX05PVF9GT1VORFwiLGF9dmFyIHA9bltpXT17ZXhwb3J0czp7fX07ZVtpXVswXS5jYWxsKHAuZXhwb3J0cyxmdW5jdGlvbihyKXt2YXIgbj1lW2ldWzFdW3JdO3JldHVybiBvKG58fHIpfSxwLHAuZXhwb3J0cyxyLGUsbix0KX1yZXR1cm4gbltpXS5leHBvcnRzfWZvcih2YXIgdT1cImZ1bmN0aW9uXCI9PXR5cGVvZiByZXF1aXJlJiZyZXF1aXJlLGk9MDtpPHQubGVuZ3RoO2krKylvKHRbaV0pO3JldHVybiBvfXJldHVybiByfSkoKSIsIm1vZHVsZS5leHBvcnRzID0gSGVyZU1hcHNEaXJlY3RpdmU7XHJcblxyXG5IZXJlTWFwc0RpcmVjdGl2ZS4kaW5qZWN0ID0gW1xyXG4gICAgJyR0aW1lb3V0JyxcclxuICAgICckd2luZG93JyxcclxuICAgICckcm9vdFNjb3BlJyxcclxuICAgICckZmlsdGVyJyxcclxuICAgICdIZXJlTWFwc0NvbmZpZycsXHJcbiAgICAnSGVyZU1hcHNBUElTZXJ2aWNlJyxcclxuICAgICdIZXJlTWFwc1V0aWxzU2VydmljZScsXHJcbiAgICAnSGVyZU1hcHNNYXJrZXJTZXJ2aWNlJyxcclxuICAgICdIZXJlTWFwc1JvdXRlc1NlcnZpY2UnLFxyXG4gICAgJ0hlcmVNYXBzQ09OU1RTJyxcclxuICAgICdIZXJlTWFwc0V2ZW50c0ZhY3RvcnknLFxyXG4gICAgJ0hlcmVNYXBzVWlGYWN0b3J5J1xyXG5dO1xyXG5mdW5jdGlvbiBIZXJlTWFwc0RpcmVjdGl2ZShcclxuICAgICR0aW1lb3V0LFxyXG4gICAgJHdpbmRvdyxcclxuICAgICRyb290U2NvcGUsXHJcbiAgICAkZmlsdGVyLFxyXG4gICAgSGVyZU1hcHNDb25maWcsXHJcbiAgICBIZXJlTWFwc0FQSVNlcnZpY2UsXHJcbiAgICBIZXJlTWFwc1V0aWxzU2VydmljZSxcclxuICAgIEhlcmVNYXBzTWFya2VyU2VydmljZSxcclxuICAgIEhlcmVNYXBzUm91dGVzU2VydmljZSxcclxuICAgIEhlcmVNYXBzQ09OU1RTLFxyXG4gICAgSGVyZU1hcHNFdmVudHNGYWN0b3J5LFxyXG4gICAgSGVyZU1hcHNVaUZhY3RvcnkpIHtcclxuXHJcbiAgICBIZXJlTWFwc0RpcmVjdGl2ZUN0cmwuJGluamVjdCA9IFsnJHNjb3BlJywgJyRlbGVtZW50JywgJyRhdHRycyddO1xyXG5cclxuICAgIHJldHVybiB7XHJcbiAgICAgICAgcmVzdHJpY3Q6ICdFQScsXHJcbiAgICAgICAgdGVtcGxhdGU6IFwiPGRpdiBuZy1zdHlsZT1cXFwieyd3aWR0aCc6IG1hcFdpZHRoLCAnaGVpZ2h0JzogbWFwSGVpZ2h0fVxcXCI+PC9kaXY+XCIsXHJcbiAgICAgICAgcmVwbGFjZTogdHJ1ZSxcclxuICAgICAgICBzY29wZToge1xyXG4gICAgICAgICAgICBvcHRzOiAnJm9wdGlvbnMnLFxyXG4gICAgICAgICAgICBwbGFjZXM6ICcmJyxcclxuICAgICAgICAgICAgb25NYXBSZWFkeTogXCImbWFwUmVhZHlcIixcclxuICAgICAgICAgICAgZXZlbnRzOiAnJidcclxuICAgICAgICB9LFxyXG4gICAgICAgIGNvbnRyb2xsZXI6IEhlcmVNYXBzRGlyZWN0aXZlQ3RybFxyXG4gICAgfVxyXG5cclxuICAgIGZ1bmN0aW9uIEhlcmVNYXBzRGlyZWN0aXZlQ3RybCgkc2NvcGUsICRlbGVtZW50LCAkYXR0cnMpIHtcclxuICAgICAgICB2YXIgQ09OVFJPTF9OQU1FUyA9IEhlcmVNYXBzQ09OU1RTLkNPTlRST0xTLk5BTUVTLFxyXG4gICAgICAgICAgICBwbGFjZXMgPSAkc2NvcGUucGxhY2VzKCksXHJcbiAgICAgICAgICAgIG9wdHMgPSAkc2NvcGUub3B0cygpLFxyXG4gICAgICAgICAgICBsaXN0ZW5lcnMgPSAkc2NvcGUuZXZlbnRzKCk7XHJcblxyXG4gICAgICAgIHZhciBvcHRpb25zID0gYW5ndWxhci5leHRlbmQoe30sIEhlcmVNYXBzQ09OU1RTLkRFRkFVTFRfTUFQX09QVElPTlMsIG9wdHMpLFxyXG4gICAgICAgICAgICBwb3NpdGlvbiA9IEhlcmVNYXBzVXRpbHNTZXJ2aWNlLmlzVmFsaWRDb29yZHMob3B0aW9ucy5jb29yZHMpID9cclxuICAgICAgICAgICAgICAgIG9wdGlvbnMuY29vcmRzIDogSGVyZU1hcHNDT05TVFMuREVGQVVMVF9NQVBfT1BUSU9OUy5jb29yZHM7XHJcblxyXG4gICAgICAgIHZhciBoZXJlbWFwcyA9IHsgaWQ6IEhlcmVNYXBzVXRpbHNTZXJ2aWNlLmdlbmVyYXRlSWQoKSB9LFxyXG4gICAgICAgICAgICBtYXBSZWFkeSA9ICRzY29wZS5vbk1hcFJlYWR5KCksXHJcbiAgICAgICAgICAgIF9vblJlc2l6ZU1hcCA9IG51bGw7XHJcblxyXG4gICAgICAgICR0aW1lb3V0KGZ1bmN0aW9uICgpIHtcclxuICAgICAgICAgICAgcmV0dXJuIF9zZXRNYXBTaXplKCk7XHJcbiAgICAgICAgfSkudGhlbihmdW5jdGlvbiAoKSB7XHJcbiAgICAgICAgICAgIEhlcmVNYXBzQVBJU2VydmljZS5sb2FkQXBpKCkudGhlbihfYXBpUmVhZHkpO1xyXG4gICAgICAgIH0pO1xyXG5cclxuICAgICAgICBvcHRpb25zLnJlc2l6ZSAmJiBhZGRPblJlc2l6ZUxpc3RlbmVyKCk7XHJcblxyXG4gICAgICAgICRzY29wZS4kb24oJyRkZXN0cm95JywgZnVuY3Rpb24gKCkge1xyXG4gICAgICAgICAgICAkd2luZG93LnJlbW92ZUV2ZW50TGlzdGVuZXIoJ3Jlc2l6ZScsIF9vblJlc2l6ZU1hcCk7XHJcbiAgICAgICAgfSk7XHJcblxyXG4gICAgICAgIGZ1bmN0aW9uIGFkZE9uUmVzaXplTGlzdGVuZXIoKSB7XHJcbiAgICAgICAgICAgIF9vblJlc2l6ZU1hcCA9IEhlcmVNYXBzVXRpbHNTZXJ2aWNlLnRocm90dGxlKF9yZXNpemVIYW5kbGVyLCBIZXJlTWFwc0NPTlNUUy5VUERBVEVfTUFQX1JFU0laRV9USU1FT1VUKTtcclxuICAgICAgICAgICAgJHdpbmRvdy5hZGRFdmVudExpc3RlbmVyKCdyZXNpemUnLCBfb25SZXNpemVNYXApO1xyXG4gICAgICAgIH1cclxuXHJcbiAgICAgICAgZnVuY3Rpb24gX2FwaVJlYWR5KCkge1xyXG4gICAgICAgICAgICBfc2V0dXBNYXBQbGF0Zm9ybSgpO1xyXG4gICAgICAgICAgICBfc2V0dXBNYXAoKTtcclxuICAgICAgICB9XHJcblxyXG4gICAgICAgIGZ1bmN0aW9uIF9zZXR1cE1hcFBsYXRmb3JtKCkge1xyXG4gICAgICAgICAgICBpZiAoIUhlcmVNYXBzQ29uZmlnLmFwcF9pZCB8fCAhSGVyZU1hcHNDb25maWcuYXBwX2NvZGUpXHJcbiAgICAgICAgICAgICAgICB0aHJvdyBuZXcgRXJyb3IoJ2FwcF9pZCBvciBhcHBfY29kZSB3ZXJlIG1pc3NlZC4gUGxlYXNlIHNwZWNpZnkgdGhlaXIgaW4gSGVyZU1hcHNDb25maWcnKTtcclxuXHJcbiAgICAgICAgICAgIGhlcmVtYXBzLnBsYXRmb3JtID0gbmV3IEguc2VydmljZS5QbGF0Zm9ybShIZXJlTWFwc0NvbmZpZyk7XHJcbiAgICAgICAgICAgIGhlcmVtYXBzLmxheWVycyA9IGhlcmVtYXBzLnBsYXRmb3JtLmNyZWF0ZURlZmF1bHRMYXllcnMoKTtcclxuICAgICAgICB9XHJcblxyXG4gICAgICAgIGZ1bmN0aW9uIF9nZXRMb2NhdGlvbihlbmFibGVIaWdoQWNjdXJhY3ksIG1heGltdW1BZ2UpIHtcclxuICAgICAgICAgICAgdmFyIF9lbmFibGVIaWdoQWNjdXJhY3kgPSAhIWVuYWJsZUhpZ2hBY2N1cmFjeSxcclxuICAgICAgICAgICAgICAgIF9tYXhpbXVtQWdlID0gbWF4aW11bUFnZSB8fCAwO1xyXG5cclxuICAgICAgICAgICAgcmV0dXJuIEhlcmVNYXBzQVBJU2VydmljZS5nZXRQb3NpdGlvbih7XHJcbiAgICAgICAgICAgICAgICBlbmFibGVIaWdoQWNjdXJhY3k6IF9lbmFibGVIaWdoQWNjdXJhY3ksXHJcbiAgICAgICAgICAgICAgICBtYXhpbXVtQWdlOiBfbWF4aW11bUFnZVxyXG4gICAgICAgICAgICB9KTtcclxuICAgICAgICB9XHJcblxyXG4gICAgICAgIGZ1bmN0aW9uIF9sb2NhdGlvbkZhaWx1cmUoKSB7XHJcbiAgICAgICAgICAgIGNvbnNvbGUuZXJyb3IoJ0NhbiBub3QgZ2V0IGEgZ2VvIHBvc2l0aW9uJyk7XHJcbiAgICAgICAgfVxyXG5cclxuICAgICAgICBmdW5jdGlvbiBfc2V0dXBNYXAoKSB7XHJcbiAgICAgICAgICAgIF9pbml0TWFwKGZ1bmN0aW9uICgpIHtcclxuICAgICAgICAgICAgICAgIEhlcmVNYXBzQVBJU2VydmljZS5sb2FkTW9kdWxlcygkYXR0cnMuJGF0dHIsIHtcclxuICAgICAgICAgICAgICAgICAgICBcImNvbnRyb2xzXCI6IF91aU1vZHVsZVJlYWR5LFxyXG4gICAgICAgICAgICAgICAgICAgIFwiZXZlbnRzXCI6IF9ldmVudHNNb2R1bGVSZWFkeVxyXG4gICAgICAgICAgICAgICAgfSk7XHJcbiAgICAgICAgICAgIH0pO1xyXG4gICAgICAgIH1cclxuXHJcbiAgICAgICAgZnVuY3Rpb24gX2luaXRNYXAoY2IpIHtcclxuICAgICAgICAgICAgdmFyIG1hcCA9IGhlcmVtYXBzLm1hcCA9IG5ldyBILk1hcCgkZWxlbWVudFswXSwgaGVyZW1hcHMubGF5ZXJzLm5vcm1hbC5tYXAsIHtcclxuICAgICAgICAgICAgICAgIHpvb206IEhlcmVNYXBzVXRpbHNTZXJ2aWNlLmlzVmFsaWRDb29yZHMocG9zaXRpb24pID8gb3B0aW9ucy56b29tIDogb3B0aW9ucy5tYXhab29tLFxyXG4gICAgICAgICAgICAgICAgY2VudGVyOiBuZXcgSC5nZW8uUG9pbnQocG9zaXRpb24ubGF0aXR1ZGUsIHBvc2l0aW9uLmxvbmdpdHVkZSlcclxuICAgICAgICAgICAgfSk7XHJcblxyXG4gICAgICAgICAgICBIZXJlTWFwc01hcmtlclNlcnZpY2UuYWRkTWFya2Vyc1RvTWFwKG1hcCwgcGxhY2VzLCB0cnVlKTtcclxuXHJcbiAgICAgICAgICAgIGlmIChIZXJlTWFwc0NvbmZpZy5tYXBUaWxlQ29uZmlnKVxyXG4gICAgICAgICAgICAgICAgX3NldEN1c3RvbU1hcFN0eWxlcyhtYXAsIEhlcmVNYXBzQ29uZmlnLm1hcFRpbGVDb25maWcpO1xyXG5cclxuICAgICAgICAgICAgbWFwUmVhZHkgJiYgbWFwUmVhZHkoTWFwUHJveHkoKSk7XHJcblxyXG4gICAgICAgICAgICBjYiAmJiBjYigpO1xyXG5cclxuICAgICAgICB9XHJcblxyXG4gICAgICAgIGZ1bmN0aW9uIF91aU1vZHVsZVJlYWR5KCkge1xyXG4gICAgICAgICAgICBIZXJlTWFwc1VpRmFjdG9yeS5zdGFydCh7XHJcbiAgICAgICAgICAgICAgICBwbGF0Zm9ybTogaGVyZW1hcHMsXHJcbiAgICAgICAgICAgICAgICBhbGlnbm1lbnQ6ICRhdHRycy5jb250cm9sc1xyXG4gICAgICAgICAgICB9KTtcclxuICAgICAgICB9XHJcblxyXG4gICAgICAgIGZ1bmN0aW9uIF9ldmVudHNNb2R1bGVSZWFkeSgpIHtcclxuICAgICAgICAgICAgSGVyZU1hcHNFdmVudHNGYWN0b3J5LnN0YXJ0KHtcclxuICAgICAgICAgICAgICAgIHBsYXRmb3JtOiBoZXJlbWFwcyxcclxuICAgICAgICAgICAgICAgIGxpc3RlbmVyczogbGlzdGVuZXJzLFxyXG4gICAgICAgICAgICAgICAgb3B0aW9uczogb3B0aW9ucyxcclxuICAgICAgICAgICAgICAgIGluamVjdG9yOiBfbW9kdWxlSW5qZWN0b3JcclxuICAgICAgICAgICAgfSk7XHJcbiAgICAgICAgfVxyXG5cclxuICAgICAgICBmdW5jdGlvbiBfbW9kdWxlSW5qZWN0b3IoKSB7XHJcbiAgICAgICAgICAgIHJldHVybiBmdW5jdGlvbiAoaWQpIHtcclxuICAgICAgICAgICAgICAgIHJldHVybiBoZXJlbWFwc1tpZF07XHJcbiAgICAgICAgICAgIH1cclxuICAgICAgICB9XHJcblxyXG4gICAgICAgIGZ1bmN0aW9uIF9yZXNpemVIYW5kbGVyKGhlaWdodCwgd2lkdGgpIHtcclxuICAgICAgICAgICAgX3NldE1hcFNpemUuYXBwbHkobnVsbCwgYXJndW1lbnRzKTtcclxuXHJcbiAgICAgICAgICAgIGhlcmVtYXBzLm1hcC5nZXRWaWV3UG9ydCgpLnJlc2l6ZSgpO1xyXG4gICAgICAgIH1cclxuXHJcbiAgICAgICAgZnVuY3Rpb24gX3NldE1hcFNpemUoaGVpZ2h0LCB3aWR0aCkge1xyXG4gICAgICAgICAgICB2YXIgaGVpZ2h0ID0gaGVpZ2h0IHx8ICRlbGVtZW50WzBdLnBhcmVudE5vZGUub2Zmc2V0SGVpZ2h0IHx8IG9wdGlvbnMuaGVpZ2h0LFxyXG4gICAgICAgICAgICAgICAgd2lkdGggPSB3aWR0aCB8fCAkZWxlbWVudFswXS5wYXJlbnROb2RlLm9mZnNldFdpZHRoIHx8IG9wdGlvbnMud2lkdGg7XHJcblxyXG4gICAgICAgICAgICAkc2NvcGUubWFwSGVpZ2h0ID0gaGVpZ2h0ICsgJ3B4JztcclxuICAgICAgICAgICAgJHNjb3BlLm1hcFdpZHRoID0gd2lkdGggKyAncHgnO1xyXG5cclxuICAgICAgICAgICAgSGVyZU1hcHNVdGlsc1NlcnZpY2UucnVuU2NvcGVEaWdlc3RJZk5lZWQoJHNjb3BlKTtcclxuICAgICAgICB9XHJcbiAgICAgICAgXHJcbiAgICAgICAgZnVuY3Rpb24gX3NldEN1c3RvbU1hcFN0eWxlcyhtYXAsIGNvbmZpZykge1xyXG4gICAgICAgICAgICAvLyBDcmVhdGUgYSBNYXBUaWxlU2VydmljZSBpbnN0YW5jZSB0byByZXF1ZXN0IGJhc2UgdGlsZXMgKGkuZS4gYmFzZS5tYXAuYXBpLmhlcmUuY29tKTpcclxuICAgICAgICAgICAgdmFyIG1hcFRpbGVTZXJ2aWNlID0gaGVyZW1hcHMucGxhdGZvcm0uZ2V0TWFwVGlsZVNlcnZpY2UoeyAndHlwZSc6ICdiYXNlJyB9KTtcclxuXHJcbiAgICAgICAgICAgIC8vIENyZWF0ZSBhIHRpbGUgbGF5ZXIgd2hpY2ggcmVxdWVzdHMgbWFwIHRpbGVzXHJcbiAgICAgICAgICAgIHZhciBuZXdTdHlsZUxheWVyID0gbWFwVGlsZVNlcnZpY2UuY3JlYXRlVGlsZUxheWVyKFxyXG4gICAgICAgICAgICAgICAgJ21hcHRpbGUnLCBcclxuICAgICAgICAgICAgICAgIGNvbmZpZy5zY2hlbWUgfHwgJ25vcm1hbC5kYXknLCBcclxuICAgICAgICAgICAgICAgIGNvbmZpZy5zaXplIHx8IDI1NiwgXHJcbiAgICAgICAgICAgICAgICBjb25maWcuZm9ybWF0IHx8ICdwbmc4JywgXHJcbiAgICAgICAgICAgICAgICBjb25maWcubWV0YWRhdGFRdWVyeVBhcmFtcyB8fCB7fVxyXG4gICAgICAgICAgICApO1xyXG4gICAgICAgICAgICBcclxuICAgICAgICAgICAgLy8gU2V0IG5ldyBzdHlsZSBsYXllciBhcyBhIGJhc2UgbGF5ZXIgb24gdGhlIG1hcDpcclxuICAgICAgICAgICAgbWFwLnNldEJhc2VMYXllcihuZXdTdHlsZUxheWVyKTtcclxuICAgICAgICB9XHJcblxyXG4gICAgICAgIGZ1bmN0aW9uIE1hcFByb3h5KCkge1xyXG4gICAgICAgICAgICByZXR1cm4ge1xyXG4gICAgICAgICAgICAgICAgcmVmcmVzaDogZnVuY3Rpb24gKCkge1xyXG4gICAgICAgICAgICAgICAgICAgIHZhciBjdXJyZW50Qm91bmRzID0gdGhpcy5nZXRWaWV3Qm91bmRzKCk7XHJcblxyXG4gICAgICAgICAgICAgICAgICAgIHRoaXMuc2V0TWFwU2l6ZXMoKTtcclxuICAgICAgICAgICAgICAgICAgICB0aGlzLnNldFZpZXdCb3VuZHMoY3VycmVudEJvdW5kcyk7XHJcbiAgICAgICAgICAgICAgICB9LFxyXG4gICAgICAgICAgICAgICAgc2V0TWFwU2l6ZXM6IGZ1bmN0aW9uIChoZWlnaHQsIHdpZHRoKSB7XHJcbiAgICAgICAgICAgICAgICAgICAgX3Jlc2l6ZUhhbmRsZXIuYXBwbHkobnVsbCwgYXJndW1lbnRzKTtcclxuICAgICAgICAgICAgICAgIH0sXHJcbiAgICAgICAgICAgICAgICBnZXRQbGF0Zm9ybTogZnVuY3Rpb24gKCkge1xyXG4gICAgICAgICAgICAgICAgICAgIHJldHVybiBoZXJlbWFwcztcclxuICAgICAgICAgICAgICAgIH0sXHJcbiAgICAgICAgICAgICAgICBjYWxjdWxhdGVSb3V0ZTogZnVuY3Rpb24gKGRyaXZlVHlwZSwgZGlyZWN0aW9uKSB7XHJcbiAgICAgICAgICAgICAgICAgICAgcmV0dXJuIEhlcmVNYXBzUm91dGVzU2VydmljZS5jYWxjdWxhdGVSb3V0ZShoZXJlbWFwcywge1xyXG4gICAgICAgICAgICAgICAgICAgICAgICBkcml2ZVR5cGU6IGRyaXZlVHlwZSxcclxuICAgICAgICAgICAgICAgICAgICAgICAgZGlyZWN0aW9uOiBkaXJlY3Rpb25cclxuICAgICAgICAgICAgICAgICAgICB9KTtcclxuICAgICAgICAgICAgICAgIH0sXHJcbiAgICAgICAgICAgICAgICBhZGRSb3V0ZVRvTWFwOiBmdW5jdGlvbiAocm91dGVEYXRhLCBjbGVhbikge1xyXG4gICAgICAgICAgICAgICAgICAgIEhlcmVNYXBzUm91dGVzU2VydmljZS5hZGRSb3V0ZVRvTWFwKGhlcmVtYXBzLm1hcCwgcm91dGVEYXRhLCBjbGVhbik7XHJcbiAgICAgICAgICAgICAgICB9LFxyXG4gICAgICAgICAgICAgICAgc2V0Wm9vbTogZnVuY3Rpb24gKHpvb20sIHN0ZXApIHtcclxuICAgICAgICAgICAgICAgICAgICBIZXJlTWFwc1V0aWxzU2VydmljZS56b29tKGhlcmVtYXBzLm1hcCwgem9vbSB8fCAxMCwgc3RlcCk7XHJcbiAgICAgICAgICAgICAgICB9LFxyXG4gICAgICAgICAgICAgICAgZ2V0Wm9vbTogZnVuY3Rpb24gKCkge1xyXG4gICAgICAgICAgICAgICAgICAgIHJldHVybiBoZXJlbWFwcy5tYXAuZ2V0Wm9vbSgpO1xyXG4gICAgICAgICAgICAgICAgfSxcclxuICAgICAgICAgICAgICAgIGdldENlbnRlcjogZnVuY3Rpb24gKCkge1xyXG4gICAgICAgICAgICAgICAgICAgIHJldHVybiBoZXJlbWFwcy5tYXAuZ2V0Q2VudGVyKCk7XHJcbiAgICAgICAgICAgICAgICB9LFxyXG4gICAgICAgICAgICAgICAgZ2V0Vmlld0JvdW5kczogZnVuY3Rpb24gKCkge1xyXG4gICAgICAgICAgICAgICAgICAgIHJldHVybiBoZXJlbWFwcy5tYXAuZ2V0Vmlld0JvdW5kcygpO1xyXG4gICAgICAgICAgICAgICAgfSxcclxuICAgICAgICAgICAgICAgIHNldFZpZXdCb3VuZHM6IGZ1bmN0aW9uIChib3VuZGluZ1JlY3QsIG9wdF9hbmltYXRlKSB7XHJcbiAgICAgICAgICAgICAgICAgICAgSGVyZU1hcHNNYXJrZXJTZXJ2aWNlLnNldFZpZXdCb3VuZHMoaGVyZW1hcHMubWFwLCBib3VuZGluZ1JlY3QsIG9wdF9hbmltYXRlKTtcclxuICAgICAgICAgICAgICAgIH0sXHJcbiAgICAgICAgICAgICAgICBnZXRCb3VuZHNSZWN0RnJvbVBvaW50czogZnVuY3Rpb24gKHRvcExlZnQsIGJvdHRvbVJpZ2h0KSB7XHJcbiAgICAgICAgICAgICAgICAgICAgcmV0dXJuIEhlcmVNYXBzVXRpbHNTZXJ2aWNlLmdldEJvdW5kc1JlY3RGcm9tUG9pbnRzLmFwcGx5KG51bGwsIGFyZ3VtZW50cyk7XHJcbiAgICAgICAgICAgICAgICB9LFxyXG4gICAgICAgICAgICAgICAgc2V0Q2VudGVyOiBmdW5jdGlvbiAoY29vcmRzKSB7XHJcbiAgICAgICAgICAgICAgICAgICAgaWYgKCFjb29yZHMpIHtcclxuICAgICAgICAgICAgICAgICAgICAgICAgcmV0dXJuIGNvbnNvbGUuZXJyb3IoJ2Nvb3JkcyBhcmUgbm90IHNwZWNpZmllZCEnKTtcclxuICAgICAgICAgICAgICAgICAgICB9XHJcblxyXG4gICAgICAgICAgICAgICAgICAgIGhlcmVtYXBzLm1hcC5zZXRDZW50ZXIoY29vcmRzKTtcclxuICAgICAgICAgICAgICAgIH0sXHJcbiAgICAgICAgICAgICAgICBjbGVhblJvdXRlczogZnVuY3Rpb24gKCkge1xyXG4gICAgICAgICAgICAgICAgICAgIEhlcmVNYXBzUm91dGVzU2VydmljZS5jbGVhblJvdXRlcyhoZXJlbWFwcy5tYXApO1xyXG4gICAgICAgICAgICAgICAgfSxcclxuXHJcbiAgICAgICAgICAgICAgICAvKipcclxuICAgICAgICAgICAgICAgICAqIEBwYXJhbSB7Qm9vbGVhbn0gZW5hYmxlSGlnaEFjY3VyYWN5XHJcbiAgICAgICAgICAgICAgICAgKiBAcGFyYW0ge051bWJlcn0gbWF4aW11bUFnZSAtIHRoZSBtYXhpbXVtIGFnZSBpbiBtaWxsaXNlY29uZHMgb2YgYSBwb3NzaWJsZSBjYWNoZWQgcG9zaXRpb24gdGhhdCBpcyBhY2NlcHRhYmxlIHRvIHJldHVybi4gSWYgc2V0IHRvIDAsIGl0IG1lYW5zIHRoYXQgdGhlIGRldmljZSBjYW5ub3QgdXNlIGEgY2FjaGVkIHBvc2l0aW9uIGFuZCBtdXN0IGF0dGVtcHQgdG8gcmV0cmlldmUgdGhlIHJlYWwgY3VycmVudCBwb3NpdGlvblxyXG4gICAgICAgICAgICAgICAgICogQHJldHVybiB7UHJvbWlzZX1cclxuICAgICAgICAgICAgICAgICAqL1xyXG4gICAgICAgICAgICAgICAgZ2V0VXNlckxvY2F0aW9uOiBmdW5jdGlvbiAoZW5hYmxlSGlnaEFjY3VyYWN5LCBtYXhpbXVtQWdlKSB7XHJcbiAgICAgICAgICAgICAgICAgICAgcmV0dXJuIF9nZXRMb2NhdGlvbi5hcHBseShudWxsLCBhcmd1bWVudHMpLnRoZW4oZnVuY3Rpb24gKHBvc2l0aW9uKSB7XHJcbiAgICAgICAgICAgICAgICAgICAgICAgIHZhciBjb29yZHMgPSBwb3NpdGlvbi5jb29yZHM7XHJcblxyXG4gICAgICAgICAgICAgICAgICAgICAgICByZXR1cm4ge1xyXG4gICAgICAgICAgICAgICAgICAgICAgICAgICAgbGF0OiBjb29yZHMubGF0aXR1ZGUsXHJcbiAgICAgICAgICAgICAgICAgICAgICAgICAgICBsbmc6IGNvb3Jkcy5sb25naXR1ZGVcclxuICAgICAgICAgICAgICAgICAgICAgICAgfTtcclxuICAgICAgICAgICAgICAgICAgICB9KVxyXG4gICAgICAgICAgICAgICAgfSxcclxuICAgICAgICAgICAgICAgIGdlb2NvZGVQb3NpdGlvbjogZnVuY3Rpb24gKGNvb3Jkcywgb3B0aW9ucykge1xyXG4gICAgICAgICAgICAgICAgICAgIHJldHVybiBIZXJlTWFwc0FQSVNlcnZpY2UuZ2VvY29kZVBvc2l0aW9uKGhlcmVtYXBzLnBsYXRmb3JtLCB7XHJcbiAgICAgICAgICAgICAgICAgICAgICAgIGNvb3JkczogY29vcmRzLFxyXG4gICAgICAgICAgICAgICAgICAgICAgICByYWRpdXM6IG9wdGlvbnMgJiYgb3B0aW9ucy5yYWRpdXMsXHJcbiAgICAgICAgICAgICAgICAgICAgICAgIGxhbmc6IG9wdGlvbnMgJiYgb3B0aW9ucy5sYW5nXHJcbiAgICAgICAgICAgICAgICAgICAgfSk7XHJcbiAgICAgICAgICAgICAgICB9LFxyXG4gICAgICAgICAgICAgICAgZ2VvY29kZUFkZHJlc3M6IGZ1bmN0aW9uIChhZGRyZXNzKSB7XHJcbiAgICAgICAgICAgICAgICAgICAgcmV0dXJuIEhlcmVNYXBzQVBJU2VydmljZS5nZW9jb2RlQWRkcmVzcyhoZXJlbWFwcy5wbGF0Zm9ybSwge1xyXG4gICAgICAgICAgICAgICAgICAgICAgICBzZWFyY2h0ZXh0OiBhZGRyZXNzICYmIGFkZHJlc3Muc2VhcmNodGV4dCxcclxuICAgICAgICAgICAgICAgICAgICAgICAgY291bnRyeTogYWRkcmVzcyAmJiBhZGRyZXNzLmNvdW50cnksXHJcbiAgICAgICAgICAgICAgICAgICAgICAgIGNpdHk6IGFkZHJlc3MgJiYgYWRkcmVzcy5jaXR5LFxyXG4gICAgICAgICAgICAgICAgICAgICAgICBzdHJlZXQ6IGFkZHJlc3MgJiYgYWRkcmVzcy5zdHJlZXQsXHJcbiAgICAgICAgICAgICAgICAgICAgICAgIGhvdXNlbnVtYmVyOiBhZGRyZXNzICYmIGFkZHJlc3MuaG91c2VudW1iZXJcclxuICAgICAgICAgICAgICAgICAgICB9KTtcclxuICAgICAgICAgICAgICAgIH0sXHJcbiAgICAgICAgICAgICAgICBnZW9jb2RlQXV0b2NvbXBsZXRlOiBmdW5jdGlvbiAocXVlcnksIG9wdGlvbnMpIHtcclxuICAgICAgICAgICAgICAgICAgICByZXR1cm4gSGVyZU1hcHNBUElTZXJ2aWNlLmdlb2NvZGVBdXRvY29tcGxldGUoe1xyXG4gICAgICAgICAgICAgICAgICAgICAgICBxdWVyeTogcXVlcnksXHJcbiAgICAgICAgICAgICAgICAgICAgICAgIGJlZ2luSGlnaGxpZ2h0OiBvcHRpb25zICYmIG9wdGlvbnMuYmVnaW5IaWdobGlnaHQsXHJcbiAgICAgICAgICAgICAgICAgICAgICAgIGVuZEhpZ2hsaWdodDogb3B0aW9ucyAmJiBvcHRpb25zLmVuZEhpZ2hsaWdodCxcclxuICAgICAgICAgICAgICAgICAgICAgICAgbWF4cmVzdWx0czogb3B0aW9ucyAmJiBvcHRpb25zLm1heHJlc3VsdHNcclxuICAgICAgICAgICAgICAgICAgICB9KTtcclxuICAgICAgICAgICAgICAgIH0sXHJcbiAgICAgICAgICAgICAgICBmaW5kTG9jYXRpb25CeUlkOiBmdW5jdGlvbiAobG9jYXRpb25JZCkge1xyXG4gICAgICAgICAgICAgICAgICAgIHJldHVybiBIZXJlTWFwc0FQSVNlcnZpY2UuZmluZExvY2F0aW9uQnlJZChsb2NhdGlvbklkKTtcclxuICAgICAgICAgICAgICAgIH0sXHJcbiAgICAgICAgICAgICAgICB1cGRhdGVNYXJrZXJzOiBmdW5jdGlvbiAocGxhY2VzLCByZWZyZXNoVmlld2JvdW5kcykge1xyXG4gICAgICAgICAgICAgICAgICAgIEhlcmVNYXBzTWFya2VyU2VydmljZS51cGRhdGVNYXJrZXJzKGhlcmVtYXBzLm1hcCwgcGxhY2VzLCByZWZyZXNoVmlld2JvdW5kcyk7XHJcbiAgICAgICAgICAgICAgICB9LFxyXG4gICAgICAgICAgICAgICAgZ2V0TWFwRmFjdG9yeTogZnVuY3Rpb24gKCl7XHJcbiAgICAgICAgICAgICAgICAgICAgcmV0dXJuIEhlcmVNYXBzVXRpbHNTZXJ2aWNlLmdldE1hcEZhY3RvcnkoKTtcclxuICAgICAgICAgICAgICAgIH1cclxuICAgICAgICAgICAgfVxyXG4gICAgICAgIH1cclxuXHJcbiAgICB9XHJcbn07XHJcbiIsInJlcXVpcmUoJy4vcHJvdmlkZXJzL21hcmtlcnMnKTtcclxucmVxdWlyZSgnLi9wcm92aWRlcnMvbWFwLW1vZHVsZXMnKTtcclxucmVxdWlyZSgnLi9wcm92aWRlcnMvcm91dGVzJyk7XHJcblxyXG5tb2R1bGUuZXhwb3J0cyA9IGFuZ3VsYXIubW9kdWxlKCdoZXJlbWFwcycsIFtcclxuICAgICdoZXJlbWFwcy1tYXJrZXJzLW1vZHVsZScsXHJcbiAgICAnaGVyZW1hcHMtcm91dGVzLW1vZHVsZScsXHJcbiAgICAnaGVyZW1hcHMtbWFwLW1vZHVsZXMnXHJcbl0pXHJcbiAgICAucHJvdmlkZXIoJ0hlcmVNYXBzQ29uZmlnJywgcmVxdWlyZSgnLi9wcm92aWRlcnMvbWFwY29uZmlnLnByb3ZpZGVyJykpXHJcbiAgICAuc2VydmljZSgnSGVyZU1hcHNVdGlsc1NlcnZpY2UnLCByZXF1aXJlKCcuL3Byb3ZpZGVycy9tYXB1dGlscy5zZXJ2aWNlJykpXHJcbiAgICAuc2VydmljZSgnSGVyZU1hcHNBUElTZXJ2aWNlJywgcmVxdWlyZSgnLi9wcm92aWRlcnMvYXBpLnNlcnZpY2UnKSlcclxuICAgIC5jb25zdGFudCgnSGVyZU1hcHNDT05TVFMnLCByZXF1aXJlKCcuL3Byb3ZpZGVycy9jb25zdHMnKSlcclxuICAgIC5kaXJlY3RpdmUoJ2hlcmVtYXBzJywgcmVxdWlyZSgnLi9oZXJlbWFwcy5kaXJlY3RpdmUnKSk7XHJcbiIsIm1vZHVsZS5leHBvcnRzID0gSGVyZU1hcHNBUElTZXJ2aWNlO1xyXG5cclxuSGVyZU1hcHNBUElTZXJ2aWNlLiRpbmplY3QgPSBbXHJcbiAgICAnJHEnLFxyXG4gICAgJyRodHRwJyxcclxuICAgICdIZXJlTWFwc0NvbmZpZycsXHJcbiAgICAnSGVyZU1hcHNVdGlsc1NlcnZpY2UnLFxyXG4gICAgJ0hlcmVNYXBzQ09OU1RTJ1xyXG5dO1xyXG5mdW5jdGlvbiBIZXJlTWFwc0FQSVNlcnZpY2UoJHEsICRodHRwLCBIZXJlTWFwc0NvbmZpZywgSGVyZU1hcHNVdGlsc1NlcnZpY2UsIEhlcmVNYXBzQ09OU1RTKSB7XHJcbiAgICB2YXIgdmVyc2lvbiA9IEhlcmVNYXBzQ29uZmlnLmFwaVZlcnNpb24sXHJcbiAgICAgICAgcHJvdG9jb2wgPSBIZXJlTWFwc0NvbmZpZy51c2VIVFRQUyA/ICdodHRwcycgOiAnaHR0cCc7XHJcblxyXG4gICAgdmFyIEFQSV9WRVJTSU9OID0ge1xyXG4gICAgICAgIFY6IHBhcnNlSW50KHZlcnNpb24pLFxyXG4gICAgICAgIFNVQjogdmVyc2lvblxyXG4gICAgfTtcclxuXHJcbiAgICB2YXIgQ09ORklHID0ge1xyXG4gICAgICAgIEJBU0U6IFwiOi8vanMuYXBpLmhlcmUuY29tL3ZcIixcclxuICAgICAgICBDT1JFOiBcIm1hcHNqcy1jb3JlLmpzXCIsXHJcbiAgICAgICAgU0VSVklDRTogXCJtYXBzanMtc2VydmljZS5qc1wiLFxyXG4gICAgICAgIFVJOiB7XHJcbiAgICAgICAgICAgIHNyYzogXCJtYXBzanMtdWkuanNcIixcclxuICAgICAgICAgICAgaHJlZjogXCJtYXBzanMtdWkuY3NzXCJcclxuICAgICAgICB9LFxyXG4gICAgICAgIEVWRU5UUzogXCJtYXBzanMtbWFwZXZlbnRzLmpzXCIsXHJcbiAgICAgICAgQVVUT0NPTVBMRVRFX1VSTDogXCI6Ly9hdXRvY29tcGxldGUuZ2VvY29kZXIuY2l0LmFwaS5oZXJlLmNvbS82LjIvc3VnZ2VzdC5qc29uXCIsXHJcbiAgICAgICAgTE9DQVRJT05fVVJMOiBcIjovL2dlb2NvZGVyLmNpdC5hcGkuaGVyZS5jb20vNi4yL2dlb2NvZGUuanNvblwiXHJcbiAgICB9O1xyXG5cclxuICAgIHZhciBBUElfREVGRVJTUXVldWUgPSB7fTtcclxuXHJcbiAgICBBUElfREVGRVJTUXVldWVbQ09ORklHLkNPUkVdID0gW107XHJcbiAgICBBUElfREVGRVJTUXVldWVbQ09ORklHLlNFUlZJQ0VdID0gW107XHJcbiAgICBBUElfREVGRVJTUXVldWVbQ09ORklHLlVJLnNyY10gPSBbXTtcclxuICAgIEFQSV9ERUZFUlNRdWV1ZVtDT05GSUcuUEFOT10gPSBbXTtcclxuICAgIEFQSV9ERUZFUlNRdWV1ZVtDT05GSUcuRVZFTlRTXSA9IFtdO1xyXG5cclxuICAgIHZhciBoZWFkID0gZG9jdW1lbnQuZ2V0RWxlbWVudHNCeVRhZ05hbWUoJ2hlYWQnKVswXTtcclxuXHJcbiAgICByZXR1cm4ge1xyXG4gICAgICAgIGxvYWRBcGk6IGxvYWRBcGksXHJcbiAgICAgICAgbG9hZE1vZHVsZXM6IGxvYWRNb2R1bGVzLFxyXG4gICAgICAgIGdldFBvc2l0aW9uOiBnZXRQb3NpdGlvbixcclxuICAgICAgICBnZW9jb2RlUG9zaXRpb246IGdlb2NvZGVQb3NpdGlvbixcclxuICAgICAgICBnZW9jb2RlQWRkcmVzczogZ2VvY29kZUFkZHJlc3MsXHJcbiAgICAgICAgZ2VvY29kZUF1dG9jb21wbGV0ZTogZ2VvY29kZUF1dG9jb21wbGV0ZSxcclxuICAgICAgICBmaW5kTG9jYXRpb25CeUlkOiBmaW5kTG9jYXRpb25CeUlkXHJcbiAgICB9O1xyXG5cclxuICAgIC8vI3JlZ2lvbiBQVUJMSUNcclxuICAgIGZ1bmN0aW9uIGxvYWRBcGkoKSB7XHJcbiAgICAgICAgcmV0dXJuIF9nZXRMb2FkZXIoQ09ORklHLkNPUkUpXHJcbiAgICAgICAgICAgIC50aGVuKGZ1bmN0aW9uICgpIHtcclxuICAgICAgICAgICAgICAgIHJldHVybiBfZ2V0TG9hZGVyKENPTkZJRy5TRVJWSUNFKTtcclxuICAgICAgICAgICAgfSk7XHJcbiAgICB9XHJcblxyXG4gICAgZnVuY3Rpb24gbG9hZE1vZHVsZXMoYXR0cnMsIGhhbmRsZXJzKSB7XHJcbiAgICAgICAgZm9yICh2YXIga2V5IGluIGhhbmRsZXJzKSB7XHJcbiAgICAgICAgICAgIGlmICghaGFuZGxlcnMuaGFzT3duUHJvcGVydHkoa2V5KSB8fCAhYXR0cnNba2V5XSlcclxuICAgICAgICAgICAgICAgIGNvbnRpbnVlO1xyXG5cclxuICAgICAgICAgICAgdmFyIGxvYWRlciA9IF9nZXRMb2FkZXJCeUF0dHIoa2V5KTtcclxuXHJcbiAgICAgICAgICAgIGxvYWRlcigpXHJcbiAgICAgICAgICAgICAgICAudGhlbihoYW5kbGVyc1trZXldKTtcclxuICAgICAgICB9XHJcbiAgICB9XHJcblxyXG4gICAgZnVuY3Rpb24gZ2V0UG9zaXRpb24ob3B0aW9ucykge1xyXG4gICAgICAgIHZhciBkZWZlcnJlZCA9ICRxLmRlZmVyKCk7XHJcblxyXG4gICAgICAgIGlmIChvcHRpb25zICYmIEhlcmVNYXBzVXRpbHNTZXJ2aWNlLmlzVmFsaWRDb29yZHMob3B0aW9ucy5jb29yZHMpKSB7XHJcbiAgICAgICAgICAgIGRlZmVycmVkLnJlc29sdmUoeyBjb29yZHM6IG9wdGlvbnMuY29vcmRzIH0pO1xyXG4gICAgICAgIH0gZWxzZSB7XHJcbiAgICAgICAgICAgIG5hdmlnYXRvci5nZW9sb2NhdGlvbi5nZXRDdXJyZW50UG9zaXRpb24oZnVuY3Rpb24gKHJlc3BvbnNlKSB7XHJcbiAgICAgICAgICAgICAgICBkZWZlcnJlZC5yZXNvbHZlKHJlc3BvbnNlKTtcclxuICAgICAgICAgICAgfSwgZnVuY3Rpb24gKGVycm9yKSB7XHJcbiAgICAgICAgICAgICAgICBkZWZlcnJlZC5yZWplY3QoZXJyb3IpO1xyXG4gICAgICAgICAgICB9LCBvcHRpb25zKTtcclxuICAgICAgICB9XHJcblxyXG4gICAgICAgIHJldHVybiBkZWZlcnJlZC5wcm9taXNlO1xyXG4gICAgfVxyXG5cclxuICAgIGZ1bmN0aW9uIGdlb2NvZGVQb3NpdGlvbihwbGF0Zm9ybSwgcGFyYW1zKSB7XHJcbiAgICAgICAgaWYgKCFwYXJhbXMuY29vcmRzKVxyXG4gICAgICAgICAgICByZXR1cm4gY29uc29sZS5lcnJvcignTWlzc2VkIHJlcXVpcmVkIGNvb3JkcycpO1xyXG5cclxuICAgICAgICB2YXIgZ2VvY29kZXIgPSBwbGF0Zm9ybS5nZXRHZW9jb2RpbmdTZXJ2aWNlKCksXHJcbiAgICAgICAgICAgIGRlZmVycmVkID0gJHEuZGVmZXIoKSxcclxuICAgICAgICAgICAgX3BhcmFtcyA9IHtcclxuICAgICAgICAgICAgICAgIHByb3g6IFtwYXJhbXMuY29vcmRzLmxhdCwgcGFyYW1zLmNvb3Jkcy5sbmcsIHBhcmFtcy5yYWRpdXMgfHwgMjUwXS5qb2luKCcsJyksXHJcbiAgICAgICAgICAgICAgICBtb2RlOiAncmV0cmlldmVBZGRyZXNzZXMnLFxyXG4gICAgICAgICAgICAgICAgbWF4cmVzdWx0czogJzEnLFxyXG4gICAgICAgICAgICAgICAgZ2VuOiAnOCcsXHJcbiAgICAgICAgICAgICAgICBsYW5ndWFnZTogcGFyYW1zLmxhbmcgfHwgJ2VuLWdiJ1xyXG4gICAgICAgICAgICB9O1xyXG5cclxuICAgICAgICBnZW9jb2Rlci5yZXZlcnNlR2VvY29kZShfcGFyYW1zLCBmdW5jdGlvbiAocmVzcG9uc2UpIHtcclxuICAgICAgICAgICAgZGVmZXJyZWQucmVzb2x2ZShyZXNwb25zZSlcclxuICAgICAgICB9LCBmdW5jdGlvbiAoZXJyb3IpIHtcclxuICAgICAgICAgICAgZGVmZXJyZWQucmVqZWN0KGVycm9yKVxyXG4gICAgICAgIH0pO1xyXG4gICAgICAgIFxyXG4gICAgICAgIHJldHVybiBkZWZlcnJlZC5wcm9taXNlO1xyXG4gICAgfVxyXG5cclxuICAgIGZ1bmN0aW9uIGdlb2NvZGVBZGRyZXNzKHBsYXRmb3JtLCBwYXJhbXMpIHtcclxuICAgICAgICBpZiAoIXBhcmFtcylcclxuICAgICAgICAgICAgcmV0dXJuIGNvbnNvbGUuZXJyb3IoJ01pc3NlZCByZXF1aXJlZCBwYXJhbWV0ZXJzJyk7XHJcblxyXG4gICAgICAgIHZhciBnZW9jb2RlciA9IHBsYXRmb3JtLmdldEdlb2NvZGluZ1NlcnZpY2UoKSxcclxuICAgICAgICAgICAgZGVmZXJyZWQgPSAkcS5kZWZlcigpLFxyXG4gICAgICAgICAgICBfcGFyYW1zID0geyBnZW46IDggfTtcclxuXHJcbiAgICAgICAgZm9yICh2YXIga2V5IGluIHBhcmFtcykgeyBfcGFyYW1zW2tleV0gPSBwYXJhbXNba2V5XTsgfVxyXG5cclxuICAgICAgICBnZW9jb2Rlci5nZW9jb2RlKF9wYXJhbXMsIGZ1bmN0aW9uIChyZXNwb25zZSkge1xyXG4gICAgICAgICAgICBkZWZlcnJlZC5yZXNvbHZlKHJlc3BvbnNlKVxyXG4gICAgICAgIH0sIGZ1bmN0aW9uIChlcnJvcikge1xyXG4gICAgICAgICAgICBkZWZlcnJlZC5yZWplY3QoZXJyb3IpXHJcbiAgICAgICAgfSk7XHJcblxyXG4gICAgICAgIHJldHVybiBkZWZlcnJlZC5wcm9taXNlO1xyXG4gICAgfVxyXG5cclxuICAgIGZ1bmN0aW9uIGdlb2NvZGVBdXRvY29tcGxldGUocGFyYW1zKSB7XHJcbiAgICAgICAgaWYgKCFwYXJhbXMpXHJcbiAgICAgICAgICAgIHJldHVybiBjb25zb2xlLmVycm9yKCdNaXNzaW5nIHJlcXVpcmVkIHBhcmFtZXRlcnMnKTtcclxuXHJcbiAgICAgICAgdmFyIGF1dG9jb21wbGV0ZVVybCA9IHByb3RvY29sICsgQ09ORklHLkFVVE9DT01QTEVURV9VUkwsXHJcbiAgICAgICAgICAgIGRlZmVycmVkID0gJHEuZGVmZXIoKSxcclxuICAgICAgICAgICAgX3BhcmFtcyA9IHtcclxuICAgICAgICAgICAgICAgIHF1ZXJ5OiBcIlwiLFxyXG4gICAgICAgICAgICAgICAgYmVnaW5IaWdobGlnaHQ6IFwiPG1hcms+XCIsXHJcbiAgICAgICAgICAgICAgICBlbmRIaWdobGlnaHQ6IFwiPC9tYXJrPlwiLFxyXG4gICAgICAgICAgICAgICAgbWF4cmVzdWx0czogXCI1XCJcclxuICAgICAgICAgICAgfTtcclxuXHJcbiAgICAgICAgZm9yICh2YXIga2V5IGluIF9wYXJhbXMpIHtcclxuICAgICAgICAgICAgaWYgKGFuZ3VsYXIuaXNEZWZpbmVkKHBhcmFtc1trZXldKSkge1xyXG4gICAgICAgICAgICAgICAgX3BhcmFtc1trZXldID0gcGFyYW1zW2tleV07XHJcbiAgICAgICAgICAgIH1cclxuICAgICAgICB9XHJcblxyXG4gICAgICAgIF9wYXJhbXMuYXBwX2lkID0gSGVyZU1hcHNDb25maWcuYXBwX2lkO1xyXG4gICAgICAgIF9wYXJhbXMuYXBwX2NvZGUgPSBIZXJlTWFwc0NvbmZpZy5hcHBfY29kZTtcclxuXHJcbiAgICAgICAgJGh0dHAuZ2V0KGF1dG9jb21wbGV0ZVVybCwgeyBwYXJhbXM6IF9wYXJhbXMgfSlcclxuICAgICAgICAgICAgLnN1Y2Nlc3MoZnVuY3Rpb24ocmVzcG9uc2UpIHtcclxuICAgICAgICAgICAgICAgIGRlZmVycmVkLnJlc29sdmUocmVzcG9uc2UpO1xyXG4gICAgICAgICAgICB9KVxyXG4gICAgICAgICAgICAuZXJyb3IoZnVuY3Rpb24oZXJyb3IpIHtcclxuICAgICAgICAgICAgICAgIGRlZmVycmVkLnJlamVjdChlcnJvcik7XHJcbiAgICAgICAgICAgIH0pO1xyXG5cclxuICAgICAgICByZXR1cm4gZGVmZXJyZWQucHJvbWlzZTtcclxuICAgIH1cclxuXHJcbiAgICAvKipcclxuICAgICAqIEZpbmRzIGxvY2F0aW9uIGJ5IEhFUkUgTWFwcyBMb2NhdGlvbiBpZGVudGlmaWVyLlxyXG4gICAgICovXHJcbiAgICBmdW5jdGlvbiBmaW5kTG9jYXRpb25CeUlkKGxvY2F0aW9uSWQpIHtcclxuICAgICAgICBpZiAoIWxvY2F0aW9uSWQpXHJcbiAgICAgICAgICAgIHJldHVybiBjb25zb2xlLmVycm9yKCdNaXNzaW5nIExvY2F0aW9uIElkZW50aWZpZXInKTtcclxuXHJcbiAgICAgICAgdmFyIGxvY2F0aW9uVXJsID0gcHJvdG9jb2wgKyBDT05GSUcuTE9DQVRJT05fVVJMLFxyXG4gICAgICAgICAgICBkZWZlcnJlZCA9ICRxLmRlZmVyKCksXHJcbiAgICAgICAgICAgIF9wYXJhbXMgPSB7XHJcbiAgICAgICAgICAgICAgICBsb2NhdGlvbmlkOiBsb2NhdGlvbklkLFxyXG4gICAgICAgICAgICAgICAgZ2VuOiA5LFxyXG4gICAgICAgICAgICAgICAgYXBwX2lkOiBIZXJlTWFwc0NvbmZpZy5hcHBfaWQsXHJcbiAgICAgICAgICAgICAgICBhcHBfY29kZTogSGVyZU1hcHNDb25maWcuYXBwX2NvZGVcclxuICAgICAgICAgICAgfTtcclxuXHJcbiAgICAgICAgJGh0dHAuZ2V0KGxvY2F0aW9uVXJsLCB7IHBhcmFtczogX3BhcmFtcyB9KVxyXG4gICAgICAgICAgICAuc3VjY2VzcyhmdW5jdGlvbihyZXNwb25zZSkge1xyXG4gICAgICAgICAgICAgICAgZGVmZXJyZWQucmVzb2x2ZShyZXNwb25zZSk7XHJcbiAgICAgICAgICAgIH0pXHJcbiAgICAgICAgICAgIC5lcnJvcihmdW5jdGlvbihlcnJvcikge1xyXG4gICAgICAgICAgICAgICAgZGVmZXJyZWQucmVqZWN0KGVycm9yKTtcclxuICAgICAgICAgICAgfSk7XHJcblxyXG4gICAgICAgIHJldHVybiBkZWZlcnJlZC5wcm9taXNlO1xyXG4gICAgfVxyXG5cclxuICAgIC8vI2VuZHJlZ2lvbiBQVUJMSUNcclxuXHJcbiAgICBmdW5jdGlvbiBfZ2V0TG9hZGVyQnlBdHRyKGF0dHIpIHtcclxuICAgICAgICB2YXIgbG9hZGVyO1xyXG5cclxuICAgICAgICBzd2l0Y2ggKGF0dHIpIHtcclxuICAgICAgICAgICAgY2FzZSBIZXJlTWFwc0NPTlNUUy5NT0RVTEVTLlVJOlxyXG4gICAgICAgICAgICAgICAgbG9hZGVyID0gX2xvYWRVSU1vZHVsZTtcclxuICAgICAgICAgICAgICAgIGJyZWFrO1xyXG4gICAgICAgICAgICBjYXNlIEhlcmVNYXBzQ09OU1RTLk1PRFVMRVMuRVZFTlRTOlxyXG4gICAgICAgICAgICAgICAgbG9hZGVyID0gX2xvYWRFdmVudHNNb2R1bGU7XHJcbiAgICAgICAgICAgICAgICBicmVhaztcclxuICAgICAgICAgICAgZGVmYXVsdDpcclxuICAgICAgICAgICAgICAgIHRocm93IG5ldyBFcnJvcignVW5rbm93biBtb2R1bGUnLCBhdHRyKTtcclxuICAgICAgICB9XHJcblxyXG4gICAgICAgIHJldHVybiBsb2FkZXI7XHJcbiAgICB9XHJcblxyXG4gICAgZnVuY3Rpb24gX2xvYWRVSU1vZHVsZSgpIHtcclxuICAgICAgICBpZiAoIV9pc0xvYWRlZChDT05GSUcuVUkuc3JjKSkge1xyXG4gICAgICAgICAgICB2YXIgbGluayA9IEhlcmVNYXBzVXRpbHNTZXJ2aWNlLmNyZWF0ZUxpbmtUYWcoe1xyXG4gICAgICAgICAgICAgICAgcmVsOiAnc3R5bGVzaGVldCcsXHJcbiAgICAgICAgICAgICAgICB0eXBlOiAndGV4dC9jc3MnLFxyXG4gICAgICAgICAgICAgICAgaHJlZjogX2dldFVSTChDT05GSUcuVUkuaHJlZilcclxuICAgICAgICAgICAgfSk7XHJcblxyXG4gICAgICAgICAgICBsaW5rICYmIGhlYWQuYXBwZW5kQ2hpbGQobGluayk7XHJcbiAgICAgICAgfVxyXG5cclxuICAgICAgICByZXR1cm4gX2dldExvYWRlcihDT05GSUcuVUkuc3JjKTtcclxuICAgIH1cclxuXHJcbiAgICBmdW5jdGlvbiBfbG9hZEV2ZW50c01vZHVsZSgpIHtcclxuICAgICAgICByZXR1cm4gX2dldExvYWRlcihDT05GSUcuRVZFTlRTKTtcclxuICAgIH1cclxuXHJcbiAgICAvKipcclxuICAgICAqIEBwYXJhbSB7U3RyaW5nfSBzb3VyY2VOYW1lXHJcbiAgICAgKiByZXR1cm4ge1N0cmluZ30gZS5nIGh0dHA6Ly9qcy5hcGkuaGVyZS5jb20vdntWRVJ9L3tTVUJWRVJTSU9OfS97U09VUkNFfVxyXG4gICAgICovXHJcbiAgICBmdW5jdGlvbiBfZ2V0VVJMKHNvdXJjZU5hbWUpIHtcclxuICAgICAgICByZXR1cm4gW1xyXG4gICAgICAgICAgICBwcm90b2NvbCxcclxuICAgICAgICAgICAgQ09ORklHLkJBU0UsXHJcbiAgICAgICAgICAgIEFQSV9WRVJTSU9OLlYsXHJcbiAgICAgICAgICAgIFwiL1wiLFxyXG4gICAgICAgICAgICBBUElfVkVSU0lPTi5TVUIsXHJcbiAgICAgICAgICAgIFwiL1wiLFxyXG4gICAgICAgICAgICBzb3VyY2VOYW1lXHJcbiAgICAgICAgXS5qb2luKFwiXCIpO1xyXG4gICAgfVxyXG5cclxuICAgIGZ1bmN0aW9uIF9nZXRMb2FkZXIoc291cmNlTmFtZSkge1xyXG4gICAgICAgIHZhciBkZWZlciA9ICRxLmRlZmVyKCksIHNyYywgc2NyaXB0O1xyXG5cclxuICAgICAgICBpZiAoX2lzTG9hZGVkKHNvdXJjZU5hbWUpKSB7XHJcbiAgICAgICAgICAgIGRlZmVyLnJlc29sdmUoKTtcclxuICAgICAgICB9IGVsc2Uge1xyXG4gICAgICAgICAgICBzcmMgPSBfZ2V0VVJMKHNvdXJjZU5hbWUpO1xyXG4gICAgICAgICAgICBzY3JpcHQgPSBIZXJlTWFwc1V0aWxzU2VydmljZS5jcmVhdGVTY3JpcHRUYWcoeyBzcmM6IHNyYyB9KTtcclxuXHJcbiAgICAgICAgICAgIHNjcmlwdCAmJiBoZWFkLmFwcGVuZENoaWxkKHNjcmlwdCk7XHJcblxyXG4gICAgICAgICAgICBBUElfREVGRVJTUXVldWVbc291cmNlTmFtZV0ucHVzaChkZWZlcik7XHJcblxyXG4gICAgICAgICAgICBzY3JpcHQub25sb2FkID0gX29uTG9hZC5iaW5kKG51bGwsIHNvdXJjZU5hbWUpO1xyXG4gICAgICAgICAgICBzY3JpcHQub25lcnJvciA9IF9vbkVycm9yLmJpbmQobnVsbCwgc291cmNlTmFtZSk7XHJcbiAgICAgICAgfVxyXG5cclxuICAgICAgICByZXR1cm4gZGVmZXIucHJvbWlzZTtcclxuICAgIH1cclxuXHJcbiAgICBmdW5jdGlvbiBfaXNMb2FkZWQoc291cmNlTmFtZSkge1xyXG4gICAgICAgIHZhciBjaGVja2VyID0gbnVsbDtcclxuXHJcbiAgICAgICAgc3dpdGNoIChzb3VyY2VOYW1lKSB7XHJcbiAgICAgICAgICAgIGNhc2UgQ09ORklHLkNPUkU6XHJcbiAgICAgICAgICAgICAgICBjaGVja2VyID0gX2lzQ29yZUxvYWRlZDtcclxuICAgICAgICAgICAgICAgIGJyZWFrO1xyXG4gICAgICAgICAgICBjYXNlIENPTkZJRy5TRVJWSUNFOlxyXG4gICAgICAgICAgICAgICAgY2hlY2tlciA9IF9pc1NlcnZpY2VMb2FkZWQ7XHJcbiAgICAgICAgICAgICAgICBicmVhaztcclxuICAgICAgICAgICAgY2FzZSBDT05GSUcuVUkuc3JjOlxyXG4gICAgICAgICAgICAgICAgY2hlY2tlciA9IF9pc1VJTG9hZGVkO1xyXG4gICAgICAgICAgICAgICAgYnJlYWs7XHJcbiAgICAgICAgICAgIGNhc2UgQ09ORklHLkVWRU5UUzpcclxuICAgICAgICAgICAgICAgIGNoZWNrZXIgPSBfaXNFdmVudHNMb2FkZWQ7XHJcbiAgICAgICAgICAgICAgICBicmVhaztcclxuICAgICAgICAgICAgZGVmYXVsdDpcclxuICAgICAgICAgICAgICAgIGNoZWNrZXIgPSBmdW5jdGlvbiAoKSB7IHJldHVybiBmYWxzZSB9O1xyXG4gICAgICAgIH1cclxuXHJcbiAgICAgICAgcmV0dXJuIGNoZWNrZXIoKTtcclxuICAgIH1cclxuXHJcbiAgICBmdW5jdGlvbiBfaXNDb3JlTG9hZGVkKCkge1xyXG4gICAgICAgIHJldHVybiAhIXdpbmRvdy5IO1xyXG4gICAgfVxyXG5cclxuICAgIGZ1bmN0aW9uIF9pc1NlcnZpY2VMb2FkZWQoKSB7XHJcbiAgICAgICAgcmV0dXJuICEhKHdpbmRvdy5IICYmIHdpbmRvdy5ILnNlcnZpY2UpO1xyXG4gICAgfVxyXG5cclxuICAgIGZ1bmN0aW9uIF9pc1VJTG9hZGVkKCkge1xyXG4gICAgICAgIHJldHVybiAhISh3aW5kb3cuSCAmJiB3aW5kb3cuSC51aSk7XHJcbiAgICB9XHJcblxyXG4gICAgZnVuY3Rpb24gX2lzRXZlbnRzTG9hZGVkKCkge1xyXG4gICAgICAgIHJldHVybiAhISh3aW5kb3cuSCAmJiB3aW5kb3cuSC5tYXBldmVudHMpO1xyXG4gICAgfVxyXG5cclxuICAgIGZ1bmN0aW9uIF9vbkxvYWQoc291cmNlTmFtZSkge1xyXG4gICAgICAgIHZhciBkZWZlclF1ZXVlID0gQVBJX0RFRkVSU1F1ZXVlW3NvdXJjZU5hbWVdO1xyXG4gICAgICAgIGZvciAodmFyIGkgPSAwLCBsID0gZGVmZXJRdWV1ZS5sZW5ndGg7IGkgPCBsOyArK2kpIHtcclxuICAgICAgICAgICAgdmFyIGRlZmVyID0gZGVmZXJRdWV1ZVtpXTtcclxuICAgICAgICAgICAgZGVmZXIucmVzb2x2ZSgpO1xyXG4gICAgICAgIH1cclxuXHJcbiAgICAgICAgQVBJX0RFRkVSU1F1ZXVlW3NvdXJjZU5hbWVdID0gW107XHJcbiAgICB9XHJcblxyXG4gICAgZnVuY3Rpb24gX29uRXJyb3Ioc291cmNlTmFtZSkge1xyXG4gICAgICAgIHZhciBkZWZlclF1ZXVlID0gQVBJX0RFRkVSU1F1ZXVlW3NvdXJjZU5hbWVdO1xyXG4gICAgICAgIGZvciAodmFyIGkgPSAwLCBsID0gZGVmZXJRdWV1ZS5sZW5ndGg7IGkgPCBsOyArK2kpIHtcclxuICAgICAgICAgICAgdmFyIGRlZmVyID0gZGVmZXJRdWV1ZVtpXTtcclxuICAgICAgICAgICAgZGVmZXIucmVqZWN0KCk7XHJcbiAgICAgICAgfVxyXG5cclxuICAgICAgICBBUElfREVGRVJTUXVldWVbc291cmNlTmFtZV0gPSBbXTtcclxuICAgIH1cclxufTtcclxuIiwibW9kdWxlLmV4cG9ydHMgPSB7XHJcbiAgICBVUERBVEVfTUFQX1JFU0laRV9USU1FT1VUOiA1MDAsXHJcbiAgICBBTklNQVRJT05fWk9PTV9TVEVQOiAuMDUsXHJcbiAgICBNT0RVTEVTOiB7XHJcbiAgICAgICAgVUk6ICdjb250cm9scycsXHJcbiAgICAgICAgRVZFTlRTOiAnZXZlbnRzJyxcclxuICAgICAgICBQQU5POiAncGFubydcclxuICAgIH0sXHJcbiAgICBERUZBVUxUX01BUF9PUFRJT05TOiB7XHJcbiAgICAgICAgaGVpZ2h0OiA0ODAsXHJcbiAgICAgICAgd2lkdGg6IDY0MCxcclxuICAgICAgICB6b29tOiAxMixcclxuICAgICAgICBtYXhab29tOiAyLFxyXG4gICAgICAgIHJlc2l6ZTogZmFsc2UsXHJcbiAgICAgICAgZHJhZ2dhYmxlOiBmYWxzZSxcclxuICAgICAgICBjb29yZHM6IHtcclxuICAgICAgICAgICAgbG9uZ2l0dWRlOiAwLFxyXG4gICAgICAgICAgICBsYXRpdHVkZTogMFxyXG4gICAgICAgIH1cclxuICAgIH0sXHJcbiAgICBNQVJLRVJfVFlQRVM6IHtcclxuICAgICAgICBET006IFwiRE9NXCIsXHJcbiAgICAgICAgU1ZHOiBcIlNWR1wiXHJcbiAgICB9LFxyXG4gICAgQ09OVFJPTFM6IHtcclxuICAgICAgICBOQU1FUzoge1xyXG4gICAgICAgICAgICBTQ0FMRTogJ3NjYWxlYmFyJyxcclxuICAgICAgICAgICAgU0VUVElOR1M6ICdtYXBzZXR0aW5ncycsXHJcbiAgICAgICAgICAgIFpPT006ICd6b29tJyxcclxuICAgICAgICAgICAgVVNFUjogJ3VzZXJwb3NpdGlvbidcclxuICAgICAgICB9LFxyXG4gICAgICAgIFBPU0lUSU9OUzogW1xyXG4gICAgICAgICAgICAndG9wLXJpZ2h0JyxcclxuICAgICAgICAgICAgJ3RvcC1jZW50ZXInLFxyXG4gICAgICAgICAgICAndG9wLWxlZnQnLFxyXG4gICAgICAgICAgICAnbGVmdC10b3AnLFxyXG4gICAgICAgICAgICAnbGVmdC1taWRkbGUnLFxyXG4gICAgICAgICAgICAnbGVmdC1ib3R0b20nLFxyXG4gICAgICAgICAgICAncmlnaHQtdG9wJyxcclxuICAgICAgICAgICAgJ3JpZ2h0LW1pZGRsZScsXHJcbiAgICAgICAgICAgICdyaWdodC1ib3R0b20nLFxyXG4gICAgICAgICAgICAnYm90dG9tLXJpZ2h0JyxcclxuICAgICAgICAgICAgJ2JvdHRvbS1jZW50ZXInLFxyXG4gICAgICAgICAgICAnYm90dG9tLWxlZnQnXHJcbiAgICAgICAgXVxyXG4gICAgfSxcclxuICAgIElORk9CVUJCTEU6IHtcclxuICAgICAgICBTVEFURToge1xyXG4gICAgICAgICAgICBPUEVOOiAnb3BlbicsXHJcbiAgICAgICAgICAgIENMT1NFRDogJ2Nsb3NlZCdcclxuICAgICAgICB9LFxyXG4gICAgICAgIERJU1BMQVlfRVZFTlQ6IHtcclxuICAgICAgICAgICAgcG9pbnRlcm1vdmU6ICdvbkhvdmVyJyxcclxuICAgICAgICAgICAgdGFwOiAnb25DbGljaydcclxuICAgICAgICB9XHJcbiAgICB9LFxyXG4gICAgVVNFUl9FVkVOVFM6IHtcclxuICAgICAgICB0YXA6ICdjbGljaycsXHJcbiAgICAgICAgcG9pbnRlcm1vdmU6ICdtb3VzZW1vdmUnLFxyXG4gICAgICAgIHBvaW50ZXJsZWF2ZTogJ21vdXNlbGVhdmUnLFxyXG4gICAgICAgIHBvaW50ZXJlbnRlcjogJ21vdXNlZW50ZXInLFxyXG4gICAgICAgIGRyYWc6ICdkcmFnJyxcclxuICAgICAgICBkcmFnc3RhcnQ6ICdkcmFnc3RhcnQnLFxyXG4gICAgICAgIGRyYWdlbmQ6ICdkcmFnZW5kJyxcclxuICAgICAgICBtYXB2aWV3Y2hhbmdlOiAnbWFwdmlld2NoYW5nZScsXHJcbiAgICAgICAgbWFwdmlld2NoYW5nZXN0YXJ0OiAnbWFwdmlld2NoYW5nZXN0YXJ0JyxcclxuICAgICAgICBtYXB2aWV3Y2hhbmdlZW5kOiAnbWFwdmlld2NoYW5nZWVuZCdcclxuICAgIH1cclxufSIsIm1vZHVsZS5leHBvcnRzID0gSGVyZU1hcHNFdmVudHNGYWN0b3J5O1xyXG5cclxuSGVyZU1hcHNFdmVudHNGYWN0b3J5LiRpbmplY3QgPSBbXHJcbiAgICAnSGVyZU1hcHNVdGlsc1NlcnZpY2UnLFxyXG4gICAgJ0hlcmVNYXBzTWFya2VyU2VydmljZScsXHJcbiAgICAnSGVyZU1hcHNDT05TVFMnLFxyXG4gICAgJ0hlcmVNYXBzSW5mb0J1YmJsZUZhY3RvcnknXHJcbl07XHJcbmZ1bmN0aW9uIEhlcmVNYXBzRXZlbnRzRmFjdG9yeShIZXJlTWFwc1V0aWxzU2VydmljZSwgSGVyZU1hcHNNYXJrZXJTZXJ2aWNlLCBIZXJlTWFwc0NPTlNUUywgSGVyZU1hcHNJbmZvQnViYmxlRmFjdG9yeSkge1xyXG4gICAgZnVuY3Rpb24gRXZlbnRzKHBsYXRmb3JtLCBJbmplY3RvciwgbGlzdGVuZXJzKSB7XHJcbiAgICAgICAgdGhpcy5tYXAgPSBwbGF0Zm9ybS5tYXA7XHJcbiAgICAgICAgdGhpcy5saXN0ZW5lcnMgPSBsaXN0ZW5lcnM7XHJcbiAgICAgICAgdGhpcy5pbmplY3QgPSBuZXcgSW5qZWN0b3IoKTtcclxuICAgICAgICB0aGlzLmV2ZW50cyA9IHBsYXRmb3JtLmV2ZW50cyA9IG5ldyBILm1hcGV2ZW50cy5NYXBFdmVudHModGhpcy5tYXApO1xyXG4gICAgICAgIHRoaXMuYmVoYXZpb3IgPSBwbGF0Zm9ybS5iZWhhdmlvciA9IG5ldyBILm1hcGV2ZW50cy5CZWhhdmlvcih0aGlzLmV2ZW50cyk7XHJcbiAgICAgICAgdGhpcy5idWJibGUgPSBIZXJlTWFwc0luZm9CdWJibGVGYWN0b3J5LmNyZWF0ZSgpO1xyXG5cclxuICAgICAgICB0aGlzLnNldHVwRXZlbnRMaXN0ZW5lcnMoKTtcclxuICAgIH1cclxuXHJcbiAgICB2YXIgcHJvdG8gPSBFdmVudHMucHJvdG90eXBlO1xyXG5cclxuICAgIHByb3RvLnNldHVwRXZlbnRMaXN0ZW5lcnMgPSBzZXR1cEV2ZW50TGlzdGVuZXJzO1xyXG4gICAgcHJvdG8uc2V0dXBPcHRpb25zID0gc2V0dXBPcHRpb25zO1xyXG4gICAgcHJvdG8udHJpZ2dlclVzZXJMaXN0ZW5lciA9IHRyaWdnZXJVc2VyTGlzdGVuZXI7XHJcbiAgICBwcm90by5pbmZvQnViYmxlSGFuZGxlciA9IGluZm9CdWJibGVIYW5kbGVyOyAgXHJcblxyXG4gICAgcmV0dXJuIHtcclxuICAgICAgICBzdGFydDogZnVuY3Rpb24oYXJncykge1xyXG4gICAgICAgICAgICBpZiAoIShhcmdzLnBsYXRmb3JtLm1hcCBpbnN0YW5jZW9mIEguTWFwKSlcclxuICAgICAgICAgICAgICAgIHJldHVybiBjb25zb2xlLmVycm9yKCdNaXNzZWQgcmVxdWlyZWQgbWFwIGluc3RhbmNlJyk7XHJcblxyXG4gICAgICAgICAgICB2YXIgZXZlbnRzID0gbmV3IEV2ZW50cyhhcmdzLnBsYXRmb3JtLCBhcmdzLmluamVjdG9yLCBhcmdzLmxpc3RlbmVycyk7XHJcblxyXG4gICAgICAgICAgICBhcmdzLm9wdGlvbnMgJiYgZXZlbnRzLnNldHVwT3B0aW9ucyhhcmdzLm9wdGlvbnMpO1xyXG4gICAgICAgIH1cclxuICAgIH1cclxuXHJcbiAgICBmdW5jdGlvbiBzZXR1cEV2ZW50TGlzdGVuZXJzKCkge1xyXG4gICAgICAgIHZhciBzZWxmID0gdGhpcztcclxuXHJcbiAgICAgICAgSGVyZU1hcHNVdGlsc1NlcnZpY2UuYWRkRXZlbnRMaXN0ZW5lcih0aGlzLm1hcCwgJ3RhcCcsIHRoaXMuaW5mb0J1YmJsZUhhbmRsZXIuYmluZCh0aGlzKSk7XHJcblxyXG4gICAgICAgIEhlcmVNYXBzVXRpbHNTZXJ2aWNlLmFkZEV2ZW50TGlzdGVuZXIodGhpcy5tYXAsICdwb2ludGVybW92ZScsIHRoaXMuaW5mb0J1YmJsZUhhbmRsZXIuYmluZCh0aGlzKSk7XHJcblxyXG4gICAgICAgIEhlcmVNYXBzVXRpbHNTZXJ2aWNlLmFkZEV2ZW50TGlzdGVuZXIodGhpcy5tYXAsICdkcmFnc3RhcnQnLCBmdW5jdGlvbihlKSB7XHJcbiAgICAgICAgICAgIGlmIChIZXJlTWFwc01hcmtlclNlcnZpY2UuaXNNYXJrZXJJbnN0YW5jZShlLnRhcmdldCkpIHtcclxuICAgICAgICAgICAgICAgIHNlbGYuYmVoYXZpb3IuZGlzYWJsZSgpO1xyXG4gICAgICAgICAgICB9XHJcblxyXG4gICAgICAgICAgICBzZWxmLnRyaWdnZXJVc2VyTGlzdGVuZXIoSGVyZU1hcHNDT05TVFMuVVNFUl9FVkVOVFNbZS50eXBlXSwgZSk7XHJcbiAgICAgICAgfSk7XHJcblxyXG4gICAgICAgIEhlcmVNYXBzVXRpbHNTZXJ2aWNlLmFkZEV2ZW50TGlzdGVuZXIodGhpcy5tYXAsICdkcmFnJywgZnVuY3Rpb24oZSkge1xyXG4gICAgICAgICAgICB2YXIgcG9pbnRlciA9IGUuY3VycmVudFBvaW50ZXIsXHJcbiAgICAgICAgICAgICAgICB0YXJnZXQgPSBlLnRhcmdldDtcclxuXHJcbiAgICAgICAgICAgIGlmIChIZXJlTWFwc01hcmtlclNlcnZpY2UuaXNNYXJrZXJJbnN0YW5jZSh0YXJnZXQpKSB7XHJcbiAgICAgICAgICAgICAgICB0YXJnZXQuc2V0UG9zaXRpb24oc2VsZi5tYXAuc2NyZWVuVG9HZW8ocG9pbnRlci52aWV3cG9ydFgsIHBvaW50ZXIudmlld3BvcnRZKSk7XHJcbiAgICAgICAgICAgIH1cclxuXHJcbiAgICAgICAgICAgIHNlbGYudHJpZ2dlclVzZXJMaXN0ZW5lcihIZXJlTWFwc0NPTlNUUy5VU0VSX0VWRU5UU1tlLnR5cGVdLCBlKTtcclxuICAgICAgICB9KTtcclxuXHJcbiAgICAgICAgSGVyZU1hcHNVdGlsc1NlcnZpY2UuYWRkRXZlbnRMaXN0ZW5lcih0aGlzLm1hcCwgJ2RyYWdlbmQnLCBmdW5jdGlvbihlKSB7XHJcbiAgICAgICAgICAgIGlmIChIZXJlTWFwc01hcmtlclNlcnZpY2UuaXNNYXJrZXJJbnN0YW5jZShlLnRhcmdldCkpIHtcclxuICAgICAgICAgICAgICAgIHNlbGYuYmVoYXZpb3IuZW5hYmxlKCk7XHJcbiAgICAgICAgICAgIH1cclxuXHJcbiAgICAgICAgICAgIHNlbGYudHJpZ2dlclVzZXJMaXN0ZW5lcihIZXJlTWFwc0NPTlNUUy5VU0VSX0VWRU5UU1tlLnR5cGVdLCBlKTtcclxuICAgICAgICB9KTtcclxuXHJcbiAgICAgICAgSGVyZU1hcHNVdGlsc1NlcnZpY2UuYWRkRXZlbnRMaXN0ZW5lcih0aGlzLm1hcCwgJ21hcHZpZXdjaGFuZ2VzdGFydCcsIGZ1bmN0aW9uKGUpIHtcclxuICAgICAgICAgICAgc2VsZi50cmlnZ2VyVXNlckxpc3RlbmVyKEhlcmVNYXBzQ09OU1RTLlVTRVJfRVZFTlRTW2UudHlwZV0sIGUpO1xyXG4gICAgICAgIH0pO1xyXG5cclxuICAgICAgICBIZXJlTWFwc1V0aWxzU2VydmljZS5hZGRFdmVudExpc3RlbmVyKHRoaXMubWFwLCAnbWFwdmlld2NoYW5nZScsIGZ1bmN0aW9uKGUpIHtcclxuICAgICAgICAgICAgc2VsZi50cmlnZ2VyVXNlckxpc3RlbmVyKEhlcmVNYXBzQ09OU1RTLlVTRVJfRVZFTlRTW2UudHlwZV0sIGUpO1xyXG4gICAgICAgIH0pO1xyXG5cclxuICAgICAgICBIZXJlTWFwc1V0aWxzU2VydmljZS5hZGRFdmVudExpc3RlbmVyKHRoaXMubWFwLCAnbWFwdmlld2NoYW5nZWVuZCcsIGZ1bmN0aW9uKGUpIHtcclxuICAgICAgICAgICAgc2VsZi50cmlnZ2VyVXNlckxpc3RlbmVyKEhlcmVNYXBzQ09OU1RTLlVTRVJfRVZFTlRTW2UudHlwZV0sIGUpO1xyXG4gICAgICAgIH0pO1xyXG4gICAgfVxyXG5cclxuICAgIGZ1bmN0aW9uIHNldHVwT3B0aW9ucyhvcHRpb25zKSB7XHJcbiAgICAgICAgaWYgKCFvcHRpb25zKVxyXG4gICAgICAgICAgICByZXR1cm47XHJcblxyXG4gICAgICAgIHRoaXMubWFwLmRyYWdnYWJsZSA9ICEhb3B0aW9ucy5kcmFnZ2FibGU7XHJcbiAgICB9XHJcblxyXG4gICAgZnVuY3Rpb24gdHJpZ2dlclVzZXJMaXN0ZW5lcihldmVudE5hbWUsIGUpIHtcclxuICAgICAgICBpZiAoIXRoaXMubGlzdGVuZXJzKVxyXG4gICAgICAgICAgICByZXR1cm47XHJcblxyXG4gICAgICAgIHZhciBjYWxsYmFjayA9IHRoaXMubGlzdGVuZXJzW2V2ZW50TmFtZV07XHJcblxyXG4gICAgICAgIGNhbGxiYWNrICYmIGNhbGxiYWNrKGUpO1xyXG4gICAgfVxyXG4gICAgXHJcbiAgICBmdW5jdGlvbiBpbmZvQnViYmxlSGFuZGxlcihlKXtcclxuICAgICAgICB2YXIgdWkgPSB0aGlzLmluamVjdCgndWknKTtcclxuICAgICAgICBcclxuICAgICAgICBpZih1aSlcclxuICAgICAgICAgICAgdGhpcy5idWJibGUudG9nZ2xlKGUsIHVpKTtcclxuICAgICAgICAgICAgXHJcbiAgICAgICAgdGhpcy50cmlnZ2VyVXNlckxpc3RlbmVyKEhlcmVNYXBzQ09OU1RTLlVTRVJfRVZFTlRTW2UudHlwZV0sIGUpOyAgICAgIFxyXG4gICAgfVxyXG5cclxufTsiLCJtb2R1bGUuZXhwb3J0cyA9IEhlcmVNYXBzSW5mb0J1YmJsZUZhY3Rvcnk7XHJcblxyXG5IZXJlTWFwc0luZm9CdWJibGVGYWN0b3J5LiRpbmplY3QgPSBbXHJcbiAgICAnSGVyZU1hcHNNYXJrZXJTZXJ2aWNlJyxcclxuICAgICdIZXJlTWFwc1V0aWxzU2VydmljZScsXHJcbiAgICAnSGVyZU1hcHNDT05TVFMnXHJcbl07XHJcbmZ1bmN0aW9uIEhlcmVNYXBzSW5mb0J1YmJsZUZhY3RvcnkoSGVyZU1hcHNNYXJrZXJTZXJ2aWNlLCBIZXJlTWFwc1V0aWxzU2VydmljZSwgSGVyZU1hcHNDT05TVFMpIHtcclxuICAgIGZ1bmN0aW9uIEluZm9CdWJibGUoKSB7fVxyXG5cclxuICAgIHZhciBwcm90byA9IEluZm9CdWJibGUucHJvdG90eXBlO1xyXG4gICAgICAgIFxyXG4gICAgcHJvdG8uY3JlYXRlID0gY3JlYXRlO1xyXG4gICAgcHJvdG8udXBkYXRlID0gdXBkYXRlO1xyXG4gICAgcHJvdG8udG9nZ2xlID0gdG9nZ2xlO1xyXG4gICAgcHJvdG8uc2hvdyA9IHNob3c7XHJcbiAgICBwcm90by5jbG9zZSA9IGNsb3NlO1xyXG5cclxuICAgIHJldHVybiB7XHJcbiAgICAgICAgY3JlYXRlOiBmdW5jdGlvbigpe1xyXG4gICAgICAgICAgICByZXR1cm4gbmV3IEluZm9CdWJibGUoKTtcclxuICAgICAgICB9XHJcbiAgICB9XHJcblxyXG4gICAgZnVuY3Rpb24gdG9nZ2xlKGUsIHVpKSB7XHJcbiAgICAgICAgaWYgKEhlcmVNYXBzTWFya2VyU2VydmljZS5pc01hcmtlckluc3RhbmNlKGUudGFyZ2V0KSlcclxuICAgICAgICAgICAgdGhpcy5zaG93KGUsIHVpKTtcclxuICAgICAgICBlbHNlXHJcbiAgICAgICAgICAgIHRoaXMuY2xvc2UoZSwgdWkpO1xyXG4gICAgfVxyXG5cclxuICAgIGZ1bmN0aW9uIHVwZGF0ZShidWJibGUsIGRhdGEpIHtcclxuICAgICAgICBidWJibGUuZGlzcGxheSA9IGRhdGEuZGlzcGxheTtcclxuXHJcbiAgICAgICAgYnViYmxlLnNldFBvc2l0aW9uKGRhdGEucG9zaXRpb24pO1xyXG4gICAgICAgIGJ1YmJsZS5zZXRDb250ZW50KGRhdGEubWFya3VwKTtcclxuXHJcbiAgICAgICAgYnViYmxlLnNldFN0YXRlKEhlcmVNYXBzQ09OU1RTLklORk9CVUJCTEUuU1RBVEUuT1BFTik7XHJcbiAgICB9XHJcblxyXG4gICAgZnVuY3Rpb24gY3JlYXRlKHNvdXJjZSkge1xyXG4gICAgICAgIHZhciBidWJibGUgPSBuZXcgSC51aS5JbmZvQnViYmxlKHNvdXJjZS5wb3NpdGlvbiwge1xyXG4gICAgICAgICAgICBjb250ZW50OiBzb3VyY2UubWFya3VwXHJcbiAgICAgICAgfSk7XHJcblxyXG4gICAgICAgIGJ1YmJsZS5kaXNwbGF5ID0gc291cmNlLmRpc3BsYXk7XHJcbiAgICAgICAgYnViYmxlLmFkZENsYXNzKEhlcmVNYXBzQ09OU1RTLklORk9CVUJCTEUuU1RBVEUuT1BFTilcclxuXHJcbiAgICAgICAgSGVyZU1hcHNVdGlsc1NlcnZpY2UuYWRkRXZlbnRMaXN0ZW5lcihidWJibGUsICdzdGF0ZWNoYW5nZScsIGZ1bmN0aW9uKGUpIHtcclxuICAgICAgICAgICAgdmFyIHN0YXRlID0gdGhpcy5nZXRTdGF0ZSgpLFxyXG4gICAgICAgICAgICAgICAgZWwgPSB0aGlzLmdldEVsZW1lbnQoKTtcclxuICAgICAgICAgICAgaWYgKHN0YXRlID09PSBIZXJlTWFwc0NPTlNUUy5JTkZPQlVCQkxFLlNUQVRFLkNMT1NFRCkge1xyXG4gICAgICAgICAgICAgICAgZWwuY2xhc3NMaXN0LnJlbW92ZShIZXJlTWFwc0NPTlNUUy5JTkZPQlVCQkxFLlNUQVRFLk9QRU4pO1xyXG4gICAgICAgICAgICB9IGVsc2VcclxuICAgICAgICAgICAgICAgIHRoaXMuYWRkQ2xhc3Moc3RhdGUpXHJcbiAgICAgICAgfSk7XHJcblxyXG4gICAgICAgIHJldHVybiBidWJibGU7XHJcbiAgICB9XHJcblxyXG4gICAgZnVuY3Rpb24gc2hvdyhlLCB1aSwgZGF0YSkge1xyXG4gICAgICAgIHZhciB0YXJnZXQgPSBlLnRhcmdldCxcclxuICAgICAgICAgICAgZGF0YSA9IHRhcmdldC5nZXREYXRhKCksXHJcbiAgICAgICAgICAgIGVsID0gbnVsbDtcclxuXHJcbiAgICAgICAgaWYgKCFkYXRhIHx8ICFkYXRhLmRpc3BsYXkgfHwgIWRhdGEubWFya3VwIHx8IGRhdGEuZGlzcGxheSAhPT0gSGVyZU1hcHNDT05TVFMuSU5GT0JVQkJMRS5ESVNQTEFZX0VWRU5UW2UudHlwZV0pXHJcbiAgICAgICAgICAgIHJldHVybjtcclxuXHJcbiAgICAgICAgdmFyIHNvdXJjZSA9IHtcclxuICAgICAgICAgICAgcG9zaXRpb246IHRhcmdldC5nZXRQb3NpdGlvbigpLFxyXG4gICAgICAgICAgICBtYXJrdXA6IGRhdGEubWFya3VwLFxyXG4gICAgICAgICAgICBkaXNwbGF5OiBkYXRhLmRpc3BsYXlcclxuICAgICAgICB9O1xyXG5cclxuICAgICAgICBpZiAoIXVpLmJ1YmJsZSkge1xyXG4gICAgICAgICAgICB1aS5idWJibGUgPSB0aGlzLmNyZWF0ZShzb3VyY2UpO1xyXG4gICAgICAgICAgICB1aS5hZGRCdWJibGUodWkuYnViYmxlKTtcclxuXHJcbiAgICAgICAgICAgIHJldHVybjtcclxuICAgICAgICB9XHJcblxyXG4gICAgICAgIHRoaXMudXBkYXRlKHVpLmJ1YmJsZSwgc291cmNlKTtcclxuICAgIH1cclxuXHJcbiAgICBmdW5jdGlvbiBjbG9zZShlLCB1aSkge1xyXG4gICAgICAgIGlmICghdWkuYnViYmxlIHx8IHVpLmJ1YmJsZS5kaXNwbGF5ICE9PSBIZXJlTWFwc0NPTlNUUy5JTkZPQlVCQkxFLkRJU1BMQVlfRVZFTlRbZS50eXBlXSkge1xyXG4gICAgICAgICAgICByZXR1cm47XHJcbiAgICAgICAgfVxyXG5cclxuICAgICAgICB1aS5idWJibGUuc2V0U3RhdGUoSGVyZU1hcHNDT05TVFMuSU5GT0JVQkJMRS5TVEFURS5DTE9TRUQpO1xyXG4gICAgfVxyXG59IiwiYW5ndWxhci5tb2R1bGUoJ2hlcmVtYXBzLWV2ZW50cy1tb2R1bGUnLCBbXSlcclxuICAgIC5mYWN0b3J5KCdIZXJlTWFwc0V2ZW50c0ZhY3RvcnknLCByZXF1aXJlKCcuL2V2ZW50cy9ldmVudHMuanMnKSlcclxuICAgIC5mYWN0b3J5KCdIZXJlTWFwc0luZm9CdWJibGVGYWN0b3J5JywgcmVxdWlyZSgnLi9ldmVudHMvaW5mb2J1YmJsZS5qcycpKTtcclxuICAgIFxyXG5hbmd1bGFyLm1vZHVsZSgnaGVyZW1hcHMtdWktbW9kdWxlJywgW10pXHJcbiAgICAuZmFjdG9yeSgnSGVyZU1hcHNVaUZhY3RvcnknLCByZXF1aXJlKCcuL3VpL3VpLmpzJykpXHJcblxyXG5tb2R1bGUuZXhwb3J0cyA9IGFuZ3VsYXIubW9kdWxlKCdoZXJlbWFwcy1tYXAtbW9kdWxlcycsIFtcclxuXHQnaGVyZW1hcHMtZXZlbnRzLW1vZHVsZScsXHJcbiAgICAnaGVyZW1hcHMtdWktbW9kdWxlJ1xyXG5dKTsiLCJtb2R1bGUuZXhwb3J0cyA9IEhlcmVNYXBzVWlGYWN0b3J5O1xyXG5cclxuSGVyZU1hcHNVaUZhY3RvcnkuJGluamVjdCA9IFtcclxuICAgICdIZXJlTWFwc0FQSVNlcnZpY2UnLFxyXG4gICAgJ0hlcmVNYXBzTWFya2VyU2VydmljZScsXHJcbiAgICAnSGVyZU1hcHNVdGlsc1NlcnZpY2UnLFxyXG4gICAgJ0hlcmVNYXBzQ09OU1RTJ1xyXG5dO1xyXG5mdW5jdGlvbiBIZXJlTWFwc1VpRmFjdG9yeShIZXJlTWFwc0FQSVNlcnZpY2UsIEhlcmVNYXBzTWFya2VyU2VydmljZSwgSGVyZU1hcHNVdGlsc1NlcnZpY2UsIEhlcmVNYXBzQ09OU1RTKSB7XHJcbiAgICBmdW5jdGlvbiBVSShwbGF0Zm9ybSwgYWxpZ25tZW50KSB7XHJcbiAgICAgICAgdGhpcy5tYXAgPSBwbGF0Zm9ybS5tYXA7XHJcbiAgICAgICAgdGhpcy5sYXllcnMgPSBwbGF0Zm9ybS5sYXllcnM7XHJcbiAgICAgICAgdGhpcy5hbGlnbm1lbnQgPSBhbGlnbm1lbnQ7XHJcbiAgICAgICAgdGhpcy51aSA9IHBsYXRmb3JtLnVpID0gSC51aS5VSS5jcmVhdGVEZWZhdWx0KHRoaXMubWFwLCB0aGlzLmxheWVycyk7XHJcblxyXG4gICAgICAgIHRoaXMuc2V0dXBDb250cm9scygpO1xyXG4gICAgfVxyXG5cclxuICAgIFVJLmlzVmFsaWRBbGlnbm1lbnQgPSBpc1ZhbGlkQWxpZ25tZW50O1xyXG5cclxuICAgIHZhciBwcm90byA9IFVJLnByb3RvdHlwZTtcclxuXHJcbiAgICBwcm90by5zZXR1cENvbnRyb2xzID0gc2V0dXBDb250cm9scztcclxuICAgIHByb3RvLmNyZWF0ZVVzZXJDb250cm9sID0gY3JlYXRlVXNlckNvbnRyb2w7XHJcbiAgICBwcm90by5zZXRDb250cm9sc0FsaWdubWVudCA9IHNldENvbnRyb2xzQWxpZ25tZW50O1xyXG5cclxuICAgIHJldHVybiB7XHJcbiAgICAgICAgc3RhcnQ6IGZ1bmN0aW9uKGFyZ3MpIHtcclxuICAgICAgICAgICAgaWYgKCEoYXJncy5wbGF0Zm9ybS5tYXAgaW5zdGFuY2VvZiBILk1hcCkgJiYgIShhcmdzLnBsYXRmb3JtLmxheWVycykpXHJcbiAgICAgICAgICAgICAgICByZXR1cm4gY29uc29sZS5lcnJvcignTWlzc2VkIHVpIG1vZHVsZSBkZXBlbmRlbmNpZXMnKTtcclxuXHJcbiAgICAgICAgICAgIHZhciB1aSA9IG5ldyBVSShhcmdzLnBsYXRmb3JtLCBhcmdzLmFsaWdubWVudCk7XHJcbiAgICAgICAgfVxyXG4gICAgfVxyXG5cclxuICAgIGZ1bmN0aW9uIHNldHVwQ29udHJvbHMoKSB7XHJcbiAgICAgICAgdmFyIE5BTUVTID0gSGVyZU1hcHNDT05TVFMuQ09OVFJPTFMuTkFNRVMsXHJcbiAgICAgICAgICAgIHVzZXJDb250cm9sID0gdGhpcy5jcmVhdGVVc2VyQ29udHJvbCgpO1xyXG5cclxuICAgICAgICB0aGlzLnVpLmdldENvbnRyb2woTkFNRVMuU0VUVElOR1MpLnNldEluY2lkZW50c0xheWVyKGZhbHNlKTtcclxuICAgICAgICB0aGlzLnVpLmFkZENvbnRyb2woTkFNRVMuVVNFUiwgdXNlckNvbnRyb2wpO1xyXG4gICAgICAgIHRoaXMuc2V0Q29udHJvbHNBbGlnbm1lbnQoTkFNRVMpO1xyXG4gICAgfVxyXG5cclxuICAgIGZ1bmN0aW9uIGNyZWF0ZVVzZXJDb250cm9sKCkge1xyXG4gICAgICAgIHZhciBzZWxmID0gdGhpcyxcclxuICAgICAgICAgICAgdXNlckNvbnRyb2wgPSBuZXcgSC51aS5Db250cm9sKCksXHJcbiAgICAgICAgICAgIG1hcmt1cCA9ICc8c3ZnIGNsYXNzPVwiSF9pY29uXCIgZmlsbD1cIiNmZmZcIiB4bWxucz1cImh0dHA6Ly93d3cudzMub3JnLzIwMDAvc3ZnXCIgd2lkdGg9XCIxNlwiIGhlaWdodD1cIjE2XCIgdmlld0JveD1cIjAgMCAxNiAxNlwiPjxwYXRoIGNsYXNzPVwibWlkZGxlX2xvY2F0aW9uX3N0cm9rZVwiIGQ9XCJNOCAxMmMtMi4yMDYgMC00LTEuNzk1LTQtNCAwLTIuMjA2IDEuNzk0LTQgNC00czQgMS43OTQgNCA0YzAgMi4yMDUtMS43OTQgNC00IDRNOCAxLjI1YTYuNzUgNi43NSAwIDEgMCAwIDEzLjUgNi43NSA2Ljc1IDAgMCAwIDAtMTMuNVwiPjwvcGF0aD48cGF0aCBjbGFzcz1cImlubmVyX2xvY2F0aW9uX3N0cm9rZVwiIGQ9XCJNOCA1YTMgMyAwIDEgMSAuMDAxIDZBMyAzIDAgMCAxIDggNW0wLTFDNS43OTQgNCA0IDUuNzk0IDQgOGMwIDIuMjA1IDEuNzk0IDQgNCA0czQtMS43OTUgNC00YzAtMi4yMDYtMS43OTQtNC00LTRcIj48L3BhdGg+PHBhdGggY2xhc3M9XCJvdXRlcl9sb2NhdGlvbl9zdHJva2VcIiBkPVwiTTggMS4yNWE2Ljc1IDYuNzUgMCAxIDEgMCAxMy41IDYuNzUgNi43NSAwIDAgMSAwLTEzLjVNOCAwQzMuNTkgMCAwIDMuNTkgMCA4YzAgNC40MTEgMy41OSA4IDggOHM4LTMuNTg5IDgtOGMwLTQuNDEtMy41OS04LTgtOFwiPjwvcGF0aD48L3N2Zz4nO1xyXG5cclxuICAgICAgICB2YXIgdXNlckNvbnRyb2xCdXR0b24gPSBuZXcgSC51aS5iYXNlLkJ1dHRvbih7XHJcbiAgICAgICAgICAgIGxhYmVsOiBtYXJrdXAsXHJcbiAgICAgICAgICAgIG9uU3RhdGVDaGFuZ2U6IGZ1bmN0aW9uKGV2dCkge1xyXG4gICAgICAgICAgICAgICAgaWYgKHVzZXJDb250cm9sQnV0dG9uLmdldFN0YXRlKCkgPT09IEgudWkuYmFzZS5CdXR0b24uU3RhdGUuRE9XTilcclxuICAgICAgICAgICAgICAgICAgICByZXR1cm47XHJcblxyXG4gICAgICAgICAgICAgICAgSGVyZU1hcHNBUElTZXJ2aWNlLmdldFBvc2l0aW9uKCkudGhlbihmdW5jdGlvbihyZXNwb25zZSkge1xyXG4gICAgICAgICAgICAgICAgICAgIHZhciBwb3NpdGlvbiA9IHtcclxuICAgICAgICAgICAgICAgICAgICAgICAgbG5nOiByZXNwb25zZS5jb29yZHMubG9uZ2l0dWRlLFxyXG4gICAgICAgICAgICAgICAgICAgICAgICBsYXQ6IHJlc3BvbnNlLmNvb3Jkcy5sYXRpdHVkZVxyXG4gICAgICAgICAgICAgICAgICAgIH07XHJcbiAgICAgICAgICAgICAgICAgICAgXHJcbiAgICAgICAgICAgICAgICAgICAgc2VsZi5tYXAuc2V0Q2VudGVyKHBvc2l0aW9uKTtcclxuICAgICAgICAgICAgICAgICAgICBcclxuICAgICAgICAgICAgICAgICAgICBIZXJlTWFwc1V0aWxzU2VydmljZS56b29tKHNlbGYubWFwLCAxNywgLjA4KTtcclxuXHJcbiAgICAgICAgICAgICAgICAgICAgaWYgKHNlbGYudXNlck1hcmtlcikge1xyXG4gICAgICAgICAgICAgICAgICAgICAgICBzZWxmLnVzZXJNYXJrZXIuc2V0UG9zaXRpb24ocG9zaXRpb24pO1xyXG4gICAgICAgICAgICAgICAgICAgICAgICByZXR1cm47XHJcbiAgICAgICAgICAgICAgICAgICAgfVxyXG4gICAgICAgICAgICAgICAgICAgIFxyXG4gICAgICAgICAgICAgICAgICAgIHNlbGYudXNlck1hcmtlciA9IEhlcmVNYXBzTWFya2VyU2VydmljZS5hZGRVc2VyTWFya2VyKHNlbGYubWFwLCB7XHJcbiAgICAgICAgICAgICAgICAgICAgICAgIHBvczogcG9zaXRpb25cclxuICAgICAgICAgICAgICAgICAgICB9KTtcclxuICAgICAgICAgICAgICAgIH0pO1xyXG4gICAgICAgICAgICB9XHJcbiAgICAgICAgfSk7XHJcblxyXG4gICAgICAgIHVzZXJDb250cm9sLmFkZENoaWxkKHVzZXJDb250cm9sQnV0dG9uKTtcclxuXHJcbiAgICAgICAgcmV0dXJuIHVzZXJDb250cm9sO1xyXG4gICAgfVxyXG5cclxuICAgIGZ1bmN0aW9uIHNldENvbnRyb2xzQWxpZ25tZW50KE5BTUVTKSB7XHJcbiAgICAgICAgaWYgKCFVSS5pc1ZhbGlkQWxpZ25tZW50KHRoaXMuYWxpZ25tZW50KSlcclxuICAgICAgICAgICAgcmV0dXJuO1xyXG5cclxuICAgICAgICBmb3IgKHZhciBpZCBpbiBOQU1FUykge1xyXG4gICAgICAgICAgICB2YXIgY29udHJvbCA9IHRoaXMudWkuZ2V0Q29udHJvbChOQU1FU1tpZF0pO1xyXG5cclxuICAgICAgICAgICAgaWYgKCFOQU1FUy5oYXNPd25Qcm9wZXJ0eShpZCkgfHwgIWNvbnRyb2wpXHJcbiAgICAgICAgICAgICAgICBjb250aW51ZTtcclxuXHJcbiAgICAgICAgICAgIGNvbnRyb2wuc2V0QWxpZ25tZW50KHRoaXMuYWxpZ25tZW50KTtcclxuICAgICAgICB9XHJcbiAgICB9XHJcblxyXG4gICAgZnVuY3Rpb24gaXNWYWxpZEFsaWdubWVudChhbGlnbm1lbnQpIHtcclxuICAgICAgICByZXR1cm4gISEoSGVyZU1hcHNDT05TVFMuQ09OVFJPTFMuUE9TSVRJT05TLmluZGV4T2YoYWxpZ25tZW50KSArIDEpO1xyXG4gICAgfVxyXG5cclxufTsiLCJtb2R1bGUuZXhwb3J0cyA9IGZ1bmN0aW9uKCkge1xyXG4gICAgdmFyIG9wdGlvbnMgPSB7fTtcclxuICAgIHZhciBERUZBVUxUX0FQSV9WRVJTSU9OID0gXCIzLjBcIjtcclxuXHJcbiAgICB0aGlzLiRnZXQgPSBmdW5jdGlvbigpe1xyXG4gICAgICAgIHJldHVybiB7XHJcbiAgICAgICAgICAgIGFwcF9pZDogb3B0aW9ucy5hcHBfaWQsXHJcbiAgICAgICAgICAgIGFwcF9jb2RlOiBvcHRpb25zLmFwcF9jb2RlLFxyXG4gICAgICAgICAgICBhcGlWZXJzaW9uOiBvcHRpb25zLmFwaVZlcnNpb24gfHwgREVGQVVMVF9BUElfVkVSU0lPTixcclxuICAgICAgICAgICAgdXNlSFRUUFM6IG9wdGlvbnMudXNlSFRUUFMsXHJcbiAgICAgICAgICAgIHVzZUNJVDogISFvcHRpb25zLnVzZUNJVCxcclxuICAgICAgICAgICAgbWFwVGlsZUNvbmZpZzogb3B0aW9ucy5tYXBUaWxlQ29uZmlnXHJcbiAgICAgICAgfVxyXG4gICAgfTtcclxuXHJcbiAgICB0aGlzLnNldE9wdGlvbnMgPSBmdW5jdGlvbihvcHRzKXtcclxuICAgICAgICBvcHRpb25zID0gb3B0cztcclxuICAgIH07XHJcbn07IiwiXHJcbm1vZHVsZS5leHBvcnRzID0gSGVyZU1hcHNVdGlsc1NlcnZpY2U7XHJcblxyXG5IZXJlTWFwc1V0aWxzU2VydmljZS4kaW5qZWN0ID0gW1xyXG4gICAgJyRyb290U2NvcGUnLCBcclxuICAgICckdGltZW91dCcsIFxyXG4gICAgJ0hlcmVNYXBzQ09OU1RTJ1xyXG5dO1xyXG5mdW5jdGlvbiBIZXJlTWFwc1V0aWxzU2VydmljZSgkcm9vdFNjb3BlLCAkdGltZW91dCwgSGVyZU1hcHNDT05TVFMpIHtcclxuICAgIHJldHVybiB7XHJcbiAgICAgICAgdGhyb3R0bGU6IHRocm90dGxlLFxyXG4gICAgICAgIGNyZWF0ZVNjcmlwdFRhZzogY3JlYXRlU2NyaXB0VGFnLFxyXG4gICAgICAgIGNyZWF0ZUxpbmtUYWc6IGNyZWF0ZUxpbmtUYWcsXHJcbiAgICAgICAgcnVuU2NvcGVEaWdlc3RJZk5lZWQ6IHJ1blNjb3BlRGlnZXN0SWZOZWVkLFxyXG4gICAgICAgIGlzVmFsaWRDb29yZHM6IGlzVmFsaWRDb29yZHMsXHJcbiAgICAgICAgYWRkRXZlbnRMaXN0ZW5lcjogYWRkRXZlbnRMaXN0ZW5lcixcclxuICAgICAgICB6b29tOiB6b29tLFxyXG4gICAgICAgIGdldEJvdW5kc1JlY3RGcm9tUG9pbnRzOiBnZXRCb3VuZHNSZWN0RnJvbVBvaW50cyxcclxuICAgICAgICBnZW5lcmF0ZUlkOiBnZW5lcmF0ZUlkLFxyXG4gICAgICAgIGdldE1hcEZhY3Rvcnk6IGdldE1hcEZhY3RvcnlcclxuICAgIH07XHJcblxyXG4gICAgLy8jcmVnaW9uIFBVQkxJQ1xyXG4gICAgZnVuY3Rpb24gdGhyb3R0bGUoZm4sIHBlcmlvZCkge1xyXG4gICAgICAgIHZhciB0aW1lb3V0ID0gbnVsbDtcclxuXHJcbiAgICAgICAgcmV0dXJuIGZ1bmN0aW9uICgpIHtcclxuICAgICAgICAgICAgaWYgKCR0aW1lb3V0KVxyXG4gICAgICAgICAgICAgICAgJHRpbWVvdXQuY2FuY2VsKHRpbWVvdXQpO1xyXG5cclxuICAgICAgICAgICAgdGltZW91dCA9ICR0aW1lb3V0KGZuLCBwZXJpb2QpO1xyXG4gICAgICAgIH1cclxuICAgIH1cclxuXHJcbiAgICBmdW5jdGlvbiBhZGRFdmVudExpc3RlbmVyKG9iaiwgZXZlbnROYW1lLCBsaXN0ZW5lciwgdXNlQ2FwdHVyZSkge1xyXG4gICAgICAgIG9iai5hZGRFdmVudExpc3RlbmVyKGV2ZW50TmFtZSwgbGlzdGVuZXIsICEhdXNlQ2FwdHVyZSk7XHJcbiAgICB9XHJcblxyXG4gICAgZnVuY3Rpb24gcnVuU2NvcGVEaWdlc3RJZk5lZWQoc2NvcGUsIGNiKSB7XHJcbiAgICAgICAgaWYgKHNjb3BlLiRyb290ICYmIHNjb3BlLiRyb290LiQkcGhhc2UgIT09ICckYXBwbHknICYmIHNjb3BlLiRyb290LiQkcGhhc2UgIT09ICckZGlnZXN0Jykge1xyXG4gICAgICAgICAgICBzY29wZS4kZGlnZXN0KGNiIHx8IGFuZ3VsYXIubm9vcCk7XHJcbiAgICAgICAgICAgIHJldHVybiB0cnVlO1xyXG4gICAgICAgIH1cclxuICAgICAgICByZXR1cm4gZmFsc2U7XHJcbiAgICB9XHJcblxyXG4gICAgZnVuY3Rpb24gY3JlYXRlU2NyaXB0VGFnKGF0dHJzKSB7XHJcbiAgICAgICAgdmFyIHNjcmlwdCA9IGRvY3VtZW50LmdldEVsZW1lbnRCeUlkKGF0dHJzLnNyYyk7XHJcblxyXG4gICAgICAgIGlmIChzY3JpcHQpXHJcbiAgICAgICAgICAgIHJldHVybiBmYWxzZTtcclxuXHJcbiAgICAgICAgc2NyaXB0ID0gZG9jdW1lbnQuY3JlYXRlRWxlbWVudCgnc2NyaXB0Jyk7XHJcbiAgICAgICAgc2NyaXB0LnR5cGUgPSAndGV4dC9qYXZhc2NyaXB0JztcclxuICAgICAgICBzY3JpcHQuaWQgPSBhdHRycy5zcmM7XHJcbiAgICAgICAgX3NldEF0dHJzKHNjcmlwdCwgYXR0cnMpO1xyXG5cclxuICAgICAgICByZXR1cm4gc2NyaXB0O1xyXG4gICAgfVxyXG5cclxuICAgIGZ1bmN0aW9uIGNyZWF0ZUxpbmtUYWcoYXR0cnMpIHtcclxuICAgICAgICB2YXIgbGluayA9IGRvY3VtZW50LmdldEVsZW1lbnRCeUlkKGF0dHJzLmhyZWYpO1xyXG5cclxuICAgICAgICBpZiAobGluaylcclxuICAgICAgICAgICAgcmV0dXJuIGZhbHNlO1xyXG5cclxuICAgICAgICBsaW5rID0gZG9jdW1lbnQuY3JlYXRlRWxlbWVudCgnbGluaycpO1xyXG4gICAgICAgIGxpbmsuaWQgPSBhdHRycy5ocmVmO1xyXG4gICAgICAgIF9zZXRBdHRycyhsaW5rLCBhdHRycyk7XHJcblxyXG4gICAgICAgIHJldHVybiBsaW5rO1xyXG4gICAgfVxyXG5cclxuICAgIGZ1bmN0aW9uIGlzVmFsaWRDb29yZHMoY29vcmRzKSB7XHJcbiAgICAgICAgcmV0dXJuIGNvb3JkcyAmJlxyXG4gICAgICAgICAgICAodHlwZW9mIGNvb3Jkcy5sYXRpdHVkZSA9PT0gJ3N0cmluZycgfHwgdHlwZW9mIGNvb3Jkcy5sYXRpdHVkZSA9PT0gJ251bWJlcicpICYmXHJcbiAgICAgICAgICAgICh0eXBlb2YgY29vcmRzLmxvbmdpdHVkZSA9PT0gJ3N0cmluZycgfHwgdHlwZW9mIGNvb3Jkcy5sb25naXR1ZGUgPT09ICdudW1iZXInKVxyXG4gICAgfVxyXG5cclxuICAgIGZ1bmN0aW9uIHpvb20obWFwLCB2YWx1ZSwgc3RlcCkge1xyXG4gICAgICAgIHZhciBjdXJyZW50Wm9vbSA9IG1hcC5nZXRab29tKCksXHJcbiAgICAgICAgICAgIF9zdGVwID0gc3RlcCB8fCBIZXJlTWFwc0NPTlNUUy5BTklNQVRJT05fWk9PTV9TVEVQLFxyXG4gICAgICAgICAgICBmYWN0b3IgPSBjdXJyZW50Wm9vbSA+PSB2YWx1ZSA/IC0xIDogMSxcclxuICAgICAgICAgICAgaW5jcmVtZW50ID0gc3RlcCAqIGZhY3RvcjtcclxuXHJcbiAgICAgICAgcmV0dXJuIChmdW5jdGlvbiB6b29tKCkge1xyXG4gICAgICAgICAgICBpZiAoIXN0ZXAgfHwgTWF0aC5mbG9vcihjdXJyZW50Wm9vbSkgPT09IE1hdGguZmxvb3IodmFsdWUpKSB7XHJcbiAgICAgICAgICAgICAgICBtYXAuc2V0Wm9vbSh2YWx1ZSk7XHJcbiAgICAgICAgICAgICAgICByZXR1cm47XHJcbiAgICAgICAgICAgIH1cclxuXHJcbiAgICAgICAgICAgIGN1cnJlbnRab29tICs9IGluY3JlbWVudDtcclxuICAgICAgICAgICAgbWFwLnNldFpvb20oY3VycmVudFpvb20pO1xyXG5cclxuICAgICAgICAgICAgcmVxdWVzdEFuaW1hdGlvbkZyYW1lKHpvb20pO1xyXG4gICAgICAgIH0pKCk7XHJcbiAgICB9XHJcblxyXG4gICAgZnVuY3Rpb24gZ2V0TWFwRmFjdG9yeSgpe1xyXG4gICAgICAgIHJldHVybiBIO1xyXG4gICAgfVxyXG5cclxuICAgIC8qKlxyXG4gICAgICogQG1ldGhvZCBnZXRCb3VuZHNSZWN0RnJvbVBvaW50c1xyXG4gICAgICogXHJcbiAgICAgKiBAcGFyYW0ge09iamVjdH0gdG9wTGVmdCBcclxuICAgICAqICBAcHJvcGVydHkge051bWJlcnxTdHJpbmd9IGxhdFxyXG4gICAgICogIEBwcm9wZXJ0eSB7TnVtYmVyfFN0cmluZ30gbG5nXHJcbiAgICAgKiBAcGFyYW0ge09iamVjdH0gYm90dG9tUmlnaHQgXHJcbiAgICAgKiAgQHByb3BlcnR5IHtOdW1iZXJ8U3RyaW5nfSBsYXRcclxuICAgICAqICBAcHJvcGVydHkge051bWJlcnxTdHJpbmd9IGxuZ1xyXG4gICAgICogXHJcbiAgICAgKiBAcmV0dXJuIHtILmdlby5SZWN0fVxyXG4gICAgICovXHJcbiAgICBmdW5jdGlvbiBnZXRCb3VuZHNSZWN0RnJvbVBvaW50cyh0b3BMZWZ0LCBib3R0b21SaWdodCkge1xyXG4gICAgICAgIHJldHVybiBILmdlby5SZWN0LmZyb21Qb2ludHModG9wTGVmdCwgYm90dG9tUmlnaHQsIHRydWUpO1xyXG4gICAgfVxyXG5cclxuICAgIGZ1bmN0aW9uIGdlbmVyYXRlSWQoKSB7XHJcbiAgICAgICAgdmFyIG1hc2sgPSAneHh4eHh4eHgteHh4eC00eHh4LXl4eHgteHh4eHh4eHh4eHh4JyxcclxuICAgICAgICAgICAgcmVnZXhwID0gL1t4eV0vZyxcclxuICAgICAgICAgICAgZCA9IG5ldyBEYXRlKCkuZ2V0VGltZSgpLFxyXG4gICAgICAgICAgICB1dWlkID0gbWFzay5yZXBsYWNlKHJlZ2V4cCwgZnVuY3Rpb24gKGMpIHtcclxuICAgICAgICAgICAgICAgIHZhciByID0gKGQgKyBNYXRoLnJhbmRvbSgpICogMTYpICUgMTYgfCAwO1xyXG4gICAgICAgICAgICAgICAgZCA9IE1hdGguZmxvb3IoZCAvIDE2KTtcclxuICAgICAgICAgICAgICAgIHJldHVybiAoYyA9PSAneCcgPyByIDogKHIgJiAweDMgfCAweDgpKS50b1N0cmluZygxNik7XHJcbiAgICAgICAgICAgIH0pO1xyXG5cclxuICAgICAgICByZXR1cm4gdXVpZDtcclxuICAgIH1cclxuXHJcbiAgICAvLyNlbmRyZWdpb24gUFVCTElDIFxyXG5cclxuICAgIGZ1bmN0aW9uIF9zZXRBdHRycyhlbCwgYXR0cnMpIHtcclxuICAgICAgICBpZiAoIWVsIHx8ICFhdHRycylcclxuICAgICAgICAgICAgdGhyb3cgbmV3IEVycm9yKCdNaXNzZWQgYXR0cmlidXRlcycpO1xyXG5cclxuICAgICAgICBmb3IgKHZhciBrZXkgaW4gYXR0cnMpIHtcclxuICAgICAgICAgICAgaWYgKCFhdHRycy5oYXNPd25Qcm9wZXJ0eShrZXkpKVxyXG4gICAgICAgICAgICAgICAgY29udGludWU7XHJcblxyXG4gICAgICAgICAgICBlbFtrZXldID0gYXR0cnNba2V5XTtcclxuICAgICAgICB9XHJcbiAgICB9XHJcbn07IiwibW9kdWxlLmV4cG9ydHMgPSBIZXJlTWFwc0RlZmF1bHRNYXJrZXI7XHJcblxyXG5IZXJlTWFwc0RlZmF1bHRNYXJrZXIuJGluamVjdCA9IFsnSGVyZU1hcHNNYXJrZXJJbnRlcmZhY2UnXTtcclxuZnVuY3Rpb24gSGVyZU1hcHNEZWZhdWx0TWFya2VyKEhlcmVNYXBzTWFya2VySW50ZXJmYWNlKXtcclxuICAgIGZ1bmN0aW9uIERlZmF1bHRNYXJrZXIocGxhY2Upe1xyXG4gICAgICAgIHRoaXMucGxhY2UgPSBwbGFjZTtcclxuICAgICAgICB0aGlzLnNldENvb3JkcygpO1xyXG4gICAgfVxyXG5cclxuICAgIHZhciBwcm90byA9IERlZmF1bHRNYXJrZXIucHJvdG90eXBlID0gbmV3IEhlcmVNYXBzTWFya2VySW50ZXJmYWNlKCk7XHJcbiAgICBwcm90by5jb25zdHJ1Y3RvciA9IERlZmF1bHRNYXJrZXI7XHJcblxyXG4gICAgcHJvdG8uY3JlYXRlID0gY3JlYXRlO1xyXG5cclxuICAgIHJldHVybiBEZWZhdWx0TWFya2VyO1xyXG4gICAgXHJcbiAgICBmdW5jdGlvbiBjcmVhdGUoKXtcclxuICAgICAgICB2YXIgbWFya2VyID0gbmV3IEgubWFwLk1hcmtlcih0aGlzLmNvb3Jkcyk7XHJcbiAgICAgICAgXHJcbiAgICAgICAgdGhpcy5hZGRJbmZvQnViYmxlKG1hcmtlcik7XHJcbiAgICAgICAgXHJcbiAgICAgICAgcmV0dXJuIG1hcmtlcjtcclxuICAgIH1cclxufSIsIm1vZHVsZS5leHBvcnRzID0gSGVyZU1hcHNET01NYXJrZXI7XHJcblxyXG5IZXJlTWFwc0RPTU1hcmtlci4kaW5qZWN0ID0gWydIZXJlTWFwc01hcmtlckludGVyZmFjZSddO1xyXG5mdW5jdGlvbiBIZXJlTWFwc0RPTU1hcmtlcihIZXJlTWFwc01hcmtlckludGVyZmFjZSl7XHJcbiAgICBmdW5jdGlvbiBET01NYXJrZXIocGxhY2Upe1xyXG4gICAgICAgIHRoaXMucGxhY2UgPSBwbGFjZTtcclxuICAgICAgICB0aGlzLnNldENvb3JkcygpO1xyXG4gICAgfVxyXG5cclxuICAgIHZhciBwcm90byA9IERPTU1hcmtlci5wcm90b3R5cGUgPSBuZXcgSGVyZU1hcHNNYXJrZXJJbnRlcmZhY2UoKTtcclxuICAgIHByb3RvLmNvbnN0cnVjdG9yID0gRE9NTWFya2VyO1xyXG5cclxuICAgIHByb3RvLmNyZWF0ZSA9IGNyZWF0ZTtcclxuICAgIHByb3RvLmdldEljb24gPSBnZXRJY29uO1xyXG4gICAgcHJvdG8uc2V0dXBFdmVudHMgPSBzZXR1cEV2ZW50cztcclxuXHJcbiAgICByZXR1cm4gRE9NTWFya2VyO1xyXG4gICAgXHJcbiAgICBmdW5jdGlvbiBjcmVhdGUoKXtcclxuICAgICAgICB2YXIgbWFya2VyID0gbmV3IEgubWFwLkRvbU1hcmtlcih0aGlzLmNvb3Jkcywge1xyXG4gICAgICAgICAgICBpY29uOiB0aGlzLmdldEljb24oKVxyXG4gICAgICAgIH0pO1xyXG4gICAgICAgIFxyXG4gICAgICAgIHRoaXMuYWRkSW5mb0J1YmJsZShtYXJrZXIpO1xyXG4gICAgICAgIFxyXG4gICAgICAgIHJldHVybiBtYXJrZXI7XHJcbiAgICB9XHJcbiAgICBcclxuICAgIGZ1bmN0aW9uIGdldEljb24oKXtcclxuICAgICAgICB2YXIgaWNvbiA9IHRoaXMucGxhY2UubWFya3VwO1xyXG4gICAgICAgICBpZighaWNvbilcclxuICAgICAgICAgICAgdGhyb3cgbmV3IEVycm9yKCdtYXJrdXAgbWlzc2VkJyk7XHJcblxyXG4gICAgICAgIHJldHVybiBuZXcgSC5tYXAuRG9tSWNvbihpY29uKTtcclxuICAgIH1cclxuICAgIFxyXG4gICAgZnVuY3Rpb24gc2V0dXBFdmVudHMoZWwsIGV2ZW50cywgcmVtb3ZlKXtcclxuICAgICAgICB2YXIgbWV0aG9kID0gcmVtb3ZlID8gJ3JlbW92ZUV2ZW50TGlzdGVuZXInIDogJ2FkZEV2ZW50TGlzdGVuZXInO1xyXG5cclxuICAgICAgICBmb3IodmFyIGtleSBpbiBldmVudHMpIHtcclxuICAgICAgICAgICAgaWYoIWV2ZW50cy5oYXNPd25Qcm9wZXJ0eShrZXkpKVxyXG4gICAgICAgICAgICAgICAgY29udGludWU7XHJcblxyXG4gICAgICAgICAgICBlbFttZXRob2RdLmNhbGwobnVsbCwga2V5LCBldmVudHNba2V5XSk7XHJcbiAgICAgICAgfVxyXG4gICAgfVxyXG59IiwibW9kdWxlLmV4cG9ydHMgPSBhbmd1bGFyLm1vZHVsZSgnaGVyZW1hcHMtbWFya2Vycy1tb2R1bGUnLCBbXSlcclxuICAgIC5mYWN0b3J5KCdIZXJlTWFwc01hcmtlckludGVyZmFjZScsIHJlcXVpcmUoJy4vbWFya2VyLmpzJykpXHJcbiAgICAuZmFjdG9yeSgnSGVyZU1hcHNEZWZhdWx0TWFya2VyJywgcmVxdWlyZSgnLi9kZWZhdWx0Lm1hcmtlci5qcycpKVxyXG4gICAgLmZhY3RvcnkoJ0hlcmVNYXBzRE9NTWFya2VyJywgcmVxdWlyZSgnLi9kb20ubWFya2VyLmpzJykpXHJcbiAgICAuZmFjdG9yeSgnSGVyZU1hcHNTVkdNYXJrZXInLCByZXF1aXJlKCcuL3N2Zy5tYXJrZXIuanMnKSlcclxuICAgIC5zZXJ2aWNlKCdIZXJlTWFwc01hcmtlclNlcnZpY2UnLCByZXF1aXJlKCcuL21hcmtlcnMuc2VydmljZS5qcycpKTsiLCJtb2R1bGUuZXhwb3J0cyA9IGZ1bmN0aW9uKCl7XHJcbiAgICBmdW5jdGlvbiBNYXJrZXJJbnRlcmZhY2UoKXtcclxuICAgICAgICB0aHJvdyBuZXcgRXJyb3IoJ0Fic3RyYWN0IGNsYXNzISBUaGUgSW5zdGFuY2Ugc2hvdWxkIGJlIGNyZWF0ZWQnKTtcclxuICAgIH1cclxuICAgIFxyXG4gICAgdmFyIHByb3RvID0gTWFya2VySW50ZXJmYWNlLnByb3RvdHlwZTtcclxuICAgIFxyXG4gICAgcHJvdG8uY3JlYXRlID0gY3JlYXRlO1xyXG4gICAgcHJvdG8uc2V0Q29vcmRzID0gc2V0Q29vcmRzO1xyXG4gICAgcHJvdG8uYWRkSW5mb0J1YmJsZSA9IGFkZEluZm9CdWJibGU7XHJcbiAgICBcclxuICAgIGZ1bmN0aW9uIE1hcmtlcigpe31cclxuICAgIFxyXG4gICAgTWFya2VyLnByb3RvdHlwZSA9IHByb3RvO1xyXG4gICAgXHJcbiAgICByZXR1cm4gTWFya2VyO1xyXG4gICAgXHJcbiAgICBmdW5jdGlvbiBjcmVhdGUoKXtcclxuICAgICAgICB0aHJvdyBuZXcgRXJyb3IoJ2NyZWF0ZTo6IG5vdCBpbXBsZW1lbnRlZCcpOyBcclxuICAgIH1cclxuICAgIFxyXG4gICAgZnVuY3Rpb24gc2V0Q29vcmRzKCl7XHJcbiAgICAgICAgIHRoaXMuY29vcmRzID0ge1xyXG4gICAgICAgICAgICBsYXQ6IHRoaXMucGxhY2UucG9zLmxhdCxcclxuICAgICAgICAgICAgbG5nOiB0aGlzLnBsYWNlLnBvcy5sbmdcclxuICAgICAgICB9XHJcbiAgICB9XHJcbiAgICBcclxuICAgIGZ1bmN0aW9uIGFkZEluZm9CdWJibGUobWFya2VyKXtcclxuICAgICAgICBpZighdGhpcy5wbGFjZS5wb3B1cClcclxuICAgICAgICAgICAgcmV0dXJuO1xyXG4gICAgICAgICAgICBcclxuICAgICAgICBtYXJrZXIuc2V0RGF0YSh0aGlzLnBsYWNlLnBvcHVwKVxyXG4gICAgfVxyXG59IiwibW9kdWxlLmV4cG9ydHMgPSBIZXJlTWFwc01hcmtlclNlcnZpY2U7XHJcblxyXG5IZXJlTWFwc01hcmtlclNlcnZpY2UuJGluamVjdCA9IFtcclxuICAgICdIZXJlTWFwc0RlZmF1bHRNYXJrZXInLFxyXG4gICAgJ0hlcmVNYXBzRE9NTWFya2VyJyxcclxuICAgICdIZXJlTWFwc1NWR01hcmtlcicsXHJcbiAgICAnSGVyZU1hcHNDT05TVFMnXHJcbl07XHJcbmZ1bmN0aW9uIEhlcmVNYXBzTWFya2VyU2VydmljZShIZXJlTWFwc0RlZmF1bHRNYXJrZXIsIEhlcmVNYXBzRE9NTWFya2VyLCBIZXJlTWFwc1NWR01hcmtlciwgSGVyZU1hcHNDT05TVFMpIHtcclxuICAgIHZhciBNQVJLRVJfVFlQRVMgPSBIZXJlTWFwc0NPTlNUUy5NQVJLRVJfVFlQRVM7XHJcblxyXG4gICAgcmV0dXJuIHtcclxuICAgICAgICBhZGRNYXJrZXJzVG9NYXA6IGFkZE1hcmtlcnNUb01hcCxcclxuICAgICAgICBhZGRVc2VyTWFya2VyOiBhZGRVc2VyTWFya2VyLFxyXG4gICAgICAgIHVwZGF0ZU1hcmtlcnM6IHVwZGF0ZU1hcmtlcnMsXHJcbiAgICAgICAgaXNNYXJrZXJJbnN0YW5jZTogaXNNYXJrZXJJbnN0YW5jZSxcclxuICAgICAgICBzZXRWaWV3Qm91bmRzOiBzZXRWaWV3Qm91bmRzXHJcbiAgICB9XHJcblxyXG4gICAgZnVuY3Rpb24gaXNNYXJrZXJJbnN0YW5jZSh0YXJnZXQpIHtcclxuICAgICAgICByZXR1cm4gdGFyZ2V0IGluc3RhbmNlb2YgSC5tYXAuTWFya2VyIHx8IHRhcmdldCBpbnN0YW5jZW9mIEgubWFwLkRvbU1hcmtlcjtcclxuICAgIH1cclxuXHJcbiAgICBmdW5jdGlvbiBhZGRVc2VyTWFya2VyKG1hcCwgcGxhY2UpIHtcclxuICAgICAgICBpZiAobWFwLnVzZXJNYXJrZXIpXHJcbiAgICAgICAgICAgIHJldHVybiBtYXAudXNlck1hcmtlcjtcclxuXHJcbiAgICAgICAgcGxhY2UubWFya3VwID0gJzxzdmcgd2lkdGg9XCIzNXB4XCIgaGVpZ2h0PVwiMzVweFwiIHZpZXdCb3g9XCIwIDAgOTAgOTBcIiB2ZXJzaW9uPVwiMS4xXCIgeG1sbnM9XCJodHRwOi8vd3d3LnczLm9yZy8yMDAwL3N2Z1wiIHhtbG5zOnhsaW5rPVwiaHR0cDovL3d3dy53My5vcmcvMTk5OS94bGlua1wiPicgK1xyXG4gICAgICAgICAgICAnPGRlZnM+PGNpcmNsZSBpZD1cInBhdGgtMVwiIGN4PVwiMzAyXCIgY3k9XCI4MDJcIiByPVwiMTVcIj48L2NpcmNsZT4nICtcclxuICAgICAgICAgICAgJzxtYXNrIGlkPVwibWFzay0yXCIgbWFza0NvbnRlbnRVbml0cz1cInVzZXJTcGFjZU9uVXNlXCIgbWFza1VuaXRzPVwib2JqZWN0Qm91bmRpbmdCb3hcIiB4PVwiLTMwXCIgeT1cIi0zMFwiIHdpZHRoPVwiOTBcIiBoZWlnaHQ9XCI5MFwiPicgK1xyXG4gICAgICAgICAgICAnPHJlY3QgeD1cIjI1N1wiIHk9XCI3NTdcIiB3aWR0aD1cIjkwXCIgaGVpZ2h0PVwiOTBcIiBmaWxsPVwid2hpdGVcIj48L3JlY3Q+PHVzZSB4bGluazpocmVmPVwiI3BhdGgtMVwiIGZpbGw9XCJibGFja1wiPjwvdXNlPicgK1xyXG4gICAgICAgICAgICAnPC9tYXNrPjwvZGVmcz48ZyBpZD1cIlBhZ2UtMVwiIHN0cm9rZT1cIm5vbmVcIiBzdHJva2Utd2lkdGg9XCIxXCIgZmlsbD1cIm5vbmVcIiBmaWxsLXJ1bGU9XCJldmVub2RkXCI+JyArXHJcbiAgICAgICAgICAgICc8ZyBpZD1cIlNlcnZpY2UtT3B0aW9ucy0tLWRpcmVjdGlvbnMtLS1tYXBcIiB0cmFuc2Zvcm09XCJ0cmFuc2xhdGUoLTI1Ny4wMDAwMDAsIC03NTcuMDAwMDAwKVwiPjxnIGlkPVwiT3ZhbC0xNVwiPicgK1xyXG4gICAgICAgICAgICAnPHVzZSBmaWxsPVwiI0ZGRkZGRlwiIGZpbGwtcnVsZT1cImV2ZW5vZGRcIiB4bGluazpocmVmPVwiI3BhdGgtMVwiPjwvdXNlPicgK1xyXG4gICAgICAgICAgICAnPHVzZSBzdHJva2Utb3BhY2l0eT1cIjAuMjk2MTM5MDRcIiBzdHJva2U9XCIjM0YzNEEwXCIgbWFzaz1cInVybCgjbWFzay0yKVwiIHN0cm9rZS13aWR0aD1cIjYwXCIgeGxpbms6aHJlZj1cIiNwYXRoLTFcIj48L3VzZT4nICtcclxuICAgICAgICAgICAgJzx1c2Ugc3Ryb2tlPVwiIzNGMzRBMFwiIHN0cm9rZS13aWR0aD1cIjVcIiB4bGluazpocmVmPVwiI3BhdGgtMVwiPjwvdXNlPjwvZz48L2c+PC9nPjwvc3ZnPic7XHJcblxyXG4gICAgICAgIG1hcC51c2VyTWFya2VyID0gbmV3IEhlcmVNYXBzU1ZHTWFya2VyKHBsYWNlKS5jcmVhdGUoKTtcclxuXHJcbiAgICAgICAgbWFwLmFkZE9iamVjdChtYXAudXNlck1hcmtlcik7XHJcblxyXG4gICAgICAgIHJldHVybiBtYXAudXNlck1hcmtlcjtcclxuICAgIH1cclxuXHJcbiAgICBmdW5jdGlvbiBhZGRNYXJrZXJzVG9NYXAobWFwLCBwbGFjZXMsIHJlZnJlc2hWaWV3Ym91bmRzKSB7XHJcbiAgICAgICAgaWYgKCFwbGFjZXMgfHwgIXBsYWNlcy5sZW5ndGgpXHJcbiAgICAgICAgICAgIHJldHVybjtcclxuXHJcbiAgICAgICAgaWYgKCEobWFwIGluc3RhbmNlb2YgSC5NYXApKVxyXG4gICAgICAgICAgICB0aHJvdyBuZXcgRXJyb3IoJ1Vuc3VwcG9ydGVkIG1hcCBpbnN0YW5jZScpO1xyXG5cclxuICAgICAgICBpZiAoIW1hcC5tYXJrZXJzR3JvdXApXHJcbiAgICAgICAgICAgIG1hcC5tYXJrZXJzR3JvdXAgPSBuZXcgSC5tYXAuR3JvdXAoKTtcclxuXHJcbiAgICAgICAgcGxhY2VzLmZvckVhY2goZnVuY3Rpb24gKHBsYWNlLCBpKSB7XHJcbiAgICAgICAgICAgIHZhciBjcmVhdG9yID0gX2dldE1hcmtlckNyZWF0b3IocGxhY2UpLFxyXG4gICAgICAgICAgICAgICAgbWFya2VyID0gcGxhY2UuZHJhZ2dhYmxlID8gX2RyYWdnYWJsZU1hcmtlck1peGluKGNyZWF0b3IuY3JlYXRlKCkpIDogY3JlYXRvci5jcmVhdGUoKTtcclxuXHJcbiAgICAgICAgICAgIG1hcC5tYXJrZXJzR3JvdXAuYWRkT2JqZWN0KG1hcmtlcik7XHJcbiAgICAgICAgfSk7XHJcblxyXG4gICAgICAgIG1hcC5hZGRPYmplY3QobWFwLm1hcmtlcnNHcm91cCk7XHJcblxyXG4gICAgICAgIGlmIChyZWZyZXNoVmlld2JvdW5kcykge1xyXG4gICAgICAgICAgICBzZXRWaWV3Qm91bmRzKG1hcCwgbWFwLm1hcmtlcnNHcm91cC5nZXRCb3VuZHMoKSk7XHJcbiAgICAgICAgfVxyXG4gICAgfVxyXG5cclxuICAgIGZ1bmN0aW9uIHNldFZpZXdCb3VuZHMobWFwLCBib3VuZHMsIG9wdF9hbmltYXRlKSB7XHJcbiAgICAgICAgbWFwLnNldFZpZXdCb3VuZHMoYm91bmRzLCAhIW9wdF9hbmltYXRlKTtcclxuICAgIH1cclxuXHJcbiAgICBmdW5jdGlvbiB1cGRhdGVNYXJrZXJzKG1hcCwgcGxhY2VzLCByZWZyZXNoVmlld2JvdW5kcykge1xyXG4gICAgICAgIGlmIChtYXAubWFya2Vyc0dyb3VwKSB7XHJcbiAgICAgICAgICAgIG1hcC5tYXJrZXJzR3JvdXAucmVtb3ZlQWxsKCk7XHJcbiAgICAgICAgICAgIG1hcC5yZW1vdmVPYmplY3QobWFwLm1hcmtlcnNHcm91cCk7XHJcbiAgICAgICAgICAgIG1hcC5tYXJrZXJzR3JvdXAgPSBudWxsO1xyXG4gICAgICAgIH1cclxuXHJcbiAgICAgICAgYWRkTWFya2Vyc1RvTWFwLmFwcGx5KG51bGwsIGFyZ3VtZW50cyk7XHJcbiAgICB9XHJcblxyXG4gICAgZnVuY3Rpb24gX2dldE1hcmtlckNyZWF0b3IocGxhY2UpIHtcclxuICAgICAgICB2YXIgQ29uY3JldGVNYXJrZXIsXHJcbiAgICAgICAgICAgIHR5cGUgPSBwbGFjZS50eXBlID8gcGxhY2UudHlwZS50b1VwcGVyQ2FzZSgpIDogbnVsbDtcclxuXHJcbiAgICAgICAgc3dpdGNoICh0eXBlKSB7XHJcbiAgICAgICAgICAgIGNhc2UgTUFSS0VSX1RZUEVTLkRPTTpcclxuICAgICAgICAgICAgICAgIENvbmNyZXRlTWFya2VyID0gSGVyZU1hcHNET01NYXJrZXI7XHJcbiAgICAgICAgICAgICAgICBicmVhaztcclxuICAgICAgICAgICAgY2FzZSBNQVJLRVJfVFlQRVMuU1ZHOlxyXG4gICAgICAgICAgICAgICAgQ29uY3JldGVNYXJrZXIgPSBIZXJlTWFwc1NWR01hcmtlcjtcclxuICAgICAgICAgICAgICAgIGJyZWFrO1xyXG4gICAgICAgICAgICBkZWZhdWx0OlxyXG4gICAgICAgICAgICAgICAgQ29uY3JldGVNYXJrZXIgPSBIZXJlTWFwc0RlZmF1bHRNYXJrZXI7XHJcbiAgICAgICAgfVxyXG5cclxuICAgICAgICByZXR1cm4gbmV3IENvbmNyZXRlTWFya2VyKHBsYWNlKTtcclxuICAgIH1cclxuXHJcbiAgICBmdW5jdGlvbiBfZHJhZ2dhYmxlTWFya2VyTWl4aW4obWFya2VyKSB7XHJcbiAgICAgICAgbWFya2VyLmRyYWdnYWJsZSA9IHRydWU7XHJcblxyXG4gICAgICAgIHJldHVybiBtYXJrZXI7XHJcbiAgICB9XHJcbn07XHJcbiIsIm1vZHVsZS5leHBvcnRzID0gSGVyZU1hcHNTVkdNYXJrZXI7XHJcblxyXG5IZXJlTWFwc1NWR01hcmtlci4kaW5qZWN0ID0gWydIZXJlTWFwc01hcmtlckludGVyZmFjZSddO1xyXG5mdW5jdGlvbiBIZXJlTWFwc1NWR01hcmtlcihIZXJlTWFwc01hcmtlckludGVyZmFjZSl7XHJcbiAgICBmdW5jdGlvbiBTVkdNYXJrZXIocGxhY2Upe1xyXG4gICAgICAgIHRoaXMucGxhY2UgPSBwbGFjZTtcclxuICAgICAgICB0aGlzLnNldENvb3JkcygpO1xyXG4gICAgfVxyXG4gICAgXHJcbiAgICB2YXIgcHJvdG8gPSBTVkdNYXJrZXIucHJvdG90eXBlID0gbmV3IEhlcmVNYXBzTWFya2VySW50ZXJmYWNlKCk7XHJcbiAgICBwcm90by5jb25zdHJ1Y3RvciA9IFNWR01hcmtlcjtcclxuICAgIFxyXG4gICAgcHJvdG8uY3JlYXRlID0gY3JlYXRlO1xyXG4gICAgcHJvdG8uZ2V0SWNvbiA9IGdldEljb247XHJcbiAgICBcclxuICAgIHJldHVybiBTVkdNYXJrZXI7XHJcbiAgICBcclxuICAgIGZ1bmN0aW9uIGNyZWF0ZSgpe1xyXG4gICAgICAgIHZhciBtYXJrZXIgPSBuZXcgSC5tYXAuTWFya2VyKHRoaXMuY29vcmRzLCB7XHJcbiAgICAgICAgICAgIGljb246IHRoaXMuZ2V0SWNvbigpLFxyXG4gICAgICAgIH0pO1xyXG4gICAgICAgIFxyXG4gICAgICAgIHRoaXMuYWRkSW5mb0J1YmJsZShtYXJrZXIpO1xyXG4gICAgICAgIFxyXG4gICAgICAgIHJldHVybiBtYXJrZXI7XHJcbiAgICB9XHJcbiAgICBcclxuICAgIGZ1bmN0aW9uIGdldEljb24oKXtcclxuICAgICAgICB2YXIgaWNvbiA9IHRoaXMucGxhY2UubWFya3VwO1xyXG4gICAgICAgICBpZighaWNvbilcclxuICAgICAgICAgICAgdGhyb3cgbmV3IEVycm9yKCdtYXJrdXAgbWlzc2VkJyk7XHJcblxyXG4gICAgICAgIHJldHVybiBuZXcgSC5tYXAuSWNvbihpY29uKTtcclxuICAgIH1cclxufSIsIm1vZHVsZS5leHBvcnRzID0gYW5ndWxhci5tb2R1bGUoJ2hlcmVtYXBzLXJvdXRlcy1tb2R1bGUnLCBbXSlcclxuICAgICAgICAgICAgICAgICAgICAuc2VydmljZSgnSGVyZU1hcHNSb3V0ZXNTZXJ2aWNlJywgcmVxdWlyZSgnLi9yb3V0ZXMuc2VydmljZS5qcycpKTsgICIsIm1vZHVsZS5leHBvcnRzID0gSGVyZU1hcHNSb3V0ZXNTZXJ2aWNlO1xyXG5cclxuSGVyZU1hcHNSb3V0ZXNTZXJ2aWNlLiRpbmplY3QgPSBbJyRxJywgJ0hlcmVNYXBzTWFya2VyU2VydmljZSddO1xyXG5mdW5jdGlvbiBIZXJlTWFwc1JvdXRlc1NlcnZpY2UoJHEsIEhlcmVNYXBzTWFya2VyU2VydmljZSkge1xyXG4gICAgcmV0dXJuIHtcclxuICAgICAgICBjYWxjdWxhdGVSb3V0ZTogY2FsY3VsYXRlUm91dGUsXHJcbiAgICAgICAgYWRkUm91dGVUb01hcDogYWRkUm91dGVUb01hcCxcclxuICAgICAgICBjbGVhblJvdXRlczogY2xlYW5Sb3V0ZXNcclxuICAgIH1cclxuXHJcbiAgICBmdW5jdGlvbiBjYWxjdWxhdGVSb3V0ZShoZXJlbWFwcywgY29uZmlnKSB7XHJcbiAgICAgICAgdmFyIHBsYXRmb3JtID0gaGVyZW1hcHMucGxhdGZvcm0sXHJcbiAgICAgICAgICAgIG1hcCA9IGhlcmVtYXBzLm1hcCxcclxuICAgICAgICAgICAgcm91dGVyID0gcGxhdGZvcm0uZ2V0Um91dGluZ1NlcnZpY2UoKSxcclxuICAgICAgICAgICAgZGlyID0gY29uZmlnLmRpcmVjdGlvbixcclxuICAgICAgICAgICAgd2F5cG9pbnRzID0gZGlyLndheXBvaW50cztcclxuXHJcbiAgICAgICAgdmFyIG1vZGUgPSAne3tNT0RFfX07e3tWRUNISUxFfX0nXHJcbiAgICAgICAgICAgIC5yZXBsYWNlKC97e01PREV9fS8sIGRpci5tb2RlIHx8ICdmYXN0ZXN0JylcclxuICAgICAgICAgICAgLnJlcGxhY2UoL3t7VkVDSElMRX19LywgY29uZmlnLmRyaXZlVHlwZSk7XHJcblxyXG4gICAgICAgIHZhciByb3V0ZVJlcXVlc3RQYXJhbXMgPSB7XHJcbiAgICAgICAgICAgIG1vZGU6IG1vZGUsXHJcbiAgICAgICAgICAgIHJlcHJlc2VudGF0aW9uOiBkaXIucmVwcmVzZW50YXRpb24gfHwgJ2Rpc3BsYXknLFxyXG4gICAgICAgICAgICBsYW5ndWFnZTogZGlyLmxhbmd1YWdlIHx8ICdlbi1nYidcclxuICAgICAgICB9O1xyXG5cclxuICAgICAgICB3YXlwb2ludHMuZm9yRWFjaChmdW5jdGlvbiAod2F5cG9pbnQsIGkpIHtcclxuICAgICAgICAgICAgcm91dGVSZXF1ZXN0UGFyYW1zW1wid2F5cG9pbnRcIiArIGldID0gW3dheXBvaW50LmxhdCwgd2F5cG9pbnQubG5nXS5qb2luKCcsJyk7XHJcbiAgICAgICAgfSk7XHJcblxyXG4gICAgICAgIF9zZXRBdHRyaWJ1dGVzKHJvdXRlUmVxdWVzdFBhcmFtcywgZGlyLmF0dHJzKTtcclxuXHJcbiAgICAgICAgdmFyIGRlZmVycmVkID0gJHEuZGVmZXIoKTtcclxuXHJcbiAgICAgICAgcm91dGVyLmNhbGN1bGF0ZVJvdXRlKHJvdXRlUmVxdWVzdFBhcmFtcywgZnVuY3Rpb24gKHJlc3VsdCkge1xyXG4gICAgICAgICAgICBkZWZlcnJlZC5yZXNvbHZlKHJlc3VsdCk7XHJcbiAgICAgICAgfSwgZnVuY3Rpb24gKGVycm9yKSB7XHJcbiAgICAgICAgICAgIGRlZmVycmVkLnJlamVjdChlcnJvcik7XHJcbiAgICAgICAgfSk7XHJcblxyXG4gICAgICAgIHJldHVybiBkZWZlcnJlZC5wcm9taXNlO1xyXG4gICAgfVxyXG5cclxuICAgIGZ1bmN0aW9uIGNsZWFuUm91dGVzKG1hcCkge1xyXG4gICAgICAgIHZhciBncm91cCA9IG1hcC5yb3V0ZXNHcm91cDtcclxuXHJcbiAgICAgICAgaWYgKCFncm91cClcclxuICAgICAgICAgICAgcmV0dXJuO1xyXG5cclxuICAgICAgICBncm91cC5yZW1vdmVBbGwoKTtcclxuICAgICAgICBtYXAucmVtb3ZlT2JqZWN0KGdyb3VwKTtcclxuICAgICAgICBtYXAucm91dGVzR3JvdXAgPSBudWxsO1xyXG4gICAgfVxyXG5cclxuICAgIGZ1bmN0aW9uIGFkZFJvdXRlVG9NYXAobWFwLCByb3V0ZURhdGEsIGNsZWFuKSB7XHJcbiAgICAgICAgaWYgKGNsZWFuKVxyXG4gICAgICAgICAgICBjbGVhblJvdXRlcyhtYXApO1xyXG5cclxuICAgICAgICB2YXIgcm91dGUgPSByb3V0ZURhdGEucm91dGU7XHJcblxyXG4gICAgICAgIGlmICghbWFwIHx8ICFyb3V0ZSB8fCAhcm91dGUuc2hhcGUpXHJcbiAgICAgICAgICAgIHJldHVybjtcclxuXHJcbiAgICAgICAgdmFyIHN0cmlwID0gbmV3IEguZ2VvLlN0cmlwKCksIHBvbHlsaW5lID0gbnVsbDtcclxuXHJcbiAgICAgICAgcm91dGUuc2hhcGUuZm9yRWFjaChmdW5jdGlvbiAocG9pbnQpIHtcclxuICAgICAgICAgICAgdmFyIHBhcnRzID0gcG9pbnQuc3BsaXQoJywnKTtcclxuICAgICAgICAgICAgc3RyaXAucHVzaExhdExuZ0FsdChwYXJ0c1swXSwgcGFydHNbMV0pO1xyXG4gICAgICAgIH0pO1xyXG5cclxuICAgICAgICB2YXIgc3R5bGUgPSByb3V0ZURhdGEuc3R5bGUgfHwge307XHJcblxyXG4gICAgICAgIHBvbHlsaW5lID0gbmV3IEgubWFwLlBvbHlsaW5lKHN0cmlwLCB7XHJcbiAgICAgICAgICAgIHN0eWxlOiB7XHJcbiAgICAgICAgICAgICAgICBsaW5lV2lkdGg6IHN0eWxlLmxpbmVXaWR0aCB8fCA0LFxyXG4gICAgICAgICAgICAgICAgc3Ryb2tlQ29sb3I6IHN0eWxlLmNvbG9yIHx8ICdyZ2JhKDAsIDEyOCwgMjU1LCAwLjcpJ1xyXG4gICAgICAgICAgICB9XHJcbiAgICAgICAgfSk7XHJcblxyXG4gICAgICAgIHZhciBncm91cCA9IG1hcC5yb3V0ZXNHcm91cDtcclxuXHJcbiAgICAgICAgaWYgKCFncm91cCkge1xyXG4gICAgICAgICAgICBncm91cCA9IG1hcC5yb3V0ZXNHcm91cCA9IG5ldyBILm1hcC5Hcm91cCgpO1xyXG4gICAgICAgICAgICBtYXAuYWRkT2JqZWN0KGdyb3VwKTtcclxuICAgICAgICB9XHJcblxyXG4gICAgICAgIGdyb3VwLmFkZE9iamVjdChwb2x5bGluZSk7XHJcblxyXG4gICAgICAgIGlmKHJvdXRlRGF0YS56b29tVG9Cb3VuZHMpIHtcclxuICAgICAgICAgICAgSGVyZU1hcHNNYXJrZXJTZXJ2aWNlLnNldFZpZXdCb3VuZHMobWFwLCBwb2x5bGluZS5nZXRCb3VuZHMoKSwgdHJ1ZSk7XHJcbiAgICAgICAgfVxyXG4gICAgfVxyXG5cclxuICAgIC8vI3JlZ2lvbiBQUklWQVRFXHJcblxyXG4gICAgZnVuY3Rpb24gX3NldEF0dHJpYnV0ZXMocGFyYW1zLCBhdHRycykge1xyXG4gICAgICAgIHZhciBfa2V5ID0gJ2F0dHJpYnV0ZXMnO1xyXG4gICAgICAgIGZvciAodmFyIGtleSBpbiBhdHRycykge1xyXG4gICAgICAgICAgICBpZiAoIWF0dHJzLmhhc093blByb3BlcnR5KGtleSkpXHJcbiAgICAgICAgICAgICAgICBjb250aW51ZTtcclxuXHJcbiAgICAgICAgICAgIHBhcmFtc1trZXkgKyBfa2V5XSA9IGF0dHJzW2tleV07XHJcbiAgICAgICAgfVxyXG4gICAgfVxyXG5cclxuICAgIC8qKlxyXG4gICAgICogQ3JlYXRlcyBhIHNlcmllcyBvZiBILm1hcC5NYXJrZXIgcG9pbnRzIGZyb20gdGhlIHJvdXRlIGFuZCBhZGRzIHRoZW0gdG8gdGhlIG1hcC5cclxuICAgICAqIEBwYXJhbSB7T2JqZWN0fSByb3V0ZSAgQSByb3V0ZSBhcyByZWNlaXZlZCBmcm9tIHRoZSBILnNlcnZpY2UuUm91dGluZ1NlcnZpY2VcclxuICAgICAqL1xyXG4gICAgZnVuY3Rpb24gYWRkTWFudWV2ZXJzVG9NYXAobWFwLCByb3V0ZSkge1xyXG4gICAgICAgIHZhciBzdmdNYXJrdXAgPSAnPHN2ZyB3aWR0aD1cIjE4XCIgaGVpZ2h0PVwiMThcIiAnICtcclxuICAgICAgICAgICAgJ3htbG5zPVwiaHR0cDovL3d3dy53My5vcmcvMjAwMC9zdmdcIj4nICtcclxuICAgICAgICAgICAgJzxjaXJjbGUgY3g9XCI4XCIgY3k9XCI4XCIgcj1cIjhcIiAnICtcclxuICAgICAgICAgICAgJ2ZpbGw9XCIjMWI0NjhkXCIgc3Ryb2tlPVwid2hpdGVcIiBzdHJva2Utd2lkdGg9XCIxXCIgIC8+JyArXHJcbiAgICAgICAgICAgICc8L3N2Zz4nLFxyXG4gICAgICAgICAgICBkb3RJY29uID0gbmV3IEgubWFwLkljb24oc3ZnTWFya3VwLCB7IGFuY2hvcjogeyB4OiA4LCB5OiA4IH0gfSksXHJcbiAgICAgICAgICAgIGdyb3VwID0gbmV3IEgubWFwLkdyb3VwKCksIGksIGo7XHJcblxyXG4gICAgICAgIC8vIEFkZCBhIG1hcmtlciBmb3IgZWFjaCBtYW5ldXZlclxyXG4gICAgICAgIGZvciAoaSA9IDA7IGkgPCByb3V0ZS5sZWcubGVuZ3RoOyBpICs9IDEpIHtcclxuICAgICAgICAgICAgZm9yIChqID0gMDsgaiA8IHJvdXRlLmxlZ1tpXS5tYW5ldXZlci5sZW5ndGg7IGogKz0gMSkge1xyXG4gICAgICAgICAgICAgICAgLy8gR2V0IHRoZSBuZXh0IG1hbmV1dmVyLlxyXG4gICAgICAgICAgICAgICAgbWFuZXV2ZXIgPSByb3V0ZS5sZWdbaV0ubWFuZXV2ZXJbal07XHJcbiAgICAgICAgICAgICAgICAvLyBBZGQgYSBtYXJrZXIgdG8gdGhlIG1hbmV1dmVycyBncm91cFxyXG4gICAgICAgICAgICAgICAgdmFyIG1hcmtlciA9IG5ldyBILm1hcC5NYXJrZXIoe1xyXG4gICAgICAgICAgICAgICAgICAgIGxhdDogbWFuZXV2ZXIucG9zaXRpb24ubGF0aXR1ZGUsXHJcbiAgICAgICAgICAgICAgICAgICAgbG5nOiBtYW5ldXZlci5wb3NpdGlvbi5sb25naXR1ZGVcclxuICAgICAgICAgICAgICAgIH0sXHJcbiAgICAgICAgICAgICAgICAgICAgeyBpY29uOiBkb3RJY29uIH1cclxuICAgICAgICAgICAgICAgICk7XHJcblxyXG4gICAgICAgICAgICAgICAgbWFya2VyLmluc3RydWN0aW9uID0gbWFuZXV2ZXIuaW5zdHJ1Y3Rpb247XHJcbiAgICAgICAgICAgICAgICBncm91cC5hZGRPYmplY3QobWFya2VyKTtcclxuICAgICAgICAgICAgfVxyXG4gICAgICAgIH1cclxuXHJcbiAgICAgICAgZ3JvdXAuYWRkRXZlbnRMaXN0ZW5lcigndGFwJywgZnVuY3Rpb24gKGV2dCkge1xyXG4gICAgICAgICAgICBtYXAuc2V0Q2VudGVyKGV2dC50YXJnZXQuZ2V0UG9zaXRpb24oKSk7XHJcbiAgICAgICAgICAgIG9wZW5CdWJibGUoZXZ0LnRhcmdldC5nZXRQb3NpdGlvbigpLCBldnQudGFyZ2V0Lmluc3RydWN0aW9uKTtcclxuICAgICAgICB9LCBmYWxzZSk7XHJcblxyXG4gICAgICAgIC8vIEFkZCB0aGUgbWFuZXV2ZXJzIGdyb3VwIHRvIHRoZSBtYXBcclxuICAgICAgICBtYXAuYWRkT2JqZWN0KGdyb3VwKTtcclxuICAgIH1cclxuXHJcblxyXG4gICAgLyoqXHJcbiAgICAgKiBDcmVhdGVzIGEgc2VyaWVzIG9mIEgubWFwLk1hcmtlciBwb2ludHMgZnJvbSB0aGUgcm91dGUgYW5kIGFkZHMgdGhlbSB0byB0aGUgbWFwLlxyXG4gICAgICogQHBhcmFtIHtPYmplY3R9IHJvdXRlICBBIHJvdXRlIGFzIHJlY2VpdmVkIGZyb20gdGhlIEguc2VydmljZS5Sb3V0aW5nU2VydmljZVxyXG4gICAgICovXHJcbiAgICBmdW5jdGlvbiBhZGRXYXlwb2ludHNUb1BhbmVsKHdheXBvaW50cykge1xyXG4gICAgICAgIHZhciBub2RlSDMgPSBkb2N1bWVudC5jcmVhdGVFbGVtZW50KCdoMycpLFxyXG4gICAgICAgICAgICB3YXlwb2ludExhYmVscyA9IFtdLFxyXG4gICAgICAgICAgICBpO1xyXG5cclxuICAgICAgICBmb3IgKGkgPSAwOyBpIDwgd2F5cG9pbnRzLmxlbmd0aDsgaSArPSAxKSB7XHJcbiAgICAgICAgICAgIHdheXBvaW50TGFiZWxzLnB1c2god2F5cG9pbnRzW2ldLmxhYmVsKVxyXG4gICAgICAgIH1cclxuXHJcbiAgICAgICAgbm9kZUgzLnRleHRDb250ZW50ID0gd2F5cG9pbnRMYWJlbHMuam9pbignIC0gJyk7XHJcblxyXG4gICAgICAgIHJvdXRlSW5zdHJ1Y3Rpb25zQ29udGFpbmVyLmlubmVySFRNTCA9ICcnO1xyXG4gICAgICAgIHJvdXRlSW5zdHJ1Y3Rpb25zQ29udGFpbmVyLmFwcGVuZENoaWxkKG5vZGVIMyk7XHJcbiAgICB9XHJcblxyXG4gICAgLyoqXHJcbiAgICAgKiBDcmVhdGVzIGEgc2VyaWVzIG9mIEgubWFwLk1hcmtlciBwb2ludHMgZnJvbSB0aGUgcm91dGUgYW5kIGFkZHMgdGhlbSB0byB0aGUgbWFwLlxyXG4gICAgICogQHBhcmFtIHtPYmplY3R9IHJvdXRlICBBIHJvdXRlIGFzIHJlY2VpdmVkIGZyb20gdGhlIEguc2VydmljZS5Sb3V0aW5nU2VydmljZVxyXG4gICAgICovXHJcbiAgICBmdW5jdGlvbiBhZGRTdW1tYXJ5VG9QYW5lbChzdW1tYXJ5KSB7XHJcbiAgICAgICAgdmFyIHN1bW1hcnlEaXYgPSBkb2N1bWVudC5jcmVhdGVFbGVtZW50KCdkaXYnKSxcclxuICAgICAgICAgICAgY29udGVudCA9ICcnO1xyXG5cclxuICAgICAgICBjb250ZW50ICs9ICc8Yj5Ub3RhbCBkaXN0YW5jZTwvYj46ICcgKyBzdW1tYXJ5LmRpc3RhbmNlICsgJ20uIDxici8+JztcclxuICAgICAgICBjb250ZW50ICs9ICc8Yj5UcmF2ZWwgVGltZTwvYj46ICcgKyBzdW1tYXJ5LnRyYXZlbFRpbWUudG9NTVNTKCkgKyAnIChpbiBjdXJyZW50IHRyYWZmaWMpJztcclxuXHJcblxyXG4gICAgICAgIHN1bW1hcnlEaXYuc3R5bGUuZm9udFNpemUgPSAnc21hbGwnO1xyXG4gICAgICAgIHN1bW1hcnlEaXYuc3R5bGUubWFyZ2luTGVmdCA9ICc1JSc7XHJcbiAgICAgICAgc3VtbWFyeURpdi5zdHlsZS5tYXJnaW5SaWdodCA9ICc1JSc7XHJcbiAgICAgICAgc3VtbWFyeURpdi5pbm5lckhUTUwgPSBjb250ZW50O1xyXG4gICAgICAgIHJvdXRlSW5zdHJ1Y3Rpb25zQ29udGFpbmVyLmFwcGVuZENoaWxkKHN1bW1hcnlEaXYpO1xyXG4gICAgfVxyXG5cclxuICAgIC8qKlxyXG4gICAgICogQ3JlYXRlcyBhIHNlcmllcyBvZiBILm1hcC5NYXJrZXIgcG9pbnRzIGZyb20gdGhlIHJvdXRlIGFuZCBhZGRzIHRoZW0gdG8gdGhlIG1hcC5cclxuICAgICAqIEBwYXJhbSB7T2JqZWN0fSByb3V0ZSAgQSByb3V0ZSBhcyByZWNlaXZlZCBmcm9tIHRoZSBILnNlcnZpY2UuUm91dGluZ1NlcnZpY2VcclxuICAgICAqL1xyXG4gICAgZnVuY3Rpb24gYWRkTWFudWV2ZXJzVG9QYW5lbChyb3V0ZSkge1xyXG4gICAgICAgIHZhciBub2RlT0wgPSBkb2N1bWVudC5jcmVhdGVFbGVtZW50KCdvbCcpLCBpLCBqO1xyXG5cclxuICAgICAgICBub2RlT0wuc3R5bGUuZm9udFNpemUgPSAnc21hbGwnO1xyXG4gICAgICAgIG5vZGVPTC5zdHlsZS5tYXJnaW5MZWZ0ID0gJzUlJztcclxuICAgICAgICBub2RlT0wuc3R5bGUubWFyZ2luUmlnaHQgPSAnNSUnO1xyXG4gICAgICAgIG5vZGVPTC5jbGFzc05hbWUgPSAnZGlyZWN0aW9ucyc7XHJcblxyXG4gICAgICAgIC8vIEFkZCBhIG1hcmtlciBmb3IgZWFjaCBtYW5ldXZlclxyXG4gICAgICAgIGZvciAoaSA9IDA7IGkgPCByb3V0ZS5sZWcubGVuZ3RoOyBpICs9IDEpIHtcclxuICAgICAgICAgICAgZm9yIChqID0gMDsgaiA8IHJvdXRlLmxlZ1tpXS5tYW5ldXZlci5sZW5ndGg7IGogKz0gMSkge1xyXG4gICAgICAgICAgICAgICAgLy8gR2V0IHRoZSBuZXh0IG1hbmV1dmVyLlxyXG4gICAgICAgICAgICAgICAgbWFuZXV2ZXIgPSByb3V0ZS5sZWdbaV0ubWFuZXV2ZXJbal07XHJcblxyXG4gICAgICAgICAgICAgICAgdmFyIGxpID0gZG9jdW1lbnQuY3JlYXRlRWxlbWVudCgnbGknKSxcclxuICAgICAgICAgICAgICAgICAgICBzcGFuQXJyb3cgPSBkb2N1bWVudC5jcmVhdGVFbGVtZW50KCdzcGFuJyksXHJcbiAgICAgICAgICAgICAgICAgICAgc3Bhbkluc3RydWN0aW9uID0gZG9jdW1lbnQuY3JlYXRlRWxlbWVudCgnc3BhbicpO1xyXG5cclxuICAgICAgICAgICAgICAgIHNwYW5BcnJvdy5jbGFzc05hbWUgPSAnYXJyb3cgJyArIG1hbmV1dmVyLmFjdGlvbjtcclxuICAgICAgICAgICAgICAgIHNwYW5JbnN0cnVjdGlvbi5pbm5lckhUTUwgPSBtYW5ldXZlci5pbnN0cnVjdGlvbjtcclxuICAgICAgICAgICAgICAgIGxpLmFwcGVuZENoaWxkKHNwYW5BcnJvdyk7XHJcbiAgICAgICAgICAgICAgICBsaS5hcHBlbmRDaGlsZChzcGFuSW5zdHJ1Y3Rpb24pO1xyXG5cclxuICAgICAgICAgICAgICAgIG5vZGVPTC5hcHBlbmRDaGlsZChsaSk7XHJcbiAgICAgICAgICAgIH1cclxuICAgICAgICB9XHJcblxyXG4gICAgICAgIHJvdXRlSW5zdHJ1Y3Rpb25zQ29udGFpbmVyLmFwcGVuZENoaWxkKG5vZGVPTCk7XHJcbiAgICB9XHJcblxyXG59O1xyXG4iXX0=
