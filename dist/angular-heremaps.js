(function e(t,n,r){function s(o,u){if(!n[o]){if(!t[o]){var a=typeof require=="function"&&require;if(!u&&a)return a(o,!0);if(i)return i(o,!0);var f=new Error("Cannot find module '"+o+"'");throw f.code="MODULE_NOT_FOUND",f}var l=n[o]={exports:{}};t[o][0].call(l.exports,function(e){var n=t[o][1][e];return s(n?n:e)},l,l.exports,e,t,n,r)}return n[o].exports}var i=typeof require=="function"&&require;for(var o=0;o<r.length;o++)s(r[o]);return s})({1:[function(require,module,exports){
/**
 * Created by Dmytro on 4/11/2016.
 */
module.exports = function(
    $timeout,
    $window,
    $rootScope,
    $filter,
    HereMapsConfig,
    APIService,
    HereMapUtilsService,
    MarkersService,
    CONSTS) {
    return {
        restrict: 'EA',
        template: "<div ng-style=\"{'width': mapWidth, 'height': mapHeight}\"></div>",
        replace: true,
        scope: {
            opts: '=options',
            places: '=',
            onMapReady: "&mapReady"
        },
        controller: function($scope, $element, $attrs) {
            var options = angular.extend({}, CONSTS.DEFAULT_MAP_OPTIONS, $scope.opts),
                position = HereMapUtilsService.isValidCoords(options.coords) ?  options.coords : CONSTS.DEFAULT_MAP_OPTIONS.coords;
                
            var heremaps = {}, 
                mapReady = $scope.onMapReady(), 
                _onResizeMap = null;;

            $element[0].parentNode.style.overflow = 'hidden';

            $timeout(function(){
                return _setMapSize();
            }).then(function(){
                APIService.loadApi().then(_apiReady);
            });

            options.resize && addOnResizeListener();

            $scope.$on('$destroy', function() {
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
                heremaps.platform = new H.service.Platform(HereMapsConfig);
                heremaps.layers = heremaps.platform.createDefaultLayers();
            }

            function _getLocation() {
                return APIService.getPosition({
                    coords: position,
                    enableHighAccuracy: true,
                    maximumAge: 10000
                });
            }

            function _locationFailure() {
                console.error('Can not get a geo position');
            }

            function _setupMap(coords) {
                _initMap(function() {
                    APIService.loadModules($attrs.$attr, {
                        "controls": _uiModuleReady,
                        "events": _eventsModuleReady
                    });
                });
            }

            function _initMap(cb) {
                var map = heremaps.map = new H.Map($element[0], heremaps.layers.normal.map, {
                    zoom: options.zoom,
                    center: new H.geo.Point(position.latitude, position.longitude)
                });
                
                // MarkersService.addUserMarker(map, {
                //     pos: { lat: position.latitude, lng: position.longitude }
                // });

                MarkersService.addMarkersToMap(map, $scope.places);

                mapReady && mapReady(MapProxy());

                cb && cb();
            }

            function _uiModuleReady() {
                var ui = heremaps.ui = H.ui.UI.createDefault(heremaps.map, heremaps.layers);

                _setControlsPosition(ui);
            }
            
            function _setControlsPosition(ui){
                var position = $attrs.controls;
                if(!ui || !_isValidPosition(position))
                    return;

                var availableControls = CONSTS.CONTROLS; 
                for(key in availableControls){
                    if(!availableControls.hasOwnProperty(key))
                        continue;
                    var value = availableControls[key],
                        control = ui.getControl(value);
                        
                    if(!control)
                        return;
                        
                    control.setAlignment(position);
                }
            }
            
            function _isValidPosition(position){
                var isValid = false;
                switch(position) {
                    case 'top-right':
                    case 'top-left':
                    case 'bottom-right':
                    case 'bottom-left':
                        isValid = true;
                        break;
                    default:
                        isValid = false;
                }
                
                return isValid;
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
            }

            function _resizeHandler() {
                _setMapSize(true);

                heremaps.map.getViewPort().resize();
            }

            function _setMapSize() {
                var height = $element[0].parentNode.offsetHeight || options.height,
                    width = $element[0].parentNode.offsetWidth || options.width;

                $scope.mapHeight = height + 'px';
                $scope.mapWidth = width + 'px';

                HereMapUtilsService.runScopeDigestIfNeed($scope);
            }

            function MapProxy() {
                return {
                    getMap: function() {
                        return heremaps.map
                    },
                    calculateRoute: function(driveType, direction) {
                        APIService.calculateRoute(heremaps.platform, heremaps.map, {
                            driveType: driveType,
                            direction: direction
                        });
                    },
                    setZoom: function(zoom){
                      heremaps.map.setZoom(zoom || 10);  
                    },
                    setCenter: function(coords) {
                        if (!coords) {
                            return _getLocation()
                                .then(function(response) {
                                    heremaps.map.setCenter({
                                        lng: response.coords.longitude,
                                        lat: response.coords.latitude
                                    });
                                })
                                .catch(_locationFailure);
                        }

                        heremaps.map.setCenter(coords);
                    },
                    updateMarkers: function(places){
                        MarkersService.updateMarkers(heremaps.map, places);   
                    },
                    fitMarkersBounds: function(places){
                        var sortByLatitude = places.sort(function(a, b){
                            return +a.lat - +b.lat;
                        });
                        
                        console.log(sortByLatitude);
                    }
                }
            }

        }
    }
};

},{}],2:[function(require,module,exports){
require('./providers/markers/markers.module');

var directive = require('./heremaps.directive'),
    configProvider = require('./providers/mapconfig.provider'),
    apiService = require('./providers/api.service'),
    utilsService = require('./providers/utils.service'),
    consts = require('./providers/consts');

var heremaps = angular.module('heremaps', [
    'markers-module'
]);

heremaps
    .provider('HereMapsConfig', configProvider)
    .service('APIService', ['$q', 'HereMapsConfig', 'HereMapUtilsService', 'CONSTS', apiService])
    .service('HereMapUtilsService', utilsService)
    .constant('CONSTS', consts);

heremaps.directive('heremaps', directive);

module.exports = heremaps;
},{"./heremaps.directive":1,"./providers/api.service":3,"./providers/consts":4,"./providers/mapconfig.provider":5,"./providers/markers/markers.module":9,"./providers/utils.service":12}],3:[function(require,module,exports){
module.exports = function($q, HereMapsConfig, HereMapUtilsService, CONSTS) {
    var version = HereMapsConfig.apiVersion;

    var API_VERSION = {
        V: parseInt(version),
        SUB: version
    };

    var CONFIG = {
        BASE: "https://js.api.here.com/v",
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
        calculateRoute: calculateRoute
    };

    //#region PUBLIC
    function loadApi() {
        return _getLoader(CONFIG.CORE)
            .then(function() {
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
        var dererred = $q.defer();

        if (_isValidCoords(options.coords)) {
            dererred.resolve({ coords: options.coords });
        } else {
            navigator.geolocation.getCurrentPosition(function(response) {
                dererred.resolve(response);
            }, function(error) {
                dererred.reject(error);
            }, options);
        }

        return dererred.promise;
    }

    /**
     * @params {Object} driveType, from, to
     */
    function calculateRoute(platform, map, params) {
        var router = platform.getRoutingService(),
            dir = params.direction;
        
        var routeRequestParams = {
            mode: 'fastest;{{Vechile}}'.replace(/{{Vechile}}/, params.driveType),
            representation: 'display',
            routeattributes: 'waypoints,summary,shape,legs',
            maneuverattributes: 'direction,action',
            waypoint0: [dir.from.lat, dir.from.lng].join(','),
            waypoint1: [dir.to.lat, dir.to.lng].join(',')
        };
            
        router.calculateRoute(
            routeRequestParams,
            _onRouteSuccess,
            _onRouteFailure
        );
    }
    //#endregion PUBLIC


    //#region PRIVATE
    function _onRouteSuccess(result){
        console.log(result)
    }
    
    function _onRouteFailure(error){
        // console.log('Calculate route failure', error);
    }
    
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
    
    
    /**
     * Creates a H.map.Polyline from the shape of the route and adds it to the map.
     * @param {Object} route A route as received from the H.service.RoutingService
     */
    function addRouteShapeToMap(map, route){
        var strip = new H.geo.Strip(),
            routeShape = route.shape,
            polyline;

        routeShape.forEach(function(point) {
            var parts = point.split(',');
            strip.pushLatLngAlt(parts[0], parts[1]);
        });

        polyline = new H.map.Polyline(strip, {
            style: {
            lineWidth: 4,
            strokeColor: 'rgba(0, 128, 255, 0.7)'
            }
        });
        // Add the polyline to the map
        map.addObject(polyline);
        // And zoom to its bounding rectangle
        map.setViewBounds(polyline.getBounds(), true);
    }


    /**
     * Creates a series of H.map.Marker points from the route and adds them to the map.
     * @param {Object} route  A route as received from the H.service.RoutingService
     */
    function addManueversToMap(map, route){
        var svgMarkup = '<svg width="18" height="18" ' +
            'xmlns="http://www.w3.org/2000/svg">' +
            '<circle cx="8" cy="8" r="8" ' +
            'fill="#1b468d" stroke="white" stroke-width="1"  />' +
            '</svg>',
            dotIcon = new H.map.Icon(svgMarkup, {anchor: {x:8, y:8}}),
            group = new  H.map.Group(),
            i,
            j;

        // Add a marker for each maneuver
        for (i = 0;  i < route.leg.length; i += 1) {
            for (j = 0;  j < route.leg[i].maneuver.length; j += 1) {
                // Get the next maneuver.
                maneuver = route.leg[i].maneuver[j];
                // Add a marker to the maneuvers group
                var marker =  new H.map.Marker({
                        lat: maneuver.position.latitude,
                        lng: maneuver.position.longitude},
                        {icon: dotIcon}
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
    function addWaypointsToPanel(waypoints){
        var nodeH3 = document.createElement('h3'),
            waypointLabels = [],
            i;

        for (i = 0;  i < waypoints.length; i += 1) {
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
    function addSummaryToPanel(summary){
        var summaryDiv = document.createElement('div'),
            content = '';
            
        content += '<b>Total distance</b>: ' + summary.distance  + 'm. <br/>';
        content += '<b>Travel Time</b>: ' + summary.travelTime.toMMSS() + ' (in current traffic)';


        summaryDiv.style.fontSize = 'small';
        summaryDiv.style.marginLeft ='5%';
        summaryDiv.style.marginRight ='5%';
        summaryDiv.innerHTML = content;
        routeInstructionsContainer.appendChild(summaryDiv);
    }

    /**
     * Creates a series of H.map.Marker points from the route and adds them to the map.
     * @param {Object} route  A route as received from the H.service.RoutingService
     */
    function addManueversToPanel(route){
        var nodeOL = document.createElement('ol'), i, j;

        nodeOL.style.fontSize = 'small';
        nodeOL.style.marginLeft ='5%';
        nodeOL.style.marginRight ='5%';
        nodeOL.className = 'directions';

        // Add a marker for each maneuver
        for (i = 0;  i < route.leg.length; i += 1) {
            for (j = 0;  j < route.leg[i].maneuver.length; j += 1) {
            // Get the next maneuver.
            maneuver = route.leg[i].maneuver[j];

            var li = document.createElement('li'),
                spanArrow = document.createElement('span'),
                spanInstruction = document.createElement('span');

            spanArrow.className = 'arrow '  + maneuver.action;
            spanInstruction.innerHTML = maneuver.instruction;
            li.appendChild(spanArrow);
            li.appendChild(spanInstruction);

            nodeOL.appendChild(li);
            }
        }

        routeInstructionsContainer.appendChild(nodeOL);
    }
    
    function _isValidCoords(coords){
        var lng = coords && coords.longitude,
            lat = coords && coords.latitude;
            
        return (typeof lng === 'number' || typeof lng === 'string') &&
                (typeof lat === 'number' || typeof lat === 'string'); 
    }
};
},{}],4:[function(require,module,exports){
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
        draggable: false,
        coords: {
            longitude: 0,
            latitude: 0
        }
    },
    "MARKER_TYPES": {
        DOM: "DOM",
        SVG: "SVG"
    },
    "CONTROLS": {
        settings: 'mapsettings',
        zoom: 'zoom',
        scale: 'scalebar',
        pano: 'panorama'
    }
}
},{}],5:[function(require,module,exports){
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
            icon: this._getIcon()
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
        addMarkersToMap: addMarkersToMap,
        addUserMarker: addUserMarker,
        updateMarkers: updateMarkers
    }

    function addMarkersToMap(map, places) {
        if (!places || !places.length)
            return false;

        if (!(map instanceof H.Map))
            throw new Error('Unsupported map instance');

        if(!map.markersGroup)
            map.markersGroup = new H.map.Group();
        
        places.forEach(function(place, i) {
            var creator = _getMarkerCreator(place),
                marker = place.draggable ? _draggableMarkerMixin(creator.create()) : creator.create();
                
            map.markersGroup.addObject(marker);
        });
        
        map.addObject(map.markersGroup);
    }
    
    function updateMarkers(map, places){
        if(map.markersGroup) {
            map.removeObject(map.markersGroup);
            map.markersGroup = null;    
        }
        
        addMarkersToMap.apply(null, arguments);
    }

    function addUserMarker(map, place) {
        var styles = [
            "border-radius: 50%",
            "background-color: rgba(38, 33, 97, .8)",
            "height: 12px",
            "width: 12px"
        ];

        var markup = '<div style="{style}"></div>';
        place.markup = markup.replace(/{style}/, styles.join(';'));

        var creator = new DOMMarker(place);

        map.addObject(creator.create());
        
        // var marker = new H.map.Circle(place.pos, 10000, {
        //         style: {
        //             strokeColor: 'rgba(55, 85, 170, 0.6)', // Color of the perimeter
        //             lineWidth: 2,
        //             fillColor: 'rgba(0, 128, 0, 0.7)'  // Color of the circle
        //         }
        //     }
        // );
        
        // map.addObject(marker);
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
        runScopeDigestIfNeed: runScopeDigestIfNeed,
        isValidCoords: isValidCoords
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
    
    function isValidCoords(coords){
        return coords && 
            (typeof coords.latitude === 'string' ||  typeof coords.latitude === 'number') &&
            (typeof coords.longitude === 'string' ||  typeof coords.longitude === 'number')
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


//# sourceMappingURL=data:application/json;base64,eyJ2ZXJzaW9uIjozLCJzb3VyY2VzIjpbIm5vZGVfbW9kdWxlcy9icm93c2VyLXBhY2svX3ByZWx1ZGUuanMiLCJzcmMvaGVyZW1hcHMuZGlyZWN0aXZlLmpzIiwic3JjL2luZGV4LmpzIiwic3JjL3Byb3ZpZGVycy9hcGkuc2VydmljZS5qcyIsInNyYy9wcm92aWRlcnMvY29uc3RzLmpzIiwic3JjL3Byb3ZpZGVycy9tYXBjb25maWcucHJvdmlkZXIuanMiLCJzcmMvcHJvdmlkZXJzL21hcmtlcnMvZGVmYXVsdC5tYXJrZXIuanMiLCJzcmMvcHJvdmlkZXJzL21hcmtlcnMvZG9tLm1hcmtlci5qcyIsInNyYy9wcm92aWRlcnMvbWFya2Vycy9tYXJrZXIuanMiLCJzcmMvcHJvdmlkZXJzL21hcmtlcnMvbWFya2Vycy5tb2R1bGUuanMiLCJzcmMvcHJvdmlkZXJzL21hcmtlcnMvbWFya2Vycy5zZXJ2aWNlLmpzIiwic3JjL3Byb3ZpZGVycy9tYXJrZXJzL3N2Zy5tYXJrZXIuanMiLCJzcmMvcHJvdmlkZXJzL3V0aWxzLnNlcnZpY2UuanMiXSwibmFtZXMiOltdLCJtYXBwaW5ncyI6IkFBQUE7QUNBQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBOztBQ3hPQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7O0FDcEJBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBOztBQ2hZQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTs7QUMzQkE7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTs7QUNoQkE7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTs7QUNoQkE7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7O0FDekRBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBOztBQzNCQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTs7QUNyQkE7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7O0FDMUZBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBOztBQzNCQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQSIsImZpbGUiOiJhbmd1bGFyLWhlcmVtYXBzLmpzIiwic291cmNlUm9vdCI6Ii9zb3VyY2UvIiwic291cmNlc0NvbnRlbnQiOlsiKGZ1bmN0aW9uIGUodCxuLHIpe2Z1bmN0aW9uIHMobyx1KXtpZighbltvXSl7aWYoIXRbb10pe3ZhciBhPXR5cGVvZiByZXF1aXJlPT1cImZ1bmN0aW9uXCImJnJlcXVpcmU7aWYoIXUmJmEpcmV0dXJuIGEobywhMCk7aWYoaSlyZXR1cm4gaShvLCEwKTt2YXIgZj1uZXcgRXJyb3IoXCJDYW5ub3QgZmluZCBtb2R1bGUgJ1wiK28rXCInXCIpO3Rocm93IGYuY29kZT1cIk1PRFVMRV9OT1RfRk9VTkRcIixmfXZhciBsPW5bb109e2V4cG9ydHM6e319O3Rbb11bMF0uY2FsbChsLmV4cG9ydHMsZnVuY3Rpb24oZSl7dmFyIG49dFtvXVsxXVtlXTtyZXR1cm4gcyhuP246ZSl9LGwsbC5leHBvcnRzLGUsdCxuLHIpfXJldHVybiBuW29dLmV4cG9ydHN9dmFyIGk9dHlwZW9mIHJlcXVpcmU9PVwiZnVuY3Rpb25cIiYmcmVxdWlyZTtmb3IodmFyIG89MDtvPHIubGVuZ3RoO28rKylzKHJbb10pO3JldHVybiBzfSkiLCIvKipcclxuICogQ3JlYXRlZCBieSBEbXl0cm8gb24gNC8xMS8yMDE2LlxyXG4gKi9cclxubW9kdWxlLmV4cG9ydHMgPSBmdW5jdGlvbihcclxuICAgICR0aW1lb3V0LFxyXG4gICAgJHdpbmRvdyxcclxuICAgICRyb290U2NvcGUsXHJcbiAgICAkZmlsdGVyLFxyXG4gICAgSGVyZU1hcHNDb25maWcsXHJcbiAgICBBUElTZXJ2aWNlLFxyXG4gICAgSGVyZU1hcFV0aWxzU2VydmljZSxcclxuICAgIE1hcmtlcnNTZXJ2aWNlLFxyXG4gICAgQ09OU1RTKSB7XHJcbiAgICByZXR1cm4ge1xyXG4gICAgICAgIHJlc3RyaWN0OiAnRUEnLFxyXG4gICAgICAgIHRlbXBsYXRlOiBcIjxkaXYgbmctc3R5bGU9XFxcInsnd2lkdGgnOiBtYXBXaWR0aCwgJ2hlaWdodCc6IG1hcEhlaWdodH1cXFwiPjwvZGl2PlwiLFxyXG4gICAgICAgIHJlcGxhY2U6IHRydWUsXHJcbiAgICAgICAgc2NvcGU6IHtcclxuICAgICAgICAgICAgb3B0czogJz1vcHRpb25zJyxcclxuICAgICAgICAgICAgcGxhY2VzOiAnPScsXHJcbiAgICAgICAgICAgIG9uTWFwUmVhZHk6IFwiJm1hcFJlYWR5XCJcclxuICAgICAgICB9LFxyXG4gICAgICAgIGNvbnRyb2xsZXI6IGZ1bmN0aW9uKCRzY29wZSwgJGVsZW1lbnQsICRhdHRycykge1xyXG4gICAgICAgICAgICB2YXIgb3B0aW9ucyA9IGFuZ3VsYXIuZXh0ZW5kKHt9LCBDT05TVFMuREVGQVVMVF9NQVBfT1BUSU9OUywgJHNjb3BlLm9wdHMpLFxyXG4gICAgICAgICAgICAgICAgcG9zaXRpb24gPSBIZXJlTWFwVXRpbHNTZXJ2aWNlLmlzVmFsaWRDb29yZHMob3B0aW9ucy5jb29yZHMpID8gIG9wdGlvbnMuY29vcmRzIDogQ09OU1RTLkRFRkFVTFRfTUFQX09QVElPTlMuY29vcmRzO1xyXG4gICAgICAgICAgICAgICAgXHJcbiAgICAgICAgICAgIHZhciBoZXJlbWFwcyA9IHt9LCBcclxuICAgICAgICAgICAgICAgIG1hcFJlYWR5ID0gJHNjb3BlLm9uTWFwUmVhZHkoKSwgXHJcbiAgICAgICAgICAgICAgICBfb25SZXNpemVNYXAgPSBudWxsOztcclxuXHJcbiAgICAgICAgICAgICRlbGVtZW50WzBdLnBhcmVudE5vZGUuc3R5bGUub3ZlcmZsb3cgPSAnaGlkZGVuJztcclxuXHJcbiAgICAgICAgICAgICR0aW1lb3V0KGZ1bmN0aW9uKCl7XHJcbiAgICAgICAgICAgICAgICByZXR1cm4gX3NldE1hcFNpemUoKTtcclxuICAgICAgICAgICAgfSkudGhlbihmdW5jdGlvbigpe1xyXG4gICAgICAgICAgICAgICAgQVBJU2VydmljZS5sb2FkQXBpKCkudGhlbihfYXBpUmVhZHkpO1xyXG4gICAgICAgICAgICB9KTtcclxuXHJcbiAgICAgICAgICAgIG9wdGlvbnMucmVzaXplICYmIGFkZE9uUmVzaXplTGlzdGVuZXIoKTtcclxuXHJcbiAgICAgICAgICAgICRzY29wZS4kb24oJyRkZXN0cm95JywgZnVuY3Rpb24oKSB7XHJcbiAgICAgICAgICAgICAgICAkd2luZG93LnJlbW92ZUV2ZW50TGlzdGVuZXIoJ3Jlc2l6ZScsIF9vblJlc2l6ZU1hcCk7XHJcbiAgICAgICAgICAgIH0pO1xyXG5cclxuICAgICAgICAgICAgZnVuY3Rpb24gYWRkT25SZXNpemVMaXN0ZW5lcigpIHtcclxuICAgICAgICAgICAgICAgIF9vblJlc2l6ZU1hcCA9IEhlcmVNYXBVdGlsc1NlcnZpY2UudGhyb3R0bGUoX3Jlc2l6ZUhhbmRsZXIsIENPTlNUUy5VUERBVEVfTUFQX1JFU0laRV9USU1FT1VUKTtcclxuICAgICAgICAgICAgICAgICR3aW5kb3cuYWRkRXZlbnRMaXN0ZW5lcigncmVzaXplJywgX29uUmVzaXplTWFwKTtcclxuICAgICAgICAgICAgfVxyXG5cclxuICAgICAgICAgICAgZnVuY3Rpb24gX2FwaVJlYWR5KCkge1xyXG4gICAgICAgICAgICAgICAgX3NldHVwTWFwUGxhdGZvcm0oKTtcclxuICAgICAgICAgICAgICAgIF9zZXR1cE1hcCgpO1xyXG4gICAgICAgICAgICB9XHJcblxyXG4gICAgICAgICAgICBmdW5jdGlvbiBfc2V0dXBNYXBQbGF0Zm9ybSgpIHtcclxuICAgICAgICAgICAgICAgIGhlcmVtYXBzLnBsYXRmb3JtID0gbmV3IEguc2VydmljZS5QbGF0Zm9ybShIZXJlTWFwc0NvbmZpZyk7XHJcbiAgICAgICAgICAgICAgICBoZXJlbWFwcy5sYXllcnMgPSBoZXJlbWFwcy5wbGF0Zm9ybS5jcmVhdGVEZWZhdWx0TGF5ZXJzKCk7XHJcbiAgICAgICAgICAgIH1cclxuXHJcbiAgICAgICAgICAgIGZ1bmN0aW9uIF9nZXRMb2NhdGlvbigpIHtcclxuICAgICAgICAgICAgICAgIHJldHVybiBBUElTZXJ2aWNlLmdldFBvc2l0aW9uKHtcclxuICAgICAgICAgICAgICAgICAgICBjb29yZHM6IHBvc2l0aW9uLFxyXG4gICAgICAgICAgICAgICAgICAgIGVuYWJsZUhpZ2hBY2N1cmFjeTogdHJ1ZSxcclxuICAgICAgICAgICAgICAgICAgICBtYXhpbXVtQWdlOiAxMDAwMFxyXG4gICAgICAgICAgICAgICAgfSk7XHJcbiAgICAgICAgICAgIH1cclxuXHJcbiAgICAgICAgICAgIGZ1bmN0aW9uIF9sb2NhdGlvbkZhaWx1cmUoKSB7XHJcbiAgICAgICAgICAgICAgICBjb25zb2xlLmVycm9yKCdDYW4gbm90IGdldCBhIGdlbyBwb3NpdGlvbicpO1xyXG4gICAgICAgICAgICB9XHJcblxyXG4gICAgICAgICAgICBmdW5jdGlvbiBfc2V0dXBNYXAoY29vcmRzKSB7XHJcbiAgICAgICAgICAgICAgICBfaW5pdE1hcChmdW5jdGlvbigpIHtcclxuICAgICAgICAgICAgICAgICAgICBBUElTZXJ2aWNlLmxvYWRNb2R1bGVzKCRhdHRycy4kYXR0ciwge1xyXG4gICAgICAgICAgICAgICAgICAgICAgICBcImNvbnRyb2xzXCI6IF91aU1vZHVsZVJlYWR5LFxyXG4gICAgICAgICAgICAgICAgICAgICAgICBcImV2ZW50c1wiOiBfZXZlbnRzTW9kdWxlUmVhZHlcclxuICAgICAgICAgICAgICAgICAgICB9KTtcclxuICAgICAgICAgICAgICAgIH0pO1xyXG4gICAgICAgICAgICB9XHJcblxyXG4gICAgICAgICAgICBmdW5jdGlvbiBfaW5pdE1hcChjYikge1xyXG4gICAgICAgICAgICAgICAgdmFyIG1hcCA9IGhlcmVtYXBzLm1hcCA9IG5ldyBILk1hcCgkZWxlbWVudFswXSwgaGVyZW1hcHMubGF5ZXJzLm5vcm1hbC5tYXAsIHtcclxuICAgICAgICAgICAgICAgICAgICB6b29tOiBvcHRpb25zLnpvb20sXHJcbiAgICAgICAgICAgICAgICAgICAgY2VudGVyOiBuZXcgSC5nZW8uUG9pbnQocG9zaXRpb24ubGF0aXR1ZGUsIHBvc2l0aW9uLmxvbmdpdHVkZSlcclxuICAgICAgICAgICAgICAgIH0pO1xyXG4gICAgICAgICAgICAgICAgXHJcbiAgICAgICAgICAgICAgICAvLyBNYXJrZXJzU2VydmljZS5hZGRVc2VyTWFya2VyKG1hcCwge1xyXG4gICAgICAgICAgICAgICAgLy8gICAgIHBvczogeyBsYXQ6IHBvc2l0aW9uLmxhdGl0dWRlLCBsbmc6IHBvc2l0aW9uLmxvbmdpdHVkZSB9XHJcbiAgICAgICAgICAgICAgICAvLyB9KTtcclxuXHJcbiAgICAgICAgICAgICAgICBNYXJrZXJzU2VydmljZS5hZGRNYXJrZXJzVG9NYXAobWFwLCAkc2NvcGUucGxhY2VzKTtcclxuXHJcbiAgICAgICAgICAgICAgICBtYXBSZWFkeSAmJiBtYXBSZWFkeShNYXBQcm94eSgpKTtcclxuXHJcbiAgICAgICAgICAgICAgICBjYiAmJiBjYigpO1xyXG4gICAgICAgICAgICB9XHJcblxyXG4gICAgICAgICAgICBmdW5jdGlvbiBfdWlNb2R1bGVSZWFkeSgpIHtcclxuICAgICAgICAgICAgICAgIHZhciB1aSA9IGhlcmVtYXBzLnVpID0gSC51aS5VSS5jcmVhdGVEZWZhdWx0KGhlcmVtYXBzLm1hcCwgaGVyZW1hcHMubGF5ZXJzKTtcclxuXHJcbiAgICAgICAgICAgICAgICBfc2V0Q29udHJvbHNQb3NpdGlvbih1aSk7XHJcbiAgICAgICAgICAgIH1cclxuICAgICAgICAgICAgXHJcbiAgICAgICAgICAgIGZ1bmN0aW9uIF9zZXRDb250cm9sc1Bvc2l0aW9uKHVpKXtcclxuICAgICAgICAgICAgICAgIHZhciBwb3NpdGlvbiA9ICRhdHRycy5jb250cm9scztcclxuICAgICAgICAgICAgICAgIGlmKCF1aSB8fCAhX2lzVmFsaWRQb3NpdGlvbihwb3NpdGlvbikpXHJcbiAgICAgICAgICAgICAgICAgICAgcmV0dXJuO1xyXG5cclxuICAgICAgICAgICAgICAgIHZhciBhdmFpbGFibGVDb250cm9scyA9IENPTlNUUy5DT05UUk9MUzsgXHJcbiAgICAgICAgICAgICAgICBmb3Ioa2V5IGluIGF2YWlsYWJsZUNvbnRyb2xzKXtcclxuICAgICAgICAgICAgICAgICAgICBpZighYXZhaWxhYmxlQ29udHJvbHMuaGFzT3duUHJvcGVydHkoa2V5KSlcclxuICAgICAgICAgICAgICAgICAgICAgICAgY29udGludWU7XHJcbiAgICAgICAgICAgICAgICAgICAgdmFyIHZhbHVlID0gYXZhaWxhYmxlQ29udHJvbHNba2V5XSxcclxuICAgICAgICAgICAgICAgICAgICAgICAgY29udHJvbCA9IHVpLmdldENvbnRyb2wodmFsdWUpO1xyXG4gICAgICAgICAgICAgICAgICAgICAgICBcclxuICAgICAgICAgICAgICAgICAgICBpZighY29udHJvbClcclxuICAgICAgICAgICAgICAgICAgICAgICAgcmV0dXJuO1xyXG4gICAgICAgICAgICAgICAgICAgICAgICBcclxuICAgICAgICAgICAgICAgICAgICBjb250cm9sLnNldEFsaWdubWVudChwb3NpdGlvbik7XHJcbiAgICAgICAgICAgICAgICB9XHJcbiAgICAgICAgICAgIH1cclxuICAgICAgICAgICAgXHJcbiAgICAgICAgICAgIGZ1bmN0aW9uIF9pc1ZhbGlkUG9zaXRpb24ocG9zaXRpb24pe1xyXG4gICAgICAgICAgICAgICAgdmFyIGlzVmFsaWQgPSBmYWxzZTtcclxuICAgICAgICAgICAgICAgIHN3aXRjaChwb3NpdGlvbikge1xyXG4gICAgICAgICAgICAgICAgICAgIGNhc2UgJ3RvcC1yaWdodCc6XHJcbiAgICAgICAgICAgICAgICAgICAgY2FzZSAndG9wLWxlZnQnOlxyXG4gICAgICAgICAgICAgICAgICAgIGNhc2UgJ2JvdHRvbS1yaWdodCc6XHJcbiAgICAgICAgICAgICAgICAgICAgY2FzZSAnYm90dG9tLWxlZnQnOlxyXG4gICAgICAgICAgICAgICAgICAgICAgICBpc1ZhbGlkID0gdHJ1ZTtcclxuICAgICAgICAgICAgICAgICAgICAgICAgYnJlYWs7XHJcbiAgICAgICAgICAgICAgICAgICAgZGVmYXVsdDpcclxuICAgICAgICAgICAgICAgICAgICAgICAgaXNWYWxpZCA9IGZhbHNlO1xyXG4gICAgICAgICAgICAgICAgfVxyXG4gICAgICAgICAgICAgICAgXHJcbiAgICAgICAgICAgICAgICByZXR1cm4gaXNWYWxpZDtcclxuICAgICAgICAgICAgfVxyXG5cclxuICAgICAgICAgICAgZnVuY3Rpb24gX2V2ZW50c01vZHVsZVJlYWR5KCkge1xyXG4gICAgICAgICAgICAgICAgdmFyIG1hcCA9IGhlcmVtYXBzLm1hcCxcclxuICAgICAgICAgICAgICAgICAgICBldmVudHMgPSBoZXJlbWFwcy5tYXBFdmVudHMgPSBuZXcgSC5tYXBldmVudHMuTWFwRXZlbnRzKG1hcCksXHJcbiAgICAgICAgICAgICAgICAgICAgYmVoYXZpb3IgPSBoZXJlbWFwcy5iZWhhdmlvciA9IG5ldyBILm1hcGV2ZW50cy5CZWhhdmlvcihldmVudHMpO1xyXG5cclxuICAgICAgICAgICAgICAgIG1hcC5hZGRFdmVudExpc3RlbmVyKCd0YXAnLCBmdW5jdGlvbihldnQpIHtcclxuICAgICAgICAgICAgICAgICAgICAvLyBjb25zb2xlLmxvZyhldnQudHlwZSwgZXZ0LmN1cnJlbnRQb2ludGVyLnR5cGUpO1xyXG4gICAgICAgICAgICAgICAgfSk7XHJcblxyXG4gICAgICAgICAgICAgICAgbWFwLmFkZEV2ZW50TGlzdGVuZXIoJ2RyYWdzdGFydCcsIGZ1bmN0aW9uKGV2KSB7XHJcbiAgICAgICAgICAgICAgICAgICAgdmFyIHRhcmdldCA9IGV2LnRhcmdldDtcclxuICAgICAgICAgICAgICAgICAgICBpZiAodGFyZ2V0IGluc3RhbmNlb2YgSC5tYXAuTWFya2VyKSB7XHJcbiAgICAgICAgICAgICAgICAgICAgICAgIGJlaGF2aW9yLmRpc2FibGUoKTtcclxuICAgICAgICAgICAgICAgICAgICB9XHJcbiAgICAgICAgICAgICAgICB9LCBmYWxzZSk7XHJcblxyXG4gICAgICAgICAgICAgICAgbWFwLmFkZEV2ZW50TGlzdGVuZXIoJ2RyYWcnLCBmdW5jdGlvbihldikge1xyXG4gICAgICAgICAgICAgICAgICAgIHZhciB0YXJnZXQgPSBldi50YXJnZXQsXHJcbiAgICAgICAgICAgICAgICAgICAgICAgIHBvaW50ZXIgPSBldi5jdXJyZW50UG9pbnRlcjtcclxuICAgICAgICAgICAgICAgICAgICBpZiAodGFyZ2V0IGluc3RhbmNlb2YgbWFwc2pzLm1hcC5NYXJrZXIpIHtcclxuICAgICAgICAgICAgICAgICAgICAgICAgdGFyZ2V0LnNldFBvc2l0aW9uKG1hcC5zY3JlZW5Ub0dlbyhwb2ludGVyLnZpZXdwb3J0WCwgcG9pbnRlci52aWV3cG9ydFkpKTtcclxuICAgICAgICAgICAgICAgICAgICB9XHJcbiAgICAgICAgICAgICAgICB9LCBmYWxzZSk7XHJcblxyXG4gICAgICAgICAgICAgICAgbWFwLmFkZEV2ZW50TGlzdGVuZXIoJ2RyYWdlbmQnLCBmdW5jdGlvbihldikge1xyXG4gICAgICAgICAgICAgICAgICAgIHZhciB0YXJnZXQgPSBldi50YXJnZXQ7XHJcbiAgICAgICAgICAgICAgICAgICAgaWYgKHRhcmdldCBpbnN0YW5jZW9mIG1hcHNqcy5tYXAuTWFya2VyKSB7XHJcbiAgICAgICAgICAgICAgICAgICAgICAgIGJlaGF2aW9yLmVuYWJsZSgpO1xyXG4gICAgICAgICAgICAgICAgICAgIH1cclxuICAgICAgICAgICAgICAgIH0sIGZhbHNlKTtcclxuXHJcbiAgICAgICAgICAgICAgICBtYXAuZHJhZ2dhYmxlID0gb3B0aW9ucy5kcmFnZ2FibGU7XHJcbiAgICAgICAgICAgIH1cclxuXHJcbiAgICAgICAgICAgIGZ1bmN0aW9uIF9yZXNpemVIYW5kbGVyKCkge1xyXG4gICAgICAgICAgICAgICAgX3NldE1hcFNpemUodHJ1ZSk7XHJcblxyXG4gICAgICAgICAgICAgICAgaGVyZW1hcHMubWFwLmdldFZpZXdQb3J0KCkucmVzaXplKCk7XHJcbiAgICAgICAgICAgIH1cclxuXHJcbiAgICAgICAgICAgIGZ1bmN0aW9uIF9zZXRNYXBTaXplKCkge1xyXG4gICAgICAgICAgICAgICAgdmFyIGhlaWdodCA9ICRlbGVtZW50WzBdLnBhcmVudE5vZGUub2Zmc2V0SGVpZ2h0IHx8IG9wdGlvbnMuaGVpZ2h0LFxyXG4gICAgICAgICAgICAgICAgICAgIHdpZHRoID0gJGVsZW1lbnRbMF0ucGFyZW50Tm9kZS5vZmZzZXRXaWR0aCB8fCBvcHRpb25zLndpZHRoO1xyXG5cclxuICAgICAgICAgICAgICAgICRzY29wZS5tYXBIZWlnaHQgPSBoZWlnaHQgKyAncHgnO1xyXG4gICAgICAgICAgICAgICAgJHNjb3BlLm1hcFdpZHRoID0gd2lkdGggKyAncHgnO1xyXG5cclxuICAgICAgICAgICAgICAgIEhlcmVNYXBVdGlsc1NlcnZpY2UucnVuU2NvcGVEaWdlc3RJZk5lZWQoJHNjb3BlKTtcclxuICAgICAgICAgICAgfVxyXG5cclxuICAgICAgICAgICAgZnVuY3Rpb24gTWFwUHJveHkoKSB7XHJcbiAgICAgICAgICAgICAgICByZXR1cm4ge1xyXG4gICAgICAgICAgICAgICAgICAgIGdldE1hcDogZnVuY3Rpb24oKSB7XHJcbiAgICAgICAgICAgICAgICAgICAgICAgIHJldHVybiBoZXJlbWFwcy5tYXBcclxuICAgICAgICAgICAgICAgICAgICB9LFxyXG4gICAgICAgICAgICAgICAgICAgIGNhbGN1bGF0ZVJvdXRlOiBmdW5jdGlvbihkcml2ZVR5cGUsIGRpcmVjdGlvbikge1xyXG4gICAgICAgICAgICAgICAgICAgICAgICBBUElTZXJ2aWNlLmNhbGN1bGF0ZVJvdXRlKGhlcmVtYXBzLnBsYXRmb3JtLCBoZXJlbWFwcy5tYXAsIHtcclxuICAgICAgICAgICAgICAgICAgICAgICAgICAgIGRyaXZlVHlwZTogZHJpdmVUeXBlLFxyXG4gICAgICAgICAgICAgICAgICAgICAgICAgICAgZGlyZWN0aW9uOiBkaXJlY3Rpb25cclxuICAgICAgICAgICAgICAgICAgICAgICAgfSk7XHJcbiAgICAgICAgICAgICAgICAgICAgfSxcclxuICAgICAgICAgICAgICAgICAgICBzZXRab29tOiBmdW5jdGlvbih6b29tKXtcclxuICAgICAgICAgICAgICAgICAgICAgIGhlcmVtYXBzLm1hcC5zZXRab29tKHpvb20gfHwgMTApOyAgXHJcbiAgICAgICAgICAgICAgICAgICAgfSxcclxuICAgICAgICAgICAgICAgICAgICBzZXRDZW50ZXI6IGZ1bmN0aW9uKGNvb3Jkcykge1xyXG4gICAgICAgICAgICAgICAgICAgICAgICBpZiAoIWNvb3Jkcykge1xyXG4gICAgICAgICAgICAgICAgICAgICAgICAgICAgcmV0dXJuIF9nZXRMb2NhdGlvbigpXHJcbiAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgLnRoZW4oZnVuY3Rpb24ocmVzcG9uc2UpIHtcclxuICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgaGVyZW1hcHMubWFwLnNldENlbnRlcih7XHJcbiAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICBsbmc6IHJlc3BvbnNlLmNvb3Jkcy5sb25naXR1ZGUsXHJcbiAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICBsYXQ6IHJlc3BvbnNlLmNvb3Jkcy5sYXRpdHVkZVxyXG4gICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICB9KTtcclxuICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICB9KVxyXG4gICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgIC5jYXRjaChfbG9jYXRpb25GYWlsdXJlKTtcclxuICAgICAgICAgICAgICAgICAgICAgICAgfVxyXG5cclxuICAgICAgICAgICAgICAgICAgICAgICAgaGVyZW1hcHMubWFwLnNldENlbnRlcihjb29yZHMpO1xyXG4gICAgICAgICAgICAgICAgICAgIH0sXHJcbiAgICAgICAgICAgICAgICAgICAgdXBkYXRlTWFya2VyczogZnVuY3Rpb24ocGxhY2VzKXtcclxuICAgICAgICAgICAgICAgICAgICAgICAgTWFya2Vyc1NlcnZpY2UudXBkYXRlTWFya2VycyhoZXJlbWFwcy5tYXAsIHBsYWNlcyk7ICAgXHJcbiAgICAgICAgICAgICAgICAgICAgfSxcclxuICAgICAgICAgICAgICAgICAgICBmaXRNYXJrZXJzQm91bmRzOiBmdW5jdGlvbihwbGFjZXMpe1xyXG4gICAgICAgICAgICAgICAgICAgICAgICB2YXIgc29ydEJ5TGF0aXR1ZGUgPSBwbGFjZXMuc29ydChmdW5jdGlvbihhLCBiKXtcclxuICAgICAgICAgICAgICAgICAgICAgICAgICAgIHJldHVybiArYS5sYXQgLSArYi5sYXQ7XHJcbiAgICAgICAgICAgICAgICAgICAgICAgIH0pO1xyXG4gICAgICAgICAgICAgICAgICAgICAgICBcclxuICAgICAgICAgICAgICAgICAgICAgICAgY29uc29sZS5sb2coc29ydEJ5TGF0aXR1ZGUpO1xyXG4gICAgICAgICAgICAgICAgICAgIH1cclxuICAgICAgICAgICAgICAgIH1cclxuICAgICAgICAgICAgfVxyXG5cclxuICAgICAgICB9XHJcbiAgICB9XHJcbn07XHJcbiIsInJlcXVpcmUoJy4vcHJvdmlkZXJzL21hcmtlcnMvbWFya2Vycy5tb2R1bGUnKTtcclxuXHJcbnZhciBkaXJlY3RpdmUgPSByZXF1aXJlKCcuL2hlcmVtYXBzLmRpcmVjdGl2ZScpLFxyXG4gICAgY29uZmlnUHJvdmlkZXIgPSByZXF1aXJlKCcuL3Byb3ZpZGVycy9tYXBjb25maWcucHJvdmlkZXInKSxcclxuICAgIGFwaVNlcnZpY2UgPSByZXF1aXJlKCcuL3Byb3ZpZGVycy9hcGkuc2VydmljZScpLFxyXG4gICAgdXRpbHNTZXJ2aWNlID0gcmVxdWlyZSgnLi9wcm92aWRlcnMvdXRpbHMuc2VydmljZScpLFxyXG4gICAgY29uc3RzID0gcmVxdWlyZSgnLi9wcm92aWRlcnMvY29uc3RzJyk7XHJcblxyXG52YXIgaGVyZW1hcHMgPSBhbmd1bGFyLm1vZHVsZSgnaGVyZW1hcHMnLCBbXHJcbiAgICAnbWFya2Vycy1tb2R1bGUnXHJcbl0pO1xyXG5cclxuaGVyZW1hcHNcclxuICAgIC5wcm92aWRlcignSGVyZU1hcHNDb25maWcnLCBjb25maWdQcm92aWRlcilcclxuICAgIC5zZXJ2aWNlKCdBUElTZXJ2aWNlJywgWyckcScsICdIZXJlTWFwc0NvbmZpZycsICdIZXJlTWFwVXRpbHNTZXJ2aWNlJywgJ0NPTlNUUycsIGFwaVNlcnZpY2VdKVxyXG4gICAgLnNlcnZpY2UoJ0hlcmVNYXBVdGlsc1NlcnZpY2UnLCB1dGlsc1NlcnZpY2UpXHJcbiAgICAuY29uc3RhbnQoJ0NPTlNUUycsIGNvbnN0cyk7XHJcblxyXG5oZXJlbWFwcy5kaXJlY3RpdmUoJ2hlcmVtYXBzJywgZGlyZWN0aXZlKTtcclxuXHJcbm1vZHVsZS5leHBvcnRzID0gaGVyZW1hcHM7IiwibW9kdWxlLmV4cG9ydHMgPSBmdW5jdGlvbigkcSwgSGVyZU1hcHNDb25maWcsIEhlcmVNYXBVdGlsc1NlcnZpY2UsIENPTlNUUykge1xyXG4gICAgdmFyIHZlcnNpb24gPSBIZXJlTWFwc0NvbmZpZy5hcGlWZXJzaW9uO1xyXG5cclxuICAgIHZhciBBUElfVkVSU0lPTiA9IHtcclxuICAgICAgICBWOiBwYXJzZUludCh2ZXJzaW9uKSxcclxuICAgICAgICBTVUI6IHZlcnNpb25cclxuICAgIH07XHJcblxyXG4gICAgdmFyIENPTkZJRyA9IHtcclxuICAgICAgICBCQVNFOiBcImh0dHBzOi8vanMuYXBpLmhlcmUuY29tL3ZcIixcclxuICAgICAgICBDT1JFOiBcIm1hcHNqcy1jb3JlLmpzXCIsXHJcbiAgICAgICAgU0VSVklDRTogXCJtYXBzanMtc2VydmljZS5qc1wiLFxyXG4gICAgICAgIFVJOiB7XHJcbiAgICAgICAgICAgIHNyYzogXCJtYXBzanMtdWkuanNcIixcclxuICAgICAgICAgICAgaHJlZjogXCJtYXBzanMtdWkuY3NzXCJcclxuICAgICAgICB9LFxyXG4gICAgICAgIEVWRU5UUzogXCJtYXBzanMtbWFwZXZlbnRzLmpzXCJcclxuICAgIH07XHJcblxyXG4gICAgdmFyIEFQSV9ERUZFUlNRdWV1ZSA9IHt9O1xyXG5cclxuICAgIEFQSV9ERUZFUlNRdWV1ZVtDT05GSUcuQ09SRV0gPSBbXTtcclxuICAgIEFQSV9ERUZFUlNRdWV1ZVtDT05GSUcuU0VSVklDRV0gPSBbXTtcclxuICAgIEFQSV9ERUZFUlNRdWV1ZVtDT05GSUcuVUkuc3JjXSA9IFtdO1xyXG4gICAgQVBJX0RFRkVSU1F1ZXVlW0NPTkZJRy5QQU5PXSA9IFtdO1xyXG4gICAgQVBJX0RFRkVSU1F1ZXVlW0NPTkZJRy5FVkVOVFNdID0gW107XHJcblxyXG4gICAgdmFyIGhlYWQgPSBkb2N1bWVudC5nZXRFbGVtZW50c0J5VGFnTmFtZSgnaGVhZCcpWzBdO1xyXG5cclxuICAgIHJldHVybiB7XHJcbiAgICAgICAgbG9hZEFwaTogbG9hZEFwaSxcclxuICAgICAgICBsb2FkTW9kdWxlczogbG9hZE1vZHVsZXMsXHJcbiAgICAgICAgZ2V0UG9zaXRpb246IGdldFBvc2l0aW9uLFxyXG4gICAgICAgIGNhbGN1bGF0ZVJvdXRlOiBjYWxjdWxhdGVSb3V0ZVxyXG4gICAgfTtcclxuXHJcbiAgICAvLyNyZWdpb24gUFVCTElDXHJcbiAgICBmdW5jdGlvbiBsb2FkQXBpKCkge1xyXG4gICAgICAgIHJldHVybiBfZ2V0TG9hZGVyKENPTkZJRy5DT1JFKVxyXG4gICAgICAgICAgICAudGhlbihmdW5jdGlvbigpIHtcclxuICAgICAgICAgICAgICAgIHJldHVybiBfZ2V0TG9hZGVyKENPTkZJRy5TRVJWSUNFKTtcclxuICAgICAgICAgICAgfSk7XHJcbiAgICB9XHJcblxyXG4gICAgZnVuY3Rpb24gbG9hZE1vZHVsZXMoYXR0cnMsIGhhbmRsZXJzKSB7XHJcbiAgICAgICAgZm9yICh2YXIga2V5IGluIGhhbmRsZXJzKSB7XHJcbiAgICAgICAgICAgIGlmICghaGFuZGxlcnMuaGFzT3duUHJvcGVydHkoa2V5KSB8fCAhYXR0cnNba2V5XSlcclxuICAgICAgICAgICAgICAgIGNvbnRpbnVlO1xyXG5cclxuICAgICAgICAgICAgdmFyIGxvYWRlciA9IF9nZXRMb2FkZXJCeUF0dHIoa2V5KTtcclxuXHJcbiAgICAgICAgICAgIGxvYWRlcigpXHJcbiAgICAgICAgICAgICAgICAudGhlbihoYW5kbGVyc1trZXldKTtcclxuICAgICAgICB9XHJcbiAgICB9XHJcblxyXG4gICAgZnVuY3Rpb24gZ2V0UG9zaXRpb24ob3B0aW9ucykge1xyXG4gICAgICAgIHZhciBkZXJlcnJlZCA9ICRxLmRlZmVyKCk7XHJcblxyXG4gICAgICAgIGlmIChfaXNWYWxpZENvb3JkcyhvcHRpb25zLmNvb3JkcykpIHtcclxuICAgICAgICAgICAgZGVyZXJyZWQucmVzb2x2ZSh7IGNvb3Jkczogb3B0aW9ucy5jb29yZHMgfSk7XHJcbiAgICAgICAgfSBlbHNlIHtcclxuICAgICAgICAgICAgbmF2aWdhdG9yLmdlb2xvY2F0aW9uLmdldEN1cnJlbnRQb3NpdGlvbihmdW5jdGlvbihyZXNwb25zZSkge1xyXG4gICAgICAgICAgICAgICAgZGVyZXJyZWQucmVzb2x2ZShyZXNwb25zZSk7XHJcbiAgICAgICAgICAgIH0sIGZ1bmN0aW9uKGVycm9yKSB7XHJcbiAgICAgICAgICAgICAgICBkZXJlcnJlZC5yZWplY3QoZXJyb3IpO1xyXG4gICAgICAgICAgICB9LCBvcHRpb25zKTtcclxuICAgICAgICB9XHJcblxyXG4gICAgICAgIHJldHVybiBkZXJlcnJlZC5wcm9taXNlO1xyXG4gICAgfVxyXG5cclxuICAgIC8qKlxyXG4gICAgICogQHBhcmFtcyB7T2JqZWN0fSBkcml2ZVR5cGUsIGZyb20sIHRvXHJcbiAgICAgKi9cclxuICAgIGZ1bmN0aW9uIGNhbGN1bGF0ZVJvdXRlKHBsYXRmb3JtLCBtYXAsIHBhcmFtcykge1xyXG4gICAgICAgIHZhciByb3V0ZXIgPSBwbGF0Zm9ybS5nZXRSb3V0aW5nU2VydmljZSgpLFxyXG4gICAgICAgICAgICBkaXIgPSBwYXJhbXMuZGlyZWN0aW9uO1xyXG4gICAgICAgIFxyXG4gICAgICAgIHZhciByb3V0ZVJlcXVlc3RQYXJhbXMgPSB7XHJcbiAgICAgICAgICAgIG1vZGU6ICdmYXN0ZXN0O3t7VmVjaGlsZX19Jy5yZXBsYWNlKC97e1ZlY2hpbGV9fS8sIHBhcmFtcy5kcml2ZVR5cGUpLFxyXG4gICAgICAgICAgICByZXByZXNlbnRhdGlvbjogJ2Rpc3BsYXknLFxyXG4gICAgICAgICAgICByb3V0ZWF0dHJpYnV0ZXM6ICd3YXlwb2ludHMsc3VtbWFyeSxzaGFwZSxsZWdzJyxcclxuICAgICAgICAgICAgbWFuZXV2ZXJhdHRyaWJ1dGVzOiAnZGlyZWN0aW9uLGFjdGlvbicsXHJcbiAgICAgICAgICAgIHdheXBvaW50MDogW2Rpci5mcm9tLmxhdCwgZGlyLmZyb20ubG5nXS5qb2luKCcsJyksXHJcbiAgICAgICAgICAgIHdheXBvaW50MTogW2Rpci50by5sYXQsIGRpci50by5sbmddLmpvaW4oJywnKVxyXG4gICAgICAgIH07XHJcbiAgICAgICAgICAgIFxyXG4gICAgICAgIHJvdXRlci5jYWxjdWxhdGVSb3V0ZShcclxuICAgICAgICAgICAgcm91dGVSZXF1ZXN0UGFyYW1zLFxyXG4gICAgICAgICAgICBfb25Sb3V0ZVN1Y2Nlc3MsXHJcbiAgICAgICAgICAgIF9vblJvdXRlRmFpbHVyZVxyXG4gICAgICAgICk7XHJcbiAgICB9XHJcbiAgICAvLyNlbmRyZWdpb24gUFVCTElDXHJcblxyXG5cclxuICAgIC8vI3JlZ2lvbiBQUklWQVRFXHJcbiAgICBmdW5jdGlvbiBfb25Sb3V0ZVN1Y2Nlc3MocmVzdWx0KXtcclxuICAgICAgICBjb25zb2xlLmxvZyhyZXN1bHQpXHJcbiAgICB9XHJcbiAgICBcclxuICAgIGZ1bmN0aW9uIF9vblJvdXRlRmFpbHVyZShlcnJvcil7XHJcbiAgICAgICAgLy8gY29uc29sZS5sb2coJ0NhbGN1bGF0ZSByb3V0ZSBmYWlsdXJlJywgZXJyb3IpO1xyXG4gICAgfVxyXG4gICAgXHJcbiAgICBmdW5jdGlvbiBfZ2V0TG9hZGVyQnlBdHRyKGF0dHIpIHtcclxuICAgICAgICB2YXIgbG9hZGVyO1xyXG5cclxuICAgICAgICBzd2l0Y2ggKGF0dHIpIHtcclxuICAgICAgICAgICAgY2FzZSBDT05TVFMuTU9EVUxFUy5VSTpcclxuICAgICAgICAgICAgICAgIGxvYWRlciA9IF9sb2FkVUlNb2R1bGU7XHJcbiAgICAgICAgICAgICAgICBicmVhaztcclxuICAgICAgICAgICAgY2FzZSBDT05TVFMuTU9EVUxFUy5FVkVOVFM6XHJcbiAgICAgICAgICAgICAgICBsb2FkZXIgPSBfbG9hZEV2ZW50c01vZHVsZTtcclxuICAgICAgICAgICAgICAgIGJyZWFrO1xyXG4gICAgICAgICAgICBkZWZhdWx0OlxyXG4gICAgICAgICAgICAgICAgdGhyb3cgbmV3IEVycm9yKCdVbmtub3duIG1vZHVsZScsIGF0dHIpO1xyXG4gICAgICAgIH1cclxuXHJcbiAgICAgICAgcmV0dXJuIGxvYWRlcjtcclxuICAgIH1cclxuXHJcbiAgICBmdW5jdGlvbiBfbG9hZFVJTW9kdWxlKCkge1xyXG4gICAgICAgIGlmICghX2lzTG9hZGVkKENPTkZJRy5VSSkpIHtcclxuICAgICAgICAgICAgdmFyIGxpbmsgPSBIZXJlTWFwVXRpbHNTZXJ2aWNlLmNyZWF0ZUxpbmtUYWcoe1xyXG4gICAgICAgICAgICAgICAgcmVsOiAnc3R5bGVzaGVldCcsXHJcbiAgICAgICAgICAgICAgICB0eXBlOiAndGV4dC9jc3MnLFxyXG4gICAgICAgICAgICAgICAgaHJlZjogX2dldFVSTChDT05GSUcuVUkuaHJlZilcclxuICAgICAgICAgICAgfSk7XHJcblxyXG4gICAgICAgICAgICBsaW5rICYmIGhlYWQuYXBwZW5kQ2hpbGQobGluayk7XHJcbiAgICAgICAgfVxyXG5cclxuICAgICAgICByZXR1cm4gX2dldExvYWRlcihDT05GSUcuVUkuc3JjKTtcclxuICAgIH1cclxuXHJcbiAgICBmdW5jdGlvbiBfbG9hZEV2ZW50c01vZHVsZSgpIHtcclxuICAgICAgICByZXR1cm4gX2dldExvYWRlcihDT05GSUcuRVZFTlRTKTtcclxuICAgIH1cclxuXHJcbiAgICAvKipcclxuICAgICAqIEBwYXJhbSB7U3RyaW5nfSBzb3VyY2VOYW1lXHJcbiAgICAgKiByZXR1cm4ge1N0cmluZ30gZS5nIGh0dHA6Ly9qcy5hcGkuaGVyZS5jb20vdntWRVJ9L3tTVUJWRVJTSU9OfS97U09VUkNFfVxyXG4gICAgICovXHJcbiAgICBmdW5jdGlvbiBfZ2V0VVJMKHNvdXJjZU5hbWUpIHtcclxuICAgICAgICByZXR1cm4gW1xyXG4gICAgICAgICAgICBDT05GSUcuQkFTRSxcclxuICAgICAgICAgICAgQVBJX1ZFUlNJT04uVixcclxuICAgICAgICAgICAgXCIvXCIsXHJcbiAgICAgICAgICAgIEFQSV9WRVJTSU9OLlNVQixcclxuICAgICAgICAgICAgXCIvXCIsXHJcbiAgICAgICAgICAgIHNvdXJjZU5hbWVcclxuICAgICAgICBdLmpvaW4oXCJcIik7XHJcbiAgICB9XHJcblxyXG4gICAgZnVuY3Rpb24gX2dldExvYWRlcihzb3VyY2VOYW1lKSB7XHJcbiAgICAgICAgdmFyIGRlZmVyID0gJHEuZGVmZXIoKSwgc3JjLCBzY3JpcHQ7XHJcblxyXG4gICAgICAgIGlmIChfaXNMb2FkZWQoc291cmNlTmFtZSkpIHtcclxuICAgICAgICAgICAgZGVmZXIucmVzb2x2ZSgpO1xyXG4gICAgICAgIH0gZWxzZSB7XHJcbiAgICAgICAgICAgIHNyYyA9IF9nZXRVUkwoc291cmNlTmFtZSksXHJcbiAgICAgICAgICAgICAgICBzY3JpcHQgPSBIZXJlTWFwVXRpbHNTZXJ2aWNlLmNyZWF0ZVNjcmlwdFRhZyh7IHNyYzogc3JjIH0pO1xyXG5cclxuICAgICAgICAgICAgc2NyaXB0ICYmIGhlYWQuYXBwZW5kQ2hpbGQoc2NyaXB0KTtcclxuXHJcbiAgICAgICAgICAgIEFQSV9ERUZFUlNRdWV1ZVtzb3VyY2VOYW1lXS5wdXNoKGRlZmVyKTtcclxuXHJcbiAgICAgICAgICAgIHNjcmlwdC5vbmxvYWQgPSBfb25Mb2FkLmJpbmQobnVsbCwgc291cmNlTmFtZSk7XHJcbiAgICAgICAgICAgIHNjcmlwdC5vbmVycm9yID0gX29uRXJyb3IuYmluZChudWxsLCBzb3VyY2VOYW1lKTtcclxuICAgICAgICB9XHJcblxyXG4gICAgICAgIHJldHVybiBkZWZlci5wcm9taXNlO1xyXG4gICAgfVxyXG5cclxuICAgIGZ1bmN0aW9uIF9pc0xvYWRlZChzb3VyY2VOYW1lKSB7XHJcbiAgICAgICAgdmFyIGNoZWNrZXIgPSBudWxsO1xyXG5cclxuICAgICAgICBzd2l0Y2ggKHNvdXJjZU5hbWUpIHtcclxuICAgICAgICAgICAgY2FzZSBDT05GSUcuQ09SRTpcclxuICAgICAgICAgICAgICAgIGNoZWNrZXIgPSBfaXNDb3JlTG9hZGVkO1xyXG4gICAgICAgICAgICAgICAgYnJlYWs7XHJcbiAgICAgICAgICAgIGNhc2UgQ09ORklHLlNFUlZJQ0U6XHJcbiAgICAgICAgICAgICAgICBjaGVja2VyID0gX2lzU2VydmljZUxvYWRlZDtcclxuICAgICAgICAgICAgICAgIGJyZWFrO1xyXG4gICAgICAgICAgICBjYXNlIENPTkZJRy5VSTpcclxuICAgICAgICAgICAgICAgIGNoZWNrZXIgPSBfaXNVSUxvYWRlZDtcclxuICAgICAgICAgICAgICAgIGJyZWFrO1xyXG4gICAgICAgICAgICBjYXNlIENPTkZJRy5FVkVOVFM6XHJcbiAgICAgICAgICAgICAgICBjaGVja2VyID0gX2lzRXZlbnRzTG9hZGVkO1xyXG4gICAgICAgICAgICAgICAgYnJlYWs7XHJcbiAgICAgICAgICAgIGRlZmF1bHQ6XHJcbiAgICAgICAgICAgICAgICBjaGVja2VyID0gZnVuY3Rpb24oKSB7IHJldHVybiBmYWxzZSB9O1xyXG4gICAgICAgIH1cclxuXHJcbiAgICAgICAgcmV0dXJuIGNoZWNrZXIoKTtcclxuICAgIH1cclxuXHJcbiAgICBmdW5jdGlvbiBfaXNDb3JlTG9hZGVkKCkge1xyXG4gICAgICAgIHJldHVybiAhIXdpbmRvdy5IO1xyXG4gICAgfVxyXG5cclxuICAgIGZ1bmN0aW9uIF9pc1NlcnZpY2VMb2FkZWQoKSB7XHJcbiAgICAgICAgcmV0dXJuICEhKHdpbmRvdy5IICYmIHdpbmRvdy5ILnNlcnZpY2UpO1xyXG4gICAgfVxyXG5cclxuICAgIGZ1bmN0aW9uIF9pc1VJTG9hZGVkKCkge1xyXG4gICAgICAgIHJldHVybiAhISh3aW5kb3cuSCAmJiB3aW5kb3cuSC51aSk7XHJcbiAgICB9XHJcblxyXG4gICAgZnVuY3Rpb24gX2lzRXZlbnRzTG9hZGVkKCkge1xyXG4gICAgICAgIHJldHVybiAhISh3aW5kb3cuSCAmJiB3aW5kb3cuSC5tYXBldmVudHMpO1xyXG4gICAgfVxyXG5cclxuICAgIGZ1bmN0aW9uIF9vbkxvYWQoc291cmNlTmFtZSkge1xyXG4gICAgICAgIHZhciBkZWZlclF1ZXVlID0gQVBJX0RFRkVSU1F1ZXVlW3NvdXJjZU5hbWVdO1xyXG4gICAgICAgIGZvciAodmFyIGkgPSAwLCBsID0gZGVmZXJRdWV1ZS5sZW5ndGg7IGkgPCBsOyArK2kpIHtcclxuICAgICAgICAgICAgdmFyIGRlZmVyID0gZGVmZXJRdWV1ZVtpXTtcclxuICAgICAgICAgICAgZGVmZXIucmVzb2x2ZSgpO1xyXG4gICAgICAgIH1cclxuXHJcbiAgICAgICAgQVBJX0RFRkVSU1F1ZXVlW3NvdXJjZU5hbWVdID0gW107XHJcbiAgICB9XHJcblxyXG4gICAgZnVuY3Rpb24gX29uRXJyb3Ioc291cmNlTmFtZSkge1xyXG4gICAgICAgIHZhciBkZWZlclF1ZXVlID0gQVBJX0RFRkVSU1F1ZXVlW3NvdXJjZU5hbWVdO1xyXG4gICAgICAgIGZvciAodmFyIGkgPSAwLCBsID0gZGVmZXJRdWV1ZS5sZW5ndGg7IGkgPCBsOyArK2kpIHtcclxuICAgICAgICAgICAgdmFyIGRlZmVyID0gZGVmZXJRdWV1ZVtpXTtcclxuICAgICAgICAgICAgZGVmZXIucmVqZWN0KCk7XHJcbiAgICAgICAgfVxyXG5cclxuICAgICAgICBBUElfREVGRVJTUXVldWVbc291cmNlTmFtZV0gPSBbXTtcclxuICAgIH1cclxuICAgIFxyXG4gICAgXHJcbiAgICAvKipcclxuICAgICAqIENyZWF0ZXMgYSBILm1hcC5Qb2x5bGluZSBmcm9tIHRoZSBzaGFwZSBvZiB0aGUgcm91dGUgYW5kIGFkZHMgaXQgdG8gdGhlIG1hcC5cclxuICAgICAqIEBwYXJhbSB7T2JqZWN0fSByb3V0ZSBBIHJvdXRlIGFzIHJlY2VpdmVkIGZyb20gdGhlIEguc2VydmljZS5Sb3V0aW5nU2VydmljZVxyXG4gICAgICovXHJcbiAgICBmdW5jdGlvbiBhZGRSb3V0ZVNoYXBlVG9NYXAobWFwLCByb3V0ZSl7XHJcbiAgICAgICAgdmFyIHN0cmlwID0gbmV3IEguZ2VvLlN0cmlwKCksXHJcbiAgICAgICAgICAgIHJvdXRlU2hhcGUgPSByb3V0ZS5zaGFwZSxcclxuICAgICAgICAgICAgcG9seWxpbmU7XHJcblxyXG4gICAgICAgIHJvdXRlU2hhcGUuZm9yRWFjaChmdW5jdGlvbihwb2ludCkge1xyXG4gICAgICAgICAgICB2YXIgcGFydHMgPSBwb2ludC5zcGxpdCgnLCcpO1xyXG4gICAgICAgICAgICBzdHJpcC5wdXNoTGF0TG5nQWx0KHBhcnRzWzBdLCBwYXJ0c1sxXSk7XHJcbiAgICAgICAgfSk7XHJcblxyXG4gICAgICAgIHBvbHlsaW5lID0gbmV3IEgubWFwLlBvbHlsaW5lKHN0cmlwLCB7XHJcbiAgICAgICAgICAgIHN0eWxlOiB7XHJcbiAgICAgICAgICAgIGxpbmVXaWR0aDogNCxcclxuICAgICAgICAgICAgc3Ryb2tlQ29sb3I6ICdyZ2JhKDAsIDEyOCwgMjU1LCAwLjcpJ1xyXG4gICAgICAgICAgICB9XHJcbiAgICAgICAgfSk7XHJcbiAgICAgICAgLy8gQWRkIHRoZSBwb2x5bGluZSB0byB0aGUgbWFwXHJcbiAgICAgICAgbWFwLmFkZE9iamVjdChwb2x5bGluZSk7XHJcbiAgICAgICAgLy8gQW5kIHpvb20gdG8gaXRzIGJvdW5kaW5nIHJlY3RhbmdsZVxyXG4gICAgICAgIG1hcC5zZXRWaWV3Qm91bmRzKHBvbHlsaW5lLmdldEJvdW5kcygpLCB0cnVlKTtcclxuICAgIH1cclxuXHJcblxyXG4gICAgLyoqXHJcbiAgICAgKiBDcmVhdGVzIGEgc2VyaWVzIG9mIEgubWFwLk1hcmtlciBwb2ludHMgZnJvbSB0aGUgcm91dGUgYW5kIGFkZHMgdGhlbSB0byB0aGUgbWFwLlxyXG4gICAgICogQHBhcmFtIHtPYmplY3R9IHJvdXRlICBBIHJvdXRlIGFzIHJlY2VpdmVkIGZyb20gdGhlIEguc2VydmljZS5Sb3V0aW5nU2VydmljZVxyXG4gICAgICovXHJcbiAgICBmdW5jdGlvbiBhZGRNYW51ZXZlcnNUb01hcChtYXAsIHJvdXRlKXtcclxuICAgICAgICB2YXIgc3ZnTWFya3VwID0gJzxzdmcgd2lkdGg9XCIxOFwiIGhlaWdodD1cIjE4XCIgJyArXHJcbiAgICAgICAgICAgICd4bWxucz1cImh0dHA6Ly93d3cudzMub3JnLzIwMDAvc3ZnXCI+JyArXHJcbiAgICAgICAgICAgICc8Y2lyY2xlIGN4PVwiOFwiIGN5PVwiOFwiIHI9XCI4XCIgJyArXHJcbiAgICAgICAgICAgICdmaWxsPVwiIzFiNDY4ZFwiIHN0cm9rZT1cIndoaXRlXCIgc3Ryb2tlLXdpZHRoPVwiMVwiICAvPicgK1xyXG4gICAgICAgICAgICAnPC9zdmc+JyxcclxuICAgICAgICAgICAgZG90SWNvbiA9IG5ldyBILm1hcC5JY29uKHN2Z01hcmt1cCwge2FuY2hvcjoge3g6OCwgeTo4fX0pLFxyXG4gICAgICAgICAgICBncm91cCA9IG5ldyAgSC5tYXAuR3JvdXAoKSxcclxuICAgICAgICAgICAgaSxcclxuICAgICAgICAgICAgajtcclxuXHJcbiAgICAgICAgLy8gQWRkIGEgbWFya2VyIGZvciBlYWNoIG1hbmV1dmVyXHJcbiAgICAgICAgZm9yIChpID0gMDsgIGkgPCByb3V0ZS5sZWcubGVuZ3RoOyBpICs9IDEpIHtcclxuICAgICAgICAgICAgZm9yIChqID0gMDsgIGogPCByb3V0ZS5sZWdbaV0ubWFuZXV2ZXIubGVuZ3RoOyBqICs9IDEpIHtcclxuICAgICAgICAgICAgICAgIC8vIEdldCB0aGUgbmV4dCBtYW5ldXZlci5cclxuICAgICAgICAgICAgICAgIG1hbmV1dmVyID0gcm91dGUubGVnW2ldLm1hbmV1dmVyW2pdO1xyXG4gICAgICAgICAgICAgICAgLy8gQWRkIGEgbWFya2VyIHRvIHRoZSBtYW5ldXZlcnMgZ3JvdXBcclxuICAgICAgICAgICAgICAgIHZhciBtYXJrZXIgPSAgbmV3IEgubWFwLk1hcmtlcih7XHJcbiAgICAgICAgICAgICAgICAgICAgICAgIGxhdDogbWFuZXV2ZXIucG9zaXRpb24ubGF0aXR1ZGUsXHJcbiAgICAgICAgICAgICAgICAgICAgICAgIGxuZzogbWFuZXV2ZXIucG9zaXRpb24ubG9uZ2l0dWRlfSxcclxuICAgICAgICAgICAgICAgICAgICAgICAge2ljb246IGRvdEljb259XHJcbiAgICAgICAgICAgICAgICAgICAgKTtcclxuICAgICAgICAgICAgICAgICAgICBcclxuICAgICAgICAgICAgICAgIG1hcmtlci5pbnN0cnVjdGlvbiA9IG1hbmV1dmVyLmluc3RydWN0aW9uO1xyXG4gICAgICAgICAgICAgICAgZ3JvdXAuYWRkT2JqZWN0KG1hcmtlcik7XHJcbiAgICAgICAgICAgIH1cclxuICAgICAgICB9XHJcblxyXG4gICAgICAgIGdyb3VwLmFkZEV2ZW50TGlzdGVuZXIoJ3RhcCcsIGZ1bmN0aW9uIChldnQpIHtcclxuICAgICAgICAgICAgbWFwLnNldENlbnRlcihldnQudGFyZ2V0LmdldFBvc2l0aW9uKCkpO1xyXG4gICAgICAgICAgICBvcGVuQnViYmxlKGV2dC50YXJnZXQuZ2V0UG9zaXRpb24oKSwgZXZ0LnRhcmdldC5pbnN0cnVjdGlvbik7XHJcbiAgICAgICAgfSwgZmFsc2UpO1xyXG5cclxuICAgICAgICAvLyBBZGQgdGhlIG1hbmV1dmVycyBncm91cCB0byB0aGUgbWFwXHJcbiAgICAgICAgbWFwLmFkZE9iamVjdChncm91cCk7XHJcbiAgICB9XHJcblxyXG5cclxuICAgIC8qKlxyXG4gICAgICogQ3JlYXRlcyBhIHNlcmllcyBvZiBILm1hcC5NYXJrZXIgcG9pbnRzIGZyb20gdGhlIHJvdXRlIGFuZCBhZGRzIHRoZW0gdG8gdGhlIG1hcC5cclxuICAgICAqIEBwYXJhbSB7T2JqZWN0fSByb3V0ZSAgQSByb3V0ZSBhcyByZWNlaXZlZCBmcm9tIHRoZSBILnNlcnZpY2UuUm91dGluZ1NlcnZpY2VcclxuICAgICAqL1xyXG4gICAgZnVuY3Rpb24gYWRkV2F5cG9pbnRzVG9QYW5lbCh3YXlwb2ludHMpe1xyXG4gICAgICAgIHZhciBub2RlSDMgPSBkb2N1bWVudC5jcmVhdGVFbGVtZW50KCdoMycpLFxyXG4gICAgICAgICAgICB3YXlwb2ludExhYmVscyA9IFtdLFxyXG4gICAgICAgICAgICBpO1xyXG5cclxuICAgICAgICBmb3IgKGkgPSAwOyAgaSA8IHdheXBvaW50cy5sZW5ndGg7IGkgKz0gMSkge1xyXG4gICAgICAgICAgICB3YXlwb2ludExhYmVscy5wdXNoKHdheXBvaW50c1tpXS5sYWJlbClcclxuICAgICAgICB9XHJcblxyXG4gICAgICAgIG5vZGVIMy50ZXh0Q29udGVudCA9IHdheXBvaW50TGFiZWxzLmpvaW4oJyAtICcpO1xyXG5cclxuICAgICAgICByb3V0ZUluc3RydWN0aW9uc0NvbnRhaW5lci5pbm5lckhUTUwgPSAnJztcclxuICAgICAgICByb3V0ZUluc3RydWN0aW9uc0NvbnRhaW5lci5hcHBlbmRDaGlsZChub2RlSDMpO1xyXG4gICAgfVxyXG5cclxuICAgIC8qKlxyXG4gICAgICogQ3JlYXRlcyBhIHNlcmllcyBvZiBILm1hcC5NYXJrZXIgcG9pbnRzIGZyb20gdGhlIHJvdXRlIGFuZCBhZGRzIHRoZW0gdG8gdGhlIG1hcC5cclxuICAgICAqIEBwYXJhbSB7T2JqZWN0fSByb3V0ZSAgQSByb3V0ZSBhcyByZWNlaXZlZCBmcm9tIHRoZSBILnNlcnZpY2UuUm91dGluZ1NlcnZpY2VcclxuICAgICAqL1xyXG4gICAgZnVuY3Rpb24gYWRkU3VtbWFyeVRvUGFuZWwoc3VtbWFyeSl7XHJcbiAgICAgICAgdmFyIHN1bW1hcnlEaXYgPSBkb2N1bWVudC5jcmVhdGVFbGVtZW50KCdkaXYnKSxcclxuICAgICAgICAgICAgY29udGVudCA9ICcnO1xyXG4gICAgICAgICAgICBcclxuICAgICAgICBjb250ZW50ICs9ICc8Yj5Ub3RhbCBkaXN0YW5jZTwvYj46ICcgKyBzdW1tYXJ5LmRpc3RhbmNlICArICdtLiA8YnIvPic7XHJcbiAgICAgICAgY29udGVudCArPSAnPGI+VHJhdmVsIFRpbWU8L2I+OiAnICsgc3VtbWFyeS50cmF2ZWxUaW1lLnRvTU1TUygpICsgJyAoaW4gY3VycmVudCB0cmFmZmljKSc7XHJcblxyXG5cclxuICAgICAgICBzdW1tYXJ5RGl2LnN0eWxlLmZvbnRTaXplID0gJ3NtYWxsJztcclxuICAgICAgICBzdW1tYXJ5RGl2LnN0eWxlLm1hcmdpbkxlZnQgPSc1JSc7XHJcbiAgICAgICAgc3VtbWFyeURpdi5zdHlsZS5tYXJnaW5SaWdodCA9JzUlJztcclxuICAgICAgICBzdW1tYXJ5RGl2LmlubmVySFRNTCA9IGNvbnRlbnQ7XHJcbiAgICAgICAgcm91dGVJbnN0cnVjdGlvbnNDb250YWluZXIuYXBwZW5kQ2hpbGQoc3VtbWFyeURpdik7XHJcbiAgICB9XHJcblxyXG4gICAgLyoqXHJcbiAgICAgKiBDcmVhdGVzIGEgc2VyaWVzIG9mIEgubWFwLk1hcmtlciBwb2ludHMgZnJvbSB0aGUgcm91dGUgYW5kIGFkZHMgdGhlbSB0byB0aGUgbWFwLlxyXG4gICAgICogQHBhcmFtIHtPYmplY3R9IHJvdXRlICBBIHJvdXRlIGFzIHJlY2VpdmVkIGZyb20gdGhlIEguc2VydmljZS5Sb3V0aW5nU2VydmljZVxyXG4gICAgICovXHJcbiAgICBmdW5jdGlvbiBhZGRNYW51ZXZlcnNUb1BhbmVsKHJvdXRlKXtcclxuICAgICAgICB2YXIgbm9kZU9MID0gZG9jdW1lbnQuY3JlYXRlRWxlbWVudCgnb2wnKSwgaSwgajtcclxuXHJcbiAgICAgICAgbm9kZU9MLnN0eWxlLmZvbnRTaXplID0gJ3NtYWxsJztcclxuICAgICAgICBub2RlT0wuc3R5bGUubWFyZ2luTGVmdCA9JzUlJztcclxuICAgICAgICBub2RlT0wuc3R5bGUubWFyZ2luUmlnaHQgPSc1JSc7XHJcbiAgICAgICAgbm9kZU9MLmNsYXNzTmFtZSA9ICdkaXJlY3Rpb25zJztcclxuXHJcbiAgICAgICAgLy8gQWRkIGEgbWFya2VyIGZvciBlYWNoIG1hbmV1dmVyXHJcbiAgICAgICAgZm9yIChpID0gMDsgIGkgPCByb3V0ZS5sZWcubGVuZ3RoOyBpICs9IDEpIHtcclxuICAgICAgICAgICAgZm9yIChqID0gMDsgIGogPCByb3V0ZS5sZWdbaV0ubWFuZXV2ZXIubGVuZ3RoOyBqICs9IDEpIHtcclxuICAgICAgICAgICAgLy8gR2V0IHRoZSBuZXh0IG1hbmV1dmVyLlxyXG4gICAgICAgICAgICBtYW5ldXZlciA9IHJvdXRlLmxlZ1tpXS5tYW5ldXZlcltqXTtcclxuXHJcbiAgICAgICAgICAgIHZhciBsaSA9IGRvY3VtZW50LmNyZWF0ZUVsZW1lbnQoJ2xpJyksXHJcbiAgICAgICAgICAgICAgICBzcGFuQXJyb3cgPSBkb2N1bWVudC5jcmVhdGVFbGVtZW50KCdzcGFuJyksXHJcbiAgICAgICAgICAgICAgICBzcGFuSW5zdHJ1Y3Rpb24gPSBkb2N1bWVudC5jcmVhdGVFbGVtZW50KCdzcGFuJyk7XHJcblxyXG4gICAgICAgICAgICBzcGFuQXJyb3cuY2xhc3NOYW1lID0gJ2Fycm93ICcgICsgbWFuZXV2ZXIuYWN0aW9uO1xyXG4gICAgICAgICAgICBzcGFuSW5zdHJ1Y3Rpb24uaW5uZXJIVE1MID0gbWFuZXV2ZXIuaW5zdHJ1Y3Rpb247XHJcbiAgICAgICAgICAgIGxpLmFwcGVuZENoaWxkKHNwYW5BcnJvdyk7XHJcbiAgICAgICAgICAgIGxpLmFwcGVuZENoaWxkKHNwYW5JbnN0cnVjdGlvbik7XHJcblxyXG4gICAgICAgICAgICBub2RlT0wuYXBwZW5kQ2hpbGQobGkpO1xyXG4gICAgICAgICAgICB9XHJcbiAgICAgICAgfVxyXG5cclxuICAgICAgICByb3V0ZUluc3RydWN0aW9uc0NvbnRhaW5lci5hcHBlbmRDaGlsZChub2RlT0wpO1xyXG4gICAgfVxyXG4gICAgXHJcbiAgICBmdW5jdGlvbiBfaXNWYWxpZENvb3Jkcyhjb29yZHMpe1xyXG4gICAgICAgIHZhciBsbmcgPSBjb29yZHMgJiYgY29vcmRzLmxvbmdpdHVkZSxcclxuICAgICAgICAgICAgbGF0ID0gY29vcmRzICYmIGNvb3Jkcy5sYXRpdHVkZTtcclxuICAgICAgICAgICAgXHJcbiAgICAgICAgcmV0dXJuICh0eXBlb2YgbG5nID09PSAnbnVtYmVyJyB8fCB0eXBlb2YgbG5nID09PSAnc3RyaW5nJykgJiZcclxuICAgICAgICAgICAgICAgICh0eXBlb2YgbGF0ID09PSAnbnVtYmVyJyB8fCB0eXBlb2YgbGF0ID09PSAnc3RyaW5nJyk7IFxyXG4gICAgfVxyXG59OyIsIm1vZHVsZS5leHBvcnRzID0ge1xyXG4gICAgXCJVUERBVEVfTUFQX1JFU0laRV9USU1FT1VUXCI6IDUwMCxcclxuICAgIFwiTU9EVUxFU1wiOiB7XHJcbiAgICAgICAgVUk6ICdjb250cm9scycsXHJcbiAgICAgICAgRVZFTlRTOiAnZXZlbnRzJyxcclxuICAgICAgICBQQU5POiAncGFubydcclxuICAgIH0sXHJcbiAgICBcIkRFRkFVTFRfTUFQX09QVElPTlNcIjoge1xyXG4gICAgICAgIGhlaWdodDogNDgwLFxyXG4gICAgICAgIHdpZHRoOiA2NDAsXHJcbiAgICAgICAgem9vbTogMTAsXHJcbiAgICAgICAgZHJhZ2dhYmxlOiBmYWxzZSxcclxuICAgICAgICBjb29yZHM6IHtcclxuICAgICAgICAgICAgbG9uZ2l0dWRlOiAwLFxyXG4gICAgICAgICAgICBsYXRpdHVkZTogMFxyXG4gICAgICAgIH1cclxuICAgIH0sXHJcbiAgICBcIk1BUktFUl9UWVBFU1wiOiB7XHJcbiAgICAgICAgRE9NOiBcIkRPTVwiLFxyXG4gICAgICAgIFNWRzogXCJTVkdcIlxyXG4gICAgfSxcclxuICAgIFwiQ09OVFJPTFNcIjoge1xyXG4gICAgICAgIHNldHRpbmdzOiAnbWFwc2V0dGluZ3MnLFxyXG4gICAgICAgIHpvb206ICd6b29tJyxcclxuICAgICAgICBzY2FsZTogJ3NjYWxlYmFyJyxcclxuICAgICAgICBwYW5vOiAncGFub3JhbWEnXHJcbiAgICB9XHJcbn0iLCJtb2R1bGUuZXhwb3J0cyA9IGZ1bmN0aW9uKCkge1xyXG4gICAgdmFyIG9wdGlvbnMgPSB7fTtcclxuICAgIHZhciBERUZBVUxUX0FQSV9WRVJTSU9OID0gXCIzLjBcIjtcclxuXHJcbiAgICB0aGlzLiRnZXQgPSBmdW5jdGlvbigpe1xyXG4gICAgICAgIHJldHVybiB7XHJcbiAgICAgICAgICAgIGFwcF9pZDogb3B0aW9ucy5hcHBfaWQsXHJcbiAgICAgICAgICAgIGFwcF9jb2RlOiBvcHRpb25zLmFwcF9jb2RlLFxyXG4gICAgICAgICAgICBhcGlWZXJzaW9uOiBvcHRpb25zLmFwaVZlcnNpb24gfHwgREVGQVVMVF9BUElfVkVSU0lPTixcclxuICAgICAgICAgICAgdXNlSFRUUFM6IG9wdGlvbnMudXNlSFRUUFNcclxuICAgICAgICB9XHJcbiAgICB9O1xyXG5cclxuICAgIHRoaXMuc2V0T3B0aW9ucyA9IGZ1bmN0aW9uKG9wdHMpe1xyXG4gICAgICAgIG9wdGlvbnMgPSBvcHRzO1xyXG4gICAgfTtcclxufTsiLCJtb2R1bGUuZXhwb3J0cyA9IGZ1bmN0aW9uKE1hcmtlckludGVyZmFjZSl7XHJcbiAgICBmdW5jdGlvbiBEZWZhdWx0TWFya2VyKHBsYWNlKXtcclxuICAgICAgICB0aGlzLnBsYWNlID0gcGxhY2U7XHJcbiAgICAgICAgdGhpcy5zZXRDb29yZHMoKTtcclxuICAgIH1cclxuXHJcbiAgICB2YXIgcHJvdG8gPSBEZWZhdWx0TWFya2VyLnByb3RvdHlwZSA9IG5ldyBNYXJrZXJJbnRlcmZhY2UoKTtcclxuICAgIHByb3RvLmNvbnN0cnVjdG9yID0gRGVmYXVsdE1hcmtlcjtcclxuXHJcbiAgICBwcm90by5jcmVhdGUgPSBjcmVhdGU7XHJcblxyXG4gICAgcmV0dXJuIERlZmF1bHRNYXJrZXI7XHJcbiAgICBcclxuICAgIGZ1bmN0aW9uIGNyZWF0ZSgpe1xyXG4gICAgICAgIHJldHVybiBuZXcgSC5tYXAuTWFya2VyKHRoaXMuY29vcmRzKTtcclxuICAgIH1cclxufSIsIm1vZHVsZS5leHBvcnRzID0gZnVuY3Rpb24oTWFya2VySW50ZXJmYWNlKXtcclxuICAgIGZ1bmN0aW9uIERPTU1hcmtlcihwbGFjZSl7XHJcbiAgICAgICAgdGhpcy5wbGFjZSA9IHBsYWNlO1xyXG4gICAgICAgIHRoaXMuc2V0Q29vcmRzKCk7XHJcbiAgICB9XHJcblxyXG4gICAgdmFyIHByb3RvID0gRE9NTWFya2VyLnByb3RvdHlwZSA9IG5ldyBNYXJrZXJJbnRlcmZhY2UoKTtcclxuICAgIHByb3RvLmNvbnN0cnVjdG9yID0gRE9NTWFya2VyO1xyXG5cclxuICAgIHByb3RvLmNyZWF0ZSA9IGNyZWF0ZTtcclxuICAgIHByb3RvLl9nZXRJY29uID0gX2dldEljb247XHJcbiAgICBwcm90by5fc2V0dXBFdmVudHMgPSBfc2V0dXBFdmVudHM7XHJcbiAgICBwcm90by5fZ2V0RXZlbnRzID0gX2dldEV2ZW50cztcclxuXHJcbiAgICByZXR1cm4gRE9NTWFya2VyO1xyXG4gICAgXHJcbiAgICBmdW5jdGlvbiBjcmVhdGUoKXtcclxuICAgICAgICByZXR1cm4gbmV3IEgubWFwLkRvbU1hcmtlcih0aGlzLmNvb3Jkcywge1xyXG4gICAgICAgICAgICBpY29uOiB0aGlzLl9nZXRJY29uKClcclxuICAgICAgICB9KTtcclxuICAgIH1cclxuICAgIFxyXG4gICAgZnVuY3Rpb24gX2dldEljb24oKXtcclxuICAgICAgICB2YXIgaWNvbiA9IHRoaXMucGxhY2UubWFya3VwO1xyXG4gICAgICAgICBpZighaWNvbilcclxuICAgICAgICAgICAgdGhyb3cgbmV3IEVycm9yKCdtYXJrdXAgbWlzc2VkJyk7XHJcblxyXG4gICAgICAgIHJldHVybiBuZXcgSC5tYXAuRG9tSWNvbihpY29uLCB0aGlzLl9nZXRFdmVudHMoKSk7XHJcbiAgICB9XHJcbiAgICBcclxuICAgIGZ1bmN0aW9uIF9zZXR1cEV2ZW50cyhlbCwgZXZlbnRzLCByZW1vdmUpe1xyXG4gICAgICAgIHZhciBtZXRob2QgPSByZW1vdmUgPyAncmVtb3ZlRXZlbnRMaXN0ZW5lcicgOiAnYWRkRXZlbnRMaXN0ZW5lcic7XHJcblxyXG4gICAgICAgIGZvcih2YXIga2V5IGluIGV2ZW50cykge1xyXG4gICAgICAgICAgICBpZighZXZlbnRzLmhhc093blByb3BlcnR5KGtleSkpXHJcbiAgICAgICAgICAgICAgICBjb250aW51ZTtcclxuXHJcbiAgICAgICAgICAgIGVsW21ldGhvZF0uY2FsbChudWxsLCBrZXksIGV2ZW50c1trZXldKTtcclxuICAgICAgICB9XHJcbiAgICB9XHJcbiAgICBcclxuICAgIGZ1bmN0aW9uIF9nZXRFdmVudHMoKXtcclxuICAgICAgICB2YXIgc2VsZiA9IHRoaXMsXHJcbiAgICAgICAgICAgIGV2ZW50cyA9IHRoaXMucGxhY2UuZXZlbnRzO1xyXG5cclxuICAgICAgICBpZighdGhpcy5wbGFjZS5ldmVudHMpXHJcbiAgICAgICAgICAgIHJldHVybiB7fTtcclxuXHJcbiAgICAgICAgcmV0dXJuIHtcclxuICAgICAgICAgICAgb25BdHRhY2g6IGZ1bmN0aW9uKGNsb25lZEVsZW1lbnQsIGRvbUljb24sIGRvbU1hcmtlcil7XHJcbiAgICAgICAgICAgICAgICBzZWxmLl9zZXR1cEV2ZW50cyhjbG9uZWRFbGVtZW50LCBldmVudHMpO1xyXG4gICAgICAgICAgICB9LFxyXG4gICAgICAgICAgICBvbkRldGFjaDogZnVuY3Rpb24oY2xvbmVkRWxlbWVudCwgZG9tSWNvbiwgZG9tTWFya2VyKXtcclxuICAgICAgICAgICAgICAgIHNlbGYuX3NldHVwRXZlbnRzKGNsb25lZEVsZW1lbnQsIGV2ZW50cywgdHJ1ZSk7XHJcbiAgICAgICAgICAgIH1cclxuICAgICAgICB9XHJcbiAgICB9XHJcbn0iLCJtb2R1bGUuZXhwb3J0cyA9IGZ1bmN0aW9uKCl7XHJcbiAgICBmdW5jdGlvbiBNYXJrZXJJbnRlcmZhY2UoKXtcclxuICAgICAgICB0aHJvdyBuZXcgRXJyb3IoJ0Fic3RyYWN0IGNsYXNzISBUaGUgSW5zdGFuY2Ugc2hvdWxkIGJlIGNyZWF0ZWQnKTtcclxuICAgIH1cclxuICAgIFxyXG4gICAgdmFyIHByb3RvID0gTWFya2VySW50ZXJmYWNlLnByb3RvdHlwZTtcclxuICAgIFxyXG4gICAgcHJvdG8uY3JlYXRlID0gY3JlYXRlO1xyXG4gICAgcHJvdG8uc2V0Q29vcmRzID0gc2V0Q29vcmRzO1xyXG4gICAgXHJcbiAgICBmdW5jdGlvbiBNYXJrZXIoKXt9XHJcbiAgICBcclxuICAgIE1hcmtlci5wcm90b3R5cGUgPSBwcm90bztcclxuICAgIFxyXG4gICAgcmV0dXJuIE1hcmtlcjtcclxuICAgIFxyXG4gICAgZnVuY3Rpb24gY3JlYXRlKCl7XHJcbiAgICAgICAgdGhyb3cgbmV3IEVycm9yKCdjcmVhdGU6OiBub3QgaW1wbGVtZW50ZWQnKTsgXHJcbiAgICB9XHJcbiAgICBcclxuICAgIGZ1bmN0aW9uIHNldENvb3Jkcygpe1xyXG4gICAgICAgICB0aGlzLmNvb3JkcyA9IHtcclxuICAgICAgICAgICAgbGF0OiB0aGlzLnBsYWNlLnBvcy5sYXQsXHJcbiAgICAgICAgICAgIGxuZzogdGhpcy5wbGFjZS5wb3MubG5nXHJcbiAgICAgICAgfVxyXG4gICAgfVxyXG4gICAgXHJcbn0iLCJ2YXIgbWFya2VySW50ZXJmYWNlID0gcmVxdWlyZSgnLi9tYXJrZXIuanMnKSxcclxuXHRkZWZhdWx0TWFya2VyID0gcmVxdWlyZSgnLi9kZWZhdWx0Lm1hcmtlci5qcycpLFxyXG5cdGRvbU1hcmtlciA9IHJlcXVpcmUoJy4vZG9tLm1hcmtlci5qcycpLFxyXG5cdHN2Z01hcmtlciA9IHJlcXVpcmUoJy4vc3ZnLm1hcmtlci5qcycpLFxyXG4gICAgbWFya2Vyc1NlcnZpY2UgPSByZXF1aXJlKCcuL21hcmtlcnMuc2VydmljZS5qcycpO1xyXG5cclxuYW5ndWxhci5tb2R1bGUoJ21hcmtlci1pbnRlcmZhY2UnLCBbXSkuZmFjdG9yeSgnTWFya2VySW50ZXJmYWNlJywgbWFya2VySW50ZXJmYWNlKTtcclxuYW5ndWxhci5tb2R1bGUoJ2RlZmF1bHQtbWFya2VyJywgW10pLmZhY3RvcnkoJ0RlZmF1bHRNYXJrZXInLCBkZWZhdWx0TWFya2VyKTtcclxuYW5ndWxhci5tb2R1bGUoJ2RvbS1tYXJrZXInLCBbXSkuZmFjdG9yeSgnRE9NTWFya2VyJywgZG9tTWFya2VyKTtcclxuYW5ndWxhci5tb2R1bGUoJ3N2Zy1tYXJrZXInLCBbXSkuZmFjdG9yeSgnU1ZHTWFya2VyJywgc3ZnTWFya2VyKTtcclxuXHJcbmFuZ3VsYXIubW9kdWxlKCdtYXJrZXJzLXNlcnZpY2UnLCBbXSkuc2VydmljZSgnTWFya2Vyc1NlcnZpY2UnLCBtYXJrZXJzU2VydmljZSk7XHJcblxyXG52YXIgYXBwID0gYW5ndWxhci5tb2R1bGUoJ21hcmtlcnMtbW9kdWxlJywgW1xyXG5cdCdtYXJrZXItaW50ZXJmYWNlJyxcclxuICAgICdkZWZhdWx0LW1hcmtlcicsXHJcbiAgICAnZG9tLW1hcmtlcicsXHJcbiAgICAnbWFya2Vycy1zZXJ2aWNlJyxcclxuICAgICdzdmctbWFya2VyJ1xyXG5dKTtcclxuXHJcbm1vZHVsZS5leHBvcnRzID0gYXBwOyIsIm1vZHVsZS5leHBvcnRzID0gZnVuY3Rpb24oRGVmYXVsdE1hcmtlciwgRE9NTWFya2VyLCBTVkdNYXJrZXIsIENPTlNUUykge1xyXG5cclxuICAgIHZhciBNQVJLRVJfVFlQRVMgPSBDT05TVFMuTUFSS0VSX1RZUEVTO1xyXG4gICAgICAgIFxyXG4gICAgcmV0dXJuIHtcclxuICAgICAgICBhZGRNYXJrZXJzVG9NYXA6IGFkZE1hcmtlcnNUb01hcCxcclxuICAgICAgICBhZGRVc2VyTWFya2VyOiBhZGRVc2VyTWFya2VyLFxyXG4gICAgICAgIHVwZGF0ZU1hcmtlcnM6IHVwZGF0ZU1hcmtlcnNcclxuICAgIH1cclxuXHJcbiAgICBmdW5jdGlvbiBhZGRNYXJrZXJzVG9NYXAobWFwLCBwbGFjZXMpIHtcclxuICAgICAgICBpZiAoIXBsYWNlcyB8fCAhcGxhY2VzLmxlbmd0aClcclxuICAgICAgICAgICAgcmV0dXJuIGZhbHNlO1xyXG5cclxuICAgICAgICBpZiAoIShtYXAgaW5zdGFuY2VvZiBILk1hcCkpXHJcbiAgICAgICAgICAgIHRocm93IG5ldyBFcnJvcignVW5zdXBwb3J0ZWQgbWFwIGluc3RhbmNlJyk7XHJcblxyXG4gICAgICAgIGlmKCFtYXAubWFya2Vyc0dyb3VwKVxyXG4gICAgICAgICAgICBtYXAubWFya2Vyc0dyb3VwID0gbmV3IEgubWFwLkdyb3VwKCk7XHJcbiAgICAgICAgXHJcbiAgICAgICAgcGxhY2VzLmZvckVhY2goZnVuY3Rpb24ocGxhY2UsIGkpIHtcclxuICAgICAgICAgICAgdmFyIGNyZWF0b3IgPSBfZ2V0TWFya2VyQ3JlYXRvcihwbGFjZSksXHJcbiAgICAgICAgICAgICAgICBtYXJrZXIgPSBwbGFjZS5kcmFnZ2FibGUgPyBfZHJhZ2dhYmxlTWFya2VyTWl4aW4oY3JlYXRvci5jcmVhdGUoKSkgOiBjcmVhdG9yLmNyZWF0ZSgpO1xyXG4gICAgICAgICAgICAgICAgXHJcbiAgICAgICAgICAgIG1hcC5tYXJrZXJzR3JvdXAuYWRkT2JqZWN0KG1hcmtlcik7XHJcbiAgICAgICAgfSk7XHJcbiAgICAgICAgXHJcbiAgICAgICAgbWFwLmFkZE9iamVjdChtYXAubWFya2Vyc0dyb3VwKTtcclxuICAgIH1cclxuICAgIFxyXG4gICAgZnVuY3Rpb24gdXBkYXRlTWFya2VycyhtYXAsIHBsYWNlcyl7XHJcbiAgICAgICAgaWYobWFwLm1hcmtlcnNHcm91cCkge1xyXG4gICAgICAgICAgICBtYXAucmVtb3ZlT2JqZWN0KG1hcC5tYXJrZXJzR3JvdXApO1xyXG4gICAgICAgICAgICBtYXAubWFya2Vyc0dyb3VwID0gbnVsbDsgICAgXHJcbiAgICAgICAgfVxyXG4gICAgICAgIFxyXG4gICAgICAgIGFkZE1hcmtlcnNUb01hcC5hcHBseShudWxsLCBhcmd1bWVudHMpO1xyXG4gICAgfVxyXG5cclxuICAgIGZ1bmN0aW9uIGFkZFVzZXJNYXJrZXIobWFwLCBwbGFjZSkge1xyXG4gICAgICAgIHZhciBzdHlsZXMgPSBbXHJcbiAgICAgICAgICAgIFwiYm9yZGVyLXJhZGl1czogNTAlXCIsXHJcbiAgICAgICAgICAgIFwiYmFja2dyb3VuZC1jb2xvcjogcmdiYSgzOCwgMzMsIDk3LCAuOClcIixcclxuICAgICAgICAgICAgXCJoZWlnaHQ6IDEycHhcIixcclxuICAgICAgICAgICAgXCJ3aWR0aDogMTJweFwiXHJcbiAgICAgICAgXTtcclxuXHJcbiAgICAgICAgdmFyIG1hcmt1cCA9ICc8ZGl2IHN0eWxlPVwie3N0eWxlfVwiPjwvZGl2Pic7XHJcbiAgICAgICAgcGxhY2UubWFya3VwID0gbWFya3VwLnJlcGxhY2UoL3tzdHlsZX0vLCBzdHlsZXMuam9pbignOycpKTtcclxuXHJcbiAgICAgICAgdmFyIGNyZWF0b3IgPSBuZXcgRE9NTWFya2VyKHBsYWNlKTtcclxuXHJcbiAgICAgICAgbWFwLmFkZE9iamVjdChjcmVhdG9yLmNyZWF0ZSgpKTtcclxuICAgICAgICBcclxuICAgICAgICAvLyB2YXIgbWFya2VyID0gbmV3IEgubWFwLkNpcmNsZShwbGFjZS5wb3MsIDEwMDAwLCB7XHJcbiAgICAgICAgLy8gICAgICAgICBzdHlsZToge1xyXG4gICAgICAgIC8vICAgICAgICAgICAgIHN0cm9rZUNvbG9yOiAncmdiYSg1NSwgODUsIDE3MCwgMC42KScsIC8vIENvbG9yIG9mIHRoZSBwZXJpbWV0ZXJcclxuICAgICAgICAvLyAgICAgICAgICAgICBsaW5lV2lkdGg6IDIsXHJcbiAgICAgICAgLy8gICAgICAgICAgICAgZmlsbENvbG9yOiAncmdiYSgwLCAxMjgsIDAsIDAuNyknICAvLyBDb2xvciBvZiB0aGUgY2lyY2xlXHJcbiAgICAgICAgLy8gICAgICAgICB9XHJcbiAgICAgICAgLy8gICAgIH1cclxuICAgICAgICAvLyApO1xyXG4gICAgICAgIFxyXG4gICAgICAgIC8vIG1hcC5hZGRPYmplY3QobWFya2VyKTtcclxuICAgIH1cclxuXHJcbiAgICBmdW5jdGlvbiBfZ2V0TWFya2VyQ3JlYXRvcihwbGFjZSkge1xyXG4gICAgICAgIHZhciBDb25jcmV0ZU1hcmtlcixcclxuICAgICAgICAgICAgdHlwZSA9IHBsYWNlLnR5cGUgPyBwbGFjZS50eXBlLnRvVXBwZXJDYXNlKCkgOiBudWxsO1xyXG5cclxuICAgICAgICBzd2l0Y2ggKHR5cGUpIHtcclxuICAgICAgICAgICAgY2FzZSBNQVJLRVJfVFlQRVMuRE9NOlxyXG4gICAgICAgICAgICAgICAgQ29uY3JldGVNYXJrZXIgPSBET01NYXJrZXI7XHJcbiAgICAgICAgICAgICAgICBicmVhaztcclxuICAgICAgICAgICAgY2FzZSBNQVJLRVJfVFlQRVMuU1ZHOlxyXG4gICAgICAgICAgICAgICAgQ29uY3JldGVNYXJrZXIgPSBTVkdNYXJrZXI7XHJcbiAgICAgICAgICAgICAgICBicmVhaztcclxuICAgICAgICAgICAgZGVmYXVsdDpcclxuICAgICAgICAgICAgICAgIENvbmNyZXRlTWFya2VyID0gRGVmYXVsdE1hcmtlcjtcclxuICAgICAgICB9XHJcblxyXG4gICAgICAgIHJldHVybiBuZXcgQ29uY3JldGVNYXJrZXIocGxhY2UpO1xyXG4gICAgfVxyXG5cclxuICAgIGZ1bmN0aW9uIF9kcmFnZ2FibGVNYXJrZXJNaXhpbihtYXJrZXIpIHtcclxuICAgICAgICBtYXJrZXIuZHJhZ2dhYmxlID0gdHJ1ZTtcclxuXHJcbiAgICAgICAgcmV0dXJuIG1hcmtlcjtcclxuICAgIH1cclxuXHJcbn07IiwibW9kdWxlLmV4cG9ydHMgPSBmdW5jdGlvbihNYXJrZXJJbnRlcmZhY2Upe1xyXG4gICAgZnVuY3Rpb24gU1ZHTWFya2VyKHBsYWNlKXtcclxuICAgICAgICB0aGlzLnBsYWNlID0gcGxhY2U7XHJcbiAgICAgICAgdGhpcy5zZXRDb29yZHMoKTtcclxuICAgIH1cclxuICAgIFxyXG4gICAgdmFyIHByb3RvID0gU1ZHTWFya2VyLnByb3RvdHlwZSA9IG5ldyBNYXJrZXJJbnRlcmZhY2UoKTtcclxuICAgIHByb3RvLmNvbnN0cnVjdG9yID0gU1ZHTWFya2VyO1xyXG4gICAgXHJcbiAgICBwcm90by5jcmVhdGUgPSBjcmVhdGU7XHJcbiAgICBwcm90by5fZ2V0SWNvbiA9IF9nZXRJY29uO1xyXG4gICAgXHJcbiAgICByZXR1cm4gU1ZHTWFya2VyO1xyXG4gICAgXHJcbiAgICBmdW5jdGlvbiBjcmVhdGUoKXtcclxuICAgICAgICByZXR1cm4gbmV3IEgubWFwLk1hcmtlcih0aGlzLmNvb3Jkcywge1xyXG4gICAgICAgICAgICBpY29uOiB0aGlzLl9nZXRJY29uKCksXHJcbiAgICAgICAgfSk7XHJcbiAgICB9XHJcbiAgICBcclxuICAgIGZ1bmN0aW9uIF9nZXRJY29uKCl7XHJcbiAgICAgICAgdmFyIGljb24gPSB0aGlzLnBsYWNlLm1hcmt1cDtcclxuICAgICAgICAgaWYoIWljb24pXHJcbiAgICAgICAgICAgIHRocm93IG5ldyBFcnJvcignbWFya3VwIG1pc3NlZCcpO1xyXG5cclxuICAgICAgICByZXR1cm4gbmV3IEgubWFwLkljb24oaWNvbik7XHJcbiAgICB9XHJcbn0iLCJtb2R1bGUuZXhwb3J0cyA9IGZ1bmN0aW9uKCRyb290U2NvcGUsICR0aW1lb3V0KXtcclxuICAgIHJldHVybiB7XHJcbiAgICAgICAgdGhyb3R0bGU6IHRocm90dGxlLFxyXG4gICAgICAgIGNyZWF0ZVNjcmlwdFRhZzogY3JlYXRlU2NyaXB0VGFnLFxyXG4gICAgICAgIGNyZWF0ZUxpbmtUYWc6IGNyZWF0ZUxpbmtUYWcsXHJcbiAgICAgICAgcnVuU2NvcGVEaWdlc3RJZk5lZWQ6IHJ1blNjb3BlRGlnZXN0SWZOZWVkLFxyXG4gICAgICAgIGlzVmFsaWRDb29yZHM6IGlzVmFsaWRDb29yZHNcclxuICAgIH07XHJcbiAgICBcclxuICAgIC8vI3JlZ2lvbiBQVUJMSUNcclxuICAgIGZ1bmN0aW9uIHRocm90dGxlKGZuLCBwZXJpb2Qpe1xyXG4gICAgICAgIHZhciB0aW1lb3V0ID0gbnVsbDtcclxuICAgICAgICBcclxuICAgICAgICByZXR1cm4gZnVuY3Rpb24oKXtcclxuICAgICAgICAgICAgaWYoJHRpbWVvdXQpXHJcbiAgICAgICAgICAgICAgICAkdGltZW91dC5jYW5jZWwodGltZW91dCk7XHJcbiAgICAgICAgICAgICAgICBcclxuICAgICAgICAgICAgdGltZW91dCA9ICR0aW1lb3V0KGZuLCBwZXJpb2QpO1xyXG4gICAgICAgIH1cclxuICAgIH1cclxuICAgIFxyXG4gICAgZnVuY3Rpb24gcnVuU2NvcGVEaWdlc3RJZk5lZWQoc2NvcGUsIGNiKSB7XHJcbiAgICAgICAgaWYgKHNjb3BlLiRyb290ICYmIHNjb3BlLiRyb290LiQkcGhhc2UgIT09ICckYXBwbHknICYmIHNjb3BlLiRyb290LiQkcGhhc2UgIT09ICckZGlnZXN0Jykge1xyXG4gICAgICAgICAgICBzY29wZS4kZGlnZXN0KGNiIHx8IGFuZ3VsYXIubm9vcCk7XHJcbiAgICAgICAgICAgIHJldHVybiB0cnVlO1xyXG4gICAgICAgIH1cclxuICAgICAgICByZXR1cm4gZmFsc2U7XHJcbiAgICB9XHJcbiAgICBcclxuICAgIGZ1bmN0aW9uIGNyZWF0ZVNjcmlwdFRhZyhhdHRycyl7XHJcbiAgICAgICAgdmFyIHNjcmlwdCA9IGRvY3VtZW50LmdldEVsZW1lbnRCeUlkKGF0dHJzLnNyYyk7XHJcbiAgICAgICAgXHJcbiAgICAgICAgaWYoc2NyaXB0KVxyXG4gICAgICAgICAgICByZXR1cm4gZmFsc2U7XHJcbiAgICAgICAgXHJcbiAgICAgICAgc2NyaXB0ID0gZG9jdW1lbnQuY3JlYXRlRWxlbWVudCgnc2NyaXB0Jyk7XHJcbiAgICAgICAgc2NyaXB0LnR5cGUgPSAndGV4dC9qYXZhc2NyaXB0JztcclxuICAgICAgICBzY3JpcHQuaWQgPSBhdHRycy5zcmM7XHJcbiAgICAgICAgX3NldEF0dHJzKHNjcmlwdCwgYXR0cnMpOyAgICBcclxuXHJcbiAgICAgICAgcmV0dXJuIHNjcmlwdDtcclxuICAgIH1cclxuXHJcbiAgICBmdW5jdGlvbiBjcmVhdGVMaW5rVGFnKGF0dHJzKSB7XHJcbiAgICAgICAgdmFyIGxpbmsgPSBkb2N1bWVudC5nZXRFbGVtZW50QnlJZChhdHRycy5ocmVmKTtcclxuICAgICAgICBcclxuICAgICAgICBpZihsaW5rKVxyXG4gICAgICAgICAgICByZXR1cm4gZmFsc2U7XHJcbiAgICAgICAgICAgIFxyXG4gICAgICAgIGxpbmsgPSBkb2N1bWVudC5jcmVhdGVFbGVtZW50KCdsaW5rJyk7XHJcbiAgICAgICAgbGluay5pZCA9IGF0dHJzLmhyZWY7XHJcbiAgICAgICAgX3NldEF0dHJzKGxpbmssIGF0dHJzKTtcclxuICAgICAgICBcclxuICAgICAgICByZXR1cm4gbGluaztcclxuICAgIH1cclxuICAgIFxyXG4gICAgZnVuY3Rpb24gaXNWYWxpZENvb3Jkcyhjb29yZHMpe1xyXG4gICAgICAgIHJldHVybiBjb29yZHMgJiYgXHJcbiAgICAgICAgICAgICh0eXBlb2YgY29vcmRzLmxhdGl0dWRlID09PSAnc3RyaW5nJyB8fCAgdHlwZW9mIGNvb3Jkcy5sYXRpdHVkZSA9PT0gJ251bWJlcicpICYmXHJcbiAgICAgICAgICAgICh0eXBlb2YgY29vcmRzLmxvbmdpdHVkZSA9PT0gJ3N0cmluZycgfHwgIHR5cGVvZiBjb29yZHMubG9uZ2l0dWRlID09PSAnbnVtYmVyJylcclxuICAgIH1cclxuICAgIC8vI2VuZHJlZ2lvbiBQVUJMSUMgXHJcblxyXG4gICAgLy8jcmVnaW9uIFBSSVZBVEVcclxuICAgIGZ1bmN0aW9uIF9zZXRBdHRycyhlbCwgYXR0cnMpIHtcclxuICAgICAgICBpZighZWwgfHwgIWF0dHJzKVxyXG4gICAgICAgICAgICB0aHJvdyBuZXcgRXJyb3IoJ01pc3NlZCBhdHRyaWJ1dGVzJyk7XHJcblxyXG4gICAgICAgIGZvcih2YXIga2V5IGluIGF0dHJzKSB7XHJcbiAgICAgICAgICAgIGlmKCFhdHRycy5oYXNPd25Qcm9wZXJ0eShrZXkpKVxyXG4gICAgICAgICAgICAgICAgY29udGludWU7XHJcblxyXG4gICAgICAgICAgICBlbFtrZXldID0gYXR0cnNba2V5XTtcclxuICAgICAgICB9XHJcbiAgICB9XHJcbn07Il19
