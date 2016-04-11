/**
 * Created by Dmytro on 4/11/2016.
 */
(function(){
    'use strict';

    angular.module('hereMaps', [])
        .provider()
        .directive('hereMaps', HereMaps);

    function HereMaps() {
        return {
            restrict: EA,
            templateUrl: 'heremaps.tpl.html',
            controller: function($scope, $element){

            },
            link: function(){}

        }
    }
})();