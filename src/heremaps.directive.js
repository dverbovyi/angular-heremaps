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
    RoutesService,
    CONSTS,
    EventsModule,
    UIModule) {
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
        controller: function($scope, $element, $attrs) {
            var CONTROL_NAMES = CONSTS.CONTROLS.NAMES,
                places = $scope.places(),
                opts = $scope.opts(),
                listeners = $scope.events();

            var options = angular.extend({}, CONSTS.DEFAULT_MAP_OPTIONS, opts),
                position = HereMapUtilsService.isValidCoords(options.coords) ? options.coords : CONSTS.DEFAULT_MAP_OPTIONS.coords;

            var heremaps = {},
                mapReady = $scope.onMapReady(),
                _onResizeMap = null;
                
            $timeout(function() {
                return _setMapSize();
            }).then(function() {
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
                _initMap(function() {
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

            function _uiModuleReady(){
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
                return function(id) {
                    return heremaps[id];
                }
            }

            function _resizeHandler() {
                _setMapSize();

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
                    getPlatform: function() {
                        return heremaps;
                    },
                    
                    /**
                     * @param {String} driveType - car | pedestrian | publicTransport | truck
                     * @param {Object} params - e.g: 
                     *  {
                     *      from: {lat: 41.9798, lng: -87.8801}, 
                     *      to: {lat: 41.9043, lng: -87.9216},
                     *      attributes: {
                     *          leg: see https://developer.here.com/rest-apis/documentation/routing/topics/resource-param-type-route-representation-options.html#type-route-leg-attribute,
                     *          route: see https://developer.here.com/rest-apis/documentation/routing/topics/resource-param-type-route-representation-options.html#type-route-attribute,
                     *          maneuver: see https://developer.here.com/rest-apis/documentation/routing/topics/resource-param-type-route-representation-options.html#type-maneuver-attribute,
                     *          link: see https://developer.here.com/rest-apis/documentation/routing/topics/resource-param-type-route-representation-options.html#type-route-link-attribute,
                     *          lines: see https://developer.here.com/rest-apis/documentation/routing/topics/resource-param-type-route-representation-options.html#type-public-transport-line-attribute
                     *      }
                     * }
                     */
                    calculateRoute: function(driveType, direction) {
                        return RoutesService.calculateRoute(heremaps.platform, heremaps.map, {
                            driveType: driveType,
                            direction: direction
                        });
                    },
                    setZoom: function(zoom, step) {
                        HereMapUtilsService.zoom(heremaps.map, zoom || 10, step);
                    },
                    setCenter: function(coords) {
                        if (!coords) {
                            return console.error('coords are not specified!');
                        }
                        
                        heremaps.map.setCenter(coords);
                    },
                    
                    /**
                     * @param {Boolean} enableHighAccuracy
                     * @param {Number} maximumAge - the maximum age in milliseconds of a possible cached position that is acceptable to return. If set to 0, it means that the device cannot use a cached position and must attempt to retrieve the real current position
                     */
                    getUserLocation: function(enableHighAccuracy, maximumAge){
                       return _getLocation.apply(null, arguments);
                    },
                    
                    geocodePosition: function(coords, options){
                        return APIService.geocodePosition(heremaps.platform, {
                            coords: coords,
                            radius: options && options.radius,
                            lang: options && options.lang
                        });
                    },
                    
                    updateMarkers: function(places) {
                        MarkersService.updateMarkers(heremaps.map, places);
                    }
                }
            }

        }
    }
};
