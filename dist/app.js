(function e(t,n,r){function s(o,u){if(!n[o]){if(!t[o]){var a=typeof require=="function"&&require;if(!u&&a)return a(o,!0);if(i)return i(o,!0);var f=new Error("Cannot find module '"+o+"'");throw f.code="MODULE_NOT_FOUND",f}var l=n[o]={exports:{}};t[o][0].call(l.exports,function(e){var n=t[o][1][e];return s(n?n:e)},l,l.exports,e,t,n,r)}return n[o].exports}var i=typeof require=="function"&&require;for(var o=0;o<r.length;o++)s(r[o]);return s})({1:[function(require,module,exports){
/**
 * Created by Dmytro on 4/11/2016.
 */
var tpl = require('./heremaps.tpl.html');

module.exports = function(HereMaps){
  return {
      restrict: 'EA',
      template: tpl,
      controller: function($scope, $element){
          console.log(HereMaps);
      },
      link: function(scope){}
  }
};
},{"./heremaps.tpl.html":3}],2:[function(require,module,exports){
module.exports = function () {
    var options = {}, apiLoaded = false;

    return HereMapProvider;

    function HereMapProvider() {
        this.$get = function () {
            return {
                app_id: options.app_id || '',
                app_code: options.app_code || ''
            }
        };

        this.setOptions = function (opts) {
            options = opts;
            if(!apiLoaded)
                _loadAPI();
        };
    }

    function _loadAPI(){
        var script = document.createElement('script');
        script.type = 'text/javascript';
        script.src = 'http://js.api.here.com/v3/3.0/mapsjs-core.js';
        document.getElementsByTagName('head')[0].appendChild(script);

        script.onload = function () {
            apiLoaded = true;
            alert('loaded');
        };
    //<script src="http://js.api.here.com/v3/3.0/mapsjs-core.js"
    //  type="text/javascript" charset="utf-8"></script>
    //<script src="http://js.api.here.com/v3/3.0/mapsjs-service.js"
    //  type="text/javascript" charset="utf-8"></script>
    }
};
},{}],3:[function(require,module,exports){
module.exports = "<div>\r\n    <h1>Here maps</h1>\r\n</div>";

},{}],4:[function(require,module,exports){
(function () {
    'use strict';

    var directive = require('./directive/heremaps.directive'),
        provider = require('./directive/heremaps.provider');

    angular.module('app', [])
        .provider('HereMaps', provider())
        .config(['HereMapsProvider', function (HereMapsProvider) {
            HereMapsProvider.setOptions({
                'app_id': 'wMHJuLgCQzkfbhzXIwRF',
                'app_code': 'WLIc7QzoO8irv7lurUt1qA'
            })
        }])
        .directive('hereMaps', directive);
})();
},{"./directive/heremaps.directive":1,"./directive/heremaps.provider":2}]},{},[4])


