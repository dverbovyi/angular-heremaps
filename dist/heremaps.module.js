(function e(t,n,r){function s(o,u){if(!n[o]){if(!t[o]){var a=typeof require=="function"&&require;if(!u&&a)return a(o,!0);if(i)return i(o,!0);var f=new Error("Cannot find module '"+o+"'");throw f.code="MODULE_NOT_FOUND",f}var l=n[o]={exports:{}};t[o][0].call(l.exports,function(e){var n=t[o][1][e];return s(n?n:e)},l,l.exports,e,t,n,r)}return n[o].exports}var i=typeof require=="function"&&require;for(var o=0;o<r.length;o++)s(r[o]);return s})({1:[function(require,module,exports){
'use strict';

module.exports = function($q, UtilsService){
    var API_VERSION = {
        V: "3",
        SUB: "3.0"
    };
    
    var CONFIG = {
        BASE: "http://js.api.here.com/v",
        CORE: "mapsjs-core.js",
        SERVICE: "mapsjs-service.js",
        UI: {
            src: "mapsjs-ui.js",
            href: "mapsjs-ui.css"
        }
    };
    
    var head = document.getElementsByTagName('head')[0];
    
    return {
        loadApiCore: loadApiCore,
        loadUIComponent: loadUIComponent
    };
    
    //#region PUBLIC 
    function loadApiCore(){
        return _getLoader(CONFIG.CORE)
                .then(function(){
                    return _getLoader(CONFIG.SERVICE);
                });
    }
    
    function loadUIComponent(){
        return _getLoader(CONFIG.UI.src).then(function(){
            var href = _getURL(CONFIG.UI.href),
                link = UtilsService.createLinkTag({
                    rel: 'stylesheet',
                    type: 'text/css',
                    href: href,
                    id: CONFIG.UI.href
                });

            if(link)
                head.appendChild(link);
        });
    }
    //#endregion PUBLIC


    //#region PRIVATE
    function _getURL(sourceName){
        return [
                CONFIG.BASE,
                API_VERSION.V,
                "/",
                API_VERSION.SUB,
                "/",
                sourceName
            ].join("");
    }
    
    function _getLoader(sourceName){
        var src = _getURL(sourceName),
            coreScript = UtilsService.createScriptTag({
                src: src,
                id: sourceName
            });

        return $q(function(resolve, reject){
            if(!coreScript) {
                resolve();
                return true;
            }
            head.appendChild(coreScript);

            coreScript.onload = resolve;
            coreScript.onerror = reject;
        });
    }
};
},{}],2:[function(require,module,exports){
module.exports = function() {
    var options = {};

    this.$get = function(){
        return {
            app_id: options.app_id,
            app_code: options.app_code
        }
    };

    this.setOptions = function(opts){
        options = opts;
    };
};
},{}],3:[function(require,module,exports){
module.exports = {
    "UPDATE_MAP_RESIZE_TIMEOUT": 500,
    "DEFAULT_MAP_SIZE": {
        HEIGHT: 480,
        WIDTH: 640
    }
}
},{}],4:[function(require,module,exports){
module.exports = function($rootScope, $timeout){
    return {
        throttle: throttle,
        createScriptTag: createScriptTag,
        createLinkTag: createLinkTag,
        runScopeDigestIfNeed: runScopeDigestIfNeed
    };
    
    
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
        if(attrs.id && document.getElementById(attrs.id))
            return false;

        var script = document.createElement('script');
        script.type = 'text/javascript';

        _setAttrs(script, attrs);

        return script;
    }

    function createLinkTag(attrs) {
        if(attrs.id && document.getElementById(attrs.id))
            return false;

        var link = document.createElement('link');

        _setAttrs(link, attrs);

        return link;
    }

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
},{}],5:[function(require,module,exports){
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
},{}],6:[function(require,module,exports){
(function () {
    'use strict';

    var directive = require('./heremaps.directive'),
        configProvider = require('./common/config.provider'),
        apiService = require('./common/api.service'),
        utilsService = require('./common/utils.service'),
        consts = require('./common/consts');

    angular.module('heremaps', [])
        .provider('Config', configProvider)
        .service('APIService', apiService)
        .service('UtilsService', utilsService)
        .constant('CONSTS', consts)
        .config(["ConfigProvider", function (ConfigProvider) {
            ConfigProvider.setOptions({
                'app_id': 'wMHJuLgCQzkfbhzXIwRF',
                'app_code': 'WLIc7QzoO8irv7lurUt1qA'
            });
        }])
        .directive('hereMaps', directive);
})();
},{"./common/api.service":1,"./common/config.provider":2,"./common/consts":3,"./common/utils.service":4,"./heremaps.directive":5}]},{},[6])


