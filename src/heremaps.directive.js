/**
 * Created by Dmytro on 4/11/2016.
 */
module.exports = function(
    $rootScope,
    $window,
    $timeout,
    Config,
    APIService,
    UtilsService,
    CONSTS) {
    return {
        restrict: 'EA',
        template: "<div ng-style=\"{'width': width, 'height': height}\"></div>",
        replace: true,
        controller: function($scope, $element, $attrs) {
            $scope.options = {
                controls: !!$attrs.$attr.controls
            };

            APIService.loadApiCore().then(_apiReady);

            _setMapSize();

            $window.addEventListener('resize', UtilsService.throttle(_resizeHandler, CONSTS.UPDATE_MAP_RESIZE_TIMEOUT));

            function _apiReady() {
                if ($element.html())
                    $element.empty();

                $scope.platform = new H.service.Platform({
                    'app_id': Config.app_id,
                    'app_code': Config.app_code
                });

                $scope.layers = $scope.platform.createDefaultLayers();

                $scope.map = new H.Map(
                    $element[0],
                    $scope.layers.normal.transit,
                    {
                        zoom: 10,
                        center: { lat: 52.5, lng: 13.4 }
                    });

                if($scope.options.controls)
                    APIService.loadUIComponent().then(function(){
                        _uiComponentReady();
                    });
            }
            
            function _uiComponentReady(){
                $scope.uiComponent = H.ui.UI.createDefault($scope.map, $scope.layers);
            }

            function _resizeHandler() {
                _setMapSize();
                $scope.map.getViewPort().resize();
            }

            function _setMapSize() {
                var height = $window.innerHeight || CONSTS.DEFAULT_MAP_SIZE.HEIGHT,
                    width = $window.innerWidth || CONSTS.DEFAULT_MAP_SIZE.WIDTH;

                $scope.height = height + 'px';
                $scope.width = width + 'px';
                
                UtilsService.runScopeDigestIfNeed($scope);
            }

        },
        link: function(scope) { }
    }
};