//# sourceMappingURL=data:application/json;base64,eyJ2ZXJzaW9uIjozLCJzb3VyY2VzIjpbIm5vZGVfbW9kdWxlcy9icm93c2VyLXBhY2svX3ByZWx1ZGUuanMiLCJzcmMvZGlyZWN0aXZlL2hlcmVtYXBzLmRpcmVjdGl2ZS5qcyIsInNyYy9kaXJlY3RpdmUvaGVyZW1hcHMucHJvdmlkZXIuanMiLCJzcmMvZGlyZWN0aXZlL2hlcmVtYXBzLnRwbC5odG1sIiwic3JjL2luZGV4LmpzIl0sIm5hbWVzIjpbXSwibWFwcGluZ3MiOiJBQUFBO0FDQUE7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBOztBQ2RBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTs7QUNuQ0E7QUFDQTs7QUNEQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQSIsImZpbGUiOiJhcHAuanMiLCJzb3VyY2VSb290IjoiL3NvdXJjZS8iLCJzb3VyY2VzQ29udGVudCI6WyIoZnVuY3Rpb24gZSh0LG4scil7ZnVuY3Rpb24gcyhvLHUpe2lmKCFuW29dKXtpZighdFtvXSl7dmFyIGE9dHlwZW9mIHJlcXVpcmU9PVwiZnVuY3Rpb25cIiYmcmVxdWlyZTtpZighdSYmYSlyZXR1cm4gYShvLCEwKTtpZihpKXJldHVybiBpKG8sITApO3ZhciBmPW5ldyBFcnJvcihcIkNhbm5vdCBmaW5kIG1vZHVsZSAnXCIrbytcIidcIik7dGhyb3cgZi5jb2RlPVwiTU9EVUxFX05PVF9GT1VORFwiLGZ9dmFyIGw9bltvXT17ZXhwb3J0czp7fX07dFtvXVswXS5jYWxsKGwuZXhwb3J0cyxmdW5jdGlvbihlKXt2YXIgbj10W29dWzFdW2VdO3JldHVybiBzKG4/bjplKX0sbCxsLmV4cG9ydHMsZSx0LG4scil9cmV0dXJuIG5bb10uZXhwb3J0c312YXIgaT10eXBlb2YgcmVxdWlyZT09XCJmdW5jdGlvblwiJiZyZXF1aXJlO2Zvcih2YXIgbz0wO288ci5sZW5ndGg7bysrKXMocltvXSk7cmV0dXJuIHN9KSIsIi8qKlxyXG4gKiBDcmVhdGVkIGJ5IERteXRybyBvbiA0LzExLzIwMTYuXHJcbiAqL1xyXG52YXIgdHBsID0gcmVxdWlyZSgnLi9oZXJlbWFwcy50cGwuaHRtbCcpO1xyXG5cclxubW9kdWxlLmV4cG9ydHMgPSBmdW5jdGlvbihIZXJlTWFwcyl7XHJcbiAgcmV0dXJuIHtcclxuICAgICAgcmVzdHJpY3Q6ICdFQScsXHJcbiAgICAgIHRlbXBsYXRlOiB0cGwsXHJcbiAgICAgIGNvbnRyb2xsZXI6IGZ1bmN0aW9uKCRzY29wZSwgJGVsZW1lbnQpe1xyXG4gICAgICAgICAgY29uc29sZS5sb2coSGVyZU1hcHMpO1xyXG4gICAgICB9LFxyXG4gICAgICBsaW5rOiBmdW5jdGlvbihzY29wZSl7fVxyXG4gIH1cclxufTsiLCJtb2R1bGUuZXhwb3J0cyA9IGZ1bmN0aW9uICgpIHtcclxuICAgIHZhciBvcHRpb25zID0ge30sIGFwaUxvYWRlZCA9IGZhbHNlO1xyXG5cclxuICAgIHJldHVybiBIZXJlTWFwUHJvdmlkZXI7XHJcblxyXG4gICAgZnVuY3Rpb24gSGVyZU1hcFByb3ZpZGVyKCkge1xyXG4gICAgICAgIHRoaXMuJGdldCA9IGZ1bmN0aW9uICgpIHtcclxuICAgICAgICAgICAgcmV0dXJuIHtcclxuICAgICAgICAgICAgICAgIGFwcF9pZDogb3B0aW9ucy5hcHBfaWQgfHwgJycsXHJcbiAgICAgICAgICAgICAgICBhcHBfY29kZTogb3B0aW9ucy5hcHBfY29kZSB8fCAnJ1xyXG4gICAgICAgICAgICB9XHJcbiAgICAgICAgfTtcclxuXHJcbiAgICAgICAgdGhpcy5zZXRPcHRpb25zID0gZnVuY3Rpb24gKG9wdHMpIHtcclxuICAgICAgICAgICAgb3B0aW9ucyA9IG9wdHM7XHJcbiAgICAgICAgICAgIGlmKCFhcGlMb2FkZWQpXHJcbiAgICAgICAgICAgICAgICBfbG9hZEFQSSgpO1xyXG4gICAgICAgIH07XHJcbiAgICB9XHJcblxyXG4gICAgZnVuY3Rpb24gX2xvYWRBUEkoKXtcclxuICAgICAgICB2YXIgc2NyaXB0ID0gZG9jdW1lbnQuY3JlYXRlRWxlbWVudCgnc2NyaXB0Jyk7XHJcbiAgICAgICAgc2NyaXB0LnR5cGUgPSAndGV4dC9qYXZhc2NyaXB0JztcclxuICAgICAgICBzY3JpcHQuc3JjID0gJ2h0dHA6Ly9qcy5hcGkuaGVyZS5jb20vdjMvMy4wL21hcHNqcy1jb3JlLmpzJztcclxuICAgICAgICBkb2N1bWVudC5nZXRFbGVtZW50c0J5VGFnTmFtZSgnaGVhZCcpWzBdLmFwcGVuZENoaWxkKHNjcmlwdCk7XHJcblxyXG4gICAgICAgIHNjcmlwdC5vbmxvYWQgPSBmdW5jdGlvbiAoKSB7XHJcbiAgICAgICAgICAgIGFwaUxvYWRlZCA9IHRydWU7XHJcbiAgICAgICAgICAgIGFsZXJ0KCdsb2FkZWQnKTtcclxuICAgICAgICB9O1xyXG4gICAgLy88c2NyaXB0IHNyYz1cImh0dHA6Ly9qcy5hcGkuaGVyZS5jb20vdjMvMy4wL21hcHNqcy1jb3JlLmpzXCJcclxuICAgIC8vICB0eXBlPVwidGV4dC9qYXZhc2NyaXB0XCIgY2hhcnNldD1cInV0Zi04XCI+PC9zY3JpcHQ+XHJcbiAgICAvLzxzY3JpcHQgc3JjPVwiaHR0cDovL2pzLmFwaS5oZXJlLmNvbS92My8zLjAvbWFwc2pzLXNlcnZpY2UuanNcIlxyXG4gICAgLy8gIHR5cGU9XCJ0ZXh0L2phdmFzY3JpcHRcIiBjaGFyc2V0PVwidXRmLThcIj48L3NjcmlwdD5cclxuICAgIH1cclxufTsiLCJtb2R1bGUuZXhwb3J0cyA9IFwiPGRpdj5cXHJcXG4gICAgPGgxPkhlcmUgbWFwczwvaDE+XFxyXFxuPC9kaXY+XCI7XG4iLCIoZnVuY3Rpb24gKCkge1xyXG4gICAgJ3VzZSBzdHJpY3QnO1xyXG5cclxuICAgIHZhciBkaXJlY3RpdmUgPSByZXF1aXJlKCcuL2RpcmVjdGl2ZS9oZXJlbWFwcy5kaXJlY3RpdmUnKSxcclxuICAgICAgICBwcm92aWRlciA9IHJlcXVpcmUoJy4vZGlyZWN0aXZlL2hlcmVtYXBzLnByb3ZpZGVyJyk7XHJcblxyXG4gICAgYW5ndWxhci5tb2R1bGUoJ2FwcCcsIFtdKVxyXG4gICAgICAgIC5wcm92aWRlcignSGVyZU1hcHMnLCBwcm92aWRlcigpKVxyXG4gICAgICAgIC5jb25maWcoWydIZXJlTWFwc1Byb3ZpZGVyJywgZnVuY3Rpb24gKEhlcmVNYXBzUHJvdmlkZXIpIHtcclxuICAgICAgICAgICAgSGVyZU1hcHNQcm92aWRlci5zZXRPcHRpb25zKHtcclxuICAgICAgICAgICAgICAgICdhcHBfaWQnOiAnd01ISnVMZ0NRemtmYmh6WEl3UkYnLFxyXG4gICAgICAgICAgICAgICAgJ2FwcF9jb2RlJzogJ1dMSWM3UXpvTzhpcnY3bHVyVXQxcUEnXHJcbiAgICAgICAgICAgIH0pXHJcbiAgICAgICAgfV0pXHJcbiAgICAgICAgLmRpcmVjdGl2ZSgnaGVyZU1hcHMnLCBkaXJlY3RpdmUpO1xyXG59KSgpOyJdfQ==
