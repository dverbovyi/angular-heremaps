(function e(t,n,r){function s(o,u){if(!n[o]){if(!t[o]){var a=typeof require=="function"&&require;if(!u&&a)return a(o,!0);if(i)return i(o,!0);var f=new Error("Cannot find module '"+o+"'");throw f.code="MODULE_NOT_FOUND",f}var l=n[o]={exports:{}};t[o][0].call(l.exports,function(e){var n=t[o][1][e];return s(n?n:e)},l,l.exports,e,t,n,r)}return n[o].exports}var i=typeof require=="function"&&require;for(var o=0;o<r.length;o++)s(r[o]);return s})({1:[function(require,module,exports){
module.exports = function($rootScope, $q) {
    var options = {}, apiLoaded = false;

    return {
        setConfig: _setConfig,
        getConfig: _getConfig
    }

    function _setConfig(opts) {
        options = opts;
        if (!apiLoaded)
            _loadAPI();
    }

    function _getConfig() {
        return options;
    }

    function _loadAPI() {
        var head = document.getElementsByTagName('head')[0],
            coreScript = document.createElement('script'),
            serviceScript = document.createElement('script');

        coreScript.type = serviceScript.type = 'text/javascript';
        coreScript.src = 'http://js.api.here.com/v3/3.0/mapsjs-core.js';
        serviceScript.src = 'http://js.api.here.com/v3/3.0/mapsjs-service.js';

        var loadCore = function() {
            head.appendChild(coreScript);
            
            return $q(function(resolve, reject) {
                coreScript.onload = resolve;
                coreScript.onerror = reject;
            });
        }

        var loadService = function() {
            head.appendChild(serviceScript);
            
            return $q(function(resolve, reject) {
                serviceScript.onload = resolve;
                serviceScript.onerror = reject;
            });
        }
        
        loadCore().then(function(){
            return loadService();
        }).then(function(){
            apiLoaded = true;
            $rootScope.$emit('HEREMAPS_API_READY');    
        }).catch(function(e){
            console.warn('Here Maps API load failure', e)    
        });
        
    }
};
},{}],2:[function(require,module,exports){
/**
 * Created by Dmytro on 4/11/2016.
 */
var tpl = require('./heremaps.tpl.html');

module.exports = function($rootScope, $window, $timeout, APIProvider) {
    return {
        restrict: 'EA',
        template: tpl,
        replace: true,
        controller: function($scope, $element, $attrs) {
            console.log($attrs)
            var height = $attrs.height || 480,
                width = $attrs.width || 640;

            height = $window.innerHeight;
            width = $window.innerWidth;
            
            $scope.height = height + 'px';
            $scope.width = width + 'px';

            var config = APIProvider.getConfig();

            var apiReadySubscribe = $rootScope.$on('HEREMAPS_API_READY', _apiReadyHandler);
            
            var timeout = null;

            $scope.$on('$destroy', apiReadySubscribe);
            
            $window.addEventListener('resize', _resizeHandler)
            

            function _apiReadyHandler() {
                console.log('ready')
                if($element.html())
                    $element.empty();
                    
                var platform = new H.service.Platform({
                    'app_id': config.app_id,
                    'app_code': config.app_code
                });

                // Obtain the default map types from the platform object:
                var defaultLayers = platform.createDefaultLayers();
                
                console.log(defaultLayers)

                var map = new H.Map(
                    $element[0],
                    defaultLayers.satellite.map,
                    {
                        zoom: 10,
                        center: { lat: 52.5, lng: 13.4 }
                    });
            }
            
            function _resizeHandler(){
                console.log('resize')
                
                $scope.height = $window.innerHeight + 'px';
                $scope.width = $window.innerWidth + 'px';
                
                console.log($scope.height, $scope.width)
                
                $scope.$digest();
                if(timeout)
                    $timeout.cancel(timeout);
                    
                timeout = $timeout(_apiReadyHandler, 500);
            }
            
        },
        link: function(scope) { }
    }
};
},{"./heremaps.tpl.html":3}],3:[function(require,module,exports){
module.exports = "<div ng-style=\"{'width': width, 'height': height}\"></div>";

},{}],4:[function(require,module,exports){
(function () {
    'use strict';

    var directive = require('./directive/heremaps.directive'),
        apiProvider = require('./api.provider');

    angular.module('app', [])
        .factory('APIProvider', apiProvider)
        .run(function (APIProvider) {
            APIProvider.setConfig({
                'app_id': 'wMHJuLgCQzkfbhzXIwRF',
                'app_code': 'WLIc7QzoO8irv7lurUt1qA'
            });
        })
        .directive('hereMaps', directive);
})();
},{"./api.provider":1,"./directive/heremaps.directive":2}]},{},[4])