//# sourceMappingURL=data:application/json;base64,eyJ2ZXJzaW9uIjozLCJzb3VyY2VzIjpbIm5vZGVfbW9kdWxlcy9icm93c2VyLXBhY2svX3ByZWx1ZGUuanMiLCJzcmMvY29tbW9uL2FwaS5zZXJ2aWNlLmpzIiwic3JjL2NvbW1vbi9jb25maWcucHJvdmlkZXIuanMiLCJzcmMvY29tbW9uL2NvbnN0cy5qcyIsInNyYy9jb21tb24vdXRpbHMuc2VydmljZS5qcyIsInNyYy9oZXJlbWFwcy5kaXJlY3RpdmUuanMiLCJzcmMvaGVyZW1hcHMubW9kdWxlLmpzIl0sIm5hbWVzIjpbXSwibWFwcGluZ3MiOiJBQUFBO0FDQUE7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBOztBQ2hGQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBOztBQ2JBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBOztBQ05BO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTs7QUM5REE7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTs7QUN6RUE7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0EiLCJmaWxlIjoiaGVyZW1hcHMubW9kdWxlLmpzIiwic291cmNlUm9vdCI6Ii9zb3VyY2UvIiwic291cmNlc0NvbnRlbnQiOlsiKGZ1bmN0aW9uIGUodCxuLHIpe2Z1bmN0aW9uIHMobyx1KXtpZighbltvXSl7aWYoIXRbb10pe3ZhciBhPXR5cGVvZiByZXF1aXJlPT1cImZ1bmN0aW9uXCImJnJlcXVpcmU7aWYoIXUmJmEpcmV0dXJuIGEobywhMCk7aWYoaSlyZXR1cm4gaShvLCEwKTt2YXIgZj1uZXcgRXJyb3IoXCJDYW5ub3QgZmluZCBtb2R1bGUgJ1wiK28rXCInXCIpO3Rocm93IGYuY29kZT1cIk1PRFVMRV9OT1RfRk9VTkRcIixmfXZhciBsPW5bb109e2V4cG9ydHM6e319O3Rbb11bMF0uY2FsbChsLmV4cG9ydHMsZnVuY3Rpb24oZSl7dmFyIG49dFtvXVsxXVtlXTtyZXR1cm4gcyhuP246ZSl9LGwsbC5leHBvcnRzLGUsdCxuLHIpfXJldHVybiBuW29dLmV4cG9ydHN9dmFyIGk9dHlwZW9mIHJlcXVpcmU9PVwiZnVuY3Rpb25cIiYmcmVxdWlyZTtmb3IodmFyIG89MDtvPHIubGVuZ3RoO28rKylzKHJbb10pO3JldHVybiBzfSkiLCIndXNlIHN0cmljdCc7XHJcblxyXG5tb2R1bGUuZXhwb3J0cyA9IGZ1bmN0aW9uKCRxLCBVdGlsc1NlcnZpY2Upe1xyXG4gICAgdmFyIEFQSV9WRVJTSU9OID0ge1xyXG4gICAgICAgIFY6IFwiM1wiLFxyXG4gICAgICAgIFNVQjogXCIzLjBcIlxyXG4gICAgfTtcclxuICAgIFxyXG4gICAgdmFyIENPTkZJRyA9IHtcclxuICAgICAgICBCQVNFOiBcImh0dHA6Ly9qcy5hcGkuaGVyZS5jb20vdlwiLFxyXG4gICAgICAgIENPUkU6IFwibWFwc2pzLWNvcmUuanNcIixcclxuICAgICAgICBTRVJWSUNFOiBcIm1hcHNqcy1zZXJ2aWNlLmpzXCIsXHJcbiAgICAgICAgVUk6IHtcclxuICAgICAgICAgICAgc3JjOiBcIm1hcHNqcy11aS5qc1wiLFxyXG4gICAgICAgICAgICBocmVmOiBcIm1hcHNqcy11aS5jc3NcIlxyXG4gICAgICAgIH1cclxuICAgIH07XHJcbiAgICBcclxuICAgIHZhciBoZWFkID0gZG9jdW1lbnQuZ2V0RWxlbWVudHNCeVRhZ05hbWUoJ2hlYWQnKVswXTtcclxuICAgIFxyXG4gICAgcmV0dXJuIHtcclxuICAgICAgICBsb2FkQXBpQ29yZTogbG9hZEFwaUNvcmUsXHJcbiAgICAgICAgbG9hZFVJQ29tcG9uZW50OiBsb2FkVUlDb21wb25lbnRcclxuICAgIH07XHJcbiAgICBcclxuICAgIC8vI3JlZ2lvbiBQVUJMSUMgXHJcbiAgICBmdW5jdGlvbiBsb2FkQXBpQ29yZSgpe1xyXG4gICAgICAgIHJldHVybiBfZ2V0TG9hZGVyKENPTkZJRy5DT1JFKVxyXG4gICAgICAgICAgICAgICAgLnRoZW4oZnVuY3Rpb24oKXtcclxuICAgICAgICAgICAgICAgICAgICByZXR1cm4gX2dldExvYWRlcihDT05GSUcuU0VSVklDRSk7XHJcbiAgICAgICAgICAgICAgICB9KTtcclxuICAgIH1cclxuICAgIFxyXG4gICAgZnVuY3Rpb24gbG9hZFVJQ29tcG9uZW50KCl7XHJcbiAgICAgICAgcmV0dXJuIF9nZXRMb2FkZXIoQ09ORklHLlVJLnNyYykudGhlbihmdW5jdGlvbigpe1xyXG4gICAgICAgICAgICB2YXIgaHJlZiA9IF9nZXRVUkwoQ09ORklHLlVJLmhyZWYpLFxyXG4gICAgICAgICAgICAgICAgbGluayA9IFV0aWxzU2VydmljZS5jcmVhdGVMaW5rVGFnKHtcclxuICAgICAgICAgICAgICAgICAgICByZWw6ICdzdHlsZXNoZWV0JyxcclxuICAgICAgICAgICAgICAgICAgICB0eXBlOiAndGV4dC9jc3MnLFxyXG4gICAgICAgICAgICAgICAgICAgIGhyZWY6IGhyZWYsXHJcbiAgICAgICAgICAgICAgICAgICAgaWQ6IENPTkZJRy5VSS5ocmVmXHJcbiAgICAgICAgICAgICAgICB9KTtcclxuXHJcbiAgICAgICAgICAgIGlmKGxpbmspXHJcbiAgICAgICAgICAgICAgICBoZWFkLmFwcGVuZENoaWxkKGxpbmspO1xyXG4gICAgICAgIH0pO1xyXG4gICAgfVxyXG4gICAgLy8jZW5kcmVnaW9uIFBVQkxJQ1xyXG5cclxuXHJcbiAgICAvLyNyZWdpb24gUFJJVkFURVxyXG4gICAgZnVuY3Rpb24gX2dldFVSTChzb3VyY2VOYW1lKXtcclxuICAgICAgICByZXR1cm4gW1xyXG4gICAgICAgICAgICAgICAgQ09ORklHLkJBU0UsXHJcbiAgICAgICAgICAgICAgICBBUElfVkVSU0lPTi5WLFxyXG4gICAgICAgICAgICAgICAgXCIvXCIsXHJcbiAgICAgICAgICAgICAgICBBUElfVkVSU0lPTi5TVUIsXHJcbiAgICAgICAgICAgICAgICBcIi9cIixcclxuICAgICAgICAgICAgICAgIHNvdXJjZU5hbWVcclxuICAgICAgICAgICAgXS5qb2luKFwiXCIpO1xyXG4gICAgfVxyXG4gICAgXHJcbiAgICBmdW5jdGlvbiBfZ2V0TG9hZGVyKHNvdXJjZU5hbWUpe1xyXG4gICAgICAgIHZhciBzcmMgPSBfZ2V0VVJMKHNvdXJjZU5hbWUpLFxyXG4gICAgICAgICAgICBjb3JlU2NyaXB0ID0gVXRpbHNTZXJ2aWNlLmNyZWF0ZVNjcmlwdFRhZyh7XHJcbiAgICAgICAgICAgICAgICBzcmM6IHNyYyxcclxuICAgICAgICAgICAgICAgIGlkOiBzb3VyY2VOYW1lXHJcbiAgICAgICAgICAgIH0pO1xyXG5cclxuICAgICAgICByZXR1cm4gJHEoZnVuY3Rpb24ocmVzb2x2ZSwgcmVqZWN0KXtcclxuICAgICAgICAgICAgaWYoIWNvcmVTY3JpcHQpIHtcclxuICAgICAgICAgICAgICAgIHJlc29sdmUoKTtcclxuICAgICAgICAgICAgICAgIHJldHVybiB0cnVlO1xyXG4gICAgICAgICAgICB9XHJcbiAgICAgICAgICAgIGhlYWQuYXBwZW5kQ2hpbGQoY29yZVNjcmlwdCk7XHJcblxyXG4gICAgICAgICAgICBjb3JlU2NyaXB0Lm9ubG9hZCA9IHJlc29sdmU7XHJcbiAgICAgICAgICAgIGNvcmVTY3JpcHQub25lcnJvciA9IHJlamVjdDtcclxuICAgICAgICB9KTtcclxuICAgIH1cclxufTsiLCJtb2R1bGUuZXhwb3J0cyA9IGZ1bmN0aW9uKCkge1xyXG4gICAgdmFyIG9wdGlvbnMgPSB7fTtcclxuXHJcbiAgICB0aGlzLiRnZXQgPSBmdW5jdGlvbigpe1xyXG4gICAgICAgIHJldHVybiB7XHJcbiAgICAgICAgICAgIGFwcF9pZDogb3B0aW9ucy5hcHBfaWQsXHJcbiAgICAgICAgICAgIGFwcF9jb2RlOiBvcHRpb25zLmFwcF9jb2RlXHJcbiAgICAgICAgfVxyXG4gICAgfTtcclxuXHJcbiAgICB0aGlzLnNldE9wdGlvbnMgPSBmdW5jdGlvbihvcHRzKXtcclxuICAgICAgICBvcHRpb25zID0gb3B0cztcclxuICAgIH07XHJcbn07IiwibW9kdWxlLmV4cG9ydHMgPSB7XHJcbiAgICBcIlVQREFURV9NQVBfUkVTSVpFX1RJTUVPVVRcIjogNTAwLFxyXG4gICAgXCJERUZBVUxUX01BUF9TSVpFXCI6IHtcclxuICAgICAgICBIRUlHSFQ6IDQ4MCxcclxuICAgICAgICBXSURUSDogNjQwXHJcbiAgICB9XHJcbn0iLCJtb2R1bGUuZXhwb3J0cyA9IGZ1bmN0aW9uKCRyb290U2NvcGUsICR0aW1lb3V0KXtcclxuICAgIHJldHVybiB7XHJcbiAgICAgICAgdGhyb3R0bGU6IHRocm90dGxlLFxyXG4gICAgICAgIGNyZWF0ZVNjcmlwdFRhZzogY3JlYXRlU2NyaXB0VGFnLFxyXG4gICAgICAgIGNyZWF0ZUxpbmtUYWc6IGNyZWF0ZUxpbmtUYWcsXHJcbiAgICAgICAgcnVuU2NvcGVEaWdlc3RJZk5lZWQ6IHJ1blNjb3BlRGlnZXN0SWZOZWVkXHJcbiAgICB9O1xyXG4gICAgXHJcbiAgICBcclxuICAgIGZ1bmN0aW9uIHRocm90dGxlKGZuLCBwZXJpb2Qpe1xyXG4gICAgICAgIHZhciB0aW1lb3V0ID0gbnVsbDtcclxuICAgICAgICBcclxuICAgICAgICByZXR1cm4gZnVuY3Rpb24oKXtcclxuICAgICAgICAgICAgaWYoJHRpbWVvdXQpXHJcbiAgICAgICAgICAgICAgICAkdGltZW91dC5jYW5jZWwodGltZW91dCk7XHJcbiAgICAgICAgICAgICAgICBcclxuICAgICAgICAgICAgdGltZW91dCA9ICR0aW1lb3V0KGZuLCBwZXJpb2QpO1xyXG4gICAgICAgIH1cclxuICAgIH1cclxuICAgIFxyXG4gICAgZnVuY3Rpb24gcnVuU2NvcGVEaWdlc3RJZk5lZWQoc2NvcGUsIGNiKSB7XHJcbiAgICAgICAgaWYgKHNjb3BlLiRyb290ICYmIHNjb3BlLiRyb290LiQkcGhhc2UgIT09ICckYXBwbHknICYmIHNjb3BlLiRyb290LiQkcGhhc2UgIT09ICckZGlnZXN0Jykge1xyXG4gICAgICAgICAgICBzY29wZS4kZGlnZXN0KGNiIHx8IGFuZ3VsYXIubm9vcCk7XHJcbiAgICAgICAgICAgIHJldHVybiB0cnVlO1xyXG4gICAgICAgIH1cclxuICAgICAgICByZXR1cm4gZmFsc2U7XHJcbiAgICB9XHJcbiAgICBcclxuICAgIGZ1bmN0aW9uIGNyZWF0ZVNjcmlwdFRhZyhhdHRycyl7XHJcbiAgICAgICAgaWYoYXR0cnMuaWQgJiYgZG9jdW1lbnQuZ2V0RWxlbWVudEJ5SWQoYXR0cnMuaWQpKVxyXG4gICAgICAgICAgICByZXR1cm4gZmFsc2U7XHJcblxyXG4gICAgICAgIHZhciBzY3JpcHQgPSBkb2N1bWVudC5jcmVhdGVFbGVtZW50KCdzY3JpcHQnKTtcclxuICAgICAgICBzY3JpcHQudHlwZSA9ICd0ZXh0L2phdmFzY3JpcHQnO1xyXG5cclxuICAgICAgICBfc2V0QXR0cnMoc2NyaXB0LCBhdHRycyk7XHJcblxyXG4gICAgICAgIHJldHVybiBzY3JpcHQ7XHJcbiAgICB9XHJcblxyXG4gICAgZnVuY3Rpb24gY3JlYXRlTGlua1RhZyhhdHRycykge1xyXG4gICAgICAgIGlmKGF0dHJzLmlkICYmIGRvY3VtZW50LmdldEVsZW1lbnRCeUlkKGF0dHJzLmlkKSlcclxuICAgICAgICAgICAgcmV0dXJuIGZhbHNlO1xyXG5cclxuICAgICAgICB2YXIgbGluayA9IGRvY3VtZW50LmNyZWF0ZUVsZW1lbnQoJ2xpbmsnKTtcclxuXHJcbiAgICAgICAgX3NldEF0dHJzKGxpbmssIGF0dHJzKTtcclxuXHJcbiAgICAgICAgcmV0dXJuIGxpbms7XHJcbiAgICB9XHJcblxyXG4gICAgZnVuY3Rpb24gX3NldEF0dHJzKGVsLCBhdHRycykge1xyXG4gICAgICAgIGlmKCFlbCB8fCAhYXR0cnMpXHJcbiAgICAgICAgICAgIHRocm93IG5ldyBFcnJvcignTWlzc2VkIGF0dHJpYnV0ZXMnKTtcclxuXHJcbiAgICAgICAgZm9yKHZhciBrZXkgaW4gYXR0cnMpIHtcclxuICAgICAgICAgICAgaWYoIWF0dHJzLmhhc093blByb3BlcnR5KGtleSkpXHJcbiAgICAgICAgICAgICAgICBjb250aW51ZTtcclxuXHJcbiAgICAgICAgICAgIGVsW2tleV0gPSBhdHRyc1trZXldO1xyXG4gICAgICAgIH1cclxuICAgIH1cclxufTsiLCIvKipcclxuICogQ3JlYXRlZCBieSBEbXl0cm8gb24gNC8xMS8yMDE2LlxyXG4gKi9cclxubW9kdWxlLmV4cG9ydHMgPSBmdW5jdGlvbihcclxuICAgICRyb290U2NvcGUsXHJcbiAgICAkd2luZG93LFxyXG4gICAgJHRpbWVvdXQsXHJcbiAgICBDb25maWcsXHJcbiAgICBBUElTZXJ2aWNlLFxyXG4gICAgVXRpbHNTZXJ2aWNlLFxyXG4gICAgQ09OU1RTKSB7XHJcbiAgICByZXR1cm4ge1xyXG4gICAgICAgIHJlc3RyaWN0OiAnRUEnLFxyXG4gICAgICAgIHRlbXBsYXRlOiBcIjxkaXYgbmctc3R5bGU9XFxcInsnd2lkdGgnOiB3aWR0aCwgJ2hlaWdodCc6IGhlaWdodH1cXFwiPjwvZGl2PlwiLFxyXG4gICAgICAgIHJlcGxhY2U6IHRydWUsXHJcbiAgICAgICAgY29udHJvbGxlcjogZnVuY3Rpb24oJHNjb3BlLCAkZWxlbWVudCwgJGF0dHJzKSB7XHJcbiAgICAgICAgICAgICRzY29wZS5vcHRpb25zID0ge1xyXG4gICAgICAgICAgICAgICAgY29udHJvbHM6ICEhJGF0dHJzLiRhdHRyLmNvbnRyb2xzXHJcbiAgICAgICAgICAgIH07XHJcblxyXG4gICAgICAgICAgICBBUElTZXJ2aWNlLmxvYWRBcGlDb3JlKCkudGhlbihfYXBpUmVhZHkpO1xyXG5cclxuICAgICAgICAgICAgX3NldE1hcFNpemUoKTtcclxuXHJcbiAgICAgICAgICAgICR3aW5kb3cuYWRkRXZlbnRMaXN0ZW5lcigncmVzaXplJywgVXRpbHNTZXJ2aWNlLnRocm90dGxlKF9yZXNpemVIYW5kbGVyLCBDT05TVFMuVVBEQVRFX01BUF9SRVNJWkVfVElNRU9VVCkpO1xyXG5cclxuICAgICAgICAgICAgZnVuY3Rpb24gX2FwaVJlYWR5KCkge1xyXG4gICAgICAgICAgICAgICAgaWYgKCRlbGVtZW50Lmh0bWwoKSlcclxuICAgICAgICAgICAgICAgICAgICAkZWxlbWVudC5lbXB0eSgpO1xyXG5cclxuICAgICAgICAgICAgICAgICRzY29wZS5wbGF0Zm9ybSA9IG5ldyBILnNlcnZpY2UuUGxhdGZvcm0oe1xyXG4gICAgICAgICAgICAgICAgICAgICdhcHBfaWQnOiBDb25maWcuYXBwX2lkLFxyXG4gICAgICAgICAgICAgICAgICAgICdhcHBfY29kZSc6IENvbmZpZy5hcHBfY29kZVxyXG4gICAgICAgICAgICAgICAgfSk7XHJcblxyXG4gICAgICAgICAgICAgICAgJHNjb3BlLmxheWVycyA9ICRzY29wZS5wbGF0Zm9ybS5jcmVhdGVEZWZhdWx0TGF5ZXJzKCk7XHJcblxyXG4gICAgICAgICAgICAgICAgJHNjb3BlLm1hcCA9IG5ldyBILk1hcChcclxuICAgICAgICAgICAgICAgICAgICAkZWxlbWVudFswXSxcclxuICAgICAgICAgICAgICAgICAgICAkc2NvcGUubGF5ZXJzLm5vcm1hbC50cmFuc2l0LFxyXG4gICAgICAgICAgICAgICAgICAgIHtcclxuICAgICAgICAgICAgICAgICAgICAgICAgem9vbTogMTAsXHJcbiAgICAgICAgICAgICAgICAgICAgICAgIGNlbnRlcjogeyBsYXQ6IDUyLjUsIGxuZzogMTMuNCB9XHJcbiAgICAgICAgICAgICAgICAgICAgfSk7XHJcblxyXG4gICAgICAgICAgICAgICAgaWYoJHNjb3BlLm9wdGlvbnMuY29udHJvbHMpXHJcbiAgICAgICAgICAgICAgICAgICAgQVBJU2VydmljZS5sb2FkVUlDb21wb25lbnQoKS50aGVuKGZ1bmN0aW9uKCl7XHJcbiAgICAgICAgICAgICAgICAgICAgICAgIF91aUNvbXBvbmVudFJlYWR5KCk7XHJcbiAgICAgICAgICAgICAgICAgICAgfSk7XHJcbiAgICAgICAgICAgIH1cclxuICAgICAgICAgICAgXHJcbiAgICAgICAgICAgIGZ1bmN0aW9uIF91aUNvbXBvbmVudFJlYWR5KCl7XHJcbiAgICAgICAgICAgICAgICAkc2NvcGUudWlDb21wb25lbnQgPSBILnVpLlVJLmNyZWF0ZURlZmF1bHQoJHNjb3BlLm1hcCwgJHNjb3BlLmxheWVycyk7XHJcbiAgICAgICAgICAgIH1cclxuXHJcbiAgICAgICAgICAgIGZ1bmN0aW9uIF9yZXNpemVIYW5kbGVyKCkge1xyXG4gICAgICAgICAgICAgICAgX3NldE1hcFNpemUoKTtcclxuICAgICAgICAgICAgICAgICRzY29wZS5tYXAuZ2V0Vmlld1BvcnQoKS5yZXNpemUoKTtcclxuICAgICAgICAgICAgfVxyXG5cclxuICAgICAgICAgICAgZnVuY3Rpb24gX3NldE1hcFNpemUoKSB7XHJcbiAgICAgICAgICAgICAgICB2YXIgaGVpZ2h0ID0gJHdpbmRvdy5pbm5lckhlaWdodCB8fCBDT05TVFMuREVGQVVMVF9NQVBfU0laRS5IRUlHSFQsXHJcbiAgICAgICAgICAgICAgICAgICAgd2lkdGggPSAkd2luZG93LmlubmVyV2lkdGggfHwgQ09OU1RTLkRFRkFVTFRfTUFQX1NJWkUuV0lEVEg7XHJcblxyXG4gICAgICAgICAgICAgICAgJHNjb3BlLmhlaWdodCA9IGhlaWdodCArICdweCc7XHJcbiAgICAgICAgICAgICAgICAkc2NvcGUud2lkdGggPSB3aWR0aCArICdweCc7XHJcbiAgICAgICAgICAgICAgICBcclxuICAgICAgICAgICAgICAgIFV0aWxzU2VydmljZS5ydW5TY29wZURpZ2VzdElmTmVlZCgkc2NvcGUpO1xyXG4gICAgICAgICAgICB9XHJcblxyXG4gICAgICAgIH0sXHJcbiAgICAgICAgbGluazogZnVuY3Rpb24oc2NvcGUpIHsgfVxyXG4gICAgfVxyXG59OyIsIihmdW5jdGlvbiAoKSB7XHJcbiAgICAndXNlIHN0cmljdCc7XHJcblxyXG4gICAgdmFyIGRpcmVjdGl2ZSA9IHJlcXVpcmUoJy4vaGVyZW1hcHMuZGlyZWN0aXZlJyksXHJcbiAgICAgICAgY29uZmlnUHJvdmlkZXIgPSByZXF1aXJlKCcuL2NvbW1vbi9jb25maWcucHJvdmlkZXInKSxcclxuICAgICAgICBhcGlTZXJ2aWNlID0gcmVxdWlyZSgnLi9jb21tb24vYXBpLnNlcnZpY2UnKSxcclxuICAgICAgICB1dGlsc1NlcnZpY2UgPSByZXF1aXJlKCcuL2NvbW1vbi91dGlscy5zZXJ2aWNlJyksXHJcbiAgICAgICAgY29uc3RzID0gcmVxdWlyZSgnLi9jb21tb24vY29uc3RzJyk7XHJcblxyXG4gICAgYW5ndWxhci5tb2R1bGUoJ2hlcmVtYXBzJywgW10pXHJcbiAgICAgICAgLnByb3ZpZGVyKCdDb25maWcnLCBjb25maWdQcm92aWRlcilcclxuICAgICAgICAuc2VydmljZSgnQVBJU2VydmljZScsIGFwaVNlcnZpY2UpXHJcbiAgICAgICAgLnNlcnZpY2UoJ1V0aWxzU2VydmljZScsIHV0aWxzU2VydmljZSlcclxuICAgICAgICAuY29uc3RhbnQoJ0NPTlNUUycsIGNvbnN0cylcclxuICAgICAgICAuY29uZmlnKFtcIkNvbmZpZ1Byb3ZpZGVyXCIsIGZ1bmN0aW9uIChDb25maWdQcm92aWRlcikge1xyXG4gICAgICAgICAgICBDb25maWdQcm92aWRlci5zZXRPcHRpb25zKHtcclxuICAgICAgICAgICAgICAgICdhcHBfaWQnOiAnd01ISnVMZ0NRemtmYmh6WEl3UkYnLFxyXG4gICAgICAgICAgICAgICAgJ2FwcF9jb2RlJzogJ1dMSWM3UXpvTzhpcnY3bHVyVXQxcUEnXHJcbiAgICAgICAgICAgIH0pO1xyXG4gICAgICAgIH1dKVxyXG4gICAgICAgIC5kaXJlY3RpdmUoJ2hlcmVNYXBzJywgZGlyZWN0aXZlKTtcclxufSkoKTsiXX0=
