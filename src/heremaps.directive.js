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