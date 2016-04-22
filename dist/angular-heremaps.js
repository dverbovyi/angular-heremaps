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

            var heremaps = {};
            
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
                heremaps.platform = new H.service.Platform(Config);
                heremaps.layers = heremaps.platform.createDefaultLayers();
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
                var map = heremaps.map = new H.Map($element[0], heremaps.layers.normal.map, {
                    zoom: options.zoom,
                    center: new H.geo.Point(position.latitude, position.longitude)
                });

                $scope.onMapReady && $scope.onMapReady(MapProxy());

                cb && cb();
            }

            function _navigate(coords) {
                if (!heremaps.map)
                    _setupMap(coords)
            }

            function _addEventListeners() {
                $rootScope.$on(CONSTS.MAP_EVENTS.RELOAD, function(e, coords) {
                    _initMap();
                });

                $rootScope.$on(CONSTS.MAP_EVENTS.NAVIGATE, function(e, coords) {
                    position = coords;
                    heremaps.map.setCenter(coords);
                });
            }

            function _uiModuleReady() {
                heremaps.ui = H.ui.UI.createDefault(heremaps.map,heremaps.layers);
            }

            function _panoModuleReady() {
                //heremaps.platform.configure(H.map.render.panorama.RenderEngine);
            }

            function _eventsModuleReady() {
                var map = heremaps.map,
                    events = heremaps.mapEvents = new H.mapevents.MapEvents(map),
                    behavior = heremaps.behavior = new H.mapevents.Behavior(events);

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

                MarkersService.addMarkerToMap(heremaps.map, $scope.places);

            }

            function _resizeHandler() {
                _setMapSize();

                heremaps.map.getViewPort().resize();
            }

            function _setMapSize() {
                $scope.mapHeight = options.height + 'px';
                $scope.mapWidth = options.width + 'px';

                UtilsService.runScopeDigestIfNeed($scope);
            }
            
            function MapProxy(){
                return {
                    getMap: function(){
                        return heremaps.map
                    },
                    setCenter: function(coords) {
                        if (!coords) {
                            return _getLocation()
                                .then(function(response){
                                   heremaps.map.setCenter({
                                        lng: response.coords.longitude,
                                        lat: response.coords.latitude
                                    });        
                                })
                                .catch(_locationFailure);
                        }

                        heremaps.map.setCenter(coords);        
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


//# sourceMappingURL=data:application/json;base64,eyJ2ZXJzaW9uIjozLCJzb3VyY2VzIjpbIm5vZGVfbW9kdWxlcy9icm93c2VyLXBhY2svX3ByZWx1ZGUuanMiLCJzcmMvaGVyZW1hcHMuZGlyZWN0aXZlLmpzIiwic3JjL2hlcmVtYXBzLm1vZHVsZS5qcyIsInNyYy9wcm92aWRlcnMvYXBpLnNlcnZpY2UuanMiLCJzcmMvcHJvdmlkZXJzL2NvbmZpZy5wcm92aWRlci5qcyIsInNyYy9wcm92aWRlcnMvY29uc3RzLmpzIiwic3JjL3Byb3ZpZGVycy9tYXJrZXJzL2RlZmF1bHQubWFya2VyLmpzIiwic3JjL3Byb3ZpZGVycy9tYXJrZXJzL2RvbS5tYXJrZXIuanMiLCJzcmMvcHJvdmlkZXJzL21hcmtlcnMvbWFya2VyLmpzIiwic3JjL3Byb3ZpZGVycy9tYXJrZXJzL21hcmtlcnMubW9kdWxlLmpzIiwic3JjL3Byb3ZpZGVycy9tYXJrZXJzL21hcmtlcnMuc2VydmljZS5qcyIsInNyYy9wcm92aWRlcnMvbWFya2Vycy9zdmcubWFya2VyLmpzIiwic3JjL3Byb3ZpZGVycy91dGlscy5zZXJ2aWNlLmpzIl0sIm5hbWVzIjpbXSwibWFwcGluZ3MiOiJBQUFBO0FDQUE7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTs7QUNqTUE7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBOztBQzdCQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7O0FDdk5BO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7O0FDaEJBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBOztBQ3JCQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBOztBQ2hCQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTs7QUN6REE7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7O0FDM0JBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBOztBQ3JCQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBOztBQzlDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBOztBQzVCQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0EiLCJmaWxlIjoiYW5ndWxhci1oZXJlbWFwcy5qcyIsInNvdXJjZVJvb3QiOiIvc291cmNlLyIsInNvdXJjZXNDb250ZW50IjpbIihmdW5jdGlvbiBlKHQsbixyKXtmdW5jdGlvbiBzKG8sdSl7aWYoIW5bb10pe2lmKCF0W29dKXt2YXIgYT10eXBlb2YgcmVxdWlyZT09XCJmdW5jdGlvblwiJiZyZXF1aXJlO2lmKCF1JiZhKXJldHVybiBhKG8sITApO2lmKGkpcmV0dXJuIGkobywhMCk7dmFyIGY9bmV3IEVycm9yKFwiQ2Fubm90IGZpbmQgbW9kdWxlICdcIitvK1wiJ1wiKTt0aHJvdyBmLmNvZGU9XCJNT0RVTEVfTk9UX0ZPVU5EXCIsZn12YXIgbD1uW29dPXtleHBvcnRzOnt9fTt0W29dWzBdLmNhbGwobC5leHBvcnRzLGZ1bmN0aW9uKGUpe3ZhciBuPXRbb11bMV1bZV07cmV0dXJuIHMobj9uOmUpfSxsLGwuZXhwb3J0cyxlLHQsbixyKX1yZXR1cm4gbltvXS5leHBvcnRzfXZhciBpPXR5cGVvZiByZXF1aXJlPT1cImZ1bmN0aW9uXCImJnJlcXVpcmU7Zm9yKHZhciBvPTA7bzxyLmxlbmd0aDtvKyspcyhyW29dKTtyZXR1cm4gc30pIiwiLyoqXHJcbiAqIENyZWF0ZWQgYnkgRG15dHJvIG9uIDQvMTEvMjAxNi5cclxuICovXHJcbm1vZHVsZS5leHBvcnRzID0gZnVuY3Rpb24oXHJcbiAgICAkd2luZG93LFxyXG4gICAgJHJvb3RTY29wZSxcclxuICAgIENvbmZpZyxcclxuICAgIEFQSVNlcnZpY2UsXHJcbiAgICBVdGlsc1NlcnZpY2UsXHJcbiAgICBNYXJrZXJzU2VydmljZSxcclxuICAgIENPTlNUUykge1xyXG4gICAgcmV0dXJuIHtcclxuICAgICAgICByZXN0cmljdDogJ0VBJyxcclxuICAgICAgICB0ZW1wbGF0ZTogXCI8ZGl2IG5nLXN0eWxlPVxcXCJ7J3dpZHRoJzogbWFwV2lkdGgsICdoZWlnaHQnOiBtYXBIZWlnaHR9XFxcIj48L2Rpdj5cIixcclxuICAgICAgICByZXBsYWNlOiB0cnVlLFxyXG4gICAgICAgIHNjb3BlOiB7XHJcbiAgICAgICAgICAgIG9wdHM6ICc9b3B0aW9ucycsXHJcbiAgICAgICAgICAgIHBsYWNlczogJz0nLFxyXG4gICAgICAgICAgICBvbk1hcFJlYWR5OiBcIj1tYXBSZWFkeVwiXHJcbiAgICAgICAgfSxcclxuICAgICAgICBjb250cm9sbGVyOiBmdW5jdGlvbigkc2NvcGUsICRlbGVtZW50LCAkYXR0cnMpIHtcclxuICAgICAgICAgICAgdmFyIG9wdGlvbnMgPSBhbmd1bGFyLmV4dGVuZCh7fSwgQ09OU1RTLkRFRkFVTFRfTUFQX09QVElPTlMsICRzY29wZS5vcHRzKSxcclxuICAgICAgICAgICAgICAgIHBvc2l0aW9uID0gb3B0aW9ucy5jb29yZHM7XHJcblxyXG4gICAgICAgICAgICB2YXIgaGVyZW1hcHMgPSB7fTtcclxuICAgICAgICAgICAgXHJcbiAgICAgICAgICAgIEFQSVNlcnZpY2UubG9hZEFwaSgpLnRoZW4oX2FwaVJlYWR5KTtcclxuXHJcbiAgICAgICAgICAgIF9zZXRNYXBTaXplKCk7XHJcblxyXG4gICAgICAgICAgICAvLyB2YXIgX3Jlc2l6ZU1hcCA9IFV0aWxzU2VydmljZS50aHJvdHRsZShfcmVzaXplSGFuZGxlciwgQ09OU1RTLlVQREFURV9NQVBfUkVTSVpFX1RJTUVPVVQpO1xyXG4gICAgICAgICAgICAvLyAkd2luZG93LmFkZEV2ZW50TGlzdGVuZXIoJ3Jlc2l6ZScsIF9yZXNpemVNYXApO1xyXG5cclxuICAgICAgICAgICAgJHNjb3BlLiRvbignJGRlc3RvcnknLCBmdW5jdGlvbigpIHtcclxuICAgICAgICAgICAgICAgICR3aW5kb3cucmVtb3ZlRXZlbnRMaXN0ZW5lcigncmVzaXplJywgX3Jlc2l6ZU1hcCk7XHJcbiAgICAgICAgICAgIH0pO1xyXG5cclxuXHJcbiAgICAgICAgICAgIGZ1bmN0aW9uIF9hcGlSZWFkeSgpIHtcclxuICAgICAgICAgICAgICAgIF9zZXR1cE1hcFBsYXRmb3JtKCk7XHJcblxyXG4gICAgICAgICAgICAgICAgX2dldExvY2F0aW9uKClcclxuICAgICAgICAgICAgICAgICAgICAudGhlbihmdW5jdGlvbihyZXNwb25zZSkge1xyXG4gICAgICAgICAgICAgICAgICAgICAgICBfc2V0dXBNYXAoe1xyXG4gICAgICAgICAgICAgICAgICAgICAgICAgICAgbG9uZ2l0dWRlOiByZXNwb25zZS5jb29yZHMubG9uZ2l0dWRlLFxyXG4gICAgICAgICAgICAgICAgICAgICAgICAgICAgbGF0aXR1ZGU6IHJlc3BvbnNlLmNvb3Jkcy5sYXRpdHVkZVxyXG4gICAgICAgICAgICAgICAgICAgICAgICB9KTtcclxuICAgICAgICAgICAgICAgICAgICB9KVxyXG4gICAgICAgICAgICAgICAgICAgIC5jYXRjaChfbG9jYXRpb25GYWlsdXJlKTtcclxuICAgICAgICAgICAgfVxyXG5cclxuICAgICAgICAgICAgZnVuY3Rpb24gX3NldHVwTWFwUGxhdGZvcm0oKSB7XHJcbiAgICAgICAgICAgICAgICBoZXJlbWFwcy5wbGF0Zm9ybSA9IG5ldyBILnNlcnZpY2UuUGxhdGZvcm0oQ29uZmlnKTtcclxuICAgICAgICAgICAgICAgIGhlcmVtYXBzLmxheWVycyA9IGhlcmVtYXBzLnBsYXRmb3JtLmNyZWF0ZURlZmF1bHRMYXllcnMoKTtcclxuICAgICAgICAgICAgfVxyXG5cclxuICAgICAgICAgICAgZnVuY3Rpb24gX2dldExvY2F0aW9uKCkge1xyXG4gICAgICAgICAgICAgICAgcmV0dXJuIEFQSVNlcnZpY2UuZ2V0UG9zaXRpb24oe1xyXG4gICAgICAgICAgICAgICAgICAgIGNvb3JkczogcG9zaXRpb24sXHJcbiAgICAgICAgICAgICAgICAgICAgZW5hYmxlSGlnaEFjY3VyYWN5OiB0cnVlLFxyXG4gICAgICAgICAgICAgICAgICAgIG1heGltdW1BZ2U6IDEwMDAwXHJcbiAgICAgICAgICAgICAgICB9KTtcclxuICAgICAgICAgICAgfVxyXG4gICAgICAgICAgICBcclxuICAgICAgICAgICAgZnVuY3Rpb24gX2xvY2F0aW9uRmFpbHVyZSgpe1xyXG4gICAgICAgICAgICAgICAgY29uc29sZS5lcnJvcignQ2FuXFwndCBnZXQgYSBwb3NpdGlvbicsIGVycm9yKTtcclxuICAgICAgICAgICAgfVxyXG5cclxuICAgICAgICAgICAgZnVuY3Rpb24gX3NldHVwTWFwKGNvb3Jkcykge1xyXG4gICAgICAgICAgICAgICAgaWYgKGNvb3JkcylcclxuICAgICAgICAgICAgICAgICAgICBwb3NpdGlvbiA9IGNvb3JkcztcclxuXHJcbiAgICAgICAgICAgICAgICBfaW5pdE1hcChmdW5jdGlvbigpIHtcclxuICAgICAgICAgICAgICAgICAgICBBUElTZXJ2aWNlLmxvYWRNb2R1bGVzKCRhdHRycy4kYXR0ciwge1xyXG4gICAgICAgICAgICAgICAgICAgICAgICBcImNvbnRyb2xzXCI6IF91aU1vZHVsZVJlYWR5LFxyXG4gICAgICAgICAgICAgICAgICAgICAgICBcImV2ZW50c1wiOiBfZXZlbnRzTW9kdWxlUmVhZHksXHJcbiAgICAgICAgICAgICAgICAgICAgICAgIFwicGFub1wiOiBfcGFub01vZHVsZVJlYWR5XHJcbiAgICAgICAgICAgICAgICAgICAgfSk7XHJcbiAgICAgICAgICAgICAgICB9KTtcclxuXHJcbiAgICAgICAgICAgICAgICBfYWRkRXZlbnRMaXN0ZW5lcnMoKTtcclxuXHJcbiAgICAgICAgICAgIH1cclxuXHJcbiAgICAgICAgICAgIGZ1bmN0aW9uIF9pbml0TWFwKGNiKSB7XHJcbiAgICAgICAgICAgICAgICB2YXIgbWFwID0gaGVyZW1hcHMubWFwID0gbmV3IEguTWFwKCRlbGVtZW50WzBdLCBoZXJlbWFwcy5sYXllcnMubm9ybWFsLm1hcCwge1xyXG4gICAgICAgICAgICAgICAgICAgIHpvb206IG9wdGlvbnMuem9vbSxcclxuICAgICAgICAgICAgICAgICAgICBjZW50ZXI6IG5ldyBILmdlby5Qb2ludChwb3NpdGlvbi5sYXRpdHVkZSwgcG9zaXRpb24ubG9uZ2l0dWRlKVxyXG4gICAgICAgICAgICAgICAgfSk7XHJcblxyXG4gICAgICAgICAgICAgICAgJHNjb3BlLm9uTWFwUmVhZHkgJiYgJHNjb3BlLm9uTWFwUmVhZHkoTWFwUHJveHkoKSk7XHJcblxyXG4gICAgICAgICAgICAgICAgY2IgJiYgY2IoKTtcclxuICAgICAgICAgICAgfVxyXG5cclxuICAgICAgICAgICAgZnVuY3Rpb24gX25hdmlnYXRlKGNvb3Jkcykge1xyXG4gICAgICAgICAgICAgICAgaWYgKCFoZXJlbWFwcy5tYXApXHJcbiAgICAgICAgICAgICAgICAgICAgX3NldHVwTWFwKGNvb3JkcylcclxuICAgICAgICAgICAgfVxyXG5cclxuICAgICAgICAgICAgZnVuY3Rpb24gX2FkZEV2ZW50TGlzdGVuZXJzKCkge1xyXG4gICAgICAgICAgICAgICAgJHJvb3RTY29wZS4kb24oQ09OU1RTLk1BUF9FVkVOVFMuUkVMT0FELCBmdW5jdGlvbihlLCBjb29yZHMpIHtcclxuICAgICAgICAgICAgICAgICAgICBfaW5pdE1hcCgpO1xyXG4gICAgICAgICAgICAgICAgfSk7XHJcblxyXG4gICAgICAgICAgICAgICAgJHJvb3RTY29wZS4kb24oQ09OU1RTLk1BUF9FVkVOVFMuTkFWSUdBVEUsIGZ1bmN0aW9uKGUsIGNvb3Jkcykge1xyXG4gICAgICAgICAgICAgICAgICAgIHBvc2l0aW9uID0gY29vcmRzO1xyXG4gICAgICAgICAgICAgICAgICAgIGhlcmVtYXBzLm1hcC5zZXRDZW50ZXIoY29vcmRzKTtcclxuICAgICAgICAgICAgICAgIH0pO1xyXG4gICAgICAgICAgICB9XHJcblxyXG4gICAgICAgICAgICBmdW5jdGlvbiBfdWlNb2R1bGVSZWFkeSgpIHtcclxuICAgICAgICAgICAgICAgIGhlcmVtYXBzLnVpID0gSC51aS5VSS5jcmVhdGVEZWZhdWx0KGhlcmVtYXBzLm1hcCxoZXJlbWFwcy5sYXllcnMpO1xyXG4gICAgICAgICAgICB9XHJcblxyXG4gICAgICAgICAgICBmdW5jdGlvbiBfcGFub01vZHVsZVJlYWR5KCkge1xyXG4gICAgICAgICAgICAgICAgLy9oZXJlbWFwcy5wbGF0Zm9ybS5jb25maWd1cmUoSC5tYXAucmVuZGVyLnBhbm9yYW1hLlJlbmRlckVuZ2luZSk7XHJcbiAgICAgICAgICAgIH1cclxuXHJcbiAgICAgICAgICAgIGZ1bmN0aW9uIF9ldmVudHNNb2R1bGVSZWFkeSgpIHtcclxuICAgICAgICAgICAgICAgIHZhciBtYXAgPSBoZXJlbWFwcy5tYXAsXHJcbiAgICAgICAgICAgICAgICAgICAgZXZlbnRzID0gaGVyZW1hcHMubWFwRXZlbnRzID0gbmV3IEgubWFwZXZlbnRzLk1hcEV2ZW50cyhtYXApLFxyXG4gICAgICAgICAgICAgICAgICAgIGJlaGF2aW9yID0gaGVyZW1hcHMuYmVoYXZpb3IgPSBuZXcgSC5tYXBldmVudHMuQmVoYXZpb3IoZXZlbnRzKTtcclxuXHJcbiAgICAgICAgICAgICAgICBtYXAuYWRkRXZlbnRMaXN0ZW5lcigndGFwJywgZnVuY3Rpb24oZXZ0KSB7XHJcbiAgICAgICAgICAgICAgICAgICAgLy8gY29uc29sZS5sb2coZXZ0LnR5cGUsIGV2dC5jdXJyZW50UG9pbnRlci50eXBlKTtcclxuICAgICAgICAgICAgICAgIH0pO1xyXG5cclxuICAgICAgICAgICAgICAgIG1hcC5hZGRFdmVudExpc3RlbmVyKCdkcmFnc3RhcnQnLCBmdW5jdGlvbihldikge1xyXG4gICAgICAgICAgICAgICAgICAgIHZhciB0YXJnZXQgPSBldi50YXJnZXQ7XHJcbiAgICAgICAgICAgICAgICAgICAgaWYgKHRhcmdldCBpbnN0YW5jZW9mIEgubWFwLk1hcmtlcikge1xyXG4gICAgICAgICAgICAgICAgICAgICAgICBiZWhhdmlvci5kaXNhYmxlKCk7XHJcbiAgICAgICAgICAgICAgICAgICAgfVxyXG4gICAgICAgICAgICAgICAgfSwgZmFsc2UpO1xyXG5cclxuICAgICAgICAgICAgICAgIG1hcC5hZGRFdmVudExpc3RlbmVyKCdkcmFnJywgZnVuY3Rpb24oZXYpIHtcclxuICAgICAgICAgICAgICAgICAgICB2YXIgdGFyZ2V0ID0gZXYudGFyZ2V0LFxyXG4gICAgICAgICAgICAgICAgICAgICAgICBwb2ludGVyID0gZXYuY3VycmVudFBvaW50ZXI7XHJcbiAgICAgICAgICAgICAgICAgICAgaWYgKHRhcmdldCBpbnN0YW5jZW9mIG1hcHNqcy5tYXAuTWFya2VyKSB7XHJcbiAgICAgICAgICAgICAgICAgICAgICAgIHRhcmdldC5zZXRQb3NpdGlvbihtYXAuc2NyZWVuVG9HZW8ocG9pbnRlci52aWV3cG9ydFgsIHBvaW50ZXIudmlld3BvcnRZKSk7XHJcbiAgICAgICAgICAgICAgICAgICAgfVxyXG4gICAgICAgICAgICAgICAgfSwgZmFsc2UpO1xyXG5cclxuICAgICAgICAgICAgICAgIG1hcC5hZGRFdmVudExpc3RlbmVyKCdkcmFnZW5kJywgZnVuY3Rpb24oZXYpIHtcclxuICAgICAgICAgICAgICAgICAgICB2YXIgdGFyZ2V0ID0gZXYudGFyZ2V0O1xyXG4gICAgICAgICAgICAgICAgICAgIGlmICh0YXJnZXQgaW5zdGFuY2VvZiBtYXBzanMubWFwLk1hcmtlcikge1xyXG4gICAgICAgICAgICAgICAgICAgICAgICBiZWhhdmlvci5lbmFibGUoKTtcclxuICAgICAgICAgICAgICAgICAgICB9XHJcbiAgICAgICAgICAgICAgICB9LCBmYWxzZSk7XHJcblxyXG4gICAgICAgICAgICAgICAgbWFwLmRyYWdnYWJsZSA9IG9wdGlvbnMuZHJhZ2dhYmxlO1xyXG5cclxuICAgICAgICAgICAgICAgIE1hcmtlcnNTZXJ2aWNlLmFkZE1hcmtlclRvTWFwKGhlcmVtYXBzLm1hcCwgJHNjb3BlLnBsYWNlcyk7XHJcblxyXG4gICAgICAgICAgICB9XHJcblxyXG4gICAgICAgICAgICBmdW5jdGlvbiBfcmVzaXplSGFuZGxlcigpIHtcclxuICAgICAgICAgICAgICAgIF9zZXRNYXBTaXplKCk7XHJcblxyXG4gICAgICAgICAgICAgICAgaGVyZW1hcHMubWFwLmdldFZpZXdQb3J0KCkucmVzaXplKCk7XHJcbiAgICAgICAgICAgIH1cclxuXHJcbiAgICAgICAgICAgIGZ1bmN0aW9uIF9zZXRNYXBTaXplKCkge1xyXG4gICAgICAgICAgICAgICAgJHNjb3BlLm1hcEhlaWdodCA9IG9wdGlvbnMuaGVpZ2h0ICsgJ3B4JztcclxuICAgICAgICAgICAgICAgICRzY29wZS5tYXBXaWR0aCA9IG9wdGlvbnMud2lkdGggKyAncHgnO1xyXG5cclxuICAgICAgICAgICAgICAgIFV0aWxzU2VydmljZS5ydW5TY29wZURpZ2VzdElmTmVlZCgkc2NvcGUpO1xyXG4gICAgICAgICAgICB9XHJcbiAgICAgICAgICAgIFxyXG4gICAgICAgICAgICBmdW5jdGlvbiBNYXBQcm94eSgpe1xyXG4gICAgICAgICAgICAgICAgcmV0dXJuIHtcclxuICAgICAgICAgICAgICAgICAgICBnZXRNYXA6IGZ1bmN0aW9uKCl7XHJcbiAgICAgICAgICAgICAgICAgICAgICAgIHJldHVybiBoZXJlbWFwcy5tYXBcclxuICAgICAgICAgICAgICAgICAgICB9LFxyXG4gICAgICAgICAgICAgICAgICAgIHNldENlbnRlcjogZnVuY3Rpb24oY29vcmRzKSB7XHJcbiAgICAgICAgICAgICAgICAgICAgICAgIGlmICghY29vcmRzKSB7XHJcbiAgICAgICAgICAgICAgICAgICAgICAgICAgICByZXR1cm4gX2dldExvY2F0aW9uKClcclxuICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAudGhlbihmdW5jdGlvbihyZXNwb25zZSl7XHJcbiAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgaGVyZW1hcHMubWFwLnNldENlbnRlcih7XHJcbiAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICBsbmc6IHJlc3BvbnNlLmNvb3Jkcy5sb25naXR1ZGUsXHJcbiAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICBsYXQ6IHJlc3BvbnNlLmNvb3Jkcy5sYXRpdHVkZVxyXG4gICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICB9KTsgICAgICAgIFxyXG4gICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgIH0pXHJcbiAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgLmNhdGNoKF9sb2NhdGlvbkZhaWx1cmUpO1xyXG4gICAgICAgICAgICAgICAgICAgICAgICB9XHJcblxyXG4gICAgICAgICAgICAgICAgICAgICAgICBoZXJlbWFwcy5tYXAuc2V0Q2VudGVyKGNvb3Jkcyk7ICAgICAgICBcclxuICAgICAgICAgICAgICAgICAgICB9XHJcbiAgICAgICAgICAgICAgICB9XHJcbiAgICAgICAgICAgIH1cclxuICAgICAgICAgICAgXHJcbiAgICAgICAgfVxyXG4gICAgfVxyXG59OyIsInJlcXVpcmUoJy4vcHJvdmlkZXJzL21hcmtlcnMvbWFya2Vycy5tb2R1bGUnKTtcclxuXHJcbnZhciBkaXJlY3RpdmUgPSByZXF1aXJlKCcuL2hlcmVtYXBzLmRpcmVjdGl2ZScpLFxyXG4gICAgY29uZmlnUHJvdmlkZXIgPSByZXF1aXJlKCcuL3Byb3ZpZGVycy9jb25maWcucHJvdmlkZXInKSxcclxuICAgIGFwaVNlcnZpY2UgPSByZXF1aXJlKCcuL3Byb3ZpZGVycy9hcGkuc2VydmljZScpLFxyXG4gICAgdXRpbHNTZXJ2aWNlID0gcmVxdWlyZSgnLi9wcm92aWRlcnMvdXRpbHMuc2VydmljZScpLFxyXG4gICAgY29uc3RzID0gcmVxdWlyZSgnLi9wcm92aWRlcnMvY29uc3RzJyk7XHJcblxyXG52YXIgaGVyZW1hcHMgPSBhbmd1bGFyLm1vZHVsZSgnaGVyZW1hcHMnLCBbXHJcbiAgICAnbWFya2Vycy1tb2R1bGUnXHJcbl0pO1xyXG5cclxuaGVyZW1hcHNcclxuICAgIC5wcm92aWRlcignQ29uZmlnJywgY29uZmlnUHJvdmlkZXIpXHJcbiAgICAuc2VydmljZSgnQVBJU2VydmljZScsIFsnJHEnLCAnQ29uZmlnJywgJ1V0aWxzU2VydmljZScsICdDT05TVFMnLCBhcGlTZXJ2aWNlXSlcclxuICAgIC5zZXJ2aWNlKCdVdGlsc1NlcnZpY2UnLCB1dGlsc1NlcnZpY2UpXHJcbiAgICAuY29uc3RhbnQoJ0NPTlNUUycsIGNvbnN0cylcclxuXHJcbmhlcmVtYXBzLmRpcmVjdGl2ZSgnaGVyZW1hcHMnLCBkaXJlY3RpdmUpO1xyXG5cclxuaGVyZW1hcHMuY29uZmlnKFtcIkNvbmZpZ1Byb3ZpZGVyXCIsIGZ1bmN0aW9uKENvbmZpZ1Byb3ZpZGVyKSB7XHJcbiAgICBDb25maWdQcm92aWRlci5zZXRPcHRpb25zKHtcclxuICAgICAgICAnYXBpVmVyc2lvbic6ICczLjAnLFxyXG4gICAgICAgICdhcHBfaWQnOiAnd01ISnVMZ0NRemtmYmh6WEl3UkYnLFxyXG4gICAgICAgICdhcHBfY29kZSc6ICdXTEljN1F6b084aXJ2N2x1clV0MXFBJyxcclxuICAgICAgICAndXNlSFRUUFMnOiB0cnVlXHJcbiAgICB9KTtcclxufV0pO1xyXG5cclxubW9kdWxlLmV4cG9ydHMgPSBoZXJlbWFwczsiLCJtb2R1bGUuZXhwb3J0cyA9IGZ1bmN0aW9uKCRxLCBDb25maWcsIFV0aWxzU2VydmljZSwgQ09OU1RTKSB7XHJcbiAgICB2YXIgdmVyc2lvbiA9IENvbmZpZy5hcGlWZXJzaW9uO1xyXG5cclxuICAgIHZhciBBUElfVkVSU0lPTiA9IHtcclxuICAgICAgICBWOiBwYXJzZUludCh2ZXJzaW9uKSxcclxuICAgICAgICBTVUI6IHZlcnNpb25cclxuICAgIH07XHJcblxyXG4gICAgdmFyIENPTkZJRyA9IHtcclxuICAgICAgICBCQVNFOiBcImh0dHA6Ly9qcy5hcGkuaGVyZS5jb20vdlwiLFxyXG4gICAgICAgIENPUkU6IFwibWFwc2pzLWNvcmUuanNcIixcclxuICAgICAgICBTRVJWSUNFOiBcIm1hcHNqcy1zZXJ2aWNlLmpzXCIsXHJcbiAgICAgICAgVUk6IHtcclxuICAgICAgICAgICAgc3JjOiBcIm1hcHNqcy11aS5qc1wiLFxyXG4gICAgICAgICAgICBocmVmOiBcIm1hcHNqcy11aS5jc3NcIlxyXG4gICAgICAgIH0sXHJcbiAgICAgICAgUEFOTzogXCJtYXBzanMtcGFuby5qc1wiLFxyXG4gICAgICAgIEVWRU5UUzogXCJtYXBzanMtbWFwZXZlbnRzLmpzXCJcclxuICAgIH07XHJcbiAgICBcclxuICAgIHZhciBBUElfREVGRVJTUXVldWUgPSB7fTtcclxuICAgIFxyXG4gICAgQVBJX0RFRkVSU1F1ZXVlW0NPTkZJRy5DT1JFXSA9IFtdOyAgICBcclxuICAgIEFQSV9ERUZFUlNRdWV1ZVtDT05GSUcuU0VSVklDRV0gPSBbXTtcclxuICAgIEFQSV9ERUZFUlNRdWV1ZVtDT05GSUcuVUkuc3JjXSA9IFtdO1xyXG4gICAgQVBJX0RFRkVSU1F1ZXVlW0NPTkZJRy5QQU5PXSA9IFtdO1xyXG4gICAgQVBJX0RFRkVSU1F1ZXVlW0NPTkZJRy5FVkVOVFNdID0gW107XHJcbiAgICBcclxuICAgIHZhciBoZWFkID0gZG9jdW1lbnQuZ2V0RWxlbWVudHNCeVRhZ05hbWUoJ2hlYWQnKVswXTtcclxuXHJcbiAgICByZXR1cm4ge1xyXG4gICAgICAgIGxvYWRBcGk6IGxvYWRBcGksXHJcbiAgICAgICAgbG9hZE1vZHVsZXM6IGxvYWRNb2R1bGVzLCBcclxuICAgICAgICBnZXRQb3NpdGlvbjogZ2V0UG9zaXRpb25cclxuICAgIH07XHJcblxyXG4gICAgLy8jcmVnaW9uIFBVQkxJQ1xyXG4gICAgZnVuY3Rpb24gbG9hZEFwaSgpIHtcclxuICAgICAgICByZXR1cm4gX2dldExvYWRlcihDT05GSUcuQ09SRSlcclxuICAgICAgICAgICAgLnRoZW4oZnVuY3Rpb24oKSB7XHJcbiAgICAgICAgICAgICAgICByZXR1cm4gX2dldExvYWRlcihDT05GSUcuU0VSVklDRSk7XHJcbiAgICAgICAgICAgIH0pO1xyXG4gICAgfVxyXG4gICAgXHJcbiAgICBmdW5jdGlvbiBsb2FkTW9kdWxlcyhhdHRycywgaGFuZGxlcnMpe1xyXG4gICAgICAgIGZvcih2YXIga2V5IGluIGhhbmRsZXJzKSB7XHJcbiAgICAgICAgICAgIGlmKCFoYW5kbGVycy5oYXNPd25Qcm9wZXJ0eShrZXkpIHx8ICFhdHRyc1trZXldKVxyXG4gICAgICAgICAgICAgICAgY29udGludWU7XHJcbiAgICAgICAgICAgICAgICBcclxuICAgICAgICAgICAgdmFyIGxvYWRlciA9IF9nZXRMb2FkZXJCeUF0dHIoa2V5KTtcclxuICAgICAgICAgICAgbG9hZGVyKClcclxuICAgICAgICAgICAgICAgIC50aGVuKGhhbmRsZXJzW2tleV0pXHJcbiAgICAgICAgfVxyXG4gICAgfVxyXG4gICAgXHJcbiAgICBmdW5jdGlvbiBfZ2V0TG9hZGVyQnlBdHRyKGF0dHIpe1xyXG4gICAgICAgIHZhciBsb2FkZXI7XHJcbiAgICAgICAgXHJcbiAgICAgICAgc3dpdGNoKGF0dHIpIHtcclxuICAgICAgICAgICAgY2FzZSBDT05TVFMuTU9EVUxFUy5VSTpcclxuICAgICAgICAgICAgICAgIGxvYWRlciA9IGxvYWRVSU1vZHVsZTtcclxuICAgICAgICAgICAgICAgIGJyZWFrO1xyXG4gICAgICAgICAgICBjYXNlIENPTlNUUy5NT0RVTEVTLkVWRU5UUzpcclxuICAgICAgICAgICAgICAgIGxvYWRlciA9IGxvYWRFdmVudHNNb2R1bGU7XHJcbiAgICAgICAgICAgICAgICBicmVhaztcclxuICAgICAgICAgICAgY2FzZSBDT05TVFMuTU9EVUxFUy5QQU5POlxyXG4gICAgICAgICAgICAgICAgbG9hZGVyID0gbG9hZFBhbm9Nb2R1bGU7XHJcbiAgICAgICAgICAgICAgICBicmVhaztcclxuICAgICAgICAgICAgZGVmYXVsdDpcclxuICAgICAgICAgICAgICAgIHRocm93IG5ldyBFcnJvcignVW5rbm93biBtb2R1bGUnLCBhdHRyKTtcclxuICAgICAgICB9XHJcbiAgICAgICAgXHJcbiAgICAgICAgcmV0dXJuIGxvYWRlcjtcclxuICAgIH1cclxuXHJcbiAgICBmdW5jdGlvbiBsb2FkVUlNb2R1bGUoKSB7XHJcbiAgICAgICAgaWYgKCFfaXNMb2FkZWQoQ09ORklHLlVJKSkge1xyXG4gICAgICAgICAgICB2YXIgbGluayA9IFV0aWxzU2VydmljZS5jcmVhdGVMaW5rVGFnKHtcclxuICAgICAgICAgICAgICAgIHJlbDogJ3N0eWxlc2hlZXQnLFxyXG4gICAgICAgICAgICAgICAgdHlwZTogJ3RleHQvY3NzJyxcclxuICAgICAgICAgICAgICAgIGhyZWY6IF9nZXRVUkwoQ09ORklHLlVJLmhyZWYpXHJcbiAgICAgICAgICAgIH0pO1xyXG5cclxuICAgICAgICAgICAgbGluayAmJiBoZWFkLmFwcGVuZENoaWxkKGxpbmspO1xyXG4gICAgICAgIH1cclxuXHJcbiAgICAgICAgcmV0dXJuIF9nZXRMb2FkZXIoQ09ORklHLlVJLnNyYyk7XHJcbiAgICB9XHJcblxyXG4gICAgZnVuY3Rpb24gbG9hZFBhbm9Nb2R1bGUoKSB7XHJcbiAgICAgICAgcmV0dXJuIF9nZXRMb2FkZXIoQ09ORklHLlBBTk8pO1xyXG4gICAgfVxyXG5cclxuICAgIGZ1bmN0aW9uIGxvYWRFdmVudHNNb2R1bGUoKSB7XHJcbiAgICAgICAgcmV0dXJuIF9nZXRMb2FkZXIoQ09ORklHLkVWRU5UUyk7XHJcbiAgICB9XHJcblxyXG4gICAgZnVuY3Rpb24gZ2V0UG9zaXRpb24ob3B0aW9ucykge1xyXG4gICAgICAgIHZhciBjb29yZHNFeGlzdCA9IG9wdGlvbnMuY29vcmRzICYmICh0eXBlb2Ygb3B0aW9ucy5jb29yZHMubGF0aXR1ZGUgPT09ICdudW1iZXInICYmIHR5cGVvZiBvcHRpb25zLmNvb3Jkcy5sb25naXR1ZGUgPT09ICdudW1iZXInKTsgXHJcblxyXG4gICAgICAgIHZhciBkZXJlcnJlZCA9ICRxLmRlZmVyKCk7XHJcblxyXG4gICAgICAgIGlmKGNvb3Jkc0V4aXN0KSB7XHJcbiAgICAgICAgICAgIGRlcmVycmVkLnJlc29sdmUoe2Nvb3Jkczogb3B0aW9ucy5jb29yZHN9KTtcclxuICAgICAgICB9IGVsc2Uge1xyXG4gICAgICAgICAgICBuYXZpZ2F0b3IuZ2VvbG9jYXRpb24uZ2V0Q3VycmVudFBvc2l0aW9uKGZ1bmN0aW9uKHJlc3BvbnNlKSB7XHJcbiAgICAgICAgICAgICAgICBkZXJlcnJlZC5yZXNvbHZlKHJlc3BvbnNlKTtcclxuICAgICAgICAgICAgfSwgZnVuY3Rpb24oZXJyb3IpIHtcclxuICAgICAgICAgICAgICAgIGRlcmVycmVkLnJlamVjdChlcnJvcik7XHJcbiAgICAgICAgICAgIH0sIG9wdGlvbnMpO1xyXG4gICAgICAgIH0gXHJcbiAgICAgICAgXHJcbiAgICAgICAgcmV0dXJuIGRlcmVycmVkLnByb21pc2U7XHJcbiAgICB9XHJcbiAgICAvLyNlbmRyZWdpb24gUFVCTElDXHJcblxyXG5cclxuICAgIC8vI3JlZ2lvbiBQUklWQVRFXHJcbiAgICBmdW5jdGlvbiBfZ2V0VVJMKHNvdXJjZU5hbWUpIHtcclxuICAgICAgICByZXR1cm4gW1xyXG4gICAgICAgICAgICBDT05GSUcuQkFTRSxcclxuICAgICAgICAgICAgQVBJX1ZFUlNJT04uVixcclxuICAgICAgICAgICAgXCIvXCIsXHJcbiAgICAgICAgICAgIEFQSV9WRVJTSU9OLlNVQixcclxuICAgICAgICAgICAgXCIvXCIsXHJcbiAgICAgICAgICAgIHNvdXJjZU5hbWVcclxuICAgICAgICBdLmpvaW4oXCJcIik7XHJcbiAgICB9XHJcblxyXG4gICAgZnVuY3Rpb24gX2dldExvYWRlcihzb3VyY2VOYW1lKSB7XHJcbiAgICAgICAgdmFyIGRlZmVyID0gJHEuZGVmZXIoKTtcclxuICAgICAgICByZXR1cm4gX2lzTG9hZGVkKHNvdXJjZU5hbWUpID8gKGZ1bmN0aW9uKCkge1xyXG4gICAgICAgICAgICBkZWZlci5yZXNvbHZlKCk7XHJcbiAgICAgICAgICAgIHJldHVybiBkZWZlci5wcm9taXNlO1xyXG4gICAgICAgIH0pKCkgOiAoZnVuY3Rpb24oKSB7XHJcbiAgICAgICAgICAgIHZhciBzcmMgPSBfZ2V0VVJMKHNvdXJjZU5hbWUpLFxyXG4gICAgICAgICAgICAgICAgc2NyaXB0ID0gVXRpbHNTZXJ2aWNlLmNyZWF0ZVNjcmlwdFRhZyh7IHNyYzogc3JjIH0pO1xyXG4gICAgICAgICAgICAgICAgXHJcbiAgICAgICAgICAgIHNjcmlwdCAmJiBoZWFkLmFwcGVuZENoaWxkKHNjcmlwdCk7XHJcbiAgICAgICAgICAgIFxyXG4gICAgICAgICAgICBBUElfREVGRVJTUXVldWVbc291cmNlTmFtZV0ucHVzaChkZWZlcik7XHJcbiAgICAgICAgICAgIFxyXG4gICAgICAgICAgICBzY3JpcHQub25sb2FkID0gX29uTG9hZC5iaW5kKG51bGwsIHNvdXJjZU5hbWUpO1xyXG4gICAgICAgICAgICBzY3JpcHQub25lcnJvciA9IF9vbkVycm9yLmJpbmQobnVsbCwgc291cmNlTmFtZSk7XHJcblxyXG4gICAgICAgICAgICByZXR1cm4gZGVmZXIucHJvbWlzZTtcclxuXHJcbiAgICAgICAgfSkoKTtcclxuICAgIH1cclxuXHJcbiAgICBmdW5jdGlvbiBfaXNMb2FkZWQoc291cmNlTmFtZSkge1xyXG4gICAgICAgIHZhciBjaGVja2VyID0gbnVsbDtcclxuXHJcbiAgICAgICAgc3dpdGNoIChzb3VyY2VOYW1lKSB7XHJcbiAgICAgICAgICAgIGNhc2UgQ09ORklHLkNPUkU6XHJcbiAgICAgICAgICAgICAgICBjaGVja2VyID0gX2lzQ29yZUxvYWRlZDtcclxuICAgICAgICAgICAgICAgIGJyZWFrO1xyXG4gICAgICAgICAgICBjYXNlIENPTkZJRy5TRVJWSUNFOlxyXG4gICAgICAgICAgICAgICAgY2hlY2tlciA9IF9pc1NlcnZpY2VMb2FkZWQ7XHJcbiAgICAgICAgICAgICAgICBicmVhaztcclxuICAgICAgICAgICAgY2FzZSBDT05GSUcuVUk6XHJcbiAgICAgICAgICAgICAgICBjaGVja2VyID0gX2lzVUlMb2FkZWQ7XHJcbiAgICAgICAgICAgICAgICBicmVhaztcclxuICAgICAgICAgICAgY2FzZSBDT05GSUcuRVZFTlRTOlxyXG4gICAgICAgICAgICAgICAgY2hlY2tlciA9IF9pc0V2ZW50c0xvYWRlZDtcclxuICAgICAgICAgICAgICAgIGJyZWFrO1xyXG4gICAgICAgICAgICBjYXNlIENPTkZJRy5QQU5POlxyXG4gICAgICAgICAgICAgICAgY2hlY2tlciA9IF9pc1Bhbm9Mb2FkZWQ7XHJcbiAgICAgICAgICAgICAgICBicmVhaztcclxuICAgICAgICAgICAgZGVmYXVsdDpcclxuICAgICAgICAgICAgICAgIGNoZWNrZXIgPSBmdW5jdGlvbigpIHsgcmV0dXJuIGZhbHNlIH07XHJcbiAgICAgICAgfVxyXG5cclxuICAgICAgICByZXR1cm4gY2hlY2tlcigpO1xyXG4gICAgfVxyXG5cclxuICAgIGZ1bmN0aW9uIF9pc0NvcmVMb2FkZWQoKSB7XHJcbiAgICAgICAgcmV0dXJuICEhd2luZG93Lkg7XHJcbiAgICB9XHJcblxyXG4gICAgZnVuY3Rpb24gX2lzU2VydmljZUxvYWRlZCgpIHtcclxuICAgICAgICByZXR1cm4gISEod2luZG93LkggJiYgd2luZG93Lkguc2VydmljZSk7XHJcbiAgICB9XHJcblxyXG4gICAgZnVuY3Rpb24gX2lzVUlMb2FkZWQoKSB7XHJcbiAgICAgICAgcmV0dXJuICEhKHdpbmRvdy5IICYmIHdpbmRvdy5ILnVpKTtcclxuICAgIH1cclxuXHJcbiAgICBmdW5jdGlvbiBfaXNFdmVudHNMb2FkZWQoKSB7XHJcbiAgICAgICAgcmV0dXJuICEhKHdpbmRvdy5IICYmIHdpbmRvdy5ILm1hcGV2ZW50cyk7XHJcbiAgICB9XHJcblxyXG4gICAgZnVuY3Rpb24gX2lzUGFub0xvYWRlZCgpIHtcclxuICAgICAgICByZXR1cm4gISEod2luZG93LkggJiYgd2luZG93LkgucGFubyk7XHJcbiAgICB9XHJcbiAgICBcclxuICAgIGZ1bmN0aW9uIF9vbkxvYWQoc291cmNlTmFtZSl7XHJcbiAgICAgICAgdmFyIGRlZmVyUXVldWUgPSBBUElfREVGRVJTUXVldWVbc291cmNlTmFtZV07XHJcbiAgICAgICAgZm9yKHZhciBpID0gMCwgbCA9IGRlZmVyUXVldWUubGVuZ3RoOyBpIDwgbDsgKytpKSB7XHJcbiAgICAgICAgICAgIHZhciBkZWZlciA9IGRlZmVyUXVldWVbaV07XHJcbiAgICAgICAgICAgIGRlZmVyLnJlc29sdmUoKTtcclxuICAgICAgICB9XHJcbiAgICAgICAgXHJcbiAgICAgICAgQVBJX0RFRkVSU1F1ZXVlW3NvdXJjZU5hbWVdID0gW107XHJcbiAgICB9XHJcbiAgICBcclxuICAgIGZ1bmN0aW9uIF9vbkVycm9yKHNvdXJjZU5hbWUpIHtcclxuICAgICAgICB2YXIgZGVmZXJRdWV1ZSA9IEFQSV9ERUZFUlNRdWV1ZVtzb3VyY2VOYW1lXTtcclxuICAgICAgICBmb3IodmFyIGkgPSAwLCBsID0gZGVmZXJRdWV1ZS5sZW5ndGg7IGkgPCBsOyArK2kpIHtcclxuICAgICAgICAgICAgdmFyIGRlZmVyID0gZGVmZXJRdWV1ZVtpXTtcclxuICAgICAgICAgICAgZGVmZXIucmVqZWN0KCk7XHJcbiAgICAgICAgfVxyXG4gICAgICAgIFxyXG4gICAgICAgIEFQSV9ERUZFUlNRdWV1ZVtzb3VyY2VOYW1lXSA9IFtdO1xyXG4gICAgfVxyXG59OyIsIm1vZHVsZS5leHBvcnRzID0gZnVuY3Rpb24oKSB7XHJcbiAgICB2YXIgb3B0aW9ucyA9IHt9O1xyXG4gICAgdmFyIERFRkFVTFRfQVBJX1ZFUlNJT04gPSBcIjMuMFwiO1xyXG5cclxuICAgIHRoaXMuJGdldCA9IGZ1bmN0aW9uKCl7XHJcbiAgICAgICAgcmV0dXJuIHtcclxuICAgICAgICAgICAgYXBwX2lkOiBvcHRpb25zLmFwcF9pZCxcclxuICAgICAgICAgICAgYXBwX2NvZGU6IG9wdGlvbnMuYXBwX2NvZGUsXHJcbiAgICAgICAgICAgIGFwaVZlcnNpb246IG9wdGlvbnMuYXBpVmVyc2lvbiB8fCBERUZBVUxUX0FQSV9WRVJTSU9OLFxyXG4gICAgICAgICAgICB1c2VIVFRQUzogb3B0aW9ucy51c2VIVFRQU1xyXG4gICAgICAgIH1cclxuICAgIH07XHJcblxyXG4gICAgdGhpcy5zZXRPcHRpb25zID0gZnVuY3Rpb24ob3B0cyl7XHJcbiAgICAgICAgb3B0aW9ucyA9IG9wdHM7XHJcbiAgICB9O1xyXG59OyIsIm1vZHVsZS5leHBvcnRzID0ge1xyXG4gICAgXCJVUERBVEVfTUFQX1JFU0laRV9USU1FT1VUXCI6IDUwMCxcclxuICAgIFwiTU9EVUxFU1wiOiB7XHJcbiAgICAgICAgVUk6ICdjb250cm9scycsXHJcbiAgICAgICAgRVZFTlRTOiAnZXZlbnRzJyxcclxuICAgICAgICBQQU5POiAncGFubydcclxuICAgIH0sXHJcbiAgICBcIkRFRkFVTFRfTUFQX09QVElPTlNcIjoge1xyXG4gICAgICAgIGhlaWdodDogNDgwLFxyXG4gICAgICAgIHdpZHRoOiA2NDAsXHJcbiAgICAgICAgem9vbTogMTAsXHJcbiAgICAgICAgZHJhZ2dhYmxlOiBmYWxzZVxyXG4gICAgfSxcclxuICAgIFwiTUFSS0VSX1RZUEVTXCI6IHtcclxuICAgICAgICBET006IFwiRE9NXCIsXHJcbiAgICAgICAgU1ZHOiBcIlNWR1wiXHJcbiAgICB9LFxyXG4gICAgXCJNQVBfRVZFTlRTXCI6IHtcclxuICAgICAgICBOQVZJR0FURTogXCJOQVZJR0FURVwiLFxyXG4gICAgICAgIFJFTE9BRDogXCJSRUxPQURcIlxyXG4gICAgfVxyXG59IiwibW9kdWxlLmV4cG9ydHMgPSBmdW5jdGlvbihNYXJrZXJJbnRlcmZhY2Upe1xyXG4gICAgZnVuY3Rpb24gRGVmYXVsdE1hcmtlcihwbGFjZSl7XHJcbiAgICAgICAgdGhpcy5wbGFjZSA9IHBsYWNlO1xyXG4gICAgICAgIHRoaXMuc2V0Q29vcmRzKCk7XHJcbiAgICB9XHJcblxyXG4gICAgdmFyIHByb3RvID0gRGVmYXVsdE1hcmtlci5wcm90b3R5cGUgPSBuZXcgTWFya2VySW50ZXJmYWNlKCk7XHJcbiAgICBwcm90by5jb25zdHJ1Y3RvciA9IERlZmF1bHRNYXJrZXI7XHJcblxyXG4gICAgcHJvdG8uY3JlYXRlID0gY3JlYXRlO1xyXG5cclxuICAgIHJldHVybiBEZWZhdWx0TWFya2VyO1xyXG4gICAgXHJcbiAgICBmdW5jdGlvbiBjcmVhdGUoKXtcclxuICAgICAgICByZXR1cm4gbmV3IEgubWFwLk1hcmtlcih0aGlzLmNvb3Jkcyk7XHJcbiAgICB9XHJcbn0iLCJtb2R1bGUuZXhwb3J0cyA9IGZ1bmN0aW9uKE1hcmtlckludGVyZmFjZSl7XHJcbiAgICBmdW5jdGlvbiBET01NYXJrZXIocGxhY2Upe1xyXG4gICAgICAgIHRoaXMucGxhY2UgPSBwbGFjZTtcclxuICAgICAgICB0aGlzLnNldENvb3JkcygpO1xyXG4gICAgfVxyXG5cclxuICAgIHZhciBwcm90byA9IERPTU1hcmtlci5wcm90b3R5cGUgPSBuZXcgTWFya2VySW50ZXJmYWNlKCk7XHJcbiAgICBwcm90by5jb25zdHJ1Y3RvciA9IERPTU1hcmtlcjtcclxuXHJcbiAgICBwcm90by5jcmVhdGUgPSBjcmVhdGU7XHJcbiAgICBwcm90by5fZ2V0SWNvbiA9IF9nZXRJY29uO1xyXG4gICAgcHJvdG8uX3NldHVwRXZlbnRzID0gX3NldHVwRXZlbnRzO1xyXG4gICAgcHJvdG8uX2dldEV2ZW50cyA9IF9nZXRFdmVudHM7XHJcblxyXG4gICAgcmV0dXJuIERPTU1hcmtlcjtcclxuICAgIFxyXG4gICAgZnVuY3Rpb24gY3JlYXRlKCl7XHJcbiAgICAgICAgcmV0dXJuIG5ldyBILm1hcC5Eb21NYXJrZXIodGhpcy5jb29yZHMsIHtcclxuICAgICAgICAgICAgaWNvbjogdGhpcy5fZ2V0SWNvbigpLFxyXG4gICAgICAgIH0pO1xyXG4gICAgfVxyXG4gICAgXHJcbiAgICBmdW5jdGlvbiBfZ2V0SWNvbigpe1xyXG4gICAgICAgIHZhciBpY29uID0gdGhpcy5wbGFjZS5tYXJrdXA7XHJcbiAgICAgICAgIGlmKCFpY29uKVxyXG4gICAgICAgICAgICB0aHJvdyBuZXcgRXJyb3IoJ21hcmt1cCBtaXNzZWQnKTtcclxuXHJcbiAgICAgICAgcmV0dXJuIG5ldyBILm1hcC5Eb21JY29uKGljb24sIHRoaXMuX2dldEV2ZW50cygpKTtcclxuICAgIH1cclxuICAgIFxyXG4gICAgZnVuY3Rpb24gX3NldHVwRXZlbnRzKGVsLCBldmVudHMsIHJlbW92ZSl7XHJcbiAgICAgICAgdmFyIG1ldGhvZCA9IHJlbW92ZSA/ICdyZW1vdmVFdmVudExpc3RlbmVyJyA6ICdhZGRFdmVudExpc3RlbmVyJztcclxuXHJcbiAgICAgICAgZm9yKHZhciBrZXkgaW4gZXZlbnRzKSB7XHJcbiAgICAgICAgICAgIGlmKCFldmVudHMuaGFzT3duUHJvcGVydHkoa2V5KSlcclxuICAgICAgICAgICAgICAgIGNvbnRpbnVlO1xyXG5cclxuICAgICAgICAgICAgZWxbbWV0aG9kXS5jYWxsKG51bGwsIGtleSwgZXZlbnRzW2tleV0pO1xyXG4gICAgICAgIH1cclxuICAgIH1cclxuICAgIFxyXG4gICAgZnVuY3Rpb24gX2dldEV2ZW50cygpe1xyXG4gICAgICAgIHZhciBzZWxmID0gdGhpcyxcclxuICAgICAgICAgICAgZXZlbnRzID0gdGhpcy5wbGFjZS5ldmVudHM7XHJcblxyXG4gICAgICAgIGlmKCF0aGlzLnBsYWNlLmV2ZW50cylcclxuICAgICAgICAgICAgcmV0dXJuIHt9O1xyXG5cclxuICAgICAgICByZXR1cm4ge1xyXG4gICAgICAgICAgICBvbkF0dGFjaDogZnVuY3Rpb24oY2xvbmVkRWxlbWVudCwgZG9tSWNvbiwgZG9tTWFya2VyKXtcclxuICAgICAgICAgICAgICAgIHNlbGYuX3NldHVwRXZlbnRzKGNsb25lZEVsZW1lbnQsIGV2ZW50cyk7XHJcbiAgICAgICAgICAgIH0sXHJcbiAgICAgICAgICAgIG9uRGV0YWNoOiBmdW5jdGlvbihjbG9uZWRFbGVtZW50LCBkb21JY29uLCBkb21NYXJrZXIpe1xyXG4gICAgICAgICAgICAgICAgc2VsZi5fc2V0dXBFdmVudHMoY2xvbmVkRWxlbWVudCwgZXZlbnRzLCB0cnVlKTtcclxuICAgICAgICAgICAgfVxyXG4gICAgICAgIH1cclxuICAgIH1cclxufSIsIm1vZHVsZS5leHBvcnRzID0gZnVuY3Rpb24oKXtcclxuICAgIGZ1bmN0aW9uIE1hcmtlckludGVyZmFjZSgpe1xyXG4gICAgICAgIHRocm93IG5ldyBFcnJvcignQWJzdHJhY3QgY2xhc3MhIFRoZSBJbnN0YW5jZSBzaG91bGQgYmUgY3JlYXRlZCcpO1xyXG4gICAgfVxyXG4gICAgXHJcbiAgICB2YXIgcHJvdG8gPSBNYXJrZXJJbnRlcmZhY2UucHJvdG90eXBlO1xyXG4gICAgXHJcbiAgICBwcm90by5jcmVhdGUgPSBjcmVhdGU7XHJcbiAgICBwcm90by5zZXRDb29yZHMgPSBzZXRDb29yZHM7XHJcbiAgICBcclxuICAgIGZ1bmN0aW9uIE1hcmtlcigpe307XHJcbiAgICBcclxuICAgIE1hcmtlci5wcm90b3R5cGUgPSBwcm90bztcclxuICAgIFxyXG4gICAgcmV0dXJuIE1hcmtlcjtcclxuICAgIFxyXG4gICAgZnVuY3Rpb24gY3JlYXRlKCl7XHJcbiAgICAgICAgdGhyb3cgbmV3IEVycm9yKCdnZXRJbnN0YW5jZTo6IG5vdCBpbXBsZW1lbnRlZCcpOyBcclxuICAgIH1cclxuICAgIFxyXG4gICAgZnVuY3Rpb24gc2V0Q29vcmRzKCl7XHJcbiAgICAgICAgIHRoaXMuY29vcmRzID0ge1xyXG4gICAgICAgICAgICBsYXQ6IHRoaXMucGxhY2UucG9zLmxhdCxcclxuICAgICAgICAgICAgbG5nOiB0aGlzLnBsYWNlLnBvcy5sbmdcclxuICAgICAgICB9XHJcbiAgICB9XHJcbiAgICBcclxufSIsInZhciBtYXJrZXJJbnRlcmZhY2UgPSByZXF1aXJlKCcuL21hcmtlci5qcycpLFxyXG5cdGRlZmF1bHRNYXJrZXIgPSByZXF1aXJlKCcuL2RlZmF1bHQubWFya2VyLmpzJyksXHJcblx0ZG9tTWFya2VyID0gcmVxdWlyZSgnLi9kb20ubWFya2VyLmpzJyksXHJcblx0c3ZnTWFya2VyID0gcmVxdWlyZSgnLi9zdmcubWFya2VyLmpzJyksXHJcbiAgICBtYXJrZXJzU2VydmljZSA9IHJlcXVpcmUoJy4vbWFya2Vycy5zZXJ2aWNlLmpzJyk7XHJcblxyXG5hbmd1bGFyLm1vZHVsZSgnbWFya2VyLWludGVyZmFjZScsIFtdKS5mYWN0b3J5KCdNYXJrZXJJbnRlcmZhY2UnLCBtYXJrZXJJbnRlcmZhY2UpO1xyXG5hbmd1bGFyLm1vZHVsZSgnZGVmYXVsdC1tYXJrZXInLCBbXSkuZmFjdG9yeSgnRGVmYXVsdE1hcmtlcicsIGRlZmF1bHRNYXJrZXIpO1xyXG5hbmd1bGFyLm1vZHVsZSgnZG9tLW1hcmtlcicsIFtdKS5mYWN0b3J5KCdET01NYXJrZXInLCBkb21NYXJrZXIpO1xyXG5hbmd1bGFyLm1vZHVsZSgnc3ZnLW1hcmtlcicsIFtdKS5mYWN0b3J5KCdTVkdNYXJrZXInLCBzdmdNYXJrZXIpO1xyXG5cclxuYW5ndWxhci5tb2R1bGUoJ21hcmtlcnMtc2VydmljZScsIFtdKS5zZXJ2aWNlKCdNYXJrZXJzU2VydmljZScsIG1hcmtlcnNTZXJ2aWNlKTtcclxuXHJcbnZhciBhcHAgPSBhbmd1bGFyLm1vZHVsZSgnbWFya2Vycy1tb2R1bGUnLCBbXHJcblx0J21hcmtlci1pbnRlcmZhY2UnLFxyXG4gICAgJ2RlZmF1bHQtbWFya2VyJyxcclxuICAgICdkb20tbWFya2VyJyxcclxuICAgICdtYXJrZXJzLXNlcnZpY2UnLFxyXG4gICAgJ3N2Zy1tYXJrZXInXHJcbl0pO1xyXG5cclxubW9kdWxlLmV4cG9ydHMgPSBhcHA7IiwibW9kdWxlLmV4cG9ydHMgPSBmdW5jdGlvbihEZWZhdWx0TWFya2VyLCBET01NYXJrZXIsIFNWR01hcmtlciwgQ09OU1RTKSB7XHJcbiAgICBcclxuICAgIHZhciBNQVJLRVJfVFlQRVMgPSBDT05TVFMuTUFSS0VSX1RZUEVTO1xyXG4gICAgcmV0dXJuIHtcclxuICAgICAgICBhZGRNYXJrZXJUb01hcDogYWRkTWFya2VyVG9NYXBcclxuICAgIH1cclxuXHJcbiAgICBmdW5jdGlvbiBhZGRNYXJrZXJUb01hcChtYXAsIHBsYWNlcykge1xyXG4gICAgICAgIGlmICghcGxhY2VzIHx8ICFwbGFjZXMubGVuZ3RoKVxyXG4gICAgICAgICAgICByZXR1cm4gZmFsc2U7XHJcblxyXG4gICAgICAgIGlmICghKG1hcCBpbnN0YW5jZW9mIEguTWFwKSlcclxuICAgICAgICAgICAgdGhyb3cgbmV3IEVycm9yKCdVbnN1cHBvcnRlZCBtYXAgaW5zdGFuY2UnKTtcclxuXHJcbiAgICAgICAgcGxhY2VzLmZvckVhY2goZnVuY3Rpb24ocGxhY2UsIGkpIHtcclxuICAgICAgICAgICAgdmFyIGNyZWF0b3IgPSBfZ2V0TWFya2VyQ3JlYXRvcihwbGFjZSk7XHJcbiAgICAgICAgICAgIHZhciBtYXJrZXIgPSBwbGFjZS5kcmFnZ2FibGUgPyBfZHJhZ2dhYmxlTWFya2VyTWl4aW4oY3JlYXRvci5jcmVhdGUoKSkgOiBjcmVhdG9yLmNyZWF0ZSgpO1xyXG5cclxuICAgICAgICAgICAgbWFwLmFkZE9iamVjdChtYXJrZXIpO1xyXG4gICAgICAgIH0pO1xyXG5cclxuICAgIH1cclxuXHJcbiAgICBmdW5jdGlvbiBfZ2V0TWFya2VyQ3JlYXRvcihwbGFjZSkge1xyXG4gICAgICAgIHZhciBDb25jcmV0ZU1hcmtlcjtcclxuXHJcbiAgICAgICAgc3dpdGNoKHBsYWNlLnR5cGUpIHtcclxuICAgICAgICAgICAgY2FzZSBNQVJLRVJfVFlQRVMuRE9NOlxyXG4gICAgICAgICAgICAgICAgQ29uY3JldGVNYXJrZXIgPSBET01NYXJrZXI7XHJcbiAgICAgICAgICAgICAgICBicmVhaztcclxuICAgICAgICAgICAgY2FzZSBNQVJLRVJfVFlQRVMuU1ZHOlxyXG4gICAgICAgICAgICAgICAgQ29uY3JldGVNYXJrZXIgPSBTVkdNYXJrZXI7XHJcbiAgICAgICAgICAgICAgICBicmVhaztcclxuICAgICAgICAgICAgZGVmYXVsdDpcclxuICAgICAgICAgICAgICAgIENvbmNyZXRlTWFya2VyID0gRGVmYXVsdE1hcmtlcjtcclxuICAgICAgICB9XHJcblxyXG4gICAgICAgIHJldHVybiBuZXcgQ29uY3JldGVNYXJrZXIocGxhY2UpO1xyXG4gICAgfVxyXG5cclxuICAgIGZ1bmN0aW9uIF9kcmFnZ2FibGVNYXJrZXJNaXhpbihtYXJrZXIpIHtcclxuICAgICAgICBtYXJrZXIuZHJhZ2dhYmxlID0gdHJ1ZTtcclxuXHJcbiAgICAgICAgcmV0dXJuIG1hcmtlcjtcclxuICAgIH1cclxuXHJcbn07IiwibW9kdWxlLmV4cG9ydHMgPSBmdW5jdGlvbihNYXJrZXJJbnRlcmZhY2Upe1xyXG4gICAgZnVuY3Rpb24gU1ZHTWFya2VyKHBsYWNlKXtcclxuICAgICAgICB0aGlzLnBsYWNlID0gcGxhY2U7XHJcbiAgICAgICAgdGhpcy5zZXRDb29yZHMoKTtcclxuICAgIH1cclxuICAgIFxyXG4gICAgdmFyIHByb3RvID0gU1ZHTWFya2VyLnByb3RvdHlwZSA9IG5ldyBNYXJrZXJJbnRlcmZhY2UoKTtcclxuICAgIFxyXG4gICAgcHJvdG8uY29uc3RydWN0b3IgPSBTVkdNYXJrZXI7XHJcbiAgICBcclxuICAgIHByb3RvLmNyZWF0ZSA9IGNyZWF0ZTtcclxuICAgIHByb3RvLl9nZXRJY29uID0gX2dldEljb247XHJcbiAgICBcclxuICAgIHJldHVybiBTVkdNYXJrZXI7XHJcbiAgICBcclxuICAgIGZ1bmN0aW9uIGNyZWF0ZSgpe1xyXG4gICAgICAgIHJldHVybiBuZXcgSC5tYXAuTWFya2VyKHRoaXMuY29vcmRzLCB7XHJcbiAgICAgICAgICAgIGljb246IHRoaXMuX2dldEljb24oKSxcclxuICAgICAgICB9KTtcclxuICAgIH1cclxuICAgIFxyXG4gICAgZnVuY3Rpb24gX2dldEljb24oKXtcclxuICAgICAgICB2YXIgaWNvbiA9IHRoaXMucGxhY2UubWFya3VwO1xyXG4gICAgICAgICBpZighaWNvbilcclxuICAgICAgICAgICAgdGhyb3cgbmV3IEVycm9yKCdtYXJrdXAgbWlzc2VkJyk7XHJcblxyXG4gICAgICAgIHJldHVybiBuZXcgSC5tYXAuSWNvbihpY29uKTtcclxuICAgIH1cclxufSIsIm1vZHVsZS5leHBvcnRzID0gZnVuY3Rpb24oJHJvb3RTY29wZSwgJHRpbWVvdXQpe1xyXG4gICAgcmV0dXJuIHtcclxuICAgICAgICB0aHJvdHRsZTogdGhyb3R0bGUsXHJcbiAgICAgICAgY3JlYXRlU2NyaXB0VGFnOiBjcmVhdGVTY3JpcHRUYWcsXHJcbiAgICAgICAgY3JlYXRlTGlua1RhZzogY3JlYXRlTGlua1RhZyxcclxuICAgICAgICBydW5TY29wZURpZ2VzdElmTmVlZDogcnVuU2NvcGVEaWdlc3RJZk5lZWRcclxuICAgIH07XHJcbiAgICBcclxuICAgIC8vI3JlZ2lvbiBQVUJMSUNcclxuICAgIGZ1bmN0aW9uIHRocm90dGxlKGZuLCBwZXJpb2Qpe1xyXG4gICAgICAgIHZhciB0aW1lb3V0ID0gbnVsbDtcclxuICAgICAgICBcclxuICAgICAgICByZXR1cm4gZnVuY3Rpb24oKXtcclxuICAgICAgICAgICAgaWYoJHRpbWVvdXQpXHJcbiAgICAgICAgICAgICAgICAkdGltZW91dC5jYW5jZWwodGltZW91dCk7XHJcbiAgICAgICAgICAgICAgICBcclxuICAgICAgICAgICAgdGltZW91dCA9ICR0aW1lb3V0KGZuLCBwZXJpb2QpO1xyXG4gICAgICAgIH1cclxuICAgIH1cclxuICAgIFxyXG4gICAgZnVuY3Rpb24gcnVuU2NvcGVEaWdlc3RJZk5lZWQoc2NvcGUsIGNiKSB7XHJcbiAgICAgICAgaWYgKHNjb3BlLiRyb290ICYmIHNjb3BlLiRyb290LiQkcGhhc2UgIT09ICckYXBwbHknICYmIHNjb3BlLiRyb290LiQkcGhhc2UgIT09ICckZGlnZXN0Jykge1xyXG4gICAgICAgICAgICBzY29wZS4kZGlnZXN0KGNiIHx8IGFuZ3VsYXIubm9vcCk7XHJcbiAgICAgICAgICAgIHJldHVybiB0cnVlO1xyXG4gICAgICAgIH1cclxuICAgICAgICByZXR1cm4gZmFsc2U7XHJcbiAgICB9XHJcbiAgICBcclxuICAgIGZ1bmN0aW9uIGNyZWF0ZVNjcmlwdFRhZyhhdHRycyl7XHJcbiAgICAgICAgdmFyIHNjcmlwdCA9IGRvY3VtZW50LmdldEVsZW1lbnRCeUlkKGF0dHJzLnNyYyk7XHJcbiAgICAgICAgXHJcbiAgICAgICAgaWYoc2NyaXB0KVxyXG4gICAgICAgICAgICByZXR1cm4gZmFsc2U7XHJcbiAgICAgICAgXHJcbiAgICAgICAgc2NyaXB0ID0gZG9jdW1lbnQuY3JlYXRlRWxlbWVudCgnc2NyaXB0Jyk7XHJcbiAgICAgICAgc2NyaXB0LnR5cGUgPSAndGV4dC9qYXZhc2NyaXB0JztcclxuICAgICAgICBzY3JpcHQuaWQgPSBhdHRycy5zcmM7XHJcbiAgICAgICAgX3NldEF0dHJzKHNjcmlwdCwgYXR0cnMpOyAgICBcclxuXHJcbiAgICAgICAgcmV0dXJuIHNjcmlwdDtcclxuICAgIH1cclxuXHJcbiAgICBmdW5jdGlvbiBjcmVhdGVMaW5rVGFnKGF0dHJzKSB7XHJcbiAgICAgICAgdmFyIGxpbmsgPSBkb2N1bWVudC5nZXRFbGVtZW50QnlJZChhdHRycy5ocmVmKTtcclxuICAgICAgICBcclxuICAgICAgICBpZihsaW5rKVxyXG4gICAgICAgICAgICByZXR1cm4gZmFsc2U7XHJcbiAgICAgICAgICAgIFxyXG4gICAgICAgIGxpbmsgPSBkb2N1bWVudC5jcmVhdGVFbGVtZW50KCdsaW5rJyk7XHJcbiAgICAgICAgbGluay5pZCA9IGF0dHJzLmhyZWY7XHJcbiAgICAgICAgX3NldEF0dHJzKGxpbmssIGF0dHJzKTtcclxuICAgICAgICBcclxuICAgICAgICByZXR1cm4gbGluaztcclxuICAgIH1cclxuICAgIC8vI2VuZHJlZ2lvbiBQVUJMSUMgXHJcblxyXG4gICAgLy8jcmVnaW9uIFBSSVZBVEVcclxuICAgIGZ1bmN0aW9uIF9zZXRBdHRycyhlbCwgYXR0cnMpIHtcclxuICAgICAgICBpZighZWwgfHwgIWF0dHJzKVxyXG4gICAgICAgICAgICB0aHJvdyBuZXcgRXJyb3IoJ01pc3NlZCBhdHRyaWJ1dGVzJyk7XHJcblxyXG4gICAgICAgIGZvcih2YXIga2V5IGluIGF0dHJzKSB7XHJcbiAgICAgICAgICAgIGlmKCFhdHRycy5oYXNPd25Qcm9wZXJ0eShrZXkpKVxyXG4gICAgICAgICAgICAgICAgY29udGludWU7XHJcblxyXG4gICAgICAgICAgICBlbFtrZXldID0gYXR0cnNba2V5XTtcclxuICAgICAgICB9XHJcbiAgICB9XHJcbn07Il19