//# sourceMappingURL=data:application/json;base64,eyJ2ZXJzaW9uIjozLCJzb3VyY2VzIjpbIm5vZGVfbW9kdWxlcy9icm93c2VyLXBhY2svX3ByZWx1ZGUuanMiLCJzcmMvYXBpLnByb3ZpZGVyLmpzIiwic3JjL2RpcmVjdGl2ZS9oZXJlbWFwcy5kaXJlY3RpdmUuanMiLCJzcmMvZGlyZWN0aXZlL2hlcmVtYXBzLnRwbC5odG1sIiwic3JjL2luZGV4LmpzIl0sIm5hbWVzIjpbXSwibWFwcGluZ3MiOiJBQUFBO0FDQUE7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTs7QUN2REE7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBOztBQzFFQTtBQUNBOztBQ0RBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBIiwiZmlsZSI6ImFwcC5qcyIsInNvdXJjZVJvb3QiOiIvc291cmNlLyIsInNvdXJjZXNDb250ZW50IjpbIihmdW5jdGlvbiBlKHQsbixyKXtmdW5jdGlvbiBzKG8sdSl7aWYoIW5bb10pe2lmKCF0W29dKXt2YXIgYT10eXBlb2YgcmVxdWlyZT09XCJmdW5jdGlvblwiJiZyZXF1aXJlO2lmKCF1JiZhKXJldHVybiBhKG8sITApO2lmKGkpcmV0dXJuIGkobywhMCk7dmFyIGY9bmV3IEVycm9yKFwiQ2Fubm90IGZpbmQgbW9kdWxlICdcIitvK1wiJ1wiKTt0aHJvdyBmLmNvZGU9XCJNT0RVTEVfTk9UX0ZPVU5EXCIsZn12YXIgbD1uW29dPXtleHBvcnRzOnt9fTt0W29dWzBdLmNhbGwobC5leHBvcnRzLGZ1bmN0aW9uKGUpe3ZhciBuPXRbb11bMV1bZV07cmV0dXJuIHMobj9uOmUpfSxsLGwuZXhwb3J0cyxlLHQsbixyKX1yZXR1cm4gbltvXS5leHBvcnRzfXZhciBpPXR5cGVvZiByZXF1aXJlPT1cImZ1bmN0aW9uXCImJnJlcXVpcmU7Zm9yKHZhciBvPTA7bzxyLmxlbmd0aDtvKyspcyhyW29dKTtyZXR1cm4gc30pIiwibW9kdWxlLmV4cG9ydHMgPSBmdW5jdGlvbigkcm9vdFNjb3BlLCAkcSkge1xyXG4gICAgdmFyIG9wdGlvbnMgPSB7fSwgYXBpTG9hZGVkID0gZmFsc2U7XHJcblxyXG4gICAgcmV0dXJuIHtcclxuICAgICAgICBzZXRDb25maWc6IF9zZXRDb25maWcsXHJcbiAgICAgICAgZ2V0Q29uZmlnOiBfZ2V0Q29uZmlnXHJcbiAgICB9XHJcblxyXG4gICAgZnVuY3Rpb24gX3NldENvbmZpZyhvcHRzKSB7XHJcbiAgICAgICAgb3B0aW9ucyA9IG9wdHM7XHJcbiAgICAgICAgaWYgKCFhcGlMb2FkZWQpXHJcbiAgICAgICAgICAgIF9sb2FkQVBJKCk7XHJcbiAgICB9XHJcblxyXG4gICAgZnVuY3Rpb24gX2dldENvbmZpZygpIHtcclxuICAgICAgICByZXR1cm4gb3B0aW9ucztcclxuICAgIH1cclxuXHJcbiAgICBmdW5jdGlvbiBfbG9hZEFQSSgpIHtcclxuICAgICAgICB2YXIgaGVhZCA9IGRvY3VtZW50LmdldEVsZW1lbnRzQnlUYWdOYW1lKCdoZWFkJylbMF0sXHJcbiAgICAgICAgICAgIGNvcmVTY3JpcHQgPSBkb2N1bWVudC5jcmVhdGVFbGVtZW50KCdzY3JpcHQnKSxcclxuICAgICAgICAgICAgc2VydmljZVNjcmlwdCA9IGRvY3VtZW50LmNyZWF0ZUVsZW1lbnQoJ3NjcmlwdCcpO1xyXG5cclxuICAgICAgICBjb3JlU2NyaXB0LnR5cGUgPSBzZXJ2aWNlU2NyaXB0LnR5cGUgPSAndGV4dC9qYXZhc2NyaXB0JztcclxuICAgICAgICBjb3JlU2NyaXB0LnNyYyA9ICdodHRwOi8vanMuYXBpLmhlcmUuY29tL3YzLzMuMC9tYXBzanMtY29yZS5qcyc7XHJcbiAgICAgICAgc2VydmljZVNjcmlwdC5zcmMgPSAnaHR0cDovL2pzLmFwaS5oZXJlLmNvbS92My8zLjAvbWFwc2pzLXNlcnZpY2UuanMnO1xyXG5cclxuICAgICAgICB2YXIgbG9hZENvcmUgPSBmdW5jdGlvbigpIHtcclxuICAgICAgICAgICAgaGVhZC5hcHBlbmRDaGlsZChjb3JlU2NyaXB0KTtcclxuICAgICAgICAgICAgXHJcbiAgICAgICAgICAgIHJldHVybiAkcShmdW5jdGlvbihyZXNvbHZlLCByZWplY3QpIHtcclxuICAgICAgICAgICAgICAgIGNvcmVTY3JpcHQub25sb2FkID0gcmVzb2x2ZTtcclxuICAgICAgICAgICAgICAgIGNvcmVTY3JpcHQub25lcnJvciA9IHJlamVjdDtcclxuICAgICAgICAgICAgfSk7XHJcbiAgICAgICAgfVxyXG5cclxuICAgICAgICB2YXIgbG9hZFNlcnZpY2UgPSBmdW5jdGlvbigpIHtcclxuICAgICAgICAgICAgaGVhZC5hcHBlbmRDaGlsZChzZXJ2aWNlU2NyaXB0KTtcclxuICAgICAgICAgICAgXHJcbiAgICAgICAgICAgIHJldHVybiAkcShmdW5jdGlvbihyZXNvbHZlLCByZWplY3QpIHtcclxuICAgICAgICAgICAgICAgIHNlcnZpY2VTY3JpcHQub25sb2FkID0gcmVzb2x2ZTtcclxuICAgICAgICAgICAgICAgIHNlcnZpY2VTY3JpcHQub25lcnJvciA9IHJlamVjdDtcclxuICAgICAgICAgICAgfSk7XHJcbiAgICAgICAgfVxyXG4gICAgICAgIFxyXG4gICAgICAgIGxvYWRDb3JlKCkudGhlbihmdW5jdGlvbigpe1xyXG4gICAgICAgICAgICByZXR1cm4gbG9hZFNlcnZpY2UoKTtcclxuICAgICAgICB9KS50aGVuKGZ1bmN0aW9uKCl7XHJcbiAgICAgICAgICAgIGFwaUxvYWRlZCA9IHRydWU7XHJcbiAgICAgICAgICAgICRyb290U2NvcGUuJGVtaXQoJ0hFUkVNQVBTX0FQSV9SRUFEWScpOyAgICBcclxuICAgICAgICB9KS5jYXRjaChmdW5jdGlvbihlKXtcclxuICAgICAgICAgICAgY29uc29sZS53YXJuKCdIZXJlIE1hcHMgQVBJIGxvYWQgZmFpbHVyZScsIGUpICAgIFxyXG4gICAgICAgIH0pO1xyXG4gICAgICAgIFxyXG4gICAgfVxyXG59OyIsIi8qKlxyXG4gKiBDcmVhdGVkIGJ5IERteXRybyBvbiA0LzExLzIwMTYuXHJcbiAqL1xyXG52YXIgdHBsID0gcmVxdWlyZSgnLi9oZXJlbWFwcy50cGwuaHRtbCcpO1xyXG5cclxubW9kdWxlLmV4cG9ydHMgPSBmdW5jdGlvbigkcm9vdFNjb3BlLCAkd2luZG93LCAkdGltZW91dCwgQVBJUHJvdmlkZXIpIHtcclxuICAgIHJldHVybiB7XHJcbiAgICAgICAgcmVzdHJpY3Q6ICdFQScsXHJcbiAgICAgICAgdGVtcGxhdGU6IHRwbCxcclxuICAgICAgICByZXBsYWNlOiB0cnVlLFxyXG4gICAgICAgIGNvbnRyb2xsZXI6IGZ1bmN0aW9uKCRzY29wZSwgJGVsZW1lbnQsICRhdHRycykge1xyXG4gICAgICAgICAgICBjb25zb2xlLmxvZygkYXR0cnMpXHJcbiAgICAgICAgICAgIHZhciBoZWlnaHQgPSAkYXR0cnMuaGVpZ2h0IHx8IDQ4MCxcclxuICAgICAgICAgICAgICAgIHdpZHRoID0gJGF0dHJzLndpZHRoIHx8IDY0MDtcclxuXHJcbiAgICAgICAgICAgIGhlaWdodCA9ICR3aW5kb3cuaW5uZXJIZWlnaHQ7XHJcbiAgICAgICAgICAgIHdpZHRoID0gJHdpbmRvdy5pbm5lcldpZHRoO1xyXG4gICAgICAgICAgICBcclxuICAgICAgICAgICAgJHNjb3BlLmhlaWdodCA9IGhlaWdodCArICdweCc7XHJcbiAgICAgICAgICAgICRzY29wZS53aWR0aCA9IHdpZHRoICsgJ3B4JztcclxuXHJcbiAgICAgICAgICAgIHZhciBjb25maWcgPSBBUElQcm92aWRlci5nZXRDb25maWcoKTtcclxuXHJcbiAgICAgICAgICAgIHZhciBhcGlSZWFkeVN1YnNjcmliZSA9ICRyb290U2NvcGUuJG9uKCdIRVJFTUFQU19BUElfUkVBRFknLCBfYXBpUmVhZHlIYW5kbGVyKTtcclxuICAgICAgICAgICAgXHJcbiAgICAgICAgICAgIHZhciB0aW1lb3V0ID0gbnVsbDtcclxuXHJcbiAgICAgICAgICAgICRzY29wZS4kb24oJyRkZXN0cm95JywgYXBpUmVhZHlTdWJzY3JpYmUpO1xyXG4gICAgICAgICAgICBcclxuICAgICAgICAgICAgJHdpbmRvdy5hZGRFdmVudExpc3RlbmVyKCdyZXNpemUnLCBfcmVzaXplSGFuZGxlcilcclxuICAgICAgICAgICAgXHJcblxyXG4gICAgICAgICAgICBmdW5jdGlvbiBfYXBpUmVhZHlIYW5kbGVyKCkge1xyXG4gICAgICAgICAgICAgICAgY29uc29sZS5sb2coJ3JlYWR5JylcclxuICAgICAgICAgICAgICAgIGlmKCRlbGVtZW50Lmh0bWwoKSlcclxuICAgICAgICAgICAgICAgICAgICAkZWxlbWVudC5lbXB0eSgpO1xyXG4gICAgICAgICAgICAgICAgICAgIFxyXG4gICAgICAgICAgICAgICAgdmFyIHBsYXRmb3JtID0gbmV3IEguc2VydmljZS5QbGF0Zm9ybSh7XHJcbiAgICAgICAgICAgICAgICAgICAgJ2FwcF9pZCc6IGNvbmZpZy5hcHBfaWQsXHJcbiAgICAgICAgICAgICAgICAgICAgJ2FwcF9jb2RlJzogY29uZmlnLmFwcF9jb2RlXHJcbiAgICAgICAgICAgICAgICB9KTtcclxuXHJcbiAgICAgICAgICAgICAgICAvLyBPYnRhaW4gdGhlIGRlZmF1bHQgbWFwIHR5cGVzIGZyb20gdGhlIHBsYXRmb3JtIG9iamVjdDpcclxuICAgICAgICAgICAgICAgIHZhciBkZWZhdWx0TGF5ZXJzID0gcGxhdGZvcm0uY3JlYXRlRGVmYXVsdExheWVycygpO1xyXG4gICAgICAgICAgICAgICAgXHJcbiAgICAgICAgICAgICAgICBjb25zb2xlLmxvZyhkZWZhdWx0TGF5ZXJzKVxyXG5cclxuICAgICAgICAgICAgICAgIHZhciBtYXAgPSBuZXcgSC5NYXAoXHJcbiAgICAgICAgICAgICAgICAgICAgJGVsZW1lbnRbMF0sXHJcbiAgICAgICAgICAgICAgICAgICAgZGVmYXVsdExheWVycy5zYXRlbGxpdGUubWFwLFxyXG4gICAgICAgICAgICAgICAgICAgIHtcclxuICAgICAgICAgICAgICAgICAgICAgICAgem9vbTogMTAsXHJcbiAgICAgICAgICAgICAgICAgICAgICAgIGNlbnRlcjogeyBsYXQ6IDUyLjUsIGxuZzogMTMuNCB9XHJcbiAgICAgICAgICAgICAgICAgICAgfSk7XHJcbiAgICAgICAgICAgIH1cclxuICAgICAgICAgICAgXHJcbiAgICAgICAgICAgIGZ1bmN0aW9uIF9yZXNpemVIYW5kbGVyKCl7XHJcbiAgICAgICAgICAgICAgICBjb25zb2xlLmxvZygncmVzaXplJylcclxuICAgICAgICAgICAgICAgIFxyXG4gICAgICAgICAgICAgICAgJHNjb3BlLmhlaWdodCA9ICR3aW5kb3cuaW5uZXJIZWlnaHQgKyAncHgnO1xyXG4gICAgICAgICAgICAgICAgJHNjb3BlLndpZHRoID0gJHdpbmRvdy5pbm5lcldpZHRoICsgJ3B4JztcclxuICAgICAgICAgICAgICAgIFxyXG4gICAgICAgICAgICAgICAgY29uc29sZS5sb2coJHNjb3BlLmhlaWdodCwgJHNjb3BlLndpZHRoKVxyXG4gICAgICAgICAgICAgICAgXHJcbiAgICAgICAgICAgICAgICAkc2NvcGUuJGRpZ2VzdCgpO1xyXG4gICAgICAgICAgICAgICAgaWYodGltZW91dClcclxuICAgICAgICAgICAgICAgICAgICAkdGltZW91dC5jYW5jZWwodGltZW91dCk7XHJcbiAgICAgICAgICAgICAgICAgICAgXHJcbiAgICAgICAgICAgICAgICB0aW1lb3V0ID0gJHRpbWVvdXQoX2FwaVJlYWR5SGFuZGxlciwgNTAwKTtcclxuICAgICAgICAgICAgfVxyXG4gICAgICAgICAgICBcclxuICAgICAgICB9LFxyXG4gICAgICAgIGxpbms6IGZ1bmN0aW9uKHNjb3BlKSB7IH1cclxuICAgIH1cclxufTsiLCJtb2R1bGUuZXhwb3J0cyA9IFwiPGRpdiBuZy1zdHlsZT1cXFwieyd3aWR0aCc6IHdpZHRoLCAnaGVpZ2h0JzogaGVpZ2h0fVxcXCI+PC9kaXY+XCI7XG4iLCIoZnVuY3Rpb24gKCkge1xyXG4gICAgJ3VzZSBzdHJpY3QnO1xyXG5cclxuICAgIHZhciBkaXJlY3RpdmUgPSByZXF1aXJlKCcuL2RpcmVjdGl2ZS9oZXJlbWFwcy5kaXJlY3RpdmUnKSxcclxuICAgICAgICBhcGlQcm92aWRlciA9IHJlcXVpcmUoJy4vYXBpLnByb3ZpZGVyJyk7XHJcblxyXG4gICAgYW5ndWxhci5tb2R1bGUoJ2FwcCcsIFtdKVxyXG4gICAgICAgIC5mYWN0b3J5KCdBUElQcm92aWRlcicsIGFwaVByb3ZpZGVyKVxyXG4gICAgICAgIC5ydW4oZnVuY3Rpb24gKEFQSVByb3ZpZGVyKSB7XHJcbiAgICAgICAgICAgIEFQSVByb3ZpZGVyLnNldENvbmZpZyh7XHJcbiAgICAgICAgICAgICAgICAnYXBwX2lkJzogJ3dNSEp1TGdDUXprZmJoelhJd1JGJyxcclxuICAgICAgICAgICAgICAgICdhcHBfY29kZSc6ICdXTEljN1F6b084aXJ2N2x1clV0MXFBJ1xyXG4gICAgICAgICAgICB9KTtcclxuICAgICAgICB9KVxyXG4gICAgICAgIC5kaXJlY3RpdmUoJ2hlcmVNYXBzJywgZGlyZWN0aXZlKTtcclxufSkoKTsiXX0=
