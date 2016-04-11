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