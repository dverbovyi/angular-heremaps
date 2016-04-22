(function e(t,n,r){function s(o,u){if(!n[o]){if(!t[o]){var a=typeof require=="function"&&require;if(!u&&a)return a(o,!0);if(i)return i(o,!0);var f=new Error("Cannot find module '"+o+"'");throw f.code="MODULE_NOT_FOUND",f}var l=n[o]={exports:{}};t[o][0].call(l.exports,function(e){var n=t[o][1][e];return s(n?n:e)},l,l.exports,e,t,n,r)}return n[o].exports}var i=typeof require=="function"&&require;for(var o=0;o<r.length;o++)s(r[o]);return s})({1:[function(require,module,exports){
/**
 * Created by Dmytro on 4/11/2016.
 */
module.exports = function(
    $window,
    $rootScope,
    Config,
    APIService,
    UtilsService,
    MarkersService,
    CONSTS) {
    return {
        restrict: 'EA',
        template: "<div ng-style=\"{'width': mapWidth, 'height': mapHeight}\"></div>",
        replace: true,
        scope: {
            opts: '=options',
            places: '=',
            onMapReady: "=mapReady"
        },
        controller: function($scope, $element, $attrs) {
            var options = angular.extend({}, CONSTS.DEFAULT_MAP_OPTIONS, $scope.opts),
                position = options.coords;

            $scope.modules = {
                controls: !!$attrs.$attr.controls,
                pano: !!$attrs.$attr.pano,
                events: !!$attrs.$attr.events
            };

            $scope.heremaps = {};
            
            APIService.loadApi().then(_apiReady);

            _setMapSize();

            // var _resizeMap = UtilsService.throttle(_resizeHandler, CONSTS.UPDATE_MAP_RESIZE_TIMEOUT);
            // $window.addEventListener('resize', _resizeMap);

            $scope.$on('$destory', function() {
                $window.removeEventListener('resize', _resizeMap);
            });


            function _apiReady() {
                _setupMapPlatform();

                _getLocation()
                    .then(function(response) {
                        _setupMap({
                            longitude: response.coords.longitude,
                            latitude: response.coords.latitude
                        });
                    })
                    .catch(_locationFailure);
            }

            function _setupMapPlatform() {
                $scope.heremaps.platform = new H.service.Platform(Config);
                $scope.heremaps.layers = $scope.heremaps.platform.createDefaultLayers();
            }

            function _getLocation() {
                return APIService.getPosition({
                    coords: position,
                    enableHighAccuracy: true,
                    maximumAge: 10000
                });
            }
            
            function _locationFailure(){
                console.error('Can\'t get a position', error);
            }

            function _setupMap(coords) {
                if (coords)
                    position = coords;

                _initMap(function() {
                    APIService.loadModules($attrs.$attr, {
                        "controls": _uiModuleReady,
                        "events": _eventsModuleReady,
                        "pano": _panoModuleReady
                    });
                });

                _addEventListeners();

            }

            function _initMap(cb) {
                var map = $scope.heremaps.map = new H.Map($element[0], $scope.heremaps.layers.normal.map, {
                    zoom: options.zoom,
                    center: new H.geo.Point(position.latitude, position.longitude)
                });

                $scope.onMapReady && $scope.onMapReady(MapProxy());

                cb && cb();
            }

            function _navigate(coords) {
                if (!$scope.heremaps.map)
                    _setupMap(coords)
            }

            function _addEventListeners() {
                $rootScope.$on(CONSTS.MAP_EVENTS.RELOAD, function(e, coords) {
                    _initMap();
                });

                $rootScope.$on(CONSTS.MAP_EVENTS.NAVIGATE, function(e, coords) {
                    position = coords;
                    $scope.heremaps.map.setCenter(coords);
                });
            }

            function _uiModuleReady() {
                $scope.heremaps.ui = H.ui.UI.createDefault($scope.heremaps.map, $scope.heremaps.layers);
            }

            function _panoModuleReady() {
                //$scope.heremaps.platform.configure(H.map.render.panorama.RenderEngine);
            }

            function _eventsModuleReady() {
                var map = $scope.heremaps.map,
                    events = $scope.heremaps.mapEvents = new H.mapevents.MapEvents(map),
                    behavior = $scope.heremaps.behavior = new H.mapevents.Behavior(events);

                map.addEventListener('tap', function(evt) {
                    // console.log(evt.type, evt.currentPointer.type);
                });

                map.addEventListener('dragstart', function(ev) {
                    var target = ev.target;
                    if (target instanceof H.map.Marker) {
                        behavior.disable();
                    }
                }, false);

                map.addEventListener('drag', function(ev) {
                    var target = ev.target,
                        pointer = ev.currentPointer;
                    if (target instanceof mapsjs.map.Marker) {
                        target.setPosition(map.screenToGeo(pointer.viewportX, pointer.viewportY));
                    }
                }, false);

                map.addEventListener('dragend', function(ev) {
                    var target = ev.target;
                    if (target instanceof mapsjs.map.Marker) {
                        behavior.enable();
                    }
                }, false);

                map.draggable = options.draggable;

                MarkersService.addMarkerToMap($scope.heremaps.map, $scope.places);

            }

            function _resizeHandler() {
                _setMapSize();

                $scope.heremaps.map.getViewPort().resize();
            }

            function _setMapSize() {
                $scope.mapHeight = options.height + 'px';
                $scope.mapWidth = options.width + 'px';

                UtilsService.runScopeDigestIfNeed($scope);
            }
            
            function MapProxy(){
                return {
                    getMap: function(){
                        return $scope.heremaps.map
                    },
                    setCenter: function(coords) {
                        if (!coords) {
                            return _getLocation()
                                .then(function(response){
                                    $scope.heremaps.map.setCenter({
                                        lng: response.coords.longitude,
                                        lat: response.coords.latitude
                                    });        
                                })
                                .catch(_locationFailure);
                        }

                        $scope.heremaps.map.setCenter(coords);        
                    }
                }
            }
            
        }
    }
};
},{}],2:[function(require,module,exports){
require('./providers/markers/markers.module');

var directive = require('./heremaps.directive'),
    configProvider = require('./providers/config.provider'),
    apiService = require('./providers/api.service'),
    utilsService = require('./providers/utils.service'),
    consts = require('./providers/consts');

var heremaps = angular.module('heremaps', [
    'markers-module'
]);

heremaps
    .provider('Config', configProvider)
    .service('APIService', ['$q', 'Config', 'UtilsService', 'CONSTS', apiService])
    .service('UtilsService', utilsService)
    .constant('CONSTS', consts)

heremaps.directive('heremaps', directive);

heremaps.config(["ConfigProvider", function(ConfigProvider) {
    ConfigProvider.setOptions({
        'apiVersion': '3.0',
        'app_id': 'wMHJuLgCQzkfbhzXIwRF',
        'app_code': 'WLIc7QzoO8irv7lurUt1qA',
        'useHTTPS': true
    });
}]);

module.exports = heremaps;
},{"./heremaps.directive":1,"./providers/api.service":3,"./providers/config.provider":4,"./providers/consts":5,"./providers/markers/markers.module":9,"./providers/utils.service":12}],3:[function(require,module,exports){
module.exports = function($q, Config, UtilsService, CONSTS) {
    var version = Config.apiVersion;

    var API_VERSION = {
        V: parseInt(version),
        SUB: version
    };

    var CONFIG = {
        BASE: "http://js.api.here.com/v",
        CORE: "mapsjs-core.js",
        SERVICE: "mapsjs-service.js",
        UI: {
            src: "mapsjs-ui.js",
            href: "mapsjs-ui.css"
        },
        PANO: "mapsjs-pano.js",
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
        getPosition: getPosition
    };

    //#region PUBLIC
    function loadApi() {
        return _getLoader(CONFIG.CORE)
            .then(function() {
                return _getLoader(CONFIG.SERVICE);
            });
    }
    
    function loadModules(attrs, handlers){
        for(var key in handlers) {
            if(!handlers.hasOwnProperty(key) || !attrs[key])
                continue;
                
            var loader = _getLoaderByAttr(key);
            loader()
                .then(handlers[key])
        }
    }
    
    function _getLoaderByAttr(attr){
        var loader;
        
        switch(attr) {
            case CONSTS.MODULES.UI:
                loader = loadUIModule;
                break;
            case CONSTS.MODULES.EVENTS:
                loader = loadEventsModule;
                break;
            case CONSTS.MODULES.PANO:
                loader = loadPanoModule;
                break;
            default:
                throw new Error('Unknown module', attr);
        }
        
        return loader;
    }

    function loadUIModule() {
        if (!_isLoaded(CONFIG.UI)) {
            var link = UtilsService.createLinkTag({
                rel: 'stylesheet',
                type: 'text/css',
                href: _getURL(CONFIG.UI.href)
            });

            link && head.appendChild(link);
        }

        return _getLoader(CONFIG.UI.src);
    }

    function loadPanoModule() {
        return _getLoader(CONFIG.PANO);
    }

    function loadEventsModule() {
        return _getLoader(CONFIG.EVENTS);
    }

    function getPosition(options) {
        var coordsExist = options.coords && (typeof options.coords.latitude === 'number' && typeof options.coords.longitude === 'number'); 

        var dererred = $q.defer();

        if(coordsExist) {
            dererred.resolve({coords: options.coords});
        } else {
            navigator.geolocation.getCurrentPosition(function(response) {
                dererred.resolve(response);
            }, function(error) {
                dererred.reject(error);
            }, options);
        } 
        
        return dererred.promise;
    }
    //#endregion PUBLIC


    //#region PRIVATE
    function _getURL(sourceName) {
        return [
            CONFIG.BASE,
            API_VERSION.V,
            "/",
            API_VERSION.SUB,
            "/",
            sourceName
        ].join("");
    }

    function _getLoader(sourceName) {
        var defer = $q.defer();
        return _isLoaded(sourceName) ? (function() {
            defer.resolve();
            return defer.promise;
        })() : (function() {
            var src = _getURL(sourceName),
                script = UtilsService.createScriptTag({ src: src });
                
            script && head.appendChild(script);
            
            API_DEFERSQueue[sourceName].push(defer);
            
            script.onload = _onLoad.bind(null, sourceName);
            script.onerror = _onError.bind(null, sourceName);

            return defer.promise;

        })();
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
            case CONFIG.PANO:
                checker = _isPanoLoaded;
                break;
            default:
                checker = function() { return false };
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

    function _isPanoLoaded() {
        return !!(window.H && window.H.pano);
    }
    
    function _onLoad(sourceName){
        var deferQueue = API_DEFERSQueue[sourceName];
        for(var i = 0, l = deferQueue.length; i < l; ++i) {
            var defer = deferQueue[i];
            defer.resolve();
        }
        
        API_DEFERSQueue[sourceName] = [];
    }
    
    function _onError(sourceName) {
        var deferQueue = API_DEFERSQueue[sourceName];
        for(var i = 0, l = deferQueue.length; i < l; ++i) {
            var defer = deferQueue[i];
            defer.reject();
        }
        
        API_DEFERSQueue[sourceName] = [];
    }
};
},{}],4:[function(require,module,exports){
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
},{}],5:[function(require,module,exports){
module.exports = {
    "UPDATE_MAP_RESIZE_TIMEOUT": 500,
    "MODULES": {
        UI: 'controls',
        EVENTS: 'events',
        PANO: 'pano'
    },
    "DEFAULT_MAP_OPTIONS": {
        height: 480,
        width: 640,
        zoom: 10,
        draggable: false
    },
    "MARKER_TYPES": {
        DOM: "DOM",
        SVG: "SVG"
    },
    "MAP_EVENTS": {
        NAVIGATE: "NAVIGATE",
        RELOAD: "RELOAD"
    }
}
},{}],6:[function(require,module,exports){
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
        return new H.map.Marker(this.coords);
    }
}
},{}],7:[function(require,module,exports){
module.exports = function(MarkerInterface){
    function DOMMarker(place){
        this.place = place;
        this.setCoords();
    }

    var proto = DOMMarker.prototype = new MarkerInterface();
    proto.constructor = DOMMarker;

    proto.create = create;
    proto._getIcon = _getIcon;
    proto._setupEvents = _setupEvents;
    proto._getEvents = _getEvents;

    return DOMMarker;
    
    function create(){
        return new H.map.DomMarker(this.coords, {
            icon: this._getIcon(),
        });
    }
    
    function _getIcon(){
        var icon = this.place.markup;
         if(!icon)
            throw new Error('markup missed');

        return new H.map.DomIcon(icon, this._getEvents());
    }
    
    function _setupEvents(el, events, remove){
        var method = remove ? 'removeEventListener' : 'addEventListener';

        for(var key in events) {
            if(!events.hasOwnProperty(key))
                continue;

            el[method].call(null, key, events[key]);
        }
    }
    
    function _getEvents(){
        var self = this,
            events = this.place.events;

        if(!this.place.events)
            return {};

        return {
            onAttach: function(clonedElement, domIcon, domMarker){
                self._setupEvents(clonedElement, events);
            },
            onDetach: function(clonedElement, domIcon, domMarker){
                self._setupEvents(clonedElement, events, true);
            }
        }
    }
}
},{}],8:[function(require,module,exports){
module.exports = function(){
    function MarkerInterface(){
        throw new Error('Abstract class! The Instance should be created');
    }
    
    var proto = MarkerInterface.prototype;
    
    proto.create = create;
    proto.setCoords = setCoords;
    
    function Marker(){};
    
    Marker.prototype = proto;
    
    return Marker;
    
    function create(){
        throw new Error('getInstance:: not implemented'); 
    }
    
    function setCoords(){
         this.coords = {
            lat: this.place.pos.lat,
            lng: this.place.pos.lng
        }
    }
    
}
},{}],9:[function(require,module,exports){
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
},{"./default.marker.js":6,"./dom.marker.js":7,"./marker.js":8,"./markers.service.js":10,"./svg.marker.js":11}],10:[function(require,module,exports){
module.exports = function(DefaultMarker, DOMMarker, SVGMarker, CONSTS) {
    
    var MARKER_TYPES = CONSTS.MARKER_TYPES;
    return {
        addMarkerToMap: addMarkerToMap
    }

    function addMarkerToMap(map, places) {
        if (!places || !places.length)
            return false;

        if (!(map instanceof H.Map))
            throw new Error('Unsupported map instance');

        places.forEach(function(place, i) {
            var creator = _getMarkerCreator(place);
            var marker = place.draggable ? _draggableMarkerMixin(creator.create()) : creator.create();

            map.addObject(marker);
        });

    }

    function _getMarkerCreator(place) {
        var ConcreteMarker;

        switch(place.type) {
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
},{}],11:[function(require,module,exports){
module.exports = function(MarkerInterface){
    function SVGMarker(place){
        this.place = place;
        this.setCoords();
    }
    
    var proto = SVGMarker.prototype = new MarkerInterface();
    
    proto.constructor = SVGMarker;
    
    proto.create = create;
    proto._getIcon = _getIcon;
    
    return SVGMarker;
    
    function create(){
        return new H.map.Marker(this.coords, {
            icon: this._getIcon(),
        });
    }
    
    function _getIcon(){
        var icon = this.place.markup;
         if(!icon)
            throw new Error('markup missed');

        return new H.map.Icon(icon);
    }
}
},{}],12:[function(require,module,exports){
module.exports = function($rootScope, $timeout){
    return {
        throttle: throttle,
        createScriptTag: createScriptTag,
        createLinkTag: createLinkTag,
        runScopeDigestIfNeed: runScopeDigestIfNeed
    };
    
    //#region PUBLIC
    function throttle(fn, period){
        var timeout = null;
        
        return function(){
            if($timeout)
                $timeout.cancel(timeout);
                
            timeout = $timeout(fn, period);
        }
    }
    
    function runScopeDigestIfNeed(scope, cb) {
        if (scope.$root && scope.$root.$$phase !== '$apply' && scope.$root.$$phase !== '$digest') {
            scope.$digest(cb || angular.noop);
            return true;
        }
        return false;
    }
    
    function createScriptTag(attrs){
        var script = document.getElementById(attrs.src);
        
        if(script)
            return false;
        
        script = document.createElement('script');
        script.type = 'text/javascript';
        script.id = attrs.src;
        _setAttrs(script, attrs);    

        return script;
    }

    function createLinkTag(attrs) {
        var link = document.getElementById(attrs.href);
        
        if(link)
            return false;
            
        link = document.createElement('link');
        link.id = attrs.href;
        _setAttrs(link, attrs);
        
        return link;
    }
    //#endregion PUBLIC 

    //#region PRIVATE
    function _setAttrs(el, attrs) {
        if(!el || !attrs)
            throw new Error('Missed attributes');

        for(var key in attrs) {
            if(!attrs.hasOwnProperty(key))
                continue;

            el[key] = attrs[key];
        }
    }
};
},{}]},{},[2])


//# sourceMappingURL=data:application/json;base64,eyJ2ZXJzaW9uIjozLCJzb3VyY2VzIjpbIm5vZGVfbW9kdWxlcy9icm93c2VyLXBhY2svX3ByZWx1ZGUuanMiLCJzcmMvaGVyZW1hcHMuZGlyZWN0aXZlLmpzIiwic3JjL2hlcmVtYXBzLm1vZHVsZS5qcyIsInNyYy9wcm92aWRlcnMvYXBpLnNlcnZpY2UuanMiLCJzcmMvcHJvdmlkZXJzL2NvbmZpZy5wcm92aWRlci5qcyIsInNyYy9wcm92aWRlcnMvY29uc3RzLmpzIiwic3JjL3Byb3ZpZGVycy9tYXJrZXJzL2RlZmF1bHQubWFya2VyLmpzIiwic3JjL3Byb3ZpZGVycy9tYXJrZXJzL2RvbS5tYXJrZXIuanMiLCJzcmMvcHJvdmlkZXJzL21hcmtlcnMvbWFya2VyLmpzIiwic3JjL3Byb3ZpZGVycy9tYXJrZXJzL21hcmtlcnMubW9kdWxlLmpzIiwic3JjL3Byb3ZpZGVycy9tYXJrZXJzL21hcmtlcnMuc2VydmljZS5qcyIsInNyYy9wcm92aWRlcnMvbWFya2Vycy9zdmcubWFya2VyLmpzIiwic3JjL3Byb3ZpZGVycy91dGlscy5zZXJ2aWNlLmpzIl0sIm5hbWVzIjpbXSwibWFwcGluZ3MiOiJBQUFBO0FDQUE7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTs7QUN2TUE7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBOztBQzdCQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7O0FDdk5BO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7O0FDaEJBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBOztBQ3JCQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBOztBQ2hCQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTs7QUN6REE7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7O0FDM0JBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBOztBQ3JCQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBOztBQzlDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBOztBQzVCQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0EiLCJmaWxlIjoiYW5ndWxhci1oZXJlbWFwcy5qcyIsInNvdXJjZVJvb3QiOiIvc291cmNlLyIsInNvdXJjZXNDb250ZW50IjpbIihmdW5jdGlvbiBlKHQsbixyKXtmdW5jdGlvbiBzKG8sdSl7aWYoIW5bb10pe2lmKCF0W29dKXt2YXIgYT10eXBlb2YgcmVxdWlyZT09XCJmdW5jdGlvblwiJiZyZXF1aXJlO2lmKCF1JiZhKXJldHVybiBhKG8sITApO2lmKGkpcmV0dXJuIGkobywhMCk7dmFyIGY9bmV3IEVycm9yKFwiQ2Fubm90IGZpbmQgbW9kdWxlICdcIitvK1wiJ1wiKTt0aHJvdyBmLmNvZGU9XCJNT0RVTEVfTk9UX0ZPVU5EXCIsZn12YXIgbD1uW29dPXtleHBvcnRzOnt9fTt0W29dWzBdLmNhbGwobC5leHBvcnRzLGZ1bmN0aW9uKGUpe3ZhciBuPXRbb11bMV1bZV07cmV0dXJuIHMobj9uOmUpfSxsLGwuZXhwb3J0cyxlLHQsbixyKX1yZXR1cm4gbltvXS5leHBvcnRzfXZhciBpPXR5cGVvZiByZXF1aXJlPT1cImZ1bmN0aW9uXCImJnJlcXVpcmU7Zm9yKHZhciBvPTA7bzxyLmxlbmd0aDtvKyspcyhyW29dKTtyZXR1cm4gc30pIiwiLyoqXHJcbiAqIENyZWF0ZWQgYnkgRG15dHJvIG9uIDQvMTEvMjAxNi5cclxuICovXHJcbm1vZHVsZS5leHBvcnRzID0gZnVuY3Rpb24oXHJcbiAgICAkd2luZG93LFxyXG4gICAgJHJvb3RTY29wZSxcclxuICAgIENvbmZpZyxcclxuICAgIEFQSVNlcnZpY2UsXHJcbiAgICBVdGlsc1NlcnZpY2UsXHJcbiAgICBNYXJrZXJzU2VydmljZSxcclxuICAgIENPTlNUUykge1xyXG4gICAgcmV0dXJuIHtcclxuICAgICAgICByZXN0cmljdDogJ0VBJyxcclxuICAgICAgICB0ZW1wbGF0ZTogXCI8ZGl2IG5nLXN0eWxlPVxcXCJ7J3dpZHRoJzogbWFwV2lkdGgsICdoZWlnaHQnOiBtYXBIZWlnaHR9XFxcIj48L2Rpdj5cIixcclxuICAgICAgICByZXBsYWNlOiB0cnVlLFxyXG4gICAgICAgIHNjb3BlOiB7XHJcbiAgICAgICAgICAgIG9wdHM6ICc9b3B0aW9ucycsXHJcbiAgICAgICAgICAgIHBsYWNlczogJz0nLFxyXG4gICAgICAgICAgICBvbk1hcFJlYWR5OiBcIj1tYXBSZWFkeVwiXHJcbiAgICAgICAgfSxcclxuICAgICAgICBjb250cm9sbGVyOiBmdW5jdGlvbigkc2NvcGUsICRlbGVtZW50LCAkYXR0cnMpIHtcclxuICAgICAgICAgICAgdmFyIG9wdGlvbnMgPSBhbmd1bGFyLmV4dGVuZCh7fSwgQ09OU1RTLkRFRkFVTFRfTUFQX09QVElPTlMsICRzY29wZS5vcHRzKSxcclxuICAgICAgICAgICAgICAgIHBvc2l0aW9uID0gb3B0aW9ucy5jb29yZHM7XHJcblxyXG4gICAgICAgICAgICAkc2NvcGUubW9kdWxlcyA9IHtcclxuICAgICAgICAgICAgICAgIGNvbnRyb2xzOiAhISRhdHRycy4kYXR0ci5jb250cm9scyxcclxuICAgICAgICAgICAgICAgIHBhbm86ICEhJGF0dHJzLiRhdHRyLnBhbm8sXHJcbiAgICAgICAgICAgICAgICBldmVudHM6ICEhJGF0dHJzLiRhdHRyLmV2ZW50c1xyXG4gICAgICAgICAgICB9O1xyXG5cclxuICAgICAgICAgICAgJHNjb3BlLmhlcmVtYXBzID0ge307XHJcbiAgICAgICAgICAgIFxyXG4gICAgICAgICAgICBBUElTZXJ2aWNlLmxvYWRBcGkoKS50aGVuKF9hcGlSZWFkeSk7XHJcblxyXG4gICAgICAgICAgICBfc2V0TWFwU2l6ZSgpO1xyXG5cclxuICAgICAgICAgICAgLy8gdmFyIF9yZXNpemVNYXAgPSBVdGlsc1NlcnZpY2UudGhyb3R0bGUoX3Jlc2l6ZUhhbmRsZXIsIENPTlNUUy5VUERBVEVfTUFQX1JFU0laRV9USU1FT1VUKTtcclxuICAgICAgICAgICAgLy8gJHdpbmRvdy5hZGRFdmVudExpc3RlbmVyKCdyZXNpemUnLCBfcmVzaXplTWFwKTtcclxuXHJcbiAgICAgICAgICAgICRzY29wZS4kb24oJyRkZXN0b3J5JywgZnVuY3Rpb24oKSB7XHJcbiAgICAgICAgICAgICAgICAkd2luZG93LnJlbW92ZUV2ZW50TGlzdGVuZXIoJ3Jlc2l6ZScsIF9yZXNpemVNYXApO1xyXG4gICAgICAgICAgICB9KTtcclxuXHJcblxyXG4gICAgICAgICAgICBmdW5jdGlvbiBfYXBpUmVhZHkoKSB7XHJcbiAgICAgICAgICAgICAgICBfc2V0dXBNYXBQbGF0Zm9ybSgpO1xyXG5cclxuICAgICAgICAgICAgICAgIF9nZXRMb2NhdGlvbigpXHJcbiAgICAgICAgICAgICAgICAgICAgLnRoZW4oZnVuY3Rpb24ocmVzcG9uc2UpIHtcclxuICAgICAgICAgICAgICAgICAgICAgICAgX3NldHVwTWFwKHtcclxuICAgICAgICAgICAgICAgICAgICAgICAgICAgIGxvbmdpdHVkZTogcmVzcG9uc2UuY29vcmRzLmxvbmdpdHVkZSxcclxuICAgICAgICAgICAgICAgICAgICAgICAgICAgIGxhdGl0dWRlOiByZXNwb25zZS5jb29yZHMubGF0aXR1ZGVcclxuICAgICAgICAgICAgICAgICAgICAgICAgfSk7XHJcbiAgICAgICAgICAgICAgICAgICAgfSlcclxuICAgICAgICAgICAgICAgICAgICAuY2F0Y2goX2xvY2F0aW9uRmFpbHVyZSk7XHJcbiAgICAgICAgICAgIH1cclxuXHJcbiAgICAgICAgICAgIGZ1bmN0aW9uIF9zZXR1cE1hcFBsYXRmb3JtKCkge1xyXG4gICAgICAgICAgICAgICAgJHNjb3BlLmhlcmVtYXBzLnBsYXRmb3JtID0gbmV3IEguc2VydmljZS5QbGF0Zm9ybShDb25maWcpO1xyXG4gICAgICAgICAgICAgICAgJHNjb3BlLmhlcmVtYXBzLmxheWVycyA9ICRzY29wZS5oZXJlbWFwcy5wbGF0Zm9ybS5jcmVhdGVEZWZhdWx0TGF5ZXJzKCk7XHJcbiAgICAgICAgICAgIH1cclxuXHJcbiAgICAgICAgICAgIGZ1bmN0aW9uIF9nZXRMb2NhdGlvbigpIHtcclxuICAgICAgICAgICAgICAgIHJldHVybiBBUElTZXJ2aWNlLmdldFBvc2l0aW9uKHtcclxuICAgICAgICAgICAgICAgICAgICBjb29yZHM6IHBvc2l0aW9uLFxyXG4gICAgICAgICAgICAgICAgICAgIGVuYWJsZUhpZ2hBY2N1cmFjeTogdHJ1ZSxcclxuICAgICAgICAgICAgICAgICAgICBtYXhpbXVtQWdlOiAxMDAwMFxyXG4gICAgICAgICAgICAgICAgfSk7XHJcbiAgICAgICAgICAgIH1cclxuICAgICAgICAgICAgXHJcbiAgICAgICAgICAgIGZ1bmN0aW9uIF9sb2NhdGlvbkZhaWx1cmUoKXtcclxuICAgICAgICAgICAgICAgIGNvbnNvbGUuZXJyb3IoJ0NhblxcJ3QgZ2V0IGEgcG9zaXRpb24nLCBlcnJvcik7XHJcbiAgICAgICAgICAgIH1cclxuXHJcbiAgICAgICAgICAgIGZ1bmN0aW9uIF9zZXR1cE1hcChjb29yZHMpIHtcclxuICAgICAgICAgICAgICAgIGlmIChjb29yZHMpXHJcbiAgICAgICAgICAgICAgICAgICAgcG9zaXRpb24gPSBjb29yZHM7XHJcblxyXG4gICAgICAgICAgICAgICAgX2luaXRNYXAoZnVuY3Rpb24oKSB7XHJcbiAgICAgICAgICAgICAgICAgICAgQVBJU2VydmljZS5sb2FkTW9kdWxlcygkYXR0cnMuJGF0dHIsIHtcclxuICAgICAgICAgICAgICAgICAgICAgICAgXCJjb250cm9sc1wiOiBfdWlNb2R1bGVSZWFkeSxcclxuICAgICAgICAgICAgICAgICAgICAgICAgXCJldmVudHNcIjogX2V2ZW50c01vZHVsZVJlYWR5LFxyXG4gICAgICAgICAgICAgICAgICAgICAgICBcInBhbm9cIjogX3Bhbm9Nb2R1bGVSZWFkeVxyXG4gICAgICAgICAgICAgICAgICAgIH0pO1xyXG4gICAgICAgICAgICAgICAgfSk7XHJcblxyXG4gICAgICAgICAgICAgICAgX2FkZEV2ZW50TGlzdGVuZXJzKCk7XHJcblxyXG4gICAgICAgICAgICB9XHJcblxyXG4gICAgICAgICAgICBmdW5jdGlvbiBfaW5pdE1hcChjYikge1xyXG4gICAgICAgICAgICAgICAgdmFyIG1hcCA9ICRzY29wZS5oZXJlbWFwcy5tYXAgPSBuZXcgSC5NYXAoJGVsZW1lbnRbMF0sICRzY29wZS5oZXJlbWFwcy5sYXllcnMubm9ybWFsLm1hcCwge1xyXG4gICAgICAgICAgICAgICAgICAgIHpvb206IG9wdGlvbnMuem9vbSxcclxuICAgICAgICAgICAgICAgICAgICBjZW50ZXI6IG5ldyBILmdlby5Qb2ludChwb3NpdGlvbi5sYXRpdHVkZSwgcG9zaXRpb24ubG9uZ2l0dWRlKVxyXG4gICAgICAgICAgICAgICAgfSk7XHJcblxyXG4gICAgICAgICAgICAgICAgJHNjb3BlLm9uTWFwUmVhZHkgJiYgJHNjb3BlLm9uTWFwUmVhZHkoTWFwUHJveHkoKSk7XHJcblxyXG4gICAgICAgICAgICAgICAgY2IgJiYgY2IoKTtcclxuICAgICAgICAgICAgfVxyXG5cclxuICAgICAgICAgICAgZnVuY3Rpb24gX25hdmlnYXRlKGNvb3Jkcykge1xyXG4gICAgICAgICAgICAgICAgaWYgKCEkc2NvcGUuaGVyZW1hcHMubWFwKVxyXG4gICAgICAgICAgICAgICAgICAgIF9zZXR1cE1hcChjb29yZHMpXHJcbiAgICAgICAgICAgIH1cclxuXHJcbiAgICAgICAgICAgIGZ1bmN0aW9uIF9hZGRFdmVudExpc3RlbmVycygpIHtcclxuICAgICAgICAgICAgICAgICRyb290U2NvcGUuJG9uKENPTlNUUy5NQVBfRVZFTlRTLlJFTE9BRCwgZnVuY3Rpb24oZSwgY29vcmRzKSB7XHJcbiAgICAgICAgICAgICAgICAgICAgX2luaXRNYXAoKTtcclxuICAgICAgICAgICAgICAgIH0pO1xyXG5cclxuICAgICAgICAgICAgICAgICRyb290U2NvcGUuJG9uKENPTlNUUy5NQVBfRVZFTlRTLk5BVklHQVRFLCBmdW5jdGlvbihlLCBjb29yZHMpIHtcclxuICAgICAgICAgICAgICAgICAgICBwb3NpdGlvbiA9IGNvb3JkcztcclxuICAgICAgICAgICAgICAgICAgICAkc2NvcGUuaGVyZW1hcHMubWFwLnNldENlbnRlcihjb29yZHMpO1xyXG4gICAgICAgICAgICAgICAgfSk7XHJcbiAgICAgICAgICAgIH1cclxuXHJcbiAgICAgICAgICAgIGZ1bmN0aW9uIF91aU1vZHVsZVJlYWR5KCkge1xyXG4gICAgICAgICAgICAgICAgJHNjb3BlLmhlcmVtYXBzLnVpID0gSC51aS5VSS5jcmVhdGVEZWZhdWx0KCRzY29wZS5oZXJlbWFwcy5tYXAsICRzY29wZS5oZXJlbWFwcy5sYXllcnMpO1xyXG4gICAgICAgICAgICB9XHJcblxyXG4gICAgICAgICAgICBmdW5jdGlvbiBfcGFub01vZHVsZVJlYWR5KCkge1xyXG4gICAgICAgICAgICAgICAgLy8kc2NvcGUuaGVyZW1hcHMucGxhdGZvcm0uY29uZmlndXJlKEgubWFwLnJlbmRlci5wYW5vcmFtYS5SZW5kZXJFbmdpbmUpO1xyXG4gICAgICAgICAgICB9XHJcblxyXG4gICAgICAgICAgICBmdW5jdGlvbiBfZXZlbnRzTW9kdWxlUmVhZHkoKSB7XHJcbiAgICAgICAgICAgICAgICB2YXIgbWFwID0gJHNjb3BlLmhlcmVtYXBzLm1hcCxcclxuICAgICAgICAgICAgICAgICAgICBldmVudHMgPSAkc2NvcGUuaGVyZW1hcHMubWFwRXZlbnRzID0gbmV3IEgubWFwZXZlbnRzLk1hcEV2ZW50cyhtYXApLFxyXG4gICAgICAgICAgICAgICAgICAgIGJlaGF2aW9yID0gJHNjb3BlLmhlcmVtYXBzLmJlaGF2aW9yID0gbmV3IEgubWFwZXZlbnRzLkJlaGF2aW9yKGV2ZW50cyk7XHJcblxyXG4gICAgICAgICAgICAgICAgbWFwLmFkZEV2ZW50TGlzdGVuZXIoJ3RhcCcsIGZ1bmN0aW9uKGV2dCkge1xyXG4gICAgICAgICAgICAgICAgICAgIC8vIGNvbnNvbGUubG9nKGV2dC50eXBlLCBldnQuY3VycmVudFBvaW50ZXIudHlwZSk7XHJcbiAgICAgICAgICAgICAgICB9KTtcclxuXHJcbiAgICAgICAgICAgICAgICBtYXAuYWRkRXZlbnRMaXN0ZW5lcignZHJhZ3N0YXJ0JywgZnVuY3Rpb24oZXYpIHtcclxuICAgICAgICAgICAgICAgICAgICB2YXIgdGFyZ2V0ID0gZXYudGFyZ2V0O1xyXG4gICAgICAgICAgICAgICAgICAgIGlmICh0YXJnZXQgaW5zdGFuY2VvZiBILm1hcC5NYXJrZXIpIHtcclxuICAgICAgICAgICAgICAgICAgICAgICAgYmVoYXZpb3IuZGlzYWJsZSgpO1xyXG4gICAgICAgICAgICAgICAgICAgIH1cclxuICAgICAgICAgICAgICAgIH0sIGZhbHNlKTtcclxuXHJcbiAgICAgICAgICAgICAgICBtYXAuYWRkRXZlbnRMaXN0ZW5lcignZHJhZycsIGZ1bmN0aW9uKGV2KSB7XHJcbiAgICAgICAgICAgICAgICAgICAgdmFyIHRhcmdldCA9IGV2LnRhcmdldCxcclxuICAgICAgICAgICAgICAgICAgICAgICAgcG9pbnRlciA9IGV2LmN1cnJlbnRQb2ludGVyO1xyXG4gICAgICAgICAgICAgICAgICAgIGlmICh0YXJnZXQgaW5zdGFuY2VvZiBtYXBzanMubWFwLk1hcmtlcikge1xyXG4gICAgICAgICAgICAgICAgICAgICAgICB0YXJnZXQuc2V0UG9zaXRpb24obWFwLnNjcmVlblRvR2VvKHBvaW50ZXIudmlld3BvcnRYLCBwb2ludGVyLnZpZXdwb3J0WSkpO1xyXG4gICAgICAgICAgICAgICAgICAgIH1cclxuICAgICAgICAgICAgICAgIH0sIGZhbHNlKTtcclxuXHJcbiAgICAgICAgICAgICAgICBtYXAuYWRkRXZlbnRMaXN0ZW5lcignZHJhZ2VuZCcsIGZ1bmN0aW9uKGV2KSB7XHJcbiAgICAgICAgICAgICAgICAgICAgdmFyIHRhcmdldCA9IGV2LnRhcmdldDtcclxuICAgICAgICAgICAgICAgICAgICBpZiAodGFyZ2V0IGluc3RhbmNlb2YgbWFwc2pzLm1hcC5NYXJrZXIpIHtcclxuICAgICAgICAgICAgICAgICAgICAgICAgYmVoYXZpb3IuZW5hYmxlKCk7XHJcbiAgICAgICAgICAgICAgICAgICAgfVxyXG4gICAgICAgICAgICAgICAgfSwgZmFsc2UpO1xyXG5cclxuICAgICAgICAgICAgICAgIG1hcC5kcmFnZ2FibGUgPSBvcHRpb25zLmRyYWdnYWJsZTtcclxuXHJcbiAgICAgICAgICAgICAgICBNYXJrZXJzU2VydmljZS5hZGRNYXJrZXJUb01hcCgkc2NvcGUuaGVyZW1hcHMubWFwLCAkc2NvcGUucGxhY2VzKTtcclxuXHJcbiAgICAgICAgICAgIH1cclxuXHJcbiAgICAgICAgICAgIGZ1bmN0aW9uIF9yZXNpemVIYW5kbGVyKCkge1xyXG4gICAgICAgICAgICAgICAgX3NldE1hcFNpemUoKTtcclxuXHJcbiAgICAgICAgICAgICAgICAkc2NvcGUuaGVyZW1hcHMubWFwLmdldFZpZXdQb3J0KCkucmVzaXplKCk7XHJcbiAgICAgICAgICAgIH1cclxuXHJcbiAgICAgICAgICAgIGZ1bmN0aW9uIF9zZXRNYXBTaXplKCkge1xyXG4gICAgICAgICAgICAgICAgJHNjb3BlLm1hcEhlaWdodCA9IG9wdGlvbnMuaGVpZ2h0ICsgJ3B4JztcclxuICAgICAgICAgICAgICAgICRzY29wZS5tYXBXaWR0aCA9IG9wdGlvbnMud2lkdGggKyAncHgnO1xyXG5cclxuICAgICAgICAgICAgICAgIFV0aWxzU2VydmljZS5ydW5TY29wZURpZ2VzdElmTmVlZCgkc2NvcGUpO1xyXG4gICAgICAgICAgICB9XHJcbiAgICAgICAgICAgIFxyXG4gICAgICAgICAgICBmdW5jdGlvbiBNYXBQcm94eSgpe1xyXG4gICAgICAgICAgICAgICAgcmV0dXJuIHtcclxuICAgICAgICAgICAgICAgICAgICBnZXRNYXA6IGZ1bmN0aW9uKCl7XHJcbiAgICAgICAgICAgICAgICAgICAgICAgIHJldHVybiAkc2NvcGUuaGVyZW1hcHMubWFwXHJcbiAgICAgICAgICAgICAgICAgICAgfSxcclxuICAgICAgICAgICAgICAgICAgICBzZXRDZW50ZXI6IGZ1bmN0aW9uKGNvb3Jkcykge1xyXG4gICAgICAgICAgICAgICAgICAgICAgICBpZiAoIWNvb3Jkcykge1xyXG4gICAgICAgICAgICAgICAgICAgICAgICAgICAgcmV0dXJuIF9nZXRMb2NhdGlvbigpXHJcbiAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgLnRoZW4oZnVuY3Rpb24ocmVzcG9uc2Upe1xyXG4gICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAkc2NvcGUuaGVyZW1hcHMubWFwLnNldENlbnRlcih7XHJcbiAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICBsbmc6IHJlc3BvbnNlLmNvb3Jkcy5sb25naXR1ZGUsXHJcbiAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICBsYXQ6IHJlc3BvbnNlLmNvb3Jkcy5sYXRpdHVkZVxyXG4gICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICB9KTsgICAgICAgIFxyXG4gICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgIH0pXHJcbiAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgLmNhdGNoKF9sb2NhdGlvbkZhaWx1cmUpO1xyXG4gICAgICAgICAgICAgICAgICAgICAgICB9XHJcblxyXG4gICAgICAgICAgICAgICAgICAgICAgICAkc2NvcGUuaGVyZW1hcHMubWFwLnNldENlbnRlcihjb29yZHMpOyAgICAgICAgXHJcbiAgICAgICAgICAgICAgICAgICAgfVxyXG4gICAgICAgICAgICAgICAgfVxyXG4gICAgICAgICAgICB9XHJcbiAgICAgICAgICAgIFxyXG4gICAgICAgIH1cclxuICAgIH1cclxufTsiLCJyZXF1aXJlKCcuL3Byb3ZpZGVycy9tYXJrZXJzL21hcmtlcnMubW9kdWxlJyk7XHJcblxyXG52YXIgZGlyZWN0aXZlID0gcmVxdWlyZSgnLi9oZXJlbWFwcy5kaXJlY3RpdmUnKSxcclxuICAgIGNvbmZpZ1Byb3ZpZGVyID0gcmVxdWlyZSgnLi9wcm92aWRlcnMvY29uZmlnLnByb3ZpZGVyJyksXHJcbiAgICBhcGlTZXJ2aWNlID0gcmVxdWlyZSgnLi9wcm92aWRlcnMvYXBpLnNlcnZpY2UnKSxcclxuICAgIHV0aWxzU2VydmljZSA9IHJlcXVpcmUoJy4vcHJvdmlkZXJzL3V0aWxzLnNlcnZpY2UnKSxcclxuICAgIGNvbnN0cyA9IHJlcXVpcmUoJy4vcHJvdmlkZXJzL2NvbnN0cycpO1xyXG5cclxudmFyIGhlcmVtYXBzID0gYW5ndWxhci5tb2R1bGUoJ2hlcmVtYXBzJywgW1xyXG4gICAgJ21hcmtlcnMtbW9kdWxlJ1xyXG5dKTtcclxuXHJcbmhlcmVtYXBzXHJcbiAgICAucHJvdmlkZXIoJ0NvbmZpZycsIGNvbmZpZ1Byb3ZpZGVyKVxyXG4gICAgLnNlcnZpY2UoJ0FQSVNlcnZpY2UnLCBbJyRxJywgJ0NvbmZpZycsICdVdGlsc1NlcnZpY2UnLCAnQ09OU1RTJywgYXBpU2VydmljZV0pXHJcbiAgICAuc2VydmljZSgnVXRpbHNTZXJ2aWNlJywgdXRpbHNTZXJ2aWNlKVxyXG4gICAgLmNvbnN0YW50KCdDT05TVFMnLCBjb25zdHMpXHJcblxyXG5oZXJlbWFwcy5kaXJlY3RpdmUoJ2hlcmVtYXBzJywgZGlyZWN0aXZlKTtcclxuXHJcbmhlcmVtYXBzLmNvbmZpZyhbXCJDb25maWdQcm92aWRlclwiLCBmdW5jdGlvbihDb25maWdQcm92aWRlcikge1xyXG4gICAgQ29uZmlnUHJvdmlkZXIuc2V0T3B0aW9ucyh7XHJcbiAgICAgICAgJ2FwaVZlcnNpb24nOiAnMy4wJyxcclxuICAgICAgICAnYXBwX2lkJzogJ3dNSEp1TGdDUXprZmJoelhJd1JGJyxcclxuICAgICAgICAnYXBwX2NvZGUnOiAnV0xJYzdRem9POGlydjdsdXJVdDFxQScsXHJcbiAgICAgICAgJ3VzZUhUVFBTJzogdHJ1ZVxyXG4gICAgfSk7XHJcbn1dKTtcclxuXHJcbm1vZHVsZS5leHBvcnRzID0gaGVyZW1hcHM7IiwibW9kdWxlLmV4cG9ydHMgPSBmdW5jdGlvbigkcSwgQ29uZmlnLCBVdGlsc1NlcnZpY2UsIENPTlNUUykge1xyXG4gICAgdmFyIHZlcnNpb24gPSBDb25maWcuYXBpVmVyc2lvbjtcclxuXHJcbiAgICB2YXIgQVBJX1ZFUlNJT04gPSB7XHJcbiAgICAgICAgVjogcGFyc2VJbnQodmVyc2lvbiksXHJcbiAgICAgICAgU1VCOiB2ZXJzaW9uXHJcbiAgICB9O1xyXG5cclxuICAgIHZhciBDT05GSUcgPSB7XHJcbiAgICAgICAgQkFTRTogXCJodHRwOi8vanMuYXBpLmhlcmUuY29tL3ZcIixcclxuICAgICAgICBDT1JFOiBcIm1hcHNqcy1jb3JlLmpzXCIsXHJcbiAgICAgICAgU0VSVklDRTogXCJtYXBzanMtc2VydmljZS5qc1wiLFxyXG4gICAgICAgIFVJOiB7XHJcbiAgICAgICAgICAgIHNyYzogXCJtYXBzanMtdWkuanNcIixcclxuICAgICAgICAgICAgaHJlZjogXCJtYXBzanMtdWkuY3NzXCJcclxuICAgICAgICB9LFxyXG4gICAgICAgIFBBTk86IFwibWFwc2pzLXBhbm8uanNcIixcclxuICAgICAgICBFVkVOVFM6IFwibWFwc2pzLW1hcGV2ZW50cy5qc1wiXHJcbiAgICB9O1xyXG4gICAgXHJcbiAgICB2YXIgQVBJX0RFRkVSU1F1ZXVlID0ge307XHJcbiAgICBcclxuICAgIEFQSV9ERUZFUlNRdWV1ZVtDT05GSUcuQ09SRV0gPSBbXTsgICAgXHJcbiAgICBBUElfREVGRVJTUXVldWVbQ09ORklHLlNFUlZJQ0VdID0gW107XHJcbiAgICBBUElfREVGRVJTUXVldWVbQ09ORklHLlVJLnNyY10gPSBbXTtcclxuICAgIEFQSV9ERUZFUlNRdWV1ZVtDT05GSUcuUEFOT10gPSBbXTtcclxuICAgIEFQSV9ERUZFUlNRdWV1ZVtDT05GSUcuRVZFTlRTXSA9IFtdO1xyXG4gICAgXHJcbiAgICB2YXIgaGVhZCA9IGRvY3VtZW50LmdldEVsZW1lbnRzQnlUYWdOYW1lKCdoZWFkJylbMF07XHJcblxyXG4gICAgcmV0dXJuIHtcclxuICAgICAgICBsb2FkQXBpOiBsb2FkQXBpLFxyXG4gICAgICAgIGxvYWRNb2R1bGVzOiBsb2FkTW9kdWxlcywgXHJcbiAgICAgICAgZ2V0UG9zaXRpb246IGdldFBvc2l0aW9uXHJcbiAgICB9O1xyXG5cclxuICAgIC8vI3JlZ2lvbiBQVUJMSUNcclxuICAgIGZ1bmN0aW9uIGxvYWRBcGkoKSB7XHJcbiAgICAgICAgcmV0dXJuIF9nZXRMb2FkZXIoQ09ORklHLkNPUkUpXHJcbiAgICAgICAgICAgIC50aGVuKGZ1bmN0aW9uKCkge1xyXG4gICAgICAgICAgICAgICAgcmV0dXJuIF9nZXRMb2FkZXIoQ09ORklHLlNFUlZJQ0UpO1xyXG4gICAgICAgICAgICB9KTtcclxuICAgIH1cclxuICAgIFxyXG4gICAgZnVuY3Rpb24gbG9hZE1vZHVsZXMoYXR0cnMsIGhhbmRsZXJzKXtcclxuICAgICAgICBmb3IodmFyIGtleSBpbiBoYW5kbGVycykge1xyXG4gICAgICAgICAgICBpZighaGFuZGxlcnMuaGFzT3duUHJvcGVydHkoa2V5KSB8fCAhYXR0cnNba2V5XSlcclxuICAgICAgICAgICAgICAgIGNvbnRpbnVlO1xyXG4gICAgICAgICAgICAgICAgXHJcbiAgICAgICAgICAgIHZhciBsb2FkZXIgPSBfZ2V0TG9hZGVyQnlBdHRyKGtleSk7XHJcbiAgICAgICAgICAgIGxvYWRlcigpXHJcbiAgICAgICAgICAgICAgICAudGhlbihoYW5kbGVyc1trZXldKVxyXG4gICAgICAgIH1cclxuICAgIH1cclxuICAgIFxyXG4gICAgZnVuY3Rpb24gX2dldExvYWRlckJ5QXR0cihhdHRyKXtcclxuICAgICAgICB2YXIgbG9hZGVyO1xyXG4gICAgICAgIFxyXG4gICAgICAgIHN3aXRjaChhdHRyKSB7XHJcbiAgICAgICAgICAgIGNhc2UgQ09OU1RTLk1PRFVMRVMuVUk6XHJcbiAgICAgICAgICAgICAgICBsb2FkZXIgPSBsb2FkVUlNb2R1bGU7XHJcbiAgICAgICAgICAgICAgICBicmVhaztcclxuICAgICAgICAgICAgY2FzZSBDT05TVFMuTU9EVUxFUy5FVkVOVFM6XHJcbiAgICAgICAgICAgICAgICBsb2FkZXIgPSBsb2FkRXZlbnRzTW9kdWxlO1xyXG4gICAgICAgICAgICAgICAgYnJlYWs7XHJcbiAgICAgICAgICAgIGNhc2UgQ09OU1RTLk1PRFVMRVMuUEFOTzpcclxuICAgICAgICAgICAgICAgIGxvYWRlciA9IGxvYWRQYW5vTW9kdWxlO1xyXG4gICAgICAgICAgICAgICAgYnJlYWs7XHJcbiAgICAgICAgICAgIGRlZmF1bHQ6XHJcbiAgICAgICAgICAgICAgICB0aHJvdyBuZXcgRXJyb3IoJ1Vua25vd24gbW9kdWxlJywgYXR0cik7XHJcbiAgICAgICAgfVxyXG4gICAgICAgIFxyXG4gICAgICAgIHJldHVybiBsb2FkZXI7XHJcbiAgICB9XHJcblxyXG4gICAgZnVuY3Rpb24gbG9hZFVJTW9kdWxlKCkge1xyXG4gICAgICAgIGlmICghX2lzTG9hZGVkKENPTkZJRy5VSSkpIHtcclxuICAgICAgICAgICAgdmFyIGxpbmsgPSBVdGlsc1NlcnZpY2UuY3JlYXRlTGlua1RhZyh7XHJcbiAgICAgICAgICAgICAgICByZWw6ICdzdHlsZXNoZWV0JyxcclxuICAgICAgICAgICAgICAgIHR5cGU6ICd0ZXh0L2NzcycsXHJcbiAgICAgICAgICAgICAgICBocmVmOiBfZ2V0VVJMKENPTkZJRy5VSS5ocmVmKVxyXG4gICAgICAgICAgICB9KTtcclxuXHJcbiAgICAgICAgICAgIGxpbmsgJiYgaGVhZC5hcHBlbmRDaGlsZChsaW5rKTtcclxuICAgICAgICB9XHJcblxyXG4gICAgICAgIHJldHVybiBfZ2V0TG9hZGVyKENPTkZJRy5VSS5zcmMpO1xyXG4gICAgfVxyXG5cclxuICAgIGZ1bmN0aW9uIGxvYWRQYW5vTW9kdWxlKCkge1xyXG4gICAgICAgIHJldHVybiBfZ2V0TG9hZGVyKENPTkZJRy5QQU5PKTtcclxuICAgIH1cclxuXHJcbiAgICBmdW5jdGlvbiBsb2FkRXZlbnRzTW9kdWxlKCkge1xyXG4gICAgICAgIHJldHVybiBfZ2V0TG9hZGVyKENPTkZJRy5FVkVOVFMpO1xyXG4gICAgfVxyXG5cclxuICAgIGZ1bmN0aW9uIGdldFBvc2l0aW9uKG9wdGlvbnMpIHtcclxuICAgICAgICB2YXIgY29vcmRzRXhpc3QgPSBvcHRpb25zLmNvb3JkcyAmJiAodHlwZW9mIG9wdGlvbnMuY29vcmRzLmxhdGl0dWRlID09PSAnbnVtYmVyJyAmJiB0eXBlb2Ygb3B0aW9ucy5jb29yZHMubG9uZ2l0dWRlID09PSAnbnVtYmVyJyk7IFxyXG5cclxuICAgICAgICB2YXIgZGVyZXJyZWQgPSAkcS5kZWZlcigpO1xyXG5cclxuICAgICAgICBpZihjb29yZHNFeGlzdCkge1xyXG4gICAgICAgICAgICBkZXJlcnJlZC5yZXNvbHZlKHtjb29yZHM6IG9wdGlvbnMuY29vcmRzfSk7XHJcbiAgICAgICAgfSBlbHNlIHtcclxuICAgICAgICAgICAgbmF2aWdhdG9yLmdlb2xvY2F0aW9uLmdldEN1cnJlbnRQb3NpdGlvbihmdW5jdGlvbihyZXNwb25zZSkge1xyXG4gICAgICAgICAgICAgICAgZGVyZXJyZWQucmVzb2x2ZShyZXNwb25zZSk7XHJcbiAgICAgICAgICAgIH0sIGZ1bmN0aW9uKGVycm9yKSB7XHJcbiAgICAgICAgICAgICAgICBkZXJlcnJlZC5yZWplY3QoZXJyb3IpO1xyXG4gICAgICAgICAgICB9LCBvcHRpb25zKTtcclxuICAgICAgICB9IFxyXG4gICAgICAgIFxyXG4gICAgICAgIHJldHVybiBkZXJlcnJlZC5wcm9taXNlO1xyXG4gICAgfVxyXG4gICAgLy8jZW5kcmVnaW9uIFBVQkxJQ1xyXG5cclxuXHJcbiAgICAvLyNyZWdpb24gUFJJVkFURVxyXG4gICAgZnVuY3Rpb24gX2dldFVSTChzb3VyY2VOYW1lKSB7XHJcbiAgICAgICAgcmV0dXJuIFtcclxuICAgICAgICAgICAgQ09ORklHLkJBU0UsXHJcbiAgICAgICAgICAgIEFQSV9WRVJTSU9OLlYsXHJcbiAgICAgICAgICAgIFwiL1wiLFxyXG4gICAgICAgICAgICBBUElfVkVSU0lPTi5TVUIsXHJcbiAgICAgICAgICAgIFwiL1wiLFxyXG4gICAgICAgICAgICBzb3VyY2VOYW1lXHJcbiAgICAgICAgXS5qb2luKFwiXCIpO1xyXG4gICAgfVxyXG5cclxuICAgIGZ1bmN0aW9uIF9nZXRMb2FkZXIoc291cmNlTmFtZSkge1xyXG4gICAgICAgIHZhciBkZWZlciA9ICRxLmRlZmVyKCk7XHJcbiAgICAgICAgcmV0dXJuIF9pc0xvYWRlZChzb3VyY2VOYW1lKSA/IChmdW5jdGlvbigpIHtcclxuICAgICAgICAgICAgZGVmZXIucmVzb2x2ZSgpO1xyXG4gICAgICAgICAgICByZXR1cm4gZGVmZXIucHJvbWlzZTtcclxuICAgICAgICB9KSgpIDogKGZ1bmN0aW9uKCkge1xyXG4gICAgICAgICAgICB2YXIgc3JjID0gX2dldFVSTChzb3VyY2VOYW1lKSxcclxuICAgICAgICAgICAgICAgIHNjcmlwdCA9IFV0aWxzU2VydmljZS5jcmVhdGVTY3JpcHRUYWcoeyBzcmM6IHNyYyB9KTtcclxuICAgICAgICAgICAgICAgIFxyXG4gICAgICAgICAgICBzY3JpcHQgJiYgaGVhZC5hcHBlbmRDaGlsZChzY3JpcHQpO1xyXG4gICAgICAgICAgICBcclxuICAgICAgICAgICAgQVBJX0RFRkVSU1F1ZXVlW3NvdXJjZU5hbWVdLnB1c2goZGVmZXIpO1xyXG4gICAgICAgICAgICBcclxuICAgICAgICAgICAgc2NyaXB0Lm9ubG9hZCA9IF9vbkxvYWQuYmluZChudWxsLCBzb3VyY2VOYW1lKTtcclxuICAgICAgICAgICAgc2NyaXB0Lm9uZXJyb3IgPSBfb25FcnJvci5iaW5kKG51bGwsIHNvdXJjZU5hbWUpO1xyXG5cclxuICAgICAgICAgICAgcmV0dXJuIGRlZmVyLnByb21pc2U7XHJcblxyXG4gICAgICAgIH0pKCk7XHJcbiAgICB9XHJcblxyXG4gICAgZnVuY3Rpb24gX2lzTG9hZGVkKHNvdXJjZU5hbWUpIHtcclxuICAgICAgICB2YXIgY2hlY2tlciA9IG51bGw7XHJcblxyXG4gICAgICAgIHN3aXRjaCAoc291cmNlTmFtZSkge1xyXG4gICAgICAgICAgICBjYXNlIENPTkZJRy5DT1JFOlxyXG4gICAgICAgICAgICAgICAgY2hlY2tlciA9IF9pc0NvcmVMb2FkZWQ7XHJcbiAgICAgICAgICAgICAgICBicmVhaztcclxuICAgICAgICAgICAgY2FzZSBDT05GSUcuU0VSVklDRTpcclxuICAgICAgICAgICAgICAgIGNoZWNrZXIgPSBfaXNTZXJ2aWNlTG9hZGVkO1xyXG4gICAgICAgICAgICAgICAgYnJlYWs7XHJcbiAgICAgICAgICAgIGNhc2UgQ09ORklHLlVJOlxyXG4gICAgICAgICAgICAgICAgY2hlY2tlciA9IF9pc1VJTG9hZGVkO1xyXG4gICAgICAgICAgICAgICAgYnJlYWs7XHJcbiAgICAgICAgICAgIGNhc2UgQ09ORklHLkVWRU5UUzpcclxuICAgICAgICAgICAgICAgIGNoZWNrZXIgPSBfaXNFdmVudHNMb2FkZWQ7XHJcbiAgICAgICAgICAgICAgICBicmVhaztcclxuICAgICAgICAgICAgY2FzZSBDT05GSUcuUEFOTzpcclxuICAgICAgICAgICAgICAgIGNoZWNrZXIgPSBfaXNQYW5vTG9hZGVkO1xyXG4gICAgICAgICAgICAgICAgYnJlYWs7XHJcbiAgICAgICAgICAgIGRlZmF1bHQ6XHJcbiAgICAgICAgICAgICAgICBjaGVja2VyID0gZnVuY3Rpb24oKSB7IHJldHVybiBmYWxzZSB9O1xyXG4gICAgICAgIH1cclxuXHJcbiAgICAgICAgcmV0dXJuIGNoZWNrZXIoKTtcclxuICAgIH1cclxuXHJcbiAgICBmdW5jdGlvbiBfaXNDb3JlTG9hZGVkKCkge1xyXG4gICAgICAgIHJldHVybiAhIXdpbmRvdy5IO1xyXG4gICAgfVxyXG5cclxuICAgIGZ1bmN0aW9uIF9pc1NlcnZpY2VMb2FkZWQoKSB7XHJcbiAgICAgICAgcmV0dXJuICEhKHdpbmRvdy5IICYmIHdpbmRvdy5ILnNlcnZpY2UpO1xyXG4gICAgfVxyXG5cclxuICAgIGZ1bmN0aW9uIF9pc1VJTG9hZGVkKCkge1xyXG4gICAgICAgIHJldHVybiAhISh3aW5kb3cuSCAmJiB3aW5kb3cuSC51aSk7XHJcbiAgICB9XHJcblxyXG4gICAgZnVuY3Rpb24gX2lzRXZlbnRzTG9hZGVkKCkge1xyXG4gICAgICAgIHJldHVybiAhISh3aW5kb3cuSCAmJiB3aW5kb3cuSC5tYXBldmVudHMpO1xyXG4gICAgfVxyXG5cclxuICAgIGZ1bmN0aW9uIF9pc1Bhbm9Mb2FkZWQoKSB7XHJcbiAgICAgICAgcmV0dXJuICEhKHdpbmRvdy5IICYmIHdpbmRvdy5ILnBhbm8pO1xyXG4gICAgfVxyXG4gICAgXHJcbiAgICBmdW5jdGlvbiBfb25Mb2FkKHNvdXJjZU5hbWUpe1xyXG4gICAgICAgIHZhciBkZWZlclF1ZXVlID0gQVBJX0RFRkVSU1F1ZXVlW3NvdXJjZU5hbWVdO1xyXG4gICAgICAgIGZvcih2YXIgaSA9IDAsIGwgPSBkZWZlclF1ZXVlLmxlbmd0aDsgaSA8IGw7ICsraSkge1xyXG4gICAgICAgICAgICB2YXIgZGVmZXIgPSBkZWZlclF1ZXVlW2ldO1xyXG4gICAgICAgICAgICBkZWZlci5yZXNvbHZlKCk7XHJcbiAgICAgICAgfVxyXG4gICAgICAgIFxyXG4gICAgICAgIEFQSV9ERUZFUlNRdWV1ZVtzb3VyY2VOYW1lXSA9IFtdO1xyXG4gICAgfVxyXG4gICAgXHJcbiAgICBmdW5jdGlvbiBfb25FcnJvcihzb3VyY2VOYW1lKSB7XHJcbiAgICAgICAgdmFyIGRlZmVyUXVldWUgPSBBUElfREVGRVJTUXVldWVbc291cmNlTmFtZV07XHJcbiAgICAgICAgZm9yKHZhciBpID0gMCwgbCA9IGRlZmVyUXVldWUubGVuZ3RoOyBpIDwgbDsgKytpKSB7XHJcbiAgICAgICAgICAgIHZhciBkZWZlciA9IGRlZmVyUXVldWVbaV07XHJcbiAgICAgICAgICAgIGRlZmVyLnJlamVjdCgpO1xyXG4gICAgICAgIH1cclxuICAgICAgICBcclxuICAgICAgICBBUElfREVGRVJTUXVldWVbc291cmNlTmFtZV0gPSBbXTtcclxuICAgIH1cclxufTsiLCJtb2R1bGUuZXhwb3J0cyA9IGZ1bmN0aW9uKCkge1xyXG4gICAgdmFyIG9wdGlvbnMgPSB7fTtcclxuICAgIHZhciBERUZBVUxUX0FQSV9WRVJTSU9OID0gXCIzLjBcIjtcclxuXHJcbiAgICB0aGlzLiRnZXQgPSBmdW5jdGlvbigpe1xyXG4gICAgICAgIHJldHVybiB7XHJcbiAgICAgICAgICAgIGFwcF9pZDogb3B0aW9ucy5hcHBfaWQsXHJcbiAgICAgICAgICAgIGFwcF9jb2RlOiBvcHRpb25zLmFwcF9jb2RlLFxyXG4gICAgICAgICAgICBhcGlWZXJzaW9uOiBvcHRpb25zLmFwaVZlcnNpb24gfHwgREVGQVVMVF9BUElfVkVSU0lPTixcclxuICAgICAgICAgICAgdXNlSFRUUFM6IG9wdGlvbnMudXNlSFRUUFNcclxuICAgICAgICB9XHJcbiAgICB9O1xyXG5cclxuICAgIHRoaXMuc2V0T3B0aW9ucyA9IGZ1bmN0aW9uKG9wdHMpe1xyXG4gICAgICAgIG9wdGlvbnMgPSBvcHRzO1xyXG4gICAgfTtcclxufTsiLCJtb2R1bGUuZXhwb3J0cyA9IHtcclxuICAgIFwiVVBEQVRFX01BUF9SRVNJWkVfVElNRU9VVFwiOiA1MDAsXHJcbiAgICBcIk1PRFVMRVNcIjoge1xyXG4gICAgICAgIFVJOiAnY29udHJvbHMnLFxyXG4gICAgICAgIEVWRU5UUzogJ2V2ZW50cycsXHJcbiAgICAgICAgUEFOTzogJ3Bhbm8nXHJcbiAgICB9LFxyXG4gICAgXCJERUZBVUxUX01BUF9PUFRJT05TXCI6IHtcclxuICAgICAgICBoZWlnaHQ6IDQ4MCxcclxuICAgICAgICB3aWR0aDogNjQwLFxyXG4gICAgICAgIHpvb206IDEwLFxyXG4gICAgICAgIGRyYWdnYWJsZTogZmFsc2VcclxuICAgIH0sXHJcbiAgICBcIk1BUktFUl9UWVBFU1wiOiB7XHJcbiAgICAgICAgRE9NOiBcIkRPTVwiLFxyXG4gICAgICAgIFNWRzogXCJTVkdcIlxyXG4gICAgfSxcclxuICAgIFwiTUFQX0VWRU5UU1wiOiB7XHJcbiAgICAgICAgTkFWSUdBVEU6IFwiTkFWSUdBVEVcIixcclxuICAgICAgICBSRUxPQUQ6IFwiUkVMT0FEXCJcclxuICAgIH1cclxufSIsIm1vZHVsZS5leHBvcnRzID0gZnVuY3Rpb24oTWFya2VySW50ZXJmYWNlKXtcclxuICAgIGZ1bmN0aW9uIERlZmF1bHRNYXJrZXIocGxhY2Upe1xyXG4gICAgICAgIHRoaXMucGxhY2UgPSBwbGFjZTtcclxuICAgICAgICB0aGlzLnNldENvb3JkcygpO1xyXG4gICAgfVxyXG5cclxuICAgIHZhciBwcm90byA9IERlZmF1bHRNYXJrZXIucHJvdG90eXBlID0gbmV3IE1hcmtlckludGVyZmFjZSgpO1xyXG4gICAgcHJvdG8uY29uc3RydWN0b3IgPSBEZWZhdWx0TWFya2VyO1xyXG5cclxuICAgIHByb3RvLmNyZWF0ZSA9IGNyZWF0ZTtcclxuXHJcbiAgICByZXR1cm4gRGVmYXVsdE1hcmtlcjtcclxuICAgIFxyXG4gICAgZnVuY3Rpb24gY3JlYXRlKCl7XHJcbiAgICAgICAgcmV0dXJuIG5ldyBILm1hcC5NYXJrZXIodGhpcy5jb29yZHMpO1xyXG4gICAgfVxyXG59IiwibW9kdWxlLmV4cG9ydHMgPSBmdW5jdGlvbihNYXJrZXJJbnRlcmZhY2Upe1xyXG4gICAgZnVuY3Rpb24gRE9NTWFya2VyKHBsYWNlKXtcclxuICAgICAgICB0aGlzLnBsYWNlID0gcGxhY2U7XHJcbiAgICAgICAgdGhpcy5zZXRDb29yZHMoKTtcclxuICAgIH1cclxuXHJcbiAgICB2YXIgcHJvdG8gPSBET01NYXJrZXIucHJvdG90eXBlID0gbmV3IE1hcmtlckludGVyZmFjZSgpO1xyXG4gICAgcHJvdG8uY29uc3RydWN0b3IgPSBET01NYXJrZXI7XHJcblxyXG4gICAgcHJvdG8uY3JlYXRlID0gY3JlYXRlO1xyXG4gICAgcHJvdG8uX2dldEljb24gPSBfZ2V0SWNvbjtcclxuICAgIHByb3RvLl9zZXR1cEV2ZW50cyA9IF9zZXR1cEV2ZW50cztcclxuICAgIHByb3RvLl9nZXRFdmVudHMgPSBfZ2V0RXZlbnRzO1xyXG5cclxuICAgIHJldHVybiBET01NYXJrZXI7XHJcbiAgICBcclxuICAgIGZ1bmN0aW9uIGNyZWF0ZSgpe1xyXG4gICAgICAgIHJldHVybiBuZXcgSC5tYXAuRG9tTWFya2VyKHRoaXMuY29vcmRzLCB7XHJcbiAgICAgICAgICAgIGljb246IHRoaXMuX2dldEljb24oKSxcclxuICAgICAgICB9KTtcclxuICAgIH1cclxuICAgIFxyXG4gICAgZnVuY3Rpb24gX2dldEljb24oKXtcclxuICAgICAgICB2YXIgaWNvbiA9IHRoaXMucGxhY2UubWFya3VwO1xyXG4gICAgICAgICBpZighaWNvbilcclxuICAgICAgICAgICAgdGhyb3cgbmV3IEVycm9yKCdtYXJrdXAgbWlzc2VkJyk7XHJcblxyXG4gICAgICAgIHJldHVybiBuZXcgSC5tYXAuRG9tSWNvbihpY29uLCB0aGlzLl9nZXRFdmVudHMoKSk7XHJcbiAgICB9XHJcbiAgICBcclxuICAgIGZ1bmN0aW9uIF9zZXR1cEV2ZW50cyhlbCwgZXZlbnRzLCByZW1vdmUpe1xyXG4gICAgICAgIHZhciBtZXRob2QgPSByZW1vdmUgPyAncmVtb3ZlRXZlbnRMaXN0ZW5lcicgOiAnYWRkRXZlbnRMaXN0ZW5lcic7XHJcblxyXG4gICAgICAgIGZvcih2YXIga2V5IGluIGV2ZW50cykge1xyXG4gICAgICAgICAgICBpZighZXZlbnRzLmhhc093blByb3BlcnR5KGtleSkpXHJcbiAgICAgICAgICAgICAgICBjb250aW51ZTtcclxuXHJcbiAgICAgICAgICAgIGVsW21ldGhvZF0uY2FsbChudWxsLCBrZXksIGV2ZW50c1trZXldKTtcclxuICAgICAgICB9XHJcbiAgICB9XHJcbiAgICBcclxuICAgIGZ1bmN0aW9uIF9nZXRFdmVudHMoKXtcclxuICAgICAgICB2YXIgc2VsZiA9IHRoaXMsXHJcbiAgICAgICAgICAgIGV2ZW50cyA9IHRoaXMucGxhY2UuZXZlbnRzO1xyXG5cclxuICAgICAgICBpZighdGhpcy5wbGFjZS5ldmVudHMpXHJcbiAgICAgICAgICAgIHJldHVybiB7fTtcclxuXHJcbiAgICAgICAgcmV0dXJuIHtcclxuICAgICAgICAgICAgb25BdHRhY2g6IGZ1bmN0aW9uKGNsb25lZEVsZW1lbnQsIGRvbUljb24sIGRvbU1hcmtlcil7XHJcbiAgICAgICAgICAgICAgICBzZWxmLl9zZXR1cEV2ZW50cyhjbG9uZWRFbGVtZW50LCBldmVudHMpO1xyXG4gICAgICAgICAgICB9LFxyXG4gICAgICAgICAgICBvbkRldGFjaDogZnVuY3Rpb24oY2xvbmVkRWxlbWVudCwgZG9tSWNvbiwgZG9tTWFya2VyKXtcclxuICAgICAgICAgICAgICAgIHNlbGYuX3NldHVwRXZlbnRzKGNsb25lZEVsZW1lbnQsIGV2ZW50cywgdHJ1ZSk7XHJcbiAgICAgICAgICAgIH1cclxuICAgICAgICB9XHJcbiAgICB9XHJcbn0iLCJtb2R1bGUuZXhwb3J0cyA9IGZ1bmN0aW9uKCl7XHJcbiAgICBmdW5jdGlvbiBNYXJrZXJJbnRlcmZhY2UoKXtcclxuICAgICAgICB0aHJvdyBuZXcgRXJyb3IoJ0Fic3RyYWN0IGNsYXNzISBUaGUgSW5zdGFuY2Ugc2hvdWxkIGJlIGNyZWF0ZWQnKTtcclxuICAgIH1cclxuICAgIFxyXG4gICAgdmFyIHByb3RvID0gTWFya2VySW50ZXJmYWNlLnByb3RvdHlwZTtcclxuICAgIFxyXG4gICAgcHJvdG8uY3JlYXRlID0gY3JlYXRlO1xyXG4gICAgcHJvdG8uc2V0Q29vcmRzID0gc2V0Q29vcmRzO1xyXG4gICAgXHJcbiAgICBmdW5jdGlvbiBNYXJrZXIoKXt9O1xyXG4gICAgXHJcbiAgICBNYXJrZXIucHJvdG90eXBlID0gcHJvdG87XHJcbiAgICBcclxuICAgIHJldHVybiBNYXJrZXI7XHJcbiAgICBcclxuICAgIGZ1bmN0aW9uIGNyZWF0ZSgpe1xyXG4gICAgICAgIHRocm93IG5ldyBFcnJvcignZ2V0SW5zdGFuY2U6OiBub3QgaW1wbGVtZW50ZWQnKTsgXHJcbiAgICB9XHJcbiAgICBcclxuICAgIGZ1bmN0aW9uIHNldENvb3Jkcygpe1xyXG4gICAgICAgICB0aGlzLmNvb3JkcyA9IHtcclxuICAgICAgICAgICAgbGF0OiB0aGlzLnBsYWNlLnBvcy5sYXQsXHJcbiAgICAgICAgICAgIGxuZzogdGhpcy5wbGFjZS5wb3MubG5nXHJcbiAgICAgICAgfVxyXG4gICAgfVxyXG4gICAgXHJcbn0iLCJ2YXIgbWFya2VySW50ZXJmYWNlID0gcmVxdWlyZSgnLi9tYXJrZXIuanMnKSxcclxuXHRkZWZhdWx0TWFya2VyID0gcmVxdWlyZSgnLi9kZWZhdWx0Lm1hcmtlci5qcycpLFxyXG5cdGRvbU1hcmtlciA9IHJlcXVpcmUoJy4vZG9tLm1hcmtlci5qcycpLFxyXG5cdHN2Z01hcmtlciA9IHJlcXVpcmUoJy4vc3ZnLm1hcmtlci5qcycpLFxyXG4gICAgbWFya2Vyc1NlcnZpY2UgPSByZXF1aXJlKCcuL21hcmtlcnMuc2VydmljZS5qcycpO1xyXG5cclxuYW5ndWxhci5tb2R1bGUoJ21hcmtlci1pbnRlcmZhY2UnLCBbXSkuZmFjdG9yeSgnTWFya2VySW50ZXJmYWNlJywgbWFya2VySW50ZXJmYWNlKTtcclxuYW5ndWxhci5tb2R1bGUoJ2RlZmF1bHQtbWFya2VyJywgW10pLmZhY3RvcnkoJ0RlZmF1bHRNYXJrZXInLCBkZWZhdWx0TWFya2VyKTtcclxuYW5ndWxhci5tb2R1bGUoJ2RvbS1tYXJrZXInLCBbXSkuZmFjdG9yeSgnRE9NTWFya2VyJywgZG9tTWFya2VyKTtcclxuYW5ndWxhci5tb2R1bGUoJ3N2Zy1tYXJrZXInLCBbXSkuZmFjdG9yeSgnU1ZHTWFya2VyJywgc3ZnTWFya2VyKTtcclxuXHJcbmFuZ3VsYXIubW9kdWxlKCdtYXJrZXJzLXNlcnZpY2UnLCBbXSkuc2VydmljZSgnTWFya2Vyc1NlcnZpY2UnLCBtYXJrZXJzU2VydmljZSk7XHJcblxyXG52YXIgYXBwID0gYW5ndWxhci5tb2R1bGUoJ21hcmtlcnMtbW9kdWxlJywgW1xyXG5cdCdtYXJrZXItaW50ZXJmYWNlJyxcclxuICAgICdkZWZhdWx0LW1hcmtlcicsXHJcbiAgICAnZG9tLW1hcmtlcicsXHJcbiAgICAnbWFya2Vycy1zZXJ2aWNlJyxcclxuICAgICdzdmctbWFya2VyJ1xyXG5dKTtcclxuXHJcbm1vZHVsZS5leHBvcnRzID0gYXBwOyIsIm1vZHVsZS5leHBvcnRzID0gZnVuY3Rpb24oRGVmYXVsdE1hcmtlciwgRE9NTWFya2VyLCBTVkdNYXJrZXIsIENPTlNUUykge1xyXG4gICAgXHJcbiAgICB2YXIgTUFSS0VSX1RZUEVTID0gQ09OU1RTLk1BUktFUl9UWVBFUztcclxuICAgIHJldHVybiB7XHJcbiAgICAgICAgYWRkTWFya2VyVG9NYXA6IGFkZE1hcmtlclRvTWFwXHJcbiAgICB9XHJcblxyXG4gICAgZnVuY3Rpb24gYWRkTWFya2VyVG9NYXAobWFwLCBwbGFjZXMpIHtcclxuICAgICAgICBpZiAoIXBsYWNlcyB8fCAhcGxhY2VzLmxlbmd0aClcclxuICAgICAgICAgICAgcmV0dXJuIGZhbHNlO1xyXG5cclxuICAgICAgICBpZiAoIShtYXAgaW5zdGFuY2VvZiBILk1hcCkpXHJcbiAgICAgICAgICAgIHRocm93IG5ldyBFcnJvcignVW5zdXBwb3J0ZWQgbWFwIGluc3RhbmNlJyk7XHJcblxyXG4gICAgICAgIHBsYWNlcy5mb3JFYWNoKGZ1bmN0aW9uKHBsYWNlLCBpKSB7XHJcbiAgICAgICAgICAgIHZhciBjcmVhdG9yID0gX2dldE1hcmtlckNyZWF0b3IocGxhY2UpO1xyXG4gICAgICAgICAgICB2YXIgbWFya2VyID0gcGxhY2UuZHJhZ2dhYmxlID8gX2RyYWdnYWJsZU1hcmtlck1peGluKGNyZWF0b3IuY3JlYXRlKCkpIDogY3JlYXRvci5jcmVhdGUoKTtcclxuXHJcbiAgICAgICAgICAgIG1hcC5hZGRPYmplY3QobWFya2VyKTtcclxuICAgICAgICB9KTtcclxuXHJcbiAgICB9XHJcblxyXG4gICAgZnVuY3Rpb24gX2dldE1hcmtlckNyZWF0b3IocGxhY2UpIHtcclxuICAgICAgICB2YXIgQ29uY3JldGVNYXJrZXI7XHJcblxyXG4gICAgICAgIHN3aXRjaChwbGFjZS50eXBlKSB7XHJcbiAgICAgICAgICAgIGNhc2UgTUFSS0VSX1RZUEVTLkRPTTpcclxuICAgICAgICAgICAgICAgIENvbmNyZXRlTWFya2VyID0gRE9NTWFya2VyO1xyXG4gICAgICAgICAgICAgICAgYnJlYWs7XHJcbiAgICAgICAgICAgIGNhc2UgTUFSS0VSX1RZUEVTLlNWRzpcclxuICAgICAgICAgICAgICAgIENvbmNyZXRlTWFya2VyID0gU1ZHTWFya2VyO1xyXG4gICAgICAgICAgICAgICAgYnJlYWs7XHJcbiAgICAgICAgICAgIGRlZmF1bHQ6XHJcbiAgICAgICAgICAgICAgICBDb25jcmV0ZU1hcmtlciA9IERlZmF1bHRNYXJrZXI7XHJcbiAgICAgICAgfVxyXG5cclxuICAgICAgICByZXR1cm4gbmV3IENvbmNyZXRlTWFya2VyKHBsYWNlKTtcclxuICAgIH1cclxuXHJcbiAgICBmdW5jdGlvbiBfZHJhZ2dhYmxlTWFya2VyTWl4aW4obWFya2VyKSB7XHJcbiAgICAgICAgbWFya2VyLmRyYWdnYWJsZSA9IHRydWU7XHJcblxyXG4gICAgICAgIHJldHVybiBtYXJrZXI7XHJcbiAgICB9XHJcblxyXG59OyIsIm1vZHVsZS5leHBvcnRzID0gZnVuY3Rpb24oTWFya2VySW50ZXJmYWNlKXtcclxuICAgIGZ1bmN0aW9uIFNWR01hcmtlcihwbGFjZSl7XHJcbiAgICAgICAgdGhpcy5wbGFjZSA9IHBsYWNlO1xyXG4gICAgICAgIHRoaXMuc2V0Q29vcmRzKCk7XHJcbiAgICB9XHJcbiAgICBcclxuICAgIHZhciBwcm90byA9IFNWR01hcmtlci5wcm90b3R5cGUgPSBuZXcgTWFya2VySW50ZXJmYWNlKCk7XHJcbiAgICBcclxuICAgIHByb3RvLmNvbnN0cnVjdG9yID0gU1ZHTWFya2VyO1xyXG4gICAgXHJcbiAgICBwcm90by5jcmVhdGUgPSBjcmVhdGU7XHJcbiAgICBwcm90by5fZ2V0SWNvbiA9IF9nZXRJY29uO1xyXG4gICAgXHJcbiAgICByZXR1cm4gU1ZHTWFya2VyO1xyXG4gICAgXHJcbiAgICBmdW5jdGlvbiBjcmVhdGUoKXtcclxuICAgICAgICByZXR1cm4gbmV3IEgubWFwLk1hcmtlcih0aGlzLmNvb3Jkcywge1xyXG4gICAgICAgICAgICBpY29uOiB0aGlzLl9nZXRJY29uKCksXHJcbiAgICAgICAgfSk7XHJcbiAgICB9XHJcbiAgICBcclxuICAgIGZ1bmN0aW9uIF9nZXRJY29uKCl7XHJcbiAgICAgICAgdmFyIGljb24gPSB0aGlzLnBsYWNlLm1hcmt1cDtcclxuICAgICAgICAgaWYoIWljb24pXHJcbiAgICAgICAgICAgIHRocm93IG5ldyBFcnJvcignbWFya3VwIG1pc3NlZCcpO1xyXG5cclxuICAgICAgICByZXR1cm4gbmV3IEgubWFwLkljb24oaWNvbik7XHJcbiAgICB9XHJcbn0iLCJtb2R1bGUuZXhwb3J0cyA9IGZ1bmN0aW9uKCRyb290U2NvcGUsICR0aW1lb3V0KXtcclxuICAgIHJldHVybiB7XHJcbiAgICAgICAgdGhyb3R0bGU6IHRocm90dGxlLFxyXG4gICAgICAgIGNyZWF0ZVNjcmlwdFRhZzogY3JlYXRlU2NyaXB0VGFnLFxyXG4gICAgICAgIGNyZWF0ZUxpbmtUYWc6IGNyZWF0ZUxpbmtUYWcsXHJcbiAgICAgICAgcnVuU2NvcGVEaWdlc3RJZk5lZWQ6IHJ1blNjb3BlRGlnZXN0SWZOZWVkXHJcbiAgICB9O1xyXG4gICAgXHJcbiAgICAvLyNyZWdpb24gUFVCTElDXHJcbiAgICBmdW5jdGlvbiB0aHJvdHRsZShmbiwgcGVyaW9kKXtcclxuICAgICAgICB2YXIgdGltZW91dCA9IG51bGw7XHJcbiAgICAgICAgXHJcbiAgICAgICAgcmV0dXJuIGZ1bmN0aW9uKCl7XHJcbiAgICAgICAgICAgIGlmKCR0aW1lb3V0KVxyXG4gICAgICAgICAgICAgICAgJHRpbWVvdXQuY2FuY2VsKHRpbWVvdXQpO1xyXG4gICAgICAgICAgICAgICAgXHJcbiAgICAgICAgICAgIHRpbWVvdXQgPSAkdGltZW91dChmbiwgcGVyaW9kKTtcclxuICAgICAgICB9XHJcbiAgICB9XHJcbiAgICBcclxuICAgIGZ1bmN0aW9uIHJ1blNjb3BlRGlnZXN0SWZOZWVkKHNjb3BlLCBjYikge1xyXG4gICAgICAgIGlmIChzY29wZS4kcm9vdCAmJiBzY29wZS4kcm9vdC4kJHBoYXNlICE9PSAnJGFwcGx5JyAmJiBzY29wZS4kcm9vdC4kJHBoYXNlICE9PSAnJGRpZ2VzdCcpIHtcclxuICAgICAgICAgICAgc2NvcGUuJGRpZ2VzdChjYiB8fCBhbmd1bGFyLm5vb3ApO1xyXG4gICAgICAgICAgICByZXR1cm4gdHJ1ZTtcclxuICAgICAgICB9XHJcbiAgICAgICAgcmV0dXJuIGZhbHNlO1xyXG4gICAgfVxyXG4gICAgXHJcbiAgICBmdW5jdGlvbiBjcmVhdGVTY3JpcHRUYWcoYXR0cnMpe1xyXG4gICAgICAgIHZhciBzY3JpcHQgPSBkb2N1bWVudC5nZXRFbGVtZW50QnlJZChhdHRycy5zcmMpO1xyXG4gICAgICAgIFxyXG4gICAgICAgIGlmKHNjcmlwdClcclxuICAgICAgICAgICAgcmV0dXJuIGZhbHNlO1xyXG4gICAgICAgIFxyXG4gICAgICAgIHNjcmlwdCA9IGRvY3VtZW50LmNyZWF0ZUVsZW1lbnQoJ3NjcmlwdCcpO1xyXG4gICAgICAgIHNjcmlwdC50eXBlID0gJ3RleHQvamF2YXNjcmlwdCc7XHJcbiAgICAgICAgc2NyaXB0LmlkID0gYXR0cnMuc3JjO1xyXG4gICAgICAgIF9zZXRBdHRycyhzY3JpcHQsIGF0dHJzKTsgICAgXHJcblxyXG4gICAgICAgIHJldHVybiBzY3JpcHQ7XHJcbiAgICB9XHJcblxyXG4gICAgZnVuY3Rpb24gY3JlYXRlTGlua1RhZyhhdHRycykge1xyXG4gICAgICAgIHZhciBsaW5rID0gZG9jdW1lbnQuZ2V0RWxlbWVudEJ5SWQoYXR0cnMuaHJlZik7XHJcbiAgICAgICAgXHJcbiAgICAgICAgaWYobGluaylcclxuICAgICAgICAgICAgcmV0dXJuIGZhbHNlO1xyXG4gICAgICAgICAgICBcclxuICAgICAgICBsaW5rID0gZG9jdW1lbnQuY3JlYXRlRWxlbWVudCgnbGluaycpO1xyXG4gICAgICAgIGxpbmsuaWQgPSBhdHRycy5ocmVmO1xyXG4gICAgICAgIF9zZXRBdHRycyhsaW5rLCBhdHRycyk7XHJcbiAgICAgICAgXHJcbiAgICAgICAgcmV0dXJuIGxpbms7XHJcbiAgICB9XHJcbiAgICAvLyNlbmRyZWdpb24gUFVCTElDIFxyXG5cclxuICAgIC8vI3JlZ2lvbiBQUklWQVRFXHJcbiAgICBmdW5jdGlvbiBfc2V0QXR0cnMoZWwsIGF0dHJzKSB7XHJcbiAgICAgICAgaWYoIWVsIHx8ICFhdHRycylcclxuICAgICAgICAgICAgdGhyb3cgbmV3IEVycm9yKCdNaXNzZWQgYXR0cmlidXRlcycpO1xyXG5cclxuICAgICAgICBmb3IodmFyIGtleSBpbiBhdHRycykge1xyXG4gICAgICAgICAgICBpZighYXR0cnMuaGFzT3duUHJvcGVydHkoa2V5KSlcclxuICAgICAgICAgICAgICAgIGNvbnRpbnVlO1xyXG5cclxuICAgICAgICAgICAgZWxba2V5XSA9IGF0dHJzW2tleV07XHJcbiAgICAgICAgfVxyXG4gICAgfVxyXG59OyJdfQ==
